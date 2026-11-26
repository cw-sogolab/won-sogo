/* 꾸미기 — 시안 sian-final ⑥: 미리 보기 · 색/모자/안경/키링 · 전체·희귀·힙 · 잠긴 아이템은 자물쇠+조건(+진행도).
 *   HubCloset.mount(rootEl, { session, back() })   back: 뒤로 가기(허브가 홈으로 돌려 줌)
 *   가진 아이템을 누르면 바로 입고(HubMongle.pop) 서버에 저장(HubSession.setChar — 빠르게 여러 번 누르면 마지막 것만 한 번).
 *   잠긴 아이템은 입지 않고 조건만 알려 줌(서버도 「아직 얻지 못한 아이템이에요」로 막음). CSS 는 closet.css (.closet 아래). */
(function () {
  'use strict';
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n) { return window.HubIcons ? HubIcons.ic(n) : ''; }
  var KINDS = [['body', '색'], ['hat', '모자'], ['glasses', '안경'], ['charm', '키링']];
  var GRADE = { rare: '희귀', hip: '힙' };
  var BODYVAR = { lavender: '--lav', peach: '--peach', mint: '--mint', sky: '--sky', butter: '--butter' };

  var root = null, O = {}, gen = 0, CH = null, tab = 'hat', gf = '', st = null, saved = null, tSave = 0, tToast = 0, tMood = 0, expr = 'base', pending = false;

  function names() { var m = {}; (window.HubSession && HubSession.items ? HubSession.items() : []).forEach(function (x) { m[x.kind + ':' + x.id] = x; }); return m; }
  function art(kind, id) {
    if (window.HubMongle && HubMongle.icon) return HubMongle.icon(kind, id, 0);
    if (window.HubMongle && HubMongle.svg && kind === 'body') return HubMongle.svg({ body: id }, 0, { anim: false, shadow: false });
    return '<span class="cl-noart" aria-hidden="true"></span>';
  }
  function preview() {
    var show = CH.show !== false;
    if (!window.HubMongle || !HubMongle.svg) return '<span class="hub-mg-empty" style="width:162px;height:162px"></span>';
    return HubMongle.svg(st, 0, { expr: expr, anim: true, label: show ? '내 몽글이' : '내 몽글이 (다른 화면에서는 꺼 둠)' });
  }
  function drawPv() {
    var pv = root.querySelector('.cl-pv'); if (!pv) return;
    pv.style.setProperty('--pvc', 'var(' + (BODYVAR[st.body] || '--lav') + ')');
    pv.querySelector('.ch').innerHTML = preview();
  }
  function itemsFor(kind) {
    var N = names(), list = (CH.items || []).filter(function (it) { return it.kind === kind; });
    if (!list.length) list = (window.HubSession ? HubSession.items() : []).filter(function (x) { return x.kind === kind; }).map(function (x) { return { id: x.id, kind: x.kind, grade: x.grade, owned: x.grade === 'basic', cond: '' }; });
    return list.map(function (it) { var n = N[it.kind + ':' + it.id] || {}; return Object.assign({}, it, { name: n.name || it.name || it.id, grade: it.grade || n.grade || 'basic' }); });
  }
  function drawGrid() {
    var list = itemsFor(tab).filter(function (x) { return !gf || x.grade === gf; });
    var g = root.querySelector('.cl-grid');
    g.innerHTML = list.length ? list.map(function (x) {
      var lock = !x.owned, on = st[tab] === x.id, gr = GRADE[x.grade] ? x.grade : '', p = x.progress;
      var cond = lock ? (x.cond ? esc(x.cond) : '아직 잠겨 있어요') + (p && p.goal ? ' <span class="num">' + p.now + '/' + p.goal + '</span>' : '') : '';
      return '<button type="button" class="it' + (on ? ' on' : '') + (lock ? ' lock' : '') + (gr ? ' ' + gr : '') + '" data-k="' + esc(x.id) + '" aria-pressed="' + on + '"' +
        ' aria-label="' + esc(x.name) + (gr ? ' (' + GRADE[gr] + ')' : '') + (lock ? ' — 잠김: ' + esc(x.cond || '') : on ? ' — 입는 중' : '') + '">' +
        (gr ? '<i class="gt">' + GRADE[gr] + '</i>' : '') +
        (lock ? '<i class="ic lk">' + ic('lock') + '</i>' : (on ? '<i class="ic ck">' + ic('check') + '</i>' : '')) +
        '<span class="art">' + art(tab, x.id) + '</span><span class="nm">' + esc(x.name) + '</span>' +
        (lock ? '<em>' + cond + '</em>' + (p && p.goal ? '<span class="pg"><i style="width:' + Math.min(100, Math.round(p.now / p.goal * 100)) + '%"></i></span>' : '') : '') + '</button>';
    }).join('') : '<p class="empty">이 칸에는 ' + (GRADE[gf] || '') + ' 아이템이 아직 없어요</p>';
  }
  function drawCtl() {
    root.querySelectorAll('.cl-seg button').forEach(function (b) { var on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    root.querySelectorAll('.cl-gfil button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.g === gf)); });
  }
  function toast(msg) {
    var t = root.querySelector('.cl-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); clearTimeout(tToast); tToast = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function save() {
    clearTimeout(tSave); pending = true;
    tSave = setTimeout(function () {
      pending = false;
      var want = Object.assign({}, st), g = gen;
      O.session.setChar(want).then(function (r) {
        if (g !== gen) return;
        if (r && r.ok) { saved = Object.assign({}, (r.data && r.data.state) || want); return; }
        toast((r && r.error) || '저장하지 못했어요. 다시 눌러 주세요.');
        st = Object.assign({}, saved); drawPv(); drawGrid();
      });
    }, 500);
  }
  function wear(btn) {
    var k = btn.dataset.k, x = itemsFor(tab).filter(function (i) { return i.id === k; })[0]; if (!x) return;
    if (!x.owned) {
      btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
      toast('아직 얻지 못한 아이템이에요' + (x.cond ? ' · ' + x.cond : ''));
      return;
    }
    if (st[tab] === k) return;
    st[tab] = k; expr = 'happy'; drawPv(); drawGrid();
    var nb = root.querySelector('.cl-grid .it[data-k="' + k + '"]'); if (nb) nb.classList.add('boing');
    if (window.HubMongle && HubMongle.pop) HubMongle.pop(root.querySelector('.cl-pv .ch'), k === 'none' || tab === 'body' ? '' : tab);
    clearTimeout(tMood); tMood = setTimeout(function () { if (!root) return; expr = 'base'; drawPv(); }, 1300);
    save();
  }
  function onClick(e) {
    var t = e.target.closest && e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.back !== undefined) { if (O.back) O.back(); return; }
    if (t.dataset.tab) { tab = t.dataset.tab; drawCtl(); drawGrid(); return; }
    if (t.dataset.g !== undefined) { gf = t.dataset.g; drawCtl(); drawGrid(); return; }
    if (t.classList.contains('it')) wear(t);
  }
  function onChar(e) { if (!CH || !e.detail) return; CH.show = e.detail.show; render(); }
  function render() {
    var show = CH.show !== false;
    root.innerHTML = '<div class="cl-in">' +
      '<div class="cl-bar"><button class="gearb ink" type="button" data-back aria-label="뒤로">' + ic('back') + '</button><h1 class="ttl">꾸미기</h1>' +
        (!CH.local && typeof CH.star === 'number' ? '<span class="coin" aria-label="별 ' + CH.star + '"><i class="ic">' + ic('coin') + '</i><span class="num">' + CH.star + '</span></span>' : '<span style="width:36px"></span>') + '</div>' +
      '<div class="cl-cols"><div class="cl-left"><div class="cl-pv card"><span class="hint' + (show ? '' : ' off') + '">' + (show ? '미리 보기' : '캐릭터 끔 · 여기서만 보여요') + '</span><div class="ped"></div><div class="ch"></div></div>' +
        (CH.local ? '<p class="cl-note">지금은 기본 아이템만 입을 수 있어요. 고른 것은 이 기기에 기억해요.</p>' : '') + '</div>' +
      '<div class="cl-right"><div class="cl-seg">' + KINDS.map(function (k) { return '<button type="button" data-tab="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        '<div class="cl-gfil"><button type="button" data-g="">전체</button><button type="button" class="g-rare" data-g="rare"><i></i>희귀</button><button type="button" class="g-hip" data-g="hip"><i></i>힙</button><span class="why">희귀 = 성적으로<br>힙 = 성실하게</span></div>' +
        '<div class="cl-grid"></div></div></div>' +
      '<div class="cl-toast" role="status" aria-live="polite"></div></div>';
    drawPv(); drawCtl(); drawGrid();
  }
  function mount(rootEl, o) {
    unmount(); root = rootEl; O = o || {}; gen++; var g = gen;
    root.classList.add('closet', 'hub-ui');
    root.innerHTML = '<div class="cl-load"><span class="cl-spin" aria-hidden="true"></span>불러오는 중</div>';
    root.addEventListener('click', onClick); window.addEventListener('hub:char', onChar);
    O.session.char().then(function (r) {
      if (g !== gen) return;
      CH = r.data; st = Object.assign({ body: 'lavender', hat: 'none', glasses: 'none', charm: 'none' }, CH.state || {}); saved = Object.assign({}, st);
      render();
    });
  }
  function unmount() {
    gen++; clearTimeout(tSave); clearTimeout(tToast); clearTimeout(tMood);
    if (pending && st && O.session) { pending = false; O.session.setChar(Object.assign({}, st)); }   // 나가기 직전에 고른 것도 저장
    if (root) { root.removeEventListener('click', onClick); root.innerHTML = ''; root.classList.remove('closet', 'hub-ui'); }
    window.removeEventListener('hub:char', onChar); root = null;
  }
  window.HubCloset = { mount: mount, unmount: unmount };
})();
