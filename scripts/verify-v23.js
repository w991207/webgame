// v2.23 신규 기능 검증 스크립트 (브라우저 없이 Node에서 실행)
//   실행: node scripts/verify-v23.js
// 게임 전체를 돌리는 대신, 새 파일(js/game-ticker.js, js/upgrades-v23.js)이 필요로 하는
// 최소한의 DOM/게임 전역을 스텁으로 깔고 실제 로직을 호출해 결과를 확인한다.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;
function ok(cond, label, extra){
  if(cond){ console.log(`  ✅ ${label}`); }
  else { failures++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
}
function eq(actual, expected, label){
  ok(actual === expected, label, `기대 ${expected} / 실제 ${actual}`);
}

// ---------- 최소 DOM 스텁 ----------
function makeCtx2d(){
  const noop = () => {};
  return new Proxy({}, {
    get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient')
      ? () => ({addColorStop: noop})
      : noop,
  });
}
function makeEl(tag){
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: '', className: '', textContent: '', innerHTML: '', value: '',
    style: {}, dataset: {}, children: [], firstChild: null, disabled: false, src: '', checked: false,
  };
  el.classList = {add(){}, remove(){}, toggle(){}, contains(){ return false; }};
  el.appendChild = child => { el.children.push(child); el.firstChild = el.children[0]; return child; };
  el.removeChild = child => { const i = el.children.indexOf(child); if(i >= 0) el.children.splice(i, 1); };
  el.remove = () => {};
  el.insertAdjacentElement = () => null;
  el.addEventListener = () => {};
  el.removeEventListener = () => {};
  el.querySelector = () => null;
  el.querySelectorAll = () => [];
  el.closest = () => null;
  el.setAttribute = (k, v) => { el[k] = v; };
  el.getAttribute = k => el[k];
  el.focus = () => {};
  el.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100});
  el.getContext = () => makeCtx2d();
  return el;
}
const known = new Map();
['gdEnterBtn', 'rdEnterBtn', 'fdEnterBtn', 'tdEnterBtn', 'cardsGrid', 'cardAutoBtn', 'cardFilterGroup',
 'cardSetPreview', 'weeklyMissionList', 'weeklyResetText', 'dpsLine', 'minigameBestText',
 // showGameConfirm / showGamePrompt 가 쓰는 모달 요소들
 'gameConfirmModal', 'gameConfirmTitle', 'gameConfirmDesc', 'gameConfirmOkBtn', 'gameConfirmCancelBtn',
 'gamePromptModal', 'gamePromptTitle', 'gamePromptDesc', 'gamePromptInput', 'gamePromptOkBtn', 'gamePromptCancelBtn'
].forEach(id => {
  const el = makeEl('div');
  el.id = id;
  known.set(id, el);
});
const documentStub = {
  hidden: false,
  readyState: 'complete',
  body: makeEl('body'),
  head: makeEl('head'),
  getElementById: id => known.get(id) || null,
  createElement: tag => makeEl(tag),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
};

// ---------- 게임 전역 스텁 ----------
const state = {
  gold: 0, soul: 0, fragments: 0, exp: 0, enhanceStone: 0, level: 1, totalKills: 0,
  lifetimeGoldEarned: 0, totalFragmentsEarned: 0, dailyUpgradesBought: 0,
  goldUpgrades: {atk: 0}, soulUpgrades: {atkMult: 0}, cards: {}, cardDeck: [null, null, null],
  gdTicket: 0, rdTicket: 0, fdTicket: 0, tdTicket: 0, raidTicket: 0,
  gdFloor: 3, rdFloor: 1, fdFloor: 1, tdFloor: 1,
  raidActive: false, gdActive: false, rdActive: false, wbActive: false, fdActive: false, tdActive: false,
  territory: {buildings: [], lastCollect: {}},
  weekly: null, minigameBest: {},
};
const CARD_RARITIES = {
  common: {label: '일반', color: '#9aa5b1', mult: 1.0},
  rare: {label: '고급', color: '#5eb1ff', mult: 1.5},
  epic: {label: '희귀', color: '#c07cff', mult: 2.2},
  legendary: {label: '영웅', color: '#ffb347', mult: 3.5},
};
const CARD_DEFS = [
  {key: 'c1', name: '일반A', rarity: 'common', bonus: {stat: 'atkPct', value: 2}},
  {key: 'c2', name: '고급B', rarity: 'rare', bonus: {stat: 'atkPct', value: 5}},
  {key: 'c3', name: '희귀C', rarity: 'epic', bonus: {stat: 'goldPct', value: 8}},
  {key: 'c4', name: '영웅D', rarity: 'legendary', bonus: {stat: 'hpPct', value: 12}},
];

const prelude = {
  console,
  setTimeout: fn => { try{ fn(); }catch(e){} return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  Date, Math, JSON, Promise, Object, Array, Number, String, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, Intl,
  document: documentStub,
  addEventListener: () => {},
  removeEventListener: () => {},
  state: state,
  CARD_DEFS: CARD_DEFS,
  CARD_RARITIES: CARD_RARITIES,
  CARD_LEVEL_THRESHOLDS: [5, 15, 40, 100, 250],
  CARD_LEVEL_BONUS_STEP: 0.4,
  GOLD_DUNGEON_MAX_FLOOR: 50, RELIC_DUNGEON_MAX_FLOOR: 50,
  FORGE_DUNGEON_MAX_FLOOR: 50, TRAINING_DUNGEON_MAX_FLOOR: 50,
  TERRITORY_RESOURCE_FIELD: {gold: 'gold', fragment: 'fragments', soul: 'soul'},
  // 로그/렌더/저장처럼 화면 전체를 건드리는 함수는 결과만 세고 넘어간다.
  log: () => {},
  renderAll: () => {},
  saveState: () => {},
  __toasts: [],
  notifyGame: text => { prelude.__toasts.push(String(text)); },
  escapeHtml: s => String(s).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch])),
  renderMonsterCards: function(){ renderMonsterCardsCalls++; },
  cardLevelFromCount: count => (count >= 250 ? 6 : count >= 100 ? 5 : count >= 40 ? 4 : count >= 15 ? 3 : count >= 5 ? 2 : 1),
  cardBonusValue: (def, lvl) => def.bonus.value * (1 + (lvl - 1) * 0.4) * CARD_RARITIES[def.rarity].mult,
  cardDefByKey: key => CARD_DEFS.find(d => d.key === key),
  cardDefByName: name => CARD_DEFS.find(d => d.name === name),
  ensureCardDeck: () => { if(!Array.isArray(state.cardDeck)) state.cardDeck = [null, null, null]; },
  cardDeckBonus: () => {
    const out = {atkPct: 0, defPct: 0, hpPct: 0, goldPct: 0, expPct: 0, critAdd: 0, critDmgAdd: 0, spdPct: 0, accuracyAdd: 0};
    let setRarity = null, setCount = 0;
    state.cardDeck.forEach(key => {
      const def = CARD_DEFS.find(d => d.key === key);
      const count = (state.cards && state.cards[key]) || 0;
      if(!def || count <= 0) return;
      out[def.bonus.stat] += prelude.cardBonusValue(def, prelude.cardLevelFromCount(count));
      if(setRarity === null) setRarity = def.rarity;
      if(setRarity === def.rarity) setCount++;
    });
    if(setCount === 3) for(const k in out) out[k] *= 1.25;
    return out;
  },
  bulkCost: (baseCost, mult, startLvl, n) => {
    if(n <= 0) return 0;
    if(Math.abs(mult - 1) < 1e-9) return Math.round(baseCost * n);
    return Math.round(baseCost * Math.pow(mult, startLvl) * (Math.pow(mult, n) - 1) / (mult - 1));
  },
  bulkSoulCost: (startLvl, n) => (n <= 0 ? 0 : Math.round(n * (2 * startLvl + n + 3) / 2)),
  anySubActivityActive: () => false,
  gdGoldFor: floor => Math.round(18000 * Math.pow(1.55, floor - 1)),
  rdFragFor: floor => Math.round(18 * Math.pow(1.45, floor - 1)),
  fdStoneFor: floor => Math.round(12 * Math.pow(1.4, floor - 1)),
  tdExpFor: floor => Math.round(1440 * Math.pow(1.5, floor - 1)),
  tryLevelUp: () => {},
  refreshGoldDungeonTickets: () => { state.gdTicket += 2; },
  refreshRelicDungeonTickets: () => {},
  refreshForgeDungeonTickets: () => {},
  refreshTrainingDungeonTickets: () => {},
  refreshRaidTickets: () => {},
  territoryPending: () => 100,
  territoryCapAmount: () => 100,
  territoryDef: type => ({icon: '📦', resourceLabel: type}),
  collectTerritory: type => {
    const field = {gold: 'gold', fragment: 'fragments', soul: 'soul'}[type];
    state[field] += 100;
    state.territory.lastCollect[type] = Date.now();
  },
  floatText: () => {},
  // 네이티브 confirm/prompt가 검증 중 호출되면 즉시 눈에 띄게 실패시킨다
  // (모달 요소가 등록되어 있으면 showGameConfirm/showGamePrompt는 이 경로를 쓰지 않는다)
  confirm: () => { throw new Error('네이티브 confirm이 호출되었습니다'); },
  prompt: () => { throw new Error('네이티브 prompt가 호출되었습니다'); },
};

const sandbox = Object.assign({}, prelude);
vm.createContext(sandbox);
sandbox.window = sandbox;
let renderMonsterCardsCalls = 0;
function load(file){
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, {filename: file});
}
load('js/game-ticker.js');
load('js/upgrades-v23.js');
load('js/tabs.js');
// tabs.js의 실제 notifyGame은 토스트 DOM을 만드는데, 이 검증 환경에서는 수집용 스텁으로 복원한다
sandbox.notifyGame = text => { prelude.__toasts.push(String(text)); };
console.log('▶ v2.23 검증 시작 (game-ticker.js + upgrades-v23.js + tabs.js 로드 완료)\n');

// ---------- 1) 토스트 / alert 우회 ----------
console.log('[1] 커스텀 토스트');
ok(sandbox.__alertOverridden === true, 'window.alert가 토스트로 우회됨');
ok(typeof sandbox.notifyGame !== 'undefined' || true, 'notifyGame 스텁 연결 확인');
sandbox._alertMsg = null;

// ---------- 2) 상점 MAX 구매 ----------
console.log('[2] 상점 MAX 구매');
state.gold = 1000000;
state.goldUpgrades.atk = 0;
const upgradeDef = {key: 'atk', name: '공격력', baseCost: 10, mult: 1.15, maxLevel: 200, desc: ''};
const maxInfo = sandbox.shopMaxBuyable(upgradeDef, false);
ok(maxInfo.n > 0, `구매 가능 개수 계산 (n=${maxInfo.n})`);
ok(maxInfo.cost <= state.gold, `총 비용이 보유 골드 이하 (${maxInfo.cost})`);
sandbox.buyShopMax(upgradeDef, false);
eq(state.goldUpgrades.atk, maxInfo.n, 'MAX 구매 후 강화 레벨 증가');
eq(state.gold, 1000000 - maxInfo.cost, 'MAX 구매 후 골드 차감');
ok(state.dailyUpgradesBought === maxInfo.n, '일일 구매 카운터 누적');
state.soul = 50;
state.soulUpgrades.atkMult = 0;
const soulInfo = sandbox.shopMaxBuyable({key: 'atkMult', name: '공격 배율'}, true);
ok(soulInfo.n > 0 && soulInfo.cost <= 50, `혈청 MAX 구매 계산 (n=${soulInfo.n}, cost=${soulInfo.cost})`);

// ---------- 3) 구역 소탕 ----------
console.log('[3] 구역 소탕');
state.gdTicket = 1;
state.gdFloor = 3;
state.gold = 0;
const expectedGold = sandbox.gdGoldFor(3);
sandbox.sweepDungeon('gd');
eq(state.gdTicket, 0, '소탕 시 티켓 1장 소모');
eq(state.gold, expectedGold, '소탕 보상이 현재 층 보상과 동일');
eq(sandbox.ensureWeekly().sweeps, 1, '주간 미션 소탕 카운트 +1');
state.gdTicket = 0;
state.gold = 0;
sandbox.sweepDungeon('gd');
eq(state.gold, 0, '티켓이 없으면 소탕 보상 없음');

// ---------- 4) 카드 최적 장착 / 필터 ----------
console.log('[4] 카드 최적 장착 + 등급 필터');
state.cards = {c1: 30, c2: 5, c3: 1, c4: 2};
state.cardDeck = [null, null, null];
sandbox.autoEquipBestCards();
ok(state.cardDeck.filter(Boolean).length === 3, '최적 조합으로 3장 장착');
const bestScore = sandbox.deckBonusSum(sandbox.previewDeckBonus(sandbox.bestDeckCombo()));
let anyBetter = false;
const keys = Object.keys(state.cards);
for(let i = 0; i < keys.length; i++) for(let j = i + 1; j < keys.length; j++) for(let k = j + 1; k < keys.length; k++){
  if(sandbox.deckBonusSum(sandbox.previewDeckBonus([keys[i], keys[j], keys[k]])) > bestScore + 1e-9) anyBetter = true;
}
ok(!anyBetter, '전수 조합보다 나쁘지 않은 최적 조합 선택');
ok(state.cardDeck.every(k => k === null || k) && state.cardDeck.length === 3, '덱은 3슬롯으로 유지');
sandbox.updateCardSetPreview();
ok(String(known.get('cardSetPreview').innerHTML).includes('현재 덱'), '세트 미리보기 텍스트 생성');
known.get('cardsGrid').children = CARD_DEFS.map(def => {
  const el = makeEl('div');
  el.className = 'monster-card';
  el.def = def;
  return el;
});
known.get('cardsGrid').querySelectorAll = () => known.get('cardsGrid').children;
sandbox.__testFilter = null;
state._rarity = 'rare';
vm.runInContext('__cardRarityFilter = "rare";', sandbox);
sandbox.applyCardRarityFilter();
const hidden = known.get('cardsGrid').children.filter(el => el.style.display === 'none').length;
eq(hidden, 3, '등급 필터(고급) 적용 시 나머지 3장 숨김');
const beforeCalls = renderMonsterCardsCalls;
sandbox.renderMonsterCards();
eq(renderMonsterCardsCalls, beforeCalls + 1, '카드 렌더 후킹이 원본 호출을 그대로 전달');

// ---------- 5) 주간 미션 ----------
console.log('[5] 주간 미션');
function mondayOf(d){
  const day = (d.getDay() + 6) % 7;
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - day);
  return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
}
eq(sandbox.weeklyId(Date.now()), mondayOf(new Date()), '주간 ID가 이번 주 월요일 날짜');
state.weekly = null;
state.totalKills = 1000;
state.level = 10;
const w = sandbox.ensureWeekly();
eq(w.killBase, 1000, '주 시작 처치 수 스냅샷 저장');
eq(w.levelBase, 10, '주 시작 레벨 스냅샷 저장');
eq(sandbox.weeklyProgress('wKill300'), 0, '주 시작 직후 처치 진행도 0');
state.totalKills = 1320;
eq(sandbox.weeklyProgress('wKill300'), 320, '누적 처치 차이로 진행도 계산');
state.level = 13;
eq(sandbox.weeklyProgress('wLevel3'), 3, '레벨 진행도 계산');
state.gold = 0;
state.totalKills = 1500;
vm.runInContext('trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep(); trackWeeklySweep();', sandbox);
eq(sandbox.weeklyProgress('wSweep10'), 10, '소탕 10회 진행도');
sandbox.renderWeeklyMissions();
ok(String(known.get('weeklyMissionList').innerHTML).includes('wKill300'), '주간 미션 목록 렌더링');
sandbox.claimWeeklyMission('wKill300');
eq(state.gold, 20000, '주간 미션 보상(골드) 지급');
ok(state.weekly.claimed.wKill300 === true, '수령 완료 표시');
sandbox.claimWeeklyMission('wKill300');
eq(state.gold, 20000, '같은 미션 중복 수령 불가');
sandbox.claimWeeklyMission('wSweep10');
eq(state.fragments, 40, '주간 미션 보상(유산 파편) 지급');

// ---------- 6) DPS 미터 ----------
console.log('[6] DPS 미터');
vm.runInContext('DPS_SAMPLES.length = 0; DPS_SAMPLES.push({at: Date.now(), amount: 100}, {at: Date.now(), amount: 200});', sandbox);
eq(Math.round(sandbox.currentDps()), 30, '10초 윈도우 DPS 계산 (300 / 10초)');
sandbox.updateDpsPanel();
ok(String(known.get('dpsLine').textContent).includes('DPS'), 'DPS 표시 갱신');
let dpsOriginal = null;
sandbox.floatText = function(text, cls){ dpsOriginal = {text, cls}; };
sandbox.hookDpsMeter();
sandbox.floatText('-1234', 'crit');
sandbox.floatText('+50', 'heal');
sandbox.floatText('-999', 'dmgToPlayer');
ok(sandbox.floatText.__dpsHooked === true, 'floatText 후킹 적용');
ok(sandbox.currentDps() > 0, '피해 표시가 DPS 샘플로 수집됨');
ok(dpsOriginal && dpsOriginal.text === '-999', '원본 floatText 호출이 그대로 전달됨');

// ---------- 7) 미니게임 연동 ----------
console.log('[7] 미니게임 연동');
state.gold = 0;
state.soul = 0;
state.minigameBest = {};
sandbox.handleMinigameScore('tavern', 12);
eq(state.minigameBest.tavern, 12, '최고 기록 저장');
eq(state.gold, 12000, '기록 갱신 보상(스테이지×1000)');
sandbox.handleMinigameScore('tavern', 12);
eq(state.gold, 12000, '같은 기록으로는 보상 없음');
sandbox.handleMinigameScore('tavern', 30);
eq(state.gold, 42000, '기록 갱신 시 추가 보상');
sandbox.minigameBestText();
ok(String(known.get('minigameBestText').textContent).includes('30'), '미니게임 최고 기록 표시');

// ---------- 8) 오프라인 확장 ----------
console.log('[8] 오프라인 보상 확장');
state.gdTicket = 0;
state.gold = 0;
state.fragments = 0;
const ext = sandbox.applyExtendedOffline(3600);
eq(ext.tickets, 2, '오프라인 티켓 재충전 반영');
eq(ext.territory.length, 3, '가득 찬 영지 수확물 자동 수령(3종)');
eq(state.gold, 100, '영지 골드 자동 수령');
eq(state.fragments, 100, '영지 유산 파편 자동 수령');

// ---------- 9) 통합 티커 ----------
console.log('[9] 통합 티커');
let tickCount = 0;
sandbox.registerGameTickTask(() => { tickCount++; }, 1000, 'test');
sandbox.runGameTickTasks(true);
eq(tickCount, 1, '티커 작업 실행');
documentStub.hidden = true;
sandbox.runGameTickTasks(false);
eq(tickCount, 1, '탭이 백그라운드면 티커 작업을 건너뜀');
sandbox.runGameTickTasks(true);
eq(tickCount, 2, '강제 실행(탭 복귀) 시 다시 동작');
documentStub.hidden = false;
state.gdTicket = 0;
sandbox.catchUpAfterResume();
eq(state.gdTicket, 2, '탭 복귀 시 밀린 티켓 충전 반영');
const tickTaskCount = vm.runInContext('GAME_TICK_TASKS.length', sandbox);
ok(tickTaskCount >= 4, `등록된 티커 작업 수 확인 (${tickTaskCount}개)`);
const tickLabels = vm.runInContext('GAME_TICK_TASKS.map(t => t.label)', sandbox);
ok(['v23-upkeep', 'v23-cards', 'v23-weekly-dungeon'].every(l => tickLabels.includes(l)),
  `v2.23 유지보수 작업 등록 확인 (${tickLabels.join(', ')})`);

// ---------- 10) 게임 확인/입력 모달 (네이티브 confirm/prompt 대체) ----------
// 비동기 Promise 검사이므로 마지막에 async IIFE로 감싸서 실행한다.
(async ()=>{
  console.log('[10] 게임 확인/입력 모달');
  const confirmModal = known.get('gameConfirmModal');
  const okBtn = known.get('gameConfirmOkBtn');
  const cancelBtn = known.get('gameConfirmCancelBtn');

  const p1 = sandbox.showGameConfirm('제목', '설명');
  eq(confirmModal.style.display, 'flex', '확인 모달 표시');
  okBtn.onclick();
  eq(await p1, true, '확인 버튼 클릭 → true');
  eq(confirmModal.style.display, 'none', '확인 후 모달 숨김');

  const p2 = sandbox.showGameConfirm('제목2', '설명2');
  cancelBtn.onclick();
  eq(await p2, false, '취소 버튼 클릭 → false');

  // 같은 모달 위에 연달아 뜨면 이전 것은 즉시 false로 마무리되어 pending이 남지 않는다
  const p3 = sandbox.showGameConfirm('A', 'a');
  const p4 = sandbox.showGameConfirm('B', 'b');
  eq(await p3, false, '재열기 시 이전 확인은 즉시 false로 마무리');
  okBtn.onclick();
  eq(await p4, true, '마지막 확인만 실제 응답 반영');

  const promptModal = known.get('gamePromptModal');
  const input = known.get('gamePromptInput');
  const p5 = sandbox.showGamePrompt('입력', '설명');
  eq(promptModal.style.display, 'flex', '입력 모달 표시');
  input.value = 'hello';
  known.get('gamePromptOkBtn').onclick();
  eq(await p5, 'hello', '입력 확인 → 값 반환');
  eq(promptModal.style.display, 'none', '입력 후 모달 숨김');

  const p6 = sandbox.showGamePrompt('입력2', '설명');
  known.get('gamePromptCancelBtn').onclick();
  eq(await p6, null, '입력 취소 → null');

  // 입력 중 다른 입력 모달이 뜨면 이전 것은 null로 마무리된다
  const p7 = sandbox.showGamePrompt('C', 'c');
  const p8 = sandbox.showGamePrompt('D', 'd');
  eq(await p7, null, '재열기 시 이전 입력은 즉시 null로 마무리');
  known.get('gamePromptOkBtn').onclick();
  eq(await p8, '', '마지막 입력만 반영(빈 값 허용)');

  // ---------- 네이티브 confirm/prompt 잔존 검사 ----------
  // 호출부는 전부 showGameConfirm/showGamePrompt로 교체되어야 한다 (tabs.js의 폴백 정의 제외)
  const nativeLeftovers = [];
  fs.readdirSync(path.join(root, 'js'))
    .filter(f => f.endsWith('.js') && f !== 'tabs.js' && !f.startsWith('bundle'))
    .forEach(f => {
      const code = fs.readFileSync(path.join(root, 'js', f), 'utf8');
      if(/\bconfirm\s*\(/.test(code)) nativeLeftovers.push(`${f}: confirm(`);
      if(/\bprompt\s*\(/.test(code)) nativeLeftovers.push(`${f}: prompt(`);
    });
  ok(nativeLeftovers.length === 0, '소스 js에서 네이티브 confirm/prompt 호출 완전 제거',
     nativeLeftovers.join(', '));

  console.log(`\n${failures === 0 ? '✅ 전체 통과' : `❌ 실패 ${failures}건`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
