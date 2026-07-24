// ---------- Equipment (장비 뽑기 시스템) ----------
// 골드로 뽑는 무기/방어구 2슬롯 장비. 뽑기 등급(초급~전설)이 높을수록 비용이 크게 오르는 대신
// 더 높은 희귀도(일반/희귀/영웅/전설)와 좋은 옵션이 나올 확률이 오른다.

let equipPullMultiplier = 1;
document.querySelectorAll('.equip-mult-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    equipPullMultiplier = parseInt(btn.dataset.mult, 10);
    document.querySelectorAll('.equip-mult-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderEquipment();
  });
});

// 보유 장비 목록은 기본적으로 접혀 있고, 제목을 클릭하면 펼쳐진다 (기본 접힘: 계속 쌓이는 목록이
// 화면을 밀어내리는 문제를 막기 위함). 펼쳐진 상태에서도 최대 높이를 넘으면 내부 스크롤 처리.
let equipInvExpanded = false;
document.getElementById('equipInvHeader')?.addEventListener('click', () => {
  equipInvExpanded = !equipInvExpanded;
  renderEquipment();
});

function rand(min, max){ return min + Math.random() * (max - min); }

function weightedPickRarity(weights){
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for(const [key, w] of entries){
    if(r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function equipGachaCost(tierKey){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const n = (state.equipPullCounts && state.equipPullCounts[tierKey]) || 0;
  return Math.round(tier.baseCost * Math.pow(tier.costMult, n));
}

// n회를 연속으로 뽑을 때의 누적 비용 (뽑을 때마다 costMult만큼 비용이 오르는 것을 반영)
function equipMultiPullCost(tierKey, n){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const startN = (state.equipPullCounts && state.equipPullCounts[tierKey]) || 0;
  let total = 0;
  for(let i = 0; i < n; i++){
    total += Math.round(tier.baseCost * Math.pow(tier.costMult, startN + i));
  }
  return total;
}

function isTierUnlocked(tier){
  if(!tier.unlockReq) return true;
  const done = (state.equipPullCounts && state.equipPullCounts[tier.unlockReq.tier]) || 0;
  return done >= tier.unlockReq.count;
}

function tierOddsText(tier){
  return EQUIP_RARITIES
    .filter(r => tier.weights[r.key] > 0)
    .map(r => `${r.name} ${tier.weights[r.key]}%`)
    .join(' · ');
}

function rollEquipment(slot, tierKey){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const rarityKey = weightedPickRarity(tier.weights);
  const rarity = EQUIP_RARITIES.find(r => r.key === rarityKey);
  const mainValue = Math.round(rand(rarity.mainMin, rarity.mainMax) * 10) / 10;
  let subKey = null, subValue = 0;
  if(rarity.subMax > 0){
    const pool = slot === 'weapon' ? WEAPON_SUBSTATS : ARMOR_SUBSTATS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    subKey = picked.key;
    subValue = Math.round(rand(rarity.subMin, rarity.subMax) * 10) / 10;
  }
  return {
    id: 'eq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    slot,
    rarity: rarityKey,
    mainValue,
    subKey,
    subValue,
    createdAt: Date.now(),
  };
}

function equipItemLabel(item){
  const mainName = item.slot === 'weapon' ? '공격력' : '방어력';
  let text = `${mainName} +${item.mainValue}%`;
  if(item.subKey){
    const pool = item.slot === 'weapon' ? WEAPON_SUBSTATS : ARMOR_SUBSTATS;
    const sub = pool.find(p => p.key === item.subKey);
    text += ` · ${sub.name} +${item.subValue}${sub.unit}`;
  }
  return text;
}

function pullEquipment(tierKey, slot){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  if(!isTierUnlocked(tier)) return;
  const cost = equipGachaCost(tierKey);
  if(state.gold < cost) return;
  state.gold -= cost;
  state.equipPullCounts[tierKey] = (state.equipPullCounts[tierKey] || 0) + 1;
  const item = rollEquipment(slot, tierKey);
  state.equipInventory.push(item);
  const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
  const slotName = slot === 'weapon' ? '무기' : '방어구';
  const cls = (item.rarity === 'epic' || item.rarity === 'legendary') ? 'good' : undefined;
  log(`🎰 장비 뽑기: [${rarity.name}] ${slotName} 획득 — ${equipItemLabel(item)}`, cls);
  renderAll();
}

function pullEquipmentMulti(tierKey, slot, n){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  if(!isTierUnlocked(tier)) return;
  const totalCost = equipMultiPullCost(tierKey, n);
  if(state.gold < totalCost) return;
  state.gold -= totalCost;
  const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
  const counts = {common:0, rare:0, epic:0, legendary:0};
  let bestRarity = 'common';
  for(let i = 0; i < n; i++){
    state.equipPullCounts[tierKey] = (state.equipPullCounts[tierKey] || 0) + 1;
    const item = rollEquipment(slot, tierKey);
    state.equipInventory.push(item);
    counts[item.rarity]++;
    if(rarityOrder.indexOf(item.rarity) > rarityOrder.indexOf(bestRarity)) bestRarity = item.rarity;
  }
  const slotName = slot === 'weapon' ? '무기' : '방어구';
  const summary = EQUIP_RARITIES.filter(r => counts[r.key] > 0).map(r => `${r.name} x${counts[r.key]}`).join(', ');
  const cls = (bestRarity === 'epic' || bestRarity === 'legendary') ? 'good' : undefined;
  log(`🎰 ${n}연 장비 뽑기 (${slotName}): ${summary}`, cls);
  renderAll();
}

function equipItem(id){
  const idx = state.equipInventory.findIndex(i => i.id === id);
  if(idx < 0) return;
  const item = state.equipInventory[idx];
  const prev = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  state.equipInventory.splice(idx, 1);
  if(prev) state.equipInventory.push(prev);
  log(`${item.slot === 'weapon' ? '무기' : '방어구'} 장착: ${equipItemLabel(item)}`, 'good');
  renderAll();
}

function unequipItem(slot){
  const item = state.equipment[slot];
  if(!item) return;
  state.equipment[slot] = null;
  state.equipInventory.push(item);
  renderAll();
}

function sellEquipment(id){
  const idx = state.equipInventory.findIndex(i => i.id === id);
  if(idx < 0) return;
  const item = state.equipInventory[idx];
  const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
  const sellValue = rarity.sellBase;
  state.equipInventory.splice(idx, 1);
  state.gold += sellValue;
  log(`장비 판매: [${rarity.name}] ${item.slot === 'weapon' ? '무기' : '방어구'} → +${sellValue.toLocaleString()}🪙`);
  renderAll();
}

// 미장착 장비를 등급 단위로 한 번에 정리. 전설 등급은 실수로 한꺼번에 팔리지 않도록 제외(개별 판매만 가능).
function sellEquipmentByRarity(rarityKey){
  if(rarityKey === 'legendary') return;
  const items = state.equipInventory.filter(i => i.rarity === rarityKey);
  if(items.length === 0) return;
  const rarity = EQUIP_RARITIES.find(r => r.key === rarityKey);
  const total = items.length * rarity.sellBase;
  state.equipInventory = state.equipInventory.filter(i => i.rarity !== rarityKey);
  state.gold += total;
  log(`장비 일괄 판매: [${rarity.name}] ${items.length}개 → +${total.toLocaleString()}🪙`);
  renderAll();
}

function renderEquipRarityInfo(){
  const box = document.getElementById('equipRarityInfo');
  if(!box) return;
  const rows = EQUIP_RARITIES.map(r => `
    <div class="equip-info-row">
      <span class="equip-info-rarity" style="color:${r.color}">● ${r.name}</span>
      <span class="equip-info-detail">메인옵션 +${r.mainMin}~${r.mainMax}%${r.subMax > 0 ? ` · 서브옵션 +${r.subMin}~${r.subMax}` : ' · 서브옵션 없음'}</span>
    </div>
  `).join('');
  box.innerHTML = `<div class="equip-info-title">📊 등급별 옵션 범위 (무기=공격력% / 방어구=방어력%)</div>${rows}`;
}

function renderEquipment(){
  ['weapon', 'armor'].forEach(slot => {
    const item = state.equipment[slot];
    const box = document.getElementById(slot === 'weapon' ? 'equipWeaponSlot' : 'equipArmorSlot');
    if(!box) return;
    const slotLabel = slot === 'weapon' ? '⚔️ 무기' : '🛡️ 방어구';
    if(item){
      const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
      box.className = 'equip-slot filled rarity-' + item.rarity;
      box.innerHTML = `
        <div class="eq-rarity" style="color:${rarity.color}">${rarity.name}</div>
        <div class="eq-slot-name">${slotLabel}</div>
        <div class="eq-desc">${equipItemLabel(item)}</div>
        <button class="eq-unequip-btn" type="button">해제</button>
      `;
      box.querySelector('.eq-unequip-btn').addEventListener('click', () => unequipItem(slot));
    } else {
      box.className = 'equip-slot empty';
      box.innerHTML = `
        <div class="eq-slot-name">${slotLabel}</div>
        <div class="eq-desc" style="color:var(--text-dim);">비어 있음</div>
      `;
    }
  });

  const tierList = document.getElementById('gachaTierList');
  if(tierList){
    tierList.innerHTML = '';
    GACHA_TIERS.forEach(tier => {
      const row = document.createElement('div');
      row.className = 'shop-item';
      if(!isTierUnlocked(tier)){
        const req = tier.unlockReq;
        const reqTierName = GACHA_TIERS.find(t => t.key === req.tier).name;
        const done = Math.min(req.count, (state.equipPullCounts && state.equipPullCounts[req.tier]) || 0);
        row.classList.add('locked-tier');
        row.innerHTML = `
          <div class="info">
            <div class="name">🔒 ${tier.name}</div>
            <div class="desc">${reqTierName}을(를) ${req.count}회 뽑으면 해금 (진행도 ${done}/${req.count})</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="buy" type="button" disabled>🔒 잠김</button>
          </div>
        `;
        tierList.appendChild(row);
        return;
      }
      const cost = equipPullMultiplier > 1 ? equipMultiPullCost(tier.key, equipPullMultiplier) : equipGachaCost(tier.key);
      const multLabel = equipPullMultiplier > 1 ? ` x${equipPullMultiplier}` : '';
      row.innerHTML = `
        <div class="info">
          <div class="name">${tier.name}</div>
          <div class="desc">${tierOddsText(tier)}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="buy" type="button" data-slot="weapon">⚔️${multLabel} ${cost.toLocaleString()}🪙</button>
          <button class="buy" type="button" data-slot="armor">🛡️${multLabel} ${cost.toLocaleString()}🪙</button>
        </div>
      `;
      tierList.appendChild(row);
      row.querySelectorAll('button').forEach(btn => {
        btn.disabled = state.gold < cost;
        btn.addEventListener('click', () => {
          if(equipPullMultiplier > 1) pullEquipmentMulti(tier.key, btn.dataset.slot, equipPullMultiplier);
          else pullEquipment(tier.key, btn.dataset.slot);
        });
      });
    });
  }

  renderEquipRarityInfo();

  const grid = document.getElementById('equipInventoryGrid');
  const invCountEl = document.getElementById('equipInvCount');
  const invToggleIcon = document.getElementById('equipInvToggleIcon');
  const invActions = document.getElementById('equipInvActions');

  if(invCountEl) invCountEl.textContent = `(${state.equipInventory.length}개)`;
  if(invToggleIcon) invToggleIcon.textContent = equipInvExpanded ? '▲' : '▼';

  if(invActions){
    if(!equipInvExpanded || state.equipInventory.length === 0){
      invActions.style.display = 'none';
      invActions.innerHTML = '';
    } else {
      const counts = {common:0, rare:0, epic:0, legendary:0};
      state.equipInventory.forEach(i => counts[i.rarity]++);
      const sellable = EQUIP_RARITIES.filter(r => r.key !== 'legendary' && counts[r.key] > 0);
      if(sellable.length === 0){
        invActions.style.display = 'none';
        invActions.innerHTML = '';
      } else {
        invActions.style.display = 'flex';
        invActions.innerHTML = sellable.map(r => `<button type="button" data-rarity="${r.key}">[${r.name}] 전체 판매 (${counts[r.key]}개)</button>`).join('');
        invActions.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => sellEquipmentByRarity(btn.dataset.rarity));
        });
      }
    }
  }

  if(grid){
    grid.style.display = equipInvExpanded ? 'grid' : 'none';
    if(equipInvExpanded){
      grid.innerHTML = '';
      if(state.equipInventory.length === 0){
        grid.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:6px 2px;">보유한 미장착 장비가 없습니다.</div>';
      } else {
        const rarityRank = {legendary:3, epic:2, rare:1, common:0};
        const sorted = [...state.equipInventory].sort((a, b) => {
          const rd = rarityRank[b.rarity] - rarityRank[a.rarity];
          if(rd !== 0) return rd;
          if(b.mainValue !== a.mainValue) return b.mainValue - a.mainValue;
          return b.createdAt - a.createdAt;
        });
        sorted.forEach(item => {
          const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
          const card = document.createElement('div');
          card.className = 'relic-card equip-card rarity-' + item.rarity;
          card.innerHTML = `
            <div class="rname"><span style="color:${rarity.color}">[${rarity.name}] ${item.slot === 'weapon' ? '⚔️ 무기' : '🛡️ 방어구'}</span></div>
            <div class="rdesc">${equipItemLabel(item)}</div>
            <div class="eq-card-btns">
              <button class="eq-equip-btn" type="button">장착</button>
              <button class="eq-sell-btn" type="button">판매 (${rarity.sellBase.toLocaleString()}🪙)</button>
            </div>
          `;
          grid.appendChild(card);
          card.querySelector('.eq-equip-btn').addEventListener('click', () => equipItem(item.id));
          card.querySelector('.eq-sell-btn').addEventListener('click', () => sellEquipment(item.id));
        });
      }
    }
  }
}
