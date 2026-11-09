/**
 * Có nên ghi đè ô nhập bằng giá trị đã lưu không? Chỉ khi giá trị đã chuẩn hoá của ô
 * khác giá trị đã lưu — tránh nuốt khoảng trắng đang gõ sau khi lưu bản `trim()`.
 */
export function shouldSyncField(local: string, saved: string, normalize: (v: string) => string): boolean {
  return normalize(local) !== saved
}
