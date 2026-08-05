let latestPatch = null;

async function checkPatch() {
  try {
    const response = await fetch("patch.json?t=" + Date.now(), {
      cache: "no-store"
    });

    if (!response.ok) return;

    const patch = await response.json();
    latestPatch = patch;

    const savedVersion = localStorage.getItem("game_version");

    // ⭐ 첫 접속이면 버전만 저장하고 종료 (팝업 X)
    if (!savedVersion) {
      localStorage.setItem("game_version", patch.version);
      return;
    }

    // ⭐ 버전이 다르면 업데이트 팝업
    if (savedVersion !== patch.version) {

      const modal = document.getElementById("patchModal");
      if (!modal) return;

      const title = modal.querySelector(".patch-title");
      const body = modal.querySelector(".patch-body");

      if (title) {
        title.textContent = `🚀 v${patch.version} 업데이트`;
      }

      if (body) {
        body.innerHTML = patch.notes
          .map(note => `• ${note}`)
          .join("<br>");
      }

      modal.style.display = "flex";
    }

  } catch (e) {
    console.error("패치 확인 실패", e);
  }
}

function applyPatch() {

  if (latestPatch) {
    localStorage.setItem("game_version", latestPatch.version);
  }

  location.reload();
}


async function openPatchHistory(){

    const res=await fetch("patch-history.json?t="+Date.now());

    const history=await res.json();

    document.getElementById("patchHistoryBody").innerHTML=
        history.map(p=>`
        <h3>v${p.version}</h3>
        <ul>
            ${p.notes.map(n=>`<li>${n}</li>`).join("")}
        </ul>
        `).join("");

    document.getElementById("patchHistoryModal").style.display="flex";
}

document.getElementById("patchHistoryBtn").onclick=openPatchHistory;

// 최초 확인
checkPatch();

// 이후 3분마다 확인
// (예전엔 10초마다 + 캐시 무력화로 확인했는데, 방치형 게임 특성상 탭을 오래 켜두는
//  유저가 많아서 Vercel 엣지 요청량을 순식간에 잡아먹는 원인이 됐음. 패치 알림은
//  몇 분 늦게 떠도 큰 문제가 없으니 주기를 크게 늘려서 요청 횟수를 18배 줄인다.)
setInterval(checkPatch, 180000);