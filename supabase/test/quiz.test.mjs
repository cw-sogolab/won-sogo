// node supabase/test/quiz.test.mjs — 퀴즈 서버 함수(who · stats · log)와 「관리자 토큰으로 학생 분석」(quizStats) 검사
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert';
import { makeRunner } from '../functions/api/pgstore.js';
import * as quiz from '../functions/api/quiz.js';
const require = createRequire(import.meta.url);
process.env.TZ = 'Asia/Seoul';
const Logic = require('../../docs/dev/assets/logic.js');
const NOW = new Date('2026-11-24T12:00:00+09:00');

const db = new PGlite();
await db.exec('create schema storage; create table storage.buckets(id text primary key, name text, public boolean);');
for (const f of ['001_grades.sql', '002_qna.sql', '003_char.sql']) await db.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const q = async (t, p) => (await db.query(t, p)).rows;
const tx = async fn => { await db.query('begin'); try { const r = await fn(q); await db.query('commit'); return r; } catch (e) { await db.query('rollback'); throw e; } };
let seq = 0;
const runner = makeRunner({ Logic, q, tx, now: () => NOW, uuid: () => 'tok-' + (++seq), storage: { remove: async () => {}, upload: async () => {}, download: async () => null } });

// 가상 학생 한 명만 (실제 명단 아님) · 퀴즈 기록 두 줄 (한 줄은 원외생)
await q(`insert into public."원생"("일련번호","이름","상태") values('KM482919','테스트학생','')`);
await q(`insert into public.kv_props(k,v) values('ADMIN_PASSWORD','pw-test'),('QUIZ_KEY','key-test')`);
await q(`insert into public."퀴즈기록"("번호","이름","반","범위","첫시도정답","걸린시간","틀린문항","시도횟수") values('KM482919','테스트학생','화목반','일본 지리 · 토도부현','8/10','120','P01 가','2'),('','손님','원외생','연습 · 세계','5/10','200','','1')`);
const ok = (name) => console.log('  ok  ' + name);

// 1) 관리자 로그인 → 토큰 (성적노트와 같은 흐름)
const login = await runner.run('adminLogin', { password: 'pw-test', dev: 'd1' }, { write: Logic.WRITES.includes('adminLogin') });
assert.ok(login.ok && login.data.token, '관리자 로그인');
const token = login.data.token;
ok('adminLogin → 토큰');

// 2) 토큰 검사
assert.strictEqual(await quiz.isAdmin(q, token), true); ok('isAdmin(진짜 토큰)');
assert.strictEqual(await quiz.isAdmin(q, 'tok-nope'), false); ok('isAdmin(없는 토큰)');
assert.strictEqual(await quiz.isAdmin(q, ''), false); assert.strictEqual(await quiz.isAdmin(q, undefined), false); ok('isAdmin(빈 값)');
assert.strictEqual(await quiz.isAdmin(q, "x' or '1'='1"), false); ok('isAdmin(이상한 값)');

// 3) 토큰으로 학생 분석 — 응답 모양은 key 방식과 같음
const a = await quiz.stats(q, '', token);
assert.ok(a.ok); assert.deepStrictEqual(a.head, ['타임스탬프', '이름', '반', '범위', '첫 시도 정답', '걸린 시간(초)', '틀린 문항', '시도 횟수']);
assert.strictEqual(a.rows.length, 2); assert.ok(a.at);
assert.strictEqual(a.rows[0][1], '테스트학생'); assert.strictEqual(a.rows[0][4], '8/10'); assert.strictEqual(a.rows[0][5], 120);
ok('stats(token) → {ok,head,rows,at}');
const b = await quiz.stats(q, 'key-test', '');
assert.deepStrictEqual(b.rows, a.rows); ok('stats(key) 옛 방식도 같은 응답');

// 4) 거절
let r = await quiz.stats(q, '', 'tok-nope'); assert.deepStrictEqual([r.ok, r.needLogin], [false, true]); assert.ok(!r.rows); ok('틀린 토큰 → needLogin');
r = await quiz.stats(q, 'wrong', ''); assert.deepStrictEqual([r.ok, r.error], [false, 'key']); ok('틀린 key → error key');
r = await quiz.stats(q, '', ''); assert.strictEqual(r.ok, false); ok('둘 다 없음 → 거절');
r = await quiz.stats(q, 'wrong', 'tok-nope'); assert.strictEqual(r.ok, false); ok('둘 다 틀림 → 거절');

// 5) 토큰이 만료되면(캐시 exp 지남) 거절
await q(`update public.kv_cache set exp=now()-interval '1 minute' where k=$1`, ['adm:' + token]);
r = await quiz.stats(q, '', token); assert.deepStrictEqual([r.ok, r.needLogin], [false, true]); ok('만료된 토큰 거절');

// 6) 비밀번호를 바꿔(ADMIN_GEN 변경) 예전 토큰이 무효가 되는지 — 새 로그인은 통과, 바뀐 뒤 예전 토큰은 거절
const l2 = await runner.run('adminLogin', { password: 'pw-test', dev: 'd2' }, { write: true });
assert.strictEqual(await quiz.isAdmin(q, l2.data.token), true);
await q(`insert into public.kv_props(k,v) values('ADMIN_GEN','2')`);
assert.strictEqual(await quiz.isAdmin(q, l2.data.token), false); ok('ADMIN_GEN 이 바뀌면 예전 토큰 무효');

// 7) 성적노트 쪽 검사와 같은 결과인지: 성적노트 강사 요청도 같은 토큰으로 통과/거절
await q(`delete from public.kv_props where k='ADMIN_GEN'`);
const l3 = await runner.run('adminLogin', { password: 'pw-test', dev: 'd3' }, { write: true });
const gr = await runner.run('bootstrap', { token: l3.data.token }, { write: Logic.WRITES.includes('bootstrap') });
assert.strictEqual(gr.ok, true); assert.strictEqual(await quiz.isAdmin(q, l3.data.token), true);
const gr2 = await runner.run('bootstrap', { token: 'tok-nope' }, {});
assert.strictEqual(gr2.ok, false); assert.strictEqual(await quiz.isAdmin(q, 'tok-nope'), false); ok('성적노트 isAdmin 과 같은 판정');

// 8) 랭킹 top[i] 에 캐릭터(char)·이름 첫 글자(ini) — 기존 칸(name·acc·q·c)은 그대로 (2026-11-26)
await q(`insert into public."원생"("일련번호","이름","상태") values('TR520615','둘째학생',''),('AB123450','셋째학생(동작)','')`);
await q(`insert into public."캐릭터"("번호","몸","모자","안경","키링","표시") values('KM482919','mint','cap','round','star','Y'),('TR520615','peach','none','none','none','N')`);
await q(`insert into public."퀴즈기록"("시각","번호","이름","반","범위","첫시도정답","걸린시간") values
  ('2026-11-23 21:00+09','KM482919','테스트학생','화목반','경제 1회','10/10','100'),('2026-11-23 21:01+09','TR520615','둘째학생','화목반','경제 1회','9/10','100'),
  ('2026-11-23 21:02+09','AB123450','셋째학생(동작)','화목반','경제 1회','8/10','100'),('2026-11-23 21:03+09','','이름만','화목반','경제 1회','7/10','100')`);
const rk = await quiz.rank(q, NOW);
const top = rk.lists['cls|전체|week'].top;
assert.deepStrictEqual(top.map(x => x.name), ['테스트학생', '둘째학생', '셋째학생', '이름만']);
assert.deepStrictEqual(Object.keys(top[0]), ['name', 'acc', 'q', 'c', 'char', 'ini']);
assert.deepStrictEqual(top[0].char, { body: 'mint', hat: 'cap', glasses: 'round', charm: 'star' }); assert.strictEqual(top[0].ini, '테');
assert.strictEqual(top[1].char, null, '캐릭터를 끈 학생은 null'); assert.strictEqual(top[1].ini, '둘');
assert.deepStrictEqual(top[2].char, { body: 'lavender', hat: 'none', glasses: 'none', charm: 'none' }, '줄이 없으면 기본 모습'); assert.strictEqual(top[2].ini, '셋');
assert.strictEqual(top[3].char, null, '명단 밖(이름만) 기록은 null'); assert.strictEqual(top[3].ini, '이');
assert.deepStrictEqual([top[0].acc, top[0].q, top[0].c], [90, 20, 2]);   // 위 1)의 8/10 기록 + 10/10
assert.ok(Object.values(rk.lists).every(l => l.top.every(x => 'char' in x && 'ini' in x)), '모든 랭킹 목록에');
ok('rank: top 에 char·ini');
await db.exec('drop table public."캐릭터"');
const rk2 = await quiz.rank(q, NOW);
assert.deepStrictEqual(rk2.lists['cls|전체|week'].top[1].char, { body: 'lavender', hat: 'none', glasses: 'none', charm: 'none' }, '캐릭터 표가 없어도(003 실행 전) 랭킹은 됨');
ok('rank: 캐릭터 표가 없어도 동작');
console.log('quiz.test 통과');
