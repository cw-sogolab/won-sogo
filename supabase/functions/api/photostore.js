// 사진 저장소 고르기: kv_props 에 PHOTO_URL·PHOTO_KEY 가 있으면 선생님 구글 드라이브(photo-store/Code.gs 웹앱),
// 없으면 Supabase Storage(fallback). 드라이브를 켜기 전에 Storage 에 올라간 사진은 드라이브에 없으면 Storage 에서 읽음.
export function makeStorage({ q, fallback, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  let conf = null, at = 0;
  async function drive() {
    if (conf !== null && now() - at < 60000) return conf;
    const rows = await q("select k, v from public.kv_props where k in ('PHOTO_URL','PHOTO_KEY')");
    const m = Object.fromEntries(rows.map(r => [r.k, String(r.v || '').trim()]));
    conf = /^https:\/\/script\.google\.com\//.test(m.PHOTO_URL || '') && m.PHOTO_KEY ? { url: m.PHOTO_URL, key: m.PHOTO_KEY } : false;
    at = now();
    return conf;
  }
  async function gas(c, action, data) {
    let j = null;
    try {
      const r = await fetchImpl(c.url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(Object.assign({ key: c.key, action }, data)), redirect: 'follow' });
      j = JSON.parse(await r.text());
    } catch (e) { throw new Error('사진 창고(구글 드라이브)가 응답하지 않아요. 잠시 뒤 다시 해 주세요.'); }
    if (!j.ok) throw new Error('사진 창고(구글 드라이브) 오류: ' + (j.error || ''));
    return j;
  }
  return {
    async upload(path, mime, b64) { const c = await drive(); if (!c) return fallback.upload(path, mime, b64); await gas(c, 'upload', { path, mime, b64 }); },
    async download(path) {
      const c = await drive(); if (!c) return fallback.download(path);
      const r = await gas(c, 'get', { path });
      return r.missing ? fallback.download(path) : { mime: r.mime, b64: r.b64 };
    },
    async remove(path) {
      const c = await drive(); if (!c) return fallback.remove(path);
      await gas(c, 'remove', { path });
      try { await fallback.remove(path); } catch (e) { /* Storage 에 없으면 그만 */ }
    },
  };
}
