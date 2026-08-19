// ---------- 선물함 (관리자 지급 보상) ----------
// Firebase 콘솔에서 'gifts' 컬렉션에 문서를 직접 추가하는 방식으로 특정 유저에게 재화를 지급합니다.
// 문서 형식 (필드 몇 개만 입력하면 됨, JSON 문자열 편집 필요 없음):
//   uid:     "지급 대상 유저의 UID" (Authentication 탭에서 확인)
//   gold:    50000   (선택, 없으면 0. 음수(-50000)를 넣으면 차감됨 — 잘못 지급된 재화 회수용)
//   frag:    0       (선택, 유산 파편. 음수도 가능)
//   soul:    0       (선택, 혈청. 음수도 가능)
//   claimed: false   (필수, 처음엔 항상 false로 생성)
//   note:    "사유"  (선택, 지급 사유. 유저에게 선물 팝업/로그에 그대로 표시됨)
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
    const notes = [];
    const batch = fbDb.batch();

    snapshot.forEach(doc=>{
      const g = doc.data();
      totalGold += Number(g.gold) || 0;
      totalFrag += Number(g.frag) || 0;
      totalSoul += Number(g.soul) || 0;
      if(g.note) notes.push(String(g.note));
      batch.update(doc.ref, { claimed: true });
    });

    if(totalGold !== 0) state.gold = Math.max(0, state.gold + totalGold);
    if(totalFrag !== 0) state.fragments = Math.max(0, (state.fragments||0) + totalFrag);
    if(totalSoul !== 0) state.soul = Math.max(0, state.soul + totalSoul);

    await batch.commit(); // claimed 표시를 실제로 반영 (실패해도 로컬엔 이미 지급된 상태)

    const parts = [];
    if(notes.length) parts.push(`📝 ${notes.join(' · ')}`);
    if(totalGold !== 0) parts.push(`📦 물자 ${totalGold.toLocaleString()}`);
    if(totalFrag !== 0) parts.push(`◈ 유산 파편 ${totalFrag.toLocaleString()}`);
    if(totalSoul !== 0) parts.push(`🧪 혈청 ${totalSoul.toLocaleString()}`);
    if(parts.length === 0) return; // 전부 0이고 note도 없으면(claimed 표시만 필요했던 경우) 알림 없이 조용히 종료
    log(`🎁 관리자로부터 선물을 받았습니다! (${parts.join(' ')})`, 'good');
    showGiftModal(parts);

    if(typeof renderAll === 'function') renderAll();
    if(typeof saveState === 'function') saveState(false);
  }catch(e){
    console.warn('선물함 확인 실패', e);
  }
}

// ---------- 전체 유저 선물 (브로드캐스트) ----------
// 위 gifts 컬렉션은 유저 한 명 한 명마다 문서를 만들어야 해서, 전체 지급에는 비효율적입니다.
// globalGifts 컬렉션은 문서 '딱 1개'만 만들면 접속하는 모든 유저가 각자 알아서 수령합니다.
// 누가 이미 받았는지는 각 유저의 세이브(state.claimedGlobalGifts)에 문서 id로 기록해서 구분하므로,
// 관리자가 유저 수만큼 문서를 만들거나 수령 여부를 따로 관리할 필요가 없습니다.
//
// Firebase 콘솔에서 globalGifts 컬렉션에 문서 추가 (문서 ID는 자동생성 그대로 둬도 됨):
//   gold:  50000   (선택, 없으면 0)
//   frag:  0       (선택, 유산 파편)
//   soul:  0       (선택, 혈청)
//   raidTicket: 1  (선택, 레이드 티켓 — 최대치 3을 넘겨도 그대로 더해짐)
//   note:  "사유"  (선택, 지급 사유. 유저에게 선물 팝업/로그에 그대로 표시됨)
// claimed 필드는 필요 없습니다 (유저별 수령 여부는 서버가 아니라 각자의 세이브에 저장되기 때문).
// 이미 지급한 선물 문서를 지우거나 새로 하나 더 추가하면, 지운 건 더 이상 지급되지 않고
// 새로 추가한 건 아직 못 받은 유저에게만 나갑니다.

async function checkGlobalGifts(){
  const user = fbAuth.currentUser;
  if(!user) return;

  try{
    const snapshot = await fbDb.collection('globalGifts').get();
    if(snapshot.empty) return;

    let totalGold = 0, totalFrag = 0, totalSoul = 0, totalRaidTicket = 0;
    let newlyClaimedCount = 0;
    const notes = [];

    snapshot.forEach(doc=>{
      if(state.claimedGlobalGifts[doc.id]) return; // 이미 받은 선물
      const g = doc.data();
      totalGold += Number(g.gold) || 0;
      totalFrag += Number(g.frag) || 0;
      totalSoul += Number(g.soul) || 0;
      totalRaidTicket += Number(g.raidTicket) || 0;
      if(g.note) notes.push(String(g.note));
      state.claimedGlobalGifts[doc.id] = true;
      newlyClaimedCount++;
    });

    if(newlyClaimedCount === 0) return;

    if(totalGold !== 0) state.gold = Math.max(0, state.gold + totalGold);
    if(totalFrag !== 0) state.fragments = Math.max(0, (state.fragments||0) + totalFrag);
    if(totalSoul !== 0) state.soul = Math.max(0, state.soul + totalSoul);
    if(totalRaidTicket !== 0) state.raidTicket = Math.max(0, (state.raidTicket||0) + totalRaidTicket); // 최대치(3) 넘어도 그대로 지급

    const parts = [];
    if(notes.length) parts.push(`📝 ${notes.join(' · ')}`);
    if(totalGold !== 0) parts.push(`📦 물자 ${totalGold.toLocaleString()}`);
    if(totalFrag !== 0) parts.push(`◈ 유산 파편 ${totalFrag.toLocaleString()}`);
    if(totalSoul !== 0) parts.push(`🧪 혈청 ${totalSoul.toLocaleString()}`);
    if(totalRaidTicket !== 0) parts.push(`🎟️ 레이드 티켓 ${totalRaidTicket.toLocaleString()}`);
    if(parts.length > 0){
      log(`🎁 전체 유저 대상 선물을 받았습니다! (${parts.join(' ')})`, 'good');
      showGiftModal(parts);
    }

    if(typeof renderAll === 'function') renderAll();
    if(typeof saveState === 'function') saveState(false); // claimedGlobalGifts 기록을 즉시 저장 (재수령 방지)
  }catch(e){
    console.warn('전체 선물 확인 실패', e);
  }
}


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
  if(fbAuth.currentUser){
    checkGifts();
    checkGlobalGifts();
  }
}, 60000);
