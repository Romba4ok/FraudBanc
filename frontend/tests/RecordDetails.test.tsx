import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordDetails } from "../src/components/RecordDetails";
import type { AnalysisRow, TransactionRow } from "../src/types/analysis";

afterEach(cleanup);

const row: AnalysisRow = {
  record_id: "client-very-long-id-001",
  risk_probability: .731,
  risk_level: "high",
  requires_review: true,
  explanation_factors: [
    { feature: "UNKNOWN_MODEL_FEATURE", value: "X", contribution: -.1234, direction: "decreases_risk" },
  ],
  analysis_warnings: [],
  AGE: 38,
};

const relatedTransaction: TransactionRow = {
  record_id: "operation-001",
  transaction_id: "payment-001",
  transaction_timestamp: "2026-10-01 14:30",
  risk_probability: .91,
  risk_level: "critical",
  requires_review: true,
  explanation_factors: [],
  analysis_warnings: [],
};

describe("RecordDetails", () => {
  it("copies the full id and keeps neutral labels for unknown factors", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<RecordDetails row={row} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Копировать ID" }));
    expect(writeText).toHaveBeenCalledWith("client-very-long-id-001");
    expect(screen.getByRole("button", { name: "Скопировано" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Факторы риска" }));
    expect(screen.getByText("Технический признак")).toBeInTheDocument();
    expect(screen.queryByText("UNKNOWN_MODEL_FEATURE")).not.toBeInTheDocument();
    expect(screen.getByText("Снижает риск")).toBeInTheDocument();
    expect(screen.getByText(/Влияние на риск/)).toBeInTheDocument();
    expect(screen.getByText("-0,1234")).toBeInTheDocument();
  });

  it("shows a calm empty state when a row has no warnings", async () => {
    const user = userEvent.setup();
    render(<RecordDetails row={row} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Предупреждения" }));
    expect(screen.getByText("Для этой записи отдельных предупреждений нет.")).toBeInTheDocument();
  });

  it("shows a human-readable evidence timeline for related operations", async () => {
    const user = userEvent.setup();
    render(<RecordDetails row={row} relatedTransactions={[relatedTransaction]} onClose={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Связанные операции" }));
    expect(screen.getByText("Модель сформировала сигнал")).toBeInTheDocument();
    expect(screen.getByText("payment-001")).toBeInTheDocument();
    expect(screen.getByText("Риск операции 91.0%")).toBeInTheDocument();
  });
});
