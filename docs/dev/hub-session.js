/* 허브 공통 세션 — 번호로 로그인한 학생(또는 관리자 비밀번호로 로그인한 강사)의 서버 호출을 한 곳에서.
 * 각 탭 모듈(성적·커리큘럼·QnA …)은 이걸 받아서 씀. 서버는 Supabase Edge Function 하나({action, payload} POST, 응답 {ok,data,error,needLogin}).
 *
 *   HubSession.init({ code, name, env, apiUrl })   허브가 로그인 직후 한 번 부름
 *   HubSession.call(action, payload)  → Promise<응답>   학생 요청. 로그인 열쇠(tok)를 알아서 받아 payload.tok 에 넣어 보냄(열쇠가 지났으면 다시 받아 한 번 더)
 *   HubSession.adminLogin(password) → Promise<응답>      강사 로그인(성공하면 관리자 열쇠를 가짐)
 *   HubSession.adminCall(action, payload) → Promise<응답> 강사 요청. payload.token 에 관리자 열쇠를 넣어 보냄(만료되면 needLogin:true 를 그대로 돌려줌)
 *   HubSession.code / .name / .env / .apiUrl / .isAdmin()
 *   HubSession.view(refresh?) → Promise<{ok,data}>        로그인 응답(반·테스트·숙제 요약, 홈 화면용)
 *   HubSession.clear()                                    나가기
 *   HubSession.char(refresh?) → Promise<{ok,data:{state,show,star,items}}>   내 몽글이(서버 charGet, 한 번 받아 둠)
 *   HubSession.setChar(state, show?) → Promise<{ok,data:{state,show}}>      입히기·캐릭터 보기 켜고 끄기(서버 charSet). 성공하면 window 에 'hub:char' 이벤트(detail={state,show})
 *   서버에 아직 charGet 이 없으면(「알 수 없는 요청」) 기본 몽글이 + 기본(basic) 아이템만 가진 것으로 보여 주고, 바꾼 것은 이 기기에만 기억(data.local=true)
 * 응답은 항상 {ok:true,data} 또는 {ok:false,error}. 네트워크 실패도 {ok:false,error:'인터넷 연결을 확인해 주세요.'}로 돌려줌(예외를 던지지 않음). */
(function () {
  'use strict';
  var S = { code: '', name: '', env: 'dev', apiUrl: '', tok: '', admin: '', view: null, ch: null, chP: null };
  /* 아이템 목록 (DESIGN.md 2번 표와 같음) — 몽글이 파일(HubMongle.items)이 아직 없을 때 쓰는 대체 */
  var ITEMS = [
    ['body', 'lavender', '라벤더', 'basic'], ['body', 'peach', '피치', 'basic'], ['body', 'mint', '민트', 'hip'], ['body', 'sky', '스카이', 'hip'], ['body', 'butter', '버터', 'rare'],
    ['hat', 'none', '없음', 'basic'], ['hat', 'cap', '캡', 'basic'], ['hat', 'beanie', '비니', 'hip'], ['hat', 'headphone', '헤드폰', 'hip'], ['hat', 'hood', '후드', 'hip'], ['hat', 'bucket', '버킷햇', 'hip'], ['hat', 'crown', '왕관', 'rare'],
    ['glasses', 'none', '없음', 'basic'], ['glasses', 'round', '동글 안경', 'basic'], ['glasses', 'sun', '선글라스', 'hip'], ['glasses', 'square', '네모 안경', 'hip'], ['glasses', 'star', '별 안경', 'rare'],
    ['charm', 'none', '없음', 'basic'], ['charm', 'star', '별 키링', 'basic'], ['charm', 'heart', '하트 키링', 'hip'], ['charm', 'bolt', '번개 키링', 'hip'], ['charm', 'chain', '체인 키링', 'hip'], ['charm', 'fuji', '후지산 키링', 'rare'], ['charm', 'sakura', '벚꽃 키링', 'rare']
  ].map(function (x) { return { kind: x[0], id: x[1], name: x[2], grade: x[3] }; });
  var DEF = { body: 'lavender', hat: 'none', glasses: 'none', charm: 'none' };
  function itemList() { var m = window.HubMongle && window.HubMongle.items; return m && m.length ? m : ITEMS; }
  function localKey() { return (S.env === 'dev' ? 'hub-dev.char.' : 'hub.char.') + S.code; }
  function localChar() {
    var saved = null; try { saved = JSON.parse(localStorage.getItem(localKey()) || 'null'); } catch (e) { saved = null; }
    var st = Object.assign({}, DEF), items = itemList().map(function (it) { return { id: it.id, kind: it.kind, grade: it.grade, owned: it.grade === 'basic', cond: '', progress: null }; });
    if (saved && saved.state) Object.keys(DEF).forEach(function (k) { if (items.some(function (i) { return i.kind === k && i.id === saved.state[k] && i.owned; })) st[k] = saved.state[k]; });
    return { state: st, show: !(saved && saved.show === false), star: 0, items: items, local: true };
  }
  function fire(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} }
  function deviceId() {
    var k = S.env === 'dev' ? 'seiseki-dev.device' : 'seiseki.device', v = '';
    try { v = localStorage.getItem(k) || ''; if (!v) { v = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem(k, v); } } catch (e) { v = v || 'd' + Math.random().toString(36).slice(2, 12); }
    return v;
  }
  function post(action, payload) {
    if (!S.apiUrl) return Promise.resolve({ ok: false, error: '서버 주소가 없어요.' });
    return fetch(S.apiUrl, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: action, payload: payload || {} }) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: '인터넷 연결을 확인해 주세요.' }; });
  }
  function ensureTok() {
    if (S.tok) return Promise.resolve({ ok: true });
    return post('login', { code: S.code, dev: deviceId() }).then(function (r) { if (r.ok && r.data && r.data.tok) { S.tok = r.data.tok; S.view = r.data; return { ok: true }; } return r.ok ? { ok: false, error: '로그인 열쇠를 받지 못했어요.' } : r; });
  }
  function call(action, payload, again) {
    return ensureTok().then(function (t) {
      if (!t.ok) return t;
      return post(action, Object.assign({}, payload || {}, { tok: S.tok })).then(function (r) {
        if (!r.ok && (r.needLogin || /다시 로그인|열쇠/.test(r.error || '')) && !again) { S.tok = ''; return call(action, payload, true); }
        return r;
      });
    });
  }
  window.HubSession = {
    init: function (o) { S.code = String(o.code || ''); S.name = o.name || ''; S.env = o.env === 'prod' ? 'prod' : 'dev'; S.apiUrl = o.apiUrl || ''; S.tok = ''; S.admin = ''; S.view = null; S.ch = null; S.chP = null; },
    call: function (a, p) { return call(a, p, false); },
    adminLogin: function (pw) { return post('adminLogin', { password: pw, dev: deviceId() }).then(function (r) { if (r.ok && r.data && r.data.token) S.admin = r.data.token; return r; }); },
    adminCall: function (a, p) { return post(a, Object.assign({}, p || {}, { token: S.admin })).then(function (r) { if (!r.ok && r.needLogin) S.admin = ''; return r; }); },
    /** 로그인 응답(반·테스트·숙제 요약) — 홈 화면용. refresh=true 면 서버에서 새로 받음 */
    view: function (refresh) {
      if (S.view && !refresh) return Promise.resolve({ ok: true, data: S.view });
      S.tok = '';
      return ensureTok().then(function (t) { return t.ok ? { ok: true, data: S.view } : t; });
    },
    isAdmin: function () { return !!S.admin; },
    /** 내 몽글이 — 서버 charGet 한 번 받아 둠. 서버에 아직 없으면 기본값(이 기기 기억) */
    char: function (refresh) {
      if (S.ch && !refresh) return Promise.resolve({ ok: true, data: S.ch });
      if (S.chP && !refresh) return S.chP;
      S.chP = call('charGet', {}, false).then(function (r) {
        S.chP = null;
        if (r.ok && r.data && r.data.state) { S.ch = r.data; return { ok: true, data: S.ch }; }
        if (!r.ok && /알 수 없는 요청/.test(r.error || '')) { S.ch = localChar(); return { ok: true, data: S.ch }; }
        return { ok: true, data: localChar(), error: r.error || '' };   // 네트워크 등 — 기본값으로 그리고 다음에 다시 받아 봄
      });
      return S.chP;
    },
    /** 입히기·보기 설정 저장. show 를 빼면 지금 값 그대로 */
    setChar: function (state, show) {
      return window.HubSession.char().then(function (cur) {
        var c = cur.data, st = Object.assign({}, c.state, state || {}), sh = show === undefined || show === null ? c.show !== false : !!show;
        if (c.local) {
          var bad = Object.keys(DEF).filter(function (k) { return !c.items.some(function (i) { return i.kind === k && i.id === st[k] && i.owned; }); });
          if (bad.length) return { ok: false, error: '아직 얻지 못한 아이템이에요' };
          try { localStorage.setItem(localKey(), JSON.stringify({ state: st, show: sh })); } catch (e) {}
          c.state = st; c.show = sh; fire('hub:char', { state: st, show: sh }); return { ok: true, data: { state: st, show: sh, local: true } };
        }
        return call('charSet', Object.assign({}, st, { show: sh }), false).then(function (r) {
          if (r.ok && r.data) { c.state = r.data.state || st; c.show = r.data.show === undefined ? sh : r.data.show !== false; fire('hub:char', { state: c.state, show: c.show }); }
          return r;
        });
      });
    },
    /** 아이템 이름·등급 목록 (HubMongle.items 가 있으면 그것) */
    items: function () { return itemList(); },
    clear: function () { S.code = ''; S.name = ''; S.tok = ''; S.admin = ''; S.view = null; S.ch = null; S.chP = null; },
    get code() { return S.code; }, get name() { return S.name; }, get env() { return S.env; }, get apiUrl() { return S.apiUrl; }
  };
})();
