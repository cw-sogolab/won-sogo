-- 成績ノート QnA: 「질문」 표 (gen-schema.js 가 만든 파일 — 직접 고치지 말고 logic.js 의 TABLES 를 고친 뒤 다시 만듭니다).
-- 001_grades.sql 을 이미 실행한 DB 에 이어서 한 번 실행. 다시 실행해도 됩니다(if not exists). 서버(Edge Function)를 새로 배포하기 전에 먼저!
-- RLS 를 켜고 정책을 두지 않음 → 브라우저(anon 키)로는 못 읽고 Edge Function(서버)만 읽고 씁니다. 질문 사진은 001 에서 만든 비공개 버킷 hw-photos 의 QNA/ 폴더에 둠.

create table if not exists public."질문" (
  id bigint generated always as identity primary key,
  "질문ID" text not null default '',
  "번호" text not null default '',
  "과목" text not null default '',
  "제목" text not null default '',
  "내용" text not null default '',
  "공개" text not null default '',
  "작성일" text not null default '',
  "상태" text not null default '',
  "답변" text not null default '',
  "답변일" text not null default '',
  "사진" text not null default '',
  "답변사진" text not null default ''
);
alter table public."질문" enable row level security;

