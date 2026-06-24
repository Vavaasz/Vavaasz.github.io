const COLLECTION_NAME = "commercial_intermittent_contracts";
const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
const WHATSAPP_MESSAGE = "Segue o contrato de trabalho intermitente TKA em PDF.";
const CONTRACT_TITLE = "Contrato de Trabalho Intermitente";
const PAGE = {
  width: 595.28,
  height: 841.89,
  top: 118,
  left: 42,
  right: 42,
  bottom: 740
};
const TKA_PROFILE = {
  legalName: "TKA SEGURANCA PRIVADA LTDA.",
  cnpj: "47.711.058/0001-07",
  address: "Avenida Jose Pedro da Cunha",
  number: "53",
  district: "Jardim Maria Augusta",
  city: "Taubate",
  state: "SP",
  cep: "12070-003",
  certificate: "3286/2022",
  representativeName: "KÁTIO AUGUSTO MACHADO DA SILVA",
  representativeRg: "32.176.952-1 SSP/SP",
  representativeCpf: "286.800.648-58"
};
const DEFAULT_EQUIPMENT = [
  { quantity: "01", description: "Vigilante intermitente", location: "Diaria de 12 horas mediante convocacao para eventos", value: "175,00" }
];
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
      issueCity: "Taubate",
      issueDate: "",
      startDate: "",
      endDate: "",
      durationMonths: "Indeterminado"
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
      representativeRole: "Vigilante",
      representativeCpf: "",
      representativeRg: ""
    },
    service: {
      monitoredLocationName: "Eventos TKA",
      monitoredAddress: "",
      monitoredNumber: "",
      monitoredComplement: "",
      monitoredDistrict: "",
      monitoredCep: "",
      monitoredCity: "",
      monitoredState: "SP",
      monitoredReference: "",
      communicationMethod: "vigilancia intermitente para eventos"
    },
    pricing: {
      monitoringMonthly: "175,00",
      equipmentRentalMonthly: "12%",
      installationTotal: "5 dias uteis apos o termino do evento",
      installationInstallments: "15 dias corridos apos o termino da desmontagem",
      dueDay: "1 dia util",
      paymentMethod: "Pix, transferencia bancaria, especie ou outro meio acordado"
    },
    equipment: defaultEquipmentList(),
    sign: {
      city: "",
      date: "",
      signerName: "",
      birthDate: "",
      cpf: "",
      signerTitle: "CONTRATADO",
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
  saveContractPublic: document.getElementById("saveContractPublic"),
  savePdfPublic: document.getElementById("savePdfPublic"),
  sharePdfTop: document.getElementById("sharePdfTop"),
  sharePdfBottom: document.getElementById("sharePdfBottom"),
  publicLinkTop: document.getElementById("publicLinkTop"),
  publicLinkBottom: document.getElementById("publicLinkBottom"),
  publicSaveStatus: document.getElementById("publicSaveStatus"),
  publicExportStatus: document.getElementById("publicExportStatus"),
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
  return Boolean(user && hasCommercialAccess() && (user.permissions?.admin || LEGAL_EDITOR_EMAILS.has(normalizeEmail(user.email))));
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
  return text(state.contractor.legalName || state.contractor.companyName) || "CONTRATADO";
}

function representativeName() {
  return text(state.contractor.representativeName) || "representante legal não informado";
}

function employeeNationality() {
  return text(state.contractor.ie) || "brasileiro(a)";
}

function employeeCivilStatus() {
  return text(state.contractor.im) || "estado civil nao informado";
}

function employeeProfession() {
  return text(state.contractor.representativeRole) || "profissao nao informada";
}

function employeeRg() {
  return text(state.contractor.representativeRg) || "RG nao informado";
}

function employeeCpf() {
  return text(state.contractor.cnpj || state.sign.cpf) || "CPF nao informado";
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
  merged.equipment = Array.isArray(normalizedLoaded.equipment) && normalizedLoaded.equipment.length
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
  syncWorkerSignatureFields();
}

function syncWorkerSignatureFields() {
  if (isPublicClientAccess()) {
    state.sign.signerName = text(state.contractor.legalName || state.contractor.companyName);
    state.sign.cpf = text(state.contractor.cnpj);
  } else {
    if (!text(state.sign.signerName)) state.sign.signerName = text(state.contractor.legalName || state.contractor.companyName);
    if (!text(state.sign.cpf)) state.sign.cpf = text(state.contractor.cnpj);
  }
  if (!text(state.sign.city)) state.sign.city = text(state.contractor.city || state.contract.issueCity);
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
  elements.equipmentCount.textContent = countLabel(filled, "funcao", "funcoes");
}

function equipmentRows() {
  return state.equipment.filter(equipmentFilled);
}

function buildDefaultContractContent() {
  const employeeAddress = addressLine(state.contractor);
  const serviceAddress = monitoredLocationLine();
  const serviceName = text(state.service.monitoredLocationName || state.service.monitoredReference) || "EVENTOS TKA";
  const serviceType = text(state.service.communicationMethod) || "vigilancia intermitente para eventos";
  const dailyValue = text(state.pricing.monitoringMonthly) ? formatMoney(state.pricing.monitoringMonthly) : "R$ 175,00";
  const responseDeadline = text(state.pricing.dueDay) || "1 dia util";
  const eventPaymentDeadline = text(state.pricing.installationTotal) || "5 dias uteis apos o termino do evento";
  const assemblyPaymentDeadline = text(state.pricing.installationInstallments) || "15 dias corridos apos o termino da desmontagem";
  const paymentMethod = text(state.pricing.paymentMethod) || "Pix, transferencia bancaria, especie ou outro meio acordado";
  const duration = text(state.contract.durationMonths) || "indeterminado";
  const contractStart = formatDate(state.contract.startDate) || "data da assinatura";
  const contractEnd = formatDate(state.contract.endDate);
  const periodLine = contractEnd ? `${contractStart} ate ${contractEnd}` : `a partir de ${contractStart}, por prazo ${duration}`;
  const posts = equipmentRows();

  return {
    title: CONTRACT_TITLE,
    intro: [
      `CONTRATANTE: ${TKA_PROFILE.legalName}, inscrita no CNPJ sob o n. ${TKA_PROFILE.cnpj}, com sede na ${TKA_PROFILE.address}, n. ${TKA_PROFILE.number}, ${TKA_PROFILE.district}, ${TKA_PROFILE.city}/${TKA_PROFILE.state}, CEP ${TKA_PROFILE.cep}, neste ato representada por ${TKA_PROFILE.representativeName}, portador do RG n. ${TKA_PROFILE.representativeRg} e inscrito no CPF/MF sob o n. ${TKA_PROFILE.representativeCpf}.`,
      `CONTRATADO: ${contractorName()}, ${employeeNationality()}, ${employeeCivilStatus()}, ${employeeProfession()}, portador do RG n. ${employeeRg()} e CPF n. ${employeeCpf()}, residente e domiciliado em ${employeeAddress || "endereco completo nao informado"}.`,
      `As partes tem entre si justo e acordado o presente CONTRATO DE TRABALHO INTERMITENTE, com vigencia ${periodLine}, que se regera pelas clausulas abaixo, pela CLT, pela Convencao Coletiva de Trabalho vigente da categoria e pela legislacao trabalhista aplicavel.`
    ],
    definitions: [
      {
        label: "TRABALHO INTERMITENTE",
        text: "Prestacao de servicos com alternancia de periodos de atividade e inatividade, mediante convocacao especifica da CONTRATANTE, nos termos dos arts. 452-A a 452-H da CLT."
      },
      {
        label: "CONVOCACAO",
        text: `Chamado feito por e-mail, WhatsApp, SMS ou outro meio eficaz que comprove recebimento, com antecedencia minima de 3 dias corridos e prazo de resposta de ${responseDeadline}.`
      },
      {
        label: "EVENTO OU LOCAL DE TRABALHO",
        text: `${serviceName}${serviceAddress ? `, localizado em ${serviceAddress}` : ""}. Cada convocacao devera indicar periodo, jornada diaria, local e funcao a ser desempenhada.`
      }
    ],
    clauses: [
      {
        title: "Clausula Primeira - Objeto",
        paragraphs: [
          `1.1. O presente contrato tem por objeto a prestacao de servicos de ${serviceType} pelo CONTRATADO, mediante convocacao da CONTRATANTE, especialmente para atuacao em eventos.`,
          "1.2. O CONTRATADO somente prestara servicos nos periodos expressamente aceitos por ele, permanecendo livre para aceitar ou recusar cada convocacao.",
          "1.3. O periodo de inatividade nao sera considerado tempo a disposicao da CONTRATANTE e nao gerara remuneracao."
        ]
      },
      {
        title: "Clausula Segunda - Convocacao para Prestacao de Servicos",
        paragraphs: [
          "2.1. A CONTRATANTE convocara o CONTRATADO por meio eficaz que comprove o recebimento, com antecedencia minima de 3 dias corridos da data prevista para inicio da prestacao dos servicos.",
          "2.2. A convocacao devera especificar periodo de realizacao do evento, jornada diaria, local de trabalho, funcao e demais orientacoes operacionais necessarias.",
          "2.3. Consideram-se meios eficazes e-mail, WhatsApp, SMS, sistema interno ou qualquer outro canal que assegure comprovacao do recebimento."
        ]
      },
      {
        title: "Clausula Terceira - Prazo para Resposta",
        paragraphs: [
          `3.1. O CONTRATADO tera o prazo de ${responseDeadline}, contado do recebimento da convocacao, para manifestar sua aceitacao ou recusa.`,
          "3.2. O silencio do CONTRATADO apos o decurso do prazo sera interpretado como recusa tacita a convocacao.",
          "3.3. A recusa nao descaracteriza o vinculo empregaticio intermitente nem constitui ato de insubordinacao."
        ]
      },
      {
        title: "Clausula Quarta - Remuneracao",
        paragraphs: [
          `4.1. A remuneracao sera de ${dailyValue} por diaria de 12 horas, conforme CCT vigente, contemplando as verbas aplicaveis de salario, adicional de periculosidade, descanso semanal remunerado, ferias proporcionais, um terco constitucional, decimo terceiro salario e vale-transporte quando cabivel.`
        ]
      },
      {
        title: "Clausula Quinta - Pagamento",
        paragraphs: [
          `5.1. Para seguranca do evento, o pagamento sera realizado em ate ${eventPaymentDeadline}.`,
          `5.2. Para montagem e desmontagem, quando aplicavel, o pagamento sera realizado em ate ${assemblyPaymentDeadline}.`,
          "5.3. Em eventos com duracao superior a 15 dias, sera devido adiantamento minimo de 50% dos dias ja trabalhados, salvo regra mais favoravel ao CONTRATADO.",
          `5.4. O pagamento sera realizado por ${paymentMethod}. Caso a CONTRATANTE opte por pagamento no local do evento, devera efetua-lo em ate 2 horas apos o termino efetivo da prestacao.`
        ]
      },
      {
        title: "Clausula Sexta - Descontos por Prejuizos",
        paragraphs: [
          "6.1. O CONTRATADO autoriza o desconto de valores correspondentes a prejuizos causados a CONTRATANTE ou a terceiros por dolo ou culpa grave devidamente comprovados, nos termos do art. 462, paragrafo 1 da CLT.",
          "6.2. Qualquer desconto devera ser precedido de apuracao objetiva do ocorrido e registro documental."
        ]
      },
      {
        title: "Clausula Setima - Ambiente Monitorado",
        paragraphs: [
          "7.1. O CONTRATADO declara ciencia de que podera prestar servicos em ambientes monitorados por cameras e sistemas de seguranca para protecao patrimonial, seguranca pessoal, controle de acesso e investigacao de ocorrencias.",
          "7.2. As imagens poderao ser utilizadas para fins legitimos relacionados a seguranca, preservacao do patrimonio, apuracao de ocorrencias e cumprimento de obrigacoes legais."
        ]
      },
      {
        title: "Clausula Oitava - Regimento Interno e Codigo de Conduta",
        paragraphs: [
          "8.1. O CONTRATADO declara conhecer e concordar com o Regimento Interno, Codigo de Conduta, normas de apresentacao, postura, sigilo, uso de uniforme e orientacoes operacionais da empresa.",
          "8.2. O descumprimento das normas internas podera ensejar medidas disciplinares, incluindo advertencia, suspensao ou dispensa por justa causa, conforme a gravidade e a legislacao aplicavel."
        ]
      },
      {
        title: "Clausula Nona - Rescisao Contratual",
        paragraphs: [
          "9.1. A rescisao podera ocorrer por iniciativa de qualquer das partes, observados os prazos, procedimentos e verbas previstos na legislacao trabalhista vigente.",
          "9.2. As verbas rescisorias serao calculadas com base na media das remuneracoes recebidas, conforme a modalidade da rescisao e a legislacao aplicavel."
        ]
      },
      {
        title: "Clausula Decima - Disposicoes Gerais",
        paragraphs: [
          "10.1. A CONTRATANTE mantera registro das convocacoes realizadas, respostas recebidas, periodos trabalhados e pagamentos efetuados.",
          "10.2. Aplicam-se a este contrato as disposicoes da CLT, especialmente arts. 452-A a 452-H, a CCT da categoria e a legislacao trabalhista vigente.",
          "10.3. Qualquer alteracao deste instrumento devera ser formalizada por escrito."
        ]
      },
      {
        title: "Clausula Decima Primeira - Foro",
        paragraphs: [
          `11.1. Fica eleito o foro do domicilio de ${text(state.contract.issueCity || state.sign.city) || TKA_PROFILE.city}/SP para dirimir questoes oriundas deste contrato, com renuncia a qualquer outro por mais privilegiado que seja.`
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

  html += `
    <article class="preview-card">
      <h3>Anexo I - Funcao, Convocacao e Diaria</h3>
      <table class="annex-table">
        <thead>
          <tr>
            <th>QTD</th>
            <th>Funcao</th>
            <th>Jornada / Convocacao</th>
            <th>Diaria</th>
          </tr>
        </thead>
        <tbody>
          ${content.equipment.length ? content.equipment.map((item) => `
            <tr>
              <td>${escapeHtml(item.quantity)}</td>
              <td>${escapeHtml(item.description)}</td>
              <td>${escapeHtml(item.location)}</td>
              <td>${escapeHtml(formatMoney(item.value))}</td>
            </tr>
          `).join("") : `
            <tr>
              <td colspan="4">Nenhuma funcao informada.</td>
            </tr>
          `}
        </tbody>
      </table>
    </article>
    <article class="preview-card">
      <h3>Assinaturas</h3>
      <div class="definition-list">
        ${renderSignaturePreviewItem("Contratante", TKA_PROFILE.representativeName, ownerSignatureDataUrl, "Assinatura da direcao pendente no Admin.")}
        ${renderSignaturePreviewItem("Contratado", state.sign.signerName || contractorName(), state.sign.signatureDataUrl, "Aguardando assinatura desenhada do contratado.")}
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
    elements.ownerSignatureEmpty.textContent = "Assinatura do proprietario pendente no Admin.";
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
    source: "intermittent-contract-editor",
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
  if (elements.saveStatus) elements.saveStatus.textContent = message;
  if (elements.publicSaveStatus) elements.publicSaveStatus.textContent = message;
}

function setExportStatus(message) {
  if (elements.exportStatus) elements.exportStatus.textContent = message || "";
  if (elements.publicExportStatus) elements.publicExportStatus.textContent = message || "";
}

function getExportStatus() {
  return text((elements.exportStatus && elements.exportStatus.textContent) || (elements.publicExportStatus && elements.publicExportStatus.textContent));
}

function collectContractReadinessIssues() {
  const issues = [];
  if (!text(state.contractor.legalName || state.contractor.companyName)) issues.push("nome completo");
  if (!text(state.contractor.ie)) issues.push("nacionalidade");
  if (!text(state.contractor.im)) issues.push("estado civil");
  if (!text(state.contractor.representativeRole)) issues.push("profissao");
  if (!text(state.contractor.representativeRg)) issues.push("RG");
  if (!text(state.contractor.cnpj || state.sign.cpf)) issues.push("CPF");
  if (!text(state.contractor.address)) issues.push("endereco");
  if (!text(state.contractor.number)) issues.push("numero");
  if (!text(state.contractor.district)) issues.push("bairro");
  if (!text(state.contractor.cep)) issues.push("CEP");
  if (!text(state.contractor.city)) issues.push("cidade");
  if (!text(state.contractor.state)) issues.push("estado");
  if (!text(state.sign.date || state.contract.issueDate)) issues.push("data da assinatura");
  if (!text(state.sign.city || state.contract.issueCity || state.contractor.city)) issues.push("cidade da assinatura");
  if (!text(state.sign.signatureDataUrl)) issues.push("assinatura do contratado");
  if (!text(ownerSignatureDataUrl)) issues.push("assinatura da direcao no Admin/RH");
  return issues;
}

function validateContractReadiness() {
  syncStaticFields();
  const issues = collectContractReadinessIssues();
  if (issues.length) {
    setExportStatus(`Pendencias antes do PDF: ${issues.join(", ")}.`);
    return false;
  }
  return true;
}

async function persistContractToCloud(options = {}) {
  const { manual = false, force = false } = options;
  if (!firebaseDb) {
    if (manual) setExportStatus("Base de dados indisponivel no momento.");
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
      updateSaveStatus(`${isPublicClientAccess() ? "Preenchimento sincronizado" : "Contrato sincronizado"} em ${new Date().toLocaleTimeString("pt-BR")}`);
      setExportStatus(isPublicClientAccess() ? "Preenchimento salvo." : `Contrato comercial vinculado. ID: ${docRef.id}`);
    }
    return true;
  }

  await docRef.set(record, { merge: true });
  lastCloudSnapshot = snapshot;

  const url = new URL(window.location.href);
  url.searchParams.set("id", docRef.id);
  window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);

  updateSaveStatus(`${manual ? (isPublicClientAccess() ? "Preenchimento salvo" : "Contrato salvo") : "Sincronizado"} em ${new Date().toLocaleTimeString("pt-BR")}`);
  if (manual) setExportStatus(isPublicClientAccess() ? "Preenchimento salvo." : `Contrato comercial vinculado. ID: ${docRef.id}`);
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
  elements.equipmentCount.textContent = countLabel(state.equipment.filter(equipmentFilled).length || state.equipment.length, "funcao", "funcoes");
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
    elements.saveContractPublic,
    elements.savePdfPublic,
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
      loadAssetAsDataUrl("/comercial/contratos-intermitente/assets/TKA-logo.jpeg"),
      loadAssetAsDataUrl("/comercial/contratos-intermitente/assets/letterhead.png")
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
  setExportStatus("Gerando PDF...");
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
      doc.text("Contrato de Trabalho Intermitente TKA", 555, 52, { align: "right" });
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
      doc.setFont("helvetica", options.fontStyle || "normal");
      doc.setFontSize(options.fontSize || 10);
      doc.setTextColor(...(options.color || [47, 36, 31]));
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
      ensureSpace(340);
      drawFieldGrid([
        { label: "Nome Completo", value: state.sign.signerName || contractorName() },
        { label: "CPF", value: state.sign.cpf || state.contractor.cnpj || "" },
        { label: "RG", value: state.contractor.representativeRg || "" },
        { label: "Data de Nascimento", value: formatDate(state.sign.birthDate) },
        { label: "Cidade", value: state.sign.city || state.contract.issueCity || TKA_PROFILE.city },
        { label: "Data", value: formatDate(state.sign.date || state.contract.issueDate) }
      ]);

      ensureSpace(140);
      const signatureY = context.cursorY + 4;
      const gap = 14;
      const signatureWidth = (PAGE.width - PAGE.left - PAGE.right - gap) / 2;
      const signatureHeight = 108;

      function drawOneSignature(x, label, signerName, dataUrl) {
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
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(47, 36, 31);
        doc.text(String(signerName || " "), x + signatureWidth / 2, signatureY + 82, { align: "center", maxWidth: signatureWidth - 24 });
      }

      drawOneSignature(PAGE.left, "ASSINATURA DA CONTRATANTE", TKA_PROFILE.representativeName, ownerSignatureDataUrl);
      drawOneSignature(PAGE.left + signatureWidth + gap, "ASSINATURA DO CONTRATADO", state.sign.signerName || contractorName(), state.sign.signatureDataUrl);
      context.cursorY = signatureY + signatureHeight + 18;

      drawFieldGrid([
        { label: "Testemunha 1", value: state.sign.witnessOneName || "" },
        { label: "CPF Testemunha 1", value: state.sign.witnessOneDocument || "" },
        { label: "Testemunha 2", value: state.sign.witnessTwoName || "" },
        { label: "CPF Testemunha 2", value: state.sign.witnessTwoDocument || "" }
      ]);
    }
    context.drawPageFrame = drawPageFrame;
    context.drawSectionTitle = drawSectionTitle;

    drawPageFrame();
    drawSectionTitle("Resumo de Trabalho Intermitente");
    drawFieldGrid([
      { label: "Codigo", value: state.contract.contractCode || "Nao informado" },
      { label: "Vigencia", value: contractPeriodLine() },
      { label: "Contratado", value: contractorName() },
      { label: "CPF", value: state.contractor.cnpj || state.sign.cpf || "Nao informado" },
      { label: "Evento/base", value: state.service.monitoredLocationName || state.service.monitoredReference || "Nao informado" },
      { label: "Endereco", value: monitoredLocationLine() || "Nao informado" },
      { label: "Diaria", value: formatMoney(state.pricing.monitoringMonthly) },
      { label: "Gratificacao", value: state.pricing.equipmentRentalMonthly || "Nao informada" }
    ]);

    drawSectionTitle("Partes");
    content.intro.forEach((paragraph) => drawParagraph(paragraph));

    drawSectionTitle("Definicoes");
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

    drawSectionTitle("Anexo I - Funcao, Convocacao e Diaria");
    if (content.equipment.length) {
      drawPdfTable(doc, [
        { label: "QTD", width: 64 },
        { label: "Funcao", width: 180 },
        { label: "Jornada / Convocacao", width: 208 },
        { label: "Diaria", width: 59.28 }
      ], content.equipment.map((item) => [
        item.quantity,
        item.description,
        item.location,
        formatMoney(item.value)
      ]), context);
    } else {
      drawParagraph("Nenhuma funcao informada no anexo.");
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
      setExportStatus("PDF gerado com sucesso.");
    }
    return true;
  } catch (error) {
    console.error(error);
    setExportStatus("Falha ao gerar o PDF.");
    return false;
  } finally {
    setButtonState(false);
  }
}

async function saveContract() {
  const saved = await flushCloudSave({ manual: true });
  if (!saved && !getExportStatus()) {
    setExportStatus("Falha ao salvar o contrato.");
  }
}

async function exportPdf() {
  if (!validateContractReadiness()) return;
  const synced = await flushCloudSave({ manual: true });
  if (!synced) {
    setExportStatus("Falha ao sincronizar os dados antes de gerar o PDF.");
    return;
  }
  await generatePdfDocument({ downloadFile: true });
}

async function sharePdf() {
  if (!validateContractReadiness()) return;
  const synced = await flushCloudSave({ manual: true });
  if (!synced) {
    setExportStatus("Falha ao sincronizar os dados antes de compartilhar o PDF.");
    return;
  }
  if (!await generatePdfDocument()) return;

  const file = new File([ultimoPdfBlob], ultimoPdfNome, { type: "application/pdf" });

  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Contrato de Trabalho Intermitente TKA",
        text: WHATSAPP_MESSAGE,
        files: [file]
      });
      setExportStatus("PDF compartilhado.");
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      setExportStatus("Compartilhamento cancelado.");
      return;
    }
  }

  const textMessage = encodeURIComponent(`${WHATSAPP_MESSAGE} Se o anexo não abrir automaticamente, use Salvar PDF e depois anexe o arquivo.`);
  window.open(`https://wa.me/?text=${textMessage}`, "_blank");
  setExportStatus("WhatsApp aberto. Se o anexo nao abrir automaticamente, use Salvar PDF e depois anexe o arquivo.");
}

function buildPublicContractUrl(contractId) {
  if (!contractId) return "";
  const url = new URL("/comercial/contratos-intermitente/editor.html", window.location.origin);
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
    setExportStatus("Nao foi possivel salvar o rascunho para gerar o link de preenchimento.");
    return;
  }

  const link = buildPublicContractUrl(state.meta.contractId);
  if (!link) {
    setExportStatus("Nao foi possivel montar o link de preenchimento.");
    return;
  }

  try {
    const copied = await copyTextToClipboard(link);
    if (!copied) throw new Error("Clipboard unavailable");
    setExportStatus("Link de preenchimento copiado. Envie este link para o empregado preencher e assinar.");
  } catch (error) {
    window.prompt("Copie o link de preenchimento do trabalhador:", link);
    setExportStatus("Link de preenchimento gerado.");
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
  setExportStatus(warnings.length
    ? "Upload importado com avisos. Revise os campos preenchidos antes do PDF final."
    : "Upload importado. Revise os campos preenchidos automaticamente antes do PDF final.");
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
  if (elements.saveContractPublic) elements.saveContractPublic.addEventListener("click", saveContract);
  elements.savePdfTop.addEventListener("click", exportPdf);
  elements.savePdfBottom.addEventListener("click", exportPdf);
  if (elements.savePdfPublic) elements.savePdfPublic.addEventListener("click", exportPdf);
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
    updateSaveStatus(isPublicClientAccess() ? "Contrato carregado para preenchimento." : "Contrato de trabalho intermitente carregado e pronto para edicao.");
    return;
  }
  if (requestedId) {
    setExportStatus("Contrato nao encontrado na base de trabalho intermitente. Um modelo novo foi aberto.");
  }
  updateSaveStatus("Modelo de trabalho intermitente pronto para preenchimento.");
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
    setExportStatus("Falha ao carregar dados remotos. O modelo local segue disponivel.");
  });
}



