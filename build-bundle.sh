#!/bin/bash
# js/*.js 개별 파일들을 배포용 번들 2개로 합쳐서 Vercel Edge Requests 사용량을 줄인다.
# (파이어베이스 CDN 스크립트 3개 앞뒤로 순서가 갈려서 번들이 2개로 나뉨)
#
# 사용법: 이 저장소 루트에서 실행
#   ./build-bundle.sh
#
# js/*.js 원본 파일은 그대로 두고(계속 이 파일들을 수정), index.html은
# js/bundle1.js + js/bundle2.js만 불러온다. 코드를 고칠 때마다 이 스크립트를
# 다시 돌려서 번들을 재생성해야 반영된다 (Claude가 배포 전에 항상 실행해줌).
set -e
cd "$(dirname "$0")"

BUNDLE1_FILES=(
  js/electron-bridge.js
  js/patch.js
  js/storage.js
  js/data.js
  js/bestiary.js
  js/mutation.js
  js/job.js
  js/titles.js
  js/costumes.js
  js/state.js
  js/combat.js
  js/skills.js
  js/equipment.js
  js/inventory.js
  js/potions.js
  js/enhance.js
  js/goods-shop.js
  js/raid.js
  js/golden.js
  js/golddungeon.js
  js/relicdungeon.js
  js/forgedungeon.js
  js/trainingdungeon.js
  js/territory.js
  js/ui-render.js
  js/worldmap.js
  js/shop.js
  js/relics-pets.js
  js/killpass.js
  js/pet-shelter.js
  js/expedition.js
  js/quests.js
  js/attendance.js
  js/persistence.js
)

# firebase-config.js부터는 firebase CDN 스크립트(firebase-app/auth/firestore-compat) 이후에
# 실행돼야 해서 별도 번들로 분리.
BUNDLE2_FILES=(
  js/firebase-config.js
  js/auth.js
  js/ranking.js
  js/plaza.js
  js/pvp.js
  js/worldboss.js
  js/tabs.js
  js/gifts.js
  js/main.js
)

build_bundle() {
  local out="$1"; shift
  : > "$out"
  for f in "$@"; do
    echo "// ===== $f =====" >> "$out"
    cat "$f" >> "$out"
    echo "" >> "$out"
  done
}

build_bundle js/bundle1.js "${BUNDLE1_FILES[@]}"
build_bundle js/bundle2.js "${BUNDLE2_FILES[@]}"

echo "빌드 완료: js/bundle1.js ($(wc -l < js/bundle1.js) lines), js/bundle2.js ($(wc -l < js/bundle2.js) lines)"
