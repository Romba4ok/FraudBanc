import type {
  AnalysisStatus,
  AnalysisSummary,
  AnalysisResultsQuery,
  ApiErrorPayload,
  CreateAnalysisResponse,
  HealthStatus,
  ModelStatus,
  ResultPage,
  RiskDistribution,
  ReportDownload,
} from "../types/analysis";

const API_BASE = "/api";

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, init);
  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // The fallback below remains readable when a proxy returns a non-JSON error.
    }
    throw new ApiClientError(
      payload?.error.code ?? "request_failed",
      payload?.error.message ?? `Ошибка запроса (${response.status})`,
      payload?.error.details ?? [],
    );
  }
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) values.set(key, String(value));
  });
  const serialized = values.toString();
  return serialized ? `?${serialized}` : "";
}

export async function createAnalysis(file: File): Promise<CreateAnalysisResponse> {
  const body = new FormData();
  body.append("file", file);
  return request<CreateAnalysisResponse>("/analyses", { method: "POST", body });
}

export function getHealthStatus(): Promise<HealthStatus> {
  return request<HealthStatus>("/health");
}

export function getModelStatus(): Promise<ModelStatus> {
  return request<ModelStatus>("/model");
}

export function getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
  return request<AnalysisStatus>(`/analyses/${analysisId}/status`);
}

export function getAnalysisSummary(
  analysisId: string,
  threshold?: number,
): Promise<AnalysisSummary> {
  return request<AnalysisSummary>(
    `/analyses/${analysisId}/summary${query({ threshold })}`,
  );
}

export function getAnalysisResults(
  analysisId: string,
  options: AnalysisResultsQuery,
): Promise<ResultPage> {
  return request<ResultPage>(
    `/analyses/${analysisId}/results${query({
      page: options.page,
      page_size: options.pageSize,
      risk_level: options.riskLevel,
      threshold: options.threshold,
      requires_review: options.requiresReview === undefined
        ? undefined
        : String(options.requiresReview),
      probability_min: options.probabilityMin,
      probability_max: options.probabilityMax,
      record_id: options.recordId || undefined,
    })}`,
  );
}

export function getAnalysisDistribution(
  analysisId: string,
  threshold?: number,
  bins = 10,
): Promise<RiskDistribution> {
  return request<RiskDistribution>(
    `/analyses/${analysisId}/distribution${query({ bins, threshold })}`,
  );
}

export function reportUrl(
  analysisId: string,
  threshold?: number,
  requiresReview = false,
): string {
  return `${API_BASE}/analyses/${analysisId}/report.csv${query({
    threshold,
    requires_review: requiresReview ? "true" : undefined,
  })}`;
}

export async function downloadAnalysisReport(
  analysisId: string,
  threshold: number,
  requiresReview = false,
): Promise<ReportDownload> {
  const response = await fetch(reportUrl(analysisId, threshold, requiresReview));
  if (!response.ok) {
    throw new ApiClientError(
      "report_download_failed",
      "Не удалось подготовить CSV. Результат анализа сохранён — попробуйте скачать файл ещё раз.",
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const matchedName = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  return {
    blob: await response.blob(),
    filename: matchedName ?? `analysis-${analysisId}${requiresReview ? "-review" : ""}.csv`,
  };
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/analyses/${analysisId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new ApiClientError("delete_failed", "Не удалось удалить сессию анализа.");
  }
}
