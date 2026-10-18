import { courseGoalById, courseLabelOf, emphasizeCourse, type CourseGoal } from "./catalog";
import type {
  FocusOverloadPoint,
  Profile,
  SpacedRepetitionItem,
  StudyMaterial,
  Subject,
  SubjectPerformance,
  SubjectRanking,
  Topic
} from "../shared/types";

/* Motor de sinergia: cruza os sinais de todos os módulos (ranking, FSRS,
   questões, edital, foco, materiais e meta do curso) e devolve, por matéria,
   um índice único e a lista de ataques de hoje — cada ataque nasce do
   consenso entre motores e já aponta para a aba que o executa. */

export type SynergyEngine = "ranking" | "memoria" | "questoes" | "cobertura" | "foco" | "curso" | "rota";
export type SynergyTone = "danger" | "warn" | "ok";
export type SynergyTarget = "desempenho" | "questoes" | "foco" | "avanco" | "planejamento";
export type SynergyKind = "revisar" | "questoes" | "foco" | "topico" | "leitura" | "simulado" | "criar-itens";

export interface SynergySignal {
  engine: SynergyEngine;
  label: string;
  tone: SynergyTone;
}

export interface SynergyRow {
  subjectId: number;
  fullName: string;
  name: string;
  color: string;
  /** 0–100: soma dos deficits de cada motor (quanto maior, mais urgente). */
  score: number;
  accuracy: number | null;
  accuracyGoal: number;
  /** 0–100, `null` quando a matéria não tem tópicos de edital cadastrados. */
  coverage: number | null;
  coverageGoal: number;
  overdueItems: number;
  /** Menor retrievability FSRS da matéria (0–1). */
  minRetrievability: number | null;
  /** Sustentação média dos blocos de foco (0–100). */
  focusRate: number | null;
  priorityScore: number;
  courseEmphasis: boolean;
  signals: SynergySignal[];
}

export interface SynergyAttack {
  id: string;
  kind: SynergyKind;
  subjectId: number | null;
  subjectName: string | null;
  color: string;
  title: string;
  detail: string;
  minutes: number | null;
  /** Pontos do índice de sinergia que este ataque recupera quando executado. */
  boost: number;
  score: number;
  signals: SynergySignal[];
  target: SynergyTarget;
}

export interface SynergyBrief {
  today: string;
  course: CourseGoal | null;
  phase: {
    mode: "construcao" | "reta_final" | null;
    weeksLeft: number | null;
    totalWeeks: number | null;
    retaWeeks: number | null;
  };
  pace: { registeredMinutes: number; plannedMinutes: number; ratio: number };
  attacks: SynergyAttack[];
  rows: SynergyRow[];
  /** Motores com pelo menos um sinal ativo no cruzamento. */
  engines: SynergyEngine[];
}

export interface SynergyInput {
  today: string;
  profile: Profile;
  subjects: Subject[];
  ranking: SubjectRanking[];
  performance: SubjectPerformance[];
  topics: Topic[];
  materials: StudyMaterial[];
  memoryItems: SpacedRepetitionItem[];
  focusPoints: FocusOverloadPoint[];
  weeklyStudyMinutes: number;
}

const shortName = (name: string) => name.split("·")[0].trim();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/* Tons e rótulos de zona: exportados porque a faixa mais baixa (< 5) não é
   alcançada pelo call-site (que só entra em cena a partir de 5) e é justamente
   o contrato que o resto do painel assume — "verde · ok". */
export const zoneTone = (priorityScore: number): SynergyTone => (priorityScore >= 7 ? "danger" : priorityScore >= 5 ? "warn" : "ok");
export const zoneLabel = (priorityScore: number) => (priorityScore >= 7 ? "vermelha" : priorityScore >= 5 ? "amarela" : "verde");
const weeksBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / (7 * 86400000));

export function buildSynergyBrief(input: SynergyInput): SynergyBrief {
  const { today, profile, subjects, ranking, performance, topics, materials, memoryItems, focusPoints } = input;
  const course = courseGoalById(profile.preferredCourse);

  const totalWeeks = profile.startDate && profile.examDate && profile.examDate > profile.startDate ? Math.max(1, weeksBetween(profile.startDate, profile.examDate)) : null;
  const weeksLeft = profile.examDate ? Math.max(0, weeksBetween(today, profile.examDate)) : null;
  const retaWeeks = totalWeeks !== null ? Math.max(2, Math.floor(totalWeeks / 4)) : null;
  const mode = retaWeeks !== null && weeksLeft !== null ? (weeksLeft <= retaWeeks ? "reta_final" : "construcao") : null;

  const plannedMinutes = Math.round(profile.dailyHours * profile.weeklyDays * 60);
  const ratio = plannedMinutes > 0 ? Math.round((input.weeklyStudyMinutes / plannedMinutes) * 100) : 0;

  const rankingById = new Map(ranking.map((row) => [row.id, row]));
  const accuracyById = new Map(performance.map((row) => [row.subjectId, row.accuracy]));

  const rows: SynergyRow[] = [];
  const attacks: SynergyAttack[] = [];

  for (const subject of subjects) {
    const rankRow = rankingById.get(subject.id);
    const priorityScore = rankRow?.priorityScore ?? 0;
    const accuracy = accuracyById.has(subject.id) ? accuracyById.get(subject.id)! : null;

    const subjectTopics = topics.filter((topic) => topic.subjectId === subject.id);
    const doneTopics = subjectTopics.filter((topic) => topic.status === "concluido").length;
    const coverage = subjectTopics.length ? doneTopics / subjectTopics.length * 100 : null;

    const subjectItems = memoryItems.filter((item) => item.subjectId === subject.id);
    const overdueItems = subjectItems.filter((item) => item.dueDate <= today);
    const minRetrievability = subjectItems.length ? Math.min(...subjectItems.map((item) => item.retrievability)) : null;

    const subjectFocus = focusPoints.filter((point) => point.subjectId === subject.id);
    const focusRate = subjectFocus.length ? Math.round(subjectFocus.reduce((sum, point) => sum + point.completionRate, 0) / subjectFocus.length) : null;

    const courseEmphasis = emphasizeCourse(course, subject);
    /* `find` repete o predicado de `emphasizeParents`, que já retornou true em
       `courseEmphasis`: por isso não há `?? null` — o valor ausente é o mesmo
       `undefined` do `find`, sem ramo morto para cobertura. */
    const courseParent = courseEmphasis && course ? course.emphasis.parents.find((parent) => subject.name === parent || subject.name.startsWith(`${parent} · `)) : undefined;

    const rankingChunk = clamp(priorityScore / 9 * 30, 0, 30);
    const memoryChunk = Math.min(25, overdueItems.length * 12 + (minRetrievability !== null && minRetrievability < 0.9 ? 8 : 0));
    const accuracyDeficit = accuracy !== null ? Math.max(0, subject.goalAccuracy - accuracy) : 0;
    const accuracyChunk = accuracy !== null && accuracyDeficit > 0 ? Math.min(20, accuracyDeficit / Math.max(1, subject.goalAccuracy) * 20) : 0;
    const coverageDeficit = coverage !== null ? Math.max(0, subject.goalCoverage - coverage) : 0;
    const coverageChunk = coverageDeficit > 0 ? Math.min(10, coverageDeficit / 100 * 10) : 0;
    const focusChunk = focusRate !== null && focusRate < 80 ? Math.min(10, (80 - focusRate) / 80 * 10) : 0;
    const courseChunk = courseEmphasis ? 5 : 0;
    const score = Math.round(rankingChunk + memoryChunk + accuracyChunk + coverageChunk + focusChunk + courseChunk);

    const signals: SynergySignal[] = [];
    /* Sufixo de retenção calculado para toda matéria, e não só para as com item
       vencido: "matéria sem item FSRS" é o caso comum, e é ele que dá sentido ao
       sufixo vazio (antes o ramo ficava inalcançável dentro do `if` abaixo). */
    const retentionSuffix = minRetrievability === null ? "" : ` · R ${Math.round(minRetrievability * 100)}%`;
    if (priorityScore >= 5) signals.push({ engine: "ranking", label: `Ranking ${priorityScore} pts · zona ${zoneLabel(priorityScore)}`, tone: zoneTone(priorityScore) });
    if (overdueItems.length) signals.push({ engine: "memoria", label: `FSRS ${overdueItems.length} vencida${overdueItems.length > 1 ? "s" : ""}${retentionSuffix}`, tone: minRetrievability !== null && minRetrievability < 0.85 ? "danger" : "warn" });
    if (accuracy !== null && accuracyDeficit > 0) signals.push({ engine: "questoes", label: `Acerto ${accuracy}% < meta ${subject.goalAccuracy}%`, tone: accuracyDeficit >= 15 ? "danger" : "warn" });
    if (coverageDeficit > 0) signals.push({ engine: "cobertura", label: `Edital ${Math.round(coverage!)}% < meta ${subject.goalCoverage}%`, tone: "warn" });
    if (focusRate !== null && focusRate < 70) signals.push({ engine: "foco", label: `Foco sustentado ${focusRate}%`, tone: focusRate < 50 ? "danger" : "warn" });
    if (courseParent) signals.push({ engine: "curso", label: `Meta: ${courseParent}`, tone: "ok" });

    rows.push({
      subjectId: subject.id,
      fullName: subject.name,
      name: shortName(subject.name),
      color: subject.color,
      score,
      accuracy,
      accuracyGoal: subject.goalAccuracy,
      coverage,
      coverageGoal: subject.goalCoverage,
      overdueItems: overdueItems.length,
      minRetrievability,
      focusRate,
      priorityScore,
      courseEmphasis,
      signals
    });

    const candidates: SynergyAttack[] = [];
    if (overdueItems.length) {
      const minutes = clamp(overdueItems.length * 4, 10, 45);
      candidates.push({
        id: `revisar-${subject.id}`,
        kind: "revisar",
        subjectId: subject.id,
        subjectName: shortName(subject.name),
        color: subject.color,
        title: `Revisar ${overdueItems.length} ${overdueItems.length === 1 ? "item" : "itens"} FSRS · ${shortName(subject.name)}`,
        detail: minRetrievability !== null && minRetrievability < 0.9
          ? `Retenção mínima em ${Math.round(minRetrievability * 100)}% — o ponto ótimo já passou; revisar agora rearma a estabilidade.`
          : "Itens vencidos na fila: interrompa o esquecimento com revisão ativa de ~4 min por item.",
        minutes,
        boost: Math.round(memoryChunk),
        score: 45 + Math.min(overdueItems.length, 4) * 5 + (minRetrievability !== null && minRetrievability < 0.85 ? 8 : 0),
        signals: signals.filter((signal) => signal.engine === "memoria" || signal.engine === "ranking" || signal.engine === "curso"),
        target: "desempenho"
      });
    }
    if (accuracy !== null && accuracyDeficit > 0 && (priorityScore >= 5 || courseEmphasis)) {
      candidates.push({
        id: `questoes-${subject.id}`,
        kind: "questoes",
        subjectId: subject.id,
        subjectName: shortName(subject.name),
        color: subject.color,
        title: `Bloco de questões · ${shortName(subject.name)}`,
        detail: `Acerto ${accuracy}% contra a meta ${subject.goalAccuracy}%${priorityScore >= 7 ? " e ranking na zona vermelha" : ""}${courseEmphasis ? ` — matéria da meta ${courseLabelOf(course, "do curso")}` : ""}. Lance o bloco e deixe o ranking recalibrar a prioridade.`,
        minutes: 50,
        boost: Math.round(accuracyChunk),
        score: 30 + Math.min(20, accuracyDeficit * 0.6) + (priorityScore >= 7 ? 8 : 0) + (courseEmphasis ? 6 : 0),
        signals: signals.filter((signal) => signal.engine === "questoes" || signal.engine === "ranking" || signal.engine === "curso"),
        target: "questoes"
      });
    }
    if (focusRate !== null && focusRate < 60) {
      const minutes = Math.max(25, Math.round((focusRate / 100 * 50) / 5) * 5);
      candidates.push({
        id: `foco-${subject.id}`,
        kind: "foco",
        subjectId: subject.id,
        subjectName: shortName(subject.name),
        color: subject.color,
        title: `Bloco de foco enxuto · ${shortName(subject.name)}`,
        detail: `Sustentação média de ${focusRate}% nos blocos — reduza o teto para ${minutes} min e termine inteiro: sair cedo fragmenta o deep work e adia o tópico.`,
        minutes,
        boost: Math.round(focusChunk),
        score: 25 + (60 - focusRate) / 2,
        signals: signals.filter((signal) => signal.engine === "foco" || signal.engine === "ranking"),
        target: "foco"
      });
    }
    const nextTopic = subjectTopics.find((topic) => topic.status === "em_andamento") ?? subjectTopics.find((topic) => topic.status === "pendente");
    if (coverageDeficit > 0 && nextTopic) {
      candidates.push({
        id: `topico-${subject.id}`,
        kind: "topico",
        subjectId: subject.id,
        subjectName: shortName(subject.name),
        color: subject.color,
        title: `Avançar edital · ${nextTopic.name}`,
        detail: `${doneTopics}/${subjectTopics.length} tópicos concluídos (${Math.round(coverage!)}%) contra a meta ${subject.goalCoverage}% — retome pelo próximo aberto.`,
        minutes: 40,
        boost: Math.round(coverageChunk),
        score: 20 + coverageDeficit / 2 + (priorityScore >= 7 ? 5 : 0),
        signals: signals.filter((signal) => signal.engine === "cobertura" || signal.engine === "ranking" || signal.engine === "curso"),
        target: "avanco"
      });
    }
    const material = materials
      .filter((entry) => entry.subjectId === subject.id && entry.totalPages > 0 && entry.currentPage < entry.totalPages && entry.status !== "concluido")
      .sort((a, b) => (b.totalPages - b.currentPage) - (a.totalPages - a.currentPage))[0];
    if (material && (priorityScore >= 5 || courseEmphasis)) {
      const pageTo = Math.min(material.totalPages, material.currentPage + 12);
      candidates.push({
        id: `leitura-${subject.id}`,
        kind: "leitura",
        subjectId: subject.id,
        subjectName: shortName(subject.name),
        color: subject.color,
        title: `Retomar leitura · ${material.title}`,
        detail: `Página ${material.currentPage} → ${pageTo} de ${material.totalPages} (${material.totalPages - material.currentPage} restantes) numa frente de prioridade alta.`,
        minutes: 40,
        boost: 5,
        score: 18 + (material.totalPages - material.currentPage) / 40,
        signals: signals.filter((signal) => signal.engine === "ranking" || signal.engine === "curso"),
        target: "avanco"
      });
    }
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    if (best) attacks.push(best);
  }

  if (mode === "reta_final" && weeksLeft !== null) {
    attacks.push({
      id: "simulado-reta-final",
      kind: "simulado",
      subjectId: null,
      subjectName: null,
      color: "violet",
      title: "Simulado cronometrado da reta final",
      detail: `Faltam ${weeksLeft} semana${weeksLeft === 1 ? "" : "s"} — troque a rotina para prova cronometrada com provas anteriores e classifique cada erro (não sabia × errei × chutei).`,
      minutes: 120,
      boost: 5,
      score: 38,
      signals: [{ engine: "rota", label: `Reta final · ${weeksLeft} semana${weeksLeft === 1 ? "" : "s"} até a prova`, tone: weeksLeft <= 2 ? "danger" : "warn" }],
      target: "planejamento"
    });
  }
  if (!memoryItems.length && subjects.length) {
    attacks.push({
      id: "criar-itens-memoria",
      kind: "criar-itens",
      subjectId: null,
      subjectName: null,
      color: "cyan",
      title: "Blindar a memória dos erros",
      detail: "O motor FSRS está sem itens: cadastre os conceitos que você mais erra para proteger a retenção a 90% — a revisão espaçada segura o que o bloco de questões constrói.",
      minutes: 20,
      boost: 10,
      score: 22,
      signals: [{ engine: "memoria", label: "FSRS sem itens cadastrados", tone: "warn" }],
      target: "desempenho"
    });
  }

  const sortedRows = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const engines = [...new Set(sortedRows.flatMap((row) => row.signals.map((signal) => signal.engine)))];
  return {
    today,
    course,
    phase: { mode, weeksLeft, totalWeeks, retaWeeks },
    pace: { registeredMinutes: input.weeklyStudyMinutes, plannedMinutes, ratio },
    attacks: attacks.sort((a, b) => b.score - a.score).slice(0, 5),
    rows: sortedRows,
    engines
  };
}
