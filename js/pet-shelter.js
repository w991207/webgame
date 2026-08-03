// ---------- 동료 쉼터 (Pet Shelter) ----------
// 보유한 동료들을 작은 보금자리에 모아두고, 하루 한 번씩 간식을 줄 수 있는 가벼운 인터랙션.
// 스탯 파워업이 아니라 순수하게 "귀여운 손맛"을 위한 컨텐츠라 보상은 소소하게 잡는다.

// 동료별 간식 반응 대사 (여러 개 중 랜덤 출력). 아직 없는 동료엔 공용 대사를 사용.
const PET_FEED_LINES = {
  dragonPet: ['🤖 전투 드론이 기름칠을 받고 반짝거립니다!', '🤖 위잉- 위잉- 신난 소리를 냅니다.'],
  jellyPet:  ['💊 의료 드론이 삐빅- 감사 신호를 보냅니다.', '💊 조심스럽게 다가와 스캔합니다. 기분이 좋아보여요.'],
  crowPet:   ['🐦 정찰 까마귀가 고개를 갸웃하며 간식을 쪼아먹습니다.', '🐦 만족스러운 듯 깃털을 다듬습니다.'],
  owlPet:    ['🦉 정찰 부엉이가 눈을 크게 뜨고 쳐다봅니다.', '🦉 부엉- 하고 작게 웁니다.'],
  fairyPet:  ['🐁 탐지 쥐가 볼주머니에 간식을 쏙 넣습니다.', '🐁 꼬물꼬물 기뻐하며 한 바퀴 돕니다.'],
  wolfPet:   ['🐺 변이 늑대가 꼬리를 살랑입니다.', '🐺 낮게 그르릉거리지만 왠지 기분 좋아보여요.'],
};
const PET_FEED_LINES_DEFAULT = ['냠냠, 맛있게 먹었습니다!'];

const PET_AFFECTION_MILESTONES = [5, 15, 30, 60, 100];

function petFeedCost(key){
  const lvl = state.pets[key] || 0;
  return Math.round(15 + lvl * 4); // 물자로 지불, 레벨 비례해서 살짝만 오름 (부담 없는 수준 유지)
}

function petAlreadyFedToday(key){
  const last = state.petLastFed && state.petLastFed[key];
  return !!last && isSameDay(last, Date.now());
}

function feedPet(key){
  if(!state.pets || !(state.pets[key] > 0)) return;
  if(petAlreadyFedToday(key)) return;
  const cost = petFeedCost(key);
  if(state.gold < cost) return;

  state.gold -= cost;
  if(!state.petAffection) state.petAffection = {};
  if(!state.petLastFed) state.petLastFed = {};
  state.petAffection[key] = (state.petAffection[key] || 0) + 1;
  state.petLastFed[key] = Date.now();

  const p = PETS.find(x => x.key === key);
  const lines = PET_FEED_LINES[key] || PET_FEED_LINES_DEFAULT;
  const line = lines[Math.floor(Math.random() * lines.length)];
  log(line, 'good');

  if(PET_AFFECTION_MILESTONES.includes(state.petAffection[key])){
    const bonus = state.petAffection[key]; // 마일스톤 숫자만큼 파편 보너스 (소소한 축하 보상)
    state.fragments += bonus;
    log(`🎉 ${p.icon} ${p.name}과(와)의 친밀도가 깊어졌습니다! 유산 파편 +${bonus}개`, 'good');
  }

  renderAll();
}

function petAffectionLabel(key){
  const n = (state.petAffection && state.petAffection[key]) || 0;
  if(n >= 100) return '💞 최고의 단짝';
  if(n >= 60) return '💗 각별한 사이';
  if(n >= 30) return '💓 친한 친구';
  if(n >= 15) return '💕 친해지는 중';
  if(n >= 5) return '🤍 조금 낯가림';
  return '🤍 처음 만남';
}

function renderPetShelter(){
  const grid = document.getElementById('petShelterGrid');
  if(!grid) return;
  const owned = PETS.filter(p => (state.pets[p.key] || 0) > 0);

  if(owned.length === 0){
    grid.innerHTML = `<div class="pet-shelter-empty">아직 쉼터에 머무는 동료가 없어요. 동료를 먼저 소환해보세요!</div>`;
    return;
  }

  grid.innerHTML = '';
  owned.forEach(p => {
    const lvl = state.pets[p.key] || 0;
    const fed = petAlreadyFedToday(p.key);
    const cost = petFeedCost(p.key);
    const affection = (state.petAffection && state.petAffection[p.key]) || 0;
    const nextMilestone = PET_AFFECTION_MILESTONES.find(m => m > affection);
    const card = document.createElement('div');
    card.className = 'pet-shelter-card';
    card.innerHTML = `
      <div class="pet-shelter-icon">${p.icon}</div>
      <div class="pet-shelter-name">${p.name} <span class="pet-shelter-lvl">Lv.${lvl}</span></div>
      <div class="pet-shelter-affection">${petAffectionLabel(p.key)} (${affection}${nextMilestone ? ` / 다음 ${nextMilestone}` : ''})</div>
      <button class="pet-feed-btn" type="button" data-key="${p.key}" ${(fed || state.gold < cost) ? 'disabled' : ''}>
        ${fed ? '오늘은 이미 줬어요' : `🍖 간식주기 (${cost.toLocaleString()}📦)`}
      </button>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.pet-feed-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>feedPet(btn.dataset.key));
  });
}
