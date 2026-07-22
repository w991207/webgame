const STORAGE_KEY = 'twilight-corridor-save-v2';
const LOCAL_PREFIX = 'twilight-corridor-';
const hasCloudStorage = (typeof window.storage !== 'undefined' && window.storage !== null);

async function storageGet(key){
  if(hasCloudStorage){
    try{ 
      const res = await window.storage.get(key, false);
      if(res && res.value) return res;
    }catch(e){ /* fall through */ }
  }
  try{
    const v = window.localStorage.getItem(LOCAL_PREFIX+key);
    return v !== null ? {key, value:v, shared:false} : null;
  }catch(e){ return null; }
}

async function storageSet(key, value){
  let localSuccess = false;
  try{
    window.localStorage.setItem(LOCAL_PREFIX+key, value);
    localSuccess = true;
  }catch(e){ }

  if(hasCloudStorage){
    try{ await window.storage.set(key, value, false); }
    catch(e){ }
  }
  return localSuccess ? {key, value, shared:false} : null;
}

// 기본 내장 쿠폰 데이터 (JSON 로드 실패 시 또는 단일 파일 로드용)
const DEFAULT_COUPONS = [
  { "code": "TWILIGHT01", "reward": 5, "description": "기본 유물 파편 보상" },
  { "code": "TWILIGHT02", "reward": 5, "description": "기본 유물 파편 보상" },
  { "code": "EVENT2026A", "reward": 5, "description": "이벤트 유물 파편 보상" },
  { "code": "REICFRAG05", "reward": 5, "description": "유물 파편 지급 쿠폰" },
  { "code": "WELCOME202", "reward": 5, "description": "신규 환영 쿠폰" },
  { "code": "COUPON1538", "reward": 5, "description": "특별 보상 쿠폰 1" },
  { "code": "COUPON1539", "reward": 5, "description": "특별 보상 쿠폰 2" }
];

// 외부 쿠폰 목록 담는 변수
let validCouponsMap = {};
let couponsList = []; // 쿠폰 전체 데이터 보관
let couponSourceStatus = 'default'; // 'default' | 'json' | 'error' — 어디서 목록이 왔는지 표시용
let knownCouponCodes = null; // 이전에 확인한 코드 집합 (신규 감지용, null이면 아직 첫 로드 전)

function setupCouponsData(dataArray) {
  couponsList = dataArray;
  validCouponsMap = {};
  dataArray.forEach(c => {
    validCouponsMap[c.code] = c.reward || 5;
  });
}

function showNewCouponModal(newCodes){
  const modal = document.getElementById('newCouponModal');
  const textEl = document.getElementById('newCouponListText');
  if(!modal || !textEl) return;
  textEl.innerHTML = newCodes.map(c=>`<b>${c}</b>`).join(', ') + ' 코드가 새로 등록되었습니다.<br>목록에서 바로 확인해보세요!';
  modal.style.display = 'flex';
}

async function loadCouponsJSON(isPeriodicCheck){
  if(!isPeriodicCheck){
    // 최초 로드 시에만 기본 쿠폰으로 임시 세팅 (폴백)
    setupCouponsData(DEFAULT_COUPONS);
    couponSourceStatus = 'default';
  }

  try {
    const res = await fetch('coupons.json?t=' + new Date().getTime(), {cache:'no-store'});
    if(!res.ok){
      console.warn(`coupons.json 요청 실패 (HTTP ${res.status}). 파일 경로/이름을 확인하세요.`);
      if(!isPeriodicCheck) couponSourceStatus = 'error';
      return;
    }
    const data = await res.json();
    if(data && Array.isArray(data.coupons) && data.coupons.length > 0) {
      const newCodeSet = new Set(data.coupons.map(c=>c.code));
      if(knownCouponCodes !== null){
        const newlyAdded = [...newCodeSet].filter(code => !knownCouponCodes.has(code));
        if(newlyAdded.length > 0){
          setupCouponsData(data.coupons);
          couponSourceStatus = 'json';
          renderCouponList();
          log(`🎟️ 신규 쿠폰 등록: ${newlyAdded.join(', ')}`, 'good');
          showNewCouponModal(newlyAdded);
        }
      } else {
        setupCouponsData(data.coupons);
        couponSourceStatus = 'json';
      }
      knownCouponCodes = newCodeSet;
      console.log(`coupons.json 로드 성공: ${data.coupons.length}개 코드`);
    } else {
      console.warn('coupons.json 형식이 올바르지 않습니다 ({"coupons":[...]} 형태여야 함).');
      if(!isPeriodicCheck) couponSourceStatus = 'error';
    }
  } catch(e) {
    console.warn('coupons.json을 불러오거나 파싱하는 데 실패했습니다 (JSON 문법 오류일 수 있음).', e);
    if(!isPeriodicCheck) couponSourceStatus = 'error';
  }
}
