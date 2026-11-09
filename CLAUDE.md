# Vở Tiếng Anh

Web app cá nhân giúp người lớn mất gốc học lại tiếng Anh giao tiếp.

## Nguồn sự thật
- Sản phẩm: PRODUCT.md
- Đặc tả: SPEC.md
- Thiết kế: .impeccable/surfaces/*.md (direction contract "Vở ô ly mực tím")

## Harness
Mỗi chức năng đi qua 3 bước, mỗi bước một subagent riêng trong .claude/agents/:

| Bước | Subagent | Model |
|---|---|---|
| Đặc tả | spec-writer | Fable |
| Code | coder | Sonnet (Opus cho repository/đồng bộ, FSRS, task ≥4 file, hoặc sau 2 vòng FIX) |
| Review | reviewer | Opus |

Chạy cả pipeline: `/feature <tên chức năng>` — quy tắc chọn model nằm trong `.claude/commands/feature.md`.

## Stack
- Vite + React 19 + TypeScript, react-router-dom 6, lucide-react
- ts-fsrs v6: dùng API mới `DefaultScheduler` / `scheduler.review`; `FSRS`/`fsrs()` đã deprecated
- Supabase (auth + Postgres + RLS); khi thiếu .env thì chạy chế độ cục bộ bằng localStorage

## Lệnh
- `npm run dev`
- `npm run build`
- `npm run lint`

## Quy tắc
- Giao diện tiếng Việt, nội dung học tiếng Anh.
- Chỉ dùng công nghệ miễn phí.
- Không commit `.env`.
