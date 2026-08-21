// ---------- Forge Dungeon (단조 구역) ----------
// 물자/유산 구역과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 🔩 강화석입니다.
// 강화석은 지금까지 일반 전투 드랍(확률제)이 유일한 공급원이었는데, 장비 강화 시스템의
// 비용이 강화 단계가 오를수록 지수적으로 뛰기 때문에(enhance.js 참고) 확정적으로 강화석을
// 모을 수 있는 루트가 필요해서 신설되었다. 난이도 곡선은 물자/유산 구역과 동일하게 맞춘다.

const FORGE_DUNGEON_TICKET_MAX = 3;
const FORGE_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const FORGE_DUNGEON_MAX_FLOOR = 50;

const FORGE_DUNGEON_META = {name:'단조로의 파수꾼', emoji:'🔥'};

function fdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function fdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function fdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
// 1층 12개부터 시작해 층마다 1.4배씩 증가
function fdStoneFor(floor){ return Math.round(12 * Math.pow(1.4, floor-1)); }

function refreshForgeDungeonTickets(){
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    state.fdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.fdTicketLastRefill;
  const gained = Math.floor(elapsed / FORGE_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(FORGE_DUNGEON_TICKET_MAX, state.fdTicket + gained);
  const actuallyGained = newTicket - state.fdTicket;
  state.fdTicket = newTicket;
  state.fdTicketLastRefill += actuallyGained * FORGE_DUNGEON_TICKET_INTERVAL_MS;
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    state.fdTicketLastRefill = now;
  }
}

let fdPlayerTickHandle = null;
let fdMonsterTickHandle = null;

function enterForgeDungeon(){
  if(state.fdActive) return;
  if(anySubActivityActive('fdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 단조 구역에 입장할 수 없습니다.');
    return;
  }
  refreshForgeDungeonTickets();
  if(state.fdTicket <= 0){
    alert('단조 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderForgeDungeonPanel();
    return;
  }
  if(!confirm(`단조 구역 ${state.fdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.fdTicket--;
  state.fdActive = true;
  state.fdMonsterMaxHp = fdHpFor(state.fdFloor);
  state.fdMonsterHp = state.fdMonsterMaxHp;
  const s = stats();
  state.fdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🔥 [단조 구역] ${state.fdFloor}층 ${FORGE_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleFdPlayerTick();
  scheduleFdMonsterTick();
}

function scheduleFdPlayerTick(){
  const s = stats();
  clearTimeout(fdPlayerTickHandle);
  fdPlayerTickHandle = setTimeout(fdPlayerAttackTick, s.tickMs);
}

function scheduleFdMonsterTick(){
  clearTimeout(fdMonsterTickHandle);
  fdMonsterTickHandle = setTimeout(fdMonsterAttackTick, 1000);
}

function fdPlayerAttackTick(){
  if(!state.fdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - fdDefFor(state.fdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.fdMonsterHp -= dmg;

  if(state.fdMonsterHp <= 0){
    resolveForgeDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderForgeDungeonPanel();
  scheduleFdPlayerTick();
}

function fdMonsterAttackTick(){
  if(!state.fdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, fdAtkFor(state.fdFloor) - s.def));
  state.fdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.fdPlayerHp <= 0){
    resolveForgeDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderForgeDungeonPanel();
  scheduleFdMonsterTick();
}

function resolveForgeDungeonVictory(){
  const stoneGain = fdStoneFor(state.fdFloor);
  state.enhanceStone = (state.enhanceStone||0) + stoneGain;
  state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned||0) + stoneGain;
  log(`🏆 [단조 구역] ${state.fdFloor}층 클리어! +${stoneGain.toLocaleString()}🔩`, 'good');

  if(state.fdFloor < FORGE_DUNGEON_MAX_FLOOR){
    state.fdFloor++;
    if(state.fdFloor >= FORGE_DUNGEON_MAX_FLOOR){
      log(`🔥 단조 구역을 모두 정복했습니다! 이제부터는 ${FORGE_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  }
  endForgeDungeon();
}

function resolveForgeDungeonDefeat(){
  log(`💀 [단조 구역] ${state.fdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endForgeDungeon();
}

function endForgeDungeon(){
  state.fdActive = false;
  clearTimeout(fdPlayerTickHandle);
  clearTimeout(fdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('fdEnterBtn')?.addEventListener('click', enterForgeDungeon);

function renderForgeDungeonPanel(){
  refreshForgeDungeonTickets();

  const floorEl = document.getElementById('fdFloorText');
  if(!floorEl) return;
  floorEl.textContent = state.fdFloor >= FORGE_DUNGEON_MAX_FLOOR
    ? `${FORGE_DUNGEON_MAX_FLOOR}/${FORGE_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.fdFloor}/${FORGE_DUNGEON_MAX_FLOOR}`;
  document.getElementById('fdNextReward').textContent = fdStoneFor(state.fdFloor).toLocaleString();

  document.getElementById('fdTicketText').textContent = `${state.fdTicket}/${FORGE_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('fdTicketTimer');
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = FORGE_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.fdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('fdEnterBtn');
  enterBtn.disabled = state.fdActive || state.fdTicket <= 0;
  enterBtn.textContent = state.fdActive ? '전투 진행 중...' : `${state.fdFloor}층 도전`;

  const battleBox = document.getElementById('fdBattleBox');
  if(state.fdActive){
    battleBox.style.display = 'block';
    document.getElementById('fdMonsterEmoji').textContent = FORGE_DUNGEON_META.emoji;
    document.getElementById('fdMonsterName').textContent = `${state.fdFloor}층 ${FORGE_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.fdMonsterHp/state.fdMonsterMaxHp*100));
    document.getElementById('fdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('fdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.fdMonsterHp))} / ${state.fdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.fdPlayerHp/s.maxHp*100));
    document.getElementById('fdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('fdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.fdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshForgeDungeonTickets();
  renderForgeDungeonPanel();
}, 1000);
