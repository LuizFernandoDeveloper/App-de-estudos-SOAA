import { useEffect, useState } from "react";
import {
  BrainCog,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  CornerDownRight,
  Flame,
  Gauge,
  NotebookPen,
  Play,
  RotateCcw,
  Square,
  Target,
  TimerReset,
  X
} from "lucide-react";
import { api } from "./api";
import {
  demoBrainDumps,
  demoPomodoroSessions,
  demoTimedboxes
} from "./demo";
import type {
  BrainDumpLog,
  EarlyExitReason,
  FocusGoalType,
  PomodoroSession,
  PomodoroSessionInput,
  SessionSummary,
  StudyMaterial,
  Subject,
  TimeboxSuggestion
} from "../shared/types";

const pad = (value: number) => String(value).padStart(2, "0");

const formatClock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const formatMinutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const EXIT_REASONS: Array<{ id: EarlyExitReason; label: string }> = [
  { id: "fadiga_metabolica", label: "Fadiga metabólica" },
  { id: "distracao_externa", label: "Distração externa" },
  { id: "dificuldade_materia", label: "Dificuldade da matéria" },
  { id: "meta_concluida", label: "Meta concluída antes do tempo" }
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  done: "Concluída",
  buffered: "Buffer"
};

const FOCUS_ZONES = [
  { id: "green", label: "Verde", hint: "Deep work concluído (≥100%) — regime de absorção plena." },
  { id: "amber", label: "Amarela", hint: "Bloqueio parcial (60–99%) — terminou abaixo do planejado." },
  { id: "red", label: "Vermelha", hint: "Crítico (<60%) — saída precoce; retome o tópico em breve." }
] as const;
type FocusZoneId = (typeof FOCUS_ZONES)[number]["id"];
const focusZoneOf = (rate: number): FocusZoneId => (rate >= 100 ? "green" : rate >= 60 ? "amber" : "red");


type SetupForm = {
  subjectId: number | null;
  goalType: FocusGoalType;
  goalText: string;
  materialId: number | null;
  pageStart: string;
  pageEnd: string;
  plannedMinutes: number;
};

const emptySetup = (suggestion: number): SetupForm => ({
  subjectId: null,
  goalType: "paginas",
  goalText: "",
  materialId: null,
  pageStart: "",
  pageEnd: "",
  plannedMinutes: suggestion
});

type SessionDraft = {
  subject: Subject;
  material: StudyMaterial | null;
  goalType: FocusGoalType;
  goalText: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  plannedMinutes: number;
  startedAt: string;
  elapsedSeconds: number;
  interrupts: number;
};

export function FocusTimerView({ subjects, materials, demo }: { subjects: Subject[]; materials: StudyMaterial[]; demo: boolean }) {
  const [form, setForm] = useState<SetupForm>(emptySetup(30));
  const [setupOpen, setSetupOpen] = useState(false);
  const [active, setActive] = useState<SessionDraft | null>(null);
  const [paused, setPaused] = useState(false);
  const [dumpOpen, setDumpOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [pendingExit, setPendingExit] = useState<EarlyExitReason | null>(null);
  const [mastery, setMastery] = useState(100);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [sessions, setSessions] = useState<PomodoroSession[]>(demo ? demoPomodoroSessions : []);
  const [dumps, setDumps] = useState<BrainDumpLog[]>(demo ? demoBrainDumps : []);
  const [suggestions, setSuggestions] = useState<TimeboxSuggestion[]>(demo ? demoTimedboxes : []);

  const suggestionFor = (subjectId: number) =>
    suggestions.find((s) => s.subjectId === subjectId);

  const selectSubject = (subjectId: number) => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    if (!demo && !suggestionFor(subjectId)) {
      api.getFocusTimebox(subjectId)
        .then((data) => setSuggestions((prev) => [...prev.filter((s) => s.subjectId !== subjectId), data]))
        .catch(() => void 0);
    }
    const next = suggestionFor(subjectId)?.suggestedMinutes ?? form.plannedMinutes;
    setForm((prev) => ({ ...emptySetup(next), subjectId }));
  };

  const startSession = () => {
    if (!form.subjectId) return;
    const subject = subjects.find((s) => s.id === form.subjectId);
    if (!subject) return;
    const material = form.materialId ? materials.find((m) => m.id === form.materialId) ?? null : null;
    setActive({
      subject,
      material,
      goalType: form.goalType,
      goalText: form.goalText.trim() || (form.goalType === "paginas"
        ? (form.pageStart && form.pageEnd ? `Ler pág. ${form.pageStart} a ${form.pageEnd}` : "Bloco de leitura")
        : form.goalType === "exercicios" ? "Lista de exercícios" : "Dominar tópico"),
      pageStart: form.pageStart ? Number(form.pageStart) : null,
      pageEnd: form.pageEnd ? Number(form.pageEnd) : null,
      plannedMinutes: Math.max(1, form.plannedMinutes),
      startedAt: new Date().toISOString().slice(0, 10),
      elapsedSeconds: 0,
      interrupts: 0
    });
    setSetupOpen(false);
    setPaused(false);
    setSummary(null);
  };

  useEffect(() => {
    if (!active || paused) return;
    const id = window.setInterval(() => {
      setActive((current) => current && current.elapsedSeconds >= current.plannedMinutes * 60
        ? current
        : current ? { ...current, elapsedSeconds: current.elapsedSeconds + 1 } : current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active !== null, paused]);

  useEffect(() => {
    if (!active) return;
    if (active.elapsedSeconds >= active.plannedMinutes * 60) {
      setMastery(100);
      setCompletionOpen(true);
    }
  }, [active?.elapsedSeconds]);

  const saveDump = () => {
    const note = draft.trim();
    if (!note) return;
    if (demo) {
      setDumps((prev) => [{ id: -(prev.length + 1), subjectId: active?.subject.id ?? null, subjectName: active?.subject.name ?? null, note, createdAt: new Date().toISOString() }, ...prev]);
    } else {
      api.logBrainDump({ subjectId: active?.subject.id ?? null, note })
        .then((record) => setDumps((prev) => [record, ...prev]))
        .catch(() => void 0);
    }
    setDraft("");
    setDumpOpen(false);
  };

  const finish = async (exitReason: EarlyExitReason | null) => {
    if (!active) return;
    const input: PomodoroSessionInput = {
      subjectId: active.subject.id,
      materialId: active.material?.id ?? null,
      goalType: active.goalType,
      goalText: active.goalText,
      pageStart: active.pageStart,
      pageEnd: active.pageEnd,
      plannedMinutes: active.plannedMinutes,
      elapsedMinutes: Math.min(active.plannedMinutes, Math.round(active.elapsedSeconds / 60) || 1),
      interrupts: active.interrupts,
      exitReason,
      completionPercentage: mastery,
      startedAt: active.startedAt
    };
    if (demo) {
      const subject = active.subject;
      const completed = input.elapsedMinutes >= input.plannedMinutes || exitReason === "meta_concluida";
      const session: PomodoroSession = {
        id: -(sessions.length + 1),
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color,
        materialId: input.materialId,
        materialTitle: active.material?.title ?? null,
        goalType: input.goalType,
        goalText: input.goalText,
        pageStart: input.pageStart,
        pageEnd: input.pageEnd,
        plannedMinutes: input.plannedMinutes,
        elapsedMinutes: input.elapsedMinutes,
        interrupts: input.interrupts,
        completionRate: Math.round(input.elapsedMinutes / input.plannedMinutes * 100),
        exitReason: input.exitReason,
        completed,
        status: completed ? "done" : "partial",
        completionPercentage: input.completionPercentage,
        startedAt: input.startedAt
      };
      setSessions((prev) => [session, ...prev]);
      setSummary({
        subjectId: subject.id,
        subjectName: subject.name,
        plannedMinutes: input.plannedMinutes,
        elapsedMinutes: input.elapsedMinutes,
        interrupts: input.interrupts,
        completionRate: session.completionRate,
        exitReason: input.exitReason,
        completionPercentage: input.completionPercentage,
        deepWork: completed && input.interrupts === 0 && input.exitReason === null,
        suggestedNext: input.plannedMinutes,
        suggestionReason: "Demonstração: a sustentação segura evolui o bloco em +5 min.",
        efficiencyGain: null
      });
    } else {
      try {
        const next = await api.completePomodoroSession(input);
        setSummary(next);
        setSessions(await api.listPomodoroSessions());
        api.getFocusTimebox(active.subject.id)
          .then((data) => setSuggestions((prev) => [...prev.filter((s) => s.subjectId !== active.subject.id), data]))
          .catch(() => void 0);
      } catch (error) {
        setSummary(null);
      }
    }
    setExitOpen(false);
    setCompletionOpen(false);
    setPendingExit(null);
    setActive(null);
  };

  const earlyExit = (reason: EarlyExitReason) => {
    setExitOpen(false);
    setPendingExit(reason);
    setMastery(Math.round(active ? Math.min(100, active.elapsedSeconds / (active.plannedMinutes * 60) * 100) : 100));
    setCompletionOpen(true);
  };

  const progress = active ? Math.min(100, (active.elapsedSeconds / (active.plannedMinutes * 60)) * 100) : 0;
  const radius = 108;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="page-stack">
      <section className="card focus-hero">
        <div>
          <p className="eyebrow">Motor Pomodoro de Escalonamento Atencional</p>
          <h2>Deep work com sobrecarga progressiva.</h2>
          <p>Vincule o bloco a uma meta micro-direcionada (páginas, tópico ou exercícios) e evolua o timebox inspirado no seu histórico de resistência atencional.</p>
        </div>
        <button className="button primary" onClick={() => { setSetupOpen(true); setSummary(null); }}><Play size={17} /> Novo bloco de foco</button>
      </section>

      {summary && (
        <section className="card focus-summary">
          <div className="section-heading"><div><p className="eyebrow">Fechamento cognitivo</p><h2>Bloco concluído</h2></div><CheckCircle2 size={20} /></div>
          <div className="focus-summary-row">
            <span><Target size={16} /> {summary.subjectName.split("·")[0].trim()} · {formatMinutes(summary.elapsedMinutes)} de {formatMinutes(summary.plannedMinutes)} planejados ({summary.completionRate}%)</span>
            <span><Gauge size={16} /> Próximo timebox sugerido: <strong>{summary.suggestedNext} min</strong></span>
          </div>
          <p className="cogn-footnote">{summary.suggestionReason}</p>
          {summary.deepWork && <div className="cog-badge hot"><Flame size={14} /> Deep work sem interrupções — janela sustentada do início ao fim.</div>}
          {summary.efficiencyGain && <div className="cog-alert success"><CornerDownRight size={16} /><div><strong>Ganho de eficiência registrado.</strong><span>{summary.efficiencyGain}</span></div></div>}
        </section>
      )}

      <section className="metric-grid">
        <div className="card metric"><Target size={18} /><div><strong>{sessions.length}</strong><span>blocos de foco</span></div></div>
        <div className="card metric"><Flame size={18} /><div><strong>{sessions.filter((s) => s.status === "done").length}</strong><span>concluídos em deep work</span></div></div>
        <div className="card metric"><TimerReset size={18} /><div><strong>{(sessions.filter((s) => s.status === "partial").length)}</strong><span>saídas precoces</span></div></div>
        <div className="card metric"><NotebookPen size={18} /><div><strong>{dumps.length}</strong><span>capturas externas</span></div></div>
      </section>

      {sessions.length > 0 && (
        <section className="card table-card">
          <div className="section-heading"><div><p className="eyebrow">Histórico de foco</p><h2>Sessões registradas</h2></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Matéria · meta</th><th>Status</th><th>Planejado</th><th>Executado</th><th>% bloqueio</th><th>Motivo</th></tr></thead>
            <tbody>
              {sessions.slice(0, 20).map((session) => (
                <tr key={session.id}>
                  <td><span className="subject-cell"><span className="color-dot" style={{ background: `var(--${session.color})` }} />{session.subjectName.split("·")[0].trim()}{session.materialTitle ? <em className="muted-text"> · {session.materialTitle}</em> : null}<span className="muted-text"> — {session.goalText}</span></span></td>
                  <td><span className={`focus-status ${session.status}`}>{STATUS_LABEL[session.status]}</span></td>
                  <td>{formatMinutes(session.plannedMinutes)}</td>
                  <td>{formatMinutes(session.elapsedMinutes)}</td>
                  <td><span className={session.completionRate >= 100 ? "good" : session.completionRate >= 60 ? "needs-work" : "muted-text"}>{session.completionRate}%</span></td>
                  <td>{session.exitReason ? EXIT_REASONS.find((r) => r.id === session.exitReason)?.label : <span className="muted-text">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}

      {dumps.length > 0 && (
        <section className="card">
          <div className="section-heading"><div><p className="eyebrow">Descarga da DMN</p><h2>Captura externa</h2></div><BrainCog size={20} /></div>
          <div className="dump-list">
            {dumps.slice(0, 8).map((dump) => (
              <div key={dump.id} className="dump-item">
                <NotebookPen size={15} />
                <div><p>{dump.note}</p><span className="muted-text">{dump.subjectName ?? "Sem matéria"} · {new Date(dump.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {setupOpen && !active && (
        <div className="modal-backdrop" onClick={() => setSetupOpen(false)}>
          <div className="modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">PomodoroSetup · WBS & Closure</p><h2>Configurar bloco de foco</h2></div><button className="icon-button" onClick={() => setSetupOpen(false)}><X size={17} /></button></div>
            <div className="modal-body focus-setup">
              <label className="field-label">Matéria</label>
              <div className="subject-grid">
                {subjects.map((subject) => (
                  <button key={subject.id} className={`subject-tile ${form.subjectId === subject.id ? "active" : ""}`} style={{ borderColor: form.subjectId === subject.id ? `var(--${subject.color})` : undefined }} onClick={() => selectSubject(subject.id)}>
                    <span className="color-dot" style={{ background: `var(--${subject.color})` }} />
                    {subject.name.split("·")[0].trim()}
                    {suggestionFor(subject.id) && <small>{suggestionFor(subject.id)!.suggestedMinutes} min</small>}
                  </button>
                ))}
              </div>
              {form.subjectId && suggestionFor(form.subjectId) && (
                <div className="cog-alert"><Gauge size={16} /><div><strong>Sugestão de sobrecarga progressiva:</strong><span>{suggestionFor(form.subjectId)!.reason}</span></div></div>
              )}
              <div className="field-row">
                <label className="field-label">Tipo de meta</label>
                <div className="segmented">
                  {(["paginas", "topicos", "exercicios"] as FocusGoalType[]).map((type) => (
                    <button key={type} className={form.goalType === type ? "active" : ""} onClick={() => setForm((prev) => ({ ...prev, goalType: type }))}>{type === "paginas" ? "Páginas" : type === "topicos" ? "Tópicos" : "Exercícios"}</button>
                  ))}
                </div>
              </div>
              {form.goalType === "paginas" && (
                <div className="field-row">
                  <label className="field-label">Livro / material</label>
                  <select className="input" value={form.materialId ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, materialId: event.target.value ? Number(event.target.value) : null }))}>
                    <option value="">Sem material vinculado</option>
                    {materials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}
                  </select>
                  <div className="page-range-inputs">
                    <input className="input" type="number" min={0} placeholder="pág. inicial" value={form.pageStart} onChange={(event) => setForm((prev) => ({ ...prev, pageStart: event.target.value }))} />
                    <span>→</span>
                    <input className="input" type="number" min={0} placeholder="pág. final" value={form.pageEnd} onChange={(event) => setForm((prev) => ({ ...prev, pageEnd: event.target.value }))} />
                  </div>
                </div>
              )}
              <div className="field-row">
                <label className="field-label">{form.goalType === "paginas" ? "Objetivo do bloco" : form.goalType === "exercicios" ? "Quantidade de exercícios" : "Tópico específico"}</label>
                <input className="input" placeholder={form.goalType === "exercicios" ? "ex: Resolver 15 exercícios de Cinemática" : "ex: Ler pág. 40 a 55"} value={form.goalText} onChange={(event) => setForm((prev) => ({ ...prev, goalText: event.target.value }))} />
              </div>
              <div className="field-row">
                <label className="field-label">Tempo do bloco — <strong>{form.plannedMinutes} min</strong></label>
                <input className="range" type="range" min={15} max={120} step={5} value={Math.min(120, Math.max(15, form.plannedMinutes))} onChange={(event) => setForm((prev) => ({ ...prev, plannedMinutes: Number(event.target.value) }))} />
              </div>
              <button className="button primary full" onClick={startSession}><Play size={17} /> Iniciar timebox de {form.plannedMinutes} min</button>
            </div>
          </div>
        </div>
      )}

      {active && (
        <section className="card focus-active">
          <div className="focus-timer-wrap">
            <div className="timer-ring" style={{ background: `conic-gradient(var(--${active.subject.color}) ${progress}%, #1b2b42 ${progress}% 100%)` }}>
              <div className="timer-ring-inner">
                <span className="timer-target">{active.subject.name.split("·")[0].trim()}</span>
                <strong className="timer-clock">{formatClock(Math.max(0, active.plannedMinutes * 60 - active.elapsedSeconds))}</strong>
                <span className="timer-goal">{active.goalText}</span>
              </div>
            </div>
          </div>
          <div className="focus-controls">
            <button className="button ghost" onClick={() => setDumpOpen(true)}><NotebookPen size={16} /> Captura rápida</button>
            <button className="button ghost" onClick={() => setActive((current) => current ? { ...current, interrupts: current.interrupts + 1 } : current)}>Interrupção involuntária ({active.interrupts})</button>
            <button className="button" onClick={() => setPaused((value) => !value)}>{paused ? <CirclePlay size={16} /> : <CirclePause size={16} />} {paused ? "Retomar" : "Pausar"}</button>
            <button className="button danger" onClick={() => setExitOpen(true)}><Square size={16} /> Saída precoce</button>
          </div>
        </section>
      )}

      {dumpOpen && active && (
        <div className="modal-backdrop dump-backdrop" onClick={() => setDumpOpen(false)}>
          <div className="modal panel brain-dump" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">Captura externa · sem pausar o timer</p><h2>Descarregue e volte</h2></div><button className="icon-button" onClick={() => setDumpOpen(false)}><X size={17} /></button></div>
            <div className="modal-body">
              <textarea className="input dump-textarea" autoFocus placeholder="Pensamento intrusivo, lembrete ou ideia paralela…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); saveDump(); } }} />
              <p className="cogn-footnote">Registrar aqui descarrega a memória de trabalho e reduz a atividade da Rede de Modo Padrão. As notas vão para a caixa de entrada da Biblioteca.</p>
              <button className="button primary full" onClick={saveDump}><RotateCcw size={16} /> Registrar e voltar ao foco (Ctrl+Enter)</button>
            </div>
          </div>
        </div>
      )}

      {exitOpen && active && (
        <div className="modal-backdrop" onClick={() => setExitOpen(false)}>
          <div className="modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">Saída precoce · resistência atencional</p><h2>Por que você encerrou?</h2></div><button className="icon-button" onClick={() => setExitOpen(false)}><X size={17} /></button></div>
            <div className="modal-body">
              <div className="reason-grid">
                {EXIT_REASONS.map((reason) => (
                  <button key={reason.id} className="reason-option" onClick={() => earlyExit(reason.id)}>{reason.label}</button>
                ))}
              </div>
              <p className="cogn-footnote">O tempo líquido focado é salvo. O motivo alimenta o mapa de queda de performance e a regressão tática do próximo timebox.</p>
            </div>
          </div>
        </div>
      )}

      {completionOpen && active && (
        <div className="modal-backdrop" onClick={() => setCompletionOpen(false)}>
          <div className="modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">TaskCompletionSlider · fechamento cognitivo</p><h2>Quanto você dominou do tópico?</h2></div><button className="icon-button" onClick={() => setCompletionOpen(false)}><X size={17} /></button></div>
            <div className="modal-body focus-setup">
              <div className="mastery-value">{mastery}%</div>
              <input className="range" type="range" min={0} max={100} step={5} value={mastery} onChange={(event) => setMastery(Number(event.target.value))} />
              <p className="cogn-footnote">Registrar o domínio real (não o tempo) força o Closure: encerra o loop cognitivo do tópico e alimenta a velocidade de aprendizagem por página/questão.</p>
              <div className="field-row">
                <label className="field-label">Executado neste bloco</label>
                <span className="muted-text">{formatMinutes(Math.min(active.plannedMinutes, Math.max(1, Math.round(active.elapsedSeconds / 60))))} de {formatMinutes(active.plannedMinutes)} planejados · {active.interrupts} interrupções</span>
              </div>
              <button className="button primary full" onClick={() => finish(pendingExit)}><CheckCircle2 size={17} /> Fechar bloco</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}