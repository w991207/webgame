// ---------- 선물함 (관리자 지급 보상) ----------
// Firebase 콘솔에서 'gifts' 컬렉션에 문서를 직접 추가하는 방식으로 특정 유저에게 재화를 지급합니다.
// 문서 형식 (필드 몇 개만 입력하면 됨, JSON 문자열 편집 필요 없음):
//   uid:     "지급 대상 유저의 UID" (Authentication 탭에서 확인)
//   gold:    50000   (선택, 없으면 0. 음수(-50000)를 넣으면 차감됨 — 잘못 지급된 재화 회수용)
//   frag:    0       (선택, 유산 파편. 음수도 가능)
//   soul:    0       (선택, 혈청. 음수도 가능)
//   claimed: false   (필수, 처음엔 항상 false로 생성)
//   note:    "사유"  (선택, 관리자 참고용, 게임에는 표시 안 됨)
//
// 클라이언트는 자기 UID로 된 claimed:false 문서를 찾으면 즉시 현재 세이브에 "더해서"(음수면 차감) 반영하고
// claimed를 true로 바꿉니다. 로컬 state에 바로 가산하기 때문에, 그 이후 자동저장이 무엇을 덮어쓰든
// 이미 반영된 값이라 안전합니다 (지급이 씹히는 문제 없음). 차감 결과가 0 밑으로 내려가지는 않습니다.

async function checkGifts(){
  const user = fbAuth.currentUser;
  if(!user) return;

  try{
    const snapshot = await fbDb.collection('gifts')
      .where('uid', '==', user.uid)
      .where('claimed', '==', false)
      .get();

    if(snapshot.empty) return;

    let totalGold = 0, totalFrag = 0, totalSoul = 0;
    const batch = fbDb.batch();

    snapshot.forEach(doc=>{
      const g = doc.data();
      totalGold += Number(g.gold) || 0;
      totalFrag += Number(g.frag) || 0;
      totalSoul += Number(g.soul) || 0;
      batch.update(doc.ref, { claimed: true });
    });

    if(totalGold !== 0) state.gold = Math.max(0, state.gold + totalGold);
    if(totalFrag !== 0) state.fragments = Math.max(0, (state.fragments||0) + totalFrag);
    if(totalSoul !== 0) state.soul = Math.max(0, state.soul + totalSoul);

    await batch.commit(); // claimed 표시를 실제로 반영 (실패해도 로컬엔 이미 지급된 상태)

    const parts = [];
    if(totalGold !== 0) parts.push(`📦 물자 ${totalGold.toLocaleString()}`);
    if(totalFrag !== 0) parts.push(`◈ 유산 파편 ${totalFrag.toLocaleString()}`);
    if(totalSoul !== 0) parts.push(`🧪 혈청 ${totalSoul.toLocaleString()}`);
    if(parts.length === 0) return; // 전부 0이면(claimed 표시만 필요했던 경우) 알림 없이 조용히 종료
    log(`🎁 관리자로부터 선물을 받았습니다! (${parts.join(' ')})`, 'good');
    showGiftModal(parts);

    if(typeof renderAll === 'function') renderAll();
    if(typeof saveState === 'function') saveState(false);
  }catch(e){
    console.warn('선물함 확인 실패', e);
  }
}

// 선물 도착 팝업 표시 (여러 선물이 겹치면 줄바꿈으로 이어붙여 큐처럼 보여줌)
function showGiftModal(parts){
  const modal = document.getElementById('giftModal');
  const textEl = document.getElementById('giftText');
  if(!modal || !textEl) return;

  const line = parts.join('<br>');
  if(modal.style.display === 'flex' || modal.style.display === 'block'){
    textEl.innerHTML += '<br>─────────<br>' + line;
  }else{
    textEl.innerHTML = line;
    modal.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const giftCloseBtn = document.getElementById('giftCloseBtn');
  if(giftCloseBtn){
    giftCloseBtn.addEventListener('click', ()=>{
      document.getElementById('giftModal').style.display = 'none';
    });
  }
});

// 로그인 상태에서 1분마다 자동으로 확인 (관리자가 접속 중에 선물을 넣어줘도 바로 받게)
setInterval(()=>{
  if(fbAuth.currentUser) checkGifts();
}, 60000);
