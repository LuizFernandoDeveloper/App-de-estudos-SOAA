import { Component, memo, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Bell,
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
  ExternalLink,
  Flag,
  FolderPlus,
  History,
  LayoutDashboard,
  Library,
  LineChart,
  Pencil,
  Play,
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
import { buildWeightSuggestions, type WeightSuggestion } from "./weights";
import { RescheduleTriagePanel } from "./triage";
import { CATALOG_GROUPS, CATALOG_GROUP_HINTS, CATALOG_GROUP_LABELS, catalogSubjects, catalogSubjectsFor, courseAreaWeight, emphasizeCourse, COURSE_GOALS, EXAM_GUIDES, EXAM_TRACKS, FOCUS_AREAS, PROFICIENCY_LEVELS, type CatalogGroup, type CourseGoal } from "./catalog";
import { buildSynergyBrief, type SynergyAttack, type SynergyBrief, type SynergyEngine, type SynergyKind } from "./synergy";
import {
  addDaysIso,
  buildDemoDashboard,
  buildDemoFocusOverloadTrend,
  buildDemoRanking,
  buildDemoRetentionLivestream,
  buildDemoRetentionLivestreamTicks,
  buildDemoRetentionOverview,
  buildDemoSchedule,
  buildDemoSubjectAccuracyTrend,
  buildMemoryDecayProjection,
  demoDayAllocations,
  demoFilteredTrend,
  demoFocusSessions,
  demoMaterialList,
  demoMaterialStrategies,
  demoMemoryItems,
  demoProfile,
  demoTopicList,
  getDemoSubjects,
  setDemoSubjects
} from "./demo";
import { CognitiveCharts } from "./cognitive";
import { RetentionGraphBoard } from "./retention";
import { AdvancementView } from "./advancement";
import { RankingView } from "./ranking";
import { FocusTimerView } from "./focus";
import { PomodoroWorkspace } from "./pomodoro";
import { GeneralMetricsView } from "./generalMetrics";
import { examLinksFor } from "./exams";
import { CustomTitleBar } from "./TitleBar";
import type {
  ConsolidatedPerformanceReport,
  CourseWeightProfileInput,
  DashboardData,
  DayAllocation,
  ExamTrack,
  FocusOverloadPoint,
  FocusSession,
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

type View = "inicio" | "metricas-gerais" | "matriz" | "planejamento" | "foco" | "pomodoro" | "simulados" | "desempenho" | "biblioteca" | "avanco" | "ranking";
type Toast = { tone: "success" | "error"; message: string } | null;

type ResumeBrief = {
  session: FocusSession | null;
  reading: StudyMaterial | null;
  readingTopic: string | null;
  dueCount: number;
  dueFirst: SpacedRepetitionItem | null;
};

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const today = () => new Date().toISOString().slice(0, 10);
const addIsoDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const minutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/* Identidade estável: mantém o memo dos gráficos vivo quando o dashboard ainda não carregou. */
const EMPTY_SUBJECT_PERFORMANCE: DashboardData["subjectPerformance"] = [];

const initialProfile: Profile = { dailyHours: 6, weeklyDays: 6, examTrack: "ITA", startDate: null, examDate: null, studyDays: [0, 1, 2, 3, 4, 5], preferredCourse: null, focusArea: null };
const courseWeightProfileFor = (course: CourseGoal, examTrack: Profile["examTrack"], focusAreaId: string | null): CourseWeightProfileInput => {
  const focusedArea = FOCUS_AREAS.find((area) => area.id === focusAreaId) ?? null;
  const officialProfile = course.admissionProfile && course.track === examTrack ? course.admissionProfile : null;
  return {
    courseId: course.id,
    institution: officialProfile?.institution ?? course.university,
    examTrack,
    sourceEdition: officialProfile?.edition ?? null,
    sourceUrl: officialProfile?.source ?? null,
    subjects: catalogSubjectsFor(course.track, course).map((entry) => ({
      subjectName: entry.name,
      preparationWeight: courseAreaWeight(course, null, entry),
      appliedWeight: courseAreaWeight(course, focusedArea, entry),
      admissionWeight: officialProfile && (entry.group === "enem" || entry.group === "linguagens")
        ? officialProfile.weights[entry.group] ?? null
        : null,
      // O curso pede domínio intermediário nas matérias de maior aderência;
      // as demais ficam com uma meta básica editável pelo estudante.
      targetLevel: emphasizeCourse(course, entry) ? 3 : 2
    }))
  };
};
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
  const [questionSubjectId, setQuestionSubjectId] = useState<number | null>(null);
  const [focusPreset, setFocusPreset] = useState<{ subjectId: number; minutes: number | null } | null>(null);
  const [granularity, setGranularity] = useState<PerformanceGranularity>("day");
  const [trend, setTrend] = useState<PerformancePoint[]>([]);
  const [generalTrend, setGeneralTrend] = useState<PerformancePoint[]>([]);
  const [trendSubjectId, setTrendSubjectId] = useState<number | null>(null);
  const [trendTopicId, setTrendTopicId] = useState<number | null>(null);
  const [subjectTrend, setSubjectTrend] = useState<SubjectAccuracyPoint[]>([]);
  const [focusTrend, setFocusTrend] = useState<FocusOverloadPoint[]>([]);
  const [allocations, setAllocations] = useState<DayAllocation[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [memoryItems, setMemoryItems] = useState<SpacedRepetitionItem[]>([]);
  const [memorySelected, setMemorySelected] = useState<number | null>(null);
  const [memoryProjection, setMemoryProjection] = useState<MemoryDecayProjection | null>(null);
  const [retentionOverview, setRetentionOverview] = useState<RetentionOverview | null>(null);
  const [livestream, setLivestream] = useState<RetentionLiveStream | null>(null);
  const [report, setReport] = useState<ConsolidatedPerformanceReport | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [configMenu, setConfigMenu] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  /** Reprojeta todo o estado demo a partir da matriz mutável (IP, teto diário, buffer e ranking). */
  const applyDemoState = () => {
    const nextSubjects = getDemoSubjects();
    const nextSchedule = buildDemoSchedule(nextSubjects, demoProfile.dailyHours);
    setSubjects(nextSubjects);
    setProfile(demoProfile);
    setDashboard(buildDemoDashboard(nextSubjects, nextSchedule));
    setMaterials(demoMaterialList);
    setTopics(demoTopicList);
    setRanking(buildDemoRanking(nextSubjects));
    setSchedule(nextSchedule);
  };

  const recalculate = async (hours = profile.dailyHours) => {
    if (demoMode) {
      setSchedule(buildDemoSchedule(getDemoSubjects(), hours));
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
        setSubjectTrend(buildDemoSubjectAccuracyTrend(getDemoSubjects()));
        setFocusTrend(buildDemoFocusOverloadTrend(getDemoSubjects()));
        setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
        setRetentionOverview(buildDemoRetentionOverview(getDemoSubjects()));
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

  /** Assinatura da matriz: peso/dificuldade editados também disparam o efeito dominó. */
  const subjectsSignature = subjects.map((subject) => `${subject.id}:${subject.weight}:${subject.difficulty}`).join("|");

  /** Efeito dominó: mudar horas/dias/matérias recalcula a grade na hora, sem esperar "Salvar configuração". */
  useEffect(() => {
    if (loading) return;
    if (!subjects.length && !demoMode) {
      setSchedule(null);
      return;
    }
    const timer = setTimeout(() => void recalculate(), 250);
    return () => clearTimeout(timer);
  }, [profile.dailyHours, profile.weeklyDays, (profile.studyDays ?? []).join(","), subjectsSignature, demoMode]);

  useEffect(() => {
    if (demoMode) {
      setMemoryItems(demoMemoryItems);
      setMemorySelected((previous) => previous ?? demoMemoryItems[0]?.id ?? null);
      setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
      setGeneralTrend(demoFilteredTrend("day", null, null));
      const demoSubjectsNow = getDemoSubjects();
      setSubjectTrend(buildDemoSubjectAccuracyTrend(demoSubjectsNow));
      setFocusTrend(buildDemoFocusOverloadTrend(demoSubjectsNow));
      setAllocations(demoDayAllocations);
      setFocusSessions(demoFocusSessions);
      return;
    }
    let cancelled = false;
    api.listMemoryItems()
      .then((data) => { if (!cancelled) setMemoryItems(data); if (!cancelled && !memorySelected && data.length) setMemorySelected(data[0].id); })
      .catch(() => { if (!cancelled) setMemoryItems([]); });
    api.getPerformanceTrend(granularity, trendSubjectId, trendTopicId)
      .then((data) => { if (!cancelled) setTrend(data); })
      .catch(() => { if (!cancelled) setTrend([]); });
    api.getPerformanceTrend("day", null, null)
      .then((data) => { if (!cancelled) setGeneralTrend(data); })
      .catch(() => { if (!cancelled) setGeneralTrend([]); });
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

  /** Sessões de foco alimentam o card "Continuar de onde parei" — relê ao voltar para a Visão geral. */
  useEffect(() => {
    if (view !== "inicio") return;
    if (demoMode) { setFocusSessions(demoFocusSessions); return; }
    let cancelled = false;
    api.listFocusSessions()
      .then((data) => { if (!cancelled) setFocusSessions(data); })
      .catch(() => { if (!cancelled) setFocusSessions([]); });
    return () => { cancelled = true; };
  }, [view, demoMode]);

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
      setRetentionOverview(buildDemoRetentionOverview(getDemoSubjects(), memoryItems));
      return;
    }
    let cancelled = false;
    api.getRetentionOverview()
      .then((data) => { if (!cancelled) setRetentionOverview(data); })
      .catch(() => { if (!cancelled) setRetentionOverview(null); });
    return () => { cancelled = true; };
  }, [memoryItems, demoMode, subjects]);

  const demoLivestream = useMemo(
    () => buildDemoRetentionLivestream(buildDemoRetentionLivestreamTicks(subjects, ranking))[0] ?? null,
    [subjects, ranking]
  );

  useEffect(() => {
    if (demoMode) {
      setLivestream(demoLivestream);
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
  }, [demoMode, demoLivestream]);

  const selectMemoryItem = useCallback((id: number) => setMemorySelected(id), []);

  const createMemoryItem = useCallback(async (input: MemoryItemInput) => {
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
  }, [demoMode, memoryItems, notify, subjects, topics]);

  const deleteMemoryItem = useCallback(async (id: number) => {
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
  }, [demoMode, notify]);

  const reviewMemoryItem = useCallback(async (id: number, grade: ReviewGrade) => {
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
  }, [demoMode, notify]);

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

  /** Wizard devolve cada matéria criada aqui: na demo ela entra na matriz mutável e replaneja tudo. */
  const registerAddedSubject = (subject: Subject) => {
    if (demoMode) {
      setDemoSubjects([...getDemoSubjects(), subject]);
      applyDemoState();
      return;
    }
    setSubjects((previous) => [...previous, subject]);
  };

  /** Remove matéria da matriz (wizard × ou edição): recalcula IP, teto diário e buffer na hora. */
  const removeSubjectFromMatrix = (subject: Subject): boolean => {
    if (!window.confirm(`Remover “${subject.name}” da matriz? O cronograma recalcula na hora.`)) return false;
    if (demoMode) {
      setDemoSubjects(getDemoSubjects().filter((item) => item.id !== subject.id));
      applyDemoState();
      notify("Matéria removida da matriz (demo) — IP, teto diário e buffer recalculados.");
      return true;
    }
    void (async () => {
      try {
        await api.deleteSubject(subject.id);
        await refreshSubjects();
        notify("Matéria removida da matriz.");
      } catch (error) {
        notify(String(error), "error");
      }
    })();
    return true;
  };

  const bulkAddSubjects = async (group: CatalogGroup) => {
    const existingNames = new Set(subjects.map((subject) => subject.name));
    const picks = catalogSubjects.filter((entry) => entry.group === group && !existingNames.has(entry.name));
    if (!picks.length) {
      notify("Nada novo nesse grupo — todas já estão na matriz.");
      return;
    }
    if (demoMode) {
      const current = getDemoSubjects();
      const nextId = Math.max(0, ...current.map((subject) => subject.id)) + 1;
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
        targetLevel: 4,
        createdAt: today()
      }));
      setDemoSubjects([...current, ...added]);
      applyDemoState();
      notify(`${added.length} matéria(s) do grupo adicionada(s) à matriz (demo) — IP, teto diário e buffer recalculados.`);
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

  /** Aplica a calibração de pesos vinda da Matriz (um a um ou em lote). */
  const applyWeightSuggestions = async (chosen: WeightSuggestion[]) => {
    if (!chosen.length) return;
    if (demoMode) {
      const nextWeights = new Map(chosen.map((suggestion) => [suggestion.subjectId, suggestion.suggestedWeight]));
      setDemoSubjects(getDemoSubjects().map((subject) => {
        const weight = nextWeights.get(subject.id);
        return weight === undefined ? subject : { ...subject, weight, computedIp: weight * subject.difficulty };
      }));
      applyDemoState();
      notify(`${chosen.length} peso(s) recalibrado(s) (demo) — IP, teto e buffer acompanham.`);
      return;
    }
    try {
      for (const suggestion of chosen) {
        const subject = subjects.find((candidate) => candidate.id === suggestion.subjectId);
        if (!subject) continue;
        await api.updateSubject(subject.id, { name: subject.name, weight: suggestion.suggestedWeight, difficulty: subject.difficulty, currentLevel: subject.currentLevel });
      }
      await refreshSubjects();
      notify(`${chosen.length} peso(s) recalibrado(s) — grade e repriorização em andamento.`);
    } catch (error) {
      notify(String(error), "error");
    }
  };

  const updateSubjectLevels = async (subjectId: number, currentLevel: number, targetLevel: number) => {
    const subject = subjects.find((candidate) => candidate.id === subjectId);
    if (!subject) return;
    if (demoMode) {
      setDemoSubjects(getDemoSubjects().map((candidate) => candidate.id === subjectId ? { ...candidate, currentLevel, targetLevel } : candidate));
      applyDemoState();
      notify("Marco de domínio atualizado (demo, sem gravar dados reais).");
      return;
    }
    try {
      await api.updateSubject(subjectId, { name: subject.name, weight: subject.weight, difficulty: subject.difficulty, currentLevel, targetLevel });
      await refreshSubjects();
      notify("Marco de domínio salvo para " + subject.name.split("·")[0].trim() + ".");
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

  const refreshPomodoroSignals = useCallback(async () => {
    if (demoMode) {
      setFocusTrend(buildDemoFocusOverloadTrend(subjects));
      setRanking(buildDemoRanking(subjects));
      setFocusSessions(demoFocusSessions);
      return;
    }
    const [sessionResult, trendResult, rankingResult] = await Promise.allSettled([
      api.listFocusSessions(), api.getFocusOverloadTrend(), api.getPriorityRanking()
    ]);
    if (sessionResult.status === "fulfilled") setFocusSessions(sessionResult.value);
    if (trendResult.status === "fulfilled") setFocusTrend(trendResult.value);
    if (rankingResult.status === "fulfilled") setRanking(rankingResult.value);
  }, [demoMode, subjects]);

  const saveProfile = async () => {
    if (demoMode) {
      notify("Modo demo: configuração aplicada à simulação; nada foi gravado.");
      return;
    }
    try {
      const course = COURSE_GOALS.find((candidate) => candidate.id === profile.preferredCourse) ?? null;
      const next = await api.updateProfile({
        ...profile,
        courseWeights: course ? courseWeightProfileFor(course, profile.examTrack, profile.focusArea) : null
      });
      setProfile(next);
      await refreshSubjects();
      await recalculate(next.dailyHours);
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

  /** Curso pretendido escolhido no wizard vira a meta persistida de todas as telas. */
  const setPreferredCourse = async (courseId: string | null) => {
    const course = COURSE_GOALS.find((candidate) => candidate.id === courseId) ?? null;
    const next: Profile = { ...profile, preferredCourse: courseId, examTrack: course ? course.track : profile.examTrack };
    if (demoMode) {
      setProfile(next);
      notify(course ? `Meta definida: ${course.label} · ${course.track} (demo).` : "Meta de curso removida (demo).");
      return;
    }
    try {
      const saved = await api.updateProfile({
        ...next,
        courseWeights: course ? courseWeightProfileFor(course, next.examTrack, next.focusArea) : null
      });
      setProfile(saved);
      if (course) await refreshSubjects();
      notify(course ? `Meta definida: ${course.label} · ${course.track}.` : "Meta de curso removida do perfil.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  /** Janela da rota definida no wizard vira a referência persistida que a sinergia e o cronograma leem. */
  const setStudyDates = async (dates: { startDate: string; examDate: string }) => {
    const next: Profile = { ...profile, startDate: dates.startDate, examDate: dates.examDate };
    if (demoMode) {
      setProfile(next);
      notify("Modo demo: datas da rota simuladas, nada foi gravado.");
      return;
    }
    try {
      setProfile(await api.updateProfile(next));
      notify("Datas da rota salvas — semanas restantes e sinergia atualizadas.");
    } catch (error) {
      notify(String(error), "error");
    }
  };

  /** Trilha principal vale na hora — a matriz e as cargas recalculam sem esperar "Salvar configuração". */
  const setExamTrack = async (track: Profile["examTrack"]) => {
    const previous = profile;
    const next: Profile = { ...profile, examTrack: track };
    setProfile(next);
    if (demoMode) {
      notify(`Trilha definida: ${track} (demo).`);
      return;
    }
    try {
      const course = COURSE_GOALS.find((candidate) => candidate.id === next.preferredCourse) ?? null;
      setProfile(await api.updateProfile({
        ...next,
        courseWeights: course ? courseWeightProfileFor(course, next.examTrack, next.focusArea) : null
      }));
      if (course) await refreshSubjects();
      notify(`Trilha definida: ${track} — matriz e cargas recalculadas.`);
    } catch (error) {
      setProfile(previous);
      notify(String(error), "error");
    }
  };

  /** Dias de estudo persistem no clique — a grade da semana acompanha na hora. */
  const setStudyDays = async (days: number[]) => {
    const previous = profile;
    const next: Profile = { ...profile, studyDays: days, weeklyDays: days.length };
    setProfile(next);
    if (demoMode) {
      notify("Dias de estudo atualizados (demo).");
      return;
    }
    try {
      setProfile(await api.updateProfile(next));
      notify(`${days.length} dias de estudo por semana.`);
    } catch (error) {
      setProfile(previous);
      notify(String(error), "error");
    }
  };

  /** Área de ênfase da rota: acompanha o curso escolhido e direciona o catálogo do wizard. */
  const setFocusArea = async (areaId: string | null) => {
    const previous = profile;
    const next: Profile = { ...profile, focusArea: areaId };
    setProfile(next);
    const label = FOCUS_AREAS.find((area) => area.id === areaId)?.label;
    if (demoMode) {
      notify(areaId ? `Ênfase definida: ${label} (demo).` : "Ênfase de área removida (demo).");
      return;
    }
    try {
      const course = COURSE_GOALS.find((candidate) => candidate.id === next.preferredCourse) ?? null;
      setProfile(await api.updateProfile({
        ...next,
        courseWeights: course ? courseWeightProfileFor(course, next.examTrack, next.focusArea) : null
      }));
      if (course) await refreshSubjects();
      notify(areaId ? `Ênfase definida: ${label} — catálogo e pesos do wizard acompanham.` : "Ênfase de área removida da rota.");
    } catch (error) {
      setProfile(previous);
      notify(String(error), "error");
    }
  };

  const openQuestions = useCallback((subjectId: number | null = null) => {
    setQuestionSubjectId(subjectId);
    setQuestionEditor(true);
  }, []);

  const closeQuestions = useCallback(() => {
    setQuestionEditor(false);
    setQuestionSubjectId(null);
  }, []);

  /** Abre o timer de foco com a matéria (e o tempo) já pré-carregados — usado pelos ataques e pela retomada. */
  const openFocus = useCallback((subjectId: number, minutes: number | null) => {
    setFocusPreset({ subjectId, minutes });
    setView("foco");
  }, []);

  /** Deep-link dos ataques: cada aba abre com o estado que o motor sugeriu pré-carregado. */
  const runSynergyAttack = (attack: SynergyAttack) => {
    if (attack.target === "questoes") { openQuestions(attack.subjectId); return; }
    if (attack.kind === "revisar" && attack.subjectId) {
      const nextDue = memoryItems
        .filter((item) => item.subjectId === attack.subjectId && item.dueDate <= today())
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)[0];
      if (nextDue) setMemorySelected(nextDue.id);
      setView("desempenho");
      return;
    }
    if (attack.target === "foco" && attack.subjectId) {
      openFocus(attack.subjectId, attack.minutes);
      return;
    }
    setView(attack.target);
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
      setSubjectTrend(buildDemoSubjectAccuracyTrend(getDemoSubjects()));
      setFocusTrend(buildDemoFocusOverloadTrend(getDemoSubjects()));
      setTrend(demoFilteredTrend(granularity, trendSubjectId, trendTopicId));
      setRetentionOverview(buildDemoRetentionOverview(getDemoSubjects()));
      notify("Modo demonstração ativo — dados fictícios, nada é gravado.");
    } else {
      void loadApp();
    }
  };

  const deleteSubject = async (subject: Subject) => {
    if (!window.confirm(`Remover “${subject.name}”? Materiais relacionados serão mantidos sem disciplina.`)) return;
    if (demoMode) {
      setDemoSubjects(getDemoSubjects().filter((item) => item.id !== subject.id));
      applyDemoState();
      notify("Matéria removida da matriz (demo) — IP, teto diário e buffer recalculados.");
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

  const executed = useMemo(
    () => new Map((dashboard?.subjectPerformance ?? []).map((item) => [item.subjectId, item.studiedMinutes])),
    [dashboard]
  );
  const focus = schedule?.allocations[0];
  const weeklyMinutes = Math.round(profile.dailyHours * profile.weeklyDays * 60);
  const subjectData = dashboard?.subjectPerformance ?? EMPTY_SUBJECT_PERFORMANCE;
  const handleTrendFilter = useCallback((subjectId: number | null, topicId: number | null) => {
    setTrendSubjectId(subjectId);
    setTrendTopicId(topicId);
  }, []);
  const synergy = useMemo(() => buildSynergyBrief({
    today: today(),
    profile,
    subjects,
    ranking,
    performance: subjectData,
    topics,
    materials,
    memoryItems,
    focusPoints: focusTrend,
    weeklyStudyMinutes: dashboard?.weeklyStudyMinutes ?? 0
  }), [profile, subjects, ranking, subjectData, topics, materials, memoryItems, focusTrend, dashboard]);
  const plannedWeights = useMemo(() => buildWeightSuggestions({ subjects, performance: subjectData, profile }), [subjects, subjectData, profile]);
  const weightSuggestions = useMemo(() => plannedWeights.filter((suggestion) => suggestion.delta !== 0), [plannedWeights]);

  /** Retomada rápida: última sessão de foco, leitura em andamento e fila FSRS vencida. */
  const resume = useMemo<ResumeBrief>(() => {
    const lastSession = [...focusSessions]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id - a.id)[0] ?? null;
    const sessionMaterial = lastSession?.materialId != null
      ? materials.find((material) => material.id === lastSession.materialId) ?? null
      : null;
    const reading = sessionMaterial && sessionMaterial.totalPages > 0 && sessionMaterial.currentPage < sessionMaterial.totalPages
      ? sessionMaterial
      : materials.find((material) => material.status === "em_andamento" && material.totalPages > 0 && material.currentPage < material.totalPages) ?? null;
    const dueItems = memoryItems
      .filter((item) => item.dueDate <= today())
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
    return {
      session: lastSession,
      reading,
      readingTopic: reading?.topicId != null ? topics.find((topic) => topic.id === reading.topicId)?.name ?? null : null,
      dueCount: dueItems.length,
      dueFirst: dueItems[0] ?? null
    };
  }, [focusSessions, materials, topics, memoryItems]);

  const recoveryAlerts = useMemo(() => {
    const plannedDays = (profile.studyDays ?? []).length ? profile.studyDays : Array.from({ length: profile.weeklyDays }, (_, index) => index);
    if (!plannedDays.length || !schedule?.allocations.length) return [];
    const orderedDays = [...plannedDays].sort((a, b) => a - b);
    const found: Array<{ date: string; subjectId: number; subjectName: string; minutes: number }> = [];
    for (let offset = 1; offset <= 7; offset += 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const dateKey = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const weekday = (date.getDay() + 6) % 7;
      if (!orderedDays.includes(weekday)) continue;
      const hasFocus = focusTrend.some((point) => point.subjectId === 0 && point.date.slice(0, 10) === dateKey && point.elapsedMinutes > 0);
      if (hasFocus) continue;
      const position = orderedDays.indexOf(weekday);
      const slots = schedule.allocations.filter((_item, index) => index % orderedDays.length === position);
      const prioritized = [...slots].sort((a, b) => (synergy.rows.find((row) => row.subjectId === b.id)?.score ?? 0) - (synergy.rows.find((row) => row.subjectId === a.id)?.score ?? 0));
      const subject = prioritized[0] ?? schedule.allocations[0];
      if (subject) found.push({ date: dateKey, subjectId: subject.id, subjectName: subject.name.split("·")[0].trim(), minutes: Math.max(25, Math.min(60, subject.allocatedMinutes)) });
      if (found.length >= 3) break;
    }
    return found;
  }, [profile.studyDays, profile.weeklyDays, schedule, focusTrend, synergy.rows]);
  const dueAlertItems = memoryItems.filter((item) => item.dueDate <= today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const redAlertItems = synergy.rows.filter((row) => row.score >= 55).sort((a, b) => b.score - a.score).slice(0, 3);
  const alertCount = recoveryAlerts.length + dueAlertItems.length + redAlertItems.length;

  return (
    <div className="app-wrap">
      <CustomTitleBar />
      <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BrainCircuit size={22} /></span><span>SOAA</span></div>
        <p className="brand-caption">Sistema Operacional<br />de Autodidatismo</p>
        <nav className="nav-list" aria-label="Navegação principal">
          <NavItem active={view === "inicio"} icon={<LayoutDashboard />} label="Visão geral" onClick={() => setView("inicio")} />
          <NavItem active={view === "metricas-gerais"} icon={<LineChart />} label="Métricas gerais" onClick={() => setView("metricas-gerais")} />
          <NavItem active={view === "matriz"} icon={<SlidersHorizontal />} label="Matriz de pesos" onClick={() => setView("matriz")} />
          <NavItem active={view === "planejamento"} icon={<CalendarDays />} label="Planejamento" onClick={() => setView("planejamento")} />
          <NavItem active={view === "foco"} icon={<Timer />} label="Foco (Deep Work)" onClick={() => setView("foco")} />
          <NavItem active={view === "pomodoro"} icon={<TimerReset />} label="Pomodoro" onClick={() => setView("pomodoro")} />
          <NavItem active={view === "simulados"} icon={<CalendarCheck />} label="Simulados" onClick={() => setView("simulados")} />
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
            <button className="button primary" onClick={() => openQuestions()} disabled={!subjects.length}>
              <Plus size={17} /> Lançar questões
            </button>
            <div className="alerts-wrap">
              <button className={`icon-button ${alertCount ? "has-alerts" : ""}`} title="Avisos e matérias para recuperar" aria-label={`Avisos: ${alertCount}`} aria-expanded={alertsOpen} onClick={() => setAlertsOpen((open) => !open)}><Bell size={18} />{alertCount > 0 && <span className="alerts-count">{alertCount}</span>}</button>
              {alertsOpen && <div className="alerts-popover" role="dialog" aria-label="Avisos de estudo"><div className="alerts-heading"><strong>Avisos para agir</strong><button className="text-button" onClick={() => setAlertsOpen(false)}>Fechar</button></div>
                {recoveryAlerts.map((item) => <button className="alert-item recovery" key={`recovery-${item.date}`} onClick={() => { setFocusPreset({ subjectId: item.subjectId, minutes: item.minutes }); setView("foco"); setAlertsOpen(false); }}><span className="alert-item-icon"><CalendarDays size={15} /></span><span><strong>Reposição de {item.subjectName}</strong><small>Dia de estudo sem foco registrado em {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}. Abrir bloco de {item.minutes} min.</small></span><Play size={15} /></button>)}
                {redAlertItems.map((item) => <button className="alert-item red" key={`red-${item.subjectId}`} onClick={() => { setView("ranking"); setAlertsOpen(false); }}><span className="alert-item-icon"><AlertTriangle size={15} /></span><span><strong>{item.name} pede atenção</strong><small>Zona vermelha · índice de prioridade {Math.round(item.score)}/100. Abrir ranking e ação recomendada.</small></span><ArrowRight size={15} /></button>)}
                {dueAlertItems.map((item) => <button className="alert-item due" key={`due-${item.id}`} onClick={() => { setMemorySelected(item.id); setView("desempenho"); setAlertsOpen(false); }}><span className="alert-item-icon"><BrainCog size={15} /></span><span><strong>Revisão vencida: {item.concept}</strong><small>{item.subjectName} · revisão espaçada pendente</small></span><ArrowRight size={15} /></button>)}
                {!alertCount && <p className="alerts-empty">Sem reposições ou alertas de revisão agora. O painel acompanha seus dias planejados e registros de foco.</p>}
              </div>}
            </div>
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

        {demoMode && <div className="demo-mode-banner"><Sparkles size={16} /><span><strong>Demonstração interativa</strong> · dados fictícios para explorar a rota, ranking, alertas, Pomodoro e gráficos; suas ações não alteram o banco real.</span><button className="text-button" onClick={toggleDemo}>Voltar aos meus dados</button></div>}

        <div className="pomodoro-route-host" style={{ display: !loading && view === "pomodoro" ? "contents" : "none" }}>
          <PomodoroWorkspace subjects={subjects} demo={demoMode} examTrack={profile.examTrack} preferredCourse={profile.preferredCourse} focusArea={profile.focusArea} onRecordQuestions={openQuestions} onSessionSaved={refreshPomodoroSignals} />
        </div>

        {loading ? <Loading /> : <ViewBoundary view={view}>
          {view === "inicio" && <Overview dashboard={dashboard} schedule={schedule} focus={focus} synergy={synergy} onNavigate={setView} onAttack={runSynergyAttack} resume={resume} onResumeFocus={openFocus} onReviewMemory={(item) => { setMemorySelected(item.id); setView("desempenho"); }} onQuestions={() => openQuestions()} />}
          {view === "metricas-gerais" && <GeneralMetricsView dashboard={dashboard} profile={profile} subjects={subjects} topics={topics} materials={materials} ranking={ranking} trend={generalTrend} subjectTrend={subjectTrend} focusTrend={focusTrend} memoryItems={memoryItems} retention={retentionOverview} synergy={synergy} onNavigate={setView} onOpenReview={() => { const due = memoryItems.filter((item) => item.dueDate <= today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)[0]; if (due) setMemorySelected(due.id); setView("desempenho"); }} />}
          {view === "matriz" && <MatrixView schedule={schedule} subjects={subjects} suggestions={weightSuggestions} onAdd={() => setSubjectEditor(null)} onEdit={setSubjectEditor} onDelete={deleteSubject} onBulkAdd={bulkAddSubjects} onApplyWeights={(chosen) => void applyWeightSuggestions(chosen)} />}
          {view === "planejamento" && <PlanningView profile={profile} schedule={schedule} weeklyMinutes={weeklyMinutes} subjects={subjects} focusTrend={focusTrend} dashboard={dashboard} onProfile={setProfile} onSaveProfile={saveProfile} onSavePlan={savePlan} allocations={allocations} demo={demoMode} onSubjectLevels={(id, current, target) => void updateSubjectLevels(id, current, target)} onSubjectAdded={registerAddedSubject} onSubjectRemoved={removeSubjectFromMatrix} onCourseChange={(courseId) => void setPreferredCourse(courseId)} onDatesChange={(dates) => void setStudyDates(dates)} onTrackChange={(track) => void setExamTrack(track)} onStudyDaysChange={(days) => void setStudyDays(days)} onAreaChange={(areaId) => void setFocusArea(areaId)} />}
          {view === "foco" && <FocusTimerView subjects={subjects} materials={materials} demo={demoMode} preset={focusPreset} onPresetConsumed={() => setFocusPreset(null)} />}
          {view === "simulados" && <SimuladosView track={profile.examTrack} timerSubjectId={focus?.id ?? subjects[0]?.id ?? null} onStartTimer={openFocus} onRecord={() => openQuestions()} />}
          {view === "desempenho" && <PerformanceView dashboard={dashboard} trend={trend} granularity={granularity} onGranularity={setGranularity} onTrendFilter={handleTrendFilter} trendSubjectId={trendSubjectId} trendTopicId={trendTopicId} onRecord={() => openQuestions()} subjects={subjects} topics={topics} schedule={schedule} executed={executed} points={subjectTrend} focusPoints={focusTrend} memoryItems={memoryItems} memoryProjection={memoryProjection} overview={retentionOverview} livestream={livestream} report={report} onMemorySelect={selectMemoryItem} onMemoryCreate={createMemoryItem} onMemoryDelete={deleteMemoryItem} onMemoryReview={reviewMemoryItem} />}
          {view === "avanco" && <AdvancementView subjects={subjects} topics={topics} materials={materials} dashboard={dashboard} onChanged={refreshAdvance} demo={demoMode} />}
          {view === "ranking" && <RankingView ranking={ranking} allocations={allocations} synergyRows={synergy.rows} synergyAttacks={synergy.attacks} onAttack={runSynergyAttack} onChanged={reloadAllocations} demo={demoMode} />}
          {view === "biblioteca" && <LibraryView materials={materials} subjects={subjects} topics={topics} onAdd={() => setMaterialEditor(true)} onDelete={deleteMaterial} onStatus={updateMaterialStatus} demo={demoMode} />}
        </ViewBoundary>}
      </main>

      {toast && <div className={`toast ${toast.tone}`}><AlertCircle size={17} />{toast.message}</div>}
      {subjectEditor !== undefined && <SubjectModal subject={subjectEditor ?? undefined} onClose={() => setSubjectEditor(undefined)} onSaved={async () => { if (demoMode) applyDemoState(); else await refreshSubjects(); setSubjectEditor(undefined); notify("Matriz atualizada."); }} />}
      {materialEditor && <MaterialModal subjects={subjects} topics={topics} onClose={() => setMaterialEditor(false)} onSaved={async () => { if (demoMode) applyDemoState(); else { setMaterials(await api.listMaterials()); setDashboard(await api.getDashboard()); } setMaterialEditor(false); notify("Material adicionado à biblioteca."); }} />}
      {questionEditor && <QuestionModal subjects={subjects} topics={topics} initialSubjectId={questionSubjectId} onClose={closeQuestions} onSaved={async () => { if (demoMode) applyDemoState(); else { setDashboard(await api.getDashboard()); setRanking(await api.getPriorityRanking()); } closeQuestions(); notify("Desempenho registrado."); }} />}
      </div>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Overview({ dashboard, schedule, focus, synergy, onNavigate, onAttack, resume, onResumeFocus, onReviewMemory, onQuestions }: { dashboard: DashboardData | null; schedule: ScheduleResponse | null; focus: ScheduleResponse["allocations"][number] | undefined; synergy: SynergyBrief; onNavigate: (view: View) => void; onAttack: (attack: SynergyAttack) => void; resume: ResumeBrief; onResumeFocus: (subjectId: number, minutes: number | null) => void; onReviewMemory: (item: SpacedRepetitionItem) => void; onQuestions: () => void }) {
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

    <ResumeCard resume={resume} onResumeFocus={onResumeFocus} onReviewMemory={onReviewMemory} onQuestions={onQuestions} onNavigate={onNavigate} />

    <section className="metric-grid">
      <Metric icon={<Timer />} label="Carga semanal" value={minutes(dashboard?.weeklyStudyMinutes ?? 0)} helper="registrada nos últimos 7 dias" accent="indigo" />
      <Metric icon={<Trophy />} label="Acerto global" value={`${accuracy}%`} helper={`${dashboard?.questions.correct ?? 0} de ${dashboard?.questions.total ?? 0} questões`} accent="emerald" />
      <Metric icon={<BookOpen />} label="Biblioteca" value={`${dashboard?.materials.completed ?? 0}/${dashboard?.materials.total ?? 0}`} helper="materiais concluídos" accent="amber" />
      <Metric icon={<BrainCircuit />} label="Matérias ativas" value={`${dashboard?.subjectsCount ?? 0}`} helper="índices calculados ao vivo" accent="pink" />
    </section>

    <SynergyPanel briefing={synergy} onAttack={onAttack} onNavigate={onNavigate} />

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

/** Rótulo humano para datas relativas de retomada ("ontem", "há 3 dias") — no calendário local do usuário. */
function daysAgoLabel(dateIso: string): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const diff = Math.round((Date.parse(`${localToday}T12:00:00`) - Date.parse(`${dateIso}T12:00:00`)) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `há ${diff} dias`;
  const weeks = Math.round(diff / 7);
  return weeks <= 1 ? "há 1 semana" : `há ${weeks} semanas`;
}

/** "Continuar de onde parei": última sessão, leitura em andamento e fila FSRS, com um deep-link de maior retorno. */
function ResumeCard({ resume, onResumeFocus, onReviewMemory, onQuestions, onNavigate }: { resume: ResumeBrief; onResumeFocus: (subjectId: number, minutes: number | null) => void; onReviewMemory: (item: SpacedRepetitionItem) => void; onQuestions: () => void; onNavigate: (view: View) => void }) {
  const { session, reading, readingTopic, dueCount, dueFirst } = resume;
  const readingPct = reading ? Math.min(100, Math.round((reading.currentPage / Math.max(1, reading.totalPages)) * 100)) : 0;
  const primary = session && session.status !== "done"
    ? { label: `Retomar ${session.subjectName}`, icon: <Play size={16} />, run: () => onResumeFocus(session.subjectId, session.plannedMinutes) }
    : dueFirst
      ? { label: `Revisar ${dueCount} ${dueCount === 1 ? "item vencido" : "itens vencidos"}`, icon: <BrainCog size={16} />, run: () => onReviewMemory(dueFirst) }
      : reading
        ? { label: "Continuar leitura", icon: <BookOpen size={16} />, run: () => onNavigate("biblioteca") }
        : { label: "Abrir plano de hoje", icon: <CalendarDays size={16} />, run: () => onNavigate("planejamento") };

  return <section className="card resume-card" data-testid="resume-card">
    <div className="section-heading"><div><p className="eyebrow">Retomada imediata</p><h2>Continuar de onde parei</h2></div><History size={20} /></div>
    <div className="resume-grid">
      <div className="resume-block" data-testid="resume-session">
        <span className="resume-label"><Timer size={13} /> Última sessão de foco</span>
        {session ? <>
          <strong>{session.subjectName}</strong>
          <p>{session.goalText ?? "Bloco de foco"}</p>
          <div className="resume-meta">
            <span className={`resume-chip ${session.status === "done" ? "concluida" : "parcial"}`}>{session.status === "done" ? "Concluída" : "Parcial — retomar"}</span>
            <small>{session.elapsedMinutes}/{session.plannedMinutes} min · {daysAgoLabel(session.startedAt)}</small>
          </div>
        </> : <p className="resume-empty">Nenhuma sessão registrada — comece seu primeiro bloco de deep work.</p>}
      </div>
      <div className="resume-block" data-testid="resume-reading">
        <span className="resume-label"><BookOpen size={13} /> Leitura em andamento</span>
        {reading ? <>
          <strong>{reading.title}</strong>
          <p>{readingTopic ?? reading.category}</p>
          <div className="resume-progress"><i style={{ width: `${readingPct}%` }} /></div>
          <small className="resume-when">pág. {reading.currentPage} de {reading.totalPages} · {readingPct}%</small>
        </> : <p className="resume-empty">Nenhum material com leitura em andamento.</p>}
      </div>
      <div className="resume-block" data-testid="resume-fsrs">
        <span className="resume-label"><BrainCog size={13} /> Fila FSRS</span>
        {dueCount ? <>
          <strong>{dueCount} {dueCount === 1 ? "item vencido" : "itens vencidos"}</strong>
          <p>{dueFirst?.concept}{dueCount > 1 ? ` · +${dueCount - 1} na fila` : ""}</p>
          <div className="resume-meta"><span className="resume-chip vencido">Revisar hoje</span></div>
        </> : <>
          <strong>Fila em dia</strong>
          <p>Nenhuma revisão vencida — siga o plano de hoje.</p>
        </>}
      </div>
    </div>
    <div className="resume-actions">
      <button className="button primary" onClick={primary.run}>{primary.icon} {primary.label}</button>
      <button className="button secondary" onClick={onQuestions}><ClipboardCheck size={16} /> Lançar questões</button>
      <button className="button ghost" onClick={() => onNavigate("foco")}><Timer size={16} /> Deep work</button>
    </div>
  </section>;
}

/** Rótulo curto para links externos ("drive.google.com", "fuvest.br"). */
function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Abrir link"; }
}

const SIM_DURATIONS = [90, 120, 180, 240];

/** Central de simulados: provas oficiais da trilha, cronômetro no timer de foco e registro do resultado. */
function SimuladosView({ track, timerSubjectId, onStartTimer, onRecord }: { track: ExamTrack; timerSubjectId: number | null; onStartTimer: (subjectId: number, minutes: number) => void; onRecord: () => void }) {
  const links = examLinksFor(track);
  const [minutes, setMinutes] = useState(120);
  return <div className="page-stack">
    <section className="card sim-header">
      <div>
        <p className="eyebrow">Modo prova · condição real de tempo</p>
        <h2>Central de simulados</h2>
        <p>Rode uma prova oficial da trilha {track} com cronômetro e registre o resultado em Questões — a acurácia do simulado entra no ranking de prioridade automaticamente.</p>
      </div>
      <div className="sim-timer">
        <label className="field-label">Duração do bloco</label>
        <div className="segmented">{SIM_DURATIONS.map((value) => <button key={value} className={minutes === value ? "active" : ""} onClick={() => setMinutes(value)}>{value} min</button>)}</div>
        <button className="button primary" disabled={!timerSubjectId} onClick={() => { if (timerSubjectId) onStartTimer(timerSubjectId, minutes); }}><Play size={16} /> Iniciar simulado de {minutes} min</button>
        <button className="button secondary" onClick={onRecord}><ClipboardCheck size={16} /> Registrar resultado</button>
      </div>
    </section>
    <section className="card sim-links">
      <div className="section-heading"><div><p className="eyebrow">Provas oficiais · {track}</p><h2>Edições anteriores para baixar</h2></div><CalendarCheck size={20} /></div>
      {links.length ? <div className="sim-grid">{links.map((link) => <article className="sim-card" key={link.id}>
        <span className="sim-org">{link.org}</span>
        <strong>{link.name}</strong>
        <p>{link.note}</p>
        <a className="button ghost sim-open" href={link.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir provas</a>
      </article>)}</div> : <p className="sim-empty">Esta trilha não tem provas oficiais curadas. Vincule seus PDFs e apostilas na Biblioteca com link externo (ex.: pasta do Drive) e monte o simulado por conta própria — o cronômetro e o registro continuam valendo.</p>}
    </section>
  </div>;
}

const SYNERGY_KIND_ICONS: Record<SynergyKind, ReactNode> = {
  revisar: <BrainCog size={16} />,
  questoes: <ClipboardCheck size={16} />,
  foco: <Timer size={16} />,
  topico: <TrendingUp size={16} />,
  leitura: <BookOpen size={16} />,
  simulado: <CalendarCheck size={16} />,
  "criar-itens": <BrainCircuit size={16} />
};

const SYNERGY_KIND_LABELS: Record<SynergyKind, string> = {
  revisar: "Revisão ativa",
  questoes: "Bloco de questões",
  foco: "Deep work",
  topico: "Edital",
  leitura: "Leitura ativa",
  simulado: "Simulado",
  "criar-itens": "Memória"
};

const SYNERGY_ENGINE_LABELS: Record<SynergyEngine, string> = {
  ranking: "Ranking",
  memoria: "FSRS",
  questoes: "Questões",
  cobertura: "Edital",
  foco: "Foco",
  curso: "Curso",
  rota: "Rota"
};

/* Cruza os sinais de todos os módulos e devolve o próximo bloco de maior
   retorno: cada ataque nasce do consenso entre motores e abre a aba que o executa. */
function SynergyPanel({ briefing, onAttack, onNavigate }: { briefing: SynergyBrief; onAttack: (attack: SynergyAttack) => void; onNavigate: (view: View) => void }) {
  const { course, phase, pace, attacks, rows, engines } = briefing;
  const mappedRows = rows.filter((row) => row.score > 0 || row.signals.length);
  const paceTone = pace.ratio >= 80 ? "ok" : pace.ratio >= 50 ? "warn" : "danger";
  return <section className="card synergy-card" data-testid="synergy-card">
    <div className="section-heading"><div><p className="eyebrow">Central de sinergia</p><h2>Ataques de hoje</h2></div><Zap size={20} /></div>
    <div className="synergy-strip">
      {course
        ? <span className="synergy-goal" data-testid="synergy-goal"><Flag size={14} /><strong>{course.label}</strong><em>{course.university} · {course.track} · {course.cutoff}</em></span>
        : <button className="synergy-goal empty" onClick={() => onNavigate("planejamento")}><Flag size={14} /><strong>Sem curso definido</strong><em>abra a Rota da prova e escolha sua meta — o motor calibra o alvo de todas as telas</em></button>}
      {phase.mode && <span className={`synergy-chip phase ${phase.mode}`}>{phase.mode === "reta_final" ? <TimerReset size={13} /> : <CalendarCheck size={13} />}{phase.mode === "reta_final" ? "Reta final" : "Construção"} · {phase.weeksLeft} semana{phase.weeksLeft === 1 ? "" : "s"} até a prova</span>}
      <span className={`synergy-chip pace ${paceTone}`} title={`${minutes(pace.registeredMinutes)} registrados contra ${minutes(pace.plannedMinutes)} planejados`}><Activity size={13} />Ritmo {pace.ratio}% do plano</span>
      {mappedRows.length > 0 && <span className="synergy-chip" title={engines.map((engine) => SYNERGY_ENGINE_LABELS[engine]).join(" · ")}>{engines.length} motores cruzados</span>}
    </div>
    <div className="synergy-attacks">
      {attacks.length ? attacks.map((attack) => (
        <div className="synergy-attack" key={attack.id} data-testid={`synergy-attack-${attack.kind}`}>
          <span className="synergy-attack-icon" style={{ color: color(attack.color), background: `${color(attack.color)}1f` }}>{SYNERGY_KIND_ICONS[attack.kind]}</span>
          <div className="synergy-attack-main">
            <span className="synergy-attack-kind">{SYNERGY_KIND_LABELS[attack.kind]}</span>
            <strong>{attack.title}</strong>
            <p>{attack.detail}</p>
            <div className="synergy-signals">
              {attack.signals.map((signal) => <span className={`signal-chip ${signal.tone}`} key={`${attack.id}-${signal.engine}`}>{signal.label}</span>)}
              {attack.minutes ? <span className="signal-chip time"><Clock3 size={11} />{minutes(attack.minutes)}</span> : null}
              {attack.boost > 0 ? <span className="signal-chip boost">+{attack.boost} pts</span> : null}
            </div>
          </div>
          <button className="button secondary synergy-open" onClick={() => onAttack(attack)}>Executar</button>
        </div>
      )) : <p className="cogn-empty">Nenhum sinal ativo por enquanto: registre matérias, questões e revisões para o motor cruzar os módulos.</p>}
    </div>
    {mappedRows.length > 0 && <details className="synergy-map" data-testid="synergy-map">
      <summary><SlidersHorizontal size={14} /> Índice de sinergia por matéria ({mappedRows.length})</summary>
      <div className="synergy-rows">{mappedRows.slice(0, 8).map((row) => (
        <div className="synergy-row" key={row.subjectId}>
          <span className="synergy-row-name"><i style={{ background: color(row.color) }} />{row.name}</span>
          <div className="synergy-signals">{row.signals.length ? row.signals.slice(0, 3).map((signal) => <span className={`signal-chip ${signal.tone}`} key={`${row.subjectId}-${signal.engine}`}>{signal.label}</span>) : <span className="signal-chip ok">sem pendências ativas</span>}</div>
          <div className="synergy-row-track"><span style={{ width: `${Math.min(100, row.score)}%`, background: color(row.color) }} /></div>
          <b>{row.score}</b>
        </div>
      ))}</div>
    </details>}
    <p className="cogn-footnote"><Zap size={14} /> O índice cruza ranking, FSRS, acerto, edital, foco e meta de curso: resolver um ataque rebaixa o score da matéria e libera o próximo bloco do dia.</p>
  </section>;
}

function MatrixView({ schedule, subjects, suggestions, onAdd, onEdit, onDelete, onBulkAdd, onApplyWeights }: { schedule: ScheduleResponse | null; subjects: Subject[]; suggestions: WeightSuggestion[]; onAdd: () => void; onEdit: (subject: Subject) => void; onDelete: (subject: Subject) => void; onBulkAdd: (group: CatalogGroup) => void; onApplyWeights: (suggestions: WeightSuggestion[]) => void }) {
  const [catalogGroup, setCatalogGroup] = useState<CatalogGroup>("ita-ime");
  const names = new Set(subjects.map((subject) => subject.name));
  const availableInGroup = catalogSubjects.filter((entry) => entry.group === catalogGroup && !names.has(entry.name));
  return <div className="page-stack">
    <section className="card matrix-intro"><div><p className="eyebrow">Motor de priorização ponderada</p><h2>IP = peso estratégico × dificuldade pessoal</h2><p>Os tempos são tetos máximos. Todo bloco é arredondado para cinco minutos sem estourar sua carga; a diferença fica no Project Buffer.</p></div><button className="button primary" onClick={onAdd}><Plus size={17} /> Nova matéria</button></section>
    <section className="card calibration-card">
      <div className="section-heading"><div><p className="eyebrow">Pesos inteligentes</p><h2>Calibração inteligente</h2></div>{suggestions.length > 0 && <button className="button primary" onClick={() => onApplyWeights(suggestions)}><Sparkles size={16} /> Aplicar todos ({suggestions.length})</button>}</div>
      {suggestions.length ? <div className="calibration-list">{suggestions.map((suggestion) => <div className="calibration-row" key={suggestion.subjectId}>
        <span className="subject-cell"><span className="color-dot" style={{ background: color(suggestion.color) }} />{suggestion.name}</span>
        <span className="calibration-weight"><span className="number-badge muted">{suggestion.currentWeight}</span><span aria-hidden="true">→</span><span className="number-badge">{suggestion.suggestedWeight}</span></span>
        <small className="calibration-reason">{suggestion.reasons.join(" · ")}</small>
        <button className="button ghost" onClick={() => onApplyWeights([suggestion])}>Aplicar</button>
      </div>)}</div> : <p className="cogn-empty">Nenhum ajuste pendente — pesos alinhados com desempenho, dificuldade e meta do curso.</p>}
    </section>
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

function PlanningView({ profile, schedule, weeklyMinutes, subjects, focusTrend, dashboard, onProfile, onSaveProfile, onSavePlan, allocations, demo, onSubjectLevels, onSubjectAdded, onSubjectRemoved, onCourseChange, onDatesChange, onTrackChange, onStudyDaysChange, onAreaChange }: { profile: Profile; schedule: ScheduleResponse | null; weeklyMinutes: number; subjects: Subject[]; focusTrend: FocusOverloadPoint[]; dashboard: DashboardData | null; onProfile: (profile: Profile) => void; onSaveProfile: () => void; onSavePlan: () => void; allocations: DayAllocation[]; demo: boolean; onSubjectLevels: (subjectId: number, currentLevel: number, targetLevel: number) => void; onSubjectAdded: (subject: Subject) => void; onSubjectRemoved: (subject: Subject) => boolean; onCourseChange: (courseId: string | null) => void; onDatesChange: (dates: { startDate: string; examDate: string }) => void; onTrackChange: (track: Profile["examTrack"]) => void; onStudyDaysChange: (days: number[]) => void; onAreaChange: (areaId: string | null) => void }) {
  const byDay: DayAllocation[][] = Array.from({ length: 7 }, () => []);
  for (const allocation of allocations) byDay[allocation.weekday].push(allocation);
  const studyDays = Array.isArray(profile.studyDays) && profile.studyDays.length ? profile.studyDays : Array.from({ length: profile.weeklyDays }, (_, index) => index);
  const studySet = new Set(studyDays);
  const toggleStudyDay = (index: number) => {
    const next = studySet.has(index) ? studyDays.filter((day) => day !== index) : [...studyDays, index].sort((a, b) => a - b);
    if (!next.length) return;
    onStudyDaysChange(next);
  };
  /** Datas da rota persistem no clique; o lado vazio completa com hoje (mesmo default do wizard). */
  const changeRouteDate = (key: "startDate" | "examDate", value: string) => {
    if (!value) return;
    onDatesChange({
      startDate: key === "startDate" ? value : profile.startDate ?? today(),
      examDate: key === "examDate" ? value : profile.examDate ?? today()
    });
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
  const examGuide = EXAM_GUIDES[profile.examTrack];
  const targetCourse = COURSE_GOALS.find((course) => course.id === profile.preferredCourse) ?? null;
  const startMonth = profile.startDate ? new Date(profile.startDate + "T12:00:00") : null;
  const endMonth = profile.examDate ? new Date(profile.examDate + "T12:00:00") : null;
  const routeMonths = startMonth && endMonth
    ? Math.max(0, (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + endMonth.getMonth() - startMonth.getMonth())
    : null;
  const setTrajectoryMonths = (months: number) => {
    const start = profile.startDate ?? today();
    const end = new Date(start + "T12:00:00");
    end.setMonth(end.getMonth() + months);
    const endIso = end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, "0") + "-" + String(end.getDate()).padStart(2, "0");
    onDatesChange({ startDate: start, examDate: endIso });
  };
  const cutoff14 = addDaysIso(-13);
  const recentFocus = focusTrend.filter((point) => point.subjectId === 0 && point.date >= cutoff14);
  const focusStats = recentFocus.reduce((total, point) => ({ sessions: total.sessions + point.sessions, planned: total.planned + point.plannedMinutes, elapsed: total.elapsed + point.elapsedMinutes }), { sessions: 0, planned: 0, elapsed: 0 });
  const recentQuestions = (dashboard?.dailyPerformance ?? []).filter((point) => point.date >= cutoff14 && point.total > 0).sort((a, b) => a.date.localeCompare(b.date));
  const questionMid = Math.floor(recentQuestions.length / 2);
  const accuracyOf = (points: typeof recentQuestions) => {
    const total = points.reduce((sum, point) => sum + point.total, 0);
    return total ? points.reduce((sum, point) => sum + point.accuracy * point.total, 0) / total : null;
  };
  const earlyAccuracy = accuracyOf(recentQuestions.slice(0, questionMid));
  const recentAccuracy = accuracyOf(recentQuestions.slice(questionMid));
  const recentQuestionCount = recentQuestions.reduce((sum, point) => sum + point.total, 0);
  const adherence = focusStats.planned ? focusStats.elapsed / focusStats.planned : 0;
  const enoughEvidence = focusStats.sessions >= 6 && recentQuestionCount >= 20;
  const canTryMore = enoughEvidence && adherence >= .85 && (earlyAccuracy === null || recentAccuracy === null || recentAccuracy >= earlyAccuracy - 5);
  const grossStudyMinutes = Math.round(profile.dailyHours * 60 * 1.3);
  const weeklyCapacityHours = profile.dailyHours * Math.max(1, studyDays.length);
  const levelWorkHours = subjects.reduce((total, subject) => {
    const levelsToAdvance = Math.max(0, subject.targetLevel - subject.currentLevel);
    return total + levelsToAdvance * (40 + 10 * subject.difficulty) * (subject.weight / 3);
  }, 0);
  const focusCalendarFactor = focusStats.sessions >= 6 && focusStats.elapsed > 0
    ? Math.min(1.6, Math.max(1, focusStats.planned / focusStats.elapsed))
    : 1.15;
  const accuracyCalendarFactor = recentAccuracy === null ? 1.1 : recentAccuracy < 50 ? 1.2 : recentAccuracy >= 80 ? .9 : 1;
  const suggestedEffortHours = Math.ceil(levelWorkHours * 1.15 * focusCalendarFactor * accuracyCalendarFactor);
  const suggestedWeeks = weeklyCapacityHours > 0 ? Math.ceil(suggestedEffortHours / weeklyCapacityHours) : 0;
  const estimateStart = profile.startDate && profile.startDate > today() ? profile.startDate : today();
  const suggestedEndDate = suggestedWeeks ? addIsoDays(estimateStart, suggestedWeeks * 7) : estimateStart;
  const hasSelectedPeriod = Boolean(profile.startDate && profile.examDate && profile.examDate > profile.startDate);
  const selectedWeeks = hasSelectedPeriod
    ? Math.max(1, Math.ceil((new Date(`${profile.examDate}T12:00:00`).getTime() - new Date(`${profile.startDate}T12:00:00`).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 1;
  const neededHoursPerWeek = suggestedEffortHours / selectedWeeks;
  const deadlineNeedsMoreHours = hasSelectedPeriod && suggestedEffortHours > 0 && neededHoursPerWeek > weeklyCapacityHours;
  const useSuggestedDate = () => onDatesChange({ startDate: estimateStart, examDate: suggestedEndDate });
  const [wizard, setWizard] = useState(false);
  return <div className="page-stack">
    <section className="card route-card">
      <div className="section-heading"><div><p className="eyebrow">Linha de chegada</p><h2>Rota da prova</h2></div><Flag size={20} /></div>
      <div className="setting-fields">
        <label>Trilha principal<select value={profile.examTrack} onChange={(event) => onTrackChange(event.target.value as Profile["examTrack"])}>{EXAM_TRACKS.map((track) => <option key={track}>{track}</option>)}</select></label>
        <label>Curso-alvo<select value={profile.preferredCourse ?? ""} onChange={(event) => onCourseChange(event.target.value || null)}><option value="">— sem meta de curso —</option>{COURSE_GOALS.map((course) => <option key={course.id} value={course.id}>{course.label} · {course.track}</option>)}</select></label>
        <label>Início da trajetória<input type="date" value={profile.startDate ?? ""} onChange={(event) => changeRouteDate("startDate", event.target.value)} /></label>
        <label>Fim da trajetória / prova-alvo<input type="date" value={profile.examDate ?? ""} onChange={(event) => changeRouteDate("examDate", event.target.value)} /></label>
      </div>
      <div className="trajectory-horizon"><div><strong>{routeMonths === null ? "Defina início e fim da trajetória" : routeMonths + " meses de preparação"}</strong><span>O fim pode ser uma meta provisória; atualize quando o calendário oficial da prova for divulgado.</span></div><div className="trajectory-presets" aria-label="Duração da trajetória">{[12, 18, 24, 30].map((months) => <button type="button" key={months} className={routeMonths === months ? "active" : ""} onClick={() => setTrajectoryMonths(months)}>{months} meses</button>)}</div></div>
      {suggestedEffortHours > 0 && <div className={`trajectory-estimate ${deadlineNeedsMoreHours ? "tight" : ""}`}>
        <div><strong>Estimativa de proficiência: {new Date(`${suggestedEndDate}T12:00:00`).toLocaleDateString("pt-BR")}</strong><span>~{suggestedEffortHours} horas líquidas · {suggestedWeeks} semanas, usando níveis, pesos, dificuldade e sua execução/acurácia recentes.</span>
          <small>{deadlineNeedsMoreHours ? `A data atual exige cerca de ${neededHoursPerWeek.toFixed(1)}h por semana, acima das ${weeklyCapacityHours.toFixed(1)}h planejadas. Considere estender o prazo ou ajustar a carga.` : enoughEvidence ? "Estimativa recalibrada com ciclos e questões dos últimos 14 dias; ela muda conforme você registra progresso." : "Estimativa inicial com margem de planejamento. Registre sessões e questões para o app recalibrar pelo seu ritmo."}</small>
        </div><button type="button" className="button secondary" onClick={useSuggestedDate}>Usar data sugerida</button>
      </div>}
      <div className="route-area"><span className="route-area-label">Área de ênfase</span>
        <div className="focus-area-chips">{FOCUS_AREAS.map((candidate) => <button type="button" key={candidate.id} className={`focus-area-chip ${profile.focusArea === candidate.id ? "active" : ""}`} title={candidate.hint} onClick={() => onAreaChange(profile.focusArea === candidate.id ? null : candidate.id)}><Flag size={13} />{candidate.label}{profile.focusArea === candidate.id ? <em>ênfase</em> : null}</button>)}</div>
      </div>
      <div className="exam-profile-card"><div><p className="eyebrow">Perfil da avaliação selecionada</p><h3>{examGuide.title}</h3><p>{examGuide.profile}</p><small>{examGuide.practice} O edital vigente define as regras finais.</small></div><a className="button secondary" href={examGuide.source} target="_blank" rel="noreferrer">{examGuide.sourceLabel}<ExternalLink size={14} /></a></div>
      {targetCourse && <div className="course-readiness-card">
        <div><p className="eyebrow">Meta de formação</p><h3>{targetCourse.label} · {targetCourse.university}</h3><p>O banco guarda prioridade por matéria e nível-alvo; o cronograma, ranking e previsão de tempo usam esses valores em conjunto com a prova escolhida.</p><div className="course-readiness-chips">{targetCourse.emphasis.parents.map((name) => <span key={name}>{name}</span>)}<b>alvo intermediário nas áreas centrais</b></div></div>
        {targetCourse.admissionProfile && profile.examTrack === targetCourse.track ? <div className="course-exam-weight"><strong>{targetCourse.admissionProfile.edition}: áreas do ENEM com peso 1,0 cada</strong><span>O peso de ingresso é separado da ênfase de preparação do curso.</span><a href={targetCourse.admissionProfile.source} target="_blank" rel="noreferrer">Termo oficial · UFMG 2026 <ExternalLink size={12} /></a></div> : <div className="course-exam-weight"><strong>Pesos oficiais de ingresso não carregados para esta combinação</strong><span>O app mantém o peso de preparação do curso e usa o edital vigente da prova para o cálculo de ingresso.</span></div>}
      </div>}
    </section>
    <section className="card settings-card"><div className="section-heading"><div><p className="eyebrow">Capacidade real</p><h2>Configure sua semana</h2></div><div className="heading-actions"><button className="button ghost" onClick={() => setWizard(true)}><CalendarCheck size={16} /> Rota da prova</button><button className="button primary" onClick={onSaveProfile}><Save size={16} /> Salvar configuração</button></div></div>
      <div className="setting-fields"><label>Horas líquidas de foco por dia<input type="number" min="0.5" max="24" step="0.5" value={profile.dailyHours} onChange={(event) => onProfile({ ...profile, dailyHours: Math.max(.5, Math.min(24, Number(event.target.value) || .5)) })} /><small>Tempo efetivamente focado, sem contar pausas.</small></label><label>Dias de estudo/semana<div className="day-picker">{WEEKDAY_NAMES.map((dayName, index) => <button type="button" key={dayName} className={`day-tick ${studySet.has(index) ? "active" : ""}`} onClick={() => toggleStudyDay(index)}>{dayName}</button>)}</div></label><div className="weekly-total"><span>Tempo semanal planejado</span><strong>{minutes(weeklyMinutes)}</strong></div></div>
      <div className="hour-presets">{[4, 6, 8, 10, 12].map((hours) => <button type="button" key={hours} className={profile.dailyHours === hours ? "active" : ""} onClick={() => onProfile({ ...profile, dailyHours: hours })}>{hours}h líquidas</button>)}</div>
      <div className="hours-insight"><Clock3 size={17} /><div><strong>{profile.dailyHours}h líquidas ≈ {minutes(grossStudyMinutes)} reservadas</strong><span>Estimativa com blocos 25/5 e pausa longa após 4 ciclos. O tempo bruto real depende do ritmo e das pausas feitas.</span></div></div>
      <div className={`productivity-coach ${canTryMore ? "ready" : "cautious"}`}><div><p className="eyebrow">Recomendação baseada no seu histórico recente</p><strong>{!enoughEvidence ? "Ainda faltam dados para sugerir mais horas" : canTryMore ? "Há sinal para testar um pequeno aumento" : "Mantenha a carga e ajuste a execução antes de aumentar"}</strong><span>{focusStats.sessions} ciclos · {recentQuestionCount} questões · {focusStats.planned ? Math.round(adherence * 100) + "% do foco planejado executado" : "sem carga de foco planejada registrada"}{recentAccuracy !== null ? " · acerto recente " + Math.round(recentAccuracy) + "%" : ""}</span><small>{!enoughEvidence ? "Registre pelo menos 6 ciclos e 20 questões nos últimos 14 dias para comparar foco, interrupções e acerto." : canTryMore ? "Teste apenas +30 min por dia por uma semana e compare conclusão, interrupções e acerto antes de manter o aumento." : "As horas não são reduzidas automaticamente. Reveja pausas, matérias em alerta e blocos interrompidos."}</small></div>{canTryMore && <button className="button secondary" onClick={() => onProfile({ ...profile, dailyHours: Math.min(24, profile.dailyHours + .5) })}>Preparar teste +30 min</button>}</div>
    </section>
    <section className="card subject-milestones-card">
      <div className="section-heading"><div><p className="eyebrow">Trajetória por matéria</p><h2>Ponto de partida e nível-alvo</h2></div><Target size={20} /></div>
      <p className="muted-text">Escolha um dos quatro níveis em cada matéria. O curso-alvo sugere uma meta de preparação, mas você pode ajustar tanto o ponto de partida quanto o alvo.</p>
      {subjects.length ? <div className="milestone-list">{subjects.map((subject) => <div className="milestone-row" key={subject.id}>
        <i style={{ background: color(subject.color) }} /><strong>{subject.name.split("·")[0].trim()}</strong>
        <label>Hoje<select aria-label={`Nível atual em ${subject.name}`} value={subject.currentLevel} onChange={(event) => onSubjectLevels(subject.id, Number(event.target.value), subject.targetLevel)}>{PROFICIENCY_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.value} · {level.label}</option>)}</select></label>
        <span className="milestone-arrow">→</span>
        <label>Meta<select aria-label={`Nível-alvo em ${subject.name}`} value={subject.targetLevel} onChange={(event) => onSubjectLevels(subject.id, subject.currentLevel, Number(event.target.value))}>{PROFICIENCY_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.value} · {level.label}</option>)}</select></label>
        <span className={`milestone-status ${subject.currentLevel >= subject.targetLevel ? "reached" : "open"}`}>{subject.currentLevel >= subject.targetLevel ? "Meta atingida" : subject.targetLevel - subject.currentLevel + " nível(is) a avançar"}</span>
      </div>)}</div> : <p className="cogn-empty">Adicione matérias à matriz para definir marcos de domínio.</p>}
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
    {wizard && <PlanWizard subjects={subjects} profile={profile} onClose={() => setWizard(false)} demo={demo} onSubjectAdded={onSubjectAdded} onSubjectRemoved={onSubjectRemoved} onCourseChange={onCourseChange} onDatesChange={onDatesChange} onAreaChange={onAreaChange} />}
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

/* Memoizado: os gráficos do recharts só re-renderizam quando um dado do painel muda. */
const PerformanceView = memo(({ dashboard, trend, granularity, onGranularity, onTrendFilter, trendSubjectId, trendTopicId, onRecord, subjects, topics, schedule, executed, points, focusPoints, memoryItems, memoryProjection, overview, livestream, report, onMemorySelect, onMemoryCreate, onMemoryDelete, onMemoryReview }: { dashboard: DashboardData | null; trend: PerformancePoint[]; granularity: PerformanceGranularity; onGranularity: (granularity: PerformanceGranularity) => void; onTrendFilter: (subjectId: number | null, topicId: number | null) => void; trendSubjectId: number | null; trendTopicId: number | null; onRecord: () => void; subjects: Subject[]; topics: Topic[]; schedule: ScheduleResponse | null; executed: Map<number, number>; points: SubjectAccuracyPoint[]; focusPoints: FocusOverloadPoint[]; memoryItems: SpacedRepetitionItem[]; memoryProjection: MemoryDecayProjection | null; overview: RetentionOverview | null; livestream: RetentionLiveStream | null; report: ConsolidatedPerformanceReport | null; onMemorySelect: (id: number) => void; onMemoryCreate: (input: MemoryItemInput) => void; onMemoryDelete: (id: number) => void; onMemoryReview: (id: number, grade: ReviewGrade) => void }) => {
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
});

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

  return <div className="page-stack"><section className="card library-header"><div><p className="eyebrow">Curadoria técnica</p><h2>Biblioteca de materiais</h2><p>Vincule livros, PDFs, cursos e listas à disciplina e ao tópico que eles fortalecem.</p></div><button className="button primary" onClick={onAdd}><FolderPlus size={17} /> Cadastrar material</button></section>{materials.length ? <><section className="material-grid">{materials.map((material) => { const subject = subjects.find((item) => item.id === material.subjectId); const topic = material.topicId ? topicById.get(material.topicId) : undefined; const pagePercent = material.totalPages ? Math.min(100, Math.round(material.currentPage / material.totalPages * 100)) : null; return <article className="material-card card" key={material.id}><div className="material-top"><span className="material-category">{material.category}</span><button className="icon-button danger" title="Remover material" onClick={() => onDelete(material)}><Trash2 size={16} /></button></div><h3>{material.title}</h3><p className="material-subject">{subject ? subject.name : "Sem disciplina vinculada"}{topic ? ` · ${topic.name}` : ""}</p><div className="tags">{material.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>{pagePercent !== null && <div className="page-track"><div className="page-track-row"><span>Leitura</span><small>{material.currentPage} / {material.totalPages} págs · {pagePercent}%</small></div><div className="progress-inline"><span style={{ width: `${pagePercent}%`, background: subject ? color(subject.color) : "#60a5fa" }} /></div></div>}<div className="material-footer"><select value={material.status} onChange={(event) => onStatus(material, event.target.value as MaterialStatus)}><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluido">Concluído</option></select>{material.urlPath && <a className="path-link" href={material.urlPath} target="_blank" rel="noreferrer" title={material.urlPath}><ExternalLink size={13} /> {linkHost(material.urlPath)}</a>}</div></article>; })}</section>{strategies.length > 0 && <section className="card strategy-section"><div className="section-heading"><div><p className="eyebrow">Estratégias sugeridas</p><h2>Como estudar cada material</h2><p className="cogn-footnote">O matching usa palavras-chave curradas no cadastro — <em>interleaving</em>, <em>spaced repetition</em>, <em>active recall</em>, <em>quesões</em>, <em>teoria</em>.</p></div><BrainCog size={20} /></div><div className="strategy-grid">{materials.map((material) => { const subject = subjects.find((item) => item.id === material.subjectId); const strategy = strategyFor(material); return strategy ? <div className="strategy-card" key={material.id}><span className="color-dot" style={{ background: subject ? color(subject.color) : "#60a5fa" }} /><div><strong>{material.title}</strong><span>{strategy.tactic}</span><small>{strategy.reason}</small></div><span className={`strategy-badge ${strategy.intensity}`}>{strategy.intensity}</span></div> : null; })}</div></section>}</> : <EmptyState icon={<FolderPlus />} text="Sua biblioteca está vazia. Cadastre seu primeiro material." action={<button className="button primary" onClick={onAdd}><FolderPlus size={17} /> Cadastrar material</button>} />}</div>;
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

function QuestionModal({ subjects, topics, initialSubjectId, onClose, onSaved }: { subjects: Subject[]; topics: Topic[]; initialSubjectId?: number | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<QuestionResultInput>(() => {
    const preferred = initialSubjectId && subjects.some((subject) => subject.id === initialSubjectId) ? initialSubjectId : subjects[0]?.id ?? 0;
    return { subjectId: preferred, topicId: null, date: today(), questionsTotal: 20, questionsCorrect: 0, studiedMinutes: 60 };
  }); const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await api.recordQuestionResult(form); await onSaved(); } catch (error) { window.alert(String(error)); } finally { setSaving(false); } };
  return <Modal title="Lançar bloco de questões" onClose={onClose}><form onSubmit={save} className="form-stack"><label>Disciplina<select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: Number(event.target.value), topicId: null })}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Área dentro da matéria (opcional)<select value={form.topicId ?? ""} disabled={!topics.some((topic) => topic.subjectId === form.subjectId)} onChange={(event) => setForm({ ...form, topicId: event.target.value ? Number(event.target.value) : null })}>{topics.some((topic) => topic.subjectId === form.subjectId) ? [<option key="none" value="">Toda a matéria</option>, ...topics.filter((topic) => topic.subjectId === form.subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)] : [<option key="none" value="">Sem áreas nesta matéria</option>]}</select></label><div className="form-two"><label>Data<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Tempo de estudo (min)<input type="number" min="0" value={form.studiedMinutes} onChange={(event) => setForm({ ...form, studiedMinutes: Number(event.target.value) })} /></label><label>Total de questões<input type="number" min="1" value={form.questionsTotal} onChange={(event) => setForm({ ...form, questionsTotal: Number(event.target.value) })} /></label><label>Acertos<input type="number" min="0" max={form.questionsTotal} value={form.questionsCorrect} onChange={(event) => setForm({ ...form, questionsCorrect: Number(event.target.value) })} /></label></div><p className="form-hint">Taxa do bloco: <strong>{form.questionsTotal ? Math.round(form.questionsCorrect / form.questionsTotal * 100) : 0}%</strong></p><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Registrar resultado"}</button></div></form></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</section></div>; }
function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) { return <div className="empty-state"><div>{icon}</div><p>{text}</p>{action}</div>; }

/* Isola falhas de render de uma aba: o erro fica contido no painel e a navegação continua viva. */
class ViewBoundary extends Component<{ view: View; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(previous: { view: View }) {
    if (previous.view !== this.props.view && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return <div className="card view-error" role="alert">
        <AlertTriangle size={22} />
        <div><strong>Esta aba não conseguiu renderizar.</strong><span>{this.state.error.message}</span></div>
        <button className="button secondary" onClick={() => this.setState({ error: null })}>Tentar de novo</button>
      </div>;
    }
    return this.props.children;
  }
}

function Loading() { return <div className="skeleton-shell" role="status" aria-busy="true"><div className="skeleton-hero card"><span className="skeleton-block title" /><span className="skeleton-block line" /><span className="skeleton-block line short" /></div><div className="skeleton-grid">{[0, 1, 2, 3].map((index) => <div className="skeleton-card card" key={index}><span className="skeleton-block chip" /><span className="skeleton-block value" /><span className="skeleton-block line short" /></div>)}</div><div className="skeleton-caption"><BrainCircuit size={16} /> Abrindo seu sistema de estudos…</div></div>; }
function titleFor(view: View) { return ({ inicio: "Visão geral", "metricas-gerais": "Métricas gerais", matriz: "Matriz de priorização", planejamento: "Planejamento semanal", foco: "Foco · Deep Work", pomodoro: "Pomodoro", simulados: "Simulados", desempenho: "Desempenho", avanco: "Avanço por matéria", ranking: "Ranking de prioridade", biblioteca: "Biblioteca" })[view]; }
const tooltipStyle = { background: "#111d2d", border: "1px solid #2b3e57", borderRadius: 10, color: "#eff6ff" };
