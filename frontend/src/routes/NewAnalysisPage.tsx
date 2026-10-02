import { useState } from "react";
import { AnalysisPlanPanel } from "../components/AnalysisPlanPanel";
import { AnalystBrief } from "../components/AnalystBrief";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { ProgressPanel } from "../components/ProgressPanel";
import { UploadPanel } from "../components/UploadPanel";
import { AlertIcon, ShieldCheckIcon } from "../components/ui/icons";
import type { AnalysisPlan, AnalysisStatus, SourceInventory } from "../types/analysis";
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
  inventory: SourceInventory | null;
  plan: AnalysisPlan | null;
  cancelling: boolean;
  starting: boolean;
  onClearError: () => void;
  onCancel: () => void;
  onRun: (period: { start: string | null; end: string | null }) => void;
  onStart: (file: File) => void;
}

export function NewAnalysisPage({
  error,
  hasActiveAnalysis,
  processing,
  status,
  inventory,
  plan,
  cancelling,
  starting,
  onClearError,
  onCancel,
  onRun,
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
        <div>
          <span className="page-intro__section">Подготовка проверки</span>
          <h1>Новый анализ</h1>
          <p>
            Загрузите банковский источник, проверьте автоматически составленный план
            и запустите поиск подозрительных клиентов и операций.
          </p>
        </div>
        <div className="page-intro__privacy" aria-label="Режим обработки данных">
          <ShieldCheckIcon />
          <div><strong>Закрытый контур</strong><span>Данные не покидают систему банка</span></div>
        </div>
      </header>

      <div className="new-analysis-workspace">
        <main className="new-analysis-workspace__primary">
          {status && (
            <ProgressPanel cancelling={cancelling} status={status} onCancel={onCancel} />
          )}

          {error && (
            <section className="error-panel" role="alert">
              <div className="state-panel__heading">
                <span className="state-panel__icon" aria-hidden="true"><AlertIcon /></span>
                <div><span>Анализ остановлен</span><h2>{error.message}</h2></div>
              </div>
              <p className="state-panel__lead">
                Источник не изменён. Исправьте указанные замечания или выберите другой файл.
              </p>
              {error.details.length > 0 && (
                <div className="state-panel__details">
                  <strong>Что требует внимания</strong>
                  <ul>{error.details.map((detail) => <li key={detail}>{formatErrorDetail(detail)}</li>)}</ul>
                </div>
              )}
              <button className="ui-button ui-button--secondary" type="button" onClick={onClearError}>
                Выбрать другой файл
              </button>
            </section>
          )}

          {status?.status === "planned" && inventory && plan ? (
            <AnalysisPlanPanel busy={starting} inventory={inventory} plan={plan} onRun={onRun} />
          ) : status?.status === "cancelled" ? (
            <section className="cancelled-panel">
              <div className="state-panel__heading">
                <span className="state-panel__icon state-panel__icon--neutral" aria-hidden="true"><AlertIcon /></span>
                <div><span>Операция отменена</span><h2>Расчёт остановлен</h2></div>
              </div>
              <p>Временные результаты не используются. Можно выбрать другой источник и начать новую проверку.</p>
              <button className="ui-button ui-button--secondary" type="button" onClick={onClearError}>Выбрать другой файл</button>
            </section>
          ) : !processing ? (
            <>
              {hasActiveAnalysis && !error && (
                <aside className="active-session-note">
                  <AlertIcon aria-hidden="true" />
                  <div><strong>Сейчас открыт другой анализ</strong><span>Перед заменой система попросит подтвердить удаление его временной сессии.</span></div>
                </aside>
              )}

              <UploadPanel disabled={false} onUpload={start} />
            </>
          ) : null}
        </main>

        <aside className="new-analysis-workspace__guide" aria-label="Порядок и ограничения анализа">
          <AnalystBrief
            title="Как проходит проверка"
            description="Система распознаёт источник сама. Аналитику остаётся подтвердить план и период."
            steps={[
              { label: "Источник", text: "Выберите локальный файл" },
              { label: "План", text: "Проверьте найденные профили" },
              { label: "Анализ", text: "Запустите расчёт рисков" },
            ]}
          />

          <section className="requirements-strip" aria-label="Требования к источнику">
            <header><span>Ограничения источника</span><strong>До загрузки</strong></header>
            <div><strong>Форматы</strong><span>CSV, JSON, SQL, SQLite и BSON</span></div>
            <div><strong>Размер файла</strong><span>Не более 500 МБ</span></div>
            <div><strong>Объём данных</strong><span>До 1 000 000 записей</span></div>
            <div><strong>Обработка</strong><span>Только в локальном контуре</span></div>
          </section>

          <section className="analysis-safety-note">
            <ShieldCheckIcon aria-hidden="true" />
            <div><strong>Безопасность сессии</strong><p>Файл и рассчитанные результаты удаляются после подтверждённого завершения сессии.</p></div>
          </section>
        </aside>
      </div>

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
