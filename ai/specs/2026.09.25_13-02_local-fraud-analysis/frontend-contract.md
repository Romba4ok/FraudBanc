# Контракт frontend-архитектуры Risk Ledger

**Этап:** F001  
**Статус:** проверен и зафиксирован до реализации dashboard  
**Связанные документы:** `frontend-spec.md`, `frontend-tasks.md`, основной `spec.md`  

## 1. Цель

Документ связывает утверждённые страницы нового frontend с текущими данными backend и явно перечисляет недостающие API-возможности. Он не меняет вычисления модели и не предполагает, что неподдерживаемый фильтр уже работает.

## 2. Маршруты

| ID | URL | Доступ без результата | Назначение |
|---|---|---:|---|
| `new-analysis` | `/new-analysis` | да | Требования к CSV, загрузка и прогресс |
| `overview` | `/overview` | нет | KPI, распределение, краткое качество и топ-5 |
| `risk-records` | `/risk-records` | нет | Таблица, фильтры, графики и карточка записи |
| `model-quality` | `/model-quality` | нет | Метрики и confusion matrix |
| `data-quality` | `/data-quality` | нет | Структурированные отклонения входных данных |

Правила:

- корневой URL перенаправляется на `/new-analysis`, если готового результата нет;
- после завершения анализа frontend открывает `/overview`;
- попытка открыть закрытый маршрут без результата возвращает на `/new-analysis` и показывает понятное уведомление;
- при истёкшей или удалённой сессии frontend очищает локальный `analysis_id` и возвращается на `/new-analysis`;
- выбранный пункт бокового меню не сохраняется между запусками.

## 3. Общее состояние frontend

Единственный источник состояния анализа должен содержать:

- фазу workspace: `empty`, `uploading`, `processing`, `ready`, `failed`;
- активный маршрут;
- `analysis_id` и имя файла;
- последний status;
- summary и текущую страницу результатов;
- фильтры таблицы;
- применённый временный порог;
- настройки отображения;
- уведомления текущей сессии;
- выбранную запись и открытый tab подробной карточки.

В `localStorage` разрешено хранить:

- идентификатор активной локальной сессии;
- настройки плотности, режима объяснения, контраста и масштаба текста.

В `localStorage` запрещено хранить:

- содержимое CSV;
- строки результатов;
- метрики и SHAP-факторы;
- исходные финансовые значения;
- историю завершённых сессий.

## 4. Карта страниц и источников данных

| Страница/блок | Текущий источник | Готовность | Действие до реализации |
|---|---|---|---|
| Загрузка CSV | `POST /api/analyses` | готово | использовать без изменения |
| Прогресс | `GET /api/analyses/{id}/status` | готово | локализовать stage |
| KPI строк | summary: `rows` | готово | использовать |
| KPI ручной проверки | summary: `requires_review` | готово | учитывать threshold |
| KPI критического риска | summary: `risk_counts.critical` | готово | использовать |
| Версия модели | summary: `model_version` | готово | использовать |
| Кольцевая диаграмма | summary: `risk_counts` | готово | вычислять проценты во frontend |
| Топ-5 | results с `page=1&page_size=5` | готово | сортировка гарантирована backend |
| Метрики модели | summary: `metrics` | готово | простой/экспертный вид используют один ответ |
| Матрица ошибок | summary: `metrics.confusion_matrix` | готово | использовать |
| Базовый фильтр риска | results: `risk_level` | готово | использовать |
| Временный порог | summary/results: `threshold` | готово | default threshold брать из model status |
| Пагинация | results: `page`, `page_size` | готово | использовать |
| SHAP-факторы | `items[].explanation_factors` | готово | использовать |
| Исходные поля записи | динамические поля `items[]` | готово | показывать только разрешённые поля ответа |
| Предупреждения строки | `items[].analysis_warnings` | частично | сейчас одинаковые общие предупреждения |
| Поиск `record_id` | results: `record_id` | готово в F005 | регистронезависимый partial match |
| Фильтр ручной проверки | results: `requires_review` | готово в F005 | рассчитывать по активному threshold |
| Диапазон вероятности | results: `probability_min`, `probability_max` | готово в F005 | включительные границы 0..1 |
| Гистограмма вероятностей | `GET .../distribution` | готово в F005 | 10 агрегированных корзин по умолчанию |
| Структурированное качество данных | только `warnings: string[]` | недостаточно | добавить structured endpoint/metadata |
| CSV ручной проверки | только полный report | отсутствует | расширить report contract |

## 5. Подтверждённые текущие API-контракты

### 5.1. Состояние сервиса и модели

- `GET /api/health` возвращает `status`, `model_ready`.
- `GET /api/model` возвращает `ready`, `version`, `features`, `review_threshold`, `error`.

Frontend использует model status для рабочего порога по умолчанию и понятного состояния недоступной модели.

### 5.2. Создание и прогресс

- `POST /api/analyses` принимает multipart поле `file`.
- `GET /api/analyses/{id}/status` возвращает имя файла, status, progress, stage, warnings и errors.

### 5.3. Summary

`GET /api/analyses/{id}/summary?threshold={0..1}` возвращает:

- версию модели;
- активный порог;
- количество строк;
- количество записей ручной проверки;
- количество записей по уровням риска;
- warnings;
- признаки наличия и корректности target;
- метрики и confusion matrix.

### 5.4. Results

Текущий `GET /api/analyses/{id}/results` принимает:

- `page`;
- `page_size`;
- `risk_level`;
- `threshold`.

Backend сортирует строки по `risk_probability DESC`, затем по исходной позиции. Frontend не должен повторно сортировать отдельную страницу способом, нарушающим серверную пагинацию.

### 5.5. Отчёт и удаление

- `GET /api/analyses/{id}/report.csv?threshold={0..1}` возвращает полный CSV.
- `DELETE /api/analyses/{id}` удаляет локальную временную сессию.

## 6. Расширения API для F005/F008/F009

Контракты 6.1 и 6.2 реализованы и покрыты backend-тестами в F005. Контракты 6.3 и 6.4 остаются требованиями следующих этапов.

Названия полей фиксируются здесь как целевой контракт. Backend-реализация должна сопровождаться integration tests и обновлением OpenAPI.

### 6.1. Расширенная выборка результатов

Расширить `GET /api/analyses/{id}/results` параметрами:

| Параметр | Тип | Правило |
|---|---|---|
| `requires_review` | boolean, optional | рассчитывается по активному threshold |
| `probability_min` | number 0..1, optional | включительно |
| `probability_max` | number 0..1, optional | включительно, не меньше min |
| `record_id` | string, optional | регистронезависимый partial match с экранированием wildcard |

Все фильтры объединяются через AND. Ответ сохраняет текущую схему `ResultPage`. Сортировка остаётся `risk_probability DESC, row_position ASC`.

### 6.2. Распределение вероятностей

Добавить:

`GET /api/analyses/{id}/distribution?bins=10&threshold={0..1}`

Целевой ответ:

```json
{
  "analysis_id": "uuid",
  "threshold": 0.5689,
  "risk_counts": {
    "low": 100,
    "medium": 20,
    "high": 5,
    "critical": 2
  },
  "probability_histogram": [
    { "from": 0.0, "to": 0.1, "count": 90 },
    { "from": 0.1, "to": 0.2, "count": 10 }
  ]
}
```

Границы histogram не пересекаются, последняя корзина включает значение `1.0`. Endpoint возвращает агрегаты и не передаёт строки выборки.

### 6.3. Качество данных

Добавить:

`GET /api/analyses/{id}/data-quality`

Целевой ответ:

```json
{
  "analysis_id": "uuid",
  "compatible": true,
  "rows": 72506,
  "columns": 177,
  "target_present": true,
  "target_valid": true,
  "missing_features": [],
  "missing_critical_features": [],
  "extra_columns": ["CNT_3D"],
  "unknown_categories": {
    "NEGATIVESTATUS": ["116"]
  },
  "feature_quality": [
    {
      "feature": "NEGATIVESTATUS",
      "missing_count": 0,
      "missing_rate": 0.0,
      "unknown_count": 12
    }
  ],
  "messages": [
    {
      "severity": "warning",
      "code": "unknown_categories",
      "message": "Найдены новые для модели категории."
    }
  ]
}
```

Структурированные значения должны сохраняться вместе с metadata сессии; frontend не разбирает английские строки регулярными выражениями для построения показателей.

### 6.4. Выгрузка ручной проверки

Расширить текущий report endpoint:

`GET /api/analyses/{id}/report.csv?threshold={0..1}&review_only=true`

При `review_only=true` CSV содержит только строки, где `risk_probability >= threshold`, и сохраняет сортировку по убыванию риска. По умолчанию `review_only=false`, поэтому существующий сценарий остаётся совместимым.

## 7. Компонентная карта

```text
App
└── AnalysisProvider
    └── DashboardShell
        ├── AppHeader
        ├── SidebarNavigation
        ├── DisplaySettings
        ├── NotificationCenter
        └── RouteOutlet
            ├── NewAnalysisPage
            │   ├── UploadDropzone
            │   ├── SelectedFileCard
            │   └── AnalysisProgress
            ├── OverviewPage
            │   ├── SummaryCards
            │   ├── RiskDonutChart
            │   ├── QualityHighlights
            │   └── TopRiskRecords
            ├── RiskRecordsPage
            │   ├── RiskDistributionCharts
            │   ├── RiskFilters
            │   ├── ColumnPicker
            │   ├── RiskTable
            │   └── RecordDetails
            ├── ModelQualityPage
            │   ├── MetricsGrid
            │   └── ConfusionMatrix
            └── DataQualityPage
                ├── DataQualitySummary
                ├── FeatureQualityTable
                └── DataIssueList
```

## 8. Владение состоянием

| Состояние | Владелец | Сохранение |
|---|---|---|
| Активный analysis id | AnalysisProvider | localStorage |
| Status/summary/results | AnalysisProvider/query layer | только память |
| Фильтры и страница | RiskRecordsPage | память текущей сессии |
| Выбранная запись | RiskRecordsPage | память |
| Плотность/режим/контраст/текст | DisplaySettings | localStorage |
| Состояние sidebar | DashboardShell | память, не сохранять |
| Уведомления | NotificationProvider | память текущей сессии |
| Файл до отправки | NewAnalysisPage | память, очистить после отправки |

## 9. Правила конкурентных запросов

- новый upload создаёт новый `run token`; ответы старого polling игнорируются;
- фильтры используют последний request token или `AbortController`;
- смена фильтра сбрасывает страницу на 1;
- summary, distribution и results одного экрана запрашиваются с одинаковым threshold;
- существующие данные остаются видимыми при фоновом обновлении;
- `404 analysis_not_found` очищает локальную ссылку на сессию;
- `409 analysis_not_ready` не считается фатальной ошибкой во время polling;
- новый анализ не создаётся до подтверждения удаления старой сессии.

## 10. Стратегия миграции

1. Сначала добавить shell, routes и providers рядом с существующими компонентами.
2. Перенести текущий upload/progress без изменения API.
3. Перенести summary и метрики по страницам.
4. После backend-расширений подключить новые фильтры, histogram, data quality и review-only export.
5. Удалить старую монолитную композицию `App.tsx` только после прохождения нового сквозного теста.

Такой порядок сохраняет рабочий локальный MVP на каждом промежуточном этапе.

## 11. Проверки контракта F001

- маршруты и их доступность зафиксированы в TypeScript;
- настройки и фильтры имеют единые типы и значения по умолчанию;
- существующие endpoint описаны отдельно от предлагаемых расширений;
- для каждого блока ТЗ указан источник данных;
- неподдерживаемые параметры не отправляются текущим API-клиентом;
- frontend tests, lint и production build должны пройти без изменения текущего UI.
