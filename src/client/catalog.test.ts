import { describe, expect, it } from "vitest";
import {
  CATALOG_GROUPS,
  CATALOG_GROUP_LABELS,
  EXAM_TRACK_GROUPS,
  EXAM_TRACKS,
  catalogSubjects,
  catalogSubjectsForTrack,
  catalogToSubjects
} from "./catalog";

describe("catalogSubjects", () => {
  it("contém pelo menos 100 matérias", () => {
    expect(catalogSubjects.length).toBeGreaterThanOrEqual(100);
  });

  it("cobre exatamente os grupos esperados com rótulo para cada um", () => {
    expect(CATALOG_GROUPS).toHaveLength(5);
    for (const group of CATALOG_GROUPS) {
      expect(CATALOG_GROUP_LABELS[group]).toBeTruthy();
    }
    const present = new Set(catalogSubjects.map((item) => item.group));
    expect([...present].sort()).toEqual([...CATALOG_GROUPS].sort());
  });

  it("não repete nomes de matérias", () => {
    const names = catalogSubjects.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("peso e dificuldade dentro da escala", () => {
    for (const item of catalogSubjects) {
      expect(item.weight).toBeGreaterThanOrEqual(1);
      expect(item.weight).toBeLessThanOrEqual(5);
      expect(item.difficulty).toBeGreaterThanOrEqual(1);
      expect(item.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it("todo grupo tem ao menos 10 matérias", () => {
    for (const group of CATALOG_GROUPS) {
      expect(catalogSubjects.filter((item) => item.group === group).length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("catalogToSubjects", () => {
  it("gera ids sequenciais a partir do startId com computedIp = peso × dificuldade", () => {
    const subjects = catalogToSubjects(1);
    expect(subjects.length).toBe(catalogSubjects.length);
    subjects.forEach((subject, index) => {
      expect(subject.id).toBe(1 + index);
      expect(subject.computedIp).toBe(subject.weight * subject.difficulty);
      expect(subject.userId).toBe(1);
    });
  });

  it("gera cores que respeitam a paleta definida", () => {
    const subjects = catalogToSubjects(1);
    const palette = ["indigo", "violet", "cyan", "pink", "amber", "emerald", "orange", "blue"];
    subjects.forEach((subject, index) => {
      expect(palette).toContain(subject.color);
      expect(subject.color).toBe(palette[index % palette.length]);
    });
  });

  it("objetivo de acerto dentro do intervalo 70–90", () => {
    const subjects = catalogToSubjects(1);
    for (const subject of subjects) {
      expect(subject.goalAccuracy).toBeGreaterThanOrEqual(70);
      expect(subject.goalAccuracy).toBeLessThanOrEqual(90);
    }
  });

  it("respeita startId diferente", () => {
    const subjects = catalogToSubjects(1000);
    expect(subjects[0].id).toBe(1000);
    expect(subjects[subjects.length - 1].id).toBe(999 + catalogSubjects.length);
  });
});

describe("catalogSubjectsForTrack", () => {
  it("cada trilha de prova mapeia para grupos válidos do catálogo", () => {
    for (const track of EXAM_TRACKS) {
      const groups = EXAM_TRACK_GROUPS[track];
      expect(groups.length).toBeGreaterThan(0);
      for (const group of groups) {
        expect(CATALOG_GROUPS).toContain(group);
      }
    }
  });

  it("retorna as matérias da trilha (ITA/IME → exatas) com peso e dificuldade preservados", () => {
    const ita = catalogSubjectsForTrack("ITA");
    expect(ita.length).toBeGreaterThan(0);
    expect(ita.every((item) => item.group === "ita-ime")).toBe(true);
    expect(ita.every((item) => item.weight >= 1 && item.weight <= 5)).toBe(true);
    expect(ita.every((item) => item.difficulty >= 1 && item.difficulty <= 5)).toBe(true);
  });

  it("ENEM e Ensino Médio incluem também Linguagens e Redação", () => {
    const enem = catalogSubjectsForTrack("ENEM");
    expect(enem.some((item) => item.group === "linguagens")).toBe(true);
    const medio = catalogSubjectsForTrack("Ensino Médio");
    expect(medio.length).toBe(enem.length);
  });
});