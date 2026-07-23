const MONSTERS = [
  {name:'떠도는 망령', emoji:'👻'},
  {name:'동굴 박쥐', emoji:'🦇'},
  {name:'해골 병사', emoji:'💀'},
  {name:'독거미', emoji:'🕷️'},
  {name:'슬라임', emoji:'🟣'},
  {name:'고블린 척후병', emoji:'👺'},
  {name:'미믹', emoji:'📦'},
  {name:'늪지 트트롤', emoji:'🧌'},
  {name:'망각의 눈', emoji:'👁️'},
  {name:'서리 늑대', emoji:'🐺'},
];
const BOSSES = [
  {name:'회랑의 문지기', emoji:'🗿'},
  {name:'타락한 기사', emoji:'⚔️'},
  {name:'심연의 군주', emoji:'🐉'},
  {name:'황혼의 마녀', emoji:'🧙'},
];
const TOWER_MONSTERS = [
  {name:'수호자 석상', emoji:'🗿'},
  {name:'화염 골렘', emoji:'🗿'},
  {name:'서리 거인', emoji:'🧊'},
  {name:'암흑 악마', emoji:'👿'},
  {name:'타락한 천사', emoji:'👼'},
  {name:'탑의 파수꾼', emoji:'⚔️'},
  {name:'시공의 용', emoji:'🐉'}
];

const RELICS = [
  {key:'hpRelic', name:'재생의 유물', icon:'💚', perLevel:2, descFn:v=>`몬스터 처치 시 최대 체력의 ${v}% 회복`},
  {key:'atkRelic', name:'강타의 유물', icon:'🗡️', perLevel:3, descFn:v=>`공격력 +${v}%`},
  {key:'defRelic', name:'철벽의 유물', icon:'🛡️', perLevel:3, descFn:v=>`방어력 +${v}%`},
  {key:'goldRelic', name:'탐욕의 유물', icon:'🪙', perLevel:4, descFn:v=>`골드 획득 +${v}%`},
  {key:'expRelic', name:'지혜의 유물', icon:'📖', perLevel:4, descFn:v=>`경험치 획득 +${v}%`},
  {key:'dropRelic', name:'행운의 유물', icon:'🍀', perLevel:1.5, descFn:v=>`파편 드랍 확률 +${v}%p`},
  {key:'spdRelic', name:'가속의 유물', icon:'⚡', perLevel:3, descFn:v=>`공격 속도 +${v}%`},
];

const PETS = [
  {
    key:'dragonPet', name:'아기 드래곤', icon:'🐲', interval:8,
    descFn:lvl=>`${8}초마다 공격력의 ${Math.round((0.4+lvl*0.15)*100)}%만큼 몬스터에게 추가 피해`,
    trigger:(lvl,s)=>{
      const dmg = Math.max(1, Math.round(s.atk * (0.4 + lvl*0.15)));
      state.monsterHp -= dmg;
      if(state.monsterHp < 1) state.monsterHp = 1;
      floatText('🔥-'+dmg, null);
      log(`🐲 아기 드래곤의 브레스! -${dmg}`, 'good');
    }
  },
  {
    key:'jellyPet', name:'젤리 펫', icon:'🟢', interval:10,
    descFn:lvl=>`${10}초마다 최대 체력의 ${Math.round(lvl*2)}% 회복`,
    trigger:(lvl,s)=>{
      const heal = Math.round(s.maxHp * (0.02*lvl));
      if(heal>0 && state.playerHp>0){
        state.playerHp = Math.min(s.maxHp, state.playerHp+heal);
        floatText('+'+heal, 'heal');
        log(`🟢 젤리 펫이 체력을 회복시켜줬습니다! +${heal}`, 'good');
      }
    }
  },
  {
    key:'crowPet', name:'까마귀', icon:'🐦', interval:12,
    descFn:lvl=>`${12}초마다 골드 즉시 획득 (레벨 비례)`,
    trigger:(lvl,s)=>{
      const currentFloor = state.mode==='tower' ? state.towerFloor : state.floor;
      const g = Math.round(goldDropFor(currentFloor,false) * s.goldMult * (0.4+lvl*0.2));
      state.gold += g;
      log(`🐦 까마귀가 골드를 물어왔습니다! +${g}🪙`, 'good');
    }
  },
  {
    key:'owlPet', name:'부엉이', icon:'🦉', interval:12,
    descFn:lvl=>`${12}초마다 경험치 즉시 획득 (레벨 비례)`,
    trigger:(lvl,s)=>{
      const currentFloor = state.mode==='tower' ? state.towerFloor : state.floor;
      const e = Math.round(expDropFor(currentFloor,false) * s.expMult * (0.4+lvl*0.2));
      state.exp += e;
      tryLevelUp();
      log(`🦉 부엉이의 지혜! +${e}EXP`, 'good');
    }
  },
  {
    key:'fairyPet', name:'요정', icon:'🧚', interval:15,
    descFn:lvl=>`${300}초마다 유물 파편 ${Math.floor(lvl/2)+1}개 획득`,
    trigger:(lvl,s)=>{
      const f = Math.floor(lvl/2)+1;
      state.fragments += f;
      log(`🧚 요정이 파편을 선물했습니다! +${f}◈`, 'good');
    }
  },
  {
    key:'wolfPet', name:'서리 늑대', icon:'🐺', interval:10,
    descFn:lvl=>`${10}초마다 몬스터 최대 체력의 ${Math.round((0.02+lvl*0.01)*100)}% 피해`,
    trigger:(lvl,s)=>{
      const dmg = Math.max(1, Math.round(state.monsterMaxHp * (0.02+lvl*0.01)));
      state.monsterHp -= dmg;
      if(state.monsterHp < 1) state.monsterHp = 1;
      floatText('❄-'+dmg, null);
      log(`🐺 서리 늑대의 물어뜯기! -${dmg}`, 'good');
    }
  },
];

const GOLD_UPGRADES = [
  {key:'atk', name:'무기 연마', desc:'공격력 +2', baseCost:10, mult:1.15, effect:'+2 ATK'},
  {key:'def', name:'방어구 보강', desc:'방어력 +1', baseCost:10, mult:1.15, effect:'+1 DEF'},
  {key:'hp', name:'체력 단련', desc:'최대 체력 +15', baseCost:15, mult:1.15, effect:'+15 HP'},
  {key:'goldGain', name:'행운의 주머니', desc:'골드 획득량 +10%', baseCost:25, mult:1.22, effect:'+10% Gold'},
  {key:'expGain', name:'지혜의 문장', desc:'경험치 획득량 +10%', baseCost:20, mult:1.22, effect:'+10% EXP'},
  {key:'atkSpeed', name:'신속의 축복', desc:'공격 속도 +5% (최대 50)', baseCost:35, mult:1.11, effect:'+5% SPD', maxLevel:50},
  {key:'critChance', name:'치명의 감각', desc:'치명타 확률 +1% (최대 100%)', baseCost:38, mult:1.115, effect:'+1% CRIT', maxLevel:100},
  {key:'critDamage', name:'치명의 일격', desc:'치명타 피해 +4% (최대 100레벨)', baseCost:42, mult:1.115, effect:'+4% CRIT DMG', maxLevel:100},
];

const DAILY_QUESTS = [
  {key:'kill20', name:'사냥꾼의 하루', desc:'몬스터 20마리 처치', target:20, statKey:'dailyKills', reward:{gold:150}},
  {key:'gold300', name:'금화 모으기', desc:'골드 300 획득', target:300, statKey:'dailyGoldEarned', reward:{gold:100}},
  {key:'upgrade3', name:'대장간 단골', desc:'강화 3회 구매', target:3, statKey:'dailyUpgradesBought', reward:{gold:120}},
  {key:'boss1', name:'수호자 처단', desc:'보스 1마리 처치', target:1, statKey:'dailyBossKills', reward:{soul:1}},
];

const REPEATABLE_QUESTS = [
  {key:'repKill', name:'연속 사냥', desc:'몬스터 10마리 처치할 때마다', target:10, statKey:'repKillProgress', reward:{gold:45}},
  {key:'repFloor', name:'층 돌파', desc:'3개 층 오를 때마다', target:3, statKey:'repFloorProgress', reward:{gold:100}},
  {key:'repBoss', name:'보스 사냥꾼', desc:'보스 처치할 때마다', target:1, statKey:'repBossProgress', reward:{gold:250}},
];

const ACHIEVEMENTS = [
  {key:'floor10', name:'초심자 탈출', desc:'10층 도달', check:s=>s.highestFloor>=10, target:10, statKey:'highestFloor', reward:{gold:200}},
  {key:'floor25', name:'회랑의 탐험가', desc:'25층 도달', check:s=>s.highestFloor>=25, target:25, statKey:'highestFloor', reward:{gold:600, soul:1}},
  {key:'floor50', name:'심연의 발치', desc:'50층 도달', check:s=>s.highestFloor>=50, target:50, statKey:'highestFloor', reward:{soul:3}},
  {key:'floor100', name:'황혼의 지배자', desc:'100층 도달', check:s=>s.highestFloor>=100, target:100, statKey:'highestFloor', reward:{soul:10}},
  {key:'lvl10', name:'견습 모험가', desc:'레벨 10 달성', check:s=>s.level>=10, target:10, statKey:'level', reward:{gold:150}},
  {key:'lvl25', name:'숙련된 모험가', desc:'레벨 25 달성', check:s=>s.level>=25, target:25, statKey:'level', reward:{gold:500}},
  {key:'kill100', name:'백 번의 사냥', desc:'누적 처치 100마리', check:s=>s.totalKills>=100, target:100, statKey:'totalKills', reward:{gold:150}},
  {key:'kill1000', name:'천 번의 사냥', desc:'누적 처치 1000마리', check:s=>s.totalKills>=1000, target:1000, statKey:'totalKills', reward:{gold:1000, soul:2}},
  {key:'rebirth1', name:'첫 환생', desc:'환생 1회 달성', check:s=>s.rebirthCount>=1, target:1, statKey:'rebirthCount', reward:{soul:2}},
  {key:'rebirth5', name:'윤회의 고리', desc:'환생 5회 달성', check:s=>s.rebirthCount>=5, target:5, statKey:'rebirthCount', reward:{soul:8}},
  {key:'rebirth10', name:'영원한 굴레', desc:'환생 10회 달성', check:s=>s.rebirthCount>=10, target:10, statKey:'rebirthCount', reward:{soul:15}},
  {key:'lvl50', name:'대적자', desc:'레벨 50 달성', check:s=>s.level>=50, target:50, statKey:'level', reward:{gold:1500}},
  {key:'kill5000', name:'학살자', desc:'누적 처치 5000마리', check:s=>s.totalKills>=5000, target:5000, statKey:'totalKills', reward:{gold:3000, soul:3}},
  {key:'bossKill20', name:'보스 헌터', desc:'보스 누적 처치 20마리', check:s=>(s.totalBossKills||0)>=20, target:20, statKey:'totalBossKills', reward:{soul:4}},
  {key:'tower25', name:'탑의 도전자', desc:'무한의 탑 25층 도달', check:s=>s.towerHighestFloor>=25, target:25, statKey:'towerHighestFloor', reward:{gold:400}},
  {key:'tower50', name:'탑의 정복자', desc:'무한의 탑 50층 도달', check:s=>s.towerHighestFloor>=50, target:50, statKey:'towerHighestFloor', reward:{soul:5}},
  {key:'tower100', name:'탑의 지배자', desc:'무한의 탑 100층 정복', check:s=>s.towerHighestFloor>=100, target:100, statKey:'towerHighestFloor', reward:{soul:15, gold:2000}},
  {key:'pull10', name:'유물 수집가', desc:'유물 뽑기 10회', check:s=>(s.totalRelicPulls||0)>=10, target:10, statKey:'totalRelicPulls', reward:{frag:10}},
  {key:'pull50', name:'유물 대가', desc:'유물 뽑기 50회', check:s=>(s.totalRelicPulls||0)>=50, target:50, statKey:'totalRelicPulls', reward:{soul:5}},
  {key:'relicAll', name:'만물의 수호자', desc:'모든 유물 1레벨 이상 보유 (7종)', check:s=>(s.relicsOwnedCount||0)>=7, target:7, statKey:'relicsOwnedCount', reward:{soul:6}},
  {key:'coupon3', name:'쿠폰 수집가', desc:'쿠폰 3개 사용', check:s=>(s.usedCouponsCount||0)>=3, target:3, statKey:'usedCouponsCount', reward:{frag:8}},
  {key:'gold10000', name:'부호', desc:'골드 10,000 보유', check:s=>s.gold>=10000, target:10000, statKey:'gold', reward:{soul:2}},
  {key:'raidClear1', name:'첫 레이드 승리', desc:'1인 레이드 1회 클리어', check:s=>(s.raidClearCount||0)>=1, target:1, statKey:'raidClearCount', reward:{soul:3}},
  {key:'raidClear10', name:'레이드 헌터', desc:'1인 레이드 10회 클리어', check:s=>(s.raidClearCount||0)>=10, target:10, statKey:'raidClearCount', reward:{soul:8, frag:15}},
];

const SOUL_UPGRADES = [
  {key:'atkMult', name:'영혼의 검', desc:'공격력 영구 +15%', baseCost:3, mult:1.55},
  {key:'goldMult', name:'탐욕의 인장', desc:'골드 획득 영구 +20%', baseCost:3, mult:1.55},
  {key:'defMult', name:'수호의 문양', desc:'방어력 영구 +15%', baseCost:3, mult:1.55},
];

// ---------- Raid Gear (1인 레이드 전용 장비) ----------
// 유물보다 레벨당 효과가 2배 강함 (뽑기 확률이 훨씬 낮고 티켓제로 제한되기 때문)
const RAID_GEAR = [
  {key:'raidWeapon', name:'파멸의 파편검', icon:'🗡️', perLevel:6, descFn:v=>`공격력 +${v}%`},
  {key:'raidArmor', name:'심연의 갑주', icon:'🛡️', perLevel:6, descFn:v=>`방어력 +${v}%`},
  {key:'raidCrown', name:'파멸의 왕관', icon:'👑', perLevel:5, descFn:v=>`최대 체력 +${v}%`},
  {key:'raidRing', name:'천공의 인장', icon:'💍', perLevel:4, descFn:v=>`골드/경험치 획득 +${v}%`},
];

const ATTENDANCE_REWARDS = [
    { type:"gold", amount:5000,  text:"🪙 골드 5,000" },
    { type:"soul", amount:5,     text:"✦ 영혼석 5" },
    { type:"frag", amount:30,    text:"◈ 유물 파편 30" },
    { type:"gold", amount:20000, text:"🪙 골드 20,000" },
    { type:"soul", amount:15,    text:"✦ 영혼석 15" },
    { type:"frag", amount:100,   text:"◈ 유물 파편 100" },
    { type:"special", amount:1,  text:"🎁 랜덤 유물 무료 뽑기" }
];