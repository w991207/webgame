let shopBuyMultiplier = 1;
document.querySelectorAll('.buy-mult-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    shopBuyMultiplier = parseInt(btn.dataset.mult, 10);
    document.querySelectorAll('.buy-mult-btn').forEach(b=>b.classList.toggle('active', b===btn));
    renderShop();
  });
});

// n레벨을 한 번에 살 때의 누적 비용 (등비수열 합)
function bulkCost(baseCost, mult, startLvl, n){
  if(n <= 0) return 0;
  if(Math.abs(mult - 1) < 1e-9) return Math.round(baseCost * n);
  const startCost = baseCost * Math.pow(mult, startLvl);
  return Math.round(startCost * (Math.pow(mult, n) - 1) / (mult - 1));
}

function renderShop(){
  const container = document.getElementById('shopList');
  container.innerHTML = '';
  GOLD_UPGRADES.forEach(u=>{
    const lvl = state.goldUpgrades[u.key] || 0;
    const maxed = u.maxLevel && lvl >= u.maxLevel;
    const remainToMax = u.maxLevel ? Math.max(0, u.maxLevel - lvl) : Infinity;
    const buyN = Math.min(shopBuyMultiplier, remainToMax);
    const cost = bulkCost(u.baseCost, u.mult, lvl, buyN);
    const label = maxed ? '최대' : (buyN <= 0 ? '최대' : `${cost.toLocaleString()} 🪙 (x${buyN})`);
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <div class="info">
        <div class="name">${u.name} <span class="lvl-tag">Lv.${lvl}</span></div>
        <div class="desc">${u.desc}</div>
      </div>
      <button class="buy" ${(maxed||buyN<=0)? 'disabled':''} data-key="${u.key}">${label}</button>
    `;
    container.appendChild(row);
    const btn = row.querySelector('button');
    if(!maxed && buyN > 0){
      btn.disabled = state.gold < cost;
      btn.addEventListener('click', ()=>{
        const remain = u.maxLevel ? Math.max(0, u.maxLevel - (state.goldUpgrades[u.key]||0)) : Infinity;
        const n = Math.min(shopBuyMultiplier, remain);
        const totalCost = bulkCost(u.baseCost, u.mult, state.goldUpgrades[u.key]||0, n);
        if(n > 0 && state.gold >= totalCost){
          state.gold -= totalCost;
          state.goldUpgrades[u.key] = (state.goldUpgrades[u.key] || 0) + n;
          state.dailyUpgradesBought += n;
          log(`${u.name} 강화! (Lv.${state.goldUpgrades[u.key]}, +${n})`);
          if(!state.maxCritAnnounced && (state.goldUpgrades.critChance||0) >= 100 && (state.goldUpgrades.critDamage||0) >= 100){
            state.maxCritAnnounced = true;
            log('⚡ 맥스 치명타 달성! 치명타 확률 100%, 치명타 피해 최대치에 도달했습니다!', 'good');
          }
          renderAll();
        }
      });
    }
  });
}

function renderSoulShop(){
  const container = document.getElementById('soulShopList');
  container.innerHTML = '';
  SOUL_UPGRADES.forEach(u=>{
    const lvl = state.soulUpgrades[u.key];
    const cost = lvl+2;
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <div class="info">
        <div class="name">${u.name} <span class="lvl-tag">Lv.${lvl}</span></div>
        <div class="desc">${u.desc}</div>
      </div>
      <button class="buy soul" data-key="${u.key}">${cost.toLocaleString()} ✦</button>
    `;
    container.appendChild(row);
    const btn = row.querySelector('button');
    btn.disabled = state.soul < cost;
    btn.addEventListener('click', ()=>{
      if(state.soul >= cost){
        state.soul -= cost;
        state.soulUpgrades[u.key]++;
        log(`${u.name} 영구 강화! (Lv.${state.soulUpgrades[u.key]})`, 'good');
        renderAll();
      }
    });
  });
}

