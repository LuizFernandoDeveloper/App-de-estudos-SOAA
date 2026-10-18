import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, CalendarDays, CheckCircle2, Clock3, Coffee, Flame, Target, TimerReset } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./api";
import { demoSubjects } from "./demo";
import type { CognitiveMode, FocusSession, Subject } from "../shared/types";

type Range = 7 | 30 | 90 | "all";
const PALETTE = ["#8b7cf6", "#42d4a1", "#63b3ed", "#f6c76f", "#f47f98", "#55c8d8", "#b79af8", "#9dcf69"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MENTALITY_LABELS: Record<CognitiveMode, string> = { general: "Estudo geral", problem_solving: "Raciocínio", retrieval: "Recordação", conceptual_reading: "Leitura conceitual", writing: "Escrita", mixed_questions: "Questões mistas" };
const normalizeRate = (rate: number) => rate <= 1 ? rate * 100 : rate;
const dateKey = (value: string) => value.slice(0, 10);
const readableDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const demoHistory = (subjects: Subject[]): FocusSession[] => Array.from({ length: 30 }, (_, index) => {
  const day = new Date(); day.setDate(day.getDate() - index);
  const subject = subjects[index % Math.max(1, subjects.length)];
  const partial = index % 6 === 3;
  const minutes = [25, 25, 30, 20, 25, 35, 25][index % 7];
  return {
    id: 9000 + index, subjectId: subject?.id ?? 0, subjectName: subject?.name ?? "Matéria exemplo", color: subject?.color ?? "violet",
    materialId: null, materialTitle: null, focusMode: "pomodoro", cognitiveMode: (["problem_solving", "retrieval", "conceptual_reading", "writing", "mixed_questions"] as CognitiveMode[])[index % 5], goalType: "topicos", goalText: "Ciclo de demonstração",
    pageStart: null, pageEnd: null, plannedMinutes: minutes, elapsedMinutes: partial ? Math.round(minutes * .65) : minutes,
    grossMinutes: (partial ? Math.round(minutes * .65) : minutes) + 5 + (index % 4) * 4,
    interrupts: index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
    completionRate: partial ? .65 : 1, zone: partial ? "media" : "baixa", exitReason: partial ? "distracao_externa" : null,
    completed: !partial, status: partial ? "partial" : "done", completionPercentage: partial ? 65 : 100,
    startedAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8 + index % 12, (index % 4) * 15).toISOString()
  };
});

export function PomodoroAnalyticsView({ demo, subjects, onOpenTimer }: { demo: boolean; subjects: Subject[]; onOpenTimer: () => void }) {
  const [records, setRecords] = useState<FocusSession[]>([]);
  const [range, setRange] = useState<Range>(30);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setRecords(demoHistory(subjects.length ? subjects : demoSubjects));
      setLoading(false);
      setError("");
      return () => { cancelled = true; };
    }
    setLoading(true);
    api.listPomodoroSessions()
      .then((sessions) => { if (!cancelled) setRecords(sessions.filter((session) => session.focusMode === "pomodoro")); })
      .catch((reason) => { if (!cancelled) setError(String(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, subjects]);

  const filtered = useMemo(() => {
    if (range === "all") return records;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range + 1); cutoff.setHours(0, 0, 0, 0);
    return records.filter((session) => dateKey(session.startedAt) >= cutoff.toISOString().slice(0, 10));
  }, [range, records]);

  const metrics = useMemo(() => {
    const totalMinutes = filtered.reduce((sum, session) => sum + session.elapsedMinutes, 0);
    const measuredGrossMinutes = filtered.reduce((sum, session) => sum + (session.grossMinutes ?? 0), 0);
    const grossSessions = filtered.filter((session) => session.grossMinutes != null).length;
    const measuredPauseMinutes = filtered.reduce((sum, session) => sum + (session.grossMinutes == null ? 0 : Math.max(0, session.grossMinutes - session.elapsedMinutes)), 0);
    const plannedMinutes = filtered.reduce((sum, session) => sum + session.plannedMinutes, 0);
    const completed = filtered.filter((session) => session.status === "done" || session.completed).length;
    const interruptions = filtered.reduce((sum, session) => sum + session.interrupts, 0);
    const completionRate = filtered.length ? completed / filtered.length * 100 : 0;

    const dailyMap = new Map<string, { date: string; minutes: number; gross: number; grossSessions: number; planned: number; sessions: number; completed: number }>();
    for (const session of filtered) {
      const key = dateKey(session.startedAt);
      const point = dailyMap.get(key) ?? { date: key, minutes: 0, gross: 0, grossSessions: 0, planned: 0, sessions: 0, completed: 0 };
      point.minutes += session.elapsedMinutes; point.planned += session.plannedMinutes; point.sessions += 1;
      if (session.grossMinutes != null) { point.gross += session.grossMinutes; point.grossSessions += 1; }
      if (session.status === "done" || session.completed) point.completed += 1;
      dailyMap.set(key, point);
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((point) => ({ ...point, gross: point.grossSessions ? point.gross : null, label: readableDate(point.date) }));

    const subjectMap = new Map<number, { id: number; subject: string; minutes: number; gross: number; grossSessions: number; planned: number; sessions: number; completed: number; color: string }>();
    for (const session of filtered) {
      const point = subjectMap.get(session.subjectId) ?? { id: session.subjectId, subject: session.subjectName.split("·")[0].trim(), minutes: 0, gross: 0, grossSessions: 0, planned: 0, sessions: 0, completed: 0, color: PALETTE[subjectMap.size % PALETTE.length] };
      point.minutes += session.elapsedMinutes; point.planned += session.plannedMinutes; point.sessions += 1;
      if (session.grossMinutes != null) { point.gross += session.grossMinutes; point.grossSessions += 1; }
      if (session.status === "done" || session.completed) point.completed += 1;
      subjectMap.set(session.subjectId, point);
    }
    const bySubject = [...subjectMap.values()].sort((a, b) => b.minutes - a.minutes);

    const mentalMap = new Map<CognitiveMode, { mode: CognitiveMode; label: string; sessions: number; minutes: number; planned: number; completed: number; interruptions: number }>();
    for (const session of filtered) {
      const mode = session.cognitiveMode ?? "general";
      const point = mentalMap.get(mode) ?? { mode, label: MENTALITY_LABELS[mode], sessions: 0, minutes: 0, planned: 0, completed: 0, interruptions: 0 };
      point.sessions += 1; point.minutes += session.elapsedMinutes; point.planned += session.plannedMinutes;
      if (session.status === "done" || session.completed) point.completed += 1;
      point.interruptions += session.interrupts;
      mentalMap.set(mode, point);
    }
    const mentalModes = [...mentalMap.values()].map((point) => ({ ...point, completion: point.sessions ? Math.round(point.completed / point.sessions * 100) : 0, interruptionRate: point.sessions ? Number((point.interruptions / point.sessions).toFixed(1)) : 0 })).sort((a, b) => b.sessions - a.sessions);

    const weekdays = DAY_NAMES.map((day, weekday) => {
      const sessions = filtered.filter((session) => new Date(session.startedAt.includes("T") ? session.startedAt : `${dateKey(session.startedAt)}T12:00:00`).getDay() === weekday);
      return { day, minutes: sessions.reduce((sum, session) => sum + session.elapsedMinutes, 0), sessions: sessions.length,
        completion: sessions.length ? Math.round(sessions.filter((session) => session.completed || session.status === "done").length / sessions.length * 100) : 0 };
    });
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, "0")}h`, sessions: 0, minutes: 0 }));
    let withTime = 0;
    for (const session of filtered) {
      const hourText = session.startedAt.match(/T(\d{2}):/);
      if (!hourText) continue;
      const point = hours[Number(hourText[1])];
      if (point) { point.sessions += 1; point.minutes += session.elapsedMinutes; withTime += 1; }
    }

    const ranges = [
      { duration: "≤ 15 min", min: 0, max: 15 }, { duration: "16–20 min", min: 16, max: 20 },
      { duration: "21–25 min", min: 21, max: 25 }, { duration: "26–30 min", min: 26, max: 30 },
      { duration: "31–45 min", min: 31, max: 45 }, { duration: "> 45 min", min: 46, max: Infinity }
    ].map((bucket) => ({ ...bucket, sessions: filtered.filter((session) => session.elapsedMinutes >= bucket.min && session.elapsedMinutes <= bucket.max).length }));
    const outcomes = [
      { name: "Concluídos", value: completed, color: "#42d4a1" },
      { name: "Parciais", value: filtered.length - completed, color: "#f6c76f" }
    ].filter((item) => item.value > 0);
    const avgMinutes = filtered.length ? totalMinutes / filtered.length : 0;
    return { totalMinutes, measuredGrossMinutes, grossSessions, measuredPauseMinutes, plannedMinutes, completed, interruptions, completionRate, daily, bySubject, mentalModes, weekdays, hours, withTime, ranges, outcomes, avgMinutes };
  }, [filtered]);

  const rangeLabel = range === "all" ? "Todo o histórico" : `Últimos ${range} dias`;

  return <div className="page-stack pomodoro-metrics-page">
    <section className="card pomodoro-analytics-hero">
      <div><p className="eyebrow">Análise de foco · histórico completo do SQLite</p><h2>O que seus ciclos estão mostrando?</h2><p>Compare minutos planejados e executados, matérias atendidas, constância, interrupções e melhores horários. Use os filtros para enxergar tendências curtas ou todo o histórico.</p></div>
      <div className="pomodoro-analytics-actions"><button className="button secondary" onClick={onOpenTimer}><TimerReset size={16} /> Abrir Pomodoro</button><span className={demo ? "demo-hint" : "db-hint"}>{demo ? "Demonstração" : "Banco local"}</span></div>
    </section>

    <div className="pomodoro-filter-row"><div><strong>{rangeLabel}</strong><span>{filtered.length} ciclos considerados</span></div><div className="segmented">{([7, 30, 90, "all"] as Range[]).map((value) => <button key={String(value)} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value === "all" ? "Tudo" : `${value} dias`}</button>)}</div></div>

    {error && <div className="card pomodoro-load-error" role="alert">Não foi possível carregar o histórico: {error}</div>}
    {loading ? <section className="card pomodoro-empty">Carregando sessões Pomodoro do banco local…</section> : filtered.length === 0 ? <section className="card pomodoro-empty"><div><Clock3 size={28} /></div><h3>O histórico começa no primeiro ciclo</h3><p>Inicie um ciclo Pomodoro vinculado a uma matéria. Cada conclusão ou bloco parcial aparecerá aqui automaticamente.</p><button className="button primary" onClick={onOpenTimer}>Iniciar Pomodoro</button></section> : <>
      <section className="metric-grid pomodoro-kpis">
        <Metric icon={<Clock3 />} value={`${Math.floor(metrics.totalMinutes / 60)}h ${metrics.totalMinutes % 60}m`} label="Horas líquidas" detail={`${metrics.plannedMinutes} min planejados`} />
        <Metric icon={<TimerReset />} value={`${Math.floor(metrics.measuredGrossMinutes / 60)}h ${metrics.measuredGrossMinutes % 60}m`} label="Horas brutas medidas" detail={`${metrics.grossSessions} de ${filtered.length} ciclos com janela registrada`} />
        <Metric icon={<Coffee />} value={`${Math.floor(metrics.measuredPauseMinutes / 60)}h ${metrics.measuredPauseMinutes % 60}m`} label="Pausas na janela" detail="diferença entre janela bruta e foco líquido" />
        <Metric icon={<CheckCircle2 />} value={`${Math.round(metrics.completionRate)}%`} label="Ciclos concluídos" detail={`${metrics.completed} de ${filtered.length}`} />
        <Metric icon={<Target />} value={`${Math.round(metrics.avgMinutes)} min`} label="Duração média" detail="por ciclo Pomodoro" />
        <Metric icon={<Activity />} value={`${metrics.interruptions}`} label="Interrupções" detail={`${(metrics.interruptions / filtered.length).toFixed(1)} por ciclo`} />
        <Metric icon={<Flame />} value={`${metrics.bySubject.length}`} label="Matérias estudadas" detail="com ciclos registrados" />
        <Metric icon={<CalendarDays />} value={`${metrics.daily.length}`} label="Dias com foco" detail={`no intervalo: ${rangeLabel.toLowerCase()}`} />
      </section>

      <section className="pomodoro-chart-grid">
        <ChartCard className="span-12" eyebrow="Horas brutas e líquidas" title="Janela de estudo, foco e plano" subtitle="Líquido soma o foco do cronômetro; bruto soma as janelas registradas, incluindo pausas feitas com o ciclo aberto. Sessões antigas sem essa medição ficam fora da série bruta.">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={metrics.daily} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}><defs><linearGradient id="pomActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b7cf6" stopOpacity={0.4} /><stop offset="95%" stopColor="#8b7cf6" stopOpacity={0.02} /></linearGradient><linearGradient id="pomPlanned" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#42d4a1" stopOpacity={0.25} /><stop offset="95%" stopColor="#42d4a1" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} /><YAxis tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} /><Area type="monotone" dataKey="planned" name="Planejado (min)" stroke="#42d4a1" fill="url(#pomPlanned)" strokeWidth={2} /><Area type="monotone" dataKey="minutes" name="Líquido · foco (min)" stroke="#8b7cf6" fill="url(#pomActual)" strokeWidth={2.5} /><Line type="monotone" dataKey="gross" name="Bruto · janela medida (min)" stroke="#f6c76f" strokeWidth={2.5} connectNulls={false} /></AreaChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-7" eyebrow="Distribuição por matéria" title="Onde o foco foi investido" subtitle="Tempo executado e tempo previsto por matéria.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.bySubject.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 18, left: 10, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="subject" width={115} tick={{ fill: "#aebdd0", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} /><Bar dataKey="minutes" name="Líquido · foco (min)" fill="#8b7cf6" radius={[0, 5, 5, 0]} /><Bar dataKey="gross" name="Bruto · janela medida (min)" fill="#f6c76f" radius={[0, 5, 5, 0]} /><Bar dataKey="planned" name="Planejado (min)" fill="#42d4a1" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-5" eyebrow="Carga cognitiva" title="Rendimento por mentalidade" subtitle="Compare sessões concluídas, amostra e interrupções em cada tipo de esforço.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.mentalModes} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={112} tick={{ fill: "#aebdd0", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} formatter={(value, name, item) => [String(value ?? 0) + "% · " + String((item as { payload?: { sessions?: number } }).payload?.sessions ?? 0) + " ciclos", String(name)]} /><Bar dataKey="completion" name="Conclusão" fill="#42d4a1" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-5" eyebrow="Resultado dos ciclos" title="Conclusão e parciais" subtitle="Taxa de ciclos finalizados até o tempo planejado.">
          <div className="pomodoro-donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={metrics.outcomes} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="84%" paddingAngle={4} stroke="none">{metrics.outcomes.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={tooltip} /><text x="50%" y="47%" textAnchor="middle" fill="#eef5ff" fontSize="28" fontWeight="800">{Math.round(metrics.completionRate)}%</text><text x="50%" y="57%" textAnchor="middle" fill="#8498b2" fontSize="11">conclusão</text></PieChart></ResponsiveContainer></div>
          <div className="pomodoro-outcome-legend">{metrics.outcomes.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}</strong></span>)}</div>
        </ChartCard>

        <ChartCard className="span-6" eyebrow="Constância" title="Distribuição por dia da semana" subtitle="Minutos e quantidade de ciclos em cada dia.">
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={metrics.weekdays} margin={{ top: 8, right: 6, left: -10, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#aebdd0", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="left" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltip} /><Bar yAxisId="left" dataKey="minutes" name="Minutos" fill="#8b7cf6" radius={[5, 5, 0, 0]} /><Line yAxisId="right" type="monotone" dataKey="sessions" name="Ciclos" stroke="#42d4a1" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-6" eyebrow="Janela de início" title="Horários mais frequentes" subtitle={metrics.withTime ? `${metrics.withTime} sessões têm hora de início registrada.` : "As sessões antigas sem horário não entram nesta análise."}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.hours} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="hour" interval={2} tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltip} /><Bar dataKey="sessions" name="Ciclos iniciados" fill="#63b3ed" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-6" eyebrow="Duração executada" title="Faixas de duração dos blocos" subtitle="Ajuda a comparar o ritmo configurado com os ciclos realmente registrados.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.ranges} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="duration" tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltip} /><Bar dataKey="sessions" name="Ciclos" fill="#f6c76f" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard className="span-6" eyebrow="Qualidade de execução" title="Conclusão por dia da semana" subtitle="Percentual de ciclos concluídos, com volume mostrado ao lado.">
          <ResponsiveContainer width="100%" height="100%"><ComposedChart data={metrics.weekdays} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#aebdd0", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="left" domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={tooltip} /><Line yAxisId="left" type="monotone" dataKey="completion" name="Conclusão (%)" stroke="#42d4a1" strokeWidth={2.5} connectNulls /><Bar yAxisId="right" dataKey="sessions" name="Ciclos" fill="#8b7cf6" radius={[4, 4, 0, 0]} /></ComposedChart></ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="card pomodoro-subject-table">
        <div className="section-heading"><div><p className="eyebrow">Cruzamento de métricas</p><h2>Resumo por matéria</h2></div><TimerReset size={20} /></div>
        <div className="table-wrap"><table><thead><tr><th>Matéria</th><th>Ciclos</th><th>Foco líquido</th><th>Janela bruta medida</th><th>Planejado</th><th>Conclusão</th><th>Interrupções</th><th>Média por ciclo</th></tr></thead><tbody>{metrics.bySubject.map((subject) => <tr key={subject.id}><td><span className="subject-cell"><span className="color-dot" style={{ background: PALETTE[metrics.bySubject.indexOf(subject) % PALETTE.length] }} />{subject.subject}</span></td><td>{subject.sessions}</td><td>{subject.minutes} min</td><td>{subject.grossSessions ? `${subject.gross} min · ${subject.grossSessions}/${subject.sessions}` : "sem medição"}</td><td>{subject.planned} min</td><td><strong className={subject.completed / subject.sessions >= .75 ? "good" : "needs-work"}>{Math.round(subject.completed / subject.sessions * 100)}%</strong></td><td>{filtered.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.interrupts, 0)}</td><td>{Math.round(subject.minutes / subject.sessions)} min</td></tr>)}</tbody></table></div>
      </section>
      <section className="card pomodoro-subject-table"><div className="section-heading"><div><p className="eyebrow">Esforço mental por matéria</p><h2>O que rende melhor para você?</h2></div><Activity size={20} /></div><p className="cogn-footnote">A comparação fica mais confiável com várias sessões de cada tipo. Ela descreve seus registros, não uma regra universal sobre a matéria.</p><div className="table-wrap"><table><thead><tr><th>Tipo de esforço</th><th>Ciclos</th><th>Conclusão</th><th>Interrupções/ciclo</th><th>Tempo médio</th></tr></thead><tbody>{metrics.mentalModes.map((mode) => <tr key={mode.mode}><td>{mode.label}</td><td>{mode.sessions}</td><td>{mode.completion}%</td><td>{mode.interruptionRate}</td><td>{Math.round(mode.minutes / mode.sessions)} min</td></tr>)}</tbody></table></div></section>
      <p className="pomodoro-data-note">As métricas contam apenas sessões marcadas como Pomodoro. Foco líquido é o tempo ativo do ciclo; bruto é a janela medida entre início e encerramento, incluindo pausas com o ciclo aberto. Dados anteriores à medição bruta aparecem como “sem medição” e não são estimados. Intervalos de descanso entre ciclos não entram nessa janela. O tempo líquido também alimenta o retrato de esforço e o ranking de prioridade.</p>
    </>}
  </div>;
}

function Metric({ icon, value, label, detail }: { icon: ReactNode; value: string; label: string; detail: string }) {
  return <div className="card metric pomodoro-kpi">{icon}<div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>;
}

function ChartCard({ className, eyebrow, title, subtitle, children }: { className: string; eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <article className={`card pomodoro-chart-card ${className}`}><div className="pomodoro-chart-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><p>{subtitle}</p></div></div><div className="pomodoro-chart-body">{children}</div></article>;
}

const tooltip = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff" };
