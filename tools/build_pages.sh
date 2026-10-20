#!/usr/bin/env bash
# 각 강의의 슬라이드를 GitHub Pages용 docs/lectures/NN/ 으로 복사한다.
# 슬라이드는 ../이미지/ 를 가리키므로, 웹에서는 같은 폴더의 img/ 를 보도록 경로를 바꾼다.
# 사용법: 저장소 맨 위에서  bash tools/build_pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."

for dir in [0-9][0-9]_*/; do
  no="${dir:0:2}"
  deck=$(ls "$dir"슬라이드/*.html 2>/dev/null | head -n 1 || true)
  [ -n "$deck" ] || continue
  out="docs/lectures/$no"
  rm -rf "${out:?}"
  mkdir -p "$out/img"
  sed 's|\.\./이미지/|img/|g' "$deck" > "$out/index.html"
  # 슬라이드가 실제로 쓰는 이미지만 복사
  grep -o 'img/[^"]*' "$out/index.html" | sort -u | while read -r f; do
    cp "$dir이미지/${f#img/}" "$out/$f"
  done
  echo "$deck -> $out/index.html"
done
