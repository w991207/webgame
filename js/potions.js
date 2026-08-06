// ---------- 물약 상점 (일시적 버프) ----------
// 물자획득/경험치획득처럼 전역 상한(GOLD_MULT_CAP 등)이 걸린 스탯은 강화를 다 채운 유저에겐
// 애초에 사도 효과가 없으니 물약 대상에서 제외한다. 대신 상한이 없는 스탯(공격력/방어력/체력/
// 치명타 피해/명중)만 판다 — 뭘 사도 항상 확실하게 체감되는 일시 버프가 되도록.
const POTION_DURATION_MIN = 15;
const POTION_DURATION_MS = POTION_DURATION_MIN * 60 * 1000;
const POTION_COST = 50000000; // 개당 5천만 물자

// ---------- 혈청 팩 (물자 → 혈청 환전, 일일 구매 제한) ----------
// 혈청은 영구 강화(su.*)/전직/스킬 습득에 쓰이는 핵심 재화라, 물자로 무제한 구매 가능하게 두면
// 밸런스가 깨진다. 그래서 값을 비싸게(10억) 잡고 하루 10개(=혈청 1000개)로 상한을 둔다.
const SOUL_PACK_COST = 100000000; // 개당 10억 물자
const SOUL_PACK_AMOUNT = 50;      // 개당 지급 혈청 수
const SOUL_PACK_DAILY_LIMIT = 10;  // 하루 최대 구매 개수

function buySoulPack(){
  if((state.dailySoulPacksBought||0) >= SOUL_PACK_DAILY_LIMIT){
    log(`🧪 혈청 팩은 하루 ${SOUL_PACK_DAILY_LIMIT}개까지만 구매할 수 있습니다. 내일 다시 시도해주세요.`, 'warn');
    return;
  }
  if(state.gold < SOUL_PACK_COST) return;

  state.gold -= SOUL_PACK_COST;
  state.soul += SOUL_PACK_AMOUNT;
  state.dailySoulPacksBought = (state.dailySoulPacksBought||0) + 1;
  log(`🧪 혈청 팩 구매! +${SOUL_PACK_AMOUNT}🧪 (오늘 ${state.dailySoulPacksBought}/${SOUL_PACK_DAILY_LIMIT}회 구매)`, 'good');
  renderAll();
}

function renderSoulPackShop(){
  const el = document.getElementById('soulPackShop');
  if(!el) return;

  const bought = state.dailySoulPacksBought || 0;
  const remaining = Math.max(0, SOUL_PACK_DAILY_LIMIT - bought);
  const soldOut = remaining <= 0;
  const afford = state.gold >= SOUL_PACK_COST;

  el.innerHTML = `
    <div class="shop-item">
      <div class="info">
        <div class="name">🧪 혈청 팩 <span class="potion-active-tag">오늘 ${bought}/${SOUL_PACK_DAILY_LIMIT}</span></div>
        <div class="desc">즉시 🧪 혈청 ${SOUL_PACK_AMOUNT}개 획득 (하루 ${SOUL_PACK_DAILY_LIMIT}개 한정)</div>
      </div>
      <button class="buy" id="buySoulPackBtn" ${(soldOut || !afford) ? 'disabled' : ''}>${soldOut ? '오늘 매진' : SOUL_PACK_COST.toLocaleString() + ' 📦 구매'}</button>
    </div>`;
  document.getElementById('buySoulPackBtn')?.addEventListener('click', buySoulPack);
}

const POTIONS = [
  {key:'atk', name:'맹공의 물약', icon:'⚔️', stat:'atkPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 공격력 +50%`},
  {key:'def', name:'철벽의 물약', icon:'🛡️', stat:'defPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 방어력 +50%`},
  {key:'hp', name:'활력의 물약', icon:'❤️', stat:'hpPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 최대 체력 +50%`},
  {key:'critDmg', name:'파괴의 물약', icon:'💥', stat:'critDmgAdd', value:40, unit:'%p', desc:`${POTION_DURATION_MIN}분간 치명타 피해 +40%p`},
  {key:'accuracy', name:'집중의 물약', icon:'🎯', stat:'accuracyAdd', value:30, unit:'', desc:`${POTION_DURATION_MIN}분간 명중 +30`},
];

// stats()에서 호출 — 만료 안 된 버프만 합산해서 돌려준다.
function buffBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, critDmgAdd:0, accuracyAdd:0};
  const buffs = state.activeBuffs;
  if(!buffs) return b;
  const now = Date.now();
  for(const key in buffs){
    const buff = buffs[key];
    if(buff && buff.expiresAt > now && Object.prototype.hasOwnProperty.call(b, buff.stat)){
      b[buff.stat] += buff.value;
    }
  }
  return b;
}

// 만료된 버프를 state에서 정리 (렌더할 때마다 가볍게 청소).
function cleanupExpiredBuffs(){
  const buffs = state.activeBuffs;
  if(!buffs) return;
  const now = Date.now();
  Object.keys(buffs).forEach(key=>{
    if(!buffs[key] || buffs[key].expiresAt <= now) delete buffs[key];
  });
}

function buyPotion(key){
  const p = POTIONS.find(x=>x.key===key);
  if(!p) return;
  if(state.gold < POTION_COST) return;

  state.gold -= POTION_COST;
  if(!state.activeBuffs) state.activeBuffs = {};
  // 다시 사면 값이 중첩되는 게 아니라 지속시간만 갱신(리필)된다 — 중첩 구매로 무한정 강해지는 것 방지.
  state.activeBuffs[p.key] = {stat: p.stat, value: p.value, expiresAt: Date.now() + POTION_DURATION_MS};

  log(`🧪 ${p.name}을(를) 마셨습니다! ${p.desc}`, 'good');
  renderAll();
}

function formatBuffRemaining(ms){
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

function renderPotionShop(){
  const el = document.getElementById('potionShopList');
  if(!el) return;
  cleanupExpiredBuffs();

  const now = Date.now();
  let html = '';
  POTIONS.forEach(p=>{
    const active = state.activeBuffs && state.activeBuffs[p.key];
    const remainMs = active ? (active.expiresAt - now) : 0;
    const afford = state.gold >= POTION_COST;

    html += `
      <div class="shop-item">
        <div class="info">
          <div class="name">${p.icon} ${p.name}${active ? ` <span class="potion-active-tag">활성 · ${formatBuffRemaining(remainMs)}</span>` : ''}</div>
          <div class="desc">${p.desc}</div>
        </div>
        <button class="buy" data-key="${p.key}" ${afford ? '' : 'disabled'}>${POTION_COST.toLocaleString()} 📦 ${active ? '갱신' : '구매'}</button>
      </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('button[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyPotion(btn.dataset.key));
  });
}
