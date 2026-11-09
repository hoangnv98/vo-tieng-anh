import { getConfig } from '../lib/config'
import { createRepository } from '../repo'

export type Services = Awaited<ReturnType<typeof createRepository>>

/** Cấu hình đọc đồng bộ (mode biết ngay, không cần chờ repo). */
export const config = getConfig()

let promise: Promise<Services> | null = null
let ready: Services | null = null

/** Tạo repo/auth một lần (createRepository có thể async vì supabase-js nạp động). Loader và main.tsx await hàm này. */
export function initServices(): Promise<Services> {
  if (!promise) {
    promise = Promise.resolve(createRepository(config)).then((s) => {
      ready = s
      return s
    })
  }
  return promise
}

/** Services đã khởi tạo — chỉ gọi sau `await initServices()` (main.tsx render sau khi xong). */
export function services(): Services {
  if (!ready) throw new Error('services chưa khởi tạo: gọi initServices() trước khi render')
  return ready
}
