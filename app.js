const PORTAL_SESSION_KEY = "portal_gate_email";
const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
const PORTAL_THEME_KEY = "tka_theme";
const PORTAL_PERSIST_KEY = "portal_gate_email_persist";
const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
const ADMIN_EMAIL = "comercial@grupotka.com.br";
const SYSTEM_COLLECTION = "system";
const PLANTAO_OPERATORS_DOC = "shiftReportOperators";
const COMMERCIAL_REFRESH_MS = 5 * 60 * 1000;
const PORTAL_THEMES = [
  { id: "light", label: "Tema claro" },
  { id: "dark", label: "Tema escuro" }
];
const PORTAL_THEME_IDS = new Set(PORTAL_THEMES.map(theme => theme.id));
const PERMISSION_LABELS = {
  rh: "RH",
  monitoramento: "Monitoramento",
  operacional: "Operacional",
  estrutural: "Gerencia / Financeiro",
  logs: "Logs",
  admin: "Admin"
};
const SYSTEM_CARDS = [
  {
    id: "rh",
    title: "Recursos Humanos",
    subtitle: "Gestao de escalas, FT e acompanhamento diario.",
    description: "Central RH com cadastro interno, dashboard, FT, historico de alteracoes e Documentacao do colaborador.",
    links: [
      { label: "Painel RH", href: "/recursos-humanos/" },
      { label: "WhatsApp RH", href: "/whatsappRH/" },
      { label: "Documentacao", href: "/recursos-humanos/?tab=documentacao" },
      { label: "Ficha Admissao", href: "/recursos-humanos/admissao/" },
      { label: "Contratos RH", href: "/recursos-humanos/contrato/" },
      { label: "Ordem de Servico", href: "/recursos-humanos/ordem-servico/" }
    ]
  },
  {
    id: "monitoramento",
    title: "Monitoramento",
    subtitle: "Cadastro de clientes, centrais e imagens do monitoramento.",
    description: "Acesso aos cadastros administrativos do monitoramento remoto.",
    links: [
      { label: "WhatsApp Monitoramento", href: "/whatsappmonitoramento/" },
      { label: "Postos TKA", href: "/monitoramento/postos/" },
      { label: "Clientes", href: "/monitoramento/clientes/" },
      { label: "Cameras e DVRs", href: "/monitoramento/imagens/" },
      { label: "Relatorio de Plantao", href: "/monitoramento/plantao/" }
    ]
  },
  {
    id: "operacional",
    title: "Operacional",
    subtitle: "Documentos internos e rotinas operacionais.",
    description: "Central de documentos operacionais com controle interno e exportacao em PDF.",
    links: [
      { label: "Permuta", href: "/operacional/permuta/" },
      { label: "Inventario", href: "/operacional/inventario/" },
      { label: "Body Cam", href: "/operacional/inventario/body-cam/" }
    ]
  },
  {
    id: "estrutural",
    title: "Gerencia / Financeiro",
    subtitle: "Contratos, financeiro e rotinas de gestao.",
    description: "Espaco administrativo para contratos de monitoramento, trabalho intermitente, anexos de equipamentos e controle documental.",
    links: [
      { label: "Contratos - Monitoramento", href: "/comercial/contratos/" },
      { label: "Contrato - Intermitente", href: "/comercial/contratos-intermitente/" },
      { label: "Contratos - Servicos Gerais", href: "/comercial/contratos-servicos-gerais/" },
      { label: "Contratos - Servicos Especializados", href: "/comercial/contratos-servicos-especializados/" },
      { label: "TKA Workflows", href: "/tka-workflows/" }
    ]
  }
];
const COMMERCIAL_COLLECTIONS = [
  {
    id: "monitoramento",
    label: "Monitoramento",
    collection: "commercial_contracts",
    href: "/comercial/contratos/",
    monthlyFields: ["monitoringMonthly", "equipmentRentalMonthly"]
  },
  {
    id: "intermitente",
    label: "Intermitente",
    collection: "commercial_intermittent_contracts",
    href: "/comercial/contratos-intermitente/",
    monthlyFields: []
  },
  {
    id: "servicos-gerais",
    label: "Servicos Gerais",
    collection: "commercial_general_service_contracts",
    href: "/comercial/contratos-servicos-gerais/",
    monthlyFields: ["monitoringMonthly"]
  },
  {
    id: "servicos-especializados",
    label: "Servicos Especializados",
    collection: "commercial_specialized_service_contracts",
    href: "/comercial/contratos-servicos-especializados/",
    monthlyFields: ["monitoringMonthly"]
  }
];
const LOGIN_AREAS = {
  rh: {
    title: "Recursos humanos",
    subtitle: "Cadastros, contratos, documentacao e ordens de servico."
  },
  monitoramento: {
    title: "Monitoramento remoto",
    subtitle: "Clientes, cameras, plantao e rotinas do monitoramento."
  },
  operacional: {
    title: "Operacao",
    subtitle: "Permuta, inventario e controles operacionais."
  },
  financeiro: {
    title: "Gerencia / Financeiro",
    subtitle: "Gestao, contratos e acompanhamento administrativo."
  }
};
const PUBLIC_LINK_SYSTEMS = [
  {
    id: "rh-admissao",
    label: "RH - Ficha Admissao",
    permission: "rh",
    description: "Link publico para o colaborador preencher uma nova ficha de admissao.",
    type: "static",
    href: "/recursos-humanos/admissao/editor.html"
  },
  {
    id: "rh-ordem-servico",
    label: "RH - Ordem de Servico",
    permission: "rh",
    description: "Cria uma ordem de servico e devolve o link publico para o colaborador assinar.",
    type: "rh-service-order"
  },
  {
    id: "monitoramento-clientes",
    label: "Monitoramento - Clientes",
    permission: "monitoramento",
    description: "Link publico para o cliente enviar um novo cadastro de monitoramento.",
    type: "static",
    href: "https://cadastro-clientes-tka.web.app/"
  },
  {
    id: "monitoramento-imagens",
    label: "Monitoramento - Cameras e DVRs",
    permission: "monitoramento",
    description: "Link para novo cadastro de cameras, DVRs e acessos remotos.",
    type: "static",
    href: "/monitoramento/imagens/?new=1"
  },
  {
    id: "monitoramento-plantao",
    label: "Monitoramento - Relatorio de Plantao",
    permission: "monitoramento",
    description: "Link publico para operador acessar e criar um relatorio de plantao.",
    type: "static",
    href: "/monitoramento/plantao/editor.html?publico=1"
  },
  {
    id: "operacional-permuta",
    label: "Operacional - Permuta",
    permission: "operacional",
    description: "Link publico para preencher e assinar uma nova permuta.",
    type: "static",
    href: "/operacional/permuta/editor.html?public=1"
  },
  {
    id: "operacional-body-cam-termo",
    label: "Operacional - Inventario Body Cam",
    permission: "operacional",
    description: "Abre o painel Body Cam para selecionar o equipamento e gerar o link publico do termo.",
    type: "static",
    href: "/operacional/inventario/body-cam/"
  },
  {
    id: "comercial-contratos-monitoramento",
    label: "Comercial - Contratos de Monitoramento",
    permission: "estrutural",
    description: "Cria um rascunho de contrato de monitoramento e devolve o link publico de edicao.",
    type: "commercial-contract",
    collection: "commercial_contracts",
    editorPath: "/comercial/contratos/editor.html",
    source: "commercial-contract-public-link",
    codePrefix: "PUBLIC"
  },
  {
    id: "comercial-contratos-intermitente",
    label: "Comercial - Contrato Intermitente",
    permission: "estrutural",
    description: "Cria um rascunho de contrato intermitente e devolve o link publico do empregado.",
    type: "commercial-contract",
    collection: "commercial_intermittent_contracts",
    editorPath: "/comercial/contratos-intermitente/editor.html",
    source: "intermittent-contract-public-link",
    codePrefix: "INTER",
    variant: "intermittent"
  },
  {
    id: "comercial-contratos-servicos-gerais",
    label: "Comercial - Servicos Gerais",
    permission: "estrutural",
    description: "Cria um rascunho de contrato de servicos gerais e devolve o link publico de edicao.",
    type: "commercial-contract",
    collection: "commercial_general_service_contracts",
    editorPath: "/comercial/contratos-servicos-gerais/editor.html",
    source: "general-service-contract-public-link",
    codePrefix: "GERAIS"
  },
  {
    id: "comercial-contratos-servicos-especializados",
    label: "Comercial - Servicos Especializados",
    permission: "estrutural",
    description: "Cria um rascunho de contrato de servicos especializados e devolve o link publico de edicao.",
    type: "commercial-contract",
    collection: "commercial_specialized_service_contracts",
    editorPath: "/comercial/contratos-servicos-especializados/editor.html",
    source: "specialized-service-contract-public-link",
    codePrefix: "ESPEC"
  }
];
const DEFAULT_PLANTAO_OPERATORS = {
  "operador.henrique": {
    fullName: "Henrique",
    passwordHash: {
      algorithm: "PBKDF2-SHA256",
      iterations: 210000,
      salt: "HVkzmBaZVkROXlxn8upsRQ==",
      hash: "LmdX3J1vNLp8GJywVskmGATKBV7owZ6EMs4IlcMdWm8="
    }
  },
  "operador.lucas": {
    fullName: "Lucas",
    passwordHash: {
      algorithm: "PBKDF2-SHA256",
      iterations: 210000,
      salt: "gdH1WPxS/UsgEvcQqS9afQ==",
      hash: "LBWSu7VnFxXJpJaiU1zp/EU56Xv0UinnVTXTzi91nG8="
    }
  },
  "operador.paula": {
    fullName: "Paula",
    passwordHash: {
      algorithm: "PBKDF2-SHA256",
      iterations: 210000,
      salt: "/bDtzKY6kk0KfhlYGRI5Kw==",
      hash: "CVsyomd2evwknDxIw2pGkR0RQuCSsOgmHGrM+uWxC1g="
    }
  },
  "operador.waldir": {
    fullName: "Waldir",
    passwordHash: {
      algorithm: "PBKDF2-SHA256",
      iterations: 210000,
      salt: "nJsAa0JKN1SynEjlL/DeKQ==",
      hash: "XjtESqtFHmvyRo+zOoMe1+GoMqTeOtwX3TfDa8CME0g="
    }
  }
};

const state = {
  currentUser: null,
  selectedLoginArea: null,
  gateUsers: {},
  plantaoOperators: {},
  plantaoOperatorsLoaded: false,
  plantaoOperatorError: "",
  auditLogs: [],
  commercialSituation: {
    loading: false,
    error: "",
    lastLoadedAt: null,
    collections: [],
    records: [],
    totals: null,
    filters: {
      view: "executive",
      collectionId: "all",
      issue: "all"
    }
  },
  ownerSignature: {
    signatureDataUrl: "",
    updatedAt: null
  }
};
let remoteDataWarning = "";
let commercialRefreshTimer = null;

const el = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  areaSelectionPanel: document.getElementById("areaSelectionPanel"),
  credentialsPanel: document.getElementById("credentialsPanel"),
  backToAreasBtn: document.getElementById("backToAreasBtn"),
  loginAreaTitle: document.getElementById("loginAreaTitle"),
  loginAreaSubtitle: document.getElementById("loginAreaSubtitle"),
  portalAreaButtons: document.querySelectorAll("[data-login-area]"),
  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  loginError: document.getElementById("loginError"),
  welcomeUser: document.getElementById("welcomeUser"),
  saveStatus: document.getElementById("saveStatus"),
  themeSelect: document.getElementById("themeSelect"),
  systemsGrid: document.getElementById("systemsGrid"),
  commercialTabButton: document.getElementById("commercialTabButton"),
  commercialKpis: document.getElementById("commercialKpis"),
  commercialStatus: document.getElementById("commercialStatus"),
  commercialUpdatedAt: document.getElementById("commercialUpdatedAt"),
  refreshCommercialBtn: document.getElementById("refreshCommercialBtn"),
  commercialViewSelect: document.getElementById("commercialViewSelect"),
  commercialCollectionFilter: document.getElementById("commercialCollectionFilter"),
  commercialIssueFilter: document.getElementById("commercialIssueFilter"),
  commercialVisuals: document.getElementById("commercialVisuals"),
  commercialCollectionList: document.getElementById("commercialCollectionList"),
  commercialDueList: document.getElementById("commercialDueList"),
  commercialIssuesList: document.getElementById("commercialIssuesList"),
  commercialClientList: document.getElementById("commercialClientList"),
  linkForm: document.getElementById("linkForm"),
  linkSystemSelect: document.getElementById("linkSystemSelect"),
  linkSystemDescription: document.getElementById("linkSystemDescription"),
  createLinkBtn: document.getElementById("createLinkBtn"),
  linkResult: document.getElementById("linkResult"),
  linkResultTitle: document.getElementById("linkResultTitle"),
  linkResultMeta: document.getElementById("linkResultMeta"),
  linkOutput: document.getElementById("linkOutput"),
  copyCreatedLinkBtn: document.getElementById("copyCreatedLinkBtn"),
  openCreatedLinkBtn: document.getElementById("openCreatedLinkBtn"),
  linkStatus: document.getElementById("linkStatus"),
  adminTabButton: document.getElementById("adminTabButton"),
  userForm: document.getElementById("userForm"),
  userEmail: document.getElementById("userEmail"),
  userPassword: document.getElementById("userPassword"),
  userSector: document.getElementById("userSector"),
  permRh: document.getElementById("permRh"),
  permMonitoramento: document.getElementById("permMonitoramento"),
  permOperacional: document.getElementById("permOperacional"),
  permEstrutural: document.getElementById("permEstrutural"),
  permLogs: document.getElementById("permLogs"),
  permAdmin: document.getElementById("permAdmin"),
  userList: document.getElementById("userList"),
  permissionList: document.getElementById("permissionList"),
  plantaoOperatorForm: document.getElementById("plantaoOperatorForm"),
  plantaoOperatorUsername: document.getElementById("plantaoOperatorUsername"),
  plantaoOperatorFullName: document.getElementById("plantaoOperatorFullName"),
  plantaoOperatorPassword: document.getElementById("plantaoOperatorPassword"),
  plantaoOperatorCancelBtn: document.getElementById("plantaoOperatorCancelBtn"),
  plantaoOperatorList: document.getElementById("plantaoOperatorList"),
  sharedAuditLogList: document.getElementById("sharedAuditLogList"),
  auditLogList: document.getElementById("auditLogList"),
  ownerSignaturePreview: document.getElementById("ownerSignaturePreview"),
  ownerSignatureEmpty: document.getElementById("ownerSignatureEmpty"),
  ownerSignatureMeta: document.getElementById("ownerSignatureMeta"),
  ownerSignatureEditBtn: document.getElementById("ownerSignatureEditBtn"),
  ownerSignatureEditor: document.getElementById("ownerSignatureEditor"),
  ownerSignatureCanvas: document.getElementById("ownerSignatureCanvas"),
  ownerSignatureClearBtn: document.getElementById("ownerSignatureClearBtn"),
  ownerSignatureCancelBtn: document.getElementById("ownerSignatureCancelBtn"),
  ownerSignatureSaveBtn: document.getElementById("ownerSignatureSaveBtn"),
  logoutBtn: document.getElementById("logoutBtn")
};

const ownerSignaturePad = window.TKASignatureTools.createSignaturePad({
  canvas: el.ownerSignatureCanvas,
  enabled: false,
  placeholder: "Assine e depois clique em Salvar assinatura"
});

function setStatus(text) {
  el.saveStatus.textContent = text;
}

function normalizeTheme(theme) {
  return PORTAL_THEME_IDS.has(theme) ? theme : "light";
}

function renderThemeOptions() {
  if (!el.themeSelect) return;
  el.themeSelect.innerHTML = "";
  PORTAL_THEMES.forEach(theme => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    el.themeSelect.appendChild(option);
  });
}

function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  document.body.dataset.theme = nextTheme;
  if (el.themeSelect) el.themeSelect.value = nextTheme;
  localStorage.setItem(PORTAL_THEME_KEY, nextTheme);
}

function setActiveTab(tabId) {
  let nextTabId = tabId || "systems";
  if (nextTabId === "commercial" && !canViewCommercialSituation()) nextTabId = "systems";
  if (nextTabId === "admin" && !isAdmin()) nextTabId = "systems";
  document.querySelectorAll(".tab-btn").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === nextTabId);
  });
  document.querySelectorAll(".tab").forEach(item => {
    item.classList.toggle("active", item.id === `tab-${nextTabId}`);
  });
  const url = new URL(window.location.href);
  url.searchParams.set("tab", nextTabId);
  window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
}

function requestedTab() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("tab") || window.location.hash.replace(/^#/, "");
  const knownTabs = new Set(["systems", "commercial", "links", "logs", "admin"]);
  return knownTabs.has(requested) ? requested : "systems";
}

function showAreaSelection() {
  state.selectedLoginArea = null;
  el.areaSelectionPanel.classList.remove("hidden");
  el.credentialsPanel.classList.add("hidden");
  el.loginError.textContent = "";
  el.loginView.dataset.step = "areas";
}

function showCredentialLogin(areaId) {
  const area = LOGIN_AREAS[areaId] || LOGIN_AREAS.rh;
  state.selectedLoginArea = areaId;
  el.loginAreaTitle.textContent = area.title;
  el.loginAreaSubtitle.textContent = area.subtitle;
  el.loginError.textContent = "";
  el.areaSelectionPanel.classList.add("hidden");
  el.credentialsPanel.classList.remove("hidden");
  el.loginView.dataset.step = "credentials";
  window.requestAnimationFrame(() => el.loginUser.focus());
}

function showLogin(options = {}) {
  el.loginView.classList.remove("hidden");
  el.appView.classList.add("hidden");
  if (!options.keepCredentials) showAreaSelection();
}

function showApp() {
  el.loginView.classList.add("hidden");
  el.appView.classList.remove("hidden");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readStoredJson(...keys) {
  for (const key of keys) {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

function initializeFirebase() {
  const config = window.RH_FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId) {
    el.loginError.textContent = "Preencha a configuracao do Firebase para liberar o portal.";
    return null;
  }
  if (!firebase.apps.length) firebase.initializeApp(config);
  return firebase.firestore();
}

const db = initializeFirebase();

function isAdmin() {
  return Boolean(state.currentUser?.permissions?.admin);
}

function canViewCommercialSituation() {
  return normalizeEmail(state.currentUser?.email) === ADMIN_EMAIL;
}

function defaultPermissions() {
  return {
    rh: false,
    monitoramento: false,
    operacional: false,
    estrutural: false,
    logs: false,
    admin: false
  };
}

function normalizePasswordHash(value) {
  if (!value || typeof value !== "object") return null;
  const algorithm = String(value.algorithm || "PBKDF2-SHA256").toUpperCase();
  const iterations = Number(value.iterations || 0);
  const salt = String(value.salt || "");
  const hash = String(value.hash || "");
  if (algorithm !== "PBKDF2-SHA256" || !iterations || !salt || !hash) return null;
  return { algorithm, iterations, salt, hash };
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function derivePasswordHash(password, config) {
  if (!window.crypto?.subtle) throw new Error("Criptografia do navegador indisponivel.");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(config.salt),
      iterations: config.iterations
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function createPasswordHash(password) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const config = {
    algorithm: "PBKDF2-SHA256",
    iterations: 210000,
    salt: bytesToBase64(saltBytes),
    hash: ""
  };
  config.hash = await derivePasswordHash(password, config);
  return config;
}

async function verifyPassword(account, password) {
  const hashConfig = normalizePasswordHash(account?.passwordHash);
  if (hashConfig) {
    const actual = await derivePasswordHash(password, hashConfig);
    return actual === hashConfig.hash;
  }
  return Boolean(account?.legacyPassword && account.legacyPassword === password);
}

function serializeGateUserForStorage(config) {
  const passwordHash = normalizePasswordHash(config?.passwordHash);
  return {
    passwordHash,
    sector: config?.sector || "rh",
    permissions: { ...defaultPermissions(), ...(config?.permissions || {}) }
  };
}

function serializeGateUsersForStorage(users) {
  return Object.fromEntries(
    Object.entries(users || {}).map(([email, config]) => [email, serializeGateUserForStorage(config)])
  );
}

function redactGateUserForAudit(config) {
  if (!config) return null;
  return {
    sector: config.sector || "rh",
    permissions: { ...defaultPermissions(), ...(config.permissions || {}) },
    passwordStorage: normalizePasswordHash(config.passwordHash) ? "hash" : config.legacyPassword ? "legacy-plaintext-redacted" : "missing"
  };
}

function normalizeUsers(source) {
  const normalized = {};
  Object.entries(source || {}).forEach(([email, value]) => {
    if (typeof value === "string") {
      normalized[email] = { legacyPassword: value, passwordHash: null, sector: "rh", permissions: { ...defaultPermissions(), logs: true } };
      normalized[email].permissions.rh = true;
      return;
    }
    const incomingPermissions = { ...(value.permissions || {}) };
    normalized[email] = {
      legacyPassword: typeof value.password === "string" ? value.password : "",
      passwordHash: normalizePasswordHash(value.passwordHash),
      sector: value.sector || "rh",
      permissions: {
        ...defaultPermissions(),
        ...incomingPermissions,
        logs: incomingPermissions.logs !== undefined ? Boolean(incomingPermissions.logs) : true
      }
    };
  });
  return normalized;
}

function normalizePlantaoOperatorUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function isValidPlantaoOperatorUsername(value) {
  return /^[a-z0-9._-]+$/.test(value);
}

function normalizePlantaoOperators(source) {
  const normalized = {};
  Object.entries(source || {}).forEach(([username, value]) => {
    const key = normalizePlantaoOperatorUsername(username);
    if (!key) return;
    normalized[key] = {
      fullName: String(value?.fullName || key).trim(),
      passwordHash: normalizePasswordHash(value?.passwordHash),
      legacyPassword: typeof value?.password === "string" ? value.password : ""
    };
  });
  return normalized;
}

function serializePlantaoOperatorsForStorage(accounts) {
  return Object.fromEntries(Object.entries(accounts || {}).map(([username, account]) => [
    normalizePlantaoOperatorUsername(username),
    {
      fullName: String(account?.fullName || username).trim(),
      passwordHash: normalizePasswordHash(account?.passwordHash)
    }
  ]).filter(([username, account]) => username && account.fullName));
}

function redactPlantaoOperatorForAudit(account) {
  if (!account) return null;
  return {
    fullName: account.fullName || "",
    passwordStorage: normalizePasswordHash(account.passwordHash) ? "hash" : account.legacyPassword ? "legacy-plaintext-redacted" : "missing"
  };
}

function plantaoOperatorPublicLink(username) {
  const url = new URL("/monitoramento/plantao/operador.html", window.location.origin);
  url.searchParams.set("usuario", username);
  url.searchParams.set("publico", "1");
  return `${url.pathname}${url.search}`;
}

function mergeGateUsersWithDefaults(source) {
  return {
    ...normalizeUsers(window.PORTAL_GATE?.users || {}),
    ...normalizeUsers(source || {})
  };
}

function useDefaultGateUsers() {
  state.gateUsers = mergeGateUsersWithDefaults(state.gateUsers);
}

async function migratePlaintextGateUsersIfNeeded() {
  if (!db) return;
  const migratedUsers = {};
  let changed = false;
  for (const [email, config] of Object.entries(state.gateUsers)) {
    migratedUsers[email] = { ...config };
    if (!normalizePasswordHash(config.passwordHash) && config.legacyPassword) {
      migratedUsers[email].passwordHash = await createPasswordHash(config.legacyPassword);
      delete migratedUsers[email].legacyPassword;
      changed = true;
    }
  }
  if (!changed) return;
  const storageUsers = serializeGateUsersForStorage(migratedUsers);
  await db.collection("system").doc("portalGate").set({
    users: storageUsers,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  state.gateUsers = normalizeUsers(storageUsers);
}

function rememberRemoteDataWarning(context, error) {
  const message = error?.message || String(error || "erro desconhecido");
  remoteDataWarning = `${context}: ${message}`;
  console.warn(`Firebase indisponivel em ${context}:`, error);
}

async function refreshRemotePortalData() {
  if (!db) return;

  try {
    await loadGateUsers();
  } catch (error) {
    useDefaultGateUsers();
    rememberRemoteDataWarning("usuarios do portal", error);
  }

  try {
    await loadOwnerSignature();
  } catch (error) {
    rememberRemoteDataWarning("assinatura da direcao", error);
  }

  if (isAdmin()) {
    try {
      await loadPlantaoOperators();
    } catch (error) {
      state.plantaoOperatorsLoaded = true;
      state.plantaoOperatorError = error?.message || "Falha ao carregar operadores do plantao.";
      rememberRemoteDataWarning("operadores do plantao", error);
    }
  }

  renderOwnerSignature();
  if (state.currentUser) renderAll();
}

async function refreshAuditLogs() {
  try {
    await loadAuditLogs();
  } catch (error) {
    state.auditLogs = [];
    rememberRemoteDataWarning("logs do portal", error);
  }
  renderAuditLogs();
  if (isAdmin()) renderAdmin();
}

async function ensurePortalGateSeed() {
  const docRef = db.collection("system").doc("portalGate");
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(docRef);
    const defaultUsers = normalizeUsers(window.PORTAL_GATE?.users || {});
    if (snapshot.exists) {
      const currentData = snapshot.data() || {};
      const currentRawUsers = currentData.users || {};
      const currentUsers = normalizeUsers(currentRawUsers);
      const missingDefaultUsers = {};
      Object.entries(defaultUsers).forEach(([email, config]) => {
        if (currentUsers[email]) return;
        missingDefaultUsers[email] = config;
      });
      if (!Object.keys(missingDefaultUsers).length) return;
      tx.set(docRef, {
        users: {
          ...currentRawUsers,
          ...serializeGateUsersForStorage(missingDefaultUsers)
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }
    tx.set(docRef, {
      users: serializeGateUsersForStorage(defaultUsers),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function loadGateUsers() {
  const snapshot = await db.collection(SYSTEM_COLLECTION).doc("portalGate").get();
  const data = snapshot.data() || {};
  state.gateUsers = mergeGateUsersWithDefaults(data.users || {});
  await migratePlaintextGateUsersIfNeeded();
}

async function migratePlaintextPlantaoOperatorsIfNeeded() {
  if (!db) return;
  const migratedOperators = {};
  let changed = false;
  for (const [username, account] of Object.entries(state.plantaoOperators)) {
    migratedOperators[username] = { ...account };
    if (!normalizePasswordHash(account.passwordHash) && account.legacyPassword) {
      migratedOperators[username].passwordHash = await createPasswordHash(account.legacyPassword);
      delete migratedOperators[username].legacyPassword;
      changed = true;
    }
  }
  if (!changed) return;
  const storageOperators = serializePlantaoOperatorsForStorage(migratedOperators);
  await plantaoOperatorsDocRef().set({
    accounts: storageOperators,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  state.plantaoOperators = normalizePlantaoOperators(storageOperators);
}

function plantaoOperatorsDocRef() {
  return db.collection(SYSTEM_COLLECTION).doc(PLANTAO_OPERATORS_DOC);
}

async function getPlantaoOperatorsSnapshot(options = {}) {
  const docRef = plantaoOperatorsDocRef();
  try {
    return await docRef.get({ source: "server" });
  } catch (error) {
    if (options.allowCacheFallback === false) {
      throw error;
    }
    rememberRemoteDataWarning("operadores do plantao", error);
    return docRef.get();
  }
}

function samePasswordHash(actual, expected) {
  const actualHash = normalizePasswordHash(actual);
  const expectedHash = normalizePasswordHash(expected);
  return Boolean(
    actualHash &&
    expectedHash &&
    actualHash.algorithm === expectedHash.algorithm &&
    actualHash.iterations === expectedHash.iterations &&
    actualHash.salt === expectedHash.salt &&
    actualHash.hash === expectedHash.hash
  );
}

async function verifyPlantaoOperatorPersist(username, expectedHash) {
  const normalizedUsername = normalizePlantaoOperatorUsername(username);
  const snapshot = await getPlantaoOperatorsSnapshot({ allowCacheFallback: false });
  const operators = normalizePlantaoOperators(snapshot.data()?.accounts || {});
  const account = operators[normalizedUsername];
  if (!account) {
    throw new Error(`Firestore nao confirmou o operador ${normalizedUsername}.`);
  }
  if (!samePasswordHash(account.passwordHash, expectedHash)) {
    throw new Error(`Firestore nao confirmou a senha nova de ${normalizedUsername}.`);
  }
  return operators;
}

async function verifyPlantaoOperatorRemoval(username) {
  const normalizedUsername = normalizePlantaoOperatorUsername(username);
  const snapshot = await getPlantaoOperatorsSnapshot({ allowCacheFallback: false });
  const operators = normalizePlantaoOperators(snapshot.data()?.accounts || {});
  if (operators[normalizedUsername]) {
    throw new Error(`Firestore ainda retornou o operador ${normalizedUsername}.`);
  }
  return operators;
}

async function loadPlantaoOperators() {
  if (!db || !isAdmin()) return;
  const snapshot = await getPlantaoOperatorsSnapshot();
  const data = snapshot.data() || {};
  state.plantaoOperators = normalizePlantaoOperators(snapshot.exists ? data.accounts || {} : DEFAULT_PLANTAO_OPERATORS);
  state.plantaoOperatorsLoaded = true;
  state.plantaoOperatorError = "";
  await migratePlaintextPlantaoOperatorsIfNeeded();
}

async function persistPlantaoOperators(nextOperators, options = {}) {
  if (!db || !isAdmin()) return;
  setStatus("Salvando operadores do plantao...");
  const storageOperators = serializePlantaoOperatorsForStorage(nextOperators);
  await plantaoOperatorsDocRef().set({
    accounts: storageOperators,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  if (options.verifyUsername) {
    state.plantaoOperators = await verifyPlantaoOperatorPersist(options.verifyUsername, options.expectedHash);
  } else if (options.removedUsername) {
    state.plantaoOperators = await verifyPlantaoOperatorRemoval(options.removedUsername);
  } else {
    state.plantaoOperators = normalizePlantaoOperators(storageOperators);
  }
  state.plantaoOperatorsLoaded = true;
  state.plantaoOperatorError = "";
  setStatus("Operadores do plantao sincronizados.");
}

async function refreshPlantaoOperators() {
  if (!isAdmin()) return;
  try {
    await loadPlantaoOperators();
  } catch (error) {
    state.plantaoOperatorsLoaded = true;
    state.plantaoOperatorError = error?.message || "Falha ao carregar operadores do plantao.";
    rememberRemoteDataWarning("operadores do plantao", error);
  }
  renderPlantaoOperatorList();
}

async function loadAuditLogs() {
  if (!state.currentUser?.permissions?.logs && !isAdmin()) {
    state.auditLogs = [];
    return;
  }
  const snapshot = await db.collection("portal_audit_logs").orderBy("createdAt", "desc").limit(200).get();
  state.auditLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function loadOwnerSignature() {
  const snapshot = await db.collection("system").doc("ownerSignature").get();
  const data = snapshot.data() || {};
  state.ownerSignature = {
    signatureDataUrl: String(data.signatureDataUrl || "").trim(),
    updatedAt: data.updatedAt || null
  };
}

function closeOwnerSignatureEditor() {
  el.ownerSignatureEditor.classList.add("hidden");
  ownerSignaturePad.setEnabled(false);
}

function renderOwnerSignature() {
  const dataUrl = String(state.ownerSignature.signatureDataUrl || "").trim();
  el.ownerSignaturePreview.classList.toggle("hidden", !dataUrl);
  el.ownerSignatureEmpty.classList.toggle("hidden", Boolean(dataUrl));
  if (dataUrl) {
    el.ownerSignaturePreview.src = dataUrl;
  } else {
    el.ownerSignaturePreview.removeAttribute("src");
  }
  el.ownerSignatureMeta.textContent = state.ownerSignature.updatedAt ? "Salva em " + formatLogDate(state.ownerSignature.updatedAt) : "Sem assinatura cadastrada";
}

function permissionSummary(permissions) {
  return Object.entries(permissions || {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => PERMISSION_LABELS[key] || key.toUpperCase())
    .join(" / ") || "Sem acessos liberados";
}

function sectorCardClass(id) {
  return `system-tile system-${id}`;
}

function renderSystems() {
  const permissions = state.currentUser?.permissions || defaultPermissions();
  el.systemsGrid.innerHTML = "";
  const availableCount = SYSTEM_CARDS.filter(card => permissions[card.id] || isAdmin()).length;
  const publicLinkCount = availablePublicLinkSystems().length;
  const totalLinks = SYSTEM_CARDS.reduce((sum, card) => sum + (card.links?.length || (card.href ? 1 : 0)), 0);
  const overview = document.createElement("article");
  overview.className = "systems-overview";
  overview.innerHTML = `
    <div class="overview-copy">
      <span class="eyebrow">Visao geral</span>
      <h2>Portal operacional</h2>
      <p>Entrada unica para setores internos, links oficiais e acompanhamento executivo.</p>
    </div>
    <div class="overview-metric"><strong>${availableCount}</strong><span>setores liberados</span></div>
    <div class="overview-metric"><strong>${publicLinkCount}</strong><span>links criaveis</span></div>
    <div class="overview-metric"><strong>${totalLinks}</strong><span>atalhos internos</span></div>
  `;
  el.systemsGrid.appendChild(overview);
  SYSTEM_CARDS.forEach(card => {
    const canOpen = permissions[card.id] || isAdmin();
    const article = document.createElement("article");
    article.className = `${sectorCardClass(card.id)} ${canOpen ? "" : "locked"}`;
    const links = card.links
      ? card.links.map(link => `<a class="action ${canOpen ? "" : "disabled"}" ${canOpen ? `href="${link.href}"` : 'aria-disabled="true"'}>${link.label}</a>`).join("")
      : `<a class="action ${canOpen && card.href ? "" : "disabled"}" ${canOpen && card.href ? `href="${card.href}"` : 'aria-disabled="true"'}>${card.action || "Indisponivel"}</a>`;

    article.innerHTML = `
      <div class="system-card-top">
        <span class="system-kicker">${PERMISSION_LABELS[card.id] || card.id.toUpperCase()}</span>
        <span class="system-state">${canOpen ? "Liberado" : "Restrito"}</span>
      </div>
      <div class="square-body">
        <h2>${card.title}</h2>
        <p>${card.subtitle} ${card.description}</p>
      </div>
      <div class="system-meta">
        <span>${card.links?.length || 1} atalhos</span>
        <span>${canOpen ? "Acesso ativo" : "Sem permissao"}</span>
      </div>
      <div class="square-actions">${links}</div>
      ${canOpen ? "" : '<span class="badge">Sem permissao</span>'}
    `;
    el.systemsGrid.appendChild(article);
  });
}

function canCreatePublicLink(option) {
  const permissions = state.currentUser?.permissions || defaultPermissions();
  return Boolean(option && (isAdmin() || permissions[option.permission]));
}

function availablePublicLinkSystems() {
  return PUBLIC_LINK_SYSTEMS.filter(canCreatePublicLink);
}

function selectedPublicLinkSystem() {
  const id = el.linkSystemSelect?.value || "";
  return PUBLIC_LINK_SYSTEMS.find(option => option.id === id) || null;
}

function updateLinkDescription() {
  if (!el.linkSystemDescription) return;
  const option = selectedPublicLinkSystem();
  el.linkSystemDescription.textContent = option ? option.description : "Nenhum setor disponivel para este usuario.";
}

function renderLinkCreator() {
  if (!el.linkSystemSelect || !el.createLinkBtn) return;
  const options = availablePublicLinkSystems();
  const previousValue = el.linkSystemSelect.value;
  el.linkSystemSelect.innerHTML = "";

  options.forEach(option => {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    el.linkSystemSelect.appendChild(item);
  });

  if (previousValue && options.some(option => option.id === previousValue)) {
    el.linkSystemSelect.value = previousValue;
  }

  const hasOptions = Boolean(options.length);
  el.linkSystemSelect.disabled = !hasOptions;
  el.createLinkBtn.disabled = !hasOptions;
  if (!hasOptions) {
    el.linkStatus.textContent = "Nenhum setor liberado para criar link com este usuario.";
  } else if (!el.linkOutput.value) {
    el.linkStatus.textContent = "";
  }
  updateLinkDescription();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseCommercialMoney(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("%")) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  });
}

function textValue(value) {
  return String(value || "").trim();
}

function firstCommercialText(...values) {
  for (const value of values) {
    const text = textValue(value).replace(/\s+/g, " ");
    if (text) return text;
  }
  return "";
}

function normalizeCommercialKey(value) {
  return firstCommercialText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " E ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(LTDA|ME|EIRELI|S A|SA|EPP)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function commercialDocumentDigits(value) {
  return textValue(value).replace(/\D/g, "");
}

function extractCommercialIntroName(data) {
  const intro = Array.isArray(data.legalDocument?.intro) ? data.legalDocument.intro : [];
  for (const line of intro) {
    const text = firstCommercialText(line);
    const match = text.match(/^(.{4,160}?)(?:,\s*(?:com sede|inscrit[ao]|neste ato|doravante)|\s+com\s+sede|\s+inscrit[ao])/i);
    if (match) return firstCommercialText(match[1]);
  }
  return "";
}

function commercialSourceLabel(source) {
  const normalized = normalizeCommercialKey(source);
  if (normalized.includes("PUBLIC LINK")) return "Link publico";
  if (normalized.includes("EDITOR")) return "Contrato interno";
  return "Rascunho";
}

function commercialRecordCode(record, data, docId) {
  return firstCommercialText(
    data.contract?.contractCode,
    data.meta?.contractCode,
    record.contractCode,
    record.contractId,
    data.meta?.contractId,
    docId
  ).replace(/^(PUBLIC|INTER|GERAIS|ESPEC)-/i, "");
}

function commercialCreatedMonth(value) {
  const date = parseContractDate(value);
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
}

function commercialFallbackClient(collection, record, data, docId) {
  const service = data.service || {};
  const source = commercialSourceLabel(record.source || data.meta?.source);
  const location = firstCommercialText(
    service.monitoredLocationName,
    service.monitoredReference,
    service.monitoredAddress
  );
  const code = commercialRecordCode(record, data, docId);
  const month = commercialCreatedMonth(record.createdAt || data.meta?.createdAt || record.updatedAt || data.meta?.updatedAt);
  const usefulLocation = location && normalizeCommercialKey(location) !== "EVENTOS TKA" ? ` - ${location}` : "";
  const suffix = usefulLocation || (code ? ` ${code}` : "");
  const dateLabel = month ? ` (${month})` : "";
  return `${source} ${collection.label}${suffix}${dateLabel}`;
}

function commercialClientGroupKey(record) {
  if (!record.hasClientName) {
    return `draft:${record.collectionId}:${normalizeCommercialKey(record.source || record.collectionLabel) || "sem-origem"}`;
  }
  const normalizedName = normalizeCommercialKey(record.client);
  if (normalizedName) return `name:${normalizedName}`;
  const documentDigits = commercialDocumentDigits(record.cnpj);
  if (documentDigits.length >= 11) return `doc:${documentDigits}`;
  return `record:${record.id}`;
}

function commercialClientNameScore(value) {
  const text = firstCommercialText(value);
  if (!text) return 0;
  let score = Math.min(text.length, 120);
  if (/[a-z]/.test(text)) score += 25;
  if (/[^\x00-\x7F]/.test(text)) score += 10;
  if (text === text.toUpperCase()) score -= 20;
  return score;
}

function parseContractDate(value) {
  const text = textValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDueDay(value) {
  const text = textValue(value);
  if (!text) return "";
  const numeric = text.match(/\b([1-9]|[12]\d|3[01])\b/);
  return numeric ? numeric[1].padStart(2, "0") : text;
}

function dueSortKey(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 99;
}

function commercialCollectionById(id) {
  return COMMERCIAL_COLLECTIONS.find(collection => collection.id === id) || null;
}

function summarizeCommercialRecord(collection, doc) {
  const record = doc.data() || {};
  const data = record.data || {};
  const contractor = data.contractor || {};
  const service = data.service || {};
  const contract = data.contract || {};
  const pricing = data.pricing || {};
  const source = textValue(record.source || data.meta?.source);
  const clientName = firstCommercialText(
    contractor.legalName,
    contractor.companyName,
    contractor.name,
    contractor.clientName,
    contractor.customerName,
    data.client?.legalName,
    data.client?.companyName,
    data.client?.name,
    data.customer?.legalName,
    data.customer?.companyName,
    data.customer?.name,
    record.clientName,
    record.customerName,
    record.name,
    data.sign?.signerName,
    extractCommercialIntroName(data)
  );
  const hasClientName = Boolean(clientName);
  const client = hasClientName ? clientName : commercialFallbackClient(collection, record, data, doc.id);
  const monthlyAmount = (collection.monthlyFields || []).reduce((sum, field) => sum + parseCommercialMoney(pricing[field]), 0);
  const variableAmount = collection.monthlyFields?.length ? 0 : parseCommercialMoney(pricing.monitoringMonthly);
  const dueDay = normalizeDueDay(pricing.dueDay);
  const archived = Boolean(record.archived || data.meta?.archived);
  const endDate = parseContractDate(contract.endDate);
  const active = !archived;
  const issues = [];

  if (active && !hasClientName) issues.push("cliente");
  if (active && collection.monthlyFields?.length && monthlyAmount <= 0) issues.push("valor mensal");
  if (active && collection.monthlyFields?.length && !dueDay) issues.push("dia de cobranca");
  if (active && endDate && endDate.getTime() < Date.now()) issues.push("vigencia vencida");

  const summary = {
    id: doc.id,
    collectionId: collection.id,
    collectionLabel: collection.label,
    href: `${collection.href}editor.html?id=${encodeURIComponent(doc.id)}`,
    client,
    hasClientName,
    source,
    draftLabel: client,
    cnpj: firstCommercialText(contractor.cnpj, data.sign?.cpf, record.cnpj, record.cpf),
    location: textValue(service.monitoredLocationName || service.monitoredReference || service.monitoredAddress || contractor.city),
    monthlyAmount,
    variableAmount,
    dueDay,
    startDate: textValue(contract.startDate),
    endDate: textValue(contract.endDate),
    updatedAt: record.updatedAt || data.meta?.updatedAt || record.createdAt || data.meta?.createdAt || "",
    active,
    archived,
    issues
  };
  summary.clientGroupKey = commercialClientGroupKey(summary);
  return summary;
}

function commercialNamelessGroupTitle(group) {
  const source = commercialSourceLabel(group.records[0]?.source);
  const sourceLabel = source === "Link publico" ? "Links publicos" : "Rascunhos";
  const collections = [...group.collectionCounts.keys()].join(" + ") || "Comercial";
  return `${sourceLabel} ${collections} sem cliente`;
}

function summarizeCommercialGroup(group) {
  const collectionSummary = [...group.collectionCounts.entries()]
    .map(([label, count]) => `${label}${count > 1 ? ` (${count})` : ""}`)
    .join(", ");
  const dueDays = [...group.dueDays].sort((a, b) => dueSortKey(a) - dueSortKey(b));
  const issueNames = [...group.issueNames];
  const recordCount = group.records.length;

  return {
    key: group.key,
    client: group.hasClientName ? group.client : commercialNamelessGroupTitle(group),
    hasClientName: group.hasClientName,
    records: group.records.sort((a, b) => b.monthlyAmount - a.monthlyAmount || a.client.localeCompare(b.client, "pt-BR")),
    recordCount,
    collectionSummary,
    dueDays,
    dueSummary: dueDays.length ? `vencimento dia ${dueDays.join(", ")}` : "sem vencimento",
    issueNames,
    issueCount: group.issueCount,
    monthlyAmount: group.monthlyAmount,
    variableAmount: group.variableAmount,
    href: recordCount === 1 ? group.records[0]?.href : "",
    location: group.records.find(record => record.location)?.location || ""
  };
}

function groupCommercialRecords(records) {
  const groups = new Map();
  records.forEach(record => {
    const key = record.clientGroupKey || commercialClientGroupKey(record);
    const group = groups.get(key) || {
      key,
      client: record.client,
      hasClientName: record.hasClientName,
      records: [],
      collectionCounts: new Map(),
      dueDays: new Set(),
      issueNames: new Set(),
      issueCount: 0,
      monthlyAmount: 0,
      variableAmount: 0
    };

    if (record.hasClientName && !group.hasClientName) {
      group.client = record.client;
      group.hasClientName = true;
    } else if (record.hasClientName && commercialClientNameScore(record.client) > commercialClientNameScore(group.client)) {
      group.client = record.client;
    }
    group.records.push(record);
    group.collectionCounts.set(record.collectionLabel, (group.collectionCounts.get(record.collectionLabel) || 0) + 1);
    if (record.dueDay) group.dueDays.add(record.dueDay);
    record.issues.forEach(issue => group.issueNames.add(issue));
    group.issueCount += record.issues.length;
    group.monthlyAmount += record.monthlyAmount;
    group.variableAmount += record.variableAmount;
    groups.set(key, group);
  });

  return [...groups.values()].map(summarizeCommercialGroup);
}

function summarizeCommercialIssueBreakdown(records) {
  const labels = [
    ["cliente", "Sem cliente"],
    ["valor mensal", "Sem valor"],
    ["dia de cobranca", "Sem vencimento"],
    ["vigencia vencida", "Vigencia vencida"]
  ];

  return labels
    .map(([id, label]) => {
      const issueRecords = records
        .filter(record => record.issues.includes(id))
        .sort((a, b) => a.client.localeCompare(b.client, "pt-BR") || a.collectionLabel.localeCompare(b.collectionLabel, "pt-BR"));
      return {
        id,
        label,
        count: issueRecords.length,
        records: issueRecords
      };
    })
    .filter(item => item.count > 0);
}

function summarizeCommercialTotals(records, collections) {
  const activeRecords = records.filter(record => record.active);
  const fixedMonthlyRecords = activeRecords.filter(record => commercialCollectionById(record.collectionId)?.monthlyFields?.length);
  const dueBuckets = new Map();
  const issueRecords = activeRecords.filter(record => record.issues.length);
  const clientGroups = groupCommercialRecords(activeRecords);

  fixedMonthlyRecords.forEach(record => {
    if (!record.dueDay) return;
    const current = dueBuckets.get(record.dueDay) || { dueDay: record.dueDay, clientKeys: new Set(), amount: 0, clients: [], records: [] };
    if (!current.clientKeys.has(record.clientGroupKey)) {
      current.clientKeys.add(record.clientGroupKey);
      current.clients.push(record.client);
    }
    current.amount += record.monthlyAmount;
    current.records.push(record);
    dueBuckets.set(record.dueDay, current);
  });

  return {
    activeContracts: activeRecords.length,
    archivedContracts: records.length - activeRecords.length,
    activeClientGroups: clientGroups.filter(group => group.hasClientName).length,
    monthlyContracts: fixedMonthlyRecords.filter(record => record.monthlyAmount > 0).length,
    variableContracts: activeRecords.filter(record => record.variableAmount > 0).length,
    monthlyTotal: fixedMonthlyRecords.reduce((sum, record) => sum + record.monthlyAmount, 0),
    issueCount: issueRecords.length,
    dueBuckets: [...dueBuckets.values()]
      .map(item => ({
        ...item,
        count: item.clientKeys.size,
        records: [...item.records].sort((a, b) => a.client.localeCompare(b.client, "pt-BR") || dueSortKey(a.dueDay) - dueSortKey(b.dueDay))
      }))
      .sort((a, b) => dueSortKey(a.dueDay) - dueSortKey(b.dueDay)),
    issueGroups: groupCommercialRecords(issueRecords)
      .sort((a, b) => b.issueCount - a.issueCount || b.recordCount - a.recordCount || a.client.localeCompare(b.client, "pt-BR"))
      .slice(0, 12),
    topClients: clientGroups
      .filter(group => group.hasClientName && group.monthlyAmount > 0)
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
      .slice(0, 10),
    clientGroups,
    issueBreakdown: summarizeCommercialIssueBreakdown(issueRecords),
    collections: collections.map(collection => {
      const collectionRecords = records.filter(record => record.collectionId === collection.id);
      const active = collectionRecords.filter(record => record.active);
      return {
        id: collection.id,
        label: collection.label,
        href: collection.href,
        active: active.length,
        archived: collectionRecords.length - active.length,
        amount: active.reduce((sum, record) => sum + record.monthlyAmount, 0),
        issues: active.reduce((sum, record) => sum + record.issues.length, 0)
      };
    })
  };
}

async function loadCommercialSituation(options = {}) {
  if (!canViewCommercialSituation()) {
    renderCommercialSituation();
    return;
  }
  if (!db) {
    state.commercialSituation = {
      ...state.commercialSituation,
      loading: false,
      error: "Firebase nao configurado.",
      collections: [],
      records: [],
      totals: null
    };
    renderCommercialSituation();
    return;
  }
  if (state.commercialSituation.loading && !options.force) return;

  state.commercialSituation = { ...state.commercialSituation, loading: true, error: "" };
  renderCommercialSituation();

  try {
    const snapshots = await Promise.all(COMMERCIAL_COLLECTIONS.map(async collection => {
      const snapshot = await db.collection(collection.collection).get();
      return { collection, docs: snapshot.docs };
    }));
    const records = snapshots.flatMap(entry => entry.docs.map(doc => summarizeCommercialRecord(entry.collection, doc)));
    const totals = summarizeCommercialTotals(records, COMMERCIAL_COLLECTIONS);
    state.commercialSituation = {
      loading: false,
      error: "",
      lastLoadedAt: new Date().toISOString(),
      collections: totals.collections,
      records,
      totals
    };
  } catch (error) {
    console.error(error);
    state.commercialSituation = {
      ...state.commercialSituation,
      loading: false,
      error: error.message || "Nao foi possivel carregar a situacao comercial."
    };
  }

  renderCommercialSituation();
}

function currentCommercialFilters() {
  return state.commercialSituation.filters || { view: "executive", collectionId: "all", issue: "all" };
}

function syncCommercialFilterControls() {
  const filters = currentCommercialFilters();

  if (el.commercialViewSelect) el.commercialViewSelect.value = filters.view || "executive";
  if (el.commercialIssueFilter) el.commercialIssueFilter.value = filters.issue || "all";

  if (el.commercialCollectionFilter) {
    const previous = filters.collectionId || "all";
    el.commercialCollectionFilter.innerHTML = `<option value="all">Todos</option>${COMMERCIAL_COLLECTIONS.map(collection => (
      `<option value="${escapeHtml(collection.id)}">${escapeHtml(collection.label)}</option>`
    )).join("")}`;
    el.commercialCollectionFilter.value = COMMERCIAL_COLLECTIONS.some(collection => collection.id === previous) ? previous : "all";
  }
}

function commercialFiltersActive(filters) {
  return Boolean(
    filters.collectionId && filters.collectionId !== "all" ||
    filters.issue && filters.issue !== "all"
  );
}

function recordMatchesCommercialIssue(record, issue) {
  if (!issue || issue === "all") return true;
  if (issue === "issues") return record.issues.length > 0;
  if (issue === "missing-client") return record.issues.includes("cliente");
  if (issue === "missing-value") return record.issues.includes("valor mensal");
  if (issue === "missing-due") return record.issues.includes("dia de cobranca");
  if (issue === "expired") return record.issues.includes("vigencia vencida");
  return true;
}

function filterCommercialRecords(records, filters) {
  return records.filter(record => {
    if (filters.collectionId && filters.collectionId !== "all" && record.collectionId !== filters.collectionId) return false;
    return recordMatchesCommercialIssue(record, filters.issue);
  });
}

function commercialBadge(text, tone = "") {
  const className = ["commercial-badge", tone].filter(Boolean).join(" ");
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function commercialCountLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function commercialRecordDetailRows(records, options = {}) {
  if (!records.length || (!options.force && records.length <= 1)) return "";
  const summary = options.summary || `${commercialCountLabel(records.length, "registro", "registros")} neste grupo`;
  const recordList = `
    <div class="commercial-record-list">
      ${records.map(record => {
        const details = [
          record.collectionLabel,
          record.dueDay ? `dia ${record.dueDay}` : "",
          record.monthlyAmount ? formatCurrency(record.monthlyAmount) : "",
          options.includeIssues && record.issues.length ? record.issues.join(", ") : ""
        ].filter(Boolean).join(", ");
        return `
          <a href="${escapeHtml(record.href)}">
            <span>${escapeHtml(record.draftLabel || record.client)}</span>
            <small>${escapeHtml(details)}</small>
          </a>
        `;
      }).join("")}
    </div>
  `;
  if (options.noWrapper) return recordList;
  return `
    <details class="commercial-row-details">
      <summary>${escapeHtml(summary)}</summary>
      ${recordList}
    </details>
  `;
}

function commercialGroupSubtitle(group, mode) {
  const parts = [group.collectionSummary];
  if (group.dueDays.length) parts.push(group.dueSummary);
  if (group.location) parts.push(group.location);
  if (mode === "issues" && group.issueNames.length) parts.push(group.issueNames.join(", "));
  if (group.recordCount > 1) parts.push(`${group.recordCount} contratos`);
  return parts.filter(Boolean).join(" | ");
}

function commercialGroupRow(group, mode = "client") {
  const detailRows = commercialRecordDetailRows(group.records, {
    force: mode === "issues",
    includeIssues: mode === "issues",
    summary: mode === "issues"
      ? `${commercialCountLabel(group.records.length, "contrato", "contratos")} com pendencia`
      : `${commercialCountLabel(group.records.length, "registro", "registros")} neste grupo`
  });
  const badges = [
    group.hasClientName ? "" : commercialBadge("sem cliente", "danger"),
    group.issueCount ? commercialBadge(`${group.issueCount} pendencias`, "warning") : "",
    group.recordCount > 1 ? commercialBadge(`${group.recordCount} registros`, "neutral") : ""
  ].filter(Boolean).join("");
  const value = mode === "issues"
    ? (group.dueDays.length ? `Dia ${group.dueDays.join(", ")}` : "Sem dia")
    : formatCurrency(group.monthlyAmount);
  const content = `
    <div class="row-main row-main-wide">
      <span class="row-title">${escapeHtml(group.client)}</span>
      <span class="row-subtitle">${escapeHtml(commercialGroupSubtitle(group, mode))}</span>
      ${badges ? `<div class="commercial-badges">${badges}</div>` : ""}
      ${detailRows}
    </div>
    <strong>${escapeHtml(value)}</strong>
  `;
  return group.href && !detailRows
    ? `<a class="commercial-row ${group.issueCount ? "has-warning" : ""}" href="${escapeHtml(group.href)}">${content}</a>`
    : `<div class="commercial-row ${group.issueCount ? "has-warning" : ""}">${content}</div>`;
}

function commercialDueRow(item) {
  const clientPreview = `${commercialCountLabel(item.count, "cliente", "clientes")}: ${item.clients.slice(0, 3).join(", ")}${item.clients.length > 3 ? "..." : ""}`;
  return `
    <div class="commercial-row">
      <div class="row-main row-main-wide">
        <span class="row-title">Dia ${escapeHtml(item.dueDay)}</span>
        <span class="row-subtitle">${escapeHtml(clientPreview)}</span>
        ${commercialRecordDetailRows(item.records, {
          force: true,
          summary: `${commercialCountLabel(item.records.length, "contrato", "contratos")} neste vencimento`
        })}
      </div>
      <strong>${escapeHtml(formatCurrency(item.amount))}</strong>
    </div>
  `;
}

function commercialDuePill(item, maxDueAmount) {
  const percent = maxDueAmount > 0 ? Math.max(8, Math.round((item.amount / maxDueAmount) * 100)) : 0;
  return `
    <details class="due-pill visual-detail-pill">
      <summary>
        <strong>Dia ${escapeHtml(item.dueDay)}</strong>
        <span>${escapeHtml(formatCurrency(item.amount))}</span>
        <small>${escapeHtml(commercialCountLabel(item.count, "cliente", "clientes"))}</small>
        <div class="due-pill-bar" aria-hidden="true"><span style="width:${percent}%"></span></div>
      </summary>
      ${commercialRecordDetailRows(item.records, {
        force: true,
        noWrapper: true,
        summary: ""
      })}
    </details>
  `;
}

function commercialIssueMeter(item) {
  return `
    <details class="issue-meter visual-detail-pill">
      <summary>
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.count}</strong>
      </summary>
      ${commercialRecordDetailRows(item.records, {
        force: true,
        includeIssues: true,
        noWrapper: true,
        summary: ""
      })}
    </details>
  `;
}

function commercialRow(title, subtitle, value, href) {
  const content = `
    <div class="row-main row-main-wide">
      <span class="row-title">${escapeHtml(title)}</span>
      <span class="row-subtitle">${escapeHtml(subtitle)}</span>
    </div>
    <strong>${escapeHtml(value)}</strong>
  `;
  return href
    ? `<a class="commercial-row" href="${escapeHtml(href)}">${content}</a>`
    : `<div class="commercial-row">${content}</div>`;
}

function commercialMetricBar(label, value, max, meta, href) {
  const percent = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const content = `
    <div class="metric-bar-head">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(formatCurrency(value))}</span>
    </div>
    <div class="metric-bar-track" aria-hidden="true"><span style="width:${percent}%"></span></div>
    <small>${escapeHtml(meta)}</small>
  `;
  return href
    ? `<a class="metric-bar" href="${escapeHtml(href)}">${content}</a>`
    : `<div class="metric-bar">${content}</div>`;
}

function renderCommercialVisuals(totals, filters) {
  if (!el.commercialVisuals) return;
  if (!totals) {
    el.commercialVisuals.innerHTML = "";
    return;
  }

  const maxCollectionAmount = Math.max(...totals.collections.map(item => item.amount), 0);
  const maxDueAmount = Math.max(...totals.dueBuckets.map(item => item.amount), 0);
  const revenueBars = totals.collections.map(item => commercialMetricBar(
    item.label,
    item.amount,
    maxCollectionAmount,
    `${item.active} ativos | ${item.issues} pendencias`,
    item.href
  )).join("");
  const duePills = totals.dueBuckets.map(item => commercialDuePill(item, maxDueAmount)).join("") || `<div class="empty-state compact-state">Sem vencimentos no filtro.</div>`;
  const issueItems = totals.issueBreakdown.map(item => commercialIssueMeter(item)).join("") || `<div class="empty-state compact-state">Sem pendencias no filtro.</div>`;
  const filteredLabel = commercialFiltersActive(filters) ? "Filtro ativo" : "Base completa";

  el.commercialVisuals.innerHTML = `
    <section class="commercial-visual-panel visual-revenue">
      <div class="block-title"><strong>Receita por setor</strong><span>${escapeHtml(filteredLabel)}</span></div>
      <div class="metric-bars">${revenueBars}</div>
    </section>
    <section class="commercial-visual-panel visual-due">
      <div class="block-title"><strong>Vencimentos</strong><span>${totals.dueBuckets.length} dias</span></div>
      <div class="due-pill-grid">${duePills}</div>
    </section>
    <section class="commercial-visual-panel visual-issues">
      <div class="block-title"><strong>Pendencias</strong><span>${totals.issueCount} registros</span></div>
      <div class="issue-meter-grid">${issueItems}</div>
    </section>
  `;
}

function renderCommercialSituation() {
  if (!el.commercialKpis) return;
  const allowed = canViewCommercialSituation();
  if (el.commercialTabButton) el.commercialTabButton.classList.toggle("hidden", !allowed);

  if (!allowed) {
    el.commercialKpis.innerHTML = "";
    el.commercialStatus.innerHTML = `<div class="empty-state compact-state">Acesso restrito ao Comercial e a direcao.</div>`;
    if (el.commercialVisuals) el.commercialVisuals.innerHTML = "";
    return;
  }

  const situation = state.commercialSituation;
  syncCommercialFilterControls();
  const filters = currentCommercialFilters();
  const filteredRecords = filterCommercialRecords(situation.records || [], filters);
  const totals = situation.totals ? summarizeCommercialTotals(filteredRecords, COMMERCIAL_COLLECTIONS) : null;
  const updated = situation.lastLoadedAt ? formatLogDate(situation.lastLoadedAt) : "Aguardando dados";
  const filtered = commercialFiltersActive(filters);
  el.commercialUpdatedAt.textContent = situation.loading ? "Atualizando..." : updated;
  el.refreshCommercialBtn.disabled = Boolean(situation.loading);
  el.commercialStatus.innerHTML = situation.error
    ? `<div class="error-state compact-state">${escapeHtml(situation.error)}</div>`
    : `<div class="automation-note">${filtered ? `${filteredRecords.length} de ${(situation.records || []).length} registros no filtro atual.` : "Atualizacao automatica a cada 5 minutos. Dados lidos diretamente das bases internas de contratos."}</div>`;

  if (!totals) {
    el.commercialKpis.innerHTML = `
      <div class="kpi-card"><span>Receita mensal</span><strong>--</strong><small>carregando</small></div>
      <div class="kpi-card"><span>Contratos ativos</span><strong>--</strong><small>carregando</small></div>
      <div class="kpi-card"><span>Vencimentos</span><strong>--</strong><small>carregando</small></div>
      <div class="kpi-card"><span>Pendencias</span><strong>--</strong><small>carregando</small></div>
    `;
    renderCommercialVisuals(null, filters);
    return;
  }

  el.commercialKpis.innerHTML = `
    <div class="kpi-card accent"><span>Receita mensal</span><strong>${formatCurrency(totals.monthlyTotal)}</strong><small>${totals.monthlyContracts} contratos com valor fixo</small></div>
    <div class="kpi-card"><span>Contratos ativos</span><strong>${totals.activeContracts}</strong><small>${totals.activeClientGroups} clientes agrupados</small></div>
    <div class="kpi-card"><span>Vencimentos</span><strong>${totals.dueBuckets.length}</strong><small>dias de cobranca informados</small></div>
    <div class="kpi-card ${totals.issueCount ? "warning" : ""}"><span>Pendencias</span><strong>${totals.issueCount}</strong><small>${totals.variableContracts} contratos variaveis fora do mensal</small></div>
  `;
  renderCommercialVisuals(totals, filters);

  el.commercialCollectionList.innerHTML = totals.collections.map(item => commercialRow(
    item.label,
    `${item.active} ativos, ${item.archived} arquivados, ${item.issues} pendencias`,
    formatCurrency(item.amount),
    item.href
  )).join("") || `<div class="empty-state compact-state">Nenhum contrato encontrado.</div>`;

  el.commercialDueList.innerHTML = totals.dueBuckets.map(item => commercialDueRow(
    item
  )).join("") || `<div class="empty-state compact-state">Nenhum vencimento mensal informado.</div>`;

  el.commercialIssuesList.innerHTML = totals.issueGroups.map(item => commercialGroupRow(
    item,
    "issues"
  )).join("") || `<div class="empty-state compact-state">Sem pendencias criticas nos contratos ativos.</div>`;

  el.commercialClientList.innerHTML = totals.topClients.map(item => commercialGroupRow(
    item,
    "client"
  )).join("") || `<div class="empty-state compact-state">Nenhum valor mensal informado ainda.</div>`;
}

function startCommercialAutoRefresh() {
  stopCommercialAutoRefresh();
  if (!canViewCommercialSituation()) {
    renderCommercialSituation();
    return;
  }
  loadCommercialSituation({ force: true }).catch(console.error);
  commercialRefreshTimer = window.setInterval(() => {
    loadCommercialSituation().catch(console.error);
  }, COMMERCIAL_REFRESH_MS);
}

function stopCommercialAutoRefresh() {
  if (!commercialRefreshTimer) return;
  window.clearInterval(commercialRefreshTimer);
  commercialRefreshTimer = null;
}

function buildAbsoluteLink(href) {
  const value = String(href || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, window.location.origin).toString();
}

function buildCommercialPublicLink(option, contractId) {
  const url = new URL(option.editorPath, window.location.origin);
  url.searchParams.set("id", contractId);
  url.searchParams.set("public", "1");
  return url.toString();
}

function createBlankPublicContractData(option, contractId, publicLink, timestamp) {
  const shortId = contractId.slice(0, 8);
  const data = {
    contract: {
      contractCode: `${option.codePrefix}-${shortId.toUpperCase()}`,
      publicLink,
      issueCity: "",
      issueDate: "",
      startDate: "",
      endDate: "",
      durationMonths: ""
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
      state: "",
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
      monitoredState: "",
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
    equipment: [
      {
        id: `equipment-${shortId}`,
        quantity: "",
        description: "",
        location: "",
        value: ""
      }
    ],
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
    meta: {
      contractId,
      createdAt: timestamp,
      updatedAt: timestamp,
      publicCreated: true,
      publicLink
    }
  };

  if (option.id === "comercial-contratos-servicos-gerais") {
    data.equipment = [];
  }

  if (option.variant === "intermittent") {
    data.contract.issueCity = "Taubate";
    data.contract.durationMonths = "Indeterminado";
    data.contractor.state = "SP";
    data.contractor.representativeRole = "Vigilante";
    data.service.monitoredLocationName = "Eventos TKA";
    data.service.communicationMethod = "vigilancia intermitente para eventos";
    data.pricing.monitoringMonthly = "175,00";
    data.pricing.equipmentRentalMonthly = "12%";
    data.pricing.installationTotal = "5 dias uteis apos o termino do evento";
    data.pricing.installationInstallments = "15 dias corridos apos o termino da desmontagem";
    data.pricing.dueDay = "1 dia util";
    data.pricing.paymentMethod = "Pix, transferencia bancaria, especie ou outro meio acordado";
    data.equipment = [
      {
        id: `equipment-${shortId}`,
        quantity: "01",
        description: "Vigilante intermitente",
        location: "Diaria de 12 horas mediante convocacao para eventos",
        value: "175,00"
      }
    ];
    data.sign.signerTitle = "CONTRATADO";
  }

  return data;
}

async function createCommercialPublicLink(option) {
  if (!db) throw new Error("Firebase nao configurado.");
  const docRef = db.collection(option.collection).doc();
  const timestamp = new Date().toISOString();
  const publicLink = buildCommercialPublicLink(option, docRef.id);
  const data = createBlankPublicContractData(option, docRef.id, publicLink, timestamp);
  const user = state.currentUser || {};

  await docRef.set({
    archived: false,
    contractId: docRef.id,
    source: option.source,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: user.email || "desconhecido",
    data
  });

  return publicLink;
}

function buildRhServiceOrderPublicLink(orderId) {
  const url = new URL("/recursos-humanos/ordem-servico/editor.html", window.location.origin);
  url.searchParams.set("id", orderId);
  url.searchParams.set("public", "1");
  return url.toString();
}

function createBlankRhServiceOrderData(orderId, publicLink, timestamp) {
  const currentDate = String(timestamp || "").slice(0, 10);
  return {
    meta: {
      serviceOrderId: orderId,
      serviceOrderStage: "current",
      archived: false,
      publicLink,
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

async function createRhServiceOrderPublicLink() {
  if (!db) throw new Error("Firebase nao configurado.");
  const docRef = db.collection("rh_service_orders").doc();
  const timestamp = new Date().toISOString();
  const publicLink = buildRhServiceOrderPublicLink(docRef.id);
  const user = state.currentUser || {};

  await docRef.set({
    archived: false,
    source: "rh-service-order-public-link",
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: user.email || "desconhecido",
    data: createBlankRhServiceOrderData(docRef.id, publicLink, timestamp)
  });

  return publicLink;
}

async function createPublicLink(option) {
  if (option.type === "commercial-contract") {
    return createCommercialPublicLink(option);
  }
  if (option.type === "rh-service-order") {
    return createRhServiceOrderPublicLink();
  }
  return buildAbsoluteLink(option.href);
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
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(input);
  }
}

function showCreatedLink(option, publicLink, copied) {
  el.linkResult.classList.remove("hidden");
  el.linkResultTitle.textContent = option.label;
  el.linkResultMeta.textContent = copied ? "Copiado para area de transferencia." : "Pronto para copiar.";
  el.linkOutput.value = publicLink;
  el.openCreatedLinkBtn.href = publicLink;
}

async function copyCreatedLink() {
  const publicLink = el.linkOutput.value.trim();
  if (!publicLink) return;
  try {
    const copied = await copyTextToClipboard(publicLink);
    el.linkResultMeta.textContent = copied ? "Copiado para area de transferencia." : "Use o campo para copiar o link.";
    el.linkStatus.textContent = copied ? "Link copiado." : "Nao foi possivel copiar automaticamente.";
  } catch (error) {
    console.error(error);
    el.linkStatus.textContent = "Nao foi possivel copiar automaticamente.";
  }
}

async function createSelectedPublicLink() {
  const option = selectedPublicLinkSystem();
  if (!option) {
    el.linkStatus.textContent = "Selecione um setor para criar o link.";
    return;
  }
  if (!canCreatePublicLink(option)) {
    el.linkStatus.textContent = "Sem permissao para criar link deste setor.";
    return;
  }

  el.createLinkBtn.disabled = true;
  el.createLinkBtn.textContent = "Gerando...";
  el.linkStatus.textContent = "Criando link...";

  try {
    const publicLink = await createPublicLink(option);
    let copied = false;
    try {
      copied = await copyTextToClipboard(publicLink);
    } catch {
      copied = false;
    }
    showCreatedLink(option, publicLink, copied);
    el.linkStatus.textContent = copied ? "Link criado e copiado." : "Link criado. Use Copiar para enviar.";
    setStatus("Link criado.");
  } catch (error) {
    console.error(error);
    el.linkStatus.textContent = "Nao foi possivel criar o link.";
    setStatus("Falha ao criar link.");
  } finally {
    el.createLinkBtn.textContent = "Criar link";
    el.createLinkBtn.disabled = !availablePublicLinkSystems().length;
  }
}

function renderPermissionList() {
  if (!isAdmin()) {
    el.permissionList.innerHTML = `<div class="row"><span class="muted">Somente o usuario administrativo pode visualizar este painel.</span></div>`;
    return;
  }
  const entries = Object.entries(state.gateUsers).sort(([a], [b]) => a.localeCompare(b));
  el.permissionList.innerHTML = entries.map(([email, config]) => `
    <div class="row row-tight">
      <div class="row-main row-main-wide">
        <span class="row-title">${escapeHtml(email)}</span>
        <span class="row-subtitle">${escapeHtml(permissionSummary(config.permissions))}</span>
      </div>
    </div>
  `).join("") || `<div class="row"><span class="muted">Nenhum usuario cadastrado.</span></div>`;
}

function formatLogDate(value) {
  if (!value) return "Data pendente";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Data pendente" : date.toLocaleString("pt-BR");
}

function auditLogMarkup() {
  if (!state.currentUser?.permissions?.logs && !isAdmin()) {
    return `<div class="row"><span class="muted">Sem permissao para visualizar os logs.</span></div>`;
  }
  if (!state.auditLogs.length) {
    return `<div class="row"><span class="muted">Nenhum log administrativo registrado ainda.</span></div>`;
  }
  return state.auditLogs.map(item => `
    <div class="row row-tight">
      <div class="row-main row-main-wide">
        <span class="row-title">${escapeHtml(item.actionLabel || "Alteracao")} em ${escapeHtml(item.targetEmail || "usuario")}</span>
        <span class="row-subtitle">${escapeHtml(item.actorEmail || "Sistema")} | ${escapeHtml(formatLogDate(item.createdAt))} | ${escapeHtml(item.summary || "Sem resumo")}</span>
      </div>
    </div>
  `).join("");
}

function renderAuditLogs() {
  el.sharedAuditLogList.innerHTML = auditLogMarkup();
  if (!isAdmin()) {
    el.auditLogList.innerHTML = `<div class="row"><span class="muted">Somente o administrador pode gerenciar este painel.</span></div>`;
    return;
  }
  el.auditLogList.innerHTML = auditLogMarkup();
}

function renderUserList() {
  if (!isAdmin()) {
    el.userList.innerHTML = `<div class="row"><span class="muted">Somente o administrador pode editar usuarios.</span></div>`;
    return;
  }
  const entries = Object.entries(state.gateUsers).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    el.userList.innerHTML = `<div class="row"><span class="muted">Nenhum usuario cadastrado.</span></div>`;
    return;
  }

  el.userList.innerHTML = "";
  entries.forEach(([email, config]) => {
    const row = document.createElement("div");
    row.className = "row row-account";
    row.innerHTML = `
      <div class="row-main row-main-email">
        <span class="row-title">${escapeHtml(email)}</span>
      </div>
      <div class="row-main row-main-password">
        <span class="row-subtitle">${config.passwordHash ? "Senha protegida" : "Senha legada - redefina"}</span>
      </div>
      <div class="row-main row-main-wide">
        <span class="row-subtitle">${escapeHtml(permissionSummary(config.permissions))}</span>
      </div>
      <div class="actions actions-end">
        <button data-edit="${escapeHtml(email)}">Editar</button>
        <button class="danger" data-del="${escapeHtml(email)}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit]").onclick = () => fillUserForm(email, config);
    row.querySelector("[data-del]").onclick = () => removeUser(email);
    el.userList.appendChild(row);
  });
}

function renderPlantaoOperatorList() {
  if (!el.plantaoOperatorList) return;
  if (!isAdmin()) {
    el.plantaoOperatorList.innerHTML = `<div class="row"><span class="muted">Somente o administrador pode editar operadores do plantao.</span></div>`;
    return;
  }
  if (state.plantaoOperatorError) {
    el.plantaoOperatorList.innerHTML = `<div class="row"><span class="muted">${escapeHtml(state.plantaoOperatorError)}</span></div>`;
    return;
  }
  if (!state.plantaoOperatorsLoaded) {
    el.plantaoOperatorList.innerHTML = `<div class="row"><span class="muted">Carregando operadores do plantao...</span></div>`;
    return;
  }
  const entries = Object.entries(state.plantaoOperators).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  if (!entries.length) {
    el.plantaoOperatorList.innerHTML = `<div class="row"><span class="muted">Nenhum operador do plantao cadastrado.</span></div>`;
    return;
  }

  el.plantaoOperatorList.innerHTML = "";
  entries.forEach(([username, config]) => {
    const operatorLink = plantaoOperatorPublicLink(username);
    const row = document.createElement("div");
    row.className = "row row-account row-plantao-operator";
    row.innerHTML = `
      <div class="row-main row-main-email">
        <span class="row-title">${escapeHtml(username)}</span>
        <span class="row-subtitle">${escapeHtml(config.fullName || "Sem nome")}</span>
      </div>
      <div class="row-main row-main-password">
        <span class="row-subtitle">${config.passwordHash ? "Senha protegida" : "Senha legada - redefina"}</span>
      </div>
      <div class="row-main row-main-wide">
        <a class="action action-compact" href="${operatorLink}" target="_blank" rel="noreferrer">Abrir link</a>
      </div>
      <div class="actions actions-end">
        <button data-edit-plantao-operator="${escapeHtml(username)}">Editar</button>
        <button class="danger" data-del-plantao-operator="${escapeHtml(username)}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit-plantao-operator]").onclick = () => fillPlantaoOperatorForm(username, config);
    row.querySelector("[data-del-plantao-operator]").onclick = () => removePlantaoOperator(username);
    el.plantaoOperatorList.appendChild(row);
  });
}

function renderAdmin() {
  el.adminTabButton.classList.toggle("hidden", !isAdmin());
  if (el.commercialTabButton) el.commercialTabButton.classList.toggle("hidden", !canViewCommercialSituation());
  renderUserList();
  renderPlantaoOperatorList();
  renderPermissionList();
  renderAuditLogs();
  renderOwnerSignature();
}

function renderHeader() {
  const current = state.currentUser;
  if (!current) return;
  el.welcomeUser.textContent = current.email;
}

function renderAll() {
  renderHeader();
  renderSystems();
  renderLinkCreator();
  renderCommercialSituation();
  renderAdmin();
}

function fillUserForm(email, config) {
  el.userEmail.value = email;
  el.userPassword.value = "";
  el.userPassword.placeholder = "Nova senha ou vazio para manter";
  el.userSector.value = config.sector || "rh";
  el.permRh.checked = Boolean(config.permissions?.rh);
  el.permMonitoramento.checked = Boolean(config.permissions?.monitoramento);
  el.permOperacional.checked = Boolean(config.permissions?.operacional);
  el.permEstrutural.checked = Boolean(config.permissions?.estrutural);
  el.permLogs.checked = true;
  el.permAdmin.checked = Boolean(config.permissions?.admin);
}

function resetPlantaoOperatorForm() {
  if (!el.plantaoOperatorForm) return;
  el.plantaoOperatorForm.reset();
  delete el.plantaoOperatorForm.dataset.editing;
  el.plantaoOperatorPassword.placeholder = "Nova senha ou vazio para manter";
}

function fillPlantaoOperatorForm(username, config) {
  el.plantaoOperatorForm.dataset.editing = username;
  el.plantaoOperatorUsername.value = username;
  el.plantaoOperatorFullName.value = config.fullName || "";
  el.plantaoOperatorPassword.value = "";
  el.plantaoOperatorPassword.placeholder = "Nova senha ou vazio para manter";
  el.plantaoOperatorUsername.focus();
}

async function writeAuditLog(action, targetEmail, summary, previousValue, nextValue) {
  if (state.currentUser?.permissions?.skipAuditLogs) {
    return;
  }
  await db.collection("portal_audit_logs").add({
    action,
    actionLabel: action === "delete" ? "Exclusao" : action === "update" ? "Edicao" : "Inclusao",
    actorEmail: state.currentUser?.email || "",
    targetEmail,
    summary,
    previousValue: redactGateUserForAudit(previousValue),
    nextValue: redactGateUserForAudit(nextValue),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function writePlantaoOperatorAuditLog(action, username, summary, previousValue, nextValue) {
  if (state.currentUser?.permissions?.skipAuditLogs) {
    return;
  }
  await db.collection("portal_audit_logs").add({
    action,
    actionLabel: action === "delete" ? "Exclusao" : action === "update" ? "Edicao" : "Inclusao",
    actorEmail: state.currentUser?.email || "",
    targetEmail: `plantao:${username}`,
    summary,
    previousValue: redactPlantaoOperatorForAudit(previousValue),
    nextValue: redactPlantaoOperatorForAudit(nextValue),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function persistUsers(nextUsers) {
  setStatus("Salvando...");
  const storageUsers = serializeGateUsersForStorage(nextUsers);
  await db.collection("system").doc("portalGate").set({
    users: storageUsers,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  state.gateUsers = normalizeUsers(storageUsers);
  setStatus("Sincronizado");
}

async function savePlantaoOperator() {
  if (!isAdmin()) return;
  const previousUsername = normalizePlantaoOperatorUsername(el.plantaoOperatorForm.dataset.editing || "");
  const username = normalizePlantaoOperatorUsername(el.plantaoOperatorUsername.value);
  const fullName = el.plantaoOperatorFullName.value.trim();
  const typedPassword = el.plantaoOperatorPassword.value.trim();
  if (!username || !isValidPlantaoOperatorUsername(username)) {
    setStatus("Use um login de plantao sem espacos, apenas letras, numeros, ponto, traco ou underline.");
    return;
  }
  if (!fullName) {
    setStatus("Informe o nome do operador do plantao.");
    return;
  }
  const previousValue = previousUsername ? state.plantaoOperators[previousUsername] : state.plantaoOperators[username];
  if (!typedPassword && !previousValue?.passwordHash) {
    setStatus("Informe uma senha para criar ou migrar este operador.");
    return;
  }
  const nextOperators = { ...state.plantaoOperators };
  if (previousUsername && previousUsername !== username) delete nextOperators[previousUsername];
  const passwordHash = typedPassword ? await createPasswordHash(typedPassword) : previousValue.passwordHash;
  nextOperators[username] = {
    fullName,
    passwordHash
  };
  await persistPlantaoOperators(nextOperators, { verifyUsername: username, expectedHash: passwordHash });
  await writePlantaoOperatorAuditLog(previousValue ? "update" : "create", username, `Operador do plantao ${previousValue ? "atualizado" : "criado"}.`, previousValue, nextOperators[username]);
  resetPlantaoOperatorForm();
  await refreshAuditLogs();
  setStatus(`Operador ${username} salvo${typedPassword ? " com senha atualizada" : ""} e confirmado.`);
  renderAll();
}

async function removePlantaoOperator(username) {
  if (!isAdmin()) return;
  const normalizedUsername = normalizePlantaoOperatorUsername(username);
  const previousValue = state.plantaoOperators[normalizedUsername];
  if (!previousValue) return;
  if (!window.confirm(`Excluir o operador ${normalizedUsername} do relatorio de plantao?`)) return;
  const nextOperators = { ...state.plantaoOperators };
  delete nextOperators[normalizedUsername];
  await persistPlantaoOperators(nextOperators, { removedUsername: normalizedUsername });
  await writePlantaoOperatorAuditLog("delete", normalizedUsername, "Operador do plantao removido.", previousValue, null);
  resetPlantaoOperatorForm();
  await refreshAuditLogs();
  setStatus(`Operador ${normalizedUsername} excluido e confirmado.`);
  renderAll();
}

async function saveOwnerSignature() {
  if (!isAdmin()) return;
  if (!ownerSignaturePad.hasData()) {
    setStatus("Desenhe a assinatura antes de salvar.");
    return;
  }
  const signatureDataUrl = ownerSignaturePad.read();
  await db.collection("system").doc("ownerSignature").set({
    signatureDataUrl,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  state.ownerSignature.signatureDataUrl = signatureDataUrl;
  state.ownerSignature.updatedAt = new Date().toISOString();
  closeOwnerSignatureEditor();
  renderOwnerSignature();
  setStatus("Assinatura da direcao salva.");
}

async function saveUser() {
  const email = el.userEmail.value.trim().toLowerCase();
  if (!email) return;
  const previousValue = state.gateUsers[email] || null;
  const typedPassword = el.userPassword.value.trim();
  if (!typedPassword && !previousValue?.passwordHash) {
    setStatus("Informe uma senha para criar ou migrar este acesso.");
    return;
  }
  const nextUsers = { ...state.gateUsers };
  nextUsers[email] = {
    passwordHash: typedPassword ? await createPasswordHash(typedPassword) : previousValue.passwordHash,
    sector: el.userSector.value,
    permissions: {
      rh: el.permRh.checked,
      monitoramento: el.permMonitoramento.checked,
      operacional: el.permOperacional.checked,
      estrutural: el.permEstrutural.checked,
      logs: true,
      admin: el.permAdmin.checked
    }
  };
  await persistUsers(nextUsers);
  await writeAuditLog(previousValue ? "update" : "create", email, `Acesso ${previousValue ? "atualizado" : "criado"} no portal.`, previousValue, nextUsers[email]);
  el.userForm.reset();
  renderAll();
}

async function removeUser(email) {
  if (!isAdmin() || email === ADMIN_EMAIL) return;
  const nextUsers = { ...state.gateUsers };
  const previousValue = nextUsers[email];
  delete nextUsers[email];
  await persistUsers(nextUsers);
  await writeAuditLog("delete", email, "Acesso removido do portal.", previousValue, null);
  renderAll();
}

function passGate(email) {
  const account = state.gateUsers[email];
  activateUserSession({
    email,
    sector: account.sector,
    permissions: account.permissions
  });
}

function activateUserSession(user) {
  state.currentUser = {
    email: normalizeEmail(user.email),
    sector: user.sector || "rh",
    permissions: { ...defaultPermissions(), ...(user.permissions || {}) }
  };
  sessionStorage.setItem(PORTAL_SESSION_KEY, state.currentUser.email);
  localStorage.setItem(PORTAL_SESSION_KEY, state.currentUser.email);
  sessionStorage.setItem(PORTAL_SESSION_DATA_KEY, JSON.stringify(state.currentUser));
  localStorage.setItem(PORTAL_SESSION_DATA_KEY, JSON.stringify(state.currentUser));
  localStorage.setItem(PORTAL_PERSIST_KEY, state.currentUser.email);
  localStorage.setItem(PORTAL_PERSIST_DATA_KEY, JSON.stringify(state.currentUser));
  sessionStorage.setItem("rh_gate_email", state.currentUser.email);
  sessionStorage.setItem("img_operator_email", state.currentUser.email);
  localStorage.setItem("rh_gate_email", state.currentUser.email);
  localStorage.setItem("img_operator_email", state.currentUser.email);
  sessionStorage.setItem("img_operator_name", state.currentUser.email.split("@")[0].replace(/[._-]+/g, " "));
  localStorage.setItem("img_operator_name", state.currentUser.email.split("@")[0].replace(/[._-]+/g, " "));
  showApp();
  setActiveTab(requestedTab());
  renderAll();
  startCommercialAutoRefresh();
}

function recoverSessionEmail() {
  return (
    sessionStorage.getItem(PORTAL_SESSION_KEY) ||
    sessionStorage.getItem(PORTAL_PERSIST_KEY) ||
    localStorage.getItem(PORTAL_SESSION_KEY) ||
    localStorage.getItem(PORTAL_PERSIST_KEY) ||
    sessionStorage.getItem("rh_gate_email") ||
    sessionStorage.getItem("img_operator_email") ||
    localStorage.getItem("rh_gate_email") ||
    localStorage.getItem("img_operator_email") ||
    ""
  ).trim().toLowerCase();
}

function buildFallbackSession(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const storedUser = readStoredJson(PORTAL_SESSION_DATA_KEY, PORTAL_PERSIST_DATA_KEY);
  if (storedUser && normalizeEmail(storedUser.email) === normalizedEmail) {
    return {
      email: normalizedEmail,
      sector: storedUser.sector || "rh",
      permissions: { ...defaultPermissions(), ...(storedUser.permissions || {}) }
    };
  }

  const permissions = defaultPermissions();
  const rhEmail = normalizeEmail(sessionStorage.getItem("rh_gate_email") || localStorage.getItem("rh_gate_email"));
  const imgEmail = normalizeEmail(sessionStorage.getItem("img_operator_email") || localStorage.getItem("img_operator_email"));

  if (rhEmail === normalizedEmail) permissions.rh = true;
  if (imgEmail === normalizedEmail) permissions.monitoramento = true;
  if (!permissions.rh && !permissions.monitoramento) return null;

  return {
    email: normalizedEmail,
    sector: permissions.rh ? "rh" : "monitoramento",
    permissions
  };
}

async function attemptRestoreSession() {
  const persistedEmail = recoverSessionEmail();
  if (persistedEmail && state.gateUsers[persistedEmail]) {
    passGate(persistedEmail);
    if (isAdmin()) {
      await refreshAuditLogs();
      await refreshPlantaoOperators();
    }
    return;
  }
  const fallbackUser = buildFallbackSession(persistedEmail);
  if (fallbackUser) {
    activateUserSession(fallbackUser);
    return;
  }
  showLogin();
}

el.loginForm.onsubmit = async event => {
  event.preventDefault();
  el.loginError.textContent = "";
  const email = el.loginUser.value.trim().toLowerCase();
  const password = el.loginPass.value;
  const allowedUser = state.gateUsers[email];
  if (!allowedUser || !(await verifyPassword(allowedUser, password))) {
    el.loginError.textContent = "E-mail ou senha invalidos.";
    setStatus("Falha no login");
    return;
  }
  passGate(email);
  if (isAdmin()) {
    await refreshAuditLogs();
    await refreshPlantaoOperators();
  }
  setStatus("Acesso liberado");
};

el.portalAreaButtons.forEach(button => {
  button.onclick = () => showCredentialLogin(button.dataset.loginArea);
});

el.backToAreasBtn.onclick = () => {
  showAreaSelection();
};

el.logoutBtn.onclick = () => {
  sessionStorage.removeItem(PORTAL_SESSION_KEY);
  sessionStorage.removeItem(PORTAL_SESSION_DATA_KEY);
  localStorage.removeItem(PORTAL_SESSION_KEY);
  localStorage.removeItem(PORTAL_SESSION_DATA_KEY);
  localStorage.removeItem(PORTAL_PERSIST_KEY);
  localStorage.removeItem(PORTAL_PERSIST_DATA_KEY);
  sessionStorage.removeItem("rh_gate_email");
  sessionStorage.removeItem("img_operator_name");
  sessionStorage.removeItem("img_operator_email");
  localStorage.removeItem("rh_gate_email");
  localStorage.removeItem("img_operator_name");
  localStorage.removeItem("img_operator_email");
  state.currentUser = null;
  state.auditLogs = [];
  stopCommercialAutoRefresh();
  showLogin();
  setStatus("Aguardando acesso");
};

el.userForm.onsubmit = async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  await saveUser();
};

el.plantaoOperatorForm.onsubmit = async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  await savePlantaoOperator();
};

el.plantaoOperatorCancelBtn.onclick = () => {
  resetPlantaoOperatorForm();
};

el.linkSystemSelect.onchange = updateLinkDescription;

if (el.themeSelect) {
  el.themeSelect.onchange = () => {
    applyTheme(el.themeSelect.value);
  };
}

if (el.refreshCommercialBtn) {
  el.refreshCommercialBtn.onclick = () => {
    loadCommercialSituation({ force: true }).catch(console.error);
  };
}

if (el.commercialViewSelect) {
  el.commercialViewSelect.onchange = () => {
    const nextView = el.commercialViewSelect.value || "executive";
    const nextFilters = {
      ...currentCommercialFilters(),
      view: nextView
    };
    if (nextView === "issues" && nextFilters.issue === "all") nextFilters.issue = "issues";
    if (nextView === "finance" && nextFilters.issue === "issues") nextFilters.issue = "all";
    state.commercialSituation.filters = nextFilters;
    renderCommercialSituation();
  };
}

if (el.commercialCollectionFilter) {
  el.commercialCollectionFilter.onchange = () => {
    state.commercialSituation.filters = {
      ...currentCommercialFilters(),
      collectionId: el.commercialCollectionFilter.value || "all"
    };
    renderCommercialSituation();
  };
}

if (el.commercialIssueFilter) {
  el.commercialIssueFilter.onchange = () => {
    state.commercialSituation.filters = {
      ...currentCommercialFilters(),
      issue: el.commercialIssueFilter.value || "all"
    };
    renderCommercialSituation();
  };
}

el.linkForm.onsubmit = async event => {
  event.preventDefault();
  await createSelectedPublicLink();
};

el.copyCreatedLinkBtn.onclick = () => {
  copyCreatedLink();
};

el.ownerSignatureEditBtn.onclick = () => {
  if (!isAdmin()) return;
  el.ownerSignatureEditor.classList.remove("hidden");
  ownerSignaturePad.setEnabled(true);
  ownerSignaturePad.load(state.ownerSignature.signatureDataUrl || "");
  ownerSignaturePad.resize();
};

el.ownerSignatureClearBtn.onclick = () => {
  ownerSignaturePad.clear();
};

el.ownerSignatureCancelBtn.onclick = () => {
  closeOwnerSignatureEditor();
};

el.ownerSignatureSaveBtn.onclick = () => {
  saveOwnerSignature().catch(error => {
    console.error(error);
    setStatus("Falha ao salvar a assinatura.");
  });
};

document.querySelectorAll(".tab-btn").forEach(button => {
  button.onclick = async () => {
    if (button.classList.contains("hidden")) return;
    setActiveTab(button.dataset.tab);
    if ((button.dataset.tab === "admin" && isAdmin()) || button.dataset.tab === "logs") {
      await refreshAuditLogs();
    }
    if (button.dataset.tab === "admin" && isAdmin()) {
      await refreshPlantaoOperators();
    }
    if (button.dataset.tab === "commercial") {
      await loadCommercialSituation({ force: true });
    }
  };
});

async function boot() {
  renderThemeOptions();
  applyTheme(localStorage.getItem(PORTAL_THEME_KEY) || "light");
  useDefaultGateUsers();
  await attemptRestoreSession();
  renderOwnerSignature();
  setStatus(state.currentUser ? "Acesso liberado" : "Aguardando acesso");
  refreshRemotePortalData().catch(error => {
    rememberRemoteDataWarning("sincronizacao do portal", error);
  });
}

window.addEventListener("resize", () => {
  if (!el.ownerSignatureEditor.classList.contains("hidden")) {
    ownerSignaturePad.resize();
  }
});

boot().catch(error => {
  el.loginError.textContent = error.message;
  setStatus("Falha ao iniciar");
  showLogin();
});
