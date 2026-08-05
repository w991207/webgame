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

async function storageSet(key, value, force){
  let localSuccess = false;
  try{
    window.localStorage.setItem(LOCAL_PREFIX+key, value);
    localSuccess = true;
  }catch(e){ }

  if(hasCloudStorage){
    try{ await window.storage.set(key, value, false); }
    catch(e){ }
  }

  // Firebase 계정에 로그인/게스트로 연결되어 있다면 세이브를 클라우드에도 백업 (실패해도 로컬 저장에는 영향 없음)
  // 로컬 저장은 5초마다 계속 돌지만, 클라우드는 Firestore 무료 할당량을 아끼기 위해 내부적으로 쓰기 빈도를 제한한다.
  if(key === 'save' && typeof cloudPushSave === 'function'){
    cloudPushSave(value, !!force);
  }

  return localSuccess ? {key, value, shared:false} : null;
}
