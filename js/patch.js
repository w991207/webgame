// 1. 버전 정의 (배포 시 버전 업)[cite: 1]
const MY_VERSION = "2.0.1"; 

// 2. Netlify 패치 감지 함수
async function checkPatch() {
  try {
    const response = await fetch("/js/patch.js?t=" + Date.now(), {
      cache: "no-store"
    });

    const text = await response.text();
    const match = text.match(/const\s+MY_VERSION\s*=\s*["']([^"']+)["']/);

    if (!match) return;

    const latestVersion = match[1];

    if (latestVersion !== MY_VERSION) {
      document.getElementById("patchModal").style.display = "flex";
    }
  } catch (e) {
    console.log("패치 확인 실패");
  }
}

setInterval(checkPatch, 10000);
// 10초마다 체크
setInterval(checkPatch, 10000);
