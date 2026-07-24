// ---------- Relic Dungeon (유물 던전) ----------
// 골드 던전과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 골드 대신 유물 파편입니다.
// 티켓제: 최대 3개, 15분마다 1개 충전
// 층수: 우선 1~10층까지 (추후 업데이트로 확장 예정)
// 난이도: 골드 던전과 동일한 곡선 (1층 = 무한의 탑 10층 정도, 10층 = 1인 레이드에 근접)

const RELIC_DUNGEON_TICKET_MAX = 3;
const RELIC_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const RELIC_DUNGEON_MAX_FLOOR = 10;

const RELIC_DUNGEON_META = {name:'유물 수호자', emoji:'🗿'};

// 층별 고정 스탯. 골드 던전과 동일한 전투 난이도 곡선을 사용.
function rdHpFor(floor){ return Math.round(1600 * Math.pow(1.33, floor-1)); }
function rdAtkFor(floor){ return Math.round(27 * Math.pow(1.33, floor-1)); }
function rdDefFor(floor){ return Math.round(8 * Math.pow(1.33, floor-1)); }
// 보상은 유물 파편. 1층 5개부터 시작해 층마다 1.4배씩 증가 (10층 클리어 시 약 103개)
function rdFragFor(floor){ return Math.round(5 * Math.pow(1.4, floor-1)); }

function refreshRelicDungeonTickets(){
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    state.rdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.rdTicketLastRefill;
  const gained = Math.floor(elapsed / RELIC_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(RELIC_DUNGEON_TICKET_MAX, state.rdTicket + gained);
  const actuallyGained = newTicket - state.rdTicket;
  state.rdTicket = newTicket;
  state.rdTicketLastRefill += actuallyGained * RELIC_DUNGEON_TICKET_INTERVAL_MS;
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    state.rdTicketLastRefill = now;
  }
}

let rdPlayerTickHandle = null;
let rdMonsterTickHandle = null;

function enterRelicDungeon(){
  if(state.rdCleared){
    alert('유물 던전을 모두 정복했습니다! 다음 업데이트로 층이 추가될 예정입니다.');
    return;
  }
  if(state.rdActive) return;
  if(state.raidActive || state.gdActive){
    alert('다른 전투(레이드/골드 던전) 진행 중에는 유물 던전에 입장할 수 없습니다.');
    return;
  }
  refreshRelicDungeonTickets();
  if(state.rdTicket <= 0){
    alert('유물 던전 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderRelicDungeonPanel();
    return;
  }
  if(!confirm(`유물 던전 ${state.rdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.rdTicket--;
  state.rdActive = true;
  state.rdMonsterMaxHp = rdHpFor(state.rdFloor);
  state.rdMonsterHp = state.rdMonsterMaxHp;
  const s = stats();
  state.rdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🗿 [유물 던전] ${state.rdFloor}층 ${RELIC_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleRdPlayerTick();
  scheduleRdMonsterTick();
}

function scheduleRdPlayerTick(){
  const s = stats();
  clearTimeout(rdPlayerTickHandle);
  rdPlayerTickHandle = setTimeout(rdPlayerAttackTick, s.tickMs);
}

function scheduleRdMonsterTick(){
  clearTimeout(rdMonsterTickHandle);
  rdMonsterTickHandle = setTimeout(rdMonsterAttackTick, 1000);
}

function rdPlayerAttackTick(){
  if(!state.rdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - rdDefFor(state.rdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.rdMonsterHp -= dmg;

  if(state.rdMonsterHp <= 0){
    resolveRelicDungeonVictory();
    return;
  }
  renderAll();
  scheduleRdPlayerTick();
}

function rdMonsterAttackTick(){
  if(!state.rdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, rdAtkFor(state.rdFloor) - s.def));
  state.rdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.rdPlayerHp <= 0){
    resolveRelicDungeonDefeat();
    return;
  }
  renderAll();
  scheduleRdMonsterTick();
}

function resolveRelicDungeonVictory(){
  const fragGain = rdFragFor(state.rdFloor);
  state.fragments = (state.fragments||0) + fragGain;
  log(`🏆 [유물 던전] ${state.rdFloor}층 클리어! +${fragGain.toLocaleString()}◈`, 'good');

  if(state.rdFloor >= RELIC_DUNGEON_MAX_FLOOR){
    state.rdCleared = true;
    log(`🗿 유물 던전을 모두 정복했습니다! (추가 층 업데이트 예정)`, 'good');
  } else {
    state.rdFloor++;
  }
  endRelicDungeon();
}

function resolveRelicDungeonDefeat(){
  log(`💀 [유물 던전] ${state.rdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endRelicDungeon();
}

function endRelicDungeon(){
  state.rdActive = false;
  clearTimeout(rdPlayerTickHandle);
  clearTimeout(rdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('rdEnterBtn').addEventListener('click', enterRelicDungeon);

function renderRelicDungeonPanel(){
  refreshRelicDungeonTickets();

  document.getElementById('rdFloorText').textContent = state.rdCleared
    ? `${RELIC_DUNGEON_MAX_FLOOR}/${RELIC_DUNGEON_MAX_FLOOR} (정복 완료)`
    : `${state.rdFloor}/${RELIC_DUNGEON_MAX_FLOOR}`;
  document.getElementById('rdNextReward').textContent = state.rdCleared ? '-' : rdFragFor(state.rdFloor).toLocaleString();

  document.getElementById('rdTicketText').textContent = `${state.rdTicket}/${RELIC_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('rdTicketTimer');
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = RELIC_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.rdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('rdEnterBtn');
  enterBtn.disabled = state.rdActive || state.rdTicket <= 0 || state.rdCleared;
  enterBtn.textContent = state.rdCleared ? '정복 완료' : (state.rdActive ? '전투 진행 중...' : `${state.rdFloor}층 도전`);

  const battleBox = document.getElementById('rdBattleBox');
  if(state.rdActive){
    battleBox.style.display = 'block';
    document.getElementById('rdMonsterEmoji').textContent = RELIC_DUNGEON_META.emoji;
    document.getElementById('rdMonsterName').textContent = `${state.rdFloor}층 ${RELIC_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.rdMonsterHp/state.rdMonsterMaxHp*100));
    document.getElementById('rdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('rdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.rdMonsterHp))} / ${state.rdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.rdPlayerHp/s.maxHp*100));
    document.getElementById('rdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('rdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.rdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshRelicDungeonTickets();
  renderRelicDungeonPanel();
}, 1000);
