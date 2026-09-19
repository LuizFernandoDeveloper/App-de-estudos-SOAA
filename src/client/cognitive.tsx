import { Fragment, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  Flame,
  Gauge,
  ShieldAlert,
  Target,
  TrendingUp
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import type { FocusOverloadPoint, MemoryDecayProjection, MemoryItemInput, MemoryPoint, ReviewGrade, ScheduleResponse, SpacedRepetitionItem, Subject, SubjectAccuracyPoint, Topic } from "../shared/types";

const HEX: Record<string, string> = {
  indigo: "#818cf8", violet: "#a78bfa", cyan: "#22d3ee", pink: "#f472b6",
  amber: "#fbbf24", emerald: "#34d399", orange: "#fb923c", blue: "#60a5fa"
};
const colorOf = (name: string) => HEX[name] ?? HEX.blue;
const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const COG_TOOLTIP = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff", fontSize: 12 };

/* ---------------------------------------------------------------- */
/* 1. Decaimento e Retenção (Modelo FSRS)                            */
/* ---------------------------------------------------------------- */

type RetentionConcept = { name: string; stability: number; color: string };

const retentionConcepts: RetentionConcept[] = [
  { name: "Logaritmos", stability: 48, color: "#818cf8" },
  { name: "Eletrostática", stability: 14, color: "#a78bfa" },
  { name: "Dissertação (estrutura)", stability: 90, color: "#22d3ee" },
  { name: "Oxirredução", stability: 26, color: "#f472b6" }
];

const daysToCross90 = (stability: number) => Math.round(-stability * Math.log(0.9) * 10) / 10;

const retentionData = Array.from({ length: 30 }, (_, idx) => {
  const day = idx + 1;
  const row: Record<string, number> = { day };
  for (const concept of retentionConcepts) {
    row[concept.name] = Math.round(Math.exp(-day / concept.stability) * 1000) / 10;
  }
  return row;
});

function RetentionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const name = String(payload[0].dataKey);
  const stability = retentionConcepts.find((c) => c.name === name)?.stability ?? 0;
  return (
    <div className="chart-tooltip">
      <strong>Dia {label}</strong>
      <span>{name}: <b>{payload[0].value}%</b> de recuperação</span>
      <small>Stability ≈ {stability} dias<br />Cruza 90% no dia {daysToCross90(stability)}</small>
    </div>
  );
}

function RetentionDecayChart() {
  return (
    <section className="card chart-card cogn-span-7">
      <div className="section-heading"><div><p className="eyebrow">Modelo FSRS · memória de longo prazo</p><h2>Decaimento e retenção</h2></div><BrainCircuit size={20} /></div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={retentionData} margin={{ top: 6, right: 14, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
            <XAxis dataKey="day" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <Tooltip content={<RetentionTooltip />} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            {retentionConcepts.map((c) => <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="cogn-footnote">Curvas de retrievability simuladas. Quanto maior a <em>Stability</em>, mais devagar a memória decai e mais espaçado pode ser o próximo lembrete.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 2. Dispersão de Fadiga (Resistência × Precisão × Interrupções)    */
/* ---------------------------------------------------------------- */

type FatiguePoint = { minute: number; accuracy: number; interruptions: number };
type FatigueSession = { id: string; name: string; color: string; points: FatiguePoint[] };

const fatigueSessions: FatigueSession[] = [
  { id: "math", name: "Matemática · resolução", color: "#60a5fa", points: [
    { minute: 15, accuracy: 92, interruptions: 0 }, { minute: 30, accuracy: 88, interruptions: 1 },
    { minute: 45, accuracy: 90, interruptions: 1 }, { minute: 60, accuracy: 74, interruptions: 3 },
    { minute: 75, accuracy: 61, interruptions: 4 }, { minute: 90, accuracy: 52, interruptions: 6 }
  ]},
  { id: "fis", name: "Física · eletromagnetismo", color: "#a78bfa", points: [
    { minute: 15, accuracy: 88, interruptions: 1 }, { minute: 30, accuracy: 85, interruptions: 2 },
    { minute: 45, accuracy: 80, interruptions: 2 }, { minute: 60, accuracy: 71, interruptions: 4 },
    { minute: 75, accuracy: 66, interruptions: 5 }, { minute: 90, accuracy: 55, interruptions: 7 }
  ]}
];

function FatigueTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: FatiguePoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point) return null;
  return (
    <div className="chart-tooltip">
      <strong>{point.minute}′ de foco</strong>
      <span>Acerto: <b>{point.accuracy}%</b></span>
      <span>Interrupções: <b>{point.interruptions}</b></span>
    </div>
  );
}

function FatigueScatterChart() {
  const analyzed = fatigueSessions.map((session) => {
    const early = session.points.filter((p) => p.minute <= 45);
    const late = session.points.filter((p) => p.minute >= 60);
    const drop = avg(early.map((p) => p.accuracy)) - avg(late.map((p) => p.accuracy));
    const interruptRise = avg(late.map((p) => p.interruptions)) - avg(early.map((p) => p.interruptions));
    return { ...session, drop, interruptRise };
  }).sort((a, b) => b.drop - a.drop)[0];

  const breached = analyzed.drop >= 15;

  return (
    <section className="card chart-card cogn-span-5">
      <div className="section-heading"><div><p className="eyebrow">Resistência atencional</p><h2>Fadiga dentro do bloco</h2></div><Gauge size={20} /></div>
      {breached && <div className="cog-alert danger"><ShieldAlert size={16} /><div><strong>Atenção: bloco excedeu a Zona de Desenvolvimento Proximal.</strong><span>Sugestão de regressão tática do timebox — {analyzed.name} caiu <b>{Math.round(analyzed.drop)}%</b> após os 45′ com <b>+{Math.round(analyzed.interruptRise)}</b> interrupções.</span></div></div>}
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 14, left: -16, bottom: 6 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
            <XAxis type="number" dataKey="minute" domain={[0, 100]} tick={{ fill: "#9aabc0", fontSize: 11 }} label={{ value: "minuto no bloco", position: "insideBottom", offset: -2, fill: "#8da0b8", fontSize: 10 }} />
            <YAxis type="number" dataKey="accuracy" domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <ZAxis type="number" dataKey="interruptions" range={[50, 460]} />
            <Tooltip content={<FatigueTooltip />} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            {fatigueSessions.map((s) => <Scatter key={s.id} name={s.name} data={s.points} fill={s.color} fillOpacity={0.8} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="cogn-footnote">Bubble = número de interrupções involuntárias. Queda da precisão aliada a mais interrupções indica fim bloco da capacidade do bloco.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 3. Heatmap Biocircadiano                                          */
/* ---------------------------------------------------------------- */

const heatHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const heatDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const circadianProfile = (hour: number) => ({
  efficiency: hour <= 8 ? 0.6 : hour <= 10 ? 0.78 : hour <= 12 ? 0.95 : hour <= 14 ? 0.5 : hour <= 16 ? 0.72 : hour <= 18 ? 0.62 : hour <= 20 ? 0.42 : 0.22,
  slot: hour <= 8 ? "Luz da manhã" : hour <= 10 ? "Subida de dopamina" : hour <= 12 ? "Pico de cognição" : hour <= 14 ? "Dip pós-almoço" : hour <= 16 ? "Recuperação" : hour <= 18 ? "Retrospecto" : hour <= 20 ? "Transição" : "Descida"
});

const heatMatrix: number[][] = heatHours.map((hour, hIndex) => heatDays.map((_, dayIndex) => {
  const circadian = circadianProfile(hour).efficiency;
  const accuracy = hour <= 10 ? 0.86 : hour <= 14 ? 0.58 : hour <= 18 ? 0.7 : 0.44;
  const dayTone = 1 - dayIndex * 0.05;
  return clamp(Math.round((circadian * 0.64 + accuracy * 0.36) * dayTone * 100) / 100, 0, 1);
}));

function hottestWindow() {
  let best = { value: -1, from: 6, to: 8, day: "Seg" };
  for (let h = 0; h < heatHours.length - 1; h++) {
    for (let d = 0; d < heatDays.length; d++) {
      const value = heatMatrix[h][d] + heatMatrix[h + 1][d];
      if (value > best.value) {
        best = { value, from: heatHours[h], to: heatHours[h + 1], day: heatDays[d] };
      }
    }
  }
  return best;
}

function heatColor(intensity: number) {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [10, 20, 40]], [0.45, [58, 46, 150]], [0.75, [215, 92, 158]], [1, [255, 90, 111]]
  ];
  const i = clamp(intensity, 0, 1);
  let lower = stops[0]; let upper = stops[stops.length - 1];
  for (let idx = 0; idx < stops.length - 1; idx++) {
    if (i >= stops[idx][0] && i <= stops[idx + 1][0]) { lower = stops[idx]; upper = stops[idx + 1]; break; }
  }
  const span = Math.max(upper[0] - lower[0], 0.0001);
  const t = (i - lower[0]) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const [lr, lg, lb] = lower[1]; const [ur, ug, ub] = upper[1];
  return `rgb(${mix(lr, ur)}, ${mix(lg, ug)}, ${mix(lb, ub)})`;
}

const REPOUSE = new Set([8, 10, 12, 14, 16, 18, 20]);

function CircadianHeatmap() {
  const peak = hottestWindow();
  return (
    <section className="card chart-card cogn-span-7">
      <div className="section-heading"><div><p className="eyebrow">Relógio biológico · protocolo Huberman</p><h2>Ritmo por dia e horário</h2></div><CalendarClock size={20} /></div>
      <div className="cog-badge hot"><Flame size={14} /> Pico de cognição validado: {peak.from}:00 – {peak.to}:00 · {peak.day} (≈ 2–4h após despertar)</div>
      <div className="circadian-guide" role="list" aria-label="Janelas do dia recomendadas">
        {heatHours.map((hour) => { const { slot, efficiency } = circadianProfile(hour); const tooShort = !REPOUSE.has(hour); if (tooShort) return <span key={hour} />; return <span key={hour} style={{ flex: efficiency }}><i style={{ background: heatColor(efficiency * 0.85) }} />{slot}</span>; })}
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap-grid" role="img" aria-label="Matriz de desempenho por dia e horário">
          {heatHours.map((hour, hIndex) => (
            <Fragment key={hour}>
              <span className="heatmap-time">{hour}h</span>
              {heatDays.map((day, dIndex) => {
                const value = heatMatrix[hIndex][dIndex];
                const hot = hIndex < heatHours.length - 1 && value + (heatMatrix[hIndex + 1][dIndex] ?? 0) === peak.value;
                return <div key={day} className={`heatmap-cell ${hot ? "hot" : ""}`} style={{ background: hot ? "repeating-linear-gradient(45deg, #ffd9dd, #ffd9dd 3px, #ff5a71 3px, #ff5a71 6px)" : heatColor(value) }} title={`${day} · ${hour}:00 — ${circadianProfile(hour).slot} · intensidade ${(value * 100).toFixed(0)}%`} />;
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="heatmap-legend"><span>baixa eficiência</span><div className="heatmap-scale">{[0, 0.45, 0.75, 1].map((v) => <i key={v} style={{ background: heatColor(v) }} />)}</div><span>pico de acerto</span></div>
      <p className="cogn-footnote"><em>Aos 10–12h</em> (pico de dopamina após a luz da manhã) destine blocos analíticos difíceis; use o <em>dip pós-almoço</em> para repetição espaçada apoiada em questões e a <em>descida noturna</em> (após 20h) só para revisão leve e sono regulado em horários estáveis.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 4. Radar de Proficiência × Dificuldade                            */
/* ---------------------------------------------------------------- */

function ProficiencyRadar({ subjects }: { subjects: Subject[] }) {
  const data = subjects.map((s) => ({ subject: s.name.split("·")[0].trim(), difficulty: s.difficulty, weight: s.weight }));
  const bottlenecks = subjects.filter((s) => s.difficulty > s.weight);
  return (
    <section className="card chart-card cogn-span-5">
      <div className="section-heading"><div><p className="eyebrow">Esforço × importância no edital</p><h2>Radar de proficiência</h2></div><Target size={20} /></div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#243650" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#9aabc0", fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 5]} angle={90} tick={{ fill: "#7e8fa5", fontSize: 9 }} />
            <Radar name="Dificuldade pessoal" dataKey="difficulty" stroke="#f472b6" fill="#f472b6" fillOpacity={0.32} />
            <Radar name="Peso estratégico" dataKey="weight" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.28} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            <Tooltip contentStyle={COG_TOOLTIP} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="cogn-footnote">{bottlenecks.length ? <>Gargalos: <strong className="cog-emphasis">{bottlenecks.map((s) => s.name.split("·")[0].trim()).join(", ")}</strong> — esforço acima do peso real no edital.</> : "Esforço atual está proporcional ao peso das matérias no edital."}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 5. Conformidade de Timeboxing (Planejado × Executado)             */
/* ---------------------------------------------------------------- */

type ComplianceRow = { name: string; short: string; planned: number; executed: number; color: string };

const complianceMock: ComplianceRow[] = [
  { name: "Matemática · ITA/IME", short: "Matemática", planned: 95, executed: 118, color: "#818cf8" },
  { name: "Física", short: "Física", planned: 75, executed: 62, color: "#a78bfa" },
  { name: "Química", short: "Química", planned: 60, executed: 74, color: "#22d3ee" },
  { name: "Português", short: "Português", planned: 45, executed: 38, color: "#f472b6" },
  { name: "Biologia", short: "Biologia", planned: 35, executed: 40, color: "#34d399" },
  { name: "Inglês", short: "Inglês", planned: 25, executed: 22, color: "#fbbf24" }
];

function TimeboxCompliance({ schedule, executed }: { schedule: ScheduleResponse | null; executed: Map<number, number> }) {
  const rows: ComplianceRow[] = schedule
    ? schedule.allocations.map((a) => ({
        name: a.name,
        short: a.name.split("·")[0].trim(),
        planned: a.allocatedMinutes,
        executed: executed.get(a.id) ?? 0,
        color: colorOf(a.color)
      }))
    : complianceMock;
  const overruns = rows.filter((r) => r.executed > r.planned && r.executed > 0);
  return (
    <section className="card chart-card cogn-span-full">
      <div className="section-heading"><div><p className="eyebrow">Disciplina de execução</p><h2>Conformidade de timeboxing</h2></div><Target size={20} /></div>
      {overruns.length > 0 && <div className="cog-alert danger"><AlertTriangle size={16} /><div><strong>Armadilha do perfeccionismo detectada.</strong><span>{overruns.map((o) => o.short).join(", ")} excederam o teto do dia — o cronograma de hoje foi comprimido.</span></div></div>}
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 14, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="short" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <YAxis unit="min" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <Tooltip contentStyle={COG_TOOLTIP} cursor={{ fill: "#1a2b42" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            <Bar name="Teto planejado" dataKey="planned" fill="#5b5f8f" radius={[6, 6, 0, 0]} />
            <Bar name="Tempo líquido executado" dataKey="executed" radius={[6, 6, 0, 0]}>
              {rows.map((r) => <Cell key={r.name} fill={r.executed > r.planned && r.executed > 0 ? "#ff5a71" : "#34d399"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="cogn-footnote">Barra vermelha = tempo executado acima do teto planejado (quebra de timebox). O fechamento ideal é o bloco terminar com um resumo coerente do conceito estudado.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 6. Evolução de acerto por matéria (melhoria ao longo do tempo)    */
/* ---------------------------------------------------------------- */

const shortIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}`;
};

function SubjectImprovementTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string | number; value?: number | string | Array<number | string>; color?: string; payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((entry) => typeof entry.value === "number");
  if (!items.length) return null;
  const label = typeof payload[0].payload?.label === "string" ? payload[0].payload.label : "";
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {items.map((entry) => (
        <span key={String(entry.name)} style={{ color: typeof entry.color === "string" ? entry.color : undefined }}>
          {String(entry.name).split("·")[0].trim()}: <b>{entry.value}%</b>
        </span>
      ))}
    </div>
  );
}

function SubjectImprovementChart({ subjects, points }: { subjects: Subject[]; points: SubjectAccuracyPoint[] }) {
  const [isolated, setIsolated] = useState<number | null>(null);
  const dates = [...new Set(points.map((p) => p.date))].sort();
  const byKey = new Map(points.map((p) => [`${p.subjectId}|${p.date}` as string, p]));
  const visible = subjects.filter((s) => isolated === null || s.id === isolated);
  const rows = dates.map((date) => {
    const row: Record<string, number | string> = { label: shortIsoDate(date) };
    for (const subject of subjects) {
      const point = byKey.get(`${subject.id}|${date}`);
      if (point && point.accuracy >= 0) row[subject.name] = point.accuracy;
    }
    return row;
  });
  return (
    <section className="card chart-card cogn-span-full">
      <div className="section-heading"><div><p className="eyebrow">Melhoria ao longo do tempo</p><h2>Evolução de acerto por matéria</h2></div><TrendingUp size={20} /></div>
      {points.length === 0 && <p className="cogn-empty">Registre blocos de questões para ver a curva de acerto de cada matéria ao longo dos dias.</p>}
      {points.length > 0 && <div className="subj-pills">
        <button className={`subj-pill ${isolated === null ? "active" : ""}`} onClick={() => setIsolated(null)}>Todas</button>
        {subjects.map((s) => (
          <button key={s.id} className={`subj-pill ${isolated === s.id ? "active" : ""}`} onClick={() => setIsolated(isolated === s.id ? null : s.id)}>
            <i style={{ background: colorOf(s.color) }} />{s.name.split("·")[0].trim()}
          </button>
        ))}
      </div>}
      {points.length > 0 && <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 14, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
            <XAxis dataKey="label" minTickGap={28} tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <Tooltip content={<SubjectImprovementTooltip />} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            {visible.map((s) => (
              <Line key={s.id} name={s.name} type="monotone" dataKey={s.name} stroke={colorOf(s.color)} strokeWidth={isolated === s.id ? 3 : 1.6} strokeOpacity={isolated === null ? 1 : 1} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>}
      {points.length > 0 && <p className="cogn-footnote">Curva de acerto por matéria nos últimos dias. Clique numa matéria para isolá-la e acompanhar só a evolução dela; clique novamente para voltar a todas.</p>}
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 7. Sobrecarga Progressiva de Foco (Deep Work por matéria + geral) */
/* ---------------------------------------------------------------- */

function FocusOverloadChart({ points }: { points: FocusOverloadPoint[] }) {
  const [isolated, setIsolated] = useState<number | null>(null);
  const subjects = points.filter((p) => p.subjectId !== 0);
  const subjectIds = [...new Set(subjects.map((p) => p.subjectId))];
  const dates = [...new Set(points.map((p) => p.date))].sort();
  const byKey = new Map(points.map((p) => [`${p.subjectId}|${p.date}` as string, p]));
  const visible = subjectIds.filter((id) => isolated === null || isolated === 0 || id === isolated);
  const generalPoints = points.filter((p) => p.subjectId === 0);

  const labelOf = (p: FocusOverloadPoint) => p.subjectId === 0 ? "Geral" : p.subjectName.split("·")[0].trim();

  const rows = dates.map((date) => {
    const row: Record<string, number | string> = { label: shortIsoDate(date) };
    for (const point of points) row[labelOf(point)] = point.completionRate;
    return row;
  });

  const lastGeneralRate = generalPoints.length ? generalPoints[generalPoints.length - 1].completionRate : 0;
  const firstGeneralRate = generalPoints.length ? generalPoints[0].completionRate : 0;
  const deepWorkTotal = points.filter((p) => p.subjectId !== 0).reduce((sum, p) => sum + p.deepWorkSessions, 0);

  return (
    <section className="card chart-card cogn-span-full">
      <div className="section-heading"><div><p className="eyebrow">Motor de Deep Work · Zona de Desenvolvimento Proximal</p><h2>Sobrecarga progressiva de foco</h2></div><Flame size={20} /></div>
      {generalPoints.length > 0 && (
        <div className="cog-badge hot"><Flame size={14} /> Sustentação geral {firstGeneralRate}% → {lastGeneralRate}% · {deepWorkTotal} blocos de deep work</div>
      )}
      {points.length === 0 && <p className="cogn-empty">Complete blocos de foco (timer de deep work) para ver a capacidade de sustentação por matéria e no geral.</p>}
      {points.length > 0 && <div className="subj-pills">
        <button className={`subj-pill ${isolated === null ? "active" : ""}`} onClick={() => setIsolated(null)}>Todas</button>
        <button className={`subj-pill ${isolated === 0 ? "active" : ""}`} onClick={() => setIsolated(0)}><i style={{ background: "#94a3b8" }} />Geral</button>
        {subjectIds.map((id) => {
          const point = subjects.find((p) => p.subjectId === id);
          if (!point) return null;
          return (
            <button key={id} className={`subj-pill ${isolated === id ? "active" : ""}`} onClick={() => setIsolated(isolated === id ? null : id)}>
              <i style={{ background: colorOf(point.color) }} />{point.subjectName.split("·")[0].trim()}
            </button>
          );
        })}
      </div>}
      {points.length > 0 && <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 14, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
            <XAxis dataKey="label" minTickGap={28} tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <Tooltip contentStyle={COG_TOOLTIP} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            {(isolated === 0 || isolated === null) && (
              <Line name="Geral" type="monotone" dataKey="Geral" stroke="#94a3b8" strokeWidth={2.4} dot={false} />
            )}
            {visible.map((id) => {
              const point = subjects.find((p) => p.subjectId === id);
              if (!point) return null;
              return (
                <Line key={id} name={labelOf(point)} type="monotone" dataKey={labelOf(point)} stroke={colorOf(point.color)} strokeWidth={isolated === id ? 3 : 1.6} dot={false} />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>}
      {points.length > 0 && <p className="cogn-footnote">% do tempo planejado que foi sustentado por dia. Subir em direção a 100% é o sinal de hiperfoco: quando houver 2 blocos concluídos em sequência, o algoritmo sugere +5 min (até 120′). Clique numa matéria para isolá-la ou veja a série <em>Geral</em>.</p>}
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 8. Decaimento da memória + curva de uso Anki (Motor FSRS)         */
/* ---------------------------------------------------------------- */

const GRADE_OPTIONS: Array<{ grade: ReviewGrade; label: string; tone: string }> = [
  { grade: "again", label: "Errei", tone: "again" },
  { grade: "hard", label: "Difícil", tone: "hard" },
  { grade: "good", label: "Bom", tone: "good" },
  { grade: "easy", label: "Fácil", tone: "easy" }
];

function MemoryDecayTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number; payload?: MemoryPoint }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="chart-tooltip">
      <strong>Dia {label}</strong>
      <span>Retenção (sem revisar): <b>{point.retrievability.toFixed(1)}%</b></span>
      <span>Curva Anki: <b>{point.anki.toFixed(1)}%</b></span>
      {point.reviewed && <small style={{ color: "#7ef0c2" }}>✓ Revisão espaçada agendada exatamente no ponto ótimo</small>}
    </div>
  );
}

type MemoryDecayChartProps = {
  subjects: Subject[];
  topics: Topic[];
  items: SpacedRepetitionItem[];
  projection: MemoryDecayProjection | null;
  demo: boolean;
  onSelect: (id: number) => void;
  onCreate: (input: MemoryItemInput) => void;
  onDelete: (id: number) => void;
  onReview: (id: number, grade: ReviewGrade) => void;
};

function MemoryDecayChart({ subjects, topics, items, projection, demo, onSelect, onCreate, onDelete, onReview }: MemoryDecayChartProps) {
  const [concept, setConcept] = useState("");
  const [difficulty, setDifficulty] = useState(5);
  const [subjectId, setSubjectId] = useState<number | null>(subjects[0]?.id ?? null);
  const [topicId, setTopicId] = useState<number | null>(null);
  const selectedId = projection?.itemId ?? null;
  const subjectTopics = topics.filter((topic) => topic.subjectId === subjectId);
  const selectedTopicLabel = topicId !== null ? topics.find((topic) => topic.id === topicId)?.name ?? null : null;
  const rows = projection
    ? projection.points.map((p) => ({ ...p, retrievability: p.retrievability * 100, anki: p.anki * 100 }))
    : [];
  const due = projection !== null && projection.retrievabilityToday < 0.9;
  const percentToday = projection ? (projection.retrievabilityToday * 100).toFixed(1) : "—";
  const ankiDot = ({ cx, cy, payload }: { cx?: number; cy?: number; payload?: MemoryPoint }) => {
    if (!payload?.reviewed || cx === undefined || cy === undefined) return null;
    return <circle cx={cx} cy={cy} r={4} fill="#033a2b" stroke="#34d399" strokeWidth={2} />;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!concept.trim() || !subjects.length) return;
    onCreate({ subjectId, topicId, concept: concept.trim(), difficulty });
    setConcept("");
  };

  return (
    <section className="card chart-card cogn-span-full">
      <div className="section-heading"><div><p className="eyebrow">Motor FSRS · repetição espaçada</p><h2>Decaimento da memória · curva Anki</h2></div><BrainCircuit size={20} /></div>

      {subjects.length > 0 && <form className="memory-add" onSubmit={submit}>
        <input value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Item de memória — ex.: Números complexos · forma polar" />
        <select value={subjectId ?? ""} onChange={(event) => { setSubjectId(event.target.value ? Number(event.target.value) : null); setTopicId(null); }}>
          {subjects.map((item) => <option key={item.id} value={item.id}>{item.name.split("·")[0].trim()}</option>)}
        </select>
        <select value={topicId ?? ""} disabled={!subjectTopics.length} onChange={(event) => setTopicId(event.target.value ? Number(event.target.value) : null)} title={subjectTopics.length ? "Nicho/tópico da matéria (opcional)" : "Cadastre nichos na aba Avanço → Matriz de tópicos"}>
          <option value="">{subjectTopics.length ? "Nicho (opcional)" : "Sem nichos nesta matéria"}</option>
          {subjectTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </select>
        <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} title="Dificuldade (1–10)">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>Dificuldade {value}</option>)}
        </select>
        <button className="button secondary" disabled={!concept.trim() || demo} title={demo ? "Disponível com dados reais (fora da demo)" : "Cadastrar item na fila de repetição espaçada"}>Cadastrar item</button>
      </form>}

      {items.length > 0 && <div className="subj-pills memory-pills">
        {items.map((item) => (
          <button key={item.id} className={`subj-pill ${selectedId === item.id ? "active" : ""}`} onClick={() => onSelect(item.id)}>
            <i style={{ background: colorOf(item.color) }} />{item.concept}
            <small style={{ color: item.retrievability < 0.9 ? "#ff5a71" : "#7ef0c2" }}>{Math.round(item.retrievability * 100)}%</small>
          </button>
        ))}
      </div>}

      {projection && due && <div className="cog-alert danger"><ShieldAlert size={16} /><div><strong>Ponto Ótimo de Revisão Atingido.</strong><span>Retenção em <b>{percentToday}%</b> — abaixo dos 90% ideais. Revise agora para interromper o esquecimento e rearmar a estabilidade (R volta a 100% e o próximo intervalo cresce).</span></div></div>}
      {projection && !due && <div className="cog-alert success"><CalendarClock size={16} /><div><strong>Dentro da janela ótima de revisão.</strong><span>Retenção em <b>{percentToday}%</b> · próxima revisão em <b>{projection.dueInDays} dia{projection.dueInDays === 1 ? "" : "s"}</b> ({shortIsoDate(projection.optimalDate)}).</span></div></div>}

      {projection && <div className="memory-stats">
        <span>Estabilidade <b>{projection.stability} dias</b></span>
        <span>Dificuldade <b>{projection.difficulty}/10</b></span>
        <span>Revisões <b>{items.find((i) => i.id === projection.itemId)?.reps ?? 0}</b></span>
        <span>Ponto ótimo <b>Dia {projection.optimalDay}</b></span>
        {demo ? null : <button className="text-button" onClick={() => onDelete(projection.itemId)}>Remover item</button>}
      </div>}

      <div className="chart" style={{ height: 250 }}>
        {projection && rows.length ? <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#203044" strokeDasharray="4 4" />
            <XAxis dataKey="day" type="number" domain={[0, "dataMax"]} tickFormatter={(day) => `D${day}`} tick={{ fill: "#9aabc0", fontSize: 11 }} label={{ value: "dias desde a última revisão", position: "insideBottom", offset: -2, fill: "#8da0b8", fontSize: 10 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} />
            <Tooltip content={<MemoryDecayTooltip />} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} />
            <Legend wrapperStyle={{ color: "#b6c6d9", fontSize: 11 }} />
            <ReferenceLine y={90} stroke="#ff5a71" strokeDasharray="6 3" label={{ value: "Alerta · revisar a 90%", position: "insideTopLeft", fill: "#ff5a71", fontSize: 10 }} />
            <Line name="Retenção sem revisão" type="monotone" dataKey="retrievability" stroke="#8b7cf6" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line name="Curva com revisões (Anki)" type="monotone" dataKey="anki" stroke="#34d399" strokeWidth={2.2} dot={ankiDot} />
          </LineChart>
        </ResponsiveContainer> : <p className="cogn-empty">Cadastre um item de memória acima (ou ligue a demo) para projetar a curva: sem revisão a memória cruza 90% no Dia {projection?.optimalDay ?? "S"}, com a rotina Anki ela é rearmada toda vez que esquece.</p>}
      </div>

      {projection && <div className="memory-reviews">
        {GRADE_OPTIONS.map(({ grade, label, tone }) => (
          <button key={grade} className={`memory-grade ${tone}`} onClick={() => onReview(selectedId ?? projection.itemId, grade)}>
            {label}<small>{grade === "again" ? "·0.8×" : grade === "hard" ? "·1.2×" : grade === "good" ? "·2.2×" : "·3.0×"}</small>
          </button>
        ))}
      </div>}

      <p className="cogn-footnote"><em>Curva de Ebbinghaus + FSRS:</em> a retenção cai exponencialmente após o estudo e cruza os 90% em t = S (Stability). Revisar exatamente nesse ponto (a curva verde) reestabelece R a 100% e multiplica S, então o próximo intervalo é cada vez maior — é assim que você usa as quedas a seu favor em vez de cair com elas.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Grid principal                                                   */
/* ---------------------------------------------------------------- */

export function CognitiveCharts({ subjects, topics, schedule, executed, points, focusPoints, memoryItems, memoryProjection, demo, onMemorySelect, onMemoryCreate, onMemoryDelete, onMemoryReview }: { subjects: Subject[]; topics: Topic[]; schedule: ScheduleResponse | null; executed: Map<number, number>; points: SubjectAccuracyPoint[]; focusPoints: FocusOverloadPoint[]; memoryItems: SpacedRepetitionItem[]; memoryProjection: MemoryDecayProjection | null; demo: boolean; onMemorySelect: (id: number) => void; onMemoryCreate: (input: MemoryItemInput) => void; onMemoryDelete: (id: number) => void; onMemoryReview: (id: number, grade: ReviewGrade) => void }) {
  return (
    <div className="cognitive-section">
      <div className="section-heading"><div><p className="eyebrow">Engenharia cognitiva</p><h2>Laboratório de neuroplasticidade</h2></div></div>
      <div className="cognitive-grid">
        <RetentionDecayChart />
        <FatigueScatterChart />
        <CircadianHeatmap />
        <ProficiencyRadar subjects={subjects} />
        <TimeboxCompliance schedule={schedule} executed={executed} />
        <SubjectImprovementChart subjects={subjects} points={points} />
        <FocusOverloadChart points={focusPoints} />
        <MemoryDecayChart subjects={subjects} topics={topics} items={memoryItems} projection={memoryProjection} demo={demo} onSelect={onMemorySelect} onCreate={onMemoryCreate} onDelete={onMemoryDelete} onReview={onMemoryReview} />
      </div>
    </div>
  );
}