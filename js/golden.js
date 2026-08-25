// ---------- 황금 몬스터 (레어 강화 조우) ----------
// 아주 낮은 확률로 화면 위에 반짝이는 황금 몬스터 표식이 잠깐 나타난다.
// 클릭하면 지금 싸우고 있는 몬스터가 그 자리에서 "황금 몬스터"로 변신(HP/공격/방어 대폭 강화)해
// 실제 전투로 처치해야 하고, 제한 시간 안에 못 잡으면 도망쳐서 원래 몬스터로 돌아간다.
// 처치하면 도감에도 "황금 몬스터"로 기록되고 큰 보너스 물자/유산 파편을 즉시 지급한다.

const GOLDEN_CHECK_INTERVAL_MS = 1000;      // 스폰 여부를 확인하는 주기
const GOLDEN_SPAWN_CHANCE = 0.0025;         // 확인할 때마다 스폰될 확률 (평균 약 6~7분에 한 번꼴)
const GOLDEN_MIN_GAP_MS = 90 * 1000;        // 스폰 사이 최소 간격 (연달아 뜨는 것 방지)
const GOLDEN_LIFETIME_MS = 180000;          // 표식을 못 누르면 사라지기까지 시간 (자리 비움 감안 3분)
const GOLDEN_BATTLE_TIME_MS = 20000;        // 변신 후 처치해야 하는 제한 시간 — 넘기면 도망감
const GOLDEN_HP_MULT = 9;                   // 그 층 일반 몬스터 대비 체력 배율
const GOLDEN_ATK_MULT = 2.4;                // 그 층 일반 몬스터 대비 공격력 배율
const GOLDEN_DEF_MULT = 1.6;                // 그 층 일반 몬스터 대비 방어력 배율
const GOLDEN_GOLD_MULT_MIN = 20;            // 처치 시 보너스 물자 — 평소 처치 보상 대비 배율(하한)
const GOLDEN_GOLD_MULT_MAX = 45;            // 처치 시 보너스 물자 — 평소 처치 보상 대비 배율(상한)

let goldenActive = false;       // 표식이 떠 있거나, 변신해서 전투 중인 상태 전체를 가리킴
let goldenDespawnTimer = null;  // 표식을 안 눌렀을 때 사라지는 타이머
let goldenBattleTimer = null;   // 변신 후 처치 제한시간 타이머
let goldenLastSpawnAt = 0;

function goldenMonsterTick(){
  if(goldenActive) return;
  if(state.playerHp <= 0) return;      // 죽어있는 상태에선 안 띄움
  if(state.isBoss) return;             // 보스전 중엔 등장하지 않음 (변신 시 처치 불가능한 난이도가 될 수 있어서)
  if(!(state.monsterHp > 0)) return;   // 싸울 몬스터가 없는 순간엔 스킵
  const now = Date.now();
  if(now - goldenLastSpawnAt < GOLDEN_MIN_GAP_MS) return;
  if(Math.random() >= GOLDEN_SPAWN_CHANCE) return;
  spawnGoldenMonster();
}

function spawnGoldenMonster(){
  const el = document.getElementById('goldenMonster');
  if(!el) return;

  goldenActive = true;
  goldenLastSpawnAt = Date.now();

  // 아레나 박스 안 랜덤 위치 (가장자리는 피해서 잘 보이게)
  const top = 12 + Math.random() * 45;   // 12% ~ 57%
  const left = 8 + Math.random() * 68;   // 8% ~ 76%
  el.style.top = top + '%';
  el.style.left = left + '%';
  el.style.display = 'flex';
  // 리플로우 강제 후 클래스 부여 (등장 애니메이션 재시작 보장)
  void el.offsetWidth;
  el.classList.add('show');

  goldenDespawnTimer = setTimeout(despawnGoldenMonster, GOLDEN_LIFETIME_MS);
}

// 표식을 못 누르고 시간이 지나 그냥 사라지는 경우 (전투 전환 전).
function despawnGoldenMonster(){
  const el = document.getElementById('goldenMonster');
  if(el){
    el.classList.remove('show');
    el.style.display = 'none';
  }
  goldenActive = false;
  goldenDespawnTimer = null;
}

// 표식 클릭 — 지금 싸우고 있는 몬스터를 황금 몬스터로 변신시킨다.
function clickGoldenMonster(){
  if(!goldenActive) return;
  // 클릭하는 사이 상황이 바뀌어(보스 조우/이미 변신 등) 변신시킬 수 없는 경우 그냥 표식만 치운다.
  if(state.isBoss || state.isGolden || !(state.monsterHp > 0)){
    despawnGoldenMonster();
    return;
  }
  if(goldenDespawnTimer){ clearTimeout(goldenDespawnTimer); goldenDespawnTimer = null; }

  const el = document.getElementById('goldenMonster');
  if(el){
    el.classList.remove('show');
    el.style.display = 'none';
  }

  const currentFloor = state.mode==='tower' ? state.towerFloor : (state.mode==='towerHard' ? state.htFloor : (state.mode==='towerVeryHard' ? state.vhFloor : state.floor));
  state.isGolden = true;
  state.monsterMaxHp = monsterHpFor(currentFloor, false, true);
  state.monsterHp = state.monsterMaxHp;

  log(`✨ 몬스터가 황금빛으로 변했습니다! ${Math.round(GOLDEN_BATTLE_TIME_MS/1000)}초 안에 처치하세요!`, 'good');
  if(typeof renderMonster === 'function') renderMonster();
  if(typeof renderAll === 'function') renderAll();

  goldenBattleTimer = setTimeout(fleeGoldenMonster, GOLDEN_BATTLE_TIME_MS);
}

// 원정/스폰 등으로 몬스터가 바뀔 때 combat.js(spawnMonster)에서 호출 — 남은 도망 타이머를 정리.
function clearGoldenBattleTimer(){
  if(goldenBattleTimer){ clearTimeout(goldenBattleTimer); goldenBattleTimer = null; }
}

// 제한 시간 안에 처치하지 못해 도망치는 경우.
function fleeGoldenMonster(){
  goldenBattleTimer = null;
  if(!state.isGolden) return; // 이미 처치되어 넘어간 경우
  state.isGolden = false;
  goldenActive = false;
  log('✨ 황금 몬스터가 도망쳤습니다...', 'warn');
  if(typeof spawnMonster === 'function') spawnMonster();
  if(typeof renderAll === 'function') renderAll();
}

// 처치 성공 시 combat.js(dealDamageToMonster)에서 호출 — 보너스 물자/유산 파편 지급.
function awardGoldenKillBonus(currentFloor, s){
  clearGoldenBattleTimer();
  goldenActive = false;
  const mult = GOLDEN_GOLD_MULT_MIN + Math.random() * (GOLDEN_GOLD_MULT_MAX - GOLDEN_GOLD_MULT_MIN);
  const bonusGold = Math.max(1, Math.round(goldDropFor(currentFloor, false) * s.goldMult * mult));
  const bonusFrag = 2 + Math.floor(Math.random() * 4); // 2~5개

  state.gold += bonusGold;
  state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
  state.fragments = (state.fragments||0) + bonusFrag;

  floatText('✨+'+bonusGold.toLocaleString()+'📦', 'good');
  log(`✨ 황금 몬스터 처치 보너스! +${bonusGold.toLocaleString()}📦, ◈ 유산 파편 +${bonusFrag}`, 'good');
}

document.getElementById('goldenMonster')?.addEventListener('click', clickGoldenMonster);
