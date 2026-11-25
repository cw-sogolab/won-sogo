#!/bin/sh
# 전체 표를 JSON 파일로 내려받아 백업 (읽기 전용 — 확인 질문 없음). 사용: sh supabase/backup.sh <프로젝트ref> [저장 폴더]
# 기본 저장 폴더: iCloud 일공/_보관/_백업/supabase/YYYYMMDD  (학생 정보가 들어 있으니 저장소에 넣지 말 것)
REF="${1:?프로젝트 ref 를 적어 주세요}"
OUT="${2:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/일공/_보관/_백업/supabase/$(date +%Y%m%d)}"
cd "$(dirname "$0")/.." || exit 1
mkdir -p "$OUT" || exit 1
for T in 반 원생 수강 시험 시험결과 숙제 숙제제출 숙제사진 평가 시험지 달력 계획서 계획서머리 접속기록 퀴즈기록; do
  npx --yes supabase db query --remote="$REF" --read-only -o json "select * from public.\"$T\" order by id" 2>/dev/null \
    | python3 -c 'import sys,json; t=sys.stdin.read(); json.dump(json.loads(t[t.index("{"):])["rows"], open(sys.argv[1],"w"), ensure_ascii=False)' "$OUT/$T.json" \
    && echo "$T ok" || echo "$T 실패"
done
echo "저장: $OUT"
