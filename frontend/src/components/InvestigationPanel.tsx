import { useEffect, useId, useState } from "react";
import { getInvestigation, updateInvestigation } from "../api/client";
import type { InvestigationDetails, InvestigationStatus } from "../types/analysis";

const labels: Record<InvestigationStatus, string> = {
  new: "Новое",
  in_review: "В работе",
  confirmed: "Мошенничество подтверждено",
  dismissed: "Риск не подтвердился",
};

export function InvestigationPanel({ analysisId, entityId }: { analysisId: string; entityId: string }) {
  const titleId = useId();
  const [details, setDetails] = useState<InvestigationDetails | null>(null);
  const [status, setStatus] = useState<InvestigationStatus>("new");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(null);
    getInvestigation(analysisId, entityId)
      .then((next) => { if (active) { setDetails(next); setStatus(next.status); setComment(next.comment); } })
      .catch(() => { if (active) setError("Не удалось загрузить расследование."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [analysisId, entityId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await updateInvestigation(analysisId, entityId, { status, comment: comment.trim() });
      setDetails(next);
    } catch {
      setError("Не удалось сохранить решение аналитика.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="investigation-panel" aria-labelledby={titleId}>
      <div className="investigation-panel__heading"><div><span>Решение аналитика</span><h3 id={titleId}>Итог расследования</h3></div><strong className={`investigation-status investigation-status--${status}`}>{labels[status]}</strong></div>
      <p className="investigation-panel__notice">Решение станет обучающей меткой только после явного сохранения аналитиком.</p>
      <div className="investigation-panel__fields">
        <label>Статус решения<select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as InvestigationStatus)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Обоснование<textarea maxLength={1000} rows={3} value={comment} disabled={busy} placeholder="Укажите факты и документы, на которых основано решение" onChange={(event) => setComment(event.target.value)} /></label>
      </div>
      <button className="ui-button ui-button--primary" disabled={busy} type="button" onClick={() => { void save(); }}>{busy ? "Сохраняем…" : "Сохранить решение"}</button>
      {error && <p role="alert">{error}</p>}
      {details?.confirmed_label && <p className="investigation-panel__confirmed">Подтверждённая метка сохранена обезличенно: {details.confirmed_label.human_label ? "мошенничество" : "ложная тревога"}.</p>}
      {details?.history.length ? <details className="investigation-history" open><summary>Хронология решений ({details.history.length})</summary><ol>{details.history.map((event) => <li key={event.event_id}><strong>{labels[event.status]}</strong><time dateTime={new Date(event.occurred_at * 1000).toISOString()}>{new Date(event.occurred_at * 1000).toLocaleString("ru-RU")}</time>{event.comment && <p>{event.comment}</p>}</li>)}</ol></details> : null}
    </section>
  );
}
