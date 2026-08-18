// ---------- 장비 강화 (Enhance) ----------
// 라스트존판 리니지식 강화. 몬스터 처치 시 드랍되는 🔩 강화석을 소모해 "장착 중인" 무기/방어구/
// 장신구의 메인 옵션(공격력%/방어력%, 장신구는 공+방+체 동시)을 끌어올린다.
// 강화 단계가 오를수록 성공 확률이 낮아지고, 위험도가 3단계로 나뉜다.
//   - +1 ~ +4 (safe)      : 실패해도 그냥 실패 (단계 유지)
//   - +5 ~ +7 (downgrade) : 실패 시 강화 단계가 1 하락
//   - +8 ~ +15 (destroy)  : 실패 시 destroyChance 확률로 장비 자체가 파괴(소멸), 아니면 1 하락
// 서브 옵션(치명타/속도/체력/물자/경험치)은 강화의 영향을 받지 않는다 — 순수하게 메인 옵션만 강화됨.

const ENHANCE_MAX_LEVEL = 15;
const ENHANCE_BONUS_PER_LEVEL = 8; // 강화 1단계당 메인 옵션 값에 +8% (곱연산)

const ENHANCE_LEVELS = [
  {level:1,  rate:95, risk:'safe'},
  {level:2,  rate:90, risk:'safe'},
  {level:3,  rate:83, risk:'safe'},
  {level:4,  rate:75, risk:'safe'},
  {level:5,  rate:65, risk:'downgrade'},
  {level:6,  rate:55, risk:'downgrade'},
  {level:7,  rate:45, risk:'downgrade'},
  {level:8,  rate:35, risk:'destroy', destroyChance:15},
  {level:9,  rate:28, risk:'destroy', destroyChance:20},
  {level:10, rate:22, risk:'destroy', destroyChance:25},
  {level:11, rate:17, risk:'destroy', destroyChance:30},
  {level:12, rate:13, risk:'destroy', destroyChance:35},
  {level:13, rate:9,  risk:'destroy', destroyChance:40},
  {level:14, rate:6,  risk:'destroy', destroyChance:45},
  {level:15, rate:4,  risk:'destroy', destroyChance:50},
];

function enhanceLevelInfo(targetLevel){
  return ENHANCE_LEVELS.find(l => l.level === targetLevel);
}

// 목표 단계까지 강화 시도 1회에 드는 강화석 비용.
function enhanceStoneCost(targetLevel){
  return Math.round(5 * Math.pow(1.42, targetLevel - 1));
}

// 아이템의 메인 옵션에 곱해지는 강화 배율. state.js의 equipTotals()가 이 함수를 호출한다.
function enhanceMultiplier(item){
  const lvl = (item && item.enhance) || 0;
  return 1 + lvl * ENHANCE_BONUS_PER_LEVEL / 100;
}

const ENHANCE_SLOT_LABEL = {weapon:'⚔️ 무기', armor:'🛡️ 방어구', accessory:'💍 장신구'};

// 부위별로 "다음 강화 시도에 어떤 주문서를 쓸지" 선택 상태 (소모되기 전까지 화면에만 남는 임시 상태).
let enhanceScrollSelection = {weapon:{rateUp:false, protect:false}, armor:{rateUp:false, protect:false}, accessory:{rateUp:false, protect:false}};

function attemptEnhance(slot){
  const item = state.equipment && state.equipment[slot];
  if(!item){
    flashMessageSafe('먼저 해당 부위에 장비를 장착하세요.');
    return;
  }
  const current = item.enhance || 0;
  if(current >= ENHANCE_MAX_LEVEL){
    flashMessageSafe('이미 최대 강화 단계입니다.');
    return;
  }
  const target = current + 1;
  const info = enhanceLevelInfo(target);
  const cost = enhanceStoneCost(target);
  if((state.enhanceStone||0) < cost){
    flashMessageSafe(`강화석이 부족합니다. (필요 🔩${cost} / 보유 🔩${Math.floor(state.enhanceStone||0)})`);
    return;
  }

  const scrolls = state.enhanceScrolls || {rateUp:0, noDowngrade:0, noDestroy:0};
  const sel = enhanceScrollSelection[slot] || {rateUp:false, protect:false};
  const protectKey = info.risk === 'downgrade' ? 'noDowngrade' : (info.risk === 'destroy' ? 'noDestroy' : null);
  const useRateUp = !!sel.rateUp && (scrolls.rateUp||0) > 0;
  const useProtect = !!sel.protect && protectKey && (scrolls[protectKey]||0) > 0;
  const effectiveRate = Math.min(100, info.rate + (useRateUp ? 10 : 0));

  if(info.risk === 'destroy' && !useProtect){
    const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
    const ok = confirm(
      `${ENHANCE_SLOT_LABEL[slot]} [${rarity.name}] +${current} → +${target} 강화를 시도합니다.\n` +
      `성공 확률: ${effectiveRate}%\n` +
      `⚠️ 실패 시 ${info.destroyChance}% 확률로 장비가 완전히 파괴됩니다 (파괴되지 않으면 +${Math.max(0, current-1)}로 하락).\n\n` +
      `강화석 🔩${cost}을(를) 소모하고 진행하시겠습니까?`
    );
    if(!ok) return;
  }

  state.enhanceStone -= cost;
  if(useRateUp) state.enhanceScrolls.rateUp--;
  if(useProtect) state.enhanceScrolls[protectKey]--;
  enhanceScrollSelection[slot] = {rateUp:false, protect:false}; // 시도 1회 후 선택은 초기화

  const success = Math.random() * 100 < effectiveRate;
  const scrollNote = useRateUp ? ' (📈 확률 주문서 사용)' : '';

  if(success){
    item.enhance = target;
    log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 성공! +${current} → +${target}${scrollNote}`, 'good');
    showEnhanceResult(slot, 'success', `✅ 강화 성공! +${current} → +${target}`);
  } else if(info.risk === 'safe'){
    log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패... (+${current} 유지)${scrollNote}`);
    showEnhanceResult(slot, 'fail', `❌ 강화 실패... (+${current} 유지)`);
  } else if(info.risk === 'downgrade'){
    if(useProtect){
      log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 🛡️ 하락 방지 주문서로 단계를 지켰습니다. (+${current} 유지)${scrollNote}`, 'good');
      showEnhanceResult(slot, 'fail', `❌ 강화 실패! (🛡️ 하락 방지로 +${current} 유지)`);
    } else {
      item.enhance = Math.max(0, current - 1);
      log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 단계가 하락했습니다. +${current} → +${item.enhance}${scrollNote}`, 'bad');
      showEnhanceResult(slot, 'fail', `❌ 강화 실패! 단계 하락 +${current} → +${item.enhance}`);
    }
  } else { // destroy risk
    if(useProtect){
      log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 💎 파괴 방지 주문서로 장비와 단계를 모두 지켰습니다. (+${current} 유지)${scrollNote}`, 'good');
      showEnhanceResult(slot, 'fail', `❌ 강화 실패! (💎 파괴 방지로 +${current} 유지)`);
    } else {
      const destroyed = Math.random() * 100 < info.destroyChance;
      if(destroyed){
        state.equipment[slot] = null;
        state.enhanceDestroyedCount = (state.enhanceDestroyedCount||0) + 1;
        log(`💥 ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 장비가 파괴되어 사라졌습니다...`, 'bad');
        showEnhanceResult(slot, 'destroy', `💥 장비 파괴! ${ENHANCE_SLOT_LABEL[slot]}가 사라졌습니다`);
      } else {
        item.enhance = Math.max(0, current - 1);
        log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 아슬아슬하게 파괴는 면했지만 단계가 하락했습니다. +${current} → +${item.enhance}`, 'bad');
        showEnhanceResult(slot, 'fail', `❌ 강화 실패! 단계 하락 +${current} → +${item.enhance} (파괴는 면함)`);
      }
    }
  }

  renderAll();
}

// flashMessage가 없는 빌드에서도 안전하게 안내 문구를 보여주기 위한 폴백 (log만 사용).
function flashMessageSafe(text){
  if(typeof flashMessage === 'function') flashMessage(text);
  else log(text);
}

// 강화 성공/실패가 눈에 잘 띄도록 패널 상단에 배너를 띄우고, 해당 부위 카드에 잠깐
// 테두리 플래시 애니메이션을 준다. lastEnhanceFlash는 renderEnhancePanel이 카드를
// 새로 그릴 때 한 번만 소비되고 지워지므로, 1초 주기 자동 리렌더에서는 다시 반짝이지 않는다.
let enhanceResultTimer = null;
let lastEnhanceFlash = null;
function showEnhanceResult(slot, type, message){
  lastEnhanceFlash = {slot, type};
  const el = document.getElementById('enhanceResultBanner');
  if(!el) return;
  el.textContent = message;
  el.className = 'enhance-result-banner show ' + type;
  // 같은 결과가 연속으로 떠도 애니메이션이 다시 재생되도록 강제 리플로우.
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  if(enhanceResultTimer) clearTimeout(enhanceResultTimer);
  enhanceResultTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2800);
}

function renderEnhancePanel(){
  const grid = document.getElementById('enhanceGrid');
  const stoneEl = document.getElementById('stoneDisplay2');
  if(stoneEl) stoneEl.textContent = Math.floor(state.enhanceStone||0).toLocaleString();
  if(!grid) return;

  const slots = ['weapon', 'armor', 'accessory'];
  grid.innerHTML = '';
  const flash = lastEnhanceFlash;
  lastEnhanceFlash = null; // 한 번만 소비 — 다음 자동 리렌더에서는 다시 반짝이지 않도록.
  slots.forEach(slot => {
    const item = state.equipment && state.equipment[slot];
    const card = document.createElement('div');
    card.className = 'enhance-card';
    if(flash && flash.slot === slot){
      card.classList.add(flash.type === 'success' ? 'flash-success' : 'flash-fail');
    }

    if(!item){
      card.innerHTML = `
        <div class="enhance-card-title">${ENHANCE_SLOT_LABEL[slot]}</div>
        <div class="enhance-empty">장착된 장비가 없습니다.</div>
      `;
      grid.appendChild(card);
      return;
    }

    const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
    const current = item.enhance || 0;
    const maxed = current >= ENHANCE_MAX_LEVEL;
    card.classList.add('rarity-' + item.rarity);

    let body;
    if(maxed){
      body = `<div class="enhance-maxed">🏆 최대 강화 단계 (+${ENHANCE_MAX_LEVEL}) 달성!</div>`;
    } else {
      const target = current + 1;
      const info = enhanceLevelInfo(target);
      const cost = enhanceStoneCost(target);
      const afford = (state.enhanceStone||0) >= cost;
      let riskLabel;
      if(info.risk === 'safe') riskLabel = `<span class="enhance-risk safe">안전 (실패해도 단계 유지)</span>`;
      else if(info.risk === 'downgrade') riskLabel = `<span class="enhance-risk warn">실패 시 강화 단계 -1</span>`;
      else riskLabel = `<span class="enhance-risk danger">실패 시 ${info.destroyChance}% 확률로 파괴!</span>`;

      const scrolls = state.enhanceScrolls || {rateUp:0, noDowngrade:0, noDestroy:0};
      const sel = enhanceScrollSelection[slot] || {rateUp:false, protect:false};
      const protectKey = info.risk === 'downgrade' ? 'noDowngrade' : (info.risk === 'destroy' ? 'noDestroy' : null);
      const protectLabel = info.risk === 'downgrade' ? '🛡️ 하락 방지 주문서' : (info.risk === 'destroy' ? '💎 파괴 방지 주문서' : null);
      const useRateUp = !!sel.rateUp && (scrolls.rateUp||0) > 0;
      const useProtect = !!sel.protect && protectKey && (scrolls[protectKey]||0) > 0;
      const effectiveRate = Math.min(100, info.rate + (useRateUp ? 10 : 0));

      let scrollHtml = '<div class="enhance-scrolls">';
      scrollHtml += `
        <label class="enhance-scroll-toggle ${(scrolls.rateUp||0) <= 0 ? 'disabled' : ''}">
          <input type="checkbox" class="enhance-scroll-check" data-slot="${slot}" data-field="rateUp" ${useRateUp ? 'checked' : ''} ${(scrolls.rateUp||0) <= 0 ? 'disabled' : ''}>
          📈 확률 +10%p 주문서 (보유 ${scrolls.rateUp||0}개)
        </label>`;
      if(protectKey){
        const owned = scrolls[protectKey]||0;
        scrollHtml += `
        <label class="enhance-scroll-toggle ${owned <= 0 ? 'disabled' : ''}">
          <input type="checkbox" class="enhance-scroll-check" data-slot="${slot}" data-field="protect" ${useProtect ? 'checked' : ''} ${owned <= 0 ? 'disabled' : ''}>
          ${protectLabel} (보유 ${owned}개)
        </label>`;
      }
      scrollHtml += '</div>';

      body = `
        <div class="enhance-next">+${current} → +${target} 시도</div>
        <div class="enhance-rate">성공 확률 <b>${effectiveRate}%</b>${useRateUp ? ` <span class="enhance-rate-boost">(기본 ${info.rate}% +10%p)</span>` : ''}</div>
        ${riskLabel}
        ${scrollHtml}
        <button class="enhance-btn" type="button" data-slot="${slot}" ${afford ? '' : 'disabled'}>
          🔩 ${cost.toLocaleString()} 소모하고 강화
        </button>
      `;
    }

    card.innerHTML = `
      <div class="enhance-card-title">${ENHANCE_SLOT_LABEL[slot]} <span style="color:${rarity.color}">[${rarity.name}]${current > 0 ? ` +${current}` : ''}</span></div>
      <div class="enhance-desc">${equipItemLabel(item)}</div>
      ${body}
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.enhance-btn[data-slot]').forEach(btn => {
    btn.addEventListener('click', () => attemptEnhance(btn.dataset.slot));
  });
  grid.querySelectorAll('.enhance-scroll-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const slot = chk.dataset.slot, field = chk.dataset.field;
      if(!enhanceScrollSelection[slot]) enhanceScrollSelection[slot] = {rateUp:false, protect:false};
      enhanceScrollSelection[slot][field] = chk.checked;
      renderEnhancePanel();
    });
  });
}
