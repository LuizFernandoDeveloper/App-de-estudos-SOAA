import type { BrainDumpLog, BufferAllocation, DashboardData, DayAllocation, FocusOverloadPoint, MaterialStrategy, MemoryDecayProjection, MemoryPoint, PerformanceGranularity, PerformancePoint, PlanResponse, PomodoroSession, ReschedulePlan, RetentionOverview, RetentionSeriesInfo, ReviewGrade, ScheduleResponse, SpacedRepetitionItem, StudyMaterial, Subject, SubjectAccuracyPoint, SubjectRanking, TimeboxSuggestion, Topic } from "../shared/types";

const pad = (value: number) => String(value).padStart(2, "0");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
};

const formatMinutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const demoSubjects: Subject[] = [
  { id: -1, userId: 1, name: "Matemática · ITA/IME", weight: 5, difficulty: 5, computedIp: 25, color: "indigo", goalAccuracy: 75, goalCoverage: 100, currentLevel: 2, targetLevel: 5, createdAt: "" },
  { id: -2, userId: 1, name: "Física · Mecânica e Eletromagnetismo", weight: 5, difficulty: 4, computedIp: 20, color: "violet", goalAccuracy: 75, goalCoverage: 100, currentLevel: 2, targetLevel: 4, createdAt: "" },
  { id: -3, userId: 1, name: "Química · Físico-Química", weight: 4, difficulty: 4, computedIp: 16, color: "cyan", goalAccuracy: 70, goalCoverage: 90, currentLevel: 1, targetLevel: 4, createdAt: "" },
  { id: -4, userId: 1, name: "Português e Redação", weight: 4, difficulty: 3, computedIp: 12, color: "pink", goalAccuracy: 80, goalCoverage: 100, currentLevel: 2, targetLevel: 3, createdAt: "" },
  { id: -5, userId: 1, name: "Inglês · Reading", weight: 3, difficulty: 2, computedIp: 6, color: "amber", goalAccuracy: 85, goalCoverage: 80, currentLevel: 2, targetLevel: 4, createdAt: "" },
  { id: -6, userId: 1, name: "Biologia", weight: 3, difficulty: 3, computedIp: 9, color: "emerald", goalAccuracy: 70, goalCoverage: 100, currentLevel: 1, targetLevel: 4, createdAt: "" },
  { id: -7, userId: 1, name: "Humanas · ENEM", weight: 2, difficulty: 3, computedIp: 6, color: "orange", goalAccuracy: 65, goalCoverage: 100, currentLevel: 2, targetLevel: 3, createdAt: "" }
];

const topicSeed: Array<[number, string, "pendente" | "em_andamento" | "concluido"]> = [
  [-1, "Números complexos", "concluido"], [-1, "Geometria analítica", "em_andamento"], [-1, "Funções trigonométricas", "pendente"],
  [-2, "Cinemática", "concluido"], [-2, "Eletrostática", "em_andamento"], [-2, "Termodinâmica", "pendente"],
  [-3, "Estequiometria", "concluido"], [-3, "Termoquímica", "em_andamento"],
  [-4, "Interpretação de texto", "em_andamento"], [-4, "Dissertação", "pendente"],
  [-5, "Vocabulary", "em_andamento"], [-5, "Skimming & scanning", "pendente"],
  [-6, "Citologia", "pendente"], [-6, "Genética", "pendente"],
  [-7, "Atualidades", "em_andamento"]
];

export const demoTopicList: Topic[] = topicSeed.map(([subjectId, name, status], index) => ({
  id: -(index + 1), userId: 1, subjectId: subjectId as number, name, status, createdAt: ""
}));

const demoMaterialSeed: Array<[number, number, string, number, number, "em_andamento" | "concluido", string]> = [
  [-1, -2, "Fundamentos da Matemática Elementar", 4, 640, "em_andamento", "edusp"],
  [-1, -1, "Tópicos de Álgebra (Elementar I)", 2, 340, "em_andamento", "vestseller"],
  [-2, -5, "Eletromagnetismo I", 3, 420, "em_andamento", "hermes"],
  [-2, -4, "Apostila de Cinemática ITA", 1, 120, "em_andamento", "pdf"],
  [-3, -7, "Química para Vestibulandos", 5, 480, "em_andamento", "atahualpa"],
  [-4, -10, "Gramática de Uso da Língua Portuguesa", 1, 320, "concluido", "portfolio"]
];

export const demoMaterialList: StudyMaterial[] = demoMaterialSeed.map(([subjectId, topicId, title, currentPage, totalPages, status, category], index) => ({
  id: -(index + 1),
  userId: 1,
  subjectId: subjectId as number,
  topicId: topicId as number,
  title,
  category,
  urlPath: null,
  status,
  tags: [] as string[],
  front: null,
  topic: null,
  pageFocus: null,
  currentPage,
  totalPages,
  remindDate: null,
  studyStrategy: index === 0 ? "Prática de Recuperação prioritária" : index === 2 ? "Resolução em Deep Work" : null,
  createdAt: ""
}));

const round1 = (value: number) => Math.round(value * 10) / 10;

const ip = demoSubjects.map((subject) => subject.computedIp);
const totalIp = ip.reduce((sum, value) => sum + value, 0);
const totalMinutes = 360;
const exactMinutes = ip.map((value) => value / totalIp * totalMinutes);
const allocatedMinutes = [95, 75, 60, 45, 25, 35, 25];
const percentages = ip.map((value) => Math.round(value / totalIp * 1000) / 10);

export const demoSchedule: ScheduleResponse = {
  totalHours: 6,
  totalMinutes,
  totalIp,
  projectBufferMinutes: 0,
  formattedProjectBuffer: "0m",
  allocations: demoSubjects.map((subject, index) => ({
    ...subject,
    exactMinutes: exactMinutes[index],
    allocatedMinutes: allocatedMinutes[index],
    formattedTime: formatMinutes(allocatedMinutes[index]),
    percentage: percentages[index]
  }))
};

const accuracySeries = [58, 64, 71, 63, 76, 68, 72, 60, 79, 74, 70, 81, 73, 78];
const totalsSeries = [24, 30, 28, 22, 35, 32, 26, 30, 38, 34, 30, 42, 36, 40];

const performanceBySubject = [
  { subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", questionsTotal: 300, questionsCorrect: 198, studiedMinutes: 420 },
  { subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", questionsTotal: 240, questionsCorrect: 174, studiedMinutes: 350 },
  { subjectId: -3, subjectName: "Química · Físico-Química", color: "cyan", questionsTotal: 150, questionsCorrect: 111, studiedMinutes: 280 },
  { subjectId: -4, subjectName: "Português e Redação", color: "pink", questionsTotal: 200, questionsCorrect: 152, studiedMinutes: 300 },
  { subjectId: -5, subjectName: "Inglês · Reading", color: "amber", questionsTotal: 90, questionsCorrect: 76, studiedMinutes: 120 },
  { subjectId: -6, subjectName: "Biologia", color: "emerald", questionsTotal: 80, questionsCorrect: 57, studiedMinutes: 150 },
  { subjectId: -7, subjectName: "Humanas · ENEM", color: "orange", questionsTotal: 60, questionsCorrect: 39, studiedMinutes: 100 }
];

export const demoRanking: SubjectRanking[] = (() => {
  const maxQuestions = Math.max(...performanceBySubject.map((row) => row.questionsTotal));
  const byId = new Map(performanceBySubject.map((row) => [row.subjectId, row]));
  const movements = ["same", "up", "down", "same", "up", "new", "down"] as const;
  const rows = demoSubjects.map((subject, index) => {
    const row = byId.get(subject.id);
    const accuracy = row ? row.questionsCorrect / row.questionsTotal * 100 : 0;
    const strategy = subject.weight / 5 * 3;
    const deficit = Math.min(1, Math.max(0, (subject.goalAccuracy - accuracy) / 100)) * 4;
    const volume = row ? row.questionsTotal / maxQuestions * 1.5 : 0;
    const priority = strategy + deficit + volume + 0.75;
    return {
      ...subject,
      movement: movements[index],
      strategyScore: round1(strategy),
      deficitScore: round1(deficit),
      volumeScore: round1(volume),
      trendScore: 0.8,
      priorityScore: round1(priority),
      accuracy: round1(accuracy),
      recentAccuracy: round1(accuracy * 1.02),
      previousAccuracy: round1(accuracy * 0.96),
      questionsTotal: row?.questionsTotal ?? 0,
      studiedMinutes: row?.studiedMinutes ?? 0
    };
  });
  return rows
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((row, index) => ({ ...row, rank: index + 1 }));
})();

const subjectTrendSeed: Array<[number, number, number]> = [
  [-1, 51, 2.2], [-2, 47, 1.9], [-3, 55, 1.6], [-4, 63, 1.1], [-5, 73, 0.7], [-6, 49, 1.8], [-7, 61, 0.5]
];

export const demoSubjectAccuracyTrend: SubjectAccuracyPoint[] = (() => {
  const weeks = 10;
  const out: SubjectAccuracyPoint[] = [];
  for (let week = weeks; week >= 1; week--) {
    const date = new Date();
    date.setDate(date.getDate() - week * 7);
    for (const [subjectId, base, slope] of subjectTrendSeed) {
      const subject = demoSubjects.find((s) => s.id === subjectId);
      if (!subject) continue;
      const progress = weeks - week;
      const noise = ((subjectId * 7 + week * 13) % 11) - 5;
      out.push({
        subjectId,
        subjectName: subject.name,
        color: subject.color,
        date: isoDate(date),
        questionsTotal: 12 + ((subjectId * 3 + week) % 16),
        accuracy: Math.round(Math.min(96, Math.max(28, base + slope * progress + noise)) * 10) / 10
      });
    }
  }
  return out;
})();

export const demoDayAllocations: DayAllocation[] = [
  { id: -1, subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", weekday: 1, minutes: 80, note: "Queda no ranking" },
  { id: -2, subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", weekday: 3, minutes: 60, note: "Déficit vs meta de acerto" },
  { id: -3, subjectId: -7, subjectName: "Humanas · ENEM", color: "orange", weekday: 5, minutes: 45, note: "Sem histórico recente" }
];

export const demoDashboard: DashboardData = {
  profile: { dailyHours: 6, weeklyDays: 6, examTrack: "ITA", startDate: daysAgo(45), examDate: daysAgo(-120) },
  subjectsCount: demoSubjects.length,
  materials: { total: 14, completed: 6 },
  questions: {
    total: 1120,
    correct: 807,
    accuracy: 72.1
  },
  weeklyStudyMinutes: 1250,
  dailyPerformance: accuracySeries.map((accuracy, index) => ({
    date: daysAgo(accuracySeries.length - 1 - index),
    accuracy,
    total: totalsSeries[index]
  })),
  subjectPerformance: performanceBySubject.map((item) => ({
    ...item,
    accuracy: Math.round(item.questionsCorrect / item.questionsTotal * 1000) / 10
  })),
  reminders: [
    { id: -1, subjectId: -1, subjectName: "Matemática · ITA/IME", title: "Fundamentos da Matemática", front: "Aritmética", topic: "Porcentagem", pageFocus: "p. 91–140", remindDate: daysAgo(0), daysLeft: 0 },
    { id: -2, subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", title: "Eletromagnetismo I", front: "Eletrostática", topic: "Campo elétrico", pageFocus: "p. 45–92", remindDate: daysAgo(-1), daysLeft: 1 }
  ]
};

const buildTrend = (count: number, mode: PerformanceGranularity): PerformancePoint[] => {
  const points: PerformancePoint[] = [];
  const now = new Date();
  for (let index = 0; index < count; index++) {
    const offset = count - 1 - index;
    const date = new Date(now);
    if (mode === "day") date.setDate(date.getDate() - offset);
    else if (mode === "week") date.setDate(date.getDate() - offset * 7);
    else if (mode === "month") date.setMonth(date.getMonth() - offset);
    else date.setFullYear(date.getFullYear() - offset);

    const progress = index / (count - 1);
    const accuracy = Math.round((42 + progress * 42 + ((index * 53) % 9) - 4) * 10) / 10;
    const total = 18 + ((index * 7) % 24);
    const label = mode === "month"
      ? `${pad(date.getMonth() + 1)}/${date.getFullYear()}`
      : mode === "year"
        ? String(date.getFullYear())
        : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    points.push({
      label,
      startDate: isoDate(date),
      questionsTotal: total,
      questionsCorrect: Math.round(total * accuracy / 100),
      accuracy
    });
  }
  return points;
};

export const demoTrend: Record<PerformanceGranularity, PerformancePoint[]> = {
  day: buildTrend(30, "day"),
  week: buildTrend(12, "week"),
  month: buildTrend(12, "month"),
  year: buildTrend(6, "year")
};

const trendCount: Record<PerformanceGranularity, number> = { day: 30, week: 12, month: 12, year: 6 };

const buildFilteredTrend = (mode: PerformanceGranularity, seed: number, base: number, slope: number, totalBias: number): PerformancePoint[] => {
  const points: PerformancePoint[] = [];
  const count = trendCount[mode];
  const now = new Date();
  for (let index = 0; index < count; index++) {
    const offset = count - 1 - index;
    const date = new Date(now);
    if (mode === "day") date.setDate(date.getDate() - offset);
    else if (mode === "week") date.setDate(date.getDate() - offset * 7);
    else if (mode === "month") date.setMonth(date.getMonth() - offset);
    else date.setFullYear(date.getFullYear() - offset);

    const progress = index / (count - 1);
    const wobble = ((index * 17 + seed * 31) % 11) - 5;
    const accuracy = Math.round((base + progress * slope + wobble) * 10) / 10;
    const total = Math.max(4, Math.round(totalBias + ((index * 5 + seed * 3) % 14)));
    const label = mode === "month"
      ? `${pad(date.getMonth() + 1)}/${date.getFullYear()}` : mode === "year"
        ? String(date.getFullYear()) : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    points.push({
      label,
      startDate: isoDate(date),
      questionsTotal: Math.round(total),
      questionsCorrect: Math.max(0, Math.round(total * accuracy / 100)),
      accuracy
    });
  }
  return points;
};

/** Série de melhoria filtrada: subjectId nulo → média geral (demoTrend); topicId nulo → matéria. */
export function demoFilteredTrend(granularity: PerformanceGranularity, subjectId: number | null, topicId: number | null): PerformancePoint[] {
  if (subjectId === null) return demoTrend[granularity];
  const subject = demoSubjects.find((s) => s.id === subjectId);
  if (!subject) return demoTrend[granularity];
  const index = demoSubjects.indexOf(subject);
  if (topicId === null) {
    const base = 38 + (index % 4) * 8;
    const slope = 30 + (index % 3) * 8;
    return buildFilteredTrend(granularity, index + 1, base, slope, 18 + index * 3);
  }
  const topic = demoTopicList.find((t) => t.id === topicId);
  const topicIndex = demoTopicList.indexOf(topic ?? demoTopicList[0]);
  const base = 30 + (topicIndex % 5) * 6;
  const slope = 42 + (topicIndex % 3) * 6;
  return buildFilteredTrend(granularity, topicIndex + 11, base, slope, 8 + (topicIndex % 4) * 4);
}

export const demoFocusOverloadTrend: FocusOverloadPoint[] = (() => {
  const days = 15;
  const series: Array<[number, number, number]> = [
    [-1, 62, 1.8],
    [-2, 58, 1.9],
    [-3, 66, 1.5],
    [-4, 71, 1.2],
    [-5, 78, 0.8],
    [-6, 60, 1.7],
    [-7, 74, 0.6]
  ];
  const out: FocusOverloadPoint[] = [];
  const general = new Map<string, { sessions: number; planned: number; elapsed: number; deep: number }>();
  for (let day = days; day >= 0; day--) {
    const date = daysAgo(day);
    const plannedDay = 60 + ((day * 17) % 40);
    let sessionsDay = 0;
    let elapsedDay = 0;
    let deepDay = 0;
    for (const [subjectId, base, slope] of series) {
      const subject = demoSubjects.find((s) => s.id === subjectId);
      if (!subject) continue;
      const progress = days - day;
      const noise = ((subjectId * 5 + day * 11) % 9) - 4;
      const rate = Math.round(Math.min(98, Math.max(30, base + slope * progress + noise)));
      const sessions = 1 + ((subjectId * 3 + day) % 3);
      const planned = 30 + ((subjectId * 2 + day * 3) % 20);
      const elapsed = Math.round(planned * rate / 100);
      sessionsDay += sessions;
      elapsedDay += elapsed;
      deepDay += rate >= 85 ? sessions : 0;
      out.push({
        subjectId,
        subjectName: subject.name,
        color: subject.color,
        date,
        sessions,
        plannedMinutes: planned,
        elapsedMinutes: elapsed,
        completionRate: rate,
        deepWorkSessions: rate >= 85 ? sessions : 0
      });
    }
    general.set(date, { sessions: sessionsDay, planned: plannedDay, elapsed: elapsedDay, deep: deepDay });
  }
  for (const [date, value] of general) {
    out.push({
      subjectId: 0,
      subjectName: "Geral",
      color: "slate",
      date,
      sessions: value.sessions,
      plannedMinutes: value.planned,
      elapsedMinutes: value.elapsed,
      completionRate: Math.round(value.elapsed / Math.max(1, value.planned) * 100),
      deepWorkSessions: value.deep
    });
  }
  return out;
})();

export const demoPomodoroSessions: PomodoroSession[] = (() => {
  const goals: Array<{ subjectId: number; goalType: PomodoroSession["goalType"]; goalText: string; pageStart: number | null; pageEnd: number | null; materialId: number | null }> = [
    { subjectId: -1, goalType: "exercicios", goalText: "Resolver 15 exercícios de Geometria analítica", pageStart: null, pageEnd: null, materialId: -1 },
    { subjectId: -2, goalType: "paginas", goalText: "Ler pág. 45 a 64 de Eletrostática", pageStart: 45, pageEnd: 64, materialId: -3 },
    { subjectId: -1, goalType: "topicos", goalText: "Combinatória · princípio multiplicativo", pageStart: null, pageEnd: null, materialId: null },
    { subjectId: -3, goalType: "paginas", goalText: "Ler pág. 12 a 28 de Termoquímica", pageStart: 12, pageEnd: 28, materialId: -5 },
    { subjectId: -2, goalType: "exercicios", goalText: "10 questões de Campo elétrico", pageStart: null, pageEnd: null, materialId: null }
  ];
  const perks = [0.5, 0.6, 0.8, 0.9, 1];
  const out: PomodoroSession[] = [];
  goals.forEach((goal, index) => {
    for (let day = 0; day < 3; day++) {
      const deep = ((index * 7 + day * 5) % 4) !== 0;
      const planned = 30 + index * 10 + day * 5;
      const elapsed = deep ? Math.round(planned * perks[(day + index) % perks.length]) : Math.round(planned * (0.45 + ((index + day) % 3) * 0.18));
      const subject = demoSubjects.find((s) => s.id === goal.subjectId)!;
      const material = goal.materialId ? demoMaterialList.find((m) => m.id === goal.materialId) : undefined;
      out.push({
        id: -(out.length + 1),
        subjectId: goal.subjectId,
        subjectName: subject.name,
        color: subject.color,
        materialId: goal.materialId,
        materialTitle: material?.title ?? null,
        goalType: goal.goalType,
        goalText: goal.goalText,
        pageStart: goal.pageStart,
        pageEnd: goal.pageEnd,
        plannedMinutes: planned,
        elapsedMinutes: elapsed,
        interrupts: deep ? 0 : 1 + (day % 2),
        completionRate: Math.round(elapsed / planned * 100),
        exitReason: deep ? null : (["fadiga_metabolica", "distracao_externa", "dificuldade_materia"] as const)[day % 3],
        completed: deep,
        status: deep ? "done" : "partial",
        completionPercentage: deep ? 100 : Math.round(elapsed / planned * 60),
        startedAt: `${daysAgo(day * 2)}T${pad(9 + index)}:00:00`
      });
    }
  });
  return out;
})();

export const demoBrainDumps: BrainDumpLog[] = [
  { id: -1, subjectId: -1, subjectName: "Matemática · ITA/IME", note: "Lembrar de comparar IA vs IME nos pesos.", createdAt: `${daysAgo(0)}T14:12:00` },
  { id: -2, subjectId: null, subjectName: null, note: "Responder e-mail do professor de física.", createdAt: `${daysAgo(1)}T09:30:00` },
  { id: -3, subjectId: -3, subjectName: "Química · Físico-Química", note: "Ideia: montar tabela de entalpia de formação.", createdAt: `${daysAgo(2)}T16:05:00` }
];

export const demoTimedboxes: TimeboxSuggestion[] = [
  { subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", resistanceIndex: 0.88, completedStreak: 3, previousMinutes: 45, suggestedMinutes: 50, reason: "2+ janelas concluídas em sequência (ZDP sustentada): +5 min de sobrecarga progressiva." },
  { subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", resistanceIndex: 0.5, completedStreak: 1, previousMinutes: 35, suggestedMinutes: 35, reason: "Janela estável: mantenha o timebox atual e evolua quando houver 2 vitórias seguidas." }
];

export const demoStrategies: MaterialStrategy[] = [
  { id: 1, keywords: "fundamentos, matemática, elementar", tactic: "Prática de Recuperação prioritária", reason: "Livros clássicos de base exigem recuperação ativa pós-leitura: consolida a lógica, não leitura passiva.", intensity: "alta" },
  { id: 2, keywords: "problemas, física", tactic: "Resolução em Deep Work", reason: "Problemas abertos exigem contexto mental descarregado; não interrompa no meio da sessão.", intensity: "alta" },
  { id: 3, keywords: "gramática, língua", tactic: "Spaced Repetition + lembrete", reason: "Regras linguísticas têm alta retrievability inicial; o lembrete de revisão reforça a curva FSRS.", intensity: "media" }
];

export const demoBufferAllocations: BufferAllocation[] = [
  { id: -1, subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", sourceGoal: "Ler pág. 45 a 64 de Eletrostática", debtMinutes: 18, destination: "saturday", status: "queued", createdAt: daysAgo(0) },
  { id: -2, subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", sourceGoal: "Combinatória · princípio multiplicativo", debtMinutes: 12, destination: "next_week", status: "queued", createdAt: daysAgo(0) }
];

export const demoReschedulePlan: ReschedulePlan = {
  generatedDate: daysAgo(0),
  totalDebtMinutes: 30,
  saturdayMinutes: 18,
  nextWeekMinutes: 12,
  protectedMorningHours: 6,
  items: [
    { sourceSessionId: -9, subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", goal: "Ler pág. 45 a 64 de Eletrostática", plannedMinutes: 45, executedMinutes: 27, debtMinutes: 18, destination: "saturday", destinationLabel: "Sábado à tarde · Project Buffer" },
    { sourceSessionId: -8, subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", goal: "Combinatória · princípio multiplicativo", plannedMinutes: 30, executedMinutes: 18, debtMinutes: 12, destination: "next_week", destinationLabel: "Semana seguinte · redistribuição" }
  ]
};

export const demoPlan: PlanResponse = {
  weeks: 6,
  riskName: "Matemática · ITA/IME",
  days: Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekday = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][(date.getDay() + 6) % 7];
    const early = offset % 7 <= 2;
    return {
      date: isoDate(date),
      weekdayLabel: weekday,
      focusSubjects: [
        { subjectId: -1, subjectName: "Matemática · ITA/IME", color: "indigo", risk: 9, minutes: early ? 55 : 45, slot: early ? "Janela matutina · aquecimento pós-sono" : "Bloco principal" },
        { subjectId: -2, subjectName: "Física · Mecânica e Eletromagnetismo", color: "violet", risk: 7, minutes: early ? 40 : 35, slot: early ? "Segundo alvo · alternância" : "Tarde · reforço de déficit" }
      ]
    };
  })
};

/* ------------------------------------------------------------------ */
/* Motor de Repetição Espaçada (FSRS) — dados de demonstração          */
/* ------------------------------------------------------------------ */

const ROUND2 = (value: number) => Math.round(value * 100) / 100;

export const calcRetrievability = (stability: number, elapsedDays: number) => {
  if (stability <= 0) return 0;
  return 1 / (1 + Math.max(0, elapsedDays) / (9 * stability));
};

const startOfDay = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysBetween = (from: string, to: string) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

const isoInDays = (from: string, days: number) => {
  const date = startOfDay(from);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};

const difficultyScale = (difficulty: number) => 0.9 + (10 - Math.min(10, Math.max(1, difficulty))) * 0.02;

export const applyDemoGrade = (grade: ReviewGrade, difficulty: number) =>
  ({ again: 0.8, hard: 1.2, good: 2.2, easy: 3.0 })[grade] * difficultyScale(difficulty);

const memorySeed: Array<{ subjectId: number; topicId: number; topicName: string; concept: string; difficulty: number; stability: number; reps: number; daysAgoReviewed: number }> = [
  { subjectId: -1, topicId: -1, topicName: "Números complexos", concept: "Números complexos · forma polar", difficulty: 7, stability: 24, reps: 4, daysAgoReviewed: 12 },
  { subjectId: -2, topicId: -5, topicName: "Eletrostática", concept: "Eletrostática · Lei de Coulomb", difficulty: 8, stability: 14, reps: 3, daysAgoReviewed: 15 },
  { subjectId: -3, topicId: -7, topicName: "Estequiometria", concept: "Termoquímica · entalpia de formação", difficulty: 6, stability: 9, reps: 2, daysAgoReviewed: 11 },
  { subjectId: -4, topicId: -10, topicName: "Dissertação", concept: "Dissertação · estrutura do parágrafo", difficulty: 4, stability: 18, reps: 5, daysAgoReviewed: 4 }
];

export const demoMemoryItems: SpacedRepetitionItem[] = memorySeed.map((seed, index) => {
  const subject = demoSubjects.find((s) => s.id === seed.subjectId)!;
  const lastReviewDate = daysAgo(seed.daysAgoReviewed);
  const elapsed = seed.daysAgoReviewed;
  return {
    id: -(101 + index),
    userId: 1,
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    topicId: seed.topicId,
    topicName: seed.topicName,
    concept: seed.concept,
    difficulty: seed.difficulty,
    stability: seed.stability,
    reps: seed.reps,
    lastReviewDate,
    dueDate: isoInDays(lastReviewDate, seed.stability),
    retrievability: ROUND2(calcRetrievability(seed.stability, elapsed)),
    createdAt: ""
  };
});

export function buildMemoryDecayProjection(item: SpacedRepetitionItem, horizonDays?: number): MemoryDecayProjection {
  const today = daysAgo(0);
  const elapsed = daysBetween(item.lastReviewDate, today);
  const retrievabilityToday = calcRetrievability(item.stability, elapsed);
  const optimalDay = Math.max(1, Math.round(item.stability));
  const optimalDate = isoInDays(item.lastReviewDate, optimalDay);
  const horizon = horizonDays ?? Math.min(180, Math.max(30, Math.ceil(item.stability * 4)));

  const points: MemoryPoint[] = [];
  let ankiStability = item.stability;
  let ankiElapsed = 0;
  for (let day = 0; day <= horizon; day++) {
    const plain = calcRetrievability(item.stability, day);
    const reviewed = ankiElapsed > 0 && ankiElapsed >= ankiStability;
    const anki = reviewed
      ? ((ankiStability *= 2.2 * difficultyScale(item.difficulty)), (ankiElapsed = 0), 1)
      : calcRetrievability(ankiStability, ankiElapsed);
    points.push({
      itemId: item.id,
      day,
      date: isoInDays(item.lastReviewDate, day),
      retrievability: plain,
      anki,
      reviewed
    });
    ankiElapsed += 1;
  }

  return {
    itemId: item.id,
    concept: item.concept,
    subjectName: item.subjectName,
    color: item.color,
    stability: item.stability,
    difficulty: item.difficulty,
    optimalDay,
    optimalDate,
    retrievabilityToday,
    dueInDays: Math.max(0, Math.ceil(optimalDay - elapsed)),
    points
  };
}

const DEMO_RETENTION_HEX: Record<string, string> = {
  indigo: "#8b7cf6", violet: "#a78bfa", cyan: "#22d3ee", pink: "#f472b6",
  amber: "#fbbf24", emerald: "#34d399", orange: "#fb923c", slate: "#94a3b8"
};
const RETENTION_PALETTE = ["#8b7cf6", "#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#fb923c", "#60a5fa", "#2dd4bf", "#f9a8d4"];

interface RetBucket {
  subjectId: number;
  topicId: number;
  topicName: string;
  stability: number;
  elapsed: number;
  items: number;
}

const retentionBuckets: RetBucket[] = [
  { subjectId: -1, topicId: 0, topicName: "", stability: 26, elapsed: 6, items: 4 },
  { subjectId: -1, topicId: -1, topicName: "Números complexos", stability: 24, elapsed: 12, items: 2 },
  { subjectId: -1, topicId: -2, topicName: "Geometria analítica", stability: 12, elapsed: 20, items: 3 },
  { subjectId: -2, topicId: 0, topicName: "", stability: 18, elapsed: 9, items: 4 },
  { subjectId: -2, topicId: -5, topicName: "Eletrostática", stability: 14, elapsed: 15, items: 3 },
  { subjectId: -2, topicId: -4, topicName: "Cinemática", stability: 30, elapsed: 3, items: 2 },
  { subjectId: -3, topicId: 0, topicName: "", stability: 12, elapsed: 10, items: 3 },
  { subjectId: -3, topicId: -7, topicName: "Estequiometria", stability: 8, elapsed: 17, items: 3 },
  { subjectId: -3, topicId: -8, topicName: "Termoquímica", stability: 16, elapsed: 7, items: 2 },
  { subjectId: -4, topicId: 0, topicName: "", stability: 20, elapsed: 5, items: 3 },
  { subjectId: -4, topicId: -9, topicName: "Interpretação de texto", stability: 22, elapsed: 14, items: 2 },
  { subjectId: -5, topicId: 0, topicName: "", stability: 28, elapsed: 8, items: 2 },
  { subjectId: -6, topicId: 0, topicName: "", stability: 10, elapsed: 12, items: 2 },
  { subjectId: -7, topicId: 0, topicName: "", stability: 14, elapsed: 16, items: 2 }
];

const R_AT = (stability: number, elapsed: number) => round1(calcRetrievability(stability, elapsed) * 100);

export const demoRetentionOverview: RetentionOverview = (() => {
  const horizonDays = 60;
  const today = daysAgo(0);
  const bucketsOfSubject = (subjectId: number) => retentionBuckets.filter((b) => b.subjectId === subjectId);
  const subjectLetters = [...demoSubjects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const series: RetentionSeriesInfo[] = [];
  const totalItems = retentionBuckets.reduce((sum, b) => sum + b.items, 0);

  const meanAt = (buckets: RetBucket[]) => (day: number) => {
    const weighted = buckets.reduce((sum, b) => sum + b.items * calcRetrievability(b.stability, b.elapsed + day), 0);
    const weight = buckets.reduce((sum, b) => sum + b.items, 0);
    return weight ? (weighted / weight) * 100 : 0;
  };

  series.push({
    key: "Média Geral",
    name: "Média Geral",
    level: "global",
    subjectId: 0,
    topicId: 0,
    color: "#94a3b8",
    items: totalItems,
    avgStability: round1(retentionBuckets.reduce((s, b) => s + b.stability * b.items, 0) / totalItems),
    retrievabilityToday: R_AT(
      round1(retentionBuckets.reduce((s, b) => s + b.stability * b.items, 0) / totalItems),
      round1(retentionBuckets.reduce((s, b) => s + b.elapsed * b.items, 0) / totalItems)
    ),
    dueInDays: Math.max(0, ...retentionBuckets.map((b) => Math.ceil(b.stability - b.elapsed)))
  });

  subjectLetters.forEach((subject, subjectIndex) => {
    const buckets = bucketsOfSubject(subject.id);
    if (!buckets.length) return;
    const mean = meanAt(buckets);
    const weightedElapsed = buckets.reduce((s, b) => s + b.elapsed * b.items, 0) / buckets.reduce((s, b) => s + b.items, 0);
    series.push({
      key: subject.name,
      name: subject.name,
      level: "subject",
      subjectId: subject.id,
      topicId: 0,
      color: DEMO_RETENTION_HEX[subject.color] ?? RETENTION_PALETTE[subjectIndex % RETENTION_PALETTE.length],
      items: buckets.reduce((s, b) => s + b.items, 0),
      avgStability: round1(buckets.reduce((s, b) => s + b.stability * b.items, 0) / buckets.reduce((s, b) => s + b.items, 0)),
      retrievabilityToday: round1(mean(0)),
      dueInDays: Math.max(0, ...buckets.map((b) => Math.ceil(b.stability - b.elapsed)))
    });
  });

  const parentSeries = new Map<number, string>();
  series.filter((s) => s.level === "subject").forEach((s) => parentSeries.set(s.subjectId, s.color));
  subjectLetters.forEach((subject, subjectIndex) => {
    const nicheBuckets = bucketsOfSubject(subject.id).filter((b) => b.topicId !== 0);
    nicheBuckets.forEach((bucket, topicIndex) => {
      const parent = parentSeries.get(bucket.subjectId);
      let color = RETENTION_PALETTE[(subjectIndex * 2 + topicIndex) % RETENTION_PALETTE.length];
      if (color === parent) {
        color = RETENTION_PALETTE[(subjectIndex * 2 + topicIndex + 3) % RETENTION_PALETTE.length];
      }
      series.push({
        key: `${subject.name} › ${bucket.topicName}`,
        name: `${subject.name} › ${bucket.topicName}`,
        level: "topic",
        subjectId: bucket.subjectId,
        topicId: bucket.topicId,
        color,
        items: bucket.items,
        avgStability: bucket.stability,
        retrievabilityToday: R_AT(bucket.stability, bucket.elapsed),
        dueInDays: Math.max(0, Math.ceil(bucket.stability - bucket.elapsed))
      });
    });
  });

  const rows: Array<Record<string, number | string>> = [];
  for (let day = 0; day <= horizonDays; day++) {
    const row: Record<string, number | string> = { day, date: isoInDays(today, day) };
    series.forEach((s) => {
      let value: number;
      if (s.level === "global") {
        value = round1(demoRetentionRowsByBucket(retentionBuckets, day));
      } else if (s.level === "subject") {
        value = round1(demoRetentionRowsByBucket(bucketsOfSubject(s.subjectId), day));
      } else {
        const bucket = retentionBuckets.find((b) => b.topicId === s.topicId);
        value = bucket ? round1(calcRetrievability(bucket.stability, bucket.elapsed + day) * 100) : 0;
      }
      row[s.key] = value;
    });
    rows.push(row);
  }

  return { generatedDate: today, horizonDays, series, rows };
})();

function demoRetentionRowsByBucket(buckets: RetBucket[], day: number): number {
  const weighted = buckets.reduce((sum, b) => sum + b.items * calcRetrievability(b.stability, b.elapsed + day), 0);
  const weight = buckets.reduce((sum, b) => sum + b.items, 0);
  return weight ? (weighted / weight) * 100 : 0;
}