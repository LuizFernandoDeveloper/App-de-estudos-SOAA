import { describe, expect, it } from "vitest";
import {
  buildRetentionOverview,
  retrievabilityRetention
} from "./retentionData";
import type { SpacedRepetitionItem, Subject } from "../shared/types";

const subject = (id: number, name: string, color = "indigo"): Subject => ({
  id,
  userId: 1,
  name,
  weight: 4,
  difficulty: 5,
  computedIp: 20,
  color,
  goalAccuracy: 80,
  goalCoverage: 100,
  currentLevel: 1,
  targetLevel: 5,
  createdAt: "2026-01-01"
});

const item = (id: number, subjectId: number, stability: number, lastReviewDaysAgo: number): SpacedRepetitionItem => {
  const last = new Date();
  last.setDate(last.getDate() - lastReviewDaysAgo);
  const iso = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return {
    id,
    userId: 1,
    subjectId,
    subjectName: `Matéria ${subjectId}`,
    color: "indigo",
    topicId: null,
    topicName: null,
    concept: `Item ${id}`,
    difficulty: 5,
    stability,
    reps: 2,
    lastReviewDate: iso,
    dueDate: iso,
    retrievability: 0.9,
    createdAt: iso
  };
};

describe("retrievabilityRetention", () => {
  it("começa em 100% no dia zero e cai com o tempo", () => {
    expect(retrievabilityRetention(10, 0)).toBeCloseTo(1, 6);
    expect(retrievabilityRetention(10, 10)).toBeLessThan(1);
    expect(retrievabilityRetention(10, 90)).toBeCloseTo(0.5, 6);
  });

  it("retorna NaN apenas se estabilidade for zero (o builder nunca gera isso para séries com itens)", () => {
    expect(retrievabilityRetention(1, 5)).toBeGreaterThan(0);
  });
});

describe("buildRetentionOverview", () => {
  it("sem itens: não gera séries, mas gera linhas com dia/date", () => {
    const overview = buildRetentionOverview({ items: [], subjects: [subject(1, "Mat A"), subject(2, "Mat B")], horizonDays: 10 });
    expect(overview.series).toHaveLength(0);
    expect(overview.rows).toHaveLength(11);
    expect(overview.rows[0]).toHaveProperty("day");
    expect(overview.rows[0]).toHaveProperty("date");
  });

  it("série global aparece quando há itens", () => {
    const overview = buildRetentionOverview({ items: [item(1, 1, 10, 2), item(2, 1, 12, 5)], subjects: [subject(1, "Mat A")], horizonDays: 10 });
    expect(overview.series.map((s) => s.level)).toContain("global");
    const global = overview.series.find((s) => s.level === "global");
    expect(global?.items).toBe(2);
  });

  it("matéria sem itens NÃO gera série (corrige o bug das 100+ matérias)", () => {
    const subjects = Array.from({ length: 100 }, (_, index) => subject(index + 1, `Matéria ${index + 1}`));
    const withItems = [item(1, 1, 10, 2), item(2, 1, 12, 3), item(3, 2, 8, 1)];
    const overview = buildRetentionOverview({ items: withItems, subjects, horizonDays: 30 });
    const subjectSeries = overview.series.filter((s) => s.level === "subject");
    expect(subjectSeries).toHaveLength(2);
    expect(subjectSeries.map((s) => s.subjectId).sort()).toEqual([1, 2]);
  });

  it("linhas cobrem todas as chaves das séries com valores numéricos 0–100", () => {
    const overview = buildRetentionOverview({
      items: [item(1, 1, 10, 2), item(2, 2, 12, 5)],
      subjects: [subject(1, "Mat A"), subject(2, "Mat B"), subject(3, "Mat C sem itens")],
      horizonDays: 10
    });
    const keys = overview.series.map((s) => s.key);
    expect(keys.every((key) => overview.rows.every((row) => key in row))).toBe(true);
    for (const row of overview.rows) {
      for (const key of keys) {
        expect(typeof row[key]).toBe("number");
        expect(row[key] as number).toBeGreaterThanOrEqual(0);
        expect(row[key] as number).toBeLessThanOrEqual(100);
      }
    }
  });

  it("número de linhas = horizonte + 1 com horizonte limitado a 7–180", () => {
    expect(buildRetentionOverview({ items: [item(1, 1, 10, 0)], subjects: [subject(1, "Mat A")], horizonDays: 3 }).rows).toHaveLength(8);
    expect(buildRetentionOverview({ items: [item(1, 1, 10, 0)], subjects: [subject(1, "Mat A")], horizonDays: 500 }).rows).toHaveLength(181);
  });

  it("mesma data de revisão produz R idêntico ao gerado pelo builder", () => {
    const todayItem = item(99, 1, 10, 0);
    const overview = buildRetentionOverview({ items: [todayItem], subjects: [subject(1, "Mat A")], horizonDays: 0 });
    const global = overview.series.find((s) => s.level === "global");
    expect(global?.retrievabilityToday).toBeCloseTo(100, 0);
    expect(Math.abs((overview.rows[0][global?.key ?? "Média Geral"] as number) - global!.retrievabilityToday)).toBeLessThan(1);
  });

  it("não gera NaN quando estabilidade das séries é positiva", () => {
    const overview = buildRetentionOverview({ items: [item(1, 1, 3, 4)], subjects: [subject(1, "Mat A")], horizonDays: 60 });
    const keys = overview.series.map((s) => s.key);
    for (const row of overview.rows) {
      for (const key of keys) {
        expect(Number.isNaN(Number(row[key]))).toBe(false);
      }
    }
  });
});