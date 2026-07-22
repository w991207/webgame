document.getElementById('saveBtn').addEventListener('click', ()=>{ saveState(true); });
document.getElementById('resetBtn').addEventListener('click', async ()=>{
  if(!confirm('정말 모든 진행 상황을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  state = defaultState();
  document.getElementById('modeNormalBtn').classList.toggle('active', true);
  document.getElementById('modeTowerBtn').classList.toggle('active', false);
  document.getElementById('arenaTitle').textContent = '회랑';
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  renderAll();
  await saveState(true);
  log('게임이 초기화되었습니다.', 'warn');
});

// ---------- Export / Import Logic ----------
function processImportedData(jsonStr){
  try{
    const loaded = JSON.parse(jsonStr);
    if(!loaded || typeof loaded !== 'object') return false;
    if(loaded.saveVersion !== SAVE_VERSION){
      alert(`이 세이브 파일은 이전 버전(${loaded.saveVersion || '알 수 없음'})입니다.\n밸런스 개편으로 인해 더 이상 불러올 수 없습니다. 새로 시작해주세요.`);
      return false;
    }
    state = Object.assign(defaultState(), loaded);
    state.goldUpgrades = Object.assign({atk:0,def:0,hp:0,goldGain:0,atkSpeed:0,expGain:0}, loaded.goldUpgrades||{});
    state.soulUpgrades = Object.assign({atkMult:0,goldMult:0,defMult:0}, loaded.soulUpgrades||{});
    state.relics = Object.assign({hpRelic:0,atkRelic:0,defRelic:0,goldRelic:0,expRelic:0,dropRelic:0,spdRelic:0}, loaded.relics||{});
    state.pets = Object.assign({dragonPet:0,jellyPet:0,crowPet:0,owlPet:0,fairyPet:0,wolfPet:0}, loaded.pets||{});
    state.raidGear = Object.assign({raidWeapon:0,raidArmor:0,raidCrown:0,raidRing:0}, loaded.raidGear||{});
    state.usedCoupons = loaded.usedCoupons || {};
    state.towerRewardsClaimed = loaded.towerRewardsClaimed || {};
    // 세이브 시점에 레이드가 진행 중이었다면 안전하게 종료 처리 (티켓은 이미 소모된 상태로 유지)
    if(state.raidActive) log('가져온 세이브에서 중단된 레이드가 종료 처리되었습니다.', 'warn');
    state.raidActive = false;
    state.raidBossHp = 0;
    state.raidBossMaxHp = 0;
    state.raidPlayerHp = 0;

    document.getElementById('modeNormalBtn').classList.toggle('active', state.mode==='normal');
    document.getElementById('modeTowerBtn').classList.toggle('active', state.mode==='tower');
    document.getElementById('arenaTitle').textContent = state.mode === 'tower' ? '무한의 탑 (100층)' : '회랑';

    const s = stats();
    if(state.playerHp <= 0) state.playerHp = s.maxHp;
    spawnMonster();
    renderAll();
    saveState(false);
    log('세이브 데이터를 성공적으로 가져왔습니다.', 'good');
    alert('세이브 데이터를 성공적으로 불러왔습니다!');
    return true;
  }catch(e){
    alert('유효하지 않은 세이브 데이터 형식입니다.');
    return false;
  }
}

document.getElementById('exportBtn').addEventListener('click', ()=>{
  state.lastSave = Date.now();
  const dataStr = JSON.stringify(state);
  
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `twilight_corridor_save_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(dataStr).then(()=>{
      log('세이브 파일이 다운로드되었으며, 세이브 코드가 클립보드에 복사되었습니다.', 'good');
    }).catch(()=>{
      log('세이브 파일이 다운로드되었습니다.', 'good');
    });
  } else {
    log('세이브 파일이 다운로드되었습니다.', 'good');
  }
});

document.getElementById('importBtn').addEventListener('click', ()=>{
  const choice = confirm('세이브 파일(.json)을 업로드하여 불러오시겠습니까?\n[확인]: 파일 선택 / [취소]: 텍스트 코드 직접 입력');
  if(choice){
    document.getElementById('importFileInput').click();
  } else {
    const code = prompt('내보내기했던 세이브 코드(JSON 텍스트)를 붙여넣으세요:');
    if(code && code.trim()){
      processImportedData(code.trim());
    }
  }
});

document.getElementById('importFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (evt)=>{
    processImportedData(evt.target.result);
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ---------- Persistence ----------
async function saveState(manual){
  state.lastSave = Date.now();
  try{
    const result = await storageSet('save', JSON.stringify(state));
    if(manual) log(result ? '저장 완료.' : '저장 실패. 다시 시도해주세요.', result?'good':'warn');
  }catch(e){
    console.error('save failed', e);
    if(manual) log('저장 실패. 다시 시도해주세요.', 'warn');
  }
}

let wasVersionReset = false; // 버전 불일치로 인한 강제 초기화였는지 여부 (main.js에서 안내 메시지에 사용)

async function loadState(){
  try{
    const result = await storageGet('save');
    if(result && result.value){
      const loaded = JSON.parse(result.value);

      // 버전이 다른(예전) 세이브는 무효화하고 새 게임으로 시작
      if(loaded.saveVersion !== SAVE_VERSION){
        state = defaultState();
        wasVersionReset = true;
        console.log(`세이브 버전 불일치 (저장됨: ${loaded.saveVersion || '없음'}, 현재: ${SAVE_VERSION}) — 새 게임으로 시작합니다.`);
        return false;
      }

      state = Object.assign(defaultState(), loaded);
      state.goldUpgrades = Object.assign({atk:0,def:0,hp:0,goldGain:0,atkSpeed:0,expGain:0}, loaded.goldUpgrades||{});
      state.soulUpgrades = Object.assign({atkMult:0,goldMult:0,defMult:0}, loaded.soulUpgrades||{});
      state.relics = Object.assign({hpRelic:0,atkRelic:0,defRelic:0,goldRelic:0,expRelic:0,dropRelic:0,spdRelic:0}, loaded.relics||{});
      state.pets = Object.assign({dragonPet:0,jellyPet:0,crowPet:0,owlPet:0,fairyPet:0,wolfPet:0}, loaded.pets||{});
      state.raidGear = Object.assign({raidWeapon:0,raidArmor:0,raidCrown:0,raidRing:0}, loaded.raidGear||{});
      state.usedCoupons = loaded.usedCoupons || {};
      state.towerRewardsClaimed = loaded.towerRewardsClaimed || {};
      // 세이브 시점에 레이드가 진행 중이었다면 안전하게 종료 처리 (티켓은 이미 소모된 상태로 유지)
      if(state.raidActive) log('이전에 진행 중이던 레이드가 저장 시점에 중단되어 종료 처리되었습니다.', 'warn');
      state.raidActive = false;
      state.raidBossHp = 0;
      state.raidBossMaxHp = 0;
      state.raidPlayerHp = 0;
      return true;
    }
  }catch(e){
    console.log('no existing save or load failed', e);
  }
  return false;
}

function computeOfflineProgress(){
  const elapsedMs = Date.now() - (state.lastSave || Date.now());
  const elapsedSec = Math.min(elapsedMs/1000, 4*3600);
  if(elapsedSec < 30) return null;

  const s = stats();
  const killsPerSec = 1000/s.tickMs;
  const currentFloor = state.mode === 'tower' ? state.towerFloor : state.floor;
  const avgGoldPerKill = goldDropFor(currentFloor, false) * s.goldMult;
  const avgExpPerKill = expDropFor(currentFloor, false) * s.expMult;
  
  const totalKills = Math.floor(killsPerSec * elapsedSec * 0.35);
  const goldGained = Math.round(totalKills * avgGoldPerKill);
  const expGained = Math.round(totalKills * avgExpPerKill);

  state.gold += goldGained;
  state.exp += expGained;
  let levelsGained = 0;
  let needed = expNeeded(state.level);
  while(state.exp >= needed){
    state.exp -= needed;
    state.level++;
    levelsGained++;
    needed = expNeeded(state.level);
  }

  return {elapsedSec, goldGained, expGained, levelsGained, totalKills};
}

function formatDuration(sec){
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  if(h>0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function showOfflineModal(result){
  const modal = document.getElementById('offlineModal');
  const text = document.getElementById('offlineText');
  text.innerHTML = `자리를 비운 <b>${formatDuration(result.elapsedSec)}</b> 동안<br>
    몬스터 <span class="num">${result.totalKills}</span>마리를 처치했습니다.<br><br>
    획득: <span class="num">+${result.goldGained.toLocaleString()}🪙</span> · <span class="num">+${result.expGained} EXP</span>
    ${result.levelsGained>0? `<br>레벨 업 <span class="num">x${result.levelsGained}</span>!` : ''}`;
  modal.style.display = 'flex';
}
document.getElementById('offlineCloseBtn').addEventListener('click', ()=>{
  document.getElementById('offlineModal').style.display = 'none';
  renderAll();
});

