/* FOCUS — помощник аутентификации Firebase
   Подключать как модуль ПОСЛЕ firebase-config.js:
   <script type="module" src="firebase-auth-helper.js"></script>

   Даёт глобальные функции (через window), которые можно звать из обычных скриптов:
   - window.fbRegister(email, password) → Promise<{ok, error}>
   - window.fbLogin(email, password) → Promise<{ok, error}>
   - window.fbLogout() → Promise
   - window.fbCurrentUser() → user | null
   - window.fbSaveUserData(data) → Promise (сохранить профиль в Firestore)
   - window.fbLoadUserData() → Promise<data|null> (загрузить профиль)
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyASAdRxYNELOEwCQyAKPSecLBIHrqNoap4",
  authDomain: "focus-21230.firebaseapp.com",
  projectId: "focus-21230",
  storageBucket: "focus-21230.firebasestorage.app",
  messagingSenderId: "510337267182",
  appId: "1:510337267182:web:934b4f2f816e58e594caff",
  measurementId: "G-GNBE6QH8YK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// перевод ошибок Firebase на русский
function ruError(code) {
  const map = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль слишком простой (минимум 6 символов)',
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток, попробуйте позже',
    'auth/network-request-failed': 'Нет соединения с интернетом'
  };
  return map[code] || ('Ошибка: ' + code);
}

// регистрация
window.fbRegister = async function(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { ok: true, uid: cred.user.uid };
  } catch (e) {
    return { ok: false, error: ruError(e.code) };
  }
};

// вход
window.fbLogin = async function(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, uid: cred.user.uid };
  } catch (e) {
    return { ok: false, error: ruError(e.code) };
  }
};

// выход
window.fbLogout = async function() {
  try { await signOut(auth); return { ok: true }; }
  catch (e) { return { ok: false, error: ruError(e.code) }; }
};

// текущий пользователь — храним актуальное значение через слушатель сессии
let _currentUser = null;
onAuthStateChanged(auth, (user) => {
  _currentUser = user;
  // когда сессия восстановилась — синкаем локальные данные в облако (одним разом)
  if (user && window.FocusStorage && typeof window.FocusStorage.getUser === 'function') {
    try {
      const d = window.FocusStorage.getUser();
      window.fbSaveUserData({
        name: d.name || '', age: d.age || '', city: d.city || '', phone: d.phone || '',
        coins: d.coins || 0, subscription: d.subscription || null,
        subscriptionUntil: d.subscriptionUntil || null, theme: d.theme || 'original',
        activity: d.activity || {}, weekStats: d.weekStats || {},
        referral: d.referral || {}, flags: d.flags || {},
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    } catch(e){}
  }
});
window.fbCurrentUser = function() { return _currentUser || auth.currentUser; };

// сохранить данные профиля пользователя в Firestore
window.fbSaveUserData = async function(data) {
  const user = _currentUser || auth.currentUser;
  if (!user) return { ok: false, error: 'Не авторизован' };
  try {
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// загрузить данные профиля из Firestore
window.fbLoadUserData = async function() {
  const user = _currentUser || auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
};

// следить за состоянием входа
window.fbOnAuthChange = function(callback) {
  onAuthStateChanged(auth, callback);
};

// сигнал готовности
window.FB_AUTH_READY = true;
window.dispatchEvent(new Event('fb-auth-ready'));
console.log('🔥 Firebase Auth готов');
