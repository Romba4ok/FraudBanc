import type { RiskLevel } from "../types/analysis";

const levelDefinitions: Array<{
  level: RiskLevel;
  label: string;
  color: string;
}> = [
  { level: "critical", label: "Критический", color: "#b42335" },
  { level: "high", label: "Высокий", color: "#d47a17" },
  { level: "medium", label: "Средний", color: "#d4aa4d" },
  { level: "low", label: "Низкий", color: "#23856d" },
];

const number = new Intl.NumberFormat("ru-RU");

export function RiskDonutChart({
  counts,
}: {
  counts: Record<RiskLevel, number>;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  let cursor = 0;
  const segments = levelDefinitions.map(({ level, color }) => {
    const start = cursor;
    cursor += total ? (counts[level] / total) * 100 : 0;
    return `${color} ${start}% ${cursor}%`;
  });
  const chartLabel = levelDefinitions
    .map(({ level, label }) => `${label}: ${number.format(counts[level])}`)
    .join("; ");
  const priorityCount = counts.critical + counts.high;
  const priorityShare = total ? (priorityCount / total) * 100 : 0;

  return (
    <section className="overview-card risk-distribution" aria-labelledby="risk-distribution-title">
      <div className="overview-card__heading">
        <div>
          <h2 id="risk-distribution-title">Распределение риска</h2>
          <p>Соотношение записей по уровню приоритета проверки.</p>
        </div>
      </div>
      <div className="risk-distribution__body">
        <div
          aria-label={chartLabel}
          className="risk-donut"
          role="img"
          style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "var(--line)" }}
        >
          <div>
            <strong>{number.format(total)}</strong>
            <span>записей</span>
          </div>
        </div>
        <ul className="risk-legend">
          {levelDefinitions.map(({ level, label, color }) => {
            const share = total ? (counts[level] / total) * 100 : 0;
            return (
              <li key={level}>
                <span className="risk-legend__dot" style={{ backgroundColor: color }} aria-hidden="true" />
                <span>{label}</span>
                <strong>{number.format(counts[level])}</strong>
                <small>{share.toFixed(1)}%</small>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="risk-distribution__insight">
        <strong>{priorityShare.toFixed(1)}%</strong> выборки относится к высокому или критическому риску — {number.format(priorityCount)} записей.
      </p>
    </section>
  );
}
