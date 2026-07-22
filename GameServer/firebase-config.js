const firebaseConfig = {
	apiKey: "AIzaSyA7mH-52xgeL3vSHsr8i1inJBYrH5hycTs",
	authDomain: "game-server-survey.firebaseapp.com",
	databaseURL: "https://game-server-survey-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "game-server-survey",
	storageBucket: "game-server-survey.firebasestorage.app",
	messagingSenderId: "227347475357",
	appId: "1:227347475357:web:249fcf58c85f2490145d74"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

const APP_ROOT = "serverWillingnessV2";
const ADMIN_UID = "h7VldICNbrYU4B2eCs1GE8ZXc0K3";
