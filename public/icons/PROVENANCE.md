# Nguồn gốc icon

- Nguồn: `public/icon-source.svg` (biến thể full-bleed của `public/favicon.svg`, chữ "V" là path; full-bleed, dùng cho icon `any` và apple-touch-icon — bản maskable xem bên dưới).
- Công cụ: macOS `qlmanage` (Quick Look) + `sips` (Darwin 25.6.0).
- Ngày tạo: 2026-11-09 (sửa vòng 1: cùng ngày).
- Phiên bản: macOS `26.6.2` (`sw_vers -productVersion`); `sips` sips-316.
- `icon-512-maskable.png` sinh từ `public/icon-source-maskable.svg` (chữ V thu 0.85 về tâm; bán kính xa nhất của đỉnh path ≈ 155–159 px (tuỳ cách lấy điểm góc) < 204.8 px vùng an toàn tròn 40%).
- Lệnh (chạy trong `public/`, `<tmp>` là thư mục tạm):

```
qlmanage -t -s 192 -o <tmp> icon-source.svg   # -> icons/icon-192.png
qlmanage -t -s 512 -o <tmp> icon-source.svg   # -> icons/icon-512.png
qlmanage -t -s 180 -o <tmp> icon-source.svg   # -> icons/apple-touch-icon.png
qlmanage -t -s 512 -o <tmp> icon-source-maskable.svg   # -> icons/icon-512-maskable.png
# apple-touch-icon: bỏ kênh alpha (sips --setProperty hasAlpha no không có tác dụng trên máy này nên dùng vòng jpeg chất lượng 100)
sips -s format jpeg -s formatOptions 100 apple-touch-icon.png --out a.jpg && sips -s format png a.jpg --out apple-touch-icon.png
```

(qlmanage xuất `icon-source.svg.png`; đổi tên sang tên đích.)

| Tệp | Kích thước |
|---|---|
| icon-192.png | 192x192 |
| icon-512.png | 512x512 |
| icon-512-maskable.png | 512x512 (từ icon-source-maskable.svg) |
| apple-touch-icon.png | 180x180, nền đặc, không alpha |
