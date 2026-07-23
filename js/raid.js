// ---------- Raid (1인 레이드) ----------
// 해금 조건: 무한의 탑 100층 클리어(state.towerHighestFloor >= 100)
// 티켓제: 최대 3개, 1시간마다 1개 충전 (오프라인 시간도 반영됨)
// 보상: 클리어 시 파편 확정 지급 + 낮은 확률로 레이드 장비 획득, 천장 시스템으로 일정 횟수 내 확정 지급

const RAID_TICKET_MAX = 3;
const RAID_TICKET_INTERVAL_MS = 60 * 60 * 1000; // 1시간마다 티켓 1개 충전
const RAID_PITY_CAP = 10; // 이 횟수 안에 장비를 못 얻으면 다음 클리어 때 확정 지급
const RAID_GEAR_DROP_CHANCE = 0.12; // 클리어당 장비 획득 확률 12%

const RAID_BOSS_META = {name:'심연을 삼킨 파멸체', emoji:'🌌'};

// 무한의 탑 100층을 클리어한 유저도 다소 힘겨울 정도로 맞춘 고정 스탯.
// 실제 플레이 데이터로 검증 후 이 세 값만 조절하면 난이도를 바꿀 수 있음.
function raidBossHp(){ return 20500; }
function raidBossAtk(){ return 680; }
function raidBossDef(){ return 85; }

function raidUnlocked(){
  return state.towerHighestFloor >= 100;
}

function refreshRaidTickets(){
  if(state.raidTicket >= RAID_TICKET_MAX){
    state.raidTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.raidTicketLastRefill;
  const gained = Math.floor(elapsed / RAID_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(RAID_TICKET_MAX, state.raidTicket + gained);
  const actuallyGained = newTicket - state.raidTicket;
  state.raidTicket = newTicket;
  state.raidTicketLastRefill += actuallyGained * RAID_TICKET_INTERVAL_MS;
  if(state.raidTicket >= RAID_TICKET_MAX){
    state.raidTicketLastRefill = now;
  }
}

let raidPlayerTickHandle = null;
let raidMonsterTickHandle = null;

function enterRaid(){
  if(!raidUnlocked()){
    alert('무한의 탑 100층을 클리어해야 레이드에 입장할 수 있습니다.');
    return;
  }
  if(state.raidActive) return;
  if(state.gdActive){
    alert('골드 던전 진행 중에는 레이드에 입장할 수 없습니다.');
    return;
  }
  refreshRaidTickets();
  if(state.raidTicket <= 0){
    alert('레이드 티켓이 부족합니다. (1시간마다 1개씩 충전됩니다)');
    renderRaidPanel();
    return;
  }
  if(!confirm('레이드에 입장하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 다음 티켓으로 재도전해야 합니다)')) return;

  state.raidTicket--;
  state.raidActive = true;
  state.raidBossMaxHp = raidBossHp();
  state.raidBossHp = state.raidBossMaxHp;
  const s = stats();
  state.raidPlayerHp = s.maxHp;

  // 레이드 동안 회랑/무한의 탑 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`⚔️ [레이드] ${RAID_BOSS_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleRaidPlayerTick();
  scheduleRaidMonsterTick();
}

function scheduleRaidPlayerTick(){
  const s = stats();
  clearTimeout(raidPlayerTickHandle);
  raidPlayerTickHandle = setTimeout(raidPlayerAttackTick, s.tickMs);
}

function scheduleRaidMonsterTick(){
  clearTimeout(raidMonsterTickHandle);
  raidMonsterTickHandle = setTimeout(raidMonsterAttackTick, 1000);
}

function raidPlayerAttackTick(){
  if(!state.raidActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - raidBossDef()));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.raidBossHp -= dmg;

  if(state.raidBossHp <= 0){
    resolveRaidVictory();
    return;
  }
  renderAll();
  scheduleRaidPlayerTick();
}

function raidMonsterAttackTick(){
  if(!state.raidActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, raidBossAtk() - s.def));
  state.raidPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.raidPlayerHp <= 0){
    resolveRaidDefeat();
    return;
  }
  renderAll();
  scheduleRaidMonsterTick();
}

function resolveRaidVictory(){
  state.raidClearCount++;
  const fragGain = 15 + Math.floor(Math.random()*6); // 15~20
  state.fragments += fragGain;
  state.raidPity++;

  let dropMsg = '';
  if(Math.random() < RAID_GEAR_DROP_CHANCE || state.raidPity >= RAID_PITY_CAP){
    const picked = RAID_GEAR[Math.floor(Math.random()*RAID_GEAR.length)];
    state.raidGear[picked.key] = (state.raidGear[picked.key]||0) + 1;
    state.raidPity = 0;
    dropMsg = ` ${picked.icon} ${picked.name} 획득! (Lv.${state.raidGear[picked.key]})`;
  }

  log(`🏆 [레이드] ${RAID_BOSS_META.name} 처치! ◈ 파편 +${fragGain}${dropMsg}`, 'good');
  endRaid();
}

function resolveRaidDefeat(){
  log(`💀 [레이드] ${RAID_BOSS_META.name}에게 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endRaid();
}

function endRaid(){
  state.raidActive = false;
  clearTimeout(raidPlayerTickHandle);
  clearTimeout(raidMonsterTickHandle);
  // 메인 전투 루프 재개
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('raidEnterBtn').addEventListener('click', enterRaid);

function formatMs(ms){
  const totalSec = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(totalSec/60);
  const sec = totalSec%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function renderRaidPanel(){
  refreshRaidTickets();
  const unlocked = raidUnlocked();
  const lockedBox = document.getElementById('raidLockedBox');
  const unlockedBox = document.getElementById('raidUnlockedBox');
  if(!unlocked){
    lockedBox.style.display = 'block';
    unlockedBox.style.display = 'none';
    document.getElementById('raidLockProgress').textContent = state.towerHighestFloor;
    return;
  }
  lockedBox.style.display = 'none';
  unlockedBox.style.display = 'block';

  document.getElementById('raidTicketText').textContent = `${state.raidTicket}/${RAID_TICKET_MAX}`;
  const timerEl = document.getElementById('raidTicketTimer');
  if(state.raidTicket >= RAID_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = RAID_TICKET_INTERVAL_MS - (Date.now() - state.raidTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  document.getElementById('raidPityText').textContent = Math.max(0, RAID_PITY_CAP - state.raidPity);

  const enterBtn = document.getElementById('raidEnterBtn');
  enterBtn.disabled = state.raidActive || state.raidTicket <= 0;
  enterBtn.textContent = state.raidActive ? '전투 진행 중...' : '레이드 입장';

  const battleBox = document.getElementById('raidBattleBox');
  if(state.raidActive){
    battleBox.style.display = 'block';
    document.getElementById('raidBossEmoji').textContent = RAID_BOSS_META.emoji;
    document.getElementById('raidBossName').textContent = RAID_BOSS_META.name;
    const bPct = Math.max(0, (state.raidBossHp/state.raidBossMaxHp*100));
    document.getElementById('raidBossHpBar').style.width = bPct+'%';
    document.getElementById('raidBossHpText').textContent = `${Math.max(0,Math.ceil(state.raidBossHp))} / ${state.raidBossMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.raidPlayerHp/s.maxHp*100));
    document.getElementById('raidPlayerHpBar').style.width = pPct+'%';
    document.getElementById('raidPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.raidPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }

  const grid = document.getElementById('raidGearGrid');
  grid.innerHTML = '';
  RAID_GEAR.forEach(g=>{
    const lvl = state.raidGear[g.key] || 0;
    const owned = lvl > 0;
    const value = Math.round(lvl * g.perLevel * 10) / 10;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'');
    card.innerHTML = `
      <div class="rname"><span>${g.icon} ${g.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${g.descFn(owned ? value : g.perLevel)}${owned?'':' (미보유)'}</div>
    `;
    grid.appendChild(card);
  });
}

// 티켓 충전 카운트다운 표시를 위해 1초마다 갱신 (해금 전에는 스킵)
setInterval(()=>{
  if(!raidUnlocked()) return;
  refreshRaidTickets();
  renderRaidPanel();
}, 1000);
