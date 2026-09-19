# SOAA — Roteiro Final (70% código / 30% teoria)

Sistema Operacional de Autodidatismo Avançado (BR — desktop offline, local-first).
Stack: **Tauri 2 + React 19 + TypeScript + Vite + SGLite/rusqlite (Rust) + Recharts + Lucide**,
estilo visual 100% próprio em `styles.css` (sem Tailwind de runtime).

---

## 1. Arquitetura e validação da camada IPC (Tauri 2)

```
React (src/client) ──invoke()──► src-tauri/src/lib.rs ──► src-tauri/src/database.rs
                                      │                        │
                                      └──── Tauri commands ─────┘
                                           (camada única, sem expor SQL)
```

- **Contratos tipados**: structs em `models.rs` ↔ interfaces em `src/shared/types.ts`,
  serializados por `serde` (kebab-case ⟷ camelCase via `#[serde(rename_all)]`).
- **Comandos registrados** em `lib.rs` com `Result<T, String>`: CRUD de matérias/perfil/materiais/
  tópicos, historico de questões, agenda, plano, ranking, reforço, deep work (pomodoro),
  brain dump, buffer CCPM e sobretudo de foco. Validações de entrada com `validate_*`.
- **Permissões** (`capabilities/default.json`): `core:default` + janela (minimize,
  toggle-maximize, is-maximized, close, start-dragging) para a TitleBar customizada.
- **Persistência**: SQLite local, usuário único (`DEFAULT_USER_ID = 1`), `migrate()` idempotente
  com `PRAGMA table_info` + `ALTER TABLE`; `seed()` com estratégias antes do early-return.
- **Estado verificado**: `cargo test` 3/3 OK, `cargo build` limpo, `vite build` OK,
  `tsc --noEmit` com **único** erro pré-existente (TS2882 do side-effect de `styles.css`).

---

## 2. Item 1 — 70% Código (pipelines executáveis)

| Módulo | Entrega | Arquivos-chave |
|---|---|---|
| **F1 — Plano reverso (wizard)** | Geração de rota até a prova com foco em janelas matinais | `database.rs:generate_study_plan` · `App.tsx:PlanWizard` |
| **F2-A — Evolução por matéria** | Linha por disciplina no Desempenho | `cognitive.tsx:SubjectImprovementChart` |
| **F2-B — Comparativo de dois dias** | Barras agrupadas dia A × dia B + deltas | `App.tsx:DayCompareChart` |
| **F3 — Matriz Biocircadiana** | Heatmap 6–22h com protocolo Huberman + guia de janelas | `cognitive.tsx:CircadianHeatmap` |
| **F4 — Deep Work (Pomodoro)** | Timebox anelar, saída precoce, sobrecarga +/-5 min, brain dump sem pausar, motivos, histórico | `focus.tsx` · `database.rs:suggest_focus_timebox / complete_pomodoro_session / log_brain_dump` |
| **F5 — Estratégias por material** | Cards técni a por palavra-chave (interleaving, espaçado, recall ativo) | `App.tsx:LibraryView` · `database.rs:match_strategy` |
| **CCPM — Gestão Adaptativa** | Triage diário com Project Buffer, Sábado à tarde, manhãs protegidas | `triage.tsx` · `database.rs:reschedule_buffer / list_buffer_allocations` |
| **Sobrecarga Progressiva de Foco** | Série 29 dias por matéria + agregada "Geral" | `cognitive.tsx:FocusOverloadChart` · `database.rs:focus_overload_trend` |
| **Título customizado** | `decorations:false`, arrasto `data-tauri-drag-region`, min/max/close com continuidade de cor | `TitleBar.tsx` · `tauri.conf.json` · `capabilities/default.json` |
| **Avanço e régua de páginas** | Metas de acerto/cobertura, tópicos do edital, régua proporcional por livro | `advancement.tsx` · `App.tsx:LibraryView` |

## 3. Item 2 — 30% Teoria (Ciência aplicada nos motores)

- **Sobrecarga progressiva**: micro-ajuste do timebox a partir da resistência atencional
  real (2 vitórias ⟶ +5 min, ceiling 120; saída por fadiga/distração/dificuldade ⟶ −5 min, floor 15) —
  princípio de treino "progressive overload" aplicado ao foco.
- **Deep work**: janela ininterrupta (60–90 min), capturas externas **sem** recompensa de pausa,
  e fechamento cognitivo ao registrar domínio (%) da meta.
- **Ritmo circadiano (Huberman)**: luz da manhã → cortisol; pico de dopamina ~2–4 h após despertar
  (10–12 h) para o trabalho analítico difícil; dip pós-almoço para repetição apoiada;
  descida noturna só para revisão leve — com horários estáveis para o sono.
- **CCPM (Teoria das Restrições)**: saldo devedor (planejado − executado) vai para um único
  Project Buffer (Sábado à tarde = 50% das horas do dia) e, se estourar, é redistribuído na
  semana seguinte — **sem efeito dominó** e sem tocar nas manhãs (hiperfoco preservado).
- **Eficiência → nível**: 2+ blocos concluídos a <85% do tempo planejado em 14 dias elevam o
  `currentLevel` da matéria (até o `targetLevel`), liberando tempo para os gargalos do edital.

---

## 4. Validação evidencial

- `cargo test` no backend: 3/3￼ passando (scheduler + helpers).
- Build de produção: `vite build` limpo; bundle CSS 35 kB, JS 810 kB (aviso de chunk > 500 kB é
  cosmético — recharts incentiva import dinâmico futuro).
- TypeScript: apenas o erro pré-existente `main.tsx(4,8) TS2882` (import side-effect de CSS),
  sem nenhum erro novo advindo das features F1–F5, CCPM, TitleBar e régua de páginas.

## 5. Próximos passos sugeridos (fora do escopo atual)

1. `tauri build --bundles nsis` para novo instalador (validar a TitleBar no binário final).
2. Testes de integração IPC com `#[tauri::command]` + mock de DB.
3. Importação dinâmica das view de gráficos para redução do bundle.
4. Migrar formatação visual para variáveis CSS (paleta única) e preparar tema claro opcional.