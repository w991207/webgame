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
function jobBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, accuracyAdd:0};
  const job = currentJob();
  if(!job) return b;
  Object.keys(job.bonus).forEach(k => { b[k] = (b[k]||0) + job.bonus[k]; });
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
