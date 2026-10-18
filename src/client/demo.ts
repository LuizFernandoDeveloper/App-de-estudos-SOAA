import type {
  BrainDumpLog,
  BufferAllocation,
  DashboardData,
  DayAllocation,
  FocusOverloadPoint,
  FocusSession,
  MaterialStrategy,
  MemoryDecayProjection,
  PerformanceGranularity,
  PerformancePoint,
  PlanDay,
  PlanFocus,
  PlanPhase,
  PlanResponse,
  Profile,
  ReschedulePlan,
  RetentionLiveStream,
  RetentionLiveTick,
  RetentionOverview,
  ScheduleResponse,
  SpacedRepetitionItem,
  StudyMaterial,
  Subject,
  SubjectAccuracyPoint,
  SubjectRanking,
  TimeboxSuggestion,
  Topic,
  ExamTrack
} from "../shared/types";
import { buildRetentionOverview } from "./retentionData";
import { catalogSubjects, catalogToSubjects, courseGoalById, EXAM_TRACK_GROUPS, sequenceByParent, type CatalogGroup, type CourseGoal } from "./catalog";

/* Feito para pré-visualização: dados fictícios determinísticos, sempre
   relativos a hoje. Nenhuma chamada ao backend é feita no modo demo.

   A matriz demo é o tronco ENEM completo (Ciências, Humanas e Linguagens)
   somado à extensão de Engenharia Aeroespacial do curso preferido, e é
   mutável como no app real: adicionar ou remover matérias recalcula IP,
   teto diário, participação percentual e Project Buffer na hora. */

const pad = (value: number) => String(value).padStart(2, "0");
const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Desloca uma data ISO em dias sem consultar o relógio da máquina: é a base
 * determinística dos testes (o resto do arquivo segue sempre relativo a hoje). */
export const shiftIso = (iso: string, days: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return fmt(date);
};
export const todayIso = () => fmt(new Date());
export const addDaysIso = (days: number) => shiftIso(todayIso(), days);

/** Mesma formatação de `scheduler.rs::format_minutes` (valores inteiros em minutos). */
const formatMinutes = (value: number) => {
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (!hours) return `${remaining}m`;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
};

export const DEMO_COURSE_ID = "eng-aeroespacial";

export const demoProfile: Profile = { dailyHours: 6, weeklyDays: 6, examTrack: "ENEM", startDate: addDaysIso(-120), examDate: addDaysIso(92), studyDays: [0, 1, 2, 3, 4, 5], preferredCourse: DEMO_COURSE_ID, focusArea: null };

/* ---------------------------------------------------------------- */
/* Matriz híbrida ENEM + Aeroespacial (mutável)                      */
/* ---------------------------------------------------------------- */

const demoCourse = courseGoalById(DEMO_COURSE_ID);

/** Grupos de catálogo de uma trilha somados à extensão da meta de curso.
 * Exportado porque o caso "sem extensão" (curso ausente ou sem extensão) é
 * comportamento real e precisa ser exercitável fora do escopo de módulo. */
export const demoGroupsFor = (track: ExamTrack, course: CourseGoal | null): Set<CatalogGroup> =>
  new Set([...EXAM_TRACK_GROUPS[track], ...(course?.extension ? [course.extension] : [])]);

const demoGroups = demoGroupsFor(demoProfile.examTrack, demoCourse);

/** Tronco ENEM (grupos `enem` + `linguagens`) + extensão de Engenharia Aeroespacial do curso preferido. */
export const buildDemoMatrix = (): Subject[] =>
  catalogToSubjects()
    .filter((_, index) => demoGroups.has(catalogSubjects[index].group))
    .map((subject, index) => ({ ...subject, id: index + 1 }));

let demoMatrixStore: Subject[] = buildDemoMatrix();

export const getDemoSubjects = (): Subject[] => demoMatrixStore;
export const setDemoSubjects = (subjects: Subject[]): void => { demoMatrixStore = subjects; };
export const resetDemoSubjects = (): void => { demoMatrixStore = buildDemoMatrix(); };

/** Instantâneo inicial — âncora dos fixtures e do backend falso dos testes. */
export const demoSubjects: Subject[] = demoMatrixStore;

/** Ancoragem por nome: exportada para que o erro de catálogo desalinhado
 * (nome que não existe) seja um caminho testado, e não um ramo morto. */
export const subjectByName = (name: string): Subject => {
  const found = demoSubjects.find((entry) => entry.name === name);
  if (!found) throw new Error(`Matéria ausente do catálogo demo: ${name}`);
  return found;
};

/* Âncoras por nome: mudanças de id no catálogo não deslocam os fixtures. */
const GEO = subjectByName("Matemática ENEM · Geometria Plana e Espacial");
const MEC = subjectByName("Física ENEM · Mecânica");
const ORG = subjectByName("Química ENEM · Ambiental e Orgânica");
const POR = subjectByName("Português · Gramática e Norma Culta");
const ENG = subjectByName("Inglês · Grammar and Usage");
const COMP = subjectByName("Aeroespacial · Computação Científica (Python e C++)");
const AERO = subjectByName("Aeroespacial · Aerodinâmica Básica");

/* ---------------------------------------------------------------- */
/* Cronograma semanal (matriz + planejamento) — réplica do           */
/* `scheduler.rs::calculate_schedule`: blocos de 5 min distribuídos  */
/* pelo maior resto, desempate pelo maior IP, buffer = sobra.        */
/* ---------------------------------------------------------------- */

export function buildDemoSchedule(subjectList: Subject[], totalHours: number): ScheduleResponse {
  const totalMinutes = Math.round(totalHours * 60);
  const totalIp = subjectList.reduce((sum, subject) => sum + subject.computedIp, 0);
  if (!subjectList.length || totalIp <= 0) {
    return { totalHours, totalMinutes, totalIp, projectBufferMinutes: totalMinutes, formattedProjectBuffer: formatMinutes(totalMinutes), allocations: [] };
  }
  const exact = subjectList.map((subject) => (subject.computedIp / totalIp) * totalMinutes);
  const allocated = exact.map((minutes) => Math.floor(minutes / 5) * 5);
  const baseTotal = allocated.reduce((sum, value) => sum + value, 0);
  const blocksToDistribute = Math.max(0, Math.floor((totalMinutes - baseTotal) / 5));
  const byRemainder = subjectList.map((_, index) => index).sort((left, right) => {
    const remainderDiff = (exact[right] % 5) - (exact[left] % 5);
    if (remainderDiff !== 0) return remainderDiff;
    const ipDiff = subjectList[right].computedIp - subjectList[left].computedIp;
    return ipDiff !== 0 ? ipDiff : left - right;
  });
  for (const index of byRemainder.slice(0, blocksToDistribute)) allocated[index] += 5;
  const allocatedTotal = allocated.reduce((sum, value) => sum + value, 0);
  const projectBufferMinutes = totalMinutes - allocatedTotal;
  return {
    totalHours,
    totalMinutes,
    totalIp,
    projectBufferMinutes,
    formattedProjectBuffer: formatMinutes(projectBufferMinutes),
    allocations: subjectList.map((subject, index) => ({
      ...subject,
      exactMinutes: exact[index],
      allocatedMinutes: allocated[index],
      formattedTime: formatMinutes(allocated[index]),
      percentage: Math.round((subject.computedIp / totalIp) * 1000) / 10
    }))
  };
}

export const demoSchedule: ScheduleResponse = buildDemoSchedule(demoSubjects, demoProfile.dailyHours * demoProfile.weeklyDays);

/* ---------------------------------------------------------------- */
/* Tópicos e materiais                                               */
/* ---------------------------------------------------------------- */

export const demoTopicList: Topic[] = [
  { id: 11, userId: 1, subjectId: GEO.id, name: "Geometria plana · triângulos", status: "concluido", createdAt: addDaysIso(-90) },
  { id: 12, userId: 1, subjectId: GEO.id, name: "Círculos e ângulos", status: "em_andamento", createdAt: addDaysIso(-40) },
  { id: 13, userId: 1, subjectId: GEO.id, name: "Geometria espacial", status: "pendente", createdAt: addDaysIso(-10) },
  { id: 21, userId: 1, subjectId: MEC.id, name: "Cinemática", status: "concluido", createdAt: addDaysIso(-80) },
  { id: 22, userId: 1, subjectId: MEC.id, name: "Leis de Newton", status: "em_andamento", createdAt: addDaysIso(-30) },
  { id: 23, userId: 1, subjectId: MEC.id, name: "Trabalho e energia", status: "pendente", createdAt: addDaysIso(-6) },
  { id: 31, userId: 1, subjectId: ORG.id, name: "Cadeias carbônicas", status: "em_andamento", createdAt: addDaysIso(-25) },
  { id: 32, userId: 1, subjectId: ORG.id, name: "Funções orgânicas", status: "pendente", createdAt: addDaysIso(-5) },
  { id: 41, userId: 1, subjectId: POR.id, name: "Concordância verbal", status: "em_andamento", createdAt: addDaysIso(-20) },
  { id: 51, userId: 1, subjectId: ENG.id, name: "Phrasal verbs", status: "concluido", createdAt: addDaysIso(-60) },
  { id: 61, userId: 1, subjectId: COMP.id, name: "Métodos numéricos em Python", status: "em_andamento", createdAt: addDaysIso(-12) },
  { id: 71, userId: 1, subjectId: AERO.id, name: "Sustentação e arrasto", status: "em_andamento", createdAt: addDaysIso(-15) }
];

export const demoMaterialList: StudyMaterial[] = [
  { id: 101, userId: 1, subjectId: GEO.id, topicId: 12, title: "Fundamentos da Matemática Elementar · Vol. 9", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["geometria", "enem"], front: null, topic: null, pageFocus: null, currentPage: 214, totalPages: 380, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-70) },
  { id: 102, userId: 1, subjectId: MEC.id, topicId: 22, title: "Tópicos de Física · Vol. 1", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["mecânica", "enem"], front: null, topic: null, pageFocus: null, currentPage: 180, totalPages: 460, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-60) },
  { id: 103, userId: 1, subjectId: ORG.id, topicId: 31, title: "Química Orgânica · Usberco", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["orgânica"], front: null, topic: null, pageFocus: null, currentPage: 96, totalPages: 520, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-35) },
  { id: 104, userId: 1, subjectId: POR.id, topicId: 41, title: "Gramática da Língua Portuguesa", category: "Livro", urlPath: null, status: "concluido" as const, tags: ["gramática"], front: null, topic: null, pageFocus: null, currentPage: 320, totalPages: 320, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-75) },
  { id: 105, userId: 1, subjectId: ENG.id, topicId: null, title: "English in Use · Intermediate", category: "Curso", urlPath: null, status: "em_andamento" as const, tags: ["vocabulário"], front: null, topic: null, pageFocus: null, currentPage: 0, totalPages: 0, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-50) },
  { id: 106, userId: 1, subjectId: COMP.id, topicId: 61, title: "Numerical Recipes — The Art of Scientific Computing", category: "PDF / Apostila", urlPath: "https://numerical.recipes/", status: "pendente" as const, tags: ["cálculo numérico"], front: null, topic: null, pageFocus: null, currentPage: 40, totalPages: 730, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-8) },
  { id: 107, userId: 1, subjectId: GEO.id, topicId: 13, title: "250 Questões de Geometria Plana e Espacial", category: "Lista de exercícios", urlPath: null, status: "pendente" as const, tags: ["questões", "enem"], front: null, topic: null, pageFocus: null, currentPage: 0, totalPages: 250, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-3) },
  { id: 108, userId: 1, subjectId: AERO.id, topicId: 71, title: "Fundamentos de Aerodinâmica (Anderson)", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["aerodinâmica", "performance"], front: null, topic: null, pageFocus: null, currentPage: 40, totalPages: 520, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-15) }
];

/* ---------------------------------------------------------------- */
/* Agenda de reforço (por dia da semana)                             */
/* ---------------------------------------------------------------- */

export const demoDayAllocations: DayAllocation[] = [
  { id: 901, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, weekday: 5, minutes: 120, note: "Dia calmo para resolver questões de geometria" },
  { id: 902, subjectId: MEC.id, subjectName: MEC.name, color: MEC.color, weekday: 3, minutes: 90, note: "Revisão de mecânica com foco em cinemática" },
  { id: 903, subjectId: ENG.id, subjectName: ENG.name, color: ENG.color, weekday: 0, minutes: 60, note: "Manutenção leve de vocabulário" }
];

/* ---------------------------------------------------------------- */
/* Dashboard                                                         */
/* ---------------------------------------------------------------- */

const dailyAccuracy = [50, 54, 52, 58, 61, 60, 65, 68, 66, 71, 74, 73, 79, 85];

export const buildDemoDashboard = (subjectList: Subject[], schedule: ScheduleResponse, materials: StudyMaterial[] = demoMaterialList): DashboardData => ({
  profile: { ...demoProfile, dailyHours: Number((schedule.totalMinutes / 60 / Math.max(demoProfile.weeklyDays, 1)).toFixed(1)) },
  subjectsCount: subjectList.length,
  materials: { total: materials.length, completed: materials.filter((material) => material.status === "concluido").length },
  questions: { total: 1480, correct: 1049, accuracy: 71 },
  weeklyStudyMinutes: schedule.totalMinutes,
  dailyPerformance: dailyAccuracy.map((accuracy, index) => ({
    date: addDaysIso(-(dailyAccuracy.length - 1 - index)),
    accuracy,
    total: 18 + (index % 5) * 6
  })),
  subjectPerformance: subjectList.map((subject, index) => {
    const accuracy = Math.max(45, Math.min(96, subject.goalAccuracy - (index % 7) * 3));
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color,
      questionsTotal: 40 + ((index * 37) % 360),
      questionsCorrect: Math.round((40 + ((index * 37) % 360)) * accuracy / 100),
      accuracy,
      studiedMinutes: 60 + ((index * 53) % 300)
    };
  }),
  reminders: []
});

export const demoDashboard: DashboardData = buildDemoDashboard(demoSubjects, demoSchedule);

/* ---------------------------------------------------------------- */
/* Ranking                                                           */
/* ---------------------------------------------------------------- */

export const buildDemoRanking = (subjectList: Subject[]): SubjectRanking[] => {
  const movements: SubjectRanking["movement"][] = ["up", "down", "same", "new"];
  return subjectList
    .map((subject, index) => {
      const strategyScore = Math.round((0.7 + ((index * 13) % 30) / 10) * 10) / 10;
      const deficitScore = Math.round((0.5 + ((index * 7) % 35) / 10) * 10) / 10;
      const volumeScore = Math.round((0.4 + ((index * 11) % 25) / 10) * 10) / 10;
      const trendScore = Math.round((0.3 + ((index * 5) % 20) / 10) * 10) / 10;
      const priorityScore = Math.round((strategyScore + deficitScore + volumeScore + trendScore + Math.min(1.5, subject.difficulty / 5)) * 10) / 10;
      const accuracy = Math.max(45, Math.min(96, subject.goalAccuracy - (index % 6) * 3));
      const questionsTotal = 40 + ((index * 37) % 360);
      return {
        ...subject,
        rank: 0,
        movement: movements[index % movements.length],
        strategyScore,
        deficitScore,
        volumeScore,
        trendScore,
        priorityScore,
        accuracy,
        recentAccuracy: Math.max(40, Math.min(98, accuracy + ((index % 4) - 1) * 2)),
        previousAccuracy: Math.max(40, Math.min(98, accuracy - ((index % 3)) * 3)),
        questionsTotal,
        studiedMinutes: 60 + ((index * 53) % 300)
      };
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

export const demoRanking: SubjectRanking[] = buildDemoRanking(demoSubjects);

/* ---------------------------------------------------------------- */
/* Tendências de desempenho e sobrecarga de foco                     */
/* ---------------------------------------------------------------- */

export function demoFilteredTrend(granularity: PerformanceGranularity, subjectId: number | null = null, _topicId: number | null = null): PerformancePoint[] {
  const offset = subjectId !== null ? (subjectId % 4) * 3 : 0;
  const series: Record<PerformanceGranularity, Array<{ label: string; accuracy: number; volume: number }>> = {
    day: dailyAccuracy.map((accuracy, index) => ({ label: addDaysIso(-(dailyAccuracy.length - 1 - index)).slice(5), accuracy: Math.min(96, accuracy + offset), volume: 18 + (index % 5) * 6 })),
    week: [54, 58, 60, 63, 65, 68, 71, 76].map((accuracy, index) => ({ label: String(index + 1), accuracy: Math.min(96, accuracy + offset), volume: 90 + index * 14 })),
    month: [55, 58, 61, 65, 68, 73].map((accuracy, index) => ({ label: String(index + 1), accuracy: Math.min(96, accuracy + offset), volume: 240 + index * 30 })),
    year: [61, 76].map((accuracy, index) => ({ label: String(index + 1), accuracy: Math.min(96, accuracy + offset), volume: 700 + index * 260 }))
  };
  return series[granularity].map((point) => ({
    label: point.label,
    startDate: addDaysIso(-(granularity === "day" ? 14 - dailyAccuracy.length : 60)),
    questionsTotal: point.volume,
    questionsCorrect: Math.round(point.volume * point.accuracy / 100),
    accuracy: point.accuracy
  }));
}

export const buildDemoSubjectAccuracyTrend = (subjectList: Subject[]): SubjectAccuracyPoint[] => {
  const days = 6;
  const points: SubjectAccuracyPoint[] = [];
  for (let day = days - 1; day >= 0; day--) {
    for (const subject of subjectList) {
      const glide = subject.id % 3;
      const dayShift = (day * 2) % 18;
      points.push({
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color,
        date: addDaysIso(-day),
        questionsTotal: 20 + ((subject.id * 3 + day) % 6) * 6,
        accuracy: Math.max(45, Math.min(96, subject.goalAccuracy - 14 + glide + dayShift))
      });
    }
  }
  return points;
};

export const demoSubjectAccuracyTrend: SubjectAccuracyPoint[] = buildDemoSubjectAccuracyTrend(demoSubjects);

export const buildDemoFocusOverloadTrend = (subjectList: Subject[]): FocusOverloadPoint[] => {
  const days = 7;
  const points: FocusOverloadPoint[] = [];
  for (let day = days - 1; day >= 0; day--) {
    const progress = (days - 1 - day) / (days - 1);
    points.push({
      subjectId: 0,
      subjectName: "Geral",
      color: "#94a3b8",
      date: addDaysIso(-day),
      sessions: 2 + (day % 3),
      plannedMinutes: 120,
      elapsedMinutes: Math.round(120 * (68 + progress * 20 + (day % 3) * 4)),
      completionRate: 68 + progress * 22 + (day % 4) * 2,
      deepWorkSessions: 1 + (day % 2)
    });
    for (const subject of subjectList) {
      const rate = Math.min(100, subject.goalAccuracy - 18 + ((subject.id * 5 + day * 3) % 22));
      points.push({
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color,
        date: addDaysIso(-day),
        sessions: 1 + (day % 2),
        plannedMinutes: 50,
        elapsedMinutes: Math.round(50 * rate / 100),
        completionRate: rate,
        deepWorkSessions: rate >= 90 ? 1 : 0
      });
    }
  }
  return points;
};

export const demoFocusOverloadTrend: FocusOverloadPoint[] = buildDemoFocusOverloadTrend(demoSubjects);

/* ---------------------------------------------------------------- */
/* Memória (FSRS) + projeção de decaimento                           */
/* ---------------------------------------------------------------- */

const retrievability = (stability: number, elapsedDays: number) => 1 / (1 + elapsedDays / (9 * stability));

export const demoMemoryItems: SpacedRepetitionItem[] = [
  { id: 501, userId: 1, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, topicId: 12, topicName: "Círculos e ângulos", concept: "Círculos e ângulos inscritos", difficulty: 6, stability: 12, reps: 3, lastReviewDate: addDaysIso(-8), dueDate: addDaysIso(4), retrievability: 0.93, createdAt: addDaysIso(-40) },
  { id: 502, userId: 1, subjectId: MEC.id, subjectName: MEC.name, color: MEC.color, topicId: 22, topicName: "Leis de Newton", concept: "Diagrama de corpo livre", difficulty: 7, stability: 9, reps: 2, lastReviewDate: addDaysIso(-5), dueDate: addDaysIso(-2), retrievability: 0.94, createdAt: addDaysIso(-25) },
  { id: 503, userId: 1, subjectId: ORG.id, subjectName: ORG.name, color: ORG.color, topicId: 31, topicName: "Cadeias carbônicas", concept: "Nomenclatura de alcanos", difficulty: 5, stability: 16, reps: 2, lastReviewDate: addDaysIso(-10), dueDate: addDaysIso(6), retrievability: 0.94, createdAt: addDaysIso(-30) },
  { id: 504, userId: 1, subjectId: POR.id, subjectName: POR.name, color: POR.color, topicId: 41, topicName: "Concordância verbal", concept: "Concordância verbo-nominal", difficulty: 4, stability: 20, reps: 4, lastReviewDate: addDaysIso(-12), dueDate: addDaysIso(8), retrievability: 0.94, createdAt: addDaysIso(-60) },
  { id: 505, userId: 1, subjectId: ENG.id, subjectName: ENG.name, color: ENG.color, topicId: null, topicName: null, concept: "Phrasal verbs · look up, give up", difficulty: 3, stability: 28, reps: 6, lastReviewDate: addDaysIso(-20), dueDate: addDaysIso(8), retrievability: 0.93, createdAt: addDaysIso(-80) },
  { id: 506, userId: 1, subjectId: COMP.id, subjectName: COMP.name, color: COMP.color, topicId: 61, topicName: "Métodos numéricos em Python", concept: "Interpolação e ajuste de curvas", difficulty: 6, stability: 10, reps: 1, lastReviewDate: addDaysIso(-3), dueDate: addDaysIso(7), retrievability: 0.97, createdAt: addDaysIso(-12) },
  { id: 507, userId: 1, subjectId: AERO.id, subjectName: AERO.name, color: AERO.color, topicId: 71, topicName: "Sustentação e arrasto", concept: "Sustentação e ângulo de ataque", difficulty: 6, stability: 11, reps: 2, lastReviewDate: addDaysIso(-6), dueDate: addDaysIso(5), retrievability: 0.94, createdAt: addDaysIso(-15) }
];

export const buildMemoryDecayProjection = (item: SpacedRepetitionItem): MemoryDecayProjection => {
  const sinceLastReview = Math.max(0, Math.round((Date.now() - new Date(`${item.lastReviewDate}T12:00:00`).getTime()) / 86400000));
  const todayR = retrievability(item.stability, sinceLastReview) * 100;
  const until90 = pointCrossesAtRetrievability(item.stability, sinceLastReview);
  const horizon = Math.max(30, Math.round(item.stability * 2));
  const points: MemoryDecayProjection["points"] = [];
  let ankiStability = item.stability;
  let nextReset = Math.max(1, until90);
  for (let day = 0; day <= horizon; day++) {
    const r = retrievability(item.stability, sinceLastReview + day) * 100;
    const a = retrievability(ankiStability, Math.max(0, day - nextReset)) * 100;
    points.push({ itemId: item.id, day, date: addDaysIso(day), retrievability: r, anki: a, reviewed: day === nextReset });
    if (day === nextReset) {
      ankiStability *= 2.2;
      nextReset = Math.max(1, day + Math.round(ankiStability));
    }
  }
  return {
    itemId: item.id,
    concept: item.concept,
    subjectName: item.subjectName,
    color: item.color,
    stability: item.stability,
    difficulty: item.difficulty,
    optimalDay: until90,
    optimalDate: addDaysIso(until90),
    retrievabilityToday: Math.round(todayR * 10) / 10,
    dueInDays: until90,
    points
  };
};

const pointCrossesAtRetrievability = (stability: number, sinceLastReview: number) => {
  let day = 0;
  while (retrievability(stability, sinceLastReview + day) * 100 > 90 && day < 400) day++;
  return day;
};

/* ---------------------------------------------------------------- */
/* Overview de retenção (por matéria e nicho)                        */
/* ---------------------------------------------------------------- */

export const buildDemoRetentionOverview = (subjectList: Subject[], items: SpacedRepetitionItem[] = demoMemoryItems): RetentionOverview =>
  buildRetentionOverview({ items, subjects: subjectList, horizonDays: 60 });

export const demoRetentionOverview: RetentionOverview = buildDemoRetentionOverview(demoSubjects);

/* ---------------------------------------------------------------- */
/* Rota de prova (plano reverso)                                     */
/* ---------------------------------------------------------------- */

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const leastBy = <T,>(items: T[], key: (item: T) => number[]): T | null =>
  items.reduce<T | null>((best, item) => {
    if (best === null) return item;
    const candidate = key(item);
    const current = key(best);
    const firstDiff = candidate.findIndex((value, index) => value !== current[index]);
    return firstDiff === -1 || candidate[firstDiff] > current[firstDiff] ? best : item;
  }, null);

/** Réplica do motor do backend (`generate_study_plan`): carga semanal diluída
 * só pelos dias de estudo do perfil, blocos de 5 com piso de 30 min, rotação
 * por risco e alternância teoria × exatas (principal nunca empilha exatas). */
export const buildDemoPlan = (subjectList: Subject[], profile: Profile = demoProfile): PlanResponse => {
  const score = (subject: Subject) => subject.computedIp + 2 * Math.max(0, subject.targetLevel - subject.currentLevel);
  const ordered = sequenceByParent(
    [...subjectList].sort((a, b) => score(b) - score(a)),
    score
  );
  const toFocus = (subject: Subject, slot: string, minutes: number): PlanFocus => ({
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    risk: score(subject),
    minutes,
    slot
  });
  const weeks = 12;
  const examPhaseWeeks = Math.max(2, Math.floor(weeks / 4));
  const retaFrom = Math.max(1, weeks - examPhaseWeeks);
  const phases: PlanPhase[] = [
    {
      mode: "construcao",
      title: "Fase de construção",
      routine: "Revisão ativa",
      detail: "recall espaçado: flashcards e questões sem consultar o material",
      minutesPerWeek: 40,
      fromWeek: 1,
      toWeek: retaFrom,
      startDate: addDaysIso(0),
      endDate: addDaysIso(retaFrom * 7 - 1)
    }
  ];
  /* v8 ignore next -- com `weeks = 12` fixo, retaFrom = 12 − max(2, ⌊12/4⌋) = 9,
     então a reta final sempre existe; o teste falso só ocorreria num plano de
     1 semana, que esta função (fixture de demonstração) não produz. */
  if (weeks > retaFrom) {
    phases.push({
      mode: "reta_final",
      title: "Reta final",
      routine: "Simulado estilo prova",
      detail: "prova cronometrada (provas anteriores) + categorizar erros: não sabia × errei × chutei",
      minutesPerWeek: 120,
      fromWeek: retaFrom + 1,
      toWeek: weeks,
      startDate: addDaysIso(retaFrom * 7),
      endDate: addDaysIso(weeks * 7 - 1)
    });
  }

  const days: PlanDay[] = [];
  if (ordered.length) {
    const studyDays = [...(profile.studyDays?.length ? profile.studyDays : [0, 1, 2, 3, 4, 5])].sort((a, b) => a - b);
    const weeklyMinutes = profile.dailyHours * studyDays.length * 60;
    const dailyMinutes = Math.max(30, Math.round(weeklyMinutes / studyDays.length / 5) * 5);
    const slotCount = ordered.length > studyDays.length * 2 && dailyMinutes >= 150 ? 3 : ordered.length > 1 && dailyMinutes >= 60 ? 2 : 1;
    const fractions = slotCount === 3 ? [0.5, 0.3, 0.2] : slotCount === 2 ? [0.6, 0.4] : [1];
    const slotMinutes: number[] = [];
    let remaining = dailyMinutes;
    for (let index = 0; index < slotCount - 1; index++) {
      const raw = Math.round((dailyMinutes * fractions[index]) / 5) * 5;
      const reserve = 30 * (slotCount - index - 1);
      const minutes = Math.min(Math.max(raw, 30), remaining - reserve);
      slotMinutes.push(minutes);
      remaining -= minutes;
    }
    slotMinutes.push(remaining);
    const isExatasName = (name: string) => ["Matemática", "Física", "Química"].some((stem) => name.includes(stem));
    const slotLabel = (slotIndex: number, early: boolean) =>
      slotIndex === 0
        ? early
          ? "Janela matutina · aquecimento pós-sono"
          : "Bloco principal"
        : slotIndex === 1
          ? early
            ? "Segundo alvo · alternância"
            : "Tarde · reforço de déficit"
          : "Terceiro bloco · fixação leve";

    const weeklyUsage = ordered.map(() => 0);
    const lastUsed = ordered.map(() => -1);
    let weekAnchor = -1;
    let studyIndex = 0;
    for (let offset = 0; offset < 42; offset++) {
      const date = addDaysIso(offset);
      const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
      if (!studyDays.includes(weekday)) continue;
      const anchor = offset - weekday;
      if (anchor !== weekAnchor) {
        weekAnchor = anchor;
        weeklyUsage.fill(0);
      }
      const early = weekday <= 2;
      const focus: PlanFocus[] = [];
      const usedToday: number[] = [];
      for (let slotIndex = 0; slotIndex < slotMinutes.length; slotIndex++) {
        const pick =
          slotIndex === 0
            ? studyIndex % ordered.length
            : leastBy(
                ordered
                  .map((_, index) => index)
                  .filter((index) => !usedToday.includes(index)),
                (index) => [
                  isExatasName(ordered[index].name) === isExatasName(ordered[usedToday[0]].name) ? 1 : 0,
                  weeklyUsage[index],
                  lastUsed[index],
                  index
                ]
              );
        /* v8 ignore next -- a lista de candidatos nunca esvazia: slotCount é
           limitado por ordered.length logo acima (3 exige >2×dias, 2 exige >1),
           então `usedToday` não consegue cobrir todos os índices. Guarda de
           invariante: se a regra de slotCount mudar, o laço para em vez de
           escolher matéria inexistente. */
        if (pick === null) break;
        const subject = ordered[pick];
        weeklyUsage[pick] += slotMinutes[slotIndex];
        lastUsed[pick] = studyIndex;
        usedToday.push(pick);
        focus.push(toFocus(subject, slotLabel(slotIndex, early), slotMinutes[slotIndex]));
      }
      days.push({ date, weekdayLabel: DAY_LABELS[weekday], focusSubjects: focus });
      studyIndex++;
    }
  }
  return { weeks, riskName: ordered[0]?.name ?? null, phases, days };
};

export const demoPlan: PlanResponse = buildDemoPlan(demoSubjects);

/* ---------------------------------------------------------------- */
/* Foco: sessões, sugestões de timebox e capturas                   */
/* ---------------------------------------------------------------- */

export const demoFocusSessions: FocusSession[] = [
  { id: 701, subjectId: MEC.id, subjectName: MEC.name, color: MEC.color, materialId: 102, materialTitle: "Tópicos de Física · Vol. 1", goalType: "paginas", goalText: "Ler pág. 180 a 195", pageStart: 180, pageEnd: 195, plannedMinutes: 60, elapsedMinutes: 45, interrupts: 2, completionRate: 75, zone: "media", exitReason: "fadiga_metabolica", completed: true, status: "partial", completionPercentage: 60, startedAt: addDaysIso(0) },
  { id: 702, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, materialId: 101, materialTitle: "Fundamentos da Matemática Elementar · Vol. 9", goalType: "paginas", goalText: "Ler pág. 210 a 235", pageStart: 210, pageEnd: 235, plannedMinutes: 50, elapsedMinutes: 56, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 95, startedAt: addDaysIso(-1) },
  { id: 703, subjectId: ORG.id, subjectName: ORG.name, color: ORG.color, materialId: 103, materialTitle: "Química Orgânica · Usberco", goalType: "topicos", goalText: "Dominar nomenclatura de alcanos", pageStart: null, pageEnd: null, plannedMinutes: 40, elapsedMinutes: 20, interrupts: 3, completionRate: 50, zone: "alta", exitReason: "distracao_externa", completed: true, status: "partial", completionPercentage: 45, startedAt: addDaysIso(-2) },
  { id: 704, subjectId: POR.id, subjectName: POR.name, color: POR.color, materialId: 104, materialTitle: "Gramática da Língua Portuguesa", goalType: "topicos", goalText: "Revisar concordância verbal", pageStart: null, pageEnd: null, plannedMinutes: 35, elapsedMinutes: 38, interrupts: 1, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 90, startedAt: addDaysIso(-3) },
  { id: 705, subjectId: COMP.id, subjectName: COMP.name, color: COMP.color, materialId: 106, materialTitle: "Numerical Recipes — The Art of Scientific Computing", goalType: "paginas", goalText: "Ler pág. 40 a 55", pageStart: 40, pageEnd: 55, plannedMinutes: 45, elapsedMinutes: 15, interrupts: 2, completionRate: 33, zone: "alta", exitReason: "dificuldade_materia", completed: true, status: "partial", completionPercentage: 40, startedAt: addDaysIso(-4) },
  { id: 706, subjectId: ENG.id, subjectName: ENG.name, color: ENG.color, materialId: 105, materialTitle: "English in Use · Intermediate", goalType: "exercicios", goalText: "10 exercícios de phrasal verbs", pageStart: null, pageEnd: null, plannedMinutes: 30, elapsedMinutes: 32, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 92, startedAt: addDaysIso(-5) },
  { id: 707, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, materialId: 101, materialTitle: "Fundamentos da Matemática Elementar · Vol. 9", goalType: "paginas", goalText: "Ler pág. 235 a 250", pageStart: 235, pageEnd: 250, plannedMinutes: 55, elapsedMinutes: 30, interrupts: 1, completionRate: 55, zone: "media", exitReason: "meta_concluida", completed: true, status: "partial", completionPercentage: 70, startedAt: addDaysIso(-6) },
  { id: 708, subjectId: MEC.id, subjectName: MEC.name, color: MEC.color, materialId: 102, materialTitle: "Tópicos de Física · Vol. 1", goalType: "exercicios", goalText: "Resolver 12 exercícios de mecânica", pageStart: null, pageEnd: null, plannedMinutes: 60, elapsedMinutes: 62, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 88, startedAt: addDaysIso(-7) },
  { id: 709, subjectId: ORG.id, subjectName: ORG.name, color: ORG.color, materialId: 103, materialTitle: "Química Orgânica · Usberco", goalType: "paginas", goalText: "Ler pág. 96 a 112", pageStart: 96, pageEnd: 112, plannedMinutes: 45, elapsedMinutes: 40, interrupts: 1, completionRate: 89, zone: "media", exitReason: null, completed: false, status: "buffered", completionPercentage: 80, startedAt: addDaysIso(-8) },
  { id: 710, subjectId: AERO.id, subjectName: AERO.name, color: AERO.color, materialId: 108, materialTitle: "Fundamentos de Aerodinâmica (Anderson)", goalType: "topicos", goalText: "Sustentação e ângulo de ataque", pageStart: null, pageEnd: null, plannedMinutes: 50, elapsedMinutes: 52, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 96, startedAt: addDaysIso(-2) }
];

export const timeboxSuggestionFor = (subject: Subject): TimeboxSuggestion => ({
  subjectId: subject.id,
  subjectName: subject.name,
  color: subject.color,
  resistanceIndex: 40 + (subject.id % 4) * 12,
  completedStreak: 1 + (subject.id % 3),
  previousMinutes: 45 + (subject.id % 3) * 5,
  suggestedMinutes: 45 + (subject.id % 3) * 10,
  reason: subject.computedIp >= 25
    ? `Matéria densa recém-iniciada — inicie com ${45 + (subject.id % 3) * 10} min e evolua conforme a sustentação.`
    : "Histórico estável de deep work — mantenha o timebox atual e acrescente 5 min a cada dois blocos concluídos."
});

export const demoBrainDumps: BrainDumpLog[] = [
  { id: 801, subjectId: MEC.id, subjectName: MEC.name, note: "Lembrar de conferir a fórmula de atrito nos exercícios da prova antiga do ENEM.", createdAt: addDaysIso(-2) },
  { id: 802, subjectId: null, subjectName: null, note: "Pesquisar a lista de câmpus da faculdade que abre inscrição na semana que vem.", createdAt: addDaysIso(-3) },
  { id: 803, subjectId: GEO.id, subjectName: GEO.name, note: "Revisar o teorema do ângulo inscrito antes da lista nova.", createdAt: addDaysIso(-5) }
];

/* ---------------------------------------------------------------- */
/* Triage WBS: buffer, plano de reagendamento                        */
/* ---------------------------------------------------------------- */

export const demoBufferAllocations: BufferAllocation[] = [
  { id: 851, subjectId: ORG.id, subjectName: ORG.name, color: ORG.color, sourceGoal: "Dominar nomenclatura de alcanos", debtMinutes: 20, destination: "saturday", status: "queued", createdAt: addDaysIso(-2) },
  { id: 852, subjectId: COMP.id, subjectName: COMP.name, color: COMP.color, sourceGoal: "Ler pág. 40 a 55", debtMinutes: 30, destination: "next_week", status: "queued", createdAt: addDaysIso(-4) },
  { id: 853, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, sourceGoal: "Ler pág. 235 a 250", debtMinutes: 25, destination: "saturday", status: "queued", createdAt: addDaysIso(-6) }
];

export const demoReschedulePlan: ReschedulePlan = {
  generatedDate: todayIso(),
  totalDebtMinutes: 75,
  saturdayMinutes: 45,
  nextWeekMinutes: 30,
  protectedMorningHours: 3,
  items: [
    { sourceSessionId: 703, subjectId: ORG.id, subjectName: ORG.name, color: ORG.color, goal: "Dominar nomenclatura de alcanos", plannedMinutes: 40, executedMinutes: 20, debtMinutes: 20, destination: "saturday", destinationLabel: "Sábado à tarde" },
    { sourceSessionId: 705, subjectId: COMP.id, subjectName: COMP.name, color: COMP.color, goal: "Ler pág. 40 a 55", plannedMinutes: 45, executedMinutes: 15, debtMinutes: 30, destination: "next_week", destinationLabel: "Semana seguinte" },
    { sourceSessionId: 707, subjectId: GEO.id, subjectName: GEO.name, color: GEO.color, goal: "Ler pág. 235 a 250", plannedMinutes: 55, executedMinutes: 30, debtMinutes: 25, destination: "saturday", destinationLabel: "Sábado à tarde" }
  ]
};

/* ---------------------------------------------------------------- */
/* Estratégias de material (Biblioteca)                              */
/* ---------------------------------------------------------------- */

export const demoMaterialStrategies: MaterialStrategy[] = [
  { id: 1, keywords: "questões ita questões", tactic: "Banco cronológico: 3 questões em 10 min, conferindo resolução no fim do bloco.", reason: "Lista de questões com cobrança de vestibular precisa de ritmo de prova, não de leitura linear.", intensity: "Alta" },
  { id: 2, keywords: "teoria resumo esquema", tactic: "Ficha de síntese: leia o capítulo em 25 min e escreva um mapa mental de 10 itens.", reason: "Material teórico denso rende mais quando é destilado em estrutura própria.", intensity: "Média" },
  { id: 3, keywords: "curso vídeo aula vídeo", tactic: "Método Feynman: a cada 15 min de vídeo, explique o trecho em voz alta sem apoio.", reason: "Vídeo é passivo; a checagem ativa evita a ilusão de fluência.", intensity: "Média" },
  { id: 4, keywords: "apostila pdf lista", tactic: "Resolução ativa: use papel em branco e finalize cada exercício antes de consultar o gabarito.", reason: "Prática sem consulta consolida o traço de memória de resolução.", intensity: "Alta" },
  { id: 5, keywords: "gramática vocabulário", tactic: "Flashcards espalhados: 10 cartas por sessão com repetição espaçada pelo motor FSRS.", reason: "Regras e vocabulário são memorização pura — o FSRS evita o esquecimento.", intensity: "Baixa" }
];

/* ---------------------------------------------------------------- */
/* Livestream de retenção (demo) — amostras em tempo real por        */
/* matéria, usadas no card "Retenção · livestream" do Desempenho.    */
/* `overdue`/`manyPartials` sinalizam atraso e excesso de blocos     */
/* parciais (pisca vermelho + alerta sonoro). Os demais dados        */
/* derivam das coleções demo existentes para bater com o painel.     */
/* ---------------------------------------------------------------- */

const MANY_PARTIALS_THRESHOLD = 3;

export const buildDemoRetentionLivestreamTicks = (
  subjectList: Subject[],
  ranking: SubjectRanking[],
  sessions: FocusSession[] = demoFocusSessions,
  items: SpacedRepetitionItem[] = demoMemoryItems
): RetentionLiveTick[] => subjectList.map((subject, index) => {
  const row = ranking.find((entry) => entry.id === subject.id);
  const partialSessions = sessions.filter((session) => session.subjectId === subject.id && session.zone === "baixa" && session.status === "partial");
  const dueSoon = items.filter((item) => item.subjectId === subject.id && item.dueDate <= addDaysIso(3)).length;
  const accuracy = row?.accuracy ?? 70;
  return {
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    accuracy,
    retentionDelta: ((index % 4) === 0 ? -8 - index : 3 + index % 5),
    overdue: dueSoon > 0 && accuracy < 62,
    manyPartials: partialSessions.length >= MANY_PARTIALS_THRESHOLD
  };
});

export const demoRetentionLivestreamTicks: RetentionLiveTick[] = buildDemoRetentionLivestreamTicks(demoSubjects, demoRanking);

/* T6 — Livestream de retenção (rota humilde). O card no PerformanceView
   avança as amostras reais da demo quando o demo está ativo; dispara o
   aviso vermelho quando `overdue`/`many`. */
export const buildDemoRetentionLivestream = (base: RetentionLiveTick[], windowStep = 273): RetentionLiveStream[] => {
  const streams: RetentionLiveStream[] = [];
  for (let windowStart = 0; windowStart < base.length; windowStart += windowStep) {
    const generatedAt = addDaysIso(-8 + Math.floor(windowStart / Math.max(1, base.length)));
    streams.push({
      generatedAt,
      horizonMinutes: 54,
      ticks: base.map((live) => ({ ...live, retentionDelta: live.retentionDelta + (windowStart % 7) }))
    });
  }
  return streams;
};

export const demoRetentionLivestream: RetentionLiveStream[] = buildDemoRetentionLivestream(demoRetentionLivestreamTicks);
