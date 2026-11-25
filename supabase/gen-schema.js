// node supabase/gen-schema.js — logic.js 의 TABLES(시트 탭·열)로 Postgres 스키마를 만듭니다.
// 탭 이름·열 이름을 그대로 테이블·열 이름으로 씁니다(따옴표로 감쌈) → 화면·로직·테스트가 이름을 바꿀 필요가 없습니다.
const fs = require('fs'), path = require('path');
const Logic = require('../docs/dev/assets/logic.js');
const q = s => '"' + String(s).replace(/"/g, '""') + '"';
let sql = `-- 成績ノート + 帰宅クイズ DB (Supabase). gen-schema.js 가 만든 파일 — 직접 고치지 말고 logic.js 의 TABLES 를 고친 뒤 다시 만듭니다.
-- SQL Editor 에 통째로 붙여 넣어 실행. 다시 실행해도 됩니다(if not exists).
-- 모든 표는 RLS 를 켜고 정책을 두지 않습니다 → 브라우저(anon 키)로는 아무것도 못 읽고, Edge Function(서버)만 service 권한으로 읽고 씁니다.
-- 열은 전부 text (구글 시트와 같게: 0 으로 시작하는 답안·번호가 숫자로 바뀌지 않게).

`;
const emit = (name, cols) => {
  sql += `create table if not exists public.${q(name)} (\n  id bigint generated always as identity primary key,\n` +
    cols.map(c => `  ${q(c)} text not null default ''`).join(',\n') + `\n);\nalter table public.${q(name)} enable row level security;\n\n`;
};
// 나중에 늘린 표는 001 에 넣지 않고 따로 마이그레이션 파일로 (이미 서울에 실행한 001 은 그대로 둠). 표 이름 → 파일
const LATER = { '질문': '002_qna.sql' };
Object.keys(Logic.TABLES).forEach(t => { if (!LATER[t]) emit(t, Logic.TABLES[t]); });
emit('접속기록', Logic.ACCESS_HEAD);
sql += `-- 퇴실퀴즈 기록 (구글 폼 7칸 + 시각·번호·판)
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
`;
fs.mkdirSync(path.join(__dirname, 'migrations'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'migrations', '001_grades.sql'), sql);
console.log('migrations/001_grades.sql', sql.split('\n').length + '줄', Object.keys(Logic.TABLES).filter(t => !LATER[t]).length + 1, '표 + 퀴즈기록');
// 002 — 커리큘럼·QnA (2026-11-24): 「질문」 표만. 001 을 이미 실행한 DB 에 SQL Editor 로 한 번 실행 (다시 실행해도 됨)
sql = `-- 成績ノート QnA: 「질문」 표 (gen-schema.js 가 만든 파일 — 직접 고치지 말고 logic.js 의 TABLES 를 고친 뒤 다시 만듭니다).
-- 001_grades.sql 을 이미 실행한 DB 에 이어서 한 번 실행. 다시 실행해도 됩니다(if not exists). 서버(Edge Function)를 새로 배포하기 전에 먼저!
-- RLS 를 켜고 정책을 두지 않음 → 브라우저(anon 키)로는 못 읽고 Edge Function(서버)만 읽고 씁니다. 질문 사진은 001 에서 만든 비공개 버킷 hw-photos 의 QNA/ 폴더에 둠.

`;
Object.keys(LATER).forEach(t => emit(t, Logic.TABLES[t]));
fs.writeFileSync(path.join(__dirname, 'migrations', '002_qna.sql'), sql);
console.log('migrations/002_qna.sql', Object.keys(LATER).join(','));
