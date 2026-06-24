(function () {
  const LOCAL_RH_BRIDGE_URL = "http://127.0.0.1:18992";
  const FEEDBACK_QUEUE_KEY = "tka_whatsapp_rh_feedback_queue_v1";
  const MANUAL_INFO_KEY = "tka_whatsapp_rh_manual_info_v1";
  const MAX_UNCLEAR_ATTEMPTS = 5;
  const RH_FIRST_MESSAGE = "Ola! Como podemos te ajudar hoje?";
  const RH_DIRECT_SUBJECT_PROMPT = "Pode me dizer qual e sua duvida em uma frase?";
  const RH_TOPIC_EXAMPLES_PROMPT = "Exemplo: desconto do salario de maio/2026.";
  const CURRENT_QUESTION_PROMPT = RH_FIRST_MESSAGE;
  const RESOLUTION_QUESTION = "Sua duvida foi respondida? Responda sim para encerrar ou nao para continuar com outra pergunta.";
  const RH_DECLARED_ANSWER_BANK = [
    {
      key: "good_standing_bonus",
      optionKey: "cct_values",
      title: "Premio de Boa Permanencia",
      keywords: ["premio de boa permanencia", "boa permanencia", "premio", "assiduidade"],
      answer: "O Premio de Boa Permanencia, conforme convencao coletiva, e devido ao colaborador que nao possui nenhuma falta no mes, seja justificada ou injustificada. Podem receber: Controlador de Acesso, Operador de Monitoramento, Vigia, Auxiliar de Servicos Gerais e Auxiliar de Manutencao. Quando os criterios sao atendidos, o valor e acrescentado ao Vale Alimentacao."
    },
    {
      key: "totalpass",
      optionKey: "gympass",
      title: "TotalPass",
      keywords: ["totalpass", "total pass"],
      answer: "A TotalPass fica disponivel apos o termino do periodo de experiencia, de 45 + 45 dias. Para usar, o colaborador precisa solicitar a insercao na plataforma; depois do cadastro, o beneficio fica ativo. A TKA fornece apenas o acesso a plataforma: compras, forma de pagamento, planos e uso devem ser tratados diretamente com a TotalPass. E possivel incluir ate 3 dependentes por titular."
    },
    {
      key: "vr_va",
      optionKey: "benefit_cards",
      title: "Beneficios VR e VA",
      keywords: ["quando cai o vr", "quando paga vr", "quando cai o va", "vale refeicao", "vale alimentacao", "superapp vr", "cartao vr", "beneficios"],
      answer: "O VR e pago mensalmente no dia 01. Durante o periodo de experiencia de 45 + 45 dias, o valor e dividido em dois pagamentos, nos dias 01 e 15. O valor mensal segue a escala mensal do colaborador e e um beneficio adiantado para uso no mes vigente. O VA e pago mensalmente no dia 01, apos o fechamento do mes anterior. VR e VA sao disponibilizados pelo Cartao VR; para usar, baixe o SUPERAPP VR, acesse pelo QR Code do cartao e cadastre sua senha. O cartao e nominal e intransferivel."
    },
    {
      key: "vt",
      optionKey: "benefit_cards",
      title: "Vale Transporte",
      keywords: ["vale transporte", "solicitar vt", "solicito vt", "optei pelo vt", "desconto de vt"],
      answer: "O Vale Transporte deve ser solicitado no momento da contratacao. Se o colaborador nao optou pelo VT na admissao, pode solicitar depois, com vigencia a partir do mes seguinte ao pedido. O beneficio e calculado conforme a escala mensal individual e, ao optar pelo VT, ha desconto de 6% do salario em folha, conforme legislacao vigente."
    },
    {
      key: "flash_mobility",
      optionKey: "benefit_cards",
      title: "Cartao Flash - Auxilio Mobilidade",
      keywords: ["cartao flash", "flash", "auxilio mobilidade", "mobilidade", "credito a vista", "recarga de onibus"],
      answer: "O Auxilio Mobilidade e disponibilizado pelo Cartao Flash. Depois do convite por e-mail ou SMS, o colaborador acessa o app Flash, verifica recargas e cadastra o cartao fisico. O beneficio pode ser usado em postos de combustivel, transporte publico, recarga de cartao de onibus, vans e meios credenciados. Para pagar nos estabelecimentos, selecione a opcao CREDITO A VISTA."
    },
    {
      key: "payment_dates",
      optionKey: "payroll_payment",
      title: "Pagamento, datas e prazos",
      keywords: ["quinto dia util", "5 dia util", "5o dia util", "data de pagamento", "quando paga", "fechamento da folha", "fechamento folha", "prazo pagamento"],
      answer: "O pagamento do salario e realizado todo quinto dia util de cada mes. O fechamento da folha ocorre do dia 26 de um mes ao dia 25 do mes seguinte. Horas, adicionais, descontos e ocorrencias registradas nesse periodo entram no pagamento do quinto dia util do mes seguinte. Exemplo: apuracao de 26 de janeiro a 25 de fevereiro, pagamento no quinto dia util de marco."
    },
    {
      key: "control_rh",
      optionKey: "schedule",
      title: "Registro de ponto - Control RH",
      keywords: ["control rh", "controle rh", "registro de ponto", "bater ponto", "ponto", "codigo da empresa", "s3ca2", "batida de ponto"],
      answer: "O ponto e registrado pelo aplicativo Control RH. Ao abrir o app, informe o codigo da empresa S3CA2. No primeiro acesso, use login com os 4 primeiros digitos do CPF e senha inicial 123456; depois saia e entre novamente para trocar para uma senha pessoal. Registre entrada, saida para almoco, retorno do almoco e saida final. Ha tolerancia de 10 minutos antes ou depois para entrada e saida. O ponto pode ser batido sem internet e sera enviado quando o celular voltar a ter conexao. Se esquecer ou bater fora do horario, registre assim que lembrar, clique na batida, abra a justificativa e informe o motivo."
    },
    {
      key: "payslip_incicle",
      optionKey: "payslip",
      title: "Holerite",
      keywords: ["holerite incicle", "onde vejo o holerite", "historico de holerites", "dia do pagamento", "disponibilizado"],
      answer: "O holerite mensal e disponibilizado no dia do pagamento, que ocorre no quinto dia util de cada mes, pela plataforma INCICLE. Quando o holerite for inserido, o colaborador recebe uma notificacao no aplicativo. Para acessar, entre no app INCICLE, abra o menu no canto superior esquerdo pelo icone de 9 pontos e escolha Historico de Holerites."
    },
    {
      key: "incicle_access",
      optionKey: "document",
      title: "Cadastro e uso do INCICLE",
      keywords: ["cadastro incicle", "acesso incicle", "convite incicle", "plataforma incicle", "email incicle"],
      answer: "A INCICLE e a plataforma de RH da TKA para centralizar documentos pessoais, holerites, feedbacks, avaliacoes, projetos e comunicados oficiais. O convite de acesso e enviado por e-mail, normalmente para o e-mail informado na admissao. Se o convite nao foi localizado, envie um e-mail valido para o RH verificar e reenviar o acesso."
    }
  ];
  const manualInfoTopics = {
    general: { label: "Geral RH", optionKeys: ["general_request", "rh_handoff", "request"] },
    payment: { label: "Pagamento / desconto", optionKeys: ["payroll_payment", "payroll", "payment"] },
    benefits: { label: "VR / VA / VT / cartao", optionKeys: ["benefit_cards", "benefit"] },
    gympass: { label: "Gym Pass / Wellhub", optionKeys: ["gympass"] },
    payslip: { label: "Holerite", optionKeys: ["payslip"] },
    schedule: { label: "Escala / folga / FT", optionKeys: ["schedule", "ft_payment", "schedule_coverage"] },
    vacation: { label: "Ferias", optionKeys: ["vacation"] },
    documents: { label: "Documentos", optionKeys: ["document", "documents"] },
    uniform: { label: "Uniforme / equipamento", optionKeys: ["uniform_equipment"] }
  };
  const dashboard = {
    places: [],
    workers: [],
    profiles: [],
    scales: [],
    entries: [],
    ftEntries: []
  };
  const state = {
    health: null,
    summary: null,
    lastError: "",
    lastUpdatedAt: "",
    lastFetchedAt: "",
    feedbackDb: null,
    feedbackStatus: {},
    feedbackFlushRunning: false,
    manualInfoOpen: false,
    manualInfoStatus: ""
  };

  const el = {
    pageMeta: document.getElementById("pageMeta"),
    connectionPanel: document.getElementById("connectionPanel"),
    queueCount: document.getElementById("queueCount"),
    attentionList: document.getElementById("attentionList"),
    answerPatterns: document.getElementById("answerPatterns"),
    dashboardDay: document.getElementById("dashboardDay"),
    dashboardMatches: document.getElementById("dashboardMatches"),
    recentMessages: document.getElementById("recentMessages"),
    peoplePatterns: document.getElementById("peoplePatterns"),
    manualInfoToggle: document.getElementById("manualInfoToggle"),
    manualInfoBox: document.getElementById("manualInfoBox"),
    manualInfoTopic: document.getElementById("manualInfoTopic"),
    manualInfoText: document.getElementById("manualInfoText"),
    manualInfoSave: document.getElementById("manualInfoSave"),
    manualInfoStatus: document.getElementById("manualInfoStatus"),
    manualInfoList: document.getElementById("manualInfoList")
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeCommonTypos(value) {
    return String(value || "")
      .replace(/\bolerite\b/g, "holerite")
      .replace(/\boleriti\b/g, "holerite")
      .replace(/\bolirite\b/g, "holerite")
      .replace(/\boliriti\b/g, "holerite")
      .replace(/\bholerit\b/g, "holerite")
      .replace(/\bholeriti\b/g, "holerite")
      .replace(/\bpagameto\b/g, "pagamento")
      .replace(/\bpgto\b/g, "pagamento")
      .replace(/\bpgt\b/g, "pagamento")
      .replace(/\bdescontu\b/g, "desconto")
      .replace(/\batestadu\b/g, "atestado")
      .replace(/\batestato\b/g, "atestado")
      .replace(/\buniformi\b/g, "uniforme")
      .replace(/\brecisao\b/g, "rescisao")
      .replace(/\bfuncinario\b/g, "funcionario")
      .replace(/\bcompetensia\b/g, "competencia")
      .replace(/\bcompentencia\b/g, "competencia")
      .replace(/\bnao caio\b/g, "nao caiu")
      .replace(/\bn caiu\b/g, "nao caiu")
      .replace(/\bvrn\b/g, "vr nao")
      .replace(/\bvtn\b/g, "vt nao")
      .replace(/\bvan\b/g, "va nao")
      .replace(/\bgm pass\b/g, "gympass")
      .replace(/\bgm-pass\b/g, "gympass");
  }

  function normalizeForKeyword(value) {
    return normalizeCommonTypos(
      normalizeText(value)
        .replace(/[^\w\s/@.-]/g, " ")
        .replace(/([a-z])\1{2,}/g, "$1$1")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  function currentQuestionText() {
    return RH_DIRECT_SUBJECT_PROMPT;
  }

  function appendResolutionQuestion(reply) {
    const text = String(reply || "").trim();
    if (!text || normalizeText(text).includes("sua duvida foi respondida")) return text;
    return `${text}\n\n${RESOLUTION_QUESTION}`;
  }

  function shouldAppendDraftResolution(optionKey, reply, missing, context = {}) {
    if (missing.length || Number(context.unclearAttempts || 0) >= MAX_UNCLEAR_ATTEMPTS || context.exploratoryValueComparison) return false;
    if (["identity_verification", "general_request", "rh_handoff", "payroll_payment", "cct_values", "termination"].includes(optionKey)) return false;
    if (/\b(vou|sera|será)\s+(direcionar|encaminhar|repassar)|validacao do rh|validação do rh|validar pelo rh|conferencia do rh|conferência do rh/i.test(reply || "")) return false;
    return true;
  }

  function containsAny(normalized, words) {
    return words.some(word => {
      const term = normalizeForKeyword(word);
      return term && new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalized);
    });
  }

  function declaredAnswerMatchScore(entry, text, optionKey) {
    const normalized = normalizeForKeyword(text);
    if (!normalized) return 0;
    const hits = (entry.keywords || []).filter(keyword => containsAny(normalized, [keyword]));
    if (!hits.length) return 0;
    const optionBonus = optionKey && optionKey === entry.optionKey ? 0.12 : 0;
    return Math.min(1, 0.62 + hits.length * 0.12 + optionBonus);
  }

  function declaredContextMissing(context = {}) {
    const missing = [];
    if (!context.hasName && !context.matchedWorkerName) missing.push("nome e sobrenome");
    if (!context.hasRole) missing.push("funcao");
    if (!context.hasPost) missing.push("posto");
    if (!context.hasPeriod && !context.hasHour) missing.push("escala");
    return missing;
  }

  function declaredAnswerForDraft(text, optionKey, context = {}) {
    const matches = RH_DECLARED_ANSWER_BANK
      .map(entry => ({ ...entry, score: declaredAnswerMatchScore(entry, text, optionKey) }))
      .filter(entry => entry.score >= 0.62)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"));
    const entry = matches[0] || null;
    if (!entry) return null;
    const missing = declaredContextMissing(context).slice(0, 4);
    const suffix = missing.length
      ? `\n\nPara o RH aplicar corretamente ao seu caso, envie ${missing.join(", ")}.`
      : "\n\nSe quiser que o RH confira seu caso individual, envie sua duvida com nome, funcao, posto e escala.";
    return {
      key: entry.key,
      optionKey: entry.optionKey,
      title: entry.title,
      source: "Rh automatizado - Grupo TKA(4)",
      score: entry.score,
      reply: `Ola! ${entry.answer}${suffix}`
    };
  }

  function isExploratoryValueComparison(normalized) {
    const comparison = /\b(outro|outros|outra|outras|colega|colegas|todo mundo|pessoal|mais que|menos que|maior que|menor que|mais barato|barato|barata|mais caro|mais alto|mais baixo|diferente|comparar|comparacao|igual)\b/.test(normalized);
    const valueTopic = /\b(extra|ft|folga trabalhada|valor|salario|pagamento|desconto|piso|cct|plr|vr|va|vt|beneficio|recebeu|recebi|ganhou|ganhei|pagou|pagaram|caiu)\b/.test(normalized);
    return comparison && valueTopic;
  }

  function tokens(value) {
    const stop = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "os", "as", "para", "por", "com"]);
    return normalizeText(value).split(" ").filter(token => token.length >= 3 && !stop.has(token));
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function messageFullText(message = {}) {
    const text = String(message.textFull || message.messageTextFull || message.text || "").trim();
    if (text) return text;
    return message.hasMedia ? `[${message.mediaKind || message.messageType || "midia"}]` : "";
  }

  function messageDisplayValidationHtml(message = {}) {
    const validation = message.messageDisplayValidation || message.displayValidation || null;
    if (!validation) return "";
    const text = `${validation.validToShow ? "Valida para exibicao" : "Nao ha texto validado para exibicao"}: ${validation.why || ""} ${validation.how || ""}`.trim();
    return text ? `<div class="message-validation">${escapeHtml(text)}</div>` : "";
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function compactPhone(value) {
    const onlyDigits = digits(value);
    if (!onlyDigits) return "";
    return onlyDigits.length > 4 ? `...${onlyDigits.slice(-4)}` : onlyDigits;
  }

  function looksLikeRawId(value) {
    const text = String(value || "").trim();
    if (!text) return true;
    const onlyDigits = digits(text);
    return text.includes("@") || (onlyDigits.length >= 7 && onlyDigits.length >= text.replace(/\s+/g, "").length - 2);
  }

  function readableName(value) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    return text && !looksLikeRawId(text) ? text : "";
  }

  function messageDisplayTitle(message) {
    return readableName(message.workerName)
      || readableName(message.contactName)
      || readableName(message.groupSubject)
      || readableName(message.placeMentions?.[0]?.placeName)
      || (message.chatType === "group" ? "Mensagem de grupo RH" : "Contato RH");
  }

  function messageDisplayMeta(message) {
    const chatLabel = message.chatType === "group" ? (readableName(message.groupSubject) || "grupo") : "privado";
    const contact = compactPhone(message.fromPhone);
    return [
      chatLabel,
      contact ? `contato ${contact}` : "",
      formatDateTime(message.messageAt || message.receivedAt)
    ].filter(Boolean).join(" / ");
  }

  function shortHourMinute(value) {
    if (!value) return "--h--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);
    const hour = parts.find(part => part.type === "hour")?.value || "--";
    const minute = parts.find(part => part.type === "minute")?.value || "--";
    return `${hour}h${minute}`;
  }

  function publicErrorMessage(error) {
    const text = String(error?.message || error || "");
    if (text.includes("429") || text.toLowerCase().includes("quota")) {
      return "Conexao ocupada. Tentando novamente automaticamente.";
    }
    return "Nao foi possivel atualizar agora. Tentando novamente.";
  }

  function saoPauloDay(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function applySeedData() {
    const seed = window.RH_SEED_DATA || {};
    dashboard.places = seed.places || [];
    dashboard.workers = seed.workers || [];
    dashboard.profiles = seed.worker_profiles || seed.workerProfiles || [];
    dashboard.scales = seed.scales || [];
    dashboard.entries = seed.entries || [];
    dashboard.ftEntries = seed.ftEntries || seed.ft_entries || [];
  }

  function watchCollection(db, collectionName, targetKey) {
    db.collection(collectionName).onSnapshot(snapshot => {
      dashboard[targetKey] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render();
    }, error => console.warn("Leitura da colecao RH", collectionName, error));
  }

  function applyLiveRhData(data) {
    state.health = data.runtime || null;
    state.summary = data.summary || null;
    state.lastUpdatedAt = data.publishedAt || data.runtime?.cloudPublish?.lastPublishAt || "";
    state.lastFetchedAt = new Date().toISOString();
    state.lastError = "";
    render();
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function loadFeedbackQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(FEEDBACK_QUEUE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveFeedbackQueue(queue) {
    localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(queue.slice(-200)));
  }

  function loadManualInfo() {
    try {
      const value = JSON.parse(localStorage.getItem(MANUAL_INFO_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveManualInfoList(rows) {
    localStorage.setItem(MANUAL_INFO_KEY, JSON.stringify(rows.slice(-200)));
  }

  function manualInfoTopicLabel(topic) {
    return manualInfoTopics[topic]?.label || manualInfoTopics.general.label;
  }

  function manualInfoForOption(optionKey) {
    const key = String(optionKey || "general_request");
    const rows = loadManualInfo().filter(row => {
      const topic = manualInfoTopics[row.topic] || manualInfoTopics.general;
      return row.topic === "general" || topic.optionKeys.includes(key);
    });
    return rows.slice(-3).reverse();
  }

  function manualInfoEventId(topic, text) {
    return ["manual-info", topic || "general", normalizeText(text).slice(0, 120), Date.now()]
      .join(":")
      .replace(/[^a-z0-9_.:-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180);
  }

  function feedbackEventId(messageId, optionKey, customText) {
    return [messageId || "sem-mensagem", optionKey || "sem-opcao", normalizeText(customText || "")]
      .join(":")
      .replace(/[^a-z0-9_.:-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180);
  }

  function cloudSafeId(value) {
    return String(value || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180);
  }

  function clientRedactSensitiveText(value) {
    return String(value || "")
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
      .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
      .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b(?:pix|chave pix)\s*[:=-]?\s*\S+/gi, "PIX [omitido]")
      .slice(0, 4000);
  }

  function compactLearnedContext(context = {}) {
    return {
      accepted: Array.isArray(context.accepted) ? context.accepted.slice(0, 5).map(row => ({
        optionKey: String(row.optionKey || "").slice(0, 120),
        optionTitle: clientRedactSensitiveText(row.optionTitle || "").slice(0, 180),
        reply: clientRedactSensitiveText(row.reply || "").slice(0, 1200),
        messagePreview: clientRedactSensitiveText(row.messagePreview || "").slice(0, 400),
        action: String(row.action || "").slice(0, 40),
        source: String(row.source || "").slice(0, 80),
        score: Number(row.score || 0),
        count: Number(row.count || 1),
        updatedAt: String(row.updatedAt || "").slice(0, 80)
      })) : [],
      rejected: Array.isArray(context.rejected) ? context.rejected.slice(0, 3).map(row => ({
        rejectedOptionKey: String(row.rejectedOptionKey || "").slice(0, 120),
        rejectedTitle: clientRedactSensitiveText(row.rejectedTitle || "").slice(0, 180),
        replacementText: clientRedactSensitiveText(row.replacementText || "").slice(0, 1200),
        action: String(row.action || "").slice(0, 40),
        score: Number(row.score || 0),
        count: Number(row.count || 1),
        updatedAt: String(row.updatedAt || "").slice(0, 80)
      })) : []
    };
  }

  function currentMessages() {
    const summary = state.summary || {};
    return [
      ...(summary.attentionQueue || []),
      ...(summary.recentMessages || []),
      ...(summary.candidates || [])
    ];
  }

  function messageById(messageId) {
    return currentMessages().find(message => message.id === messageId) || null;
  }

  function setFeedbackStatus(messageId, tone, text) {
    if (!messageId) return;
    state.feedbackStatus[messageId] = { tone, text, at: new Date().toISOString() };
    render();
  }

  async function postRhFeedbackLocal(payload) {
    const response = await fetch(`${LOCAL_RH_BRIDGE_URL}/rh/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Falha ao registrar feedback");
    return data;
  }

  async function postRhFeedbackCloud(payload) {
    if (!state.feedbackDb || !window.firebase) throw new Error("Firestore cloud indisponivel para aprendizado RH");
    const eventId = cloudSafeId(payload.eventId || feedbackEventId(payload.messageId, payload.selectedKey, payload.customText || payload.reply || payload.draftText || payload.selectedTitle || ""));
    const event = {
      ...payload,
      eventId,
      id: eventId,
      source: payload.source || "whatsappRH-app",
      customText: clientRedactSensitiveText(payload.customText || ""),
      reply: clientRedactSensitiveText(payload.reply || payload.customText || payload.draftText || ""),
      draftText: clientRedactSensitiveText(payload.draftText || ""),
      messagePreview: clientRedactSensitiveText(payload.messagePreview || ""),
      selectedTitle: clientRedactSensitiveText(payload.selectedTitle || "").slice(0, 180),
      reviewAction: String(payload.reviewAction || payload.action || "").slice(0, 40),
      learnedContext: compactLearnedContext(payload.learnedContext || {}),
      keepInQueue: payload.keepInQueue !== false,
      approvedForLearning: payload.approvedForLearning !== false,
      accepted: payload.accepted !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!payload.createdAt) event.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await state.feedbackDb.collection("rh_ai_feedback_events").doc(eventId).set(event, { merge: true });
    return {
      ok: true,
      duplicate: false,
      source: "firestore-rh-ai-feedback",
      event: {
        id: eventId,
        selectedKey: event.selectedKey,
        selectedTitle: event.selectedTitle
      }
    };
  }

  async function postRhFeedback(payload) {
    const attempts = [];
    if (state.feedbackDb && window.firebase) attempts.push(postRhFeedbackCloud(payload));
    attempts.push(postRhFeedbackLocal(payload));
    const results = await Promise.allSettled(attempts);
    const success = results.find(result => result.status === "fulfilled");
    if (success) return success.value;
    const message = results.map(result => result.reason?.message || String(result.reason || "")).filter(Boolean).join(" / ");
    throw new Error(message || "Falha ao registrar feedback");
  }

  function feedbackPayload(message, option, customText = "") {
    const selectedKey = customText ? "custom" : (option.key || "general_request");
    const title = customText || option.title || option.short || "Outros";
    const draft = draftReplyForMessage(message);
    const messagePreview = messageFullText(message);
    const reviewAction = customText ? "operator-custom-text" : "operator-selected-option";
    return {
      eventId: feedbackEventId(message.id, selectedKey, customText || title),
      messageId: message.id,
      selectedKey,
      selectedTitle: title,
      customText: customText.trim(),
      reply: customText.trim() || draft.reply || title,
      audienceKey: message.responseStudy?.audience?.key || "",
      intent: message.intent || "",
      operatorAt: new Date().toISOString(),
      source: "whatsappRH-app",
      keepInQueue: true,
      approvedForLearning: true,
      accepted: true,
      action: reviewAction,
      reviewAction,
      messagePreview,
      draftText: draft.reply || "",
      draftConfidence: draft.restricted ? 0.68 : 0.86,
      qualityPassed: true,
      riskLevel: draft.restricted ? "manual_review" : "operator_review",
      resolutionQuestionAsked: Boolean(draft.resolutionQuestionAsked),
      resolutionStatus: draft.resolutionStatus || "",
      learnedContext: {
        accepted: [{
          optionKey: selectedKey,
          optionTitle: title,
          reply: customText.trim() || draft.reply || title,
          messagePreview,
          action: reviewAction,
          source: "whatsappRH-app",
          score: 1,
          count: 1,
          updatedAt: new Date().toISOString()
        }],
        rejected: []
      }
    };
  }

  function enqueueFeedback(payload) {
    const queue = loadFeedbackQueue();
    if (!queue.some(item => item.eventId === payload.eventId)) queue.push(payload);
    saveFeedbackQueue(queue);
  }

  async function flushFeedbackQueue() {
    if (state.feedbackFlushRunning) return;
    const queue = loadFeedbackQueue();
    if (!queue.length) return;
    state.feedbackFlushRunning = true;
    const remaining = [];
    let sent = 0;
    for (const payload of queue) {
      try {
        await postRhFeedback(payload);
        sent += 1;
        if (payload.messageId) state.feedbackStatus[payload.messageId] = { tone: "ok", text: "Salvo e removido da fila.", at: new Date().toISOString() };
      } catch {
        remaining.push(payload);
      }
    }
    saveFeedbackQueue(remaining);
    state.feedbackFlushRunning = false;
    if (sent) {
      await refreshLocalRhBridge();
    } else {
      render();
    }
  }

  async function submitFeedback(message, option, customText = "") {
    const text = customText.trim();
    if (!message || (!option?.key && !text)) return;
    if (option?.key === "custom" && !text) return;
    const payload = feedbackPayload(message, option || { key: "custom", title: text }, text);
    setFeedbackStatus(message.id, "pending", "Registrando aprendizado...");
    try {
      await postRhFeedback(payload);
      state.feedbackStatus[message.id] = { tone: "ok", text: "Salvo e removido da fila.", at: new Date().toISOString() };
      await refreshLocalRhBridge();
    } catch (error) {
      console.warn("Feedback RH ficou pendente.", error);
      enqueueFeedback(payload);
      setFeedbackStatus(message.id, "pending", "Salvo na fila local.");
    }
  }

  async function saveManualInfo() {
    const topic = el.manualInfoTopic?.value || "general";
    const text = el.manualInfoText?.value?.trim() || "";
    if (!text) {
      state.manualInfoStatus = "Escreva a informacao antes de salvar.";
      renderManualInfo();
      el.manualInfoText?.focus();
      return;
    }
    const item = {
      id: manualInfoEventId(topic, text),
      topic,
      topicLabel: manualInfoTopicLabel(topic),
      text,
      createdAt: new Date().toISOString(),
      source: "whatsappRH-manual-info"
    };
    const rows = loadManualInfo().filter(row => row.id !== item.id);
    rows.push(item);
    saveManualInfoList(rows);
    el.manualInfoText.value = "";
    state.manualInfoStatus = "Informacao salva neste aparelho.";

    const payload = {
      eventId: item.id,
      messageId: item.id,
      selectedKey: `manual_info_${topic}`,
      selectedTitle: `Informacao RH - ${item.topicLabel}`,
      customText: text,
      audienceKey: "",
      intent: topic,
      operatorAt: item.createdAt,
      source: "whatsappRH-manual-info",
      keepInQueue: true,
      approvedForLearning: true,
      accepted: true,
      action: "manual-info",
      reviewAction: "manual-info",
      messagePreview: text,
      draftText: text,
      reply: text,
      draftConfidence: 1,
      qualityPassed: true,
      riskLevel: "manual-rh-note",
      learnedContext: {
        accepted: [{
          optionKey: `manual_info_${topic}`,
          optionTitle: `Informacao RH - ${item.topicLabel}`,
          reply: text,
          messagePreview: text,
          action: "manual-info",
          source: "whatsappRH-manual-info",
          score: 1,
          count: 1,
          updatedAt: item.createdAt
        }],
        rejected: []
      }
    };
    try {
      await postRhFeedback(payload);
      state.manualInfoStatus = "Informacao salva e enviada para aprendizado RH.";
      await refreshLocalRhBridge();
    } catch (error) {
      console.warn("Informacao manual ficou pendente.", error);
      enqueueFeedback(payload);
      state.manualInfoStatus = "Informacao salva. Envio ao bridge ficou pendente e sera reenviado.";
    }
    render();
  }

  async function refreshLocalRhBridge() {
    try {
      const [summary, runtime] = await Promise.all([
        fetchJson(`${LOCAL_RH_BRIDGE_URL}/rh/status.json?days=90`),
        fetchJson(`${LOCAL_RH_BRIDGE_URL}/health`)
      ]);
      applyLiveRhData({
        runtime,
        summary,
        publishedAt: summary.generatedAt || new Date().toISOString()
      });
      return true;
    } catch (error) {
      console.warn("Bridge RH local indisponivel.", error);
      return false;
    }
  }

  async function refreshLiveRhOnce(db) {
    try {
      const snapshot = await db.collection("whatsapp_live").doc("rh").get();
      if (!snapshot.exists) {
        if (await refreshLocalRhBridge()) return;
        state.lastError = "Aguardando primeira publicacao do bridge RH.";
        render();
        return;
      }
      applyLiveRhData(snapshot.data() || {});
    } catch (error) {
      if (await refreshLocalRhBridge()) return;
      state.lastError = publicErrorMessage(error);
      render();
    }
  }

  function watchLiveRh(db) {
    db.collection("whatsapp_live").doc("rh").onSnapshot(snapshot => {
      if (!snapshot.exists) {
        refreshLocalRhBridge().then(usedLocal => {
          if (usedLocal) return;
          state.lastError = "Aguardando primeira publicacao do bridge RH.";
          render();
        });
        return;
      }
      applyLiveRhData(snapshot.data() || {});
    }, error => {
      refreshLocalRhBridge().then(usedLocal => {
        if (usedLocal) return;
        state.lastError = publicErrorMessage(error);
        render();
      });
    });
    refreshLiveRhOnce(db);
    setInterval(() => refreshLiveRhOnce(db), 30000);
  }

  function connectFirestore() {
    if (!window.firebase || !window.RH_FIREBASE_CONFIG) {
      state.lastError = "Conexao do portal ainda nao carregou.";
      render();
      return;
    }
    try {
      const app = firebase.apps.find(item => item.name === "whatsapp-rh") || firebase.initializeApp(window.RH_FIREBASE_CONFIG, "whatsapp-rh");
      const db = app.firestore();
      state.feedbackDb = db;
      watchCollection(db, "places", "places");
      watchCollection(db, "workers", "workers");
      watchCollection(db, "worker_profiles", "profiles");
      watchCollection(db, "scales", "scales");
      watchCollection(db, "entries", "entries");
      watchCollection(db, "ft_entries", "ftEntries");
      watchLiveRh(db);
      flushFeedbackQueue();
    } catch (error) {
      console.warn("Conexao RH indisponivel, usando seed-data.", error);
      state.lastError = publicErrorMessage(error);
      render();
    }
  }

  function placeName(id) {
    return dashboard.places.find(item => item.id === id)?.name || "";
  }

  function workerName(id) {
    return dashboard.workers.find(item => item.id === id)?.name || "";
  }

  function bestWorkerMatch(message) {
    if (message.workerId && workerName(message.workerId)) {
      return { worker: dashboard.workers.find(item => item.id === message.workerId), score: 1, source: "bridge" };
    }
    const haystack = [message.workerName, message.contactName, message.text].join(" ");
    const hayTokens = new Set(tokens(haystack));
    let best = { worker: null, score: 0, source: "texto" };
    for (const worker of dashboard.workers) {
      const workerTokens = tokens(worker.name);
      if (!workerTokens.length) continue;
      const hits = workerTokens.filter(token => hayTokens.has(token)).length;
      const score = hits / workerTokens.length;
      if (score > best.score) best = { worker, score, source: "texto" };
    }
    return best.score >= 0.55 ? best : { worker: null, score: best.score, source: "sem_match" };
  }

  function bestPlaceMatch(message) {
    const mentioned = (message.placeMentions || [])[0]?.placeName || "";
    const haystack = [mentioned, message.text, message.groupSubject].join(" ");
    const normalizedHaystack = normalizeText(haystack);
    let best = { place: null, score: 0, source: mentioned ? "bridge" : "texto" };
    for (const place of dashboard.places) {
      const name = normalizeText(place.name);
      if (name && normalizedHaystack.includes(name)) return { place, score: 1, source: mentioned ? "bridge" : "texto" };
      const placeTokens = tokens(place.name);
      const hayTokens = new Set(tokens(haystack));
      const hits = placeTokens.filter(token => hayTokens.has(token)).length;
      const score = placeTokens.length ? hits / placeTokens.length : 0;
      if (score > best.score) best = { place, score, source: mentioned ? "bridge" : "texto" };
    }
    return best.score >= 0.55 ? best : { place: null, score: best.score, source: "sem_match" };
  }

  function isHourlyReport(message) {
    const text = normalizeText(message.text || "");
    const groupMessage = message.chatType === "group" || Boolean(message.groupSubject);
    if (!groupMessage) return false;
    return /\b(tks|seguimento|sem alteracao|sem novidades|normal|posto ok|bom seguimento|ronda|rendido|assumindo)\b/.test(text) ||
      /\b([01]?\d|2[0-3])h\b/.test(text) ||
      Boolean(message.hasMedia && (message.placeMentions || []).length);
  }

  function isWorkedDayOff(message) {
    return /\b(folga trabalhada|dobra|cobertura|cobrir|ft)\b/.test(normalizeText(message.text || ""));
  }

  function dashboardCorrelation(message) {
    const day = saoPauloDay(message.messageAt || message.receivedAt || new Date());
    const workerMatch = bestWorkerMatch(message);
    const placeMatch = bestPlaceMatch(message);
    const workerId = workerMatch.worker?.id || "";
    const placeId = placeMatch.place?.id || "";
    const dayEntries = dashboard.entries.filter(item => item.date === day);
    const dayFt = dashboard.ftEntries.filter(item => item.date === day);
    const exactEntry = dayEntries.find(item => (!workerId || item.workerId === workerId) && (!placeId || item.placeId === placeId));
    const exactFt = dayFt.find(item => (!workerId || item.workerId === workerId) && (!placeId || item.placeId === placeId));
    const profile = workerId ? dashboard.profiles.find(item => item.workerId === workerId) : null;
    const hourly = isHourlyReport(message);
    const workedDayOff = isWorkedDayOff(message);
    const privateMessage = !(message.chatType === "group" || message.groupSubject);

    if (workedDayOff && exactFt) {
      return { tone: "ok", label: "Folga trabalhada confere", detail: `${workerName(exactFt.workerId) || exactFt.name} / ${placeName(exactFt.placeId)} / ${exactFt.startTime || "sem hora"}` };
    }
    if (workedDayOff && !exactFt) {
      return { tone: "warn", label: "FT sem cadastro no Dashboard", detail: `${workerMatch.worker?.name || "pessoa nao encontrada"} / ${placeMatch.place?.name || "posto nao encontrado"}` };
    }
    if (hourly && exactEntry) {
      return { tone: "ok", label: "Informe horario confere", detail: `${workerName(exactEntry.workerId)} / ${placeName(exactEntry.placeId)}` };
    }
    if (hourly && !exactEntry) {
      return { tone: "warn", label: "Informe horario sem escala compativel", detail: `${workerMatch.worker?.name || "pessoa nao encontrada"} / ${placeMatch.place?.name || "posto nao encontrado"}` };
    }
    if (privateMessage && ["candidate", "document", "payroll", "benefit", "medical_certificate", "termination", "vacation", "uniform_equipment", "request"].includes(message.intent)) {
      return { tone: "review", label: "Mensagem privada RH", detail: primaryOptionFor(message).short };
    }
    if (message.intent === "absence" || message.intent === "schedule") {
      return exactEntry || profile
        ? { tone: "warn", label: "Conferir escala cadastrada", detail: `${workerMatch.worker?.name || "pessoa encontrada parcial"} / ${placeMatch.place?.name || placeName(profile?.placeId) || "posto pendente"}` }
        : { tone: "bad", label: "Sem pessoa/posto validado", detail: "Precisa conferencia RH antes de considerar resolvido" };
    }
    return { tone: "review", label: hourly ? "Informe nao validado" : "Nao e informe horario", detail: `${workerMatch.worker?.name || "sem funcionario"} / ${placeMatch.place?.name || "sem posto"}` };
  }

  const topicLexicon = [
    { key: "candidate_intake", title: "Curriculo / candidato", words: ["curriculo", "cv", "vaga", "emprego", "oportunidade", "trabalhar", "cnv"] },
    { key: "termination", title: "Rescisao / FGTS", words: ["rescisao", "fgts", "homologacao", "seguro desemprego", "baixa carteira", "demissao", "desligamento", "ex funcionario"] },
    { key: "payslip", title: "Holerite", words: ["holerite", "olerite", "contra cheque", "contracheque", "demonstrativo", "incicle", "historico de holerites"] },
    { key: "gympass", title: "Gym Pass / Wellhub / TotalPass", words: ["gympass", "gym pass", "gm pass", "wellhub", "totalpass", "total pass", "academia"] },
    { key: "benefit_cards", title: "VR / VA / VT / cartao", words: ["vr", "va", "vt", "vale", "cartao", "beneficio", "caju", "pluxee", "sodexo", "alelo", "nao caiu", "nao carregou", "saldo", "flash", "cartao flash", "auxilio mobilidade", "superapp vr"] },
    { key: "ft_payment", title: "FT / folga trabalhada", words: ["ft", "folga trabalhada", "dobra", "cobertura", "trabalhei na folga", "plantao extra"] },
    { key: "vacation", title: "Ferias", words: ["ferias", "periodo aquisitivo", "concessivo", "tirar ferias", "marcar ferias"] },
    { key: "payroll_payment", title: "Pagamento / desconto", words: ["pagamento", "salario", "deposito", "desconto", "inss", "adiantamento", "faltou valor", "veio errado", "quinto dia util", "fechamento da folha"] },
    { key: "cct_values", title: "CCT / valores", words: ["cct", "sindicato", "sindeepres", "sesvesp", "piso", "periculosidade", "plr", "cesta", "valor", "premio de boa permanencia", "boa permanencia", "assiduidade"] },
    { key: "medical_certificate", title: "Atestado / falta / atraso", words: ["atestado", "medico", "falta", "atraso", "vou faltar", "faltei", "passando mal", "consulta"] },
    { key: "schedule", title: "Escala / folga", words: ["escala", "folga", "turno", "horario", "troca", "permuta", "ponto", "posto", "control rh", "registro de ponto", "bater ponto", "s3ca2"] },
    { key: "document", title: "Documento", words: ["documento", "declaracao", "aso", "contrato", "carta", "ctps", "comprovante", "espelho de ponto"] },
    { key: "uniform_equipment", title: "Uniforme / equipamento", words: ["uniforme", "cracha", "colete", "radio", "botina", "camisa", "calca", "farda", "epi"] }
  ];

  function contactKey(message = {}) {
    return String(message.chatId || message.fromPhone || message.contactPhone || message.contactName || message.groupSubject || "").trim().toLowerCase();
  }

  function messageTimeValue(message = {}) {
    const value = new Date(message.messageAt || message.receivedAt || message.createdAt || 0).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  function conversationMessagesFor(message) {
    const key = contactKey(message);
    if (!key) return [message];
    const currentTime = messageTimeValue(message);
    return currentMessages()
      .filter(row => contactKey(row) === key)
      .filter(row => !currentTime || !messageTimeValue(row) || messageTimeValue(row) <= currentTime)
      .sort((a, b) => messageTimeValue(a) - messageTimeValue(b))
      .slice(-20);
  }

  function detectDraftTopic(text, message) {
    const studyOption = primaryOptionFor(message);
    const studyKey = studyOption.key || message.intent || "";
    if (studyKey && !["request", "general_request", "rh_handoff", "unknown"].includes(studyKey)) {
      const normalizedKey = studyKey === "payroll" ? "payroll_payment" : studyKey === "benefit" ? "benefit_cards" : studyKey;
      return { key: normalizedKey, title: studyOption.title || normalizedKey, source: "responseStudy" };
    }
    const normalized = normalizeForKeyword(text);
    const hit = topicLexicon.find(topic => containsAny(normalized, topic.words));
    if (hit) return { key: hit.key, title: hit.title, source: "texto" };
    if (containsAny(normalized, ["oi", "ola", "bom dia", "boa tarde", "boa noite"])) return { key: "identity_verification", title: "Identificacao", source: "saudacao" };
    return { key: "general_request", title: "Solicitacao geral", source: "fallback" };
  }

  function extractDraftFacts(text, message = {}) {
    const normalized = normalizeForKeyword(text);
    const workerMatch = bestWorkerMatch({ ...message, text });
    const matchedWorkerName = workerMatch.worker?.name || readableName(message.workerName) || "";
    const greetingOnly = containsAny(normalized, ["oi", "ola", "bom dia", "boa tarde", "boa noite"]) && normalized.split(" ").length <= 5;
    const hasDate = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(normalized);
    const hasMonth = /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{1,2}\/\d{4})\b/.test(normalized);
    return {
      normalized,
      matchedWorkerName,
      hasName: Boolean(matchedWorkerName) || /\b(meu nome e|me chamo|sou o|sou a)\s+[a-z]{3,}/.test(normalized),
      hasDate,
      hasMonth,
      hasPeriod: !greetingOnly && (hasDate || hasMonth || /\b(hoje|ontem|amanha|semana|quinzena|periodo|diurno|noturno|manha|tarde|noite|turno)\b/.test(normalized)),
      hasBenefit: containsAny(normalized, ["vr", "va", "vt", "cartao", "beneficio", "vale", "caju", "pluxee", "sodexo", "alelo"]),
      hasPix: containsAny(normalized, ["pix", "chave pix"]),
      hasRole: containsAny(normalized, ["vigilante", "porteiro", "controlador", "controlador de acesso", "fiscal", "vigia", "auxiliar de servicos gerais", "auxiliar de manutencao", "operador de monitoramento", "supervisor", "recepcao", "portaria"]),
      hasPost: containsAny(normalized, ["posto", "base", "cliente", "condominio", "unidade"]),
      hasCity: containsAny(normalized, ["taubate", "sao jose", "sjc", "cacapava", "tremembe", "pindamonhangaba", "jacarei", "cidade"]),
      hasCurriculum: containsAny(normalized, ["curriculo", "cv", "cnv", "anexo"]),
      hasHour: /\b\d{1,2}h|\b\d{1,2}:\d{2}\b|manha|tarde|noite|turno\b/.test(normalized),
      hasDocument: containsAny(normalized, ["documento", "declaracao", "aso", "contrato", "ctps", "comprovante", "espelho de ponto"]),
      hasUniform: containsAny(normalized, ["uniforme", "cracha", "botina", "camisa", "calca", "farda", "epi", "equipamento"]),
      hasProof: containsAny(normalized, ["atestado", "comprovante", "anexo", "foto", "pdf"]),
      hasTermination: containsAny(normalized, ["rescisao", "fgts", "homologacao", "seguro desemprego", "baixa"]),
      asksPayment: containsAny(normalized, ["pagamento", "salario", "deposito", "desconto", "inss", "adiantamento", "nao caiu"]),
      asksValue: containsAny(normalized, ["valor", "quanto", "piso", "cct", "periculosidade", "plr", "cesta"]),
      exploratoryValueComparison: isExploratoryValueComparison(normalized)
    };
  }

  function mergeDraftContext(context, facts, topic) {
    const next = { ...context };
    if (facts.hasName) next.hasName = true;
    if (facts.matchedWorkerName) next.matchedWorkerName = facts.matchedWorkerName;
    if (facts.hasDate) next.hasDate = true;
    if (facts.hasMonth) next.hasMonth = true;
    if (facts.hasPeriod) next.hasPeriod = true;
    if (facts.hasBenefit) next.hasBenefit = true;
    if (facts.hasPix) next.hasPix = true;
    if (facts.hasRole) next.hasRole = true;
    if (facts.hasPost) next.hasPost = true;
    if (facts.hasCity) next.hasCity = true;
    if (facts.hasCurriculum) next.hasCurriculum = true;
    if (facts.hasHour) next.hasHour = true;
    if (facts.hasDocument) next.hasDocument = true;
    if (facts.hasUniform) next.hasUniform = true;
    if (facts.hasProof) next.hasProof = true;
    if (facts.hasTermination) next.hasTermination = true;
    if (facts.asksPayment) next.asksPayment = true;
    if (facts.asksValue) next.asksValue = true;
    if (facts.exploratoryValueComparison) next.exploratoryValueComparison = true;
    if (topic?.key && topic.key !== "identity_verification" && topic.key !== "general_request") next.topicKey = topic.key;
    return next;
  }

  function isLowInfoForDraft(text, facts, topic) {
    const normalized = facts.normalized || normalizeForKeyword(text);
    const substantive = facts.hasName || facts.hasDate || facts.hasMonth || facts.hasBenefit || facts.hasPix || facts.hasRole ||
      facts.hasCity || facts.hasCurriculum || facts.hasHour || facts.hasDocument || facts.hasUniform || facts.hasProof ||
      facts.hasTermination || facts.asksPayment || facts.asksValue || facts.exploratoryValueComparison || (topic.key !== "identity_verification" && topic.key !== "general_request");
    if (substantive) return false;
    return !normalized || /^(sim|nao|n|ok|okay|certo|ta|tudo bem|entendi|pode|isso|nao sei|n sei|sei la|obrigado|obrigada|valeu|vlw)$/.test(normalized);
  }

  function conversationContextForDraft(message) {
    const context = { unclearAttempts: 0, turns: 0 };
    for (const row of conversationMessagesFor(message)) {
      const text = messageFullText(row);
      const facts = extractDraftFacts(text, row);
      const topic = detectDraftTopic(text, row);
      Object.assign(context, mergeDraftContext(context, facts, topic));
      context.turns += 1;
      context.unclearAttempts = isLowInfoForDraft(text, facts, topic) ? context.unclearAttempts + 1 : 0;
    }
    return context;
  }

  function missingFieldsForDraft(optionKey, context) {
    const missing = [];
    const need = (field, ok) => { if (!ok) missing.push(field); };
    if (["candidate_intake"].includes(optionKey)) {
      need("nome", context.hasName);
      need("cidade", context.hasCity);
      need("funcao desejada", context.hasRole);
      need("curriculo", context.hasCurriculum);
    } else if (["benefit_cards"].includes(optionKey)) {
      need("nome", context.hasName);
      need("beneficio ou cartao", context.hasBenefit);
      need("data ou periodo", context.hasPeriod);
    } else if (["gympass"].includes(optionKey)) {
      need("nome", context.hasName);
    } else if (["payslip"].includes(optionKey)) {
      need("nome", context.hasName);
      need("mes ou competencia", context.hasMonth);
    } else if (["ft_payment"].includes(optionKey)) {
      need("nome", context.hasName);
      need("data da FT", context.hasDate);
      need("turno ou periodo", context.hasPeriod);
      if (context.asksPayment) need("PIX", context.hasPix);
    } else if (["payroll_payment"].includes(optionKey)) {
      need("competencia ou data", context.hasPeriod);
      need("o que conferir", context.asksPayment || context.asksValue);
      need("nome", context.hasName);
    } else if (["schedule"].includes(optionKey)) {
      need("nome", context.hasName);
      need("data", context.hasDate || context.hasPeriod);
      need("horario", context.hasHour);
    } else if (["medical_certificate"].includes(optionKey)) {
      need("nome", context.hasName);
      need("horario afetado", context.hasPeriod || context.hasHour);
      need("atestado ou comprovante", context.hasProof);
    } else if (["document"].includes(optionKey)) {
      need("nome", context.hasName);
      need("documento solicitado", context.hasDocument);
    } else if (["uniform_equipment"].includes(optionKey)) {
      need("nome", context.hasName);
      need("item", context.hasUniform);
    } else if (["termination"].includes(optionKey)) {
      need("nome", context.hasName);
      need("assunto da rescisao", context.hasTermination);
    } else if (["cct_values"].includes(optionKey)) {
      need("nome", context.hasName);
      need("funcao", context.hasRole);
      need("valor ou beneficio", context.asksValue || context.hasBenefit);
    } else {
      need("assunto", context.topicKey);
    }
    return missing.slice(0, 4);
  }

  const draftMissingPriority = {
    payroll_payment: ["competencia ou data", "o que conferir", "nome"],
    benefit_cards: ["data ou periodo", "beneficio ou cartao", "nome"],
    payslip: ["mes ou competencia", "nome"],
    ft_payment: ["data da FT", "turno ou periodo", "PIX", "nome"],
    schedule: ["data", "horario", "nome"],
    medical_certificate: ["horario afetado", "atestado ou comprovante", "nome"],
    document: ["documento solicitado", "nome"],
    uniform_equipment: ["item", "nome"],
    cct_values: ["valor ou beneficio", "funcao", "nome"],
    vacation: ["periodo desejado", "nome"],
    candidate_intake: ["cidade", "funcao desejada", "curriculo", "nome"],
    termination: ["assunto da rescisao", "nome"],
    general_request: ["assunto"],
    identity_verification: ["assunto", "nome"]
  };

  const draftFieldQuestions = {
    assunto: "Qual e sua duvida?",
    nome: "Informe seu nome e sobrenome.",
    "beneficio ou cartao": "Qual beneficio ou cartao e o problema?",
    "data ou periodo": "Desde quando isso acontece?",
    "data da FT": "Qual foi a data da FT?",
    "turno ou periodo": "Qual foi o turno ou periodo?",
    PIX: "Informe a chave PIX para conferencia.",
    "competencia ou data": "Qual mes e ano, ou qual data especifica, devo considerar?",
    "o que conferir": "O que precisa ser conferido nesse pagamento?",
    "funcao desejada": "Qual funcao desejada?",
    "mes ou competencia": "De qual mes e ano voce precisa?",
    cidade: "Qual e a cidade?",
    curriculo: "Envie o curriculo ou informe que vai anexar.",
    data: "Qual e a data?",
    horario: "Qual e o horario?",
    "horario afetado": "Qual horario foi afetado?",
    "atestado ou comprovante": "Envie o atestado ou comprovante.",
    "documento solicitado": "Qual documento voce precisa?",
    item: "Qual item voce precisa?",
    funcao: "Qual e sua funcao?",
    "valor ou beneficio": "Qual valor ou beneficio precisa conferir?",
    "periodo desejado": "Qual periodo desejado?",
    "assunto da rescisao": "Qual assunto da rescisao precisa tratar?"
  };

  const draftFieldExamples = {
    nome: "Joao Silva",
    "competencia ou data": "maio/2026 ou 05/06/2026",
    "o que conferir": "desconto de VT, INSS, salario ou adiantamento",
    "data ou periodo": "desde 10/06 ou no beneficio de junho",
    "beneficio ou cartao": "VR Caju, VA, VT ou cartao Flash",
    "data da FT": "12/06/2026",
    "turno ou periodo": "noturno, 18h as 06h",
    PIX: "CPF, e-mail ou telefone",
    "mes ou competencia": "maio/2026",
    cidade: "Taubate ou Sao Jose dos Campos",
    "funcao desejada": "vigilante ou controlador de acesso",
    curriculo: "curriculo anexo",
    data: "20/06/2026 ou amanha",
    horario: "06h, 18h ou 18h as 06h",
    "horario afetado": "turno das 18h ou entrada as 06h",
    "atestado ou comprovante": "foto do atestado em anexo",
    "documento solicitado": "declaracao, ASO, contrato ou holerite",
    item: "camisa G, cracha ou botina 42",
    funcao: "vigilante, porteiro ou controlador de acesso",
    "valor ou beneficio": "piso do vigilante, VR, cesta ou PLR",
    "periodo desejado": "ferias em julho/2026",
    "assunto da rescisao": "FGTS, homologacao, baixa na carteira ou seguro-desemprego",
    assunto: "duvida sobre pagamento de maio/2026"
  };

  function nextMissingFieldForDraft(optionKey, missing) {
    const rows = Array.isArray(missing) ? missing.filter(Boolean) : [];
    if (!rows.length) return "";
    const priority = draftMissingPriority[optionKey] || [];
    return priority.find(field => rows.includes(field)) || rows[0];
  }

  function draftMissingPrompt(optionKey, missing, includeExamples = false) {
    const field = nextMissingFieldForDraft(optionKey, missing);
    if (!field) return "";
    const question = draftFieldQuestions[field] || `Informe ${field}.`;
    const example = includeExamples && draftFieldExamples[field] ? ` Exemplo: ${draftFieldExamples[field]}.` : "";
    return `${question}${example}`;
  }

  function gatheredFieldsForDraft(context) {
    return [
      context.matchedWorkerName ? `nome: ${context.matchedWorkerName}` : context.hasName ? "nome" : "",
      context.hasBenefit ? "beneficio/cartao" : "",
      context.hasDate ? "data" : "",
      context.hasMonth ? "competencia" : "",
      context.hasPeriod ? "periodo" : "",
      context.hasPix ? "PIX" : "",
      context.hasRole ? "funcao" : "",
      context.hasCity ? "cidade" : "",
      context.hasDocument ? "documento" : "",
      context.hasUniform ? "uniforme/equipamento" : "",
      context.hasProof ? "comprovante/atestado" : "",
      context.hasHour ? "horario" : ""
    ].filter(Boolean);
  }

  function manualInfoTextForDraft(optionKey) {
    const rows = manualInfoForOption(optionKey);
    if (!rows.length) return "";
    return `\n\nInfo RH cadastrada: ${rows.map(row => `${row.topicLabel}: ${row.text}`).join(" | ")}`;
  }

  function draftReplyForMessage(message) {
    const text = messageFullText(message);
    const topic = detectDraftTopic(text, message);
    const context = conversationContextForDraft(message);
    const initialOptionKey = context.exploratoryValueComparison ? "payroll_payment" : (context.topicKey || topic.key || "general_request");
    const declaredAnswer = declaredAnswerForDraft(text, initialOptionKey, context);
    const optionKey = declaredAnswer?.optionKey || initialOptionKey;
    const missing = missingFieldsForDraft(optionKey, context);
    const gathered = gatheredFieldsForDraft(context);
    const matchedName = context.matchedWorkerName ? ` Encontrei o cadastro de ${context.matchedWorkerName}.` : "";
    const manual = manualInfoTextForDraft(optionKey);
    const normalizedText = normalizeForKeyword(text);
    const greetingOnly = containsAny(normalizedText, ["oi", "ola", "bom dia", "boa tarde", "boa noite"]) && normalizedText.split(" ").length <= 5;
    const askMissing = () => missing.length ? ` ${draftMissingPrompt(optionKey, missing, context.unclearAttempts > 0)}` : "";
    let reply = "";
    if (context.exploratoryValueComparison) {
      reply = `Ola! Entendi. Comparacao de valor, extra, pagamento ou beneficio precisa de conferencia de um especialista do RH. Envie somente sua duvida atual com nome, competencia ou data, e o item exato a conferir. Exemplo: Joao Silva, FT do dia 12/06 veio com valor diferente.`;
    } else if (context.unclearAttempts >= MAX_UNCLEAR_ATTEMPTS) {
      reply = `Ola! Depois de ${MAX_UNCLEAR_ATTEMPTS} tentativas, ainda nao ficou seguro para o atendimento automatico. Vou direcionar para o RH humano assim que o RH estiver conectado. Se puder, envie uma unica mensagem com a duvida principal. ${RH_TOPIC_EXAMPLES_PROMPT}`;
    } else if (declaredAnswer) {
      reply = declaredAnswer.reply;
    } else if (greetingOnly && ["identity_verification", "general_request"].includes(optionKey) && !context.topicKey) {
      reply = RH_FIRST_MESSAGE;
    } else if (["identity_verification", "general_request"].includes(optionKey) && !context.topicKey) {
      const contextHint = matchedName ? ` Encontrei o cadastro de ${matchedName}.${context.hasMonth || context.hasDate || context.hasPeriod ? " Vi tambem uma data ou competencia na mensagem." : ""}` : "";
      reply = matchedName
        ? `Ola!${contextHint} Qual e sua duvida?`
        : `Ola! ${currentQuestionText()}`;
    } else if (optionKey === "benefit_cards") {
      reply = `Ola! Entendi.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH conferir periodo e operadora antes de responder."}`;
    } else if (optionKey === "gympass") {
      reply = `Ola! Entendi.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH conferir o cadastro do beneficio."}`;
    } else if (optionKey === "payslip") {
      reply = `Ola! Consigo ajudar com o pedido de holerite.${matchedName}${askMissing() || " Vou encaminhar para verificacao do mes solicitado."}`;
    } else if (optionKey === "ft_payment") {
      reply = `Ola! Vou tratar como FT.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH conferir data, turno e pagamento."}`;
    } else if (optionKey === "payroll_payment") {
      reply = `Ola! Entendi.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH conferir cadastro e competencia no sistema e te responder corretamente."}`;
    } else if (optionKey === "schedule") {
      reply = `Ola! Entendi.${matchedName}${askMissing() || " Vou conferir no Dashboard."}`;
    } else if (optionKey === "medical_certificate") {
      reply = `Ola! Recebi a informacao.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH registrar e conferir."}`;
    } else if (optionKey === "candidate_intake") {
      reply = `Ola! Recebemos seu contato para oportunidade na TKA.${askMissing() || " Vou encaminhar para triagem do RH."}`;
    } else if (optionKey === "cct_values") {
      reply = `Ola! Valores de CCT, piso, beneficio ou periculosidade dependem de funcao, escala, faltas, ferias e convencao aplicavel.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH conferir no sistema."}`;
    } else {
      reply = `Ola! Obrigado pelo contato.${matchedName}${askMissing() || " Vou encaminhar para um especialista do RH verificar e retornar corretamente."}`;
    }
    const withManual = `${reply}${manual}`;
    const finalReply = shouldAppendDraftResolution(optionKey, withManual, missing, context)
      ? appendResolutionQuestion(withManual)
      : withManual;
    return {
      optionKey,
      title: topic.title,
      reply: finalReply,
      missing,
      gathered,
      unclearAttempts: context.unclearAttempts,
      escalatedToRh: context.unclearAttempts >= MAX_UNCLEAR_ATTEMPTS,
      resolutionQuestionAsked: finalReply !== withManual,
      resolutionStatus: "",
      restricted: Boolean(context.exploratoryValueComparison),
      declaredAnswer: declaredAnswer ? {
        key: declaredAnswer.key,
        optionKey: declaredAnswer.optionKey,
        title: declaredAnswer.title,
        source: declaredAnswer.source,
        score: declaredAnswer.score
      } : null
    };
  }

  function answerPatternFor(intent) {
    const dynamic = (state.summary?.responseStudy?.optionCatalog || [])
      .find(option => option.key === intent || (option.intents || []).includes(intent));
    if (dynamic) {
      return {
        title: dynamic.title,
        short: dynamic.short,
        text: dynamic.prompt || dynamic.short,
        learnedCount: dynamic.learnedCount || 0
      };
    }
    const patterns = {
      candidate: {
        title: "Candidato / vaga",
        short: "Coletar nome, cidade, funcao, disponibilidade e enviar para triagem.",
        text: "Responder pedindo nome completo, cidade, funcao desejada, CNV quando aplicavel, disponibilidade e curriculo."
      },
      absence: {
        title: "Falta, atestado ou atraso",
        short: "Confirmar posto, horario, motivo e documento.",
        text: "Confirmar colaborador, posto, horario afetado, previsao e comprovante. Cruzar com escala do dia antes de fechar."
      },
      medical_certificate: {
        title: "Atestado / falta / atraso",
        short: "Confirmar posto, horario, motivo e comprovante.",
        text: "Confirmar colaborador, posto, horario afetado, previsao e anexar atestado ou comprovante."
      },
      termination: {
        title: "Rescisao / desligamento",
        short: "Confirmar se e ex-funcionario.",
        text: "Confirmar nome completo, CPF, data de desligamento e assunto: rescisao, homologacao, FGTS, baixa ou seguro desemprego."
      },
      vacation: {
        title: "Ferias",
        short: "Confirmar periodo solicitado.",
        text: "Confirmar colaborador, CPF, periodo desejado ou duvida sobre ferias e conferir cadastro."
      },
      schedule: {
        title: "Escala, folga ou cobertura",
        short: "Validar contra Dashboard e FT.",
        text: "Conferir pessoa, posto e dia no Dashboard. Se for folga trabalhada, exigir cadastro FT ou registrar divergencia."
      },
      document: {
        title: "Documento",
        short: "Conferir dossie do colaborador.",
        text: "Vincular documento ao colaborador correto e sinalizar pendencia quando CPF/nome nao bater com cadastro."
      },
      payroll: {
        title: "Pagamento / beneficio",
        short: "Separar duvida de RH financeiro.",
        text: "Identificar colaborador, periodo e tipo de beneficio antes de encaminhar ou responder."
      },
      benefit: {
        title: "Beneficio",
        short: "Separar Gym Pass, VR, VT, vale ou cartao.",
        text: "Confirmar colaborador, vínculo com a TKA, posto e tipo de benefício antes de responder."
      },
      uniform_equipment: {
        title: "Uniforme / equipamento",
        short: "Registrar item, tamanho e posto.",
        text: "Confirmar item, tamanho, posto, responsavel e urgencia para evitar entrega duplicada."
      },
      request: {
        title: "Solicitacao geral",
        short: "Classificar e responder com dado faltante.",
        text: "Solicitar pessoa, posto, data e motivo quando a mensagem vier incompleta."
      }
    };
    return patterns[intent] || { title: "Mensagem", short: "Revisar contexto.", text: "Ler contexto e vincular a pessoa, posto e data antes de responder." };
  }

  function responseStudyFor(message) {
    return message?.responseStudy || {};
  }

  function displayFirstQuestion(raw) {
    const text = String(raw || "").trim();
    const normalized = normalizeText(text);
    if (!text) return currentQuestionText();
    if (/^(primeiro|confirmar|pedir|orientar|tratar|usar)\b/.test(normalized)) return currentQuestionText();
    if (/funcionario da tka.*ex funcionario.*curriculo|opcoes de assuntos|topicos/i.test(normalized)) return currentQuestionText();
    return text;
  }

  function primaryOptionFor(message) {
    const study = responseStudyFor(message);
    if (Array.isArray(study.options) && study.options.length) return study.options[0];
    const pattern = answerPatternFor(message.intent);
    return { title: pattern.title, short: pattern.short, prompt: pattern.text, learnedCount: pattern.learnedCount || 0 };
  }

  function displayOptionHint(option) {
    const raw = option?.prompt || option?.short || "";
    return displayFirstQuestion(raw);
  }

  function responseOptionButtons(message) {
    const options = responseStudyFor(message).options || [];
    const fallback = primaryOptionFor(message);
    const rows = options.length ? options : [{ key: "general_request", title: fallback.title, short: fallback.short, prompt: fallback.prompt }];
    const buttons = rows.slice(0, 5).map(option => {
      const label = option.title || option.key || "Solicitacao geral";
      return `
        <button type="button" class="response-button" title="${escapeHtml(displayOptionHint(option))}" data-feedback-action="option" data-option-key="${escapeHtml(option.key || "general_request")}" data-option-title="${escapeHtml(option.title || option.key || "Solicitacao geral")}">
          ${escapeHtml(label)}
        </button>
      `;
    }).join("");
    return `
      <div class="response-actions">
        ${buttons}
        <button type="button" class="response-button secondary" data-feedback-action="other">Outros</button>
      </div>
      <div class="other-feedback" hidden>
        <input type="text" maxlength="120" placeholder="Digite a situacao" aria-label="Outra situacao RH">
        <button type="button" class="response-button" data-feedback-action="submit-other">Salvar</button>
      </div>
    `;
  }

  function feedbackStatusHtml(messageId) {
    const status = state.feedbackStatus[messageId];
    if (!status?.text) return "";
    const tone = status.tone === "ok" ? "ok" : status.tone === "bad" ? "bad" : "warn";
    return `<div class="feedback-status ${tone}">${escapeHtml(status.text)}</div>`;
  }

  function queueStateTag(message) {
    const queueState = message.queueState || {};
    if (!queueState.resolved) return "";
    const label = queueState.status === "informative" ? "informativo salvo" : "resolvido";
    return `<span class="tag ok" title="${escapeHtml(queueState.reason || queueState.selectedTitle || "")}">${label}</span>`;
  }

  function qrReaderPanelHtml(health) {
    if (!health.qrRequired) return "";
    const qrDataUrl = String(health.qrDataUrl || "").trim();
    const updatedAt = health.qrUpdatedAt || health.connectionStateAt || "";
    return `
      <article class="metric qr-reader ${qrDataUrl ? "bad" : "warn"}">
        <div>
          <span>Vincular WhatsApp RH</span>
          <strong>${qrDataUrl ? "Leia o QR" : "QR aguardando"}</strong>
          <p class="muted">Abra o WhatsApp do RH no celular, acesse Aparelhos conectados e leia este QR. Esta pagina atualiza sozinha.</p>
          ${updatedAt ? `<p class="item-meta">QR gerado em ${escapeHtml(formatDateTime(updatedAt))}</p>` : ""}
          <a class="qr-local-link" href="${LOCAL_RH_BRIDGE_URL}/qr" target="_blank" rel="noreferrer">Abrir QR local</a>
        </div>
        ${qrDataUrl ? `<img class="qr-image" src="${escapeHtml(qrDataUrl)}" alt="QR Code para vincular WhatsApp RH">` : ""}
      </article>
    `;
  }

  function renderConnection() {
    const health = state.health || {};
    const summary = state.summary || {};
    const published = new Date(state.lastUpdatedAt || 0).getTime();
    const hasPublication = Boolean(state.lastUpdatedAt);
    const stale = hasPublication && (!published || Date.now() - published > 45000);
    const connectedTone = health.connected ? "ok" : health.qrRequired ? "bad" : "warn";
    const connectedText = !hasPublication ? "aguardando" : health.connected ? "conectado" : health.qrRequired ? "QR pendente" : (health.connectionState || "sem conexao");
    el.connectionPanel.innerHTML = `
      <article class="metric ${state.lastError ? "bad" : !hasPublication ? "" : stale ? "warn" : "ok"}"><span>Publicacao</span><strong>${state.lastError ? "erro" : !hasPublication ? "carregando" : stale ? "atrasada" : "ativa"}</strong></article>
      <article class="metric ${connectedTone}"><span>WhatsApp RH</span><strong>${escapeHtml(connectedText)}</strong></article>
      <article class="metric"><span>Mensagens RH</span><strong>${summary.totals?.messages || health.rhMessageCount || 0}</strong></article>
      <article class="metric warn"><span>Fila atencao</span><strong>${summary.totals?.attention || 0}</strong></article>
      <article class="metric"><span>Pessoas aprendidas</span><strong>${summary.liveLearning?.totals?.people || 0}</strong></article>
      ${qrReaderPanelHtml(health)}
    `;
    el.pageMeta.textContent = state.lastError
      ? state.lastError
      : !hasPublication
        ? "Aguardando publicacao live do bridge RH..."
        : window.matchMedia?.("(max-width: 720px)")?.matches
          ? `Atualizado: ${shortHourMinute(state.lastUpdatedAt)}`
          : `Publicado em ${formatDateTime(state.lastUpdatedAt)} / fetch ${formatDateTime(state.lastFetchedAt)} / ${summary.generatedAt ? `dados ${formatDateTime(summary.generatedAt)}` : "aguardando dados"}`;
  }

  function draftSuggestionHtml(message) {
    const draft = draftReplyForMessage(message);
    return `
      <div class="rh-draft-suggestion" data-draft-reply="${escapeHtml(draft.reply)}">
        <div class="item-header">
          <div class="item-title">Rascunho assistido</div>
          <span class="tag ${draft.escalatedToRh || draft.restricted ? "bad" : draft.missing.length ? "warn" : "ok"}">${draft.restricted ? "restrito RH" : draft.escalatedToRh ? "encaminhar RH" : draft.missing.length ? "coletar dados" : "pronto para conferir"}</span>
        </div>
        <div class="message">${escapeHtml(draft.reply)}</div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(draft.title || draft.optionKey)}</span>
          ${draft.restricted ? `<span class="tag bad">sem comparacao</span>` : ""}
          ${draft.unclearAttempts ? `<span class="tag warn">${draft.unclearAttempts}/${MAX_UNCLEAR_ATTEMPTS} tentativas</span>` : ""}
          ${draft.missing.map(field => `<span class="tag warn">falta: ${escapeHtml(field)}</span>`).join("")}
          ${draft.gathered.slice(0, 6).map(field => `<span class="tag ok">${escapeHtml(field)}</span>`).join("")}
        </div>
        <button type="button" class="response-button secondary" data-feedback-action="copy-draft">Copiar rascunho</button>
      </div>
    `;
  }

  function messageCard(message) {
    const correlation = dashboardCorrelation(message);
    const pattern = primaryOptionFor(message);
    const study = responseStudyFor(message);
    const audience = study.audience || {};
    const firstQuestion = displayFirstQuestion(study.firstQuestion || state.summary?.responseStudy?.triageQuestion || "");
    const text = messageFullText(message);
    const isResolved = Boolean(message.queueState?.resolved);
    return `
      <article class="item ${isResolved ? "item-resolved" : ""}" data-message-id="${escapeHtml(message.id || "")}">
        <div class="item-header">
          <div>
            <div class="item-title">${escapeHtml(messageDisplayTitle(message))}</div>
            <div class="item-meta">${escapeHtml(messageDisplayMeta(message))}</div>
          </div>
          <span class="tag ${correlation.tone === "ok" ? "ok" : correlation.tone === "bad" ? "bad" : "warn"}">${escapeHtml(correlation.label)}</span>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(message.intentLabel || pattern.title)}</span>
          ${audience.label ? `<span class="tag ${audience.key === "unknown" ? "warn" : "ok"}">${escapeHtml(audience.label)}</span>` : ""}
          <span class="tag ${isHourlyReport(message) ? "ok" : ""}">${isHourlyReport(message) ? "informe horario" : "nao horario"}</span>
          ${queueStateTag(message)}
          ${message.hasMedia ? `<span class="tag">midia enviada</span>` : ""}
        </div>
        <div class="message">${escapeHtml(text)}</div>
        ${messageDisplayValidationHtml(message)}
        ${!isResolved && firstQuestion ? `<div class="response-question">${escapeHtml(firstQuestion)}</div>` : ""}
        ${!isResolved ? draftSuggestionHtml(message) : ""}
        ${!isResolved ? `<div class="response-options">${responseOptionButtons(message)}</div>` : ""}
        ${feedbackStatusHtml(message.id)}
        <div class="item-meta">${escapeHtml(correlation.detail)}</div>
      </article>
    `;
  }

  function renderAttention() {
    const messages = state.summary?.attentionQueue || [];
    el.queueCount.textContent = String(state.summary?.totals?.attention ?? messages.length);
    el.attentionList.innerHTML = messages.length
      ? messages.slice(0, 80).map(messageCard).join("")
      : `<div class="empty">Nenhuma mensagem RH pendente agora.</div>`;
  }

  function renderAnswerPatterns() {
    const study = state.summary?.responseStudy || {};
    const dynamicOptions = study.nextOptions || [];
    if (dynamicOptions.length) {
      const audienceOptions = study.audienceOptions || [];
      const feedback = study.feedback || {};
      el.answerPatterns.innerHTML = `
        <article class="item response-priority">
          <div class="item-title">Primeira pergunta</div>
          <div class="message">${escapeHtml(displayFirstQuestion(study.triageQuestion))}</div>
          <div class="tag-row">
            ${audienceOptions.map(item => `<span class="tag">${escapeHtml(item.label)}</span>`).join("")}
            ${feedback.total ? `<span class="tag ok">aprendizado ativo</span>` : ""}
            ${feedback.custom ? `<span class="tag warn">Outros aprendido</span>` : ""}
          </div>
        </article>
        ${dynamicOptions.slice(0, 9).map(option => `
          <article class="item">
            <div class="item-header">
              <div class="item-title">${escapeHtml(option.title)}</div>
              <span class="tag">${escapeHtml(option.source === "operator-feedback" ? "aprendido" : "dinamico")}</span>
            </div>
            <div class="message">${escapeHtml(displayOptionHint(option))}</div>
            ${option.evidence?.length ? `<div class="item-meta">${option.evidence.map(escapeHtml).join("<br>")}</div>` : ""}
          </article>
        `).join("")}
      `;
      return;
    }
    const intents = state.summary?.intentCounts?.map(item => item.intent) || ["candidate", "medical_certificate", "schedule", "document", "payroll", "benefit", "uniform_equipment", "request"];
    const unique = [...new Set(intents)].slice(0, 8);
    el.answerPatterns.innerHTML = unique.map(intent => {
      const pattern = answerPatternFor(intent);
      return `
        <article class="item">
          <div class="item-title">${escapeHtml(pattern.title)}</div>
          <div class="message">${escapeHtml(pattern.text)}</div>
        </article>
      `;
    }).join("");
  }

  function renderDashboardMatches() {
    const day = saoPauloDay();
    el.dashboardDay.textContent = day.split("-").reverse().join("/");
    const messages = (state.summary?.recentMessages || []).slice(0, 80);
    const correlated = messages.map(message => ({ message, correlation: dashboardCorrelation(message) }));
    const buckets = [
      { label: "Conferidos", tone: "ok", rows: correlated.filter(item => item.correlation.tone === "ok") },
      { label: "Revisar escala/FT", tone: "warn", rows: correlated.filter(item => item.correlation.tone === "warn") },
      { label: "Sem vinculo", tone: "bad", rows: correlated.filter(item => item.correlation.tone === "bad") },
      { label: "Outros RH", tone: "review", rows: correlated.filter(item => item.correlation.tone === "review") }
    ];
    el.dashboardMatches.innerHTML = buckets.map(bucket => `
      <article class="item">
        <div class="item-header">
          <div class="item-title">${bucket.label}</div>
          <span class="tag ${bucket.tone === "ok" ? "ok" : bucket.tone === "bad" ? "bad" : bucket.tone === "warn" ? "warn" : ""}">${bucket.rows.length}</span>
        </div>
        <div class="item-meta">
          ${bucket.rows.slice(0, 6).map(item => `${escapeHtml(item.correlation.label)}: ${escapeHtml(item.correlation.detail)}`).join("<br>") || "Sem itens nesta faixa."}
        </div>
      </article>
    `).join("");
  }

  function renderRecent() {
    const messages = state.summary?.recentMessages || [];
    el.recentMessages.innerHTML = messages.length
      ? messages.slice(0, 60).map(messageCard).join("")
      : `<div class="empty">Aguardando mensagens do bridge RH.</div>`;
  }

  function renderPeople() {
    const people = state.summary?.people || state.summary?.liveLearning?.people || [];
    el.peoplePatterns.innerHTML = people.length
      ? people.slice(0, 80).map(person => `
        <article class="item">
          <div class="item-title">${escapeHtml(readableName(person.contactName) || "Contato RH")}</div>
          <div class="item-meta">${person.count || person.totalMessages || 0} mensagem(ns)${compactPhone(person.phone) ? ` / contato ${compactPhone(person.phone)}` : ""} / ultima ${formatDateTime(person.lastMessageAt || person.lastSeenAt)}</div>
          <div class="tag-row">
            ${(person.intents || []).slice(0, 4).map(item => `<span class="tag">${escapeHtml(item.label || item.intent)}${item.count ? `: ${item.count}` : ""}</span>`).join("")}
          </div>
          <div class="item-meta">${(person.places || []).slice(0, 4).map(item => escapeHtml(item.placeName)).join(" / ") || "Sem posto citado"}</div>
        </article>
      `).join("")
      : `<div class="empty">Nenhum padrao RH aprendido ainda.</div>`;
  }

  function renderManualInfo() {
    if (!el.manualInfoBox || !el.manualInfoList) return;
    el.manualInfoBox.hidden = !state.manualInfoOpen;
    if (el.manualInfoToggle) {
      el.manualInfoToggle.textContent = state.manualInfoOpen ? "Fechar informacoes" : "Adicione mais informacoes";
    }
    if (el.manualInfoStatus) el.manualInfoStatus.textContent = state.manualInfoStatus || "";
    const rows = loadManualInfo().slice(-8).reverse();
    el.manualInfoList.innerHTML = rows.length
      ? rows.map(row => `
        <article class="manual-info-item">
          <div class="item-header">
            <div class="item-title">${escapeHtml(row.topicLabel || manualInfoTopicLabel(row.topic))}</div>
            <span class="tag">${escapeHtml(shortHourMinute(row.createdAt) || "")}</span>
          </div>
          <div class="message">${escapeHtml(row.text)}</div>
        </article>
      `).join("")
      : `<div class="empty">Nenhuma informacao manual adicionada ainda. Exemplos: data de pagamento, resposta de Gym Pass/Wellhub, beneficio do dia, documento liberado.</div>`;
  }

  function handleFeedbackClick(event) {
    const button = event.target.closest("[data-feedback-action]");
    if (!button) return;
    const card = button.closest("[data-message-id]");
    const message = messageById(card?.dataset.messageId || "");
    const action = button.dataset.feedbackAction;

    if (action === "copy-draft") {
      const reply = button.closest(".rh-draft-suggestion")?.dataset.draftReply || "";
      if (!reply) return;
      navigator.clipboard?.writeText(reply).then(() => {
        if (message) setFeedbackStatus(message.id, "ok", "Rascunho copiado.");
      }).catch(() => {
        if (message) setFeedbackStatus(message.id, "pending", "Nao foi possivel copiar automaticamente.");
      });
      return;
    }

    if (!message) return;

    if (action === "other") {
      const form = card.querySelector(".other-feedback");
      if (!form) return;
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector("input")?.focus();
      return;
    }

    if (action === "submit-other") {
      const input = card.querySelector(".other-feedback input");
      const customText = input?.value?.trim() || "";
      if (!customText) {
        input?.focus();
        return;
      }
      submitFeedback(message, { key: "custom", title: customText }, customText);
      return;
    }

    if (action === "option") {
      submitFeedback(message, {
        key: button.dataset.optionKey || "general_request",
        title: button.dataset.optionTitle || button.textContent.trim()
      });
    }
  }

  function handleFeedbackKeydown(event) {
    if (event.key !== "Enter") return;
    const input = event.target.closest(".other-feedback input");
    if (!input) return;
    event.preventDefault();
    input.closest(".other-feedback")?.querySelector("[data-feedback-action='submit-other']")?.click();
  }

  function render() {
    renderConnection();
    renderManualInfo();
    renderAttention();
    renderAnswerPatterns();
    renderDashboardMatches();
    renderRecent();
    renderPeople();
  }

  applySeedData();
  el.manualInfoToggle?.addEventListener("click", () => {
    state.manualInfoOpen = !state.manualInfoOpen;
    renderManualInfo();
  });
  el.manualInfoSave?.addEventListener("click", saveManualInfo);
  el.attentionList?.addEventListener("click", handleFeedbackClick);
  el.attentionList?.addEventListener("keydown", handleFeedbackKeydown);
  el.recentMessages?.addEventListener("click", handleFeedbackClick);
  el.recentMessages?.addEventListener("keydown", handleFeedbackKeydown);
  connectFirestore();
  flushFeedbackQueue();
  setInterval(flushFeedbackQueue, 10000);
  render();
})();
