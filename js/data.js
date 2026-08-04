const MONSTERS = [
  {name:'떠도는 좀비', emoji:'👻'},
  {name:'변이 박쥐', emoji:'🦇'},
  {name:'부패한 병사', emoji:'💀'},
  {name:'변이 거미', emoji:'🕷️'},
  {name:'부비트랩 상자', emoji:'📦'},
  {name:'오염된 괴수', emoji:'🧌'},
  {name:'감시 드론', emoji:'👁️'},
  {name:'변이 늑대', emoji:'🐺'},
  {name:'밤샌 웹툰작가', img:'image/monsters/bamsenyeonwoo.png'},
  {name:'사족보행작가', img:'image/monsters/sajok.png'},
  {name:'잔상인데용', img:'image/monsters/jansang.png'},
];
const BOSSES = [
  {name:'폐허의 파수병', emoji:'🗿'},
  {name:'폭주한 경비병', emoji:'⚔️'},
  {name:'변이체의 왕', emoji:'🐉'},
  {name:'감염된 연구원', emoji:'🧙'},
];
const TOWER_MONSTERS = [
  {name:'경비 로봇', emoji:'🗿'},
  {name:'소각로 괴수', emoji:'🗿'},
  {name:'냉동창고 변이체', emoji:'🧊'},
  {name:'실험체 알파', emoji:'👿'},
  {name:'폭주 드론', emoji:'👼'},
  {name:'최종 방어 시스템', emoji:'⚔️'},
  {name:'근원 변이체', emoji:'🐉'}
];

const RELICS = [
  {key:'hpRelic', name:'재생의 유산', icon:'💚', perLevel:2, descFn:v=>`변이체 처치 시 최대 체력의 ${v}% 회복`},
  {key:'atkRelic', name:'강타의 유산', icon:'🗡️', perLevel:3, descFn:v=>`공격력 +${v}%`},
  {key:'defRelic', name:'철벽의 유산', icon:'🛡️', perLevel:3, descFn:v=>`방어력 +${v}%`},
  {key:'goldRelic', name:'탐욕의 유산', icon:'📦', perLevel:4, descFn:v=>`물자 획득 +${v}%`},
  {key:'expRelic', name:'지혜의 유산', icon:'📖', perLevel:4, descFn:v=>`경험치 획득 +${v}%`},
  {key:'dropRelic', name:'행운의 유산', icon:'🍀', perLevel:1.5, descFn:v=>`파편 드랍 확률 +${v}%p`},
  {key:'spdRelic', name:'가속의 유산', icon:'⚡', perLevel:3, descFn:v=>`공격 속도 +${v}%`},
  {key:'critDmgRelic', name:'파괴의 유산', icon:'💥', perLevel:2, descFn:v=>`치명타 피해 +${v}%`},
];

const PETS = [
  {
    key:'dragonPet', name:'전투 소세지', icon:'🌭', img:'image/pets/sausage.png', interval:8,
    companionStat:'atkPct', companionValueFn:lvl=>Math.round(Math.min(35, 3+lvl*0.25)*10)/10,
    descFn:lvl=>`${8}초마다 공격력의 ${Math.round((0.4+lvl*0.026)*100)}%만큼 변이체에게 추가 피해`,
    trigger:(lvl,s)=>{
      const dmg = Math.max(1, Math.round(s.atk * (0.4 + lvl*0.026)));
      state.monsterHp -= dmg;
      if(state.monsterHp < 1) state.monsterHp = 1;
      floatText('🔥-'+dmg, null);
      log(`🌭 전투 소세지의 브레스! -${dmg}`, 'good');
    }
  },
  {
    key:'jellyPet', name:'용맹한 소세지', icon:'🌭', img:'image/pets/sausage-brave.png', interval:10,
    companionStat:'hpPct', companionValueFn:lvl=>Math.round(Math.min(35, 3+lvl*0.25)*10)/10,
    descFn:lvl=>`${10}초마다 최대 체력의 ${Math.round(lvl*2)}% 회복`,
    trigger:(lvl,s)=>{
      const heal = Math.round(s.maxHp * (0.02*lvl));
      if(heal>0 && state.playerHp>0){
        state.playerHp = Math.min(s.maxHp, state.playerHp+heal);
        floatText('+'+heal, 'heal');
        log(`🌭 용맹한 소세지가 체력을 회복시켜줬습니다! +${heal}`, 'good');
      }
    }
  },
  {
    key:'crowPet', name:'분홍소세지', icon:'🌭', img:'image/pets/sausage-pink.png', interval:12,
    companionStat:'goldPct', companionValueFn:lvl=>Math.round(Math.min(35, 3+lvl*0.25)*10)/10,
    descFn:lvl=>`${12}초마다 물자 즉시 획득 (레벨 비례)`,
    trigger:(lvl,s)=>{
      const currentFloor = state.mode==='tower' ? state.towerFloor : (state.mode==='towerHard' ? state.htFloor : state.floor);
      const g = Math.round(goldDropFor(currentFloor,false) * s.goldMult * (0.4+lvl*0.2));
      state.gold += g;
      log(`🌭 분홍소세지가 물자를 물어왔습니다! +${g}📦`, 'good');
    }
  },
  {
    key:'owlPet', name:'정찰 부엉이', icon:'🦉', interval:12,
    companionStat:'expPct', companionValueFn:lvl=>Math.round(Math.min(35, 3+lvl*0.25)*10)/10,
    descFn:lvl=>`${12}초마다 경험치 즉시 획득 (레벨 비례)`,
    trigger:(lvl,s)=>{
      const currentFloor = state.mode==='tower' ? state.towerFloor : (state.mode==='towerHard' ? state.htFloor : state.floor);
      const e = Math.round(expDropFor(currentFloor,false) * s.expMult * (0.4+lvl*0.2));
      state.exp += e;
      tryLevelUp();
      log(`🦉 정찰 부엉이의 지혜! +${e}EXP`, 'good');
    }
  },
  {
    key:'fairyPet', name:'탐지 쥐', icon:'🐁', interval:15,
    companionStat:'dropAdd', companionValueFn:lvl=>Math.round(Math.min(15, 1+lvl*0.12)*10)/10,
    descFn:lvl=>`${15}초마다 유산 파편 ${Math.floor(Math.sqrt(lvl)*2)+1}개 획득`,
    trigger:(lvl,s)=>{
      const f = Math.floor(Math.sqrt(lvl)*2)+1;
      state.fragments += f;
      log(`🐁 탐지 쥐가 파편을 선물했습니다! +${f}◈`, 'good');
    }
  },
  {
    key:'wolfPet', name:'변이 늑대', icon:'🐺', interval:10,
    companionStat:'defPct', companionValueFn:lvl=>Math.round(Math.min(35, 3+lvl*0.25)*10)/10,
    descFn:lvl=>`${10}초마다 변이체 최대 체력의 ${Math.round((0.02+lvl*0.0013)*100)}% 피해`,
    trigger:(lvl,s)=>{
      const dmg = Math.max(1, Math.round(state.monsterMaxHp * (0.02+lvl*0.0013)));
      state.monsterHp -= dmg;
      if(state.monsterHp < 1) state.monsterHp = 1;
      floatText('❄-'+dmg, null);
      log(`🐺 변이 늑대의 물어뜯기! -${dmg}`, 'good');
    }
  },
  {
    key:'lizardPet', name:'독니 도마뱀', icon:'🦎', interval:9,
    companionStat:'spdPct', companionValueFn:lvl=>Math.round(Math.min(30, 2+lvl*0.2)*10)/10,
    descFn:lvl=>`${9}초마다 변이체 현재 체력의 ${Math.round((0.03+lvl*0.0018)*100)}% 독 피해`,
    trigger:(lvl,s)=>{
      const dmg = Math.max(1, Math.round(state.monsterHp * (0.03+lvl*0.0018)));
      state.monsterHp -= dmg;
      if(state.monsterHp < 1) state.monsterHp = 1;
      floatText('🦎-'+dmg, null);
      log(`🦎 독니 도마뱀의 맹독! -${dmg}`, 'good');
    }
  },
];

// 펫 아이콘 표시용 헬퍼 — 전용 이미지(p.img)가 있으면 그 이미지를, 없으면 이모지(p.icon)를 사용.
function petIconHtml(p, sizePx){
  if(!p) return '';
  if(p.img) return `<img src="${p.img}" alt="${p.name}" style="height:${sizePx}px;width:auto;vertical-align:middle;image-rendering:pixelated;">`;
  return p.icon;
}

const GOLD_UPGRADES = [
  {key:'atk', name:'무기 정비', desc:'공격력 +2', baseCost:10, mult:1.15, effect:'+2 ATK'},
  {key:'def', name:'방어구 보강', desc:'방어력 +1', baseCost:10, mult:1.15, effect:'+1 DEF'},
  {key:'hp', name:'체력 단련', desc:'최대 체력 +15', baseCost:15, mult:1.15, effect:'+15 HP'},
  {key:'goldGain', name:'물자 상자', desc:'물자 획득량 +10%', baseCost:25, mult:1.22, effect:'+10% Gold', capStat:'goldPct'},
  {key:'expGain', name:'생존 매뉴얼', desc:'경험치 획득량 +10%', baseCost:20, mult:1.22, effect:'+10% EXP', capStat:'expPct'},
  {key:'atkSpeed', name:'아드레날린 주사', desc:'공격 속도 +5% (최대 50)', baseCost:35, mult:1.11, effect:'+5% SPD', maxLevel:50, capStat:'spdPct'},
  {key:'critChance', name:'급소 파악', desc:'치명타 확률 +1% (최대 100%)', baseCost:38, mult:1.115, effect:'+1% CRIT', maxLevel:100, capStat:'critAdd'},
  {key:'critDamage', name:'강화 탄두', desc:'치명타 피해 +4% (최대 100레벨)', baseCost:42, mult:1.115, effect:'+4% CRIT DMG', maxLevel:100},
];

const DAILY_QUESTS = [
  {key:'kill20', name:'사냥꾼의 하루', desc:'변이체 20마리 처치', target:20, statKey:'dailyKills', reward:{gold:150}},
  {key:'gold300', name:'금화 모으기', desc:'물자 300 획득', target:300, statKey:'dailyGoldEarned', reward:{gold:100}},
  {key:'upgrade3', name:'대장간 단골', desc:'강화 3회 구매', target:3, statKey:'dailyUpgradesBought', reward:{gold:120}},
  {key:'boss1', name:'수호자 처단', desc:'보스 1마리 처치', target:1, statKey:'dailyBossKills', reward:{soul:1}},
];

const REPEATABLE_QUESTS = [
  {key:'repKill', name:'연속 사냥', desc:'변이체 10마리 처치할 때마다', target:10, statKey:'repKillProgress', reward:{gold:45}},
  {key:'repFloor', name:'층 돌파', desc:'3개 층 오를 때마다', target:3, statKey:'repFloorProgress', reward:{gold:100}},
  {key:'repBoss', name:'보스 사냥꾼', desc:'보스 처치할 때마다', target:1, statKey:'repBossProgress', reward:{gold:250}},
];

const ACHIEVEMENTS = [
  {key:'floor10', name:'초심자 탈출', desc:'10층 도달', check:s=>s.highestFloor>=10, target:10, statKey:'highestFloor', reward:{gold:200}},
  {key:'floor25', name:'폐허의 탐험가', desc:'25층 도달', check:s=>s.highestFloor>=25, target:25, statKey:'highestFloor', reward:{gold:600, soul:1}},
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
  {key:'pull10', name:'유산 수집가', desc:'유산 뽑기 10회', check:s=>(s.totalRelicPulls||0)>=10, target:10, statKey:'totalRelicPulls', reward:{frag:10}},
  {key:'pull50', name:'유산 대가', desc:'유산 뽑기 50회', check:s=>(s.totalRelicPulls||0)>=50, target:50, statKey:'totalRelicPulls', reward:{soul:5}},
  {key:'relicAll', name:'만물의 수호자', desc:'모든 유산 1레벨 이상 보유 (7종)', check:s=>(s.relicsOwnedCount||0)>=7, target:7, statKey:'relicsOwnedCount', reward:{soul:6}},
  {key:'coupon3', name:'쿠폰 수집가', desc:'쿠폰 3개 사용', check:s=>(s.usedCouponsCount||0)>=3, target:3, statKey:'usedCouponsCount', reward:{frag:8}},
  {key:'gold10000', name:'부호', desc:'물자 10,000 보유', check:s=>s.gold>=10000, target:10000, statKey:'gold', reward:{soul:2}},
  {key:'raidClear1', name:'첫 레이드 승리', desc:'1인 레이드 1회 클리어', check:s=>(s.raidClearCount||0)>=1, target:1, statKey:'raidClearCount', reward:{soul:3}},
  {key:'raidClear10', name:'레이드 헌터', desc:'1인 레이드 10회 클리어', check:s=>(s.raidClearCount||0)>=10, target:10, statKey:'raidClearCount', reward:{soul:8, frag:15}},
];

// ---------- Titles (칭호) ----------
// 특정 조건을 달성하면 영구적으로 해금되는 칭호. 해금된 칭호 중 하나만 장착할 수 있으며,
// 장착한 칭호의 효과만 적용된다(보유만 해도 적용되는 유산/동료와 달리 "택 1" 구조).
// check()는 ACHIEVEMENTS와 동일한 패턴으로 state를 받아 boolean을 반환.
const TITLES = [
  {key:'title_survivor10', name:'새내기 생존자', icon:'🔰', condText:'최고 10층 도달', check:s=>s.highestFloor>=10, stat:'atkPct', value:2},
  {key:'title_ruinPioneer', name:'폐허의 개척자', icon:'🗺️', condText:'최고 50층 도달', check:s=>s.highestFloor>=50, stat:'atkPct', value:5},
  {key:'title_abyssConqueror', name:'심연의 정복자', icon:'🌑', condText:'최고 150층 도달', check:s=>s.highestFloor>=150, stat:'atkPct', value:9},
  {key:'title_toughBody', name:'다부진 몸', icon:'💪', condText:'레벨 20 달성', check:s=>s.level>=20, stat:'hpPct', value:3},
  {key:'title_veteran', name:'백전노장', icon:'🎖️', condText:'레벨 60 달성', check:s=>s.level>=60, stat:'hpPct', value:7},
  {key:'title_hunterSense', name:'사냥의 감각', icon:'🩸', condText:'누적 처치 3,000마리', check:s=>s.totalKills>=3000, stat:'critAdd', value:2},
  {key:'title_slaughterAvatar', name:'학살의 화신', icon:'💀', condText:'누적 처치 20,000마리', check:s=>s.totalKills>=20000, stat:'critDmgAdd', value:10},
  {key:'title_firstRebirth', name:'첫 부활', icon:'🌱', condText:'환생 1회 달성', check:s=>s.rebirthCount>=1, stat:'goldPct', value:3},
  {key:'title_reincarnated', name:'윤회하는 자', icon:'♻️', condText:'환생 10회 달성', check:s=>s.rebirthCount>=10, stat:'goldPct', value:8},
  {key:'title_towerClimber', name:'탑을 오르는 자', icon:'🗼', condText:'무한의 탑 50층 도달', check:s=>s.towerHighestFloor>=50, stat:'spdPct', value:2},
  {key:'title_towerConqueror', name:'탑의 정복자', icon:'👑', condText:'무한의 탑 클리어', check:s=>!!s.towerCleared, stat:'spdPct', value:5},
  {key:'title_hellWalker', name:'지옥 답파자', icon:'🔥', condText:'무한의 탑(어려움) 클리어', check:s=>!!s.htCleared, stat:'atkPct', value:12},
  {key:'title_judge', name:'심판자', icon:'⚖️', condText:'1인 레이드 15회 클리어', check:s=>(s.raidClearCount||0)>=15, stat:'critDmgAdd', value:6},
  {key:'title_goldHoarder', name:'물자 수집광', icon:'📦', condText:'물자 구역 완전 정복', check:s=>!!s.gdCleared, stat:'goldPct', value:5},
  {key:'title_relicSeeker', name:'유산 탐구자', icon:'🔍', condText:'유산 구역 완전 정복', check:s=>!!s.rdCleared, stat:'dropAdd', value:2},
  {key:'title_dailyGrinder', name:'성실한 하루하루', icon:'📅', condText:'출석 20일 달성', check:s=>((s.attendance&&s.attendance.day)||0)>=20, stat:'expPct', value:5},
  {key:'title_richMan', name:'대부호', icon:'💰', condText:'물자 200,000 보유', check:s=>s.gold>=200000, stat:'goldPct', value:4},
  {key:'title_relicMaster', name:'유산 마스터', icon:'✨', condText:'유산 뽑기 150회', check:s=>(s.totalRelicPulls||0)>=150, stat:'expPct', value:4},
];

const SOUL_UPGRADES = [
  {key:'atkMult', name:'영혼의 검', desc:'공격력 영구 +15%', baseCost:3, mult:1.55},
  {key:'goldMult', name:'탐욕의 인장', desc:'물자 획득 영구 +20%', baseCost:3, mult:1.55, capStat:'goldPct'},
  {key:'defMult', name:'수호의 문양', desc:'방어력 영구 +15%', baseCost:3, mult:1.55},
  {key:'expMult', name:'생존의 지혜', desc:'경험치 획득 영구 +20%', baseCost:4, mult:1.5, capStat:'expPct'},
  {key:'dropAdd', name:'탐욕의 손길', desc:'파편 드랍 확률 영구 +1%p', baseCost:4, mult:1.5, capStat:'dropAdd'},
  {key:'critDmgAdd', name:'처형자의 낙인', desc:'치명타 피해 영구 +5%p', baseCost:5, mult:1.5},
];

// ---------- Raid Gear (1인 레이드 전용 장비) ----------
// 유산보다 레벨당 효과가 2배 강함 (뽑기 확률이 훨씬 낮고 티켓제로 제한되기 때문)
const RAID_GEAR = [
  {key:'raidWeapon', name:'파멸의 파편검', icon:'🗡️', perLevel:6, descFn:v=>`공격력 +${v}%`},
  {key:'raidArmor', name:'심연의 갑주', icon:'🛡️', perLevel:6, descFn:v=>`방어력 +${v}%`},
  {key:'raidCrown', name:'파멸의 왕관', icon:'👑', perLevel:5, descFn:v=>`최대 체력 +${v}%`},
  {key:'raidRing', name:'천공의 인장', icon:'💍', perLevel:4, descFn:v=>`물자/경험치 획득 +${v}%`},
];

// ---------- Equipment (장비 뽑기 시스템) ----------
// 등급별 메인 옵션(무기=공격력%, 방어구=방어력%, 장신구=공격력/방어력/체력 동시 적용) 범위와,
// 희귀 등급 이상부터 붙는 서브 옵션 범위. accMainMin/accMainMax는 장신구 전용 메인 옵션 범위로,
// 장신구는 메인 옵션이 3개 스탯에 동시 적용되기 때문에 무기/방어구보다 낮게 잡는다.
// sellBase는 미장착 장비를 판매할 때 돌려받는 대략적인 물자 기준값.
const EQUIP_RARITIES = [
  {key:'common',    name:'일반', color:'#9d9d9d', mainMin:8,  mainMax:14,  accMainMin:3,  accMainMax:5,  subMin:0,  subMax:0,  sellBase:400},
  {key:'rare',      name:'희귀', color:'#4fa3e3', mainMin:15, mainMax:25,  accMainMin:5,  accMainMax:9,  subMin:3,  subMax:6,  sellBase:4000},
  {key:'epic',      name:'영웅', color:'#b968e0', mainMin:26, mainMax:40,  accMainMin:9,  accMainMax:14, subMin:7,  subMax:12, sellBase:35000},
  {key:'legendary', name:'전설', color:'#e8a33d', mainMin:42, mainMax:65,  accMainMin:15, accMainMax:23, subMin:13, subMax:20, sellBase:250000},
  {key:'mythic',    name:'신화', color:'#ff4fd8', mainMin:68, mainMax:100, accMainMin:24, accMainMax:35, subMin:22, subMax:32, sellBase:1800000},
];

const WEAPON_SUBSTATS = [
  {key:'crit',    name:'치명타 확률', unit:'%p'},
  {key:'critDmg', name:'치명타 피해', unit:'%p'},
  {key:'spd',     name:'공격 속도',   unit:'%'},
];
const ARMOR_SUBSTATS = [
  {key:'hp',   name:'최대 체력',       unit:'%'},
  {key:'gold', name:'물자 획득',       unit:'%'},
  {key:'exp',  name:'경험치 획득',     unit:'%'},
];
// 장신구 서브 옵션 = 무기/방어구 서브 옵션 풀을 합친 것. 어떤 조합이든 나올 수 있어 특정
// 무기/방어구의 약점을 장신구로 보완하는 용도로 쓰인다.
const ACCESSORY_SUBSTATS = [...WEAPON_SUBSTATS, ...ARMOR_SUBSTATS];

// 뽑기 등급이 오를수록 기본 비용이 크게 오르고(현재 진행도 기준 결코 싸지 않은 값), 같은 등급을
// 반복해서 뽑을수록 costMult 비율로 추가 상승한다. 등급별 rarity 가중치(weights) 합은 100.
// unlockReq: 이전 등급을 count회 뽑아야 다음 등급이 해금됨 (null이면 처음부터 해금).
// (2024 밸런스 조정: costMult가 뽑을수록 복리로 눈덩이처럼 불어나 특히 전설/신화급을 여러 번
//  뽑기가 지나치게 힘들다는 피드백을 반영해, 상승률을 기존의 절반 수준으로 완화함)
const GACHA_TIERS = [
  {key:'t1', name:'초급 뽑기', baseCost:8000,     costMult:1.025, weights:{common:72, rare:26, epic:2,  legendary:0,  mythic:0}, unlockReq:null},
  {key:'t2', name:'중급 뽑기', baseCost:80000,    costMult:1.03,  weights:{common:35, rare:45, epic:19, legendary:1,  mythic:0}, unlockReq:{tier:'t1', count:30}},
  {key:'t3', name:'고급 뽑기', baseCost:600000,   costMult:1.035, weights:{common:10, rare:39, epic:47, legendary:4,  mythic:0}, unlockReq:{tier:'t2', count:30}},
  {key:'t4', name:'전설 뽑기', baseCost:4000000,  costMult:1.04,  weights:{common:0,  rare:20, epic:72, legendary:8,  mythic:0}, unlockReq:{tier:'t3', count:20}},
  {key:'t5', name:'신화 뽑기', baseCost:30000000, costMult:1.045, weights:{common:0,  rare:0,  epic:25, legendary:65, mythic:10}, unlockReq:{tier:'t4', count:25}},
];

const ATTENDANCE_REWARDS = [
    { type:"gold", amount:5000,  text:"📦 물자 5,000" },
    { type:"soul", amount:5,     text:"🧪 혈청 5" },
    { type:"frag", amount:30,    text:"◈ 유산 파편 30" },
    { type:"gold", amount:20000, text:"📦 물자 20,000" },
    { type:"soul", amount:15,    text:"🧪 혈청 15" },
    { type:"frag", amount:100,   text:"◈ 유산 파편 100" },
    { type:"special", amount:1,  text:"🎁 랜덤 유산 무료 뽑기" }
];