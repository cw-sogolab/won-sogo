// node supabase/test/photostore.test.mjs — 사진 저장소 고르기(드라이브 / Supabase Storage) 테스트. 가짜 fetch 가 photo-store/Code.gs 를 흉내 냄
import assert from 'node:assert';
import { makeStorage } from '../functions/api/photostore.js';
const KEY = 'k-secret', URL_ = 'https://script.google.com/macros/s/xxx/exec';
const drive = new Map(), supa = new Map(); let calls = [], down = false;
const fetchImpl = async (url, o) => {
  if (down) throw new Error('network');
  const b = JSON.parse(o.body); calls.push(b.action); assert.strictEqual(url, URL_);
  let r;
  if (b.key !== KEY) r = { ok: false, error: 'key' };
  else if (b.action === 'upload') { drive.set(b.path, { mime: b.mime, b64: b.b64 }); r = { ok: true }; }
  else if (b.action === 'get') r = drive.has(b.path) ? Object.assign({ ok: true }, drive.get(b.path)) : { ok: true, missing: true };
  else if (b.action === 'remove') { drive.delete(b.path); r = { ok: true }; }
  return { text: async () => JSON.stringify(r) };
};
const fallback = { upload: async (p, m, b) => { supa.set(p, { mime: m, b64: b }); }, download: async p => supa.get(p) || null, remove: async p => { supa.delete(p); } };
let props = [], t = 0;
const st = makeStorage({ q: async () => props, fallback, fetchImpl, now: () => t });
let n = 0; const ok = s => { n++; console.log('  ok  ' + s); };

await st.upload('AB123450/a.jpg', 'image/jpeg', 'AAA');
assert.ok(supa.has('AB123450/a.jpg') && !drive.size && !calls.length); ok('설정 없으면 Supabase Storage 로');
assert.deepStrictEqual(await st.download('AB123450/a.jpg'), { mime: 'image/jpeg', b64: 'AAA' }); ok('Storage 에서 읽기');

props = [{ k: 'PHOTO_URL', v: URL_ }, { k: 'PHOTO_KEY', v: KEY }]; t += 61000;   // 설정은 1분마다 다시 읽음
await st.upload('QNA/q1.jpg', 'image/jpeg', 'BBB');
assert.ok(drive.has('QNA/q1.jpg') && !supa.has('QNA/q1.jpg')); ok('설정 있으면 드라이브로');
assert.deepStrictEqual(await st.download('QNA/q1.jpg'), { mime: 'image/jpeg', b64: 'BBB' }); ok('드라이브에서 읽기');
assert.deepStrictEqual(await st.download('AB123450/a.jpg'), { mime: 'image/jpeg', b64: 'AAA' }); ok('드라이브에 없으면 예전 Storage 사진을 읽음');
assert.strictEqual(await st.download('none/x.jpg'), null); ok('어디에도 없으면 null');
await st.remove('QNA/q1.jpg'); await st.remove('AB123450/a.jpg');
assert.ok(!drive.size && !supa.size); ok('지울 때 양쪽 모두');

props = [{ k: 'PHOTO_URL', v: URL_ }, { k: 'PHOTO_KEY', v: 'wrong' }]; t += 61000;
await assert.rejects(() => st.upload('QNA/q2.jpg', 'image/jpeg', 'C'), /사진 창고/); ok('키가 틀리면 오류(조용히 넘어가지 않음)');
props = [{ k: 'PHOTO_URL', v: URL_ }, { k: 'PHOTO_KEY', v: KEY }]; t += 61000; down = true;
await assert.rejects(() => st.upload('QNA/q3.jpg', 'image/jpeg', 'C'), /응답하지 않아요/); ok('드라이브가 안 되면 오류');
props = [{ k: 'PHOTO_URL', v: 'http://evil.example/x' }, { k: 'PHOTO_KEY', v: KEY }]; t += 61000; down = false; calls = [];
await st.upload('QNA/q4.jpg', 'image/jpeg', 'D'); assert.ok(!calls.length && supa.has('QNA/q4.jpg')); ok('구글 주소가 아니면 쓰지 않음');
console.log(n + ' passed');
