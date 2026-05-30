import { describe, it, expect } from 'vitest'
import { computeScore } from '../domain/effectEngine'
import type { ScoringInput, ActiveMod } from '../domain/effectEngine'

// ── Test helpers ──────────────────────────────────────────────────────────────

function base(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    isCorrect: true,
    responseMs: 15000,       // answered at last moment → no speed bonus
    baseQuestionTimeMs: 15000,
    questionIndex: 1,
    anomalyId: null,
    profileId: null,
    streak: 0,
    playerRank: 1,
    totalPlayers: 4,
    prevCategoryId: null,
    currentCategoryId: 'cat-a',
    activeMods: [],
    profileActiveUsedThisQuestion: false,
    isFirstCorrectAfterModSelection: false,
    nullProfilePassiveAvailable: true,
    stabilizatorPassiveUsesLeft: 2,
    stabilizatorActiveUsedThisQuestion: false,
    obserwatorActiveUsed: false,
    drugaProbaUsed: false,
    pvpTimeReductionMs: 0,
    pvpSpeedPenaltyFraction: 0,
    pvpImmune: false,
    receivedPvpThisQuestion: false,
    fasterThanLeaderThisQuestion: false,
    ...overrides,
  }
}

function mod(id: string, extra: Partial<ActiveMod> = {}): ActiveMod {
  return {
    id,
    draftStage: 3,
    questionsRemaining: null,
    usesRemaining: null,
    state: {},
    ...extra,
  }
}

// ── Base scoring (no card effects) ────────────────────────────────────────────

describe('Base scoring', () => {
  it('correct answer = 100 pkt (no speed bonus when responseMs = effectiveTime)', () => {
    const r = computeScore(base())
    expect(r.total).toBe(100)
    expect(r.basePoints).toBe(100)
    expect(r.speedBonus).toBe(0)
  })

  it('wrong answer = −25 pkt', () => {
    const r = computeScore(base({ isCorrect: false }))
    expect(r.total).toBe(-25)
  })

  it('speed bonus: floor(50 * remaining / effective)', () => {
    // responseMs=0 → remaining=15000, bonus=50
    const r = computeScore(base({ responseMs: 0 }))
    expect(r.speedBonus).toBe(50)
    expect(r.total).toBe(150)
  })

  it('speed bonus partial: responseMs=5000, remaining=10000, bonus=floor(50*10000/15000)=33', () => {
    const r = computeScore(base({ responseMs: 5000 }))
    expect(r.speedBonus).toBe(33)
  })

  it('spec example: base+speed+flat × multiplier → 214', () => {
    // Katalizator passive +40, Opóźniona Reakcja × 1.25, responseMs≈5700 → speed≈31
    const responseMs = Math.round(15000 - (31 * 15000) / 50)  // ~5700
    const r = computeScore(base({
      profileId: 'katalizator',
      responseMs,
      isFirstCorrectAfterModSelection: true,
      activeMods: [mod('opozniona-reakcja', { draftStage: 3 })],
      questionIndex: 6,  // qDiff = 6-3 = 3 > 2 → bonus phase
    }))
    expect(r.speedBonus).toBe(31)
    expect(r.flatBonus).toBe(40)
    expect(r.multiplier).toBeCloseTo(1.25)
    expect(r.total).toBe(214)
  })
})

// ── Profiles ──────────────────────────────────────────────────────────────────

describe('Profil: Chronotyp', () => {
  it('pasywna: effectiveTime += 1000', () => {
    const r = computeScore(base({ profileId: 'chronotyp' }))
    expect(r.effectiveQuestionTimeMs).toBe(16000)
  })

  it('aktywna: effectiveTime += 4000 (łącznie +5s z pasywną)', () => {
    const r = computeScore(base({ profileId: 'chronotyp', profileActiveUsedThisQuestion: true }))
    expect(r.effectiveQuestionTimeMs).toBe(20000)
  })

  it('dłuższy czas → mniejszy speed bonus (correct answer)', () => {
    const r = computeScore(base({ profileId: 'chronotyp', responseMs: 0 }))
    expect(r.speedBonus).toBe(Math.floor(50 * 16000 / 16000))  // still 50 (at 0ms)
  })
})

describe('Profil: Katalizator', () => {
  it('pasywna: +40 na pierwszą poprawną po wyborze Modyfikacji', () => {
    const r = computeScore(base({ profileId: 'katalizator', isFirstCorrectAfterModSelection: true }))
    expect(r.total).toBe(140)
  })

  it('pasywna: brak +40 gdy flaga false', () => {
    const r = computeScore(base({ profileId: 'katalizator', isFirstCorrectAfterModSelection: false }))
    expect(r.total).toBe(100)
  })

  it('aktywna: +60 gdy aktywna modyfikacja istnieje', () => {
    const r = computeScore(base({
      profileId: 'katalizator',
      profileActiveUsedThisQuestion: true,
      activeMods: [mod('wzmocnienie-sygnalu')],
    }))
    expect(r.total).toBe(100 + 30 + 60)  // Wzmocnienie +30, Katalizator active +60
  })
})

describe('Profil: Stabilizator', () => {
  it('pasywna: pierwsza błędna → −12 zamiast −25 (50% redukcji)', () => {
    const r = computeScore(base({ isCorrect: false, profileId: 'stabilizator', stabilizatorPassiveUsesLeft: 2 }))
    expect(r.total).toBe(-12)
  })

  it('pasywna: zużyta (usesLeft=0) → normalna kara −25', () => {
    const r = computeScore(base({ isCorrect: false, profileId: 'stabilizator', stabilizatorPassiveUsesLeft: 0 }))
    expect(r.total).toBe(-25)
  })

  it('aktywna: anuluje karę bazową (0 pkt)', () => {
    const r = computeScore(base({
      isCorrect: false,
      profileId: 'stabilizator',
      stabilizatorActiveUsedThisQuestion: true,
    }))
    expect(r.total).toBe(0)
  })

  it('aktywna nie anuluje kar z Modyfikacji (Próg Pewności −75 nadal działa)', () => {
    const r = computeScore(base({
      isCorrect: false,
      profileId: 'stabilizator',
      stabilizatorActiveUsedThisQuestion: true,
      activeMods: [mod('prog-pewnosci', { questionsRemaining: 1 })],
    }))
    expect(r.total).toBe(-75)
  })
})

describe('Profil: Spektrometr', () => {
  it('brak efektu punktowego — tylko UI (widzisz kategorię/trudność wcześniej)', () => {
    const r = computeScore(base({ profileId: 'spektrometr' }))
    expect(r.total).toBe(100)
  })
})

describe('Profil: Replikant', () => {
  it('pasywna: brak efektu punktowego (widzi Modyfikację lidera — UI)', () => {
    const r = computeScore(base({ profileId: 'replikant' }))
    expect(r.total).toBe(100)
  })
})

describe('Profil: Operator Pola', () => {
  it('pvpImmune=true → PvP penalty nie działa', () => {
    const r = computeScore(base({
      profileId: 'operator-pola',
      pvpImmune: true,
      pvpSpeedPenaltyFraction: 0.3,
      responseMs: 0,
    }))
    expect(r.speedBonus).toBe(50)  // pełny bonus, bo odporność
  })
})

describe('Profil: Synapsa', () => {
  it('pasywna: +60 gdy streak osiąga 3 (streak=2 przed tą odpowiedzią)', () => {
    const r = computeScore(base({ profileId: 'synapsa', streak: 2 }))
    expect(r.total).toBe(160)  // 100 + 60
  })

  it('pasywna: +60 przy streak=5 (seria ×6)', () => {
    const r = computeScore(base({ profileId: 'synapsa', streak: 5 }))
    expect(r.total).toBe(160)
  })

  it('pasywna: brak +60 przy streak=1 (seria ×2, nie wielokrotność 3)', () => {
    const r = computeScore(base({ profileId: 'synapsa', streak: 1 }))
    expect(r.total).toBe(100)
  })
})

describe('Profil: Null', () => {
  it('pasywna: pierwsza błędna → 0 pkt', () => {
    const r = computeScore(base({ isCorrect: false, profileId: 'null', nullProfilePassiveAvailable: true }))
    expect(r.total).toBe(0)
  })

  it('pasywna zużyta → normalna kara −25', () => {
    const r = computeScore(base({ isCorrect: false, profileId: 'null', nullProfilePassiveAvailable: false }))
    expect(r.total).toBe(-25)
  })
})

describe('Profil: Wektor', () => {
  it('pasywna: +25 gdy responseMs ≤ 4000', () => {
    // speed = floor(50*(15000-4000)/15000) = floor(36.67) = 36
    const r = computeScore(base({ profileId: 'wektor', responseMs: 4000 }))
    expect(r.speedBonus).toBe(36)
    expect(r.flatBonus).toBe(25)
    expect(r.total).toBe(161)  // 100 + 36 + 25
  })

  it('pasywna: brak +25 przy responseMs > 4000', () => {
    const r = computeScore(base({ profileId: 'wektor', responseMs: 5000 }))
    expect(r.flatBonus).toBe(0)
  })

  it('aktywna: podwaja speed bonus (maks. +50 extra)', () => {
    // responseMs=0 → raw speed=50; aktywna: 50+min(50,50)=100; pasywna +25 też aktywna (≤4s)
    const r = computeScore(base({ profileId: 'wektor', responseMs: 0, profileActiveUsedThisQuestion: true }))
    expect(r.speedBonus).toBe(100)
    expect(r.flatBonus).toBe(25)   // pasywna Wektor też się aktywuje przy 0ms
    expect(r.total).toBe(225)      // 100 base + 100 speed + 25 flat
  })

  it('aktywna: cap extra +50 (speed=20 → 20+20=40, nie przekracza +50 extra)', () => {
    // speed=20 when remaining=6000: floor(50*6000/15000)=20
    const responseMs = 15000 - 6000
    const r = computeScore(base({ profileId: 'wektor', responseMs, profileActiveUsedThisQuestion: true }))
    expect(r.speedBonus).toBe(40)  // 20 + min(20,50) = 40
  })
})

describe('Profil: Archiwista', () => {
  it('pasywna: +50 gdy ta sama kategoria co poprzednie pytanie', () => {
    const r = computeScore(base({
      profileId: 'archiwista',
      prevCategoryId: 'cat-a',
      currentCategoryId: 'cat-a',
    }))
    expect(r.total).toBe(150)
  })

  it('pasywna: brak +50 gdy różna kategoria', () => {
    const r = computeScore(base({
      profileId: 'archiwista',
      prevCategoryId: 'cat-a',
      currentCategoryId: 'cat-b',
    }))
    expect(r.total).toBe(100)
  })

  it('pasywna: brak +50 gdy brak poprzedniego pytania (pierwsze pytanie)', () => {
    const r = computeScore(base({ profileId: 'archiwista', prevCategoryId: null }))
    expect(r.total).toBe(100)
  })
})

describe('Profil: Fraktal', () => {
  it('pasywna: +30 gdy w dolnej połowie (rank > ceil(players/2))', () => {
    // 4 graczy, ceil(4/2)=2, rank=3 → dolna połowa
    const r = computeScore(base({ profileId: 'fraktal', playerRank: 3, totalPlayers: 4 }))
    expect(r.total).toBe(130)
  })

  it('pasywna: brak +30 gdy w górnej połowie (rank=2 przy 4 graczach)', () => {
    const r = computeScore(base({ profileId: 'fraktal', playerRank: 2, totalPlayers: 4 }))
    expect(r.total).toBe(100)
  })

  it('aktywna: +100 gdy na ostatnim miejscu', () => {
    const r = computeScore(base({
      profileId: 'fraktal',
      profileActiveUsedThisQuestion: true,
      playerRank: 4,
      totalPlayers: 4,
    }))
    expect(r.flatBonus).toBeGreaterThanOrEqual(100 + 30)  // passive + active
  })
})

describe('Profil: Obserwator', () => {
  it('pasywna: brak efektu punktowego (widzi liczbę odpowiedzi — UI)', () => {
    const r = computeScore(base({ profileId: 'obserwator' }))
    expect(r.total).toBe(100)
  })

  it('aktywna: −30% do łącznego wyniku', () => {
    const r = computeScore(base({ profileId: 'obserwator', obserwatorActiveUsed: true }))
    expect(r.multiplier).toBeCloseTo(0.70)
    expect(r.total).toBe(Math.round(100 * 0.70))  // 70
  })
})

describe('Profil: Przekaźnik', () => {
  it('pasywna: brak efektu punktowego (wydłuża czas trwania Modyfikacji — obsługa przy wyborze)', () => {
    const r = computeScore(base({ profileId: 'przekaznik' }))
    expect(r.total).toBe(100)
  })
})

describe('Profil: Horyzont', () => {
  it('pasywna: +20% w pytaniach 10–12', () => {
    const r = computeScore(base({ profileId: 'horyzont', questionIndex: 10 }))
    expect(r.multiplier).toBeCloseTo(1.20)
    expect(r.total).toBe(Math.round(100 * 1.20))  // 120
  })

  it('pasywna: brak efektu w pytaniach 1–9', () => {
    const r = computeScore(base({ profileId: 'horyzont', questionIndex: 9 }))
    expect(r.multiplier).toBe(1.0)
    expect(r.total).toBe(100)
  })

  it('aktywna: +40% zamiast +20% w q10–12', () => {
    const r = computeScore(base({
      profileId: 'horyzont',
      questionIndex: 11,
      profileActiveUsedThisQuestion: true,
    }))
    expect(r.multiplier).toBeCloseTo(1.40)
    expect(r.total).toBe(Math.round(100 * 1.40))  // 140
  })
})

describe('Profil: Izolator', () => {
  it('pasywna: brak efektu punktowego (immunitety PvP — obsługa zewnętrzna)', () => {
    const r = computeScore(base({ profileId: 'izolator' }))
    expect(r.total).toBe(100)
  })
})

// ── Modifications ─────────────────────────────────────────────────────────────

describe('Modyfikacja: Próg Pewności', () => {
  it('poprawna: ×1.5 punktów', () => {
    const r = computeScore(base({
      activeMods: [mod('prog-pewnosci', { questionsRemaining: 2 })],
    }))
    expect(r.multiplier).toBeCloseTo(1.50)
    expect(r.total).toBe(150)
  })

  it('błędna: dodatkowe −75', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('prog-pewnosci', { questionsRemaining: 2 })],
    }))
    expect(r.total).toBe(-25 - 75)
  })

  it('nieaktywna (questionsRemaining=0): brak efektu', () => {
    const r = computeScore(base({
      activeMods: [mod('prog-pewnosci', { questionsRemaining: 0 })],
    }))
    expect(r.total).toBe(100)
  })
})

describe('Modyfikacja: Opóźniona Reakcja', () => {
  it('faza blokady (qDiff=1): 0 pkt, blocked=true', () => {
    const r = computeScore(base({
      activeMods: [mod('opozniona-reakcja', { draftStage: 3 })],
      questionIndex: 4,  // 4-3=1 → zablokowany
    }))
    expect(r.blocked).toBe(true)
    expect(r.total).toBe(0)
  })

  it('faza blokady (qDiff=2): 0 pkt', () => {
    const r = computeScore(base({
      activeMods: [mod('opozniona-reakcja', { draftStage: 3 })],
      questionIndex: 5,
    }))
    expect(r.blocked).toBe(true)
  })

  it('faza bonusu (qDiff=3): ×1.25 punktów', () => {
    const r = computeScore(base({
      activeMods: [mod('opozniona-reakcja', { draftStage: 3 })],
      questionIndex: 6,
    }))
    expect(r.blocked).toBe(false)
    expect(r.multiplier).toBeCloseTo(1.25)
    expect(r.total).toBe(125)
  })
})

describe('Modyfikacja: Redukcja Szumu', () => {
  it('brak efektu punktowego (usuwa błędną opcję — UI, tylko single_choice)', () => {
    const r = computeScore(base({ activeMods: [mod('redukcja-szumu', { usesRemaining: 2 })] }))
    expect(r.total).toBe(100)
  })
})

describe('Modyfikacja: Kalibracja Odruchu', () => {
  it('+35 przy responseMs ≤ 4000', () => {
    const r = computeScore(base({
      responseMs: 3000,
      activeMods: [mod('kalibracja-odruchu')],
    }))
    expect(r.flatBonus).toBeGreaterThanOrEqual(35)
    expect(r.breakdown.some(l => l.label.includes('Kalibracja Odruchu'))).toBe(true)
  })

  it('brak +35 przy responseMs > 4000', () => {
    const r = computeScore(base({
      responseMs: 5000,
      activeMods: [mod('kalibracja-odruchu')],
    }))
    expect(r.breakdown.some(l => l.label.includes('Kalibracja Odruchu'))).toBe(false)
  })
})

describe('Modyfikacja: Bezpiecznik', () => {
  it('pierwsza błędna → 0 pkt (uses=1)', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('bezpiecznik', { usesRemaining: 1 })],
    }))
    expect(r.total).toBe(0)
  })

  it('zużyty (uses=0) → normalna kara', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('bezpiecznik', { usesRemaining: 0 })],
    }))
    expect(r.total).toBe(-25)
  })
})

describe('Modyfikacja: Reakcja Łańcuchowa', () => {
  it('2. z rzędu: +20', () => {
    const r = computeScore(base({
      streak: 1,
      activeMods: [mod('reakcja-lancuchowa')],
    }))
    expect(r.flatBonus).toBe(20)
  })

  it('3. z rzędu: +40', () => {
    const r = computeScore(base({
      streak: 2,
      activeMods: [mod('reakcja-lancuchowa')],
    }))
    expect(r.flatBonus).toBe(40)
  })

  it('4.+ z rzędu: +60', () => {
    const r = computeScore(base({
      streak: 3,
      activeMods: [mod('reakcja-lancuchowa')],
    }))
    expect(r.flatBonus).toBe(60)
  })

  it('pierwsza poprawna: brak bonusu', () => {
    const r = computeScore(base({
      streak: 0,
      activeMods: [mod('reakcja-lancuchowa')],
    }))
    expect(r.flatBonus).toBe(0)
  })
})

describe('Modyfikacja: Akcelerator Decyzji', () => {
  it('effectiveTime −3000ms', () => {
    const r = computeScore(base({ activeMods: [mod('akcelerator-decyzji', { questionsRemaining: 3 })] }))
    expect(r.effectiveQuestionTimeMs).toBe(12000)
  })

  it('+40% do poprawnej odpowiedzi', () => {
    const r = computeScore(base({ activeMods: [mod('akcelerator-decyzji', { questionsRemaining: 3 })] }))
    expect(r.multiplier).toBeCloseTo(1.40)
    expect(r.total).toBe(140)
  })
})

describe('Modyfikacja: Stabilizacja Wyniku', () => {
  it('błędna: kara −25 → 0 (redukcja o 50 pkt, cap na 0)', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('stabilizacja-wyniku', { questionsRemaining: 4 })],
    }))
    expect(r.total).toBe(0)
  })

  it('błędna + Próg Pewności: Stabilizacja redukuje bazę do 0, Próg −75 nadal działa', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [
        mod('stabilizacja-wyniku', { questionsRemaining: 4 }),
        mod('prog-pewnosci', { questionsRemaining: 2 }),
      ],
    }))
    expect(r.total).toBe(-75)  // base 0 - 75
  })
})

describe('Modyfikacja: Skan Trudności', () => {
  it('brak efektu punktowego (pokazuje trudność — UI)', () => {
    const r = computeScore(base({ activeMods: [mod('skan-trudnosci')] }))
    expect(r.total).toBe(100)
  })
})

describe('Modyfikacja: Interferencja Lidera', () => {
  it('pvpTimeReductionMs=3000 → effectiveTime spada o 3s', () => {
    const r = computeScore(base({ pvpTimeReductionMs: 3000 }))
    expect(r.effectiveQuestionTimeMs).toBe(12000)
  })

  it('pvpImmune=true → czas nie spada', () => {
    const r = computeScore(base({ pvpTimeReductionMs: 3000, pvpImmune: true }))
    expect(r.effectiveQuestionTimeMs).toBe(15000)
  })
})

describe('Modyfikacja: Zakłócenie Kanału', () => {
  it('−30% speed bonus (pvpSpeedPenaltyFraction=0.3)', () => {
    // responseMs=0 → raw speed=50 → after penalty: floor(50*0.7)=35
    const r = computeScore(base({ responseMs: 0, pvpSpeedPenaltyFraction: 0.3 }))
    expect(r.speedBonus).toBe(35)
  })

  it('pvpImmune=true → brak redukcji', () => {
    const r = computeScore(base({ responseMs: 0, pvpSpeedPenaltyFraction: 0.3, pvpImmune: true }))
    expect(r.speedBonus).toBe(50)
  })
})

describe('Modyfikacja: Transfer Impulsu', () => {
  it('+40 gdy fasterThanLeaderThisQuestion=true', () => {
    const r = computeScore(base({
      activeMods: [mod('transfer-impulsu', { questionsRemaining: 3 })],
      fasterThanLeaderThisQuestion: true,
    }))
    expect(r.flatBonus).toBe(40)
  })

  it('brak +40 gdy nie szybciej od lidera', () => {
    const r = computeScore(base({
      activeMods: [mod('transfer-impulsu', { questionsRemaining: 3 })],
      fasterThanLeaderThisQuestion: false,
    }))
    expect(r.flatBonus).toBe(0)
  })
})

describe('Modyfikacja: Odwrócenie Polaryzacji', () => {
  it('brak efektu punktowego (odbija PvP — obsługa zewnętrzna)', () => {
    const r = computeScore(base({ activeMods: [mod('odwrocenie-polaryzacji', { usesRemaining: 1 })] }))
    expect(r.total).toBe(100)
  })
})

describe('Modyfikacja: Druga Próba', () => {
  it('drugaProbaUsed=true: 50% łącznego wyniku', () => {
    const r = computeScore(base({
      activeMods: [mod('druga-proba', { usesRemaining: 1 })],
      drugaProbaUsed: true,
    }))
    expect(r.multiplier).toBeCloseTo(0.50)
    expect(r.total).toBe(50)
  })
})

describe('Modyfikacja: Pętla Testowa', () => {
  it('błędna: kara anulowana (uses=1)', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('petla-testowa', { usesRemaining: 1 })],
    }))
    expect(r.total).toBe(0)
  })

  it('nextQBonus w state: +3s na czas pytania', () => {
    const r = computeScore(base({
      activeMods: [mod('petla-testowa', { usesRemaining: 0, state: { nextQBonus: true } })],
    }))
    expect(r.effectiveQuestionTimeMs).toBe(18000)
  })
})

describe('Modyfikacja: Odbicie Sygnału', () => {
  it('+75 po otrzymaniu efektu PvP', () => {
    const r = computeScore(base({
      activeMods: [mod('odbicie-sygnalu', { usesRemaining: 1 })],
      receivedPvpThisQuestion: true,
    }))
    expect(r.flatBonus).toBe(75)
  })

  it('brak +75 bez ataku PvP', () => {
    const r = computeScore(base({
      activeMods: [mod('odbicie-sygnalu', { usesRemaining: 1 })],
      receivedPvpThisQuestion: false,
    }))
    expect(r.flatBonus).toBe(0)
  })
})

describe('Modyfikacja: Kompensacja Deficytu', () => {
  it('+25% gdy w dolnej połowie tabeli', () => {
    const r = computeScore(base({
      activeMods: [mod('kompensacja-deficytu')],
      playerRank: 3,
      totalPlayers: 4,
    }))
    expect(r.multiplier).toBeCloseTo(1.25)
    expect(r.total).toBe(125)
  })

  it('brak +25% gdy w górnej połowie', () => {
    const r = computeScore(base({
      activeMods: [mod('kompensacja-deficytu')],
      playerRank: 2,
      totalPlayers: 4,
    }))
    expect(r.multiplier).toBe(1.0)
  })
})

describe('Modyfikacja: Próba Krytyczna', () => {
  it('poprawna: +100 pkt', () => {
    const r = computeScore(base({
      activeMods: [mod('proba-krytyczna', { questionsRemaining: 1 })],
    }))
    expect(r.flatBonus).toBe(100)
    expect(r.total).toBe(200)
  })

  it('błędna: dodatkowe −100', () => {
    const r = computeScore(base({
      isCorrect: false,
      activeMods: [mod('proba-krytyczna', { questionsRemaining: 1 })],
    }))
    expect(r.total).toBe(-25 - 100)
  })
})

describe('Modyfikacja: Tarcza Fazowa', () => {
  it('pvpImmune=true → speed bonus nie jest redukowany', () => {
    const r = computeScore(base({
      activeMods: [mod('tarcza-fazowa', { questionsRemaining: 2 })],
      pvpImmune: true,
      pvpSpeedPenaltyFraction: 0.3,
      responseMs: 0,
    }))
    expect(r.speedBonus).toBe(50)
  })
})

describe('Modyfikacja: Analiza Wstępna', () => {
  it('brak efektu punktowego (pokazuje kategorię wcześniej — UI)', () => {
    const r = computeScore(base({ activeMods: [mod('analiza-wstepna', { questionsRemaining: 4 })] }))
    expect(r.total).toBe(100)
  })
})

describe('Modyfikacja: Wzmocnienie Sygnału (mod)', () => {
  it('+30 pkt przy poprawnej odpowiedzi', () => {
    const r = computeScore(base({
      activeMods: [mod('wzmocnienie-sygnalu', { questionsRemaining: 3 })],
    }))
    expect(r.flatBonus).toBe(30)
    expect(r.total).toBe(130)
  })
})

describe('Modyfikacja: Nadpisanie Wyniku', () => {
  it('wypłata +100 gdy 2 pytania minęły od ustawienia bufora', () => {
    const r = computeScore(base({
      questionIndex: 7,
      activeMods: [mod('nadpisanie-wyniku', {
        state: { buffer: 100, buffer_set_at: 5 },
      })],
    }))
    expect(r.flatBonus).toBe(100)
  })

  it('brak wypłaty gdy tylko 1 pytanie minęło (za wcześnie)', () => {
    const r = computeScore(base({
      questionIndex: 6,
      activeMods: [mod('nadpisanie-wyniku', {
        state: { buffer: 100, buffer_set_at: 5 },
      })],
    }))
    expect(r.flatBonus).toBe(0)
  })

  it('brak wypłaty gdy buffer=0 (jeszcze nie ustawiony)', () => {
    const r = computeScore(base({
      questionIndex: 7,
      activeMods: [mod('nadpisanie-wyniku', {
        state: { buffer: 0, buffer_set_at: 0 },
      })],
    }))
    expect(r.flatBonus).toBe(0)
  })
})

describe('Modyfikacja: Cichy Protokół', () => {
  it('+40 gdy gracz nie jest liderem', () => {
    const r = computeScore(base({
      activeMods: [mod('cichy-protokol', { questionsRemaining: 2 })],
      playerRank: 2,
    }))
    expect(r.flatBonus).toBe(40)
  })

  it('brak +40 gdy gracz jest liderem', () => {
    const r = computeScore(base({
      activeMods: [mod('cichy-protokol', { questionsRemaining: 2 })],
      playerRank: 1,
    }))
    expect(r.flatBonus).toBe(0)
  })
})

describe('Modyfikacja: Rezonans Końcowy', () => {
  it('+30% w pytaniach 10–12 gdy nie lider', () => {
    const r = computeScore(base({
      activeMods: [mod('rezonans-koncowy')],
      questionIndex: 10,
      playerRank: 2,
    }))
    expect(r.multiplier).toBeCloseTo(1.30)
  })

  it('brak efektu w pytaniach 1–9', () => {
    const r = computeScore(base({
      activeMods: [mod('rezonans-koncowy')],
      questionIndex: 9,
      playerRank: 2,
    }))
    expect(r.multiplier).toBe(1.0)
  })

  it('brak efektu gdy lider w q10–12', () => {
    const r = computeScore(base({
      activeMods: [mod('rezonans-koncowy')],
      questionIndex: 10,
      playerRank: 1,
    }))
    expect(r.multiplier).toBe(1.0)
  })
})

// ── Anomalies ─────────────────────────────────────────────────────────────────

describe('Anomalia: Niestabilne Pole', () => {
  it('effectiveTime −2000ms (13000ms zamiast 15000ms)', () => {
    const r = computeScore(base({ anomalyId: 'niestabilne-pole' }))
    expect(r.effectiveQuestionTimeMs).toBe(13000)
  })

  it('nie spada poniżej 1000ms', () => {
    const r = computeScore(base({
      anomalyId: 'niestabilne-pole',
      baseQuestionTimeMs: 2000,
    }))
    expect(r.effectiveQuestionTimeMs).toBe(1000)
  })
})

describe('Anomalia: Wzmocnienie Sygnału', () => {
  it('maks. speed bonus +75 zamiast +50', () => {
    const r = computeScore(base({ anomalyId: 'wzmocnienie-sygnalu', responseMs: 0 }))
    expect(r.speedBonus).toBe(75)
  })
})

describe('Anomalia: Próba Kontrolna', () => {
  it('brak bezpośredniego efektu punktowego (blokuje PvP — pvpImmune=true zewnętrznie)', () => {
    const r = computeScore(base({ anomalyId: 'proba-kontrolna', pvpImmune: true, pvpSpeedPenaltyFraction: 0.3, responseMs: 0 }))
    expect(r.speedBonus).toBe(50)
  })
})

describe('Anomalia: Fluktuacja Wyniku', () => {
  it('poprawna: ×1.2', () => {
    const r = computeScore(base({ anomalyId: 'fluktuacja-wyniku' }))
    expect(r.multiplier).toBeCloseTo(1.20)
    expect(r.total).toBe(120)
  })

  it('błędna: dodatkowe −25 pkt', () => {
    const r = computeScore(base({ isCorrect: false, anomalyId: 'fluktuacja-wyniku' }))
    expect(r.total).toBe(-25 - 25)
  })
})

describe('Anomalia: Cisza Pomiarowa', () => {
  it('brak efektu punktowego (ukrywa tabelę — UI)', () => {
    const r = computeScore(base({ anomalyId: 'cisza-pomiarowa' }))
    expect(r.total).toBe(100)
  })
})

describe('Anomalia: Przesunięcie Fazowe', () => {
  it('poprawna: base +125 zamiast +100 (bez bonusu szybkości)', () => {
    const r = computeScore(base({ anomalyId: 'przesuniecie-fazowe', responseMs: 0 }))
    expect(r.basePoints).toBe(125)
    expect(r.speedBonus).toBe(0)
    expect(r.total).toBe(125)
  })
})
