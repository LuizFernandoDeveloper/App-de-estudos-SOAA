import { describe, expect, it } from "vitest";
import {
  CATALOG_GROUPS,
  CATALOG_GROUP_LABELS,
  EXAM_TRACK_GROUPS,
  EXAM_TRACKS,
  FOCUS_AREAS,
  areaWeight,
  booksForName,
  catalogSubjects,
  catalogSubjectsForTrack,
  catalogToSubjects,
  emphasize,
  parentArea,
  sequenceByParent
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

describe("foco por área e livros", () => {
  it("define 5 áreas de ingresso com rótulo, dica e ênfase", () => {
    expect(FOCUS_AREAS).toHaveLength(5);
    for (const area of FOCUS_AREAS) {
      expect(area.id).toBeTruthy();
      expect(area.label).toBeTruthy();
      expect(area.hint).toBeTruthy();
      expect(area.parents.length).toBeGreaterThan(0);
      expect(area.multiplier).toBeGreaterThan(1);
    }
    const ids = FOCUS_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(5);
  });

  it("parentArea separa a matéria-mãe da sub-área", () => {
    expect(parentArea("Matemática · Álgebra")).toBe("Matemática");
    expect(parentArea("Redação ENEM")).toBe("Redação ENEM");
  });

  it("emphasize realça apenas as matérias da área escolhida", () => {
    const exatas = FOCUS_AREAS.find((area) => area.id === "exatas")!;
    expect(emphasize(null, catalogSubjects[0])).toBe(false);
    const matematica = catalogSubjects.find((item) => parentArea(item.name) === "Matemática")!;
    expect(emphasize(exatas, matematica)).toBe(true);
    const redacao = catalogSubjects.find((item) => parentArea(item.name) === "Redação")!;
    expect(emphasize(exatas, redacao)).toBe(false);
  });

  it("areaWeight eleva o peso padrão das matérias da área e mantém as demais", () => {
    const exatas = FOCUS_AREAS.find((area) => area.id === "exatas")!;
    const matematica = catalogSubjects.find((item) => parentArea(item.name) === "Matemática")!;
    expect(areaWeight(null, matematica)).toBe(matematica.weight);
    const boosted = areaWeight(exatas, matematica);
    expect(boosted).toBeGreaterThanOrEqual(matematica.weight);
    expect(boosted).toBeGreaterThanOrEqual(1);
    expect(boosted).toBeLessThanOrEqual(5);
    const redacao = catalogSubjects.find((item) => parentArea(item.name) === "Redação")!;
    expect(areaWeight(exatas, redacao)).toBe(redacao.weight);
  });

  it("livros recomendados para as sub-áreas principais", () => {
    const fme = booksForName("Matemática · Álgebra Fundamental");
    expect(fme).toBeDefined();
    expect(fme!.length).toBeGreaterThan(0);
    expect(booksForName("Física · Eletromagnetismo")).toBeDefined();
    expect(booksForName("Química · Estequiometria")).toBeDefined();
    expect(booksForName("Redação · Dissertação-Argumentativa")).toBeDefined();
  });
});

describe("sequenceByParent", () => {
  it("mantém as sub-áreas da mesma matéria em bloco, pais por maior pico", () => {
    const input = [
      { name: "Biologia Ensino Médio", score: 10 },
      { name: "Física · Mecânica", score: 90 },
      { name: "Matemática · Álgebra", score: 80 },
      { name: "Matemática · Geometria", score: 70 }
    ];
    const ordered = sequenceByParent(input, (item) => item.score);
    const names = ordered.map((item) => item.name);
    expect(names.indexOf("Matemática · Álgebra") + 1).toBe(names.indexOf("Matemática · Geometria"));
    expect(names.indexOf("Física · Mecânica")).toBe(0);
    expect(names.indexOf("Biologia Ensino Médio")).toBe(names.length - 1);
  });

  it("preserva a ordem do catálogo dentro de uma matéria sem ' · '", () => {
    const input = [{ name: "História · Moderna" }, { name: "História · Contemporânea" }];
    const ordered = sequenceByParent(input);
    expect(ordered.map((item) => item.name)).toEqual(["História · Moderna", "História · Contemporânea"]);
  });
});