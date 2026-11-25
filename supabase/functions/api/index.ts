// 成績ノート + 帰宅クイズ 서버 (Supabase Edge Function). 화면은 예전 Apps Script 웹앱과 똑같이 {action, payload} 를 POST 합니다.
// 규칙은 전부 engine.js(= core.js + logic.js)에 있고, 여기는 Postgres·Storage 에 연결만 합니다.
import postgres from "npm:postgres@3.4.4";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Logic } from "./engine.js";
import { makeRunner } from "./pgstore.js";
import * as quiz from "./quiz.js";
import { makeStorage } from "./photostore.js";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 4, prepare: false, idle_timeout: 20 });
const q = (text: string, params: unknown[] = []) => sql.unsafe(text, params as never[]) as Promise<Record<string, unknown>[]>;
const tx = <T>(fn: (qq: typeof q) => Promise<T>) => sql.begin((t) => fn((text, params = []) => t.unsafe(text, params as never[]) as never)) as Promise<T>;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "hw-photos";
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const supaStorage = {
  async upload(path: string, mime: string, b64: string) {
    const { error } = await sb.storage.from(BUCKET).upload(path, b64ToBytes(b64), { contentType: mime, upsert: true });
    if (error) throw new Error("사진을 저장하지 못했어요: " + error.message);
  },
  async remove(path: string) { await sb.storage.from(BUCKET).remove([path]); },
  async download(path: string) {
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return { mime: data.type || "image/jpeg", b64: bytesToB64(new Uint8Array(await data.arrayBuffer())) };
  },
};
// 사진: kv_props 에 PHOTO_URL·PHOTO_KEY 가 있으면 선생님 구글 드라이브, 없으면 Supabase Storage
const storage = makeStorage({ q, fallback: supaStorage });
const runner = makeRunner({ Logic, q, tx, storage });
const WRITES = new Set(Logic.WRITES);

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization, apikey", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") {
    const u = new URL(req.url), mode = u.searchParams.get("mode"), cb = u.searchParams.get("callback") || "";
    const out = (o: unknown) => /^[\w.]+$/.test(cb)
      ? new Response(cb + "(" + JSON.stringify(o) + ")", { headers: { ...CORS, "content-type": "text/javascript; charset=utf-8" } })   // 예전 JSONP 방식도 받음
      : json(o);
    try {
      if (mode === "who") return out(await quiz.who(q, u.searchParams.get("id") || ""));
      if (mode === "rank") return out(await quiz.rank(q));
      if (mode === "stats") return out(await quiz.stats(q, u.searchParams.get("key") || "", u.searchParams.get("token") || ""));
    } catch (e) { console.error(mode, e); return out({ ok: false, error: "server" }); }
    return json({ ok: true, data: { app: "성적노트", time: new Date().toISOString() }, ver: Logic.VERSION });
  }
  let body: { action?: string; payload?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "요청을 읽지 못했어요." }); }
  const action = String(body.action || ""), payload = body.payload || {};
  if (action === "quizLog") { try { return json(await quiz.log(q, payload as never)); } catch (e) { console.error(e); return json({ ok: false, error: "server" }); } }
  if (action === "quizStats") { try { return json(await quiz.stats(q, "", String(payload.token || ""))); } catch (e) { console.error(e); return json({ ok: false, error: "server" }); } }   // 허브 강사 화면(관리자 토큰) — 응답은 mode=stats 와 같은 {ok,head,rows,at}
  if (action === "cron") {   // 정기 작업(GitHub Actions 가 부름): CRON_KEY 를 아는 쪽만. job = keepalive | cleanupPhotos
    const rows = await q("select v from public.kv_props where k='CRON_KEY'");
    if (!rows.length || String(payload.key || "") !== String(rows[0].v)) return json({ ok: false, error: "key" });
    try {
      if (payload.job === "cleanupPhotos") return json({ ok: true, data: await runner.run("cleanupPhotos", {}, { write: true, fn: (env: unknown, h: { trash: (id: string) => void }) => Logic.cleanupPhotos(env, h.trash, 200) }) });
      return json({ ok: true, data: { job: "keepalive", time: new Date().toISOString() } });
    } catch (e) { console.error(e); return json({ ok: false, error: String((e as Error)?.message || e) }); }
  }
  if (action === "ping") return json({ ok: true, data: { time: new Date().toISOString() }, ver: Logic.VERSION });
  try {
    return json(await runner.run(action, payload, { write: WRITES.has(action) }));
  } catch (e) {
    console.error(action, e);
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
