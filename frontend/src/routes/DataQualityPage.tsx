import { useState } from "react";
import { QualityIssueCard } from "../components/QualityIssueCard";
import { parseQualityIssues } from "../utils/dataQuality";

interface DataQualityPageProps {
  warnings: string[];
  targetPresent: boolean;
  targetValid: boolean;
}

export function DataQualityPage({ warnings, targetPresent, targetValid }: DataQualityPageProps) {
  const [mode, setMode] = useState<"simple" | "expert">("simple");
  const issueWeight = { critical: 0, warning: 1, info: 2 } as const;
  const issues = [...parseQualityIssues(warnings)].sort((left, right) => issueWeight[left.level] - issueWeight[right.level]);
  const missingIssues = issues.filter(({ kind }) => kind === "missing_features" || kind === "missing_rate");
  const unknownCount = issues
    .filter(({ kind }) => kind === "unknown_categories")
    .reduce((total, issue) => total + issue.items.length, 0);
  const extraCount = issues
    .filter(({ kind }) => kind === "extra_columns")
    .reduce((total, issue) => total + issue.items.length, 0);
  const attentionCount = issues.filter(({ level }) => level === "warning").length;
  const criticalCount = issues.filter(({ level }) => level === "critical").length;

  const targetStatus = targetValid
    ? { value: "Доступен", detail: "Фактический результат подходит для проверки модели", tone: "success" }
    : targetPresent
      ? { value: "Некорректен", detail: "Риск рассчитан, метрики недоступны", tone: "warning" }
      : { value: "Не передан", detail: "Это не мешает оценке риска", tone: "neutral" };

  return (
    <div className={`section-page data-quality-page quality-mode-${mode}`}>
      <header className="section-page__intro data-quality-page__intro"><div><p className="eyebrow">Контроль входных данных</p><h1>Качество данных</h1><p>Здесь показано, какие особенности источника способны повлиять на результат и что нужно исправить перед регулярным использованием.</p></div><div className="quality-page__summary" aria-label="Сводная оценка данных"><span className={criticalCount ? "is-critical" : attentionCount ? "is-attention" : "is-good"}><strong>{criticalCount ? "Анализ ограничен" : attentionCount ? "Нужна проверка" : "Данные приняты"}</strong><small>влияние на результат</small></span><span><strong>{attentionCount}</strong><small>требуют внимания</small></span><span><strong>{criticalCount}</strong><small>критических проблем</small></span></div></header>
      <div className="quality-page__toolbar"><div><strong>Уровень детализации</strong><span>Технические коды и исходные значения скрыты в понятном режиме.</span></div><div className="quality-mode-switch" role="group" aria-label="Режим отображения качества данных"><button type="button" aria-pressed={mode === "simple"} className={mode === "simple" ? "is-active" : undefined} onClick={() => setMode("simple")}>Понятный вид</button><button type="button" aria-pressed={mode === "expert"} className={mode === "expert" ? "is-active" : undefined} onClick={() => setMode("expert")}>Экспертный вид</button></div></div>

      <section className={`data-quality-impact data-quality-impact--${criticalCount ? "critical" : attentionCount ? "warning" : "success"}`} aria-labelledby="data-impact-title"><div><p className="eyebrow">Вывод для аналитика</p><h2 id="data-impact-title">{criticalCount ? "Часть результатов нельзя считать надёжной" : attentionCount ? "Анализ завершён, но результат требует проверки" : "Данные подходят для текущего анализа"}</h2><p>{criticalCount ? "Исправьте критические проблемы и повторите анализ до принятия решения." : attentionCount ? "Сначала проверьте новые значения и пропуски: они могут изменить риск отдельных записей." : "Значимых отклонений от ожидаемой структуры не обнаружено."}</p></div><div><strong>Рекомендуемое действие</strong><p>{criticalCount ? "Вернуться к источнику и восстановить обязательные поля." : attentionCount ? "Сверить отмеченные поля с системой-источником и зафиксировать результат проверки." : "Можно переходить к очереди клиентов и операций."}</p></div></section>

      <section className="data-quality-summary" aria-label="Сводка качества данных">
        <article className={`data-quality-stat data-quality-stat--${issues.length ? "warning" : "success"}`}>
          <span>Состояние файла</span>
          <strong>{issues.length ? "Есть отклонения" : "Структура принята"}</strong>
          <small>{issues.length ? `${attentionCount} требуют внимания` : "Модель не сообщила отклонений"}</small>
        </article>
        <article className={`data-quality-stat data-quality-stat--${missingIssues.length ? "warning" : "success"}`}>
          <span>Заполненность</span>
          <strong>{missingIssues.length ? `${missingIssues.length} сигнала` : "Без замечаний"}</strong>
          <small>{missingIssues.length ? "Проверьте пропуски и состав полей" : "Необычных пропусков не обнаружено"}</small>
        </article>
        <article className={`data-quality-stat data-quality-stat--${unknownCount ? "warning" : "success"}`}>
          <span>Новые категории</span>
          <strong>{unknownCount}</strong>
          <small>{unknownCount ? "Значения обработаны как неизвестные" : "Новых значений не обнаружено"}</small>
        </article>
        <article className={`data-quality-stat data-quality-stat--${extraCount ? "info" : "success"}`}>
          <span>Дополнительные поля</span>
          <strong>{extraCount}</strong>
          <small>{extraCount ? "Сохранены, но не используются моделью" : "Лишних полей не обнаружено"}</small>
        </article>
        <article className={`data-quality-stat data-quality-stat--${targetStatus.tone}`}>
          <span>Фактический результат</span>
          <strong>{targetStatus.value}</strong>
          <small>{targetStatus.detail}</small>
        </article>
      </section>

      {issues.length ? (
        <section className="panel data-quality-panel" aria-labelledby="data-quality-title">
          <div className="data-quality-panel__heading">
            <div><p className="eyebrow">Подробности</p><h2 id="data-quality-title">Обнаруженные отклонения</h2></div>
            <span>{issues.length}</span>
          </div>
          <p className="data-quality-panel__lead">Замечания расположены по влиянию. В каждой карточке указано, что произошло, как это влияет на результат и что сделать дальше.</p>
          <div className="quality-issue-list">
            {issues.map((issue) => <QualityIssueCard issue={issue} key={issue.id} />)}
          </div>
        </section>
      ) : (
        <section className="panel data-quality-empty" aria-labelledby="data-quality-title">
          <div aria-hidden="true">✓</div>
          <div>
            <p className="eyebrow">Проверка завершена</p>
            <h2 id="data-quality-title">Отклонений не обнаружено</h2>
            <p>Структура и заполненность загруженного источника соответствуют требованиям текущей версии модели.</p>
          </div>
        </section>
      )}
    </div>
  );
}
