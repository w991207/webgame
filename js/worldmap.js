// ---------- 세계지도 (오픈월드 스타일 이동 UI) ----------
// 실제 필드를 걸어다니는 오픈월드 엔진을 새로 만드는 대신, 기존에 이미 존재하는 컨텐츠들
// (폐허/무한의 탑/구역/레이드/월드보스/영지/전직)을 "세계지도 위의 지역"으로 시각화해서
// 지역을 클릭하면 그 위치로 "이동"하는 연출과 함께 해당 컨텐츠 화면으로 데려다주는 방식.
// 해금 조건은 전부 각 시스템에 이미 존재하는 함수/상태를 그대로 재사용하며, 이 파일은
// 새로운 해금 로직을 만들지 않는다 (예: 무한의 탑 레벨 조건, 레이드/월드보스 100층 조건 등).

const WORLD_ZONES = [
  {
    key:'town', name:'🏘️ 마을', x:50, y:50,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-growth'},
  },
  {
    key:'ruins', name:'🏚️ 폐허', x:17, y:35,
    unlockedFn: () => true,
    action:{type:'mode', value:'normal'},
  },
  {
    key:'tower', name:'🗼 무한의 탑', x:50, y:14,
    unlockedFn: () => state.level >= TOWER_UNLOCK_LEVEL,
    lockText: `레벨 ${typeof TOWER_UNLOCK_LEVEL !== 'undefined' ? TOWER_UNLOCK_LEVEL : 10} 이상 필요`,
    action:{type:'mode', value:'tower'},
  },
  {
    key:'towerHard', name:'👑 무한의 탑(어려움)', x:70, y:20,
    unlockedFn: () => !!state.towerCleared,
    lockText: '무한의 탑(100층) 클리어 필요',
    action:{type:'mode', value:'towerHard'},
  },
  {
    key:'raid', name:'☣️ 심연 (1인 레이드)', x:83, y:35,
    unlockedFn: () => typeof raidUnlocked === 'function' && raidUnlocked(),
    lockText: '무한의 탑 100층 클리어 필요',
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'raidEnterBtn'},
  },
  {
    key:'worldBoss', name:'🧟 월드보스 유적', x:86, y:55,
    unlockedFn: () => typeof worldBossUnlocked === 'function' && worldBossUnlocked(),
    lockText: '무한의 탑 100층 클리어 필요',
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'wbEnterBtn'},
  },
  {
    key:'territory', name:'🏰 영지', x:77, y:74,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-territory'},
  },
  {
    key:'relicDungeon', name:'🗿 유산 구역', x:60, y:85,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'rdEnterBtn'},
  },
  {
    key:'forgeDungeon', name:'🔥 단조 구역', x:40, y:85,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'fdEnterBtn'},
  },
  {
    key:'trainingDungeon', name:'🥋 수련 구역', x:23, y:74,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'tdEnterBtn'},
  },
  {
    key:'goldDungeon', name:'📦 물자 구역', x:14, y:55,
    unlockedFn: () => true,
    action:{type:'tab', tab:'tab-dungeon', scrollTarget:'gdEnterBtn'},
  },
  {
    key:'job', name:'⚜️ 전직의 제단', x:31, y:20,
    unlockedFn: () => typeof jobUnlocked === 'function' && jobUnlocked(),
    lockText: `레벨 ${typeof JOB_UNLOCK_LEVEL !== 'undefined' ? JOB_UNLOCK_LEVEL : 1000} 이상 필요`,
    action:{type:'tab', tab:'tab-growth', scrollTarget:'jobPanelSection'},
  },
];

// 마을(town)을 중심으로 뻗어나가는 기본 연결선 + 진행 흐름을 보여주는 추가 연결선.
const WORLD_MAP_LINKS = [
  ['town','ruins'], ['town','tower'], ['town','towerHard'], ['town','raid'],
  ['town','worldBoss'], ['town','territory'], ['town','relicDungeon'],
  ['town','forgeDungeon'], ['town','trainingDungeon'], ['town','goldDungeon'], ['town','job'],
  ['tower','towerHard'], ['raid','worldBoss'],
  ['goldDungeon','relicDungeon'], ['relicDungeon','forgeDungeon'], ['forgeDungeon','trainingDungeon'],
];

function worldZoneByKey(key){
  return WORLD_ZONES.find(z => z.key === key);
}

function renderWorldMap(){
  const canvas = document.getElementById('worldMapCanvas');
  const svg = document.getElementById('worldMapLines');
  if(!canvas || !svg) return;

  // 연결선은 지도가 바뀌지 않으므로 최초 1회만 그린다.
  if(!svg.dataset.built){
    svg.innerHTML = WORLD_MAP_LINKS.map(([a,b])=>{
      const za = worldZoneByKey(a), zb = worldZoneByKey(b);
      if(!za || !zb) return '';
      return `<line x1="${za.x}" y1="${za.y}" x2="${zb.x}" y2="${zb.y}" class="worldmap-link" />`;
    }).join('');
    svg.dataset.built = '1';
  }

  // 노드 div는 매번 다시 그리되(해금 상태가 실시간으로 바뀔 수 있으므로), 기존 요소가 있으면 재사용.
  WORLD_ZONES.forEach(zone=>{
    let node = canvas.querySelector(`.worldmap-node[data-key="${zone.key}"]`);
    const unlocked = !!zone.unlockedFn();
    if(!node){
      node = document.createElement('div');
      node.className = 'worldmap-node';
      node.dataset.key = zone.key;
      node.style.left = zone.x + '%';
      node.style.top = zone.y + '%';
      node.innerHTML = `
        <div class="worldmap-node-icon"></div>
        <div class="worldmap-node-label"></div>
        <div class="worldmap-node-lock">🔒</div>
      `;
      node.addEventListener('click', ()=>travelToZone(zone.key));
      canvas.appendChild(node);
    }
    node.classList.toggle('locked', !unlocked);
    node.classList.toggle('home', zone.key === 'town');
    node.querySelector('.worldmap-node-icon').textContent = zone.name.split(' ')[0];
    node.querySelector('.worldmap-node-label').textContent = zone.name.split(' ').slice(1).join(' ');
    node.title = unlocked ? zone.name : `🔒 ${zone.lockText || '조건 미충족'}`;
  });
}

function openWorldMap(){
  const overlay = document.getElementById('worldMapOverlay');
  if(!overlay) return;
  renderWorldMap();
  overlay.style.display = 'flex';
}

function closeWorldMap(){
  const overlay = document.getElementById('worldMapOverlay');
  if(overlay) overlay.style.display = 'none';
}

// 마을 좌표에서 목적지 좌표까지 작은 깃발 마커가 이동하는 짧은 연출을 보여준 뒤,
// 실제 화면 전환(모드 변경 or 탭 이동)을 수행한다. 잠긴 지역은 이유를 알려주고 끝낸다.
function travelToZone(key){
  const zone = worldZoneByKey(key);
  if(!zone) return;
  if(!zone.unlockedFn()){
    alert(`🔒 아직 갈 수 없는 지역입니다.\n(${zone.lockText || '조건 미충족'})`);
    return;
  }

  const traveler = document.getElementById('worldMapTraveler');
  const town = worldZoneByKey('town');
  if(traveler && zone.key !== 'town'){
    traveler.style.transition = 'none';
    traveler.style.left = town.x + '%';
    traveler.style.top = town.y + '%';
    traveler.style.display = 'block';
    // 강제 리플로우 후 목적지로 트랜지션 이동 (연출용)
    void traveler.offsetWidth;
    traveler.style.transition = 'left .6s ease, top .6s ease';
    traveler.style.left = zone.x + '%';
    traveler.style.top = zone.y + '%';
  }

  setTimeout(()=>{
    executeZoneAction(zone);
    if(traveler) traveler.style.display = 'none';
    closeWorldMap();
  }, (traveler && zone.key !== 'town') ? 650 : 0);
}

function executeZoneAction(zone){
  const a = zone.action;
  if(a.type === 'mode'){
    if(typeof setMode === 'function') setMode(a.value);
  } else if(a.type === 'tab'){
    const tabBtn = document.querySelector(`.tab-nav-btn[data-tab="${a.tab}"]`);
    if(tabBtn) tabBtn.click();
    if(a.scrollTarget){
      setTimeout(()=>{
        const el = document.getElementById(a.scrollTarget);
        if(el){
          el.scrollIntoView({behavior:'smooth', block:'center'});
          const panel = el.closest('.panel');
          if(panel){
            panel.classList.add('worldmap-highlight');
            setTimeout(()=>panel.classList.remove('worldmap-highlight'), 1600);
          }
        }
      }, 80);
    }
  }
  log(`🗺️ ${zone.name}(으)로 이동했습니다.`, 'new');
}

document.getElementById('worldMapOpenBtn')?.addEventListener('click', openWorldMap);
document.getElementById('worldMapCloseBtn')?.addEventListener('click', closeWorldMap);
document.getElementById('worldMapOverlay')?.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'worldMapOverlay') closeWorldMap();
});
