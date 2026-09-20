import type {
  RetentionOverview,
  RetentionSeriesInfo,
  SpacedRepetitionItem,
  Subject
} from "../shared/types";

/* Funções puras para montar o Overview de Retenção por Matéria e Nicho.
   Espelha a lógica do backend (retention_overview):
   - série global sempre que houver itens;
   - uma série por matéria apenas quando a matéria tem ≥ 1 item;
   - cada linha contém { day, date, "<key>": R% } para as séries existentes.
   Matérias sem itens de memória NÃO geram série — evita centenas de linhas
   planas em 0% quando o usuário tem 100+ matérias na matriz. */

const pad = (value: number) => String(value).padStart(2, "0");
const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDaysIsoRetention = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return fmt(date);
};

export const retrievabilityRetention = (stability: number, elapsedDays: number) =>
  1 / (1 + elapsedDays / (9 * stability));

/** Note: backend stores subject colors as raw CSS var or slug; here we normalize to hex-ish var. */
const colorFor = (color: string) => (color.startsWith("#") || color.startsWith("var(") ? color : `var(--${color})`);

const dueInDaysFor = (list: SpacedRepetitionItem[], daysSinceLastReview: (item: SpacedRepetitionItem) => number) => {
  if (!list.length) return 0;
  return Math.min(...list.map((item) => {
    const elapsed = daysSinceLastReview(item);
    const optimal = Math.max(1, Math.round(item.stability));
    return Math.max(0, Math.ceil(optimal - elapsed));
  }));
};

export function buildRetentionOverview({
  items,
  subjects,
  horizonDays = 60
}: {
  items: SpacedRepetitionItem[];
  subjects: Subject[];
  horizonDays?: number;
}): RetentionOverview {
  const horizon = Math.max(7, Math.min(180, Math.round(horizonDays)));
  const today = addDaysIsoRetention(0);

  const daysSinceLastReview = (item: SpacedRepetitionItem) => {
    const raw = new Date(`${item.lastReviewDate}T12:00:00`).getTime();
    return Math.max(0, Math.round((Date.now() - raw) / 86400000));
  };
  const retentionOf = (item: SpacedRepetitionItem) =>
    retrievabilityRetention(item.stability, daysSinceLastReview(item)) * 100;
  const stabilityOf = (list: SpacedRepetitionItem[]) =>
    list.length ? list.reduce((sum, item) => sum + item.stability, 0) / list.length : 0;

  const series: RetentionSeriesInfo[] = [];
  if (items.length > 0) {
    series.push({
      key: "Média Geral",
      name: "Média Geral",
      level: "global",
      subjectId: 0,
      topicId: 0,
      color: "#94a3b8",
      items: items.length,
      avgStability: Number(stabilityOf(items).toFixed(1)),
      retrievabilityToday: Number(
        (items.reduce((sum, item) => sum + retentionOf(item), 0) / items.length).toFixed(1)
      ),
      dueInDays: dueInDaysFor(items, daysSinceLastReview)
    });
  }

  for (const subject of [...subjects].sort((a, b) => a.name.localeCompare(b.name))) {
    const subjectItems = items.filter((item) => item.subjectId === subject.id);
    if (subjectItems.length === 0) continue;
    series.push({
      key: subject.name,
      name: subject.name,
      level: "subject",
      subjectId: subject.id,
      topicId: 0,
      color: colorFor(subject.color),
      items: subjectItems.length,
      avgStability: Number(stabilityOf(subjectItems).toFixed(1)),
      retrievabilityToday: Number(
        (subjectItems.reduce((sum, item) => sum + retentionOf(item), 0) / subjectItems.length).toFixed(1)
      ),
      dueInDays: dueInDaysFor(subjectItems, daysSinceLastReview)
    });
  }

  const rows: Array<Record<string, number | string>> = [];
  for (let day = 0; day <= horizon; day++) {
    const row: Record<string, number | string> = { day, date: addDaysIsoRetention(day) };
    for (const entry of series) {
      let total = 0;
      let count = 0;
      for (const item of items) {
        const inSeries = entry.level === "global"
          ? true
          : entry.level === "subject"
            ? item.subjectId === entry.subjectId
            : false;
        if (!inSeries) continue;
        total += retrievabilityRetention(item.stability, day + daysSinceLastReview(item)) * 100;
        count += 1;
      }
      row[entry.key] = count > 0 ? Number((total / count).toFixed(1)) : 0;
    }
    rows.push(row);
  }

  return { generatedDate: today, horizonDays: horizon, series, rows };
}