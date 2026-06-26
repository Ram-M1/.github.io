FOCUS — приложение саморазвития (6 сфер жизни)
================================================

ТОЧКА ВХОДА: landing.html (лендинг → регистрация/вход)
Цепочка: landing → register → confirm → profile-form → index (главная)
         login → index

ЭКРАНЫ (41):
- Онбординг: landing, register, confirm, profile-form, login
- Главная и ЛК: index, status, shop, invite, notifications, fokus_progress, fokus_reward, fokus_profile
- ТЕЛО: fokus_body, fokus_nutrition (+history), fokus_workout (зарядка),
        fokus_training → fokus_workout_program/builder/session (программы), 
        fokus_body_stats, fokus_medications, fokus_supplements
- МЕНТАЛКА: fokus_mental, fokus_mood, fokus_braindump, fokus_focus_timer
- ЭНЕРГИЯ: fokus_energy, fokus_sleep, fokus_breathing, fokus_rest (медитация), fokus_energy_sources
- ОТНОШЕНИЯ: fokus_relationships
- ВЕРА: fokus_faith, fokus_gratitude, fokus_religion, fokus_faith_habits, fokus_wishmap
- Служебные-заглушки: oracle_menu, parental_control

РЕСУРСЫ: focus-theme.css, focus-storage.js, focus-core.js, focus-rewards.js, manifest.json, sw.js

ВАЖНО ДЛЯ ЗАЛИВКИ НА GITHUB PAGES:
- Назови репозиторий ЛОГИН.github.io (тогда сайт будет в корне, PWA встанет корректно)
- Данные хранятся локально в браузере (localStorage). Регистрация/синхра/оплата/AI — на этапе бэкенда (Firebase)
- Иконки icon-192.png и icon-512.png УЖЕ В ПАПКЕ — PWA установится на телефон с логотипом FOCUS

5 ТЕМ оформления переключаются в приложении (original/tron/predator/mk/matrix).
