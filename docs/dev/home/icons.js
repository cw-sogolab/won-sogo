/* 허브 3D 아이콘 (시안 sian-final 「3D 아이콘 세트」·「탭 아이콘」 그대로) — 허브 틀·홈·꾸미기·설정이 같이 씀.
 *   HubIcons.mount()          그라데이션·필터 defs 를 문서에 한 번 넣음 (id 는 모두 hi- 접두어 — 몽글이·마스코트 defs 와 안 겹침)
 *   HubIcons.ic(name)         → SVG 문자열. name = coin | flame | gift | lock | check | house | gear | back
 *   HubIcons.tab(name, on)    → 탭 아이콘 SVG. name = home | mission | note | class | ask
 * 그림 안 색은 시안의 점토 아이콘 색 그대로(테마와 상관없이 같은 물체). 글자색이 필요한 선 아이콘(gear·back)은 currentColor. */
(function () {
  'use strict';
  if (window.HubIcons) return;
  function lin(id, a, b) { return '<linearGradient id="hi-' + id + '" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>'; }
  function clayT() {
    // 시안 clay('fInT', '#2B1F6B', 0.28, 1.2, 1, 1.5, 0.55) — 작은 아이콘용 안쪽 그림자 + 안쪽 빛
    return '<filter id="hi-fInT" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b"/>' +
      '<feOffset in="b" dx="-1" dy="-1.5" result="o1"/><feComposite in="SourceAlpha" in2="o1" operator="out" result="m1"/>' +
      '<feFlood flood-color="#2B1F6B" flood-opacity=".28" result="f1"/><feComposite in="f1" in2="m1" operator="in" result="s1"/>' +
      '<feOffset in="b" dx=".6" dy=".9" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="m2"/>' +
      '<feFlood flood-color="#ffffff" flood-opacity=".55" result="f2"/><feComposite in="f2" in2="m2" operator="in" result="s2"/>' +
      '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="s1"/><feMergeNode in="s2"/></feMerge></filter>';
  }
  function defs() {
    return lin('gGold', '#FFEE9C', '#FFB81F') + lin('gGoldD', '#FFCB42', '#EE9A00') + lin('gBlue', '#8E9CFF', '#4756F2') +
      lin('gCoral', '#FFA796', '#F0604F') + lin('gCream', '#FFFFFF', '#E4DEF5') + lin('gPink', '#FFB3CC', '#F45C92') +
      lin('gMint', '#9DF3D0', '#2CC08A') + lin('gSilver', '#FBFAFF', '#AFA9C9') + lin('gFlame', '#FFC052', '#FF5A3C') +
      lin('gLock', '#C9C3E6', '#8580A6') + lin('gT', '#A3A1FF', '#4F4FF2') + lin('gTOff', '#E2DFEE', '#B3AFCA') + clayT();
  }
  function mount() {
    if (document.getElementById('hub-icon-defs')) return;
    var d = document.createElement('div');
    d.innerHTML = '<svg id="hub-icon-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + defs() + '</defs></svg>';
    (document.body || document.documentElement).insertBefore(d.firstChild, (document.body || document.documentElement).firstChild);
  }
  function starPath(cx, cy, R, r) {
    var d = '', i, a, rr;
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  }
  var ISH = '<ellipse cx="12" cy="22.4" rx="7" ry="1.3" fill="#2B1F6B" opacity=".16"/>';
  function ihl(x, y, rot, op) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="2.9" ry="1.4" fill="#fff" opacity="' + (op || 0.6) + '" transform="rotate(' + rot + ' ' + x + ' ' + y + ')"/>'; }
  var IC = {
    coin: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ISH + '<circle cx="12" cy="12.6" r="9.4" fill="#D98C00"/><circle cx="12" cy="11.2" r="9.4" fill="url(#hi-gGold)" filter="url(#hi-fInT)"/><circle cx="12" cy="11.2" r="6.9" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/><path d="' + starPath(12, 12, 4.8, 2.3) + '" fill="#E39A0A" stroke="#E39A0A" stroke-width="1.1" stroke-linejoin="round" opacity=".5"/><path d="' + starPath(12, 11.4, 4.8, 2.3) + '" fill="#FFF8DA" stroke="#FFF8DA" stroke-width="1.1" stroke-linejoin="round"/>' + ihl(7.6, 6.4, -32, 0.7) + '</svg>'; },
    flame: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ISH + '<path d="M12 2.2C13 6 19 8.4 19 14.4A7 7 0 0 1 5 14.4C5 11.4 7 10 8 8C9 10 10.5 10 10.5 8.5C10.5 6 11 4.2 12 2.2Z" fill="url(#hi-gFlame)" filter="url(#hi-fInT)"/><path d="M12 12C13 14 15 14.5 15 17A3 3 0 0 1 9 17C9 15 11 14 12 12Z" fill="#FFE98A"/>' + ihl(8.6, 11.6, -62, 0.55) + '</svg>'; },
    gift: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ISH + '<rect x="4.6" y="11" width="14.8" height="10.2" rx="3" fill="#D63F78"/><rect x="4.6" y="10.4" width="14.8" height="10.2" rx="3" fill="url(#hi-gPink)" filter="url(#hi-fInT)"/><rect x="3.4" y="7.4" width="17.2" height="5.4" rx="2.6" fill="url(#hi-gPink)" filter="url(#hi-fInT)"/><rect x="10.6" y="7.4" width="2.8" height="13.2" fill="url(#hi-gGold)"/><ellipse cx="9.1" cy="5.7" rx="3.2" ry="2" fill="url(#hi-gGold)" filter="url(#hi-fInT)" transform="rotate(24 9.1 5.7)"/><ellipse cx="14.9" cy="5.7" rx="3.2" ry="2" fill="url(#hi-gGold)" filter="url(#hi-fInT)" transform="rotate(-24 14.9 5.7)"/><circle cx="12" cy="7" r="1.7" fill="url(#hi-gGoldD)"/>' + ihl(6.6, 9, -10, 0.65) + '</svg>'; },
    lock: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ISH + '<path d="M8 11V8.6a4 4 0 0 1 8 0V11" fill="none" stroke="#8C86AB" stroke-width="3" stroke-linecap="round"/><path d="M8 11V8.6a4 4 0 0 1 8 0V11" fill="none" stroke="url(#hi-gSilver)" stroke-width="1.9" stroke-linecap="round"/><rect x="5" y="11.2" width="14" height="10.2" rx="3.6" fill="#77719A"/><rect x="5" y="10.4" width="14" height="10.2" rx="3.6" fill="url(#hi-gLock)" filter="url(#hi-fInT)"/><circle cx="12" cy="14.6" r="1.7" fill="#4E4870"/><rect x="11.2" y="15" width="1.6" height="3" rx=".8" fill="#4E4870"/>' + ihl(8.2, 12.6, -10, 0.6) + '</svg>'; },
    check: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.2" r="10" fill="#17966A"/><circle cx="12" cy="11.6" r="10" fill="url(#hi-gMint)" filter="url(#hi-fInT)"/><path d="M7.4 11.8l3.2 3.2 6-6.4" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' + ihl(7.8, 6.4, -32, 0.6) + '</svg>'; },
    house: function () { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ISH + '<rect x="5.5" y="10.6" width="13" height="10.8" rx="3" fill="#C9C1E2"/><rect x="5.5" y="10" width="13" height="10.8" rx="3" fill="url(#hi-gCream)" filter="url(#hi-fInT)"/><path d="M4 11.2L12 4.2L20 11.2Z" fill="url(#hi-gCoral)" stroke="url(#hi-gCoral)" stroke-width="2.6" stroke-linejoin="round" filter="url(#hi-fInT)"/><rect x="10.2" y="14.2" width="3.6" height="6.6" rx="1.5" fill="url(#hi-gBlue)"/>' + ihl(8.8, 8, -40, 0.6) + '</svg>'; },
    gear: function () { return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.6 1.8h2.8l.4 2.2 1.5.7 1.9-1.2 2 2-1.2 1.9.7 1.5 2.2.4v2.8l-2.2.4-.7 1.5 1.2 1.9-2 2-1.9-1.2-1.5.7-.4 2.2H8.6l-.4-2.2-1.5-.7-1.9 1.2-2-2 1.2-1.9-.7-1.5-2.2-.4V8.6l2.2-.4.7-1.5-1.2-1.9 2-2 1.9 1.2 1.5-.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'; },
    back: function () { return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M13 4L7 10l6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  };
  var TAB = {
    home: { s: function (f) { return '<path d="M4.4 11.2L12 4.6L19.6 11.2V18A2.6 2.6 0 0 1 17 20.6H7A2.6 2.6 0 0 1 4.4 18Z" fill="' + f + '" stroke="' + f + '" stroke-width="1.6" stroke-linejoin="round"/>'; },
      g: '<rect x="10.2" y="14" width="3.6" height="6.6" rx="1.6" fill="#fff" opacity=".92"/>', h: [8.6, 9.6, -40] },
    mission: { s: function (f) { return '<path d="M5.6 20.6V9.4A6.4 6.4 0 0 1 18.4 9.4V20.6Z" fill="' + f + '" stroke="' + f + '" stroke-width="1.4" stroke-linejoin="round"/>'; },
      g: '<path d="M8.6 20.6V10A3.4 3.4 0 0 1 15.4 10V20.6Z" fill="#fff" opacity=".3"/><circle cx="13.9" cy="15.2" r="1.3" fill="#fff"/>', h: [8.4, 7.4, -45] },
    note: { s: function (f) { return '<rect x="4.2" y="3.4" width="15.6" height="17.2" rx="4" fill="' + f + '"/>'; },
      g: '<path d="M8.4 16.4v-3M12 16.4v-7.4M15.6 16.4v-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>', h: [7.8, 6.2, -30] },
    class: { s: function (f) { return '<path d="M3.5 6.2C6.5 4.8 9.5 5 12 6.6C14.5 5 17.5 4.8 20.5 6.2V18.6C17.5 17.4 14.5 17.6 12 19.2C9.5 17.6 6.5 17.4 3.5 18.6Z" fill="' + f + '" stroke="' + f + '" stroke-width="1.6" stroke-linejoin="round"/>'; },
      g: '<path d="M12 7.6v10.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>', h: [7.2, 7.6, -10] },
    ask: { s: function (f) { return '<path d="M12 3.2c5 0 9 3.5 9 7.9s-4 7.9-9 7.9c-1 0-2-.1-2.9-.4L5 20.8l.9-3.8C4.1 15.6 3 13.5 3 11.1c0-4.4 4-7.9 9-7.9z" fill="' + f + '"/>'; },
      g: '<path d="M9.8 9.4a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.8-1.1 1.6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="15.6" r="1.1" fill="#fff"/>', h: [7.6, 7, -28] }
  };
  function tab(name, on) {
    var t = TAB[name] || TAB.ask;
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="22.6" rx="7" ry="1.2" fill="#2B1F6B" opacity="' + (on ? '.2' : '.1') + '"/>' +
      '<g transform="translate(0 1.2)">' + t.s(on ? '#3434C2' : '#A5A1BE') + '</g>' +
      '<g filter="url(#hi-fInT)">' + t.s(on ? 'url(#hi-gT)' : 'url(#hi-gTOff)') + '</g>' + t.g + ihl(t.h[0], t.h[1], t.h[2], on ? 0.5 : 0.7) + '</svg>';
  }
  window.HubIcons = { mount: mount, ic: function (n) { return IC[n] ? IC[n]() : ''; }, tab: tab };
})();
