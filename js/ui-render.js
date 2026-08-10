// ---------- Rendering ----------
function renderMonster(){
  const meta = currentMonsterMeta();
  const emojiEl = document.getElementById('monsterEmoji');
  if(meta.img){
    emojiEl.innerHTML = `<img src="${meta.img}" alt="${meta.name}" class="monster-img">`;
  } else {
    emojiEl.textContent = meta.emoji;
  }
  
  document.getElementById('monsterName').textContent = meta.name;
  document.getElementById('bossTag').style.display = state.isBoss ? 'block' : 'none';

  // 현재 층에서 명중률 95%를 안정적으로 유지하려면 필요한 권장 명중 수치 표시.
  // (몬스터 기준 / 보스 기준을 함께 보여줘서, 보스전 대비 여유치까지 가늠할 수 있게 함)
  const accEl = document.getElementById('accuracyLine');
  if(accEl){
    const cf = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
    if((state.mode === 'tower' && state.towerCleared) || (state.mode === 'towerHard' && state.htCleared)){
      accEl.textContent = '';
    } else {
      const recMob = recommendedAccuracyFor(cf, false);
      const recBoss = recommendedAccuracyFor(cf, true);
      const myAcc = stats().accuracy;
      const okClass = myAcc >= recBoss ? 'ok' : (myAcc >= recMob ? '' : 'bad');
      accEl.innerHTML = `권장 명중: 몬스터 ${recMob} / 보스 ${recBoss} <span class="${okClass}">(내 명중 ${myAcc})</span>`;
    }
  }

  const progressEl = document.getElementById('killProgressText');
  if(state.mode === 'tower'){
    document.getElementById('floorBadge').textContent = state.towerCleared ? '🏆 TOWER CLEAR! (100/100)' : ('TOWER ' + state.towerFloor + ' / 100F');
    progressEl.textContent = `무한의 탑 진행 중`;
  } else if(state.mode === 'towerHard'){
    document.getElementById('floorBadge').textContent = state.htCleared ? '👑 HARD TOWER CLEAR! (100/100)' : ('HARD TOWER ' + state.htFloor + ' / 100F');
    progressEl.textContent = `무한의 탑(어려움) 진행 중`;
  } else {
    document.getElementById('floorBadge').textContent = 'FLOOR ' + state.floor;
    if(state.isBoss){
      progressEl.textContent = '보스전 진행 중';
    } else {
      progressEl.textContent = `처치: ${state.killsOnFloor} / 5`;
    }
  }
}

function renderCombatFrame(){
  const s = stats();
  document.getElementById('goldDisplay').textContent = Math.floor(state.gold).toLocaleString();
  document.getElementById('soulDisplay').textContent = Math.floor(state.soul).toLocaleString();
  const stoneEl = document.getElementById('stoneDisplay');
  if(stoneEl) stoneEl.textContent = Math.floor(state.enhanceStone||0).toLocaleString();
  document.getElementById('lvlDisplay').textContent = state.level;

  const towerBtn = document.getElementById('modeTowerBtn');
  if(towerBtn){
    const unlocked = state.level >= TOWER_UNLOCK_LEVEL;
    towerBtn.textContent = unlocked ? '무한의 탑' : `무한의 탑 🔒(Lv.${TOWER_UNLOCK_LEVEL})`;
    towerBtn.classList.toggle('locked', !unlocked);
  }

  const towerHardBtn = document.getElementById('modeTowerHardBtn');
  if(towerHardBtn){
    const hardUnlocked = !!state.towerCleared;
    towerHardBtn.textContent = hardUnlocked ? '무한의 탑(어려움)' : '무한의 탑(어려움) 🔒(탑 100층 클리어)';
    towerHardBtn.classList.toggle('locked', !hardUnlocked);
  }

  document.getElementById('statAtk').textContent = s.atk;
  document.getElementById('statDef').textContent = s.def;

  // 전투력 계산 및 표시
  const cp = calcCombatPower(s);
  if(cp > state.peakCombatPower) state.peakCombatPower = cp;
  document.getElementById('cpValue').textContent = cp.toLocaleString();
  const cpCompareEl = document.getElementById('cpCompare');
  const cpBarEl = document.getElementById('cpBar');
  if(state.peakCombatPower > 0){
    const pct = Math.min(100, (cp / state.peakCombatPower) * 100);
    cpBarEl.style.width = pct.toFixed(1) + '%';
    if(cp >= state.peakCombatPower){
      cpCompareEl.textContent = `⚡ 역대 최고 전투력 달성!`;
      cpCompareEl.classList.add('recovered');
    } else {
      cpCompareEl.textContent = `최고 기록 ${state.peakCombatPower.toLocaleString()} 대비 ${pct.toFixed(1)}%`;
      cpCompareEl.classList.remove('recovered');
    }
  } else {
    cpBarEl.style.width = '0%';
    cpCompareEl.textContent = '';
  }
  document.getElementById('statHp').textContent = s.maxHp;
  const spdRelicBonus = state.relics.spdRelic > 0 ? ` <span style="color:var(--frag);font-size:10px;">(유산 +${state.relics.spdRelic*3}%)</span>` : '';
  document.getElementById('statSpd').innerHTML = (1000/s.tickMs).toFixed(3)+'/s' + spdRelicBonus;
  document.getElementById('statGold').textContent = 'x'+s.goldMult.toFixed(2);
  document.getElementById('statExpMult').textContent = 'x'+s.expMult.toFixed(2);

  const isMaxCrit = (state.goldUpgrades.critChance||0) >= 100 && (state.goldUpgrades.critDamage||0) >= 100;
  const critChanceEl = document.getElementById('statCritChance');
  const critDamageEl = document.getElementById('statCritDamage');
  if(isMaxCrit){
    critChanceEl.innerHTML = `100% <span style="color:#ff3b3b;font-weight:900;">⚡MAX</span>`;
    critDamageEl.innerHTML = `x${s.critDamageMult.toFixed(2)} <span style="color:#ff3b3b;font-weight:900;">⚡MAX</span>`;
  } else {
    critChanceEl.textContent = s.critChance.toFixed(0) + '%';
    critDamageEl.textContent = 'x' + s.critDamageMult.toFixed(2);
  }

  const accEl = document.getElementById('statAccuracy');
  if(accEl) accEl.textContent = s.accuracy;
  const hitChanceEl = document.getElementById('statHitChance');
  if(hitChanceEl){
    const cf = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
    const hc = hitChanceFor(cf, state.isBoss, s.accuracy);
    hitChanceEl.textContent = hc.toFixed(0) + '%';
    hitChanceEl.style.color = hc >= 90 ? '' : (hc >= 50 ? '#e8a33d' : 'var(--hp)');
  }

  const needed = expNeeded(state.level);
  document.getElementById('expText').textContent = `${state.exp} / ${needed}`;
  document.getElementById('expBar').style.width = Math.min(100,(state.exp/needed*100)) + '%';

  renderMonster();

  const mhPct = Math.max(0,(state.monsterHp/state.monsterMaxHp*100));
  document.getElementById('monsterHpBar').style.width = mhPct+'%';
  document.getElementById('monsterHpText').textContent = `${Math.max(0,Math.ceil(state.monsterHp))} / ${state.monsterMaxHp}`;

  const phPct = Math.max(0,(state.playerHp/s.maxHp*100));
  document.getElementById('playerHpBar').style.width = phPct+'%';
  document.getElementById('playerHpText').textContent = `${Math.max(0,Math.ceil(state.playerHp))} / ${s.maxHp}`;
}

// renderAll: 전투 프레임 + 상점/장비뽑기/유산/동료/각성 등 "패널"까지 통째로 다시 그린다.
// 패널들은 버튼을 innerHTML로 매번 새로 만들기 때문에, 공격속도에 맞춘 전투 틱마다
// 이 함수를 부르면 그 버튼들이 초당 여러 번 재생성되면서 클릭이 씹히는 문제가 생긴다.
// 그래서 전투 틱(schedulePlayerTick/scheduleMonsterTick)에서는 renderCombatFrame()만 부르고,
// renderAll()은 구매/뽑기/모드전환 같은 "사용자가 직접 액션을 취한 시점"과
// main.js의 1초 주기 인터벌에서만 호출한다.
function renderAll(){
  renderCombatFrame();

  renderShop();
  renderSoulShop();
  renderEquipment();
  renderRelics();
  renderPets();
  updateRebirthAvailability();
  checkDailyReset();
  renderDailyQuests();
  renderRepeatableQuests();
  state.relicsOwnedCount = RELICS.filter(r=>state.relics[r.key]>0).length;
  renderAchievements();
  renderRaidPanel();
  renderGoldDungeonPanel();
  renderRelicDungeonPanel();
  if(typeof renderMutationTree === 'function') renderMutationTree();
  if(typeof renderJobPanel === 'function') renderJobPanel();
  if(typeof renderJobMasteryPanel === 'function') renderJobMasteryPanel();
  if(typeof renderSkillsPanel === 'function') renderSkillsPanel();
  if(typeof renderPvpRecord === 'function') renderPvpRecord();
  if(typeof renderBestiary === 'function') renderBestiary();
  if(typeof renderPotionShop === 'function') renderPotionShop();
  if(typeof renderSoulPackShop === 'function') renderSoulPackShop();
  if(typeof renderSkillTray === 'function') renderSkillTray();
  if(typeof renderTitles === 'function') renderTitles();
  if(typeof renderWorldBossPanel === 'function') renderWorldBossPanel();
  if(typeof renderTerritoryPanel === 'function') renderTerritoryPanel();
}


