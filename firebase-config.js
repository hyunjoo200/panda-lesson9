/* =====================================================================
   온라인 결과 저장 설정 (firebase-config.js)
   ---------------------------------------------------------------------
   설정 안내서(설정안내.html)의 4단계에서 Firebase가 보여 주는 값을
   아래 따옴표 안에 그대로 붙여 넣으세요.
   비워 두면 게임은 그대로 되지만, 결과·순위는 각자 기기에만 남습니다.
   (이 값은 비밀번호가 아니라 '어느 저장소에 연결할지' 알려 주는 주소예요.
    실제 보호는 Firebase 보안 규칙이 합니다.)
   ===================================================================== */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpqkSOPpfrcM4bmVS_C5UCQ_a2g6ptfLc",
  authDomain: "panda-8ff49.firebaseapp.com",
  projectId: "panda-8ff49",
  storageBucket: "panda-8ff49.firebasestorage.app",
  messagingSenderId: "685446665365",
  appId: "1:685446665365:web:4da061ffcf499d96d8b79c",
  measurementId: "G-P0WF56K2S2"
};

/* 순위표: 학생 화면에 반 친구들의 순위를 보여 줄까요? (true = 보여 줌, false = 숨김) */
window.SHOW_RANKING = true;
