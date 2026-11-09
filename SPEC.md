# Đặc tả hệ thống — Vở Ngoại Ngữ (tên cũ: Vở Tiếng Anh)

Phiên bản: 1.1 (MVP / Giai đoạn 1 + T18–T20) · Ngày: 2026-11-09
Từ T20 (mục 6.14) app đổi tên thành **"Vở Ngoại Ngữ"** và hỗ trợ bốn ngôn ngữ học: Anh, Trung, Nhật, Hàn. Các mục viết trước T20 vẫn dùng chữ "tiếng Anh"/"EN" cho ví dụ; đọc là "ngôn ngữ đích" trừ khi mục đó nói rõ chỉ áp dụng cho `en`.
Nguồn sự thật sản phẩm: `PRODUCT.md`. Hướng thiết kế: `.impeccable/surfaces/src-routes-today-tsx.md` ("Vở ô ly mực tím"). Quy ước dự án: `CLAUDE.md`.

Tài liệu này viết cho developer (subagent `coder`) code thẳng MVP mà không phải hỏi lại. Mỗi màn hình có đủ: mục đích, user story, luồng, dữ liệu, trạng thái, quy tắc, microcopy, tiêu chí chấp nhận. Mục 9 là danh sách task theo thứ tự.

Quy ước trong tài liệu:
- **PHẢI / KHÔNG ĐƯỢC** = bắt buộc; **NÊN** = khuyến nghị; **(GĐ2)/(GĐ3)** = ngoài MVP, chỉ để lại chỗ.
- Microcopy đặt trong ngoặc kép, dùng nguyên văn. Chữ tiếng Anh trong UI luôn bọc `<span lang="en">`.
- "Ngày địa phương" = ngày theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7, không có DST).

---

## Mục lục

1. Tổng quan và phạm vi
2. Kiến trúc
3. Mô hình dữ liệu và schema
4. Thuật toán và quy tắc chung (ngày giờ, FSRS, phiên ôn, thời gian học, chuỗi ngày)
5. Hệ thống giao diện (design tokens, typography, component, quy tắc)
6. Màn hình
   - 6.1 Đăng nhập · 6.2 Shell/điều hướng · 6.3 Hôm nay · 6.4 Nhật ký buổi học (danh sách) · 6.5 Trang buổi học (xem) · 6.6 Tạo/sửa buổi học · 6.7 Ôn thẻ · 6.8 Mẫu câu tình huống · 6.9 Shadowing · 6.10 Tiến độ · 6.11 Cài đặt · 6.12 Giọng đọc & nhà cung cấp TTS (T19) · 6.13 Dán danh sách, Nhập JSON, PWA (T18) · 6.14 Đa ngôn ngữ học Anh/Trung/Nhật/Hàn và đổi tên "Vở Ngoại Ngữ" (T20)
7. Dữ liệu seed
8. Yêu cầu phi chức năng
9. Kế hoạch triển khai (task có thứ tự)
10. Checklist test thủ công
11. Cài đặt và deploy miễn phí
12. Giả định và câu hỏi mở
Phụ lục A. Microcopy dùng chung · Phụ lục B. Lưu ý kỹ thuật đã xác minh

---

## 1. Tổng quan và phạm vi

### 1.1 Sản phẩm trong một đoạn

Web app cá nhân đi kèm lớp học tiếng Anh giao tiếp thật. Sau mỗi buổi học, người học ghi lại từ/cụm/mẫu câu vào "trang vở" của buổi đó; mỗi mục tự thành thẻ ôn giãn cách (FSRS). Mỗi ngày 15–20 phút: ôn thẻ đến hạn, shadowing vài câu, xem lại lỗi hay gặp. Giao diện tiếng Việt, nội dung học tiếng Anh. Miễn phí 100%, dữ liệu theo tài khoản, đồng bộ laptop và điện thoại.

**Từ T20 (6.14):** cùng một vở ghi được buổi học của bốn ngôn ngữ — tiếng Anh (`en`), tiếng Trung giản thể (`zh`), tiếng Nhật (`ja`), tiếng Hàn (`ko`). Mỗi buổi học gắn **một** ngôn ngữ; chuỗi ngày và phút học tính chung; Cài đặt có bộ lọc "Ngôn ngữ đang học" (mặc định "Tất cả") cho hàng đợi ôn, Shadowing, Kho mẫu câu và thống kê thẻ. Giao diện vẫn tiếng Việt. Tên app: **Vở Ngoại Ngữ**.

### 1.2 Phạm vi MVP (Giai đoạn 1) — những gì tài liệu này đặc tả đầy đủ

| # | Chức năng | Route |
|---|---|---|
| 1 | Đăng nhập magic link (hoặc chế độ cục bộ) | `/login` |
| 2 | Shell: thanh trên + điều hướng + chuỗi ngày + trạng thái đồng bộ | mọi route |
| 3 | Hôm nay | `/` |
| 4 | Nhật ký buổi học: danh sách, xem trang vở, tạo/sửa, xoá | `/lessons`, `/lessons/:id`, `/lessons/new`, `/lessons/:id/edit` |
| 5 | Ôn thẻ FSRS: 3 chiều, 4 mức chấm, TTS | `/review` |
| 6 | Mẫu câu tình huống (9 tình huống `en` + 12 tình huống khởi đầu zh/ja/ko từ T20, seed) + thêm vào thẻ ôn | `/patterns`, `/patterns/:situationId` |
| 7 | Shadowing: nghe mẫu, ghi âm, nghe lại, tốc độ 0.5/0.75/1x | `/shadowing` |
| 8 | Tiến độ: lịch 8 tuần, chuỗi ngày, thống kê thẻ, mục tiêu phút | `/progress` |
| 9 | Cài đặt: tên hiển thị, mục tiêu phút, giọng đọc, tự phát âm, xuất dữ liệu, đăng xuất | `/settings` |

### 1.3 Giai đoạn 2 (không code trong MVP, chỉ chừa chỗ)

- Luyện phát âm cặp âm tối thiểu cho người Việt với `SpeechRecognition` (Chrome/Edge).
- Hội thoại đóng vai với Gemini API free tier (mỗi người dán key riêng, lưu `localStorage`, không bao giờ gửi lên Supabase).
- Sổ lỗi sai cá nhân.
- Chỗ chừa: mục "AI (sắp có)" trong Cài đặt **không hiển thị** ở MVP; bảng `settings` không có cột key.

### 1.4 Giai đoạn 3

Kiểm tra đầu vào, ghi chú ngữ pháp tối giản tiếng Việt, nhật ký nói, biểu đồ tiến độ, PWA offline.

### 1.5 Ngoài phạm vi (mọi giai đoạn)

Bảng xếp hạng, chia sẻ công khai, chấm điểm giữa người dùng, quảng cáo, mua trong app, upload bản ghi âm, đăng nhập mật khẩu/Google (chỉ magic link), đa ngôn ngữ **giao diện** (giao diện luôn tiếng Việt; đa ngôn ngữ *học* xem 6.14), chế độ tối (dark mode) — direction contract là giấy sáng; không làm dark mode ở MVP. Cũng ngoài phạm vi T20: ngôn ngữ học khác bốn ngôn ngữ trên, phiên âm tự động (pinyin/romaji sinh từ máy), nhận dạng giọng nói, tải font CJK từ mạng.

---

## 2. Kiến trúc

### 2.1 Sơ đồ khối

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Trình duyệt (Vite + React 19 + TS, SPA)                                  │
│                                                                          │
│  routes/*  ──►  state/DataProvider (snapshot trong bộ nhớ + actions)     │
│     │                  │                                                 │
│     │                  ├──► domain/*  (thuần: queue ôn, unlock, streak)  │
│     │                  │                                                 │
│     │                  └──► repo/Repository (interface)                  │
│     │                           ├── LocalRepository   → localStorage     │
│     │                           └── SupabaseRepository→ supabase-js      │
│     │                                   │   (write-through + hàng đợi    │
│     │                                   │    pending khi lỗi mạng)       │
│  hooks/useTts ──► Web Speech speechSynthesis                              │
│  hooks/useRecorder ──► MediaRecorder (Blob chỉ trong RAM)                 │
│  lib/fsrs ──► ts-fsrs v6 DefaultScheduler (singleton, async)              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS (chỉ khi có VITE_SUPABASE_*)
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Supabase free: Auth (magic link email) · Postgres + RLS (user_id=uid)    │
└──────────────────────────────────────────────────────────────────────────┘
Hosting tĩnh: Vercel free (SPA rewrite về index.html).
```

### 2.2 Cấu trúc thư mục `src/` (bắt buộc dùng đúng tên để các task khớp nhau)

```
src/
  main.tsx                  # createRoot, StrictMode, RouterProvider
  App.tsx                   # tạo router (createBrowserRouter), lazy routes, providers
  styles/
    tokens.css              # CSS variables (mục 5.1) — nguồn duy nhất của màu/cỡ
    base.css                # reset nhẹ, font, focus ring, selection, scrollbar, utility nhỏ
  lib/
    config.ts               # đọc env → { mode: 'local' | 'supabase', url, anonKey }
    supabase.ts             # createClient (chỉ khi mode='supabase')
    fsrs.ts                 # getScheduler(), newCardState(), gradeCard(), previewIntervals(), (de)serialize
    dates.ts                # localDay(), startOfLocalDay(), addDays(), formatDateVi(), weekdayShortVi()
    text.ts                 # normalizeAnswer(), compareAnswer()
    ids.ts                  # newId() = crypto.randomUUID()
    speech.ts               # TTS: getEnglishVoices(), pickDefaultVoice(), speak(), cancel(), isTtsSupported()
    recorder.ts             # isRecorderSupported(), pickMimeType()
  data/
    patterns.ts             # SEED (đã có) — không sửa nội dung, chỉ sửa khi phát hiện lỗi chính tả
  domain/
    types.ts                # Lesson, Item, Card, ReviewLogEntry, StudyDay, Settings, Snapshot, Direction, Kind
    review.ts               # buildQueue(), shouldRequeue(), shouldUnlockSiblings(), hardestCards(), estimateMinutes()
    stats.ts                # streak(), todaySeconds(), calendarWeeks(), cardStats()
    lessons.ts              # nextLessonNumber(), validateLesson(), validateItem()
  repo/
    types.ts                # interface Repository, AuthService, PendingOp
    local.ts                # LocalRepository + LocalAuth
    supabase.ts             # SupabaseRepository + SupabaseAuth
    pending.ts              # hàng đợi ghi chưa thành công (localStorage), replay
    index.ts                # createRepository(config)
  state/
    AuthProvider.tsx        # session, user, signIn, signOut
    DataProvider.tsx        # snapshot + actions (useReducer), đồng bộ, toast lỗi
    useAuth.ts, useData.ts
  hooks/
    useTts.ts               # bọc lib/speech, trạng thái speaking, voices
    useRecorder.ts          # permission, recording, blobUrl, durations
    useStudyTimer.ts        # cộng giây học khi active + tab visible, flush 30s
    useKeyboard.ts          # phím tắt trong phiên ôn
  components/
    Shell.tsx               # thanh trên + nav (desktop) / thanh dưới (mobile) + Outlet
    NotebookPage.tsx        # trang vở ô ly (dùng ở Hôm nay, Trang buổi học, Mẫu câu)
    Button.tsx              # variant: primary | secondary | danger | ghost; size md | lg
    Field.tsx               # label + input/textarea/select + lỗi + mô tả
    ConfirmDialog.tsx       # <dialog> xác nhận, nút nguy hiểm tách riêng
    Toast.tsx               # role="status", tự ẩn 4s
    EmptyState.tsx          # tiêu đề + mô tả + hành động
    StatusMark.tsx          # dấu trạng thái thẻ: quên (đỏ) / khó / mới (mute)
    Remark.tsx              # lời phê Charm đỏ — tối đa 1 / màn
    SpeakButton.tsx         # nút loa (lucide Volume2), aria-label "Nghe phát âm"
    Spinner.tsx             # loading nhỏ, có text thay thế
    PageTitle.tsx           # h1 thống nhất
  routes/
    Login.tsx  Today.tsx  Lessons.tsx  LessonView.tsx  LessonEdit.tsx
    Review.tsx  Patterns.tsx  PatternSituation.tsx  Shadowing.tsx  Progress.tsx  Settings.tsx
    NotFound.tsx
```

Xoá khỏi scaffold: `src/App.css`, `src/assets/*`, nội dung mẫu trong `src/index.css` (thay bằng import `styles/tokens.css` + `styles/base.css`), `public/icons.svg` nếu có.

### 2.3 Lớp Repository

Một interface, hai implementation. Mọi màn hình chỉ gọi actions của `DataProvider`; `DataProvider` gọi `Repository`. Không component nào import `supabase.ts` trực tiếp.

```ts
// repo/types.ts (hình dạng bắt buộc; coder có thể thêm, không bớt)
export interface Repository {
  loadSnapshot(): Promise<Snapshot>            // tải toàn bộ dữ liệu người dùng
  upsertLesson(l: Lesson): Promise<void>
  deleteLesson(id: string): Promise<void>      // cascade items + cards + logs
  upsertItems(items: Item[]): Promise<void>
  deleteItem(id: string): Promise<void>        // cascade cards + logs
  upsertCards(cards: Card[]): Promise<void>
  addReviewLog(log: ReviewLogEntry): Promise<void>
  addStudyTime(day: string, delta: { seconds?: number; reviews?: number; shadowing?: number }): Promise<StudyDay>
  saveSettings(s: Settings): Promise<void>
  exportAll(): Promise<Snapshot>               // = loadSnapshot, dùng cho "Xuất dữ liệu"
}

export interface AuthService {
  mode: 'local' | 'supabase'
  getSession(): Promise<AuthUser | null>       // local: luôn trả { id: 'local', email: null }
  signInWithEmail(email: string, redirectTo: string): Promise<void>
  signOut(): Promise<void>
  onChange(cb: (user: AuthUser | null) => void): () => void
}
```

Quy tắc:
- Mọi thao tác ghi đều là **upsert theo id** (idempotent) để có thể replay an toàn.
- `Snapshot` KHÔNG chứa `review_logs` (MVP chỉ ghi log, không đọc). Chứa `study_days` 120 ngày gần nhất.
- `LocalRepository`: khoá `vta:v1:lessons`, `vta:v1:items`, `vta:v1:cards`, `vta:v1:review_logs`, `vta:v1:study_days`, `vta:v1:settings` — mỗi khoá một mảng/đối tượng JSON. `user_id` cố định `'local'`.
- `SupabaseRepository`: `loadSnapshot` chạy 5 truy vấn song song (`Promise.all`): `lessons`, `items`, `cards`, `study_days` (where `day >= today-120`), `settings` (maybeSingle). Nếu `settings` null (trigger chưa chạy) thì upsert mặc định.
- `addStudyTime` trên Supabase gọi `rpc('add_study_time', { p_day, p_seconds, p_reviews, p_shadowing })` để cộng dồn phía server (tránh ghi đè khi dùng 2 thiết bị).

### 2.4 Chiến lược tải và đồng bộ

Dữ liệu mỗi người nhỏ (vài trăm mục, vài nghìn thẻ tối đa) → **tải hết một lần khi đăng nhập**, giữ trong bộ nhớ, ghi write-through.

1. Khi có session: `DataProvider` gọi `loadSnapshot()`; trong lúc chờ hiển thị trạng thái loading toàn trang (mục 5.6). Thất bại → màn lỗi toàn trang "Không tải được dữ liệu. Kiểm tra mạng rồi thử lại." + nút "Thử lại".
2. Mỗi action: (a) cập nhật state lạc quan ngay; (b) gọi repository; (c) nếu lỗi → đẩy op vào hàng đợi `pending` (persist `localStorage` khoá `vta:v1:pending:<userId>`), hiện toast "Chưa lưu được. Sẽ tự thử lại khi có mạng." Không hoàn tác state.
3. Replay hàng đợi theo thứ tự FIFO khi: sự kiện `online`, mỗi 30 giây nếu hàng đợi khác rỗng, và trước khi thực hiện op mới. Thành công → gỡ khỏi hàng đợi. Thất bại → dừng, thử lại lần sau. Quá 50 op hoặc 1 op thất bại > 20 lần → toast "Có dữ liệu chưa đồng bộ được. Hãy tải lại trang khi có mạng." (không xoá hàng đợi).
4. Shell hiển thị chip "Chưa đồng bộ · {n}" khi `pending.length > 0`, chip "Ngoại tuyến" khi `navigator.onLine === false`.
5. Không có realtime; mở app trên thiết bị khác thì tải lại snapshot (reload). Khi tab lấy lại focus (`visibilitychange` → visible) sau > 10 phút ẩn, gọi lại `loadSnapshot()` nền và thay state nếu hàng đợi rỗng.
6. Chế độ cục bộ không có hàng đợi (localStorage ghi đồng bộ, lỗi chỉ khi đầy → toast "Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt.").
7. **Thứ tự FIFO tuyệt đối (T06)**: trước mỗi op mới, `replay()` trước; nếu hàng đợi vẫn còn op (replay thất bại hoặc bị tab khác giữ lock) thì op mới **phải enqueue thẳng**, không gọi repository trực tiếp — nếu không `upsertLesson(L1)` kẹt trong hàng đợi rồi `deleteLesson(L1)` thành công trực tiếp sẽ làm L1 "sống lại" khi replay.
8. **Nhiều tab**: `PendingQueue` merge theo `op.id` khi persist, nghe sự kiện `storage` để load lại, và dùng `navigator.locks` để mỗi lúc chỉ một tab replay (đã làm ở T04).
9. **`addStudyTime` không idempotent** (cộng dồn): chấp nhận ở MVP vì chỉ ảnh hưởng thống kê phút/lượt, không ảnh hưởng FSRS hay nội dung. Giảm thiểu ở T06: `useStudyTimer` gom giây và flush mỗi 30s hoặc khi kết thúc phiên, không gọi mỗi thẻ. Nếu sau này cần idempotent: thêm `p_op_id uuid` vào rpc + bảng `study_time_ops(op_id pk)` với `insert … on conflict do nothing` (GĐ2).
11. **Lỗi không retry được (T06)**: mã PostgREST `23505, 23503, 23514, 22P02, 42501` (`isNonRetryableCode`) → không giữ op ở đầu hàng đợi: chuyển op sang danh sách dead-letter `vta:v1:pending:<userId>:failed` (không xoá), toast "Có dữ liệu chưa đồng bộ được. Hãy tải lại trang khi có mạng.", rồi gọi `loadSnapshot()` để hoà giải state với server. Riêng 23505 trên `upsertItems` có `pattern_id` → coi như "đã có trên server": bỏ op + các `upsertCards` phụ thuộc, reload snapshot. Schema đã **bỏ** unique `(user_id, number)` của lessons.
12. **Toast lỗi ghi** luôn dùng câu cố định "Chưa lưu được. Sẽ tự thử lại khi có mạng." (không hiện `err.message`); log `err.code`/`err.status` ra console.warn, không log payload.
10. **T05 — `SupabaseRepository` bỏ `user_id` khỏi payload** khi upsert (op trong hàng đợi mang nguyên bản ghi từ state; DB có `default auth.uid()`); cascade để FK `on delete cascade` lo; lỗi 4xx (RLS/constraint) làm op kẹt đầu hàng đợi → log `error.code` (không log payload) và dựa vào `isOverloaded` để hiện toast.

### 2.5 Định tuyến và bảo vệ

- `createBrowserRouter` + `RouterProvider`; mọi route màn hình `React.lazy`.
- Route gốc `<Shell>` bọc tất cả trừ `/login`. Loader bảo vệ: nếu `mode === 'supabase'` và chưa có session → `redirect('/login?next=<path>')`. Chế độ cục bộ không bao giờ redirect sang `/login`.
- `/login` khi đã có session → redirect `/`.
- 404 → `NotFound.tsx`: "Không có trang này." + liên kết "Về Hôm nay".
- `vercel.json` rewrite mọi path về `/index.html`.

---

## 3. Mô hình dữ liệu và schema

File đầy đủ: `supabase/schema.sql` (idempotent, chạy 1 lần trong SQL Editor). Tóm tắt:

| Bảng | Khoá | Cột chính | Ghi chú |
|---|---|---|---|
| `settings` | `user_id` pk | `display_name`, `daily_goal_min` (5–120, mặc định 15), `new_cards_per_day` (5–30, mặc định 15), `voice_name`, `auto_speak` (false), **(T20)** `study_language` (`'all'` \| `'en'` \| `'zh'` \| `'ja'` \| `'ko'`, mặc định `'all'`) | Tự tạo bằng trigger khi user đăng ký |
| `lessons` | `id` uuid | `number` (unique theo user), `date`, `topic` (1–80), `notes` (≤2000), `questions` (≤1000), `mistakes` (≤500), **(T20)** `language` (`'en'`/`'zh'`/`'ja'`/`'ko'`, `not null default 'en'`) | 1 buổi = 1 trang vở; 1 buổi = 1 ngôn ngữ |
| `items` | `id` | `lesson_id` (null nếu từ thư viện), `kind` word/phrase/pattern, `en` (1–200; **câu ngôn ngữ đích** — tên cột giữ nguyên, xem 6.14 (5).2), `vi` (1–200), `ipa` (≤120; **phiên âm** chung: IPA/pinyin/romaji/RR), `note` (≤200), `pattern_id`, `position` | unique (user_id, pattern_id) khi pattern_id not null; **không có cột ngôn ngữ** — suy từ lesson hoặc từ tình huống seed của `pattern_id` |
| `cards` | `id` | `item_id`, `direction` en_vi/vi_en/listen, `due`, `state` 0–3, `reps`, `lapses`, `first_reviewed_at`, `suspended`, `fsrs` jsonb | unique (item_id, direction); index (user_id, due) |
| `review_logs` | `id` | `card_id`, `rating` 1–4, `reviewed_at`, `duration_ms`, `revlog` jsonb | chỉ ghi |
| `study_days` | (`user_id`, `day`) | `seconds`, `reviews`, `shadowing_count` | `day` là ngày địa phương dạng `YYYY-MM-DD`; cộng dồn qua rpc `add_study_time` |

RLS: mọi bảng bật RLS, một policy `for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())`. `anon` bị revoke quyền bảng. `user_id` có `default auth.uid()` nên client **không gửi** `user_id`.

### 3.1 Kiểu TypeScript (`domain/types.ts`)

```ts
export type Direction = 'en_vi' | 'vi_en' | 'listen'   // mã kỹ thuật giữ nguyên cho mọi ngôn ngữ (T20): en_vi = "Đích → Việt"
export type Kind = 'word' | 'phrase' | 'pattern'
export type Grade = 1 | 2 | 3 | 4        // Again, Hard, Good, Easy (trùng ts-fsrs Rating)

// (T20) Ngôn ngữ học. Giao diện luôn tiếng Việt; `vi` KHÔNG phải ngôn ngữ học.
export type Language = 'en' | 'zh' | 'ja' | 'ko'
export const LANGUAGES = ['en', 'zh', 'ja', 'ko'] as const satisfies readonly Language[]
export type StudyLanguageFilter = 'all' | Language
export const STUDY_LANGUAGES = ['all', 'en', 'zh', 'ja', 'ko'] as const satisfies readonly StudyLanguageFilter[]

export interface Lesson { id: string; user_id: string; number: number; date: string /*YYYY-MM-DD*/;
  topic: string; notes: string; questions: string; mistakes: string;
  language: Language /* (T20) mặc định 'en'; dữ liệu cũ thiếu trường → 'en' khi đọc */;
  created_at: string; updated_at: string }

export interface Item { id: string; user_id: string; lesson_id: string | null; kind: Kind;
  en: string /* câu NGÔN NGỮ ĐÍCH (tên trường giữ nguyên, xem 6.14 (5).2) */; vi: string;
  ipa: string /* phiên âm: IPA (en), pinyin có dấu thanh (zh), romaji Hepburn hoặc kana (ja), Revised Romanization (ko) */;
  note: string; pattern_id: string | null; position: number;
  created_at: string; updated_at: string }

export interface Card { id: string; user_id: string; item_id: string; direction: Direction;
  due: string /*ISO*/; state: 0 | 1 | 2 | 3; reps: number; lapses: number;
  first_reviewed_at: string | null; suspended: boolean;
  fsrs: Record<string, unknown> /* card object ts-fsrs đã JSON hoá */; created_at: string; updated_at: string }

export interface ReviewLogEntry { id: string; user_id: string; card_id: string; rating: Grade;
  reviewed_at: string; duration_ms: number; revlog: Record<string, unknown> }

export interface StudyDay { user_id: string; day: string; seconds: number; reviews: number; shadowing_count: number }

export interface Settings { user_id: string; display_name: string; daily_goal_min: number;
  new_cards_per_day: number; voice_name: string | null; auto_speak: boolean;
  study_language: StudyLanguageFilter /* (T20) bộ lọc "Ngôn ngữ đang học", mặc định 'all' */ }

export interface Snapshot { lessons: Lesson[]; items: Item[]; cards: Card[]; studyDays: StudyDay[]; settings: Settings }
```

KHÔNG dùng `enum` (tsconfig `erasableSyntaxOnly: true`). Dùng union type và object `as const`.

### 3.2 (T20) Migration đa ngôn ngữ — thêm vào cuối `supabase/schema.sql`, idempotent

```sql
-- 9. (T20) Ngôn ngữ học theo buổi + bộ lọc "Ngôn ngữ đang học"
alter table public.lessons  add column if not exists language text not null default 'en';
alter table public.lessons  drop constraint if exists lessons_language_check;
alter table public.lessons  add constraint lessons_language_check check (language in ('en', 'zh', 'ja', 'ko'));
create index if not exists lessons_user_language_idx on public.lessons (user_id, language);

alter table public.settings add column if not exists study_language text not null default 'all';
alter table public.settings drop constraint if exists settings_study_language_check;
alter table public.settings add constraint settings_study_language_check check (study_language in ('all', 'en', 'zh', 'ja', 'ko'));
```

Quy tắc đọc/ghi (mọi lớp):
- **Đọc** (`toLesson`, `toSettings` ở `repo/supabase.ts`; `loadSnapshot` ở `repo/local.ts`; `planImport` ở `domain/importSnapshot.ts`): `language` thiếu/`null` → `'en'`; `study_language` thiếu/không hợp lệ → `'all'`. Hàm chuẩn hoá duy nhất: `asLanguage(x, 'en')`, `asStudyLanguage(x)` trong `domain/language.ts`.
- **Ghi**: client luôn gửi `language`/`study_language`. Nếu Supabase **chưa chạy migration**, PostgREST trả `PGRST204` ("Could not find the 'language' column…"): `SupabaseRepository` bắt mã này ở `upsertLesson/upsertLessons/saveSettings`, **gửi lại một lần không có cột mới**, đặt cờ module `schemaOutdated = true` và gọi `notify` đúng **1 lần/phiên**: "Supabase chưa có cột ngôn ngữ. Chạy lại supabase/schema.sql để lưu ngôn ngữ buổi học." Dữ liệu khác vẫn lưu bình thường; buổi học đó trên server tạm là `en`. `PGRST204` **không** đưa vào dead-letter.
- Không đổi tên cột `items.en`, không đổi khoá `localStorage` `vta:v1:*` (đổi là mất dữ liệu cục bộ).
- `cards` **không** có cột ngôn ngữ: ngôn ngữ của thẻ = ngôn ngữ của item = `lesson.language` (item thuộc buổi) hoặc `situation.language` của `pattern_id` (item từ thư viện) — `itemLanguageResolver(lessons)` (6.14 (3)).

---

## 4. Thuật toán và quy tắc chung

### 4.1 Ngày giờ (`lib/dates.ts`)

- `TZ = 'Asia/Ho_Chi_Minh'`. Không dùng múi giờ thiết bị cho mọi phép tính "ngày học".
- `localDay(d: Date): string` → `'YYYY-MM-DD'` qua `Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit' })`.
- `startOfLocalDay(day: string): Date` → `new Date(day + 'T00:00:00+07:00')`. `endOfLocalDay(day)` = start của ngày kế tiếp trừ 1ms.
- `addDays(day: string, n: number): string` — cộng theo UTC trên chuỗi (`Date.UTC`), không qua múi giờ thiết bị.
- `formatDateVi(day: string): string` → "Thứ Bảy, 7/11" (`Intl.DateTimeFormat('vi-VN', { weekday:'long', day:'numeric', month:'numeric', timeZone: TZ })`, viết hoa chữ đầu).
- `weekdayShortVi`: `['T2','T3','T4','T5','T6','T7','CN']`, tuần bắt đầu Thứ Hai.
- Hiển thị tương đối trong hàng đợi/khoảng cách (`formatRelative(ms)`): "<10 phút", "{n} phút" (<60 phút), "{n} giờ" (<24 giờ), "1 ngày", "{n} ngày", "{n} tuần" (≥14 ngày), "{n} tháng" (≥60 ngày). `formatInterval` ở T03 gọi lại hàm này, không viết lại.

### 4.2 FSRS với ts-fsrs v6 (`lib/fsrs.ts`) — API đã xác minh trong `node_modules/ts-fsrs/dist/index.d.mts`

- **Deprecated, KHÔNG dùng**: `fsrs()`, `FSRS`, `f.next()`, `f.repeat()`, `createEmptyCard()`, `generatorParameters()`.
- **Dùng**:
  ```ts
  import { DefaultScheduler, Rating } from 'ts-fsrs'
  const scheduler = await DefaultScheduler({ desiredRetention: 0.9, enableShortTerm: true,
    learningSteps: ['1m', '10m'], relearningSteps: ['10m'], enableFuzz: false, maximumInterval: 365,
    allowModelOverride: false })   // bắt buộc: FSRS-7 mặc định bỏ qua bước học (Nhớ → 4,8 ngày); false → Nhớ 10 phút, Khó 5,5 phút
  const card = scheduler.newCard({ now, cardId })                 // cardId = id uuid của thẻ trong DB
  const { card: next, revlog } = scheduler.review({ card, now, grade })  // grade: 1|2|3|4
  for (const { grade, card } of scheduler.preview({ card, now })) { /* dự báo 4 mức */ }
  ```
- `DefaultScheduler()` trả về **Promise** → tạo một lần trong `getScheduler()` (module singleton, cache promise). Không tạo trong render.
- Phiên bản model: để mặc định (FSRS-7). Không truyền `weights`.
- Card trả về có các trường: `stability`, `difficulty`, `stabilityFast` (FSRS-7), `dueAt: Date`, `lastReviewAt: Date | null`, `state: 0|1|2|3`, `scheduleStatus: 'new'|'learning'|'review'`, `reps`, `lapses`, `scheduledDays`, `learningStep`, `cardId`. Tên trường là `dueAt`/`lastReviewAt` (camelCase), KHÔNG phải `due`/`last_review` như API cũ.
- `Rating.Again=1, Hard=2, Good=3, Easy=4`. Thẻ Quên = grade 1.
- **Lưu trữ**: `cards.fsrs = JSON.parse(JSON.stringify(card))` (Date → chuỗi ISO). Khi đọc: `deserializeCard(fsrs)` phải chuyển `dueAt`, `lastReviewAt` về `Date` trước khi đưa vào `scheduler.review/preview`. Sao chép `dueAt → cards.due`, `state`, `reps`, `lapses` ra cột riêng sau mỗi lần chấm.
- `gradeCard(card: Card, grade: Grade, now: Date): Promise<{ card: Card; log: ReviewLogEntry }>` là hàm thuần (không gọi repository; **async** vì scheduler async — caller phải `await`), sinh `id` log mới, đặt `first_reviewed_at` nếu đang null. **Kẹp thời gian**: nếu `now < prev.lastReviewAt` (đồng hồ lệch giữa thiết bị, replay pending) thì dùng `lastReviewAt` làm `now` cho review/preview, vì thư viện ném lỗi khi elapsed âm.
- `previewIntervals(card, now): Promise<Record<Grade, string>>` (**async**) → chuỗi hiển thị theo 4.1 ("<10 phút", "3 ngày"...). Dùng `card.dueAt - now`.
- `shouldUnlockSiblings(prevCard, grade, now)` (4.3) đặt tại `lib/fsrs.ts`; `domain/review.ts` (T09) re-export.

### 4.3 Sinh thẻ từ mục và mở khoá chiều

- Tạo 1 `item` → tạo **đúng 1 thẻ** `en_vi` (state New, `due = now`).
- **Mở khoá** `vi_en` và `listen` cho item khi, **tại thời điểm chấm** thẻ `en_vi`:
  `prev.lastReviewAt != null && localDay(prev.lastReviewAt) < localDay(now) && grade !== 1`
  tức thẻ en_vi đã được ôn ở một ngày trước đó và hôm nay chấm không phải "Quên". (Đây là định nghĩa cụ thể của "sau 2 lần ôn en_vi" — hai lần ở hai ngày khác nhau, để tránh mở khoá ngay trong phiên đầu vì bước học 1m/10m.)
  Chỉ tạo thẻ còn thiếu (unique `item_id + direction`). Thẻ mới sinh là New, `due = now`, xếp sau trong hàng chờ thẻ mới.
- Sửa `en`/`vi` của item không ảnh hưởng FSRS của thẻ.
- Xoá item → xoá thẻ và log (cascade).

### 4.4 Hàng đợi phiên ôn (`domain/review.ts: buildQueue`)

Đầu vào: `cards`, `items`, `settings`, `now`, tuỳ chọn `{ lessonId?: string; ttsSupported: boolean; language?: Language; langOf?: (item: Item) => Language; speakable?: (lang: Language) => boolean }` (ba tuỳ chọn cuối thêm ở T20, đều **tuỳ chọn** — caller cũ không đổi hành vi).

1. Loại bỏ thẻ `suspended`, thẻ có item không tồn tại, và nếu `!ttsSupported` loại thẻ `listen`.
   **1b (T20).** Nếu có `language` → chỉ giữ thẻ có `langOf(item) === language` (`langOf` thiếu → mọi item coi là `'en'`). Nếu có `speakable` → thẻ `listen` của item ngôn ngữ `L` bị loại khi `!speakable(L)` (thiết bị không có giọng `L`); `speakable` thiếu → dùng `ttsSupported` cho mọi ngôn ngữ. Bộ lọc này áp **trước** bước 2–4, nên hạn mức thẻ mới (bước 4) vẫn đếm `introducedToday` trên **toàn bộ** `cards` (mọi ngôn ngữ) — một hạn mức chung cho cả vở, không phải mỗi ngôn ngữ một hạn mức (xem 12.2 T20).
2. Nếu có `lessonId` → chỉ thẻ của item thuộc buổi đó (chế độ "Ôn buổi này"), gồm cả chưa đến hạn; bỏ qua bước 3–4 (không giới hạn thẻ mới, vẫn áp dụng bước 1), sắp xếp: đến hạn trước (state 1/3 rồi state 2, theo `due`), rồi New theo `created_at`, rồi còn lại theo `due`.
3. **Đến hạn**: `state !== 0 && due <= endOfLocalDay(today)`. Sắp xếp: state 1/3 (đang học) trước theo `due` tăng dần, rồi state 2 theo `due` tăng dần; tie-break theo `id` để tất định giữa các thiết bị. **(T20)** Lọc theo ngôn ngữ không đổi thứ tự hay tie-break: hàng đợi lọc = hàng đợi không lọc đã bỏ các thẻ ngôn ngữ khác, **trừ** phần thẻ mới (bước 4) được lấy lại từ đầu danh sách New đã lọc theo cùng `newLeft`.
4. **Thẻ mới**: `state === 0`, sắp theo `created_at` tăng dần. Giới hạn `newPerDay = settings.new_cards_per_day` (5–30, mặc định 15): `newLeft = newPerDay - |{c : c.first_reviewed_at != null && localDay(first_reviewed_at) === today}|`; lấy `max(0, newLeft)` thẻ đầu. Hạn mức đếm trên **toàn bộ** `cards` (kể cả suspended và listen bị lọc); thẻ ôn lần đầu trong chế độ "Ôn buổi này" cũng tiêu hạn mức. Tie-break thẻ New: `created_at` → `item.position` → direction (`en_vi` < `vi_en` < `listen`) → `id`. `new_cards_per_day` không hợp lệ (thiếu/NaN) → 15.
5. Hàng đợi = đến hạn ++ thẻ mới. `estimateMinutes(n) = ceil(n * 20 / 60)`; n = 0 → 0.
6. **Yêu cầu lại trong phiên** (`shouldRequeue(nextCard, now, timesShownIncludingCurrent)`): sau khi chấm, nếu `nextCard.due - now <= 15 phút` và `timesShownIncludingCurrent < 3` (đếm cả lần vừa chấm → tối đa 3 lần hiện mỗi phiên) → đẩy về cuối hàng đợi. Helper `hiddenListenCount(cards, items, settings, now, options?)` = số thẻ listen lẽ ra vào hàng đợi nếu có giọng đọc (dùng cho 6.3 "{k} thẻ nghe tạm ẩn"); **(T20)** nhận cùng `language`/`langOf` như `buildQueue` và tính bằng `speakable = () => true`, trừ đi số listen thực có — gộp cả hai lý do ẩn (không Web Speech, hoặc thiếu giọng của ngôn ngữ đó).
7. Phiên kết thúc khi hàng đợi rỗng. Mỗi lần chấm đều lưu ngay; thoát giữa chừng không mất gì.

### 4.5 Thời gian học và chuỗi ngày (`domain/stats.ts`, `hooks/useStudyTimer.ts`)

- **Ôn thẻ**: mỗi lần chấm cộng `min(duration_ms, 60000)/1000` giây vào `study_days[today].seconds`, `reviews += 1`. `duration_ms` = từ lúc hiện mặt trước đến lúc bấm chấm.
- **Shadowing**: `useStudyTimer(active)` cộng 1 giây mỗi giây khi `active && document.visibilityState === 'visible'`; `active` = đã bấm nghe/ghi âm ít nhất 1 lần trong 120 giây gần nhất (idle 2 phút thì ngừng đếm). Flush xuống repository mỗi 30 giây và khi unmount/ẩn tab (gộp lại thành một `addStudyTime`). Mỗi bản ghi âm hoàn tất → `shadowing += 1`.
- **Ngày tính vào chuỗi**: `seconds >= 60`. **(T20) Bất biến**: `study_days` không có chiều ngôn ngữ; chuỗi ngày, phút hôm nay, lịch 8 tuần và mục tiêu ngày tính **chung mọi ngôn ngữ**, kể cả khi "Ngôn ngữ đang học" ≠ Tất cả.
- **Chuỗi hiện tại** `streak(studyDays, today)`: đếm liên tiếp lùi từ `today` nếu today đạt; nếu today chưa đạt thì bắt đầu từ `yesterday` (chuỗi chưa đứt, chỉ "chưa học hôm nay"). Trả `{ current, best, todayDone }`. `best` = chuỗi dài nhất trong cửa sổ `studyDays` của snapshot (120 ngày), bỏ qua ngày sau `today` (đồng hồ lệch); bản ghi trùng `day` cộng dồn.
- Mục tiêu ngày đạt khi `todaySeconds >= daily_goal_min * 60`.

### 4.6 Thẻ khó nhất (`hardestCards(cards, items, n=3, options)`)

**(T20)** `options` thêm `language?`, `langOf?`, `speakable?` với ngữ nghĩa như 4.4 bước 1b (lọc trước khi xếp hạng). Lọc `state !== 0`; sắp theo `lapses` giảm dần, rồi `fsrs.difficulty` giảm dần; lấy n. Nhãn trạng thái: `lapses > 0` → "quên {lapses} lần" (đỏ); ngược lại `difficulty >= 7` → "khó" (mute); ngược lại → "đang học" (mute). Nếu không đủ n thẻ đã học (nhưng có ≥ 1), bổ sung thẻ New với nhãn "mới"; không có thẻ đã học nào → trả `[]` (UI ẩn khối). Bỏ thẻ suspended, thẻ không có item, thẻ listen khi `!ttsSupported`; **dedupe theo `item_id`** (giữ thẻ khó nhất). Thiếu `difficulty` coi là 0.

### 4.7 So khớp câu trả lời nghe → gõ (`lib/text.ts`)

`normalizeAnswer(s, language = 'en')`: lowercase, bỏ dấu câu `.,!?;:'"’“”-`, gộp khoảng trắng, trim; chuẩn hoá `’ → '` trước khi bỏ. **(T20)** Với mọi ngôn ngữ bỏ thêm dấu câu CJK/fullwidth `。、，！？；：「」『』（）《》・～` và khoảng trắng fullwidth (U+3000); với `zh` và `ja` **bỏ hết khoảng trắng** (không có ranh giới từ); `ko` giữ khoảng trắng; NFC normalize trước khi so (Hangul tổ hợp). `compareAnswer(input, expected, language = 'en')` → `'exact' | 'close' | 'wrong'`; `close` khi khoảng cách Levenshtein (tính theo **code point**, không theo UTF-16 unit) ≤ `max(1, floor(len/8))`. Chỉ dùng để gợi ý, không tự chấm. Tham số mặc định giữ hành vi cũ cho `en`.

---

## 5. Hệ thống giao diện

Bám direction contract. Không bịa hướng thẩm mỹ mới. Mọi giá trị dưới đây là **nguồn duy nhất**; không hard-code màu trong component.

### 5.1 Tokens (`styles/tokens.css`)

```css
:root {
  --paper: #F7F5FB;      /* nền trang */
  --grid: #D9D3EE;       /* dòng kẻ phụ, đường kẻ 1px */
  --grid2: #B9B2DA;      /* dòng kẻ chính, viền card */
  --ink: #20182E;        /* chữ chính */
  --purple: #4B2E83;     /* mực tím: thanh trên, nút chính, tiếng Anh */
  --red: #D2332B;        /* bút đỏ: quên, lỗi, cảnh báo, lời phê */
  --mute: #6A6280;       /* chữ phụ (đạt 5.4:1 trên paper) */
  --white: #FFFFFF;
  --lilac: #E6DFF7;      /* chữ nav trên nền tím, nền hover nhẹ, selection */

  --radius-card: 10px; --radius-btn: 8px; --radius-chip: 6px;
  --rule: 1px solid var(--grid);        /* đường kẻ chuẩn */
  --rule-strong: 1px solid var(--grid2);

  --font-ui: 'Be Vietnam Pro', system-ui, sans-serif;
  --font-remark: 'Charm', cursive;
  /* (T20) Font hệ thống cho chữ CJK — KHÔNG tải từ Google Fonts. Be Vietnam Pro đứng trước để
     dấu câu/chữ Latin trong câu CJK giữ nét UI; glyph Hán/Kana/Hangul rơi xuống font hệ thống.
     Tách theo ngôn ngữ để trình duyệt chọn đúng biến thể chữ Hán (zh ≠ ja). */
  --font-zh: 'Be Vietnam Pro', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', system-ui, sans-serif;
  --font-ja: 'Be Vietnam Pro', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans CJK JP', 'Noto Sans JP', system-ui, sans-serif;
  --font-ko: 'Be Vietnam Pro', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'Noto Sans KR', system-ui, sans-serif;

  --line: 48px;          /* bước dòng kẻ chính của vở; baseline tiếng Anh */
  --topbar-h: 68px; --topbar-h-mobile: 56px; --bottombar-h: 64px;
  --tap: 44px;           /* kích thước chạm tối thiểu */
  --shadow: none;        /* không đổ bóng ở bất kỳ đâu */
}
```

Font: Google Fonts `Be+Vietnam+Pro:wght@400;500;600;700` và `Charm:wght@700`, `display=swap`, có `preconnect`. Đặt trong `index.html`; `<html lang="vi">`, `<title>Vở Tiếng Anh</title>`, `theme-color #4B2E83`.

### 5.2 Typography

| Vai trò | Cỡ desktop / mobile | Weight | Màu |
|---|---|---|---|
| Số lớn (thẻ đến hạn) | 104px / 72px, line-height 1 | 700 | purple |
| H1 trang | 28px / 24px | 700 | ink |
| H2 chủ đề trên trang vở | 34px / 26px | 700 | purple |
| Câu tiếng Anh trên trang vở | 26px / 20px, line-height var(--line) | 500 | purple |
| Câu tiếng Anh trên thẻ ôn (mặt trước) | 36px / 28px | 600 | purple |
| Nghĩa tiếng Việt kèm | 17px / 16px | 500 | ink |
| Thân bài, nhãn form | 16px | 400/500 | ink |
| Phụ, meta, IPA | 14–15px | 400 | mute |
| Nhãn số liệu (vd "Đến hạn ôn hôm nay") | 13px, uppercase, letter-spacing .08em | 600 | mute |
| Lời phê (Remark) | 30px / 24px, Charm 700, xoay -6° | 700 | red |

Quy tắc:
- **Không dùng nhãn uppercase/eyebrow ở bất kỳ đâu** (kể cả trên số liệu) — finish review xếp đây là lệnh cấm sàn. Nhãn khối/số liệu là heading thường 16px/600 ink chữ thường. Class `.stat-label` đã bị xoá.
- Charm: **tối đa 1 lời phê / màn hình**, luôn là `Remark`, chỉ 3 nội dung: "Tốt lắm!", "Đều đặn lắm!", "Cố lên nhé!". Không render Remark rỗng. Không dùng Charm cho bất kỳ chữ nào khác.
- Mọi chữ tiếng Anh bọc `<span lang="en">` (hoặc phần tử có `lang="en"`). **(T20)** Tổng quát: mọi chữ **ngôn ngữ đích** mang `lang={LANG_TAG[language]}` với `LANG_TAG = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' }`; phiên âm mang `lang={ROMAN_TAG[language]}` = `{ en: 'en', zh: 'zh-Latn', ja: 'ja-Latn', ko: 'ko-Latn' }` (kana trong ô phiên âm vẫn dùng `ja-Latn` — chấp nhận). Không hard-code `lang="en"` ở nơi hiển thị dữ liệu người dùng nữa; chỉ giữ `lang="en"` cho chuỗi tiếng Anh cố định của UI (vd lệnh cài VieNeu).
- **(T20) CSS theo `lang`** (`styles/base.css`): `[lang="zh-Hans"], [lang^="zh-"] { font-family: var(--font-zh); line-break: strict; overflow-wrap: anywhere }` · `[lang="ja"], [lang^="ja-"] { font-family: var(--font-ja); line-break: strict; overflow-wrap: anywhere }` · `[lang="ko"], [lang^="ko-"] { font-family: var(--font-ko); word-break: keep-all; overflow-wrap: anywhere }` (`zh-Latn`/`ja-Latn`/`ko-Latn` vẫn khớp `^=` và dùng cùng stack — chữ Latin vẫn ra Be Vietnam Pro vì đứng đầu stack). Cỡ chữ CJK **giữ nguyên** cỡ hiện có của từng vai trò; chỉ nâng `line-height` ở nơi đang < 1.4: `.sh-en` (32px/1.25) → `[lang^=zh|ja|ko]` 1.4; mặt trước `vi_en`/`listen` của Ôn thẻ (28px/1.3) → 1.4. Câu trên lưới vở (26px/48px, mobile 20px/24px) và `.review-en` (36px/48px) đã ≥ 1.2 với glyph CJK nằm gọn trong em-box → không đổi, không phá lưới 48/24px.
- Cỡ chữ tối thiểu 14px; không dùng < 13px.

### 5.3 Màu đỏ

Đỏ `--red` CHỈ dùng cho: (1) nhãn "quên" / nút "Quên"; (2) thông báo lỗi, validation; (3) nút nguy hiểm (xoá) và hộp xác nhận; (4) lời phê Charm; (5) nhãn "Lỗi hay gặp:" và "Lưu ý phát âm:" (chữ đỏ + gạch chân 1px đỏ, `text-underline-offset: 3px`); (6) đường lề đỏ của trang vở (xem 5.5). Không dùng đỏ làm trang trí, không dùng làm màu nhấn (accent) của biểu đồ.

**Anti-pattern phải tránh** (có trong sketch `model-pick.html`, không được sao chép): ô "Lỗi hay gặp" với `border-left: 3px solid red`. Thay bằng: đoạn văn thường, nhãn "Lỗi hay gặp:" đỏ gạch chân, phần nội dung màu ink, có thể gạch chân đỏ lượn (`text-decoration: underline wavy var(--red)`) dưới từ/âm cụ thể nếu người dùng bọc bằng dấu `*từ*` (tuỳ chọn, xem 6.5). Không viền màu một bên dày hơn 1px ở bất kỳ phần tử nào.

### 5.4 Thành phần cơ bản

- **Card** (`.card`): nền white, `border: var(--rule-strong)`, radius 10px, padding 24px (mobile 16px), không bóng. **Không card lồng card**: bên trong card chỉ dùng đường kẻ 1px (`border-top: var(--rule)`) để tách hàng.
- **Button**: cao 52px (lg) / 44px (md); padding ngang 24px; radius 8px; font 17px/16px weight 600.
  - `primary`: nền purple, chữ white. Hover: nền `#3E2570` (tối hơn 1 nấc; coder tính bằng `color-mix(in srgb, var(--purple) 85%, black)`). Disabled: opacity .5, `cursor: not-allowed`.
  - `secondary`: nền white, viền 1px grid2, chữ purple. Hover: nền lilac.
  - `danger`: nền white, viền 1px red, chữ red. Hover: nền `color-mix(in srgb, var(--red) 8%, white)`. Luôn đặt tách khỏi nút chính bằng khoảng trống ≥ 24px hoặc dòng kẻ; không đứng cạnh nút chính trong cùng cụm.
  - `ghost`: không viền, chữ purple, dùng cho hành động phụ dạng text.
  - Icon lucide-react size 20, `strokeWidth 1.75`, `aria-hidden` khi có nhãn chữ; nút chỉ icon PHẢI có `aria-label`.
- **Field**: label trên (16px/500), input cao 44px, viền 1px grid2, radius 6px, nền white, focus viền purple; lỗi: viền red + dòng lỗi 14px red có `id` nối với `aria-describedby`, `aria-invalid="true"`. Mô tả phụ 14px mute.
- **Focus ring** toàn app: `outline: 2px solid var(--purple); outline-offset: 2px`; trên nền tím: `outline-color: var(--white)`. Dùng `:focus-visible`.
- **Selection**: `::selection { background: var(--lilac); color: var(--ink) }`.
- **Scrollbar**: `scrollbar-width: thin; scrollbar-color: var(--grid2) var(--paper)`; webkit tương đương, không bo tròn lạ.
- **StatusMark**: chữ 14px; biến thể `forgot` (red), `hard` / `new` / `learning` (mute). Không badge bo tròn nền màu — trạng thái là "dấu in", chỉ chữ.
- **Toast**: góc dưới giữa (mobile) / dưới phải (desktop), nền ink, chữ white, 1 dòng, `role="status"`, tự ẩn 4s; lỗi dùng viền trái? **Không** — toast lỗi chỉ thêm icon `CircleAlert` màu red và chữ bắt đầu "Chưa …".
- **ConfirmDialog**: `<dialog>` native, nền white, viền 1px grid2, radius 10px, tiêu đề 20px, mô tả 16px; nút "Huỷ" (secondary) bên trái, nút nguy hiểm (danger) bên phải, cách nhau `justify-content: space-between`. Focus vào "Huỷ" khi mở. Esc đóng.
- **EmptyState**: tiêu đề 20px/600 ink, mô tả 16px mute, 1 nút primary (+ 1 ghost tuỳ chọn). Không minh hoạ/mascot.
- **Spinner**: vòng 24px viền 2px grid2 + purple quay; kèm chữ "Đang tải…" (có thể `visually-hidden`). Tôn trọng `prefers-reduced-motion` (đổi sang chấm tĩnh).

### 5.5 NotebookPage (trang vở ô ly) — thành phần chữ ký

Props: `{ dateLine?: string; title?: string; remark?: string | null; children; className? }`. Dùng ở Hôm nay (buổi gần nhất), Trang buổi học, Mẫu câu tình huống.

- Nền white; `border: var(--rule-strong)`; radius 10px; `padding: 30px 40px 30px 96px` (mobile: `24px 16px 24px 56px`).
- Lưới: `background-image: linear-gradient(var(--grid2) 1px, transparent 1px), linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 100% 48px, 100% 12px, 48px 100%; background-position: 0 23px, 0 23px, 72px 0` (mobile: cột dọc bắt đầu 40px).
- **Lề đỏ**: `::before` tuyệt đối, `left: 72px` (mobile 40px), `width: 1px`, `background: var(--red)`, `opacity: .6`. Đúng 1px (kỷ luật đường kẻ 1px; sketch dùng 2px — không sao chép).
- `dateLine` 14px mute, `title` H2 purple; cả hai có `background: white; padding: 0 6px; display: inline-block` để che lưới phía sau.
- Dòng mục (`.entry`): câu EN 26px/48px purple weight 500; nghĩa VI 17px ink inline sau, cách 12px, `display: inline-block; max-width: 100%` để khi không vừa thì **cả cụm VI** xuống dòng riêng (không ngắt giữa cụm); trên mobile VI xuống dòng riêng (24px, vẫn giữ grid). Mỗi entry nằm trên bội số 48px (NotebookPage tự làm tròn `min-height` của `.entry`).
- `remark`: `Remark` tuyệt đối `top: 40px; right: 48px` (mobile `top: 16px; right: 16px; font-size: 24px`).

### 5.6 Trạng thái chung

- **Loading toàn trang** (lần đầu tải snapshot): nền paper, thanh trên tím đã hiện, giữa trang Spinner + "Đang mở vở…".
- **Loading cục bộ**: Spinner nhỏ trong khu vực đó; không skeleton nhiều lớp.
- **Rỗng**: EmptyState theo từng màn (xem mục 6).
- **Lỗi mạng khi ghi**: Toast (2.4). **Lỗi tải**: khối lỗi + "Thử lại".
- **Không hỗ trợ**: dòng thông báo 15px ink có icon `Info` purple (không đỏ, vì không phải lỗi của người dùng), kèm hướng dẫn trình duyệt thay thế.

### 5.7 Responsive

- Breakpoints: `>= 1024px` desktop (2 cột ở Hôm nay, nav trên); `768–1023px` tablet (1 cột, nav trên rút gọn chữ); `< 768px` mobile (thanh trên gọn + thanh dưới).
- Hỗ trợ từ 390px đến 1440px; container tối đa 1200px, padding ngang 40px desktop / 16px mobile.
- Mọi phần tử tương tác ≥ 44×44px; khoảng cách giữa các nút chấm ≥ 8px.

---

## 6. Màn hình

Mỗi màn hình có 8 mục: (1) Mục đích & user story, (2) Luồng chính & phụ, (3) Dữ liệu & validation, (4) Trạng thái, (5) Quy tắc nghiệp vụ, (6) Microcopy, (7) Tiêu chí chấp nhận, (8) Task liên quan (tham chiếu mục 9).

### 6.1 Đăng nhập — `/login` (`routes/Login.tsx`)

**(1) Mục đích.** Vào app bằng email, không mật khẩu. Là người học, tôi muốn gõ email và bấm liên kết trong hộp thư để thấy dữ liệu của mình trên mọi thiết bị.

**(2) Luồng.**
- Chính (mode supabase): mở `/login` → nhập email → "Gửi liên kết đăng nhập" → trạng thái "đã gửi" → người dùng mở email, bấm liên kết → quay lại `/login#access_token=…` (supabase-js `detectSessionInUrl` xử lý) → có session → redirect `?next` hoặc `/`.
- Phụ: email sai định dạng → lỗi tại trường. Gửi quá nhanh (Supabase trả 429/"rate limit") → lỗi. Liên kết hết hạn/sai (hash chứa `error_description`) → lỗi dạng khối + cho gửi lại. Mở liên kết ở trình duyệt khác với nơi yêu cầu (PKCE) → lỗi "Hãy mở liên kết trên cùng trình duyệt…".
- Chính (mode local): trang hiện giải thích chế độ cục bộ + nút "Vào học" → `/`.

**(3) Dữ liệu.** `email`: bắt buộc, trim, lowercase, regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, ≤ 254 ký tự. `redirectTo = window.location.origin + '/login'`.

**(4) Trạng thái.**
- `idle`: form.
- `sending`: nút disabled + Spinner trong nút, chữ "Đang gửi…".
- `sent`: thay form bằng khối: "Đã gửi liên kết đến **{email}**." / "Mở email và bấm vào liên kết để đăng nhập. Liên kết có hiệu lực trong 1 giờ." / nút ghost "Gửi lại" (disabled 60 giây, đếm ngược "Gửi lại sau {n}s") / nút ghost "Dùng email khác".
- `verifying` (có hash token trong URL): Spinner + "Đang đăng nhập…".
- `error`: khối lỗi phía trên form (chữ red, icon `CircleAlert`), form vẫn dùng được.
- `local`: khối thông tin: "Chưa cấu hình tài khoản." / "Dữ liệu sẽ lưu trên trình duyệt này và không đồng bộ sang thiết bị khác. Để đồng bộ, xem hướng dẫn trong README." / nút primary "Vào học".
- Không hỗ trợ: không áp dụng.

**(5) Quy tắc.** Đã có session → không hiển thị form, redirect ngay. Không lưu email vào localStorage. Sau 60s mới cho gửi lại.

**(6) Microcopy.**
- H1: "Vở Tiếng Anh" · phụ đề: "Học lại tiếng Anh giao tiếp, mỗi ngày một ít."
- Label: "Email" · placeholder: "ban@vidu.com" · nút: "Gửi liên kết đăng nhập".
- Lỗi email: "Email chưa đúng. Kiểm tra lại giúp mình nhé."
- Lỗi rate limit: "Bạn vừa yêu cầu một liên kết. Đợi khoảng một phút rồi thử lại."
- Lỗi mạng: "Không gửi được. Kiểm tra mạng rồi thử lại."
- Lỗi liên kết: "Liên kết không còn hiệu lực. Hãy yêu cầu liên kết mới." · PKCE: "Hãy mở liên kết trên cùng trình duyệt bạn đã dùng để yêu cầu."
- Ghi chú dưới form: "Không cần mật khẩu. Mỗi tài khoản chỉ thấy dữ liệu của mình."

**(7) Tiêu chí chấp nhận.**
- [ ] Email không hợp lệ → không gọi API, hiện lỗi tại trường, focus vào trường.
- [ ] Gửi thành công → trạng thái `sent` với đúng email; "Gửi lại" khoá 60s có đếm ngược.
- [ ] Quay lại từ liên kết → tự đăng nhập và chuyển tới `?next` hoặc `/`; URL không còn hash token.
- [ ] Đã đăng nhập mà vào `/login` → redirect `/`.
- [ ] Mode local: không có form, có nút "Vào học"; vào `/` không bị đẩy về `/login`.
- [ ] Trang dùng được bằng bàn phím; nút gửi là `type="submit"`; Enter gửi form.

**(8) Task:** T07.

**(9) T20 — đổi tên:** H1 "Vở Ngoại Ngữ"; phụ đề "Học lại ngoại ngữ giao tiếp, mỗi ngày một ít." Mọi thứ khác giữ nguyên.

---

### 6.2 Shell và điều hướng (`components/Shell.tsx`)

**(1) Mục đích.** Khung chung: thanh trên tím với thương hiệu, điều hướng, chuỗi ngày, trạng thái đồng bộ; thanh dưới trên mobile. Người học biết mình đang ở đâu và quay về "Hôm nay" trong một chạm.

**(2) Luồng.** Chọn mục nav → route tương ứng; mục hiện tại được đánh dấu. Bấm chip chuỗi ngày → `/progress`. Bấm icon bánh răng → `/settings`. Bấm thương hiệu → `/`.

**(3) Dữ liệu.** `settings.display_name` (fallback phần trước @ của email; mode local: "Bạn"), `streak.current`, `pending.length`, `navigator.onLine`.

**(4) Trạng thái.**
- Desktop (≥1024): thanh 68px nền purple; trái "Vở Tiếng Anh" (20px/700 white); giữa nav 6 mục: "Hôm nay", "Nhật ký buổi học", "Thẻ ôn", "Mẫu câu", "Shadowing", "Tiến độ" — chữ 15px lilac, padding 9px 14px, radius 6px; mục hiện tại nền white chữ purple 600 (`aria-current="page"`); phải: "{tên} · chuỗi {n} ngày" 14px white/85% (là link tới `/progress`) + nút icon `Settings` (aria-label "Cài đặt").
- Tablet (768–1023): như desktop nhưng nav rút gọn: "Hôm nay", "Buổi học", "Thẻ ôn", "Mẫu câu", "Shadowing", "Tiến độ". Nav nằm ở **dòng thứ hai** trong thanh tím (một hàng không đủ chỗ ở 768px — quyết định T06).
- Mobile (<768): thanh trên 56px: thương hiệu + chip "chuỗi {n}" (icon `Flame`) + icon Settings. Thanh dưới 64px cố định, nền white, viền trên 1px grid2, 5 tab icon+nhãn **14px** (quy tắc chữ ≥ 14px; sketch 11px không dùng): "Hôm nay" (`Home`), "Buổi học" (`NotebookPen`), "Ôn thẻ" (`Layers`), "Mẫu câu" (`MessageSquareText`), "Shadowing" (`Mic`). Tiến độ vào qua chip chuỗi. Tab hiện tại chữ+icon purple, còn lại mute. Nội dung có `padding-bottom: calc(var(--bottombar-h) + env(safe-area-inset-bottom))`.
- Chip đồng bộ: khi `pending > 0`: "Chưa đồng bộ · {n}" (icon `CloudOff`, white/85%); khi offline: "Ngoại tuyến" (icon `WifiOff`). Mode local: chip "Cục bộ" (icon `HardDrive`) luôn hiện để người dùng biết dữ liệu chỉ nằm trên máy.
- Loading snapshot: Shell hiện, nội dung là loading toàn trang (5.6). Lỗi snapshot: khối lỗi + "Thử lại".
- Trong phiên ôn đang chạy (`/review` có thẻ): thanh dưới mobile **ẩn** để nút chấm không bị che; thanh trên vẫn hiện.

**(5) Quy tắc.** Bỏ qua link "Bỏ qua tới nội dung" (`<a href="#main" class="skip-link">`) là phần tử focus đầu tiên. `<main id="main" tabIndex={-1}>`. Chuyển route → focus về `main` và cuộn lên đầu. Tiêu đề tài liệu: "{Tên màn} · Vở Tiếng Anh".

**(6) Microcopy.** Như (4). Skip link: "Bỏ qua tới nội dung".

**(7) Tiêu chí chấp nhận.**
- [ ] Ở 1440px và 1024px: nav ngang đủ 6 mục, mục hiện tại nền trắng chữ tím; ở 390px: thanh dưới 5 tab, không tràn ngang.
- [ ] Chip chuỗi hiển thị đúng `streak.current`; bấm vào tới `/progress`.
- [ ] `pending > 0` → chip "Chưa đồng bộ · n"; offline → "Ngoại tuyến"; mode local → "Cục bộ".
- [ ] Tab/Shift+Tab đi qua được mọi mục nav; focus ring trắng trên nền tím nhìn rõ.
- [ ] Contrast chữ lilac trên purple ≥ 4.5:1 (lilac #E6DFF7 trên #4B2E83 ≈ 9:1).
- [ ] Không bóng đổ, không radius > 10px, không viền màu dày.

**(8) Task:** T06.

**(9) T20 — đổi tên:** thương hiệu trên thanh trên "Vở Ngoại Ngữ" (`APP_NAME` trong `hooks/usePageTitle.ts` là nguồn duy nhất; Shell đọc từ đó, không hard-code). Tiêu đề tài liệu "{Tên màn} · Vở Ngoại Ngữ". Nav không đổi (không thêm mục ngôn ngữ vào nav; bộ lọc nằm ở Cài đặt).

---

### 6.3 Hôm nay — `/` (`routes/Today.tsx`)

**(1) Mục đích.** Trong vài giây biết phải làm gì: số thẻ đến hạn, thời gian ước tính, nút "Ôn ngay", 3 thẻ khó nhất, trang vở buổi gần nhất, chuỗi ngày và phút đã học. Là người học bận rộn, tôi mở app và bắt đầu ôn ngay mà không phải tìm.

**(2) Luồng.**
- Chính: mở `/` → thấy khối "Đến hạn ôn hôm nay" với số lớn → "Ôn ngay" → `/review`. Sau khi ôn xong quay lại: số về 0, lời phê "Tốt lắm!" (nếu đạt mục tiêu phút) và gợi ý shadowing.
- Phụ: chưa có thẻ nào (người mới) → khối hướng dẫn tới "Ghi buổi học đầu tiên" hoặc "Xem mẫu câu". Chưa có buổi học → trang vở rỗng với lời mời ghi. Có thẻ nhưng hôm nay hết thẻ → trạng thái "đã xong".
- Bấm một dòng trong "thẻ khó nhất" → mở `/lessons/:id` của buổi chứa item (nếu có buổi); item từ thư viện → `/patterns/:situationId`.
- Bấm "Xem cả trang" trên trang vở → `/lessons/:id`. Bấm "Ghi buổi mới" → `/lessons/new`.

**(3) Dữ liệu.** Từ snapshot: `queue = buildQueue(...)`, `estimateMinutes`, `hardestCards`, `latestLesson = lessons` sắp theo `date desc, number desc` lấy 1, `items` của buổi đó theo `position`, `todaySeconds`, `streak`, `settings.daily_goal_min`. `fromLatest = |{c ∈ queue : item(c).lesson_id === latestLesson.id}|`.

**(4) Trạng thái.**
- Loading: toàn trang (5.6).
- Bố cục desktop: grid 2 cột `420px 1fr`, gap 28px, padding 32px 40px. Mobile: 1 cột, khối đến hạn trước, trang vở sau.
- **Khối đến hạn (card trắng)**:
  - Nhãn 13px uppercase mute: "Đến hạn ôn hôm nay".
  - Số lớn 104px purple = `queue.length`.
  - Dòng phụ 16px mute: "thẻ · khoảng {m} phút" + nếu `fromLatest > 0`: " · {k} thẻ từ buổi {số}". Khi m = 0: "thẻ".
  - Nút primary lg "Ôn ngay" → `/review`.
  - Dòng 14px mute dưới nút: "Hôm nay: {phút}/{mục tiêu} phút · chuỗi {n} ngày".
  - Danh sách "3 thẻ khó nhất": tiêu đề 13px uppercase mute "Thẻ khó nhất" (stat label, không phải kicker trên heading), các hàng tách bằng đường kẻ 1px: trái câu EN 15px ink `lang=en` (ellipsis 1 dòng), phải `StatusMark`. Ẩn cả khối khi không có thẻ nào đã học.
  - Trạng thái **đã xong** (`queue.length === 0` và có ít nhất 1 thẻ): số "0", dòng phụ "Hôm nay bạn đã ôn xong. Mai quay lại nhé." Nút primary đổi thành "Shadowing vài câu" → `/shadowing`; nút ghost "Ôn thêm buổi gần nhất" → `/review?lesson={latestLesson.id}` (chỉ khi có buổi).
  - Trạng thái **chưa có thẻ** (tổng `cards.length === 0`): số "0", dòng phụ "Chưa có thẻ nào. Ghi lại buổi học đầu tiên để bắt đầu." Nút primary "Ghi buổi học đầu tiên" → `/lessons/new`; nút ghost "Xem mẫu câu" → `/patterns`.
- **Trang vở buổi gần nhất (NotebookPage)**:
  - `dateLine`: "Buổi {number} · {formatDateVi(date)}"; `title`: `topic`.
  - Tối đa 6 entry (EN purple + VI ink). Nếu còn: dòng ghost "+ {n} mục nữa · Xem cả trang" → `/lessons/:id`. Nếu buổi có 0 mục: dòng mute "Buổi này chưa có mục nào." + ghost "Thêm mục" → `/lessons/:id/edit`.
  - Nếu `lesson.mistakes` khác rỗng: **trong** trang vở, là `.entry` cuối body (component `MistakesNote inline`): nhãn "Lỗi hay gặp:" (red, gạch chân 1px đỏ) + nội dung ink, line-height 48 (snap lo khi wrap). KHÔNG viền trái. (Direction contract: "a red common-mistake note" trên trang.)
  - `remark` (Charm, duy nhất trên màn): nếu `todayDone && goalReached` → "Tốt lắm!"; else nếu `streak.current >= 7` → "Đều đặn lắm!"; else `null`.
  - Dưới trang: ghost "Ghi buổi mới" → `/lessons/new`.
  - Rỗng (không có buổi nào): NotebookPage không title, nội dung EmptyState bên trong trang: "Trang vở còn trống." / "Sau buổi học đầu tiên, ghi lại từ và mẫu câu ở đây. Mỗi mục sẽ tự thành thẻ ôn." / primary "Ghi buổi học".
- Lỗi: không có lỗi riêng (dữ liệu từ snapshot).
- Không hỗ trợ TTS: dòng phụ của khối đến hạn thêm "· {k} thẻ nghe tạm ẩn" khi có thẻ `listen` bị loại.

**(5) Quy tắc.** `queue` tính lại mỗi khi snapshot đổi và khi quay lại trang (dùng `now = new Date()` khi render, không cache qua ngày). Chỉ 1 Remark. Số lớn luôn là số thẻ sẽ gặp nếu bấm "Ôn ngay" (gồm thẻ mới trong hạn mức).

**(6) Microcopy.** Như (4). Tiêu đề tài liệu "Hôm nay · Vở Tiếng Anh". `aria-label` cho số lớn: "{n} thẻ đến hạn".

**(7) Tiêu chí chấp nhận.**
- [ ] Số lớn = `buildQueue().length` (kiểm tra với 0, 1, 24, và khi vượt giới hạn 15 thẻ mới).
- [ ] "khoảng {m} phút" = `ceil(n*20/60)`; n=24 → 8.
- [ ] Danh sách khó nhất ≤ 3 dòng, chỉ dòng "quên" màu đỏ, bấm dòng mở đúng buổi.
- [ ] Trang vở hiện đúng buổi mới nhất theo `date desc, number desc`, tối đa 6 entry, EN có `lang="en"`.
- [ ] "Lỗi hay gặp" không có border-left; nhãn đỏ gạch chân.
- [ ] Chỉ 1 phần tử dùng font Charm trên màn; không có khi chưa đạt điều kiện.
- [ ] 3 trạng thái rỗng/đã xong/bình thường hiển thị đúng theo dữ liệu.
- [ ] Ở 390px: khối đến hạn trước, trang vở sau; số lớn 72px; không tràn ngang.

**(8) Task:** T12.

**(9) T20 — đa ngôn ngữ (chi tiết 6.14):** `filter = settings.study_language`; `langOf = itemLanguageResolver(lessons)`; `speakable = (L) => tts.canSpeakLang(L)`. `queue`, `hardestCards`, `hiddenListenCount` nhận `{ language: filter === 'all' ? undefined : filter, langOf, speakable }`. `latestLesson` = buổi mới nhất **trong ngôn ngữ lọc** (Tất cả → như cũ). Dòng 14px dưới nút "Ôn ngay" thêm hậu tố " · {Tên ngôn ngữ}" khi lọc (vd "Hôm nay: 4/15 phút · chuỗi 3 ngày · Tiếng Trung"). Trạng thái **chưa có thẻ** khi lọc và không có thẻ của ngôn ngữ đó (nhưng vở có thẻ ngôn ngữ khác): dòng phụ "Chưa có thẻ {tên ngôn ngữ} nào. Ghi buổi học hoặc thêm mẫu câu {tên ngôn ngữ}." + primary "Ghi buổi học" (`/lessons/new`, form mặc định ngôn ngữ lọc) + ghost "Học tất cả ngôn ngữ" (→ `saveSettings({ study_language: 'all' })`, toast "Đã lưu."). Câu trên trang vở mang `lang={LANG_TAG[latest.language]}`; dòng "3 thẻ khó nhất" mang `lang` theo ngôn ngữ của từng item. Không thêm nút/chip nào khác vào viewport đầu.

---

### 6.4 Nhật ký buổi học — danh sách `/lessons` (`routes/Lessons.tsx`)

**(1) Mục đích.** Xem các buổi đã ghi, mở một buổi, tạo buổi mới. Là người học, sau giờ học tôi muốn thêm buổi hôm nay trong 1 chạm và tìm lại buổi cũ theo số/ngày.

**(2) Luồng.** Mở `/lessons` → danh sách sắp theo `date desc, number desc` → bấm hàng → `/lessons/:id`. Nút "Ghi buổi mới" (primary, góc trên phải; mobile: dưới H1 full-width) → `/lessons/new`.

**(3) Dữ liệu.** Mỗi hàng: "Buổi {number}", `formatDateVi(date)`, `topic`, "{n} mục", "{d} thẻ đến hạn" (nếu d>0, mute). n = items của buổi; d = thẻ đến hạn của các item đó.

**(4) Trạng thái.**
- Danh sách: card trắng, mỗi hàng tách bằng đường kẻ 1px, cao ≥ 64px, toàn hàng là link. Cột: trái "Buổi {n}" 15px purple 600 + ngày 14px mute dưới; giữa topic 17px ink 500; phải "{n} mục" 14px mute (+ " · {d} đến hạn" nếu có). Mobile xếp dọc trong hàng.
- Rỗng: EmptyState "Chưa có buổi học nào." / "Mỗi buổi học là một trang vở. Ghi lại từ, cụm và mẫu câu giáo viên dạy; chúng sẽ tự thành thẻ ôn." / primary "Ghi buổi học đầu tiên".
- Loading/lỗi: từ snapshot.

**(5) Quy tắc.** Không phân trang (≤ 200 buổi). Không tìm kiếm ở MVP.

**(6) Microcopy.** H1 "Nhật ký buổi học". Nút "Ghi buổi mới". Nhãn hàng như (3).

**(7) Tiêu chí chấp nhận.**
- [ ] Thứ tự đúng `date desc, number desc`.
- [ ] Hàng là link, có focus ring, tối thiểu 44px cao; bấm mở đúng buổi.
- [ ] Rỗng hiển thị EmptyState; nút dẫn tới `/lessons/new`.
- [ ] Số mục và số đến hạn đúng.

**(8) Task:** T08.

**(9) T20 — nhãn ngôn ngữ:** danh sách **không lọc** theo "Ngôn ngữ đang học" (nhật ký là của cả vở). Khi `languagesInUse(lessons).length > 1`, mỗi hàng thêm chữ 14px mute "{Tên ngôn ngữ}" (vd "Tiếng Trung") sau ngày, dạng chữ thường như StatusMark — không badge, không màu. Một ngôn ngữ duy nhất → không hiện gì (màn không đổi so với trước T20). `topic` giữ `lang` mặc định (chủ đề thường gõ tiếng Việt).

---

### 6.5 Trang buổi học (xem) — `/lessons/:id` (`routes/LessonView.tsx`)

**(1) Mục đích.** Đọc lại một buổi như một trang vở: ngày, chủ đề, các mục trên dòng kẻ, câu hỏi cho giáo viên, lỗi hay gặp. Từ đây sửa, ôn riêng buổi này, hoặc shadowing câu trong buổi.

**(2) Luồng.** Mở → NotebookPage. Hành động trên đầu trang (ngoài trang vở, hàng nút): "Ôn buổi này" (secondary → `/review?lesson=:id`), "Shadowing" (secondary → `/shadowing?lesson=:id`), "Sửa" (primary → `/lessons/:id/edit`). Mỗi entry có `SpeakButton` (nghe EN). Cuối trang, tách bằng khoảng trống 32px và đường kẻ: nút danger "Xoá buổi học" → ConfirmDialog → xoá → toast "Đã xoá buổi {n}." → `/lessons`.

**(3) Dữ liệu.** Lesson + items (theo `position`) + cards của items (để hiện trạng thái). Không có id → NotFound.

**(4) Trạng thái.**
- NotebookPage: `dateLine` "Buổi {n} · {ngày}", `title` topic. Mỗi entry: EN purple (26px/48px) + VI ink; dòng phụ dưới (14px mute, vẫn trên lưới): IPA (nếu có) · note (nếu có) · StatusMark của thẻ en_vi ("mới"/"đang học"/"quên k lần"/"đã thuộc" khi `fsrs.stability >= 21`). Kind hiện bằng chữ nhỏ mute trước EN? **Không** — kind chỉ dùng để lọc/sắp; không hiển thị.
- Sau danh sách mục: nếu `questions` khác rỗng: nhãn 13px uppercase mute "Hỏi giáo viên" + nội dung 16px ink (giữ xuống dòng, `white-space: pre-wrap`). Nếu `mistakes` khác rỗng: đoạn với nhãn "Lỗi hay gặp:" đỏ gạch chân + nội dung ink; hỗ trợ cú pháp `*từ*` → render `<em>` với `text-decoration: underline wavy var(--red)`, không in nghiêng. Nếu `notes` khác rỗng: nhãn "Ghi chú" + nội dung.
- `remark`: `null` ở màn này (tránh lạm dụng; Hôm nay đã có). Ngoại lệ: không.
- Rỗng mục: dòng mute "Chưa có mục nào." + ghost "Thêm mục" → edit.
- Xoá: ConfirmDialog tiêu đề "Xoá buổi {n}?" mô tả "Buổi học, {k} mục và toàn bộ thẻ ôn của chúng sẽ bị xoá. Không hoàn tác được." nút "Huỷ" / "Xoá buổi học".

**(5) Quy tắc.** Xoá cascade items → cards → logs (local làm tay; Supabase nhờ FK cascade nhưng client vẫn xoá khỏi state). Nút xoá cách xa nút "Sửa" (ở cuối trang, sau đường kẻ).

**(6) Microcopy.** Như trên. Tiêu đề tài liệu "Buổi {n} · Vở Tiếng Anh".

**(7) Tiêu chí chấp nhận.**
- [ ] Trang vở hiển thị đúng lưới 48px, lề đỏ 1px, EN trên baseline, VI kèm.
- [ ] Nút loa đọc đúng câu EN; không tự phát.
- [ ] "Lỗi hay gặp" đúng kiểu (nhãn đỏ gạch chân, không viền trái); `*từ*` → gạch lượn đỏ.
- [ ] Xoá yêu cầu xác nhận; sau xoá không còn item/card của buổi trong state; chuyển về `/lessons`; toast.
- [ ] Id không tồn tại → NotFound.
- [ ] Không có Charm trên màn này.

**(8) Task:** T08.

**(9) T20 — ngôn ngữ của trang:** `L = lesson.language`. `dateLine` thêm " · {Tên ngôn ngữ}" chỉ khi vở có > 1 ngôn ngữ. Câu đích `lang={LANG_TAG[L]}`, phiên âm `lang={ROMAN_TAG[L]}`; `SpeakButton lang={L}` cho từng mục (ẩn khi `!canSpeakLang(L)`; khi đó đầu trang hiện 1 dòng Info "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn đọc được phiên âm." — thay cho câu "Trình duyệt này không đọc được câu mẫu…" nếu Web Speech có nhưng thiếu giọng). "Nghe cả trang" (6.12) dùng `buildReadAloudSteps(items, includeVi, L)` → bước đích có `lang: L`; điều kiện hiện nút **giữ như T19** (`viAvailable`) **và** thêm `canSpeakLang(L)` — thiếu giọng đích thì ẩn nút (không đọc nửa trang). Nút "Ôn buổi này" và "Shadowing" không đổi (phạm vi buổi đã xác định ngôn ngữ).

---

### 6.6 Tạo / sửa buổi học — `/lessons/new`, `/lessons/:id/edit` (`routes/LessonEdit.tsx`)

**(1) Mục đích.** Ghi nhanh nội dung buổi học trên laptop hoặc điện thoại; mỗi mục thành thẻ ôn. Là người học, tôi muốn gõ liên tục EN–VI từng dòng, Enter để xuống dòng mới, lưu một lần.

**(2) Luồng.**
- Chính (tạo): mở `/lessons/new` → form điền sẵn `number = nextLessonNumber()`, `date = today`, 3 hàng mục trống → nhập topic, các mục → "Lưu buổi học" → tạo lesson, items (bỏ hàng trống hoàn toàn), 1 thẻ `en_vi`/item → toast "Đã lưu buổi {n}. {k} thẻ ôn mới." → `/lessons/:id`.
- Chính (sửa): form điền dữ liệu → sửa → "Lưu" → cập nhật lesson; item mới → tạo + thẻ; item đổi nội dung → cập nhật (giữ FSRS); item bị xoá → xoá cascade (có xác nhận nếu thẻ đã từng ôn) → `/lessons/:id`.
- Phụ: validation lỗi → cuộn tới trường lỗi đầu tiên, focus. "Huỷ" → quay lại (nếu có thay đổi → ConfirmDialog "Bỏ thay đổi?"). Rời trang bằng nav khi có thay đổi → `useBlocker` hỏi tương tự; `beforeunload` khi đóng tab.
- Thêm hàng: nút ghost "Thêm mục" (+); Enter ở ô VI của hàng cuối → thêm hàng mới và focus vào EN của nó. Xoá hàng: icon `X` (aria-label "Xoá mục {i}") ở cuối hàng, màu mute (không đỏ vì chưa phải hành động phá hủy dữ liệu đã lưu); nếu hàng ứng với item đã có thẻ `reps > 0` → ConfirmDialog "Xoá mục này? Thẻ ôn và lịch sử của nó cũng bị xoá."

**(3) Dữ liệu & validation.**

| Trường | Kiểu | Bắt buộc | Quy tắc | Lỗi |
|---|---|---|---|---|
| `number` | số nguyên | có | 1–999; duy nhất theo user (trừ chính nó khi sửa) | "Số buổi phải từ 1 đến 999." / "Đã có buổi số {n}." |
| `date` | `YYYY-MM-DD` (input type=date) | có | hợp lệ; không quá hôm nay + 1 ngày | "Chọn ngày học." / "Ngày không hợp lệ." |
| `topic` | text | có | trim 1–80 | "Nhập chủ đề buổi học." / "Chủ đề tối đa 80 ký tự." |
| `items[i].kind` | select word/phrase/pattern | có | mặc định `phrase` | — |
| `items[i].en` | text | có nếu hàng không trống | trim 1–200 | "Nhập tiếng Anh." |
| `items[i].vi` | text | có nếu hàng không trống | trim 1–200 | "Nhập nghĩa tiếng Việt." |
| `items[i].ipa` | text | không | ≤120 | "Tối đa 120 ký tự." |
| `items[i].note` | text | không | ≤200 | "Tối đa 200 ký tự." |
| `questions` | textarea | không | ≤1000 | "Tối đa 1000 ký tự." |
| `mistakes` | textarea | không | ≤500 | "Tối đa 500 ký tự." |
| `notes` | textarea | không | ≤2000 | "Tối đa 2000 ký tự." |

Hàng "trống hoàn toàn" = cả en, vi, ipa, note đều rỗng → bỏ qua, không lỗi. Hàng có en mà thiếu vi (hoặc ngược lại) → lỗi tại ô thiếu. Trùng `en` (so sánh `normalizeAnswer`) trong cùng buổi → cảnh báo mute "Mục này trùng với dòng {j}" nhưng vẫn cho lưu. `position` = thứ tự hàng sau khi bỏ hàng trống.

**(4) Trạng thái.**
- Form trong card trắng, tối đa 760px. Phần đầu: hàng 2 cột "Buổi số" (input number, rộng 120px) và "Ngày" (date); dưới là "Chủ đề" full-width.
- Khối "Mục trong buổi": bảng dạng hàng, mỗi hàng là nhóm có `fieldset` ẩn legend "Mục {i}": select Kind (rộng 120px: "Từ"/"Cụm"/"Mẫu câu"), input EN (`lang="en"`, placeholder "Can I have the bill, please?"), input VI (placeholder "Cho tôi tính tiền"), nút ghost "Thêm phiên âm / ghi chú" mở 2 input phụ IPA (placeholder "/kæn aɪ hæv ðə bɪl/") và Ghi chú (placeholder "Lỗi hay mắc, cách dùng…"); nút X. Mobile: EN và VI xếp dọc. Hàng cách nhau bằng đường kẻ 1px.
- Khối "Hỏi giáo viên" (textarea 3 dòng, placeholder "Những gì chưa rõ, để hỏi buổi sau"), "Lỗi hay gặp" (textarea 2 dòng, mô tả phụ: "Bọc từ cần nhấn bằng dấu *, ví dụ: quên âm cuối /t/ trong *get*, *it*"), "Ghi chú" (textarea 3 dòng).
- Thanh hành động cuối form (sticky dưới trên mobile, trên thanh tab): "Huỷ" (secondary) · "Lưu buổi học"/"Lưu" (primary). Khi đang lưu: nút disabled + "Đang lưu…".
- Lỗi: tổng hợp trên đầu "Có {n} chỗ cần sửa." (red, `role="alert"`) + lỗi từng trường.
- Lưu thất bại mạng: dữ liệu vẫn vào state và hàng đợi; vẫn điều hướng tới trang xem; toast "Chưa lưu được. Sẽ tự thử lại khi có mạng."
- Rỗng: không áp dụng. Loading: từ snapshot; `:id` không có → NotFound.

**(5) Quy tắc.** `nextLessonNumber = max(number) + 1` (1 nếu chưa có). Mỗi item mới → đúng 1 thẻ en_vi (4.3). Không sinh lại thẻ cho item đã có. Thứ tự lưu trên Supabase: lesson → items → cards (nếu lỗi giữa chừng, op còn lại vào hàng đợi). Tạo id bằng `crypto.randomUUID()` ở client để thao tác lạc quan.

**(6) Microcopy.** H1 "Ghi buổi học" / "Sửa buổi {n}". Nhãn như (4). Toast lưu: "Đã lưu buổi {n}. {k} thẻ ôn mới." (k=0 → "Đã lưu buổi {n}."). Dialog bỏ thay đổi: "Bỏ thay đổi?" / "Những gì bạn vừa nhập sẽ mất." / "Ở lại" / "Bỏ thay đổi" (danger). Mô tả phụ dưới "Mục trong buổi": "Mỗi mục sẽ thành một thẻ ôn Anh → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau."

**(7) Tiêu chí chấp nhận.**
- [ ] Mở `/lessons/new` có sẵn số buổi kế tiếp, ngày hôm nay (Asia/Ho_Chi_Minh), 3 hàng trống.
- [ ] Enter ở ô VI hàng cuối → thêm hàng mới, focus EN hàng mới; Enter ở ô khác không submit nhầm.
- [ ] Lưu với hàng trống hoàn toàn → bỏ qua, không lỗi; hàng chỉ có EN → lỗi ở VI.
- [ ] Lưu tạo đúng số item và đúng số thẻ en_vi (1/item), `position` theo thứ tự.
- [ ] Sửa en/vi của item có thẻ đã ôn → `fsrs`, `due`, `reps` thẻ không đổi.
- [ ] Xoá hàng của item có `reps > 0` → hỏi xác nhận; item chưa ôn → xoá không hỏi; sau lưu thẻ liên quan biến mất.
- [ ] Trùng số buổi → lỗi, không lưu.
- [ ] Có thay đổi mà điều hướng đi → hộp "Bỏ thay đổi?".
- [ ] 390px: thanh hành động không che ô nhập cuối; mọi input cao ≥ 44px.

**(8) Task:** T08. Nút "Dán danh sách" (nhiều dòng → nhiều hàng mục) đặc tả ở 6.13-A (T18a).

**(9) T20 — chọn ngôn ngữ buổi học (chi tiết 6.14 (2)-A, (3), (4)):**
- Hàng đầu form thành 3 cột "Buổi số" (120px) · "Ngày" · **"Ngôn ngữ"** (select 4 option "Tiếng Anh/Trung/Nhật/Hàn", rộng 160px; mobile xuống dòng riêng full-width). Mặc định khi tạo: `study_language !== 'all'` → ngôn ngữ đó; ngược lại → ngôn ngữ của buổi gần nhất (`sortLessons(lessons)[0]?.language`); không có buổi nào → `'en'`.
- **Khoá**: khi sửa buổi mà có ≥ 1 thẻ của buổi có `reps > 0` → select `disabled` + mô tả "Buổi này đã có thẻ được ôn nên không đổi ngôn ngữ được." (Lý do: lịch sử FSRS/log và thống kê theo ngôn ngữ của thẻ đã ôn gắn với ngôn ngữ cũ; đổi sẽ làm giọng đọc, nhãn chiều và thống kê sai lệch so với những gì người dùng đã học.) Chưa có thẻ nào được ôn → đổi tự do, kể cả đã có item.
- Nhãn/placeholder hàng mục đổi theo ngôn ngữ đang chọn (6.14 (6)): nhãn ô đích "Tiếng Anh/Tiếng Trung/Tiếng Nhật/Tiếng Hàn", `lang={LANG_TAG[L]}`, `autoCapitalize` chỉ `sentences` với `en`, còn lại `off`; nhãn phiên âm **"Phiên âm"** cho mọi ngôn ngữ, `lang={ROMAN_TAG[L]}`, placeholder theo ngôn ngữ. Lỗi thiếu ô đích: "Nhập tiếng Anh." / "Nhập tiếng Trung." / "Nhập tiếng Nhật." / "Nhập tiếng Hàn." (`validateItem(input, { language })`, mặc định `'en'` → test cũ giữ nguyên).
- Mô tả dưới "Mục trong buổi": "Mỗi mục sẽ thành một thẻ ôn {Ngắn} → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau." với `{Ngắn}` = Anh/Trung/Nhật/Hàn.
- Lưu: `lesson.language` đi cùng `upsertLesson`; items/cards không đổi. Đổi select khi form đã có hàng → form *dirty*, không hỏi gì.
- "Dán danh sách": `parsePastedList(text, language)` — quy tắc phần 3 theo ngôn ngữ ở 6.14 (3)-E; mô tả/placeholder panel đổi theo ngôn ngữ.

---

### 6.7 Ôn thẻ — `/review` (`routes/Review.tsx`)

**(1) Mục đích.** Phiên ôn ngắn, rõ ràng: mặt trước → lật → chấm 4 mức; nghe phát âm; 3 chiều EN→VI, VI→EN, nghe→gõ. Là người học, tôi muốn xong phần ôn trong vài phút trên điện thoại, bằng một tay.

**(2) Luồng.**
- Chính: vào `/review` → `buildQueue` → hiện thẻ 1/N mặt trước → "Lật thẻ" (hoặc Space) → mặt sau + 4 nút chấm (1–4) → chọn → lưu (gradeCard + addReviewLog + addStudyTime + unlock + requeue) → thẻ kế → … → màn tổng kết.
- Chiều `en_vi`: trước = EN lớn (36px purple) + SpeakButton; sau = thêm VI (20px ink), IPA (mute), note, và nguồn "Buổi {n} · {topic}" (link) hoặc "Mẫu câu · {tình huống}".
- Chiều `vi_en`: trước = VI lớn (28px ink) + gợi ý mute "Nói to câu tiếng Anh rồi lật thẻ"; sau = EN lớn purple + SpeakButton + IPA.
- Chiều `listen`: trước = nút lớn "Nghe" (icon `Volume2`, secondary lg, tự phát **không**), ô nhập "Gõ lại câu bạn nghe" (input `lang="en"`, autocapitalize off, autocorrect off), nút "Nghe lại", nút "Kiểm tra" (primary; Enter cũng kiểm tra) — thay cho "Lật thẻ". Sau = EN purple + dòng kết quả: `exact` → "Đúng rồi." (ink), `close` → "Gần đúng." + hiển thị câu người dùng gõ (mute, gạch ngang phần sai không cần — chỉ hiện 2 dòng: "Bạn gõ: …" / "Đáp án: …"), `wrong` → "Chưa đúng." (red) + 2 dòng tương tự; VI + IPA; rồi 4 nút chấm. Người dùng tự chấm.
- `?lesson=:id` → chế độ "Ôn buổi {n}" (tiêu đề đổi), queue theo 4.4 bước 2.
- Phụ: queue rỗng ngay khi vào → trạng thái "Không có thẻ để ôn". Thoát giữa phiên (bấm "Dừng" hoặc nav) → không hỏi; mọi thẻ đã chấm đã lưu. Quay lại → phiên mới từ queue hiện tại.
- Sau khi chấm thẻ `en_vi` đủ điều kiện 4.3 → tạo 2 thẻ mới; hiện toast nhẹ "Đã mở thêm 2 chiều ôn cho "{en}"." (tối đa 1 toast/phiên để không làm phiền; những lần sau im lặng).

**(3) Dữ liệu.** Thẻ hiện tại, item, lesson/situation nguồn; `startedAt` khi hiện mặt trước; `grade` 1–4; `previewIntervals`. Phiên: `queue: Card[]`, `index`, `seenCount: Map<cardId, number>`, `doneCount`, `againCount`, `sessionSeconds`.

**(4) Trạng thái.**
- Loading: Spinner "Đang xếp thẻ…" (chờ `getScheduler()`), ≤ 1 giây.
- Bố cục: card trắng giữa trang, rộng tối đa 720px, cao tối thiểu 360px; trên cùng hàng meta 14px mute: trái "Thẻ {i}/{N}" (i = số đã chấm + 1, N = queue.length hiện tại kể cả requeue), phải nút ghost "Dừng" (→ `/`). Giữa: nội dung thẻ căn giữa. Dưới: vùng nút.
- Chiều ôn hiện trong hàng meta cùng tiến độ: "Thẻ 1/3 · Anh → Việt" 14px mute chữ thường (không uppercase, không eyebrow trên câu EN — đổi sau review T11). Nút "Nghe"/"Nghe lại" gộp thành một nút đổi nhãn.
- Nút lật: primary lg full-width (mobile) / 320px (desktop) "Lật thẻ".
- 4 nút chấm (hàng ngang, bằng nhau, cao 56px, gap 8px; mobile 2×2 nếu < 360px): "Quên" (danger), "Khó" (secondary), "Nhớ" (primary), "Dễ" (secondary). Dưới mỗi nút dòng 13px mute khoảng cách dự báo (`previewIntervals`), ví dụ "<10 phút", "1 ngày", "4 ngày", "2 tuần". `aria-keyshortcuts="1"`… Dòng gợi ý phím 13px mute dưới (chỉ desktop, `pointer: fine`): "Phím 1–4 để chấm · Space để lật · S để nghe".
- Đang lưu: nút chấm disabled ~100ms; không spinner.
- TTS không hỗ trợ: SpeakButton ẩn, thay bằng chữ mute "Trình duyệt này không đọc được." Thẻ listen đã bị loại khỏi queue (4.4) — hiện 1 dòng thông tin ở đầu phiên "Đã tạm ẩn {k} thẻ nghe vì trình duyệt không hỗ trợ đọc. Thử Chrome hoặc Edge." (Info icon purple).
- Rỗng: EmptyState trong card: "Không có thẻ nào đến hạn." / "Bạn có thể ôn thêm buổi gần nhất, hoặc luyện shadowing." / primary "Shadowing" (→ `/shadowing`), ghost "Ôn buổi gần nhất" (nếu có buổi). Khi `cards.length === 0`: "Chưa có thẻ nào." / "Ghi buổi học hoặc thêm mẫu câu để tạo thẻ." / primary "Ghi buổi học", ghost "Xem mẫu câu".
- **Tổng kết** (queue rỗng sau khi chấm ≥ 1): H2 "Xong phiên ôn!" (ink; **không** Charm — Charm chỉ ở Hôm nay); các số liệu dạng hàng kẻ: "{n} thẻ đã ôn", "{m} phút", "{k} thẻ còn quên" (k = số lần chọn Quên; dòng này đỏ chỉ khi k>0, chữ "quên" là trạng thái); "chuỗi {s} ngày". Nút primary "Về Hôm nay", secondary "Shadowing vài câu".
- Lỗi ghi: toast chung (2.4), phiên tiếp tục.

**(5) Quy tắc.** Không tự phát âm (kể cả thẻ listen) trừ khi `settings.auto_speak === true`, và kể cả khi bật cũng chỉ phát **sau khi lật** với en_vi/vi_en, không phát ở mặt trước của listen (người dùng bấm "Nghe"). Mỗi lần chấm là một lần ghi: `upsertCards([card])`, `addReviewLog(log)`, `addStudyTime(today, {seconds, reviews:1})`, và `upsertCards(newSiblings)` nếu mở khoá. `duration_ms` cap 60000. Requeue theo 4.4.6. Không có "Hoàn tác" ở MVP. Nếu `getScheduler()` lỗi → khối lỗi "Không khởi tạo được bộ lập lịch. Tải lại trang." (hiếm).

**(6) Microcopy.** Như (4). Tiêu đề tài liệu "Ôn thẻ · Vở Tiếng Anh". Nút loa aria-label "Nghe phát âm". Placeholder listen: "Gõ lại câu bạn nghe". Nút "Kiểm tra". Trạng thái kiểm tra: "Đúng rồi." / "Gần đúng." / "Chưa đúng."

**(7) Tiêu chí chấp nhận.**
- [ ] Queue đúng 4.4: thẻ đang học trước, đến hạn sau, thẻ mới ≤ 15/ngày tính theo `first_reviewed_at` ngày địa phương.
- [ ] Chấm xong: `cards.fsrs` là object mới từ `scheduler.review`, `due === fsrs.dueAt`, `state/reps/lapses` khớp; `review_logs` có 1 dòng với `rating` đúng, `revlog` là `result.revlog`.
- [ ] Chọn "Quên" → thẻ quay lại trong phiên (≤ 3 lần); "Nhớ" ở thẻ New → quay lại sau bước 10 phút nếu phiên còn dài hoặc không.
- [ ] Thẻ en_vi được ôn hôm qua, hôm nay chấm "Nhớ" → sinh đúng 2 thẻ `vi_en` + `listen` cho item; chấm "Quên" → không sinh; chấm lần 2 trong cùng ngày đầu tiên → không sinh.
- [ ] `study_days[today].seconds` tăng theo thời gian trả lời (≤60s/thẻ), `reviews` tăng 1/lần chấm.
- [ ] Phím 1–4, Space, S hoạt động; không kích hoạt khi focus đang trong ô nhập listen.
- [ ] Không có âm thanh tự phát khi `auto_speak=false`.
- [ ] TTS không hỗ trợ → thẻ listen không xuất hiện, có dòng thông tin.
- [ ] Thoát giữa phiên không mất dữ liệu đã chấm.
- [ ] 390px: 4 nút chấm bấm được bằng một tay, không bị thanh tab che.

**(8) Task:** T09, T10, T11.

**(9) T20 — đa ngôn ngữ (chi tiết 6.14):** `L = langOf(item)` cho thẻ đang hiện. Hàng đợi (`buildQueue`) nhận `language` (từ `study_language`, bỏ qua khi có `?lesson=`), `langOf`, `speakable`. Nhãn chiều trong hàng meta dùng `directionLabel(direction, L)`: "Anh → Việt" / "Trung → Việt" / "Nhật → Việt" / "Hàn → Việt", "Việt → Anh" / "Việt → Trung" / …, "Nghe → gõ" chung. Câu đích `lang={LANG_TAG[L]}`, phiên âm `lang={ROMAN_TAG[L]}`; `SpeakButton lang={L}` (nhãn aria "Nghe phát âm" giữ; nhãn hiển thị cạnh nút VI đổi "Anh" → `LANGUAGE_SHORT[L]`); `auto_speak` đọc câu đích bằng `L`. Ô nhập thẻ `listen`: `lang={LANG_TAG[L]}`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`; so khớp `compareAnswer(input, expected, L)`; gợi ý mute dưới ô với `zh`/`ja`: "Dấu câu và khoảng trắng không tính." Thẻ `listen` của ngôn ngữ thiếu giọng bị loại khỏi hàng đợi (4.4 1b) và tính vào dòng "Đã tạm ẩn {k} thẻ nghe…" với câu mới: "Đã tạm ẩn {k} thẻ nghe vì thiết bị chưa có giọng đọc phù hợp." (thay câu cũ khi Web Speech có nhưng thiếu giọng; thiếu Web Speech → câu cũ). Rỗng khi lọc: "Không có thẻ {tên ngôn ngữ} nào đến hạn." Phím `S` đọc câu đích bằng `L`. Không đổi FSRS, không đổi quy tắc mở khoá.

---

### 6.8 Mẫu câu tình huống — `/patterns`, `/patterns/:situationId` (`routes/Patterns.tsx`, `routes/PatternSituation.tsx`)

**(1) Mục đích.** Kho mẫu câu A1–A2 theo 9 tình huống, có ô trống, IPA, lưu ý phát âm người Việt; thêm vào thẻ ôn bằng một chạm; luyện shadowing ngay. Là người học, tôi muốn trước khi đi ăn/đi sân bay xem nhanh 10 câu và lưu lại câu mình cần.

**(2) Luồng.**
- `/patterns`: danh sách 9 tình huống → bấm → `/patterns/:situationId`.
- `/patterns/:situationId`: trang vở với các mẫu câu; mỗi câu: SpeakButton; nút "Thêm vào thẻ ôn" (secondary md, icon `Plus`) → tạo item `kind='pattern', lesson_id=null, pattern_id=p.id, en/vi = fillPattern(p,0), ipa = p.ipa, note = p.note ?? ''` + 1 thẻ en_vi → nút đổi thành trạng thái "Đã thêm" (icon `Check`, disabled, mute). Nút ghost "Shadowing" → `/shadowing?pattern={p.id}`.
- "Thêm cả tình huống ({k} câu chưa thêm)" (secondary) ở đầu trang → ConfirmDialog nhẹ? **Không cần** (không phá hủy) → thêm k câu → toast "Đã thêm {k} mẫu câu vào thẻ ôn."
- Bấm vào ô trống → hiển thị gợi ý ví dụ (xem (4)). Không có chỉnh sửa mẫu câu.

**(3) Dữ liệu.** `SITUATIONS` từ `src/data/patterns.ts`; `addedPatternIds = Set(items.filter(i => i.pattern_id).map(pattern_id))`.

**(4) Trạng thái.**
- `/patterns`: H1 "Mẫu câu tình huống"; mô tả 16px mute "Câu ngắn A1–A2 theo tình huống thật. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay." Card trắng, 9 hàng kẻ 1px, cao ≥ 64px, toàn hàng là link: icon lucide (map từ `situation.icon`) purple + "{nameVi}" 17px ink 500 + `<span lang=en>` "{nameEn}" 14px mute + phải "{đã thêm}/{tổng} đã thêm" 14px mute (ẩn khi 0 đã thêm, chỉ hiện "{tổng} câu").
- `/patterns/:situationId`: hàng trên: link ghost "← Mẫu câu" ; H1 "{nameVi}" + `<span lang=en>` nameEn 16px mute; đoạn intro 16px ink; đoạn "Lưu ý phát âm:" (nhãn đỏ gạch chân) + `pronunciationFocus` ink; nút "Thêm cả tình huống ({k} câu)" (ẩn khi k=0 → thay bằng chữ mute "Đã thêm cả tình huống."). Rồi NotebookPage (không dateLine/title/remark): mỗi pattern là một khối trên lưới:
  - Dòng EN 26px/48px purple: render bằng `splitPattern(p.en)`; phần slot hiển thị là `____` với `border-bottom: 1px solid var(--purple)` thay vì chữ gạch dưới (giữ ngay hàng), là `<button>` nhỏ (aria-label "Gợi ý cho ô trống {hint}") mở/đóng dòng gợi ý.
  - VI 17px ink (`blankPattern(p.vi)`): **desktop inline** sau EN (cách 12px, cùng line box 48px như `.entry`); mobile xuống dòng riêng 24px. (Cập nhật sau review T13 — bố cục gọn theo tinh thần trang vở.)
  - Dòng gợi ý (ẩn mặc định; mở khi bấm ô trống): 14px mute "{hint}: " + các ví dụ `en — vi` phân tách bằng " · ". Nút ô trống có `lang="vi"`, `aria-expanded`, `aria-controls`; vùng chạm ≥44px (pseudo-element).
  - **Một dòng meta 14px** line-height 24: IPA mute · "A1"/"A2" · (nếu `p.note`) "Lưu ý phát âm:" đỏ gạch chân + note ink. Dòng wrap thì khối được `.entry` snap.
  - Hàng nút 44px (gap 8px): SpeakButton (đọc `fillPattern(p,0).en`, label "Nghe: {EN}"), "Thêm vào thẻ ôn" (đã thêm → nhãn `<span>` "Đã thêm" với icon Check, mute, không phải button disabled), Shadowing: chỉ icon `Mic` 44×44 `aria-label="Luyện shadowing"` ở mọi độ rộng (có chữ thì cột nút quá rộng ở 1440, VI phải xuống dòng). Desktop ≥1024 hàng nút nằm bên phải dòng EN (`space-between`) → khối ≈144px.
  - Mỗi khối là `<li class="pattern-block entry">` để NotebookPage làm tròn lên bội số 48px; khối cách nhau 1 dòng trống (48px).
  - Chống thêm trùng: `addPatternItems` lọc theo snapshot **và** tập in-flight, trả về số thực thêm; toast dùng số này (0 → không toast).
- Situation id sai → NotFound.
- Loading/lỗi: dữ liệu tĩnh; thêm thẻ thất bại mạng → toast chung; nút vẫn hiện "Đã thêm" (lạc quan).
- TTS không hỗ trợ: ẩn SpeakButton, hiện 1 dòng thông tin ở đầu trang (Info).

**(5) Quy tắc.** Không thêm trùng (`pattern_id` unique theo user; UI disabled). Thẻ sinh ra là New và đi vào hạn mức 15/ngày bình thường. Item từ thư viện không thuộc buổi nào (`lesson_id = null`), không hiện trong Nhật ký buổi học; nguồn trên thẻ ôn hiện "Mẫu câu · {nameVi}".

**(6) Microcopy.** Như (4). Toast: "Đã thêm vào thẻ ôn." / "Đã thêm {k} mẫu câu vào thẻ ôn." Tiêu đề tài liệu "Mẫu câu · Vở Tiếng Anh" / "{nameVi} · Vở Tiếng Anh".

**(7) Tiêu chí chấp nhận.**
- [ ] 9 tình huống, tổng số câu = `PATTERN_COUNT`; đếm "đã thêm" đúng theo `items.pattern_id`.
- [ ] Thêm 1 câu → 1 item (`kind='pattern'`, `lesson_id=null`, `pattern_id` đúng, en/vi đã điền ví dụ đầu) + 1 thẻ `en_vi`; nút chuyển "Đã thêm" và không thêm lần 2 (kể cả reload).
- [ ] "Thêm cả tình huống" chỉ thêm câu chưa có; toast đúng số.
- [ ] Ô trống hiển thị là gạch tím ngang hàng, bấm mở gợi ý với đúng ví dụ.
- [ ] Nút loa đọc câu đã điền (vd "Good morning!"), không đọc "{time}".
- [ ] "Lưu ý phát âm" là nhãn đỏ gạch chân, không viền trái, không nền màu.
- [ ] Id sai → NotFound.

**(8) Task:** T13.

**(9) T20 — kho mẫu câu nhiều ngôn ngữ (chi tiết 6.14 (2)-D, (3)-F, (4)):** `Situation.language` (9 tình huống hiện có = `'en'`; thêm 12 tình huống khởi đầu zh/ja/ko — 6.14 (3)-F). `/patterns`: lọc theo `study_language`; **Tất cả** → nhóm theo ngôn ngữ: mỗi nhóm một card với `<h2>` 20px ink "Tiếng Anh" (9 hàng) · "Tiếng Trung" (4) · "Tiếng Nhật" (4) · "Tiếng Hàn" (4), thứ tự `LANGUAGES`; một ngôn ngữ → một card không heading nhóm (giống trước T20). Dòng tình huống: `nameTarget ?? nameEn` 14px mute với `lang={LANG_TAG[s.language]}`. Mô tả đầu trang: "Câu ngắn theo tình huống thật, bằng ngôn ngữ bạn đang học. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay." `/patterns/:situationId`: câu đích `lang={LANG_TAG}`, phiên âm `lang={ROMAN_TAG}` (không bắt buộc dạng `/…/` với zh/ja/ko), `SpeakButton lang={s.language}` (ẩn + dòng Info "Thiết bị chưa có giọng {tên}…" khi thiếu giọng), nút Shadowing → `/shadowing?pattern=…` như cũ. Item thêm từ thư viện: không đổi (`lesson_id=null`, `pattern_id`); ngôn ngữ suy ra qua `situationOfPattern`. Tổng seed `PATTERN_COUNT = 87 + 60 = 147`.

---

### 6.9 Shadowing — `/shadowing` (`routes/Shadowing.tsx`)

**(1) Mục đích.** Nghe một câu mẫu, nói theo và ghi âm, nghe lại cả hai để tự so; đổi tốc độ 0.5/0.75/1x. Riêng tư: bản ghi chỉ ở trong bộ nhớ phiên, không tải lên. Là người ngại nói, tôi muốn luyện một mình, nghe lại giọng mình và thử lại.

**(2) Luồng.**
- Chọn nguồn câu: tab/segmented "Buổi gần nhất" (mặc định; hoặc `?lesson=:id` → buổi đó) · "Mẫu câu" (chọn tình huống trong select) · nếu có `?item=:id` hoặc `?pattern=:id` → chọn sẵn câu đó.
- Danh sách câu (desktop: cột trái 320px, hàng kẻ 1px; mobile: select "Câu đang luyện" phía trên) → chọn câu → khu luyện.
- Khu luyện: câu EN lớn 32px purple (`lang=en`), VI 17px ink, IPA 15px mute. Hàng tốc độ: segmented 3 nút "0.5x" "0.75x" "1x" (`role="radiogroup"`, mặc định 0.75x; nhớ trong `sessionStorage`). Nút "Nghe mẫu" (secondary lg, icon `Volume2`) → TTS với `rate`. Nút "Ghi âm" (primary lg, icon `Mic`) → bắt đầu ghi, nút đổi thành "Dừng" (danger? **Không** — dừng không phá hủy; dùng primary với icon `Square` và chữ "Dừng ghi"), hiển thị đồng hồ "0:07" và chấm đỏ nhỏ 8px nhấp nháy (đây là ngoại lệ đỏ hợp lệ: cảnh báo đang ghi âm; tắt nhấp nháy khi `prefers-reduced-motion`). Tự dừng ở 15 giây.
- Sau khi có bản ghi: hàng nút "Nghe mẫu" · "Nghe giọng bạn" (secondary, icon `Play`) · "Nghe lần lượt" (ghost: phát mẫu rồi phát bản ghi) · "Ghi lại" (ghost, icon `RotateCcw`). Thời lượng bản ghi hiển thị "Bản ghi của bạn · 0:06".
- "Câu tiếp" / "Câu trước" (ghost) ở dưới; chuyển câu → huỷ bản ghi hiện tại (revoke ObjectURL) không hỏi.
- Thời gian học: `useStudyTimer(active)` theo 4.5; `shadowing += 1` mỗi lần dừng ghi thành công (≥ 1 giây).

**(3) Dữ liệu.** Nguồn câu = items (kind bất kỳ; ưu tiên `phrase`/`pattern` lên trước, `word` sau) của buổi chọn, hoặc `fillPattern(p,0)` của tình huống chọn. Bản ghi: `Blob` + `URL.createObjectURL` trong state; không ghi vào repository, không localStorage. MIME: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → mặc định của trình duyệt (`pickMimeType`).

**(4) Trạng thái.**
- Chưa chọn nguồn có dữ liệu: nếu không có buổi nào và chưa thêm mẫu → mặc định sang "Mẫu câu" với tình huống đầu (`greetings`) — luôn có câu để luyện.
- Idle: chưa ghi. Recording: đồng hồ, nút "Dừng ghi". Recorded: có bản ghi. Playing (mẫu hoặc bản ghi): nút tương ứng đổi icon `Square` và chữ "Dừng", các nút phát khác disabled.
- Quyền micro: `prompt` → bấm "Ghi âm" mới xin quyền (không xin khi vào trang). `denied` → thay nút ghi bằng dòng thông tin: "Trình duyệt đã chặn micro. Mở cài đặt trang để cho phép, rồi tải lại." (Info purple; không đỏ). Lỗi `NotFoundError` (không có mic): "Không tìm thấy micro trên thiết bị này." Lỗi khác: "Không ghi âm được. Thử lại hoặc dùng Chrome/Edge."
- Không hỗ trợ `MediaRecorder` hoặc `getUserMedia`: ẩn toàn bộ phần ghi, hiện: "Trình duyệt này chưa hỗ trợ ghi âm. Bạn vẫn có thể nghe mẫu và nói theo." 
- Không hỗ trợ TTS: ẩn "Nghe mẫu", hiện: "Trình duyệt này không đọc được câu mẫu. Hãy thử Chrome hoặc Edge. Bạn vẫn có thể ghi âm và nghe lại." Nếu cả hai không hỗ trợ: EmptyState "Trình duyệt này chưa hỗ trợ nghe và ghi âm." / "Hãy mở Vở Tiếng Anh bằng Chrome hoặc Edge để luyện shadowing." (không nút).
- iOS Safari: `speechSynthesis.speak` chỉ chạy trong user gesture — luôn gọi trực tiếp trong handler click (không `setTimeout`, không sau `await`). "Nghe lần lượt": phát mẫu trong handler, lắng nghe `utterance.onend` để phát bản ghi (`audio.play()` sau onend được phép vì cùng chuỗi tương tác trên hầu hết trình duyệt; nếu `play()` reject → hiện nút "Phát bản ghi" để bấm).
- Mất mạng: không ảnh hưởng (TTS và ghi âm chạy cục bộ; ghi `study_days` vào hàng đợi).
- Ghi chú riêng tư luôn hiện dưới khu luyện, 14px mute: "Bản ghi chỉ lưu tạm trên thiết bị này trong lúc luyện và không được tải lên."

**(5) Quy tắc.** Không tự phát bất kỳ âm thanh nào khi vào trang hoặc đổi câu. Tối đa 1 bản ghi/câu tại một thời điểm; ghi lại thay thế bản cũ (revoke URL cũ). Rời trang: dừng ghi, dừng TTS (`speechSynthesis.cancel()`), revoke URL, flush timer. Tốc độ áp dụng cho TTS; bản ghi phát 1x. Danh sách câu tối đa 50 (buổi lớn → 50 đầu).

**(6) Microcopy.** H1 "Shadowing". Mô tả: "Nghe câu mẫu, nói theo thật to, ghi âm rồi nghe lại để so." Nhãn nguồn: "Buổi gần nhất" / "Buổi {n}" / "Mẫu câu". Select tình huống label "Tình huống". Select câu (mobile) label "Câu đang luyện". Nút: "Nghe mẫu", "Ghi âm", "Dừng ghi", "Nghe giọng bạn", "Nghe lần lượt", "Ghi lại", "Câu trước", "Câu tiếp". Trạng thái: "Đang ghi… 0:07", "Bản ghi của bạn · 0:06". Rỗng nguồn buổi: "Buổi này chưa có câu nào. Chọn 'Mẫu câu' để luyện." Tiêu đề tài liệu "Shadowing · Vở Tiếng Anh".

**(7) Tiêu chí chấp nhận.**
- [ ] Vào trang không có âm thanh tự phát, không xin quyền micro.
- [ ] "Nghe mẫu" đọc đúng câu với rate 0.5/0.75/1; đổi tốc độ rồi nghe lại thấy khác.
- [ ] "Ghi âm" xin quyền lần đầu; ghi được, tự dừng ở 15s; "Nghe giọng bạn" phát đúng bản ghi; "Ghi lại" thay bản cũ.
- [ ] Không có request mạng nào mang dữ liệu âm thanh (kiểm tra Network tab); không có khoá localStorage chứa audio.
- [ ] Chuyển câu/rời trang → bản ghi bị huỷ, TTS dừng.
- [ ] Từ chối quyền → thông báo đúng, các nút nghe vẫn dùng được.
- [ ] Trình duyệt không MediaRecorder (giả lập bằng cách gán `window.MediaRecorder = undefined` trong console trước khi vào trang) → ẩn phần ghi, có dòng thông tin.
- [ ] Sau 2 phút không thao tác, `study_days.seconds` ngừng tăng; thao tác lại thì tăng tiếp; `shadowing_count` tăng 1 mỗi bản ghi ≥ 1s.
- [ ] `?pattern=ordering-03` chọn sẵn đúng câu; `?lesson=:id` chọn đúng buổi.
- [ ] 390px: danh sách là select; nút ghi âm ≥ 52px cao, nằm trên thanh tab.

**(8) Task:** T14.

**(9) T20 — shadowing theo ngôn ngữ (chi tiết 6.14):** `ShadowSentence` thêm `language: Language`; `lessonSentences` gán theo `lesson.language`, `situationSentences` theo `situation.language`. `resolveSource(lessons, items, params, filter)`: "Buổi gần nhất" = buổi mới nhất **trong ngôn ngữ lọc**; mặc định tình huống = tình huống đầu tiên của ngôn ngữ lọc (`'all'` → `greetings`). Select "Tình huống": lọc theo ngôn ngữ; Tất cả → `<optgroup label="Tiếng Anh">`… theo `LANGUAGES`. `?lesson/?item/?pattern` bỏ qua bộ lọc (nguồn đã xác định). "Nghe mẫu"/"Nghe lần lượt": `tts.speak(sentence.en, { rate, lang: sentence.language })`. Câu lớn `lang={LANG_TAG}`, phiên âm `lang={ROMAN_TAG}`, `.sh-en[lang]` line-height 1.4 với CJK (5.2). Thiếu giọng của ngôn ngữ câu đang luyện (Web Speech có nhưng `!canSpeakLang(L)`): ẩn "Nghe mẫu"/"Nghe lần lượt", hiện Info "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn có thể ghi âm và nghe lại." Server EN (T19) chỉ áp dụng khi `L === 'en'`; dòng "Giọng mẫu: server local." chỉ hiện khi `L === 'en' && enServer`. EmptyState không hỗ trợ: "Hãy mở Vở Ngoại Ngữ bằng Chrome hoặc Edge để luyện shadowing."

---

### 6.10 Tiến độ — `/progress` (`routes/Progress.tsx`)

**(1) Mục đích.** Nhìn lại thói quen: lịch 8 tuần, chuỗi hiện tại và dài nhất, phút hôm nay so với mục tiêu, thống kê thẻ. Là người học, tôi muốn thấy mình đều đặn để có động lực, không bị chấm điểm.

**(2) Luồng.** Mở → xem. Bấm "Đổi mục tiêu" → `/settings`. Bấm một ô ngày → tooltip/`title` "{ngày}: {phút} phút · {reviews} thẻ · {shadowing} bản ghi" (dùng `title` + `aria-label`, không popover phức tạp).

**(3) Dữ liệu.** `studyDays` (120 ngày), `streak()`, `settings.daily_goal_min`, `cardStats(cards, lessons)`: `total`, `new` (state 0), `learning` (state 1/3), `review` (state 2), `mastered` (state 2 và `fsrs.stability >= 21`), `lessonsCount` — đếm cả thẻ suspended; `weekMinutes(studyDays, today)` riêng (tuần hiện tại từ T2); `calendarWeeks(studyDays, today)`.

**(4) Trạng thái.**
- H1 "Tiến độ".
- Khối 1 (card): nhãn 13px "Hôm nay" + dòng 28px/700 ink "{phút} / {mục tiêu} phút" + thanh tiến độ: track 4px `--grid`, fill `--purple`, radius 2px, `role="progressbar"` với `aria-valuenow/max`; dưới: "chuỗi hiện tại {n} ngày · dài nhất {b} ngày · tuần này {w} phút" 15px mute; ghost "Đổi mục tiêu".
- Khối 2 (card): nhãn 13px "8 tuần gần nhất". Lưới 7 cột × 8 hàng, header `T2…CN` 13px mute; ô 40px (mobile 36px), viền 1px `--grid`, radius 6px; trạng thái: `done` (seconds ≥ 60) → nền purple, icon `Check` white 16px; `partial` (0 < s < 60) → nền white, chấm tròn 8px purple ở giữa; `none` → white; `future` → nền `--paper`, viền `--grid`, opacity .55 (.35 quá mờ trên nền trắng — đổi sau review T15); `today` → thêm viền 1px purple (nếu chưa done). Hàng cuối chứa hôm nay. Không dùng màu xanh lá, không heatmap nhiều mức.
- Khối 3 (card): nhãn 13px "Thẻ ôn". Hàng kẻ 1px: "Tổng số thẻ — {total}", "Đã thuộc (ổn định ≥ 3 tuần) — {mastered}", "Đang ôn — {review - mastered}", "Đang học — {learning}", "Chưa bắt đầu — {new}", "Buổi học đã ghi — {lessonsCount}". Số bên phải 17px purple 600.
- Rỗng (chưa học ngày nào, 0 thẻ): các khối vẫn hiện với số 0; dưới khối 1 dòng mute "Học 1 phút là ngày đó được tính vào chuỗi."
- Loading/lỗi: từ snapshot.

**(5) Quy tắc.** Lịch luôn kết thúc ở tuần hiện tại (T2 → CN), 8 hàng = 56 ngày. Ngày tính theo Asia/Ho_Chi_Minh. "Đã thuộc" chỉ là nhãn hiển thị, không ảnh hưởng lịch ôn.

**(6) Microcopy.** Như (4). Tiêu đề tài liệu "Tiến độ · Vở Tiếng Anh". `aria-label` ô: "{Thứ, d/m}: {phút} phút" / "chưa học" / "ngày tới".

**(7) Tiêu chí chấp nhận.**
- [ ] Lịch 7×8, cột đầu là Thứ Hai, ô cuối hàng cuối là Chủ Nhật của tuần hiện tại; hôm nay có viền tím.
- [ ] Ngày có ≥60s → ô tím có dấu check; 1–59s → chấm; 0 → trống; ngày tương lai mờ.
- [ ] Chuỗi: học hôm qua và hôm nay → 2; học hôm qua, hôm nay chưa → vẫn 1 (không đứt); bỏ hôm qua → 0 hoặc bắt đầu lại từ hôm nay.
- [ ] Thanh tiến độ có `role="progressbar"` và đúng tỷ lệ; đạt mục tiêu thì đầy 100%, không vượt.
- [ ] Thống kê thẻ cộng lại đúng `total`.
- [ ] Không dùng màu ngoài tokens; không màu xanh lá.

**(8) Task:** T15.

**(9) T20 — thống kê theo ngôn ngữ:** Khối 1 (hôm nay/chuỗi/tuần) và Khối 2 (lịch 8 tuần) **không lọc** (4.5 bất biến). Khối 3 "Thẻ ôn": `cardStats(cards, lessons, { language?, langOf? })` — khi lọc, chỉ đếm thẻ có `langOf(item) === language` và `lessonsCount` = số buổi `lesson.language === language`; tiêu đề khối thành "Thẻ ôn · {Tên ngôn ngữ}" (chữ thường, không uppercase) và dưới khối dòng 14px mute "Chuỗi ngày và phút học tính chung mọi ngôn ngữ." (chỉ hiện khi lọc). Tất cả → như trước T20.

---

### 6.11 Cài đặt — `/settings` (`routes/Settings.tsx`)

**(1) Mục đích.** Chỉnh tên hiển thị, mục tiêu phút/ngày, giọng đọc tiếng Anh, tự phát âm khi lật thẻ; xuất dữ liệu; đăng xuất; (local) xoá dữ liệu cục bộ.

**(2) Luồng.** Mỗi trường lưu ngay khi đổi (on change/blur) → `saveSettings` → toast nhỏ "Đã lưu." (gộp, không spam: debounce 600ms cho input text/number). "Nghe thử" phát câu mẫu "Nice to meet you." bằng giọng đang chọn. "Xuất dữ liệu (JSON)" → tải file `vo-tieng-anh-{YYYY-MM-DD}.json` chứa snapshot (không chứa token). "Đăng xuất" → ConfirmDialog → `signOut` → `/login`. Mode local: "Xoá toàn bộ dữ liệu trên thiết bị này" (danger, tách riêng ở cuối) → ConfirmDialog có ô gõ "XOA" để xác nhận → xoá các khoá `vta:v1:*` → reload.

**(3) Dữ liệu & validation.**

| Trường | Kiểu | Quy tắc | Lỗi |
|---|---|---|---|
| `display_name` | text | trim ≤ 40; rỗng → dùng fallback email | "Tối đa 40 ký tự." |
| `daily_goal_min` | number | 5–120, bước 5 (input `type=number` + 2 nút −/+ 44px) | "Mục tiêu từ 5 đến 120 phút." |
| `new_cards_per_day` | number | 5–30, bước 1 (input `type=number` + 2 nút −/+ 44px); nhãn "Thẻ mới mỗi ngày"; mô tả "Thẻ đến hạn không bị giới hạn." | "Từ 5 đến 30 thẻ." |
| `voice_name` | select | giá trị trong `getEnglishVoices()` hoặc `''` = "Tự động" | — |
| `auto_speak` | switch (checkbox `role="switch"`) | — | — |

**(4) Trạng thái.**
- Các nhóm là card trắng tách biệt, tiêu đề H2 20px ink: "Tài khoản", "Mục tiêu", "Giọng đọc", "Dữ liệu".
- "Tài khoản": dòng "Đăng nhập bằng {email}" (mode supabase) hoặc "Chế độ cục bộ · dữ liệu chỉ nằm trên trình duyệt này" (local); input "Tên hiển thị"; nút secondary "Đăng xuất" (supabase) đặt sau đường kẻ, cách 24px.
- "Mục tiêu": "Mục tiêu mỗi ngày" với −/+; mô tả "15 phút là vừa với người bận. Học 1 phút đã được tính vào chuỗi."
- "Giọng đọc": select "Giọng tiếng Anh" (mỗi option "{voice.name} · {voice.lang}"); nút secondary "Nghe thử"; switch "Tự phát âm sau khi lật thẻ" mô tả "Tắt nếu bạn hay học ở nơi yên tĩnh."; dòng mute "Giọng phụ thuộc vào thiết bị; trên máy khác có thể khác." TTS không hỗ trợ → thay cả khối bằng dòng thông tin "Trình duyệt này không hỗ trợ đọc tiếng Anh. Hãy thử Chrome hoặc Edge."; voices chưa tải (Chrome tải async) → select disabled với "Đang tải giọng…" cho tới `voiceschanged`; không có giọng en → "Thiết bị chưa cài giọng tiếng Anh."
- "Dữ liệu": nút secondary "Xuất dữ liệu (JSON)"; mô tả "Tệp gồm buổi học, mục, thẻ và lịch sử ngày học của bạn." Mode local: sau đường kẻ + 32px, nút danger "Xoá toàn bộ dữ liệu trên thiết bị này".
- Lưu lỗi mạng → toast chung; giá trị vẫn giữ trên UI.

**(5) Quy tắc.** Không có trường Gemini key ở MVP. Không hiển thị "sắp có". Đăng xuất xoá hàng đợi pending của user? **Không xoá** — giữ để replay lần đăng nhập sau (khoá theo userId); nhưng hiện cảnh báo trong dialog nếu `pending > 0`: "Có {n} thay đổi chưa đồng bộ. Đăng xuất bây giờ, chúng sẽ được gửi khi bạn đăng nhập lại trên trình duyệt này."

**(6) Microcopy.** Như (4). Dialog đăng xuất: "Đăng xuất?" / "Bạn sẽ cần liên kết email mới để vào lại." / "Huỷ" / "Đăng xuất". Dialog xoá local: "Xoá toàn bộ dữ liệu?" / "Mọi buổi học, thẻ và lịch sử trên trình duyệt này sẽ mất. Gõ XOA để xác nhận." / "Huỷ" / "Xoá hết" (disabled tới khi gõ đúng). Toast xuất: "Đã tải tệp dữ liệu." Tiêu đề tài liệu "Cài đặt · Vở Tiếng Anh".

**(7) Tiêu chí chấp nhận.**
- [ ] Đổi mục tiêu → `settings.daily_goal_min` lưu; Hôm nay và Tiến độ phản ánh ngay.
- [ ] Mục tiêu ngoài 5–120 → lỗi, không lưu; nút −/+ không vượt biên.
- [ ] Chọn giọng → "Nghe thử" dùng đúng giọng; giọng được dùng ở Ôn thẻ và Shadowing; giọng không tồn tại trên thiết bị khác → fallback `pickDefaultVoice`.
- [ ] `auto_speak=true` → Ôn thẻ phát âm sau khi lật (en_vi/vi_en); false → không.
- [ ] Xuất JSON tải tệp hợp lệ có đủ 5 phần snapshot, không chứa token/email ngoài `settings`.
- [ ] Đăng xuất có xác nhận; sau đó `/` redirect `/login`.
- [ ] Mode local: nút xoá yêu cầu gõ XOA; xoá xong app về trạng thái rỗng.
- [ ] Nút nguy hiểm luôn tách khỏi nút khác bằng đường kẻ + ≥ 24px.

**(8) Task:** T16. Khối "Giọng đọc" được mở rộng ở 6.12 (T19b). Khối "Dữ liệu" thêm "Nhập dữ liệu (JSON)" ở 6.13-B (T18b).

**(9) T20 — khối "Ngôn ngữ" (chi tiết 6.14 (2)-B, (4)):** card mới, H2 "Ngôn ngữ", đặt **giữa** "Tài khoản" và "Mục tiêu". Field select "Ngôn ngữ đang học" (option "Tất cả" · "Tiếng Anh" · "Tiếng Trung" · "Tiếng Nhật" · "Tiếng Hàn"), mô tả "Lọc thẻ ôn, shadowing, kho mẫu câu và thống kê thẻ theo một ngôn ngữ. Nhật ký buổi học, chuỗi ngày và phút học luôn tính chung." Lưu ngay `saveSettings({ ...settings, study_language })` → toast "Đã lưu." (đồng bộ qua Supabase như các trường khác). Dưới select, dòng 14px mute "Giọng đọc trên thiết bị này: Anh — có · Trung — có · Nhật — chưa có · Hàn — có" tính từ `canSpeakLang` (reactive theo `voiceschanged`); không có Web Speech → "Trình duyệt này không có giọng đọc." Khối "Giọng đọc" **không đổi** (select "Giọng trình duyệt" vẫn chỉ giọng tiếng Anh; giọng zh/ja/ko tự chọn — 12.2 T20). Tên tệp xuất đổi thành `vo-ngoai-ngu-{YYYY-MM-DD}.json`.

---

### 6.12 Giọng đọc & nhà cung cấp TTS — `lib/tts/*`, `lib/ttsConfig.ts`, mở rộng `/settings` (T19)

**(1) Mục đích.** Cho phép đọc **tiếng Việt** (nghĩa trên mặt sau thẻ, "Lưu ý phát âm", "Hỏi giáo viên", "Lỗi hay gặp"; GĐ2: tổng kết AI) bằng server TTS chạy trên máy tính của người dùng (VieNeu-TTS, OpenAI-compatible), và tuỳ chọn thay giọng tiếng Anh của trình duyệt bằng server tiếng Anh local (Kokoro). Web Speech vẫn là mặc định cho tiếng Anh; không có server thì app **không đổi gì** so với hiện tại.

User story:
- Là người mất gốc, khi lật thẻ tôi muốn nghe luôn nghĩa tiếng Việt bằng giọng người thật để khỏi phải cúi xuống đọc trên điện thoại giữa lúc đang bận tay.
- Là chủ app có laptop, tôi muốn cài một server giọng đọc miễn phí một lần, dán địa chỉ vào Cài đặt, bấm "Kiểm tra kết nối" thấy ✓ là dùng được; khi tắt laptop thì app tự quay về như cũ, không báo lỗi liên tục.

**(2) Luồng.**

Luồng chính A — cấu hình server tiếng Việt (Cài đặt):
1. Mở `/settings` → khối "Giọng đọc" → phần "Tiếng Việt" → bật switch "Đọc tiếng Việt bằng server local".
2. Hiện nhóm trường: "Địa chỉ server" (điền sẵn `http://localhost:8000`), "Giọng", "Tốc độ", nút "Kiểm tra kết nối", nút "Nghe thử", và hướng dẫn cài (3 lệnh).
3. Bấm "Kiểm tra kết nối" → `probe()` → dòng kết quả "Kết nối được · {ms} ms · {n} giọng" → ô "Giọng" đổi từ ô text sang select với danh sách server trả về (giữ giá trị đang có nếu còn trong danh sách).
4. Bấm "Nghe thử" → đọc "Rất vui được gặp bạn." bằng giọng và tốc độ đang chọn.
5. Mọi thay đổi lưu ngay vào `localStorage` (không toast "Đã lưu." vì không có mạng; chỉ đổi trạng thái tại chỗ).

Luồng chính B — nghe tiếng Việt khi học:
1. Ở mặt sau thẻ `en_vi`, cạnh nghĩa tiếng Việt có `SpeakButton lang="vi"` → bấm → `speak({text: item.vi, lang: 'vi'})` → router chọn `OpenAiCompatibleProvider(vi)` → `POST /v1/audio/speech` → phát.
2. Lần sau lật lại cùng thẻ → cache hit, không gọi server.

Luồng chính C — server tiếng Anh (tuỳ chọn, Kokoro): bật "Dùng server local cho tiếng Anh" → điền địa chỉ (điền sẵn `http://localhost:8880`) + giọng → "Kiểm tra kết nối" → mọi nút loa tiếng Anh (Ôn thẻ, Trang buổi học, Mẫu câu, Shadowing, tự phát âm) dùng server; lỗi → tự quay về Web Speech.

Luồng phụ:
- **Server không chạy/timeout** khi đang học: tiếng Anh → tự chuyển Web Speech cho chính lượt đó; tiếng Việt → promise reject, nút loa VI ẩn trên toàn app cho tới khi server được đánh dấu khả dụng lại; toast info **1 lần/phiên/ngôn ngữ**.
- **Server bận (HTTP 429)**: không đánh dấu "down"; toast "Server giọng đọc đang bận. Thử lại sau vài giây." (1 lần/phiên).
- **Bấm nút loa khi đang đọc**: dừng (như hiện tại), kể cả khi đang chờ fetch (abort).
- **Rời màn hình / đổi thẻ / đổi câu**: `cancel(owner)` → abort fetch nếu chưa về, dừng `<audio>`, revoke URL.
- **Đổi địa chỉ server trong Cài đặt**: xoá cache audio của ngôn ngữ đó; reset trạng thái health về `unknown`.
- **Tắt switch**: nút loa VI biến mất ngay trên các màn (cấu hình là external store, các hook đang mount nhận thông báo).
- **Trang mở bằng HTTPS, địa chỉ server là `http://` không phải loopback** (ví dụ app trên Vercel, server ở `http://192.168.1.5:8000`): trình duyệt sẽ chặn (mixed content) — app phát hiện trước, hiện cảnh báo tại trường địa chỉ và không cho "Kiểm tra kết nối" thành công giả. Hướng dẫn: mở app qua http (dev server trên cùng máy/LAN) hoặc chạy server qua https/tunnel.

**(3) Dữ liệu & validation.**

Cấu hình lưu **trên thiết bị**, khoá `localStorage` `vta:v1:tts` (không đồng bộ Supabase; không có bản ghi nào trong bảng `settings`; không lưu API key vì server local không cần):

```ts
// lib/ttsConfig.ts
export type TtsLang = 'en' | 'vi'
export interface TtsServerConfig { baseUrl: string; voice: string }
export interface TtsConfig {
  v: 1
  vi: TtsServerConfig & { enabled: boolean; speed: number /* 0.8–1.2, bước 0.1 */; deviceFallback: boolean }
  en: TtsServerConfig & { useServer: boolean }
}
export const DEFAULT_TTS_CONFIG: TtsConfig = {
  v: 1,
  vi: { enabled: false, baseUrl: 'http://localhost:8000', voice: '', speed: 1, deviceFallback: false },
  en: { useServer: false, baseUrl: 'http://localhost:8880', voice: '' },
}
export function readTtsConfig(): TtsConfig          // parse an toàn; sai kiểu/thiếu → merge với DEFAULT; v khác → DEFAULT
export function writeTtsConfig(c: TtsConfig): void  // ghi + notify subscribers (cùng tab); nghe `storage` cho tab khác
export function subscribeTtsConfig(cb: () => void): () => void   // dùng với useSyncExternalStore
export function normalizeBaseUrl(raw: string): { ok: true; value: string; hint?: string } | { ok: false; error: string }
export function classifyHost(url: string): 'loopback' | 'private' | 'public'
export function isMixedContentBlocked(url: string, pageProtocol = location.protocol): boolean
```

| Trường | Kiểu | Quy tắc | Lỗi / gợi ý |
|---|---|---|---|
| `baseUrl` | text (`inputmode="url"`, `autocapitalize="off"`, `spellcheck=false`) | trim; ≤ 200 ký tự; parse được bằng `new URL()`; protocol `http:` hoặc `https:`; không `search`/`hash`; không `username`/`password`; bỏ mọi `/` cuối; nếu pathname kết thúc bằng `/v1` → cắt bỏ và hiện gợi ý; cho phép path prefix khác (reverse proxy) | "Địa chỉ phải bắt đầu bằng http:// hoặc https://." · "Địa chỉ không được chứa ? hoặc #." · "Địa chỉ không được chứa tên đăng nhập." · "Địa chỉ tối đa 200 ký tự." · gợi ý: "Đã bỏ /v1 ở cuối — app tự thêm." |
| `voice` | select (khi đã tải danh sách) hoặc text | trim ≤ 60; rỗng = dùng giọng mặc định của server (`DEFAULT_VOICE.vi = 'Hải Đăng'`, `DEFAULT_VOICE.en = 'af_heart'`; hiện làm placeholder) | "Tên giọng tối đa 60 ký tự." |
| `speed` (chỉ VI) | select 5 giá trị | 0.8 · 0.9 · 1.0 · 1.1 · 1.2; ngoài tập → 1.0 | — |
| `enabled` / `useServer` / `deviceFallback` | switch `role="switch"` | — | — |

Phân loại host (`classifyHost`): `loopback` = `localhost`, `127.0.0.0/8`, `[::1]`; `private` = `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, hậu tố `.local`, `.lan`, `.home.arpa`, `.internal`; còn lại `public` → cảnh báo riêng tư (không chặn). `isMixedContentBlocked` = trang `https:` và URL `http:` và host không phải `loopback`.

Hợp đồng server (OpenAI-compatible, đã đối chiếu README VieNeu-TTS v3 Turbo và kokoro-fastapi):

```
POST {baseUrl}/v1/audio/speech
Content-Type: application/json
{ "model": "<MODEL[lang]>", "input": "<text>", "voice": "<voice>", "response_format": "wav", "speed": <number, chỉ gửi khi ≠ 1> }
→ 200, body là WAV (chấp nhận content-type bắt đầu bằng "audio/" hoặc "application/octet-stream")
GET  {baseUrl}/v1/models   → 200 (probe)
GET  {baseUrl}/v1/voices   → danh sách giọng (VieNeu); dự phòng GET {baseUrl}/v1/audio/voices (kokoro-fastapi)
GET  {baseUrl}/health      → dự phòng probe khi /v1/models không có (404/405)
```
`MODEL = { vi: 'vieneu-v3-turbo', en: 'kokoro' }` — hằng trong code, không có UI (server local bỏ qua hoặc chấp nhận chuỗi này). Parse danh sách giọng **khoan dung**: chấp nhận `string[]`; `{voices: [...]}`; `{data: [...]}`; phần tử là string hoặc object có `id | name | voice_id` (+ `label | display_name` tuỳ chọn, + `lang | language` tuỳ chọn) → `TtsVoice { id, label, lang? }`; bỏ phần tử không có id; trùng id giữ cái đầu.

Chuẩn hoá văn bản trước khi gửi (`prepareText(text, lang)`): trim; gộp khoảng trắng; bỏ dấu `*` của cú pháp `*từ*` (6.5); với VI: thay `{slot}` còn sót bằng "…" (không gửi ngoặc nhọn); chia khối dài: tách theo dòng mới rồi theo dấu `. ! ? ;`, gộp lại thành các đoạn ≤ 300 ký tự, đọc tuần tự trong cùng một `SpeakHandle` (dừng là dừng cả chuỗi). Mỗi đoạn là một mục cache.

Kiến trúc (`src/lib/tts/`):

```
lib/tts/types.ts        # TtsLang, SpeakRequest, SpeakHandle, TtsProvider, TtsVoice, TtsError, ProbeResult
lib/tts/webSpeech.ts    # WebSpeechProvider — bọc lib/speech.ts hiện có, không sửa hành vi
lib/tts/openaiCompat.ts # OpenAiCompatibleProvider(lang, getConfig) — fetch + AbortController + timeout
lib/tts/audioSink.ts    # singleton <audio>, mở khoá iOS trong gesture, play(blob, playbackRate), stop()
lib/tts/cache.ts        # AudioCache LRU: ≤ 50 mục, ≤ 20 MB, khoá (providerId, baseUrl, voice, speed, text)
lib/tts/router.ts       # TtsRouter — chọn provider theo lang + config + health; fallback; toast 1 lần/phiên
lib/tts/index.ts        # facade: speak(), cancel(), isCurrent(), canSpeak(lang), subscribe(), probe(lang), listVoices(lang)
lib/ttsConfig.ts        # đọc/ghi/validate cấu hình (trên)
```

```ts
// lib/tts/types.ts
export interface SpeakRequest { text: string; lang: TtsLang; rate: number; owner: object }
export interface SpeakHandle { promise: Promise<void>; cancel(): void }
export interface TtsVoice { id: string; label: string; lang?: string }
export type ProbeResult = { ok: true; ms: number; voices: number | null } | { ok: false; ms: number; error: TtsError }
export type TtsErrorKind = 'unsupported' | 'blocked' | 'network' | 'timeout' | 'http' | 'busy' | 'decode' | 'autoplay' | 'cancelled'
export class TtsError extends Error { kind: TtsErrorKind; status?: number }
export interface TtsProvider {
  readonly id: 'web-speech' | 'server-vi' | 'server-en'
  supports(lang: TtsLang): boolean                 // web: 'en' luôn (nếu speechSynthesis có), 'vi' khi có giọng vi-*
  speak(req: SpeakRequest): SpeakHandle            // PHẢI khởi động đồng bộ (không await trước) — xem (5) iOS
  probe(signal?: AbortSignal): Promise<ProbeResult>
  listVoices(signal?: AbortSignal): Promise<TtsVoice[]>
}
```

Facade giữ chữ ký cũ để caller không đổi: `lib/speech.ts` **giữ nguyên** (WebSpeechProvider gọi vào). `hooks/useTts.ts` đổi import sang `lib/tts` và mở rộng:

```ts
useTts() → {
  supported: boolean            // như cũ = Web Speech có speechSynthesis (buildQueue/thẻ listen vẫn dựa vào đây)
  viAvailable: boolean          // canSpeak('vi') — reactive theo config + health
  enServer: boolean             // đang dùng server cho tiếng Anh (để Settings/Shadowing hiện chú thích)
  speaking: boolean
  speak(text: string, opts?: { rate?: number; lang?: TtsLang }): Promise<void>   // lang mặc định 'en'
  cancel(): void
}
```
`SpeakButton` thêm prop `lang?: TtsLang` (mặc định `'en'`); khi `lang='vi'` và `!viAvailable` → `return null`. Trong lúc chờ server (>300 ms chưa có audio) icon đổi `LoaderCircle` (class quay như Spinner; `prefers-reduced-motion` → đứng yên), `aria-label` "Đang tải giọng đọc. Bấm để dừng."; có audio → `Square` "Dừng" như cũ.

Tốc độ: `rate` của caller (Shadowing 0.5/0.75/1; Cài đặt VI 0.8–1.2) được gửi nguyên làm `speed` khi ≠ 1. Nếu server trả 400/422 **và** có `speed` → thử lại **một lần** không `speed`, rồi đặt `audio.playbackRate = rate` (`preservesPitch = true` nếu có). Khoá cache luôn dùng `rate` của caller.

Cache (`cache.ts`): `Map<string, { blob: Blob; bytes: number; at: number }>`; LRU theo lần dùng; giới hạn 50 mục hoặc 20 MB (đuổi mục cũ nhất tới khi đủ chỗ); một mục > 20 MB không cache; chỉ trong bộ nhớ (không IndexedDB/localStorage — 8.5); `clear(lang)` khi đổi `baseUrl`/`voice` của ngôn ngữ đó.

**(4) Trạng thái.**

Khối "Giọng đọc" ở `/settings` (card trắng, H2 "Giọng đọc"; hai phần tách bằng đường kẻ 1px, tiêu đề phần là `<h3>` 16px/600 ink chữ thường — không eyebrow):

*Phần "Tiếng Anh"*
- Như 6.11: select "Giọng trình duyệt" (đổi nhãn từ "Giọng tiếng Anh" để phân biệt với server), "Nghe thử", switch "Tự phát âm sau khi lật thẻ", dòng mute về thiết bị. Web Speech không hỗ trợ → dòng Info như cũ **nhưng không ẩn** phần server bên dưới.
- Switch "Dùng server local cho tiếng Anh" (mô tả: "Dành cho server như Kokoro. Giọng từ model tiếng Việt có thể không chuẩn tiếng Anh."). Tắt (mặc định) → không hiện gì thêm. Bật → nhóm: Field "Địa chỉ server" · Field "Giọng" · hàng nút "Kiểm tra kết nối" (secondary) + "Nghe thử" (secondary, đọc "Nice to meet you.") · dòng trạng thái kết nối (xem bên dưới).
- Khi `useServer` bật nhưng health `down`: dòng mute "Đang tạm dùng giọng trình duyệt vì không kết nối được server."

*Phần "Tiếng Việt"*
- Switch "Đọc tiếng Việt bằng server local" (mô tả: "Đọc nghĩa, lưu ý phát âm và phần hỏi giáo viên bằng giọng Việt tự nhiên. Cần một máy tính đang chạy VieNeu-TTS.").
- Tắt (mặc định) → dưới switch chỉ còn `<details>` hướng dẫn cài (đóng).
- Bật → nhóm: Field "Địa chỉ server" · Field "Giọng" (text cho tới khi tải được danh sách → select, option đầu "Mặc định của server") · Field select "Tốc độ" ("0,8x" "0,9x" "1,0x" "1,1x" "1,2x") · hàng nút "Kiểm tra kết nối" + "Nghe thử" (đọc "Rất vui được gặp bạn.") · dòng trạng thái kết nối.
- Switch phụ "Khi không có server, dùng giọng tiếng Việt của thiết bị" (mô tả: "Chất lượng thường kém hơn nhiều.") — **chỉ render** khi `WebSpeechProvider.supports('vi')` (thiết bị có giọng `vi-*`); mặc định tắt.
- `<details>` "Cài VieNeu-TTS trên máy tính (3 lệnh)": khối `<pre lang="en">` 14px:
  ```
  git clone https://github.com/pnnbao97/VieNeu-TTS.git && cd VieNeu-TTS
  uv sync
  uv run python -m apps.openai_speech
  ```
  rồi đoạn 14px mute: "Cần cài uv trước (xem README của VieNeu-TTS). Server chạy ở http://localhost:8000. Chỉ dùng được khi máy tính đang bật server; điện thoại phải cùng Wi-Fi và dùng địa chỉ IP của máy tính thay cho localhost." + "Miễn phí, mã nguồn mở (Apache-2.0); chạy được trên CPU, câu ngắn mất khoảng 1–3 giây."
- Dòng riêng tư cuối khối (14px mute): "Chỉ câu đang học được gửi tới server bạn tự cấu hình. Không gửi API key, không gửi dữ liệu khác."

*Dòng trạng thái kết nối* (mỗi phần một dòng, 14px, `aria-live="polite"`):
- `idle` (chưa kiểm tra): "Chưa kiểm tra."
- `checking`: Spinner nhỏ + "Đang kiểm tra…" (nút "Kiểm tra kết nối" disabled).
- `ok`: icon `Check` purple + "Kết nối được · {ms} ms · {n} giọng" (n null → bỏ phần giọng).
- `error` (chữ ink, icon `CircleAlert` red vì đây là lỗi cần xử lý): thông điệp theo `TtsError.kind`:
  - `timeout`: "Quá 4 giây không phản hồi. Server có đang chạy không?"
  - `network` (fetch TypeError — không phân biệt được CORS/không chạy/sai cổng): "Không kết nối được. Kiểm tra server đã chạy và địa chỉ đúng chưa. Nếu server đang chạy trên máy khác, khởi động với `--host 0.0.0.0` và cho phép CORS từ {origin}."
  - `blocked` (mixed content, phát hiện trước khi gọi): "Trang này mở bằng HTTPS nên trình duyệt chặn kết nối http tới địa chỉ mạng nội bộ. Mở app qua http trên cùng mạng, hoặc chạy server qua https."
  - `http`: "Server trả lỗi {status}."
  - `busy` (429): "Server đang bận. Thử lại sau vài giây."
- Cảnh báo riêng tư (dưới Field địa chỉ, 14px ink, icon `Info` purple, không chặn) khi `classifyHost === 'public'`: "Địa chỉ này không thuộc mạng nội bộ. Server đó sẽ nhận nội dung bạn học."
- Lỗi validation địa chỉ: theo bảng (3), kiểu Field lỗi chuẩn (5.4); khi địa chỉ lỗi, nút "Kiểm tra kết nối" và "Nghe thử" disabled.

Trên các màn học (T19c):
- **Ôn thẻ** (6.7), mặt sau `en_vi`: `SpeakButton lang="vi" size="md"` đặt **cùng hàng** với dòng VI, bên phải, `aria-label` "Nghe nghĩa tiếng Việt". Không có ở mặt trước `vi_en`, không ở thẻ `listen`, không ở tổng kết. `auto_speak` chỉ đọc EN (không đổi).
- **Trang buổi học** (6.5): KHÔNG thêm nút loa VI cho từng mục (trang vở sạch — direction contract). Thay vào đó, khi `viAvailable`: thêm nút secondary md "Nghe cả trang" (icon `Volume2`; đang đọc → `Square` "Dừng") vào hàng hành động đầu trang (sau "Shadowing", trước "Sửa"). Đọc tuần tự từng mục: EN (provider EN) → nghỉ 400 ms → VI (server) → nghỉ 600 ms → mục kế. Mục đang đọc có `aria-current="true"` và chữ EN/VI nền `--lilac` (không viền, không bóng). Kết thúc hoặc "Dừng" → gỡ highlight. Rời trang → cancel. Nếu `audio.play()` reject `NotAllowedError` giữa chừng (iOS) → dừng chuỗi, nút đổi thành "Tiếp tục nghe" để bấm lại (vào gesture mới, tiếp từ mục đang dở).
  Phần "Hỏi giáo viên" và "Lỗi hay gặp": một `SpeakButton lang="vi" size="md"` ở bên phải nhãn khối (`aria-label` "Nghe phần hỏi giáo viên" / "Nghe lỗi hay gặp"), đọc toàn bộ nội dung đã `prepareText`. "Ghi chú" không có nút.
- **Hôm nay** (6.3): **không thêm nút** ở MVP+ (viewport đầu phải sạch; người dùng bấm "Xem cả trang" để nghe).
- **Mẫu câu tình huống** (6.8): một `SpeakButton lang="vi"` cạnh đoạn "Lưu ý phát âm:" của tình huống (`aria-label` "Nghe lưu ý phát âm"), đọc `pronunciationFocus`. `note` từng mẫu câu **không** có nút (tránh hai nút loa mỗi câu).
- **Shadowing** (6.9): "Nghe mẫu" / "Nghe lần lượt" dùng provider EN đang chọn với `rate` 0.5/0.75/1 (map như (3)). Khi `enServer` → dòng mute dưới khu luyện "Giọng mẫu: server local." Không có nút VI.
- **Cài đặt**: như trên.

Trạng thái chung của nút VI theo router: `viAvailable = (vi.enabled && health.vi !== 'down' && !isMixedContentBlocked(vi.baseUrl)) || (vi.deviceFallback && webSpeech.supports('vi'))`. `health` là trạng thái trong bộ nhớ phiên: `unknown | ok | down`; `down` tự hết hạn sau 60 giây → `unknown` (để laptop bật lại là tự dùng được mà không cần vào Cài đặt); "Kiểm tra kết nối" thành công → `ok`, thất bại **do mất kết nối/timeout/≥500** → `down` (4xx/429 giữ nguyên health vì server có trả lời).

Trạng thái lỗi khi đang học (không phải ở Cài đặt): không hiện khối lỗi trong thẻ; chỉ toast info 1 lần/phiên/ngôn ngữ (Phụ lục A) và nút trở về trạng thái nghỉ. Trình duyệt không có `fetch`/`Audio`/`AbortController` (không thực tế với target) → provider server `supports()` trả false → như chưa cấu hình.

**(5) Quy tắc nghiệp vụ.**

1. **Mặc định không đổi**: `vi.enabled=false`, `en.useServer=false` → hành vi app y hệt trước T19; không request mạng nào tới server TTS khi chưa bật. Không probe tự động khi mở app; chỉ probe khi bấm "Kiểm tra kết nối" hoặc thông qua chính lượt `speak` đầu tiên.
2. **Chọn provider** (`TtsRouter.resolve(lang)`):
   - `en`: `en.useServer && health.en !== 'down' && !blocked` → `server-en`; ngược lại `web-speech` nếu `supports('en')`; ngược lại `null` → reject `unsupported`.
   - `vi`: `vi.enabled && health.vi !== 'down' && !blocked` → `server-vi`; ngược lại `vi.deviceFallback && web.supports('vi')` → `web-speech` (utterance `lang='vi-VN'`, chọn giọng `vi-*` đầu tiên); ngược lại `null`.
3. **Fallback trong lượt**: `server-en` thất bại với `network | timeout | http ≥ 500 | decode` → `markDown('en')`, toast 1 lần/phiên, rồi gọi ngay `web-speech.speak(req)` cho **chính lượt đó** (chấp nhận đã rời gesture; nếu iOS từ chối thì promise reject, nút về nghỉ, lượt bấm sau đi thẳng Web Speech vì health đã `down`). `server-vi` thất bại tương tự → `markDown('vi')`, toast 1 lần/phiên, reject (không fallback OS trừ khi `deviceFallback`). `http 4xx` (trừ 429 và trường hợp speed ở (3)) → **không** markDown (cấu hình sai, không phải mất kết nối), reject; Cài đặt sẽ hiện "Server trả lỗi {status}." khi kiểm tra.
4. **Một nguồn phát tại một thời điểm**: router giữ `current` duy nhất cho mọi provider; `speak()` mới luôn `cancel` cái cũ (kể cả khác provider: dừng `speechSynthesis` và `<audio>`). `cancel(owner)`/`isCurrent(owner)` giữ ngữ nghĩa của `lib/speech.ts`.
5. **Ràng buộc iOS (user gesture)** — `OpenAiCompatibleProvider.speak()` phải đồng bộ tới khi khởi động phần tử âm thanh:
   - `audioSink` là **một** `HTMLAudioElement` module-level (tạo lazy, `preload='auto'`, `playsInline`). Trong `speak()` (vẫn trong call stack của click): nếu chưa `unlocked` → gán `src` = WAV im lặng ~50 ms dạng `data:audio/wav;base64,…` (hằng trong `audioSink.ts`) và gọi `play()` đồng bộ; `then → unlocked = true`, `catch → bỏ qua`. Sau đó mới `fetch`. Khi blob về: `src = URL.createObjectURL(blob)`, `playbackRate`, `play()`. Vì phần tử đã phát trong gesture nên `play()` sau fetch được iOS cho phép. Cache hit → bỏ bước im lặng nếu đã `unlocked`, gán blob và `play()` ngay (vẫn trong gesture).
   - Không dùng `AudioContext` ở T19 (BufferSource đổi `playbackRate` làm méo cao độ; `<audio>` có `preservesPitch`). Ghi chú làm phương án dự phòng nếu `<audio>` gặp lỗi trên một thiết bị cụ thể.
   - Web Speech giữ nguyên quy tắc: `synth.speak()` đồng bộ trong handler.
6. **Timeout**: `speak` 8 000 ms cho toàn bộ `fetch` + `blob()` (một `AbortController`, `setTimeout`); `probe` 4 000 ms; `listVoices` 4 000 ms. Timeout → `TtsError('timeout')`.
7. **Cache** theo khoá `(providerId, baseUrl, voice || DEFAULT_VOICE, rate, preparedText)`; chỉ cache phản hồi 200 có body > 0 byte; không cache lỗi; xoá khi đổi `baseUrl`/`voice` của ngôn ngữ đó; không bao giờ ghi ra storage.
8. **Riêng tư** (8.5 mở rộng): chỉ gửi `preparedText` của câu người dùng vừa bấm, cùng `model/voice/speed`; không gửi id, email, buổi học, hay bất kỳ trường khác; không header Authorization; không `credentials` (`credentials: 'omit'`). Cảnh báo UI khi host `public`. Không log nội dung câu ra console (chỉ `kind`/`status`).
9. **Mixed content**: `isMixedContentBlocked(baseUrl)` → coi như `blocked` ở cả Cài đặt lẫn router (không thử gọi để khỏi lỗi console rác); chỉ `localhost`/`127.*`/`[::1]` được miễn (hành vi Chrome/Edge/Firefox/Safari hiện đại).
10. **`supported` không đổi nghĩa**: `useTts().supported` vẫn là Web Speech, vì `buildQueue` loại thẻ `listen` dựa vào nó và server có thể tắt bất cứ lúc nào; server EN chỉ là "nâng cấp giọng", không mở khoá tính năng.
11. **Auto-speak** chỉ EN (không tự đọc VI sau khi lật) — tránh hai âm thanh liên tiếp bất ngờ (PRODUCT: "no autoplay surprises").
12. **Số nút loa VI trên một màn**: Ôn thẻ 1, Trang buổi học ≤ 3 (cả trang + hỏi giáo viên + lỗi hay gặp), Mẫu câu 1, Hôm nay 0.

**(6) Microcopy.** (nguyên văn; bổ sung vào Phụ lục A)

- Tiêu đề phần: "Tiếng Anh" · "Tiếng Việt".
- Select: "Giọng trình duyệt" (thay "Giọng tiếng Anh"). Option "Tự động" giữ.
- Switch EN: "Dùng server local cho tiếng Anh" / mô tả "Dành cho server như Kokoro. Giọng từ model tiếng Việt có thể không chuẩn tiếng Anh."
- Switch VI: "Đọc tiếng Việt bằng server local" / mô tả "Đọc nghĩa, lưu ý phát âm và phần hỏi giáo viên bằng giọng Việt tự nhiên. Cần một máy tính đang chạy VieNeu-TTS."
- Switch phụ: "Khi không có server, dùng giọng tiếng Việt của thiết bị" / "Chất lượng thường kém hơn nhiều."
- Field: "Địa chỉ server" (placeholder `http://localhost:8000` / `http://localhost:8880`) · "Giọng" (placeholder "Hải Đăng" / "af_heart"; option "Mặc định của server") · "Tốc độ".
- Nút: "Kiểm tra kết nối" · "Nghe thử" · "Nghe cả trang" · "Dừng" · "Tiếp tục nghe".
- Câu nghe thử: EN "Nice to meet you." · VI "Rất vui được gặp bạn."
- Trạng thái: "Chưa kiểm tra." · "Đang kiểm tra…" · "Kết nối được · {ms} ms · {n} giọng" · "Đang tạm dùng giọng trình duyệt vì không kết nối được server."
- Lỗi kiểm tra: xem (4). Gợi ý URL: "Đã bỏ /v1 ở cuối — app tự thêm."
- Toast (info, 1 lần/phiên/ngôn ngữ): EN "Không kết nối được server giọng đọc, đang dùng giọng trình duyệt." · VI "Không kết nối được server giọng đọc tiếng Việt. Nút nghe tiếng Việt tạm ẩn." · 429 "Server giọng đọc đang bận. Thử lại sau vài giây."
- aria-label: "Nghe nghĩa tiếng Việt" · "Nghe lưu ý phát âm" · "Nghe phần hỏi giáo viên" · "Nghe lỗi hay gặp" · "Đang tải giọng đọc. Bấm để dừng."
- Hướng dẫn: `<summary>` "Cài VieNeu-TTS trên máy tính (3 lệnh)"; đoạn: "Cần cài uv trước (xem README của VieNeu-TTS). Server chạy ở http://localhost:8000. Chỉ dùng được khi máy tính đang bật server; điện thoại phải cùng Wi-Fi và dùng địa chỉ IP của máy tính thay cho localhost." · "Miễn phí, mã nguồn mở (Apache-2.0); chạy được trên CPU, câu ngắn mất khoảng 1–3 giây."
- Riêng tư: "Chỉ câu đang học được gửi tới server bạn tự cấu hình. Không gửi API key, không gửi dữ liệu khác." · Cảnh báo: "Địa chỉ này không thuộc mạng nội bộ. Server đó sẽ nhận nội dung bạn học."
- Shadowing: "Giọng mẫu: server local."

**(7) Tiêu chí chấp nhận.**

Lib/router (T19a)
- [ ] `readTtsConfig()` với localStorage rỗng/JSON hỏng/`v` lạ → `DEFAULT_TTS_CONFIG`; thiếu trường → merge mặc định; `writeTtsConfig` kích hoạt subscriber trong cùng tab và tab khác (sự kiện `storage`).
- [ ] `normalizeBaseUrl`: `"http://localhost:8000/"` → `http://localhost:8000`; `"http://192.168.1.5:8000/v1"` → bỏ `/v1` + hint; `"localhost:8000"` → lỗi protocol; có `?x=1` hoặc `#a` → lỗi; `http://u:p@host` → lỗi; > 200 ký tự → lỗi; path prefix `/tts` giữ nguyên.
- [ ] `classifyHost`: `localhost`, `127.0.0.1`, `[::1]` → loopback; `10.1.2.3`, `172.20.0.1`, `192.168.0.9`, `mac.local` → private; `tts.example.com`, `8.8.8.8` → public. `isMixedContentBlocked('http://192.168.1.5:8000', 'https:')` → true; với `http://localhost:8000` → false; với `https://…` → false.
- [ ] `resolve('en')`: mặc định → `web-speech`; `useServer=true` → `server-en`; `useServer=true` + health down → `web-speech`; `useServer=true` + blocked → `web-speech`.
- [ ] `resolve('vi')`: mặc định → `null`; `enabled=true` → `server-vi`; `enabled=true` + down → `null`; `enabled=true` + down + `deviceFallback` + có giọng vi → `web-speech`.
- [ ] `OpenAiCompatibleProvider.speak`: gửi đúng URL `{baseUrl}/v1/audio/speech`, body `{model, input, voice, response_format:'wav'}` (+ `speed` chỉ khi ≠ 1), `credentials:'omit'`, không header Authorization; 200 → gọi `audioSink.play(blob, rate)` và resolve khi `ended`.
- [ ] Timeout: fetch không trả về trong 8 000 ms (fake timers) → `TtsError('timeout')`, `AbortController.abort()` đã gọi; `markDown('en')` và lượt đó gọi `web-speech.speak` đúng 1 lần; toast đúng 1 lần dù lỗi 3 lần liên tiếp.
- [ ] 429 → `TtsError('busy')`, không markDown; 400 khi có `speed` → retry 1 lần không `speed`, `playbackRate = rate`; 400 khi không có `speed` → reject, không markDown; 503 → markDown.
- [ ] Cache: cùng `(lang, baseUrl, voice, rate, text)` gọi 2 lần → `fetch` 1 lần; khác `rate` → 2 lần; vượt 50 mục → mục cũ nhất bị đuổi; tổng bytes > 20 MB → đuổi tới khi ≤ 20 MB; đổi `baseUrl` → `fetch` lại.
- [ ] `prepareText`: bỏ `*`, gộp khoảng trắng, chia 700 ký tự thành ≤ 3 đoạn ≤ 300 ký tự tại ranh giới câu/dòng; không cắt giữa từ.
- [ ] Parse voices: `["A","B"]`, `{voices:[{id:"a",name:"A"}]}`, `{data:[{voice_id:"x"}]}`, `[{name:"Mai Anh"}]` → đúng mảng `TtsVoice`; phần tử rác bị bỏ; trùng id loại bỏ.
- [ ] `probe`: `/v1/models` 200 → ok với `ms`; 404 → thử `/health`; cả hai lỗi mạng → `network`; quá 4 000 ms → `timeout`.
- [ ] `health` `down` tự về `unknown` sau 60 s (fake timers).
- [ ] `speak()` mới hủy lượt cũ ở provider khác (đang Web Speech → bấm VI → `speechSynthesis.cancel()` được gọi; đang `<audio>` → bấm EN web → `audio.pause()` + revoke URL).
- [ ] `lib/speech.ts` và `speech.test.ts` không đổi; `npm test`, `npm run build`, `npm run lint` pass.

Cài đặt (T19b)
- [ ] Mặc định: khối "Giọng đọc" có hai phần; chỉ thấy 2 switch server (tắt) + `<details>` hướng dẫn; không có request mạng nào tới server khi mở trang.
- [ ] Bật switch VI → hiện Địa chỉ/Giọng/Tốc độ/nút; nhập `http://localhost:8000/` → blur → chuẩn hoá bỏ `/`; nhập `…/v1` → cắt + hint; nhập không protocol → lỗi đỏ, hai nút disabled.
- [ ] "Kiểm tra kết nối" với server thật → "Kết nối được · {ms} ms · {n} giọng", ô Giọng thành select có đúng danh sách; với server tắt → thông điệp `network`; với địa chỉ `http://192.168.x.x` trên trang https → thông điệp `blocked` mà không gọi mạng.
- [ ] "Nghe thử" VI phát câu mẫu bằng giọng + tốc độ đang chọn (đổi tốc độ 0,8x rồi nghe lại thấy chậm hơn).
- [ ] Host public → cảnh báo riêng tư hiện; host private/loopback → không.
- [ ] Cấu hình nằm ở `localStorage['vta:v1:tts']`, không xuất hiện trong bảng `settings` Supabase, không có trong tệp "Xuất dữ liệu (JSON)".
- [ ] Switch phụ "giọng thiết bị" chỉ hiện khi máy có giọng `vi-*` (Safari macOS có; Chrome Windows thường không).
- [ ] Web Speech không hỗ trợ → dòng Info ở phần Tiếng Anh, phần server EN và toàn bộ phần Tiếng Việt vẫn dùng được.
- [ ] Không eyebrow/uppercase; không viền trái màu; nút ≥ 44px; `aria-live` trên dòng trạng thái; Tab đi qua đủ các trường.

Màn học (T19c)
- [ ] Chưa bật VI: không có nút loa VI nào trên Ôn thẻ, Trang buổi học, Mẫu câu; Hôm nay không đổi.
- [ ] Bật VI + server chạy: mặt sau thẻ `en_vi` có nút "Nghe nghĩa tiếng Việt" đọc đúng `item.vi`; lật lại cùng thẻ → không có request mới (Network tab); `auto_speak` vẫn chỉ đọc EN.
- [ ] Trang buổi học: "Nghe cả trang" đọc EN rồi VI từng mục theo thứ tự `position`, highlight mục đang đọc, "Dừng" dừng ngay và gỡ highlight; rời trang giữa chừng → im lặng, không request treo (abort).
- [ ] "Hỏi giáo viên"/"Lỗi hay gặp" có nút đọc; nội dung có `*get*` → đọc "get" không có dấu sao.
- [ ] Mẫu câu: đúng 1 nút VI cạnh "Lưu ý phát âm:"; từng mẫu câu vẫn chỉ 1 nút loa EN.
- [ ] Tắt server giữa chừng rồi bấm nút VI → toast đúng 1 lần, nút VI ẩn trên các màn; bật server lại và chờ > 60 s (hoặc "Kiểm tra kết nối") → nút VI xuất hiện lại.
- [ ] Bật server EN (Kokoro): "Nghe mẫu" Shadowing phát từ server với 0.5x/0.75x/1x khác nhau; tắt server → bấm "Nghe mẫu" → toast 1 lần + phát bằng Web Speech; "Nghe lần lượt" vẫn phát tiếp bản ghi sau mẫu.
- [ ] iOS Safari: bấm nút VI lần đầu trong trang → phát được (không lỗi NotAllowedError); bấm lần hai → phát ngay từ cache.
- [ ] Không có audio nào trong localStorage/IndexedDB; Network không có request mang nội dung ngoài `input` của câu vừa bấm.

**(8) Task:** T19a, T19b, T19c (mục 9).

**(9) T20 — mở rộng `TtsLang` (chi tiết 6.14 (3)-D):** `TtsLang = 'en' | 'vi' | 'zh' | 'ja' | 'ko'`; `ServerLang = 'en' | 'vi'` (chỉ hai ngôn ngữ này có server; `TtsConfig` không đổi). `zh`/`ja`/`ko` **luôn** đi `web-speech` với utterance `lang = TTS_TAG[L]` và giọng chọn theo 6.14 (5).6; không fallback server, không toast. "Dùng server local cho tiếng Anh" chỉ áp dụng cho `en`.

---

### 6.13 Dán danh sách, Nhập JSON, PWA (T18) — `routes/LessonEdit.tsx`, `routes/Settings.tsx`, `public/manifest.webmanifest`

Ba tiện ích nhỏ, độc lập, cùng một task gốc T18; đặc tả theo 8 phần, mỗi phần chia A (dán danh sách), B (nhập JSON), C (PWA cơ bản). Không thêm bảng, không đổi schema Supabase.

**(1) Mục đích & user story.**

- **A — Dán danh sách nhiều dòng (T18a).** Người học thường chép bài từ ghi chú điện thoại, Zalo, ảnh chụp bảng (OCR) hoặc bảng tính: mỗi dòng một cặp "tiếng Anh – tiếng Việt". Gõ từng ô trong form 6.6 chậm. *Là người học, sau buổi học tôi muốn dán nguyên một danh sách 20–30 dòng vào buổi học, app tự tách thành các hàng mục để tôi chỉ cần soát lại rồi bấm Lưu.*
- **B — Nhập dữ liệu JSON (T18b).** "Xuất dữ liệu (JSON)" (6.11) mới chỉ là một chiều. *Là chủ dữ liệu, tôi muốn đưa tệp đã xuất trở lại app — sau khi lỡ xoá dữ liệu cục bộ, khi chuyển từ chế độ cục bộ sang tài khoản Supabase, hoặc gộp dữ liệu từ hai thiết bị — mà không mất gì đang có.*
- **C — PWA cơ bản (T18c).** *Là người học dùng điện thoại, tôi muốn "Thêm vào màn hình chính" để mở app như một ứng dụng (không thanh địa chỉ, biểu tượng đúng màu vở), dù chưa có chế độ ngoại tuyến.* Offline/service worker vẫn thuộc GĐ3 (1.4).

**(2) Luồng.**

A — chính:
1. Trong 6.6, dưới danh sách hàng mục, cạnh nút ghost "Thêm mục" có nút ghost "Dán danh sách" (icon lucide `ClipboardPaste`, `aria-expanded`, `aria-controls="paste-panel"`).
2. Bấm → mở **panel inline** ngay dưới (không dialog): textarea "Dán mỗi dòng một mục" (6 dòng, autofocus), mô tả định dạng, vùng xem trước, hai nút "Thêm vào buổi" (primary md) · "Đóng" (ghost).
3. Người dùng dán (Ctrl/Cmd+V) hoặc gõ. Xem trước cập nhật tức thời (`useMemo` trên text; parse thuần, không debounce): "{n} mục sẽ được thêm" (+ " · {k} dòng chưa có nghĩa tiếng Việt" nếu k > 0) và danh sách các dòng đã tách.
4. Bấm "Thêm vào buổi" (hoặc Ctrl/Cmd+Enter trong textarea) → bỏ mọi hàng **mới và trống hoàn toàn** đang có trong form (hàng `itemId === null && isBlankItem`), nối các hàng vừa tách vào cuối (`itemId = null`, `kind` suy luận, `ipa`/`note` nếu có → mở sẵn ô phụ của hàng đó), xoá textarea, đóng panel, focus ô EN của hàng mới đầu tiên, toast "Đã thêm {n} mục. Kiểm tra rồi bấm Lưu."
5. Form trở thành *dirty* như gõ tay (useBlocker/beforeunload 6.6 vẫn áp dụng). Chưa ghi gì xuống repository cho tới khi bấm "Lưu"/"Lưu buổi học" — lúc đó luồng lưu 6.6 chạy nguyên trạng (validation từng hàng, sinh thẻ `en_vi`).

A — phụ:
- Textarea trống hoặc chỉ dòng trống → không có xem trước, "Thêm vào buổi" disabled.
- Quá 100 dòng không trống → lỗi đỏ "Tối đa 100 dòng mỗi lần dán. Hiện có {total} dòng.", không hiện danh sách, nút disabled. Người dùng tự cắt bớt hoặc dán làm hai lần.
- Dòng không tách được → hàng chỉ có EN, VI trống; sau khi thêm, validation hiện có của 6.6 báo "Nhập nghĩa tiếng Việt." khi bấm Lưu (không báo sớm hơn, giống gõ tay).
- "Đóng" khi textarea còn chữ → đóng panel nhưng **giữ** nội dung textarea trong state (mở lại vẫn còn) cho tới khi rời trang. Không hỏi xác nhận.
- Enter trong textarea = xuống dòng (handler `onKeyDown` của form chỉ bắt `HTMLInputElement`, textarea không bị ảnh hưởng — giữ nguyên).
- Dán vào buổi đang **sửa**: hàng mới nối sau các item đã có; `position` tính lại khi lưu như 6.6.

B — chính:
1. `/settings` → khối "Dữ liệu": cạnh "Xuất dữ liệu (JSON)" có nút secondary "Nhập dữ liệu (JSON)" (icon `Upload`). Bấm → mở hộp chọn tệp (`<input type="file" accept=".json,application/json">` ẩn bằng `.visually-hidden`, kích hoạt qua `ref.click()`).
2. Chọn tệp → kiểm tra kích thước (≤ 5 MB) → dòng trạng thái "Đang đọc tệp…" → `file.text()` → `JSON.parse` → `validateImportFile()` (mức tệp) → `planImport()` (mức bản ghi, so với snapshot hiện tại).
3. Mở `ConfirmDialog` "Nhập dữ liệu từ tệp?" với bản tóm tắt: số buổi/mục/thẻ sẽ **thêm** và **cập nhật**, số ngày học sẽ cộng, số bản ghi bị bỏ qua; checkbox "Nhập cả cài đặt" (mặc định **tắt**, chỉ hiện khi tệp có `settings` hợp lệ); nút "Huỷ" · "Nhập" (**primary**, không đỏ — thêm prop `confirmVariant` cho `ConfirmDialog`).
4. "Nhập" → `importSnapshot(file, { includeSettings })` của `DataProvider` → state lạc quan cập nhật một lần → ghi repository nền theo thứ tự lessons → items → cards → study_days → settings → đóng dialog → toast "Đã nhập {a} buổi, {b} mục, {c} thẻ." (kèm " Đã cập nhật cài đặt." nếu có) → sau khi ghi xong và hàng đợi rỗng: tải lại snapshot nền để hoà giải.
5. Reset `input.value = ''` sau mỗi lần (để chọn lại cùng tệp vẫn kích hoạt `change`).

B — phụ:
- Tệp > 5 MB → lỗi "Tệp quá lớn (tối đa 5 MB)." ngay, không đọc.
- Không parse được → "Tệp không phải JSON hợp lệ."
- Parse được nhưng sai hình dạng (thiếu 5 khoá, khoá không phải mảng/đối tượng) → "Tệp không đúng định dạng của Vở Tiếng Anh. Hãy chọn tệp đã xuất từ mục Cài đặt."
- Kế hoạch rỗng (mọi bản ghi đã có y hệt hoặc bị bỏ qua) → dialog vẫn mở, mô tả "Không có gì mới để nhập. Dữ liệu trong tệp đã có sẵn.", nút "Nhập" disabled (trừ khi tick "Nhập cả cài đặt").
- Mode `supabase` mà `online === false` hoặc `pending.size > 0` → nút "Nhập dữ liệu (JSON)" **disabled** kèm dòng mute "Nhập dữ liệu cần có mạng và không còn thay đổi chờ đồng bộ." (tránh nhồi hàng trăm op vào hàng đợi localStorage — xem (5)).
- Ghi lỗi mạng giữa chừng → cơ chế 2.4 (op vào hàng đợi, toast "Chưa lưu được. Sẽ tự thử lại khi có mạng."); state đã có dữ liệu, không hoàn tác.
- Mode `local` bộ nhớ đầy → toast "Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt." (sẵn có).
- Huỷ dialog → không ghi gì; trạng thái về idle.

C — chính:
1. Trình duyệt tải `/manifest.webmanifest` (link trong `index.html`) và icon PNG trong `public/icons/`.
2. Android Chrome/Edge: menu "Thêm vào màn hình chính"/"Cài đặt ứng dụng" → mở ở `display: standalone`, màn chờ nền `#F7F5FB` với icon, thanh trạng thái `#4B2E83`.
3. iOS Safari: "Chia sẻ → Thêm vào MH chính" dùng `apple-touch-icon` 180px và `apple-mobile-web-app-title` "Vở TA"; mở không có thanh địa chỉ.
4. Desktop Chrome/Edge: biểu tượng cài đặt trong thanh địa chỉ.

C — phụ: không có service worker → không có offline, không có cache: F5 trong app cài đặt vẫn tải từ mạng; mất mạng thì màn lỗi tải 2.4.1 như trên web. Đây là chủ ý (xem (5)-C).

**(3) Dữ liệu & validation.**

A — hàm thuần `domain/paste.ts` (có test):

```ts
export const PASTE_MAX_LINES = 100
export interface ParsedRow { kind: Kind; en: string; vi: string; ipa: string; note: string; line: number /* số dòng gốc, 1-based */ }
export interface PasteResult { rows: ParsedRow[]; total: number /* dòng không trống */; missingVi: number; tooMany: boolean }
export function parsePastedList(text: string): PasteResult
export function inferKind(en: string): Kind
```

Thuật toán `parsePastedList`, theo thứ tự:
1. Chuẩn hoá: `\r\n`/`\r` → `\n`; NBSP (` `) → khoảng trắng; tách theo `\n`; `trim()` từng dòng; bỏ dòng rỗng. `total` = số dòng còn lại. Nếu `total > 100` → `{ rows: [], total, missingVi: 0, tooMany: true }`.
2. Bỏ đánh số/gạch đầu dòng ở đầu dòng, **một lần**: `^\d{1,3}[.)](?!\d)\s*` hoặc `^[-•*–—]\s+` (gạch đầu dòng phải có khoảng trắng theo sau, để không cắt "-ed ending").
3. Chọn dấu tách: thử lần lượt, lấy dấu **đầu tiên xuất hiện trong dòng**: (a) ` - ` (khoảng trắng–gạch nối–khoảng trắng); (b) ` – ` hoặc ` — ` (en/em dash có khoảng trắng hai bên); (c) một hoặc nhiều `\t`; (d) `|` (bỏ khoảng trắng quanh); (e) `:` **chỉ khi theo sau là khoảng trắng hoặc hết dòng** (để không cắt "8:30"). Không tìm thấy → cả dòng là EN.
4. Tách tối đa **3 phần** theo dấu đã chọn (hai lần xuất hiện đầu); phần dư (từ lần xuất hiện thứ 3 trở đi) nối vào phần 3 cùng dấu tách gốc. `trim()` từng phần.
5. Gán: `en = p1`; nếu `p2` bắt đầu bằng `/` → `ipa = p2`, `vi = p3 ?? ''`; ngược lại `vi = p2 ?? ''` và với `p3`: bắt đầu bằng `/` → `ipa`, còn lại → `note`.
6. IPA viết liền trong EN: nếu `en` kết thúc bằng đoạn `/…/` (regex `\s*\/[^/]+\/$`) và `ipa` đang trống → cắt đoạn đó sang `ipa`, `en` còn lại trim.
7. `kind = inferKind(en)`: bỏ dấu câu đầu/cuối, tách theo khoảng trắng; đúng 1 token → `'word'`, còn lại → `'phrase'`. Không bao giờ tự suy `'pattern'` (người dùng đổi trong select).
8. **Không** cắt chuỗi theo giới hạn 200/120 ký tự — để validation 6.6 báo lỗi tại ô sau khi thêm. `missingVi` = số hàng có `vi === ''`.

Ví dụ phải pass (test): `"1. Can I have the bill, please? - Cho tôi tính tiền"` → phrase, en/vi đúng; `"bill\thoá đơn\t/bɪl/"` → word, ipa `/bɪl/`; `"check-in | làm thủ tục | quầy số 3"` → word (1 token), note "quầy số 3"; `"hello /həˈloʊ/ – xin chào"` → en "hello", ipa "/həˈloʊ/"; `"It's 8:30 - Bây giờ 8 giờ 30"` → tách tại ` - `, en giữ "8:30"; `"Where is the toilet?"` → en, vi rỗng, tính vào `missingVi`; `"- -ed ending - đuôi -ed"` → bỏ gạch đầu dòng, en "-ed ending"; 101 dòng → `tooMany`.

B — kiểu và hàm thuần `domain/importSnapshot.ts` (có test):

```ts
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
export type ImportFileError = 'not-json' | 'bad-shape' | 'too-large'
export interface ImportFile { lessons: unknown[]; items: unknown[]; cards: unknown[]; studyDays: unknown[]; settings: unknown }
export function validateImportFile(json: unknown): { ok: true; file: ImportFile } | { ok: false; error: ImportFileError }
export interface ImportPlan {
  lessons: Lesson[]; items: Item[]; cards: Card[]                 // bản ghi sẽ upsert (đã gán user_id hiện tại)
  itemsNeedingCard: string[]                                      // item không có thẻ nào trong (tệp ∪ hiện có) → sinh en_vi
  studyDeltas: { day: string; delta: StudyTimeDelta }[]           // chỉ ngày có delta > 0 ở ít nhất một trường
  settings: Settings | null                                       // đã hợp lệ hoá + user_id hiện tại; null nếu tệp không có/không hợp lệ
  counts: { lessons: { add: number; update: number }; items: {...}; cards: {...}; studyDays: number; skipped: number }
  skippedReasons: Record<string, number>                           // để log/console, không hiển thị chi tiết
}
export function planImport(file: ImportFile, current: Snapshot, userId: string, today: string): ImportPlan
```

Mức tệp (`validateImportFile`): đối tượng JSON có đủ 5 khoá `lessons`, `items`, `cards`, `studyDays`, `settings`; 4 khoá đầu là mảng; `settings` là object hoặc `null`. Thiếu/sai → `bad-shape`. Khoá lạ bị bỏ qua. (Giữ tương thích: tệp xuất từ 6.11 chính là `Snapshot` nên luôn pass.)

Mức bản ghi (`planImport`) — bản ghi không đạt → **bỏ qua** và đếm vào `counts.skipped`, không chặn cả tệp:

| Bảng | Hợp lệ khi | Ghi chú gộp |
|---|---|---|
| `lessons` | `id` chuỗi không rỗng; `number` nguyên 1–999; `date` `YYYY-MM-DD` hợp lệ và ≤ `today + 1`; `topic` trim 1–80; `notes` ≤ 2000, `questions` ≤ 1000, `mistakes` ≤ 500 (thiếu → `''`); `created_at`/`updated_at` chuỗi ISO (thiếu/hỏng → now) | Trùng `number` với buổi hiện có **được phép** (schema đã bỏ unique). `user_id` ghi đè. |
| `items` | `id` chuỗi; `kind` ∈ `KINDS`; `en`, `vi` trim 1–200; `ipa` ≤ 120, `note` ≤ 200 (thiếu → `''`); `lesson_id` `null` hoặc tồn tại trong (lessons của tệp đã hợp lệ ∪ lessons hiện có); `pattern_id` `null` hoặc chuỗi; `position` nguyên ≥ 0 (thiếu → thứ tự trong tệp) | `pattern_id` đã có ở item hiện có **khác id** → bỏ qua (unique `(user_id, pattern_id)`); trùng `pattern_id` trong tệp → giữ bản đầu. |
| `cards` | `id` chuỗi; `item_id` tồn tại trong (items tệp hợp lệ ∪ items hiện có); `direction` ∈ `DIRECTIONS`; `due` ISO parse được; `state` 0–3; `reps`, `lapses` nguyên ≥ 0; `suspended` boolean (thiếu → false); `first_reviewed_at` null/ISO; `fsrs` object mà `deserializeCard(fsrs)` **không ném lỗi** | `(item_id, direction)` đã có ở thẻ hiện có **khác id** → bỏ qua, giữ thẻ hiện có (không gộp tiến độ FSRS); trùng trong tệp → giữ bản đầu. |
| `studyDays` | `day` hợp lệ và trong `[today − 120, today]`; `seconds`, `reviews`, `shadowing_count` nguyên ≥ 0 (thiếu → 0) | `delta[f] = max(0, imported[f] − existing[f])` với `existing` từ snapshot (0 nếu chưa có); chỉ giữ ngày có delta > 0. Ngày ngoài cửa sổ → bỏ qua (đếm). |
| `settings` | object; từng trường: `display_name` chuỗi trim ≤ 40; `daily_goal_min` nguyên 5–120; `new_cards_per_day` nguyên 5–30; `voice_name` chuỗi/null; `auto_speak` boolean | Trường không hợp lệ → **giữ giá trị hiện tại** của trường đó; `user_id` = user hiện tại. Chỉ áp dụng khi tick "Nhập cả cài đặt". |

Phân loại add/update: `add` nếu `id` chưa có trong snapshot, `update` nếu có (kể cả nội dung y hệt — không so sánh sâu). `itemsNeedingCard` = item trong kế hoạch (add hoặc update) mà không có thẻ nào với `item_id` đó trong (cards tệp hợp lệ ∪ cards hiện có) → `importSnapshot` sinh 1 thẻ `en_vi` bằng `createCardRecord` (4.3), đếm vào `cards.add`.

Action mới trong `DataProvider` (`dataContext.ts`):

```ts
/** Gộp tệp xuất vào dữ liệu hiện có (6.13-B). Resolve sau khi state lạc quan cập nhật; ghi repo chạy nền. */
importSnapshot(file: ImportFile, opts: { includeSettings: boolean }): Promise<ImportPlan['counts']>
```

Repository/đồng bộ (bắt buộc để không bắn 1 request/buổi): thêm `upsertLessons(lessons: Lesson[]): Promise<void>` vào `Repository` (2.3 cho phép thêm), cài ở `LocalRepository` (upsertById) và `SupabaseRepository` (một `upsert` mảng, bỏ `user_id`); thêm biến thể `{ type: 'upsertLessons'; lessons: Lesson[] }` vào `PendingOpPayload`, `applyOp`, `opToAction` (→ action mới `lessons/upsert`). Reducer thêm `{ type: 'import/apply'; plan: ImportPlan; includeSettings: boolean }` áp toàn bộ kế hoạch trong **một** lần dispatch (lessons/items/cards upsert theo id, `addStudyDelta` từng ngày, settings nếu tick).

C — `public/manifest.webmanifest`:

| Trường | Giá trị |
|---|---|
| `id`, `start_url`, `scope` | `"/"` |
| `name` / `short_name` | `"Vở Tiếng Anh"` / `"Vở TA"` |
| `description` | `"Vở ôn tiếng Anh giao tiếp đi kèm lớp học thật."` |
| `lang` / `dir` | `"vi"` / `"ltr"` |
| `display` | `"standalone"` |
| `background_color` / `theme_color` | `"#F7F5FB"` (`--paper`) / `"#4B2E83"` (`--purple`) — trùng tokens 5.1 và `theme-color` đã có trong `index.html` |
| `icons` | `/icons/icon-192.png` (192×192, `image/png`, `purpose: "any"`), `/icons/icon-512.png` (512×512, `"any"`), `/icons/icon-512-maskable.png` (512×512, `"maskable"`) |

`index.html` thêm trong `<head>`: `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` (180×180, không trong suốt), `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="Vở TA">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`. Giữ nguyên `favicon.svg` và `theme-color`.

Nguồn icon: tạo `public/icon-source.svg` (không commit vào manifest) từ `favicon.svg` với 3 khác biệt: **không bo góc** (`rect` full-bleed, hệ điều hành tự bo), chữ "V" và dòng kẻ thu vào **vùng an toàn 80 %** ở giữa (bản maskable), font chữ "V" đổi sang `Be Vietnam Pro`/`system-ui` **chuyển thành path** (outline) để kết quả không phụ thuộc font máy render. Từ đó rasterize 4 PNG. Cách không cần cài package (macOS, nơi đang phát triển): `qlmanage -t -s 512 -o <thư mục> public/icon-source.svg` rồi đổi tên; hoặc `rsvg-convert -w 512 -h 512` nếu có Homebrew librsvg. Nếu muốn lặp lại được bằng lệnh npm: `scripts/make-icons.mjs` dùng `@resvg/resvg-js` (devDependency, MIT, prebuilt) — chỉ thêm khi người dùng đồng ý cài package. **Provenance bắt buộc**: `public/icons/PROVENANCE.md` ghi tệp nguồn, công cụ + phiên bản, lệnh chính xác, ngày tạo, kích thước từng PNG, để người sau tái tạo được; PNG không được là ảnh lấy từ nơi khác.

**(4) Trạng thái.**

A (panel dán, trong card form, tách bằng đường kẻ 1px phía trên + padding 16px, **không** card lồng card):
- *Đóng* (mặc định): chỉ thấy nút ghost "Dán danh sách" cạnh "Thêm mục".
- *Mở, trống*: textarea (field-control, min-height 6 dòng, chữ 16px ink, không `lang="en"` vì lẫn hai thứ tiếng, `spellCheck={false}`, `autoCapitalize="off"`), mô tả 14px mute bên dưới, nút "Thêm vào buổi" disabled.
- *Có nội dung hợp lệ*: dòng tóm tắt 15px mute `aria-live="polite"` + `<ol class="paste-preview">` cuộn dọc, `max-height: 240px`, hàng cách nhau đường kẻ 1px `--rule`: `<span lang="en">` EN 16px/500 ink · VI 15px mute; thiếu VI → chữ mute nghiêng không, chỉ "chưa có nghĩa" (từ, không màu đỏ — chưa phải lỗi); IPA/ghi chú (nếu có) 14px mute sau VI. Nút "Thêm vào buổi" enabled.
- *Lỗi quá 100 dòng*: dòng lỗi 14px/500 đỏ `role="alert"` thay tóm tắt; không danh sách; nút disabled.
- *Thành công*: panel đóng, hàng mới xuất hiện trong danh sách, focus EN hàng mới đầu, toast.
- *Loading*: không có (parse đồng bộ). *Rỗng*: = trạng thái "Mở, trống". *Không hỗ trợ*: không có — dán bằng bàn phím/menu ngữ cảnh của hệ điều hành, không dùng `navigator.clipboard` nên không cần quyền.
- Mobile (< 768px): panel full-width; danh sách xem trước `max-height: 200px`; hai nút xếp ngang nếu đủ chỗ, dọc nếu < 390px.

B (khối "Dữ liệu" của Cài đặt):
- *Idle*: hai nút secondary cùng hàng (gap 12px, wrap trên mobile): "Xuất dữ liệu (JSON)" · "Nhập dữ liệu (JSON)"; mô tả mute "Tệp gồm buổi học, mục, thẻ và lịch sử ngày học của bạn. Nhập tệp đã xuất để khôi phục hoặc gộp vào dữ liệu hiện có."
- *Bị chặn* (supabase, offline hoặc còn pending): nút "Nhập…" disabled (opacity .5) + dòng mute "Nhập dữ liệu cần có mạng và không còn thay đổi chờ đồng bộ."
- *Đang đọc*: dòng 15px mute `aria-live="polite"` "Đang đọc tệp…" (Spinner nhỏ 24px bên trái); nút "Nhập…" disabled trong lúc này.
- *Lỗi tệp*: dòng 14px/500 đỏ `role="alert"` với một trong ba câu ở (6); biến mất khi chọn tệp khác.
- *Xem trước* (ConfirmDialog, `min(440px, 100vw − 32px)`): tiêu đề, mô tả, `<ul>` 4 dòng tóm tắt 16px ink (dòng "Bỏ qua {n} bản ghi…" 15px mute chỉ khi n > 0), checkbox "Nhập cả cài đặt" (label 16px, mô tả 14px mute liệt kê các trường), hàng nút "Huỷ" (secondary, nhận focus) · "Nhập" (**primary**). Kế hoạch rỗng → mô tả thay bằng câu "Không có gì mới…" và "Nhập" disabled trừ khi tick cài đặt.
- *Đang nhập*: "Nhập" disabled + nhãn "Đang nhập…" cho tới khi `importSnapshot` resolve (nhanh — chỉ dispatch + sinh thẻ thiếu); dialog đóng ngay sau.
- *Thành công*: toast "Đã nhập {a} buổi, {b} mục, {c} thẻ." (+ " Đã cập nhật cài đặt."). Các màn khác phản ánh ngay (Hôm nay, Nhật ký, Tiến độ) vì cùng snapshot.
- *Lỗi ghi*: toast chuẩn 2.4; chip "Chưa đồng bộ · {n}" trên Shell.
- *Không hỗ trợ*: `window.File`/`Blob.prototype.text` thiếu (chỉ trình duyệt rất cũ) → ẩn nút "Nhập…", dòng Info 15px ink (icon `Info` tím) "Trình duyệt này không chọn được tệp. Hãy thử Chrome, Edge hoặc Safari mới." Trên iOS Safari hộp chọn tệp mở app Tệp — hỗ trợ bình thường.

C:
- *Chưa cài*: web như hiện tại; `favicon.svg` trong tab.
- *Đang cài/màn chờ* (Android): nền `#F7F5FB`, icon 512 ở giữa, tên "Vở Tiếng Anh" — do hệ điều hành vẽ từ manifest.
- *Đã cài*: không thanh địa chỉ; thanh trạng thái tím (Android) hoặc mặc định hệ thống (iOS với `default`). Shell 6.2 không thay đổi.
- *Lỗi/không hỗ trợ*: trình duyệt không hỗ trợ manifest (Firefox desktop không có nút cài) → không có gì xảy ra, không báo lỗi; app không hiển thị lời mời cài đặt riêng (không `beforeinstallprompt` ở T18 — giữ màn sạch).
- *Mất mạng khi đã cài*: như web — màn lỗi tải 2.4.1 "Không tải được dữ liệu…" (không có offline, chủ ý).

**(5) Quy tắc nghiệp vụ.**

A:
1. Dán chỉ **điền form**, không ghi dữ liệu; mọi quy tắc lưu/sinh thẻ/validation là của 6.6. Không thêm action mới vào `DataProvider` cho A.
2. Dấu tách thử theo thứ tự cố định ở (3)-A.3, lấy dấu đầu tiên có mặt trong dòng; mỗi dòng chọn dấu tách độc lập (dòng này dùng tab, dòng kia dùng gạch vẫn được).
3. Đánh số/gạch đầu dòng chỉ bỏ ở **đầu dòng** và một lần; không đụng phần còn lại.
4. `kind`: 1 từ → `word`, còn lại `phrase`; không bao giờ `pattern`.
5. Giới hạn 100 dòng không trống mỗi lần dán (chặn, không cắt bớt). Lý do: form 6.6 render mỗi hàng ~6 control; 100 hàng vẫn mượt, hơn thì nên tách buổi.
6. Khi thêm: bỏ hàng **mới và trống hoàn toàn** ở bất kỳ vị trí nào (không đụng hàng đã có `itemId`, không đụng hàng mới đã gõ dở); hàng dán nối vào **cuối**.
7. Cảnh báo trùng `en` ("Mục này trùng với dòng {j}") của 6.6 tự áp dụng cho hàng dán — kể cả trùng với hàng gõ tay.
8. Nội dung textarea không lưu `localStorage`, không gửi đi đâu.

B:
1. **Chế độ gộp duy nhất**: upsert theo `id`; không bao giờ xoá dữ liệu hiện có; bản ghi cùng `id` bị ghi đè **toàn bộ** theo tệp (kể cả tiến độ FSRS của thẻ) — đây là ngữ nghĩa "khôi phục"; không có tuỳ chọn "thay thế toàn bộ" (xem 12.2).
2. `user_id` mọi bản ghi = user hiện tại (`local` ở chế độ cục bộ); giá trị trong tệp bị bỏ. Trên Supabase, `SupabaseRepository` vẫn bỏ `user_id` khỏi payload (2.4.10).
3. `settings` chỉ nhập khi tick; `voice_name` nhập theo tên, thiết bị không có giọng đó thì fallback như 12.1.12. Cấu hình TTS server (`vta:v1:tts`) không nằm trong tệp xuất nên không liên quan.
4. `study_days` **không cộng đôi**: delta theo từng trường = `max(0, imported − existing)`; nhập lại cùng tệp lần hai → delta 0 → không ghi. Ngày ngoài cửa sổ 120 ngày bị bỏ (vì không biết `existing` để trừ, và thống kê 4.5 cũng chỉ dùng 120 ngày).
5. Thứ tự ghi: `upsertLessons` → `upsertItems` (chunk ≤ 200) → `upsertCards` (chunk ≤ 200, gồm cả thẻ `en_vi` sinh cho `itemsNeedingCard`) → `addStudyTime` từng ngày → `saveSettings`. Tất cả trong **một** `engine.write([...])` để giữ FIFO với các op khác; mỗi chunk một op để payload hàng đợi nhỏ và lỗi FK non-retryable (2.4.11) chỉ dead-letter chunk liên quan.
6. Chặn nhập khi mode `supabase` và (`!online` hoặc `pending.size > 0`): tránh đẩy hàng trăm op vào `localStorage` (vượt 50 op → báo quá tải 2.4.3; vượt dung lượng → `persistFailed`). Mode `local` không chặn.
7. `importSnapshot` tính lại `planImport` **tại thời điểm thực thi** với snapshot hiện tại (không tin kế hoạch UI đã tính trước đó vài giây) rồi dispatch `import/apply` một lần; trả `counts` thực tế để UI hiện toast.
8. Sau khi `engine.write` resolve: nếu mode `supabase` và hàng đợi rỗng → `engine.load('background')` để hoà giải với server (phòng unique index server từ chối bản ghi nào đó). Mode `local` không cần.
9. Không nhập `review_logs` (không có trong tệp xuất — 2.3). Thẻ nhập vẫn chấm được bình thường vì FSRS nằm trong `cards.fsrs`.
10. Bản ghi bị bỏ qua chỉ hiện **tổng số**; lý do chi tiết ghi `console.warn` dạng `{ reason: count }` (không log nội dung bản ghi).
11. Tệp từ tài khoản khác nhập được (vì ghi đè `user_id`) — chấp nhận; dữ liệu là của người dùng, họ tự chịu trách nhiệm gộp.

C:
1. **Không service worker, không cache** ở T18. Lý do: app đang thay đổi hằng ngày; SW cache cũ khiến người dùng (và người test) thấy phiên bản lệch, khó gỡ trên iOS; chế độ cục bộ đã có sẵn dữ liệu trong `localStorage`, nhưng *shell* offline cần SW — để GĐ3 cùng với chiến lược cập nhật (toast "Có phiên bản mới") thay vì làm nửa vời.
2. **Không** cài `vite-plugin-pwa`: manifest tĩnh trong `public/` được Vite copy nguyên trạng và Vercel phục vụ với MIME `application/manifest+json`; plugin chỉ có giá trị khi cần SW/Workbox.
3. Màu lấy đúng tokens 5.1; không thêm màu mới. Icon theo direction contract: nền giấy, lưới mờ, lề đỏ 1px, chữ "V" mực tím; không mascot, không gradient.
4. `apple-mobile-web-app-status-bar-style="default"`: không dùng `black-translucent` vì Shell 6.2 chưa chừa `safe-area-inset-top`; đổi sau nếu muốn thanh trạng thái hoà vào thanh tím (GĐ3).
5. Không hiện lời mời cài đặt trong app (không bắt `beforeinstallprompt`), không thêm mục "Cài ứng dụng" vào Cài đặt ở T18.
6. `favicon.svg` giữ nguyên cho tab trình duyệt; PNG chỉ phục vụ manifest/iOS.

**(6) Microcopy.**

A:
- Nút: "Dán danh sách" · "Thêm vào buổi" · "Đóng".
- Nhãn textarea: "Dán mỗi dòng một mục". Mô tả: "Tiếng Anh và tiếng Việt cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ ba, nếu có, là phiên âm /…/ hoặc ghi chú." Placeholder (hai dòng): "Can I have the bill, please? - Cho tôi tính tiền⏎bill - hoá đơn - /bɪl/".
- Tóm tắt: "{n} mục sẽ được thêm" · " · {k} dòng chưa có nghĩa tiếng Việt" · hàng thiếu VI: "chưa có nghĩa".
- Lỗi: "Tối đa 100 dòng mỗi lần dán. Hiện có {total} dòng."
- Toast: "Đã thêm {n} mục. Kiểm tra rồi bấm Lưu."

B:
- Nút: "Nhập dữ liệu (JSON)". Mô tả khối: "Tệp gồm buổi học, mục, thẻ và lịch sử ngày học của bạn. Nhập tệp đã xuất để khôi phục hoặc gộp vào dữ liệu hiện có."
- Chặn: "Nhập dữ liệu cần có mạng và không còn thay đổi chờ đồng bộ."
- Đang đọc: "Đang đọc tệp…"
- Lỗi tệp: "Tệp quá lớn (tối đa 5 MB)." · "Tệp không phải JSON hợp lệ." · "Tệp không đúng định dạng của Vở Tiếng Anh. Hãy chọn tệp đã xuất từ mục Cài đặt."
- Không hỗ trợ: "Trình duyệt này không chọn được tệp. Hãy thử Chrome, Edge hoặc Safari mới."
- Dialog: tiêu đề "Nhập dữ liệu từ tệp?"; mô tả "Dữ liệu hiện có được giữ nguyên. Bản ghi trùng id sẽ được cập nhật theo tệp."; kế hoạch rỗng: "Không có gì mới để nhập. Dữ liệu trong tệp đã có sẵn."; dòng tóm tắt: "Buổi học: thêm {a}, cập nhật {b}" · "Mục: thêm {a}, cập nhật {b}" · "Thẻ ôn: thêm {a}, cập nhật {b}" · "Ngày học: cộng thêm cho {n} ngày" · "Bỏ qua {n} bản ghi không hợp lệ hoặc trùng."; checkbox "Nhập cả cài đặt" với mô tả "Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm."; nút "Huỷ" · "Nhập" · đang chạy "Đang nhập…".
- Toast: "Đã nhập {a} buổi, {b} mục, {c} thẻ." (+ " Đã cập nhật cài đặt.").

C: `name` "Vở Tiếng Anh" · `short_name` "Vở TA" · `description` "Vở ôn tiếng Anh giao tiếp đi kèm lớp học thật." · `apple-mobile-web-app-title` "Vở TA". Không có chuỗi UI mới trong app.

**(7) Tiêu chí chấp nhận.**

A — Dán danh sách (T18a)
- [ ] `parsePastedList` pass toàn bộ ví dụ ở (3)-A (test đơn vị ≥ 12 ca: 5 dấu tách, đánh số/gạch đầu dòng, 3 phần, IPA ở phần 2, IPA liền trong EN, không tách được, "8:30", NBSP/CRLF, 101 dòng, dòng rỗng xen kẽ).
- [ ] Mở `/lessons/new`, bấm "Dán danh sách" → panel mở, textarea có focus; `aria-expanded` đổi đúng; Esc không đóng panel (không phải dialog), Tab đi textarea → "Thêm vào buổi" → "Đóng".
- [ ] Dán 5 dòng hợp lệ → tóm tắt "5 mục sẽ được thêm", danh sách 5 hàng; bấm "Thêm vào buổi" → 3 hàng trống mặc định biến mất, đúng 5 hàng mới với `kind`/EN/VI/IPA/ghi chú đúng, ô phụ mở sẵn cho hàng có IPA/ghi chú, focus ở EN hàng mới đầu, toast đúng câu.
- [ ] Hàng gõ dở (có chữ) không bị xoá khi thêm; hàng dán nối sau nó.
- [ ] Dòng không tách được → hàng chỉ có EN; bấm Lưu → lỗi "Nhập nghĩa tiếng Việt." tại hàng đó; sửa xong lưu được, số thẻ `en_vi` = số hàng.
- [ ] 101 dòng → lỗi đỏ, nút disabled; xoá còn 100 → hết lỗi.
- [ ] Ctrl/Cmd+Enter trong textarea = "Thêm vào buổi"; Enter thường xuống dòng; Enter ở ô VI hàng cuối vẫn thêm hàng như 6.6.
- [ ] Dán rồi điều hướng đi → "Bỏ thay đổi?" (form dirty).
- [ ] 390px: panel không tràn ngang, danh sách xem trước cuộn được, nút ≥ 44px; không card lồng, không viền trái màu.
- [ ] `npm test`, `npm run build`, `npm run lint` pass.

B — Nhập JSON (T18b)
- [ ] `validateImportFile`: tệp xuất từ 6.11 → ok; `{}` / mảng / thiếu `cards` / `lessons` là object → `bad-shape`.
- [ ] `planImport` (test): id trùng → update, id mới → add; lesson `topic` rỗng → skipped; item `lesson_id` lạ → skipped; item `pattern_id` đã có ở id khác → skipped; card `(item_id, direction)` đã có ở id khác → skipped; card `fsrs` thiếu `dueAt` → skipped; item không có thẻ ở đâu → vào `itemsNeedingCard`; study day `seconds` 300 khi hiện có 120 → delta 180; nhập lại cùng tệp → không study delta, `counts.update` = tổng bản ghi, `add` = 0; ngày ngoài 120 ngày → skipped; `settings.daily_goal_min = 999` → giữ giá trị hiện tại cho trường đó, các trường khác vẫn nhập; `user_id` mọi bản ghi = userId truyền vào.
- [ ] Reducer `import/apply`: một dispatch áp đủ lessons/items/cards/studyDays (+settings khi tick); `applyPendingOps` hiểu op `upsertLessons`.
- [ ] `LocalRepository.upsertLessons` và `SupabaseRepository.upsertLessons` hoạt động; `applyOp` xử lý `upsertLessons`; test local repo cho upsertLessons.
- [ ] Luồng tay (local): xoá toàn bộ dữ liệu (gõ XOA) → nhập tệp đã xuất trước đó → toast đúng số; Hôm nay/Nhật ký/Tiến độ như trước khi xoá; lịch 8 tuần giống hệt (không gấp đôi phút).
- [ ] Nhập cùng tệp lần hai → dialog báo update, 0 add, "Ngày học: cộng thêm cho 0 ngày"; sau nhập số phút hôm nay không đổi.
- [ ] Tệp > 5 MB → lỗi ngay, không đọc; tệp `.txt` nội dung rác → "Tệp không phải JSON hợp lệ."; `{"a":1}` → câu "không đúng định dạng".
- [ ] Chọn lại cùng một tệp hai lần liên tiếp vẫn mở dialog (input đã reset).
- [ ] Supabase: ngắt mạng → nút disabled + dòng giải thích; có pending → cũng disabled; online và sạch → nhập được, Network tab thấy đúng thứ tự lessons → items → cards → rpc `add_study_time` → settings; dữ liệu hiện lên thiết bị khác sau khi reload.
- [ ] Nút "Nhập" trong dialog là primary (tím), "Huỷ" nhận focus khi mở; các dialog cũ (xoá, đăng xuất) vẫn đỏ.
- [ ] Không có nội dung bản ghi trong console; chỉ `{reason: count}` khi có bỏ qua.
- [ ] `npm test`, `npm run build`, `npm run lint` pass.

C — PWA cơ bản (T18c)
- [ ] `public/manifest.webmanifest` đúng bảng (3)-C; Chrome DevTools → Application → Manifest không báo lỗi/cảnh báo icon; "Installability" không liệt kê lỗi nào ngoài việc không có service worker.
- [ ] 4 PNG tồn tại đúng kích thước (192, 512, 512 maskable, 180 apple-touch), không trong suốt ở apple-touch-icon; `public/icons/PROVENANCE.md` ghi nguồn, lệnh, công cụ, ngày.
- [ ] `index.html` có `link rel=manifest`, `apple-touch-icon`, 4 meta; `npm run build` copy manifest và icons vào `dist/`; `vite preview` phục vụ `/manifest.webmanifest` với `Content-Type` chứa `manifest+json`.
- [ ] Android Chrome: cài được, mở standalone, thanh trạng thái tím, màn chờ nền giấy; iOS Safari: "Thêm vào MH chính" lấy đúng icon và tên "Vở TA", mở không thanh địa chỉ.
- [ ] Không có `serviceWorker.register` trong mã; `node_modules` không thêm `vite-plugin-pwa`/`workbox` (trừ khi người dùng chọn `@resvg/resvg-js` cho script icon).
- [ ] Lighthouse PWA (hoặc tab Application) không báo lỗi manifest; các checklist 10 khác không đổi.

**(8) Task:** T18a, T18b, T18c (mục 9).

**(9) T20 — ngôn ngữ trong dán danh sách, nhập JSON, manifest (chi tiết 6.14 (3)-E, (3)-C):**
- A: `parsePastedList(text, language = 'en')` — với `en` không đổi; với `zh`/`ja`/`ko`: phần 3 **luôn** là phiên âm (không cần `/…/`), phần 4 (nếu có) là ghi chú; `inferKind(en, language)`: `ko` tách theo khoảng trắng như cũ; `zh`/`ja` đếm **ký tự chữ** (bỏ dấu câu) — ≤ 3 → `word`, còn lại `phrase`. Mô tả panel theo ngôn ngữ (6.14 (6)).
- B: `planImport` đọc `lesson.language` (thiếu/`null` → `'en'`; chuỗi không thuộc `LANGUAGES` → bỏ qua bản ghi, lý do `lesson-invalid`), `settings.study_language` (không hợp lệ → giữ giá trị hiện tại). Tệp xuất từ bản trước T20 nhập bình thường (mọi buổi thành `en`). Câu lỗi định dạng: "Tệp không đúng định dạng của Vở Ngoại Ngữ. Hãy chọn tệp đã xuất từ mục Cài đặt." Mô tả checkbox "Nhập cả cài đặt" thêm "ngôn ngữ đang học".
- C: manifest `name` "Vở Ngoại Ngữ", `short_name` "Vở Ngoại Ngữ" (12 ký tự, trong giới hạn khuyến nghị), `description` "Vở ôn ngoại ngữ giao tiếp đi kèm lớp học thật."; `apple-mobile-web-app-title` "Vở Ngoại Ngữ"; `<title>` "Vở Ngoại Ngữ". Icon không đổi (chữ "V" vẫn đúng).

---

### 6.14 Đa ngôn ngữ học (Anh, Trung, Nhật, Hàn) và đổi tên app "Vở Ngoại Ngữ" (T20) — `domain/language.ts`, `domain/types.ts`, `supabase/schema.sql`, `repo/*`, `lib/tts/*`, `data/patterns.ts`, mở rộng 6.1–6.13

**(1) Mục đích & user story.**

App đang học lại tiếng Anh; người dùng (và người thân dùng chung app) muốn ghi cả buổi học tiếng Trung/Nhật/Hàn vào **cùng một vở**, với cùng cơ chế thẻ FSRS, giọng đọc, shadowing, chuỗi ngày. Không phải "app riêng cho từng tiếng": một vở, nhiều ngôn ngữ, mỗi trang (buổi) viết bằng một ngôn ngữ.

- *Là người học hai lớp (Anh + Trung), tôi muốn ghi buổi tiếng Trung tối nay vào vở như buổi tiếng Anh, chọn "Tiếng Trung" ở đầu trang, gõ câu – phiên âm pinyin – nghĩa, và sáng mai thẻ tiếng Trung hiện lên cùng thẻ tiếng Anh với giọng đọc đúng tiếng Trung.*
- *Là người đang tập trung thi tiếng Nhật, tôi muốn đặt "Ngôn ngữ đang học: Tiếng Nhật" để Hôm nay, Ôn thẻ, Shadowing và kho mẫu câu chỉ còn tiếng Nhật, nhưng chuỗi ngày không bị đứt khi hôm nào tôi chỉ ôn tiếng Anh.*
- *Là người mới bắt đầu tiếng Hàn, tôi muốn có sẵn vài chục câu chào hỏi, gọi món, hỏi giá, hỏi đường kèm phiên âm và nghĩa để thêm vào thẻ và nghe trước khi có bài của lớp.*
- *Là người cài app lên điện thoại, tôi muốn tên app là "Vở Ngoại Ngữ" vì nó không còn chỉ là tiếng Anh.*

**(2) Luồng.**

A — Ghi buổi học bằng ngôn ngữ khác (chính):
1. `/lessons/new` → hàng đầu form có select "Ngôn ngữ" (mặc định theo 6.6 (9)). Chọn "Tiếng Trung".
2. Nhãn ô đích đổi thành "Tiếng Trung" (`lang="zh-Hans"`, bàn phím hệ điều hành tự chuyển IME), placeholder `你好`; ô "Phiên âm" placeholder `nǐ hǎo`; mô tả "Mỗi mục sẽ thành một thẻ ôn Trung → Việt…".
3. Nhập mục (gõ tay hoặc "Dán danh sách" theo quy tắc ngôn ngữ (3)-E) → "Lưu buổi học" → `lesson.language = 'zh'`, items + thẻ `en_vi` như cũ → toast "Đã lưu buổi {n}. {k} thẻ ôn mới." → `/lessons/:id` hiển thị trang vở với câu tiếng Trung trên lưới, nút loa đọc bằng giọng `zh-CN`.

B — Đổi "Ngôn ngữ đang học" (chính):
1. `/settings` → khối "Ngôn ngữ" → select "Ngôn ngữ đang học" → chọn "Tiếng Trung" → lưu ngay (toast "Đã lưu."), đồng bộ như mọi `settings`.
2. Về `/`: số thẻ đến hạn chỉ đếm thẻ tiếng Trung; trang vở là buổi tiếng Trung gần nhất; dòng phụ có hậu tố "· Tiếng Trung". `/review`, `/shadowing`, `/patterns`, `/progress` (khối thẻ) lọc theo. `/lessons` không lọc, chỉ gắn nhãn ngôn ngữ.
3. Chọn lại "Tất cả" → mọi màn như trước T20.

C — Ôn thẻ / Shadowing với giọng đúng ngôn ngữ (chính):
1. Thẻ tiếng Nhật hiện lên: hàng meta "Thẻ 3/12 · Nhật → Việt"; bấm loa → `speak(text, { lang: 'ja' })` → router chọn `web-speech`, utterance `lang='ja-JP'`, giọng `ja-*` đầu tiên theo (5).6.
2. Thẻ `listen` tiếng Nhật: "Nghe" → gõ bằng IME → "Kiểm tra" → so khớp bỏ dấu câu/khoảng trắng (4.7).
3. Shadowing: chọn buổi tiếng Nhật hoặc tình huống `ja-*`; "Nghe mẫu" với rate 0.5/0.75/1 bằng giọng `ja`; ghi âm, nghe lại như cũ.

D — Kho mẫu câu (chính): `/patterns` với "Tất cả" → 4 nhóm theo ngôn ngữ; mở `ja-restaurant` → 5 câu tiếng Nhật, phiên âm romaji, nghĩa Việt, "Lưu ý phát âm" tiếng Việt → "Thêm vào thẻ ôn" → item `lesson_id=null, pattern_id='ja-restaurant-01'` → ngôn ngữ thẻ suy ra `ja` qua `situationOfPattern`.

E — Dữ liệu cũ (tự động): sau deploy, người dùng cũ mở app → `loadSnapshot` đọc buổi thiếu `language` → `'en'`; `settings.study_language` thiếu → `'all'`; mọi màn giống hệt trước T20 (không có nhãn ngôn ngữ vì chỉ có một ngôn ngữ). Chủ Supabase chạy lại `schema.sql` (3.2) một lần.

F — Đổi tên (một lần, T20c): `APP_NAME`, `<title>`, manifest, `apple-mobile-web-app-title`, Đăng nhập, Shadowing EmptyState, thông báo lỗi nhập JSON, tên tệp xuất, README, dòng tên trong PRODUCT.md.

Luồng phụ:
- **Thiết bị không có giọng ngôn ngữ đó** (Web Speech có, `getVoices()` không có `zh*`): nút loa ẩn; màn có câu đích hiện **một** dòng Info "Thiết bị chưa có giọng tiếng Trung. Bạn vẫn đọc được phiên âm." (5.6 kiểu không hỗ trợ — tím, không đỏ); thẻ `listen` tiếng Trung tạm ẩn khỏi hàng đợi (4.4 1b) và đếm vào "{k} thẻ nghe tạm ẩn". Cài đặt → "Ngôn ngữ" hiện dòng tình trạng giọng từng ngôn ngữ để người dùng biết cần cài giọng trong hệ điều hành.
- **Chrome tải giọng trễ** (`voiceschanged`): `canSpeakLang` là external store nghe `subscribe()` của facade (đã có `voiceschanged`) → Hôm nay/Shadowing/Cài đặt cập nhật tự động; Ôn thẻ tính hàng đợi một lần khi vào phiên (như hiện tại) — vào phiên quá sớm có thể thiếu thẻ listen CJK; chấp nhận (lần vào sau có).
- **Supabase chưa migrate**: 3.2 — gửi lại không cột mới + toast 1 lần/phiên; không mất dữ liệu khác.
- **Bộ lọc trỏ vào ngôn ngữ chưa có dữ liệu**: Hôm nay trạng thái "chưa có thẻ {tên}" với ghost "Học tất cả ngôn ngữ" (6.3 (9)); Ôn thẻ rỗng "Không có thẻ {tên} nào đến hạn."; Shadowing không có buổi ngôn ngữ đó → sang "Mẫu câu" với tình huống đầu của ngôn ngữ đó (luôn có vì có bộ khởi đầu); Tiến độ khối thẻ toàn 0.
- **Đổi ngôn ngữ buổi đã ôn**: select khoá (6.6 (9)). Người dùng muốn đổi thật sự → xoá các mục (mất tiến độ) hoặc tạo buổi mới.
- **JSON nhập có `language` lạ** → bản ghi buổi bị bỏ qua (đếm `skipped`), các item của buổi đó cũng bị bỏ vì `lesson_id` không tồn tại (quy tắc T18b sẵn có).
- **Câu đích dán có cả hai thứ tiếng trộn** (vd "こんにちは (konnichiwa)") → không tách phiên âm tự động; người dùng tự sửa ô. Không đoán.

**(3) Dữ liệu & validation.**

*A — Kiểu và helper thuần (`domain/types.ts` đã nêu ở 3.1; mới: `domain/language.ts`, có test `domain/language.test.ts`):*

```ts
// domain/language.ts (thuần, không React; được phép import data/patterns để suy ngôn ngữ item thư viện)
export const LANGUAGE_LABELS: Record<Language, string> = { en: 'Tiếng Anh', zh: 'Tiếng Trung', ja: 'Tiếng Nhật', ko: 'Tiếng Hàn' }
export const LANGUAGE_SHORT:  Record<Language, string> = { en: 'Anh', zh: 'Trung', ja: 'Nhật', ko: 'Hàn' }
export const STUDY_LANGUAGE_LABELS: Record<StudyLanguageFilter, string> = { all: 'Tất cả', ...LANGUAGE_LABELS }
export const LANG_TAG:   Record<Language, string> = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' }        // thuộc tính HTML lang cho câu đích
export const ROMAN_TAG:  Record<Language, string> = { en: 'en', zh: 'zh-Latn', ja: 'ja-Latn', ko: 'ko-Latn' } // cho phiên âm
export const TTS_TAG:    Record<Language, string> = { en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' }   // BCP-47 cho SpeechSynthesisUtterance
export const TARGET_PLACEHOLDER: Record<Language, string> = { en: 'Can I have the bill, please?', zh: '你好', ja: 'こんにちは', ko: '안녕하세요' }
export const IPA_PLACEHOLDER:    Record<Language, string> = { en: '/kæn aɪ hæv ðə bɪl/', zh: 'nǐ hǎo', ja: 'konnichiwa', ko: 'annyeonghaseyo' }
export function isLanguage(x: unknown): x is Language
export function asLanguage(x: unknown, fallback: Language = 'en'): Language
export function isStudyLanguage(x: unknown): x is StudyLanguageFilter
export function asStudyLanguage(x: unknown): StudyLanguageFilter            // không hợp lệ → 'all'
export function lessonLanguage(l: Pick<Lesson, 'language'> | undefined): Language   // l?.language ?? 'en' (qua asLanguage)
export function directionLabel(d: Direction, lang: Language): string      // en_vi → `${SHORT} → Việt`; vi_en → `Việt → ${SHORT}`; listen → 'Nghe → gõ'
export function itemLanguageResolver(lessons: readonly Lesson[]): (item: Pick<Item, 'lesson_id' | 'pattern_id'>) => Language
//   lesson_id có và tìm thấy → lesson.language; không có lesson_id và pattern_id có → language của situationOfPattern(pattern_id); còn lại → 'en'
export function languagesInUse(lessons: readonly Lesson[]): Language[]    // theo thứ tự LANGUAGES, chỉ ngôn ngữ có ≥ 1 buổi
export function latestLessonOf(lessons: readonly Lesson[], filter: StudyLanguageFilter): Lesson | undefined // sortLessons rồi lọc
export function defaultLessonLanguage(lessons: readonly Lesson[], filter: StudyLanguageFilter): Language    // 6.6 (9) quy tắc mặc định
export function matchesFilter(lang: Language, filter: StudyLanguageFilter): boolean   // filter === 'all' || lang === filter
```

`DIRECTION_LABELS` trong `types.ts` **giữ nguyên** (= `directionLabel(d, 'en')`) để code/test cũ không đổi; UI mới gọi `directionLabel`.

Validation (`domain/lessons.ts`): `LessonInput.language: Language`; `validateLesson` thêm lỗi `language` "Chọn ngôn ngữ." khi giá trị không thuộc `LANGUAGES` (chỉ xảy ra khi state hỏng; select không cho giá trị khác). `validateItem(input, { required?, language? = 'en' })`: câu lỗi thiếu ô đích theo `LANGUAGE_LABELS` viết thường sau "Nhập " ("Nhập tiếng Trung."). Giới hạn ký tự 200/120 **không đổi** cho mọi ngôn ngữ (đếm theo `length` UTF-16 như check constraint `char_length` — khác nhau không đáng kể với BMP; không có emoji trong câu học).

*B — Repository:*
- `repo/supabase.ts`: `LessonRow.language?: string | null`, `SettingsRow.study_language?: string | null`; `toLesson` → `language: asLanguage(r.language)`; `toSettings` → `study_language: asStudyLanguage(r.study_language)`; `defaultSettings()` thêm `study_language: 'all'`. Xử lý `PGRST204` theo 3.2: hàm `stripNewColumns(payload)` bỏ `language`/`study_language`; `isSchemaOutdatedError(e)` = `e.code === 'PGRST204'`; thử lại một lần; `schemaOutdated` là biến module + `onSchemaOutdated` callback để `DataProvider` nối toast (giống `setNotifier` của TTS). Test `repo/supabase.test.ts`: (a) row thiếu `language` → `'en'`; (b) upsert trả PGRST204 → gọi lại không có `language`, callback 1 lần dù lỗi 3 lần.
- `repo/local.ts`: `loadSnapshot` map `lessons` qua `{ ...l, language: asLanguage(l.language) }`; settings merge có `study_language: asStudyLanguage(stored.study_language)`. Không đổi khoá. Test: dữ liệu `vta:v1:lessons` cũ (không `language`) → đọc ra `'en'`; ghi rồi đọc giữ `'zh'`.
- `repo/pending.ts`: không đổi (payload mang nguyên `Lesson`).
- `state/dataReducer.ts`: không đổi hình dạng action; `settings/save` chứa `study_language`.

*C — Settings & import:*
- `domain/settingsLimits.ts`: thêm `isStudyLanguage` re-export hoặc dùng từ `domain/language.ts`; `importSnapshot.ts` phần settings: `study_language` hợp lệ → nhận, không → giữ hiện tại; phần lessons: `language = raw.language == null ? 'en' : (isLanguage(raw.language) ? raw.language : null)`; `null` → `skip('lesson-invalid')`.
- Dialog nhập: mô tả checkbox "Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm, ngôn ngữ đang học."

*D — TTS (`lib/ttsConfig.ts`, `lib/tts/*`, `hooks/useTts.ts`, `components/SpeakButton.tsx`):*
- `TtsLang = 'en' | 'vi' | 'zh' | 'ja' | 'ko'`; `ServerLang = 'en' | 'vi'`; `isServerLang(x)`. `TtsConfig` **không đổi** (`vi`, `en`). `MODEL`, `DEFAULT_VOICE`: `Record<ServerLang, string>`. `TOAST_DOWN: Record<ServerLang, string>`.
- `TtsRouter`: `servers: Record<ServerLang, TtsProvider>`; `health`/`timers` theo `ServerLang`; `resolve(lang)`: `isServerLang(lang) && serverEnabled(lang) && health[lang] !== 'down'` → server; `lang === 'en'` → `web.supports('en') ? web : null`; `lang === 'vi'` → `deviceFallback && web.supports('vi') ? web : null`; `zh|ja|ko` → `web.supports(lang) ? web : null`. Nhánh fallback/markDown/toast chỉ chạy khi `isServer` (không đổi). `probe/listVoices(lang)` chỉ nhận `ServerLang` (kiểu hẹp lại; Settings chỉ gọi en/vi).
- `WebSpeechProvider`: `supports(lang)`: `en` → `isTtsSupported()`; khác → `pickVoiceFor(lang) !== undefined`. `speak(req)`: `en` → `lib/speech.ts` (không đổi); khác → `speakWithVoice(req, voice, TTS_TAG[lang])` — tổng quát hoá `speakVi` hiện có thành hàm dùng chung cho `vi|zh|ja|ko` (utterance `lang = voice.lang`, `rate = req.rate`, cùng cơ chế settle/timeout; hệ số timeout `text.length * 120 / rate + 5000` giữ — với CJK `length` nhỏ hơn nhưng mỗi ký tự đọc lâu hơn, nên dùng `max(text.length * 400, 3000) / rate + 5000` cho `zh|ja|ko`). `listVoices()` giữ tiếng Anh. `stopAll()` không đổi.
- `pickVoiceFor(lang)` (hàm thuần trong `webSpeech.ts`, test với mảng voice giả): chuẩn hoá `v.lang.replace('_','-').toLowerCase()`; thứ tự ưu tiên: (1) khớp đúng `TTS_TAG[lang]` thường hoá (`zh-cn`, `ja-jp`, `ko-kr`, `vi-vn`); (2) với `zh`: bất kỳ `zh-*` **trừ** `zh-hk`, `zh-tw`, `yue*` (Quảng Đông/phồn thể đọc khác), rồi (3) bất kỳ `zh-*`/`cmn*`; với `ja|ko|vi`: bất kỳ `ja*`/`ko*`/`vi*`. Trong cùng bậc ưu tiên: giọng `localService` trước, rồi `default`, rồi thứ tự gốc. Không có `voice_name` theo ngôn ngữ ở T20 (12.2).
- `lib/tts/text.ts` `prepareText(text, lang)`: thêm dấu ngắt câu CJK `。！？` vào tập ranh giới chia đoạn; `{slot}` → "…" cho mọi ngôn ngữ khác `en` (như `vi`).
- Facade `index.ts`: `canSpeak(lang)` đã có → dùng cho mọi `TtsLang`; `effectiveRate` không đổi (`vi` dùng `config.vi.speed`, còn lại 1).
- `hooks/useTts.ts`: thêm `canSpeakLang(lang: Language): boolean` = `useSyncExternalStore(subscribe, () => canSpeak(lang))` — vì hook không nhận tham số động cho nhiều ngôn ngữ, cài bằng một snapshot `speakable: Record<Language, boolean>` (một `useSyncExternalStore` trả object ổn định theo chuỗi `"1010"`), và `canSpeakLang = (l) => speakable[l]`. `supported` giữ nghĩa Web Speech. `speak(text, { rate, lang })` nhận `TtsLang` mở rộng.
- `components/SpeakButton.tsx`: `lang?: TtsLang` (mặc định `'en'`); ẩn khi `lang === 'en' ? !supported : !canSpeakLang(lang)` (`vi` tiếp tục theo `viAvailable`, là trường hợp riêng của `canSpeak('vi')`). `TtsUnsupportedNote` thêm prop `lang?: Language` → mặc định câu cũ; có `lang` ≠ en và Web Speech có → "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn đọc được phiên âm."
- `routes/lessonReadAloud.ts`: `buildReadAloudSteps(items, includeVi, language: Language = 'en')` → bước đích `lang: language`.

*E — Dán danh sách (`domain/paste.ts`):* `parsePastedList(text, language: Language = 'en')`, `inferKind(en, language = 'en')`.
- `en`: thuật toán 6.13 (3)-A không đổi.
- `zh|ja|ko`: bước 5 thay bằng: `en = p1`; `vi = p2 ?? ''`; `ipa = p3 ?? ''`; `note = p4 ?? ''` (tách tối đa **4** phần; phần dư nối vào phần 4). Bước 6 (IPA liền `/…/`) chỉ cho `en`. `inferKind`: `ko` → như `en` (tách khoảng trắng); `zh|ja` → đếm ký tự thuộc `\p{L}|\p{N}` sau khi bỏ dấu câu: ≤ 3 → `word`, ngược lại `phrase`.
- Ví dụ phải pass: `"你好 - xin chào - nǐ hǎo"` (zh) → en `你好`, vi `xin chào`, ipa `nǐ hǎo`, kind `word`; `"请给我菜单。 | Cho tôi xem thực đơn. | qǐng gěi wǒ càidān | lịch sự"` → 4 phần đúng, kind `phrase`; `"こんにちは\tXin chào\tkonnichiwa"` (ja) → kind `phrase` (5 ký tự); `"안녕하세요 - Xin chào - annyeonghaseyo"` (ko) → kind `word` (1 token); `"hello /həˈloʊ/ – xin chào"` với `language='en'` → như T18a; cùng chuỗi với `language='ja'` → en `hello /həˈloʊ/` nguyên (không cắt IPA liền).

*F — Kho mẫu câu (`data/patterns.ts`):*
- `Situation` thêm `language: Language` (bắt buộc) và `nameTarget?: string` (tên tình huống bằng ngôn ngữ đích; bắt buộc với `zh|ja|ko`, hiển thị thay `nameEn`). 9 tình huống hiện có: `language: 'en'`, không sửa nội dung khác. `Pattern` **không đổi** (`en` = câu đích, `ipa` = phiên âm, `vi`, `level`, `slots?`, `note?`).
- **Bộ khởi đầu** 12 tình huống, id `{lang}-{slug}`: `zh-greetings`, `zh-restaurant`, `zh-shopping`, `zh-directions`, `ja-greetings`, `ja-restaurant`, `ja-shopping`, `ja-directions`, `ko-greetings`, `ko-restaurant`, `ko-shopping`, `ko-directions`. `nameVi` lần lượt "Chào hỏi & giới thiệu" · "Nhà hàng & gọi món" · "Mua sắm & hỏi giá" · "Hỏi đường & đi lại"; `icon` dùng lại icon của tình huống EN tương ứng (`greetings`/`ordering`/`shopping`/`directions`) để không thêm map icon mới. Mỗi tình huống **đúng 5** mẫu câu, id `{situationId}-01..05`, `level: 'A1'`, **không dùng `slots`** (giữ bộ khởi đầu đơn giản, dễ kiểm phiên âm), `note` tuỳ chọn (lưu ý phát âm cho người Việt), `intro` và `pronunciationFocus` tiếng Việt (bắt buộc, 1–2 câu).
- **Nội dung bắt buộc theo nghĩa** (mỗi ngôn ngữ dịch cùng 20 ý sau, câu ngắn, thông dụng, lịch sự ở mức trung tính — zh: dạng 您/请 khi phù hợp; ja: thể です/ます; ko: 해요체):
  - Chào hỏi & giới thiệu: 01 "Xin chào." · 02 "Tôi tên là … (dùng tên ví dụ phổ biến bản xứ)." · 03 "Rất vui được gặp bạn." · 04 "Bạn khoẻ không?" · 05 "Tạm biệt. Hẹn gặp lại."
  - Nhà hàng & gọi món: 01 "Cho tôi xem thực đơn." · 02 "Tôi muốn gọi món này." · 03 "Cho tôi một ly nước." · 04 "Tính tiền giúp tôi." · 05 "Ngon lắm, cảm ơn."
  - Mua sắm & hỏi giá: 01 "Cái này bao nhiêu tiền?" · 02 "Đắt quá." · 03 "Bớt chút được không?" · 04 "Tôi lấy cái này." · 05 "Có cỡ khác không?"
  - Hỏi đường & đi lại: 01 "Xin lỗi, nhà ga ở đâu?" · 02 "Đi thẳng rồi rẽ trái." · 03 "Có xa không?" · 04 "Xe buýt này có đến … không?" · 05 "Cảm ơn nhiều."
- **Chuẩn phiên âm** (reviewer kiểm từng câu):
  - `zh`: Hanyu Pinyin **có dấu thanh** (ā á ǎ à, ü), tách theo từ (vd `qǐng gěi wǒ càidān`, không `qing3`), chữ thường, dấu câu giữ `,`/`?`; biến điệu **không** ghi vào pinyin (viết `nǐ hǎo`, ghi chú biến điệu trong `note` nếu cần). Chữ Hán **giản thể**.
  - `ja`: Hepburn, nguyên âm dài bằng macron (`ō`, `ū`; vd `arigatō`), trợ từ は/へ/を viết `wa`/`e`/`o`, `n` trước nguyên âm có dấu `'` (`kon'nichiwa` chấp nhận; chọn một cách và dùng nhất quán trong file — mặc định `konnichiwa` không dấu), tách theo từ. Câu dùng kana + kanji thông dụng N5.
  - `ko`: Revised Romanization (2000), tách theo từ như tiếng Hàn (vd `igeo eolmayeyo`), không gạch nối bắt buộc.
  - `en`: như hiện tại (`/…/`).
- Ví dụ định dạng (một mẫu mỗi ngôn ngữ; coder viết phần còn lại):
  ```ts
  { id: 'zh-greetings-01', en: '你好！', vi: 'Xin chào!', ipa: 'nǐ hǎo', level: 'A1',
    note: 'Hai thanh 3 liền nhau: chữ đầu đọc thành thanh 2 (ní hǎo). Đừng đọc đều đều như tiếng Việt không dấu.' }
  { id: 'ja-greetings-01', en: 'こんにちは。', vi: 'Xin chào (ban ngày).', ipa: 'konnichiwa', level: 'A1',
    note: 'は cuối câu chào đọc là "wa". Mỗi âm tiết dài bằng nhau, không nhấn mạnh như tiếng Việt.' }
  { id: 'ko-greetings-01', en: '안녕하세요.', vi: 'Xin chào.', ipa: 'annyeonghaseyo', level: 'A1',
    note: 'Âm cuối "ng" trong 안녕 rõ; 세요 đọc liền, lên giọng nhẹ ở cuối khi hỏi thăm.' }
  ```
- `PATTERN_COUNT = 147`. Test `data/patterns.test.ts` cập nhật: 21 tình huống; `language ∈ LANGUAGES`; tình huống `en` 8–10 mẫu và `ipa` dạng `/…/`; tình huống khác đúng 5 mẫu, có `nameTarget`, `ipa` không rỗng và **không chứa** `/`, `en` chứa ký tự đúng hệ chữ (`zh`: `\p{Script=Han}`; `ja`: Hiragana/Katakana/Han; `ko`: `\p{Script=Hangul}`), `ipa` chỉ gồm chữ Latin cho phép + khoảng trắng + `,.?!'’-` (`zh` thêm dấu thanh `āáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ`; `ja` thêm `āīūēō`; `ko` chỉ a–z); mọi test cũ về slot/id vẫn chạy cho toàn bộ.
- Helper mới: `situationsOf(filter: StudyLanguageFilter): Situation[]` (lọc), `firstSituationId(lang: Language): string`, `languageOfPattern(patternId): Language | undefined`.

**(4) Trạng thái (tổng hợp theo màn; chi tiết từng màn ở mục (9) của 6.1–6.13).**

| Màn | Lọc theo "Ngôn ngữ đang học" | Thay đổi hiển thị | Thiếu giọng ngôn ngữ đích |
|---|---|---|---|
| Hôm nay | Có (queue, khó nhất, buổi gần nhất) | hậu tố "· {Tên}" ở dòng phút; trạng thái "chưa có thẻ {tên}" + ghost "Học tất cả ngôn ngữ" | "· {k} thẻ nghe tạm ẩn" |
| Nhật ký (danh sách) | **Không** | nhãn "{Tên}" mute khi > 1 ngôn ngữ | — |
| Trang buổi học | — | `lang` đúng; dateLine "· {Tên}" khi > 1 ngôn ngữ | loa ẩn + 1 dòng Info; "Nghe cả trang" ẩn |
| Tạo/sửa buổi | Mặc định select | select "Ngôn ngữ"; nhãn/placeholder theo ngôn ngữ; khoá khi đã ôn | — |
| Ôn thẻ | Có (trừ `?lesson`) | nhãn chiều theo ngôn ngữ; `lang` đúng; so khớp CJK | listen ẩn + dòng Info đầu phiên |
| Mẫu câu | Có; Tất cả → nhóm | 12 tình huống mới; `nameTarget` | loa ẩn + 1 dòng Info |
| Shadowing | Có (buổi gần nhất, select tình huống) | `lang` đúng; line-height CJK | "Nghe mẫu" ẩn + Info |
| Tiến độ | Chỉ khối "Thẻ ôn" | tiêu đề "Thẻ ôn · {Tên}" + dòng giải thích | — |
| Cài đặt | — | khối "Ngôn ngữ" mới; dòng tình trạng giọng | "chưa có" trong dòng tình trạng |
| Đăng nhập / Shell / manifest | — | tên "Vở Ngoại Ngữ" | — |

Trạng thái chung:
- *Loading*: không có loading mới (dữ liệu từ snapshot; voices theo `voiceschanged`).
- *Rỗng*: theo bảng; mọi câu rỗng có tên ngôn ngữ khi đang lọc.
- *Lỗi*: chỉ thêm toast schema (3.2) và lỗi validation "Chọn ngôn ngữ." (hiếm).
- *Thành công*: toast hiện có ("Đã lưu buổi…", "Đã lưu.", "Đã thêm vào thẻ ôn.").
- *Trình duyệt không hỗ trợ*: Web Speech thiếu → như trước T20 (câu cũ). Web Speech có nhưng thiếu giọng ngôn ngữ → câu mới "Thiết bị chưa có giọng {tên}…". Trình duyệt không có font CJK hệ thống (rất hiếm trên macOS/iOS/Windows/Android hiện đại) → chữ hiện ô vuông; không xử lý thêm (không tải font mạng — 1.5).

**(5) Quy tắc nghiệp vụ (bất biến).**

1. **Thẻ FSRS không đổi**: không thêm cột vào `cards`, không đổi `lib/fsrs.ts`, không đổi quy tắc mở khoá 4.3, hạn mức thẻ mới 4.4 là **một hạn mức chung** cho cả vở.
2. **Tên trường `items.en` giữ nguyên**, gọi là "câu ngôn ngữ đích" trong tài liệu/JSDoc. Lý do: đổi tên cột cần `alter table rename` (không idempotent-an toàn khi chạy lại file schema), đổi ~30 file + test, tệp JSON đã xuất và op trong hàng đợi pending của client cũ vẫn mang `en` → nguy cơ mất dữ liệu khi replay; lợi ích chỉ là tên đẹp. Tương tự giữ `ipa` (nhãn UI "Phiên âm"), giữ mã `Direction` `en_vi/vi_en/listen`.
3. **Ngôn ngữ của card = ngôn ngữ của item**, suy ra qua `itemLanguageResolver(lessons)`: item thuộc buổi → `lesson.language`; item thư viện → `situation.language` của `pattern_id`; không xác định → `'en'`. Không lưu trùng ở items/cards.
4. **Một buổi một ngôn ngữ**; khoá đổi khi buổi có thẻ `reps > 0` (6.6 (9)).
5. **Bộ lọc** `settings.study_language` áp cho: hàng đợi Hôm nay/Ôn thẻ (trừ `?lesson=`), thẻ khó nhất, buổi gần nhất trên Hôm nay, Shadowing (buổi gần nhất + tình huống), Kho mẫu câu, khối "Thẻ ôn" của Tiến độ. **Không** áp cho: danh sách Nhật ký, trang buổi học, chuỗi ngày, phút, lịch 8 tuần, mục tiêu ngày, xuất/nhập JSON, hạn mức thẻ mới. Khi lọc, thứ tự và tie-break hàng đợi tuân 4.4 nguyên vẹn.
6. **Giọng đọc**: `en→en-US`, `zh→zh-CN`, `ja→ja-JP`, `ko→ko-KR`; `zh|ja|ko` luôn Web Speech, chọn giọng theo (3)-D `pickVoiceFor`; thiếu giọng → ẩn nút + Info, không toast, không lỗi đỏ. Server local (T19) chỉ cho `en` (và `vi`). `auto_speak` đọc câu đích bằng ngôn ngữ của thẻ. Không tự phát khi vào trang (không đổi).
7. **Thuộc tính `lang`** đúng theo ngôn ngữ trên mọi câu đích/phiên âm (5.2); `<html lang="vi">` không đổi.
8. **Font**: chỉ font hệ thống cho CJK qua `--font-zh/ja/ko`; không thêm request font. Cỡ chữ giữ; line-height CJK ≥ 1.4 ở hai chỗ nêu 5.2.
9. **Dữ liệu cũ** = `en`; migration idempotent; client chịu được server chưa migrate (3.2).
10. **Seed**: không sửa 9 tình huống EN ngoài thêm `language`; 12 tình huống mới đúng cấu trúc (3)-F; nội dung do coder viết, reviewer kiểm phiên âm theo chuẩn (3)-F và nghĩa khớp 20 ý bắt buộc.
11. **Tên app**: một hằng `APP_NAME = 'Vở Ngoại Ngữ'`; mọi nơi UI đọc từ đó. `index.html` và `manifest.webmanifest` là văn bản tĩnh, sửa tay; kiểm bằng checklist mục 10 và lệnh `grep -rn "Vở Tiếng Anh" src index.html public README.md` → 0 kết quả (không viết test đọc tệp tĩnh). Domain Vercel giữ nguyên.
12. **Không đổi khoá `localStorage`**, không đổi `vta:v1:tts`, không đổi tên bảng.

**(6) Microcopy (nguyên văn; thêm vào Phụ lục A).**

- Tên ngôn ngữ: "Tiếng Anh" · "Tiếng Trung" · "Tiếng Nhật" · "Tiếng Hàn" · "Tất cả". Dạng ngắn: "Anh" · "Trung" · "Nhật" · "Hàn".
- Chiều ôn: "Anh → Việt" · "Trung → Việt" · "Nhật → Việt" · "Hàn → Việt" · "Việt → Anh" · "Việt → Trung" · "Việt → Nhật" · "Việt → Hàn" · "Nghe → gõ".
- Form buổi học: nhãn "Ngôn ngữ"; nhãn ô đích = tên ngôn ngữ; nhãn "Phiên âm"; placeholder đích `Can I have the bill, please?` / `你好` / `こんにちは` / `안녕하세요`; placeholder phiên âm `/kæn aɪ hæv ðə bɪl/` / `nǐ hǎo` / `konnichiwa` / `annyeonghaseyo`; lỗi "Nhập tiếng Anh." / "Nhập tiếng Trung." / "Nhập tiếng Nhật." / "Nhập tiếng Hàn." · "Chọn ngôn ngữ."; khoá: "Buổi này đã có thẻ được ôn nên không đổi ngôn ngữ được."; mô tả: "Mỗi mục sẽ thành một thẻ ôn {Ngắn} → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau."
- Dán danh sách (zh/ja/ko): mô tả "Câu, nghĩa tiếng Việt và phiên âm cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ tư, nếu có, là ghi chú."; placeholder `你好 - Xin chào - nǐ hǎo` / `こんにちは - Xin chào - konnichiwa` / `안녕하세요 - Xin chào - annyeonghaseyo` (một dòng). Với `en` giữ câu T18a.
- Cài đặt: H2 "Ngôn ngữ"; nhãn "Ngôn ngữ đang học"; mô tả "Lọc thẻ ôn, shadowing, kho mẫu câu và thống kê thẻ theo một ngôn ngữ. Nhật ký buổi học, chuỗi ngày và phút học luôn tính chung."; dòng giọng "Giọng đọc trên thiết bị này: Anh — có · Trung — có · Nhật — chưa có · Hàn — có" ("có"/"chưa có"); không Web Speech: "Trình duyệt này không có giọng đọc."
- Hôm nay: hậu tố " · {Tên ngôn ngữ}"; rỗng lọc: "Chưa có thẻ {tên ngôn ngữ} nào. Ghi buổi học hoặc thêm mẫu câu {tên ngôn ngữ}." ("tiếng Trung" viết thường giữa câu); ghost "Học tất cả ngôn ngữ".
- Ôn thẻ: rỗng lọc "Không có thẻ {tên ngôn ngữ} nào đến hạn."; ẩn listen: "Đã tạm ẩn {k} thẻ nghe vì thiết bị chưa có giọng đọc phù hợp."; gợi ý listen CJK: "Dấu câu và khoảng trắng không tính."
- Thiếu giọng (Info, dùng chung): "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn đọc được phiên âm." · Shadowing: "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn có thể ghi âm và nghe lại."
- Nhật ký: nhãn hàng "{Tên ngôn ngữ}". Trang buổi học: dateLine "Buổi {n} · {ngày} · {Tên ngôn ngữ}".
- Mẫu câu: heading nhóm = tên ngôn ngữ; mô tả trang "Câu ngắn theo tình huống thật, bằng ngôn ngữ bạn đang học. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay."; `nameVi` 12 tình huống: "Chào hỏi & giới thiệu" · "Nhà hàng & gọi món" · "Mua sắm & hỏi giá" · "Hỏi đường & đi lại".
- Tiến độ: "Thẻ ôn · {Tên ngôn ngữ}" · "Chuỗi ngày và phút học tính chung mọi ngôn ngữ."
- Đồng bộ: toast "Supabase chưa có cột ngôn ngữ. Chạy lại supabase/schema.sql để lưu ngôn ngữ buổi học."
- Nhập JSON: "Tệp không đúng định dạng của Vở Ngoại Ngữ. Hãy chọn tệp đã xuất từ mục Cài đặt." · mô tả checkbox "Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm, ngôn ngữ đang học."
- Tên app: "Vở Ngoại Ngữ" (title, Shell, Đăng nhập, manifest name/short_name, apple title); Đăng nhập phụ đề "Học lại ngoại ngữ giao tiếp, mỗi ngày một ít."; manifest description "Vở ôn ngoại ngữ giao tiếp đi kèm lớp học thật."; Shadowing EmptyState "Hãy mở Vở Ngoại Ngữ bằng Chrome hoặc Edge để luyện shadowing."; tệp xuất `vo-ngoai-ngu-{YYYY-MM-DD}.json`.

**(7) Tiêu chí chấp nhận.**

T20a — data model, migration, repository, import/paste, bộ lọc
- [ ] `domain/language.test.ts`: `asLanguage('zh')='zh'`, `asLanguage(undefined)='en'`, `asLanguage('fr')='en'`; `asStudyLanguage('x')='all'`; `directionLabel('en_vi','ko')='Hàn → Việt'`, `('vi_en','zh')='Việt → Trung'`, `('listen','ja')='Nghe → gõ'`; `itemLanguageResolver`: item buổi zh → `zh`, item `pattern_id='ja-restaurant-01'` → `ja`, item `pattern_id='greetings-01'` → `en`, item mồ côi → `en`; `languagesInUse` đúng thứ tự `LANGUAGES`; `defaultLessonLanguage`: filter zh → zh; all + buổi gần nhất ko → ko; all + không buổi → en.
- [ ] `schema.sql` chạy **hai lần** liên tiếp không lỗi; `lessons.language` default `'en'`, check 4 giá trị; `settings.study_language` default `'all'`; dữ liệu cũ sau migration có `language='en'`.
- [ ] `repo/supabase.test.ts`: row thiếu `language` → `'en'`; PGRST204 → gửi lại không cột mới, callback 1 lần; `repo/local.test.ts`: lessons cũ không `language` → `'en'`; settings cũ → `study_language 'all'`.
- [ ] `domain/review.test.ts`: `buildQueue` với `language:'zh'` chỉ trả thẻ zh; thứ tự trong kết quả lọc = thứ tự tương đối trong kết quả không lọc (đến hạn); `newLeft` tính trên toàn bộ cards (tạo 15 thẻ en đã ôn hôm nay + 5 thẻ zh mới → lọc zh trả 0 thẻ mới); `speakable: (l) => l !== 'zh'` → listen zh bị loại, listen en giữ; không `langOf` → mọi thẻ coi là en; `hiddenListenCount` với speakable thiếu zh đếm đúng; `hardestCards` lọc đúng.
- [ ] `domain/stats.test.ts`: `cardStats` với `language` đếm đúng, `lessonsCount` theo ngôn ngữ; `streak`/`todaySeconds` không nhận tham số ngôn ngữ (không đổi).
- [ ] `lib/text.test.ts`: `normalizeAnswer('你好，世界！','zh')='你好世界'`; `('こんにちは 。','ja')='こんにちは'`; `('안녕하세요. 반가워요','ko')='안녕하세요 반가워요'`; `compareAnswer('你好世界','你好，世界！','zh')='exact'`; Levenshtein theo code point (`'𠀋'` 1 ký tự).
- [ ] `domain/paste.test.ts`: 6 ca ở (3)-E pass; ca cũ `en` không đổi.
- [ ] `domain/importSnapshot.test.ts`: lesson thiếu `language` → `'en'`; `language:'fr'` → skipped; `settings.study_language:'zh'` → nhận; `'xx'` → giữ hiện tại.
- [ ] `domain/lessons.test.ts`: `validateItem({...}, { language:'zh' })` → "Nhập tiếng Trung."; không truyền → "Nhập tiếng Anh."
- [ ] Settings mặc định (`defaultSettings`) có `study_language:'all'`; xuất JSON có trường này; nhập tệp cũ không có → giữ `'all'`.
- [ ] `npm test`, `npm run build`, `npm run lint` pass.

T20b — TTS, `lang`, font
- [ ] `lib/tts/webSpeech.test.ts` (mới) `pickVoiceFor`: `[zh-TW, zh-CN]` → zh-CN; `[zh-HK, zh-TW]` → zh-TW; `[yue-HK]` → yue-HK (bậc 3); `[ja_JP]` → khớp (chuẩn hoá `_`); `[]` → undefined; `localService` ưu tiên trong cùng bậc.
- [ ] `lib/tts/router.test.ts`: `resolve('zh')` → web khi `supports('zh')`, `null` khi không; không gọi server, không markDown, không toast với zh/ja/ko kể cả lỗi; `resolve('en')`/`resolve('vi')` 5 nhánh cũ không đổi.
- [ ] `lib/tts/text.test.ts`: `prepareText('你好。再见！','zh')` chia 2 đoạn; `{slot}` → "…" với ja.
- [ ] `routes/lessonReadAloud.test.ts`: `buildReadAloudSteps(items, true, 'ko')` → bước đích `lang:'ko'`, bước VI `lang:'vi'`.
- [ ] Thủ công Chrome desktop: thẻ zh/ja/ko bấm loa → nghe đúng ngôn ngữ (không đọc theo giọng Anh); `SpeechSynthesisUtterance.lang` = `zh-CN`/`ja-JP`/`ko-KR` (kiểm bằng breakpoint hoặc log tạm); gỡ hết giọng zh (hoặc mock `getVoices`) → nút ẩn, Info đúng câu, listen zh không vào hàng đợi.
- [ ] `document.querySelectorAll('[lang]')` trên Trang buổi học zh: câu đích `zh-Hans`, phiên âm `zh-Latn`, không còn `lang="en"` quanh dữ liệu người dùng; computed `font-family` của câu zh bắt đầu bằng Be Vietnam Pro rồi PingFang SC (macOS) — kiểm bằng DevTools "Rendered Fonts" thấy font hệ thống CJK, **không** có request tới fonts.googleapis.com ngoài 2 font sẵn có.
- [ ] `.sh-en[lang="ja"]` line-height 1.4; `.review-en` vẫn 48px; lưới vở không lệch với câu CJK 1–2 dòng (ảnh chụp 1440 và 390).
- [ ] Server EN bật: thẻ zh vẫn dùng Web Speech; "Giọng mẫu: server local." không hiện với câu zh.
- [ ] `npm test`/`build`/`lint` pass; `speech.test.ts` không đổi.

T20c — UI, nhãn, bộ lọc, đổi tên
- [ ] `/lessons/new`: có select "Ngôn ngữ" với 4 option; mặc định theo quy tắc (3 kịch bản: filter zh; all + buổi gần nhất ja; all + trống → en); đổi select → nhãn ô đích, placeholder, mô tả "Trung → Việt" đổi ngay; lưu → `lesson.language` đúng trong state và DB/localStorage.
- [ ] Sửa buổi có thẻ `reps > 0` → select disabled + mô tả; buổi chưa ôn → đổi được; sau đổi, nhãn chiều trên thẻ và giọng đọc theo ngôn ngữ mới.
- [ ] Cài đặt: khối "Ngôn ngữ" giữa "Tài khoản" và "Mục tiêu"; chọn "Tiếng Trung" → toast "Đã lưu."; reload giữ; thiết bị thứ hai (Supabase) sau reload thấy cùng giá trị; dòng tình trạng giọng đúng với `getVoices()` thực tế.
- [ ] Hôm nay khi lọc zh: số lớn = số thẻ zh; trang vở là buổi zh gần nhất; hậu tố "· Tiếng Trung"; không có thẻ zh → trạng thái rỗng đúng câu + "Học tất cả ngôn ngữ" đặt lại `'all'`.
- [ ] Ôn thẻ: hàng meta "Thẻ 1/N · Trung → Việt"; `?lesson=` của buổi en khi đang lọc zh vẫn ôn được buổi en; ô listen có `lang`, so khớp bỏ dấu câu.
- [ ] Nhật ký: 1 ngôn ngữ → không nhãn; ≥ 2 → nhãn mute đúng; không lọc.
- [ ] Mẫu câu: Tất cả → 4 nhóm đúng thứ tự, 9/4/4/4 hàng; lọc ja → 4 hàng không heading; trang tình huống ja có `lang="ja"`, phiên âm `ja-Latn`, loa đọc tiếng Nhật, "Thêm vào thẻ ôn" tạo item; thẻ đó hiện "Nhật → Việt" ở Ôn thẻ.
- [ ] Shadowing: lọc ko → "Buổi gần nhất" là buổi ko; select tình huống chỉ ko; Tất cả → optgroup 4 nhóm; `?pattern=ja-shopping-02` mở đúng câu bất kể bộ lọc.
- [ ] Tiến độ lọc: khối thẻ đổi tiêu đề và số; chuỗi/phút/lịch không đổi khi đổi bộ lọc.
- [ ] Tên: tab "Hôm nay · Vở Ngoại Ngữ"; Shell "Vở Ngoại Ngữ"; Đăng nhập H1 + phụ đề mới; manifest `name`/`short_name`/`description` mới; `apple-mobile-web-app-title`; README tiêu đề + mục "Ngôn ngữ học"; PRODUCT.md có dòng tên mới; `grep -r "Vở Tiếng Anh" src index.html public README.md` chỉ còn ở chú thích lịch sử (nếu có) — mục tiêu 0 kết quả trong `src/`.
- [ ] Không eyebrow/uppercase, không badge nền màu cho nhãn ngôn ngữ, không viền trái; nút ≥ 44px; 390px không tràn ngang ở form (select xuống dòng riêng) và `/patterns` nhóm.
- [ ] `npm test`/`build`/`lint` pass; ảnh chụp các màn với dữ liệu chỉ `en` và `study_language='all'` **không khác** trước T20 ngoài tên app.

T20d — bộ mẫu câu khởi đầu zh/ja/ko
- [ ] `data/patterns.test.ts` cập nhật pass: 21 tình huống, `PATTERN_COUNT === 147`, ràng buộc hệ chữ và phiên âm (3)-F.
- [ ] Reviewer đối chiếu **từng câu** (60 câu): nghĩa khớp ý bắt buộc; `zh` giản thể + pinyin đúng dấu thanh và tách từ; `ja` kanji/kana N5 + Hepburn nhất quán (macron); `ko` 해요체 + RR đúng; `note`/`pronunciationFocus` là tiếng Việt, đúng trọng tâm (thanh điệu zh; trường âm/trợ từ ja; patchim/phụ âm căng ko); không câu nào copy nguyên văn từ nguồn có bản quyền (câu giao tiếp phổ thông).
- [ ] `/patterns/zh-greetings` hiển thị và đọc được trên Chrome desktop có giọng zh; `fillPattern` không có `{`; "Thêm cả tình huống (5 câu)" tạo 5 item.
- [ ] `npm test`/`build`/`lint` pass.

**(8) Task:** T20a, T20b, T20c, T20d (mục 9).

---

## 7. Dữ liệu seed

File: `src/data/patterns.ts` (đã viết đầy đủ phần tiếng Anh). **Tiếng Anh**: 9 tình huống, 87 mẫu câu A1–A2, mỗi câu có `en` (câu đích), `vi`, `ipa`, `level`, tuỳ chọn `slots` (ô trống với `hint` tiếng Việt và 2–3 ví dụ đích/VI) và `note` (lưu ý phát âm người Việt: âm cuối, -s/-ed, trọng âm, nối âm). Mỗi tình huống có `language`, `intro`, `pronunciationFocus`, tuỳ chọn `nameTarget`.

**(T20) Bộ khởi đầu zh/ja/ko**: 12 tình huống × 5 câu = 60 câu (6.14 (3)-F), không slot, phiên âm pinyin có dấu thanh / Hepburn / Revised Romanization. Tổng `PATTERN_COUNT = 147`.

Tình huống `en` (id → tên): `greetings` Chào hỏi · `self-intro` Giới thiệu bản thân · `ordering` Gọi món · `directions` Hỏi đường · `shopping` Mua sắm · `work` Công việc · `phone` Điện thoại · `airport` Sân bay · `hotel` Khách sạn. Tình huống `zh|ja|ko`: `{lang}-greetings` Chào hỏi & giới thiệu · `{lang}-restaurant` Nhà hàng & gọi món · `{lang}-shopping` Mua sắm & hỏi giá · `{lang}-directions` Hỏi đường & đi lại.

Hàm tiện ích xuất kèm: `fillPattern(p, i)`, `blankPattern(text)`, `splitPattern(text)`, `findPattern(id)`, `findSituation(id)`, `situationOfPattern(id)`, **(T20)** `situationsOf(filter)`, `firstSituationId(lang)`, `languageOfPattern(id)`, hằng `PATTERN_COUNT`. Coder dùng các hàm này, không tự parse `{slot}`.

Quy tắc dùng seed: không chỉnh sửa nội dung qua UI; khi thêm vào thẻ ôn, nội dung được **sao chép** vào `items` (nên sửa seed sau này không đổi thẻ đã tạo). IPA là của câu đã điền ví dụ đầu tiên.

---

## 8. Yêu cầu phi chức năng

### 8.1 Responsive
390px → 1440px không tràn ngang; breakpoint theo 5.7; kiểm tra ở 390, 768, 1024, 1440. Phần tử tương tác ≥ 44×44px; chữ ≥ 14px; vùng nội dung không bị thanh tab dưới che (`safe-area-inset-bottom`).

### 8.2 Truy cập (WCAG 2.2 AA)
- Contrast ≥ 4.5:1 cho chữ (mute #6A6280 trên paper đạt ~5.4:1; red #D2332B trên white ~5.5:1 — chỉ dùng red cho chữ ≥ 14px weight ≥ 500).
- Mọi control có label (visible hoặc `aria-label`); nút chỉ icon có `aria-label`; hình trang trí `aria-hidden`.
- `:focus-visible` rõ ràng; thứ tự tab hợp lý; skip link; dialog bẫy focus và trả focus khi đóng (dùng `<dialog>.showModal()`).
- Toast `role="status"`; lỗi form `role="alert"` + `aria-describedby`.
- Không phụ thuộc màu: trạng thái thẻ luôn có chữ ("quên 2 lần"), ô lịch có icon/chấm + `aria-label`.
- `prefers-reduced-motion`: tắt nhấp nháy, xoay; không animation lật thẻ (đổi nội dung tức thời).
- Mọi âm thanh có text tương đương; không autoplay.
- `lang="vi"` toàn trang, `lang="en"` cho tiếng Anh.

### 8.3 Hiệu năng
- Route lazy; bundle chính (không tính route) ≤ 250 KB gzip; `ts-fsrs` chỉ import trong `lib/fsrs.ts` (được chunk theo route Review/Today/Lessons…; chấp nhận).
- Dữ liệu tải 1 lần; derived data `useMemo` theo snapshot.
- Fonts `display=swap`, 4 weight Be Vietnam Pro + 1 Charm.
- Không polling API (chỉ replay hàng đợi khi có pending).
- LCP mục tiêu < 2.5s trên 4G; TTI < 3s.

### 8.4 Bảo mật
- Chỉ dùng `anon key` ở client; RLS bắt buộc trên mọi bảng; không có bảng nào thiếu policy.
- Không gửi `user_id` từ client (DB default `auth.uid()`); nếu gửi cũng bị `with check` chặn.
- Không log token/email ra console. `.env` trong `.gitignore`. Không service_role key ở bất kỳ đâu trong repo.
- Supabase client `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`, `flowType: 'pkce'`.
- (GĐ2) Gemini key chỉ `localStorage`, không bao giờ vào Supabase.

### 8.5 Riêng tư
- Bản ghi âm không rời trình duyệt; không `localStorage`/IndexedDB; revoke URL khi rời.
- Xuất dữ liệu đầy đủ theo yêu cầu người dùng (nguyên tắc "dữ liệu thuộc về người dùng").
- Không analytics bên thứ ba ở MVP.

### 8.6 Chất lượng mã
- `npm run build` và `npm run lint` pass ở mỗi task. Không `any` trừ ranh giới JSON (`Record<string, unknown>`). Không `enum`. `import type` cho type-only. Không `console.log` còn lại.
- Test đơn vị với `vitest` cho `lib/dates.ts`, `lib/text.ts`, `domain/review.ts`, `domain/stats.ts`, `data/patterns.ts` (fillPattern/splitPattern, mọi `{key}` có slot), **(T20)** `domain/language.ts`, `lib/tts/webSpeech.ts` (`pickVoiceFor`), và các ca ngôn ngữ thêm vào test hiện có (6.14 (7)).

---

## 9. Kế hoạch triển khai (task theo thứ tự, mỗi task một lần gọi `coder`)

Ký hiệu: **Phụ thuộc** = phải xong trước. Mỗi task có **Đầu ra** (file) và **Xong khi** (kiểm tra được).

**T01 — Dọn scaffold, tokens, fonts, cấu hình dự án**
Phụ thuộc: —
Làm: xoá `src/App.css`, `src/assets/*`, nội dung mẫu `src/App.tsx`/`src/index.css`; tạo `src/styles/tokens.css` (5.1) và `src/styles/base.css` (reset, font, focus ring, selection, scrollbar, `.visually-hidden`, `.skip-link`, `.card`, `.rule`); sửa `index.html` (`lang="vi"`, title, fonts preconnect+link, `theme-color`); thêm `.env` vào `.gitignore`; tạo `vercel.json` rewrite SPA; cập nhật `README.md` (mục 11 rút gọn); `src/App.tsx` tạm render "Vở Tiếng Anh".
Đầu ra: các file trên. Xong khi: build+lint pass; trang trắng nền `--paper` với chữ Be Vietnam Pro.

**T02 — Kiểu dữ liệu, ngày giờ, tiện ích chữ, id, config**
Phụ thuộc: T01
Làm: `domain/types.ts` (3.1), `lib/dates.ts` (4.1), `lib/text.ts` (4.7), `lib/ids.ts`, `lib/config.ts`; cài `vitest` (`npm i -D vitest`), script `"test": "vitest run"`; test cho dates (localDay qua ranh giới 23:59 UTC+7 → đúng ngày; addDays qua cuối tháng), text (normalize, compare).
Xong khi: `npm test` pass; build+lint pass.

**T03 — Bọc ts-fsrs v6**
Phụ thuộc: T02
Làm: `lib/fsrs.ts` theo 4.2: `getScheduler()`, `newCardState(cardId, now)`, `serializeCard/deserializeCard`, `gradeCard(card, grade, now)`, `previewIntervals(card, now)`, `formatInterval(ms)`. Đọc `node_modules/ts-fsrs/dist/index.d.mts` và `README.md` của gói trước khi code; không dùng API deprecated. Test: thẻ mới chấm Good → `dueAt > now`, `reps === 1`, `state !== 0`; serialize→deserialize giữ `dueAt` là Date; `formatInterval`.
Xong khi: test pass; build+lint pass (không warning deprecated trong IDE).

**T04 — Repository interface, LocalRepository, hàng đợi pending**
Phụ thuộc: T02
Làm: `repo/types.ts` (2.3), `repo/local.ts` (localStorage, user `'local'`, settings mặc định), `repo/pending.ts` (enqueue/replay/persist, 2.4), `repo/index.ts` (`createRepository(config)` trả local khi thiếu env). Test local repo: upsert/delete cascade (xoá lesson xoá items, cards, logs), `addStudyTime` cộng dồn.
Xong khi: test pass; build+lint pass.

**T05 — Supabase client, SupabaseRepository, Auth**
Phụ thuộc: T04
Làm: `lib/supabase.ts`; `repo/supabase.ts` (loadSnapshot 5 truy vấn song song, upsert theo id, `rpc add_study_time`, map snake_case); `AuthService` cho cả local và supabase (`signInWithOtp` với `emailRedirectTo`, `onAuthStateChange`). Không test tích hợp tự động; kiểm tra bằng tay với project Supabase thật theo mục 11.
Xong khi: build+lint pass; với `.env` thật, `loadSnapshot()` trả về dữ liệu rỗng hợp lệ cho user mới (có `settings`).

**T06 — Providers, router, Shell, component cơ bản**
Phụ thuộc: T03, T04, T05
Làm: `state/AuthProvider.tsx`, `state/DataProvider.tsx` (snapshot + actions: `createLesson`, `updateLesson`, `deleteLesson`, `saveItems`, `deleteItem`, `addPatternItems`, `gradeCard` (gọi fsrs + unlock + requeue trả về cho UI), `addStudyTime`, `saveSettings`; tích hợp pending + chip trạng thái; reload khi visible sau 10 phút), `App.tsx` router + lazy + guard (2.5), `components/*` (5.4, 5.5 gồm NotebookPage và Remark), `routes/NotFound.tsx`, placeholder cho các route còn lại (H1 + "Đang xây dựng" — sẽ thay ở task sau).
Xong khi: chạy local mode vào `/` thấy Shell đúng 3 breakpoint; chip "Cục bộ"; nav hoạt động; build+lint pass. Tiêu chí 6.2.

**T07 — Màn Đăng nhập**
Phụ thuộc: T06
Làm: `routes/Login.tsx` theo 6.1 (cả local và supabase), xử lý hash lỗi, đếm ngược gửi lại, redirect `?next`.
Xong khi: tiêu chí 6.1; build+lint pass.

**T08 — Nhật ký buổi học: danh sách, xem (NotebookPage), tạo/sửa, xoá**
Phụ thuộc: T06
Làm: `domain/lessons.ts` (nextLessonNumber, validate), `routes/Lessons.tsx`, `routes/LessonView.tsx`, `routes/LessonEdit.tsx` theo 6.4–6.6; sinh thẻ en_vi khi tạo item; `useBlocker` + `beforeunload`; render `*từ*` gạch lượn đỏ.
Xong khi: tiêu chí 6.4, 6.5, 6.6; build+lint pass.

**T09 — Domain ôn tập và thống kê**
Phụ thuộc: T03
Làm: `domain/review.ts` (buildQueue, shouldRequeue, shouldUnlockSiblings, hardestCards, estimateMinutes — 4.3, 4.4, 4.6), `domain/stats.ts` (streak, todaySeconds, calendarWeeks(today) → 8 hàng × 7 ngày với trạng thái, cardStats — 4.5, 6.10). Test đầy đủ: giới hạn 15 thẻ mới theo `first_reviewed_at` ngày địa phương; thẻ đang học trước; loại listen khi `!ttsSupported`; unlock đúng/sai theo ngày và grade; streak 3 kịch bản; lịch bắt đầu Thứ Hai.
Xong khi: test pass; build+lint pass.

**T10 — TTS: lib/speech, useTts, SpeakButton**
Phụ thuộc: T06
Làm: `lib/speech.ts` (isTtsSupported, getEnglishVoices với `voiceschanged`, pickDefaultVoice ưu tiên `en-US` rồi `en-*`, speak({text, rate, voiceName}) gọi `cancel()` trước, trả promise resolve ở `onend`), `hooks/useTts.ts` (speaking state), `components/SpeakButton.tsx` (icon `Volume2`/`Square` khi đang đọc, aria-label, disabled khi không hỗ trợ). Gắn vào LessonView.
Xong khi: nút loa đọc được trên Chrome và Safari (trong click handler); không hỗ trợ → ẩn + dòng thông tin; build+lint pass.

**T11 — Màn Ôn thẻ**
Phụ thuộc: T09, T10
Làm: `routes/Review.tsx` theo 6.7, `hooks/useKeyboard.ts`, `hooks/useStudyTimer.ts` (dùng ở T14 nữa), tích hợp `DataProvider.gradeCard`, màn tổng kết, chế độ `?lesson`.
Xong khi: tiêu chí 6.7; build+lint pass.

**T12 — Màn Hôm nay**
Phụ thuộc: T09, T08, T10
Làm: `routes/Today.tsx` theo 6.3 (2 cột, NotebookPage, Remark duy nhất, 3 trạng thái).
Xong khi: tiêu chí 6.3; build+lint pass.

**T13 — Màn Mẫu câu tình huống**
Phụ thuộc: T08 (NotebookPage), T10
Làm: `routes/Patterns.tsx`, `routes/PatternSituation.tsx` theo 6.8; action `addPatternItems(patternIds)`; map icon lucide từ `situation.icon`. Test seed: mọi `{key}` trong en/vi có slot; `fillPattern` không còn `{`; `PATTERN_COUNT === 87`.
Xong khi: tiêu chí 6.8; test pass; build+lint pass.

**T14 — Màn Shadowing**
Phụ thuộc: T10, T11 (useStudyTimer)
Làm: `lib/recorder.ts`, `hooks/useRecorder.ts`, `routes/Shadowing.tsx` theo 6.9.
Xong khi: tiêu chí 6.9; build+lint pass.

**T15 — Màn Tiến độ**
Phụ thuộc: T09
Làm: `routes/Progress.tsx` theo 6.10.
Xong khi: tiêu chí 6.10; build+lint pass.

**T16 — Màn Cài đặt**
Phụ thuộc: T10, T06
Làm: `routes/Settings.tsx` theo 6.11 (xuất JSON, đăng xuất, xoá local có gõ XOA).
Xong khi: tiêu chí 6.11; build+lint pass.

**T17 — Rà soát responsive, a11y, hiệu năng, tài liệu**
Phụ thuộc: T07–T16
Làm: đi qua checklist mục 10 ở 390/768/1024/1440; sửa contrast/focus/label; kiểm tra chỉ 1 Charm/màn; không border-left màu; không bóng; `npm run build` xem kích thước chunk; cập nhật `README.md` theo mục 11; xoá code thừa/placeholder.
Xong khi: toàn bộ checklist mục 10 được tick hoặc ghi rõ lý do.

**T18 — Dán danh sách, Nhập JSON, PWA cơ bản** (đặc tả 6.13; 3 task độc lập, có thể chạy bất kỳ thứ tự nhưng khuyến nghị a → c → b)

**T18a — Dán danh sách nhiều dòng vào buổi học**
Phụ thuộc: T08. Model: Sonnet (3–4 file, logic thuần; nâng Opus sau 2 vòng FIX theo quy tắc chung).
Làm, theo thứ tự:
1. `src/domain/paste.ts`: `PASTE_MAX_LINES`, `ParsedRow`, `PasteResult`, `parsePastedList`, `inferKind` đúng thuật toán 6.13 (3)-A (chuẩn hoá → bỏ đánh số → chọn dấu tách theo thứ tự → tách 3 phần → gán EN/VI/IPA/ghi chú → IPA liền → kind). Không import React, không import repository.
2. `src/domain/paste.test.ts`: ≥ 12 ca theo 6.13 (7)-A dòng 1 (dùng đúng chuỗi ví dụ trong (3)-A).
3. `src/routes/LessonEdit.tsx`: nút ghost "Dán danh sách" (`ClipboardPaste`, `aria-expanded`, `aria-controls`) cạnh "Thêm mục"; state `pasteOpen`, `pasteText`; `useMemo(() => parsePastedList(pasteText))`; panel inline với `Field as="textarea"` (id `lesson-paste`, label/mô tả/placeholder theo (6)-A, `rows={6}`, `spellCheck={false}`, `autoCapitalize="off"`, autofocus khi mở), tóm tắt `aria-live="polite"`, lỗi `role="alert"`, `<ol className="paste-preview">`, nút "Thêm vào buổi"/"Đóng"; hàm `addPastedRows()`: lọc bỏ hàng `itemId === null && isBlankItem(r)`, nối hàng mới (`emptyRow()` + patch), thêm key có ipa/note vào `openExtras`, `focusRef` = EN hàng mới đầu, `update(...)`, reset text, đóng panel, `notify('Đã thêm {n} mục. Kiểm tra rồi bấm Lưu.')`; Ctrl/Cmd+Enter trong textarea gọi `addPastedRows` (chặn mặc định). Không đổi handler `onKeyDown` của form.
4. `src/routes/LessonEdit.css`: `.paste-panel` (border-top `var(--rule)`, padding 16px 0 0), `.paste-preview` (list-style none, `max-height: 240px` / 200px mobile, `overflow: auto`, hàng `border-top: var(--rule)`, padding 8px 0), `.paste-summary` (15px mute), `.paste-error` (14px/500 red); không box-shadow, không border-left màu, không card lồng.
Đầu ra: 4 file trên. Xong khi: tiêu chí 6.13 (7)-A pass; `npm test`/`build`/`lint` pass; ảnh chụp form khi panel đóng không khác T08 ngoài một nút ghost mới.

**T18b — Nhập dữ liệu JSON (gộp theo id)**
Phụ thuộc: T16, T06. Model: **Opus** (chạm Repository cả hai implementation, PendingOp, reducer, SyncEngine; ≥ 6 file).
Làm, theo thứ tự:
1. `src/repo/types.ts`: thêm `upsertLessons(lessons: Lesson[]): Promise<void>` vào `Repository`; thêm biến thể `{ type: 'upsertLessons'; lessons: Lesson[] }` vào `PendingOpPayload`.
2. `src/repo/local.ts` (`upsertLessons` = upsertById, gán `user_id: LOCAL_USER_ID`) và `src/repo/supabase.ts` (một `upsert` mảng, bỏ `user_id`, map snake_case như `upsertLesson`); `src/repo/pending.ts` `applyOp` thêm case; test local repo cho `upsertLessons` (thêm + ghi đè).
3. `src/state/dataReducer.ts`: action `lessons/upsert` (dùng `upsertById`), `opToAction('upsertLessons')` → `lessons/upsert`; action `import/apply { plan, includeSettings }` áp lessons/items/cards (upsertById), `addStudyDelta` cho từng `studyDeltas`, `settings` khi tick. Test reducer: một dispatch áp đủ; `applyPendingOps` với op `upsertLessons`.
4. `src/domain/importSnapshot.ts`: `IMPORT_MAX_BYTES`, `ImportFileError`, `ImportFile`, `validateImportFile`, `ImportPlan`, `planImport` đúng bảng 6.13 (3)-B (dùng `LIMITS` từ `domain/lessons.ts`, `KINDS`/`DIRECTIONS` từ `domain/types.ts`, `deserializeCard` từ `lib/fsrs.ts` trong try/catch, `addDays`/`localDay` từ `lib/dates.ts`). Thuần, không React. `src/domain/importSnapshot.test.ts`: ≥ 14 ca theo 6.13 (7)-B dòng 1–2.
5. `src/state/dataContext.ts` + `src/state/DataProvider.tsx`: action `importSnapshot(file, { includeSettings })`: `ready()` → `planImport(file, snapshot, userId, localDay(now))` → với `itemsNeedingCard` tạo thẻ `en_vi` qua `createCardRecord` (Promise.all) → kiểm lại snapshot sau await (như `saveItems`) để không sinh trùng → dispatch `import/apply` **một lần** → `engine.write([upsertLessons, ...upsertItems chunk 200, ...upsertCards chunk 200 (gồm thẻ mới), ...addStudyTime từng ngày, saveSettings?])` → `.then(() => mode === 'supabase' && pending rỗng ? engine.load('background') : undefined)` → trả `counts`. Thêm vào `value`/`useMemo` deps.
6. `src/components/ConfirmDialog.tsx`: prop `confirmVariant?: 'danger' | 'primary'` (mặc định `'danger'`, không đổi hành vi cũ).
7. `src/routes/Settings.tsx` (+ `Settings.css`): nút "Nhập dữ liệu (JSON)" (`Upload`), input file ẩn + ref, state `importStatus: 'idle' | 'reading' | { error } | { plan, file }`, `includeSettings`, `importing`; chặn theo `mode === 'supabase' && (!online || pending.size > 0)` với dòng mute; đọc tệp (`file.size` → `file.text()` → `JSON.parse` → `validateImportFile` → `planImport`); `ConfirmDialog confirmVariant="primary"` với tóm tắt + checkbox; `importSnapshot` → toast → reset input; nhánh không hỗ trợ (`typeof File === 'undefined' || !Blob.prototype.text`) ẩn nút + dòng Info; cập nhật mô tả khối "Dữ liệu".
Đầu ra: các file trên + test. Xong khi: tiêu chí 6.13 (7)-B pass (gồm luồng tay local xoá → nhập và luồng Supabase online/offline); `npm test`/`build`/`lint` pass; các dialog cũ vẫn đỏ; hàng đợi pending không thay đổi hành vi với 8 op type cũ.

**T18c — Manifest PWA cơ bản (không service worker)**
Phụ thuộc: T01. Model: Sonnet.
Làm, theo thứ tự:
1. `public/icon-source.svg`: biến thể của `favicon.svg` theo 6.13 (3)-C (full-bleed không bo góc, nội dung trong vùng an toàn 80 %, chữ "V" chuyển thành path). Chỉ dùng màu tokens 5.1.
2. Rasterize `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180, nền đặc) bằng `qlmanage -t -s <size> -o <dir> public/icon-source.svg` (hoặc `rsvg-convert`); **không** thêm package trừ khi người dùng đồng ý dùng `@resvg/resvg-js` qua `scripts/make-icons.mjs`. Ghi `public/icons/PROVENANCE.md` (nguồn, công cụ + phiên bản, lệnh, ngày, kích thước).
3. `public/manifest.webmanifest` đúng bảng 6.13 (3)-C.
4. `index.html`: `link rel="manifest"`, `link rel="apple-touch-icon"`, 4 meta (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style=default`). Không sửa `vite.config.ts`, không `serviceWorker.register`.
5. `README.md`: mục ngắn "Cài lên màn hình chính" (Android/iOS/desktop) + ghi rõ "chưa offline (GĐ3)" và cách tái tạo icon.
Đầu ra: các file trên. Xong khi: tiêu chí 6.13 (7)-C pass (DevTools Manifest không lỗi; cài được trên Android Chrome và iOS Safari thật); `npm run build` copy đủ; lint pass.

**T19 — Nhà cung cấp giọng đọc (TTS provider) cấu hình được** (đặc tả 6.12; 3 task tuần tự)

**T19a — Lib: provider, router, cache, cấu hình, test**
Phụ thuộc: T10, T16. Model: Opus (≥ 4 file mới, có đồng thời/timeout).
Làm, theo thứ tự:
1. `lib/ttsConfig.ts`: `TtsConfig`, `DEFAULT_TTS_CONFIG`, `readTtsConfig`, `writeTtsConfig`, `subscribeTtsConfig` (cùng tab + sự kiện `storage`), `normalizeBaseUrl`, `classifyHost`, `isMixedContentBlocked`. Test `lib/ttsConfig.test.ts` theo 6.12 (7) nhóm "Lib".
2. `lib/tts/types.ts`: `TtsLang`, `SpeakRequest`, `SpeakHandle`, `TtsProvider`, `TtsVoice`, `TtsError` (`kind`, `status?`), `ProbeResult`, hằng `MODEL`, `DEFAULT_VOICE`, `TIMEOUT_SPEAK_MS=8000`, `TIMEOUT_PROBE_MS=4000`, `HEALTH_DOWN_TTL_MS=60000`.
3. `lib/tts/text.ts`: `prepareText(text, lang)` (bỏ `*`, gộp khoảng trắng, `{slot}`→"…", chia đoạn ≤ 300). Test.
4. `lib/tts/cache.ts`: `AudioCache` LRU (50 mục / 20 MB, `get/set/clear(lang)`). Test.
5. `lib/tts/audioSink.ts`: singleton `<audio>`, `prime()` (WAV im lặng data-URI, play đồng bộ, cờ `unlocked`), `play(blob, rate): Promise<void>` (resolve `ended`, reject `error`/`NotAllowedError` → `TtsError('autoplay')`), `stop()`, revoke URL. Không test DOM phức tạp; test `prime()` chỉ gọi `play()` khi chưa unlocked bằng mock `HTMLMediaElement.prototype.play`.
6. `lib/tts/webSpeech.ts`: `WebSpeechProvider` bọc `lib/speech.ts` (**không sửa** `lib/speech.ts`): `supports('en')` = `isTtsSupported()`, `supports('vi')` = có giọng `vi-*`; `speak` → `{promise: speak({...}), cancel: () => cancel(owner)}`; `probe` → `{ok: supports('en')}`; `listVoices` → giọng EN hiện có.
7. `lib/tts/openaiCompat.ts`: `OpenAiCompatibleProvider(lang, getServerConfig)`: `speak` (prime → cache → fetch với AbortController + timeout → retry không `speed` khi 400/422 → `audioSink.play`), `probe` (`/v1/models` → `/health`), `listVoices` (`/v1/voices` → `/v1/audio/voices`, parse khoan dung). Test với `vi.fn()` cho `fetch` và fake timers: body đúng, timeout, 429, 400 retry, parse voices, probe fallback.
8. `lib/tts/router.ts`: `TtsRouter` (`resolve`, `speak`, `cancel`, `isCurrent`, `canSpeak`, `health` + TTL, `markDown`, toast-once qua callback `notify` tiêm vào, `subscribe`). Test: 5 nhánh `resolve`, fallback EN gọi web đúng 1 lần, toast 1 lần, 4xx không markDown, hủy chéo provider.
9. `lib/tts/index.ts`: facade `speak({text, lang='en', rate=1, owner})`, `cancel`, `isCurrent`, `canSpeak`, `probe(lang)`, `listVoices(lang)`, `subscribe`; `setNotifier(fn)` để `DataProvider` nối `notify` (tone `'info'`).
10. `hooks/useTts.ts`: chuyển sang facade; thêm `viAvailable`, `enServer`; `speak(text, {rate, lang})`; dùng `useSyncExternalStore(subscribe, …)` cho `viAvailable/enServer`. `components/SpeakButton.tsx`: prop `lang`, ẩn khi VI không khả dụng, icon `LoaderCircle` khi chờ > 300 ms. `DataProvider` gọi `setNotifier(notify)` một lần.
Đầu ra: các file trên + test. Xong khi: `npm test` pass (test mới ≥ 25 ca theo 6.12 (7) "Lib"); `npm run build` và `npm run lint` pass; `speech.test.ts` không đổi; với cấu hình mặc định, Network tab không có request nào tới `/v1/`; mọi màn hiện có chạy như trước (smoke: Ôn thẻ, Shadowing, Mẫu câu, Cài đặt "Nghe thử").

**T19b — Cài đặt: khối "Giọng đọc" hai phần**
Phụ thuộc: T19a. Model: Sonnet.
Làm: `routes/Settings.tsx` (+ CSS của Settings) theo 6.12 (4) phần Cài đặt: hai `<h3>` "Tiếng Anh"/"Tiếng Việt"; đổi nhãn select "Giọng trình duyệt"; switch server EN + nhóm trường; switch server VI + nhóm trường (Địa chỉ, Giọng text→select, Tốc độ, "Kiểm tra kết nối", "Nghe thử"), switch phụ giọng thiết bị (chỉ khi có giọng `vi-*`), `<details>` hướng dẫn 3 lệnh, dòng riêng tư, cảnh báo host public, cảnh báo mixed content, dòng trạng thái `aria-live`. Tách component `routes/settings/TtsServerFields.tsx` dùng chung cho EN/VI (props: `lang`, config, onChange). Không hiện toast "Đã lưu." cho cấu hình TTS (lưu localStorage tức thời); đổi `baseUrl`/`voice` → `cache.clear(lang)` + health `unknown` (qua facade). Không sửa `TtsUnsupportedNote` ngoài việc không ẩn phần server khi Web Speech thiếu.
Xong khi: tiêu chí 6.12 (7) "Cài đặt" pass (kiểm tra tay với VieNeu thật ở `localhost:8000` và khi server tắt); build+lint pass; 390px không tràn ngang; không uppercase/eyebrow; nút ≥ 44px.

**T19c — Gắn nút tiếng Việt vào màn học + Shadowing theo provider**
Phụ thuộc: T19a (T19b để kiểm tra tay). Model: Sonnet.
Làm:
1. `routes/Review.tsx`: mặt sau `en_vi` thêm `<SpeakButton lang="vi" text={item.vi} label="Nghe nghĩa tiếng Việt" />` cùng hàng dòng VI (CSS: flex, VI co giãn, nút bên phải; mobile vẫn cùng hàng). `auto_speak` không đổi. Phím `S` vẫn chỉ đọc EN.
2. `routes/LessonView.tsx`: nút "Nghe cả trang"/"Dừng"/"Tiếp tục nghe" trong hàng hành động (chỉ khi `viAvailable`); hook cục bộ `useReadAloudPage(items)` chạy chuỗi EN→VI với nghỉ 400/600 ms, `aria-current` + nền `--lilac` cho mục đang đọc, cancel khi unmount; `SpeakButton lang="vi"` cho "Hỏi giáo viên" và "Lỗi hay gặp" (đặt bên phải nhãn khối; `MistakesNote` nhận prop tuỳ chọn `action?: ReactNode` để render nút mà không đổi kiểu nhãn đỏ).
3. `routes/PatternSituation.tsx`: `SpeakButton lang="vi"` cạnh "Lưu ý phát âm:" của tình huống (`pronunciationFocus`).
4. `routes/Shadowing.tsx`: không đổi logic; `tts.speak(sentence.en, {rate})` tự đi qua router; thêm dòng mute "Giọng mẫu: server local." khi `enServer`. Kiểm tra "Nghe lần lượt" với server EN (promise resolve ở `ended` rồi `playAudio`).
5. `routes/Today.tsx`: không đổi (ghi rõ trong PR).
Xong khi: tiêu chí 6.12 (7) "Màn học" pass; build+lint pass; đếm nút loa VI mỗi màn đúng 6.12 (5).12; với cấu hình mặc định, ảnh chụp 4 màn không khác trước T19 (không có nút mới).

**T20 — Đa ngôn ngữ học (Anh, Trung, Nhật, Hàn) và đổi tên "Vở Ngoại Ngữ"** (đặc tả 6.14; 4 task **tuần tự** a → b → c → d; d có thể chạy song song với c nếu cần)

**T20a — Data model, migration, repository, bộ lọc, import/paste**
Phụ thuộc: T18a, T18b, T19a. Model: **Opus** (chạm cả hai Repository, schema, domain thuần, ≥ 10 file).
Làm, theo thứ tự:
1. `src/domain/types.ts`: `Language`, `LANGUAGES`, `StudyLanguageFilter`, `STUDY_LANGUAGES`; `Lesson.language`; `Settings.study_language`; JSDoc "câu ngôn ngữ đích" cho `Item.en`, "phiên âm" cho `Item.ipa`. `DIRECTION_LABELS` giữ.
2. `src/domain/language.ts` + `language.test.ts` theo 6.14 (3)-A (import `situationOfPattern`/`findSituation` từ `data/patterns` — ở T20a `Situation.language` chưa có → tạm `languageOfPattern` trả `'en'` cho mọi id tồn tại; T20d hoàn thiện. Ghi TODO rõ trong code).
3. `supabase/schema.sql`: khối 9 theo 3.2. `README.md` mục "Cập nhật schema": thêm câu "Sau T20 phải chạy lại file để có cột `language`/`study_language`."
4. `src/repo/supabase.ts`: `LessonRow.language?`, `SettingsRow.study_language?`, `toLesson`/`toSettings` chuẩn hoá, `defaultSettings` + `study_language`, xử lý `PGRST204` (gửi lại không cột mới, cờ `schemaOutdated`, `setSchemaOutdatedNotifier(fn)`); `src/repo/local.ts`: chuẩn hoá khi đọc; test cho cả hai (6.14 (7) T20a).
5. `src/state/DataProvider.tsx`: nối `setSchemaOutdatedNotifier(notify)` (toast info 1 lần/phiên — repo tự đảm bảo "1 lần").
6. `src/domain/review.ts`: `buildQueue`/`hiddenListenCount`/`hardestCards` thêm `language`/`langOf`/`speakable` (4.4 1b, 4.6) — mặc định không đổi hành vi; test mới trong `review.test.ts`. `src/domain/stats.ts`: `cardStats(cards, lessons, { language?, langOf? })`; test.
7. `src/lib/text.ts`: `normalizeAnswer(s, language)`, `compareAnswer(a, b, language)` theo 4.7 (Levenshtein theo code point); test.
8. `src/domain/lessons.ts`: `LessonInput.language`, `validateLesson` lỗi "Chọn ngôn ngữ.", `validateItem(input, { required?, language? })`; test.
9. `src/domain/paste.ts`: `parsePastedList(text, language)`, `inferKind(en, language)` theo 6.14 (3)-E; test 6 ca.
10. `src/domain/importSnapshot.ts`: `language` của lesson, `study_language` của settings theo 6.14 (3)-C; đổi câu `bad-shape` sang "…của Vở Ngoại Ngữ…"; test.
11. `src/domain/settingsLimits.ts` (nếu Settings/Import dùng): export `isStudyLanguage` (re-export từ `language.ts`).
Đầu ra: các file trên + test. Xong khi: tiêu chí 6.14 (7) "T20a" pass; `npm test`/`build`/`lint` pass; app chạy y hệt trước T20 ở mọi màn (chưa có UI mới) với dữ liệu cũ ở cả mode local và Supabase **đã** và **chưa** migrate (toast schema hiện đúng 1 lần ở trường hợp chưa migrate).

**T20b — TTS theo ngôn ngữ, thuộc tính `lang`, font stack CJK**
Phụ thuộc: T20a. Model: **Opus** (router/provider có đồng thời + ≥ 6 file).
Làm, theo thứ tự:
1. `src/lib/ttsConfig.ts`: `TtsLang` mở rộng, `ServerLang`, `isServerLang`. `src/lib/tts/types.ts`: `MODEL`/`DEFAULT_VOICE` → `Record<ServerLang, string>`.
2. `src/lib/tts/webSpeech.ts`: `pickVoiceFor(lang)` (export, thuần), `speakWithVoice` tổng quát hoá `speakVi`, `supports(lang)` cho 5 ngôn ngữ, timeout CJK theo 6.14 (3)-D; `webSpeech.test.ts` mới cho `pickVoiceFor`. **Không sửa `lib/speech.ts`.**
3. `src/lib/tts/router.ts`: `servers: Record<ServerLang, …>`, `resolve` 4 nhánh theo 6.14 (3)-D, `probe/listVoices(lang: ServerLang)`; cập nhật `router.test.ts` (zh/ja/ko không bao giờ chạm server/toast). `src/lib/tts/index.ts`: kiểu tham số; `canSpeak(lang)` cho mọi `TtsLang`. `src/lib/tts/text.ts`: ranh giới CJK + `{slot}`; test.
4. `src/hooks/useTts.ts`: `canSpeakLang(lang)` qua snapshot `speakable` (external store, re-render khi `voiceschanged`); `speak(text, { rate, lang })` kiểu mở rộng. `src/components/SpeakButton.tsx`: điều kiện ẩn theo `lang`; `TtsUnsupportedNote lang?`.
5. `src/routes/lessonReadAloud.ts`: tham số `language`; test.
6. `src/styles/tokens.css`: `--font-zh/ja/ko`; `src/styles/base.css`: quy tắc `[lang]` (5.2); `src/routes/Shadowing.css` và `src/routes/Review.css`: line-height 1.4 cho CJK ở hai chỗ 5.2.
7. `src/routes/Shadowing.tsx` + `shadowingSource.ts`: `ShadowSentence.language`, `resolveSource(..., filter)`, `tts.speak(..., { lang })`, Info thiếu giọng, `lang` attr; `shadowingSource.test.ts` cập nhật (lọc theo ngôn ngữ, tình huống mặc định theo ngôn ngữ — với T20d chưa có, test dùng situation `en`).
8. `src/routes/LessonView.tsx`, `src/routes/Review.tsx`, `src/routes/PatternSituation.tsx`, `src/routes/Today.tsx`, `src/components/NotebookPage.tsx` (nếu có `lang` cố định): thay `lang="en"` trên dữ liệu người dùng bằng `LANG_TAG`/`ROMAN_TAG`; `SpeakButton lang={L}`; `auto_speak` theo `L`; phím `S` theo `L`. (Chưa làm nhãn chiều/bộ lọc — T20c.)
Đầu ra: các file trên + test. Xong khi: tiêu chí 6.14 (7) "T20b" pass; `npm test`/`build`/`lint` pass; với dữ liệu chỉ `en` không có khác biệt hiển thị/âm thanh so với T20a.

**T20c — UI: chọn ngôn ngữ buổi học, nhãn, bộ lọc, đổi tên app**
Phụ thuộc: T20b. Model: **Opus** (≥ 10 file UI + README/manifest).
Làm, theo thứ tự:
1. Đổi tên: `src/hooks/usePageTitle.ts` `APP_NAME = 'Vở Ngoại Ngữ'`; `src/components/Shell.tsx` dùng `APP_NAME`; `src/routes/Login.tsx` H1 + phụ đề; `src/routes/Shadowing.tsx` EmptyState; `src/routes/Settings.tsx` tên tệp xuất; `index.html` (`<title>`, `apple-mobile-web-app-title`); `public/manifest.webmanifest` (name, short_name, description); `README.md` (tiêu đề, đoạn mở đầu, mục mới "Ngôn ngữ học" ngắn: 4 ngôn ngữ, mỗi buổi một ngôn ngữ, bộ lọc trong Cài đặt, giọng đọc phụ thuộc thiết bị + cách cài giọng trên macOS/iOS/Windows/Android); `PRODUCT.md`: **chỉ** thêm một dòng ngay dưới `# Product`: `Name: Vở Ngoại Ngữ (formerly Vở Tiếng Anh). Learning languages since T20: English, Chinese (Simplified), Japanese, Korean; UI stays Vietnamese.` — không sửa gì khác trong PRODUCT.md.
2. `src/routes/Settings.tsx` (+ CSS): khối "Ngôn ngữ" (6.11 (9)) với select + dòng tình trạng giọng; mô tả checkbox nhập cài đặt.
3. `src/routes/LessonEdit.tsx` (+ CSS): select "Ngôn ngữ" ở hàng đầu (3 cột; mobile xuống dòng), mặc định `defaultLessonLanguage`, khoá khi `reps > 0`, nhãn/placeholder/mô tả động, `validateItem` với `language`, `parsePastedList(text, language)`, mô tả/placeholder panel dán theo ngôn ngữ; lưu `language`.
4. `src/routes/Lessons.tsx`: nhãn ngôn ngữ khi `languagesInUse().length > 1`. `src/routes/LessonView.tsx`: dateLine hậu tố khi > 1 ngôn ngữ; điều kiện "Nghe cả trang" thêm `canSpeakLang(L)`; Info thiếu giọng.
5. `src/routes/Today.tsx`: bộ lọc (queue/hardest/hidden/latest), hậu tố "· {Tên}", trạng thái rỗng theo ngôn ngữ + ghost "Học tất cả ngôn ngữ".
6. `src/routes/Review.tsx`: bộ lọc (trừ `?lesson`), `directionLabel`, rỗng theo ngôn ngữ, câu "Đã tạm ẩn {k} thẻ nghe vì thiết bị chưa có giọng đọc phù hợp.", ô listen `lang` + gợi ý CJK, nhãn hiển thị nút loa `LANGUAGE_SHORT[L]`.
7. `src/routes/Patterns.tsx` (+ CSS): lọc + nhóm theo ngôn ngữ, `nameTarget`, mô tả mới. `src/routes/PatternSituation.tsx`: `lang` theo tình huống (phần còn lại từ T20b). `src/routes/Shadowing.tsx`: select tình huống lọc/optgroup.
8. `src/routes/Progress.tsx`: `cardStats` với bộ lọc, tiêu đề khối + dòng giải thích.
Đầu ra: các file trên. Xong khi: tiêu chí 6.14 (7) "T20c" pass; `npm test`/`build`/`lint` pass; checklist 10 mục "Đa ngôn ngữ" (trừ phần giọng thật trên thiết bị, làm ở T20d/deploy); `grep -rn "Vở Tiếng Anh" src index.html public README.md` → 0 kết quả.

**T20d — Bộ mẫu câu khởi đầu zh/ja/ko**
Phụ thuộc: T20a (kiểu `Language`); kiểm tra tay cần T20c. Model: **Opus** (độ chính xác phiên âm là tiêu chí chấp nhận; nội dung 60 câu × 3 trường + ghi chú).
Làm, theo thứ tự:
1. `src/data/patterns.ts`: `Situation.language` (9 tình huống cũ = `'en'`), `nameTarget?`; 12 tình huống mới đúng 6.14 (3)-F (id, nameVi, nameTarget, icon dùng lại, intro, pronunciationFocus, 5 mẫu/tình huống, note); `situationsOf`, `firstSituationId`, `languageOfPattern`; `PATTERN_COUNT` tự tính = 147.
2. `src/domain/language.ts`: `languageOfPattern` dùng dữ liệu thật (bỏ TODO T20a); test item thư viện ja → `ja`.
3. `src/data/patterns.test.ts`: cập nhật theo 6.14 (3)-F (21 tình huống, ràng buộc hệ chữ/phiên âm, `nameTarget` bắt buộc với non-EN, IPA `/…/` chỉ cho EN).
4. `src/routes/shadowingSource.ts`: `DEFAULT_SITUATION` → `firstSituationId(lang)`/`'greetings'`; test.
Đầu ra: 4–5 file. Xong khi: tiêu chí 6.14 (7) "T20d" pass; reviewer đã đối chiếu 60 câu; `npm test`/`build`/`lint` pass.

---

## 10. Checklist test thủ công (chạy ở T17 và trước mỗi lần deploy)

Thiết lập: Chrome desktop 1440px, Chrome Android hoặc DevTools 390px, Safari iOS (nếu có). Hai lần: mode local (không `.env`) và mode supabase.

Đăng nhập / phiên
- [ ] Local: vào `/` không bị đẩy sang `/login`; chip "Cục bộ".
- [ ] Supabase: gửi liên kết, bấm từ email, quay lại đã đăng nhập; reload vẫn giữ phiên; đăng xuất → `/login`.
- [ ] Tài khoản A không thấy dữ liệu tài khoản B (tạo 2 user, kiểm tra Table Editor và app).

Buổi học
- [ ] Tạo buổi 3 mục → `/lessons/:id` hiện trang vở đúng; `cards` có 3 thẻ en_vi.
- [ ] Sửa 1 mục, xoá 1 mục chưa ôn (không hỏi), xoá 1 mục đã ôn (hỏi).
- [ ] Xoá buổi → mất khỏi danh sách, Hôm nay không còn thẻ của buổi.

Ôn thẻ
- [ ] Hôm nay hiện đúng số; "Ôn ngay" → phiên; chấm đủ; tổng kết; quay về Hôm nay số = 0, phút tăng, chuỗi = 1.
- [ ] Đổi giờ hệ thống sang ngày mai (hoặc chỉnh `due` trong DB) → thẻ đến hạn lại; chấm "Nhớ" → sinh thẻ vi_en + listen.
- [ ] Thẻ listen: "Nghe" phát, gõ đúng → "Đúng rồi."; gõ sai → "Chưa đúng." đỏ.
- [ ] Tạo 20 mục mới cùng ngày → phiên chỉ có 15 thẻ mới; hôm sau có 5 còn lại.

Mẫu câu / Shadowing
- [ ] Thêm 1 câu, reload → vẫn "Đã thêm"; thêm cả tình huống → đúng số.
- [ ] Shadowing: nghe 0.5x/1x khác nhau; ghi âm, nghe lại; Network không có upload; rời trang dừng mọi âm thanh.

Tiến độ / Cài đặt
- [ ] Lịch đánh dấu hôm nay sau khi học ≥ 1 phút; thanh mục tiêu đúng.
- [ ] Đổi mục tiêu 30 → Hôm nay hiện "/30 phút".
- [ ] Xuất JSON mở được, có 5 khoá.

Đồng bộ / lỗi
- [ ] DevTools Offline → chấm thẻ → chip "Ngoại tuyến"/"Chưa đồng bộ · n" → Online → chip biến mất, DB có dữ liệu.
- [ ] Mở trên 2 thiết bị: học ở A, reload B thấy cập nhật.

Thiết kế / a11y
- [ ] Không phần tử nào có box-shadow; không border-left màu > 1px; radius ≤ 10px.
- [ ] Mỗi màn ≤ 1 chữ Charm; đỏ chỉ ở quên/lỗi/xoá/lời phê/nhãn lỗi/lề vở.
- [ ] Tab qua toàn bộ Hôm nay và Ôn thẻ bằng bàn phím; focus luôn thấy.
- [ ] Lighthouse Accessibility ≥ 95 trên Hôm nay, Ôn thẻ, Buổi học (sửa).
- [ ] 390px: không cuộn ngang ở mọi màn; nút chấm không bị che.

Đa ngôn ngữ (T20) — chạy trên **Chrome desktop (macOS/Windows)**, **iOS Safari**, **Android Chrome**; ghi rõ thiết bị + phiên bản OS vào kết quả
- [ ] Tạo 1 buổi mỗi ngôn ngữ zh/ja/ko (2–3 mục, có phiên âm) → trang vở hiển thị đúng chữ Hán/Kana/Hangul bằng font hệ thống (không ô vuông), lưới 48px không lệch, phiên âm hiện dưới câu.
- [ ] Nút loa trên trang buổi học zh/ja/ko: **Chrome desktop** đọc đúng ngôn ngữ (macOS có sẵn Tingting/Kyoko/Yuna; Windows cần gói ngôn ngữ — nếu thiếu, kiểm tra nút ẩn + Info đúng câu); **iOS Safari** đọc được trong một chạm (giọng Siri/hệ thống của ngôn ngữ; iOS 17+ có sẵn zh-CN/ja-JP/ko-KR); **Android Chrome** đọc bằng Google TTS (nếu gói ngôn ngữ chưa tải → nút ẩn + Info; tải trong Cài đặt → Ngôn ngữ & nhập liệu → Chuyển văn bản sang giọng nói, mở lại app → nút hiện mà không cần reload nhờ `voiceschanged`; nếu Android không bắn sự kiện, reload là chấp nhận được).
- [ ] Ôn thẻ: thẻ zh hiện "Trung → Việt"; thẻ listen ja: "Nghe" phát tiếng Nhật, gõ kana (có/không dấu câu) → "Đúng rồi."; thẻ listen của ngôn ngữ thiếu giọng không xuất hiện và dòng "Đã tạm ẩn…" đúng.
- [ ] Shadowing câu ko ở 0.5x/1x khác nhau rõ; ghi âm/nghe lại như cũ; dòng "Giọng mẫu: server local." không hiện với ko dù server EN bật.
- [ ] Cài đặt → "Ngôn ngữ đang học" = Tiếng Nhật → Hôm nay chỉ thẻ ja, trang vở là buổi ja gần nhất, Mẫu câu chỉ 4 tình huống ja, Shadowing chỉ tình huống ja, Tiến độ khối thẻ "Thẻ ôn · Tiếng Nhật"; chuỗi ngày và phút không đổi; Nhật ký vẫn đủ buổi mọi ngôn ngữ với nhãn.
- [ ] Đặt lại "Tất cả" → mọi màn như trước; Mẫu câu 4 nhóm 9/4/4/4.
- [ ] Supabase: chạy lại `schema.sql` lần 2 không lỗi; **trước** khi chạy migration (mô phỏng bằng project phụ hoặc tạm bỏ cột) tạo buổi → toast schema 1 lần, buổi vẫn lưu (language = en trên server); sau migration tạo buổi zh → cột `language='zh'` trong Table Editor; thiết bị thứ hai reload thấy buổi zh với giọng zh.
- [ ] Nhập JSON xuất từ bản trước T20 → mọi buổi là Tiếng Anh, không bản ghi bị bỏ qua; xuất lại có `language` và `study_language`.
- [ ] Dán danh sách trong buổi zh với 3 phần "câu - nghĩa - pinyin" → đúng 3 ô; trong buổi en vẫn theo quy tắc cũ (`/…/`).
- [ ] Cài PWA lại (Android/iOS) → tên "Vở Ngoại Ngữ" dưới icon; tab trình duyệt "Hôm nay · Vở Ngoại Ngữ".
- [ ] Không có request nào tới fonts.googleapis.com ngoài Be Vietnam Pro + Charm (Network, lọc "font").

---

## 11. Cài đặt và deploy miễn phí

### 11.1 Chạy cục bộ (không cần tài khoản)
```
npm install
npm run dev          # http://localhost:5173 — chế độ cục bộ (localStorage)
```

### 11.2 Bật đồng bộ với Supabase (free)
1. Tạo project tại supabase.com (region Singapore gần Việt Nam nhất).
2. SQL Editor → dán toàn bộ `supabase/schema.sql` → Run. Kiểm tra: `select tablename, rowsecurity from pg_tables where schemaname='public'` → tất cả `true`.
3. Authentication → Providers → Email: bật; tắt "Confirm email" không cần (OTP magic link tự xác nhận). Authentication → URL Configuration: Site URL = URL production (vd `https://vo-tieng-anh.vercel.app`); Additional Redirect URLs: `http://localhost:5173/login`, `https://vo-tieng-anh.vercel.app/login`.
4. Lưu ý giới hạn email: dịch vụ email mặc định của Supabase giới hạn rất thấp (khoảng 2 email/giờ/project) và chỉ dành cho thử nghiệm. Với vài người dùng, cấu hình **Custom SMTP** miễn phí (Authentication → SMTP Settings) bằng Resend (3.000 email/tháng free) hoặc Brevo (300 email/ngày free). Ghi vào câu hỏi mở.
5. Project Settings → API: sao chép `Project URL` và `anon public` → tạo `.env` từ `.env.example`.
6. `npm run dev` → `/login` hiện form email.

### 11.3 Deploy Vercel (free)
1. Đẩy repo lên GitHub (không commit `.env`).
2. Vercel → Add New Project → import repo; Framework: Vite; Build `npm run build`; Output `dist`.
3. Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Preview).
4. `vercel.json` (T01) đảm bảo SPA fallback:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
5. Deploy → thêm domain Vercel vào Supabase Redirect URLs (bước 11.2.3).
Netlify thay thế: file `public/_redirects` với `/* /index.html 200`.

### 11.4 Cập nhật schema sau này
Sửa `supabase/schema.sql` theo kiểu idempotent (`add column if not exists`) và chạy lại toàn bộ; không dùng migration tool ở MVP. **(T20)** Bản có đa ngôn ngữ yêu cầu chạy lại file để thêm `lessons.language` và `settings.study_language` (3.2); client cũ/mới đều chạy được trước và sau khi chạy (3.2 xử lý `PGRST204`).

---

## 12. Giả định và câu hỏi mở

### 12.1 Giả định đã đặt (coder làm theo nếu không có quyết định khác)
1. Múi giờ cố định `Asia/Ho_Chi_Minh` cho mọi tính toán ngày học, bất kể thiết bị ở đâu.
2. "Sau 2 lần ôn en_vi" được cụ thể hoá thành: thẻ en_vi đã có lần ôn ở ngày trước và hôm nay chấm khác "Quên" (4.3).
3. FSRS dùng preset mặc định của ts-fsrs v6 (FSRS-7), `desiredRetention 0.9`, bước học 1m/10m, `maximumInterval 365`, không fuzz.
4. Thẻ "đến hạn hôm nay" = `due <= hết ngày địa phương hôm nay` (không chỉ `<= now`), để con số buổi sáng ổn định cả ngày.
5. Thời gian học ôn thẻ = thời gian trả lời thật (cap 60s/thẻ), không phải 20s cố định; 20s/thẻ chỉ để **ước tính**.
6. Không có "Hoàn tác" chấm nhầm và không có "Tạm ẩn thẻ" trong UI MVP (cột `suspended` để dành).
7. Items từ thư viện mẫu câu không thuộc buổi nào và không hiển thị trong Nhật ký buổi học.
8. Không dark mode. PWA: chỉ **manifest + icon** (cài lên màn hình chính) ở T18c; service worker/offline vẫn GĐ3.
9. Ghi âm tối đa 15 giây/lần; tốc độ chỉ áp dụng cho giọng mẫu.
10. Một người dùng ≤ ~200 buổi, ≤ ~3.000 thẻ → tải hết snapshot là chấp nhận được.
11. `vitest` được thêm làm devDependency (miễn phí) để test các hàm thuần.
12. Giọng TTS lưu theo tên trong `settings.voice_name`; thiết bị không có giọng đó thì tự chọn giọng `en-US` khác.
13. (T19) Server TTS local tuân theo hợp đồng OpenAI `POST /v1/audio/speech` với `response_format: 'wav'`; `model` là hằng (`vieneu-v3-turbo` cho VI, `kokoro` cho EN) và server local bỏ qua/chấp nhận chuỗi này; giọng mặc định khi để trống là `Hải Đăng` (VieNeu) / `af_heart` (Kokoro).
14. (T19) Danh sách giọng lấy từ `GET /v1/voices` (VieNeu) hoặc `GET /v1/audio/voices` (kokoro-fastapi); định dạng phản hồi khác nhau nên parse khoan dung; không có danh sách thì người dùng gõ tên giọng.
15. (T19) `useTts().supported` vẫn chỉ phản ánh Web Speech; server EN không mở khoá thẻ `listen` trên trình duyệt thiếu Web Speech.
16. (T19) Trình duyệt chỉ miễn mixed content cho `localhost`/`127.*`/`[::1]`; app trên HTTPS không thể gọi `http://192.168.*` — spec hiển thị cảnh báo thay vì thử gọi.
17. (T19) Trạng thái "server down" chỉ sống 60 giây trong bộ nhớ phiên, không lưu; toast lỗi 1 lần/phiên/ngôn ngữ.
18. (T19) Không có nút đọc tiếng Việt trên Hôm nay và trên từng mục của Trang buổi học (giữ trang vở sạch); đọc cả trang thay thế.
19. (T18a) Dán danh sách chỉ điền form; dấu tách thử theo thứ tự ` - `, ` – `/` — `, tab, `|`, `: ` (dấu hai chấm phải có khoảng trắng theo sau); em dash được coi như en dash; `kind` chỉ suy ra `word`/`phrase`, không bao giờ `pattern`; quá 100 dòng thì chặn chứ không cắt bớt.
20. (T18a) Khi thêm hàng dán, mọi hàng **mới và trống hoàn toàn** trong form bị bỏ (không chỉ hàng cuối); hàng đã có `itemId` hoặc đã gõ dở giữ nguyên.
21. (T18b) Chỉ có chế độ **gộp** (upsert theo id, không xoá); bản ghi cùng id bị ghi đè toàn bộ theo tệp kể cả tiến độ FSRS. Thẻ trùng `(item_id, direction)` hoặc item trùng `pattern_id` với bản ghi hiện có **khác id** → giữ bản hiện có, bỏ bản trong tệp (không gộp tiến độ).
22. (T18b) `study_days` nhập theo delta `max(0, imported − existing)` từng trường; ngày ngoài cửa sổ 120 ngày của snapshot bị bỏ qua vì không biết giá trị hiện có để trừ.
23. (T18b) Ở chế độ Supabase, nhập bị chặn khi offline hoặc còn op chờ đồng bộ, để không đẩy hàng trăm op vào hàng đợi localStorage; ở chế độ cục bộ không chặn.
24. (T18b) Thêm `upsertLessons` vào Repository + op `upsertLessons` thay vì gửi từng `upsertLesson`; `addStudyTime` vẫn một op/ngày (≤ 120 request) — chấp nhận, không thêm rpc mới.
25. (T18b) Trường `settings` không hợp lệ trong tệp → giữ giá trị hiện tại của riêng trường đó; không từ chối cả khối cài đặt.
26. (T18c) Không service worker/offline/`beforeinstallprompt`; không `vite-plugin-pwa`; `apple-mobile-web-app-status-bar-style="default"` vì Shell chưa chừa `safe-area-inset-top`. Icon PNG sinh từ `public/icon-source.svg` (biến thể full-bleed của `favicon.svg`) bằng `qlmanage`/`rsvg-convert`, có `PROVENANCE.md`; Chrome hiện cài được không cần service worker (yêu cầu đã bỏ từ Chrome 108+) — kiểm chứng ở (7)-C.
27. (T20) Ngôn ngữ là thuộc tính của **buổi học**; item/card không lưu ngôn ngữ, suy ra qua `itemLanguageResolver`. Item thư viện lấy ngôn ngữ từ tình huống seed; seed id bị xoá sau này → `'en'`.
28. (T20) Hạn mức "thẻ mới mỗi ngày" là **một** hạn mức chung cho cả vở (đếm `first_reviewed_at` trên mọi ngôn ngữ), không phải mỗi ngôn ngữ 15 thẻ — giữ đúng tinh thần "mỗi ngày một ít" và không đổi thuật toán 4.4.
29. (T20) Khoá đổi ngôn ngữ buổi khi có thẻ `reps > 0` (đã ôn ít nhất một lần), không phải khi "có thẻ" (vì mọi item đều sinh thẻ ngay khi lưu — khoá từ lúc đó sẽ không cho sửa lỗi chọn nhầm ngôn ngữ).
30. (T20) Bộ lọc `study_language` lưu trong bảng `settings` (đồng bộ giữa thiết bị) chứ không phải `localStorage` theo thiết bị: "ngôn ngữ đang học" là trạng thái của người học, không phải của máy; và migration đã phải chạy cho `lessons.language` nên thêm một cột không tốn thêm bước.
31. (T20) Không có chọn giọng theo từng ngôn ngữ trong Cài đặt (chỉ `voice_name` cho tiếng Anh như cũ); zh/ja/ko tự chọn theo `pickVoiceFor`. Nếu người dùng cần (vd thích giọng nữ/nam), thêm `voice_name_zh/ja/ko` ở giai đoạn sau.
32. (T20) Bộ khởi đầu zh/ja/ko không dùng `slots` để nội dung ngắn, dễ kiểm phiên âm; `level` dùng nhãn `A1` chung (tương đương HSK1/N5/TOPIK1) thay vì thêm thang riêng.
33. (T20) Dán danh sách với zh/ja/ko: phần 3 **luôn** là phiên âm (không dò `/…/`), vì pinyin/romaji/RR không có dấu phân biệt với tiếng Việt không dấu; quy tắc cố định dễ giải thích hơn đoán.
34. (T20) Font CJK chỉ từ hệ thống (`--font-zh/ja/ko`); không tải Noto từ Google Fonts (dung lượng lớn, trái yêu cầu). Thiết bị không có font CJK → hiển thị ô vuông, không xử lý thêm.
35. (T20) Client gặp `PGRST204` (server chưa có cột mới) → gửi lại không cột mới + toast hướng dẫn, thay vì dead-letter; chấp nhận buổi tạm là `en` trên server cho tới khi chạy migration.

### 12.2 Câu hỏi mở cần người dùng quyết

**Đã quyết (2026-11-09, người dùng):**
1. **Email đăng nhập**: dùng SMTP mặc định của Supabase trước (giới hạn ~2 email/giờ). Chuyển sang Custom SMTP free (Resend/Brevo) trước khi mời thêm người; ghi chú này vào README mục Supabase.
2. **Giới hạn thẻ mới/ngày**: **cho chỉnh 5–30 trong Cài đặt**, mặc định 15. Ảnh hưởng: thêm cột `settings.new_cards_per_day int not null default 15 check (between 5 and 30)` vào `supabase/schema.sql`, trường `new_cards_per_day` trong `Settings` (3.1, đã cập nhật), `buildQueue` (4.4) đọc giá trị này thay vì hằng số, màn Cài đặt (6.11) thêm trường số (Field `type=number`, min 5, max 30, step 1).
3. **Hoàn tác chấm nhầm**: **không có ở MVP** (giữ giả định 12.1.6).
7. **Tên hiển thị**: tự đặt trong Cài đặt, mặc định là phần trước `@` của email (giữ như spec).

**Điều chỉnh sau finish review (impeccable, 2026-11-09):**
- Today: bỏ khối chào "Chào {tên} / ngày" (category default); H1 "Hôm nay" visually-hidden; card đến hạn và trang vở dẫn viewport.
- Progress: thanh mục tiêu = dòng kẻ 1px với đoạn mực tím 3px; lịch 8 tuần = ô ly liền (lưới 1px), done = tick bút tím vẽ tay, partial = chấm mực, future = ô trống; ≥1024 mục tiêu và lịch 2 cột.
- Patterns: pitch 96px/mẫu, nút thêm từng câu chỉ icon Plus 44 (bulk "Thêm cả tình huống" giữ chữ), đã thêm = icon Check.
- Review: thẻ đứng trên lưới ô ly + lề đỏ; chấm = nét bút (gạch đỏ Quên/Khó, tick tím Nhớ/Dễ) ~350ms — khoảnh khắc chuyển động duy nhất của app; gợi ý phím chỉ hiện với `(hover: hover) and (pointer: fine)`.
- Browser surfaces: `caret-color: var(--purple)`, placeholder và meta text dùng `--mute`.

**Đã quyết (2026-11-09, T19 — giọng đọc & TTS provider, xem 6.12):**
1. **Tiếng Anh mặc định vẫn Web Speech** giọng `en-*`. Server local chỉ dùng cho tiếng Anh khi người dùng bật rõ "Dùng server local cho tiếng Anh" (dành cho Kokoro), kèm cảnh báo "Giọng từ model tiếng Việt có thể không chuẩn tiếng Anh."
2. **Tiếng Việt chỉ đọc được khi có server VI** (VieNeu-TTS). Không có server → không hiện nút loa VI. Không tự fallback sang giọng `vi` của hệ điều hành; nhưng có switch phụ **tắt mặc định** "Khi không có server, dùng giọng tiếng Việt của thiết bị", chỉ hiện khi thiết bị có giọng `vi-*` (đề xuất của spec — xem câu hỏi mở 9).
3. **Cấu hình server lưu trên thiết bị** (`localStorage` `vta:v1:tts`), không đồng bộ Supabase, không có API key.
4. **Fallback**: server lỗi/timeout (≤ 8 s) → tiếng Anh tự về Web Speech cho chính lượt đó; tiếng Việt ẩn nút; đánh dấu "down" 60 s; toast info 1 lần/phiên/ngôn ngữ (EN: "Không kết nối được server giọng đọc, đang dùng giọng trình duyệt."; VI: biến thể vì không có giọng thay thế). HTTP 4xx (trừ 429) coi là cấu hình sai, không đánh dấu down.
5. **Cache audio trong bộ nhớ phiên** theo khoá `(provider, baseUrl, voice, speed, text)`, ≤ 50 mục / 20 MB, không ghi storage.
6. **Ràng buộc iOS**: provider server dùng một `<audio>` singleton, phát WAV im lặng đồng bộ trong gesture để mở khoá, rồi đổi `src` khi fetch xong; không dùng AudioContext ở T19.
7. Nơi hiện nút VI (MVP+): mặt sau thẻ `en_vi`; "Nghe cả trang" + "Hỏi giáo viên" + "Lỗi hay gặp" ở Trang buổi học; "Lưu ý phát âm" ở Mẫu câu tình huống. Không ở Hôm nay, không ở từng mục/từng mẫu câu.
8. Speed: gửi `speed` nguyên giá trị UI khi ≠ 1; server từ chối (400/422) → gửi lại không `speed` và dùng `audio.playbackRate`.

**Đã quyết (T19, người dùng, 2026-11-09):**
- Q9: **Giữ** switch "dùng giọng tiếng Việt của thiết bị khi không có server", mặc định tắt, chỉ render khi thiết bị có giọng `vi-*`.
- Q10: Cần tiếng Việt **cả trên điện thoại qua https** → server VieNeu đặt sau **Tailscale** hoặc **Cloudflare Tunnel** (free). Hệ quả: validation URL phải chấp nhận host public https (vd `*.ts.net`, `*.trycloudflare.com`, domain riêng); cảnh báo riêng tư cho host public vẫn hiện nhưng ở dạng thông tin ("server ngoài mạng nội bộ sẽ nhận nội dung bạn học"), không chặn. README thêm mục hướng dẫn 2 cách (Tailscale Serve / `cloudflared tunnel --url http://localhost:8000`) và nhắc bật CORS cho origin Vercel.
- Q11: **Giữ** tuỳ chọn "Dùng server local cho tiếng Anh" (Kokoro), mặc định tắt.

**Đã quyết (2026-11-09, T18 — dán danh sách, nhập JSON, PWA, xem 6.13):**
1. **Dán nhiều dòng (T18a)**: nút "Dán danh sách" trong form buổi học mở textarea; mỗi dòng một mục; tách `EN – VI` bằng ` - `, ` – `, tab, `|` hoặc `:` theo thứ tự; phần 3 là IPA nếu bắt đầu bằng `/`, ngược lại là ghi chú; dòng không tách được → chỉ EN (validation 6.6 báo); bỏ dòng trống và đánh số/gạch đầu dòng; xem trước số mục rồi "Thêm vào buổi"; `kind` suy từ số từ (1 từ → `word`, còn lại `phrase`); tối đa 100 dòng.
2. **Nhập JSON (T18b)**: Cài đặt → "Dữ liệu" → "Nhập dữ liệu (JSON)"; validate đúng hình dạng snapshot 5 khoá; **chế độ gộp** upsert theo id, không xoá; `user_id` ghi đè bằng user hiện tại; `settings` chỉ nhập khi tick "Nhập cả cài đặt"; xem trước số buổi/mục/thẻ thêm/cập nhật trong ConfirmDialog (nút "Nhập" primary); ghi theo thứ tự lessons → items → cards → study_days (→ settings); `study_days` **không cộng đôi**: `addStudyTime` với delta `max(0, imported − existing)`; action mới `importSnapshot(file, { includeSettings })` trong DataProvider (Opus); tệp ≤ 5 MB; lỗi parse có câu riêng; thành công → toast số lượng + tải lại snapshot nền.
3. **PWA cơ bản (T18c)**: `public/manifest.webmanifest` (name "Vở Tiếng Anh", short_name "Vở TA", lang vi, standalone, theme `#4B2E83`, background `#F7F5FB`), icon 192/512 (+maskable, +apple-touch 180) PNG **sinh từ SVG nguồn trong repo** với tệp provenance; `link rel=manifest` + `apple-touch-icon` + meta `apple-mobile-web-app-*`; **không** service worker/offline ở T18 (tránh cache cũ khi đang phát triển; GĐ3); không cài `vite-plugin-pwa`.

**Đã quyết (T18, coordinator theo uỷ quyền, 2026-11-09):**
- Q12: Chỉ làm chế độ **gộp**; "thay thế toàn bộ" = người dùng tự "Xoá toàn bộ dữ liệu" rồi nhập.
- Q13: Thẻ trùng `(item_id, direction)` khác id → **giữ thẻ hiện có**.
- Q14: Icon sinh tay bằng `qlmanage`/`rsvg-convert`, **không thêm package**; ghi PROVENANCE.md.
- Q15: iOS status bar `default`.

**Giới hạn đã biết (T18b):** nhập tệp JSON xuất từ **tài khoản Supabase khác** trên cùng project sẽ bị RLS từ chối (id là khoá chính toàn cục thuộc tài khoản cũ) → các op vào dead-letter. Luồng cục bộ → Supabase và cùng tài khoản hoạt động bình thường. Khắc phục (GĐ sau): đổi id khi gặp 42501.

**Đã quyết (2026-11-09, người dùng, T20 — đa ngôn ngữ & đổi tên, xem 6.14):**
1. Ngôn ngữ học: `en` (Anh), `zh` (Trung giản thể, pinyin có dấu thanh), `ja` (Nhật, romaji Hepburn hoặc kana), `ko` (Hàn, Revised Romanization). Giao diện và ngôn ngữ mẹ đẻ vẫn tiếng Việt.
2. Tổ chức theo cách (a): **mỗi buổi học một ngôn ngữ** (`lessons.language`), chung một vở, chung chuỗi ngày và phút. Cài đặt có "Ngôn ngữ đang học" (một ngôn ngữ hoặc "Tất cả", mặc định "Tất cả") lọc Hôm nay/Ôn thẻ, Shadowing, Kho mẫu câu, thống kê thẻ. Danh sách buổi học gắn nhãn ngôn ngữ khi có > 1 ngôn ngữ.
3. Tên app **"Vở Ngoại Ngữ"** (title, manifest name/short_name "Vở Ngoại Ngữ", apple title, Đăng nhập, README, dòng tên PRODUCT.md). Domain `tienganh-giaotiep.vercel.app` giữ nguyên.
4. Dữ liệu cũ = `en`; migration idempotent (`add column if not exists` + check + default 'en'); localStorage thiếu trường → 'en'.
5. Giữ tên trường/cột `ipa` (nhãn UI "Phiên âm", placeholder theo ngôn ngữ) và `en` (gọi là "câu ngôn ngữ đích"; lý do ở 6.14 (5).2).
6. Giọng: `en→en-US`, `zh→zh-CN`, `ja→ja-JP`, `ko→ko-KR`, Web Speech chọn giọng theo lang, thiếu giọng → "Thiết bị chưa có giọng {ngôn ngữ}…"; server local EN chỉ cho `en`; thuộc tính HTML `lang` đúng (`en`, `zh-Hans`, `ja`, `ko`); font stack CJK hệ thống, không tải từ Google Fonts; cỡ chữ CJK giữ, tăng line-height nơi cần (5.2).
7. Kho mẫu câu: `Situation.language`; 9 tình huống cũ = `en`; bộ khởi đầu zh/ja/ko mỗi ngôn ngữ 4 tình huống × 5 câu (Chào hỏi & giới thiệu, Nhà hàng & gọi món, Mua sắm & hỏi giá, Hỏi đường & đi lại); coder viết nội dung, reviewer kiểm phiên âm; màn Kho mẫu câu lọc theo ngôn ngữ, "Tất cả" → nhóm theo ngôn ngữ.
8. Form buổi học: chọn ngôn ngữ ở đầu (mặc định = ngôn ngữ đang học nếu ≠ Tất cả, ngược lại = buổi gần nhất, mặc định `en`); không đổi sau khi đã có thẻ ôn; dán danh sách và nhập JSON mang `language` (JSON thiếu → `en`).
9. Chiều ôn giữ mã `en_vi/vi_en/listen`; nhãn "Trung → Việt"/"Việt → Trung"… theo ngôn ngữ.

**Đã quyết (T20, spec-writer theo uỷ quyền "chọn phương án ít rủi ro", 2026-11-09):**
- Q16: "Đã có thẻ ôn" hiểu là **có thẻ `reps > 0`** (12.1.29). Nếu muốn chặt hơn (khoá ngay khi có item), đổi điều kiện trong `LessonEdit` — một dòng.
- Q17: Bộ lọc lưu trong **`settings.study_language`** (đồng bộ), không phải theo thiết bị (12.1.30).
- Q18: Hạn mức thẻ mới **chung** cho cả vở (12.1.28). Nếu muốn mỗi ngôn ngữ một hạn mức: đếm `introducedToday` theo `langOf` khi có `language` — đổi 3 dòng trong `buildQueue` + test.
- Q19: Không có chọn giọng theo ngôn ngữ ở Cài đặt (12.1.31); chỉ dòng tình trạng "có/chưa có".
- Q20: Bộ khởi đầu không dùng `slots`, `level: 'A1'` (12.1.32); `nameTarget` là trường mới tuỳ chọn thay vì nhồi vào `nameEn`.
- Q21: Dán danh sách zh/ja/ko: phần 3 luôn là phiên âm (12.1.33).
- Q22: Server chưa migrate → gửi lại không cột mới + toast (12.1.35), không chặn ghi.
- Q23: Nhật ký buổi học **không** lọc theo ngôn ngữ (chỉ gắn nhãn) — bám đúng câu chữ quyết định 2; trang buổi học/`?lesson=` bỏ qua bộ lọc.
- Q24: `normalizeAnswer` nhận `language` để bỏ dấu câu CJK và khoảng trắng (zh/ja); mặc định `en` không đổi.
- Q25: "Nghe cả trang" (T19) giữ điều kiện `viAvailable`, thêm `canSpeakLang(L)`; không mở rộng thành "đọc chỉ ngôn ngữ đích" ở T20.
- Q26: `PRODUCT.md` chỉ thêm **một dòng tên** (quyết định 3); `CLAUDE.md` không thuộc phạm vi coder (xem câu hỏi mở 16).

**Chưa quyết (coder theo giả định 12.1 / spec hiện tại):**
9. **(T19) Giọng tiếng Việt của thiết bị làm dự phòng**: spec để một switch phụ tắt mặc định. Nếu bạn thấy chất lượng giọng `vi` của iOS/macOS chấp nhận được thì giữ; nếu muốn gọn, bỏ hẳn switch này (xoá `deviceFallback`, nhánh `web-speech` cho `vi` trong router).
10. **(T19) Dùng trên điện thoại**: app deploy HTTPS không gọi được `http://192.168.x.x` (mixed content). Bạn định dùng tiếng Việt chủ yếu trên laptop (localhost — chạy ngay), hay cần cả điện thoại? Nếu cần: (a) mở app bằng `npm run dev --host` trên laptop và truy cập qua `http://<ip-laptop>:5173` từ điện thoại; (b) hoặc đặt server sau https (Tailscale Serve/Cloudflare Tunnel — có cảnh báo "ngoài mạng nội bộ"). Spec hỗ trợ cả hai nhưng không tự động hoá.
11. **(T19) Server tiếng Anh**: có thật sự cần Kokoro ở MVP+ hay chỉ cần VI? Nếu bỏ, T19b/T19c vẫn giữ code router nhưng ẩn switch EN (giảm một nhóm trường trong Cài đặt).
4. ~~**Dán nhiều dòng** (T18) — có cần ngay cho buổi học đầu tiên không?~~ Đã quyết: làm ở T18a (xem khối "Đã quyết T18" ở trên).
12. **(T18b) Chế độ "thay thế toàn bộ"**: spec chỉ có gộp. Nếu bạn muốn "xoá sạch rồi nhập đúng như tệp" (khôi phục tuyệt đối), cần thêm lựa chọn thứ hai trong dialog với xác nhận gõ XOA và cascade xoá trên Supabase — chưa làm; hiện tương đương là "Xoá toàn bộ dữ liệu trên thiết bị này" (chỉ local) rồi nhập.
13. **(T18b) Thẻ trùng `(item_id, direction)` khác id**: spec giữ thẻ hiện có, bỏ thẻ trong tệp. Lựa chọn khác là giữ bản có `reps` lớn hơn (gộp tiến độ) — phức tạp hơn một chút; chỉ cần nếu bạn hay gộp dữ liệu từ hai thiết bị dùng chế độ cục bộ riêng rẽ.
14. **(T18c) Script sinh icon**: dùng `qlmanage`/`rsvg-convert` tay (không thêm package) hay đồng ý thêm devDependency `@resvg/resvg-js` để có `npm run icons` lặp lại được? Spec mặc định cách tay + PROVENANCE.md.
15. **(T18c) Thanh trạng thái iOS**: `default` (an toàn) hay `black-translucent` để thanh tím tràn lên dưới đồng hồ (cần sửa Shell chừa `safe-area-inset-top`)? Spec: `default`.
16. ~~**(T20) `CLAUDE.md`**~~ Đã quyết (2026-11-09, người điều phối thay mặt người dùng "tự quyết tên"): đổi tên và mô tả trong `CLAUDE.md` ở T20c.
17. **(T20) Domain Vercel** `tienganh-giaotiep.vercel.app` giữ nguyên theo quyết định; nếu sau này đổi, nhớ cập nhật Supabase Redirect URLs (11.2.3).
18. ~~**(T20) Giọng zh/ja/ko trên Windows Chrome**~~ Đã quyết: T20 chỉ hiện thông báo thiếu giọng + mục ngắn trong README hướng dẫn cài gói ngôn ngữ; server local cho zh/ja/ko để giai đoạn sau nếu người dùng cần.
19. ~~**(T20) Phiên âm tiếng Nhật**~~ Đã quyết: romaji Hepburn có macron cho bộ khởi đầu; đổi sang kana chỉ là sửa dữ liệu nếu sau này cần.
20. **(T20c, ghi nhận sau review)** Dòng tên trong PRODUCT.md viết "Vở Ngoại Ngữ" không kèm "(formerly Vở Tiếng Anh)" để `grep` tên cũ trên toàn bộ tệp app ra 0; tên cũ chỉ còn trong SPEC.md. Chấp nhận lệch nguyên văn §9 T20c.
5. **Thẻ `word`** (từ đơn) có nên bỏ qua chiều `listen` (nghe một từ rồi gõ dễ nhầm chính tả) hay giữ như cụm/mẫu câu? Spec hiện giữ cho cả 3 loại.
6. **Lời phê Charm**: 3 câu cố định ("Tốt lắm!", "Đều đặn lắm!", "Cố lên nhé!") có hợp ý không? "Cố lên nhé!" hiện chưa dùng ở màn nào — có muốn hiện khi chuỗi vừa đứt không? (Rủi ro: cảm giác bị chấm điểm, trái nguyên tắc 3.)
7. **Tên hiển thị trên thanh trên**: dùng tên tự đặt hay phần trước @ email? Spec: tên tự đặt, fallback email.
8. **Region Supabase**: Singapore (khuyến nghị) hay khác?

---

## Phụ lục A. Microcopy dùng chung

| Khoá | Nội dung |
|---|---|
| Lỗi tải chung | "Không tải được dữ liệu. Kiểm tra mạng rồi thử lại." · nút "Thử lại" |
| Lỗi ghi | "Chưa lưu được. Sẽ tự thử lại khi có mạng." |
| Hết phiên đăng nhập | "Phiên đăng nhập đã hết. Hãy đăng nhập lại." |
| Lỗi đăng xuất | "Không đăng xuất được. Kiểm tra mạng rồi thử lại." |
| Quá nhiều lỗi ghi | "Có dữ liệu chưa đồng bộ được. Hãy tải lại trang khi có mạng." |
| Ngoại tuyến | "Ngoại tuyến" |
| Chưa đồng bộ | "Chưa đồng bộ · {n}" |
| Cục bộ | "Cục bộ" |
| Loading toàn trang | "Đang mở vở…" |
| Loading phiên | "Đang xếp thẻ…" |
| Đã lưu | "Đã lưu." |
| Huỷ | "Huỷ" · Ở lại: "Ở lại" |
| 404 | "Không có trang này." · "Về Hôm nay" |
| TTS không hỗ trợ | "Trình duyệt này không đọc được câu mẫu. Hãy thử Chrome hoặc Edge." |
| Mic bị chặn | "Trình duyệt đã chặn micro. Mở cài đặt trang để cho phép, rồi tải lại." |
| Ghi âm không hỗ trợ | "Trình duyệt này chưa hỗ trợ ghi âm. Bạn vẫn có thể nghe mẫu và nói theo." |
| Riêng tư ghi âm | "Bản ghi chỉ lưu tạm trên thiết bị này trong lúc luyện và không được tải lên." |
| Trạng thái thẻ | "mới" · "đang học" · "khó" · "quên {n} lần" · "đã thuộc" |
| Mức chấm | "Quên" · "Khó" · "Nhớ" · "Dễ" |
| Chiều ôn | "Anh → Việt" · "Việt → Anh" · "Nghe → gõ" |
| Loại mục | "Từ" · "Cụm" · "Mẫu câu" |
| (T19) Nút loa tiếng Việt | aria-label "Nghe nghĩa tiếng Việt" · "Nghe lưu ý phát âm" · "Nghe phần hỏi giáo viên" · "Nghe lỗi hay gặp" · đang chờ: "Đang tải giọng đọc. Bấm để dừng." |
| (T19) Đọc cả trang | "Nghe cả trang" · "Dừng" · "Tiếp tục nghe" |
| (T19) Toast server TTS | EN: "Không kết nối được server giọng đọc, đang dùng giọng trình duyệt." · VI: "Không kết nối được server giọng đọc tiếng Việt. Nút nghe tiếng Việt tạm ẩn." · 429: "Server giọng đọc đang bận. Thử lại sau vài giây." |
| (T19) Cài đặt — switch | "Dùng server local cho tiếng Anh" / "Dành cho server như Kokoro. Giọng từ model tiếng Việt có thể không chuẩn tiếng Anh." · "Đọc tiếng Việt bằng server local" / "Đọc nghĩa, lưu ý phát âm và phần hỏi giáo viên bằng giọng Việt tự nhiên. Cần một máy tính đang chạy VieNeu-TTS." · "Khi không có server, dùng giọng tiếng Việt của thiết bị" / "Chất lượng thường kém hơn nhiều." |
| (T19) Cài đặt — trường | "Địa chỉ server" · "Giọng" (option "Mặc định của server") · "Tốc độ" ("0,8x"…"1,2x") · "Giọng trình duyệt" |
| (T19) Cài đặt — nút & trạng thái | "Kiểm tra kết nối" · "Nghe thử" · "Chưa kiểm tra." · "Đang kiểm tra…" · "Kết nối được · {ms} ms · {n} giọng" · "Đang tạm dùng giọng trình duyệt vì không kết nối được server." |
| (T19) Cài đặt — lỗi địa chỉ | "Địa chỉ phải bắt đầu bằng http:// hoặc https://." · "Địa chỉ không được chứa ? hoặc #." · "Địa chỉ không được chứa tên đăng nhập." · "Địa chỉ tối đa 200 ký tự." · gợi ý "Đã bỏ /v1 ở cuối — app tự thêm." |
| (T19) Cài đặt — lỗi kết nối | "Quá 4 giây không phản hồi. Server có đang chạy không?" · "Không kết nối được. Kiểm tra server đã chạy và địa chỉ đúng chưa. Nếu server đang chạy trên máy khác, khởi động với `--host 0.0.0.0` và cho phép CORS từ {origin}." · "Trang này mở bằng HTTPS nên trình duyệt chặn kết nối http tới địa chỉ mạng nội bộ. Mở app qua http trên cùng mạng, hoặc chạy server qua https." · "Server trả lỗi {status}." · "Server đang bận. Thử lại sau vài giây." |
| (T19) Riêng tư TTS | "Chỉ câu đang học được gửi tới server bạn tự cấu hình. Không gửi API key, không gửi dữ liệu khác." · cảnh báo "Địa chỉ này không thuộc mạng nội bộ. Server đó sẽ nhận nội dung bạn học." |
| (T19) Câu nghe thử | EN "Nice to meet you." · VI "Rất vui được gặp bạn." |
| (T19) Shadowing | "Giọng mẫu: server local." |
| (T18a) Dán danh sách — nút | "Dán danh sách" · "Thêm vào buổi" · "Đóng" |
| (T18a) Dán danh sách — trường | nhãn "Dán mỗi dòng một mục" · mô tả "Tiếng Anh và tiếng Việt cách nhau bằng dấu gạch ngang, dấu \| hoặc tab. Phần thứ ba, nếu có, là phiên âm /…/ hoặc ghi chú." · placeholder "Can I have the bill, please? - Cho tôi tính tiền⏎bill - hoá đơn - /bɪl/" |
| (T18a) Dán danh sách — trạng thái | "{n} mục sẽ được thêm" · " · {k} dòng chưa có nghĩa tiếng Việt" · "chưa có nghĩa" · lỗi "Tối đa 100 dòng mỗi lần dán. Hiện có {total} dòng." · toast "Đã thêm {n} mục. Kiểm tra rồi bấm Lưu." |
| (T18b) Nhập JSON — nút & mô tả | "Nhập dữ liệu (JSON)" · "Tệp gồm buổi học, mục, thẻ và lịch sử ngày học của bạn. Nhập tệp đã xuất để khôi phục hoặc gộp vào dữ liệu hiện có." · chặn "Nhập dữ liệu cần có mạng và không còn thay đổi chờ đồng bộ." · "Đang đọc tệp…" |
| (T18b) Nhập JSON — lỗi tệp | "Tệp quá lớn (tối đa 5 MB)." · "Tệp không phải JSON hợp lệ." · "Tệp không đúng định dạng của Vở Tiếng Anh. Hãy chọn tệp đã xuất từ mục Cài đặt." · không hỗ trợ "Trình duyệt này không chọn được tệp. Hãy thử Chrome, Edge hoặc Safari mới." |
| (T18b) Nhập JSON — dialog | "Nhập dữ liệu từ tệp?" · "Dữ liệu hiện có được giữ nguyên. Bản ghi trùng id sẽ được cập nhật theo tệp." · "Không có gì mới để nhập. Dữ liệu trong tệp đã có sẵn." · "Buổi học: thêm {a}, cập nhật {b}" · "Mục: thêm {a}, cập nhật {b}" · "Thẻ ôn: thêm {a}, cập nhật {b}" · "Ngày học: cộng thêm cho {n} ngày" · "Bỏ qua {n} bản ghi không hợp lệ hoặc trùng." · checkbox "Nhập cả cài đặt" / "Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm." · "Huỷ" · "Nhập" · "Đang nhập…" |
| (T18b) Nhập JSON — toast | "Đã nhập {a} buổi, {b} mục, {c} thẻ." · hậu tố " Đã cập nhật cài đặt." |
| (T18c) Manifest | ~~name "Vở Tiếng Anh" · short_name "Vở TA" · description "Vở ôn tiếng Anh giao tiếp đi kèm lớp học thật." · apple-mobile-web-app-title "Vở TA"~~ → thay bởi (T20) |
| (T20) Tên app | `APP_NAME` "Vở Ngoại Ngữ" · tiêu đề tab "{Màn} · Vở Ngoại Ngữ" · manifest name/short_name "Vở Ngoại Ngữ" · description "Vở ôn ngoại ngữ giao tiếp đi kèm lớp học thật." · apple-mobile-web-app-title "Vở Ngoại Ngữ" · Đăng nhập phụ đề "Học lại ngoại ngữ giao tiếp, mỗi ngày một ít." · Shadowing "Hãy mở Vở Ngoại Ngữ bằng Chrome hoặc Edge để luyện shadowing." · tệp xuất `vo-ngoai-ngu-{YYYY-MM-DD}.json` · lỗi nhập "Tệp không đúng định dạng của Vở Ngoại Ngữ. Hãy chọn tệp đã xuất từ mục Cài đặt." |
| (T20) Tên ngôn ngữ | "Tiếng Anh" · "Tiếng Trung" · "Tiếng Nhật" · "Tiếng Hàn" · "Tất cả" · ngắn "Anh" · "Trung" · "Nhật" · "Hàn" |
| (T20) Chiều ôn theo ngôn ngữ | "{Ngắn} → Việt" · "Việt → {Ngắn}" · "Nghe → gõ" (vd "Trung → Việt", "Việt → Nhật") |
| (T20) Form buổi học | nhãn "Ngôn ngữ" · nhãn ô đích = tên ngôn ngữ · nhãn "Phiên âm" · placeholder đích `Can I have the bill, please?` / `你好` / `こんにちは` / `안녕하세요` · placeholder phiên âm `/kæn aɪ hæv ðə bɪl/` / `nǐ hǎo` / `konnichiwa` / `annyeonghaseyo` · lỗi "Nhập tiếng Anh." / "Nhập tiếng Trung." / "Nhập tiếng Nhật." / "Nhập tiếng Hàn." · "Chọn ngôn ngữ." · khoá "Buổi này đã có thẻ được ôn nên không đổi ngôn ngữ được." · mô tả "Mỗi mục sẽ thành một thẻ ôn {Ngắn} → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau." |
| (T20) Dán danh sách zh/ja/ko | mô tả "Câu, nghĩa tiếng Việt và phiên âm cách nhau bằng dấu gạch ngang, dấu \| hoặc tab. Phần thứ tư, nếu có, là ghi chú." · placeholder `你好 - Xin chào - nǐ hǎo` / `こんにちは - Xin chào - konnichiwa` / `안녕하세요 - Xin chào - annyeonghaseyo` |
| (T20) Cài đặt — Ngôn ngữ | H2 "Ngôn ngữ" · nhãn "Ngôn ngữ đang học" · mô tả "Lọc thẻ ôn, shadowing, kho mẫu câu và thống kê thẻ theo một ngôn ngữ. Nhật ký buổi học, chuỗi ngày và phút học luôn tính chung." · "Giọng đọc trên thiết bị này: Anh — có · Trung — có · Nhật — chưa có · Hàn — có" · "Trình duyệt này không có giọng đọc." · checkbox nhập "Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm, ngôn ngữ đang học." |
| (T20) Hôm nay | hậu tố " · {Tên ngôn ngữ}" · "Chưa có thẻ {tên ngôn ngữ} nào. Ghi buổi học hoặc thêm mẫu câu {tên ngôn ngữ}." · ghost "Học tất cả ngôn ngữ" |
| (T20) Ôn thẻ | "Không có thẻ {tên ngôn ngữ} nào đến hạn." · "Đã tạm ẩn {k} thẻ nghe vì thiết bị chưa có giọng đọc phù hợp." · gợi ý "Dấu câu và khoảng trắng không tính." |
| (T20) Thiếu giọng | "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn đọc được phiên âm." · Shadowing "Thiết bị chưa có giọng {tên ngôn ngữ}. Bạn vẫn có thể ghi âm và nghe lại." |
| (T20) Nhật ký / Trang buổi | nhãn hàng "{Tên ngôn ngữ}" · dateLine "Buổi {n} · {ngày} · {Tên ngôn ngữ}" |
| (T20) Mẫu câu | heading nhóm = tên ngôn ngữ · mô tả "Câu ngắn theo tình huống thật, bằng ngôn ngữ bạn đang học. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay." · tình huống "Chào hỏi & giới thiệu" · "Nhà hàng & gọi món" · "Mua sắm & hỏi giá" · "Hỏi đường & đi lại" |
| (T20) Tiến độ | "Thẻ ôn · {Tên ngôn ngữ}" · "Chuỗi ngày và phút học tính chung mọi ngôn ngữ." |
| (T20) Đồng bộ | "Supabase chưa có cột ngôn ngữ. Chạy lại supabase/schema.sql để lưu ngôn ngữ buổi học." |

Giọng văn: thân thiện, ngắn, không dấu chấm than dồn dập, không emoji, không "bạn ơi". Lỗi luôn nói việc cần làm tiếp theo.

## Phụ lục B. Lưu ý kỹ thuật đã xác minh (từ `node_modules`, 2026-11-09)

- `ts-fsrs@6.0.0`: `DefaultScheduler(options?) => Promise<Scheduler>`; `scheduler.newCard({ now, cardId? })`; `scheduler.review({ card, now, grade }) => { card, revlog }`; `scheduler.preview({ card, now })` iterable `{ grade, card, revlog }`; `Rating = { Manual:0, Again:1, Hard:2, Good:3, Easy:4 }`; `State = { New:0, Learning:1, Review:2, Relearning:3 }`. Card dùng `dueAt`/`lastReviewAt` (Date). Mọi API cũ (`fsrs`, `FSRS`, `createEmptyCard`, `generatorParameters`, `Card`, `ReviewLog`) đánh dấu `@deprecated`.
- `tsconfig.app.json`: `erasableSyntaxOnly: true` (cấm `enum`, `namespace`, parameter properties), `verbatimModuleSyntax: true` (dùng `import type`), `noUnusedLocals/Parameters: true`.
- React 19.3, react-router-dom 6.30 (dùng `createBrowserRouter`, `useBlocker` cần data router), lucide-react 1.70, @supabase/supabase-js 2.119, Vite 8, TypeScript 7, oxlint.
- Web Speech: `speechSynthesis.getVoices()` rỗng lúc đầu trên Chrome → nghe `voiceschanged`; iOS Safari yêu cầu `speak()` trong user gesture; `SpeechRecognition` (GĐ2) không ổn định trên Safari.
- Supabase: `user_id default auth.uid()` hoạt động vì client gửi JWT; rpc `add_study_time` chạy `security invoker` nên vẫn qua RLS.
