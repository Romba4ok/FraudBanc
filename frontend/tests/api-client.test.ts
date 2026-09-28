import { afterEach, describe, expect, it, vi } from "vitest";

import { getAnalysisSummary } from "../src/api/client";

const jsonResponse = (payload: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => payload,
  } as Response);

describe("analysis summary compatibility", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes an older universal summary before the dashboard renders", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse({
        analysis_id: "analysis-1",
        model_version: "universal-1.0",
        threshold: 0.5,
        summary: { rows: 4, requires_review: 2 },
        metrics: { available: true },
      }))
      .mockImplementationOnce(() => jsonResponse({
        analysis_id: "analysis-1",
        threshold: 0.5,
        risk_counts: { low: 1, medium: 1, high: 1, critical: 1 },
        probability_histogram: [],
      }))
      .mockImplementationOnce(() => jsonResponse({
        warnings: ["Обнаружено новое поле"],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = await getAnalysisSummary("analysis-1");

    expect(summary.summary.risk_counts.critical).toBe(1);
    expect(summary.summary.warnings).toEqual(["Обнаружено новое поле"]);
    expect(summary.summary.target_present).toBe(true);
    expect(summary.summary.target_valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
