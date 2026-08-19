// ---------- Costumes (코스튬) ----------
// 잡화상점에서 물자로 구매해 영구 보유하는 외형 아이템. 보유한 것 중 하나만 장착 가능하며
// (칭호와 동일한 "택 1" 구조), 장착한 코스튬의 스탯 보너스만 적용되고 전투화면 플레이어
// 스프라이트도 해당 코스튬의 이미지로 바뀐다. 미장착(equippedCostume===null) 시 기본
// knight.png를 사용한다.

function costumeOwned(key){
  return !!(state.ownedCostumes && state.ownedCostumes[key]);
}

function costumeBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  if(!state.equippedCostume) return b;
  const c = COSTUMES.find(x => x.key === state.equippedCostume);
  if(!c || !costumeOwned(c.key)) return b; // 비정상 상태(보유하지 않은 코스튬이 장착돼있음) 방지
  Object.keys(c.stats || {}).forEach(k => { b[k] = (b[k]||0) + c.stats[k]; });
  return b;
}

function costumeEffectText(c){
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%', accuracyAdd:''};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도', accuracyAdd:'명중률'};
  return Object.keys(c.stats || {}).map(k => `${labelMap[k]||k} +${c.stats[k]}${unitMap[k]||''}`).join(', ');
}

function buyCostume(key){
  const c = COSTUMES.find(x => x.key === key);
  if(!c) return;
  if(costumeOwned(key)){ flashMessageSafe('이미 보유한 코스튬입니다.'); return; }
  if(state.gold < c.cost){ flashMessageSafe('물자가 부족합니다.'); return; }

  state.gold -= c.cost;
  if(!state.ownedCostumes) state.ownedCostumes = {};
  state.ownedCostumes[key] = true;
  log(`👕 코스튬 구매: ${c.icon} ${c.name}`, 'good');
  renderCostumeShop();
  renderCostumeGrid();
  renderAll();
}

function equipCostume(key){
  if(key !== null && !costumeOwned(key)) return;
  state.equippedCostume = (state.equippedCostume === key) ? null : key;
  updatePlayerCostumeSprite();
  renderCostumeGrid();
  renderAll();
}

// 전투화면의 플레이어 스프라이트 <img> src를 현재 장착 코스튬 이미지로 교체.
// 이미지가 없거나 로드 실패 시 index.html의 onerror가 이모지로 자동 대체한다.
function updatePlayerCostumeSprite(){
  const img = document.querySelector('#playerSprite .player-sprite-img');
  const emojiEl = document.querySelector('#playerSprite .player-sprite-emoji');
  if(!img) return;

  const c = state.equippedCostume ? COSTUMES.find(x => x.key === state.equippedCostume) : null;
  const src = (c && c.img) ? c.img : 'image/player/knight.png';
  const emoji = (c && c.icon) ? c.icon : '🗡️';

  img.style.display = '';
  if(emojiEl){ emojiEl.style.display = 'none'; emojiEl.textContent = emoji; }
  img.src = src;
}

// ---------- 상점 렌더 (잡화상점 → 코스튬) ----------
function renderCostumeShop(){
  const el = document.getElementById('costumeShop');
  if(!el) return;

  el.innerHTML = COSTUMES.map(c => {
    const owned = costumeOwned(c.key);
    const afford = state.gold >= c.cost;
    return `
      <div class="shop-item">
        <div class="info">
          <div class="name">${c.icon} ${c.name}${owned ? ' <span class="potion-active-tag">보유중</span>' : ''}</div>
          <div class="desc">${c.desc} · ${costumeEffectText(c)}</div>
        </div>
        <button class="buy" data-key="${c.key}" ${(owned || !afford) ? 'disabled' : ''}>${owned ? '보유중' : c.cost.toLocaleString() + ' 📦 구매'}</button>
      </div>`;
  }).join('');

  el.querySelectorAll('button[data-key]').forEach(btn => {
    btn.addEventListener('click', () => buyCostume(btn.dataset.key));
  });
}

// ---------- 성장 탭 코스튬 그리드 (칭호 그리드와 동일한 카드 UI 재사용) ----------
function renderCostumeGrid(){
  const grid = document.getElementById('costumeGrid');
  if(!grid) return;
  const ownedCount = COSTUMES.filter(c => costumeOwned(c.key)).length;
  const countEl = document.getElementById('costumeOwnedCount');
  if(countEl) countEl.textContent = `${ownedCount} / ${COSTUMES.length}`;

  grid.innerHTML = '';
  COSTUMES.forEach(c => {
    const owned = costumeOwned(c.key);
    const equipped = state.equippedCostume === c.key;
    const card = document.createElement('div');
    card.className = 'relic-card title-card' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');
    card.innerHTML = `
      <div class="rname"><span>${c.icon} ${c.name}</span>${equipped ? '<span class="title-equipped-tag">장착중</span>' : ''}</div>
      <div class="rdesc">${costumeEffectText(c)}</div>
      <div class="title-cond">${owned ? '✅ 보유중' : `🔒 ${c.cost.toLocaleString()} 📦 (잡화상점에서 구매)`}</div>
      ${owned ? `<button class="title-equip-btn ${equipped ? 'unequip' : ''}" data-key="${c.key}">${equipped ? '해제' : '장착'}</button>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.title-equip-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => equipCostume(btn.dataset.key));
  });
}
