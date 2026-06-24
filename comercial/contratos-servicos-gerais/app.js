const COLLECTION_NAME = "commercial_general_service_contracts";
const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
const WHATSAPP_MESSAGE = "Segue o contrato de serviços gerais TKA em PDF.";
const CONTRACT_TITLE = "Contrato de Prestacao de Servicos Gerais";
const PAGE = {
  width: 595.28,
  height: 841.89,
  top: 118,
  left: 42,
  right: 42,
  bottom: 740
};
const TKA_PROFILE = {
  legalName: "TKA ZELADORIA PATRIMONIAL E SERVICOS LTDA.",
  cnpj: "43.068.242/0001-20",
  address: "Avenida Alfredo Ignacio Nogueira Penido",
  number: "300",
  district: "Parque Residencial Aquarius",
  city: "Sao Jose dos Campos",
  state: "SP",
  representativeName: "KÁTIO AUGUSTO MACHADO DA SILVA",
  representativeRg: "32.176.952-1 SSP/SP",
  representativeCpf: "286.800.648-58"
};
const DEFAULT_EQUIPMENT = [];
const LEGAL_EDITOR_EMAILS = new Set([
  "comercial@grupotka.com.br",
  "comercial@grupotka",
  "adminteste@grupotka.com.br",
  "adminteste"
]);
const LEGACY_TEXT_REPLACEMENTS = [
  [/Condom\?nio/g, "Condomínio"],
  [/Ara\?jo/g, "Araújo"],
  [/Taubat\?/g, "Taubaté"],
  [/S\?ndico/g, "Síndico"],
  [/S\?ndica/g, "Síndica"],
  [/Jos\?/g, "José"]
];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEquipment(overrides = {}) {
  return {
    id: uid("equipment"),
    quantity: "",
    description: "",
    location: "",
    value: "",
    ...overrides
  };
}

function defaultEquipmentList() {
  return DEFAULT_EQUIPMENT.map((item) => createEquipment(item));
}

function defaultState() {
  return {
    contract: {
      contractCode: "",
      publicLink: "",
      issueCity: "Sao Jose dos Campos",
      issueDate: "",
      startDate: "",
      endDate: "",
      durationMonths: "12"
    },
    contractor: {
      companyName: "",
      legalName: "",
      cnpj: "",
      im: "",
      ie: "",
      phone: "",
      email1: "",
      email2: "",
      address: "",
      number: "",
      complement: "",
      district: "",
      cep: "",
      city: "",
      state: "SP",
      representativeName: "",
      representativeRole: "",
      representativeCpf: "",
      representativeRg: ""
    },
    service: {
      monitoredLocationName: "",
      monitoredAddress: "",
      monitoredNumber: "",
      monitoredComplement: "",
      monitoredDistrict: "",
      monitoredCep: "",
      monitoredCity: "",
      monitoredState: "SP",
      monitoredReference: "",
      communicationMethod: ""
    },
    pricing: {
      monitoringMonthly: "",
      equipmentRentalMonthly: "",
      installationTotal: "",
      installationInstallments: "",
      dueDay: "",
      paymentMethod: ""
    },
    equipment: defaultEquipmentList(),
    sign: {
      city: "",
      date: "",
      signerName: "",
      birthDate: "",
      cpf: "",
      signerTitle: "CONTRATANTE",
      witnessOneName: "",
      witnessOneDocument: "",
      witnessTwoName: "",
      witnessTwoDocument: "",
      signatureDataUrl: ""
    },
    legalOverrides: {},
    legalDocument: null,
    meta: {}
  };
}

const state = normalizeSnapshotText(defaultState());
const elements = {
  saveStatus: document.getElementById("saveStatus"),
  exportStatus: document.getElementById("exportStatus"),
  equipmentList: document.getElementById("equipmentList"),
  equipmentTemplate: document.getElementById("equipmentTemplate"),
  equipmentCount: document.getElementById("equipmentCount"),
  addEquipment: document.getElementById("addEquipment"),
  saveContractTop: document.getElementById("saveContractTop"),
  saveContractBottom: document.getElementById("saveContractBottom"),
  savePdfTop: document.getElementById("savePdfTop"),
  savePdfBottom: document.getElementById("savePdfBottom"),
  sharePdfTop: document.getElementById("sharePdfTop"),
  sharePdfBottom: document.getElementById("sharePdfBottom"),
  publicLinkTop: document.getElementById("publicLinkTop"),
  publicLinkBottom: document.getElementById("publicLinkBottom"),
  contractPreviewHelper: document.getElementById("contractPreviewHelper"),
  legalTextReset: document.getElementById("legalTextReset"),
  contractPreview: document.getElementById("contractPreview"),
  clearSignature: document.getElementById("clearSignature"),
  signatureCanvas: document.getElementById("signatureCanvas"),
  ownerSignaturePreview: document.getElementById("ownerSignaturePreview"),
  ownerSignatureEmpty: document.getElementById("ownerSignatureEmpty"),
  ownerSignatureMeta: document.getElementById("ownerSignatureMeta"),
  signatureEraser: document.getElementById("signatureEraser"),
  undoSignature: document.getElementById("undoSignature")
};

let firebaseDb = null;
let cloudSaveTimer = null;
let cloudSavePromise = Promise.resolve(true);
let lastCloudSnapshot = "";
let ultimoPdfBlob = null;
let ultimoPdfNome = "";
let drawing = false;
let lastPoint = null;
let signatureDirty = false;
let pdfAssetsPromise = null;
let ownerSignatureDataUrl = "";
let signatureMode = "draw";
const signatureUndoStack = [];

const pdfAssets = {
  logoDataUrl: "",
  letterheadDataUrl: ""
};

const signature = {
  ctx: elements.signatureCanvas.getContext("2d"),
  scale: 1,
  width: 0,
  height: 0
};

function readPortalUser() {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hasCommercialAccess() {
  const user = readPortalUser();
  return Boolean(user && (user.permissions?.estrutural || user.permissions?.admin));
}

function canEditLegalText() {
  const user = readPortalUser();
  return Boolean(user && hasCommercialAccess() && LEGAL_EDITOR_EMAILS.has(normalizeEmail(user.email)));
}

function canManageLegalStructure() {
  return canEditLegalText() && !isPublicClientAccess();
}

function isPublicClientAccess() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("id")) return false;
  if (params.get("public") === "1") return true;
  return !hasCommercialAccess();
}

function applyAccessGuard() {
  if (hasCommercialAccess()) return true;
  if (isPublicClientAccess()) return true;
  document.body.innerHTML = `
    <main class="access-shell">
      <p class="eyebrow">Grupo TKA</p>
      <h1>Acesso restrito</h1>
      <p>Este módulo faz parte do Comercial. Entre pelo portal com um usuário que tenha a permissão Comercial liberada para abrir ou editar contratos.</p>
    </main>
  `;
  return false;
}

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => (value == null ? "" : value[key]), source);
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  let pointer = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!pointer[key] || typeof pointer[key] !== "object") pointer[key] = {};
    pointer = pointer[key];
  }
  pointer[keys[keys.length - 1]] = value;
}

function decodeMojibake(value) {
  try {
    const bytes = Uint8Array.from(String(value || ""), (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return String(value || "");
  }
}

function normalizeVisibleText(value) {
  const source = String(value || "");
  if (!source || source.startsWith("data:")) return source;
  let normalized = source;
  if (/[ÃÂâ€]/.test(normalized)) {
    const decoded = decodeMojibake(normalized);
    if (decoded) normalized = decoded;
  }
  LEGACY_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });
  return normalized.normalize("NFC");
}

function normalizeSnapshotText(value) {
  if (typeof value === "string") return normalizeVisibleText(value);
  if (Array.isArray(value)) return value.map((item) => normalizeSnapshotText(item));
  if (value && typeof value === "object") {
    const normalized = {};
    Object.entries(value).forEach(([key, item]) => {
      normalized[key] = normalizeSnapshotText(item);
    });
    return normalized;
  }
  return value;
}

function text(value) {
  return normalizeVisibleText(value).trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  const textValue = text(value);
  if (!textValue) return "";
  const parsed = new Date(`${textValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return textValue;
  return parsed.toLocaleDateString("pt-BR");
}

function formatLongDate(value) {
  const textValue = text(value);
  if (!textValue) return "____ de __________ de ______";
  const parsed = new Date(`${textValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return textValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(parsed);
}

function formatMoney(value) {
  const raw = text(value);
  if (!raw) return "R$ 0,00";
  return raw.startsWith("R$") ? raw : `R$ ${raw}`;
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sanitizeFilename(value) {
  return (value || "contrato-comercial-tka")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "contrato-comercial-tka";
}

function addressLine(entity) {
  const base = [
    text(entity.address),
    text(entity.number),
    text(entity.complement)
  ].filter(Boolean).join(", ");
  const district = text(entity.district);
  const cep = text(entity.cep);
  const cityState = [text(entity.city), text(entity.state)].filter(Boolean).join(" / ");
  return [base, district, cep, cityState].filter(Boolean).join(" - ");
}

function monitoredLocationLine() {
  return addressLine({
    address: state.service.monitoredAddress,
    number: state.service.monitoredNumber,
    complement: state.service.monitoredComplement,
    district: state.service.monitoredDistrict,
    cep: state.service.monitoredCep,
    city: state.service.monitoredCity,
    state: state.service.monitoredState
  });
}

function contractorName() {
  return text(state.contractor.legalName || state.contractor.companyName) || "CONTRATANTE";
}

function representativeName() {
  return text(state.contractor.representativeName) || "representante legal não informado";
}

function contractPeriodLine() {
  const start = formatDate(state.contract.startDate);
  const end = formatDate(state.contract.endDate);
  if (start && end) return `${start} até ${end}`;
  return [start, end].filter(Boolean).join(" até ") || "Prazo contratual não informado";
}

function hasByPath(source, path) {
  let pointer = source;
  for (const key of path.split(".")) {
    if (pointer == null || !(key in pointer)) return false;
    pointer = pointer[key];
  }
  return true;
}

function normalizeLegalText(value) {
  return normalizeVisibleText(value).replace(/\s+/g, " ").trim();
}

function setPreviewHelperText() {
  document.body.classList.toggle("public-client-mode", isPublicClientAccess());
  if (elements.contractPreviewHelper) elements.contractPreviewHelper.textContent = "";
  if (elements.legalTextReset) elements.legalTextReset.hidden = true;
}

function renderLegalField(tagName, value, path, options = {}) {
  const editable = canManageLegalStructure();
  const attrs = [];
  if (editable) {
    attrs.push('class="legal-editable"');
    attrs.push('contenteditable="true"');
    attrs.push('spellcheck="true"');
    attrs.push(`data-legal-path="${escapeHtml(path)}"`);
    if (options.placeholder) attrs.push(`data-placeholder="${escapeHtml(options.placeholder)}"`);
  }
  const content = escapeHtml(value || "");
  return `<${tagName}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${content}</${tagName}>`;
}

function renderPreviewAction(label, action, attrs = {}) {
  if (!canManageLegalStructure()) return "";
  const attributeString = Object.entries(attrs)
    .map(([name, value]) => ` data-${name}="${escapeHtml(value)}"`)
    .join("");
  return `<button class="preview-mini-button" type="button" data-admin-only data-legal-action="${escapeHtml(action)}"${attributeString}>${escapeHtml(label)}</button>`;
}

function renderPreviewActions(actions) {
  const buttons = actions.filter(Boolean).join("");
  return buttons ? `<div class="preview-actions" data-admin-only>${buttons}</div>` : "";
}

function createStructuredLegalContent(content) {
  return {
    title: normalizeLegalText(content.title),
    intro: Array.isArray(content.intro) ? content.intro.map((item) => normalizeLegalText(item)) : [],
    definitions: Array.isArray(content.definitions)
      ? content.definitions.map((item) => ({
        label: normalizeLegalText(item?.label),
        text: normalizeLegalText(item?.text)
      }))
      : [],
    clauses: Array.isArray(content.clauses)
      ? content.clauses.map((item) => ({
        title: normalizeLegalText(item?.title),
        paragraphs: Array.isArray(item?.paragraphs)
          ? item.paragraphs.map((paragraph) => normalizeLegalText(paragraph))
          : []
      }))
      : []
  };
}

function ensureLegalDocument() {
  if (state.legalDocument && typeof state.legalDocument === "object") {
    return state.legalDocument;
  }
  state.legalDocument = createStructuredLegalContent(buildContractContent());
  return state.legalDocument;
}

function mergeLoadedState(loaded) {
  const normalizedLoaded = normalizeSnapshotText(loaded || {});
  const fresh = defaultState();
  const merged = {
    ...fresh,
    ...normalizedLoaded,
    contract: { ...fresh.contract, ...(normalizedLoaded.contract || {}) },
    contractor: { ...fresh.contractor, ...(normalizedLoaded.contractor || {}) },
    service: { ...fresh.service, ...(normalizedLoaded.service || {}) },
    pricing: { ...fresh.pricing, ...(normalizedLoaded.pricing || {}) },
    sign: { ...fresh.sign, ...(normalizedLoaded.sign || {}) },
    legalOverrides: { ...fresh.legalOverrides, ...(normalizedLoaded.legalOverrides || {}) },
    legalDocument: normalizedLoaded.legalDocument ? createStructuredLegalContent(normalizedLoaded.legalDocument) : null,
    meta: { ...fresh.meta, ...(normalizedLoaded.meta || {}) }
  };
  merged.equipment = Array.isArray(normalizedLoaded.equipment)
    ? normalizedLoaded.equipment.map((item) => createEquipment(item))
    : defaultEquipmentList();
  Object.assign(state, clone(merged));
}

function populateStaticFields() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    const value = getByPath(state, input.dataset.path);
    input.value = value == null ? "" : value;
  });
}

function syncStaticFields() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    setByPath(state, input.dataset.path, normalizeVisibleText(input.value));
  });
}

function equipmentFilled(item) {
  return Boolean(text(item.quantity) || text(item.description) || text(item.location) || text(item.value));
}

function renderEquipment() {
  elements.equipmentList.innerHTML = "";
  state.equipment.forEach((item) => {
    const card = elements.equipmentTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.querySelectorAll("[data-field]").forEach((field) => {
      field.value = item[field.dataset.field] || "";
    });
    card.querySelector("[data-remove]").dataset.id = item.id;
    elements.equipmentList.appendChild(card);
  });
  const filled = state.equipment.filter(equipmentFilled).length || state.equipment.length;
  elements.equipmentCount.textContent = countLabel(filled, "posto", "postos");
}

function equipmentRows() {
  return state.equipment.filter(equipmentFilled);
}

function buildDefaultContractContent() {
  const contractorAddress = addressLine(state.contractor);
  const serviceAddress = monitoredLocationLine();
  const serviceName = text(state.service.monitoredLocationName || state.service.monitoredReference) || "LOCAL DA PRESTACAO";
  const contractorDocument = text(state.contractor.cnpj) || "CNPJ nao informado";
  const representativeCpf = text(state.contractor.representativeCpf) || "CPF nao informado";
  const representativeRg = text(state.contractor.representativeRg) || "RG nao informado";
  const dueDay = text(state.pricing.dueDay) ? `no dia ${text(state.pricing.dueDay)}` : "na data acordada entre as partes";
  const monthlyValue = text(state.pricing.monitoringMonthly) ? formatMoney(state.pricing.monitoringMonthly) : "valor mensal definido em proposta";
  const extraHourValue = text(state.pricing.equipmentRentalMonthly) ? formatMoney(state.pricing.equipmentRentalMonthly) : "valor definido em proposta";
  const minimumExtra = text(state.pricing.installationTotal) || "carga minima definida em proposta";
  const reajust = text(state.pricing.installationInstallments) || "a cada 12 meses ou conforme convencao coletiva aplicavel";
  const paymentMethod = text(state.pricing.paymentMethod) || "boleto bancario, transferencia ou outro meio acordado";
  const posts = equipmentRows();

  return {
    title: CONTRACT_TITLE,
    intro: [
      `${TKA_PROFILE.legalName}, com sede na ${TKA_PROFILE.address}, nº ${TKA_PROFILE.number}, ${TKA_PROFILE.district} - ${TKA_PROFILE.city}/${TKA_PROFILE.state}, inscrita no CNPJ sob o nº ${TKA_PROFILE.cnpj}, neste ato representada por ${TKA_PROFILE.representativeName}, portador do RG nº ${TKA_PROFILE.representativeRg} e inscrito no CPF/MF nº ${TKA_PROFILE.representativeCpf}, doravante denominada simplesmente CONTRATADA;`,
      `${contractorName()}, com sede em ${contractorAddress || "endereco nao informado"}, inscrita no CNPJ sob o nº ${contractorDocument}, neste ato representada por ${representativeName()}, ${text(state.contractor.representativeRole) || "representante legal"}, portador do RG nº ${representativeRg} e inscrito no CPF/MF nº ${representativeCpf}, doravante denominada simplesmente CONTRATANTE.`,
      "As partes resolvem celebrar contrato de prestacao de servicos gerais, portaria, controle de acesso, zeladoria e atividades operacionais correlatas, mediante as clausulas e condicoes abaixo."
    ],
    definitions: [
      {
        label: "SERVICOS GERAIS",
        text: "Atividades de apoio operacional, portaria, controle de acesso, ronda, limpeza, conservacao, manutencao simples e outras funcoes expressamente descritas nos postos contratados."
      },
      {
        label: "LOCAL DA PRESTACAO",
        text: `${serviceName}, localizado em ${serviceAddress || "endereco nao informado"}.`
      },
      {
        label: "POSTOS DE TRABALHO",
        text: "Quantidade de profissionais, funcoes, escalas e horarios indicados no Anexo I deste contrato."
      }
    ],
    clauses: [
      {
        title: "Clausula Primeira - Servicos Contratados",
        paragraphs: [
          `1.1. A CONTRATADA obriga-se a prestar a CONTRATANTE os servicos de ${text(state.service.communicationMethod) || "portaria, controle de acesso, zeladoria e servicos gerais"}, por meio do fornecimento de mao de obra qualificada para o local contratado.`,
          "1.2. Antes do inicio dos trabalhos, quando solicitado, a CONTRATADA apresentara documentos comprobatórios da relacao contratual com os colaboradores alocados, incluindo registros, exames admissionais, fichas cadastrais, treinamentos e apolices aplicaveis.",
          "1.3. Servicos adicionais nao descritos neste instrumento deverao ser previamente aprovados por escrito e poderao ser objeto de aditivo contratual."
        ]
      },
      {
        title: "Clausula Segunda - Local, Postos e Jornada",
        paragraphs: [
          `2.1. Os servicos serao executados no local ${serviceName}, situado em ${serviceAddress || "endereco nao informado"}, conforme os postos, funcoes e horarios descritos no Anexo I.`,
          `2.2. Horas excedentes solicitadas pela CONTRATANTE serao cobradas pelo valor de ${extraHourValue} por hora, observada ${minimumExtra}.`,
          "2.3. Alteracoes de quantidade de postos, horarios, escala, local ou escopo deverao ser formalizadas por aditivo."
        ]
      },
      {
        title: "Clausula Terceira - Preco, Pagamento e Reajuste",
        paragraphs: [
          `3.1. Pela prestacao dos servicos, a CONTRATANTE pagara a CONTRATADA o valor mensal de ${monthlyValue}, com vencimento ${dueDay}.`,
          `3.2. O pagamento sera realizado por ${paymentMethod}, juntamente com os documentos fiscais aplicaveis.`,
          `3.3. O valor sera reajustado ${reajust}, considerando variacoes legais, convencao coletiva, encargos trabalhistas e demais custos incidentes sobre a prestacao dos servicos.`
        ]
      },
      {
        title: "Clausula Quarta - Responsabilidades da Contratada",
        paragraphs: [
          "4.1. A CONTRATADA responsabiliza-se pela administracao, supervisao, substituicao e orientacao dos colaboradores alocados.",
          "4.2. A CONTRATADA arcara com salarios, encargos sociais, previdenciarios, trabalhistas, fiscais e demais obrigacoes relacionadas aos seus empregados.",
          "4.3. A CONTRATADA devera manter equipe compatível com a funcao contratada, observando boas praticas de apresentacao, postura, registro de ocorrencias e atendimento ao publico."
        ]
      },
      {
        title: "Clausula Quinta - Responsabilidades da Contratante",
        paragraphs: [
          "5.1. A CONTRATANTE devera fornecer condicoes adequadas para execucao dos servicos, incluindo acesso ao local, normas internas, orientacoes operacionais e infraestrutura minima.",
          "5.2. A CONTRATANTE comunicara formalmente qualquer necessidade de reforco, alteracao de escala, substituicao, advertencia operacional ou servico extraordinario.",
          "5.3. E vedada a subordinacao direta dos empregados da CONTRATADA pela CONTRATANTE, preservando-se a natureza civil e empresarial deste contrato."
        ]
      },
      {
        title: "Clausula Sexta - Vigencia e Rescisao",
        paragraphs: [
          `6.1. O contrato vigorara por ${text(state.contract.durationMonths) || "12"} meses, com inicio em ${formatDate(state.contract.startDate) || "data a definir"} e termino em ${formatDate(state.contract.endDate) || "data a definir"}.`,
          "6.2. O contrato podera ser rescindido mediante aviso previo de 30 dias, sem prejuizo da cobranca de valores vencidos, servicos extraordinarios e eventuais multas pactuadas.",
          "6.3. Inadimplencia, descumprimento contratual relevante ou impedimento operacional podera autorizar a suspensao dos servicos e/ou rescisao motivada."
        ]
      },
      {
        title: "Clausula Setima - Disposicoes Gerais",
        paragraphs: [
          "7.1. Qualquer alteracao deste contrato somente tera validade se formalizada por escrito.",
          "7.2. As partes elegem o foro da comarca indicada na emissao do contrato para dirimir controversias oriundas deste instrumento.",
          `7.3. Fica eleito o Foro da Comarca de ${text(state.contract.issueCity) || TKA_PROFILE.city}, Estado de Sao Paulo, com renuncia a qualquer outro por mais privilegiado que seja.`
        ]
      }
    ],
    equipment: posts,
    issueLine: `${text(state.contract.issueCity || state.sign.city || TKA_PROFILE.city)}, ${formatLongDate(state.contract.issueDate || state.sign.date)}`
  };
}

function buildContractContent() {
  const content = clone(buildDefaultContractContent());
  if (state.legalDocument && typeof state.legalDocument === "object") {
    const structured = createStructuredLegalContent(state.legalDocument);
    content.title = structured.title;
    content.intro = structured.intro;
    content.definitions = structured.definitions;
    content.clauses = structured.clauses;
    return normalizeSnapshotText(content);
  }
  Object.entries(state.legalOverrides || {}).forEach(([path, value]) => {
    if (!hasByPath(content, path)) return;
    setByPath(content, path, value);
  });
  return normalizeSnapshotText(content);
}

function updateLegalText(path, value) {
  const document = ensureLegalDocument();
  setByPath(document, path, normalizeLegalText(value));
}

function buildClauseBlock() {
  return { title: "", paragraphs: [""] };
}

function buildDefinitionBlock() {
  return { label: "", text: "" };
}

function handleLegalStructureAction(button) {
  if (!canManageLegalStructure()) return;
  const action = button.dataset.legalAction;
  if (!action) return;

  if (action === "reset-legal-model") {
    state.legalDocument = null;
    state.legalOverrides = {};
    renderPreview();
    queueSave("Modelo contratual em atualização...");
    return;
  }

  const document = ensureLegalDocument();
  const introIndex = Number.parseInt(button.dataset.introIndex || "", 10);
  const definitionIndex = Number.parseInt(button.dataset.definitionIndex || "", 10);
  const clauseIndex = Number.parseInt(button.dataset.clauseIndex || "", 10);
  const paragraphIndex = Number.parseInt(button.dataset.paragraphIndex || "", 10);

  switch (action) {
    case "append-intro":
      document.intro.push("");
      break;
    case "add-intro-after":
      if (Number.isFinite(introIndex)) document.intro.splice(introIndex + 1, 0, "");
      break;
    case "remove-intro":
      if (Number.isFinite(introIndex)) document.intro.splice(introIndex, 1);
      break;
    case "append-definition":
      document.definitions.push(buildDefinitionBlock());
      break;
    case "add-definition-after":
      if (Number.isFinite(definitionIndex)) document.definitions.splice(definitionIndex + 1, 0, buildDefinitionBlock());
      break;
    case "remove-definition":
      if (Number.isFinite(definitionIndex)) document.definitions.splice(definitionIndex, 1);
      break;
    case "append-clause":
      document.clauses.push(buildClauseBlock());
      break;
    case "add-clause-after":
      if (Number.isFinite(clauseIndex)) document.clauses.splice(clauseIndex + 1, 0, buildClauseBlock());
      break;
    case "remove-clause":
      if (Number.isFinite(clauseIndex)) document.clauses.splice(clauseIndex, 1);
      break;
    case "append-clause-paragraph":
      if (Number.isFinite(clauseIndex) && document.clauses[clauseIndex]) {
        document.clauses[clauseIndex].paragraphs.push("");
      }
      break;
    case "add-clause-paragraph-after":
      if (Number.isFinite(clauseIndex) && Number.isFinite(paragraphIndex) && document.clauses[clauseIndex]) {
        document.clauses[clauseIndex].paragraphs.splice(paragraphIndex + 1, 0, "");
      }
      break;
    case "remove-clause-paragraph":
      if (Number.isFinite(clauseIndex) && Number.isFinite(paragraphIndex) && document.clauses[clauseIndex]) {
        document.clauses[clauseIndex].paragraphs.splice(paragraphIndex, 1);
      }
      break;
    default:
      return;
  }

  renderPreview();
  queueSave("Estrutura contratual em atualização...");
}

function renderSignaturePreviewItem(label, signerName, dataUrl, missingText) {
  const signatureUrl = text(dataUrl);
  return `
    <div class="definition-item signature-preview-item">
      <strong>${escapeHtml(label)}</strong>
      ${signatureUrl ? `
        <div class="signature-preview-box">
          <img src="${escapeHtml(signatureUrl)}" alt="${escapeHtml(label)}" />
        </div>
        <p>${escapeHtml(signerName || "")}</p>
      ` : `<p>${escapeHtml(missingText)}</p>`}
    </div>
  `;
}

function renderPreview() {
  const content = buildContractContent();
  setPreviewHelperText();
  let html = canManageLegalStructure() ? `
    <div class="preview-toolbar" data-admin-only>
      ${renderPreviewAction("Adicionar parágrafo introdutório", "append-intro")}
      ${renderPreviewAction("Adicionar definição", "append-definition")}
      ${renderPreviewAction("Adicionar cláusula", "append-clause")}
      ${renderPreviewAction("Restaurar modelo", "reset-legal-model")}
    </div>
  ` : "";

  html += `
    <article class="preview-card">
      ${renderLegalField("h3", content.title, "title", { placeholder: "Título do contrato" })}
      <div class="paragraphs">
        ${content.intro.map((paragraph, index) => `
          <div class="preview-edit-row">
            ${renderLegalField("p", paragraph, `intro.${index}`, { placeholder: "Digite o parágrafo introdutório." })}
            ${renderPreviewActions([
              renderPreviewAction("Adicionar abaixo", "add-intro-after", { "intro-index": String(index) }),
              renderPreviewAction("Excluir", "remove-intro", { "intro-index": String(index) })
            ])}
          </div>
        `).join("")}
      </div>
      ${renderPreviewActions([renderPreviewAction("Adicionar parágrafo introdutório", "append-intro")])}
    </article>
    <article class="preview-card">
      <h3>Definições</h3>
      <div class="definition-list">
        ${content.definitions.map((item, index) => `
          <div class="definition-item">
            ${renderLegalField("strong", item.label, `definitions.${index}.label`, { placeholder: "Termo" })}
            ${renderLegalField("p", item.text, `definitions.${index}.text`, { placeholder: "Digite a definição." })}
            ${renderPreviewActions([
              renderPreviewAction("Adicionar abaixo", "add-definition-after", { "definition-index": String(index) }),
              renderPreviewAction("Excluir", "remove-definition", { "definition-index": String(index) })
            ])}
          </div>
        `).join("")}
      </div>
      ${renderPreviewActions([renderPreviewAction("Adicionar definição", "append-definition")])}
    </article>
  `;

  content.clauses.forEach((clause, clauseIndex) => {
    html += `
      <article class="preview-card">
        ${renderLegalField("h3", clause.title, `clauses.${clauseIndex}.title`, { placeholder: "Título da cláusula" })}
        <div class="paragraphs">
          ${clause.paragraphs.map((paragraph, paragraphIndex) => `
            <div class="preview-edit-row">
              ${renderLegalField("p", paragraph, `clauses.${clauseIndex}.paragraphs.${paragraphIndex}`, { placeholder: "Digite o texto da cláusula." })}
              ${renderPreviewActions([
                renderPreviewAction("Adicionar abaixo", "add-clause-paragraph-after", {
                  "clause-index": String(clauseIndex),
                  "paragraph-index": String(paragraphIndex)
                }),
                renderPreviewAction("Excluir", "remove-clause-paragraph", {
                  "clause-index": String(clauseIndex),
                  "paragraph-index": String(paragraphIndex)
                })
              ])}
            </div>
          `).join("")}
        </div>
        ${renderPreviewActions([
          renderPreviewAction("Adicionar parágrafo", "append-clause-paragraph", { "clause-index": String(clauseIndex) }),
          renderPreviewAction("Adicionar cláusula abaixo", "add-clause-after", { "clause-index": String(clauseIndex) }),
          renderPreviewAction("Excluir cláusula", "remove-clause", { "clause-index": String(clauseIndex) })
        ])}
      </article>
    `;
  });

  if (content.equipment.length) {
    html += `
      <article class="preview-card">
        <h3>Anexo I - Postos, Funcoes e Escalas</h3>
        <table class="annex-table">
          <thead>
            <tr>
              <th>QTD</th>
              <th>Funcao / Servico</th>
              <th>Escala / Horario</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${content.equipment.map((item) => `
              <tr>
                <td>${escapeHtml(item.quantity)}</td>
                <td>${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.location)}</td>
                <td>${escapeHtml(formatMoney(item.value))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    `;
  }

  html += `
    <article class="preview-card">
      <h3>Assinaturas</h3>
      <div class="definition-list">
        ${renderSignaturePreviewItem("Contratada", TKA_PROFILE.representativeName, ownerSignatureDataUrl, "Assinatura da Contratada pendente no Admin.")}
        ${renderSignaturePreviewItem("Contratante", state.sign.signerName || representativeName(), state.sign.signatureDataUrl, "Aguardando assinatura desenhada do contratante.")}
      </div>
    </article>
  `;

  elements.contractPreview.innerHTML = html;
}

function initializeFirebase() {
  const config = window.TKA_FIREBASE_CONFIG || window.RH_FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId) return;
  if (!firebase.apps.length) firebase.initializeApp(config);
  firebaseDb = firebase.firestore();
}

async function loadOwnerSignature() {
  if (!firebaseDb) return;
  const snapshot = await firebaseDb.collection("system").doc("ownerSignature").get();
  const data = snapshot.data() || {};
  ownerSignatureDataUrl = text(data.signatureDataUrl);
}

function renderOwnerSignaturePreview() {
  const dataUrl = text(ownerSignatureDataUrl);
  if (elements.ownerSignaturePreview) {
    elements.ownerSignaturePreview.classList.toggle("hidden", !dataUrl);
    if (dataUrl) {
      elements.ownerSignaturePreview.src = dataUrl;
    } else {
      elements.ownerSignaturePreview.removeAttribute("src");
    }
  }
  if (elements.ownerSignatureEmpty) {
    elements.ownerSignatureEmpty.classList.toggle("hidden", Boolean(dataUrl));
    elements.ownerSignatureEmpty.textContent = "Assinatura da Contratada pendente no Admin.";
  }
  if (elements.ownerSignatureMeta) {
    elements.ownerSignatureMeta.textContent = dataUrl
      ? TKA_PROFILE.representativeName
      : "Cadastre a assinatura no Admin antes do PDF final.";
  }
}

function sanitizeRecordForCloud() {
  syncStaticFields();
  if (!state.meta) state.meta = {};
  return {
    contractId: state.meta.contractId || "",
    source: "general-service-contract-editor",
    createdAt: state.meta.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: clone(state)
  };
}

function buildCloudSnapshot(record) {
  const snapshot = clone(record.data || {});
  if (snapshot.meta) {
    snapshot.meta.createdAt = "";
    snapshot.meta.updatedAt = "";
  }
  return JSON.stringify(snapshot);
}

async function loadContractFromCloud() {
  if (!firebaseDb) return false;
  const params = new URLSearchParams(window.location.search);
  const contractId = params.get("id");
  if (!contractId) return false;
  const doc = await firebaseDb.collection(COLLECTION_NAME).doc(contractId).get();
  if (!doc.exists) return false;
  const payload = doc.data() || {};
  mergeLoadedState(payload.data || {});
  state.meta = {
    ...(state.meta || {}),
    contractId: doc.id,
    createdAt: payload.createdAt || "",
    updatedAt: payload.updatedAt || ""
  };
  lastCloudSnapshot = buildCloudSnapshot({ data: clone(state) });
  renderAll();
  return true;
}

function updateSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function validateContractReadiness() {
  syncStaticFields();
  if (!text(state.contractor.legalName || state.contractor.companyName)) {
    elements.exportStatus.textContent = "Preencha a empresa contratante antes de gerar o PDF.";
    return false;
  }
  if (!text(state.service.monitoredLocationName || state.service.monitoredAddress)) {
    elements.exportStatus.textContent = "Preencha o local da prestacao antes de gerar o PDF.";
    return false;
  }
  if (!text(ownerSignatureDataUrl)) {
    elements.exportStatus.textContent = "Cadastre a Assinatura da Contratada no Admin antes de gerar o PDF final.";
    return false;
  }
  if (!text(state.sign.signatureDataUrl)) {
    elements.exportStatus.textContent = "Colete a assinatura do contratante pelo link publico antes de gerar o PDF final.";
    return false;
  }
  return true;
}

async function persistContractToCloud(options = {}) {
  const { manual = false, force = false } = options;
  if (!firebaseDb) {
    if (manual) elements.exportStatus.textContent = "Base de dados indisponível no momento.";
    return false;
  }
  const docRef = state.meta.contractId
    ? firebaseDb.collection(COLLECTION_NAME).doc(state.meta.contractId)
    : firebaseDb.collection(COLLECTION_NAME).doc();

  state.meta.contractId = docRef.id;
  state.meta.createdAt = state.meta.createdAt || new Date().toISOString();
  state.meta.updatedAt = new Date().toISOString();

  const record = sanitizeRecordForCloud();
  record.contractId = docRef.id;
  record.data.meta = {
    ...(record.data.meta || {}),
    contractId: docRef.id,
    createdAt: state.meta.createdAt,
    updatedAt: state.meta.updatedAt
  };

  const snapshot = buildCloudSnapshot(record);
  if (!force && snapshot === lastCloudSnapshot) {
    if (manual) {
      updateSaveStatus(`Contrato sincronizado em ${new Date().toLocaleTimeString("pt-BR")}`);
      elements.exportStatus.textContent = `Contrato comercial vinculado. ID: ${docRef.id}`;
    }
    return true;
  }

  await docRef.set(record, { merge: true });
  lastCloudSnapshot = snapshot;

  const url = new URL(window.location.href);
  url.searchParams.set("id", docRef.id);
  window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);

  updateSaveStatus(`${manual ? "Contrato salvo" : "Sincronizado"} em ${new Date().toLocaleTimeString("pt-BR")}`);
  if (manual) elements.exportStatus.textContent = `Contrato comercial vinculado. ID: ${docRef.id}`;
  return true;
}

function scheduleCloudSave() {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    cloudSavePromise = persistContractToCloud().catch(() => false);
  }, 900);
}

function queueSave(message = "Alterações pendentes...") {
  updateSaveStatus(message);
  scheduleCloudSave();
}

async function flushCloudSave(options = {}) {
  clearTimeout(cloudSaveTimer);
  await cloudSavePromise.catch(() => false);
  cloudSavePromise = persistContractToCloud({ ...options, force: true }).catch(() => false);
  return cloudSavePromise;
}

function clearCanvasSurface() {
  signature.ctx.setTransform(signature.scale, 0, 0, signature.scale, 0, 0);
  signature.ctx.clearRect(0, 0, signature.width, signature.height);
  signature.ctx.fillStyle = "#fffdfb";
  signature.ctx.fillRect(0, 0, signature.width, signature.height);
  signature.ctx.setLineDash([10, 8]);
  signature.ctx.strokeStyle = "rgba(179, 37, 31, 0.25)";
  signature.ctx.lineWidth = 1;
  signature.ctx.beginPath();
  signature.ctx.moveTo(30, signature.height - 42);
  signature.ctx.lineTo(signature.width - 30, signature.height - 42);
  signature.ctx.stroke();
  signature.ctx.setLineDash([]);
}

function resizeSignatureCanvas() {
  const rect = elements.signatureCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  if (!rect.width || !rect.height) return;
  signature.scale = ratio;
  signature.width = rect.width;
  signature.height = rect.height;
  elements.signatureCanvas.width = Math.round(rect.width * ratio);
  elements.signatureCanvas.height = Math.round(rect.height * ratio);
  clearCanvasSurface();
}

function redrawStoredSignature() {
  clearCanvasSurface();
  if (!state.sign.signatureDataUrl) return;
  const image = new Image();
  image.onload = () => {
    signature.ctx.drawImage(image, 0, 0, signature.width, signature.height);
  };
  image.src = state.sign.signatureDataUrl;
}

function storeSignature() {
  state.sign.signatureDataUrl = elements.signatureCanvas.toDataURL("image/png");
  updateSignatureControls();
  queueSave("Salvando assinatura...");
}

function pointFromEvent(event) {
  const rect = elements.signatureCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function updateSignatureControls() {
  if (elements.signatureEraser) {
    elements.signatureEraser.setAttribute("aria-pressed", signatureMode === "erase" ? "true" : "false");
  }
  if (elements.undoSignature) {
    elements.undoSignature.disabled = !signatureUndoStack.length;
  }
}

function pushSignatureUndo() {
  signatureUndoStack.push(text(state.sign.signatureDataUrl) ? state.sign.signatureDataUrl : "");
  if (signatureUndoStack.length > 30) signatureUndoStack.shift();
  updateSignatureControls();
}

function setSignatureMode(mode) {
  signatureMode = mode === "erase" ? "erase" : "draw";
  updateSignatureControls();
}

function markSignatureDirty() {
  if (signatureDirty) return;
  pushSignatureUndo();
  signatureDirty = true;
}

function drawSignatureSegment(fromPoint, toPoint) {
  signature.ctx.save();
  signature.ctx.strokeStyle = signatureMode === "erase" ? "#fffdfb" : "#241614";
  signature.ctx.lineWidth = signatureMode === "erase" ? 18 : 2.2;
  signature.ctx.lineCap = "round";
  signature.ctx.lineJoin = "round";
  signature.ctx.beginPath();
  signature.ctx.moveTo(fromPoint.x, fromPoint.y);
  signature.ctx.lineTo(toPoint.x, toPoint.y);
  signature.ctx.stroke();
  if (signatureMode === "erase" && fromPoint.x === toPoint.x && fromPoint.y === toPoint.y) {
    signature.ctx.beginPath();
    signature.ctx.arc(fromPoint.x, fromPoint.y, 9, 0, Math.PI * 2);
    signature.ctx.fillStyle = "#fffdfb";
    signature.ctx.fill();
  }
  signature.ctx.restore();
}

function undoSignatureChange() {
  if (!signatureUndoStack.length) return;
  state.sign.signatureDataUrl = signatureUndoStack.pop() || "";
  redrawStoredSignature();
  updateSignatureControls();
  queueSave("Assinatura restaurada.");
}

function bindSignatureCanvas() {
  const canvas = elements.signatureCanvas;

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    signatureDirty = false;
    lastPoint = pointFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
    if (signatureMode === "erase") {
      event.preventDefault();
      markSignatureDirty();
      drawSignatureSegment(lastPoint, lastPoint);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || !lastPoint) return;
    event.preventDefault();
    const nextPoint = pointFromEvent(event);
    markSignatureDirty();
    drawSignatureSegment(lastPoint, nextPoint);
    lastPoint = nextPoint;
  });

  const finishDrawing = (event) => {
    if (event && event.pointerId != null && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (!drawing) return;
    drawing = false;
    lastPoint = null;
    if (signatureDirty) storeSignature();
    signatureDirty = false;
  };

  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointerleave", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);

  elements.clearSignature.addEventListener("click", () => {
    pushSignatureUndo();
    state.sign.signatureDataUrl = "";
    redrawStoredSignature();
    setSignatureMode("draw");
    queueSave("Assinatura removida.");
  });
  if (elements.signatureEraser) {
    elements.signatureEraser.addEventListener("click", () => {
      setSignatureMode(signatureMode === "erase" ? "draw" : "erase");
    });
  }
  if (elements.undoSignature) {
    elements.undoSignature.addEventListener("click", undoSignatureChange);
  }
  updateSignatureControls();
}

function bindStaticFields() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    const handler = () => {
      const normalizedValue = normalizeVisibleText(input.value);
      if (input.value !== normalizedValue) input.value = normalizedValue;
      setByPath(state, input.dataset.path, normalizedValue);
      renderPreview();
      queueSave();
    };
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  });
}

function insertPlainTextAtSelection(textValue) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  selection.deleteFromDocument();
  const node = document.createTextNode(textValue);
  const range = selection.getRangeAt(0);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function bindLegalTextEditor() {
  elements.contractPreview.addEventListener("click", (event) => {
    const button = event.target.closest("[data-legal-action]");
    if (!button) return;
    event.preventDefault();
    handleLegalStructureAction(button);
  });

  elements.contractPreview.addEventListener("keydown", (event) => {
    const field = event.target.closest("[data-legal-path]");
    if (!field) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(field);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    if (event.key === "Enter") event.preventDefault();
  });

  elements.contractPreview.addEventListener("paste", (event) => {
    const field = event.target.closest("[data-legal-path]");
    if (!field) return;
    event.preventDefault();
    insertPlainTextAtSelection(event.clipboardData?.getData("text/plain") || "");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });

  elements.contractPreview.addEventListener("input", (event) => {
    const field = event.target.closest("[data-legal-path]");
    if (!field) return;
    updateLegalText(field.dataset.legalPath, field.innerText);
    queueSave("Alterações contratuais pendentes...");
  });

  elements.contractPreview.addEventListener("focusout", (event) => {
    const field = event.target.closest("[data-legal-path]");
    if (!field) return;
    updateLegalText(field.dataset.legalPath, field.innerText);
    renderPreview();
  });
}

function addEquipment() {
  state.equipment.push(createEquipment());
  renderEquipment();
  renderPreview();
  queueSave();
}

function removeEquipment(id) {
  state.equipment = state.equipment.filter((item) => item.id !== id);
  renderEquipment();
  renderPreview();
  queueSave();
}

function updateEquipmentField(id, field, value) {
  const item = state.equipment.find((entry) => entry.id === id);
  if (!item) return;
  item[field] = normalizeVisibleText(value);
  elements.equipmentCount.textContent = countLabel(state.equipment.filter(equipmentFilled).length || state.equipment.length, "posto", "postos");
  renderPreview();
  queueSave();
}

function bindEquipmentList() {
  elements.equipmentList.addEventListener("input", (event) => {
    const card = event.target.closest("[data-id]");
    if (!card || !event.target.dataset.field) return;
    updateEquipmentField(card.dataset.id, event.target.dataset.field, event.target.value);
  });

  elements.equipmentList.addEventListener("change", (event) => {
    const card = event.target.closest("[data-id]");
    if (!card || !event.target.dataset.field) return;
    updateEquipmentField(card.dataset.id, event.target.dataset.field, event.target.value);
  });

  elements.equipmentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    removeEquipment(button.dataset.id);
  });

  elements.addEquipment.addEventListener("click", addEquipment);
}

function setButtonState(disabled) {
  [
    elements.saveContractTop,
    elements.saveContractBottom,
    elements.savePdfTop,
    elements.savePdfBottom,
    elements.sharePdfTop,
    elements.sharePdfBottom,
    elements.publicLinkTop,
    elements.publicLinkBottom
  ].forEach((button) => {
    if (button) button.disabled = disabled;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadAssetAsDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return blobToDataUrl(await response.blob());
}

async function ensurePdfAssets() {
  if (pdfAssets.logoDataUrl && pdfAssets.letterheadDataUrl) return pdfAssets;
  if (!pdfAssetsPromise) {
    pdfAssetsPromise = Promise.all([
      loadAssetAsDataUrl("/comercial/contratos-servicos-gerais/assets/TKA-logo.jpeg"),
      loadAssetAsDataUrl("/comercial/contratos-servicos-gerais/assets/letterhead.png")
    ]).then(([logoDataUrl, letterheadDataUrl]) => {
      pdfAssets.logoDataUrl = logoDataUrl;
      pdfAssets.letterheadDataUrl = letterheadDataUrl;
      return pdfAssets;
    }).finally(() => {
      pdfAssetsPromise = null;
    });
  }
  return pdfAssetsPromise;
}

function drawPdfTable(doc, columns, rows, context) {
  function ensureSpace(height) {
    if (context.cursorY + height <= PAGE.bottom) return;
    doc.addPage();
    context.drawPageFrame();
    context.drawSectionTitle(`${context.activeSection} (continuação)`, false);
  }

  ensureSpace(30);
  doc.setFillColor(45, 38, 35);
  doc.roundedRect(PAGE.left, context.cursorY, PAGE.width - PAGE.left - PAGE.right, 22, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let x = PAGE.left;
  columns.forEach((column) => {
    doc.text(column.label, x + 8, context.cursorY + 14);
    x += column.width;
  });
  context.cursorY += 28;

  rows.forEach((values) => {
    ensureSpace(34);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(217, 203, 197);
    doc.roundedRect(PAGE.left, context.cursorY, PAGE.width - PAGE.left - PAGE.right, 30, 5, 5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(47, 36, 31);
    let columnX = PAGE.left;
    columns.forEach((column, index) => {
      const value = String(values[index] || "");
      const trimmed = value.length > 52 ? `${value.slice(0, 49)}...` : value;
      doc.text(trimmed || " ", columnX + 8, context.cursorY + 18, { maxWidth: column.width - 16 });
      columnX += column.width;
    });
    context.cursorY += 36;
  });
}

async function generatePdfDocument(options = {}) {
  const { downloadFile = false } = options;
  syncStaticFields();
  if (!validateContractReadiness()) return false;
  elements.exportStatus.textContent = "Gerando PDF...";
  setButtonState(true);

  try {
    const assets = await ensurePdfAssets();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const content = buildContractContent();
    const context = {
      cursorY: PAGE.top,
      activeSection: "",
      drawPageFrame: null,
      drawSectionTitle: null
    };

    function drawPageFrame() {
      if (assets.letterheadDataUrl) {
        doc.addImage(assets.letterheadDataUrl, "PNG", 0, 0, PAGE.width, PAGE.height);
      }
      if (assets.logoDataUrl) {
        doc.addImage(assets.logoDataUrl, "JPEG", PAGE.left, 26, 160, 84);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(150, 29, 23);
      doc.text("Contrato - Serviços Gerais TKA", 555, 52, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(59, 49, 44);
      doc.text(`Atualizado em ${new Date().toLocaleString("pt-BR")}`, 555, 66, { align: "right" });
      if (text(state.contract.contractCode)) {
        doc.text(`Código: ${state.contract.contractCode}`, 555, 80, { align: "right" });
      }
      context.cursorY = PAGE.top;
    }

    function ensureSpace(height) {
      if (context.cursorY + height <= PAGE.bottom) return;
      doc.addPage();
      drawPageFrame();
      if (context.activeSection) {
        drawSectionTitle(`${context.activeSection} (continuação)`, false);
      }
    }

    function drawSectionTitle(title, setActive = true) {
      ensureSpace(40);
      if (setActive) context.activeSection = title;
      doc.setFillColor(179, 37, 31);
      doc.roundedRect(PAGE.left, context.cursorY, PAGE.width - PAGE.left - PAGE.right, 24, 7, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(title, PAGE.left + 12, context.cursorY + 16);
      context.cursorY += 34;
    }

    function drawFieldBox(x, y, width, label, value) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(210, 192, 186);
      doc.roundedRect(x, y, width, 42, 8, 8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(139, 42, 33);
      doc.text(String(label).toUpperCase(), x + 10, y + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(47, 36, 31);
      doc.text(String(value || " ").slice(0, 90), x + 10, y + 27, { maxWidth: width - 20 });
    }

    function drawFieldGrid(fields, columns = 2) {
      const gap = 12;
      const boxWidth = (PAGE.width - PAGE.left - PAGE.right - gap * (columns - 1)) / columns;
      for (let index = 0; index < fields.length; index += columns) {
        const row = fields.slice(index, index + columns);
        ensureSpace(52);
        row.forEach((field, rowIndex) => {
          const x = PAGE.left + rowIndex * (boxWidth + gap);
          drawFieldBox(x, context.cursorY, boxWidth, field.label, field.value);
        });
        context.cursorY += 52;
      }
      context.cursorY += 4;
    }

    function drawParagraph(textValue, options = {}) {
      const x = options.x || PAGE.left;
      const width = options.width || PAGE.width - PAGE.left - PAGE.right;
      const lineHeight = options.lineHeight || 13;
      const gapAfter = options.gapAfter == null ? 8 : options.gapAfter;
      function applyParagraphStyle() {
        doc.setFont("helvetica", options.fontStyle || "normal");
        doc.setFontSize(options.fontSize || 10);
        doc.setTextColor(...(options.color || [47, 36, 31]));
      }
      applyParagraphStyle();
      const lines = doc.splitTextToSize(String(textValue || " "), width);
      let index = 0;

      while (index < lines.length) {
        const availableHeight = PAGE.bottom - context.cursorY;
        const maxLines = Math.max(0, Math.floor(availableHeight / lineHeight) - 1);
        if (maxLines <= 0) {
          doc.addPage();
          drawPageFrame();
          if (context.activeSection) drawSectionTitle(`${context.activeSection} (continuação)`, false);
          continue;
        }
        const chunk = lines.slice(index, index + maxLines);
        applyParagraphStyle();
        doc.text(chunk, x, context.cursorY);
        context.cursorY += chunk.length * lineHeight + gapAfter;
        index += chunk.length;
        if (index < lines.length) {
          doc.addPage();
          drawPageFrame();
          if (context.activeSection) drawSectionTitle(`${context.activeSection} (continuação)`, false);
        }
      }
    }

    function drawSignatureBlock() {
      ensureSpace(300);
      drawFieldGrid([
        { label: "Nome Completo", value: state.sign.signerName || state.contractor.representativeName || "" },
        { label: "Data", value: formatDate(state.sign.date || state.contract.issueDate) },
        { label: "Cidade", value: state.sign.city || state.contract.issueCity || TKA_PROFILE.city },
        { label: "Data de Nascimento", value: formatDate(state.sign.birthDate) },
        { label: "CPF", value: state.sign.cpf || state.contractor.representativeCpf || "" }
      ]);

      const signatureY = context.cursorY + 4;
      const gap = 12;
      const signatureWidth = (PAGE.width - PAGE.left - PAGE.right - gap) / 2;
      const signatureHeight = 108;

      function drawOneSignature(x, label, signerName, dataUrl, placeholder) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(210, 192, 186);
        doc.roundedRect(x, signatureY, signatureWidth, signatureHeight, 8, 8, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(139, 42, 33);
        doc.text(label, x + 10, signatureY + 12);

        if (dataUrl) {
          doc.addImage(dataUrl, "PNG", x + 14, signatureY + 22, signatureWidth - 28, 48);
        } else {
          doc.setDrawColor(185, 169, 163);
          doc.line(x + 16, signatureY + 58, x + signatureWidth - 16, signatureY + 58);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(107, 89, 82);
          doc.text(placeholder, x + signatureWidth / 2, signatureY + 72, { align: "center", maxWidth: signatureWidth - 24 });
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(47, 36, 31);
        doc.text(String(signerName || " "), x + signatureWidth / 2, signatureY + 88, { align: "center", maxWidth: signatureWidth - 24 });
      }

      drawOneSignature(PAGE.left, "ASSINATURA DA CONTRATADA", TKA_PROFILE.representativeName, ownerSignatureDataUrl, "Assinatura da Contratada");
      drawOneSignature(PAGE.left + signatureWidth + gap, "ASSINATURA DO CONTRATANTE", state.sign.signerName || representativeName(), state.sign.signatureDataUrl, "Assinatura do contratante");
      context.cursorY = signatureY + signatureHeight + 18;
    }

    context.drawPageFrame = drawPageFrame;
    context.drawSectionTitle = drawSectionTitle;

    drawPageFrame();
    drawSectionTitle("Resumo de Serviços Gerais");
    drawFieldGrid([
      { label: "Código", value: state.contract.contractCode || "Não informado" },
      { label: "Vigência", value: contractPeriodLine() },
      { label: "Contratante", value: contractorName() },
      { label: "CNPJ", value: state.contractor.cnpj || "Não informado" },
      { label: "Local da prestacao", value: state.service.monitoredLocationName || state.service.monitoredReference || "Não informado" },
      { label: "Endereço", value: monitoredLocationLine() || "Não informado" },
      { label: "Valor mensal", value: formatMoney(state.pricing.monitoringMonthly) },
      { label: "Hora extra", value: formatMoney(state.pricing.equipmentRentalMonthly) }
    ]);

    drawSectionTitle("Partes");
    content.intro.forEach((paragraph) => drawParagraph(paragraph));

    drawSectionTitle("Definições");
    content.definitions.forEach((item) => {
      drawParagraph(item.label, {
        fontStyle: "bold",
        fontSize: 9.5,
        color: [139, 42, 33],
        gapAfter: 2
      });
      context.cursorY -= 2;
      drawParagraph(item.text, {
        x: PAGE.left + 14,
        width: PAGE.width - PAGE.left - PAGE.right - 14,
        gapAfter: 10
      });
    });

    content.clauses.forEach((clause) => {
      drawSectionTitle(clause.title);
      clause.paragraphs.forEach((paragraph) => drawParagraph(paragraph));
    });

    if (content.equipment.length) {
      drawSectionTitle("Anexo I - Postos, Funcoes e Escalas");
      drawPdfTable(doc, [
        { label: "QTD", width: 64 },
        { label: "Funcao / Servico", width: 240 },
        { label: "Escala / Horario", width: 148 },
        { label: "Valor", width: 59.28 }
      ], content.equipment.map((item) => [
        item.quantity,
        item.description,
        item.location,
        formatMoney(item.value)
      ]), context);
    }

    drawSectionTitle("Assinatura");
    drawParagraph(content.issueLine, { fontStyle: "italic", color: [107, 89, 82] });
    drawSignatureBlock();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${sanitizeFilename(state.contractor.legalName || state.contractor.companyName || state.contract.contractCode)}-${stamp}.pdf`;
    ultimoPdfBlob = doc.output("blob");
    ultimoPdfNome = fileName;
    if (downloadFile) {
      doc.save(fileName);
      elements.exportStatus.textContent = "PDF gerado com sucesso.";
    }
    return true;
  } catch (error) {
    console.error(error);
    elements.exportStatus.textContent = "Falha ao gerar o PDF.";
    return false;
  } finally {
    setButtonState(false);
  }
}

async function saveContract() {
  const saved = await flushCloudSave({ manual: true });
  if (!saved && !elements.exportStatus.textContent) {
    elements.exportStatus.textContent = "Falha ao salvar o contrato.";
  }
}

async function exportPdf() {
  if (!validateContractReadiness()) return;
  const synced = await flushCloudSave({ manual: true });
  if (!synced) {
    elements.exportStatus.textContent = "Falha ao sincronizar os dados antes de gerar o PDF.";
    return;
  }
  await generatePdfDocument({ downloadFile: true });
}

async function sharePdf() {
  if (!validateContractReadiness()) return;
  const synced = await flushCloudSave({ manual: true });
  if (!synced) {
    elements.exportStatus.textContent = "Falha ao sincronizar os dados antes de compartilhar o PDF.";
    return;
  }
  if (!await generatePdfDocument()) return;

  const file = new File([ultimoPdfBlob], ultimoPdfNome, { type: "application/pdf" });

  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Contrato - Serviços Gerais TKA",
        text: WHATSAPP_MESSAGE,
        files: [file]
      });
      elements.exportStatus.textContent = "PDF compartilhado.";
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      elements.exportStatus.textContent = "Compartilhamento cancelado.";
      return;
    }
  }

  const textMessage = encodeURIComponent(`${WHATSAPP_MESSAGE} Se o anexo não abrir automaticamente, use Salvar PDF e depois anexe o arquivo.`);
  window.open(`https://wa.me/?text=${textMessage}`, "_blank");
  elements.exportStatus.textContent = "WhatsApp aberto. Se o anexo não abrir automaticamente, use Salvar PDF e depois anexe o arquivo.";
}

function buildPublicContractUrl(contractId) {
  if (!contractId) return "";
  const url = new URL("/comercial/contratos-servicos-gerais/editor.html", window.location.origin);
  url.searchParams.set("id", contractId);
  url.searchParams.set("public", "1");
  return url.toString();
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  return copied;
}

async function copyPublicLink() {
  const synced = await flushCloudSave({ manual: true });
  if (!synced) {
    elements.exportStatus.textContent = "Nao foi possivel salvar o rascunho para gerar o link de edicao.";
    return;
  }

  const link = buildPublicContractUrl(state.meta.contractId);
  if (!link) {
    elements.exportStatus.textContent = "Nao foi possivel montar o link de edicao.";
    return;
  }

  try {
    const copied = await copyTextToClipboard(link);
    if (!copied) throw new Error("Clipboard unavailable");
    elements.exportStatus.textContent = "Link de edicao copiado. Envie este link para o cliente continuar o contrato.";
  } catch (error) {
    window.prompt("Copie o link de edicao do contrato:", link);
    elements.exportStatus.textContent = "Link de edicao gerado.";
  }
}

function consumeImportNotice() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("imported") !== "1") return;
  const contractId = params.get("id") || state.meta.contractId || "";
  let warnings = [];
  try {
    const storageKey = "commercial_contract_import_notice:" + contractId;
    warnings = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    sessionStorage.removeItem(storageKey);
  } catch (error) {
    warnings = [];
  }
  elements.exportStatus.textContent = warnings.length
    ? "Upload importado com avisos. Revise os campos preenchidos antes do PDF final."
    : "Upload importado. Revise os campos preenchidos automaticamente antes do PDF final.";
  if (window.tkaCommercialContractImporter) {
    window.tkaCommercialContractImporter.showImportNotice(warnings, {
      title: "Upload importado",
      summary: "Revise os campos preenchidos automaticamente."
    });
  }
}

function bindButtons() {
  elements.saveContractTop.addEventListener("click", saveContract);
  elements.saveContractBottom.addEventListener("click", saveContract);
  elements.savePdfTop.addEventListener("click", exportPdf);
  elements.savePdfBottom.addEventListener("click", exportPdf);
  elements.sharePdfTop.addEventListener("click", sharePdf);
  elements.sharePdfBottom.addEventListener("click", sharePdf);
  if (elements.publicLinkTop) elements.publicLinkTop.addEventListener("click", copyPublicLink);
  if (elements.publicLinkBottom) elements.publicLinkBottom.addEventListener("click", copyPublicLink);
  if (elements.legalTextReset) {
    elements.legalTextReset.addEventListener("click", () => {
      state.legalDocument = null;
      state.legalOverrides = {};
      renderPreview();
      queueSave("Modelo contratual restaurado. Sincronizando...");
    });
  }
  window.addEventListener("resize", () => {
    resizeSignatureCanvas();
    redrawStoredSignature();
  });
}

function renderAll() {
  populateStaticFields();
  renderEquipment();
  renderPreview();
  renderOwnerSignaturePreview();
  resizeSignatureCanvas();
  redrawStoredSignature();
}

async function loadData() {
  initializeFirebase();
  await loadOwnerSignature();
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const loaded = await loadContractFromCloud();
  renderAll();
  if (loaded) {
    consumeImportNotice();
    updateSaveStatus("contrato de serviços gerais carregado e pronto para edição.");
    return;
  }
  if (requestedId) {
    elements.exportStatus.textContent = "Contrato não encontrado na Base de serviços gerais. Um modelo novo foi aberto.";
  }
  updateSaveStatus("Modelo de serviços gerais pronto para preenchimento.");
}

if (applyAccessGuard()) {
  document.body.classList.toggle("public-client-mode", isPublicClientAccess());
  bindStaticFields();
  bindLegalTextEditor();
  bindEquipmentList();
  bindButtons();
  bindSignatureCanvas();

  loadData().catch((error) => {
    console.error(error);
    renderAll();
    updateSaveStatus("Pronto para preenchimento.");
    elements.exportStatus.textContent = "Falha ao carregar dados remotos. O modelo local segue disponível.";
  });
}



