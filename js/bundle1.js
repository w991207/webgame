// ===== js/electron-bridge.js =====
// ---------- Electron 데스크탑 위젯 전용 브릿지 ----------
// 일반 브라우저(웹 배포판)에서는 window.electronAPI가 없으므로 이 스크립트는 아무 것도 하지
// 않고 조용히 종료된다. Electron 안에서 로드될 때만 프레임 없는 창을 위한 커스텀 타이틀바
// (드래그 영역 + 핀고정/미니모드/최소화/닫기 버튼)를 화면 맨 위에 얹어준다.
(function () {
  if (!window.electronAPI) return;

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      body{ padding-top:34px !important; }
      #electronTitleBar{
        position:fixed; top:0; left:0; right:0; height:34px;
        background:linear-gradient(180deg,#1b1e15,#101208);
        border-bottom:1px solid #3d4433;
        display:flex; align-items:center; justify-content:space-between;
        -webkit-app-region: drag;
        z-index:99999;
        padding:0 6px 0 10px;
        font-family:'JetBrains Mono',monospace;
        user-select:none;
      }
      #electronTitleBar .etb-title{
        color:#e0812f; font-size:12px; letter-spacing:1px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
      }
      #electronTitleBar .etb-btns{ display:flex; gap:4px; -webkit-app-region:no-drag; flex-shrink:0; }
      #electronTitleBar button{
        background:transparent; border:1px solid #3d4433; color:#838a75;
        width:24px; height:22px; border-radius:4px; cursor:pointer; font-size:11px;
        display:flex; align-items:center; justify-content:center; line-height:1;
        transition:.12s;
      }
      #electronTitleBar button:hover{ color:#e2e5d6; border-color:#e0812f; }
      #electronTitleBar button.active{ color:#e0812f; border-color:#e0812f; background:rgba(224,129,47,.12); }
      #electronTitleBar button#etbClose:hover{ color:#ff6b6b; border-color:#ff6b6b; }
    `;
    document.head.appendChild(style);
  }

  function injectBar() {
    const bar = document.createElement('div');
    bar.id = 'electronTitleBar';
    bar.innerHTML = `
      <span class="etb-title">🗡️ 라스트 존</span>
      <span class="etb-btns">
        <button id="etbPin" title="항상 위에 표시">📌</button>
        <button id="etbMini" title="미니 모드 전환">🔳</button>
        <button id="etbMin" title="최소화">—</button>
        <button id="etbClose" title="닫기 (트레이로 최소화됩니다)">✕</button>
      </span>
    `;
    document.body.prepend(bar);

    document.getElementById('etbPin').addEventListener('click', async () => {
      const pinned = await window.electronAPI.togglePin();
      document.getElementById('etbPin').classList.toggle('active', pinned);
    });
    document.getElementById('etbMini').addEventListener('click', async () => {
      const mini = await window.electronAPI.toggleMini();
      document.getElementById('etbMini').classList.toggle('active', mini);
    });
    document.getElementById('etbMin').addEventListener('click', () => {
      window.electronAPI.minimize();
    });
    document.getElementById('etbClose').addEventListener('click', () => {
      window.electronAPI.hideToTray();
    });

    window.electronAPI.onState((state) => {
      const pinBtn = document.getElementById('etbPin');
      const miniBtn = document.getElementById('etbMini');
      if (pinBtn) pinBtn.classList.toggle('active', !!state.pinned);
      if (miniBtn) miniBtn.classList.toggle('active', !!state.mini);
    });

    if (window.electronAPI.getState) {
      window.electronAPI.getState().then((state) => {
        const pinBtn = document.getElementById('etbPin');
        const miniBtn = document.getElementById('etbMini');
        if (pinBtn) pinBtn.classList.toggle('active', !!state.pinned);
        if (miniBtn) miniBtn.classList.toggle('active', !!state.mini);
      }).catch(() => {});
    }
  }

  function init() {
    injectStyle();
    injectBar();
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();

// ===== js/patch.js =====
let latestPatch = null;

async function checkPatch() {
  try {
    const response = await fetch("patch.json?t=" + Date.now(), {
      cache: "no-store"
    });

    if (!response.ok) return;

    const patch = await response.json();
    latestPatch = patch;

    const savedVersion = localStorage.getItem("game_version");

    // ⭐ 첫 접속이면 버전만 저장하고 종료 (팝업 X)
    if (!savedVersion) {
      localStorage.setItem("game_version", patch.version);
      return;
    }

    // ⭐ 버전이 다르면 업데이트 팝업
    if (savedVersion !== patch.version) {

      const modal = document.getElementById("patchModal");
      if (!modal) return;

      const title = modal.querySelector(".patch-title");
      const body = modal.querySelector(".patch-body");

      if (title) {
        title.textContent = `🚀 v${patch.version} 업데이트`;
      }

      if (body) {
        body.innerHTML = patch.notes
          .map(note => `• ${note}`)
          .join("<br>");
      }

      modal.style.display = "flex";
    }

  } catch (e) {
    console.error("패치 확인 실패", e);
  }
}

function applyPatch() {

  if (latestPatch) {
    localStorage.setItem("game_version", latestPatch.version);
  }

  location.reload();
}


async function openPatchHistory(){

    const res=await fetch("patch-history.json?t="+Date.now());

    const history=await res.json();

    document.getElementById("patchHistoryBody").innerHTML=
        history.map(p=>`
        <h3>v${p.version}</h3>
        <ul>
            ${p.notes.map(n=>`<li>${n}</li>`).join("")}
        </ul>
        `).join("");

    document.getElementById("patchHistoryModal").style.display="flex";
}

document.getElementById("patchHistoryBtn").onclick=openPatchHistory;

// 최초 확인
checkPatch();

// 이후 3분마다 확인
// (예전엔 10초마다 + 캐시 무력화로 확인했는데, 방치형 게임 특성상 탭을 오래 켜두는
//  유저가 많아서 Vercel 엣지 요청량을 순식간에 잡아먹는 원인이 됐음. 패치 알림은
//  몇 분 늦게 떠도 큰 문제가 없으니 주기를 크게 늘려서 요청 횟수를 18배 줄인다.)
setInterval(checkPatch, 180000);
// ===== js/storage.js =====
const STORAGE_KEY = 'twilight-corridor-save-v2';
const LOCAL_PREFIX = 'twilight-corridor-';
const hasCloudStorage = (typeof window.storage !== 'undefined' && window.storage !== null);

async function storageGet(key){
  if(hasCloudStorage){
    try{ 
      const res = await window.storage.get(key, false);
      if(res && res.value) return res;
    }catch(e){ /* fall through */ }
  }
  try{
    const v = window.localStorage.getItem(LOCAL_PREFIX+key);
    return v !== null ? {key, value:v, shared:false} : null;
  }catch(e){ return null; }
}

async function storageSet(key, value, force){
  let localSuccess = false;
  try{
    window.localStorage.setItem(LOCAL_PREFIX+key, value);
    localSuccess = true;
  }catch(e){ }

  if(hasCloudStorage){
    try{ await window.storage.set(key, value, false); }
    catch(e){ }
  }

  // Firebase 계정에 로그인/게스트로 연결되어 있다면 세이브를 클라우드에도 백업 (실패해도 로컬 저장에는 영향 없음)
  // 로컬 저장은 5초마다 계속 돌지만, 클라우드는 Firestore 무료 할당량을 아끼기 위해 내부적으로 쓰기 빈도를 제한한다.
  if(key === 'save' && typeof cloudPushSave === 'function'){
    cloudPushSave(value, !!force);
  }

  return localSuccess ? {key, value, shared:false} : null;
}

// ===== js/data.js =====
const MONSTERS = [
  {name:'떠도는 좀비', emoji:'👻', img:'image/monsters/zombie.png'},
  {name:'변이 박쥐', emoji:'🦇', img:'image/monsters/bat.png'},
  {name:'부패한 병사', emoji:'💀', img:'image/monsters/skeleton.png'},
  {name:'변이 거미', emoji:'🕷️', img:'image/monsters/spider.png'},
  {name:'부비트랩 상자', emoji:'📦', img:'image/monsters/trapbox.png'},
  {name:'오염된 괴수', emoji:'🧌', img:'image/monsters/troll.png'},
  {name:'감시 드론', emoji:'👁️', img:'image/monsters/drone.png'},
  {name:'변이 늑대', emoji:'🐺', img:'image/monsters/wolf.png'},
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
  {key:'accuracy', name:'조준 훈련', desc:'명중 +3 (상한 없음 — 층이 오를수록 몬스터 회피가 높아지니 계속 투자하세요)', baseCost:30, mult:1.13, effect:'+3 ACC'},
];

const DAILY_QUESTS = [
  {key:'kill20', name:'사냥꾼의 하루', desc:'변이체 20마리 처치', target:20, statKey:'dailyKills', reward:{gold:150}},
  {key:'gold300', name:'금화 모으기', desc:'물자 300 획득', target:300, statKey:'dailyGoldEarned', reward:{gold:100}},
  {key:'upgrade3', name:'대장간 단골', desc:'강화 3회 구매', target:3, statKey:'dailyUpgradesBought', reward:{gold:120}},
  {key:'boss1', name:'수호자 처단', desc:'보스 1마리 처치', target:1, statKey:'dailyBossKills', reward:{soul:1}},
];

const REPEATABLE_QUESTS = [
  // 보상은 '고정 값(reward) + 층수 비례 값(scale)'으로 계산한다 (quests.js repeatQuestReward 참고).
  // scale은 '현재 층 일반 몬스터 1마리 물자값(goldDropFor) × 물자 배율(goldMult)'의 몇 배를
  // 추가로 주는지. 층수가 오를수록 보상도 자동으로 커져서 후반에도 무의미해지지 않는다.
  {key:'repKill', name:'연속 사냥', desc:'변이체 10마리 처치할 때마다', target:10, statKey:'repKillProgress', reward:{gold:100}, scale:2},
  {key:'repFloor', name:'층 돌파', desc:'3개 층 오를 때마다', target:3, statKey:'repFloorProgress', reward:{gold:300}, scale:8},
  {key:'repBoss', name:'보스 사냥꾼', desc:'보스 처치할 때마다', target:1, statKey:'repBossProgress', reward:{gold:400}, scale:2},
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
  {key:'title_dailyGrinder', name:'성실한 하루하루', icon:'📅', condText:'출석 20일 달성', check:s=>((s.attendance&&s.attendance.total)||0)>=20, stat:'expPct', value:5},
  {key:'title_richMan', name:'대부호', icon:'💰', condText:'물자 200,000 보유', check:s=>s.gold>=200000, stat:'goldPct', value:4},
  {key:'title_relicMaster', name:'유산 마스터', icon:'✨', condText:'유산 뽑기 150회', check:s=>(s.totalRelicPulls||0)>=150, stat:'expPct', value:4},
  // PvP 승수 마일스톤 — 캡 있는 스탯(물자/경험치) 말고 상한 없는 스탯으로만 구성해서
  // 스탯 다 찍은 유저도 계속 의미 있게 노릴 수 있는 목표로 뒀다.
  {key:'title_pvpNovice', name:'첫 승부', icon:'⚔️', condText:'PvP 1승 달성', check:s=>(s.pvpWins||0)>=1, stat:'accuracyAdd', value:3},
  {key:'title_pvpDuelist', name:'결투가', icon:'🤺', condText:'PvP 30승 달성', check:s=>(s.pvpWins||0)>=30, stat:'critDmgAdd', value:8},
  {key:'title_pvpChampion', name:'투기장의 지배자', icon:'🏆', condText:'PvP 150승 달성', check:s=>(s.pvpWins||0)>=150, stat:'accuracyAdd', value:15},
  {key:'title_killPassLegend', name:'살육의 정점', icon:'🏅', condText:'처치 패스 50단계 완주', check:s=>(s.killPassClaimed||0)>=50, stat:'critDmgAdd', value:15},
];

const SOUL_UPGRADES = [
  {key:'atkMult', name:'영혼의 검', desc:'공격력 영구 +15%', baseCost:3, mult:1.55},
  {key:'goldMult', name:'탐욕의 인장', desc:'물자 획득 영구 +20%', baseCost:3, mult:1.55, capStat:'goldPct'},
  {key:'defMult', name:'수호의 문양', desc:'방어력 영구 +15%', baseCost:3, mult:1.55},
  {key:'expMult', name:'생존의 지혜', desc:'경험치 획득 영구 +20%', baseCost:4, mult:1.5, capStat:'expPct'},
  {key:'dropAdd', name:'탐욕의 손길', desc:'파편 드랍 확률 영구 +1%p', baseCost:4, mult:1.5, capStat:'dropAdd'},
  {key:'critDmgAdd', name:'처형자의 낙인', desc:'치명타 피해 영구 +5%p', baseCost:5, mult:1.5},
  {key:'accuracyAdd', name:'심안의 룬', desc:'명중 영구 +5 (골드강화 조준 훈련보다 상승폭이 큽니다, 상한 없음)', baseCost:4, mult:1.5},
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

// ---------- ⚔️ 몬스터 처치 패스 ----------
// 누적 처치(state.totalKills)는 환생해도 초기화되지 않는 영구 값이라, 이를 기준으로
// 순차 해금되는 장기 보상 트랙을 만듦. 50단계까지 있고, target/보상 모두 지수적으로 증가.
// 짝수 단계마다 파편, 3의 배수 단계마다 혈청, 4의 배수 단계마다 강화석이 추가로 붙고,
// 10단계마다(마지막 제외) 무료 유산 뽑기 1회, 최종 50단계에는 칭호가 함께 해금됨.
// (target/reward 배율만 조절하면 패스 전체 페이스를 손쉽게 재조정할 수 있음)
const KILL_PASS_TIER_COUNT = 50;
const KILL_PASS_TIERS = (function(){
  const tiers = [];
  let target = 50;
  for(let i=0;i<KILL_PASS_TIER_COUNT;i++){
    const idx = i+1;
    const rewards = { gold: Math.round(2000 * Math.pow(1.5, i)) };
    if(idx % 2 === 0) rewards.frag = Math.round(20 * Math.pow(1.42, i/2));
    if(idx % 3 === 0) rewards.soul = Math.round(3 * Math.pow(1.35, i/3));
    if(idx % 4 === 0) rewards.stone = Math.round(4 * Math.pow(1.4, i/4));
    let special = null;
    if(idx % 10 === 0 && idx !== KILL_PASS_TIER_COUNT) special = 'pull';
    if(idx === KILL_PASS_TIER_COUNT) special = 'title';
    tiers.push({ tier: idx, target: Math.round(target), rewards, special });
    target *= 1.5;
  }
  return tiers;
})();

const ATTENDANCE_REWARDS = [
    { type:"gold", amount:5000,  text:"📦 물자 5,000" },
    { type:"soul", amount:5,     text:"🧪 혈청 5" },
    { type:"frag", amount:30,    text:"◈ 유산 파편 30" },
    { type:"gold", amount:20000, text:"📦 물자 20,000" },
    { type:"soul", amount:15,    text:"🧪 혈청 15" },
    { type:"frag", amount:100,   text:"◈ 유산 파편 100" },
    { type:"special", amount:1,  text:"🎁 랜덤 유산 무료 뽑기" }
];
// ===== js/bestiary.js =====
// ---------- 몬스터 도감 (Bestiary) ----------
// MONSTERS/BOSSES/TOWER_MONSTERS(js/data.js)를 그룹별로 묶어서 도감 UI에 쓴다.
// 발견 여부/처치 수는 state.bestiary에 { [몬스터이름]: 처치횟수 } 형태로 저장.
const BESTIARY_GROUPS = [
  {label:'폐허 - 일반 몬스터', list: MONSTERS},
  {label:'폐허 - 보스', list: BOSSES},
  {label:'무한의 탑', list: TOWER_MONSTERS},
];

function bestiaryTotalCount(){
  return BESTIARY_GROUPS.reduce((sum, g) => sum + g.list.length, 0);
}

function bestiaryDiscoveredCount(){
  return Object.keys(state.bestiary || {}).length;
}

// 몬스터를 처치했을 때 combat.js(dealDamageToMonster)에서 호출.
// 처음 잡는 몬스터면 발견 보너스(물자)를 지급하고 true를 반환한다.
function recordBestiaryKill(meta, bonusGoldBase){
  if(!meta || !meta.name) return false;
  if(!state.bestiary) state.bestiary = {};
  const isNew = !state.bestiary[meta.name];
  state.bestiary[meta.name] = (state.bestiary[meta.name] || 0) + 1;

  if(isNew){
    const bonusGold = Math.max(1, Math.round(bonusGoldBase * 5));
    state.gold += bonusGold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
    log(`📖 도감에 "${meta.name}"을(를) 새로 기록했습니다! (+${bonusGold.toLocaleString()}📦)`, 'good');

    if(bestiaryDiscoveredCount() >= bestiaryTotalCount()){
      log('📖 몬스터 도감을 전부 완성했습니다! 축하합니다!', 'good');
    }
  }
  return isNew;
}

function renderBestiary(){
  const el = document.getElementById('bestiaryGrid');
  const countEl = document.getElementById('bestiaryCountText');
  if(!el) return;

  const discovered = bestiaryDiscoveredCount();
  const total = bestiaryTotalCount();
  if(countEl) countEl.textContent = `${discovered} / ${total} 발견`;

  let html = '';
  BESTIARY_GROUPS.forEach(group=>{
    html += `<div class="bestiary-group-label">${group.label}</div><div class="bestiary-grid">`;
    group.list.forEach(m=>{
      const kills = (state.bestiary && state.bestiary[m.name]) || 0;
      const found = kills > 0;
      const visual = m.img
        ? `<img src="${m.img}" class="bestiary-card-img" alt="${found ? m.name : '???'}" style="${found?'':'filter:brightness(0);opacity:.35;'}">`
        : `<span class="bestiary-card-emoji" style="${found?'':'filter:brightness(0);opacity:.35;'}">${found ? m.emoji : '❔'}</span>`;
      html += `
        <div class="bestiary-card ${found?'found':'unknown'}">
          ${visual}
          <div class="bestiary-card-name">${found ? m.name : '???'}</div>
          <div class="bestiary-card-kills">${found ? ('처치 ' + kills.toLocaleString() + '회') : '미발견'}</div>
        </div>`;
    });
    html += `</div>`;
  });
  el.innerHTML = html;
}

// ===== js/mutation.js =====
// ---------- 돌연변이 각성 (Mutation Awakening) ----------
// 레벨업(+1) / 보스 처치(+3)로 얻는 "적응 포인트"를 소모해 영구적인 신체 변이 특성을
// 해금하는 성장 트리. 유산(자동 발동형 지속효과)과 달리 순수 수치형 영구 강화이며,
// 3개 갈래(전투/생존/자원)로 나뉘고 각 갈래의 2·3·4번째 노드는 이전 노드를 일정 레벨까지
// 찍어야 해금되는 구조.

const MUTATION_TREE = [
  // ---- 전투 갈래 ----
  {key:'mutAtk1', branch:'atk', name:'근섬유 강화', icon:'💪', maxLevel:35, baseCost:2, mult:1.16,
    stat:'atkPct', perLevel:1, unit:'%', label:'공격력', prereq:null},
  {key:'mutAtk2', branch:'atk', name:'표적 조준 모듈', icon:'🎯', maxLevel:25, baseCost:4, mult:1.2,
    stat:'critAdd', perLevel:0.5, unit:'%', label:'치명타 확률', prereq:{key:'mutAtk1', lvl:5}},
  {key:'mutAtk3', branch:'atk', name:'치명 각성', icon:'🩸', maxLevel:25, baseCost:6, mult:1.22,
    stat:'critDmgAdd', perLevel:2, unit:'%', label:'치명타 피해', prereq:{key:'mutAtk2', lvl:5}},
  {key:'mutAtk4', branch:'atk', name:'가속 신경계', icon:'⚡', maxLevel:20, baseCost:12, mult:1.3,
    stat:'spdPct', perLevel:0.5, unit:'%', label:'공격 속도', prereq:{key:'mutAtk3', lvl:5}},

  // ---- 생존 갈래 ----
  {key:'mutDef1', branch:'def', name:'피부경화 변이', icon:'🦴', maxLevel:35, baseCost:2, mult:1.16,
    stat:'defPct', perLevel:1, unit:'%', label:'방어력', prereq:null},
  {key:'mutDef2', branch:'def', name:'재생 인자', icon:'🧫', maxLevel:35, baseCost:3, mult:1.18,
    stat:'hpPct', perLevel:1, unit:'%', label:'최대 체력', prereq:{key:'mutDef1', lvl:5}},
  {key:'mutDef3', branch:'def', name:'생존 본능', icon:'🫀', maxLevel:18, baseCost:8, mult:1.25,
    stat:'atkDefPct', perLevel:1, unit:'%', label:'공격력/방어력', prereq:{key:'mutDef2', lvl:5}},
  {key:'mutDef4', branch:'def', name:'재해 저항', icon:'❤️‍🔥', maxLevel:20, baseCost:12, mult:1.3,
    stat:'defPct', perLevel:2, unit:'%', label:'방어력', prereq:{key:'mutDef3', lvl:5}},

  // ---- 자원 갈래 ----
  {key:'mutRes1', branch:'res', name:'탐색 감각', icon:'🔦', maxLevel:35, baseCost:2, mult:1.16,
    stat:'goldPct', perLevel:1, unit:'%', label:'물자 획득', prereq:null},
  {key:'mutRes2', branch:'res', name:'학습 가속', icon:'🧠', maxLevel:35, baseCost:2, mult:1.16,
    stat:'expPct', perLevel:1, unit:'%', label:'경험치 획득', prereq:{key:'mutRes1', lvl:5}},
  {key:'mutRes3', branch:'res', name:'생존자의 직감', icon:'🍀', maxLevel:18, baseCost:6, mult:1.22,
    stat:'dropAdd', perLevel:0.3, unit:'%p', label:'파편 드랍 확률', prereq:{key:'mutRes2', lvl:5}},
  {key:'mutRes4', branch:'res', name:'생존 학습', icon:'📚', maxLevel:20, baseCost:10, mult:1.25,
    stat:'goldExpPct', perLevel:1, unit:'%', label:'물자/경험치 획득', prereq:{key:'mutRes3', lvl:5}},
  {key:'mutRes5', branch:'res', name:'혈청 정제', icon:'🧪', maxLevel:30, baseCost:9, mult:1.24,
    stat:'rebirthSoulPct', perLevel:1.5, unit:'%', label:'환생 시 혈청 획득량', prereq:{key:'mutRes4', lvl:5}},
];

// ---------- 차원 초월 (무한 성장 노드) ----------
// 위 12개 노드를 전부 만렙 찍으면 적응 포인트를 쓸 곳이 완전히 사라지는 문제(특히 치명타/공속/
// 드랍률/물자·경험치처럼 전역 캡이 걸린 스탯 노드는 캡에 먼저 걸려 더 일찍 막힘)를 해결하기 위한
// 안전판. 상한 레벨이 없어 포인트가 쌓일 때마다 끝없이 투자할 수 있고, 캡이 없는 3대 스탯
// (공격력/방어력/최대 체력)에 동시에 아주 조금씩 붙는다. 레벨이 오를수록 비용이 계속 복리로
// 올라가므로 실질적으로는 "다 만렙 찍은 유저를 위한 완만한 무한 성장" 역할만 한다.
const MUTATION_TRANSCEND = {
  key:'mutTranscend', name:'차원 초월', icon:'🌌', maxLevel:Infinity, baseCost:80, mult:1.045,
  stat:'transcendTriple', perLevel:0.15, unit:'%', label:'공격력/방어력/최대 체력 (각각)',
  prereq:{allMaxed:true},
};

function mutationLevel(key){
  return (state.mutation && state.mutation.nodes && state.mutation.nodes[key]) || 0;
}

function mutationNodeByKey(key){
  if(key === MUTATION_TRANSCEND.key) return MUTATION_TRANSCEND;
  return MUTATION_TREE.find(n=>n.key===key);
}

function mutationNodeCost(node){
  const lvl = mutationLevel(node.key);
  return Math.ceil(node.baseCost * Math.pow(node.mult, lvl));
}

// 모든 기본 노드(전투/생존/자원 12개)가 "완료" 상태인지 — 차원 초월 해금 조건.
// 완료 = 노드 자체가 maxLevel에 도달했거나, 혹은 그 노드가 주는 스탯이 이미 전역 캡(치명타확률/
// 공속/드랍률/물자·경험치 배율 등)에 도달해서 더 찍는 게 애초에 불가능한 경우.
// 이 구분이 없으면, 장비/칭호/전직/동행 등 다른 소스만으로 이미 그 스탯의 전역 캡을 채운 유저는
// 해당 노드가 자기 maxLevel에 영원히 도달할 수 없어(구매 자체가 막히므로) 차원 초월이 절대
// 해금되지 않는 문제가 생긴다.
function allMutationNodesMaxed(){
  return MUTATION_TREE.every(n => mutationLevel(n.key) >= n.maxLevel || isUpgradeStatMaxed(n.stat));
}

function mutationNodeLocked(node){
  if(!node.prereq) return false;
  if(node.prereq.allMaxed) return !allMutationNodesMaxed();
  return mutationLevel(node.prereq.key) < node.prereq.lvl;
}

function mutationBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, rebirthSoulPct:0};
  if(!state.mutation) return b;
  MUTATION_TREE.forEach(node=>{
    const lvl = mutationLevel(node.key);
    if(lvl<=0) return;
    const val = lvl * node.perLevel;
    if(node.stat === 'atkDefPct'){
      b.atkPct += val; b.defPct += val;
    } else if(node.stat === 'goldExpPct'){
      b.goldPct += val; b.expPct += val;
    } else {
      b[node.stat] += val;
    }
  });
  const tLvl = mutationLevel(MUTATION_TRANSCEND.key);
  if(tLvl > 0){
    const tVal = tLvl * MUTATION_TRANSCEND.perLevel;
    b.atkPct += tVal; b.defPct += tVal; b.hpPct += tVal;
  }
  return b;
}

// 환생 시 얻는 혈청량에 곱해지는 배율. "혈청 정제" 노드(mutRes5)가 1레벨당 +1.5%,
// 최대 30레벨로 +45%까지 붙는다. 환생 보상은 순간적으로 한 번 지급되는 값이라 다른 스탯들과
// 달리 캡을 둘 필요가 없다 (매 환생마다 한 번씩만 적용되므로 눈덩이 피드백 루프가 생기지 않음).
function rebirthSoulMultiplier(){
  const mb = mutationBonus();
  return 1 + (mb.rebirthSoulPct||0) / 100;
}

function gainMutationPoints(amount){
  if(!state.mutation) return;
  state.mutation.points += amount;
  state.mutation.totalEarned = (state.mutation.totalEarned||0) + amount;
}

function buyMutationNode(key){
  const node = mutationNodeByKey(key);
  if(!node || mutationNodeLocked(node)) return;
  if(isUpgradeStatMaxed(node.stat)) return; // 실제 스탯이 이미 캡 도달 — 구매 차단
  const lvl = mutationLevel(key);
  if(lvl >= node.maxLevel) return;
  const cost = mutationNodeCost(node);
  if(state.mutation.points < cost) return;
  state.mutation.points -= cost;
  state.mutation.nodes[key] = lvl + 1;
  renderMutationTree();
  renderAll();
}

function renderMutationTree(){
  const el = document.getElementById('mutationTree');
  const ptText = document.getElementById('mutationPointsText');
  if(ptText) ptText.textContent = Math.floor(state.mutation.points).toLocaleString();
  if(!el) return;

  const branches = [
    {key:'atk', title:'⚔️ 전투'},
    {key:'def', title:'🛡️ 생존'},
    {key:'res', title:'📦 자원'},
  ];

  let html = '';
  branches.forEach(br=>{
    html += `<div class="mutation-branch"><div class="mutation-branch-title">${br.title}</div>`;
    MUTATION_TREE.filter(n=>n.branch===br.key).forEach(node=>{
      const lvl = mutationLevel(node.key);
      const locked = mutationNodeLocked(node);
      const maxed = lvl >= node.maxLevel;
      const cost = mutationNodeCost(node);
      const totalVal = (lvl*node.perLevel).toFixed((node.unit==='%p' || node.perLevel % 1 !== 0) ? 1 : 0);
      let footer;
      const statMaxed = isUpgradeStatMaxed(node.stat);
      if(locked){
        const preq = mutationNodeByKey(node.prereq.key);
        footer = `<div class="mutation-node-lock">🔒 ${preq.name} Lv.${node.prereq.lvl} 필요</div>`;
      } else if(maxed){
        footer = `<button class="mutation-buy-btn maxed" disabled>MAX</button>`;
      } else if(statMaxed){
        footer = `<button class="mutation-buy-btn maxed" disabled>⚡ 상한 도달 (효과없음)</button>`;
      } else {
        const afford = state.mutation.points >= cost;
        footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🧬 ${cost} 강화</button>`;
      }
      html += `
        <div class="mutation-node ${locked?'locked':''} ${maxed?'maxed':''}">
          <div class="mutation-node-top">
            <span class="mutation-node-icon">${node.icon}</span>
            <span class="mutation-node-name">${node.name}</span>
            <span class="mutation-node-lvl">Lv.${lvl}/${node.maxLevel}</span>
          </div>
          <div class="mutation-node-desc">${node.label} +${totalVal}${node.unit}</div>
          ${footer}
        </div>`;
    });
    html += `</div>`;
  });

  // ---- 차원 초월 (무한 성장 노드) ----
  {
    const node = MUTATION_TRANSCEND;
    const lvl = mutationLevel(node.key);
    const locked = mutationNodeLocked(node);
    const cost = mutationNodeCost(node);
    const totalVal = (lvl*node.perLevel).toFixed(1);
    let footer;
    if(locked){
      footer = `<div class="mutation-node-lock">🔒 위 12개 노드를 전부 만렙(또는 스탯 상한 도달)까지 찍어야 해금됩니다</div>`;
    } else {
      const afford = state.mutation.points >= cost;
      footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🧬 ${cost.toLocaleString()} 강화</button>`;
    }
    html += `<div class="mutation-branch"><div class="mutation-branch-title">🌌 초월 (무한 성장 · 남는 포인트 전용)</div>
      <div class="mutation-node ${locked?'locked':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${node.icon}</span>
          <span class="mutation-node-name">${node.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}</span>
        </div>
        <div class="mutation-node-desc">${node.label} 각각 +${totalVal}${node.unit} (상한 없음, 레벨이 오를수록 비용 증가)</div>
        ${footer}
      </div>
    </div>`;
  }

  el.innerHTML = html;
  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyMutationNode(btn.dataset.key));
  });
}

// ===== js/job.js =====
// ---------- 전직 (Job Class) ----------
// 레벨 1000을 달성하면 4개 직업 중 하나를 골라 전직할 수 있다. 직업은 영구 스탯 보너스를
// 주는 "빌드 선택" 개념 — 돌연변이 각성처럼 레벨업하는 게 아니라 하나를 고르는 방식.
// 최초 전직은 무료, 이후 재전직은 혈청을 소모한다 (직업을 잘못 골랐다고 영구히 막히지 않게).

const JOB_UNLOCK_LEVEL = 1000;
const JOB_RESPEC_COST = 15; // 재전직 시 소모되는 🧪 혈청

const JOB_CLASSES = [
  {
    key:'warrior', name:'베테랑 전사', icon:'⚔️',
    desc:'전선의 최전방에서 버티는 근접 특화 생존자.',
    bonus:{atkPct:25, defPct:15},
    bonusText:'공격력 +25% · 방어력 +15%',
  },
  {
    key:'sniper', name:'저격수', icon:'🎯',
    desc:'급소를 정확히 노려 치명적인 일격을 꽂는다.',
    bonus:{accuracyAdd:15, critDmgAdd:40},
    bonusText:'명중률 +15 · 치명타 피해 +40%',
  },
  {
    key:'scavenger', name:'약탈자', icon:'💰',
    desc:'폐허 구석구석까지 뒤져 남들보다 더 많이 챙긴다.',
    bonus:{dropAdd:20, atkPct:12},
    bonusText:'파편 드랍 확률 +20%p · 공격력 +12%',
  },
  {
    key:'survivalist', name:'생존 전문가', icon:'🩹',
    desc:'혹독한 환경에서 오래 버티고 빠르게 적응한다.',
    bonus:{hpPct:50, defPct:10},
    bonusText:'최대 체력 +50% · 방어력 +10%',
  },
];

function jobUnlocked(){
  return state.level >= JOB_UNLOCK_LEVEL;
}

function currentJob(){
  if(!state.job) return null;
  return JOB_CLASSES.find(j => j.key === state.job) || null;
}

// stats() 계산에 합산되는 직업 보너스. 돌연변이/스킬과 같은 필드 이름을 쓴다.
// 전직 고정 보너스 + 직업 숙련도 트리 보너스(jobMasteryBonus)를 합쳐서 반환한다.
function jobBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, accuracyAdd:0};
  const job = currentJob();
  if(!job) return b;
  Object.keys(job.bonus).forEach(k => { b[k] = (b[k]||0) + job.bonus[k]; });
  if(typeof jobMasteryBonus === 'function'){
    const mb = jobMasteryBonus();
    Object.keys(mb).forEach(k => { b[k] = (b[k]||0) + mb[k]; });
  }
  return b;
}

function selectJob(key){
  if(!jobUnlocked()) return;
  const job = JOB_CLASSES.find(j => j.key === key);
  if(!job || state.job === key) return;

  if(state.job === null){
    state.job = key;
    log(`🎖️ [${job.name}]으로 전직했습니다!`, 'good');
  } else {
    if(state.soul < JOB_RESPEC_COST){
      log(`재전직에는 🧪 혈청 ${JOB_RESPEC_COST}개가 필요합니다.`, 'warn');
      return;
    }
    state.soul -= JOB_RESPEC_COST;
    state.job = key;
    log(`🎖️ [${job.name}]으로 재전직했습니다! (🧪 혈청 -${JOB_RESPEC_COST})`, 'good');
  }
  renderJobPanel();
  renderAll();
}

function renderJobPanel(){
  const lockNotice = document.getElementById('jobLockNotice');
  const list = document.getElementById('jobList');
  const levelReqEl = document.getElementById('jobLevelReq');
  if(!list) return;

  const unlocked = jobUnlocked();

  if(levelReqEl) levelReqEl.style.display = unlocked ? 'none' : 'inline';
  const curLevelText = document.getElementById('jobCurrentLevelText');
  if(curLevelText) curLevelText.textContent = state.level;

  if(!unlocked){
    if(lockNotice) lockNotice.style.display = 'block';
    list.style.display = 'none';
    return;
  }
  if(lockNotice) lockNotice.style.display = 'none';
  list.style.display = 'grid';

  const isFirstPick = state.job === null;
  list.innerHTML = JOB_CLASSES.map(job => {
    const active = state.job === job.key;
    const label = active ? '선택됨' : (isFirstPick ? '전직하기' : `재전직 (🧪${JOB_RESPEC_COST})`);
    return `
      <div class="mutation-node ${active?'maxed':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${job.icon}</span>
          <span class="mutation-node-name">${job.name}</span>
        </div>
        <div class="mutation-node-desc">${job.desc}<br>${job.bonusText}</div>
        <button class="mutation-buy-btn ${active?'maxed':''}" data-key="${job.key}" ${active?'disabled':''}>${label}</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => selectJob(btn.dataset.key));
  });
}

// ---------- 직업 숙련도 (Job Mastery) ----------
// 전직 후 레벨업(+1)/보스 처치(+2)로 얻는 "숙련도 포인트"를 소모해 현재 직업 전용 트리를
// 강화하는 시스템. 돌연변이 각성과 같은 구조(트리+선행조건)를 쓰지만 포인트/진행도는
// 직업별로 완전히 분리 저장된다 — 재전직해도 예전 직업에 투자한 숙련도는 사라지지 않고,
// 나중에 그 직업으로 돌아오면 그대로 남아있다 (재전직 페널티를 완화해주는 장치).
const JOB_MASTERY_TREES = {
  warrior: [
    {key:'wmDef1', name:'전선 유지', icon:'🛡️', maxLevel:40, baseCost:3, mult:1.15,
      stat:'defPct', perLevel:0.8, unit:'%', label:'방어력', prereq:null},
    {key:'wmAtk1', name:'결전 태세', icon:'⚔️', maxLevel:40, baseCost:5, mult:1.18,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'wmDef1', lvl:5}},
    {key:'wmCrit1', name:'불굴의 반격', icon:'🔥', maxLevel:30, baseCost:9, mult:1.24,
      stat:'critDmgAdd', perLevel:1.5, unit:'%', label:'치명타 피해', prereq:{key:'wmAtk1', lvl:10}},
  ],
  sniper: [
    {key:'smAcc1', name:'정밀 조준', icon:'🔭', maxLevel:40, baseCost:3, mult:1.15,
      stat:'accuracyAdd', perLevel:0.6, unit:'', label:'명중률', prereq:null},
    {key:'smCrit1', name:'급소 타격', icon:'🎯', maxLevel:30, baseCost:5, mult:1.2,
      stat:'critAdd', perLevel:0.4, unit:'%', label:'치명타 확률', prereq:{key:'smAcc1', lvl:5}},
    {key:'smCrit2', name:'처형자의 눈', icon:'💀', maxLevel:30, baseCost:9, mult:1.24,
      stat:'critDmgAdd', perLevel:1.5, unit:'%', label:'치명타 피해', prereq:{key:'smCrit1', lvl:10}},
  ],
  scavenger: [
    {key:'scDrop1', name:'눈썰미', icon:'👁️', maxLevel:30, baseCost:3, mult:1.16,
      stat:'dropAdd', perLevel:0.3, unit:'%p', label:'파편 드랍 확률', prereq:null},
    {key:'scGold1', name:'빠른 손', icon:'🤲', maxLevel:35, baseCost:5, mult:1.18,
      stat:'goldPct', perLevel:1, unit:'%', label:'물자 획득', prereq:{key:'scDrop1', lvl:5}},
    {key:'scAtk1', name:'대박의 감', icon:'🎰', maxLevel:30, baseCost:9, mult:1.24,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'scGold1', lvl:10}},
  ],
  survivalist: [
    {key:'svHp1', name:'인내의 한계', icon:'🩸', maxLevel:40, baseCost:3, mult:1.15,
      stat:'hpPct', perLevel:1, unit:'%', label:'최대 체력', prereq:null},
    {key:'svDef1', name:'회복력', icon:'💉', maxLevel:35, baseCost:5, mult:1.18,
      stat:'defPct', perLevel:0.8, unit:'%', label:'방어력', prereq:{key:'svHp1', lvl:5}},
    {key:'svAtk1', name:'최후의 저항', icon:'🔥', maxLevel:30, baseCost:9, mult:1.24,
      stat:'atkPct', perLevel:0.8, unit:'%', label:'공격력', prereq:{key:'svDef1', lvl:10}},
  ],
};

function jobMasteryTreeFor(jobKey){
  return JOB_MASTERY_TREES[jobKey] || null;
}

// 직업별로 분리된 숙련도 진행 상태를 가져오거나(없으면) 새로 만든다.
function jobMasteryStateFor(jobKey){
  if(!state.jobMastery) state.jobMastery = {};
  if(!state.jobMastery[jobKey]) state.jobMastery[jobKey] = {points:0, totalEarned:0, nodes:{}};
  return state.jobMastery[jobKey];
}

function jobMasteryLevel(jobKey, key){
  const ms = state.jobMastery && state.jobMastery[jobKey];
  return (ms && ms.nodes && ms.nodes[key]) || 0;
}

function jobMasteryNodeCost(jobKey, node){
  const lvl = jobMasteryLevel(jobKey, node.key);
  return Math.ceil(node.baseCost * Math.pow(node.mult, lvl));
}

function jobMasteryNodeLocked(jobKey, node){
  if(!node.prereq) return false;
  return jobMasteryLevel(jobKey, node.prereq.key) < node.prereq.lvl;
}

// 현재 전직 중인 직업의 숙련도 트리가 주는 보너스만 stats()에 반영된다.
// (직업을 바꾸면 그 직업의 트리로 보너스도 함께 전환됨 — 진행도 자체는 안 사라짐)
function jobMasteryBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, accuracyAdd:0};
  if(!state.job) return b;
  const tree = jobMasteryTreeFor(state.job);
  if(!tree) return b;
  tree.forEach(node=>{
    const lvl = jobMasteryLevel(state.job, node.key);
    if(lvl<=0) return;
    b[node.stat] += lvl * node.perLevel;
  });
  return b;
}

// 레벨업/보스 처치 시 호출 — 전직한 상태에서만 현재 직업의 숙련도 포인트가 쌓인다.
function gainJobMasteryPoints(amount){
  if(!state.job) return;
  const ms = jobMasteryStateFor(state.job);
  ms.points += amount;
  ms.totalEarned = (ms.totalEarned||0) + amount;
}

function buyJobMasteryNode(key){
  if(!state.job) return;
  const tree = jobMasteryTreeFor(state.job);
  const node = tree && tree.find(n=>n.key===key);
  if(!node || jobMasteryNodeLocked(state.job, node)) return;
  const lvl = jobMasteryLevel(state.job, key);
  if(lvl >= node.maxLevel) return;
  const ms = jobMasteryStateFor(state.job);
  const cost = jobMasteryNodeCost(state.job, node);
  if(ms.points < cost) return;
  ms.points -= cost;
  ms.nodes[key] = lvl + 1;
  renderJobMasteryPanel();
  renderAll();
}

function renderJobMasteryPanel(){
  const wrap = document.getElementById('jobMasteryWrap');
  const lockNotice = document.getElementById('jobMasteryLockNotice');
  const el = document.getElementById('jobMasteryTree');
  const ptText = document.getElementById('jobMasteryPointsText');
  if(!wrap || !el) return;

  if(!state.job){
    wrap.style.display = 'block';
    if(lockNotice) lockNotice.style.display = 'block';
    el.style.display = 'none';
    if(ptText) ptText.parentElement.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  if(lockNotice) lockNotice.style.display = 'none';
  el.style.display = 'grid';
  if(ptText) ptText.parentElement.style.display = 'block';

  const ms = jobMasteryStateFor(state.job);
  const tree = jobMasteryTreeFor(state.job);
  const jobMeta = currentJob();
  if(ptText) ptText.textContent = Math.floor(ms.points).toLocaleString();

  el.innerHTML = tree.map(node=>{
    const lvl = jobMasteryLevel(state.job, node.key);
    const locked = jobMasteryNodeLocked(state.job, node);
    const maxed = lvl >= node.maxLevel;
    const cost = jobMasteryNodeCost(state.job, node);
    const totalVal = (lvl*node.perLevel).toFixed(node.perLevel % 1 !== 0 ? 1 : 0);
    let footer;
    if(locked){
      const preq = tree.find(n=>n.key===node.prereq.key);
      footer = `<div class="mutation-node-lock">🔒 ${preq.name} Lv.${node.prereq.lvl} 필요</div>`;
    } else if(maxed){
      footer = `<button class="mutation-buy-btn maxed" disabled>MAX</button>`;
    } else {
      const afford = ms.points >= cost;
      footer = `<button class="mutation-buy-btn" data-key="${node.key}" ${afford?'':'disabled'}>🎖️ ${cost.toLocaleString()} 강화</button>`;
    }
    return `
      <div class="mutation-node ${locked?'locked':''} ${maxed?'maxed':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${node.icon}</span>
          <span class="mutation-node-name">${node.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}/${node.maxLevel}</span>
        </div>
        <div class="mutation-node-desc">${node.label} +${totalVal}${node.unit}</div>
        ${footer}
      </div>`;
  }).join('');

  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyJobMasteryNode(btn.dataset.key));
  });
}

// ===== js/titles.js =====
// ---------- Titles (칭호) ----------
// 조건을 달성하면 영구 해금되며, 해금된 칭호 중 하나만 장착 가능. 장착한 칭호의 효과만 적용됨.

// 닉네임 앞에 붙는 칭호 표시(아이콘 + 이름을 항상 텍스트로). 광장 접속자 목록/채팅/랭킹에서 공용으로 사용.
// titleKey: presence/chat/rankings 문서에 저장된 state.equippedTitle 값 (없으면 null/undefined).
function titleBadgeHtml(titleKey){
  if(!titleKey) return '';
  const t = TITLES.find(x=>x.key===titleKey);
  if(!t) return ''; // 옛 채팅 로그 등에 더 이상 존재하지 않는 칭호 키가 남아있어도 조용히 무시
  return `<span class="name-title-badge">${t.icon} ${escapeHtml(t.name)}</span>`;
}

function titleUnlocked(t){
  return !!(state.unlockedTitles && state.unlockedTitles[t.key]);
}

// 조건을 만족했지만 아직 영구 기록되지 않은 칭호를 찾아 state.unlockedTitles에 박아넣는다.
// (renderTitles가 호출될 때마다 함께 실행되므로 renderAll 주기로 자연스럽게 계속 확인됨)
// 한 번 이 플래그가 서면 환생으로 레벨/최고층 등이 초기화돼도 칭호 해금은 유지된다.
function checkTitleUnlocks(){
  if(!state.unlockedTitles) state.unlockedTitles = {};
  TITLES.forEach(t=>{
    if(state.unlockedTitles[t.key]) return;
    let achieved = false;
    try{ achieved = !!t.check(state); }catch(e){ achieved = false; }
    if(achieved){
      state.unlockedTitles[t.key] = true;
      log(`🎖️ 칭호 해금: ${t.icon} ${t.name}`, 'good');
    }
  });
}

function titleBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0, accuracyAdd:0};
  if(!state.equippedTitle) return b;
  const t = TITLES.find(x=>x.key===state.equippedTitle);
  if(!t || !titleUnlocked(t)) return b; // 조건을 더 이상 만족하지 못하면(비정상 상태) 효과 미적용
  b[t.stat] += t.value;
  return b;
}

function titleEffectText(t){
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%', accuracyAdd:''};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도', accuracyAdd:'명중률'};
  return `${labelMap[t.stat]} +${t.value}${unitMap[t.stat]}`;
}

function equipTitle(key){
  const t = TITLES.find(x=>x.key===key);
  if(!t || !titleUnlocked(t)) return;
  state.equippedTitle = (state.equippedTitle === key) ? null : key;
  renderTitles();
  renderAll();
  if(typeof renderAccountPanel === 'function' && typeof fbAuth !== 'undefined' && fbAuth.currentUser){
    renderAccountPanel(fbAuth.currentUser);
  }
}

function renderTitles(){
  checkTitleUnlocks();
  const grid = document.getElementById('titleGrid');
  if(!grid) return;
  const unlockedCount = TITLES.filter(titleUnlocked).length;
  const countEl = document.getElementById('titleUnlockedCount');
  if(countEl) countEl.textContent = `${unlockedCount} / ${TITLES.length}`;

  grid.innerHTML = '';
  TITLES.forEach(t=>{
    const unlocked = titleUnlocked(t);
    const equipped = state.equippedTitle === t.key;
    const card = document.createElement('div');
    card.className = 'relic-card title-card' + (unlocked?' owned':'') + (equipped?' equipped':'');
    card.innerHTML = `
      <div class="rname"><span>${t.icon} ${t.name}</span>${equipped?'<span class="title-equipped-tag">장착중</span>':''}</div>
      <div class="rdesc">${titleEffectText(t)}</div>
      <div class="title-cond">${unlocked ? '✅ 달성 완료' : `🔒 ${t.condText}`}</div>
      ${unlocked ? `<button class="title-equip-btn ${equipped?'unequip':''}" data-key="${t.key}">${equipped?'해제':'장착'}</button>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.title-equip-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>equipTitle(btn.dataset.key));
  });
}

// ===== js/state.js =====
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
    lifetimeGoldEarned: 0,     // 누적 물자 획득 (환생해도 유지 — 업적/통계용)
    totalFragmentsEarned: 0,   // 누적 유산 파편 획득 (환생해도 유지 — 업적/통계용)
    killPassClaimed: 0, // 처치 패스에서 순서대로 수령 완료한 단계 수 (환생해도 totalKills처럼 유지됨)
    rebirthCount: 0,
    rebirthHistory: [], // 환생 1회당 1건씩 기록: {at, floor, gainSoul, gainFrag}. 환생해도 이 기록 자체는 유지됨
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
    jobMastery: {}, // 직업별(warrior/sniper/scavenger/survivalist) 숙련도 트리 진행도, 재전직해도 보존됨
    claimedGlobalGifts: {},
    unlockedTitles: {}, // 한 번 조건을 달성한 칭호는 여기 영구 기록되어 환생해도 사라지지 않음
    lastSave: Date.now(),
    attendance: {
      day: 0,
      lastClaim: 0,
      total: 0 // 총 출석일 (7일 주기 day와 별개로 영구 누적 — 출석 달성 칭호 조건에 사용)
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

    // ---------- Forge Dungeon (단조 구역, 강화석 보상) ----------
    fdFloor: 1,
    fdTicket: 3,
    fdTicketLastRefill: Date.now(),
    fdActive: false,
    fdMonsterHp: 0,
    fdMonsterMaxHp: 0,
    fdPlayerHp: 0,
    fdCleared: false,

    // ---------- Training Dungeon (수련 구역, 경험치 보상) ----------
    tdFloor: 1,
    tdTicket: 3,
    tdTicketLastRefill: Date.now(),
    tdActive: false,
    tdMonsterHp: 0,
    tdMonsterMaxHp: 0,
    tdPlayerHp: 0,
    tdCleared: false,

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

    // ---------- 영지 (Territory / 방치형 건물 생산) ----------
    // 건물을 지어 시간당 골드/파편/혈청을 자동 생산. 접속 안 해도 계속 쌓이지만
    // 저장 상한(TERRITORY_CAP_HOURS)이 있어 무한 방치 이득은 없고, 직접 "수확" 버튼을 눌러야 지급됨.
    territory: {
      // 시작 슬롯 3칸에 3종 건물이 하나씩 기본 배치되어 있음 (해금 조건 없음)
      buildings: [
        {type:'gold', level:1, tier:1},
        {type:'fragment', level:1, tier:1},
        {type:'soul', level:1, tier:1},
      ],
      slotCount: 3,
      lastCollect: {gold: Date.now(), fragment: Date.now(), soul: Date.now()},
    },
  };
}

let state = defaultState();
let playerTickHandle = null;
let monsterTickHandle = null;

// 서로 동시에 진행할 수 없는 "부속 전투 콘텐츠"들의 활성 상태 플래그 목록.
// 새 던전/컨텐츠를 추가할 때 이 배열에만 키를 더하면 모든 기존 입장 체크에 자동으로 반영된다.
const SUB_ACTIVITY_FLAGS = ['raidActive', 'gdActive', 'rdActive', 'wbActive', 'fdActive', 'tdActive'];
function anySubActivityActive(excludeKey){
  return SUB_ACTIVITY_FLAGS.some(k => k !== excludeKey && state[k]);
}

// ---------- 상한(캡)이 걸린 파생 스탯 상수 ----------
// stats() 안에서만 쓰던 값을 밖으로 빼서, 강화 UI 쪽에서도 "지금 이미 캡인지" 체크할 수 있게 함.
const GOLD_MULT_CAP = 100;
const EXP_MULT_CAP = 100;
const DROP_CHANCE_CAP = 0.6;
const TICK_MS_MIN = 100; // 공격속도 하한 (더 빨라질 수 없는 지점, 초당 10타 상한)
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

// ---------- 숫자 축약 표기 (만/억/조) ----------
// 랭킹/광장처럼 칸이 좁은 목록에서 큰 숫자가 옆 칸과 겹치는 것을 막기 위해 사용.
// 정확한 원래 값은 반환값과 별개로 필요하면 toLocaleString()으로 따로 표시.
function formatCompactNumber(n){
  n = Math.floor(n || 0);
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  const trim = (v) => {
    let str = v.toFixed(2);
    str = str.replace(/0+$/,'').replace(/\.$/,'');
    return str;
  };
  if(n >= 1e12) return sign + trim(n/1e12) + '조';
  if(n >= 1e8) return sign + trim(n/1e8) + '억';
  if(n >= 1e4) return sign + trim(n/1e4) + '만';
  return sign + n.toLocaleString();
}
function expNeeded(lvl){ return Math.round(50 * Math.pow(lvl, 1.4)); }
function tryLevelUp(){
  let needed = expNeeded(state.level);
  while(state.exp >= needed){
    state.exp -= needed;
    state.level++;
    if(typeof gainMutationPoints === 'function') gainMutationPoints(1);
    if(typeof gainJobMasteryPoints === 'function') gainJobMasteryPoints(1);
    log(`레벨 업! Lv.${state.level}`, 'good');
    needed = expNeeded(state.level);
  }
}
// ===== js/combat.js =====
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

// ---------- Monster generation ----------
function monsterHpFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(50 * Math.pow(floor, 1.3));
  }
  if(state.mode === 'towerHard'){
    return Math.round(300 * Math.pow(floor, 1.5));
  }
  let hp =
  Math.round(
    35 * Math.pow(floor, 1.45)
  );
  if(boss)
    hp *= 6;
  return Math.round(hp * normalTierMult(floor));
}
function monsterAtkFor(floor, boss){

  if(state.mode === 'tower'){
    return Math.round(
      10 + floor*8
    );
  }
  if(state.mode === 'towerHard'){
    return Math.round(40 + floor*25);
  }
  let atk =
  8 + Math.pow(floor, 1.15) * 2.5;
  if(boss)
    atk *= 2.2;
  return Math.round(atk * normalTierMult(floor));
}
function monsterDefFor(floor, boss){
  if(state.mode === 'tower'){
    return Math.round(
      floor*0.8
    );
  }
  if(state.mode === 'towerHard'){
    return Math.round(floor*3.5);
  }
  let def =
  Math.pow(floor, 1.35) * 0.7;
  if(boss)
    def *= 1.8;
  return Math.round(def * normalTierMult(floor));
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

  let dmgToMonster = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss)));
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
  const monAtk = monsterAtkFor(currentFloor, state.isBoss);
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
// ===== js/skills.js =====
// ---------- 액티브 스킬 (자동 발동) ----------
// 🧪 혈청으로 습득/강화하는 액티브 스킬. 각 스킬은 배우는 즉시 자신만의 쿨타임마다
// 자동으로 발동한다(수동 조작 없음). 레벨이 오를수록 쿨타임이 짧아지고 효과가 강해진다.
// 패시브 성격의 영구 강화는 이미 "돌연변이 각성"이 담당하므로, 여기서는 전투 중
// 눈에 보이는 "발동형" 효과만 다룬다.
//
// 아래 4개(이중 강타/관통 사격/응급 처치/강탈 일격)는 직업(job) 상관없이 누구나 배울 수 있는
// 기본 스킬. 그 아래 JOB_EXCLUSIVE_SKILLS 4개는 전직(job.js, 레벨 1000)해서 해당 직업을
// 선택해야만 새로 습득/강화할 수 있는 직업 전용 스킬이다.
const ACTIVE_SKILLS = [
  {
    key:'skillDoubleStrike', name:'이중 강타', icon:'🗡️',
    maxLevel:30, baseCost:3, costMult:1.35,
    baseCooldown:10, minCooldown:4, cdStep:0.7,
    descFn: lvl => `공격력만큼 추가 타격 (치명타 적용) · ${skillCooldownSec({baseCooldown:10,minCooldown:4,cdStep:0.7}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPiercing', name:'관통 사격', icon:'🎯',
    maxLevel:30, baseCost:4, costMult:1.35,
    baseCooldown:15, minCooldown:8, cdStep:0.8,
    descFn: lvl => `방어 무시 피해(공격력의 ${(80+Math.max(lvl,1)*15)}%) · ${skillCooldownSec({baseCooldown:15,minCooldown:8,cdStep:0.8}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPatch', name:'응급 처치', icon:'🩹',
    maxLevel:30, baseCost:3, costMult:1.3,
    baseCooldown:20, minCooldown:12, cdStep:1.0,
    descFn: lvl => `최대 체력의 ${(8+Math.max(lvl,1)*2)}% 즉시 회복 · ${skillCooldownSec({baseCooldown:20,minCooldown:12,cdStep:1.0}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillPlunder', name:'강탈 일격', icon:'💰',
    maxLevel:30, baseCost:4, costMult:1.35,
    baseCooldown:18, minCooldown:9, cdStep:1.0,
    descFn: lvl => `타격과 동시에 물자 획득(평소 획득량의 ${(30+Math.max(lvl,1)*10)}%) · ${skillCooldownSec({baseCooldown:18,minCooldown:9,cdStep:1.0}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  // ---------- 직업 전용 스킬 (전직 필요) ----------
  {
    key:'skillWarCry', name:'전장의 포효', icon:'🛡️', job:'warrior',
    maxLevel:30, baseCost:5, costMult:1.35,
    baseCooldown:16, minCooldown:8, cdStep:0.9,
    descFn: lvl => `공격력+방어력을 합산한 강타(공격력 + 방어력×${(1.5+Math.max(lvl,1)*0.15).toFixed(1)}), 방어 무시 · ${skillCooldownSec({baseCooldown:16,minCooldown:8,cdStep:0.9}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillDeadeye', name:'확정 필살', icon:'💥', job:'sniper',
    maxLevel:30, baseCost:6, costMult:1.4,
    baseCooldown:22, minCooldown:12, cdStep:1.1,
    descFn: lvl => `회피 무시(무조건 명중)로 치명타 확정 강타(피해 ${(150+Math.max(lvl,1)*15)}%) · ${skillCooldownSec({baseCooldown:22,minCooldown:12,cdStep:1.1}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillJackpot', name:'대박 사냥', icon:'🎰', job:'scavenger',
    maxLevel:30, baseCost:6, costMult:1.4,
    baseCooldown:25, minCooldown:14, cdStep:1.2,
    descFn: lvl => `타격 없이 즉시 물자(평소 처치 보상의 ${(200+Math.max(lvl,1)*30)}%) + ◈ 유산 파편 1개 획득 · ${skillCooldownSec({baseCooldown:25,minCooldown:14,cdStep:1.2}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
  {
    key:'skillIronWill', name:'불굴의 의지', icon:'💪', job:'survivalist',
    maxLevel:30, baseCost:5, costMult:1.3,
    baseCooldown:26, minCooldown:16, cdStep:1.0,
    descFn: lvl => `최대 체력의 ${(15+Math.max(lvl,1)*2)}% 즉시 회복 + 다음 치명적인 일격을 1회 버텨냄(체력 1로 생존) · ${skillCooldownSec({baseCooldown:26,minCooldown:16,cdStep:1.0}, Math.max(lvl,1)).toFixed(1)}초마다`,
  },
];

// 쿨타임(밀리초 타임스탬프)은 세션 동안만 유지하면 충분해서 state에 넣지 않고
// 별도 런타임 변수로 관리한다 (새로고침 시 초기화되어도 무방).
let skillCooldowns = {};

function skillLevel(key){
  return (state.skills && state.skills[key]) || 0;
}

function skillCost(sk, lvl){
  return Math.ceil(sk.baseCost * Math.pow(sk.costMult, lvl));
}

function skillCooldownSec(sk, lvl){
  return Math.max(sk.minCooldown, sk.baseCooldown - Math.max(lvl,1) * sk.cdStep);
}

function buySkill(key){
  const sk = ACTIVE_SKILLS.find(s=>s.key===key);
  if(!sk) return;
  const lvl = skillLevel(key);
  if(lvl >= sk.maxLevel) return;
  if(sk.job && state.job !== sk.job){
    const jobMeta = (typeof JOB_CLASSES !== 'undefined') ? JOB_CLASSES.find(j=>j.key===sk.job) : null;
    log(`${sk.icon} [${sk.name}]은(는) ${jobMeta ? jobMeta.icon+' '+jobMeta.name : sk.job} 전용 스킬입니다. 전직 후 습득/강화할 수 있습니다.`, 'warn');
    return;
  }
  const cost = skillCost(sk, lvl);
  if(state.soul < cost) return;
  state.soul -= cost;
  state.skills[key] = lvl + 1;
  if(lvl === 0){
    skillCooldowns[key] = Date.now(); // 처음 배운 스킬은 쿨타임을 다 채운 뒤 첫 발동
    log(`🗡️ [${sk.name}] 스킬을 습득했습니다! 자동으로 발동합니다.`, 'good');
  } else {
    log(`${sk.name} 강화! (Lv.${state.skills[key]})`, 'good');
  }
  renderAll();
}

// ---------- 발동 로직 ----------
function triggerActiveSkill(sk, lvl){
  const s = stats();
  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);

  if(sk.key === 'skillDoubleStrike'){
    if(state.monsterHp <= 0) return false;
    let dmg = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss)));
    const isCrit = Math.random()*100 < s.critChance;
    if(isCrit) dmg = Math.round(dmg * s.critDamageMult);
    dealDamageToMonster(dmg, isCrit, {floatClass:'skill'});
    log(`🗡️ 이중 강타 발동!`, 'new');
    return true;
  }

  if(sk.key === 'skillPiercing'){
    if(state.monsterHp <= 0) return false;
    const dmg = Math.round(s.atk * (0.8 + lvl*0.15));
    dealDamageToMonster(dmg, false, {floatClass:'skill'});
    log(`🎯 관통 사격 발동! (방어 무시 -${dmg})`, 'new');
    return true;
  }

  if(sk.key === 'skillPatch'){
    if(state.playerHp <= 0 || state.playerHp >= s.maxHp) return false; // 이미 풀피면 대기, 쿨타임 소모 안 함
    const healAmt = Math.round(s.maxHp * (0.08 + lvl*0.02));
    state.playerHp = Math.min(s.maxHp, state.playerHp + healAmt);
    floatText('+'+healAmt, 'heal');
    log(`🩹 응급 처치 발동! (+${healAmt} 체력)`, 'good');
    return true;
  }

  if(sk.key === 'skillPlunder'){
    if(state.monsterHp <= 0) return false;
    const dmg = Math.round(s.atk * (0.6 + lvl*0.1));
    const bonusGold = Math.round(goldDropFor(currentFloor, state.isBoss) * s.goldMult * (0.3 + lvl*0.1));
    dealDamageToMonster(dmg, false, {floatClass:'skill'});
    state.gold += bonusGold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
    floatText('+'+bonusGold+'📦', 'good');
    log(`💰 강탈 일격 발동! (+${bonusGold}📦)`, 'good');
    return true;
  }

  // ---------- 직업 전용 스킬 ----------
  if(sk.key === 'skillWarCry'){
    if(state.monsterHp <= 0) return false;
    const dmg = Math.round(s.atk + s.def * (1.5 + lvl*0.15));
    dealDamageToMonster(dmg, false, {floatClass:'skill'});
    log(`🛡️ 전장의 포효 발동! (방어 무시 -${dmg})`, 'new');
    return true;
  }

  if(sk.key === 'skillDeadeye'){
    if(state.monsterHp <= 0) return false;
    let dmg = Math.round(Math.max(1, s.atk - monsterDefFor(currentFloor, state.isBoss)) * (1.5 + lvl*0.15));
    dmg = Math.round(dmg * s.critDamageMult); // 확정 치명타
    dealDamageToMonster(dmg, true, {floatClass:'skill'}); // 회피 판정 없이(hitChanceFor 미적용) 확정 명중
    log(`💥 확정 필살 발동! (확정 명중, CRIT -${dmg})`, 'new');
    return true;
  }

  if(sk.key === 'skillJackpot'){
    if(state.monsterHp <= 0) return false;
    const bonusGold = Math.round(goldDropFor(currentFloor, state.isBoss) * s.goldMult * (2.0 + lvl*0.3));
    state.gold += bonusGold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + bonusGold;
    state.fragments = (state.fragments||0) + 1;
    floatText('+'+bonusGold+'📦', 'good');
    log(`🎰 대박 사냥 발동! (+${bonusGold}📦, ◈ 유산 파편 +1)`, 'good');
    return true;
  }

  if(sk.key === 'skillIronWill'){
    if(state.playerHp <= 0) return false;
    const healAmt = Math.round(s.maxHp * (0.15 + lvl*0.02));
    if(state.playerHp > 0 && state.playerHp < s.maxHp){
      state.playerHp = Math.min(s.maxHp, state.playerHp + healAmt);
      floatText('+'+healAmt, 'heal');
    }
    state.ironWillCharges = (state.ironWillCharges||0) + 1;
    log(`💪 불굴의 의지 발동! (+${healAmt} 체력, 치명적인 일격 1회 방지 준비)`, 'good');
    return true;
  }

  return false;
}

function checkActiveSkills(){
  if(!state.skills) return;
  // 무한의 탑을 완전히 클리어하면 combat.js 쪽 전투 루프는 이미 멈춰있지만(더미 몬스터만 유지),
  // 액티브 스킬은 그 더미를 계속 타격 가능한 대상으로 인식해 무한정 발동할 수 있었다.
  // 클리어 후에는 스킬도 완전히 멈춰야 하므로(강탈 일격 등으로 골드가 계속 들어오는 문제 방지) 여기서 차단.
  if((state.mode === 'tower' && state.towerCleared) || (state.mode === 'towerHard' && state.htCleared)) return;
  const now = Date.now();
  let touched = false;
  ACTIVE_SKILLS.forEach(sk=>{
    const lvl = skillLevel(sk.key);
    if(lvl <= 0) return;
    const cdMs = skillCooldownSec(sk, lvl) * 1000;
    const last = skillCooldowns[sk.key] || 0;
    if(now - last < cdMs) return;
    const fired = triggerActiveSkill(sk, lvl);
    if(fired){
      skillCooldowns[sk.key] = now;
      touched = true;
    }
  });
  if(touched) renderCombatFrame();
}

// ---------- 체력바 밑 스킬 쿨타임 트레이 ----------
// 습득한 스킬 아이콘을 보여주고, 각 아이콘 위에 남은 쿨타임을 어두운 오버레이로 표시한다.
// 이 트레이에는 클릭 가능한 버튼이 없으므로(순수 표시용), 빠른 주기(100ms)로 갱신해도
// "버튼이 재생성돼 클릭이 씹히는" 문제가 생기지 않는다. 그래도 매번 innerHTML을 통째로
// 새로 만들진 않고, 슬롯 구성이 바뀔 때만 다시 그리고 평소엔 스타일/텍스트만 갱신한다.
function renderSkillTray(){
  const el = document.getElementById('skillTray');
  if(!el || !state.skills) return;
  const learned = ACTIVE_SKILLS.filter(sk => skillLevel(sk.key) > 0);

  const existingKeys = Array.from(el.children).map(c => c.dataset.key);
  const neededKeys = learned.map(sk => sk.key);
  const same = existingKeys.length === neededKeys.length && existingKeys.every((k,i) => k === neededKeys[i]);

  if(!same){
    el.innerHTML = learned.map(sk => `
      <div class="skill-icon-slot" data-key="${sk.key}" title="${sk.name}">
        <span class="skill-lvl-badge">${skillLevel(sk.key)}</span>
        <span class="skill-icon-emoji">${sk.icon}</span>
        <div class="skill-cd-overlay"></div>
        <div class="skill-cd-text"></div>
      </div>`).join('');
  } else {
    learned.forEach(sk => {
      const badge = el.querySelector(`.skill-icon-slot[data-key="${sk.key}"] .skill-lvl-badge`);
      if(badge) badge.textContent = skillLevel(sk.key);
    });
  }
  updateSkillTrayCooldowns();
}

function updateSkillTrayCooldowns(){
  const el = document.getElementById('skillTray');
  if(!el || !state.skills) return;
  const now = Date.now();
  ACTIVE_SKILLS.forEach(sk => {
    const lvl = skillLevel(sk.key);
    if(lvl <= 0) return;
    const slot = el.querySelector(`.skill-icon-slot[data-key="${sk.key}"]`);
    if(!slot) return;
    const cdMs = skillCooldownSec(sk, lvl) * 1000;
    const last = skillCooldowns[sk.key] || 0;
    const remainMs = Math.max(0, cdMs - (now - last));
    const pct = Math.min(100, (remainMs / cdMs) * 100);
    const overlay = slot.querySelector('.skill-cd-overlay');
    const text = slot.querySelector('.skill-cd-text');
    if(overlay) overlay.style.height = pct + '%';
    if(text) text.textContent = remainMs > 50 ? (remainMs/1000).toFixed(1) : '';
    slot.classList.toggle('ready', remainMs <= 50);
  });
}

// ---------- UI (강화 패널) ----------
function renderSkillsPanel(){
  const el = document.getElementById('skillsList');
  if(!el) return;
  let html = '';
  ACTIVE_SKILLS.forEach(sk=>{
    const lvl = skillLevel(sk.key);
    const maxed = lvl >= sk.maxLevel;
    const cost = skillCost(sk, lvl);
    const afford = state.soul >= cost;
    const jobMeta = (typeof JOB_CLASSES !== 'undefined') ? JOB_CLASSES.find(j=>j.key===sk.job) : null;
    // 이미 습득한 스킬(lvl>0)은 재전직해서 다른 직업이어도 계속 강화 가능하게 둔다.
    // 신규 습득(lvl===0)만 "지금 그 직업이어야" 가능하도록 막는다.
    const jobLocked = sk.job && state.job !== sk.job && lvl === 0;
    const jobTagHtml = jobMeta ? `<span class="skill-job-tag">${jobMeta.icon} ${jobMeta.name} 전용</span> · ` : '';

    let btnHtml;
    if(maxed){
      btnHtml = `<button class="mutation-buy-btn maxed" disabled>MAX</button>`;
    } else if(jobLocked){
      btnHtml = `<button class="mutation-buy-btn" disabled>${jobMeta ? jobMeta.icon+' '+jobMeta.name+' 전직 필요' : '전직 필요'}</button>`;
    } else {
      btnHtml = `<button class="mutation-buy-btn" data-key="${sk.key}" ${afford?'':'disabled'}>🧪 ${cost} ${lvl===0?'습득':'강화'}</button>`;
    }

    html += `
      <div class="mutation-node ${maxed?'maxed':''} ${jobLocked?'locked':''}">
        <div class="mutation-node-top">
          <span class="mutation-node-icon">${sk.icon}</span>
          <span class="mutation-node-name">${sk.name}</span>
          <span class="mutation-node-lvl">Lv.${lvl}/${sk.maxLevel}</span>
        </div>
        <div class="mutation-node-desc">${jobTagHtml}${sk.descFn(lvl)}</div>
        ${btnHtml}
      </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.mutation-buy-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buySkill(btn.dataset.key));
  });
}

// ===== js/equipment.js =====
// ---------- Equipment (장비 뽑기 시스템) ----------
// 물자로 뽑는 무기/방어구 2슬롯 장비. 뽑기 등급(초급~전설)이 높을수록 비용이 크게 오르는 대신
// 더 높은 희귀도(일반/희귀/영웅/전설)와 좋은 옵션이 나올 확률이 오른다.

let equipPullMultiplier = 1;
document.querySelectorAll('.equip-mult-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    equipPullMultiplier = parseInt(btn.dataset.mult, 10);
    document.querySelectorAll('.equip-mult-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderEquipment();
  });
});

// 보유 장비 목록은 기본적으로 접혀 있고, 제목을 클릭하면 펼쳐진다 (기본 접힘: 계속 쌓이는 목록이
// 화면을 밀어내리는 문제를 막기 위함). 펼쳐진 상태에서도 최대 높이를 넘으면 내부 스크롤 처리.
let equipInvExpanded = false;
document.getElementById('equipInvHeader')?.addEventListener('click', () => {
  equipInvExpanded = !equipInvExpanded;
  renderEquipment();
});

function rand(min, max){ return min + Math.random() * (max - min); }

// 서브 옵션 키 -> statCapStatus() 필드명 매핑. 상한(캡) 개념이 없는 항목(치명타 피해/최대 체력)은
// 여기 없음 — 그런 항목은 항상 뽑힐 수 있다.
const SUBSTAT_CAP_FIELD = {crit:'crit', spd:'spd', gold:'gold', exp:'exp'};

// 이미 상한에 도달해서 이 서브 옵션이 붙어봤자 효과가 없는 상태인지 확인.
// (물자획득을 골드강화로 이미 다 찍은 상태에서 장신구에 또 물자획득이 뜨는 것처럼,
//  뽑기 결과가 "죽은 스탯"이 되는 걸 막기 위해 뽑기 풀 자체에서 제외하는 데 사용)
function isSubstatCapped(key){
  const field = SUBSTAT_CAP_FIELD[key];
  if(!field) return false;
  const cap = statCapStatus();
  return !!cap[field];
}

function weightedPickRarity(weights){
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for(const [key, w] of entries){
    if(r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function equipGachaCost(tierKey){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const n = (state.equipPullCounts && state.equipPullCounts[tierKey]) || 0;
  return Math.round(tier.baseCost * Math.pow(tier.costMult, n));
}

// n회를 연속으로 뽑을 때의 누적 비용 (뽑을 때마다 costMult만큼 비용이 오르는 것을 반영)
function equipMultiPullCost(tierKey, n){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const startN = (state.equipPullCounts && state.equipPullCounts[tierKey]) || 0;
  let total = 0;
  for(let i = 0; i < n; i++){
    total += Math.round(tier.baseCost * Math.pow(tier.costMult, startN + i));
  }
  return total;
}

function isTierUnlocked(tier){
  if(!tier.unlockReq) return true;
  const done = (state.equipPullCounts && state.equipPullCounts[tier.unlockReq.tier]) || 0;
  return done >= tier.unlockReq.count;
}

function tierOddsText(tier){
  return EQUIP_RARITIES
    .filter(r => tier.weights[r.key] > 0)
    .map(r => `${r.name} ${tier.weights[r.key]}%`)
    .join(' · ');
}

function rollEquipment(slot, tierKey){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  const rarityKey = weightedPickRarity(tier.weights);
  const rarity = EQUIP_RARITIES.find(r => r.key === rarityKey);
  const mainRange = slot === 'accessory' ? [rarity.accMainMin, rarity.accMainMax] : [rarity.mainMin, rarity.mainMax];
  const mainValue = Math.round(rand(mainRange[0], mainRange[1]) * 10) / 10;
  let subKey = null, subValue = 0;
  if(rarity.subMax > 0){
    const basePool = slot === 'weapon' ? WEAPON_SUBSTATS : (slot === 'armor' ? ARMOR_SUBSTATS : ACCESSORY_SUBSTATS);
    // 이미 상한(캡)에 도달해 효과가 없는 서브 옵션은 뽑기 풀에서 제외 — 대신 다른 옵션만 뜬다.
    // (혹시라도 전부 걸러지는 극단적 경우를 대비해 그럴 땐 원래 풀을 그대로 사용)
    const filteredPool = basePool.filter(p => !isSubstatCapped(p.key));
    const pool = filteredPool.length > 0 ? filteredPool : basePool;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    subKey = picked.key;
    subValue = Math.round(rand(rarity.subMin, rarity.subMax) * 10) / 10;
  }
  return {
    id: 'eq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    slot,
    rarity: rarityKey,
    mainValue,
    subKey,
    subValue,
    enhance: 0,
    createdAt: Date.now(),
  };
}

function equipSlotName(slot){
  return slot === 'weapon' ? '무기' : (slot === 'armor' ? '방어구' : '장신구');
}

function equipItemLabel(item){
  const enh = item.enhance || 0;
  const enhTag = enh > 0 ? ` <span style="color:#ffb454">+${enh}</span>` : '';
  const effMain = Math.round(item.mainValue * enhanceMultOf(item) * 10) / 10;
  const mainDisplay = enh > 0 ? `${effMain}% (기본 ${item.mainValue}%)` : `${item.mainValue}%`;
  if(item.slot === 'accessory'){
    let text = `공격력/방어력/체력 +${mainDisplay}${enhTag}`;
    if(item.subKey){
      const sub = ACCESSORY_SUBSTATS.find(p => p.key === item.subKey);
      text += ` · ${sub.name} +${item.subValue}${sub.unit}`;
    }
    return text;
  }
  const mainName = item.slot === 'weapon' ? '공격력' : '방어력';
  let text = `${mainName} +${mainDisplay}${enhTag}`;
  if(item.subKey){
    const pool = item.slot === 'weapon' ? WEAPON_SUBSTATS : ARMOR_SUBSTATS;
    const sub = pool.find(p => p.key === item.subKey);
    text += ` · ${sub.name} +${item.subValue}${sub.unit}`;
  }
  return text;
}

function pullEquipment(tierKey, slot){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  if(!isTierUnlocked(tier)) return;
  const cost = equipGachaCost(tierKey);
  if(state.gold < cost) return;
  state.gold -= cost;
  state.equipPullCounts[tierKey] = (state.equipPullCounts[tierKey] || 0) + 1;
  const item = rollEquipment(slot, tierKey);
  state.equipInventory.push(item);
  const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
  const cls = (item.rarity === 'epic' || item.rarity === 'legendary' || item.rarity === 'mythic') ? 'good' : undefined;
  log(`🎰 장비 뽑기: [${rarity.name}] ${equipSlotName(slot)} 획득 — ${equipItemLabel(item)}`, cls);
  renderAll();
}

function pullEquipmentMulti(tierKey, slot, n){
  const tier = GACHA_TIERS.find(t => t.key === tierKey);
  if(!isTierUnlocked(tier)) return;
  const totalCost = equipMultiPullCost(tierKey, n);
  if(state.gold < totalCost) return;
  state.gold -= totalCost;
  const rarityOrder = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const counts = {common:0, rare:0, epic:0, legendary:0, mythic:0};
  let bestRarity = 'common';
  for(let i = 0; i < n; i++){
    state.equipPullCounts[tierKey] = (state.equipPullCounts[tierKey] || 0) + 1;
    const item = rollEquipment(slot, tierKey);
    state.equipInventory.push(item);
    counts[item.rarity]++;
    if(rarityOrder.indexOf(item.rarity) > rarityOrder.indexOf(bestRarity)) bestRarity = item.rarity;
  }
  const summary = EQUIP_RARITIES.filter(r => counts[r.key] > 0).map(r => `${r.name} x${counts[r.key]}`).join(', ');
  const cls = (bestRarity === 'epic' || bestRarity === 'legendary' || bestRarity === 'mythic') ? 'good' : undefined;
  log(`🎰 ${n}연 장비 뽑기 (${equipSlotName(slot)}): ${summary}`, cls);
  renderAll();
}

function equipItem(id){
  const idx = state.equipInventory.findIndex(i => i.id === id);
  if(idx < 0) return;
  const item = state.equipInventory[idx];
  const prev = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  state.equipInventory.splice(idx, 1);
  if(prev) state.equipInventory.push(prev);
  log(`${equipSlotName(item.slot)} 장착: ${equipItemLabel(item)}`, 'good');
  renderAll();
}

function unequipItem(slot){
  const item = state.equipment[slot];
  if(!item) return;
  state.equipment[slot] = null;
  state.equipInventory.push(item);
  renderAll();
}

function sellEquipment(id){
  const idx = state.equipInventory.findIndex(i => i.id === id);
  if(idx < 0) return;
  const item = state.equipInventory[idx];
  const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
  const sellValue = rarity.sellBase;
  state.equipInventory.splice(idx, 1);
  state.gold += sellValue;
  log(`장비 판매: [${rarity.name}] ${equipSlotName(item.slot)} → +${sellValue.toLocaleString()}📦`);
  renderAll();
}

// 미장착 장비를 등급 단위로 한 번에 정리. 전설·신화 등급은 실수로 한꺼번에 팔리지 않도록 제외(개별 판매만 가능).
function sellEquipmentByRarity(rarityKey){
  if(rarityKey === 'legendary' || rarityKey === 'mythic') return;
  const items = state.equipInventory.filter(i => i.rarity === rarityKey);
  if(items.length === 0) return;
  const rarity = EQUIP_RARITIES.find(r => r.key === rarityKey);
  const total = items.length * rarity.sellBase;
  state.equipInventory = state.equipInventory.filter(i => i.rarity !== rarityKey);
  state.gold += total;
  log(`장비 일괄 판매: [${rarity.name}] ${items.length}개 → +${total.toLocaleString()}📦`);
  renderAll();
}

function renderEquipRarityInfo(){
  const box = document.getElementById('equipRarityInfo');
  if(!box) return;
  const rows = EQUIP_RARITIES.map(r => `
    <div class="equip-info-row">
      <span class="equip-info-rarity" style="color:${r.color}">● ${r.name}</span>
      <span class="equip-info-detail">무기/방어구 +${r.mainMin}~${r.mainMax}% · 장신구 +${r.accMainMin}~${r.accMainMax}%${r.subMax > 0 ? ` · 서브옵션 +${r.subMin}~${r.subMax}` : ' · 서브옵션 없음'}</span>
    </div>
  `).join('');
  box.innerHTML = `<div class="equip-info-title">📊 등급별 옵션 범위 (무기=공격력% / 방어구=방어력% / 장신구=공격력·방어력·체력% 동시적용)</div>${rows}`;
}

function renderEquipment(){
  const slotBoxIds = {weapon:'equipWeaponSlot', armor:'equipArmorSlot', accessory:'equipAccessorySlot'};
  const slotLabels = {weapon:'⚔️ 무기', armor:'🛡️ 방어구', accessory:'💍 장신구'};
  ['weapon', 'armor', 'accessory'].forEach(slot => {
    const item = state.equipment[slot];
    const box = document.getElementById(slotBoxIds[slot]);
    if(!box) return;
    const slotLabel = slotLabels[slot];
    if(item){
      const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
      const enh = item.enhance || 0;
      box.className = 'equip-slot filled rarity-' + item.rarity;
      box.innerHTML = `
        <div class="eq-rarity" style="color:${rarity.color}">${rarity.name}${enh > 0 ? ` <span style="color:#ffb454">+${enh}</span>` : ''}</div>
        <div class="eq-slot-name">${slotLabel}</div>
        <div class="eq-desc">${equipItemLabel(item)}</div>
        <button class="eq-unequip-btn" type="button">해제</button>
      `;
      box.querySelector('.eq-unequip-btn').addEventListener('click', () => unequipItem(slot));
    } else {
      box.className = 'equip-slot empty';
      box.innerHTML = `
        <div class="eq-slot-name">${slotLabel}</div>
        <div class="eq-desc" style="color:var(--text-dim);">비어 있음</div>
      `;
    }
  });
  if(typeof renderEnhancePanel === 'function') renderEnhancePanel();

  const tierList = document.getElementById('gachaTierList');
  if(tierList){
    tierList.innerHTML = '';
    GACHA_TIERS.forEach(tier => {
      const row = document.createElement('div');
      row.className = 'shop-item';
      if(!isTierUnlocked(tier)){
        const req = tier.unlockReq;
        const reqTierName = GACHA_TIERS.find(t => t.key === req.tier).name;
        const done = Math.min(req.count, (state.equipPullCounts && state.equipPullCounts[req.tier]) || 0);
        row.classList.add('locked-tier');
        row.innerHTML = `
          <div class="info">
            <div class="name">🔒 ${tier.name}</div>
            <div class="desc">${reqTierName}을(를) ${req.count}회 뽑으면 해금 (진행도 ${done}/${req.count})</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="buy" type="button" disabled>🔒 잠김</button>
          </div>
        `;
        tierList.appendChild(row);
        return;
      }
      const cost = equipPullMultiplier > 1 ? equipMultiPullCost(tier.key, equipPullMultiplier) : equipGachaCost(tier.key);
      const multLabel = equipPullMultiplier > 1 ? ` x${equipPullMultiplier}` : '';
      row.innerHTML = `
        <div class="info">
          <div class="name">${tier.name}</div>
          <div class="desc">${tierOddsText(tier)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="buy" type="button" data-slot="weapon">⚔️${multLabel} ${cost.toLocaleString()}📦</button>
          <button class="buy" type="button" data-slot="armor">🛡️${multLabel} ${cost.toLocaleString()}📦</button>
          <button class="buy" type="button" data-slot="accessory">💍${multLabel} ${cost.toLocaleString()}📦</button>
        </div>
      `;
      tierList.appendChild(row);
      row.querySelectorAll('button').forEach(btn => {
        btn.disabled = state.gold < cost;
        btn.addEventListener('click', () => {
          if(equipPullMultiplier > 1) pullEquipmentMulti(tier.key, btn.dataset.slot, equipPullMultiplier);
          else pullEquipment(tier.key, btn.dataset.slot);
        });
      });
    });
  }

  renderEquipRarityInfo();

  const grid = document.getElementById('equipInventoryGrid');
  const invCountEl = document.getElementById('equipInvCount');
  const invToggleIcon = document.getElementById('equipInvToggleIcon');
  const invActions = document.getElementById('equipInvActions');

  if(invCountEl) invCountEl.textContent = `(${state.equipInventory.length}개)`;
  if(invToggleIcon) invToggleIcon.textContent = equipInvExpanded ? '▲' : '▼';

  if(invActions){
    if(!equipInvExpanded || state.equipInventory.length === 0){
      invActions.style.display = 'none';
      invActions.innerHTML = '';
    } else {
      const counts = {common:0, rare:0, epic:0, legendary:0, mythic:0};
      state.equipInventory.forEach(i => counts[i.rarity]++);
      const sellable = EQUIP_RARITIES.filter(r => r.key !== 'legendary' && r.key !== 'mythic' && counts[r.key] > 0);
      if(sellable.length === 0){
        invActions.style.display = 'none';
        invActions.innerHTML = '';
      } else {
        invActions.style.display = 'flex';
        invActions.innerHTML = sellable.map(r => `<button type="button" data-rarity="${r.key}">[${r.name}] 전체 판매 (${counts[r.key]}개)</button>`).join('');
        invActions.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => sellEquipmentByRarity(btn.dataset.rarity));
        });
      }
    }
  }

  if(grid){
    grid.style.display = equipInvExpanded ? 'grid' : 'none';
    if(equipInvExpanded){
      grid.innerHTML = '';
      if(state.equipInventory.length === 0){
        grid.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:6px 2px;">보유한 미장착 장비가 없습니다.</div>';
      } else {
        const rarityRank = {mythic:4, legendary:3, epic:2, rare:1, common:0};
        const sorted = [...state.equipInventory].sort((a, b) => {
          const rd = rarityRank[b.rarity] - rarityRank[a.rarity];
          if(rd !== 0) return rd;
          if(b.mainValue !== a.mainValue) return b.mainValue - a.mainValue;
          return b.createdAt - a.createdAt;
        });
        const slotIcons = {weapon:'⚔️ 무기', armor:'🛡️ 방어구', accessory:'💍 장신구'};
        sorted.forEach(item => {
          const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
          const card = document.createElement('div');
          card.className = 'relic-card equip-card rarity-' + item.rarity;
          card.innerHTML = `
            <div class="rname"><span style="color:${rarity.color}">[${rarity.name}] ${slotIcons[item.slot]}</span></div>
            <div class="rdesc">${equipItemLabel(item)}</div>
            <div class="eq-card-btns">
              <button class="eq-equip-btn" type="button">장착</button>
              <button class="eq-sell-btn" type="button">판매 (${rarity.sellBase.toLocaleString()}📦)</button>
            </div>
          `;
          grid.appendChild(card);
          card.querySelector('.eq-equip-btn').addEventListener('click', () => equipItem(item.id));
          card.querySelector('.eq-sell-btn').addEventListener('click', () => sellEquipment(item.id));
        });
      }
    }
  }
}

// ===== js/potions.js =====
// ---------- 물약 상점 (일시적 버프) ----------
// 물자획득/경험치획득처럼 전역 상한(GOLD_MULT_CAP 등)이 걸린 스탯은 강화를 다 채운 유저에겐
// 애초에 사도 효과가 없으니 물약 대상에서 제외한다. 대신 상한이 없는 스탯(공격력/방어력/체력/
// 치명타 피해/명중)만 판다 — 뭘 사도 항상 확실하게 체감되는 일시 버프가 되도록.
const POTION_DURATION_MIN = 15;
const POTION_DURATION_MS = POTION_DURATION_MIN * 60 * 1000;
const POTION_COST = 50000000; // 개당 5천만 물자

// ---------- 혈청 팩 (물자 → 혈청 환전, 일일 구매 제한) ----------
// 혈청은 영구 강화(su.*)/전직/스킬 습득에 쓰이는 핵심 재화라, 물자로 무제한 구매 가능하게 두면
// 밸런스가 깨진다. 그래서 값을 비싸게(10억) 잡고 하루 10개(=혈청 1000개)로 상한을 둔다.
const SOUL_PACK_COST = 100000000; // 개당 10억 물자
const SOUL_PACK_AMOUNT = 50;      // 개당 지급 혈청 수
const SOUL_PACK_DAILY_LIMIT = 10;  // 하루 최대 구매 개수

function buySoulPack(){
  if((state.dailySoulPacksBought||0) >= SOUL_PACK_DAILY_LIMIT){
    log(`🧪 혈청 팩은 하루 ${SOUL_PACK_DAILY_LIMIT}개까지만 구매할 수 있습니다. 내일 다시 시도해주세요.`, 'warn');
    return;
  }
  if(state.gold < SOUL_PACK_COST) return;

  state.gold -= SOUL_PACK_COST;
  state.soul += SOUL_PACK_AMOUNT;
  state.dailySoulPacksBought = (state.dailySoulPacksBought||0) + 1;
  log(`🧪 혈청 팩 구매! +${SOUL_PACK_AMOUNT}🧪 (오늘 ${state.dailySoulPacksBought}/${SOUL_PACK_DAILY_LIMIT}회 구매)`, 'good');
  renderAll();
}

function renderSoulPackShop(){
  const el = document.getElementById('soulPackShop');
  if(!el) return;

  const bought = state.dailySoulPacksBought || 0;
  const remaining = Math.max(0, SOUL_PACK_DAILY_LIMIT - bought);
  const soldOut = remaining <= 0;
  const afford = state.gold >= SOUL_PACK_COST;

  el.innerHTML = `
    <div class="shop-item">
      <div class="info">
        <div class="name">🧪 혈청 팩 <span class="potion-active-tag">오늘 ${bought}/${SOUL_PACK_DAILY_LIMIT}</span></div>
        <div class="desc">즉시 🧪 혈청 ${SOUL_PACK_AMOUNT}개 획득 (하루 ${SOUL_PACK_DAILY_LIMIT}개 한정)</div>
      </div>
      <button class="buy" id="buySoulPackBtn" ${(soldOut || !afford) ? 'disabled' : ''}>${soldOut ? '오늘 매진' : SOUL_PACK_COST.toLocaleString() + ' 📦 구매'}</button>
    </div>`;
  document.getElementById('buySoulPackBtn')?.addEventListener('click', buySoulPack);
}

const POTIONS = [
  {key:'atk', name:'맹공의 물약', icon:'⚔️', stat:'atkPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 공격력 +50%`},
  {key:'def', name:'철벽의 물약', icon:'🛡️', stat:'defPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 방어력 +50%`},
  {key:'hp', name:'활력의 물약', icon:'❤️', stat:'hpPct', value:50, unit:'%', desc:`${POTION_DURATION_MIN}분간 최대 체력 +50%`},
  {key:'critDmg', name:'파괴의 물약', icon:'💥', stat:'critDmgAdd', value:40, unit:'%p', desc:`${POTION_DURATION_MIN}분간 치명타 피해 +40%p`},
  {key:'accuracy', name:'집중의 물약', icon:'🎯', stat:'accuracyAdd', value:30, unit:'', desc:`${POTION_DURATION_MIN}분간 명중 +30`},
];

// stats()에서 호출 — 만료 안 된 버프만 합산해서 돌려준다.
function buffBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, critDmgAdd:0, accuracyAdd:0};
  const buffs = state.activeBuffs;
  if(!buffs) return b;
  const now = Date.now();
  for(const key in buffs){
    const buff = buffs[key];
    if(buff && buff.expiresAt > now && Object.prototype.hasOwnProperty.call(b, buff.stat)){
      b[buff.stat] += buff.value;
    }
  }
  return b;
}

// 만료된 버프를 state에서 정리 (렌더할 때마다 가볍게 청소).
function cleanupExpiredBuffs(){
  const buffs = state.activeBuffs;
  if(!buffs) return;
  const now = Date.now();
  Object.keys(buffs).forEach(key=>{
    if(!buffs[key] || buffs[key].expiresAt <= now) delete buffs[key];
  });
}

function buyPotion(key){
  const p = POTIONS.find(x=>x.key===key);
  if(!p) return;
  if(state.gold < POTION_COST) return;

  state.gold -= POTION_COST;
  if(!state.activeBuffs) state.activeBuffs = {};
  // 다시 사면 값이 중첩되는 게 아니라 지속시간만 갱신(리필)된다 — 중첩 구매로 무한정 강해지는 것 방지.
  state.activeBuffs[p.key] = {stat: p.stat, value: p.value, expiresAt: Date.now() + POTION_DURATION_MS};

  log(`🧪 ${p.name}을(를) 마셨습니다! ${p.desc}`, 'good');
  renderAll();
}

function formatBuffRemaining(ms){
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

function renderPotionShop(){
  const el = document.getElementById('potionShopList');
  if(!el) return;
  cleanupExpiredBuffs();

  const now = Date.now();
  let html = '';
  POTIONS.forEach(p=>{
    const active = state.activeBuffs && state.activeBuffs[p.key];
    const remainMs = active ? (active.expiresAt - now) : 0;
    const afford = state.gold >= POTION_COST;

    html += `
      <div class="shop-item">
        <div class="info">
          <div class="name">${p.icon} ${p.name}${active ? ` <span class="potion-active-tag">활성 · ${formatBuffRemaining(remainMs)}</span>` : ''}</div>
          <div class="desc">${p.desc}</div>
        </div>
        <button class="buy" data-key="${p.key}" ${afford ? '' : 'disabled'}>${POTION_COST.toLocaleString()} 📦 ${active ? '갱신' : '구매'}</button>
      </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('button[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>buyPotion(btn.dataset.key));
  });
}

// ===== js/enhance.js =====
// ---------- 장비 강화 (Enhance) ----------
// 라스트존판 리니지식 강화. 몬스터 처치 시 드랍되는 🔩 강화석을 소모해 "장착 중인" 무기/방어구/
// 장신구의 메인 옵션(공격력%/방어력%, 장신구는 공+방+체 동시)을 끌어올린다.
// 강화 단계가 오를수록 성공 확률이 낮아지고, 위험도가 3단계로 나뉜다.
//   - +1 ~ +4 (safe)      : 실패해도 그냥 실패 (단계 유지)
//   - +5 ~ +7 (downgrade) : 실패 시 강화 단계가 1 하락
//   - +8 ~ +15 (destroy)  : 실패 시 destroyChance 확률로 장비 자체가 파괴(소멸), 아니면 1 하락
// 서브 옵션(치명타/속도/체력/물자/경험치)은 강화의 영향을 받지 않는다 — 순수하게 메인 옵션만 강화됨.

const ENHANCE_MAX_LEVEL = 15;
const ENHANCE_BONUS_PER_LEVEL = 8; // 강화 1단계당 메인 옵션 값에 +8% (곱연산)

const ENHANCE_LEVELS = [
  {level:1,  rate:95, risk:'safe'},
  {level:2,  rate:90, risk:'safe'},
  {level:3,  rate:83, risk:'safe'},
  {level:4,  rate:75, risk:'safe'},
  {level:5,  rate:65, risk:'downgrade'},
  {level:6,  rate:55, risk:'downgrade'},
  {level:7,  rate:45, risk:'downgrade'},
  {level:8,  rate:35, risk:'destroy', destroyChance:15},
  {level:9,  rate:28, risk:'destroy', destroyChance:20},
  {level:10, rate:22, risk:'destroy', destroyChance:25},
  {level:11, rate:17, risk:'destroy', destroyChance:30},
  {level:12, rate:13, risk:'destroy', destroyChance:35},
  {level:13, rate:9,  risk:'destroy', destroyChance:40},
  {level:14, rate:6,  risk:'destroy', destroyChance:45},
  {level:15, rate:4,  risk:'destroy', destroyChance:50},
];

function enhanceLevelInfo(targetLevel){
  return ENHANCE_LEVELS.find(l => l.level === targetLevel);
}

// 목표 단계까지 강화 시도 1회에 드는 강화석 비용.
function enhanceStoneCost(targetLevel){
  return Math.round(5 * Math.pow(1.42, targetLevel - 1));
}

// 아이템의 메인 옵션에 곱해지는 강화 배율. state.js의 equipTotals()가 이 함수를 호출한다.
function enhanceMultiplier(item){
  const lvl = (item && item.enhance) || 0;
  return 1 + lvl * ENHANCE_BONUS_PER_LEVEL / 100;
}

const ENHANCE_SLOT_LABEL = {weapon:'⚔️ 무기', armor:'🛡️ 방어구', accessory:'💍 장신구'};

function attemptEnhance(slot){
  const item = state.equipment && state.equipment[slot];
  if(!item){
    flashMessageSafe('먼저 해당 부위에 장비를 장착하세요.');
    return;
  }
  const current = item.enhance || 0;
  if(current >= ENHANCE_MAX_LEVEL){
    flashMessageSafe('이미 최대 강화 단계입니다.');
    return;
  }
  const target = current + 1;
  const info = enhanceLevelInfo(target);
  const cost = enhanceStoneCost(target);
  if((state.enhanceStone||0) < cost){
    flashMessageSafe(`강화석이 부족합니다. (필요 🔩${cost} / 보유 🔩${Math.floor(state.enhanceStone||0)})`);
    return;
  }

  if(info.risk === 'destroy'){
    const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
    const ok = confirm(
      `${ENHANCE_SLOT_LABEL[slot]} [${rarity.name}] +${current} → +${target} 강화를 시도합니다.\n` +
      `성공 확률: ${info.rate}%\n` +
      `⚠️ 실패 시 ${info.destroyChance}% 확률로 장비가 완전히 파괴됩니다 (파괴되지 않으면 +${Math.max(0, current-1)}로 하락).\n\n` +
      `강화석 🔩${cost}을(를) 소모하고 진행하시겠습니까?`
    );
    if(!ok) return;
  }

  state.enhanceStone -= cost;
  const success = Math.random() * 100 < info.rate;

  if(success){
    item.enhance = target;
    log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 성공! +${current} → +${target}`, 'good');
    showEnhanceResult(slot, 'success', `✅ 강화 성공! +${current} → +${target}`);
  } else if(info.risk === 'safe'){
    log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패... (+${current} 유지)`);
    showEnhanceResult(slot, 'fail', `❌ 강화 실패... (+${current} 유지)`);
  } else if(info.risk === 'downgrade'){
    item.enhance = Math.max(0, current - 1);
    log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 단계가 하락했습니다. +${current} → +${item.enhance}`, 'bad');
    showEnhanceResult(slot, 'fail', `❌ 강화 실패! 단계 하락 +${current} → +${item.enhance}`);
  } else { // destroy risk
    const destroyed = Math.random() * 100 < info.destroyChance;
    if(destroyed){
      state.equipment[slot] = null;
      state.enhanceDestroyedCount = (state.enhanceDestroyedCount||0) + 1;
      log(`💥 ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 장비가 파괴되어 사라졌습니다...`, 'bad');
      showEnhanceResult(slot, 'destroy', `💥 장비 파괴! ${ENHANCE_SLOT_LABEL[slot]}가 사라졌습니다`);
    } else {
      item.enhance = Math.max(0, current - 1);
      log(`⚒️ ${ENHANCE_SLOT_LABEL[slot]} 강화 실패! 아슬아슬하게 파괴는 면했지만 단계가 하락했습니다. +${current} → +${item.enhance}`, 'bad');
      showEnhanceResult(slot, 'fail', `❌ 강화 실패! 단계 하락 +${current} → +${item.enhance} (파괴는 면함)`);
    }
  }

  renderAll();
}

// flashMessage가 없는 빌드에서도 안전하게 안내 문구를 보여주기 위한 폴백 (log만 사용).
function flashMessageSafe(text){
  if(typeof flashMessage === 'function') flashMessage(text);
  else log(text);
}

// 강화 성공/실패가 눈에 잘 띄도록 패널 상단에 배너를 띄우고, 해당 부위 카드에 잠깐
// 테두리 플래시 애니메이션을 준다. lastEnhanceFlash는 renderEnhancePanel이 카드를
// 새로 그릴 때 한 번만 소비되고 지워지므로, 1초 주기 자동 리렌더에서는 다시 반짝이지 않는다.
let enhanceResultTimer = null;
let lastEnhanceFlash = null;
function showEnhanceResult(slot, type, message){
  lastEnhanceFlash = {slot, type};
  const el = document.getElementById('enhanceResultBanner');
  if(!el) return;
  el.textContent = message;
  el.className = 'enhance-result-banner show ' + type;
  // 같은 결과가 연속으로 떠도 애니메이션이 다시 재생되도록 강제 리플로우.
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  if(enhanceResultTimer) clearTimeout(enhanceResultTimer);
  enhanceResultTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2800);
}

function renderEnhancePanel(){
  const grid = document.getElementById('enhanceGrid');
  const stoneEl = document.getElementById('stoneDisplay2');
  if(stoneEl) stoneEl.textContent = Math.floor(state.enhanceStone||0).toLocaleString();
  if(!grid) return;

  const slots = ['weapon', 'armor', 'accessory'];
  grid.innerHTML = '';
  const flash = lastEnhanceFlash;
  lastEnhanceFlash = null; // 한 번만 소비 — 다음 자동 리렌더에서는 다시 반짝이지 않도록.
  slots.forEach(slot => {
    const item = state.equipment && state.equipment[slot];
    const card = document.createElement('div');
    card.className = 'enhance-card';
    if(flash && flash.slot === slot){
      card.classList.add(flash.type === 'success' ? 'flash-success' : 'flash-fail');
    }

    if(!item){
      card.innerHTML = `
        <div class="enhance-card-title">${ENHANCE_SLOT_LABEL[slot]}</div>
        <div class="enhance-empty">장착된 장비가 없습니다.</div>
      `;
      grid.appendChild(card);
      return;
    }

    const rarity = EQUIP_RARITIES.find(r => r.key === item.rarity);
    const current = item.enhance || 0;
    const maxed = current >= ENHANCE_MAX_LEVEL;
    card.classList.add('rarity-' + item.rarity);

    let body;
    if(maxed){
      body = `<div class="enhance-maxed">🏆 최대 강화 단계 (+${ENHANCE_MAX_LEVEL}) 달성!</div>`;
    } else {
      const target = current + 1;
      const info = enhanceLevelInfo(target);
      const cost = enhanceStoneCost(target);
      const afford = (state.enhanceStone||0) >= cost;
      let riskLabel;
      if(info.risk === 'safe') riskLabel = `<span class="enhance-risk safe">안전 (실패해도 단계 유지)</span>`;
      else if(info.risk === 'downgrade') riskLabel = `<span class="enhance-risk warn">실패 시 강화 단계 -1</span>`;
      else riskLabel = `<span class="enhance-risk danger">실패 시 ${info.destroyChance}% 확률로 파괴!</span>`;

      body = `
        <div class="enhance-next">+${current} → +${target} 시도</div>
        <div class="enhance-rate">성공 확률 <b>${info.rate}%</b></div>
        ${riskLabel}
        <button class="enhance-btn" type="button" data-slot="${slot}" ${afford ? '' : 'disabled'}>
          🔩 ${cost.toLocaleString()} 소모하고 강화
        </button>
      `;
    }

    card.innerHTML = `
      <div class="enhance-card-title">${ENHANCE_SLOT_LABEL[slot]} <span style="color:${rarity.color}">[${rarity.name}]${current > 0 ? ` +${current}` : ''}</span></div>
      <div class="enhance-desc">${equipItemLabel(item)}</div>
      ${body}
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.enhance-btn[data-slot]').forEach(btn => {
    btn.addEventListener('click', () => attemptEnhance(btn.dataset.slot));
  });
}

// ===== js/raid.js =====
// ---------- Raid (1인 레이드) ----------
// 해금 조건: 무한의 탑 100층 클리어(state.towerHighestFloor >= 100)
// 티켓제: 최대 3개, 1시간마다 1개 충전 (오프라인 시간도 반영됨)
// 보상: 클리어 시 파편 확정 지급 + 낮은 확률로 레이드 장비 획득, 천장 시스템으로 일정 횟수 내 확정 지급

const RAID_TICKET_MAX = 3;
const RAID_TICKET_INTERVAL_MS = 60 * 60 * 1000; // 1시간마다 티켓 1개 충전
const RAID_PITY_CAP = 10; // 이 횟수 안에 장비를 못 얻으면 다음 클리어 때 확정 지급
const RAID_GEAR_DROP_CHANCE = 0.12; // 클리어당 장비 획득 확률 12%

const RAID_BOSS_META = {name:'완전변이체 디스토션', emoji:'☣️'};

// 무한의 탑 100층을 클리어한 유저도 다소 힘겨울 정도로 맞춘 고정 스탯.
// 실제 플레이 데이터로 검증 후 이 세 값만 조절하면 난이도를 바꿀 수 있음.
function raidBossHp(){ return 20500; }
function raidBossAtk(){ return 680; }
function raidBossDef(){ return 85; }

function raidUnlocked(){
  return state.towerHighestFloor >= 100;
}

function refreshRaidTickets(){
  if(state.raidTicket >= RAID_TICKET_MAX){
    state.raidTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.raidTicketLastRefill;
  const gained = Math.floor(elapsed / RAID_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(RAID_TICKET_MAX, state.raidTicket + gained);
  const actuallyGained = newTicket - state.raidTicket;
  state.raidTicket = newTicket;
  state.raidTicketLastRefill += actuallyGained * RAID_TICKET_INTERVAL_MS;
  if(state.raidTicket >= RAID_TICKET_MAX){
    state.raidTicketLastRefill = now;
  }
}

let raidPlayerTickHandle = null;
let raidMonsterTickHandle = null;

function enterRaid(){
  if(!raidUnlocked()){
    alert('무한의 탑 100층을 클리어해야 레이드에 입장할 수 있습니다.');
    return;
  }
  if(state.raidActive) return;
  if(anySubActivityActive('raidActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 레이드에 입장할 수 없습니다.');
    return;
  }
  refreshRaidTickets();
  if(state.raidTicket <= 0){
    alert('레이드 티켓이 부족합니다. (1시간마다 1개씩 충전됩니다)');
    renderRaidPanel();
    return;
  }
  if(!confirm('레이드에 입장하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 다음 티켓으로 재도전해야 합니다)')) return;

  state.raidTicket--;
  state.raidActive = true;
  state.raidBossMaxHp = raidBossHp();
  state.raidBossHp = state.raidBossMaxHp;
  const s = stats();
  state.raidPlayerHp = s.maxHp;

  // 레이드 동안 폐허/무한의 탑 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`⚔️ [레이드] ${RAID_BOSS_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleRaidPlayerTick();
  scheduleRaidMonsterTick();
}

function scheduleRaidPlayerTick(){
  const s = stats();
  clearTimeout(raidPlayerTickHandle);
  raidPlayerTickHandle = setTimeout(raidPlayerAttackTick, s.tickMs);
}

function scheduleRaidMonsterTick(){
  clearTimeout(raidMonsterTickHandle);
  raidMonsterTickHandle = setTimeout(raidMonsterAttackTick, 1000);
}

function raidPlayerAttackTick(){
  if(!state.raidActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - raidBossDef()));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.raidBossHp -= dmg;

  if(state.raidBossHp <= 0){
    resolveRaidVictory();
    return;
  }
  renderCombatFrame();
  renderRaidPanel();
  scheduleRaidPlayerTick();
}

function raidMonsterAttackTick(){
  if(!state.raidActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, raidBossAtk() - s.def));
  state.raidPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.raidPlayerHp <= 0){
    resolveRaidDefeat();
    return;
  }
  renderCombatFrame();
  renderRaidPanel();
  scheduleRaidMonsterTick();
}

function resolveRaidVictory(){
  state.raidClearCount++;
  const fragGain = 15 + Math.floor(Math.random()*6); // 15~20
  state.fragments += fragGain;
  state.raidPity++;

  let dropMsg = '';
  if(Math.random() < RAID_GEAR_DROP_CHANCE || state.raidPity >= RAID_PITY_CAP){
    const picked = RAID_GEAR[Math.floor(Math.random()*RAID_GEAR.length)];
    state.raidGear[picked.key] = (state.raidGear[picked.key]||0) + 1;
    state.raidPity = 0;
    dropMsg = ` ${picked.icon} ${picked.name} 획득! (Lv.${state.raidGear[picked.key]})`;
  }

  log(`🏆 [레이드] ${RAID_BOSS_META.name} 처치! ◈ 파편 +${fragGain}${dropMsg}`, 'good');
  endRaid();
}

function resolveRaidDefeat(){
  log(`💀 [레이드] ${RAID_BOSS_META.name}에게 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endRaid();
}

function endRaid(){
  state.raidActive = false;
  clearTimeout(raidPlayerTickHandle);
  clearTimeout(raidMonsterTickHandle);
  // 메인 전투 루프 재개
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('raidEnterBtn').addEventListener('click', enterRaid);

function formatMs(ms){
  const totalSec = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(totalSec/60);
  const sec = totalSec%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function renderRaidPanel(){
  refreshRaidTickets();
  const unlocked = raidUnlocked();
  const lockedBox = document.getElementById('raidLockedBox');
  const unlockedBox = document.getElementById('raidUnlockedBox');
  if(!unlocked){
    lockedBox.style.display = 'block';
    unlockedBox.style.display = 'none';
    document.getElementById('raidLockProgress').textContent = state.towerHighestFloor;
    return;
  }
  lockedBox.style.display = 'none';
  unlockedBox.style.display = 'block';

  document.getElementById('raidTicketText').textContent = `${state.raidTicket}/${RAID_TICKET_MAX}`;
  const timerEl = document.getElementById('raidTicketTimer');
  if(state.raidTicket >= RAID_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = RAID_TICKET_INTERVAL_MS - (Date.now() - state.raidTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  document.getElementById('raidPityText').textContent = Math.max(0, RAID_PITY_CAP - state.raidPity);

  const enterBtn = document.getElementById('raidEnterBtn');
  enterBtn.disabled = state.raidActive || state.raidTicket <= 0;
  enterBtn.textContent = state.raidActive ? '전투 진행 중...' : '레이드 입장';

  const battleBox = document.getElementById('raidBattleBox');
  if(state.raidActive){
    battleBox.style.display = 'block';
    document.getElementById('raidBossEmoji').textContent = RAID_BOSS_META.emoji;
    document.getElementById('raidBossName').textContent = RAID_BOSS_META.name;
    const bPct = Math.max(0, (state.raidBossHp/state.raidBossMaxHp*100));
    document.getElementById('raidBossHpBar').style.width = bPct+'%';
    document.getElementById('raidBossHpText').textContent = `${Math.max(0,Math.ceil(state.raidBossHp))} / ${state.raidBossMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.raidPlayerHp/s.maxHp*100));
    document.getElementById('raidPlayerHpBar').style.width = pPct+'%';
    document.getElementById('raidPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.raidPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }

  const grid = document.getElementById('raidGearGrid');
  grid.innerHTML = '';
  RAID_GEAR.forEach(g=>{
    const lvl = state.raidGear[g.key] || 0;
    const owned = lvl > 0;
    const value = Math.round(lvl * g.perLevel * 10) / 10;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'');
    card.innerHTML = `
      <div class="rname"><span>${g.icon} ${g.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${g.descFn(owned ? value : g.perLevel)}${owned?'':' (미보유)'}</div>
    `;
    grid.appendChild(card);
  });
}

// 티켓 충전 카운트다운 표시를 위해 1초마다 갱신 (해금 전에는 스킵)
setInterval(()=>{
  if(!raidUnlocked()) return;
  refreshRaidTickets();
  renderRaidPanel();
}, 1000);

// ===== js/golden.js =====
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

// ===== js/golddungeon.js =====
// ---------- Gold Dungeon (물자 구역) ----------
// 티켓제: 최대 3개, 15분마다 1개 충전 (오프라인 시간도 반영됨 - 확인 시점에 경과시간으로 계산)
// 층수: 우선 1~10층까지 (추후 업데이트로 확장 예정)
// 난이도: 1층 = 무한의 탑 10층 정도, 이후 층마다 약 1.33배씩 강해짐
// 보상: 층수별 확정 물자 지급. 1층 5,000물자부터 시작해 층마다 1.5배씩 증가

const GOLD_DUNGEON_TICKET_MAX = 3;
const GOLD_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const GOLD_DUNGEON_MAX_FLOOR = 10;

const GOLD_DUNGEON_META = {name:'물자 창고 경비병', emoji:'📦'};

// 층별 고정 스탯. 1층은 무한의 탑 10층(보스) 수준으로 맞추고, 10층은 1인 레이드에 근접하는 난이도.
// 이 네 함수의 배율(1.33, 1.5)만 조절하면 구역 전체 난이도/보상 곡선을 바꿀 수 있음.
function gdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function gdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function gdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
function gdGoldFor(floor){ return Math.round(6000 * Math.pow(1.55, floor-1)); }

function refreshGoldDungeonTickets(){
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    state.gdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.gdTicketLastRefill;
  const gained = Math.floor(elapsed / GOLD_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(GOLD_DUNGEON_TICKET_MAX, state.gdTicket + gained);
  const actuallyGained = newTicket - state.gdTicket;
  state.gdTicket = newTicket;
  state.gdTicketLastRefill += actuallyGained * GOLD_DUNGEON_TICKET_INTERVAL_MS;
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    state.gdTicketLastRefill = now;
  }
}

let gdPlayerTickHandle = null;
let gdMonsterTickHandle = null;

function enterGoldDungeon(){
  if(state.gdActive) return;
  if(anySubActivityActive('gdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 물자 구역에 입장할 수 없습니다.');
    return;
  }
  refreshGoldDungeonTickets();
  if(state.gdTicket <= 0){
    alert('물자 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderGoldDungeonPanel();
    return;
  }
  if(!confirm(`물자 구역 ${state.gdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.gdTicket--;
  state.gdActive = true;
  state.gdMonsterMaxHp = gdHpFor(state.gdFloor);
  state.gdMonsterHp = state.gdMonsterMaxHp;
  const s = stats();
  state.gdPlayerHp = s.maxHp;

  // 물자 구역 동안 폐허/무한의 탑 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`📦 [물자 구역] ${state.gdFloor}층 ${GOLD_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleGdPlayerTick();
  scheduleGdMonsterTick();
}

function scheduleGdPlayerTick(){
  const s = stats();
  clearTimeout(gdPlayerTickHandle);
  gdPlayerTickHandle = setTimeout(gdPlayerAttackTick, s.tickMs);
}

function scheduleGdMonsterTick(){
  clearTimeout(gdMonsterTickHandle);
  gdMonsterTickHandle = setTimeout(gdMonsterAttackTick, 1000);
}

function gdPlayerAttackTick(){
  if(!state.gdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - gdDefFor(state.gdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.gdMonsterHp -= dmg;

  if(state.gdMonsterHp <= 0){
    resolveGoldDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderGoldDungeonPanel();
  scheduleGdPlayerTick();
}

function gdMonsterAttackTick(){
  if(!state.gdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, gdAtkFor(state.gdFloor) - s.def));
  state.gdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.gdPlayerHp <= 0){
    resolveGoldDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderGoldDungeonPanel();
  scheduleGdMonsterTick();
}

function resolveGoldDungeonVictory(){
  const goldGain = gdGoldFor(state.gdFloor);
  state.gold += goldGain;
  state.lifetimeGoldEarned = (state.lifetimeGoldEarned||0) + goldGain;
  log(`🏆 [물자 구역] ${state.gdFloor}층 클리어! +${goldGain.toLocaleString()}📦`, 'good');

  if(state.gdFloor >= GOLD_DUNGEON_MAX_FLOOR){
    if(!state.gdCleared){
      state.gdCleared = true;
      log(`📦 물자 구역을 모두 정복했습니다! 이제부터는 ${GOLD_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  } else {
    state.gdFloor++;
  }
  endGoldDungeon();
}

function resolveGoldDungeonDefeat(){
  log(`💀 [물자 구역] ${state.gdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endGoldDungeon();
}

function endGoldDungeon(){
  state.gdActive = false;
  clearTimeout(gdPlayerTickHandle);
  clearTimeout(gdMonsterTickHandle);
  // 메인 전투 루프 재개
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('gdEnterBtn').addEventListener('click', enterGoldDungeon);

function renderGoldDungeonPanel(){
  refreshGoldDungeonTickets();

  document.getElementById('gdFloorText').textContent = state.gdCleared
    ? `${GOLD_DUNGEON_MAX_FLOOR}/${GOLD_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.gdFloor}/${GOLD_DUNGEON_MAX_FLOOR}`;
  document.getElementById('gdNextReward').textContent = gdGoldFor(state.gdFloor).toLocaleString();

  document.getElementById('gdTicketText').textContent = `${state.gdTicket}/${GOLD_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('gdTicketTimer');
  if(state.gdTicket >= GOLD_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = GOLD_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.gdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('gdEnterBtn');
  enterBtn.disabled = state.gdActive || state.gdTicket <= 0;
  enterBtn.textContent = state.gdActive ? '전투 진행 중...' : `${state.gdFloor}층 도전`;

  const battleBox = document.getElementById('gdBattleBox');
  if(state.gdActive){
    battleBox.style.display = 'block';
    document.getElementById('gdMonsterEmoji').textContent = GOLD_DUNGEON_META.emoji;
    document.getElementById('gdMonsterName').textContent = `${state.gdFloor}층 ${GOLD_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.gdMonsterHp/state.gdMonsterMaxHp*100));
    document.getElementById('gdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('gdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.gdMonsterHp))} / ${state.gdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.gdPlayerHp/s.maxHp*100));
    document.getElementById('gdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('gdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.gdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

// 티켓 충전 카운트다운 표시를 위해 1초마다 갱신
setInterval(()=>{
  refreshGoldDungeonTickets();
  renderGoldDungeonPanel();
}, 1000);

// ===== js/relicdungeon.js =====
// ---------- Relic Dungeon (유산 구역) ----------
// 물자 구역과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 물자 대신 유산 파편입니다.
// 티켓제: 최대 3개, 15분마다 1개 충전
// 층수: 우선 1~10층까지 (추후 업데이트로 확장 예정)
// 난이도: 물자 구역과 동일한 곡선 (1층 = 무한의 탑 10층 정도, 10층 = 1인 레이드에 근접)

const RELIC_DUNGEON_TICKET_MAX = 3;
const RELIC_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const RELIC_DUNGEON_MAX_FLOOR = 10;

const RELIC_DUNGEON_META = {name:'유산 수호자', emoji:'🗿'};

// 층별 고정 스탯. 물자 구역과 동일한 전투 난이도 곡선을 사용.
function rdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function rdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function rdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
// 보상은 유산 파편. 1층 5개부터 시작해 층마다 1.4배씩 증가 (10층 클리어 시 약 103개)
function rdFragFor(floor){ return Math.round(6 * Math.pow(1.45, floor-1)); }

function refreshRelicDungeonTickets(){
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    state.rdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.rdTicketLastRefill;
  const gained = Math.floor(elapsed / RELIC_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(RELIC_DUNGEON_TICKET_MAX, state.rdTicket + gained);
  const actuallyGained = newTicket - state.rdTicket;
  state.rdTicket = newTicket;
  state.rdTicketLastRefill += actuallyGained * RELIC_DUNGEON_TICKET_INTERVAL_MS;
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    state.rdTicketLastRefill = now;
  }
}

let rdPlayerTickHandle = null;
let rdMonsterTickHandle = null;

function enterRelicDungeon(){
  if(state.rdActive) return;
  if(anySubActivityActive('rdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 유산 구역에 입장할 수 없습니다.');
    return;
  }
  refreshRelicDungeonTickets();
  if(state.rdTicket <= 0){
    alert('유산 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderRelicDungeonPanel();
    return;
  }
  if(!confirm(`유산 구역 ${state.rdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.rdTicket--;
  state.rdActive = true;
  state.rdMonsterMaxHp = rdHpFor(state.rdFloor);
  state.rdMonsterHp = state.rdMonsterMaxHp;
  const s = stats();
  state.rdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🗿 [유산 구역] ${state.rdFloor}층 ${RELIC_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleRdPlayerTick();
  scheduleRdMonsterTick();
}

function scheduleRdPlayerTick(){
  const s = stats();
  clearTimeout(rdPlayerTickHandle);
  rdPlayerTickHandle = setTimeout(rdPlayerAttackTick, s.tickMs);
}

function scheduleRdMonsterTick(){
  clearTimeout(rdMonsterTickHandle);
  rdMonsterTickHandle = setTimeout(rdMonsterAttackTick, 1000);
}

function rdPlayerAttackTick(){
  if(!state.rdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - rdDefFor(state.rdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.rdMonsterHp -= dmg;

  if(state.rdMonsterHp <= 0){
    resolveRelicDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderRelicDungeonPanel();
  scheduleRdPlayerTick();
}

function rdMonsterAttackTick(){
  if(!state.rdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, rdAtkFor(state.rdFloor) - s.def));
  state.rdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.rdPlayerHp <= 0){
    resolveRelicDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderRelicDungeonPanel();
  scheduleRdMonsterTick();
}

function resolveRelicDungeonVictory(){
  const fragGain = rdFragFor(state.rdFloor);
  state.fragments = (state.fragments||0) + fragGain;
  log(`🏆 [유산 구역] ${state.rdFloor}층 클리어! +${fragGain.toLocaleString()}◈`, 'good');

  if(state.rdFloor >= RELIC_DUNGEON_MAX_FLOOR){
    if(!state.rdCleared){
      state.rdCleared = true;
      log(`🗿 유산 구역을 모두 정복했습니다! 이제부터는 ${RELIC_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  } else {
    state.rdFloor++;
  }
  endRelicDungeon();
}

function resolveRelicDungeonDefeat(){
  log(`💀 [유산 구역] ${state.rdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endRelicDungeon();
}

function endRelicDungeon(){
  state.rdActive = false;
  clearTimeout(rdPlayerTickHandle);
  clearTimeout(rdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('rdEnterBtn').addEventListener('click', enterRelicDungeon);

function renderRelicDungeonPanel(){
  refreshRelicDungeonTickets();

  document.getElementById('rdFloorText').textContent = state.rdCleared
    ? `${RELIC_DUNGEON_MAX_FLOOR}/${RELIC_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.rdFloor}/${RELIC_DUNGEON_MAX_FLOOR}`;
  document.getElementById('rdNextReward').textContent = rdFragFor(state.rdFloor).toLocaleString();

  document.getElementById('rdTicketText').textContent = `${state.rdTicket}/${RELIC_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('rdTicketTimer');
  if(state.rdTicket >= RELIC_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = RELIC_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.rdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('rdEnterBtn');
  enterBtn.disabled = state.rdActive || state.rdTicket <= 0;
  enterBtn.textContent = state.rdActive ? '전투 진행 중...' : `${state.rdFloor}층 도전`;

  const battleBox = document.getElementById('rdBattleBox');
  if(state.rdActive){
    battleBox.style.display = 'block';
    document.getElementById('rdMonsterEmoji').textContent = RELIC_DUNGEON_META.emoji;
    document.getElementById('rdMonsterName').textContent = `${state.rdFloor}층 ${RELIC_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.rdMonsterHp/state.rdMonsterMaxHp*100));
    document.getElementById('rdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('rdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.rdMonsterHp))} / ${state.rdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.rdPlayerHp/s.maxHp*100));
    document.getElementById('rdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('rdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.rdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshRelicDungeonTickets();
  renderRelicDungeonPanel();
}, 1000);

// ===== js/forgedungeon.js =====
// ---------- Forge Dungeon (단조 구역) ----------
// 물자/유산 구역과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 🔩 강화석입니다.
// 강화석은 지금까지 일반 전투 드랍(확률제)이 유일한 공급원이었는데, 장비 강화 시스템의
// 비용이 강화 단계가 오를수록 지수적으로 뛰기 때문에(enhance.js 참고) 확정적으로 강화석을
// 모을 수 있는 루트가 필요해서 신설되었다. 난이도 곡선은 물자/유산 구역과 동일하게 맞춘다.

const FORGE_DUNGEON_TICKET_MAX = 3;
const FORGE_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const FORGE_DUNGEON_MAX_FLOOR = 10;

const FORGE_DUNGEON_META = {name:'단조로의 파수꾼', emoji:'🔥'};

function fdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function fdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function fdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
// 1층 3개부터 시작해 층마다 1.35배씩 증가 (10층 클리어 시 약 51개)
function fdStoneFor(floor){ return Math.round(4 * Math.pow(1.4, floor-1)); }

function refreshForgeDungeonTickets(){
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    state.fdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.fdTicketLastRefill;
  const gained = Math.floor(elapsed / FORGE_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(FORGE_DUNGEON_TICKET_MAX, state.fdTicket + gained);
  const actuallyGained = newTicket - state.fdTicket;
  state.fdTicket = newTicket;
  state.fdTicketLastRefill += actuallyGained * FORGE_DUNGEON_TICKET_INTERVAL_MS;
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    state.fdTicketLastRefill = now;
  }
}

let fdPlayerTickHandle = null;
let fdMonsterTickHandle = null;

function enterForgeDungeon(){
  if(state.fdActive) return;
  if(anySubActivityActive('fdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 단조 구역에 입장할 수 없습니다.');
    return;
  }
  refreshForgeDungeonTickets();
  if(state.fdTicket <= 0){
    alert('단조 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderForgeDungeonPanel();
    return;
  }
  if(!confirm(`단조 구역 ${state.fdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.fdTicket--;
  state.fdActive = true;
  state.fdMonsterMaxHp = fdHpFor(state.fdFloor);
  state.fdMonsterHp = state.fdMonsterMaxHp;
  const s = stats();
  state.fdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🔥 [단조 구역] ${state.fdFloor}층 ${FORGE_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleFdPlayerTick();
  scheduleFdMonsterTick();
}

function scheduleFdPlayerTick(){
  const s = stats();
  clearTimeout(fdPlayerTickHandle);
  fdPlayerTickHandle = setTimeout(fdPlayerAttackTick, s.tickMs);
}

function scheduleFdMonsterTick(){
  clearTimeout(fdMonsterTickHandle);
  fdMonsterTickHandle = setTimeout(fdMonsterAttackTick, 1000);
}

function fdPlayerAttackTick(){
  if(!state.fdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - fdDefFor(state.fdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.fdMonsterHp -= dmg;

  if(state.fdMonsterHp <= 0){
    resolveForgeDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderForgeDungeonPanel();
  scheduleFdPlayerTick();
}

function fdMonsterAttackTick(){
  if(!state.fdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, fdAtkFor(state.fdFloor) - s.def));
  state.fdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.fdPlayerHp <= 0){
    resolveForgeDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderForgeDungeonPanel();
  scheduleFdMonsterTick();
}

function resolveForgeDungeonVictory(){
  const stoneGain = fdStoneFor(state.fdFloor);
  state.enhanceStone = (state.enhanceStone||0) + stoneGain;
  state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned||0) + stoneGain;
  log(`🏆 [단조 구역] ${state.fdFloor}층 클리어! +${stoneGain.toLocaleString()}🔩`, 'good');

  if(state.fdFloor >= FORGE_DUNGEON_MAX_FLOOR){
    if(!state.fdCleared){
      state.fdCleared = true;
      log(`🔥 단조 구역을 모두 정복했습니다! 이제부터는 ${FORGE_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  } else {
    state.fdFloor++;
  }
  endForgeDungeon();
}

function resolveForgeDungeonDefeat(){
  log(`💀 [단조 구역] ${state.fdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endForgeDungeon();
}

function endForgeDungeon(){
  state.fdActive = false;
  clearTimeout(fdPlayerTickHandle);
  clearTimeout(fdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('fdEnterBtn')?.addEventListener('click', enterForgeDungeon);

function renderForgeDungeonPanel(){
  refreshForgeDungeonTickets();

  const floorEl = document.getElementById('fdFloorText');
  if(!floorEl) return;
  floorEl.textContent = state.fdCleared
    ? `${FORGE_DUNGEON_MAX_FLOOR}/${FORGE_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.fdFloor}/${FORGE_DUNGEON_MAX_FLOOR}`;
  document.getElementById('fdNextReward').textContent = fdStoneFor(state.fdFloor).toLocaleString();

  document.getElementById('fdTicketText').textContent = `${state.fdTicket}/${FORGE_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('fdTicketTimer');
  if(state.fdTicket >= FORGE_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = FORGE_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.fdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('fdEnterBtn');
  enterBtn.disabled = state.fdActive || state.fdTicket <= 0;
  enterBtn.textContent = state.fdActive ? '전투 진행 중...' : `${state.fdFloor}층 도전`;

  const battleBox = document.getElementById('fdBattleBox');
  if(state.fdActive){
    battleBox.style.display = 'block';
    document.getElementById('fdMonsterEmoji').textContent = FORGE_DUNGEON_META.emoji;
    document.getElementById('fdMonsterName').textContent = `${state.fdFloor}층 ${FORGE_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.fdMonsterHp/state.fdMonsterMaxHp*100));
    document.getElementById('fdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('fdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.fdMonsterHp))} / ${state.fdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.fdPlayerHp/s.maxHp*100));
    document.getElementById('fdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('fdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.fdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshForgeDungeonTickets();
  renderForgeDungeonPanel();
}, 1000);

// ===== js/trainingdungeon.js =====
// ---------- Training Dungeon (수련 구역) ----------
// 물자/유산 구역과 동일한 구조(티켓제, 10층, 고정 스탯 전투)지만 보상이 확정 경험치입니다.
// 물자/유산 구역과 마찬가지로 보상은 플레이어의 expMult 배율과 무관한 고정값 — 레벨 1000에
// 전직이 걸려있어(job.js) 초중반 레벨업을 확정적으로 보조해줄 루트가 필요해서 신설되었다.

const TRAINING_DUNGEON_TICKET_MAX = 3;
const TRAINING_DUNGEON_TICKET_INTERVAL_MS = 15 * 60 * 1000; // 15분마다 티켓 1개 충전
const TRAINING_DUNGEON_MAX_FLOOR = 10;

const TRAINING_DUNGEON_META = {name:'수련 인형', emoji:'🥋'};

function tdHpFor(floor){ return Math.round(1600 * Math.pow(1.4, floor-1)); }
function tdAtkFor(floor){ return Math.round(27 * Math.pow(1.4, floor-1)); }
function tdDefFor(floor){ return Math.round(8 * Math.pow(1.4, floor-1)); }
// 1층 400exp부터 시작해 층마다 1.45배씩 증가 (10층 클리어 시 약 12,840exp)
function tdExpFor(floor){ return Math.round(480 * Math.pow(1.5, floor-1)); }

function refreshTrainingDungeonTickets(){
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    state.tdTicketLastRefill = Date.now();
    return;
  }
  const now = Date.now();
  const elapsed = now - state.tdTicketLastRefill;
  const gained = Math.floor(elapsed / TRAINING_DUNGEON_TICKET_INTERVAL_MS);
  if(gained <= 0) return;
  const newTicket = Math.min(TRAINING_DUNGEON_TICKET_MAX, state.tdTicket + gained);
  const actuallyGained = newTicket - state.tdTicket;
  state.tdTicket = newTicket;
  state.tdTicketLastRefill += actuallyGained * TRAINING_DUNGEON_TICKET_INTERVAL_MS;
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    state.tdTicketLastRefill = now;
  }
}

let tdPlayerTickHandle = null;
let tdMonsterTickHandle = null;

function enterTrainingDungeon(){
  if(state.tdActive) return;
  if(anySubActivityActive('tdActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 수련 구역에 입장할 수 없습니다.');
    return;
  }
  refreshTrainingDungeonTickets();
  if(state.tdTicket <= 0){
    alert('수련 구역 티켓이 부족합니다. (15분마다 1개씩 충전됩니다)');
    renderTrainingDungeonPanel();
    return;
  }
  if(!confirm(`수련 구역 ${state.tdFloor}층에 도전하시겠습니까? 티켓 1개를 소모합니다.\n(패배해도 티켓은 소모되며 같은 층부터 다시 도전합니다)`)) return;

  state.tdTicket--;
  state.tdActive = true;
  state.tdMonsterMaxHp = tdHpFor(state.tdFloor);
  state.tdMonsterHp = state.tdMonsterMaxHp;
  const s = stats();
  state.tdPlayerHp = s.maxHp;

  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`🥋 [수련 구역] ${state.tdFloor}층 ${TRAINING_DUNGEON_META.name}에게 도전합니다!`, 'new');
  renderAll();
  scheduleTdPlayerTick();
  scheduleTdMonsterTick();
}

function scheduleTdPlayerTick(){
  const s = stats();
  clearTimeout(tdPlayerTickHandle);
  tdPlayerTickHandle = setTimeout(tdPlayerAttackTick, s.tickMs);
}

function scheduleTdMonsterTick(){
  clearTimeout(tdMonsterTickHandle);
  tdMonsterTickHandle = setTimeout(tdMonsterAttackTick, 1000);
}

function tdPlayerAttackTick(){
  if(!state.tdActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - tdDefFor(state.tdFloor)));
  const isCrit = Math.random() * 100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }
  state.tdMonsterHp -= dmg;

  if(state.tdMonsterHp <= 0){
    resolveTrainingDungeonVictory();
    return;
  }
  renderCombatFrame();
  renderTrainingDungeonPanel();
  scheduleTdPlayerTick();
}

function tdMonsterAttackTick(){
  if(!state.tdActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, tdAtkFor(state.tdFloor) - s.def));
  state.tdPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.tdPlayerHp <= 0){
    resolveTrainingDungeonDefeat();
    return;
  }
  renderCombatFrame();
  renderTrainingDungeonPanel();
  scheduleTdMonsterTick();
}

function resolveTrainingDungeonVictory(){
  const expGain = tdExpFor(state.tdFloor);
  state.exp += expGain;
  tryLevelUp();
  log(`🏆 [수련 구역] ${state.tdFloor}층 클리어! +${expGain.toLocaleString()}EXP`, 'good');

  if(state.tdFloor >= TRAINING_DUNGEON_MAX_FLOOR){
    if(!state.tdCleared){
      state.tdCleared = true;
      log(`🥋 수련 구역을 모두 정복했습니다! 이제부터는 ${TRAINING_DUNGEON_MAX_FLOOR}층을 반복해서 도전할 수 있습니다.`, 'good');
    }
  } else {
    state.tdFloor++;
  }
  endTrainingDungeon();
}

function resolveTrainingDungeonDefeat(){
  log(`💀 [수련 구역] ${state.tdFloor}층에서 패배했습니다. 다음 티켓으로 다시 도전하세요.`, 'warn');
  endTrainingDungeon();
}

function endTrainingDungeon(){
  state.tdActive = false;
  clearTimeout(tdPlayerTickHandle);
  clearTimeout(tdMonsterTickHandle);
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
}

document.getElementById('tdEnterBtn')?.addEventListener('click', enterTrainingDungeon);

function renderTrainingDungeonPanel(){
  refreshTrainingDungeonTickets();

  const floorEl = document.getElementById('tdFloorText');
  if(!floorEl) return;
  floorEl.textContent = state.tdCleared
    ? `${TRAINING_DUNGEON_MAX_FLOOR}/${TRAINING_DUNGEON_MAX_FLOOR} (정복 완료 · 반복 도전 가능)`
    : `${state.tdFloor}/${TRAINING_DUNGEON_MAX_FLOOR}`;
  document.getElementById('tdNextReward').textContent = tdExpFor(state.tdFloor).toLocaleString();

  document.getElementById('tdTicketText').textContent = `${state.tdTicket}/${TRAINING_DUNGEON_TICKET_MAX}`;
  const timerEl = document.getElementById('tdTicketTimer');
  if(state.tdTicket >= TRAINING_DUNGEON_TICKET_MAX){
    timerEl.textContent = '(가득 충전됨)';
  } else {
    const remain = TRAINING_DUNGEON_TICKET_INTERVAL_MS - (Date.now() - state.tdTicketLastRefill);
    timerEl.textContent = `(다음 충전까지 ${formatMs(remain)})`;
  }

  const enterBtn = document.getElementById('tdEnterBtn');
  enterBtn.disabled = state.tdActive || state.tdTicket <= 0;
  enterBtn.textContent = state.tdActive ? '전투 진행 중...' : `${state.tdFloor}층 도전`;

  const battleBox = document.getElementById('tdBattleBox');
  if(state.tdActive){
    battleBox.style.display = 'block';
    document.getElementById('tdMonsterEmoji').textContent = TRAINING_DUNGEON_META.emoji;
    document.getElementById('tdMonsterName').textContent = `${state.tdFloor}층 ${TRAINING_DUNGEON_META.name}`;
    const bPct = Math.max(0, (state.tdMonsterHp/state.tdMonsterMaxHp*100));
    document.getElementById('tdMonsterHpBar').style.width = bPct+'%';
    document.getElementById('tdMonsterHpText').textContent = `${Math.max(0,Math.ceil(state.tdMonsterHp))} / ${state.tdMonsterMaxHp}`;

    const s = stats();
    const pPct = Math.max(0, (state.tdPlayerHp/s.maxHp*100));
    document.getElementById('tdPlayerHpBar').style.width = pPct+'%';
    document.getElementById('tdPlayerHpText').textContent = `${Math.max(0,Math.ceil(state.tdPlayerHp))} / ${s.maxHp}`;
  } else {
    battleBox.style.display = 'none';
  }
}

setInterval(()=>{
  refreshTrainingDungeonTickets();
  renderTrainingDungeonPanel();
}, 1000);

// ===== js/territory.js =====
// ---------- 영지 (Territory) ----------
// 건물을 지어 시간당 골드/유산 파편/혈청을 자동 생산하는 방치형 컨텐츠.
// 해금 조건 없음 — 새 게임 시작부터 기본 3종 건물(물자 창고/유산 채굴장/혈청 배양소)이 1칸씩 지어져 있다.
//
// 생산량은 실시간으로 계산하지 않고 "저장 상한(TERRITORY_CAP_HOURS)까지 쌓인 뒤 수확 버튼으로 직접 수령"
// 하는 방식 — 골드 던전/레이드 등 기존 티켓 시스템처럼 lastCollect 타임스탬프 기반으로 계산한다.
//
// 확장은 두 축으로 나뉜다:
//  ① 부지 슬롯 확장: 골드+파편+혈청을 섞어 지불하고 슬롯을 늘려 건물을 추가로 짓는다(같은 종류 중복 가능).
//  ② 건물 증축: 건물 레벨이 상한(TERRITORY_MAX_LEVEL_PER_TIER)에 도달하면, 자기 자원으로 값을 지불하고
//     티어를 올려 이름이 바뀌고 생산량이 크게 뛴다(사실상 무한 확장 — 돌연변이 각성 트리와 같은 결).

const TERRITORY_RESOURCE_FIELD = {gold:'gold', fragment:'fragments', soul:'soul'};

const TERRITORY_BUILDING_TYPES = [
  {
    type:'gold', icon:'📦', resourceLabel:'물자', baseRatePerHour: 400,
    tierNames: ['물자 창고', '물자 저장고', '물자 요새', '물자 성채', '물자 왕국'],
  },
  {
    type:'fragment', icon:'🗿', resourceLabel:'유산 파편', baseRatePerHour: 1.4,
    tierNames: ['유산 채굴장', '유산 갱도', '유산 광산', '대유산 광맥', '태고의 유산층'],
  },
  {
    type:'soul', icon:'🧪', resourceLabel:'혈청', baseRatePerHour: 0.5,
    tierNames: ['혈청 배양소', '혈청 정제소', '혈청 연구소', '혈청 생성로', '혈청 특이점'],
  },
];

// ---------- 밸런스 ----------
// (층수 비례 스케일링은 제거하고 고정 기본 생산량으로 되돌림)
function territoryBaseRate(type){
  const def = territoryDef(type);
  return def ? def.baseRatePerHour : 0;
}

const TERRITORY_TIER_MULT = 2.6;       // 티어당 생산량 배율
const TERRITORY_LEVEL_GROWTH = 0.12;   // 레벨당 생산량 증가폭(+12%)
const TERRITORY_MAX_LEVEL_PER_TIER = 20; // 이 레벨에 도달하면 "증축"으로만 더 성장 가능
const TERRITORY_UPGRADE_COST_MULT = 1.16; // 강화 1회당 비용 배율
const TERRITORY_TIER_COST_MULT = 3.4;     // 티어가 오를수록 강화/증축 비용도 함께 뛰는 배율
const TERRITORY_TIERUP_COST_FACTOR = 6;   // 증축 비용 = 그 티어 최대레벨 강화비용 * 이 배율
const TERRITORY_CAP_HOURS = 10;           // 저장 상한: 최대 10시간치까지만 쌓임

// 강화 1레벨 비용 = "그 시점 기준 생산량의 N시간치" (자원별로 다름 — 물자는 저렴하게 자주,
// 혈청/파편은 귀한 만큼 크게)
const TERRITORY_UPGRADE_COST_COEF = {gold: 6, fragment: 8, soul: 10};
// 부지 확장 비용 = "그 시점 기준 생산량의 40시간치" (건물 하나 새로 짓는 수준의 큰 투자)
const TERRITORY_SLOT_COST_HOURS = 40;
const TERRITORY_SLOT_COST_MULT = 1.55; // 슬롯을 늘릴수록 다음 슬롯 비용도 이 배율만큼 증가

function territoryDef(type){
  return TERRITORY_BUILDING_TYPES.find(t => t.type === type);
}

function territoryBuildingName(b){
  const def = territoryDef(b.type);
  const names = def.tierNames;
  if(b.tier <= names.length) return names[b.tier - 1];
  return `${names[names.length - 1]} +${b.tier - names.length}`;
}

function territoryBuildingRate(b){
  return territoryBaseRate(b.type) * Math.pow(TERRITORY_TIER_MULT, b.tier - 1) * (1 + (b.level - 1) * TERRITORY_LEVEL_GROWTH);
}

function territoryTotalRate(type){
  return state.territory.buildings
    .filter(b => b.type === type)
    .reduce((sum, b) => sum + territoryBuildingRate(b), 0);
}

function territoryCapAmount(type){
  return territoryTotalRate(type) * TERRITORY_CAP_HOURS;
}

function territoryPending(type){
  const rate = territoryTotalRate(type);
  const last = (state.territory.lastCollect && state.territory.lastCollect[type]) || Date.now();
  const hours = Math.min((Date.now() - last) / 3600000, TERRITORY_CAP_HOURS);
  return rate * hours;
}

function collectTerritory(type){
  const pending = Math.floor(territoryPending(type));
  if(pending <= 0) return;
  const field = TERRITORY_RESOURCE_FIELD[type];
  state[field] += pending;
  state.territory.lastCollect[type] = Date.now();
  const def = territoryDef(type);
  log(`${def.icon} ${def.resourceLabel} 수확: +${pending.toLocaleString()}`, 'good');
  renderAll();
}

function territoryUpgradeCost(b){
  const base = territoryBaseRate(b.type) * TERRITORY_UPGRADE_COST_COEF[b.type];
  return Math.max(1, Math.round(
    base
    * Math.pow(TERRITORY_UPGRADE_COST_MULT, b.level - 1)
    * Math.pow(TERRITORY_TIER_COST_MULT, b.tier - 1)
  ));
}

function territoryTierUpCost(b){
  const atMaxCost = territoryUpgradeCost({type: b.type, level: TERRITORY_MAX_LEVEL_PER_TIER, tier: b.tier});
  return Math.round(atMaxCost * TERRITORY_TIERUP_COST_FACTOR);
}

function upgradeTerritoryBuilding(idx){
  const b = state.territory.buildings[idx];
  if(!b || b.level >= TERRITORY_MAX_LEVEL_PER_TIER) return;
  const cost = territoryUpgradeCost(b);
  const field = TERRITORY_RESOURCE_FIELD[b.type];
  if(state[field] < cost) return;
  state[field] -= cost;
  b.level++;
  renderAll();
}

function tierUpTerritoryBuilding(idx){
  const b = state.territory.buildings[idx];
  if(!b || b.level < TERRITORY_MAX_LEVEL_PER_TIER) return;
  const cost = territoryTierUpCost(b);
  const field = TERRITORY_RESOURCE_FIELD[b.type];
  if(state[field] < cost) return;
  state[field] -= cost;
  b.tier++;
  b.level = 1;
  log(`🏗️ ${territoryDef(b.type).icon} ${territoryBuildingName(b)}(으)로 증축되었습니다!`, 'good');
  renderAll();
}

function territorySlotExpandCost(){
  const bought = Math.max(0, state.territory.slotCount - 3); // 시작 3칸 이후로 늘린 횟수
  const mult = Math.pow(TERRITORY_SLOT_COST_MULT, bought);
  return {
    gold: Math.round(territoryBaseRate('gold') * TERRITORY_SLOT_COST_HOURS * mult),
    fragments: Math.round(territoryBaseRate('fragment') * TERRITORY_SLOT_COST_HOURS * mult),
    soul: Math.round(territoryBaseRate('soul') * TERRITORY_SLOT_COST_HOURS * mult),
  };
}

function canAffordTerritorySlot(){
  const c = territorySlotExpandCost();
  return state.gold >= c.gold && state.fragments >= c.fragments && state.soul >= c.soul;
}

function expandTerritorySlot(type){
  if(!canAffordTerritorySlot()) return;
  const c = territorySlotExpandCost();
  state.gold -= c.gold;
  state.fragments -= c.fragments;
  state.soul -= c.soul;
  state.territory.slotCount++;
  state.territory.buildings.push({type, level:1, tier:1});
  log(`🏗️ 부지를 확장하고 ${territoryDef(type).icon} 새 건물을 지었습니다!`, 'good');
  renderAll();
}

// ---------- 렌더 ----------
function renderTerritoryPanel(){
  const collectGrid = document.getElementById('territoryCollectGrid');
  const buildGrid = document.getElementById('territoryBuildingGrid');
  if(!collectGrid || !buildGrid) return;

  // 자원별 수확 카드 3개
  collectGrid.innerHTML = TERRITORY_BUILDING_TYPES.map(def => {
    const pending = Math.floor(territoryPending(def.type));
    const cap = Math.floor(territoryCapAmount(def.type));
    const ratePerHour = territoryTotalRate(def.type);
    const full = cap > 0 && pending >= cap;
    return `
      <div class="relic-card">
        <div class="rname"><span>${def.icon} ${def.resourceLabel}</span><span class="rlvl">${ratePerHour.toLocaleString(undefined,{maximumFractionDigits:1})}/시간</span></div>
        <div class="rdesc">쌓인 양: ${pending.toLocaleString()} / ${cap.toLocaleString()}${full ? ' (가득 참!)' : ''}</div>
        <button class="pet-feed-btn" type="button" data-collect="${def.type}" ${pending<=0?'disabled':''}>
          ${pending>0 ? `수확하기 (+${pending.toLocaleString()})` : '쌓이는 중...'}
        </button>
      </div>
    `;
  }).join('');
  collectGrid.querySelectorAll('[data-collect]').forEach(btn=>{
    btn.addEventListener('click', ()=>collectTerritory(btn.dataset.collect));
  });

  // 건물 카드 그리드
  buildGrid.innerHTML = state.territory.buildings.map((b, idx) => {
    const def = territoryDef(b.type);
    const maxed = b.level >= TERRITORY_MAX_LEVEL_PER_TIER;
    const rate = territoryBuildingRate(b);
    const field = TERRITORY_RESOURCE_FIELD[b.type];
    let btnHtml;
    if(maxed){
      const cost = territoryTierUpCost(b);
      const afford = state[field] >= cost;
      btnHtml = `<button class="pet-feed-btn" type="button" data-tierup="${idx}" ${afford?'':'disabled'}>🏗️ 증축 (${cost.toLocaleString()} ${def.resourceLabel})</button>`;
    } else {
      const cost = territoryUpgradeCost(b);
      const afford = state[field] >= cost;
      btnHtml = `<button class="pet-feed-btn" type="button" data-upgrade="${idx}" ${afford?'':'disabled'}>강화 (${cost.toLocaleString()} ${def.resourceLabel})</button>`;
    }
    return `
      <div class="relic-card">
        <div class="rname"><span>${def.icon} ${territoryBuildingName(b)}</span><span class="rlvl">Lv.${b.level}${maxed?' MAX':''}</span></div>
        <div class="rdesc">생산량: ${rate.toLocaleString(undefined,{maximumFractionDigits:1})} ${def.resourceLabel}/시간</div>
        ${btnHtml}
      </div>
    `;
  }).join('');
  buildGrid.querySelectorAll('[data-upgrade]').forEach(btn=>{
    btn.addEventListener('click', ()=>upgradeTerritoryBuilding(parseInt(btn.dataset.upgrade,10)));
  });
  buildGrid.querySelectorAll('[data-tierup]').forEach(btn=>{
    btn.addEventListener('click', ()=>tierUpTerritoryBuilding(parseInt(btn.dataset.tierup,10)));
  });

  // 부지 확장
  const slotCountEl = document.getElementById('territorySlotCountText');
  const slotCostEl = document.getElementById('territorySlotCostText');
  if(slotCountEl) slotCountEl.textContent = state.territory.slotCount;
  if(slotCostEl){
    const c = territorySlotExpandCost();
    slotCostEl.textContent = `다음 확장 비용: 📦 ${c.gold.toLocaleString()} · 🗿 ${c.fragments.toLocaleString()} · 🧪 ${c.soul.toLocaleString()}`;
  }
  const afford = canAffordTerritorySlot();
  ['gold','fragment','soul'].forEach(type=>{
    const btn = document.getElementById(`territoryBuild${type==='gold'?'Gold':type==='fragment'?'Frag':'Soul'}Btn`);
    if(btn) btn.disabled = !afford;
  });
}

document.getElementById('territoryBuildGoldBtn')?.addEventListener('click', ()=>expandTerritorySlot('gold'));
document.getElementById('territoryBuildFragBtn')?.addEventListener('click', ()=>expandTerritorySlot('fragment'));
document.getElementById('territoryBuildSoulBtn')?.addEventListener('click', ()=>expandTerritorySlot('soul'));

// ===== js/ui-render.js =====
// ---------- Rendering ----------
function renderMonster(){
  const meta = currentMonsterMeta();
  const emojiEl = document.getElementById('monsterEmoji');
  if(meta.img){
    emojiEl.innerHTML = `<img src="${meta.img}" alt="${meta.name}" class="monster-img">`;
  } else {
    emojiEl.textContent = meta.emoji;
  }
  
  document.getElementById('monsterName').textContent = meta.name;
  document.getElementById('bossTag').style.display = state.isBoss ? 'block' : 'none';

  // 현재 층에서 명중률 95%를 안정적으로 유지하려면 필요한 권장 명중 수치 표시.
  // (몬스터 기준 / 보스 기준을 함께 보여줘서, 보스전 대비 여유치까지 가늠할 수 있게 함)
  const accEl = document.getElementById('accuracyLine');
  if(accEl){
    const cf = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
    if((state.mode === 'tower' && state.towerCleared) || (state.mode === 'towerHard' && state.htCleared)){
      accEl.textContent = '';
    } else {
      const recMob = recommendedAccuracyFor(cf, false);
      const recBoss = recommendedAccuracyFor(cf, true);
      const myAcc = stats().accuracy;
      const okClass = myAcc >= recBoss ? 'ok' : (myAcc >= recMob ? '' : 'bad');
      accEl.innerHTML = `권장 명중: 몬스터 ${recMob} / 보스 ${recBoss} <span class="${okClass}">(내 명중 ${myAcc})</span>`;
    }
  }

  const progressEl = document.getElementById('killProgressText');
  if(state.mode === 'tower'){
    document.getElementById('floorBadge').textContent = state.towerCleared ? '🏆 TOWER CLEAR! (100/100)' : ('TOWER ' + state.towerFloor + ' / 100F');
    progressEl.textContent = `무한의 탑 진행 중`;
  } else if(state.mode === 'towerHard'){
    document.getElementById('floorBadge').textContent = state.htCleared ? '👑 HARD TOWER CLEAR! (100/100)' : ('HARD TOWER ' + state.htFloor + ' / 100F');
    progressEl.textContent = `무한의 탑(어려움) 진행 중`;
  } else {
    document.getElementById('floorBadge').textContent = 'FLOOR ' + state.floor;
    if(state.isBoss){
      progressEl.textContent = '보스전 진행 중';
    } else {
      progressEl.textContent = `처치: ${state.killsOnFloor} / 5`;
    }
  }
}

function renderCombatFrame(){
  const s = stats();
  document.getElementById('goldDisplay').textContent = Math.floor(state.gold).toLocaleString();
  document.getElementById('soulDisplay').textContent = Math.floor(state.soul).toLocaleString();
  const stoneEl = document.getElementById('stoneDisplay');
  if(stoneEl) stoneEl.textContent = Math.floor(state.enhanceStone||0).toLocaleString();
  document.getElementById('lvlDisplay').textContent = state.level;

  const towerBtn = document.getElementById('modeTowerBtn');
  if(towerBtn){
    const unlocked = state.level >= TOWER_UNLOCK_LEVEL;
    towerBtn.textContent = unlocked ? '무한의 탑' : `무한의 탑 🔒(Lv.${TOWER_UNLOCK_LEVEL})`;
    towerBtn.classList.toggle('locked', !unlocked);
  }

  const towerHardBtn = document.getElementById('modeTowerHardBtn');
  if(towerHardBtn){
    const hardUnlocked = !!state.towerCleared;
    towerHardBtn.textContent = hardUnlocked ? '무한의 탑(어려움)' : '무한의 탑(어려움) 🔒(탑 100층 클리어)';
    towerHardBtn.classList.toggle('locked', !hardUnlocked);
  }

  document.getElementById('statAtk').textContent = s.atk;
  document.getElementById('statDef').textContent = s.def;

  // 전투력 계산 및 표시
  const cp = calcCombatPower(s);
  if(cp > state.peakCombatPower) state.peakCombatPower = cp;
  document.getElementById('cpValue').textContent = cp.toLocaleString();
  const cpCompareEl = document.getElementById('cpCompare');
  const cpBarEl = document.getElementById('cpBar');
  if(state.peakCombatPower > 0){
    const pct = Math.min(100, (cp / state.peakCombatPower) * 100);
    cpBarEl.style.width = pct.toFixed(1) + '%';
    if(cp >= state.peakCombatPower){
      cpCompareEl.textContent = `⚡ 역대 최고 전투력 달성!`;
      cpCompareEl.classList.add('recovered');
    } else {
      cpCompareEl.textContent = `최고 기록 ${state.peakCombatPower.toLocaleString()} 대비 ${pct.toFixed(1)}%`;
      cpCompareEl.classList.remove('recovered');
    }
  } else {
    cpBarEl.style.width = '0%';
    cpCompareEl.textContent = '';
  }
  document.getElementById('statHp').textContent = s.maxHp;
  const spdRelicBonus = state.relics.spdRelic > 0 ? ` <span style="color:var(--frag);font-size:10px;">(유산 +${state.relics.spdRelic*3}%)</span>` : '';
  document.getElementById('statSpd').innerHTML = (1000/s.tickMs).toFixed(3)+'/s' + spdRelicBonus;
  document.getElementById('statGold').textContent = 'x'+s.goldMult.toFixed(2);
  document.getElementById('statExpMult').textContent = 'x'+s.expMult.toFixed(2);

  const isMaxCrit = (state.goldUpgrades.critChance||0) >= 100 && (state.goldUpgrades.critDamage||0) >= 100;
  const critChanceEl = document.getElementById('statCritChance');
  const critDamageEl = document.getElementById('statCritDamage');
  if(isMaxCrit){
    critChanceEl.innerHTML = `100% <span style="color:#ff3b3b;font-weight:900;">⚡MAX</span>`;
    critDamageEl.innerHTML = `x${s.critDamageMult.toFixed(2)} <span style="color:#ff3b3b;font-weight:900;">⚡MAX</span>`;
  } else {
    critChanceEl.textContent = s.critChance.toFixed(0) + '%';
    critDamageEl.textContent = 'x' + s.critDamageMult.toFixed(2);
  }

  const accEl = document.getElementById('statAccuracy');
  if(accEl) accEl.textContent = s.accuracy;
  const hitChanceEl = document.getElementById('statHitChance');
  if(hitChanceEl){
    const cf = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
    const hc = hitChanceFor(cf, state.isBoss, s.accuracy);
    hitChanceEl.textContent = hc.toFixed(0) + '%';
    hitChanceEl.style.color = hc >= 90 ? '' : (hc >= 50 ? '#e8a33d' : 'var(--hp)');
  }

  const needed = expNeeded(state.level);
  document.getElementById('expText').textContent = `${state.exp} / ${needed}`;
  document.getElementById('expBar').style.width = Math.min(100,(state.exp/needed*100)) + '%';

  renderMonster();

  const mhPct = Math.max(0,(state.monsterHp/state.monsterMaxHp*100));
  document.getElementById('monsterHpBar').style.width = mhPct+'%';
  document.getElementById('monsterHpText').textContent = `${Math.max(0,Math.ceil(state.monsterHp))} / ${state.monsterMaxHp}`;

  const phPct = Math.max(0,(state.playerHp/s.maxHp*100));
  document.getElementById('playerHpBar').style.width = phPct+'%';
  document.getElementById('playerHpText').textContent = `${Math.max(0,Math.ceil(state.playerHp))} / ${s.maxHp}`;
}

// renderAll: 전투 프레임 + 상점/장비뽑기/유산/동료/각성 등 "패널"까지 통째로 다시 그린다.
// 패널들은 버튼을 innerHTML로 매번 새로 만들기 때문에, 공격속도에 맞춘 전투 틱마다
// 이 함수를 부르면 그 버튼들이 초당 여러 번 재생성되면서 클릭이 씹히는 문제가 생긴다.
// 그래서 전투 틱(schedulePlayerTick/scheduleMonsterTick)에서는 renderCombatFrame()만 부르고,
// renderAll()은 구매/뽑기/모드전환 같은 "사용자가 직접 액션을 취한 시점"과
// main.js의 1초 주기 인터벌에서만 호출한다.
function renderAll(){
  renderCombatFrame();

  renderShop();
  renderSoulShop();
  renderEquipment();
  renderRelics();
  renderPets();
  updateRebirthAvailability();
  checkDailyReset();
  renderDailyQuests();
  renderRepeatableQuests();
  renderCombatRepeatQuests();
  state.relicsOwnedCount = RELICS.filter(r=>state.relics[r.key]>0).length;
  renderAchievements();
  renderRaidPanel();
  renderGoldDungeonPanel();
  renderRelicDungeonPanel();
  if(typeof renderForgeDungeonPanel === 'function') renderForgeDungeonPanel();
  if(typeof renderTrainingDungeonPanel === 'function') renderTrainingDungeonPanel();
  if(typeof renderMutationTree === 'function') renderMutationTree();
  if(typeof renderJobPanel === 'function') renderJobPanel();
  if(typeof renderJobMasteryPanel === 'function') renderJobMasteryPanel();
  if(typeof renderSkillsPanel === 'function') renderSkillsPanel();
  if(typeof renderPvpRecord === 'function') renderPvpRecord();
  if(typeof renderBestiary === 'function') renderBestiary();
  if(typeof renderPotionShop === 'function') renderPotionShop();
  if(typeof renderSoulPackShop === 'function') renderSoulPackShop();
  if(typeof renderSkillTray === 'function') renderSkillTray();
  if(typeof renderTitles === 'function') renderTitles();
  if(typeof renderKillPassPanel === 'function') renderKillPassPanel();
  if(typeof renderWorldBossPanel === 'function') renderWorldBossPanel();
  if(typeof renderWorldMap === 'function'){
    const wmOverlay = document.getElementById('worldMapOverlay');
    if(wmOverlay && wmOverlay.style.display !== 'none') renderWorldMap();
  }
  if(typeof renderTerritoryPanel === 'function') renderTerritoryPanel();
}



// ===== js/worldmap.js =====
// ---------- 세계지도 (오픈월드 스타일 이동 UI) ----------
// 실제 필드를 걸어다니는 오픈월드 엔진을 새로 만드는 대신, 기존에 이미 존재하는 컨텐츠들
// (폐허/무한의 탑/구역/레이드/월드보스/영지/전직)을 "세계지도 위의 지역"으로 시각화해서
// 지역을 클릭하면 그 위치로 "이동"하는 연출과 함께 해당 컨텐츠 화면으로 데려다주는 방식.
// 해금 조건은 전부 각 시스템에 이미 존재하는 함수/상태를 그대로 재사용하며, 이 파일은
// 새로운 해금 로직을 만들지 않는다 (예: 무한의 탑 레벨 조건, 레이드/월드보스 100층 조건 등).

const WORLD_ZONES = [
  {
    key:'town', name:'🏘️ 마을', x:50, y:50,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-growth'},
  },
  {
    key:'ruins', name:'🏚️ 폐허', x:17, y:35,
    unlockedFn: () => true,
    action:{type:'mode', value:'normal'},
  },
  {
    key:'tower', name:'🗼 무한의 탑', x:50, y:14,
    unlockedFn: () => state.level >= TOWER_UNLOCK_LEVEL,
    lockText: `레벨 ${typeof TOWER_UNLOCK_LEVEL !== 'undefined' ? TOWER_UNLOCK_LEVEL : 10} 이상 필요`,
    action:{type:'mode', value:'tower'},
  },
  {
    key:'towerHard', name:'👑 무한의 탑(어려움)', x:70, y:20,
    unlockedFn: () => !!state.towerCleared,
    lockText: '무한의 탑(100층) 클리어 필요',
    action:{type:'mode', value:'towerHard'},
  },
  {
    key:'raid', name:'☣️ 심연 (1인 레이드)', x:83, y:35,
    unlockedFn: () => typeof raidUnlocked === 'function' && raidUnlocked(),
    lockText: '무한의 탑 100층 클리어 필요',
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'raidEnterBtn'},
  },
  {
    key:'worldBoss', name:'🧟 월드보스 유적', x:86, y:55,
    unlockedFn: () => typeof worldBossUnlocked === 'function' && worldBossUnlocked(),
    lockText: '무한의 탑 100층 클리어 필요',
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'wbEnterBtn'},
  },
  {
    key:'territory', name:'🏰 영지', x:77, y:74,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-territory'},
  },
  {
    key:'relicDungeon', name:'🗿 유산 구역', x:60, y:85,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'rdEnterBtn'},
  },
  {
    key:'forgeDungeon', name:'🔥 단조 구역', x:40, y:85,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'fdEnterBtn'},
  },
  {
    key:'trainingDungeon', name:'🥋 수련 구역', x:23, y:74,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'tdEnterBtn'},
  },
  {
    key:'goldDungeon', name:'📦 물자 구역', x:14, y:55,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'gdEnterBtn'},
  },
  {
    key:'job', name:'⚜️ 전직의 제단', x:31, y:20,
    unlockedFn: () => typeof jobUnlocked === 'function' && jobUnlocked(),
    lockText: `레벨 ${typeof JOB_UNLOCK_LEVEL !== 'undefined' ? JOB_UNLOCK_LEVEL : 1000} 이상 필요`,
    action:{type:'tab', tab:'tab-growth', scrollTarget:'jobPanelSection'},
  },
];

// 마을(town)을 중심으로 뻗어나가는 기본 연결선 + 진행 흐름을 보여주는 추가 연결선.
const WORLD_MAP_LINKS = [
  ['town','ruins'], ['town','tower'], ['town','towerHard'], ['town','raid'],
  ['town','worldBoss'], ['town','territory'], ['town','relicDungeon'],
  ['town','forgeDungeon'], ['town','trainingDungeon'], ['town','goldDungeon'], ['town','job'],
  ['tower','towerHard'], ['raid','worldBoss'],
  ['goldDungeon','relicDungeon'], ['relicDungeon','forgeDungeon'], ['forgeDungeon','trainingDungeon'],
];

function worldZoneByKey(key){
  return WORLD_ZONES.find(z => z.key === key);
}

function renderWorldMap(){
  const canvas = document.getElementById('worldMapCanvas');
  const svg = document.getElementById('worldMapLines');
  if(!canvas || !svg) return;

  // 연결선은 지도가 바뀌지 않으므로 최초 1회만 그린다.
  if(!svg.dataset.built){
    svg.innerHTML = WORLD_MAP_LINKS.map(([a,b])=>{
      const za = worldZoneByKey(a), zb = worldZoneByKey(b);
      if(!za || !zb) return '';
      return `<line x1="${za.x}" y1="${za.y}" x2="${zb.x}" y2="${zb.y}" class="worldmap-link" />`;
    }).join('');
    svg.dataset.built = '1';
  }

  // 노드 div는 매번 다시 그리되(해금 상태가 실시간으로 바뀔 수 있으므로), 기존 요소가 있으면 재사용.
  WORLD_ZONES.forEach(zone=>{
    let node = canvas.querySelector(`.worldmap-node[data-key="${zone.key}"]`);
    const unlocked = !!zone.unlockedFn();
    if(!node){
      node = document.createElement('div');
      node.className = 'worldmap-node';
      node.dataset.key = zone.key;
      node.style.left = zone.x + '%';
      node.style.top = zone.y + '%';
      node.innerHTML = `
        <div class="worldmap-node-icon"></div>
        <div class="worldmap-node-label"></div>
        <div class="worldmap-node-lock">🔒</div>
      `;
      node.addEventListener('click', ()=>travelToZone(zone.key));
      canvas.appendChild(node);
    }
    node.classList.toggle('locked', !unlocked);
    node.classList.toggle('home', zone.key === 'town');
    node.querySelector('.worldmap-node-icon').textContent = zone.name.split(' ')[0];
    node.querySelector('.worldmap-node-label').textContent = zone.name.split(' ').slice(1).join(' ');
    node.title = unlocked ? zone.name : `🔒 ${zone.lockText || '조건 미충족'}`;
  });
}

function openWorldMap(){
  const overlay = document.getElementById('worldMapOverlay');
  if(!overlay) return;
  renderWorldMap();
  overlay.style.display = 'flex';
}

function closeWorldMap(){
  const overlay = document.getElementById('worldMapOverlay');
  if(overlay) overlay.style.display = 'none';
}

// 마을 좌표에서 목적지 좌표까지 작은 깃발 마커가 이동하는 짧은 연출을 보여준 뒤,
// 실제 화면 전환(모드 변경 or 탭 이동)을 수행한다. 잠긴 지역은 이유를 알려주고 끝낸다.
function travelToZone(key){
  const zone = worldZoneByKey(key);
  if(!zone) return;
  if(!zone.unlockedFn()){
    alert(`🔒 아직 갈 수 없는 지역입니다.\n(${zone.lockText || '조건 미충족'})`);
    return;
  }

  const traveler = document.getElementById('worldMapTraveler');
  const town = worldZoneByKey('town');
  if(traveler && zone.key !== 'town'){
    traveler.style.transition = 'none';
    traveler.style.left = town.x + '%';
    traveler.style.top = town.y + '%';
    traveler.style.display = 'block';
    // 강제 리플로우 후 목적지로 트랜지션 이동 (연출용)
    void traveler.offsetWidth;
    traveler.style.transition = 'left .6s ease, top .6s ease';
    traveler.style.left = zone.x + '%';
    traveler.style.top = zone.y + '%';
  }

  setTimeout(()=>{
    executeZoneAction(zone);
    if(traveler) traveler.style.display = 'none';
    closeWorldMap();
  }, (traveler && zone.key !== 'town') ? 650 : 0);
}

function executeZoneAction(zone){
  const a = zone.action;
  if(a.type === 'mode'){
    if(typeof setMode === 'function') setMode(a.value);
  } else if(a.type === 'tab'){
    const tabBtn = document.querySelector(`.tab-nav-btn[data-tab="${a.tab}"]`);
    if(tabBtn) tabBtn.click();
    if(a.scrollTarget){
      setTimeout(()=>{
        const el = document.getElementById(a.scrollTarget);
        if(el){
          el.scrollIntoView({behavior:'smooth', block:'center'});
          const panel = el.closest('.panel');
          if(panel){
            panel.classList.add('worldmap-highlight');
            setTimeout(()=>panel.classList.remove('worldmap-highlight'), 1600);
          }
        }
      }, 80);
    }
  }
  log(`🗺️ ${zone.name}(으)로 이동했습니다.`, 'new');
}

document.getElementById('worldMapOpenBtn')?.addEventListener('click', openWorldMap);
document.getElementById('worldMapCloseBtn')?.addEventListener('click', closeWorldMap);
document.getElementById('worldMapOverlay')?.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'worldMapOverlay') closeWorldMap();
});

// ===== js/shop.js =====
let shopBuyMultiplier = 1;
document.querySelectorAll('.buy-mult-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    shopBuyMultiplier = parseInt(btn.dataset.mult, 10);
    document.querySelectorAll('.buy-mult-btn').forEach(b=>b.classList.toggle('active', b===btn));
    renderShop();
  });
});

// n레벨을 한 번에 살 때의 누적 비용 (등비수열 합)
function bulkCost(baseCost, mult, startLvl, n){
  if(n <= 0) return 0;
  if(Math.abs(mult - 1) < 1e-9) return Math.round(baseCost * n);
  const startCost = baseCost * Math.pow(mult, startLvl);
  return Math.round(startCost * (Math.pow(mult, n) - 1) / (mult - 1));
}

function renderShop(){
  const container = document.getElementById('shopList');

  const needsFullBuild = container.children.length !== GOLD_UPGRADES.length
    || container.dataset.builtMult !== String(shopBuyMultiplier);

  if(needsFullBuild){
    container.innerHTML = '';
    container.dataset.builtMult = String(shopBuyMultiplier);

    GOLD_UPGRADES.forEach(u=>{
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.key = u.key;
      row.innerHTML = `
        <div class="info">
          <div class="name"><span class="uname"></span> <span class="lvl-tag"></span></div>
          <div class="desc">${u.desc}</div>
        </div>
        <button class="buy" data-key="${u.key}"></button>
      `;
      container.appendChild(row);

      const btn = row.querySelector('button');
      btn.addEventListener('click', ()=>{
        if(u.capStat && isUpgradeStatMaxed(u.capStat)) return; // 이미 캡 도달 — 구매 차단
        const remain = u.maxLevel ? Math.max(0, u.maxLevel - (state.goldUpgrades[u.key]||0)) : Infinity;
        const n = Math.min(shopBuyMultiplier, remain);
        const totalCost = bulkCost(u.baseCost, u.mult, state.goldUpgrades[u.key]||0, n);
        if(n > 0 && state.gold >= totalCost){
          state.gold -= totalCost;
          state.goldUpgrades[u.key] = (state.goldUpgrades[u.key] || 0) + n;
          state.dailyUpgradesBought += n;
          log(`${u.name} 강화! (Lv.${state.goldUpgrades[u.key]}, +${n})`);
          if(!state.maxCritAnnounced && (state.goldUpgrades.critChance||0) >= 100 && (state.goldUpgrades.critDamage||0) >= 100){
            state.maxCritAnnounced = true;
            log('⚡ 맥스 치명타 달성! 치명타 확률 100%, 치명타 피해 최대치에 도달했습니다!', 'good');
          }
          renderAll();
        }
      });
    });
  }

  // 매번 여기서부터: 기존 요소는 그대로 두고 텍스트/비활성화 상태만 갱신 (클릭 씹힘 방지)
  GOLD_UPGRADES.forEach(u=>{
    const row = container.querySelector(`.shop-item[data-key="${u.key}"]`);
    if(!row) return;

    const lvl = state.goldUpgrades[u.key] || 0;
    const maxed = u.maxLevel && lvl >= u.maxLevel;
    const statMaxed = !!(u.capStat && isUpgradeStatMaxed(u.capStat)); // 실제 스탯이 이미 캡에 도달
    const remainToMax = u.maxLevel ? Math.max(0, u.maxLevel - lvl) : Infinity;
    const buyN = Math.min(shopBuyMultiplier, remainToMax);
    const cost = bulkCost(u.baseCost, u.mult, lvl, buyN);
    const label = maxed ? '최대'
      : statMaxed ? '상한 도달 (효과없음)'
      : (buyN <= 0 ? '최대' : `${cost.toLocaleString()} 📦 (x${buyN})`);

    row.querySelector('.uname').textContent = u.name;
    row.querySelector('.lvl-tag').textContent = `Lv.${lvl}`;

    const btn = row.querySelector('button');
    const disabled = maxed || statMaxed || buyN <= 0 || state.gold < cost;
    if(btn.disabled !== disabled) btn.disabled = disabled;
    if(btn.textContent !== label) btn.textContent = label;
  });
}

// 혈청 영구 강화 비용 (레벨이 오를수록 mult배씩 지수적으로 상승).
// 예전엔 "레벨+2"라는 선형 비용이라 환생을 거듭할수록 혈청이 소모처 없이 쌓이기만 했던 문제를 고침.
function soulUpgradeCost(u, lvl){
  return lvl+2;
}

function renderSoulShop(){
  const container = document.getElementById('soulShopList');

  const needsFullBuild = container.children.length !== SOUL_UPGRADES.length;

  if(needsFullBuild){
    container.innerHTML = '';
    SOUL_UPGRADES.forEach(u=>{
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.dataset.key = u.key;
      row.innerHTML = `
        <div class="info">
          <div class="name"><span class="uname"></span> <span class="lvl-tag"></span></div>
          <div class="desc">${u.desc}</div>
        </div>
        <button class="buy soul" data-key="${u.key}"></button>
      `;
      container.appendChild(row);

      const btn = row.querySelector('button');
      btn.addEventListener('click', ()=>{
        if(u.capStat && isUpgradeStatMaxed(u.capStat)) return; // 이미 캡 도달 — 구매 차단
        const cost = soulUpgradeCost(u, state.soulUpgrades[u.key]);
        if(state.soul >= cost){
          state.soul -= cost;
          state.soulUpgrades[u.key]++;
          log(`${u.name} 영구 강화! (Lv.${state.soulUpgrades[u.key]})`, 'good');
          renderAll();
        }
      });
    });
  }

  SOUL_UPGRADES.forEach(u=>{
    const row = container.querySelector(`.shop-item[data-key="${u.key}"]`);
    if(!row) return;
    const lvl = state.soulUpgrades[u.key];
    const cost = soulUpgradeCost(u, lvl);
    const statMaxed = !!(u.capStat && isUpgradeStatMaxed(u.capStat));

    row.querySelector('.uname').textContent = u.name;
    row.querySelector('.lvl-tag').textContent = `Lv.${lvl}`;

    const btn = row.querySelector('button');
    const label = statMaxed ? '상한 도달 (효과없음)' : `${cost.toLocaleString()} 🧪`;
    const disabled = statMaxed || state.soul < cost;
    if(btn.disabled !== disabled) btn.disabled = disabled;
    if(btn.textContent !== label) btn.textContent = label;
  });
}
// ===== js/relics-pets.js =====
// ---------- Relics ----------
function relicPullCost(){
  return Math.round(8 * Math.pow(1.035, state.totalRelicPulls));
}

function pullRelic(){
  const cost = relicPullCost();
  if(state.fragments < cost) return;
  state.fragments -= cost;
  state.totalRelicPulls++;
  const picked = RELICS[Math.floor(Math.random()*RELICS.length)];
  state.relics[picked.key]++;
  const newLvl = state.relics[picked.key];
  log(`유산 뽑기: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
  renderAll();
}
document.getElementById('pullRelicBtn').addEventListener('click', pullRelic);

function renderRelics(){
  const cost = relicPullCost();
  document.getElementById('fragDisplay').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('fragDisplay2').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('pullCostText').textContent = cost.toLocaleString();
  document.getElementById('pullRelicBtn').disabled = state.fragments < cost;

  const grid = document.getElementById('relicGrid');
  grid.innerHTML = '';
  RELICS.forEach(r=>{
    const lvl = state.relics[r.key];
    const owned = lvl > 0;
    const value = Math.round(lvl * r.perLevel * 10) / 10;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'');
    card.innerHTML = `
      <div class="rname"><span>${r.icon} ${r.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${r.descFn(owned ? value : r.perLevel)}${owned?'':' (미보유)'}</div>
    `;
    grid.appendChild(card);
  });
}

// ---------- Pets ----------
function petSummonCost(){
  return Math.round(12 * Math.pow(1.04, state.totalPetSummons));
}

function summonPet(){
  const cost = petSummonCost();
  if(state.fragments < cost) return;
  state.fragments -= cost;
  state.totalPetSummons++;
  const picked = PETS[Math.floor(Math.random()*PETS.length)];
  state.pets[picked.key] = (state.pets[picked.key]||0) + 1;
  const newLvl = state.pets[picked.key];
  log(`동료 소환: ${picked.icon} ${picked.name} (Lv.${newLvl})`, 'good');
  renderAll();
}
document.getElementById('summonPetBtn').addEventListener('click', summonPet);

// ---------- 동행 (Companion) ----------
// 보유한 동료 중 하나를 "동행"으로 지정하면, 그 동료 종류별로 다른 능력치 보너스를 영구 적용받는다.
// 기존 주기 발동 효과(petTick)는 동행 여부와 무관하게 보유한 모든 동료가 그대로 계속 작동하며,
// 동행 보너스는 그 위에 추가로 붙는 별도 효과다. 레벨이 높을수록 동행 보너스도 커진다.
function companionBonus(){
  const b = {atkPct:0, defPct:0, hpPct:0, goldPct:0, expPct:0, critAdd:0, critDmgAdd:0, dropAdd:0, spdPct:0};
  if(!state.companionPet) return b;
  const p = PETS.find(x => x.key === state.companionPet);
  const lvl = state.pets && state.pets[state.companionPet];
  if(!p || !p.companionStat || !(lvl > 0)) return b;
  b[p.companionStat] += p.companionValueFn(lvl);
  return b;
}

function companionEffectText(p){
  const lvl = (state.pets && state.pets[p.key]) || 1;
  const value = p.companionValueFn(lvl);
  const unitMap = {atkPct:'%', defPct:'%', hpPct:'%', goldPct:'%', expPct:'%', critAdd:'%p', critDmgAdd:'%p', dropAdd:'%p', spdPct:'%'};
  const labelMap = {atkPct:'공격력', defPct:'방어력', hpPct:'최대 체력', goldPct:'물자 획득', expPct:'경험치 획득', critAdd:'치명타 확률', critDmgAdd:'치명타 피해', dropAdd:'파편 드랍 확률', spdPct:'공격 속도'};
  return `동행 시 ${labelMap[p.companionStat]} +${value}${unitMap[p.companionStat]}`;
}

function setCompanion(key){
  if(!state.pets || !(state.pets[key] > 0)) return;
  state.companionPet = (state.companionPet === key) ? null : key;
  applyCompanionSprite();
  renderAll();
}

// 전투 화면의 캐릭터 옆에 동행 중인 동료 아이콘을 작게 띄운다 (전용 아트가 없어 이모지로 표시).
function applyCompanionSprite(){
  const el = document.getElementById('companionSprite');
  if(!el) return;
  const key = state.companionPet;
  const lvl = key && state.pets && state.pets[key];
  if(!key || !(lvl > 0)){
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  const p = PETS.find(x => x.key === key);
  el.innerHTML = p ? petIconHtml(p, 26) : '';
  el.style.display = p ? 'block' : 'none';
}

function renderPets(){
  const cost = petSummonCost();
  document.getElementById('fragDisplay3').textContent = Math.floor(state.fragments).toLocaleString();
  document.getElementById('petCostText').textContent = cost.toLocaleString();
  document.getElementById('summonPetBtn').disabled = state.fragments < cost;

  const grid = document.getElementById('petGrid');
  grid.innerHTML = '';
  PETS.forEach(p=>{
    const lvl = state.pets[p.key] || 0;
    const owned = lvl > 0;
    const isCompanion = state.companionPet === p.key;
    const card = document.createElement('div');
    card.className = 'relic-card' + (owned?' owned':'') + (isCompanion?' equipped':'');
    card.innerHTML = `
      <div class="rname"><span>${petIconHtml(p, 16)} ${p.name}</span><span class="rlvl">Lv.${lvl}</span></div>
      <div class="rdesc">${p.descFn(owned ? lvl : 1)}${owned?'':' (미보유)'}</div>
      ${owned && p.companionStat ? `<div class="rdesc" style="color:var(--gold);">${companionEffectText(p)}</div>` : ''}
      ${owned && p.companionStat ? `<button class="title-equip-btn ${isCompanion?'unequip':''}" data-key="${p.key}">${isCompanion?'동행 해제':'동행하기'}</button>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.title-equip-btn[data-key]').forEach(btn=>{
    btn.addEventListener('click', ()=>setCompanion(btn.dataset.key));
  });
  applyCompanionSprite();
  if(typeof renderPetShelter === 'function') renderPetShelter();
}

let petTimers = {};
function petTick(){
  if(state.playerHp <= 0) return;
  // 무한의 탑(일반/어려움)을 100층까지 정복하면 전투가 멈춘 채로 고정되는데,
  // 이때도 펫 트리거(예: 전투 소세지가 더미 몬스터를 계속 때리는 것)가 계속 반응해서
  // 로그가 스팸처럼 쌓이는 문제가 있었다. 정복 완료 상태에서는 펫도 함께 정지시킨다.
  if(state.mode === 'tower' && state.towerCleared) return;
  if(state.mode === 'towerHard' && state.htCleared) return;
  const s = stats();
  let changed = false;
  PETS.forEach(p=>{
    const lvl = state.pets[p.key] || 0;
    if(lvl <= 0) return;
    petTimers[p.key] = (petTimers[p.key]||0) + 1;
    if(petTimers[p.key] >= p.interval){
      petTimers[p.key] = 0;
      p.trigger(lvl, s);
      changed = true;
    }
  });
  if(changed) renderAll();
}


// ===== js/killpass.js =====
// ---------- ⚔️ 몬스터 처치 패스 ----------
// 누적 처치(state.totalKills) 기준으로 KILL_PASS_TIERS를 순서대로 하나씩만 수령할 수 있는
// 장기 보상 트랙. state.killPassClaimed는 "이미 수령 완료한 단계 수"이며, 그 다음 인덱스
// (KILL_PASS_TIERS[state.killPassClaimed])가 항상 "다음에 받을 단계"가 된다.

function killPassNextTier(){
  return KILL_PASS_TIERS[state.killPassClaimed || 0] || null;
}

// 지금 바로 수령 가능한(target을 이미 넘겼는데 아직 안 받은) 단계 수
function killPassClaimableCount(){
  let claimed = state.killPassClaimed || 0;
  let count = 0;
  while(claimed + count < KILL_PASS_TIERS.length && state.totalKills >= KILL_PASS_TIERS[claimed + count].target){
    count++;
  }
  return count;
}

// 보상 지급(공용 로직). silent=true면 개별 로그를 남기지 않음(모아받기용).
function killPassGrantReward(tier, silent){
  const r = tier.rewards;
  if(r.gold){
    state.gold += r.gold;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned || 0) + r.gold;
  }
  if(r.frag) state.fragments += r.frag;
  if(r.soul) state.soul += r.soul;
  if(r.stone){
    state.enhanceStone += r.stone;
    state.totalEnhanceStonesEarned = (state.totalEnhanceStonesEarned || 0) + r.stone;
  }
  if(tier.special === 'pull' && typeof RELICS !== 'undefined'){
    const picked = RELICS[Math.floor(Math.random() * RELICS.length)];
    state.relics[picked.key]++;
    if(!silent) log(`🎁 처치 패스 ${tier.tier}단계: 무료 유산 뽑기 → ${picked.icon} ${picked.name}!`, 'good');
  } else if(!silent){
    log(`⚔️ 처치 패스 ${tier.tier}단계 보상 수령!`, 'good');
  }
}

function claimKillPassTier(){
  const idx = state.killPassClaimed || 0;
  const tier = KILL_PASS_TIERS[idx];
  if(!tier) return;
  if(state.totalKills < tier.target) return;
  killPassGrantReward(tier, false);
  state.killPassClaimed = idx + 1;
  renderKillPassPanel();
  renderAll();
  saveState(true);
}

function claimAllKillPassTiers(){
  const startCount = killPassClaimableCount();
  if(startCount <= 0){
    alert('아직 수령 가능한 처치 패스 보상이 없습니다.');
    return;
  }
  for(let i=0;i<startCount;i++){
    const idx = state.killPassClaimed || 0;
    const tier = KILL_PASS_TIERS[idx];
    if(!tier || state.totalKills < tier.target) break;
    killPassGrantReward(tier, true);
    state.killPassClaimed = idx + 1;
  }
  log(`⚔️ 처치 패스 보상 ${startCount}단계분을 한꺼번에 수령했습니다! (현재 ${state.killPassClaimed}단계)`, 'good');
  renderKillPassPanel();
  renderAll();
  saveState(true);
}

function killPassRewardText(tier){
  const parts = [];
  if(tier.rewards.gold) parts.push(`📦${tier.rewards.gold.toLocaleString()}`);
  if(tier.rewards.frag) parts.push(`◈${tier.rewards.frag.toLocaleString()}`);
  if(tier.rewards.soul) parts.push(`🧪${tier.rewards.soul.toLocaleString()}`);
  if(tier.rewards.stone) parts.push(`🔩${tier.rewards.stone.toLocaleString()}`);
  if(tier.special === 'pull') parts.push('🎁뽑기');
  if(tier.special === 'title') parts.push('🏅칭호');
  return parts.join(' ');
}

function renderKillPassPanel(){
  const track = document.getElementById('killPassTrack');
  if(!track) return;

  const claimed = state.killPassClaimed || 0;
  const claimable = killPassClaimableCount();
  const next = killPassNextTier();

  const tierText = document.getElementById('killPassTierText');
  if(tierText) tierText.textContent = `${claimed} / ${KILL_PASS_TIER_COUNT}단계`;

  const progressFill = document.getElementById('killPassProgressFill');
  const progressText = document.getElementById('killPassProgressText');
  if(progressFill && progressText){
    if(!next){
      progressFill.style.width = '100%';
      progressText.textContent = `🏆 처치 패스 전 단계 완주! (누적 처치 ${Math.floor(state.totalKills).toLocaleString()})`;
    } else {
      const prevTarget = claimed > 0 ? KILL_PASS_TIERS[claimed - 1].target : 0;
      const span = Math.max(1, next.target - prevTarget);
      const pct = Math.max(0, Math.min(100, (state.totalKills - prevTarget) / span * 100));
      progressFill.style.width = pct.toFixed(1) + '%';
      progressText.textContent = `누적 처치 ${Math.floor(state.totalKills).toLocaleString()} / ${next.target.toLocaleString()} (다음: ${next.tier}단계)`;
    }
  }

  // 카드 DOM은 최초 1회만 만들고 이후엔 클래스/텍스트만 갱신 (50개 카드 매번 재생성 방지)
  if(!track.dataset.built){
    track.innerHTML = KILL_PASS_TIERS.map(t => `
      <div class="killpass-tier-card" data-tier="${t.tier}">
        <div class="killpass-tier-num">${t.tier}</div>
        <div class="killpass-tier-target">${t.target.toLocaleString()}킬</div>
        <div class="killpass-tier-reward">${killPassRewardText(t)}</div>
        <div class="killpass-tier-state"></div>
      </div>
    `).join('');
    track.dataset.built = '1';
  }

  KILL_PASS_TIERS.forEach(t=>{
    const card = track.querySelector(`.killpass-tier-card[data-tier="${t.tier}"]`);
    if(!card) return;
    const done = t.tier <= claimed;
    const isNext = t.tier === claimed + 1;
    const ready = done ? false : state.totalKills >= t.target;
    card.classList.toggle('done', done);
    card.classList.toggle('ready', ready);
    card.classList.toggle('next', isNext && !ready);
    const stateEl = card.querySelector('.killpass-tier-state');
    stateEl.textContent = done ? '✅ 완료' : (ready ? '🎁 수령가능' : '🔒 대기');
  });

  const claimAllBtn = document.getElementById('killPassClaimAllBtn');
  if(claimAllBtn){
    claimAllBtn.disabled = claimable <= 0;
    claimAllBtn.textContent = claimable > 0 ? `모아서 받기 (${claimable}단계)` : '모아서 받기';
  }
}

document.getElementById('killPassClaimAllBtn')?.addEventListener('click', claimAllKillPassTiers);
document.getElementById('killPassTrack')?.addEventListener('click', (e)=>{
  const card = e.target.closest('.killpass-tier-card');
  if(!card) return;
  const tier = parseInt(card.dataset.tier, 10);
  const claimed = state.killPassClaimed || 0;
  if(tier === claimed + 1) claimKillPassTier();
});

// ===== js/pet-shelter.js =====
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

// ===== js/quests.js =====
// ---------- Quests & Achievements ----------
// 예전엔 "마지막 리셋 후 24시간 경과"로 판정해서 유저마다 리셋 시각이 최초 접속 시간에 따라
// 제각각 밀리는 문제가 있었다. 자정(로컬 자정) 기준으로 날짜가 바뀌었는지로 판정하도록 변경.
function checkDailyReset(){
  if(!isSameDay(state.dailyResetAt, Date.now())){
    state.dailyResetAt = Date.now();
    state.dailyKills = 0;
    state.dailyGoldEarned = 0;
    state.dailyUpgradesBought = 0;
    state.dailyBossKills = 0;
    state.dailyClaims = {};
    state.dailySoulPacksBought = 0;
    log('일일 퀘스트가 초기화되었습니다.', 'new');
  }
}

function applyReward(reward){
  if(reward.gold) state.gold += reward.gold;
  if(reward.soul) state.soul += reward.soul;
  if(reward.frag) state.fragments += reward.frag;
}

function rewardText(reward){
  const parts = [];
  if(reward.gold) parts.push(`+${reward.gold}📦`);
  if(reward.soul) parts.push(`+${reward.soul}🧪`);
  if(reward.frag) parts.push(`+${reward.frag}◈`);
  return parts.join(' ');
}

// 반복 퀘스트 보상은 '고정 값(q.reward) + 층수 비례 값(q.scale)'으로 계산한다.
// q.scale은 '현재 층 일반 몬스터 1마리 물자값(goldDropFor) × 물자 배율(goldMult)'의 몇 배인지.
// 층수가 오를수록 보상이 자동으로 커져서 초반엔 확실하게, 후반에도 계속 의미 있게 받을 수 있다.
function repeatQuestReward(q){
  const base = q.reward || {};
  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
  const s = stats();
  const scaled = q.scale ? Math.round(goldDropFor(currentFloor, false) * s.goldMult * q.scale) : 0;
  return {gold:(base.gold||0)+scaled, soul:base.soul||0, frag:base.frag||0};
}

function claimDaily(key){
  const q = DAILY_QUESTS.find(x=>x.key===key);
  if(!q || state.dailyClaims[key]) return;
  if(state[q.statKey] < q.target) return;
  applyReward(q.reward);
  state.dailyClaims[key] = true;
  log(`퀘스트 완료: ${q.name} (${rewardText(q.reward)})`, 'good');
  renderAll();
}

function claimAch(key){
  const a = ACHIEVEMENTS.find(x=>x.key===key);
  if(!a || state.achClaims[key]) return;
  if(!a.check(state)) return;
  applyReward(a.reward);
  state.achClaims[key] = true;
  log(`업적 달성: ${a.name} (${rewardText(a.reward)})`, 'good');
  renderAll();
}

function renderDailyQuests(){
  const el = document.getElementById('dailyResetText');
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0);
  const remainMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const h = Math.floor(remainMs/3600000), m = Math.floor((remainMs%3600000)/60000);
  el.textContent = `(초기화까지 ${h}시간 ${m}분)`;

  const container = document.getElementById('dailyQuestList');
  container.innerHTML = '';
  DAILY_QUESTS.forEach(q=>{
    const progress = Math.min(state[q.statKey], q.target);
    const ready = progress >= q.target;
    const claimed = !!state.dailyClaims[q.key];
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${q.name}</div>
          <div class="qdesc">${q.desc}</div>
        </div>
        <div class="qreward">${rewardText(q.reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(progress/q.target*100)}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${progress}/${q.target}</span>
        <button class="claim ${claimed?'done':(ready?'ready':'')}" ${claimed||!ready?'disabled':''} data-key="${q.key}">${claimed?'완료':'받기'}</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimDaily(q.key));
  });
}

function renderAchievements(){
  const container = document.getElementById('achievementList');
  container.innerHTML = '';
  ACHIEVEMENTS.forEach(a=>{
    const raw = state[a.statKey] || 0;
    const progress = Math.min(raw, a.target);
    const ready = a.check(state);
    const claimed = !!state.achClaims[a.key];
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${a.name}</div>
          <div class="qdesc">${a.desc}</div>
        </div>
        <div class="qreward">${rewardText(a.reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(progress/a.target*100)}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${progress}/${a.target}</span>
        <button class="claim ${claimed?'done':(ready?'ready':'')}" ${claimed||!ready?'disabled':''} data-key="${a.key}">${claimed?'완료':'받기'}</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimAch(a.key));
  });
}

function claimRepeatable(key){
  const q = REPEATABLE_QUESTS.find(x=>x.key===key);
  if(!q) return;
  if(state[q.statKey] < q.target) return;
  state[q.statKey] -= q.target;
  const reward = repeatQuestReward(q);
  applyReward(reward);
  log(`반복 퀘스트 완료: ${q.name} (${rewardText(reward)})`, 'good');
  renderAll();
}

function claimAllRepeatable(){
  let totalClaims = 0;
  const totalReward = {gold:0, soul:0, frag:0};
  REPEATABLE_QUESTS.forEach(q=>{
    const stacks = Math.floor(state[q.statKey] / q.target);
    if(stacks <= 0) return;
    state[q.statKey] -= stacks * q.target;
    totalClaims += stacks;
    const r = repeatQuestReward(q);
    if(r.gold) totalReward.gold += r.gold * stacks;
    if(r.soul) totalReward.soul += r.soul * stacks;
    if(r.frag) totalReward.frag += r.frag * stacks;
  });
  if(totalClaims === 0) return;
  applyReward(totalReward);
  log(`반복 퀘스트 일괄 수령: 총 ${totalClaims}회 (${rewardText(totalReward)})`, 'good');
  renderAll();
}
document.getElementById('claimAllRepeatBtn').addEventListener('click', claimAllRepeatable);

function renderRepeatableQuests(){
  const container = document.getElementById('repeatQuestList');
  container.innerHTML = '';
  let anyReady = false;
  REPEATABLE_QUESTS.forEach(q=>{
    const raw = state[q.statKey];
    const stacks = Math.floor(raw / q.target);
    const displayProgress = raw % q.target;
    const ready = stacks >= 1;
    if(ready) anyReady = true;
    const reward = repeatQuestReward(q);
    const row = document.createElement('div');
    row.className = 'quest-item';
    row.innerHTML = `
      <div class="qhead">
        <div>
          <div class="qname">${q.name}${stacks>1? `<span class="stack">x${stacks} 대기중</span>`:''}</div>
          <div class="qdesc">${q.desc}</div>
        </div>
        <div class="qreward">${rewardText(reward)}</div>
      </div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(ready?100:(displayProgress/q.target*100))}%"></div></div>
      <div class="quest-foot">
        <span class="ptext">${ready? q.target+'/'+q.target : displayProgress+'/'+q.target}</span>
        <button class="claim ${ready?'ready':''}" ${ready?'':'disabled'} data-key="${q.key}">받기</button>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('button').addEventListener('click', ()=>claimRepeatable(q.key));
  });
  const claimAllBtn = document.getElementById('claimAllRepeatBtn');
  if(claimAllBtn) claimAllBtn.disabled = !anyReady;
}

// 전투 화면(아레나) 아래에 표시되는 컴팩트 반복 퀘스트 위젯.
// 이벤트 탭의 renderRepeatableQuests()와 동일한 데이터를 더 작은 카드로 그린다.
function renderCombatRepeatQuests(){
  const container = document.getElementById('combatRepeatQuestList');
  if(!container) return;
  container.innerHTML = '';
  let anyReady = false;
  REPEATABLE_QUESTS.forEach(q=>{
    const raw = state[q.statKey];
    const stacks = Math.floor(raw / q.target);
    const displayProgress = raw % q.target;
    const ready = stacks >= 1;
    if(ready) anyReady = true;
    const reward = repeatQuestReward(q);
    const card = document.createElement('div');
    card.className = 'combat-quest-card'+(ready?' ready':'');
    card.innerHTML = `
      <div class="cq-name">${q.name}${stacks>1? `<span class="stack">x${stacks}</span>`:''}</div>
      <div class="quest-progress-outer"><div class="quest-progress-inner ${ready?'done':''}" style="width:${(ready?100:(displayProgress/q.target*100))}%"></div></div>
      <div class="cq-foot">
        <span class="cq-reward">${rewardText(reward)}</span>
        <button class="claim ${ready?'ready':''}" ${ready?'':'disabled'} data-key="${q.key}">${ready?'받기':'대기'}</button>
      </div>
    `;
    container.appendChild(card);
    card.querySelector('button').addEventListener('click', ()=>claimRepeatable(q.key));
  });
  const claimAllBtn = document.getElementById('combatClaimAllRepeatBtn');
  if(claimAllBtn) claimAllBtn.disabled = !anyReady;
}
document.getElementById('combatClaimAllRepeatBtn')?.addEventListener('click', claimAllRepeatable);

function updateRebirthAvailability(){
  const btn = document.getElementById('rebirthBtn');
  const desc = document.getElementById('rebirthDesc');
  const canRebirth = state.highestFloor >= 15;
  const soulMult = (typeof rebirthSoulMultiplier === 'function') ? rebirthSoulMultiplier() : 1;
  const gainSoul = Math.floor(state.highestFloor / 2.5 * soulMult);
  const gainFrag = Math.floor(state.highestFloor / 3);
  const bonusText = soulMult > 1 ? ` <span style="color:var(--text-dim);font-size:11px;">(혈청 정제 +${Math.round((soulMult-1)*100)}%)</span>` : '';
  btn.disabled = !canRebirth;
  if(canRebirth){
    desc.innerHTML = `최고 도달 층: <b>${state.highestFloor}층</b><br>환생 시 <span style="color:var(--soul)">🧪 ${gainSoul}</span>개의 혈청${bonusText}과 <span style="color:var(--frag)">◈ ${gainFrag}</span>개의 유산 파편을 얻습니다. 층수/레벨/물자 강화는 초기화되지만 영구 강화와 보유 혈청/유산은 유지됩니다.`;
  } else {
    desc.textContent = `15층 이상 도달 시 환생이 가능합니다. (현재 최고: ${state.highestFloor}층)`;
  }
}

document.getElementById('rebirthBtn').addEventListener('click', ()=>{
  if(state.highestFloor < 15) return;
  const soulMult = (typeof rebirthSoulMultiplier === 'function') ? rebirthSoulMultiplier() : 1;
  const gainSoul = Math.floor(state.highestFloor / 2.5 * soulMult);
  const gainFrag = Math.floor(state.highestFloor / 3);
  if(!confirm(`환생하시겠습니까?\n🧪 ${gainSoul}개의 혈청과 ◈ ${gainFrag}개의 유산 파편을 얻고 층수/레벨/물자가 초기화됩니다.`)) return;
  state.soul += gainSoul;
  state.fragments += gainFrag;
  state.rebirthCount++;
  if(!Array.isArray(state.rebirthHistory)) state.rebirthHistory = [];
  state.rebirthHistory.push({
    at: Date.now(),
    order: state.rebirthCount,
    floor: state.highestFloor,
    level: state.level,
    gainSoul,
    gainFrag,
  });
  if(state.rebirthHistory.length > 300) state.rebirthHistory = state.rebirthHistory.slice(-300); // 저장 용량 보호용 상한
  state.level = 1;
  state.exp = 0;
  state.gold = 0;
  state.floor = 1;
  state.killsOnFloor = 0;
  state.highestFloor = 1;
  state.goldUpgrades = {atk:0, def:0, hp:0, goldGain:0, expGain:0, atkSpeed:0};
  state.towerFloor = 1;
  state.towerHighestFloor = 1;
  state.towerRewardsClaimed = {};
  state.towerCleared = false;
  state.htFloor = 1;
  state.htHighestFloor = 1;
  state.htRewardsClaimed = {};
  state.htCleared = false;
  state.mode = 'normal';
  document.getElementById('modeNormalBtn').classList.toggle('active', true);
  document.getElementById('modeTowerBtn').classList.toggle('active', false);
  document.getElementById('arenaTitle').textContent = '폐허';
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  log(`환생 완료! 🧪 ${gainSoul} 혈청, ◈ ${gainFrag} 유산 파편 획득.`, 'good');
  renderAll();
});

// ---------- 환생 이력 (사용자별) ----------
function openRebirthHistory(){
  const user = (typeof fbAuth !== 'undefined') ? fbAuth.currentUser : null;
  const nickname = state.nickname || '닉네임 미설정';
  const idLabel = user ? (user.isAnonymous ? '게스트' : (user.email || 'Google 계정')) : '연결 중...';

  const summaryEl = document.getElementById('rebirthHistorySummary');
  if(summaryEl){
    summaryEl.textContent = `${nickname} (${idLabel}) · 총 환생 횟수: ${state.rebirthCount || 0}회`;
  }

  const history = Array.isArray(state.rebirthHistory) ? state.rebirthHistory : [];
  const bodyEl = document.getElementById('rebirthHistoryBody');
  if(bodyEl){
    if(history.length === 0){
      bodyEl.innerHTML = `<p style="color:var(--text-dim);font-size:13px;">아직 환생 기록이 없습니다. 15층 이상 도달 후 환생하면 여기에 기록됩니다.</p>`;
    } else {
      const rows = history.slice().reverse().map(h => {
        const d = new Date(h.at);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `
          <div class="rebirth-history-row">
            <div class="rhr-order">#${h.order}</div>
            <div class="rhr-mid">
              <div class="rhr-date">${dateStr}</div>
              <div class="rhr-detail">Lv.${h.level||'-'} · 최고 ${h.floor}층 도달</div>
            </div>
            <div class="rhr-gain">🧪 +${h.gainSoul} &nbsp; ◈ +${h.gainFrag}</div>
          </div>`;
      }).join('');
      bodyEl.innerHTML = rows;
    }
  }

  document.getElementById('rebirthHistoryModal').style.display = 'flex';
}
document.getElementById('rebirthHistoryBtn')?.addEventListener('click', openRebirthHistory);


// ===== js/attendance.js =====
function isSameDay(a,b){

const d1=new Date(a);

const d2=new Date(b);

return d1.getFullYear()==d2.getFullYear()
&&d1.getMonth()==d2.getMonth()
&&d1.getDate()==d2.getDate();

}

function renderAttendance(){

const grid=document.getElementById("attendanceGrid");

if(!grid)return;

grid.innerHTML="";

ATTENDANCE_REWARDS.forEach((r,i)=>{

const div=document.createElement("div");

div.className="attendance-card";

if(i<state.attendance.day)
div.classList.add("done");

if(i==state.attendance.day)
div.classList.add("today");

div.innerHTML=`

<div class="attendance-day">${i+1}일</div>

<div>${r.text}</div>

`;

grid.appendChild(div);

});

}

function claimAttendance(){

if(isSameDay(state.attendance.lastClaim,Date.now())){

alert("오늘은 이미 출석했습니다.");

return;

}

const reward=ATTENDANCE_REWARDS[state.attendance.day];

switch(reward.type){

case "gold":

state.gold+=reward.amount;

break;

case "soul":

state.soul+=reward.amount;

break;

case "frag":

state.fragments+=reward.amount;

break;

case "special":

pullRelic();

state.soul+=50;

break;

}

state.attendance.lastClaim=Date.now();

state.attendance.day++;

state.attendance.total=(state.attendance.total||0)+1;

if(state.attendance.day>=7){

state.attendance.day=0;

}

log("📅 출석 보상 획득!", "good");

renderAttendance();

renderAll();

saveState(true);

}

document
.getElementById("attendanceBtn")
.onclick=claimAttendance;
// ===== js/persistence.js =====
document.getElementById('saveBtn').addEventListener('click', ()=>{ saveState(true); });
document.getElementById('resetBtn').addEventListener('click', async ()=>{
  if(!confirm('정말 모든 진행 상황을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  state = defaultState();
  document.getElementById('modeNormalBtn').classList.toggle('active', true);
  document.getElementById('modeTowerBtn').classList.toggle('active', false);
  document.getElementById('arenaTitle').textContent = '폐허';
  const s = stats();
  state.playerHp = s.maxHp;
  spawnMonster();
  renderAll();
  await saveState(true);
  log('게임이 초기화되었습니다.', 'warn');
});

// ---------- Export / Import Logic ----------

// 로드/가져오기 시점에 진행 중이던 부속 전투 콘텐츠를 안전하게 종료 처리한다.
// 탭/브라우저를 닫아 전투가 중단된 채 세이브된 Active 플래그(레이드/월드보스/던전 4종)가 그대로
// 남으면, 이후 모든 부속 전투(레이드/월드보스/물자·유산·단조·수련 구역) 입장이 차단된다.
// 티켓은 이미 소모된 상태로 유지하고, 중단된 전투 상태(체력 등)만 정리한다.
function abortStuckActivities(context){
  const flags = [
    ['레이드','raidActive'], ['월드보스','wbActive'],
    ['물자 구역','gdActive'], ['유산 구역','rdActive'],
    ['단조 구역','fdActive'], ['수련 구역','tdActive'],
  ];
  const stuck = flags.filter(([,k])=>state[k]).map(([name])=>name);
  if(stuck.length > 0){
    log(`${context} 진행 중이던 ${stuck.join('·')}이(가) 중단되어 종료 처리되었습니다.`, 'warn');
  }
  flags.forEach(([,k])=>{ state[k] = false; });
  state.raidBossHp = 0; state.raidBossMaxHp = 0; state.raidPlayerHp = 0;
  state.wbHp = 0; state.wbMaxHp = 0; state.wbPlayerHp = 0; state.wbSessionDamage = 0;
  state.gdMonsterHp = 0; state.gdMonsterMaxHp = 0; state.gdPlayerHp = 0;
  state.rdMonsterHp = 0; state.rdMonsterMaxHp = 0; state.rdPlayerHp = 0;
  state.fdMonsterHp = 0; state.fdMonsterMaxHp = 0; state.fdPlayerHp = 0;
  state.tdMonsterHp = 0; state.tdMonsterMaxHp = 0; state.tdPlayerHp = 0;
}

function processImportedData(jsonStr){
  try{
    const loaded = JSON.parse(jsonStr);
    if(!loaded || typeof loaded !== 'object') return false;
    if(loaded.saveVersion !== SAVE_VERSION){
      alert(`이 세이브 파일은 이전 버전(${loaded.saveVersion || '알 수 없음'})입니다.\n밸런스 개편으로 인해 더 이상 불러올 수 없습니다. 새로 시작해주세요.`);
      return false;
    }
    state = Object.assign(defaultState(), loaded);
    state.goldUpgrades = Object.assign({atk:0,def:0,hp:0,goldGain:0,atkSpeed:0,expGain:0,critChance:0,critDamage:0,accuracy:0}, loaded.goldUpgrades||{});
    state.soulUpgrades = Object.assign({atkMult:0,goldMult:0,defMult:0,expMult:0,dropAdd:0,critDmgAdd:0,accuracyAdd:0}, loaded.soulUpgrades||{});
    state.relics = Object.assign({hpRelic:0,atkRelic:0,defRelic:0,goldRelic:0,expRelic:0,dropRelic:0,spdRelic:0,critDmgRelic:0}, loaded.relics||{});
    state.pets = Object.assign({dragonPet:0,jellyPet:0,crowPet:0,owlPet:0,fairyPet:0,wolfPet:0,lizardPet:0}, loaded.pets||{});
    state.mutation = Object.assign({points:0,totalEarned:0}, loaded.mutation||{}, {nodes: Object.assign({}, (loaded.mutation||{}).nodes||{})});
    state.skills = Object.assign({}, loaded.skills||{});
    state.raidGear = Object.assign({raidWeapon:0,raidArmor:0,raidCrown:0,raidRing:0}, loaded.raidGear||{});
    state.equipment = Object.assign({weapon:null, armor:null, accessory:null}, loaded.equipment||{});
    state.equipInventory = Array.isArray(loaded.equipInventory) ? loaded.equipInventory : [];
    state.equipPullCounts = Object.assign({t1:0,t2:0,t3:0,t4:0,t5:0}, loaded.equipPullCounts||{});
    state.towerRewardsClaimed = loaded.towerRewardsClaimed || {};
    state.htRewardsClaimed = loaded.htRewardsClaimed || {};
    state.claimedGlobalGifts = loaded.claimedGlobalGifts || {};
    state.unlockedTitles = loaded.unlockedTitles || {};
    state.rebirthHistory = Array.isArray(loaded.rebirthHistory) ? loaded.rebirthHistory : [];
    state.attendance = Object.assign({day:0, lastClaim:0, total:0}, loaded.attendance||{});
    abortStuckActivities('가져온 세이브에서');

    document.getElementById('modeNormalBtn').classList.toggle('active', state.mode==='normal');
    document.getElementById('modeTowerBtn').classList.toggle('active', state.mode==='tower');
    document.getElementById('arenaTitle').textContent = state.mode === 'tower' ? '무한의 탑 (100층)' : '폐허';

    const s = stats();
    if(state.playerHp <= 0) state.playerHp = s.maxHp;
    spawnMonster();
    renderAll();
    saveState(false);
    log('세이브 데이터를 성공적으로 가져왔습니다.', 'good');
    alert('세이브 데이터를 성공적으로 불러왔습니다!');
    return true;
  }catch(e){
    alert('유효하지 않은 세이브 데이터 형식입니다.');
    return false;
  }
}

document.getElementById('exportBtn').addEventListener('click', ()=>{
  state.lastSave = Date.now();
  const dataStr = JSON.stringify(state);
  
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `twilight_corridor_save_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(dataStr).then(()=>{
      log('세이브 파일이 다운로드되었으며, 세이브 코드가 클립보드에 복사되었습니다.', 'good');
    }).catch(()=>{
      log('세이브 파일이 다운로드되었습니다.', 'good');
    });
  } else {
    log('세이브 파일이 다운로드되었습니다.', 'good');
  }
});

document.getElementById('importBtn').addEventListener('click', ()=>{
  const choice = confirm('세이브 파일(.json)을 업로드하여 불러오시겠습니까?\n[확인]: 파일 선택 / [취소]: 텍스트 코드 직접 입력');
  if(choice){
    document.getElementById('importFileInput').click();
  } else {
    const code = prompt('내보내기했던 세이브 코드(JSON 텍스트)를 붙여넣으세요:');
    if(code && code.trim()){
      processImportedData(code.trim());
    }
  }
});

document.getElementById('importFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (evt)=>{
    processImportedData(evt.target.result);
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ---------- Persistence ----------
async function saveState(manual){
  state.lastSave = Date.now();
  try{
    const result = await storageSet('save', JSON.stringify(state), manual);
    if(manual) log(result ? '저장 완료.' : '저장 실패. 다시 시도해주세요.', result?'good':'warn');
  }catch(e){
    console.error('save failed', e);
    if(manual) log('저장 실패. 다시 시도해주세요.', 'warn');
  }
}

let wasVersionReset = false; // 버전 불일치로 인한 강제 초기화였는지 여부 (main.js에서 안내 메시지에 사용)

async function loadState(){
  try{
    const result = await storageGet('save');
    if(result && result.value){
      const loaded = JSON.parse(result.value);

      // 버전이 다른(예전) 세이브는 무효화하고 새 게임으로 시작
      if(loaded.saveVersion !== SAVE_VERSION){
        state = defaultState();
        wasVersionReset = true;
        console.log(`세이브 버전 불일치 (저장됨: ${loaded.saveVersion || '없음'}, 현재: ${SAVE_VERSION}) — 새 게임으로 시작합니다.`);
        return false;
      }

      state = Object.assign(defaultState(), loaded);
      state.goldUpgrades = Object.assign({atk:0,def:0,hp:0,goldGain:0,atkSpeed:0,expGain:0,critChance:0,critDamage:0,accuracy:0}, loaded.goldUpgrades||{});
      state.soulUpgrades = Object.assign({atkMult:0,goldMult:0,defMult:0,expMult:0,dropAdd:0,critDmgAdd:0,accuracyAdd:0}, loaded.soulUpgrades||{});
      state.relics = Object.assign({hpRelic:0,atkRelic:0,defRelic:0,goldRelic:0,expRelic:0,dropRelic:0,spdRelic:0,critDmgRelic:0}, loaded.relics||{});
      state.pets = Object.assign({dragonPet:0,jellyPet:0,crowPet:0,owlPet:0,fairyPet:0,wolfPet:0,lizardPet:0}, loaded.pets||{});
      state.mutation = Object.assign({points:0,totalEarned:0}, loaded.mutation||{}, {nodes: Object.assign({}, (loaded.mutation||{}).nodes||{})});
      state.skills = Object.assign({}, loaded.skills||{});
      state.raidGear = Object.assign({raidWeapon:0,raidArmor:0,raidCrown:0,raidRing:0}, loaded.raidGear||{});
      state.equipment = Object.assign({weapon:null, armor:null, accessory:null}, loaded.equipment||{});
      state.equipInventory = Array.isArray(loaded.equipInventory) ? loaded.equipInventory : [];
      state.equipPullCounts = Object.assign({t1:0,t2:0,t3:0,t4:0,t5:0}, loaded.equipPullCounts||{});
      state.towerRewardsClaimed = loaded.towerRewardsClaimed || {};
      state.htRewardsClaimed = loaded.htRewardsClaimed || {};
      state.claimedGlobalGifts = loaded.claimedGlobalGifts || {};
      state.unlockedTitles = loaded.unlockedTitles || {};
      state.rebirthHistory = Array.isArray(loaded.rebirthHistory) ? loaded.rebirthHistory : [];
      state.attendance = Object.assign({day:0, lastClaim:0, total:0}, loaded.attendance||{});
      abortStuckActivities('이전에');
      return true;
    }
  }catch(e){
    console.log('no existing save or load failed', e);
  }
  return false;
}

function computeOfflineProgress(){
  const elapsedMs = Date.now() - (state.lastSave || Date.now());
  const elapsedSec = Math.min(elapsedMs/1000, 4*3600);
  if(elapsedSec < 30) return null;

  const s = stats();
  const killsPerSec = 1000/s.tickMs;
  const currentFloor = state.mode === 'tower' ? state.towerFloor : (state.mode === 'towerHard' ? state.htFloor : state.floor);
  const avgGoldPerKill = goldDropFor(currentFloor, false) * s.goldMult;
  const avgExpPerKill = expDropFor(currentFloor, false) * s.expMult;
  
  const totalKills = Math.floor(killsPerSec * elapsedSec * 0.35);
  const goldGained = Math.round(totalKills * avgGoldPerKill);
  const expGained = Math.round(totalKills * avgExpPerKill);

  state.gold += goldGained;
  state.exp += expGained;
  let levelsGained = 0;
  let needed = expNeeded(state.level);
  while(state.exp >= needed){
    state.exp -= needed;
    state.level++;
    levelsGained++;
    needed = expNeeded(state.level);
  }

  return {elapsedSec, goldGained, expGained, levelsGained, totalKills};
}

function formatDuration(sec){
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  if(h>0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function showOfflineModal(result){
  const modal = document.getElementById('offlineModal');
  const text = document.getElementById('offlineText');
  text.innerHTML = `자리를 비운 <b>${formatDuration(result.elapsedSec)}</b> 동안<br>
    변이체 <span class="num">${result.totalKills}</span>마리를 처치했습니다.<br><br>
    획득: <span class="num">+${result.goldGained.toLocaleString()}📦</span> · <span class="num">+${result.expGained} EXP</span>
    ${result.levelsGained>0? `<br>레벨 업 <span class="num">x${result.levelsGained}</span>!` : ''}`;
  modal.style.display = 'flex';
}
document.getElementById('offlineCloseBtn').addEventListener('click', ()=>{
  document.getElementById('offlineModal').style.display = 'none';
  renderAll();
});
