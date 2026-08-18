// ---------- 월드보스 ----------
// 전 유저가 공유하는 보스 체력 하나를 함께 깎는 컨텐츠 (Firestore worldboss/state 문서 1개 공유).
// 해금 조건: 1인 레이드와 동일 (무한의 탑 100층 클리어)
// 도전 방식: 개인당 4시간마다 입장 가능, 제한시간 1분(또는 쓰러질 때까지/보스가 죽을 때까지) 자동 전투
// 보상: 내가 그 회차에 실제로 넣은 데미지량에 비례 (킬을 낸 사람에게는 추가 보너스)
// 보스 체력 초기화: 매일 자정(KST) - Firestore 보안 규칙이 서버 시간(request.time) 기준으로 검증하므로
//         클라이언트 시계를 조작해도 실제 초기화 타이밍은 위조할 수 없음.
//         (개인 도전 쿨타임 4시간은 보스 체력 초기화와는 별개로 독립적으로 동작함)
//
// ⚠️ 최초 1회, Firebase 콘솔에서 worldboss/state 문서를 직접 만들어야 합니다:
//    컬렉션 'worldboss' > 문서 ID 'state' > 필드:
//      - hp(숫자), maxHp(숫자, hp와 동일한 값), resetDate(숫자, 0)
//      - manualResetAt(숫자, 0) ← 전 유저 도전 기록 강제 초기화용 (아래 설명)
//    (resetDate를 0으로 두면 접속한 유저가 처음 열었을 때 자동으로 오늘 날짜로 리셋되며 시작합니다)
//
// 🔧 관리자가 "전 유저 도전 기록"을 마음대로 초기화하고 싶을 때:
//    Firebase 콘솔 > Firestore > worldboss/state 문서 > manualResetAt 필드 값을
//    "현재 시각의 밀리초 타임스탬프"로 바꿔서 저장하면 됩니다.
//    (브라우저 콘솔에서 Date.now()를 입력하면 바로 그 값이 나옵니다)
//    이 값보다 이전에 도전한 유저는 전부 즉시 재도전 가능해집니다 — 즉, 4시간 쿨타임과 무관하게
//    "지금 이 순간부터 전원 재도전 가능"하게 만드는 스위치입니다.
//    참고: 이 필드를 고쳐도 보스의 공유 체력(hp)은 그대로입니다. 체력까지 같이 리셋하고 싶다면
//    hp 필드를 maxHp와 같은 값으로 함께 바꿔주세요.

const WORLD_BOSS_META = {name:'창세의 균주, 제로', emoji:'🧟'};
const WB_ATK = 10000;
const WB_DEF = 5000;
const WB_TIME_LIMIT_MS = 60 * 1000; // 도전 1회당 제한시간 1분
const WB_COOLDOWN_MS = 4 * 3600 * 1000; // 개인 도전 쿨타임 (4시간마다 재도전 가능)
const WB_KILL_BONUS_GOLD = 5000;
const WB_KILL_BONUS_FRAG = 50;

// 데미지량이 아니라 "오늘 이 시점까지의 내 순위"로 보상을 고정 지급한다.
// (캐릭터 스탯이 앞으로 얼마나 커지든 보상 액수가 같이 폭증하지 않도록 데미지와 완전히 분리함)
// maxRank: 이 순위 이하일 때 해당 보상을 받음. 배열 순서대로 검사하므로 오름차순 유지 필요.
const WB_RANK_REWARDS = [
  {maxRank:1,        gold:8000, frag:80, soul:3},
  {maxRank:3,        gold:5000, frag:50, soul:2},
  {maxRank:10,       gold:3000, frag:30, soul:1},
  {maxRank:30,       gold:1500, frag:15, soul:0},
  {maxRank:Infinity, gold:500,  frag:5,  soul:0}, // 31위 이하 참여 보상
];
function wbRewardForRank(rank){
  const tier = WB_RANK_REWARDS.find(t => rank <= t.maxRank) || WB_RANK_REWARDS[WB_RANK_REWARDS.length-1];
  return {...tier}; // 원본 상수 객체를 나중에 실수로 변형하지 않도록 항상 복사본을 반환
}

let wbPlayerTickHandle = null;
let wbMonsterTickHandle = null;
let wbTimeLimitHandle = null;
let wbStatusCache = null; // 전투 중이 아닐 때 화면에 보여줄, 마지막으로 받아온 서버 상태
let wbLeaderboard = [];

function worldBossUnlocked(){
  return state.towerHighestFloor >= 100;
}

// 한국시간(KST) 기준 "며칠째"를 나타내는 정수. Firestore 보안 규칙의 todayId()와 동일한 공식.
function wbDayId(){
  return Math.floor((Date.now() + 9*3600*1000) / 86400000);
}

function wbFormatCountdown(ms){
  const totalSec = Math.max(0, Math.ceil(ms/1000));
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const sec = totalSec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// 날짜가 바뀌었으면 트랜잭션으로 안전하게 리셋하고, 그렇지 않으면 현재 값을 그대로 반환
async function ensureWorldBossFreshAndGet(){
  const ref = fbDb.collection('worldboss').doc('state');
  return await fbDb.runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) return null;
    const d = snap.data();
    const day = wbDayId();
    if((d.resetDate||0) < day){
      // 주의: manualResetAt은 여기서 절대 쓰지 않는다 (보안 규칙이 클라이언트의 hp/maxHp/resetDate
      // 변경만 허용하도록 diff 기반으로 검증하므로, 굳이 넣지 않아도 문서에 남아있던 값은 그대로 유지된다)
      const freshWrite = {hp: d.maxHp, maxHp: d.maxHp, resetDate: day};
      tx.update(ref, freshWrite);
      return {...freshWrite, manualResetAt: d.manualResetAt||0};
    }
    return d;
  });
}

async function enterWorldBoss(){
  if(!worldBossUnlocked()){
    alert('무한의 탑 100층을 클리어해야 월드보스에 도전할 수 있습니다.');
    return;
  }
  if(state.wbActive) return;
  if(anySubActivityActive('wbActive')){
    alert('다른 전투 콘텐츠가 진행 중에는 월드보스에 도전할 수 없습니다.');
    return;
  }
  const user = fbAuth.currentUser;
  if(!user){
    alert('로그인 후 이용할 수 있습니다.');
    return;
  }

  let bossDoc;
  try{
    bossDoc = await ensureWorldBossFreshAndGet();
  }catch(e){
    console.warn('월드보스 정보 조회 실패', e);
    alert('월드보스 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  if(!bossDoc){
    alert('월드보스가 아직 준비되지 않았습니다. (관리자 설정이 필요합니다)');
    return;
  }

  // 개인 도전 쿨타임 체크 (4시간마다 재도전 가능).
  // 단, 관리자가 worldboss/state 문서의 manualResetAt을 현재시각(또는 그 이후)으로 갱신해두면
  // 마지막 도전 시각이 그보다 이전인 모든 유저는 쿨타임과 무관하게 즉시 재도전 가능해진다
  // → 이 값을 콘솔에서 바꾸는 것만으로 "전 유저 도전 기록 강제 초기화"가 가능.
  const manualResetAt = bossDoc.manualResetAt || 0;
  const lastEnter = state.wbLastEnterAt || 0;
  const cooldownEndsAt = (lastEnter < manualResetAt) ? 0 : (lastEnter + WB_COOLDOWN_MS);
  if(Date.now() < cooldownEndsAt){
    alert(`아직 도전 쿨타임입니다. (남은 시간: ${wbFormatCountdown(cooldownEndsAt - Date.now()).slice(3)})`);
    renderWorldBossPanel();
    return;
  }

  if(bossDoc.hp <= 0){
    alert('오늘의 월드보스는 이미 다른 모험가들에게 쓰러졌습니다! 내일 자정에 다시 부활합니다.');
    wbStatusCache = bossDoc;
    renderWorldBossPanel();
    return;
  }
  if(!confirm(`${WORLD_BOSS_META.name}에게 도전하시겠습니까?\n제한시간 1분 동안(또는 쓰러질 때까지) 자동으로 전투가 진행됩니다.\n입힌 데미지량에 비례해 보상을 받으며, 재도전은 ${WB_COOLDOWN_MS/3600000}시간 후 가능합니다.`)) return;

  state.wbLastEnterAt = Date.now();
  state.wbActive = true;
  state.wbMaxHp = bossDoc.maxHp;
  state.wbHp = bossDoc.hp;
  state.wbSessionDamage = 0;
  state.wbGotKillingBlow = false;
  state.wbEnterTime = Date.now();
  const s = stats();
  state.wbPlayerHp = s.maxHp;

  // 월드보스 동안 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`${WORLD_BOSS_META.emoji} [월드보스] ${WORLD_BOSS_META.name}에게 도전합니다! (제한시간 1분, 전 유저 공유 체력 ${Math.ceil(state.wbHp).toLocaleString()} / ${state.wbMaxHp.toLocaleString()})`, 'new');
  renderAll();
  scheduleWbPlayerTick();
  scheduleWbMonsterTick();

  clearTimeout(wbTimeLimitHandle);
  wbTimeLimitHandle = setTimeout(()=>{
    if(!state.wbActive) return;
    log(`⏰ [월드보스] 제한시간(1분)이 종료되었습니다. 지금까지 입힌 피해만큼 보상을 받습니다.`, 'warn');
    finalizeWorldBossSession();
  }, WB_TIME_LIMIT_MS);
}

function scheduleWbPlayerTick(){
  const s = stats();
  clearTimeout(wbPlayerTickHandle);
  wbPlayerTickHandle = setTimeout(wbPlayerAttackTick, s.tickMs);
}
function scheduleWbMonsterTick(){
  clearTimeout(wbMonsterTickHandle);
  wbMonsterTickHandle = setTimeout(wbMonsterAttackTick, 1000);
}

async function wbPlayerAttackTick(){
  if(!state.wbActive) return;
  const s = stats();
  let dmg = Math.round(Math.max(1, s.atk - WB_DEF));
  const isCrit = Math.random()*100 < s.critChance;
  if(isCrit){
    dmg = Math.round(dmg * s.critDamageMult);
    floatText('CRIT! -'+dmg, 'crit');
  } else {
    floatText('-'+dmg, null);
  }

  const ref = fbDb.collection('worldboss').doc('state');
  let outcome;
  try{
    outcome = await fbDb.runTransaction(async (tx)=>{
      const snap = await tx.get(ref);
      const d = snap.data();
      if(!d || d.hp <= 0) return {alreadyDead:true};
      const applied = Math.min(dmg, d.hp);
      const newHp = d.hp - applied;
      tx.update(ref, {hp:newHp, maxHp:d.maxHp, resetDate:d.resetDate});
      return {alreadyDead:false, applied, newHp, maxHp:d.maxHp, killed:newHp<=0};
    });
  }catch(e){
    console.warn('월드보스 공격 반영 실패, 재시도합니다', e);
    if(state.wbActive) scheduleWbPlayerTick();
    return;
  }

  if(!state.wbActive) return; // 응답이 오는 사이 전투가 이미 종료된 경우 (사망 등) 무시

  if(outcome.alreadyDead){
    log(`⚔️ [월드보스] 다른 모험가들이 먼저 보스를 처치했습니다! 지금까지 입힌 피해만큼 보상을 받습니다.`, 'warn');
    finalizeWorldBossSession();
    return;
  }

  state.wbHp = outcome.newHp;
  state.wbMaxHp = outcome.maxHp;
  state.wbSessionDamage += outcome.applied;

  if(outcome.killed){
    state.wbGotKillingBlow = true;
    log(`🏆 [월드보스] ${WORLD_BOSS_META.name}에게 마지막 일격을 꽂았습니다! 오늘의 월드보스를 처치했습니다!`, 'good');
    finalizeWorldBossSession();
    return;
  }
  renderAll();
  scheduleWbPlayerTick();
}

function wbMonsterAttackTick(){
  if(!state.wbActive) return;
  const s = stats();
  const dmg = Math.round(Math.max(1, WB_ATK - s.def));
  state.wbPlayerHp -= dmg;
  floatText('-'+dmg, 'dmgToPlayer');

  if(state.wbPlayerHp <= 0){
    log(`💀 [월드보스] 쓰러졌습니다. 지금까지 입힌 피해는 그대로 보상에 반영됩니다.`, 'warn');
    finalizeWorldBossSession();
    return;
  }
  renderAll();
  scheduleWbMonsterTick();
}

async function finalizeWorldBossSession(){
  if(!state.wbActive) return; // 이미 종료 처리된 세션에 대해 중복 실행 방지 (타임아웃과 사망 등 여러 경로가 겹칠 수 있음)
  state.wbActive = false;
  clearTimeout(wbPlayerTickHandle);
  clearTimeout(wbMonsterTickHandle);
  clearTimeout(wbTimeLimitHandle);

  const dmg = Math.round(state.wbSessionDamage);

  // 데미지에 비례한 즉시 보상은 지급하지 않는다 — 자정(KST)이 지나 그날의 순위가
  // 완전히 확정된 뒤, checkWorldBossDailyRewards()가 "최종 순위" 기준으로 확정 지급한다.
  // 막타(킬) 보너스는 순위와 무관한 그 순간의 성과이므로 즉시 지급.
  if(state.wbGotKillingBlow){
    state.gold += WB_KILL_BONUS_GOLD;
    state.fragments += WB_KILL_BONUS_FRAG;
    log(`⚔️ [월드보스] 처치 보너스! 📦${WB_KILL_BONUS_GOLD.toLocaleString()} ◈${WB_KILL_BONUS_FRAG} (순위 보상은 자정 이후 확정 지급됩니다)`, 'good');
  }
  if(dmg > 0){
    log(`🎁 [월드보스] 오늘 입힌 피해 ${dmg.toLocaleString()} 기록됨. 오늘의 최종 순위 보상은 내일 접속 시 확정되어 지급됩니다.`, 'good');
  }

  // 리더보드/일일 순위 산정용 누적 데미지 기록
  try{
    const user = fbAuth.currentUser;
    if(user && dmg > 0){
      const day = wbDayId();
      const ref = fbDb.collection('worldboss_damage').doc(String(day)).collection('hits').doc(user.uid);
      await fbDb.runTransaction(async (tx)=>{
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data().damage||0) : 0;
        tx.set(ref, {
          uid: user.uid,
          nickname: state.nickname || '익명',
          dayId: day,
          damage: prev + dmg,
          updatedAt: Date.now(),
        });
      });
    }
  }catch(e){
    console.warn('월드보스 데미지 랭킹 기록 실패', e);
  }

  // 메인 전투 루프 재개
  schedulePlayerTick();
  scheduleMonsterTick();
  renderAll();
  if(typeof saveState === 'function') saveState(false);
  fetchWorldBossLeaderboard();
}

// ---------- 일일 순위 보상 확정 지급 ----------
// 자정(KST)이 지나면 그 날짜의 데미지 기록엔 더 이상 아무도 쓰지 않으므로, 그 시점부터
// "어제(혹은 그 이전) 날짜"의 순위는 이미 확정된 것으로 본다. 각자 접속할 때 자기 uid로만
// 조회/지급하므로 다른 유저의 문서를 건드릴 필요가 없어 보안 규칙 변경 없이 동작한다.
async function settleWorldBossDayReward(day){
  const user = fbAuth.currentUser;
  if(!user) return;
  try{
    const myRef = fbDb.collection('worldboss_damage').doc(String(day)).collection('hits').doc(user.uid);
    const mySnap = await myRef.get();
    if(!mySnap.exists) return; // 그날 참여하지 않았으면 보상 없음
    const myDamage = mySnap.data().damage || 0;
    if(myDamage <= 0) return;

    const allSnap = await fbDb.collection('worldboss_damage').doc(String(day)).collection('hits')
      .orderBy('damage', 'desc').get();
    let rank = null;
    let i = 0;
    allSnap.forEach(doc => {
      i++;
      if(doc.id === user.uid) rank = i;
    });
    if(!rank) rank = allSnap.size || 1;

    const reward = wbRewardForRank(rank);
    state.gold += reward.gold;
    state.fragments += reward.frag;
    if(reward.soul) state.soul += reward.soul;
    log(`🏆 [월드보스] ${day}일자 최종 ${rank}위 확정! 보상: 📦${reward.gold.toLocaleString()} ◈${reward.frag}${reward.soul?` 🧪${reward.soul}`:''}`, 'good');
  }catch(e){
    console.warn(`월드보스 ${day}일자 순위 보상 정산 실패`, e);
  }
}

async function checkWorldBossDailyRewards(){
  const user = fbAuth.currentUser;
  if(!user) return;
  const today = wbDayId();
  // 한 번도 정산한 적 없는 유저는 "어제부터"만 정산 대상으로 삼는다 (과거 무한 소급 방지)
  let lastClaimed = (state.wbLastRewardClaimedDay || (today - 1));
  let anySettled = false;
  for(let day = lastClaimed + 1; day < today; day++){
    await settleWorldBossDayReward(day);
    state.wbLastRewardClaimedDay = day;
    anySettled = true;
  }
  if(anySettled){
    renderAll();
    if(typeof saveState === 'function') saveState(false);
  }
}

// ---------- 상태 조회 / 리더보드 (전투 중이 아닐 때 화면 표시용) ----------
async function fetchWorldBossStatus(){
  try{
    const snap = await fbDb.collection('worldboss').doc('state').get();
    if(snap.exists) wbStatusCache = snap.data();
  }catch(e){
    console.warn('월드보스 상태 조회 실패', e);
  }
  if(!state.wbActive) renderWorldBossPanel();
}

async function fetchWorldBossLeaderboard(){
  try{
    const day = wbDayId();
    const snap = await fbDb.collection('worldboss_damage').doc(String(day)).collection('hits')
      .orderBy('damage', 'desc').limit(20).get();
    wbLeaderboard = [];
    snap.forEach(doc => wbLeaderboard.push(doc.data()));
  }catch(e){
    console.warn('월드보스 랭킹 조회 실패', e);
  }
  renderWorldBossPanel();
}

function startWorldBossSync(){
  fetchWorldBossStatus();
  fetchWorldBossLeaderboard();
  checkWorldBossDailyRewards(); // 접속 시점에 정산 안 된 지난 날짜 순위 보상이 있으면 확정 지급
  setInterval(fetchWorldBossStatus, 15000);
  setInterval(fetchWorldBossLeaderboard, 30000);
}

function renderWorldBossPanel(){
  const lockedBox = document.getElementById('wbLockedBox');
  const unlockedBox = document.getElementById('wbUnlockedBox');
  if(!lockedBox || !unlockedBox) return;

  const unlocked = worldBossUnlocked();
  if(!unlocked){
    lockedBox.style.display = 'block';
    unlockedBox.style.display = 'none';
    const p = document.getElementById('wbLockProgress');
    if(p) p.textContent = state.towerHighestFloor;
    return;
  }
  lockedBox.style.display = 'none';
  unlockedBox.style.display = 'block';

  const day = wbDayId();

  const kstNow = Date.now() + 9*3600*1000;
  const msLeft = 86400000 - (kstNow % 86400000);
  const timerEl = document.getElementById('wbResetTimer');
  if(timerEl) timerEl.textContent = `보스 체력 초기화까지 ${wbFormatCountdown(msLeft)}`;

  // 개인 도전 쿨타임 (4시간) — 관리자가 manualResetAt을 갱신하면 모든 유저가 즉시 재도전 가능해짐
  const manualResetAt = (wbStatusCache && wbStatusCache.manualResetAt) || 0;
  const lastEnter = state.wbLastEnterAt || 0;
  const cooldownEndsAt = (lastEnter < manualResetAt) ? 0 : (lastEnter + WB_COOLDOWN_MS);
  const onCooldown = Date.now() < cooldownEndsAt;
  const cdEl = document.getElementById('wbCooldownText');
  if(cdEl){
    cdEl.textContent = onCooldown
      ? `다음 도전까지 ${wbFormatCountdown(cooldownEndsAt - Date.now()).slice(3)}`
      : '지금 도전 가능!';
    cdEl.style.color = onCooldown ? 'var(--text-dim)' : 'var(--gold)';
  }

  const dispHp = state.wbActive ? state.wbHp : (wbStatusCache ? wbStatusCache.hp : null);
  const dispMax = state.wbActive ? state.wbMaxHp : (wbStatusCache ? wbStatusCache.maxHp : null);
  const bossDead = dispHp !== null && dispHp <= 0;

  const hpBar = document.getElementById('wbBossHpBar');
  const hpText = document.getElementById('wbBossHpText');
  if(dispHp !== null && dispMax){
    const pct = Math.max(0, dispHp/dispMax*100);
    if(hpBar) hpBar.style.width = pct+'%';
    if(hpText) hpText.textContent = `${Math.max(0,Math.ceil(dispHp)).toLocaleString()} / ${dispMax.toLocaleString()}`;
  } else {
    if(hpBar) hpBar.style.width = '0%';
    if(hpText) hpText.textContent = '불러오는 중...';
  }

  const enterBtn = document.getElementById('wbEnterBtn');
  if(enterBtn){
    enterBtn.disabled = state.wbActive || onCooldown || bossDead;
    if(state.wbActive) enterBtn.textContent = '전투 진행 중...';
    else if(bossDead) enterBtn.textContent = '오늘의 보스는 이미 쓰러짐';
    else if(onCooldown) enterBtn.textContent = '쿨타임 중';
    else enterBtn.textContent = `${WORLD_BOSS_META.emoji} 월드보스 도전`;
  }

  const battleBox = document.getElementById('wbBattleBox');
  if(battleBox){
    if(state.wbActive){
      battleBox.style.display = 'block';
      const s = stats();
      const pPct = Math.max(0, state.wbPlayerHp/s.maxHp*100);
      const pHpBar = document.getElementById('wbPlayerHpBar');
      const pHpText = document.getElementById('wbPlayerHpText');
      if(pHpBar) pHpBar.style.width = pPct+'%';
      if(pHpText) pHpText.textContent = `${Math.max(0,Math.ceil(state.wbPlayerHp))} / ${s.maxHp}`;
      const dmgText = document.getElementById('wbSessionDmgText');
      if(dmgText) dmgText.textContent = Math.round(state.wbSessionDamage).toLocaleString();
      const timeLeftEl = document.getElementById('wbTimeLeftText');
      if(timeLeftEl){
        const remain = Math.max(0, WB_TIME_LIMIT_MS - (Date.now() - (state.wbEnterTime||Date.now())));
        timeLeftEl.textContent = wbFormatCountdown(remain).slice(3); // 시간 부분(00:) 제거하고 mm:ss만 표시
      }
    } else {
      battleBox.style.display = 'none';
    }
  }

  const lbEl = document.getElementById('wbLeaderboardList');
  if(lbEl){
    const myUid = fbAuth.currentUser && fbAuth.currentUser.uid;
    if(!wbLeaderboard.length){
      lbEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">아직 오늘 데미지를 넣은 모험가가 없습니다.</div>';
    } else {
      lbEl.innerHTML = wbLeaderboard.map((d,i)=>`
        <div class="ranking-row${d.uid===myUid ? ' me' : ''}">
          <span class="rk-rank">#${i+1}</span>
          <span class="rk-name">${escapeHtml(d.nickname || '익명')}</span>
          <span class="rk-cp">💥${Math.round(d.damage||0).toLocaleString()}</span>
        </div>
      `).join('');
    }
  }
}

document.getElementById('wbEnterBtn')?.addEventListener('click', enterWorldBoss);

// 카운트다운/상태 표시 갱신용 (해금 전에는 스킵)
setInterval(()=>{
  if(!worldBossUnlocked()) return;
  renderWorldBossPanel();
}, 1000);