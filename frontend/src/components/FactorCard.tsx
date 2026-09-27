import type { ExplanationFactor } from "../types/analysis";
import { formatFeatureValue, getFeaturePresentation } from "../utils/labels";

const contribution = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 4,
  signDisplay: "always",
});

export function FactorCard({ factor }: { factor: ExplanationFactor }) {
  const feature = getFeaturePresentation(factor.feature);
  const increases = factor.direction === "increases_risk";
  const displayLabel = feature.label === factor.feature ? "Технический признак" : feature.label;
  return (
    <li
      className={`factor-card ${increases ? "factor-card--up" : "factor-card--down"}`}
      title={feature.description}
    >
      <span className="factor-card__direction" aria-hidden="true">{increases ? "↑" : "↓"}</span>
      <div className="factor-card__identity">
        <span className="factor-list__label">{displayLabel}</span>
        <code className="factor-list__code">{factor.feature}</code>
      </div>
      <strong>{formatFeatureValue(factor.value)}</strong>
      <small>{increases ? "Повышает риск" : "Снижает риск"}</small>
      <span className="factor-card__contribution">
        Вклад SHAP <strong>{contribution.format(factor.contribution)}</strong>
      </span>
    </li>
  );
}
