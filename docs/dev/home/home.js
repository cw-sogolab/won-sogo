/* 허브 홈 화면 — 시안 sian-final ① 메인: 내 몽글이(주인공) · 오늘 할 일 · 다음 아이템까지 · 연속 출석·별 · 이번 주 랭킹 미니 카드 · 숙제·최근 테스트.
 *   HubHome.mount(rootEl, { session, name, go(tabId), open(screen) })
 *     go   : 허브가 탭을 바꿔 주는 함수 (id: quiz | grades | curriculum | qna)
 *     open : 홈에서 들어가는 화면 (closet | settings | rank) — 없으면 go 로 대신
 *   캐릭터를 끈 학생(charGet show=false)은 히어로가 「오늘 할 일」 카드로 바뀜.
 * 숫자·점수는 서버(login·charGet·rank 응답)에서 받은 그대로 — 계산하지 않음(남은 수 = goal − now 만). CSS 는 home.css (.home 아래). */
(function () {
  'use strict';
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n) { return window.HubIcons ? HubIcons.ic(n) : ''; }
  function dow(d) { return '일월화수목금토'.charAt(d.getDay()); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todayTxt() { var d = new Date(); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + dow(d) + '요일'; }
  function due(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/.exec(String(s || '')); if (!m) return '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return (+m[2]) + '/' + (+m[3]) + '(' + dow(d) + ')' + (m[4] && m[4] !== '00:00' ? ' ' + m[4] : '');
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  /** 이니셜: 세 글자 한국 이름이면 가운데(이름 첫 글자), 아니면 첫 글자 */
  function initial(nm) { nm = String(nm || '').trim(); return nm.length >= 3 && /^[가-힣]+$/.test(nm) ? nm.charAt(1) : nm.charAt(0) || '?'; }
  /** 몽글이 그리기 — 몽글이 파일이 없으면 빈 자리, 캐릭터를 끈 학생은 이니셜 동그라미 */
  function mg(state, size, opts) {
    opts = opts || {};
    if (opts.show === false) {
      if (window.HubMongle && HubMongle.avatar) return HubMongle.avatar(state, size, opts);
      return '<span class="hub-ini" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px" role="img" aria-label="' + esc(opts.initial || '') + ' (캐릭터 끔)">' + esc(opts.initial || '') + '</span>';
    }
    if (window.HubMongle && HubMongle.svg) return HubMongle.svg(state, size, opts);
    return '<span class="hub-mg-empty" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true"></span>';
  }
  /** 이 기기에서 오늘 퇴근 미션을 끝냈는지 (퀴즈가 남기는 기록 hist.<번호>.<세트> 의 날짜) */
  function missionDoneToday(code, name, env) {
    var pre = (env === 'prod' ? 'kitaku.' : 'kitaku-dev.') + 'hist.', t = ymd(new Date()), ids = [code, name].filter(Boolean);
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k || k.indexOf(pre) !== 0) continue;
        var who = k.slice(pre.length); if (!ids.some(function (x) { return who.indexOf(x + '.') === 0; })) continue;
        var h = JSON.parse(localStorage.getItem(k) || '[]'); if (h.some && h.some(function (r) { return r && r.date === t; })) return true;
      }
    } catch (e) {}
    return false;
  }

  /* ── 랭킹 (퀴즈 랭킹과 같은 GET ?mode=rank — 한 번 받아 1분 동안 씀) ── */
  var RK = { at: 0, d: null, p: null };
  function rankLoad(api) {
    if (RK.d && Date.now() - RK.at < 60000) return Promise.resolve(RK.d);
    if (RK.p) return RK.p;
    if (!api) return Promise.resolve(null);
    RK.p = fetch(api + (api.indexOf('?') > -1 ? '&' : '?') + 'mode=rank', { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); }).then(function (d) { RK.p = null; if (d && d.ok) { RK.d = d; RK.at = Date.now(); } return RK.d; })
      .catch(function () { RK.p = null; return RK.d; });
    return RK.p;
  }
  function pickList(d) {
    var L = d && d.lists || {}, w = L['cls|전체|week'];
    if (w && w.top && w.top.length) return { per: '이번 주', top: w.top };
    var m = L['cls|전체|month'];
    if (m && m.top && m.top.length) return { per: '이번 달', top: m.top };
    return { per: '이번 주', top: [] };
  }

  var root = null, gen = 0, O = {}, DATA = { view: null, ch: null, rk: undefined };

  function todoItems(view, done) {
    var cls = (view && view.classes || []).filter(function (c) { return c.current; }), t = ymd(new Date()), out = [];
    out.push({ label: '퇴근 미션', sub: done ? '마침' : '수업 끝', done: done, go: 'quiz' });
    cls.forEach(function (c) {
      (c.hw || []).forEach(function (h) {
        if (h.practice || h.done) return;
        var d = String(h.due || '').slice(0, 10);
        if (h.overdue || d === t) out.push({ label: '숙제 · ' + h.label, sub: h.overdue ? '마감 지남' : '오늘까지', done: false, late: !!h.overdue, go: 'grades' });
      });
    });
    return out;
  }
  function nextItem(ch) {
    if (!ch || !ch.items) return null;
    var best = null, names = {};
    (window.HubSession && HubSession.items ? HubSession.items() : []).forEach(function (x) { names[x.kind + ':' + x.id] = x.name; });
    ch.items.forEach(function (it) {
      var p = it.progress; if (it.owned || !p || !(p.goal > 0) || p.now >= p.goal) return;
      var r = p.now / p.goal; if (!best || r > best.r) best = { r: r, it: it, left: p.goal - p.now, name: names[it.kind + ':' + it.id] || it.name || '' };
    });
    return best;
  }
  function streak(ch) {
    if (!ch || !ch.items) return null;
    var v = null;
    ch.items.forEach(function (it) { if (/연속 출석/.test(it.cond || '') && it.progress && typeof it.progress.now === 'number') v = Math.max(v || 0, it.progress.now); });
    return v;
  }

  function rankCard() {
    var me = (O.name || '').trim(), rk = DATA.rk, ch = DATA.ch || {}, show = ch.show !== false;
    if (rk === undefined) return '<div class="card hm-rk is-load" aria-hidden="true"><div class="tx"><small>이번 주 랭킹</small><strong>불러오는 중</strong></div></div>';
    var L = pickList(rk), top = L.top.slice(0, 3), mine = -1;
    L.top.forEach(function (x, i) { if (mine < 0 && me && String(x.name || '').trim() === me) mine = i; });
    var strong = mine > -1 ? '나 <span class="num">' + (mine + 1) + '</span>위' : (top.length ? 'TOP <span class="num">3</span>' : '첫 도전자를 기다려요');
    var three = top.map(function (x, i) {
      var isMe = i === mine, st = isMe ? ch.state : x.char, off = isMe ? !show : !x.char;
      return '<div class="p' + (i === 0 ? ' p1' : '') + (isMe ? ' me' : '') + '"><i>' + (i + 1) + '</i><div class="ch">' +
        mg(st || null, i === 0 ? 46 : 38, { show: !off, initial: x.ini || initial(x.name), anim: false, shadow: false }) +
        '</div><span>' + (isMe ? '나' : esc(x.name)) + '</span></div>';
    }).join('');
    return '<div class="card hm-rk" data-open="rank" role="button" tabindex="0" aria-label="' + L.per + ' 랭킹 보기"><div class="tx"><small>' + L.per + ' 랭킹</small><strong>' + strong + '</strong></div><div class="three">' + three + '</div></div>';
  }

  function render() {
    if (!root) return;
    var view = DATA.view || {}, ch = DATA.ch, name = O.name || view.name || '';
    var show = !ch || ch.show !== false, st = ch && ch.state || null;
    var done = missionDoneToday(O.session && O.session.code, name, O.session && O.session.env);
    var todo = todoItems(view, done), left = todo.filter(function (x) { return !x.done; }).length;
    var nx = nextItem(ch), sk = streak(ch), star = ch && !ch.local && typeof ch.star === 'number' ? ch.star : null;

    var cls = (view.classes || []).filter(function (c) { return c.current; });
    var hw = [], tests = [];
    cls.forEach(function (c) {
      (c.hw || []).forEach(function (h) { if (!h.practice && !h.done) hw.push({ h: h, c: c }); });
      (c.tests || []).forEach(function (t) { tests.push({ t: t, c: c }); });
    });
    hw.sort(function (a, b) { return String(a.h.due || '9').localeCompare(String(b.h.due || '9')); });
    tests.sort(function (a, b) { return String(b.t.date || '').localeCompare(String(a.t.date || '')); });
    var overdue = hw.filter(function (x) { return x.h.overdue; }).length;

    var bar = '<div class="hm-bar"><div class="who"><div class="hello">' + todayTxt() + '</div><div class="name">' + esc(name) + '</div></div><div class="acts">' +
      (star !== null ? '<span class="coin" aria-label="별 ' + star + '"><i class="ic">' + ic('coin') + '</i><span class="num">' + star + '</span></span>' : '') +
      '<button class="gearb" type="button" data-open="settings" aria-label="설정">' + ic('gear') + '</button></div></div>';

    var sayTxt = left ? '오늘 할 일 <b class="num">' + left + '</b>개 남음' : '오늘 할 일 끝';
    var todoHtml = '<div class="todo"><small>오늘 할 일</small><div class="big"><span class="num">' + left + '</span><em>개 남음</em></div><ul>' +
      todo.slice(0, 3).map(function (x) {
        return '<li class="' + (x.done ? 'done' : (x === todo.filter(function (y) { return !y.done; })[0] ? 'now' : '')) + (x.late ? ' late' : '') + '" data-go="' + x.go + '"><i class="dot ' + (x.done ? 'done' : 'yet') + '">' +
          (x.done ? '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
          '</i><span>' + esc(x.label) + '</span><b>' + esc(x.sub) + '</b></li>';
      }).join('') + '</ul></div>';
    var hero = show
      ? '<div class="card hm-hero"><span class="say">' + sayTxt + '</span><button class="dress" type="button" data-open="closet">꾸미기</button><div class="ped"></div>' +
        '<button class="ch" type="button" data-open="closet" aria-label="내 몽글이 꾸미기">' + mg(st, 140, { expr: left ? 'base' : 'happy', anim: true }) + '</button></div>'
      : '<div class="card hm-hero off">' + todoHtml + '</div>';

    var mission = '<div class="card hm-mission"><div class="tile"><i class="ic">' + ic('house') + '</i></div><div class="tx"><small>오늘 할 일</small><strong>' + (done ? '퇴근 미션 마침' : '퇴근 미션') + '</strong></div>' +
      '<button class="go' + (done ? ' sub' : '') + '" type="button" data-go="quiz">' + (done ? '다시 보기' : '시작') + '</button></div>';

    var next = nx ? '<div class="card hm-next" data-open="closet" role="button" tabindex="0"><div class="rowx"><span>다음 아이템까지</span><b><span class="num">' + nx.left + '</span> 남음</b></div>' +
      '<div class="track"><div class="prog"><i style="width:' + Math.max(4, Math.round(nx.r * 100)) + '%"></i></div><i class="ic">' + ic('gift') + '</i></div>' +
      '<div class="cond">' + esc(nx.name) + (nx.it.cond ? ' · ' + esc(nx.it.cond) : '') + ' <span class="num">' + nx.it.progress.now + '/' + nx.it.progress.goal + '</span></div></div>' : '';

    var stats = (sk !== null || star !== null) ? '<div class="hm-stats">' +
      (sk !== null ? '<div class="card"><i class="ic">' + ic('flame') + '</i><div><small>연속 출석</small><b><span class="num">' + sk + '</span>일</b></div></div>' : '') +
      (star !== null ? '<div class="card"><i class="ic">' + ic('coin') + '</i><div><small>모은 별</small><b><span class="star">★</span> <span class="num">' + star + '</span></b></div></div>' : '') +
      '</div>' : '';

    var hwHtml = !hw.length ? '<div class="hm-empty">제출할 숙제가 없어요</div>' : hw.slice(0, 3).map(function (x) {
      return '<div class="tr' + (x.h.overdue ? ' late' : '') + '"><div class="t"><b>' + esc(x.h.label) + '</b><small>' + esc(x.c.kind || '') + '</small></div><span class="bdg ' + (x.h.overdue ? 'no' : 'yet') + '">' + (x.h.overdue ? '마감 지남' : (x.h.due ? esc(due(x.h.due)) + '까지' : '제출 전')) + '</span></div>';
    }).join('') + (hw.length > 3 ? '<div class="hm-more">외 ' + (hw.length - 3) + '개</div>' : '');
    var tHtml = !tests.length ? '<div class="hm-empty">아직 본 테스트가 없어요</div>' : tests.slice(0, 2).map(function (x) {
      var t = x.t, has = !(t.score === null || t.score === undefined || t.score === '');
      return '<div class="tr"><div class="t"><b>' + esc(t.label) + '</b><small>' + esc(t.date ? due(t.date) : '') + '</small></div><span class="sc">' +
        (has ? '<span class="num">' + esc(t.score) + '</span><em> / ' + esc(t.total) + '</em>' + (t.total ? '<small class="num">' + pct(+t.score, +t.total) + '%</small>' : '') : '<em>—</em>') + '</span></div>';
    }).join('');

    root.innerHTML = '<div class="hm-in">' + bar +
      '<div class="hm-cols"><div class="hm-a">' + hero + mission + next + stats + '</div>' +
      '<div class="hm-b"><div class="hm-rk-slot">' + rankCard() + '</div>' +
        '<section class="card hm-list"><div class="hd"><strong>숙제</strong>' + (overdue ? '<span class="bdg no">마감 지남 ' + overdue + '</span>' : '') + '<button class="more" data-go="grades" type="button">더 보기</button></div>' + hwHtml + '</section>' +
        '<section class="card hm-list"><div class="hd"><strong>최근 테스트</strong><button class="more" data-go="grades" type="button">더 보기</button></div>' + tHtml + '</section>' +
      '</div></div></div>';
  }
  function act(e) {
    var o = e.target.closest && e.target.closest('[data-open],[data-go]'); if (!o || !root || !root.contains(o)) return;
    var sc = o.getAttribute('data-open'), tab = o.getAttribute('data-go');
    if (sc) { if (O.open) O.open(sc); else if (O.go) O.go(sc === 'rank' ? 'quiz' : 'home'); }
    else if (tab && O.go) O.go(tab);
  }
  function onKey(e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-open]')) { e.preventDefault(); act(e); } }
  function onChar(e) { if (DATA.ch && e.detail) { DATA.ch.state = e.detail.state || DATA.ch.state; DATA.ch.show = e.detail.show; } render(); }

  function mount(rootEl, o) {
    unmount(); root = rootEl; gen++; var g = gen; O = o || {}; DATA = { view: null, ch: null, rk: undefined };
    root.classList.add('home', 'hub-ui');
    root.innerHTML = '<div class="hm-load"><span class="hm-spin" aria-hidden="true"></span><span>불러오는 중</span></div>';
    root.addEventListener('click', act); root.addEventListener('keydown', onKey);
    window.addEventListener('hub:char', onChar);
    var S = O.session;
    Promise.all([S.view(), S.char ? S.char() : Promise.resolve({ ok: true, data: null })]).then(function (rs) {
      if (g !== gen) return;
      var r = rs[0];
      if (!r.ok) { root.innerHTML = '<div class="hm-err"><p>' + esc(r.error || '불러오지 못했어요.') + '</p><button class="go" type="button" data-retry>다시 불러오기</button></div>'; var b = root.querySelector('[data-retry]'); if (b) b.onclick = function () { mount(rootEl, o); }; return; }
      DATA.view = r.data; DATA.ch = rs[1] && rs[1].data || null; render();
      rankLoad(S.apiUrl).then(function (d) { if (g !== gen) return; DATA.rk = d; var s = root.querySelector('.hm-rk-slot'); if (s) s.innerHTML = rankCard(); });
    });
  }
  /** 다시 그리기 (허브가 홈 탭으로 돌아올 때 — 오늘 미션 마침 여부 갱신) */
  function refresh() { if (root && DATA.view) render(); }
  function unmount() {
    gen++;
    if (root) { root.removeEventListener('click', act); root.removeEventListener('keydown', onKey); root.innerHTML = ''; root.classList.remove('home', 'hub-ui'); }
    window.removeEventListener('hub:char', onChar); root = null;
  }
  window.HubHome = { mount: mount, unmount: unmount, refresh: refresh, _mg: mg, _initial: initial };
})();
