import type { ExamTrack, Subject } from "../shared/types";

export type CatalogGroup = "ita-ime" | "enem" | "linguagens" | "faculdade" | "tecnico";

export interface CatalogSubject {
  name: string;
  group: CatalogGroup;
  weight: number;
  difficulty: number;
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

export const catalogSubjects: CatalogSubject[] = [
  /* ITA / IME — exatas de vestibulares militares */
  { name: "Matemática · Aritmética e Teoria dos Números", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Matemática · Álgebra Fundamental", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Funções e Gráficos", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Matemática · Trigonometria", group: "ita-ime", weight: 5, difficulty: 4 },
  { name: "Matemática · Sequências e Progressões", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Matemática · Análise Combinatória", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Probabilidade", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Matemática · Matrizes e Determinantes", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Polinômios e Equações Algébricas", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Números Complexos", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Matemática · Geometria Plana", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Matemática · Geometria Espacial", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Matemática · Geometria Analítica", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Matemática · Cálculo (Limites e Derivadas)", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Matemática · Cálculo Integral", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Física · Cinemática", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Dinâmica (Leis de Newton)", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Trabalho e Energia", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Gravitação", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Física · Estática", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Física · Hidrostática", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Termologia e Dilatação", group: "ita-ime", weight: 3, difficulty: 3 },
  { name: "Física · Termodinâmica", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Ondas e Acústica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Óptica Geométrica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Física · Eletrostática", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Eletrodinâmica", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Eletromagnetismo", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Física · Física Moderna", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Atomística e Modelos Atômicos", group: "ita-ime", weight: 4, difficulty: 3 },
  { name: "Química · Ligações Químicas", group: "ita-ime", weight: 4, difficulty: 3 },
  { name: "Química · Estequiometria", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Química · Soluções e Propriedades Coligativas", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Química · Termoquímica", group: "ita-ime", weight: 4, difficulty: 4 },
  { name: "Química · Cinética Química", group: "ita-ime", weight: 3, difficulty: 4 },
  { name: "Química · Equilíbrio Químico", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Química · Eletroquímica", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Orgânica (Nomenclatura e Funções)", group: "ita-ime", weight: 5, difficulty: 5 },
  { name: "Química · Reações Orgânicas e Mecanismos", group: "ita-ime", weight: 4, difficulty: 5 },
  { name: "Química · Radioatividade", group: "ita-ime", weight: 2, difficulty: 3 },

  /* ENEM — Ciências e Humanas */
  { name: "Matemática ENEM · Básica e Operações", group: "enem", weight: 3, difficulty: 2 },
  { name: "Matemática ENEM · Estatística e Probabilidade", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Funções e Progressões", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Geometria", group: "enem", weight: 3, difficulty: 2 },
  { name: "Matemática ENEM · Grandezas, Medidas e Proporcionalidade", group: "enem", weight: 2, difficulty: 3 },
  { name: "Biologia · Citologia e Bioquímica", group: "enem", weight: 3, difficulty: 3 },
  { name: "Biologia · Genética e Evolução", group: "enem", weight: 3, difficulty: 3 },
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
  { name: "História · do Brasil", group: "enem", weight: 3, difficulty: 3 },
  { name: "História · da América", group: "enem", weight: 2, difficulty: 3 },
  { name: "Geografia · Física", group: "enem", weight: 3, difficulty: 3 },
  { name: "Geografia · Humana", group: "enem", weight: 3, difficulty: 3 },
  { name: "Geografia · Cartografia e Geopolítica", group: "enem", weight: 2, difficulty: 3 },
  { name: "Humanas · Sociologia", group: "enem", weight: 2, difficulty: 2 },
  { name: "Humanas · Filosofia", group: "enem", weight: 2, difficulty: 2 },
  { name: "Humanas · Atualidades", group: "enem", weight: 2, difficulty: 3 },

  /* Linguagens e Redação */
  { name: "Português · Gramática e Norma Culta", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Português · Interpretação de Texto", group: "linguagens", weight: 4, difficulty: 3 },
  { name: "Redação · Dissertação-Argumentativa", group: "linguagens", weight: 5, difficulty: 5 },
  { name: "Redação · Técnica e Autoral", group: "linguagens", weight: 3, difficulty: 4 },
  { name: "Literatura · Brasileira", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Literatura · Portuguesa", group: "linguagens", weight: 2, difficulty: 3 },
  { name: "Literatura · Movimentos Literários", group: "linguagens", weight: 2, difficulty: 2 },
  { name: "Inglês · Grammar and Usage", group: "linguagens", weight: 2, difficulty: 2 },
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