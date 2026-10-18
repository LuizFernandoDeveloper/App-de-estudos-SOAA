import { courseGoalById, courseLabelOf, emphasizeCourse } from "./catalog";
import type { Profile, Subject } from "../shared/types";

export interface WeightSuggestion {
  subjectId: number;
  name: string;
  color: string;
  currentWeight: number;
  suggestedWeight: number;
  delta: number;
  accuracy: number | null;
  goalAccuracy: number;
  reasons: string[];
}

export interface WeightSuggestionInput {
  subjects: Subject[];
  performance: Array<{ subjectId: number; accuracy: number }>;
  profile: Profile;
}

/** Converte sinais mensuráveis — acurácia × meta, dificuldade pessoal, déficit
 * de domínio e ênfase do curso — num peso 1–5 explicável por matéria. O usuário
 * aplica um a um ou em lote; nada muda sozinho. */
export function buildWeightSuggestions({ subjects, performance, profile }: WeightSuggestionInput): WeightSuggestion[] {
  const course = courseGoalById(profile.preferredCourse);
  const suggestions = subjects.map((subject) => {
    const row = performance.find((entry) => entry.subjectId === subject.id);
    const accuracy = row?.accuracy ?? null;
    const reasons: string[] = [];
    let target = subject.weight;

    if (accuracy === null) {
      reasons.push("Sem questões lançadas — meça antes de ajustar");
    } else if (accuracy < subject.goalAccuracy - 10) {
      target += 1;
      reasons.push(`Acerto ${accuracy}% — ${subject.goalAccuracy - accuracy} p.p. abaixo da meta ${subject.goalAccuracy}%`);
    } else if (accuracy >= subject.goalAccuracy + 10) {
      target -= 1;
      reasons.push(`Acerto ${accuracy}% — ${accuracy - subject.goalAccuracy} p.p. acima da meta: dá para dosar`);
    }

    const deficit = Math.max(0, subject.targetLevel - subject.currentLevel);
    if (subject.difficulty >= 5 && deficit >= 2) {
      target += 1;
      reasons.push(`Dificuldade ${subject.difficulty}× com domínio ${subject.currentLevel}→${subject.targetLevel}`);
    } else if (deficit >= 3) {
      target += 1;
      reasons.push(`Gap de domínio de ${deficit} níveis`);
    }

    if (emphasizeCourse(course, subject)) {
      target += 1;
      reasons.push(`Ênfase do curso ${courseLabelOf(course, "preferido")}`);
    }

    const suggestedWeight = Math.min(5, Math.max(1, target));
    return {
      subjectId: subject.id,
      name: subject.name,
      color: subject.color,
      currentWeight: subject.weight,
      suggestedWeight,
      delta: suggestedWeight - subject.weight,
      accuracy,
      goalAccuracy: subject.goalAccuracy,
      reasons
    };
  });
  return suggestions.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.name.localeCompare(right.name));
}
