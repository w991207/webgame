// ---------- 몬스터 카드 (Cards / 수집형 덱) ----------
// 몬스터를 처치하면 일정 확률로 카드가 드랍되고, 같은 카드가 중복 드랍되면 누적 장수로 카드 레벨이 오른다.
// 카드를 덱(3슬롯)에 장착하면 stats()에 영구 반영되는 스탯 보너스를 얻는다.
// 도감(bestiary.js)과 같은 몬스터 이름 기준이라 도감에 기록되는 모든 몬스터는 카드도 존재하고,
// 등급도 도감 분류를 따른다: 일반 몬스터=일반 / 무한의 탑=고급 / 보스=희귀 / 황금 몬스터=영웅.

const CARD_RARITIES = {
  common:    {label:'일반', color:'#9aa5b1', mult:1.0},
  rare:      {label:'고급', color:'#5eb1ff', mult:1.5},
  epic:      {label:'희귀', color:'#c07cff', mult:2.2},
  legendary: {label:'영웅', color:'#ffb347', mult:3.5},
};

// 카드 레벨 구간: 보유 장수가 이 기준 이상일 때마다 레벨업 (1장부터 Lv.1, 5장부터 Lv.2 ... 250장부터 Lv.6).
const CARD_LEVEL_THRESHOLDS = [5, 15, 40, 100, 250];
const CARD_LEVEL_BONUS_STEP = 0.4; // 카드 레벨 1당 보너스 +40% (Lv.1=100% ... Lv.6=300%)

// 카드 정의. bonus.stat은 stats()의 카드 덱 보너스(cardDeckBonus)에서 합산되는 키와 일치해야 한다.
// critAdd(치명타 확률)/critDmgAdd(치명타 피해)는 %p(퍼센트 포인트) 단위.
const CARD_DEFS = [
  // 폐허 - 일반 몬스터 (등급: 일반, 드랍률 2%)
  {key:'zombie',    name:'떠도는 좀비',     emoji:'👻', img:'image/monsters/zombie.png',        rarity:'common', dropChance:0.02,  bonus:{stat:'hpPct',       value:2,   label:'최대 체력'}},
  {key:'bat',       name:'변이 박쥐',       emoji:'🦇', img:'image/monsters/bat.png',           rarity:'common', dropChance:0.02,  bonus:{stat:'spdPct',      value:2,   label:'공격 속도'}},
  {key:'skeleton',  name:'부패한 병사',     emoji:'💀', img:'image/monsters/skeleton.png',      rarity:'common', dropChance:0.02,  bonus:{stat:'atkPct',      value:2,   label:'공격력'}},
  {key:'spider',    name:'변이 거미',       emoji:'🕷️', img:'image/monsters/spider.png',        rarity:'common', dropChance:0.02,  bonus:{stat:'defPct',      value:2,   label:'방어력'}},
  {key:'trapbox',   name:'부비트랩 상자',   emoji:'📦', img:'image/monsters/trapbox.png',       rarity:'common', dropChance:0.02,  bonus:{stat:'goldPct',     value:2,   label:'물자 획득'}},
  {key:'troll',     name:'오염된 괴수',     emoji:'🧌', img:'image/monsters/troll.png',         rarity:'common', dropChance:0.02,  bonus:{stat:'hpPct',       value:3,   label:'최대 체력'}},
  {key:'drone',     name:'감시 드론',       emoji:'👁️', img:'image/monsters/drone.png',         rarity:'common', dropChance:0.02,  bonus:{stat:'critAdd',     value:1,   label:'치명타 확률'}},
  {key:'wolf',      name:'변이 늑대',       emoji:'🐺', img:'image/monsters/wolf.png',          rarity:'common', dropChance:0.02,  bonus:{stat:'atkPct',      value:2.5, label:'공격력'}},
  {key:'bamsen',    name:'밤샌 웹툰작가',   emoji:'📝', img:'image/monsters/bamsenyeonwoo.png', rarity:'common', dropChance:0.02,  bonus:{stat:'expPct',      value:2,   label:'경험치 획득'}},
  {key:'sajok',     name:'사족보행작가',    emoji:'🖋️', img:'image/monsters/sajok.png',         rarity:'common', dropChance:0.02,  bonus:{stat:'goldPct',     value:2.5, label:'물자 획득'}},
  {key:'jansang',   name:'잔상인데용',      emoji:'👤', img:'image/monsters/jansang.png',       rarity:'common', dropChance:0.02,  bonus:{stat:'spdPct',      value:2.5, label:'공격 속도'}},
  // 무한의 탑 (등급: 고급, 드랍률 1.5%)
  {key:'guardbot',  name:'경비 로봇',       emoji:'🗿', rarity:'rare', dropChance:0.015, bonus:{stat:'defPct',   value:3,   label:'방어력'}},
  {key:'furnace',   name:'소각로 괴수',     emoji:'🗿', rarity:'rare', dropChance:0.015, bonus:{stat:'hpPct',    value:4,   label:'최대 체력'}},
  {key:'freezer',   name:'냉동창고 변이체', emoji:'🧊', rarity:'rare', dropChance:0.015, bonus:{stat:'defPct',   value:3.5, label:'방어력'}},
  {key:'alpha',     name:'실험체 알파',     emoji:'👿', rarity:'rare', dropChance:0.015, bonus:{stat:'atkPct',   value:3,   label:'공격력'}},
  {key:'dronex',    name:'폭주 드론',       emoji:'👼', rarity:'rare', dropChance:0.015, bonus:{stat:'spdPct',   value:3,   label:'공격 속도'}},
  {key:'finalsys',  name:'최종 방어 시스템', emoji:'⚔️', rarity:'rare', dropChance:0.015, bonus:{stat:'atkPct',  value:4,   label:'공격력'}},
  {key:'origin',    name:'근원 변이체',     emoji:'🐉', rarity:'rare', dropChance:0.015, bonus:{stat:'critDmgAdd', value:6, label:'치명타 피해'}},
  // 보스 (등급: 희귀, 드랍률 3%)
  {key:'warden',    name:'폐허의 파수병',   emoji:'🗿', rarity:'epic', dropChance:0.03, bonus:{stat:'defPct',    value:5,   label:'방어력'}},
  {key:'guardmad',  name:'폭주한 경비병',   emoji:'⚔️', rarity:'epic', dropChance:0.03, bonus:{stat:'atkPct',    value:5,   label:'공격력'}},
  {key:'mutantking',name:'변이체의 왕',     emoji:'🐉', rarity:'epic', dropChance:0.03, bonus:{stat:'hpPct',     value:6,   label:'최대 체력'}},
  {key:'researcher',name:'감염된 연구원',   emoji:'🧙', rarity:'epic', dropChance:0.03, bonus:{stat:'critDmgAdd', value:8, label:'치명타 피해'}},
  // 특수 (등급: 영웅, 드랍률 10% — 등장 자체가 희귀한 황금 몬스터라 드랍률은 높게)
  {key:'golden',    name:'황금 몬스터',     emoji:'✨', rarity:'legendary', dropChance:0.10, bonus:{stat:'goldPct', value:8, label:'물자 획득'}},
];

function cardDefByKey(key){
  return CARD_DEFS.find(c => c.key === key) || null;
}
function cardDefByName(name){
  return CARD_DEFS.find(c => c.name === name) || null;
}

function cardLevelFromCount(count){
  let lvl = 1;
  for(let i=0;i<CARD_LEVEL_THRESHOLDS.length;i++){
    if(count >= CARD_LEVEL_THRESHOLDS[i]) lvl = i + 2;
  }
  return lvl;
}

// 카드 최종 보너스 값 = 기본값 × 레벨 성장 × 등급 배율
function cardBonusValue(def, lvl){
  return def.bonus.value * (1 + (lvl - 1) * CARD_LEVEL_BONUS_STEP) * CARD_RARITIES[def.rarity].mult;
}
function formatCardBonus(def, lvl){
  const v = Math.round(cardBonusValue(def, lvl) * 10) / 10;
  const isPoint = def.bonus.stat === 'critAdd' || def.bonus.stat === 'critDmgAdd';
  return `${def.bonus.label} +${v}${isPoint ? '%p' : '%'}`;
}

// 저장값 방어: cardDeck이 저장/로드 과정에서 깨졌을 수 있으니 항상 3슬롯 배열로 정규화.
function ensureCardDeck(){
  if(!Array.isArray(state.cardDeck)) state.cardDeck = [null, null, null];
  const d = state.cardDeck.slice(0, 3);
  while(d.length < 3) d.push(null);
  state.cardDeck = d;
}

// 장착된 카드 덱의 합산 보너스. stats()에서 호출된다 (state.js).
// 보너스 키는 도감 계열 보너스(titleBonus 등)와 동일한 형식을 유지한다.
function cardDeckBonus(){
  const out = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, spdPct:0, accuracyAdd:0};
  ensureCardDeck();
  if(!state.cards) state.cards = {};
  let setRarity = null, setCount = 0;
  state.cardDeck.forEach(key => {
    if(!key) return;
    const def = cardDefByKey(key);
    const count = state.cards[key] || 0;
    if(!def || count <= 0) return; // 보유하지 않은 카드가 슬롯에 남아있으면 무시
    const lvl = cardLevelFromCount(count);
    out[def.bonus.stat] += cardBonusValue(def, lvl);
    if(setRarity === null) setRarity = def.rarity;
    if(setRarity === def.rarity) setCount++;
  });
  // 세트 보너스: 같은 등급 3장을 장착하면 모든 카드 효과 ×1.25
  if(setCount === 3){
    for(const k in out) out[k] *= 1.25;
  }
  return out;
}

// 몬스터 처치 시 카드 드랍 판정. combat.js(dealDamageToMonster)에서 호출.
function recordCardDrop(meta){
  if(!meta || !meta.name) return;
  const def = cardDefByName(meta.name);
  if(!def) return;
  if(Math.random() >= def.dropChance) return;
  if(!state.cards) state.cards = {};
  const prevLevel = cardLevelFromCount(state.cards[def.key] || 0);
  state.cards[def.key] = (state.cards[def.key] || 0) + 1;
  const newLevel = cardLevelFromCount(state.cards[def.key]);
  const rar = CARD_RARITIES[def.rarity];
  if(newLevel > prevLevel){
    log(`🃏 [${rar.label}] ${def.name} 카드가 Lv.${newLevel}(으)로 성장했습니다! (보유 ${state.cards[def.key]}장)`, 'good');
  } else {
    log(`🃏 [${rar.label}] ${def.name} 카드 획득! (보유 ${state.cards[def.key]}장)`, 'new');
  }
}

// 카드를 덱에 장착/해제 (토글)
function toggleCardDeck(key){
  ensureCardDeck();
  const def = cardDefByKey(key);
  if(!def) return;
  const owned = (state.cards && state.cards[key]) || 0;
  if(owned <= 0) return;
  const idx = state.cardDeck.indexOf(key);
  if(idx >= 0){
    state.cardDeck[idx] = null;
    log(`🃏 ${def.name} 카드를 덱에서 해제했습니다.`, 'warn');
  } else {
    const empty = state.cardDeck.indexOf(null);
    if(empty < 0){
      log('카드 덱이 가득 찼습니다 (3장). 먼저 카드를 해제해주세요.', 'warn');
      return;
    }
    state.cardDeck[empty] = key;
    log(`🃏 ${def.name} 카드를 덱 ${empty + 1}번 슬롯에 장착했습니다!`, 'good');
  }
  renderAll();
}

function renderMonsterCards(){
  const el = document.getElementById('cardsGrid');
  if(!el) return;
  ensureCardDeck();
  if(!state.cards) state.cards = {};

  const countEl = document.getElementById('cardsCountText');
  if(countEl){
    const owned = CARD_DEFS.filter(c => (state.cards[c.key] || 0) > 0).length;
    countEl.textContent = `${owned} / ${CARD_DEFS.length} 종 보유`;
  }

  // ---------- 덱 슬롯 3개 ----------
  const deckRow = document.getElementById('cardDeckRow');
  if(deckRow){
    deckRow.innerHTML = state.cardDeck.map((key, i) => {
      const def = key ? cardDefByKey(key) : null;
      const count = def ? (state.cards[def.key] || 0) : 0;
      if(def && count > 0){
        const rar = CARD_RARITIES[def.rarity];
        const lvl = cardLevelFromCount(count);
        return `
          <div class="card-slot filled" style="border-color:${rar.color};">
            <span class="card-slot-emoji">${def.emoji}</span>
            <span class="card-slot-name">${def.name}</span>
            <span class="card-slot-lvl" style="color:${rar.color};">Lv.${lvl}</span>
            <button class="card-deck-btn" data-deck="${def.key}">해제</button>
          </div>`;
      }
      return `
        <div class="card-slot empty">
          <span class="card-slot-emoji">➕</span>
          <span class="card-slot-name">빈 슬롯 ${i + 1}</span>
        </div>`;
    }).join('');
    deckRow.querySelectorAll('[data-deck]').forEach(btn => {
      btn.addEventListener('click', () => toggleCardDeck(btn.dataset.deck));
    });
  }

  // ---------- 덱 보너스 요약 ----------
  const bonusEl = document.getElementById('cardDeckBonusText');
  if(bonusEl){
    const b = cardDeckBonus();
    const parts = [];
    if(b.atkPct) parts.push(`공격 +${b.atkPct.toFixed(1)}%`);
    if(b.defPct) parts.push(`방어 +${b.defPct.toFixed(1)}%`);
    if(b.hpPct) parts.push(`체력 +${b.hpPct.toFixed(1)}%`);
    if(b.goldPct) parts.push(`물자 +${b.goldPct.toFixed(1)}%`);
    if(b.expPct) parts.push(`경험치 +${b.expPct.toFixed(1)}%`);
    if(b.spdPct) parts.push(`공속 +${b.spdPct.toFixed(1)}%`);
    if(b.critAdd) parts.push(`치확 +${Math.round(b.critAdd*10)/10}%p`);
    if(b.critDmgAdd) parts.push(`치피 +${Math.round(b.critDmgAdd*10)/10}%p`);
    bonusEl.innerHTML = parts.length
      ? `덱 효과: ${parts.join(' · ')}`
      : `<span style="color:var(--text-dim);">카드를 장착하면 영구 스탯 보너스를 얻습니다. 같은 등급 3장 세트 시 효과 ×1.25!</span>`;
  }

  // ---------- 카드 컬렉션 그리드 ----------
  el.innerHTML = CARD_DEFS.map(def => {
    const count = state.cards[def.key] || 0;
    const owned = count > 0;
    const rar = CARD_RARITIES[def.rarity];
    const inDeck = state.cardDeck.includes(def.key);
    const slotIdx = state.cardDeck.indexOf(def.key);
    const lvl = cardLevelFromCount(count);
    const visual = def.img
      ? `<img src="${def.img}" class="monster-card-img" alt="${owned ? def.name : '???'}" style="${owned?'':'filter:brightness(0);opacity:.35;'}">`
      : `<span class="monster-card-emoji" style="${owned?'':'filter:brightness(0);opacity:.35;'}">${owned ? def.emoji : '❔'}</span>`;
    let info;
    if(owned){
      const nextNeed = lvl < CARD_LEVEL_THRESHOLDS.length + 1 ? CARD_LEVEL_THRESHOLDS[lvl - 1] : null;
      info = `
        <div class="monster-card-count">보유 ${count}장 · Lv.${lvl}${nextNeed ? ` (다음 ${nextNeed}장)` : ' (최고)'}</div>
        <div class="monster-card-bonus">${formatCardBonus(def, lvl)}</div>
        <button class="card-deck-btn" data-equip="${def.key}">${inDeck ? `해제 (${slotIdx + 1}번)` : '덱에 장착'}</button>`;
    } else {
      info = `<div class="monster-card-count">미획득 (${Math.round(def.dropChance * 100)}%)</div>`;
    }
    return `
      <div class="monster-card ${owned ? 'owned' : 'unknown'} ${inDeck ? 'in-deck' : ''}">
        ${visual}
        <div class="monster-card-rarity" style="color:${rar.color};">[${rar.label}]</div>
        <div class="monster-card-name">${owned ? def.name : '???'}</div>
        ${info}
      </div>`;
  }).join('');
  el.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', () => toggleCardDeck(btn.dataset.equip));
  });
}

