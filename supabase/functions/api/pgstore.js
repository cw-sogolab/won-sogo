// Postgres 저장소로 Logic.handle 을 돌리는 어댑터 (Deno Edge Function 과 node 테스트가 같이 씀).
// Logic 은 동기 코드(store.all()이 바로 배열을 돌려줌)라서, 필요한 표·캐시·설정을 「빈 값으로 한 번 돌려 보며 무엇이 필요한지 적어 두고 → 읽어 오고 → 더 필요한 게 없을 때까지 반복」 방식으로 채웁니다.
//    (예외를 던지지 않는 이유: handle() 안의 try/catch 가 예외를 삼킴.) 마지막 한 번은 필요한 것이 전부 읽힌 채로 도는 진짜 실행입니다.
//  - 한 요청 안에서 쓰는 쓰기는 메모리 사본에만 하고, 끝나면 바뀐 줄만 한 트랜잭션으로 저장(= Code.gs 의 flush 와 같은 모양).
//  - 쓰기 요청은 pg_advisory_xact_lock 으로 한 번에 하나만(= Apps Script 의 LockService).
// q(text, params) → Promise<rows[]>  /  tx(fn) → fn(q) 를 한 트랜잭션으로
const S = v => (v === null || v === undefined ? '' : String(v));
const Q = s => '"' + String(s).replace(/"/g, '""') + '"';

export function makeRunner({ Logic, q, tx, storage, now = () => new Date(), uuid = () => crypto.randomUUID(), rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0] }) {
  const base = {};          // 표 이름 → [{id, ...열}]   (읽어 온 그대로, 요청 동안 안 바뀜)
  const kv = new Map();     // 캐시 키 → 값|null
  const props = new Map();  // 설정 키 → 값|null
  const imgs = new Map();   // 사진 경로 → {mime,b64}
  let logRows = null, propsAll = false;
  const stats = { passes: 0 };
  const cols = t => Logic.TABLES[t] || (t === '접속기록' ? Logic.ACCESS_HEAD : null);

  async function run(action, payload, { write, fn } = {}) {
    // 요청마다 처음부터 읽음(다른 Edge 인스턴스가 쓴 것을 놓치지 않게). 쓰기 요청은 읽기 전에 잠금부터 잡아 읽고-고치고-쓰는 사이에 끼어들지 못하게 함
    Object.keys(base).forEach(k => delete base[k]); kv.clear(); props.clear(); imgs.clear(); logRows = null; propsAll = false; stats.passes = 0;
    if (write) return tx(async qq => { await qq('select pg_advisory_xact_lock(7101)'); return go(qq, true, action, payload, fn); });
    return go(q, false, action, payload, fn);
  }
  // 왕복 줄이기: 첫 왕복에 모든 표(접속기록 제외)와 설정을 한 번에 읽음 → 대부분 요청이 두 번째 판에서 끝남
  async function preload(qr) {
    const names = Object.keys(Logic.TABLES);
    const sqlText = names.map(t => "select '" + t.replace(/'/g, "''") + "' as t, coalesce(json_agg(row_to_json(x) order by x.id), '[]'::json) as d from public." + Q(t) + " x")
      .concat("select 'kv_props' as t, coalesce(json_object_agg(k, v), '{}'::json) as d from public.kv_props").join(' union all ');
    for (const r of await qr(sqlText)) {
      const d = typeof r.d === 'string' ? JSON.parse(r.d) : r.d;
      if (r.t === 'kv_props') { Object.keys(d).forEach(k => props.set(k, d[k])); propsAll = true; }
      else base[r.t] = d.map(o => Object.assign(o, { id: Number(o.id) }));
    }
  }
  async function go(qr, inTx, action, payload, fn) {
    await preload(qr);
    for (let attempt = 0; attempt < 60; attempt++) {
      stats.passes++;
      const work = {}, cacheW = new Map(), accessNew = [], uploads = [], removes = [], missing = new Map();
      const T = t => {
        if (!cols(t)) throw new Error('표 「' + t + '」가 없어요.');
        if (!base[t]) { missing.set('t:' + t, async () => { base[t] = (await qr('select * from public.' + Q(t) + ' order by id')).map(r => Object.assign(r, { id: Number(r.id) })); }); return { rows: [], ids: new Set() }; }
        return work[t] || (work[t] = { rows: base[t].map(r => Object.assign({}, r)), ids: new Set(base[t].map(r => r.id)) });
      };
      const env = {
        store: {
          all: t => T(t).rows.map(r => { const o = {}; cols(t).forEach(h => { o[h] = S(r[h]); }); return o; }),
          head: t => cols(t).slice(),
          append: (t, o) => { const w = T(t), r = { id: null }; cols(t).forEach(h => { r[h] = o[h] === undefined || o[h] === null ? '' : S(o[h]); }); w.rows.push(r); },
          update: (t, pred, patch) => { let n = 0; T(t).rows.forEach(r => { if (!pred(shape(t, r))) return; Object.keys(patch).forEach(k => { if (cols(t).indexOf(k) >= 0) r[k] = S(patch[k]); }); n++; }); return n; },
          remove: (t, pred) => { const w = T(t), before = w.rows.length; w.rows = w.rows.filter(r => !pred(shape(t, r))); return before - w.rows.length; },
          flush() {}, warm() {}
        },
        cache: {
          get: k => {
            if (cacheW.has(k)) return cacheW.get(k).v;
            if (!kv.has(k)) { missing.set('c:' + k, async () => { const r = await qr('select v from public.kv_cache where k=$1 and exp>now()', [k]); kv.set(k, r.length ? r[0].v : null); }); return null; }
            return kv.get(k);
          },
          put: (k, v, sec) => { cacheW.set(k, { v: S(v), sec: Math.max(1, sec | 0) }); },
          remove: k => { cacheW.set(k, { v: null }); }
        },
        props: { get: k => {
          if (!props.has(k) && propsAll) props.set(k, null);
          if (!props.has(k)) { missing.set('p:' + k, async () => { const r = await qr('select v from public.kv_props where k=$1', [k]); props.set(k, r.length ? r[0].v : null); }); return ''; }
          return props.get(k) || '';
        } },
        now, uuid, rand32,
        logAccess: row => { accessNew.push(row); },
        readLog: () => {
          if (!logRows) { missing.set('l', async () => { logRows = await qr('select * from public."접속기록" order by id desc limit 20000'); }); return []; }
          return logRows.map(r => Logic.ACCESS_HEAD.map(h => S(r[h]))).reverse().concat(accessNew.map(r => Logic.ACCESS_HEAD.map(h => S(r[h]))));
        },
        saveImage: o => {
          // Storage 경로는 영문·숫자·._- 만 (한글·공백·콜론이 든 반 이름·숙제 이름은 경로에 안 씀 — 뜻은 「숙제사진」 표가 가짐)
          const safe = x => String(x).replace(/[^A-Za-z0-9._-]/g, '_');
          const path = safe(String(o.name).split('_')[0]) + '/' + safe(o.name);
          uploads.push({ path, mime: o.mime, b64: o.b64 }); return path;
        },
        trashImage: id => { removes.push(id); },   // QnA 질문을 지울 때 사진 파일도 지움 (저장이 끝난 뒤 Storage 에서)
        readImage: id => {
          if (!imgs.has(id)) { missing.set('i:' + id, async () => { imgs.set(id, await storage.download(id)); }); return { mime: 'image/jpeg', b64: '' }; }
          return imgs.get(id);
        }
      };
      let result;
      result = fn ? fn(env, { trash: id => { removes.push(id); } }) : Logic.handle(env, action, payload);
      if (missing.size) { await Promise.all([...missing.values()].map(f => f())); continue; }
      // 저장: 사진 먼저(실패하면 DB 는 그대로), 그다음 바뀐 줄·캐시·접속기록을 한 트랜잭션으로
      await Promise.all(uploads.map(u => storage.upload(u.path, u.mime, u.b64)));   // 한꺼번에 (드라이브는 장당 2~4초 — 쓰기 잠금을 오래 잡지 않게)
      const changed = Object.keys(work).some(t => diff(t, work[t]).any) || cacheW.size || accessNew.length;
      if (changed) {
        const commit = async qq => {
          for (const t of Object.keys(work)) await save(qq, t, work[t]);
          for (const [k, o] of cacheW) {
            if (o.v === null) await qq('delete from public.kv_cache where k=$1', [k]);
            else await qq('insert into public.kv_cache(k,v,exp) values($1,$2,now()+make_interval(secs=>$3)) on conflict(k) do update set v=excluded.v, exp=excluded.exp', [k, o.v, o.sec]);
          }
          for (const r of accessNew) await qq('insert into public."접속기록"(' + Logic.ACCESS_HEAD.map(Q).join(',') + ') values(' + Logic.ACCESS_HEAD.map((_, i) => '$' + (i + 1)).join(',') + ')', Logic.ACCESS_HEAD.map(h => S(r[h])));
        };
        if (inTx) await commit(qr); else await tx(commit);
        // 다음 요청이 새 내용을 보게 함 (이 러너가 오래 살아 있을 때 대비)
        Object.keys(work).forEach(t => { delete base[t]; }); kv.clear(); logRows = null;
      }
      for (const id of removes) { try { await storage.remove(id); } catch (e) { /* 파일이 이미 없으면 그냥 둠 */ } }
      return result;
    }
    throw new Error('저장소를 읽는 데 너무 오래 걸려요.');
  }
  function shape(t, r) { const o = {}; cols(t).forEach(h => { o[h] = S(r[h]); }); return o; }
  function diff(t, w) {
    const b = base[t] || [], bm = new Map(b.map(r => [r.id, r]));
    const ins = w.rows.filter(r => r.id === null);
    const keep = w.rows.filter(r => r.id !== null);
    const del = b.filter(r => !keep.some(k => k.id === r.id)).map(r => r.id);
    const upd = keep.filter(r => cols(t).some(h => S(r[h]) !== S(bm.get(r.id)[h])));
    return { ins, del, upd, any: ins.length || del.length || upd.length };
  }
  async function save(qq, t, w) {
    const d = diff(t, w), c = cols(t);
    if (d.del.length) await qq('delete from public.' + Q(t) + ' where id = any($1::bigint[])', [d.del]);
    for (const r of d.upd) await qq('update public.' + Q(t) + ' set ' + c.map((h, i) => Q(h) + '=$' + (i + 2)).join(',') + ' where id=$1', [r.id].concat(c.map(h => S(r[h]))));
    for (const r of d.ins) await qq('insert into public.' + Q(t) + '(' + c.map(Q).join(',') + ') values(' + c.map((_, i) => '$' + (i + 1)).join(',') + ')', c.map(h => S(r[h])));
  }
  return { run, stats };
}
