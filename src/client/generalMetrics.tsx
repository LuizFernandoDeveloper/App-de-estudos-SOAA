import { useMemo, type ReactNode } from "react";
import { Activity, BarChart3, BookOpenCheck, Brain, CalendarDays, CircleAlert, Clock3, Target } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import type {
  DashboardData, FocusOverloadPoint, PerformancePoint, Profile, RetentionOverview,
  SpacedRepetitionItem, StudyMaterial, Subject, SubjectAccuracyPoint, SubjectRanking, Topic
} from "../shared/types";
import type { SynergyBrief } from "./synergy";

const COLORS = ["#8b7cf6", "#42d4a1", "#63b3ed", "#f6c76f", "#f47f98", "#55c8d8", "#b79af8", "#9dcf69"];
const TOOLTIP = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff" };
const short = (value: string) => value.split("·")[0].trim();
const day = (value: string) => value.slice(0, 10);
const labelDate = (value: string) => new Date(`${day(value)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function GeneralMetricsView({ dashboard, profile, subjects, topics, materials, ranking, trend, subjectTrend, focusTrend, memoryItems, retention, synergy, onNavigate, onOpenReview }: {
  dashboard: DashboardData | null;
  profile: Profile;
  subjects: Subject[];
  topics: Topic[];
  materials: StudyMaterial[];
  ranking: SubjectRanking[];
  trend: PerformancePoint[];
  subjectTrend: SubjectAccuracyPoint[];
  focusTrend: FocusOverloadPoint[];
  memoryItems: SpacedRepetitionItem[];
  retention: RetentionOverview | null;
  synergy: SynergyBrief;
  onNavigate: (view: "pomodoro" | "ranking" | "desempenho" | "avanco") => void;
  onOpenReview: () => void;
}) {
  const data = useMemo(() => {
    const focusDaily = focusTrend.filter((point) => point.subjectId === 0).sort((a, b) => a.date.localeCompare(b.date));
    const focusBySubject = new Map<number, number>();
    for (const point of focusTrend) if (point.subjectId !== 0) focusBySubject.set(point.subjectId, (focusBySubject.get(point.subjectId) ?? 0) + point.elapsedMinutes);
    const questionsBySubject = new Map(subjectTrend.map((point) => [point.subjectId, point]));
    const subjectCompare = subjects.map((subject, index) => {
      const rank = ranking.find((row) => row.id === subject.id);
      const synergyRow = synergy.rows.find((row) => row.subjectId === subject.id);
      const question = questionsBySubject.get(subject.id);
      const subjectTopics = topics.filter((topic) => topic.subjectId === subject.id);
      const completedTopics = subjectTopics.filter((topic) => topic.status === "concluido").length;
      const actual = question?.accuracy ?? rank?.accuracy ?? 0;
      return { id: subject.id, subject: short(subject.name), accuracy: actual, goal: subject.goalAccuracy, focusMinutes: focusBySubject.get(subject.id) ?? 0,
        synergy: synergyRow?.score ?? 0, coverage: subjectTopics.length ? completedTopics / subjectTopics.length * 100 : 0,
        done: completedTopics, open: Math.max(0, subjectTopics.length - completedTopics), targetCoverage: subject.goalCoverage, color: COLORS[index % COLORS.length] };
    });
    const questionPoints = trend.map((point) => ({ ...point, dateLabel: point.label || labelDate(point.startDate) }));
    const combinedMap = new Map<string, { date: string; label: string; focus: number; questions: number; correct: number }>();
    for (const point of focusDaily) combinedMap.set(day(point.date), { date: day(point.date), label: labelDate(point.date), focus: point.elapsedMinutes, questions: 0, correct: 0 });
    for (const point of trend) {
      const key = day(point.startDate);
      const current = combinedMap.get(key) ?? { date: key, label: point.label || labelDate(key), focus: 0, questions: 0, correct: 0 };
      current.questions += point.questionsTotal; current.correct += point.questionsCorrect; combinedMap.set(key, current);
    }
    const combined = [...combinedMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const topicProgress = subjectCompare.filter((row) => row.done + row.open > 0).sort((a, b) => b.coverage - a.coverage);
    const materialStatus = [
      { name: "Concluídos", value: materials.filter((material) => material.status === "concluido").length, color: "#42d4a1" },
      { name: "Em andamento", value: materials.filter((material) => material.status === "em_andamento").length, color: "#63b3ed" },
      { name: "Pendentes", value: materials.filter((material) => material.status === "pendente").length, color: "#f6c76f" }
    ].filter((item) => item.value > 0);
    const dueItems = memoryItems.filter((item) => item.dueDate <= new Date().toISOString().slice(0, 10));
    const retentionSeries = (retention?.series ?? []).filter((series) => series.level === "subject").sort((a, b) => b.items - a.items).slice(0, 5);
    const retentionData = (retention?.rows ?? []).map((row) => ({ ...row, label: `D+${row.day}` }));
    const plannedWeek = Math.round(profile.dailyHours * profile.weeklyDays * 60);
    const weeklyProgress = plannedWeek > 0 ? Math.min(100, (dashboard?.weeklyStudyMinutes ?? 0) / plannedWeek * 100) : 0;
    const averageRetention = memoryItems.length ? memoryItems.reduce((sum, item) => sum + item.retrievability, 0) / memoryItems.length * 100 : 0;
    const focusMinutes = focusDaily.reduce((sum, point) => sum + point.elapsedMinutes, 0);
    const focusSessions = focusDaily.reduce((sum, point) => sum + point.sessions, 0);
    const avgFocusCompletion = focusDaily.length ? focusDaily.reduce((sum, point) => sum + point.completionRate * point.sessions, 0) / Math.max(1, focusSessions) : 0;
    const redCount = synergy.rows.filter((row) => row.score >= 55).length;
    return { focusDaily, subjectCompare, questionPoints, combined, topicProgress, materialStatus, dueItems, retentionSeries, retentionData, plannedWeek, weeklyProgress, averageRetention, focusMinutes, focusSessions, avgFocusCompletion, redCount };
  }, [dashboard, profile, subjects, topics, materials, ranking, trend, subjectTrend, focusTrend, memoryItems, retention, synergy]);

  return <div className="page-stack general-metrics-page">
    <section className="card general-metrics-hero"><div><p className="eyebrow">Painel integrado · estudo, retenção e execução</p><h2>Todos os sinais do seu sistema, em uma visão.</h2><p>Os gráficos conectam as rotinas que se ajudam: tempo de foco com questões, acerto com meta, retenção com revisões, edital com biblioteca e urgência com o ranking de matérias.</p></div><div className="general-metrics-actions"><button className="button secondary" onClick={() => onNavigate("pomodoro")}><Clock3 size={16} /> Pomodoro</button><button className="button ghost" onClick={() => onNavigate("ranking")}><BarChart3 size={16} /> Ranking</button></div></section>

    <section className="metric-grid general-kpis">
      <Metric icon={<Target />} value={String(dashboard?.questions.total ?? 0)} label="Questões registradas" detail={`${dashboard?.questions.correct ?? 0} corretas · ${dashboard?.questions.accuracy ?? 0}% de acerto`} />
      <Metric icon={<Clock3 />} value={`${Math.floor(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m`} label="Foco nos últimos 30 dias" detail={`${data.focusSessions} blocos · sustentação ${Math.round(data.avgFocusCompletion)}%`} />
      <Metric icon={<Brain />} value={`${Math.round(data.averageRetention)}%`} label="Retenção média atual" detail={`${memoryItems.length} conceitos no FSRS · ${data.dueItems.length} vencidos`} />
      <Metric icon={<BookOpenCheck />} value={`${topics.filter((topic) => topic.status === "concluido").length}/${topics.length}`} label="Tópicos concluídos" detail={`${data.topicProgress.length} matérias com edital mapeado`} />
      <Metric icon={<CalendarDays />} value={`${Math.round(data.weeklyProgress)}%`} label="Ritmo de estudo semanal" detail={`${dashboard?.weeklyStudyMinutes ?? 0} de ${data.plannedWeek} min registrados em questões`} />
      <Metric icon={<CircleAlert />} value={String(data.redCount)} label="Matérias em zona vermelha" detail="Prioridade de atenção calculada pela sinergia" urgent={data.redCount > 0} />
      <Metric icon={<Activity />} value={`${materials.filter((material) => material.status === "concluido").length}/${materials.length}`} label="Materiais concluídos" detail={`${materials.filter((material) => material.status === "em_andamento").length} em andamento`} />
      <Metric icon={<BarChart3 />} value={`${ranking.length}`} label="Matérias ranqueadas" detail={`${subjects.length} cadastradas na matriz`} />
    </section>

    <section className="general-chart-grid">
      <ChartCard className="span-12" eyebrow="Prática de recuperação" title="Volume de questões, acertos e precisão" subtitle="Veja quando o aumento de prática vem acompanhado de melhora real no acerto.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.questionPoints} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="dateLabel" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} /><YAxis yAxisId="count" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar yAxisId="count" dataKey="questionsTotal" name="Questões" fill="#4e6380" radius={[4, 4, 0, 0]} /><Bar yAxisId="count" dataKey="questionsCorrect" name="Acertos" fill="#42d4a1" radius={[4, 4, 0, 0]} /><Line yAxisId="rate" type="monotone" dataKey="accuracy" name="Precisão (%)" stroke="#f6c76f" strokeWidth={2.5} connectNulls /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-12" eyebrow="Execução e consistência" title="Tempo de foco real contra planejado" subtitle="Deep Work e Pomodoro entram como blocos de foco no esforço por matéria; a calibração de timebox continua separada.">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.focusDaily} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}><defs><linearGradient id="generalFocusActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b7cf6" stopOpacity={.38} /><stop offset="95%" stopColor="#8b7cf6" stopOpacity={.02} /></linearGradient><linearGradient id="generalFocusPlan" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#42d4a1" stopOpacity={.2} /><stop offset="95%" stopColor="#42d4a1" stopOpacity={.01} /></linearGradient></defs><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={labelDate} tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={18} /><YAxis tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} labelFormatter={(value) => labelDate(String(value))} /><Area type="monotone" dataKey="plannedMinutes" name="Planejado (min)" stroke="#42d4a1" fill="url(#generalFocusPlan)" strokeWidth={2} /><Area type="monotone" dataKey="elapsedMinutes" name="Executado (min)" stroke="#8b7cf6" fill="url(#generalFocusActual)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-7" eyebrow="Decisão de estudo" title="Índice integrado de sinergia" subtitle="Cada barra cruza prioridade, FSRS, acerto, cobertura do edital, foco e ênfase do curso. Vermelho começa em 55.">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={[...data.subjectCompare].sort((a, b) => b.synergy - a.synergy).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 15, left: 12, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="subject" width={112} tick={{ fill: "#aebdd0", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar dataKey="synergy" name="Índice / 100" radius={[0, 5, 5, 0]}>{[...data.subjectCompare].sort((a, b) => b.synergy - a.synergy).slice(0, 10).map((row) => <Cell key={row.id} fill={row.synergy >= 55 ? "#f47f98" : row.synergy >= 30 ? "#f6c76f" : "#42d4a1"} />)}</Bar></BarChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-5" eyebrow="Retenção espaçada" title="Curva de lembrança prevista" subtitle="O FSRS projeta queda e recuperação conforme as revisões acontecem.">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={data.retentionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Line type="monotone" dataKey="global" name="Global" stroke="#f6c76f" strokeWidth={2.5} dot={false} connectNulls />{data.retentionSeries.map((series, index) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={series.color || COLORS[index % COLORS.length]} strokeWidth={1.8} dot={false} connectNulls />)}</LineChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-6" eyebrow="Meta de acerto" title="Resultado por matéria vs objetivo" subtitle="Matérias abaixo da meta pedem questões direcionadas e revisão ativa.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...data.subjectCompare].sort((a, b) => a.accuracy - b.accuracy).slice(0, 10)} margin={{ top: 8, right: 10, left: -6, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" interval={0} angle={-15} textAnchor="end" height={55} tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar dataKey="accuracy" name="Acerto atual" fill="#8b7cf6" radius={[4, 4, 0, 0]} /><Line type="monotone" dataKey="goal" name="Meta (%)" stroke="#f47f98" strokeWidth={2} /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-6" eyebrow="Cobertura do curso" title="Tópicos feitos e por fazer" subtitle="A linha é sua meta de cobertura por matéria; barras mostram o edital cadastrado.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.topicProgress.slice(0, 10)} margin={{ top: 8, right: 10, left: -6, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" interval={0} angle={-15} textAnchor="end" height={55} tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis yAxisId="count" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar yAxisId="count" dataKey="done" stackId="topics" name="Concluídos" fill="#42d4a1" /><Bar yAxisId="count" dataKey="open" stackId="topics" name="Abertos" fill="#354b66" radius={[4, 4, 0, 0]} /><Line yAxisId="rate" dataKey="targetCoverage" name="Meta (%)" stroke="#f6c76f" strokeWidth={2} /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-5" eyebrow="Biblioteca de estudo" title="Estado dos materiais" subtitle="Acompanhe o que já foi concluído e o que ainda está na fila.">
        <div className="general-donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.materialStatus} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="82%" paddingAngle={4} stroke="none">{data.materialStatus.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={TOOLTIP} /><text x="50%" y="48%" textAnchor="middle" fill="#eef5ff" fontSize="28" fontWeight="800">{materials.length}</text><text x="50%" y="58%" textAnchor="middle" fill="#8498b2" fontSize="10">materiais</text></PieChart></ResponsiveContainer></div>
        <div className="general-legend">{data.materialStatus.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}</strong></span>)}</div>
      </ChartCard>

      <ChartCard className="span-7" eyebrow="Sinergia entre ações" title="Foco e prática de questões no mesmo dia" subtitle="Use o cruzamento para perceber se os blocos de foco estão virando prática ativa.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.combined} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={18} /><YAxis yAxisId="left" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="right" orientation="right" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={TOOLTIP} /><Bar yAxisId="right" dataKey="questions" name="Questões" fill="#42d4a1" radius={[4, 4, 0, 0]} /><Line yAxisId="left" type="monotone" dataKey="focus" name="Foco (min)" stroke="#8b7cf6" strokeWidth={2.5} connectNulls /></ComposedChart></ResponsiveContainer>
      </ChartCard>

      <ChartCard className="span-12" eyebrow="Esforço x resultado" title="Minutos de foco e acerto por matéria" subtitle="Cruza sessões registradas nos últimos 30 dias com a precisão de questões por matéria.">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.subjectCompare} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="#203149" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" interval={0} angle={-12} textAnchor="end" height={55} tick={{ fill: "#8498b2", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis yAxisId="time" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: "#8498b2", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar yAxisId="time" dataKey="focusMinutes" name="Foco (min)" fill="#8b7cf6" radius={[4, 4, 0, 0]} /><Line yAxisId="rate" type="monotone" dataKey="accuracy" name="Acerto (%)" stroke="#42d4a1" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
    </section>

    {data.dueItems.length > 0 && <section className="card general-due-callout"><CircleAlert size={18} /><div><strong>{data.dueItems.length} revisões FSRS vencidas</strong><span>O gráfico de retenção e o ranking apontam quais conceitos devem ser recuperados primeiro.</span></div><button className="button secondary" onClick={onOpenReview}>Abrir revisões</button></section>}
  </div>;
}

function Metric({ icon, value, label, detail, urgent = false }: { icon: ReactNode; value: string; label: string; detail: string; urgent?: boolean }) {
  return <div className={`card metric general-kpi ${urgent ? "urgent" : ""}`}>{icon}<div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>;
}

function ChartCard({ className, eyebrow, title, subtitle, children }: { className: string; eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <article className={`card general-chart-card ${className}`}><div className="general-chart-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><p>{subtitle}</p></div></div><div className="general-chart-body">{children}</div></article>;
}
