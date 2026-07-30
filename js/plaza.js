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
        <span class="rk-cp">⚡${(d.cp || 0).toLocaleString()}</span>
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

function plazaRenderChat(docs){
  const logEl = document.getElementById('plazaChatLog');
  if(!logEl) return;
  const wasAtBottom = (logEl.scrollTop + logEl.clientHeight) >= (logEl.scrollHeight - 20);

  // Firestore에서 최신순(desc)으로 받아오므로 화면 표시는 오래된 순으로 뒤집는다.
  const ordered = docs.slice().reverse();
  logEl.innerHTML = ordered.map(d => `
    <div class="plaza-chat-line">
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
