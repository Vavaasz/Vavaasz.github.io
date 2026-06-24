(function () {
  const THEME_KEY = "tka_theme";
  const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  const OPERATOR_SESSION_KEY = "tka_shift_operator_session";
  const LOGO_PATH = "/comercial/contratos/assets/TKA-logo.jpeg";
  const REPORTS_COLLECTION = "monitoring_shift_reports";
  const OPERATORS_DOC = "shiftReportOperators";
  const SHARED_CATALOG_DOC = "shiftReportSharedCatalog";
  const SYSTEM_COLLECTION = "system";
  const LOGS_COLLECTION = "monitoring_shift_report_logs";
  const AUTO_SAVE_DELAY_MS = 60000;
  const LOCAL_MONITORAMENTO_BASE = "http://127.0.0.1:18991";
  const FIRESTORE_READ_BACKOFF_KEY = "tka_plantao_firestore_read_backoff_until";
  const FIRESTORE_QUOTA_BACKOFF_MS = 15 * 60 * 1000;
  const MANAGER_EMAILS = new Set(["comercial@grupotka.com.br", "comercial@grupotka", "admin@grupotka.com.br", "admin@grupotka"]);
  const MANAGER_SECTORS = new Set(["admin", "comercial"]);
  const OFFLINE_TYPES = ["Alarmes", "Imagens", "Alarmes e Imagens"];
  const YES_NO = ["Sim", "Não"];
  const REMOTE_ACTIONS = ["Arme", "Desarme", "Outros"];
  const STATUS_OPTIONS = ["Operante", "Em Falha"];
  const HANDOFF_STATUS_OPTIONS = ["Pendente", "Resolvido", "Repassado"];
  const ASSISTANT_DECISIONS = {
    accept: "aceito",
    qru: "qru",
    handoff: "repassado",
    resolve: "resolvido",
    ignore: "ignorado"
  };
  const DEFAULT_OPERATORS = {
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

  const blankOffline = () => ({ name: "", mode: OFFLINE_TYPES[0], chamadoAberto: YES_NO[1] });
  const blankClientInfo = () => ({ time: "", note: "" });
  const blankRemoteArm = () => ({ name: "", time: "", action: REMOTE_ACTIONS[0], details: "" });
  const blankRonda = () => ({ client: "", camerasOnline: "", camerasInstalled: "", note: "" });
  const blankZtrax = () => ({ client: "", radioHt: STATUS_OPTIONS[0], ztrax: STATUS_OPTIONS[0], note: "" });
  const blankHandoff = () => ({ title: "", source: "", status: HANDOFF_STATUS_OPTIONS[0], nextAction: "", note: "", sourceId: "" });

  function isOfflineBlank(item) {
    return !item?.name && (item?.mode || OFFLINE_TYPES[0]) === OFFLINE_TYPES[0] && (item?.chamadoAberto || YES_NO[1]) === YES_NO[1];
  }

  function isClientInfoBlank(item) {
    return !item?.time && !item?.note;
  }

  function isRemoteArmBlank(item) {
    return !item?.name && !item?.time && !item?.details && (item?.action || REMOTE_ACTIONS[0]) === REMOTE_ACTIONS[0];
  }

  function isRondaBlank(item) {
    return !item?.client && !item?.camerasOnline && !item?.camerasInstalled && !item?.note;
  }

  function isZtraxBlank(item) {
    return !item?.client && !item?.note && (item?.radioHt || STATUS_OPTIONS[0]) === STATUS_OPTIONS[0] && (item?.ztrax || STATUS_OPTIONS[0]) === STATUS_OPTIONS[0];
  }

  function isHandoffBlank(item) {
    return !item?.title && !item?.source && !item?.nextAction && !item?.note && !item?.sourceId && (item?.status || HANDOFF_STATUS_OPTIONS[0]) === HANDOFF_STATUS_OPTIONS[0];
  }

  function withTrailingBlank(rows, blankFactory, isBlank) {
    const list = Array.isArray(rows) ? rows.map(item => ({ ...item })) : [];
    if (!list.length || !isBlank(list[list.length - 1])) {
      list.push(blankFactory());
    }
    return list;
  }

  function trimTrailingBlankRows(rows, isBlank) {
    const list = Array.isArray(rows) ? rows.map(item => ({ ...item })) : [];
    while (list.length && isBlank(list[list.length - 1])) {
      list.pop();
    }
    return list;
  }

  function toLocalInputValue(date) {
    if (!date) return "";
    const source = typeof date.toDate === "function" ? date.toDate() : new Date(date);
    if (Number.isNaN(source.getTime())) return "";
    const offset = source.getTimezoneOffset();
    const local = new Date(source.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function defaultShiftWindow() {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (now.getHours() >= 7 && now.getHours() < 19) {
      start.setHours(7, 0, 0, 0);
      end.setHours(19, 0, 0, 0);
    } else if (now.getHours() >= 19) {
      start.setHours(19, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(7, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - 1);
      start.setHours(19, 0, 0, 0);
      end.setHours(7, 0, 0, 0);
    }
    return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
  }

  function blankReport(operatorUsername, operators) {
    const shift = defaultShiftWindow();
    const operator = operators?.[operatorUsername] || {};
    return {
      id: "",
      operatorUsername: operatorUsername || "",
      fullName: operator.fullName || "",
      shiftStart: shift.start,
      shiftEnd: shift.end,
      offlineClients: [blankOffline()],
      clientInfo: [blankClientInfo(), blankClientInfo()],
      teamInfo: "",
      remoteArms: [blankRemoteArm()],
      rondaEntries: [blankRonda()],
      ztraxEntries: [blankZtrax()],
      handoffItems: [],
      assistedImports: [],
      qruDescription: "",
      qruImages: [],
      archived: false,
      lastEditedByName: "",
      lastEditedByEmail: "",
      lastEditedByType: "",
      lastEditedAt: null,
      createdAt: null,
      updatedAt: null
    };
  }

  const state = {
    portalUser: null,
    actor: null,
    operators: {},
    sharedCatalog: {
      rondaEntries: [],
      ztraxEntries: []
    },
    reports: [],
    logs: [],
    assistant: {
      loading: false,
      generatedAt: "",
      source: "",
      summary: null,
      items: [],
      error: ""
    },
    currentId: "",
    draft: null,
    sidebarTab: "ativos",
    lastSavedFingerprint: "",
    loading: false
  };

  const el = {
    loginView: document.getElementById("loginView"),
    appView: document.getElementById("appView"),
    loginForm: document.getElementById("loginForm"),
    loginHelp: document.getElementById("loginHelp"),
    loginUsername: document.getElementById("loginUsername"),
    loginUsernameLabel: document.getElementById("loginUsernameLabel"),
    loginPassword: document.getElementById("loginPassword"),
    loginError: document.getElementById("loginError"),
    operatorCredentialHelp: document.getElementById("operatorCredentialHelp"),
    homeLink: document.getElementById("homeLink"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    newReportBtn: document.getElementById("newReportBtn"),
    saveReportBtn: document.getElementById("saveReportBtn"),
    savePdfBtn: document.getElementById("savePdfBtn"),
    archiveReportBtn: document.getElementById("archiveReportBtn"),
    deleteReportBtn: document.getElementById("deleteReportBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    actorLabel: document.getElementById("actorLabel"),
    accessLabel: document.getElementById("accessLabel"),
    saveStatus: document.getElementById("saveStatus"),
    activeList: document.getElementById("activeList"),
    archivedList: document.getElementById("archivedList"),
    archivedTabBtn: document.getElementById("archivedTabBtn"),
    reportOperator: document.getElementById("reportOperator"),
    reportFullName: document.getElementById("reportFullName"),
    shiftStart: document.getElementById("shiftStart"),
    shiftEnd: document.getElementById("shiftEnd"),
    lastEditedBadge: document.getElementById("lastEditedBadge"),
    editWindowNote: document.getElementById("editWindowNote"),
    offlineRows: document.getElementById("offlineRows"),
    clientInfoRows: document.getElementById("clientInfoRows"),
    teamInfo: document.getElementById("teamInfo"),
    remoteArmRows: document.getElementById("remoteArmRows"),
    rondaRows: document.getElementById("rondaRows"),
    ztraxRows: document.getElementById("ztraxRows"),
    handoffRows: document.getElementById("handoffRows"),
    refreshAssistantBtn: document.getElementById("refreshAssistantBtn"),
    assistantStatus: document.getElementById("assistantStatus"),
    assistantSummary: document.getElementById("assistantSummary"),
    assistantItems: document.getElementById("assistantItems"),
    qruDescription: document.getElementById("qruDescription"),
    qruImageInput: document.getElementById("qruImageInput"),
    qruImages: document.getElementById("qruImages"),
    addOfflineBtn: document.getElementById("addOfflineBtn"),
    addClientInfoBtn: document.getElementById("addClientInfoBtn"),
    addRemoteArmBtn: document.getElementById("addRemoteArmBtn"),
    addRondaBtn: document.getElementById("addRondaBtn"),
    addZtraxBtn: document.getElementById("addZtraxBtn"),
    addHandoffBtn: document.getElementById("addHandoffBtn"),
    adminPanel: document.getElementById("adminPanel"),
    operatorForm: document.getElementById("operatorForm"),
    operatorUsernameField: document.getElementById("operatorUsernameField"),
    operatorFullNameField: document.getElementById("operatorFullNameField"),
    operatorPasswordField: document.getElementById("operatorPasswordField"),
    operatorList: document.getElementById("operatorList"),
    adminLogList: document.getElementById("adminLogList")
  };

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.RH_FIREBASE_CONFIG);
  const db = firebase.firestore(app);
  let saveTimer = null;
  let logoDataUrlPromise = null;

  function readFirestoreBackoffUntil() {
    try {
      return Number(localStorage.getItem(FIRESTORE_READ_BACKOFF_KEY) || "0") || 0;
    } catch (error) {
      return 0;
    }
  }

  function firestoreReadBackoffActive() {
    return readFirestoreBackoffUntil() > Date.now();
  }

  function applyFirestoreReadBackoff() {
    try {
      localStorage.setItem(FIRESTORE_READ_BACKOFF_KEY, String(Date.now() + FIRESTORE_QUOTA_BACKOFF_MS));
    } catch (error) {
      // Keep the current session fallback even if localStorage is unavailable.
    }
  }

  function clearFirestoreReadBackoff() {
    try {
      localStorage.removeItem(FIRESTORE_READ_BACKOFF_KEY);
    } catch (error) {
      // A successful read is enough for this tab.
    }
  }

  function isFirestoreQuotaError(error) {
    const text = String(error?.code || error?.message || error?.name || "").toLowerCase();
    return text.includes("resource-exhausted") || text.includes("quota") || text.includes("429");
  }

  async function readDocWithQuotaFallback(docRef) {
    if (firestoreReadBackoffActive()) {
      try {
        return await docRef.get({ source: "cache" });
      } catch (error) {
        return null;
      }
    }
    try {
      const snapshot = await docRef.get({ source: "server" });
      clearFirestoreReadBackoff();
      return snapshot;
    } catch (error) {
      if (!isFirestoreQuotaError(error)) throw error;
      applyFirestoreReadBackoff();
      try {
        return await docRef.get({ source: "cache" });
      } catch (cacheError) {
        return null;
      }
    }
  }

  async function runSeedWhenFirestoreAvailable(seedFn) {
    if (firestoreReadBackoffActive()) return;
    try {
      await seedFn();
      clearFirestoreReadBackoff();
    } catch (error) {
      if (isFirestoreQuotaError(error)) {
        applyFirestoreReadBackoff();
        return;
      }
      throw error;
    }
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
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
      return (await derivePasswordHash(password, hashConfig)) === hashConfig.hash;
    }
    return Boolean(account?.legacyPassword && account.legacyPassword === password);
  }

  function normalizeOperatorAccounts(accounts) {
    return Object.fromEntries(Object.entries(accounts || {}).map(([username, account]) => [
      username,
      {
        fullName: account?.fullName || username,
        passwordHash: normalizePasswordHash(account?.passwordHash),
        legacyPassword: typeof account?.password === "string" ? account.password : ""
      }
    ]));
  }

  function serializeOperatorAccountsForStorage(accounts) {
    return Object.fromEntries(Object.entries(accounts || {}).map(([username, account]) => [
      username,
      {
        fullName: account?.fullName || username,
        passwordHash: normalizePasswordHash(account?.passwordHash)
      }
    ]));
  }

  function normalizePortalUser(user) {
    if (!user) return null;
    return {
      email: String(user.email || "").trim().toLowerCase(),
      sector: user.sector || "",
      permissions: { ...(user.permissions || {}) }
    };
  }

  function readPortalUser() {
    try {
      const raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY) || localStorage.getItem(PORTAL_SESSION_DATA_KEY);
      return raw ? normalizePortalUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function readOperatorSession() {
    try {
      const raw = sessionStorage.getItem(OPERATOR_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeOperatorSession(actor) {
    sessionStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify(actor));
  }

  function clearOperatorSession() {
    sessionStorage.removeItem(OPERATOR_SESSION_KEY);
  }

  function normalizeAccessToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function hasManagerAccess(user) {
    if (!user) return false;
    const permissions = user.permissions || {};
    return Boolean(
      permissions.admin ||
      permissions.comercial ||
      permissions.manageReports ||
      MANAGER_EMAILS.has(normalizeAccessToken(user.email)) ||
      MANAGER_SECTORS.has(normalizeAccessToken(user.sector))
    );
  }

  function isPortalManager() {
    return hasManagerAccess(state.portalUser);
  }

  function canManageReports() {
    return isPortalManager();
  }

  function actorDisplay() {
    if (!state.actor) return "Sem sessão";
    if (state.actor.kind === "portal") return `${state.actor.displayName} | gerenciamento`;
    return `${state.actor.displayName} | ${state.actor.username}`;
  }

  function actorName() {
    return state.actor?.displayName || "";
  }

  function actorEmail() {
    return state.actor?.email || "";
  }

  function setStatus(text) {
    el.saveStatus.textContent = text;
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    el.themeToggleBtn.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
    localStorage.setItem(THEME_KEY, document.body.dataset.theme);
  }

  function showLogin() {
    el.loginView.classList.remove("hidden");
    el.appView.classList.add("hidden");
  }

  function showApp() {
    el.loginView.classList.add("hidden");
    el.appView.classList.remove("hidden");
  }

  function formatDateTime(value) {
    if (!value) return "Data pendente";
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? "Data pendente" : date.toLocaleString("pt-BR");
  }

  function formatShortDate(value) {
    if (!value) return "Sem horário";
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? "Sem horário" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function formatTimeOnly(value) {
    if (!value) return "";
    if (value.includes("T")) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }
    }
    return value;
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function queryParams() {
    return new URLSearchParams(window.location.search);
  }

  function requestedUser() {
    return queryParams().get("usuario") || "";
  }

  function isPublicOperatorLink() {
    return queryParams().get("publico") === "1";
  }

  function currentRecord() {
    if (state.draft) {
      if (!state.currentId) return state.draft;
      if (!state.draft.id || state.draft.id === state.currentId) return state.draft;
    }
    if (!state.currentId) return state.draft;
    return state.reports.find(item => item.id === state.currentId) || state.draft;
  }

  function currentOrBlank() {
    return currentRecord() || blankReport(state.actor?.username || "", state.operators);
  }

  function currentSharedCatalog() {
    return {
      rondaEntries: Array.isArray(state.sharedCatalog.rondaEntries) ? state.sharedCatalog.rondaEntries : [],
      ztraxEntries: Array.isArray(state.sharedCatalog.ztraxEntries) ? state.sharedCatalog.ztraxEntries : []
    };
  }

  function activeReports() {
    const source = state.reports.filter(item => !item.archived);
    if (canManageReports()) return source;
    if (state.actor?.kind !== "operator") return [];
    return source.filter(item => item.operatorUsername === state.actor.username);
  }

  function archivedReports() {
    if (!canManageReports()) return [];
    return state.reports.filter(item => item.archived);
  }

  function getOperatorOptions() {
    const entries = Object.keys(state.operators).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (canManageReports()) return [...entries, "administrativo"];
    return state.actor?.kind === "operator" ? [state.actor.username] : entries;
  }

  function fillOperatorSelect(selected) {
    const options = getOperatorOptions();
    el.reportOperator.innerHTML = options.map(option => {
      const label = option === "administrativo" ? "administrativo" : `${option} - ${state.operators[option]?.fullName || option}`;
      return `<option value="${option}">${label}</option>`;
    }).join("");
    el.reportOperator.value = options.includes(selected) ? selected : options[0] || "";
    el.reportOperator.disabled = !canManageReports();
  }

  function fingerprint(report) {
    return JSON.stringify({
      operatorUsername: report.operatorUsername,
      fullName: report.fullName,
      shiftStart: report.shiftStart,
      shiftEnd: report.shiftEnd,
      offlineClients: report.offlineClients,
      clientInfo: report.clientInfo,
      teamInfo: report.teamInfo,
      remoteArms: report.remoteArms,
      rondaEntries: report.rondaEntries,
      ztraxEntries: report.ztraxEntries,
      handoffItems: report.handoffItems,
      assistedImports: report.assistedImports,
      qruDescription: report.qruDescription,
      qruImages: (report.qruImages || []).map(item => ({
        id: item.id,
        label: item.label,
        name: item.name,
        type: item.type,
        size: item.size,
        dataUrl: item.dataUrl
      })),
      archived: Boolean(report.archived)
    });
  }

  function editWindowInfo(report) {
    const shiftEnd = parseDate(report?.shiftEnd);
    if (!shiftEnd) {
      return { editable: canManageReports(), reason: "Defina o fim do plantão para ativar o controle de edição." };
    }
    const deadline = new Date(shiftEnd.getTime() + 60 * 60 * 1000);
    if (canManageReports()) {
      return { editable: true, reason: `Edição administrativa liberada. A janela original encerraria em ${deadline.toLocaleString("pt-BR")}.` };
    }
    if (state.actor?.kind !== "operator") {
      return { editable: false, reason: "Entre como operador para editar este relatório." };
    }
    if (report.operatorUsername !== state.actor.username) {
      return { editable: false, reason: "Este relatório pertence a outro operador." };
    }
    if (report.archived) {
      return { editable: false, reason: "Relatório arquivado. Somente comercial ou admin podem editar." };
    }
    if (Date.now() <= deadline.getTime()) {
      return { editable: true, reason: `Edição liberada até ${deadline.toLocaleString("pt-BR")}.` };
    }
    return { editable: false, reason: `Janela de edição encerrada em ${deadline.toLocaleString("pt-BR")}.` };
  }

  function canEditCurrentReport() {
    return editWindowInfo(currentOrBlank()).editable;
  }

  function downloadName(item) {
    const base = (item.label || item.name || "imagem-plantao")
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "imagem-plantao";
    const ext = item.name && item.name.includes(".") ? item.name.split(".").pop() : "png";
    return `${base}.${ext}`;
  }

  function renderReportList() {
    const renderItems = (container, items, emptyText) => {
      if (!items.length) {
        container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
        return;
      }
      const cards = [...items]
        .sort((a, b) => {
          const aTime = parseDate(a.shiftStart || a.updatedAt)?.getTime() || 0;
          const bTime = parseDate(b.shiftStart || b.updatedAt)?.getTime() || 0;
          return bTime - aTime;
        })
        .map(item => `
          <button class="report-card${item.id === state.currentId ? " active" : ""}" type="button" data-select-report="${item.id}">
            <div class="report-head">
              <strong>${item.operatorUsername || "sem-operador"}</strong>
              <span class="chip">${item.archived ? "Arquivado" : "Ativo"}</span>
            </div>
            <div class="report-meta">
              <span>${item.fullName || "Sem nome"} | ${formatShortDate(item.shiftStart)} - ${formatShortDate(item.shiftEnd)}</span>
              <small>${item.lastEditedByName ? `Última edição: ${item.lastEditedByName}` : "Sem edições"}</small>
            </div>
          </button>
        `)
        .join("");
      container.innerHTML = cards;
    };

    renderItems(el.activeList, activeReports(), "Nenhum relatório ativo.");
    renderItems(el.archivedList, archivedReports(), "Nenhum relatório arquivado.");
  }

  function renderOfflineRows(rows) {
    el.offlineRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid">
          <label class="field">Cliente
            <input data-offline-name="${index}" type="text" value="${escapeHtml(item.name)}" />
          </label>
          <label class="field">Tipo
            <select data-offline-mode="${index}">
              ${OFFLINE_TYPES.map(option => `<option value="${option}" ${option === item.mode ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">Chamado aberto
            <select data-offline-chamado="${index}">
              ${YES_NO.map(option => `<option value="${option}" ${option === item.chamadoAberto ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <button class="icon-btn" title="Remover linha" type="button" data-remove-offline="${index}">✕</button>
        </div>
      </article>
    `).join("");
  }

  function renderClientInfoRows(rows) {
    el.clientInfoRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid info-grid">
          <label class="field">Horário
            <input data-client-info-time="${index}" type="time" value="${escapeHtml(item.time)}" />
          </label>
          <label class="field">Informação
            <input data-client-info-note="${index}" type="text" value="${escapeHtml(item.note)}" placeholder="Ex.: desarme, atenção, arme..." />
          </label>
          <button class="icon-btn" title="Remover linha" type="button" data-remove-client-info="${index}">✕</button>
        </div>
      </article>
    `).join("");
  }

  function renderRemoteArmRows(rows) {
    el.remoteArmRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid remote-grid">
          <label class="field">Cliente
            <input data-remote-name="${index}" type="text" value="${escapeHtml(item.name)}" />
          </label>
          <label class="field">Horário
            <input data-remote-time="${index}" type="time" value="${escapeHtml(item.time)}" />
          </label>
          <label class="field">Ação
            <select data-remote-action="${index}">
              ${REMOTE_ACTIONS.map(option => `<option value="${option}" ${option === item.action ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">Detalhe
            <input data-remote-details="${index}" type="text" value="${escapeHtml(item.details)}" placeholder="Motivo ou complemento" />
          </label>
          <button class="icon-btn" title="Remover linha" type="button" data-remove-remote="${index}">✕</button>
        </div>
      </article>
    `).join("");
  }

  function renderRondaRows(rows) {
    el.rondaRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid ronda-grid">
          <label class="field">Cliente
            <input data-ronda-client="${index}" type="text" value="${escapeHtml(item.client)}" />
          </label>
          <label class="field">Câmeras online
            <input data-ronda-online="${index}" type="number" min="0" value="${escapeHtml(item.camerasOnline)}" />
          </label>
          <label class="field">Câmeras instaladas
            <input data-ronda-installed="${index}" type="number" min="0" value="${escapeHtml(item.camerasInstalled)}" />
          </label>
          <label class="field">Observação
            <input data-ronda-note="${index}" type="text" value="${escapeHtml(item.note)}" />
          </label>
          <button class="icon-btn" title="Remover linha" type="button" data-remove-ronda="${index}">✕</button>
        </div>
      </article>
    `).join("");
  }

  function renderZtraxRows(rows) {
    el.ztraxRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid ztrax-grid">
          <label class="field">Cliente
            <input data-ztrax-client="${index}" type="text" value="${escapeHtml(item.client)}" />
          </label>
          <label class="field">Rádio HT
            <select data-ztrax-radio="${index}">
              ${STATUS_OPTIONS.map(option => `<option value="${option}" ${option === item.radioHt ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">Ztrax
            <select data-ztrax-status="${index}">
              ${STATUS_OPTIONS.map(option => `<option value="${option}" ${option === item.ztrax ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">Observação
            <input data-ztrax-note="${index}" type="text" value="${escapeHtml(item.note)}" />
          </label>
          <button class="icon-btn" title="Remover linha" type="button" data-remove-ztrax="${index}">✕</button>
        </div>
      </article>
    `).join("");
  }

  function renderHandoffRows(rows) {
    el.handoffRows.innerHTML = rows.map((item, index) => `
      <article class="row-card">
        <div class="row-card-grid handoff-grid">
          <label class="field">Pendencia
            <input data-handoff-title="${index}" type="text" value="${escapeHtml(item.title)}" placeholder="Ex.: Ztrax em falha no cliente X" />
          </label>
          <label class="field">Origem
            <input data-handoff-source="${index}" type="text" value="${escapeHtml(item.source)}" placeholder="Monitoramento, QRU, operador..." />
          </label>
          <label class="field">Status
            <select data-handoff-status="${index}">
              ${HANDOFF_STATUS_OPTIONS.map(option => `<option value="${option}" ${option === item.status ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
          <label class="field">Proxima acao
            <input data-handoff-next-action="${index}" type="text" value="${escapeHtml(item.nextAction)}" />
          </label>
          <label class="field">Observacao
            <input data-handoff-note="${index}" type="text" value="${escapeHtml(item.note)}" />
          </label>
          <button class="icon-btn success" title="Marcar resolvido" type="button" data-resolve-handoff="${index}">OK</button>
          <button class="icon-btn" title="Remover repasse" type="button" data-remove-handoff="${index}">âœ•</button>
        </div>
      </article>
    `).join("");
  }

  function stableAssistantHash(value) {
    let hash = 5381;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  }

  function normalizeAssistantText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s:.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function firstTextValue(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function rowEvidenceText(row) {
    return firstTextValue(
      row.fullText,
      row.textFull,
      row.lastReportTextFull,
      row.text,
      row.lastReportText,
      row.aiSuggestion?.fullText,
      row.aiSuggestion?.text,
      row.aiSuggestion?.summary
    );
  }

  function rowSourceId(row) {
    return firstTextValue(row.sourceMessageId, row.reportId, row.messageId, row.key, row.id);
  }

  function rowPlaceName(row) {
    return firstTextValue(row.placeName, row.groupSubject, row.contactName, row.workerName, "Cliente nao identificado");
  }

  function rowSourceAt(row) {
    return firstTextValue(row.lastReportAt, row.lastEvidenceAt, row.firstReportAt, row.missingAt, row.deadlineAt, row.hourKey);
  }

  function sourceTimeLabel(value) {
    return value ? formatShortDate(value) : "sem horario";
  }

  function ztraxStatusFromText(text) {
    if (/\b(em falha|falha|defeito|inoperante|fora(?: do ar| de funcionamento)?|offline|off line|sem sinal|sem conexao|parado|travado|nao operante|nao funciona)\b/.test(text)) {
      return STATUS_OPTIONS[1];
    }
    if (/\b(operante|funcionando|online|normal|ok|sem alteracao|sem alteracoes|sem problema|sem problemas|estavel)\b/.test(text)) {
      return STATUS_OPTIONS[0];
    }
    return "";
  }

  function buildAssistantItemId(kind, row, evidenceText) {
    return `${kind}-${stableAssistantHash([kind, rowSourceId(row), rowPlaceName(row), rowSourceAt(row), evidenceText].join("|"))}`;
  }

  function extractZtraxItem(row) {
    const evidenceText = rowEvidenceText(row);
    const normalized = normalizeAssistantText(evidenceText);
    const hasZtrax = /\b(z\s*[- ]?\s*trax|ztrax|ztx)\b/.test(normalized);
    const hasRadio = /\b(radio\s*ht|radio|ht)\b/.test(normalized);
    if (!hasZtrax && !hasRadio) return null;
    const status = ztraxStatusFromText(normalized);
    if (!status) return null;
    const place = rowPlaceName(row);
    const sourceAt = rowSourceAt(row);
    const entry = {
      client: place,
      radioHt: hasRadio ? status : STATUS_OPTIONS[0],
      ztrax: hasZtrax ? status : STATUS_OPTIONS[0],
      note: `[WhatsApp ${sourceTimeLabel(sourceAt)}] ${evidenceText || row.lastReportSemantic || "Status recebido sem texto."}`
    };
    return {
      id: buildAssistantItemId("ztrax", row, evidenceText),
      kind: "ztrax",
      severity: status === STATUS_OPTIONS[1] ? "attention" : "info",
      title: `Ztrax/Radio HT - ${place}`,
      summary: `Radio HT: ${entry.radioHt}. Ztrax: ${entry.ztrax}.`,
      source: "WhatsApp Monitoramento",
      sourceId: rowSourceId(row),
      sourceAt,
      evidenceText,
      nextAction: status === STATUS_OPTIONS[1] ? "Acompanhar falha ate normalizar ou repassar ao proximo turno." : "Registrar estado operacional no relatorio.",
      ztraxEntry: entry
    };
  }

  function buildIncidentItem(row) {
    const evidenceText = rowEvidenceText(row);
    const reviewReason = String(row.reviewReason || "");
    const semantic = normalizeAssistantText(row.lastReportSemantic || "");
    const normalized = normalizeAssistantText(evidenceText);
    const isIncident = reviewReason === "incident_keyword" || /\b(ocorrencia|incidente|alarme|emergencia|sinistro|furto|roubo|invasao|problema|suspeit)\b/.test(`${semantic} ${normalized}`);
    if (!isIncident) return null;
    const place = rowPlaceName(row);
    const sourceAt = rowSourceAt(row);
    return {
      id: buildAssistantItemId("incident", row, evidenceText),
      kind: "incident",
      severity: "critical",
      title: `Incidente para revisar - ${place}`,
      summary: row.lastReportSemantic || reviewReason || "Possivel incidente do Monitoramento.",
      source: "WhatsApp Monitoramento",
      sourceId: rowSourceId(row),
      sourceAt,
      evidenceText,
      nextAction: "Confirmar tratativa, criar QRU se procedente, ou repassar ao proximo turno."
    };
  }

  function buildHandoffSuggestion(row) {
    const evidenceText = rowEvidenceText(row);
    const reviewReason = String(row.reviewReason || "");
    const statusText = normalizeAssistantText(`${row.status || ""} ${row.intent || ""} ${reviewReason || ""}`);
    const due = Boolean(row.due || row.missingAt || row.lateMinutes || /\b(missing|late|atras|pendente|review|revisar|mismatch)\b/.test(statusText));
    if (!due) return null;
    const place = rowPlaceName(row);
    const sourceAt = rowSourceAt(row);
    return {
      id: buildAssistantItemId("handoff", row, evidenceText),
      kind: "handoff",
      severity: "attention",
      title: `Pendencia Monitoramento - ${place}`,
      summary: firstTextValue(row.lastReportSemantic, reviewReason, row.status, "Registro pendente de revisao."),
      source: "WhatsApp Monitoramento",
      sourceId: rowSourceId(row),
      sourceAt,
      evidenceText,
      nextAction: "Validar no Monitoramento e manter no repasse se continuar aberto."
    };
  }

  function uniqueAssistantRows(statusData) {
    const candidates = [
      ...(Array.isArray(statusData?.current?.rows) ? statusData.current.rows : []),
      ...(Array.isArray(statusData?.current?.dueRows) ? statusData.current.dueRows : []),
      ...(Array.isArray(statusData?.dueRows) ? statusData.dueRows : [])
    ];
    const seen = new Set();
    return candidates.filter(row => {
      const key = rowSourceId(row) || stableAssistantHash(JSON.stringify(row));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildAssistantPreview(health, statusData) {
    const rows = uniqueAssistantRows(statusData);
    const items = [];
    for (const row of rows) {
      const ztraxItem = extractZtraxItem(row);
      if (ztraxItem) items.push(ztraxItem);
      const incidentItem = buildIncidentItem(row);
      if (incidentItem) items.push(incidentItem);
      const handoffItem = buildHandoffSuggestion(row);
      if (handoffItem) items.push(handoffItem);
    }
    const deduped = [];
    const seen = new Set();
    for (const item of items) {
      const checksum = stableAssistantHash([item.kind, item.sourceId, item.title, item.summary, item.evidenceText].join("|"));
      if (seen.has(checksum)) continue;
      seen.add(checksum);
      deduped.push({ ...item, checksum });
    }
    return {
      loading: false,
      generatedAt: new Date().toISOString(),
      source: "Monitoramento local 127.0.0.1:18991",
      summary: {
        connected: Boolean(health?.connected),
        connectionState: health?.connectionState || "",
        qrRequired: Boolean(health?.qrRequired),
        reportCount: Number(health?.reportCount || 0),
        reviewReports: Number(health?.reviewReports || 0),
        currentHourKey: statusData?.currentHourKey || "",
        rowCount: rows.length,
        ztraxCount: deduped.filter(item => item.kind === "ztrax").length,
        incidentCount: deduped.filter(item => item.kind === "incident").length,
        handoffCount: deduped.filter(item => item.kind === "handoff").length
      },
      items: deduped
        .sort((a, b) => {
          const severityOrder = { critical: 0, attention: 1, info: 2 };
          return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        })
        .slice(0, 30),
      error: ""
    };
  }

  async function fetchAssistantJson(path) {
    const response = await fetch(`${LOCAL_MONITORAMENTO_BASE}${path}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Monitoramento ${path} retornou ${response.status}`);
    return response.json();
  }

  async function refreshAssistantPreview() {
    if (!state.actor) return;
    state.assistant = {
      ...state.assistant,
      loading: true,
      error: ""
    };
    renderAssistant();
    try {
      const [health, statusData] = await Promise.all([
        fetchAssistantJson("/health"),
        fetchAssistantJson("/monitoramento/status.json")
      ]);
      state.assistant = buildAssistantPreview(health, statusData);
      setStatus("Previa do assistente atualizada. Revise antes de aplicar.");
    } catch (error) {
      state.assistant = {
        loading: false,
        generatedAt: new Date().toISOString(),
        source: "Monitoramento local 127.0.0.1:18991",
        summary: null,
        items: [],
        error: error.message || "Falha ao atualizar previa."
      };
      setStatus("Falha ao atualizar previa do assistente.");
    }
    renderAssistant();
  }

  function renderAssistant() {
    if (!el.assistantStatus || !el.assistantSummary || !el.assistantItems) return;
    const assistant = state.assistant || {};
    if (assistant.loading) {
      el.assistantStatus.className = "note-box";
      el.assistantStatus.textContent = "Consultando Monitoramento local...";
      el.assistantSummary.innerHTML = "";
      el.assistantItems.innerHTML = "";
      return;
    }
    if (assistant.error) {
      el.assistantStatus.className = "note-box warning";
      el.assistantStatus.textContent = assistant.error;
      el.assistantSummary.innerHTML = "";
      el.assistantItems.innerHTML = "";
      return;
    }
    if (!assistant.generatedAt) {
      el.assistantStatus.className = "note-box";
      el.assistantStatus.textContent = "Aguardando atualizacao manual.";
      el.assistantSummary.innerHTML = "";
      el.assistantItems.innerHTML = '<div class="empty-state">Clique em Atualizar previa para buscar Monitoramento/Ztrax.</div>';
      return;
    }
    const summary = assistant.summary || {};
    const unhealthy = !summary.connected || summary.qrRequired;
    el.assistantStatus.className = `note-box ${unhealthy ? "warning" : "success"}`;
    el.assistantStatus.textContent = unhealthy
      ? "Monitoramento local exige atencao antes de confiar na previa."
      : "Previa pronta. Nenhum item foi aplicado automaticamente.";
    el.assistantSummary.innerHTML = `
      <span class="chip">Fonte: ${escapeHtml(assistant.source || "-")}</span>
      <span class="chip">Gerado: ${formatShortDate(assistant.generatedAt)}</span>
      <span class="chip">Conexao: ${summary.connected ? "online" : "offline"}${summary.qrRequired ? " / QR" : ""}</span>
      <span class="chip">Linhas: ${summary.rowCount || 0}</span>
      <span class="chip">Ztrax: ${summary.ztraxCount || 0}</span>
      <span class="chip">Incidentes: ${summary.incidentCount || 0}</span>
      <span class="chip">Repasses: ${summary.handoffCount || 0}</span>
    `;
    if (!assistant.items?.length) {
      el.assistantItems.innerHTML = '<div class="empty-state">Nenhuma sugestao acionavel encontrada nesta previa.</div>';
      return;
    }
    el.assistantItems.innerHTML = assistant.items.map(item => `
      <article class="assistant-card ${item.severity || "info"}">
        <div class="assistant-card-head">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p class="muted">${escapeHtml(item.summary || "")}</p>
          </div>
          <span class="chip">${escapeHtml(item.kind)}</span>
        </div>
        <div class="assistant-meta">
          <span>${escapeHtml(item.source || "-")}</span>
          <span>${escapeHtml(sourceTimeLabel(item.sourceAt))}</span>
          ${item.decision ? `<span>Decisao: ${escapeHtml(item.decision)}</span>` : ""}
        </div>
        ${item.evidenceText ? `<pre class="assistant-evidence">${escapeHtml(item.evidenceText)}</pre>` : ""}
        <div class="assistant-actions">
          <button class="button" type="button" data-assistant-action="accept" data-assistant-id="${escapeAttribute(item.id)}">${item.kind === "ztrax" ? "Aceitar no Ztrax" : "Aceitar no relatorio"}</button>
          <button class="button secondary" type="button" data-assistant-action="handoff" data-assistant-id="${escapeAttribute(item.id)}">Repassar ao proximo turno</button>
          <button class="button secondary" type="button" data-assistant-action="qru" data-assistant-id="${escapeAttribute(item.id)}">Criar QRU</button>
          <button class="button secondary" type="button" data-assistant-action="resolve" data-assistant-id="${escapeAttribute(item.id)}">Resolver</button>
          <button class="button secondary" type="button" data-assistant-action="ignore" data-assistant-id="${escapeAttribute(item.id)}">Ignorar sugestao</button>
        </div>
      </article>
    `).join("");
  }

  function appendUniqueLine(base, line) {
    const current = String(base || "").trim();
    const next = String(line || "").trim();
    if (!next) return current;
    if (current.includes(next)) return current;
    return current ? `${current}\n${next}` : next;
  }

  function handoffFromAssistantItem(item, status) {
    return {
      title: item.title || "Repasse do assistente",
      source: item.source || "Assistente do plantao",
      status: status || HANDOFF_STATUS_OPTIONS[0],
      nextAction: item.nextAction || "Acompanhar no proximo turno.",
      note: item.evidenceText || item.summary || "",
      sourceId: item.sourceId || item.id || ""
    };
  }

  function appendHandoffItem(report, item, status) {
    const next = handoffFromAssistantItem(item, status);
    report.handoffItems = trimTrailingBlankRows(report.handoffItems || [], isHandoffBlank);
    const existing = report.handoffItems.find(row => row.sourceId && row.sourceId === next.sourceId && row.title === next.title);
    if (existing) {
      existing.status = next.status;
      existing.nextAction = next.nextAction || existing.nextAction;
      existing.note = appendUniqueLine(existing.note, next.note);
      return existing;
    }
    report.handoffItems.push(next);
    return next;
  }

  function mergeZtraxEntry(report, item) {
    const entry = item.ztraxEntry;
    if (!entry) return null;
    report.ztraxEntries = trimTrailingBlankRows(report.ztraxEntries || [], isZtraxBlank);
    const targetKey = normalizeAssistantText(entry.client);
    const existing = report.ztraxEntries.find(row => normalizeAssistantText(row.client) === targetKey);
    if (existing) {
      existing.radioHt = entry.radioHt || existing.radioHt || STATUS_OPTIONS[0];
      existing.ztrax = entry.ztrax || existing.ztrax || STATUS_OPTIONS[0];
      existing.note = appendUniqueLine(existing.note, entry.note);
      return existing;
    }
    report.ztraxEntries.push({ ...entry });
    return entry;
  }

  function appendQruFromAssistant(report, item) {
    const block = [
      `[Assistente ${sourceTimeLabel(item.sourceAt)}] ${item.title || "Sugestao"}`,
      item.summary || "",
      item.evidenceText ? `Evidencia: ${item.evidenceText}` : "",
      `Proxima acao: ${item.nextAction || "Revisar tratativa."}`
    ].filter(Boolean).join("\n");
    report.qruDescription = appendUniqueLine(report.qruDescription, block);
  }

  function buildAssistedAudit(item, action, copiedFields) {
    const decision = ASSISTANT_DECISIONS[action] || action;
    return {
      id: `${Date.now()}-${stableAssistantHash(`${item.id}-${decision}`)}`,
      source: item.source || "Assistente do plantao",
      sourceKind: item.kind || "",
      sourceId: item.sourceId || item.id || "",
      sourceGeneratedAt: state.assistant?.generatedAt || "",
      sourceAt: item.sourceAt || "",
      importedAt: new Date().toISOString(),
      decision,
      operatorName: actorName(),
      operatorEmail: actorEmail(),
      checksum: item.checksum || stableAssistantHash(JSON.stringify(item)),
      title: item.title || "",
      summary: item.summary || "",
      evidenceText: item.evidenceText || "",
      copiedFields: copiedFields || {}
    };
  }

  function appendAssistedAudit(report, audit) {
    report.assistedImports = Array.isArray(report.assistedImports) ? report.assistedImports : [];
    const exists = report.assistedImports.some(item => item.checksum === audit.checksum && item.decision === audit.decision);
    if (!exists) report.assistedImports.push(audit);
  }

  function applyAssistantAction(id, action) {
    if (!canEditCurrentReport()) {
      setStatus(editWindowInfo(currentOrBlank()).reason);
      return;
    }
    const item = (state.assistant.items || []).find(candidate => candidate.id === id);
    if (!item) return;
    const report = readForm();
    let copiedFields = {};
    if (action === "accept") {
      if (item.kind === "ztrax") {
        copiedFields.ztraxEntry = mergeZtraxEntry(report, item);
      } else {
        copiedFields.handoffItem = appendHandoffItem(report, item, HANDOFF_STATUS_OPTIONS[0]);
      }
    } else if (action === "handoff") {
      copiedFields.handoffItem = appendHandoffItem(report, item, HANDOFF_STATUS_OPTIONS[0]);
    } else if (action === "qru") {
      appendQruFromAssistant(report, item);
      copiedFields.qru = true;
    } else if (action === "resolve") {
      copiedFields.resolved = true;
    } else if (action === "ignore") {
      copiedFields.ignored = true;
    }
    const audit = buildAssistedAudit(item, action, copiedFields);
    appendAssistedAudit(report, audit);
    item.decision = audit.decision;
    state.sharedCatalog = {
      rondaEntries: cloneValue(report.rondaEntries || []),
      ztraxEntries: cloneValue(report.ztraxEntries || [])
    };
    state.draft = report;
    state.lastSavedFingerprint = "";
    renderAll();
    scheduleSave();
    setStatus("Decisao do assistente registrada. Salve ou aguarde o autosave.");
  }

  function renderAttachments(items) {
    if (!items.length) {
      el.qruImages.innerHTML = '<div class="empty-state">Nenhuma imagem anexada.</div>';
      return;
    }
    el.qruImages.innerHTML = items.map((item, index) => `
      <article class="attachment-card">
        <div class="attachment-head">
          <strong>${escapeHtml(item.label || item.name || `Imagem ${index + 1}`)}</strong>
          <small class="muted">${formatDateTime(item.uploadedAt)}</small>
        </div>
        <img class="attachment-preview" src="${item.dataUrl}" alt="${escapeAttribute(item.label || item.name || "Imagem do QRU")}" />
        <div class="attachment-grid">
          <label class="field">Nome exibido
            <input data-image-label="${index}" type="text" value="${escapeHtml(item.label || "")}" placeholder="Nome que aparecerá no relatório" />
          </label>
          <a class="button secondary" href="${item.dataUrl}" download="${escapeAttribute(downloadName(item))}">Baixar</a>
          <button class="button danger" type="button" data-remove-image="${index}">Remover</button>
        </div>
      </article>
    `).join("");
  }

  function renderOperatorList() {
    if (!canManageReports()) {
      el.operatorList.innerHTML = "";
      return;
    }
    const entries = Object.entries(state.operators).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
    el.operatorList.innerHTML = entries.length ? entries.map(([username, config]) => `
      <article class="report-card">
        <div class="report-head">
          <strong>${username}</strong>
          <span class="chip">${config.fullName || "Sem nome"}</span>
        </div>
        <div class="report-meta">
          <span>Senha cadastrada</span>
        </div>
        <div class="topbar-side">
          <button class="button secondary" type="button" data-edit-operator="${username}">Editar</button>
          <button class="button danger" type="button" data-delete-operator="${username}">Excluir</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">Nenhum operador cadastrado.</div>';
  }

  function renderAdminLogs() {
    if (!canManageReports()) {
      el.adminLogList.innerHTML = "";
      return;
    }
    if (!state.logs.length) {
      el.adminLogList.innerHTML = '<div class="empty-state">Nenhum log administrativo registrado.</div>';
      return;
    }
    el.adminLogList.innerHTML = state.logs.map(item => `
      <article class="report-card">
        <div class="report-head">
          <strong>${item.title || "Ação"}</strong>
          <span class="chip">${formatDateTime(item.createdAt)}</span>
        </div>
        <div class="report-meta">
          <span>${item.summary || ""}</span>
          <small>${item.actorName || item.actorEmail || "Sistema"}</small>
        </div>
      </article>
    `).join("");
  }

  function fillForm() {
    const report = currentOrBlank();
    const sharedCatalog = currentSharedCatalog();
    fillOperatorSelect(report.operatorUsername || state.actor?.username || "administrativo");
    el.reportFullName.value = report.fullName || "";
    el.shiftStart.value = report.shiftStart || "";
    el.shiftEnd.value = report.shiftEnd || "";
    el.teamInfo.value = report.teamInfo || "";
    el.qruDescription.value = report.qruDescription || "";
    renderOfflineRows(withTrailingBlank(report.offlineClients, blankOffline, isOfflineBlank));
    renderClientInfoRows(withTrailingBlank(report.clientInfo, blankClientInfo, isClientInfoBlank));
    renderRemoteArmRows(withTrailingBlank(report.remoteArms, blankRemoteArm, isRemoteArmBlank));
    renderRondaRows(withTrailingBlank(sharedCatalog.rondaEntries, blankRonda, isRondaBlank));
    renderZtraxRows(withTrailingBlank(sharedCatalog.ztraxEntries, blankZtrax, isZtraxBlank));
    renderHandoffRows(withTrailingBlank(report.handoffItems || [], blankHandoff, isHandoffBlank));
    renderAttachments(report.qruImages || []);
    applyReadOnlyState();
  }

  function readRows(selector, mapper) {
    return Array.from(document.querySelectorAll(selector)).map(mapper);
  }

  function readSharedCatalogFromDom() {
    return {
      rondaEntries: trimTrailingBlankRows(readRows("[data-ronda-client]", input => {
        const index = Number(input.dataset.rondaClient);
        return {
          client: input.value.trim(),
          camerasOnline: document.querySelector(`[data-ronda-online="${index}"]`)?.value || "",
          camerasInstalled: document.querySelector(`[data-ronda-installed="${index}"]`)?.value || "",
          note: document.querySelector(`[data-ronda-note="${index}"]`)?.value.trim() || ""
        };
      }), isRondaBlank),
      ztraxEntries: trimTrailingBlankRows(readRows("[data-ztrax-client]", input => {
        const index = Number(input.dataset.ztraxClient);
        return {
          client: input.value.trim(),
          radioHt: document.querySelector(`[data-ztrax-radio="${index}"]`)?.value || STATUS_OPTIONS[0],
          ztrax: document.querySelector(`[data-ztrax-status="${index}"]`)?.value || STATUS_OPTIONS[0],
          note: document.querySelector(`[data-ztrax-note="${index}"]`)?.value.trim() || ""
        };
      }), isZtraxBlank)
    };
  }

  function readForm() {
    const base = cloneValue(currentOrBlank());
    base.operatorUsername = el.reportOperator.value.trim();
    base.fullName = el.reportFullName.value.trim();
    base.shiftStart = el.shiftStart.value;
    base.shiftEnd = el.shiftEnd.value;
    base.teamInfo = el.teamInfo.value.trim();
    base.qruDescription = el.qruDescription.value.trim();
    base.offlineClients = trimTrailingBlankRows(readRows("[data-offline-name]", input => {
      const index = Number(input.dataset.offlineName);
      return {
        name: input.value.trim(),
        mode: document.querySelector(`[data-offline-mode="${index}"]`)?.value || OFFLINE_TYPES[0],
        chamadoAberto: document.querySelector(`[data-offline-chamado="${index}"]`)?.value || YES_NO[1]
      };
    }), isOfflineBlank);

    base.clientInfo = trimTrailingBlankRows(readRows("[data-client-info-time]", input => {
      const index = Number(input.dataset.clientInfoTime);
      return {
        time: input.value,
        note: document.querySelector(`[data-client-info-note="${index}"]`)?.value.trim() || ""
      };
    }), isClientInfoBlank);

    base.remoteArms = trimTrailingBlankRows(readRows("[data-remote-name]", input => {
      const index = Number(input.dataset.remoteName);
      return {
        name: input.value.trim(),
        time: document.querySelector(`[data-remote-time="${index}"]`)?.value || "",
        action: document.querySelector(`[data-remote-action="${index}"]`)?.value || REMOTE_ACTIONS[0],
        details: document.querySelector(`[data-remote-details="${index}"]`)?.value.trim() || ""
      };
    }), isRemoteArmBlank);

    const sharedCatalog = readSharedCatalogFromDom();
    base.rondaEntries = sharedCatalog.rondaEntries;
    base.ztraxEntries = sharedCatalog.ztraxEntries;
    state.sharedCatalog = cloneValue(sharedCatalog);

    base.handoffItems = trimTrailingBlankRows(readRows("[data-handoff-title]", input => {
      const index = Number(input.dataset.handoffTitle);
      return {
        title: input.value.trim(),
        source: document.querySelector(`[data-handoff-source="${index}"]`)?.value.trim() || "",
        status: document.querySelector(`[data-handoff-status="${index}"]`)?.value || HANDOFF_STATUS_OPTIONS[0],
        nextAction: document.querySelector(`[data-handoff-next-action="${index}"]`)?.value.trim() || "",
        note: document.querySelector(`[data-handoff-note="${index}"]`)?.value.trim() || "",
        sourceId: currentOrBlank().handoffItems?.[index]?.sourceId || ""
      };
    }), isHandoffBlank);
    base.assistedImports = Array.isArray(base.assistedImports) ? base.assistedImports : [];

    base.qruImages = readRows("[data-image-label]", input => {
      const index = Number(input.dataset.imageLabel);
      const source = currentOrBlank().qruImages?.[index];
      return source ? { ...source, label: input.value.trim() } : null;
    }).filter(Boolean);

    return base;
  }

  function applyReadOnlyState() {
    const editable = canEditCurrentReport();
    document.querySelector(".workspace").dataset.readonly = editable ? "false" : "true";
    const info = editWindowInfo(currentOrBlank());
    el.editWindowNote.className = `note-box ${editable ? "success" : "warning"}`;
    el.editWindowNote.textContent = info.reason;
    el.saveReportBtn.disabled = !editable;
    el.archiveReportBtn.hidden = !canManageReports();
    el.archiveReportBtn.disabled = !Boolean(state.currentId);
    if (el.deleteReportBtn) {
      el.deleteReportBtn.hidden = true;
      el.deleteReportBtn.disabled = true;
    }
    el.archiveReportBtn.textContent = currentOrBlank().archived ? "Reativar" : "Arquivar";
  }

  function updateHeader() {
    const report = currentOrBlank();
    el.actorLabel.textContent = actorDisplay();
    el.accessLabel.textContent = "";
    el.lastEditedBadge.textContent = report?.lastEditedByName
      ? `${report.lastEditedByName} | ${formatDateTime(report.lastEditedAt)}`
      : "Sem edições";
    el.archivedTabBtn.hidden = !canManageReports();
    el.adminPanel.classList.toggle("hidden", !canManageReports());
  }

  function renderSidebarTab() {
    document.querySelectorAll(".sidebar-tab").forEach(button => {
      button.classList.toggle("active", button.dataset.sidebarTab === state.sidebarTab);
    });
    el.activeList.classList.toggle("hidden", state.sidebarTab !== "ativos");
    el.archivedList.classList.toggle("hidden", state.sidebarTab !== "arquivados");
  }

  function renderAll() {
    renderReportList();
    fillForm();
    updateHeader();
    renderSidebarTab();
    renderOperatorList();
    renderAdminLogs();
    renderAssistant();
  }

  function resetDraft() {
    const operatorUsername = state.actor?.kind === "operator" ? state.actor.username : "administrativo";
    state.currentId = "";
    state.draft = blankReport(operatorUsername, state.operators);
    state.lastSavedFingerprint = fingerprint(state.draft);
    renderAll();
    setStatus("Novo relatório pronto para preenchimento.");
  }

  function selectReport(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    state.currentId = id;
    state.draft = cloneValue(report);
    state.lastSavedFingerprint = fingerprint(state.draft);
    renderAll();
    setStatus("Relatório carregado.");
  }

  function updateDraft(mutator) {
    if (!canEditCurrentReport()) {
      setStatus(editWindowInfo(currentOrBlank()).reason);
      return;
    }
    const report = readForm();
    mutator(report);
    state.sharedCatalog = {
      rondaEntries: cloneValue(report.rondaEntries || []),
      ztraxEntries: cloneValue(report.ztraxEntries || [])
    };
    state.draft = report;
    state.lastSavedFingerprint = "";
    renderAll();
    scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveRecord().catch(error => {
        console.error(error);
        setStatus("Falha ao salvar.");
      });
    }, AUTO_SAVE_DELAY_MS);
    setStatus("Alterações pendentes. Salvamento automático em até 1 minuto.");
  }

  function mutateCurrentDraft(mutator) {
    const report = cloneValue(readForm());
    mutator(report);
    state.sharedCatalog = {
      rondaEntries: cloneValue(report.rondaEntries || []),
      ztraxEntries: cloneValue(report.ztraxEntries || [])
    };
    state.draft = report;
    state.lastSavedFingerprint = "";
    renderAll();
    scheduleSave();
  }

  async function writeAdminLog(title, summary, extra) {
    await db.collection(LOGS_COLLECTION).add({
      title,
      summary,
      actorName: actorName(),
      actorEmail: actorEmail(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extra
    });
  }

  function operatorsDocRef() {
    return db.collection(SYSTEM_COLLECTION).doc(OPERATORS_DOC);
  }

  async function getOperatorsSnapshot() {
    const docRef = operatorsDocRef();
    return readDocWithQuotaFallback(docRef);
  }

  async function ensureOperatorSeed() {
    await runSeedWhenFirestoreAvailable(async () => {
      const docRef = operatorsDocRef();
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(docRef);
        if (!snapshot.exists) {
          tx.set(docRef, {
            accounts: serializeOperatorAccountsForStorage(DEFAULT_OPERATORS),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    });
  }

  async function ensureSharedCatalogSeed() {
    await runSeedWhenFirestoreAvailable(async () => {
      const docRef = db.collection(SYSTEM_COLLECTION).doc(SHARED_CATALOG_DOC);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(docRef);
        if (!snapshot.exists) {
          tx.set(docRef, {
            rondaEntries: [],
            ztraxEntries: [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    });
  }

  async function loadOperators() {
    const snapshot = await getOperatorsSnapshot();
    state.operators = normalizeOperatorAccounts(snapshot?.data?.()?.accounts || cloneValue(DEFAULT_OPERATORS));
    const migrated = {};
    let changed = false;
    for (const [username, account] of Object.entries(state.operators)) {
      migrated[username] = { ...account };
      if (!account.passwordHash && account.legacyPassword) {
        migrated[username].passwordHash = await createPasswordHash(account.legacyPassword);
        delete migrated[username].legacyPassword;
        changed = true;
      }
    }
    if (changed) {
      await persistOperators(migrated);
      state.operators = normalizeOperatorAccounts(migrated);
    }
  }

  async function loadSharedCatalog() {
    const snapshot = await readDocWithQuotaFallback(db.collection(SYSTEM_COLLECTION).doc(SHARED_CATALOG_DOC));
    const data = snapshot?.data?.() || {};
    state.sharedCatalog = {
      rondaEntries: Array.isArray(data.rondaEntries) ? data.rondaEntries : [],
      ztraxEntries: Array.isArray(data.ztraxEntries) ? data.ztraxEntries : []
    };
  }

  async function persistSharedCatalog(sharedCatalog) {
    await db.collection(SYSTEM_COLLECTION).doc(SHARED_CATALOG_DOC).set({
      rondaEntries: sharedCatalog.rondaEntries,
      ztraxEntries: sharedCatalog.ztraxEntries,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    state.sharedCatalog = cloneValue(sharedCatalog);
  }

  async function loadLogs() {
    if (!canManageReports()) {
      state.logs = [];
      return;
    }
    if (firestoreReadBackoffActive()) {
      state.logs = [];
      return;
    }
    try {
      const snapshot = await db.collection(LOGS_COLLECTION).orderBy("createdAt", "desc").limit(60).get();
      clearFirestoreReadBackoff();
      state.logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      if (!isFirestoreQuotaError(error)) throw error;
      applyFirestoreReadBackoff();
      state.logs = [];
    }
  }

  async function loadReports() {
    state.loading = true;
    if (firestoreReadBackoffActive()) {
      state.loading = false;
      setStatus("Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderAll();
      return;
    }
    let snapshot;
    try {
      snapshot = await db.collection(REPORTS_COLLECTION).orderBy("updatedAt", "desc").get();
      clearFirestoreReadBackoff();
    } catch (error) {
      if (!isFirestoreQuotaError(error)) throw error;
      applyFirestoreReadBackoff();
      state.loading = false;
      setStatus("Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderAll();
      return;
    }
    state.reports = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        operatorUsername: data.operatorUsername || "",
        fullName: data.fullName || "",
        shiftStart: data.shiftStart || "",
        shiftEnd: data.shiftEnd || "",
        offlineClients: Array.isArray(data.offlineClients) && data.offlineClients.length ? data.offlineClients : [blankOffline()],
        clientInfo: Array.isArray(data.clientInfo) && data.clientInfo.length ? data.clientInfo : [blankClientInfo(), blankClientInfo()],
        teamInfo: data.teamInfo || "",
        remoteArms: Array.isArray(data.remoteArms) && data.remoteArms.length ? data.remoteArms : [blankRemoteArm()],
        rondaEntries: Array.isArray(data.rondaEntries) && data.rondaEntries.length ? data.rondaEntries : [],
        ztraxEntries: Array.isArray(data.ztraxEntries) && data.ztraxEntries.length ? data.ztraxEntries : [],
        handoffItems: Array.isArray(data.handoffItems) ? data.handoffItems : [],
        assistedImports: Array.isArray(data.assistedImports) ? data.assistedImports : [],
        qruDescription: data.qruDescription || "",
        qruImages: Array.isArray(data.qruImages) ? data.qruImages : [],
        archived: Boolean(data.archived),
        lastEditedByName: data.lastEditedByName || "",
        lastEditedByEmail: data.lastEditedByEmail || "",
        lastEditedByType: data.lastEditedByType || "",
        lastEditedAt: data.lastEditedAt || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      };
    });
    if (state.currentId) {
      const fresh = state.reports.find(item => item.id === state.currentId);
      if (fresh) {
        state.draft = cloneValue(fresh);
        state.lastSavedFingerprint = fingerprint(state.draft);
      } else {
        resetDraft();
      }
    } else {
      const requestedId = queryParams().get("id");
      if (requestedId) {
        const requested = state.reports.find(item => item.id === requestedId);
        if (requested) {
          state.currentId = requestedId;
          state.draft = cloneValue(requested);
          state.lastSavedFingerprint = fingerprint(state.draft);
        }
      }
    }
    state.loading = false;
    renderAll();
  }

  async function reloadAll() {
    await loadOperators();
    await loadSharedCatalog();
    await loadReports();
    await loadLogs();
    renderAll();
  }

  async function saveRecord(force) {
    if (!state.actor) return;
    const report = readForm();
    const windowState = editWindowInfo(report);
    if (!windowState.editable) {
      setStatus(windowState.reason);
      applyReadOnlyState();
      return;
    }
    if (!report.fullName) {
      setStatus("Informe o nome completo do operador.");
      return;
    }
    if (!report.shiftStart || !report.shiftEnd) {
      setStatus("Preencha início e fim do plantão.");
      return;
    }
    if (!canManageReports() && state.actor.kind === "operator") {
      report.operatorUsername = state.actor.username;
    }

    const sharedCatalog = {
      rondaEntries: cloneValue(report.rondaEntries || []),
      ztraxEntries: cloneValue(report.ztraxEntries || [])
    };

    const nextFingerprint = fingerprint(report);
    if (!force && nextFingerprint === state.lastSavedFingerprint) {
      setStatus("Sem alterações pendentes.");
      return;
    }

    const docRef = report.id
      ? db.collection(REPORTS_COLLECTION).doc(report.id)
      : db.collection(REPORTS_COLLECTION).doc();

    const payload = {
      operatorUsername: report.operatorUsername,
      fullName: report.fullName,
      shiftStart: report.shiftStart,
      shiftEnd: report.shiftEnd,
      offlineClients: report.offlineClients,
      clientInfo: report.clientInfo,
      teamInfo: report.teamInfo,
      remoteArms: report.remoteArms,
      rondaEntries: report.rondaEntries,
      ztraxEntries: report.ztraxEntries,
      handoffItems: report.handoffItems || [],
      assistedImports: report.assistedImports || [],
      qruDescription: report.qruDescription,
      qruImages: report.qruImages,
      archived: Boolean(report.archived),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedByName: actorName(),
      lastEditedByEmail: actorEmail(),
      lastEditedByType: state.actor.kind
    };
    if (!report.id) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await Promise.all([
      docRef.set(payload, { merge: true }),
      persistSharedCatalog(sharedCatalog)
    ]);
    await writeAdminLog(report.id ? "Relatório atualizado" : "Relatório criado", `${report.fullName} (${report.operatorUsername})`, {
      reportId: docRef.id
    });
    report.id = docRef.id;
    state.currentId = docRef.id;
    state.draft = report;
    state.sharedCatalog = cloneValue(sharedCatalog);
    state.lastSavedFingerprint = nextFingerprint;
    setStatus("Relatório sincronizado.");
    await reloadAll();
  }

  async function toggleArchive() {
    if (!canManageReports() || !state.currentId) return;
    const report = currentOrBlank();
    await db.collection(REPORTS_COLLECTION).doc(state.currentId).set({
      archived: !report.archived,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedByName: actorName(),
      lastEditedByEmail: actorEmail(),
      lastEditedByType: state.actor.kind
    }, { merge: true });
    await writeAdminLog(report.archived ? "Relatório reativado" : "Relatório arquivado", `${report.fullName} (${report.operatorUsername})`, {
      reportId: state.currentId
    });
    setStatus(report.archived ? "Relatório reativado." : "Relatório arquivado.");
    await reloadAll();
  }

  async function deleteCurrentReport() {
    if (!canManageReports() || !state.currentId) return;
    if (!window.confirm("Arquivar este relatorio?")) return;
    const report = currentOrBlank();
    await db.collection(REPORTS_COLLECTION).doc(state.currentId).set({
      archived: true,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archiveReason: "Legacy delete control requested archive",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedByName: actorName(),
      lastEditedByEmail: actorEmail(),
      lastEditedByType: state.actor.kind
    }, { merge: true });
    await writeAdminLog("Relatório arquivado", `${report.fullName} (${report.operatorUsername})`, {
      reportId: state.currentId
    });
    state.currentId = "";
    state.draft = null;
    setStatus("Relatorio arquivado.");
    await reloadAll();
  }

  async function persistOperators(accounts) {
    await operatorsDocRef().set({
      accounts: serializeOperatorAccountsForStorage(accounts),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function saveOperator(event) {
    event.preventDefault();
    if (!canManageReports()) return;
    const previousUsername = el.operatorForm.dataset.editing || "";
    const username = el.operatorUsernameField.value.trim().toLowerCase();
    const fullName = el.operatorFullNameField.value.trim();
    const password = el.operatorPasswordField.value.trim();
    const previousAccount = previousUsername ? state.operators[previousUsername] : state.operators[username];
    if (!username || !fullName || (!password && !previousAccount?.passwordHash)) {
      setStatus("Preencha login, nome e senha para novo operador.");
      return;
    }
    const next = cloneValue(state.operators);
    if (previousUsername && previousUsername !== username) delete next[previousUsername];
    next[username] = {
      fullName,
      passwordHash: password ? await createPasswordHash(password) : previousAccount.passwordHash
    };
    await persistOperators(next);
    await writeAdminLog(previousUsername ? "Operador atualizado" : "Operador criado", `${username} | ${fullName}`);
    el.operatorForm.reset();
    delete el.operatorForm.dataset.editing;
    setStatus("Operador salvo.");
    await reloadAll();
  }

  async function deleteOperator(username) {
    if (!canManageReports()) return;
    if (!window.confirm(`Excluir o operador ${username}?`)) return;
    const next = cloneValue(state.operators);
    delete next[username];
    await persistOperators(next);
    await writeAdminLog("Operador excluído", username);
    setStatus("Operador excluído.");
    await reloadAll();
  }

  function editOperator(username) {
    const operator = state.operators[username];
    if (!operator) return;
    el.operatorForm.dataset.editing = username;
    el.operatorUsernameField.value = username;
    el.operatorFullNameField.value = operator.fullName || "";
    el.operatorPasswordField.value = "";
    el.operatorPasswordField.placeholder = "Nova senha ou vazio para manter";
  }

  async function handleLogin(event) {
    event.preventDefault();
    const forcedUser = isPublicOperatorLink() ? requestedUser().trim().toLowerCase() : "";
    const username = (forcedUser || el.loginUsername.value.trim().toLowerCase());
    const password = el.loginPassword.value;
    let account = state.operators[username];
    let authenticated = Boolean(account && await verifyPassword(account, password));
    if (!authenticated) {
      try {
        await loadOperators();
      } catch (error) {
        console.warn("Falha ao recarregar operadores antes de rejeitar login.", error);
      }
      account = state.operators[username];
      authenticated = Boolean(account && await verifyPassword(account, password));
    }
    if (!authenticated) {
      el.loginError.textContent = "Login ou senha inválidos.";
      return;
    }
    state.actor = {
      kind: "operator",
      username,
      displayName: account.fullName || username,
      email: `${username}@interno.tka`
    };
    writeOperatorSession(state.actor);
    el.loginError.textContent = "";
    showApp();
    resetDraft();
    await reloadAll();
  }

  function bootstrapActor() {
    if (isPublicOperatorLink()) {
      return false;
    }
    state.portalUser = readPortalUser();
    if (isPortalManager()) {
      state.actor = {
        kind: "portal",
        username: "gerenciamento",
        displayName: state.portalUser.email,
        email: state.portalUser.email
      };
      return true;
    }
    const operator = readOperatorSession();
    if (operator && operator.kind === "operator") {
      state.actor = operator;
      return true;
    }
    return false;
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function addImages(files) {
    if (!files.length || !canEditCurrentReport()) return;
    const report = readForm();
    const uploads = [];
    for (const file of Array.from(files)) {
      uploads.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        label: file.name.replace(/\.[^.]+$/, ""),
        name: file.name,
        type: file.type || "image/png",
        size: file.size || 0,
        dataUrl: await fileToDataUrl(file),
        uploadedAt: new Date().toISOString()
      });
    }
    report.qruImages = [...(report.qruImages || []), ...uploads];
    state.draft = report;
    state.lastSavedFingerprint = "";
    renderAll();
    scheduleSave();
  }

  async function loadLogoDataUrl() {
    if (!logoDataUrlPromise) {
      logoDataUrlPromise = fetch(LOGO_PATH)
        .then(response => response.blob())
        .then(blob => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
        .catch(() => "");
    }
    return logoDataUrlPromise;
  }

  async function exportPdf() {
    const report = readForm();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const logo = await loadLogoDataUrl();
    const page = { width: 210, height: 297, margin: 14 };
    let y = page.margin;

    function addHeader() {
      pdf.setFillColor(248, 242, 237);
      pdf.roundedRect(page.margin, y, page.width - page.margin * 2, 24, 4, 4, "F");
      if (logo) {
        pdf.addImage(logo, "JPEG", page.margin + 4, y + 3, 42, 16);
      } else {
        pdf.setTextColor(159, 44, 31);
        pdf.setFontSize(16);
        pdf.text("Grupo TKA", page.margin + 6, y + 12);
      }
      pdf.setTextColor(35, 25, 21);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("Relatório de Plantão", page.width - page.margin - 4, y + 10, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Operador: ${report.fullName || report.operatorUsername || "-"}`, page.width - page.margin - 4, y + 16, { align: "right" });
      pdf.text(`Turno: ${formatShortDate(report.shiftStart)} - ${formatShortDate(report.shiftEnd)}`, page.width - page.margin - 4, y + 21, { align: "right" });
      y += 32;
    }

    function ensureSpace(height) {
      if (y + height <= page.height - page.margin) return;
      pdf.addPage();
      y = page.margin;
      addHeader();
    }

    function addSection(title, lines) {
      const content = Array.isArray(lines) ? lines.filter(Boolean) : [String(lines || "").trim()].filter(Boolean);
      ensureSpace(16);
      pdf.setFillColor(244, 232, 226);
      pdf.roundedRect(page.margin, y, page.width - page.margin * 2, 9, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(title, page.margin + 4, y + 6);
      y += 13;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      if (!content.length) {
        pdf.text("Sem registros.", page.margin + 2, y);
        y += 6;
        return;
      }
      content.forEach(line => {
        const wrapped = pdf.splitTextToSize(line, page.width - page.margin * 2 - 4);
        ensureSpace(wrapped.length * 5 + 2);
        pdf.text(wrapped, page.margin + 2, y);
        y += wrapped.length * 5 + 1;
      });
    }

    addHeader();
    addSection("Identificação", [
      `Login do operador: ${report.operatorUsername || "-"}`,
      `Nome completo: ${report.fullName || "-"}`,
      `Início: ${formatShortDate(report.shiftStart)}`,
      `Fim: ${formatShortDate(report.shiftEnd)}`,
      report.lastEditedByName ? `Última edição: ${report.lastEditedByName} em ${formatDateTime(report.lastEditedAt)}` : "Última edição: sem registro"
    ]);
    addSection("Clientes offline", report.offlineClients.map(item => `${item.name || "Cliente não informado"} | ${item.mode || "-"} | chamado aberto: ${item.chamadoAberto || "-"}`));
    addSection("Informações de clientes", report.clientInfo.map(item => `${formatTimeOnly(item.time) || "--:--"} | ${item.note || "-"}`));
    addSection("Informações da equipe", report.teamInfo || "Sem observações.");
    addSection("Armes remotos", report.remoteArms.map(item => `${item.name || "Cliente não informado"} | ${formatTimeOnly(item.time) || "--:--"} | ${item.action || "-"} | ${item.details || "-"}`));
    addSection("Editar Ronda", (report.rondaEntries || []).map(item => `${item.client || "Cliente não informado"} | câmeras online: ${item.camerasOnline || "-"} | câmeras instaladas: ${item.camerasInstalled || "-"} | ${item.note || "-"}`));
    addSection("Editar Ztrax", (report.ztraxEntries || []).map(item => `${item.client || "Cliente não informado"} | rádio HT: ${item.radioHt || "-"} | Ztrax: ${item.ztrax || "-"} | ${item.note || "-"}`));
    addSection("Repasses do proximo turno", (report.handoffItems || []).map(item => `${item.title || "Pendencia"} | ${item.status || "-"} | origem: ${item.source || "-"} | proxima acao: ${item.nextAction || "-"} | ${item.note || "-"}`));
    addSection("QRU", report.qruDescription || "Sem descrição.");
    addSection("Auditoria do assistente", (report.assistedImports || [])
      .filter(item => item.decision !== ASSISTANT_DECISIONS.ignore)
      .map(item => `${item.decision || "-"} | ${item.title || "-"} | origem: ${item.source || "-"} | operador: ${item.operatorName || item.operatorEmail || "-"} | ${formatShortDate(item.importedAt)}`));
    addSection("Imagens do QRU", report.qruImages.map(item => `${item.label || item.name || "Imagem"} | download disponível no relatório digital.`));

    for (const item of report.qruImages) {
      ensureSpace(82);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(item.label || item.name || "Imagem", page.margin, y);
      y += 5;
      try {
        pdf.addImage(item.dataUrl, item.type && item.type.includes("png") ? "PNG" : "JPEG", page.margin, y, page.width - page.margin * 2, 70, undefined, "FAST");
        y += 74;
      } catch {
        pdf.setFont("helvetica", "normal");
        pdf.text("Imagem não pôde ser incorporada, mas segue registrada online.", page.margin, y + 4);
        y += 10;
      }
    }

    const shiftDate = (report.shiftStart || "").slice(0, 10).replace(/-/g, "") || "sem-data";
    const operator = (report.operatorUsername || "plantao").replace(/[^\w\-]+/g, "-");
    pdf.save(`relatorio-plantao-${shiftDate}-${operator}.pdf`);
  }

  function configureLoginView() {
    if (!isPublicOperatorLink()) return;
    const user = requestedUser().trim().toLowerCase();
    const account = state.operators[user];
    if (!account) return;
    if (el.loginHelp) {
      el.loginHelp.textContent = `Acesso do operador ${account.fullName || user}. Informe somente a senha para entrar no relatório.`;
    }
    if (el.loginUsernameLabel) {
      el.loginUsernameLabel.hidden = true;
    }
    if (el.loginUsername) {
      el.loginUsername.value = user;
      el.loginUsername.type = "hidden";
      el.loginUsername.required = false;
    }
    renderOperatorCredentialHelp(user);
  }

  function renderOperatorCredentialHelp(selectedUser) {
    if (!el.operatorCredentialHelp) return;
    const entries = Object.keys(state.operators || {}).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (!entries.length) {
      el.operatorCredentialHelp.classList.add("hidden");
      el.operatorCredentialHelp.innerHTML = "";
      return;
    }
    el.operatorCredentialHelp.classList.remove("hidden");
    el.operatorCredentialHelp.innerHTML = `
      <div class="credential-head">
        <strong>Acessos dos operadores</strong>
        <span class="muted">As senhas ficam protegidas. Redefina pelo formulario quando necessario.</span>
      </div>
      <div class="credential-list">
        ${entries.map(username => {
          const operator = state.operators[username] || {};
          return `
            <div class="credential-row${username === selectedUser ? " is-selected" : ""}">
              <div>
                <strong>${escapeHtml(operator.fullName || username)}</strong>
                <span>${escapeHtml(username)}</span>
              </div>
              <code>${operator.passwordHash ? "senha protegida" : "senha legada - redefina"}</code>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function bindEvents() {
    el.loginForm.addEventListener("submit", handleLogin);
    el.operatorForm.addEventListener("submit", saveOperator);
    el.themeToggleBtn.addEventListener("click", () => {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    });
    el.homeLink.addEventListener("click", event => {
      event.preventDefault();
      window.location.assign(`${window.location.origin}/?tab=systems`);
    });
    el.newReportBtn.addEventListener("click", resetDraft);
    el.saveReportBtn.addEventListener("click", () => saveRecord(true).catch(error => {
      console.error(error);
      setStatus("Falha ao salvar.");
    }));
    el.savePdfBtn.addEventListener("click", () => exportPdf().catch(error => {
      console.error(error);
      setStatus("Falha ao gerar PDF.");
    }));
    el.archiveReportBtn.addEventListener("click", () => toggleArchive().catch(error => {
      console.error(error);
      setStatus("Falha ao arquivar.");
    }));
    if (el.deleteReportBtn) {
      el.deleteReportBtn.addEventListener("click", () => deleteCurrentReport().catch(error => {
        console.error(error);
        setStatus("Falha ao arquivar.");
      }));
    }
    el.logoutBtn.addEventListener("click", () => {
      if (state.actor?.kind === "operator") clearOperatorSession();
      state.actor = null;
      showLogin();
    });
    document.querySelectorAll(".sidebar-tab").forEach(button => {
      button.addEventListener("click", () => {
        state.sidebarTab = button.dataset.sidebarTab;
        renderSidebarTab();
        if (state.sidebarTab === "ronda") {
          document.getElementById("addRondaBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (state.sidebarTab === "ztrax") {
          document.getElementById("addZtraxBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
    [el.reportOperator, el.reportFullName, el.shiftStart, el.shiftEnd, el.teamInfo, el.qruDescription].forEach(input => {
      input.addEventListener("input", scheduleSave);
      input.addEventListener("change", scheduleSave);
    });
    document.addEventListener("input", event => {
      if (event.target.closest(".workspace") && !event.target.closest("#operatorForm")) {
        state.draft = readForm();
        scheduleSave();
      }
    });
    document.addEventListener("change", event => {
      if (event.target.closest(".workspace") && !event.target.closest("#operatorForm")) {
        state.draft = readForm();
        scheduleSave();
      }
    });
    document.addEventListener("click", event => {
      const target = event.target;
      if (target.matches("[data-select-report]")) selectReport(target.dataset.selectReport);
      if (target.matches("[data-remove-offline]")) updateDraft(report => {
        report.offlineClients.splice(Number(target.dataset.removeOffline), 1);
        if (!report.offlineClients.length) report.offlineClients = [blankOffline()];
      });
      if (target.matches("[data-remove-client-info]")) updateDraft(report => {
        report.clientInfo.splice(Number(target.dataset.removeClientInfo), 1);
        if (!report.clientInfo.length) report.clientInfo = [blankClientInfo(), blankClientInfo()];
      });
      if (target.matches("[data-remove-remote]")) updateDraft(report => {
        report.remoteArms.splice(Number(target.dataset.removeRemote), 1);
        if (!report.remoteArms.length) report.remoteArms = [blankRemoteArm()];
      });
      if (target.matches("[data-remove-ronda]")) updateDraft(report => {
        report.rondaEntries.splice(Number(target.dataset.removeRonda), 1);
        if (!report.rondaEntries.length) report.rondaEntries = [blankRonda()];
      });
      if (target.matches("[data-remove-ztrax]")) updateDraft(report => {
        report.ztraxEntries.splice(Number(target.dataset.removeZtrax), 1);
        if (!report.ztraxEntries.length) report.ztraxEntries = [blankZtrax()];
      });
      if (target.matches("[data-remove-handoff]")) updateDraft(report => {
        report.handoffItems.splice(Number(target.dataset.removeHandoff), 1);
      });
      if (target.matches("[data-resolve-handoff]")) updateDraft(report => {
        const item = report.handoffItems[Number(target.dataset.resolveHandoff)];
        if (item) item.status = HANDOFF_STATUS_OPTIONS[1];
      });
      if (target.matches("[data-remove-image]")) updateDraft(report => {
        report.qruImages.splice(Number(target.dataset.removeImage), 1);
      });
      if (target.matches("[data-assistant-action]")) {
        applyAssistantAction(target.dataset.assistantId, target.dataset.assistantAction);
      }
      if (target.matches("[data-edit-operator]")) editOperator(target.dataset.editOperator);
      if (target.matches("[data-delete-operator]")) {
        deleteOperator(target.dataset.deleteOperator).catch(error => {
          console.error(error);
          setStatus("Falha ao excluir operador.");
        });
      }
    });
    el.addOfflineBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.offlineClients = Array.isArray(report.offlineClients) ? report.offlineClients : [];
      report.offlineClients.push(blankOffline());
    }));
    el.addClientInfoBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.clientInfo = Array.isArray(report.clientInfo) ? report.clientInfo : [];
      report.clientInfo.push(blankClientInfo());
    }));
    el.addRemoteArmBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.remoteArms = Array.isArray(report.remoteArms) ? report.remoteArms : [];
      report.remoteArms.push(blankRemoteArm());
    }));
    el.addRondaBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.rondaEntries = Array.isArray(report.rondaEntries) ? report.rondaEntries : [];
      report.rondaEntries.push(blankRonda());
    }));
    el.addZtraxBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.ztraxEntries = Array.isArray(report.ztraxEntries) ? report.ztraxEntries : [];
      report.ztraxEntries.push(blankZtrax());
    }));
    el.addHandoffBtn.addEventListener("click", () => mutateCurrentDraft(report => {
      report.handoffItems = Array.isArray(report.handoffItems) ? report.handoffItems : [];
      report.handoffItems.push(blankHandoff());
    }));
    el.refreshAssistantBtn.addEventListener("click", () => refreshAssistantPreview().catch(error => {
      console.error(error);
      setStatus("Falha ao atualizar previa do assistente.");
    }));
    el.qruImageInput.addEventListener("change", event => {
      addImages(event.target.files).catch(error => {
        console.error(error);
        setStatus("Falha ao anexar imagens.");
      }).finally(() => {
        el.qruImageInput.value = "";
      });
    });
  }

  async function boot() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    bindEvents();
    state.portalUser = readPortalUser();
    if (isPortalManager()) {
      await ensureOperatorSeed();
      await ensureSharedCatalogSeed();
      await loadOperators();
      await loadSharedCatalog();
    } else {
      state.operators = normalizeOperatorAccounts(cloneValue(DEFAULT_OPERATORS));
      state.sharedCatalog = { rondaEntries: [], ztraxEntries: [] };
    }
    configureLoginView();
    if (!bootstrapActor()) {
      showLogin();
      setStatus("Aguardando login.");
      return;
    }
    showApp();
    resetDraft();
    await reloadAll();
  }

  boot().catch(error => {
    console.error(error);
    setStatus("Falha ao iniciar.");
  });
})();
