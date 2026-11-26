/* 설정 — 시안 sian-final ⑨: 캐릭터 보기 켜기/끄기(서버 show 저장) · 화면 테마(자동·라이트·다크) · 나가기.
 *   HubSettings.mount(rootEl, { session, back(), leave(), theme:{ get()→'auto'|'light'|'dark', set(pref) } })
 *   theme 은 허브(index.html 의 HubTheme)가 넘겨 줌 — 없으면 window.HubTheme. CSS 는 settings.css (.settings 아래). */
(function () {
  'use strict';
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n) { return window.HubIcons ? HubIcons.ic(n) : ''; }
  function initial(nm) { nm = String(nm || '').trim(); return nm.length >= 3 && /^[가-힣]+$/.test(nm) ? nm.charAt(1) : nm.charAt(0) || '?'; }
  function av(state, size, show, ini) {
    if (window.HubMongle && HubMongle.avatar) return HubMongle.avatar(state, size, { show: show, initial: ini });
    if (show === false) return '<span class="hub-ini" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.44) + 'px">' + esc(ini) + '</span>';
    return '<span class="hub-mg-empty" style="width:' + size + 'px;height:' + size + 'px"></span>';
  }
  var TH = [['auto', '자동'], ['light', '라이트'], ['dark', '다크']];
  var root = null, O = {}, gen = 0, CH = null, VIEW = null, busy = false;
  function theme() { return O.theme || window.HubTheme || { get: function () { return 'auto'; }, set: function () {} }; }

  function render() {
    var show = CH.show !== false, st = CH.state, name = (O.session && O.session.name) || (VIEW && VIEW.name) || '', ini = initial(name);
    var kinds = ((VIEW && VIEW.classes) || []).filter(function (c) { return c.current; }).map(function (c) { return c.kind; }).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
    var pref = theme().get();
    root.innerHTML = '<div class="st-in">' +
      '<div class="st-bar"><button class="gearb ink" type="button" data-back aria-label="뒤로">' + ic('back') + '</button><h1 class="ttl">설정</h1><span style="width:36px"></span></div>' +
      '<div class="card st-me"><div class="ch">' + av(st, 50, show, ini) + '</div><div class="tx"><b>' + esc(name) + '</b><small>' + esc(kinds.join(' · ')) + '</small></div>' +
        '<button class="go sub" type="button" data-closet>꾸미기</button></div>' +
      '<div class="st-h">화면</div>' +
      '<div class="card st-c">' +
        '<div class="srow tall"><div class="tx"><b id="st-ch-l">캐릭터 보기</b><small>캐릭터를 끄면 화면이 더 간결해져요.<br>모은 아이템은 그대로 남아요.</small></div>' +
          '<button type="button" class="sw" role="switch" aria-checked="' + show + '" aria-labelledby="st-ch-l" data-char' + (busy ? ' disabled' : '') + '></button></div>' +
        '<div class="srow"><div class="tx"><b id="st-th-l">화면 테마</b><small>밤에는 다크가 눈이 편해요</small></div>' +
          '<div class="seg3" role="group" aria-labelledby="st-th-l">' + TH.map(function (t) { return '<button type="button" data-th="' + t[0] + '" aria-pressed="' + (pref === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '</div>' +
      '<div class="st-h">미리 보기</div>' +
      '<div class="card st-pv"><div class="' + (show ? 'on' : '') + '"><div class="ch">' + av(st, 42, true, ini) + '</div><div><b>켬</b><small>꾸민 몽글이</small></div></div>' +
        '<div class="' + (show ? '' : 'on') + '"><div class="ch">' + av(st, 42, false, ini) + '</div><div><b>끔</b><small>이니셜만</small></div></div></div>' +
      (CH.local ? '<p class="st-note">캐릭터 설정은 지금 이 기기에만 기억해요.</p>' : '') +
      '<div class="st-h">계정</div>' +
      '<div class="card st-c"><button type="button" class="srow out" data-leave><div class="tx"><b>나가기</b><small>이 기기에 기억한 번호도 지워요</small></div><span class="arr" aria-hidden="true">›</span></button></div>' +
      '<p class="st-err" role="alert"></p></div>';
  }
  function err(m) { var e = root && root.querySelector('.st-err'); if (e) e.textContent = m || ''; }
  function onClick(e) {
    var t = e.target.closest && e.target.closest('button'); if (!t || !root || !root.contains(t)) return;
    if (t.hasAttribute('data-back')) { if (O.back) O.back(); return; }
    if (t.hasAttribute('data-closet')) { if (O.open) O.open('closet'); return; }
    if (t.hasAttribute('data-leave')) { if (O.leave) O.leave(); return; }
    if (t.dataset.th) { theme().set(t.dataset.th); root.querySelectorAll('[data-th]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); }); return; }
    if (t.hasAttribute('data-char')) {
      if (busy) return;
      var next = CH.show === false; busy = true; CH.show = next; render(); err('');
      var g = gen;
      O.session.setChar(null, next).then(function (r) {
        if (g !== gen) return; busy = false;
        if (!r || !r.ok) { CH.show = !next; err((r && r.error) || '저장하지 못했어요. 다시 눌러 주세요.'); }
        render(); if (!r || !r.ok) err((r && r.error) || '저장하지 못했어요. 다시 눌러 주세요.');
      });
    }
  }
  function onTheme() { if (!root) return; var p = theme().get(); root.querySelectorAll('[data-th]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.th === p)); }); }
  function mount(rootEl, o) {
    unmount(); root = rootEl; O = o || {}; gen++; var g = gen; busy = false;
    root.classList.add('settings', 'hub-ui');
    root.innerHTML = '<div class="st-load"><span class="st-spin" aria-hidden="true"></span>불러오는 중</div>';
    root.addEventListener('click', onClick); window.addEventListener('hub:theme', onTheme);
    Promise.all([O.session.char(), O.session.view ? O.session.view() : Promise.resolve({})]).then(function (rs) {
      if (g !== gen) return;
      CH = rs[0].data; VIEW = rs[1] && rs[1].ok ? rs[1].data : null; render();
    });
  }
  function unmount() {
    gen++; if (root) { root.removeEventListener('click', onClick); root.innerHTML = ''; root.classList.remove('settings', 'hub-ui'); }
    window.removeEventListener('hub:theme', onTheme); root = null;
  }
  window.HubSettings = { mount: mount, unmount: unmount };
})();
