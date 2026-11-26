/* 몽글이 캐릭터 라이브러리 — window.HubMongle (docs/dev/DESIGN.md 2번)
 * 기준 그림: docs/dev/v2/sian-final.html 의 charSVG(B 3D 클레이). 전역은 HubMongle 하나만 만든다.
 *
 *   HubMongle.svg(state, size, opts)    → SVG 문자열
 *       state = {body, hat, glasses, charm}  (없거나 모르는 값이면 기본: lavender·none·none·none)
 *       size  = 가로·세로 px(정사각형). 0·없음이면 width:100% (부모 폭을 따름)
 *       opts  = {expr:'base'|'happy'|'wow', anim:bool, shadow:bool(기본 true), label:'읽어 줄 이름', standalone:bool}
 *               anim 을 안 주면 64px 이상(또는 100%)만 움직임. standalone:true 면 공용 defs 까지 SVG 안에 넣음(그림 파일·shadow DOM 용).
 *   HubMongle.avatar(state, size, opts) → opts.show===false 면 opts.initial 첫 글자 동그라미(토큰 --pt), 아니면 그림자 없는 svg
 *   HubMongle.items                     → [{id, kind, grade, name}] (DESIGN.md 표 순서, 고정)
 *   HubMongle.pop(el[, part])           → el 안 캐릭터 「쏙」+반짝이. part='hat'|'glasses'|'charm' 이면 그 부품이 떨어지듯 들어옴. reduced-motion 이면 아무것도 안 함
 *   HubMongle.mount()                   → <style id="hm-style"> + <svg id="hm-defs"> 를 한 번만 넣음(svg()가 알아서 부름)
 *   HubMongle.icon(kind, id, size)      → (덤) 꾸미기 칸용 아이템만 그린 정사각 SVG 문자열
 *
 * 크기별 품질: 96px 이상 = 점토 결·반사광·흐린 그림자(무거운 필터) · 44~95px = 가벼운 안쪽 그림자만 · 43px 이하 = 필터 없음 + 눈·안경·키링 크게.
 * id 충돌: 공용 그라데이션·필터는 「hm-」, 캐릭터마다 필요한 clipPath·mask 는 「hm<번호>-」 접두어.
 * 3D 렌더 PNG 로 바꿀 때: 층 순서(몸 → 얼굴 → 안경 → 모자 → 키링)를 hm-l-* 그룹으로 나눠 두었으니 이 파일 안에서만 <image> 층으로 바꾼다.
 */
(function (W) {
  'use strict';
  if (!W || W.HubMongle) return;

  var hasDOM = typeof document !== 'undefined' && !!document.createElement;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var P = 'hm-';
  var seq = 0;

  function fx(n) { return +(+n).toFixed(2); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }
  function num(n) { n = +n; return isFinite(n) && n > 0 ? Math.round(n) : 0; }

  /* ════ 0. 아이템 표 (DESIGN.md 와 같은 순서·이름) ════ */
  var ITEMS = [
    ['lavender', 'body', 'basic', '라벤더'], ['peach', 'body', 'basic', '피치'], ['mint', 'body', 'hip', '민트'], ['sky', 'body', 'hip', '스카이'], ['butter', 'body', 'rare', '버터'],
    ['none', 'hat', 'basic', '없음'], ['cap', 'hat', 'basic', '캡'], ['beanie', 'hat', 'hip', '비니'], ['headphone', 'hat', 'hip', '헤드폰'], ['hood', 'hat', 'hip', '후드'], ['bucket', 'hat', 'hip', '버킷햇'], ['crown', 'hat', 'rare', '왕관'],
    ['none', 'glasses', 'basic', '없음'], ['round', 'glasses', 'basic', '동글 안경'], ['sun', 'glasses', 'hip', '선글라스'], ['square', 'glasses', 'hip', '네모 안경'], ['star', 'glasses', 'rare', '별 안경'],
    ['none', 'charm', 'basic', '없음'], ['star', 'charm', 'basic', '별 키링'], ['heart', 'charm', 'hip', '하트'], ['bolt', 'charm', 'hip', '번개'], ['chain', 'charm', 'hip', '체인'], ['fuji', 'charm', 'rare', '후지산'], ['sakura', 'charm', 'rare', '벚꽃']
  ].map(function (r) { return Object.freeze({ id: r[0], kind: r[1], grade: r[2], name: r[3] }); });
  Object.freeze(ITEMS);

  var VALID = { body: {}, hat: {}, glasses: {}, charm: {} };
  ITEMS.forEach(function (it) { VALID[it.kind][it.id] = it; });
  var DEF = { body: 'lavender', hat: 'none', glasses: 'none', charm: 'none' };
  /* 시안에서 쓰던 옛 이름도 받아 줌 */
  var ALIAS = { body: { lav: 'lavender' }, hat: { headphones: 'headphone' }, glasses: { shade: 'sun' }, charm: {} };

  function norm(st) {
    st = st && typeof st === 'object' ? st : {};
    function pick(kind, v) {
      v = v == null ? '' : String(v);
      if (Object.prototype.hasOwnProperty.call(ALIAS[kind], v)) v = ALIAS[kind][v];
      return Object.prototype.hasOwnProperty.call(VALID[kind], v) ? v : DEF[kind];
    }
    return {
      body: pick('body', pick('body', st.body) !== DEF.body || st.color == null ? st.body : st.color),
      hat: pick('hat', st.hat), glasses: pick('glasses', st.glasses), charm: pick('charm', st.charm)
    };
  }

  /* ════ 1. 색 ════ */
  var COL = {
    lavender: { hi: '#F1EDFF', mid: '#BDAEFF', lo: '#8C78F0', sh: '#4B36B8', rim: '#E2F1FF' },
    peach:    { hi: '#FFF0E7', mid: '#FFBFA3', lo: '#FF8E6E', sh: '#C9502A', rim: '#FFF4D9' },
    mint:     { hi: '#E9FEF5', mid: '#A3ECCF', lo: '#5ECFA4', sh: '#178A63', rim: '#E2F4FF' },
    sky:      { hi: '#E9F6FF', mid: '#ABD9FF', lo: '#6FB2F3', sh: '#2A6DBC', rim: '#F1EAFF' },
    butter:   { hi: '#FFFCE6', mid: '#FFE582', lo: '#FFC83C', sh: '#B87A00', rim: '#FFF3E6' }
  };

  /* 그림 안 id 표기: 「#@x」 = 공용(hm-x), 「#$x」 = 이 캐릭터만(hm<번호>-x). 마지막에 finish()가 바꿈 */
  function lin(id, a, b) { return '<linearGradient id="@' + id + '" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>'; }
  function rad(id, a, b, c) { return '<radialGradient id="@' + id + '" cx=".34" cy=".26" r=".9"><stop offset="0" stop-color="' + a + '"/><stop offset=".42" stop-color="' + b + '"/><stop offset="1" stop-color="' + c + '"/></radialGradient>'; }
  function fade(id, col, op) { return '<radialGradient id="@' + id + '"><stop offset="0" stop-color="' + col + '" stop-opacity="' + op + '"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient>'; }
  function stops(id, list, xy) {
    return '<linearGradient id="@' + id + '" ' + (xy || 'x1="0" y1="0" x2="1" y2="1"') + '>' + list.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('') + '</linearGradient>';
  }
  /* 점토 재질 필터: 안쪽 그림자(오른쪽 아래) + 안쪽 빛(왼쪽 위) + (선택) 아주 약한 표면 결 */
  function clay(id, shade, so, std, dx, dy, ho, grain) {
    var s = '<filter id="@' + id + '" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="' + std + '" result="b"/>' +
      '<feOffset in="b" dx="' + (-dx) + '" dy="' + (-dy) + '" result="o1"/>' +
      '<feComposite in="SourceAlpha" in2="o1" operator="out" result="m1"/>' +
      '<feFlood flood-color="' + shade + '" flood-opacity="' + so + '" result="f1"/>' +
      '<feComposite in="f1" in2="m1" operator="in" result="s1"/>' +
      '<feOffset in="b" dx="' + fx(dx * 0.6) + '" dy="' + fx(dy * 0.6) + '" result="o2"/>' +
      '<feComposite in="SourceAlpha" in2="o2" operator="out" result="m2"/>' +
      '<feFlood flood-color="#ffffff" flood-opacity="' + ho + '" result="f2"/>' +
      '<feComposite in="f2" in2="m2" operator="in" result="s2"/>' +
      '<feMerge result="lit"><feMergeNode in="SourceGraphic"/><feMergeNode in="s1"/><feMergeNode in="s2"/></feMerge>';
    if (grain) s +=
      '<feTurbulence type="fractalNoise" baseFrequency="' + grain[0] + '" numOctaves="2" seed="8" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="g"/>' +
      '<feComposite in="lit" in2="g" operator="arithmetic" k1="0" k2="1" k3="' + grain[1] + '" k4="' + fx(-grain[1] / 2) + '" result="lg"/>' +
      '<feComposite in="lg" in2="SourceAlpha" operator="in"/>';
    return s + '</filter>';
  }
  function blur(id, sd, pad) { return '<filter id="@' + id + '" x="-' + pad + '%" y="-' + pad + '%" width="' + (100 + pad * 2) + '%" height="' + (100 + pad * 2) + '%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'; }

  var SHARED = '';
  function sharedDefs() {
    if (SHARED) return SHARED;
    var s =
      fade('gHi', '#ffffff', 0.95) + fade('gCheek', '#FF6F96', 0.62) +
      /* 바닥 그림자: 다크 모드에서 색·진하기가 바뀌게 CSS 변수 */
      '<radialGradient id="@gGround"><stop offset="0" style="stop-color:var(--hm-gnd,#2B1F6B);stop-opacity:var(--hm-gnd-o,.26)"/><stop offset="1" style="stop-color:var(--hm-gnd,#2B1F6B);stop-opacity:0"/></radialGradient>' +
      lin('gGold', '#FFEE9C', '#FFB81F') + lin('gGoldD', '#FFCB42', '#EE9A00') +
      lin('gBlue', '#8E9CFF', '#4756F2') + lin('gBlueD', '#5463F5', '#2F3BC4') +
      lin('gCoral', '#FFA796', '#F0604F') + lin('gCream', '#FFFFFF', '#E4DEF5') +
      lin('gDark', '#5A4FA3', '#1D1942') + lin('gPink', '#FFB3CC', '#F45C92') +
      lin('gMint', '#9DF3D0', '#2CC08A') + lin('gSkyB', '#A9DCFF', '#3D8BEA') +
      lin('gLeaf', '#A6EFBF', '#3CBF7E') + lin('gSilver', '#FBFAFF', '#AFA9C9') + lin('gFrame', '#8A7CFF', '#3B2FC2') +
      lin('gPhone', '#6E6C88', '#1F1D2C') + lin('gHood', '#7C7A98', '#363450') + lin('gLimeA', '#E6FF8A', '#93C400') +
      lin('gKhaki', '#F7EDCB', '#CBB176') + lin('gKhakiD', '#CDB274', '#9A7C40') +
      /* 희귀: 금속 금(여러 띠) */
      stops('gMetal', [[0, '#FFF8D2'], [0.26, '#FFD84F'], [0.5, '#E9A000'], [0.72, '#FFE98F'], [1, '#C07E00']]) +
      stops('gStarLens', [[0, '#FFB3E1', 0.62], [1, '#B79CFF', 0.5]]) +
      stops('gFujiSky', [[0, '#E4F4FF'], [1, '#9CCBFF']], 'x1="0" y1="0" x2="0" y2="1"') +
      lin('gFujiMt', '#97A4FF', '#4753C4') + lin('gSakura', '#FFF2F7', '#FF93BD') +
      rad('gEye', '#5D5491', '#2A2350', '#120F29') +
      '<linearGradient id="@gLens" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#C9D8FF" stop-opacity=".28"/></linearGradient>' +
      clay('fIn', '#2B1F6B', 0.3, 5, 4, 6, 0.5, [0.9, 0.06]) + clay('fInS', '#2B1F6B', 0.3, 2.4, 2, 3, 0.5, [0.9, 0.05]) +
      clay('fInM', '#2B1F6B', 0.28, 3, 2.5, 4, 0.5) + clay('fInT', '#2B1F6B', 0.28, 1.2, 1, 1.5, 0.55) +
      blur('fBlur', 3, 30) + blur('fSoft', 1.8, 30) + blur('fRim', 4.5, 20);
    Object.keys(COL).forEach(function (k) {
      var c = COL[k];
      s += rad('gB-' + k, c.hi, c.mid, c.lo) + lin('gF-' + k, c.mid, c.lo) + fade('gAO-' + k, c.sh, 0.5) +
        clay('fB-' + k, c.sh, 0.42, 9, 7, 10, 0.55, [0.85, 0.07]) + clay('fBm-' + k, c.sh, 0.38, 6, 5, 7, 0.5) +
        '<linearGradient id="@gRim-' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset=".52" stop-color="' + c.rim + '" stop-opacity="0"/><stop offset=".82" stop-color="' + c.rim + '" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient>';
    });
    SHARED = s;
    return s;
  }
  function finish(s, shared, inst) {
    return s.replace(/(id="|url\(#)@/g, function (m, a) { return a + shared; })
            .replace(/(id="|url\(#)\$/g, function (m, a) { return a + inst; });
  }

  /* ════ 2. 모양 ════ */
  var BODY = 'M110 46C162 46 194 84 192 130C190 174 158 204 110 204C62 204 30 174 28 130C26 84 58 46 110 46Z';
  var FEET = '<ellipse cx="84" cy="204" rx="20" ry="11"/><ellipse cx="136" cy="204" rx="20" ry="11"/>';
  var CAP_DOME = 'M46 82C44 40 78 20 110 20C142 20 176 40 174 82C152 92 68 92 46 82Z';
  var CAP_BRIM = 'M100 82C130 70 168 72 180 86C182 92 176 95 170 95C144 97 122 92 100 82Z';
  var BEANIE = 'M44 86C42 40 78 18 110 18C142 18 178 40 176 86Z';
  var CROWN = 'M62 82L56 38L86 58L110 24L134 58L164 38L158 82Z';
  var PHONE_BAND = 'M34 122C26 60 64 40 110 40C156 40 194 60 186 122';
  var HOOD = 'M24 150C8 96 42 30 104 26Q118 20 132 15Q126 26 134 30C184 42 212 96 196 150Q184 158 170 150L50 150Q36 158 24 150Z';
  var SHADE = 'M50 124Q110 110 170 124L166 142Q158 156 132 152Q116 149 110 140Q104 149 88 152Q62 156 54 142Z';
  var BUCKET = 'M60 80C58 56 66 32 110 30C154 32 162 56 160 80Z';
  var BUCKET_BAND = 'M60.5 61C92 67 128 67 159.5 61L160 76C128 82 92 82 60 76Z';
  var BUCKET_BRIM = 'M18 106C30 84 70 74 110 74C150 74 190 84 202 106C204 114 196 116 188 112C164 100 138 96 110 96C82 96 56 100 32 112C24 116 16 114 18 106Z';
  var SAKURA_PETAL = 'M0 -2.5C-5.2 -5 -7.6 -11 -4.6 -15.2Q-2.2 -16.6 0 -13.6Q2.2 -16.6 4.6 -15.2C7.6 -11 5.2 -5 0 -2.5Z';

  function starPath(cx, cy, R, r) {
    var d = '', i, a, rr;
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  }
  var STAR_GL = starPath(83, 136, 29, 15.5), STAR_GR = starPath(137, 136, 29, 15.5);

  /* 품질(c.q): hi = 96px 이상, mid = 44~95px, lo = 43px 이하 */
  function fl(c, w) {
    if (c.q === 'lo') return '';
    return ' filter="url(#@' + (c.q === 'hi' ? (w === 'L' ? 'fIn' : 'fInS') : (w === 'L' ? 'fInM' : 'fInT')) + ')"';
  }
  function sw(c, n) { return fx(c.q === 'lo' ? n * 1.35 : n); }
  function hl(cx, cy, rx, ry, rot, op) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#@gHi)" opacity="' + op + '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>'; }
  function dot(cx, cy, r, op) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fff" opacity="' + op + '"/>'; }
  /* 희귀 반짝이(네 갈래 별). 움직일 때만 깜빡임 */
  function glint(c, x, y, s) {
    if (c.q === 'lo') return '';
    var k = s * 0.2;
    return '<path class="hm-tw" d="M' + x + ' ' + fx(y - s) + 'Q' + fx(x + k) + ' ' + fx(y - k) + ' ' + fx(x + s) + ' ' + y + 'Q' + fx(x + k) + ' ' + fx(y + k) + ' ' + x + ' ' + fx(y + s) +
      'Q' + fx(x - k) + ' ' + fx(y + k) + ' ' + fx(x - s) + ' ' + y + 'Q' + fx(x - k) + ' ' + fx(y - k) + ' ' + x + ' ' + fx(y - s) + 'Z" fill="#FFFDF2" stroke="#FFC93D" stroke-width=".7" stroke-linejoin="round"/>';
  }
  /* 다크 모드에서만 보이는 바깥 윤곽(어두운 아이템이 배경에 묻히지 않게) */
  function ol(shape) { return '<g class="hm-ol" fill="none" stroke="none">' + shape + '</g>'; }

  var HAT = {
    cap: function (c) {
      return '<path d="' + CAP_DOME + '" fill="url(#@gBlue)"' + fl(c, 'L') + '/>' +
        '<path d="M110 23Q105 52 107 87M76 32Q66 56 70 86" stroke="#3341D8" stroke-opacity=".32" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="' + CAP_BRIM + '" fill="url(#@gBlueD)"' + fl(c, 'L') + '/>' +
        '<path d="M110 81C136 72 162 74 174 85" stroke="#fff" stroke-opacity=".4" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="110" cy="21" r="6" fill="url(#@gGold)"' + fl(c, 'S') + '/>' + dot(108, 19, 1.6, 0.9) + hl(80, 46, 18, 9, -28, 0.75) + dot(68, 56, 2.6, 0.8);
    },
    beanie: function (c) {
      return '<circle cx="110" cy="16" r="14" fill="url(#@gCream)"' + fl(c, 'L') + '/>' + dot(104, 10, 2.8, 0.9) +
        '<path d="' + BEANIE + '" fill="url(#@gCoral)"' + fl(c, 'L') + '/>' +
        '<path d="M78 30Q72 56 74 80M96 22Q92 50 93 80M124 22Q128 50 127 80M142 30Q148 56 146 80" stroke="#D9473A" stroke-opacity=".28" stroke-width="2.2" fill="none" stroke-linecap="round"/>' + hl(80, 46, 16, 9, -28, 0.7) +
        '<rect x="40" y="72" width="140" height="26" rx="13" fill="url(#@gCream)"' + fl(c, 'L') + '/>' +
        '<path d="M56 78v14M68 78v14M80 78v14M92 78v14M104 78v14M116 78v14M128 78v14M140 78v14M152 78v14M164 78v14" stroke="#D2CAE9" stroke-width="2.6" stroke-linecap="round" fill="none"/>' + hl(66, 78, 12, 3, 0, 0.7);
    },
    headphone: function (c) {
      return ol('<rect x="10" y="100" width="28" height="52" rx="13"/><rect x="182" y="100" width="28" height="52" rx="13"/>') +
        '<path class="hm-ed" d="' + PHONE_BAND + '" fill="none" stroke="#14131F" stroke-width="13" stroke-linecap="round"/>' +
        '<path d="' + PHONE_BAND + '" fill="none" stroke="url(#@gPhone)" stroke-width="9.5" stroke-linecap="round"/>' +
        '<path d="M44 92C52 62 76 46 104 44" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.4" stroke-linecap="round"/>' +
        '<rect x="31" y="106" width="11" height="40" rx="5.5" fill="url(#@gLimeA)"' + fl(c, 'S') + '/><rect x="178" y="106" width="11" height="40" rx="5.5" fill="url(#@gLimeA)"' + fl(c, 'S') + '/>' +
        '<rect x="10" y="100" width="28" height="52" rx="13" fill="url(#@gPhone)"' + fl(c, 'L') + '/><rect x="182" y="100" width="28" height="52" rx="13" fill="url(#@gPhone)"' + fl(c, 'L') + '/>' +
        '<circle cx="24" cy="126" r="5" fill="url(#@gLimeA)"/><circle cx="196" cy="126" r="5" fill="url(#@gLimeA)"/>' + hl(18, 112, 3, 7, 0, 0.5) + hl(190, 112, 3, 7, 0, 0.4);
    },
    hood: function (c) {
      return '<g mask="url(#$mHood)">' + ol('<path d="' + HOOD + '"/>') + '<path d="' + HOOD + '" fill="url(#@gHood)"' + fl(c, 'L') + '/></g>' +
        '<path d="M48.4 146A62 54 0 1 1 171.6 146" fill="none" stroke="#5B5973" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M48.4 146A62 54 0 1 1 171.6 146" fill="none" stroke="url(#@gHood)" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M126 24Q114 52 110 84" stroke="#23213A" stroke-opacity=".45" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="4 4"/>' +
        hl(66, 64, 15, 7, -40, 0.4) +
        '<path d="M54 148Q50 166 53 184M166 148Q170 166 167 184" stroke="#F4F1FF" stroke-width="' + sw(c, 4.4) + '" fill="none" stroke-linecap="round"/>' +
        '<rect x="49.5" y="181" width="7" height="12" rx="3.5" fill="url(#@gLimeA)"/><rect x="163.5" y="181" width="7" height="12" rx="3.5" fill="url(#@gLimeA)"/>';
    },
    /* NEW 버킷햇: 카키 면 + 아래로 처진 넓은 챙 + 박음질 + 라임 태그 */
    bucket: function (c) {
      return '<path d="' + BUCKET + '" fill="url(#@gKhaki)"' + fl(c, 'L') + '/>' +
        '<path d="M70 48C96 41 124 41 150 48" stroke="#9C8250" stroke-opacity=".4" stroke-width="1.8" stroke-dasharray="4 3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="' + BUCKET_BAND + '" fill="url(#@gKhakiD)"' + fl(c, 'S') + '/>' +
        '<rect x="134" y="64" width="14" height="9" rx="2" fill="url(#@gLimeA)" transform="rotate(-5 141 68.5)"/>' +
        hl(84, 44, 16, 7.5, -22, 0.7) +
        '<path d="' + BUCKET_BRIM + '" fill="url(#@gKhaki)"' + fl(c, 'L') + '/>' +
        '<path d="M30 106C58 92 84 88 110 88C136 88 162 92 190 106" stroke="#9C8250" stroke-opacity=".45" stroke-width="1.8" stroke-dasharray="4 3.5" fill="none" stroke-linecap="round"/>' +
        '<path d="M34 96C62 82 90 78 116 78" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    },
    /* 왕관(희귀): 금속 금 + 반짝이 */
    crown: function (c) {
      return '<path d="' + CROWN + '" fill="url(#@gMetal)" stroke="url(#@gMetal)" stroke-width="6" stroke-linejoin="round"' + fl(c, 'L') + '/>' +
        '<rect x="57" y="70" width="106" height="18" rx="9" fill="url(#@gGoldD)"' + fl(c, 'S') + '/>' +
        '<circle cx="56" cy="38" r="7" fill="url(#@gPink)"' + fl(c, 'S') + '/><circle cx="110" cy="22" r="7.5" fill="url(#@gMint)"' + fl(c, 'S') + '/><circle cx="164" cy="38" r="7" fill="url(#@gSkyB)"' + fl(c, 'S') + '/>' +
        dot(53.5, 35.5, 2, 0.95) + dot(107.5, 19.5, 2.1, 0.95) + dot(161.5, 35.5, 2, 0.95) +
        dot(86, 79, 3.4, 0.85) + dot(110, 79, 3.4, 0.85) + dot(134, 79, 3.4, 0.85) + hl(82, 62, 10, 5, -25, 0.7) + hl(70, 74, 8, 2.4, 0, 0.6) +
        glint(c, 146, 30, 7) + glint(c, 72, 52, 4);
    }
  };
  var GLASSES = {
    round: function (c) {
      return '<circle cx="83" cy="136" r="22" fill="url(#@gLens)"/><circle cx="137" cy="136" r="22" fill="url(#@gLens)"/>' +
        '<g fill="none" stroke="url(#@gFrame)" stroke-width="' + sw(c, 5.5) + '" stroke-linecap="round"' + fl(c, 'S') + '><circle cx="83" cy="136" r="23"/><circle cx="137" cy="136" r="23"/><path d="M106 133Q110 129 114 133"/></g>' +
        '<path d="M68 128q3-8 11-11M122 128q3-8 11-11" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"/>' + dot(97, 150, 1.8, 0.7) + dot(151, 150, 1.8, 0.7);
    },
    sun: function (c) {
      return ol('<rect x="57" y="120" width="50" height="34" rx="15"/><rect x="113" y="120" width="50" height="34" rx="15"/>') +
        '<g' + fl(c, 'S') + '><rect x="57" y="120" width="50" height="34" rx="15" fill="url(#@gDark)"/><rect x="113" y="120" width="50" height="34" rx="15" fill="url(#@gDark)"/></g>' +
        '<g fill="none" stroke="url(#@gPink)" stroke-width="' + sw(c, 5) + '" stroke-linecap="round"><rect x="57" y="120" width="50" height="34" rx="15"/><rect x="113" y="120" width="50" height="34" rx="15"/><path d="M107 132Q110 129 113 132"/></g>' +
        '<path d="M67 129l9 11M77 128l4 5M123 129l9 11M133 128l4 5" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".55" fill="none"/>';
    },
    /* NEW 네모 안경: 굵은 윗테(브로우라인) + 투명 렌즈 */
    square: function (c) {
      return ol('<rect x="59" y="119" width="46" height="35" rx="9"/><rect x="115" y="119" width="46" height="35" rx="9"/>') +
        '<rect x="59" y="119" width="46" height="35" rx="9" fill="url(#@gLens)"/><rect x="115" y="119" width="46" height="35" rx="9" fill="url(#@gLens)"/>' +
        '<g fill="none" stroke="url(#@gDark)" stroke-width="' + sw(c, 4.2) + '" stroke-linejoin="round"' + fl(c, 'S') + '><rect x="59" y="119" width="46" height="35" rx="9"/><rect x="115" y="119" width="46" height="35" rx="9"/><path d="M105 129Q110 125 115 129"/></g>' +
        '<path d="M62 121Q82 117 102 121M118 121Q138 117 158 121" stroke="url(#@gDark)" stroke-width="' + sw(c, 8) + '" stroke-linecap="round" fill="none"/>' +
        '<path d="M66 119.6Q76 118 86 118.6M122 119.6Q132 118 142 118.6" stroke="#fff" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
        '<path d="M67 140l9 -10M123 140l9 -10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>';
    },
    /* NEW 별 안경(희귀): 금속 금 별 테 + 분홍 렌즈 + 반짝이 */
    star: function (c) {
      return '<path d="' + STAR_GL + '" transform="rotate(-8 83 136)" fill="url(#@gStarLens)"/><path d="' + STAR_GR + '" transform="rotate(8 137 136)" fill="url(#@gStarLens)"/>' +
        /* 진한 금 테두리를 아래에 깔아 노란 몸(버터) 위에서도 테가 보이게 */
        '<g fill="none" stroke="#A86A00" stroke-opacity=".75" stroke-width="' + sw(c, 7) + '" stroke-linejoin="round"><path d="' + STAR_GL + '" transform="rotate(-8 83 136)"/><path d="' + STAR_GR + '" transform="rotate(8 137 136)"/></g>' +
        '<g fill="none" stroke="url(#@gMetal)" stroke-width="' + sw(c, 4.6) + '" stroke-linejoin="round"' + fl(c, 'S') + '><path d="' + STAR_GL + '" transform="rotate(-8 83 136)"/><path d="' + STAR_GR + '" transform="rotate(8 137 136)"/></g>' +
        '<path d="M104 131Q110 126 116 131" stroke="url(#@gMetal)" stroke-width="' + sw(c, 4) + '" fill="none" stroke-linecap="round"/>' +
        '<path d="M72 128l6 -6M126 126l6 -6" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".8" fill="none"/>' +
        dot(79, 109, 1.8, 0.9) + dot(139, 109, 1.8, 0.9) + glint(c, 166, 110, 7) + glint(c, 56, 156, 4);
    }
  };
  var CHARM = {
    star: function (c) { return '<path d="' + starPath(192, 194, 14.5, 7) + '" fill="url(#@gGold)" stroke="url(#@gGold)" stroke-width="3.5" stroke-linejoin="round"' + fl(c, 'S') + '/>' + dot(187.5, 189.5, 2.2, 0.95); },
    heart: function (c) { return '<path d="M192 206C174 195 176 180 185 180C189.5 180 192 184 192 186.5C192 184 194.5 180 199 180C208 180 210 195 192 206Z" fill="url(#@gPink)"' + fl(c, 'S') + '/>' + dot(184.5, 185.5, 2.2, 0.95); },
    bolt: function (c) { return '<path d="M196 178L183 195L191 195L187 208L201 190L193 190Z" fill="url(#@gMint)" stroke="url(#@gMint)" stroke-width="3.5" stroke-linejoin="round"' + fl(c, 'S') + '/>' + dot(191.5, 185, 1.7, 0.95); },
    chain: function (c) {
      return '<g fill="none" stroke="#7F799E" stroke-width="3.8"><ellipse cx="191.5" cy="187" rx="3" ry="4.4"/><ellipse cx="191.5" cy="194.5" rx="1.3" ry="4.4"/><ellipse cx="191.5" cy="202" rx="3" ry="4.4"/></g>' +
        '<g fill="none" stroke="url(#@gSilver)" stroke-width="2.4"><ellipse cx="191.5" cy="187" rx="3" ry="4.4"/><ellipse cx="191.5" cy="194.5" rx="1.3" ry="4.4"/><ellipse cx="191.5" cy="202" rx="3" ry="4.4"/></g>' +
        '<rect x="183" y="205" width="17" height="22" rx="5" fill="url(#@gSilver)"' + fl(c, 'S') + '/>' +
        '<circle cx="191.5" cy="209.5" r="1.8" fill="#8C86AB"/><path d="M187 216h9M187 220.5h6" stroke="#8C86AB" stroke-width="1.6" stroke-linecap="round"/>' + dot(186.5, 208.5, 1.6, 0.9);
    },
    /* NEW 후지산(희귀): 금테 둥근 배지 안에 눈 덮인 후지산 + 빨간 해 */
    fuji: function (c) {
      return '<circle cx="192" cy="198" r="15" fill="url(#@gFujiSky)"/>' +
        '<circle cx="199.5" cy="190.5" r="3" fill="#FF6F7E"/>' +
        '<path d="M204.5 206.5A15 15 0 0 1 179.5 206.5Z" fill="#8EDDB4"/>' +
        '<path d="M179.5 206.5L188.2 192.8Q192 187.6 195.8 192.8L204.5 206.5Q192 209.6 179.5 206.5Z" fill="url(#@gFujiMt)"/>' +
        '<path d="M186.4 195.6L188.2 192.8Q192 187.6 195.8 192.8L197.6 195.6L195 194.2L193.2 196.4L191 194.4L188.8 196.6Z" fill="#fff"/>' +
        hl(186.5, 201, 1.8, 4.5, 28, 0.35) +
        '<circle cx="192" cy="198" r="15" fill="none" stroke="url(#@gMetal)" stroke-width="' + sw(c, 3.6) + '"' + fl(c, 'S') + '/>' +
        dot(184, 189.5, 1.9, 0.95) + glint(c, 208, 184, 5);
    },
    /* NEW 벚꽃(희귀): 꽃잎 5장 + 금 꽃술 + 반짝이 */
    sakura: function (c) {
      var s = '<g' + fl(c, 'S') + '>', i;
      for (i = 0; i < 5; i++) s += '<path d="' + SAKURA_PETAL + '" transform="translate(192 197) rotate(' + (i * 72) + ')" fill="url(#@gSakura)" stroke="#F07AA6" stroke-opacity=".55" stroke-width=".9"/>';
      s += '</g><circle cx="192" cy="197" r="4.2" fill="url(#@gMetal)"/>';
      for (i = 0; i < 5; i++) {
        var a = (36 + i * 72 - 90) * Math.PI / 180;
        s += '<circle cx="' + fx(192 + Math.cos(a) * 7) + '" cy="' + fx(197 + Math.sin(a) * 7) + '" r="1.1" fill="#E0457F"/>';
      }
      return s + dot(186, 187, 2, 0.9) + dot(190.6, 195.6, 1.2, 0.9) + glint(c, 208, 184, 5);
    }
  };
  var RING = '<circle cx="182" cy="164" r="7" fill="none" stroke="#9E98BC" stroke-width="4.4"/><circle cx="182" cy="164" r="7" fill="none" stroke="url(#@gSilver)" stroke-width="3.2"/>' +
    '<path d="M178.5 158.6a6 6 0 0 1 6 -0.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
    '<path d="M185 170Q191 172 191.5 183" stroke="#AFA9C9" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
  /* 모자·안경이 몸에 떨어뜨리는 그림자 (몸 윤곽으로 잘라 냄) */
  var CAST = {
    cap: '<path d="' + CAP_DOME + '"/><path d="' + CAP_BRIM + '"/>',
    beanie: '<rect x="40" y="72" width="140" height="26" rx="13"/>',
    crown: '<rect x="57" y="70" width="106" height="18" rx="9"/>',
    headphone: '<rect x="10" y="100" width="28" height="52" rx="13"/><rect x="182" y="100" width="28" height="52" rx="13"/>',
    bucket: '<path d="' + BUCKET_BRIM + '"/>',
    round: '<circle cx="83" cy="136" r="23" fill="none" stroke-width="6"/><circle cx="137" cy="136" r="23" fill="none" stroke-width="6"/>',
    sun: '<rect x="57" y="120" width="50" height="34" rx="15"/><rect x="113" y="120" width="50" height="34" rx="15"/>',
    square: '<rect x="59" y="119" width="46" height="35" rx="9" fill="none" stroke-width="6"/><rect x="115" y="119" width="46" height="35" rx="9" fill="none" stroke-width="6"/>',
    star: '<path d="' + STAR_GL + '" transform="rotate(-8 83 136)" fill="none" stroke-width="6"/><path d="' + STAR_GR + '" transform="rotate(8 137 136)" fill="none" stroke-width="6"/>'
  };
  function cast(c, k) {
    if (!CAST[k] || c.q === 'lo') return '';
    return '<g clip-path="url(#$cpBody)"><g transform="translate(1 7)"' + (c.q === 'hi' ? ' filter="url(#@fBlur)" opacity=".26"' : ' opacity=".14"') + ' fill="#2B1F6B" stroke="#2B1F6B" stroke-width="0">' + CAST[k] + '</g></g>';
  }

  /* 눈: 진한 구슬 + 아래쪽 반사 + 하이라이트 2개(작을 때는 1개 크게) */
  function eyeBall(c, cx, cy, rx, ry) {
    var s = '';
    if (c.q === 'hi') s += '<ellipse cx="' + cx + '" cy="' + fx(cy + 2) + '" rx="' + fx(rx + 1.2) + '" ry="' + fx(ry + 1.2) + '" fill="#2B1F6B" opacity=".2" filter="url(#@fSoft)"/>';
    s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#@gEye)"/>';
    if (c.q === 'lo') return s + '<ellipse cx="' + fx(cx - rx * 0.28) + '" cy="' + fx(cy - ry * 0.32) + '" rx="' + fx(rx * 0.46) + '" ry="' + fx(ry * 0.4) + '" fill="#fff"/>';
    return s + '<ellipse cx="' + cx + '" cy="' + fx(cy + ry * 0.44) + '" rx="' + fx(rx * 0.56) + '" ry="' + fx(ry * 0.27) + '" fill="#9A8DF0" opacity=".5"/>' +
      '<ellipse cx="' + fx(cx - rx * 0.3) + '" cy="' + fx(cy - ry * 0.36) + '" rx="' + fx(rx * 0.42) + '" ry="' + fx(ry * 0.37) + '" fill="#fff" transform="rotate(-18 ' + fx(cx - rx * 0.3) + ' ' + fx(cy - ry * 0.36) + ')"/>' +
      '<circle cx="' + fx(cx + rx * 0.36) + '" cy="' + fx(cy + ry * 0.34) + '" r="' + fx(rx * 0.19) + '" fill="#fff" opacity=".95"/>';
  }

  /* ════ 3. 몽글이 한 마리 (몸 → 얼굴 → 안경 → 모자 → 키링) ════ */
  function figure(st, c, expr) {
    var k = st.body, col = COL[k], lo = c.q === 'lo';
    var F = ' fill="url(#@gF-' + k + ')"' + fl(c, 'S');
    var armsBack = '', armsFront = '';
    if (expr === 'happy') armsBack = '<ellipse cx="22" cy="108" rx="12" ry="19" transform="rotate(-40 22 108)"' + F + '/><ellipse cx="198" cy="108" rx="12" ry="19" transform="rotate(40 198 108)"' + F + '/>';
    else if (expr === 'wow') armsBack = '<ellipse cx="18" cy="128" rx="12" ry="18" transform="rotate(-62 18 128)"' + F + '/><ellipse cx="202" cy="128" rx="12" ry="18" transform="rotate(62 202 128)"' + F + '/>';
    else {
      var A = '<ellipse cx="37" cy="154" rx="11.5" ry="14.5" transform="rotate(18 37 154)"/><ellipse cx="183" cy="154" rx="11.5" ry="14.5" transform="rotate(-18 183 154)"/>';
      armsFront = (lo ? '' : '<g clip-path="url(#$cpBody)"><g transform="translate(3 6)" fill="' + col.sh + '" opacity=".34"' + (c.q === 'hi' ? ' filter="url(#@fSoft)"' : '') + '>' + A + '</g></g>') +
        '<g' + F + '>' + A + '</g>' + hl(31, 145, 4, 2.4, -30, 0.7) + hl(179, 145, 4, 2.4, -30, 0.55);
    }
    var sprout = st.hat !== 'none' ? '' :
      '<path d="M110 52Q108 41 112 33" stroke="#3FBF83" stroke-width="' + sw(c, 4.5) + '" stroke-linecap="round" fill="none"/>' +
      '<path d="M112 34C100 33 91 26 90 15C103 15 112 23 112 34Z" fill="url(#@gLeaf)"' + fl(c, 'S') + '/>' +
      '<path d="M112 34C113 22 123 14 137 15C137 28 126 35 112 34Z" fill="url(#@gLeaf)"' + fl(c, 'S') + '/>' +
      hl(97, 21, 4, 2, 40, 0.7) + hl(127, 20, 4, 2, -40, 0.6);
    var er = lo ? [14, 16.5] : [12.5, 15], ew = lo ? [15, 18.5] : [13.5, 17];
    var eyes;
    if (expr === 'happy') eyes = '<path d="M70 140Q83 121 96 140M124 140Q137 121 150 140" stroke="#2A2350" stroke-width="' + sw(c, 6.5) + '" stroke-linecap="round" fill="none"/>';
    else if (expr === 'wow') eyes = '<g class="hm-eyes">' + eyeBall(c, 83, 136, ew[0], ew[1]) + eyeBall(c, 137, 136, ew[0], ew[1]) + '</g>' +
      '<path d="M70 108Q81 100 93 105M127 105Q139 100 150 108" stroke="#2A2350" stroke-width="' + sw(c, 4) + '" stroke-linecap="round" fill="none" opacity=".85"/>';
    else eyes = '<g class="hm-eyes">' + eyeBall(c, 83, 136, er[0], er[1]) + eyeBall(c, 137, 136, er[0], er[1]) + '</g>';
    var mouth;
    if (expr === 'happy') mouth = '<path d="M96 154Q110 149 124 154Q123 174 110 174Q97 174 96 154Z" fill="#3A2458"/><ellipse cx="110" cy="168" rx="7" ry="4" fill="#FF7E9D"/><path d="M101 155Q110 152.5 119 155" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    else if (expr === 'wow') mouth = '<ellipse cx="110" cy="164" rx="8" ry="10" fill="#3A2458"/><ellipse cx="110" cy="169" rx="5" ry="3.5" fill="#FF7E9D"/>';
    else mouth = '<path d="M101 157Q110 166 119 157" stroke="#2A2350" stroke-width="' + sw(c, 4.5) + '" stroke-linecap="round" fill="none"/>';

    var bodyF = c.q === 'hi' ? ' filter="url(#@fB-' + k + ')"' : c.q === 'mid' ? ' filter="url(#@fBm-' + k + ')"' : '';
    var rim = c.q === 'hi' ? '<path d="' + BODY + '" fill="none" stroke="url(#@gRim-' + k + ')" stroke-width="16" filter="url(#@fRim)" opacity=".9"/>' : '';
    var feetShade = lo ? '' : '<g clip-path="url(#$cpFeet)"><ellipse cx="110" cy="196" rx="72" ry="9" fill="' + col.sh + '" opacity=".5"' + (c.q === 'hi' ? ' filter="url(#@fSoft)"' : '') + '/></g>';
    var rare = k === 'butter' ? glint(c, 160, 70, 7) + glint(c, 50, 118, 4) : '';

    /* 작을 때 비율 보정: 안경 살짝 크게, 키링 크게·몸 쪽으로 */
    var gT = lo ? ' transform="translate(110 136) scale(1.06) translate(-110 -136)"' : '';
    var cT = lo ? 'translate(2 3) translate(182 164) scale(1.4) translate(-182 -164)' : c.q === 'mid' ? 'translate(4 5) translate(182 164) scale(1.15) translate(-182 -164)' : 'translate(5 6)';
    var g = st.glasses !== 'none' ? GLASSES[st.glasses](c) : '';
    var h = st.hat !== 'none' ? HAT[st.hat](c) : '';
    var ch = st.charm !== 'none' ? RING + CHARM[st.charm](c) : '';

    return '<g class="hm-fig">' +
      '<g class="hm-l-body">' + armsBack +
        '<g' + F + '>' + FEET + '</g>' + feetShade +
        hl(78, 202, 5, 2.4, 0, 0.6) + hl(130, 202, 5, 2.4, 0, 0.5) + sprout +
        '<path d="' + BODY + '" fill="url(#@gB-' + k + ')"' + bodyF + '/>' +
        '<g clip-path="url(#$cpBody)"><ellipse cx="110" cy="216" rx="90" ry="36" fill="url(#@gAO-' + k + ')"/>' + rim + '</g>' +
        hl(80, 86, 25, 13, -30, 0.88) + dot(67, 86, 4.6, 0.92) + dot(78, 73, 2.3, 0.8) + rare +
      '</g>' +
      '<g class="hm-l-face">' +
        '<ellipse cx="58" cy="160" rx="13" ry="8" fill="url(#@gCheek)"/><ellipse cx="162" cy="160" rx="13" ry="8" fill="url(#@gCheek)"/>' +
        armsFront + eyes + mouth +
      '</g>' +
      '<g class="hm-l-glasses hm-p-glasses"' + gT + '>' + cast(c, st.glasses) + g + '</g>' +
      '<g class="hm-l-hat hm-p-hat">' + cast(c, st.hat) + h + '</g>' +
      '<g class="hm-l-charm" transform="' + cT + '"><g class="hm-p-charm">' + ch + '</g></g>' +
      '</g>';
  }
  function instDefs(hood) {
    return '<clipPath id="$cpBody"><path d="' + BODY + '"/></clipPath><clipPath id="$cpFeet">' + FEET + '</clipPath>' +
      (hood ? '<mask id="$mHood" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="240"><rect width="220" height="240" fill="#fff"/><ellipse cx="110" cy="140" rx="62" ry="54" fill="#000"/></mask>' : '');
  }
  function groundShadow(c) {
    return '<g class="hm-sh"><ellipse cx="110" cy="217" rx="88" ry="15" fill="url(#@gGround)"/>' +
      '<ellipse cx="110" cy="215" rx="54" ry="6" style="fill:var(--hm-gnd,#2B1F6B);opacity:var(--hm-ct,.3)"' + (c.q === 'hi' ? ' filter="url(#@fSoft)"' : '') + '/></g>';
  }
  function tier(px) { return !px || px >= 96 ? 'hi' : px >= 44 ? 'mid' : 'lo'; }

  /* ════ 4. 공개 함수 ════ */
  function svg(state, size, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var st = norm(state), px = num(size), id = ++seq, I = 'hm' + id + '-';
    var c = { q: tier(px) };
    var expr = opts.expr === 'happy' || opts.expr === 'wow' ? opts.expr : 'base';
    var shadow = opts.shadow !== false;
    var anim = opts.anim == null ? (!px || px >= 64) : !!opts.anim;
    var vb = shadow ? [-7, 2, 234, 234] : [-2, 2, 224, 224];
    var ox = fx((110 - vb[0]) / vb[2] * 100), oy = fx((214 - vb[1]) / vb[3] * 100);
    var style = (px ? '' : 'width:100%;height:auto;') + 'transform-origin:' + ox + '% ' + oy + '%' +
      (anim ? ';--hm-d:' + fx(-((id * 0.83) % 3.2)) + 's;--hm-d2:' + fx(-((id * 1.37) % 5.2)) + 's' : '');
    if (hasDOM && !opts.standalone) mount();
    var s = '<svg xmlns="' + SVGNS + '" class="hm hm-' + c.q + (anim ? ' hm-a' : '') + '" viewBox="' + vb.join(' ') + '"' +
      (px ? ' width="' + px + '" height="' + px + '"' : '') + ' style="' + style + '" role="img" aria-label="' + esc(opts.label || '몽글이') + '" focusable="false">' +
      '<defs>' + instDefs(st.hat === 'hood') + (opts.standalone ? sharedDefs() : '') + '</defs>' +
      (shadow ? groundShadow(c) : '') + figure(st, c, expr) + '</svg>';
    return finish(s, opts.standalone ? I : P, I);
  }

  function avatar(state, size, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var px = num(size) || 40;
    if (opts.show === false) {
      var t = opts.initial == null ? '' : String(opts.initial).trim();
      var ch = t ? Array.from(t)[0] : '?';
      if (hasDOM) mount();
      return '<span class="hm-ini" role="img" aria-label="' + esc(ch + ' (캐릭터 끔)') + '" style="width:' + px + 'px;height:' + px + 'px;font-size:' + fx(px * 0.44) + 'px">' + esc(ch) + '</span>';
    }
    return svg(state, px, { expr: opts.expr, anim: opts.anim === true, shadow: opts.shadow === true, label: opts.label });
  }

  /* 꾸미기 칸용 아이템 그림 (정사각) */
  var BOX = {
    hat: { cap: [40, 12, 148, 88], beanie: [34, 0, 152, 104], crown: [44, 12, 132, 82], headphone: [4, 30, 212, 128], hood: [16, 10, 188, 186], bucket: [14, 24, 192, 96] },
    glasses: { round: [54, 108, 112, 58], sun: [52, 114, 116, 46], square: [52, 112, 116, 48], star: [48, 100, 124, 72] },
    charm: { star: [164, 152, 52, 62], heart: [164, 152, 52, 62], bolt: [164, 152, 52, 62], chain: [166, 152, 44, 80], fuji: [164, 152, 52, 66], sakura: [164, 152, 52, 66] }
  };
  function icon(kind, id, size) {
    kind = kind === 'color' ? 'body' : String(kind);
    id = id == null ? '' : String(id);
    if (VALID[kind] && ALIAS[kind] && Object.prototype.hasOwnProperty.call(ALIAS[kind], id)) id = ALIAS[kind][id];
    var px = num(size), I = 'hm' + (++seq) + '-', c ={ q: tier(px) }, art = '', vb;
    var ok = VALID[kind] && Object.prototype.hasOwnProperty.call(VALID[kind], id);
    if (ok && kind === 'body') {
      art = '<ellipse cx="110" cy="212" rx="70" ry="10" fill="url(#@gGround)"/><path d="' + BODY + '" fill="url(#@gB-' + id + ')"' + (c.q === 'hi' ? ' filter="url(#@fB-' + id + ')"' : c.q === 'mid' ? ' filter="url(#@fBm-' + id + ')"' : '') + '/>' +
        '<g clip-path="url(#$cpBody)"><ellipse cx="110" cy="216" rx="90" ry="36" fill="url(#@gAO-' + id + ')"/>' + (c.q === 'hi' ? '<path d="' + BODY + '" fill="none" stroke="url(#@gRim-' + id + ')" stroke-width="16" filter="url(#@fRim)" opacity=".9"/>' : '') + '</g>' +
        hl(80, 86, 25, 13, -30, 0.9) + dot(67, 86, 4.6, 0.9) + (id === 'butter' ? glint(c, 160, 70, 8) : '');
      vb = [20, 38, 180, 180];
    } else if (ok && id !== 'none') {
      var b = BOX[kind][id];
      art = kind === 'hat' ? HAT[id](c) : kind === 'glasses' ? GLASSES[id](c) : RING + CHARM[id](c);
      var side = Math.max(b[2], b[3]) * 1.06;
      vb = [fx(b[0] + b[2] / 2 - side / 2), fx(b[1] + b[3] / 2 - side / 2), fx(side), fx(side)];
    } else {
      art = '<circle cx="30" cy="30" r="15" fill="none" stroke="url(#@gSilver)" stroke-width="5"/><path d="M20 40L40 20" stroke="#B5B0CC" stroke-width="5" stroke-linecap="round"/>';
      vb = [0, 0, 60, 60];
    }
    if (hasDOM) mount();
    var name = ok ? VALID[kind][id].name : '';
    return finish('<svg xmlns="' + SVGNS + '" class="hm hm-icon hm-' + c.q + '" viewBox="' + vb.join(' ') + '"' + (px ? ' width="' + px + '" height="' + px + '"' : ' style="width:100%;height:auto"') +
      ' role="img" aria-label="' + esc(name || '없음') + '" focusable="false"><defs>' + instDefs(kind === 'hat' && id === 'hood') + '</defs>' + art + '</svg>', P, I);
  }

  var CSS =
    'svg.hm{display:block;overflow:visible;flex:none}' +
    ':root{--hm-gnd:#2B1F6B;--hm-gnd-o:.26;--hm-ct:.3}' +
    'html[data-theme="dark"]{--hm-gnd:#000;--hm-gnd-o:.5;--hm-ct:.5}' +
    'html[data-theme="dark"] svg.hm .hm-ol{stroke:rgba(214,208,255,.42);stroke-width:4px}' +
    'html[data-theme="dark"] svg.hm .hm-ed{stroke:#9A96C4}' +
    'svg.hm.hm-a{animation:hm-squish 3.2s ease-in-out var(--hm-d,0s) infinite}' +
    'svg.hm .hm-eyes,svg.hm .hm-tw{transform-box:fill-box;transform-origin:center}' +
    'svg.hm.hm-a .hm-eyes{animation:hm-blink 5.2s linear var(--hm-d2,0s) infinite}' +
    'svg.hm.hm-a .hm-tw{animation:hm-tw 4.2s ease-in-out var(--hm-d,0s) infinite}' +
    'svg.hm .hm-fig{transform-box:view-box;transform-origin:110px 214px}' +
    'svg.hm .hm-fig.hm-pop{animation:hm-pop .46s cubic-bezier(.3,1.45,.5,1)}' +
    'svg.hm .hm-p-hat.hm-in{transform-box:fill-box;transform-origin:50% 100%;animation:hm-drop .62s cubic-bezier(.3,1.45,.5,1) both}' +
    'svg.hm .hm-p-glasses.hm-in{transform-box:fill-box;transform-origin:center;animation:hm-zoom .5s cubic-bezier(.3,1.45,.5,1) both}' +
    'svg.hm .hm-p-charm.hm-in{transform-box:fill-box;transform-origin:20% 0;animation:hm-swing .9s ease-out both}' +
    '@keyframes hm-squish{0%,100%{transform:scale(1,1)}28%{transform:scale(.975,1.03)}62%{transform:scale(1.035,.962)}}' +
    '@keyframes hm-blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}' +
    '@keyframes hm-tw{0%,70%,100%{transform:scale(1) rotate(0);opacity:1}80%{transform:scale(.25) rotate(-20deg);opacity:.4}90%{transform:scale(1.3) rotate(15deg);opacity:1}}' +
    '@keyframes hm-pop{0%{transform:scale(.9,1.08)}55%{transform:scale(1.06,.95)}100%{transform:scale(1,1)}}' +
    '@keyframes hm-drop{0%{transform:translateY(-58px) scale(.86,1.14);opacity:0}40%{transform:translateY(5px) scale(1.12,.86);opacity:1}68%{transform:translateY(-4px) scale(.96,1.04)}100%{transform:none}}' +
    '@keyframes hm-zoom{0%{transform:scale(1.45);opacity:0}55%{transform:scale(.94);opacity:1}100%{transform:none}}' +
    '@keyframes hm-swing{0%{transform:rotate(-55deg) scale(.4);opacity:0}35%{transform:rotate(24deg) scale(1.05);opacity:1}60%{transform:rotate(-12deg)}80%{transform:rotate(5deg)}100%{transform:none}}' +
    '@keyframes hm-spk{0%{transform:translate(0,0) scale(0) rotate(0deg);opacity:1}45%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(50deg);opacity:1}100%{transform:translate(calc(var(--dx) * 1.35),calc(var(--dy) * 1.35)) scale(.2) rotate(110deg);opacity:0}}' +
    '.hm-spk-layer{position:fixed;pointer-events:none;z-index:2147483000;overflow:visible}' +
    '.hm-spk{position:absolute;width:var(--s);height:var(--s);margin:calc(var(--s) / -2) 0 0 calc(var(--s) / -2);animation:hm-spk .85s ease-out var(--d) both}' +
    '.hm-spk svg{display:block;width:100%;height:100%}' +
    '.hm-ini{display:inline-grid;place-items:center;flex:none;box-sizing:border-box;border-radius:50%;vertical-align:middle;' +
      'font-family:var(--f,-apple-system,sans-serif);font-weight:800;line-height:1;letter-spacing:-.04em;color:#fff;' +
      'background:radial-gradient(circle at 34% 26%,rgba(255,255,255,.42) 0,rgba(255,255,255,0) 58%),var(--pt,#5B5BFF);' +
      'box-shadow:inset 0 -.12em .2em rgba(20,10,120,.28),inset 0 .08em .12em rgba(255,255,255,.35)}' +
    '@media (prefers-reduced-motion:reduce){svg.hm,svg.hm *,.hm-spk{animation:none!important}}';

  var obs = null, waiting = false;
  function mount() {
    if (!hasDOM) return;
    if (!document.getElementById('hm-style')) {
      var st = document.createElement('style');
      st.id = 'hm-style';
      st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    if (document.getElementById('hm-defs')) return;
    if (!document.body) {
      if (!waiting) { waiting = true; document.addEventListener('DOMContentLoaded', mount); }
      return;
    }
    var d = document.createElementNS(SVGNS, 'svg');
    d.setAttribute('id', 'hm-defs');
    d.setAttribute('aria-hidden', 'true');
    d.setAttribute('focusable', 'false');
    d.setAttribute('width', '0');
    d.setAttribute('height', '0');
    d.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
    d.innerHTML = finish('<defs>' + sharedDefs() + '</defs>', P, P);
    document.body.insertBefore(d, document.body.firstChild);
    /* 누가 body 를 통째로 다시 그려 defs 가 사라지면 다시 넣음 */
    if (!obs && W.MutationObserver) {
      obs = new W.MutationObserver(function () { if (!document.getElementById('hm-defs')) mount(); });
      obs.observe(document.body, { childList: true });
    }
  }

  function reduced() { return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function restart(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.getBoundingClientRect();
    node.classList.add(cls);
    node.addEventListener('animationend', function f(e) { if (e.target === node) { node.classList.remove(cls); node.removeEventListener('animationend', f); } });
  }
  function pop(el, part) {
    if (!hasDOM || !el || !el.querySelector || reduced()) return;
    mount();
    var s = el.matches && el.matches('svg.hm') ? el : el.querySelector('svg.hm:not(.hm-icon)');
    if (!s) return;
    restart(s.querySelector('.hm-fig'), 'hm-pop');
    if (part === 'hat' || part === 'glasses' || part === 'charm') restart(s.querySelector('.hm-p-' + part), 'hm-in');
    /* 반짝이: 화면에 고정된 겹 층에 그려서 모듈 레이아웃·overflow 를 건드리지 않음 */
    var r = s.getBoundingClientRect();
    if (!r.width) return;
    var layer = document.createElement('div');
    layer.className = 'hm-spk-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'left:' + fx(r.left) + 'px;top:' + fx(r.top) + 'px;width:' + fx(r.width) + 'px;height:' + fx(r.height) + 'px';
    var w = r.width, cx = w / 2, cy = r.height * 0.5, i, a, d, html = '';
    for (i = 0; i < 8; i++) {
      a = (i / 8) * Math.PI * 2 + 0.3;
      d = w * (0.36 + (i % 3) * 0.08);
      html += '<i class="hm-spk" style="left:' + fx(cx + Math.cos(a) * w * 0.15) + 'px;top:' + fx(cy + Math.sin(a) * w * 0.12) + 'px;--s:' + fx(Math.max(7, w * (0.07 + (i % 3) * 0.03))) + 'px;--dx:' + fx(Math.cos(a) * d * 0.6) + 'px;--dy:' + fx(Math.sin(a) * d * 0.5) + 'px;--d:' + (i % 4) * 0.04 + 's">' +
        '<svg viewBox="0 0 24 24"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill="' + (i % 2 ? 'url(#hm-gGold)' : '#fff') + '"' + (i % 2 ? '' : ' stroke="#FFC93D" stroke-width="1"') + '/></svg></i>';
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1150);
  }

  W.HubMongle = Object.freeze({
    svg: svg, avatar: avatar, items: ITEMS, pop: pop, mount: mount, icon: icon, version: '2026-11-26'
  });
})(typeof window !== 'undefined' ? window : this);
