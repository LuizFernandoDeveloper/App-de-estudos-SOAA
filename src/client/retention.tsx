import { useMemo, useState } from "react";
import { BrainCircuit, Layers, ShieldAlert, TrendingDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { RetentionOverview, RetentionSeriesInfo } from "../shared/types";

type ViewMode = "average" | "all" | "isolated";

const RET_TOOLTIP = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff", fontSize: 12 };
const RET_ALERT = "#ff5a71";

function RetentionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string | number; value?: number | string | Array<string | number>; color?: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={RET_TOOLTIP}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#9aabc0" }}>Dia {label}</div>
      {payload.map((entry, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: entry.color }} />
          <span style={{ whiteSpace: "nowrap" }}>{entry.name}</span>
          <strong style={{ marginLeft: "auto", paddingLeft: 16 }}>{typeof entry.value === "number" ? `${entry.value.toFixed(1)}%` : `${entry.value}%`}</strong>
        </div>
      ))}
    </div>
  );
}

const MODES: Array<{ value: ViewMode; label: string; icon: typeof Layers }> = [
  { value: "average", label: "Média geral", icon: BrainCircuit },
  { value: "all", label: "Todas as matérias", icon: Layers },
  { value: "isolated", label: "Drill-down", icon: TrendingDown }
];

export function RetentionGraphBoard({ overview, demo }: { overview: RetentionOverview | null; demo: boolean }) {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const globalSeries = useMemo(() => overview?.series.find((s) => s.level === "global") ?? null, [overview]);
  const subjectSeries = useMemo(() => overview?.series.filter((s) => s.level === "subject") ?? [], [overview]);
  const topicSeries = useMemo(() => overview?.series.filter((s) => s.level === "topic") ?? [], [overview]);

  const subjectsAvailable = useMemo(
    () => [...subjectSeries].sort((a, b) => a.retrievabilityToday - b.retrievabilityToday),
    [subjectSeries]
  );
  const topicsAvailable = useMemo(
    () => topicSeries.filter((s) => s.subjectId === selectedSubjectId).sort((a, b) => a.retrievabilityToday - b.retrievabilityToday),
    [topicSeries, selectedSubjectId]
  );

  const effectiveSeries: RetentionSeriesInfo[] = useMemo(() => {
    if (!overview?.rows.length) return [];
    if (viewMode === "average") return globalSeries ? [globalSeries] : [];
    if (viewMode === "all") return subjectSeries;
    const subject = subjectSeries.find((s) => s.subjectId === selectedSubjectId);
    if (!subject) return [];
    if (selectedTopicId) {
      const topic = topicSeries.find((s) => s.topicId === selectedTopicId && s.subjectId === selectedSubjectId);
      return topic ? [subject, topic] : [subject];
    }
    return [subject, ...topicSeries.filter((s) => s.subjectId === selectedSubjectId)];
  }, [viewMode, overview, globalSeries, subjectSeries, topicSeries, selectedSubjectId, selectedTopicId]);

  const critical = useMemo(() => {
    const candidates = (overview?.series ?? []).filter((s) => s.items > 0);
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => a.retrievabilityToday - b.retrievabilityToday)[0];
  }, [overview]);

  const renderLines = () =>
    effectiveSeries.map((s) => {
      const emphasized = viewMode === "isolated" && selectedTopicId !== null && s.topicId === selectedTopicId;
      const contextLine = viewMode === "isolated" && selectedTopicId !== null && s.level === "subject";
      return (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stroke={s.color}
          strokeWidth={s.level === "global" || emphasized ? 3 : 2}
          strokeDasharray={contextLine ? "4 4" : undefined}
          dot={false}
          activeDot={{ r: 4 }}
        />
      );
    });

  if (!overview || !overview.series.length || !overview.rows.length) {
    return (
      <section className="cogn-span-full retention-board">
        <div className="panel-header"><h3><Layers size={16} /> Retenção por Matéria e Nicho</h3></div>
        <p className="cogn-empty">Cadastre itens de memória em {demo ? "diferentes matérias e nichos" : "diferentes matérias e nichos (use o formulário do gráfico de decaimento, com o campo 'Nicho')"} para ver a degradação da memória em nível macro (matéria) e micro (nicho).</p>
      </section>
    );
  }

  const subjectSelect = subjectsAvailable.find((s) => s.subjectId === selectedSubjectId) ?? null;

  return (
    <section className="cogn-span-full retention-board">
      <div className="panel-header">
        <h3><Layers size={16} /> Retenção por Matéria e Nicho</h3>
        {critical && (critical.retrievabilityToday < 80 ? (
          <span className="retention-alert danger"><ShieldAlert size={13} /> {critical.level === "topic" ? "Nicho em colapso" : "Matéria sob risco"}: {critical.name} · R atual {critical.retrievabilityToday.toFixed(1)}%</span>
        ) : (
          <span className="retention-alert ok">Rede semântica estável · R global {globalSeries?.retrievabilityToday.toFixed(1)}%</span>
        ))}
      </div>

      <div className="retention-filters">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={viewMode === value ? "retention-seg active" : "retention-seg"}
            onClick={() => { setViewMode(value); if (value !== "isolated") { setSelectedSubjectId(null); setSelectedTopicId(null); } }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}

        {viewMode === "isolated" && (() => {
          const handleSubject = (id: number | null) => {
            setSelectedSubjectId(id);
            setSelectedTopicId(null);
          };
          return (
            <div className="retention-cascade">
              <select value={subjectSelect?.subjectId ?? ""} onChange={(event) => handleSubject(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Selecionar matéria…</option>
                {subjectsAvailable.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.name}</option>)}
              </select>
              <select value={selectedTopicId ?? ""} disabled={!subjectSelect} onChange={(event) => setSelectedTopicId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Todos os nichos</option>
                {topicsAvailable.map((s) => <option key={s.topicId} value={s.topicId}>{s.name.split(" › ").slice(1).join(" › ")}</option>)}
              </select>
            </div>
          );
        })()}

        <div className="retention-stat">
          <span>{viewMode === "average" ? "R global" : viewMode === "all" ? `${subjectSeries.length} matérias` : `Nicho:`}</span>
          <b>{viewMode === "average" ? `${globalSeries?.retrievabilityToday.toFixed(1)}%` : viewMode === "all" ? `${subjectSeries.reduce((sum, s) => sum + s.items, 0)} itens` : subjectSelect ? (selectedTopicId ? topicsAvailable.find((t) => t.topicId === selectedTopicId)?.retrievabilityToday.toFixed(1) + "%" : subjectSelect.retrievabilityToday.toFixed(1) + "%") : "—"}</b>
        </div>
      </div>

      <div className="chart" style={{ height: 300 }}>
        {effectiveSeries.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overview.rows} margin={{ top: 12, right: 14, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
              <XAxis dataKey="day" type="number" domain={[0, overview.horizonDays]} tickFormatter={(day: number) => `D${day}`} tick={{ fill: "#9aabc0", fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
              <Tooltip content={<RetentionTooltip />} contentStyle={RET_TOOLTIP} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
              <ReferenceLine y={90} stroke={RET_ALERT} strokeDasharray="6 3" label={{ value: "Alerta · revisar a 90%", position: "insideTopLeft", fill: RET_ALERT, fontSize: 10 }} />
              {renderLines()}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="cogn-empty">{viewMode === "isolated" ? "Selecione uma matéria acima para fazer o drill-down até o nicho em colapso." : "Sem séries para exibir."}</p>
        )}
      </div>

      <div className="retention-legend">
        {effectiveSeries.map((s) => (
          <span key={s.key} className="retention-legend-item">
            <span style={{ background: s.color }} />
            {s.level === "topic" ? s.name.split(" › ")[1] : s.level === "global" ? "Média geral" : s.name}
            <small>{s.items} {s.items === 1 ? "item" : "itens"} · S {s.avgStability}d · R {s.retrievabilityToday.toFixed(1)}%</small>
          </span>
        ))}
      </div>

      <p className="cogn-footnote"><em>Curva de Ebbinghaus hierárquica + FSRS:</em> a média global pode parecer estável enquanto um nicho específico entra em colapso — a memória não decai homogênea, ela decai por rede semântica. Monitore o nível micro (matéria › nicho) para intervir cirurgicamente antes do esquecimento total; revisar exatamente no ponto em que R cruza os 90% reestabelece a retenção a 100% e aumenta o Stability (S).</p>
    </section>
  );
}