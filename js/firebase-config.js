/**
 * Firebase 설정 파일
 */

// Firebase 구성
const firebaseConfig = {
  apiKey: "AIzaSyCjLMppX3tpEwagPE-LelcnmLjeva7Qgpk",
  authDomain: "liargame-cfec3.firebaseapp.com",
  databaseURL: "https://liargame-cfec3-default-rtdb.firebaseio.com", // 추가된 부분 (Realtime Database URL)
  projectId: "liargame-cfec3",
  storageBucket: "liargame-cfec3.firebasestorage.app",
  messagingSenderId: "852902531682",
  appId: "1:852902531682:web:e4cc00b6cbd7b09950773b",
  measurementId: "G-CSTJQ7RQ93"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// 데이터베이스 참조 생성
const database = firebase.database();
