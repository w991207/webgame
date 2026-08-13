// ---------- ⚔️ 몬스터 처치 패스 ----------
// 누적 처치(state.totalKills) 기준으로 KILL_PASS_TIERS를 순서대로 하나씩만 수령할 수 있는
// 장기 보상 트랙. state.killPassClaimed는 "이미 수령 완료한 단계 수"이며, 그 다음 인덱스
// (KILL_PASS_TIERS[state.killPassClaimed])가 항상 "다음에 받을 단계"가 된다.

function killPassNextTier(){
  return KILL_PASS_TIERS[state.killPassClaimed || 0] || null;
}

// 지금 바로 수령 가능한(target을 이미 넘겼는데 아직 안 받은) 단계 수
function killPassClaimableCount(){
  let claimed = state.killPassClaimed || 0;
  let count = 0;
  while(claimed + count < KILL_PASS_TIERS.length && state.totalKills >= KILL_PASS_TIERS[claimed + count].target){
    count++;
  }
  return count;
}

// 보상 지급(공용 로직). silent=true면 개별 로그를 남기지 않음(모아받기용).
function killPassGrantReward(tier, silent){
  const r = tier.rewards;
  if(r.gold){
    state.gold += r.gold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned || 0) + r.gold;
  }
  if(r.frag) state.fragments += r.frag;
  if(r.soul) state.soul += r.soul;
  if(r.stone){
    state.enhanceStone += r.stone;
    state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned || 0) + r.stone;
  }
  if(tier.special === 'pull' && typeof RELICS !== 'undefined'){
    const picked = RELICS[Math.floor(Math.random() * RELICS.length)];
    state.relics[picked.key]++;
    if(!silent) log(`🎁 처치 패스 ${tier.tier}단계: 무료 유산 뽑기 → ${picked.icon} ${picked.name}!`, 'good');
  } else if(!silent){
    log(`⚔️ 처치 패스 ${tier.tier}단계 보상 수령!`, 'good');
  }
}

function claimKillPassTier(){
  const idx = state.killPassClaimed || 0;
  const tier = KILL_PASS_TIERS[idx];
  if(!tier) return;
  if(state.totalKills < tier.target) return;
  killPassGrantReward(tier, false);
  state.killPassClaimed = idx + 1;
  renderKillPassPanel();
  renderAll();
  saveState(true);
}

function claimAllKillPassTiers(){
  const startCount = killPassClaimableCount();
  if(startCount <= 0){
    alert('아직 수령 가능한 처치 패스 보상이 없습니다.');
    return;
  }
  for(let i=0;i<startCount;i++){
    const idx = state.killPassClaimed || 0;
    const tier = KILL_PASS_TIERS[idx];
    if(!tier || state.totalKills < tier.target) break;
    killPassGrantReward(tier, true);
    state.killPassClaimed = idx + 1;
  }
  log(`⚔️ 처치 패스 보상 ${startCount}단계분을 한꺼번에 수령했습니다! (현재 ${state.killPassClaimed}단계)`, 'good');
  renderKillPassPanel();
  renderAll();
  saveState(true);
}

function killPassRewardText(tier){
  const parts = [];
  if(tier.rewards.gold) parts.push(`📦${tier.rewards.gold.toLocaleString()}`);
  if(tier.rewards.frag) parts.push(`◈${tier.rewards.frag.toLocaleString()}`);
  if(tier.rewards.soul) parts.push(`🧪${tier.rewards.soul.toLocaleString()}`);
  if(tier.rewards.stone) parts.push(`🔩${tier.rewards.stone.toLocaleString()}`);
  if(tier.special === 'pull') parts.push('🎁뽑기');
  if(tier.special === 'title') parts.push('🏅칭호');
  return parts.join(' ');
}

function renderKillPassPanel(){
  const track = document.getElementById('killPassTrack');
  if(!track) return;

  const claimed = state.killPassClaimed || 0;
  const claimable = killPassClaimableCount();
  const next = killPassNextTier();

  const tierText = document.getElementById('killPassTierText');
  if(tierText) tierText.textContent = `${claimed} / ${KILL_PASS_TIER_COUNT}단계`;

  const progressFill = document.getElementById('killPassProgressFill');
  const progressText = document.getElementById('killPassProgressText');
  if(progressFill && progressText){
    if(!next){
      progressFill.style.width = '100%';
      progressText.textContent = `🏆 처치 패스 전 단계 완주! (누적 처치 ${Math.floor(state.totalKills).toLocaleString()})`;
    } else {
      const prevTarget = claimed > 0 ? KILL_PASS_TIERS[claimed - 1].target : 0;
      const span = Math.max(1, next.target - prevTarget);
      const pct = Math.max(0, Math.min(100, (state.totalKills - prevTarget) / span * 100));
      progressFill.style.width = pct.toFixed(1) + '%';
      progressText.textContent = `누적 처치 ${Math.floor(state.totalKills).toLocaleString()} / ${next.target.toLocaleString()} (다음: ${next.tier}단계)`;
    }
  }

  // 카드 DOM은 최초 1회만 만들고 이후엔 클래스/텍스트만 갱신 (50개 카드 매번 재생성 방지)
  if(!track.dataset.built){
    track.innerHTML = KILL_PASS_TIERS.map(t => `
      <div class="killpass-tier-card" data-tier="${t.tier}">
        <div class="killpass-tier-num">${t.tier}</div>
        <div class="killpass-tier-target">${t.target.toLocaleString()}킬</div>
        <div class="killpass-tier-reward">${killPassRewardText(t)}</div>
        <div class="killpass-tier-state"></div>
      </div>
    `).join('');
    track.dataset.built = '1';
  }

  KILL_PASS_TIERS.forEach(t=>{
    const card = track.querySelector(`.killpass-tier-card[data-tier="${t.tier}"]`);
    if(!card) return;
    const done = t.tier <= claimed;
    const isNext = t.tier === claimed + 1;
    const ready = done ? false : state.totalKills >= t.target;
    card.classList.toggle('done', done);
    card.classList.toggle('ready', ready);
    card.classList.toggle('next', isNext && !ready);
    const stateEl = card.querySelector('.killpass-tier-state');
    stateEl.textContent = done ? '✅ 완료' : (ready ? '🎁 수령가능' : '🔒 대기');
  });

  const claimAllBtn = document.getElementById('killPassClaimAllBtn');
  if(claimAllBtn){
    claimAllBtn.disabled = claimable <= 0;
    claimAllBtn.textContent = claimable > 0 ? `모아서 받기 (${claimable}단계)` : '모아서 받기';
  }
}

document.getElementById('killPassClaimAllBtn')?.addEventListener('click', claimAllKillPassTiers);
document.getElementById('killPassTrack')?.addEventListener('click', (e)=>{
  const card = e.target.closest('.killpass-tier-card');
  if(!card) return;
  const tier = parseInt(card.dataset.tier, 10);
  const claimed = state.killPassClaimed || 0;
  if(tier === claimed + 1) claimKillPassTier();
});
