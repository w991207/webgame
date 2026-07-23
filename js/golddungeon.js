// ---------- Gold Dungeon (골드 던전) ----------
// 티켓제: 최대 3개, 15분마다 1개 충전 (오프라인 시간도 반영됨 - 확인 시점에 경과시간으로 계산)
// 층수: 우선 1~10층까지 (추후 업데이트로 확장 예정)
// 난이도: 1층 = 무한의 탑 10층 정도, 이후 층마다 약 1.33배씩 강해짐
// 보상: 층수별 확정 골드 지급. 1층 5,000골드부터 시작해 층마다 1.5배씩 증가

const GOLD_DUNGEON_TICKET_MAX = 3;
const GOLD_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const GOLD_DUNGEON_MAX_FLOOR = 10;

const GOLD_DUNGEON_META = {name:'황금 수호병', emoji:'💰'};

// 층별 고정 스탯. 1층은 무한의 탑 10층(보스) 수준으로 맞추고, 10층은 1인 레이드에 근접하는 난이도.
// 이 네 함수의 배율(1.33, 1.5)만 조절하면 던전 전체 난이도/보상 곡선을 바꿀 수 있음.
function gdHpFor(floor){ return Math.round(1600 * Math.pow(1.33, floor-1)); }
function gdAtkFor(floor){ return Math.round(27 * Math.pow(1.33, floor-1)); }
function gdDefFor(floor){ return Math.round(8 * Math.pow(1.33, floor-1)); }
function gdGoldFor(floor){ return Math.round(5000 * Math.pow(1.5, floor-1)); }

function refreshGoldDungeonTickets(){
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    state.gdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.gdTicketLastRefill;
  const gained = Math.floor(elapsed / GOLD_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(GOLD_DUNGEON_TICKET_MAX, state.gdTicket + gained);
  const actuallyGained = newTicket - state.gdTicket;
  state.gdTicket = newTicket;
  state.gdTicketLastRefill += actuallyGained * GOLD_DUNGEON_TICKET_INTERVAL_MS;
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    state.gdTicketLastRefill = now;
  }
}

let gdPlayerTickHandle = null;
let gdMonsterTickHandle = null;

function enterGoldDungeon(){
  if(state.gdCleared){
    alert('골드 던전을 모두 정복했습니다! 다음 업데이트로 층이 추가될 예정입니다.');
    return;
  }
  if(state.gdActive) return;
  if(state.raidActive){
    alert('레이드 진행 중에는 골드 던전에 입장할 수 없습니다.');
    return;
  }
  refreshGoldDungeonTickets();
  if(state.gdTicket <= 0){
    alert('골드 던전 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderGoldDungeonPanel();
    return;
  }
  if(!confirm(`골드 던전 ${state.gdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.gdTicket--;
  state.gdActive = true;
  state.gdMonsterMaxHp = gdHpFor(state.gdFloor);
  state.gdMonsterHp = state.gdMonsterMaxHp;
  const s = stats();
  state.gdPlayerHp = s.maxHp;

  // 골드 던전 동안 회랑/무한의 탑 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`💰 [골드 던전] ${state.gdFloor}층 ${GOLD_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleGdPlayerTick();
  scheduleGdMonsterTick();
}

function scheduleGdPlayerTick(){
  const s = stats();
  clearTimeout(gdPlayerTickHandle);
  gdPlayerTickHandle = setTimeout(gdPlayerAttackTick, s.tickMs);
}

function scheduleGdMonsterTick(){
  clearTimeout(gdMonsterTickHandle);
  gdMonsterTickHandle = setTimeout(gdMonsterAttackTick, 1000);
}

function gdPlayerAttackTick(){
  if(!state.gdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - gdDefFor(state.gdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.gdMonsterHp -= dmg;

  if(state.gdMonsterHp <= 0){
    resolveGoldDungeonVictory();
    return;
  }
  renderAll();
  scheduleGdPlayerTick();
}

function gdMonsterAttackTick(){
  if(!state.gdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, gdAtkFor(state.gdFloor) - s.def));
  state.gdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.gdPlayerHp <= 0){
    resolveGoldDungeonDefeat();
    return;
  }
  renderAll();
  scheduleGdMonsterTick();
}

function resolveGoldDungeonVictory(){
  const goldGain = gdGoldFor(state.gdFloor);
  state.gold += goldGain;
  state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + goldGain;
  log(`🏆 [골드 던전] ${state.gdFloor}층 클리어! +${goldGain.toLocaleString()}🪙`, 'good');

  if(state.gdFloor >= GOLD_DUNGEON_MAX_FLOOR){
    state.gdCleared = true;
    log(`💰 골드 던전을 모두 정복했습니다! (추가 층 업데이트 예정)`, 'good');
  } else {
    state.gdFloor++;
  }
  endGoldDungeon();
}

function resolveGoldDungeonDefeat(){
  log(`💀 [골드 던전] ${state.gdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endGoldDungeon();
}

function endGoldDungeon(){
  state.gdActive = false;
  clearTimeout(gdPlayerTickHandle);
  clearTimeout(gdMonsterTickHandle);
  // 메인 전투 루프 재개
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('gdEnterBtn').addEventListener('click', enterGoldDungeon);

function renderGoldDungeonPanel(){
  refreshGoldDungeonTickets();

  document.getElementById('gdFloorText').textContent = state.gdCleared
    ? `${GOLD_DUNGEON_MAX_FLOOR}/${GOLD_DUNGEON_MAX_FLOOR} (정복 완료)`
    : `${state.gdFloor}/${GOLD_DUNGEON_MAX_FLOOR}`;
  document.getElementById('gdNextReward').textContent = state.gdCleared ? '-' : gdGoldFor(state.gdFloor).toLocaleString();

  document.getElementById('gdTicketText').textContent = `${state.gdTicket}/${GOLD_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('gdTicketTimer');
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = GOLD_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.gdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('gdEnterBtn');
  enterBtn.disabled = state.gdActive || state.gdTicket <= 0 || state.gdCleared;
  enterBtn.textContent = state.gdCleared ? '정복 완료' : (state.gdActive ? '전투 진행 중...' : `${state.gdFloor}층 도전`);

  const battleBox = document.getElementById('gdBattleBox');
  if(state.gdActive){
    battleBox.style.display = 'block';
    document.getElementById('gdMonsterEmoji').textContent = GOLD_DUNGEON_META.emoji;
    document.getElementById('gdMonsterName').textContent = `${state.gdFloor}층 ${GOLD_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.gdMonsterHp/state.gdMonsterMaxHp*100));
    document.getElementById('gdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('gdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.gdMonsterHp))} / ${state.gdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.gdPlayerHp/s.maxHp*100));
    document.getElementById('gdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('gdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.gdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

// 티켓 충전 카운트다운 표시를 위해 1초마다 갱신
setInterval(()=>{
  refreshGoldDungeonTickets();
  renderGoldDungeonPanel();
}, 1000);
