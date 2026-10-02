import { useEffect, useMemo, useState } from "react";
import { RelationshipAnalytics } from "../components/RelationshipAnalytics";
import { RelationshipDetails } from "../components/RelationshipDetails";
import { RelationshipGraph } from "../components/RelationshipGraph";
import type { RelationshipRow } from "../types/analysis";
import { maskSensitiveValue } from "../utils/masking";

const kindLabel = (kind: string) => kind === "transfer" ? "Перевод между счетами" : kind === "transaction_client" ? "Операция клиента" : "Связь объектов";

export function RelationshipsPage({ rows, total }: { rows: RelationshipRow[]; total: number }) {
  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.risk_signal_score - a.risk_signal_score), [rows]);
  const graphRows = useMemo(() => sortedRows.slice(0, 12), [sortedRows]);
  const [view, setView] = useState<"graph" | "table">("graph");
  const [selected, setSelected] = useState<RelationshipRow | null>(() => sortedRows[0] ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const nodesCount = new Set(rows.flatMap((row) => [row.from_id, row.to_id])).size;
  const strongCount = rows.filter((row) => row.risk_signal_score >= .8).length;
  const relatedRows = selectedNodeId ? sortedRows.filter((row) => row.from_id === selectedNodeId || row.to_id === selectedNodeId) : [];

  useEffect(() => {
    if (!selected && sortedRows[0]) setSelected(sortedRows[0]);
  }, [selected, sortedRows]);

  const selectRelationship = (row: RelationshipRow) => {
    setSelected(row);
    setSelectedNodeId(undefined);
  };
  const selectNode = (nodeId: string) => {
    const strongest = sortedRows.find((row) => row.from_id === nodeId || row.to_id === nodeId);
    setSelectedNodeId(nodeId);
    if (strongest) setSelected(strongest);
  };

  return (
    <div className="section-page relationships-page">
      <header className="section-page__intro relationships-page__intro"><div><p className="eyebrow">Контекст риска</p><h1>Карта связей и цепочек</h1><p>Найдите повторяющиеся счета, клиентов и операции. Выбор узла, линии или строки синхронно обновляет досье справа.</p></div><div className="relationships-page__summary" aria-label="Сводка связей"><span><strong>{total.toLocaleString("ru-RU")}</strong><small>всего связей</small></span><span><strong>{nodesCount.toLocaleString("ru-RU")}</strong><small>связанных объектов</small></span><span className="is-critical"><strong>{strongCount.toLocaleString("ru-RU")}</strong><small>сильных сигналов</small></span></div></header>
      <div className="relationships-toolbar"><div className="view-switch" role="tablist" aria-label="Представление связей"><button type="button" role="tab" aria-selected={view === "graph"} className={view === "graph" ? "is-active" : ""} onClick={() => setView("graph")}>Карта связей</button><button type="button" role="tab" aria-selected={view === "table"} className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>Таблица</button></div><p>Идентификаторы скрыты. Раскрывайте их только при необходимости проверки.</p></div>
      {!rows.length ? <div className="ui-state"><h2>Связи не найдены</h2><p>Для этой выборки система не обнаружила связей между клиентами, счетами и операциями.</p></div> : view === "graph" ? (
        <div className="relationship-workspace">
          <RelationshipGraph rows={graphRows} selectedRelationshipId={selected?.relationship_id} selectedNodeId={selectedNodeId} onSelectRelationship={selectRelationship} onSelectNode={selectNode} />
          <section className="relationship-priority" aria-labelledby="relationship-priority-title"><header><div><p className="eyebrow">Приоритет</p><h2 id="relationship-priority-title">Сильные связи</h2></div><span>{graphRows.length}</span></header><ul>{graphRows.map((row) => <li key={row.relationship_id} className={row.relationship_id === selected?.relationship_id ? "is-selected" : undefined}><button type="button" aria-pressed={row.relationship_id === selected?.relationship_id} aria-label={`Открыть связь ${row.relationship_id}`} onClick={() => selectRelationship(row)}><span><strong>{kindLabel(row.kind)}</strong><small>{maskSensitiveValue(row.from_id)} → {maskSensitiveValue(row.to_id)}</small></span><b>{(row.risk_signal_score * 100).toFixed(0)}%</b></button></li>)}</ul></section>
          {selected && <RelationshipDetails row={selected} selectedNodeId={selectedNodeId} relatedRows={relatedRows} />}
        </div>
      ) : (
        <div className={`relationship-table-layout${selected ? " has-selection" : ""}`}><div className="relationship-table-wrap"><table className="relationship-table"><caption className="sr-only">Табличное представление связей</caption><thead><tr><th>Тип связи</th><th>Откуда</th><th>Куда</th><th>Операция</th><th>Сила сигнала</th><th><span className="sr-only">Действие</span></th></tr></thead><tbody>{sortedRows.map((row) => <tr key={row.relationship_id} className={row.relationship_id === selected?.relationship_id ? "is-selected" : undefined} aria-selected={row.relationship_id === selected?.relationship_id}><td data-label="Тип связи">{kindLabel(row.kind)}</td><td data-label="Откуда">{maskSensitiveValue(row.from_id)}</td><td data-label="Куда">{maskSensitiveValue(row.to_id)}</td><td data-label="Операция">{row.transaction_id ?? "—"}</td><td data-label="Сила сигнала"><strong>{(row.risk_signal_score * 100).toFixed(1)}%</strong></td><td><button type="button" aria-label={`Открыть связь ${row.relationship_id}`} onClick={() => selectRelationship(row)}>Открыть досье</button></td></tr>)}</tbody></table></div>{selected && <RelationshipDetails row={selected} relatedRows={[]} />}</div>
      )}
      {rows.length > 0 && <details className="relationships-analytics"><summary>Показать аналитику по всем связям</summary><RelationshipAnalytics rows={rows} total={total} /></details>}
    </div>
  );
}
