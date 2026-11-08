# Shellius — План реализации

## Фаза 1 — Безопасность (критично перед любым деплоем)

### 1.1 Подключить шифрование данных
- [x] В `session_manager.go` при vault.create/update шифровать `password_enc`, `notes_enc`, `totp_secret_enc` через `crypto/encrypt.go` (AES-256-GCM + Argon2id) (done)
- [x] При vault.list — расшифровывать перед отдачей (done)
- [x] Шифровать `hosts.password_enc`, `keys.private_key_enc`, `keys.passphrase_enc` (done)
- [x] Решить вопрос с мастер-паролем: мастер-пароль при старте → Argon2id → ключ шифрования (done)

### 1.2 Known hosts verification
- [x] Заменить `InsecureIgnoreHostKey()` на проверку `known_hosts` в SQLite (done)
- [x] При первом подключении — отправить fingerprint на фронтенд, запросить подтверждение (done)
- [x] Добавить новый тип сообщения `ssh.host_verify` / `ssh.host_confirm` (done)

---

## Фаза 2 — Деплой Cloud Server

### 2.1 Подготовка сервера
- [ ] VPS (Ubuntu 22/24) — минимум 1 vCPU, 1 GB RAM
- [ ] Установить PostgreSQL 15+, nginx, certbot
- [ ] Создать базу и пользователя (`createdb shellius`, `createuser shellius_user`)
- [ ] Применить миграции `001_users.sql`, `002_sync_items.sql`

### 2.2 Сборка и деплой Go-сервиса
- [ ] Скомпилировать `cloud/cmd/server/` под Linux: `GOOS=linux GOARCH=amd64 go build`
- [ ] Создать systemd-юнит `/etc/systemd/system/shellius-cloud.service`
- [ ] Настроить env-переменные: `DATABASE_URL`, `JWT_SECRET`, `OAUTH_CALLBACK_BASE`

### 2.3 Nginx reverse proxy + SSL
- [ ] Домен → nginx → `localhost:8080`
- [ ] SSL через Let's Encrypt (certbot)
- [ ] Заголовки: CORS для фронтенда, rate limiting на уровне nginx

### 2.4 Подключить rate limiter
- [ ] Вайрнуть `ratelimit.go` в `main.go` на auth-эндпоинты

---

## Фаза 3 — OAuth

### 3.1 Google OAuth
- [ ] Google Cloud Console — создать OAuth 2.0 Client ID
- [ ] Redirect URI: `https://<domain>/api/auth/oauth/google/callback`
- [ ] Прописать `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` в env

### 3.2 GitHub OAuth
- [ ] GitHub Settings → Developer → OAuth Apps → создать приложение
- [ ] Callback URL: `https://<domain>/api/auth/oauth/github/callback`
- [ ] Прописать `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` в env

### 3.3 Обновить фронтенд
- [ ] Заменить `CLOUD_URL` с `localhost:8080` на реальный URL
- [ ] Проверить deep linking `shellius://auth/callback` в Electron

---

## Фаза 4 — Cloud Sync (связать всё вместе)

### 4.1 Backend — интеграция sync клиента
- [ ] Добавить WebSocket-сообщения `sync.push` / `sync.pull` в `session_manager.go`
- [ ] Подключить `internal/sync/client.go` — отправлять данные на cloud API
- [ ] Передавать JWT-токен из фронтенда в backend (новое сообщение `auth.token`)

### 4.2 Frontend — реализовать push/pull
- [ ] Settings → Sync: подключить кнопки к реальным вызовам
- [ ] Push: собрать все hosts/snippets/vault/keys → отправить через backend → cloud
- [ ] Pull: получить с cloud → обновить локальный SQLite → обновить stores
- [ ] Показывать статус синхронизации и ошибки

### 4.3 Конфликт-резолюция
- [ ] Стратегия: last-write-wins по version, при конфликте — уведомить пользователя

---

## Фаза 5 — Electron Packaging (десктоп-версия)

### 5.1 Сборка
- [ ] Собрать Go backend под macOS/Linux/Windows (cross-compile)
- [ ] Включить бинарник backend в ресурсы Electron (`extraResources`)
- [ ] Подписание (macOS: Developer ID, Windows: code signing cert)

### 5.2 Auto-update
- [ ] electron-updater + GitHub Releases или S3
- [ ] Проверка обновлений при старте

### 5.3 Нативные фичи
- [ ] Tray icon, системные нотификации
- [ ] Ассоциация протокола `shellius://`
- [ ] Keychain/Credential Manager для мастер-пароля

---

## Фаза 6 — Доработки и полировка

- [ ] Refresh tokens — ротация токенов вместо 30-дневных JWT
- [ ] Сброс пароля — email flow (SMTP)
- [ ] Профиль пользователя — `GET/PUT /api/user/profile`
- [ ] SSH port forwarding UI — логика есть в `client.go`, нужен UI
- [ ] Передача файлов drag & drop в SFTP менеджере
- [ ] Темы оформления — светлая тема
- [ ] Логирование и мониторинг — structured logs, health checks, Prometheus metrics

---

## Зависимости между фазами

```
Фаза 1 (Безопасность) ✅
  |
  v
Фаза 2 (Деплой Cloud) <-- нужен VPS + домен
  |
  v
Фаза 3 (OAuth) <-- нужен задеплоенный cloud
  |
  v
Фаза 4 (Sync) <-- нужен cloud + OAuth
  |
  v
Фаза 5 (Electron)
  |
  v
Фаза 6 (Полировка)
```
