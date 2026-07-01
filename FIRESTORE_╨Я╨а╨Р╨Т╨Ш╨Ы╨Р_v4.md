# 🔒 Правила Firestore v4 (ФИНАЛ — чат + контакты + переводы)

## Как обновить
Firebase Console → Firestore → Rules → вставь код (БЕЗ ```), Publish.
Начинай с rules_version, без тройных кавычек!

## Код:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;

      match /tasks/{taskId} {
        allow read, write: if request.auth != null;
      }
      match /chatList/{chatId} {
        allow read, write: if request.auth != null;
      }
      match /contacts/{contactId} {
        allow read, write: if request.auth != null;
      }
    }

    match /pairing_codes/{code} {
      allow read, write: if request.auth != null;
    }

    match /chats/{chatId} {
      allow read, write: if request.auth != null;
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}

## Что заработает после этого
- Поиск по телефону (любой формат номера) ✅
- Чат в реальном времени ✅
- Фото в чате ✅
- Файлы/документы в чате ✅
- Перевод F-coin между пользователями ✅
- Добавление в контакты ✅
