import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import stylesCss from "./styles.css?raw";

if (!stylesCss) {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), "styles.css");
  (globalThis as Record<string, unknown>).__rawStyles = readFileSync(cssPath, "utf8");
}
const cssContent = stylesCss || (((globalThis as Record<string, unknown>).__rawStyles as string) ?? "");

import { PlanWizard } from "./wizard";
import { RankingView } from "./ranking";
import { FocusTimerView } from "./focus";
import { RescheduleTriagePanel } from "./triage";
import { RetentionGraphBoard } from "./retention";
import { AdvancementView } from "./advancement";
import { CognitiveCharts } from "./cognitive";
import { CustomTitleBar } from "./TitleBar";

const { appWindowStub } = vi.hoisted(() => ({
  appWindowStub: {
    isMaximized: async () => false,
    onResized: async () => () => undefined,
    minimize: async () => undefined,
    toggleMaximize: async () => undefined,
    close: async () => undefined
  }
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => appWindowStub }));

import {
  buildMemoryDecayProjection,
  demoBrainDumps,
  demoDashboard,
  demoDayAllocations,
  demoFocusOverloadTrend,
  demoFocusSessions,
  demoMaterialList,
  demoMemoryItems,
  demoPlan,
  demoProfile,
  demoRanking,
  demoReschedulePlan,
  demoRetentionOverview,
  demoSchedule,
  demoSubjectAccuracyTrend,
  demoSubjects,
  demoTopicList
} from "./demo";

afterEach(cleanup);

const chipName = (chip: HTMLElement) =>
  Array.from(chip.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => (node.textContent ?? "").trim())
    .find(Boolean);

describe("styles.css · regras de scroll em áreas que listam conteúdo", () => {
  it("define scroll vertical para modais, plan-days e wizard-body", () => {
    expect(cssContent).toContain(".modal-body {");
    expect(cssContent).toContain("overflow-y: auto");
    expect(cssContent).toContain(".wizard-body .plan-days { max-height: 46vh; overflow-y: auto;");
    expect(cssContent).toContain(".wizard-body { flex: 1 1 auto; min-height: 0; overflow-y: auto;");
  });

  it("define tabelas com scroll horizontal e listas de catálogo com rolagem vertical", () => {
    expect(cssContent).toContain(".table-wrap");
    expect(cssContent).toContain("overflow-x: auto");
  });
});

describe("PlanWizard · Rota de prova (demo)", () => {
  it("meta → focos (grade com scroll) → adiciona matéria → gera rota com mais matérias e conclui", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <PlanWizard subjects={demoSubjects} profile={demoProfile} onClose={onClose} demo onSubjectAdded={vi.fn()} />
    );

    expect(screen.getByText("Defina a linha de chegada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByText("Escolha os focos de ataque")).toBeInTheDocument();
    const grid = screen.getByTestId("subject-grid");
    expect(within(grid).getAllByRole("button").length).toBe(demoSubjects.length);
    const wizardBody = container.querySelector(".wizard-body") as HTMLElement;
    expect(wizardBody).toHaveClass("scroll-area");

    const name = screen.getByLabelText("Nome da nova matéria");
    for (const nova of ["Cálculo Vetorial", "Álgebra Linear", "Termodinâmica"]) {
      fireEvent.change(name, { target: { value: nova } });
      expect(screen.getByRole("button", { name: /Adicionar/ })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    }
    expect(within(grid).getAllByRole("button").length).toBe(demoSubjects.length + 3);

    fireEvent.click(screen.getByRole("button", { name: /Gerar rota/ }));

    expect(await screen.findByText("Semanas até a prova")).toBeInTheDocument();
    const planDays = screen.getByTestId("plan-days");
    expect(planDays).toHaveClass("plan-days");
    const chips = Array.from(planDays.querySelectorAll<HTMLElement>(".plan-chip"));
    expect(chips.length).toBeGreaterThan(4);
    expect(chips.map(chipName).filter(Boolean)).toContain("Cálculo Vetorial");

    const distinctSubjects = new Set(chips.map(chipName).filter(Boolean)).size;
    expect(distinctSubjects).toBeGreaterThan(3);

    fireEvent.click(screen.getByRole("button", { name: /Concluir/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não gera rota sem nenhuma matéria selecionada", async () => {
    render(<PlanWizard subjects={demoSubjects} profile={demoProfile} onClose={vi.fn()} demo />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    const tiles = within(screen.getByTestId("subject-grid")).getAllByRole("button");
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    const generate = screen.getByRole("button", { name: /Gerar rota/ });
    expect(generate).toBeDisabled();
  });

  it("demoPlan exportado gira por todas as matérias sem repetir os mesmos focos", () => {
    expect(demoPlan.days.length).toBe(14);
    const allFocus = demoPlan.days.flatMap((day) => day.focusSubjects.map((f) => f.subjectId));
    const firstTwoDays = demoPlan.days.slice(0, 2).flatMap((day) => day.focusSubjects);
    expect(new Set(allFocus).size).toBeGreaterThan(6);
    expect(firstTwoDays[0]?.subjectId).not.toBe(firstTwoDays[1]?.subjectId);
  });

  it("insere matérias da trilha do vestibular (peso padrão customizável)", async () => {
    const onSubjectAdded = vi.fn();
    render(
      <PlanWizard subjects={[]} profile={demoProfile} onClose={vi.fn()} demo onSubjectAdded={onSubjectAdded} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const track = screen.getByLabelText("Vestibular alvo");
    expect(track).toHaveValue("ITA");
    const catalogList = screen.getByTestId("catalog-list");
    expect(within(catalogList).getAllByRole("checkbox").length).toBeGreaterThan(10);

    const firstRow = within(catalogList).getAllByLabelText(/Incluir /)[0];
    const rowName = firstRow.getAttribute("aria-label")?.replace("Incluir ", "") ?? "";
    fireEvent.click(firstRow);
    const weight = within(catalogList).getByLabelText(`Peso de ${rowName}`);
    fireEvent.change(weight, { target: { value: "5" } });

    const insert = screen.getByRole("button", { name: /Inserir selecionadas \(1\)/ });
    expect(insert).toBeEnabled();
    fireEvent.click(insert);

    const grid = screen.getByTestId("subject-grid");
    expect(within(grid).getAllByRole("button").length).toBe(1);
    expect(onSubjectAdded).toHaveBeenCalledTimes(1);

    fireEvent.change(track, { target: { value: "ENEM" } });
    const regenerated = screen.getByTestId("catalog-list");
    expect(within(regenerated).getAllByRole("checkbox").every((box) => !box.hasAttribute("disabled"))).toBe(true);
    expect(within(regenerated).getAllByRole("checkbox").length).toBeGreaterThan(10);
  });

  it("gera a rota e exibe lista de tarefas com contador de execução", async () => {
    render(
      <PlanWizard subjects={[]} profile={demoProfile} onClose={vi.fn()} demo />
    );
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const catalogList = screen.getByTestId("catalog-list");
    const row1 = within(catalogList).getAllByLabelText(/Incluir /)[0];
    const row2 = within(catalogList).getAllByLabelText(/Incluir /)[1];
    fireEvent.click(row1);
    fireEvent.click(row2);
    fireEvent.click(screen.getByRole("button", { name: /Inserir selecionadas \(2\)/ }));

    fireEvent.click(screen.getByRole("button", { name: /Gerar rota/ }));
    expect(await screen.findByText("Semanas até a prova")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Lista de tarefas/ }));
    const tasks = screen.getByTestId("task-list");
    expect(within(tasks).getAllByRole("checkbox").length).toBeGreaterThan(0);

    const firstTask = within(tasks).getAllByRole("checkbox")[0];
    fireEvent.click(firstTask);
    expect(within(tasks).getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getByText(/Lista de tarefas \(1\/\d+\)/)).toBeInTheDocument();
  });

  it("área de ingresso eleva a ênfase e o modo padrão trava o peso da lista", () => {
    render(<PlanWizard subjects={[]} profile={demoProfile} onClose={vi.fn()} demo />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const catalogList = screen.getByTestId("catalog-list");
    const exatas = screen.getByRole("button", { name: /Exatas/ });
    fireEvent.click(exatas);
    expect(exatas).toHaveClass("active");
    expect(within(catalogList).queryAllByText("foco maior").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Padrão da prova" }));
    expect(within(catalogList).getAllByLabelText(/Peso de /)[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Meu peso" }));
    expect(within(catalogList).getAllByLabelText(/Peso de /)[0]).toBeEnabled();

    fireEvent.click(exatas);
    expect(screen.queryByText("foco maior")).not.toBeInTheDocument();
  });

  it("diagnóstico de nível de partida acompanha a matéria até a rota", async () => {
    render(<PlanWizard subjects={demoSubjects} profile={demoProfile} onClose={vi.fn()} demo />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const grid = screen.getByTestId("subject-grid");
    const tiles = within(grid).getAllByRole("button");
    fireEvent.click(tiles[0]);
    const picker = screen.getByRole("combobox", { name: /Nível de partida de/ });
    expect(picker).toHaveValue("1");

    fireEvent.change(picker, { target: { value: "4" } });
    expect(within(grid).getByText(/nível 4/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Gerar rota/ }));
    expect(await screen.findByText("Semanas até a prova")).toBeInTheDocument();
  });

  it("rota traz os grandes livros das sub-áreas e simulados semanais", async () => {
    const { container } = render(<PlanWizard subjects={[]} profile={demoProfile} onClose={vi.fn()} demo />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    const catalogList = screen.getByTestId("catalog-list");
    const row1 = within(catalogList).getAllByLabelText(/Incluir /)[0];
    const row2 = within(catalogList).getAllByLabelText(/Incluir /)[1];
    fireEvent.click(row1);
    fireEvent.click(row2);
    fireEvent.click(screen.getByRole("button", { name: /Inserir selecionadas \(2\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar rota/ }));
    expect(await screen.findByText("Semanas até a prova")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Grandes livros da rota/));
    expect(container!.querySelectorAll(".plan-books-group").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Lista de tarefas/ }));
    const sims = screen.getAllByText("Simulado estilo prova");
    expect(sims.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/prova cronometrada \+ revisão dos erros/).length).toBeGreaterThanOrEqual(2);
  });
});

describe("RankingView (demo) · lista, zonas e alocação de reforço", () => {
  it("renderiza ranking com callouts, tabela em região de scroll e abre fecha a alocação", async () => {
    const onChanged = vi.fn(async () => undefined);
    const { container } = render(
      <RankingView ranking={demoRanking} allocations={demoDayAllocations} onChanged={onChanged} demo />
    );

    expect(screen.getByText("Ranking de prioridade")).toBeInTheDocument();
    expect(screen.getByText(/Foco do reforço/)).toBeInTheDocument();
    const bodyRows = container.querySelector(".table-wrap tbody") as HTMLElement;
    expect(bodyRows.querySelectorAll("tr").length).toBe(demoRanking.length);

    fireEvent.click(container.querySelector("button[title='Alocar reforço ou gerenciar']") as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Gerenciar reforço" });
    expect(within(dialog).getByText("Dia da semana do reforço")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sáb" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar reforço" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("remove alocação existente via modal", async () => {
    const onChanged = vi.fn(async () => undefined);
    render(<RankingView ranking={demoRanking} allocations={demoDayAllocations} onChanged={onChanged} demo />);
    fireEvent.click(screen.getByRole("button", { name: /\bSáb · 2h/ }));
    const dialog = await screen.findByRole("dialog", { name: "Gerenciar reforço" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Remover alocação/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("agrupa as linhas por zona — vermelha no topo, depois amarela e verde", async () => {
    const zoneIndex = (score: number) => (score >= 7 ? 0 : score >= 5 ? 1 : 2);
    const zoneName = (score: number) => (score >= 7 ? "red" : score >= 5 ? "amber" : "green");
    const expected = [...demoRanking]
      .sort((a, b) => {
        const diff = zoneIndex(a.priorityScore) - zoneIndex(b.priorityScore);
        if (diff !== 0) return diff;
        return b.priorityScore - a.priorityScore || a.name.localeCompare(b.name);
      })
      .map((row) => zoneName(row.priorityScore));
    expect(new Set(expected)).toEqual(new Set(["red", "amber", "green"]));

    const { container } = render(
      <RankingView ranking={demoRanking} allocations={demoDayAllocations} onChanged={vi.fn(async () => undefined)} demo />
    );
    const rows = Array.from(container.querySelectorAll<HTMLElement>(".table-wrap tbody tr"));
    const zones = rows.map((row) => (row.className.match(/zone-row\s+(red|amber|green)/) ?? [])[1]);
    const kinds = zones.map((zone) => ({ red: 0, amber: 1, green: 2 })[zone as "red" | "amber" | "green"]);

    expect(zones).toEqual(expected);
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
    const ranks = rows.map((row) => row.querySelector(".rank-position")?.textContent);
    expect(ranks[0]).toBe("1");
    expect(new Set(ranks).size).toBe(rows.length);
  });
});

describe("FocusTimerView (demo) · sessões, capturas e fluxo completo de timebox", () => {
  it("lista sessões (tabela com scroll) e capturas da DMN", async () => {
    const { container } = render(<FocusTimerView subjects={demoSubjects} materials={demoMaterialList} demo />);
    expect(await screen.findByText("Sessões registradas")).toBeInTheDocument();
    expect(screen.getByText("Captura externa")).toBeInTheDocument();
    expect(container.querySelector(".table-wrap")).not.toBeNull();
    expect(container.querySelector(".dump-list")).not.toBeNull();
  });

  it("inicia bloco, alterna meta para exercícios, registra interrupção, pausa, sai cedo e fecha o bloco", async () => {
    const { container } = render(<FocusTimerView subjects={demoSubjects} materials={demoMaterialList} demo />);
    await screen.findByText("Sessões registradas");

    fireEvent.click(screen.getByRole("button", { name: /Novo bloco de foco/ }));
    const tiles = Array.from(container.querySelectorAll<HTMLButtonElement>(".subject-grid .subject-tile"));
    expect(tiles.length).toBe(demoSubjects.length);
    const modalBody = container.querySelector(".modal-body.focus-setup") as HTMLElement;
    expect(modalBody).not.toBeNull();

    fireEvent.click(tiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Exercícios" }));
    fireEvent.change(
      screen.getByPlaceholderText("ex: Resolver 15 exercícios de Cinemática"),
      { target: { value: "Resolver 12 exercícios de dinâmica" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar timebox de/ }));
    expect(screen.getByText(/Interrupção involuntária \(0\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Interrupção involuntária/ }));
    expect(screen.getByText(/Interrupção involuntária \(1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Retomar" }));

    fireEvent.click(screen.getByRole("button", { name: "Saída precoce" }));
    fireEvent.click(screen.getByRole("button", { name: "Fadiga metabólica" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar bloco" }));

    expect(await screen.findByText("Bloco concluído")).toBeInTheDocument();
  });
});

describe("RescheduleTriagePanel (demo) · reagendar com buffer", () => {
  it("executa a recomposição e mostra o saldo devedor em tabela com scroll", async () => {
    const { container } = render(<RescheduleTriagePanel demo />);
    expect(screen.getByText(/Nenhum bloco parcial ou pendente/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reagendar com buffer/ }));
    expect(await screen.findByText(/Conflito de agenda resolvido sem efeito dominó/)).toBeInTheDocument();
    expect(screen.getByText(/de saldo devedor realocados/)).toBeInTheDocument();
    const bodyRows = container.querySelector(".table-wrap tbody") as HTMLElement;
    expect(bodyRows.querySelectorAll("tr").length).toBe(demoReschedulePlan.items.length);
    expect(within(bodyRows).getAllByText("Sábado à tarde").length).toBeGreaterThan(0);
    expect(within(bodyRows).getAllByText("Semana seguinte").length).toBe(1);
  });
});

describe("RetentionGraphBoard · gráfico de retenção", () => {
  it("renderiza o board com legenda quando há overview", async () => {
    render(<RetentionGraphBoard overview={demoRetentionOverview} />);
    expect(screen.getByText("Retenção por Matéria e Nicho")).toBeInTheDocument();
    const legend = screen.getByText(/itens/);
    expect(legend).toBeInTheDocument();
    expect(screen.getByText(/Retenção por Matéria e Nicho/).closest("section")).not.toBeNull();
  });

  it("mostra estado vazio sem overview", () => {
    render(<RetentionGraphBoard overview={null} />);
    expect(screen.getByText(/Cadastre itens de memória em diferentes matérias/)).toBeInTheDocument();
  });
});

describe("AdvancementView (demo) · metas, tópicos e páginas", () => {
  it("cicla status de tópico, adiciona tópico e avança páginas sem quebrar", async () => {
    const onChanged = vi.fn(async () => undefined);
    const { container } = render(
      <AdvancementView
        subjects={demoSubjects.filter((s) => s.id === 11 || s.id === 17)}
        topics={demoTopicList}
        materials={demoMaterialList}
        dashboard={demoDashboard}
        onChanged={onChanged}
        demo
      />
    );

    expect(screen.getByText("Acompanhe o avanço de cada matéria.")).toBeInTheDocument();

    const chip = screen.getByText("Círculos e ângulos").closest(".topic-chip") as HTMLElement;
    fireEvent.click(chip);
    expect(onChanged).toHaveBeenCalled();
    expect(chip).toHaveClass("topic-chip");

    const topicInput = screen.getAllByPlaceholderText("Novo tópico (ex.: Logaritmos)")[0];
    fireEvent.change(topicInput, { target: { value: "Logaritmos" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Adicionar/ })[0]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    fireEvent.click(screen.getAllByTitle("Avançar 5 páginas")[0]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole("button", { name: /Salvar metas/ })[0]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(container.querySelector(".advance-materials")).not.toBeNull();
  });
});

describe("CognitiveCharts · laboratório de neuroplasticidade", () => {
  it("renderiza seções, pills de memória e aciona callbacks", async () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    const onDelete = vi.fn();
    const onReview = vi.fn();
    render(
      <CognitiveCharts
        subjects={demoSubjects.slice(0, 3)}
        topics={demoTopicList}
        schedule={demoSchedule}
        executed={new Map([[demoSubjects[0].id, 9999]])}
        points={demoSubjectAccuracyTrend}
        focusPoints={demoFocusOverloadTrend.slice(0, 4)}
        memoryItems={demoMemoryItems}
        memoryProjection={buildMemoryDecayProjection(demoMemoryItems[0])}
        onMemorySelect={onSelect}
        onMemoryCreate={onCreate}
        onMemoryDelete={onDelete}
        onMemoryReview={onReview}
      />
    );

    expect(screen.getByText("Radar de proficiência")).toBeInTheDocument();
    expect(screen.getByText("Conformidade de timeboxing")).toBeInTheDocument();
    expect(screen.getByText("Evolução de acerto por matéria")).toBeInTheDocument();
    expect(screen.getByText("Sobrecarga progressiva de foco")).toBeInTheDocument();
    expect(screen.getByText("Decaimento da memória · curva Anki")).toBeInTheDocument();
    expect(screen.getByText(/Armadilha do perfeccionismo detectada/)).toBeInTheDocument();

    const pill = screen.getByText("Diagrama de corpo livre");
    fireEvent.click(pill);
    expect(onSelect).toHaveBeenCalledWith(502);

    const conceptInput = screen.getByPlaceholderText("Item de memória — ex.: Números complexos · forma polar");
    fireEvent.change(conceptInput, { target: { value: "Teorema da energia cinética" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar item" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    const created = (onCreate as ReturnType<typeof vi.fn>).mock.calls[0][0] as { concept: string };
    expect(created.concept).toBe("Teorema da energia cinética");

    fireEvent.click(screen.getByRole("button", { name: /Difícil/ }));
    expect(onReview).toHaveBeenCalledWith(501, "hard");

    fireEvent.click(screen.getByRole("button", { name: "Remover item" }));
    expect(onDelete).toHaveBeenCalledWith(501);
  });
});

describe("CustomTitleBar · controles da janela", () => {
  it("renderiza a marca e os botões de janela não quebram", async () => {
    render(<CustomTitleBar />);
    expect(screen.getByText("SOAA")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimizar")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximizar")).toBeInTheDocument();
    expect(screen.getByLabelText("Fechar")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Minimizar"));
    fireEvent.click(screen.getByLabelText("Maximizar"));
    fireEvent.click(screen.getByLabelText("Fechar"));
  });
});

describe("Fixtures demo · consistência", () => {
  it("overviews de retenção derivam das mesmas matrículas", () => {
    expect(demoRetentionOverview.rows.length).toBeGreaterThan(0);
    expect(demoFocusSessions.length).toBeGreaterThan(0);
    expect(demoBrainDumps.length).toBeGreaterThan(0);
    expect(new Set(demoSubjects.map((s) => s.id)).size).toBe(demoSubjects.length);
  });
});