export type ProfileStyle =
  | 'czas'
  | 'modyfikacje'
  | 'obrona'
  | 'informacja'
  | 'kopiowanie'
  | 'anty-pvp'
  | 'seria'
  | 'reset'
  | 'szybkość'
  | 'kategorie'
  | 'comeback'
  | 'wydłużanie'
  | 'końcówka'
  | 'odporność'

export type ModificationType =
  | 'Ryzyko'
  | 'Skalowanie'
  | 'Podpowiedź'
  | 'Szybkość'
  | 'Obrona'
  | 'Seria'
  | 'Informacja'
  | 'PvP'
  | 'Comeback'
  | 'Punkty'
  | 'Ryzyko / czas'
  | 'Ryzyko / odroczenie'
  | 'Obrona / PvP'
  | 'Obrona / czas'
  | 'Comeback / PvP'
  | 'Informacja / comeback'
  | 'PvP / szybkość'
  | 'Końcówka'

export interface ProfileConfig {
  id: string
  name: string
  style: ProfileStyle
  passive: string
  active: string
  flavor: string
}

export interface ModificationConfig {
  id: string
  name: string
  type: ModificationType
  effect: string
  duration: string
  flavor: string
}

export interface AnomalyConfig {
  id: string
  name: string
  effect: string
}

export type RoomMode = 'casual' | 'ranked'

export type RoomStatus =
  | 'lobby'
  | 'category_vote'
  | 'profile_draft'
  | 'question'
  | 'modification_draft'
  | 'results'
  | 'anomaly_reveal'
  | 'finished'

export interface Category {
  id: string
  name: string
  is_enabled: boolean
}

export interface RoomCategoryVote {
  id: string
  room_id: string
  user_id: string
  category_id: string
  created_at: string
}

export interface RoomProfileOption {
  id: string
  room_id: string
  user_id: string
  profile_ids: string[]
  created_at: string
}

export interface RoomModificationOption {
  id: string
  room_id: string
  user_id: string
  draft_stage: number
  modification_ids: string[]
  selected_modification_id: string | null
  created_at: string
  selected_at: string | null
}

export interface Room {
  id: string
  code: string
  mode: RoomMode
  status: RoomStatus
  host_user_id: string
  seed: string
  max_players: number
  current_question_index: number
  current_phase_started_at: string | null
  current_phase_duration_ms: number | null
  active_anomaly_id: string | null
  settings: Record<string, unknown>
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface RoomPlayer {
  id: string
  room_id: string
  user_id: string
  display_name: string
  slot: number
  selected_profile_id: string | null
  score: number
  streak: number
  is_connected: boolean
  is_ready: boolean
  joined_at: string
  left_at: string | null
}

export type QuestionType = 'single_choice' | 'true_false' | 'numeric' | 'order'

export interface QuestionOption {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  category_id: string
  difficulty: 'easy' | 'medium' | 'hard'
  question_text: string
  options: QuestionOption[] | null
  correct_answer: Record<string, unknown>
  tolerance: number | null
  explanation: string | null
  is_ranked_safe: boolean
}

export interface RoomQuestion {
  id: string
  room_id: string
  question_id: string
  question_index: number
  anomaly_id: string | null
  created_at: string
  questions: Question
}

export interface AnswerBreakdownLine {
  label: string
  value: number
}

export interface AnswerBreakdown {
  lines: AnswerBreakdownLine[]
  total: number
}

export interface Rating {
  id: string
  user_id: string
  rating: number
  games_played: number
  wins: number
  updated_at: string
}

export type MatchmakingMode = 'duel' | 'arena'
export type MatchmakingStatus = 'searching' | 'matched' | 'cancelled' | 'timeout'

export interface MatchmakingEntry {
  id: string
  user_id: string
  display_name: string
  rating: number
  mode: MatchmakingMode
  joined_at: string
  status: MatchmakingStatus
  matched_room_id: string | null
  matched_room_code: string | null
}

export interface Answer {
  id: string
  room_id: string
  user_id: string
  question_index: number
  question_id: string
  answer: Record<string, unknown>
  is_correct: boolean
  answered_at: string
  response_ms: number
  base_points: number
  speed_bonus: number
  flat_bonus: number
  multiplier: number
  penalty: number
  total_points: number
  breakdown: AnswerBreakdown
}
