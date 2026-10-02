import { useId } from "react";
import type { TransactionRow } from "../types/analysis";
import { getRiskLevelLabel } from "../utils/labels";
import { getTransactionSignalPresentations } from "../utils/transactionExplanations";
import { InvestigationPanel } from "./InvestigationPanel";
import { SensitiveValue } from "./SensitiveValue";
import { CloseIcon } from "./ui/icons";

const value = (input: unknown) => input === undefined || input === null || input === "" ? "Не определено" : String(input);
const amount = (row: TransactionRow) => {
  const raw = row.transaction_amount ?? row.amount;
  return typeof raw === "number" ? `${raw.toLocaleString("ru-RU")} ${row.currency ?? ""}`.trim() : "Не определена";
};

export function TransactionDetails({ row, analysisId, onClose }: { row: TransactionRow; analysisId?: string; onClose: () => void }) {
  const titleId = useId();
  const signals = getTransactionSignalPresentations(
    row.rule_explanation,
    row.graph_explanation,
    row.ml_explanation,
  );
  const counterparty = [row.counterparty_id, row.merchant_id, row.recipient_id].find((item): item is string => typeof item === "string" && item.length > 0);
  const operationTime = row.transaction_timestamp
    ? new Date(row.transaction_timestamp).toLocaleString("ru-RU")
    : "Время не определено";
  return (
    <aside className="transaction-details" aria-labelledby={titleId}>
      <header className="transaction-details__heading"><div><p className="eyebrow">Досье операции</p><h2 id={titleId}>{row.transaction_id ?? row.record_id}</h2><small>{operationTime}</small></div><button aria-label="Закрыть досье операции" type="button" onClick={onClose}><CloseIcon /></button></header>
      <div className="transaction-details__risk">
        <div><span>Оценка риска</span><strong>{(row.risk_probability * 100).toFixed(1)}%</strong></div>
        <span className={`risk-badge risk-badge--${row.risk_level}`}>{getRiskLevelLabel(row.risk_level)} риск</span>
        <span className="risk-track" role="progressbar" aria-label="Вероятность риска" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.risk_probability * 100}><span style={{ width: `${row.risk_probability * 100}%` }} /></span>
      </div>
      <section className="transaction-details__section"><div className="transaction-details__section-heading"><span>Параметры</span><h3>Что произошло</h3></div><dl className="transaction-details__facts">
        <div><dt>Сумма операции</dt><dd>{amount(row)}</dd></div>
        <div><dt>Канал проведения</dt><dd>{value(row.channel)}</dd></div>
        <div><dt>Направление</dt><dd>{value(row.direction)}</dd></div>
        <div><dt>Дата и время</dt><dd>{operationTime}</dd></div>
      </dl></section>
      <section className="transaction-details__section transaction-entities"><div className="transaction-details__section-heading"><span>Связанные участники</span><h3>Клиент, счета и контрагент</h3></div><dl>
        <div><dt>Клиент</dt><dd><SensitiveValue value={row.client_id} label="ID клиента" /></dd></div>
        <div><dt>Счёт отправителя</dt><dd><SensitiveValue value={row.sender_account_id} label="счёт отправителя" /></dd></div>
        <div><dt>Счёт получателя</dt><dd><SensitiveValue value={row.recipient_account_id} label="счёт получателя" /></dd></div>
        <div><dt>Контрагент</dt><dd>{counterparty ? <SensitiveValue value={counterparty} label="ID контрагента" /> : <span>Не определён в источнике</span>}</dd></div>
      </dl></section>
      <section className="transaction-signals">
        <div className="transaction-details__section-heading"><span>Основания сигнала</span><h3>Почему операция отмечена</h3></div>
        {signals.length ? (
          <ul>
            {signals.map((signal, index) => (
              <li key={`${index}-${signal.title}`}>
                <div className="transaction-signal__heading">
                  <strong>{signal.title}</strong>
                  <span className={`transaction-signal__impact transaction-signal__impact--${signal.impact === "Сильный фактор" ? "strong" : signal.impact === "Средний фактор" ? "medium" : "additional"}`}>
                    {signal.impact}
                  </span>
                </div>
                <p>{signal.description}</p>
                {signal.metrics.length > 0 && (
                  <div className="transaction-signal__metrics">
                    {signal.metrics.map((metric) => <span key={metric}>{metric}</span>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p>Отдельные причины не переданы. Ориентируйтесь на итоговый уровень риска и данные операции.</p>}
      </section>
      <p className="transaction-details__note">Сигнал определяет приоритет проверки, но сам по себе не доказывает мошенничество.</p>
      <section className="transaction-evidence"><div className="transaction-details__section-heading"><span>Доказательная линия</span><h3>Что проверить по порядку</h3></div><ol><li><span /><div><strong>Операция зафиксирована</strong><small>{operationTime} · {amount(row)}</small></div></li>{signals.slice(0, 4).map((signal, index) => <li key={`${signal.title}-${index}`}><span /><div><strong>{signal.title}</strong><small>{signal.description}</small></div></li>)}</ol></section>
      {analysisId && <InvestigationPanel analysisId={analysisId} entityId={row.record_id} />}
    </aside>
  );
}
