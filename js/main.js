// ---------- Init ----------
async function init(){
  await loadCouponsJSON();

  const loaded = await loadState();
  if(wasVersionReset){
    log('⚠️ 밸런스 개편으로 인해 진행 상황이 초기화되었습니다. 새로운 밸런스로 다시 시작해주세요!', 'warn');
  }
  if(loaded && !state.bugfixCompGranted){
    state.soul += 1;
    state.bugfixCompGranted = true;
    log('보스 데미지 표시 오류를 수정했습니다. 불편에 대한 보상으로 ✦ 영혼석 1개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted = true;
  }
  if(loaded && !state.bonusGrant1Given){
    state.soul += 3;
    state.bonusGrant1Given = true;
    log('특별 보상으로 ✦ 영혼석 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bonusGrant1Given = true;
  }
  if(loaded && !state.bugfixCompGranted2){
    state.soul += 3;
    state.bugfixCompGranted2 = true;
    log('점검보상으로 ✦ 영혼석 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted2 = true;
  }

  document.getElementById('modeNormalBtn').classList.toggle('active', state.mode==='normal');
  document.getElementById('modeTowerBtn').classList.toggle('active', state.mode==='tower');
  document.getElementById('arenaTitle').textContent = state.mode === 'tower' ? '무한의 탑 (100층)' : '회랑';

  const s = stats();
  if(!loaded){
    state.playerHp = s.maxHp;
  }
  if(state.monsterMaxHp <= 0){
    spawnMonster();
  } else {
    renderMonster();
  }
  if(state.playerHp <= 0) state.playerHp = s.maxHp;

  const offlineResult = loaded ? computeOfflineProgress() : null;
  renderAll();
  if(offlineResult){
    showOfflineModal(offlineResult);
  }
  log('회랑에 들어섰습니다. 행운을 빕니다.', 'new');
  
  // 독립된 두 타이머 시작
  schedulePlayerTick();
  scheduleMonsterTick();
  
  setInterval(petTick, 1000);

  setInterval(()=>saveState(false), 5000);
  window.addEventListener('beforeunload', ()=>{ saveState(false); });

  // 60초마다 coupons.json 재확인 (새로고침 없이 신규 쿠폰 감지 + 팝업 알림)
  setInterval(()=>loadCouponsJSON(true), 60000);
  const newCouponCloseBtn = document.getElementById('newCouponCloseBtn');
  if(newCouponCloseBtn){
    newCouponCloseBtn.addEventListener('click', ()=>{
      document.getElementById('newCouponModal').style.display = 'none';
    });
  }

  checkNetlifyPatch();
}

init();
