// ---------- Coupon Render & Submit Logic ----------
function renderCouponList(){
  const grid = document.getElementById('couponGrid');
  if(!grid) return;
  grid.innerHTML = '';

  const statusLine = document.createElement('div');
  statusLine.style.fontSize = '11px';
  statusLine.style.marginBottom = '8px';
  statusLine.style.fontFamily = "'JetBrains Mono',monospace";
  if(couponSourceStatus === 'json'){
    statusLine.style.color = 'var(--frag)';
    statusLine.textContent = '✓ coupons.json 외부 목록 로드됨';
  } else if(couponSourceStatus === 'error'){
    statusLine.style.color = 'var(--hp)';
    statusLine.textContent = '⚠ coupons.json 로드 실패 — 기본 내장 목록만 사용 중 (콘솔 확인 필요)';
  } else {
    statusLine.style.color = 'var(--text-dim)';
    statusLine.textContent = '기본 내장 목록 사용 중';
  }
  grid.appendChild(statusLine);

  if(couponsList.length === 0){
    grid.innerHTML += '<div style="font-size:12px; color:var(--text-dim);">등록된 쿠폰이 없습니다.</div>';
    return;
  }

  couponsList.forEach(c => {
    const isUsed = !!(state.usedCoupons && state.usedCoupons[c.code]);
    const card = document.createElement('div');
    card.className = `coupon-card ${isUsed ? 'used' : ''}`;
    
    card.innerHTML = `
      <div class="c-info">
        <div class="c-code">${c.code}</div>
        <div class="c-desc">${c.description || '유물 파편 보상'} (+${c.reward || 5}◈)</div>
      </div>
      <span class="c-status ${isUsed ? 'done' : 'available'}">${isUsed ? '사용 완료' : '사용 가능'}</span>
    `;

    if(!isUsed){
      card.addEventListener('click', () => {
        document.getElementById('couponInput').value = c.code;
      });
    }

    grid.appendChild(card);
  });
}

document.getElementById('couponSubmitBtn').addEventListener('click', ()=>{
  const input = document.getElementById('couponInput');
  const code = input.value.trim().toUpperCase();

  if(!code){
    alert('쿠폰 코드를 입력하세요.');
    return;
  }

  if(code.length !== 10){
    alert('쿠폰 코드는 10자리이어야 합니다.');
    return;
  }

  if(!validCouponsMap[code]){
    alert('존재하지 않거나 유효하지 않은 쿠폰 코드입니다.');
    return;
  }

  if(state.usedCoupons[code]){
    alert('이미 사용 완료된 쿠폰입니다.');
    return;
  }

  const rewardCount = validCouponsMap[code] || 5;
  state.usedCoupons[code] = true;
  state.fragments += rewardCount;
  input.value = '';
  alert(`쿠폰 [${code}] 등록 성공!\n◈ 유물 파편 ${rewardCount}개가 지급되었습니다.`);
  log(`쿠폰 [${code}] 사용 완료! ◈ 유물 파편 ${rewardCount}개 획득!`, 'good');
  renderAll();
});

