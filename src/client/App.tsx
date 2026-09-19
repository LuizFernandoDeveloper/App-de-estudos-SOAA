import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  BrainCog,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  FolderPlus,
  LayoutDashboard,
  Library,
  LineChart,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  TimerReset,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  Zap
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api, type MaterialInput, type QuestionResultInput, type SubjectInput } from "./api";
import { buildMemoryDecayProjection, demoDashboard, demoDayAllocations, demoFilteredTrend, demoFocusOverloadTrend, demoMaterialList, demoMemoryItems, demoPlan, demoRanking, demoRetentionOverview, demoSchedule, demoSubjectAccuracyTrend, demoSubjects, demoTopicList } from "./demo";
import { CognitiveCharts } from "./cognitive";
import { RetentionGraphBoard } from "./retention";
import { AdvancementView } from "./advancement";
import { RankingView } from "./ranking";
import { FocusTimerView } from "./focus";
import { RescheduleTriagePanel } from "./triage";
import { CustomTitleBar } from "./TitleBar";
import type {
  DashboardData,
  DayAllocation,
  FocusOverloadPoint,
  MaterialStatus,
  MaterialStrategy,
  MemoryDecayProjection,
  MemoryItemInput,
  PerformanceGranularity,
  PerformancePoint,
  PlanDay,
  PlanFocus,
  PlanInput,
  PlanResponse,
  Profile,
  ReviewGrade,
  RetentionOverview,
  ScheduleResponse,
  SpacedRepetitionItem,
  StudyMaterial,
  Subject,
  SubjectAccuracyPoint,
  SubjectRanking,
  Topic
} from "../shared/types";

type View = "inicio" | "matriz" | "planejamento" | "foco" | "desempenho" | "biblioteca" | "avanco" | "ranking";
type Toast = { tone: "success" | "error"; message: string } | null;

const COLOR_HEX: Record<string, string> = {
  indigo: "#818cf8",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#f472b6",
  amber: "#fbbf24",
  emerald: "#34d399",
  orange: "#fb923c",
  blue: "#60a5fa"
};

const COLOR_OPTIONS = Object.keys(COLOR_HEX);
const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const today = () => new Date().toISOString().slice(0, 10);
const minutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const initialProfile: Profile = { dailyHours: 6, weeklyDays: 6, examTrack: "ITA", startDate: null, examDate: null };
const emptyMaterial: MaterialInput = {
  subjectId: null,
  topicId: null,
  title: "",
  category: "Livro",
  urlPath: null,
  status: "pendente",
  tags: [],
  front: null,
  topic: null,
  pageFocus: null,
  currentPage: 0,
  totalPages: 0,
  remindDate: null
};

export default function App() {
  const [view, setView] = useState<View>("inicio");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [ranking, setRanking] = useState<SubjectRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [subjectEditor, setSubjectEditor] = useState<Subject | null | undefined>(undefined);
  const [materialEditor, setMaterialEditor] = useState<boolean>(false);
  const [questionEditor, setQuestionEditor] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [granularity, setGranularity] = useState<PerformanceGranularity>("day");
  const [trend, setTrend] = useState<PerformancePoint[]>([]);
  const [trendSubjectId, setTrendSubjectId] = useState<number | null>(null);
  const [trendTopicId, setTrendTopicId] = useState<number | null>(null);
  const [subjectTrend, setSubjectTrend] = useState<SubjectAccuracyPoint[]>([]);
  const [focusTrend, setFocusTrend] = useState<FocusOverloadPoint[]>([]);
  const [allocations, setAllocations] = useState<DayAllocation[]>([]);
  const [memoryItems, setMemoryItems] = useState<SpacedRepetitionItem[]>([]);
  const [memorySelected, setMemorySelected] = useState<number | null>(null);
  const [memoryProjection, setMemoryProjection] = useState<MemoryDecayProjection | null>(null);
  const [retentionOverview, setRetentionOverview] = useState<RetentionOverview | null>(null);

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3600);
  };

  const recalculate = async (hours = profile.dailyHours) => {
    try {
      const next = await api.calculateSchedule(hours);
      setSchedule(next);
    } catch (error) {
      setSchedule(null);
      if (subjects.length) notify(String(error), "error");
    }
  };

  const loadApp = async () => {
    setLoading(true);
    try {
      const [nextSubjects, nextProfile, nextDashboard, nextMaterials, nextTopics] = await Promise.all([
        api.listSubjects(),
        api.getProfile(),
        api.getDashboard(),
        api.listMaterials(),
        api.listTopics()
      ]);
      setSubjects(nextSubjects);
      setProfile(nextProfile);
      setDashboard(nextDashboard);
      setMaterials(nextMaterials);
      setTopics(nextTopics);
      setRanking(await api.getPriorityRanking());
      if (nextSubjects.length) setSchedule(await api.calculateSchedule(nextProfile.dailyHours));
    } catch (error) {
      notify(`Não foi possível abrir os dados locais: ${String(error)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApp();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (demoMode) {
      setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
      setSubjectTrend([]);
      setFocusTrend(demoFocusOverloadTrend);
      setMemoryItems(demoMemoryItems);
      setMemorySelected((previous) => previous ?? demoMemoryItems[0]?.id ?? null);
      return;
    }
    api.listMemoryItems()
      .then((data) => { if (!cancelled) setMemoryItems(data); if (!cancelled && !memorySelected && data.length) setMemorySelected(data[0].id); })
      .catch(() => { if (!cancelled) setMemoryItems([]); });
    api.getPerformanceTrend(granularity, trendSubjectId, trendTopicId)
      .then((data) => { if (!cancelled) setTrend(data); })
      .catch(() => { if (!cancelled) setTrend([]); });
    api.getSubjectAccuracyTrend()
      .then((data) => { if (!cancelled) setSubjectTrend(data); })
      .catch(() => { if (!cancelled) setSubjectTrend([]); });
    api.getFocusOverloadTrend()
      .then((data) => { if (!cancelled) setFocusTrend(data); })
      .catch(() => { if (!cancelled) setFocusTrend([]); });
    api.listDayAllocations()
      .then((data) => { if (!cancelled) setAllocations(data); })
      .catch(() => { if (!cancelled) setAllocations([]); });
    return () => { cancelled = true; };
  }, [granularity, demoMode, dashboard, trendSubjectId, trendTopicId]);

  useEffect(() => {
    if (!memorySelected) {
      setMemoryProjection(null);
      return;
    }
    if (demoMode) {
      const item = memoryItems.find((entry) => entry.id === memorySelected) ?? demoMemoryItems.find((entry) => entry.id === memorySelected) ?? null;
      setMemoryProjection(item ? buildMemoryDecayProjection(item) : null);
      return;
    }
    let cancelled = false;
    api.getMemoryDecay(memorySelected)
      .then((data) => { if (!cancelled) setMemoryProjection(data); })
      .catch(() => { if (!cancelled) setMemoryProjection(null); });
    return () => { cancelled = true; };
  }, [memorySelected, demoMode, memoryItems]);

  useEffect(() => {
    let cancelled = false;
    if (demoMode) {
      setRetentionOverview(demoRetentionOverview);
      return;
    }
    api.getRetentionOverview()
      .then((data) => { if (!cancelled) setRetentionOverview(data); })
      .catch(() => { if (!cancelled) setRetentionOverview(null); });
    return () => { cancelled = true; };
  }, [demoMode, memoryItems]);

  const selectMemoryItem = (id: number) => setMemorySelected(id);

  const createMemoryItem = async (input: MemoryItemInput) => {
    try {
      if (demoMode) {
        return;
      }
      const created = await api.createMemoryItem(input);
      setMemoryItems(await api.listMemoryItems());
      setMemorySelected(created.id);
      notify("Item de memória adicionado à fila de revisão.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const deleteMemoryItem = async (id: number) => {
    if (!window.confirm(`Remover o item de memória da fila de repetição?`)) return;
    try {
      if (demoMode) {
        setMemoryItems((previous) => {
          const next = previous.filter((item) => item.id !== id);
          setMemorySelected(next[0]?.id ?? null);
          return next;
        });
        return;
      }
      await api.deleteMemoryItem(id);
      const next = await api.listMemoryItems();
      setMemoryItems(next);
      setMemorySelected(next[0]?.id ?? null);
      notify("Item removido da fila.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const reviewMemoryItem = async (id: number, grade: ReviewGrade) => {
    try {
      if (demoMode) {
        setMemoryItems((previous) => previous.map((item) => {
          if (item.id !== id) return item;
          const multiplier = { again: 0.8, hard: 1.2, good: 2.2, easy: 3.0 }[grade];
          const scale = 0.9 + (10 - Math.min(10, Math.max(1, item.difficulty))) * 0.02;
          return { ...item, stability: Math.round(item.stability * multiplier * scale * 100) / 100, reps: item.reps + 1, lastReviewDate: today(), retrievability: 1, dueDate: "" };
        }));
        return;
      }
      const updated = await api.reviewMemoryItem(id, grade);
      setMemoryItems((previous) => previous.map((item) => (item.id === id ? updated : item)));
      setMemoryProjection(await api.getMemoryDecay(id));
      notify("Revisão registrada — estabilidade rearmada.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const refreshSubjects = async () => {
    const nextSubjects = await api.listSubjects();
    setSubjects(nextSubjects);
    if (nextSubjects.length) await recalculate();
    else setSchedule(null);
    setDashboard(await api.getDashboard());
  };

  const refreshAdvance = async () => {
    setTopics(await api.listTopics());
    setMaterials(await api.listMaterials());
    setDashboard(await api.getDashboard());
  };

  const reloadAllocations = async () => {
    if (demoMode) return;
    setAllocations(await api.listDayAllocations());
  };

  const saveProfile = async () => {
    try {
      const next = await api.updateProfile(profile);
      setProfile(next);
      await recalculate(next.dailyHours);
      setDashboard(await api.getDashboard());
      notify("Configuração de carga salva.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const savePlan = async () => {
    if (!schedule || demoMode) return;
    try {
      await api.saveDailyLog(profile.dailyHours, schedule);
      notify("Planejamento de hoje salvo no histórico local.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const deleteSubject = async (subject: Subject) => {
    if (!window.confirm(`Remover “${subject.name}”? Materiais relacionados serão mantidos sem disciplina.`)) return;
    try {
      await api.deleteSubject(subject.id);
      await refreshSubjects();
      notify("Matéria removida.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const deleteMaterial = async (material: StudyMaterial) => {
    if (!window.confirm(`Remover “${material.title}”?`)) return;
    try {
      await api.deleteMaterial(material.id);
      setMaterials(await api.listMaterials());
      setDashboard(await api.getDashboard());
      notify("Material removido.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const updateMaterialStatus = async (material: StudyMaterial, status: MaterialStatus) => {
    try {
      await api.updateMaterial(material.id, { ...material, status });
      setMaterials(await api.listMaterials());
      setDashboard(await api.getDashboard());
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const effectiveSchedule = demoMode ? demoSchedule : schedule;
  const effectiveDashboard = demoMode ? demoDashboard : dashboard;
  const effectiveSubjects = demoMode ? demoSubjects : subjects;
  const effectiveTopics = demoMode ? demoTopicList : topics;
  const effectiveMaterials = demoMode ? demoMaterialList : materials;
  const executed = new Map((dashboard?.subjectPerformance ?? []).map((item) => [item.subjectId, item.studiedMinutes]));
  const focus = effectiveSchedule?.allocations[0];
  const weeklyMinutes = Math.round(profile.dailyHours * profile.weeklyDays * 60);
  const dailyData = dashboard?.dailyPerformance ?? [];
  const subjectData = dashboard?.subjectPerformance ?? [];

  return (
    <div className="app-wrap">
      <CustomTitleBar />
      <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BrainCircuit size={22} /></span><span>SOAA</span></div>
        <p className="brand-caption">Sistema Operacional<br />de Autodidatismo</p>
        <nav className="nav-list" aria-label="Navegação principal">
          <NavItem active={view === "inicio"} icon={<LayoutDashboard />} label="Visão geral" onClick={() => setView("inicio")} />
          <NavItem active={view === "matriz"} icon={<SlidersHorizontal />} label="Matriz de pesos" onClick={() => setView("matriz")} />
          <NavItem active={view === "planejamento"} icon={<CalendarDays />} label="Planejamento" onClick={() => setView("planejamento")} />
          <NavItem active={view === "foco"} icon={<Timer />} label="Foco (Deep Work)" onClick={() => setView("foco")} />
          <NavItem active={view === "desempenho"} icon={<BarChart3 />} label="Questões e gráficos" onClick={() => setView("desempenho")} />
          <NavItem active={view === "avanco"} icon={<TrendingUp />} label="Avanço" onClick={() => setView("avanco")} />
          <NavItem active={view === "ranking"} icon={<Crown />} label="Ranking" onClick={() => setView("ranking")} />
          <NavItem active={view === "biblioteca"} icon={<Library />} label="Biblioteca" onClick={() => setView("biblioteca")} />
        </nav>
        <div className="sidebar-footer">
          <span className="local-dot" /> Dados locais e privados
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{profile.examTrack} · operação de estudo</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="topbar-actions">
            <div className="load-chip"><Clock3 size={16} /><span>{profile.dailyHours}h/dia · {profile.weeklyDays} dias</span></div>
            <button className={`button demo-toggle ${demoMode ? "active" : "secondary"}`} onClick={() => setDemoMode((value) => !value)} title="Pré-visualizar com dados fictícios">
              <Sparkles size={16} /> {demoMode ? "Sair da demo" : "Ver demo"}
            </button>
            <button className="button primary" onClick={() => setQuestionEditor(true)} disabled={!subjects.length}>
              <Plus size={17} /> Lançar questões
            </button>
          </div>
        </header>

        {loading ? <Loading /> : <>
          {view === "inicio" && <Overview dashboard={effectiveDashboard} schedule={effectiveSchedule} focus={focus} onNavigate={setView} />}
          {view === "matriz" && <MatrixView schedule={effectiveSchedule} subjects={subjects} onAdd={() => setSubjectEditor(null)} onEdit={setSubjectEditor} onDelete={deleteSubject} />}
          {view === "planejamento" && <PlanningView profile={profile} schedule={effectiveSchedule} weeklyMinutes={weeklyMinutes} demo={demoMode} subjects={effectiveSubjects} onProfile={setProfile} onSaveProfile={saveProfile} onSavePlan={savePlan} allocations={demoMode ? demoDayAllocations : allocations} />}
          {view === "foco" && <FocusTimerView subjects={effectiveSubjects} materials={effectiveMaterials} demo={demoMode} />}
          {view === "desempenho" && <PerformanceView dashboard={effectiveDashboard} trend={demoMode ? demoFilteredTrend(granularity, trendSubjectId, trendTopicId) : trend} granularity={granularity} onGranularity={setGranularity} onTrendFilter={(subjectId, topicId) => { setTrendSubjectId(subjectId); setTrendTopicId(topicId); }} trendSubjectId={trendSubjectId} trendTopicId={trendTopicId} onRecord={() => setQuestionEditor(true)} subjects={effectiveSubjects} topics={effectiveTopics} schedule={effectiveSchedule} executed={executed} points={demoMode ? demoSubjectAccuracyTrend : subjectTrend} focusPoints={demoMode ? demoFocusOverloadTrend : focusTrend} memoryItems={memoryItems} memoryProjection={demoMode ? (memoryProjection ?? buildMemoryDecayProjection(demoMemoryItems[0])) : memoryProjection} overview={retentionOverview} demo={demoMode} onMemorySelect={selectMemoryItem} onMemoryCreate={createMemoryItem} onMemoryDelete={deleteMemoryItem} onMemoryReview={reviewMemoryItem} />}
          {view === "avanco" && <AdvancementView subjects={effectiveSubjects} topics={effectiveTopics} materials={effectiveMaterials} dashboard={effectiveDashboard} demo={demoMode} onChanged={refreshAdvance} />}
          {view === "ranking" && <RankingView ranking={demoMode ? demoRanking : ranking} allocations={demoMode ? demoDayAllocations : allocations} demo={demoMode} onChanged={reloadAllocations} />}
          {view === "biblioteca" && <LibraryView materials={materials} subjects={subjects} topics={topics} onAdd={() => setMaterialEditor(true)} onDelete={deleteMaterial} onStatus={updateMaterialStatus} />}
        </>}
      </main>

      {toast && <div className={`toast ${toast.tone}`}><AlertCircle size={17} />{toast.message}</div>}
      {subjectEditor !== undefined && <SubjectModal subject={subjectEditor ?? undefined} onClose={() => setSubjectEditor(undefined)} onSaved={async () => { await refreshSubjects(); setSubjectEditor(undefined); notify("Matriz atualizada."); }} />}
      {materialEditor && <MaterialModal subjects={subjects} topics={topics} onClose={() => setMaterialEditor(false)} onSaved={async () => { setMaterials(await api.listMaterials()); setDashboard(await api.getDashboard()); setMaterialEditor(false); notify("Material adicionado à biblioteca."); }} />}
      {questionEditor && <QuestionModal subjects={subjects} topics={effectiveTopics} onClose={() => setQuestionEditor(false)} onSaved={async () => { setDashboard(await api.getDashboard()); setRanking(await api.getPriorityRanking()); setQuestionEditor(false); notify("Desempenho registrado."); }} />}
      </div>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Overview({ dashboard, schedule, focus, onNavigate }: { dashboard: DashboardData | null; schedule: ScheduleResponse | null; focus: ScheduleResponse["allocations"][number] | undefined; onNavigate: (view: View) => void }) {
  const accuracy = dashboard?.questions.accuracy ?? 0;
  const hasPerformance = (dashboard?.dailyPerformance.length ?? 0) > 0;
  return <div className="page-grid overview-grid">
    <section className="hero-panel card">
      <div className="hero-orbit"><Target size={36} /></div>
      <div>
        <p className="eyebrow">Foco de maior retorno</p>
        <h2>{focus?.name ?? "Configure sua matriz"}</h2>
        <p>O teto de hoje é <strong>{focus?.formattedTime ?? "—"}</strong>. Execute o bloco, registre as questões e deixe o restante no Project Buffer.</p>
        <button className="button light" onClick={() => onNavigate("planejamento")}><CalendarDays size={16} /> Abrir plano de hoje</button>
      </div>
      <div className="focus-score"><span>IP</span><strong>{focus?.computedIp ?? 0}</strong><small>{focus?.percentage ?? 0}% do tempo</small></div>
    </section>

    <section className="metric-grid">
      <Metric icon={<Timer />} label="Carga semanal" value={minutes(dashboard?.weeklyStudyMinutes ?? 0)} helper="registrada nos últimos 7 dias" accent="indigo" />
      <Metric icon={<Trophy />} label="Acerto global" value={`${accuracy}%`} helper={`${dashboard?.questions.correct ?? 0} de ${dashboard?.questions.total ?? 0} questões`} accent="emerald" />
      <Metric icon={<BookOpen />} label="Biblioteca" value={`${dashboard?.materials.completed ?? 0}/${dashboard?.materials.total ?? 0}`} helper="materiais concluídos" accent="amber" />
      <Metric icon={<BrainCircuit />} label="Matérias ativas" value={`${dashboard?.subjectsCount ?? 0}`} helper="índices calculados ao vivo" accent="pink" />
    </section>

    <section className="card chart-card wide">
      <div className="section-heading"><div><p className="eyebrow">Evolução</p><h2>Acerto por dia</h2></div><LineChart size={20} /></div>
      {hasPerformance ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={dashboard?.dailyPerformance}><CartesianGrid stroke="#203044" strokeDasharray="4 4" /><XAxis dataKey="date" tick={{ fill: "#9aabc0", fontSize: 11 }} tickFormatter={(date) => date.slice(5)} /><YAxis domain={[0, 100]} tick={{ fill: "#9aabc0", fontSize: 11 }} unit="%" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="accuracy" stroke="#8b7cf6" strokeWidth={3} dot={{ fill: "#b5a9ff", r: 4 }} /></RechartsLineChart></ResponsiveContainer></div> : <EmptyState icon={<LineChart />} text="Ainda não há lançamentos. Registre um bloco de questões para iniciar seu gráfico." />}
    </section>

    <section className="card allocation-card">
      <div className="section-heading"><div><p className="eyebrow">Matriz de hoje</p><h2>Distribuição de tempo</h2></div><button className="text-button" onClick={() => onNavigate("matriz")}>Editar</button></div>
      <div className="allocation-list">
        {schedule?.allocations.slice(0, 5).map((item) => <div className="allocation-row" key={item.id}><span className="color-dot" style={{ background: color(item.color) }} /><span className="allocation-name">{item.name}</span><span>{item.formattedTime}</span></div>)}
        {!schedule && <EmptyState icon={<SlidersHorizontal />} text="Cadastre uma matéria para gerar a matriz." />}
      </div>
    </section>
  </div>;
}

function MatrixView({ schedule, subjects, onAdd, onEdit, onDelete }: { schedule: ScheduleResponse | null; subjects: Subject[]; onAdd: () => void; onEdit: (subject: Subject) => void; onDelete: (subject: Subject) => void }) {
  return <div className="page-stack">
    <section className="card matrix-intro"><div><p className="eyebrow">Motor de priorização ponderada</p><h2>IP = peso estratégico × dificuldade pessoal</h2><p>Os tempos são tetos máximos. Todo bloco é arredondado para cinco minutos sem estourar sua carga; a diferença fica no Project Buffer.</p></div><button className="button primary" onClick={onAdd}><Plus size={17} /> Nova matéria</button></section>
    <section className="card table-card">
      <div className="table-wrap"><table><thead><tr><th>Matéria / frente</th><th>Peso</th><th>Dificuldade</th><th>IP</th><th>Teto (timebox)</th><th>Participação</th><th aria-label="Ações" /></tr></thead>
        <tbody>{schedule?.allocations.map((item) => <tr key={item.id}><td><span className="subject-cell"><span className="color-dot" style={{ background: color(item.color) }} />{item.name}</span></td><td><span className="number-badge">{item.weight}</span></td><td><span className="number-badge muted">{item.difficulty}</span></td><td><strong className="ip-badge">{item.computedIp}</strong></td><td><strong className="time-value">{item.formattedTime}</strong></td><td><div className="progress-inline"><span style={{ width: `${item.percentage}%`, background: color(item.color) }} /><small>{item.percentage}%</small></div></td><td className="actions"><button className="icon-button" title="Editar" onClick={() => onEdit(item)}><Pencil size={16} /></button><button className="icon-button danger" title="Remover" onClick={() => onDelete(item)}><Trash2 size={16} /></button></td></tr>)}</tbody>
        {schedule && <tfoot><tr><td colSpan={3}>TOTAL DO SISTEMA</td><td>{schedule.totalIp}</td><td>{minutes(schedule.totalMinutes)}</td><td colSpan={2}>Buffer: <strong>{schedule.formattedProjectBuffer}</strong></td></tr></tfoot>}
      </table></div>
      {!subjects.length && !schedule && <EmptyState icon={<SlidersHorizontal />} text="Sua matriz está vazia." action={<button className="button primary" onClick={onAdd}>Adicionar primeira matéria</button>} />}
    </section>
  </div>;
}

function PlanningView({ profile, schedule, weeklyMinutes, demo, subjects, onProfile, onSaveProfile, onSavePlan, allocations }: { profile: Profile; schedule: ScheduleResponse | null; weeklyMinutes: number; demo: boolean; subjects: Subject[]; onProfile: (profile: Profile) => void; onSaveProfile: () => void; onSavePlan: () => void; allocations: DayAllocation[] }) {
  const trackOptions = ["Ensino Médio", "ENEM", "ITA", "IME", "Personalizado"];
  const byDay: DayAllocation[][] = Array.from({ length: 7 }, () => []);
  for (const allocation of allocations) byDay[allocation.weekday].push(allocation);
  const [wizard, setWizard] = useState(false);
  return <div className="page-stack">
    <section className="card settings-card"><div className="section-heading"><div><p className="eyebrow">Capacidade real</p><h2>Configure sua semana</h2></div><div className="heading-actions"><button className="button ghost" onClick={() => setWizard(true)}><CalendarCheck size={16} /> Rota da prova</button><button className="button primary" onClick={onSaveProfile}><Save size={16} /> Salvar configuração</button></div></div>
      <div className="setting-fields"><label>Horas líquidas por dia<input type="number" min="0.5" max="24" step="0.5" value={profile.dailyHours} onChange={(event) => onProfile({ ...profile, dailyHours: Number(event.target.value) })} /></label><label>Dias de estudo/semana<select value={profile.weeklyDays} onChange={(event) => onProfile({ ...profile, weeklyDays: Number(event.target.value) })}>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={day}>{day} dias</option>)}</select></label><label>Trilha principal<select value={profile.examTrack} onChange={(event) => onProfile({ ...profile, examTrack: event.target.value as Profile["examTrack"] })}>{trackOptions.map((track) => <option key={track}>{track}</option>)}</select></label><div className="weekly-total"><span>Tempo semanal planejado</span><strong>{minutes(weeklyMinutes)}</strong></div></div>
    </section>
    <section className="card schedule-card"><div className="section-heading"><div><p className="eyebrow">Plano diário de execução</p><h2>Timeboxes inegociáveis</h2></div>{schedule && <button className="button secondary" onClick={onSavePlan} disabled={demo} title={demo ? "Desativado no modo demonstração" : undefined}><Save size={16} /> Salvar hoje</button>}</div>
      {schedule ? <><div className="timeline">{schedule.allocations.map((item) => <div className="timeline-item" key={item.id}><div className="timeline-color" style={{ background: color(item.color) }} /><div className="timeline-main"><div><strong>{item.name}</strong><span>IP {item.computedIp} · {item.percentage}% da carga</span></div><b>{item.formattedTime}</b></div><div className="timeline-track"><span style={{ width: `${item.percentage}%`, background: color(item.color) }} /></div><small>Semana: {minutes(item.allocatedMinutes * profile.weeklyDays)} em {profile.weeklyDays} blocos</small></div>)}</div><div className="buffer-box"><Zap size={20} /><div><strong>Project Buffer: {schedule.formattedProjectBuffer}</strong><span>Reserva técnica para imprevistos ou tópicos transferidos. Não redistribua antes de executar a matriz.</span></div></div></> : <EmptyState icon={<CalendarDays />} text="Adicione matérias à matriz para montar o plano." />}
    </section>
    <section className="card reinforcement-card">
      <div className="section-heading"><div><p className="eyebrow">Foco de recuperação</p><h2>Reforço da semana</h2></div><CalendarCheck size={20} /></div>
      {allocations.length ? <div className="reinforce-week">{WEEKDAY_NAMES.map((dayName, index) => <div className="reinforce-day" key={dayName}><span className="reinforce-day-label">{dayName}</span>{byDay[index].length ? byDay[index].map((a) => <div className="reinforce-chip" key={a.id} title={a.note ?? undefined}><i style={{ background: color(a.color) }} />{a.subjectName.split("·")[0].trim()}<b>{minutes(a.minutes)}</b></div>) : <span className="muted-text">—</span>}</div>)}</div> : <p className="cogn-empty">Nenhum reforço alocado. Vá na aba Ranking e clique em <em>Gerenciar</em> numa matéria para fixar seu dia de recuperação.</p>}
    </section>
    <RescheduleTriagePanel demo={demo} />
    {wizard && <PlanWizard demo={demo} subjects={subjects} profile={profile} onClose={() => setWizard(false)} />}
  </div>;
}

const trendTick = (raw: string | number, granularity: PerformanceGranularity) => {
  const label = String(raw);
  if (granularity === "week") return label.startsWith("Sem.") ? label : `Sem. ${label}`;
  return label;
};

function TrendTooltip({ active, payload, label, granularity }: { active?: boolean; payload?: Array<{ payload?: PerformancePoint }>; label?: string | number; granularity: PerformanceGranularity }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const period = granularity === "year" ? `Ano ${label}` : granularity === "month" ? `Mês ${label}` : `Período ${label}`;
  return (
    <div className="chart-tooltip">
      <strong>{period}</strong>
      <span>Taxa de acerto: <b>{point.accuracy}%</b></span>
      <span>Questões corretas: <b>{point.questionsCorrect}</b> de {point.questionsTotal}</span>
      <small>{point.questionsTotal ? `${Math.round(point.questionsCorrect / point.questionsTotal * 100)}% de aproveitamento no período` : "sem lançamentos no período"}</small>
    </div>
  );
}

function PerformanceView({ dashboard, trend, granularity, onGranularity, onTrendFilter, trendSubjectId, trendTopicId, onRecord, subjects, topics, schedule, executed, points, focusPoints, memoryItems, memoryProjection, overview, demo, onMemorySelect, onMemoryCreate, onMemoryDelete, onMemoryReview }: { dashboard: DashboardData | null; trend: PerformancePoint[]; granularity: PerformanceGranularity; onGranularity: (granularity: PerformanceGranularity) => void; onTrendFilter: (subjectId: number | null, topicId: number | null) => void; trendSubjectId: number | null; trendTopicId: number | null; onRecord: () => void; subjects: Subject[]; topics: Topic[]; schedule: ScheduleResponse | null; executed: Map<number, number>; points: SubjectAccuracyPoint[]; focusPoints: FocusOverloadPoint[]; memoryItems: SpacedRepetitionItem[]; memoryProjection: MemoryDecayProjection | null; overview: RetentionOverview | null; demo: boolean; onMemorySelect: (id: number) => void; onMemoryCreate: (input: MemoryItemInput) => void; onMemoryDelete: (id: number) => void; onMemoryReview: (id: number, grade: ReviewGrade) => void }) {
  const data = dashboard?.subjectPerformance ?? [];
  const usefulData = data.filter((item) => item.questionsTotal > 0);
  const hasTrend = trend.length > 0;
  const minAccuracy = hasTrend ? Math.max(0, Math.min(...trend.map((item) => item.accuracy)) - 5) : 0;
  const maxAccuracy = hasTrend ? Math.min(100, Math.max(...trend.map((item) => item.accuracy)) + 5) : 100;
  const granularityLabels: Record<PerformanceGranularity, string> = { day: "Dia", week: "Semana", month: "Mês", year: "Ano" };
  return <div className="page-stack">
    <section className="card performance-hero"><div><p className="eyebrow">Feedback de ciclo curto</p><h2>Questões mostram onde a matriz precisa agir.</h2><p>Registre o resultado de um bloco. Você acompanha acerto por disciplina e usa a dificuldade pessoal para recalibrar o IP.</p></div><button className="button primary" onClick={onRecord}><Plus size={17} /> Registrar desempenho</button></section>
    <section className="card chart-card">
      <div className="section-heading"><div><p className="eyebrow">Melhoria ao longo do tempo</p><h2>Evolução do acerto</h2></div><div className="segmented" role="tablist" aria-label="Agrupamento temporal">{(["day", "week", "month", "year"] as PerformanceGranularity[]).map((option) => <button key={option} className={granularity === option ? "active" : ""} onClick={() => onGranularity(option)}>{granularityLabels[option]}</button>)}</div></div>
      <div className="trend-filters">
        <select value={trendSubjectId ?? ""} onChange={(event) => { const subjectId = event.target.value ? Number(event.target.value) : null; onTrendFilter(subjectId, null); }} title="Recorte da evolução: todas as matérias, uma matéria ou uma área dentro dela">
          <option value="">Média geral · todas as matérias</option>
          {subjects.map((item) => <option key={item.id} value={item.id}>{item.name.split("·")[0].trim()}</option>)}
        </select>
        {trendSubjectId !== null && (
          <select value={trendTopicId ?? ""} onChange={(event) => onTrendFilter(trendSubjectId, event.target.value ? Number(event.target.value) : null)} title="Área dentro da matéria (nicho)">
            <option value="">Toda a matéria (áreas somadas)</option>
            {topics.filter((topic) => topic.subjectId === trendSubjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        )}
        {trendSubjectId !== null && <button className="trend-clear" onClick={() => onTrendFilter(null, null)}>Limpar recorte</button>}
      </div>
      {hasTrend ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cf6" stopOpacity={0.45} /><stop offset="100%" stopColor="#8b7cf6" stopOpacity={0.04} /></linearGradient></defs><CartesianGrid stroke="#203044" strokeDasharray="4 4" /><XAxis dataKey="label" tick={{ fill: "#9aabc0", fontSize: 11 }} interval="preserveStartEnd" minTickGap={22} tickFormatter={(label) => trendTick(label, granularity)} /><YAxis yAxisId="left" domain={[minAccuracy, maxAccuracy]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} width={38} /><YAxis yAxisId="right" orientation="right" domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} tick={{ fill: "#77899f", fontSize: 11 }} tickCount={4} /><Tooltip content={<TrendTooltip granularity={granularity} />} contentStyle={tooltipStyle} cursor={{ stroke: "#334760", strokeDasharray: "4 4" }} /><ReferenceLine yAxisId="left" y={70} stroke="#fbbf24" strokeDasharray="6 3" label={{ value: "Meta 70%", position: "insideTopLeft", fill: "#fbbf24", fontSize: 10 }} /><Area yAxisId="left" type="monotone" dataKey="accuracy" name="Taxa de acerto" stroke="#8b7cf6" strokeWidth={3} fill="url(#trendFill)" dot={{ fill: "#b5a9ff", r: 3 }} activeDot={{ r: 5 }} /><Bar yAxisId="right" dataKey="questionsTotal" name="Volume de questões" fill="#2b3e57" radius={[5, 5, 0, 0]} barSize={7} /></ComposedChart></ResponsiveContainer></div> : <EmptyState icon={<LineChart />} text="Registre blocos de questões para visualizar a evolução do seu acerto por dia, semana, mês e ano." />}
    </section>
    <DayCompareChart points={points} />
    <RetentionGraphBoard overview={overview} demo={demo} />
    <section className="metric-grid"><Metric icon={<Target />} label="Total de questões" value={`${dashboard?.questions.total ?? 0}`} helper="todas as disciplinas" accent="indigo" /><Metric icon={<CheckCircle2 />} label="Acertos" value={`${dashboard?.questions.correct ?? 0}`} helper="respostas corretas" accent="emerald" /><Metric icon={<Trophy />} label="Taxa global" value={`${dashboard?.questions.accuracy ?? 0}%`} helper="média ponderada pelos itens" accent="amber" /><Metric icon={<Timer />} label="Tempo registrado" value={minutes(dashboard?.weeklyStudyMinutes ?? 0)} helper="últimos 7 dias" accent="pink" /></section>
    <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Diagnóstico por disciplina</p><h2>Taxa de acerto</h2></div><BarChart3 size={20} /></div>{usefulData.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={usefulData}><CartesianGrid stroke="#203044" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="subjectName" tick={{ fill: "#9aabc0", fontSize: 11 }} tickFormatter={(name) => name.split("·")[0].trim()} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="accuracy" radius={[6,6,0,0]}>{usefulData.map((entry) => <Cell key={entry.subjectId} fill={color(entry.color)} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState icon={<BarChart3 />} text="Seu gráfico aparecerá depois do primeiro lançamento de questões." />}</section>
    <section className="card table-card"><div className="section-heading"><div><p className="eyebrow">Tabela de diagnóstico</p><h2>Desempenho acumulado</h2></div></div><div className="table-wrap"><table><thead><tr><th>Disciplina</th><th>Questões</th><th>Acertos</th><th>Taxa</th><th>Tempo</th></tr></thead><tbody>{data.map((item) => <tr key={item.subjectId}><td><span className="subject-cell"><span className="color-dot" style={{ background: color(item.color) }} />{item.subjectName}</span></td><td>{item.questionsTotal}</td><td>{item.questionsCorrect}</td><td><strong className={item.accuracy >= 70 ? "good" : item.accuracy > 0 ? "needs-work" : "muted-text"}>{item.accuracy}%</strong></td><td>{minutes(item.studiedMinutes)}</td></tr>)}</tbody></table></div></section>
    {subjects.length ? <CognitiveCharts subjects={subjects} topics={topics} schedule={schedule} executed={executed} points={points} focusPoints={focusPoints} memoryItems={memoryItems} memoryProjection={memoryProjection} demo={demo} onMemorySelect={onMemorySelect} onMemoryCreate={onMemoryCreate} onMemoryDelete={onMemoryDelete} onMemoryReview={onMemoryReview} /> : null}
  </div>;
}

function DayCompareChart({ points }: { points: SubjectAccuracyPoint[] }) {
  const dates = useMemo(() => {
    const byDate = new Map<string, SubjectAccuracyPoint[]>();
    for (const point of points) {
      const list = byDate.get(point.date) ?? [];
      list.push(point);
      byDate.set(point.date, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([date, items]) => ({ date, items }));
  }, [points]);
  const last = dates[dates.length - 1];
  const previous = dates[dates.length - 2];
  const [dayA, setDayA] = useState(previous?.date ?? "");
  const [dayB, setDayB] = useState(last?.date ?? "");
  const setA = dates.find((d) => d.date === dayA) ?? previous;
  const setB = dates.find((d) => d.date === dayB) ?? last;
  if (!setA || !setB || dates.length < 2) return null;
  const bySubjectB = new Map(setB.items.map((item) => [item.subjectId, item]));
  const rows = setA.items.map((item) => {
    const counterpart = bySubjectB.get(item.subjectId);
    return counterpart ? { subjectId: item.subjectId, subjectName: item.subjectName, color: item.color, accuracyA: item.accuracy, accuracyB: counterpart.accuracy, delta: Math.round((counterpart.accuracy - item.accuracy) * 10) / 10 } : null;
  }).filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const label = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <section className="card chart-card">
      <div className="section-heading"><div><p className="eyebrow">Feedback de ciclo curto</p><h2>Comparativo de dois dias</h2></div><div className="segmented day-pair"><label>Dia A<select value={setA.date} onChange={(event) => setDayA(event.target.value)}>{dates.map((d) => <option key={d.date} value={d.date}>{label(d.date)}</option>)}</select></label><label>Dia B<select value={setB.date} onChange={(event) => setDayB(event.target.value)}>{dates.map((d) => <option key={d.date} value={d.date}>{label(d.date)}</option>)}</select></label></div></div>
      <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} barGap={3}><CartesianGrid stroke="#203044" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="subjectName" tick={{ fill: "#9aabc0", fontSize: 10 }} tickFormatter={(name: string) => name.split("·")[0].trim()} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="accuracyA" name={`Dia A · ${label(setA.date)}`} radius={[5, 5, 0, 0]} fillOpacity={0.95}>{rows.map((row) => <Cell key={`${row.subjectId}-a`} fill={color(row.color)} />)}</Bar><Bar dataKey="accuracyB" name={`Dia B · ${label(setB.date)}`} radius={[5, 5, 0, 0]} fillOpacity={0.32}>{rows.map((row) => <Cell key={`${row.subjectId}-b`} fill={color(row.color)} />)}</Bar></BarChart></ResponsiveContainer></div>
      {rows.length > 0 && <div className="day-deltas">{rows.map((row) => <span key={row.subjectId} className={`day-delta ${row.delta >= 0 ? "up" : "down"}`}><i style={{ background: color(row.color) }} />{row.subjectName.split("·")[0].trim()}<b>{row.delta >= 0 ? "+" : ""}{row.delta}%</b></span>)}</div>}
    </section>
  );
}

function PlanWizard({ demo, subjects, profile, onClose }: { demo: boolean; subjects: Subject[]; profile: Profile; onClose: () => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PlanInput>({ startDate: todayIso, examDate: profile.examDate ?? todayIso, totalHours: profile.dailyHours * profile.weeklyDays });
  const [selected, setSelected] = useState<Set<number>>(new Set(subjects.slice(0, 2).map((s) => s.id)));
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [generating, setGenerating] = useState(false);

  const toggle = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const weeksLeft = form.examDate && form.startDate && form.examDate > form.startDate ? Math.max(1, Math.round((new Date(form.examDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7))) : 1;

  const generate = async () => {
    if (!selected.size) return;
    setGenerating(true);
    if (demo) {
      window.setTimeout(() => { setPlan(demoPlan); setStep(2); setGenerating(false); }, 550);
      return;
    }
    try {
      setPlan(await api.getStudyPlan({ ...form, totalHours: Number(form.totalHours) || profile.dailyHours * profile.weeklyDays }));
      setStep(2);
    } catch { setGenerating(false); }
  };

  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wizard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title"><div>{step < 2 ? <p className="eyebrow">Rota de prova · cronograma reverso</p> : <p className="eyebrow">Rota pronta</p>}<h2>{step === 0 ? "Defina a linha de chegada" : step === 1 ? "Escolha os focos de ataque" : "Semanas até a prova"}</h2></div><button className="icon-button" title="Fechar" onClick={onClose}><X size={16} /></button></div>
        <div className="wizard-steps"><span className={step >= 0 ? "active" : ""}>1 · Meta</span><span className={step >= 1 ? "active" : ""}>2 · Focos</span><span className={step >= 2 ? "active" : ""}>3 · Rotina</span></div>

        {step === 0 && <div className="form-stack">
          <div className="form-two"><label>Data da prova<input type="date" value={form.examDate} onChange={(event) => setForm((prev) => ({ ...prev, examDate: event.target.value }))} /></label><label>Início da rota<input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} /></label></div>
          <label>Horas líquidas de estudo por dia<input type="number" min="0.5" max="16" step="0.5" value={Math.round(form.totalHours / Math.max(profile.weeklyDays, 1) * 10) / 10} onChange={(event) => setForm((prev) => ({ ...prev, totalHours: Number(event.target.value) * Math.max(profile.weeklyDays, 1) }))} /></label>
          <p className="form-hint">Você tem <strong>{weeksLeft} semanas</strong>. O motor distribui os blocos priorizando a janela matinal de maior resistência à procrastinação e reserva tempo de revisão nas semanas finais.</p>
          <div className="modal-actions"><button className="button primary" onClick={() => setStep(1)}>Continuar <ArrowRight size={15} /></button></div>
        </div>}

        {step === 1 && <div className="form-stack">
          <p className="form-hint">Quais disciplinas entram na <strong>fase de ataque</strong>? Elas recebem os blocos principais; o restante fica em manutenção via Project Buffer.</p>
          <div className="subject-grid">{subjects.map((subject) => <button key={subject.id} className={`subject-tile ${selected.has(subject.id) ? "active" : ""}`} onClick={() => toggle(subject.id)}><i style={{ background: color(subject.color) }} />{subject.name.split("·")[0].trim()}<small>peso {subject.weight} · dificuldade {subject.difficulty}</small></button>)}</div>
          {!subjects.length && <p className="cogn-empty">Adicione matérias na aba Matriz antes de montar a rota.</p>}
          <div className="modal-actions"><button className="button ghost" onClick={() => setStep(0)}>Voltar</button><button className="button primary" onClick={generate} disabled={!selected.size || generating}>{generating ? <TimerReset size={15} /> : <Sparkles size={15} />} {generating ? "Montando rota…" : "Gerar rota"}</button></div>
        </div>}

        {step === 2 && plan && <div className="form-stack">
          {plan.riskName && <div className="cog-alert warning"><AlertTriangle size={16} /><div><strong>Matéria de maior risco: {plan.riskName.split("·")[0].trim()}.</strong><span>Recebe a primeira janela matinal — o período de menor resistência à procrastinação.</span></div></div>}
          <div className="focus-summary-row"><div><strong>{plan.weeks}</strong><span>semanas até a prova</span></div><div><strong>{plan.days.length}</strong><span>dias na rota</span></div><div><strong>{Math.max(1, plan.days[0]?.focusSubjects.length ?? 0)}</strong><span>focos por dia</span></div></div>
          <div className="plan-days">{plan.days.slice(0, 7).map((day: PlanDay) => <div className="plan-day" key={day.date}><span className="plan-day-date">{dayLabel(day.date)}</span><span className="plan-day-name">{day.weekdayLabel}</span><div className="plan-day-focus">{day.focusSubjects.map((focus: PlanFocus) => <span className="plan-chip" key={`${day.date}-${focus.subjectId}`}><i style={{ background: color(focus.color) }} />{focus.subjectName.split("·")[0].trim()}<b>{focus.minutes}m</b><em>{focus.slot}</em></span>)}</div></div>)}</div>
          <p className="cogn-footnote"><CalendarCheck size={14} /> O bloco de maior risco abre o dia nos primeiros 7 dias; após isso o motor alterna para manter o intervalo entre matérias em até 2 dias.</p>
          <div className="modal-actions"><button className="button ghost" onClick={() => setStep(1)}>Voltar</button><button className="button primary" onClick={onClose}><CheckCircle2 size={15} /> Concluir</button></div>
        </div>}
      </div>
    </div>
  );
}

function LibraryView({ materials, subjects, topics, onAdd, onDelete, onStatus }: { materials: StudyMaterial[]; subjects: Subject[]; topics: Topic[]; onAdd: () => void; onDelete: (material: StudyMaterial) => void; onStatus: (material: StudyMaterial, status: MaterialStatus) => void }) {
  const [strategies, setStrategies] = useState<MaterialStrategy[]>([]);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));

  useEffect(() => {
    if (!materials.length) return;
    api.listMaterialStrategies().then(setStrategies).catch(() => undefined);
  }, [materials.length]);

  const strategyFor = useMemo(() => {
    const byKeyword = new Map<string, MaterialStrategy>();
    for (const strategy of strategies) for (const keyword of strategy.keywords.toLowerCase().split(/[\s,;|]+/)) if (keyword) byKeyword.set(keyword, strategy);
    return (material: StudyMaterial) => {
      const haystack = `${material.title} ${material.tags.join(" ")}`.toLowerCase();
      for (const [keyword, strategy] of byKeyword.entries()) if (haystack.includes(keyword)) return strategy;
      return null;
    };
  }, [strategies]);

  return <div className="page-stack"><section className="card library-header"><div><p className="eyebrow">Curadoria técnica</p><h2>Biblioteca de materiais</h2><p>Vincule livros, PDFs, cursos e listas à disciplina e ao tópico que eles fortalecem.</p></div><button className="button primary" onClick={onAdd}><FolderPlus size={17} /> Cadastrar material</button></section>{materials.length ? <><section className="material-grid">{materials.map((material) => { const subject = subjects.find((item) => item.id === material.subjectId); const topic = material.topicId ? topicById.get(material.topicId) : undefined; const pagePercent = material.totalPages ? Math.min(100, Math.round(material.currentPage / material.totalPages * 100)) : null; return <article className="material-card card" key={material.id}><div className="material-top"><span className="material-category">{material.category}</span><button className="icon-button danger" title="Remover material" onClick={() => onDelete(material)}><Trash2 size={16} /></button></div><h3>{material.title}</h3><p className="material-subject">{subject ? subject.name : "Sem disciplina vinculada"}{topic ? ` · ${topic.name}` : ""}</p><div className="tags">{material.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>{pagePercent !== null && <div className="page-track"><div className="page-track-row"><span>Leitura</span><small>{material.currentPage} / {material.totalPages} págs · {pagePercent}%</small></div><div className="progress-inline"><span style={{ width: `${pagePercent}%`, background: subject ? color(subject.color) : "#60a5fa" }} /></div></div>}<div className="material-footer"><select value={material.status} onChange={(event) => onStatus(material, event.target.value as MaterialStatus)}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluido">Concluído</option></select>{material.urlPath && <span className="path-hint" title={material.urlPath}>Link salvo</span>}</div></article>; })}</section>{strategies.length > 0 && <section className="card strategy-section"><div className="section-heading"><div><p className="eyebrow">Estratégias sugeridas</p><h2>Como estudar cada material</h2><p className="cogn-footnote">O matching usa palavras-chave curradas no cadastro — <em>interleaving</em>, <em>spaced repetition</em>, <em>active recall</em>, <em>quesões</em>, <em>teoria</em>.</p></div><BrainCog size={20} /></div><div className="strategy-grid">{materials.map((material) => { const subject = subjects.find((item) => item.id === material.subjectId); const strategy = strategyFor(material); return strategy ? <div className="strategy-card" key={material.id}><span className="color-dot" style={{ background: subject ? color(subject.color) : "#60a5fa" }} /><div><strong>{material.title}</strong><span>{strategy.tactic}</span><small>{strategy.reason}</small></div><span className={`strategy-badge ${strategy.intensity}`}>{strategy.intensity}</span></div> : null; })}</div></section>}</> : <EmptyState icon={<FolderPlus />} text="Sua biblioteca está vazia. Cadastre seu primeiro material." action={<button className="button primary" onClick={onAdd}><FolderPlus size={17} /> Cadastrar material</button>} />}</div>;
}

function Metric({ icon, label, value, helper, accent }: { icon: ReactNode; label: string; value: string; helper: string; accent: string }) {
  return <article className={`metric card ${accent}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function SubjectModal({ subject, onClose, onSaved }: { subject?: Subject; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<SubjectInput>({ name: subject?.name ?? "", weight: subject?.weight ?? 3, difficulty: subject?.difficulty ?? 3, color: subject?.color ?? "indigo" });
  const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { if (subject) await api.updateSubject(subject.id, form); else await api.createSubject(form); await onSaved(); } catch (error) { window.alert(String(error)); } finally { setSaving(false); } };
  return <Modal title={subject ? "Editar matéria" : "Nova matéria"} onClose={onClose}><form onSubmit={save} className="form-stack"><label>Matéria ou frente de estudo<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Matemática · Geometria" /></label><div className="form-two"><label>Peso estratégico<select value={form.weight} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Dificuldade pessoal<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: Number(event.target.value) })}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label>Cor de identificação<div className="color-select">{COLOR_OPTIONS.map((name) => <button type="button" aria-label={name} key={name} className={form.color === name ? "selected" : ""} style={{ background: color(name) }} onClick={() => setForm({ ...form, color: name })} />)}</div></label><p className="form-hint">IP calculado: <strong>{form.weight * form.difficulty}</strong>. Quanto maior o IP, maior o teto de tempo.</p><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar matéria"}</button></div></form></Modal>;
}

function MaterialModal({ subjects, topics, onClose, onSaved }: { subjects: Subject[]; topics: Topic[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<MaterialInput>(emptyMaterial); const [tags, setTags] = useState(""); const [saving, setSaving] = useState(false);
  const subjectTopics = topics.filter((topic) => topic.subjectId === form.subjectId);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await api.createMaterial({ ...form, urlPath: form.urlPath?.trim() || null, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }); await onSaved(); } catch (error) { window.alert(String(error)); } finally { setSaving(false); } };
  return <Modal title="Cadastrar material" onClose={onClose}><form onSubmit={save} className="form-stack"><label>Título<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Fundamentos da Matemática" /></label><div className="form-two"><label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Livro</option><option>PDF / Apostila</option><option>Curso</option><option>Lista de exercícios</option><option>Vídeo / Aula</option><option>Outro</option></select></label><label>Disciplina<select value={form.subjectId ?? ""} onChange={(event) => setForm({ ...form, subjectId: event.target.value ? Number(event.target.value) : null, topicId: null })}><option value="">Sem vínculo</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label>Tópico da matéria (opcional)<select value={form.topicId ?? ""} onChange={(event) => setForm({ ...form, topicId: event.target.value ? Number(event.target.value) : null })} disabled={!form.subjectId}><option value="">Sem tópico — cadastre na aba Avanço</option>{subjectTopics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-two"><label>Página atual (opcional)<input type="number" min="0" value={form.currentPage} onChange={(event) => setForm({ ...form, currentPage: Math.max(0, Number(event.target.value)) })} /></label><label>Total de páginas (opcional)<input type="number" min="0" value={form.totalPages} onChange={(event) => setForm({ ...form, totalPages: Math.max(0, Number(event.target.value)) })} /></label></div><label>Link ou caminho (opcional)<input value={form.urlPath ?? ""} onChange={(event) => setForm({ ...form, urlPath: event.target.value })} placeholder="https://... ou /pasta/arquivo.pdf" /></label><label>Tags separadas por vírgula<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="álgebra, teoria, lista 01" /></label>{form.pageFocus && <p className="form-hint">Foco de revisão salvo: <strong>{form.pageFocus}</strong></p>}<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Adicionar material"}</button></div></form></Modal>;
}

function QuestionModal({ subjects, topics, onClose, onSaved }: { subjects: Subject[]; topics: Topic[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<QuestionResultInput>({ subjectId: subjects[0]?.id ?? 0, topicId: null, date: today(), questionsTotal: 20, questionsCorrect: 0, studiedMinutes: 60 }); const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await api.recordQuestionResult(form); await onSaved(); } catch (error) { window.alert(String(error)); } finally { setSaving(false); } };
  return <Modal title="Lançar bloco de questões" onClose={onClose}><form onSubmit={save} className="form-stack"><label>Disciplina<select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: Number(event.target.value), topicId: null })}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Área dentro da matéria (opcional)<select value={form.topicId ?? ""} disabled={!topics.some((topic) => topic.subjectId === form.subjectId)} onChange={(event) => setForm({ ...form, topicId: event.target.value ? Number(event.target.value) : null })}>{topics.some((topic) => topic.subjectId === form.subjectId) ? [<option key="none" value="">Toda a matéria</option>, ...topics.filter((topic) => topic.subjectId === form.subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)] : [<option key="none" value="">Sem áreas nesta matéria</option>]}</select></label><div className="form-two"><label>Data<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Tempo de estudo (min)<input type="number" min="0" value={form.studiedMinutes} onChange={(event) => setForm({ ...form, studiedMinutes: Number(event.target.value) })} /></label><label>Total de questões<input type="number" min="1" value={form.questionsTotal} onChange={(event) => setForm({ ...form, questionsTotal: Number(event.target.value) })} /></label><label>Acertos<input type="number" min="0" max={form.questionsTotal} value={form.questionsCorrect} onChange={(event) => setForm({ ...form, questionsCorrect: Number(event.target.value) })} /></label></div><p className="form-hint">Taxa do bloco: <strong>{form.questionsTotal ? Math.round(form.questionsCorrect / form.questionsTotal * 100) : 0}%</strong></p><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Registrar resultado"}</button></div></form></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</section></div>; }
function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) { return <div className="empty-state"><div>{icon}</div><p>{text}</p>{action}</div>; }
function Loading() { return <div className="loading"><div className="loading-mark"><BrainCircuit size={28} /></div><span>Abrindo seu sistema de estudos…</span></div>; }
function titleFor(view: View) { return ({ inicio: "Visão geral", matriz: "Matriz de priorização", planejamento: "Planejamento semanal", foco: "Foco · Deep Work", desempenho: "Desempenho", avanco: "Avanço por matéria", ranking: "Ranking de prioridade", biblioteca: "Biblioteca" })[view]; }
function color(name: string) { return COLOR_HEX[name] ?? COLOR_HEX.blue; }
const tooltipStyle = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff" };
