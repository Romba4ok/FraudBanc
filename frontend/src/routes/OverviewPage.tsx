import { ExportActions } from "../components/ExportActions";
import { RiskDonutChart } from "../components/RiskDonutChart";
import { SessionControls } from "../components/SessionControls";
import { QualityHighlights } from "../components/QualityHighlights";
import { SummaryCards } from "../components/SummaryCards";
import { TopRiskRecords } from "../components/TopRiskRecords";
import type { AnalysisRow, AnalysisSummary } from "../types/analysis";
import type { DashboardRouteId } from "../types/dashboard";

interface OverviewPageProps {
  analysisId: string;
  filename: string | null;
  rows: AnalysisRow[];
  summary: AnalysisSummary;
  onCloseSession: () => Promise<boolean>;
  onNavigate: (route: DashboardRouteId) => void;
}

export function OverviewPage({
  analysisId,
  filename,
  rows,
  summary,
  onCloseSession,
  onNavigate,
}: OverviewPageProps) {
  return (
    <div className="overview-page">
      <header className="overview-hero">
        <div>
          <p className="eyebrow">Результат анализа</p>
          <h1>Карта риска выборки</h1>
          <p>{filename ?? "Загруженная выборка"} · модель {summary.model_version}</p>
        </div>
        <div className="overview-actions">
          <ExportActions
            analysisId={analysisId}
            reviewCount={summary.summary.requires_review}
            threshold={summary.threshold}
          />
          <SessionControls onCloseSession={onCloseSession} />
        </div>
      </header>

      <SummaryCards summary={summary} />

      <div className="overview-grid">
        <RiskDonutChart counts={summary.summary.risk_counts} />
        <QualityHighlights summary={summary} onNavigate={onNavigate} />
      </div>

      <TopRiskRecords rows={rows} onOpenAll={() => onNavigate("risk-records")} />
    </div>
  );
}
