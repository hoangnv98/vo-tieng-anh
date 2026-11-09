import type { Settings } from '../domain/types'

/** Cửa sổ study_days trong snapshot (2.3), dùng chung cho Local và Supabase. */
export const STUDY_DAYS_WINDOW = 120

/** Settings mặc định (khớp default trong schema.sql; display_name = phần trước @ như trigger handle_new_user). */
export function defaultSettings(userId: string, email?: string | null): Settings {
  return {
    user_id: userId,
    display_name: email ? (email.split('@')[0] ?? '') : '',
    daily_goal_min: 15,
    new_cards_per_day: 15,
    voice_name: null,
    auto_speak: false,
    study_language: 'all',
  }
}
