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

          const useCloud = confirm(
            '이 계정에 더 최신 진행 상황이 있습니다.\n\n' +
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
      const ok = confirm('이미 가입된 Google 계정입니다. 그 계정으로 로그인할까요?\n(현재 기기의 진행 상황은 그 계정 데이터로 대체될 수 있습니다)');
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
  if(!confirm('로그아웃하시겠습니까? (다음 접속 시 새 게스트로 시작하며, 다시 로그인하면 이 계정 데이터로 이어할 수 있습니다)')) return;
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
    ? '정말 탈퇴하시겠습니까?\n\n지금까지의 진행 상황(캐릭터, 재화, 랭킹)이 이 기기에서 영구적으로 삭제되며 되돌릴 수 없습니다.'
    : '정말 탈퇴하시겠습니까?\n\n계정에 저장된 모든 진행 상황(캐릭터, 재화, 랭킹)이 영구적으로 삭제되며 되돌릴 수 없습니다.';
  if(!confirm(warn)) return;

  const typed = prompt('되돌릴 수 없습니다. 계속하려면 아래 칸에 "탈퇴"를 입력해주세요.');
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
      const pw = prompt('보안을 위해 비밀번호를 다시 입력해주세요.');
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
