# Развёртывание и подключение домена mtrend.kz

Ниже описаны два варианта. **Рекомендуется вариант А**: VPS с Docker. Он дешевле, все данные под вашим контролем, удобно подключать 1С. Вариант Б — облачная платформа.

---

## Вариант А. VPS в Казахстане или рядом (Docker)

Подойдёт VPS с Ubuntu 22.04/24.04: 2 vCPU, 4 ГБ RAM, 40+ ГБ SSD. Примеры провайдеров: PS Cloud Services, Hoster.kz, ps.kz, Yandex Cloud (Алматы), Selectel, Timeweb Cloud.

Закон РК «О персональных данных и их защите» требует хранить персональные данные граждан РК на территории Казахстана. Для базы покупателей выбирайте дата-центр в РК и проконсультируйтесь с юристом.

### 1. Подготовка сервера

```bash
ssh root@IP_СЕРВЕРА
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git ufw
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
adduser deploy && usermod -aG docker deploy
```

### 2. Код и настройки

```bash
su - deploy
git clone <URL репозитория> /opt/mtrend   # или скопируйте архив проекта
cd /opt/mtrend
cp .env.example .env
nano .env
```

Обязательно заполните в `.env`:
```
POSTGRES_PASSWORD=<длинный случайный пароль>     # для docker-compose
APP_URL=https://mtrend.kz
SESSION_SECRET=<openssl rand -hex 32>
ROBOTS_ALLOW_INDEX=true                           # только на боевом домене
ADMIN_EMAIL=admin@mtrend.kz
ADMIN_PASSWORD=<надёжный пароль>
SEED_DEMO=false                                   # true — если нужны демо-товары для проверки
```
`DATABASE_URL` для Docker задаётся в `docker-compose.yml` автоматически.

### 3. Запуск

```bash
docker compose up -d --build
# миграции применяются автоматически при старте контейнера
docker compose exec app node -e "fetch('http://localhost:3000/api/health').then(r=>r.text()).then(console.log)"
```

Начальные данные (справочники, магазины, способы доставки и оплаты, администратор) загрузите один раз через служебный контейнер:
```bash
docker compose --profile tools run --rm tools npm run db:seed
# создать менеджера или сбросить пароль:
docker compose --profile tools run --rm -e ADMIN_PASSWORD='...' tools npm run admin:create -- manager@mtrend.kz "Имя" MANAGER
```

### 4. nginx и SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mtrend.kz
sudo ln -s /etc/nginx/sites-available/mtrend.kz /etc/nginx/sites-enabled/
# для первого выпуска сертификата временно закомментируйте блоки 443 или используйте:
sudo certbot --nginx -d mtrend.kz -d www.mtrend.kz
sudo nginx -t && sudo systemctl reload nginx
```
Сертификат Let's Encrypt продлевается автоматически (`systemctl list-timers | grep certbot`).

Конфигурация nginx перезаписывает `X-Forwarded-For` реальным IP клиента. Не удаляйте эту строку: на ней основаны лимиты запросов.

### 5. Обновление сайта

```bash
cd /opt/mtrend && git pull && docker compose up -d --build
```

### 6. Резервное копирование

```bash
# ежедневный дамп БД (crontab -e у пользователя deploy)
0 3 * * * docker compose -f /opt/mtrend/docker-compose.yml exec -T db pg_dump -U mtrend mtrend | gzip > /opt/backups/mtrend-$(date +\%F).sql.gz
# фото (если STORAGE_DRIVER=local) лежат в docker volume "uploads"
```
Храните копии вне сервера: Object Storage или другой сервер. Регулярно проверяйте восстановление из копии.

---

## Вариант Б. Облачная платформа (Vercel / Railway / Render)

1. База PostgreSQL: Neon, Supabase, Railway или управляемая БД вашего облака. Учитывайте требования к хранению персональных данных в РК.
2. Фото: `STORAGE_DRIVER=s3` и бакет S3-совместимого хранилища. Файловая система serverless-платформ не сохраняет загруженные файлы.
3. Переменные окружения из `.env.example` задайте в настройках проекта.
4. Build command: `npm run build`. Перед первым запуском выполните `npx prisma migrate deploy` и `npm run db:seed` с `DATABASE_URL` боевой базы.
5. Лимиты запросов хранятся в памяти процесса. При нескольких инстансах замените `src/lib/rate-limit.ts` на Redis (например, Upstash).

---

## Подключение домена mtrend.kz

Домены `.kz` регистрируются через аккредитованных регистраторов (ps.kz, hoster.kz, nic.kz и др.). Серверы, на которые указывает домен `.kz`, по правилам KazNIC должны находиться в Казахстане. Уточните это у регистратора до выбора хостинга.

1. Войдите в панель регистратора, где обслуживается `mtrend.kz`.
2. В разделе DNS создайте записи:

   | Тип | Имя | Значение | TTL |
   |---|---|---|---|
   | A | `@` | IP вашего VPS | 3600 |
   | A | `www` | IP вашего VPS | 3600 |

   Для облачной платформы вместо этого укажите значения из её инструкции: обычно A на их IP для `@` и CNAME для `www`.
3. Если DNS обслуживает другой провайдер (Cloudflare и т. п.), сначала смените NS-серверы домена у регистратора.
4. Дождитесь обновления DNS (от нескольких минут до 24 часов). Проверка: `nslookup mtrend.kz`.
5. Выпустите SSL-сертификат (шаг 4 выше) и убедитесь, что `https://mtrend.kz` открывается, а `http://` и `www.` перенаправляют на него.
6. Установите `APP_URL=https://mtrend.kz` и `ROBOTS_ALLOW_INDEX=true`, затем перезапустите приложение.

### Почта на домене

Для писем покупателям (`no-reply@mtrend.kz`) подключите почтовый сервис (Яндекс 360, Google Workspace, Mail.ru для бизнеса, Unisender Go и т. п.) и добавьте у регистратора записи **MX, SPF (TXT), DKIM (TXT), DMARC (TXT)** из его инструкции. Без SPF и DKIM письма попадают в спам.

---

## После запуска: чек-лист

- [ ] Сменить пароль администратора и создать учётные записи менеджеров (админка → Сотрудники).
- [ ] Удалить демо-товары (админка → Импорт / экспорт), отключить промокод `DEMO10`.
- [ ] Загрузить реальный каталог, фото и таблицы замеров.
- [ ] Заполнить «Настройки сайта»: телефон, WhatsApp, email, соцсети, реквизиты (ИП/ТОО, БИН), список городов.
- [ ] Указать часы работы, телефоны и карты магазинов.
- [ ] Настроить способы и тарифы доставки.
- [ ] Отредактировать страницы «Доставка и оплата», «Обмен и возврат», «Политика конфиденциальности», «Публичная оферта» (с юристом).
- [ ] Заменить баннеры главной на реальные фото.
- [ ] Подключить SMTP и Telegram-уведомления, проверить тестовым заказом.
- [ ] Указать ID GA4, Meta Pixel и Яндекс Метрики, подтвердить сайт в Google Search Console и Яндекс Вебмастере, отправить `https://mtrend.kz/sitemap.xml`.
- [ ] Настроить обмен с 1С и резервное копирование.
