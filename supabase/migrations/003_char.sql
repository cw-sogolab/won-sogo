-- 成績ノート 몽글이 꾸미기: 「캐릭터」 표 (gen-schema.js 가 만든 파일 — 직접 고치지 말고 logic.js 의 TABLES 를 고친 뒤 다시 만듭니다).
-- 001·002 를 이미 실행한 DB 에 이어서 한 번 실행. 다시 실행해도 됩니다(if not exists). 서버(Edge Function)를 새로 배포하기 전에 먼저!
-- (서버는 요청마다 Logic.TABLES 의 표를 한 번에 읽어서, 이 표가 없으면 모든 요청이 실패합니다.)
-- 학생마다 한 줄(번호). 얻은 아이템은 저장하지 않고 기록으로 계산합니다. RLS 를 켜고 정책을 두지 않음 → Edge Function(서버)만 읽고 씁니다.

create table if not exists public."캐릭터" (
  id bigint generated always as identity primary key,
  "번호" text not null default '',
  "몸" text not null default '',
  "모자" text not null default '',
  "안경" text not null default '',
  "키링" text not null default '',
  "표시" text not null default '',
  "수정일" text not null default ''
);
alter table public."캐릭터" enable row level security;

