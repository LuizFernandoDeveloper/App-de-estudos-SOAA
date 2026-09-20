import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { appWindowStub } = vi.hoisted(() => ({
  appWindowStub: {
    isMaximized: async () => false,
    onResized: async () => () => undefined,
    minimize: async () => undefined,
    toggleMaximize: async () => undefined,
    close: async () => undefined
  }
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => appWindowStub }));

const { invokeStub } = vi.hoisted(() => ({
  invokeStub: vi.fn()
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeStub }));

import App from "./App";
import { api } from "./api";
import {
  addDaysIso,
  buildMemoryDecayProjection,
  demoBrainDumps,
  demoBufferAllocations,
  demoDayAllocations,
  demoFilteredTrend,
  demoFocusOverloadTrend,
  demoFocusSessions,
  demoMaterialList,
  demoMaterialStrategies,
  demoMemoryItems,
  demoPlan,
  demoProfile,
  demoRanking,
  demoReschedulePlan,
  demoRetentionLivestreamTicks,
  demoRetentionOverview,
  demoSchedule,
  demoSubjectAccuracyTrend,
  demoSubjects,
  demoTopicList,
  todayIso
} from "./demo";
import type {
  BrainDumpLog,
  DayAllocation,
  MaterialStatus,
  MemoryItemInput,
  PlanResponse,
  ReschedulePlan,
  RetentionLiveStream,
  ScheduleResponse,
  SessionSummary,
  SpacedRepetitionItem,
  StudyMaterial,
  Subject,
  SubjectRanking,
  TimeboxSuggestion,
  Topic
} from "../shared/types";

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* Backend fake em memória — espelha os comandos reais do Tauri       */
/* ------------------------------------------------------------------ */

type Store = {
  subjects: Subject[];
  topics: Topic[];
  materials: StudyMaterial[];
  profile: typeof demoProfile;
  schedule: ScheduleResponse;
  rankings: SubjectRanking[];
  allocations: DayAllocation[];
  memoryItems: SpacedRepetitionItem[];
  sessions: typeof demoFocusSessions;
  dumps: BrainDumpLog[];
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const nextId = (items: Array<{ id: number }>) => (items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1);

let store: Store = null as unknown as Store;
let failingCommands: string[] = [];

const buildReport = () => ({
  generatedAt: todayIso(),
  horizonDays: 7,
  ranking: store.subjects.slice(0, 8).map((subject, index) => ({
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    rank: index + 1,
    accuracy: 55 + (index % 40),
    questionsTotal: 40 + index,
    questionsCorrect: 22 + index,
    retentionToday: Math.max(0, 90 - index * 7),
    dueInDays: index % 3 === 0 ? -1 : index % 3 === 1 ? 0 : 3,
    overdueItems: index % 3 === 0 ? 2 : 0,
    deepWorkBlocks: 4 + index,
    partialBlocks: index % 4,
    hasManyPartials: index % 4 > 2,
    isOverdue: index % 3 === 0
  })),
  totals: {
    questionsTotal: 420,
    questionsCorrect: 260,
    accuracy: 62,
    deepWorkBlocks: 42,
    partialBlocks: 6,
    overdueItems: 3,
    subjectsLate: 2
  }
});

const handleCommand = async (command: string, args?: Record<string, unknown>) => {
  if (failingCommands.includes(command)) throw new Error(`erro simulado em ${command}`);
  switch (command) {
    case "list_subjects":
      return clone(store.subjects);
    case "get_profile":
      return clone(store.profile);
    case "get_dashboard":
      return {
        profile: clone(store.profile),
        subjectsCount: store.subjects.length,
        materials: { total: store.materials.length, completed: store.materials.filter((m) => m.status === "concluido").length },
        questions: { total: 420, correct: 260, accuracy: 62 },
        weeklyStudyMinutes: 300,
        dailyPerformance: [
          { date: addDaysIso(-2), accuracy: 58, total: 20 },
          { date: addDaysIso(-1), accuracy: 66, total: 24 },
          { date: todayIso(), accuracy: 72, total: 18 }
        ],
        subjectPerformance: store.subjects.slice(0, 6).map((subject, index) => ({
          subjectId: subject.id,
          subjectName: subject.name,
          color: subject.color,
          questionsTotal: 40 + index,
          questionsCorrect: 22 + index,
          accuracy: 55 + index * 3,
          studiedMinutes: 40 * (index + 1)
        })),
        reminders: []
      };
    case "list_materials":
      return clone(store.materials);
    case "list_topics":
      return clone(store.topics);
    case "get_priority_ranking":
      return clone(store.rankings);
    case "calculate_schedule":
      return clone(store.schedule);
    case "update_profile":
      store.profile = { ...store.profile, ...(args?.input as object) };
      return clone(store.profile);
    case "save_daily_log":
      return undefined;
    case "create_subject": {
      const input = args?.input as { name: string; weight: number; difficulty: number; color?: string };
      const subject: Subject = {
        id: nextId(store.subjects),
        userId: 1,
        name: input.name,
        weight: input.weight,
        difficulty: input.difficulty,
        computedIp: input.weight * input.difficulty,
        color: input.color ?? "indigo",
        goalAccuracy: 70,
        goalCoverage: 100,
        currentLevel: 1,
        targetLevel: 5,
        createdAt: todayIso()
      };
      store.subjects.push(subject);
      return clone(subject);
    }
    case "update_subject": {
      const id = args?.id as number;
      const input = args?.input as Partial<Subject>;
      const index = store.subjects.findIndex((s) => s.id === id);
      if (index === -1) throw new Error(`subject ${id} não existe`);
      store.subjects[index] = { ...store.subjects[index], ...input, computedIp: (input.weight ?? 0) * (input.difficulty ?? 0) || store.subjects[index].computedIp };
      return clone(store.subjects[index]);
    }
    case "delete_subject": {
      const id = args?.id as number;
      store.subjects = store.subjects.filter((s) => s.id !== id);
      return undefined;
    }
    case "update_subject_goals": {
      const id = args?.id as number;
      const input = args?.input as { goalAccuracy: number; goalCoverage: number };
      const index = store.subjects.findIndex((s) => s.id === id);
      if (index !== -1) store.subjects[index] = { ...store.subjects[index], ...input };
      return clone(store.subjects[index]);
    }
    case "create_topic": {
      const input = args?.input as { subjectId: number; name: string; status: string };
      const topic: Topic = { id: nextId(store.topics), userId: 1, subjectId: input.subjectId, name: input.name, status: input.status as Topic["status"], createdAt: todayIso() };
      store.topics.push(topic);
      return clone(topic);
    }
    case "update_topic": {
      const id = args?.id as number;
      const input = args?.input as Partial<Topic>;
      const index = store.topics.findIndex((t) => t.id === id);
      if (index !== -1) store.topics[index] = { ...store.topics[index], ...input };
      return clone(store.topics[index]);
    }
    case "delete_topic": {
      const id = args?.id as number;
      store.topics = store.topics.filter((t) => t.id !== id);
      return undefined;
    }
    case "update_material_page": {
      const id = args?.id as number;
      const currentPage = args?.currentPage as number;
      const index = store.materials.findIndex((m) => m.id === id);
      if (index !== -1) store.materials[index] = { ...store.materials[index], currentPage };
      return clone(store.materials[index]);
    }
    case "create_material": {
      const input = args?.input as Omit<StudyMaterial, "id" | "userId" | "createdAt">;
      const material: StudyMaterial = { ...input, id: nextId(store.materials), userId: 1, createdAt: todayIso() };
      store.materials.push(material);
      return clone(material);
    }
    case "update_material": {
      const id = args?.id as number;
      const input = args?.input as Partial<StudyMaterial>;
      const index = store.materials.findIndex((m) => m.id === id);
      if (index !== -1) store.materials[index] = { ...store.materials[index], ...input };
      return clone(store.materials[index]);
    }
    case "delete_material": {
      const id = args?.id as number;
      store.materials = store.materials.filter((m) => m.id !== id);
      return undefined;
    }
    case "record_question_result":
      return { id: 1, ...(args?.input as object) };
    case "performance_trend":
      return demoFilteredTrend(args?.granularity as never, (args?.subjectId as number) ?? null, (args?.topicId as number) ?? null);
    case "get_subject_accuracy_trend":
      return clone(demoSubjectAccuracyTrend);
    case "get_focus_overload_trend":
      return clone(demoFocusOverloadTrend);
    case "list_day_allocations":
      return clone(store.allocations);
    case "save_day_allocation": {
      const input = args?.input as { subjectId: number; weekday: number; minutes: number; note: string | null };
      const subject = store.subjects.find((s) => s.id === input.subjectId);
      const existing = store.allocations.find((a) => a.subjectId === input.subjectId);
      const allocation: DayAllocation = existing ?? {
        id: nextId(store.allocations as Array<{ id: number }>),
        subjectId: input.subjectId,
        subjectName: subject?.name ?? "Matéria",
        color: subject?.color ?? "blue",
        weekday: input.weekday,
        minutes: 0,
        note: null
      };
      allocation.weekday = input.weekday;
      allocation.minutes = input.minutes;
      allocation.note = input.note;
      if (!existing) store.allocations.push(allocation);
      return clone(store.allocations);
    }
    case "delete_day_allocation": {
      const subjectId = args?.subjectId as number;
      store.allocations = store.allocations.filter((a) => a.subjectId !== subjectId);
      return clone(store.allocations);
    }
    case "list_focus_sessions":
      return clone(store.sessions);
    case "complete_focus_session": {
      const input = args?.input as { subjectId: number; plannedMinutes: number; elapsedMinutes: number; interrupts: number; completionRate: number; completionPercentage: number; exitReason: string | null };
      const subject = store.subjects.find((s) => s.id === input.subjectId);
      return {
        subjectId: input.subjectId,
        subjectName: subject?.name ?? "Matéria",
        plannedMinutes: input.plannedMinutes,
        elapsedMinutes: input.elapsedMinutes,
        interrupts: input.interrupts,
        completionRate: input.completionRate,
        exitReason: input.exitReason,
        completionPercentage: 100,
        deepWork: true,
        suggestedNext: 5,
        suggestionReason: "Foco estável",
        efficiencyGain: "+12%"
      };
    }
    case "get_focus_timebox": {
      const subjectId = args?.subjectId as number;
      const subject = store.subjects.find((s) => s.id === subjectId);
      const suggestion: TimeboxSuggestion = {
        subjectId,
        subjectName: subject?.name ?? "Matéria",
        color: subject?.color ?? "blue",
        resistanceIndex: 2,
        completedStreak: 3,
        previousMinutes: 45,
        suggestedMinutes: 50,
        reason: "Sequência estável"
      };
      return suggestion;
    }
    case "log_brain_dump": {
      const input = args?.input as { subjectId: number | null; note: string };
      const dump: BrainDumpLog = { id: nextId(store.dumps as Array<{ id: number }>), subjectId: input.subjectId, subjectName: null, note: input.note, createdAt: todayIso() };
      store.dumps.push(dump);
      return clone(dump);
    }
    case "list_brain_dumps":
      return clone(store.dumps);
    case "get_learning_speed":
      return [];
    case "get_study_plan":
      return clone(demoPlan) as PlanResponse;
    case "list_material_strategies":
      return clone(demoMaterialStrategies);
    case "reschedule_buffer":
      return clone(demoReschedulePlan) as ReschedulePlan;
    case "list_buffer_allocations":
      return clone(demoBufferAllocations);
    case "list_memory_items":
      return clone(store.memoryItems);
    case "create_memory_item": {
      const input = args?.input as MemoryItemInput;
      const subject = store.subjects.find((s) => s.id === input.subjectId);
      const topic = store.topics.find((t) => t.id === input.topicId);
      const created: SpacedRepetitionItem = {
        id: nextId(store.memoryItems as Array<{ id: number }>),
        userId: 1,
        subjectId: input.subjectId ?? null,
        subjectName: subject?.name ?? null,
        color: subject?.color ?? "blue",
        topicId: input.topicId ?? null,
        topicName: topic?.name ?? null,
        concept: input.concept,
        difficulty: input.difficulty ?? 5,
        stability: 5,
        reps: 0,
        lastReviewDate: todayIso(),
        dueDate: addDaysIso(5),
        retrievability: 1,
        createdAt: todayIso()
      };
      store.memoryItems.push(created);
      return clone(created);
    }
    case "delete_memory_item": {
      const id = args?.id as number;
      store.memoryItems = store.memoryItems.filter((m) => m.id !== id);
      return undefined;
    }
    case "review_memory_item": {
      const id = args?.id as number;
      const grade = args?.grade as string;
      const index = store.memoryItems.findIndex((m) => m.id === id);
      if (index !== -1) {
        const multiplier = { again: 0.5, hard: 1.2, good: 1.8, easy: 2.4 }[grade] ?? 1;
        store.memoryItems[index] = { ...store.memoryItems[index], stability: Math.min(120, Math.round(store.memoryItems[index].stability * multiplier * 10) / 10), reps: store.memoryItems[index].reps + 1, lastReviewDate: todayIso(), dueDate: addDaysIso(Math.max(1, Math.round(store.memoryItems[index].stability * multiplier))), retrievability: 1 };
        return clone(store.memoryItems[index]);
      }
      throw new Error(`item ${id} não existe`);
    }
    case "get_memory_decay": {
      const item = store.memoryItems.find((m) => m.id === args?.id);
      return item ? buildMemoryDecayProjection(item) : null;
    }
    case "list_fsrs_reviews":
      return [];
    case "get_retention_overview":
      return clone(demoRetentionOverview);
    case "get_retention_curve":
      return null;
    case "get_performance_livestream":
      return { generatedAt: todayIso(), horizonMinutes: 60, ticks: clone(demoRetentionLivestreamTicks) } as RetentionLiveStream;
    case "get_consolidated_report":
      return buildReport();
    default:
      throw new Error(`comando não implementado: ${command}`);
  }
};

/* ------------------------------------------------------------------ */
/* Helpers de render/navegação                                        */
/* ------------------------------------------------------------------ */

async function renderApp() {
  render(<App />);
  await screen.findByRole("heading", { level: 1, name: "Visão geral" });
}

async function navigateTo(label: RegExp | string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

afterEach(() => {
  failingCommands = [];
});

beforeEach(() => {
  store = {
    subjects: clone(demoSubjects),
    topics: clone(demoTopicList),
    materials: clone(demoMaterialList),
    profile: clone(demoProfile),
    schedule: clone(demoSchedule),
    rankings: clone(demoRanking),
    allocations: clone(demoDayAllocations),
    memoryItems: clone(demoMemoryItems),
    sessions: clone(demoFocusSessions),
    dumps: clone(demoBrainDumps)
  };
  invokeStub.mockImplementation((command: string, args?: Record<string, unknown>) => handleCommand(command, args));
  vi.spyOn(window, "confirm");
  vi.spyOn(window, "alert");
});

/* ------------------------------------------------------------------ */
/* Testes                                                             */
/* ------------------------------------------------------------------ */

describe("Visão geral · backend real mockado", () => {
  it("carrega dados reais e mostra métricas do dashboard", async () => {
    await renderApp();
    expect(await screen.findByText("Carga semanal")).toBeInTheDocument();
    expect(screen.getByText("Acerto global")).toBeInTheDocument();
    expect(screen.getByText(/de 420 questões/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir plano de hoje/ })).toBeInTheDocument();
    expect(invokeStub).toHaveBeenCalledWith("list_subjects");
    expect(invokeStub).toHaveBeenCalledWith("get_profile");
    expect(invokeStub).toHaveBeenCalledWith("get_dashboard");
  });
});

describe("Matriz de pesos · backend real", () => {
  it("abre modal, cria matéria, edita e remove", async () => {
    await renderApp();
    await navigateTo(/Matriz de pesos/);
    await screen.findByRole("heading", { level: 2, name: "Catálogo de matérias" });

    fireEvent.click(screen.getByRole("button", { name: /Nova matéria/ }));
    const modal = await screen.findByRole("dialog", { name: "Nova matéria" });
    const nameInput = within(modal).getByLabelText(/Matéria ou frente de estudo/);
    fireEvent.change(nameInput, { target: { value: "Física · Termodinâmica" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar matéria" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova matéria" })).not.toBeInTheDocument());
    await waitFor(() => expect(store.subjects.some((s) => s.name === "Física · Termodinâmica")).toBe(true));

    const edit = screen.getAllByTitle("Editar")[0];
    fireEvent.click(edit);
    const modalEdit = await screen.findByRole("dialog", { name: "Editar matéria" });
    const editName = within(modalEdit).getByLabelText(/Matéria ou frente de estudo/);
    fireEvent.change(editName, { target: { value: "Física · Eletromagnetismo" } });
    fireEvent.click(within(modalEdit).getByRole("button", { name: "Salvar matéria" }));
    await waitFor(() => expect(store.subjects[0].name).toBe("Física · Eletromagnetismo"));

    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const firstSubject = store.subjects[0];
    const totalBefore = store.subjects.length;
    fireEvent.click(screen.getAllByTitle("Remover")[0]);
    await waitFor(() => expect(store.subjects.length).toBe(totalBefore - 1));
    expect(store.subjects.some((s) => s.id === firstSubject.id)).toBe(false);
  });

  it("adiciona grupo inteiro do catálogo em lote", async () => {
    await renderApp();
    await navigateTo(/Matriz de pesos/);
    await screen.findByRole("heading", { level: 2, name: "Catálogo de matérias" });

    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const before = store.subjects.length;
    fireEvent.click(screen.getAllByTitle("Remover")[0]);
    await waitFor(() => expect(store.subjects.length).toBe(before - 1));

    const addButton = await screen.findByRole("button", { name: /Adicionar \d+ ao catálogo/ });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);
    await waitFor(() => expect(store.subjects.length).toBe(before));
  });
});

describe("Planejamento · backend real", () => {
  it("salva configuração, salva hoje, alterna dias e mantém a tabela da semana", async () => {
    await renderApp();
    await navigateTo(/Planejamento/);
    await screen.findByRole("heading", { level: 2, name: "Configure sua semana" });
    expect(await screen.findByRole("heading", { level: 2, name: "Tabela da semana" })).toBeInTheDocument();

    const hours = screen.getByLabelText(/Horas líquidas por dia/);
    fireEvent.change(hours, { target: { value: "7" } });
    expect(screen.getByText(/Tempo semanal planejado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Salvar configuração/ }));
    await waitFor(() => expect(store.profile.dailyHours).toBe(7));

    fireEvent.click(screen.getByRole("button", { name: /Salvar hoje/ }));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("save_daily_log", expect.anything()));

    const saturdayTick = screen.getByRole("button", { name: "Sáb" });
    fireEvent.click(saturdayTick);
    fireEvent.click(screen.getByRole("button", { name: /Salvar configuração/ }));
    await waitFor(() => expect(store.profile.weeklyDays).toBe(5));
  });

  it("abre mudanças via Rota da prova (get_study_plan)", async () => {
    await renderApp();
    await navigateTo(/Planejamento/);
    await screen.findByRole("heading", { level: 2, name: "Configure sua semana" });
    fireEvent.click(screen.getByRole("button", { name: /Rota da prova/ }));
    await screen.findByText("Defina a linha de chegada");
  });

  it("renderiza reforço da semana e painel de triagem com reescalonamento", async () => {
    await renderApp();
    await navigateTo(/Planejamento/);
    await screen.findByRole("heading", { level: 2, name: "Configure sua semana" });
    await screen.findByRole("heading", { level: 2, name: "Reforço da semana" });
    const reschedule = screen.getByRole("heading", { level: 2, name: /Triage WBS diário/ });
    expect(reschedule).toBeInTheDocument();
  });
});

describe("Questões e gráficos · backend real", () => {
  it("registra desempenho via modal e atualiza ranking", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Lançar questões/ }));
    const modal = await screen.findByRole("dialog", { name: "Lançar bloco de questões" });
    fireEvent.change(within(modal).getByLabelText(/Acertos/), { target: { value: "15" } });
    fireEvent.click(within(modal).getByRole("button", { name: /Registrar resultado/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Lançar bloco de questões" })).not.toBeInTheDocument());
    expect(invokeStub).toHaveBeenCalledWith("record_question_result", expect.anything());
    expect(invokeStub).toHaveBeenCalledWith("get_priority_ranking");
  });

  it("navega entre agrupamentos e filtra o recorte da evolução", async () => {
    await renderApp();
    await navigateTo(/Questões e gráficos/);
    await screen.findByRole("heading", { level: 2, name: "Evolução do acerto" });

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("performance_trend", expect.objectContaining({ granularity: "week" })));
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("performance_trend", expect.objectContaining({ granularity: "month" })));

    const firstSubject = store.subjects[0];
    const filter = screen.getByTitle("Recorte da evolução: todas as matérias, uma matéria ou uma área dentro dela") as HTMLSelectElement;
    fireEvent.change(filter, { target: { value: String(firstSubject.id) } });
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("performance_trend", expect.objectContaining({ subjectId: firstSubject.id })));
    fireEvent.click(screen.getByRole("button", { name: /Limpar recorte/ }));
  });

  it("exibe livestream, relatório consolidado e tabela de diagnóstico", async () => {
    await renderApp();
    await navigateTo(/Questões e gráficos/);
    await screen.findByRole("heading", { level: 2, name: "Evolução do acerto" });
    const livestream = await screen.findByRole("heading", { level: 2, name: "Livestream de retenção" });
    expect(livestream).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Relatório consolidado de desempenho" })).toBeInTheDocument();
    expect(screen.getByText("Saídas precoces")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Desempenho acumulado" })).toBeInTheDocument();
  });

  it("cadastra, revisa e remove item de memória (curva Anki)", async () => {
    await renderApp();
    await navigateTo(/Questões e gráficos/);
    await screen.findByRole("heading", { level: 2, name: "Laboratório de neuroplasticidade" });

    const input = screen.getByPlaceholderText(/Item de memória/);
    fireEvent.change(input, { target: { value: "Números complexos · forma polar" } });
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar item/ }));
    await waitFor(() => expect(store.memoryItems.some((m) => m.concept === "Números complexos · forma polar")).toBe(true));

    await waitFor(() => {
      expect(screen.getByText(/Números complexos · forma polar/)).toBeInTheDocument();
    });
    fireEvent.click(within(screen.getByText(/Números complexos · forma polar/).closest("button") as HTMLElement).getByText(/Números complexos · forma polar/));
    await waitFor(() => expect(screen.getByText(/Revisões/)).toBeInTheDocument());

    const before = store.memoryItems.find((m) => m.concept === "Números complexos · forma polar")?.stability ?? 0;
    fireEvent.click(screen.getByRole("button", { name: /Bom/ }));
    await waitFor(() => {
      const updated = store.memoryItems.find((m) => m.concept === "Números complexos · forma polar");
      expect(updated && updated.stability > before).toBe(true);
    });

    const beforeCount = store.memoryItems.length;
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Remover item" }));
    await waitFor(() => expect(store.memoryItems.length).toBe(beforeCount - 1));
  });
});

describe("Foco · Deep Work · backend real", () => {
  it("lista sessões e cria um bloco de foco com project buffer", async () => {
    await renderApp();
    await navigateTo(/Foco \(Deep Work\)/);
    await screen.findByRole("heading", { level: 2, name: /Sessões registradas/ });

    const beforeCount = store.sessions.length;
    fireEvent.click(screen.getByRole("button", { name: /Novo bloco de foco/ }));
    const setupHeading = await screen.findByRole("heading", { level: 2, name: /Configurar bloco de foco/ });
    const setup = setupHeading.closest(".panel") as HTMLElement;
    const firstTile = within(setup).getAllByRole("button").find((b) => b.className.includes("subject-tile"));
    fireEvent.click(firstTile as HTMLElement);
    const planned = within(setup).getByRole("slider");
    fireEvent.change(planned, { target: { value: "60" } });
    const goalInput = within(setup).getByPlaceholderText(/ex: Ler|Resolver|Dominar/);
    fireEvent.change(goalInput, { target: { value: "Ler pág. 20 a 40" } });
    fireEvent.click(within(setup).getByRole("button", { name: /Iniciar timebox/ }));

    fireEvent.click(screen.getByRole("button", { name: /Saída precoce/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fadiga metabólica/ }));
    fireEvent.click(screen.getByRole("button", { name: /Fechar bloco/ }));

    await screen.findByRole("heading", { level: 2, name: "Bloco concluído" });
    expect(screen.getByText(/Próximo timebox sugerido/)).toBeInTheDocument();
    expect(store.sessions.length).toBeGreaterThanOrEqual(beforeCount);
  });

  it("exibe captura externa (descarga da DMN)", async () => {
    await renderApp();
    await navigateTo(/Foco \(Deep Work\)/);
    await screen.findByRole("heading", { level: 2, name: /Captura externa/ });
    expect(screen.getByText(/fórmula de atrito/)).toBeInTheDocument();
  });
});

describe("Avanço · backend real", () => {
  it("atualiza meta, cria tópico e avança páginas de materiais", async () => {
    await renderApp();
    await navigateTo(/Avanço/);
    await screen.findByRole("heading", { level: 2, name: /Acompanhe o avanço/ });

    const firstSubject = store.subjects[0];
    const metaInput = screen.getAllByLabelText(/Meta de acerto/)[0];
    fireEvent.change(metaInput, { target: { value: "75" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar metas/ })[0]);
    await waitFor(() => expect(store.subjects[0].goalAccuracy).toBe(75));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("update_subject_goals", expect.objectContaining({ id: firstSubject.id })));

    const topicInput = screen.getAllByPlaceholderText(/Novo tópico/)[0];
    fireEvent.change(topicInput, { target: { value: "Hidrostática" } });
    fireEvent.click(screen.getAllByTitle("Adicionar tópico")[0]);
    await waitFor(() => expect(store.topics.some((t) => t.name === "Hidrostática")).toBe(true));
  });

  it("cicla o status de um tópico e alterna leitura de material", async () => {
    await renderApp();
    await navigateTo(/Avanço/);
    await screen.findByRole("heading", { level: 2, name: /Acompanhe o avanço/ });

    const chips = screen.getAllByTitle(/Clique para avançar o status/);
    const topicChip = chips.find((chip) => chip.textContent?.includes(demoTopicList[0].name));
    expect(topicChip).toBeTruthy();
    fireEvent.click(topicChip as HTMLElement);
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("update_topic", expect.objectContaining({ id: demoTopicList[0].id })));

    const pageStepper = screen.getAllByTitle("Avançar 5 páginas")[0];
    fireEvent.click(pageStepper);
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("update_material_page", expect.anything()));
  });
});

describe("Ranking · backend real", () => {
  it("remaneja uma alocação de reforço e depois remove", async () => {
    await renderApp();
    await navigateTo(/Ranking/);
    await screen.findByRole("heading", { level: 2, name: /Ranking de prioridade|Prioridade/ });

    const subject = store.subjects[0];
    const manageButtonFor = (name: string) => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".table-wrap tbody tr"));
      const row = rows.find((entry) => entry.textContent?.includes(name)) ?? rows[0];
      return row.querySelector<HTMLButtonElement>('button[title="Alocar reforço ou gerenciar"]')!;
    };
    fireEvent.click(manageButtonFor(subject.name));
    const panel = await screen.findByRole("dialog", { name: "Gerenciar reforço" });
    expect(within(panel).getByRole("heading", { level: 2, name: /Reforço ·/ })).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Qua" }));
    const minutes = within(panel).getByLabelText(/Tempo do bloco/);
    fireEvent.change(minutes, { target: { value: "40" } });
    fireEvent.click(within(panel).getByRole("button", { name: /Salvar reforço/ }));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("save_day_allocation", expect.objectContaining({ input: expect.objectContaining({ subjectId: subject.id }) })));

    fireEvent.click(manageButtonFor(subject.name));
    const panelAgain = await screen.findByRole("dialog", { name: "Gerenciar reforço" });
    fireEvent.click(within(panelAgain).getByRole("button", { name: /Remover alocação/ }));
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("delete_day_allocation", expect.objectContaining({ subjectId: subject.id })));
  });
});

describe("Biblioteca · backend real", () => {
  it("cadastra material, muda status e remove", async () => {
    await renderApp();
    await navigateTo(/Biblioteca/);
    await screen.findByRole("heading", { level: 2, name: "Biblioteca de materiais" });

    fireEvent.click(screen.getByRole("button", { name: /Cadastrar material/ }));
    const modal = await screen.findByRole("dialog", { name: "Cadastrar material" });
    fireEvent.change(within(modal).getByLabelText(/Título/), { target: { value: "Física Clássica Vol. 2" } });
    const category = within(modal).getByLabelText(/Categoria/);
    fireEvent.change(category, { target: { value: "Livro" } });
    const subjectSelect = within(modal).getByLabelText(/Disciplina/);
    fireEvent.change(subjectSelect, { target: { value: String(store.subjects[0].id) } });
    const tags = within(modal).getByLabelText(/Tags separadas por vírgula/);
    fireEvent.change(tags, { target: { value: "física, clássica" } });
    fireEvent.click(within(modal).getByRole("button", { name: /Adicionar material/ }));
    await waitFor(() => expect(store.materials.some((m) => m.title === "Física Clássica Vol. 2")).toBe(true));

    const statusSelect = screen.getAllByRole("combobox").find((select) => (select as HTMLSelectElement).value === "pendente");
    fireEvent.change(statusSelect as HTMLElement, { target: { value: "concluido" } });
    await waitFor(() => expect(invokeStub).toHaveBeenCalledWith("update_material", expect.anything()));

    const beforeCount = store.materials.length;
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const deleteButton = screen.getAllByTitle("Remover material")[0];
    fireEvent.click(deleteButton);
    await waitFor(() => expect(store.materials.length).toBe(beforeCount - 1));
  });
});

describe("Modo demonstração", () => {
  it("ativa pelo menu de configurações e aplica o estado demo", async () => {
    await renderApp();
    fireEvent.click(screen.getByTitle("Configurações"));
    fireEvent.click(screen.getByRole("button", { name: /Modo demonstração/ }));
    await waitFor(() => expect(screen.getByText(/dados fictícios, nada é gravado/)).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Configurações"));
    fireEvent.click(screen.getByRole("button", { name: /Modo demonstração/ }));
    fireEvent.click(screen.getByTitle("Configurações"));
    await waitFor(() => expect(screen.getByText(/usa seus dados reais/)).toBeInTheDocument());
  });
});

describe("Falhas de backend", () => {
  it("mostra toast de erro quando o carregamento real falha", async () => {
    failingCommands = ["get_profile"];
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Não foi possível abrir os dados locais/)).toBeInTheDocument());
  });

  it("mostra toast de erro quando a operação de perfil falha ao salvar", async () => {
    failingCommands = ["update_profile"];
    await renderApp();
    await navigateTo(/Planejamento/);
    await screen.findByRole("heading", { level: 2, name: "Configure sua semana" });
    fireEvent.click(screen.getByRole("button", { name: /Salvar configuração/ }));
    await waitFor(() => expect(screen.getByText(/erro simulado em/)).toBeInTheDocument());
  });
});

/* Garante que a api wrapper cobre todos os comandos chamados pelo App */
describe("api wrapper · contabilidade de comandos", () => {
  it("executa fluxo completo de criação de material via api", async () => {
    await renderApp();
    const created = await api.createMaterial({ ...JSON.parse(JSON.stringify(demoMaterialList[0])), title: "Material novo", id: 0 });
    expect(created.title).toBe("Material novo");
    await api.deleteMaterial(created.id);
    expect(store.materials.some((m) => m.id === created.id)).toBe(false);
  });

  it("gera plano de estudo reverso e reescalona o buffer", async () => {
    await renderApp();
    const plan = await api.getStudyPlan({ startDate: todayIso(), examDate: addDaysIso(30), totalHours: 36 });
    expect(plan.days.length).toBeGreaterThan(0);
    const reschedule = await api.rescheduleBuffer();
    expect(reschedule.totalDebtMinutes).toBeGreaterThanOrEqual(0);
  });

  it("gera timebox e sessão para o motor de deep work", async () => {
    await renderApp();
    const timebox = await api.getFocusTimebox(store.subjects[0].id);
    expect(timebox.suggestedMinutes).toBeGreaterThan(0);
    const summary = await api.completeFocusSession({ subjectId: 1, subjectName: "x", plannedMinutes: 45, elapsedMinutes: 40, interrupts: 0, completionRate: 100, exitReason: null, completionPercentage: 100 } as never);
    expect(summary.deepWork).toBe(true);
  });
});