// ---------- 영지 (Territory) ----------
// 건물을 지어 시간당 골드/유산 파편/혈청을 자동 생산하는 방치형 컨텐츠.
// 해금 조건 없음 — 새 게임 시작부터 기본 3종 건물(물자 창고/유산 채굴장/혈청 배양소)이 1칸씩 지어져 있다.
//
// 생산량은 실시간으로 계산하지 않고 "저장 상한(TERRITORY_CAP_HOURS)까지 쌓인 뒤 수확 버튼으로 직접 수령"
// 하는 방식 — 골드 던전/레이드 등 기존 티켓 시스템처럼 lastCollect 타임스탬프 기반으로 계산한다.
//
// 확장은 두 축으로 나뉜다:
//  ① 부지 슬롯 확장: 골드+파편+혈청을 섞어 지불하고 슬롯을 늘려 건물을 추가로 짓는다(같은 종류 중복 가능).
//  ② 건물 증축: 건물 레벨이 상한(TERRITORY_MAX_LEVEL_PER_TIER)에 도달하면, 자기 자원으로 값을 지불하고
//     티어를 올려 이름이 바뀌고 생산량이 크게 뛴다(사실상 무한 확장 — 돌연변이 각성 트리와 같은 결).

const TERRITORY_RESOURCE_FIELD = {gold:'gold', fragment:'fragments', soul:'soul'};

const TERRITORY_BUILDING_TYPES = [
  {
    type:'gold', icon:'📦', resourceLabel:'물자',
    baseRatePerHour: 400, upgradeBaseCost: 200,
    tierNames: ['물자 창고', '물자 저장고', '물자 요새', '물자 성채', '물자 왕국'],
  },
  {
    type:'fragment', icon:'🗿', resourceLabel:'유산 파편',
    baseRatePerHour: 1.4, upgradeBaseCost: 2,
    tierNames: ['유산 채굴장', '유산 갱도', '유산 광산', '대유산 광맥', '태고의 유산층'],
  },
  {
    type:'soul', icon:'🧪', resourceLabel:'혈청',
    baseRatePerHour: 0.5, upgradeBaseCost: 1,
    tierNames: ['혈청 배양소', '혈청 정제소', '혈청 연구소', '혈청 생성로', '혈청 특이점'],
  },
];

const TERRITORY_TIER_MULT = 2.6;       // 티어당 생산량 배율
const TERRITORY_LEVEL_GROWTH = 0.12;   // 레벨당 생산량 증가폭(+12%)
const TERRITORY_MAX_LEVEL_PER_TIER = 20; // 이 레벨에 도달하면 "증축"으로만 더 성장 가능
const TERRITORY_UPGRADE_COST_MULT = 1.16; // 강화 1회당 비용 배율
const TERRITORY_TIER_COST_MULT = 3.4;     // 티어가 오를수록 강화/증축 비용도 함께 뛰는 배율
const TERRITORY_TIERUP_COST_FACTOR = 6;   // 증축 비용 = 그 티어 최대레벨 강화비용 * 이 배율
const TERRITORY_CAP_HOURS = 10;           // 저장 상한: 최대 10시간치까지만 쌓임

const TERRITORY_SLOT_BASE_COST = {gold: 2000, fragment: 15, soul: 6};
const TERRITORY_SLOT_COST_MULT = 1.55; // 슬롯을 늘릴수록 다음 슬롯 비용도 이 배율만큼 증가

function territoryDef(type){
  return TERRITORY_BUILDING_TYPES.find(t => t.type === type);
}

function territoryBuildingName(b){
  const def = territoryDef(b.type);
  const names = def.tierNames;
  if(b.tier <= names.length) return names[b.tier - 1];
  return `${names[names.length - 1]} +${b.tier - names.length}`;
}

function territoryBuildingRate(b){
  const def = territoryDef(b.type);
  return def.baseRatePerHour * Math.pow(TERRITORY_TIER_MULT, b.tier - 1) * (1 + (b.level - 1) * TERRITORY_LEVEL_GROWTH);
}

function territoryTotalRate(type){
  return state.territory.buildings
    .filter(b => b.type === type)
    .reduce((sum, b) => sum + territoryBuildingRate(b), 0);
}

function territoryCapAmount(type){
  return territoryTotalRate(type) * TERRITORY_CAP_HOURS;
}

function territoryPending(type){
  const rate = territoryTotalRate(type);
  const last = (state.territory.lastCollect && state.territory.lastCollect[type]) || Date.now();
  const hours = Math.min((Date.now() - last) / 3600000, TERRITORY_CAP_HOURS);
  return rate * hours;
}

function collectTerritory(type){
  const pending = Math.floor(territoryPending(type));
  if(pending <= 0) return;
  const field = TERRITORY_RESOURCE_FIELD[type];
  state[field] += pending;
  state.territory.lastCollect[type] = Date.now();
  const def = territoryDef(type);
  log(`${def.icon} ${def.resourceLabel} 수확: +${pending.toLocaleString()}`, 'good');
  renderAll();
}

function territoryUpgradeCost(b){
  const def = territoryDef(b.type);
  return Math.round(
    def.upgradeBaseCost
    * Math.pow(TERRITORY_UPGRADE_COST_MULT, b.level - 1)
    * Math.pow(TERRITORY_TIER_COST_MULT, b.tier - 1)
  );
}

function territoryTierUpCost(b){
  const atMaxCost = territoryUpgradeCost({type: b.type, level: TERRITORY_MAX_LEVEL_PER_TIER, tier: b.tier});
  return Math.round(atMaxCost * TERRITORY_TIERUP_COST_FACTOR);
}

function upgradeTerritoryBuilding(idx){
  const b = state.territory.buildings[idx];
  if(!b || b.level >= TERRITORY_MAX_LEVEL_PER_TIER) return;
  const cost = territoryUpgradeCost(b);
  const field = TERRITORY_RESOURCE_FIELD[b.type];
  if(state[field] < cost) return;
  state[field] -= cost;
  b.level++;
  renderAll();
}

function tierUpTerritoryBuilding(idx){
  const b = state.territory.buildings[idx];
  if(!b || b.level < TERRITORY_MAX_LEVEL_PER_TIER) return;
  const cost = territoryTierUpCost(b);
  const field = TERRITORY_RESOURCE_FIELD[b.type];
  if(state[field] < cost) return;
  state[field] -= cost;
  b.tier++;
  b.level = 1;
  log(`🏗️ ${territoryDef(b.type).icon} ${territoryBuildingName(b)}(으)로 증축되었습니다!`, 'good');
  renderAll();
}

function territorySlotExpandCost(){
  const bought = Math.max(0, state.territory.slotCount - 3); // 시작 3칸 이후로 늘린 횟수
  const mult = Math.pow(TERRITORY_SLOT_COST_MULT, bought);
  return {
    gold: Math.round(TERRITORY_SLOT_BASE_COST.gold * mult),
    fragments: Math.round(TERRITORY_SLOT_BASE_COST.fragment * mult),
    soul: Math.round(TERRITORY_SLOT_BASE_COST.soul * mult),
  };
}

function canAffordTerritorySlot(){
  const c = territorySlotExpandCost();
  return state.gold >= c.gold && state.fragments >= c.fragments && state.soul >= c.soul;
}

function expandTerritorySlot(type){
  if(!canAffordTerritorySlot()) return;
  const c = territorySlotExpandCost();
  state.gold -= c.gold;
  state.fragments -= c.fragments;
  state.soul -= c.soul;
  state.territory.slotCount++;
  state.territory.buildings.push({type, level:1, tier:1});
  log(`🏗️ 부지를 확장하고 ${territoryDef(type).icon} 새 건물을 지었습니다!`, 'good');
  renderAll();
}

// ---------- 렌더 ----------
function renderTerritoryPanel(){
  const collectGrid = document.getElementById('territoryCollectGrid');
  const buildGrid = document.getElementById('territoryBuildingGrid');
  if(!collectGrid || !buildGrid) return;

  // 자원별 수확 카드 3개
  collectGrid.innerHTML = TERRITORY_BUILDING_TYPES.map(def => {
    const pending = Math.floor(territoryPending(def.type));
    const cap = Math.floor(territoryCapAmount(def.type));
    const ratePerHour = territoryTotalRate(def.type);
    const full = cap > 0 && pending >= cap;
    return `
      <div class="relic-card">
        <div class="rname"><span>${def.icon} ${def.resourceLabel}</span><span class="rlvl">${ratePerHour.toLocaleString(undefined,{maximumFractionDigits:1})}/시간</span></div>
        <div class="rdesc">쌓인 양: ${pending.toLocaleString()} / ${cap.toLocaleString()}${full ? ' (가득 참!)' : ''}</div>
        <button class="pet-feed-btn" type="button" data-collect="${def.type}" ${pending<=0?'disabled':''}>
          ${pending>0 ? `수확하기 (+${pending.toLocaleString()})` : '쌓이는 중...'}
        </button>
      </div>
    `;
  }).join('');
  collectGrid.querySelectorAll('[data-collect]').forEach(btn=>{
    btn.addEventListener('click', ()=>collectTerritory(btn.dataset.collect));
  });

  // 건물 카드 그리드
  buildGrid.innerHTML = state.territory.buildings.map((b, idx) => {
    const def = territoryDef(b.type);
    const maxed = b.level >= TERRITORY_MAX_LEVEL_PER_TIER;
    const rate = territoryBuildingRate(b);
    const field = TERRITORY_RESOURCE_FIELD[b.type];
    let btnHtml;
    if(maxed){
      const cost = territoryTierUpCost(b);
      const afford = state[field] >= cost;
      btnHtml = `<button class="pet-feed-btn" type="button" data-tierup="${idx}" ${afford?'':'disabled'}>🏗️ 증축 (${cost.toLocaleString()} ${def.resourceLabel})</button>`;
    } else {
      const cost = territoryUpgradeCost(b);
      const afford = state[field] >= cost;
      btnHtml = `<button class="pet-feed-btn" type="button" data-upgrade="${idx}" ${afford?'':'disabled'}>강화 (${cost.toLocaleString()} ${def.resourceLabel})</button>`;
    }
    return `
      <div class="relic-card">
        <div class="rname"><span>${def.icon} ${territoryBuildingName(b)}</span><span class="rlvl">Lv.${b.level}${maxed?' MAX':''}</span></div>
        <div class="rdesc">생산량: ${rate.toLocaleString(undefined,{maximumFractionDigits:1})} ${def.resourceLabel}/시간</div>
        ${btnHtml}
      </div>
    `;
  }).join('');
  buildGrid.querySelectorAll('[data-upgrade]').forEach(btn=>{
    btn.addEventListener('click', ()=>upgradeTerritoryBuilding(parseInt(btn.dataset.upgrade,10)));
  });
  buildGrid.querySelectorAll('[data-tierup]').forEach(btn=>{
    btn.addEventListener('click', ()=>tierUpTerritoryBuilding(parseInt(btn.dataset.tierup,10)));
  });

  // 부지 확장
  const slotCountEl = document.getElementById('territorySlotCountText');
  const slotCostEl = document.getElementById('territorySlotCostText');
  if(slotCountEl) slotCountEl.textContent = state.territory.slotCount;
  if(slotCostEl){
    const c = territorySlotExpandCost();
    slotCostEl.textContent = `다음 확장 비용: 📦 ${c.gold.toLocaleString()} · 🗿 ${c.fragments.toLocaleString()} · 🧪 ${c.soul.toLocaleString()}`;
  }
  const afford = canAffordTerritorySlot();
  ['gold','fragment','soul'].forEach(type=>{
    const btn = document.getElementById(`territoryBuild${type==='gold'?'Gold':type==='fragment'?'Frag':'Soul'}Btn`);
    if(btn) btn.disabled = !afford;
  });
}

document.getElementById('territoryBuildGoldBtn')?.addEventListener('click', ()=>expandTerritorySlot('gold'));
document.getElementById('territoryBuildFragBtn')?.addEventListener('click', ()=>expandTerritorySlot('fragment'));
document.getElementById('territoryBuildSoulBtn')?.addEventListener('click', ()=>expandTerritorySlot('soul'));
