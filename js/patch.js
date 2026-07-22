// 현재 실행 중인 게임 버전
const MY_VERSION = "2.0.2";

// 패치 확인
async function checkPatch() {
  try {
    const response = await fetch("/patch.json?t=" + Date.now(), {
      cache: "no-store"
    });

    const patch = await response.json();

    if (patch.version !== MY_VERSION) {

      const modal = document.getElementById("patchModal");

      const title = modal.querySelector(".patch-title");
      const body = modal.querySelector(".patch-body");

      if (title)
        title.textContent = `🚀 v${patch.version} 업데이트`;

      if (body)
        body.innerHTML = patch.notes.map(x => `• ${x}`).join("<br>");

      modal.style.display = "flex";
    }

  } catch (e) {
    console.log("패치 확인 실패");
  }
}

function applyPatch() {
  location.reload();
}

// 최초 1회
checkPatch();

// 이후 10초마다 확인
setInterval(checkPatch, 10000);