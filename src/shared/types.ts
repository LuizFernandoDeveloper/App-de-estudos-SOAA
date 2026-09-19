export type ExamTrack = "Ensino Médio" | "ENEM" | "ITA" | "IME" | "Personalizado";
export type MaterialStatus = "pendente" | "em_andamento" | "concluido";
export type TopicStatus = MaterialStatus;
export type PerformanceGranularity = "day" | "week" | "month" | "year";

export interface Subject {
  id: number;
  userId: number;
  name: string;
  weight: number;
  difficulty: number;
  computedIp: number;
  color: string;
  goalAccuracy: number;
  goalCoverage: number;
  currentLevel: number;
  targetLevel: number;
  createdAt: string;
}

export interface SubjectGoalInput {
  goalAccuracy: number;
  goalCoverage: number;
}

export interface Topic {
  id: number;
  userId: number;
  subjectId: number;
  name: string;
  status: TopicStatus;
  createdAt: string;
}

export interface TopicInput {
  subjectId: number;
  name: string;
  status: TopicStatus;
}

export interface Allocation extends Subject {
  exactMinutes: number;
  allocatedMinutes: number;
  formattedTime: string;
  percentage: number;
}

export interface ScheduleResponse {
  totalHours: number;
  totalMinutes: number;
  totalIp: number;
  projectBufferMinutes: number;
  formattedProjectBuffer: string;
  allocations: Allocation[];
}

export interface StudyMaterial {
  id: number;
  userId: number;
  subjectId: number | null;
  topicId: number | null;
  title: string;
  category: string;
  urlPath: string | null;
  status: MaterialStatus;
  tags: string[];
  front: string | null;
  topic: string | null;
  pageFocus: string | null;
  currentPage: number;
  totalPages: number;
  remindDate: string | null;
  studyStrategy: string | null;
  createdAt: string;
}

export interface MaterialReminder {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  title: string;
  front: string | null;
  topic: string | null;
  pageFocus: string | null;
  remindDate: string;
  daysLeft: number;
}

export interface QuestionResult {
  id: number;
  subjectId: number;
  date: string;
  questionsTotal: number;
  questionsCorrect: number;
  studiedMinutes: number;
}

export interface Profile {
  dailyHours: number;
  weeklyDays: number;
  examTrack: ExamTrack;
  startDate: string | null;
  examDate: string | null;
}

export interface SubjectPerformance {
  subjectId: number;
  subjectName: string;
  color: string;
  questionsTotal: number;
  questionsCorrect: number;
  accuracy: number;
  studiedMinutes: number;
}

export interface DashboardData {
  profile: Profile;
  subjectsCount: number;
  materials: { total: number; completed: number };
  questions: { total: number; correct: number; accuracy: number };
  weeklyStudyMinutes: number;
  dailyPerformance: Array<{ date: string; accuracy: number; total: number }>;
  subjectPerformance: SubjectPerformance[];
  reminders: MaterialReminder[];
}

export interface PerformancePoint {
  label: string;
  startDate: string;
  questionsTotal: number;
  questionsCorrect: number;
  accuracy: number;
}

export interface SubjectRanking extends Subject {
  rank: number;
  movement: "up" | "down" | "same" | "new";
  strategyScore: number;
  deficitScore: number;
  volumeScore: number;
  trendScore: number;
  priorityScore: number;
  accuracy: number;
  recentAccuracy: number;
  previousAccuracy: number;
  questionsTotal: number;
  studiedMinutes: number;
}

export interface SubjectAccuracyPoint {
  subjectId: number;
  subjectName: string;
  color: string;
  date: string;
  questionsTotal: number;
  accuracy: number;
}

export interface DayAllocation {
  id: number;
  subjectId: number;
  subjectName: string;
  color: string;
  /** 0 = Segunda … 6 = Domingo */
  weekday: number;
  minutes: number;
  note: string | null;
}

export interface DayAllocationInput {
  subjectId: number;
  weekday: number;
  minutes: number;
  note: string | null;
}

export type FocusGoalType = "paginas" | "topicos" | "exercicios";
export type EarlyExitReason =
  | "fadiga_metabolica"
  | "distracao_externa"
  | "dificuldade_materia"
  | "meta_concluida";
export type SessionStatus = "pending" | "partial" | "done" | "buffered";
export type BufferDestination = "saturday" | "next_week";

export interface PomodoroSessionInput {
  subjectId: number;
  materialId: number | null;
  goalType: FocusGoalType;
  goalText: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  plannedMinutes: number;
  elapsedMinutes: number;
  interrupts: number;
  exitReason: EarlyExitReason | null;
  completionPercentage: number | null;
  startedAt: string;
}

export interface PomodoroSession {
  id: number;
  subjectId: number;
  subjectName: string;
  color: string;
  materialId: number | null;
  materialTitle: string | null;
  goalType: FocusGoalType;
  goalText: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  plannedMinutes: number;
  elapsedMinutes: number;
  interrupts: number;
  completionRate: number;
  exitReason: EarlyExitReason | null;
  completed: boolean;
  status: SessionStatus;
  completionPercentage: number | null;
  startedAt: string;
}

export interface SessionSummary {
  subjectId: number;
  subjectName: string;
  plannedMinutes: number;
  elapsedMinutes: number;
  interrupts: number;
  completionRate: number;
  exitReason: EarlyExitReason | null;
  completionPercentage: number | null;
  deepWork: boolean;
  suggestedNext: number;
  suggestionReason: string;
  efficiencyGain: string | null;
}

export interface BrainDumpLogInput {
  subjectId: number | null;
  note: string;
}

export interface BrainDumpLog {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  note: string;
  createdAt: string;
}

export interface TimeboxSuggestion {
  subjectId: number;
  subjectName: string;
  color: string;
  resistanceIndex: number;
  completedStreak: number;
  previousMinutes: number;
  suggestedMinutes: number;
  reason: string;
}

export interface LearningSpeed {
  materialId: number | null;
  materialTitle: string | null;
  sessions: number;
  minutesTotal: number;
  pagesDone: number;
  minutesPerPage: number | null;
  exercisesDone: number;
  minutesPerExercise: number | null;
}

export interface FocusOverloadPoint {
  subjectId: number;
  subjectName: string;
  color: string;
  date: string;
  sessions: number;
  plannedMinutes: number;
  elapsedMinutes: number;
  completionRate: number;
  deepWorkSessions: number;
}

export interface MaterialStrategy {
  id: number;
  keywords: string;
  tactic: string;
  reason: string;
  intensity: string;
}

export interface StrategyMatch {
  tactic: string;
  reason: string;
  intensity: string;
}

export interface PlanInput {
  startDate: string;
  examDate: string;
  totalHours: number;
}

export interface PlanFocus {
  subjectId: number;
  subjectName: string;
  color: string;
  risk: number;
  minutes: number;
  slot: string;
}

export interface PlanDay {
  date: string;
  weekdayLabel: string;
  focusSubjects: PlanFocus[];
}

export interface PlanResponse {
  weeks: number;
  riskName: string | null;
  days: PlanDay[];
}

export interface BufferAllocation {
  id: number;
  subjectId: number;
  subjectName: string;
  color: string;
  sourceGoal: string | null;
  debtMinutes: number;
  destination: BufferDestination;
  status: "queued" | "done" | "expired";
  createdAt: string;
}

export interface RescheduleItem {
  sourceSessionId: number;
  subjectId: number;
  subjectName: string;
  color: string;
  goal: string | null;
  plannedMinutes: number;
  executedMinutes: number;
  debtMinutes: number;
  destination: BufferDestination;
  destinationLabel: string;
}

export interface ReschedulePlan {
  generatedDate: string;
  totalDebtMinutes: number;
  saturdayMinutes: number;
  nextWeekMinutes: number;
  protectedMorningHours: number;
  items: RescheduleItem[];
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export interface SpacedRepetitionItem {
  id: number;
  userId: number;
  subjectId: number | null;
  subjectName: string | null;
  color: string;
  topicId: number | null;
  topicName: string | null;
  concept: string;
  /** 1 … 10 (escala FSRS). */
  difficulty: number;
  /** Stability em dias: tempo para R cair de 100% para 90%. */
  stability: number;
  reps: number;
  lastReviewDate: string;
  dueDate: string;
  /** Retrievability atual, 0–1. */
  retrievability: number;
  createdAt: string;
}

export interface MemoryItemInput {
  subjectId: number | null;
  topicId: number | null;
  concept: string;
  difficulty: number;
}

export interface ReviewLog {
  id: number;
  itemId: number;
  grade: ReviewGrade;
  gradeLabel: string;
  stabilityBefore: number;
  stabilityAfter: number;
  retrievability: number;
  reviewedAt: string;
}

export interface MemoryPoint {
  itemId: number;
  day: number;
  date: string;
  retrievability: number;
  anki: number;
  reviewed: boolean;
}

export interface MemoryDecayProjection {
  itemId: number;
  concept: string;
  subjectName: string | null;
  color: string;
  stability: number;
  difficulty: number;
  optimalDay: number;
  optimalDate: string;
  retrievabilityToday: number;
  dueInDays: number;
  points: MemoryPoint[];
}

export type RetentionLevel = "global" | "subject" | "topic";

export interface RetentionSeriesInfo {
  /** dataKey usado pelas <Line> do Recharts. */
  key: string;
  name: string;
  level: RetentionLevel;
  subjectId: number;
  topicId: number;
  color: string;
  items: number;
  avgStability: number;
  /** Retrievability média do grupo hoje, 0–100. */
  retrievabilityToday: number;
  dueInDays: number;
}

export interface RetentionOverview {
  generatedDate: string;
  horizonDays: number;
  series: RetentionSeriesInfo[];
  /** Cada linha: { day, date, "<matéria|nicho>": percentual }. */
  rows: Array<Record<string, number | string>>;
}
