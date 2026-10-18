import type { ExamTrack, Subject } from "../shared/types";

export type CatalogGroup = "ita-ime" | "enem" | "linguagens" | "faculdade" | "aeroespacial" | "tecnico" | "internacional";

export interface CatalogSubject {
  name: string;
  group: CatalogGroup;
  weight: number;
  difficulty: number;
  books?: string[];
}

export const PROFICIENCY_LEVELS = [
  { value: 1, label: "Inicial" },
  { value: 2, label: "Básico" },
  { value: 3, label: "Intermediário" },
  { value: 4, label: "Avançado" }
] as const;

export const CATALOG_COLORS = ["indigo", "violet", "cyan", "pink", "amber", "emerald", "orange", "blue"];
const COLORS = CATALOG_COLORS;

/** Matérias por trilha de prova (vestibular escolhido). */
export const EXAM_TRACK_GROUPS: Record<ExamTrack, CatalogGroup[]> = {
  "Ensino Médio": ["enem", "linguagens"],
  "ENEM": ["enem", "linguagens"],
  "CEFET-MG": ["tecnico", "enem", "linguagens"],
  "IFMG": ["tecnico", "enem", "linguagens"],
  "PUC Minas (Betim)": ["faculdade", "enem", "linguagens"],
  "FUVEST": ["enem", "linguagens"],
  "UNICAMP": ["enem", "linguagens"],
  "ITA": ["ita-ime"],
  "IME": ["ita-ime"],
  "QVest / outro": ["ita-ime", "enem", "linguagens", "faculdade", "aeroespacial", "tecnico", "internacional"],
  "Internacional": ["internacional", "linguagens"],
  "Personalizado": ["ita-ime", "enem", "linguagens", "faculdade", "aeroespacial", "tecnico", "internacional"]
};

export const EXAM_TRACKS: ExamTrack[] = ["Ensino Médio", "ENEM", "CEFET-MG", "IFMG", "PUC Minas (Betim)", "FUVEST", "UNICAMP", "ITA", "IME", "QVest / outro", "Internacional", "Personalizado"];

export interface ExamGuide {
  title: string;
  profile: string;
  practice: string;
  source: string;
  sourceLabel: string;
}

/** Orientação geral e fonte primária para a prova selecionada; o edital vigente prevalece. */
export const EXAM_GUIDES: Record<ExamTrack, ExamGuide> = {
  "Ensino Médio": { title: "Base ampla do ensino médio", profile: "Revise conceitos e pratique leitura, interpretação e resolução de problemas em todas as áreas.", practice: "Alterne questões, recordação ativa e explicação em voz alta.", source: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", sourceLabel: "Acervo oficial de provas" },
  "ENEM": { title: "Quatro áreas + redação", profile: "A prova tem 180 itens objetivos distribuídos em quatro áreas e uma redação; priorize leitura de contexto, interpretação de dados, competências e gestão do tempo.", practice: "Misture questões cronometradas das quatro áreas, revisão dos erros e uma prática recorrente de redação.", source: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", sourceLabel: "Provas e gabaritos do INEP" },
  "CEFET-MG": { title: "CEFET-MG · confirme a modalidade", profile: "A seleção muda entre técnico integrado, concomitante/subsequente e graduação. Use o programa e o caderno da modalidade e do ano desejados.", practice: "Resolva cadernos antigos com tempo marcado e classifique erros por conteúdo e interpretação.", source: "https://www.copeve.cefetmg.br/processosanteriores", sourceLabel: "COPEVE · provas e editais" },
  "IFMG": { title: "IFMG · campus e curso importam", profile: "A forma de ingresso varia por curso e nível; no Campus Betim, os cursos superiores podem usar ENEM, enquanto processos técnicos têm cadernos próprios conforme o edital.", practice: "Escolha o caderno correspondente ao seu nível e campus; treine redação somente quando prevista no seu edital.", source: "https://www.ifmg.edu.br/portal/processo-seletivo/processos-seletivos-anteriores-1", sourceLabel: "Acervo oficial IFMG" },
  "PUC Minas (Betim)": { title: "PUC Minas · Campus Betim", profile: "O formato e o conteúdo variam por curso; Medicina tem uma prova própria. Confira o caderno específico e a edição mais recente.", practice: "Treine por cadernos do curso/campus, combinando questões objetivas e produção de texto quando exigida.", source: "https://www.pucminas.br/formas-ingresso/vestibular/Paginas/provas-e-gabaritos.aspx", sourceLabel: "Provas e gabaritos PUC Minas" },
  "FUVEST": { title: "FUVEST · fases e questões abertas", profile: "Treine conhecimentos gerais na primeira fase e aprofundamento, escrita e resolução discursiva conforme a carreira na etapa seguinte.", practice: "Alterne simulados de múltipla escolha com respostas discursivas corrigidas por critérios.", source: "https://www.fuvest.br/acervo-vestibular/", sourceLabel: "Acervo oficial FUVEST" },
  "UNICAMP": { title: "UNICAMP · leitura e respostas discursivas", profile: "Pratique contextualização, leitura atenta e construção de respostas com justificativa; consulte o edital e os cadernos da edição vigente.", practice: "Resolva provas anteriores por fase e escreva respostas completas sob tempo.", source: "https://www.comvest.unicamp.br/vestibulares-anteriores/", sourceLabel: "Acervo oficial COMVEST" },
  "ITA": { title: "ITA · alta densidade em exatas", profile: "Priorize matemática, física e química com encadeamento de várias ideias; inclua português, inglês e redação conforme a fase.", practice: "Faça blocos de problemas longos, registre o raciocínio e revise soluções discursivas.", source: "https://vestibular.ita.br/provas.htm", sourceLabel: "Provas anteriores do ITA" },
  "IME": { title: "IME · resolução rigorosa", profile: "Combine problemas exigentes de matemática, física e química com as provas de português e inglês; a estrutura depende da fase e do edital.", practice: "Treine questões discursivas sem consulta e compare cada etapa da solução com o gabarito oficial.", source: "https://vestibular.ime.eb.br/cfg/", sourceLabel: "Concurso e provas anteriores do IME" },
  "QVest / outro": { title: "Prova personalizada", profile: "Informe instituição, nível, curso e edital. “QVest” pode se referir a serviços diferentes; o app não presume uma matriz única.", practice: "Cadastre matérias e use um edital ou caderno oficial para calibrar os simulados.", source: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", sourceLabel: "Começar por um acervo oficial" },
  "Internacional": { title: "Prova internacional", profile: "Formato, idioma e competências dependem do exame. Defina qual certificação ou universidade antes de personalizar a matriz.", practice: "Use documentos oficiais do exame escolhido e inclua prática no idioma e tempo de prova.", source: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", sourceLabel: "Selecionar prova de referência" },
  "Personalizado": { title: "Prova sob medida", profile: "Informe instituição, curso e edital para que a matriz e a prática reflitam as regras reais da seleção.", practice: "Importe o programa oficial e organize as questões por matéria, habilidade e dificuldade.", source: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", sourceLabel: "Abrir acervo de referência" }
};

export function catalogSubjectsForTrack(track: ExamTrack): CatalogSubject[] {
  const groups = new Set(EXAM_TRACK_GROUPS[track] ?? EXAM_TRACK_GROUPS["Personalizado"]);
  return catalogSubjects.filter((item) => groups.has(item.group));
}

/**
 * Catálogo da trilha com a extensão da meta de curso: escolher uma engenharia
 * aeroespacial, por exemplo, soma o grupo de performance (cálculo, fluidos,
 * sistemas de voo, avionics e computação científica) ao tronco da prova.
 */
export function catalogSubjectsFor(track: ExamTrack, course: CourseGoal | null): CatalogSubject[] {
  if (!course?.extension) return catalogSubjectsForTrack(track);
  const groups = new Set([...(EXAM_TRACK_GROUPS[track] ?? EXAM_TRACK_GROUPS["Personalizado"]), course.extension]);
  return catalogSubjects.filter((item) => groups.has(item.group));
}

/** Grupos extras que a meta de curso ativa (extensão de performance). */
export const extensionGroup = (course: CourseGoal | null): CatalogGroup | null => course?.extension ?? null;

export const CATALOG_GROUPS: CatalogGroup[] = ["ita-ime", "enem", "linguagens", "faculdade", "aeroespacial", "tecnico", "internacional"];

export const CATALOG_GROUP_LABELS: Record<CatalogGroup, string> = {
  "ita-ime": "Provões exatas · ITA / IME",
  enem: "ENEM · Ciências e Humanas",
  linguagens: "Linguagens e Redação",
  faculdade: "Faculdade / Graduação",
  aeroespacial: "Aeroespacial · Foco de performance",
  tecnico: "Curso técnico",
  internacional: "Internacional · SAT / TOEFL"
};

export const CATALOG_GROUP_HINTS: Record<CatalogGroup, string> = {
  "ita-ime": "Matemática, Física e Química no nível de vestibulares militares (ITA, IME e congêneres).",
  enem: "Matemática, Ciências da Natureza, Humanas e suas tecnologias na linha do ENEM.",
  linguagens: "Português, gramática, literatura, redação e idiomas.",
  faculdade: "Disciplinas comuns de graduação: cálculo, álgebra, programação, física e química universitárias.",
  aeroespacial: "Extensão de performance para engenharia aeroespacial: cálculo, corpos rígidos, fluidos/aerodinâmica, sistemas de voo, avionics e computação científica.",
  tecnico: "Disciplinas de cursos técnicos: elétrica, desenho, automação, mecânica e gestão.",
  internacional: "Provas internacionais: SAT/ACT para graduação fora, TOEFL/IELTS para proficiência e o inglês acadêmico de essays e entrevistas."
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

/** Realça itens cuja matéria-mãe (ou o próprio nome) está na lista — usado por áreas de foco e metas de curso. */
export const emphasizeParents = (parents: string[], entry: Pick<CatalogSubject, "name">): boolean =>
  parents.some((parent) => {
    if (entry.name === parent) return true;
    const marker = `${parent} · `;
    return entry.name.startsWith(marker);
  });

export const emphasize = (area: FocusArea | null, entry: Pick<CatalogSubject, "name">): boolean =>
  area !== null && emphasizeParents(area.parents, entry);

/** Peso elevado pelo multiplicador, arredondado e limitado a 1..5. */
const boostWeight = (weight: number, multiplier: number): number =>
  Math.max(1, Math.min(5, Math.round(weight * multiplier)));

/** Peso com a ênfase da área aplicada (arredondado e limitado a 1..5). */
export const areaWeight = (area: FocusArea | null, entry: CatalogSubject): number =>
  area && emphasize(area, entry) ? boostWeight(entry.weight, area.multiplier) : entry.weight;

/* --- Meta por curso preferido: corte, ênfase de pesos e kit de domínio --- */

export interface CourseGoal {
  id: string;
  label: string;
  /** Prova que a meta usa como referência — escolher o curso troca o vestibular alvo do catálogo. */
  track: ExamTrack;
  university: string;
  cutoff: string;
  /** Pesos oficiais da prova quando instituição, edição e fonte foram conferidos. */
  admissionProfile?: {
    institution: string;
    edition: string;
    source: string;
    /** Peso por grupo da matriz; extensões de preparação não entram no cálculo de ingresso. */
    weights: Partial<Record<"enem" | "linguagens", number>>;
  };
  summary: string;
  /** Matérias para dominar: eleva o peso padrão destas matérias-mãe na rota. */
  emphasis: { parents: string[]; multiplier: number };
  /** Grupo de performance somado ao tronco da prova quando este curso é o alvo. */
  extension?: CatalogGroup;
  methods: string[];
  youtube: {
    silos: string[];
    channels: Array<{ name: string; focus: string }>;
    searches: string[];
  };
  platforms: Array<{ name: string; focus: string }>;
  books: Array<{ name: string; focus: string }>;
  dorks: Array<{ label: string; query: string }>;
}

export const COURSE_GOALS: CourseGoal[] = [
  {
    id: "eng-aeroespacial",
    label: "Engenharia Aeroespacial",
    track: "ENEM",
    university: "UFMG · SISU (Belo Horizonte)",
    cutoff: "SISU 2026 · nota mínima da ampla concorrência: 779,14",
    admissionProfile: {
      institution: "UFMG · Campus Pampulha",
      edition: "Termo de Adesão SISU/UFMG 2026",
      source: "https://www.ufmg.br/sisu/wp-content/uploads/2026/01/termo_adesao_575_UFMG-16-ASSINADO.pdf",
      weights: { enem: 1, linguagens: 1 }
    },
    summary: "Meta de alta concorrência: tronco ENEM completo + extensão de performance — Cálculo Diferencial e Integral, corpos rígidos, mecânica dos fluidos e aerodinâmica, sistemas de voo, avionics e computação científica.",
    emphasis: { parents: ["Matemática ENEM", "Física ENEM", "Química ENEM", "Aeroespacial"], multiplier: 1.3 },
    extension: "aeroespacial",
    methods: [
      "Matemática e Física: prática direta de exercícios; a cada erro, TDD Cognitivo — refaça o raciocínio dedutivo no rascunho sem olhar a resolução.",
      "Química teórica: leitura focada convertida imediatamente em flashcards na fila de repetição espaçada (FSRS) do app.",
      "Caderno de Erros Estratégicos: classifique a causa (não sabia × errei × chutei) na revisão da lista de tarefas.",
      "Redação semanal sob as rubricas do Inep — a nota sustenta a média mesmo em curso de exatas."
    ],
    youtube: {
      silos: [
        "Crie uma Brand Account \"Silo STEM\" (conta de marca) usada só para Matemática, Física e Química — nada de entretenimento no mesmo login.",
        "Um silo por macrocluster: STEM e Idiomas em contas separadas; misturar assuntos gera resíduo de atenção e custo de troca de contexto.",
        "Entre no YouTube por busca ativa ou playlist salva — nunca navegue pelo feed inicial."
      ],
      channels: [
        { name: "3Blue1Brown", focus: "intuição visual de cálculo, álgebra linear e séries" },
        { name: "Professor Leonard", focus: "cálculo e álgebra passo a passo, com rigor" },
        { name: "Portal da Matemática OBMEP", focus: "rigor formal do ensino médio: geometria, funções e contagem" },
        { name: "Prof. Boaro", focus: "Física construída passo a passo, do conceito ao exercício" },
        { name: "IFUSP · Univesp", focus: "aulas universitárias para vetores e cálculo avançado" }
      ],
      searches: [
        "geometria analítica ENEM resolução de questões",
        "cinemática vetorial exercícios resolvidos",
        "leis de Newton diagrama de corpo livre passo a passo",
        "estequiometria questões comentadas ENEM",
        "eletromagnetismo exercícios vestibulares resolvidos"
      ]
    },
    platforms: [
      { name: "Aprova Total", focus: "curso ENEM completo, correção de redação e simulados" },
      { name: "Portal da Matemática OBMEP", focus: "videoaulas e listas gratuitas por tópico" },
      { name: "Khan Academy", focus: "prática adaptativa de matemática e física (gratuita)" }
    ],
    books: [
      { name: "O Algebrista (Laércio Vasconcelos)", focus: "nivelamento: elimina lacunas de álgebra elementar antes do aprofundamento" },
      { name: "Fundamentos da Matemática Elementar 1–3 (Iezzi)", focus: "rigor de ensino médio: conjuntos, funções e trigonometria" },
      { name: "Noções de Matemática · Vol. 1 (Aref)", focus: "funções com forte intuição gráfica" },
      { name: "Tópicos de Física 1–3 (Gualter, Newton, Helou)", focus: "prática massiva de exercícios por assunto" },
      { name: "Física Clássica (Calçada & Sampaio)", focus: "teoria densa para conceito e modelagem" },
      { name: "Química 1–3 (Feltre)", focus: "didática atomizada: geral, físico-química e orgânica" },
      { name: "English Grammar in Use (Murphy)", focus: "imersão estrutural para língua estrangeira" }
    ],
    dorks: [
      { label: "O Algebrista", query: "intitle:\"index of\" \"O Algebrista\" pdf" },
      { label: "FME (Iezzi)", query: "intitle:\"index of\" \"Fundamentos da Matemática Elementar\" pdf" },
      { label: "Tópicos de Física", query: "filetype:pdf \"Tópicos de Física\" Gualter" },
      { label: "Física Clássica", query: "filetype:pdf \"Física Clássica\" \"Sampaio\" vol" },
      { label: "Química (Feltre)", query: "intitle:\"index of\" \"Ricardo Feltre\" Quimica" },
      { label: "Murphy", query: "filetype:pdf \"English Grammar in Use\" Murphy" }
    ]
  },
  {
    id: "eng-civil",
    label: "Engenharia Civil",
    track: "ENEM",
    university: "Federais via SISU (ex.: UFMG, UFRJ)",
    cutoff: "≈ 720–750 no SISU",
    summary: "Matemática e Física sólidas para Estática, Hidrostática e Geometria Espacial, com Química geral como desempate nas exatas.",
    emphasis: { parents: ["Matemática ENEM", "Física ENEM"], multiplier: 1.25 },
    methods: [
      "Física: desenhe sempre o diagrama de corpo livre antes de equacionar — Estática e Hidrostática são o núcleo.",
      "Matemática: Geometria Espacial e proporcionalidade via exercícios de vestibular, corrigindo com TDD Cognitivo.",
      "Erros de cálculo viram cards no laboratório de memória — a recaída em erro bobo derruba a TRI."
    ],
    youtube: {
      silos: [
        "Brand Account \"Silo STEM\" só com aulas de exatas — histórico limpo força o algoritmo a recomendar aulas técnicas.",
        "Salve playlists por tópico (estática, hidrostática, geometria) e estude por elas, sem feed."
      ],
      channels: [
        { name: "Prof. Boaro", focus: "Física do conceito ao exercício, com construção passo a passo" },
        { name: "Portal da Matemática OBMEP", focus: "geometria e funções com rigor" },
        { name: "3Blue1Brown", focus: "intuição visual para taxas e áreas" }
      ],
      searches: [
        "estática exercícios resolvidos ENEM",
        "hidrostática empuxo questões comentadas",
        "geometria espacial prismas e cilindros ENEM"
      ]
    },
    platforms: [
      { name: "Aprova Total", focus: "curso ENEM completo com simulados" },
      { name: "Khan Academy", focus: "prática adaptativa gratuita" }
    ],
    books: [
      { name: "O Algebrista (Laércio Vasconcelos)", focus: "nivelamento de álgebra elementar" },
      { name: "Fundamentos da Matemática Elementar 1–3 (Iezzi)", focus: "base de rigor" },
      { name: "Tópicos de Física 1–3 (Gualter, Newton, Helou)", focus: "exercícios por assunto" },
      { name: "Química 1–3 (Feltre)", focus: "química geral para as questões de exatas" }
    ],
    dorks: [
      { label: "FME (Iezzi)", query: "intitle:\"index of\" \"Fundamentos da Matemática Elementar\" pdf" },
      { label: "Tópicos de Física", query: "filetype:pdf \"Tópicos de Física\" Gualter" }
    ]
  },
  {
    id: "medicina",
    label: "Medicina",
    track: "ENEM",
    university: "Federais via SISU (ex.: UFMG, UFRJ)",
    cutoff: "≈ 790–820 no SISU",
    summary: "A maior concorrência do país: Biologia e Química em primeiro plano, com humanas e redação de nota alta sustentando a média.",
    emphasis: { parents: ["Biologia", "Química ENEM"], multiplier: 1.3 },
    methods: [
      "Biologia: leitura focada transformada na hora em flashcards FSRS — volume imenso exige repetição espaçada, não releitura.",
      "Química: estequiometria e equilíbrio com TDD Cognitivo nos erros.",
      "Humanas: Método Cornell — gatilho à esquerda, fenômeno à direita, impacto atual no rodapé.",
      "Redação semanal corrigida por rubrica do Inep."
    ],
    youtube: {
      silos: [
        "Brand Account \"Silo BioMed\": Biologia e Química apenas.",
        "Separe um silo de Humanas (História/Geografia) para repertório de redação."
      ],
      channels: [
        { name: "Biologia Total com Prof. Jubilut", focus: "biologia completa com resolução de questões" },
        { name: "Ciência em Ação (Prof. Andrei)", focus: "química com experimentos e exercícios" },
        { name: "Portal da Matemática OBMEP", focus: "matemática básica do ENEM" }
      ],
      searches: [
        "citologia ENEM questões comentadas",
        "genética leis de Mendel exercícios ENEM",
        "fisiologia humana revisão ENEM",
        "estequiometria e soluções questões comentadas"
      ]
    },
    platforms: [
      { name: "Aprova Total", focus: "curso ENEM com correção de redação" },
      { name: "Khan Academy", focus: "biologia e química adaptativas (grátis)" }
    ],
    books: [
      { name: "Biologia Vol. 1 (Amabis & Martho)", focus: "base de citologia e genética" },
      { name: "Biologia das Células ao Organismo (Linhares)", focus: "fisiologia com abordagem ENEM" },
      { name: "Química 1–3 (Feltre)", focus: "físico-química e orgânica com didática atomizada" },
      { name: "O Algebrista (Laércio Vasconcelos)", focus: "nivelamento para matemática básica" }
    ],
    dorks: [
      { label: "Feltre", query: "intitle:\"index of\" \"Ricardo Feltre\" Quimica" },
      { label: "O Algebrista", query: "intitle:\"index of\" \"O Algebrista\" pdf" }
    ]
  },
  {
    id: "ciencia-computacao",
    label: "Ciência da Computação",
    track: "ENEM",
    university: "Federais via SISU (ex.: UFMG, UnB)",
    cutoff: "≈ 740–770 no SISU",
    summary: "Matemática discreta em primeiro plano: Análise Combinatória, Probabilidade e Funções dominam a prova; programação entra como alavanca de prática.",
    emphasis: { parents: ["Matemática ENEM"], multiplier: 1.3 },
    methods: [
      "Matemática: blocos de questões de Análise Combinatória e Probabilidade; todo erro refeito do zero (TDD Cognitivo).",
      "Programação: 1 hora diária de prática deliberada (lógica → estruturas de dados) para chegar na graduação com base."
    ],
    youtube: {
      silos: [
        "Brand Account \"Silo STEM\": Matemática + programação apenas.",
        "Playlists por tópico (combinatória, lógica) — nunca navegue pelo feed."
      ],
      channels: [
        { name: "3Blue1Brown", focus: "intuição visual de combinatória, probabilidade e álgebra linear" },
        { name: "Curso em Vídeo (Gustavo Guanabara)", focus: "programação e lógica do zero" },
        { name: "Portal da Matemática OBMEP", focus: "contagem e probabilidade com rigor" }
      ],
      searches: [
        "análise combinatória ENEM questões comentadas",
        "probabilidade ENEM exercícios resolvidos",
        "lógica de programação primeira aula"
      ]
    },
    platforms: [
      { name: "Curso em Vídeo", focus: "cursos gratuitos de programação" },
      { name: "Aprova Total", focus: "curso ENEM completo" }
    ],
    books: [
      { name: "Fundamentos da Matemática Elementar 5 (Iezzi)", focus: "combinatória e probabilidade" },
      { name: "O Algebrista (Laércio Vasconcelos)", focus: "nivelamento algébrico" }
    ],
    dorks: [
      { label: "FME 5", query: "intitle:\"index of\" \"Fundamentos de Matemática Elementar 5\"" }
    ]
  },
  {
    id: "direito",
    label: "Direito",
    track: "ENEM",
    university: "Federais via SISU (ex.: UFMG, UFRJ)",
    cutoff: "≈ 750–780 no SISU",
    summary: "Humanidades com redação decisiva: interpretação densa, repertório de atualidades e argumentação sob a rubrica do Inep.",
    emphasis: { parents: ["Redação", "Humanas", "História", "Português"], multiplier: 1.25 },
    methods: [
      "Redação: uma produção semanal corrigida pelas competências do Inep + banco de repertórios legítimos.",
      "História e Filosofia/Sociologia: mapas mentais de teias argumentativas para a redação.",
      "Humanas: Método Cornell (fator desencadeante × fenômeno × impacto atual)."
    ],
    youtube: {
      silos: [
        "Brand Account \"Silo Humanas\": História, Geografia, Filosofia/Sociologia e redação.",
        "Feed nunca: busque pelo tópico e salve playlists."
      ],
      channels: [
        { name: "Debora Aladim", focus: "redação nota 1000 e história" },
        { name: "Professor Noslen", focus: "gramática e interpretação" },
        { name: "Toda Matéria", focus: "sínteses de humanidades" }
      ],
      searches: [
        "redação ENEM estrutura dissertativa argumentativa",
        "atualidades geopolítica ENEM resumo",
        "filosofia política repertório redação"
      ]
    },
    platforms: [
      { name: "Aprova Total", focus: "curso ENEM completo com correção de redação" }
    ],
    books: [
      { name: "História do Brasil (Boris Fausto)", focus: "narrativa crítica do Brasil colônia à república" },
      { name: "Sociologia para o Ensino Médio (Nelson Dacio)", focus: "clássicos e autores contemporâneos" },
      { name: "Convite à Filosofia (Marilena Chauí)", focus: "panorama filosófico para repertório" },
      { name: "Interpretação de Textos (Vânia Maria do Céu)", focus: "leitura e gramática instrumental" }
    ],
    dorks: [
      { label: "Boris Fausto", query: "filetype:pdf \"História do Brasil\" \"Boris Fausto\"" }
    ]
  },
  {
    id: "engenharia-ita-ime",
    label: "Engenharia (ITA · IME)",
    track: "ITA",
    university: "ITA (São José dos Campos) · IME (Rio)",
    cutoff: "aprovação por mérito — corte histórico exige média acima de 80% na prova",
    summary: "Rigor e abstração severa: manipulação algébrica densa, demonstrações e problemas nível olímpico/militar em Matemática, Física e Química.",
    emphasis: { parents: ["Matemática", "Física", "Química"], multiplier: 1.3 },
    methods: [
      "Fundação com FME (Iezzi) e Noções de Matemática (Aref): teoria completa antes de resolver exercício.",
      "85% do tempo em manipulação algébrica ativa e demonstrações — resumo passivo não sobrevive ao ITA.",
      "TDD Cognitivo obrigatório: todo erro de prova anterior refeito do zero, sem consultar a solução."
    ],
    youtube: {
      silos: [
        "Brand Account \"Silo STEM\": só exatas de nível militar.",
        "Playlists por tópico (geometria espacial, polinômios, eletromagnetismo) — estudo dirigido."
      ],
      channels: [
        { name: "Portal da Matemática OBMEP", focus: "rigor formal e problemas olímpicos" },
        { name: "Professor Leonard", focus: "cálculo com rigor, do zero" },
        { name: "IFUSP · Univesp", focus: "física universitária e tratamento vetorial" },
        { name: "Prof. Boaro", focus: "física de vestibulares militares" }
      ],
      searches: [
        "geometria espacial ITA exercícios resolvidos",
        "números complexos ITA prova anterior",
        "polinômios IME demonstração",
        "eletromagnetismo ITA exercícios"
      ]
    },
    platforms: [
      { name: "Portal da Matemática OBMEP", focus: "trilhas gratuitas de aprofundamento" },
      { name: "Poliedro", focus: "material e simulados focados em ITA/IME" }
    ],
    books: [
      { name: "O Algebrista (Laércio Vasconcelos)", focus: "nivelamento antes da FME" },
      { name: "Fundamentos da Matemática Elementar 1–10 (Iezzi)", focus: "coleção completa padrão-ouro para ITA/IME" },
      { name: "Noções de Matemática (Aref)", focus: "tratamento fino de funções e trigonometria" },
      { name: "Tópicos de Física 1–3 (Gualter, Newton, Helou)", focus: "exercícios em nível militar" },
      { name: "Física Clássica (Calçada & Sampaio)", focus: "teoria densa" },
      { name: "Química 1–3 (Feltre)", focus: "base para o nível IME/ITA" }
    ],
    dorks: [
      { label: "FME (Iezzi)", query: "intitle:\"index of\" \"Fundamentos da Matemática Elementar\" pdf" },
      { label: "Tópicos de Física", query: "filetype:pdf \"Tópicos de Física\" Gualter" },
      { label: "Física Clássica", query: "filetype:pdf \"Física Clássica\" \"Sampaio\" vol" }
    ]
  }
];

export const emphasizeCourse = (course: CourseGoal | null, entry: Pick<CatalogSubject, "name">): boolean =>
  course !== null && emphasizeParents(course.emphasis.parents, entry);

/** Meta de curso por id — o lookup estava duplicado em demo, synergy e wizard.
 * Devolve `null` para id ausente/desconhecido, que é o caso testável. */
export const courseGoalById = (id: string | null): CourseGoal | null =>
  COURSE_GOALS.find((candidate) => candidate.id === id) ?? null;

/** Rótulo da meta para textos de motivo. Extraído para que o fallback (curso
 * ausente) seja exercitado direto, em vez de ficar como ramo morto no meio de
 * um `if` que já garantiu `course !== null`. */
export const courseLabelOf = (course: CourseGoal | null, fallback: string): string => course?.label ?? fallback;

/** Peso com a meta de curso e a ênfase de área aplicadas (curso primeiro, área depois, teto 5). */
export const courseAreaWeight = (course: CourseGoal | null, area: FocusArea | null, entry: CatalogSubject): number => {
  let weight = entry.weight;
  if (course && emphasizeCourse(course, entry)) weight = boostWeight(weight, course.emphasis.multiplier);
  if (area && emphasize(area, entry)) weight = boostWeight(weight, area.multiplier);
  return weight;
};

export const booksForName = (name: string): string[] | undefined =>
  catalogSubjects.find((entry) => entry.name === name)?.books;

/**
 * Reordena itens de forma que as sub-áreas de uma mesma matéria-mãe venham
 * uma após a outra (ex.: Cinemática → Dinâmica → Energia → …), mantendo as
 * matérias de maior escore (risco/computedIp) no bloco inicial da rota.
 */
const isExatasArea = (name: string) => ["Matemática", "Física", "Química"].some((stem) => name.includes(stem));

export function sequenceByParent<T extends { name: string }>(items: T[], score?: (item: T) => number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = parentArea(item.name);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  const ordered = [...groups.entries()]
    .map(([name, bucket]) => ({ name, bucket, peak: Math.max(0, ...bucket.map((item) => score?.(item) ?? 0)) }))
    .sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name));
  // Exatas e teoria intercalam na rotação: pais de Matemática/Física/Química
  // não ficam em sequência — o primeiro grupo é o de maior pico de risco.
  const exacts = ordered.filter((group) => isExatasArea(group.name));
  const others = ordered.filter((group) => !isExatasArea(group.name));
  const interleaved: typeof ordered = [];
  let preferExatas = (exacts[0]?.peak ?? -1) >= (others[0]?.peak ?? -1);
  while (exacts.length || others.length) {
    const takeExatas = exacts.length > 0 && (preferExatas || others.length === 0);
    interleaved.push((takeExatas ? exacts : others).shift()!);
    preferExatas = !takeExatas;
  }
  return interleaved.flatMap((group) => group.bucket);
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
  { name: "Física · Física Quântica", group: "ita-ime", weight: 4, difficulty: 5 },
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
  { name: "Matemática ENEM · Álgebra (Equações e Sistemas)", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Geometria Plana e Espacial", group: "enem", weight: 3, difficulty: 2 },
  { name: "Matemática ENEM · Geometria Analítica", group: "enem", weight: 3, difficulty: 3 },
  { name: "Matemática ENEM · Trigonometria", group: "enem", weight: 3, difficulty: 3 },
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
  { name: "Redação ENEM · Repertório Sociocultural", group: "linguagens", weight: 3, difficulty: 3 },
  { name: "Redação ENEM · Coesão e Proposta de Intervenção", group: "linguagens", weight: 4, difficulty: 4 },
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

  /* Extensão Engenharia Aeroespacial — Foco de Performance */
  { name: "Aeroespacial · Introdução a Sistemas de Voo", group: "aeroespacial", weight: 4, difficulty: 4, books: ["Introdução ao Voo (Anderson)"] },
  { name: "Aeroespacial · Cálculo Diferencial e Integral", group: "aeroespacial", weight: 5, difficulty: 5, books: ["Cálculo Vol. 1 (Stewart)", "Cálculo Vol. 1 e 2 (Guidorizzi)"] },
  { name: "Aeroespacial · Equações Diferenciais (EDOs)", group: "aeroespacial", weight: 4, difficulty: 5, books: ["Equações Diferenciais (Boyce & DiPrima)"] },
  { name: "Aeroespacial · Dinâmica dos Corpos Rígidos", group: "aeroespacial", weight: 5, difficulty: 5, books: ["Mecânica Vetorial para Engenheiros (Beer & Johnston)"] },
  { name: "Aeroespacial · Hidrostática e Mecânica dos Fluidos", group: "aeroespacial", weight: 4, difficulty: 5, books: ["Mecânica dos Fluidos (Fox & McDonald)"] },
  { name: "Aeroespacial · Aerodinâmica Básica", group: "aeroespacial", weight: 5, difficulty: 5, books: ["Fundamentos de Aerodinâmica (Anderson)"] },
  { name: "Aeroespacial · Termodinâmica Aplicada (Ciclos e Propulsão)", group: "aeroespacial", weight: 4, difficulty: 5 },
  { name: "Aeroespacial · Avionics (Eletrônica Embarcada)", group: "aeroespacial", weight: 4, difficulty: 5 },
  { name: "Aeroespacial · Controle e Navegação (GNC)", group: "aeroespacial", weight: 4, difficulty: 5 },
  { name: "Aeroespacial · Computação Científica (Python e C++)", group: "aeroespacial", weight: 4, difficulty: 4, books: ["Numerical Recipes", "Python for Data Analysis (McKinney)"] },

  /* Curso técnico */
  { name: "Técnico · Eletricidade Básica", group: "tecnico", weight: 3, difficulty: 3 },
  { name: "Técnico · Eletrônica Analógica", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Eletrônica Digital", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Instalações Elétricas Prediais", group: "tecnico", weight: 3, difficulty: 3 },
  { name: "Técnico · Desenho Técnico e CAD", group: "tecnico", weight: 2, difficulty: 3 },
  { name: "Técnico · Metrologia e Instrumentação", group: "tecnico", weight: 2, difficulty: 3 },
  { name: "Técnico · Robótica e Automação Industrial", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Mecânica dos Materiais", group: "tecnico", weight: 3, difficulty: 4 },
  { name: "Técnico · Segurança do Trabalho", group: "tecnico", weight: 2, difficulty: 2 },
  { name: "Técnico · Informática Aplicada", group: "tecnico", weight: 1, difficulty: 2 },
  { name: "Técnico · Empreendedorismo e Gestão", group: "tecnico", weight: 1, difficulty: 1 },

  /* Internacional — SAT/ACT e certificações de proficiência */
  { name: "SAT · Math", group: "internacional", weight: 5, difficulty: 4, books: ["The Official SAT Study Guide (College Board)", "PWN the SAT: Math Guide"] },
  { name: "SAT · Reading & Writing", group: "internacional", weight: 4, difficulty: 4, books: ["The Critical Reader (Erica Meltzer)"] },
  { name: "ACT · Science & Math", group: "internacional", weight: 3, difficulty: 4, books: ["The Official ACT Prep Guide"] },
  { name: "TOEFL/IELTS · Reading & Writing", group: "internacional", weight: 4, difficulty: 3, books: ["Official TOEFL iBT Tests (ETS)"] },
  { name: "TOEFL · Listening & Speaking", group: "internacional", weight: 3, difficulty: 3 },
  { name: "Inglês Acadêmico · Essay e Entrevistas", group: "internacional", weight: 4, difficulty: 3 }
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
      targetLevel: 4,
      createdAt: isoDaysAgo(110 - index)
    };
  });
}
