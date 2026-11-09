---
description: Chạy pipeline spec (Fable) → code (Sonnet/Opus) → review (Opus) cho 1 chức năng
argument-hint: <tên chức năng hoặc task trong SPEC.md>
---
Chạy pipeline cho chức năng: $ARGUMENTS

## Bước 1 — Đặc tả
Nếu SPEC.md chưa có phần chi tiết và acceptance criteria cho chức năng này: gọi subagent `spec-writer`. Sau đó đưa các câu hỏi mở cho tôi quyết trước khi đi tiếp.

## Bước 2 — Code
Gọi subagent `coder` cho từng task của chức năng, lần lượt từng task một.

### Quy tắc chọn model cho coder
Mặc định `coder` chạy Sonnet (đã ghim trong `.claude/agents/coder.md`). Truyền `model: "opus"` cho lần gọi Agent khi task rơi vào một trong các trường hợp sau:
- Task thuộc **lớp repository / đồng bộ dữ liệu** (interface repository, impl Supabase, impl localStorage, auth).
- Task thuộc **thuật toán ôn tập FSRS** (chọn thẻ đến hạn, chấm điểm, mở khoá chiều ôn, tính chuỗi ngày theo múi giờ).
- Task chạm **≥ 4 file** hoặc phải tự quyết kiến trúc vì spec để mở.
- Task đã qua **2 vòng review FIX** với Sonnet mà vẫn chưa PASS.

Mọi task còn lại (màn hình UI, form, seed data, style, copy) giữ Sonnet. Haiku không dùng để code; chỉ dùng cho việc khảo sát/tóm tắt nếu cần.

Khi gọi coder, ghi rõ trong prompt: tên task, phần spec liên quan, model lý do chọn (một dòng), và hint npm cache nếu cần cài thêm package.

## Bước 3 — Review
Sau mỗi task, gọi subagent `reviewer` (Opus) với danh sách file đã đổi.
- Verdict FIX → gửi các finding lại cho `coder`, tối đa 2 vòng với Sonnet; vòng thứ 3 (nếu cần) nâng lên Opus theo quy tắc trên.
- Verdict PASS → sang task tiếp theo.

## Bước 4 — Tổng kết
Báo cho tôi:
- task nào đã xong, task nào dùng Opus và vì sao
- finding nào còn mở
- kết quả `npm run build`
