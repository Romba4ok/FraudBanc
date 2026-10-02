import { useState } from "react";
import { MetricsPanel } from "../components/MetricsPanel";
import type { AnalysisMetrics } from "../types/analysis";

export function ModelQualityPage({ metrics }: { metrics: AnalysisMetrics }) {
  const [mode, setMode] = useState<"simple" | "expert">("simple");
  const recall = metrics.recall ?? 0;
  const precision = metrics.precision ?? 0;
  const status = !metrics.available ? "Нельзя проверить" : recall >= .8 && precision >= .7 ? "Устойчиво" : recall >= .6 && precision >= .4 ? "Нужен контроль" : "Требует настройки";
  return (
    <div className={`section-page model-quality-page quality-mode-${mode}`}>
      <header className="section-page__intro model-quality-page__intro"><div><p className="eyebrow">Контроль модели</p><h1>Качество модели</h1><p>Показатели относятся только к текущей выборке с подтверждёнными фактическими результатами.</p></div><div className="quality-page__summary" aria-label="Сводная оценка модели"><span className={status === "Устойчиво" ? "is-good" : status === "Нужен контроль" ? "is-attention" : "is-critical"}><strong>{status}</strong><small>общая оценка</small></span><span><strong>{metrics.available ? `${(recall * 100).toFixed(1)}%` : "—"}</strong><small>реальных рисков найдено</small></span><span><strong>{metrics.available ? `${(precision * 100).toFixed(1)}%` : "—"}</strong><small>тревог подтвердилось</small></span></div></header>
      <div className="quality-page__toolbar"><div><strong>Уровень детализации</strong><span>Начните с понятного вывода; формулы доступны в экспертном виде.</span></div><div className="quality-mode-switch" role="group" aria-label="Режим отображения качества модели"><button type="button" aria-pressed={mode === "simple"} className={mode === "simple" ? "is-active" : undefined} onClick={() => setMode("simple")}>Понятный вид</button><button type="button" aria-pressed={mode === "expert"} className={mode === "expert" ? "is-active" : undefined} onClick={() => setMode("expert")}>Экспертный вид</button></div></div>
      <MetricsPanel metrics={metrics} />
    </div>
  );
}
