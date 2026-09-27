import type { AnalysisStatus } from "../types/analysis";

const stageLabels: Record<string, string> = {
  queued: "Ожидание обработки",
  reading_csv: "Чтение CSV",
  inference: "Расчёт риска и объяснений",
  completed: "Анализ завершён",
  schema_rejected: "Файл несовместим",
  failed: "Обработка остановлена",
  storage_failed: "Недостаточно временного места",
};

export function ProgressPanel({ status }: { status: AnalysisStatus }) {
  return (
    <section className="progress-panel" aria-live="polite" aria-label="Прогресс анализа">
      <div className="section-heading section-heading--inline">
        <div>
          <p className="eyebrow">Состояние модели</p>
          <h2>{stageLabels[status.stage] ?? status.stage}</h2>
        </div>
        <strong className="progress-value">{status.progress}%</strong>
      </div>
      <div
        aria-label={`Выполнено ${status.progress}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={status.progress}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${status.progress}%` }} />
      </div>
      <p className="muted">{status.filename}</p>
      <p className="progress-note">
        Большой файл может обрабатываться несколько минут. Не закрывайте эту вкладку
        до завершения анализа.
      </p>
    </section>
  );
}
