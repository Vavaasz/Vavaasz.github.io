const COLLECTION_NAME = "commercial_contracts";
const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
const WHATSAPP_MESSAGE = "Segue o contrato de monitoramento TKA em PDF.";
const CONTRACT_TITLE = "Contrato para Prestação de Serviços de Monitoramento à Distância de Sistema Eletrônico de Alarme e Cessão de Equipamentos";
const PAGE = {
  width: 595.28,
  height: 841.89,
  top: 118,
  left: 42,
  right: 42,
  bottom: 740
};
const TKA_PROFILE = {
  legalName: "TKA SEGURANÇA PRIVADA LTDA.",
  cnpj: "47.711.058/0001-07",
  address: "Avenida José Pedro da Cunha",
  number: "53",
  district: "Centro",
  city: "Taubaté",
  state: "SP",
  certificate: "3286/2022",
  representativeName: "KÁTIO AUGUSTO MACHADO DA SILVA",
  representativeRg: "32.176.952-1 SSP/SP",
  representativeCpf: "286.800.648-58"
};
const DEFAULT_EQUIPMENT = [
  { quantity: "04", description: "Câmeras em comodato", location: "", value: "" }
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
      contractCode: "TKA_326_0226",
      publicLink: "",
      issueCity: "Taubaté",
      issueDate: "2026-02-09",
      startDate: "",
      endDate: "",
      durationMonths: "12"
    },
    contractor: {
      companyName: "Palm 17",
      legalName: "PALM 17 EMPREENDIMENTOS & PARTICIPAÇÕES LTDA",
      cnpj: "24.928.686/0001-43",
      im: "72278",
      ie: "",
      phone: "(12)3633-3281",
      email1: "jrsmiranda@hotmail.com",
      email2: "alpi.obras@gmail.com",
      address: "Rua Nancy Guisard Kehier",
      number: "47",
      complement: "Piso Superior Sala 01",
      district: "Jardim das Nações",
      cep: "12030-130",
      city: "Taubaté",
      state: "SP",
      representativeName: "",
      representativeRole: "",
      representativeCpf: "",
      representativeRg: ""
    },
    service: {
      monitoredLocationName: "PALM 17 - Av. John Kennedy",
      monitoredAddress: "Avenida John Fitzgerald Kennedy",
      monitoredNumber: "680",
      monitoredComplement: "",
      monitoredDistrict: "Jardim das Nações",
      monitoredCep: "12030-200",
      monitoredCity: "Taubaté",
      monitoredState: "SP",
      monitoredReference: "",
      communicationMethod: "Rádio, linha telefônica, Ethernet, rede celular ou modem GSM/GPRS/TDMA/CDMA"
    },
    pricing: {
      monitoringMonthly: "400,00",
      equipmentRentalMonthly: "",
      installationTotal: "",
      installationInstallments: "",
      dueDay: "10",
      paymentMethod: "Boletos bancários"
    },
    equipment: defaultEquipmentList(),
    sign: {
      city: "Taubaté",
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

function isPalm17Contract() {
  const companyName = text(state.contractor.companyName).toLowerCase();
  const legalName = text(state.contractor.legalName).toLowerCase();
  return companyName === "palm 17" || legalName.includes("palm 17");
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
  elements.equipmentCount.textContent = countLabel(filled, "equipamento", "equipamentos");
}

function equipmentRows() {
  return state.equipment.filter(equipmentFilled);
}

function buildDefaultContractContent() {
  const contractorAddress = addressLine(state.contractor);
  const monitoredAddress = monitoredLocationLine();
  const monitoredName = text(state.service.monitoredLocationName || state.service.monitoredReference) || "LOCAL MONITORADO";
  const monitoredReference = text(state.service.monitoredReference);
  const contractorDocument = text(state.contractor.cnpj) || "CNPJ não informado";
  const representativeCpf = text(state.contractor.representativeCpf) || "CPF não informado";
  const representativeRg = text(state.contractor.representativeRg) || "RG não informado";
  const dueDay = text(state.pricing.dueDay) ? `no dia ${text(state.pricing.dueDay)}` : "na data definida no pedido de serviços";
  const installationInstallments = text(state.pricing.installationInstallments) || "12";
  const monitoringMonthly = formatMoney(state.pricing.monitoringMonthly);
  const rentalMonthly = formatMoney(state.pricing.equipmentRentalMonthly);
  const installationTotal = formatMoney(state.pricing.installationTotal);
  const equipment = equipmentRows();

  return {
    title: CONTRACT_TITLE,
    intro: [
      `${contractorName()}, com sede em ${contractorAddress || "endereço não informado"}, inscrita no CNPJ sob o nº ${contractorDocument}, neste ato representada por ${representativeName()}, ${text(state.contractor.representativeRole) || "representante legal"}, portador do RG nº ${representativeRg} e inscrito no CPF/MF nº ${representativeCpf}, doravante denominada simplesmente CONTRATANTE;`,
      `e, de outro lado, ${TKA_PROFILE.legalName}, com sede na ${TKA_PROFILE.address}, nº ${TKA_PROFILE.number}, ${TKA_PROFILE.district} - ${TKA_PROFILE.city}/${TKA_PROFILE.state}, inscrita no CNPJ sob o nº ${TKA_PROFILE.cnpj}, portadora do Certificado de Segurança expedido pela Polícia Federal nº ${TKA_PROFILE.certificate}, neste ato representada por ${TKA_PROFILE.representativeName}, portador do RG nº ${TKA_PROFILE.representativeRg} e inscrito no CPF/MF nº ${TKA_PROFILE.representativeCpf}, doravante denominada simplesmente CONTRATADA.`,
      "Pelo presente instrumento particular, resolvem as partes acima qualificadas celebrar contrato de prestação de serviços especializados, mediante as cláusulas e condições abaixo, que se obrigam a cumprir e observar, por si, seus herdeiros e sucessores."
    ],
    definitions: [
      {
        label: "CONTRATADA",
        text: `${TKA_PROFILE.legalName}, responsável pela prestação dos serviços de monitoramento remoto de alarmes e pela manutenção corretiva nos equipamentos cedidos ao CONTRATANTE, conforme descrito no pedido de serviços.`
      },
      {
        label: "CONTRATANTE",
        text: `Pessoa jurídica qualificada neste instrumento como ${contractorName()}, receptora dos serviços prestados pela CONTRATADA e dos equipamentos fornecidos em comodato.`
      },
      {
        label: "PRODUTOS",
        text: "Equipamentos e materiais cedidos para uso durante a vigência contratual, relacionados no Anexo I deste contrato."
      },
      {
        label: "PREÇO",
        text: `Valor pago pelo CONTRATANTE pelos serviços contratados, sendo ${monitoringMonthly} pelo monitoramento preventivo, ${rentalMonthly} pela locação de equipamentos e ${installationTotal} pela instalação em ${installationInstallments} parcelas.`
      },
      {
        label: "MONITORAMENTO",
        text: `Acompanhamento eletrônico remoto do sistema de alarme instalado no local designado pelo CONTRATANTE através do envio de sinais eletrônicos até a Central de Operações da CONTRATADA por ${text(state.service.communicationMethod) || "rádio, telefonia, dados Ethernet ou rede celular"}, enquanto tais tecnologias estiverem em atividade.`
      },
      {
        label: "CESSÃO EM COMODATO",
        text: "Cessão temporária dos equipamentos descritos no Anexo I, exclusivamente durante o período da prestação de serviços. Encerrado o contrato, o CONTRATANTE deverá devolvê-los nas mesmas condições de uso, ressalvado o desgaste natural."
      },
      {
        label: "LOCAL MONITORADO",
        text: `${monitoredName}${monitoredReference ? ` - ${monitoredReference}` : ""}, localizado em ${monitoredAddress || "endereço não informado"}.`
      },
      {
        label: "CENTRAL DE OPERAÇÕES",
        text: "Base da CONTRATADA em funcionamento durante 24 horas por dia, inclusive domingos e feriados, destinada ao recebimento dos sinais enviados pelo sistema de alarme instalado no local monitorado."
      }
    ],
    clauses: [
      {
        title: "Cláusula Primeira - Objetivo",
        paragraphs: [
          `1.1. O presente contrato tem por objetivo a prestação de serviços de monitoramento à distância de câmeras e alarmes no local monitorado ${monitoredName}${monitoredReference ? ` (${monitoredReference})` : ""}, a cessão de equipamentos da CONTRATADA ao CONTRATANTE, assistência técnica e manutenção desses equipamentos, incluindo ações preventivas com imagens com inteligência artificial e rondas ostensivas esporádicas.`
        ]
      },
      {
        title: "Cláusula Segunda - Forma de Atuação",
        paragraphs: [
          "2.1. A CONTRATADA prestará ao CONTRATANTE o serviço de monitoramento à distância de sistema eletrônico de alarme, consistente na recepção dos sinais instalados no local monitorado e na realização das seguintes ações:",
          "a) informar por telefone ao CONTRATANTE ou às pessoas por ele indicadas sobre qualquer atividade do sistema de alarme incompatível com a normalidade;",
          "b) solicitar o envio de apoio policial ou da própria CONTRATADA para inspeção externa do local monitorado, sempre que observada alguma anormalidade;",
          "c) realizar, de forma esporádica e inopinada, rondas motorizadas ostensivas preventivas;",
          "d) fornecer ao CONTRATANTE cópias das informações gravadas na central de operações caso o alarme seja acionado, observando-se o prazo máximo de armazenamento de 10 (dez) dias após a data do evento.",
          "2.2. O CONTRATANTE declara ciência de sua obrigação de executar corretamente o procedimento de armar e desarmar o sistema de alarme do local monitorado, sob pena de comprometimento dos serviços e não atendimento ao objetivo do presente contrato."
        ]
      },
      {
        title: "Cláusula Terceira - Responsabilidades",
        paragraphs: [
          "3.1. A CONTRATADA não será responsabilizada por furtos, roubos ou danos causados por terceiros, uma vez que os serviços prestados visam minimizar, mas não impedir completamente, tais ocorrências. Sua responsabilidade limita-se à prestação de serviços de monitoramento e à comunicação das ocorrências ao CONTRATANTE e às autoridades competentes, quando cabível.",
          "3.2. A CONTRATADA responsabilizar-se-á pela regular prestação dos serviços, desde que não ocorram casos fortuitos, de força maior ou outros fatos alheios à sua vontade que venham a impossibilitar ou dificultar a regular prestação dos serviços.",
          "3.3. A CONTRATADA não se responsabiliza pelo bom e regular funcionamento das redes de dados do CONTRATANTE ou de outros meios de comunicação utilizados para transmissão de dados. Defeitos, desligamentos propositais, rompimentos de cabos, falta de sinal de banda larga ou demais falhas advindas de empresas terceiras contratadas pelo CONTRATANTE poderão interromper totalmente o recebimento e o envio de sinais de alarme e imagens."
        ]
      },
      {
        title: "Cláusula Quarta - Garantia e Assistência Técnica",
        paragraphs: [
          "4.1. Os equipamentos cedidos serão entregues ao CONTRATANTE devidamente testados e instalados.",
          "4.2. A manutenção corretiva será realizada pela CONTRATADA ou por empresa por ela contratada, no prazo máximo de 48 (quarenta e oito) horas, sempre que solicitada pelo CONTRATANTE, sem ônus durante toda a vigência do contrato.",
          "4.3. Caberá ao CONTRATANTE a realização de testes periódicos no sistema, a título de manutenção preventiva, comprometendo-se a informar à CONTRATADA qualquer anomalia que impeça o perfeito funcionamento.",
          "4.3.1. Os testes consistem em provocar o disparo dos dispositivos sensores, tais como sensores de movimento, abertura de portas e janelas, botões de pânico e proteções perimetrais, sempre com comunicação prévia à CONTRATADA, para evitar deslocamento desnecessário de viaturas.",
          "4.3.2. O CONTRATANTE compromete-se a evitar alarmes falsos ocasionados por disparos indevidos, manuseio incorreto do sistema, falta de manutenção e limpeza, portas e janelas mal fechadas, intrusão de animais, correntes de ar, vegetação próxima a sensores, além de qualquer obstrução física que prejudique o funcionamento do sistema.",
          "4.4. Caso o CONTRATANTE utilize assistência técnica de terceiros para manutenção ou reparo de equipamentos de propriedade da CONTRATADA, fica facultada a rescisão motivada imediata do contrato, sem prejuízo da responsabilização por danos causados.",
          "4.5. Fica expressamente vedado ao CONTRATANTE dar destinação diversa aos produtos fornecidos pela CONTRATADA.",
          "4.6. Caso seja necessária nova instalação dos produtos em razão de reformas, mudanças, alteração de plantas, layout ou adição de pontos, o CONTRATANTE deverá comunicar a CONTRATADA, que poderá apresentar novo orçamento para execução do serviço."
        ]
      },
      {
        title: "Cláusula Quinta - Valores e Pagamentos",
        paragraphs: [
          `5.1. O valor de ${monitoringMonthly} será pago mensalmente pelos serviços de monitoramento preventivo, comprometendo-se o CONTRATANTE a quitar pontualmente o valor ${dueDay}.`,
          `5.1.1. O valor de ${rentalMonthly} será pago mensalmente pela locação de equipamentos, observando o mesmo vencimento pactuado entre as partes.`,
          `5.1.2. O valor de ${installationTotal} será pago pelo serviço de instalação em ${installationInstallments} parcelas iguais, na forma ajustada entre as partes.`,
          `5.2. O CONTRATANTE fará o pagamento por ${text(state.pricing.paymentMethod) || "boletos bancários"}, juntamente com as respectivas notas fiscais.`,
          "5.3. Em caso de atraso, será imputada multa equivalente a 2% (dois por cento) sobre o valor devido, além de correção monetária pelo IPCA ou índice governamental substitutivo, e juros de mora de 1% (um por cento) ao mês, calculados pro rata die.",
          "5.4. Nos casos de inadimplência, a CONTRATADA poderá suspender temporariamente a prestação dos serviços até a efetiva quitação das respectivas faturas em aberto.",
          "5.5. Persistindo a inadimplência por período superior a 02 (dois) meses, a CONTRATADA poderá considerar rescindido o presente instrumento, sem prejuízo da cobrança dos valores em aberto.",
          "5.6. O valor cobrado pelo monitoramento será corrigido a cada 12 (doze) meses, a contar da data de início efetivo da prestação dos serviços, pela variação do IPCA ou índice que venha a substituí-lo."
        ]
      },
      {
        title: "Cláusula Sexta - Danos aos Equipamentos",
        paragraphs: [
          "6.1. Em caso de rescisão do presente compromisso, o CONTRATANTE obriga-se a restituir os equipamentos cedidos em comodato nas mesmas condições em que os recebeu, ressalvado o desgaste natural pelo uso contínuo.",
          "6.2. Findo o contrato, por qualquer razão, e não havendo a devolução dos equipamentos em comodato, fica a CONTRATADA autorizada a emitir cobrança pelos valores atualizados dos equipamentos, considerando depreciação de 10% (dez por cento) ao ano.",
          "6.3. O CONTRATANTE deverá zelar pela boa manutenção dos equipamentos cedidos. Se verificado dano causado por dolo ou culpa do CONTRATANTE ou de seus prepostos, este arcará com as despesas de conserto ou substituição."
        ]
      },
      {
        title: "Cláusula Sétima - Sigilo e Confidencialidade",
        paragraphs: [
          "7.1. A CONTRATADA obriga-se a manter sigilo sobre quaisquer informações confidenciais da CONTRATANTE, mesmo após o término do contrato, pelo prazo de 02 (dois) anos. Quaisquer violações desta cláusula serão consideradas infrações contratuais graves."
        ]
      },
      {
        title: "Cláusula Oitava - Vigência Contratual",
        paragraphs: [
          `8.1. O presente instrumento vigorará por prazo determinado de ${text(state.contract.durationMonths) || "24"} (vinte e quatro) meses, tendo como data de início ${formatDate(state.contract.startDate)} e término ${formatDate(state.contract.endDate)}, podendo ser rescindido a qualquer tempo mediante pagamento de multa correspondente a 50% do valor remanescente do contrato e notificação por escrito com antecedência mínima de 30 (trinta) dias.`,
          isPalm17Contract()
            ? "8.2. O presente instrumento terá sua vigência encerrada ao término do prazo estabelecido, não havendo renovação automática. A CONTRATADA compromete-se a notificar a CONTRATANTE, por escrito, com antecedência mínima de 30 (trinta) dias do término do contrato, para que esta manifeste formalmente seu interesse na renovação, que, se acordada entre as partes, ocorrerá por igual período e nas mesmas condições."
            : "8.2. O presente instrumento será automaticamente renovado por igual período e condições, caso não haja manifestação em sentido contrário, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias."
        ]
      },
      {
        title: "Cláusula Nona - Rescisão Contratual",
        paragraphs: [
          "9.1. A CONTRATADA considerará justo motivo para rescindir o presente contrato, independentemente de prévia notificação, a hipótese de inadimplência da CONTRATANTE relativa ao faturamento dos serviços contratados por período superior a 15 (quinze) dias. Nessa hipótese, a CONTRATADA poderá retirar imediatamente empregados, materiais e equipamentos de sua propriedade.",
          "9.2. Qualquer das partes poderá rescindir imediatamente o presente contrato, independente de prévia notificação, nos casos de decretação de falência, pedido de recuperação judicial, infração contratual não sanada no prazo de 07 (sete) dias após notificação ou inadimplência conforme previsto neste instrumento.",
          "9.2.1. Ocorrendo qualquer dessas hipóteses, a parte infratora ficará sujeita ao pagamento de multa equivalente a 01 (uma) vez o valor da última nota fiscal de serviços."
        ]
      },
      {
        title: "Cláusula Décima - Disposições Gerais e Finais",
        paragraphs: [
          "10.1. Qualquer alteração neste contrato somente terá validade se formalizada por escrito e assinada por ambas as partes.",
          "10.2. O presente contrato não poderá ser transferido a terceiros sem a expressa e prévia anuência das partes.",
          "10.3. Todos os entendimentos anteriores relacionados ao presente contrato e não incorporados neste instrumento não serão considerados para fins de interpretação.",
          "10.4. Caso qualquer cláusula ou condição venha a ser considerada inválida ou inexequível, tal fato não afetará as demais cláusulas e condições.",
          "10.5. A tolerância das partes quanto ao cumprimento das obrigações contratuais não constituirá novação, renúncia ou modificação do pactuado.",
          "10.6. O presente contrato é de natureza estritamente civil, inexistindo vínculo empregatício entre uma das partes e os sócios, funcionários, contratados ou prepostos da outra.",
          "10.7. As partes declaram que se obrigam de boa-fé, inexistindo vícios de consentimento, dolo, erro, simulação, violência ou qualquer coação a macular o pactuado.",
          "10.8. As partes declaram que o presente contrato constitui título executivo extrajudicial, podendo ser promovida sua execução em caso de inadimplência.",
          "10.9. O presente contrato obriga as partes por si e seus sucessores a qualquer título em todos os seus termos.",
          `10.10. As partes elegem o Foro Central da Comarca de ${text(state.contract.issueCity) || TKA_PROFILE.city}, Estado de São Paulo, para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, com renúncia a qualquer outro por mais privilegiado que seja.`
        ]
      }
    ],
    equipment,
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
      <h3>Anexo I - Relação de Equipamentos Comodatados e Instalados</h3>
      <table class="annex-table">
        <thead>
          <tr>
            <th>QTD</th>
            <th>Descrição do Produto</th>
            <th>Local Instalação</th>
            <th>Valor</th>
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
              <td colspan="4">Nenhum equipamento informado.</td>
            </tr>
          `}
        </tbody>
      </table>
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

async function loadOwnerSignature() {
  ownerSignatureDataUrl = "";
  if (!firebaseDb) return false;
  try {
    const snapshot = await firebaseDb.collection("system").doc("ownerSignature").get();
    const data = snapshot.data() || {};
    ownerSignatureDataUrl = text(data.signatureDataUrl);
    return Boolean(ownerSignatureDataUrl);
  } catch (error) {
    console.warn("Falha ao carregar assinatura do proprietario.", error);
    ownerSignatureDataUrl = "";
    return false;
  }
}

function sanitizeRecordForCloud() {
  syncStaticFields();
  if (!state.meta) state.meta = {};
  return {
    contractId: state.meta.contractId || "",
    source: "commercial-contract-editor",
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
    elements.exportStatus.textContent = "Preencha o local monitorado antes de gerar o PDF.";
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
    queueSave("Alteracoes contratuais pendentes...");
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
  elements.equipmentCount.textContent = countLabel(state.equipment.filter(equipmentFilled).length || state.equipment.length, "equipamento", "equipamentos");
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
      loadAssetAsDataUrl("/comercial/contratos/assets/TKA-logo.jpeg"),
      loadAssetAsDataUrl("/comercial/contratos/assets/letterhead.png")
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
      doc.text("Contrato - Monitoramento TKA", 555, 52, { align: "right" });
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
      ensureSpace(300);
      drawFieldGrid([
        { label: "Nome Completo", value: state.sign.signerName || state.contractor.representativeName || "" },
        { label: "Data", value: formatDate(state.sign.date || state.contract.issueDate) },
        { label: "Cidade", value: state.sign.city || state.contract.issueCity || TKA_PROFILE.city },
        { label: "Data de Nascimento", value: formatDate(state.sign.birthDate) },
        { label: "CPF", value: state.sign.cpf || state.contractor.representativeCpf || "" }
      ]);

      ensureSpace(124);
      const signatureY = context.cursorY + 4;
      const gap = 14;
      const signatureWidth = (PAGE.width - PAGE.left - PAGE.right - gap) / 2;
      const signatureHeight = 98;

      function drawSignedCard(label, name, dataUrl, x) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(210, 192, 186);
        doc.roundedRect(x, signatureY, signatureWidth, signatureHeight, 8, 8, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(139, 42, 33);
        doc.text(label, x + 10, signatureY + 12);

        if (dataUrl) {
          doc.addImage(dataUrl, "PNG", x + 12, signatureY + 20, signatureWidth - 24, 48);
        } else {
          doc.setDrawColor(185, 169, 163);
          doc.line(x + 14, signatureY + 58, x + signatureWidth - 14, signatureY + 58);
        }

        doc.setDrawColor(185, 169, 163);
        doc.line(x + 14, signatureY + 70, x + signatureWidth - 14, signatureY + 70);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(47, 36, 31);
        doc.text(String(name || "Assinatura").slice(0, 70), x + signatureWidth / 2, signatureY + 84, {
          align: "center",
          maxWidth: signatureWidth - 24
        });
      }

      drawSignedCard(
        "ASSINATURA DO CONTRATANTE",
        state.sign.signerName || state.contractor.representativeName || contractorName(),
        state.sign.signatureDataUrl,
        PAGE.left
      );
      drawSignedCard(
        "ASSINATURA DA CONTRATADA",
        TKA_PROFILE.representativeName,
        ownerSignatureDataUrl,
        PAGE.left + signatureWidth + gap
      );

      context.cursorY = signatureY + signatureHeight + 18;
    }

    context.drawPageFrame = drawPageFrame;
    context.drawSectionTitle = drawSectionTitle;

    drawPageFrame();
    drawSectionTitle("Resumo de Monitoramento");
    drawFieldGrid([
      { label: "Código", value: state.contract.contractCode || "Não informado" },
      { label: "Vigência", value: contractPeriodLine() },
      { label: "Contratante", value: contractorName() },
      { label: "CNPJ", value: state.contractor.cnpj || "Não informado" },
      { label: "Local monitorado", value: state.service.monitoredLocationName || state.service.monitoredReference || "Não informado" },
      { label: "Endereço", value: monitoredLocationLine() || "Não informado" },
      { label: "Monitoramento", value: formatMoney(state.pricing.monitoringMonthly) },
      { label: "Locação", value: formatMoney(state.pricing.equipmentRentalMonthly) }
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

    drawSectionTitle("Anexo I - Relação de Equipamentos");
    if (content.equipment.length) {
      drawPdfTable(doc, [
        { label: "QTD", width: 64 },
        { label: "Descrição do Produto", width: 240 },
        { label: "Local Instalação", width: 148 },
        { label: "Valor", width: 59.28 }
      ], content.equipment.map((item) => [
        item.quantity,
        item.description,
        item.location,
        formatMoney(item.value)
      ]), context);
    } else {
      drawParagraph("Nenhum equipamento informado no anexo.");
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
        title: "Contrato - Monitoramento TKA",
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
  const url = new URL("/comercial/contratos/editor.html", window.location.origin);
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
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  await loadOwnerSignature();
  const loaded = await loadContractFromCloud();
  renderAll();
  if (loaded) {
    consumeImportNotice();
    updateSaveStatus("Contrato de monitoramento carregado e pronto para edição.");
    return;
  }
  if (requestedId) {
    elements.exportStatus.textContent = "Contrato não encontrado na base de monitoramento. Um modelo novo foi aberto.";
  }
  updateSaveStatus("Modelo de monitoramento pronto para preenchimento.");
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
