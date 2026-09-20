import { useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Gauge,
  Minus,
  Plus,
  Save,
  Target,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import { api } from "./api";
import type {
  DashboardData,
  StudyMaterial,
  Subject,
  Topic,
  TopicStatus
} from "../shared/types";

const HEX: Record<string, string> = {
  indigo: "#818cf8", violet: "#a78bfa", cyan: "#22d3ee", pink: "#f472b6",
  amber: "#fbbf24", emerald: "#34d399", orange: "#fb923c", blue: "#60a5fa"
};
const colorOf = (name: string) => HEX[name] ?? HEX.blue;
const STATUS_ORDER: TopicStatus[] = ["pendente", "em_andamento", "concluido"];
const STATUS_LABEL: Record<TopicStatus, string> = { pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído" };
const nextStatus = (status: TopicStatus): TopicStatus => STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
const roundPct = (value: number) => `${Math.round(value)}%`;

export function AdvancementView({ subjects, topics, materials, dashboard, onChanged, demo }: { subjects: Subject[]; topics: Topic[]; materials: StudyMaterial[]; dashboard: DashboardData | null; onChanged: () => Promise<void>; demo: boolean }) {
  const accuracyById = new Map((dashboard?.subjectPerformance ?? []).map((item) => [item.subjectId, item.accuracy]));
  return <div className="page-stack">
    <section className="card advance-hero" style={{ background: `linear-gradient(120deg, #16294a, #1c1440)` }}><div><p className="eyebrow">Meta, conteúdo e leitura</p><h2>Acompanhe o avanço de cada matéria.</h2><p>Defina a meta de acerto e a cobertura de tópicos desejada, organize os tópicos do edital e empurre as páginas do livro conforme lê. O sistema marca materiais concluídos sozinho ao atingir a última página.</p></div><TrendingUp size={30} /></section>
    {subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} topics={topics.filter((topic) => topic.subjectId === subject.id)} materials={materials.filter((material) => material.subjectId === subject.id)} accuracy={accuracyById.get(subject.id) ?? null} onChanged={onChanged} demo={demo} />)}
    {!subjects.length && <section className="card"><div className="empty-state"><div><Target size={24} /></div><p>Cadastre matérias na Matriz de priorização para começar a acompanhar o avanço.</p></div></section>}
  </div>;
}

function SubjectCard({ subject, topics, materials, accuracy, onChanged, demo }: { subject: Subject; topics: Topic[]; materials: StudyMaterial[]; accuracy: number | null; onChanged: () => Promise<void>; demo: boolean }) {
  const [goalDraft, setGoalDraft] = useState({ accuracy: subject.goalAccuracy, coverage: subject.goalCoverage });
  const [newTopic, setNewTopic] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);

  const done = topics.filter((topic) => topic.status === "concluido").length;
  const coverage = topics.length ? done / topics.length * 100 : 0;
  const topicsOnTrack = coverage >= subject.goalCoverage;
  const accuracyOnTrack = accuracy !== null && accuracy >= subject.goalAccuracy;
  const readPages = materials.reduce((sum, material) => sum + material.currentPage, 0);
  const totalPages = materials.reduce((sum, material) => sum + material.totalPages, 0);
  const pagesProgress = totalPages ? Math.min(100, readPages / totalPages * 100) : null;

  const saveGoals = async () => {
    setSavingGoals(true);
    try {
      if (!demo) await api.updateSubjectGoals(subject.id, { goalAccuracy: goalDraft.accuracy, goalCoverage: goalDraft.coverage });
      await onChanged();
    } catch (error) {
      window.alert(String(error));
    } finally {
      setSavingGoals(false);
    }
  };

  const cycleTopic = async (topic: Topic) => {
    try {
      if (!demo) await api.updateTopic(topic.id, { subjectId: topic.subjectId, name: topic.name, status: nextStatus(topic.status) });
      await onChanged();
    } catch (error) {
      window.alert(String(error));
    }
  };

  const deleteTopic = async (topic: Topic) => {
    if (!window.confirm(`Remover o tópico "${topic.name}"?`)) return;
    try {
      if (!demo) await api.deleteTopic(topic.id);
      await onChanged();
    } catch (error) {
      window.alert(String(error));
    }
  };

  const addTopic = async (event: FormEvent) => {
    event.preventDefault();
    const name = newTopic.trim();
    if (!name) return;
    try {
      if (!demo) await api.createTopic({ subjectId: subject.id, name, status: "pendente" });
      setNewTopic("");
      await onChanged();
    } catch (error) {
      window.alert(String(error));
    }
  };

  const stepPage = async (material: StudyMaterial, delta: number) => {
    const next = Math.max(0, Math.min(material.totalPages || material.currentPage + delta, material.currentPage + delta));
    if (next === material.currentPage) return;
    try {
      if (!demo) await api.updateMaterialPage(material.id, next);
      await onChanged();
    } catch (error) {
      window.alert(String(error));
    }
  };

  return <section className="card subject-advance">
    <div className="advance-head">
      <div className="advance-title"><span className="color-dot" style={{ background: colorOf(subject.color) }} /><div><h2>{subject.name}</h2><span>IP {subject.computedIp} · {topics.length} tópicos · {materials.length} materiais</span></div></div>
      <div className="advance-pills">
        <span className={`advance-pill ${accuracyOnTrack ? "on" : "off"}`} title={`Meta de acerto: ${subject.goalAccuracy}%`}>{accuracy ?? 0}% acerto</span>
        <span className={`advance-pill ${topicsOnTrack ? "on" : "off"}`} title={`Meta de cobertura: ${subject.goalCoverage}%`}>{roundPct(coverage)} tópicos</span>
      </div>
    </div>

    <div className="advance-goals">
      <label>Meta de acerto (%)<input type="number" min="0" max="100" value={goalDraft.accuracy} onChange={(event) => setGoalDraft({ ...goalDraft, accuracy: Number(event.target.value) })} /></label>
      <label>Meta de cobertura (%)<input type="number" min="0" max="100" value={goalDraft.coverage} onChange={(event) => setGoalDraft({ ...goalDraft, coverage: Number(event.target.value) })} /></label>
      <button className="button secondary" onClick={() => void saveGoals()} disabled={savingGoals}><Save size={15} /> Salvar metas</button>
    </div>

    <div className="advance-track">
      <div className="advance-track-cell"><span>Leitura</span><div className="progress-bar"><i style={{ width: `${pagesProgress ?? 0}%`, background: colorOf(subject.color) }} /></div><small>{pagesProgress === null ? `${readPages} páginas` : `${readPages} / ${totalPages} págs · ${roundPct(pagesProgress)}`}</small></div>
      <div className="advance-track-cell"><span>Tópicos do edital</span><div className="progress-bar"><i style={{ width: `${coverage}%`, background: "#34d399" }} /></div><small>{done} / {topics.length} concluídos · {roundPct(coverage)}</small></div>
    </div>

    {materials.some((material) => material.totalPages > 0) && <div className="page-ruler-block">
      <div className="page-ruler" role="img" aria-label="Régua de páginas por livro — extensão proporcional ao tamanho de cada obra">
        {materials.filter((material) => material.totalPages > 0).map((material) => {
          const share = totalPages ? material.totalPages / totalPages * 100 : 0;
          const fill = material.totalPages ? Math.min(100, material.currentPage / material.totalPages * 100) : 0;
          return <div key={material.id} className="page-ruler-seg" style={{ width: `${share}%` }} title={`${material.title} — ${material.currentPage}/${material.totalPages} págs (${roundPct(fill)} da obra)`}><i style={{ width: `${fill}%`, background: colorOf(subject.color) }} /><b>{Math.round(share)}%</b></div>;
        })}
      </div>
      <div className="page-ruler-legend">{materials.filter((material) => material.totalPages > 0).map((material) => { const fill = material.totalPages ? material.currentPage / material.totalPages : 0; return <span key={material.id}><i style={{ background: colorOf(subject.color), opacity: Math.max(0.25, fill) }} />{material.title}<b>{material.currentPage}/{material.totalPages}</b></span>; })}</div>
    </div>}

    <div className="advance-topics">
      <div className="advance-block-title"><span>Tópicos</span><form className="topic-add" onSubmit={addTopic}><input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} placeholder="Novo tópico (ex.: Logaritmos)" /><button className="button secondary" type="submit" title="Adicionar tópico"><Plus size={15} /> Adicionar</button></form></div>
      <div className="topic-chips">
        {topics.map((topic) => <span key={topic.id} className={`topic-chip ${topic.status}`} onClick={() => void cycleTopic(topic)} title="Clique para avançar o status: pendente → em andamento → concluído">{topic.status === "concluido" && <CheckCircle2 size={13} />}{topic.name}<span className="topic-chip-status">{STATUS_LABEL[topic.status]}</span><button type="button" className="icon-button danger" title="Remover tópico" onClick={(event) => { event.stopPropagation(); void deleteTopic(topic); }}><X size={13} /></button></span>)}
        {!topics.length && <span className="no-topics">Nenhum tópico ainda — cadastre o edital para usar a cobertura como meta.</span>}
      </div>
    </div>

    {materials.length ? <div className="advance-materials">
      <div className="advance-block-title"><span>Materiais e páginas</span></div>
      {materials.map((material) => <div className="material-page-row" key={material.id}><BookOpen size={16} /><div className="material-page-info"><strong>{material.title}</strong><span>{material.category}</span></div><div className="material-page-track"><div className="progress-inline"><span style={{ width: `${material.totalPages ? Math.min(100, material.currentPage / material.totalPages * 100) : 0}%`, background: colorOf(subject.color) }} /></div><small>{material.currentPage} / {material.totalPages} pág</small></div><div className="page-stepper"><button className="icon-button" title="Voltar 5 páginas" onClick={() => void stepPage(material, -5)}><Minus size={15} /></button><button className="icon-button" title="Avançar 5 páginas" onClick={() => void stepPage(material, 5)}><Plus size={15} /></button></div></div>)}
    </div> : <p className="form-hint">Sem materiais vinculados ainda — cadastre livros na Biblioteca e associe ao tópico correto.</p>}
  </section>;
}