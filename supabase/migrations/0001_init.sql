-- 모꾸 교정운동 — 초기 스키마 (docs/SPEC.md 4.3 그대로)
-- 적용: supabase db push  또는  psql < 이 파일

-- 운동 마스터 (src/data/exercises.ts를 시드로 적재)
create table exercises (
  id            text primary key,
  name_ko       text not null,
  name_en       text not null,
  phase         text not null check (phase in ('release','mobility','activation','strength','integration')),
  targets       jsonb not null default '{}',      -- {"rounded_shoulder":1.0, ...}
  primary_muscles   text[] not null,
  secondary_muscles text[] default '{}',
  intensity     smallint not null check (intensity between 1 and 5),
  equipment     text[] not null,
  prescription  jsonb not null,                   -- {sets,reps,holdSec,tempoSec,restSec,perSide}
  cues          text[] not null default '{}',
  contraindications text[] default '{}',
  progression_id text references exercises(id),
  media_ref     text,
  is_active     boolean not null default true,
  reviewed_by   text,                             -- 전문가 검수자
  reviewed_at   timestamptz
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text,
  level       smallint not null default 2 check (level between 1 and 3),
  equipment   text[] not null default '{}',
  avoid_tags  text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- 생성된 계획 (입력값 + 스냅샷)
create table plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  start_date     date not null,
  end_date       date not null,
  days_per_week  smallint not null check (days_per_week between 2 and 5),
  session_minutes smallint not null default 40,
  concerns       text[] not null,                 -- 순서 = 우선순위
  level          smallint not null,
  equipment      text[] not null,
  avoid_tags     text[] not null default '{}',
  seed           integer not null,
  status         text not null default 'active' check (status in ('active','completed','abandoned')),
  created_at     timestamptz not null default now()
);

-- 일자별 세션 (엔진 출력을 그대로 저장 — 재생성해도 과거 기록이 바뀌지 않게)
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  date          date not null,
  session_index smallint not null,
  week          smallint not null check (week in (1,2)),
  focus         text not null check (focus in ('upper','lower','full')),
  blocks        jsonb not null,                   -- Block[] 스냅샷
  total_sec     integer not null,
  status        text not null default 'planned' check (status in ('planned','in_progress','done','skipped')),
  completed_at  timestamptz,
  elapsed_sec   integer,                          -- 실제 소요 시간(완료 시 기록)
  unique (plan_id, date)
);

-- 운동 단위 수행 기록
create table session_logs (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  exercise_id    text not null references exercises(id),
  completed_sets smallint not null default 0,
  rpe            smallint check (rpe between 1 and 10),   -- 자각 강도
  pain_flag      boolean not null default false,          -- 통증 신고
  note           text,
  logged_at      timestamptz not null default now()
);

-- 조회 최적화
create index sessions_plan_date_idx on sessions (plan_id, date);
create index plans_user_status_idx on plans (user_id, status);
create index session_logs_session_idx on session_logs (session_id);

/* ─────────────────────────── RLS (SPEC 4.3 필수) ─────────────────────────── */

alter table exercises enable row level security;
alter table profiles enable row level security;
alter table plans enable row level security;
alter table sessions enable row level security;
alter table session_logs enable row level security;

-- exercises: 전체 읽기 허용 + 쓰기 금지 (쓰기 정책을 만들지 않음 → service_role만 적재 가능)
create policy exercises_read on exercises
  for select using (true);

-- profiles: 본인 것만
create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- plans: 본인 것만
create policy plans_select on plans for select using (user_id = auth.uid());
create policy plans_insert on plans for insert with check (user_id = auth.uid());
create policy plans_update on plans for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 데이터 초기화(/api/reset)용. sessions/session_logs는 ON DELETE CASCADE로 함께 삭제된다.
create policy plans_delete on plans for delete using (user_id = auth.uid());

-- sessions: 소유 계획을 통해 접근
create policy sessions_select on sessions for select
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy sessions_insert on sessions for insert
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy sessions_update on sessions for update
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));

-- session_logs: 소유 세션을 통해 접근
create policy session_logs_select on session_logs for select
  using (exists (
    select 1 from sessions s join plans p on p.id = s.plan_id
    where s.id = session_id and p.user_id = auth.uid()
  ));
create policy session_logs_insert on session_logs for insert
  with check (exists (
    select 1 from sessions s join plans p on p.id = s.plan_id
    where s.id = session_id and p.user_id = auth.uid()
  ));
