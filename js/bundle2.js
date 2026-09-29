// ===== js/firebase-config.js =====
// ⚠️ 이 파일은 반드시 본인의 Firebase 프로젝트 값으로 교체해야 로그인/랭킹 기능이 동작합니다.
//
// 설정 방법:
// 1. https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
// 2. 왼쪽 메뉴 [Authentication] > [Sign-in method] 에서 다음 3개를 '사용 설정'으로 켭니다:
//      - 익명(Anonymous)
//      - 이메일/비밀번호(Email/Password)
//      - Google
// 3. 왼쪽 메뉴 [Firestore Database] > [데이터베이스 만들기] 로 Firestore를 생성합니다 (프로덕션 모드 권장).
//    생성 후 [규칙] 탭에서 이 프로젝트에 포함된 firestore.rules 내용을 붙여넣고 [게시]하세요.
// 4. [프로젝트 설정](톱니바퀴 아이콘) > 하단 '내 앱'에서 웹 앱(</>)을 추가하면
//    아래와 형태가 같은 firebaseConfig 값이 발급됩니다. 그 값을 아래에 그대로 붙여넣으세요.
const firebaseConfig = {
  apiKey: "AIzaSyBeXLaP_WVnN-p0YVP9J-pcJFBhBsEPod8",
  authDomain: "webgame-f0b44.firebaseapp.com",
  projectId: "webgame-f0b44",
  storageBucket: "webgame-f0b44.firebasestorage.app",
  messagingSenderId: "477604575330",
  appId: "1:477604575330:web:c10fd1c066cc6cf990f93b",
  measurementId: "G-89RKMSQF9C"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();

// ===== js/auth.js =====
// ---------- Auth (Firebase 로그인 시스템) ----------
// 전략: 모든 방문자를 즉시 '익명(Anonymous) 로그인' 시켜 Firebase uid를 부여한다.
// 이렇게 하면 로그인 없이 플레이해도 세이브가 그 uid로 클라우드에 자동 백업되고,
// 나중에 이메일/Google 계정으로 "전환(linkWithCredential)"하면 uid가 그대로 유지되어
// 데이터 이전 코드 없이도 기존 진행 상황이 그대로 새 계정에 연결된다.

const LAST_UID_KEY = 'twilight-corridor-last-uid';

function authErrorMessage(e){
  const map = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 아래 로그인을 이용해주세요.',
    'auth/invalid-email': '올바르지 않은 이메일 형식입니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/wrong-password': '비밀번호가 일치하지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/credential-already-in-use': '이미 다른 계정에 연결된 정보입니다.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
  };
  return map[e.code] || ('오류: ' + e.message);
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ---------- 클라우드 세이브 저장/불러오기 ----------
// saves/{uid} 문서에 세이브 전체를 JSON 문자열 그대로 저장한다 (내보내기/가져오기와 동일한 포맷).
// 로컬(localStorage)은 5초마다 계속 저장하지만, 클라우드는 Firestore 무료 할당량(일일 쓰기 2만 회)을
// 아끼기 위해 최소 간격을 두고 저장한다. 수동 저장/창 닫기 등 중요한 시점에는 강제로 즉시 기록한다.
let lastCloudPushAt = 0;
const CLOUD_PUSH_MIN_INTERVAL = 30000; // 이 시간(ms) 안에는 강제(force)가 아니면 다시 쓰지 않음

async function cloudPushSave(jsonStr, force){
  const user = fbAuth.currentUser;
  if(!user) return;
  const now = Date.now();
  if(!force && now - lastCloudPushAt < CLOUD_PUSH_MIN_INTERVAL) return;
  lastCloudPushAt = now;
  try{
    await fbDb.collection('saves').doc(user.uid).set({
      data: jsonStr,
      updatedAt: now,
    });
  }catch(e){
    console.warn('클라우드 저장 실패', e);
  }
}

async function cloudPullSave(uid){
  try{
    const doc = await fbDb.collection('saves').doc(uid).get();
    if(doc.exists) return doc.data();
  }catch(e){
    console.warn('클라우드 불러오기 실패', e);
  }
  return null;
}

// ---------- 계정 패널 렌더링 ----------
function renderAccountPanel(user){
  const statusText = document.getElementById('accountStatusText');
  const upgradeBox = document.getElementById('accountUpgradeBox');
  const loginBox = document.getElementById('accountLoginBox');
  const loggedInBox = document.getElementById('accountLoggedInBox');
  if(!statusText) return;

  if(!user){
    statusText.textContent = '🔌 연결 중...';
    return;
  }

  if(user.isAnonymous){
    statusText.textContent = '👤 게스트로 플레이 중 (이 브라우저에만 저장됨)';
    if(upgradeBox) upgradeBox.style.display = 'block';
    if(loginBox) loginBox.style.display = 'block';
    if(loggedInBox) loggedInBox.style.display = 'none';
  } else {
    const providerId = user.providerData[0] && user.providerData[0].providerId;
    const label = user.email || (providerId === 'google.com' ? 'Google 계정' : '계정');
    statusText.textContent = `✅ ${label} 로 로그인됨 — 데이터가 계정에 안전하게 백업됩니다`;
    if(upgradeBox) upgradeBox.style.display = 'none';
    if(loginBox) loginBox.style.display = 'none';
    if(loggedInBox) loggedInBox.style.display = 'block';
  }

  const nicknameInput = document.getElementById('nicknameInput');
  if(nicknameInput && document.activeElement !== nicknameInput){
    nicknameInput.value = state.nickname || '';
  }

  const titleTextEl = document.getElementById('accountTitleText');
  if(titleTextEl){
    const t = state.equippedTitle && typeof TITLES !== 'undefined' ? TITLES.find(x=>x.key===state.equippedTitle) : null;
    titleTextEl.textContent = t ? `현재 칭호: ${t.icon} ${t.name}` : '현재 칭호: 없음';
  }
}

// ---------- 로그인 게이트 표시/숨김 ----------
function showAuthGate(){
  const gate = document.getElementById('authGateOverlay');
  const wrap = document.getElementById('mainWrap');
  if(gate) gate.style.display = 'flex';
  if(wrap) wrap.style.display = 'none';
}
function hideAuthGate(){
  const gate = document.getElementById('authGateOverlay');
  const wrap = document.getElementById('mainWrap');
  if(gate) gate.style.display = 'none';
  if(wrap) wrap.style.display = '';
}
function showGateError(msg){
  const el = document.getElementById('gateError');
  if(!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function clearGateError(){
  const el = document.getElementById('gateError');
  if(el) el.style.display = 'none';
}
function setGateButtonsDisabled(disabled){
  ['gateLoginBtn','gateSignupBtn','gateGoogleBtn','gateGuestBtn'].forEach(id=>{
    const btn = document.getElementById(id);
    if(btn) btn.disabled = disabled;
  });
}

document.getElementById('gateTabLogin')?.addEventListener('click', () => {
  document.getElementById('gateTabLogin').classList.add('active');
  document.getElementById('gateTabSignup').classList.remove('active');
  document.getElementById('gateLoginForm').style.display = 'flex';
  document.getElementById('gateSignupForm').style.display = 'none';
  clearGateError();
});
document.getElementById('gateTabSignup')?.addEventListener('click', () => {
  document.getElementById('gateTabSignup').classList.add('active');
  document.getElementById('gateTabLogin').classList.remove('active');
  document.getElementById('gateSignupForm').style.display = 'flex';
  document.getElementById('gateLoginForm').style.display = 'none';
  clearGateError();
});

document.getElementById('gateLoginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('gateLoginEmail').value.trim();
  const pw = document.getElementById('gateLoginPassword').value;
  if(!email || !pw){ showGateError('이메일과 비밀번호를 입력해주세요.'); return; }
  clearGateError();
  setGateButtonsDisabled(true);
  try{
    await fbAuth.signInWithEmailAndPassword(email, pw);
  }catch(e){
    showGateError(authErrorMessage(e));
  }finally{
    setGateButtonsDisabled(false);
  }
});

document.getElementById('gateSignupBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('gateSignupEmail').value.trim();
  const pw = document.getElementById('gateSignupPassword').value;
  const pw2 = document.getElementById('gateSignupPassword2').value;
  if(!email || !pw){ showGateError('이메일과 비밀번호를 입력해주세요.'); return; }
  if(pw !== pw2){ showGateError('비밀번호가 일치하지 않습니다.'); return; }
  clearGateError();
  setGateButtonsDisabled(true);
  try{
    await fbAuth.createUserWithEmailAndPassword(email, pw);
  }catch(e){
    showGateError(authErrorMessage(e));
  }finally{
    setGateButtonsDisabled(false);
  }
});

document.getElementById('gateGoogleBtn')?.addEventListener('click', async () => {
  clearGateError();
  setGateButtonsDisabled(true);
  const provider = new firebase.auth.GoogleAuthProvider();
  try{
    await fbAuth.signInWithPopup(provider);
  }catch(e){
    showGateError(authErrorMessage(e));
  }finally{
    setGateButtonsDisabled(false);
  }
});

document.getElementById('gateGuestBtn')?.addEventListener('click', async () => {
  clearGateError();
  setGateButtonsDisabled(true);
  try{
    await fbAuth.signInAnonymously();
  }catch(e){
    showGateError('게스트 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }finally{
    setGateButtonsDisabled(false);
  }
});

// ---------- 인증 상태 변화 처리 ----------
let previousKnownUid = null;
try{ previousKnownUid = window.localStorage.getItem(LAST_UID_KEY); }catch(e){}
let gameStarted = false; // 로그인 성공 후 게임을 단 한 번만 초기화하기 위한 가드

fbAuth.onAuthStateChanged(async (user) => {
  if(!user){
    // 로그인된 세션이 없으면 게이트를 띄우고 사용자의 선택(로그인/회원가입/Google/게스트)을 기다린다.
    // (더 이상 자동으로 익명 로그인을 하지 않음)
    showAuthGate();
    return;
  }

  // 게스트(익명)가 아니라면 → 로그인할 때마다 매번 로컬/클라우드 세이브를 비교한다.
  // (이전엔 "이 기기에서 이 계정으로 로그인한 적 있는지"만 봐서, 두 기기 모두 이미 로그인 이력이
  //  있으면 그 이후로는 클라우드 확인 자체를 건너뛰고 각자 자기 로컬 세이브만 계속 밀어올리기만 해서
  //  기기별로 진행 상황이 점점 벌어지는 문제가 있었음. 매번 비교하도록 수정.)
  if(!user.isAnonymous){
    let hasLocalSave = false;
    let localData = null;
    try{
      const local = await storageGet('save');
      hasLocalSave = !!(local && local.value);
      if(hasLocalSave) localData = JSON.parse(local.value);
    }catch(e){}

    const cloud = await cloudPullSave(user.uid);

    if(cloud && cloud.data){
      if(!hasLocalSave){
        // 이 기기에는 잃을 진행 상황이 없으므로 바로 클라우드 데이터를 적용
        if(typeof processImportedData === 'function') processImportedData(cloud.data);
      } else {
        const localLastSave = localData?.lastSave || 0;
        const cloudLastSave = cloud.updatedAt || 0;

        // 5초 이상 차이 날 때만 물어봄 (오차/거의 동시 저장으로 인한 불필요한 confirm 방지)
        if(cloudLastSave > localLastSave + 5000){
          let cloudSummary = '';
          try{
            const cloudData = JSON.parse(cloud.data);
            cloudSummary = `Lv.${cloudData.level||1}, 최고 ${cloudData.highestFloor||1}층`;
          }catch(e){ cloudSummary = '(정보 확인 불가)'; }
          const localSummary = `Lv.${localData.level||1}, 최고 ${localData.highestFloor||1}층`;

          const useCloud = await showGameConfirm(
            '이 계정에 더 최신 진행 상황이 있습니다',
            `[이 기기]  ${localSummary}\n` +
            `[클라우드] ${cloudSummary}\n\n` +
            '[확인] = 클라우드 데이터를 불러옵니다 (이 기기의 진행 상황은 대체됩니다)\n' +
            '[취소] = 이 기기의 진행 상황을 그대로 유지합니다 (클라우드가 이걸로 갱신됩니다)'
          );
          if(useCloud && typeof processImportedData === 'function'){
            processImportedData(cloud.data);
          }
        }
      }
    }
  }

  previousKnownUid = user.uid;
  try{ window.localStorage.setItem(LAST_UID_KEY, user.uid); }catch(e){}

  hideAuthGate();
  renderAccountPanel(user);
  if(typeof startRankingSync === 'function') startRankingSync();
  if(typeof startWorldBossSync === 'function') startWorldBossSync();

  // 로그인/회원가입/게스트 진입이 확정된 시점에 실제 게임을 시작 (최초 1회만)
  if(!gameStarted){
    gameStarted = true;
    if(typeof startGame === 'function') startGame();
  }
});

// ---------- 버튼 이벤트 ----------
document.getElementById('nicknameSaveBtn')?.addEventListener('click', () => {
  const input = document.getElementById('nicknameInput');
  const val = input.value.trim().slice(0, 12);
  if(!val){ alert('닉네임을 입력해주세요.'); return; }
  state.nickname = val;
  log(`닉네임이 "${val}"(으)로 설정되었습니다.`, 'good');
  if(typeof pushRanking === 'function') pushRanking();
  if(typeof saveState === 'function') saveState(false);
});

document.getElementById('linkEmailBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('linkEmailInput').value.trim();
  const pw = document.getElementById('linkPasswordInput').value;
  if(!email || !pw){ alert('이메일과 비밀번호를 입력해주세요.'); return; }
  const user = fbAuth.currentUser;
  try{
    const cred = firebase.auth.EmailAuthProvider.credential(email, pw);
    await user.linkWithCredential(cred);
    log('🎉 계정이 생성되었습니다! 지금까지의 진행 상황이 그대로 이 계정에 연결됐어요.', 'good');
    renderAccountPanel(fbAuth.currentUser);
  }catch(e){
    alert(authErrorMessage(e));
  }
});

document.getElementById('linkGoogleBtn')?.addEventListener('click', async () => {
  const user = fbAuth.currentUser;
  const provider = new firebase.auth.GoogleAuthProvider();
  try{
    await user.linkWithPopup(provider);
    log('🎉 Google 계정으로 전환되었습니다! 진행 상황이 그대로 유지됩니다.', 'good');
    renderAccountPanel(fbAuth.currentUser);
  }catch(e){
    if(e.code === 'auth/credential-already-in-use' && e.credential){
      const ok = await showGameConfirm(
        '이미 가입된 Google 계정입니다',
        '그 계정으로 로그인할까요?\n(현재 기기의 진행 상황은 그 계정 데이터로 대체될 수 있습니다)'
      );
      if(ok){
        try{ await fbAuth.signInWithCredential(e.credential); }
        catch(e2){ alert(authErrorMessage(e2)); }
      }
    } else {
      alert(authErrorMessage(e));
    }
  }
});

document.getElementById('loginEmailBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmailInput').value.trim();
  const pw = document.getElementById('loginPasswordInput').value;
  if(!email || !pw){ alert('이메일과 비밀번호를 입력해주세요.'); return; }
  try{
    await fbAuth.signInWithEmailAndPassword(email, pw);
  }catch(e){
    alert(authErrorMessage(e));
  }
});

document.getElementById('loginGoogleBtn')?.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try{
    await fbAuth.signInWithPopup(provider);
  }catch(e){
    alert(authErrorMessage(e));
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if(!await showGameConfirm(
    '로그아웃하시겠습니까?',
    '다음 접속 시 새 게스트로 시작하며, 다시 로그인하면 이 계정 데이터로 이어할 수 있습니다'
  )) return;
  await fbAuth.signOut();
  location.reload();
});
document.getElementById('accountGoToTitlesBtn')?.addEventListener('click', () => {
  document.querySelector('.tab-nav-btn[data-tab="tab-gear"]')?.click();
});

// ---------- 회원 탈퇴 ----------
// 게스트(익명)든 이메일/Google 계정이든 상관없이 탈퇴 가능. 순서가 중요함:
// 1) Firestore의 saves/rankings/presence 문서를 먼저 지운다 (보안 규칙상 로그인된 본인만 지울 수 있으므로,
//    Auth 계정을 먼저 지워버리면 그 뒤엔 권한이 없어져서 데이터가 못 지워지고 고아로 남는다)
// 2) 로컬(localStorage) 세이브도 지운다
// 3) 마지막으로 Firebase Auth 계정 자체를 삭제한다
// 이메일/비밀번호 계정은 보안상 "최근 로그인" 상태가 아니면 user.delete()가 auth/requires-recent-login
// 에러를 낸다 — 이 경우 비밀번호를 다시 물어봐서 재인증한 뒤 다시 시도한다.
document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
  const user = fbAuth.currentUser;
  if(!user) return;

  const warn = user.isAnonymous
    ? '지금까지의 진행 상황(캐릭터, 재화, 랭킹)이 이 기기에서 영구적으로 삭제되며 되돌릴 수 없습니다.'
    : '계정에 저장된 모든 진행 상황(캐릭터, 재화, 랭킹)이 영구적으로 삭제되며 되돌릴 수 없습니다.';
  if(!await showGameConfirm('정말 탈퇴하시겠습니까?', warn)) return;

  const typed = await showGamePrompt('탈퇴 확인', '되돌릴 수 없습니다. 계속하려면 아래 칸에 "탈퇴"를 입력해주세요.');
  if(typed !== '탈퇴'){ alert('입력이 일치하지 않아 탈퇴가 취소되었습니다.'); return; }

  await performAccountDeletion(user);
});

async function performAccountDeletion(user){
  const uid = user.uid;
  try{
    await Promise.all([
      fbDb.collection('saves').doc(uid).delete().catch(()=>{}),
      fbDb.collection('rankings').doc(uid).delete().catch(()=>{}),
      fbDb.collection('presence').doc(uid).delete().catch(()=>{}),
    ]);

    try{
      window.localStorage.removeItem(LOCAL_PREFIX + 'save');
      window.localStorage.removeItem(LAST_UID_KEY);
    }catch(e){}

    await user.delete();

    alert('탈퇴가 완료되었습니다. 그동안 플레이해주셔서 감사합니다.');
    location.reload();
  }catch(e){
    if(e.code === 'auth/requires-recent-login'){
      await handleReauthAndRetryDelete(user);
    } else {
      alert('탈퇴 처리 중 오류가 발생했습니다: ' + e.message);
    }
  }
}

async function handleReauthAndRetryDelete(user){
  const providerId = user.providerData[0] && user.providerData[0].providerId;
  try{
    if(providerId === 'google.com'){
      const provider = new firebase.auth.GoogleAuthProvider();
      await user.reauthenticateWithPopup(provider);
    } else if(providerId === 'password'){
      const pw = await showGamePrompt('재인증 필요', '보안을 위해 비밀번호를 다시 입력해주세요.');
      if(!pw) return;
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, pw);
      await user.reauthenticateWithCredential(cred);
    } else {
      alert('재인증이 필요합니다. 로그아웃 후 다시 로그인해서 탈퇴를 시도해주세요.');
      return;
    }
    await performAccountDeletion(fbAuth.currentUser);
  }catch(e){
    alert('재인증에 실패했습니다: ' + authErrorMessage(e));
  }
}

// ===== js/ranking.js =====
// ---------- Ranking (랭킹 시스템) ----------
// rankings/{uid} 문서에 닉네임/전투력/최고층을 올리고, 전투력 내림차순 상위 50명을 보여준다.

let rankingSyncStarted = false;

function startRankingSync(){
  if(rankingSyncStarted) return;
  rankingSyncStarted = true;
  pushRanking();
  registerGameTickTask(pushRanking, 60000, 'ranking-push'); // 통합 티커(백그라운드 탭에서는 생략)
  fetchRanking();
}

async function pushRanking(){
  const user = fbAuth.currentUser;
  if(!user || !state.nickname) return;
  const s = stats();
  const cp = calcCombatPower(s);
  try{
    await fbDb.collection('rankings').doc(user.uid).set({
      nickname: state.nickname,
      title: state.equippedTitle || null,
      cp,
      highestFloor: state.highestFloor || state.floor || 1,
      towerHighestFloor: state.towerHighestFloor || 1,
      // PvP 시뮬레이션(js/pvp.js)에 쓰이는 전투 스탯 스냅샷
      atk: s.atk,
      def: s.def,
      maxHp: s.maxHp,
      critChance: s.critChance,
      critDamageMult: s.critDamageMult,
      tickMs: s.tickMs,
      updatedAt: Date.now(),
    });
  }catch(e){
    console.warn('랭킹 갱신 실패', e);
  }
}

async function fetchRanking(){
  const listEl = document.getElementById('rankingList');
  const myRowEl = document.getElementById('rankingMyRow');
  if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">불러오는 중...</div>';

  try{
    const snap = await fbDb.collection('rankings').orderBy('cp', 'desc').limit(50).get();
    const myUid = fbAuth.currentUser && fbAuth.currentUser.uid;
    let rank = 0;
    let myRank = null;
    const rowsHtml = [];

    snap.forEach(doc => {
      rank++;
      const d = doc.data();
      const isMe = doc.id === myUid;
      if(isMe) myRank = rank;
      rowsHtml.push(`
        <div class="ranking-row${isMe ? ' me' : ''}">
          <span class="rk-rank">#${rank}</span>
          <span class="rk-name">${titleBadgeHtml(d.title)}${escapeHtml(d.nickname || '익명')}</span>
          <span class="rk-cp" title="${(d.cp || 0).toLocaleString()}">⚡${formatCompactNumber(d.cp || 0)}</span>
          <span class="rk-floor">${(d.highestFloor || 1).toLocaleString()}층</span>
          ${isMe ? '<span></span>' : `<button type="button" class="rk-challenge-btn" data-uid="${doc.id}">⚔️ 도전</button>`}
        </div>
      `);
    });

    if(listEl){
      listEl.innerHTML = rowsHtml.join('') || '<div style="font-size:12px;color:var(--text-dim);">아직 등록된 랭킹이 없습니다. 닉네임을 설정하면 첫 번째로 랭킹에 오를 수 있어요!</div>';
      listEl.querySelectorAll('.rk-challenge-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if(typeof challengePvp === 'function') challengePvp(btn.dataset.uid);
          else alert('PvP 기능을 불러오지 못했습니다. 페이지를 새로고침해주세요. (js/pvp.js 로드 실패)');
        });
      });
    }

    if(myRowEl){
      if(!state.nickname){
        myRowEl.textContent = '닉네임을 설정하면 랭킹에 등록됩니다.';
      } else if(myRank){
        myRowEl.textContent = '';
      } else {
        myRowEl.textContent = '내 순위는 50위 밖입니다. 성장하면 순위권에 진입할 수 있어요!';
      }
    }
  }catch(e){
    if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">랭킹을 불러오지 못했습니다. (Firestore 설정을 확인해주세요)</div>';
    console.warn('랭킹 조회 실패', e);
  }
}

document.getElementById('rankingRefreshBtn')?.addEventListener('click', fetchRanking);

// ===== js/plaza.js =====
// ---------- Plaza (광장: 실시간 접속자 목록 + 채팅) ----------
// 무료(Spark) Firestore 할당량을 아끼기 위한 설계:
//  - presence 문서는 유저당 1개(doc(uid).set)만 계속 덮어써서 저장량이 늘지 않는다.
//  - presence 갱신(쓰기)과 실시간 리스너(읽기)는 "광장 탭이 열려있는 동안"에만 동작한다.
//    다른 탭을 보고 있을 땐 완전히 멈춰서 불필요한 읽기/쓰기를 만들지 않는다.
//  - 목록은 최근 90초 이내에 갱신된 유저만 보여준다(자동 "접속 종료" 처리, 별도 삭제 로직 불필요).
//  - 채팅은 최근 30개만 구독하고, 전송 간격을 4초로 제한해 스팸으로 인한 쓰기 낭비를 막는다.

const PLAZA_PRESENCE_PUSH_INTERVAL = 20000; // 20초마다 내 presence 갱신
const PLAZA_ONLINE_WINDOW_MS = 90000;       // 최근 90초 이내 활동 유저만 "접속 중"으로 표시
const PLAZA_CHAT_LIMIT = 30;
const PLAZA_CHAT_MIN_INTERVAL = 4000;       // 채팅 전송 최소 간격(스팸 방지)

let plazaActive = false;
let plazaPresenceTimer = null;
let plazaPresenceUnsub = null;
let plazaChatUnsub = null;
let plazaLastChatSentAt = 0;

function plazaMyCombatPower(){
  try{
    const s = stats();
    return calcCombatPower(s);
  }catch(e){ return 0; }
}

async function plazaPushPresence(){
  const user = fbAuth.currentUser;
  if(!user || !state.nickname) return;
  try{
    await fbDb.collection('presence').doc(user.uid).set({
      nickname: state.nickname,
      cp: plazaMyCombatPower(),
      level: state.level || 1,
      title: state.equippedTitle || null,
      updatedAt: Date.now(),
    });
  }catch(e){
    console.warn('광장 접속 정보 갱신 실패', e);
  }
}

function plazaRenderOnlineList(docs){
  const listEl = document.getElementById('plazaOnlineList');
  if(!listEl) return;
  const myUid = fbAuth.currentUser && fbAuth.currentUser.uid;

  if(!docs.length){
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">지금은 광장에 아무도 없어요. 첫 번째로 인사해보세요!</div>';
    return;
  }

  listEl.innerHTML = docs.map(d => {
    const isMe = d.id === myUid;
    return `
      <div class="ranking-row${isMe ? ' me' : ''}">
        <span class="rk-name">${titleBadgeHtml(d.title)}${escapeHtml(d.nickname || '익명')}${isMe ? ' (나)' : ''}</span>
        <span class="rk-cp" title="${(d.cp || 0).toLocaleString()}">⚡${formatCompactNumber(d.cp || 0)}</span>
        <span class="rk-floor">Lv.${d.level || 1}</span>
      </div>
    `;
  }).join('');
}

function plazaStartPresenceListener(){
  if(plazaPresenceUnsub) return;
  const cutoff = Date.now() - PLAZA_ONLINE_WINDOW_MS;
  try{
    plazaPresenceUnsub = fbDb.collection('presence')
      .where('updatedAt', '>=', cutoff)
      .orderBy('updatedAt', 'desc')
      .limit(30)
      .onSnapshot(snap => {
        const docs = [];
        snap.forEach(doc => docs.push(Object.assign({id: doc.id}, doc.data())));
        plazaRenderOnlineList(docs);
      }, err => {
        console.warn('광장 접속자 목록 구독 실패', err);
        const listEl = document.getElementById('plazaOnlineList');
        if(listEl) listEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">접속자 목록을 불러오지 못했습니다.</div>';
      });
  }catch(e){
    console.warn('광장 접속자 목록 구독 시작 실패', e);
  }
}

function plazaFormatTime(ts){
  if(!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
}

function plazaRenderChat(docs){
  const logEl = document.getElementById('plazaChatLog');
  if(!logEl) return;
  const wasAtBottom = (logEl.scrollTop + logEl.clientHeight) >= (logEl.scrollHeight - 20);

  // Firestore에서 최신순(desc)으로 받아오므로 화면 표시는 오래된 순으로 뒤집는다.
  const ordered = docs.slice().reverse();
  logEl.innerHTML = ordered.map(d => `
    <div class="plaza-chat-line">
      <span class="plaza-chat-time">${plazaFormatTime(d.createdAt)}</span>
      <span class="plaza-chat-name">${titleBadgeHtml(d.title)}${escapeHtml(d.nickname || '익명')}</span>
      <span class="plaza-chat-text">${escapeHtml(d.text || '')}</span>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--text-dim);">아직 채팅이 없어요. 첫 메시지를 남겨보세요!</div>';

  if(wasAtBottom) logEl.scrollTop = logEl.scrollHeight;
}

function plazaStartChatListener(){
  if(plazaChatUnsub) return;
  try{
    plazaChatUnsub = fbDb.collection('chat')
      .orderBy('createdAt', 'desc')
      .limit(PLAZA_CHAT_LIMIT)
      .onSnapshot(snap => {
        const docs = [];
        snap.forEach(doc => docs.push(doc.data()));
        plazaRenderChat(docs);
      }, err => {
        console.warn('광장 채팅 구독 실패', err);
        const logEl = document.getElementById('plazaChatLog');
        if(logEl) logEl.innerHTML = '<div style="font-size:12px;color:var(--text-dim);">채팅을 불러오지 못했습니다.</div>';
      });
  }catch(e){
    console.warn('광장 채팅 구독 시작 실패', e);
  }
}

async function plazaSendChat(){
  const input = document.getElementById('plazaChatInput');
  const hintEl = document.getElementById('plazaChatHint');
  if(!input) return;
  const user = fbAuth.currentUser;

  if(!user || !state.nickname){
    if(hintEl) hintEl.textContent = '닉네임을 먼저 설정해야 채팅할 수 있어요. (계정 탭)';
    return;
  }
  const text = input.value.trim();
  if(!text) return;

  const now = Date.now();
  if(now - plazaLastChatSentAt < PLAZA_CHAT_MIN_INTERVAL){
    if(hintEl) hintEl.textContent = '너무 빨라요! 잠시 후 다시 시도해주세요.';
    return;
  }

  input.value = '';
  if(hintEl) hintEl.textContent = '';
  plazaLastChatSentAt = now;

  try{
    await fbDb.collection('chat').add({
      uid: user.uid,
      nickname: state.nickname,
      text: text.slice(0, 100),
      title: state.equippedTitle || null,
      createdAt: now,
    });
  }catch(e){
    console.warn('채팅 전송 실패', e);
    if(hintEl) hintEl.textContent = '전송에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
}

function plazaEnter(){
  if(plazaActive) return;
  plazaActive = true;
  plazaPushPresence();
  plazaPresenceTimer = setInterval(plazaPushPresence, PLAZA_PRESENCE_PUSH_INTERVAL);
  plazaStartPresenceListener();
  plazaStartChatListener();
}

function plazaLeave(){
  plazaActive = false;
  if(plazaPresenceTimer){ clearInterval(plazaPresenceTimer); plazaPresenceTimer = null; }
  if(plazaPresenceUnsub){ plazaPresenceUnsub(); plazaPresenceUnsub = null; }
  if(plazaChatUnsub){ plazaChatUnsub(); plazaChatUnsub = null; }
}

document.getElementById('plazaTabBtn')?.addEventListener('click', plazaEnter);
document.querySelectorAll('.tab-nav-btn:not(#plazaTabBtn)').forEach(btn => {
  btn.addEventListener('click', plazaLeave);
});

document.getElementById('plazaChatSendBtn')?.addEventListener('click', plazaSendChat);
document.getElementById('plazaChatInput')?.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') plazaSendChat();
});

// 페이지를 완전히 벗어날 때 리스너 정리(안 해도 브라우저가 정리하지만 명시적으로 닫아준다)
window.addEventListener('beforeunload', plazaLeave);

// ===== js/pvp.js =====
// ---------- PvP (랭킹 상대와 1대1 모의전투) ----------
// 실시간 대전이 아니라, 상대의 최근 랭킹 스탯 스냅샷(rankings/{uid})을 가져와
// 내 스탯과 즉시 클라이언트에서 시뮬레이션한다. 서버에는 아무것도 쓰지 않는다(내 전적/명예는 로컬 state에만 저장).
// 승패에 따라 스탯 보상은 절대 주지 않는다 — 스탯 보상을 주면 물자획득/경험치획득처럼 결국
// 캡에 도달해 "죽은 콘텐츠"가 되는 문제가 그대로 반복되기 때문. 대신 순수 전적/명예(칭호 해금용)만 쌓인다.

function pvpFallbackStatsFromCp(d){
  // 예전 버전에서 올라간(스탯 필드가 없는) 랭킹 문서를 위한 대략적인 추정치.
  const cp = d.cp || 1000;
  return {
    atk: Math.max(1, Math.round(cp / 14)),
    def: Math.max(0, Math.round(cp / 60)),
    maxHp: Math.max(10, Math.round(cp * 8)),
    critChance: 5,
    critDamageMult: 1.5,
    tickMs: 800,
  };
}

function simulatePvpBattle(me, opp){
  let myHp = me.maxHp, oppHp = opp.maxHp;
  let myNext = me.tickMs, oppNext = opp.tickMs;
  let turns = 0;
  const MAX_TURNS = 4000;

  while(myHp > 0 && oppHp > 0 && turns < MAX_TURNS){
    turns++;
    const iGoFirst = myNext < oppNext || (myNext === oppNext && Math.random() < 0.5);
    if(iGoFirst){
      let dmg = Math.max(1, me.atk - opp.def);
      if(Math.random() * 100 < me.critChance) dmg = Math.round(dmg * me.critDamageMult);
      oppHp -= dmg;
      myNext += me.tickMs;
    } else {
      let dmg = Math.max(1, opp.atk - me.def);
      if(Math.random() * 100 < opp.critChance) dmg = Math.round(dmg * opp.critDamageMult);
      myHp -= dmg;
      oppNext += opp.tickMs;
    }
  }

  myHp = Math.max(0, myHp);
  oppHp = Math.max(0, oppHp);
  let winner;
  if(myHp <= 0 && oppHp <= 0){
    winner = (myHp / me.maxHp) >= (oppHp / opp.maxHp) ? 'me' : 'opp'; // 동시 격파면 남은 체력 비율로 판정
  } else if(oppHp <= 0){
    winner = 'me';
  } else if(myHp <= 0){
    winner = 'opp';
  } else {
    winner = (myHp / me.maxHp) >= (oppHp / opp.maxHp) ? 'me' : 'opp'; // MAX_TURNS 도달 시 체력 비율로 판정
  }

  return {
    winner, turns,
    myHpPct: Math.round((myHp / me.maxHp) * 100),
    oppHpPct: Math.round((oppHp / opp.maxHp) * 100),
  };
}

async function challengePvp(opponentUid){
  const myUser = fbAuth.currentUser;
  if(!myUser || !state.nickname){
    alert('닉네임을 먼저 설정해야 PvP 대전이 가능합니다.');
    return;
  }
  if(opponentUid === myUser.uid) return;

  try{
    const doc = await fbDb.collection('rankings').doc(opponentUid).get();
    if(!doc.exists){ alert('상대 정보를 찾을 수 없습니다.'); return; }
    const d = doc.data();

    const hasFullStats = typeof d.atk === 'number' && typeof d.maxHp === 'number';
    const opp = hasFullStats
      ? {atk:d.atk, def:d.def||0, maxHp:d.maxHp, critChance:d.critChance||0, critDamageMult:d.critDamageMult||1.5, tickMs:d.tickMs||800}
      : pvpFallbackStatsFromCp(d);

    const s = stats();
    const me = {atk:s.atk, def:s.def, maxHp:s.maxHp, critChance:s.critChance, critDamageMult:s.critDamageMult, tickMs:s.tickMs};

    const result = simulatePvpBattle(me, opp);

    // 승패 기록 + 명예 포인트 (스탯 보상은 의도적으로 없음 — 캡 있는 스탯에 또 손대면
    // 물자획득/경험치획득 때와 같은 "죽은 스탯" 문제가 반복되니, 순수 기록/자랑용 재화로 분리).
    const iWon = result.winner === 'me';
    if(iWon){
      state.pvpWins = (state.pvpWins||0) + 1;
      const honorGain = 5 + Math.floor(Math.random()*6); // 5~10
      state.pvpHonor = (state.pvpHonor||0) + honorGain;
      result.honorGain = honorGain;
    } else {
      state.pvpLosses = (state.pvpLosses||0) + 1;
      const honorGain = 1; // 패배해도 소량 지급 (완전히 헛수고는 아니게)
      state.pvpHonor = (state.pvpHonor||0) + honorGain;
      result.honorGain = honorGain;
    }
    if(typeof checkTitleUnlocks === 'function') checkTitleUnlocks();
    if(typeof renderTitles === 'function') renderTitles();
    if(typeof renderAll === 'function') renderAll();

    showPvpResultModal(state.nickname, d.nickname || '익명', result);
  }catch(e){
    console.warn('PvP 대전 실패', e);
    alert('대전 정보를 불러오지 못했습니다.');
  }
}

function showPvpResultModal(myName, oppName, result){  const modal = document.getElementById('pvpResultModal');
  const textEl = document.getElementById('pvpResultText');
  if(!modal || !textEl) return;

  const iWon = result.winner === 'me';
  textEl.innerHTML = `
    <div class="pvp-result-title ${iWon ? 'win' : 'lose'}">${iWon ? '🏆 승리!' : '💀 패배'}</div>
    <div class="pvp-result-row"><span>${escapeHtml(myName)}</span><span>${result.myHpPct}% 남음</span></div>
    <div class="pvp-result-row"><span>${escapeHtml(oppName)}</span><span>${result.oppHpPct}% 남음</span></div>
    <div class="pvp-result-note">${result.turns}합 만에 승부 결정 · 🎖️ 명예 +${result.honorGain}</div>
    <div class="pvp-result-note">통산 전적 ${state.pvpWins||0}승 ${state.pvpLosses||0}패 · 보유 명예 ${(state.pvpHonor||0).toLocaleString()}</div>
  `;
  modal.style.display = 'flex';
}

document.getElementById('pvpResultCloseBtn')?.addEventListener('click', () => {
  document.getElementById('pvpResultModal').style.display = 'none';
});

function renderPvpRecord(){
  const el = document.getElementById('pvpRecordLine');
  if(!el) return;
  el.textContent = `⚔️ 내 PvP 전적 ${state.pvpWins||0}승 ${state.pvpLosses||0}패 · 🎖️ 명예 ${(state.pvpHonor||0).toLocaleString()}`;
}

// ===== js/worldboss.js =====
// ---------- 월드보스 ----------
// 전 유저가 공유하는 보스 체력 하나를 함께 깎는 컨텐츠 (Firestore worldboss/state 문서 1개 공유).
// 해금 조건: 1인 레이드와 동일 (무한의 탑 100층 클리어)
// 도전 방식: 개인당 4시간마다 입장 가능, 제한시간 1분(또는 쓰러질 때까지/보스가 죽을 때까지) 자동 전투
// 보상: 내가 그 회차에 실제로 넣은 데미지량에 비례 (킬을 낸 사람에게는 추가 보너스)
// 보스 최대 체력(WB_MAX_HP): 코드에 고정된 값. Firestore에는 저장되지만 클라이언트가 직접
//         바꿀 수 없고(보안 규칙이 이 상수와 동일한 값만 허용), 매일 자정(KST) 리셋될 때마다
//         이 상수 값으로 자동 덮어써진다. 체력을 바꾸고 싶으면 이 파일의 WB_MAX_HP와
//         firestore.rules의 동일한 숫자를 함께 고쳐서 배포하면, 다음 날 리셋 때 자동 반영됨
//         (Firestore 콘솔에서 수동으로 만질 필요 없음).
// 보스 체력 초기화: 매일 자정(KST) - Firestore 보안 규칙이 서버 시간(request.time) 기준으로 검증하므로
//         클라이언트 시계를 조작해도 실제 초기화 타이밍은 위조할 수 없음.
//         (개인 도전 쿨타임 4시간은 보스 체력 초기화와는 별개로 독립적으로 동작함)
//
// ⚠️ 최초 1회, Firebase 콘솔에서 worldboss/state 문서를 직접 만들어야 합니다:
//    컬렉션 'worldboss' > 문서 ID 'state' > 필드:
//      - hp(숫자, 아무 값이나 OK — 최초 접속 시 곧바로 WB_MAX_HP로 자동 교정됨)
//      - maxHp(숫자, 아무 값이나 OK — 위와 동일하게 자동 교정됨)
//      - resetDate(숫자, 0)
//      - manualResetAt(숫자, 0) ← 전 유저 도전 기록 강제 초기화용 (아래 설명)
//    (resetDate를 0으로 두면 접속한 유저가 처음 열었을 때 자동으로 오늘 날짜로 리셋되며 시작합니다)
//
// 🔧 관리자가 "전 유저 도전 기록"을 마음대로 초기화하고 싶을 때:
//    Firebase 콘솔 > Firestore > worldboss/state 문서 > manualResetAt 필드 값을
//    "현재 시각의 밀리초 타임스탬프"로 바꿔서 저장하면 됩니다.
//    (브라우저 콘솔에서 Date.now()를 입력하면 바로 그 값이 나옵니다)
//    이 값보다 이전에 도전한 유저는 전부 즉시 재도전 가능해집니다 — 즉, 4시간 쿨타임과 무관하게
//    "지금 이 순간부터 전원 재도전 가능"하게 만드는 스위치입니다.
//    참고: 이 필드를 고쳐도 보스의 공유 체력(hp)은 그대로입니다. 체력까지 당장 리셋하고 싶다면
//    hp 필드를 WB_MAX_HP와 같은 값으로 함께 바꿔주세요.

const WORLD_BOSS_META = {name:'창세의 균주, 제로', emoji:'🧟'};
const WB_MAX_HP = 5297343927422; // 월드보스 최대 체력 (매일 자정 리셋 시 이 값으로 자동 고정)
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
      // maxHp는 더 이상 Firestore에 저장된 이전 값을 쓰지 않고, 코드에 고정된 WB_MAX_HP로 매번 교정한다.
      const freshWrite = {hp: WB_MAX_HP, maxHp: WB_MAX_HP, resetDate: day};
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
  if(!await showGameConfirm(
    `${WORLD_BOSS_META.name}에게 도전하시겠습니까?`,
    `제한시간 1분 동안(또는 쓰러질 때까지) 자동으로 전투가 진행됩니다.\n입힌 데미지량에 비례해 보상을 받으며, 재도전은 ${WB_COOLDOWN_MS/3600000}시간 후 가능합니다.`
  )) return;
  if(state.wbActive) return; // 확인 모달을 기다리는 동안 다른 진입이 완료됐다면 취소

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
  renderCombatFrame();
  renderWorldBossPanel();
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
  renderCombatFrame();
  renderWorldBossPanel();
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
// 주의: 도전 버튼을 눌렀을 때만 리셋(ensureWorldBossFreshAndGet)이 실행되면,
//    보스가 이미 죽어(wbHp<=0) 버튼이 비활성화된 날짜에는 리셋이 영원히 발동되지 않는
//    결정적 결함이 있다. 그래서 여기 주기적 조회에서도 날짜가 바뀌면 자동으로 리셋한다.
async function fetchWorldBossStatus(){
  try{
    const fresh = await ensureWorldBossFreshAndGet();
    if(fresh) wbStatusCache = fresh;
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
  // 서버 폴링도 통합 티커에 맡긴다(백그라운드 탭에서는 요청 자체를 보내지 않아 데이터/배터리를 아낀다).
  registerGameTickTask(fetchWorldBossStatus, 15000, 'wb-status');
  registerGameTickTask(fetchWorldBossLeaderboard, 30000, 'wb-leaderboard');
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
registerGameTickTask(() => {
  if (!worldBossUnlocked()) return;
  renderWorldBossPanel();
}, 1000, 'wb-panel');
// ===== js/tabs.js =====
// ---------- 공용 모달/토스트 (네이티브 alert/confirm/prompt 대체) ----------
// 모바일 PWA에서 네이티브 팝업이 UX를 깨서 게임 내 모달로 통일한다.
// showGameConfirm(title, desc) -> Promise<boolean> : 확인/취소 모달
// notifyGame(text, kind) : 토스트 + 로그 동시 출력
let __gameConfirmResolve = null;
let __gamePromptResolve = null;
function notifyGame(text, kind){
  try{ if(typeof log === 'function') log(text, kind || ''); }catch(e){}
  try{
    let wrap = document.getElementById('gameToastWrap');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'gameToastWrap';
      wrap.className = 'game-toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'game-toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    wrap.appendChild(el);
    while(wrap.children.length > 4) wrap.firstChild.remove();
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 300); }, 2600);
  }catch(e){}
}
function showGameConfirm(title, desc){
  return new Promise((resolve)=>{
    const modal = document.getElementById('gameConfirmModal');
    const tEl = document.getElementById('gameConfirmTitle');
    const dEl = document.getElementById('gameConfirmDesc');
    const okBtn = document.getElementById('gameConfirmOkBtn');
    const cancelBtn = document.getElementById('gameConfirmCancelBtn');
    if(!modal || !okBtn || !cancelBtn){ resolve(window.confirm((title||'') + '\n' + (desc||''))); return; }
    // 열려 있던 다른 확인 모달이 있으면 이전 것을 "취소"로 즉시 마무리한다.
    // (모달이 한 개뿐이라 재진입/중복 호출 시 이전 Promise가 영원히 pending으로 남는 문제 방지)
    if(__gameConfirmResolve){ const prev = __gameConfirmResolve; __gameConfirmResolve = null; prev(false); }
    if(tEl) tEl.textContent = title || '확인';
    if(dEl) dEl.textContent = desc || '';
    modal.style.display = 'flex';
    __gameConfirmResolve = resolve;
    okBtn.onclick = ()=>{ modal.style.display = 'none'; const r = __gameConfirmResolve; __gameConfirmResolve = null; if(r) r(true); };
    cancelBtn.onclick = ()=>{ modal.style.display = 'none'; const r = __gameConfirmResolve; __gameConfirmResolve = null; if(r) r(false); };
  });
}
function showGamePrompt(title, desc){
  return new Promise((resolve)=>{
    const modal = document.getElementById('gamePromptModal');
    const tEl = document.getElementById('gamePromptTitle');
    const dEl = document.getElementById('gamePromptDesc');
    const input = document.getElementById('gamePromptInput');
    const okBtn = document.getElementById('gamePromptOkBtn');
    const cancelBtn = document.getElementById('gamePromptCancelBtn');
    if(!modal || !input){ resolve(window.prompt((title||'') + '\n' + (desc||''))); return; }
    // 확인 모달과 마찬가지로 열려 있던 이전 입력 모달을 null(취소)로 마무리한다.
    if(__gamePromptResolve){ const prev = __gamePromptResolve; __gamePromptResolve = null; prev(null); }
    if(tEl) tEl.textContent = title || '입력';
    if(dEl) dEl.textContent = desc || '';
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 50);
    const settle = (value)=>{ modal.style.display = 'none'; const r = __gamePromptResolve; __gamePromptResolve = null; if(r) r(value); };
    __gamePromptResolve = resolve;
    okBtn.onclick = ()=>settle(input.value);
    cancelBtn.onclick = ()=>settle(null);
    input.onkeydown = (e)=>{ if(e.key === 'Enter') settle(input.value); };
  });
}

// 기능이 계속 추가되면서 한 페이지에 패널이 너무 많이 쌓여 스크롤이 길어지는 문제를 해결하기 위해
// 성장/구역/이벤트/계정 4개 탭으로 나눠서 전환합니다.
// (모험가 스탯 / 폐허 전투 / 물자 강화는 항상 보이는 메인 화면으로 유지)

document.querySelectorAll('.tab-nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const targetId = btn.dataset.tab;

    document.querySelectorAll('.tab-nav-btn').forEach(b=>b.classList.toggle('active', b===btn));
    document.querySelectorAll('.tab-content').forEach(panel=>{
      panel.style.display = (panel.id === targetId) ? 'block' : 'none';
    });

    try{ window.localStorage.setItem('twilight-corridor-last-tab', targetId); }catch(e){}
  });
});

// 마지막으로 보던 탭 기억해서 새로고침해도 유지
(function restoreLastTab(){
  let lastTab = null;
  try{ lastTab = window.localStorage.getItem('twilight-corridor-last-tab'); }catch(e){}
  if(!lastTab) return;
  const btn = document.querySelector(`.tab-nav-btn[data-tab="${lastTab}"]`);
  if(btn) btn.click();
})();

// ---------- 로컬 서브탭 (골드강화 / 스킬강화) ----------
// 상단 상점 패널 안에서만 쓰는 작은 탭 전환. 메인 tab-nav와는 별개로 동작한다.
document.querySelectorAll('.local-subtab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const targetId = btn.dataset.subtab;
    const group = btn.closest('.panel');
    group.querySelectorAll('.local-subtab-btn').forEach(b=>b.classList.toggle('active', b===btn));
    group.querySelectorAll('.local-subtab-content').forEach(panel=>{
      panel.style.display = (panel.id === targetId) ? 'block' : 'none';
    });
  });
});

// ===== js/gifts.js =====
// ---------- 선물함 (관리자 지급 보상) ----------
// Firebase 콘솔에서 'gifts' 컬렉션에 문서를 직접 추가하는 방식으로 특정 유저에게 재화를 지급합니다.
// 문서 형식 (필드 몇 개만 입력하면 됨, JSON 문자열 편집 필요 없음):
//   uid:     "지급 대상 유저의 UID" (Authentication 탭에서 확인)
//   gold:    50000   (선택, 없으면 0. 음수(-50000)를 넣으면 차감됨 — 잘못 지급된 재화 회수용)
//   frag:    0       (선택, 유산 파편. 음수도 가능)
//   soul:    0       (선택, 혈청. 음수도 가능)
//   relicTicket: 0   (선택, 유물 뽑기권)
//   petTicket: 0     (선택, 펫 뽑기권)
//   claimed: false   (필수, 처음엔 항상 false로 생성)
//   note:    "사유"  (선택, 지급 사유. 유저에게 선물 팝업/로그에 그대로 표시됨)
//
// 클라이언트는 자기 UID로 된 claimed:false 문서를 찾으면 즉시 현재 세이브에 "더해서"(음수면 차감) 반영하고
// claimed를 true로 바꿉니다. 로컬 state에 바로 가산하기 때문에, 그 이후 자동저장이 무엇을 덮어쓰든
// 이미 반영된 값이라 안전합니다 (지급이 씹히는 문제 없음). 차감 결과가 0 밑으로 내려가지는 않습니다.

async function checkGifts(){
  const user = fbAuth.currentUser;
  if(!user) return;

  try{
    const snapshot = await fbDb.collection('gifts')
      .where('uid', '==', user.uid)
      .where('claimed', '==', false)
      .get();

    if(snapshot.empty) return;

    let totalGold = 0, totalFrag = 0, totalSoul = 0, totalRelicTicket = 0, totalPetTicket = 0;
    const notes = [];
    const batch = fbDb.batch();

    snapshot.forEach(doc=>{
      const g = doc.data();
      totalGold += Number(g.gold) || 0;
      totalFrag += Number(g.frag) || 0;
      totalSoul += Number(g.soul) || 0;
      totalRelicTicket += Number(g.relicTicket) || 0;
      totalPetTicket += Number(g.petTicket) || 0;
      if(g.note) notes.push(String(g.note));
      batch.update(doc.ref, { claimed: true });
    });

    if(totalGold !== 0) state.gold = Math.max(0, state.gold + totalGold);
    if(totalFrag !== 0) state.fragments = Math.max(0, (state.fragments||0) + totalFrag);
    if(totalSoul !== 0) state.soul = Math.max(0, state.soul + totalSoul);
    if(totalRelicTicket !== 0) state.relicTicket = Math.max(0, (state.relicTicket||0) + totalRelicTicket);
    if(totalPetTicket !== 0) state.petTicket = Math.max(0, (state.petTicket||0) + totalPetTicket);

    await batch.commit(); // claimed 표시를 실제로 반영 (실패해도 로컬엔 이미 지급된 상태)

    const parts = [];
    if(notes.length) parts.push(`📝 ${notes.join(' · ')}`);
    if(totalGold !== 0) parts.push(`📦 물자 ${totalGold.toLocaleString()}`);
    if(totalFrag !== 0) parts.push(`◈ 유산 파편 ${totalFrag.toLocaleString()}`);
    if(totalSoul !== 0) parts.push(`🧪 혈청 ${totalSoul.toLocaleString()}`);
    if(totalRelicTicket !== 0) parts.push(`🎫 유물 뽑기권 ${totalRelicTicket.toLocaleString()}`);
    if(totalPetTicket !== 0) parts.push(`🎟️ 펫 뽑기권 ${totalPetTicket.toLocaleString()}`);
    if(parts.length === 0) return; // 전부 0이고 note도 없으면(claimed 표시만 필요했던 경우) 알림 없이 조용히 종료
    log(`🎁 관리자로부터 선물을 받았습니다! (${parts.join(' ')})`, 'good');
    showGiftModal(parts);

    if(typeof renderAll === 'function') renderAll();
    if(typeof saveState === 'function') saveState(false);
  }catch(e){
    console.warn('선물함 확인 실패', e);
  }
}

// ---------- 전체 유저 선물 (브로드캐스트) ----------
// 위 gifts 컬렉션은 유저 한 명 한 명마다 문서를 만들어야 해서, 전체 지급에는 비효율적입니다.
// globalGifts 컬렉션은 문서 '딱 1개'만 만들면 접속하는 모든 유저가 각자 알아서 수령합니다.
// 누가 이미 받았는지는 각 유저의 세이브(state.claimedGlobalGifts)에 문서 id로 기록해서 구분하므로,
// 관리자가 유저 수만큼 문서를 만들거나 수령 여부를 따로 관리할 필요가 없습니다.
//
// Firebase 콘솔에서 globalGifts 컬렉션에 문서 추가 (문서 ID는 자동생성 그대로 둬도 됨):
//   gold:  50000   (선택, 없으면 0)
//   frag:  0       (선택, 유산 파편)
//   soul:  0       (선택, 혈청)
//   relicTicket: 1  (선택, 유물 뽑기권)
//   petTicket: 1    (선택, 펫 뽑기권)
//   raidTicket: 1  (선택, 레이드 티켓 — 최대치 3을 넘겨도 그대로 더해짐)
//   note:  "사유"  (선택, 지급 사유. 유저에게 선물 팝업/로그에 그대로 표시됨)
// claimed 필드는 필요 없습니다 (유저별 수령 여부는 서버가 아니라 각자의 세이브에 저장되기 때문).
// 이미 지급한 선물 문서를 지우거나 새로 하나 더 추가하면, 지운 건 더 이상 지급되지 않고
// 새로 추가한 건 아직 못 받은 유저에게만 나갑니다.

async function checkGlobalGifts(){
  const user = fbAuth.currentUser;
  if(!user) return;

  try{
    const snapshot = await fbDb.collection('globalGifts').get();
    if(snapshot.empty) return;

    let totalGold = 0, totalFrag = 0, totalSoul = 0, totalRaidTicket = 0, totalRelicTicket = 0, totalPetTicket = 0;
    let newlyClaimedCount = 0;
    const notes = [];

    snapshot.forEach(doc=>{
      if(state.claimedGlobalGifts[doc.id]) return; // 이미 받은 선물
      const g = doc.data();
      totalGold += Number(g.gold) || 0;
      totalFrag += Number(g.frag) || 0;
      totalSoul += Number(g.soul) || 0;
      totalRaidTicket += Number(g.raidTicket) || 0;
      totalRelicTicket += Number(g.relicTicket) || 0;
      totalPetTicket += Number(g.petTicket) || 0;
      if(g.note) notes.push(String(g.note));
      state.claimedGlobalGifts[doc.id] = true;
      newlyClaimedCount++;
    });

    if(newlyClaimedCount === 0) return;

    if(totalGold !== 0) state.gold = Math.max(0, state.gold + totalGold);
    if(totalFrag !== 0) state.fragments = Math.max(0, (state.fragments||0) + totalFrag);
    if(totalSoul !== 0) state.soul = Math.max(0, state.soul + totalSoul);
    if(totalRaidTicket !== 0) state.raidTicket = Math.max(0, (state.raidTicket||0) + totalRaidTicket); // 최대치(3) 넘어도 그대로 지급
    if(totalRelicTicket !== 0) state.relicTicket = Math.max(0, (state.relicTicket||0) + totalRelicTicket);
    if(totalPetTicket !== 0) state.petTicket = Math.max(0, (state.petTicket||0) + totalPetTicket);

    const parts = [];
    if(notes.length) parts.push(`📝 ${notes.join(' · ')}`);
    if(totalGold !== 0) parts.push(`📦 물자 ${totalGold.toLocaleString()}`);
    if(totalFrag !== 0) parts.push(`◈ 유산 파편 ${totalFrag.toLocaleString()}`);
    if(totalSoul !== 0) parts.push(`🧪 혈청 ${totalSoul.toLocaleString()}`);
    if(totalRaidTicket !== 0) parts.push(`🎟️ 레이드 티켓 ${totalRaidTicket.toLocaleString()}`);
    if(totalRelicTicket !== 0) parts.push(`🎫 유물 뽑기권 ${totalRelicTicket.toLocaleString()}`);
    if(totalPetTicket !== 0) parts.push(`🎟️ 펫 뽑기권 ${totalPetTicket.toLocaleString()}`);
    if(parts.length > 0){
      log(`🎁 전체 유저 대상 선물을 받았습니다! (${parts.join(' ')})`, 'good');
      showGiftModal(parts);
    }

    if(typeof renderAll === 'function') renderAll();
    if(typeof saveState === 'function') saveState(false); // claimedGlobalGifts 기록을 즉시 저장 (재수령 방지)
  }catch(e){
    console.warn('전체 선물 확인 실패', e);
  }
}


function showGiftModal(parts){
  const modal = document.getElementById('giftModal');
  const textEl = document.getElementById('giftText');
  if(!modal || !textEl) return;

  const line = parts.join('<br>');
  if(modal.style.display === 'flex' || modal.style.display === 'block'){
    textEl.innerHTML += '<br>─────────<br>' + line;
  }else{
    textEl.innerHTML = line;
    modal.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const giftCloseBtn = document.getElementById('giftCloseBtn');
  if(giftCloseBtn){
    giftCloseBtn.addEventListener('click', ()=>{
      document.getElementById('giftModal').style.display = 'none';
    });
  }
});

// 로그인 상태에서 1분마다 자동으로 확인 (관리자가 접속 중에 선물을 넣어줘도 바로 받게)
registerGameTickTask(()=>{
  if(fbAuth.currentUser){
    checkGifts();
    checkGlobalGifts();
  }
}, 60000, 'gifts');

// ===== js/main.js =====
// ---------- Init ----------
let __mainTickHandle = null;
let __lastTickAt = Date.now();
async function init(){
  const loaded = await loadState();
  if(wasVersionReset){
    log('⚠️ 밸런스 개편으로 인해 진행 상황이 초기화되었습니다. 새로운 밸런스로 다시 시작해주세요!', 'warn');
  }
  if(loaded && !state.bugfixCompGranted){
    state.soul += 1;
    state.bugfixCompGranted = true;
    log('보스 데미지 표시 오류를 수정했습니다. 불편에 대한 보상으로 🧪 혈청 1개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted = true;
  }

  // 선물함 확인은 세이브 로드가 완전히 끝난 뒤에 해야 함 (먼저 하면 로드 시 값이 덮여씌워짐)
  if(typeof checkGifts === 'function') checkGifts();
  if(typeof checkGlobalGifts === 'function') checkGlobalGifts();
  if(loaded && !state.bonusGrant1Given){
    state.soul += 3;
    state.bonusGrant1Given = true;
    log('특별 보상으로 🧪 혈청 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bonusGrant1Given = true;
  }
  if(loaded && !state.bugfixCompGranted2){
    state.soul += 3;
    state.bugfixCompGranted2 = true;
    log('점검보상으로 🧪 혈청 3개를 지급합니다.', 'good');
  } else if(!loaded){
    state.bugfixCompGranted2 = true;
  }

  document.getElementById('modeNormalBtn').classList.toggle('active', state.mode==='normal');
  document.getElementById('modeTowerBtn').classList.toggle('active', state.mode==='tower');
  document.getElementById('arenaTitle').textContent = state.mode === 'tower' ? '무한의 탑 (100층)' : '폐허';

  const s = stats();
  if(!loaded){
    state.playerHp = s.maxHp;
  }
  if(state.monsterMaxHp <= 0){
    spawnMonster();
  } else {
    renderMonster();
  }
  if(state.playerHp <= 0) state.playerHp = s.maxHp;

  const offlineResult = loaded ? computeOfflineProgress() : null;
  if(typeof updatePlayerCostumeSprite === 'function') updatePlayerCostumeSprite();
  renderAll();
  if(offlineResult){
    showOfflineModal(offlineResult);
  }
  log('폐허에 들어섰습니다. 행운을 빕니다.', 'new');
  
  // 독립된 두 타이머 시작 (전투 진행은 게임의 핵심이라 백그라운드에서도 계속 돈다)
  schedulePlayerTick();
  scheduleMonsterTick();

  // 통합 티커(1초): 반복 작업을 한 곳으로 모으고 탭이 백그라운드면 전부 건너뛴다.
  if(typeof registerGameTickTask === 'function'){
    registerGameTickTask(petTick, 1000, 'pet');
    registerGameTickTask(()=>{
      if(typeof goldenMonsterTick === 'function') goldenMonsterTick();
    }, typeof GOLDEN_CHECK_INTERVAL_MS === 'number' ? GOLDEN_CHECK_INTERVAL_MS : 30000, 'golden');
    // 공격속도(전투 틱)와 분리해서, 뽑기/상점/각성 등 패널의 구매 가능 여부(gold/soul 반영)를
    // 1초마다만 새로고침한다. 전투 틱마다 부르면 버튼이 초당 여러 번 재생성돼 클릭이 씹힌다.
    registerGameTickTask(renderAll, 1000, 'renderAll');
    registerGameTickTask(()=>saveState(false), 5000, 'autosave');
    startGameTicker();
  } else { // 통합 티커가 없는 환경(개별 파일 로드 등) 폴백
    setInterval(petTick, 1000);
    if(typeof goldenMonsterTick === 'function') setInterval(goldenMonsterTick, GOLDEN_CHECK_INTERVAL_MS);
    setInterval(renderAll, 1000);
    setInterval(()=>saveState(false), 5000);
  }
  if(typeof checkActiveSkills === 'function') setInterval(()=>{ if(document.hidden) return; checkActiveSkills(); }, 500);
  if(typeof updateSkillTrayCooldowns === 'function') setInterval(()=>{ if(document.hidden) return; updateSkillTrayCooldowns(); }, 100);

  window.addEventListener('beforeunload', ()=>{ saveState(true); });


  renderAttendance();
}

// 로그인/회원가입/게스트 로그인이 완료된 시점에 auth.js가 이 함수를 호출해 게임을 시작한다.
// (더 이상 페이지 로드와 동시에 자동으로 시작하지 않음 — 로그인 게이트를 먼저 통과해야 함)
function startGame(){
  init();
}

// ===== js/upgrades-v23.js =====
// ============================================================
// v2.23.0 업그레이드 팩
// 1) 커스텀 토스트/모달 연동(alert 우회)  2) 상점 MAX 구매
// 3) 구역 소탕(스윕)                     4) 카드 최적 장착 + 등급 필터 + 세트 미리보기
// 5) 오프라인 보상 확장(티켓 재충전/영지 수확) 6) 백그라운드 절전 중앙 티커
// 7) 주간 미션   8) DPS 미터   9) 미니게임 점수 연동  10) 저장값 안전 텍스트
// 기존 파일은 최소한만 건드리고, 새 기능은 이 파일 하나에 모아둔다.
// ============================================================

// ---------- 공용 안전 텍스트 (auth.js의 escapeHtml 재사용) ----------
function safeText(str){
  if(typeof escapeHtml === 'function') return escapeHtml(str == null ? '' : str);
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

// ---------- 1) 네이티브 alert를 게임 내 토스트로 우회 ----------
// 기존 alert() 호출이 남아 있어도 모바일 PWA에서 팝업이 뜨지 않고 토스트로 표시된다.
// (confirm/prompt는 Promise 기반 헬퍼(showGameConfirm/showGamePrompt)로 호출부에서 교체)
function installToastAlertOverride(){
  if(window.__alertOverridden) return;
  window.alert = function(msg){ notifyGame(msg, 'warn'); };
  window.__alertOverridden = true;
}

// ---------- 2) 상점 MAX 구매 ----------
// 보유 재화로 살 수 있는 최대 개수와 총 비용을 계산한다.
function shopMaxBuyable(u, isSoul){
  let n = 0, total = 0;
  const cap = 200; // 계산 폭주 방지 상한 (실제 maxLevel은 이보다 작음)
  if(isSoul){
    const startLvl = state.soulUpgrades[u.key] || 0;
    for(; n < cap; n++){
      const cost = bulkSoulCost(startLvl + n, 1);
      if(state.soul < total + cost) break;
      total += cost;
    }
  } else {
    const startLvl = state.goldUpgrades[u.key] || 0;
    const remain = u.maxLevel ? Math.max(0, u.maxLevel - startLvl) : cap;
    for(; n < Math.min(remain, cap); n++){
      const cost = bulkCost(u.baseCost, u.mult, startLvl + n, 1);
      if(state.gold < total + cost) break;
      total += cost;
    }
  }
  return {n, cost: total};
}
function buyShopMax(u, isSoul){
  const r = shopMaxBuyable(u, isSoul);
  if(r.n <= 0){ notifyGame('재화가 부족합니다.', 'warn'); return; }
  if(isSoul){
    state.soul -= r.cost;
    state.soulUpgrades[u.key] = (state.soulUpgrades[u.key] || 0) + r.n;
  } else {
    state.gold -= r.cost;
    state.goldUpgrades[u.key] = (state.goldUpgrades[u.key] || 0) + r.n;
    state.dailyUpgradesBought += r.n;
  }
  notifyGame(`⚡ ${u.name} +${r.n} 구매! (Lv.${isSoul ? state.soulUpgrades[u.key] : state.goldUpgrades[u.key]})`, 'good');
  renderAll();
  saveState(false);
}

// ---------- 3) 구역 소탕 ----------
// 이미 정복(반복 도전 가능) 상태이거나, 승률이 확실한 층을 전투 연출 없이 즉시 1회 클리어한다.
// 티켓 1장을 소모하고 현재 층의 클리어 보상을 그대로 지급한다.
const SWEEP_TARGETS = {
  gd: {ticket:'gdTicket', floor:'gdFloor', maxFloor:GOLD_DUNGEON_MAX_FLOOR, label:'물자 구역', emoji:'📦',
       reward:()=>gdGoldFor(state.gdFloor), apply:(r)=>{ state.gold += r; state.lifetimeGoldEarned += r; }},
  rd: {ticket:'rdTicket', floor:'rdFloor', maxFloor:RELIC_DUNGEON_MAX_FLOOR, label:'유산 구역', emoji:'◈',
       reward:()=>rdFragFor(state.rdFloor), apply:(r)=>{ state.fragments += r; state.totalFragmentsEarned += r; }},
  fd: {ticket:'fdTicket', floor:'fdFloor', maxFloor:FORGE_DUNGEON_MAX_FLOOR, label:'단조 구역', emoji:'🔩',
       reward:()=>fdStoneFor(state.fdFloor), apply:(r)=>{ state.enhanceStone += r; }},
  td: {ticket:'tdTicket', floor:'tdFloor', maxFloor:TRAINING_DUNGEON_MAX_FLOOR, label:'수련 구역', emoji:'EXP',
       reward:()=>tdExpFor(state.tdFloor), apply:(r)=>{ state.exp += r; tryLevelUp(); }}
};
function sweepDungeon(which){
  const cfg = SWEEP_TARGETS[which];
  if(!cfg) return;
  if(anySubActivityActive()){ notifyGame('다른 전투 콘텐츠가 진행 중에는 소탕할 수 없습니다.', 'warn'); return; }
  if((state[cfg.ticket] || 0) <= 0){ notifyGame('티켓이 부족합니다.', 'warn'); return; }
  const floor = Math.min(state[cfg.floor] || 1, cfg.maxFloor);
  const gain = cfg.reward();
  state[cfg.ticket]--;
  cfg.apply(gain);
  trackWeeklySweep();
  notifyGame(`🧹 [${cfg.label}] ${floor}층 소탕 완료! +${gain.toLocaleString()} ${cfg.emoji}`, 'good');
  renderAll();
  saveState(false);
}
function addSweepButtons(){
  [['gdEnterBtn','gd'],['rdEnterBtn','rd'],['fdEnterBtn','fd'],['tdEnterBtn','td']].forEach(([btnId, key])=>{
    const btn = document.getElementById(btnId);
    if(!btn || document.getElementById(btnId + 'Sweep')) return;
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.id = btnId + 'Sweep';
    sw.className = `pull-relic sweep-btn`;
    sw.textContent = '🧹 소탕';
    sw.style.marginTop = '6px';
    sw.addEventListener('click', ()=>sweepDungeon(key));
    btn.insertAdjacentElement('afterend', sw);
  });
}

// ---------- 4) 카드: 최적 장착 + 등급 필터 + 세트 효과 미리보기 ----------
let __cardRarityFilter = 'all';
// 카드 3장을 임시로 끼워 넣고 덱 보너스를 계산 (state.cardDeck은 원상복구)
function previewDeckBonus(keys){
  const backup = state.cardDeck.slice();
  state.cardDeck = [keys[0] || null, keys[1] || null, keys[2] || null];
  const bonus = cardDeckBonus();
  state.cardDeck = backup;
  return bonus;
}
function deckBonusSum(bonus){
  return Object.keys(bonus).reduce((sum, k)=>sum + bonus[k], 0);
}
// "그냥 센 카드"가 아니라 실제 덱 보너스 합이 최대가 되는 조합을 찾는다.
function bestDeckCombo(){
  if(!state.cards) state.cards = {};
  const owned = CARD_DEFS
    .filter(def => (state.cards[def.key] || 0) > 0)
    .sort((a, b)=>cardBonusValue(b, cardLevelFromCount(state.cards[b.key])) - cardBonusValue(a, cardLevelFromCount(state.cards[a.key])));
  if(owned.length === 0) return [null, null, null];
  // 후보를 8장으로 줄여 3장 조합을 전수 탐색 (8C3 = 56회, 즉시 계산됨)
  const pool = owned.slice(0, 8).map(def=>def.key);
  let best = [pool[0] || null, null, null], bestScore = deckBonusSum(previewDeckBonus(best));
  for(let i = 0; i < pool.length; i++){
    for(let j = i + 1; j < pool.length; j++){
      for(let k = j + 1; k < pool.length; k++){
        const combo = [pool[i], pool[j], pool[k]];
        const score = deckBonusSum(previewDeckBonus(combo));
        if(score > bestScore){ bestScore = score; best = combo; }
      }
    }
  }
  return best;
}
function autoEquipBestCards(){
  if((!state.cards || Object.keys(state.cards).length === 0)){ notifyGame('보유한 카드가 없습니다.', 'warn'); return; }
  const best = bestDeckCombo();
  if(!best[0]){ notifyGame('보유한 카드가 없습니다.', 'warn'); return; }
  state.cardDeck = best;
  notifyGame(`🃏 최적 조합(덱 보너스 합 최대)으로 3장을 장착했습니다!`, 'good');
  renderMonsterCards();
  renderAll();
  saveState(false);
}
function updateCardSetPreview(){
  const el = document.getElementById('cardSetPreview');
  if(!el) return;
  const cur = cardDeckBonus();
  const names = state.cardDeck.map(key=>key ? (cardDefByKey(key) || {}).name : null).filter(Boolean);
  const best = bestDeckCombo();
  const bestBonus = deckBonusSum(previewDeckBonus(best));
  const curSum = deckBonusSum(cur);
  const bestNames = best.filter(Boolean).map(key=>(cardDefByKey(key) || {}).name).filter(Boolean);
  const setFull = names.length === 3 && (()=>{
    const rar = names.map(n=>{ const d = CARD_DEFS.find(x=>x.name === n); return d ? d.rarity : null; });
    return rar[0] && rar[0] === rar[1] && rar[1] === rar[2];
  })();
  const lines = [`현재 덱: ${names.length ? safeText(names.join(' · ')) : '없음'}${setFull ? ' (세트 ×1.25 적용중!)' : ''}`];
  if(bestNames.length && bestBonus > curSum + 0.001){
    lines.push(`⚡ 권장 조합: ${safeText(bestNames.join(' · '))} → 효과 ${(bestBonus / Math.max(0.001, curSum) * 100 - 100).toFixed(1)}% 상승`);
  }
  el.innerHTML = lines.join('<br>');
}

// 카드 탭 툴바(최적 장착 + 등급 필터) 배선. index.html의 정적 마크업에 이벤트만 붙인다.
function addCardToolbar(){
  const autoBtn = document.getElementById('cardAutoBtn');
  if(autoBtn && !autoBtn.dataset.bound){
    autoBtn.dataset.bound = '1';
    autoBtn.addEventListener('click', autoEquipBestCards);
  }
  const group = document.getElementById('cardFilterGroup');
  if(group && !group.dataset.bound){
    group.dataset.bound = '1';
    group.querySelectorAll('[data-rarity]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        __cardRarityFilter = btn.dataset.rarity;
        group.querySelectorAll('[data-rarity]').forEach(b=>b.classList.toggle('active', b === btn));
        renderMonsterCards();
      });
    });
  }
  updateCardSetPreview();
}
// 카드 등급 필터는 기존 renderMonsterCards()를 감싸서 적용한다(카드 정의 순서 = 그리드 순서).
// 렌더 직후 바로 숨김 처리를 하므로 화면이 잠깐 전체 목록으로 보이는 일이 없다.
function hookCardRender(){
  if(typeof renderMonsterCards !== 'function' || renderMonsterCards.__filterHooked) return;
  const original = renderMonsterCards;
  const wrapped = function(){
    const r = original.apply(this, arguments);
    try{ applyCardRarityFilter(); }catch(e){}
    return r;
  };
  wrapped.__filterHooked = true;
  renderMonsterCards = wrapped;
}
function applyCardRarityFilter(){
  const grid = document.getElementById('cardsGrid');
  if(!grid) return;
  const cards = grid.querySelectorAll('.monster-card');
  if(__cardRarityFilter === 'all'){
    cards.forEach(cardEl=>{ cardEl.style.display = ''; });
    return;
  }
  cards.forEach((cardEl, idx)=>{
    const def = CARD_DEFS[idx];
    cardEl.style.display = (def && def.rarity !== 'all' && def.rarity !== __cardRarityFilter) ? 'none' : '';
  });
}

// ---------- 5) 오프라인 보상 확장 ----------
// 자리를 비운 동안 (a) 던전/레이드 티켓이 재충전되고 (b) 영지(territory)에 쌓인 수확물을 자동 수령한다.
// 골드/경험치는 기존 computeOfflineProgress()가 이미 계산하므로 여기서는 추가분만 처리한다.
function applyExtendedOffline(elapsedSec){
  const out = {tickets: 0, territory: []};
  // (a) 티켓: 각 던전의 refresh 함수는 "마지막 충전 시각"부터의 경과분을 계산해 지급하므로 그대로 호출만 하면 된다.
  const ticketKeys = ['gdTicket', 'rdTicket', 'fdTicket', 'tdTicket', 'raidTicket'];
  const refreshFns = ['refreshGoldDungeonTickets', 'refreshRelicDungeonTickets', 'refreshForgeDungeonTickets', 'refreshTrainingDungeonTickets', 'refreshRaidTickets'];
  ticketKeys.forEach((key, i)=>{
    const before = state[key] || 0;
    const fn = window[refreshFns[i]];
    if(typeof fn === 'function') fn();
    out.tickets += Math.max(0, (state[key] || 0) - before);
  });
  // (b) 영지: 저장 상한(가득 참)까지 쌓인 항목만 자동 수령한다(일반 플레이의 수확 몫을 뺏지 않기 위해).
  if(state.territory && typeof territoryPending === 'function' && typeof collectTerritory === 'function'){
    ['gold', 'fragment', 'soul'].forEach(type=>{
      const pending = Math.floor(territoryPending(type));
      const capAmount = typeof territoryCapAmount === 'function' ? territoryCapAmount(type) : 0;
      if(pending <= 0 || pending < capAmount) return;
      const field = TERRITORY_RESOURCE_FIELD[type];
      const before = state[field];
      collectTerritory(type);
      const gained = state[field] - before;
      if(gained > 0){
        const def = typeof territoryDef === 'function' ? territoryDef(type) : null;
        out.territory.push({label: (def ? def.icon + ' ' + def.resourceLabel : type), amount: gained});
      }
    });
  }
  return out;
}

// ---------- 6) 주간 미션 ----------
// ISO 주차(월요일 시작) 기준으로 매주 초기화되는 목표 4종.
// 처치 수는 state.totalKills(누적)의 "주 시작 시점 스냅샷"과의 차이로 계산해 별도 카운터 없이도 정확하다.
const WEEKLY_MISSIONS = [
  {key:'wKill300', name:'주간 사냥꾼', desc:'변이체 300마리 처치', target:300, reward:{gold:20000}},
  {key:'wDungeon5', name:'구역 정찰', desc:'구역/레이드/월드보스 입장 5회', target:5, reward:{gold:12000, soul:1}},
  {key:'wLevel3', name:'성장의 발판', desc:'레벨 3 달성(주 시작 대비)', target:3, reward:{gold:8000}},
  {key:'wSweep10', name:'효율적인 청소', desc:'소탕 10회 실행', target:10, reward:{fragments:40}}
];
function weeklyId(date){
  const d = date ? new Date(date) : new Date();
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ensureWeekly(){
  const id = weeklyId();
  if(!state.weekly || state.weekly.id !== id){
    state.weekly = {id, killBase: state.totalKills || 0, levelBase: state.level || 1, dungeons: 0, sweeps: 0, claimed: {}};
    log('📅 새로운 주간 미션이 시작되었습니다. 이벤트 탭에서 확인하세요!', 'new');
  }
  return state.weekly;
}
function weeklyProgress(key){
  const w = ensureWeekly();
  if(key === 'wKill300') return Math.max(0, (state.totalKills || 0) - w.killBase);
  if(key === 'wDungeon5') return w.dungeons;
  if(key === 'wLevel3') return Math.max(0, (state.level || 1) - w.levelBase);
  if(key === 'wSweep10') return w.sweeps;
  return 0;
}
function trackWeeklyDungeon(n){
  const w = ensureWeekly();
  w.dungeons += (n == null ? 1 : n);
}
function trackWeeklySweep(){
  const w = ensureWeekly();
  w.sweeps += 1;
}
function claimWeeklyMission(key){
  const m = WEEKLY_MISSIONS.find(x=>x.key === key);
  const w = ensureWeekly();
  if(!m || (w.claimed && w.claimed[key])) return;
  if(weeklyProgress(key) < m.target){ notifyGame('아직 목표를 달성하지 못했습니다.', 'warn'); return; }
  w.claimed[key] = true;
  const r = m.reward || {};
  if(r.gold){ state.gold += r.gold; state.lifetimeGoldEarned += r.gold; }
  if(r.soul){ state.soul += r.soul; }
  if(r.fragments){ state.fragments += r.fragments; state.totalFragmentsEarned += r.fragments; }
  notifyGame(`📅 주간 미션 완료: ${m.name}`, 'good');
  renderWeeklyMissions();
  renderAll();
  saveState(false);
}
function renderWeeklyMissions(){
  const el = document.getElementById('weeklyMissionList');
  if(!el) return;
  const w = ensureWeekly();
  const resetEl = document.getElementById('weeklyResetText');
  if(resetEl){
    const d = new Date(w.id + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    resetEl.textContent = `(~${d.getMonth() + 1}/${d.getDate()} 까지)`;
  }
  el.innerHTML = WEEKLY_MISSIONS.map(m=>{
    const prog = weeklyProgress(m.key);
    const done = prog >= m.target;
    const claimed = !!(w.claimed && w.claimed[m.key]);
    const rewardText = Object.entries(m.reward || {}).map(([k, v])=>(
      (k === 'gold' ? `+${v.toLocaleString()}📦` : k === 'soul' ? `+${v}🧪` : `+${v}◈`)
    )).join(' ');
    return `<div class="quest-item"><div class="qhead"><div><div class="qname">${safeText(m.name)}</div>
      <div class="qdesc">${safeText(m.desc)} · ${Math.min(prog, m.target).toLocaleString()} / ${m.target.toLocaleString()} · ${rewardText}</div></div>
      <button class="claim ${claimed ? 'done' : (done ? 'ready' : '')}" data-wk="${safeText(m.key)}" ${(claimed || !done) ? 'disabled' : ''}>${claimed ? '완료' : '받기'}</button></div></div>`;
  }).join('');
  el.querySelectorAll('[data-wk]').forEach(btn=>{
    btn.addEventListener('click', ()=>claimWeeklyMission(btn.dataset.wk));
  });
}

// ---------- 7) DPS 미터 ----------
// floatText()에 찍히는 "몬스터에게 준 피해"만 골라 10초 슬라이딩 윈도우로 DPS를 계산한다.
// (플레이어가 받은 피해는 class 'dmgToPlayer', 회복/빗나감/보너스 골드는 부호가 달라 자연히 제외된다)
const DPS_WINDOW_MS = 10000;
const DPS_SAMPLES = [];
function hookDpsMeter(){
  if(typeof floatText !== 'function' || floatText.__dpsHooked) return;
  const original = floatText;
  const wrapped = function(text, cls){
    try{
      if(cls !== 'dmgToPlayer' && cls !== 'heal' && cls !== 'miss' && cls !== 'good'){
        const m = String(text).match(/(\d[\d,]*)/);
        if(m){
          const amount = parseInt(m[1].replace(/,/g, ''), 10);
          if(amount > 0) DPS_SAMPLES.push({at: Date.now(), amount});
        }
      }
    }catch(e){}
    return original.apply(this, arguments);
  };
  wrapped.__dpsHooked = true;
  floatText = wrapped;
}
function currentDps(){
  const cut = Date.now() - DPS_WINDOW_MS;
  while(DPS_SAMPLES.length && DPS_SAMPLES[0].at < cut) DPS_SAMPLES.shift();
  const total = DPS_SAMPLES.reduce((sum, s)=>sum + s.amount, 0);
  return total / (DPS_WINDOW_MS / 1000);
}
function updateDpsPanel(){
  const el = document.getElementById('dpsLine');
  if(!el) return;
  const dps = Math.round(currentDps());
  el.textContent = `⚔️ DPS(10초): ${dps.toLocaleString()}`;
}

// ---------- 8) 미니게임 점수 연동 ----------
// minigame.html(iframe)이 "도달 스테이지"를 postMessage로 알려준다.
// 보상은 자식이 주장하는 값이 아니라 부모가 기록 갱신분으로 직접 계산해 지급한다(파밍/조작 방지).
const MINIGAME_REWARD_PER_STAGE = 1000;
const MINIGAME_REWARD_GOLD_CAP = 300000;
function minigameBestText(){
  const el = document.getElementById('minigameBestText');
  if(!el) return;
  const best = (state.minigameBest && state.minigameBest.tavern) || 0;
  el.textContent = best > 0 ? `최고 도달 스테이지: ${best.toLocaleString()}` : '아직 기록이 없습니다.';
}
function handleMinigameScore(game, score){
  if(!state.minigameBest) state.minigameBest = {};
  const key = String(game || 'tavern').slice(0, 40);
  const prev = state.minigameBest[key] || 0;
  if(score <= prev){ minigameBestText(); return; }
  state.minigameBest[key] = score;
  const gold = Math.min(MINIGAME_REWARD_GOLD_CAP, Math.round(score * MINIGAME_REWARD_PER_STAGE));
  const soul = Math.floor(score / 25);
  if(gold > 0){ state.gold += gold; state.lifetimeGoldEarned += gold; }
  if(soul > 0) state.soul += soul;
  notifyGame(`🎮 미니게임 신기록! 스테이지 ${score.toLocaleString()} → +${gold.toLocaleString()}📦${soul > 0 ? ` +${soul}🧪` : ''}`, 'good');
  minigameBestText();
  renderAll();
  saveState(false);
}
function initMinigameBridge(){
  window.addEventListener('message', (event)=>{
    const data = event.data;
    if(!data || data.source !== 'lastzone-minigame') return;
    const score = Math.max(0, Math.floor(Number(data.score) || 0));
    handleMinigameScore(data.game || 'tavern', score);
  });
}

// ---------- 9) 초기화 ----------
// 구역/레이드/월드보스 입장을 감시해 주간 미션 진행도를 올린다(입장 플래그가 꺼짐→켜짐으로 바뀌는 순간만 카운트).
const SUB_ACTIVITY_KEYS = ['raidActive', 'gdActive', 'rdActive', 'wbActive', 'fdActive', 'tdActive'];
const __prevSubFlags = {};
function watchWeeklyDungeonEntries(){
  SUB_ACTIVITY_KEYS.forEach(k=>{
    const now = !!state[k];
    if(now && !__prevSubFlags[k]) trackWeeklyDungeon(1);
    __prevSubFlags[k] = now;
  });
}
function initUpgradesV23(){
  // 각 단계를 따로 감싼다 — 한 단계가 실패해도 나머지(특히 티커 시작)는 계속 진행되게.
  const step = (label, fn) => {
    try{ fn(); }catch(e){ console.warn(`[v23] ${label} 실패`, e); }
  };
  step('토스트/alert', installToastAlertOverride);
  step('소탕 버튼', addSweepButtons);
  step('카드 툴바', addCardToolbar);
  step('DPS 후킹', hookDpsMeter);
  step('카드 렌더 후킹', hookCardRender);
  step('DPS 표시', updateDpsPanel);
  step('주간 미션', ()=>{ ensureWeekly(); renderWeeklyMissions(); });
  step('미니게임 연동', ()=>{ initMinigameBridge(); minigameBestText(); });
  step('통합 티커 시작', ()=>{
    if(typeof startGameTicker === 'function') startGameTicker();
    // 유지보수 작업 등록 (탭이 백그라운드면 자동으로 건너뜀)
    if(typeof registerGameTickTask === 'function'){
      registerGameTickTask(()=>{
        addSweepButtons();
        updateDpsPanel();
        if(document.getElementById('weeklyMissionList')) renderWeeklyMissions();
      }, 5000, 'v23-upkeep');
      registerGameTickTask(()=>{
        applyCardRarityFilter();
        updateCardSetPreview();
      }, 3000, 'v23-cards');
      registerGameTickTask(watchWeeklyDungeonEntries, 1500, 'v23-weekly-dungeon');
    }
  });
}

// 로그인 이후 패널이 늦게 만들어지는 경우까지 챙기기 위해 여러 시점에서 한 번 더 시도한다.
// (initUpgradesV23 본체는 티커 등록을 하므로 1회만 실행하고, 재시도는 멱등한 UI 함수만 호출)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>initUpgradesV23());
} else {
  initUpgradesV23();
}
[500, 2500].forEach(ms=>setTimeout(()=>{
  installToastAlertOverride();
  addSweepButtons();
  addCardToolbar();
  hookDpsMeter();
  hookCardRender();
  minigameBestText();
}, ms));

