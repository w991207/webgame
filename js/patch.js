// 1. 버전 정의 (배포 시 버전 업)[cite: 1]
const MY_VERSION = "1.1.4"; 

// 2. Netlify 패치 감지 함수
async function checkNetlifyPatch() {
  try {
    const response = await fetch(window.location.href.split('#')[0] + '?t=' + new Date().getTime(), {
      cache: 'no-store'
    });
    const htmlText = await response.text();
    const match = htmlText.match(/const\s+MY_VERSION\s*=\s*["']([^"']+)["']/);

    if (match && match[1]) {
      const latestServerVersion = match[1];
      if (latestServerVersion !== MY_VERSION) {
        const modal = document.getElementById('patchModal');
        if (modal) modal.style.display = 'flex';
      }
    }
  } catch (error) {
    console.log('패치 확인 중...');
  }
}

function applyPatch() {
  window.location.reload(true);
}

// 10초마다 체크
setInterval(checkNetlifyPatch, 10000);
