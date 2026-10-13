# Интеграция с 1С

Модуль обмена готов на стороне сайта: HTTP API, форматы данных, аутентификация, журнал ошибок и обмен через файлы. **Подключение к конкретной базе 1С M‑TREND не выполнено**, потому что у разработчиков не было к ней доступа. На стороне 1С нужно настроить выгрузку в описанном ниже формате: это может быть обработка или регламентное задание, которое отправляет HTTP-запросы или складывает файлы в папку обмена. Объём доработки зависит от конфигурации (УТ, Розница, УНФ и т. д.).

## Что синхронизируется

| Данные | Направление | Способ |
|---|---|---|
| Номенклатура (товары, артикулы, группы) | 1С → сайт | `POST /api/integrations/1c/catalog` |
| Характеристики: цвет, размер, ростовка → SKU | 1С → сайт | в составе `catalog` |
| Цены (текущая и старая) | 1С → сайт | `catalog` или быстрый `stock` |
| Остатки по складам | 1С → сайт | `stock` (каждые ~10 минут) |
| Заказы сайта | сайт → 1С | `GET /api/integrations/1c/orders` |
| Подтверждение приёма заказов | 1С → сайт | `POST /api/integrations/1c/orders/ack` |

Рекомендуемое расписание:
- **остатки и цены** — каждые 10 минут (`stock`), только изменившиеся позиции или полный срез;
- **номенклатура** — раз в сутки или при изменениях (`catalog`);
- **заказы** — каждые 5–10 минут: забрать (`orders`), создать документы в 1С, подтвердить (`orders/ack`).

## Аутентификация

1. В `.env` сайта задайте `ONEC_API_TOKEN`: случайная строка не короче 24 символов (`openssl rand -hex 32`). Пока токен не задан, API отвечает `503 integration_disabled`.
2. Каждый запрос должен содержать заголовок `Authorization: Bearer <ONEC_API_TOKEN>`.
3. **Рекомендуется** подписывать запросы HMAC. Для этого задайте `ONEC_HMAC_SECRET` и передавайте заголовки:
   - `X-Timestamp`: текущее время Unix в секундах (допускается расхождение ±5 минут);
   - `X-Signature: sha256=<hex>`, где `hex = HMAC_SHA256(ONEC_HMAC_SECRET, "<X-Timestamp>.<тело запроса>")`. Для GET-запросов тело пустое: строка `"<ts>."`.
4. Дополнительно можно ограничить доступ по IP: `ONEC_ALLOWED_IPS=1.2.3.4,5.6.7.8`.
5. Лимит — 120 запросов в минуту с одного IP. Используйте только HTTPS.

Коды ответов: `200` — успех (отчёт в теле), `401` — неверный токен или подпись, `403` — IP не разрешён, `422` — ошибка формата (список `issues`), `429` — превышен лимит, `500` — ошибка сервера (подробности в журнале).

Все обмены пишутся в журнал: «Админка → Интеграция 1С». В журнале сохраняются статус, статистика и до 500 ошибок по каждому пакету.

## 1. Номенклатура: `POST /api/integrations/1c/catalog`

```json
{
  "warehouses": [
    { "code": "AST", "name": "Склад Астана", "city": "Астана" },
    { "code": "AKT", "name": "Склад Актобе", "city": "Актобе" }
  ],
  "categories": [
    { "externalId": "grp-001", "nameRu": "Костюмы", "nameKz": "Костюмдер", "slug": "kostyumy" },
    { "externalId": "grp-002", "nameRu": "Костюмы двойки", "parentExternalId": "grp-001" }
  ],
  "products": [
    {
      "externalId": "nom-9293",
      "article": "9293",
      "nameRu": "Костюм классический",
      "nameKz": "Классикалық костюм",
      "brand": "M-TREND",
      "categoryExternalId": "grp-002",
      "descriptionRu": "…",
      "compositionRu": "70% шерсть, 30% полиэстер",
      "materialRu": "Шерсть",
      "materialKz": "Жүн",
      "season": "DEMI",
      "fit": "SLIM",
      "isNew": true,
      "publish": false,
      "variants": [
        {
          "externalId": "char-9293-1",
          "sku": "9293-NAVY-50-176",
          "colorCode": "navy",
          "colorNameRu": "Тёмно-синий",
          "colorNameKz": "Қою көк",
          "colorHex": "#1f2a44",
          "size": "50",
          "height": "176",
          "price": 89000,
          "oldPrice": null,
          "barcode": "4600000000001",
          "stocks": [
            { "warehouseCode": "AST", "quantity": 2 },
            { "warehouseCode": "AKT", "quantity": 0 }
          ]
        }
      ]
    }
  ],
  "options": { "dryRun": false, "subtractPendingOrders": true }
}
```

Правила:
- Товар ищется по `externalId`, затем по `article`. Вариант (SKU) ищется по `sku`.
- Поля, которых нет в пакете, не перезаписываются. Фото, описания и SEO, заполненные в админке, сохраняются.
- **Новые товары создаются черновиками** и не видны покупателям. Опубликовать товар можно в админке или флагом `"publish": true`.
- Категорию можно указать через `categoryExternalId` (группа 1С, переданная в `categories`) или через `categorySlug` (slug категории сайта). Если категория не найдена, товар попадает в скрытую категорию `unsorted`.
- Новый цвет создаётся автоматически по `colorCode`.
- `season`: `ALL_SEASON | DEMI | WINTER | SUMMER`; `fit`: `SLIM | REGULAR | RELAXED`. Цены — целые тенге.
- `stocks.quantity` — **абсолютный** остаток на складе.
- Максимум 5000 товаров в пакете. Большой каталог передавайте частями.
- `dryRun: true` проверяет пакет без записи.

Ответ:
```json
{ "categoriesCreated": 0, "categoriesUpdated": 2, "productsCreated": 1, "productsUpdated": 10,
  "variantsCreated": 4, "variantsUpdated": 60, "stocksUpdated": 12, "pricesUpdated": 0,
  "errors": [{ "ref": "артикул 1234", "message": "Неизвестный склад XYZ" }], "dryRun": false }
```
Ошибка в одном товаре не останавливает обработку остальных.

## 2. Остатки и цены: `POST /api/integrations/1c/stock`

Лёгкий пакет для частой синхронизации:

```json
{
  "items": [
    { "sku": "9293-NAVY-50-176", "warehouseCode": "AST", "quantity": 2 },
    { "sku": "9293-NAVY-50-176", "warehouseCode": "AKT", "quantity": 0 }
  ],
  "prices": [
    { "sku": "9293-NAVY-50-176", "price": 79000, "oldPrice": 89000 }
  ],
  "options": { "subtractPendingOrders": true }
}
```

- SKU, которых нет на сайте, возвращаются в `errors`. Сначала передайте номенклатуру.
- До 200 000 строк в пакете.

### Почему `subtractPendingOrders`

При оформлении заказа сайт сразу списывает остаток. Пока заказ не попал в 1С, 1С продолжает считать товар свободным. Если записать её остаток «как есть», проданная единица снова появится на сайте. С флагом `subtractPendingOrders = true` (по умолчанию) сайт вычитает из присланного остатка количество в своих заказах, которые ещё не подтверждены через `orders/ack` и не отменены.

Если 1С уже резервирует или списывает заказы сайта и присылает свободный остаток с их учётом, отправляйте `false`.

## 3. Выгрузка заказов: `GET /api/integrations/1c/orders`

Параметры:
- `pending=1` (по умолчанию) — только заказы, ещё не подтверждённые 1С; `pending=0` — все;
- `since=2026-10-01T00:00:00Z` — изменённые после даты (удобно для синхронизации статусов);
- `limit` — до 500, по умолчанию 200;
- `includeDemo=1` — включить тестовые заказы с демо-товарами (по умолчанию не выгружаются).

Ответ:
```json
{
  "orders": [
    {
      "id": "…", "number": "MT26-000123", "externalId": null,
      "createdAt": "…", "updatedAt": "…",
      "status": "NEW", "paymentStatus": "NOT_PAID", "paymentMethod": "manager", "paymentRef": null,
      "deliveryMethod": "pickup",
      "customer": { "name": "…", "phone": "+77011234567", "email": null },
      "city": "Астана", "address": null,
      "pickupStore": { "name": "ТК Sunrise", "warehouseCode": "AST" },
      "comment": null, "currency": "KZT",
      "subtotal": 89000, "promoCode": null, "promoDiscount": 0, "deliveryCost": 0, "total": 89000,
      "items": [
        { "sku": "9293-NAVY-50-176", "article": "9293", "name": "Костюм классический",
          "color": "Тёмно-синий", "size": "50", "height": "176",
          "price": 89000, "quantity": 1, "total": 89000,
          "allocations": [{ "warehouseCode": "AST", "quantity": 1 }] }
      ]
    }
  ]
}
```

`allocations` показывает, с какого склада сайт списал товар. Это нужно, чтобы в 1С создать документ на правильном складе.

## 4. Подтверждение заказов: `POST /api/integrations/1c/orders/ack`

```json
{ "orders": [ { "number": "MT26-000123", "externalId": "ЗаказКлиента 00-000456" } ] }
```

Заказ получает отметку «Передан в 1С». Номер документа 1С сохраняется и отображается в админке.

## Обмен через файлы (альтернатива HTTP)

Если 1С не может отправлять HTTP-запросы, она может выгружать JSON-файлы того же формата в папку обмена (общая папка, FTP или SFTP). На сервере сайта cron запускает:

```bash
*/10 * * * * cd /opt/mtrend && npm run 1c:import-file -- /var/exchange/1c/in >> /var/log/mtrend-1c.log 2>&1
```

- `stock*.json` обрабатывается как пакет остатков и цен, остальные `*.json` — как пакет номенклатуры.
- Обработанные файлы перемещаются в `processed/`, ошибочные — в `failed/`. Результат пишется в журнал интеграции.

## CommerceML

Типовой обмен 1С с сайтами работает через протокол CommerceML 2 (XML, `import.xml` и `offers.xml`). В текущей версии сайт принимает JSON. Если в 1С настроен стандартный обмен CommerceML, можно добавить адаптер `CommerceML → catalogPayload`: модуль `src/lib/import/catalog-import.ts` спроектирован так, что адаптер только преобразует формат, а вся логика записи и валидации переиспользуется.

## Пример отправки из 1С (псевдокод на встроенном языке)

```
Соединение = Новый HTTPСоединение("mtrend.kz", 443, , , , 60, Новый ЗащищенноеСоединениеOpenSSL);
Запрос = Новый HTTPЗапрос("/api/integrations/1c/stock");
Запрос.Заголовки.Вставить("Content-Type", "application/json");
Запрос.Заголовки.Вставить("Authorization", "Bearer " + Токен);
Запрос.УстановитьТелоИзСтроки(ТекстJSON, КодировкаТекста.UTF8, ИспользованиеByteOrderMark.НеИспользовать);
Ответ = Соединение.ОтправитьДляОбработки(Запрос);
Если Ответ.КодСостояния <> 200 Тогда
    ЗаписьЖурналаРегистрации("M-TREND.Обмен", УровеньЖурналаРегистрации.Ошибка, , , Ответ.ПолучитьТелоКакСтроку());
КонецЕсли;
```

## Пример проверки через curl

```bash
TOKEN=...   # ONEC_API_TOKEN
curl -X POST https://mtrend.kz/api/integrations/1c/stock \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"sku":"9293-NAVY-50-176","warehouseCode":"AST","quantity":3}]}'
```

С подписью HMAC:
```bash
TS=$(date +%s); BODY='{"items":[…]}'
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$ONEC_HMAC_SECRET" -hex | sed 's/^.* //')
curl -X POST https://mtrend.kz/api/integrations/1c/stock \
  -H "Authorization: Bearer $TOKEN" -H "X-Timestamp: $TS" -H "X-Signature: sha256=$SIG" \
  -H "Content-Type: application/json" -d "$BODY"
```
