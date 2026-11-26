/* 허브 안 「수업」 탭 (HubCurriculum) — 2026-11-24, 새 디자인(sian-final ⑦ 수업 맵) 2026-11-26.
 *   HubCurriculum.mount(rootEl, { session, today?, onAuthError? }) / HubCurriculum.unmount()
 *   session  hub-session.js 의 HubSession (또는 같은 모양: call(action, payload) → Promise<{ok,data,error,needLogin}>)
 *   today    'YYYY-MM-DD' — 「오늘」을 바꿔 보고 싶을 때만 (시험·시연용)
 *   onAuthError(msg)  서버가 다시 로그인하라고 할 때 허브가 로그인 화면으로 돌리게 부름 (선택)
 *   HubCurriculum.refresh()  서버에서 다시 불러오기 (허브가 탭을 다시 열 때)
 *
 * 맨 위 「수업 맵」(고른 반의 이번 달 회차 — 계산은 mapModel 주석), 그 아래 「내 수업계획서」(서버 curriculum 응답), 맨 아래 「전체 과정」(이 파일 안의 고정 내용 ROAD).
 * 색·글꼴은 docs/dev/assets/ds.css 변수만(다크 = <html data-theme="dark">). 캐릭터는 HubMongle(+HubSession.char) → 없으면 HubMascots.
 * 서버 계약: data.classes[{code,name,kind('개념'|'단풀'|'실전'),time,months:[{month:'2026-11',head,rows:[{round,date,content,range,homework}],cal:{start,end,off}}]}]  (최근 달이 먼저)
 * 규칙·계산은 서버 몫, 이 파일은 그리기만 한다. CSS 는 cur.css (전부 .cur 아래). 전역에는 window.HubCurriculum 하나만 둔다.
 *
 * 「전체 과정」 내용의 출처 (선생님 확인용 — 확정되지 않은 것은 [ ] 로 비워 둠):
 *   일공/CLAUDE.md · 1_수업/CLAUDE.md · 01_개념반·02_단풀반·03_실전반 CLAUDE.md · 개념반 _진행.md
 *   5_WON시리즈/CLAUDE.md · 5_WON시리즈/_공통/교재_이름체계.md
 *   메모: silijeon-bc-2027-curriculum · test-language-by-level · won-base-concept-book · book-naming-one-won · won-way-three-parts · question-bank-class-use
 *   ilgong/hub/CLAUDE.md(성적노트 규칙 18·20·21·29) · 9_운영/학원/강의계획서/26 (수업계획서 머리·회차 칸 이름) */
(function () {
  'use strict';
  var root = null, gen = 0, session = null, opts = null, data = null, clsSel = 0, openM = {}, listeners = [], TODAY = '';
  var SUBJ = [
    { n: '정치', c: '#FC5230' }, { n: '경제', c: '#5A6FD6' }, { n: '현대사회', c: '#2E9ED8' }, { n: '역사', c: '#D99A00' }, { n: '지리', c: '#5F9467' }
  ];
  var BLANK = '<span class="cur-blank" title="아직 정해지지 않았어요">[ ]</span>';

  /* ---------- 전체 과정 (고정 내용) ---------- */
  var ROAD = {
    intro: '정치·경제·현대사회·역사·지리, EJU 종합과목 다섯 과목을 개념 → 단원별 문제풀이 → 실전 순서로 이어서 공부해요.',
    stages: [
      {
        key: 'k1', tag: '개념반', title: '개념 쌓기', mascot: 'm-note-happy', kind: '개념',
        lead: '과목마다 개념을 처음부터 차근차근 정리하는 단계예요.',
        points: [
          '한 주 분량을 묶은 주차 강의안으로 과목별 수업을 해요.',
          '숙제는 주간 일문일답이에요. 문제집 쪽을 사진 찍어 올려요.',
          '테스트는 한국어로 나와요. 개념 이해가 일본어에 가려지지 않게 하려는 거예요.'
        ],
        books: [{ n: 'WON BASE', d: '개념반 워크북 · 과목별 5권 — 강마다 필기, 숙제 일문일답, 확인 문제 10, 해답은 책 맨 뒤' }],
        test: '매주 일문일답 숙제 · 소테스트로 점검 · 달의 마지막 수업은 월말테스트',
        span: true
      },
      {
        key: 'k2', tag: '단풀반', title: '단원별 문제풀이', mascot: 'm-pencil-happy', kind: '단풀',
        lead: '개념을 문제로 확인하며 EJU 문제 형식에 익숙해지는 단계예요. 정식 이름은 단원별 문제풀이반이에요.',
        points: [
          '회차마다 개념정리를 짚고 OX · 기본 · 심화 문제를 풀어요.',
          '숙제는 과목별 EJU 기출이에요. 「내 성적」에서 답안을 직접 입력해요.',
          '문제는 일본어로 나와요. 단풀반부터 EJU와 같은 형식이에요.'
        ],
        books: [{ n: 'WON UNIT', d: '단풀반 교재 · 과목별 5권 — 회차별 OX · 기본 · 심화와 해답' }],
        test: '회차마다 EJU 기출 숙제 · 달의 마지막 수업은 월말테스트',
        span: true
      },
      {
        key: 'k3', tag: '실전반', title: '실전 대비', mascot: 'm-rocket-happy', kind: '실전',
        lead: '시험을 직접 풀고 해설로 다지면서 점수를 끌어올리는 단계예요.',
        points: [
          '시험을 보고 그 자리에서 풀이 · 해설을 해요.',
          '「내 성적」에서 환산점수 · 등수 · 과목별 정답률 · 취약 과목을 볼 수 있어요.'
        ],
        books: [
          { n: 'WON STEP', d: '실전반 복습 교재 · 전과목 한 권 — STEP 1-3, 책 끝에 Final' },
          { n: 'I WON', d: '모의고사 · 10회' },
          { n: 'WON PAGE', d: '자료집 · 地図 · 年表 · 日本' }
        ],
        test: '모의고사 · 월말 · 환산점수와 등수로 확인',
        span: true,
        flow: {
          title: '2027년 6월 EJU 대비 흐름 (2026년 11월에 시작하는 반 기준)',
          steps: [
            { w: '11~12월', t: '개념 잡기', d: 'WON STEP으로 5과목 개념을 다시 다져요.' },
            { w: '1~2월', t: '모의고사', d: '모의고사 1~10회와 Final을 풀어요.' },
            { w: '3~5월', t: 'EJU 기출', d: '2011~2025년 1회 시험 기출을 풀고, 중간중간 자료집 특강이 있어요.' },
            { w: '6월', t: '총정리', d: '2020~2025년 통합본 풀이 · 해설과 총정리를 해요.' }
          ]
        }
      }
    ],
    // 단계에 묶이지 않는 교재 — 쓰는 시기는 정해지면 채움
    extra: [
      { n: 'WON WAY', d: '계산 · 연도 나열 · 도표 문제집 (세 파트를 한 권으로)', when: true },
      { n: 'WON PICK', d: '단원별 문제은행', when: true }
    ]
  };

  /* ---------- 작은 도우미 ---------- */
  function $(s, r) { return (r || root).querySelector(s); }
  function all(s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); }
  function mas(id, size, cls) { return window.HubMascots ? window.HubMascots.svg(id, size, cls || '') : ''; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(y, m, d) { return y + '-' + p2(m) + '-' + p2(d); }
  function todayIso() {
    if (TODAY) return TODAY;
    var n = new Date(); return isoOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }
  function wd(iso) { var p = iso.split('-'); return '일월화수목금토'.charAt(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()); }
  function monthLabel(m) { var p = String(m).split('-'); return p.length >= 2 ? p[0] + '년 ' + (+p[1]) + '월' : String(m); }
  /** 'YYYY-MM-DD'(시각 붙어도 됨) · 'M월 D일' · 'M/D' → {iso,m,d}. 연도는 그 달(ym)에서 가져옴. 못 읽으면 null */
  function parseDate(s, ym) {
    s = String(s === null || s === undefined ? '' : s);
    var m = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s), y = ym ? +String(ym).split('-')[0] : new Date().getFullYear();
    if (m) return { iso: isoOf(+m[1], +m[2], +m[3]), m: +m[2], d: +m[3] };
    m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/.exec(s) || /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(s);
    if (m) return { iso: isoOf(y, +m[1], +m[2]), m: +m[1], d: +m[2] };
    return null;
  }
  function dateText(pd) { return pd.m + '/' + pd.d; }
  function subjOf(name) {
    name = String(name || '');
    for (var i = 0; i < SUBJ.length; i++) if (name.indexOf(SUBJ[i].n) >= 0) return SUBJ[i];
    if (/현사/.test(name)) return SUBJ[2];
    return null;
  }
  /** 서버 값 속 「[연락처/톡ID]」 같은 양식 자리표시 지우기 (통째로 자리표시면 빈 값) */
  function clean(v) {
    var t = String(v === null || v === undefined ? '' : v).replace(/\[[^\]\n]*\]/g, '').replace(/[ \t]*\|[ \t]*$/g, '').replace(/^[ \t]*\|[ \t]*/g, '').replace(/[ \t]{2,}/g, ' ').trim();
    return t;
  }

  /* ---------- 캐릭터 (몽글이) — 빈 화면·오류·완강 자리와 수업 맵에만 ----------
   * window.HubMongle(assets/mongle.js) + HubSession.char() 가 있으면 내 몽글이, 없으면 HubMascots 대체 그림, 그것도 없으면 빈 자리.
   * 자리는 <span class="cur-ch" data-chs data-che data-chf> 로 그려 두고, hub:char 이벤트가 오면 다시 채움. */
  var charSt = null;
  function charInner(size, expr, fb) {
    var M = window.HubMongle;
    if (M && (M.avatar || M.svg)) {
      try {
        var st = charSt ? charSt.state : null, show = !charSt || charSt.show !== false;
        var nm = session && session.name ? String(session.name) : '';
        if (!show && M.avatar) return M.avatar(st, size, { show: false, initial: nm.charAt(0) || '나', expr: expr || 'base' });
        return M.svg(st, size, { expr: expr || 'base', anim: true, shadow: true });
      } catch (e) { /* 대체 그림으로 */ }
    }
    return fb ? mas(fb, size, 'hm-float') : '';
  }
  function charSlot(size, expr, fb, cls) {
    return '<span class="cur-ch' + (cls ? ' ' + cls : '') + '" aria-hidden="true" data-chs="' + size + '" data-che="' + esc(expr || 'base') + '" data-chf="' + esc(fb || '') + '">' + charInner(size, expr, fb) + '</span>';
  }
  function refreshChars() {
    if (!root) return;
    all('.cur-ch').forEach(function (el) { el.innerHTML = charInner(+el.getAttribute('data-chs'), el.getAttribute('data-che'), el.getAttribute('data-chf')); });
  }
  function loadChar() {
    if (!session || typeof session.char !== 'function') return;
    var s0 = session;
    try {
      Promise.resolve(session.char()).then(function (r) {
        if (!root || session !== s0) return;
        var d = r && r.data ? r.data : r;
        if (d && (d.state || d.show !== undefined)) { charSt = { state: d.state || null, show: d.show }; refreshChars(); }
      }, function () { /* 기본 몽글이 그대로 */ });
    } catch (e) { /* */ }
  }

  /* ---------- 작은 아이콘 (수업 맵) ---------- */
  var IC = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="10" fill="#17966A"/><circle cx="12" cy="11.6" r="10" fill="#3CC995"/><path d="M7.4 11.8l3.2 3.2 6-6.4" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8.6a4 4 0 0 1 8 0V11" fill="none" stroke="#8C86AB" stroke-width="2.6" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10.2" rx="3.6" fill="#77719A"/><rect x="5" y="10.2" width="14" height="10" rx="3.6" fill="#A9A4C8"/><circle cx="12" cy="14.6" r="1.7" fill="#4E4870"/><rect x="11.2" y="15" width="1.6" height="3" rx=".8" fill="#4E4870"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.6" y="11" width="14.8" height="10.2" rx="3" fill="#D63F78"/><rect x="4.6" y="10.4" width="14.8" height="10" rx="3" fill="#FF6E9F"/><rect x="3.4" y="7.4" width="17.2" height="5.4" rx="2.6" fill="#FF86B0"/><rect x="10.6" y="7.4" width="2.8" height="13.2" fill="#FFC93D"/><ellipse cx="9.1" cy="5.7" rx="3.2" ry="2" fill="#FFC93D" transform="rotate(24 9.1 5.7)"/><ellipse cx="14.9" cy="5.7" rx="3.2" ry="2" fill="#FFC93D" transform="rotate(-24 14.9 5.7)"/><circle cx="12" cy="7" r="1.7" fill="#E5A400"/></svg>'
  };

  /* ---------- 틀 ---------- */
  function topHtml() {
    return '<header class="cur-top"><div class="cur-top-t"><p class="cur-hi" id="cur-hi">안녕하세요</p><h1 class="cur-title">수업</h1><p class="cur-sum" id="cur-sum"></p></div>' +
      '<button type="button" class="cur-link" id="cur-refresh">새로고침</button></header>' +
      '<div id="cur-chipbox"></div>' +
      '<section class="cur-sec cur-mapsec" id="cur-map" aria-label="수업 맵"><div id="cur-mapbody">' + SKELETON_MAP + '</div></section>' +
      '<div class="cur-jump" aria-label="이동"><button type="button" class="cur-jb" data-to="cur-plan">내 수업계획서</button><button type="button" class="cur-jb" data-to="cur-road">전체 과정</button></div>';
  }
  function stageHtml(s, i) {
    var h = '<article class="cur-stage k-' + esc(s.kind) + '"><div class="cur-rail" aria-hidden="true"><span class="cur-dot">' + (i + 1) + '</span></div>' +
      '<div class="cur-card"><div class="cur-st-top"><span class="cur-tag">' + esc(s.tag) + '</span><h3 class="cur-st-t">' + esc(s.title) + '</h3></div>' +
      '<p class="cur-lead">' + esc(s.lead) + '</p><ul class="cur-pts">' + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
    if (s.flow) {
      h += '<div class="cur-flow"><p class="cur-flow-t">' + esc(s.flow.title) + '</p><ol>' + s.flow.steps.map(function (st) {
        return '<li><span class="cur-fw">' + esc(st.w) + '</span><b>' + esc(st.t) + '</b><span class="cur-fd">' + esc(st.d) + '</span></li>';
      }).join('') + '</ol></div>';
    }
    h += '<div class="cur-books"><p class="cur-lbl">교재</p>' + s.books.map(function (b) { return '<div class="cur-book"><b>' + esc(b.n) + '</b><span>' + esc(b.d) + '</span></div>'; }).join('') + '</div>' +
      '<div class="cur-test"><p class="cur-lbl">테스트</p><p>' + esc(s.test) + '</p></div>';
    if (s.span) h += '<p class="cur-span"><span class="cur-lbl">수강 기간 · 수업 횟수</span> ' + BLANK + '</p>';
    return h + '</div></article>';
  }
  function roadHtml() {
    return '<section class="cur-sec" id="cur-road" aria-labelledby="cur-road-h"><h2 id="cur-road-h">전체 과정</h2><p class="cur-intro">' + esc(ROAD.intro) + '</p>' +
      '<div class="cur-subj" aria-label="과목">' + SUBJ.map(function (s) { return '<span class="cur-sj"><i style="background:' + s.c + '"></i>' + s.n + '</span>'; }).join('') + '</div>' +
      '<div class="cur-line">' + ROAD.stages.map(stageHtml).join('') + '</div>' +
      '<div class="cur-card cur-extra"><h3 class="cur-st-t sm">단계와 따로 쓰는 교재</h3>' + ROAD.extra.map(function (b) {
        return '<div class="cur-book"><b>' + esc(b.n) + '</b><span>' + esc(b.d) + (b.when ? ' · 쓰는 시기 ' + BLANK : '') + '</span></div>';
      }).join('') + '<p class="cur-note">교재 이름은 모두 WON 시리즈예요. 각 단계에서 쓰는 책은 위 카드에 있어요.</p></div></section>';
  }
  var SKELETON_MAP = '<div class="cur-card cur-skelmap"><i class="a"></i><i class="b"></i><i class="c"></i></div>';
  var SKELETON_PLAN = '<div class="cur-skel"><i class="a"></i><i class="b"></i><i class="c"></i></div><p class="cur-loadmsg" role="status">내 수업계획서를 불러오는 중…</p>';
  function planShell(inner) {
    return '<section class="cur-sec" id="cur-plan" aria-labelledby="cur-plan-h"><div class="cur-sec-h"><h2 id="cur-plan-h">내 수업계획서</h2></div><div id="cur-planbody">' + inner + '</div></section>';
  }
  function stateCard(expr, fb, title, msg, btn) {
    return '<div class="cur-card cur-state">' + charSlot(96, expr, fb) + '<p class="cur-state-t">' + esc(title) + '</p>' + (msg ? '<p class="cur-state-m">' + esc(msg) + '</p>' : '') + (btn ? '<button type="button" class="cur-btn" id="cur-retry">' + esc(btn) + '</button>' : '') + '</div>';
  }

  /* ---------- 서버에서 받기 ---------- */
  function load() {
    var g = ++gen;
    $('#cur-planbody').innerHTML = SKELETON_PLAN;
    $('#cur-mapbody').innerHTML = SKELETON_MAP; $('#cur-map').hidden = false;
    var p;
    try { p = Promise.resolve(session.call('curriculum', {})); } catch (e) { p = Promise.resolve({ ok: false, error: '서버를 부를 수 없어요.' }); }
    return p.then(function (r) {
      if (g !== gen || !root) return;
      if (!r || !r.ok) {
        if (r && r.needLogin && opts.onAuthError) { opts.onAuthError(r.error || '다시 로그인해 주세요.'); return; }
        showError((r && r.error) || '수업계획서를 불러오지 못했어요.'); return;
      }
      data = normalize(r.data); render();
    }, function () { if (g === gen && root) showError('인터넷 연결을 확인하고 다시 시도해 주세요.'); });
  }
  function showError(msg) {
    $('#cur-chipbox').innerHTML = ''; $('#cur-map').hidden = true;
    $('#cur-planbody').innerHTML = stateCard('base', 'm-cloud', '불러오지 못했어요', msg, '다시 불러오기');
    var b = $('#cur-retry'); if (b) b.onclick = load;
    setSummary(null);
  }
  /** 서버 응답 정리: 달 안의 회차·휴강을 날짜순 한 줄 목록(items)으로 */
  function normalize(d) {
    var cls = (d && d.classes) || [];
    return cls.map(function (c) {
      var months = (c.months || []).map(function (m) { return prepMonth(m); });
      return { code: c.code, name: c.name || '', kind: c.kind || '', time: c.time || '', months: months };
    });
  }
  function offList(m) {
    var out = [], off = (m.cal && m.cal.off) || [];
    off.forEach(function (o) {
      var ds = Array.isArray(o) ? o[0] : (o && typeof o === 'object' ? (o.date || o.day) : o);
      var lb = Array.isArray(o) ? o[1] : (o && typeof o === 'object' ? (o.label || o.memo || o.note) : '');
      var pd = parseDate(ds, m.month); if (pd) out.push({ pd: pd, label: lb ? String(lb) : '' });
    });
    return out;
  }
  function prepMonth(m) {
    var items = [], seen = {}, head = m.head || null;
    (m.rows || []).forEach(function (r) {
      var pd = parseDate(r.date, m.month), content = String(r.content || '').trim(), isOff = /휴강/.test(content) && !String(r.range || '').trim();
      if (!pd && !content && !String(r.round || '').trim()) return;
      if (pd) seen[pd.iso] = 1;
      items.push({ type: isOff ? 'off' : 'class', round: String(r.round === null || r.round === undefined ? '' : r.round), pd: pd, rawDate: String(r.date || ''), content: content, range: String(r.range || '').trim(), homework: String(r.homework || '').trim() });
    });
    var cal = m.cal || null;
    offList(m).forEach(function (o) {
      if (seen[o.pd.iso]) { items.forEach(function (it) { if (it.pd && it.pd.iso === o.pd.iso && o.label && !it.content) it.content = o.label; }); return; }
      if (cal && cal.start && cal.end) { var a = parseDate(cal.start, m.month), b = parseDate(cal.end, m.month); if (a && b && (o.pd.iso < a.iso || o.pd.iso > b.iso)) return; }
      items.push({ type: 'off', round: '', pd: o.pd, rawDate: '', content: o.label, range: '', homework: '' });
    });
    items.sort(function (a, b) { var x = a.pd ? a.pd.iso : '', y = b.pd ? b.pd.iso : ''; return x === y ? 0 : (!x ? 1 : (!y ? -1 : (x < y ? -1 : 1))); });
    var n = items.filter(function (i) { return i.type === 'class'; }).length;
    return { month: m.month, head: head, cal: cal, items: items, count: n };
  }
  /** 이 반에서 오늘 이후 첫 수업: {mi,ii,iso} */
  function nextOf(c) {
    var best = null, t = todayIso();
    c.months.forEach(function (m, mi) {
      m.items.forEach(function (it, ii) {
        if (it.type !== 'class' || !it.pd || it.pd.iso < t) return;
        if (!best || it.pd.iso < best.iso) best = { mi: mi, ii: ii, iso: it.pd.iso, item: it };
      });
    });
    return best;
  }

  /* ---------- 수업 맵 ----------
   * 반 하나의 「이번 달」(오늘이 든 달 → 없으면 다음 수업이 있는 달 → 없으면 회차가 있는 가장 최근 달) 회차(휴강 뺌)를 날짜순으로 칸에 놓음.
   * 날짜 < 오늘 = 완료, 오늘 이후 첫 회차(오늘 포함) = 진행 중, 나머지 = 잠김. 「완강까지 N회 남음」 N = 전체 − 완료. 끝 칸 = 완강 보상. */
  function mapMonthOf(c) {
    var ym = todayIso().slice(0, 7), i;
    for (i = 0; i < c.months.length; i++) if (c.months[i].month === ym && c.months[i].count) return c.months[i];
    var nx = nextOf(c); if (nx && c.months[nx.mi].count) return c.months[nx.mi];
    for (i = 0; i < c.months.length; i++) if (c.months[i].count) return c.months[i];
    return null;
  }
  function mapModel(c) {
    var m = mapMonthOf(c); if (!m) return null;
    var t = todayIso(), nowSet = false, done = 0;
    var nodes = m.items.filter(function (it) { return it.type === 'class'; }).map(function (it, i) {
      var st;
      if (it.pd && it.pd.iso < t) { st = 'done'; done++; }
      else if (!nowSet) { st = 'now'; nowSet = true; }
      else st = 'lock';
      var rn = parseInt(it.round, 10);
      return { it: it, st: st, no: isFinite(rn) && rn > 0 ? rn : i + 1 };
    });
    return { m: m, nodes: nodes, total: nodes.length, done: done, left: nodes.length - done };
  }
  /** 칸 위치: 3칸씩 아래에서 위로 지그재그(뱀 모양), 맨 끝이 완강 보상. 가로는 340 기준(%로 늘고 줄어듦) */
  var MW = 340, XS = [64, 170, 276], ROWH = 112, PADT = 86, PADB = 52;
  function mapGeom(n) {
    var total = n + 1, rows = Math.ceil(total / 3), H = PADT + (rows - 1) * ROWH + PADB, pts = [];
    for (var i = 0; i < total; i++) {
      var r = Math.floor(i / 3), k = i % 3, col = r % 2 === 0 ? k : 2 - k;
      pts.push({ x: XS[col], y: H - PADB - r * ROWH + (k === 1 ? 8 : 0) });
    }
    return { H: H, pts: pts };
  }
  function roadD(pts) {
    if (!pts.length) return '';
    var d = 'M' + pts[0].x + ' ' + pts[0].y;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (a.x === b.x) { var bx = a.x > MW / 2 ? a.x + 48 : a.x - 48; d += 'C' + bx + ' ' + a.y + ' ' + bx + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
      else { var mx = (a.x + b.x) / 2; d += 'C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y; }
    }
    return d;
  }
  function pctX(x) { return (x / MW * 100).toFixed(2) + '%'; }
  function nodeLabel(nd) {
    var it = nd.it, d = it.pd ? dateText(it.pd) + '(' + wd(it.pd.iso) + ')' : (it.rawDate || '날짜 미정');
    return nd.no + '회 ' + d + (it.content ? ' ' + it.content : '') + ' — ' + (nd.st === 'done' ? '완료' : nd.st === 'now' ? '이번 회차' : '아직');
  }
  function mapHtml(c) {
    var md = mapModel(c);
    if (!md) return '';
    var g = mapGeom(md.total), pts = g.pts, goal = pts[md.total], all = md.left === 0;
    var nowI = -1; md.nodes.forEach(function (nd, i) { if (nd.st === 'now') nowI = i; });
    var doneTo = all ? md.total : (nowI >= 0 ? nowI : md.done - 1);   // 초록 길은 지금 칸까지
    var dRoad = roadD(pts), dDone = doneTo > 0 ? roadD(pts.slice(0, doneTo + 1)) : '';
    var svg = '<svg class="cur-ln" viewBox="0 0 ' + MW + ' ' + g.H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + dRoad + '" transform="translate(0 6)" class="r-edge" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + dRoad + '" class="r-road" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + dRoad + '" class="r-dot" vector-effect="non-scaling-stroke"/>' +
      (dDone ? '<path d="' + dDone + '" class="r-done" pathLength="100" vector-effect="non-scaling-stroke"/>' : '') + '</svg>';
    var nodes = md.nodes.map(function (nd, i) {
      var p = pts[i], bd = nd.st === 'done' ? '<i class="cur-bd">' + IC.check + '</i>' : nd.st === 'lock' ? '<i class="cur-bd">' + IC.lock + '</i>' : '';
      return '<li class="cur-nd ' + nd.st + '" style="left:' + pctX(p.x) + ';top:' + p.y + 'px" title="' + esc(nodeLabel(nd)) + '"' + (nd.st === 'now' ? ' aria-current="step"' : '') + '><span class="cur-vh">' + esc(nodeLabel(nd)) + '</span><b aria-hidden="true">' + nd.no + '</b>' + bd + '</li>';
    }).join('');
    nodes += '<li class="cur-nd goal' + (all ? ' got' : '') + '" style="left:' + pctX(goal.x) + ';top:' + goal.y + 'px"><span class="cur-vh">' + (all ? '완강 보상 — 받았어요' : '완강 보상') + '</span><i class="cur-gi">' + IC.gift + '</i><span class="cur-cap">' + (all ? '완강!' : '완강 보상') + '</span></li>';
    // 말풍선 + 내 몽글이
    var extra = '', who;
    if (nowI >= 0) {
      var np = pts[nowI], nit = md.nodes[nowI].it, say = nit.pd ? (nit.pd.iso === todayIso() ? '오늘' : dateText(nit.pd) + '(' + wd(nit.pd.iso) + ')') : '다음';
      extra += '<span class="cur-say" style="left:' + pctX(np.x) + ';top:' + (np.y - 33 - 34) + 'px">' + esc(say) + '</span>';
      // 내 몽글이는 진행 중 칸 바로 옆(판 가운데 쪽)에 섬 — 길이 꺾이는 칸에서도 칸을 가리지 않게
      who = { x: np.x + (np.x < MW / 2 ? 56 : -56), y: np.y + 16 };
    } else who = { x: goal.x, y: goal.y - 30 };   // 완강: 보상 공 위에 올라섬
    extra += '<div class="cur-me" style="left:' + pctX(who.x) + ';top:' + who.y + 'px">' + charSlot(50, all ? 'happy' : 'base', all ? 'm-party-happy' : 'm-rocket-happy') + '</div>';
    var nowNd = nowI >= 0 ? md.nodes[nowI] : null, info;
    if (nowNd) {
      var it = nowNd.it;
      info = '<div class="cur-nowc"><span class="cur-nowl">' + (it.pd && it.pd.iso === todayIso() ? '오늘 수업' : '다음 수업') + ' · <b class="num">' + nowNd.no + '</b>회' + (it.pd ? ' · <b class="num">' + dateText(it.pd) + '</b>(' + wd(it.pd.iso) + ')' : '') + '</span>' +
        '<p class="cur-nowt">' + (it.content ? esc(it.content) : '<span class="cur-dim">내용 미정</span>') + '</p>' + (it.range ? '<p class="cur-rg"><span>범위</span>' + esc(it.range) + '</p>' : '') + '</div>';
    } else info = '<div class="cur-nowc done"><span class="cur-nowl">' + esc(monthLabel(md.m.month).replace(/^\d+년 /, '')) + ' 수업</span><p class="cur-nowt">이번 달 수업을 다 들었어요</p></div>';
    var sj = subjOf(c.name);
    return '<div class="cur-card cur-mapc"><div class="cur-maph">' +
      '<div class="cur-pills"><span class="cur-pw">' + (sj ? '<i class="cur-kdot" style="background:' + sj.c + '"></i>' : '') + esc((c.kind ? c.kind + '반 · ' : '') + c.name) + '</span><span class="cur-pw num">' + md.done + ' / ' + md.total + '</span></div>' +
      '<p class="cur-mapm">' + esc(monthLabel(md.m.month)) + ' 수업 맵</p>' +
      '<p class="cur-left">' + (all ? '완강했어요' : '완강까지 <span class="num">' + md.left + '</span>회 남음') + '</p>' +
      '<div class="cur-prog" role="progressbar" aria-label="이번 달 들은 회차" aria-valuemin="0" aria-valuemax="' + md.total + '" aria-valuenow="' + md.done + '"><i style="width:' + (md.total ? (md.done / md.total * 100).toFixed(1) : 0) + '%"></i></div>' +
      info + '</div>' +
      '<div class="cur-path" style="height:' + g.H + 'px">' + svg + '<ol class="cur-nds" aria-label="' + esc(monthLabel(md.m.month)) + ' 회차 ' + md.total + '개">' + nodes + '</ol>' + extra + '</div></div>';
  }

  /* ---------- 그리기 ---------- */
  function setSummary(cls) {
    var el = $('#cur-sum'), hi = $('#cur-hi');
    var nm = session && session.name ? String(session.name) : '';
    hi.textContent = nm ? '안녕하세요, ' + nm + '님' : '안녕하세요';
    if (!cls || !cls.length) { el.textContent = ''; el.hidden = true; return; }
    el.hidden = false;
    var nx = null;
    cls.forEach(function (c) { var n = nextOf(c); if (n && (!nx || n.iso < nx.iso)) nx = { n: n, c: c }; });
    if (nx) {
      var d = nx.n.item.pd;
      el.innerHTML = '다음 수업은 <b>' + dateText(d) + '(' + wd(d.iso) + ')</b> · ' + esc(nx.c.name);
    } else el.textContent = '내 반 ' + cls.length + '개의 수업계획서를 모아 놨어요.';
  }
  /** 처음 고를 반: 다음 수업이 가장 가까운 반 */
  function firstCls(cls) {
    var best = -1, bi = '';
    cls.forEach(function (c, i) { var n = nextOf(c); if (n && (best < 0 || n.iso < bi)) { best = i; bi = n.iso; } });
    return best < 0 ? 0 : best;
  }
  var picked = false;
  function render() {
    var cls = data || [];
    if (!cls.length) { $('#cur-chipbox').innerHTML = ''; $('#cur-map').hidden = true; $('#cur-planbody').innerHTML = stateCard('base', 'm-cactus', '수강 중인 반이 없어요', '반이 정해지면 이곳에 수업계획서가 나타나요.'); setSummary(null); return; }
    if (!cls.some(function (c) { return c.months.length; })) { $('#cur-chipbox').innerHTML = ''; $('#cur-map').hidden = true; $('#cur-planbody').innerHTML = stateCard('base', 'm-cloud-happy', '아직 올라온 수업계획서가 없어요', '선생님이 계획서를 올리면 이곳에서 볼 수 있어요.'); setSummary(cls); return; }
    if (!picked) { clsSel = firstCls(cls); picked = true; }
    if (clsSel >= cls.length) clsSel = 0;
    setSummary(cls);
    $('#cur-chipbox').innerHTML = cls.length > 1 ? '<div class="cur-chips" role="tablist" aria-label="내 반">' + cls.map(function (c, i) {
      var sj = subjOf(c.name);
      return '<button type="button" role="tab" class="cur-chip" data-i="' + i + '" aria-selected="' + (i === clsSel) + '">' + (sj ? '<i class="cur-kdot" style="background:' + sj.c + '"></i>' : '') + esc(c.name) + (c.time ? '<small>' + esc(c.time) + '</small>' : '') + '</button>';
    }).join('') + '</div>' : '';
    all('.cur-chip').forEach(function (b) { b.onclick = function () { clsSel = +b.getAttribute('data-i'); render(); }; });
    var mh = mapHtml(cls[clsSel]);
    $('#cur-map').hidden = !mh; $('#cur-mapbody').innerHTML = mh;
    $('#cur-planbody').innerHTML = '<div id="cur-months"></div>';
    renderMonths(cls[clsSel]);
  }
  function renderMonths(c) {
    var t = todayIso(), nx = nextOf(c), key = c.code || String(clsSel);
    if (!c.months.length) { $('#cur-months').innerHTML = stateCard('base', 'm-cloud-happy', '이 반의 수업계획서가 아직 없어요', ''); return; }
    var sj = subjOf(c.name);
    var h = '<div class="cur-clsline k-' + esc(c.kind) + '">' + (sj ? '<i class="cur-kdot" style="background:' + sj.c + '"></i>' : '') + '<b>' + esc(c.name) + '</b>' + (c.kind ? '<span class="cur-tag sm">' + esc(c.kind) + '반</span>' : '') + (c.time ? '<span class="cur-meta">' + esc(c.time) + '</span>' : '') + '</div>';
    c.months.forEach(function (m, mi) {
      var id = key + '|' + m.month;
      if (!(id in openM)) openM[id] = nx ? nx.mi === mi : mi === 0;
      var open = openM[id], isNextMonth = nx && nx.mi === mi;
      var span = '';
      if (m.cal && m.cal.start && m.cal.end) { var a = parseDate(m.cal.start, m.month), b = parseDate(m.cal.end, m.month); if (a && b) span = dateText(a) + ' ~ ' + dateText(b); }
      var meta = [m.count ? '수업 ' + m.count + '회' : '', span].filter(Boolean).join(' · ');
      h += '<div class="cur-month' + (open ? ' open' : '') + '" data-id="' + esc(id) + '"><button type="button" class="cur-mh" aria-expanded="' + open + '" aria-controls="cur-mb-' + mi + '">' +
        '<span class="cur-mh-t"><b>' + esc(monthLabel(m.month)) + '</b>' + (isNextMonth ? '<span class="cur-pill nx">다음 수업</span>' : '') + '<span class="cur-meta">' + esc(meta) + '</span></span><span class="cur-chev" aria-hidden="true"></span></button>' +
        '<div class="cur-mb" id="cur-mb-' + mi + '"' + (open ? '' : ' hidden') + '>' + monthBody(m, nx && nx.mi === mi ? nx.ii : -1, t) + '</div></div>';
    });
    $('#cur-months').innerHTML = h;
    all('.cur-mh').forEach(function (b) {
      b.onclick = function () {
        var box = b.parentNode, id = box.getAttribute('data-id'), o = !box.classList.contains('open');
        openM[id] = o; box.classList.toggle('open', o); b.setAttribute('aria-expanded', o); $('.cur-mb', box).hidden = !o;
      };
    });
  }
  var HEAD_ROWS = [['담당강사', '담당 강사'], ['강의기간', '강의 기간'], ['강의시간', '강의 시간'], ['강의실', '강의실'], ['교재', '교재'], ['질문시간', '질문 시간'], ['질문방법', '질문 방법'], ['평가방법', '평가 방법']];
  function monthBody(m, nextIdx, t) {
    var h = '', hd = m.head;
    if (hd) {
      var title = clean(hd['강의명']), sub = clean(hd['부제']), goal = clean(hd['강의목표']), used = { '강의명': 1, '부제': 1, '강의목표': 1 }, rows = '';
      HEAD_ROWS.forEach(function (r) { used[r[0]] = 1; var v = clean(hd[r[0]]); if (v) rows += '<div><dt>' + esc(r[1]) + '</dt><dd>' + esc(v) + '</dd></div>'; });
      Object.keys(hd).forEach(function (k) { if (used[k]) return; var v = clean(hd[k]); if (v) rows += '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; });
      if (title || sub || goal || rows) {
        h += '<div class="cur-head">' + (title ? '<p class="cur-ht">' + esc(title) + '</p>' : '') + (sub ? '<p class="cur-hs">' + esc(sub) + '</p>' : '') +
          (goal ? '<div class="cur-goal"><span class="cur-lbl">강의 목표</span><p>' + esc(goal) + '</p></div>' : '') + (rows ? '<dl class="cur-dl">' + rows + '</dl>' : '') + '</div>';
      }
    } else h += '<p class="cur-none">이 달 계획서의 머리 정보(강의 목표 · 교재 등)는 아직 없어요.</p>';
    if (!m.items.length) return h + '<div class="cur-state in">' + charSlot(72, 'base', 'm-cloud-happy') + '<p class="cur-state-m">이 달 회차가 아직 없어요.</p></div>';
    h += '<ol class="cur-rows">';
    m.items.forEach(function (it, i) {
      var past = it.pd && it.pd.iso < t, isNext = i === nextIdx, off = it.type === 'off';
      var cls = 'cur-row' + (off ? ' off' : '') + (past && !isNext ? ' past' : '') + (isNext ? ' next' : '');
      var d = it.pd ? '<b>' + dateText(it.pd) + '</b><small>' + wd(it.pd.iso) + '</small>' : '<b class="raw">' + esc(it.rawDate || '–') + '</b>';
      var body;
      if (off) body = '<div class="cur-rc"><p class="cur-rt"><span class="cur-pill off">휴강</span>' + (it.content && !/^휴강$/.test(it.content) ? '<span class="cur-offm">' + esc(it.content.replace(/^휴강\s*[:：-]?\s*/, '')) + '</span>' : '') + '</p></div>';
      else body = '<div class="cur-rc"><p class="cur-rt">' + (isNext ? '<span class="cur-pill nx">다음 수업</span>' : '') + (it.content ? esc(it.content) : '<span class="cur-dim">내용 미정</span>') + '</p>' +
        (it.range ? '<p class="cur-rg"><span>범위</span>' + esc(it.range) + '</p>' : '') + (it.homework ? '<p class="cur-hw"><span class="cur-pill hw">과제</span>' + esc(it.homework) + '</p>' : '') + '</div>';
      h += '<li class="' + cls + '"' + (isNext ? ' aria-current="step"' : '') + '><div class="cur-rn">' + (it.round || !off ? '<span>' + esc(it.round || '·') + '</span>' : '') + '</div><div class="cur-rd">' + d + '</div>' + body + '</li>';
    });
    return h + '</ol>';
  }

  /* ---------- 공개 인터페이스 ---------- */
  function unmount() {
    gen++;
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
    if (root) { root.innerHTML = ''; root.classList.remove('cur'); }
    root = null; session = null; opts = null; data = null; clsSel = 0; openM = {}; TODAY = ''; charSt = null; picked = false;
  }
  function mount(rootEl, o) {
    if (!rootEl) throw new Error('HubCurriculum.mount: rootEl 이 없어요');
    if (root) unmount();
    opts = o || {}; session = opts.session;
    if (!session || typeof session.call !== 'function') throw new Error('HubCurriculum.mount: session(HubSession) 이 없어요');
    root = rootEl; gen++; data = null; clsSel = 0; openM = {}; charSt = null; picked = false;
    TODAY = /^\d{4}-\d{2}-\d{2}$/.test(opts.today || '') ? opts.today : '';
    if (window.HubMascots) window.HubMascots.mount();
    try { if (window.HubMongle && window.HubMongle.mount) window.HubMongle.mount(); } catch (e) { /* */ }
    root.classList.add('cur');
    root.innerHTML = topHtml() + planShell(SKELETON_PLAN) + roadHtml();
    all('.cur-jb').forEach(function (b) {
      b.onclick = function () { var el = document.getElementById(b.getAttribute('data-to')); if (el) el.scrollIntoView({ behavior: window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
    });
    $('#cur-refresh').onclick = function () { load(); };
    on(window, 'hub:char', function (e) {
      var d = e && e.detail; if (!d) return;
      charSt = { state: d.state || (charSt && charSt.state) || null, show: d.show !== undefined ? d.show : (charSt ? charSt.show : true) }; refreshChars();
    });
    setSummary(null);
    loadChar();
    load();
  }
  function refresh() { if (root) return load(); }
  window.HubCurriculum = { mount: mount, unmount: unmount, refresh: refresh };
})();
