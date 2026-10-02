import type { AnalysisSummary } from "../types/analysis";

const number = new Intl.NumberFormat("ru-RU");

export function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const reviewShare = summary.summary.rows
    ? (summary.summary.requires_review / summary.summary.rows) * 100
    : 0;
  return (
    <section className="summary-grid" aria-label="Сводка анализа">
      <article className="summary-card summary-card--neutral">
        <div className="summary-card__heading"><span>Проверено записей</span></div>
        <strong>{number.format(summary.summary.rows)}</strong>
        <small>Вся загруженная выборка</small>
      </article>
      <article className="summary-card summary-card--warning">
        <div className="summary-card__heading"><span>Требуют проверки</span></div>
        <strong>{number.format(summary.summary.requires_review)}</strong>
        <small>{reviewShare.toFixed(1)}% выборки</small>
      </article>
      <article className="summary-card summary-card--danger">
        <div className="summary-card__heading"><span>Критический риск</span></div>
        <strong>{number.format(summary.summary.risk_counts.critical)}</strong>
        <small>Максимальный приоритет</small>
      </article>
      <article className="summary-card summary-card--info">
        <div className="summary-card__heading"><span>Высокий приоритет</span></div>
        <strong>{number.format(summary.summary.risk_counts.high)}</strong>
        <small>Усиленная проверка</small>
      </article>
    </section>
  );
}
