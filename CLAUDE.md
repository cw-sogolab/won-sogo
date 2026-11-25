# CLAUDE.md — won-sogo (성적노트 + 퇴근 미션 통합 사이트)

> ⚠ **공개 저장소**(GitHub Pages). 학생 이름·번호·성적·정답·토큰·비밀번호·키를 넣지 않는다. 이 문서도 공개된다.
> 2026-11-26 만듦 — `seiseki`(성적노트)·`kitaku`(퇴근 미션)를 하나로 통합. 작업 기록은 `MERGE.md`, 기획은 `PLAN_V2.md`.

## 구조
- `docs/` = GitHub Pages. **본판** `docs/`(아직 「준비 중」 안내만), **개발판** `docs/dev/`.
  - `docs/dev/index.html` 허브(로그인 1회 + 탭), `hub-session.js`, 탭 모듈 `home/` `grades-native/` `qz/`(퇴근 미션) `curriculum/` `qna/` `grades-admin/`, 캐릭터 `assets/mascots.js`.
  - `docs/dev/v2/` 디자인 시안(최종 `sian-final.html`), `3D_RENDER_SPEC.md`(캐릭터·아이템 렌더 규격).
  - `docs/assets/config.js` 서버 주소(본판·개발판).
- `supabase/` 서버(서울 Edge Function `api`, 스키마, 테스트). `photo-store/` 사진을 선생님 구글 드라이브에 저장하는 Apps Script.
- `tests/logic.test.js` 규칙 테스트.

## 규칙
- 개발판 먼저 → 선생님 확인 → 본판. 한꺼번에 올리지 않는다.
- 학생들이 지금 쓰는 것은 **seiseki 본판**뿐(2026-11-26 기준). 본판 전환 전까지 seiseki 본판은 건드리지 않는다.
- 테스트: `node tests/logic.test.js` · `node supabase/test/pg.test.mjs` · `node supabase/test/quiz.test.mjs` · `node supabase/test/photostore.test.mjs` (`supabase/test` 에서 `npm i` 필요).
- 서버 코드(`docs/dev/assets/logic.js`·`core.js`)를 고치면 `sh supabase/sync-engine.sh` 후 테스트, 선생님이 `npx supabase functions deploy api --project-ref kzgjmpckgqfabyiphskg --no-verify-jwt`.
