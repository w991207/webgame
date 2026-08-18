// ---------- Training Dungeon (수련 구역) ----------
// 물자/유산 구역과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 확정 경험치입니다.
// 물자/유산 구역과 마찬가지로 보상은 플레이어의 expMult 배율과 무관한 고정값 — 레벨 1000에
// 전직이 걸려있어(job.js) 초중반 레벨업을 확정적으로 보조해줄 루트가 필요해서 신설되었다.

const TRAINING_DUNGEON_TICKET_MAX = 3;
const TRAINING_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const TRAINING_DUNGEON_MAX_FLOOR = 10;

const TRAINING_DUNGEON_META = {name:'수련 인형', emoji:'🥋'};

function tdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function tdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function tdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
// 1층 400exp부터 시작해 층마다 1.45배씩 증가 (10층 클리어 시 약 12,840exp)
function tdExpFor(floor){ return Math.round(480 * Math.pow(1.5, floor-1)); }

function refreshTrainingDungeonTickets(){
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    state.tdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.tdTicketLastRefill;
  const gained = Math.floor(elapsed / TRAINING_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(TRAINING_DUNGEON_TICKET_MAX, state.tdTicket + gained);
  const actuallyGained = newTicket - state.tdTicket;
  state.tdTicket = newTicket;
  state.tdTicketLastRefill += actuallyGained * TRAINING_DUNGEON_TICKET_INTERVAL_MS;
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    state.tdTicketLastRefill = now;
  }
}

let tdPlayerTickHandle = null;
let tdMonsterTickHandle = null;

function enterTrainingDungeon(){
  if(state.tdActive) return;
  if(anySubActivityActive('tdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 수련 구역에 입장할 수 없습니다.');
    return;
  }
  refreshTrainingDungeonTickets();
  if(state.tdTicket <= 0){
    alert('수련 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderTrainingDungeonPanel();
    return;
  }
  if(!confirm(`수련 구역 ${state.tdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.tdTicket--;
  state.tdActive = true;
  state.tdMonsterMaxHp = tdHpFor(state.tdFloor);
  state.tdMonsterHp = state.tdMonsterMaxHp;
  const s = stats();
  state.tdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🥋 [수련 구역] ${state.tdFloor}층 ${TRAINING_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleTdPlayerTick();
  scheduleTdMonsterTick();
}

function scheduleTdPlayerTick(){
  const s = stats();
  clearTimeout(tdPlayerTickHandle);
  tdPlayerTickHandle = setTimeout(tdPlayerAttackTick, s.tickMs);
}

function scheduleTdMonsterTick(){
  clearTimeout(tdMonsterTickHandle);
  tdMonsterTickHandle = setTimeout(tdMonsterAttackTick, 1000);
}

function tdPlayerAttackTick(){
  if(!state.tdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - tdDefFor(state.tdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.tdMonsterHp -= dmg;

  if(state.tdMonsterHp <= 0){
    resolveTrainingDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderTrainingDungeonPanel();
  scheduleTdPlayerTick();
}

function tdMonsterAttackTick(){
  if(!state.tdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, tdAtkFor(state.tdFloor) - s.def));
  state.tdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.tdPlayerHp <= 0){
    resolveTrainingDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderTrainingDungeonPanel();
  scheduleTdMonsterTick();
}

function resolveTrainingDungeonVictory(){
  const expGain = tdExpFor(state.tdFloor);
  state.exp += expGain;
  tryLevelUp();
  log(`🏆 [수련 구역] ${state.tdFloor}층 클리어! +${expGain.toLocaleString()}EXP`, 'good');

  if(state.tdFloor >= TRAINING_DUNGEON_MAX_FLOOR){
    if(!state.tdCleared){
      state.tdCleared = true;
      log(`🥋 수련 구역을 모두 정복했습니다! 이제부터는 ${TRAINING_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  } else {
    state.tdFloor++;
  }
  endTrainingDungeon();
}

function resolveTrainingDungeonDefeat(){
  log(`💀 [수련 구역] ${state.tdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endTrainingDungeon();
}

function endTrainingDungeon(){
  state.tdActive = false;
  clearTimeout(tdPlayerTickHandle);
  clearTimeout(tdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('tdEnterBtn')?.addEventListener('click', enterTrainingDungeon);

function renderTrainingDungeonPanel(){
  refreshTrainingDungeonTickets();

  const floorEl = document.getElementById('tdFloorText');
  if(!floorEl) return;
  floorEl.textContent = state.tdCleared
    ? `${TRAINING_DUNGEON_MAX_FLOOR}/${TRAINING_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.tdFloor}/${TRAINING_DUNGEON_MAX_FLOOR}`;
  document.getElementById('tdNextReward').textContent = tdExpFor(state.tdFloor).toLocaleString();

  document.getElementById('tdTicketText').textContent = `${state.tdTicket}/${TRAINING_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('tdTicketTimer');
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = TRAINING_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.tdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('tdEnterBtn');
  enterBtn.disabled = state.tdActive || state.tdTicket <= 0;
  enterBtn.textContent = state.tdActive ? '전투 진행 중...' : `${state.tdFloor}층 도전`;

  const battleBox = document.getElementById('tdBattleBox');
  if(state.tdActive){
    battleBox.style.display = 'block';
    document.getElementById('tdMonsterEmoji').textContent = TRAINING_DUNGEON_META.emoji;
    document.getElementById('tdMonsterName').textContent = `${state.tdFloor}층 ${TRAINING_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.tdMonsterHp/state.tdMonsterMaxHp*100));
    document.getElementById('tdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('tdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.tdMonsterHp))} / ${state.tdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.tdPlayerHp/s.maxHp*100));
    document.getElementById('tdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('tdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.tdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshTrainingDungeonTickets();
  renderTrainingDungeonPanel();
}, 1000);
