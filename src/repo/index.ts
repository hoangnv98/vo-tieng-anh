import type { AppConfig } from '../lib/config'
import { LocalAuth, LocalRepository } from './local'
import type { AuthService, Repository } from './types'

/**
 * Mode `supabase` nạp `./supabase` (và supabase-js, lib/supabase) bằng dynamic import
 * để mode local không kéo supabase-js vào bundle.
 */
export async function createRepository(config: AppConfig): Promise<{ repo: Repository; auth: AuthService }> {
  if (config.mode === 'local') {
    return { repo: new LocalRepository(), auth: new LocalAuth() }
  }
  const [{ createSupabaseClient }, { SupabaseAuth, SupabaseRepository }] = await Promise.all([
    import('../lib/supabase'),
    import('./supabase'),
  ])
  const client = createSupabaseClient(config.url, config.anonKey)
  return { repo: new SupabaseRepository(client), auth: new SupabaseAuth(client) }
}

export {
  LOAD_ERROR_MESSAGE,
  NO_SESSION_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RepoError,
  SEND_LINK_ERROR_MESSAGE,
  SIGN_OUT_ERROR_MESSAGE,
  WRITE_ERROR_MESSAGE,
  isNetworkError,
  isNonRetryableCode,
  shouldRefreshBeforeFail,
} from './errors'
export type { RepoErrorOptions } from './errors'
export { SCHEMA_OUTDATED_MESSAGE, isSchemaOutdated, setSchemaOutdatedNotifier } from './schemaStatus'
export type { AuthService, AuthUser, PendingOp, PendingOpPayload, Repository, StudyTimeDelta } from './types'
