(function () {
  var COLLECTION_NAME = "rh_service_orders";
  var DEFAULT_ORDER_ID = "ordem-servico-marcelo-de-oliveira-silva";
  var STAGES = [
    { value: "current", label: "Vigentes", empty: "Nenhuma ordem de servico vigente encontrada." },
    { value: "superseded", label: "Superados", empty: "Nenhuma ordem de servico superada encontrada." },
    { value: "archived", label: "Arquivados", empty: "Nenhuma ordem de servico arquivada encontrada." }
  ];

  var DEFAULT_SECTIONS = [
    {
      title: "FINALIDADE",
      body: "Este Regimento Interno tem como objetivo estabelecer diretrizes e normas de conduta, atuacao e responsabilidades do colaborador designado para o cargo de Controlador de Acesso, garantindo o cumprimento dos padroes de qualidade, etica e seguranca preventiva exigidos pelo GRUPO TKA."
    },
    {
      title: "PROPOSITO DO GRUPO TKA",
      body: "\"Entregar seguranca real e tranquilidade aos clientes por meio de acoes preventivas e atuacao regulamentada, com excelencia e compromisso.\""
    },
    {
      title: "2. DEFINICAO DO CARGO",
      body: "Controlar a entrada e saida de pessoas e veiculos, identificar situacoes suspeitas, atuar em situacoes de emergencia, orientar visitantes, pais de alunos e prestadores de servicos, fornecer informacoes gerais, ajudar a garantir a seguranca do ambiente e o cumprimento das regras estabelecidas."
    },
    {
      title: "3. ATRIBUICOES E RESPONSABILIDADES",
      body: "Cumprir rigorosamente os procedimentos operacionais definidos pelo GRUPO TKA e pelo cliente descritos nas DIRETRIZES DE SEGURANCA CJN AGO23A;\nManter a postura profissional, utilizando corretamente o uniforme completo (Calca, Boot, Camiseta, Camisa e Cobertura) e os EPIs fornecidos;\nRegistrar todas as ocorrencias no livro de controle, comunicando a supervisao sempre que necessario;\nGarantir a confidencialidade de informacoes internas do cliente e do GRUPO TKA;\nPrezar pelo bom relacionamento com pais, alunos, funcionarios e publico externo;\nNao se ausentar do posto sem autorizacao previa ou sem cobertura adequada;\nManter-se, sempre que possivel, no Portao da Secretaria, acompanhando o acesso de pessoas."
    },
    {
      title: "4. ESCALA, JORNADA E PONTUALIDADE",
      body: "O colaborador devera cumprir a escala 5x2 de segunda a sexta-feira das 07h00 as 17h00;\nO horario de descanso sera dividido em tres momentos, sendo 20 min para o cafe da manha no periodo entre 09h30 e 10h00, 35 min de almoco e higiene pessoal das 13h30 as 14h00 e 20 min para o cafe da tarde no periodo entre 15h30 e 16h30.\nO nao cumprimento da jornada podera acarretar medidas disciplinares conforme a CLT e o Codigo de Conduta do GRUPO TKA.\nA compensacao de jornada de horas extras, pontes de feriados e de pontos facultativos sera executada por meio de banco de horas, conforme previsto no Artigo 59, inciso II, da Consolidacao das Leis do Trabalho (CLT). O banco de horas devera ter a compensacao no periodo maximo de seis meses.\nO registro de ponto devera ser realizado diariamente exclusivamente por meio eletronico, atraves do reconhecimento facial via aplicativo instalado no celular do colaborador. Este registro e obrigatorio no inicio, no intervalo de 01 hora de descanso e no fim do expediente. A ausencia da marcacao do ponto devera ser imediatamente comunicada ao setor de RH, para evitar inconsistencias na folha de pagamento e medidas administrativas.\nAtrasos, faltas ou trocas de turno deverao ser previamente comunicados via celular e ter o registro de ciencia pela supervisao. O nao cumprimento podera acarretar advertencia ou demais sancoes disciplinares, conforme previsto na CLT e nos normativos internos do GRUPO TKA."
    },
    {
      title: "USO DE UNIFORME E APRESENTACAO PESSOAL",
      body: "O uso do fardamento completo e adequado e obrigatorio durante todo o expediente, incluindo bone (quando exigido), cracha, calcado de seguranca e demais itens fornecidos pela empresa;\nO uniforme deve estar sempre limpo, passado e em boas condicoes de uso;\nA aparencia do colaborador deve ser compativel com a funcao, sendo vedado o uso de acessorios ou vestimentas incompativeis com a atividade."
    },
    {
      title: "RESTRICOES AO USO DE CELULAR",
      body: "O celular e um meio oficial de comunicacao entre o colaborador e o GRUPO TKA, especialmente utilizado para o envio de mensagens no grupo corporativo, com foco em operacoes e ocorrencias do posto.\nO uso do celular deve ser exclusivamente profissional e com responsabilidade. Durante o periodo em que o colaborador estiver no posto, e proibido realizar ou atender ligacoes telefonicas pessoais, salvo em casos de emergencia previamente comunicados a supervisao.\nQualquer necessidade de ligacoes particulares devera ser realizada apenas durante os horarios de intervalo, nunca durante o cumprimento das funcoes.\nO colaborador devera enviar informes operacionais de hora em hora, comunicando o status do posto atraves do grupo designado pela supervisao.\nOcorrencias, movimentacoes anormais, emergencias ou quaisquer situacoes atipicas devem ser comunicadas imediatamente ao grupo operacional ou diretamente a supervisao.\nO uso inadequado ou abusivo do celular, bem como a omissao na comunicacao de status ou incidentes, podera resultar em advertencia ou demais medidas disciplinares."
    },
    {
      title: "PROIBICOES - E vedado ao Controlador de Acesso:",
      body: "Dormir em servico ou demonstrar comportamento incompativel com o cargo;\nAbandonar o posto de trabalho sem autorizacao ou cobertura;\nManter postura inadequada e permanecer fora do local definido pela supervisao;\nPortar armas de qualquer natureza sem autorizacao legal e contratual;\nConsumir bebidas alcoolicas, fumar ou mascar chicletes durante o expediente;\nManter atitudes discriminatorias, ofensivas ou desrespeitosas com qualquer pessoa;\nUtilizar equipamentos ou recursos do cliente para fins pessoais."
    },
    {
      title: "DISCIPLINA E CONDUTA",
      body: "O colaborador devera manter conduta etica, respeitosa, profissional e compativel com os principios da seguranca preventiva, em todas as situacoes e relacionamentos durante a execucao de suas funcoes;\nE obrigatorio que o colaborador siga rigorosamente os principios e valores do GRUPO TKA, que incluem etica, transparencia, lealdade, comprometimento e apoio ao social, demonstrando tais condutas no ambiente de trabalho, no relacionamento com clientes e publico externo, visitantes e demais prestadores de servico;\nAtos de indisciplina, desrespeito, omissao, negligencia, ma conduta ou qualquer comportamento que prejudique a imagem da empresa ou comprometa a seguranca das operacoes serao analisados pela supervisao e poderao resultar em advertencia, suspensao ou desligamento, conforme a gravidade do fato e a legislacao trabalhista vigente."
    },
    {
      title: "CAPACITACAO E DESENVOLVIMENTO",
      body: "O Vigilante devera participar de treinamentos periodicos, reunioes operacionais e atualizacoes tecnicas promovidas pelo GRUPO TKA e ou Escola de Formacao de Vigilantes;\nA reciclagem dos procedimentos e parte integrante do plano de melhoria continua da empresa."
    },
    {
      title: "DISPOSICOES FINAIS",
      body: "Este Regimento Interno devera ser lido, compreendido e assinado pelo colaborador, que declara estar ciente das normas aqui estabelecidas. Casos omissos serao resolvidos conforme a legislacao vigente e o Codigo de Conduta do GRUPO TKA."
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value || "").trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function shortDateTime(value) {
    if (!value) return "";
    var parsed = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("pt-BR");
  }

  function dateLabel(value) {
    if (!value) return "";
    var parsed = new Date(value + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("pt-BR");
  }

  function findStage(value) {
    return STAGES.find(function (item) { return item.value === value; }) || null;
  }

  function normalizeStage(meta) {
    var explicitStage = meta && meta.serviceOrderStage;
    if (findStage(explicitStage)) return explicitStage;
    if (meta && meta.archived) return "archived";
    return "current";
  }

  function stageLabel(value) {
    var stage = findStage(value);
    return stage ? stage.label : "Vigentes";
  }

  function newId(prefix) {
    return (prefix || "item") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function createDefaultState(id, publicLink) {
    var timestamp = nowIso();
    var currentDate = timestamp.slice(0, 10);
    return {
      meta: {
        serviceOrderId: id || "",
        serviceOrderStage: "current",
        archived: false,
        publicLink: publicLink || "",
        publicSubmittedAt: "",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      document: {
        title: "ORDEM DE SERVICO",
        preparedBy: "",
        revisionDate: currentDate,
        city: "Taubate",
        date: currentDate,
        employeeName: "",
        employeeRole: "",
        sector: "",
        sections: []
      },
      signature: {
        employeeDataUrl: "",
        updatedAtLabel: ""
      }
    };
  }

  function createMarceloServiceOrderState() {
    var state = createDefaultState(DEFAULT_ORDER_ID, buildPublicLink(DEFAULT_ORDER_ID));
    state.meta.createdAt = "2026-03-02T12:00:00.000Z";
    state.meta.updatedAt = "2026-03-02T12:00:00.000Z";
    state.document.preparedBy = "Katio Augusto";
    state.document.revisionDate = "2026-03-02";
    state.document.date = "2026-03-02";
    state.document.employeeName = "MARCELO DE OLIVEIRA SILVA";
    state.document.employeeRole = "VIGILANTE";
    state.document.sector = "Colegio Jardim das Nacoes (CJN) - Taubate";
    state.document.sections = clone(DEFAULT_SECTIONS);
    return state;
  }

  function builtInServiceOrders() {
    var state = createMarceloServiceOrderState();
    return [
      {
        id: DEFAULT_ORDER_ID,
        state: state,
        createdAt: state.meta.createdAt,
        updatedAt: state.meta.updatedAt,
        builtIn: true
      }
    ];
  }

  function findBuiltInServiceOrder(id) {
    var normalizedId = text(id);
    return builtInServiceOrders().find(function (item) {
      return item.id === normalizedId;
    }) || null;
  }

  function normalizeSections(sections) {
    if (!Array.isArray(sections)) return clone(DEFAULT_SECTIONS);
    return sections.map(function (section) {
      return {
        title: text(section && section.title),
        body: text(section && section.body)
      };
    }).filter(function (section) {
      return section.title || section.body;
    });
  }

  function normalizeState(incoming, id, publicLink) {
    var base = createDefaultState(id, publicLink);
    var next = incoming || {};
    var meta = Object.assign({}, base.meta, next.meta || {});
    meta.serviceOrderId = text(meta.serviceOrderId || id);
    meta.publicLink = text(meta.publicLink || publicLink);
    meta.serviceOrderStage = normalizeStage(meta);
    meta.archived = meta.serviceOrderStage === "archived";

    var documentData = Object.assign({}, base.document, next.document || {});
    documentData.sections = normalizeSections(documentData.sections);

    return {
      meta: meta,
      document: documentData,
      signature: Object.assign({}, base.signature, next.signature || {})
    };
  }

  function stateForCloud(state) {
    var clean = clone(state);
    clean.meta.serviceOrderStage = normalizeStage(clean.meta);
    clean.meta.archived = clean.meta.serviceOrderStage === "archived";
    return clean;
  }

  function requiredIssues(state, ownerSignatureDataUrl) {
    var issues = [];
    var documentData = state && state.document || {};
    if (!text(ownerSignatureDataUrl)) issues.push("Assinatura da direcao");
    if (!text(state && state.signature && state.signature.employeeDataUrl)) issues.push("Assinatura do colaborador");
    if (!text(documentData.employeeName)) issues.push("Nome do colaborador");
    if (!text(documentData.employeeRole)) issues.push("Cargo/Funcao");
    return issues;
  }

  function isComplete(state, ownerSignatureDataUrl) {
    return requiredIssues(state, ownerSignatureDataUrl).length === 0;
  }

  function summaryIssues(state, ownerSignatureDataUrl) {
    var issues = requiredIssues(state, ownerSignatureDataUrl);
    if (!issues.length) return "Assinaturas completas";
    return issues.slice(0, 3).join(", ") + (issues.length > 3 ? "..." : "") + " pendente";
  }

  function statusLabel(state, ownerSignatureDataUrl) {
    if (state && state.meta && state.meta.archived) return "Arquivado";
    if (state && state.meta && state.meta.publicSubmittedAt && isComplete(state, ownerSignatureDataUrl)) return "Recebido";
    if (isComplete(state, ownerSignatureDataUrl)) return "Pronto";
    return "Pendente";
  }

  function searchableText(state, ownerSignatureDataUrl) {
    var documentData = state && state.document || {};
    return [
      documentData.title,
      documentData.employeeName,
      documentData.employeeRole,
      documentData.sector,
      stageLabel(normalizeStage(state && state.meta || {})),
      statusLabel(state, ownerSignatureDataUrl),
      summaryIssues(state, ownerSignatureDataUrl)
    ].join(" ").toLowerCase();
  }

  function buildPublicLink(id) {
    var url = new URL("/recursos-humanos/ordem-servico/editor.html", window.location.origin);
    url.searchParams.set("id", id);
    url.searchParams.set("public", "1");
    return url.toString();
  }

  window.TKAServiceOrderTemplate = {
    COLLECTION_NAME: COLLECTION_NAME,
    DEFAULT_ORDER_ID: DEFAULT_ORDER_ID,
    STAGES: STAGES,
    buildPublicLink: buildPublicLink,
    builtInServiceOrders: builtInServiceOrders,
    clone: clone,
    createDefaultState: createDefaultState,
    dateLabel: dateLabel,
    findStage: findStage,
    findBuiltInServiceOrder: findBuiltInServiceOrder,
    isComplete: isComplete,
    newId: newId,
    normalizeStage: normalizeStage,
    normalizeState: normalizeState,
    requiredIssues: requiredIssues,
    searchableText: searchableText,
    shortDateTime: shortDateTime,
    stageLabel: stageLabel,
    stateForCloud: stateForCloud,
    statusLabel: statusLabel,
    summaryIssues: summaryIssues,
    text: text
  };
})();
