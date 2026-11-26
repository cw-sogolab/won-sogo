# 개발판에 최종 디자인 입히기 — 공통 계약 (2026-11-26)

> 기준 시안: `docs/dev/v2/sian-final.html` (B 3D 클레이를 기본, **보상 순간(클리어·랭킹·정답 배지)에만 J**).
> 여러 작업자가 동시에 각자 맡은 폴더만 고칩니다. **이 문서의 이름·모양은 바꾸지 않습니다.** 바꿔야 하면 보고에 적어 부모가 맞춥니다.
> 사용자: 고등학생·재수생. 말투는 담백하게(「오늘 할 일 1개 남음」), 재치는 보상 순간에만. 「퇴실 퀴즈」 대신 **「퇴근 미션」**, 「퇴실증」 대신 **「퇴근증」**.
> ⚠ 이 저장소는 공개입니다. 실제 학생 이름·번호·성적을 파일·커밋에 쓰지 않습니다.

## 1. 디자인 토큰 — `docs/dev/assets/ds.css`
- 허브(`index.html`)가 맨 먼저 불러옴. 모든 모듈은 **이 변수만** 씀(`--bg --card --ink --sub --body --line --pt --ok --sh --sh-s --tile … --j-bg --j-lime --j-pink --f --fn --f-an --f-han --spring`). 색 코드를 새로 박지 않는다.
- 다크 모드: `<html data-theme="light|dark">`. 허브가 정함(설정 「자동·라이트·다크」, 자동이면 기기 설정). 모듈은 `[data-theme="dark"]` 아래 규칙만 쓰면 됨(자기 `prefers-color-scheme` 미디어 쿼리는 지움).
- 글꼴: Pretendard(본문), M PLUS Rounded 1c(숫자·일본어), Anton·Black Han Sans(J 순간 큰 글자) — 허브 `<head>` 가 Google Fonts 로 불러옴.
- 모양: 카드 반지름 24~28px, 흰 카드 + `--sh`, 꽉 찬 둥근 사각 버튼(`--pt` 배경), 큰 숫자는 `--fn`. 세부는 sian-final 의 해당 화면을 그대로 따라 한다.

## 2. 몽글이 캐릭터 — `docs/dev/assets/mongle.js` (작업자 「mongle」 이 만듦)
```js
HubMongle.svg(state, size, opts)   // → SVG 문자열.  state = {body, hat, glasses, charm}  (없으면 기본)
                                   //    opts = {expr:'base'|'happy'|'wow', anim:true|false, shadow:true|false}
HubMongle.avatar(state, size, opts)// 캐릭터를 끈 학생용까지 처리: opts.show===false 면 opts.initial 글자 동그라미
HubMongle.items                    // 아이템 목록 (아래 표와 같은 id·kind·grade·name)
HubMongle.pop(el)                  // 아이템 입힐 때 「쏙」+반짝이 효과를 el 안 캐릭터에 재생 (reduced-motion 이면 아무것도 안 함)
HubMongle.mount()                  // 애니메이션 CSS·공용 SVG defs 를 문서에 한 번 넣음 (여러 번 불러도 한 번)
```
- 3D 렌더 PNG 가 오면 `mongle.js` 안에서만 SVG → `<img>` 층 겹치기로 바꾼다(다른 모듈은 그대로).
- 모듈은 `window.HubMongle` 이 없을 수 있다고 보고(로드 순서) 없으면 빈 자리로 그린다.

### 아이템 목록 (id 는 3D 렌더 규격서 파일 이름과 같음)
| kind | id | 이름 | 등급 |
|---|---|---|---|
| body | lavender · peach | 라벤더 · 피치 | basic |
| body | mint · sky | 민트 · 스카이 | hip |
| body | butter | 버터 | rare |
| hat | none · cap | 없음 · 캡 | basic |
| hat | beanie · headphone · hood · bucket | 비니 · 헤드폰 · 후드 · 버킷햇 | hip |
| hat | crown | 왕관 | rare |
| glasses | none · round | 없음 · 동글 안경 | basic |
| glasses | sun · square | 선글라스 · 네모 안경 | hip |
| glasses | star | 별 안경 | rare |
| charm | none · star | 없음 · 별 키링 | basic |
| charm | heart · bolt · chain | 하트 · 번개 · 체인 | hip |
| charm | fuji · sakura | 후지산 · 벚꽃 | rare |
등급 표시: **희귀(rare)** = 보라·금 반짝 테두리 + 「희귀」, **힙(hip)** = 라임/핑크 꼬리표 「힙」, 기본은 표시 없음.

## 3. 서버 계약 (작업자 「server」 가 만듦 — `{action,payload}` POST, 응답 `{ok,data}`/`{ok:false,error}`)
학생(`payload.tok`, `HubSession.call` 이 자동으로 넣음):
- `charGet` {} → `data:{ state:{body,hat,glasses,charm}, show:true|false, star:<숫자>, items:[{id,kind,grade,owned:true|false,cond:'7일 연속 출석', progress:{now,goal}|null}] }`
- `charSet` {body,hat,glasses,charm, show?} → `data:{state,show}` — 가진 아이템만 입을 수 있음(아니면 오류 「아직 얻지 못한 아이템이에요」).
- 랭킹: 퀴즈 랭킹 GET `?mode=rank` 의 각 줄 `top[i]` 에 **`char:{body,hat,glasses,charm}` 또는 `null`(캐릭터를 끈 학생)** 과 `ini`(이름 첫 글자 — 끈 학생 동그라미용)가 붙음.
- 개발판 기본값: 서버 설정 `CHAR_UNLOCK_ALL=Y` 이면 모든 아이템 owned=true(규칙 확정 전 시험용). cond·progress 는 규칙대로 계산해 보여 줌.

## 4. 허브 ↔ 모듈 공유
- `HubSession.call / adminCall / view` (기존 그대로) + **`HubSession.char()`** → Promise<charGet 응답>(한 번 받아 둠), **`HubSession.setChar(state, show)`**, 바뀌면 `window` 에 `hub:char` 이벤트(`detail={state,show}`)를 쏨. 모듈은 이 이벤트를 받아 자기 화면의 캐릭터를 다시 그린다.
- 테마가 바뀌면 `hub:theme` 이벤트(`detail={theme}`).
- 탭: 홈 · 퇴근 미션 · 성적노트 · 수업 · 질문 (아래 탭바, PC 는 위쪽). 꾸미기·설정·랭킹은 홈에서 들어가는 화면(허브 소유).

## 5. 누가 무엇을 (동시에 작업 — 자기 폴더만 고친다)
| 작업자 | 고치는 파일 | 내용 |
|---|---|---|
| server | `docs/dev/assets/logic.js` · `core.js` · `mock.js`, `tests/`, `supabase/`, `apps-script/Core.gs`·`Logic.gs`(동기화) | 캐릭터 표·액션·아이템 규칙, 랭킹에 캐릭터 |
| mongle | `docs/dev/assets/mongle.js` (새 파일) | 위 2번 |
| shell | `docs/dev/index.html` · `hub-session.js` · `home/` · 새 `closet/`(꾸미기) · 새 `settings/` | 허브 틀·탭바·로그인·홈·꾸미기·설정·테마 |
| quiz | `docs/dev/qz/` | 퇴근 미션 학생·강사 화면 새 디자인, 클리어·랭킹은 J, 랭킹에 캐릭터, 「퇴근」 이름 |
| grades | `docs/dev/grades-native/` | 성적노트 새 디자인 |
| curqna | `docs/dev/curriculum/` · `docs/dev/qna/` | 수업(커리큘럼 — 시안의 「수업 맵」 포함)·질문 새 디자인 |
| admin | `docs/dev/grades-admin/` | 강사 화면 새 디자인(시안 어드민, 장식 최소) |
- `docs/dev/assets/ds.css` 와 이 문서는 부모만 고친다. 필요한 토큰이 없으면 모듈 CSS 안에 `.<자기래퍼> { --x: … }` 로 임시 정의하고 보고.
- **기능·규칙은 바꾸지 않는다**(점수·정렬·권한·문구의 뜻). 모양·배치·말투만.

## 6. 확인 방법 (앱 브라우저 창 도구 금지 — 헤드리스 크롬)
- 로컬 서버: `http://127.0.0.1:8769/` = `~/ilgong/won-sogo/docs` (캐시 없음). 개발판 `http://127.0.0.1:8769/dev/index.html`.
- 실제 서버로 학생 로그인 확인이 필요하면 부모가 알려 준 개발용 번호를 `#sid=<번호>` 로 붙인다(번호는 저장소 밖 파일에 있음 — 파일·커밋·보고에 적지 않음). 각 모듈의 `test.html` + `?demo`(가짜 데이터)로도 확인.
- 렌더 명령은 `docs/dev/v2/RENDER.md` 와 같되 포트만 8769, `--user-data-dir` 는 자기 전용 폴더.
- 라이트·다크, PC 폭, 휴대폰 폭(390px — CDP 화면 흉내 또는 iframe) 모두 본다.
- 테스트: `node tests/logic.test.js` 는 항상 통과해야 함(server 가 고치는 중이면 잠깐 깨질 수 있음 — 그때는 보고만).
