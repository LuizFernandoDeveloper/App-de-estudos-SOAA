import type { ExamTrack, Subject } from "../shared/types";

export type CatalogGroup = "ita-ime" | "enem" | "linguagens" | "faculdade" | "tecnico";

export interface CatalogSubject {
  name: string;
  group: CatalogGroup;
  weight: number;
  difficulty: number;
  books?: string[];
}

export const CATALOG_COLORS = ["indigo", "violet", "cyan", "pink", "amber", "emerald", "orange", "blue"];
const COLORS = CATALOG_COLORS;

/** Matérias por trilha de prova (vestibular escolhido). */
export const EXAM_TRACK_GROUPS: Record<ExamTrack, CatalogGroup[]> = {
  "Ensino Médio": ["enem", "linguagens"],
  "ENEM": ["enem", "linguagens"],
  "ITA": ["ita-ime"],
  "IME": ["ita-ime"],
  "Personalizado": ["ita-ime", "enem", "linguagens", "faculdade", "tecnico"]
};

export const EXAM_TRACKS: ExamTrack[] = ["Ensino Médio", "ENEM", "ITA", "IME", "Personalizado"];

export function catalogSubjectsForTrack(track: ExamTrack): CatalogSubject[] {
  const groups = new Set(EXAM_TRACK_GROUPS[track] ?? EXAM_TRACK_GROUPS["Personalizado"]);
  return catalogSubjects.filter((item) => groups.has(item.group));
}

export const CATALOG_GROUPS: CatalogGroup[] = ["ita-ime", "enem", "linguagens", "faculdade", "tecnico"];

export const CATALOG_GROUP_LABELS: Record<CatalogGroup, string> = {
  "ita-ime": "Provões exatas · ITA / IME",
  enem: "ENEM · Ciências e Humanas",
  linguagens: "Linguagens e Redação",
  faculdade: "Faculdade / Graduação",
  tecnico: "Curso técnico"
};

export const CATALOG_GROUP_HINTS: Record<CatalogGroup, string> = {
  "ita-ime": "Matemática, Física e Química no nível de vestibulares militares (ITA, IME e congêneres).",
  enem: "Matemática, Ciências da Natureza, Humanas e suas tecnologias na linha do ENEM.",
  linguagens: "Português, gramática, literatura, redação e idiomas.",
  faculdade: "Disciplinas comuns de graduação: cálculo, álgebra, programação, física e química universitárias.",
  tecnico: "Disciplinas de cursos técnicos: elétrica, desenho, automação, mecânica e gestão."
};

export type FocusAreaId = "exatas" | "biologicas" | "humanas" | "ti" | "linguagens";

export interface FocusArea {
  id: FocusAreaId;
  label: string;
  hint: string;
  multiplier: number;
  parents: string[];
}

/** Área que você quer entrar: cada botão de ênfase eleva o peso padrão dos grupos que sustentam aquela carreira. */
export const FOCUS_AREAS: FocusArea[] = [
  {
    id: "exatas",
    label: "Exatas · Engenharias",
    hint: "Engenharia, ITA/IME e militares: Matemática, Física e Química com foco maior.",
    multiplier: 1.3,
    parents: ["Matemática", "Matemática ENEM", "Física", "Física ENEM", "Química", "Química ENEM", "Faculdade"]
  },
  {
    id: "biologicas",
    label: "Biológicas · Saúde",
    hint: "Medicina e áreas da saúde: Biologia e Química em primeiro plano.",
    multiplier: 1.3,
    parents: ["Biologia", "Química", "Química ENEM", "Matemática ENEM"]
  },
  {
    id: "humanas",
    label: "Humanas · Direito e Sociais",
    hint: "Direito e Ciências Sociais: leitura, atualidades e redação com peso maior.",
    multiplier: 1.3,
    parents: ["História", "Geografia", "Humanas", "Português", "Redação", "Literatura", "Inglês", "Espanhol"]
  },
  {
    id: "ti",
    label: "TI · Computação",
    hint: "Computação: Matemática, algoritmos, programação e banco de dados em primeiro plano.",
    multiplier: 1.25,
    parents: ["Matemática", "Matemática ENEM", "Faculdade", "Técnico"]
  },
  {
    id: "linguagens",
    label: "Linguagens · Comunicação",
    hint: "Redação, idiomas, literatura e interpretação recebem o reforço principal.",
    multiplier: 1.25,
    parents: ["Português", "Redação", "Literatura", "Inglês", "Espanhol", "Arte", "Educação Física"]
  }
];

export const FOCUS_AREA_LABELS: Record<FocusAreaId, string> = Object.fromEntries(
  FOCUS_AREAS.map((area) => [area.id, area.label])
) as Record<FocusAreaId, string>;

/** Matéria-mãe de um item do catálogo ("Física · Cinemática" → "Física"). */
export const parentArea = (name: string) => {
  const marker = name.indexOf(" · ");
  return marker === -1 ? name : name.slice(0, marker);
};

export const emphasize = (area: FocusArea | null, entry: Pick<CatalogSubject, "name">): boolean =>
  area !== null && area.parents.some((parent) => {
    if (entry.name === parent) return true;
    const marker = `${parent} · `;
    return entry.name.startsWith(marker);
  });

/** Peso com a ênfase da área aplicada (arredondado e limitado a 1..5). */
export const areaWeight = (area: FocusArea | null, entry: CatalogSubject): number => {
  if (!area || !emphasize(area, entry)) return entry.weight;
  const boosted = Math.round(entry.weight * area.multiplier);
  return Math.max(1, Math.min(5, boosted));
};

export const booksForName = (name: string): string[] | undefined =>
  catalogSubjects.find((entry) => entry.name === name)?.books;

/**
 * Reordena itens de forma que as sub-áreas de uma mesma matéria-mãe venham
 * uma após a outra (ex.: Cinemática → Dinâmica → Energia → …), mantendo as
 * matérias de maior escore (risco/computedIp) no bloco inicial da rota.
 */
export function sequenceByParent<T extends { name: string }>(items: T[], score?: (item: T) => number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = parentArea(item.name);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([name, bucket]) => ({ name, bucket, peak: Math.max(0, ...bucket.map((item) => score?.(item) ?? 0)) }))
    .sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name))
    .flatMap((group) => group.bucket);
}

export const catalogSubjects: CatalogSubject[] = [
  /* ITA / IME — exatas de vestibulares militares */
  { name: "Matemática · Aritmética e Teoria dos Números", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Matemática · Álgebra Fundamental", group: "ita-ime", weight: 4, difficulty: 4, books: ["FME — Fundamentos de Matemática Elementar 1-3 (Iezzi)", "Noções de Matemática (Aref)"] },
  { name: "Matemática · Funções e Gráficos", group: "ita-ime", weight: 5, difficulty: 5, books: ["FME 8 — Funções (Iezzi)", "Noções de Matemática · Vol. 1 (Aref)"] },
  { name: "Matemática · Trigonometria", group: "ita-ime", weight: 5, difficulty: 4 },
  { name: "Matemática · Sequências e Progressões", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Matemática · Análise Combinatória", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Probabilidade", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Matemática · Matrizes e Determinantes", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Polinômios e Equações Algébricas", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Números Complexos", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Geometria Plana", group: "ita-ime", weight: 5, difficulty: 5, books: ["FME 9 — Geometria Plana (Iezzi)"] },
  { name: "Matemática · Geometria Espacial", group: "ita-ime", weight: 5, difficulty: 5, books: ["FME 10 — Geometria Espacial (Iezzi)"] },
  { name: "Matemática · Geometria Analítica", group: "ita-ime", weight: 5, difficulty: 5, books: ["FME 7 — Geometria Analítica (Iezzi)", "Geometria Analítica (Prof. J. L. Lima)"] },
  { name: "Matemática · Cálculo (Limites e Derivadas)", group: "ita-ime", weight: 5, difficulty: 5, books: ["Cálculo Vol. 1 (Guidorizzi)", "Cálculo (Stewart)"] },
  { name: "Matemática · Cálculo Integral", group: "ita-ime", weight: 4, difficulty: 5, books: ["Cálculo Vol. 1 e 2 (Guidorizzi)"] },
  { name: "Física · Cinemática", group: "ita-ime", weight: 5, difficulty: 5, books: ["Tópicos de Física Vol. 1 (Newton, Helou, Gualter)", "Fundamentos da Física Vol. 1 (Ramalho)"] },
  { name: "Física · Dinâmica (Leis de Newton)", group: "ita-ime", weight: 5, difficulty: 5, books: ["Tópicos de Física Vol. 1", "Física Clássica (Calçada & Sampaio)"] },
  { name: "Física · Trabalho e Energia", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Gravitação", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Física · Estática", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Física · Hidrostática", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Termologia e Dilatação", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Física · Termodinâmica", group: "ita-ime", weight: 5, difficulty: 5, books: ["Tópicos de Física Vol. 2"] },
  { name: "Física · Ondas e Acústica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Óptica Geométrica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Eletrostática", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Eletrodinâmica", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Eletromagnetismo", group: "ita-ime", weight: 5, difficulty: 5, books: ["Tópicos de Física Vol. 3", "Física III (Sears & Zemansky)"] },
  { name: "Física · Física Moderna", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Atomística e Modelos Atômicos", group: "ita-ime", weight: 4, difficulty: 3 },
  { name: "Química · Ligações Químicas", group: "ita-ime", weight: 4, difficulty: 3 },
  { name: "Química · Estequiometria", group: "ita-ime", weight: 5, difficulty: 5, books: ["Química Vol. 1 (Feltre)"] },
  { name: "Química · Soluções e Propriedades Coligativas", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Química · Termoquímica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Química · Cinética Química", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Química · Equilíbrio Químico", group: "ita-ime", weight: 5, difficulty: 5, books: ["Química Vol. 2 (Feltre)"] },
  { name: "Química · Eletroquímica", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Orgânica (Nomenclatura e Funções)", group: "ita-ime", weight: 5, difficulty: 5, books: ["Química Vol. 3 (Feltre)", "Química Orgânica (Solomons & Fryhle)"] },
  { name: "Química · Reações Orgânicas e Mecanismos", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Radioatividade", group: "ita-ime", weight: 2, difficulty: 3 },

  /* ENEM — Ciências e Humanas */
  { name: "Matemática ENEM · Básica e Operações", group: "enem", weight: 3, difficulty: 2 },
  { name: "Matemática ENEM · Estatística e Probabilidade", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Funções e Progressões", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Geometria", group: "enem", weight: 3, difficulty: 2 },
  { name: "Matemática ENEM · Grandezas, Medidas e Proporcionalidade", group: "enem", weight: 2, difficulty: 3 },
  { name: "Biologia · Citologia e Bioquímica", group: "enem", weight: 3, difficulty: 3, books: ["Biologia Vol. 1 (Amabis & Martho)"] },
  { name: "Biologia · Genética e Evolução", group: "enem", weight: 3, difficulty: 3, books: ["Biologia das Células ao Organismo (Linhares)"] },
  { name: "Biologia · Ecologia e Meio Ambiente", group: "enem", weight: 2, difficulty: 2 },
  { name: "Biologia · Fisiologia Humana", group: "enem", weight: 3, difficulty: 3 },
  { name: "Biologia · Botânica", group: "enem", weight: 2, difficulty: 2 },
  { name: "Biologia · Zoologia", group: "enem", weight: 2, difficulty: 3 },
  { name: "Biologia · Microbiologia e Imunologia", group: "enem", weight: 2, difficulty: 3 },
  { name: "Física ENEM · Mecânica", group: "enem", weight: 3, difficulty: 3 },
  { name: "Física ENEM · Eletricidade", group: "enem", weight: 3, difficulty: 3 },
  { name: "Física ENEM · Ondas, Acústica e Óptica", group: "enem", weight: 2, difficulty: 2 },
  { name: "Física ENEM · Termologia", group: "enem", weight: 2, difficulty: 2 },
  { name: "Química ENEM · Química Geral", group: "enem", weight: 3, difficulty: 3 },
  { name: "Química ENEM · Físico-Química", group: "enem", weight: 3, difficulty: 3 },
  { name: "Química ENEM · Ambiental e Orgânica", group: "enem", weight: 2, difficulty: 3 },
  { name: "História · Geral", group: "enem", weight: 3, difficulty: 3 },
  { name: "História · do Brasil", group: "enem", weight: 3, difficulty: 3, books: ["História do Brasil (Boris Fausto)"] },
  { name: "História · da América", group: "enem", weight: 2, difficulty: 3 },
  { name: "Geografia · Física", group: "enem", weight: 3, difficulty: 3, books: ["Geografia — Coleção (Vesentini & Vlach)"] },
  { name: "Geografia · Humana", group: "enem", weight: 3, difficulty: 3 },
  { name: "Geografia · Cartografia e Geopolítica", group: "enem", weight: 2, difficulty: 3 },
  { name: "Humanas · Sociologia", group: "enem", weight: 2, difficulty: 2, books: ["Sociologia para o Ensino Médio (Nelson Dacio)"] },
  { name: "Humanas · Filosofia", group: "enem", weight: 2, difficulty: 2, books: ["Convite à Filosofia (Marilena Chauí)"] },
  { name: "Humanas · Atualidades", group: "enem", weight: 2, difficulty: 3 },

  /* Linguagens e Redação */
  { name: "Português · Gramática e Norma Culta", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Português · Interpretação de Texto", group: "linguagens", weight: 4, difficulty: 3, books: ["Interpretação de Textos (Vânia Maria do Céu)"] },
  { name: "Redação · Dissertação-Argumentativa", group: "linguagens", weight: 5, difficulty: 5, books: ["Como Fazer Redação para o ENEM (Willian Douglas)", "Guia Folha de Redação"] },
  { name: "Redação · Técnica e Autoral", group: "linguagens", weight: 3, difficulty: 4 },
  { name: "Literatura · Brasileira", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Literatura · Portuguesa", group: "linguagens", weight: 2, difficulty: 3 },
  { name: "Literatura · Movimentos Literários", group: "linguagens", weight: 2, difficulty: 2 },
  { name: "Inglês · Grammar and Usage", group: "linguagens", weight: 2, difficulty: 2, books: ["English Grammar in Use (Murphy)"] },
  { name: "Inglês · Interpretação e Vocabulário", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Inglês · Phrasal Verbs e Idioms", group: "linguagens", weight: 2, difficulty: 3 },
  { name: "Espanhol", group: "linguagens", weight: 2, difficulty: 2 },
  { name: "Arte · Cultura e Técnica", group: "linguagens", weight: 1, difficulty: 2 },
  { name: "Educação Física e Saúde", group: "linguagens", weight: 1, difficulty: 1 },
  { name: "Produção de Texto Acadêmico", group: "linguagens", weight: 2, difficulty: 2 },

  /* Faculdade / Graduação */
  { name: "Faculdade · Cálculo I (Limites, Derivadas e Aplicações)", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Cálculo II (Integrais e Séries)", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Cálculo Numérico", group: "faculdade", weight: 3, difficulty: 4 },
  { name: "Faculdade · Álgebra Linear", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Geometria Analítica e Vetores", group: "faculdade", weight: 4, difficulty: 4 },
  { name: "Faculdade · Probabilidade e Estatística", group: "faculdade", weight: 3, difficulty: 4 },
  { name: "Faculdade · Equações Diferenciais", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Física I (Mecânica Clássica)", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Física II (Termodinâmica e Ondas)", group: "faculdade", weight: 4, difficulty: 4 },
  { name: "Faculdade · Física III (Eletromagnetismo)", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Física Experimental", group: "faculdade", weight: 2, difficulty: 3 },
  { name: "Faculdade · Química Geral e Experimental", group: "faculdade", weight: 4, difficulty: 4 },
  { name: "Faculdade · Química Analítica", group: "faculdade", weight: 4, difficulty: 5 },
  { name: "Faculdade · Programação I (Lógica de Programação)", group: "faculdade", weight: 4, difficulty: 4 },
  { name: "Faculdade · Programação II (Orientação a Objetos)", group: "faculdade", weight: 4, difficulty: 4 },
  { name: "Faculdade · Algoritmos e Estruturas de Dados", group: "faculdade", weight: 5, difficulty: 5 },
  { name: "Faculdade · Banco de Dados", group: "faculdade", weight: 3, difficulty: 3 },
  { name: "Faculdade · Redes de Computadores", group: "faculdade", weight: 3, difficulty: 4 },

  /* Curso técnico */
  { name: "Técnico · Eletricidade Básica", group: "tecnico", weight: 3, difficulty: 3 },
  { name: "Técnico · Eletrônica Analógica", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Instalações Elétricas Prediais", group: "tecnico", weight: 3, difficulty: 3 },
  { name: "Técnico · Desenho Técnico e CAD", group: "tecnico", weight: 2, difficulty: 3 },
  { name: "Técnico · Metrologia e Instrumentação", group: "tecnico", weight: 2, difficulty: 3 },
  { name: "Técnico · Robótica e Automação Industrial", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Mecânica dos Materiais", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Segurança do Trabalho", group: "tecnico", weight: 2, difficulty: 2 },
  { name: "Técnico · Informática Aplicada", group: "tecnico", weight: 1, difficulty: 2 },
  { name: "Técnico · Empreendedorismo e Gestão", group: "tecnico", weight: 1, difficulty: 1 }
];

const pad = (value: number) => String(value).padStart(2, "0");
const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Converte o catálogo em matÃ©rias prontas para a matriz (ids sequenciais a partir de startId). */
export function catalogToSubjects(startId = 1): Subject[] {
  let colorIndex = 0;
  return catalogSubjects.map((item, index) => {
    const color = COLORS[colorIndex++ % COLORS.length];
    return {
      id: startId + index,
      userId: 1,
      name: item.name,
      weight: item.weight,
      difficulty: item.difficulty,
      computedIp: item.weight * item.difficulty,
      color,
      goalAccuracy: 70 + ((index * 7) % 21),
      goalCoverage: 100,
      currentLevel: 1,
      targetLevel: 5,
      createdAt: isoDaysAgo(110 - index)
    };
  });
}