import { describe, expect, it } from "vitest";
import {
  demoDashboard,
  demoDayAllocations,
  demoMemoryItems,
  demoPlan,
  demoProfile,
  demoRanking,
  demoRetentionOverview,
  demoSchedule,
  demoSubjects,
  demoTopicList,
  demoMaterialList,
  demoFocusSessions
} from "./demo";

describe("integridade do modo demo", () => {
  it("todas as matérias de demonstração têm ids únicos", () => {
    const ids = demoSubjects.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every memory item references an existing demo subject", () => {
    const ids = new Set(demoSubjects.map((s) => s.id));
    for (const item of demoMemoryItems) {
      expect(ids.has(item.subjectId as number)).toBe(true);
    }
  });

  it("materiais, tópicos e sessões referenciam matérias existentes", () => {
    const ids = new Set(demoSubjects.map((s) => s.id));
    for (const material of demoMaterialList) {
      if (material.subjectId !== null) expect(ids.has(material.subjectId)).toBe(true);
    }
    for (const topic of demoTopicList) {
      expect(ids.has(topic.subjectId)).toBe(true);
    }
    for (const session of demoFocusSessions) {
      expect(ids.has(session.subjectId)).toBe(true);
    }
  });

  it("cronograma de demonstração gera uma alocação por matéria", () => {
    expect(demoSchedule.allocations.length).toBe(demoSubjects.length);
    const totalAllocated = demoSchedule.allocations.reduce((sum, a) => sum + a.allocatedMinutes, 0);
    expect(totalAllocated + demoSchedule.projectBufferMinutes).toBe(demoSchedule.totalMinutes);
  });

  it("reforço da semana só ocorre nos dias de estudo do perfil", () => {
    const study = new Set(demoProfile.studyDays);
    for (const day of demoDayAllocations) {
      expect(study.has(day.weekday)).toBe(true);
    }
  });

  it("overview de retenção não gera série para matéria sem itens", () => {
    const subjectSeries = demoRetentionOverview.series.filter((s) => s.level === "subject");
    const subjectsWithItems = new Set(demoMemoryItems.map((i) => i.subjectId));
    expect(subjectSeries.length).toBe(subjectsWithItems.size);
    for (const s of subjectSeries) {
      expect(subjectsWithItems.has(s.subjectId)).toBe(true);
      expect(s.items).toBeGreaterThan(0);
    }
  });

  it("overview de retenção não possui valores NaN, infinitos ou fora de 0–100", () => {
    const keys = demoRetentionOverview.series.map((s) => s.key);
    for (const row of demoRetentionOverview.rows) {
      for (const key of keys) {
        const value = row[key];
        expect(typeof value).toBe("number");
        expect(Number.isNaN(value)).toBe(false);
        expect(Number.isFinite(value)).toBe(true);
        expect(value as number).toBeGreaterThanOrEqual(0);
        expect(value as number).toBeLessThanOrEqual(100);
      }
    }
  });

  it("ranking de demonstração cobre exatamente as matérias com ranks únicos", () => {
    expect(demoRanking.length).toBe(demoSubjects.length);
    const ranks = demoRanking.map((r) => r.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("cada série de retenção tem chave única e está presente em todas as linhas", () => {
    const keys = demoRetentionOverview.series.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of demoRetentionOverview.rows) {
      for (const key of keys) {
        expect(key in row).toBe(true);
      }
    }
  });

  it("modo demo usa o catálogo completo de matérias", () => {
    expect(demoSubjects.length).toBeGreaterThanOrEqual(100);
    expect(demoSchedule.allocations.length).toBe(demoSubjects.length);
    expect(demoRanking.length).toBe(demoSubjects.length);
    expect(demoDashboard.subjectsCount).toBe(demoSubjects.length);
    expect(demoDashboard.subjectPerformance.length).toBe(demoSubjects.length);
  });

  it("cronograma respeita o teto semanal do perfil (6h × 6 dias)", () => {
    expect(demoSchedule.totalMinutes).toBe(60 * 6 * 6);
    const totalAllocated = demoSchedule.allocations.reduce((sum, a) => sum + a.allocatedMinutes, 0);
    expect(totalAllocated).toBeLessThanOrEqual(demoSchedule.totalMinutes);
    const everyAtLeastFive = demoSchedule.allocations.every((a) => a.allocatedMinutes >= 5);
    expect(everyAtLeastFive).toBe(true);
  });

  it("dashboard perfomático tem métricas válidas para todas as matérias", () => {
    for (const row of demoDashboard.subjectPerformance) {
      expect(row.accuracy).toBeGreaterThanOrEqual(0);
      expect(row.accuracy).toBeLessThanOrEqual(100);
      expect(row.questionsCorrect).toBeLessThanOrEqual(row.questionsTotal);
      expect(row.studiedMinutes).toBeGreaterThan(0);
    }
  });

  it("plano reverso de demonstração referencia matérias do catálogo", () => {
    const ids = new Set(demoSubjects.map((s) => s.id));
    for (const day of demoPlan.days) {
      for (const focus of day.focusSubjects) {
        expect(ids.has(focus.subjectId)).toBe(true);
      }
    }
  });
});