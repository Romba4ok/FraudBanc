import { ExportActions } from "../components/ExportActions";
import { RiskDonutChart } from "../components/RiskDonutChart";
import { SessionControls } from "../components/SessionControls";
import { QualityHighlights } from "../components/QualityHighlights";
import { SummaryCards } from "../components/SummaryCards";
import { TopRiskRecords } from "../components/TopRiskRecords";
import { ProfileOverview } from "../components/ProfileOverview";
import type { AnalysisRow, AnalysisSummary, TransactionRow } from "../types/analysis";
import type { DashboardRouteId } from "../types/dashboard";

interface OverviewPageProps {
  analysisId: string;
  filename: string | null;
  rows: AnalysisRow[];
  clients?: AnalysisRow[];
  clientTotal?: number;
  transactions?: TransactionRow[];
  transactionTotal?: number;
  summary: AnalysisSummary;
  onCloseSession: () => Promise<boolean>;
  onNavigate: (route: DashboardRouteId) => void;
}

export function OverviewPage({
  analysisId,
  filename,
  rows,
  clients,
  clientTotal,
  transactions,
  transactionTotal,
  summary,
  onCloseSession,
  onNavigate,
}: OverviewPageProps) {
  const showProfiles = clientTotal !== undefined || transactionTotal !== undefined;
  const criticalCount = summary.summary.risk_counts.critical;
  const highCount = summary.summary.risk_counts.high;
  const priorityCount = criticalCount + highCount;
  const reviewShare = summary.summary.rows
    ? (summary.summary.requires_review / summary.summary.rows) * 100
    : 0;
  const priorityLabel = criticalCount > 0
    ? "Критический приоритет"
    : highCount > 0
      ? "Требует внимания"
      : "Ситуация контролируема";
  return (
    <div className="overview-page">
      <header className="overview-hero">
        <div>
          <span className="overview-hero__section">Оперативная сводка</span>
          <h1>Карта риска выборки</h1>
          <div className="overview-hero__meta">
            <span><strong>Источник</strong>{filename ?? "Загруженная выборка"}</span>
            <span><strong>Модель</strong>{summary.model_version}</span>
            <span><strong>Порог проверки</strong>{(summary.threshold * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="overview-actions">
          <SessionControls onCloseSession={onCloseSession} />
        </div>
      </header>

      <section className="executive-brief" aria-labelledby="executive-brief-title">
        <div className="executive-brief__main">
          <span className={`executive-brief__status${criticalCount ? " is-critical" : highCount ? " is-warning" : " is-stable"}`}>
            {priorityLabel}
          </span>
          <h2 id="executive-brief-title">
            {priorityCount > 0
              ? `${priorityCount.toLocaleString("ru-RU")} записей высокого и критического риска требуют приоритетного разбора`
              : "Записей высокого и критического риска не обнаружено"}
          </h2>
          <p>
            В очередь ручной проверки попало {summary.summary.requires_review.toLocaleString("ru-RU")} записей — {reviewShare.toFixed(1)}% выборки.
            {criticalCount > 0 ? " Начните с критических сигналов и зафиксируйте решение по каждому делу." : " Проверьте верхние позиции очереди и отклонения качества данных."}
          </p>
          <button className="ui-button ui-button--primary" type="button" onClick={() => onNavigate("risk-records")}>
            Перейти к очереди проверки
          </button>
        </div>

        <dl className="executive-brief__facts">
          <div><dt>Критических сигналов</dt><dd>{criticalCount.toLocaleString("ru-RU")}</dd><span>первый приоритет</span></div>
          <div><dt>Высокий риск</dt><dd>{highCount.toLocaleString("ru-RU")}</dd><span>усиленная проверка</span></div>
          <div><dt>Предупреждения данных</dt><dd>{summary.summary.warnings.length.toLocaleString("ru-RU")}</dd><span>{summary.summary.warnings.length ? "нужно учесть" : "отклонений нет"}</span></div>
        </dl>

        <aside className="executive-report" aria-labelledby="executive-report-title">
          <span>Итоговый материал</span>
          <h3 id="executive-report-title">Отчёт для руководителя</h3>
          <p>Скачайте полную выборку или отдельную очередь ручной проверки с учётом текущего порога.</p>
          <ExportActions
            analysisId={analysisId}
            reviewCount={summary.summary.requires_review}
            threshold={summary.threshold}
          />
        </aside>
      </section>

      <SummaryCards summary={summary} />

      {showProfiles && <ProfileOverview clients={clients ?? rows} clientTotal={clientTotal ?? rows.length} transactions={transactions ?? []} transactionTotal={transactionTotal ?? 0} onNavigate={onNavigate} />}

      <div className="overview-grid">
        <RiskDonutChart counts={summary.summary.risk_counts} />
        <QualityHighlights summary={summary} onNavigate={onNavigate} />
      </div>

      <TopRiskRecords rows={rows} onOpenAll={() => onNavigate("risk-records")} />
    </div>
  );
}
