function isSameDay(a,b){

const d1=new Date(a);

const d2=new Date(b);

return d1.getFullYear()==d2.getFullYear()
&&d1.getMonth()==d2.getMonth()
&&d1.getDate()==d2.getDate();

}

function renderAttendance(){

const grid=document.getElementById("attendanceGrid");

if(!grid)return;

grid.innerHTML="";

ATTENDANCE_REWARDS.forEach((r,i)=>{

const div=document.createElement("div");

div.className="attendance-card";

if(i<state.attendance.day)
div.classList.add("done");

if(i==state.attendance.day)
div.classList.add("today");

div.innerHTML=`

<div class="attendance-day">${i+1}일</div>

<div>${r.text}</div>

`;

grid.appendChild(div);

});

}

function claimAttendance(){

if(isSameDay(state.attendance.lastClaim,Date.now())){

alert("오늘은 이미 출석했습니다.");

return;

}

const reward=ATTENDANCE_REWARDS[state.attendance.day];

switch(reward.type){

case "gold":

state.gold+=reward.amount;

break;

case "soul":

state.soul+=reward.amount;

break;

case "frag":

state.fragments+=reward.amount;

break;

case "special":

pullRelic();

state.soul+=50;

break;

}

state.attendance.lastClaim=Date.now();

state.attendance.day++;

if(state.attendance.day>=7){

state.attendance.day=0;

}

log("📅 출석 보상 획득!", "good");

renderAttendance();

renderAll();

saveState();

}

document
.getElementById("attendanceBtn")
.onclick=claimAttendance;