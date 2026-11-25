# 성적노트 + 퇴실퀴즈 합치기 (hub) — 2026-11-22 시작

> 작업 폴더. `seiseki`를 복사해 만들었고 **원격 저장소 연결을 끊어 둠**(실수로 푸시되지 않게). 원본 `seiseki/`·`kitaku-quiz/`와 본판은 건드리지 않았다.
> 스토어(`store/`)는 보류(2026-11-22 사용자).

## 구조 (개발판부터)
```
docs/dev/            성적노트 개발판 (index.html + assets/)
docs/dev/quiz/       퇴실퀴즈 개발판 (kitaku-quiz/dev 복사) — 개발판 판정을 /dev/quiz/ 도 되게 고침
docs/ (본판)          아직 그대로 = 옛 성적노트 본판. 퀴즈 본판은 아직 안 옮김
supabase/            Postgres 스키마 + Edge Function (구글 시트·Apps Script 대체)
```
- 두 화면은 같은 사이트(주소 한 곳) 안에 있고, 상단 버튼(성적노트 ↔ 퇴실 퀴즈)이 번호를 `#sid=`로 따라 보낸다(서버로 안 감, 받는 쪽이 읽자마자 지움). 「기억하기」는 켜지 않음.
- 옛 QR·즐겨찾기(`cw-sogolab.github.io/kitaku/…`)는 본판을 옮길 때 새 주소로 넘기는 안내 페이지로 남긴다.

## Supabase (구글 시트 대기시간 제거)
- 성적노트 규칙(`logic.js`)은 **그대로** 쓰고 저장소만 Postgres로 바꿨다 — `supabase/functions/api/pgstore.js`. 화면이 부르는 `{action, payload}` 모양도 같아서 `config.js`의 `API_URL`만 새 주소로 바꾸면 된다.
- 표 이름·열 이름은 시트 탭·열과 같다(`gen-schema.js`가 `Logic.TABLES`로 생성). 시트 → 표 옮기기는 탭마다 CSV로 내려받아 넣는다.
- 쓰기 요청은 `pg_advisory_xact_lock`으로 한 번에 하나(= Apps Script LockService). 캐시는 `kv_cache` 표, 설정(관리자 비밀번호 등)은 `kv_props` 표.
- 사진은 비공개 Storage 버킷 `hw-photos` (경로 `반/월/숙제/번호_숙제ID_순서.jpg`). 3개월 지난 사진 정리·백업 트리거는 아직 안 옮김.
- 테스트: `node tests/logic.test.js`(54개) · `node supabase/test/pg.test.mjs` — 같은 요청 순서를 메모리 저장소와 로컬 Postgres(PGlite)에 보내 응답·최종 표가 같은지 비교. 둘 다 통과.
- `logic.js`·`core.js`를 고치면: `sh supabase/sync-engine.sh` → 두 테스트. 열을 바꾸면 `node supabase/gen-schema.js` 후 마이그레이션 추가.

## 현재 상태 (2026-11-24)
- **서버: Supabase 서울(ap-northeast-2) `kzgjmpckgqfabyiphskg`** — 개발 기록장·퀴즈 응답 데이터를 옮겨 넣음(원생 203·시험결과 2,022·숙제제출 919·퀴즈기록 2,071…). 로그인 약 0.25초(호주 리전일 때 3~5초). 옛 호주 프로젝트(`dnasuvhtmkrutdkkuxem`)는 확인 뒤 Pause/삭제.
- 성적노트 개발판(`docs/dev/`)과 퀴즈 개발판(`docs/dev/quiz/`)이 이 서버를 씀. `docs/assets/config.js` 의 `API_URL.dev`, 퀴즈 `CONFIG.statsUrl`. **본판은 아직 옛 Apps Script·구글 폼 그대로.**
- 서버 한 주소에 성적노트(POST `{action,payload}`)와 퀴즈(GET `?mode=who|rank|stats`, POST `quizLog`)가 같이 있음. 퀴즈 코드 `functions/api/quiz.js`.
- 설정값은 `kv_props` 표: `ADMIN_PASSWORD`·`SHOW_KEY`·`QUIZ_KEY`(퀴즈 학생 분석)·`RANK_EXCLUDE`(랭킹에서 뺄 이름)·`CRON_KEY`(정기 작업, 아직 안 넣음).
- 정기 작업(`.github/workflows/cron.yml`): 매일 서버 깨우기(무료 플랜 정지 방지) + 3개월 지난 사진 정리. 저장소를 만든 뒤 Secrets(`SUPABASE_FN_URL`, `CRON_KEY`)를 넣어야 돎.
- 백업: `sh supabase/backup.sh <ref>` (읽기 전용, 15개 표를 JSON으로 iCloud `_보관/_백업/supabase/날짜/`). 무료 플랜은 자동 백업이 없으니 주기적으로 돌릴 것.
- 사진은 비공개 버킷 `hw-photos`에 `번호/번호_숙제ID_순서.jpg`(영문·숫자만)로 저장.

## 하나로 합치기 진행 (2026-11-24, 사용자 결정: 성적노트·퇴실퀴즈를 한 사이트로 통합하고 옛 사이트는 내림)
- 허브 `docs/dev/index.html`: 로그인 1회 + 탭(내 성적 | 퇴실 퀴즈). **둘 다 iframe 없이 같은 페이지 안에서 직접 그림.**
  - 퀴즈: `docs/dev/qz/` (`quiz.js`·`quiz.css`(전부 `.qz` 아래 · 성적노트 토큰)·`data.js`) — 원본 `docs/dev/quiz/`(옛 단독 페이지)는 마지막에 지움.
  - 성적 학생 화면: `docs/dev/grades-native/` (`gr.js`·`gr.css`, `HubGrades.mount(root,{code,name,apiUrl,env,onAuthError})`).
  - 캐릭터: `docs/dev/assets/mascots.js`(22종·표정 변형, `HubMascots.mount()`/`svg(id,size,cls)`) + 미리보기 `mascots-preview.html`. 퀴즈 입장·연습 설정·내 기록·랭킹·정답/오답·퇴실증·연습 결과에 적용.
- 아직 iframe: 성적노트 **강사** 화면(`grades.html?embed=1#teacher`). 강사 화면 이전은 마지막 단계.
- 퀴즈 개발판은 「점검 공지·사이트 닫힘」(`CLOSED`)을 끄고 열어 둠. 본판은 12월 재오픈 때까지 닫힘 유지.
- 본판 전환(실제 학생 데이터 이전, 옛 두 주소는 새 주소로 넘기는 안내 페이지로 교체)은 아직 안 함 — 사용자 확인 후.

## 홈 + 탭 구조 (2026-11-24, 사용자 결정: 메인 홈에서 탭으로 구분, 커리큘럼·QnA 탭 추가)
- 허브 `docs/dev/index.html`: 탭 = 홈 | 성적 | 퀴즈 | 커리큘럼 | QnA (PC는 위쪽 탭, 휴대폰은 아래 탭바). 강사(`#teacher`)는 성적노트 강사 | 퀴즈 강사 | QnA 관리(관리자 비밀번호 로그인 후).
- 공통 세션 `docs/dev/hub-session.js` (`HubSession.call/adminCall/view`) — 각 탭 모듈이 이걸로 서버 호출.
- 홈: `docs/dev/home/` (인사 + 바로가기 4개 + 숙제·최근 테스트 요약, 서버 login 응답 그대로 표시).
- 커리큘럼: 전체 과정 로드맵 + 내 반 월별 수업계획서(둘 다) — `docs/dev/curriculum/` (세션 hub-curriculum). 서버 `curriculum` 액션.
- QnA: 질문마다 공개/비공개 선택, 사진 첨부 가능, 선생님이 답한 공개 질문은 모두가 봄(이름 가림) — `docs/dev/qna/` (세션 hub-qna), 서버 `qna*` 액션·`질문` 표 (세션 hub-server-qna). 서버는 서울에 재배포 + `002_qna.sql` 실행 전에는 동작하지 않음.

## 강사 화면 합치기 (2026-11-24, 사용자 결정)
- 허브 강사 모드 `docs/dev/index.html#teacher`: **관리자 비밀번호 한 번**(서울 서버 `adminLogin`) → 탭 성적 | 퀴즈 | QnA 관리. 토큰이 풀리면 로그인 화면으로 돌아옴(`onAuthError`).
- 성적 강사: 새 네이티브 모듈 `docs/dev/grades-admin/ga.js`(`HubGradesAdmin.mount`, 세션 hub-grades-admin)가 있으면 그것, 없으면 옛 화면(`grades.html?embed=1#teacher`)을 틀로 끼워 씀.
- 퀴즈 강사: 허브 관리자 로그인이면 PIN 건너뛰기 + 학생 분석을 관리자 토큰으로(`quizStats` 서버 액션, 세션 hub-quiz-admin).
- QnA 관리: `HubQnaAdmin` (`docs/dev/qna/`).

## 사진은 선생님 구글 드라이브에 (2026-11-25, 사용자 결정: QnA·숙제 모두)
- Supabase 무료 Storage(1GB)가 금방 차서, 사진은 선생님 드라이브 「일공_사진」/<학생번호 또는 QNA>/파일.jpg 에 저장. **QnA 사진은 계속 보관**, 숙제 사진은 지금처럼 3개월 뒤 정리(`cleanupPhotos` 는 「숙제사진」 표만 봄).
- 사진 창고 = 작은 Apps Script 웹앱 `photo-store/Code.gs`(upload·get·remove, 키 확인). 서버만 부르고 학생 브라우저는 주소·키를 모름.
- 서버: `supabase/functions/api/photostore.js` — `kv_props` 에 `PHOTO_URL`·`PHOTO_KEY` 가 있으면 드라이브, 없으면 Supabase Storage. 드라이브에 없는 예전 사진은 Storage 에서 읽음. 설정은 1분마다 다시 읽음. 테스트 `node supabase/test/photostore.test.mjs`.
- 설치: `photo-store/Code.gs` 머리말 4단계(붙여넣기 → setup 실행 → 웹 앱 배포 → 로그의 SQL 을 Supabase 에서 실행) + 서버 재배포.
- 실제 드라이브로 올리고 읽는 것은 아직 확인 못 함(가짜 fetch 로만 테스트).

## 해야 할 일
| 순서 | 일 | 누가 |
|---|---|---|
| 1 | ~~Supabase 프로젝트~~ ✅ 서울 프로젝트에 표·서버·데이터 완료 | 완료 |
| 2 | Edge Function `api` 배포 (`supabase functions deploy api`, CLI 로그인은 선생님 계정) · 관리자 비밀번호를 `kv_props`에 | 선생님 → 클코 안내 |
| 3 | 개발 기록장 → CSV → 표로 옮기기 · `config.js` `API_URL.dev`를 Edge Function 주소로 | 클코 |
| 4 | **퀴즈 쪽 서버**: 번호 확인(who)·랭킹(rank)·학생 분석(stats)·결과 기록(구글 폼)을 Edge Function으로 (`퀴즈기록` 표는 만들어 둠) | 클코 |
| 5 | 개발판에서 확인 → 본판 승격 · 옛 주소 안내 페이지 · 원생명단/기록장 최종 이전(점검 기간 중 쓰기 멈춤) | 함께 |
| 6 | 사진 정리·백업(Supabase cron) · 접속기록 | 클코 |

## 아직 검증 못 한 것
- 실제 Supabase에서의 동작(로컬 Postgres로만 확인). 사진 올리기(`hwPhoto`)는 테스트에서 양쪽 다 거절돼 업로드 경로는 안 돌아 봄.
- Edge Function 첫 요청 지연(콜드 스타트), 한 요청에서 표를 모두 읽는 비용 — 학생 수가 많아지면 표별 캐시·인덱스 필요.

## 커리큘럼·QnA 서버 (2026-11-24)

서버(`logic.js`)에 학생용 **커리큘럼 조회**와 **QnA**를 추가했다. 화면은 `docs/dev/curriculum/`·`docs/dev/qna/` 가 이 계약을 보고 만든다. 모든 응답은 `{ok,data}` / `{ok:false,error}`, 학생 요청은 `payload.tok`, 강사 요청은 `payload.token`.

**학생 액션** (`STUDENT`)
| 액션 | 보내는 것 | 돌려주는 것 |
|---|---|---|
| `curriculum` | `{tok}` | `{classes:[{code,name,kind,time,months:[{month,subj,head,rows,cal}]}]}` — 지금 듣는(수강 + 반 활성) 반만, 최근 달 먼저. `rows`=`{round,date,content,range,homework}`, `head`=계획서머리의 강의명·부제·강의목표·담당강사·강의기간·강의시간·강의실·교재·질문시간·질문방법·평가방법(없으면 null), `cal`=`{start,end,off}`|null. **머리말 「연락처」(강사 연락처/톡ID)는 학생에게 안 보냄** |
| `qnaList` | `{tok}` | `{mine:[Q],pub:[Q]}` — mine=내 질문 전부 최신순, pub=남의 **공개+답변된** 질문(최근 답변 먼저, 300개까지, 작성자는 `who`=「배○성」) |
| `qnaAsk` | `{tok,subject,title,body,public,photos:[{b64}]}` | `{id}` — 과목 정치·경제·현대사회·지리·역사·기타, 제목 80자·내용 2000자, 사진 3장·장당 3MB·JPEG(`/9j/`)만, 1분에 5건. `public` 생략=비공개 |
| `qnaPhoto` | `{tok,id}` (id=**사진 파일ID**) | `{mime,b64}` — 내 질문(답변 사진 포함) 또는 공개+답변된 질문의 사진만 |
| `qnaDelete` | `{tok,id}` (id=**질문ID**) | `{removed}` — 내가 쓴 답 없는 질문만, 사진 파일도 지움 |
Q = `{id,subject,title,body,public,at,status('대기'|'답변'),answer,answerAt,photos:[fileId],answerPhotos:[fileId],mine,who}` (mine 의 `who` 는 「나」).

**강사 액션** (`ADMIN`): `qnaAdminList {token,status?}`(대기 먼저·오래된 순, 답변은 최근 답변 먼저; Q + `code,name,classes[반 이름]`) · `qnaAnswer {token,id,answer,public?,photos?,removePhotos?}`(다시 부르면 수정; `photos`=새로 올릴 사진, `removePhotos`=지울 기존 답변 사진 파일ID, 합쳐 3장까지, `public` 생략하면 학생이 고른 값 유지, 답변 3000자) · `qnaAdminDelete {token,id}` · `qnaAdminPhoto {token,id}`(id=사진 파일ID). 쓰기 4개(`qnaAsk·qnaDelete·qnaAnswer·qnaAdminDelete`)는 `WRITES`.

**표** `질문`(질문ID·번호·과목·제목·내용·공개·작성일·상태·답변·답변일·사진·답변사진) — 사진·답변사진은 파일ID 를 쉼표로 이은 문자열. 마이그레이션 `supabase/migrations/002_qna.sql`(`gen-schema.js` 가 001 과 함께 만들되 001 은 그대로). 사진은 Storage `hw-photos` 버킷의 `QNA/` 폴더(`QNA_<질문ID>_q|a<난수>_<순서>.jpg` — 파일 이름에 학생 번호가 없다: 공개 질문의 파일ID 가 다른 학생에게도 가므로).

**커리큘럼 연결 규칙** (강사 「강의계획서」와 같음): 실전 = 반종류 「실전」 + 반(반코드 끝 글자 D/E). 개념·단풀 = 반종류 + 과목 — 과목은 그 달 그 반의 시험·숙제 이름 첫 단어(강사 화면 `subjIn`). 그 달 그 반의 과목을 모르면 그 달 그 반종류 계획서의 과목이 하나뿐일 때만 그 과목으로 봄. 계획서 줄도 머리말도 없는 달은 뺌.

**배포 순서**: ① `002_qna.sql` 을 Supabase SQL Editor 에서 실행 → ② `sh supabase/sync-engine.sh` → Edge Function 재배포. (순서 거꾸로 하면 서버가 모든 표를 한 번에 읽는 구조라 `질문` 표가 없어 **모든 요청이 실패**한다.) 테스트: `node tests/logic.test.js`(64) · `cd supabase/test && node pg.test.mjs` · `cd supabase/functions/api && deno check index.ts`.
