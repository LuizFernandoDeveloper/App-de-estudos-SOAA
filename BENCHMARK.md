# BENCHMARK.md — O que o SOAA é, o que a categoria faz, e o que falta

**Data:** 2026-10-16
**Método:** leitura do código-fonte e do README do SOAA + pesquisa em fontes primárias
(documentação oficial dos apps e literatura acadêmica indexada). Onde não foi possível
verificar a fonte, está marcado explicitamente como **NÃO VERIFICADO** em vez de ser
apresentado como fato.

> ⚠️ **Nota de honestidade metodológica.** A ferramenta de busca web falhou durante toda a
> sessão de pesquisa (erro de endpoint). Todo o material abaixo veio de `web_fetch` em URLs
> exatas e, onde havia bloqueio de bot (Cloudflare), da Wayback Machine — esses casos estão
> marcados como *(verificado no arquivo)*. Sites que bloquearam: qconcursos.com, habitica.fandom.com,
> supermemo.guru direto, streaksapp.com, Me Salva, Descomplica, Kuadro. Páginas do INEP
> sobre TRI retornaram 404 ou apenas navegação — a lacuna está declarada no fim.

---

## 1. O que o SOAA é (leitura do próprio código)

Um **sistema operacional de estudo pessoal**, desktop e 100% offline (Tauri 2 + React 19 +
Rust + SQLite). A tese do produto não é "acervo de conteúdo" — é **camada de método**: o
app não ensina, ele decide o que atacar, executa o bloco e mede a memória.

Os motores que existem hoje, verificados no código:

| Motor | Onde vive | O que faz |
|---|---|---|
| Priorização | `database.rs::priority_ranking` | `score = estratégia(3,0) + déficit(4,0) + volume(1,5) + tendência(1,5)`, janelas de −7/−14 dias, zonas em 7,0 e 5,0 |
| Memória | `scheduler.rs` + `retentionData.ts` | FSRS simplificado: `R = 1/(1 + Δt/(9·S))`, revisão no ponto dos 90% |
| Planejamento | `scheduler.rs::calculate_schedule` | distribuição proporcional por IP em blocos de 5 min; resto vira `project_buffer_minutes` |
| Rota de prova | `demo.ts::buildDemoPlan` + backend | plano reverso por vestibular, 2 fases (construção com recall espaçado → reta final com simulados) |
| Foco | `focus.tsx` | timebox, pausa, interrupções, saída precoce justificada → saldo devedor |
| Sinergia | `synergy.ts` | cruza ranking + FSRS + questões + edital + foco + curso e devolve até 5 "ataques do dia" |
| Calibração | `weights.ts` | sugere peso 1–5 por matéria explicando o motivo, aplicável em lote |
| Simulados | `exams.ts` | curadoria de provas oficiais por trilha (INEP, FUVEST, ITA, IME, College Board) |

**Diagnóstico da categoria:** o SOAA já é mais sofisticado no *motor* que os planejadores
brasileiros (Estudaqui, Kuadro) e mais integrado que o Anki — mas perde nos *rituais de
superfície* que os usuários usam para se manter no hábito e para confiar no motor.

---

## 2. O que a categoria faz (tabela de referência)

### 2.1 Anki — analytics e agendamento

| Recurso | O que faz exatamente | Por que importa | Fonte |
|---|---|---|---|
| Future Due | Projeta vencimentos por dia futuro em **dois cenários**: (a) estudando tudo todo dia (barras) e (b) não estudando nada (área cinza). Não conta o que já está atrasado | É o número que decide se a meta é sustentável; evita o colapso de estudar 200 cartões novos e ser esmagado pelas revisões | [docs.ankiweb.net/manual/stats](https://docs.ankiweb.net/manual/stats.md) |
| Daily load | `Σ 1/Iₙ` sobre os cartões (Iₙ = intervalo; I<1 dia conta 1). Ex.: intervalos 10d e 50d → 0,12 revisões/dia | Converte intervalo em "custo diário" — permite prometer "X min/dia" em vez de "X cartões" | [stats](https://docs.ankiweb.net/manual/stats.md) |
| Calendar (heatmap) | Atividade de revisão dia a dia, clicável | Consistência visível = motivação (mesmo padrão do GitHub) | [stats](https://docs.ankiweb.net/manual/stats.md) |
| True Retention Table | **maduro = intervalo ≥ 21 dias**; conta **só a primeira revisão de cada dia**; **Again = Fail**, Hard/Good/Easy = Pass | Compara retenção **real** com a **desejada**: é o teste de honestidade do motor | [stats](https://docs.ankiweb.net/manual/stats.md) |
| Young vs mature | Jovem < 21 dias; maduro ≥ 21 dias | Sem isso, "retenção de 92%" pode ser só cartão novo | [getting-started](https://docs.ankiweb.net/manual/getting-started.md) |
| Leeches | Ao atingir **8 lapsos** (configurável): tag `leech` + **suspende**; novos avisos a cada metade do limiar (12, 16, 20…) | O item difícil consome tempo desproporcional sem gerar acerto | [leeches](https://docs.ankiweb.net/manual/leeches) |
| Framework de 6 passos para leeches | editar → criar pré-requisitos → reformular → deletar se não crítica → suspender e esperar → mnemônico | Transforma "cartão ruim" em decisão de produto | [controlaltbackspace.org/leech](https://controlaltbackspace.org/leech/) |
| Undo | Ctrl+Z desfaz a última avaliação, mesmo após navegar | Um clique errado contamina o histórico que alimenta o motor | [studying](https://docs.ankiweb.net/manual/studying.md) |
| Custom study / cram | Deck filtrado: revisar esquecidos/adiantado, por tag, por estado, aumentar limites | "Modo véspera de prova" sem quebrar o agendamento | [filtered-decks](https://docs.ankiweb.net/manual/filtered-decks) |
| Ordenação "relative overdueness" | Com FSRS vira "ascending retrievability" | É a heurística de triagem de backlog que o saldo devedor do SOAA precisa | [filtered-decks](https://docs.ankiweb.net/manual/filtered-decks) |
| Fuzz (jitter) | Ruído pequeno no intervalo; **não é possível desligar** | Sem ele, cartões introduzidos juntos voltam sempre no mesmo dia → picos de carga | [studying](https://docs.ankiweb.net/manual/studying.md) |
| Easy Days | Reduz levemente a carga em dias específicos da semana | Resolve o conflito entre rotina humana e agendamento ótimo | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Cronômetro com teto de 60 s | Acima de 60 s considera distração e **trava o tempo gravado** | Ponte entre "carga em cartões" e "carga em minutos", sem estatística envenenada | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Revlog | Tabela SQLite: `id, cid, ease, ivl, lastIvl, factor, time, type` | Formato que torna possível otimizar parâmetros; o SOAA está a um join disso | [stats](https://docs.ankiweb.net/manual/stats.md) |
| Answer Buttons | Quantas vezes Again/Hard/Good/Easy, por estado, com **% de acerto** | Superfície de calibração: se Hard virou "esqueci", o modelo quebra | [stats](https://docs.ankiweb.net/manual/stats.md) |

### 2.2 FSRS moderno e SuperMemo

| Recurso | O que faz exatamente | Fonte |
|---|---|---|
| Curva FSRS-4.5/5/6 | `R(t,S) = (1 + FACTOR·t/S)^DECAY`, com R=0,9 quando t=S. **FSRS-4.5: DECAY=−0,5, FACTOR=19/81** — cai rápido antes de S e achata depois. FSRS-6 torna o decaimento **treinável** (`w₂₀`) | [The-Algorithm](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-Algorithm.md) |
| Dificuldade D ∈ [1,10] | `D₀(G) = w₄ − e^(w₅(G−1)) + 1`; atualização com **linear damping** `ΔD = −w₆(G−3)`, `D' = D + ΔD(10−D)/9`; depois **mean reversion** para `D₀(4)` | [The-Algorithm](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-Algorithm.md) |
| Incremento de estabilidade | `S'ᵣ = S·(e^w₈(11−D)·S^(−w₉)·(e^w₁₀(1−R)−1)·[w₁₅ se Hard]·[w₁₆ se Easy] + 1)`. Propriedades: D maior → ganho menor; S maior → ganho menor; **R menor → ganho maior** | [The-Algorithm](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-Algorithm.md) |
| Estabilidade pós-esquecimento | `S'f = w₁₁·D^(−w₁₂)·((S+1)^(w₁₃)−1)·e^(w₁₄(1−R))`. Falhar **não** devolve o item ao zero | [The-Algorithm](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-Algorithm.md) |
| Retenção desejada | Configuração principal; **default 90%**; acima de 97% "pode ser insuportável" | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Multiplicador de intervalo | Mudar retenção de 85%→90%: `log(0,90)/log(0,85) = 0,65` → estudar 65% dos intervalos. **+5 p.p. ≈ 35% mais frequência** (não linear) | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Otimizador (MLE + BPTT) | Estima S e D do histórico; loss `−[p·log P + (1−p)·log P]`; recomenda otimizar **1×/mês** (ou quando o nº de reviews dobra) e **presets por material** | [mecanismo de otimização](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-mechanism-of-optimization.md) |
| Simulador "Help Me Decide" | Simula X dias com N cartões novos/dia usando D, S, R reais + parâmetros + retenção desejada; devolve reviews/dia ou **minutos/dia** | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Passos curtos < 1 dia | Com FSRS, passos ≥ 1 dia são desencorajados; repetir no mesmo dia **não contribui significativamente** para memória de longo prazo | [deck-options](https://docs.ankiweb.net/manual/deck-options.md) |
| Modelo de dois componentes | `stability` + `retrievability` descrevem uma memória unitária (Wozniak, 1990/1995; paralelo em Bjork, *New Theory of Disuse*, 1992); base do SM-17 | [supermemo.guru (arquivo)](https://web.archive.org/web/20231227053041/https://supermemo.guru/wiki/Two_component_model_of_memory) |
| Intervalo ótimo a 95% | Fórmula universal para pares associados determinada **para retenção de 95%** (não 90%) | [PMID 8023714](https://pubmed.ncbi.nlm.nih.gov/8023714/) |
| 20 regras de formulação | Perguntas simples (informação mínima), evitar listas (usar cloze), redundância, personalizar | [supermemo.guru (arquivo)](https://web.archive.org/web/20231217152815/https://supermemo.guru/wiki/20_rules_of_knowledge_formulation) |
| Incremental reading | Funil: web → seleção → **extracts** → cloze → estabilização. O Anki nota que o **FSRS não foi desenhado** para IR | [supermemo.guru (arquivo)](https://web.archive.org/web/20240103031749/https://supermemo.guru/wiki/Incremental_reading) |

### 2.3 Foco e hábito

| Recurso | O que faz exatamente | Fonte |
|---|---|---|
| Streak + best streak | "Your goal is to build a streak of **consecutive days**"; mostra atual e recorde; até 24 tarefas, tarefas **negativas**, cronometradas, notas por tarefa, lembretes | [Streaks · App Store](https://apps.apple.com/us/app/streaks/id963034692) |
| "Não quebre a corrente" | Um X por dia de prática; ancestral cultural do heatmap | [Lifehacker (arquivo)](https://web.archive.org/web/20201231095222/https://lifehacker.com/281626/jerry-seinfelds-productivity-secret) |
| Heatmap de contribuições | Calendário de atividade, clicável, com faixa de datas selecionável | [GitHub Docs](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile) |
| Gamificação com perda | A árvore **cresce** enquanto você foca e **morre se sair antes** | [Forest · App Store](https://apps.apple.com/us/app/forest-focus-for-productivity/id866450515) |
| Histórico visual + tags | Semana/mês/ano como floresta; estatísticas por tags customizadas | [Forest](https://apps.apple.com/us/app/forest-focus-for-productivity/id866450515) |
| Pomodoro + tarefa + relatório | Execução sobre a tarefa, relatório de tempo por projeto/período | [focus todo](https://www.focustodo.cn/) |
| Metas de tempo | Metas diárias/semanais de horas com lembrete de "não rastreou o suficiente" | [Toggl](https://support.toggl.com/en-us/category/features-108wk1w/) |

### 2.4 Planejadores de estudo brasileiros

| Recurso | O que faz exatamente | Fonte |
|---|---|---|
| Ciclo de estudos com horas-alvo | Monta o plano pela prova + disponibilidade e mostra a ordem do dia **com % de ciclo fechado** (ex.: "79% · 14:18/18:00h") | [Estudaqui](https://www.estudaqui.com/) |
| Acerto por disciplina **e assunto** + delta semanal | "▲ 6 p.p. vs. semana anterior"; caso documentado: disciplina com 58% escondia tópico com 41% | [Estudaqui · blog](https://www.estudaqui.com/blog/como-estudar/da-materia-ao-assunto-onde-sua-nota-e-prejudicada/) |
| Guardas estatísticos | (1) exigir ~**20 questões** por assunto antes de mudar o plano; (2) alvo de acerto pela **nota de corte**, não por 70% genérico; (3) não comparar disciplinas de volumes muito diferentes | [Estudaqui · blog](https://www.estudaqui.com/blog/como-estudar/da-materia-ao-assunto-onde-sua-nota-e-prejudicada/) |
| Revisões programadas com lembrete | Intervalos configuráveis (esquema clássico 1/7/14/30 dias) e notificação na data | [Estudaqui · FAQ](https://www.estudaqui.com/faq-perguntas-frequentes/) |
| App que não fornece conteúdo | "Funciona com qualquer material… o app cuida do planejamento, controle de tempo, estatísticas e revisões" | [Estudaqui · FAQ](https://www.estudaqui.com/faq-perguntas-frequentes/) |
| Banco de questões comentado em escala | "1.804.059 questões comentadas por professores" / 4.209.691 cadastradas | [TEC Concursos](https://www.tecconcursos.com.br/) |
| Caderno de erros | Prática com tutorial oficial dedicado | [TEC · central de ajuda](https://tecconcursos.zendesk.com/hc/pt-br) |
| Edital verticalizado + curadoria | Guias por concurso, mapa dos concursos, coaching | [Estratégia Concursos](https://concursos.estrategia.com/) |
| "Ciclo de estudos" como categoria editorial | Página de captura: "monte seu ciclo perfeito em menos de 2 minutos" | [Estudaqui · blog](https://www.estudaqui.com/blog/) |

### 2.5 Base científica (citações verificadas, com PMID)

| Mecanismo | Achado-chave | Referência |
|---|---|---|
| Retrieval practice | Após 5 min, reestudar ganha; em provas atrasadas (2 dias/1 semana), **testar** produz retenção substancialmente maior — mesmo com o reestudo **aumentando a confiança** | Roediger & Karpicke 2006, *Psych Science* 17(3):249–255 · [PMID 16507066](https://pubmed.ncbi.nlm.nih.gov/16507066/) |
| Retrieval é crítico, não opcional | **Reestudar não teve efeito** no recall atrasado; **retestar teve efeito grande**. As previsões dos alunos sobre o próprio desempenho **não correlacionaram** com o real | Karpicke & Roediger 2008, *Science* 319:966–968 · [PMID 18276894](https://pubmed.ncbi.nlm.nih.gov/18276894/) |
| Retrieval como princípio geral | Eficaz **mesmo sem feedback**; com feedback o benefício **aumenta**; gera conhecimento flexível/transferível | Roediger & Butler 2011, *TiCS* 15(1):20–27 · [PMID 20951630](https://pubmed.ncbi.nlm.nih.gov/20951630/) |
| Spacing effect (meta-análise) | **839 avaliações**, **317 experimentos**, **184 artigos**: o intervalo entre estudos e o intervalo até o teste **operam conjuntamente** — o intervalo ideal **cresce** com o prazo | Cepeda et al. 2006, *Psych Bulletin* 132(3):354–380 · [PMID 16719566](https://pubmed.ncbi.nlm.nih.gov/16719566/) |
| Ridgeline do espaçamento | **+1.350 participantes**; o gap ótimo como **proporção** do atraso cai de ~**20–40%** (teste em 1 semana) para ~**5–10%** (teste em 1 ano) | Cepeda et al. 2008, *Psych Science* 19(11):1095–1102 · [PMID 19076480](https://pubmed.ncbi.nlm.nih.gov/19076480/) |
| Alunos desconhecem espaçamento | **175 de 193** universitários julgaram **errado**: os cronogramas mais espaçados/intercalados foram vistos como **mais difíceis, menos agradáveis e menos comuns** | Hartwig, Rohrer & Dedrick 2022, *JEP: Applied* 28(1):100–113 · [PMID 34990156](https://pubmed.ncbi.nlm.nih.gov/34990156/) |
| Curva do esquecimento (replicação) | Replicação de Ebbinghaus: **1 sujeito, 70 horas**; a curva **não é lisa** — provável **salto a partir de 24 h** | Murre & Dros 2015, *PLoS ONE* 10(7):e0120644 · [PMID 26148023](https://pubmed.ncbi.nlm.nih.gov/26148023/) |
| Ranking de técnicas | **practice testing** e **distributed practice** = alta utilidade; interleaving/self-explanation = moderada; **summarization, highlighting, rereading** = **baixa** — e são as mais usadas pelos alunos | Dunlosky et al. 2013, *PSPI* 14(1):4–58 · [PMID 26173288](https://pubmed.ncbi.nlm.nih.gov/26173288/) |
| Successive relearning | Continuar com questões até acertar **todas**; evitar highlighting/rereading; feedback deve ser **explicativo** | D'Antoni et al. 2019, *Clinical Anatomy* 32(1):156–163 · [PMID 30307063](https://pubmed.ncbi.nlm.nih.gov/30307063/) |
| Metacognição / cues | Monitoramento eficaz exige **cues diagnósticos**; autogeração de cues e **cues gerados com atraso** funcionam | de Bruin, Dunlosky & Cavalcanti 2017, *Medical Education* 51(6):575–584 · [PMID 28332224](https://pubmed.ncbi.nlm.nih.gov/28332224/) |
| Intervalo ótimo a 95% | Fórmula universal para pares associados, determinada **para 95% de retenção** | Woźniak & Gorzelańczyk 1994 · [PMID 8023714](https://pubmed.ncbi.nlm.nih.gov/8023714/) |

**Não verificados (não citar como referência formal sem nova rodada):** Bjork & Bjork
(*desirable difficulties* / New Theory of Disuse) — nenhuma fonte primária obtida; Sweller
(cognitive load) — busca retornou 0 resultados, sem DOI/volume confirmado; Rohrer & Taylor 2007,
Taylor & Rohrer 2010 e Rohrer/Dedrick/Stershic 2015 — apenas o resumo indireto de 2022;
**TRI/ENEM (nota de corte, metodologia)** — páginas do INEP retornaram 404 ou apenas navegação.
Também é frágil a cifra "remover os 10% mais difíceis melhora a eficiência em até ~300%": vem de
*SuperMemo theory* e o próprio autor alerta que as premissas parecem do SM-11 e **não transferem
exatamente** para outros algoritmos.

---

## 3. Achado técnico: o "ponto dos 90%" do SOAA não está errado

`R = 1/(1 + Δt/(9·S))` é **exatamente FSRS v4**: a parametrização com `DECAY = −1` e
`FACTOR = 1/9`, e por construção `R = 0,9` quando `Δt = S`. Logo o alvo de 90% do SOAA é
coerente e defensável.

O que está desatualizado é outra coisa:

1. **A forma do decaimento.** FSRS-4.5+ usa `DECAY = −0,5` e `FACTOR = 19/81`: a curva cai
   **mais rápido antes de S** e **achata depois** — justamente na zona em que o app decide
   revisar.
2. **A ausência de D (dificuldade por item).** Hoje a dificuldade é declarada por *matéria*
   na matriz, não por *item de memória*. D com linear damping + mean reversion é o que
   substitui a "ease hell" do SM-2 sem espiral.
3. **A retenção-alvo não é configurável.** O 90% é fixo. Expor isso é ganho direto de produto,
   *desde que* com o custo explícito: **+5 p.p. de retenção ≈ 35% mais estudo**.
4. **O intervalo não depende do prazo até a prova.** Cepeda et al. 2008 dão a régua: com prova
   em ~1 ano, revisar a ~5–10% do prazo restante; com prova em 1 semana, ~20–40%. O SOAA já tem
   a data da prova e o FSRS — eles ainda não conversam.

> **Consequência de priorização:** a lacuna estratégica de maior valor é o FSRS real (D + curva
> 4.5 + retenção-alvo), mas ela é a de **maior risco de regressão** — exige golden tests de
> trajetória de intervalo *antes* de qualquer migração. As três primeiras da lista abaixo são
> aditivas e não tocam a trajetória já testada.

---

## 4. Lacunas priorizadas

| # | Lacuna | Valor | Complexidade | Offline |
|---|---|---|---|---|
| 1 | **Previsão de carga (Future Due) + planejamento reverso pela prova** — dois cenários, `Σ 1/Iₙ` como "custo diário", reserva de 2–4 semanas entre conteúdo novo e prova | Transforma "ameaça difusa de backlog" em número | Baixa (função pura) | Sim |
| 2 | **Leeches + fila de conserto + Undo** — limiar de 8 lapsos, suspensão, avisos a cada metade, framework de 6 passos | Aponta o que consome tempo sem gerar acerto | Baixa/Média | Sim |
| 3 | **Consistência: heatmap + streak (atual/recorde) + reparo + meta diária** — reparo pode reaproveitar o saldo devedor como "streak freeze" | Única lacuna de **retenção de usuário** | Baixa | Sim |
| 4 | **Retenção verdadeira vs. prevista** — definições exatas: maduro ≥ 21 dias, só a 1ª revisão do dia conta, Again = Fail | Responde "meu motor está mentindo?" | Média | Sim |
| 5 | **FSRS de verdade: D por item + curva 4.5 + retenção-alvo** | Maior valor estratégico | **Alta** (migração + golden tests) | Sim |
| 6 | **Simulador de carga "quantos minutos/dia isso custa?"** | Responde a pergunta que decide adesão | Média | Sim |
| 7 | **Modos cram/véspera** — revisar adiantado, por tag, **most lapses**, **relative overdueness** | "Modo prova" sem quebrar o longo prazo | Média | Sim |
| 8 | **Caderno de erros como entidade** — erro → status (a revisar/revisado/dominado) → entra na fila | Vocabulário nativo do concurseiro | Média | Sim |
| 9 | **Edital verticalizado como estrutura de dados** — item com status e % de conclusão | "Table stakes" da categoria | Média | Sim |
| 10 | **Delta semanal + leitura tempo × acerto** | Retrato → derivada | Média | Sim |
| 11 | **Guardas estatísticos contra ruído** — ~20 questões por assunto, alvo pela nota de corte, não comparar volumes desiguais | Impede que o motor reordene a matriz por azar amostral | Baixa/Média | Sim |
| 12 | **Ritual de revisão semanal + health check do histórico** — consistência, delta, leeches abertos, carga da semana, atraso; avisos de "poucos reviews / Hard mal usado" | Transforma uso esporádico em hábito | Baixa | Sim |

### TOP 3 recomendado (maior valor × menor risco de regressão)

1. **Previsão de carga + planejamento reverso** — aditivo, função pura sobre dados que já
   existem, resolve a dor nº 1 do concurseiro (backlog explodindo perto da prova).
2. **Leeches + Undo** — detector + estado + tela de triagem; ataca o vazio de "sei que está
   ruim, não sei o que fazer".
3. **Heatmap + streak com reparo** — complexidade baixa, risco quase zero, e é a lacuna que os
   apps de hábito consideram decisiva para o usuário voltar no dia ruim.

---

## 5. Fontes

Documentação oficial: [Anki stats](https://docs.ankiweb.net/manual/stats.md) ·
[Anki leeches](https://docs.ankiweb.net/manual/leeches) ·
[Anki deck options](https://docs.ankiweb.net/manual/deck-options.md) ·
[Anki studying](https://docs.ankiweb.net/manual/studying.md) ·
[Anki filtered decks](https://docs.ankiweb.net/manual/filtered-decks) ·
[Anki e provas grandes](https://docs.ankiweb.net/faqs/settings-for-using-anki-to-prepare-for-a-large-exam.md) ·
[FSRS · The Algorithm](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-Algorithm.md) ·
[FSRS · otimização](https://raw.githubusercontent.com/wiki/open-spaced-repetition/awesome-fsrs/The-mechanism-of-optimization.md) ·
[GitHub contributions](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile) ·
[Toggl](https://support.toggl.com/en-us/category/features-108wk1w/) ·
[Estudaqui](https://www.estudaqui.com/) ·
[TEC Concursos](https://www.tecconcursos.com.br/) ·
[Estratégia](https://concursos.estrategia.com/)

Apps: [Streaks](https://apps.apple.com/us/app/streaks/id963034692) ·
[Forest](https://apps.apple.com/us/app/forest-focus-for-productivity/id866450515) ·
[Focus To-Do](https://www.focustodo.cn/) ·
[Leeches na prática](https://controlaltbackspace.org/leech/)

Acadêmico: ver tabela 2.5 (todos com PMID/DOI verificados via PubMed E-utilities).
