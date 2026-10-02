import { useRef, useState } from "react";
import { TransactionDetails } from "../components/TransactionDetails";
import { TransactionAnalytics } from "../components/TransactionAnalytics";
import type { TransactionRow } from "../types/analysis";
import { getRiskLevelLabel } from "../utils/labels";
import { maskSensitiveValue } from "../utils/masking";

export function TransactionsPage({ analysisId, rows, total }: { analysisId?: string; rows: TransactionRow[]; total: number }) {
  const [selected, setSelected] = useState<TransactionRow | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const criticalCount = rows.filter((row) => row.risk_level === "critical").length;
  const highCount = rows.filter((row) => row.risk_level === "high").length;

  const closeDetails = () => {
    setSelected(null);
    window.requestAnimationFrame(() => selectedTrigger.current?.focus());
  };

  return (
    <div className="section-page transactions-page">
      <header className="section-page__intro transactions-page__intro">
        <div><p className="eyebrow">Транзакционный профиль</p><h1>Очередь проверки операций</h1><p>Начните с верхней строки: операции отсортированы по убыванию риска. Откройте досье, проверьте участников и зафиксируйте решение.</p></div>
        <div className="transactions-page__summary" aria-label="Сводка очереди">
          <span><strong>{total.toLocaleString("ru-RU")}</strong><small>всего операций</small></span>
          <span className="is-critical"><strong>{criticalCount.toLocaleString("ru-RU")}</strong><small>критических</small></span>
          <span className="is-high"><strong>{highCount.toLocaleString("ru-RU")}</strong><small>высокого риска</small></span>
        </div>
      </header>
      {!rows.length ? <div className="ui-state"><h2>Операции для проверки не найдены</h2><p>В источнике нет распознанных операций. Проверьте выбранные таблицы и план анализа.</p></div> : (
        <>
        <div className={`transaction-layout${selected ? " has-selection" : ""}`}>
          <section className="transaction-queue" aria-labelledby="transaction-queue-title">
            <div className="transaction-queue__heading"><div><p className="eyebrow">Рабочая очередь</p><h2 id="transaction-queue-title">Подозрительные операции — сначала</h2></div><span>{rows.length.toLocaleString("ru-RU")} показано</span></div>
            <div className="transaction-table-wrap"><table className="transaction-table"><caption className="sr-only">Операции по убыванию риска</caption><thead><tr><th>Операция</th><th>Клиент и направление</th><th>Сумма</th><th>Риск</th><th>Статус</th><th><span className="sr-only">Действие</span></th></tr></thead><tbody>
              {rows.map((row) => { const rawAmount = row.transaction_amount ?? row.amount; const isSelected = selected?.record_id === row.record_id; return <tr key={row.record_id} className={isSelected ? "is-selected" : undefined} aria-selected={isSelected}><td data-label="Операция"><strong>{row.transaction_id ?? row.record_id}</strong><small>{row.transaction_timestamp ?? "Время не определено"}</small></td><td data-label="Участники"><strong>{row.client_id ? maskSensitiveValue(row.client_id) : "Клиент не определён"}</strong><small>{row.sender_account_id && row.recipient_account_id ? `${maskSensitiveValue(row.sender_account_id)} → ${maskSensitiveValue(row.recipient_account_id)}` : "Связь счетов не определена"}</small></td><td data-label="Сумма"><strong className="transaction-table__amount">{typeof rawAmount === "number" ? rawAmount.toLocaleString("ru-RU") : "—"} {row.currency ?? ""}</strong></td><td data-label="Риск"><strong className="transaction-table__score">{(row.risk_probability * 100).toFixed(1)}%</strong><span className={`risk-badge risk-badge--${row.risk_level}`}>{getRiskLevelLabel(row.risk_level)}</span></td><td data-label="Статус"><span className={row.requires_review ? "review review--yes" : "review review--watch"}>{row.requires_review ? "Нужно решение" : "Наблюдение"}</span></td><td><button ref={isSelected ? selectedTrigger : undefined} type="button" aria-label={`Открыть досье ${row.transaction_id ?? row.record_id}`} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelected(row); }}>Открыть досье</button></td></tr>; })}
            </tbody></table></div>
          </section>
          {selected && <TransactionDetails row={selected} analysisId={analysisId} onClose={closeDetails} />}
        </div>
        <details className="transactions-analytics"><summary>Показать аналитику по текущей очереди</summary><TransactionAnalytics rows={rows} total={total} /></details>
        </>
      )}
    </div>
  );
}
