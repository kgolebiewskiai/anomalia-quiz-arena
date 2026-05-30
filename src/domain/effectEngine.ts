// Effect Engine — Phase 8
// Pure scoring computation. The SQL submit_answer RPC mirrors this logic exactly.
// Caller is responsible for supplying correct state; this function has no side effects.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveMod {
  id: string
  draftStage: number              // 3, 6, or 9 — when the mod was selected
  questionsRemaining: number | null  // null = permanent (no question limit)
  usesRemaining: number | null       // null = unlimited
  state: Record<string, unknown>
}

export interface ScoringInput {
  isCorrect: boolean
  responseMs: number              // how long player took (≥ 0, ≤ effectiveTime)
  baseQuestionTimeMs: number      // usually 15 000 (from rooms.current_phase_duration_ms)
  questionIndex: number           // 1–12
  anomalyId: string | null

  profileId: string | null
  streak: number                  // correct answers in a row BEFORE this question
  playerRank: number              // 1 = leader (computed from score before this answer)
  totalPlayers: number            // total active players in the room
  prevCategoryId: string | null   // category of previous question (for Archiwista)
  currentCategoryId: string | null

  // All player_modifications rows — active AND expired (for state-effect checks)
  activeMods: ActiveMod[]

  // Profile-active flags (UI sets these when the player taps the active button)
  profileActiveUsedThisQuestion: boolean

  // Katalizator passive: first correct after each mod selection
  isFirstCorrectAfterModSelection: boolean

  // Null profile passive: shield available (not yet used this game)
  nullProfilePassiveAvailable: boolean

  // Stabilizator passive: how many half-penalty shields remain (0–2)
  stabilizatorPassiveUsesLeft: number

  // Stabilizator active: used this question (cancels base penalty)
  stabilizatorActiveUsedThisQuestion: boolean

  // Obserwator active: player chose to view answer distribution (−30 %)
  obserwatorActiveUsed: boolean

  // Druga Próba: player changed their answer (correct = 50 % of total)
  drugaProbaUsed: boolean

  // PvP context — computed externally, injected here
  pvpTimeReductionMs: number       // ms removed by Interferencja Lidera
  pvpSpeedPenaltyFraction: number  // 0–1 fraction (0.3 = 30 %) from Zakłócenie Kanału
  pvpImmune: boolean               // Tarcza Fazowa / Izolator / Próba Kontrolna anomaly
  receivedPvpThisQuestion: boolean // for Odbicie Sygnału trigger
  fasterThanLeaderThisQuestion: boolean // for Transfer Impulsu trigger
}

export interface BreakdownLine {
  label: string
  value: number
}

export interface ScoringResult {
  effectiveQuestionTimeMs: number
  isCorrect: boolean
  blocked: boolean               // true when Opóźniona Reakcja blocks this question
  basePoints: number
  speedBonus: number
  flatBonus: number
  multiplier: number
  additionalPenalty: number      // extra negative from mods on wrong answers
  total: number
  breakdown: BreakdownLine[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isModActive(mod: ActiveMod): boolean {
  if (mod.questionsRemaining !== null && mod.questionsRemaining <= 0) return false
  if (mod.usesRemaining !== null && mod.usesRemaining <= 0) return false
  return true
}

// ── Main function ─────────────────────────────────────────────────────────────

export function computeScore(input: ScoringInput): ScoringResult {
  const findMod = (id: string) => input.activeMods.find(m => m.id === id && isModActive(m))
  const hasMod = (id: string) => findMod(id) !== undefined

  // ── 1. Effective question time ────────────────────────────────────────────

  let effectiveTimeMs = input.baseQuestionTimeMs

  // Chronotyp passive (+1 s) and active (+4 s)
  if (input.profileId === 'chronotyp') {
    effectiveTimeMs += 1000
    if (input.profileActiveUsedThisQuestion) effectiveTimeMs += 4000
  }

  // Akcelerator Decyzji: −3 s
  if (hasMod('akcelerator-decyzji'))
    effectiveTimeMs = Math.max(1000, effectiveTimeMs - 3000)

  // Pętla Testowa nextQBonus: +3 s (set by SQL when previous wrong triggered it)
  // We check ALL mods (even expired) for this state effect
  const petlaMod = input.activeMods.find(m => m.id === 'petla-testowa')
  if (petlaMod?.state['nextQBonus'] === true)
    effectiveTimeMs += 3000

  // Anomaly: Niestabilne Pole (−2 s for all)
  if (input.anomalyId === 'niestabilne-pole')
    effectiveTimeMs = Math.max(1000, effectiveTimeMs - 2000)

  // PvP: Interferencja Lidera (−3 s to target)
  if (!input.pvpImmune && input.pvpTimeReductionMs > 0)
    effectiveTimeMs = Math.max(1000, effectiveTimeMs - input.pvpTimeReductionMs)

  // ── 2. Blocked? (Opóźniona Reakcja block phase) ───────────────────────────
  // Block covers the 2 questions immediately after the draft stage.
  // E.g. selected at draft 3 → blocked at q4, q5; bonus from q6 onward.

  const opoznionaMod = input.activeMods.find(m => m.id === 'opozniona-reakcja')
  const opoznionaQDiff = opoznionaMod ? input.questionIndex - opoznionaMod.draftStage : 0
  const blocked = opoznionaMod !== undefined && opoznionaQDiff >= 1 && opoznionaQDiff <= 2

  if (blocked) {
    return {
      effectiveQuestionTimeMs: effectiveTimeMs,
      isCorrect: false,
      blocked: true,
      basePoints: 0,
      speedBonus: 0,
      flatBonus: 0,
      multiplier: 1,
      additionalPenalty: 0,
      total: 0,
      breakdown: [{ label: 'Opóźniona Reakcja (blokada)', value: 0 }],
    }
  }

  const breakdown: BreakdownLine[] = []

  // ── 3. Base score ─────────────────────────────────────────────────────────

  let basePoints: number
  if (input.isCorrect) {
    if (input.anomalyId === 'przesuniecie-fazowe') {
      basePoints = 125
      breakdown.push({ label: '+125 poprawna odpowiedź (Przesunięcie Fazowe)', value: 125 })
    } else {
      basePoints = 100
      breakdown.push({ label: '+100 poprawna odpowiedź', value: 100 })
    }
  } else {
    basePoints = -25
    // pushed later after shield processing
  }

  // ── 4. Speed bonus ────────────────────────────────────────────────────────

  let speedBonus = 0
  if (input.isCorrect && input.anomalyId !== 'przesuniecie-fazowe') {
    const maxSpeed = input.anomalyId === 'wzmocnienie-sygnalu' ? 75 : 50
    const remaining = Math.max(0, effectiveTimeMs - input.responseMs)
    let raw = Math.floor((maxSpeed * remaining) / effectiveTimeMs)

    // PvP: Zakłócenie Kanału reduces speed bonus
    if (!input.pvpImmune && input.pvpSpeedPenaltyFraction > 0)
      raw = Math.floor(raw * (1 - input.pvpSpeedPenaltyFraction))

    // Wektor active: double speed bonus (max extra +50)
    if (input.profileId === 'wektor' && input.profileActiveUsedThisQuestion)
      raw += Math.min(raw, 50)

    speedBonus = raw
  }

  if (speedBonus > 0)
    breakdown.push({ label: `+${speedBonus} szybkość`, value: speedBonus })

  // ── 5. Flat bonuses (correct answers only) ────────────────────────────────

  let flatBonus = 0

  if (input.isCorrect) {
    const addFlat = (label: string, val: number) => {
      breakdown.push({ label, value: val })
      flatBonus += val
    }

    // ── Profile passives / actives ──

    if (input.profileId === 'katalizator') {
      if (input.isFirstCorrectAfterModSelection)
        addFlat('+40 Katalizator (pierwsza poprawna po Modyfikacji)', 40)
      if (input.profileActiveUsedThisQuestion && input.activeMods.some(isModActive))
        addFlat('+60 Katalizator (aktywna)', 60)
    }

    if (input.profileId === 'wektor' && input.responseMs <= 4000)
      addFlat('+25 Wektor (szybka odpowiedź ≤4s)', 25)

    if (input.profileId === 'synapsa') {
      const ns = input.streak + 1
      if (ns % 3 === 0) addFlat(`+60 Synapsa (seria ×${ns})`, 60)
    }

    if (
      input.profileId === 'archiwista' &&
      input.prevCategoryId !== null &&
      input.prevCategoryId === input.currentCategoryId
    )
      addFlat('+50 Archiwista (ta sama kategoria)', 50)

    if (input.profileId === 'fraktal') {
      if (input.playerRank > Math.ceil(input.totalPlayers / 2))
        addFlat('+30 Fraktal (dolna połowa)', 30)
      if (input.profileActiveUsedThisQuestion && input.playerRank === input.totalPlayers)
        addFlat('+100 Fraktal (aktywna — ostatnie miejsce)', 100)
    }

    // ── Modification flats ──

    if (hasMod('wzmocnienie-sygnalu'))
      addFlat('+30 Wzmocnienie Sygnału', 30)

    if (hasMod('kalibracja-odruchu') && input.responseMs <= 4000)
      addFlat('+35 Kalibracja Odruchu (≤4s)', 35)

    if (hasMod('reakcja-lancuchowa')) {
      const ns = input.streak + 1
      const bonus = ns >= 4 ? 60 : ns === 3 ? 40 : ns === 2 ? 20 : 0
      if (bonus > 0) addFlat(`+${bonus} Reakcja Łańcuchowa (seria ×${ns})`, bonus)
    }

    if (hasMod('proba-krytyczna'))
      addFlat('+100 Próba Krytyczna (poprawna)', 100)

    if (hasMod('cichy-protokol') && input.playerRank > 1)
      addFlat('+40 Cichy Protokół (nie lider)', 40)

    if (hasMod('odbicie-sygnalu') && input.receivedPvpThisQuestion)
      addFlat('+75 Odbicie Sygnału (po ataku PvP)', 75)

    if (hasMod('transfer-impulsu') && input.fasterThanLeaderThisQuestion)
      addFlat('+40 Transfer Impulsu (szybciej od lidera)', 40)

    // Nadpisanie Wyniku: buffer payout when 2 questions have passed since set
    const nadMod = input.activeMods.find(m => m.id === 'nadpisanie-wyniku')
    if (nadMod) {
      const buffer = Number(nadMod.state['buffer'] ?? 0)
      const setAt = Number(nadMod.state['buffer_set_at'] ?? 0)
      if (buffer > 0 && setAt > 0 && input.questionIndex - setAt >= 2)
        addFlat(`+${buffer} Nadpisanie Wyniku (wypłata)`, buffer)
    }
  }

  // ── 6. Multiplier (correct answers only) ──────────────────────────────────

  let multiplier = 1.0

  if (input.isCorrect) {
    // Horyzont passive: +20 % in q10–12; active: +40 % total (replaces passive)
    if (input.profileId === 'horyzont' && input.questionIndex >= 10) {
      multiplier += input.profileActiveUsedThisQuestion ? 0.40 : 0.20
    }

    if (hasMod('prog-pewnosci')) multiplier += 0.50
    // Opóźniona Reakcja bonus phase (qDiff > 2 after block)
    if (opoznionaMod && opoznionaQDiff > 2) multiplier += 0.25
    if (hasMod('akcelerator-decyzji')) multiplier += 0.40
    if (hasMod('kompensacja-deficytu') && input.playerRank > Math.ceil(input.totalPlayers / 2))
      multiplier += 0.25
    if (hasMod('rezonans-koncowy') && input.questionIndex >= 10 && input.playerRank > 1)
      multiplier += 0.30
    if (input.anomalyId === 'fluktuacja-wyniku') multiplier += 0.20
    if (input.profileId === 'obserwator' && input.obserwatorActiveUsed) multiplier -= 0.30
    if (hasMod('druga-proba') && input.drugaProbaUsed) multiplier *= 0.50
    multiplier = Math.max(0, multiplier)
  }

  // ── 7. Correct answer: compute total ─────────────────────────────────────

  if (input.isCorrect) {
    const subtotal = basePoints + speedBonus + flatBonus
    const total = Math.round(subtotal * multiplier)
    if (multiplier !== 1.0) {
      breakdown.push({
        label: `×${multiplier % 1 === 0 ? multiplier.toFixed(0) : multiplier.toFixed(2)} multiplikator`,
        value: total - subtotal,
      })
    }
    breakdown.push({ label: '= razem', value: total })
    return {
      effectiveQuestionTimeMs: effectiveTimeMs,
      isCorrect: true,
      blocked: false,
      basePoints,
      speedBonus,
      flatBonus,
      multiplier,
      additionalPenalty: 0,
      total,
      breakdown,
    }
  }

  // ── 8. Wrong answer: shields then additional penalties ────────────────────

  let penaltyBase = -25
  let fullyShielded = false

  // Full shields (priority order — only one applies)
  if (input.profileId === 'stabilizator' && input.stabilizatorActiveUsedThisQuestion) {
    penaltyBase = 0
    fullyShielded = true
    breakdown.push({ label: 'Stabilizator (aktywna — kara anulowana)', value: 0 })
  } else if (input.profileId === 'null' && input.nullProfilePassiveAvailable) {
    penaltyBase = 0
    fullyShielded = true
    breakdown.push({ label: 'Null (pasywna — pierwsza błędna bez kary)', value: 0 })
  } else if (hasMod('bezpiecznik')) {
    penaltyBase = 0
    fullyShielded = true
    breakdown.push({ label: 'Bezpiecznik (pierwsza błędna bez kary)', value: 0 })
  } else if (hasMod('petla-testowa')) {
    penaltyBase = 0
    fullyShielded = true
    breakdown.push({ label: 'Pętla Testowa (kara anulowana + +3s następne pytanie)', value: 0 })
  }

  if (!fullyShielded) {
    // Stabilizator passive: 50 % reduction (−25 → −12)
    if (input.profileId === 'stabilizator' && input.stabilizatorPassiveUsesLeft > 0)
      penaltyBase = -Math.floor(25 / 2)

    // Stabilizacja Wyniku mod: reduce by 50, can't go positive
    if (hasMod('stabilizacja-wyniku'))
      penaltyBase = Math.min(penaltyBase + 50, 0)

    breakdown.push({ label: `${penaltyBase} błędna odpowiedź`, value: penaltyBase })
  }

  // Additional penalties (apply regardless of base shield)
  let additionalPenalty = 0

  if (hasMod('prog-pewnosci')) {
    additionalPenalty += 75
    breakdown.push({ label: '-75 Próg Pewności (kara za błąd)', value: -75 })
  }
  if (hasMod('proba-krytyczna')) {
    additionalPenalty += 100
    breakdown.push({ label: '-100 Próba Krytyczna (kara za błąd)', value: -100 })
  }
  if (input.anomalyId === 'fluktuacja-wyniku') {
    additionalPenalty += 25
    breakdown.push({ label: '-25 Fluktuacja Wyniku (kara)', value: -25 })
  }

  const total = penaltyBase - additionalPenalty
  breakdown.push({ label: '= razem', value: total })

  return {
    effectiveQuestionTimeMs: effectiveTimeMs,
    isCorrect: false,
    blocked: false,
    basePoints,
    speedBonus: 0,
    flatBonus: 0,
    multiplier: 1,
    additionalPenalty,
    total,
    breakdown,
  }
}
