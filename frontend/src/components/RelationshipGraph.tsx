import type { KeyboardEvent } from "react";
import type { RelationshipRow } from "../types/analysis";
import { maskSensitiveValue } from "../utils/masking";

interface GraphNode {
  id: string;
  type: string;
  degree: number;
  score: number;
  x: number;
  y: number;
}

const typeLabel = (type: string) => type === "account"
  ? "Счёт"
  : type === "client"
    ? "Клиент"
    : type === "transaction"
      ? "Операция"
      : "Объект";

const relationLabel = (row: RelationshipRow) => row.kind === "transfer"
  ? "перевод между счетами"
  : row.kind === "transaction_client"
    ? "операция клиента"
    : "связь объектов";

function activateOnKeyboard(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export function RelationshipGraph({ rows, selectedRelationshipId, selectedNodeId, onSelectRelationship, onSelectNode }: {
  rows: RelationshipRow[];
  selectedRelationshipId?: string;
  selectedNodeId?: string;
  onSelectRelationship: (row: RelationshipRow) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const nodeMap = new Map<string, Omit<GraphNode, "x" | "y">>();
  rows.forEach((row) => {
    const register = (id: string, type: string) => {
      const current = nodeMap.get(id);
      nodeMap.set(id, { id, type: current?.type ?? type, degree: (current?.degree ?? 0) + 1, score: Math.max(current?.score ?? 0, row.risk_signal_score) });
    };
    register(row.from_id, row.from_type);
    register(row.to_id, row.to_type);
  });
  const nodes: GraphNode[] = [...nodeMap.values()].slice(0, 10).map((node, index, all) => {
    if (all.length === 1) return { ...node, x: 400, y: 210 };
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / all.length);
    return { ...node, x: 400 + Math.cos(angle) * 280, y: 210 + Math.sin(angle) * 155 };
  });
  const visibleIds = new Set(nodes.map((node) => node.id));
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const visibleRows = rows.filter((row) => visibleIds.has(row.from_id) && visibleIds.has(row.to_id));

  return (
    <figure className="relationship-graph" aria-labelledby="relationship-graph-title" aria-describedby="relationship-graph-description">
      <figcaption><div><p className="eyebrow">Карта связей</p><h2 id="relationship-graph-title">Наиболее рискованные связи</h2></div><span>{visibleRows.length} связей · {nodes.length} объектов</span></figcaption>
      <p id="relationship-graph-description" className="sr-only">Размер узла показывает число связей, цвет — тип объекта, толщина линии — силу сигнала. Выберите узел или линию клавишей Enter либо Пробел, чтобы открыть соответствующее досье.</p>
      <div className="relationship-graph__legend" aria-label="Легенда графа"><span><i className="is-client" />Клиент</span><span><i className="is-account" />Счёт</span><span><i className="is-transaction" />Операция</span><span><b />Толще линия — сильнее сигнал</span><span><em />Крупнее узел — больше связей</span></div>
      <div className="relationship-graph__canvas">
        <svg viewBox="0 0 800 420" role="group" aria-label="Интерактивный граф связей">
          {visibleRows.map((row) => {
            const from = positions.get(row.from_id)!;
            const to = positions.get(row.to_id)!;
            const active = row.relationship_id === selectedRelationshipId;
            const connected = selectedNodeId === row.from_id || selectedNodeId === row.to_id;
            return <g key={row.relationship_id} className={`relationship-edge-line${active ? " is-selected" : ""}${connected ? " is-connected" : ""}`} role="button" tabIndex={0} aria-label={`Открыть связь: ${relationLabel(row)}, сила ${(row.risk_signal_score * 100).toFixed(0)} процентов`} onClick={() => onSelectRelationship(row)} onKeyDown={(event) => activateOnKeyboard(event, () => onSelectRelationship(row))}>
              <line className="relationship-edge-line__hit" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
              <line className="relationship-edge-line__visible" x1={from.x} y1={from.y} x2={to.x} y2={to.y} style={{ strokeWidth: 1.5 + row.risk_signal_score * 5 }} />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 7}>{(row.risk_signal_score * 100).toFixed(0)}%</text>
            </g>;
          })}
          {nodes.map((node) => {
            const radius = Math.min(34, 21 + node.degree * 3);
            const active = selectedNodeId === node.id;
            const related = selectedRelationshipId && visibleRows.some((row) => row.relationship_id === selectedRelationshipId && (row.from_id === node.id || row.to_id === node.id));
            return <g key={node.id} className={`relationship-graph-node relationship-graph-node--${node.type}${active ? " is-selected" : ""}${related ? " is-related" : ""}`} role="button" tabIndex={0} aria-label={`Выбрать объект ${typeLabel(node.type)} ${maskSensitiveValue(node.id)}, связей ${node.degree}`} onClick={() => onSelectNode(node.id)} onKeyDown={(event) => activateOnKeyboard(event, () => onSelectNode(node.id))}>
              <circle cx={node.x} cy={node.y} r={radius} />
              <text className="relationship-graph-node__type" x={node.x} y={node.y - 4}>{typeLabel(node.type)}</text>
              <text className="relationship-graph-node__id" x={node.x} y={node.y + 10}>{maskSensitiveValue(node.id).slice(0, 15)}</text>
            </g>;
          })}
        </svg>
      </div>
      <p className="relationship-graph__insight">Выберите крупный узел или самую толстую линию. Справа синхронно откроется связь, которую следует проверить первой.</p>
    </figure>
  );
}
