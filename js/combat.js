// 일반모드(폐허) 전용 고층 난이도 보정.
// 1~999층은 기존과 동일(배율 1배), 1000층마다 한 단계씩 아래 배율만큼 몬스터 전체 스탯이
// 추가로 복리로 강해진다. 플레이어 쪽 성장(장비/유산/돌연변이/환생)이 전부 곱연산 배율이라
// 층수의 거듭제곱만으로는 못 따라가는 고층 구간에서, 몬스터도 같이 곱연산으로 세지게 만들어
// "몹이 아예 안 아프다" 현상을 막기 위한 장치.
// NORMAL_TIER_MULT 값만 조절하면 강해지는 속도를 바로 튜닝할 수 있음 (1.35 = 1000층마다 +35%씩 누적).
const NORMAL_TIER_SIZE = 1000;
const NORMAL_TIER_MULT = 1.35;
function normalTierMult(floor){
  const tier = Math.floor(floor / NORMAL_TIER_SIZE); // 1~999층=0단계, 1000~1999층=1단계...
  return Math.pow(NORMAL_TIER_MULT, tier);
}

// ---------- 1000층마다 순환하는 회랑 테마 ----------
// 0단계(1~999층): 기본 석조 회랑 / 1단계(1000~1999층): 독/이끼 / 2단계(2000~2999층): 얼음/룬
// 3단계(3000~3999층): 화염/용암, 이후 4000층부터는 다시 0단계로 돌아가 4개 테마가 계속 순환한다.
const CORRIDOR_TIERS = [
  {name:'', className:''},
  {name:'☣️ 독의 회랑', className:'arch-tier-1'},
  {name:'❄️ 서리의 회랑', className:'arch-tier-2'},
  {name:'🔥 화염의 회랑', className:'arch-tier-3'},
];
function corridorTierFor(floor){
  return Math.floor(floor / NORMAL_TIER_SIZE) % CORRIDOR_TIERS.length;
}
function applyCorridorTheme(){
  const box = document.getElementById('arenaBox');
  const badge = document.getElementById('floorTierBadge');
  if(!box) return;
  const tierIdx = (state.mode === 'normal') ? corridorTierFor(state.floor) : 0;
  CORRIDOR_TIERS.forEach(t=>{ if(t.className) box.classList.remove(t.className); });
  const tier = CORRIDOR_TIERS[tierIdx];
  if(tier.className) box.classList.add(tier.className);
  if(badge){
    if(tierIdx === 0){
      badge.style.display = 'none';
    } else {
      badge.style.display = 'inline-block';
      badge.className = 'tier-badge tier-' + tierIdx;
      badge.textContent = tier.name;
    }
  }
}

// ---------- Monster generation ----------
function monsterHpFor(floor, boss, golden){
  if(state.mode === 'tower'){
    let hp = Math.round(50 * Math.pow(floor, 1.3));
    if(golden) hp *= GOLDEN_HP_MULT;
    return Math.round(hp);
  }
  if(state.mode === 'towerHard'){
    let hp = Math.round(300 * Math.pow(floor, 1.5));
    if(golden) hp *= GOLDEN_HP_MULT;
    return Math.round(hp);
  }
  let hp =
  Math.round(
    35 * Math.pow(floor, 1.45)
  );
  if(boss)
    hp *= 6;
  hp = Math.round(hp * normalTierMult(floor));
  if(golden) hp *= GOLDEN_HP_MULT;
  return Math.round(hp);
}
function monsterAtkFor(floor, boss, golden){

  if(state.mode === 'tower'){
    let atk = Math.round(
      10 + floor*8
    );
    if(golden) atk *= GOLDEN_ATK_MULT;
    return Math.round(atk);
  }
  if(state.mode === 'towerHard'){
    let atk = Math.round(40 + floor*25);
    if(golden) atk *= GOLDEN_ATK_MULT;
    return Math.round(atk);
  }
  let atk =
  8 + Math.pow(floor, 1.15) * 2.5;
  if(boss)
    atk *= 2.2;
  atk = atk * normalTierMult(floor);
  if(golden) atk *= GOLDEN_ATK_MULT;
  return Math.round(atk);
}
function monsterDefFor(floor, boss, golden){
  if(state.mode === 'tower'){
    let def = Math.round(
      floor*0.8
    );
    if(golden) def *= GOLDEN_DEF_MULT;
    return Math.round(def);
  }
  if(state.mode === 'towerHard'){
    let def = Math.round(floor*3.5);
    if(golden) def *= GOLDEN_DEF_MULT;
    return Math.round(def);
  }
  let def =
  Math.pow(floor, 1.35) * 0.7;
  if(boss)
    def *= 1.8;
  def = def * normalTierMult(floor);
  if(golden) def *= GOLDEN_DEF_MULT;
  return Math.round(def);
}

// ---------- 회피/명중 (Evasion / Accuracy) ----------
// 몬스터와 보스는 층이 오를수록 회피율(%)이 상승한다. 플레이어는 상점의 "조준 훈련"
// (goldUpgrades.accuracy, state.js의 stats().accuracy)으로 명중 수치를 올려 이를 상쇄해야 하며,
// 다른 골드강화와 달리 이 스탯은 레벨 상한이 없다 — 몬스터 회피가 끝없이 오르는 만큼
// 플레이어도 끝없이 명중을 투자해서 맞춰갈 수 있게 설계.
// 최종 명중률(%) = 기본 명중(95) - 몬스터 회피 + 플레이어 명중, 5%~100% 사이로 보정한다.
const HIT_CHANCE_BASE = 95;
const HIT_CHANCE_MIN = 5;
const HIT_CHANCE_MAX = 100;

function monsterEvasionFor(floor, boss){
  let ev;
  if(state.mode === 'tower'){
    ev = floor * 0.3;
  } else if(state.mode === 'towerHard'){
    ev = floor * 0.55;
  } else {
    // 명중(accuracy)은 골드강화/혈청강화 레벨당 고정 수치를 더하는 "가산형" 스탯이라,
    // HP/공격력/방어력처럼 1000층마다 복리로(normalTierMult, ×1.35씩) 불어나는 배율을
    // 그대로 곱하면 회피가 사실상 기하급수적으로 치솟아 명중을 아무리 투자해도
    // 따라잡을 수 없게 된다 (그 스탯들은 플레이어 쪽도 장비%/유산/돌연변이처럼 곱연산으로
    // 같이 폭증하기 때문에 성립하는 밸런스였음). 그래서 회피는 티어 배율을 적용하지 않고
    // 층수의 완만한 거듭제곱(0.85제곱, 선형보다도 느림)만 사용한다.
    ev = Math.pow(floor, 0.85) * 0.6;
  }
  if(boss) ev *= 1.25;
  return ev;
}

// 명중률(%) 계산. 5%~100% 사이로 보정되어 아무리 회피가 높아도 완전 무적은 아니고,
// 아무리 명중을 올려도 100%를 넘겨 낭비되지 않는다.
function hitChanceFor(floor, boss, accuracy){
  const raw = HIT_CHANCE_BASE - monsterEvasionFor(floor, boss) + (accuracy||0);
  return Math.min(HIT_CHANCE_MAX, Math.max(HIT_CHANCE_MIN, raw));
}

// 표시용: 해당 층 몬스터(또는 보스)를 명중률 95%(기본 명중률)로 안정적으로 맞히기 위해
// 필요한 권장 명중 수치. accuracy === evasion일 때 정확히 95%가 나오므로 evasion을 올림해 반환.
function recommendedAccuracyFor(floor, boss){
  return Math.max(0, Math.ceil(monsterEvasionFor(floor, boss)));
}

// 보상(물자/경험치)에도 같은 1000층 단위로 배율을 얹되, 난이도 배율(1.35)보다 살짝 더 후하게(1.4)
// 잡아서 몹이 세지는 것보다 보상이 조금 더 앞서가게 한다 (체감 성장 속도 자체를 끌어올리기 위함).
const NORMAL_REWARD_TIER_MULT = 1.4;
function normalRewardTierMult(floor){
  const tier = Math.floor(floor / NORMAL_TIER_SIZE);
  return Math.pow(NORMAL_REWARD_TIER_MULT, tier);
}

function goldDropFor(floor, boss){
  if(state.mode === 'tower'){
    let g = Math.round(200 * Math.pow(1.03, floor - 1));
    if(boss) g *= 3;
    return g;
  }
  if(state.mode === 'towerHard'){
    let g = Math.round(600 * Math.pow(1.035, floor - 1));
    if(boss) g *= 3;
    return g;
  }
  let g = Math.round(6 + floor * 2.2);
  if(boss) g *= 8;
  return Math.round(g * normalRewardTierMult(floor));
}
function expDropFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(5 + floor*2.0);
  }
  if(state.mode === 'towerHard'){
    return Math.round(15 + floor*4.0);
  }
  let e = Math.round(3 + floor*1.5);
  if(boss) e *= 8;
  return Math.round(e * normalRewardTierMult(floor));
}

function spawnMonster(){
  state.isGolden = false;
  if(typeof clearGoldenBattleTimer === 'function') clearGoldenBattleTimer();
  if(state.mode === 'tower'){
    if(state.towerCleared){
      state.isBoss = false;
      state.monsterIndex = -1; // special: cleared marker
      state.monsterMaxHp = 1;
      state.monsterHp = 1;
    } else {
      state.isBoss = (state.towerFloor % 10 === 0);
      state.monsterIndex = (state.towerFloor - 1) % TOWER_MONSTERS.length;
      state.monsterMaxHp = monsterHpFor(state.towerFloor, state.isBoss);
      state.monsterHp = state.monsterMaxHp;
    }
  } else if(state.mode === 'towerHard'){
    if(state.htCleared){
      state.isBoss = false;
      state.monsterIndex = -1;
      state.monsterMaxHp = 1;
      state.monsterHp = 1;
    } else {
      state.isBoss = (state.htFloor % 10 === 0);
      state.monsterIndex = (state.htFloor - 1) % TOWER_MONSTERS.length;
      state.monsterMaxHp = monsterHpFor(state.htFloor, state.isBoss);
      state.monsterHp = state.monsterMaxHp;
    }
  } else {
    const boss = state.floor % 10 === 0;
    state.isBoss = boss;
    const pool = boss ? BOSSES : MONSTERS;
    state.monsterIndex = Math.floor(Math.random()*pool.length);
    state.monsterMaxHp = monsterHpFor(state.floor, boss);
    state.monsterHp = state.monsterMaxHp;
  }
  renderMonster();
}

function currentMonsterMeta(){
  if(state.isGolden){
    return {name:'황금 몬스터', emoji:'✨'};
  }
  if(state.mode === 'tower'){
    if(state.towerCleared){
      return {name:'무한의 탑 정복 완료', emoji:'🏆'};
    }
    return TOWER_MONSTERS[state.monsterIndex] || TOWER_MONSTERS[0];
  }
  if(state.mode === 'towerHard'){
    if(state.htCleared){
      return {name:'무한의 탑(어려움) 정복 완료', emoji:'👑'};
    }
    return TOWER_MONSTERS[state.monsterIndex] || TOWER_MONSTERS[0];
  }
  const pool = state.isBoss ? BOSSES : MONSTERS;
  return pool[state.monsterIndex] || pool[0];
}

// ---------- Log ----------
function log(msg, cls){
  const el = document.getElementById('log');
  const line = document.createElement('div');
  if(cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  while(el.children.length > 60) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

// 동시다발적으로 뜨는 데미지 숫자가 한 자리에 겹쳐 쌓이지 않도록, 최근 등장 순서에 따라
// 좌우/상하 위치를 어긋나게 배치한다 (라운드로빈 슬롯 + 랜덤 지터).
let floatSlotCounter = 0;
function floatText(text, cls){
  const box = document.getElementById('arenaBox');
  const el = document.createElement('div');
  el.className = 'float-text' + (cls?(' '+cls):'');
  el.textContent = text;

  const slot = floatSlotCounter++ % 5; // 0~4 슬롯을 순환시켜 위치를 분산
  const leftBase = 28 + slot * 11;     // 28% ~ 72% 사이에 고르게 분산
  const left = leftBase + (Math.random()*8 - 4);
  const top = 34 + (Math.random()*14 - 7);
  const dx = Math.round(Math.random()*36 - 18);   // -18px ~ +18px 좌우 드리프트
  const rot = Math.round(Math.random()*16 - 8);   // -8deg ~ +8deg 회전

  el.style.left = left + '%';
  el.style.top = top + '%';
  el.style.setProperty('--dx', dx + 'px');
  el.style.setProperty('--rot', rot + 'deg');

  box.appendChild(el);
  setTimeout(()=>el.remove(), 850);
}

// 캐릭터가 몬스터를 벨 때 나타나는 슬래시 잔상 이펙트
function spawnSlash(){
  const box = document.getElementById('arenaBox');
  const el = document.createElement('div');
  el.className = 'slash-fx';
  box.appendChild(el);
  setTimeout(()=>el.remove(), 240);
}

// 타격 지점에서 터지는 스파크 이펙트 (image/effects/hit.png 아트 사용, 없으면 빈 이펙트로 조용히 스킵)
function spawnSpark(){
  const box = document.getElementById('arenaBox');
  const el = document.createElement('img');
  el.src = 'image/effects/hit.png';
  el.className = 'spark-fx';
  el.alt = '';
  el.onerror = () => el.remove(); // 아트가 없으면 조용히 무시 (레이아웃 깨짐 방지)
  box.appendChild(el);
  setTimeout(()=>el.remove(), 320);
}

// 몬스터에게 피해를 입히고, 사망 시 보상/층 진행까지 처리하는 공통 로직.
// 일반 공격(playerAttackTick)뿐 아니라 액티브 스킬(skills.js)의 피해도 이 함수를 거친다.
// 그래야 골드/경험치/층 진행/유산 드랍 같은 사망 처리 로직이 두 군데서 따로 관리되며
// 어긋나는 일이 없다.
function dealDamageToMonster(dmgToMonster, isCrit, opts){
  opts = opts || {};
  const s = stats();
  if(state.monsterHp <= 0) return false; // 이미 처치된 경우 무시

  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);

  state.monsterHp -= dmgToMonster;
  if(!opts.silent){
    floatText((isCrit?'CRIT! ':'')+'-'+dmgToMonster, isCrit?'crit':(opts.floatClass||null));
  }
  if(opts.pulse !== false) pulseMonster(isCrit);

  if(state.monsterHp <= 0){
    const boss = state.isBoss;
    const golden = state.isGolden;
    const goldGain = Math.round(goldDropFor(currentFloor, boss) * s.goldMult);
    const expGain = Math.round(expDropFor(currentFloor, boss) * s.expMult);
    state.gold += goldGain;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + goldGain;
    state.exp += expGain;
    state.totalKills++;
    state.dailyKills++;
    state.dailyGoldEarned += goldGain;
    state.repKillProgress++;
    if(boss){
      state.dailyBossKills++;
      state.repBossProgress++;
      state.totalBossKills = (state.totalBossKills||0) + 1;
      if(typeof gainMutationPoints === 'function') gainMutationPoints(3);
      if(typeof gainJobMasteryPoints === 'function') gainJobMasteryPoints(2);
    }
    log(`${currentMonsterMeta().name}${boss? ' (보스)':''} 처치! +${goldGain}📦 +${expGain}EXP`, boss?'good':'new');

    if(typeof recordBestiaryKill === 'function'){
      recordBestiaryKill(currentMonsterMeta(), goldGain);
    }

    if(golden && typeof awardGoldenKillBonus === 'function'){
      awardGoldenKillBonus(currentFloor, s);
    }

    tryLevelUp();

    if(state.mode === 'tower'){
      if(state.towerFloor % 10 === 0 && !state.towerRewardsClaimed[state.towerFloor]){
        state.soul += 1;
        state.fragments += 3;
        state.towerRewardsClaimed[state.towerFloor] = true;
        log(`[무한의 탑] ${state.towerFloor}층 첫 돌파 보상! 🧪 혈청 1개, ◈ 유산 파편 3개 획득!`, 'good');
      }

      if(state.towerFloor < 100){
        state.towerFloor++;
        state.towerHighestFloor = Math.max(state.towerHighestFloor, state.towerFloor);
        log(`[무한의 탑] ${state.towerFloor}층으로 상승합니다!`, 'good');
      } else if(!state.towerCleared){
        state.towerCleared = true;
        log(`[무한의 탑] 100층 정복 완료! 무한의 탑을 완전히 정복했습니다. 환생 후 다시 도전할 수 있습니다.`, 'good');
      }
    } else if(state.mode === 'towerHard'){
      if(state.htFloor % 10 === 0 && !state.htRewardsClaimed[state.htFloor]){
        state.soul += 3;
        state.fragments += 8;
        state.htRewardsClaimed[state.htFloor] = true;
        log(`[무한의 탑(어려움)] ${state.htFloor}층 첫 돌파 보상! 🧪 혈청 3개, ◈ 유산 파편 8개 획득!`, 'good');
      }

      if(state.htFloor < 100){
        state.htFloor++;
        state.htHighestFloor = Math.max(state.htHighestFloor, state.htFloor);
        log(`[무한의 탑(어려움)] ${state.htFloor}층으로 상승합니다!`, 'good');
      } else if(!state.htCleared){
        state.htCleared = true;
        log(`[무한의 탑(어려움)] 100층 정복 완료! 무한의 탑(어려움)을 완전히 정복했습니다. 환생 후 다시 도전할 수 있습니다.`, 'good');
      }
    } else {
      state.killsOnFloor++;
      const killsNeeded = boss ? 1 : 5;
      if(state.killsOnFloor >= killsNeeded){
        state.floor++;
        state.killsOnFloor = 0;
        state.highestFloor = Math.max(state.highestFloor, state.floor);
        state.repFloorProgress++;
        log(`${state.floor}층으로 진입합니다.`, 'good');
      }
    }

    if(Math.random() < s.dropChance){
      const fragGain = boss ? 3 : 1;
      state.fragments += fragGain;
      state.totalFragmentsEarned = (state.totalFragmentsEarned||0) + fragGain;
      log(`◈ 유산 파편 획득! +${fragGain}`, 'good');
    }
    // 강화석은 파편과 별개의 고정 확률로 드랍 (강화 시스템 전용 재화 — enhance.js 참고)
    const stoneChance = boss ? 0.35 : 0.08;
    if(Math.random() < stoneChance){
      const stoneGain = boss ? (2 + Math.floor(Math.random()*2)) : 1;
      state.enhanceStone = (state.enhanceStone||0) + stoneGain;
      state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned||0) + stoneGain;
      log(`🔩 강화석 획득! +${stoneGain}`, 'good');
    }
    if(state.relics.hpRelic > 0){
      const healAmt = Math.round(s.maxHp * (state.relics.hpRelic*0.02));
      if(healAmt > 0 && state.playerHp > 0){
        state.playerHp = Math.min(s.maxHp, state.playerHp + healAmt);
        floatText('+'+healAmt, 'heal');
      }
    }

    spawnMonster();
    updateRebirthAvailability();
  }
  return true;
}

// ---------- Combat ticks (분리된 전투 루프) ----------
function playerAttackTick(){
  const s = stats();
  if(state.playerHp <= 0) state.playerHp = s.maxHp;
  if(state.mode === 'tower' && state.towerCleared){
    schedulePlayerTick();
    return;
  }
  if(state.mode === 'towerHard' && state.htCleared){
    schedulePlayerTick();
    return;
  }
  if(state.monsterHp <= 0) return; // 이미 처치된 경우 무시

  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);

  attackPlayerAnim();

  const hitChance = hitChanceFor(currentFloor, state.isBoss, s.accuracy);
  if(Math.random() * 100 >= hitChance){
    floatText('MISS', 'miss');
    renderCombatFrame();
    schedulePlayerTick();
    return;
  }

  let dmgToMonster = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss, state.isGolden)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmgToMonster = Math.round(dmgToMonster * s.critDamageMult);
  }
  dealDamageToMonster(dmgToMonster, isCrit);

  renderCombatFrame();
  schedulePlayerTick();
}

function monsterAttackTick(){
  const s = stats();
  if(state.playerHp <= 0 || state.monsterHp <= 0) return;
  if(state.mode === 'tower' && state.towerCleared){
    scheduleMonsterTick();
    return;
  }
  if(state.mode === 'towerHard' && state.htCleared){
    scheduleMonsterTick();
    return;
  }

  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
  const monAtk = monsterAtkFor(currentFloor, state.isBoss, state.isGolden);
  const dmgToPlayer = Math.round(Math.max(1, monAtk - s.def));
  state.playerHp -= dmgToPlayer;
  floatText('-'+dmgToPlayer, 'dmgToPlayer');
  pulsePlayer();

  // 불굴의 의지(생존 전문가 전용 스킬)로 쌓아둔 "치명적인 일격 방지" 충전이 있으면,
  // 이번 공격으로 죽었어도 충전 1개를 소모해 체력 1로 대신 생존시킨다.
  if(state.playerHp <= 0 && (state.ironWillCharges||0) > 0){
    state.ironWillCharges--;
    state.playerHp = 1;
    floatText('생존!', 'good');
    log(`💪 불굴의 의지가 발동해 치명적인 일격을 버텨냈습니다! (체력 1로 생존, 남은 충전 ${state.ironWillCharges})`, 'good');
  }

  if(state.playerHp <= 0){
    
    if(state.mode === 'tower'){
      state.playerHp = s.maxHp;
      log(`[무한의 탑] 쓰러졌습니다. 현재 층(${state.towerFloor}층)에 재도합니다.`, 'warn');
    } else if(state.mode === 'towerHard'){
      state.playerHp = s.maxHp;
      log(`[무한의 탑(어려움)] 쓰러졌습니다. 현재 층(${state.htFloor}층)에 재도전합니다.`, 'warn');
    } else {
      state.floor = Math.max(1, state.floor-1);
      state.killsOnFloor = 0;
      state.playerHp = s.maxHp;
      log(`쓰러져서 ${state.floor}층으로 후퇴했습니다.`, 'warn');
    }
    spawnMonster();
  }
  renderCombatFrame();
  scheduleMonsterTick();
}

function pulseMonster(isCrit){
  const el = document.getElementById('monsterEmoji');
  el.classList.add('hit');
  setTimeout(()=>el.classList.remove('hit'), 100);

  spawnSlash();
  spawnSpark();

  if(isCrit){
    const flash = document.getElementById('arenaFlash');
    if(flash){
      flash.classList.add('on');
      setTimeout(()=>flash.classList.remove('on'), 90);
    }
  }
}

function attackPlayerAnim(){
  const el = document.getElementById('playerSprite');
  if(!el) return;
  el.classList.add('attack');
  setTimeout(()=>el.classList.remove('attack'), 220);
}

function pulsePlayer(){
  const el = document.getElementById('playerSprite');
  if(!el) return;
  el.classList.add('hurt');
  setTimeout(()=>el.classList.remove('hurt'), 300);
}

function schedulePlayerTick(){
  const s = stats();
  clearTimeout(playerTickHandle);
  playerTickHandle = setTimeout(playerAttackTick, s.tickMs);
}


  function scheduleMonsterTick(){
  clearTimeout(monsterTickHandle);
  const floor =
    state.mode === 'tower'
    ? state.towerFloor
    : (state.mode === 'towerHard' ? state.htFloor : state.floor);
  // 층이 올라갈수록 빨라짐 (최소 0.8초)
  const speed = Math.max(
    800,
    1500 - floor * 3
  );
  monsterTickHandle =
    setTimeout(
      monsterAttackTick,
      speed
    );

}

// ---------- Mode Switching ----------
const TOWER_UNLOCK_LEVEL = 10;

function setMode(mode){
  if(state.mode === mode) return;
  if(mode === 'tower' && state.level < TOWER_UNLOCK_LEVEL){
    alert(`무한의 탑은 레벨 ${TOWER_UNLOCK_LEVEL}부터 입장할 수 있습니다. (현재 레벨: ${state.level})`);
    return;
  }
  if(mode === 'towerHard' && !state.towerCleared){
    alert('무한의 탑(어려움)은 무한의 탑(100층)을 먼저 정복해야 입장할 수 있습니다.');
    return;
  }
  state.mode = mode;
  document.getElementById('modeNormalBtn').classList.toggle('active', mode==='normal');
  document.getElementById('modeTowerBtn').classList.toggle('active', mode==='tower');
  const hardBtn = document.getElementById('modeTowerHardBtn');
  if(hardBtn) hardBtn.classList.toggle('active', mode==='towerHard');

  document.getElementById('arenaTitle').textContent =
    mode === 'tower' ? '무한의 탑 (100층)' :
    mode === 'towerHard' ? '무한의 탑(어려움) (100층)' :
    '폐허';
  log(`[모드 변경] ${mode==='tower'?'무한의 탑':mode==='towerHard'?'무한의 탑(어려움)':'라스트 존'} 모드로 전환했습니다.`, 'new');
  
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  renderAll();
}

document.getElementById('modeNormalBtn').addEventListener('click', ()=>setMode('normal'));
document.getElementById('modeTowerBtn').addEventListener('click', ()=>setMode('tower'));
const modeTowerHardBtnEl = document.getElementById('modeTowerHardBtn');
if(modeTowerHardBtnEl) modeTowerHardBtnEl.addEventListener('click', ()=>setMode('towerHard'));