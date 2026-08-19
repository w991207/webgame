// ---------- 몬스터 도감 (Bestiary) ----------
// MONSTERS/BOSSES/TOWER_MONSTERS(js/data.js)를 그룹별로 묶어서 도감 UI에 쓴다.
// 발견 여부/처치 수는 state.bestiary에 { [몬스터이름]: 처치횟수 } 형태로 저장.
const BESTIARY_GROUPS = [
  {label:'폐허 - 일반 몬스터', list: MONSTERS},
  {label:'폐허 - 보스', list: BOSSES},
  {label:'무한의 탑', list: TOWER_MONSTERS},
  {label:'특수', list: SPECIAL_MONSTERS},
];

function bestiaryTotalCount(){
  return BESTIARY_GROUPS.reduce((sum, g) => sum + g.list.length, 0);
}

function bestiaryDiscoveredCount(){
  return Object.keys(state.bestiary || {}).length;
}

// 몬스터를 처치했을 때 combat.js(dealDamageToMonster)에서 호출.
// 처음 잡는 몬스터면 발견 보너스(물자)를 지급하고 true를 반환한다.
function recordBestiaryKill(meta, bonusGoldBase){
  if(!meta || !meta.name) return false;
  if(!state.bestiary) state.bestiary = {};
  const isNew = !state.bestiary[meta.name];
  state.bestiary[meta.name] = (state.bestiary[meta.name] || 0) + 1;

  if(isNew){
    const bonusGold = Math.max(1, Math.round(bonusGoldBase * 5));
    state.gold += bonusGold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
    log(`📖 도감에 "${meta.name}"을(를) 새로 기록했습니다! (+${bonusGold.toLocaleString()}📦)`, 'good');

    if(bestiaryDiscoveredCount() >= bestiaryTotalCount()){
      log('📖 몬스터 도감을 전부 완성했습니다! 축하합니다!', 'good');
    }
  }
  return isNew;
}

function renderBestiary(){
  const el = document.getElementById('bestiaryGrid');
  const countEl = document.getElementById('bestiaryCountText');
  if(!el) return;

  const discovered = bestiaryDiscoveredCount();
  const total = bestiaryTotalCount();
  if(countEl) countEl.textContent = `${discovered} / ${total} 발견`;

  let html = '';
  BESTIARY_GROUPS.forEach(group=>{
    html += `<div class="bestiary-group-label">${group.label}</div><div class="bestiary-grid">`;
    group.list.forEach(m=>{
      const kills = (state.bestiary && state.bestiary[m.name]) || 0;
      const found = kills > 0;
      const visual = m.img
        ? `<img src="${m.img}" class="bestiary-card-img" alt="${found ? m.name : '???'}" style="${found?'':'filter:brightness(0);opacity:.35;'}">`
        : `<span class="bestiary-card-emoji" style="${found?'':'filter:brightness(0);opacity:.35;'}">${found ? m.emoji : '❔'}</span>`;
      html += `
        <div class="bestiary-card ${found?'found':'unknown'}">
          ${visual}
          <div class="bestiary-card-name">${found ? m.name : '???'}</div>
          <div class="bestiary-card-kills">${found ? ('처치 ' + kills.toLocaleString() + '회') : '미발견'}</div>
        </div>`;
    });
    html += `</div>`;
  });
  el.innerHTML = html;
}
