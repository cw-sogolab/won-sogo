// node supabase/test/pg.test.mjs — 메모리 저장소(Mock)와 Postgres(PGlite)에 같은 요청을 보내 응답·최종 표가 같은지 비교
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert';
import { makeRunner } from '../functions/api/pgstore.js';
const require = createRequire(import.meta.url);
process.env.TZ = 'Asia/Seoul';
const Logic = require('../../docs/dev/assets/logic.js');
const Mock = require('../../docs/dev/assets/mock.js');
const NOW = new Date('2026-10-20T12:00:00+09:00');
let seq = 0; const rnd = () => ++seq * 7919;       // 두 쪽이 같은 순서로 같은 값을 쓰게 (열쇠가 같아짐)
const mkEnv = () => { seq = 0; const e = Mock.seed(Mock.createEnv({ now: () => NOW })); e.uuid = () => 'tok-' + (++seq); e.rand32 = rnd; return e; };

const mem = mkEnv();
const db = new PGlite();
await db.exec('create schema storage; create table storage.buckets(id text primary key, name text, public boolean);');
await db.exec(fs.readFileSync(new URL('../migrations/001_grades.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../migrations/002_qna.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../migrations/003_char.sql', import.meta.url), 'utf8'));
const q = async (t, p) => (await db.query(t, p)).rows;
const tx = async fn => { await db.query('begin'); try { const r = await fn(q); await db.query('commit'); return r; } catch (e) { await db.query('rollback'); throw e; } };
const Q = s => '"' + s + '"';
const seed = mkEnv();
for (const t of Object.keys(Logic.TABLES)) for (const r of seed._tables[t]) {
  const c = Logic.TABLES[t];
  await q(`insert into public.${Q(t)}(${c.map(Q).join(',')}) values(${c.map((_, i) => '$' + (i + 1)).join(',')})`, c.map(h => String(r[h] ?? '')));
}
// 읽기 전용 퇴근 미션 기록(시각은 timestamptz — 한국 시각으로 넣음)·미리보기 접속기록도 같은 내용으로
for (const r of seed._tables['퀴즈기록']) {
  const c = Logic.READONLY['퀴즈기록'];
  await q(`insert into public."퀴즈기록"(${c.map(Q).join(',')}) values($1::timestamptz,${c.slice(1).map((_, i) => '$' + (i + 2)).join(',')})`, [r['시각'] + ':00+09'].concat(c.slice(1).map(h => String(r[h] ?? ''))));
}
for (const r of seed._log) await q(`insert into public."접속기록"(${Logic.ACCESS_HEAD.map(Q).join(',')}) values(${Logic.ACCESS_HEAD.map((_, i) => '$' + (i + 1)).join(',')})`, Logic.ACCESS_HEAD.map(h => String(r[h] ?? '')));
await q("insert into public.kv_props(k,v) values('ADMIN_PASSWORD','demo'),('SHOW_KEY','N')");
const files = new Map(); const removed = [];
seq = 0;
const pg = makeRunner({ Logic, q, tx, now: () => NOW, uuid: () => 'tok-' + (++seq), rand32: rnd,
  storage: { remove: async p => { removed.push(p); }, upload: async (p, m, b) => { files.set(p, { mime: m, b64: b }); }, download: async p => files.get(p) } });
const WR = new Set(Logic.WRITES);

let n = 0;
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'tok' || k === 'token' || k === 'time' || k === 'ts' || k === 'fileId' ? undefined : v)));
async function both(action, payload, label) {
  seq = 100 * (++n);
  const a = strip(Logic.handle(mem, action, typeof payload === 'function' ? payload(0) : payload));
  seq = 100 * n;
  const b = strip(await pg.run(action, typeof payload === 'function' ? payload(1) : payload, { write: WR.has(action) }));
  assert.deepStrictEqual(b, a, label || action);
  console.log('  ok  ' + (label || action));
  return [Logic.handle ? null : null, a];
}
async function raw(action, payload) {   // 열쇠를 받아야 하는 요청: 두 쪽 각자 결과를 돌려줌
  const P = i => typeof payload === 'function' ? payload(i) : payload;
  seq = 100 * (++n); const a = Logic.handle(mem, action, P(0));
  seq = 100 * n;     const b = await pg.run(action, P(1), { write: WR.has(action) });
  assert.deepStrictEqual(strip(b), strip(a), action); console.log('  ok  ' + action); return [a, b];
}

await both('ping', {});
let [sa, sb] = await raw('login', { code: 'KM482919', dev: 'dev1' });
assert.ok(sa.ok && sb.ok, '학생 로그인');
await both('login', { code: 'ZZ000000', dev: 'dev1' }, '없는 번호');
const [aa, ab] = await raw('adminLogin', { password: 'demo', dev: 'adm1' });
assert.ok(aa.ok && ab.ok, '강사 로그인');
const T = [aa.data.token, ab.data.token];
const withTok = o => i => Object.assign({}, o, { token: T[i] });
await both('bootstrap', withTok({}), '강사 bootstrap');
await both('bootstrap', { token: 'wrong' }, '잘못된 열쇠 거절');
console.log('  (열쇠 같음:', aa.data.token === ab.data.token, ')');
await both('login', { code: 'TR520615', dev: 'dev2' }, '다른 학생 로그인');
// 쓰기: 답안 입력·고치기·지우기
const ex = mem._tables['시험'].find(e => e['시험ID'] === 'E2');
await both('saveResult', withTok({ exam: 'E2', code: 'KM482919', answers: ex['정답'].slice(0, 12) + '111' }), '답안 저장');
await both('saveResult', withTok({ exam: 'E2', code: 'KM482919', answers: ex['정답'] }), '답안 다시 저장(고치기)');
await both('login', { code: 'KM482919', dev: 'dev1' }, '저장 뒤 학생 화면');
await both('deleteResult', withTok({ exam: 'E2', code: 'KM482919' }), '답안 지우기');
// 숙제 사진 올리기(학생 열쇠)
const tok = [sa.data.tok, sb.data.tok];
const hw = mem._tables['숙제'][0]['숙제ID'];
const jpg = Buffer.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0]).toString('base64');
await both('hwPhoto', i => ({ tok: tok[i], hw, b64: jpg, hash: '0'.repeat(64) }), '사진 올리기');
assert.strictEqual(files.size, 1, '사진 파일이 저장소에 올라감');
assert.strictEqual((await q('select count(*)::int c from public."숙제사진" where "파일ID"<>$1',[''])).at(0).c >= 1, true);
{ const path = [...files.keys()][0]; const pr = await pg.run('photo', { token: T[1], id: path }, { write: false });
  assert.ok(pr.ok && pr.data.b64 === jpg, '올린 사진을 서버가 다시 읽어 보냄'); console.log('  ok  사진 읽기(photo)'); }
await both('hwFinish', i => ({ tok: tok[i], hw, score: 5 }), '숙제 제출 마무리');
// 커리큘럼·QnA (2026-11-24): 같은 요청에 메모리·Postgres 가 같은 답. 새로 만든 질문 ID·사진 파일 이름은 저장소마다 달라서 비교할 때만 바꿔 놓음
files.set('mock-q1', mem.readImage('mock-q1')); files.set('mock-q2', mem.readImage('mock-q2'));   // 시드 질문 사진(두 쪽이 같은 그림을 가짐)
const loose = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'tok' || k === 'token' || k === 'time' || k === 'ts' || k === 'fileId' ? undefined : v))
  .replace(/"Q(?!DEMO)[0-9A-Z]{8,}"/g, '"QNEW"').replace(/"(?:mock-\d+|QNA\/[^"]*)"/g, '"F"'));
async function pair(action, payload, label) {   // 두 쪽 각자의 응답을 돌려주고, 새 ID·파일 이름만 가린 모양이 같은지 확인
  const P = i => typeof payload === 'function' ? payload(i) : payload;
  seq = 100 * (++n); const a = Logic.handle(mem, action, P(0));
  seq = 100 * n;     const b = await pg.run(action, P(1), { write: WR.has(action) });
  assert.deepStrictEqual(loose(b), loose(a), label || action); console.log('  ok  ' + (label || action)); return [a, b];
}
const JPG = jpg;
await both('curriculum', i => ({ tok: tok[i] }), '커리큘럼');
{ const r = await pg.run('curriculum', { tok: tok[1] }, { write: false });
  assert.ok(r.ok && r.data.classes.length >= 1 && r.data.classes[0].months.length >= 1, '커리큘럼에 월별 계획서가 있음');
  assert.ok(!JSON.stringify(r).includes('sample-teacher-id'), '강사 연락처는 안 나감'); }
await both('qnaList', i => ({ tok: tok[i] }), 'QnA 목록(내 질문·공개 답변)');
await both('qnaPhoto', i => ({ tok: tok[i], id: 'mock-q1' }), 'QnA 내 질문 사진 읽기');
await both('qnaPhoto', i => ({ tok: tok[i], id: 'mock-q2' }), 'QnA 내 질문 답변 사진 읽기');
{ const [a, b] = await pair('qnaPhoto', i => ({ tok: tok[i], id: 'nope' }), 'QnA 없는 사진 거절'); assert.ok(!a.ok && !b.ok); }
const ask = (i, o) => Object.assign({ tok: tok[i], subject: '경제', title: '새 질문', body: '내용입니다', public: true, photos: [{ b64: JPG }, { b64: JPG }] }, o || {});
const [qa, qb] = await pair('qnaAsk', i => ask(i), 'QnA 질문 올리기(사진 2장)'); assert.ok(qa.ok && qb.ok);
assert.ok([...files.keys()].filter(k => k.startsWith('QNA/')).length === 2, '질문 사진 두 장이 Storage 의 QNA/ 에 올라감'); assert.ok(![...files.keys()].some(k => k.startsWith('QNA/') && k.includes('KM482919')), '질문 사진 경로에 학생 번호가 없음');
await pair('qnaAsk', i => ask(i, { photos: [{ b64: 'iVBORw0KGgo=' }] }), 'QnA 질문: PNG 거절');
await pair('qnaAsk', i => ask(i, { title: '' }), 'QnA 질문: 빈 제목 거절');
const qid = [qa.data.id, qb.data.id];
const lists = [Logic.handle(mem, 'qnaList', { tok: tok[0] }), await pg.run('qnaList', { tok: tok[1] }, { write: false })];
assert.deepStrictEqual(loose(lists[1]), loose(lists[0]), '질문 뒤 목록'); console.log('  ok  QnA 질문 뒤 목록');
const mine0 = [lists[0].data.mine.find(q => q.id === qid[0]), lists[1].data.mine.find(q => q.id === qid[1])];
await pair('qnaPhoto', i => ({ tok: tok[i], id: mine0[i].photos[0] }), 'QnA 새 질문 사진 읽기');
{ const [a, b] = await pair('qnaPhoto', i => ({ tok: tok[i], id: 'mock-p0' }), 'QnA 숙제 사진은 못 읽음'); assert.ok(!a.ok && !b.ok); }
for (let k = 0; k < 4; k++) await pair('qnaAsk', i => ask(i, { photos: [] }), 'QnA 질문 ' + (k + 3) + '번째');
{ const [a, b] = await pair('qnaAsk', i => ask(i, { photos: [] }), 'QnA 1분에 5건 넘으면 거절'); assert.ok(!a.ok && !b.ok && /1분/.test(b.error)); }
await pair('qnaList', i => ({ tok: tok[i] }), 'QnA 목록(질문 여러 개)');
// 강사: 목록·답변(사진)·수정·사진 읽기
await pair('qnaAdminList', i => ({ token: T[i] }), 'QnA 강사 목록');
const [aa1, ab1] = await pair('qnaAnswer', i => ({ token: T[i], id: qid[i], answer: '답변입니다', photos: [{ b64: JPG }] }), 'QnA 강사 답변(사진 1장)'); assert.ok(aa1.ok && ab1.ok);
const [aa2, ab2] = await pair('qnaAnswer', i => ({ token: T[i], id: qid[i], answer: '고친 답변', public: false, removePhotos: [[aa1, ab1][i].data.answerPhotos[0]] }), 'QnA 강사 답변 수정(사진 지움·비공개)');
assert.deepStrictEqual(aa2.data.answerPhotos, []); assert.deepStrictEqual(ab2.data.answerPhotos, []);
assert.ok(removed.some(p => /^QNA\/QNA_Q[0-9A-Z]+_a/.test(p)), '지운 답변 사진 파일이 Storage 에서 지워짐');
await both('qnaAdminPhoto', i => ({ token: T[i], id: 'mock-q1' }), 'QnA 강사 사진 읽기');
await pair('qnaAnswer', i => ({ token: T[i], id: 'nope', answer: 'x' }), 'QnA 없는 질문 답변 거절');
await pair('qnaAdminList', i => ({ token: T[i], status: '답변' }), 'QnA 강사 목록(답변만)');
await pair('qnaList', i => ({ tok: tok[i] }), 'QnA 답변 뒤 학생 목록');
// 삭제: 학생(답변 없는 것)·강사
const [qc, qd] = await pair('qnaAsk', i => ask(i, { photos: [{ b64: JPG }] }), 'QnA 지울 질문 올리기'); // (1분 제한이 이미 찼을 수 있어 실패해도 두 쪽이 같아야 함)
{ const before = removed.length;
  const mk = [qc, qd].map(x => x.ok ? x.data.id : null);
  if (mk[0]) { const [a, b] = await pair('qnaDelete', i => ({ tok: tok[i], id: mk[i] }), 'QnA 학생 삭제'); assert.ok(a.ok && b.ok); assert.ok(removed.length > before, '사진 파일 지움'); } }
{ const [a, b] = await pair('qnaDelete', i => ({ tok: tok[i], id: 'QDEMO1' }), 'QnA 답변 달린 질문은 학생이 못 지움'); assert.ok(!a.ok && !b.ok); }
{ const [a, b] = await pair('qnaAdminDelete', i => ({ token: T[i], id: qid[i] }), 'QnA 강사 삭제'); assert.ok(a.ok && b.ok); }
{ const [a, b] = await pair('qnaAdminList', i => ({ token: 'wrong' }), 'QnA 강사 열쇠 없이 거절'); assert.ok(!a.ok && !b.ok); }
// 몽글이 꾸미기 (2026-11-26): 퀴즈기록(읽기 전용)·학생별 접속기록을 읽어 계산한 결과가 두 쪽 같음
{ const [a] = await raw('charGet', i => ({ tok: tok[i] }));
  assert.ok(a.ok && a.data.items.length === 24 && a.data.star > 0, '꾸미기 목록·별');
  assert.ok(a.data.items.find(x => x.kind === 'body' && x.id === 'sky').owned, '퀴즈기록 날짜 + 접속기록 날짜로 7일 연속'); }
await both('charSet', i => ({ tok: tok[i], body: 'sky', hat: 'beanie', glasses: 'sun', charm: 'heart' }), '꾸미기 입기');
{ const [a, b] = await raw('charSet', i => ({ tok: tok[i], hat: 'crown' })); assert.ok(!a.ok && !b.ok && b.error === '아직 얻지 못한 아이템이에요', '못 얻은 아이템 거절'); }
await both('charSet', i => ({ tok: tok[i], show: false }), '꾸미기 끄기');
await both('charGet', i => ({ tok: tok[i] }), '끈 뒤 charGet');
await both('charSet', i => ({ tok: tok[i], body: 'mint', show: true }), '꾸미기 켜기·바꾸기');
{ let thrown = ''; try { await pg.run('x', {}, { fn: env => env.store.append('퀴즈기록', { '번호': 'X' }) }); } catch (e) { thrown = e.message; }
  assert.ok(/읽기만/.test(thrown), '퀴즈기록은 서버 규칙에서 쓸 수 없음'); console.log('  ok  퀴즈기록 쓰기 거절'); }
// 전부 열기(시험용)
mem._props.CHAR_UNLOCK_ALL = 'Y'; await q("insert into public.kv_props(k,v) values('CHAR_UNLOCK_ALL','Y')");
{ const [a] = await raw('charGet', i => ({ tok: tok[i] })); assert.ok(a.data.items.every(x => x.owned), 'CHAR_UNLOCK_ALL=Y'); }
await both('charSet', i => ({ tok: tok[i], hat: 'crown' }), '전부 열기 때 희귀 입기');
delete mem._props.CHAR_UNLOCK_ALL; await q("delete from public.kv_props where k='CHAR_UNLOCK_ALL'");
// 접속기록 (강사 요약 — pgstore 가 Code.gs·미리보기와 같은 {시각,번호,…} 줄을 돌려줌)
await both('accessLog', withTok({ code: 'KM482919' }), '강사 접속기록 요약');
{ const r = await pg.run('accessLog', { token: T[1], code: 'KM482919' }, {}); assert.ok(r.data.sum.KM482919 && r.data.rows.length >= 3, '접속기록 요약이 비지 않음'); }
await both('adminLogin', { password: 'nope', dev: 'x' }, '틀린 비밀번호');
// 최종 표 비교
for (const t of Object.keys(Logic.TABLES)) {
  const c = Logic.TABLES[t];
  const norm = (h, v) => (t === '숙제사진' && h === '파일ID' ? (v ? 'F' : '') : t === '질문' && (h === '사진' || h === '답변사진') ? String(v).split(',').filter(Boolean).map(x => /^mock-q\d$/.test(x) ? x : 'F').join(',') : t === '질문' && h === '질문ID' ? (/^QDEMO/.test(v) ? v : 'QNEW') : v);   // 파일 이름·새 질문 ID 는 저장소마다 다름
  const rows = (await q(`select * from public.${Q(t)} order by id`)).map(r => c.map(h => norm(h, r[h])));
  const exp = mem._tables[t].map(r => c.map(h => norm(h, String(r[h] ?? ''))));
  assert.deepStrictEqual(rows, exp, '표 ' + t);
}
console.log('  ok  모든 표가 같음');
console.log('사진 파일', [...files.keys()]);
console.log('접속기록', (await q('select count(*)::int c from public."접속기록"'))[0].c, '줄 (메모리 쪽', mem._log.length, ')');
// 3개월 지난 사진 정리
await q("insert into public.\"숙제사진\"(\"숙제ID\",\"번호\",\"순서\",\"파일ID\",\"올린시각\") values('H1','KM482919','1','반/월/숙제/old.jpg','2026-05-01 10:00'),('H1','KM482919','2','반/월/숙제/new.jpg','2026-10-19 10:00')");
const cr = await pg.run('cleanupPhotos', {}, { write: true, fn: (env, h) => Logic.cleanupPhotos(env, h.trash, 200) });
assert.strictEqual(cr.removed, 1); assert.deepStrictEqual(removed.filter(p => !p.startsWith('QNA/')), ['반/월/숙제/old.jpg']); assert.strictEqual(removed.filter(p => p.startsWith('QNA/')).length, 3, '질문 사진 2장 + 답변 사진 1장이 Storage 에서 지워짐');
assert.strictEqual((await q("select \"파일ID\" f from public.\"숙제사진\" where \"올린시각\"='2026-05-01 10:00'"))[0].f, '');
console.log('  ok  오래된 사진 정리(파일 지움·표시)');
console.log('passes of last run', pg.stats.passes);
console.log('PASS');
