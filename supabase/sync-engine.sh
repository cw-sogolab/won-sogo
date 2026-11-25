#!/bin/sh
# core.js + logic.js → functions/api/engine.js (Edge Function 이 읽는 한 파일). 두 파일을 고친 뒤 실행.
cd "$(dirname "$0")/.." || exit 1
SRC=docs/dev/assets
{ echo "// 자동 생성 (supabase/sync-engine.sh) — 직접 고치지 말 것. 원본: docs/dev/assets/core.js · logic.js"
  cat $SRC/core.js; echo; cat $SRC/logic.js; echo; echo "export { Core, Logic };"; } > supabase/functions/api/engine.js
echo "engine.js $(wc -c < supabase/functions/api/engine.js)자"
