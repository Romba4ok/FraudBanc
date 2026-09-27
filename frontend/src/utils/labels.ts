export interface FeaturePresentation {
  label: string;
  description: string;
}

const featureLabels: Record<string, FeaturePresentation> = {
  total_amount_kzt: {
    label: "Общая сумма, ₸",
    description: "Общая сумма по записи в тенге",
  },
  overdueinstalmentcount_po_subektu: {
    label: "Просроченные платежи",
    description: "Количество просроченных платежей по субъекту",
  },
  term: { label: "Срок договора", description: "Срок действия договора" },
  was_canceled: { label: "Отмена договора", description: "Признак отмены договора" },
  GENDER: { label: "Пол", description: "Пол клиента" },
  CLASSIFICATION: {
    label: "Классификация",
    description: "Категория классификации клиента",
  },
  RESIDENCY: { label: "Резидентство", description: "Статус резидентства клиента" },
  EDUCATION: { label: "Образование", description: "Уровень образования клиента" },
  MARITALSTATUS: {
    label: "Семейное положение",
    description: "Семейное положение клиента",
  },
  NEGATIVESTATUS: {
    label: "Негативный статус",
    description: "Код негативного статуса клиента",
  },
  PROFESSION: { label: "Профессия", description: "Категория профессии клиента" },
  ECONOMYACTIVITYGROUP: {
    label: "Сфера деятельности",
    description: "Группа экономической деятельности",
  },
  EMPLOYMENTNATURE: {
    label: "Характер занятости",
    description: "Категория или характер занятости клиента",
  },
  DEPENDANTS_LT18: {
    label: "Иждивенцы до 18 лет",
    description: "Количество иждивенцев младше 18 лет",
  },
  DEPENDANTS_GT18: {
    label: "Иждивенцы старше 18 лет",
    description: "Количество иждивенцев старше 18 лет",
  },
  AGE: { label: "Возраст", description: "Возраст клиента" },
  NUM_CONTRACT_BVU: {
    label: "Договоры с БВУ",
    description: "Количество договоров с банками второго уровня",
  },
  NUM_CONTRACT_MFO: {
    label: "Договоры с МФО",
    description: "Количество договоров с микрофинансовыми организациями",
  },
  NUM_CONTRACT_PDL: {
    label: "Краткосрочные займы",
    description: "Количество договоров категории PDL",
  },
  NUM_CONTRACT_OTHERS: {
    label: "Другие договоры",
    description: "Количество договоров других категорий",
  },
  NUM_COLLATERAL: { label: "Залоги", description: "Количество объектов залога" },
  NUM_USAGES: {
    label: "Использования",
    description: "Количество зарегистрированных использований",
  },
  CNT_1M: {
    label: "Активность за 1 месяц",
    description: "Счётчик событий или операций за последний месяц",
  },
  CNT_3M: {
    label: "Количество событий за 3 месяца",
    description: "Счётчик событий или операций за последние 3 месяца",
  },
  CNT_6M: {
    label: "Количество событий за 6 месяцев",
    description: "Счётчик событий или операций за последние 6 месяцев",
  },
  MAX_PEAKS_OVERDUECOUNT_LAST_2Y: {
    label: "Максимум просрочек за 2 года",
    description: "Максимальное пиковое количество просрочек за последние 2 года",
  },
  MEAN_PEAKS_OVERDUECOUNT_LAST_2Y: {
    label: "Среднее число просрочек за 2 года",
    description: "Среднее пиковое количество просрочек за последние 2 года",
  },
  MEAN_SIG_PEAKS_OVERDUECOUNT_LAST_2Y: {
    label: "Среднее значимых пиков просрочки",
    description: "Среднее значение значимых пиков просрочек за последние 2 года",
  },
  SUM_SIG_PEAKS_OVERDUECOUNT_LAST_2Y: {
    label: "Сумма значимых пиков просрочки",
    description: "Суммарное значение значимых пиков просрочек за последние 2 года",
  },
  NUM_ADDRESSES: { label: "Адреса", description: "Количество известных адресов" },
  NUM_PHONENUMBERS: {
    label: "Телефонные номера",
    description: "Количество известных телефонных номеров",
  },
  NUM_CONTRACTS: {
    label: "Все договоры",
    description: "Общее количество договоров",
  },
  TOTALAMOUNT_MIN: {
    label: "Минимальная сумма договора",
    description: "Минимальная сумма среди договоров",
  },
  TOTALAMOUNT_MAX: {
    label: "Максимальная сумма договора",
    description: "Максимальная сумма среди договоров",
  },
  NUM_CONTRACTS_INS: {
    label: "Договоры INS",
    description: "Количество договоров категории INS",
  },
  NUM_CONTRACTS_NIN: {
    label: "Договоры NIN",
    description: "Количество договоров категории NIN",
  },
  NUM_CONTRACTS_FOR: {
    label: "Договоры FOR",
    description: "Количество договоров категории FOR",
  },
  NUM_MONTH_BTW_LAST_CONTRACTS: {
    label: "Интервал между договорами",
    description: "Количество месяцев между последними договорами",
  },
  NUM_MONTH_FROM_START_MAX: {
    label: "Макс. срок с начала договора",
    description: "Максимальное число месяцев с начала договора",
  },
  NUM_MONTH_FROM_START_MIN: {
    label: "Мин. срок с начала договора",
    description: "Минимальное число месяцев с начала договора",
  },
  NUM_CONTRACTS_STARTED_L3M: {
    label: "Новые договоры за 3 месяца",
    description: "Количество договоров, начатых за последние 3 месяца",
  },
  NUM_CONTRACTS_STARTED_L6M: {
    label: "Новые договоры за 6 месяцев",
    description: "Количество договоров, начатых за последние 6 месяцев",
  },
  NUM_CONTRACTS_STARTED_L12M: {
    label: "Новые договоры за 12 месяцев",
    description: "Количество договоров, начатых за последние 12 месяцев",
  },
  NUM_CONTRACTS_STARTED_L7_12M: {
    label: "Новые договоры за 7–12 месяцев",
    description: "Количество договоров, начатых в период от 7 до 12 месяцев назад",
  },
  AS3M: {
    label: "Показатель AS за 3 месяца",
    description: "Агрегированный показатель AS за последние 3 месяца",
  },
  outstandingamount: {
    label: "Остаток задолженности",
    description: "Текущая непогашенная сумма задолженности",
  },
  overdueamount: {
    label: "Сумма просрочки",
    description: "Текущая сумма просроченной задолженности",
  },
  instalmentamount: {
    label: "Сумма платежа",
    description: "Размер регулярного платежа",
  },
  loans: { label: "Займы", description: "Количество займов в RFM-профиле" },
  frequency: {
    label: "Частота операций",
    description: "Частота взаимодействий в RFM-профиле",
  },
  monetary: {
    label: "Денежный объём",
    description: "Денежный объём операций в RFM-профиле",
  },
  recency: {
    label: "Давность операции",
    description: "Давность последней операции в RFM-профиле",
  },
  rfm_score: {
    label: "RFM-оценка",
    description: "Сводная оценка давности, частоты и денежного объёма",
  },
  DTI3M: {
    label: "Долговая нагрузка за 3 месяца",
    description: "Показатель отношения долговой нагрузки к доходу за 3 месяца",
  },
};

export function getFeaturePresentation(feature: string): FeaturePresentation {
  const known = featureLabels[feature];
  if (known) return known;

  const overdue = /^MONTH_OVERDUE_([CA])(\d+)$/.exec(feature);
  if (overdue) {
    const [, kind, month] = overdue;
    const isCount = kind === "C";
    return {
      label: `${isCount ? "Просрочки" : "Сумма просрочки"} — месяц ${month}`,
      description: `${isCount ? "Количество просрочек" : "Сумма просроченной задолженности"} в месячном срезе ${month}`,
    };
  }

  return {
    label: feature,
    description: "Технический признак модели; бизнес-описание пока не задано",
  };
}

export function formatFeatureValue(value: string | number | null): string {
  if (value === null || value === "") return "нет данных";
  if (typeof value === "number") {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
  }
  return String(value);
}

export function formatDataWarning(warning: string): string {
  const extra = /^Extra columns will be preserved but ignored by the model: (.+)$/.exec(warning);
  if (extra) {
    return `Дополнительные столбцы не используются моделью: ${extra[1]}`;
  }

  const unknown = /^Unknown categories in ([^:]+): (.+)$/.exec(warning);
  if (unknown) {
    const feature = unknown[1];
    const presentation = getFeaturePresentation(feature);
    return `Новые значения в поле «${presentation.label}» (${feature}): ${unknown[2]}`;
  }

  const missing = /^Optional features will be imputed: (.+)$/.exec(warning);
  if (missing) {
    return `Отсутствующие необязательные признаки будут заполнены автоматически: ${missing[1]}`;
  }

  return warning;
}

export function getRiskLevelLabel(level: "low" | "medium" | "high" | "critical"): string {
  return {
    low: "Низкий риск",
    medium: "Средний риск",
    high: "Высокий риск",
    critical: "Критический риск",
  }[level];
}
