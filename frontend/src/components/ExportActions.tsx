import { useEffect, useRef, useState } from "react";
import { downloadAnalysisReport } from "../api/client";

type ExportKind = "full" | "review";

interface ExportActionsProps {
  analysisId: string;
  reviewCount: number;
  threshold: number;
}

export function ExportActions({ analysisId, reviewCount, threshold }: ExportActionsProps) {
  const [active, setActive] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const download = async (kind: ExportKind) => {
    setActive(kind);
    setError(null);
    try {
      const report = await downloadAnalysisReport(analysisId, threshold, kind === "review");
      const objectUrl = URL.createObjectURL(report.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = report.filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      if (!mounted.current) return;
      setError(caught instanceof Error ? caught.message : "Не удалось скачать CSV. Попробуйте ещё раз.");
    } finally {
      if (mounted.current) setActive(null);
    }
  };

  return (
    <div className="export-actions">
      <div className="export-actions__buttons">
        <button className="ui-button ui-button--primary" disabled={active !== null} type="button" onClick={() => { void download("full"); }}>
          {active === "full" ? <><span className="ui-spinner" aria-hidden="true" /> Подготовка CSV…</> : "Скачать CSV"}
        </button>
        <button className="ui-button ui-button--secondary" disabled={active !== null || reviewCount === 0} type="button" onClick={() => { void download("review"); }}>
          {active === "review" ? <><span className="ui-spinner" aria-hidden="true" /> Подготовка…</> : `Только ручная проверка (${reviewCount})`}
        </button>
      </div>
      <small>Выгрузка учитывает порог {(threshold * 100).toFixed(0)}% и содержит полный набор разрешённых полей.</small>
      {error && <p className="export-actions__error" role="alert">{error}</p>}
    </div>
  );
}
