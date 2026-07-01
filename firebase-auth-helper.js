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
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion
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

// ========== ПРИВЯЗКА РОДИТЕЛЬ ↔ РЕБЁНОК (по коду) ==========

// Родитель: создать код привязки. Код сохраняется в pairing_codes/{code} → uid родителя
window.fbCreatePairCode = async function() {
  const user = _currentUser || auth.currentUser;
  if (!user) return { ok: false, error: 'Не авторизован' };
  // короткий читаемый код
  const code = 'F' + Math.random().toString(36).slice(2, 7).toUpperCase();
  try {
    await setDoc(doc(db, 'pairing_codes', code), {
      parentUid: user.uid,
      createdAt: new Date().toISOString(),
      used: false
    });
    return { ok: true, code };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// Ребёнок: ввести код → связать аккаунты.
// В документе ребёнка пишем parentUid, в документе родителя добавляем childUid в массив children
window.fbLinkByCode = async function(code) {
  const user = _currentUser || auth.currentUser;
  if (!user) return { ok: false, error: 'Не авторизован' };
  code = (code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Введите код' };
  try {
    const codeSnap = await getDoc(doc(db, 'pairing_codes', code));
    if (!codeSnap.exists()) return { ok: false, error: 'Код не найден' };
    const parentUid = codeSnap.data().parentUid;
    if (parentUid === user.uid) return { ok: false, error: 'Нельзя привязать себя' };
    // ребёнок → запоминает родителя
    await setDoc(doc(db, 'users', user.uid), { parentUid: parentUid }, { merge: true });
    // родитель → добавляет ребёнка в список
    await setDoc(doc(db, 'users', parentUid), { children: arrayUnion(user.uid) }, { merge: true });
    // помечаем код использованным
    await setDoc(doc(db, 'pairing_codes', code), { used: true, childUid: user.uid }, { merge: true });
    return { ok: true, parentUid };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// Родитель: получить данные всех своих детей (для отслеживания активности)
window.fbGetChildren = async function() {
  const user = _currentUser || auth.currentUser;
  if (!user) return [];
  try {
    const meSnap = await getDoc(doc(db, 'users', user.uid));
    if (!meSnap.exists()) return [];
    const childUids = meSnap.data().children || [];
    const children = [];
    for (const uid of childUids) {
      const cSnap = await getDoc(doc(db, 'users', uid));
      if (cSnap.exists()) children.push({ uid, ...cSnap.data() });
    }
    return children;
  } catch (e) {
    return [];
  }
};

// Родитель: отправить задание ребёнку
window.fbSendChildTask = async function(childUid, task) {
  const user = _currentUser || auth.currentUser;
  if (!user) return { ok: false, error: 'Не авторизован' };
  try {
    const taskId = 'task_' + Date.now();
    await setDoc(doc(db, 'users', childUid, 'tasks', taskId), {
      text: task.text || '',
      sphere: task.sphere || '',
      reward: task.reward || 0,
      from: user.uid,
      done: false,
      createdAt: new Date().toISOString()
    });
    return { ok: true, taskId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// Ребёнок: получить свои задания
window.fbGetChildTasks = async function() {
  const user = _currentUser || auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDocs(collection(db, 'users', user.uid, 'tasks'));
    const tasks = [];
    snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
    return tasks;
  } catch (e) {
    return [];
  }
};

// сигнал готовности
window.FB_AUTH_READY = true;
window.dispatchEvent(new Event('fb-auth-ready'));
console.log('🔥 Firebase Auth готов');
