import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  createAnalysis,
  deleteAnalysis,
  getAnalysisDistribution,
  getAnalysisResults,
  getAnalysisStatus,
  getAnalysisSummary,
} from "./api/client";
import { DashboardShell } from "./layout/DashboardShell";
import { DataQualityPage } from "./routes/DataQualityPage";
import { ModelQualityPage } from "./routes/ModelQualityPage";
import { NewAnalysisPage } from "./routes/NewAnalysisPage";
import { OverviewPage } from "./routes/OverviewPage";
import { RiskRecordsPage } from "./routes/RiskRecordsPage";
import { useDashboardRoute } from "./routes/useDashboardRoute";
import type {
  AnalysisRow,
  AnalysisStatus,
  AnalysisSummary,
  ResultPage,
  RiskDistribution,
  RiskLevel,
} from "./types/analysis";
import type { SessionNotification } from "./types/notifications";
import { parseQualityIssues } from "./utils/dataQuality";

const PAGE_SIZE = 25;
const ACTIVE_ANALYSIS_KEY = "risk-ledger-active-analysis";
const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const errorMessages: Record<string, string> = {
  analysis_failed: "Анализ не удалось завершить.",
  analysis_not_found: "Предыдущая сессия уже завершена или была удалена.",
  file_too_large: "Размер файла превышает допустимые 150 МБ.",
  model_unavailable: "Локальная модель сейчас недоступна.",
  request_failed: "Не удалось связаться с локальным сервисом анализа.",
  unsupported_file: "Поддерживаются только CSV-файлы.",
};

interface VisibleError {
  message: string;
  details: string[];
}

interface AdvancedRecordFilters {
  requiresReview: boolean;
  probabilityMin: number;
  probabilityMax: number;
  recordId: string;
}

const DEFAULT_ADVANCED_FILTERS: AdvancedRecordFilters = {
  requiresReview: false,
  probabilityMin: 0,
  probabilityMax: 100,
  recordId: "",
};

export default function App() {
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [results, setResults] = useState<ResultPage | null>(null);
  const [topRiskRows, setTopRiskRows] = useState<AnalysisRow[]>([]);
  const [distribution, setDistribution] = useState<RiskDistribution | null>(null);
  const [error, setError] = useState<VisibleError | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "all">("all");
  const [page, setPage] = useState(1);
  const [thresholdPercent, setThresholdPercent] = useState(50);
  const [modelThresholdPercent, setModelThresholdPercent] = useState(50);
  const [appliedThreshold, setAppliedThreshold] = useState<number | undefined>();
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const runId = useRef(0);
  const restorationStarted = useRef(false);
  const resultsRequestId = useRef(0);
  const workspacePhase = summary && results
    ? "ready"
    : status
      ? "processing"
      : error
        ? "failed"
        : "empty";
  const { activeRoute, navigate } = useDashboardRoute(workspacePhase);
  const previousWorkspacePhase = useRef(workspacePhase);
  const notificationSources = summary?.summary.warnings ?? status?.warnings ?? [];
  const notifications: SessionNotification[] = parseQualityIssues(notificationSources);
  if (error) {
    const criticalDetails = error.details.length ? parseQualityIssues(error.details) : [];
    notifications.unshift({
      id: "session-error",
      level: "critical",
      title: error.message,
      description: "Текущий анализ остановлен. Исправьте файл или повторите действие.",
      technicalCode: "ANALYSIS_STOPPED",
    }, ...criticalDetails);
  }

  useEffect(() => {
    const becameReady =
      workspacePhase === "ready" && previousWorkspacePhase.current !== "ready";
    previousWorkspacePhase.current = workspacePhase;
    if (becameReady && activeRoute === "new-analysis") {
      navigate("overview", true);
    }
  }, [activeRoute, navigate, workspacePhase]);

  const loadResults = useCallback(
    async (
      id: string,
      nextPage: number,
      nextRisk: RiskLevel | "all",
      threshold?: number,
      updateOverview = false,
      filters: AdvancedRecordFilters = DEFAULT_ADVANCED_FILTERS,
      updateDistribution = updateOverview,
    ) => {
      const requestId = resultsRequestId.current + 1;
      resultsRequestId.current = requestId;
      const [nextSummary, nextResults, nextDistribution] = await Promise.all([
        getAnalysisSummary(id, threshold),
        getAnalysisResults(id, {
          page: nextPage,
          pageSize: PAGE_SIZE,
          riskLevel: nextRisk === "all" ? undefined : nextRisk,
          threshold,
          requiresReview: filters.requiresReview ? true : undefined,
          probabilityMin: filters.probabilityMin > 0 ? filters.probabilityMin / 100 : undefined,
          probabilityMax: filters.probabilityMax < 100 ? filters.probabilityMax / 100 : undefined,
          recordId: filters.recordId.trim() || undefined,
        }),
        updateDistribution ? getAnalysisDistribution(id, threshold) : Promise.resolve(null),
      ]);
      if (requestId !== resultsRequestId.current) return;
      setSummary(nextSummary);
      setResults(nextResults);
      if (updateOverview) setTopRiskRows(nextResults.items.slice(0, 5));
      if (updateOverview) setModelThresholdPercent(Math.round(nextSummary.threshold * 100));
      if (nextDistribution) setDistribution(nextDistribution);
      setThresholdPercent(Math.round(nextSummary.threshold * 100));
    },
    [],
  );

  const pollAnalysis = useCallback(async (id: string, currentRun: number) => {
    while (runId.current === currentRun) {
      const nextStatus = await getAnalysisStatus(id);
      setStatus(nextStatus);
      if (nextStatus.status === "failed") {
        throw new ApiClientError(
          "analysis_failed",
          nextStatus.stage === "schema_rejected"
            ? "Файл не прошёл проверку совместимости."
            : "Анализ не удалось завершить.",
          nextStatus.errors,
        );
      }
      if (nextStatus.status === "completed") {
        await loadResults(id, 1, "all", undefined, true);
        return;
      }
      await delay(350);
    }
  }, [loadResults]);

  const showError = useCallback((caught: unknown) => {
    if (caught instanceof ApiClientError) {
      setError({
        message: errorMessages[caught.code] ?? caught.message,
        details: caught.details,
      });
    } else {
      setError({ message: "Не удалось завершить анализ.", details: [] });
    }
  }, []);

  useEffect(() => {
    if (restorationStarted.current) return;
    restorationStarted.current = true;
    const storedAnalysisId = window.localStorage.getItem(ACTIVE_ANALYSIS_KEY);
    if (!storedAnalysisId) return;

    const currentRun = runId.current + 1;
    runId.current = currentRun;
    setAnalysisId(storedAnalysisId);
    setStatus({
      analysis_id: storedAnalysisId,
      filename: "Восстановление локальной сессии",
      status: "queued",
      progress: 0,
      stage: "queued",
      warnings: [],
      errors: [],
    });

    void pollAnalysis(storedAnalysisId, currentRun).catch((caught: unknown) => {
      setStatus(null);
      if (caught instanceof ApiClientError && caught.code === "analysis_not_found") {
        setAnalysisId(null);
        window.localStorage.removeItem(ACTIVE_ANALYSIS_KEY);
        return;
      }
      showError(caught);
    });
  }, [pollAnalysis, showError]);

  const handleUpload = async (file: File) => {
    const currentRun = runId.current + 1;
    runId.current = currentRun;
    setError(null);

    const previousAnalysisId = analysisId ?? window.localStorage.getItem(ACTIVE_ANALYSIS_KEY);
    if (previousAnalysisId) {
      try {
        await deleteAnalysis(previousAnalysisId);
      } catch (caught) {
        if (!(caught instanceof ApiClientError) || caught.code !== "analysis_not_found") {
          showError(caught);
          return;
        }
      }
      window.localStorage.removeItem(ACTIVE_ANALYSIS_KEY);
      setAnalysisId(null);
    }

    setSummary(null);
    setResults(null);
    setTopRiskRows([]);
    setDistribution(null);
    setRiskLevel("all");
    setPage(1);
    setAppliedThreshold(undefined);
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setAppliedAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setStatus({
      analysis_id: "pending",
      filename: file.name,
      status: "queued",
      progress: 0,
      stage: "queued",
      warnings: [],
      errors: [],
    });

    try {
      const created = await createAnalysis(file);
      setAnalysisId(created.analysis_id);
      window.localStorage.setItem(ACTIVE_ANALYSIS_KEY, created.analysis_id);
      await pollAnalysis(created.analysis_id, currentRun);
    } catch (caught) {
      setStatus(null);
      setSummary(null);
      setResults(null);
      setTopRiskRows([]);
      setDistribution(null);
      showError(caught);
    }
  };

  const refresh = async (
    nextPage: number,
    nextRisk: RiskLevel | "all",
    threshold = appliedThreshold,
  ) => {
    if (!analysisId) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadResults(analysisId, nextPage, nextRisk, threshold, false, appliedAdvancedFilters);
    } catch (caught) {
      showError(caught);
    } finally {
      setRefreshing(false);
    }
  };

  const changeRiskLevel = (nextRisk: RiskLevel | "all") => {
    setRiskLevel(nextRisk);
    setPage(1);
    void refresh(1, nextRisk);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    void refresh(nextPage, riskLevel);
  };

  const applyThreshold = () => {
    const threshold = thresholdPercent / 100;
    setAppliedThreshold(threshold);
    setPage(1);
    if (!analysisId) return;
    setRefreshing(true);
    setError(null);
    void loadResults(analysisId, 1, riskLevel, threshold, false, appliedAdvancedFilters, true)
      .catch(showError)
      .finally(() => setRefreshing(false));
  };

  const resetThreshold = () => {
    setThresholdPercent(modelThresholdPercent);
    setAppliedThreshold(undefined);
    setPage(1);
    if (!analysisId) return;
    setRefreshing(true);
    void loadResults(analysisId, 1, riskLevel, undefined, false, appliedAdvancedFilters, true)
      .catch(showError)
      .finally(() => setRefreshing(false));
  };

  const applyAdvancedFilters = () => {
    const normalized = {
      requiresReview: advancedFilters.requiresReview,
      probabilityMin: Math.max(0, Math.min(100, advancedFilters.probabilityMin)),
      probabilityMax: Math.max(0, Math.min(100, advancedFilters.probabilityMax)),
      recordId: advancedFilters.recordId,
    };
    if (normalized.probabilityMin > normalized.probabilityMax) {
      setError({ message: "Минимальная вероятность не может быть больше максимальной.", details: [] });
      return;
    }
    setAdvancedFilters(normalized);
    setAppliedAdvancedFilters(normalized);
    setPage(1);
    if (!analysisId) return;
    setRefreshing(true);
    setError(null);
    void loadResults(analysisId, 1, riskLevel, appliedThreshold, false, normalized)
      .catch(showError)
      .finally(() => setRefreshing(false));
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setAppliedAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setRiskLevel("all");
    setPage(1);
    if (!analysisId) return;
    setRefreshing(true);
    setError(null);
    void loadResults(analysisId, 1, "all", appliedThreshold, false, DEFAULT_ADVANCED_FILTERS)
      .catch(showError)
      .finally(() => setRefreshing(false));
  };

  const closeSession = async (): Promise<boolean> => {
    runId.current += 1;
    if (analysisId) {
      try {
        await deleteAnalysis(analysisId);
      } catch (caught) {
        showError(caught);
        return false;
      }
    }
    setAnalysisId(null);
    setStatus(null);
    setSummary(null);
    setResults(null);
    setTopRiskRows([]);
    setDistribution(null);
    setError(null);
    window.localStorage.removeItem(ACTIVE_ANALYSIS_KEY);
    navigate("new-analysis", true);
    return true;
  };

  const processing = Boolean(status && !summary);

  if (activeRoute === "new-analysis") {
    return (
      <DashboardShell
        activeRoute={activeRoute}
        notifications={notifications}
        phase={workspacePhase}
        onNavigate={navigate}
      >
        <NewAnalysisPage
          error={error}
          hasActiveAnalysis={Boolean(analysisId || summary)}
          processing={processing}
          status={status}
          onClearError={() => { void closeSession(); }}
          onStart={(file) => { void handleUpload(file); }}
        />
      </DashboardShell>
    );
  }

  if (!summary || !results || !analysisId) {
    return (
      <DashboardShell
        activeRoute={activeRoute}
        notifications={notifications}
        phase={workspacePhase}
        onNavigate={navigate}
      >
        <div className="ui-state ui-state--loading" role="status">
          <span className="ui-spinner" aria-hidden="true" />
          <span>Подготавливаем результаты анализа…</span>
        </div>
      </DashboardShell>
    );
  }

  let routeContent;
  if (activeRoute === "risk-records") {
    routeContent = (
      <RiskRecordsPage
        busy={refreshing}
        distribution={distribution}
        errorMessage={error?.message}
        modelThresholdPercent={modelThresholdPercent}
        page={page}
        pageSize={results.page_size}
        probabilityMax={advancedFilters.probabilityMax}
        probabilityMin={advancedFilters.probabilityMin}
        recordId={advancedFilters.recordId}
        requiresReview={advancedFilters.requiresReview}
        riskLevel={riskLevel}
        rows={results.items}
        thresholdPercent={thresholdPercent}
        total={results.total}
        onFiltersApply={applyAdvancedFilters}
        onFiltersReset={resetAdvancedFilters}
        onPageChange={changePage}
        onRiskLevelChange={changeRiskLevel}
        onThresholdApply={applyThreshold}
        onThresholdChange={setThresholdPercent}
        onThresholdReset={resetThreshold}
        onProbabilityMaxChange={(value) => setAdvancedFilters((current) => ({ ...current, probabilityMax: value }))}
        onProbabilityMinChange={(value) => setAdvancedFilters((current) => ({ ...current, probabilityMin: value }))}
        onRecordIdChange={(value) => setAdvancedFilters((current) => ({ ...current, recordId: value }))}
        onRequiresReviewChange={(value) => setAdvancedFilters((current) => ({ ...current, requiresReview: value }))}
      />
    );
  } else if (activeRoute === "model-quality") {
    routeContent = <ModelQualityPage metrics={summary.metrics} />;
  } else if (activeRoute === "data-quality") {
    routeContent = (
      <DataQualityPage
        targetPresent={summary.summary.target_present}
        targetValid={summary.summary.target_valid}
        warnings={summary.summary.warnings}
      />
    );
  } else {
    routeContent = (
      <OverviewPage
        analysisId={analysisId}
        filename={status?.filename ?? null}
        rows={topRiskRows}
        summary={summary}
        onCloseSession={closeSession}
        onNavigate={navigate}
      />
    );
  }

  return (
    <DashboardShell
      activeRoute={activeRoute}
      notifications={notifications}
      phase={workspacePhase}
      onNavigate={navigate}
    >
      {routeContent}
    </DashboardShell>
  );
}
