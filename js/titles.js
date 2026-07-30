// ---------- Titles (칭호) ----------
// 조건을 달성하면 영구 해금되며, 해금된 칭호 중 하나만 장착 가능. 장착한 칭호의 효과만 적용됨.

function titleUnlocked(t){
  try{ return !!t.check(state); }catch(e){ return false; }
}

function titleBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0};
  if(!state.equippedTitle) return b;
  const t = TITLES.find(x=>x.key===state.equippedTitle);
  if(!t || !titleUnlocked(t)) return b; // 조건을 더 이상 만족하지 못하면(비정상 상태) 효과 미적용
  b[t.stat] += t.value;
  return b;
}

function titleEffectText(t){
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%'};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도'};
  return `${labelMap[t.stat]} +${t.value}${unitMap[t.stat]}`;
}

function equipTitle(key){
  const t = TITLES.find(x=>x.key===key);
  if(!t || !titleUnlocked(t)) return;
  state.equippedTitle = (state.equippedTitle === key) ? null : key;
  renderTitles();
  renderAll();
}

function renderTitles(){
  const grid = document.getElementById('titleGrid');
  if(!grid) return;
  const unlockedCount = TITLES.filter(titleUnlocked).length;
  const countEl = document.getElementById('titleUnlockedCount');
  if(countEl) countEl.textContent = `${unlockedCount} / ${TITLES.length}`;

  grid.innerHTML = '';
  TITLES.forEach(t=>{
    const unlocked = titleUnlocked(t);
    const equipped = state.equippedTitle === t.key;
    const card = document.createElement('div');
    card.className = 'relic-card title-card' + (unlocked?' owned':'') + (equipped?' equipped':'');
    card.innerHTML = `
      <div class="rname"><span>${t.icon} ${t.name}</span>${equipped?'<span class="title-equipped-tag">장착중</span>':''}</div>
      <div class="rdesc">${titleEffectText(t)}</div>
      <div class="title-cond">${unlocked ? '✅ 달성 완료' : `🔒 ${t.condText}`}</div>
      ${unlocked ? `<button class="title-equip-btn ${equipped?'unequip':''}" data-key="${t.key}">${equipped?'해제':'장착'}</button>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.title-equip-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>equipTitle(btn.dataset.key));
  });
}
