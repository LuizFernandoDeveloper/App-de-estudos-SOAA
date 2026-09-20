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
  Topic
} from "../shared/types";
import { buildRetentionOverview } from "./retentionData";
import { catalogToSubjects } from "./catalog";

/* Feito para pré-visualização: dados fictícios determinísticos, sempre
   relativos a hoje. Nenhuma chamada ao backend é feita no modo demo. */

const pad = (value: number) => String(value).padStart(2, "0");
const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return fmt(date);
};
export const todayIso = () => addDaysIso(0);

const formatMinutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/* ---------------------------------------------------------------- */
/* Matérias, tópicos e materiais                                     */
/* ---------------------------------------------------------------- */

export const demoSubjects: Subject[] = catalogToSubjects();

const demoColorFor = (subjectId: number) => demoSubjects.find((subject) => subject.id === subjectId)?.color ?? "indigo";

export const demoTopicList: Topic[] = [
  { id: 11, userId: 1, subjectId: 11, name: "Geometria plana · triângulos", status: "concluido", createdAt: addDaysIso(-90) },
  { id: 12, userId: 1, subjectId: 11, name: "Círculos e ângulos", status: "em_andamento", createdAt: addDaysIso(-40) },
  { id: 13, userId: 1, subjectId: 11, name: "Geometria espacial", status: "pendente", createdAt: addDaysIso(-10) },
  { id: 21, userId: 1, subjectId: 17, name: "Cinemática", status: "concluido", createdAt: addDaysIso(-80) },
  { id: 22, userId: 1, subjectId: 17, name: "Leis de Newton", status: "em_andamento", createdAt: addDaysIso(-30) },
  { id: 23, userId: 1, subjectId: 17, name: "Trabalho e energia", status: "pendente", createdAt: addDaysIso(-6) },
  { id: 31, userId: 1, subjectId: 38, name: "Cadeias carbônicas", status: "em_andamento", createdAt: addDaysIso(-25) },
  { id: 32, userId: 1, subjectId: 38, name: "Funções orgânicas", status: "pendente", createdAt: addDaysIso(-5) },
  { id: 41, userId: 1, subjectId: 69, name: "Concordância verbal", status: "em_andamento", createdAt: addDaysIso(-20) },
  { id: 51, userId: 1, subjectId: 76, name: "Phrasal verbs", status: "concluido", createdAt: addDaysIso(-60) },
  { id: 61, userId: 1, subjectId: 98, name: "Complexidade de algoritmos", status: "em_andamento", createdAt: addDaysIso(-12) }
];

export const demoMaterialList: StudyMaterial[] = [
  { id: 101, userId: 1, subjectId: 11, topicId: 12, title: "Fundamentos da Matemática Elementar · Vol. 9", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["geometria", "ita"], front: null, topic: null, pageFocus: null, currentPage: 214, totalPages: 380, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-70) },
  { id: 102, userId: 1, subjectId: 17, topicId: 22, title: "Tópicos de Física · Vol. 1", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["mecânica", "ita"], front: null, topic: null, pageFocus: null, currentPage: 180, totalPages: 460, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-60) },
  { id: 103, userId: 1, subjectId: 38, topicId: 31, title: "Química Orgânica · Usberco", category: "Livro", urlPath: null, status: "em_andamento" as const, tags: ["orgânica"], front: null, topic: null, pageFocus: null, currentPage: 96, totalPages: 520, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-35) },
  { id: 104, userId: 1, subjectId: 69, topicId: 41, title: "Gramática da Língua Portuguesa", category: "Livro", urlPath: null, status: "concluido" as const, tags: ["gramática"], front: null, topic: null, pageFocus: null, currentPage: 320, totalPages: 320, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-75) },
  { id: 105, userId: 1, subjectId: 76, topicId: null, title: "English in Use · Intermediate", category: "Curso", urlPath: null, status: "em_andamento" as const, tags: ["vocabulário"], front: null, topic: null, pageFocus: null, currentPage: 0, totalPages: 0, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-50) },
  { id: 106, userId: 1, subjectId: 98, topicId: 61, title: "The Algorithm Design Manual", category: "PDF / Apostila", urlPath: null, status: "pendente" as const, tags: ["algoritmos"], front: null, topic: null, pageFocus: null, currentPage: 40, totalPages: 730, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-8) },
  { id: 107, userId: 1, subjectId: 11, topicId: 13, title: "250 Questões de Geometria Espacial", category: "Lista de exercícios", urlPath: null, status: "pendente" as const, tags: ["questões", "ita"], front: null, topic: null, pageFocus: null, currentPage: 0, totalPages: 250, remindDate: null, studyStrategy: null, createdAt: addDaysIso(-3) }
];

/* ---------------------------------------------------------------- */
/* Cronograma semanal (matriz + planejamento)                        */
/* ---------------------------------------------------------------- */

export const demoSchedule: ScheduleResponse = (() => {
  const weeklyMinutes = 2160;
  const totalMinutes = weeklyMinutes;
  const totalIp = demoSubjects.reduce((sum, subject) => sum + subject.computedIp, 0);
  const exactMinutes = demoSubjects.map((subject) => (subject.computedIp / totalIp) * totalMinutes);
  const rounded = exactMinutes.map((value) => Math.max(5, Math.round(value / 5) * 5));
  let allocatedTotal = rounded.reduce((sum, value) => sum + value, 0);
  const capped = rounded.map((value) => {
    if (allocatedTotal <= totalMinutes) return value;
    const reduction = Math.min(value - 5, allocatedTotal - totalMinutes);
    allocatedTotal -= reduction;
    return value - reduction;
  });
  const allocations = demoSubjects.map((subject, index) => ({
    ...subject,
    exactMinutes: Math.round(exactMinutes[index] * 10) / 10,
    allocatedMinutes: capped[index],
    formattedTime: formatMinutes(capped[index]),
    percentage: Math.round(subject.computedIp / totalIp * 1000) / 10
  }));
  return {
    totalHours: totalMinutes / 60,
    totalMinutes,
    totalIp,
    projectBufferMinutes: totalMinutes - allocatedTotal,
    formattedProjectBuffer: formatMinutes(totalMinutes - allocatedTotal),
    allocations
  };
})();

export const demoDayAllocations: DayAllocation[] = [
  { id: 901, subjectId: 11, subjectName: demoSubjects.find((s) => s.id === 11)?.name ?? "Matemática", color: demoColorFor(11), weekday: 5, minutes: 120, note: "Dia calmo para resolver questões de dinâmica" },
  { id: 902, subjectId: 17, subjectName: demoSubjects.find((s) => s.id === 17)?.name ?? "Física", color: demoColorFor(17), weekday: 3, minutes: 90, note: "Revisão de círculos e ângulos" },
  { id: 903, subjectId: 76, subjectName: demoSubjects.find((s) => s.id === 76)?.name ?? "Inglês", color: demoColorFor(76), weekday: 0, minutes: 60, note: "Manutenção leve de vocabulário" }
];

/* ---------------------------------------------------------------- */
/* Dashboard                                                         */
/* ---------------------------------------------------------------- */

const dailyAccuracy = [50, 54, 52, 58, 61, 60, 65, 68, 66, 71, 74, 73, 79, 85];

export const demoDashboard: DashboardData = {
  profile: { dailyHours: Number((demoSchedule.totalMinutes / 60 / 6).toFixed(1)), weeklyDays: 6, examTrack: "ITA", startDate: addDaysIso(-120), examDate: addDaysIso(92), studyDays: [0, 1, 2, 3, 4, 5] },
  subjectsCount: demoSubjects.length,
  materials: { total: demoMaterialList.length, completed: 1 },
  questions: { total: 1480, correct: 1049, accuracy: 71 },
  weeklyStudyMinutes: 2160,
  dailyPerformance: dailyAccuracy.map((accuracy, index) => ({
    date: addDaysIso(-(dailyAccuracy.length - 1 - index)),
    accuracy,
    total: 18 + (index % 5) * 6
  })),
  subjectPerformance: demoSubjects.map((subject, index) => {
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
};

/* ---------------------------------------------------------------- */
/* Ranking                                                           */
/* ---------------------------------------------------------------- */

export const demoRanking: SubjectRanking[] = (() => {
  const movements: SubjectRanking["movement"][]= ["up", "down", "same", "new"];
  return demoSubjects
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
})();

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

export const demoSubjectAccuracyTrend: SubjectAccuracyPoint[] = (() => {
  const days = 6;
  const points: SubjectAccuracyPoint[] = [];
  for (let day = days - 1; day >= 0; day--) {
    for (const subject of demoSubjects) {
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
})();

export const demoFocusOverloadTrend: FocusOverloadPoint[] = (() => {
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
    for (const subject of demoSubjects) {
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
})();

/* ---------------------------------------------------------------- */
/* Memória (FSRS) + projeção de decaimento                           */
/* ---------------------------------------------------------------- */

const retrievability = (stability: number, elapsedDays: number) => 1 / (1 + elapsedDays / (9 * stability));

export const demoMemoryItems: SpacedRepetitionItem[] = [
  { id: 501, userId: 1, subjectId: 11, subjectName: "Matemática · Geometria Plana", color: demoColorFor(11), topicId: 12, topicName: "Círculos e ângulos", concept: "Círculos e ângulos inscritos", difficulty: 6, stability: 12, reps: 3, lastReviewDate: addDaysIso(-8), dueDate: addDaysIso(4), retrievability: 0.93, createdAt: addDaysIso(-40) },
  { id: 502, userId: 1, subjectId: 17, subjectName: "Física · Dinâmica (Leis de Newton)", color: demoColorFor(17), topicId: 22, topicName: "Leis de Newton", concept: "Diagrama de corpo livre", difficulty: 7, stability: 9, reps: 2, lastReviewDate: addDaysIso(-5), dueDate: addDaysIso(4), retrievability: 0.94, createdAt: addDaysIso(-25) },
  { id: 503, userId: 1, subjectId: 38, subjectName: "Química · Orgânica (Nomenclatura e Funções)", color: demoColorFor(38), topicId: 31, topicName: "Cadeias carbônicas", concept: "Nomenclatura de alcanos", difficulty: 5, stability: 16, reps: 2, lastReviewDate: addDaysIso(-10), dueDate: addDaysIso(6), retrievability: 0.94, createdAt: addDaysIso(-30) },
  { id: 504, userId: 1, subjectId: 69, subjectName: "Português · Gramática e Norma Culta", color: demoColorFor(69), topicId: 41, topicName: "Concordância verbal", concept: "Concordância verbo-nominal", difficulty: 4, stability: 20, reps: 4, lastReviewDate: addDaysIso(-12), dueDate: addDaysIso(8), retrievability: 0.94, createdAt: addDaysIso(-60) },
  { id: 505, userId: 1, subjectId: 76, subjectName: "Inglês · Grammar and Usage", color: demoColorFor(76), topicId: null, topicName: null, concept: "Phrasal verbs · look up, give up", difficulty: 3, stability: 28, reps: 6, lastReviewDate: addDaysIso(-20), dueDate: addDaysIso(8), retrievability: 0.93, createdAt: addDaysIso(-80) },
  { id: 506, userId: 1, subjectId: 98, subjectName: "Faculdade · Algoritmos e Estruturas de Dados", color: demoColorFor(98), topicId: 61, topicName: "Complexidade de algoritmos", concept: "O(n log n) do mergesort", difficulty: 6, stability: 10, reps: 1, lastReviewDate: addDaysIso(-3), dueDate: addDaysIso(7), retrievability: 0.97, createdAt: addDaysIso(-12) }
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

export const demoRetentionOverview: RetentionOverview = buildRetentionOverview({
  items: demoMemoryItems,
  subjects: demoSubjects,
  horizonDays: 60
});

/* ---------------------------------------------------------------- */
/* Rota de prova (plano reverso)                                     */
/* ---------------------------------------------------------------- */

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const buildDemoPlan = (subjectList: Subject[]): PlanResponse => {
  const ordered = [...subjectList].sort((a, b) => b.computedIp - a.computedIp);
  const toFocus = (subject: Subject, slot: string, minutes: number, risk: number): PlanFocus => ({
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    risk,
    minutes,
    slot
  });
  const days: PlanDay[] = [];
  for (let index = 0; index < 14; index++) {
    const date = addDaysIso(index);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const primary = ordered[index % ordered.length];
    const secondary = ordered[(index * 2 + 1) % ordered.length];
    const planned = [
      toFocus(primary, "manhã", 60 + (index % 2) * 10, 8 - index % 3)
    ];
    if (secondary.id !== primary.id) {
      planned.push(toFocus(secondary, secondary.id > primary.id ? "tarde" : "noite", 45 + (index % 2) * 10, 4));
    }
    days.push({ date, weekdayLabel: DAY_LABELS[(weekday + 7 - 1) % 7], focusSubjects: planned });
  }
  return { weeks: 12, riskName: ordered[0]?.name ?? null, days };
};

export const demoPlan: PlanResponse = buildDemoPlan(demoSubjects);

/* ---------------------------------------------------------------- */
/* Foco: sessões, sugestões de timebox e capturas                   */
/* ---------------------------------------------------------------- */

export const demoFocusSessions: FocusSession[] = [
  { id: 701, subjectId: 17, subjectName: "Física · Dinâmica (Leis de Newton)", color: demoColorFor(17), materialId: 102, materialTitle: "Tópicos de Física · Vol. 1", goalType: "paginas", goalText: "Ler pág. 180 a 195", pageStart: 180, pageEnd: 195, plannedMinutes: 60, elapsedMinutes: 45, interrupts: 2, completionRate: 75, zone: "media", exitReason: "fadiga_metabolica", completed: true, status: "partial", completionPercentage: 60, startedAt: addDaysIso(-1) },
  { id: 702, subjectId: 11, subjectName: "Matemática · Geometria Plana", color: demoColorFor(11), materialId: 101, materialTitle: "Fundamentos da Matemática Elementar · Vol. 9", goalType: "paginas", goalText: "Ler pág. 210 a 235", pageStart: 210, pageEnd: 235, plannedMinutes: 50, elapsedMinutes: 56, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 95, startedAt: addDaysIso(-1) },
  { id: 703, subjectId: 38, subjectName: "Química · Orgânica (Nomenclatura e Funções)", color: demoColorFor(38), materialId: 103, materialTitle: "Química Orgânica · Usberco", goalType: "topicos", goalText: "Dominar nomenclatura de alcanos", pageStart: null, pageEnd: null, plannedMinutes: 40, elapsedMinutes: 20, interrupts: 3, completionRate: 50, zone: "alta", exitReason: "distracao_externa", completed: true, status: "partial", completionPercentage: 45, startedAt: addDaysIso(-2) },
  { id: 704, subjectId: 69, subjectName: "Português · Gramática e Norma Culta", color: demoColorFor(69), materialId: 104, materialTitle: "Gramática da Língua Portuguesa", goalType: "topicos", goalText: "Revisar concordância verbal", pageStart: null, pageEnd: null, plannedMinutes: 35, elapsedMinutes: 38, interrupts: 1, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 90, startedAt: addDaysIso(-3) },
  { id: 705, subjectId: 98, subjectName: "Faculdade · Algoritmos e Estruturas de Dados", color: demoColorFor(98), materialId: 106, materialTitle: "The Algorithm Design Manual", goalType: "paginas", goalText: "Ler pág. 40 a 55", pageStart: 40, pageEnd: 55, plannedMinutes: 45, elapsedMinutes: 15, interrupts: 2, completionRate: 33, zone: "alta", exitReason: "dificuldade_materia", completed: true, status: "partial", completionPercentage: 40, startedAt: addDaysIso(-4) },
  { id: 706, subjectId: 76, subjectName: "Inglês · Grammar and Usage", color: demoColorFor(76), materialId: 105, materialTitle: "English in Use · Intermediate", goalType: "exercicios", goalText: "10 exercícios de phrasal verbs", pageStart: null, pageEnd: null, plannedMinutes: 30, elapsedMinutes: 32, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 92, startedAt: addDaysIso(-5) },
  { id: 707, subjectId: 11, subjectName: "Matemática · Geometria Plana", color: demoColorFor(11), materialId: 101, materialTitle: "Fundamentos da Matemática Elementar · Vol. 9", goalType: "paginas", goalText: "Ler pág. 235 a 250", pageStart: 235, pageEnd: 250, plannedMinutes: 55, elapsedMinutes: 30, interrupts: 1, completionRate: 55, zone: "media", exitReason: "meta_concluida", completed: true, status: "partial", completionPercentage: 70, startedAt: addDaysIso(-6) },
  { id: 708, subjectId: 17, subjectName: "Física · Dinâmica (Leis de Newton)", color: demoColorFor(17), materialId: 102, materialTitle: "Tópicos de Física · Vol. 1", goalType: "exercicios", goalText: "Resolver 12 exercícios de dinâmica", pageStart: null, pageEnd: null, plannedMinutes: 60, elapsedMinutes: 62, interrupts: 0, completionRate: 100, zone: "baixa", exitReason: null, completed: true, status: "done", completionPercentage: 88, startedAt: addDaysIso(-7) },
  { id: 709, subjectId: 38, subjectName: "Química · Orgânica (Nomenclatura e Funções)", color: demoColorFor(38), materialId: 103, materialTitle: "Química Orgânica · Usberco", goalType: "paginas", goalText: "Ler pág. 96 a 112", pageStart: 96, pageEnd: 112, plannedMinutes: 45, elapsedMinutes: 40, interrupts: 1, completionRate: 89, zone: "media", exitReason: null, completed: false, status: "buffered", completionPercentage: 80, startedAt: addDaysIso(-8) }
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
  { id: 801, subjectId: 17, subjectName: "Física · Dinâmica (Leis de Newton)", note: "Lembrar de conferir a fórmula de atrito nos exercícios da prova antiga do IME.", createdAt: addDaysIso(-2) },
  { id: 802, subjectId: null, subjectName: null, note: "Pesquisar a lista de câmpus da faculdade que abre inscrição na semana que vem.", createdAt: addDaysIso(-3) },
  { id: 803, subjectId: 11, subjectName: "Matemática · Geometria Plana", note: "Revisar o teorema do ângulo inscrito antes da lista nova.", createdAt: addDaysIso(-5) }
];

/* ---------------------------------------------------------------- */
/* Triage WBS: buffer, plano de reagendamento                       */
/* ---------------------------------------------------------------- */

export const demoBufferAllocations: BufferAllocation[] = [
  { id: 851, subjectId: 38, subjectName: "Química · Orgânica (Nomenclatura e Funções)", color: demoColorFor(38), sourceGoal: "Dominar nomenclatura de alcanos", debtMinutes: 20, destination: "saturday", status: "queued", createdAt: addDaysIso(-2) },
  { id: 852, subjectId: 98, subjectName: "Faculdade · Algoritmos e Estruturas de Dados", color: demoColorFor(98), sourceGoal: "Ler pág. 40 a 55", debtMinutes: 30, destination: "next_week", status: "queued", createdAt: addDaysIso(-4) },
  { id: 853, subjectId: 11, subjectName: "Matemática · Geometria Plana", color: demoColorFor(11), sourceGoal: "Ler pág. 235 a 250", debtMinutes: 25, destination: "saturday", status: "queued", createdAt: addDaysIso(-6) }
];

export const demoReschedulePlan: ReschedulePlan = {
  generatedDate: todayIso(),
  totalDebtMinutes: 75,
  saturdayMinutes: 45,
  nextWeekMinutes: 30,
  protectedMorningHours: 3,
  items: [
    { sourceSessionId: 703, subjectId: 38, subjectName: "Química · Orgânica (Nomenclatura e Funções)", color: demoColorFor(38), goal: "Dominar nomenclatura de alcanos", plannedMinutes: 40, executedMinutes: 20, debtMinutes: 20, destination: "saturday", destinationLabel: "Sábado à tarde" },
    { sourceSessionId: 705, subjectId: 98, subjectName: "Faculdade · Algoritmos e Estruturas de Dados", color: demoColorFor(98), goal: "Ler pág. 40 a 55", plannedMinutes: 45, executedMinutes: 15, debtMinutes: 30, destination: "next_week", destinationLabel: "Semana seguinte" },
    { sourceSessionId: 707, subjectId: 11, subjectName: "Matemática · Geometria Plana", color: demoColorFor(11), goal: "Ler pág. 235 a 250", plannedMinutes: 55, executedMinutes: 30, debtMinutes: 25, destination: "saturday", destinationLabel: "Sábado à tarde" }
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

export const demoProfile: Profile = { dailyHours: 6, weeklyDays: 6, examTrack: "ITA", startDate: addDaysIso(-120), examDate: addDaysIso(92), studyDays: [0, 1, 2, 3, 4, 5] };

/* ---------------------------------------------------------------- */
/* Livestream de retenção (demo) — amostras em tempo real por        */
/* matéria, usadas no card "Retenção · livestream" do Desempenho.    */
/* `overdue`/`manyPartials` sinalizam atraso e excesso de blocos     */
/* parciais (pisca vermelho + alerta sonoro). Os demais dados        */
/* derivam das coleções demo existentes para bater com o painel.     */
/* ---------------------------------------------------------------- */

const MANY_PARTIALS_THRESHOLD = 3;

export const demoRetentionLivestreamTicks: RetentionLiveTick[] = demoSubjects.map((subject, index) => {
  const row = demoRanking.find((entry) => entry.id === subject.id);
  const partialSessions = demoFocusSessions.filter((session) => session.subjectId === subject.id && session.zone === "baixa" && session.status === "partial");
  const dueSoon = demoMemoryItems.filter((item) => item.subjectId === subject.id && item.dueDate <= addDaysIso(3)).length;
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

/* ------------------------------------------------------------------ */
/* T6 — Livestream de retenção (rota humilde). O card no            */
/* PerformanceView avança as amostras reais da demo quando o demo    */
/* está ativo; dispara o aviso vermelho quando `overdue`/`many`.     */
/* ------------------------------------------------------------------ */
export const demoRetentionLivestream: RetentionLiveStream[] = (() => {
  const base = [...demoRetentionLivestreamTicks];
  const ticks: RetentionLiveStream[] = [];
  for (let windowStart = 0; windowStart < demoRanking.length; windowStart += 273) {
    const generatedAt = addDaysIso(-8 + Math.floor(windowStart / demoRanking.length));
    ticks.push({
      generatedAt,
      horizonMinutes: 54,
      ticks: demoSubjects.map((subject, index) => {
        const live = base[index];
        return {
          ...live,
          retentionDelta: live.retentionDelta + (windowStart % 7)
        };
      })
    });
  }
  return ticks;
})();
  

