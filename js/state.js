// 세이브 데이터 버전. 이 값을 올리면 그보다 낮은 버전의 세이브(자동 로드 + 가져오기 모두)가
// 전부 무효화되고 새 게임으로 시작됩니다. 밸런스 개편 등으로 전체 초기화가 필요할 때 사용.
const SAVE_VERSION = '2.0';

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

    monsterHp: 0,
    monsterMaxHp: 0,
    monsterIndex: 0,
    isBoss: false,
    playerHp: 0,
    goldUpgrades: {atk:0, def:0, hp:0, goldGain:0, expGain:0, atkSpeed:0, critChance:0, critDamage:0},
    soulUpgrades: {atkMult:0, goldMult:0, defMult:0},
    totalKills: 0,
    totalBossKills: 0,
    rebirthCount: 0,
    dailyResetAt: Date.now(),
    dailyKills: 0,
    dailyGoldEarned: 0,
    dailyUpgradesBought: 0,
    dailyBossKills: 0,
    dailyClaims: {},
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
    relics: {hpRelic:0, atkRelic:0, defRelic:0, goldRelic:0, expRelic:0, dropRelic:0, spdRelic:0},
    pets: {dragonPet:0, jellyPet:0, crowPet:0, owlPet:0, fairyPet:0, wolfPet:0},
    totalPetSummons: 0,
    usedCoupons: {},
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

    // ---------- Gold Dungeon (골드 던전) ----------
    gdFloor: 1,
    gdTicket: 3,
    gdTicketLastRefill: Date.now(),
    gdActive: false,
    gdMonsterHp: 0,
    gdMonsterMaxHp: 0,
    gdPlayerHp: 0,
    gdCleared: false,
    peakCombatPower: 0,

    // ---------- Relic Dungeon (유물 던전) ----------
    rdFloor: 1,
    rdTicket: 3,
    rdTicketLastRefill: Date.now(),
    rdActive: false,
    rdMonsterHp: 0,
    rdMonsterMaxHp: 0,
    rdPlayerHp: 0,
    rdCleared: false,

    // ---------- Equipment (골드 뽑기 장비 시스템) ----------
    equipment: {weapon:null, armor:null},
    equipInventory: [],
    equipPullCounts: {t1:0, t2:0, t3:0, t4:0},
  };
}

let state = defaultState();
let playerTickHandle = null;
let monsterTickHandle = null;

// ---------- Derived stats ----------
function base(){
  const lvl = state.level;
  return {
    atk: 8 + lvl*2,
    def: 3 + Math.floor(lvl*0.8),
    maxHp: 80 + lvl*15,
  };
}

// 장착된 무기/방어구의 메인 옵션(공격력%/방어력%)과 서브 옵션(치명타/속도/체력/골드/경험치)을 합산.
function equipTotals(){
  const totals = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, spdPct:0};
  const eq = state.equipment || {};
  const w = eq.weapon, a = eq.armor;
  if(w){
    totals.atkPct += w.mainValue;
    if(w.subKey === 'crit') totals.critAdd += w.subValue;
    if(w.subKey === 'critDmg') totals.critDmgAdd += w.subValue;
    if(w.subKey === 'spd') totals.spdPct += w.subValue;
  }
  if(a){
    totals.defPct += a.mainValue;
    if(a.subKey === 'hp') totals.hpPct += a.subValue;
    if(a.subKey === 'gold') totals.goldPct += a.subValue;
    if(a.subKey === 'exp') totals.expPct += a.subValue;
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
  const atk = Math.round((b.atk + gu.atk*2) * (1 + su.atkMult*0.15) * (1 + re.atkRelic*0.03) * (1 + rg.raidWeapon*0.06) * (1 + eq.atkPct/100));
  const def = Math.round((b.def + gu.def*1) * (1 + su.defMult*0.15) * (1 + re.defRelic*0.03) * (1 + rg.raidArmor*0.06) * (1 + eq.defPct/100));
  const maxHp = Math.round((b.maxHp + gu.hp*15) * (1 + rg.raidCrown*0.05) * (1 + eq.hpPct/100));
  const goldMult = (1 + gu.goldGain*0.10) * (1 + su.goldMult*0.20) * (1 + re.goldRelic*0.04) * (1 + rg.raidRing*0.04) * (1 + eq.goldPct/100);
  const expMult = (1 + (gu.expGain||0)*0.10) * (1 + re.expRelic*0.04) * (1 + rg.raidRing*0.04) * (1 + eq.expPct/100);
  const spdMult = (1 + Math.min(gu.atkSpeed,50)*0.05) * (1 + re.spdRelic*0.03) * (1 + eq.spdPct/100);
  const tickMs = Math.max(150, Math.round(1000 / spdMult));
  const dropChance = Math.min(0.6, 0.15 + re.dropRelic*0.015);
  const critChance = Math.min(100, (gu.critChance||0) * 1 + eq.critAdd); // 레벨당 1%, 최대 100%
  const critDamageMult = 1.5 + (gu.critDamage||0) * 0.04 + eq.critDmgAdd/100; // 기본 1.5배 + 레벨당 4%, 최대 100레벨=5.5배
  return {atk, def, maxHp, goldMult, expMult, tickMs, dropChance, critChance, critDamageMult};
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
    log(`레벨 업! Lv.${state.level}`, 'good');
    needed = expNeeded(state.level);
  }
}

