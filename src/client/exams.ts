import type { ExamTrack } from "../shared/types";

/* Curadoria de provas oficiais por trilha — só fontes institucionais
   (INEP, FUVEST, ITA, IME, College Board). Links verificados; a Central
   de simulados monta o cronômetro e o registro de acurácia em cima. */

export type ExamLink = {
  id: string;
  name: string;
  org: string;
  note: string;
  url: string;
};

export const EXAM_LINKS: Record<ExamTrack, ExamLink[]> = {
  "Ensino Médio": [],
  ENEM: [
    {
      id: "enem-inep-provas",
      name: "ENEM · Provas e gabaritos",
      org: "INEP",
      note: "Todas as edições do ENEM em PDF, com gabaritos oficiais.",
      url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
    }
  ],
  "CEFET-MG": [
    { id: "cefetmg-acervo", name: "CEFET-MG · Processos anteriores", org: "COPEVE", note: "Cadernos, gabaritos e editais por modalidade e ano.", url: "https://www.copeve.cefetmg.br/processosanteriores" }
  ],
  IFMG: [
    { id: "ifmg-acervo", name: "IFMG · Processos anteriores", org: "IFMG", note: "Provas, gabaritos e editais; escolha o nível, campus e curso correspondentes.", url: "https://www.ifmg.edu.br/portal/processo-seletivo/processos-seletivos-anteriores-1" },
    { id: "ifmg-betim-ingresso", name: "IFMG Campus Betim · Ingresso", org: "IFMG Betim", note: "Modalidades de ingresso e provas antigas para o Campus Betim.", url: "https://www.ifmg.edu.br/betim/ingresso/exame-de-selecao-e-vestibular" }
  ],
  "PUC Minas (Betim)": [
    { id: "pucminas-betim-provas", name: "PUC Minas · Provas e gabaritos", org: "PUC Minas", note: "Selecione Betim e o curso; Medicina usa cadernos próprios.", url: "https://www.pucminas.br/formas-ingresso/vestibular/Paginas/provas-e-gabaritos.aspx" }
  ],
  FUVEST: [
    {
      id: "fuvest-acervo",
      name: "FUVEST · Acervo de provas",
      org: "FUVEST",
      note: "Provas e gabaritos de todas as edições do vestibular da USP, por ano e fase.",
      url: "https://www.fuvest.br/acervo/"
    }
  ],
  UNICAMP: [
    { id: "unicamp-acervo", name: "UNICAMP · Vestibulares anteriores", org: "COMVEST", note: "Cadernos e gabaritos oficiais por edição e fase.", url: "https://www.comvest.unicamp.br/vestibulares-anteriores/" }
  ],
  ITA: [
    {
      id: "ita-provas-anteriores",
      name: "ITA · Vestibulares anteriores",
      org: "ITA",
      note: "Provas anteriores do vestibular do ITA em PDF, por ano e fase.",
      url: "https://www.vestibular.ita.br/provas.htm"
    }
  ],
  IME: [
    {
      id: "ime-provas-anteriores",
      name: "IME · Concurso de admissão",
      org: "IME",
      note: "Provas anteriores do concurso de admissão, no portal oficial do IME.",
      url: "https://vestibular.ime.eb.br/cfg/"
    }
  ],
  "QVest / outro": [],
  Internacional: [
    {
      id: "sat-paper-tests",
      name: "SAT · Provas completas em papel",
      org: "College Board",
      note: "Practice tests oficiais do SAT e PSAT para baixar e simular em papel.",
      url: "https://satsuite.collegeboard.org/practice/practice-tests/paper"
    }
  ],
  Personalizado: []
};

export const examLinksFor = (track: ExamTrack): ExamLink[] => EXAM_LINKS[track] ?? [];
