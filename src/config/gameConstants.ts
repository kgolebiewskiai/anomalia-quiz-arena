export const QUESTION_COUNT = 12
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const BASE_QUESTION_TIME_MS = 15_000
export const BASE_CORRECT_POINTS = 100
export const BASE_WRONG_POINTS = -25
export const MAX_SPEED_BONUS = 50
export const MODIFICATION_DRAFT_STAGES = [3, 6, 9] as const
export const ANOMALY_STAGES = [4, 8] as const
export const PROFILE_OPTIONS_COUNT = 3
export const MODIFICATION_OPTIONS_COUNT = 3
export const PROFILE_POOL_SIZE = 15
export const MODIFICATION_POOL_SIZE = 24

export const PHASE_TIMEOUTS_MS = {
  categoryVote: 20_000,
  profileDraft: 30_000,
  modificationDraft: 25_000,
  question: 15_000,
  results: 6_000,
} as const

export type ModificationDraftStage = (typeof MODIFICATION_DRAFT_STAGES)[number]
