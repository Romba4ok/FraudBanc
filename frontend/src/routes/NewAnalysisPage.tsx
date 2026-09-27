import { useState } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { ProgressPanel } from "../components/ProgressPanel";
import { UploadPanel } from "../components/UploadPanel";
import type { AnalysisStatus } from "../types/analysis";
import { formatErrorDetail } from "../utils/dataQuality";

interface VisibleError {
  message: string;
  details: string[];
}

interface NewAnalysisPageProps {
  error: VisibleError | null;
  hasActiveAnalysis: boolean;
  processing: boolean;
  status: AnalysisStatus | null;
  onClearError: () => void;
  onStart: (file: File) => void;
}

export function NewAnalysisPage({
  error,
  hasActiveAnalysis,
  processing,
  status,
  onClearError,
  onStart,
}: NewAnalysisPageProps) {
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  const start = (file: File) => {
    if (hasActiveAnalysis) {
      setReplacementFile(file);
      return;
    }
    onStart(file);
  };

  return (
    <div className="new-analysis-page">
      <header className="page-intro">
        <p className="eyebrow">Локальная проверка выборки</p>
        <h1>Новый анализ</h1>
        <p>
          Передайте банковскую выборку модели. Файл и результаты остаются на этом
          компьютере и удаляются после завершения сессии.
        </p>
      </header>

      <section className="requirements-strip" aria-label="Требования к CSV">
        <div><strong>CSV</strong><span>UTF-8, разделитель ; или ,</span></div>
        <div><strong>150 МБ</strong><span>Максимальный размер файла</span></div>
        <div><strong>100 000</strong><span>Рекомендуемый предел строк</span></div>
        <div><strong>Локально</strong><span>Без передачи во внешние сервисы</span></div>
      </section>

      {processing && status ? (
        <ProgressPanel status={status} />
      ) : (
        <>
          {hasActiveAnalysis && !error && (
            <aside className="active-session-note">
              <strong>Сейчас открыт другой анализ.</strong>
              <span>При запуске нового файла его временная сессия будет удалена после подтверждения.</span>
            </aside>
          )}

          {error && (
            <section className="error-panel" role="alert">
              <p className="eyebrow">Анализ остановлен</p>
              <h2>{error.message}</h2>
              {error.details.length > 0 && (
                <ul>{error.details.map((detail) => <li key={detail}>{formatErrorDetail(detail)}</li>)}</ul>
              )}
              <button className="ui-button ui-button--secondary" type="button" onClick={onClearError}>
                Выбрать другой файл
              </button>
            </section>
          )}

          <UploadPanel disabled={false} onUpload={start} />
        </>
      )}

      <ConfirmationDialog
        confirmLabel="Удалить и продолжить"
        description="Текущий результат и его временные файлы будут удалены. Отменить это действие после запуска нового анализа будет нельзя."
        open={replacementFile !== null}
        title="Заменить текущий анализ?"
        onCancel={() => setReplacementFile(null)}
        onConfirm={() => {
          const file = replacementFile;
          setReplacementFile(null);
          if (file) onStart(file);
        }}
      />
    </div>
  );
}
