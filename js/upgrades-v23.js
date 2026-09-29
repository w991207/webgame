// ============================================================
// v2.23.0 업그레이드 팩
// 1) 커스텀 토스트/모달 연동(alert 우회)  2) 상점 MAX 구매
// 3) 구역 소탕(스윕)                     4) 카드 최적 장착 + 등급 필터 + 세트 미리보기
// 5) 오프라인 보상 확장(티켓 재충전/영지 수확) 6) 백그라운드 절전 중앙 티커
// 7) 주간 미션   8) DPS 미터   9) 미니게임 점수 연동  10) 저장값 안전 텍스트
// 기존 파일은 최소한만 건드리고, 새 기능은 이 파일 하나에 모아둔다.
// ============================================================

// ---------- 공용 안전 텍스트 (auth.js의 escapeHtml 재사용) ----------
function safeText(str){
  if(typeof escapeHtml === 'function') return escapeHtml(str == null ? '' : str);
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ---------- 1) 네이티브 alert를 게임 내 토스트로 우회 ----------
// 기존 alert() 호출이 남아 있어도 모바일 PWA에서 팝업이 뜨지 않고 토스트로 표시된다.
// (confirm/prompt는 Promise 기반 헬퍼(showGameConfirm/showGamePrompt)로 호출부에서 교체)
function installToastAlertOverride(){
  if(window.__alertOverridden) return;
  window.alert = function(msg){ notifyGame(msg, 'warn'); };
  window.__alertOverridden = true;
}

// ---------- 2) 상점 MAX 구매 ----------
// 보유 재화로 살 수 있는 최대 개수와 총 비용을 계산한다.
function shopMaxBuyable(u, isSoul){
  let n = 0, total = 0;
  const cap = 200; // 계산 폭주 방지 상한 (실제 maxLevel은 이보다 작음)
  if(isSoul){
    const startLvl = state.soulUpgrades[u.key] || 0;
    for(; n < cap; n++){
      const cost = bulkSoulCost(startLvl + n, 1);
      if(state.soul < total + cost) break;
      total += cost;
    }
  } else {
    const startLvl = state.goldUpgrades[u.key] || 0;
    const remain = u.maxLevel ? Math.max(0, u.maxLevel - startLvl) : cap;
    for(; n < Math.min(remain, cap); n++){
      const cost = bulkCost(u.baseCost, u.mult, startLvl + n, 1);
      if(state.gold < total + cost) break;
      total += cost;
    }
  }
  return {n, cost: total};
}
function buyShopMax(u, isSoul){
  const r = shopMaxBuyable(u, isSoul);
  if(r.n <= 0){ notifyGame('재화가 부족합니다.', 'warn'); return; }
  if(isSoul){
    state.soul -= r.cost;
    state.soulUpgrades[u.key] = (state.soulUpgrades[u.key] || 0) + r.n;
  } else {
    state.gold -= r.cost;
    state.goldUpgrades[u.key] = (state.goldUpgrades[u.key] || 0) + r.n;
    state.dailyUpgradesBought += r.n;
  }
  notifyGame(`⚡ ${u.name} +${r.n} 구매! (Lv.${isSoul ? state.soulUpgrades[u.key] : state.goldUpgrades[u.key]})`, 'good');
  renderAll();
  saveState(false);
}

// ---------- 3) 구역 소탕 ----------
// 이미 정복(반복 도전 가능) 상태이거나, 승률이 확실한 층을 전투 연출 없이 즉시 1회 클리어한다.
// 티켓 1장을 소모하고 현재 층의 클리어 보상을 그대로 지급한다.
const SWEEP_TARGETS = {
  gd: {ticket:'gdTicket', floor:'gdFloor', maxFloor:GOLD_DUNGEON_MAX_FLOOR, label:'물자 구역', emoji:'📦',
       reward:()=>gdGoldFor(state.gdFloor), apply:(r)=>{ state.gold += r; state.lifetimeGoldEarned += r; }},
  rd: {ticket:'rdTicket', floor:'rdFloor', maxFloor:RELIC_DUNGEON_MAX_FLOOR, label:'유산 구역', emoji:'◈',
       reward:()=>rdFragFor(state.rdFloor), apply:(r)=>{ state.fragments += r; state.totalFragmentsEarned += r; }},
  fd: {ticket:'fdTicket', floor:'fdFloor', maxFloor:FORGE_DUNGEON_MAX_FLOOR, label:'단조 구역', emoji:'🔩',
       reward:()=>fdStoneFor(state.fdFloor), apply:(r)=>{ state.enhanceStone += r; }},
  td: {ticket:'tdTicket', floor:'tdFloor', maxFloor:TRAINING_DUNGEON_MAX_FLOOR, label:'수련 구역', emoji:'EXP',
       reward:()=>tdExpFor(state.tdFloor), apply:(r)=>{ state.exp += r; tryLevelUp(); }}
};
function sweepDungeon(which){
  const cfg = SWEEP_TARGETS[which];
  if(!cfg) return;
  if(anySubActivityActive()){ notifyGame('다른 전투 콘텐츠가 진행 중에는 소탕할 수 없습니다.', 'warn'); return; }
  if((state[cfg.ticket] || 0) <= 0){ notifyGame('티켓이 부족합니다.', 'warn'); return; }
  const floor = Math.min(state[cfg.floor] || 1, cfg.maxFloor);
  const gain = cfg.reward();
  state[cfg.ticket]--;
  cfg.apply(gain);
  trackWeeklySweep();
  notifyGame(`🧹 [${cfg.label}] ${floor}층 소탕 완료! +${gain.toLocaleString()} ${cfg.emoji}`, 'good');
  renderAll();
  saveState(false);
}
function addSweepButtons(){
  [['gdEnterBtn','gd'],['rdEnterBtn','rd'],['fdEnterBtn','fd'],['tdEnterBtn','td']].forEach(([btnId, key])=>{
    const btn = document.getElementById(btnId);
    if(!btn || document.getElementById(btnId + 'Sweep')) return;
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.id = btnId + 'Sweep';
    sw.className = `pull-relic sweep-btn`;
    sw.textContent = '🧹 소탕';
    sw.style.marginTop = '6px';
    sw.addEventListener('click', ()=>sweepDungeon(key));
    btn.insertAdjacentElement('afterend', sw);
  });
}

// ---------- 4) 카드: 최적 장착 + 등급 필터 + 세트 효과 미리보기 ----------
let __cardRarityFilter = 'all';
// 카드 3장을 임시로 끼워 넣고 덱 보너스를 계산 (state.cardDeck은 원상복구)
function previewDeckBonus(keys){
  const backup = state.cardDeck.slice();
  state.cardDeck = [keys[0] || null, keys[1] || null, keys[2] || null];
  const bonus = cardDeckBonus();
  state.cardDeck = backup;
  return bonus;
}
function deckBonusSum(bonus){
  return Object.keys(bonus).reduce((sum, k)=>sum + bonus[k], 0);
}
// "그냥 센 카드"가 아니라 실제 덱 보너스 합이 최대가 되는 조합을 찾는다.
function bestDeckCombo(){
  if(!state.cards) state.cards = {};
  const owned = CARD_DEFS
    .filter(def => (state.cards[def.key] || 0) > 0)
    .sort((a, b)=>cardBonusValue(b, cardLevelFromCount(state.cards[b.key])) - cardBonusValue(a, cardLevelFromCount(state.cards[a.key])));
  if(owned.length === 0) return [null, null, null];
  // 후보를 8장으로 줄여 3장 조합을 전수 탐색 (8C3 = 56회, 즉시 계산됨)
  const pool = owned.slice(0, 8).map(def=>def.key);
  let best = [pool[0] || null, null, null], bestScore = deckBonusSum(previewDeckBonus(best));
  for(let i = 0; i < pool.length; i++){
    for(let j = i + 1; j < pool.length; j++){
      for(let k = j + 1; k < pool.length; k++){
        const combo = [pool[i], pool[j], pool[k]];
        const score = deckBonusSum(previewDeckBonus(combo));
        if(score > bestScore){ bestScore = score; best = combo; }
      }
    }
  }
  return best;
}
function autoEquipBestCards(){
  if((!state.cards || Object.keys(state.cards).length === 0)){ notifyGame('보유한 카드가 없습니다.', 'warn'); return; }
  const best = bestDeckCombo();
  if(!best[0]){ notifyGame('보유한 카드가 없습니다.', 'warn'); return; }
  state.cardDeck = best;
  notifyGame(`🃏 최적 조합(덱 보너스 합 최대)으로 3장을 장착했습니다!`, 'good');
  renderMonsterCards();
  renderAll();
  saveState(false);
}
function updateCardSetPreview(){
  const el = document.getElementById('cardSetPreview');
  if(!el) return;
  const cur = cardDeckBonus();
  const names = state.cardDeck.map(key=>key ? (cardDefByKey(key) || {}).name : null).filter(Boolean);
  const best = bestDeckCombo();
  const bestBonus = deckBonusSum(previewDeckBonus(best));
  const curSum = deckBonusSum(cur);
  const bestNames = best.filter(Boolean).map(key=>(cardDefByKey(key) || {}).name).filter(Boolean);
  const setFull = names.length === 3 && (()=>{
    const rar = names.map(n=>{ const d = CARD_DEFS.find(x=>x.name === n); return d ? d.rarity : null; });
    return rar[0] && rar[0] === rar[1] && rar[1] === rar[2];
  })();
  const lines = [`현재 덱: ${names.length ? safeText(names.join(' · ')) : '없음'}${setFull ? ' (세트 ×1.25 적용중!)' : ''}`];
  if(bestNames.length && bestBonus > curSum + 0.001){
    lines.push(`⚡ 권장 조합: ${safeText(bestNames.join(' · '))} → 효과 ${(bestBonus / Math.max(0.001, curSum) * 100 - 100).toFixed(1)}% 상승`);
  }
  el.innerHTML = lines.join('<br>');
}

// 카드 탭 툴바(최적 장착 + 등급 필터) 배선. index.html의 정적 마크업에 이벤트만 붙인다.
function addCardToolbar(){
  const autoBtn = document.getElementById('cardAutoBtn');
  if(autoBtn && !autoBtn.dataset.bound){
    autoBtn.dataset.bound = '1';
    autoBtn.addEventListener('click', autoEquipBestCards);
  }
  const group = document.getElementById('cardFilterGroup');
  if(group && !group.dataset.bound){
    group.dataset.bound = '1';
    group.querySelectorAll('[data-rarity]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        __cardRarityFilter = btn.dataset.rarity;
        group.querySelectorAll('[data-rarity]').forEach(b=>b.classList.toggle('active', b === btn));
        renderMonsterCards();
      });
    });
  }
  updateCardSetPreview();
}
// 카드 등급 필터는 기존 renderMonsterCards()를 감싸서 적용한다(카드 정의 순서 = 그리드 순서).
// 렌더 직후 바로 숨김 처리를 하므로 화면이 잠깐 전체 목록으로 보이는 일이 없다.
function hookCardRender(){
  if(typeof renderMonsterCards !== 'function' || renderMonsterCards.__filterHooked) return;
  const original = renderMonsterCards;
  const wrapped = function(){
    const r = original.apply(this, arguments);
    try{ applyCardRarityFilter(); }catch(e){}
    return r;
  };
  wrapped.__filterHooked = true;
  renderMonsterCards = wrapped;
}
function applyCardRarityFilter(){
  const grid = document.getElementById('cardsGrid');
  if(!grid) return;
  const cards = grid.querySelectorAll('.monster-card');
  if(__cardRarityFilter === 'all'){
    cards.forEach(cardEl=>{ cardEl.style.display = ''; });
    return;
  }
  cards.forEach((cardEl, idx)=>{
    const def = CARD_DEFS[idx];
    cardEl.style.display = (def && def.rarity !== 'all' && def.rarity !== __cardRarityFilter) ? 'none' : '';
  });
}

// ---------- 5) 오프라인 보상 확장 ----------
// 자리를 비운 동안 (a) 던전/레이드 티켓이 재충전되고 (b) 영지(territory)에 쌓인 수확물을 자동 수령한다.
// 골드/경험치는 기존 computeOfflineProgress()가 이미 계산하므로 여기서는 추가분만 처리한다.
function applyExtendedOffline(elapsedSec){
  const out = {tickets: 0, territory: []};
  // (a) 티켓: 각 던전의 refresh 함수는 "마지막 충전 시각"부터의 경과분을 계산해 지급하므로 그대로 호출만 하면 된다.
  const ticketKeys = ['gdTicket', 'rdTicket', 'fdTicket', 'tdTicket', 'raidTicket'];
  const refreshFns = ['refreshGoldDungeonTickets', 'refreshRelicDungeonTickets', 'refreshForgeDungeonTickets', 'refreshTrainingDungeonTickets', 'refreshRaidTickets'];
  ticketKeys.forEach((key, i)=>{
    const before = state[key] || 0;
    const fn = window[refreshFns[i]];
    if(typeof fn === 'function') fn();
    out.tickets += Math.max(0, (state[key] || 0) - before);
  });
  // (b) 영지: 저장 상한(가득 참)까지 쌓인 항목만 자동 수령한다(일반 플레이의 수확 몫을 뺏지 않기 위해).
  if(state.territory && typeof territoryPending === 'function' && typeof collectTerritory === 'function'){
    ['gold', 'fragment', 'soul'].forEach(type=>{
      const pending = Math.floor(territoryPending(type));
      const capAmount = typeof territoryCapAmount === 'function' ? territoryCapAmount(type) : 0;
      if(pending <= 0 || pending < capAmount) return;
      const field = TERRITORY_RESOURCE_FIELD[type];
      const before = state[field];
      collectTerritory(type);
      const gained = state[field] - before;
      if(gained > 0){
        const def = typeof territoryDef === 'function' ? territoryDef(type) : null;
        out.territory.push({label: (def ? def.icon + ' ' + def.resourceLabel : type), amount: gained});
      }
    });
  }
  return out;
}

// ---------- 6) 주간 미션 ----------
// ISO 주차(월요일 시작) 기준으로 매주 초기화되는 목표 4종.
// 처치 수는 state.totalKills(누적)의 "주 시작 시점 스냅샷"과의 차이로 계산해 별도 카운터 없이도 정확하다.
const WEEKLY_MISSIONS = [
  {key:'wKill300', name:'주간 사냥꾼', desc:'변이체 300마리 처치', target:300, reward:{gold:20000}},
  {key:'wDungeon5', name:'구역 정찰', desc:'구역/레이드/월드보스 입장 5회', target:5, reward:{gold:12000, soul:1}},
  {key:'wLevel3', name:'성장의 발판', desc:'레벨 3 달성(주 시작 대비)', target:3, reward:{gold:8000}},
  {key:'wSweep10', name:'효율적인 청소', desc:'소탕 10회 실행', target:10, reward:{fragments:40}}
];
function weeklyId(date){
  const d = date ? new Date(date) : new Date();
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ensureWeekly(){
  const id = weeklyId();
  if(!state.weekly || state.weekly.id !== id){
    state.weekly = {id, killBase: state.totalKills || 0, levelBase: state.level || 1, dungeons: 0, sweeps: 0, claimed: {}};
    log('📅 새로운 주간 미션이 시작되었습니다. 이벤트 탭에서 확인하세요!', 'new');
  }
  return state.weekly;
}
function weeklyProgress(key){
  const w = ensureWeekly();
  if(key === 'wKill300') return Math.max(0, (state.totalKills || 0) - w.killBase);
  if(key === 'wDungeon5') return w.dungeons;
  if(key === 'wLevel3') return Math.max(0, (state.level || 1) - w.levelBase);
  if(key === 'wSweep10') return w.sweeps;
  return 0;
}
function trackWeeklyDungeon(n){
  const w = ensureWeekly();
  w.dungeons += (n == null ? 1 : n);
}
function trackWeeklySweep(){
  const w = ensureWeekly();
  w.sweeps += 1;
}
function claimWeeklyMission(key){
  const m = WEEKLY_MISSIONS.find(x=>x.key === key);
  const w = ensureWeekly();
  if(!m || (w.claimed && w.claimed[key])) return;
  if(weeklyProgress(key) < m.target){ notifyGame('아직 목표를 달성하지 못했습니다.', 'warn'); return; }
  w.claimed[key] = true;
  const r = m.reward || {};
  if(r.gold){ state.gold += r.gold; state.lifetimeGoldEarned += r.gold; }
  if(r.soul){ state.soul += r.soul; }
  if(r.fragments){ state.fragments += r.fragments; state.totalFragmentsEarned += r.fragments; }
  notifyGame(`📅 주간 미션 완료: ${m.name}`, 'good');
  renderWeeklyMissions();
  renderAll();
  saveState(false);
}
function renderWeeklyMissions(){
  const el = document.getElementById('weeklyMissionList');
  if(!el) return;
  const w = ensureWeekly();
  const resetEl = document.getElementById('weeklyResetText');
  if(resetEl){
    const d = new Date(w.id + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    resetEl.textContent = `(~${d.getMonth() + 1}/${d.getDate()} 까지)`;
  }
  el.innerHTML = WEEKLY_MISSIONS.map(m=>{
    const prog = weeklyProgress(m.key);
    const done = prog >= m.target;
    const claimed = !!(w.claimed && w.claimed[m.key]);
    const rewardText = Object.entries(m.reward || {}).map(([k, v])=>(
      (k === 'gold' ? `+${v.toLocaleString()}📦` : k === 'soul' ? `+${v}🧪` : `+${v}◈`)
    )).join(' ');
    return `<div class="quest-item"><div class="qhead"><div><div class="qname">${safeText(m.name)}</div>
      <div class="qdesc">${safeText(m.desc)} · ${Math.min(prog, m.target).toLocaleString()} / ${m.target.toLocaleString()} · ${rewardText}</div></div>
      <button class="claim ${claimed ? 'done' : (done ? 'ready' : '')}" data-wk="${safeText(m.key)}" ${(claimed || !done) ? 'disabled' : ''}>${claimed ? '완료' : '받기'}</button></div></div>`;
  }).join('');
  el.querySelectorAll('[data-wk]').forEach(btn=>{
    btn.addEventListener('click', ()=>claimWeeklyMission(btn.dataset.wk));
  });
}

// ---------- 7) DPS 미터 ----------
// floatText()에 찍히는 "몬스터에게 준 피해"만 골라 10초 슬라이딩 윈도우로 DPS를 계산한다.
// (플레이어가 받은 피해는 class 'dmgToPlayer', 회복/빗나감/보너스 골드는 부호가 달라 자연히 제외된다)
const DPS_WINDOW_MS = 10000;
const DPS_SAMPLES = [];
function hookDpsMeter(){
  if(typeof floatText !== 'function' || floatText.__dpsHooked) return;
  const original = floatText;
  const wrapped = function(text, cls){
    try{
      if(cls !== 'dmgToPlayer' && cls !== 'heal' && cls !== 'miss' && cls !== 'good'){
        const m = String(text).match(/(\d[\d,]*)/);
        if(m){
          const amount = parseInt(m[1].replace(/,/g, ''), 10);
          if(amount > 0) DPS_SAMPLES.push({at: Date.now(), amount});
        }
      }
    }catch(e){}
    return original.apply(this, arguments);
  };
  wrapped.__dpsHooked = true;
  floatText = wrapped;
}
function currentDps(){
  const cut = Date.now() - DPS_WINDOW_MS;
  while(DPS_SAMPLES.length && DPS_SAMPLES[0].at < cut) DPS_SAMPLES.shift();
  const total = DPS_SAMPLES.reduce((sum, s)=>sum + s.amount, 0);
  return total / (DPS_WINDOW_MS / 1000);
}
function updateDpsPanel(){
  const el = document.getElementById('dpsLine');
  if(!el) return;
  const dps = Math.round(currentDps());
  el.textContent = `⚔️ DPS(10초): ${dps.toLocaleString()}`;
}

// ---------- 8) 미니게임 점수 연동 ----------
// minigame.html(iframe)이 "도달 스테이지"를 postMessage로 알려준다.
// 보상은 자식이 주장하는 값이 아니라 부모가 기록 갱신분으로 직접 계산해 지급한다(파밍/조작 방지).
const MINIGAME_REWARD_PER_STAGE = 1000;
const MINIGAME_REWARD_GOLD_CAP = 300000;
function minigameBestText(){
  const el = document.getElementById('minigameBestText');
  if(!el) return;
  const best = (state.minigameBest && state.minigameBest.tavern) || 0;
  el.textContent = best > 0 ? `최고 도달 스테이지: ${best.toLocaleString()}` : '아직 기록이 없습니다.';
}
function handleMinigameScore(game, score){
  if(!state.minigameBest) state.minigameBest = {};
  const key = String(game || 'tavern').slice(0, 40);
  const prev = state.minigameBest[key] || 0;
  if(score <= prev){ minigameBestText(); return; }
  state.minigameBest[key] = score;
  const gold = Math.min(MINIGAME_REWARD_GOLD_CAP, Math.round(score * MINIGAME_REWARD_PER_STAGE));
  const soul = Math.floor(score / 25);
  if(gold > 0){ state.gold += gold; state.lifetimeGoldEarned += gold; }
  if(soul > 0) state.soul += soul;
  notifyGame(`🎮 미니게임 신기록! 스테이지 ${score.toLocaleString()} → +${gold.toLocaleString()}📦${soul > 0 ? ` +${soul}🧪` : ''}`, 'good');
  minigameBestText();
  renderAll();
  saveState(false);
}
function initMinigameBridge(){
  window.addEventListener('message', (event)=>{
    const data = event.data;
    if(!data || data.source !== 'lastzone-minigame') return;
    const score = Math.max(0, Math.floor(Number(data.score) || 0));
    handleMinigameScore(data.game || 'tavern', score);
  });
}

// ---------- 9) 초기화 ----------
// 구역/레이드/월드보스 입장을 감시해 주간 미션 진행도를 올린다(입장 플래그가 꺼짐→켜짐으로 바뀌는 순간만 카운트).
const SUB_ACTIVITY_KEYS = ['raidActive', 'gdActive', 'rdActive', 'wbActive', 'fdActive', 'tdActive'];
const __prevSubFlags = {};
function watchWeeklyDungeonEntries(){
  SUB_ACTIVITY_KEYS.forEach(k=>{
    const now = !!state[k];
    if(now && !__prevSubFlags[k]) trackWeeklyDungeon(1);
    __prevSubFlags[k] = now;
  });
}
function initUpgradesV23(){
  // 각 단계를 따로 감싼다 — 한 단계가 실패해도 나머지(특히 티커 시작)는 계속 진행되게.
  const step = (label, fn) => {
    try{ fn(); }catch(e){ console.warn(`[v23] ${label} 실패`, e); }
  };
  step('토스트/alert', installToastAlertOverride);
  step('소탕 버튼', addSweepButtons);
  step('카드 툴바', addCardToolbar);
  step('DPS 후킹', hookDpsMeter);
  step('카드 렌더 후킹', hookCardRender);
  step('DPS 표시', updateDpsPanel);
  step('주간 미션', ()=>{ ensureWeekly(); renderWeeklyMissions(); });
  step('미니게임 연동', ()=>{ initMinigameBridge(); minigameBestText(); });
  step('통합 티커 시작', ()=>{
    if(typeof startGameTicker === 'function') startGameTicker();
    // 유지보수 작업 등록 (탭이 백그라운드면 자동으로 건너뜀)
    if(typeof registerGameTickTask === 'function'){
      registerGameTickTask(()=>{
        addSweepButtons();
        updateDpsPanel();
        if(document.getElementById('weeklyMissionList')) renderWeeklyMissions();
      }, 5000, 'v23-upkeep');
      registerGameTickTask(()=>{
        applyCardRarityFilter();
        updateCardSetPreview();
      }, 3000, 'v23-cards');
      registerGameTickTask(watchWeeklyDungeonEntries, 1500, 'v23-weekly-dungeon');
    }
  });
}

// 로그인 이후 패널이 늦게 만들어지는 경우까지 챙기기 위해 여러 시점에서 한 번 더 시도한다.
// (initUpgradesV23 본체는 티커 등록을 하므로 1회만 실행하고, 재시도는 멱등한 UI 함수만 호출)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>initUpgradesV23());
} else {
  initUpgradesV23();
}
[500, 2500].forEach(ms=>setTimeout(()=>{
  installToastAlertOverride();
  addSweepButtons();
  addCardToolbar();
  hookDpsMeter();
  hookCardRender();
  minigameBestText();
}, ms));
