function defaultState(){
  return {
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
    goldUpgrades: {atk:0, def:0, hp:0, goldGain:0, expGain:0, atkSpeed:0},
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
    fragments: 0,
    totalRelicPulls: 0,
    relics: {hpRelic:0, atkRelic:0, defRelic:0, goldRelic:0, expRelic:0, dropRelic:0, spdRelic:0},
    pets: {dragonPet:0, jellyPet:0, crowPet:0, owlPet:0, fairyPet:0, wolfPet:0},
    totalPetSummons: 0,
    usedCoupons: {},
    lastSave: Date.now(),

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

function stats(){
  const b = base();
  const gu = state.goldUpgrades;
  const su = state.soulUpgrades;
  const re = state.relics;
  const rg = state.raidGear;
  const atk = Math.round((b.atk + gu.atk*2) * (1 + su.atkMult*0.15) * (1 + re.atkRelic*0.03) * (1 + rg.raidWeapon*0.06));
  const def = Math.round((b.def + gu.def*1) * (1 + su.defMult*0.15) * (1 + re.defRelic*0.03) * (1 + rg.raidArmor*0.06));
  const maxHp = Math.round((b.maxHp + gu.hp*15) * (1 + rg.raidCrown*0.05));
  const goldMult = (1 + gu.goldGain*0.10) * (1 + su.goldMult*0.20) * (1 + re.goldRelic*0.04) * (1 + rg.raidRing*0.04);
  const expMult = (1 + (gu.expGain||0)*0.10) * (1 + re.expRelic*0.04) * (1 + rg.raidRing*0.04);
  const spdMult = (1 + Math.min(gu.atkSpeed,50)*0.05) * (1 + re.spdRelic*0.02);
  const tickMs = Math.max(Math.round(1000 / spdMult));
  const dropChance = Math.min(0.6, 0.15 + re.dropRelic*0.015);
  return {atk, def, maxHp, goldMult, expMult, tickMs, dropChance};
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

