/** Storage trong bộ nhớ cho test chạy trên Node. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  /** Nếu đặt, setItem sẽ ném lỗi này. */
  failWith: unknown = null

  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    if (this.failWith) throw this.failWith
    this.map.set(key, String(value))
  }
}
