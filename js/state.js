// 세이브 데이터 버전. 이 값을 올리면 그보다 낮은 버전의 세이브(자동 로드 + 가져오기 모두)가
// 전부 무효화되고 새 게임으로 시작됩니다. 밸런스 개편 등으로 전체 초기화가 필요할 때 사용.
const SAVE_VERSION = '3.0';

function defaultState(){
  return {
    saveVersion: SAVE_VERSION,
    mode: 'normal',
    gold: 0,
    soul: 0,
    level: 1,
    exp: 0,
    floor: 1,
    killsOnFloor: 0,
    highestFloor: 1,
    towerFloor: 1,
    towerHighestFloor: 1,
    towerRewardsClaimed: {},
    towerCleared: false,
    htFloor: 1,
    htHighestFloor: 1,
    htRewardsClaimed: {},
    htCleared: false,

    monsterHp: 0,
    monsterMaxHp: 0,
    monsterIndex: 0,
    isBoss: false,
    playerHp: 0,
    goldUpgrades: {atk:0, def:0, hp:0, goldGain:0, expGain:0, atkSpeed:0, critChance:0, critDamage:0, accuracy:0},
    soulUpgrades: {atkMult:0, goldMult:0, defMult:0, expMult:0, dropAdd:0, critDmgAdd:0, accuracyAdd:0},
    totalKills: 0,
    totalBossKills: 0,
    rebirthCount: 0,
    dailyResetAt: Date.now(),
    dailyKills: 0,
    dailyGoldEarned: 0,
    dailyUpgradesBought: 0,
    dailyBossKills: 0,
    dailyClaims: {},
    dailySoulPacksBought: 0, // 아래 물약 상점 "혈청 팩" 일일 구매 횟수 제한용
    achClaims: {},
    repKillProgress: 0,
    repFloorProgress: 0,
    repBossProgress: 0,
    bugfixCompGranted: false,
    bonusGrant1Given: false,
    bugfixCompGranted2: false,
    maxCritAnnounced: false,
    fragments: 0,
    totalRelicPulls: 0,
    relics: {hpRelic:0, atkRelic:0, defRelic:0, goldRelic:0, expRelic:0, dropRelic:0, spdRelic:0, critDmgRelic:0},
    pets: {dragonPet:0, jellyPet:0, crowPet:0, owlPet:0, fairyPet:0, wolfPet:0, lizardPet:0},

    // ---------- Pet Shelter (동료 쉼터 / 간식주기) ----------
    petAffection: {}, // key -> 누적 간식 준 횟수
    petLastFed: {},   // key -> 마지막으로 먹이를 준 시각(ms), 하루 1회 제한에 사용
    companionPet: null, // 동행 중인 동료 키 (하나만 선택, 능력치 보너스 적용)
    totalPetSummons: 0,
    mutation: {points:0, totalEarned:0, nodes:{}},
    skills: {},
    job: null,
    claimedGlobalGifts: {},
    unlockedTitles: {}, // 한 번 조건을 달성한 칭호는 여기 영구 기록되어 환생해도 사라지지 않음
    lastSave: Date.now(),
    attendance: {
      day: 0,
      lastClaim: 0
    },

    // ---------- Raid (1인 레이드) ----------
    raidTicket: 3,
    raidTicketLastRefill: Date.now(),
    raidPity: 0,
    raidClearCount: 0,
    raidGear: {raidWeapon:0, raidArmor:0, raidCrown:0, raidRing:0},
    raidActive: false,
    raidBossHp: 0,
    raidBossMaxHp: 0,
    raidPlayerHp: 0,

    // ---------- Gold Dungeon (물자 구역) ----------
    gdFloor: 1,
    gdTicket: 3,
    gdTicketLastRefill: Date.now(),
    gdActive: false,
    gdMonsterHp: 0,
    gdMonsterMaxHp: 0,
    gdPlayerHp: 0,
    gdCleared: false,
    peakCombatPower: 0,

    // ---------- Relic Dungeon (유산 구역) ----------
    rdFloor: 1,
    rdTicket: 3,
    rdTicketLastRefill: Date.now(),
    rdActive: false,
    rdMonsterHp: 0,
    rdMonsterMaxHp: 0,
    rdPlayerHp: 0,
    rdCleared: false,

    // ---------- Equipment (물자 뽑기 장비 시스템) ----------
    equipment: {weapon:null, armor:null, accessory:null},
    equipInventory: [],
    equipPullCounts: {t1:0, t2:0, t3:0, t4:0, t5:0},

    // ---------- Enhance (장비 강화) ----------
    enhanceStone: 0,
    totalEnhanceStonesEarned: 0,
    enhanceDestroyedCount: 0,

    // ---------- World Boss (월드보스, 1일 1회) ----------
    wbLastEnterAt: 0, // 마지막으로 도전한 시각(ms). 4시간 쿨타임 + 관리자 강제 리셋 판단에 사용.
    wbActive: false,
    wbHp: 0,
    wbMaxHp: 0,
    wbPlayerHp: 0,
    wbSessionDamage: 0,
    wbGotKillingBlow: false,

    // ---------- Account / Ranking ----------
    nickname: '',

    // ---------- Titles (칭호) ----------
    equippedTitle: null,

    // ---------- Skills (직업 전용 스킬용 상태) ----------
    ironWillCharges: 0, // '불굴의 의지'(생존 전문가 전용 스킬)로 쌓아둔, 치명적인 일격 방지 충전 수

    // ---------- PvP ----------
    // 스탯 캡을 다 채운 유저도 계속 할 게 있도록 만든 콘텐츠 — 승리해도 스탯 보상은 안 줌
    // (그러면 또 캡 문제가 반복되니까). 대신 전적/명예 포인트는 순수 "기록/자랑" 용도.
    pvpWins: 0,
    pvpLosses: 0,
    pvpHonor: 0,

    // ---------- 몬스터 도감 (Bestiary) ----------
    // 몬스터 이름(고유값)을 key로, 처치 횟수를 value로 기록. 처음 잡는 몬스터는 발견 보너스 지급.
    bestiary: {},

    // ---------- 물약 (일시적 버프) ----------
    // { [potionKey]: {stat, value, expiresAt} } — 만료 시각이 지나면 buffBonus()에서 자동으로 무시됨.
    activeBuffs: {},
  };
}

let state = defaultState();
let playerTickHandle = null;
let monsterTickHandle = null;

// ---------- 상한(캡)이 걸린 파생 스탯 상수 ----------
// stats() 안에서만 쓰던 값을 밖으로 빼서, 강화 UI 쪽에서도 "지금 이미 캡인지" 체크할 수 있게 함.
const GOLD_MULT_CAP = 50;
const EXP_MULT_CAP = 50;
const DROP_CHANCE_CAP = 0.6;
const TICK_MS_MIN = 150; // 공격속도 하한 (더 빨라질 수 없는 지점)
const ACCURACY_PER_LEVEL = 3; // '조준 훈련'(골드강화) 1레벨당 명중 +3 (이 스탯은 캡이 없음 — combat.js의 몬스터 회피 참고)
const SOUL_ACCURACY_PER_LEVEL = 5; // '심안의 룬'(혈청강화) 1레벨당 명중 +5 (골드강화보다 상승폭이 큼, 역시 캡 없음)

// ---------- Derived stats ----------
function base(){
  const lvl = state.level;
  return {
    atk: 8 + lvl*2,
    def: 3 + Math.floor(lvl*0.8),
    maxHp: 80 + lvl*15,
  };
}

// 장착된 무기/방어구/장신구의 메인 옵션(공격력%/방어력%, 장신구는 셋 다 동시)과 서브 옵션
// (치명타/속도/체력/물자/경험치)을 합산. 메인 옵션에는 강화(enhance.js) 보너스가 곱연산으로 붙는다
// (서브 옵션은 강화의 영향을 받지 않음 — enhanceMultOf가 정의돼 있지 않으면 1배로 취급).
function enhanceMultOf(item){
  if(!item) return 1;
  return (typeof enhanceMultiplier === 'function') ? enhanceMultiplier(item) : 1;
}

function equipTotals(){
  const totals = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, spdPct:0};
  const eq = state.equipment || {};
  const w = eq.weapon, a = eq.armor, acc = eq.accessory;
  if(w){
    totals.atkPct += w.mainValue * enhanceMultOf(w);
    if(w.subKey === 'crit') totals.critAdd += w.subValue;
    if(w.subKey === 'critDmg') totals.critDmgAdd += w.subValue;
    if(w.subKey === 'spd') totals.spdPct += w.subValue;
  }
  if(a){
    totals.defPct += a.mainValue * enhanceMultOf(a);
    if(a.subKey === 'hp') totals.hpPct += a.subValue;
    if(a.subKey === 'gold') totals.goldPct += a.subValue;
    if(a.subKey === 'exp') totals.expPct += a.subValue;
  }
  if(acc){
    // 장신구 메인 옵션은 공격력/방어력/체력에 동시에 적용된다 (강화 배율도 동일하게 적용).
    const accMain = acc.mainValue * enhanceMultOf(acc);
    totals.atkPct += accMain;
    totals.defPct += accMain;
    totals.hpPct += accMain;
    if(acc.subKey === 'crit') totals.critAdd += acc.subValue;
    if(acc.subKey === 'critDmg') totals.critDmgAdd += acc.subValue;
    if(acc.subKey === 'spd') totals.spdPct += acc.subValue;
    if(acc.subKey === 'hp') totals.hpPct += acc.subValue;
    if(acc.subKey === 'gold') totals.goldPct += acc.subValue;
    if(acc.subKey === 'exp') totals.expPct += acc.subValue;
  }
  return totals;

}

function stats(){
  const b = base();
  const gu = state.goldUpgrades;
  const su = state.soulUpgrades;
  const re = state.relics;
  const rg = state.raidGear;
  const eq = equipTotals();
  const mut = (typeof mutationBonus === 'function') ? mutationBonus() : {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0};
  const tb = (typeof titleBonus === 'function') ? titleBonus() : {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  const cb = (typeof companionBonus === 'function') ? companionBonus() : {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0};
  const jb = (typeof jobBonus === 'function') ? jobBonus() : {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  const bf = (typeof buffBonus === 'function') ? buffBonus() : {atkPct:0, defPct:0, hpPct:0, critDmgAdd:0, accuracyAdd:0};
  const atk = Math.round((b.atk + gu.atk*2) * (1 + su.atkMult*0.15) * (1 + re.atkRelic*0.03) * (1 + rg.raidWeapon*0.06) * (1 + eq.atkPct/100) * (1 + mut.atkPct/100) * (1 + tb.atkPct/100) * (1 + cb.atkPct/100) * (1 + jb.atkPct/100) * (1 + bf.atkPct/100));
  const def = Math.round((b.def + gu.def*1) * (1 + su.defMult*0.15) * (1 + re.defRelic*0.03) * (1 + rg.raidArmor*0.06) * (1 + eq.defPct/100) * (1 + mut.defPct/100) * (1 + tb.defPct/100) * (1 + cb.defPct/100) * (1 + jb.defPct/100) * (1 + bf.defPct/100));
  const maxHp = Math.round((b.maxHp + gu.hp*15) * (1 + rg.raidCrown*0.05) * (1 + eq.hpPct/100) * (1 + mut.hpPct/100) * (1 + tb.hpPct/100) * (1 + cb.hpPct/100) * (1 + jb.hpPct/100) * (1 + bf.hpPct/100));
  // 물자/경험치 획득 배율은 5개 소스가 전부 곱연산으로 쌓이는 구조라, 상한이 없으면
  // "물자로 물자강화 구매 → 물자 획득 증가 → 더 많은 물자강화 구매"가 서로를 부풀리는
  // 피드백 루프가 걸려 눈덩이처럼 폭증할 수 있다. 최종값에 상한선을 걸어 원천 차단한다.
  const goldMult = Math.min(GOLD_MULT_CAP, (1 + gu.goldGain*0.10) * (1 + su.goldMult*0.20) * (1 + re.goldRelic*0.04) * (1 + rg.raidRing*0.04) * (1 + eq.goldPct/100) * (1 + mut.goldPct/100) * (1 + tb.goldPct/100) * (1 + cb.goldPct/100) * (1 + jb.goldPct/100));
  const expMult = Math.min(EXP_MULT_CAP, (1 + (gu.expGain||0)*0.10) * (1 + (su.expMult||0)*0.20) * (1 + re.expRelic*0.04) * (1 + rg.raidRing*0.04) * (1 + eq.expPct/100) * (1 + mut.expPct/100) * (1 + tb.expPct/100) * (1 + cb.expPct/100) * (1 + jb.expPct/100));
  const spdMult = (1 + Math.min(gu.atkSpeed,50)*0.05) * (1 + re.spdRelic*0.03) * (1 + eq.spdPct/100) * (1 + mut.spdPct/100) * (1 + tb.spdPct/100) * (1 + cb.spdPct/100);
  const tickMs = Math.max(TICK_MS_MIN, Math.round(1000 / spdMult));
  const dropChance = Math.min(DROP_CHANCE_CAP, 0.15 + re.dropRelic*0.015 + mut.dropAdd/100 + tb.dropAdd/100 + (su.dropAdd||0)*0.01 + cb.dropAdd/100 + jb.dropAdd/100);
  const critChance = Math.min(100, (gu.critChance||0) * 1 + eq.critAdd + mut.critAdd + tb.critAdd + cb.critAdd + jb.critAdd); // 레벨당 1%, 최대 100%
  const critDamageMult = 1.5 + (gu.critDamage||0) * 0.04 + eq.critDmgAdd/100 + (re.critDmgRelic||0)*0.02 + mut.critDmgAdd/100 + tb.critDmgAdd/100 + (su.critDmgAdd||0)*0.05 + cb.critDmgAdd/100 + jb.critDmgAdd/100 + bf.critDmgAdd/100; // 기본 1.5배 + 레벨당 4%, 최대 100레벨=5.5배 (+유산+돌연변이+칭호+혈청+동행+전직+물약)
  // 명중(accuracy): '조준 훈련'(골드강화) + '심안의 룬'(혈청강화) 1레벨당 각각 +3 / +5 + 전직(저격수) 보너스
  // + 칭호(PvP 승수 마일스톤 등) 보너스.
  // 다른 강화들과 달리 상한 레벨이 없다 — 몬스터/보스의 회피(combat.js의 monsterEvasionFor)를
  // 상쇄하는 용도로만 쓰인다.
  const accuracy = (gu.accuracy||0) * ACCURACY_PER_LEVEL + (su.accuracyAdd||0) * SOUL_ACCURACY_PER_LEVEL + jb.accuracyAdd + tb.accuracyAdd + bf.accuracyAdd;
  return {atk, def, maxHp, goldMult, expMult, tickMs, dropChance, critChance, critDamageMult, accuracy};
}

// 지금 실제 최종 스탯이 이미 캡에 도달했는지 확인 (강화 낭비 방지용).
function statCapStatus(){
  const s = stats();
  return {
    gold: s.goldMult >= GOLD_MULT_CAP,
    exp: s.expMult >= EXP_MULT_CAP,
    crit: s.critChance >= 100,
    spd: s.tickMs <= TICK_MS_MIN,
    drop: s.dropChance >= DROP_CHANCE_CAP,
  };
}

// 강화 항목(statKey)이 지금 사도 아무 효과가 없는 상태인지 확인.
// goldExpPct처럼 여러 스탯에 동시에 영향을 주는 항목은, 관련된 캡이 "전부" 찼을 때만
// 완전히 무의미해진다 (하나라도 안 찼으면 그쪽엔 여전히 효과가 있으므로 계속 살 수 있게 둠).
function isUpgradeStatMaxed(statKey){
  const cap = statCapStatus();
  switch(statKey){
    case 'goldPct': return cap.gold;
    case 'expPct': return cap.exp;
    case 'critAdd': return cap.crit;
    case 'spdPct': return cap.spd;
    case 'dropAdd': return cap.drop;
    case 'goldExpPct': return cap.gold && cap.exp;
    default: return false; // atkDefPct, critDmgAdd 등 캡 없는 항목
  }
}

// ---------- 전투력(Combat Power) 계산 ----------
// 공격력 × 초당 공격횟수 × 치명타 기대배율(=DPS)을 중심으로, 방어력/체력을 생존력으로 가중 합산.
// 환생/성장 비교용 단일 지표라 절대값 자체는 의미 없고, "이전 대비 몇 %인지" 상대 비교로 사용.
function calcCombatPower(s){
  const attacksPerSec = 1000 / s.tickMs;
  const critFactor = 1 + (s.critChance/100) * (s.critDamageMult - 1); // 치명타 기대 데미지 배율
  const dps = s.atk * attacksPerSec * critFactor;
  const survivability = s.def * 8 + s.maxHp * 0.5;
  return Math.round(dps * 12 + survivability);
}
function expNeeded(lvl){ return Math.round(50 * Math.pow(lvl, 1.4)); }
function tryLevelUp(){
  let needed = expNeeded(state.level);
  while(state.exp >= needed){
    state.exp -= needed;
    state.level++;
    if(typeof gainMutationPoints === 'function') gainMutationPoints(1);
    log(`레벨 업! Lv.${state.level}`, 'good');
    needed = expNeeded(state.level);
  }
}