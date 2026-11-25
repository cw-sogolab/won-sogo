-- 成績ノート + 帰宅クイズ DB (Supabase). gen-schema.js 가 만든 파일 — 직접 고치지 말고 logic.js 의 TABLES 를 고친 뒤 다시 만듭니다.
-- SQL Editor 에 통째로 붙여 넣어 실행. 다시 실행해도 됩니다(if not exists).
-- 모든 표는 RLS 를 켜고 정책을 두지 않습니다 → 브라우저(anon 키)로는 아무것도 못 읽고, Edge Function(서버)만 service 권한으로 읽고 씁니다.
-- 열은 전부 text (구글 시트와 같게: 0 으로 시작하는 답안·번호가 숫자로 바뀌지 않게).

create table if not exists public."반" (
  id bigint generated always as identity primary key,
  "반코드" text not null default '',
  "반이름" text not null default '',
  "종류" text not null default '',
  "요일시간" text not null default '',
  "활성" text not null default ''
);
alter table public."반" enable row level security;

create table if not exists public."원생" (
  id bigint generated always as identity primary key,
  "일련번호" text not null default '',
  "이름" text not null default '',
  "상태" text not null default '',
  "발급일" text not null default '',
  "메모" text not null default ''
);
alter table public."원생" enable row level security;

create table if not exists public."수강" (
  id bigint generated always as identity primary key,
  "번호" text not null default '',
  "반코드" text not null default '',
  "수정일" text not null default ''
);
alter table public."수강" enable row level security;

create table if not exists public."시험" (
  id bigint generated always as identity primary key,
  "시험ID" text not null default '',
  "반코드" text not null default '',
  "월" text not null default '',
  "종류" text not null default '',
  "이름" text not null default '',
  "문항수" text not null default '',
  "정답" text not null default '',
  "시험일" text not null default '',
  "등록일" text not null default ''
);
alter table public."시험" enable row level security;

create table if not exists public."시험결과" (
  id bigint generated always as identity primary key,
  "시험ID" text not null default '',
  "번호" text not null default '',
  "답안" text not null default '',
  "맞은개수" text not null default '',
  "틀린번호" text not null default '',
  "환산점수" text not null default '',
  "입력일" text not null default '',
  "오답답안" text not null default ''
);
alter table public."시험결과" enable row level security;

create table if not exists public."숙제" (
  id bigint generated always as identity primary key,
  "숙제ID" text not null default '',
  "반코드" text not null default '',
  "월" text not null default '',
  "이름" text not null default '',
  "교재" text not null default '',
  "시작쪽" text not null default '',
  "끝쪽" text not null default '',
  "문항수" text not null default '',
  "등록일" text not null default '',
  "마감" text not null default ''
);
alter table public."숙제" enable row level security;

create table if not exists public."숙제제출" (
  id bigint generated always as identity primary key,
  "숙제ID" text not null default '',
  "번호" text not null default '',
  "맞은개수" text not null default '',
  "사진수" text not null default '',
  "확인" text not null default '',
  "대리입력" text not null default '',
  "최종제출일" text not null default '',
  "처음제출일" text not null default ''
);
alter table public."숙제제출" enable row level security;

create table if not exists public."숙제사진" (
  id bigint generated always as identity primary key,
  "숙제ID" text not null default '',
  "번호" text not null default '',
  "순서" text not null default '',
  "파일ID" text not null default '',
  "올린시각" text not null default '',
  "검사" text not null default '',
  "검사메모" text not null default '',
  "해시" text not null default ''
);
alter table public."숙제사진" enable row level security;

create table if not exists public."평가" (
  id bigint generated always as identity primary key,
  "월" text not null default '',
  "번호" text not null default '',
  "코멘트" text not null default '',
  "수정일" text not null default ''
);
alter table public."평가" enable row level security;

create table if not exists public."시험지" (
  id bigint generated always as identity primary key,
  "시험지ID" text not null default '',
  "반종류" text not null default '',
  "과목" text not null default '',
  "종류" text not null default '',
  "회차" text not null default '',
  "이름" text not null default '',
  "문항수" text not null default '',
  "정답" text not null default '',
  "출처" text not null default '',
  "문항과목" text not null default ''
);
alter table public."시험지" enable row level security;

create table if not exists public."달력" (
  id bigint generated always as identity primary key,
  "월" text not null default '',
  "개강" text not null default '',
  "종강" text not null default '',
  "휴강" text not null default '',
  "메모" text not null default ''
);
alter table public."달력" enable row level security;

create table if not exists public."계획서" (
  id bigint generated always as identity primary key,
  "월" text not null default '',
  "반종류" text not null default '',
  "과목" text not null default '',
  "반" text not null default '',
  "회차" text not null default '',
  "날짜" text not null default '',
  "내용" text not null default '',
  "범위" text not null default '',
  "과제" text not null default ''
);
alter table public."계획서" enable row level security;

create table if not exists public."계획서머리" (
  id bigint generated always as identity primary key,
  "월" text not null default '',
  "반종류" text not null default '',
  "과목" text not null default '',
  "반" text not null default '',
  "부제" text not null default '',
  "강의명" text not null default '',
  "강의목표" text not null default '',
  "담당강사" text not null default '',
  "연락처" text not null default '',
  "강의기간" text not null default '',
  "강의시간" text not null default '',
  "강의실" text not null default '',
  "교재" text not null default '',
  "질문시간" text not null default '',
  "질문방법" text not null default '',
  "평가방법" text not null default ''
);
alter table public."계획서머리" enable row level security;

create table if not exists public."접속기록" (
  id bigint generated always as identity primary key,
  "시각" text not null default '',
  "번호" text not null default '',
  "이름" text not null default '',
  "구분" text not null default '',
  "기기" text not null default ''
);
alter table public."접속기록" enable row level security;

-- 퇴실퀴즈 기록 (구글 폼 7칸 + 시각·번호·판)
create table if not exists public."퀴즈기록" (
  id bigint generated always as identity primary key,
  "시각" timestamptz not null default now(),
  "번호" text not null default '',
  "이름" text not null default '',
  "반" text not null default '',
  "범위" text not null default '',
  "첫시도정답" text not null default '',
  "걸린시간" text not null default '',
  "틀린문항" text not null default '',
  "시도횟수" text not null default '',
  "판" text not null default ''
);
alter table public."퀴즈기록" enable row level security;

-- 서버 캐시(로그인 열쇠·실패 횟수·계산 결과) · 서버 설정(관리자 비밀번호 등)
create table if not exists public.kv_cache (k text primary key, v text not null, exp timestamptz not null);
create table if not exists public.kv_props (k text primary key, v text not null);
alter table public.kv_cache enable row level security;
alter table public.kv_props enable row level security;

-- 숙제 사진 (Supabase Storage 비공개 버킷). 학생·강사에게는 서버가 읽어서 보내 줌.
insert into storage.buckets (id, name, public) values ('hw-photos', 'hw-photos', false) on conflict (id) do nothing;
