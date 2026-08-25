// ---------- Raid (1인 레이드) ----------
// 해금 조건: 무한의 탑 100층 클리어(state.towerHighestFloor >= 100)
// 티켓제: 최대 3개, 1시간마다 1개 충전 (오프라인 시간도 반영됨)
// 보상: 클리어 시 파편 + 🔮 회랑 결정 확정 지급. 레이드 장비는 더 이상 RNG 드랍이 아니라
// 회랑 결정을 모아 부위별로 "제작"해서 올린다(craftRaidGear 참고). 실패해도 최소 보상은 받는다.

const RAID_TICKET_MAX = 3;
const RAID_TICKET_INTERVAL_MS = 60 * 60 * 1000; // 1시간마다 티켓 1개 충전

const RAID_BOSS_META = {name:'완전변이체 디스토션', emoji:'☣️'};

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
  if(anySubActivityActive('raidActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 레이드에 입장할 수 없습니다.');
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

  // 레이드 동안 폐허/무한의 탑 메인 전투 루프는 일시 정지
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
  renderCombatFrame();
  renderRaidPanel();
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
  renderCombatFrame();
  renderRaidPanel();
  scheduleRaidMonsterTick();
}

function resolveRaidVictory(){
  state.raidClearCount++;
  const fragGain = 15 + Math.floor(Math.random()*6); // 15~20
  state.fragments += fragGain;
  const shardGain = 8 + Math.floor(Math.random()*5); // 8~12, 일반 층 드랍보다 훨씬 후하게
  state.corridorShard = (state.corridorShard||0) + shardGain;

  log(`🏆 [레이드] ${RAID_BOSS_META.name} 처치! ◈ 파편 +${fragGain}, 🔮 회랑 결정 +${shardGain}`, 'good');
  endRaid();
}

function resolveRaidDefeat(){
  // 패배해도 완전히 빈손으로 돌려보내지 않도록 소량의 회랑 결정은 지급한다 (도전 자체의 소모값 보전).
  const shardGain = 2 + Math.floor(Math.random()*2); // 2~3
  state.corridorShard = (state.corridorShard||0) + shardGain;
  log(`💀 [레이드] ${RAID_BOSS_META.name}에게 패배했습니다. 🔮 회랑 결정 +${shardGain} (다음 티켓으로 다시 도전하세요)`, 'warn');
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

// ---------- Raid Gear Crafting (부위별 제작) ----------
// 부위(weapon/armor/crown/ring)당 레벨 1~20까지, 레벨을 올릴 때마다 🔮 회랑 결정을 소모해 시도한다.
// 실패해도 재료만 소모될 뿐 레벨은 그대로 유지된다(하락/파괴 없음).
function raidGearOwnedCount(){
  return RAID_GEAR.filter(g => (state.raidGear[g.key]||0) > 0).length;
}

// state.js stats()에서 typeof 가드로 호출한다 (job.js의 jobBonus()와 동일한 패턴).
function raidSetBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0};
  const owned = raidGearOwnedCount();
  RAID_SET_BONUS_TIERS.forEach(t=>{
    if(owned >= t.count){
      b.atkPct += t.bonus.atkPct||0;
      b.defPct += t.bonus.defPct||0;
      b.hpPct += t.bonus.hpPct||0;
    }
  });
  return b;
}

function craftRaidGear(key){
  const gear = RAID_GEAR.find(g => g.key === key);
  if(!gear) return;
  const current = state.raidGear[key]||0;
  if(current >= gear.maxLevel){
    flashMessageSafe(`${gear.name}은(는) 이미 최대 강화입니다.`);
    return;
  }
  const target = current + 1;
  const rate = raidCraftSuccessRate(target);
  const cost = raidCraftShardCost(target);
  if((state.corridorShard||0) < cost){
    flashMessageSafe(`🔮 회랑 결정이 부족합니다. (필요 🔮${cost} / 보유 🔮${state.corridorShard||0})`);
    return;
  }
  state.corridorShard -= cost;
  const success = Math.random()*100 < rate;
  if(success){
    state.raidGear[key] = target;
    log(`✅ ${gear.icon} ${gear.name} 제작 성공! (Lv.${current} → Lv.${target}, 🔮-${cost})`, 'good');
  } else {
    log(`❌ ${gear.icon} ${gear.name} 제작 실패... (Lv.${current} 유지, 🔮-${cost} 소모)`, 'warn');
  }
  renderRaidPanel();
  renderAll();
}

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

  document.getElementById('raidShardText').textContent = state.corridorShard||0;

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

  const owned = raidGearOwnedCount();
  const setBonusEl = document.getElementById('raidSetBonusText');
  if(setBonusEl){
    const active = RAID_SET_BONUS_TIERS.filter(t => owned >= t.count);
    setBonusEl.textContent = active.length > 0
      ? active.map(t => `✅ ${t.label} (공/방/체력 +${t.bonus.atkPct}%)`).join(' · ')
      : `${RAID_SET_BONUS_TIERS[0].count}부위 이상 제작 시 세트 효과 발동`;
  }

  const grid = document.getElementById('raidGearGrid');
  grid.innerHTML = '';
  RAID_GEAR.forEach(g=>{
    const lvl = state.raidGear[g.key] || 0;
    const isOwned = lvl > 0;
    const isMax = lvl >= g.maxLevel;
    const value = Math.round(lvl * g.perLevel * 10) / 10;
    const target = lvl + 1;
    const rate = isMax ? null : raidCraftSuccessRate(target);
    const cost = isMax ? null : raidCraftShardCost(target);
    const card = document.createElement('div');
    card.className = 'relic-card raid-slot' + (isOwned?' owned':'') + (isMax?' maxed':'');
    card.innerHTML = `
      <div class="rname"><span>${g.icon} ${g.name}</span><span class="rlvl">Lv.${lvl}/${g.maxLevel}</span></div>
      <div class="rdesc">${g.descFn(isOwned ? value : g.perLevel)}${isOwned?'':' (미제작)'}</div>
      ${isMax
        ? `<div class="rdesc" style="color:var(--gold);margin-top:4px;">✨ 최대 강화 완료</div>`
        : `<button class="raid-craft-btn" type="button" data-key="${g.key}">🔨 제작 (성공률 ${rate}% · 🔮${cost})</button>`
      }
    `;
    if(!isMax){
      card.querySelector('.raid-craft-btn').addEventListener('click', () => craftRaidGear(g.key));
    }
    grid.appendChild(card);
  });
}

// 티켓 충전 카운트다운 표시를 위해 1초마다 갱신 (해금 전에는 스킵)
setInterval(()=>{
  if(!raidUnlocked()) return;
  refreshRaidTickets();
  renderRaidPanel();
}, 1000);
