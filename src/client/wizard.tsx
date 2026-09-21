import { useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarCheck, CheckCircle2, Flag, ListChecks, Plus, Sparkles, TimerReset, X } from "lucide-react";
import { api, type SubjectInput } from "./api";
import { buildDemoPlan } from "./demo";
import { color } from "./colors";
import { areaWeight, booksForName, catalogSubjectsForTrack, CATALOG_COLORS, CATALOG_GROUP_LABELS, emphasize, EXAM_TRACKS, FOCUS_AREAS, parentArea, type FocusAreaId } from "./catalog";
import type { ExamTrack, PlanDay, PlanFocus, PlanInput, PlanResponse, Profile, Subject } from "../shared/types";

export function PlanWizard({ subjects, profile, onClose, demo, onSubjectAdded }: { subjects: Subject[]; profile: Profile; onClose: () => void; demo: boolean; onSubjectAdded?: (subject: Subject) => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PlanInput>({ startDate: todayIso, examDate: profile.examDate ?? todayIso, totalHours: profile.dailyHours * profile.weeklyDays });
  const [items, setItems] = useState<Subject[]>(subjects);
  const [selected, setSelected] = useState<Set<number>>(new Set(subjects.slice(0, 2).map((s) => s.id)));
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const [track, setTrack] = useState<ExamTrack>(profile.examTrack);
  const [catalogChecked, setCatalogChecked] = useState<Set<string>>(new Set());
  const [catalogWeights, setCatalogWeights] = useState<Record<string, number>>({});
  const [area, setArea] = useState<FocusAreaId | null>(null);
  const [weightMode, setWeightMode] = useState<"padrao" | "manual">("manual");
  const [levels, setLevels] = useState<Record<number, number>>({});
  const [planTab, setPlanTab] = useState<"rota" | "tarefas">("rota");
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());

  const toggle = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const activeArea = FOCUS_AREAS.find((candidate) => candidate.id === area) ?? null;
  const weeksLeft = form.examDate && form.startDate && form.examDate > form.startDate ? Math.max(1, Math.round((new Date(form.examDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7))) : 1;

  const addSubject = async () => {
    const name = draft.trim();
    if (!name) return;
    if (demo) {
      const subject: Subject = { id: 900000 + (items.length + 1), userId: 0, name, weight: 3, difficulty: 3, computedIp: 9, color: "blue", goalAccuracy: 70, goalCoverage: 60, currentLevel: 1, targetLevel: 1, createdAt: todayIso };
      setItems((previous) => [...previous, subject]);
      setSelected((previous) => new Set(previous).add(subject.id));
      setDraft("");
      onSubjectAdded?.(subject);
      return;
    }
    const input: SubjectInput = { name, weight: 3, difficulty: 3, color: "blue" };
    try {
      const subject = await api.createSubject(input);
      setItems((previous) => [...previous, subject]);
      setSelected((previous) => new Set(previous).add(subject.id));
      setDraft("");
      onSubjectAdded?.(subject);
    } catch (error) {
      window.alert(String(error));
    }
  };

  const toggleCatalog = (name: string) => setCatalogChecked((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });

  const insertCatalog = async () => {
    const trackList = catalogSubjectsForTrack(track);
    const toAdd = trackList.filter((entry) => catalogChecked.has(entry.name) && !items.some((subject) => subject.name === entry.name));
    if (!toAdd.length) return;
    if (demo) {
      const created = toAdd.map((entry, index) => {
        const weight = catalogWeights[entry.name] ?? areaWeight(activeArea, entry);
        return {
          id: 900000 + items.length + index + 1,
          userId: 0,
          name: entry.name,
          weight,
          difficulty: entry.difficulty,
          computedIp: weight * entry.difficulty,
          color: CATALOG_COLORS[(items.length + index) % CATALOG_COLORS.length],
          goalAccuracy: 70,
          goalCoverage: 60,
          currentLevel: 1,
          targetLevel: 1,
          createdAt: todayIso
        } as Subject;
      });
      setItems((previous) => [...previous, ...created]);
      setSelected((previous) => { const next = new Set(previous); created.forEach((subject) => next.add(subject.id)); return next; });
      created.forEach((subject) => onSubjectAdded?.(subject));
    } else {
      try {
        for (const entry of toAdd) {
          const subject = await api.createSubject({ name: entry.name, weight: catalogWeights[entry.name] ?? areaWeight(activeArea, entry), difficulty: entry.difficulty });
          setItems((previous) => [...previous, subject]);
          setSelected((previous) => new Set(previous).add(subject.id));
          onSubjectAdded?.(subject);
        }
      } catch (error) {
        window.alert(String(error));
      }
    }
    setCatalogChecked(new Set());
  };

  const generate = async () => {
    if (!selected.size) return;
    const withLevels = items.map((subject) => (levels[subject.id] ? { ...subject, currentLevel: levels[subject.id] } : subject));
    if (demo) {
      setPlan(buildDemoPlan(withLevels.filter((subject) => selected.has(subject.id))));
      setStep(2);
      return;
    }
    setGenerating(true);
    try {
      const changes = items.filter((subject) => levels[subject.id] && levels[subject.id] !== subject.currentLevel);
      for (const subject of changes) {
        await api.updateSubject(subject.id, { name: subject.name, weight: subject.weight, difficulty: subject.difficulty, currentLevel: levels[subject.id] });
      }
      setPlan(await api.getStudyPlan({ ...form, totalHours: Number(form.totalHours) || profile.dailyHours * profile.weeklyDays }));
      setStep(2);
    } catch {
      setGenerating(false);
    }
  };

  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const tasks = plan
    ? plan.days.flatMap((day) => day.focusSubjects.map((focus) => ({
        key: `${day.date}-${focus.subjectId}`,
        date: day.date,
        dateLabel: `${day.weekdayLabel} · ${dayLabel(day.date)}`,
        subjectName: focus.subjectName.split("·")[0].trim(),
        color: focus.color,
        minutes: focus.minutes,
        slot: focus.slot
      })))
    : [];
  const weeklyTasks = plan
    ? (() => {
        const examPhase = Math.max(2, Math.floor(plan.weeks / 4));
        return Array.from({ length: Math.max(1, plan.weeks) }, (_, week) => {
          const examMode = week >= Math.max(1, plan.weeks - examPhase);
          if (examMode) {
            return {
              key: `simulado-${week}`,
              date: "",
              dateLabel: `Semana ${week + 1}`,
              subjectName: "Simulado estilo prova",
              color: "violet",
              minutes: 120,
              slot: "prova cronometrada (provas anteriores) + categorizar erros: não sabia × errei × chutei"
            };
          }
          return {
            key: `recall-${week}`,
            date: "",
            dateLabel: `Semana ${week + 1}`,
            subjectName: "Revisão ativa",
            color: "cyan",
            minutes: 40,
            slot: "recall espaçado: flashcards e questões sem consultar o material"
          };
        });
      })()
    : [];
  const routeBooks = plan
    ? (() => {
        const grouped: Array<{ parent: string; books: string[] }> = [];
        const seen = new Set<string>();
        for (const day of plan.days) {
          for (const focus of day.focusSubjects) {
            const found = booksForName(focus.subjectName);
            if (!found) continue;
            for (const book of found) {
              const marker = `${focus.subjectName}${book}`;
              if (seen.has(marker)) continue;
              seen.add(marker);
              const parent = parentArea(focus.subjectName);
              const group = grouped.find((entry) => entry.parent === parent);
              if (group) group.books.push(book);
              else grouped.push({ parent, books: [book] });
            }
          }
        }
        return grouped;
      })()
    : [];
  const doneCount = [...tasks, ...weeklyTasks].filter((task) => doneTasks.has(task.key)).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wizard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div>{step < 2 ? <p className="eyebrow">Rota de prova · cronograma reverso</p> : <p className="eyebrow">Rota pronta</p>}<h2>{step === 0 ? "Defina a linha de chegada" : step === 1 ? "Escolha os focos de ataque" : "Semanas até a prova"}</h2></div>
          <button className="icon-button" title="Fechar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="wizard-steps"><span className={step >= 0 ? "active" : ""}>1 · Meta</span><span className={step >= 1 ? "active" : ""}>2 · Focos</span><span className={step >= 2 ? "active" : ""}>3 · Rotina</span></div>

        <div className="wizard-body scroll-area">
          {step === 0 && <div className="form-stack">
            <div className="form-two"><label>Data da prova<input type="date" value={form.examDate} onChange={(event) => setForm((prev) => ({ ...prev, examDate: event.target.value }))} /></label><label>Início da rota<input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} /></label></div>
            <label>Horas líquidas de estudo por dia<input type="number" min="0.5" max="16" step="0.5" value={Math.round(form.totalHours / Math.max(profile.weeklyDays, 1) * 10) / 10} onChange={(event) => setForm((prev) => ({ ...prev, totalHours: Number(event.target.value) * Math.max(profile.weeklyDays, 1) }))} /></label>
            <p className="form-hint">Você tem <strong>{weeksLeft} semanas</strong>. O motor distribui os blocos priorizando a janela matinal de maior resistência à procrastinação e reserva tempo de revisão nas semanas finais.</p>
          </div>}

          {step === 1 && <div className="form-stack">
            <div className="wizard-add">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Adicionar matéria nova à rota — não repita os focos, amplie o ataque…" aria-label="Nome da nova matéria" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addSubject(); } }} />
              <button className="button secondary" onClick={() => void addSubject()} disabled={!draft.trim()}><Plus size={15} /> Adicionar</button>
            </div>
            <p className="form-hint">Quais disciplinas entram na <strong>fase de ataque</strong>? Elas recebem os blocos principais; o restante fica em manutenção via Project Buffer. Quanto mais matérias entrarem, menos o motor repete os mesmos focos.</p>

            <div className="wizard-focus-area">
              <p className="form-hint"><strong>Área que você quer entrar</strong> — clique num botão para elevar o peso padrão das matérias que sustentam essa carreira. Clicar de novo desativa a ênfase.</p>
              <div className="focus-area-chips">{FOCUS_AREAS.map((candidate) => <button type="button" key={candidate.id} className={`focus-area-chip ${area === candidate.id ? "active" : ""}`} title={candidate.hint} onClick={() => setArea((prev) => (prev === candidate.id ? null : candidate.id))}><Flag size={13} />{candidate.label}{area === candidate.id ? <em>ênfase</em> : null}</button>)}</div>
            </div>
            <div className="wizard-catalog">
              <div className="catalog-controls">
                <label className="catalog-track">Vestibular alvo<select value={track} onChange={(event) => { setTrack(event.target.value as ExamTrack); setCatalogChecked(new Set()); }}>{EXAM_TRACKS.map((option) => <option key={option}>{option}</option>)}</select></label>
                <div className="weight-mode">
                  <span className="weight-mode-label">Pesos</span>
                  <button type="button" className={`weight-mode-btn ${weightMode === "padrao" ? "active" : ""}`} onClick={() => setWeightMode("padrao")}>Padrão da prova</button>
                  <button type="button" className={`weight-mode-btn ${weightMode === "manual" ? "active" : ""}`} onClick={() => setWeightMode("manual")}>Meu peso</button>
                </div>
              </div>
              <p className="form-hint">Cada prova já traz suas matérias com o <strong>peso padrão</strong> (a área pode elevá-lo). Em <strong>Meu peso</strong>, ajuste matéria por matéria antes de inserir na rota.</p>
              <div className="catalog-list" data-testid="catalog-list">{catalogSubjectsForTrack(track).map((entry) => {
                const alreadyIn = items.some((subject) => subject.name === entry.name);
                const checked = catalogChecked.has(entry.name);
                const focando = emphasize(activeArea, entry);
                const weight = catalogWeights[entry.name] ?? areaWeight(activeArea, entry);
                return (
                  <label className={`catalog-row ${alreadyIn ? "taken" : ""} ${checked ? "checked" : ""} ${focando ? "emphasis" : ""}`} key={entry.name}>
                    <input type="checkbox" aria-label={`Incluir ${entry.name}`} checked={checked} disabled={alreadyIn} onChange={() => toggleCatalog(entry.name)} />
                    <span className="catalog-name">{parentArea(entry.name)}<small>{entry.name.indexOf(" · ") === -1 ? CATALOG_GROUP_LABELS[entry.group] : entry.name.slice(entry.name.indexOf(" · ") + 3)} · {CATALOG_GROUP_LABELS[entry.group]}</small>{focando ? <em className="focus-badge">foco maior</em> : null}</span>
                    <span className="catalog-difficulty">dif. {entry.difficulty}</span>
                    {entry.books ? <span className="catalog-books" title={entry.books.join(" · ")}><BookOpen size={12} /> {entry.books.length} livro(s)</span> : null}
                    <input type="number" min="1" max="5" step="1" value={weight} aria-label={`Peso de ${entry.name}`} disabled={alreadyIn || weightMode === "padrao"} onChange={(event) => { const value = Math.max(1, Math.min(5, Number(event.target.value) || 1)); setCatalogWeights((prev) => ({ ...prev, [entry.name]: value })); }} />
                  </label>
                );
              })}</div>
              <button className="button secondary catalog-insert" onClick={() => void insertCatalog()} disabled={!catalogChecked.size}><Plus size={15} /> Inserir selecionadas ({catalogChecked.size})</button>
            </div>

            <div className="subject-grid" data-testid="subject-grid">{items.map((subject) => <div className="subject-tile-wrap" key={subject.id}><button className={`subject-tile ${selected.has(subject.id) ? "active" : ""}`} onClick={() => toggle(subject.id)}><i style={{ background: color(subject.color) }} />{subject.name.split("·")[0].trim()}<small>peso {subject.weight} · dificuldade {subject.difficulty}{selected.has(subject.id) ? ` · nível ${levels[subject.id] ?? subject.currentLevel}` : ""}</small></button>{selected.has(subject.id) ? <label className="level-picker">de onde você começa?<select aria-label={`Nível de partida de ${subject.name}`} value={levels[subject.id] ?? subject.currentLevel} onChange={(event) => setLevels((prev) => ({ ...prev, [subject.id]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} · {{ 1: "do zero", 2: "pouco a percorrer", 3: "razoável", 4: "bom", 5: "pronto" }[level]}</option>)}</select></label> : null}</div>)}</div>
            {!items.length && <p className="cogn-empty">Adicione matérias na aba Matriz antes de montar a rota.</p>}
          </div>}

          {step === 2 && plan && <div className="form-stack">
            {plan.riskName && <div className="cog-alert warning"><AlertTriangle size={16} /><div><strong>Matéria de maior risco: {plan.riskName.split("·")[0].trim()}.</strong><span>Recebe a primeira janela matinal — o período de menor resistência à procrastinação.</span></div></div>}
            <div className="focus-summary-row"><div><strong>{plan.weeks}</strong><span>semanas até a prova</span></div><div><strong>{plan.days.length}</strong><span>dias na rota</span></div><div><strong>{Math.max(1, plan.days[0]?.focusSubjects.length ?? 0)}</strong><span>focos por dia</span></div></div>
            <div className="wizard-tabs"><button className={`tab-chip ${planTab === "rota" ? "active" : ""}`} onClick={() => setPlanTab("rota")}><CalendarCheck size={14} /> Rota</button><button className={`tab-chip ${planTab === "tarefas" ? "active" : ""}`} onClick={() => setPlanTab("tarefas")}><ListChecks size={14} /> Lista de tarefas ({doneCount}/{tasks.length + weeklyTasks.length})</button></div>
            {planTab === "rota" && <><div className="plan-days" data-testid="plan-days">{plan.days.slice(0, 7).map((day: PlanDay) => <div className="plan-day" key={day.date}><span className="plan-day-date">{dayLabel(day.date)}</span><span className="plan-day-name">{day.weekdayLabel}</span><div className="plan-day-focus">{day.focusSubjects.map((focus: PlanFocus) => <span className="plan-chip" key={`${day.date}-${focus.subjectId}`} title={booksForName(focus.subjectName)?.join(" · ") ?? focus.subjectName}><i style={{ background: color(focus.color) }} />{focus.subjectName.split("·")[0].trim()}<b>{focus.minutes}m</b><em>{focus.slot}</em></span>)}</div></div>)}</div>
            {routeBooks.length > 0 && <details className="plan-books"><summary><BookOpen size={14} /> Grandes livros da rota ({routeBooks.reduce((total, group) => total + group.books.length, 0)})</summary><div className="plan-books-list">{routeBooks.map((group) => <div className="plan-books-group" key={group.parent}><strong>{group.parent}</strong><ul>{group.books.map((book) => <li key={book}>{book}</li>)}</ul></div>)}</div></details>}
            <p className="cogn-footnote"><CalendarCheck size={14} /> A rota gira por todas as matérias de ataque: o bloco principal alterna a janela matinal entre as menores resistências à procrastinação e o reforço complementa com matérias adicionais, sem repetir o mesmo foco todos os dias. As sub-áreas de uma mesma matéria aparecem em sequência (ex.: Cinemática → Dinâmica → Energia → …). Passe o mouse num chip para ver os livros daquela sub-área.</p></>}
            {planTab === "tarefas" && <div className="task-list" data-testid="task-list">{tasks.map((task) => <label className={`task-row ${doneTasks.has(task.key) ? "done" : ""}`} key={task.key}><input type="checkbox" checked={doneTasks.has(task.key)} onChange={() => setDoneTasks((prev) => { const next = new Set(prev); if (next.has(task.key)) next.delete(task.key); else next.add(task.key); return next; })} /><span className="task-date">{task.dateLabel}</span><i style={{ background: color(task.color) }} /><span className="task-name">{task.subjectName}</span><b>{task.minutes}m</b><em>{task.slot}</em></label>)}<p className="task-group-title">Ritmo semanal</p>{weeklyTasks.map((task) => <label className={`task-row sim ${doneTasks.has(task.key) ? "done" : ""}`} key={task.key}><input type="checkbox" checked={doneTasks.has(task.key)} onChange={() => setDoneTasks((prev) => { const next = new Set(prev); if (next.has(task.key)) next.delete(task.key); else next.add(task.key); return next; })} /><span className="task-date">{task.dateLabel}</span><i style={{ background: color(task.color) }} /><span className="task-name">{task.subjectName}</span><b>{task.minutes}m</b><em>{task.slot}</em></label>)}<p className="cogn-footnote"><ListChecks size={14} /> Marque os blocos conforme executa — a lista vira seu plano diário de tarefas até a prova. Seguindo a ciência da aprendizagem (MIT Open Learning / Springer), o primeiro período usa <strong>revisão ativa espaçada</strong> do que já foi estudado; o último quarto troca para <strong>simulados cronometrados com provas anteriores</strong>, e a cada erro classifique a causa (não sabia × errei × chutei) para ajustar o rumo.</p></div>}
          </div>}
        </div>

        <div className="modal-actions">
          {step === 0 && <button className="button primary" onClick={() => setStep(1)}>Continuar <ArrowRight size={15} /></button>}
          {step === 1 && <><button className="button ghost" onClick={() => setStep(0)}>Voltar</button><button className="button primary" onClick={generate} disabled={!selected.size || generating}>{generating ? <TimerReset size={15} /> : <Sparkles size={15} />} {generating ? "Montando rota…" : "Gerar rota"}</button></>}
          {step === 2 && plan && <><button className="button ghost" onClick={() => setStep(1)}>Voltar</button><button className="button primary" onClick={onClose}><CheckCircle2 size={15} /> Concluir</button></>}
        </div>
      </div>
    </div>
  );
}