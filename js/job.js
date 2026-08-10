// ---------- 전직 (Job Class) ----------
// 레벨 1000을 달성하면 4개 직업 중 하나를 골라 전직할 수 있다. 직업은 영구 스탯 보너스를
// 주는 "빌드 선택" 개념 — 돌연변이 각성처럼 레벨업하는 게 아니라 하나를 고르는 방식.
// 최초 전직은 무료, 이후 재전직은 혈청을 소모한다 (직업을 잘못 골랐다고 영구히 막히지 않게).

const JOB_UNLOCK_LEVEL = 1000;
const JOB_RESPEC_COST = 15; // 재전직 시 소모되는 🧪 혈청

const JOB_CLASSES = [
  {
    key:'warrior', name:'베테랑 전사', icon:'⚔️',
    desc:'전선의 최전방에서 버티는 근접 특화 생존자.',
    bonus:{atkPct:25, defPct:15},
    bonusText:'공격력 +25% · 방어력 +15%',
  },
  {
    key:'sniper', name:'저격수', icon:'🎯',
    desc:'급소를 정확히 노려 치명적인 일격을 꽂는다.',
    bonus:{accuracyAdd:15, critDmgAdd:40},
    bonusText:'명중률 +15 · 치명타 피해 +40%',
  },
  {
    key:'scavenger', name:'약탈자', icon:'💰',
    desc:'폐허 구석구석까지 뒤져 남들보다 더 많이 챙긴다.',
    bonus:{dropAdd:20, atkPct:12},
    bonusText:'파편 드랍 확률 +20%p · 공격력 +12%',
  },
  {
    key:'survivalist', name:'생존 전문가', icon:'🩹',
    desc:'혹독한 환경에서 오래 버티고 빠르게 적응한다.',
    bonus:{hpPct:50, defPct:10},
    bonusText:'최대 체력 +50% · 방어력 +10%',
  },
];

function jobUnlocked(){
  return state.level >= JOB_UNLOCK_LEVEL;
}

function currentJob(){
  if(!state.job) return null;
  return JOB_CLASSES.find(j => j.key === state.job) || null;
}

// stats() 계산에 합산되는 직업 보너스. 돌연변이/스킬과 같은 필드 이름을 쓴다.
// 전직 고정 보너스 + 직업 숙련도 트리 보너스(jobMasteryBonus)를 합쳐서 반환한다.
function jobBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, accuracyAdd:0};
  const job = currentJob();
  if(!job) return b;
  Object.keys(job.bonus).forEach(k => { b[k] = (b[k]||0) + job.bonus[k]; });
  if(typeof jobMasteryBonus === 'function'){
    const mb = jobMasteryBonus();
    Object.keys(mb).forEach(k => { b[k] = (b[k]||0) + mb[k]; });
  }
  return b;
}

function selectJob(key){
  if(!jobUnlocked()) return;
  const job = JOB_CLASSES.find(j => j.key === key);
  if(!job || state.job === key) return;

  if(state.job === null){
    state.job = key;
    log(`🎖️ [${job.name}]으로 전직했습니다!`, 'good');
  } else {
    if(state.soul < JOB_RESPEC_COST){
      log(`재전직에는 🧪 혈청 ${JOB_RESPEC_COST}개가 필요합니다.`, 'warn');
      return;
    }
    state.soul -= JOB_RESPEC_COST;
    state.job = key;
    log(`🎖️ [${job.name}]으로 재전직했습니다! (🧪 혈청 -${JOB_RESPEC_COST})`, 'good');
  }
  renderJobPanel();
  renderAll();
}

function renderJobPanel(){
  const lockNotice = document.getElementById('jobLockNotice');
  const list = document.getElementById('jobList');
  const levelReqEl = document.getElementById('jobLevelReq');
  if(!list) return;

  const unlocked = jobUnlocked();

  if(levelReqEl) levelReqEl.style.display = unlocked ? 'none' : 'inline';
  const curLevelText = document.getElementById('jobCurrentLevelText');
  if(curLevelText) curLevelText.textContent = state.level;

  if(!unlocked){
    if(lockNotice) lockNotice.style.display = 'block';
    list.style.display = 'none';
    return;
  }
  if(lockNotice) lockNotice.style.display = 'none';
  list.style.display = 'grid';

  const isFirstPick = state.job === null;
  list.innerHTML = JOB_CLASSES.map(job => {
    const active = state.job === job.key;
    const label = active ? '선택됨' : (isFirstPick ? '전직하기' : `재전직 (🧪${JOB_RESPEC_COST})`);
    return `
      <div class="mutation-node ${active?'maxed':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${job.icon}</span>
          <span class="mutation-node-name">${job.name}</span>
        </div>
        <div class="mutation-node-desc">${job.desc}<br>${job.bonusText}</div>
        <button class="mutation-buy-btn ${active?'maxed':''}" data-key="${job.key}" ${active?'disabled':''}>${label}</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => selectJob(btn.dataset.key));
  });
}

// ---------- 직업 숙련도 (Job Mastery) ----------
// 전직 후 레벨업(+1)/보스 처치(+2)로 얻는 "숙련도 포인트"를 소모해 현재 직업 전용 트리를
// 강화하는 시스템. 돌연변이 각성과 같은 구조(트리+선행조건)를 쓰지만 포인트/진행도는
// 직업별로 완전히 분리 저장된다 — 재전직해도 예전 직업에 투자한 숙련도는 사라지지 않고,
// 나중에 그 직업으로 돌아오면 그대로 남아있다 (재전직 페널티를 완화해주는 장치).
const JOB_MASTERY_TREES = {
  warrior: [
    {key:'wmDef1', name:'전선 유지', icon:'🛡️', maxLevel:40, baseCost:3, mult:1.15,
      stat:'defPct', perLevel:0.8, unit:'%', label:'방어력', prereq:null},
    {key:'wmAtk1', name:'결전 태세', icon:'⚔️', maxLevel:40, baseCost:5, mult:1.18,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'wmDef1', lvl:5}},
    {key:'wmCrit1', name:'불굴의 반격', icon:'🔥', maxLevel:30, baseCost:9, mult:1.24,
      stat:'critDmgAdd', perLevel:1.5, unit:'%', label:'치명타 피해', prereq:{key:'wmAtk1', lvl:10}},
  ],
  sniper: [
    {key:'smAcc1', name:'정밀 조준', icon:'🔭', maxLevel:40, baseCost:3, mult:1.15,
      stat:'accuracyAdd', perLevel:0.6, unit:'', label:'명중률', prereq:null},
    {key:'smCrit1', name:'급소 타격', icon:'🎯', maxLevel:30, baseCost:5, mult:1.2,
      stat:'critAdd', perLevel:0.4, unit:'%', label:'치명타 확률', prereq:{key:'smAcc1', lvl:5}},
    {key:'smCrit2', name:'처형자의 눈', icon:'💀', maxLevel:30, baseCost:9, mult:1.24,
      stat:'critDmgAdd', perLevel:1.5, unit:'%', label:'치명타 피해', prereq:{key:'smCrit1', lvl:10}},
  ],
  scavenger: [
    {key:'scDrop1', name:'눈썰미', icon:'👁️', maxLevel:30, baseCost:3, mult:1.16,
      stat:'dropAdd', perLevel:0.3, unit:'%p', label:'파편 드랍 확률', prereq:null},
    {key:'scGold1', name:'빠른 손', icon:'🤲', maxLevel:35, baseCost:5, mult:1.18,
      stat:'goldPct', perLevel:1, unit:'%', label:'물자 획득', prereq:{key:'scDrop1', lvl:5}},
    {key:'scAtk1', name:'대박의 감', icon:'🎰', maxLevel:30, baseCost:9, mult:1.24,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'scGold1', lvl:10}},
  ],
  survivalist: [
    {key:'svHp1', name:'인내의 한계', icon:'🩸', maxLevel:40, baseCost:3, mult:1.15,
      stat:'hpPct', perLevel:1, unit:'%', label:'최대 체력', prereq:null},
    {key:'svDef1', name:'회복력', icon:'💉', maxLevel:35, baseCost:5, mult:1.18,
      stat:'defPct', perLevel:0.8, unit:'%', label:'방어력', prereq:{key:'svHp1', lvl:5}},
    {key:'svAtk1', name:'최후의 저항', icon:'🔥', maxLevel:30, baseCost:9, mult:1.24,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'svDef1', lvl:10}},
  ],
};

function jobMasteryTreeFor(jobKey){
  return JOB_MASTERY_TREES[jobKey] || null;
}

// 직업별로 분리된 숙련도 진행 상태를 가져오거나(없으면) 새로 만든다.
function jobMasteryStateFor(jobKey){
  if(!state.jobMastery) state.jobMastery = {};
  if(!state.jobMastery[jobKey]) state.jobMastery[jobKey] = {points:0, totalEarned:0, nodes:{}};
  return state.jobMastery[jobKey];
}

function jobMasteryLevel(jobKey, key){
  const ms = state.jobMastery && state.jobMastery[jobKey];
  return (ms && ms.nodes && ms.nodes[key]) || 0;
}

function jobMasteryNodeCost(jobKey, node){
  const lvl = jobMasteryLevel(jobKey, node.key);
  return Math.ceil(node.baseCost * Math.pow(node.mult, lvl));
}

function jobMasteryNodeLocked(jobKey, node){
  if(!node.prereq) return false;
  return jobMasteryLevel(jobKey, node.prereq.key) < node.prereq.lvl;
}

// 현재 전직 중인 직업의 숙련도 트리가 주는 보너스만 stats()에 반영된다.
// (직업을 바꾸면 그 직업의 트리로 보너스도 함께 전환됨 — 진행도 자체는 안 사라짐)
function jobMasteryBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, accuracyAdd:0};
  if(!state.job) return b;
  const tree = jobMasteryTreeFor(state.job);
  if(!tree) return b;
  tree.forEach(node=>{
    const lvl = jobMasteryLevel(state.job, node.key);
    if(lvl<=0) return;
    b[node.stat] += lvl * node.perLevel;
  });
  return b;
}

// 레벨업/보스 처치 시 호출 — 전직한 상태에서만 현재 직업의 숙련도 포인트가 쌓인다.
function gainJobMasteryPoints(amount){
  if(!state.job) return;
  const ms = jobMasteryStateFor(state.job);
  ms.points += amount;
  ms.totalEarned = (ms.totalEarned||0) + amount;
}

function buyJobMasteryNode(key){
  if(!state.job) return;
  const tree = jobMasteryTreeFor(state.job);
  const node = tree && tree.find(n=>n.key===key);
  if(!node || jobMasteryNodeLocked(state.job, node)) return;
  const lvl = jobMasteryLevel(state.job, key);
  if(lvl >= node.maxLevel) return;
  const ms = jobMasteryStateFor(state.job);
  const cost = jobMasteryNodeCost(state.job, node);
  if(ms.points < cost) return;
  ms.points -= cost;
  ms.nodes[key] = lvl + 1;
  renderJobMasteryPanel();
  renderAll();
}

function renderJobMasteryPanel(){
  const wrap = document.getElementById('jobMasteryWrap');
  const lockNotice = document.getElementById('jobMasteryLockNotice');
  const el = document.getElementById('jobMasteryTree');
  const ptText = document.getElementById('jobMasteryPointsText');
  if(!wrap || !el) return;

  if(!state.job){
    wrap.style.display = 'block';
    if(lockNotice) lockNotice.style.display = 'block';
    el.style.display = 'none';
    if(ptText) ptText.parentElement.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  if(lockNotice) lockNotice.style.display = 'none';
  el.style.display = 'grid';
  if(ptText) ptText.parentElement.style.display = 'block';

  const ms = jobMasteryStateFor(state.job);
  const tree = jobMasteryTreeFor(state.job);
  const jobMeta = currentJob();
  if(ptText) ptText.textContent = Math.floor(ms.points).toLocaleString();

  el.innerHTML = tree.map(node=>{
    const lvl = jobMasteryLevel(state.job, node.key);
    const locked = jobMasteryNodeLocked(state.job, node);
    const maxed = lvl >= node.maxLevel;
    const cost = jobMasteryNodeCost(state.job, node);
    const totalVal = (lvl*node.perLevel).toFixed(node.perLevel % 1 !== 0 ? 1 : 0);
    let footer;
    if(locked){
      const preq = tree.find(n=>n.key===node.prereq.key);
      footer = `<div class="mutation-node-lock">🔒 ${preq.name} Lv.${node.prereq.lvl} 필요</div>`;
    } else if(maxed){
      footer = `<button class="mutation-buy-btn maxed" disabled>MAX</button>`;
    } else {
      const afford = ms.points >= cost;
      footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🎖️ ${cost.toLocaleString()} 강화</button>`;
    }
    return `
      <div class="mutation-node ${locked?'locked':''} ${maxed?'maxed':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${node.icon}</span>
          <span class="mutation-node-name">${node.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}/${node.maxLevel}</span>
        </div>
        <div class="mutation-node-desc">${node.label} +${totalVal}${node.unit}</div>
        ${footer}
      </div>`;
  }).join('');

  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyJobMasteryNode(btn.dataset.key));
  });
}
