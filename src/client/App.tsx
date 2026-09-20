import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  BrainCog,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Crown,
  FolderPlus,
  LayoutDashboard,
  Library,
  LineChart,
  Pencil,
  Plus,
  Save,
  Settings,
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
import { color, COLOR_OPTIONS } from "./colors";
import { PlanWizard } from "./wizard";
import { RescheduleTriagePanel } from "./triage";
import { CATALOG_GROUPS, CATALOG_GROUP_HINTS, CATALOG_GROUP_LABELS, catalogSubjects, type CatalogGroup } from "./catalog";
import {
  addDaysIso,
  buildMemoryDecayProjection,
  demoDashboard,
  demoDayAllocations,
  demoFilteredTrend,
  demoFocusOverloadTrend,
  demoMaterialList,
  demoMemoryItems,
  demoProfile,
  demoRanking,
  demoRetentionLivestream,
  demoRetentionOverview,
  demoMaterialStrategies,
  demoSchedule,
  demoSubjects,
  demoSubjectAccuracyTrend,
  demoTopicList
} from "./demo";
import { CognitiveCharts } from "./cognitive";
import { RetentionGraphBoard } from "./retention";
import { AdvancementView } from "./advancement";
import { RankingView } from "./ranking";
import { FocusTimerView } from "./focus";
import { CustomTitleBar } from "./TitleBar";
import type {
  ConsolidatedPerformanceReport,
  DashboardData,
  DayAllocation,
  FocusOverloadPoint,
  MaterialStatus,
  MaterialStrategy,
  MemoryDecayProjection,
  MemoryItemInput,
  PerformanceGranularity,
  PerformancePoint,
  Profile,
  RetentionLiveStream,
  RetentionLiveTick,
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

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const today = () => new Date().toISOString().slice(0, 10);
const minutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const initialProfile: Profile = { dailyHours: 6, weeklyDays: 6, examTrack: "ITA", startDate: null, examDate: null, studyDays: [0, 1, 2, 3, 4, 5] };
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
  const [livestream, setLivestream] = useState<RetentionLiveStream | null>(null);
  const [report, setReport] = useState<ConsolidatedPerformanceReport | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [configMenu, setConfigMenu] = useState(false);

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3600);
  };

  const applyDemoState = () => {
    setSubjects(demoSubjects);
    setProfile(demoProfile);
    setDashboard(demoDashboard);
    setMaterials(demoMaterialList);
    setTopics(demoTopicList);
    setRanking(demoRanking);
    setSchedule(demoSchedule);
  };

  const recalculate = async (hours = profile.dailyHours) => {
    if (demoMode) {
      setSchedule(demoSchedule);
      return;
    }
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
      if (demoMode) {
        applyDemoState();
        setAllocations(demoDayAllocations);
        setMemoryItems(demoMemoryItems);
        setMemorySelected((previous) => previous ?? demoMemoryItems[0]?.id ?? null);
        setSubjectTrend(demoSubjectAccuracyTrend);
        setFocusTrend(demoFocusOverloadTrend);
        setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
        setRetentionOverview(demoRetentionOverview);
      } else {
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
      }
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
    if (demoMode) {
      setMemoryItems(demoMemoryItems);
      setMemorySelected((previous) => previous ?? demoMemoryItems[0]?.id ?? null);
      setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
      setSubjectTrend(demoSubjectAccuracyTrend);
      setFocusTrend(demoFocusOverloadTrend);
      setAllocations(demoDayAllocations);
      return;
    }
    let cancelled = false;
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
  }, [granularity, dashboard, trendSubjectId, trendTopicId, demoMode]);

  useEffect(() => {
    if (!memorySelected) {
      setMemoryProjection(null);
      return;
    }
    if (demoMode) {
      const item = memoryItems.find((entry) => entry.id === memorySelected);
      setMemoryProjection(item ? buildMemoryDecayProjection(item) : null);
      return;
    }
    let cancelled = false;
    api.getMemoryDecay(memorySelected)
      .then((data) => { if (!cancelled) setMemoryProjection(data); })
      .catch(() => { if (!cancelled) setMemoryProjection(null); });
    return () => { cancelled = true; };
  }, [memorySelected, memoryItems, demoMode]);

  useEffect(() => {
    if (demoMode) {
      setRetentionOverview(demoRetentionOverview);
      return;
    }
    let cancelled = false;
    api.getRetentionOverview()
      .then((data) => { if (!cancelled) setRetentionOverview(data); })
      .catch(() => { if (!cancelled) setRetentionOverview(null); });
    return () => { cancelled = true; };
  }, [memoryItems, demoMode]);

  useEffect(() => {
    if (demoMode) {
      setLivestream(demoRetentionLivestream[0] ?? null);
      setReport(null);
      return;
    }
    let cancelled = false;
    api.getPerformanceLivestream()
      .then((data) => { if (!cancelled) setLivestream(data); })
      .catch(() => { if (!cancelled) setLivestream(null); });
    api.getConsolidatedReport()
      .then((data) => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setReport(null); });
    return () => { cancelled = true; };
  }, [demoMode]);

  const selectMemoryItem = (id: number) => setMemorySelected(id);

  const createMemoryItem = async (input: MemoryItemInput) => {
    if (demoMode) {
      const ids = memoryItems.map((item) => item.id);
      const nextId = (ids.length ? Math.max(...ids) : 0) + 1;
      let topicName: string | null = null;
      let color = "blue";
      let subjectName: string | null = null;
      if (input.subjectId) {
        const subject = subjects.find((item) => item.id === input.subjectId);
        subjectName = subject?.name ?? null;
        color = subject?.color ?? "blue";
        if (input.topicId) topicName = topics.find((topic) => topic.id === input.topicId)?.name ?? null;
      }
      const created: SpacedRepetitionItem = {
        id: nextId,
        userId: 1,
        subjectId: input.subjectId ?? null,
        subjectName,
        color,
        topicId: input.topicId ?? null,
        topicName,
        concept: input.concept,
        difficulty: input.difficulty ?? 5,
        stability: 5,
        reps: 0,
        lastReviewDate: today(),
        dueDate: addDaysIso(5),
        retrievability: 1,
        createdAt: today()
      };
      setMemoryItems((previous) => [...previous, created]);
      setMemorySelected(created.id);
      notify("Item de memória adicionado à fila de revisão (demo).");
      return;
    }
    try {
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
    if (demoMode) {
      setMemoryItems((previous) => previous.filter((item) => item.id !== id));
      setMemorySelected((current) => (current === id ? null : current));
      notify("Item removido da fila (demo).");
      return;
    }
    try {
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
    if (demoMode) {
      const multipliers: Record<ReviewGrade, number> = { again: 0.5, hard: 1.2, good: 1.8, easy: 2.4 };
      setMemoryItems((previous) => previous.map((item) => {
        if (item.id !== id) return item;
        const stability = Math.min(120, Math.round(item.stability * multipliers[grade] * 10) / 10);
        return { ...item, stability, reps: item.reps + 1, lastReviewDate: today(), dueDate: addDaysIso(Math.max(1, Math.round(stability))), retrievability: 1 };
      }));
      setMemorySelected(id);
      notify("Revisão registrada — estabilidade rearmada (demo).");
      return;
    }
    try {
      const updated = await api.reviewMemoryItem(id, grade);
      setMemoryItems((previous) => previous.map((item) => (item.id === id ? updated : item)));
      setMemoryProjection(await api.getMemoryDecay(id));
      notify("Revisão registrada — estabilidade rearmada.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const refreshSubjects = async () => {
    if (demoMode) {
      applyDemoState();
      return;
    }
    const nextSubjects = await api.listSubjects();
    setSubjects(nextSubjects);
    if (nextSubjects.length) await recalculate();
    else setSchedule(null);
    setDashboard(await api.getDashboard());
  };

  const bulkAddSubjects = async (group: CatalogGroup) => {
    const existingNames = new Set(subjects.map((subject) => subject.name));
    const picks = catalogSubjects.filter((entry) => entry.group === group && !existingNames.has(entry.name));
    if (!picks.length) {
      notify("Nada novo nesse grupo — todas já estão na matriz.");
      return;
    }
    if (demoMode) {
      const nextId = Math.max(0, ...subjects.map((subject) => subject.id)) + 1;
      const added = picks.map((entry, offset) => ({
        id: nextId + offset,
        userId: 1,
        name: entry.name,
        weight: entry.weight,
        difficulty: entry.difficulty,
        computedIp: entry.weight * entry.difficulty,
        color: COLOR_OPTIONS[(nextId + offset) % COLOR_OPTIONS.length],
        goalAccuracy: 70 + ((nextId + offset) % 21),
        goalCoverage: 100,
        currentLevel: 1,
        targetLevel: 5,
        createdAt: today()
      }));
      setSubjects((previous) => [...previous, ...added]);
      setSchedule(demoSchedule);
      notify(`${added.length} matéria(s) do grupo adicionada(s) à matriz (demo).`);
      return;
    }
    try {
      for (const entry of picks) {
        await api.createSubject({ name: entry.name, weight: entry.weight, difficulty: entry.difficulty });
      }
      await refreshSubjects();
      notify(`${picks.length} matéria(s) adicionada(s) à matriz.`);
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const refreshAdvance = async () => {
    if (demoMode) {
      applyDemoState();
      return;
    }
    setTopics(await api.listTopics());
    setMaterials(await api.listMaterials());
    setDashboard(await api.getDashboard());
  };

  const reloadAllocations = async () => {
    if (demoMode) {
      setAllocations(demoDayAllocations);
      return;
    }
    setAllocations(await api.listDayAllocations());
  };

  const saveProfile = async () => {
    if (demoMode) {
      setSchedule(demoSchedule);
      setDashboard(demoDashboard);
      notify("Modo demo: carga de estudo simulada, nada foi gravado.");
      return;
    }
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
    if (!schedule) return;
    if (demoMode) {
      notify("Modo demo: planejamento simulado, nada foi gravado.");
      return;
    }
    try {
      await api.saveDailyLog(profile.dailyHours, schedule);
      notify("Planejamento de hoje salvo no histórico local.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const toggleDemo = () => {
    const next = !demoMode;
    setDemoMode(next);
    setConfigMenu(false);
    if (next) {
      applyDemoState();
      setAllocations(demoDayAllocations);
      setMemoryItems(demoMemoryItems);
      setMemorySelected((previous) => previous ?? demoMemoryItems[0]?.id ?? null);
      setSubjectTrend(demoSubjectAccuracyTrend);
      setFocusTrend(demoFocusOverloadTrend);
      setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
      setRetentionOverview(demoRetentionOverview);
      notify("Modo demonstração ativo — dados fictícios, nada é gravado.");
    } else {
      void loadApp();
    }
  };

  const deleteSubject = async (subject: Subject) => {
    if (!window.confirm(`Remover “${subject.name}”? Materiais relacionados serão mantidos sem disciplina.`)) return;
    if (demoMode) {
      setSubjects((previous) => previous.filter((item) => item.id !== subject.id));
      setSchedule(demoSchedule);
      notify("Matéria removida (demo).");
      return;
    }
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
    if (demoMode) {
      setMaterials((previous) => previous.filter((item) => item.id !== material.id));
      notify("Material removido (demo).");
      return;
    }
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
    if (demoMode) {
      setMaterials((previous) => previous.map((item) => (item.id === material.id ? { ...item, status } : item)));
      notify("Status do material atualizado (demo).");
      return;
    }
    try {
      await api.updateMaterial(material.id, { ...material, status });
      setMaterials(await api.listMaterials());
      setDashboard(await api.getDashboard());
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const executed = new Map((dashboard?.subjectPerformance ?? []).map((item) => [item.subjectId, item.studiedMinutes]));
  const focus = schedule?.allocations[0];
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
            <button className="button primary" onClick={() => setQuestionEditor(true)} disabled={!subjects.length}>
              <Plus size={17} /> Lançar questões
            </button>
            <div className="config-wrap">
              <button className={`icon-button ${demoMode ? "active" : ""}`} title="Configurações" aria-label="Configurações" onClick={() => setConfigMenu((open) => !open)}><Settings size={18} /></button>
              {configMenu && <div className="config-menu">
                <p className="config-menu-title">Configurações</p>
                <button className={`config-trigger ${demoMode ? "active" : ""}`} onClick={toggleDemo}>
                  <Sparkles size={17} />
                  <span><strong>Modo demonstração</strong><small>{demoMode ? "Ativo — dados fictícios, nada é gravado" : "Inativo — usa seus dados reais"}</small></span>
                </button>
              </div>}
            </div>
          </div>
        </header>

        {loading ? <Loading /> : <>
          {view === "inicio" && <Overview dashboard={dashboard} schedule={schedule} focus={focus} onNavigate={setView} />}
          {view === "matriz" && <MatrixView schedule={schedule} subjects={subjects} onAdd={() => setSubjectEditor(null)} onEdit={setSubjectEditor} onDelete={deleteSubject} onBulkAdd={bulkAddSubjects} />}
          {view === "planejamento" && <PlanningView profile={profile} schedule={schedule} weeklyMinutes={weeklyMinutes} subjects={subjects} onProfile={setProfile} onSaveProfile={saveProfile} onSavePlan={savePlan} allocations={allocations} demo={demoMode} onSubjectAdded={(subject) => setSubjects((previous) => [...previous, subject])} />}
          {view === "foco" && <FocusTimerView subjects={subjects} materials={materials} demo={demoMode} />}
          {view === "desempenho" && <PerformanceView dashboard={dashboard} trend={trend} granularity={granularity} onGranularity={setGranularity} onTrendFilter={(subjectId, topicId) => { setTrendSubjectId(subjectId); setTrendTopicId(topicId); }} trendSubjectId={trendSubjectId} trendTopicId={trendTopicId} onRecord={() => setQuestionEditor(true)} subjects={subjects} topics={topics} schedule={schedule} executed={executed} points={subjectTrend} focusPoints={focusTrend} memoryItems={memoryItems} memoryProjection={memoryProjection} overview={retentionOverview} livestream={livestream} report={report} onMemorySelect={selectMemoryItem} onMemoryCreate={createMemoryItem} onMemoryDelete={deleteMemoryItem} onMemoryReview={reviewMemoryItem} />}
          {view === "avanco" && <AdvancementView subjects={subjects} topics={topics} materials={materials} dashboard={dashboard} onChanged={refreshAdvance} demo={demoMode} />}
          {view === "ranking" && <RankingView ranking={ranking} allocations={allocations} onChanged={reloadAllocations} demo={demoMode} />}
          {view === "biblioteca" && <LibraryView materials={materials} subjects={subjects} topics={topics} onAdd={() => setMaterialEditor(true)} onDelete={deleteMaterial} onStatus={updateMaterialStatus} demo={demoMode} />}
        </>}
      </main>

      {toast && <div className={`toast ${toast.tone}`}><AlertCircle size={17} />{toast.message}</div>}
      {subjectEditor !== undefined && <SubjectModal subject={subjectEditor ?? undefined} onClose={() => setSubjectEditor(undefined)} onSaved={async () => { if (demoMode) applyDemoState(); else await refreshSubjects(); setSubjectEditor(undefined); notify("Matriz atualizada."); }} />}
      {materialEditor && <MaterialModal subjects={subjects} topics={topics} onClose={() => setMaterialEditor(false)} onSaved={async () => { if (demoMode) applyDemoState(); else { setMaterials(await api.listMaterials()); setDashboard(await api.getDashboard()); } setMaterialEditor(false); notify("Material adicionado à biblioteca."); }} />}
      {questionEditor && <QuestionModal subjects={subjects} topics={topics} onClose={() => setQuestionEditor(false)} onSaved={async () => { if (demoMode) { applyDemoState(); setRanking(demoRanking); } else { setDashboard(await api.getDashboard()); setRanking(await api.getPriorityRanking()); } setQuestionEditor(false); notify("Desempenho registrado."); }} />}
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

function MatrixView({ schedule, subjects, onAdd, onEdit, onDelete, onBulkAdd }: { schedule: ScheduleResponse | null; subjects: Subject[]; onAdd: () => void; onEdit: (subject: Subject) => void; onDelete: (subject: Subject) => void; onBulkAdd: (group: CatalogGroup) => void }) {
  const [catalogGroup, setCatalogGroup] = useState<CatalogGroup>("ita-ime");
  const names = new Set(subjects.map((subject) => subject.name));
  const availableInGroup = catalogSubjects.filter((entry) => entry.group === catalogGroup && !names.has(entry.name));
  return <div className="page-stack">
    <section className="card matrix-intro"><div><p className="eyebrow">Motor de priorização ponderada</p><h2>IP = peso estratégico × dificuldade pessoal</h2><p>Os tempos são tetos máximos. Todo bloco é arredondado para cinco minutos sem estourar sua carga; a diferença fica no Project Buffer.</p></div><button className="button primary" onClick={onAdd}><Plus size={17} /> Nova matéria</button></section>
    <section className="card catalog-card">
      <div className="section-heading"><div><p className="eyebrow">Matriz da ponte</p><h2>Catálogo de matérias</h2></div>
        <div className="catalog-tabs">{CATALOG_GROUPS.map((group) => <button key={group} className={`catalog-tab ${catalogGroup === group ? "active" : ""}`} onClick={() => setCatalogGroup(group)}>{CATALOG_GROUP_LABELS[group]}</button>)}</div>
      </div>
      <p className="catalog-hint">{CATALOG_GROUP_HINTS[catalogGroup]}</p>
      <div className="catalog-list">{catalogSubjects.filter((entry) => entry.group === catalogGroup).map((entry) => {
        const added = names.has(entry.name);
        return <div className={`catalog-item ${added ? "added" : ""}`} key={entry.name}><span className="color-dot" style={{ background: added ? "#34d399" : "#27435f" }} /><span className="catalog-item-name">{entry.name}</span><span className="catalog-item-meta">Peso {entry.weight} · {entry.difficulty}×</span><b className="catalog-item-ip">{entry.weight * entry.difficulty}</b>{added ? <span className="catalog-item-state">na matriz</span> : null}</div>;
      })}</div>
      <div className="catalog-actions"><span className="muted-text">{availableInGroup.length} disponíveis neste grupo</span><button className="button secondary" disabled={!availableInGroup.length} onClick={() => onBulkAdd(catalogGroup)}><Plus size={16} /> Adicionar {availableInGroup.length} ao catálogo</button></div>
    </section>
    <section className="card table-card">
      <div className="table-wrap"><table><thead><tr><th>Matéria / frente</th><th>Peso</th><th>Dificuldade</th><th>IP</th><th>Teto (timebox)</th><th>Participação</th><th aria-label="Ações" /></tr></thead>
        <tbody>{schedule?.allocations.map((item) => <tr key={item.id}><td><span className="subject-cell"><span className="color-dot" style={{ background: color(item.color) }} />{item.name}</span></td><td><span className="number-badge">{item.weight}</span></td><td><span className="number-badge muted">{item.difficulty}</span></td><td><strong className="ip-badge">{item.computedIp}</strong></td><td><strong className="time-value">{item.formattedTime}</strong></td><td><div className="progress-inline"><span style={{ width: `${item.percentage}%`, background: color(item.color) }} /><small>{item.percentage}%</small></div></td><td className="actions"><button className="icon-button" title="Editar" onClick={() => onEdit(item)}><Pencil size={16} /></button><button className="icon-button danger" title="Remover" onClick={() => onDelete(item)}><Trash2 size={16} /></button></td></tr>)}</tbody>
        {schedule && <tfoot><tr><td colSpan={3}>TOTAL DO SISTEMA</td><td>{schedule.totalIp}</td><td>{minutes(schedule.totalMinutes)}</td><td colSpan={2}>Buffer: <strong>{schedule.formattedProjectBuffer}</strong></td></tr></tfoot>}
      </table></div>
      {!subjects.length && !schedule && <EmptyState icon={<SlidersHorizontal />} text="Sua matriz está vazia." action={<button className="button primary" onClick={onAdd}>Adicionar primeira matéria</button>} />}
    </section>
  </div>;
}

function PlanningView({ profile, schedule, weeklyMinutes, subjects, onProfile, onSaveProfile, onSavePlan, allocations, demo, onSubjectAdded }: { profile: Profile; schedule: ScheduleResponse | null; weeklyMinutes: number; subjects: Subject[]; onProfile: (profile: Profile) => void; onSaveProfile: () => void; onSavePlan: () => void; allocations: DayAllocation[]; demo: boolean; onSubjectAdded: (subject: Subject) => void }) {
  const trackOptions = ["Ensino Médio", "ENEM", "ITA", "IME", "Personalizado"];
  const byDay: DayAllocation[][] = Array.from({ length: 7 }, () => []);
  for (const allocation of allocations) byDay[allocation.weekday].push(allocation);
  const studyDays = Array.isArray(profile.studyDays) && profile.studyDays.length ? profile.studyDays : Array.from({ length: profile.weeklyDays }, (_, index) => index);
  const studySet = new Set(studyDays);
  const toggleStudyDay = (index: number) => {
    const next = studySet.has(index) ? studyDays.filter((day) => day !== index) : [...studyDays, index].sort((a, b) => a - b);
    if (!next.length) return;
    onProfile({ ...profile, studyDays: next, weeklyDays: next.length });
  };
  const weekTable = schedule ? WEEKDAY_NAMES.map((dayName, index) => {
    if (!studySet.has(index)) return { dayName, isStudy: false as const, slots: [] as ScheduleResponse["allocations"], total: 0 };
    const dayIndex = studyDays.indexOf(index);
    const slots = schedule.allocations.filter((item) => {
      const position = schedule.allocations.findIndex((candidate) => candidate.id === item.id);
      return position !== -1 && position % studyDays.length === dayIndex % studyDays.length;
    });
    return { dayName, isStudy: true as const, slots, total: slots.reduce((sum, item) => sum + item.allocatedMinutes, 0) };
  }) : [];
  const [wizard, setWizard] = useState(false);
  return <div className="page-stack">
    <section className="card settings-card"><div className="section-heading"><div><p className="eyebrow">Capacidade real</p><h2>Configure sua semana</h2></div><div className="heading-actions"><button className="button ghost" onClick={() => setWizard(true)}><CalendarCheck size={16} /> Rota da prova</button><button className="button primary" onClick={onSaveProfile}><Save size={16} /> Salvar configuração</button></div></div>
      <div className="setting-fields"><label>Horas líquidas por dia<input type="number" min="0.5" max="24" step="0.5" value={profile.dailyHours} onChange={(event) => onProfile({ ...profile, dailyHours: Number(event.target.value) })} /></label><label>Dias de estudo/semana<div className="day-picker">{WEEKDAY_NAMES.map((dayName, index) => <button type="button" key={dayName} className={`day-tick ${studySet.has(index) ? "active" : ""}`} onClick={() => toggleStudyDay(index)}>{dayName}</button>)}</div></label><label>Trilha principal<select value={profile.examTrack} onChange={(event) => onProfile({ ...profile, examTrack: event.target.value as Profile["examTrack"] })}>{trackOptions.map((track) => <option key={track}>{track}</option>)}</select></label><div className="weekly-total"><span>Tempo semanal planejado</span><strong>{minutes(weeklyMinutes)}</strong></div></div>
    </section>
    <section className="card week-table-card"><div className="section-heading"><div><p className="eyebrow">Grade da semana</p><h2>Tabela da semana</h2></div><CalendarDays size={20} /></div>
      {schedule ? <div className="week-table">{weekTable.map((col) => <div className={`week-col ${col.isStudy ? "study" : "rest"}`} key={col.dayName}><span className="week-day-label">{col.dayName}</span>{col.isStudy ? <div className="week-slots">{col.slots.map((item) => <div className="week-slot" key={item.id} title={item.name}><i style={{ background: color(item.color) }} /><span>{item.name}</span><b>{item.formattedTime}</b></div>)}</div> : <span className="week-rest">descanso</span>}<div className="week-total">{col.isStudy ? minutes(col.total) : "—"}</div></div>)}</div> : <EmptyState icon={<CalendarDays />} text="Adicione matérias à matriz para montar a tabela da semana." />}
    </section>
    <section className="card schedule-card"><div className="section-heading"><div><p className="eyebrow">Plano diário de execução</p><h2>Timeboxes inegociáveis</h2></div>{schedule && <button className="button secondary" onClick={onSavePlan}><Save size={16} /> Salvar hoje</button>}</div>
      {schedule ? <><div className="timeline">{schedule.allocations.map((item) => <div className="timeline-item" key={item.id}><div className="timeline-color" style={{ background: color(item.color) }} /><div className="timeline-main"><div><strong>{item.name}</strong><span>IP {item.computedIp} · {item.percentage}% da carga</span></div><b>{item.formattedTime}</b></div><div className="timeline-track"><span style={{ width: `${item.percentage}%`, background: color(item.color) }} /></div><small>Semana: {minutes(item.allocatedMinutes * studyDays.length)} em {studyDays.length} blocos</small></div>)}</div><div className="buffer-box"><Zap size={20} /><div><strong>Project Buffer: {schedule.formattedProjectBuffer}</strong><span>Reserva técnica para imprevistos ou tópicos transferidos. Não redistribua antes de executar a matriz.</span></div></div></> : <EmptyState icon={<CalendarDays />} text="Adicione matérias à matriz para montar o plano." />}
    </section>
    <section className="card reinforcement-card">
      <div className="section-heading"><div><p className="eyebrow">Foco de recuperação</p><h2>Reforço da semana</h2></div><CalendarCheck size={20} /></div>
      {allocations.length ? <div className="reinforce-week">{studyDays.map((dayIndex) => <div className="reinforce-day" key={dayIndex}><span className="reinforce-day-label">{WEEKDAY_NAMES[dayIndex]}</span>{byDay[dayIndex].length ? byDay[dayIndex].map((a) => <div className="reinforce-chip" key={a.id} title={a.note ?? undefined}><i style={{ background: color(a.color) }} />{a.subjectName.split("·")[0].trim()}<b>{minutes(a.minutes)}</b></div>) : <span className="muted-text">—</span>}</div>)}</div> : <p className="cogn-empty">Nenhum reforço alocado. Vá na aba Ranking e clique em <em>Gerenciar</em> numa matéria para fixar seu dia de recuperação.</p>}
    </section>
    <RescheduleTriagePanel demo={demo} />
    {wizard && <PlanWizard subjects={subjects} profile={profile} onClose={() => setWizard(false)} demo={demo} onSubjectAdded={onSubjectAdded} />}
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

const PerformanceView = ({ dashboard, trend, granularity, onGranularity, onTrendFilter, trendSubjectId, trendTopicId, onRecord, subjects, topics, schedule, executed, points, focusPoints, memoryItems, memoryProjection, overview, livestream, report, onMemorySelect, onMemoryCreate, onMemoryDelete, onMemoryReview }: { dashboard: DashboardData | null; trend: PerformancePoint[]; granularity: PerformanceGranularity; onGranularity: (granularity: PerformanceGranularity) => void; onTrendFilter: (subjectId: number | null, topicId: number | null) => void; trendSubjectId: number | null; trendTopicId: number | null; onRecord: () => void; subjects: Subject[]; topics: Topic[]; schedule: ScheduleResponse | null; executed: Map<number, number>; points: SubjectAccuracyPoint[]; focusPoints: FocusOverloadPoint[]; memoryItems: SpacedRepetitionItem[]; memoryProjection: MemoryDecayProjection | null; overview: RetentionOverview | null; livestream: RetentionLiveStream | null; report: ConsolidatedPerformanceReport | null; onMemorySelect: (id: number) => void; onMemoryCreate: (input: MemoryItemInput) => void; onMemoryDelete: (id: number) => void; onMemoryReview: (id: number, grade: ReviewGrade) => void }) => {
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
    <RetentionGraphBoard overview={overview} />
    <LiveRetentionCard livestream={livestream} />
    <ConsolidatedReportCard report={report} />
    <section className="metric-grid"><Metric icon={<Target />} label="Total de questões" value={`${dashboard?.questions.total ?? 0}`} helper="todas as disciplinas" accent="indigo" /><Metric icon={<CheckCircle2 />} label="Acertos" value={`${dashboard?.questions.correct ?? 0}`} helper="respostas corretas" accent="emerald" /><Metric icon={<Trophy />} label="Taxa global" value={`${dashboard?.questions.accuracy ?? 0}%`} helper="média ponderada pelos itens" accent="amber" /><Metric icon={<Timer />} label="Tempo registrado" value={minutes(dashboard?.weeklyStudyMinutes ?? 0)} helper="últimos 7 dias" accent="pink" /></section>
    <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Diagnóstico por disciplina</p><h2>Taxa de acerto</h2></div><BarChart3 size={20} /></div>{usefulData.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={usefulData}><CartesianGrid stroke="#203044" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="subjectName" tick={{ fill: "#9aabc0", fontSize: 11 }} tickFormatter={(name) => name.split("·")[0].trim()} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "#9aabc0", fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="accuracy" radius={[6,6,0,0]}>{usefulData.map((entry) => <Cell key={entry.subjectId} fill={color(entry.color)} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState icon={<BarChart3 />} text="Seu gráfico aparecerá depois do primeiro lançamento de questões." />}</section>
    <section className="card table-card"><div className="section-heading"><div><p className="eyebrow">Tabela de diagnóstico</p><h2>Desempenho acumulado</h2></div></div><div className="table-wrap"><table><thead><tr><th>Disciplina</th><th>Questões</th><th>Acertos</th><th>Taxa</th><th>Tempo</th></tr></thead><tbody>{data.map((item) => <tr key={item.subjectId}><td><span className="subject-cell"><span className="color-dot" style={{ background: color(item.color) }} />{item.subjectName}</span></td><td>{item.questionsTotal}</td><td>{item.questionsCorrect}</td><td><strong className={item.accuracy >= 70 ? "good" : item.accuracy > 0 ? "needs-work" : "muted-text"}>{item.accuracy}%</strong></td><td>{minutes(item.studiedMinutes)}</td></tr>)}</tbody></table></div></section>
    {subjects.length ? <CognitiveCharts subjects={subjects} topics={topics} schedule={schedule} executed={executed} points={points} focusPoints={focusPoints} memoryItems={memoryItems} memoryProjection={memoryProjection} onMemorySelect={onMemorySelect} onMemoryCreate={onMemoryCreate} onMemoryDelete={onMemoryDelete} onMemoryReview={onMemoryReview} /> : null}
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

function LiveRetentionCard({ livestream }: { livestream: RetentionLiveStream | null }) {
  const ticks = livestream?.ticks ?? [];
  return (
    <section className="card table-card">
      <div className="section-heading"><div><p className="eyebrow">Retenção · tempo real</p><h2>Livestream de retenção</h2></div><span className="live-badge">{livestream ? `AO VIVO · ${livestream.generatedAt}` : "AO VIVO"}</span></div>
      {ticks.length ? (
        <div className="live-grid">
          {ticks.map((tick) => (
            <div key={tick.subjectId} className={`live-row ${tick.overdue || tick.manyPartials ? "on-alert" : ""}`} title={`${tick.subjectName}${tick.overdue ? " · matéria atrasada (retenção abaixo do piso)" : ""}${tick.manyPartials ? " · muitos blocos parciais" : ""}`}>
              <i style={{ background: color(tick.color) }} />
              <span className="live-subject">{tick.subjectName.split("·")[0].trim()}</span>
              <strong>{tick.accuracy}%</strong>
              <span className={tick.retentionDelta < 0 ? "live-delta down" : "live-delta up"}>{tick.retentionDelta >= 0 ? "▲ " : "▼ "}{Math.abs(tick.retentionDelta).toFixed(1)}</span>
              {tick.overdue && <span className="alert-chip live-alert">atrasada</span>}
              {tick.manyPartials && <span className="alert-chip">parciais</span>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Activity />} text="Sem amostras ainda — adicione itens de memória e registre blocos de foco para o livestream." />
      )}
    </section>
  );
}

function ConsolidatedReportCard({ report }: { report: ConsolidatedPerformanceReport | null }) {
  if (!report) {
    return (
      <section className="card table-card">
        <div className="section-heading"><div><p className="eyebrow">Panorama único</p><h2>Relatório consolidado</h2></div><ClipboardCheck size={20} /></div>
        <EmptyState icon={<ClipboardCheck />} text="Relatório disponível com dados reais — registre questões, blocos de foco e itens de memória." />
      </section>
    );
  }
  return (
    <section className="card table-card">
      <div className="section-heading"><div><p className="eyebrow">Panorama único · {report.generatedAt}</p><h2>Relatório consolidado de desempenho</h2></div><ClipboardCheck size={20} /></div>
      <div className="metric-grid">
        <Metric icon={<Target />} label="Questões" value={`${report.totals.questionsTotal}`} helper={`${report.totals.questionsCorrect} corretas`} accent="indigo" />
        <Metric icon={<CheckCircle2 />} label="Taxa global" value={`${report.totals.accuracy}%`} helper="acertos sobre o total" accent={report.totals.accuracy >= 70 ? "emerald" : "amber"} />
        <Metric icon={<TimerReset />} label="Deep work" value={`${report.totals.deepWorkBlocks}`} helper="blocos concluídos" accent="emerald" />
        <Metric icon={<AlertTriangle />} label="Saídas precoces" value={`${report.totals.partialBlocks}`} helper="blocos parciais" accent="amber" />
        <Metric icon={<AlertCircle />} label="Itens atrasados" value={`${report.totals.overdueItems}`} helper={`${report.totals.subjectsLate} matérias em atraso`} accent="pink" />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>#</th><th>Disciplina</th><th>Acerto</th><th>Retenção</th><th>Venc.</th><th>Deep work</th><th>Parciais</th><th>Status</th></tr></thead>
        <tbody>
          {report.ranking.map((row) => (
            <tr key={row.subjectId} className={row.isOverdue || row.hasManyPartials ? "row-alert" : undefined}>
              <td>{row.rank}</td>
              <td><span className="subject-cell"><span className="color-dot" style={{ background: color(row.color) }} />{row.subjectName}</span></td>
              <td><strong className={row.accuracy >= 70 ? "good" : row.accuracy > 0 ? "needs-work" : "muted-text"}>{row.accuracy}%</strong></td>
              <td>{row.retentionToday}%</td>
              <td>{row.dueInDays > 0 ? `${row.dueInDays}d` : row.dueInDays === 0 ? "hoje" : `${row.dueInDays}d`}</td>
              <td>{row.deepWorkBlocks}</td>
              <td><span className={row.hasManyPartials ? "needs-work" : "muted-text"}>{row.partialBlocks}</span></td>
              <td>{row.isOverdue ? <span className="needs-work">Atrasada</span> : row.hasManyPartials ? <span className="needs-work">Parciais</span> : <span className="good">OK</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}
function LibraryView({ materials, subjects, topics, onAdd, onDelete, onStatus, demo }: { materials: StudyMaterial[]; subjects: Subject[]; topics: Topic[]; onAdd: () => void; onDelete: (material: StudyMaterial) => void; onStatus: (material: StudyMaterial, status: MaterialStatus) => void; demo: boolean }) {
  const [strategies, setStrategies] = useState<MaterialStrategy[]>([]);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));

  useEffect(() => {
    if (demo) {
      setStrategies(demoMaterialStrategies);
      return;
    }
    if (!materials.length) return;
    api.listMaterialStrategies().then(setStrategies).catch(() => undefined);
  }, [materials.length, demo]);

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
const tooltipStyle = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff" };
