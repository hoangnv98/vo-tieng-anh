-- =============================================================================
-- Vở Tiếng Anh — Supabase / Postgres schema (MVP, giai đoạn 1)
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor (1 lần).
-- Idempotent: chạy lại không lỗi (dùng IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Nguyên tắc:
--   * Mọi bảng đều có user_id và RLS: người dùng chỉ thấy/sửa hàng của chính mình.
--   * user_id mặc định = auth.uid() để client không cần (và không thể) gửi user_id khác.
--   * Trạng thái FSRS lưu nguyên vẹn trong cột jsonb `fsrs`; các cột `due`, `state`,
--     `reps`, `lapses` được client sao chép ra để lọc/sắp xếp nhanh.
--   * Không lưu bản ghi âm, không lưu Gemini API key.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Hàm tiện ích: tự cập nhật updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. settings — 1 hàng / người dùng
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name     text not null default '',
  daily_goal_min   integer not null default 15 check (daily_goal_min between 5 and 120),
  new_cards_per_day integer not null default 15 check (new_cards_per_day between 5 and 30),
  voice_name       text,                       -- tên giọng speechSynthesis đã chọn (có thể không tồn tại trên thiết bị khác)
  auto_speak       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- Tự tạo hàng settings khi có người dùng mới đăng ký.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. lessons — mỗi buổi học là 1 trang vở
-- -----------------------------------------------------------------------------
create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number       integer not null check (number >= 1),
  date         date not null,                   -- ngày học theo lịch địa phương (YYYY-MM-DD)
  topic        text not null check (char_length(topic) between 1 and 80),
  notes        text not null default '' check (char_length(notes) <= 2000),
  questions    text not null default '' check (char_length(questions) <= 1000),   -- câu hỏi cho giáo viên
  mistakes     text not null default '' check (char_length(mistakes) <= 500),     -- "Lỗi hay gặp"
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
  -- (bỏ unique (user_id, number): số buổi do người dùng đặt, UI đã kiểm trùng; 2 thiết bị offline có thể trùng số và op sẽ kẹt hàng đợi)
);

create index if not exists lessons_user_date_idx on public.lessons (user_id, date desc, number desc);

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. items — từ / cụm / mẫu câu (nguồn sinh thẻ)
-- -----------------------------------------------------------------------------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id    uuid references public.lessons(id) on delete cascade,  -- null nếu thêm từ thư viện mẫu câu
  kind         text not null check (kind in ('word', 'phrase', 'pattern')),
  en           text not null check (char_length(en) between 1 and 200),
  vi           text not null check (char_length(vi) between 1 and 200),
  ipa          text not null default '' check (char_length(ipa) <= 120),
  note         text not null default '' check (char_length(note) <= 200),
  pattern_id   text,                            -- id mẫu câu seed (vd. 'ordering-03') nếu thêm từ thư viện
  position     integer not null default 0,     -- thứ tự trong buổi học
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists items_user_lesson_idx on public.items (user_id, lesson_id, position);
-- Mỗi mẫu câu seed chỉ được thêm 1 lần / người dùng.
create unique index if not exists items_user_pattern_unique
  on public.items (user_id, pattern_id) where pattern_id is not null;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. cards — thẻ ôn (1 item có tối đa 3 thẻ theo 3 chiều)
-- -----------------------------------------------------------------------------
create table if not exists public.cards (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id            uuid not null references public.items(id) on delete cascade,
  direction          text not null check (direction in ('en_vi', 'vi_en', 'listen')),
  due                timestamptz not null default now(),   -- = fsrs.dueAt
  state              smallint not null default 0 check (state between 0 and 3), -- 0 New,1 Learning,2 Review,3 Relearning
  reps               integer not null default 0,
  lapses             integer not null default 0,
  first_reviewed_at  timestamptz,                          -- lần chấm đầu tiên; dùng đếm "thẻ mới hôm nay"
  suspended          boolean not null default false,       -- dự phòng; MVP không có UI
  fsrs               jsonb not null,                       -- toàn bộ card object từ ts-fsrs (Date -> chuỗi ISO)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cards_item_direction_unique unique (item_id, direction)
);

create index if not exists cards_user_due_idx on public.cards (user_id, due);
create index if not exists cards_user_state_idx on public.cards (user_id, state);

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. review_logs — lịch sử chấm (chỉ ghi, MVP không đọc lại)
-- -----------------------------------------------------------------------------
create table if not exists public.review_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id      uuid not null references public.cards(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 4),  -- 1 Again, 2 Hard, 3 Good, 4 Easy
  reviewed_at  timestamptz not null default now(),
  duration_ms  integer not null default 0 check (duration_ms >= 0),
  revlog       jsonb not null,                   -- result.revlog từ ts-fsrs
  created_at   timestamptz not null default now()
);

create index if not exists review_logs_user_time_idx on public.review_logs (user_id, reviewed_at desc);
create index if not exists review_logs_card_idx on public.review_logs (card_id);

-- -----------------------------------------------------------------------------
-- 6. study_days — tổng hợp theo ngày địa phương (Asia/Ho_Chi_Minh)
-- -----------------------------------------------------------------------------
create table if not exists public.study_days (
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day              date not null,               -- YYYY-MM-DD theo Asia/Ho_Chi_Minh, tính ở client
  seconds          integer not null default 0 check (seconds >= 0),
  reviews          integer not null default 0 check (reviews >= 0),
  shadowing_count  integer not null default 0 check (shadowing_count >= 0),
  updated_at       timestamptz not null default now(),
  primary key (user_id, day)
);

drop trigger if exists study_days_set_updated_at on public.study_days;
create trigger study_days_set_updated_at
  before update on public.study_days
  for each row execute function public.set_updated_at();

-- Cộng dồn an toàn (tránh race giữa 2 thiết bị): client gọi rpc thay vì upsert giá trị tuyệt đối.
create or replace function public.add_study_time(
  p_day date,
  p_seconds integer default 0,
  p_reviews integer default 0,
  p_shadowing integer default 0
)
returns public.study_days
language plpgsql
security invoker
as $$
declare
  result public.study_days;
begin
  insert into public.study_days (user_id, day, seconds, reviews, shadowing_count)
  values (auth.uid(), p_day, greatest(p_seconds, 0), greatest(p_reviews, 0), greatest(p_shadowing, 0))
  on conflict (user_id, day) do update
    set seconds         = public.study_days.seconds + greatest(excluded.seconds, 0),
        reviews         = public.study_days.reviews + greatest(excluded.reviews, 0),
        shadowing_count = public.study_days.shadowing_count + greatest(excluded.shadowing_count, 0)
  returning * into result;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.lessons      enable row level security;
alter table public.items        enable row level security;
alter table public.cards        enable row level security;
alter table public.review_logs  enable row level security;
alter table public.study_days   enable row level security;

-- settings
drop policy if exists "settings: own rows" on public.settings;
create policy "settings: own rows" on public.settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- lessons
drop policy if exists "lessons: own rows" on public.lessons;
create policy "lessons: own rows" on public.lessons
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- items
drop policy if exists "items: own rows" on public.items;
create policy "items: own rows" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- cards
drop policy if exists "cards: own rows" on public.cards;
create policy "cards: own rows" on public.cards
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- review_logs
drop policy if exists "review_logs: own rows" on public.review_logs;
create policy "review_logs: own rows" on public.review_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- study_days
drop policy if exists "study_days: own rows" on public.study_days;
create policy "study_days: own rows" on public.study_days
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 8. Quyền truy cập (Supabase thường đã cấp mặc định; ghi rõ cho chắc)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.settings, public.lessons, public.items, public.cards, public.review_logs, public.study_days
  to authenticated;
grant execute on function public.add_study_time(date, integer, integer, integer) to authenticated;
-- anon KHÔNG có quyền trên bảng dữ liệu (chỉ dùng để gọi Auth).
revoke all on
  public.settings, public.lessons, public.items, public.cards, public.review_logs, public.study_days
  from anon;

-- =============================================================================
-- Hết. Kiểm tra nhanh sau khi chạy:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
--   -> tất cả rowsecurity = true
-- =============================================================================
