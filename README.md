# SOAA — Sistema Operacional de Autodidatismo Avançado

**Aplicativo desktop offline e local-first para planejar, executar e reter o autodidatismo.**

O SOAA (anteriormente "SOAA") é o seu **painel de comando de estudo**: combina planejamento semanal
com tempo planejado, um ranking de prioridade calculado ao vivo, um timer de foco (deep work) com
escalonamento atencional e gráficos de decaimento de memória baseados em SRS/FSRS. Tudo roda
localmente — sem servidor, sem nuvem, seus dados ficam no seu disco.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | [Tauri 2](https://tauri.app) (Rust) |
| Framework de UI | React 19 + TypeScript (strict) |
| Build front | Vite 8 + [Recharts 3](https://recharts.org) (gráficos) + lucide-react (ícones) |
| Banco de dados | SQLite via [rusqlite](https://crates.io/crates/rusqlite) (bundled) — migrations + WAL |
| Validação | Zod |
| Testes backend | `cargo test` (Rust) — retenção, FSRS, demo |

Arquitetura: **frontend React no `src/client`, lógica compartilhada em `src/shared`, backend Tauri/Rust
no `src-tauri`** (invocações `invoke` sobre comandos expostos, dados estruturados em `types.ts`).

---

## Visões (abas) do aplicativo

- **Visão geral** — métricas do dia, retenção, graus de urgência e o próximo bloco de foco.
- **Matriz de priorização / ranking** — ordem de ataque calculada ao vivo, com **zonas de prioridade**
  (Vermelha / Amarela / Verde), movimento (subiu/caiu/novo) e alocação de reforço por dia da semana.
- **Planejamento** — plano semanal (2 semanas), alocação de carga por dia, timebox de reforço por matéria.
- **Foco (pomodoro)** — timebox de deep work com meta (páginas, quantidade de exercícios), timer,
  regiões de foco (profundo / parcial / crítico) e histórico de sessões registradas.
- **Questões e gráficos** — desempenho por matéria/tópico, tendência de acerto e curva de evolução.
- **Avanço** — metas, materiais estudados, estabilidade por tópico.
- **Ranking** — prioridade em tempo real com **zonas de foco** e dicas de retomada.
- **Biblioteca** — materiais de estudo cadastrados.

### Zonas de prioridade (ranking)

O score de cada matéria combina **peso estratégico (IP)**, **déficit contra a meta de acerto**,
**ritmo recente de questões** e a **tendência dos últimos 7 dias**. O resultado nasce numa zona:

| Zona | Faixa | Leitura |
|---|---|---|
| 🔴 Vermelha | score alto / em queda | a matéria **merece atenção hoje** |
| 🟡 Amarela | intermediária | mantenha o ritmo planejado |
| 🟢 Verde | estável / boa acurácia | siga o plano normal |

Cada linha mostra prioridade numérica, movimento relativo (⬆/⬇/novo), % de reforço alocado e a
ação de gerenciar a alocação semanal.

---

## Retenção e decaimento de memória (SRS/FSRS)

O app projeta a **curva de esquecimento** de cada tópico/matéria usando os princípios do
spaced repetition (modelo FSRS):

- **Stability (S)** — intervalo (em dias) em que a retenção permanece alta.
- **Retrievability (R)** — probabilidade de lembrar hoje, calculada pela fórmula de decaimento
  exponencial (curva de Ebbinghaus).
- Cálculo feito em **Rust** (testado via `cargo test`) e plotado com Recharts.

A interseção entre a **linha de alerta (ex.: 90%)** e a curva indica o **ponto ótimo de revisão**:
revisar no momento certo maximiza a consolidação e evita o colapso da rede semântica.

---

## Modo demonstração

O app traz **dados de demonstração** (pré-visualização) para você explorar ranking, gráficos e
zoneamentos sem cadastrar nada. Todos os dados de demo são gerados localmente por `src/client/demo.ts`
e marcados com o selo "Pré-visualização".

---

## Como rodar

Pré-requisitos: Node.js 20+, Rust (stable), e as dependências de sistema do Tauri
([tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
# instalar dependências
npm install

# desenvolvimento (janela Tauri + hot reload)
npm run dev

# só o frontend no navegador
npm run dev:web

# testes do backend Rust (FSRS, retenção, demo)
npm test

# typecheck TypeScript
npx tsc --noEmit

# build de produção (instaláveis)
npm run package        # todos os formatos
npm run package:win    # NSIS (Windows)
npm run package:linux  # AppImage + deb
```

---

## Scripts disponíveis (`package.json`)

| Script | Descrição |
|---|---|
| `dev` | `tauri dev` — abre a janela do app com dev servidor |
| `dev:web` | `vite` — só o frontend no navegador |
| `build` | `vite build` — build do frontend |
| `preview` | `vite preview` |
| `test` | `cargo test --manifest-path src-tauri/Cargo.toml` — testes Rust |
| `package` | `tauri build` |
| `package:win` | `tauri build --bundles nsis` |
| `package:linux` | `tauri build --bundles appimage,deb` |
| `package:mac` | `tauri build --bundles app` |

---

## Estrutura de pastas

```
estudos/
├── src/
│   ├── client/          # UI React (App.tsx, ranking, focus, cognitive, retention, api, demo)
│   │   └── styles.css   # tema dark system-wide
│   └── shared/          # tipos compartilhados (types.ts)
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs       # comandos Tauri
│   │   ├── database.rs  # rusqlite/migrations/consultas
│   │   ├── models.rs    # modelos de domínio
│   │   └── scheduler.rs # reforço/alocação
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json         # scripts npm
└── vite.config.ts
```

---

## Privacidade

**100% offline e local-first:** sem chamadas de rede, sem nuvem, sem analytics. Seus registros de
estudo ficam em um banco SQLite local, protegidos pelo próprio disco. O Tauri só expõe comandos
locais (invoke) para o frontend.

---

## Roadmap (próximos)

- Zonas de retenção no **histórico de foco** (sessões registradas) integradas às zonas do ranking.
- Filtros por período nos gráficos de decaimento e exportação de relatórios.
- Suporte adicional a múltiplos exames (ENEM, ITA, IME já contemplados).
