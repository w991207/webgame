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
