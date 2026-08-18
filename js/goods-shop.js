// ---------- 잡화 상점 (레이드 입장권 + 강화 주문서) ----------
// 물자(gold)로 구매하는 소모품 상점. 레이드 입장권은 자연 충전(1시간당 1개, 최대 3개)과 별개로
// 하루 3개까지 즉시 구매해 최대치를 넘겨 보유할 수 있다 (js/gifts.js의 선물 지급과 동일한 방식).
// 강화 주문서는 js/enhance.js의 강화 시도 화면에서 사용해 성공 확률을 올리거나 실패 페널티를 막는다.

const RAID_TICKET_BUY_COST = 50000000;   // 개당 5천만 물자
const RAID_TICKET_BUY_DAILY_LIMIT = 3;   // 하루 최대 구매 개수

function buyRaidTicketWithGold(){
  if((state.dailyRaidTicketsBought||0) >= RAID_TICKET_BUY_DAILY_LIMIT){
    log(`🎟️ 레이드 입장권은 하루 ${RAID_TICKET_BUY_DAILY_LIMIT}개까지만 구매할 수 있습니다. 내일 다시 시도해주세요.`, 'warn');
    return;
  }
  if(state.gold < RAID_TICKET_BUY_COST) return;

  state.gold -= RAID_TICKET_BUY_COST;
  state.raidTicket = (state.raidTicket||0) + 1; // 자연 충전 최대치(3)를 넘겨도 그대로 지급
  state.dailyRaidTicketsBought = (state.dailyRaidTicketsBought||0) + 1;
  log(`🎟️ 레이드 입장권 구매! +1개 (오늘 ${state.dailyRaidTicketsBought}/${RAID_TICKET_BUY_DAILY_LIMIT}회 구매)`, 'good');
  renderAll();
}

function renderRaidTicketShop(){
  const el = document.getElementById('raidTicketShop');
  if(!el) return;

  const bought = state.dailyRaidTicketsBought || 0;
  const remaining = Math.max(0, RAID_TICKET_BUY_DAILY_LIMIT - bought);
  const soldOut = remaining <= 0;
  const afford = state.gold >= RAID_TICKET_BUY_COST;

  el.innerHTML = `
    <div class="shop-item">
      <div class="info">
        <div class="name">🎟️ 레이드 입장권 <span class="potion-active-tag">오늘 ${bought}/${RAID_TICKET_BUY_DAILY_LIMIT}</span></div>
        <div class="desc">즉시 🎟️ 레이드 입장권 1개 획득 (자연 충전 최대치와 별개로 하루 ${RAID_TICKET_BUY_DAILY_LIMIT}개 한정 구매)</div>
      </div>
      <button class="buy" id="buyRaidTicketBtn" ${(soldOut || !afford) ? 'disabled' : ''}>${soldOut ? '오늘 매진' : RAID_TICKET_BUY_COST.toLocaleString() + ' 📦 구매'}</button>
    </div>`;
  document.getElementById('buyRaidTicketBtn')?.addEventListener('click', buyRaidTicketWithGold);
}

// ---------- 강화 주문서 ----------
const ENHANCE_SCROLLS = [
  {
    key: 'rateUp', icon: '📈', name: '강화 확률 증가 주문서', cost: 50000000,
    desc: '강화 시도 시 성공 확률 +10%p (모든 단계에서 사용 가능)',
  },
  {
    key: 'noDowngrade', icon: '🛡️', name: '하락 방지 주문서', cost: 100000000,
    desc: '실패해도 강화 단계가 하락하지 않음 (+5 ~ +7 구간 전용)',
  },
  {
    key: 'noDestroy', icon: '💎', name: '파괴 방지 주문서', cost: 1000000000,
    desc: '실패해도 장비가 파괴되지 않고 단계도 하락하지 않음 (+8 ~ +15 구간 전용)',
  },
];

function buyEnhanceScroll(key){
  const s = ENHANCE_SCROLLS.find(x => x.key === key);
  if(!s) return;
  if(state.gold < s.cost) return;

  state.gold -= s.cost;
  if(!state.enhanceScrolls) state.enhanceScrolls = {rateUp:0, noDowngrade:0, noDestroy:0};
  state.enhanceScrolls[key] = (state.enhanceScrolls[key]||0) + 1;
  log(`${s.icon} ${s.name} 구매! (보유 ${state.enhanceScrolls[key]}개)`, 'good');
  renderAll();
}

function renderEnhanceScrollShop(){
  const el = document.getElementById('enhanceScrollShop');
  if(!el) return;
  const scrolls = state.enhanceScrolls || {rateUp:0, noDowngrade:0, noDestroy:0};

  el.innerHTML = ENHANCE_SCROLLS.map(s => {
    const owned = scrolls[s.key] || 0;
    const afford = state.gold >= s.cost;
    return `
      <div class="shop-item">
        <div class="info">
          <div class="name">${s.icon} ${s.name} <span class="potion-active-tag">보유 ${owned}개</span></div>
          <div class="desc">${s.desc}</div>
        </div>
        <button class="buy" data-key="${s.key}" ${afford ? '' : 'disabled'}>${s.cost.toLocaleString()} 📦 구매</button>
      </div>`;
  }).join('');

  el.querySelectorAll('button[data-key]').forEach(btn => {
    btn.addEventListener('click', () => buyEnhanceScroll(btn.dataset.key));
  });
}
