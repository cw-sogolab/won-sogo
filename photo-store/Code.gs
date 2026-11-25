/**
 * 일공 사진 창고 — 숙제·QnA 사진을 선생님 구글 드라이브에 저장하는 작은 Apps Script 웹앱
 *
 * 부르는 쪽은 Supabase 서버(Edge Function)뿐. 브라우저(학생)는 이 주소도 키도 모름.
 * 설치 (한 번만)
 *   1. script.google.com → 새 프로젝트 → 이 파일 내용을 Code.gs 에 통째로 붙여넣고 저장
 *   2. 위쪽 함수 목록에서 setup 을 고르고 ▶ 실행 → 권한 허용 → 아래 「실행 로그」에 SQL 이 나옴
 *   3. 배포 → 새 배포 → 유형 「웹 앱」 → 실행: 나 / 액세스 권한: 모든 사용자 → 배포 → 「웹 앱 URL」 복사
 *   4. 2 의 SQL 에서 여기에_웹앱_URL 을 3 의 주소로 바꿔 Supabase SQL Editor 에서 실행
 * 코드를 고치면: 배포 → 배포 관리 → ✏️ → 버전 「새 버전」 → 배포 (주소는 그대로)
 *
 * 저장 위치: 내 드라이브 「일공_사진」/<학생번호 또는 QNA>/<파일 이름>.jpg  — 누구와도 공유하지 않음.
 */
var ROOT_NAME = '일공_사진';
var PATH_RE = /^[A-Za-z0-9._-]{1,80}\/[A-Za-z0-9._-]{1,160}$/;

function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, error: 'bad request' }); }
  var key = PropertiesService.getScriptProperties().getProperty('PHOTO_KEY');
  if (!key || String(b.key || '') !== key) return out_({ ok: false, error: 'key' });
  try {
    if (b.action === 'ping') return out_({ ok: true });
    var path = String(b.path || '');
    if (!PATH_RE.test(path)) return out_({ ok: false, error: 'path' });
    var parts = path.split('/'), folderName = parts[0], name = parts[1];
    if (b.action === 'upload') {
      var folder = sub_(folderName, true);
      var blob = Utilities.newBlob(Utilities.base64Decode(String(b.b64 || '')), String(b.mime || 'image/jpeg'), name);
      var old = folder.getFilesByName(name);
      while (old.hasNext()) old.next().setTrashed(true);       // 같은 이름은 새것으로 바꿈
      folder.createFile(blob);
      return out_({ ok: true });
    }
    var f = find_(folderName, name);
    if (b.action === 'get') {
      if (!f) return out_({ ok: true, missing: true });
      var bl = f.getBlob();
      return out_({ ok: true, mime: bl.getContentType() || 'image/jpeg', b64: Utilities.base64Encode(bl.getBytes()) });
    }
    if (b.action === 'remove') {
      if (f) f.setTrashed(true);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'action' });
  } catch (err2) {
    return out_({ ok: false, error: String(err2 && err2.message || err2) });
  }
}

function root_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ROOT_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* 지워졌으면 새로 만듦 */ } }
  var nf = DriveApp.createFolder(ROOT_NAME);
  props.setProperty('ROOT_ID', nf.getId());
  return nf;
}
function sub_(name, create) {
  var it = root_().getFoldersByName(name);
  if (it.hasNext()) return it.next();
  if (!create) return null;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);     // 동시에 올려도 폴더가 두 개 생기지 않게
  try { var again = root_().getFoldersByName(name); return again.hasNext() ? again.next() : root_().createFolder(name); }
  finally { lock.releaseLock(); }
}
function find_(folderName, name) {
  var folder = sub_(folderName, false); if (!folder) return null;
  var it = folder.getFilesByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}

/** 한 번만 실행: 폴더와 비밀 키를 만들고, Supabase 에 넣을 SQL 을 실행 로그에 보여 줌 (키는 다시 실행해도 안 바뀜) */
function setup() {
  var props = PropertiesService.getScriptProperties(), key = props.getProperty('PHOTO_KEY');
  if (!key) { key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); props.setProperty('PHOTO_KEY', key); }
  var folder = root_();
  Logger.log('폴더: ' + folder.getName() + '\n\n아래 SQL 의 여기에_웹앱_URL 만 바꿔 Supabase SQL Editor 에서 실행하세요. (키는 남에게 보내지 마세요)\n\n' +
    "insert into public.kv_props(k, v) values ('PHOTO_URL', '여기에_웹앱_URL'), ('PHOTO_KEY', '" + key + "')\non conflict (k) do update set v = excluded.v;");
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
