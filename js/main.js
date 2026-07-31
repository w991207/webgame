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
    log('보스 데미지 표시 오류를 수정했습니다. 불편에 대한 보상으로 🧪 혈청 1개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted = true;
  }

  // 선물함 확인은 세이브 로드가 완전히 끝난 뒤에 해야 함 (먼저 하면 로드 시 값이 덮여씌워짐)
  if(typeof checkGifts === 'function') checkGifts();
  if(typeof checkGlobalGifts === 'function') checkGlobalGifts();
  if(loaded && !state.bonusGrant1Given){
    state.soul += 3;
    state.bonusGrant1Given = true;
    log('특별 보상으로 🧪 혈청 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bonusGrant1Given = true;
  }
  if(loaded && !state.bugfixCompGranted2){
    state.soul += 3;
    state.bugfixCompGranted2 = true;
    log('점검보상으로 🧪 혈청 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted2 = true;
  }

  document.getElementById('modeNormalBtn').classList.toggle('active', state.mode==='normal');
  document.getElementById('modeTowerBtn').classList.toggle('active', state.mode==='tower');
  document.getElementById('arenaTitle').textContent = state.mode === 'tower' ? '무한의 탑 (100층)' : '폐허';

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
  log('폐허에 들어섰습니다. 행운을 빕니다.', 'new');
  
  // 독립된 두 타이머 시작
  schedulePlayerTick();
  scheduleMonsterTick();
  
  setInterval(petTick, 1000);
  if(typeof checkActiveSkills === 'function') setInterval(checkActiveSkills, 500);
  if(typeof updateSkillTrayCooldowns === 'function') setInterval(updateSkillTrayCooldowns, 100);
  // 공격속도(전투 틱)와 분리해서, 뽑기/상점/각성 등 패널의 구매 가능 여부(gold/soul 반영)를
  // 1초마다만 새로고침한다. 전투 틱마다 부르면 버튼이 초당 여러 번 재생성돼 클릭이 씹힌다.
  setInterval(renderAll, 1000);

  setInterval(()=>saveState(false), 5000);
  window.addEventListener('beforeunload', ()=>{ saveState(true); });

  // 60초마다 coupons.json 재확인 (새로고침 없이 신규 쿠폰 감지 + 팝업 알림)
  setInterval(()=>loadCouponsJSON(true), 60000);
  const newCouponCloseBtn = document.getElementById('newCouponCloseBtn');
  if(newCouponCloseBtn){
    newCouponCloseBtn.addEventListener('click', ()=>{
      document.getElementById('newCouponModal').style.display = 'none';
    });
  }
  renderAttendance();
}

// 로그인/회원가입/게스트 로그인이 완료된 시점에 auth.js가 이 함수를 호출해 게임을 시작한다.
// (더 이상 페이지 로드와 동시에 자동으로 시작하지 않음 — 로그인 게이트를 먼저 통과해야 함)
function startGame(){
  init();
}
