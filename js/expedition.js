// ---------- 원정대 (Expedition) ----------
// 영지 탭 안에서, 보유한 동료를 정찰/원정/장기 원정에 파견해 시간이 지나면
// 물자/유산 파편/혈청(+장기 원정은 확률로 강화석)을 받아오는 방치형 콘텐츠.
//
// 설계 요점:
//  - 동료는 "소모"되지 않는다. 원정 중에도 petTick 전투 효과·동행 보너스는 그대로 유지되고,
//    다만 같은 동료를 동시에 두 곳에 중복 파견하는 것만 막는다 (파견 슬롯 점유 개념).
//  - 슬롯은 기본 3개 고정 (state.expeditionMaxSlots) — 레이드 티켓처럼 "동시에 몇 개까지"를 제한.
//  - 완료된 원정은 자동으로 지급되지 않고 직접 "수령"해야 보상이 들어오고 슬롯/동료가 풀린다.
//  - 보상 성장은 파견 시점의 동료 레벨(중복 소환 횟수)에 비례 (레벨당 +8%), ±10% 랜덤 편차.

const EXPEDITION_LEVEL_GROWTH = 0.08; // 동료 레벨(=중복 소환 횟수)당 보상 +8%
const EXPEDITION_STAGE_GROWTH = 0.03; // 최고 도달 층당 보상 +3% (파견 시점 기준)

function expeditionMissionDef(key){
  return EXPEDITION_MISSIONS.find(m => m.key === key);
}

// 지금 파견 중인(수령 전 포함) 동료 key 집합 — 이 동료들은 새 원정에 다시 보낼 수 없음.
function expeditionOccupiedPetKeys(){
  return new Set(state.expeditions.map(e => e.petKey));
}

// 소수 기대값을 정수로 자연스럽게 변환 (예: 1.3 → 70% 확률로 1, 30% 확률로 2).
function rollFractional(v){
  const base = Math.floor(v);
  const frac = v - base;
  return base + (Math.random() < frac ? 1 : 0);
}

// 파견 시점 기준 "예상 보상"(레벨+스테이지 반영, 편차 제외) — UI 미리보기용.
function expeditionPreviewFor(mission, petLvl, stage){
  const levelGrowth = 1 + Math.max(0, petLvl - 1) * EXPEDITION_LEVEL_GROWTH;
  const stageGrowth = 1 + Math.max(0, (stage || 1) - 1) * EXPEDITION_STAGE_GROWTH;
  const growth = levelGrowth * stageGrowth;
  return {
    gold: Math.round(mission.rewardBase.gold * growth),
    fragment: Math.round(mission.rewardBase.fragment * growth * 10) / 10,
    soul: Math.round(mission.rewardBase.soul * growth * 10) / 10,
  };
}

// 실제 수령 시점의 최종 보상 (레벨 성장 + 랜덤 편차 ±10%, 파편/혈청은 소수 기대값을 정수로 굴림).
function expeditionRewardFor(exp){
  const mission = expeditionMissionDef(exp.missionKey);
  if(!mission) return {gold:0, fragment:0, soul:0};
  const lvl = exp.petLvl || 1;
  const stage = exp.stage || 1;
  const levelGrowth = 1 + Math.max(0, lvl - 1) * EXPEDITION_LEVEL_GROWTH;
  const stageGrowth = 1 + Math.max(0, stage - 1) * EXPEDITION_STAGE_GROWTH;
  const growth = levelGrowth * stageGrowth;
  const variance = 0.9 + Math.random() * 0.2;
  const factor = growth * variance;
  const result = {
    gold: Math.round(mission.rewardBase.gold * factor),
    fragment: rollFractional(mission.rewardBase.fragment * factor),
    soul: rollFractional(mission.rewardBase.soul * factor),
  };
  if(mission.bonusEnhanceStoneChance && Math.random() < mission.bonusEnhanceStoneChance){
    const [lo, hi] = mission.bonusEnhanceStoneRange;
    result.enhanceStone = lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  return result;
}

function dispatchExpedition(missionKey, petKey){
  const mission = expeditionMissionDef(missionKey);
  if(!mission) return;
  if(!state.pets || !(state.pets[petKey] > 0)) return;
  if(expeditionOccupiedPetKeys().has(petKey)) return;
  const maxSlots = state.expeditionMaxSlots || 3;
  if(state.expeditions.length >= maxSlots) return;

  const p = PETS.find(x => x.key === petKey);
  const now = Date.now();
  state.expeditions.push({
    id: 'exp_' + now + '_' + Math.random().toString(36).slice(2, 7),
    petKey, missionKey,
    startAt: now,
    endAt: now + mission.durationMs,
    petLvl: state.pets[petKey],
    stage: state.highestFloor || 1,
  });
  log(`🧭 ${p ? p.icon : '🐾'} ${p ? p.name : '동료'}을(를) ${mission.icon} ${mission.name}에 파견했습니다!`, 'good');
  renderAll();
}

function claimExpedition(id){
  const idx = state.expeditions.findIndex(e => e.id === id);
  if(idx < 0) return;
  const exp = state.expeditions[idx];
  if(Date.now() < exp.endAt) return;

  const reward = expeditionRewardFor(exp);
  state.gold += reward.gold;
  state.fragments += reward.fragment;
  state.soul += reward.soul;
  if(reward.enhanceStone){
    state.enhanceStone = (state.enhanceStone || 0) + reward.enhanceStone;
    state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned || 0) + reward.enhanceStone;
  }

  const mission = expeditionMissionDef(exp.missionKey);
  const p = PETS.find(x => x.key === exp.petKey);
  state.expeditions.splice(idx, 1);

  const parts = [];
  if(reward.gold) parts.push(`+${reward.gold.toLocaleString()}📦`);
  if(reward.fragment) parts.push(`+${reward.fragment}◈`);
  if(reward.soul) parts.push(`+${reward.soul}🧪`);
  if(reward.enhanceStone) parts.push(`+${reward.enhanceStone}🔨`);
  log(`🧭 ${p ? p.icon : '🐾'} ${p ? p.name : '동료'}이(가) ${mission ? mission.name : '원정'}에서 돌아왔습니다! ${parts.join(' ') || '(빈손으로...)'}`, 'good');
  renderAll();
}

function claimAllReadyExpeditions(){
  const readyIds = state.expeditions.filter(e => Date.now() >= e.endAt).map(e => e.id);
  readyIds.forEach(id => claimExpedition(id));
}
document.getElementById('expeditionClaimAllBtn')?.addEventListener('click', claimAllReadyExpeditions);

// mm:ss로는 8시간짜리 원정 표시가 어색해서(예: 480:00), 시/분 단위 전용 포맷을 따로 둔다.
function formatExpeditionDuration(ms){
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if(h > 0) return `${h}시간 ${String(m).padStart(2,'0')}분`;
  if(m > 0) return `${m}분 ${String(s).padStart(2,'0')}초`;
  return `${s}초`;
}

// 원정 카드마다 고정된 몬스터 이모지를 배정 (id 해시 기반 — 같은 원정이면 매번 같은 몬스터).
const EXP_SCENE_MONSTERS = ['🦇','🕷️','💀','🐺','🧟','👹','🐗'];
function expSceneMonsterFor(id){
  let h = 0;
  for(let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EXP_SCENE_MONSTERS[h % EXP_SCENE_MONSTERS.length];
}

// 카드 최초 생성 시에만 호출 — 애니메이션이 도는 미니맵(씬)은 이후 재렌더에서 절대 다시 만들지 않는다
// (innerHTML로 매번 새로 그리면 CSS 애니메이션이 1초마다 처음으로 리셋돼서 걷기/점프/전투 장면이 안 보임).
function buildExpeditionActiveCard(exp){
  const p = PETS.find(x => x.key === exp.petKey);
  const monster = expSceneMonsterFor(exp.id);
  const petFace = p ? petIconHtml(p, 20) : '🐾';
  const card = document.createElement('div');
  card.className = 'relic-card';
  card.dataset.expCard = exp.id;
  card.innerHTML = `
    <div class="rname"><span>${petFace} ${p ? p.name : '알 수 없는 동료'}</span><span class="rlvl" data-role="mission"></span></div>
    <div class="exp-scene" data-role="scene">
      <div class="exp-pet"><span class="exp-pet-body">${petFace}</span></div>
      <div class="exp-monster">${monster}</div>
      <div class="exp-hit-spark">💥</div>
    </div>
    <div class="quest-progress-outer"><div class="quest-progress-inner" data-role="bar" style="width:0%;"></div></div>
    <div class="rdesc" data-role="desc"></div>
    <button class="pet-feed-btn" type="button" data-claim="${exp.id}">탐험 중...</button>
  `;
  card.querySelector('[data-claim]').addEventListener('click', () => claimExpedition(exp.id));
  return card;
}

// 매초 호출 — 타이머 텍스트/진행바/버튼 상태만 갱신하고, 씬(.exp-scene) 내부는 절대 건드리지 않는다.
function updateExpeditionActiveCard(card, exp){
  const mission = expeditionMissionDef(exp.missionKey);
  const remain = Math.max(0, exp.endAt - Date.now());
  const ready = remain <= 0;
  const totalMs = Math.max(1, exp.endAt - exp.startAt);
  const pct = ready ? 100 : Math.min(100, ((totalMs - remain) / totalMs) * 100);

  card.classList.toggle('owned', ready);
  const missionEl = card.querySelector('[data-role="mission"]');
  if(missionEl) missionEl.textContent = mission ? `${mission.icon} ${mission.name}` : '';
  const bar = card.querySelector('[data-role="bar"]');
  if(bar){ bar.style.width = pct.toFixed(1) + '%'; bar.classList.toggle('done', ready); }
  const desc = card.querySelector('[data-role="desc"]');
  if(desc) desc.textContent = ready ? '✅ 도착 완료! 보상을 수령하세요.' : `⏳ 남은 시간: ${formatExpeditionDuration(remain)}`;
  const scene = card.querySelector('[data-role="scene"]');
  if(scene) scene.classList.toggle('idle', ready);
  const btn = card.querySelector('[data-claim]');
  if(btn){ btn.disabled = !ready; btn.textContent = ready ? '🎁 보상 수령' : '탐험 중...'; }
}

function renderExpeditionPanel(){
  const activeGrid = document.getElementById('expeditionActiveGrid');
  const dispatchGrid = document.getElementById('expeditionDispatchGrid');
  if(!activeGrid || !dispatchGrid) return;

  const maxSlots = state.expeditionMaxSlots || 3;
  const slotText = document.getElementById('expeditionSlotText');
  if(slotText) slotText.textContent = `${state.expeditions.length} / ${maxSlots}`;

  // ---------- 파견 중인 원정 카드 (기존 DOM/애니메이션을 유지한 채 내용만 갱신) ----------
  if(state.expeditions.length === 0){
    if(!activeGrid.querySelector('.pet-shelter-empty') || activeGrid.children.length !== 1){
      activeGrid.innerHTML = `<div class="pet-shelter-empty">파견 중인 원정대가 없습니다. 아래에서 동료를 파견해보세요!</div>`;
    }
  } else {
    const emptyNotice = activeGrid.querySelector('.pet-shelter-empty');
    if(emptyNotice) activeGrid.innerHTML = '';

    const seen = new Set();
    state.expeditions.forEach((exp, i) => {
      seen.add(exp.id);
      let card = activeGrid.querySelector(`[data-exp-card="${exp.id}"]`);
      if(!card){
        card = buildExpeditionActiveCard(exp);
      }
      const atIndex = activeGrid.children[i];
      if(atIndex !== card) activeGrid.insertBefore(card, atIndex || null);
      updateExpeditionActiveCard(card, exp);
    });
    activeGrid.querySelectorAll('[data-exp-card]').forEach(card => {
      if(!seen.has(card.dataset.expCard)) card.remove();
    });
  }

  const claimAllBtn = document.getElementById('expeditionClaimAllBtn');
  if(claimAllBtn){
    const anyReady = state.expeditions.some(e => Date.now() >= e.endAt);
    claimAllBtn.disabled = !anyReady;
  }

  // ---------- 파견 가능한 임무 + 동료 선택 ----------
  const occupied = expeditionOccupiedPetKeys();
  const ownedPets = PETS.filter(p => (state.pets[p.key] || 0) > 0);
  const slotFull = state.expeditions.length >= maxSlots;

  const slotFullNotice = slotFull
    ? `<div class="rdesc" style="color:var(--hp);margin-bottom:8px;">모든 원정 슬롯이 가득 찼습니다. 완료된 원정을 수령해야 새로 파견할 수 있어요.</div>`
    : '';

  dispatchGrid.innerHTML = slotFullNotice + EXPEDITION_MISSIONS.map(mission => {
    const preview = expeditionPreviewFor(mission, 1, state.highestFloor || 1);
    const petButtons = ownedPets.length > 0
      ? ownedPets.map(p => {
          const lvl = state.pets[p.key];
          const busy = occupied.has(p.key);
          const disabled = busy || slotFull;
          const title = busy ? '이미 다른 원정에 파견 중' : (slotFull ? '원정 슬롯이 가득 참' : '');
          return `<button class="pet-feed-btn" type="button" data-mission="${mission.key}" data-pet="${p.key}" ${disabled ? 'disabled' : ''} title="${title}">
            ${petIconHtml(p, 16)} ${p.name} <span style="opacity:.7;">Lv.${lvl}</span>
          </button>`;
        }).join('')
      : `<span style="font-size:11px;color:var(--text-dim);">보유한 동료가 없습니다. 먼저 동료를 소환해보세요!</span>`;
    return `
      <div class="relic-card">
        <div class="rname"><span>${mission.icon} ${mission.name}</span><span class="rlvl">${formatExpeditionDuration(mission.durationMs)}</span></div>
        <div class="rdesc">${mission.desc}</div>
        <div class="rdesc" style="color:var(--gold);">예상 보상(Lv.1 · ${state.highestFloor || 1}층 기준): 📦${preview.gold.toLocaleString()} · ◈${preview.fragment} · 🧪${preview.soul}${mission.bonusEnhanceStoneChance ? ` · 🔨확률 획득` : ''}</div>
        <div class="pet-dispatch-row">${petButtons}</div>
      </div>
    `;
  }).join('');
  dispatchGrid.querySelectorAll('[data-mission][data-pet]').forEach(btn => {
    btn.addEventListener('click', () => dispatchExpedition(btn.dataset.mission, btn.dataset.pet));
  });
}
