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

  const needsFullBuild = container.children.length !== GOLD_UPGRADES.length
    || container.dataset.builtMult !== String(shopBuyMultiplier);

  if(needsFullBuild){
    container.innerHTML = '';
    container.dataset.builtMult = String(shopBuyMultiplier);

    GOLD_UPGRADES.forEach(u=>{
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.key = u.key;
      row.innerHTML = `
        <div class="info">
          <div class="name"><span class="uname"></span> <span class="lvl-tag"></span></div>
          <div class="desc">${u.desc}</div>
        </div>
        <button class="buy" data-key="${u.key}"></button>
      `;
      container.appendChild(row);

      const btn = row.querySelector('button');
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
    });
  }

  // 매번 여기서부터: 기존 요소는 그대로 두고 텍스트/비활성화 상태만 갱신 (클릭 씹힘 방지)
  GOLD_UPGRADES.forEach(u=>{
    const row = container.querySelector(`.shop-item[data-key="${u.key}"]`);
    if(!row) return;

    const lvl = state.goldUpgrades[u.key] || 0;
    const maxed = u.maxLevel && lvl >= u.maxLevel;
    const remainToMax = u.maxLevel ? Math.max(0, u.maxLevel - lvl) : Infinity;
    const buyN = Math.min(shopBuyMultiplier, remainToMax);
    const cost = bulkCost(u.baseCost, u.mult, lvl, buyN);
    const label = maxed ? '최대' : (buyN <= 0 ? '최대' : `${cost.toLocaleString()} 📦 (x${buyN})`);

    row.querySelector('.uname').textContent = u.name;
    row.querySelector('.lvl-tag').textContent = `Lv.${lvl}`;

    const btn = row.querySelector('button');
    const disabled = maxed || buyN <= 0 || state.gold < cost;
    if(btn.disabled !== disabled) btn.disabled = disabled;
    if(btn.textContent !== label) btn.textContent = label;
  });
}

// 혈청 영구 강화 비용 (레벨이 오를수록 mult배씩 지수적으로 상승).
// 예전엔 "레벨+2"라는 선형 비용이라 환생을 거듭할수록 혈청이 소모처 없이 쌓이기만 했던 문제를 고침.
function soulUpgradeCost(u, lvl){
  return lvl+2;
}

function renderSoulShop(){
  const container = document.getElementById('soulShopList');

  const needsFullBuild = container.children.length !== SOUL_UPGRADES.length;

  if(needsFullBuild){
    container.innerHTML = '';
    SOUL_UPGRADES.forEach(u=>{
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.key = u.key;
      row.innerHTML = `
        <div class="info">
          <div class="name"><span class="uname"></span> <span class="lvl-tag"></span></div>
          <div class="desc">${u.desc}</div>
        </div>
        <button class="buy soul" data-key="${u.key}"></button>
      `;
      container.appendChild(row);

      const btn = row.querySelector('button');
      btn.addEventListener('click', ()=>{
        const cost = soulUpgradeCost(u, state.soulUpgrades[u.key]);
        if(state.soul >= cost){
          state.soul -= cost;
          state.soulUpgrades[u.key]++;
          log(`${u.name} 영구 강화! (Lv.${state.soulUpgrades[u.key]})`, 'good');
          renderAll();
        }
      });
    });
  }

  SOUL_UPGRADES.forEach(u=>{
    const row = container.querySelector(`.shop-item[data-key="${u.key}"]`);
    if(!row) return;
    const lvl = state.soulUpgrades[u.key];
    const cost = soulUpgradeCost(u, lvl);

    row.querySelector('.uname').textContent = u.name;
    row.querySelector('.lvl-tag').textContent = `Lv.${lvl}`;

    const btn = row.querySelector('button');
    const label = `${cost.toLocaleString()} 🧪`;
    const disabled = state.soul < cost;
    if(btn.disabled !== disabled) btn.disabled = disabled;
    if(btn.textContent !== label) btn.textContent = label;
  });
}