/* FOCUS — единый слой данных (FocusStorage)
   Подключать на каждом экране: <script src="focus-storage.js"></script>

   ВАЖНО ДЛЯ БУДУЩЕГО ПЕРЕНОСА НА FIREBASE:
   Структура объекта focus_user ниже специально сделана такой, какой будет
   документ пользователя в Firestore (users/{uid}). Когда подключим бэкенд —
   меняется только ТЕЛО функций getUser/saveUser (на firestore.get/set),
   а все экраны, которые вызывают методы FocusStorage, не трогаем вообще.

   АРХИТЕКТУРА "ПОД ВСЁ СРАЗУ": здесь заложены методы, которые понадобятся
   будущим экранам (сферы, начисление за активность, сгорание монет, рефералы),
   даже если их пока некому вызывать. Это профилактика переделок — когда
   появятся экраны сфер, данные просто "встанут на место".
*/

const FOCUS_STORAGE_KEY = 'focus_user';

const FocusStorage = {

    /** Полная структура пользователя по умолчанию — единый источник правды о форме данных.
     *  Зеркало будущего Firestore-документа users/{uid}. */
    _defaults() {
        return {
            // --- профиль ---
            email: null,
            password: null,        // ⚠️ убрать при подключении Firebase Auth (хранит сам Firebase)
            name: null,
            age: null,
            city: null,
            phone: null,
            avatar: null,

            // --- экономика ---
            coins: 0,
            theme: 'original',

            // --- подписка ---
            subscription: null,        // 'Лайт' | 'Плюс' | 'Про' | null
            subscriptionUntil: null,   // ISO-дата окончания

            // --- активность по сферам (заполняется экранами сфер) ---
            // Структура: { sphereId: { actionId: { count, lastDate, history:[] } } }
            activity: {},

            // --- недельные критерии бесплатного доступа (статус) ---
            weekStats: {
                workout: 0,        // дней зарядки за неделю
                sleep: 0,          // дней сна
                gratitude: 0,      // дней с 3 записями благодарности
                tasksDone: false,  // закрыт ли хотя бы 1 висяк за 3 дня
                weekStartDate: null
            },

            // --- рефералы (реферальная программа) ---
            referral: {
                code: null,            // собственный Friend Code
                invitedBy: null,       // кто пригласил
                invited: [],           // [{ name, status:'pending'|'active', date }]
                activeCount: 0,        // сколько приглашённых стали активными
                hasPaidInvite: false   // есть ли премиум-приглашение
            },

            // --- флаги состояния ---
            flags: {
                emailConfirmed: false,
                demoUsed: false,
                demoMode: false,
                profileCompleted: false
            }
        };
    },

    /** Глубокое слияние с дефолтами (чтобы вложенные объекты не терялись) */
    _mergeDefaults(parsed) {
        const d = this._defaults();
        return {
            ...d,
            ...parsed,
            subscription: parsed.subscription ?? d.subscription,
            subscriptionUntil: parsed.subscriptionUntil ?? d.subscriptionUntil,
            activity: { ...d.activity, ...(parsed.activity || {}) },
            weekStats: { ...d.weekStats, ...(parsed.weekStats || {}) },
            referral: { ...d.referral, ...(parsed.referral || {}) },
            flags: { ...d.flags, ...(parsed.flags || {}) }
        };
    },

    /** Получить текущего пользователя. Всегда возвращает полный объект с дефолтами. */
    getUser() {
        try {
            const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
            if (!raw) return this._migrateLegacy();
            return this._mergeDefaults(JSON.parse(raw));
        } catch (e) {
            console.warn('FocusStorage: повреждённые данные, сброс на дефолт', e);
            return this._defaults();
        }
    },

    /** Миграция со старых разрозненных ключей localStorage. */
    _migrateLegacy() {
        const legacy = {
            email: localStorage.getItem('focus_user_email'),
            password: localStorage.getItem('focus_user_password'),
            name: localStorage.getItem('focus_user_name'),
            age: localStorage.getItem('focus_user_age'),
            city: localStorage.getItem('focus_user_city'),
            phone: localStorage.getItem('focus_user_phone'),
            coins: parseInt(localStorage.getItem('focus_coins')) || 0,
            theme: localStorage.getItem('focus_theme'),
            flags: {
                emailConfirmed: localStorage.getItem('focus_email_confirmed') === 'true',
                demoUsed: localStorage.getItem('focus_demo_used') === 'true',
                demoMode: localStorage.getItem('focus_demo_mode') === 'true',
                profileCompleted: localStorage.getItem('focus_profile_completed') === 'true'
            }
        };
        const hasLegacyData = legacy.email || legacy.name || legacy.theme;
        const merged = this._mergeDefaults(legacy);
        if (hasLegacyData) {
            localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(merged));
        }
        return merged;
    },

    /** Сохранить (слиянием) часть данных пользователя. */
    saveUser(partial) {
        const current = this.getUser();
        const merged = {
            ...current,
            ...partial,
            activity: { ...current.activity, ...(partial.activity || {}) },
            weekStats: { ...current.weekStats, ...(partial.weekStats || {}) },
            referral: { ...current.referral, ...(partial.referral || {}) },
            flags: { ...current.flags, ...(partial.flags || {}) }
        };
        localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
    },

    // ========== ЭКОНОМИКА ==========

    /** Добавить монеты к балансу */
    addCoins(amount) {
        const newBalance = (this.getUser().coins || 0) + amount;
        this.saveUser({ coins: newBalance });
        return newBalance;
    },

    /** Списать монеты (например при покупке) */
    spendCoins(amount) {
        const cur = this.getUser().coins || 0;
        const newBalance = Math.max(0, cur - amount);
        this.saveUser({ coins: newBalance });
        return newBalance;
    },

    /** Сгорание монет при невыполнении недельных условий.
     *  По правилам: без премиум-приглашения сгорает 75% баланса. */
    burnCoins(percent = 75) {
        const cur = this.getUser().coins || 0;
        const remaining = Math.round(cur * (1 - percent / 100));
        this.saveUser({ coins: remaining });
        return { burned: cur - remaining, remaining };
    },

    // ========== ТЕМА ОФОРМЛЕНИЯ ==========

    /** Текущая тема (для applyStoredTheme и переключателя) */
    getTheme() {
        return this.getUser().theme || 'original';
    },
    /** Сохранить выбранную тему */
    setTheme(themeId) {
        this.saveUser({ theme: themeId });
    },

    // ========== ПОДПИСКА ==========

    /** Активировать подписку на N дней (по умолчанию 30) */
    setSubscription(planName, days = 30) {
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        this.saveUser({ subscription: planName, subscriptionUntil: until });
        return until;
    },

    /** Активна ли подписка прямо сейчас */
    hasActiveSubscription() {
        const u = this.getUser();
        if (!u.subscription || !u.subscriptionUntil) return false;
        return new Date(u.subscriptionUntil).getTime() > Date.now();
    },

    /** Сколько дней осталось до конца подписки (0 если нет/истекла) */
    subscriptionDaysLeft() {
        const u = this.getUser();
        if (!this.hasActiveSubscription()) return 0;
        const ms = new Date(u.subscriptionUntil).getTime() - Date.now();
        return Math.ceil(ms / (24 * 60 * 60 * 1000));
    },

    // ========== АКТИВНОСТЬ ПО СФЕРАМ (для будущих экранов сфер) ==========

    /** Записать выполненное действие в сфере.
     *  Пример: FocusStorage.addActivity('body', 'workout')
     *  Эти данные потом питают экран "Статус" реальными числами. */
    addActivity(sphereId, actionId) {
        const u = this.getUser();
        const activity = { ...u.activity };
        if (!activity[sphereId]) activity[sphereId] = {};
        if (!activity[sphereId][actionId]) {
            activity[sphereId][actionId] = { count: 0, lastDate: null, history: [] };
        }
        const today = new Date().toISOString().slice(0, 10);
        activity[sphereId][actionId].count += 1;
        activity[sphereId][actionId].lastDate = today;
        activity[sphereId][actionId].history.push(today);
        this.saveUser({ activity });
        return activity[sphereId][actionId];
    },

    /** Получить статистику по действию в сфере */
    getActivity(sphereId, actionId) {
        const u = this.getUser();
        return (u.activity[sphereId] && u.activity[sphereId][actionId]) || { count: 0, lastDate: null, history: [] };
    },

    // ========== РЕФЕРАЛЫ ==========

    /** Сгенерировать (один раз) собственный Friend Code */
    getOrCreateReferralCode() {
        const u = this.getUser();
        if (u.referral.code) return u.referral.code;
        const code = 'FOCUS-' + Math.random().toString(36).slice(2, 7).toUpperCase();
        this.saveUser({ referral: { ...u.referral, code } });
        return code;
    },

    // ========== СЕССИЯ ==========

    /** Полный сброс — для тестирования или "выйти из аккаунта" */
    clear() {
        localStorage.removeItem(FOCUS_STORAGE_KEY);
    }
};
