// ---------- 인벤토리(상태창) 모달 ----------
// 모험가 패널의 "🎒 인벤토리" 버튼으로 열리는 상태창. 기본 장비(무기/방어구/장신구) 3부위는
// 이 화면에서 바로 장착/해제할 수 있고, 레이드 장비(제작형 4부위, equipment.js의 RAID_GEAR)는
// 장착/해제 개념이 없는 상시 적용 스탯이라 열람 전용으로 보여준다.
// 우측 그리드에는 뽑기로 획득해 미장착 상태인 state.equipInventory 아이템들을 아이콘 카드로 보여준다.

let inventoryModalOpen = false;
let invSelectedItemId = null; // 그리드에서 클릭해 액션 팝오버가 열려있는 아이템

const INV_SLOT_LABEL = {weapon:'무기', armor:'방어구', accessory:'장신구'};
function invIconImg(src, alt){ return `<img src="${src}" class="asset-icon-md" alt="${alt||''}">`; }

function openInventoryModal(){
  inventoryModalOpen = true;
  document.getElementById('inventoryModal').style.display = 'flex';
  renderInventoryModal();
}

function closeInventoryModal(){
  inventoryModalOpen = false;
  document.getElementById('inventoryModal').style.display = 'none';
}

document.getElementById('openInventoryBtn')?.addEventListener('click', openInventoryModal);
document.getElementById('inventoryCloseBtn')?.addEventListener('click', closeInventoryModal);
document.getElementById('inventoryModal')?.addEventListener('click', (e) => {
  if(e.target.id === 'inventoryModal') closeInventoryModal();
});

document.getElementById('invSortBtn')?.addEventListener('click', () => {
  const rarityRank = {transcendent:5, mythic:4, legendary:3, epic:2, rare:1, common:0};
  state.equipInventory.sort((a, b) => {
    const rd = rarityRank[b.rarity] - rarityRank[a.rarity];
    if(rd !== 0) return rd;
    if((b.enhance||0) !== (a.enhance||0)) return (b.enhance||0) - (a.enhance||0);
    return b.mainValue - a.mainValue;
  });
  renderInventoryModal();
});

document.getElementById('invGachaBtn')?.addEventListener('click', () => {
  closeInventoryModal();
  document.querySelector('.tab-nav-btn[data-tab="tab-gear"]')?.click();
  document.getElementById('gachaTierList')?.scrollIntoView({behavior:'smooth', block:'start'});
});

function renderInventoryModal(){
  if(!inventoryModalOpen) return;

  document.getElementById('invCpValue').textContent = document.getElementById('cpValue')?.textContent || '0';

  // 캐릭터 장비 슬롯 (무기/방어구/장신구) — equipItem/unequipItem 재사용
  const slotBox = document.getElementById('invEquipSlots');
  if(slotBox){
    slotBox.innerHTML = '';
    ['weapon', 'armor', 'accessory'].forEach(slot => {
      const item = state.equipment[slot];
      const cell = document.createElement('div');
      if(item){
        const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
        const enh = item.enhance || 0;
        cell.className = 'inv-slot filled rarity-' + item.rarity;
        cell.innerHTML = `
          <div class="inv-slot-icon">${invIconImg(SLOT_IMG[slot], slot)}</div>
          ${enh > 0 ? `<div class="inv-slot-enh">+${enh}</div>` : ''}
          <div class="inv-slot-name" style="color:${rarity.color}">${rarity.name}</div>
          <button class="inv-slot-unequip" type="button">해제</button>
        `;
        cell.querySelector('.inv-slot-unequip').addEventListener('click', () => unequipItem(slot));
      } else {
        cell.className = 'inv-slot empty';
        cell.innerHTML = `
          <div class="inv-slot-icon">${invIconImg(SLOT_IMG[slot], slot)}</div>
          <div class="inv-slot-name">${INV_SLOT_LABEL[slot]}</div>
        `;
      }
      slotBox.appendChild(cell);
    });
  }

  // 레이드 장비 (제작형, 항상 적용 — 장착/해제 없음, 레벨만 표시)
  const raidBox = document.getElementById('invRaidSlots');
  if(raidBox && typeof RAID_GEAR !== 'undefined'){
    raidBox.innerHTML = '';
    RAID_GEAR.forEach(g => {
      const lvl = (state.raidGear && state.raidGear[g.key]) || 0;
      const cell = document.createElement('div');
      cell.className = 'inv-slot' + (lvl > 0 ? ' filled raid-owned' : ' empty');
      cell.innerHTML = `
        <div class="inv-slot-icon">${invIconImg(g.img, g.name)}</div>
        <div class="inv-slot-name">${g.name}</div>
        <div class="inv-slot-lvl">Lv.${lvl}/${g.maxLevel}</div>
      `;
      raidBox.appendChild(cell);
    });
  }

  // 우측 그리드: 미장착 보유 장비
  const grid = document.getElementById('invIconGrid');
  const countEl = document.getElementById('invGridCount');
  if(countEl) countEl.textContent = `${state.equipInventory.length}/20`;
  if(grid){
    grid.innerHTML = '';
    if(state.equipInventory.length === 0){
      grid.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:8px 2px;grid-column:1/-1;">보유한 미장착 장비가 없습니다. [아이템 획득]에서 뽑아보세요.</div>';
      return;
    }
    state.equipInventory.forEach(item => {
      const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
      const enh = item.enhance || 0;
      const cell = document.createElement('div');
      cell.className = 'inv-cell rarity-' + item.rarity;
      cell.innerHTML = `
        <div class="inv-cell-icon">${invIconImg(SLOT_IMG[item.slot], item.slot)}</div>
        ${enh > 0 ? `<div class="inv-cell-badge">+${enh}</div>` : ''}
      `;
      cell.title = `[${rarity.name}] ${INV_SLOT_LABEL[item.slot]} · ${equipItemLabel(item)}`;
      cell.addEventListener('click', () => {
        invSelectedItemId = (invSelectedItemId === item.id) ? null : item.id;
        renderInventoryModal();
      });
      grid.appendChild(cell);

      if(invSelectedItemId === item.id){
        const pop = document.createElement('div');
        pop.className = 'inv-cell-popover';
        pop.innerHTML = `
          <div class="inv-pop-title" style="color:${rarity.color}">[${rarity.name}] ${INV_SLOT_LABEL[item.slot]}</div>
          <div class="inv-pop-desc">${equipItemLabel(item)}</div>
          <div class="inv-pop-btns">
            <button type="button" class="inv-pop-equip">장착</button>
            <button type="button" class="inv-pop-sell">판매 (${rarity.sellBase.toLocaleString()}📦)</button>
          </div>
        `;
        pop.querySelector('.inv-pop-equip').addEventListener('click', () => { invSelectedItemId = null; equipItem(item.id); });
        pop.querySelector('.inv-pop-sell').addEventListener('click', () => { invSelectedItemId = null; sellEquipment(item.id); });
        grid.appendChild(pop);
      }
    });
  }
}
