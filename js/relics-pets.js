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
  log(`유산 뽑기: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
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
  log(`동료 소환: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
  renderAll();
}
document.getElementById('summonPetBtn').addEventListener('click', summonPet);

// ---------- 동행 (Companion) ----------
// 보유한 동료 중 하나를 "동행"으로 지정하면, 그 동료 종류별로 다른 능력치 보너스를 영구 적용받는다.
// 기존 주기 발동 효과(petTick)는 동행 여부와 무관하게 보유한 모든 동료가 그대로 계속 작동하며,
// 동행 보너스는 그 위에 추가로 붙는 별도 효과다. 레벨이 높을수록 동행 보너스도 커진다.
function companionBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  if(!state.companionPet) return b;
  const p = PETS.find(x => x.key === state.companionPet);
  const lvl = state.pets && state.pets[state.companionPet];
  if(!p || !p.companionStat || !(lvl > 0)) return b;
  b[p.companionStat] += p.companionValueFn(lvl);
  return b;
}

function companionEffectText(p){
  const lvl = (state.pets && state.pets[p.key]) || 1;
  const value = p.companionValueFn(lvl);
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%', accuracyAdd:''};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도', accuracyAdd:'명중률'};
  return `동행 시 ${labelMap[p.companionStat]} +${value}${unitMap[p.companionStat]}`;
}

function setCompanion(key){
  if(!state.pets || !(state.pets[key] > 0)) return;
  state.companionPet = (state.companionPet === key) ? null : key;
  applyCompanionSprite();
  renderAll();
}

// 전투 화면의 캐릭터 옆에 동행 중인 동료 아이콘을 작게 띄운다 (전용 아트가 없어 이모지로 표시).
function applyCompanionSprite(){
  const el = document.getElementById('companionSprite');
  if(!el) return;
  const key = state.companionPet;
  const lvl = key && state.pets && state.pets[key];
  if(!key || !(lvl > 0)){
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  const p = PETS.find(x => x.key === key);
  el.innerHTML = p ? petIconHtml(p, 26) : '';
  el.style.display = p ? 'block' : 'none';
}

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
    const isCompanion = state.companionPet === p.key;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'') + (isCompanion?' equipped':'');
    card.innerHTML = `
      <div class="rname"><span>${petIconHtml(p, 16)} ${p.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${p.descFn(owned ? lvl : 1)}${owned?'':' (미보유)'}</div>
      ${owned && p.companionStat ? `<div class="rdesc" style="color:var(--gold);">${companionEffectText(p)}</div>` : ''}
      ${owned && p.companionStat ? `<button class="title-equip-btn ${isCompanion?'unequip':''}" data-key="${p.key}">${isCompanion?'동행 해제':'동행하기'}</button>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.title-equip-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>setCompanion(btn.dataset.key));
  });
  applyCompanionSprite();
  if(typeof renderPetShelter === 'function') renderPetShelter();
}

let petTimers = {};
function petTick(){
  if(state.playerHp <= 0) return;
  // 무한의 탑(일반/어려움)을 100층까지 정복하면 전투가 멈춘 채로 고정되는데,
  // 이때도 펫 트리거(예: 전투 소세지가 더미 몬스터를 계속 때리는 것)가 계속 반응해서
  // 로그가 스팸처럼 쌓이는 문제가 있었다. 정복 완료 상태에서는 펫도 함께 정지시킨다.
  if(state.mode === 'tower' && state.towerCleared) return;
  if(state.mode === 'towerHard' && state.htCleared) return;
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

