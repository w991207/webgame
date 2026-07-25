// ---------- Ranking (랭킹 시스템) ----------
// rankings/{uid} 문서에 닉네임/전투력/최고층을 올리고, 전투력 내림차순 상위 50명을 보여준다.

let rankingSyncStarted = false;

function startRankingSync(){
  if(rankingSyncStarted) return;
  rankingSyncStarted = true;
  pushRanking();
  setInterval(pushRanking, 20000);
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
      cp,
      highestFloor: state.highestFloor || state.floor || 1,
      towerHighestFloor: state.towerHighestFloor || 1,
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
          <span class="rk-name">${escapeHtml(d.nickname || '익명')}</span>
          <span class="rk-cp">⚡${(d.cp || 0).toLocaleString()}</span>
          <span class="rk-floor">${(d.highestFloor || 1).toLocaleString()}층</span>
        </div>
      `);
    });

    if(listEl){
      listEl.innerHTML = rowsHtml.join('') || '<div style="font-size:12px;color:var(--text-dim);">아직 등록된 랭킹이 없습니다. 닉네임을 설정하면 첫 번째로 랭킹에 오를 수 있어요!</div>';
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
