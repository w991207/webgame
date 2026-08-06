// ---------- 황금 몬스터 (레어 보너스 스폰) ----------
// 평소 몬스터랑 별개로, 아주 낮은 확률로 화면 위에 반짝이는 황금 몬스터가 잠깐 나타난다.
// 제한 시간 안에 클릭하면 큰 보상을 즉시 주고, 못 누르면 그냥 사라진다.
// 지금 싸우고 있는 몬스터(state.monsterHp 등)와는 완전히 별개의 오버레이라
// 처치 진행도/스테이지 로직에는 전혀 영향을 주지 않는다 — 순수 보너스 이벤트.

const GOLDEN_CHECK_INTERVAL_MS = 1000;      // 스폰 여부를 확인하는 주기
const GOLDEN_SPAWN_CHANCE = 0.0025;         // 확인할 때마다 스폰될 확률 (평균 약 6~7분에 한 번꼴)
const GOLDEN_MIN_GAP_MS = 90 * 1000;        // 스폰 사이 최소 간격 (연달아 뜨는 것 방지)
const GOLDEN_LIFETIME_MS = 6000;            // 못 누르면 사라지기까지 시간
const GOLDEN_GOLD_MULT_MIN = 20;            // 평소 처치 보상 대비 배율 (하한)
const GOLDEN_GOLD_MULT_MAX = 45;            // 평소 처치 보상 대비 배율 (상한)

let goldenActive = false;
let goldenDespawnTimer = null;
let goldenLastSpawnAt = 0;

function goldenMonsterTick(){
  if(goldenActive) return;
  if(state.playerHp <= 0) return; // 죽어있는 상태에선 안 띄움
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

function despawnGoldenMonster(){
  const el = document.getElementById('goldenMonster');
  if(el){
    el.classList.remove('show');
    el.style.display = 'none';
  }
  goldenActive = false;
  goldenDespawnTimer = null;
}

function clickGoldenMonster(){
  if(!goldenActive) return;
  if(goldenDespawnTimer){ clearTimeout(goldenDespawnTimer); goldenDespawnTimer = null; }

  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
  const s = stats();
  const mult = GOLDEN_GOLD_MULT_MIN + Math.random() * (GOLDEN_GOLD_MULT_MAX - GOLDEN_GOLD_MULT_MIN);
  const bonusGold = Math.max(1, Math.round(goldDropFor(currentFloor, false) * s.goldMult * mult));
  const bonusFrag = 2 + Math.floor(Math.random() * 4); // 2~5개

  state.gold += bonusGold;
  state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
  state.fragments = (state.fragments||0) + bonusFrag;

  floatText('✨+'+bonusGold.toLocaleString()+'📦', 'good');
  log(`✨ 황금 몬스터를 처치했습니다! (+${bonusGold.toLocaleString()}📦, ◈ 유산 파편 +${bonusFrag})`, 'good');

  const el = document.getElementById('goldenMonster');
  if(el){
    el.classList.remove('show');
    el.classList.add('burst');
    setTimeout(()=>{ el.classList.remove('burst'); el.style.display = 'none'; }, 300);
  }
  goldenActive = false;

  if(typeof renderAll === 'function') renderAll();
}

document.getElementById('goldenMonster')?.addEventListener('click', clickGoldenMonster);
