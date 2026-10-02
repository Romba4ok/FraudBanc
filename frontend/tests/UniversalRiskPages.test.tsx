import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TransactionsPage } from "../src/routes/TransactionsPage";
import { RelationshipsPage } from "../src/routes/RelationshipsPage";
import type { RelationshipRow, TransactionRow } from "../src/types/analysis";

const transaction = (id: string, risk: number): TransactionRow => ({
  record_id: id,
  transaction_id: id,
  client_id: "client-7",
  sender_account_id: "account-a",
  recipient_account_id: "account-b",
  transaction_amount: 125000,
  currency: "KZT",
  transaction_timestamp: "2026-09-28T10:00:00Z",
  risk_probability: risk,
  risk_level: risk > .9 ? "critical" : "high",
  requires_review: true,
  explanation_factors: [],
  analysis_warnings: [],
  rule_explanation: JSON.stringify([{
    code: "dormant_account",
    label: "Операция по счёту без активности в доступной истории",
    strength: 1,
    evidence: { history_span_days: 97, prior_operations: 0 },
    engine_version: "1.0",
  }]),
});

const relationships: RelationshipRow[] = [{
  relationship_id: "rel-1",
  kind: "transfer",
  from_type: "account",
  from_id: "account-a",
  to_type: "account",
  to_id: "account-b",
  transaction_id: "txn-1",
  risk_signal_score: .97,
}, {
  relationship_id: "rel-2",
  kind: "transaction_client",
  from_type: "account",
  from_id: "account-b",
  to_type: "client",
  to_id: "client-7",
  transaction_id: "txn-1",
  risk_signal_score: .76,
}];

afterEach(cleanup);

describe("universal risk pages", () => {
  it("shows a suspicious operation and opens its human-readable card", async () => {
    const user = userEvent.setup();
    render(<TransactionsPage rows={[transaction("txn-1", .97), transaction("txn-2", .82)]} total={2} />);
    const table = screen.getByRole("table", { name: "Операции по убыванию риска" });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("txn-1");
    await user.click(within(table).getAllByRole("button", { name: /Открыть досье/ })[0]);
    const card = screen.getByRole("complementary", { name: "txn-1" });
    expect(card).toHaveTextContent("Операция по счёту без активности в доступной истории");
    expect(card).toHaveTextContent("История: 97 дней");
    expect(card).toHaveTextContent("Предыдущих операций: 0");
    expect(card).toHaveTextContent("Сильный фактор");
    expect(card).toHaveTextContent("Клиент, счета и контрагент");
    expect(card).toHaveTextContent("Что проверить по порядку");
    expect(card).not.toHaveTextContent("dormant_account");
    expect(card).not.toHaveTextContent("engine_version");
  });

  it("synchronizes an accessible graph, priority list, dossier and table", async () => {
    const user = userEvent.setup();
    render(<RelationshipsPage rows={relationships} total={2} />);
    expect(screen.getByText("Наиболее рискованные связи")).toBeInTheDocument();
    expect(screen.getByLabelText("Легенда графа")).toHaveTextContent("Толще линия — сильнее сигнал");
    const sharedAccount = screen.getByRole("button", { name: /Выбрать объект Счёт .*nt-b/ });
    sharedAccount.focus();
    await user.keyboard("{Enter}");
    const dossier = screen.getByRole("complementary", { name: "Перевод между счетами" });
    expect(dossier).toHaveTextContent("Связей выбранного объекта2");
    expect(screen.getByRole("button", { name: "Открыть связь rel-1" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("tab", { name: "Таблица" }));
    const table = screen.getByRole("table", { name: "Табличное представление связей" });
    expect(table).toHaveTextContent("Перевод между счетами");
    expect(within(table).getAllByRole("button", { name: /Открыть связь/ })).toHaveLength(2);
  });
});
