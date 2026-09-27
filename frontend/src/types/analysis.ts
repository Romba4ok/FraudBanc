export type AnalysisPhase =
  | "queued"
  | "validating"
  | "predicting"
  | "completed"
  | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface HealthStatus {
  status: "ok" | "degraded";
  model_ready: boolean;
}

export interface ModelStatus {
  ready: boolean;
  version: string | null;
  features: number | null;
  review_threshold: number | null;
  error: string | null;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: string[];
  };
}

export interface CreateAnalysisResponse {
  analysis_id: string;
  status: "queued";
  status_url: string;
}

export interface AnalysisStatus {
  analysis_id: string;
  filename: string;
  status: AnalysisPhase;
  progress: number;
  stage: string;
  warnings: string[];
  errors: string[];
}

export interface AnalysisMetrics {
  available: boolean;
  threshold: number;
  gini: number | null;
  ks: number | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  roc_auc: number | null;
  pr_auc: number | null;
  confusion_matrix: number[][] | null;
  unavailable_reason: string | null;
}

export interface AnalysisSummary {
  analysis_id: string;
  model_version: string;
  threshold: number;
  summary: {
    rows: number;
    requires_review: number;
    risk_counts: Record<RiskLevel, number>;
    warnings: string[];
    target_present: boolean;
    target_valid: boolean;
  };
  metrics: AnalysisMetrics;
}

export interface ExplanationFactor {
  feature: string;
  value: string | number | null;
  contribution: number;
  direction: "increases_risk" | "decreases_risk";
}

export interface AnalysisRow {
  record_id: string;
  risk_probability: number;
  risk_level: RiskLevel;
  requires_review: boolean;
  explanation_factors: ExplanationFactor[];
  analysis_warnings: string[];
  [column: string]: unknown;
}

export interface ResultPage {
  items: AnalysisRow[];
  total: number;
  page: number;
  page_size: number;
  threshold: number;
}

export interface AnalysisResultsQuery {
  page: number;
  pageSize: number;
  riskLevel?: RiskLevel;
  threshold?: number;
  requiresReview?: boolean;
  probabilityMin?: number;
  probabilityMax?: number;
  recordId?: string;
}

export interface ProbabilityBin {
  from: number;
  to: number;
  count: number;
}

export interface RiskDistribution {
  analysis_id: string;
  threshold: number;
  risk_counts: Record<RiskLevel, number>;
  probability_histogram: ProbabilityBin[];
}

export interface ReportDownload {
  blob: Blob;
  filename: string;
}
