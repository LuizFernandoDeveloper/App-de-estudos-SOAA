# Checklist consolidado das solicitações do usuário

Este checklist consolida os pedidos ao longo de toda a conversa, inclusive o manual metodológico anexado e a captura do erro do instalador. “Implementado no código” significa que a funcionalidade está presente na versão de trabalho; a validação visual da versão desktop ainda depende de abrir o aplicativo em um contexto que possa gravar no banco local.

## 1. Compilar, abrir e corrigir o instalador

- [x] Manter a solicitação de continuar o aplicativo inacabado e entregar uma compilação para avaliação.
- [x] Identificar o erro da captura: o instalador NSIS não conseguiu escrever um arquivo temporário (“Make sure your temp folder is valid”).
- [~] O instalador NSIS novo foi compilado; ainda falta reproduzir a instalação que falhou e conferir a causa em `%TEMP%`, espaço/permissões.
- [~] O executável final foi compilado. A abertura pelo Computer Use foi bloqueada pela revisão automática (“Computer Use was not approved to use soaa”), mesmo após a autorização do usuário; ainda falta a validação visual.
- [x] `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml` e `npm run package:win` concluíram sem erros; o binário e o instalador Windows atualizados foram gerados.

## 2. Persistência e proteção dos dados

- [x] Usar SQLite local com caminho estável para os dados do usuário e preservar o mesmo identificador/nome de banco entre atualizações.
- [x] Executar criação de esquema, migrações e seeds em transação, com versão do esquema no próprio SQLite.
- [x] Criar snapshot pré-migração quando possível e manter a migração transacional se o snapshot não puder ser escrito.
- [x] Persistir no SQLite ciclos Pomodoro e sessões de foco com matéria, duração, interrupções, tipo de esforço e resultado.
- [~] Validar em execução desktop normal que uma atualização preserva dados reais e que uma nova métrica aparece depois de fechar e reabrir o app.

## 3. Curso, prova e trajetória até a meta

- [x] Permitir escolher prova/vestibular, curso-alvo, área de foco, início e data final da preparação.
- [x] Representar a trajetória em horizontes de 12, 18, 24 e 30 meses, editáveis pelas datas.
- [x] Usar níveis Inicial, Básico, Intermediário e Avançado por matéria, com nível atual e alvo.
- [x] Estimar data e esforço para chegar à proficiência-alvo com base nos níveis, dificuldade, prioridades e dados recentes; apresentar a data como estimativa ajustável.
- [x] Relacionar curso e prova ao conjunto de matérias e a prioridades de estudo; manter peso para ingresso separado do peso pedagógico.
- [~] Há um perfil oficial verificado para Engenharia Aeroespacial/UFMG/ENEM; completar pesos oficiais para outros cursos e instituições exige importar/curar cada termo de adesão e edital vigente.
- [x] Aceitar cargas de estudo de 12 horas ou mais na configuração; a tela de trajetória foi alinhada ao limite diário de 24h já admitido pelo perfil e pelo banco.
- [~] Recomendar aumento de carga somente quando há amostra recente suficiente e propor um experimento pequeno; ainda precisa ser avaliado com os dados reais do usuário.

## 4. Plano adaptativo, recuperação e ranking de matérias

- [x] Gerar rota de estudo por prova, matérias selecionadas, dificuldade, peso e janela disponível.
- [x] Alternar matérias prioritárias para não repetir sempre os mesmos focos.
- [x] Criar lista de tarefas com data, disciplina, duração e janela sugerida.
- [x] Identificar dia planejado sem sessão e oferecer reposição acionável para a matéria pendente.
- [x] Classificar risco de revisão em verde, amarelo e vermelho; vermelho sinaliza atenção prioritária.
- [x] Conectar ranking, alertas, plano, tarefas e início de bloco de foco para transformar aviso em ação.
- [~] Ajustar as regras de risco e reposição com histórico real após validação de uso; demonstração e regra-base já existem.

## 5. Pomodoro, foco e métricas

- [x] Incluir Pomodoro configurável, escolha de matéria/objetivo e tipo de esforço cognitivo.
- [x] Persistir ciclos concluídos e parciais no SQLite, incluindo interrupções e dados ligados à disciplina.
- [x] Criar uma aba de métricas de uso dentro da área Pomodoro e outra aba de métricas gerais do aplicativo.
- [x] Exibir gráficos de constância, duração, conclusão, interrupções, matérias, horários e tipo de esforço.
- [x] Separar foco líquido (tempo ativo) da janela bruta medida entre início e encerramento do ciclo.
- [x] Mostrar pausas medidas e cobertura de sessões com dado bruto; sessões antigas sem esse campo permanecem “sem medição”, sem inventar valores históricos.
- [~] A janela bruta do ciclo inclui pausas com o ciclo aberto; intervalos de descanso entre ciclos não são contados como janela bruta. Exibir essa limitação junto dos gráficos.
- [~] Usar duração, acerto, conclusão e interrupções para sugerir carga; não tratar 12h como automaticamente produtivas nem recomendar aumento sem dados.

## 6. Provas, fontes e dicas específicas

- [x] Incluir trilhas/guias para ENEM, CEFET-MG, IFMG, ITA, IME, FUVEST, UNICAMP e outras opções disponíveis no catálogo.
- [x] Adaptar a sugestão do tipo de esforço e as dicas do Pomodoro à prova escolhida.
- [x] Associar materiais/fontes oficiais e links de provas quando disponíveis no catálogo.
- [~] Manter os links e pesos oficiais atualizados por edição; a tela alerta que o edital vigente prevalece e as fontes existentes cobrem apenas combinações verificadas.
- [ ] Ampliar a curadoria de PDFs oficiais por instituição, ano e curso, incluindo as opções locais de Betim citadas na conversa quando houver arquivo oficial acessível.

## 7. Demo, sinergias e metodologia

- [x] Melhorar o modo demonstração com histórico e gráficos exemplificativos e permitir que matérias selecionadas entrem na rota demo.
- [x] Cruzar foco, questões, desempenho, matéria, prioridade, memória e agenda onde há dados disponíveis.
- [x] Incorporar princípios de prática de recuperação, revisão espaçada, interleaving, registro de erros e revisão semanal como orientações de estudo.
- [x] Tratar estimativas de proficiência como estimativas, não promessas.
- [x] Não transformar afirmações de suplementos, cafeína, sono ou neuroquímica do manual em prescrições médicas.
- [~] Verificar a qualidade visual/interativa do modo demo no executável aberto e recolher os ajustes após sua avaliação.

## Ordem de fechamento

1. [x] Consolidar o pedido inteiro neste checklist.
2. [x] Fechar a métrica líquida/bruta e alinhar a entrada de horas da trajetória.
3. [~] Validar visualmente as telas; a revisão automática bloqueou a abertura do app.
4. [ ] Corrigir e validar o instalador NSIS e o erro de temporário em execução real.
5. [ ] Ajustar o que a avaliação visual apontar e ampliar os dados oficiais de cursos/provas.
