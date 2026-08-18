// ---------- Quests & Achievements ----------
// 예전엔 "마지막 리셋 후 24시간 경과"로 판정해서 유저마다 리셋 시각이 최초 접속 시간에 따라
// 제각각 밀리는 문제가 있었다. 자정(로컬 자정) 기준으로 날짜가 바뀌었는지로 판정하도록 변경.
function checkDailyReset(){
  if(!isSameDay(state.dailyResetAt, Date.now())){
    state.dailyResetAt = Date.now();
    state.dailyKills = 0;
    state.dailyGoldEarned = 0;
    state.dailyUpgradesBought = 0;
    state.dailyBossKills = 0;
    state.dailyClaims = {};
    state.dailySoulPacksBought = 0;
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
  if(reward.gold) parts.push(`+${reward.gold}📦`);
  if(reward.soul) parts.push(`+${reward.soul}🧪`);
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
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0);
  const remainMs = Math.max(0, nextMidnight.getTime() - now.getTime());
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
  const soulMult = (typeof rebirthSoulMultiplier === 'function') ? rebirthSoulMultiplier() : 1;
  const gainSoul = Math.floor(state.highestFloor / 2.5 * soulMult);
  const gainFrag = Math.floor(state.highestFloor / 3);
  const bonusText = soulMult > 1 ? ` <span style="color:var(--text-dim);font-size:11px;">(혈청 정제 +${Math.round((soulMult-1)*100)}%)</span>` : '';
  btn.disabled = !canRebirth;
  if(canRebirth){
    desc.innerHTML = `최고 도달 층: <b>${state.highestFloor}층</b><br>환생 시 <span style="color:var(--soul)">🧪 ${gainSoul}</span>개의 혈청${bonusText}과 <span style="color:var(--frag)">◈ ${gainFrag}</span>개의 유산 파편을 얻습니다. 층수/레벨/물자 강화는 초기화되지만 영구 강화와 보유 혈청/유산은 유지됩니다.`;
  } else {
    desc.textContent = `15층 이상 도달 시 환생이 가능합니다. (현재 최고: ${state.highestFloor}층)`;
  }
}

document.getElementById('rebirthBtn').addEventListener('click', ()=>{
  if(state.highestFloor < 15) return;
  const soulMult = (typeof rebirthSoulMultiplier === 'function') ? rebirthSoulMultiplier() : 1;
  const gainSoul = Math.floor(state.highestFloor / 2.5 * soulMult);
  const gainFrag = Math.floor(state.highestFloor / 3);
  if(!confirm(`환생하시겠습니까?\n🧪 ${gainSoul}개의 혈청과 ◈ ${gainFrag}개의 유산 파편을 얻고 층수/레벨/물자가 초기화됩니다.`)) return;
  state.soul += gainSoul;
  state.fragments += gainFrag;
  state.rebirthCount++;
  if(!Array.isArray(state.rebirthHistory)) state.rebirthHistory = [];
  state.rebirthHistory.push({
    at: Date.now(),
    order: state.rebirthCount,
    floor: state.highestFloor,
    level: state.level,
    gainSoul,
    gainFrag,
  });
  if(state.rebirthHistory.length > 300) state.rebirthHistory = state.rebirthHistory.slice(-300); // 저장 용량 보호용 상한
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
  state.htFloor = 1;
  state.htHighestFloor = 1;
  state.htRewardsClaimed = {};
  state.htCleared = false;
  state.mode = 'normal';
  document.getElementById('modeNormalBtn').classList.toggle('active', true);
  document.getElementById('modeTowerBtn').classList.toggle('active', false);
  document.getElementById('arenaTitle').textContent = '폐허';
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  log(`환생 완료! 🧪 ${gainSoul} 혈청, ◈ ${gainFrag} 유산 파편 획득.`, 'good');
  renderAll();
});

// ---------- 환생 이력 (사용자별) ----------
function openRebirthHistory(){
  const user = (typeof fbAuth !== 'undefined') ? fbAuth.currentUser : null;
  const nickname = state.nickname || '닉네임 미설정';
  const idLabel = user ? (user.isAnonymous ? '게스트' : (user.email || 'Google 계정')) : '연결 중...';

  const summaryEl = document.getElementById('rebirthHistorySummary');
  if(summaryEl){
    summaryEl.textContent = `${nickname} (${idLabel}) · 총 환생 횟수: ${state.rebirthCount || 0}회`;
  }

  const history = Array.isArray(state.rebirthHistory) ? state.rebirthHistory : [];
  const bodyEl = document.getElementById('rebirthHistoryBody');
  if(bodyEl){
    if(history.length === 0){
      bodyEl.innerHTML = `<p style="color:var(--text-dim);font-size:13px;">아직 환생 기록이 없습니다. 15층 이상 도달 후 환생하면 여기에 기록됩니다.</p>`;
    } else {
      const rows = history.slice().reverse().map(h => {
        const d = new Date(h.at);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `
          <div class="rebirth-history-row">
            <div class="rhr-order">#${h.order}</div>
            <div class="rhr-mid">
              <div class="rhr-date">${dateStr}</div>
              <div class="rhr-detail">Lv.${h.level||'-'} · 최고 ${h.floor}층 도달</div>
            </div>
            <div class="rhr-gain">🧪 +${h.gainSoul} &nbsp; ◈ +${h.gainFrag}</div>
          </div>`;
      }).join('');
      bodyEl.innerHTML = rows;
    }
  }

  document.getElementById('rebirthHistoryModal').style.display = 'flex';
}
document.getElementById('rebirthHistoryBtn')?.addEventListener('click', openRebirthHistory);

