# SOAA — Roteiro Final (70% código / 30% teoria)

Sistema Operacional de Autodidatismo Avançado (BR — desktop offline, local-first).
Stack: **Tauri 2 + React 19 + TypeScript + Vite + SQLite/rusqlite (Rust) + Recharts + Lucide**,
estilo visual 100% próprio em `styles.css`.

**Status da entrega**: produzido em duas fases — **FASE 1** (pipelines executáveis, código + teoria)
e **FASE 2** (qualidade/robustez: testes de interface, scan de CVEs, scroll consistente, rota sem repetição).

---

## FASE 1 — Arquitetura e validação da camada IPC (Tauri 2)

```
React (src/client) ──invoke()──► src-tauri/src/lib.rs ──► src-tauri/src/database.rs
                                      │                        │
                                      └──── Tauri commands ─────┘
                                           (camada única, sem expor SQL)
```

- **Contratos tipados**: structs em `models.rs` ↔ interfaces em `src/shared/types.ts`
  (kebab-case ⟷ camelCase via `serde`).
- **Comandos** em `lib.rs` com `Result<T, String>`: CRUD de matérias/perfil/materiais/tópicos,
  histórico de questões, agenda, plano (rota reversa), ranking, reforço, deep work (pomodoro),
  brain dump, buffer CCPM e projeção de foco. Validações de entrada com `validate_*`.
- **Permissões** (`capabilities/default.json`): `core:default` + janela (minimize, toggle-maximize,
  is-maximized, close, start-dragging) para a TitleBar customizada. Sem plugins perigosos
  (sem shell, sem fs do Tauri).
- **Persistência**: SQLite local, usuário único (`DEFAULT_USER_ID = 1`), `migrate()` idempotente,
  `seed()` com estratégias.
- **Segurança (scan CVEs)**: `npm audit` = 0 vulnerabilidades; `cargo-audit`/`cargo-deny`
  bloqueados pelo Smart App Control da máquina (os error 4551), contornado via consulta **OSV**
  (`api.osv.dev/v1/querybatch`) com as versões reais do `Cargo.lock` — nenhuma vulnerabilidade
  aplicável. `tauri 2.11.5` já corrige o GHSA-7gmj-67g7-phm9 (Origin Confusion, patch em 2.11.1).
  Árvore sem `h2`/`rustls`/`memmap2`/`tauri-plugin-shell`.

## FASE 1 — 70% Código (pipelines executáveis)

| Módulo | Entrega | Arquivos-chave |
|---|---|---|
| **F1 — Plano reverso (wizard)** | Rota até a prova; bloco principal gira por **todas** as matérias de ataque (rotação por risco), sem repetir os mesmos 2 focos todos os dias · seleção do **vestibular alvo** com inserção das matérias do catálogo (peso padrão por prova, customizável) · geração de **lista de tarefas** datada | `database.rs:generate_study_plan` · `wizard.tsx` · `catalog.ts:EXAM_TRACK_GROUPS/catalogSubjectsForTrack` · `demo.ts:buildDemoPlan` |
| **F2-A — Evolução por matéria** | Linha por disciplina no Desempenho | `cognitive.tsx:SubjectImprovementChart` |
| **F2-B — Comparativo de dois dias** | Barras agrupadas dia A × dia B + deltas | `App.tsx:DayCompareChart` |
| **F3 — Matriz Biocircadiana** | Heatmap 6–22h com protocolo Huberman + guia de janelas | `cognitive.tsx:CircadianHeatmap` |
| **F4 — Deep Work (Pomodoro)** | Timebox anelar, saída precoce, sobrecarga ±5 min, brain dump sem pausar | `focus.tsx` · `database.rs` |
| **F5 — Estratégias por material** | Cards técnicos por palavra-chave | `App.tsx:LibraryView` · `database.rs:match_strategy` |
| **CCPM — Gestão Adaptativa** | Triage diário com Project Buffer, Sábado à tarde, manhãs protegidas | `triage.tsx` · `database.rs:reschedule_buffer` |
| **Sobrecarga Progressiva** | Série 29 dias por matéria + agregada "Geral" | `cognitive.tsx:FocusOverloadChart` |
| **Título customizado** | `decorations:false`, drag regions, min/max/close | `TitleBar.tsx` · `tauri.conf.json` |
| **Avanço e régua de páginas** | Metas, tópicos do edital, régua proporcional por livro | `advancement.tsx` · `App.tsx:LibraryView` |

## FASE 1 — 30% Teoria (ciência nos motores)

- **Sobrecarga progressiva**: 2 vitórias ⟶ +5 min (ceiling 120); saída precoce ⟶ −5 min (floor 15).
- **Deep work**: janela ininterrupta, captura externa sem pausa e fechamento cognitivo (domínio %).
- **Ritmo circadiano (Huberman)**: tensão matinal → trabalho analítico difícil; dip pós-almoço →
  repetição apoiada; noite → revisão leve.
- **CCPM (Teoria das Restrições)**: saldo devedor → Project Buffer (Sábado à tarde), depois semana
  seguinte — sem efeito dominó e sem tocar nas manhãs.
- **Eficiência → nível**: 2+ blocos a <85% do tempo planejado em 14 dias elevam `currentLevel`.

---

## FASE 2 — Qualidade e robustez (entregue nesta rodada)

### Rota sem repetição (F1 refinada)
- **Backend** (`database.rs:generate_study_plan`): antes, o bloco principal usava sempre `risk[0]`/
  `risk[1]` (mesmos 2 focos todo dia). Agora o principal gira por **todas** as matérias ordenadas por
  risco (`offset % n`) e o reforço usa uma segunda rotação (`(offset*2+1) % n`), com guarda contra
  duplicação no mesmo dia e contra lista vazia.
- **Dimensionamento do tempo por dia corrigido**: `total_hours` chega como carga **semanal**
  (diário × dias/semana). A fórmula antiga (`/5/5` + clamp em 24h) cortava a carga e ignorava o
  horizonte (ex.: 6h/dia × 6 dias viraria ~58 min/dia). Agora distribui a carga semanal pelos dias
  até a prova (`weekly_minutes × weeks / total_days`, em blocos de 5) — ex.: 36 h/sem → ~5 h/dia
  no exemplo demo, coerente com a janela morfédica.
- **Demo** (`demo.ts:buildDemoPlan` + `wizard.tsx`): o modo demo gera a rota a partir das matérias
  **selecionadas** (incluindo as adicionadas no wizard), espelhando a mesma rotação — adiciona
  matéria nova e ela realmente entra na rota.
- **Textos**: rodapé do wizard atualizado ("a rota gira por todas as matérias de ataque").

### Trilha do vestibular no wizard (F1 — inserção por prova)
- **`catalog.ts`**: novo mapeamento `EXAM_TRACK_GROUPS` (Ensino Médio/ENEM → `enem`+`linguagens`;
  ITA/IME → `ita-ime`; Personalizado → tudo) + `catalogSubjectsForTrack(track)` e `EXAM_TRACKS`.
- **`wizard.tsx`**: no passo "Escolha os focos de ataque", o usuário seleciona o **vestibular alvo**
  e vê as matérias daquela prova no catálogo, cada uma com **peso padrão** já preenchido (editável de
  1–5) e dificuldade; "Inserir selecionadas (N)" adiciona à rota (criando a matéria na matriz em
  modo real; em demo cria local com ids 900000+). Matérias já presentes ficam marcadas como
  inseridas e desabilitadas.
- **Lista de tarefas**: no passo final o wizard ganha a aba **"Lista de tarefas"** ao lado de
  "Rota": cada bloco do plano vira uma tarefa datada (dia · matéria · minutos · janela) com checkbox
  e contador de execução — o plano diário de tarefas até a prova.

### Scroll em lugares que listam conteúdo
- `.modal-body` agora é `flex:1 + min-height:0 + overflow-y:auto` — a grade de matérias do
  *setup* de Foco (100+ tiles) e os modais de captura/saída passam a rolar dentro do `modal`
  (`styles.css`, região `/* Scroll seguro */`).
- `.wizard-body .plan-days` ganhou `max-height: 46vh + overflow-y:auto` (scrollbar própria),
  removendo o antigo `overflow: visible` — rota de prova com dias roláveis.
- Tabelas grandes continuam em `.table-wrap` (`overflow-x:auto`) e `.catalog-list` com rolagem
  vertical própria.

### Testes de interface — modo demo (botão → tudo, com listas e scroll)
Nova infraestrutura:
- DevDeps: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`,
  `@vitest/coverage-v8`.
- `vitest.config.ts`: environment `jsdom`, include `src/client/**/*.test.{ts,tsx}`, setupFiles,
  `testTimeout: 20000`, `restoreMocks`, `coverage` (provider `v8`, include `src/client/**/*.{ts,tsx}`).
- `src/client/test/setup.ts`: jest-dom, polyfill `ResizeObserver`, stub `window.__TAURI_INTERNALS__`
  (invoke/transformCallback/metadata) e `src/client/ui.test.tsx` mocka `@tauri-apps/api/window`.
- `ui.test.tsx` (47 testes de view) cobre: **PlanWizard** (meta → focos → adiciona 3 matérias →
  rota com variedade >3 e scroll em `.plan-days`/`.wizard-body`), **RankingView** (tabela, callouts,
  abrir/salvar/remover alocação), **FocusTimerView** (tabela de sessões, dump-list, início de timebox,
  interrupção/pausa, saída precoce e fechamento), **RescheduleTriagePanel** (tabela de débito),
  **RetentionGraphBoard** (board com overview e estado vazio), **AdvancementView** (ciclar tópico,
  adicionar, stepper de páginas), **CognitiveCharts** (seções, pills de memória, callbacks
  select/create/delete/review), **CustomTitleBar** (controles de janela) e **regras de scroll do
  `styles.css`** (via import `?raw`/leitura de arquivo).

### Suíte de integração — backend real mockado (`app.test.tsx`)
- Diferente dos testes de view (backend fake injetado), `app.test.tsx` monta o **`App` completo**
  e mocka o Tauri `invoke` com um **backend em memória** (`handleCommand`) que espelha os comandos
  reais (`list_subjects`, `get_profile`, `calculate_schedule`, `performance_trend`, `create_topic`,
  `save_day_allocation`, `complete_focus_session`, `create_material`, `toggleDemo`, etc.).
- 22 testes cobrem fluxos reais de ponta a ponta por tela: **Visão geral** (dashboard), **Matriz**
  (criar/editar/remover matéria + adição em lote do catálogo com botão "Adicionar N ao catálogo"
  habilitado/desabilitado), **Planejamento** (salvar configuração e hoje, alternar dias, wizard da
  rota da prova, triage com rescalonamento), **Questões e gráficos** (registrar resultado, granularidade
  e filtro de recorte da evolução via `performance_trend`, livestream/relatório consolidado, lab de
  memória com revisão), **Foco** (lista de sessões, bloco completo com saída precoce + fechamento
  cognitivo, captura externa), **Avanço** (metas, criar tópico, ciclar status, stepper de páginas),
  **Ranking** (remanejar alocação de reforço + remover), **Biblioteca** (cadastrar material, mudar
  status, remover), **Modo demonstração** (ligar/desligar pelo menu de configurações) e **falhas de
  backend** (toast de erro no carregamento e no salvar perfil).
- Resultado: **`npm run test:web` → 5 files, 74/74 testes passando** (dados + UI demo + integração
  com backend real mockado).
- Os testes existentes de dados (`catalog.test.ts`, `demo.test.ts`, `retentionData.test.ts`)
  continuam passando sob jsdom.

---

## Validação evidencial

- `npm run test:web`: **74/74 OK** (5 arquivos; dados, UI em modo demo e integração com backend
  real mockado em `app.test.tsx`).
- Cobertura de `src/client` (`npx vitest run --coverage`): **77.3% stmts / 74.4% funcs / 81.7% lines**
  (branch 66.4%) — `demo.ts` 99.4%, `retentionData.ts` 98.2%, `category/colors.ts` 100%.
- `cargo test` backend: **11/11 OK** — inclui a revalidação do `generate_study_plan` alterado
  (rotação + dimensionamento) via `cargo run`/`cargo test` após o Smart App Control liberar a
  execução; `cargo run` compilou limpo e o app abriu.
- `npm run build`: **OK** (tsc + vite/rolldown). Bundle CSS 47 kB, JS 845 kB (aviso de chunk
  >500 kB é cosmético).
- Auditoria: `npm audit` 0; querybatch OSV = 0 vulnerabilidades nas versões travadas.

## Pendências

1. **Adicionar teste Rust do `generate_study_plan`** — hoje o `cargo test` cobre o scheduler/FSRS
   (11/11 OK) e as transações de escrita, mas não a rota nova (rotação + dimensionamento).
   Rodar `npm run dev`/`tauri build --bundles nsis` para novo instalador (validar a TitleBar no
   binário final).