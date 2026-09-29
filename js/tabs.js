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
