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
