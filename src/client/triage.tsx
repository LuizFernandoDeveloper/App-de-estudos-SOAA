import { useState } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck, ShieldAlert, Sunrise, TimerReset } from "lucide-react";
import type { BufferAllocation, BufferDestination, ReschedulePlan } from "../shared/types";
import { api } from "./api";
import { demoBufferAllocations, demoReschedulePlan } from "./demo";

const formatMinutes = (value: number) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const DESTINATION_ICON: Record<BufferDestination, string> = {
  saturday: "Sábado à tarde",
  next_week: "Semana seguinte"
};

export function RescheduleTriagePanel({ demo }: { demo: boolean }) {
  const [plan, setPlan] = useState<ReschedulePlan | null>(demo ? demoReschedulePlan : null);
  const [buffers, setBuffers] = useState<BufferAllocation[]>(demo ? demoBufferAllocations : []);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(Boolean(demo ? demoReschedulePlan : false));

  const runReschedule = async () => {
    setRunning(true);
    if (demo) {
      window.setTimeout(() => {
        setPlan(demoReschedulePlan);
        setBuffers(demoBufferAllocations);
        setOpen(true);
        setRunning(false);
      }, 500);
      return;
    }
    try {
      const nextPlan = await api.rescheduleBuffer();
      setPlan(nextPlan);
      setBuffers(await api.listBufferAllocations());
      setOpen(true);
    } catch {
      setOpen(false);
    } finally {
      setRunning(false);
    }
  };

  const hasDebt = Boolean(plan && plan.items.length > 0);

  return (
    <section className="card">
      <div className="section-heading">
        <div><p className="eyebrow">Gestão Adaptativa de Cronograma · CCPM</p><h2>Triage WBS diário</h2></div>
        <button className="button" onClick={runReschedule} disabled={running}>{running ? <TimerReset size={16} /> : <CalendarCheck size={16} />} Reagendar com buffer</button>
      </div>

      {!hasDebt && <p className="cogn-empty">Nenhum bloco parcial ou pendente na última semana. Quando um bloco falhar, o sistema recalcula o saldo devedor e empurra para o Project Buffer — sem efeito dominó.</p>}

      {plan && hasDebt && open && (
        <>
          <div className="cog-alert warning"><AlertTriangle size={16} /><div><strong>Conflito de agenda resolvido sem efeito dominó.</strong><span>{formatMinutes(plan.totalDebtMinutes)} de saldo devedor realocados · manhãs de hiperfoco protegidas ({plan.protectedMorningHours} manhãs).</span></div></div>
          <div className="triage-grid">
            <div className="triage-stat"><i style={{ background: "#f472b6" }} /><div><strong>{formatMinutes(plan.saturdayMinutes)}</strong><span>para o buffer de Sábado à tarde</span></div></div>
            <div className="triage-stat"><i style={{ background: "#22d3ee" }} /><div><strong>{formatMinutes(plan.nextWeekMinutes)}</strong><span>redistribuídas na semana seguinte</span></div></div>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Bloco falhou</th><th>Saldo devedor</th><th>Realocado para</th></tr></thead>
            <tbody>
              {plan.items.map((item) => (
                <tr key={item.sourceSessionId}>
                  <td><span className="subject-cell"><span className="color-dot" style={{ background: `var(--${item.color})` }} />{item.subjectName.split("·")[0].trim()}<span className="muted-text"> — {item.goal}</span></span></td>
                  <td><strong className="needs-work">{formatMinutes(item.debtMinutes)}</strong> <span className="muted-text">({formatMinutes(item.executedMinutes)} de {formatMinutes(item.plannedMinutes)} executados)</span></td>
                  <td><span className="buffer-chip"><ArrowRight size={13} />{item.destinationLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="cogn-footnote"><Sunrise size={14} /> <em>Horários matinais protegidos:</em> o tempo devedor nunca é empurrado para os blocos da manhã — ele vai para o bloco de contenção ou é redistribuído.</p>
        </>
      )}

      {!hasDebt && buffers.length > 0 && (
        <div className="buffer-list">
          {buffers.map((buffer) => (
            <div key={buffer.id} className="buffer-item">
              <span className="color-dot" style={{ background: `var(--${buffer.color})` }} />
              <div><strong>{buffer.subjectName.split("·")[0].trim()}</strong><span className="muted-text">{buffer.sourceGoal ?? "bloco movido"}</span></div>
              <em>{formatMinutes(buffer.debtMinutes)}</em>
              <span className="buffer-chip"><ShieldAlert size={13} />{DESTINATION_ICON[buffer.destination]}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}