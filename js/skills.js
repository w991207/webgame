// ---------- 액티브 스킬 (자동 발동) ----------
// 🧪 혈청으로 습득/강화하는 액티브 스킬. 각 스킬은 배우는 즉시 자신만의 쿨타임마다
// 자동으로 발동한다(수동 조작 없음). 레벨이 오를수록 쿨타임이 짧아지고 효과가 강해진다.
// 패시브 성격의 영구 강화는 이미 "돌연변이 각성"이 담당하므로, 여기서는 전투 중
// 눈에 보이는 "발동형" 효과만 다룬다.

const ACTIVE_SKILLS = [
  {
    key:'skillDoubleStrike', name:'이중 강타', icon:'🗡️',
    maxLevel:10, baseCost:3, costMult:1.35,
    baseCooldown:10, minCooldown:4, cdStep:0.7,
    descFn: lvl => `공격력만큼 추가 타격 (치명타 적용) · ${skillCooldownSec({baseCooldown:10,minCooldown:4,cdStep:0.7}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPiercing', name:'관통 사격', icon:'🎯',
    maxLevel:10, baseCost:4, costMult:1.35,
    baseCooldown:15, minCooldown:8, cdStep:0.8,
    descFn: lvl => `방어 무시 피해(공격력의 ${(80+Math.max(lvl,1)*15)}%) · ${skillCooldownSec({baseCooldown:15,minCooldown:8,cdStep:0.8}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPatch', name:'응급 처치', icon:'🩹',
    maxLevel:10, baseCost:3, costMult:1.3,
    baseCooldown:20, minCooldown:12, cdStep:1.0,
    descFn: lvl => `최대 체력의 ${(8+Math.max(lvl,1)*2)}% 즉시 회복 · ${skillCooldownSec({baseCooldown:20,minCooldown:12,cdStep:1.0}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPlunder', name:'강탈 일격', icon:'💰',
    maxLevel:10, baseCost:4, costMult:1.35,
    baseCooldown:18, minCooldown:9, cdStep:1.0,
    descFn: lvl => `타격과 동시에 물자 획득(평소 획득량의 ${(30+Math.max(lvl,1)*10)}%) · ${skillCooldownSec({baseCooldown:18,minCooldown:9,cdStep:1.0}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
];

// 쿨타임(밀리초 타임스탬프)은 세션 동안만 유지하면 충분해서 state에 넣지 않고
// 별도 런타임 변수로 관리한다 (새로고침 시 초기화되어도 무방).
let skillCooldowns = {};

function skillLevel(key){
  return (state.skills && state.skills[key]) || 0;
}

function skillCost(sk, lvl){
  return Math.ceil(sk.baseCost * Math.pow(sk.costMult, lvl));
}

function skillCooldownSec(sk, lvl){
  return Math.max(sk.minCooldown, sk.baseCooldown - Math.max(lvl,1) * sk.cdStep);
}

function buySkill(key){
  const sk = ACTIVE_SKILLS.find(s=>s.key===key);
  if(!sk) return;
  const lvl = skillLevel(key);
  if(lvl >= sk.maxLevel) return;
  const cost = skillCost(sk, lvl);
  if(state.soul < cost) return;
  state.soul -= cost;
  state.skills[key] = lvl + 1;
  if(lvl === 0){
    skillCooldowns[key] = Date.now(); // 처음 배운 스킬은 쿨타임을 다 채운 뒤 첫 발동
    log(`🗡️ [${sk.name}] 스킬을 습득했습니다! 자동으로 발동합니다.`, 'good');
  } else {
    log(`${sk.name} 강화! (Lv.${state.skills[key]})`, 'good');
  }
  renderAll();
}

// ---------- 발동 로직 ----------
function triggerActiveSkill(sk, lvl){
  const s = stats();
  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);

  if(sk.key === 'skillDoubleStrike'){
    if(state.monsterHp <= 0) return false;
    let dmg = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss)));
    const isCrit = Math.random()*100 < s.critChance;
    if(isCrit) dmg = Math.round(dmg * s.critDamageMult);
    dealDamageToMonster(dmg, isCrit, {floatClass:'skill'});
    log(`🗡️ 이중 강타 발동!`, 'new');
    return true;
  }

  if(sk.key === 'skillPiercing'){
    if(state.monsterHp <= 0) return false;
    const dmg = Math.round(s.atk * (0.8 + lvl*0.15));
    dealDamageToMonster(dmg, false, {floatClass:'skill'});
    log(`🎯 관통 사격 발동! (방어 무시 -${dmg})`, 'new');
    return true;
  }

  if(sk.key === 'skillPatch'){
    if(state.playerHp <= 0 || state.playerHp >= s.maxHp) return false; // 이미 풀피면 대기, 쿨타임 소모 안 함
    const healAmt = Math.round(s.maxHp * (0.08 + lvl*0.02));
    state.playerHp = Math.min(s.maxHp, state.playerHp + healAmt);
    floatText('+'+healAmt, 'heal');
    log(`🩹 응급 처치 발동! (+${healAmt} 체력)`, 'good');
    return true;
  }

  if(sk.key === 'skillPlunder'){
    if(state.monsterHp <= 0) return false;
    const dmg = Math.round(s.atk * (0.6 + lvl*0.1));
    const bonusGold = Math.round(goldDropFor(currentFloor, state.isBoss) * s.goldMult * (0.3 + lvl*0.1));
    dealDamageToMonster(dmg, false, {floatClass:'skill'});
    state.gold += bonusGold;
    state.lifetimeGoldEarned += bonusGold;
    floatText('+'+bonusGold+'📦', 'good');
    log(`💰 강탈 일격 발동! (+${bonusGold}📦)`, 'good');
    return true;
  }

  return false;
}

function checkActiveSkills(){
  if(!state.skills) return;
  const now = Date.now();
  let touched = false;
  ACTIVE_SKILLS.forEach(sk=>{
    const lvl = skillLevel(sk.key);
    if(lvl <= 0) return;
    const cdMs = skillCooldownSec(sk, lvl) * 1000;
    const last = skillCooldowns[sk.key] || 0;
    if(now - last < cdMs) return;
    const fired = triggerActiveSkill(sk, lvl);
    if(fired){
      skillCooldowns[sk.key] = now;
      touched = true;
    }
  });
  if(touched) renderCombatFrame();
}

// ---------- 체력바 밑 스킬 쿨타임 트레이 ----------
// 습득한 스킬 아이콘을 보여주고, 각 아이콘 위에 남은 쿨타임을 어두운 오버레이로 표시한다.
// 이 트레이에는 클릭 가능한 버튼이 없으므로(순수 표시용), 빠른 주기(100ms)로 갱신해도
// "버튼이 재생성돼 클릭이 씹히는" 문제가 생기지 않는다. 그래도 매번 innerHTML을 통째로
// 새로 만들진 않고, 슬롯 구성이 바뀔 때만 다시 그리고 평소엔 스타일/텍스트만 갱신한다.
function renderSkillTray(){
  const el = document.getElementById('skillTray');
  if(!el || !state.skills) return;
  const learned = ACTIVE_SKILLS.filter(sk => skillLevel(sk.key) > 0);

  const existingKeys = Array.from(el.children).map(c => c.dataset.key);
  const neededKeys = learned.map(sk => sk.key);
  const same = existingKeys.length === neededKeys.length && existingKeys.every((k,i) => k === neededKeys[i]);

  if(!same){
    el.innerHTML = learned.map(sk => `
      <div class="skill-icon-slot" data-key="${sk.key}" title="${sk.name}">
        <span class="skill-lvl-badge">${skillLevel(sk.key)}</span>
        <span class="skill-icon-emoji">${sk.icon}</span>
        <div class="skill-cd-overlay"></div>
        <div class="skill-cd-text"></div>
      </div>`).join('');
  } else {
    learned.forEach(sk => {
      const badge = el.querySelector(`.skill-icon-slot[data-key="${sk.key}"] .skill-lvl-badge`);
      if(badge) badge.textContent = skillLevel(sk.key);
    });
  }
  updateSkillTrayCooldowns();
}

function updateSkillTrayCooldowns(){
  const el = document.getElementById('skillTray');
  if(!el || !state.skills) return;
  const now = Date.now();
  ACTIVE_SKILLS.forEach(sk => {
    const lvl = skillLevel(sk.key);
    if(lvl <= 0) return;
    const slot = el.querySelector(`.skill-icon-slot[data-key="${sk.key}"]`);
    if(!slot) return;
    const cdMs = skillCooldownSec(sk, lvl) * 1000;
    const last = skillCooldowns[sk.key] || 0;
    const remainMs = Math.max(0, cdMs - (now - last));
    const pct = Math.min(100, (remainMs / cdMs) * 100);
    const overlay = slot.querySelector('.skill-cd-overlay');
    const text = slot.querySelector('.skill-cd-text');
    if(overlay) overlay.style.height = pct + '%';
    if(text) text.textContent = remainMs > 50 ? (remainMs/1000).toFixed(1) : '';
    slot.classList.toggle('ready', remainMs <= 50);
  });
}

// ---------- UI (강화 패널) ----------
function renderSkillsPanel(){
  const el = document.getElementById('skillsList');
  if(!el) return;
  let html = '';
  ACTIVE_SKILLS.forEach(sk=>{
    const lvl = skillLevel(sk.key);
    const maxed = lvl >= sk.maxLevel;
    const cost = skillCost(sk, lvl);
    const afford = state.soul >= cost;
    html += `
      <div class="mutation-node ${maxed?'maxed':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${sk.icon}</span>
          <span class="mutation-node-name">${sk.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}/${sk.maxLevel}</span>
        </div>
        <div class="mutation-node-desc">${sk.descFn(lvl)}</div>
        ${maxed
          ? `<button class="mutation-buy-btn maxed" disabled>MAX</button>`
          : `<button class="mutation-buy-btn" data-key="${sk.key}" ${afford?'':'disabled'}>🧪 ${cost} ${lvl===0?'습득':'강화'}</button>`}
      </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buySkill(btn.dataset.key));
  });
}
