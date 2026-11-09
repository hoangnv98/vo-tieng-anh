# Vở Ngoại Ngữ

Web app cá nhân giúp người lớn mất gốc học lại ngoại ngữ giao tiếp (tiếng Anh, Trung, Nhật, Hàn): ghi lại từng buổi học thành một trang vở, ôn thẻ theo lịch FSRS, học mẫu câu theo tình huống, luyện shadowing và xem tiến độ.

Stack: Vite + React 19 + TypeScript, react-router-dom 6, lucide-react, ts-fsrs v6, Supabase (tuỳ chọn). Toàn bộ dịch vụ dùng gói miễn phí.

## Chạy cục bộ (không cần tài khoản)

Cần Node.js và npm.

```
npm install
npm run dev          # http://localhost:5173 — chế độ cục bộ (localStorage)
```

Các lệnh khác:

```
npm run build        # kiểm tra kiểu + build vào dist/
npm run lint         # oxlint
npm test             # vitest (hàm thuần: ngày giờ, chữ, FSRS, ôn tập, thống kê, mẫu câu, repo)
npm run preview      # chạy thử bản build
```

## Chế độ cục bộ và chế độ đồng bộ

App tự chọn chế độ theo biến môi trường lúc build:

| | Chế độ cục bộ | Chế độ đồng bộ (Supabase) |
|---|---|---|
| Khi nào | Không có `.env` hoặc thiếu một trong hai biến `VITE_SUPABASE_*` | Có đủ `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` |
| Đăng nhập | Không cần; vào thẳng `/` | Liên kết đăng nhập gửi qua email (magic link) |
| Dữ liệu nằm ở | `localStorage` của trình duyệt đang dùng | Postgres của Supabase, bảo vệ bằng Row Level Security |
| Nhiều thiết bị | Không đồng bộ | Đồng bộ; thiết bị khác thấy dữ liệu mới sau khi tải lại |
| Thanh trên | Chip "Cục bộ" | Chip "Ngoại tuyến" / "Chưa đồng bộ · n" khi có ghi chưa gửi được |

Lưu ý:
- Ở chế độ cục bộ, xoá dữ liệu trình duyệt là mất dữ liệu. Dùng **Cài đặt > Xuất dữ liệu (JSON)** để giữ một bản sao. Cài đặt cũng có nút xoá toàn bộ dữ liệu trên thiết bị (phải gõ `XOA` để xác nhận).
- Ở chế độ cục bộ, gói `@supabase/supabase-js` không được tải (nạp động chỉ khi có cấu hình Supabase).
- Ở chế độ đồng bộ, thao tác ghi bị lỗi mạng được giữ trong hàng đợi trên trình duyệt (`localStorage`) và gửi lại khi có mạng.

## Bật đồng bộ với Supabase (miễn phí)

1. Tạo project tại supabase.com (region Singapore gần Việt Nam nhất).
2. SQL Editor: dán toàn bộ `supabase/schema.sql` rồi Run. Kiểm tra: `select tablename, rowsecurity from pg_tables where schemaname='public'` phải trả về `true` cho mọi bảng.
3. Authentication > Providers > Email: bật (liên kết đăng nhập tự xác nhận email). Authentication > URL Configuration:
   - Site URL = URL production (vd `https://tienganh-giaotiep.vercel.app`).
   - Additional Redirect URLs: `http://localhost:5173/login`, `https://tienganh-giaotiep.vercel.app/login`.
4. **Giới hạn email**: dịch vụ email mặc định của Supabase giới hạn rất thấp (khoảng **2 email/giờ** cho cả project) và chỉ dành cho thử nghiệm. Dùng cho một mình bạn thì tạm ổn; **trước khi mời người khác dùng**, cấu hình Custom SMTP miễn phí (Authentication > SMTP Settings) bằng Resend (3.000 email/tháng) hoặc Brevo (300 email/ngày). Nếu chưa đổi, người dùng có thể không nhận được liên kết đăng nhập khi đã vượt giới hạn.
5. Project Settings > API: sao chép `Project URL` và khoá `anon public`, tạo `.env` từ `.env.example`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
   Khoá `anon` được phép nằm trong bundle client. **Không bao giờ** đặt `service_role` key vào `.env` hay vào repo. `.env` đã có trong `.gitignore`.
6. `npm run dev`, mở `/login` sẽ thấy form email.

## Deploy lên Vercel (miễn phí)

1. Đẩy repo lên GitHub (không commit `.env`).
2. Vercel > Add New Project > import repo; Framework: Vite; Build `npm run build`; Output `dist`.
3. Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production + Preview). Bỏ trống nếu muốn bản deploy chạy chế độ cục bộ.
   - Nếu thêm Supabase qua **Vercel Marketplace (Optional Integrations)**: tích hợp tự tạo project và nạp biến tên `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`…; `vite.config.ts` tự ánh xạ chúng sang `VITE_SUPABASE_*` nên không cần thêm tay. Biến được nạp *sau* lần deploy đầu thì phải **Redeploy** mới có hiệu lực. Tích hợp cũng nạp `SUPABASE_SERVICE_ROLE_KEY` vào Vercel: không sao vì Vite không đưa biến thiếu tiền tố `VITE_` vào bundle, nhưng **tuyệt đối không** tự tạo biến `VITE_*` từ khoá này. Vẫn phải tự chạy `supabase/schema.sql` và cấu hình Redirect URLs (bước 5).
4. `vercel.json` đã có rewrite SPA về `/index.html`, nên tải lại ở mọi đường dẫn (vd `/lessons/...`) không bị 404.
5. Deploy, rồi thêm domain Vercel (Site URL và `<domain>/login`) vào Supabase Redirect URLs ở bước 3 phần trên.

Netlify thay thế: tạo `public/_redirects` với nội dung `/* /index.html 200`.

## Ngôn ngữ học

- Bốn ngôn ngữ: tiếng Anh, tiếng Trung (giản thể, pinyin), tiếng Nhật (romaji Hepburn), tiếng Hàn (Revised Romanization). Giao diện luôn tiếng Việt.
- Mỗi buổi học thuộc **một** ngôn ngữ, chọn ở đầu form "Ghi buổi học". Khi buổi đã có thẻ được ôn thì không đổi ngôn ngữ được nữa.
- Cài đặt → "Ngôn ngữ đang học" lọc thẻ ôn, shadowing, kho mẫu câu và thống kê thẻ theo một ngôn ngữ (mặc định "Tất cả"). Nhật ký buổi học, chuỗi ngày và phút học luôn tính chung.
- Giọng đọc tiếng Trung/Nhật/Hàn dùng giọng có sẵn trên thiết bị (Web Speech). Thiết bị chưa có giọng thì nút loa ẩn và app báo "Thiết bị chưa có giọng …"; Cài đặt → "Ngôn ngữ" cho biết ngôn ngữ nào đã có giọng. Cài thêm giọng:
  - **macOS**: Cài đặt hệ thống → Trợ năng → Nội dung được đọc → Giọng hệ thống → Quản lý giọng → chọn giọng Trung (Trung Quốc đại lục), Nhật, Hàn.
  - **iOS**: Cài đặt → Trợ năng → Nội dung được đọc → Giọng → chọn ngôn ngữ và tải giọng.
  - **Windows**: Settings → Time & language → Language & region → Add a language → chọn 中文(中华人民共和国) / 日本語 / 한국어, đánh dấu "Text-to-speech" (gói giọng nói) rồi cài; khởi động lại Chrome/Edge.
  - **Android**: Cài đặt → Hệ thống → Ngôn ngữ và phương thức nhập → Chuyển văn bản sang giọng nói → Công cụ ưu tiên (Google) → Cài đặt dữ liệu giọng nói → tải gói ngôn ngữ.

## Cài lên màn hình chính

- **iOS Safari**: nút Chia sẻ → Thêm vào MH chính.
- **Android Chrome**: menu ⋮ → Cài ứng dụng (hoặc Thêm vào màn hình chính).
- **Desktop Chrome/Edge**: biểu tượng cài đặt ở thanh địa chỉ.

App mở như ứng dụng riêng (không thanh địa chỉ) với biểu tượng vở. **Chưa hoạt động offline**: chưa có service worker (để giai đoạn 3), cần mạng để mở app. `manifest.webmanifest` và `icons/` là tệp tĩnh trong `public/`, được `vercel.json` phục vụ nguyên trạng (rewrite SPA chỉ áp cho đường dẫn không phải tệp có thật).

Tạo lại icon: xem lệnh trong `public/icons/PROVENANCE.md` (nguồn `public/icon-source.svg`, dùng `qlmanage` trên macOS, không cần package).

## Cập nhật schema

Sửa `supabase/schema.sql` theo kiểu idempotent (`create table if not exists`, `add column if not exists`, …) rồi dán và chạy lại toàn bộ file trong SQL Editor. Không dùng migration tool ở giai đoạn này. Sau khi chạy, kiểm tra lại RLS bằng câu truy vấn ở bước 2. Sau T20 phải chạy lại file để có cột `language`/`study_language`.

## Giọng đọc tiếng Việt bằng server local (VieNeu-TTS)

Mặc định app đọc tiếng Anh bằng giọng có sẵn của trình duyệt (Chrome/Edge tốt nhất). Nếu muốn nghe **nghĩa tiếng Việt, lưu ý phát âm, lỗi hay gặp** bằng giọng Việt tự nhiên, bạn có thể chạy [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) (Apache-2.0, chạy CPU, không cần GPU) trên máy tính rồi trỏ app vào đó.

1. Cài và chạy server (macOS/Linux, cần [uv](https://docs.astral.sh/uv/)):

   ```bash
   git clone https://github.com/pnnbao97/VieNeu-TTS.git && cd VieNeu-TTS
   uv sync
   uv run python -m apps.openai_speech   # server OpenAI-compatible tại http://localhost:8000
   ```

2. Trong app: **Cài đặt → Giọng đọc → Tiếng Việt → bật "Đọc tiếng Việt bằng server local"**, dán `http://localhost:8000`, bấm **Kiểm tra kết nối** rồi chọn giọng.

3. Cấu hình này lưu trên **từng thiết bị** (không đồng bộ qua Supabase). Khi server tắt, app tự ẩn nút đọc tiếng Việt; tiếng Anh vẫn dùng giọng trình duyệt.

**Dùng trên điện thoại.** Bản app chạy trên Vercel là https nên trình duyệt chặn gọi tới `http://192.168.x.x` (mixed content). Có hai cách miễn phí:

- **Tailscale**: cài trên laptop và điện thoại, rồi `tailscale serve --bg 8000` → nhận URL `https://<máy>.<tailnet>.ts.net`, dán vào ô Địa chỉ server.
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:8000` → nhận URL `https://….trycloudflare.com` tạm thời.

Nếu server chạy trên máy khác trong cùng Wi-Fi và app mở qua `npm run dev --host` (http), hãy khởi động server với `--host 0.0.0.0` và cho phép CORS từ origin của app.

**Tiếng Anh bằng server (tuỳ chọn).** Nếu muốn giọng Anh đẹp hơn giọng trình duyệt, bật "Dùng server local cho tiếng Anh" và trỏ vào một server OpenAI-compatible chuyên tiếng Anh như Kokoro. Không nên dùng VieNeu cho tiếng Anh: model tối ưu cho tiếng Việt, phát âm Anh có thể không chuẩn.

**Riêng tư.** App chỉ gửi đúng câu đang học tới server bạn tự cấu hình; không gửi API key hay dữ liệu khác. Với server ngoài mạng nội bộ (URL https public), app hiện cảnh báo thông tin.

## Quyền riêng tư

- **Ghi âm (Shadowing)**: bản ghi chỉ nằm trong bộ nhớ của tab trình duyệt (Blob + ObjectURL), tối đa 15 giây một lần. Không tải lên máy chủ, không lưu vào `localStorage` hay IndexedDB; rời màn Shadowing là bản ghi bị huỷ. Trình duyệt sẽ hỏi quyền micro ở lần ghi đầu tiên; ghi âm cần trang chạy qua HTTPS (hoặc `localhost`).
- **Phát âm mẫu**: dùng giọng đọc có sẵn của trình duyệt/hệ điều hành (Web Speech API). Chất lượng và danh sách giọng phụ thuộc thiết bị.
- **Dữ liệu học**: ở chế độ đồng bộ, mỗi bảng có Row Level Security; mỗi tài khoản chỉ đọc/ghi được dữ liệu của chính mình. Không có analytics bên thứ ba.
- **Xuất dữ liệu**: Cài đặt > Xuất dữ liệu (JSON) tải toàn bộ dữ liệu của bạn về máy.

## Tài liệu

- Sản phẩm: `PRODUCT.md`; đặc tả: `SPEC.md`; thiết kế: `.impeccable/surfaces/*.md`.
- Checklist kiểm thử thủ công trước mỗi lần deploy: `SPEC.md` mục 10.
