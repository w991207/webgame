// ---------- 돌연변이 각성 (Mutation Awakening) ----------
// 레벨업(+1) / 보스 처치(+3)로 얻는 "적응 포인트"를 소모해 영구적인 신체 변이 특성을
// 해금하는 성장 트리. 유산(자동 발동형 지속효과)과 달리 순수 수치형 영구 강화이며,
// 3개 갈래(전투/생존/자원)로 나뉘고 각 갈래의 2·3·4번째 노드는 이전 노드를 일정 레벨까지
// 찍어야 해금되는 구조.

const MUTATION_TREE = [
  // ---- 전투 갈래 ----
  {key:'mutAtk1', branch:'atk', name:'근섬유 강화', icon:'💪', maxLevel:35, baseCost:2, mult:1.16,
    stat:'atkPct', perLevel:1, unit:'%', label:'공격력', prereq:null},
  {key:'mutAtk2', branch:'atk', name:'표적 조준 모듈', icon:'🎯', maxLevel:25, baseCost:4, mult:1.2,
    stat:'critAdd', perLevel:0.5, unit:'%', label:'치명타 확률', prereq:{key:'mutAtk1', lvl:5}},
  {key:'mutAtk3', branch:'atk', name:'치명 각성', icon:'🩸', maxLevel:25, baseCost:6, mult:1.22,
    stat:'critDmgAdd', perLevel:2, unit:'%', label:'치명타 피해', prereq:{key:'mutAtk2', lvl:5}},
  {key:'mutAtk4', branch:'atk', name:'가속 신경계', icon:'⚡', maxLevel:20, baseCost:12, mult:1.3,
    stat:'spdPct', perLevel:0.5, unit:'%', label:'공격 속도', prereq:{key:'mutAtk3', lvl:5}},

  // ---- 생존 갈래 ----
  {key:'mutDef1', branch:'def', name:'피부경화 변이', icon:'🦴', maxLevel:35, baseCost:2, mult:1.16,
    stat:'defPct', perLevel:1, unit:'%', label:'방어력', prereq:null},
  {key:'mutDef2', branch:'def', name:'재생 인자', icon:'🧫', maxLevel:35, baseCost:3, mult:1.18,
    stat:'hpPct', perLevel:1, unit:'%', label:'최대 체력', prereq:{key:'mutDef1', lvl:5}},
  {key:'mutDef3', branch:'def', name:'생존 본능', icon:'🫀', maxLevel:18, baseCost:8, mult:1.25,
    stat:'atkDefPct', perLevel:1, unit:'%', label:'공격력/방어력', prereq:{key:'mutDef2', lvl:5}},
  {key:'mutDef4', branch:'def', name:'재해 저항', icon:'❤️‍🔥', maxLevel:20, baseCost:12, mult:1.3,
    stat:'defPct', perLevel:2, unit:'%', label:'방어력', prereq:{key:'mutDef3', lvl:5}},

  // ---- 자원 갈래 ----
  {key:'mutRes1', branch:'res', name:'탐색 감각', icon:'🔦', maxLevel:35, baseCost:2, mult:1.16,
    stat:'goldPct', perLevel:1, unit:'%', label:'물자 획득', prereq:null},
  {key:'mutRes2', branch:'res', name:'학습 가속', icon:'🧠', maxLevel:35, baseCost:2, mult:1.16,
    stat:'expPct', perLevel:1, unit:'%', label:'경험치 획득', prereq:{key:'mutRes1', lvl:5}},
  {key:'mutRes3', branch:'res', name:'생존자의 직감', icon:'🍀', maxLevel:18, baseCost:6, mult:1.22,
    stat:'dropAdd', perLevel:0.3, unit:'%p', label:'파편 드랍 확률', prereq:{key:'mutRes2', lvl:5}},
  {key:'mutRes4', branch:'res', name:'생존 학습', icon:'📚', maxLevel:20, baseCost:10, mult:1.25,
    stat:'goldExpPct', perLevel:1, unit:'%', label:'물자/경험치 획득', prereq:{key:'mutRes3', lvl:5}},
];

// ---------- 차원 초월 (무한 성장 노드) ----------
// 위 12개 노드를 전부 만렙 찍으면 적응 포인트를 쓸 곳이 완전히 사라지는 문제(특히 치명타/공속/
// 드랍률/물자·경험치처럼 전역 캡이 걸린 스탯 노드는 캡에 먼저 걸려 더 일찍 막힘)를 해결하기 위한
// 안전판. 상한 레벨이 없어 포인트가 쌓일 때마다 끝없이 투자할 수 있고, 캡이 없는 3대 스탯
// (공격력/방어력/최대 체력)에 동시에 아주 조금씩 붙는다. 레벨이 오를수록 비용이 계속 복리로
// 올라가므로 실질적으로는 "다 만렙 찍은 유저를 위한 완만한 무한 성장" 역할만 한다.
const MUTATION_TRANSCEND = {
  key:'mutTranscend', name:'차원 초월', icon:'🌌', maxLevel:Infinity, baseCost:80, mult:1.045,
  stat:'transcendTriple', perLevel:0.15, unit:'%', label:'공격력/방어력/최대 체력 (각각)',
  prereq:{allMaxed:true},
};

function mutationLevel(key){
  return (state.mutation && state.mutation.nodes && state.mutation.nodes[key]) || 0;
}

function mutationNodeByKey(key){
  if(key === MUTATION_TRANSCEND.key) return MUTATION_TRANSCEND;
  return MUTATION_TREE.find(n=>n.key===key);
}

function mutationNodeCost(node){
  const lvl = mutationLevel(node.key);
  return Math.ceil(node.baseCost * Math.pow(node.mult, lvl));
}

// 모든 기본 노드(전투/생존/자원 12개)가 각자의 만렙에 도달했는지 — 차원 초월 해금 조건
function allMutationNodesMaxed(){
  return MUTATION_TREE.every(n => mutationLevel(n.key) >= n.maxLevel);
}

function mutationNodeLocked(node){
  if(!node.prereq) return false;
  if(node.prereq.allMaxed) return !allMutationNodesMaxed();
  return mutationLevel(node.prereq.key) < node.prereq.lvl;
}

function mutationBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0};
  if(!state.mutation) return b;
  MUTATION_TREE.forEach(node=>{
    const lvl = mutationLevel(node.key);
    if(lvl<=0) return;
    const val = lvl * node.perLevel;
    if(node.stat === 'atkDefPct'){
      b.atkPct += val; b.defPct += val;
    } else if(node.stat === 'goldExpPct'){
      b.goldPct += val; b.expPct += val;
    } else {
      b[node.stat] += val;
    }
  });
  const tLvl = mutationLevel(MUTATION_TRANSCEND.key);
  if(tLvl > 0){
    const tVal = tLvl * MUTATION_TRANSCEND.perLevel;
    b.atkPct += tVal; b.defPct += tVal; b.hpPct += tVal;
  }
  return b;
}

function gainMutationPoints(amount){
  if(!state.mutation) return;
  state.mutation.points += amount;
  state.mutation.totalEarned = (state.mutation.totalEarned||0) + amount;
}

function buyMutationNode(key){
  const node = mutationNodeByKey(key);
  if(!node || mutationNodeLocked(node)) return;
  if(isUpgradeStatMaxed(node.stat)) return; // 실제 스탯이 이미 캡 도달 — 구매 차단
  const lvl = mutationLevel(key);
  if(lvl >= node.maxLevel) return;
  const cost = mutationNodeCost(node);
  if(state.mutation.points < cost) return;
  state.mutation.points -= cost;
  state.mutation.nodes[key] = lvl + 1;
  renderMutationTree();
  renderAll();
}

function renderMutationTree(){
  const el = document.getElementById('mutationTree');
  const ptText = document.getElementById('mutationPointsText');
  if(ptText) ptText.textContent = Math.floor(state.mutation.points).toLocaleString();
  if(!el) return;

  const branches = [
    {key:'atk', title:'⚔️ 전투'},
    {key:'def', title:'🛡️ 생존'},
    {key:'res', title:'📦 자원'},
  ];

  let html = '';
  branches.forEach(br=>{
    html += `<div class="mutation-branch"><div class="mutation-branch-title">${br.title}</div>`;
    MUTATION_TREE.filter(n=>n.branch===br.key).forEach(node=>{
      const lvl = mutationLevel(node.key);
      const locked = mutationNodeLocked(node);
      const maxed = lvl >= node.maxLevel;
      const cost = mutationNodeCost(node);
      const totalVal = (lvl*node.perLevel).toFixed(node.unit==='%p'?1:0);
      let footer;
      const statMaxed = isUpgradeStatMaxed(node.stat);
      if(locked){
        const preq = mutationNodeByKey(node.prereq.key);
        footer = `<div class="mutation-node-lock">🔒 ${preq.name} Lv.${node.prereq.lvl} 필요</div>`;
      } else if(maxed){
        footer = `<button class="mutation-buy-btn maxed" disabled>MAX</button>`;
      } else if(statMaxed){
        footer = `<button class="mutation-buy-btn maxed" disabled>⚡ 상한 도달 (효과없음)</button>`;
      } else {
        const afford = state.mutation.points >= cost;
        footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🧬 ${cost} 강화</button>`;
      }
      html += `
        <div class="mutation-node ${locked?'locked':''} ${maxed?'maxed':''}">
          <div class="mutation-node-top">
            <span class="mutation-node-icon">${node.icon}</span>
            <span class="mutation-node-name">${node.name}</span>
            <span class="mutation-node-lvl">Lv.${lvl}/${node.maxLevel}</span>
          </div>
          <div class="mutation-node-desc">${node.label} +${totalVal}${node.unit}</div>
          ${footer}
        </div>`;
    });
    html += `</div>`;
  });

  // ---- 차원 초월 (무한 성장 노드) ----
  {
    const node = MUTATION_TRANSCEND;
    const lvl = mutationLevel(node.key);
    const locked = mutationNodeLocked(node);
    const cost = mutationNodeCost(node);
    const totalVal = (lvl*node.perLevel).toFixed(1);
    let footer;
    if(locked){
      footer = `<div class="mutation-node-lock">🔒 위 12개 노드를 전부 만렙 찍어야 해금됩니다</div>`;
    } else {
      const afford = state.mutation.points >= cost;
      footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🧬 ${cost.toLocaleString()} 강화</button>`;
    }
    html += `<div class="mutation-branch"><div class="mutation-branch-title">🌌 초월 (무한 성장 · 남는 포인트 전용)</div>
      <div class="mutation-node ${locked?'locked':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${node.icon}</span>
          <span class="mutation-node-name">${node.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}</span>
        </div>
        <div class="mutation-node-desc">${node.label} 각각 +${totalVal}${node.unit} (상한 없음, 레벨이 오를수록 비용 증가)</div>
        ${footer}
      </div>
    </div>`;
  }

  el.innerHTML = html;
  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyMutationNode(btn.dataset.key));
  });
}
