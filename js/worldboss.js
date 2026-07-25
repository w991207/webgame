// ---------- 월드보스 ----------
// 전 유저가 공유하는 보스 체력 하나를 함께 깎는 컨텐츠 (Firestore worldboss/state 문서 1개 공유).
// 해금 조건: 1인 레이드와 동일 (무한의 탑 100층 클리어)
// 도전 방식: 레이드처럼 1일 1회 입장, 쓰러질 때까지(또는 보스가 죽을 때까지) 자동 전투
// 보상: 내가 그 회차에 실제로 넣은 데미지량에 비례 (킬을 낸 사람에게는 추가 보너스)
// 초기화: 매일 자정(KST) - Firestore 보안 규칙이 서버 시간(request.time) 기준으로 검증하므로
//         클라이언트 시계를 조작해도 실제 초기화 타이밍은 위조할 수 없음.
//
// ⚠️ 최초 1회, Firebase 콘솔에서 worldboss/state 문서를 직접 만들어야 합니다:
//    컬렉션 'worldboss' > 문서 ID 'state' > 필드: hp(숫자), maxHp(숫자, hp와 동일한 값), resetDate(숫자, 0)
//    (resetDate를 0으로 두면 접속한 유저가 처음 열었을 때 자동으로 오늘 날짜로 리셋되며 시작합니다)

const WORLD_BOSS_META = {name:'멸망을 고하는 태초종, 아스모드', emoji:'👹'};
const WB_ATK = 1400;
const WB_DEF = 220;
const WB_GOLD_PER_DMG = 0.6;
const WB_FRAG_PER_DMG = 1/250;
const WB_KILL_BONUS_GOLD = 5000;
const WB_KILL_BONUS_FRAG = 50;

let wbPlayerTickHandle = null;
let wbMonsterTickHandle = null;
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
      const fresh = {hp: d.maxHp, maxHp: d.maxHp, resetDate: day};
      tx.update(ref, fresh);
      return fresh;
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
  if(state.raidActive || state.gdActive || state.rdActive){
    alert('다른 전투(레이드/골드 던전/유물 던전) 진행 중에는 월드보스에 도전할 수 없습니다.');
    return;
  }
  const day = wbDayId();
  if(state.wbLastEnterDay === day){
    alert('오늘은 이미 월드보스에 도전했습니다. 내일 자정(00:00)에 다시 도전할 수 있습니다.');
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
  if(bossDoc.hp <= 0){
    alert('오늘의 월드보스는 이미 다른 모험가들에게 쓰러졌습니다! 내일 자정에 다시 부활합니다.');
    wbStatusCache = bossDoc;
    renderWorldBossPanel();
    return;
  }
  if(!confirm(`${WORLD_BOSS_META.name}에게 도전하시겠습니까?\n하루에 한 번만 도전할 수 있으며, 쓰러질 때까지(또는 보스가 죽을 때까지) 자동으로 전투가 진행됩니다.\n입힌 데미지량에 비례해 보상을 받습니다.`)) return;

  state.wbLastEnterDay = day;
  state.wbActive = true;
  state.wbMaxHp = bossDoc.maxHp;
  state.wbHp = bossDoc.hp;
  state.wbSessionDamage = 0;
  state.wbGotKillingBlow = false;
  const s = stats();
  state.wbPlayerHp = s.maxHp;

  // 월드보스 동안 메인 전투 루프는 일시 정지
  clearTimeout(playerTickHandle);
  clearTimeout(monsterTickHandle);

  log(`${WORLD_BOSS_META.emoji} [월드보스] ${WORLD_BOSS_META.name}에게 도전합니다! (전 유저 공유 체력 ${Math.ceil(state.wbHp).toLocaleString()} / ${state.wbMaxHp.toLocaleString()})`, 'new');
  renderAll();
  scheduleWbPlayerTick();
  scheduleWbMonsterTick();
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
  state.wbActive = false;
  clearTimeout(wbPlayerTickHandle);
  clearTimeout(wbMonsterTickHandle);

  const dmg = Math.round(state.wbSessionDamage);
  const goldGain = Math.round(dmg * WB_GOLD_PER_DMG);
  let fragGain = Math.round(dmg * WB_FRAG_PER_DMG);
  let bonusMsg = '';
  if(state.wbGotKillingBlow){
    fragGain += WB_KILL_BONUS_FRAG;
    state.gold += WB_KILL_BONUS_GOLD;
    bonusMsg = ` (처치 보너스 🪙${WB_KILL_BONUS_GOLD.toLocaleString()} ◈${WB_KILL_BONUS_FRAG} 포함)`;
  }
  state.gold += goldGain;
  state.fragments += fragGain;

  if(dmg > 0){
    log(`🎁 [월드보스] 오늘 입힌 피해 ${dmg.toLocaleString()} 기준 보상: 🪙${goldGain.toLocaleString()} ◈${fragGain}${bonusMsg}`, 'good');
  }

  // 리더보드용 일일 누적 데미지 기록 (실패해도 이미 지급된 로컬 보상엔 영향 없음)
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
  const alreadyEntered = state.wbLastEnterDay === day;

  const kstNow = Date.now() + 9*3600*1000;
  const msLeft = 86400000 - (kstNow % 86400000);
  const timerEl = document.getElementById('wbResetTimer');
  if(timerEl) timerEl.textContent = `초기화까지 ${wbFormatCountdown(msLeft)}`;

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
    enterBtn.disabled = state.wbActive || alreadyEntered || bossDead;
    if(state.wbActive) enterBtn.textContent = '전투 진행 중...';
    else if(bossDead) enterBtn.textContent = '오늘의 보스는 이미 쓰러짐';
    else if(alreadyEntered) enterBtn.textContent = '오늘은 이미 도전함';
    else enterBtn.textContent = `${WORLD_BOSS_META.emoji} 월드보스 도전 (1일 1회)`;
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
