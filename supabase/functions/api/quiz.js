// 帰宅クイズ 서버 기능 (예전 Apps Script kitaku_apps_script.gs 를 Postgres 로): 번호 확인(who) · 랭킹(rank) · 강사용 기록(stats) · 결과 기록(log)
// q(text, params) → Promise<rows[]>.  원생 = 「원생」 표(성적노트와 같은 명단). 막을 때는 상태 「차단」.
const SID_RE = /^[A-HJ-NP-Z]{2}\d{6}$/;
const RANK_TOP = 5, RANK_MIN = { prac: 50, clsWeek: 1, clsMonth: 3 }, GUEST_CLS = '원외생';
const sidNorm = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const base = n => String(n).replace(/\(.*?\)/g, '').replace(/\s+/g, '');
const mask = n => { const b = base(n); return b.length <= 1 ? b : b.length === 2 ? b[0] + '○' : b[0] + '○'.repeat(b.length - 2) + b[b.length - 1]; };
const kst = d => new Date(d.getTime() + 9 * 3600e3);                 // KST 로 옮긴 뒤 UTC 값을 읽으면 한국 날짜·요일
const day = d => kst(d).toISOString().slice(0, 10);

async function roster(q) {
  const R = { ids: {}, base: {}, full: {} };
  for (const r of await q('select "일련번호" a, "이름" b, "상태" c from public."원생"')) {
    const id = sidNorm(r.a), name = String(r.b || '').trim();
    if (!SID_RE.test(id) || !name) continue;
    R.ids[id] = { name, out: String(r.c || '').trim() === '차단' };
    (R.base[base(name)] = R.base[base(name)] || []).push(id);
    R.full[name.replace(/\s+/g, '')] = id;
  }
  return R;
}
function match(R, v) {   // 일련번호 → 명단 / 이름 그대로 → 명단 / 예전 이름 → 같은 이름이 명단에 하나뿐이면 그 학생
  const s = String(v || '').trim(), sn = sidNorm(s);
  if (SID_RE.test(sn)) return R.ids[sn] ? Object.assign({ id: sn }, R.ids[sn]) : null;
  const fid = R.full[s.replace(/\s+/g, '')];
  if (fid) return Object.assign({ id: fid }, R.ids[fid]);
  const ids = R.base[base(s)];
  return ids && ids.length === 1 ? Object.assign({ id: ids[0] }, R.ids[ids[0]]) : null;
}
const showName = (R, name) => ((R.base[base(name)] || []).length > 1 ? name : base(name));
async function prop(q, k) { const r = await q('select v from public.kv_props where k=$1', [k]); return r.length ? r[0].v : ''; }

export async function who(q, idRaw, now = new Date()) {
  const id = sidNorm(idRaw);
  if (!SID_RE.test(id)) return { ok: false, error: 'id' };
  const mk = 'qwho:' + Math.floor(now.getTime() / 60000);   // 1분에 120번 넘게 물으면 잠시 막음 (번호 마구 넣어 보기 방지)
  const c = await q(`insert into public.kv_cache(k,v,exp) values($1,'1',now()+interval '2 minutes')
                     on conflict(k) do update set v=(public.kv_cache.v::int+1)::text returning v`, [mk]);
  if (+c[0].v > 120) return { ok: false, error: 'busy' };
  const R = await roster(q), r = R.ids[id];
  if (!r || r.out) return { ok: true, member: false };
  return { ok: true, member: true, nm: mask(r.name) };
}

export async function rank(q, now = new Date()) {
  const R = await roster(q), skip = new Set(String(await prop(q, 'RANK_EXCLUDE')).split(',').map(s => s.replace(/\s+/g, '')).filter(Boolean));
  const dow = kst(now).getUTCDay() || 7;                                   // 1=월 … 7=일
  const weekStart = day(new Date(now.getTime() - (dow - 1) * 864e5)), monthStart = day(now).slice(0, 7) + '-01';
  const from = weekStart < monthStart ? weekStart : monthStart;
  const rows = await q('select "시각" t, "번호" no, "이름" nm, "반" cls, "범위" setn, "첫시도정답" f, "걸린시간" tm from public."퀴즈기록" where "시각" >= $1::date - 1', [from]);
  const agg = {};
  const add = (k, key, name, f, qn, t) => { const m = agg[k] || (agg[k] = {}); const x = m[key] || (m[key] = { name, f: 0, q: 0, c: 0, t: 0 }); x.name = name; x.f += f; x.q += qn; x.c++; x.t += t; };
  for (const r of rows) {
    const cls = String(r.cls || '').trim(); if (cls === GUEST_CLS) continue;
    const raw = String(r.no || r.nm || '').trim(), mt = match(R, raw) || match(R, r.nm);
    if (!mt && SID_RE.test(sidNorm(raw))) continue;
    const key = mt ? mt.id : String(r.nm || '').replace(/\s+/g, '');
    if (!key || skip.has(base(mt ? mt.name : r.nm)) || (!mt && !/^[가-힣A-Za-z]{2,}$/.test(key))) continue;
    const name = mt ? showName(R, mt.name) : String(r.nm).trim();
    const m = String(r.f).match(/(\d+)\s*\/\s*(\d+)/); if (!m || !+m[2]) continue;
    const prac = cls === '연습' || /^연습 · /.test(String(r.setn || ''));
    const d = day(new Date(r.t)), f = +m[1], qn = +m[2], t = +r.tm || 0;
    for (const [per, fr] of [['week', weekStart], ['month', monthStart]]) {
      if (d < fr) continue;
      if (prac) add('prac|' + per, key, name, f, qn, t);
      else { add('cls|전체|' + per, key, name, f, qn, t); if (cls) add('cls|' + cls + '|' + per, key, name, f, qn, t); }
    }
  }
  const out = { ok: true, at: now.toISOString(), weekStart, monthStart, min: RANK_MIN, lists: {} };
  Object.keys(agg).forEach(k => {
    const prac = k.indexOf('prac|') === 0, all = Object.keys(agg[k]).map(key => agg[k][key]);
    const need = prac ? RANK_MIN.prac : /\|week$/.test(k) ? RANK_MIN.clsWeek : RANK_MIN.clsMonth;
    const ok = all.filter(x => (prac ? x.q : x.c) >= need);
    ok.sort((a, b) => b.f / b.q - a.f / a.q || b.q - a.q || a.t / a.q - b.t / b.q);   // 정답률 → 푼 문항 수 → 문항당 시간
    const row = x => ({ name: x.name, acc: Math.round(x.f / x.q * 1000) / 10, q: x.q, c: x.c });
    out.lists[k] = { n: ok.length, total: all.length, top: ok.slice(0, RANK_TOP).map(row) };
    if (prac) { const qty = all.slice().sort((a, b) => b.q - a.q || b.f / b.q - a.f / a.q); out.lists[k + '|qty'] = { n: qty.length, total: all.length, top: qty.slice(0, RANK_TOP).map(row) }; }
  });
  return out;
}

// 관리자 토큰 확인 — 성적노트 engine.js 의 isAdmin(env, token) 과 같은 검사:
// adminLogin 이 넣어 둔 캐시 「adm:<토큰>」이 아직 살아 있고(exp), 그 값이 ADMIN_GEN(비밀번호를 바꾸면 달라짐, 없으면 '1')과 같아야 함.
export async function isAdmin(q, token) {
  const t = String(token || '');
  if (!t || t.length > 100) return false;
  const c = await q('select v from public.kv_cache where k=$1 and exp>now()', ['adm:' + t]);
  if (!c.length) return false;
  const g = await prop(q, 'ADMIN_GEN');
  return String(c[0].v) === (g === null || g === undefined || g === '' ? '1' : String(g));
}

// 강사 화면 「학생 분석」: 예전 구글 시트와 같은 열 모양으로 돌려줌.
// 허용: 관리자 토큰(허브 강사 로그인 · token) 또는 QUIZ_KEY(옛 화면 · key). 토큰이 틀리면 성적노트 강사 요청과 같은 needLogin 응답.
export async function stats(q, key, token) {
  const t = String(token || ''), k = String(key || '');
  let allowed = false;
  if (t && await isAdmin(q, t)) allowed = true;
  if (!allowed && k) { const want = await prop(q, 'QUIZ_KEY'); allowed = !!want && k === want; }
  if (!allowed) return t ? { ok: false, error: '관리자 로그인이 필요해요.', needLogin: true } : { ok: false, error: 'key' };
  const R = await roster(q);
  const rows = await q('select "시각" t, "번호" no, "이름" nm, "반" cls, "범위" setn, "첫시도정답" f, "걸린시간" tm, "틀린문항" w, "시도횟수" r from public."퀴즈기록" order by "시각", id');
  return { ok: true, head: ['타임스탬프', '이름', '반', '범위', '첫 시도 정답', '걸린 시간(초)', '틀린 문항', '시도 횟수'],
    rows: rows.map(r => {
      const mt = String(r.cls).trim() !== GUEST_CLS ? match(R, r.no || r.nm) : null;
      return [kst(new Date(r.t)).toISOString().slice(0, 19) + '+09:00', mt ? mt.name : r.nm, r.cls, r.setn, r.f, r.tm === '' ? '' : +r.tm, r.w, r.r === '' ? '' : +r.r];
    }), at: new Date().toISOString() };
}

// 결과 기록. 원생은 일련번호(rid)로 오고 서버가 명단 이름을 붙임. 원외생·이름만 온 것은 그대로.
export async function log(q, p) {
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const R = await roster(q), rid = sidNorm(p.rid || '');
  let no = '', nm = s(p.name, 40);
  if (SID_RE.test(rid)) { const r = R.ids[rid]; if (!r || r.out) return { ok: false, error: 'id' }; no = rid; nm = r.name; }
  if (!nm) return { ok: false, error: 'name' };
  const first = Number(p.first), n = Number(p.n);
  if (!(n > 0 && first >= 0 && first <= n)) return { ok: false, error: 'score' };
  await q('insert into public."퀴즈기록"("번호","이름","반","범위","첫시도정답","걸린시간","틀린문항","시도횟수","판") values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [no, nm, s(p.cls, 20), s(p.setName, 80), first + '/' + n, String(Math.max(0, Math.round(Number(p.elapsed) || 0))), s(p.wrong, 1500), String(Math.round(Number(p.rounds) || 1)), s(p.env, 10)]);
  return { ok: true };
}
