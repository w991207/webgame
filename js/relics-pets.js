// ---------- Relics ----------
function relicPullCost(){
  return Math.round(8 * Math.pow(1.035, state.totalRelicPulls));
}

function pullRelic(){
  const cost = relicPullCost();
  if(state.fragments < cost) return;
  state.fragments -= cost;
  state.totalRelicPulls++;
  const picked = RELICS[Math.floor(Math.random()*RELICS.length)];
  state.relics[picked.key]++;
  const newLvl = state.relics[picked.key];
  log(`유물 뽑기: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
  renderAll();
}
document.getElementById('pullRelicBtn').addEventListener('click', pullRelic);

function renderRelics(){
  const cost = relicPullCost();
  document.getElementById('fragDisplay').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('fragDisplay2').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('pullCostText').textContent = cost.toLocaleString();
  document.getElementById('pullRelicBtn').disabled = state.fragments < cost;

  const grid = document.getElementById('relicGrid');
  grid.innerHTML = '';
  RELICS.forEach(r=>{
    const lvl = state.relics[r.key];
    const owned = lvl > 0;
    const value = Math.round(lvl * r.perLevel * 10) / 10;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'');
    card.innerHTML = `
      <div class="rname"><span>${r.icon} ${r.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${r.descFn(owned ? value : r.perLevel)}${owned?'':' (미보유)'}</div>
    `;
    grid.appendChild(card);
  });
}

// ---------- Pets ----------
function petSummonCost(){
  return Math.round(12 * Math.pow(1.04, state.totalPetSummons));
}

function summonPet(){
  const cost = petSummonCost();
  if(state.fragments < cost) return;
  state.fragments -= cost;
  state.totalPetSummons++;
  const picked = PETS[Math.floor(Math.random()*PETS.length)];
  state.pets[picked.key] = (state.pets[picked.key]||0) + 1;
  const newLvl = state.pets[picked.key];
  log(`펫 소환: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
  renderAll();
}
document.getElementById('summonPetBtn').addEventListener('click', summonPet);

function renderPets(){
  const cost = petSummonCost();
  document.getElementById('fragDisplay3').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('petCostText').textContent = cost.toLocaleString();
  document.getElementById('summonPetBtn').disabled = state.fragments < cost;

  const grid = document.getElementById('petGrid');
  grid.innerHTML = '';
  PETS.forEach(p=>{
    const lvl = state.pets[p.key] || 0;
    const owned = lvl > 0;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'');
    card.innerHTML = `
      <div class="rname"><span>${p.icon} ${p.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${p.descFn(owned ? lvl : 1)}${owned?'':' (미보유)'}</div>
    `;
    grid.appendChild(card);
  });
}

let petTimers = {};
function petTick(){
  if(state.playerHp <= 0) return;
  const s = stats();
  let changed = false;
  PETS.forEach(p=>{
    const lvl = state.pets[p.key] || 0;
    if(lvl <= 0) return;
    petTimers[p.key] = (petTimers[p.key]||0) + 1;
    if(petTimers[p.key] >= p.interval){
      petTimers[p.key] = 0;
      p.trigger(lvl, s);
      changed = true;
    }
  });
  if(changed) renderAll();
}

