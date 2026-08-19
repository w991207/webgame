// ---------- 동료 쉼터 (Pet Shelter) ----------
// 보유한 동료들을 작은 보금자리에 모아두고, 하루 한 번씩 간식을 줄 수 있는 가벼운 인터랙션.
// 스탯 파워업이 아니라 순수하게 "귀여운 손맛"을 위한 컨텐츠라 보상은 소소하게 잡는다.

// 동료별 간식 반응 대사 (여러 개 중 랜덤 출력). 아직 없는 동료엔 공용 대사를 사용.
const PET_FEED_LINES = {
  dragonPet: ['🌭 전투 소세지가 기름칠을 받고 반짝거립니다!', '🌭 위잉- 위잉- 신난 소리를 냅니다.'],
  jellyPet:  ['🌭 용맹한 소세지가 삐빅- 감사 신호를 보냅니다.', '🌭 조심스럽게 다가와 스캔합니다. 기분이 좋아보여요.'],
  crowPet:   ['🌭 분홍소세지가 고개를 갸웃하며 간식을 쪼아먹습니다.', '🌭 만족스러운 듯 몸을 흔듭니다.'],
  owlPet:    ['🦉 정찰 부엉이가 눈을 크게 뜨고 쳐다봅니다.', '🦉 부엉- 하고 작게 웁니다.'],
  fairyPet:  ['🐁 탐지 쥐가 볼주머니에 간식을 쏙 넣습니다.', '🐁 꼬물꼬물 기뻐하며 한 바퀴 돕니다.'],
  wolfPet:   ['🐺 변이 늑대가 꼬리를 살랑입니다.', '🐺 낮게 그르릉거리지만 왠지 기분 좋아보여요.'],
  lizardPet: ['🦎 독니 도마뱀이 혀를 날름거리며 간식을 낚아챕니다.', '🦎 만족스럽게 눈을 깜빡입니다.'],
  octopusPet:['🐙 문어 소세지가 먹물 대신 기포를 뽀글뽀글 냅니다.', '🐙 다리(?)를 살랑이며 간식 주위를 맴돕니다.'],
  woundedPet:['🩹 상처입은 소세지가 씩씩하게 간식을 받아먹습니다.', '🩹 살짝 절뚝이지만 꼬리는 힘차게 흔듭니다.'],
  chiliChickenPet:['🌶️ 청양고추닭가슴살소세지가 매운 눈물을 찔끔 흘리면서도 잘 먹습니다.', '🌶️ 화이팅 포즈로 주먹을 불끈 쥡니다.'],
  breadPet:['🥖 빵소세지가 냠냠 배부르게 받아먹습니다.', '🥖 포만감에 스르륵 눈이 감깁니다.'],
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

  ensurePetShelterRoom(owned);

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
      <div class="pet-shelter-icon">${petIconHtml(p, 34)}</div>
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

// ---------- 쉼터 마당 (동료들이 자유롭게 돌아다니는 연출) ----------
// renderPetShelter()는 1초 주기 renderAll()에서도 계속 호출되므로, 매번 innerHTML을
// 새로 그리면 걷는 도중 위치가 매번 리셋돼버린다. 그래서 "보유 동료 구성"이 실제로
// 바뀔 때만(새 동료 소환 등) 마당을 다시 그리고, 위치 이동은 별도 인터벌이 담당한다.
let petRoomSignature = '';
let petRoomWanderTimer = null;

function ensurePetShelterRoom(owned){
  const room = document.getElementById('petShelterRoom');
  if(!room) return;

  if(owned.length === 0){
    room.style.display = 'none';
    room.innerHTML = '';
    petRoomSignature = '';
    if(petRoomWanderTimer){ clearInterval(petRoomWanderTimer); petRoomWanderTimer = null; }
    return;
  }
  room.style.display = '';

  const sig = owned.map(p => p.key).join(',');
  if(sig === petRoomSignature) return; // 구성 그대로면 다시 안 그림 — 걷는 애니메이션 유지
  petRoomSignature = sig;

  room.innerHTML = '';
  owned.forEach(p => {
    const el = document.createElement('div');
    el.className = 'pet-wander';
    el.dataset.key = p.key;
    el.title = `${p.name} · 클릭해서 간식 주기`;
    el.style.left = (10 + Math.random() * 76) + '%';
    el.style.top = (14 + Math.random() * 62) + '%';
    el.innerHTML = `<span class="pet-wander-flip"><span class="pet-wander-face">${petIconHtml(p, 30)}</span></span>`;
    el.addEventListener('click', () => feedPet(p.key));
    room.appendChild(el);
  });

  wanderPetShelter(); // 배치 직후 바로 첫 목적지를 줘서 멈춰있지 않게 함
  if(petRoomWanderTimer) clearInterval(petRoomWanderTimer);
  petRoomWanderTimer = setInterval(wanderPetShelter, 2600);
}

function wanderPetShelter(){
  const room = document.getElementById('petShelterRoom');
  if(!room) return;
  room.querySelectorAll('.pet-wander').forEach(el => {
    const prevLeft = parseFloat(el.style.left) || 50;
    const nextLeft = 6 + Math.random() * 80;
    const nextTop = 10 + Math.random() * 68;
    const flipWrap = el.querySelector('.pet-wander-flip');
    if(flipWrap) flipWrap.classList.toggle('flip', nextLeft < prevLeft);
    el.style.left = nextLeft + '%';
    el.style.top = nextTop + '%';
  });
}
