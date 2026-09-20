import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Crown,
  Minus,
  Pencil,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { api } from "./api";
import type { DayAllocation, SubjectRanking } from "../shared/types";

const HEX: Record<string, string> = {
  indigo: "#818cf8", violet: "#a78bfa", cyan: "#22d3ee", pink: "#f472b6",
  amber: "#fbbf24", emerald: "#34d399", orange: "#fb923c", blue: "#60a5fa"
};
const colorOf = (name: string) => HEX[name] ?? HEX.blue;
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const minutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};
const ZONES = [
  { id: "red", label: "Vermelha", hint: "Cedo ou tarde exige revisão — ataque hoje." },
  { id: "amber", label: "Amarela", hint: "Atenção — reforce o ritmo nas próximas sessões." },
  { id: "green", label: "Verde", hint: "Estável — risco baixo, siga o plano normal." }
] as const;
type ZoneId = (typeof ZONES)[number]["id"];
const zoneOf = (score: number): ZoneId => (score >= 7 ? "red" : score >= 5 ? "amber" : "green");
const zoneIndex = (score: number) => (score >= 7 ? 0 : score >= 5 ? 1 : 2);
const ZONE_LABEL: Record<ZoneId, string> = { red: "Vermelha", amber: "Amarela", green: "Verde" };

export function RankingView({ ranking, allocations, onChanged, demo }: { ranking: SubjectRanking[]; allocations: DayAllocation[]; onChanged: () => Promise<void>; demo: boolean }) {
  const [managing, setManaging] = useState<SubjectRanking | null>(null);
  const display = useMemo(
    () => [...ranking]
      .sort((a, b) => {
        const zoneDiff = zoneIndex(a.priorityScore) - zoneIndex(b.priorityScore);
        if (zoneDiff !== 0) return zoneDiff;
        return b.priorityScore - a.priorityScore || a.name.localeCompare(b.name);
      })
      .map((row, index) => ({ ...row, rank: index + 1 })),
    [ranking]
  );
  const top = display[0];
  const fallen = display.filter((row) => row.movement === "down");
  const risen = display.filter((row) => row.movement === "up");
  const bySubject = new Map(allocations.map((a) => [a.subjectId, a]));
  return <div className="page-stack">
    <section className="card ranking-hero"><div><p className="eyebrow">Prioridade calculada ao vivo</p><h2>Qual matéria merece atenção hoje?</h2><p>O score combina peso estratégico (IP), déficit contra sua meta de acerto, ritmo recente de questões e a tendência dos últimos 7 dias. A setinha mostra se a matéria <strong className="up-text">subiu</strong> ou <strong className="down-text">caiu</strong> em relação à janela anterior. Clique em <strong>Gerenciar</strong> para alocar a matéria a um dia da semana (reforço).</p></div><Crown size={30} /></section>
    {ranking.length ? <section className="rank-callouts">
      {top && <div className="rank-focus"><Crown size={18} /><div><strong>Foco do reforço: {top.name.split("·")[0].trim()}</strong><span>Maior prioridade ({top.priorityScore} pts) — melhor candidato para um dia calmo de revisão e resolução.</span></div></div>}
      {fallen.length > 0 && <div className="rank-warn"><ArrowDown size={18} /><div><strong>{fallen.length} matéria{fallen.length > 1 ? "s" : ""} em queda</strong><span>{fallen.map((row) => row.name.split("·")[0].trim()).join(", ")} — prioridade acima da semana anterior.</span></div></div>}
      {risen.length > 0 && <div className="rank-ok"><ArrowUp size={18} /><div><strong>{risen.length} matéria{risen.length > 1 ? "s" : ""} subiram</strong><span>{risen.map((row) => row.name.split("·")[0].trim()).join(", ")} — estabilidade melhorou na janela recente.</span></div></div>}
    </section> : null}
    <section className="card table-card">
      {ranking.length ? <div className="section-heading"><div><p className="eyebrow">Ordem de ataque</p><h2>Ranking de prioridade</h2></div></div> : null}
      {ranking.length ? <div className="zone-legend">{ZONES.map((zone) => <span key={zone.id} className={`zone-chip ${zone.id}`}><i />{zone.label}<em>{zone.hint}</em></span>)}</div> : null}
      {ranking.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Matéria</th><th>Movimento</th><th>Zona</th><th>Prioridade</th><th>Acerto</th><th>Reforço</th><th></th></tr></thead><tbody>{display.map((row) => {
        const zone = zoneOf(row.priorityScore);
        const allocation = bySubject.get(row.id);
        return <tr key={row.id} className={`zone-row ${zone}`}><td><span className="rank-position">{row.rank}</span></td><td><span className="subject-cell"><span className="color-dot" style={{ background: colorOf(row.color) }} />{row.name}</span></td><td><MovementBadge movement={row.movement} /></td><td><span className={`zone-pill ${zone}`} title={ZONE_LABEL[zone]}><i />{ZONE_LABEL[zone]}</span></td><td><div className="priority-cell"><strong>{row.priorityScore}</strong><div className="progress-inline"><span style={{ width: `${Math.min(100, row.priorityScore / 9 * 100)}%`, background: row.priorityScore >= 7 ? "#ff5a71" : row.priorityScore >= 5 ? "#ffca76" : "#34d399" }} /></div></div></td><td><strong className={row.accuracy >= row.goalAccuracy ? "good" : "needs-work"}>{row.accuracy}%</strong></td><td>{allocation ? <button className="alloc-badge" title={allocation.note ?? ""} onClick={() => setManaging(row)}><CalendarCheck size={13} /> {DAYS[allocation.weekday]} · {minutes(allocation.minutes)}</button> : <span className="muted-text">—</span>}</td><td><button className="icon-button" title="Alocar reforço ou gerenciar" onClick={() => setManaging(row)}><Pencil size={15} /></button></td></tr>;
      })}</tbody></table></div> : <div className="empty-state"><div><Crown size={24} /></div><p>Cadastre matérias e registre blocos de questões — o ranking de prioridade aparece aqui com as setinhas de subida e queda.</p></div>}
    </section>
    {managing && <AllocationModal subject={managing} allocation={bySubject.get(managing.id)} onClose={() => setManaging(null)} onSaved={async () => { await onChanged(); setManaging(null); }} demo={demo} />}
  </div>;
}

function MovementBadge({ movement }: { movement: SubjectRanking["movement"] }) {
  if (movement === "up") return <span className="movement-badge up" title="Subiu no ranking em relação à janela anterior"><ArrowUp size={14} /> Subiu</span>;
  if (movement === "down") return <span className="movement-badge down" title="Caiu no ranking em relação à janela anterior"><ArrowDown size={14} /> Caiu</span>;
  if (movement === "new") return <span className="movement-badge fresh" title="Sem histórico da janela anterior"><Sparkles size={13} /> Novo</span>;
  return <span className="movement-badge stable" title="Posição estável"><Minus size={14} /> Estável</span>;
}

function AllocationModal({ subject, allocation, onClose, onSaved, demo }: { subject: SubjectRanking; allocation?: DayAllocation | undefined; onClose: () => void; onSaved: () => Promise<void>; demo: boolean }) {
  const [weekday, setWeekday] = useState<number | null>(allocation?.weekday ?? null);
  const [minutesValue, setMinutesValue] = useState<number>(allocation?.minutes ?? 60);
  const [note, setNote] = useState<string>(allocation?.note ?? "");
  const [saving, setSaving] = useState(false);
  const suggested = subject.movement === "down" ? "Queda no ranking" : subject.movement === "new" ? "Sem histórico recente" : subject.movement === "up" ? "Estabilidade melhorou" : "Déficit vs meta de acerto";
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (weekday === null) return;
    setSaving(true);
    try {
      if (!demo) await api.saveDayAllocation({ subjectId: subject.id, weekday, minutes: minutesValue, note: note.trim() || null });
      await onSaved();
    } catch (error) {
      window.alert(String(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      if (!demo) await api.deleteDayAllocation(subject.id);
      await onSaved();
    } catch (error) {
      window.alert(String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Gerenciar reforço" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title"><h2>Reforço · {subject.name.split("·")[0].trim()}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
        <form onSubmit={save} className="form-stack">
          <p className="form-hint">Score de prioridade: <strong>{subject.priorityScore} pts</strong> · movimento <strong>{MovementLabel(subject.movement)}</strong>. Aloque esta matéria a um dia da semana como bloco de reforço planejado.</p>
          <label>Dia da semana do reforço
            <div className="weekday-pills">{DAYS.map((day, index) => <button type="button" key={day} className={`weekday-pill ${weekday === index ? "active" : ""}`} onClick={() => setWeekday(index)}>{day}</button>)}</div>
          </label>
          <label>Tempo do bloco (min)<input type="number" min="15" max="480" step="5" value={minutesValue} onChange={(event) => setMinutesValue(Math.max(15, Math.min(480, Number(event.target.value))))} /></label>
          <label>Motivo (opcional)<input value={note} placeholder={suggested} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="modal-actions">
            {allocation && <button type="button" className="button danger" disabled={saving} onClick={remove}><Trash2 size={15} /> Remover alocação</button>}
            <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>
            <button className="button primary" disabled={saving || weekday === null}>{saving ? "Salvando…" : "Salvar reforço"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MovementLabel(movement: SubjectRanking["movement"]) {
  if (movement === "up") return "↑ Subiu";
  if (movement === "down") return "↓ Caiu";
  if (movement === "new") return "☆ Novo";
  return "— Estável";
}