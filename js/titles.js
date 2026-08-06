// ---------- Titles (칭호) ----------
// 조건을 달성하면 영구 해금되며, 해금된 칭호 중 하나만 장착 가능. 장착한 칭호의 효과만 적용됨.

// 닉네임 앞에 붙는 칭호 표시(아이콘 + 이름을 항상 텍스트로). 광장 접속자 목록/채팅/랭킹에서 공용으로 사용.
// titleKey: presence/chat/rankings 문서에 저장된 state.equippedTitle 값 (없으면 null/undefined).
function titleBadgeHtml(titleKey){
  if(!titleKey) return '';
  const t = TITLES.find(x=>x.key===titleKey);
  if(!t) return ''; // 옛 채팅 로그 등에 더 이상 존재하지 않는 칭호 키가 남아있어도 조용히 무시
  return `<span class="name-title-badge">${t.icon} ${escapeHtml(t.name)}</span>`;
}

function titleUnlocked(t){
  return !!(state.unlockedTitles && state.unlockedTitles[t.key]);
}

// 조건을 만족했지만 아직 영구 기록되지 않은 칭호를 찾아 state.unlockedTitles에 박아넣는다.
// (renderTitles가 호출될 때마다 함께 실행되므로 renderAll 주기로 자연스럽게 계속 확인됨)
// 한 번 이 플래그가 서면 환생으로 레벨/최고층 등이 초기화돼도 칭호 해금은 유지된다.
function checkTitleUnlocks(){
  if(!state.unlockedTitles) state.unlockedTitles = {};
  TITLES.forEach(t=>{
    if(state.unlockedTitles[t.key]) return;
    let achieved = false;
    try{ achieved = !!t.check(state); }catch(e){ achieved = false; }
    if(achieved){
      state.unlockedTitles[t.key] = true;
      log(`🎖️ 칭호 해금: ${t.icon} ${t.name}`, 'good');
    }
  });
}

function titleBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  if(!state.equippedTitle) return b;
  const t = TITLES.find(x=>x.key===state.equippedTitle);
  if(!t || !titleUnlocked(t)) return b; // 조건을 더 이상 만족하지 못하면(비정상 상태) 효과 미적용
  b[t.stat] += t.value;
  return b;
}

function titleEffectText(t){
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%', accuracyAdd:''};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도', accuracyAdd:'명중률'};
  return `${labelMap[t.stat]} +${t.value}${unitMap[t.stat]}`;
}

function equipTitle(key){
  const t = TITLES.find(x=>x.key===key);
  if(!t || !titleUnlocked(t)) return;
  state.equippedTitle = (state.equippedTitle === key) ? null : key;
  renderTitles();
  renderAll();
  if(typeof renderAccountPanel === 'function' && typeof fbAuth !== 'undefined' && fbAuth.currentUser){
    renderAccountPanel(fbAuth.currentUser);
  }
}

function renderTitles(){
  checkTitleUnlocks();
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
