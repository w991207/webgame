// ---------- 통합 게임 티커 ----------
// 흩어져 있던 setInterval들(티켓 충전/패널 갱신/랭킹 푸시 등)을 하나의 1초 드라이버로 모은다.
//  ① 타이머 개수를 줄여 모바일에서 배터리/발열 부담을 낮추고
//  ② 탭이 백그라운드(document.hidden)면 아무 것도 하지 않는다(어차피 화면에 안 보이는 연산).
// 전투 틱(schedulePlayerTick/MonsterTick)은 게임 진행 자체라 여기에 넣지 않는다.
const GAME_TICK_TASKS = [];
function registerGameTickTask(fn, everyMs, label){
  if(typeof fn !== 'function') return null;
  const task = {fn, everyMs: Math.max(250, everyMs || 1000), last: 0, label: label || ''};
  GAME_TICK_TASKS.push(task);
  return task;
}
function runGameTickTasks(force){
  if(!force && document.hidden) return;
  const now = Date.now();
  for(const t of GAME_TICK_TASKS){
    if(!force && now - t.last < t.everyMs) continue;
    t.last = now;
    try{ t.fn(); }catch(e){ console.warn('[tick]', t.label, e); }
  }
}
// 백그라운드에서 돌아왔을 때: 밀린 티켓 충전/영지 수확을 즉시 반영하고 화면을 다시 그린다.
function catchUpAfterResume(){
  [
    'refreshRaidTickets',
    'refreshGoldDungeonTickets', 'refreshRelicDungeonTickets',
    'refreshForgeDungeonTickets', 'refreshTrainingDungeonTickets',
  ].forEach(name=>{
    const fn = window[name];
    if(typeof fn === 'function'){ try{ fn(); }catch(e){} }
  });
  if(typeof renderAll === 'function') renderAll();
}
let __gameTickHandle = null;
function startGameTicker(){
  if(__gameTickHandle) return;
  __gameTickHandle = setInterval(()=>runGameTickTasks(false), 1000);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) return;
    runGameTickTasks(true);
    catchUpAfterResume();
  });
}
