import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, BellRing, CheckCircle2, CirclePause, CirclePlay, Coffee, RotateCcw, Square, Timer, Zap } from "lucide-react";
import { api } from "./api";
import { PomodoroAnalyticsView } from "./pomodoroMetrics";
import { COURSE_GOALS, EXAM_GUIDES } from "./catalog";
import type { CognitiveMode, ExamTrack, FocusSessionInput, Subject } from "../shared/types";

type PomodoroSettings = { focus: number; shortBreak: number; longBreak: number; longEvery: number };
type Phase = "focus" | "short_break" | "long_break";
const DEFAULTS: PomodoroSettings = { focus: 25, shortBreak: 5, longBreak: 15, longEvery: 4 };
const SETTINGS_KEY = "soaa.pomodoro.settings.v1";
const SUBJECT_MODE_KEY = "soaa.pomodoro.subject-modes.v1";
const COGNITIVE_LABELS: Record<CognitiveMode, string> = {
  general: "Estudo geral",
  problem_solving: "Raciocínio e resolução",
  retrieval: "Recordação ativa",
  conceptual_reading: "Leitura conceitual",
  writing: "Escrita e argumentação",
  mixed_questions: "Questões mistas e interpretação"
};
const defaultCognitiveMode = (track: ExamTrack): CognitiveMode => {
  if (track === "ITA" || track === "IME") return "problem_solving";
  if (track === "ENEM" || track === "CEFET-MG" || track === "IFMG") return "mixed_questions";
  if (track === "FUVEST" || track === "UNICAMP" || track === "PUC Minas (Betim)") return "writing";
  return "retrieval";
};
const readSubjectModes = (): Record<string, CognitiveMode> => {
  try { return JSON.parse(localStorage.getItem(SUBJECT_MODE_KEY) ?? "{}") as Record<string, CognitiveMode>; }
  catch { return {}; }
};
const readSettings = (): PomodoroSettings => {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<PomodoroSettings> | null;
    return {
      focus: Math.max(5, Math.min(90, Number(value?.focus) || DEFAULTS.focus)),
      shortBreak: Math.max(1, Math.min(30, Number(value?.shortBreak) || DEFAULTS.shortBreak)),
      longBreak: Math.max(5, Math.min(60, Number(value?.longBreak) || DEFAULTS.longBreak)),
      longEvery: Math.max(2, Math.min(8, Number(value?.longEvery) || DEFAULTS.longEvery))
    };
  } catch { return DEFAULTS; }
};
const pad = (value: number) => String(value).padStart(2, "0");
const clock = (seconds: number) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

export function PomodoroTimerView({ subjects, demo, examTrack, preferredCourse, focusArea, onRecordQuestions, onOpenMetrics, onSessionSaved }: {
  subjects: Subject[];
  demo: boolean;
  examTrack: ExamTrack;
  preferredCourse: string | null;
  focusArea: string | null;
  onRecordQuestions: (subjectId: number) => void;
  onOpenMetrics: () => void;
  onSessionSaved: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<PomodoroSettings>(readSettings);
  const [subjectId, setSubjectId] = useState<number | null>(subjects[0]?.id ?? null);
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [interrupts, setInterrupts] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [subjectModes, setSubjectModes] = useState<Record<string, CognitiveMode>>(readSubjectModes);
  const [cognitiveMode, setCognitiveMode] = useState<CognitiveMode>(() => defaultCognitiveMode(examTrack));
  const deadline = useRef<number | null>(null);
  const savingGuard = useRef(false);
  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? null;

  useEffect(() => {
    if (!subjects.length) { setSubjectId(null); return; }
    if (!subjects.some((subject) => subject.id === subjectId)) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(SUBJECT_MODE_KEY, JSON.stringify(subjectModes)); }, [subjectModes]);
  useEffect(() => {
    if (subjectId !== null) setCognitiveMode(subjectModes[String(subjectId)] ?? defaultCognitiveMode(examTrack));
  }, [subjectId, examTrack, subjectModes]);

  useEffect(() => {
    if (!running || deadline.current === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setRunning(false);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const begin = () => {
    if (phase === "focus" && !subjectId) return;
    const remainingToRun = phase === "focus" && !startedAt ? settings.focus * 60 : remaining;
    if (phase === "focus" && !startedAt) {
      setStartedAt(new Date().toISOString());
      setInterrupts(0);
      setMessage("");
      setRemaining(remainingToRun);
    }
    deadline.current = Date.now() + remainingToRun * 1000;
    setRunning(true);
  };

  const saveCycle = async (completed: boolean, elapsedOverride?: number) => {
    if (savingGuard.current || !selectedSubject || !startedAt) return;
    savingGuard.current = true;
    setSaving(true);
    const elapsedSeconds = completed ? settings.focus * 60 : Math.max(0, elapsedOverride ?? (settings.focus * 60 - remaining));
    const elapsedMinutes = Math.max(1, Math.min(settings.focus, Math.round(elapsedSeconds / 60)));
    const grossMinutes = Math.max(elapsedMinutes, Math.min(1_440, Math.round((Date.now() - Date.parse(startedAt)) / 60_000)));
    const input: FocusSessionInput = {
      subjectId: selectedSubject.id,
      materialId: null,
      focusMode: "pomodoro",
      cognitiveMode,
      goalType: "topicos",
      goalText: goal.trim() || "Ciclo Pomodoro",
      pageStart: null,
      pageEnd: null,
      plannedMinutes: settings.focus,
      elapsedMinutes,
      grossMinutes,
      interrupts,
      exitReason: null,
      completionPercentage: Math.min(100, elapsedMinutes / settings.focus * 100),
      startedAt
    };
    try {
      if (!demo) await api.completeFocusSession(input);
      setSavedCount((count) => count + 1);
      try { await onSessionSaved(); } catch { /* O ciclo já foi gravado; a atualização de painéis pode ser retomada depois. */ }
      setStartedAt(null);
      setMessage(completed
        ? `Ciclo salvo no histórico para ${selectedSubject.name.split("·")[0].trim()}.`
        : `Bloco parcial de ${elapsedMinutes} min salvo para ${selectedSubject.name.split("·")[0].trim()}.`);
      if (completed) {
        const nextCycles = cycles + 1;
        setCycles(nextCycles);
        const nextPhase: Phase = nextCycles % settings.longEvery === 0 ? "long_break" : "short_break";
        setPhase(nextPhase);
        setRemaining((nextPhase === "long_break" ? settings.longBreak : settings.shortBreak) * 60);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Pomodoro concluído", { body: `Hora de uma pausa de ${nextPhase === "long_break" ? settings.longBreak : settings.shortBreak} minutos.` });
        }
      } else {
        setPhase("focus");
        setRemaining(settings.focus * 60);
      }
    } catch (error) {
      setMessage(`Não foi possível salvar no banco: ${String(error)}`);
    } finally {
      savingGuard.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!running && phase === "focus" && remaining === 0 && startedAt && !savingGuard.current) {
      void saveCycle(true);
    }
    // A conclusão automática depende apenas do estado do ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, remaining, startedAt]);

  useEffect(() => {
    if (!running && phase !== "focus" && remaining === 0) {
      setPhase("focus");
      setRemaining(settings.focus * 60);
      setMessage("Pausa concluída. Quando estiver pronto, inicie o próximo ciclo.");
    }
  }, [running, phase, remaining, settings.focus]);

  const pause = () => {
    if (deadline.current !== null) setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    deadline.current = null;
    setRunning(false);
  };

  const stop = () => {
    const actualRemaining = running && deadline.current !== null
      ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
      : remaining;
    deadline.current = null;
    setRemaining(actualRemaining);
    setRunning(false);
    const elapsedSeconds = Math.max(0, settings.focus * 60 - actualRemaining);
    if (startedAt && elapsedSeconds > 0) void saveCycle(false, elapsedSeconds);
    else {
      setStartedAt(null);
      setPhase("focus");
      setRemaining(settings.focus * 60);
    }
  };

  const changeSettings = (key: keyof PomodoroSettings, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "focus" && !running && phase === "focus" && !startedAt) setRemaining(value * 60);
  };

  const duration = phase === "focus" ? settings.focus : phase === "long_break" ? settings.longBreak : settings.shortBreak;
  const progress = duration > 0 ? ((duration * 60 - remaining) / (duration * 60)) * 100 : 0;
  const phaseLabel = phase === "focus" ? "FOCO" : phase === "long_break" ? "PAUSA LONGA" : "PAUSA CURTA";
  const examGuide = EXAM_GUIDES[examTrack];
  const course = COURSE_GOALS.find((candidate) => candidate.id === preferredCourse);

  return <div className="page-stack pomodoro-page">
    <section className="card pomodoro-hero">
      <div><p className="eyebrow">Ciclos locais · histórico no SQLite</p><h2>Pomodoro conectado ao seu estudo.</h2><p>Associe cada ciclo a uma matéria e objetivo. Conclusões, blocos parciais, duração e interrupções alimentam a aba de métricas e o ranking.</p></div>
      <button className="button secondary" onClick={onOpenMetrics}><BarChart3 size={17} /> Abrir métricas</button>
    </section>

    <section className="pomodoro-layout">
      <article className="card pomodoro-clock-card">
        <div className={`pomodoro-phase ${phase}`}><span className="pomodoro-phase-dot" />{phaseLabel}</div>
        <div className="pomodoro-ring" style={{ background: `conic-gradient(${phase === "focus" ? "#8b7cf6" : "#43d4a1"} ${progress}%, #1b2b42 ${progress}% 100%)` }}>
          <div className="pomodoro-ring-inner"><strong>{clock(remaining)}</strong><span>{phase === "focus" ? selectedSubject?.name.split("·")[0].trim() ?? "Escolha uma matéria" : "Descanse e volte"}</span><small>{phase === "focus" ? (goal.trim() || "Ciclo de estudo") : "Pausa entre ciclos"}</small></div>
        </div>
        <div className="pomodoro-actions">
          {!running ? <button className="button primary" onClick={begin} disabled={saving || (phase === "focus" && !subjectId)}><CirclePlay size={17} /> {remaining === duration * 60 ? "Iniciar" : "Continuar"}</button> : <button className="button secondary" onClick={pause}><CirclePause size={17} /> Pausar</button>}
          {phase === "focus" && startedAt && <>
            <button className="button ghost" onClick={() => setInterrupts((value) => value + 1)} disabled={saving}><Activity size={16} /> Interrupção ({interrupts})</button>
            <button className="button danger" onClick={stop} disabled={saving}><Square size={15} /> Salvar parcial</button>
          </>}
          {phase !== "focus" && !running && <button className="button ghost" onClick={() => { setPhase("focus"); setRemaining(settings.focus * 60); setStartedAt(null); }}><RotateCcw size={15} /> Pular pausa</button>}
          {phase === "focus" && remaining === 0 && startedAt && !saving && <button className="button primary" onClick={() => void saveCycle(true)}><CheckCircle2 size={16} /> Salvar ciclo</button>}
        </div>
        {message && <div className={`pomodoro-message ${message.startsWith("Não") ? "error" : "success"}`} role="status">{message}</div>}
        {savedCount > 0 && <div className="pomodoro-post-session"><span><CheckCircle2 size={16} /> {savedCount} ciclo{savedCount === 1 ? "" : "s"} salvo{savedCount === 1 ? "" : "s"} nesta sessão do app.</span><button className="button ghost" onClick={() => selectedSubject && onRecordQuestions(selectedSubject.id)} disabled={!selectedSubject}>Registrar questões da matéria</button></div>}
      </article>

      <aside className="card pomodoro-settings">
        <div className="section-heading"><div><p className="eyebrow">Configuração</p><h2>Ritmo do ciclo</h2></div><Timer size={20} /></div>
        <label>Matéria para este ciclo<select value={subjectId ?? ""} onChange={(event) => setSubjectId(event.target.value ? Number(event.target.value) : null)} disabled={running || Boolean(startedAt)}><option value="">Selecione a matéria</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name.split("·")[0].trim()}</option>)}</select></label>
        <label>Tipo de esforço mental<select value={cognitiveMode} onChange={(event) => {
          const next = event.target.value as CognitiveMode;
          setCognitiveMode(next);
          if (subjectId !== null) setSubjectModes((current) => ({ ...current, [String(subjectId)]: next }));
        }} disabled={running || Boolean(startedAt)}>{Object.entries(COGNITIVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <small className="cognitive-mode-note">A escolha fica associada a esta matéria neste dispositivo e cada ciclo é gravado no banco para comparar conclusão e interrupções por tipo de esforço.</small>
        <label>Objetivo opcional<input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Ex.: resolver 10 questões de cinemática" disabled={running || Boolean(startedAt)} /></label>
        <div className="pomodoro-settings-grid">
          <label>Foco (min)<input type="number" min={5} max={90} step={5} value={settings.focus} onChange={(event) => changeSettings("focus", Math.max(5, Math.min(90, Number(event.target.value) || 5)))} disabled={running || Boolean(startedAt)} /></label>
          <label>Pausa curta<input type="number" min={1} max={30} value={settings.shortBreak} onChange={(event) => changeSettings("shortBreak", Math.max(1, Math.min(30, Number(event.target.value) || 1)))} disabled={running} /></label>
          <label>Pausa longa<input type="number" min={5} max={60} value={settings.longBreak} onChange={(event) => changeSettings("longBreak", Math.max(5, Math.min(60, Number(event.target.value) || 5)))} disabled={running} /></label>
          <label>Ciclo longo a cada<input type="number" min={2} max={8} value={settings.longEvery} onChange={(event) => changeSettings("longEvery", Math.max(2, Math.min(8, Number(event.target.value) || 2)))} disabled={running} /></label>
        </div>
        <div className="pomodoro-cycle-count"><Zap size={16} /><span><strong>{cycles}</strong> ciclo{cycles === 1 ? "" : "s"} completo{cycles === 1 ? "" : "s"} nesta sequência</span><Coffee size={16} /></div>
        {!demo && <button className="pomodoro-notify" onClick={() => { if (typeof Notification !== "undefined") void Notification.requestPermission(); }}><BellRing size={15} /> Ativar aviso ao terminar</button>}
        <p className="cogn-footnote">Os ciclos concluídos e os parciais são gravados no banco local. O cronômetro continua ativo ao navegar para outra aba.</p>
      </aside>
    </section>
    <section className="card exam-guidance-card">
      <div className="section-heading"><div><p className="eyebrow">Dica calibrada para a prova</p><h2>{examGuide.title}</h2></div><ArrowUpRight size={19} /></div>
      <p>{examGuide.profile}</p>
      <div className="exam-guidance-bottom"><span><strong>Para este ciclo:</strong> {COGNITIVE_LABELS[cognitiveMode]} · {examGuide.practice}{focusArea ? ` Área de ênfase atual: ${focusArea}.` : ""}{course ? ` Curso-alvo: ${course.label}.` : ""}</span><a href={examGuide.source} target="_blank" rel="noreferrer">{examGuide.sourceLabel}<ArrowUpRight size={14} /></a></div>
      <small>Confira sempre o edital vigente; o formato e os conteúdos podem mudar conforme modalidade, curso e edição.</small>
    </section>
  </div>;
}

export function PomodoroWorkspace({ subjects, demo, examTrack, preferredCourse, focusArea, onRecordQuestions, onSessionSaved }: {
  subjects: Subject[];
  demo: boolean;
  examTrack: ExamTrack;
  preferredCourse: string | null;
  focusArea: string | null;
  onRecordQuestions: (subjectId: number) => void;
  onSessionSaved: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"timer" | "metrics">("timer");
  return <div className="page-stack pomodoro-workspace">
    <div className="pomodoro-tabs" role="tablist" aria-label="Área Pomodoro">
      <button role="tab" aria-selected={tab === "timer"} className={tab === "timer" ? "active" : ""} onClick={() => setTab("timer")}><Timer size={16} /> Pomodoro</button>
      <button role="tab" aria-selected={tab === "metrics"} className={tab === "metrics" ? "active" : ""} onClick={() => setTab("metrics")}><BarChart3 size={16} /> Métricas de uso</button>
    </div>
    <div className="pomodoro-tab-panel" style={{ display: tab === "timer" ? "contents" : "none" }}>
      <PomodoroTimerView subjects={subjects} demo={demo} examTrack={examTrack} preferredCourse={preferredCourse} focusArea={focusArea} onRecordQuestions={onRecordQuestions} onSessionSaved={onSessionSaved} onOpenMetrics={() => setTab("metrics")} />
    </div>
    {tab === "metrics" && <PomodoroAnalyticsView demo={demo} subjects={subjects} onOpenTimer={() => setTab("timer")} />}
  </div>;
}
