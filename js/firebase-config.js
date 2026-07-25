// ⚠️ 이 파일은 반드시 본인의 Firebase 프로젝트 값으로 교체해야 로그인/랭킹 기능이 동작합니다.
//
// 설정 방법:
// 1. https://console.firebase.google.com 에서 새 프로젝트를 만듭니다.
// 2. 왼쪽 메뉴 [Authentication] > [Sign-in method] 에서 다음 3개를 '사용 설정'으로 켭니다:
//      - 익명(Anonymous)
//      - 이메일/비밀번호(Email/Password)
//      - Google
// 3. 왼쪽 메뉴 [Firestore Database] > [데이터베이스 만들기] 로 Firestore를 생성합니다 (프로덕션 모드 권장).
//    생성 후 [규칙] 탭에서 이 프로젝트에 포함된 firestore.rules 내용을 붙여넣고 [게시]하세요.
// 4. [프로젝트 설정](톱니바퀴 아이콘) > 하단 '내 앱'에서 웹 앱(</>)을 추가하면
//    아래와 형태가 같은 firebaseConfig 값이 발급됩니다. 그 값을 아래에 그대로 붙여넣으세요.
const firebaseConfig = {
  apiKey: "AIzaSyBeXLaP_WVnN-p0YVP9J-pcJFBhBsEPod8",
  authDomain: "webgame-f0b44.firebaseapp.com",
  projectId: "webgame-f0b44",
  storageBucket: "webgame-f0b44.firebasestorage.app",
  messagingSenderId: "477604575330",
  appId: "1:477604575330:web:c10fd1c066cc6cf990f93b",
  measurementId: "G-89RKMSQF9C"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
