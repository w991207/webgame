#!/bin/sh
# .git/hooks는 버전 관리 대상이 아니라서, 저장소에 보관한 훅을 .git/hooks로 복사해 설치한다.
# (훅 내용을 바꾸면 이 스크립트를 다시 실행하면 된다)
set -e
cd "$(dirname "$0")/.."

if [ ! -d .git/hooks ]; then
  echo "❌ .git/hooks 폴더가 없습니다. git 저장소 루트에서 실행해주세요."
  exit 1
fi

cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "✅ 설치 완료: .git/hooks/pre-commit (커밋 시 번들 자동 재생성)"
