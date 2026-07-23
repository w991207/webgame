// ---------- Monster generation ----------
function monsterHpFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(50 * Math.pow(floor, 1.3));
  }
  let hp =
  Math.round(
    35 * Math.pow(floor, 1.22)
  );
  if(boss)
    hp *= 6;
  return hp;
}
function monsterAtkFor(floor, boss){

  if(state.mode === 'tower'){
    return Math.round(
      8 + floor*6
    );
  }
  let atk =
  5 + floor*2;
  if(boss)
    atk *= 2.2;
  return Math.round(atk);
}
function monsterDefFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(
      floor*0.8
    );
  }
  let def =
  floor*0.7;
  if(boss)
    def *= 1.8;
  return Math.round(def);
}function goldDropFor(floor, boss){
  if(state.mode === 'tower'){
    let g = Math.round(200 * Math.pow(1.03, floor - 1));
    if(boss) g *= 3;
    return g;
  }
  let g = Math.round(4 + floor * 1.8);
  if(boss) g *= 8;
  return g;
}
function expDropFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(5 + floor*2.0);
  }
  let e = Math.round(3 + floor*1.5);
  if(boss) e *= 8;
  return e;
}

function spawnMonster(){
  if(state.mode === 'tower'){
    if(state.towerCleared){
      state.isBoss = false;
      state.monsterIndex = -1; // special: cleared marker
      state.monsterMaxHp = 1;
      state.monsterHp = 1;
    } else {
      state.isBoss = (state.towerFloor % 10 === 0);
      state.monsterIndex = (state.towerFloor - 1) % TOWER_MONSTERS.length;
      state.monsterMaxHp = monsterHpFor(state.towerFloor, state.isBoss);
      state.monsterHp = state.monsterMaxHp;
    }
  } else {
    const boss = state.floor % 10 === 0;
    state.isBoss = boss;
    const pool = boss ? BOSSES : MONSTERS;
    state.monsterIndex = Math.floor(Math.random()*pool.length);
    state.monsterMaxHp = monsterHpFor(state.floor, boss);
    state.monsterHp = state.monsterMaxHp;
  }
  renderMonster();
}

function currentMonsterMeta(){
  if(state.mode === 'tower'){
    if(state.towerCleared){
      return {name:'무한의 탑 정복 완료', emoji:'🏆'};
    }
    return TOWER_MONSTERS[state.monsterIndex] || TOWER_MONSTERS[0];
  }
  const pool = state.isBoss ? BOSSES : MONSTERS;
  return pool[state.monsterIndex] || pool[0];
}

// ---------- Log ----------
function log(msg, cls){
  const el = document.getElementById('log');
  const line = document.createElement('div');
  if(cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  while(el.children.length > 60) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

function floatText(text, cls){
  const box = document.getElementById('arenaBox');
  const el = document.createElement('div');
  el.className = 'float-text' + (cls?(' '+cls):'');
  el.textContent = text;
  el.style.left = (40 + Math.random()*20) + '%';
  el.style.top = '40%';
  box.appendChild(el);
  setTimeout(()=>el.remove(), 900);
}

// ---------- Combat ticks (분리된 전투 루프) ----------
function playerAttackTick(){
  const s = stats();
  if(state.playerHp <= 0) state.playerHp = s.maxHp;
  if(state.mode === 'tower' && state.towerCleared){
    schedulePlayerTick();
    return;
  }
  if(state.monsterHp <= 0) return; // 이미 처치된 경우 무시

  const currentFloor = state.mode === 'tower' ? state.towerFloor : state.floor;

  let dmgToMonster = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmgToMonster = Math.round(dmgToMonster * s.critDamageMult);
    state.monsterHp -= dmgToMonster;
    floatText('CRIT! -'+dmgToMonster, 'crit');
  } else {
    state.monsterHp -= dmgToMonster;
    floatText('-'+dmgToMonster, null);
  }
  pulseMonster();

  if(state.monsterHp <= 0){
    const boss = state.isBoss;
    const goldGain = Math.round(goldDropFor(currentFloor, boss) * s.goldMult);
    const expGain = Math.round(expDropFor(currentFloor, boss) * s.expMult);
    state.gold += goldGain;
    state.lifetimeGoldEarned += goldGain;
    state.exp += expGain;
    state.totalKills++;
    state.dailyKills++;
    state.dailyGoldEarned += goldGain;
    state.repKillProgress++;
    if(boss){
      state.dailyBossKills++;
      state.repBossProgress++;
      state.totalBossKills = (state.totalBossKills||0) + 1;
    }
    log(`${currentMonsterMeta().name}${boss? ' (보스)':''} 처치! +${goldGain}🪙 +${expGain}EXP`, boss?'good':'new');

    tryLevelUp();

    if(state.mode === 'tower'){
      if(state.towerFloor % 10 === 0 && !state.towerRewardsClaimed[state.towerFloor]){
        state.soul += 1;
        state.fragments += 3;
        state.towerRewardsClaimed[state.towerFloor] = true;
        log(`[무한의 탑] ${state.towerFloor}층 첫 돌파 보상! ✦ 영혼석 1개, ◈ 유물 파편 3개 획득!`, 'good');
      }

      if(state.towerFloor < 100){
        state.towerFloor++;
        state.towerHighestFloor = Math.max(state.towerHighestFloor, state.towerFloor);
        log(`[무한의 탑] ${state.towerFloor}층으로 상승합니다!`, 'good');
      } else if(!state.towerCleared){
        state.towerCleared = true;
        log(`[무한의 탑] 100층 정복 완료! 무한의 탑을 완전히 정복했습니다. 환생 후 다시 도전할 수 있습니다.`, 'good');
      }
    } else {
      state.killsOnFloor++;
      const killsNeeded = boss ? 1 : 5;
      if(state.killsOnFloor >= killsNeeded){
        state.floor++;
        state.killsOnFloor = 0;
        state.highestFloor = Math.max(state.highestFloor, state.floor);
        state.repFloorProgress++;
        log(`${state.floor}층으로 진입합니다.`, 'good');
      }
    }

    if(Math.random() < s.dropChance){
      const fragGain = boss ? 3 : 1;
      state.fragments += fragGain;
      state.totalFragmentsEarned += fragGain;
      log(`◈ 유물 파편 획득! +${fragGain}`, 'good');
    }
    if(state.relics.hpRelic > 0){
      const healAmt = Math.round(s.maxHp * (state.relics.hpRelic*0.02));
      if(healAmt > 0 && state.playerHp > 0){
        state.playerHp = Math.min(s.maxHp, state.playerHp + healAmt);
        floatText('+'+healAmt, 'heal');
      }
    }

    spawnMonster();
    updateRebirthAvailability();
  }
  renderAll();
  schedulePlayerTick();
}

function monsterAttackTick(){
  const s = stats();
  if(state.playerHp <= 0 || state.monsterHp <= 0) return;
  if(state.mode === 'tower' && state.towerCleared){
    scheduleMonsterTick();
    return;
  }

  const currentFloor = state.mode === 'tower' ? state.towerFloor : state.floor;
  const monAtk = monsterAtkFor(currentFloor, state.isBoss);
  const dmgToPlayer = Math.round(Math.max(1, monAtk - s.def));
  state.playerHp -= dmgToPlayer;
  floatText('-'+dmgToPlayer, 'dmgToPlayer');

  if(state.playerHp <= 0){
    
    if(state.mode === 'tower'){
      state.playerHp = s.maxHp;
      log(`[무한의 탑] 쓰러졌습니다. 현재 층(${state.towerFloor}층)에 재도합니다.`, 'warn');
    } else {
      state.floor = Math.max(1, state.floor-1);
      state.killsOnFloor = 0;
      state.playerHp = s.maxHp;
      log(`쓰러져서 ${state.floor}층으로 후퇴했습니다.`, 'warn');
    }
    spawnMonster();
  }
  renderAll();
  scheduleMonsterTick();
}

function pulseMonster(){
  const el = document.getElementById('monsterEmoji');
  el.classList.add('hit');
  setTimeout(()=>el.classList.remove('hit'), 100);
}

function schedulePlayerTick(){
  const s = stats();
  clearTimeout(playerTickHandle);
  playerTickHandle = setTimeout(playerAttackTick, s.tickMs);
}

function scheduleMonsterTick(){
  clearTimeout(monsterTickHandle);
  // 몬스터의 공격 주기 고정 (1초 = 1000ms)
  monsterTickHandle = setTimeout(monsterAttackTick, 1000);
}

// ---------- Mode Switching ----------
const TOWER_UNLOCK_LEVEL = 10;

function setMode(mode){
  if(state.mode === mode) return;
  if(mode === 'tower' && state.level < TOWER_UNLOCK_LEVEL){
    alert(`무한의 탑은 레벨 ${TOWER_UNLOCK_LEVEL}부터 입장할 수 있습니다. (현재 레벨: ${state.level})`);
    return;
  }
  state.mode = mode;
  document.getElementById('modeNormalBtn').classList.toggle('active', mode==='normal');
  document.getElementById('modeTowerBtn').classList.toggle('active', mode==='tower');
  
  document.getElementById('arenaTitle').textContent = mode === 'tower' ? '무한의 탑 (100층)' : '회랑';
  log(`[모드 변경] ${mode==='tower'?'무한의 탑':'황혼의 회랑'} 모드로 전환했습니다.`, 'new');
  
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  renderAll();
}

document.getElementById('modeNormalBtn').addEventListener('click', ()=>setMode('normal'));
document.getElementById('modeTowerBtn').addEventListener('click', ()=>setMode('tower'));

