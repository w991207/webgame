// ---------- Quests & Achievements ----------
function checkDailyReset(){
  const DAY_MS = 24*3600*1000;
  if(Date.now() - state.dailyResetAt >= DAY_MS){
    state.dailyResetAt = Date.now();
    state.dailyKills = 0;
    state.dailyGoldEarned = 0;
    state.dailyUpgradesBought = 0;
    state.dailyBossKills = 0;
    state.dailyClaims = {};
    log('일일 퀘스트가 초기화되었습니다.', 'new');
  }
}

function applyReward(reward){
  if(reward.gold) state.gold += reward.gold;
  if(reward.soul) state.soul += reward.soul;
  if(reward.frag) state.fragments += reward.frag;
}

function rewardText(reward){
  const parts = [];
  if(reward.gold) parts.push(`+${reward.gold}🪙`);
  if(reward.soul) parts.push(`+${reward.soul}✦`);
  if(reward.frag) parts.push(`+${reward.frag}◈`);
  return parts.join(' ');
}

function claimDaily(key){
  const q = DAILY_QUESTS.find(x=>x.key===key);
  if(!q || state.dailyClaims[key]) return;
  if(state[q.statKey] < q.target) return;
  applyReward(q.reward);
  state.dailyClaims[key] = true;
  log(`퀘스트 완료: ${q.name} (${rewardText(q.reward)})`, 'good');
  renderAll();
}

function claimAch(key){
  const a = ACHIEVEMENTS.find(x=>x.key===key);
  if(!a || state.achClaims[key]) return;
  if(!a.check(state)) return;
  applyReward(a.reward);
  state.achClaims[key] = true;
  log(`업적 달성: ${a.name} (${rewardText(a.reward)})`, 'good');
  renderAll();
}

function renderDailyQuests(){
  const el = document.getElementById('dailyResetText');
  const remainMs = Math.max(0, 24*3600*1000 - (Date.now()-state.dailyResetAt));
  const h = Math.floor(remainMs/3600000), m = Math.floor((remainMs%3600000)/60000);
  el.textContent = `(초기화까지 ${h}시간 ${m}분)`;

  const container = document.getElementById('dailyQuestList');
  container.innerHTML = '';
  DAILY_QUESTS.forEach(q=>{
    const progress = Math.min(state[q.statKey], q.target);
    const ready = progress >= q.target;
    const claimed = !!state.dailyClaims[q.key];
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${q.name}</div>
          <div class="qdesc">${q.desc}</div>
        </div>
        <div class="qreward">${rewardText(q.reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(progress/q.target*100)}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${progress}/${q.target}</span>
        <button class="claim ${claimed?'done':(ready?'ready':'')}" ${claimed||!ready?'disabled':''} data-key="${q.key}">${claimed?'완료':'받기'}</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimDaily(q.key));
  });
}

function renderAchievements(){
  const container = document.getElementById('achievementList');
  container.innerHTML = '';
  ACHIEVEMENTS.forEach(a=>{
    const raw = state[a.statKey] || 0;
    const progress = Math.min(raw, a.target);
    const ready = a.check(state);
    const claimed = !!state.achClaims[a.key];
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${a.name}</div>
          <div class="qdesc">${a.desc}</div>
        </div>
        <div class="qreward">${rewardText(a.reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(progress/a.target*100)}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${progress}/${a.target}</span>
        <button class="claim ${claimed?'done':(ready?'ready':'')}" ${claimed||!ready?'disabled':''} data-key="${a.key}">${claimed?'완료':'받기'}</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimAch(a.key));
  });
}

function claimRepeatable(key){
  const q = REPEATABLE_QUESTS.find(x=>x.key===key);
  if(!q) return;
  if(state[q.statKey] < q.target) return;
  state[q.statKey] -= q.target;
  applyReward(q.reward);
  log(`반복 퀘스트 완료: ${q.name} (${rewardText(q.reward)})`, 'good');
  renderAll();
}

function claimAllRepeatable(){
  let totalClaims = 0;
  const totalReward = {gold:0, soul:0, frag:0};
  REPEATABLE_QUESTS.forEach(q=>{
    const stacks = Math.floor(state[q.statKey] / q.target);
    if(stacks <= 0) return;
    state[q.statKey] -= stacks * q.target;
    totalClaims += stacks;
    if(q.reward.gold) totalReward.gold += q.reward.gold * stacks;
    if(q.reward.soul) totalReward.soul += q.reward.soul * stacks;
    if(q.reward.frag) totalReward.frag += q.reward.frag * stacks;
  });
  if(totalClaims === 0) return;
  applyReward(totalReward);
  log(`반복 퀘스트 일괄 수령: 총 ${totalClaims}회 (${rewardText(totalReward)})`, 'good');
  renderAll();
}
document.getElementById('claimAllRepeatBtn').addEventListener('click', claimAllRepeatable);

function renderRepeatableQuests(){
  const container = document.getElementById('repeatQuestList');
  container.innerHTML = '';
  let anyReady = false;
  REPEATABLE_QUESTS.forEach(q=>{
    const raw = state[q.statKey];
    const stacks = Math.floor(raw / q.target);
    const displayProgress = raw % q.target;
    const ready = stacks >= 1;
    if(ready) anyReady = true;
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${q.name}${stacks>1? `<span class="stack">x${stacks} 대기중</span>`:''}</div>
          <div class="qdesc">${q.desc}</div>
        </div>
        <div class="qreward">${rewardText(q.reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(ready?100:(displayProgress/q.target*100))}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${ready? q.target+'/'+q.target : displayProgress+'/'+q.target}</span>
        <button class="claim ${ready?'ready':''}" ${ready?'':'disabled'} data-key="${q.key}">받기</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimRepeatable(q.key));
  });
  const claimAllBtn = document.getElementById('claimAllRepeatBtn');
  if(claimAllBtn) claimAllBtn.disabled = !anyReady;
}

function updateRebirthAvailability(){
  const btn = document.getElementById('rebirthBtn');
  const desc = document.getElementById('rebirthDesc');
  const canRebirth = state.highestFloor >= 15;
  const gainSoul = Math.floor(state.highestFloor / 2.5);
  const gainFrag = Math.floor(state.highestFloor / 3);
  btn.disabled = !canRebirth;
  if(canRebirth){
    desc.innerHTML = `최고 도달 층: <b>${state.highestFloor}층</b><br>환생 시 <span style="color:var(--soul)">✦ ${gainSoul}</span>개의 영혼석과 <span style="color:var(--frag)">◈ ${gainFrag}</span>개의 유물 파편을 얻습니다. 층수/레벨/골드 강화는 초기화되지만 영구 강화와 보유 영혼석/유물은 유지됩니다.`;
  } else {
    desc.textContent = `15층 이상 도달 시 환생이 가능합니다. (현재 최고: ${state.highestFloor}층)`;
  }
}

document.getElementById('rebirthBtn').addEventListener('click', ()=>{
  if(state.highestFloor < 15) return;
  const gainSoul = Math.floor(state.highestFloor / 2.5);
  const gainFrag = Math.floor(state.highestFloor / 3);
  if(!confirm(`환생하시겠습니까?\n✦ ${gainSoul}개의 영혼석과 ◈ ${gainFrag}개의 유물 파편을 얻고 층수/레벨/골드가 초기화됩니다.`)) return;
  state.soul += gainSoul;
  state.fragments += gainFrag;
  state.rebirthCount++;
  state.level = 1;
  state.exp = 0;
  state.gold = 0;
  state.floor = 1;
  state.killsOnFloor = 0;
  state.highestFloor = 1;
  state.goldUpgrades = {atk:0, def:0, hp:0, goldGain:0, expGain:0, atkSpeed:0};
  state.towerFloor = 1;
  state.towerHighestFloor = 1;
  state.towerRewardsClaimed = {};
  state.towerCleared = false;
  state.mode = 'normal';
  document.getElementById('modeNormalBtn').classList.toggle('active', true);
  document.getElementById('modeTowerBtn').classList.toggle('active', false);
  document.getElementById('arenaTitle').textContent = '회랑';
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  log(`환생 완료! ✦ ${gainSoul} 영혼석, ◈ ${gainFrag} 유물 파편 획득.`, 'good');
  renderAll();
});

