# ARCHITECTURE.md - Arquitetura Atual Resumida (SOAA)

## Visão Geral
SOAA é um aplicativo desktop offline/local-first construído com **Tauri 2** (Rust + WebView) + **React 19 + TypeScript + Vite**. Persistência em **SQLite** (rusqlite bundled). IPC command-based entre frontend e backend.

## Camadas

### 1. Frontend (src/client/)
- **Framework:** React 19, TypeScript strict
- **Build:** Vite 8.3.0
- **Componentes principais:** App.tsx, focus.tsx, ranking.tsx, retention.tsx, wizard.tsx, cognitive.tsx, advancement.tsx, triage.tsx, TitleBar.tsx
- **Comunicação:** @tauri-apps/api/core.invoke via pi.ts
- **Estado/UI:** Hooks React + Recharts para gráficos
- **Testes:** Vitest + @testing-library/react (app.test.tsx, ui.test.tsx, catalog.test.ts, demo.test.ts, retentionData.test.ts)

### 2. Shared (src/shared/)
- **types.ts:** Contrato de tipos TS (camelCase). Espelha modelos Rust com serde rename_all camelCase.
- **Papel:** Fonte única para tipos expostos via IPC.

### 3. Backend (src-tauri/src/)
- **main.rs:** Entry point bin
- **lib.rs:** Setup Tauri, registro de commands IPC, validações (alidate_*), with_connection (spawn_blocking + Mutex)
- **database.rs (2714L):** Schema, migrations, seeds, queries + regras de negócio (dashboard, ranking, retention/FSRS, relatórios). Transações via un_write.
- **models.rs (712L):** DTOs Serde (mapeamento camelCase)
- **scheduler.rs (183L):** calculate_schedule (blocos 5min + maiores restos + buffer) + FSRS simplificado (retrievability, grade_multiplier, difficulty_scale, due_date)

### 4. Persistência (SQLite)
- Schema com FKs, CHECKs, GENERATED ALWAYS (computed_ip), índices
- Migrações incrementais (rename pomodoro_sessions→focus_sessions, review_logs→fsrs_reviews, ADD COLUMNs)
- Transações com rollback automático em erro
- WAL-ready via rusqlite; arquivo local em app data dir

## Domínios Principais

- **Planejamento/Schedule:** Distribuição proporcional por IP em blocos de 5min; resto vira project_buffer_minutes (scheduler.rs)
- **Ranking:** Score = strategy(3.0) + deficit(4.0) + volume(1.5) + trend(1.5) com janelas -7/-14 dias; movimento up/down/same/new vs janela anterior (database.priority_ranking)
- **Foco/Pomodoro:** ocus_sessions + ocus_events, zonas (baixa/media/alta), status/parciais, buffer de reagendamento
- **FSRS (simplificado):** R(t)=1/(1+t/(9*S)), stability_after = stability * multiplier * difficulty_scale; reviews em srs_reviews; retention overview hierárquico (global/subject/topic)
- **Dashboard/Analytics:** Agregações SQL (question_results, materials, focus) + relatórios (livestream/consolidado)
- **Biblioteca/Avanço:** study_materials (paginação), topics, metas por matéria

## Arquitetura Técnica
- **Padrão IPC:** Tauri commands (thin controller em lib.rs, heavy logic em database.rs)
- **Concorrência:** 	auri::async_runtime::spawn_blocking + Arc<Mutex<Connection>> (evita bloquear UI)
- **Transações:** un_write wrapper (transaction + commit/rollback)
- **Shared types:** evita drift TS↔Rust
- **Espelho TS:** etentionData.ts espelha lógica backend p/demo/testes (duplicação intencional/controlada)

## Estado Atual (Baseline)
- **Testes Rust:** 12/12 OK
- **Testes Vitest:** 85/85 OK (total 97)
- **Typecheck:** OK
- **Build Frontend:** OK (dist/)
- **Build Tauri Release:** artefatos existentes; fresh build ambiente com deps não resolvidas (não regressão)
- **Lint:** não configurado

## Princípios (preservar)
- Comportamento existente inalterado
- Pequenas mudanças incrementais
- Manter migrations compatíveis
- Preservar fórmulas (schedule 5min, ranking pesos/janelas, FSRS R(t))
- Transações e spawn_blocking mantidos
