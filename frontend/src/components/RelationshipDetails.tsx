import type { RelationshipRow } from "../types/analysis";
import { SensitiveValue } from "./SensitiveValue";

const kindLabel = (kind: string) => kind === "transfer" ? "Перевод между счетами" : kind === "transaction_client" ? "Операция связана с клиентом" : "Связь между объектами";
const typeLabel = (type: string) => type === "account" ? "Счёт" : type === "client" ? "Клиент" : type === "transaction" ? "Операция" : "Объект";
const interpretation = (row: RelationshipRow) => row.kind === "transfer"
  ? "Средства перемещались между указанными счетами. Проверьте назначение платежа, владельцев и соседние операции по времени."
  : row.kind === "transaction_client"
    ? "Операция отнесена к этому клиенту. Сопоставьте её с обычной активностью и подтверждающими документами."
    : "Система обнаружила общий контекст у двух объектов. Сверьте исходные записи перед выводом.";

export function RelationshipDetails({ row, selectedNodeId, relatedRows }: { row: RelationshipRow; selectedNodeId?: string; relatedRows: RelationshipRow[] }) {
  const strength = row.risk_signal_score >= .8 ? "Сильная связь — проверить в первую очередь" : row.risk_signal_score >= .5 ? "Заметная связь — проверить контекст" : "Дополнительная связь";
  return (
    <aside className="relationship-details" aria-labelledby="relationship-details-title">
      <header><div><p className="eyebrow">Досье связи</p><h2 id="relationship-details-title">{kindLabel(row.kind)}</h2><small>{row.relationship_id}</small></div><span className={row.risk_signal_score >= .8 ? "is-critical" : "is-attention"}>{strength}</span></header>
      <section className="relationship-details__score"><div><span>Сила сигнала</span><strong>{(row.risk_signal_score * 100).toFixed(1)}%</strong></div><span className="risk-track" role="progressbar" aria-label="Сила сигнала связи" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.risk_signal_score * 100}><span style={{ width: `${row.risk_signal_score * 100}%` }} /></span><p>Высокое значение означает приоритет проверки, но не доказывает мошенничество.</p></section>
      <section><p className="eyebrow">Участники</p><h3>Какие объекты связаны</h3><dl className="relationship-details__participants"><div className={selectedNodeId === row.from_id ? "is-selected" : undefined}><dt>{typeLabel(row.from_type)} — источник</dt><dd><SensitiveValue value={row.from_id} label="идентификатор источника" /></dd></div><div className={selectedNodeId === row.to_id ? "is-selected" : undefined}><dt>{typeLabel(row.to_type)} — получатель</dt><dd><SensitiveValue value={row.to_id} label="идентификатор получателя" /></dd></div></dl></section>
      <section><p className="eyebrow">Контекст</p><h3>Почему это важно</h3><p className="relationship-details__explanation">{interpretation(row)}</p><dl className="relationship-details__facts"><div><dt>Связанная операция</dt><dd>{row.transaction_id ?? "Не определена"}</dd></div><div><dt>Связей выбранного объекта</dt><dd>{selectedNodeId ? relatedRows.length.toLocaleString("ru-RU") : "Выберите узел на графе"}</dd></div></dl></section>
      {selectedNodeId && relatedRows.length > 1 && <section className="relationship-details__related"><p className="eyebrow">Повторные связи</p><h3>Соседние объекты</h3><ul>{relatedRows.slice(0, 5).map((relation) => { const neighbour = relation.from_id === selectedNodeId ? relation.to_id : relation.from_id; return <li key={relation.relationship_id}><SensitiveValue value={neighbour} label="идентификатор соседнего объекта" /><strong>{(relation.risk_signal_score * 100).toFixed(0)}%</strong></li>; })}</ul></section>}
      <section className="relationship-details__next"><p className="eyebrow">Следующий шаг</p><h3>Порядок проверки</h3><ol><li>Сопоставьте владельцев обоих объектов.</li><li>Проверьте связанную операцию и соседние события.</li><li>Зафиксируйте итог в досье клиента или операции.</li></ol></section>
    </aside>
  );
}
