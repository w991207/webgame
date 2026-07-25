// ---------- 탭 네비게이션 ----------
// 기능이 계속 추가되면서 한 페이지에 패널이 너무 많이 쌓여 스크롤이 길어지는 문제를 해결하기 위해
// 성장/던전/이벤트/계정 4개 구역으로 나눠서 탭으로 전환합니다.
// (모험가 스탯 / 회랑 전투 / 골드 강화는 항상 보이는 메인 화면으로 유지)

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
