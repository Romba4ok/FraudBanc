import { MetricsPanel } from "../components/MetricsPanel";
import type { AnalysisMetrics } from "../types/analysis";

export function ModelQualityPage({ metrics }: { metrics: AnalysisMetrics }) {
  return (
    <div className="section-page">
      <header className="section-page__intro">
        <p className="eyebrow">Контроль модели</p>
        <h1>Качество модели</h1>
        <p>Показатели рассчитаны только по загруженной выборке и её фактическим меткам.</p>
      </header>
      <MetricsPanel metrics={metrics} />
    </div>
  );
}
