import { invoke } from "@tauri-apps/api/core";
import type {
  BrainDumpLog,
  BrainDumpLogInput,
  BufferAllocation,
  DashboardData,
  DayAllocation,
  DayAllocationInput,
  FocusOverloadPoint,
  LearningSpeed,
  MaterialStrategy,
  MemoryDecayProjection,
  MemoryItemInput,
  PerformanceGranularity,
  PerformancePoint,
  PlanInput,
  PlanResponse,
  PomodoroSession,
  PomodoroSessionInput,
  Profile,
  QuestionResult,
  ReschedulePlan,
  RetentionOverview,
  ReviewGrade,
  ReviewLog,
  ScheduleResponse,
  SessionSummary,
  SpacedRepetitionItem,
  StudyMaterial,
  Subject,
  SubjectAccuracyPoint,
  SubjectGoalInput,
  SubjectRanking,
  TimeboxSuggestion,
  Topic,
  TopicInput
} from "../shared/types";

export interface SubjectInput {
  name: string;
  weight: number;
  difficulty: number;
  color?: string;
  currentLevel?: number;
  targetLevel?: number;
}

export interface ProfileInput {
  dailyHours: number;
  weeklyDays: number;
  examTrack: string;
  startDate?: string | null;
  examDate?: string | null;
}

export interface MaterialInput {
  subjectId: number | null;
  topicId: number | null;
  title: string;
  category: string;
  urlPath: string | null;
  status: "pendente" | "em_andamento" | "concluido";
  tags: string[];
  front: string | null;
  topic: string | null;
  pageFocus: string | null;
  currentPage: number;
  totalPages: number;
  remindDate: string | null;
  studyStrategy?: string | null;
}

export interface QuestionResultInput {
  subjectId: number;
  topicId: number | null;
  date: string;
  questionsTotal: number;
  questionsCorrect: number;
  studiedMinutes: number;
}

export const api = {
  listSubjects: () => invoke<Subject[]>("list_subjects"),
  createSubject: (input: SubjectInput) => invoke<Subject>("create_subject", { input }),
  updateSubject: (id: number, input: SubjectInput) => invoke<Subject>("update_subject", { id, input }),
  deleteSubject: (id: number) => invoke<void>("delete_subject", { id }),
  updateSubjectGoals: (id: number, input: SubjectGoalInput) => invoke<Subject>("update_subject_goals", { id, input }),
  listTopics: () => invoke<Topic[]>("list_topics"),
  createTopic: (input: TopicInput) => invoke<Topic>("create_topic", { input }),
  updateTopic: (id: number, input: TopicInput) => invoke<Topic>("update_topic", { id, input }),
  deleteTopic: (id: number) => invoke<void>("delete_topic", { id }),
  updateMaterialPage: (id: number, currentPage: number) =>
    invoke<StudyMaterial>("update_material_page", { id, currentPage }),
  getProfile: () => invoke<Profile>("get_profile"),
  updateProfile: (input: ProfileInput) => invoke<Profile>("update_profile", { input }),
  calculateSchedule: (totalHours: number) => invoke<ScheduleResponse>("calculate_schedule", { totalHours }),
  saveDailyLog: (totalHours: number, allocationData: ScheduleResponse) =>
    invoke<void>("save_daily_log", { totalHours, allocationData }),
  listMaterials: () => invoke<StudyMaterial[]>("list_materials"),
  createMaterial: (input: MaterialInput) => invoke<StudyMaterial>("create_material", { input }),
  updateMaterial: (id: number, input: MaterialInput) =>
    invoke<StudyMaterial>("update_material", { id, input }),
  deleteMaterial: (id: number) => invoke<void>("delete_material", { id }),
  recordQuestionResult: (input: QuestionResultInput) =>
    invoke<QuestionResult>("record_question_result", { input }),
  getPerformanceTrend: (granularity: PerformanceGranularity, subjectId: number | null = null, topicId: number | null = null) =>
    invoke<PerformancePoint[]>("performance_trend", { granularity, subjectId, topicId }),
  getSubjectAccuracyTrend: () => invoke<SubjectAccuracyPoint[]>("get_subject_accuracy_trend"),
  getFocusOverloadTrend: () => invoke<FocusOverloadPoint[]>("get_focus_overload_trend"),
  getPriorityRanking: () => invoke<SubjectRanking[]>("get_priority_ranking"),
  listDayAllocations: () => invoke<DayAllocation[]>("list_day_allocations"),
  saveDayAllocation: (input: DayAllocationInput) =>
    invoke<DayAllocation[]>("save_day_allocation", { input }),
  deleteDayAllocation: (subjectId: number) =>
    invoke<DayAllocation[]>("delete_day_allocation", { subjectId }),
  listPomodoroSessions: () => invoke<PomodoroSession[]>("list_pomodoro_sessions"),
  completePomodoroSession: (input: PomodoroSessionInput) =>
    invoke<SessionSummary>("complete_pomodoro_session", { input }),
  getFocusTimebox: (subjectId: number) =>
    invoke<TimeboxSuggestion>("get_focus_timebox", { subjectId }),
  logBrainDump: (input: BrainDumpLogInput) => invoke<BrainDumpLog>("log_brain_dump", { input }),
  listBrainDumps: () => invoke<BrainDumpLog[]>("list_brain_dumps"),
  getLearningSpeed: (subjectId?: number) =>
    invoke<LearningSpeed[]>("get_learning_speed", { subjectId: subjectId ?? null }),
  getStudyPlan: (input: PlanInput) => invoke<PlanResponse>("get_study_plan", { input }),
  listMaterialStrategies: () => invoke<MaterialStrategy[]>("list_material_strategies"),
  rescheduleBuffer: () => invoke<ReschedulePlan>("reschedule_buffer"),
  listBufferAllocations: () => invoke<BufferAllocation[]>("list_buffer_allocations"),
  listMemoryItems: () => invoke<SpacedRepetitionItem[]>("list_memory_items"),
  createMemoryItem: (input: MemoryItemInput) =>
    invoke<SpacedRepetitionItem>("create_memory_item", { input }),
  deleteMemoryItem: (id: number) => invoke<void>("delete_memory_item", { id }),
  reviewMemoryItem: (id: number, grade: ReviewGrade) =>
    invoke<SpacedRepetitionItem>("review_memory_item", { id, grade }),
  getMemoryDecay: (itemId: number) => invoke<MemoryDecayProjection>("get_memory_decay", { id: itemId }),
  listReviewLogs: (itemId: number) => invoke<ReviewLog[]>("list_review_logs", { itemId }),
  getRetentionOverview: (horizonDays?: number) =>
    invoke<RetentionOverview>("get_retention_overview", { horizonDays: horizonDays ?? null }),
  getDashboard: () => invoke<DashboardData>("get_dashboard")
};
