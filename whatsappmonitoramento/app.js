(function () {
  const LIVE_FETCH_INTERVAL_MS = 30000;
  const PUBLIC_BRIDGE_GROUPS_REFRESH_MS = 5 * 60 * 1000;
  const LOCAL_FETCH_TIMEOUT_MS = 1600;
  const CLOUD_FETCH_TIMEOUT_MS = 10000;
  const OPTIONAL_BRIDGE_FETCH_TIMEOUT_MS = 4000;
  const LOCAL_RETRY_BACKOFF_MS = 60000;
  const FIRESTORE_READ_QUOTA_BACKOFF_MS = 30 * 60 * 1000;
  const FIRESTORE_READ_ERROR_BACKOFF_MS = 5 * 60 * 1000;
  const DOWNLOAD_BASE_URL = String(window.TKA_DOWNLOAD_BASE_URL || "https://tka-downloads-wm.web.app").replace(/\/+$/, "");
  const OVERLAY_ZIP_PATH = "/whatsappmonitoramento/TKA-Monitoramento-WhatsApp-Overlay-1.0.0.zip";
  const OVERLAY_ZIP_URL = `${DOWNLOAD_BASE_URL}${OVERLAY_ZIP_PATH}`;
  const PUBLIC_BRIDGE_BASE_URLS = [];
  function addPublicBridgeBaseUrl(value) {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    if (!normalized || !/^https:\/\/[a-z0-9.-]+/i.test(normalized)) return;
    if (!PUBLIC_BRIDGE_BASE_URLS.includes(normalized)) PUBLIC_BRIDGE_BASE_URLS.push(normalized);
    updatePublicBridgeDownloadLinks();
  }
  function storedPublicBridgeBaseUrl() {
    try {
      return localStorage.getItem("tka_monitoramento_public_bridge_url") || "";
    } catch {
      return "";
    }
  }
  function updatePublicBridgeDownloadLinks() {
    const baseUrl = PUBLIC_BRIDGE_BASE_URLS[0];
    if (!baseUrl || typeof document === "undefined") return;
    if (String(window.location.origin || "").replace(/\/+$/, "") !== baseUrl) return;
    document.querySelectorAll(`a[href="${OVERLAY_ZIP_PATH}"], a[href="${OVERLAY_ZIP_URL}"]`).forEach(link => {
      link.href = `${baseUrl}${OVERLAY_ZIP_PATH}`;
      link.target = "_blank";
      link.rel = "noreferrer";
    });
  }
  function updateDownloadLinks() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(`a[href="${OVERLAY_ZIP_PATH}"], a[href="${OVERLAY_ZIP_URL}"]`).forEach(link => {
      link.href = OVERLAY_ZIP_URL;
      link.target = "_blank";
      link.rel = "noreferrer";
    });
  }
  updateDownloadLinks();
  addPublicBridgeBaseUrl(window.TKA_MONITORAMENTO_PUBLIC_BRIDGE_URL);
  addPublicBridgeBaseUrl(storedPublicBridgeBaseUrl());

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s/@.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const MOBILE_DELAY_MS = 10 * 60 * 1000;
  const MOBILE_NO_RESPONSE_MS = 10 * 60 * 1000;
  const MOBILE_STATUS_LOG_INTERVAL_MS = 60 * 1000;
  const SHIFT_ESCALATION_MINUTES = { yellow: 5, orange: 10, red: 15 };
  const OVERLAY_LOG_FETCH_LIMIT = 1000;
  const OVERLAY_LOG_RECOVERY_FETCH_LIMIT = 10000;
  const OVERLAY_LOG_CACHE_LIMIT = 10000;
  const SHIFT_LOG_VISIBLE_MS = 24 * 60 * 60 * 1000;
  const SHIFT_EXPORT_PREVIEW_LIMIT = 80;
  const SHIFT_EXPORT_PDF_LIMIT = 700;
  const SHIFT_SCHEDULE_RULE_LIMIT = 500;
  const MANUAL_PLACE_INFO_LOOKUP_LIMIT = 500;
  const MOBILE_LOG_COLLECTION = "whatsapp_monitoramento_overlay_logs";
  const AI_FEEDBACK_COLLECTION = "whatsapp_monitoramento_ai_feedback";
  const RECENT_CONFIRMED_LIMIT = 18;
  const SHIFT_CONFIRMED_FETCH_LIMIT = 500;
  const SHIFT_RESOLVED_LIST_LIMIT = 160;
  const CONFIRMED_24H_DISPLAY_LIMIT = 500;
  const SUMMARY_DROPDOWN_LIMIT = 18;
  const SHIFT_TIME_WINDOW_MINUTES = 120;
  const FETCH_SOURCE_PRIORITY = { cloud: 1, public_bridge: 2, local: 3 };
  const CONFIRMED_STATUSES = new Set(["ok", "ok_late", "shift_start_ok", "shift_start_late"]);
  const SHIFT_FEEDBACK_ACTIONS = {
    shift_arrived: {
      label: "Sem novidades",
      tone: "done",
      correction: "Supervisor confirmou troca de turno sem novidades.",
      reason: "shift_arrived_confirmed",
      summary: "Troca de turno sem novidades confirmada pelo supervisor.",
      recommendation: "Tratar esta evidencia como troca de turno normal, sem novidade operacional.",
      success: "Troca sem novidades registrada para aprendizado."
    },
    shift_delayed: {
      label: "Assumiu com atraso",
      tone: "delay",
      correction: "Supervisor confirmou chegada atrasada do colaborador.",
      reason: "shift_delayed_confirmed",
      summary: "Chegada atrasada confirmada pelo supervisor.",
      recommendation: "Tratar esta evidencia como chegada de turno com atraso.",
      success: "Atraso confirmado para aprendizado."
    },
    shift_fake: {
      label: "Informação errada",
      tone: "ignore",
      correction: "Supervisor confirmou informacao falsa ou incorreta sobre a troca de turno.",
      reason: "shift_fake_information",
      summary: "Informacao falsa/incorreta confirmada pelo supervisor.",
      recommendation: "Nao usar esta evidencia para confirmar a troca de turno.",
      success: "Informacao falsa registrada para aprendizado."
    },
    shift_no_qra_needed: {
      label: "Sem QRA necessario",
      tone: "delay",
      correction: "Supervisor informou que este grupo, pessoa ou posto nao precisa de QRA neste aviso de turno.",
      reason: "shift_no_qra_needed",
      summary: "Supervisor marcou que nao ha QRA necessario para este alerta.",
      recommendation: "Revisar historico do grupo/pessoa e aprender quando nao deve cobrar QRA neste posto.",
      success: "Sem QRA necessario registrado para aprendizado."
    },
    shift_wrong_person: {
      label: "Pessoa diferente assumiu",
      tone: "ignore",
      correction: "Supervisor informou que a pessoa exibida nao e quem assumiu esta troca de turno.",
      reason: "shift_wrong_person",
      summary: "Pessoa diferente assumiu o turno no mesmo posto.",
      recommendation: "Revisar mensagens do grupo/posto para identificar quem deveria assumir esta troca.",
      success: "Pessoa diferente registrada para aprendizado."
    },
    shift_wrong_time: {
      label: "Horario Errado de Turno",
      tone: "delay",
      correction: "Supervisor informou que o horario exibido para este turno esta errado.",
      reason: "shift_wrong_time",
      summary: "Horario de turno exibido incorretamente para este posto.",
      recommendation: "Revisar historico do grupo/posto para aprender o horario correto de troca de turno.",
      success: "Horario errado registrado para aprendizado."
    }
  };
  const SHIFT_FEEDBACK_RESOLUTION_ACTIONS = new Set(Object.keys(SHIFT_FEEDBACK_ACTIONS));
  const RESOLVED_LOG_ACTIONS = new Set([
    "done",
    "ignore",
    "message_confirmed",
    "ai_approve",
    "ai_correct",
    "ai_reject",
    ...SHIFT_FEEDBACK_RESOLUTION_ACTIONS
  ]);
  const MOBILE_STORAGE_KEYS = {
    actions: "tka-monitoramento-mobile-actions-v1",
    delayed: "tka-monitoramento-mobile-delayed-v1",
    shown: "tka-monitoramento-mobile-shown-v1",
    noResponse: "tka-monitoramento-mobile-no-response-v1",
    pendingLogs: "tka-monitoramento-mobile-pending-logs-v1",
    pendingAiFeedback: "tka-monitoramento-ai-feedback-pending-v1",
    aiFeedback: "tka-monitoramento-ai-feedback-state-v1",
    manualPlaceInfo: "tka-monitoramento-manual-place-info-v1",
    shiftNotifications: "tka-monitoramento-shift-notifications-v1",
    statusLogs: "tka-monitoramento-mobile-status-logs-v1",
    overlayLogs: "tka-monitoramento-overlay-logs-v1"
  };
  const AI_FEEDBACK_RESOLUTION_ACTIONS = new Set(["approve", "correct", "reject"]);
  const launcherMobileMode = document.body.classList.contains("launcher-mobile-mode");
  const adminTrainingMode = window.TKA_MONITORAMENTO_ADMIN_TRAINING === true;
  const shiftSupervisorMode = window.TKA_SHIFT_CHANGE_MODE === true || document.body.classList.contains("shift-supervisor-mode");
  const operationalMode = window.TKA_MONITORAMENTO_OPERATIONAL === true || launcherMobileMode || (window.TKA_MOBILE_MODE === true && !adminTrainingMode);
  const liveRecentHours = (shiftSupervisorMode || adminTrainingMode) ? 24 : 8;
  const confirmedFetchLimit = (shiftSupervisorMode || adminTrainingMode || operationalMode) ? SHIFT_CONFIRMED_FETCH_LIMIT : 24;
  const localFetchTimeoutMs = shiftSupervisorMode ? 8000 : LOCAL_FETCH_TIMEOUT_MS;
  const LOCAL_BRIDGE_ERROR_MESSAGE = "Nao foi possivel carregar o bridge local. Abra o Monitoramento Bridge neste computador e permita acesso a rede local no navegador.";

  const state = {
    health: null,
    status: null,
    groups: null,
    learning: null,
    aiFeedback: null,
    overlayLogs: readStore(MOBILE_STORAGE_KEYS.overlayLogs, []),
    confirmedHistory: [],
    lastError: "",
    lastUpdatedAt: "",
    lastFetchedAt: "",
    overlayLogsFetchedAt: "",
    overlayLogsSource: "",
    source: "",
    installPrompt: null,
    mobileMessage: "",
    currentTab: "pending",
    selectedLogEvent: null,
    manualPlaceInfoOpen: false,
    manualPlaceInfoEditingKey: "",
    manualPlaceInfoStatus: "",
    shiftScheduleOpen: false,
    notificationStatus: "",
    shiftExportStatus: "",
    shiftExportRecordLookup: new Map(),
    patternManagerSearch: "",
    patternManagerKind: "all",
    patternManagerSource: "all",
    patternManagerPlace: "all",
    patternManagerStatus: "",
    summaryDropdownOpen: ""
  };
  const mobileState = {
    actions: readStore(MOBILE_STORAGE_KEYS.actions, {}),
    delayed: readStore(MOBILE_STORAGE_KEYS.delayed, {}),
    shown: readStore(MOBILE_STORAGE_KEYS.shown, {}),
    noResponse: readStore(MOBILE_STORAGE_KEYS.noResponse, {}),
    pendingLogs: readStore(MOBILE_STORAGE_KEYS.pendingLogs, []),
    pendingAiFeedback: readStore(MOBILE_STORAGE_KEYS.pendingAiFeedback, []),
    aiFeedback: readStore(MOBILE_STORAGE_KEYS.aiFeedback, {}),
    manualPlaceInfo: readStore(MOBILE_STORAGE_KEYS.manualPlaceInfo, []),
    shiftNotifications: readStore(MOBILE_STORAGE_KEYS.shiftNotifications, {}),
    statusLogs: readStore(MOBILE_STORAGE_KEYS.statusLogs, []),
    activeKey: "",
    activeConfirmedKey: "",
    queueTab: "pending",
    noResponseTimer: null,
    toastTimer: null
  };
  let liveDb = null;
  let liveStatusRef = null;
  let overlayLogsRef = null;
  let aiFeedbackRef = null;
  let liveFetchInFlight = false;
  let logsFetchInFlight = false;
  let logsFetchPromise = null;
  let localBackoffUntil = 0;
  let publicBridgeGroupsFetchToken = 0;
  let publicBridgeGroupsLastFetchAt = 0;
  let firestoreReadBackoffUntil = 0;
  let firestoreReadBackoffReason = "";

  const el = {
    pageMeta: document.getElementById("pageMeta"),
    connectionPanel: document.getElementById("connectionPanel"),
    qrPairingPanel: document.getElementById("qrPairingPanel"),
    interventionCount: document.getElementById("interventionCount"),
    interventionList: document.getElementById("interventionList"),
    manualPlaceInfoToggle: document.getElementById("manualPlaceInfoToggle"),
    manualPlaceInfoBox: document.getElementById("manualPlaceInfoBox"),
    manualPlaceName: document.getElementById("manualPlaceName"),
    manualPlaceOptions: document.getElementById("manualPlaceOptions"),
    manualWorkerName: document.getElementById("manualWorkerName"),
    manualWorkerOptions: document.getElementById("manualWorkerOptions"),
    manualRuleScope: document.getElementById("manualRuleScope"),
    manualShiftKind: document.getElementById("manualShiftKind"),
    manualPlaceStartTime: document.getElementById("manualPlaceStartTime"),
    manualPlacePatternText: document.getElementById("manualPlacePatternText"),
    manualPlaceInfoSave: document.getElementById("manualPlaceInfoSave"),
    manualPlaceInfoCancel: document.getElementById("manualPlaceInfoCancel"),
    manualPlaceInfoClose: document.getElementById("manualPlaceInfoClose"),
    manualPlaceInfoStatus: document.getElementById("manualPlaceInfoStatus"),
    manualPlaceInfoList: document.getElementById("manualPlaceInfoList"),
    patternManagerSearch: document.getElementById("patternManagerSearch"),
    patternManagerKind: document.getElementById("patternManagerKind"),
    patternManagerSource: document.getElementById("patternManagerSource"),
    patternManagerPlace: document.getElementById("patternManagerPlace"),
    patternManagerAdd: document.getElementById("patternManagerAdd"),
    patternManagerCopy: document.getElementById("patternManagerCopy"),
    patternManagerStatus: document.getElementById("patternManagerStatus"),
    patternManagerSummary: document.getElementById("patternManagerSummary"),
    patternManagerTimeline: document.getElementById("patternManagerTimeline"),
    patternManagerTable: document.getElementById("patternManagerTable"),
    currentHourList: document.getElementById("currentHourList"),
    confirmedList: document.getElementById("confirmedList"),
    currentTabButtons: document.querySelectorAll("[data-current-tab]"),
    currentTabPanels: document.querySelectorAll("[data-current-panel]"),
    overlayLogs: document.getElementById("overlayLogs"),
    groupPatterns: document.getElementById("groupPatterns"),
    hourSlots: document.getElementById("hourSlots"),
    installButton: document.getElementById("installButton"),
    notificationButton: document.getElementById("notificationButton"),
    shiftScheduleToggle: document.getElementById("shiftScheduleToggle"),
    shiftScheduleBox: document.getElementById("shiftScheduleBox"),
    shiftScheduleClose: document.getElementById("shiftScheduleClose"),
    shiftScheduleList: document.getElementById("shiftScheduleList"),
    shiftScheduleStatus: document.getElementById("shiftScheduleStatus"),
    mobileActivePopup: document.getElementById("mobileActivePopup") || document.getElementById("activePopup"),
    mobileQueueList: document.getElementById("mobileQueueList") || document.getElementById("queueList"),
    mobileQueueCount: document.getElementById("mobileQueueCount") || document.getElementById("queueCount"),
    mobileActionMessage: document.getElementById("mobileActionMessage"),
    clock: document.getElementById("clock"),
    hourLabel: document.getElementById("hourLabel"),
    expectedCount: document.getElementById("expectedCount"),
    dueCount: document.getElementById("dueCount"),
    queueCount: document.getElementById("queueCount"),
    summaryDropdown: document.getElementById("summaryDropdown"),
    summaryButtons: document.querySelectorAll("[data-summary-detail]"),
    sourceInfo: document.getElementById("sourceInfo"),
    queueTabButtons: document.querySelectorAll("[data-queue-tab]"),
    reloadButton: document.getElementById("reloadButton"),
    updateAppButton: document.getElementById("updateAppButton"),
    syncLogsButton: document.getElementById("syncLogsButton"),
    logsButton: document.getElementById("logsButton"),
    logsModal: document.getElementById("logsModal"),
    logsBody: document.getElementById("logsBody"),
    logsSubtitle: document.getElementById("logsSubtitle"),
    inlineLogs: document.getElementById("inlineLogs"),
    inlineLogsInfo: document.getElementById("inlineLogsInfo"),
    runtimeWhatsapp: document.getElementById("runtimeWhatsapp"),
    runtimeLastMessage: document.getElementById("runtimeLastMessage"),
    runtimeHistory: document.getElementById("runtimeHistory"),
    closeLogsButton: document.getElementById("closeLogsButton"),
    refreshLogsButton: document.getElementById("refreshLogsButton"),
    copyLogsButton: document.getElementById("copyLogsButton"),
    shiftExportDate: document.getElementById("shiftExportDate"),
    shiftExportPlace: document.getElementById("shiftExportPlace"),
    shiftExportWorker: document.getElementById("shiftExportWorker"),
    shiftExportWorkerOptions: document.getElementById("shiftExportWorkerOptions"),
    shiftExportSearch: document.getElementById("shiftExportSearch"),
    shiftExportPdf: document.getElementById("shiftExportPdf"),
    shiftExportSummary: document.getElementById("shiftExportSummary"),
    shiftExportStatus: document.getElementById("shiftExportStatus"),
    shiftExportResults: document.getElementById("shiftExportResults"),
    toast: document.getElementById("toast")
  };

  function readStore(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
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

  function firstNonEmptyText(...values) {
    for (const value of values) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  }

  function rowFullMessage(row = {}) {
    return firstNonEmptyText(
      row.textFull,
      row.lastReportTextFull,
      row.messageTextFull,
      row.aiSuggestion?.fullText,
      row.text,
      row.lastReportText
    );
  }

  function rowDisplayValidation(row = {}) {
    return row.messageDisplayValidation || row.displayValidation || row.aiSuggestion?.displayValidation || null;
  }

  function messageEvidenceHtml(row = {}) {
    const text = rowFullMessage(row);
    const validation = rowDisplayValidation(row);
    const hasMediaOnly = !text && row.hasMedia;
    if (!text && !hasMediaOnly && !validation) return "";
    const title = text ? "Mensagem recebida" : "Mensagem recebida sem texto";
    const body = text
      ? `<pre>${escapeHtml(text)}</pre>`
      : `<span>${escapeHtml(hasMediaOnly ? `Midia enviada${row.mediaKind ? `: ${row.mediaKind}` : ""}. Validar a midia no WhatsApp quando necessario.` : "Sem texto original armazenado para exibir.")}</span>`;
    const validationText = validation
      ? `${validation.validToShow ? "Valida para exibicao" : "Nao ha texto validado para exibicao"}: ${validation.why || ""} ${validation.how || ""}`.trim()
      : "";
    return `
      <div class="received-message ${text ? "" : "metadata-only"}">
        <strong>${escapeHtml(title)}</strong>
        ${body}
        ${validationText ? `<small>${escapeHtml(validationText)}</small>` : ""}
      </div>
    `;
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function hourLabel(hourKey) {
    const match = String(hourKey || "").match(/T(\d{2}):00/);
    if (!match) return hourKey || "hora";
    return `${match[1]}h`;
  }

  function statusLabel(status) {
    const labels = {
      ok: "informado",
      ok_late: "informado com atraso",
      waiting_grace: "aguardando prazo",
      late: "atrasado",
      missing: "sem informe",
      review: "revisar",
      review_late: "revisar atrasado",
      schedule_conflict: "escala divergente",
      shift_start_ok: "inicio confirmado",
      shift_start_late: "inicio confirmado atrasado",
      shift_start_waiting: "aguardando inicio",
      shift_start_missing: "inicio nao confirmado",
      shift_start_review: "inicio em revisao",
      shift_start_review_late: "inicio em revisao atrasada"
    };
    return labels[status] || status || "sem status";
  }

  function statusTone(status) {
    if (status === "ok" || status === "ok_late" || status === "shift_start_ok" || status === "shift_start_late") return "ok";
    if (status === "missing" || status === "review_late" || status === "shift_start_missing" || status === "shift_start_review_late") return "bad";
    if (status === "late" || status === "review" || status === "schedule_conflict" || status === "shift_start_waiting" || status === "shift_start_review") return "warn";
    return "";
  }

  function isConfirmedStatus(status) {
    return CONFIRMED_STATUSES.has(String(status || ""));
  }

  function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label || "requisicao"} demorou demais`)), timeoutMs);
      promise.then(value => {
        clearTimeout(timer);
        resolve(value);
      }).catch(error => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async function requestJson(url, options = {}) {
    const response = await withTimeout(fetch(url, {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" }
    }), options.timeoutMs || CLOUD_FETCH_TIMEOUT_MS, url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }

  function firestoreReadErrorReason(error) {
    const text = String(error?.message || error || "");
    if (/(^|\D)429(\D|$)|quota|resource[_\s-]*exhausted/i.test(text)) return "quota";
    if (/permission|denied|PERMISSION_DENIED|unauth/i.test(text)) return "permission";
    return "";
  }

  function noteFirestoreReadError(error) {
    const reason = firestoreReadErrorReason(error);
    if (!reason) return false;
    firestoreReadBackoffReason = reason;
    firestoreReadBackoffUntil = Date.now() + (reason === "quota" ? FIRESTORE_READ_QUOTA_BACKOFF_MS : FIRESTORE_READ_ERROR_BACKOFF_MS);
    return true;
  }

  function firestoreReadBackoffActive() {
    return firestoreReadBackoffUntil > Date.now();
  }

  function shouldTryLocalBridge() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("local") === "0") return false;
    const localHostOrigin = window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";
    const explicitLocal = params.get("local") === "1" ||
      localStorage.getItem("tka_monitoramento_local") === "1";
    if (window.location.protocol === "https:" && !localHostOrigin && !explicitLocal) return false;
    return adminTrainingMode ||
      shiftSupervisorMode ||
      localHostOrigin ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost" ||
      explicitLocal;
  }

  function liveFetchErrorMessage() {
    return shiftSupervisorMode ? LOCAL_BRIDGE_ERROR_MESSAGE : "Nao foi possivel atualizar agora. Tentando novamente.";
  }

  function isStandaloneMode() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }

  function updateInstallButton() {
    if (!el.installButton) return;
    if (isStandaloneMode()) {
      el.installButton.hidden = false;
      el.installButton.disabled = true;
      el.installButton.textContent = "Aberto";
      return;
    }
    if (!state.installPrompt) {
      el.installButton.hidden = !launcherMobileMode;
      el.installButton.disabled = false;
      el.installButton.textContent = launcherMobileMode ? "Baixar" : "Instalar app";
      return;
    }
    el.installButton.hidden = false;
    el.installButton.disabled = false;
    el.installButton.textContent = launcherMobileMode ? "Baixar" : "Instalar app";
  }

  function notificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission || "default";
  }

  function updateNotificationButton() {
    if (!el.notificationButton) return;
    const permission = notificationPermission();
    el.notificationButton.hidden = !shiftSupervisorMode;
    el.notificationButton.disabled = permission === "unsupported";
    const labels = {
      granted: "Notif. ok",
      denied: "Bloq.",
      default: "Notif.",
      unsupported: "Sem notif."
    };
    el.notificationButton.textContent = labels[permission] || labels.default;
    el.notificationButton.title = permission === "granted"
      ? "Notificacoes do telefone ativas para atraso critico"
      : "Ativar popup do telefone para alerta vermelho de troca de turno";
  }

  async function showLocalNotification(title, options = {}) {
    if (notificationPermission() !== "granted") return false;
    const payload = {
      badge: "/assets/tka-shield-192.png",
      icon: "/assets/tka-shield-192.png",
      silent: false,
      ...options
    };
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, payload);
        return true;
      }
    } catch {
      // Fall back to a page notification below.
    }
    try {
      new Notification(title, payload);
      return true;
    } catch {
      return false;
    }
  }

  async function requestShiftNotifications() {
    if (notificationPermission() === "unsupported") {
      state.notificationStatus = "Este navegador nao suporta notificacoes.";
      showToast(state.notificationStatus);
      updateNotificationButton();
      return;
    }
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    state.notificationStatus = permission === "granted"
      ? "Notificacoes liberadas para alerta vermelho."
      : "Notificacoes nao foram liberadas neste aparelho.";
    updateNotificationButton();
    showToast(state.notificationStatus);
    if (permission === "granted") {
      showLocalNotification("TKA Turno", {
        body: "Popup do telefone ativado para atraso critico de troca de turno.",
        tag: "tka-shift-notifications-ready"
      }).catch(() => {});
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("tka_monitoramento_sw_reloaded_v3") === "1") return;
        sessionStorage.setItem("tka_monitoramento_sw_reloaded_v3", "1");
        window.location.reload();
      });
      const registration = await navigator.serviceWorker.register("/whatsappmonitoramento/sw.js", { scope: "/whatsappmonitoramento/" });
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "TKA_MONITORAMENTO_SKIP_WAITING" });
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            installing.postMessage({ type: "TKA_MONITORAMENTO_SKIP_WAITING" });
          }
        });
      });
    } catch (error) {
      console.warn("service worker", error);
    }
  }

  function showToast(message) {
    if (!message || !el.toast) return;
    clearTimeout(mobileState.toastTimer);
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    mobileState.toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2800);
  }

  function updateClock() {
    if (!el.clock) return;
    el.clock.textContent = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function connectionStateText() {
    const health = state.health || {};
    const hasPublication = Boolean(state.lastUpdatedAt);
    if (state.lastError) return state.lastError;
    if (!hasPublication) return "Aguardando publicacao live do bridge...";
    if (health.connected) return "WhatsApp conectado";
    if (health.qrRequired) return "QR pendente";
    if (health.connectionState === "logged_out") return "WhatsApp desconectado pelo aparelho";
    if (isBridgeHealthPlaceholder(health)) return "Bridge carregado; verificando WhatsApp";
    if (health.connectionState) return `WhatsApp ${connectionStateShort()}`;
    return "WhatsApp sem conexao";
  }

  function sourceLineText() {
    if (launcherMobileMode) return `Atualizado: ${shortHourMinute(state.lastUpdatedAt || state.lastFetchedAt)}`;
    const sourceText = state.source === "local" ? "local" : state.source === "public_bridge" ? "bridge" : state.source === "cloud" ? "publicado" : "fonte";
    const fetchText = state.lastFetchedAt ? ` / fetch ${formatDateTime(state.lastFetchedAt)}` : "";
    const publishedText = state.lastUpdatedAt ? `${sourceText} ${formatDateTime(state.lastUpdatedAt)}` : "sem publicacao";
    return `${connectionStateText()} / ${publishedText}${fetchText}`;
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

  function shortTime(value) {
    if (!value) return "--";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  }

  function localDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const year = parts.find(part => part.type === "year")?.value || "";
    const month = parts.find(part => part.type === "month")?.value || "";
    const day = parts.find(part => part.type === "day")?.value || "";
    return year && month && day ? `${year}-${month}-${day}` : "";
  }

  function localDateLabel(value = "") {
    const date = value && /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00-03:00`)
      : new Date(value || 0);
    return Number.isNaN(date.getTime())
      ? String(value || "")
      : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function runtimeHistoryText() {
    const health = state.health || {};
    const historyMessages = Number(health.historyMessages || 0);
    const groupCount = Number(health.groupCount || 0);
    if (!historyMessages && !groupCount) return health.backfillRunning ? "importando" : "--";
    if (launcherMobileMode) return `${historyMessages} / ${groupCount}`;
    const suffix = health.backfillRunning ? " importando" : "";
    return `${historyMessages} / ${groupCount} grupos${suffix}`;
  }

  function renderRuntimePanel() {
    const health = state.health || {};
    if (el.runtimeWhatsapp) {
      el.runtimeWhatsapp.textContent = health.connected ? "conectado" : connectionStateShort();
    }
    if (el.runtimeLastMessage) el.runtimeLastMessage.textContent = shortHourMinute(state.lastUpdatedAt || health.lastMessageAt || state.lastFetchedAt);
    if (el.runtimeHistory) el.runtimeHistory.textContent = runtimeHistoryText();
  }

  function connectionStateShort() {
    const health = state.health || {};
    if (health.qrRequired) return "QR pendente";
    const stateName = String(health.connectionState || "").toLowerCase();
    const labels = {
      connecting: "conectando",
      reconnecting: "reconectando",
      open: "conectado",
      closed: "desconectado",
      close: "desconectado",
      logged_out: "desconectado",
      qr: "QR pendente",
      starting: "iniciando",
      recovering: "reconectando",
      reconnect_error: "reconectando",
      local: "verificando",
      public_bridge: "verificando"
    };
    return labels[stateName] || "aguardando";
  }

  function isBridgeHealthPlaceholder(health = {}) {
    return ["local", "public_bridge"].includes(String(health.connectionState || "").toLowerCase()) &&
      health.connected !== true &&
      health.qrRequired !== true &&
      !health.lastError;
  }

  function connectionNeedsAttention() {
    const health = state.health || {};
    if (isBridgeHealthPlaceholder(health)) return Boolean(state.lastError) || !state.lastUpdatedAt;
    return Boolean(state.lastError) || !state.lastUpdatedAt || health.connected === false || health.qrRequired || ["logged_out", "close", "closed", "reconnecting"].includes(health.connectionState);
  }

  function whatsappDisconnectedForLog() {
    const health = state.health || {};
    if (isBridgeHealthPlaceholder(health)) return false;
    const connectionState = String(health.connectionState || "").toLowerCase();
    return Boolean(
      health.connected === false ||
      health.qrRequired ||
      ["logged_out", "close", "closed", "reconnecting", "reconnect_error"].includes(connectionState)
    );
  }

  function statusLogSignature() {
    const totals = state.status?.current?.totals || state.health?.monitoring?.totals || {};
    return [
      connectionStateText(),
      state.health?.connectionState || "",
      state.status?.currentHourKey || state.health?.monitoring?.currentHourKey || "",
      totals.expected || 0,
      totals.due || 0
    ].join("|");
  }

  function saveStatusLogs(logs) {
    mobileState.statusLogs = logs.slice(0, 120);
    writeStore(MOBILE_STORAGE_KEYS.statusLogs, mobileState.statusLogs);
  }

  function recordMobileStatusLog(reason = "status_fetch") {
    if (!launcherMobileMode) return;
    if (!whatsappDisconnectedForLog()) return;
    const now = Date.now();
    const signature = statusLogSignature();
    const latest = mobileState.statusLogs[0] || {};
    const latestAt = new Date(latest.loggedAt || 0).getTime();
    if (latest.action === "whatsapp_disconnected" && latestAt && now - latestAt < MOBILE_STATUS_LOG_INTERVAL_MS) return;
    const totals = state.status?.current?.totals || state.health?.monitoring?.totals || {};
    saveStatusLogs([{
      id: safeDocId([new Date(now).toISOString(), "mobile-status", signature].join(":")),
      loggedAt: new Date(now).toISOString(),
      action: "whatsapp_disconnected",
      reason,
      source: "monitoramento-mobile-app",
      computerName: mobileDeviceLabel(),
      operatorUser: "mobile",
      signature,
      statusText: connectionStateText(),
      publishedAt: state.lastUpdatedAt || "",
      fetchedAt: state.lastFetchedAt || "",
      currentHourKey: state.status?.currentHourKey || state.health?.monitoring?.currentHourKey || "",
      totals: {
        expected: totals.expected || 0,
        due: totals.due || 0
      }
    }, ...mobileState.statusLogs]);
  }

  function isStale() {
    const published = new Date(state.lastUpdatedAt || 0).getTime();
    return !published || Date.now() - published > 45000;
  }

  function timestampMs(value) {
    const ms = new Date(value || 0).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function sourcePriority(source) {
    return FETCH_SOURCE_PRIORITY[source] || 0;
  }

  function shouldApplyLiveData(source, updatedAt) {
    if (!state.lastUpdatedAt) return true;
    if (shiftSupervisorMode && state.source === "cloud" && (source === "public_bridge" || source === "local")) return true;
    if (shiftSupervisorMode && source === "cloud" && (state.source === "public_bridge" || state.source === "local")) return false;
    const currentMs = timestampMs(state.lastUpdatedAt);
    const nextMs = timestampMs(updatedAt);
    if (!currentMs || !nextMs) return sourcePriority(source) >= sourcePriority(state.source);
    if (nextMs > currentMs + 1000) return true;
    if (nextMs < currentMs - 15000) return false;
    return sourcePriority(source) >= sourcePriority(state.source);
  }

  function applyCloudData(data = {}) {
    const updatedAt = data.status?.generatedAt || data.publishedAt || data.runtime?.cloudPublish?.lastPublishAt || "";
    if (!shouldApplyLiveData("cloud", updatedAt)) return false;
    addPublicBridgeBaseUrl(data.runtime?.publicBridgeUrl || data.runtime?.publicTunnelUrl || data.publicBridgeUrl);
    state.health = data.runtime || null;
    state.status = data.status || null;
    state.groups = data.groups || null;
    state.learning = data.learning || null;
    state.aiFeedback = data.status?.aiFeedback || null;
    state.lastUpdatedAt = updatedAt;
    state.lastFetchedAt = new Date().toISOString();
    state.source = "cloud";
    state.lastError = "";
    recordMobileStatusLog("cloud_fetch");
    render();
    return true;
  }

  function normalizeConfirmedHistory(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .filter(row => row && typeof row === "object")
      .map(row => ({ ...row, key: row.key || rowKey(row), status: isConfirmedStatus(row.status) ? row.status : "ok" }));
  }

  function applyLocalData(status = {}, health = null, extras = {}) {
    const updatedAt = status.generatedAt || health?.learning?.at || health?.lastMessageAt || "";
    if (!shouldApplyLiveData("local", updatedAt)) return false;
    state.health = health || {
      connected: null,
      connectionState: "local",
      dashboard: status.dashboard || {},
      monitoring: status.monitoring || {}
    };
    state.status = status || null;
    state.groups = extras.groups || (status.groupLearning ? { groups: status.groupLearning.groups || [], ...status.groupLearning } : state.groups);
    state.learning = health?.learning || state.learning;
    state.aiFeedback = status.aiFeedback || state.aiFeedback;
    state.confirmedHistory = normalizeConfirmedHistory(extras.confirmedHistory || state.confirmedHistory);
    state.lastUpdatedAt = updatedAt;
    state.lastFetchedAt = new Date().toISOString();
    state.source = "local";
    state.lastError = "";
    recordMobileStatusLog("local_fetch");
    render();
    return true;
  }

  function applyPublicBridgeData(status = {}, health = null, extras = {}) {
    const updatedAt = status.generatedAt || health?.learning?.at || health?.lastMessageAt || "";
    if (!shouldApplyLiveData("public_bridge", updatedAt)) return false;
    state.health = health || {
      connected: null,
      connectionState: "public_bridge",
      dashboard: status.dashboard || {},
      monitoring: status.monitoring || {}
    };
    state.status = status || null;
    state.groups = extras.groups || (status.groupLearning ? { groups: status.groupLearning.groups || [], ...status.groupLearning } : state.groups);
    state.learning = health?.learning || state.learning;
    state.aiFeedback = status.aiFeedback || state.aiFeedback;
    state.confirmedHistory = normalizeConfirmedHistory(extras.confirmedHistory || state.confirmedHistory);
    state.lastUpdatedAt = updatedAt;
    state.lastFetchedAt = new Date().toISOString();
    state.source = "public_bridge";
    state.lastError = "";
    recordMobileStatusLog("public_bridge_fetch");
    render();
    return true;
  }

  async function refreshLocalOnce(options = {}) {
    if (!shouldTryLocalBridge()) return false;
    if (!options.force && Date.now() < localBackoffUntil) return false;
    try {
      const stamp = Date.now();
      const statusUrl = `http://127.0.0.1:18991/monitoramento/status.json?recentHours=${liveRecentHours}&compact=1&t=${stamp}`;
      const healthUrl = `http://127.0.0.1:18991/health?t=${stamp}`;
      const confirmedUrl = `http://127.0.0.1:18991/monitoramento/confirmados.json?limit=${confirmedFetchLimit}&t=${stamp}`;
      const groupsUrl = `http://127.0.0.1:18991/monitoramento/grupos.json?compact=1&t=${stamp}`;
      const [status, health, confirmedData, groupsData] = await Promise.all([
        requestJson(statusUrl, { timeoutMs: localFetchTimeoutMs }),
        requestJson(healthUrl, { timeoutMs: Math.min(localFetchTimeoutMs, 4000) }).catch(() => null),
        requestJson(confirmedUrl, { timeoutMs: localFetchTimeoutMs }).catch(() => null),
        requestJson(groupsUrl, { timeoutMs: localFetchTimeoutMs }).catch(() => null)
      ]);
      const applied = applyLocalData(status, health, { confirmedHistory: confirmedData?.confirmed || [], groups: groupsData || null });
      localBackoffUntil = 0;
      return applied;
    } catch {
      localBackoffUntil = Date.now() + LOCAL_RETRY_BACKOFF_MS;
      return false;
    }
  }

  async function refreshCloudOnce() {
    if (!liveStatusRef || firestoreReadBackoffActive()) return false;
    try {
      const snapshot = await liveStatusRef.get();
      firestoreReadBackoffUntil = 0;
      firestoreReadBackoffReason = "";
      return snapshot.exists ? applyCloudData(snapshot.data() || {}) : false;
    } catch (error) {
      const text = String(error.message || error || "");
      noteFirestoreReadError(error);
      if (!state.lastUpdatedAt || state.source === "cloud") {
        state.lastError = text.includes("429") || text.toLowerCase().includes("quota")
          ? "Conexao ocupada. Tentando novamente automaticamente."
          : liveFetchErrorMessage();
      }
      state.lastFetchedAt = new Date().toISOString();
      recordMobileStatusLog("cloud_fetch_failed");
      render();
      return false;
    }
  }

  function refreshPublicBridgeGroupsLater(baseUrl) {
    const now = Date.now();
    if (state.groups && now - publicBridgeGroupsLastFetchAt < PUBLIC_BRIDGE_GROUPS_REFRESH_MS) return;
    publicBridgeGroupsLastFetchAt = now;
    const token = ++publicBridgeGroupsFetchToken;
    requestJson(`${baseUrl}/monitoramento/grupos.json?compact=1&t=${now}`, { timeoutMs: OPTIONAL_BRIDGE_FETCH_TIMEOUT_MS })
      .then(groupsData => {
        if (!groupsData || token !== publicBridgeGroupsFetchToken || state.source !== "public_bridge") return;
        state.groups = groupsData;
        render();
      })
      .catch(() => {});
  }

  async function refreshPublicBridgeOnce() {
    let lastError = null;
    for (const baseUrl of PUBLIC_BRIDGE_BASE_URLS) {
      try {
        const stamp = Date.now();
        const [status, health, confirmedData] = await Promise.all([
          requestJson(`${baseUrl}/monitoramento/status.json?recentHours=${liveRecentHours}&compact=1&t=${stamp}`, { timeoutMs: CLOUD_FETCH_TIMEOUT_MS }),
          requestJson(`${baseUrl}/health?t=${stamp}`, { timeoutMs: OPTIONAL_BRIDGE_FETCH_TIMEOUT_MS }).catch(() => null),
          requestJson(`${baseUrl}/monitoramento/confirmados.json?limit=${confirmedFetchLimit}&t=${stamp}`, { timeoutMs: CLOUD_FETCH_TIMEOUT_MS }).catch(() => null)
        ]);
        const applied = applyPublicBridgeData(status, health, { confirmedHistory: confirmedData?.confirmed || [], groups: null });
        if (applied) refreshPublicBridgeGroupsLater(baseUrl);
        return applied;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError && !liveStatusRef) {
      state.lastError = liveFetchErrorMessage();
      state.lastFetchedAt = new Date().toISOString();
      recordMobileStatusLog("public_bridge_fetch_failed");
      render();
    }
    return false;
  }

  async function refreshLiveOnce(options = {}) {
    if (liveFetchInFlight) return;
    liveFetchInFlight = true;
    try {
      const tasks = [];
      if (shouldTryLocalBridge()) tasks.push(() => refreshLocalOnce({ force: options.forceLocal }));
      const hostedHttps = window.location.protocol === "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      if (hostedHttps && PUBLIC_BRIDGE_BASE_URLS.length) tasks.push(refreshPublicBridgeOnce);
      if (hostedHttps) tasks.push(refreshCloudOnce);
      if (!hostedHttps && PUBLIC_BRIDGE_BASE_URLS.length) tasks.push(refreshPublicBridgeOnce);
      if (!hostedHttps) tasks.push(refreshCloudOnce);
      let applied = false;
      for (const task of tasks) {
        try {
          applied = Boolean(await task());
        } catch {
          applied = false;
        }
        if (applied && shiftSupervisorMode && state.source === "cloud" && PUBLIC_BRIDGE_BASE_URLS.length) {
          const bridgeApplied = await refreshPublicBridgeOnce().catch(() => false);
          applied = bridgeApplied || applied;
        }
        if (applied) break;
      }
      if (!applied && !state.lastUpdatedAt) {
        state.lastError = liveFetchErrorMessage();
        state.lastFetchedAt = new Date().toISOString();
        render();
      }
    } finally {
      liveFetchInFlight = false;
      flushMobileLogs().catch(() => {});
      flushAiFeedback().catch(() => {});
    }
  }

  function actionForRow(row) {
    if (row.identityResolved === false) return "Conferir quem esta no posto antes de cobrar.";
    if (row.liveConflict) return "Nao cobrar este colaborador sem validar. O grupo indica outra pessoa atuando no posto agora.";
    if (row.requirementType === "shift_start" || String(row.status || "").startsWith("shift_start")) {
      if (row.status === "shift_start_missing") return "Confirmar chegada/inicio do turno. Acionar o colaborador ou responsavel do posto.";
      if (row.status === "shift_start_review_late") return "Abrir a conversa e validar se houve mensagem de entrada/inicio.";
      return "Acompanhar inicio de turno dentro da tolerancia.";
    }
    if (row.status === "schedule_conflict") return "Corrigir escala do dia ou confirmar substituicao antes de qualquer cobranca.";
    if (row.status === "missing") return "Cobrar informe agora e registrar sem informe se nao responder.";
    if (row.status === "late") return "Cobrar atraso e aguardar dentro do limite operacional.";
    if (row.status === "review_late") return "Abrir conversa do grupo e validar a mensagem recebida.";
    if (row.status === "review") return "Revisar porque chegou mensagem fora do padrao confirmado.";
    return "Acompanhar.";
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatBrazilPhone(value) {
    let digits = phoneDigits(value);
    if (!digits) return "";
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    } else if (digits.length > 11) {
      digits = digits.slice(-11);
    }
    if (digits.length >= 10) return `+55 ${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length > 2) return `+55 ${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `+55 ${digits}`;
  }

  function identityDetail(row) {
    const parts = [];
    if (row.contactName && row.contactName !== row.workerName) parts.push(`Contato: ${row.contactName}`);
    if (row.fromPhone) parts.push(`Numero: ${formatBrazilPhone(row.fromPhone) || row.fromPhone}`);
    return parts.join(" / ");
  }

  function conflictDetail(row) {
    const workers = Array.isArray(row.liveConflictWorkers) ? row.liveConflictWorkers : [];
    if (!workers.length) return "";
    const names = workers
      .map(item => item.workerName || item.contactName || formatBrazilPhone(item.fromPhone) || item.fromPhone)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
    return names ? `Evidencia atual no grupo: ${names}` : "";
  }

  function rowKey(row = {}) {
    return [
      row.hourKey || "",
      row.placeId || row.placeName || "",
      row.workerId || row.fromPhone || row.contactName || row.workerName || "",
      row.reportId || row.lastReportAt || ""
    ].join("|");
  }

  function identityLine(row = {}, options = {}) {
    const includePhone = options.includePhone !== false;
    const parts = [];
    if (row.workerName) parts.push(row.workerName);
    if (row.contactName && row.contactName !== row.workerName) parts.push(`Contato: ${row.contactName}`);
    if (includePhone && row.fromPhone) parts.push(formatBrazilPhone(row.fromPhone) || row.fromPhone);
    return parts.join(" / ") || "Funcionario nao identificado";
  }

  function informedHourText(row = {}) {
    const label = hourLabel(row.hourKey || row.startHourKey || "");
    return label && label !== "hora" ? label : "hora nao informada";
  }

  function isDelayed(key) {
    const until = new Date(mobileState.delayed[key] || 0).getTime();
    return Boolean(until && until > Date.now());
  }

  function delayedText(key) {
    const until = new Date(mobileState.delayed[key] || 0);
    return Number.isNaN(until.getTime())
      ? ""
      : until.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  }

  function isResolved(key) {
    return ["done", "ignore"].includes(mobileState.actions[key]?.action);
  }

  function confirmedActionKey(row = {}) {
    return `confirmed:${row.key || rowKey(row)}`;
  }

  function isConfirmedManually(row = {}) {
    return mobileState.actions[confirmedActionKey(row)]?.action === "message_confirmed";
  }

  function dueRowsWithKeys() {
    return (state.status?.current?.dueRows || []).map(row => ({ ...row, key: row.key || rowKey(row) }));
  }

  function sortCurrentRows(a, b) {
    const ad = a.due ? 0 : 1;
    const bd = b.due ? 0 : 1;
    return ad - bd ||
      String(a.placeName).localeCompare(String(b.placeName), "pt-BR") ||
      String(a.workerName || a.contactName || a.fromPhone).localeCompare(String(b.workerName || b.contactName || b.fromPhone), "pt-BR");
  }

  function currentSummaryHourKey() {
    return state.status?.currentHourKey || state.status?.current?.hourKey || state.health?.monitoring?.currentHourKey || "";
  }

  function currentSlotRows() {
    const hourKey = currentSummaryHourKey();
    if (!hourKey) return [];
    const slots = Array.isArray(state.status?.slots) ? state.status.slots : [];
    const slot = slots.find(item => item.hourKey === hourKey);
    return (slot?.rows || []).map(row => ({ ...row, hourKey: row.hourKey || slot.hourKey || hourKey }));
  }

  function currentRowsWithKeys() {
    const current = state.status?.current || {};
    const currentRows = Array.isArray(current.rows) ? current.rows : [];
    const slotRows = currentSlotRows();
    const rows = currentRows.length || slotRows.length ? [...currentRows, ...slotRows] : (current.dueRows || []);
    const seen = new Set();
    return rows
      .map(row => {
        const next = { ...row };
        next.key = next.key || rowKey(next);
        return next;
      })
      .filter(row => {
        const key = row.key || row.rowKey || rowKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(sortCurrentRows);
  }

  function confirmedCurrentRows() {
    return currentRowsWithKeys().filter(row => isConfirmedStatus(row.status));
  }

  function confirmedRecentRows(limit = RECENT_CONFIRMED_LIMIT) {
    const slots = Array.isArray(state.status?.slots) ? state.status.slots : [];
    const rows = [];
    const seen = new Set();
    for (const slot of slots) {
      for (const row of slot.rows || []) {
        if (!isConfirmedStatus(row.status)) continue;
        const hourKey = row.hourKey || slot.hourKey || "";
        const next = { ...row, hourKey, key: row.key || rowKey({ ...row, hourKey }) };
        const dedupeKey = [
          hourKey,
          next.placeId || next.placeName || "",
          next.workerId || next.fromPhone || next.contactName || next.workerName || "",
          next.requirementType || ""
        ].join("|");
        if (!isWithinConfirmedDisplayWindow(next)) continue;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        rows.push(next);
        if (rows.length >= limit) return rows;
      }
    }
    for (const row of state.confirmedHistory || []) {
      const next = { ...row, key: row.key || rowKey(row) };
      const dedupeKey = [
        next.hourKey || "",
        next.placeId || next.placeName || "",
        next.workerId || next.fromPhone || next.contactName || next.workerName || "",
        next.reportId || next.sourceMessageId || ""
      ].join("|");
      if (!isWithinConfirmedDisplayWindow(next)) continue;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push(next);
      if (rows.length >= limit) return rows;
    }
    return rows;
  }

  function addResolvedDisplayRow(rows, seen, row = {}) {
    const next = { ...row, key: row.key || rowKey(row) };
    const logId = next.__resolvedLogId || "";
    const dedupeKey = logId ? `log:${logId}` : [
      "row",
      next.hourKey || "",
      next.placeId || next.placeName || "",
      next.workerId || next.fromPhone || next.contactName || next.workerName || "",
      next.reportId || next.sourceMessageId || next.key || ""
    ].join("|");
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push(next);
  }

  function resolvedRecentRows(limit = CONFIRMED_24H_DISPLAY_LIMIT) {
    const rows = [];
    const seen = new Set();
    for (const row of confirmedRecentRows(limit)) addResolvedDisplayRow(rows, seen, row);
    for (const row of resolvedOverlayLogRows(limit)) addResolvedDisplayRow(rows, seen, row);
    return rows
      .filter(isWithinResolvedDisplayWindow)
      .sort((a, b) => shiftVisibleTimestampMs(b) - shiftVisibleTimestampMs(a))
      .slice(0, limit);
  }

  function shiftSemanticText(row = {}) {
    return [
      row.requirementType,
      row.status,
      row.lastReportSemantic,
      row.textFull,
      row.lastReportTextFull,
      row.text,
      row.lastReportText
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isShiftEndRow(row = {}) {
    const text = shiftSemanticText(row);
    return text.includes("fim de turno") ||
      text.includes("saida") ||
      text.includes("saída") ||
      text.includes("pessoa liberada") ||
      text.includes("finalizando") ||
      text.includes("finalizou");
  }

  function isShiftStartOrHandoffRow(row = {}) {
    const status = String(row.status || "");
    const type = String(row.requirementType || "");
    const text = shiftSemanticText(row);
    return type === "shift_start" ||
      status.startsWith("shift_start") ||
      text.includes("inicio de turno") ||
      text.includes("início de turno") ||
      text.includes("pessoa iniciando") ||
      text.includes("assum") ||
      text.includes("troca/passagem") ||
      text.includes("troca de turno") ||
      text.includes("troca de posto") ||
      text.includes("passagem de posto") ||
      text.includes("passagem de servico") ||
      text.includes("passagem de serviço") ||
      text.includes("rendicao") ||
      text.includes("rendição");
  }

  function isShiftRelatedRow(row = {}) {
    return isShiftStartOrHandoffRow(row) ||
      isShiftEndRow(row);
  }

  function shiftRowTime(row = {}) {
    const candidates = [
      row.operatorShiftFeedbackAt,
      row.operatorShiftResolvedAt,
      row.loggedAt,
      row.updatedAt,
      row.firstReportAt,
      row.lastReportAt,
      row.deadlineAt,
      row.startHourKey ? `${row.startHourKey}:00` : "",
      row.hourKey ? `${row.hourKey}:00` : ""
    ];
    for (const value of candidates) {
      const time = new Date(value || 0).getTime();
      if (!Number.isNaN(time) && time > 0) return time;
    }
    return 0;
  }

  function shiftVisibleTimestampMs(item = {}) {
    const candidates = [
      item.operatorShiftFeedbackAt,
      item.operatorShiftResolvedAt,
      item.loggedAt,
      item.updatedAt,
      item.createdAt,
      item.lastReportAt,
      item.firstReportAt,
      item.lastEvidenceAt,
      item.deadlineAt,
      item.startHourKey ? `${item.startHourKey}:00` : "",
      item.hourKey ? `${item.hourKey}:00` : ""
    ];
    for (const value of candidates) {
      const time = timestampMs(value);
      if (time > 0) return time;
    }
    return 0;
  }

  function shouldLimitConfirmedDisplayWindow() {
    return shiftSupervisorMode || operationalMode;
  }

  function isWithinConfirmedDisplayWindow(item = {}) {
    if (!shouldLimitConfirmedDisplayWindow()) return true;
    return isWithinResolvedDisplayWindow(item);
  }

  function isWithinResolvedDisplayWindow(item = {}) {
    const time = shiftVisibleTimestampMs(item);
    return Boolean(time && Date.now() - time <= SHIFT_LOG_VISIBLE_MS);
  }

  function sortShiftRows(a, b) {
    return shiftRowTime(b) - shiftRowTime(a) ||
      String(a.placeName || "").localeCompare(String(b.placeName || ""), "pt-BR") ||
      String(a.workerName || a.contactName || a.fromPhone || "").localeCompare(String(b.workerName || b.contactName || b.fromPhone || ""), "pt-BR");
  }

  function shiftExpectedDate(row = {}) {
    const key = row.startHourKey || row.hourKey || "";
    const match = String(key).match(/^(\d{4}-\d{2}-\d{2}T\d{2}):(\d{2})$/);
    if (!match) return null;
    const date = new Date(`${match[1]}:${match[2]}:00-03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function shiftEventDate(row = {}) {
    for (const value of [row.firstReportAt, row.lastReportAt, row.lastEvidenceAt]) {
      const date = new Date(value || 0);
      if (!Number.isNaN(date.getTime()) && date.getTime() > 0) return date;
    }
    return null;
  }

  function formatShiftOffset(minutes) {
    const abs = Math.abs(Math.round(Number(minutes || 0)));
    if (abs < 1) return "no horario";
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    if (!hours) return `${mins} min`;
    return mins ? `${hours}h${String(mins).padStart(2, "0")}` : `${hours}h`;
  }

  function shiftTimingInfo(row = {}) {
    const expected = shiftExpectedDate(row);
    if (!expected) {
      return { label: "horario pendente", detail: "Horario esperado nao informado", tone: "warn" };
    }
    const event = shiftEventDate(row);
    if (!event) {
      return { label: "aguardando", detail: "Sem mensagem vinculada nas ultimas 24h", tone: "warn" };
    }
    const expectedText = formatDateTime(expected.toISOString());
    const eventText = formatDateTime(event.toISOString());
    const deltaMinutes = Math.round((event.getTime() - expected.getTime()) / 60000);
    if (deltaMinutes === 0) {
      return { label: "no horario", detail: `previsto ${expectedText} / recebido ${eventText}`, tone: "ok", deltaMinutes };
    }
    const outsideWindow = Math.abs(deltaMinutes) > SHIFT_TIME_WINDOW_MINUTES;
    const label = deltaMinutes < 0
      ? `adiantado ${formatShiftOffset(deltaMinutes)}`
      : `atrasado ${formatShiftOffset(deltaMinutes)}`;
    return {
      label,
      detail: `${label} / previsto ${expectedText} / recebido ${eventText}`,
      tone: deltaMinutes < 0 ? "ok" : outsideWindow ? "bad" : "warn",
      deltaMinutes
    };
  }

  function shiftEscalationReferenceDate(row = {}) {
    for (const value of [row.deadlineAt, row.startHourKey ? `${row.startHourKey}:00` : "", row.hourKey ? `${row.hourKey}:00` : ""]) {
      const date = new Date(value || 0);
      if (!Number.isNaN(date.getTime()) && date.getTime() > 0) return date;
    }
    return shiftExpectedDate(row);
  }

  function shiftDeclarationGaps(row = {}) {
    const gaps = [];
    if (!row.placeId) gaps.push("posto sem vinculo");
    if (!row.workerId && !row.workerName) gaps.push("funcionario sem escala declarada");
    if (!row.startTime && !row.startHourKey && !row.shiftStartLearnedHours?.length) gaps.push("turno sem horario declarado");
    return gaps;
  }

  function shiftEscalationInfo(row = {}) {
    if (!row || !isShiftRelatedRow(row) || isConfirmedStatus(row.status) || isShiftResolvedByFeedback(row)) {
      return { level: "ok", rank: 0, minutesLate: 0, label: "confirmado", detail: "Troca confirmada ou fora da fila." };
    }
    const reference = shiftEscalationReferenceDate(row);
    const minutesLate = reference ? Math.max(0, Math.floor((Date.now() - reference.getTime()) / 60000)) : 0;
    const gaps = shiftDeclarationGaps(row);
    const hasLateStatus = String(row.status || "").includes("missing") || String(row.status || "").includes("review_late");
    const needsDeclaration = gaps.length > 0 || hasLateStatus || row.requirementType === "shift_start";
    if (!needsDeclaration) {
      return { level: "watch", rank: 1, minutesLate, gaps, label: "monitorando", detail: "Troca em acompanhamento." };
    }
    if (minutesLate >= SHIFT_ESCALATION_MINUTES.red) {
      return { level: "red", rank: 4, minutesLate, gaps, label: "vermelho", detail: `${minutesLate} min sem declaracao confirmada.` };
    }
    if (minutesLate >= SHIFT_ESCALATION_MINUTES.orange) {
      return { level: "orange", rank: 3, minutesLate, gaps, label: "laranja", detail: `${minutesLate} min sem declaracao confirmada.` };
    }
    if (minutesLate >= SHIFT_ESCALATION_MINUTES.yellow) {
      return { level: "yellow", rank: 2, minutesLate, gaps, label: "amarelo", detail: `${minutesLate} min sem declaracao confirmada.` };
    }
    return {
      level: "watch",
      rank: 1,
      minutesLate,
      gaps,
      label: gaps.length ? "sem declaracao" : "aguardando",
      detail: reference ? `Prazo monitorado; amarelo em ${Math.max(0, SHIFT_ESCALATION_MINUTES.yellow - minutesLate)} min.` : "Prazo nao informado."
    };
  }

  function shiftEscalationClass(row = {}) {
    return `shift-alert-${shiftEscalationInfo(row).level}`;
  }

  function sortShiftPendingRows(a, b) {
    const ae = shiftEscalationInfo(a);
    const be = shiftEscalationInfo(b);
    return be.rank - ae.rank || shiftRowTime(b) - shiftRowTime(a) ||
      String(a.placeName || "").localeCompare(String(b.placeName || ""), "pt-BR");
  }

  function addShiftRow(rows, seen, row = {}) {
    if (!isShiftRelatedRow(row)) return;
    const next = { ...row, key: row.key || rowKey(row) };
    const dedupeKey = [
      next.key,
      next.reportId || "",
      next.sourceMessageId || "",
      next.placeId || next.placeName || "",
      next.workerId || next.fromPhone || next.contactName || next.workerName || "",
      next.hourKey || ""
    ].join("|");
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push(next);
  }

  function shiftRowsFromSlots() {
    const rows = [];
    const seen = new Set();
    const slots = Array.isArray(state.status?.slots) ? state.status.slots : [];
    for (const slot of slots) {
      for (const row of slot.rows || []) {
        addShiftRow(rows, seen, { ...row, hourKey: row.hourKey || slot.hourKey || "" });
      }
    }
    return rows.sort(sortShiftRows);
  }

  function shiftPendingRows() {
    return shiftRowsFromSlots()
      .filter(isShiftStartOrHandoffRow)
      .filter(row => !isConfirmedStatus(row.status))
      .filter(row => !isShiftResolvedByFeedback(row))
      .sort(sortShiftPendingRows);
  }

  function shiftConfirmedRows(limit = 40) {
    const rows = [];
    const seen = new Set();
    for (const row of shiftRowsFromSlots()) {
      if (isConfirmedStatus(row.status) || isShiftResolvedByFeedback(row)) addShiftRow(rows, seen, shiftFeedbackResolvedRow(row));
    }
    for (const row of confirmedRecentRows(limit * 2)) {
      addShiftRow(rows, seen, row);
    }
    for (const row of resolvedOverlayLogRows(limit * 2, { shiftOnly: true })) {
      addShiftRow(rows, seen, row);
    }
    return rows
      .filter(row => isConfirmedStatus(row.status) || isShiftRelatedRow(row))
      .filter(isWithinConfirmedDisplayWindow)
      .sort(sortShiftRows)
      .slice(0, limit);
  }

  function shiftActiveRow(rows = []) {
    if (!rows.length) return null;
    const activeKey = mobileState.queueTab === "confirmed" ? mobileState.activeConfirmedKey : mobileState.activeKey;
    return rows.find(row => row.key === activeKey) || rows[0];
  }

  function pendingCurrentRows() {
    return currentRowsWithKeys().filter(row => !isConfirmedStatus(row.status));
  }

  function pendingDueRows() {
    return dueRowsWithKeys()
      .filter(row => !isResolved(row.key))
      .filter(row => !isDelayed(row.key));
  }

  function isOperationalActionRow(row = {}) {
    const status = String(row.status || "");
    const suggestion = aiSuggestionForRow(row) || {};
    const trainingLanes = new Set([
      "safe_confirmation_review",
      "worker_mapping_candidate",
      "group_mapping",
      "worker_identity_review",
      "place_conflict",
      "incident_review",
      "manual_review"
    ]);
    if (trainingLanes.has(suggestion.lane)) return false;
    if (["review", "review_late", "shift_start_review", "shift_start_review_late", "schedule_conflict"].includes(status)) return false;
    return Boolean(row.due) && !isConfirmedStatus(status);
  }

  function operationalRows(rows = []) {
    return operationalMode ? rows.filter(isOperationalActionRow) : rows;
  }

  function visiblePendingDueRows() {
    return visibleTrainingRows(operationalRows(pendingDueRows()));
  }

  function visiblePendingCurrentRows() {
    return visibleTrainingRows(operationalRows(pendingCurrentRows()));
  }

  function activeMobileRow() {
    const rows = visiblePendingDueRows();
    if (!rows.length) return null;
    return rows.find(row => row.key === mobileState.activeKey) || rows[0];
  }

  function activeConfirmedRow(rows = confirmedRecentRows(CONFIRMED_24H_DISPLAY_LIMIT)) {
    if (mobileState.queueTab !== "confirmed" || !mobileState.activeConfirmedKey) return null;
    return rows.find(row => row.key === mobileState.activeConfirmedKey) || null;
  }

  function summaryExpectedRows() {
    if (shiftSupervisorMode) return [...shiftPendingRows(), ...shiftConfirmedRows(SHIFT_RESOLVED_LIST_LIMIT)];
    return visibleTrainingRows(currentRowsWithKeys());
  }

  function summaryDueRows() {
    return shiftSupervisorMode ? shiftPendingRows() : visiblePendingDueRows();
  }

  function summaryQueueRows() {
    if (shiftSupervisorMode) {
      return mobileState.queueTab === "confirmed" ? shiftConfirmedRows(SHIFT_RESOLVED_LIST_LIMIT) : shiftPendingRows();
    }
    return mobileState.queueTab === "confirmed" ? resolvedRecentRows(CONFIRMED_24H_DISPLAY_LIMIT) : visiblePendingDueRows();
  }

  function summaryRowsForType(type) {
    if (type === "due") return summaryDueRows();
    if (type === "queue") return summaryQueueRows();
    return summaryExpectedRows();
  }

  function summaryDropdownTitle(type) {
    if (shiftSupervisorMode) {
      if (type === "due") return "Trocas nao confirmadas";
      if (type === "queue") return mobileState.queueTab === "confirmed" ? "Resolvidos na lista" : "Nao confirmados na lista";
      return "Trocas esperadas";
    }
    if (type === "due") return "Intervencoes necessarias";
    if (type === "queue") return mobileState.queueTab === "confirmed" ? "Resolvidos na fila" : "Fila de acoes";
    return "Esperados nesta hora";
  }

  function summaryDropdownEmptyText(type) {
    if (type === "due") return "Nenhuma intervencao pendente agora.";
    if (type === "queue") return mobileState.queueTab === "confirmed" ? "Nenhum resolvido carregado nesta janela." : "Fila limpa.";
    return "Nenhum detalhe de esperado carregado para esta hora.";
  }

  function summaryRowTone(row = {}) {
    if (isResolvedLogRow(row)) return overlayActionTone(row.__resolvedLog?.action);
    if (shiftSupervisorMode && isShiftRelatedRow(row)) return shiftEscalationClass(row).replace("shift-alert-", "");
    return statusTone(row.status) || (isConfirmedStatus(row.status) ? "ok" : "");
  }

  function summaryRowTitle(row = {}) {
    if (isResolvedLogRow(row)) return `${overlayActionLabel(row.__resolvedLog?.action)} / ${row.placeName || "Posto"}`;
    return row.placeName || row.groupSubject || "Posto";
  }

  function summaryRowMeta(row = {}) {
    if (shiftSupervisorMode && isShiftRelatedRow(row)) {
      const person = shiftPersonFromRow(row);
      return [
        shiftExpectedDisplay(row),
        person?.name || row.workerName || row.contactName || "QRA pendente",
        shiftDisplayStatus(row)
      ].filter(Boolean).join(" / ");
    }
    return [
      hourLabel(row.hourKey || row.startHourKey || ""),
      identityLine(row, { includePhone: false }),
      statusLabel(row.status)
    ].filter(Boolean).join(" / ");
  }

  function summaryRowDetail(row = {}) {
    if (isResolvedLogRow(row)) return operatorSituationText(row.__resolvedLog, row);
    if (shiftSupervisorMode && isShiftRelatedRow(row)) return shiftTimingInfo(row).detail || actionForRow(row);
    if (isConfirmedStatus(row.status)) return `${informedHourText(row)} informado.`;
    return actionForRow(row);
  }

  function summaryRowSelectable(row = {}, type) {
    if (!row?.key) return false;
    if (type === "expected") return shiftSupervisorMode;
    return true;
  }

  function summaryRowHtml(row = {}, type) {
    const selectable = summaryRowSelectable(row, type);
    const tag = selectable ? "button" : "div";
    const attrs = selectable
      ? `type="button" data-summary-row-key="${escapeHtml(row.key || "")}" data-summary-row-kind="${escapeHtml(isConfirmedStatus(row.status) || isResolvedLogRow(row) ? "confirmed" : "pending")}"`
      : "";
    const tone = summaryRowTone(row);
    return `
      <${tag} class="summary-detail-row ${selectable ? "selectable" : ""}" ${attrs}>
        <span class="summary-detail-main">
          <strong>${escapeHtml(summaryRowTitle(row))}</strong>
          <small>${escapeHtml(summaryRowMeta(row))}</small>
        </span>
        <em class="${escapeHtml(tone || "muted")}">${escapeHtml(summaryRowDetail(row))}</em>
      </${tag}>
    `;
  }

  function renderSummaryDropdown() {
    if (!el.summaryDropdown || !el.summaryButtons.length) return;
    const openType = state.summaryDropdownOpen || "";
    el.summaryButtons.forEach(button => {
      const active = (button.getAttribute("data-summary-detail") || "") === openType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-expanded", active ? "true" : "false");
    });
    if (!openType) {
      el.summaryDropdown.classList.add("hidden");
      el.summaryDropdown.innerHTML = "";
      return;
    }
    const rows = summaryRowsForType(openType);
    const limitRows = rows.slice(0, SUMMARY_DROPDOWN_LIMIT);
    el.summaryDropdown.classList.remove("hidden");
    el.summaryDropdown.innerHTML = `
      <div class="summary-dropdown-head">
        <strong>${escapeHtml(summaryDropdownTitle(openType))}</strong>
        <span>${escapeHtml(`${rows.length} registro(s)`)}</span>
      </div>
      <div class="summary-detail-list">
        ${limitRows.length ? limitRows.map(row => summaryRowHtml(row, openType)).join("") : `<div class="summary-detail-empty">${escapeHtml(summaryDropdownEmptyText(openType))}</div>`}
        ${rows.length > limitRows.length ? `<div class="summary-detail-empty">Mostrando ${SUMMARY_DROPDOWN_LIMIT} de ${rows.length}. Use a fila abaixo para ver mais.</div>` : ""}
      </div>
    `;
  }

  function normalizeMobileLogRow(row = {}) {
    const textFull = rowFullMessage(row);
    return {
      key: row.key || row.rowKey || rowKey(row),
      placeId: row.placeId || "",
      placeName: row.placeName || "",
      groupId: row.groupId || "",
      groupSubject: row.groupSubject || "",
      workerId: row.workerId || "",
      workerName: row.workerName || "",
      fromPhone: row.fromPhone || "",
      contactName: row.contactName || "",
      role: row.role || "",
      scale: row.scale || "",
      status: row.status || "",
      hourKey: row.hourKey || "",
      due: Boolean(row.due),
      requirementType: row.requirementType || "",
      startTime: row.startTime || "",
      startHourKey: row.startHourKey || "",
      deadlineAt: row.deadlineAt || "",
      firstReportAt: row.firstReportAt || "",
      shiftStartExpectedAtHour: row.shiftStartExpectedAtHour === false ? false : row.shiftStartExpectedAtHour || "",
      shiftStartLearningSummary: row.shiftStartLearningSummary || "",
      outgoingWorkerName: row.outgoingWorker?.workerName || row.outgoingWorkerName || "",
      outgoingContactName: row.outgoingWorker?.contactName || row.outgoingContactName || "",
      outgoingFromPhone: row.outgoingWorker?.fromPhone || row.outgoingFromPhone || "",
      outgoingLastReportAt: row.outgoingWorker?.lastReportAt || row.outgoingLastReportAt || "",
      outgoingLastReportSemantic: row.outgoingWorker?.lastReportSemantic || row.outgoingLastReportSemantic || "",
      graceMinutes: Number(row.graceMinutes || 0),
      scheduleSource: row.scheduleSource || "",
      identityResolved: row.identityResolved !== false,
      lastReportAt: row.lastReportAt || "",
      lastReportSemantic: row.lastReportSemantic || "",
      reviewReason: row.reviewReason || "",
      reportId: row.reportId || "",
      sourceMessageId: row.sourceMessageId || "",
      aiSuggestion: row.aiSuggestion || null,
      text: String(row.text || row.lastReportText || ""),
      textFull,
      lastReportText: String(row.lastReportText || ""),
      lastReportTextFull: String(row.lastReportTextFull || textFull || ""),
      hasMedia: Boolean(row.hasMedia),
      mediaKind: row.mediaKind || "",
      messageDisplayValidation: row.messageDisplayValidation || row.displayValidation || row.aiSuggestion?.displayValidation || null
    };
  }

  function safeDocId(value) {
    const text = String(value || `${Date.now()}-${Math.random().toString(16).slice(2)}`).trim();
    return text.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 140);
  }

  function mobileDeviceLabel() {
    const mode = isStandaloneMode() ? "app instalado" : "navegador";
    return `mobile-web / ${mode}`;
  }

  function overlayLogStableKey(log = {}) {
    return log.id || [
      log.loggedAt || "",
      log.action || "",
      log.rowKey || "",
      log.row?.placeId || log.row?.placeName || "",
      log.row?.workerId || log.row?.fromPhone || log.row?.workerName || ""
    ].join("|");
  }

  function normalizeOverlayLogList(logs = []) {
    const byKey = new Map();
    for (const log of Array.isArray(logs) ? logs : []) {
      if (!log || typeof log !== "object") continue;
      const key = overlayLogStableKey(log);
      if (!key) continue;
      byKey.set(key, { ...log, id: log.id || safeDocId(key) });
    }
    return [...byKey.values()]
      .sort((a, b) => String(b.loggedAt || "").localeCompare(String(a.loggedAt || "")))
      .slice(0, OVERLAY_LOG_CACHE_LIMIT);
  }

  function saveOverlayLogCache(logs = []) {
    const normalized = normalizeOverlayLogList(logs);
    state.overlayLogs = normalized;
    for (let limit = normalized.length; limit > 0; limit = Math.floor(limit / 2)) {
      if (writeStore(MOBILE_STORAGE_KEYS.overlayLogs, normalized.slice(0, limit))) return;
    }
    writeStore(MOBILE_STORAGE_KEYS.overlayLogs, []);
  }

  function mergeOverlayLogs(logs = []) {
    saveOverlayLogCache([...(logs || []), ...(state.overlayLogs || [])]);
    return state.overlayLogs;
  }

  function prependLocalOverlayLog(event) {
    mergeOverlayLogs([event]);
  }

  function buildMobileLogEvent(action, row, reason = "") {
    const now = new Date().toISOString();
    const key = row?.key || rowKey(row || {});
    return {
      id: safeDocId([now, "mobile-web", action, key || Math.random().toString(16).slice(2)].join(":")),
      loggedAt: now,
      action: action || "unknown",
      reason,
      operatorUser: "mobile",
      computerName: mobileDeviceLabel(),
      appVersion: "web-pwa",
      rowKey: key,
      row: normalizeMobileLogRow(row || {}),
      source: "monitoramento-mobile-app",
      uploadedAt: now,
      uploadReason: "mobile_direct"
    };
  }

  function savePendingMobileLogs(logs) {
    mobileState.pendingLogs = logs.slice(-300);
    writeStore(MOBILE_STORAGE_KEYS.pendingLogs, mobileState.pendingLogs);
  }

  function monitoramentoBridgeBaseUrls() {
    const urls = [];
    if (shouldTryLocalBridge()) urls.push("http://127.0.0.1:18991");
    for (const baseUrl of PUBLIC_BRIDGE_BASE_URLS) {
      if (baseUrl && !urls.includes(baseUrl)) urls.push(baseUrl);
    }
    return urls;
  }

  async function sendMobileLogEvent(event) {
    for (const baseUrl of monitoramentoBridgeBaseUrls()) {
      try {
        const response = await withTimeout(fetch(`${baseUrl}/monitoramento/overlay-log`, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(event)
        }), CLOUD_FETCH_TIMEOUT_MS, "envio de log");
        if (response.ok) return;
      } catch {
        // Firestore remains as fallback when the public bridge is temporarily unreachable.
      }
    }
    if (!liveDb) throw new Error("Conexao do portal ainda nao carregou.");
    await liveDb.collection(MOBILE_LOG_COLLECTION).doc(event.id).set(event, { merge: true });
  }

  async function flushMobileLogs() {
    if (!mobileState.pendingLogs.length) return;
    const remaining = [];
    for (const event of mobileState.pendingLogs) {
      try {
        await sendMobileLogEvent(event);
      } catch {
        remaining.push(event);
      }
    }
    savePendingMobileLogs(remaining);
  }

  function aiSuggestionForRow(row = {}) {
    const suggestion = row.aiSuggestion && typeof row.aiSuggestion === "object" ? row.aiSuggestion : null;
    if (!suggestion) return null;
    return {
      id: suggestion.id || "",
      lane: suggestion.lane || "manual_review",
      enabled: suggestion.enabled === true,
      title: suggestion.title || "Sugestao AI",
      summary: suggestion.summary || "",
      recommendation: suggestion.recommendation || "",
      confidence: Number(suggestion.confidence || 0),
      manualOnly: suggestion.manualOnly === true,
      fullText: suggestion.fullText || rowFullMessage(row),
      displayValidation: suggestion.displayValidation || rowDisplayValidation(row) || null,
      feedbackActions: Array.isArray(suggestion.feedbackActions) ? suggestion.feedbackActions : ["approve", "correct", "reject"]
    };
  }

  function aiFeedbackKey(row = {}) {
    const suggestion = aiSuggestionForRow(row) || {};
    return [
      suggestion.id || "",
      row.key || rowKey(row),
      row.reportId || row.sourceMessageId || "",
      row.hourKey || ""
    ].join("|");
  }

  function isAiFeedbackResolution(action = "") {
    return AI_FEEDBACK_RESOLUTION_ACTIONS.has(String(action || ""));
  }

  function aiFeedbackRecentEvents() {
    const sources = [
      state.aiFeedback?.recent,
      state.status?.aiFeedback?.recent,
      state.status?.current?.aiFeedback?.recent,
      state.health?.aiFeedback?.recent
    ];
    return sources.flatMap(source => Array.isArray(source) ? source : []);
  }

  function aiFeedbackEventMatchesRow(event = {}, row = {}) {
    const suggestion = aiSuggestionForRow(row) || {};
    const eventSuggestion = event.suggestion && typeof event.suggestion === "object" ? event.suggestion : {};
    const rowKeys = new Set([
      row.key || rowKey(row),
      row.rowKey,
      row.reportId,
      row.sourceMessageId
    ].filter(Boolean).map(String));
    const eventRow = event.row && typeof event.row === "object" ? event.row : {};
    const eventKeys = [
      event.rowKey,
      event.rowId,
      event.reportId,
      event.sourceMessageId,
      eventRow.key,
      eventRow.rowKey,
      eventRow.reportId,
      eventRow.sourceMessageId
    ].filter(Boolean).map(String);
    if (eventKeys.some(key => rowKeys.has(key))) return true;
    const eventSuggestionId = event.suggestionId || eventSuggestion.id || "";
    return Boolean(suggestion.id && eventSuggestionId && String(suggestion.id) === String(eventSuggestionId));
  }

  function aiFeedbackResolutionForRow(row = {}) {
    const local = mobileState.aiFeedback[aiFeedbackKey(row)];
    if (isAiFeedbackResolution(local?.action)) return local;
    const remote = aiFeedbackRecentEvents().find(event =>
      isAiFeedbackResolution(event?.action) && aiFeedbackEventMatchesRow(event, row)
    );
    return remote ? {
      action: remote.action,
      at: remote.loggedAt || remote.updatedAt || "",
      correction: remote.correction || "",
      remote: true
    } : null;
  }

  function isAiFeedbackResolvedRow(row = {}) {
    return adminTrainingMode && Boolean(aiFeedbackResolutionForRow(row));
  }

  function visibleTrainingRows(rows = []) {
    return adminTrainingMode ? rows.filter(row => !isAiFeedbackResolvedRow(row)) : rows;
  }

  function saveAiFeedbackState() {
    writeStore(MOBILE_STORAGE_KEYS.aiFeedback, mobileState.aiFeedback);
  }

  function savePendingAiFeedback(events) {
    mobileState.pendingAiFeedback = events.slice(-300);
    writeStore(MOBILE_STORAGE_KEYS.pendingAiFeedback, mobileState.pendingAiFeedback);
  }

  function normalizeLookup(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function saveManualPlaceInfoList(rows) {
    mobileState.manualPlaceInfo = rows.slice(-200);
    writeStore(MOBILE_STORAGE_KEYS.manualPlaceInfo, mobileState.manualPlaceInfo);
  }

  function manualRuleScope(item = {}) {
    const explicit = String(item.ruleScope || item.scope || "").trim();
    if (explicit) return explicit;
    if (item.workerId || item.workerName || item.fromPhone || item.contactName || item.shiftKind) return "shift";
    return "place";
  }

  function manualRuleScopeLabel(scope) {
    const labels = {
      place: "posto",
      worker: "funcionario",
      place_shift: "posto + turno",
      place_worker: "posto + funcionario",
      shift: "turno",
      place_worker_shift: "posto + funcionario + turno",
      group: "grupo",
      group_shift: "grupo + turno"
    };
    return labels[scope] || "regra";
  }

  function manualShiftKindLabel(kind) {
    const labels = {
      shift_start: "inicio",
      shift_end: "saida",
      shift_handoff: "passagem",
      no_qra_needed: "sem QRA",
      custom: "custom"
    };
    return labels[kind] || "";
  }

  function manualPlaceClientKey(item = {}) {
    const placeId = String(item.placeId || "").trim();
    const groupId = String(item.groupId || "").trim();
    const label = String(item.placeName || item.name || item.groupSubject || item.label || "").trim();
    const worker = String(item.workerId || item.fromPhone || item.workerName || item.contactName || "").trim();
    const shiftKind = String(item.shiftKind || "").trim();
    const scope = manualRuleScope(item);
    if (!item.key && (scope !== "place" || worker || shiftKind)) {
      return safeDocId([
        scope,
        placeId || groupId || normalizeLookup(label) || "sem-posto",
        normalizeLookup(worker),
        shiftKind
      ].filter(Boolean).join(":")).slice(0, 180);
    }
    return String(item.key || placeId || groupId || safeDocId(normalizeLookup(label) || "sem-posto")).slice(0, 180);
  }

  function clearManualPlaceForm() {
    state.manualPlaceInfoEditingKey = "";
    if (el.manualPlaceName) el.manualPlaceName.value = "";
    if (el.manualWorkerName) el.manualWorkerName.value = "";
    if (el.manualRuleScope) el.manualRuleScope.value = shiftSupervisorMode ? "place_worker_shift" : "place";
    if (el.manualShiftKind) el.manualShiftKind.value = shiftSupervisorMode ? "shift_start" : "";
    if (el.manualPlaceStartTime) el.manualPlaceStartTime.value = "";
    if (el.manualPlacePatternText) el.manualPlacePatternText.value = "";
  }

  function manualPlaceCatalog() {
    const map = new Map();
    function addPlace(place = {}) {
      const placeId = String(place.placeId || place.id || "").trim();
      const placeName = String(place.placeName || place.name || "").trim();
      const groupId = String(place.groupId || "").trim();
      const groupSubject = String(place.groupSubject || "").trim();
      const label = placeName || groupSubject || placeId || groupId;
      if (!label) return;
      const key = placeId || groupId || normalizeLookup(label);
      if (!map.has(key)) map.set(key, { placeId, placeName: placeName || groupSubject, groupId, groupSubject, label });
    }
    for (const place of state.status?.groupLearning?.hourlyPlaces || []) addPlace(place);
    for (const place of state.status?.groupLearning?.shiftStartPlaces || []) addPlace(place);
    for (const place of state.status?.groupLearning?.manualPlacePatterns || []) addPlace(place);
    for (const place of state.groups?.places || []) addPlace(place);
    for (const group of state.groups?.groups || []) addPlace(group);
    for (const row of monitoramentoRowsForFeedbackLookup()) addPlace(row);
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function selectedManualPlace() {
    const typed = String(el.manualPlaceName?.value || "").trim();
    const normalized = normalizeLookup(typed);
    const catalog = manualPlaceCatalog();
    const matched = catalog.find(place =>
      normalizeLookup(place.label) === normalized ||
      normalizeLookup(place.placeName) === normalized ||
      normalizeLookup(place.groupSubject) === normalized ||
      String(place.placeId || "") === typed ||
      String(place.groupId || "") === typed
    );
    return matched || { placeId: "", placeName: typed, groupId: "", groupSubject: "" };
  }

  function manualWorkerCatalog() {
    const map = new Map();
    function addWorker(row = {}) {
      const workerId = String(row.workerId || "").trim();
      const workerName = String(row.workerName || "").trim();
      const contactName = String(row.contactName || row.outgoingContactName || "").trim();
      const fromPhone = String(row.fromPhone || row.outgoingFromPhone || "").trim();
      const label = workerName || contactName || formatBrazilPhone(fromPhone) || fromPhone;
      if (!label) return;
      const key = workerId || phoneDigits(fromPhone) || normalizeLookup(label);
      if (!map.has(key)) map.set(key, { workerId, workerName: workerName || contactName, contactName, fromPhone, label });
    }
    for (const row of monitoramentoRowsForFeedbackLookup()) {
      addWorker(row);
      addWorker({
        workerName: row.outgoingWorkerName,
        contactName: row.outgoingContactName,
        fromPhone: row.outgoingFromPhone
      });
    }
    for (const row of mobileState.manualPlaceInfo || []) addWorker(row);
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function selectedManualWorker() {
    const typed = String(el.manualWorkerName?.value || "").trim();
    if (!typed) return {};
    const normalized = normalizeLookup(typed);
    const digits = phoneDigits(typed);
    const matched = manualWorkerCatalog().find(worker =>
      normalizeLookup(worker.label) === normalized ||
      normalizeLookup(worker.workerName) === normalized ||
      normalizeLookup(worker.contactName) === normalized ||
      (digits && phoneDigits(worker.fromPhone) === digits) ||
      String(worker.workerId || "") === typed
    );
    return matched || { workerId: "", workerName: typed, contactName: "", fromPhone: "" };
  }

  function manualPlaceInfoEventId(item = {}) {
    return safeDocId([
      item.createdAt || new Date().toISOString(),
      item.action || "manual_info",
      "manual-place-info",
      item.key || item.placeId || item.placeName || item.groupId || item.groupSubject || "sem-posto",
      item.ruleScope || "",
      item.workerId || item.workerName || item.fromPhone || item.contactName || "",
      item.shiftKind || "",
      item.startingTime || "",
      item.patternText || ""
    ].join(":"));
  }

  function buildManualPlaceInfoEvent(item = {}) {
    const action = item.action || "manual_info";
    const isDelete = action === "manual_info_delete";
    const text = isDelete
      ? `Regra manual excluida: ${item.placeName || item.groupSubject || item.key || "posto"}`
      : (item.patternText || item.startingTime || "");
    const displayValidation = {
      kind: "monitoramento_manual_place_info",
      context: "operator_manual_pattern",
      validToShow: true,
      decision: "show_full_text_if_needed",
      why: "Informacao digitada pelo operador para orientar o agente.",
      how: "Usar como padrao manual do posto junto com historico e feedback aprovado.",
      willSendMessage: false,
      textLength: text.length,
      truncated: false,
      textSha1: safeDocId(text).slice(0, 40)
    };
    return {
      id: item.id,
      loggedAt: item.createdAt,
      action,
      correction: isDelete ? "Regra manual excluida pelo operador." : item.patternText,
      reason: isDelete ? "operator_deleted_manual_place_pattern" : "operator_manual_place_pattern",
      rowKey: item.key || item.placeId || item.placeName || item.groupId || item.groupSubject || item.id,
      lane: "manual_place_pattern",
      manualInfo: {
        key: item.key || "",
        replacesKey: item.replacesKey || "",
        placeId: item.placeId || "",
        placeName: item.placeName || "",
        groupId: item.groupId || "",
        groupSubject: item.groupSubject || "",
        ruleScope: item.ruleScope || "",
        workerId: item.workerId || "",
        workerName: item.workerName || "",
        fromPhone: item.fromPhone || "",
        contactName: item.contactName || "",
        shiftKind: item.shiftKind || "",
        startingTime: item.startingTime || "",
        patternText: item.patternText || "",
        deletedAt: item.deletedAt || "",
        source: item.source || "monitoramento-manual-place-info",
        updatedAt: item.createdAt
      },
      suggestion: {
        id: `manual-place-pattern-${item.id}`,
        lane: "manual_place_pattern",
        enabled: !isDelete,
        title: isDelete ? "Excluir regra manual de turno" : "Regra manual de turno",
        summary: isDelete ? "Remover regra ativa do agente" : (item.startingTime ? `Inicio esperado ${item.startingTime}` : "Informacao manual do posto"),
        recommendation: isDelete ? "Remover esta regra das regras ativas do agente." : (item.patternText || `Usar inicio esperado ${item.startingTime}`),
        confidence: 1,
        manualOnly: false,
        fullText: text,
        displayValidation
      },
      row: {
        placeId: item.placeId || "",
        placeName: item.placeName || "",
        groupId: item.groupId || "",
        groupSubject: item.groupSubject || "",
        workerId: item.workerId || "",
        workerName: item.workerName || "",
        fromPhone: item.fromPhone || "",
        contactName: item.contactName || "",
        status: isDelete ? "manual_place_pattern_deleted" : "manual_place_pattern",
        requirementType: "manual_place_pattern",
        startTime: item.startingTime || "",
        text
      },
      messageTextFull: text,
      messageDisplayValidation: displayValidation,
      operatorUser: "mobile",
      computerName: mobileDeviceLabel(),
      appVersion: "web-pwa",
      source: item.source || "monitoramento-manual-place-info"
    };
  }

  async function refreshOperationAfterManualPlaceChange() {
    await refreshLiveOnce({ forceLocal: true }).catch(() => {});
    await refreshOverlayLogsOnce({ recovery: true }).catch(() => false);
    renderMobileOverlay();
    renderShiftSchedule();
    renderShiftExport();
  }

  async function saveManualPlaceInfo() {
    const place = selectedManualPlace();
    const worker = selectedManualWorker();
    const ruleScope = String(el.manualRuleScope?.value || (shiftSupervisorMode ? "place_worker_shift" : "place")).trim();
    const shiftKind = String(el.manualShiftKind?.value || (shiftSupervisorMode ? "shift_start" : "")).trim();
    const startingTime = String(el.manualPlaceStartTime?.value || "").trim();
    const patternText = cleanManualPatternText(el.manualPlacePatternText?.value || "");
    const editingKey = state.manualPlaceInfoEditingKey || "";
    const hasPlace = Boolean(place.placeName || place.placeId || place.groupSubject || place.groupId);
    const hasWorker = Boolean(worker.workerName || worker.workerId || worker.contactName || worker.fromPhone);
    if (!hasPlace && !hasWorker) {
      state.manualPlaceInfoStatus = "Informe posto/local ou funcionario antes de salvar.";
      renderManualPlaceInfo();
      el.manualPlaceName?.focus();
      return;
    }
    if (!startingTime && !patternText) {
      state.manualPlaceInfoStatus = "Informe horario de inicio ou padrao do posto.";
      renderManualPlaceInfo();
      el.manualPlacePatternText?.focus();
      return;
    }
    if ((ruleScope === "worker" || ruleScope === "place_worker" || ruleScope === "place_worker_shift") && !hasWorker) {
      state.manualPlaceInfoStatus = "Informe o funcionario/QRA para esta regra.";
      renderManualPlaceInfo();
      el.manualWorkerName?.focus();
      return;
    }
    const targetKey = editingKey || manualPlaceClientKey({ ...place, ...worker, ruleScope, shiftKind });
    const item = {
      id: "",
      key: targetKey,
      replacesKey: editingKey && editingKey !== targetKey ? editingKey : "",
      action: "manual_info",
      placeId: place.placeId || "",
      placeName: place.placeName || place.label || "",
      groupId: place.groupId || "",
      groupSubject: place.groupSubject || "",
      ruleScope,
      workerId: worker.workerId || "",
      workerName: worker.workerName || worker.label || "",
      fromPhone: worker.fromPhone || "",
      contactName: worker.contactName || "",
      shiftKind,
      startingTime,
      patternText,
      createdAt: new Date().toISOString(),
      source: shiftSupervisorMode ? "monitoramento-shift-rules" : "monitoramento-manual-place-info"
    };
    item.id = manualPlaceInfoEventId(item);
    const rows = mobileState.manualPlaceInfo.filter(row => manualPlaceClientKey(row) !== targetKey && row.id !== item.id);
    rows.push(item);
    saveManualPlaceInfoList(rows);
    state.manualPlaceInfoStatus = editingKey ? "Padrao atualizado neste navegador." : "Padrao salvo neste navegador.";
    const event = buildManualPlaceInfoEvent(item);
    try {
      await sendAiFeedbackEvent(event);
      await flushAiFeedback();
      await refreshOperationAfterManualPlaceChange();
      state.manualPlaceInfoStatus = editingKey ? "Regra atualizada, parseada e aplicada ao agente/operacao." : "Regra salva, parseada e aplicada ao agente/operacao.";
      state.shiftExportStatus = "Operacao reatualizada com a regra salva.";
    } catch {
      savePendingAiFeedback([...mobileState.pendingAiFeedback, event]);
      state.manualPlaceInfoStatus = editingKey ? "Padrao atualizado. Envio ao bridge ficou pendente." : "Padrao salvo. Envio ao bridge ficou pendente.";
      state.shiftExportStatus = "Regra salva localmente; envio ao bridge ficou pendente.";
    }
    clearManualPlaceForm();
    render();
    showToast(state.manualPlaceInfoStatus);
  }

  async function deleteManualPlaceInfo(key) {
    const row = manualPlaceInfoRows().find(item => String(item.id || "") === String(key || ""));
    if (!row) return;
    const label = row.placeName || row.groupSubject || "este posto";
    if (!window.confirm(`Excluir a regra manual de ${label}?`)) return;
    const now = new Date().toISOString();
    const item = {
      ...row,
      id: "",
      key: row.id,
      action: "manual_info_delete",
      deletedAt: now,
      createdAt: now,
      source: row.source || (shiftSupervisorMode ? "monitoramento-shift-rules" : "monitoramento-manual-place-info")
    };
    item.id = manualPlaceInfoEventId(item);
    const rows = mobileState.manualPlaceInfo.filter(entry => manualPlaceClientKey(entry) !== row.id && entry.id !== item.id);
    rows.push(item);
    saveManualPlaceInfoList(rows);
    state.manualPlaceInfoStatus = "Regra removida neste navegador.";
    if (state.manualPlaceInfoEditingKey === row.id) clearManualPlaceForm();
    const event = buildManualPlaceInfoEvent(item);
    try {
      await sendAiFeedbackEvent(event);
      await flushAiFeedback();
      await refreshOperationAfterManualPlaceChange();
      state.manualPlaceInfoStatus = "Regra removida, parseada e aplicada ao agente/operacao.";
      state.shiftExportStatus = "Operacao reatualizada apos remover a regra.";
    } catch {
      savePendingAiFeedback([...mobileState.pendingAiFeedback, event]);
      state.manualPlaceInfoStatus = "Regra removida. Envio ao bridge ficou pendente.";
      state.shiftExportStatus = "Remocao salva localmente; envio ao bridge ficou pendente.";
    }
    render();
    showToast(state.manualPlaceInfoStatus);
  }

  function startManualPlaceEdit(key) {
    const row = manualPlaceInfoRows(MANUAL_PLACE_INFO_LOOKUP_LIMIT).find(item => String(item.id || "") === String(key || ""));
    if (!row) return;
    state.manualPlaceInfoEditingKey = row.id || manualPlaceClientKey(row);
    state.manualPlaceInfoOpen = true;
    state.manualPlaceInfoStatus = `Editando ${row.placeName || row.groupSubject || "posto"}.`;
    if (el.manualPlaceName) el.manualPlaceName.value = row.placeName || row.groupSubject || "";
    if (el.manualWorkerName) el.manualWorkerName.value = row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone || "";
    if (el.manualRuleScope) el.manualRuleScope.value = manualRuleScope(row);
    if (el.manualShiftKind) el.manualShiftKind.value = row.shiftKind || (shiftSupervisorMode ? "shift_start" : "");
    if (el.manualPlaceStartTime) el.manualPlaceStartTime.value = row.startingTime || "";
    if (el.manualPlacePatternText) el.manualPlacePatternText.value = row.patternText || "";
    renderManualPlaceInfo();
    try {
      el.manualPlaceInfoBox?.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
      // Older WebViews may not support scroll options.
    }
    try {
      el.manualPlacePatternText?.focus({ preventScroll: true });
    } catch {
      el.manualPlacePatternText?.focus();
    }
  }

  function cancelManualPlaceEdit() {
    clearManualPlaceForm();
    state.manualPlaceInfoStatus = "";
    renderManualPlaceInfo();
  }

  function remoteManualPlacePatterns() {
    const rows = state.status?.groupLearning?.manualPlacePatterns ||
      state.aiFeedback?.manualPlacePatterns ||
      [];
    return Array.isArray(rows) ? rows : [];
  }

  function cleanManualPatternText(value = "") {
    const text = String(value || "").trim();
    if (!text) return "";
    const cleaned = text
      .replace(/(?:^|\s*\/\s*)Pessoa (?:provavel|aprendida) por informe (?:recente|do mesmo horario)(?:\s*\([^)]+\))?\.?/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const generated = /pessoa (?:provavel|aprendida) por informe/.test(normalizeLookup(text));
    return generated && !cleaned ? "" : cleaned;
  }

  function isGeneratedEvidenceOnlyPattern(value = "") {
    const text = String(value || "").trim();
    return Boolean(text && /pessoa (?:provavel|aprendida) por informe/.test(normalizeLookup(text)) && !cleanManualPatternText(text));
  }

  function manualShiftKindAllowsStart(shiftKind = "") {
    const value = String(shiftKind || "");
    return !value || value === "shift_start" || value === "shift_handoff";
  }

  function manualShiftKindAllowsEnd(shiftKind = "") {
    const value = String(shiftKind || "");
    return !value || value === "shift_end" || value === "shift_handoff";
  }

  function isScheduleShiftKind(shiftKind = "") {
    const value = String(shiftKind || "");
    return !value || value === "shift_start" || value === "shift_end" || value === "shift_handoff";
  }

  function filteredManualShiftPolicy(policy = null, shiftKind = "") {
    if (!policy || typeof policy !== "object") return null;
    const shiftStartHours = manualShiftKindAllowsStart(shiftKind) && Array.isArray(policy.shiftStartHours)
      ? policy.shiftStartHours
      : [];
    const shiftEndHours = manualShiftKindAllowsEnd(shiftKind) && Array.isArray(policy.shiftEndHours)
      ? policy.shiftEndHours
      : [];
    const summaryParts = [];
    if (policy.suppressHourly) summaryParts.push("Operador declarou que este posto nao exige informes de hora em hora.");
    if (shiftStartHours.length) summaryParts.push(`Inicio declarado: ${shiftStartHours.map(hour => `${String(hour).padStart(2, "0")}h`).join(", ")}.`);
    if (shiftEndHours.length) summaryParts.push(`Fim declarado: ${shiftEndHours.map(hour => `${String(hour).padStart(2, "0")}h`).join(", ")}.`);
    return {
      ...policy,
      shiftStartHours,
      shiftEndHours,
      summary: summaryParts.join(" ") || policy.summary || ""
    };
  }

  function manualPlaceInfoRows(limit = 12) {
    const map = new Map();
    for (const row of remoteManualPlacePatterns()) {
      const patternText = cleanManualPatternText(row.latestPatternText || row.latestNote || "");
      if (isGeneratedEvidenceOnlyPattern(row.latestPatternText || row.latestNote || "")) continue;
      const key = manualPlaceClientKey(row);
      const shiftKind = row.shiftKind || "";
      const policy = filteredManualShiftPolicy(row.policy || null, shiftKind);
      map.set(key, {
        id: key,
        key,
        placeId: row.placeId || "",
        placeName: row.placeName || row.groupSubject || "Posto",
        groupId: row.groupId || "",
        groupSubject: row.groupSubject || "",
        ruleScope: row.ruleScope || "",
        workerId: row.workerId || "",
        workerName: row.workerName || "",
        fromPhone: row.fromPhone || "",
        contactName: row.contactName || "",
        shiftKind,
        startingTime: manualShiftKindAllowsStart(shiftKind) ? ((row.startingTimes || [])[0] || "") : "",
        shiftStartHours: manualShiftKindAllowsStart(shiftKind) && Array.isArray(row.shiftStartHours) ? row.shiftStartHours : [],
        shiftEndHours: manualShiftKindAllowsEnd(shiftKind) && Array.isArray(row.shiftEndHours) ? row.shiftEndHours : [],
        patternText,
        createdAt: row.updatedAt || "",
        source: "bridge",
        entries: row.entries || 0,
        policy,
        suppressHourly: Boolean(row.suppressHourly || policy?.suppressHourly)
      });
    }
    for (const row of mobileState.manualPlaceInfo || []) {
      const key = manualPlaceClientKey(row);
      if (row.deletedAt || row.action === "manual_info_delete") {
        map.delete(key);
        continue;
      }
      const patternText = cleanManualPatternText(row.patternText || "");
      if (isGeneratedEvidenceOnlyPattern(row.patternText || "")) continue;
      map.set(key, { ...row, patternText, id: key, key, source: row.source || "local" });
    }
    return [...map.values()]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, Math.max(1, Math.min(500, Number(limit || 12))));
  }

  function scheduleHours(values = []) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 0 && value <= 23))]
      .sort((a, b) => a - b);
  }

  function scheduleTimeFromHour(hour) {
    const value = Number(hour);
    return Number.isInteger(value) && value >= 0 && value <= 23 ? `${String(value).padStart(2, "0")}:00` : "";
  }

  function scheduleTimeFromKey(key = "") {
    const match = String(key || "").match(/T(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "";
  }

  function normalizeScheduleTime(value = "", fallbackKey = "") {
    const text = String(value || "").trim();
    const timeMatch = text.match(/^([01]?\d|2[0-3])(?::|h)?([0-5]\d)?$/i);
    if (timeMatch) return `${String(Number(timeMatch[1])).padStart(2, "0")}:${String(Number(timeMatch[2] || 0)).padStart(2, "0")}`;
    return scheduleTimeFromKey(fallbackKey);
  }

  function scheduleTimeLabel(value = "") {
    const time = normalizeScheduleTime(value);
    return time ? time.replace(":00", "h") : "sem horario";
  }

  function scheduleMinutes(value = "") {
    const time = normalizeScheduleTime(value);
    const match = time.match(/^(\d{2}):(\d{2})$/);
    return match ? (Number(match[1]) * 60) + Number(match[2]) : 99999;
  }

  function schedulePersonText(value = "") {
    const text = String(value || "").trim();
    if (!text || normalizeLookup(text) === "sem inicio esperado") return "a declarar";
    return text;
  }

  function shiftSchedulePlaceKey(item = {}) {
    return item.placeId || item.groupId || normalizeLookup(item.placeName || item.groupSubject || "sem-posto");
  }

  function shiftSchedulePersonKey(item = {}) {
    const phoneDigits = String(item.fromPhone || item.personEvidence?.fromPhone || "").replace(/\D/g, "");
    const phoneTail = phoneDigits || String(item.personEvidence?.fromPhoneTail || "").replace(/\D/g, "");
    const names = [
      item.workerName,
      item.startPerson,
      item.leavePerson
    ].filter(schedulePersonKnown).map(normalizeLookup);
    return safeDocId([phoneTail ? `tel:${phoneTail}` : "", ...names].filter(Boolean).join("|"));
  }

  function shiftScheduleMergeKey(item = {}) {
    const personKey = shiftSchedulePersonKey(item) || "sem-pessoa";
    return safeDocId([
      item.shiftKind || "shift_start",
      shiftSchedulePlaceKey(item),
      normalizeScheduleTime(item.expectedTime || "", item.hourKey || ""),
      personKey
    ].join(":"));
  }

  function schedulePersonKnown(value = "") {
    const normalized = normalizeLookup(value);
    return Boolean(normalized && normalized !== "a declarar" && normalized !== "sem inicio esperado");
  }

  function schedulePersonFromRow(row = {}) {
    return row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone || "";
  }

  function scheduleOutgoingPersonFromRow(row = {}) {
    return row.outgoingWorkerName || row.outgoingContactName || formatBrazilPhone(row.outgoingFromPhone) || row.outgoingFromPhone || "";
  }

  function scheduleEvidenceHour(row = {}) {
    const time = normalizeScheduleTime(row.startTime || "", row.startHourKey || row.hourKey || "");
    const match = time.match(/^(\d{2}):/);
    return match ? Number(match[1]) : null;
  }

  function shiftScheduleEvidencePlaceKeys(item = {}) {
    return [
      item.placeId || "",
      item.groupId || "",
      normalizeLookup(item.placeName || ""),
      normalizeLookup(item.groupSubject || "")
    ].filter(Boolean);
  }

  function shiftScheduleEvidenceKinds(row = {}) {
    const kinds = new Set();
    const status = String(row.status || "");
    const requirement = String(row.requirementType || "");
    const text = shiftSemanticText(row);
    if (requirement === "shift_start" || status.startsWith("shift_start") || row.shiftStartExpectedAtHour === true || /inicio|entrada|assum/.test(text)) {
      kinds.add("shift_start");
    }
    if (isShiftEndRow(row)) kinds.add("shift_end");
    if (/passagem|troca|rendicao|rendi/.test(text)) kinds.add("shift_handoff");
    return kinds;
  }

  function scheduleEvidenceScore(row = {}, explicit = false) {
    return (explicit ? 1000 : 100) +
      (isConfirmedStatus(row.status) ? 120 : 0) +
      (row.workerName ? 60 : row.contactName ? 35 : row.fromPhone ? 20 : 0) +
      Math.floor(shiftRowTime(row) / 600000);
  }

  function addShiftScheduleEvidence(map, row = {}, shiftKind = "", options = {}) {
    const person = schedulePersonFromRow(row);
    const outgoing = scheduleOutgoingPersonFromRow(row);
    if (!schedulePersonKnown(person) && !schedulePersonKnown(outgoing)) return;
    const hour = scheduleEvidenceHour(row);
    if (hour === null) return;
    const placeKeys = shiftScheduleEvidencePlaceKeys(row);
    if (!placeKeys.length) return;
    const exact = options.exact !== false;
    const startPerson = shiftKind === "shift_end" ? "" : person;
    const leavePerson = shiftKind === "shift_start" || shiftKind === "shift_handoff" ? outgoing : person;
    const evidence = {
      shiftKind,
      hour,
      leavePerson,
      startPerson,
      workerName: person,
      fromPhone: row.fromPhone || "",
      lastReportAt: row.lastReportAt || row.firstReportAt || "",
      groupSubject: row.groupSubject || "",
      exact: true,
      score: scheduleEvidenceScore(row, exact),
      tag: "pessoa aprendida",
      detail: `Pessoa aprendida por informe do mesmo horario${row.lastReportAt ? ` (${formatDateTime(row.lastReportAt)})` : ""}.`
    };
    evidence.personKey = shiftSchedulePersonKey(evidence);
    if (!evidence.personKey) return;
    for (const placeKey of placeKeys) {
      const exactKey = [shiftKind, placeKey, scheduleTimeFromHour(hour)].join("|");
      const bucket = map.exact.get(exactKey) || new Map();
      const existingExact = bucket.get(evidence.personKey);
      if (!existingExact || evidence.score > existingExact.score) bucket.set(evidence.personKey, evidence);
      map.exact.set(exactKey, bucket);
    }
  }

  function buildShiftScheduleEvidenceIndex() {
    const index = { exact: new Map() };
    const slots = Array.isArray(state.status?.slots) ? state.status.slots : [];
    for (const slot of slots) {
      for (const row of slot.rows || []) {
        const next = { ...row, hourKey: row.hourKey || slot.hourKey || "" };
        const explicitKinds = shiftScheduleEvidenceKinds(next);
        for (const kind of explicitKinds) addShiftScheduleEvidence(index, next, kind, { exact: true });
      }
    }
    for (const row of state.confirmedHistory || []) {
      const explicitKinds = shiftScheduleEvidenceKinds(row);
      for (const kind of explicitKinds) addShiftScheduleEvidence(index, row, kind, { exact: true });
    }
    return index;
  }

  function shiftScheduleEvidenceListFor(index, item = {}) {
    const time = normalizeScheduleTime(item.expectedTime || "", item.hourKey || "");
    const keys = shiftScheduleEvidencePlaceKeys(item);
    const evidences = new Map();
    for (const placeKey of keys) {
      const bucket = index.exact.get([item.shiftKind || "shift_start", placeKey, time].join("|"));
      if (!bucket) continue;
      for (const evidence of bucket.values()) {
        const personKey = evidence.personKey || shiftSchedulePersonKey(evidence);
        if (!personKey) continue;
        const existing = evidences.get(personKey);
        if (!existing || evidence.score > existing.score) evidences.set(personKey, evidence);
      }
    }
    return [...evidences.values()].sort((a, b) => (b.score || 0) - (a.score || 0) ||
      String(a.workerName || a.startPerson || a.leavePerson || "").localeCompare(String(b.workerName || b.startPerson || b.leavePerson || ""), "pt-BR"));
  }

  function applyShiftScheduleEvidence(item = {}, evidence = null) {
    if (!evidence) return item;
    const next = { ...item };
    if (!schedulePersonKnown(next.leavePerson) && schedulePersonKnown(evidence.leavePerson)) next.leavePerson = evidence.leavePerson;
    if (!schedulePersonKnown(next.startPerson) && schedulePersonKnown(evidence.startPerson)) next.startPerson = evidence.startPerson;
    if (!schedulePersonKnown(next.workerName) && schedulePersonKnown(evidence.workerName)) next.workerName = evidence.workerName;
    if (!next.fromPhone && evidence.fromPhone) next.fromPhone = evidence.fromPhone;
    next.sourceTags = [...new Set([...(next.sourceTags || []), evidence.tag].filter(Boolean))];
    next.ruleText = [next.ruleText, evidence.detail].filter(Boolean).join(" / ");
    next.personEvidence = evidence;
    return next;
  }

  function mergeShiftScheduleItem(existing = null, item = {}) {
    if (!existing) return {
      ...item,
      sourceTags: [...new Set(item.sourceTags || [item.sourceLabel || "fonte"])],
      priority: Number(item.priority || 0)
    };
    const sourceTags = [...new Set([...(existing.sourceTags || []), ...(item.sourceTags || [item.sourceLabel || "fonte"])].filter(Boolean))];
    const pick = (current, next) => {
      if (!current || !schedulePersonKnown(current)) return next || current || "";
      return current;
    };
    const nextPriority = Math.max(Number(existing.priority || 0), Number(item.priority || 0));
    return {
      ...existing,
      placeId: existing.placeId || item.placeId || "",
      placeName: existing.placeName || item.placeName || "",
      groupId: existing.groupId || item.groupId || "",
      groupSubject: existing.groupSubject || item.groupSubject || "",
      expectedTime: existing.expectedTime || item.expectedTime || "",
      shiftKind: existing.shiftKind || item.shiftKind || "shift_start",
      leavePerson: pick(existing.leavePerson, item.leavePerson),
      startPerson: pick(existing.startPerson, item.startPerson),
      workerName: existing.workerName || item.workerName || "",
      fromPhone: existing.fromPhone || item.fromPhone || "",
      statusLabel: Number(item.priority || 0) >= Number(existing.priority || 0) ? (item.statusLabel || existing.statusLabel || "") : (existing.statusLabel || item.statusLabel || ""),
      statusTone: Number(item.priority || 0) >= Number(existing.priority || 0) ? (item.statusTone || existing.statusTone || "") : (existing.statusTone || item.statusTone || ""),
      timingText: item.timingText || existing.timingText || "",
      ruleText: item.ruleText || existing.ruleText || "",
      expectedPeopleCount: Math.max(Number(existing.expectedPeopleCount || 0), Number(item.expectedPeopleCount || 0)),
      expectedPeopleSource: item.expectedPeopleSource || existing.expectedPeopleSource || "",
      manualId: item.manualId || existing.manualId || "",
      rowKey: item.rowKey || existing.rowKey || "",
      personEvidence: item.personEvidence || existing.personEvidence || null,
      sourceTags,
      priority: nextPriority,
      key: existing.key || item.key
    };
  }

  function addShiftScheduleItem(map, item = {}) {
    const expectedTime = normalizeScheduleTime(item.expectedTime || "", item.hourKey || "");
    const next = {
      ...item,
      expectedTime,
      shiftKind: item.shiftKind || "shift_start",
      placeName: item.placeName || item.groupSubject || "Posto",
      leavePerson: schedulePersonText(item.leavePerson),
      startPerson: schedulePersonText(item.startPerson)
    };
    const key = item.mergeKey || shiftScheduleMergeKey(next);
    next.key = key;
    map.set(key, mergeShiftScheduleItem(map.get(key), next));
  }

  function addShiftScheduleItemWithEvidence(map, item = {}, evidenceIndex = null) {
    if (schedulePersonKnown(item.leavePerson) || schedulePersonKnown(item.startPerson) || schedulePersonKnown(item.workerName)) {
      addShiftScheduleItem(map, item);
      return;
    }
    const evidences = evidenceIndex ? shiftScheduleEvidenceListFor(evidenceIndex, item) : [];
    if (!evidences.length) {
      addShiftScheduleItem(map, item);
      return;
    }
    for (const evidence of evidences) {
      addShiftScheduleItem(map, applyShiftScheduleEvidence(item, evidence));
    }
  }

  function manualRuleTimes(row = {}) {
    const policy = row.policy || {};
    const kind = row.shiftKind || "shift_start";
    const times = [];
    if (row.startingTime) times.push(row.startingTime);
    const hours = kind === "shift_end"
      ? scheduleHours([...(row.shiftEndHours || []), ...(policy.shiftEndHours || [])])
      : scheduleHours([...(row.shiftStartHours || []), ...(policy.shiftStartHours || [])]);
    for (const hour of hours) times.push(scheduleTimeFromHour(hour));
    return [...new Set(times.map(value => normalizeScheduleTime(value)).filter(Boolean))];
  }

  function shiftScheduleAuthorityKey(item = {}) {
    return shiftScheduleAuthorityKeys(item)[0] || "";
  }

  function shiftScheduleAuthorityKeys(item = {}) {
    return [
      String(item.placeId || ""),
      String(item.groupId || ""),
      normalizeLookup(item.placeName || ""),
      normalizeLookup(item.groupSubject || "")
    ].filter(Boolean);
  }

  function shiftScheduleEntryFor(map = new Map(), item = {}) {
    for (const key of shiftScheduleAuthorityKeys(item)) {
      if (map.has(key)) return map.get(key);
    }
    return null;
  }

  function setShiftScheduleEntry(map = new Map(), item = {}, entry = {}) {
    for (const key of shiftScheduleAuthorityKeys(item)) map.set(key, entry);
  }

  function shiftScheduleRuleText(row = {}) {
    return normalizeLookup([
      row.key,
      row.patternText,
      row.policy?.summary,
      row.source
    ].filter(Boolean).join(" "));
  }

  function isControlScheduleRule(row = {}) {
    const text = shiftScheduleRuleText(row);
    return text.includes("controle de horarios e jornadas") ||
      (text.includes("plan1") && text.includes("jornada") && text.includes("horario na planilha"));
  }

  function isImportedGeneralScheduleRule(row = {}) {
    const text = shiftScheduleRuleText(row);
    return text.includes("escala geral tka") || text.includes("pagina1") || text.includes("jun row") || text.includes("xlsx jun linha");
  }

  function parseExpectedPeopleCount(row = {}) {
    const text = String(row.patternText || row.policy?.summary || "");
    const match = text.match(/Quantidade esperada no posto:\s*(\d+)\s*pessoa/i);
    return match ? Number(match[1]) : 0;
  }

  function buildShiftScheduleAuthority(rows = []) {
    const map = new Map();
    for (const row of rows) {
      const declaredRule = isControlScheduleRule(row) ||
        (!isImportedGeneralScheduleRule(row) && isScheduleShiftKind(row.shiftKind) && manualRuleTimes(row).length);
      if (!declaredRule) continue;
      const key = shiftScheduleAuthorityKey(row);
      if (!key) continue;
      const entry = shiftScheduleEntryFor(map, row) || { startTimes: new Set(), endTimes: new Set(), declaredCount: 0, source: isControlScheduleRule(row) ? "controle de horarios" : "regra declarada" };
      const times = manualRuleTimes(row);
      const target = row.shiftKind === "shift_end" ? entry.endTimes : entry.startTimes;
      for (const time of times) target.add(time);
      entry.declaredCount = Math.max(entry.declaredCount, parseExpectedPeopleCount(row));
      setShiftScheduleEntry(map, row, entry);
    }
    return map;
  }

  function learnedShiftScheduleSources() {
    const groups = (state.groups?.groups || [])
      .filter(group => group.requiresShiftStart || group.shiftStartHours?.length || group.shiftEndHours?.length || group.shiftHandoffHours?.length);
    return groups.length ? groups : (state.status?.groupLearning?.shiftStartPlaces || []);
  }

  function buildShiftScheduleStaffing(rows = [], authority = new Map()) {
    const map = new Map();
    const addPerson = (key, value = "") => {
      const personKey = normalizeLookup(value);
      if (!key || !personKey || personKey === "a declarar") return;
      const entry = map.get(key) || { people: new Set(), declaredCount: 0, source: "" };
      entry.people.add(personKey);
      map.set(key, entry);
    };
    for (const row of rows) {
      const key = shiftScheduleAuthorityKey(row);
      if (!key) continue;
      const entry = shiftScheduleEntryFor(map, row) || { people: new Set(), declaredCount: 0, source: "" };
      const declared = parseExpectedPeopleCount(row);
      if (declared > entry.declaredCount) {
        entry.declaredCount = declared;
        entry.source = "WhatsApp/RH";
      }
      setShiftScheduleEntry(map, row, entry);
      for (const itemKey of shiftScheduleAuthorityKeys(row)) addPerson(itemKey, row.workerName || row.contactName || row.fromPhone || "");
    }
    for (const [key, rule] of authority.entries()) {
      const entry = map.get(key) || { people: new Set(), declaredCount: 0, source: "" };
      if (rule.declaredCount > entry.declaredCount) {
        entry.declaredCount = rule.declaredCount;
        entry.source = "WhatsApp/RH";
      }
      map.set(key, entry);
    }
    return map;
  }

  function shiftScheduleExpectedPeople(item = {}, staffing = new Map()) {
    const entry = shiftScheduleEntryFor(staffing, item);
    if (!entry) return { count: 0, source: "" };
    const count = Math.max(Number(entry.declaredCount || 0), entry.people?.size || 0);
    return { count, source: entry.source || (entry.people?.size ? "planilha/WhatsApp" : "") };
  }

  function shiftScheduleManualRuleSuperseded(row = {}, authority = new Map()) {
    if (isControlScheduleRule(row)) return false;
    if (!isImportedGeneralScheduleRule(row)) return false;
    const entry = shiftScheduleEntryFor(authority, row);
    if (!entry) return false;
    const times = manualRuleTimes(row);
    if (!times.length) return false;
    const allowed = row.shiftKind === "shift_end" ? entry.endTimes : entry.startTimes;
    if (!allowed || !allowed.size) return false;
    return !times.some(time => allowed.has(time));
  }

  function authorizedLearnedScheduleHours(place = {}, kind = "shift_start", rawHours = [], authority = new Map()) {
    const times = scheduleHours(rawHours || []);
    const entry = shiftScheduleEntryFor(authority, place);
    if (!entry) return times;
    return [];
  }

  function circularScheduleDistanceMinutes(a = "", b = "") {
    const first = scheduleMinutes(a);
    const second = scheduleMinutes(b);
    if (first >= 99999 || second >= 99999) return 99999;
    const diff = Math.abs(first - second);
    return Math.min(diff, 1440 - diff);
  }

  function authorizedExpectedTime(item = {}, authority = new Map()) {
    const current = normalizeScheduleTime(item.expectedTime || "", item.hourKey || "");
    const entry = shiftScheduleEntryFor(authority, item);
    if (!entry || !current) return current;
    const allowed = item.shiftKind === "shift_end"
      ? entry.endTimes
      : item.shiftKind === "shift_handoff"
        ? new Set([...entry.startTimes, ...entry.endTimes])
        : entry.startTimes;
    if (!allowed || !allowed.size || allowed.has(current)) return current;
    const closest = [...allowed]
      .map(time => ({ time, distance: circularScheduleDistanceMinutes(current, time) }))
      .sort((a, b) => a.distance - b.distance)[0];
    return closest && closest.distance <= SHIFT_TIME_WINDOW_MINUTES ? closest.time : current;
  }

  function shiftScheduleRows() {
    const map = new Map();
    const evidenceIndex = buildShiftScheduleEvidenceIndex();
    const manualRows = manualPlaceInfoRows(SHIFT_SCHEDULE_RULE_LIMIT);
    const scheduleAuthority = buildShiftScheduleAuthority(manualRows);
    const staffing = buildShiftScheduleStaffing(manualRows, scheduleAuthority);
    const addLiveScheduleRow = (row, sourceTag = "ao vivo") => {
      const people = shiftPeople(row);
      const timing = shiftTimingInfo(row);
      const feedback = shiftFeedbackForRow(row);
      const kinds = shiftScheduleEvidenceKinds(row);
      const shiftKind = kinds.has("shift_handoff") ? "shift_handoff" : (isShiftEndRow(row) ? "shift_end" : "shift_start");
      const rawExpectedTime = row.startTime || scheduleTimeFromKey(row.startHourKey || row.hourKey);
      const expectedPeople = shiftScheduleExpectedPeople(row, staffing);
      addShiftScheduleItem(map, {
        mergeKey: `row:${row.key || rowKey(row)}`,
        rowKey: row.key || rowKey(row),
        placeId: row.placeId || "",
        placeName: row.placeName || row.groupSubject || "Posto",
        groupId: row.groupId || "",
        groupSubject: row.groupSubject || "",
        shiftKind,
        expectedTime: authorizedExpectedTime({ ...row, shiftKind, expectedTime: rawExpectedTime }, scheduleAuthority),
        hourKey: row.startHourKey || row.hourKey || "",
        leavePerson: people.left?.name || "",
        startPerson: people.started?.name || "",
        workerName: row.workerName || row.contactName || "",
        fromPhone: row.fromPhone || "",
        statusLabel: feedback ? `resolvido: ${SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || feedback.action}` : shiftDisplayStatus(row),
        statusTone: feedback ? (SHIFT_FEEDBACK_ACTIONS[feedback.action]?.tone || "ok") : statusTone(row.status),
        timingText: timing.detail || timing.label || "",
        expectedPeopleCount: expectedPeople.count,
        expectedPeopleSource: expectedPeople.source,
        sourceTags: [sourceTag],
        priority: 4
      });
    };
    for (const row of shiftRowsFromSlots()) {
      addLiveScheduleRow(row, "ao vivo");
    }
    for (const row of confirmedRecentRows(confirmedFetchLimit * 2)) {
      if (shiftScheduleEvidenceKinds(row).size) addLiveScheduleRow(row, "confirmado");
    }
    for (const row of manualRows) {
      const kind = row.shiftKind || "shift_start";
      if (!isScheduleShiftKind(kind)) continue;
      if (shiftScheduleManualRuleSuperseded(row, scheduleAuthority)) continue;
      const times = manualRuleTimes(row);
      const worker = row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone || "";
      const fallbackTimes = times.length ? times : [""];
      const expectedPeople = shiftScheduleExpectedPeople(row, staffing);
      for (const time of fallbackTimes) {
        const item = {
          manualId: row.id || manualPlaceClientKey(row),
          placeId: row.placeId || "",
          placeName: row.placeName || row.groupSubject || "Posto",
          groupId: row.groupId || "",
          groupSubject: row.groupSubject || "",
          shiftKind: kind,
          expectedTime: time,
          leavePerson: kind === "shift_end" ? worker : "",
          startPerson: kind === "shift_end" ? "" : worker,
          workerName: worker,
          fromPhone: row.fromPhone || "",
          statusLabel: "regra ativa",
          statusTone: row.source === "bridge" ? "ok" : "warn",
          timingText: row.policy?.summary || "",
          ruleText: row.patternText || "",
          expectedPeopleCount: expectedPeople.count,
          expectedPeopleSource: expectedPeople.source,
          sourceTags: [row.source === "bridge" ? "regra bridge" : "regra local"],
          priority: 3
        };
        addShiftScheduleItemWithEvidence(map, item, evidenceIndex);
      }
    }
    for (const source of learnedShiftScheduleSources()) {
      const expectedPeople = shiftScheduleExpectedPeople(source, staffing);
      for (const hour of authorizedLearnedScheduleHours(source, "shift_start", source.shiftStartHours || [], scheduleAuthority)) {
        const item = {
          placeId: source.placeId || "",
          placeName: source.placeName || source.groupSubject || "Posto",
          groupId: source.groupId || "",
          groupSubject: source.groupSubject || "",
          shiftKind: "shift_start",
          expectedTime: scheduleTimeFromHour(hour),
          statusLabel: "inicio esperado",
          statusTone: "info",
          timingText: source.shiftStartWindowSummary || "",
          expectedPeopleCount: expectedPeople.count,
          expectedPeopleSource: expectedPeople.source,
          sourceTags: ["aprendido"],
          priority: 1
        };
        addShiftScheduleItemWithEvidence(map, item, evidenceIndex);
      }
      for (const hour of authorizedLearnedScheduleHours(source, "shift_end", source.shiftEndHours || [], scheduleAuthority)) {
        const item = {
          placeId: source.placeId || "",
          placeName: source.placeName || source.groupSubject || "Posto",
          groupId: source.groupId || "",
          groupSubject: source.groupSubject || "",
          shiftKind: "shift_end",
          expectedTime: scheduleTimeFromHour(hour),
          statusLabel: "saida esperada",
          statusTone: "info",
          timingText: source.shiftEndWindowSummary || "",
          expectedPeopleCount: expectedPeople.count,
          expectedPeopleSource: expectedPeople.source,
          sourceTags: ["aprendido"],
          priority: 1
        };
        addShiftScheduleItemWithEvidence(map, item, evidenceIndex);
      }
      for (const hour of authorizedLearnedScheduleHours(source, "shift_handoff", source.shiftHandoffHours || [], scheduleAuthority)) {
        const item = {
          placeId: source.placeId || "",
          placeName: source.placeName || source.groupSubject || "Posto",
          groupId: source.groupId || "",
          groupSubject: source.groupSubject || "",
          shiftKind: "shift_handoff",
          expectedTime: scheduleTimeFromHour(hour),
          statusLabel: "passagem esperada",
          statusTone: "info",
          timingText: source.shiftHandoffWindowSummary || "",
          expectedPeopleCount: expectedPeople.count,
          expectedPeopleSource: expectedPeople.source,
          sourceTags: ["aprendido"],
          priority: 1
        };
        addShiftScheduleItemWithEvidence(map, item, evidenceIndex);
      }
    }
    return [...map.values()]
      .sort((a, b) => scheduleMinutes(a.expectedTime) - scheduleMinutes(b.expectedTime) ||
        String(a.placeName || "").localeCompare(String(b.placeName || ""), "pt-BR") ||
        String(a.startPerson || a.leavePerson || "").localeCompare(String(b.startPerson || b.leavePerson || ""), "pt-BR"))
      .slice(0, SHIFT_SCHEDULE_RULE_LIMIT);
  }

  function shiftScheduleItemHtml(item = {}) {
    const sourceTags = (item.sourceTags || []).slice(0, 3);
    const tone = item.statusTone === "done" ? "ok" : item.statusTone === "delay" ? "warn" : item.statusTone === "ignore" ? "bad" : item.statusTone || "info";
    return `
      <article class="shift-schedule-item">
        <div class="shift-schedule-head">
          <div>
            <strong>${escapeHtml(item.placeName || item.groupSubject || "Posto")}</strong>
            <span>${escapeHtml([manualShiftKindLabel(item.shiftKind) || "turno", item.groupSubject].filter(Boolean).join(" / "))}</span>
          </div>
          <em>${escapeHtml(scheduleTimeLabel(item.expectedTime))}</em>
        </div>
        <div class="shift-schedule-people">
          <span><b>Sai</b>${escapeHtml(item.leavePerson || "a declarar")}</span>
          <span><b>Entra</b>${escapeHtml(item.startPerson || "a declarar")}</span>
        </div>
        ${item.expectedPeopleCount ? `<div class="tag-row"><span class="tag info">${escapeHtml(`Equipe esperada: ${item.expectedPeopleCount} pessoa(s)${item.expectedPeopleSource ? ` / ${item.expectedPeopleSource}` : ""}`)}</span></div>` : ""}
        <div class="tag-row">
          <span class="tag ${escapeHtml(tone)}">${escapeHtml(item.statusLabel || "escala")}</span>
          ${sourceTags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${item.timingText ? `<p>${escapeHtml(item.timingText)}</p>` : ""}
        ${item.ruleText ? `<small>${escapeHtml(item.ruleText)}</small>` : ""}
        <button type="button" class="response-button" data-shift-schedule-edit="${escapeHtml(item.key)}">Edit</button>
      </article>
    `;
  }

  function renderShiftSchedule() {
    if (!el.shiftScheduleBox || !el.shiftScheduleList) return;
    el.shiftScheduleBox.hidden = !state.shiftScheduleOpen;
    const rows = shiftScheduleRows();
    if (el.shiftScheduleStatus) {
      const manualCount = manualPlaceInfoRows(SHIFT_SCHEDULE_RULE_LIMIT).length;
      const personCount = rows.filter(row => schedulePersonKnown(row.leavePerson) || schedulePersonKnown(row.startPerson)).length;
      el.shiftScheduleStatus.textContent = `${rows.length} escala(s) / ${personCount} com pessoa / ${manualCount} regra(s) / edit salva no agente`;
    }
    el.shiftScheduleList.innerHTML = rows.length
      ? rows.map(shiftScheduleItemHtml).join("")
      : `<div class="empty">Nenhuma escala aprendida ou declarada carregada agora.</div>`;
  }

  function startShiftScheduleEdit(key) {
    const item = shiftScheduleRows().find(row => String(row.key || "") === String(key || ""));
    if (!item) return;
    state.shiftScheduleOpen = false;
    if (item.manualId) {
      startManualPlaceEdit(item.manualId);
      renderShiftSchedule();
      return;
    }
    clearManualPlaceForm();
    state.manualPlaceInfoEditingKey = "";
    state.manualPlaceInfoOpen = true;
    state.manualPlaceInfoStatus = `Editando escala de ${item.placeName || item.groupSubject || "posto"}.`;
    const knownPerson = normalizeLookup(item.shiftKind) === "shift_end" ? item.leavePerson : item.startPerson;
    if (el.manualPlaceName) el.manualPlaceName.value = item.placeName || item.groupSubject || "";
    if (el.manualWorkerName) el.manualWorkerName.value = normalizeLookup(knownPerson) === "a declarar" ? "" : knownPerson || "";
    if (el.manualRuleScope) el.manualRuleScope.value = knownPerson && normalizeLookup(knownPerson) !== "a declarar" ? "place_worker_shift" : "place";
    if (el.manualShiftKind) el.manualShiftKind.value = item.shiftKind || "shift_start";
    if (el.manualPlaceStartTime) el.manualPlaceStartTime.value = normalizeScheduleTime(item.expectedTime) || "";
    if (el.manualPlacePatternText) {
      const time = scheduleTimeLabel(item.expectedTime);
      const ruleText = cleanManualPatternText(item.ruleText || "");
      el.manualPlacePatternText.value = ruleText || `Escala declarada: ${item.placeName || item.groupSubject || "posto"} / ${manualShiftKindLabel(item.shiftKind) || "turno"} ${time}. Sai: ${item.leavePerson || "a declarar"}. Entra: ${item.startPerson || "a declarar"}.`;
    }
    renderManualPlaceInfo();
    renderShiftSchedule();
    showToast("Edite a escala e salve para o agente/GPT.");
  }

  function compactPatternText(value = "", maxLength = 260) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
  }

  function patternManagerTimeLabel(times = []) {
    const labels = [...new Set((Array.isArray(times) ? times : [])
      .map(value => scheduleTimeLabel(value))
      .filter(label => label && label !== "sem horario"))];
    return labels.length ? labels.join(", ") : "sem horario";
  }

  function patternManagerHourLabel(hours = []) {
    const labels = scheduleHours(hours).map(hour => `${String(hour).padStart(2, "0")}h`);
    return labels.join(", ");
  }

  function patternManagerSourceBucket(source = "") {
    const text = normalizeLookup(source);
    if (text.includes("local")) return "local";
    if (text.includes("aprendido") || text.includes("learned")) return "learned";
    if (text.includes("ao vivo") || text.includes("confirmado") || text.includes("live")) return "live";
    return "bridge";
  }

  function patternManagerGroupKey(group = {}) {
    return String(group.groupId || group.placeId || normalizeLookup(group.groupSubject || group.placeName || "grupo")).slice(0, 180);
  }

  function patternManagerGroupTimes(group = {}) {
    const times = [];
    for (const hour of scheduleHours(group.shiftStartHours || [])) times.push(scheduleTimeFromHour(hour));
    for (const hour of scheduleHours(group.shiftEndHours || [])) times.push(scheduleTimeFromHour(hour));
    for (const hour of scheduleHours(group.shiftHandoffHours || [])) times.push(scheduleTimeFromHour(hour));
    return [...new Set(times.filter(Boolean))];
  }

  function patternManagerGroupKind(group = {}) {
    if (group.requiresShiftHandoff || group.shiftHandoffHours?.length) return "passagem";
    if (group.requiresShiftStart || group.shiftStartHours?.length) return "inicio";
    if (group.shiftEndHours?.length) return "saida";
    return group.modeLabel || group.mode || "mensagem";
  }

  function patternManagerRows() {
    const rows = [];
    for (const rule of manualPlaceInfoRows(SHIFT_SCHEDULE_RULE_LIMIT)) {
      const times = manualRuleTimes(rule);
      const worker = rule.workerName || rule.contactName || formatBrazilPhone(rule.fromPhone) || rule.fromPhone || "";
      const placeName = rule.placeName || rule.groupSubject || worker || "Posto";
      const sourceBucket = rule.source === "bridge" ? "bridge" : "local";
      rows.push({
        id: `declared:${rule.id || manualPlaceClientKey(rule)}`,
        type: "declared",
        typeLabel: "regra declarada",
        editKey: rule.id || manualPlaceClientKey(rule),
        placeName,
        groupSubject: rule.groupSubject || "",
        worker,
        kind: [manualRuleScopeLabel(manualRuleScope(rule)), manualShiftKindLabel(rule.shiftKind)].filter(Boolean).join(" / ") || "regra",
        times,
        timeLabel: patternManagerTimeLabel(times),
        source: sourceBucket,
        sourceLabel: sourceBucket === "bridge" ? "bridge/regra ativa" : "local pendente",
        requiresHourly: !rule.suppressHourly,
        statusLabel: rule.suppressHourly ? "sem cobranca horaria" : "regra ativa",
        patternText: rule.patternText || rule.policy?.summary || "Regra sem texto complementar.",
        updatedAt: rule.createdAt || "",
        tags: [
          rule.entries ? `${rule.entries} entrada(s)` : "",
          rule.policy?.summary || "",
          worker ? `QRA: ${worker}` : ""
        ].filter(Boolean)
      });
    }
    for (const item of shiftScheduleRows()) {
      const sourceText = (item.sourceTags || []).join(" / ") || "escala";
      const sourceBucket = patternManagerSourceBucket(sourceText);
      const worker = item.shiftKind === "shift_end" ? item.leavePerson : item.startPerson;
      const text = firstNonEmptyText(item.ruleText, item.timingText, item.statusLabel);
      rows.push({
        id: `shift:${item.key || shiftScheduleMergeKey(item)}`,
        type: "shift",
        typeLabel: "escala/turno",
        editKey: item.key || "",
        placeName: item.placeName || item.groupSubject || "Posto",
        groupSubject: item.groupSubject || "",
        worker: schedulePersonKnown(worker) ? worker : "",
        kind: manualShiftKindLabel(item.shiftKind) || "turno",
        times: item.expectedTime ? [item.expectedTime] : [],
        timeLabel: scheduleTimeLabel(item.expectedTime),
        source: sourceBucket,
        sourceLabel: sourceText,
        requiresHourly: null,
        statusLabel: item.statusLabel || "escala",
        patternText: text || "Escala consolidada sem texto complementar.",
        updatedAt: item.lastReportAt || "",
        tags: [
          item.expectedPeopleCount ? `Equipe esperada: ${item.expectedPeopleCount}` : "",
          item.expectedPeopleSource || "",
          item.leavePerson && schedulePersonKnown(item.leavePerson) ? `Sai: ${item.leavePerson}` : "",
          item.startPerson && schedulePersonKnown(item.startPerson) ? `Entra: ${item.startPerson}` : ""
        ].filter(Boolean)
      });
    }
    for (const group of state.groups?.groups || []) {
      const times = patternManagerGroupTimes(group);
      const sourceBucket = group.manualPlacePattern ? "bridge" : "learned";
      rows.push({
        id: `message:${patternManagerGroupKey(group)}`,
        type: "message",
        typeLabel: "padrao de mensagem",
        editKey: patternManagerGroupKey(group),
        placeName: group.placeName || group.groupSubject || "Posto",
        groupSubject: group.groupSubject || "",
        worker: "",
        kind: patternManagerGroupKind(group),
        times,
        timeLabel: times.length ? patternManagerTimeLabel(times) : (patternManagerHourLabel((group.hours || []).map(item => item.hour)) || "sem horario"),
        source: sourceBucket,
        sourceLabel: group.manualPlacePattern ? "manual/bridge" : "aprendido",
        requiresHourly: Boolean(group.requiresHourly),
        statusLabel: group.requiresHourly ? "cobra horario" : "sem cobranca horaria",
        patternText: patternText(group),
        updatedAt: group.updatedAt || group.autoLearning?.updatedAt || "",
        tags: [
          group.modeLabel || group.mode || "",
          group.autoLearning?.maturity || "",
          group.manualPlacePattern ? "manual vinculado" : ""
        ].filter(Boolean)
      });
    }
    return rows;
  }

  function patternManagerVisibleRows(rows = patternManagerRows()) {
    const search = normalizeLookup(state.patternManagerSearch || "");
    const kind = state.patternManagerKind || "all";
    const source = state.patternManagerSource || "all";
    const place = state.patternManagerPlace || "all";
    return rows.filter(row => {
      if (kind !== "all") {
        if (kind === "hourly" && row.requiresHourly !== true) return false;
        if (kind === "no_hourly" && row.requiresHourly !== false) return false;
        if (kind !== "hourly" && kind !== "no_hourly" && row.type !== kind) return false;
      }
      if (source !== "all" && row.source !== source) return false;
      if (place !== "all" && normalizeLookup(row.placeName || row.groupSubject || "") !== place) return false;
      if (!search) return true;
      const haystack = normalizeLookup([
        row.placeName,
        row.groupSubject,
        row.worker,
        row.kind,
        row.timeLabel,
        row.sourceLabel,
        row.statusLabel,
        row.patternText,
        ...(row.tags || [])
      ].filter(Boolean).join(" "));
      return haystack.includes(search);
    });
  }

  function renderPatternManagerPlaceOptions(rows = []) {
    if (!el.patternManagerPlace) return;
    const options = [...new Map(rows
      .map(row => row.placeName || row.groupSubject || "")
      .filter(Boolean)
      .map(label => [normalizeLookup(label), label]))
      .entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    const current = state.patternManagerPlace || "all";
    el.patternManagerPlace.innerHTML = `<option value="all">Todos os postos</option>` +
      options.map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("");
    if (current !== "all" && options.some(([key]) => key === current)) {
      el.patternManagerPlace.value = current;
    } else {
      state.patternManagerPlace = "all";
      el.patternManagerPlace.value = "all";
    }
  }

  function patternManagerTimelineHtml(rows = []) {
    const counts = Array.from({ length: 24 }, () => 0);
    let timedRows = 0;
    for (const row of rows) {
      const hours = new Set((row.times || [])
        .map(value => normalizeScheduleTime(value))
        .map(value => Number(String(value || "").slice(0, 2)))
        .filter(value => Number.isInteger(value) && value >= 0 && value <= 23));
      if (!hours.size) continue;
      timedRows += 1;
      for (const hour of hours) counts[hour] += 1;
    }
    const max = Math.max(1, ...counts);
    return `
      <div class="pattern-hour-chart-head">
        <strong>Mapa por hora</strong>
        <span>${escapeHtml(`${timedRows} regra(s) com horario`)}</span>
      </div>
      <div class="pattern-hour-bars">
        ${counts.map((count, hour) => `
          <span class="pattern-hour" title="${escapeHtml(`${String(hour).padStart(2, "0")}h: ${count} regra(s)`)}">
            <b style="height:${Math.max(8, Math.round((count / max) * 76))}%"></b>
            <em>${String(hour).padStart(2, "0")}</em>
          </span>
        `).join("")}
      </div>
    `;
  }

  function patternManagerActionHtml(row = {}) {
    if (row.type === "declared") {
      return `<button type="button" class="response-button" data-pattern-manual-edit="${escapeHtml(row.editKey)}">Editar</button>`;
    }
    if (row.type === "shift") {
      return `<button type="button" class="response-button" data-pattern-shift-edit="${escapeHtml(row.editKey)}">Editar turno</button>`;
    }
    return `<button type="button" class="response-button" data-pattern-group-rule="${escapeHtml(row.editKey)}">Declarar regra</button>`;
  }

  function patternManagerRowHtml(row = {}) {
    const hourlyLabel = row.requiresHourly === true
      ? `<span class="tag ok">cobra horario</span>`
      : row.requiresHourly === false
        ? `<span class="tag">sem cobranca horaria</span>`
        : "";
    return `
      <tr>
        <td>
          <div class="pattern-row-title">${escapeHtml(row.placeName || row.groupSubject || "Posto")}</div>
          <div class="item-meta">${escapeHtml([row.groupSubject, row.worker].filter(Boolean).join(" / "))}</div>
        </td>
        <td>${escapeHtml(row.typeLabel || "")}<br><span class="item-meta">${escapeHtml(row.kind || "")}</span></td>
        <td><strong>${escapeHtml(row.timeLabel || "sem horario")}</strong></td>
        <td>
          <div class="message">${escapeHtml(compactPatternText(row.patternText || ""))}</div>
          <div class="tag-row">
            <span class="tag info">${escapeHtml(row.sourceLabel || row.source || "fonte")}</span>
            <span class="tag">${escapeHtml(row.statusLabel || "ativo")}</span>
            ${hourlyLabel}
            ${(row.tags || []).slice(0, 4).map(tag => `<span class="tag">${escapeHtml(compactPatternText(tag, 80))}</span>`).join("")}
          </div>
        </td>
        <td><div class="pattern-actions">${patternManagerActionHtml(row)}</div></td>
      </tr>
    `;
  }

  function renderPatternManager() {
    if (!el.patternManagerSummary || !el.patternManagerTimeline || !el.patternManagerTable) return;
    const rows = patternManagerRows();
    renderPatternManagerPlaceOptions(rows);
    const visibleRows = patternManagerVisibleRows(rows);
    const places = new Set(rows.map(row => normalizeLookup(row.placeName || row.groupSubject || "")).filter(Boolean));
    const counts = {
      declared: rows.filter(row => row.type === "declared").length,
      shift: rows.filter(row => row.type === "shift").length,
      message: rows.filter(row => row.type === "message").length,
      noHourly: rows.filter(row => row.requiresHourly === false).length
    };
    el.patternManagerSummary.innerHTML = [
      ["Regras declaradas", counts.declared],
      ["Escalas/turnos", counts.shift],
      ["Padroes de mensagem", counts.message],
      ["Postos/grupos", places.size],
      ["Sem cobranca horaria", counts.noHourly]
    ].map(([label, value]) => `
      <div class="pattern-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </div>
    `).join("");
    el.patternManagerTimeline.innerHTML = patternManagerTimelineHtml(visibleRows);
    const renderLimit = 900;
    const renderedRows = visibleRows.slice(0, renderLimit);
    if (el.patternManagerStatus) {
      const suffix = visibleRows.length > renderLimit ? ` / mostrando ${renderLimit}` : "";
      el.patternManagerStatus.textContent = `${visibleRows.length} padrao(es) filtrado(s) de ${rows.length}${suffix}. Edicoes salvam em manual_info para o bridge, agente e GPT. ${state.patternManagerStatus || ""}`.trim();
    }
    el.patternManagerTable.innerHTML = renderedRows.length
      ? `<table class="pattern-table">
          <thead>
            <tr>
              <th>Posto / grupo</th>
              <th>Tipo</th>
              <th>Horario</th>
              <th>Padrao</th>
              <th>Acao</th>
            </tr>
          </thead>
          <tbody>${renderedRows.map(patternManagerRowHtml).join("")}</tbody>
        </table>`
      : `<div class="empty">Nenhum padrao encontrado para os filtros atuais.</div>`;
  }

  function startPatternManagerNewRule() {
    clearManualPlaceForm();
    state.manualPlaceInfoOpen = true;
    state.manualPlaceInfoStatus = "Nova regra manual. Salvar envia para o bridge, agente e GPT.";
    renderManualPlaceInfo();
    try {
      el.manualPlaceInfoBox?.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
      // Older WebViews may not support scroll options.
    }
    el.manualPlaceName?.focus();
  }

  function startPatternManagerGroupRule(key = "") {
    const group = (state.groups?.groups || []).find(item => patternManagerGroupKey(item) === String(key || ""));
    if (!group) return;
    clearManualPlaceForm();
    const times = patternManagerGroupTimes(group);
    const shiftKind = group.shiftEndHours?.length && !group.shiftStartHours?.length
      ? "shift_end"
      : group.shiftHandoffHours?.length
        ? "shift_handoff"
        : group.requiresShiftStart || group.shiftStartHours?.length
          ? "shift_start"
          : "";
    state.manualPlaceInfoOpen = true;
    state.manualPlaceInfoStatus = `Declarando regra para ${group.placeName || group.groupSubject || "grupo"}.`;
    if (el.manualRuleScope) el.manualRuleScope.value = group.groupId ? "group_shift" : "place";
    if (el.manualShiftKind) el.manualShiftKind.value = shiftKind;
    if (el.manualPlaceName) el.manualPlaceName.value = group.placeName || group.groupSubject || "";
    if (el.manualPlaceStartTime) el.manualPlaceStartTime.value = normalizeScheduleTime(times[0] || "");
    if (el.manualPlacePatternText) {
      const cadence = group.requiresHourly ? "cobra informes de horario" : "sem cobranca horaria rotineira";
      el.manualPlacePatternText.value = `Padrao declarado a partir do aprendizado: ${group.placeName || group.groupSubject || "posto"} / ${cadence}. ${patternText(group)}`;
    }
    renderManualPlaceInfo();
    try {
      el.manualPlaceInfoBox?.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
      // Older WebViews may not support scroll options.
    }
    showToast("Revise e salve para aplicar ao agente/GPT.");
  }

  function patternManagerAgentPacket() {
    return {
      generatedAt: new Date().toISOString(),
      source: "whatsappmonitoramento-pattern-manager",
      declaredRules: manualPlaceInfoRows(SHIFT_SCHEDULE_RULE_LIMIT).map(row => ({
        id: row.id || manualPlaceClientKey(row),
        placeName: row.placeName || "",
        groupSubject: row.groupSubject || "",
        ruleScope: manualRuleScope(row),
        workerName: row.workerName || row.contactName || "",
        fromPhone: row.fromPhone || "",
        shiftKind: row.shiftKind || "",
        times: manualRuleTimes(row),
        patternText: row.patternText || "",
        policy: row.policy || null,
        suppressHourly: Boolean(row.suppressHourly),
        source: row.source || ""
      })),
      shiftPatterns: shiftScheduleRows().map(row => ({
        key: row.key || "",
        placeName: row.placeName || "",
        groupSubject: row.groupSubject || "",
        shiftKind: row.shiftKind || "",
        expectedTime: row.expectedTime || "",
        leavePerson: row.leavePerson || "",
        startPerson: row.startPerson || "",
        statusLabel: row.statusLabel || "",
        ruleText: row.ruleText || "",
        sourceTags: row.sourceTags || []
      })),
      messagePatterns: (state.groups?.groups || []).map(group => ({
        groupId: group.groupId || "",
        groupSubject: group.groupSubject || "",
        placeName: group.placeName || "",
        requiresHourly: Boolean(group.requiresHourly),
        requiresShiftStart: Boolean(group.requiresShiftStart),
        shiftStartHours: scheduleHours(group.shiftStartHours || []),
        shiftEndHours: scheduleHours(group.shiftEndHours || []),
        shiftHandoffHours: scheduleHours(group.shiftHandoffHours || []),
        mode: group.mode || "",
        modeLabel: group.modeLabel || "",
        patternText: patternText(group),
        manualPlacePattern: group.manualPlacePattern || null
      }))
    };
  }

  async function copyPatternManagerPacket() {
    const text = JSON.stringify(patternManagerAgentPacket(), null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      state.patternManagerStatus = "Pacote IA copiado.";
      showToast("Pacote IA copiado.");
    } catch {
      state.patternManagerStatus = "Nao foi possivel copiar o pacote IA.";
      showToast(state.patternManagerStatus);
    }
    renderPatternManager();
  }

  function renderManualPlaceInfo() {
    if (!el.manualPlaceInfoBox || !el.manualPlaceInfoList) return;
    el.manualPlaceInfoBox.hidden = !state.manualPlaceInfoOpen;
    if (el.manualPlaceInfoToggle) el.manualPlaceInfoToggle.textContent = state.manualPlaceInfoOpen ? "Fechar regras" : (shiftSupervisorMode ? "Regras" : "Adicionar padrao");
    if (el.manualPlaceInfoSave) el.manualPlaceInfoSave.textContent = state.manualPlaceInfoEditingKey ? "Atualizar regra" : (shiftSupervisorMode ? "Salvar regra" : "Salvar padrao do posto");
    if (el.manualPlaceInfoCancel) el.manualPlaceInfoCancel.hidden = !state.manualPlaceInfoEditingKey;
    if (el.manualPlaceInfoStatus) el.manualPlaceInfoStatus.textContent = state.manualPlaceInfoStatus || "";
    if (el.manualPlaceOptions) {
      el.manualPlaceOptions.innerHTML = manualPlaceCatalog()
        .slice(0, 240)
        .map(place => `<option value="${escapeHtml(place.label)}"></option>`)
        .join("");
    }
    if (el.manualWorkerOptions) {
      el.manualWorkerOptions.innerHTML = manualWorkerCatalog()
        .slice(0, 240)
        .map(worker => `<option value="${escapeHtml(worker.label)}"></option>`)
        .join("");
    }
    const rows = manualPlaceInfoRows();
    el.manualPlaceInfoList.innerHTML = rows.length
      ? rows.map(row => `
        <article class="manual-info-item">
          <div class="item-header">
            <div>
              <div class="item-title">${escapeHtml(row.placeName || row.groupSubject || "Posto")}</div>
              <div class="item-meta">${escapeHtml(manualRuleScopeLabel(manualRuleScope(row)))}${row.workerName || row.contactName || row.fromPhone ? ` / ${escapeHtml(row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone)}` : ""}${row.shiftKind ? ` / ${escapeHtml(manualShiftKindLabel(row.shiftKind))}` : ""}${row.startingTime ? ` / inicio ${escapeHtml(row.startingTime)}` : " / sem horario fixo"}${row.policy?.shiftEndHours?.length ? ` / fim ${escapeHtml(row.policy.shiftEndHours.map(hour => `${String(hour).padStart(2, "0")}h`).join(", "))}` : ""}${row.entries ? ` / ${row.entries} entrada(s)` : ""}</div>
            </div>
            <span class="tag ${row.source === "bridge" ? "ok" : "warn"}">${row.source === "bridge" ? "bridge" : "local"}</span>
          </div>
          ${row.suppressHourly ? `<div class="tag-row"><span class="tag ok">sem cobranca horaria</span></div>` : ""}
          <div class="message">${escapeHtml(row.patternText || "Padrao sem texto complementar.")}</div>
          <div class="manual-info-row-actions">
            <button type="button" data-manual-place-edit="${escapeHtml(row.id)}">Editar</button>
            <button type="button" data-manual-place-delete="${escapeHtml(row.id)}">Excluir</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty">Nenhum padrao manual salvo ainda.</div>`;
  }

  function aiFeedbackBaseUrls() {
    return monitoramentoBridgeBaseUrls();
  }

  async function sendAiFeedbackEvent(event) {
    for (const baseUrl of aiFeedbackBaseUrls()) {
      try {
        const response = await withTimeout(fetch(`${baseUrl}/monitoramento/ai-feedback`, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(event)
        }), CLOUD_FETCH_TIMEOUT_MS, "feedback AI");
        if (response.ok) return;
      } catch {
        // Keep feedback in localStorage and retry on the next sync.
      }
    }
    if (aiFeedbackRef) {
      const now = new Date().toISOString();
      await aiFeedbackRef.doc(event.id || safeDocId(`${now}:monitoramento-ai-feedback`)).set({
        ...event,
        cloudQueuedAt: now,
        cloudStatus: "pending_bridge_import"
      }, { merge: true });
      return;
    }
    throw new Error("Nao foi possivel enviar feedback AI agora.");
  }

  async function flushAiFeedback() {
    if (!mobileState.pendingAiFeedback.length) return;
    const remaining = [];
    for (const event of mobileState.pendingAiFeedback) {
      try {
        await sendAiFeedbackEvent(event);
      } catch {
        remaining.push(event);
      }
    }
    savePendingAiFeedback(remaining);
  }

  function buildAiFeedbackEvent(action, row, correction = "") {
    const now = new Date().toISOString();
    const suggestion = aiSuggestionForRow(row) || {};
    const key = aiFeedbackKey(row);
    const messageTextFull = rowFullMessage(row);
    const messageDisplayValidation = rowDisplayValidation(row) || suggestion.displayValidation || null;
    return {
      id: safeDocId([now, "ai-feedback", action, key || Math.random().toString(16).slice(2)].join(":")),
      loggedAt: now,
      action,
      correction,
      reason: suggestion.recommendation || suggestion.summary || "",
      rowKey: row.key || rowKey(row),
      lane: suggestion.lane || "",
      suggestion: {
        ...suggestion,
        fullText: suggestion.fullText || messageTextFull,
        displayValidation: suggestion.displayValidation || messageDisplayValidation
      },
      row: normalizeMobileLogRow(row || {}),
      messageTextFull,
      messageDisplayValidation,
      operatorUser: "mobile",
      computerName: mobileDeviceLabel(),
      appVersion: "web-pwa",
      source: "monitoramento-mobile-app"
    };
  }

  function aiFeedbackLabel(action) {
    const labels = {
      approve: "Sugestao aprovada",
      correct: "Sugestao corrigida",
      reject: "Sugestao rejeitada"
    };
    return labels[action] || "Feedback AI";
  }

  async function applyAiFeedback(action, row) {
    const suggestion = aiSuggestionForRow(row);
    if (!suggestion) return false;
    let correction = "";
    if (action === "correct") {
      correction = window.prompt("Informe a correcao para a sugestao AI:", suggestion.recommendation || suggestion.summary || "") || "";
      if (!correction.trim()) return false;
    }
    const event = buildAiFeedbackEvent(action, row, correction.trim());
    const key = aiFeedbackKey(row);
    const feedbackRowKey = row.key || rowKey(row);
    mobileState.aiFeedback[key] = {
      action,
      at: event.loggedAt,
      correction: event.correction || "",
      rowKey: feedbackRowKey,
      reportId: row.reportId || "",
      sourceMessageId: row.sourceMessageId || "",
      suggestionId: suggestion.id || "",
      lane: suggestion.lane || ""
    };
    saveAiFeedbackState();
    if (mobileState.activeKey === feedbackRowKey) mobileState.activeKey = "";
    state.selectedLogEvent = null;
    state.mobileMessage = "Registrando aprendizado AI...";
    render();
    try {
      await sendAiFeedbackEvent(event);
      await flushAiFeedback();
      state.mobileMessage = aiFeedbackLabel(action);
    } catch {
      savePendingAiFeedback([...mobileState.pendingAiFeedback, event]);
      state.mobileMessage = "Feedback AI salvo neste celular. Enviaremos assim que a conexao permitir.";
    }
    await logMobileAction(`ai_${action}`, row, suggestion.lane || "ai_feedback", { silent: true });
    render();
    showToast(state.mobileMessage);
    return true;
  }

  function shiftFeedbackKey(action, row = {}) {
    return [
      "shift-confirmation",
      action || "",
      row.key || rowKey(row),
      row.reportId || row.sourceMessageId || row.lastReportAt || "",
      row.hourKey || row.startHourKey || ""
    ].join("|");
  }

  function shiftFeedbackForRow(row = {}) {
    if (SHIFT_FEEDBACK_RESOLUTION_ACTIONS.has(String(row.operatorShiftFeedback || ""))) {
      return {
        action: row.operatorShiftFeedback,
        feedback: {
          loggedAt: row.operatorShiftFeedbackAt || row.operatorShiftResolvedAt || row.loggedAt || "",
          at: row.operatorShiftFeedbackAt || row.operatorShiftResolvedAt || row.loggedAt || ""
        }
      };
    }

    const local = Object.keys(SHIFT_FEEDBACK_ACTIONS)
      .map(action => ({ action, feedback: mobileState.aiFeedback[shiftFeedbackKey(action, row)] }))
      .filter(item => item.feedback?.action === item.action)
      .sort((a, b) => String(b.feedback?.at || "").localeCompare(String(a.feedback?.at || "")))[0];
    if (local) return local;

    const events = [
      ...(Array.isArray(mobileState.pendingAiFeedback) ? mobileState.pendingAiFeedback : []),
      ...(Array.isArray(state.aiFeedback?.recent) ? state.aiFeedback.recent : [])
    ]
      .filter(event => SHIFT_FEEDBACK_RESOLUTION_ACTIONS.has(String(event.action || "")))
      .filter(event => shiftFeedbackEventMatchesRow(event, row))
      .sort((a, b) => String(b.loggedAt || b.at || "").localeCompare(String(a.loggedAt || a.at || "")));
    const event = events[0] || null;
    return event ? { action: event.action, feedback: event } : null;
  }

  function shiftFeedbackEventMatchesRow(event = {}, row = {}) {
    const eventRow = event.row || {};
    const keys = new Set([row.key, row.rowKey, rowKey(row)].filter(Boolean).map(String));
    const eventRowKey = String(event.rowKey || eventRow.key || "").trim();
    if (eventRowKey && keys.has(eventRowKey)) return true;

    const reportIds = new Set([row.reportId, row.sourceMessageId].filter(Boolean).map(String));
    for (const value of [event.reportId, event.sourceMessageId, eventRow.reportId, eventRow.sourceMessageId]) {
      if (value && reportIds.has(String(value))) return true;
    }

    const sameHour = !eventRow.hourKey || eventRow.hourKey === row.hourKey || eventRow.hourKey === row.startHourKey;
    const samePlace = !eventRow.placeId && !eventRow.placeName
      ? true
      : (eventRow.placeId && eventRow.placeId === row.placeId) ||
        (eventRow.placeName && normalizeLookup(eventRow.placeName) === normalizeLookup(row.placeName || row.groupSubject));
    const sameGroup = !eventRow.groupId && !eventRow.groupSubject
      ? true
      : (eventRow.groupId && eventRow.groupId === row.groupId) ||
        (eventRow.groupSubject && normalizeLookup(eventRow.groupSubject) === normalizeLookup(row.groupSubject));
    const eventPhone = phoneDigits(eventRow.fromPhone || "");
    const rowPhone = phoneDigits(row.fromPhone || "");
    const sameWorker = !eventRow.workerId && !eventRow.fromPhone && !eventRow.workerName && !eventRow.contactName
      ? true
      : (eventRow.workerId && eventRow.workerId === row.workerId) ||
        (eventPhone && rowPhone && eventPhone === rowPhone) ||
        (eventRow.workerName && normalizeLookup(eventRow.workerName) === normalizeLookup(row.workerName || row.contactName)) ||
        (eventRow.contactName && normalizeLookup(eventRow.contactName) === normalizeLookup(row.contactName || row.workerName));
    return Boolean(sameHour && samePlace && sameGroup && sameWorker && (eventRow.placeId || eventRow.placeName || eventRow.groupId || eventRow.groupSubject || eventRow.workerId || eventRow.fromPhone || eventRow.workerName || eventRow.contactName));
  }

  function isShiftResolvedByFeedback(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    return SHIFT_FEEDBACK_RESOLUTION_ACTIONS.has(String(feedback?.action || ""));
  }

  function shiftFeedbackResolvedRow(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    if (!feedback) return row;
    const meta = SHIFT_FEEDBACK_ACTIONS[feedback.action] || {};
    return {
      ...row,
      operatorShiftResolved: true,
      operatorShiftFeedback: feedback.action,
      operatorShiftFeedbackLabel: meta.label || feedback.action,
      operatorShiftFeedbackAt: feedback.feedback?.loggedAt || feedback.feedback?.at || "",
      operatorShiftCountsAsInform: feedback.action === "shift_arrived" || feedback.action === "shift_delayed"
    };
  }

  function buildShiftFeedbackEvent(action, row) {
    const meta = SHIFT_FEEDBACK_ACTIONS[action];
    if (!meta) throw new Error("Acao de turno invalida.");
    const now = new Date().toISOString();
    const key = shiftFeedbackKey(action, row);
    const messageTextFull = rowFullMessage(row);
    const messageDisplayValidation = rowDisplayValidation(row) || null;
    const countsAsInform = action === "shift_arrived" || action === "shift_delayed";
    return {
      id: safeDocId([now, "shift-feedback", action, key || Math.random().toString(16).slice(2)].join(":")),
      loggedAt: now,
      action,
      correction: meta.correction,
      reason: meta.reason,
      rowKey: row.key || rowKey(row),
      lane: "shift_confirmation_review",
      operatorShiftDecision: {
        action,
        label: meta.label || action,
        resolved: true,
        countsAsInform,
        requiresRecheck: !countsAsInform,
        target: countsAsInform ? "shift_confirmation" : "shift_review",
        effectiveFrom: now,
        hourKey: row.hourKey || row.startHourKey || "",
        placeId: row.placeId || "",
        placeName: row.placeName || row.groupSubject || "",
        groupId: row.groupId || "",
        groupSubject: row.groupSubject || "",
        workerId: row.workerId || "",
        workerName: row.workerName || row.contactName || "",
        fromPhone: row.fromPhone || "",
        contactName: row.contactName || ""
      },
      suggestion: {
        id: safeDocId(["shift-confirmation", action, row.key || rowKey(row)].join(":")),
        lane: "shift_confirmation_review",
        enabled: true,
        title: "Confirmacao de troca de turno",
        summary: meta.summary,
        recommendation: meta.recommendation,
        confidence: 1,
        manualOnly: false,
        fullText: messageTextFull,
        displayValidation: messageDisplayValidation
      },
      row: normalizeMobileLogRow(row || {}),
      messageTextFull,
      messageDisplayValidation,
      operatorUser: "mobile",
      computerName: mobileDeviceLabel(),
      appVersion: "web-pwa",
      source: "monitoramento-shift-supervisor"
    };
  }

  async function applyShiftFeedback(action, row) {
    const meta = SHIFT_FEEDBACK_ACTIONS[action];
    if (!meta || !row) return;
    const event = buildShiftFeedbackEvent(action, row);
    const key = shiftFeedbackKey(action, row);
    mobileState.aiFeedback[key] = {
      action,
      at: event.loggedAt,
      correction: event.correction || "",
      rowKey: event.rowKey,
      reportId: row.reportId || "",
      sourceMessageId: row.sourceMessageId || "",
      hourKey: row.hourKey || row.startHourKey || "",
      lane: "shift_confirmation_review",
      resolved: true
    };
    saveAiFeedbackState();
    if (mobileState.activeKey === event.rowKey) mobileState.activeKey = "";
    state.mobileMessage = "Registrando decisao do supervisor...";
    render();
    try {
      await sendAiFeedbackEvent(event);
      await flushAiFeedback();
      state.mobileMessage = meta.success;
    } catch {
      savePendingAiFeedback([...mobileState.pendingAiFeedback, event]);
      state.mobileMessage = "Confirmacao salva neste celular. Enviaremos assim que a conexao permitir.";
    }
    await logMobileAction(action, row, meta.reason, { silent: true });
    render();
    showToast(state.mobileMessage);
  }

  function monitoramentoRowsForFeedbackLookup() {
    return [
      ...shiftPendingRows(),
      ...shiftConfirmedRows(80),
      ...pendingDueRows(),
      ...currentRowsWithKeys(),
      ...confirmedRecentRows(),
      ...dueRowsWithKeys()
    ];
  }

  function rowForAiFeedbackButton(button, fallbackRow = null) {
    const key = button?.getAttribute("data-ai-row-key") || button?.closest("[data-ai-row-key]")?.getAttribute("data-ai-row-key") || "";
    if (!key) return fallbackRow;
    return monitoramentoRowsForFeedbackLookup().find(row => row.key === key || rowKey(row) === key) || fallbackRow;
  }

  function handleAiFeedbackButton(button, fallbackRow = null) {
    if (!adminTrainingMode) return;
    const row = rowForAiFeedbackButton(button, fallbackRow);
    if (!row) return;
    button.disabled = true;
    applyAiFeedback(button.getAttribute("data-ai-feedback") || "", row).then(applied => {
      if (!applied && button.isConnected) button.disabled = false;
    }).catch(error => {
      state.mobileMessage = error.message || "Nao foi possivel registrar feedback AI.";
      showToast(state.mobileMessage);
      render();
    });
  }

  function rowForShiftFeedbackButton(button, fallbackRow = null) {
    const key = button?.getAttribute("data-shift-row-key") || button?.closest("[data-shift-row-key]")?.getAttribute("data-shift-row-key") || "";
    if (!key) return fallbackRow;
    return monitoramentoRowsForFeedbackLookup().find(row => row.key === key || rowKey(row) === key) || fallbackRow;
  }

  function handleShiftFeedbackButton(button, fallbackRow = null) {
    if (!shiftSupervisorMode) return;
    const row = rowForShiftFeedbackButton(button, fallbackRow);
    if (!row) return;
    button.disabled = true;
    applyShiftFeedback(button.getAttribute("data-shift-feedback") || "", row).catch(error => {
      state.mobileMessage = error.message || "Nao foi possivel registrar a confirmacao do turno.";
      showToast(state.mobileMessage);
      renderMobileOverlay();
    });
  }

  async function logMobileAction(action, row, reason = "", options = {}) {
    const event = buildMobileLogEvent(action, row, reason);
    prependLocalOverlayLog(event);
    renderOverlayLogs();
    try {
      await sendMobileLogEvent(event);
      if (!options.silent) state.mobileMessage = state.mobileMessage || "Acao registrada.";
      await flushMobileLogs();
    } catch {
      savePendingMobileLogs([...mobileState.pendingLogs, event]);
      if (!options.silent) state.mobileMessage = "Acao salva neste celular. Enviaremos assim que a conexao permitir.";
    }
    renderMobileOverlay();
  }

  function saveShiftNotificationState() {
    writeStore(MOBILE_STORAGE_KEYS.shiftNotifications, mobileState.shiftNotifications);
  }

  function shiftNotificationKey(row = {}) {
    return safeDocId([
      "shift-red",
      row.key || rowKey(row),
      row.deadlineAt || row.startHourKey || row.hourKey || ""
    ].join(":"));
  }

  async function triggerShiftPhonePopup(row = {}, escalation = null) {
    if (!shiftSupervisorMode || !row) return;
    const info = escalation || shiftEscalationInfo(row);
    if (info.level !== "red") return;
    const key = shiftNotificationKey(row);
    const existing = mobileState.shiftNotifications[key] || {};
    if (existing.notifiedAt) return;
    const now = new Date().toISOString();
    if (notificationPermission() !== "granted") {
      mobileState.shiftNotifications[key] = { ...existing, blockedAt: now, rowKey: row.key || rowKey(row) };
      saveShiftNotificationState();
      return;
    }
    const title = "Troca de turno em atraso";
    const body = `${row.placeName || "Posto"} / ${row.workerName || row.contactName || "funcionario nao declarado"} / ${info.minutesLate} min sem declaracao.`;
    mobileState.shiftNotifications[key] = { ...existing, notifiedAt: now, rowKey: row.key || rowKey(row) };
    saveShiftNotificationState();
    try {
      await showLocalNotification(title, {
        body,
        tag: key,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 90, 200, 90, 320],
        data: { rowKey: row.key || rowKey(row), source: "shift-supervisor" }
      });
      if (navigator.vibrate) navigator.vibrate([200, 90, 200, 90, 320]);
    } catch {
      // The visual red state remains active even if the browser blocks the popup.
    }
    logMobileAction("shift_phone_popup", row, "shift_15min_red_popup", { silent: true }).catch(() => {});
  }

  function markMobilePopupShown(row) {
    if (!row?.key || mobileState.shown[row.key]) return;
    mobileState.shown[row.key] = new Date().toISOString();
    writeStore(MOBILE_STORAGE_KEYS.shown, mobileState.shown);
    logMobileAction("popup_shown", row, "intervention_visible", { silent: true }).catch(() => {});
  }

  function scheduleMobileNoResponse(row) {
    clearTimeout(mobileState.noResponseTimer);
    if (!row?.key || mobileState.noResponse[row.key] || isResolved(row.key) || isDelayed(row.key)) return;
    mobileState.noResponseTimer = setTimeout(() => {
      if (isResolved(row.key) || isDelayed(row.key) || mobileState.noResponse[row.key]) return;
      mobileState.noResponse[row.key] = new Date().toISOString();
      writeStore(MOBILE_STORAGE_KEYS.noResponse, mobileState.noResponse);
      state.mobileMessage = "Sem resposta registrada em 10 minutos.";
      showToast("Sem resposta registrada em 10 minutos.");
      logMobileAction("no_response", row, "mobile_without_answer_10min").catch(() => {});
      renderMobileOverlay();
    }, MOBILE_NO_RESPONSE_MS);
  }

  function connectCloud() {
    if (!window.firebase || !window.RH_FIREBASE_CONFIG) {
      state.lastError = "Conexao do portal ainda nao carregou.";
      refreshLiveOnce({ forceLocal: true });
      refreshOverlayLogsOnce();
      setInterval(() => refreshLiveOnce(), LIVE_FETCH_INTERVAL_MS);
      setInterval(() => refreshOverlayLogsOnce(), LIVE_FETCH_INTERVAL_MS);
      setInterval(() => flushMobileLogs().catch(() => {}), LIVE_FETCH_INTERVAL_MS);
      render();
      return;
    }
    try {
      const app = firebase.apps.find(item => item.name === "whatsapp-live-monitoramento") ||
        firebase.initializeApp(window.RH_FIREBASE_CONFIG, "whatsapp-live-monitoramento");
      const db = app.firestore();
      liveDb = db;
      liveStatusRef = db.collection("whatsapp_live").doc("monitoramento");
      overlayLogsRef = db.collection("whatsapp_monitoramento_overlay_logs").orderBy("loggedAt", "desc").limit(OVERLAY_LOG_FETCH_LIMIT);
      aiFeedbackRef = db.collection(AI_FEEDBACK_COLLECTION);
      refreshLiveOnce({ forceLocal: true });
      refreshOverlayLogsOnce();
      flushMobileLogs().catch(() => {});
      flushAiFeedback().catch(() => {});
      setInterval(() => refreshLiveOnce(), LIVE_FETCH_INTERVAL_MS);
      setInterval(() => refreshOverlayLogsOnce(), LIVE_FETCH_INTERVAL_MS);
      setInterval(() => flushMobileLogs().catch(() => {}), LIVE_FETCH_INTERVAL_MS);
      setInterval(() => flushAiFeedback().catch(() => {}), LIVE_FETCH_INTERVAL_MS);
    } catch (error) {
      state.lastError = error.message || String(error);
      render();
    }
  }

  function overlayLogFetchLimit(options = {}) {
    if (options.recovery) return OVERLAY_LOG_RECOVERY_FETCH_LIMIT;
    return shiftSupervisorMode ? OVERLAY_LOG_RECOVERY_FETCH_LIMIT : OVERLAY_LOG_FETCH_LIMIT;
  }

  async function refreshOverlayLogsOnce(options = {}) {
    const fetchLimit = overlayLogFetchLimit(options);
    if (logsFetchInFlight) {
      if (logsFetchPromise) await logsFetchPromise.catch(() => {});
      if (options.recovery) return refreshOverlayLogsOnce(options);
      return;
    }
    logsFetchInFlight = true;
    logsFetchPromise = (async () => {
      for (const baseUrl of monitoramentoBridgeBaseUrls()) {
        try {
          const data = await requestJson(`${baseUrl}/monitoramento/overlay-logs.json?limit=${fetchLimit}&t=${Date.now()}`, { timeoutMs: CLOUD_FETCH_TIMEOUT_MS });
          if (Array.isArray(data.logs)) {
            mergeOverlayLogs(data.logs);
            state.overlayLogsFetchedAt = data.generatedAt || new Date().toISOString();
            state.overlayLogsSource = baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost") ? "local_bridge" : "public_bridge";
            renderOverlayLogs();
            renderMobileOverlay();
            renderCurrentHour();
            renderShiftExport();
            return true;
          }
        } catch {
          // Try Firestore below when the public bridge is temporarily unreachable.
        }
      }
      if (!overlayLogsRef || firestoreReadBackoffActive()) return false;
      try {
        const snapshot = await overlayLogsRef.get();
        firestoreReadBackoffUntil = 0;
        firestoreReadBackoffReason = "";
        mergeOverlayLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        state.overlayLogsFetchedAt = new Date().toISOString();
        state.overlayLogsSource = "firestore";
        renderOverlayLogs();
        renderMobileOverlay();
        renderCurrentHour();
        renderShiftExport();
        return true;
      } catch (error) {
        noteFirestoreReadError(error);
        throw error;
      }
    })();
    try {
      return await logsFetchPromise;
    } catch (error) {
      console.warn("overlay logs", error);
      return false;
    } finally {
      logsFetchInFlight = false;
      logsFetchPromise = null;
    }
  }

  function overlayActionLabel(action) {
    const labels = {
      popup_shown: "popup exibido",
      no_response: "sem resposta",
      message_confirmed: "mensagem confirmada",
      done: "lidado / cobrado",
      ignore: "ignorado",
      delay: "adiado",
      shift_arrived: "sem novidades",
      shift_delayed: "assumiu com atraso",
      shift_fake: "informacao errada",
      shift_no_qra_needed: "sem QRA necessario",
      shift_wrong_person: "pessoa diferente assumiu",
      shift_wrong_time: "horario errado de turno",
      shift_phone_popup: "popup telefone 15 min",
      ai_approve: "AI aprovada",
      ai_correct: "AI corrigida",
      ai_reject: "AI rejeitada",
      status_fetch: "status",
      whatsapp_disconnected: "WhatsApp desconectado"
    };
    return labels[action] || action || "acao";
  }

  function overlayActionTone(action) {
    if (action === "done" || action === "message_confirmed") return "ok";
    if (action === "shift_arrived") return "ok";
    if (action === "shift_delayed") return "warn";
    if (action === "shift_fake") return "bad";
    if (action === "shift_no_qra_needed") return "warn";
    if (action === "shift_wrong_person") return "bad";
    if (action === "shift_wrong_time") return "warn";
    if (action === "shift_phone_popup") return "bad";
    if (action === "ai_approve") return "ok";
    if (action === "ai_correct") return "warn";
    if (action === "ai_reject") return "bad";
    if (action === "delay") return "warn";
    if (action === "no_response") return "bad";
    if (action === "whatsapp_disconnected") return "bad";
    if (action === "popup_shown" || action === "status_fetch") return "info";
    if (action === "ignore") return "muted";
    return "neutral";
  }

  function overlayActionMeaning(action) {
    const labels = {
      done: "confirmada pelo operador",
      whatsapp_disconnected: "WhatsApp desconectado",
      message_confirmed: "mensagem validada no confirmado",
      shift_arrived: "troca de turno sem novidades confirmada pelo supervisor",
      shift_delayed: "chegada atrasada confirmada pelo supervisor",
      shift_fake: "informacao de troca de turno marcada como falsa/incorreta",
      shift_no_qra_needed: "supervisor marcou que este alerta nao precisa de QRA",
      shift_wrong_person: "supervisor marcou que outra pessoa assumiu o turno",
      shift_wrong_time: "supervisor marcou que o horario do turno esta errado",
      shift_phone_popup: "alerta vermelho de 15 minutos exibido no telefone",
      ignore: "ignorada / nao necessaria",
      ai_approve: "sugestao AI aprovada pelo operador",
      ai_correct: "sugestao AI corrigida pelo operador",
      ai_reject: "sugestao AI rejeitada pelo operador",
      delay: "pode ser necessario rever depois",
      popup_shown: "possivel intervencao exibida",
      no_response: "sem resposta no prazo",
      status_fetch: "sincronizacao do app"
    };
    return labels[action] || "registro do app";
  }

  function isStatusLog(log = {}) {
    return log.action === "status_fetch" || log.action === "whatsapp_disconnected";
  }

  function isDisconnectedStatusLog(log = {}) {
    if (!isStatusLog(log)) return false;
    const text = normalizeText([log.statusText, log.meaning, log.reason].join(" "));
    if (text.includes("bridge carregado") || text.includes("verificando") || text.includes("aguardando")) return false;
    return text.includes("desconectado") || text.includes("qr") || text.includes("reconect") || text.includes("sem conexao");
  }

  function isOperatorVisibleLog(log = {}) {
    const action = String(log.action || "");
    if (["app_update", "sync", "sync_ok", "status_ok", "cloud_fetch", "local_fetch", "public_bridge_fetch"].includes(action)) return false;
    if (isStatusLog(log)) return isDisconnectedStatusLog(log);
    return true;
  }

  function shiftRowFromLog(log = {}) {
    const row = { ...(log.row || {}) };
    const key = log.rowKey || row.key || rowKey(row);
    const reportId = row.reportId || log.reportId || "";
    const sourceMessageId = row.sourceMessageId || log.sourceMessageId || "";
    const current = [...shiftRowsFromSlots(), ...confirmedRecentRows(SHIFT_RESOLVED_LIST_LIMIT)]
      .find(item =>
        (key && (item.key === key || item.rowKey === key)) ||
        (reportId && item.reportId === reportId) ||
        (sourceMessageId && item.sourceMessageId === sourceMessageId)
      );
    if (!current) return { ...row, key };
    return {
      ...row,
      ...current,
      key,
      workerId: current.workerId || row.workerId || "",
      workerName: current.workerName || row.workerName || "",
      contactName: current.contactName || row.contactName || "",
      fromPhone: current.fromPhone || row.fromPhone || "",
      textFull: current.textFull || row.textFull || "",
      lastReportTextFull: current.lastReportTextFull || row.lastReportTextFull || row.textFull || "",
      text: current.text || row.text || "",
      lastReportText: current.lastReportText || row.lastReportText || row.text || ""
    };
  }

  function isShiftResolutionLog(log = {}) {
    return SHIFT_FEEDBACK_RESOLUTION_ACTIONS.has(String(log.action || ""));
  }

  function isShiftLog(log = {}) {
    if (!log || isStatusLog(log)) return false;
    if (isShiftResolutionLog(log) || log.action === "shift_phone_popup") return true;
    return isShiftRelatedRow(shiftRowFromLog(log));
  }

  function shiftDisplayStatus(row = {}) {
    if (!shiftSupervisorMode || !isShiftRelatedRow(row)) return statusLabel(row.status);
    const feedback = shiftFeedbackForRow(row);
    if (feedback) return SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || "resolvido";
    return row.lastReportSemantic || statusLabel(row.status);
  }

  function overlayLogTimestampMs(log = {}) {
    return timestampMs(log.loggedAt || log.updatedAt || log.createdAt || log.uploadedAt || log.row?.lastReportAt || log.row?.firstReportAt || "");
  }

  function isArchivedOverlayLog(log = {}) {
    const loggedAt = overlayLogTimestampMs(log);
    return Boolean(loggedAt && Date.now() - loggedAt > SHIFT_LOG_VISIBLE_MS);
  }

  function shiftLogWindowLabel(log = {}) {
    return isArchivedOverlayLog(log) ? "arquivado 24h+" : "visivel 24h";
  }

  function overlayLogsSourceLabel() {
    const source = state.overlayLogsSource || (state.overlayLogs.length ? "cache" : "");
    const labels = {
      public_bridge: "bridge publico",
      firestore: "Firestore",
      local_bridge: "bridge local",
      cache: "cache local"
    };
    return labels[source] || source || "sem fonte";
  }

  function mergedOverlayLogSource() {
    const byId = new Map();
    for (const log of [...(mobileState.statusLogs || []), ...(mobileState.pendingLogs || []), ...(state.overlayLogs || [])]) {
      if (log?.id) byId.set(log.id, log);
    }
    return [...byId.values()].sort((a, b) => String(b.loggedAt || "").localeCompare(String(a.loggedAt || "")));
  }

  function mergedOverlayLogs(limit = shiftSupervisorMode ? 500 : 80, options = {}) {
    const seenStatusMinute = new Set();
    const includeArchived = options.includeArchived === true;
    return mergedOverlayLogSource()
      .filter(log => {
        if (!isOperatorVisibleLog(log)) return false;
        if (shiftSupervisorMode && !isShiftLog(log)) return false;
        if (!includeArchived && isArchivedOverlayLog(log)) return false;
        if (!isStatusLog(log)) return true;
        if (!isDisconnectedStatusLog(log)) return false;
        const minute = Math.floor((new Date(log.loggedAt || 0).getTime() || 0) / MOBILE_STATUS_LOG_INTERVAL_MS);
        const key = `status:${minute}`;
        if (seenStatusMinute.has(key)) return false;
        seenStatusMinute.add(key);
        return true;
      })
      .slice(0, limit);
  }

  function isResolvedOverlayLog(log = {}) {
    return !isStatusLog(log) && RESOLVED_LOG_ACTIONS.has(String(log.action || ""));
  }

  function isResolvedLogRow(row = {}) {
    return Boolean(row && row.__resolvedLog && typeof row.__resolvedLog === "object");
  }

  function resolvedOverlayLogRows(limit = CONFIRMED_24H_DISPLAY_LIMIT, options = {}) {
    const rows = [];
    const seen = new Set();
    for (const log of mergedOverlayLogs(OVERLAY_LOG_CACHE_LIMIT).filter(isResolvedOverlayLog)) {
      const row = options.shiftOnly ? shiftRowFromLog(log) : logRowFromEvent(log);
      const shiftResolved = isShiftResolutionLog(log);
      if (options.shiftOnly && !shiftResolved && !isShiftRelatedRow(row)) continue;
      const loggedAt = log.loggedAt || log.updatedAt || log.createdAt || "";
      const id = log.id || safeDocId([loggedAt, log.action || "", log.rowKey || row.key || rowKey(row)].join(":"));
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        ...row,
        key: `log:${id}`,
        loggedAt,
        __resolvedLogId: id,
        __resolvedLog: log,
        operatorShiftResolved: shiftResolved || row.operatorShiftResolved,
        operatorShiftFeedback: shiftResolved ? log.action : row.operatorShiftFeedback,
        operatorShiftFeedbackLabel: shiftResolved ? overlayActionLabel(log.action) : row.operatorShiftFeedbackLabel,
        operatorShiftFeedbackAt: loggedAt || row.operatorShiftFeedbackAt || "",
        requirementType: row.requirementType || (shiftResolved ? "shift_start" : ""),
        lastReportSemantic: row.lastReportSemantic || (shiftResolved ? overlayActionLabel(log.action) : ""),
        textFull: row.textFull || row.lastReportTextFull || (shiftResolved ? overlayActionMeaning(log.action) : ""),
        status: row.status || (shiftResolved ? "shift_start_ok" : "ok")
      });
      if (rows.length >= limit) break;
    }
    return rows;
  }

  function archivedOverlayLogCount() {
    return mergedOverlayLogs(OVERLAY_LOG_CACHE_LIMIT, { includeArchived: true })
      .filter(log => isArchivedOverlayLog(log))
      .length;
  }

  function logRowFromEvent(log = {}) {
    const row = { ...(log.row || {}) };
    const key = log.rowKey || row.key || rowKey(row);
    const current = [...dueRowsWithKeys(), ...currentRowsWithKeys()].find(item => item.key === key || item.rowKey === key);
    return { ...(current || row), key };
  }

  function operatorSituationText(log = {}, row = {}) {
    const status = shiftDisplayStatus(row);
    const action = log.action || "";
    if (action === "done") return `${status} / lidado ou cobrado pelo operador`;
    if (action === "ignore") return `${status} / ignorado pelo operador`;
    if (action === "delay") return `${status} / adiado por 10 minutos`;
    if (action === "no_response") return `${status} / sem resposta do operador`;
    if (action === "popup_shown") return `${status} / exibido para intervencao`;
    if (action === "message_confirmed") return `${status} / mensagem conferida`;
    if (action === "ai_approve" || action === "ai_correct" || action === "ai_reject") return `${status} / ${overlayActionMeaning(action)}`;
    if (action === "whatsapp_disconnected" || action === "status_fetch") return log.statusText || overlayActionMeaning(action);
    return `${status} / ${overlayActionMeaning(action)}`;
  }

  function logContextHtml(log = {}, row = {}) {
    const tone = overlayActionTone(log.action);
    const operator = [log.operatorUser, log.computerName].filter(Boolean).join(" / ");
    return `
      <div class="log-context ${tone}">
        <strong>${escapeHtml(operatorSituationText(log, row))}</strong>
        <span>${escapeHtml(formatDateTime(log.loggedAt))}${operator ? ` / ${escapeHtml(operator)}` : ""}</span>
      </div>
    `;
  }

  function openLogInQueue(logId) {
    const log = mergedOverlayLogs(160).find(item => item.id === logId);
    if (!log || isStatusLog(log)) return;
    const row = shiftSupervisorMode ? shiftRowFromLog(log) : logRowFromEvent(log);
    state.selectedLogEvent = { ...log, row, rowKey: row.key };
    mobileState.queueTab = "pending";
    mobileState.activeConfirmedKey = "";
    mobileState.activeKey = row.key || "";
    closeLogsModal();
    renderMobileOverlay();
    showToast(operatorSituationText(log, row));
  }

  function renderOverlayLogs() {
    if (!el.overlayLogs && !el.logsBody && !el.inlineLogs) return;
    const displayLimit = shiftSupervisorMode ? 500 : 80;
    const logs = mergedOverlayLogs(displayLimit);
    const archivedCount = archivedOverlayLogCount();
    const emptyLogsText = archivedCount
      ? "Nenhum log vivo nas ultimas 24h. Registros antigos seguem armazenados."
      : shiftSupervisorMode ? "Nenhum log de troca de turno recebido ainda." : "Nenhum log de overlay recebido ainda.";
    const legendHtml = launcherMobileMode ? `
      <div class="logs-legend" aria-label="Legenda dos logs">
        <span class="legend-pill ok">confirmado</span>
        <span class="legend-pill muted">ignorado</span>
        <span class="legend-pill warn">adiado/rever</span>
        <span class="legend-pill info">possivel</span>
        <span class="legend-pill bad">sem resposta</span>
      </div>
    ` : "";
    const html = logs.length
      ? logs.slice(0, 80).map(log => {
          const row = shiftSupervisorMode && !isStatusLog(log) ? shiftRowFromLog(log) : (log.row || {});
          const tone = isDisconnectedStatusLog(log) ? "bad" : overlayActionTone(log.action);
          const meaning = overlayActionMeaning(log.action);
          if (launcherMobileMode) {
            if (log.action === "status_fetch") {
              return `
                <article class="log-entry ${tone}">
                  <div><strong>${escapeHtml(isDisconnectedStatusLog(log) ? "WhatsApp desconectado" : overlayActionLabel(log.action))}</strong><span>${escapeHtml(formatDateTime(log.loggedAt))}</span></div>
                  <em>${escapeHtml(isDisconnectedStatusLog(log) ? "WhatsApp fora do ar" : meaning)}</em>
                  <p>${escapeHtml(log.statusText || "")} / ${escapeHtml(hourLabel(log.currentHourKey))} / esperados ${Number(log.totals?.expected || 0)} / fila ${Number(log.totals?.due || 0)}</p>
                </article>
              `;
            }
            if (log.action === "whatsapp_disconnected") {
              return `
                <article class="log-entry ${tone}">
                  <div><strong>${escapeHtml(overlayActionLabel(log.action))}</strong><span>${escapeHtml(formatDateTime(log.loggedAt))}</span></div>
                  <em>${escapeHtml(meaning)}</em>
                  <p>${escapeHtml(log.statusText || "")} / ${escapeHtml(hourLabel(log.currentHourKey))}</p>
                </article>
              `;
            }
            return `
              <button class="log-entry log-entry-button ${tone}" data-overlay-log-id="${escapeHtml(log.id)}" type="button">
                <div><strong>${escapeHtml(overlayActionLabel(log.action))}</strong><span>${escapeHtml(formatDateTime(log.loggedAt))}</span></div>
                <em>${escapeHtml(operatorSituationText(log, row))}</em>
                <p>${escapeHtml(row.placeName || "Posto")} / ${escapeHtml(row.workerName || row.contactName || "Funcionario")} / ${escapeHtml(shiftDisplayStatus(row))}${shiftSupervisorMode ? ` / ${escapeHtml(shiftLogWindowLabel(log))}` : ""}</p>
              </button>
            `;
          }
          return `
            <article class="item log-card ${tone}">
              <div class="item-header">
                <div>
                  <div class="item-title">${escapeHtml(overlayActionLabel(log.action))} / ${escapeHtml(row.placeName || "Posto")}</div>
                  <div class="item-meta">${escapeHtml(row.workerName || row.contactName || "Funcionario")} / ${escapeHtml(log.computerName || "")} / ${escapeHtml(log.operatorUser || "")}</div>
                </div>
                <span class="tag ${tone === "info" ? "warn" : tone === "neutral" || tone === "muted" ? "" : tone}">${escapeHtml(formatDateTime(log.loggedAt))}</span>
              </div>
              <div class="message">${escapeHtml(meaning)}</div>
              <div class="item-meta">
                Hora: ${escapeHtml(hourLabel(row.hourKey))} / Status: ${escapeHtml(shiftDisplayStatus(row))}
              </div>
            </article>
          `;
        }).join("")
      : `<div class="empty">${emptyLogsText}</div>`;
    if (el.overlayLogs) el.overlayLogs.innerHTML = html;
    if (el.logsBody) el.logsBody.innerHTML = `${legendHtml}${html}`;
    if (el.inlineLogs) {
      el.inlineLogs.innerHTML = logs.length
        ? logs.slice(0, 4).map(log => {
            const row = shiftSupervisorMode && !isStatusLog(log) ? shiftRowFromLog(log) : (log.row || {});
            const title = isStatusLog(log)
              ? log.statusText || "status"
              : `${overlayActionLabel(log.action)} / ${row.placeName || "Posto"}`;
            const detail = isStatusLog(log)
              ? `${hourLabel(log.currentHourKey)} / esperados ${Number(log.totals?.expected || 0)} / fila ${Number(log.totals?.due || 0)}`
              : `${row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || "Funcionario"} / ${operatorSituationText(log, row)}`;
            return `
              <article class="inline-log">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(formatDateTime(log.loggedAt))}</span>
                <p>${escapeHtml(detail)}</p>
              </article>
            `;
          }).join("")
        : `<div class="empty">${escapeHtml(emptyLogsText)}</div>`;
    }
    if (el.inlineLogsInfo) {
      const pendingCount = mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length;
      const pending = pendingCount ? `${pendingCount} pendente(s)` : "ok";
      const archive = archivedCount ? ` / ${archivedCount} arquivado(s) 24h+` : "";
      el.inlineLogsInfo.textContent = `${logs.length} vivo(s) 24h / ${pending}${archive}`;
    }
    if (el.logsSubtitle) {
      const pendingCount = mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length;
      const pending = pendingCount ? ` / ${pendingCount} envio(s) pendente(s)` : "";
      const archive = archivedCount ? ` / ${archivedCount} armazenado(s) fora das 24h` : "";
      const fetchedAt = state.overlayLogsFetchedAt || state.lastFetchedAt || "";
      const fetched = fetchedAt ? formatDateTime(fetchedAt) : "aguardando";
      el.logsSubtitle.textContent = `Busca ${fetched} / ${overlayLogsSourceLabel()} / janela 24h${pending}${archive}`;
    }
  }

  function shiftExportDateFromHourKey(value = "") {
    const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/);
    return match ? match[1] : "";
  }

  function shiftExportDateKey(...values) {
    for (const value of values) {
      const direct = shiftExportDateFromHourKey(value);
      if (direct) return direct;
      const date = new Date(value || 0);
      if (!Number.isNaN(date.getTime()) && date.getTime() > 0) return localDateKey(date);
    }
    return "";
  }

  function shiftExportTimeFromHourKey(value = "") {
    const match = String(value || "").match(/T(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "";
  }

  function shiftExportTime(...values) {
    for (const value of values) {
      const direct = shiftExportTimeFromHourKey(value);
      if (direct) return direct;
      const date = new Date(value || 0);
      if (!Number.isNaN(date.getTime()) && date.getTime() > 0) {
        return date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      }
    }
    return "";
  }

  function shiftExportRowDate(row = {}) {
    return shiftExportDateKey(row.startHourKey, row.hourKey, row.firstReportAt, row.lastReportAt, row.deadlineAt, row.operatorShiftFeedbackAt);
  }

  function shiftExportRowTime(row = {}) {
    return row.startTime || shiftExportTime(row.startHourKey, row.hourKey, row.firstReportAt, row.lastReportAt, row.deadlineAt);
  }

  function shiftExportRowStatus(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    if (feedback) return SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || feedback.action || "resolvido";
    return row.operatorShiftFeedbackLabel || row.lastReportSemantic || statusLabel(row.status);
  }

  function shiftExportShiftKind(row = {}) {
    const kinds = shiftScheduleEvidenceKinds(row);
    if (kinds.has("shift_handoff")) return "Passagem";
    if (kinds.has("shift_end") || isShiftEndRow(row)) return "Saida";
    return "Inicio";
  }

  function shiftExportRecordKey(record = {}) {
    return [
      record.source || "",
      record.dateKey || "",
      record.time || "",
      record.place || "",
      record.worker || "",
      record.rowKey || record.logId || record.manualId || "",
      record.status || "",
      record.detail || ""
    ].join("|");
  }

  function addShiftExportRecord(map, record = {}) {
    if (!record.place && !record.worker && !record.detail) return;
    const key = record.id || safeDocId(shiftExportRecordKey(record));
    if (map.has(key)) return;
    map.set(key, { ...record, id: key });
  }

  function shiftExportStatusRecord(row = {}, source = "status") {
    const people = shiftPeople(row);
    const worker = people.started?.name || row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone || "";
    const left = people.left?.name || "";
    const timing = shiftTimingInfo(row);
    const dateKey = shiftExportRowDate(row);
    const time = shiftExportRowTime(row);
    return {
      id: safeDocId([source, row.key || rowKey(row), row.reportId || row.sourceMessageId || "", dateKey, time].join(":")),
      source,
      kind: shiftExportShiftKind(row),
      dateKey,
      time,
      place: row.placeName || row.groupSubject || "Posto",
      group: row.groupSubject || "",
      worker,
      workerAlt: [left, row.contactName, formatBrazilPhone(row.fromPhone)].filter(Boolean).join(" / "),
      status: shiftExportRowStatus(row),
      detail: [timing.detail || timing.label || "", row.lastReportSemantic || "", rowFullMessage(row)].filter(Boolean).join(" / "),
      rowKey: row.key || rowKey(row),
      archived: false
    };
  }

  function shiftExportScheduleRecord(item = {}, dateKey = "") {
    const worker = [item.leavePerson ? `Sai: ${item.leavePerson}` : "", item.startPerson ? `Entra: ${item.startPerson}` : ""]
      .filter(Boolean)
      .join(" / ") || item.workerName || "";
    return {
      id: safeDocId(["schedule", dateKey, item.key || item.manualId || "", item.placeName || "", item.expectedTime || ""].join(":")),
      source: "escala",
      kind: manualShiftKindLabel(item.shiftKind) || "Turno",
      dateKey,
      time: item.expectedTime || "",
      place: item.placeName || item.groupSubject || "Posto",
      group: item.groupSubject || "",
      worker,
      workerAlt: [item.leavePerson, item.startPerson, item.workerName, formatBrazilPhone(item.fromPhone)].filter(Boolean).join(" / "),
      status: item.statusLabel || "escala",
      detail: [
        item.expectedPeopleCount ? `Equipe esperada: ${item.expectedPeopleCount}` : "",
        item.timingText || "",
        item.ruleText || "",
        (item.sourceTags || []).join(", ")
      ].filter(Boolean).join(" / "),
      scheduleKey: item.key || "",
      manualId: item.manualId || "",
      archived: false
    };
  }

  function shiftExportLogRecord(log = {}) {
    const row = shiftRowFromLog(log);
    const loggedDate = shiftExportDateKey(log.loggedAt, log.updatedAt, log.createdAt, row.lastReportAt, row.firstReportAt);
    const loggedTime = shiftExportTime(log.loggedAt, log.updatedAt, log.createdAt, row.lastReportAt, row.firstReportAt);
    return {
      id: safeDocId(["log", log.id || "", loggedDate, loggedTime, log.action || "", row.key || ""].join(":")),
      source: "log",
      kind: overlayActionLabel(log.action),
      dateKey: loggedDate,
      time: loggedTime,
      place: row.placeName || row.groupSubject || "Posto",
      group: row.groupSubject || "",
      worker: row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || row.fromPhone || "",
      workerAlt: [log.operatorUser, log.computerName].filter(Boolean).join(" / "),
      status: shiftExportRowStatus(row),
      detail: operatorSituationText(log, row),
      rowKey: row.key || rowKey(row),
      logId: log.id || "",
      archived: isArchivedOverlayLog(log)
    };
  }

  function collectShiftExportRecords(dateKey = "") {
    const map = new Map();
    for (const row of shiftRowsFromSlots()) {
      addShiftExportRecord(map, shiftExportStatusRecord(row, "turno"));
    }
    for (const row of confirmedRecentRows(confirmedFetchLimit * 4)) {
      if (isShiftRelatedRow(row)) addShiftExportRecord(map, shiftExportStatusRecord(row, "confirmado"));
    }
    for (const row of shiftConfirmedRows(confirmedFetchLimit * 4)) {
      addShiftExportRecord(map, shiftExportStatusRecord(row, "resolvido"));
    }
    for (const item of shiftScheduleRows()) {
      addShiftExportRecord(map, shiftExportScheduleRecord(item, dateKey || localDateKey(new Date())));
    }
    for (const log of mergedOverlayLogs(OVERLAY_LOG_CACHE_LIMIT, { includeArchived: true })) {
      if (!isStatusLog(log) && isShiftLog(log)) addShiftExportRecord(map, shiftExportLogRecord(log));
    }
    return [...map.values()].sort((a, b) =>
      String(a.dateKey || "").localeCompare(String(b.dateKey || "")) ||
      String(a.time || "").localeCompare(String(b.time || "")) ||
      String(a.place || "").localeCompare(String(b.place || ""), "pt-BR") ||
      String(a.worker || "").localeCompare(String(b.worker || ""), "pt-BR") ||
      String(a.source || "").localeCompare(String(b.source || ""), "pt-BR")
    );
  }

  function shiftExportFilters() {
    return {
      date: String(el.shiftExportDate?.value || "").trim(),
      place: String(el.shiftExportPlace?.value || "").trim(),
      worker: String(el.shiftExportWorker?.value || "").trim()
    };
  }

  function shiftExportMatches(record = {}, filters = {}) {
    if (filters.date && record.dateKey !== filters.date) return false;
    const placeNeedle = normalizeLookup(filters.place);
    const workerNeedle = normalizeLookup(filters.worker);
    const workerDigits = phoneDigits(filters.worker);
    const placeHaystack = normalizeLookup([record.place, record.group, record.detail].join(" "));
    const workerHaystack = normalizeLookup([record.worker, record.workerAlt, record.detail].join(" "));
    const workerDigitHaystack = phoneDigits([record.worker, record.workerAlt, record.detail].join(" "));
    if (placeNeedle && !placeHaystack.includes(placeNeedle)) return false;
    if (workerNeedle && !workerHaystack.includes(workerNeedle)) {
      if (!workerDigits || !workerDigitHaystack.includes(workerDigits)) return false;
    }
    return true;
  }

  function filteredShiftExportRecords() {
    const filters = shiftExportFilters();
    const dateKey = filters.date || localDateKey(new Date());
    return collectShiftExportRecords(dateKey).filter(record => shiftExportMatches(record, filters));
  }

  function updateShiftExportWorkerOptions(records = []) {
    if (!el.shiftExportWorkerOptions) return;
    const names = [...new Set(records.flatMap(record => [record.worker, record.workerAlt]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
      .slice(0, 240);
    el.shiftExportWorkerOptions.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
  }

  function shiftExportRecordShiftKind(record = {}) {
    const kind = normalizeLookup(record.kind);
    if (kind.includes("saida")) return "shift_end";
    if (kind.includes("passagem")) return "shift_handoff";
    return "shift_start";
  }

  function shiftExportWorkerForEdit(record = {}) {
    const value = String(record.worker || record.workerAlt || "").trim();
    const shiftKind = shiftExportRecordShiftKind(record);
    const startMatch = value.match(/(?:^|\/)\s*Entra:\s*([^/]+)/i);
    const leaveMatch = value.match(/(?:^|\/)\s*Sai:\s*([^/]+)/i);
    const selected = shiftKind === "shift_end" ? (leaveMatch?.[1] || "") : (startMatch?.[1] || "");
    const text = selected || value.split("/")[0] || "";
    const worker = text
      .replace(/^\s*(Sai|Entra):\s*/i, "")
      .trim();
    return normalizeLookup(worker) === "a declarar" ? "" : worker;
  }

  function shiftExportRecordEditPattern(record = {}) {
    return [
      `Correcao declarada pelo export de turnos (${localDateLabel(record.dateKey)} ${record.time || "--"}).`,
      `Fonte original: ${record.source || "turno"} / ${record.status || "sem status"}.`,
      record.detail ? `Detalhe preservado: ${record.detail}` : "",
      record.group ? `Grupo: ${record.group}` : ""
    ].filter(Boolean).join("\n");
  }

  function startShiftExportRecordEdit(recordId = "") {
    const filters = shiftExportFilters();
    const dateKey = filters.date || localDateKey(new Date());
    const record = state.shiftExportRecordLookup.get(String(recordId || "")) ||
      collectShiftExportRecords(dateKey).find(item => String(item.id || "") === String(recordId || ""));
    if (!record) return;
    if (record.source === "escala" && record.manualId) {
      startManualPlaceEdit(record.manualId);
      state.shiftExportStatus = "Edite a escala e salve para aplicar na operacao.";
      renderShiftExport();
      return;
    }
    clearManualPlaceForm();
    state.manualPlaceInfoOpen = true;
    state.manualPlaceInfoEditingKey = "";
    state.manualPlaceInfoStatus = `Editando registro de ${record.place || "posto"} pelo export.`;
    if (el.manualPlaceName) el.manualPlaceName.value = record.place || record.group || "";
    if (el.manualWorkerName) el.manualWorkerName.value = shiftExportWorkerForEdit(record);
    if (el.manualRuleScope) el.manualRuleScope.value = shiftExportWorkerForEdit(record) ? "place_worker_shift" : "place_shift";
    if (el.manualShiftKind) el.manualShiftKind.value = shiftExportRecordShiftKind(record);
    if (el.manualPlaceStartTime) el.manualPlaceStartTime.value = normalizeScheduleTime(record.time || "") || "";
    if (el.manualPlacePatternText) el.manualPlacePatternText.value = shiftExportRecordEditPattern(record);
    state.shiftExportStatus = "Altere o registro no formulario e salve para o bridge reprocessar a operacao.";
    renderManualPlaceInfo();
    renderShiftExport();
    try {
      el.manualPlaceInfoBox?.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
      // Older WebViews may not support scroll options.
    }
    try {
      el.manualPlacePatternText?.focus({ preventScroll: true });
    } catch {
      el.manualPlacePatternText?.focus();
    }
  }

  function shiftExportRecordHtml(record = {}) {
    const tone = record.archived ? "warn" : record.source === "resolvido" || record.status === "Sem novidades" ? "ok" : record.source === "log" ? "info" : "";
    return `
      <article class="shift-export-item">
        <div class="item-header">
          <div>
            <div class="item-title">${escapeHtml(record.place || "Posto")}</div>
            <div class="item-meta">${escapeHtml([localDateLabel(record.dateKey), record.time, record.kind].filter(Boolean).join(" / "))}</div>
          </div>
          <span class="tag ${escapeHtml(tone)}">${escapeHtml(record.archived ? "arquivado" : record.source || "turno")}</span>
        </div>
        <div class="message">${escapeHtml(record.worker || record.workerAlt || "Funcionario nao informado")}</div>
        <div class="item-meta">${escapeHtml(record.status || "sem status")}${record.detail ? ` / ${escapeHtml(record.detail)}` : ""}</div>
        <div class="shift-export-actions">
          <button type="button" data-shift-export-edit="${escapeHtml(record.id)}">Editar e aplicar na operacao</button>
        </div>
      </article>
    `;
  }

  function renderShiftExport() {
    if (!el.shiftExportResults || !el.shiftExportSummary) return;
    const filters = shiftExportFilters();
    const dateKey = filters.date || localDateKey(new Date());
    const allRecords = collectShiftExportRecords(dateKey);
    const rows = allRecords.filter(record => shiftExportMatches(record, filters));
    state.shiftExportRecordLookup = new Map(rows.map(record => [String(record.id || ""), record]));
    updateShiftExportWorkerOptions(allRecords);
    const archivedCount = rows.filter(row => row.archived).length;
    const logCount = rows.filter(row => row.source === "log").length;
    const scheduleCount = rows.filter(row => row.source === "escala").length;
    el.shiftExportSummary.innerHTML = [
      `<span class="tag info">${escapeHtml(`${rows.length} registro(s)`)}</span>`,
      `<span class="tag">${escapeHtml(localDateLabel(filters.date || dateKey))}</span>`,
      `<span class="tag">${escapeHtml(`${logCount} log(s)`)}</span>`,
      `<span class="tag">${escapeHtml(`${scheduleCount} escala(s)`)}</span>`,
      archivedCount ? `<span class="tag warn">${escapeHtml(`${archivedCount} arquivado(s)`)}</span>` : ""
    ].filter(Boolean).join("");
    if (el.shiftExportStatus) {
      const pendingCount = mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length;
      const pendingText = pendingCount ? ` / ${pendingCount} pendente(s) de envio` : "";
      el.shiftExportStatus.textContent = state.shiftExportStatus || `Busca usa dados carregados e logs armazenados${pendingText}.`;
    }
    el.shiftExportResults.innerHTML = rows.length
      ? rows.slice(0, SHIFT_EXPORT_PREVIEW_LIMIT).map(shiftExportRecordHtml).join("") +
        (rows.length > SHIFT_EXPORT_PREVIEW_LIMIT ? `<div class="empty">Mostrando ${SHIFT_EXPORT_PREVIEW_LIMIT} de ${rows.length}. O PDF usa ate ${SHIFT_EXPORT_PDF_LIMIT} registros filtrados.</div>` : "")
      : `<div class="empty">Nenhum turno encontrado com os filtros atuais.</div>`;
    el.shiftExportResults.querySelectorAll("[data-shift-export-edit]").forEach(button => {
      button.addEventListener("click", () => startShiftExportRecordEdit(button.getAttribute("data-shift-export-edit") || ""));
    });
  }

  function addShiftPdfText(doc, text, x, y, width, options = {}) {
    const lines = doc.splitTextToSize(String(text || ""), width);
    doc.text(lines, x, y, options);
    return y + (lines.length * 11);
  }

  async function refreshShiftExportSearch() {
    if (!el.shiftExportResults) return;
    if (el.shiftExportSearch) el.shiftExportSearch.disabled = true;
    state.shiftExportStatus = "Atualizando logs armazenados para a busca...";
    renderShiftExport();
    try {
      await refreshOverlayLogsOnce({ recovery: true });
      state.shiftExportStatus = "Busca atualizada com logs armazenados.";
    } catch {
      state.shiftExportStatus = "Busca usando os dados ja carregados; nao foi possivel atualizar logs agora.";
    }
    if (el.shiftExportSearch) el.shiftExportSearch.disabled = false;
    renderShiftExport();
  }

  async function exportShiftPdf() {
    if (!el.shiftExportPdf) return;
    el.shiftExportPdf.disabled = true;
    state.shiftExportStatus = "Atualizando logs antes do PDF...";
    renderShiftExport();
    try {
      await refreshOverlayLogsOnce({ recovery: true });
    } catch {
      // Keep exporting with cached logs when the bridge or Firestore is unavailable.
    }
    const records = filteredShiftExportRecords();
    if (!records.length) {
      state.shiftExportStatus = "Nenhum registro filtrado para exportar.";
      el.shiftExportPdf.disabled = false;
      renderShiftExport();
      return;
    }
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      state.shiftExportStatus = "Gerador PDF indisponivel neste navegador.";
      el.shiftExportPdf.disabled = false;
      renderShiftExport();
      return;
    }
    const filters = shiftExportFilters();
    const exportRows = records.slice(0, SHIFT_EXPORT_PDF_LIMIT);
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const ensurePage = height => {
      if (y + height <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("TKA Monitoramento - Turnos", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y = addShiftPdfText(doc, [
      `Gerado em: ${formatDateTime(new Date().toISOString())}`,
      `Data: ${localDateLabel(filters.date || localDateKey(new Date()))}`,
      `Posto: ${filters.place || "todos"}`,
      `Funcionario: ${filters.worker || "todos"}`,
      `Registros: ${exportRows.length}${records.length > exportRows.length ? ` de ${records.length}` : ""}`,
      "Logs com mais de 24h permanecem armazenados e aparecem como arquivados quando entram no filtro."
    ].join(" | "), margin, y, contentWidth);
    y += 8;
    doc.setDrawColor(216, 222, 232);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    for (const record of exportRows) {
      const header = `${localDateLabel(record.dateKey)} ${record.time || "--"} | ${record.kind || "Turno"} | ${record.place || "Posto"}`;
      const body = [
        `Funcionario: ${record.worker || record.workerAlt || "nao informado"}`,
        `Status: ${record.status || "sem status"} | Fonte: ${record.source || "turno"}${record.archived ? " | arquivado 24h+" : ""}`,
        record.detail ? `Detalhe: ${record.detail}` : ""
      ].filter(Boolean).join("\n");
      const lineCount = doc.splitTextToSize(`${header}\n${body}`, contentWidth).length;
      ensurePage(24 + lineCount * 11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      y = addShiftPdfText(doc, header, margin, y, contentWidth);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      y = addShiftPdfText(doc, body, margin, y + 2, contentWidth);
      y += 7;
      doc.setDrawColor(232, 236, 243);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Pagina ${page}/${pageCount}`, pageWidth - margin - 54, pageHeight - 18);
    }
    const fileDate = filters.date || localDateKey(new Date());
    doc.save(`turnos-monitoramento-${fileDate}.pdf`);
    state.shiftExportStatus = `PDF gerado com ${exportRows.length} registro(s).`;
    el.shiftExportPdf.disabled = false;
    renderShiftExport();
  }

  function renderConnection() {
    const health = state.health || {};
    const status = state.status || {};
    const current = status.current || {};
    const totals = status.current?.totals || health.monitoring?.totals || {};
    const hasPublication = Boolean(state.lastUpdatedAt);
    const stale = hasPublication && isStale();
    const dashboard = health.dashboard || {};
    const monitoring = status.monitoring || health.monitoring || {};
    const connectedTone = health.connected ? "ok" : health.qrRequired ? "bad" : "warn";
    const connectedText = !hasPublication ? "aguardando" : health.connected ? "conectado" : health.qrRequired ? "QR pendente" : connectionStateShort();
    const sourceText = state.source === "local" ? "local" : state.source === "public_bridge" ? "bridge" : state.source === "cloud" ? "publicado" : "fonte";
    const fullStatusText = state.lastError
      ? state.lastError
      : !hasPublication
        ? "Aguardando publicacao live do bridge..."
        : `${sourceText} ${formatDateTime(state.lastUpdatedAt)} / fetch ${formatDateTime(state.lastFetchedAt)} / atualiza a cada ${Math.round(LIVE_FETCH_INTERVAL_MS / 1000)}s / hora ${hourLabel(status.currentHourKey || health.monitoring?.currentHourKey)} / antecipacao ${monitoring.earlyInformMinutes || 0} min / escala ${dashboard.authoritative ? `atualizada ${formatDateTime(dashboard.loadedAt)}` : "em fallback"}`;
    const compactSourceText = sourceLineText();

    if (el.connectionPanel) {
      el.connectionPanel.innerHTML = `
        <article class="metric ${state.lastError ? "bad" : !hasPublication ? "" : stale ? "warn" : "ok"}"><span>Publicacao</span><strong>${state.lastError ? "erro" : !hasPublication ? "carregando" : stale ? "atrasada" : "ativa"}</strong></article>
        <article class="metric ${connectedTone}"><span>WhatsApp</span><strong>${escapeHtml(connectedText)}</strong></article>
        <article class="metric"><span>Esperados agora</span><strong>${totals.expected || 0}</strong></article>
        <article class="metric ${totals.due ? "bad" : "ok"}"><span>Intervencoes</span><strong>${totals.due || 0}</strong></article>
        <article class="metric ${!hasPublication ? "" : dashboard.authoritative ? "ok" : "warn"}"><span>Escala RH</span><strong>${!hasPublication ? "carregando" : dashboard.authoritative ? "agenda" : "perfil"}</strong></article>
      `;
    }
    if (el.pageMeta) el.pageMeta.textContent = fullStatusText;
    if (el.sourceInfo) el.sourceInfo.textContent = compactSourceText;
    if (el.hourLabel) el.hourLabel.textContent = hourLabel(status.currentHourKey || current.hourKey || health.monitoring?.currentHourKey);
    if (el.expectedCount) el.expectedCount.textContent = String(totals.expected || 0);
    const visibleDueCount = visiblePendingDueRows().length;
    if (el.dueCount) el.dueCount.textContent = String(operationalMode ? visibleDueCount : (totals.due || 0));
    if (el.queueCount) el.queueCount.textContent = String(visibleDueCount);
    renderSummaryDropdown();
    renderQrPairingPanel();
  }

  function renderQrPairingPanel() {
    if (!el.qrPairingPanel) return;
    const health = state.health || {};
    const qrDataUrl = String(health.qrDataUrl || "");
    const showQr = Boolean(adminTrainingMode && health.qrRequired && qrDataUrl);
    el.qrPairingPanel.hidden = !showQr;
    if (!showQr) {
      el.qrPairingPanel.innerHTML = "";
      return;
    }
    el.qrPairingPanel.innerHTML = `
      <div class="qr-pairing-content">
        <div>
          <h2>QR do Monitoramento Bridge</h2>
          <p class="muted">Abra o WhatsApp da empresa, entre em Aparelhos conectados e leia este QR para religar o Monitoramento.</p>
          <div class="tag-row">
            <span class="tag warn">QR pendente</span>
            ${health.qrUpdatedAt ? `<span class="tag">gerado ${escapeHtml(formatDateTime(health.qrUpdatedAt))}</span>` : ""}
          </div>
        </div>
        <img class="qr-pairing-image" src="${escapeHtml(qrDataUrl)}" alt="QR do WhatsApp Monitoramento">
      </div>
    `;
  }

  function aiSuggestionTone(suggestion = {}) {
    if (!suggestion) return "muted";
    if (!suggestion.enabled) return "muted";
    if (suggestion.lane === "worker_mapping_candidate" || suggestion.lane === "safe_confirmation_review") return "ok";
    if (suggestion.lane === "text_classification") return "warn";
    return "info";
  }

  function aiFeedbackStatusText(row = {}) {
    const status = aiFeedbackResolutionForRow(row);
    if (!status) return "";
    if (status.action === "approve") return "Aprovada neste aparelho";
    if (status.action === "correct") return "Corrigida neste aparelho";
    if (status.action === "reject") return "Rejeitada neste aparelho";
    return "";
  }

  function aiSuggestionHtml(row = {}, options = {}) {
    if (!adminTrainingMode) return "";
    const suggestion = aiSuggestionForRow(row);
    if (!suggestion) return "";
    const readonly = Boolean(options.readonly);
    const tone = aiSuggestionTone(suggestion);
    const statusText = aiFeedbackStatusText(row);
    const disabled = readonly;
    const feedbackRowKey = row.key || rowKey(row);
    return `
      <div class="ai-suggestion ${tone}" data-ai-row-key="${escapeHtml(feedbackRowKey)}">
        <div>
          <strong>${escapeHtml(suggestion.title)}</strong>
          <span>${escapeHtml(suggestion.summary || suggestion.recommendation || "Sugestao assistida para revisao do operador.")}</span>
        </div>
        ${suggestion.recommendation ? `<p>${escapeHtml(suggestion.recommendation)}</p>` : ""}
        ${statusText ? `<em>${escapeHtml(statusText)}</em>` : ""}
        <div class="ai-feedback-actions">
          <button type="button" data-ai-feedback="approve" data-ai-row-key="${escapeHtml(feedbackRowKey)}" ${disabled ? "disabled" : ""}>Aprovar</button>
          <button type="button" data-ai-feedback="correct" data-ai-row-key="${escapeHtml(feedbackRowKey)}" ${disabled ? "disabled" : ""}>Corrigir</button>
          <button type="button" data-ai-feedback="reject" data-ai-row-key="${escapeHtml(feedbackRowKey)}" ${readonly ? "disabled" : ""}>Rejeitar</button>
        </div>
      </div>
    `;
  }

  function rowCard(row, compact = false) {
    if (isResolvedLogRow(row)) {
      const log = row.__resolvedLog;
      const tone = overlayActionTone(log.action);
      return `
        <article class="item log-card ${tone}">
          <div class="item-header">
            <div>
              <div class="item-title">${escapeHtml(overlayActionLabel(log.action))} / ${escapeHtml(row.placeName || "Posto")}</div>
              <div class="item-meta">${escapeHtml(row.workerName || row.contactName || formatBrazilPhone(row.fromPhone) || "Funcionario")} / ${escapeHtml(log.operatorUser || log.computerName || "operador")}</div>
            </div>
            <span class="tag ${tone === "neutral" || tone === "muted" ? "" : tone}">${escapeHtml(formatDateTime(log.loggedAt) || "sem horario")}</span>
          </div>
          <div class="message">${escapeHtml(operatorSituationText(log, row))}</div>
          <div class="item-meta">Log vivo 24h / ${escapeHtml(overlayActionMeaning(log.action))}</div>
        </article>
      `;
    }

    const tone = statusTone(row.status);
    const identity = identityDetail(row);
    const conflict = conflictDetail(row);
    return `
      <article class="item">
        <div class="item-header">
          <div>
            <div class="item-title">${escapeHtml(row.workerName || "Funcionario")} / ${escapeHtml(row.placeName || "Posto")}</div>
            <div class="item-meta">${escapeHtml(row.role || "sem funcao")} / ${escapeHtml(row.scale || "sem escala")}</div>
          </div>
          <span class="tag ${tone}">${escapeHtml(statusLabel(row.status))}</span>
        </div>
        <div class="tag-row">
          <span class="tag">${hourLabel(row.hourKey)}</span>
          ${row.requirementType === "shift_start" ? `<span class="tag warn">inicio de turno</span>` : ""}
          ${row.startTime ? `<span class="tag">inicio ${escapeHtml(row.startTime)}</span>` : ""}
          ${row.hasMedia ? `<span class="tag ok">midia enviada</span>` : ""}
          ${row.lateMinutes ? `<span class="tag ${tone}">${row.lateMinutes} min</span>` : ""}
          ${row.identityResolved === false ? `<span class="tag warn">identidade pendente</span>` : ""}
          ${row.liveConflict ? `<span class="tag warn">escala divergente</span>` : ""}
        </div>
        <div class="message">${escapeHtml(actionForRow(row))}</div>
        ${adminTrainingMode ? messageEvidenceHtml(row) : ""}
        ${aiSuggestionHtml(row, { readonly: isConfirmedStatus(row.status) })}
        <div class="item-meta">
          ${identity ? `${escapeHtml(identity)}<br>` : ""}
          ${conflict ? `${escapeHtml(conflict)}<br>` : ""}
          Prazo: ${formatDateTime(row.deadlineAt)}<br>
          Ultimo informe: ${row.lastReportAt ? `${formatDateTime(row.lastReportAt)} / ${escapeHtml(row.lastReportSemantic || "")}` : "nenhum"}<br>
          Padrao: ${escapeHtml(row.learnedWindow || row.observedWindow || "sem janela estavel")}
        </div>
      </article>
    `;
  }

  function mobilePopupHtml(row, options = {}) {
    const contextLog = options.contextLog || null;
    if (!row) {
      clearTimeout(mobileState.noResponseTimer);
      if (launcherMobileMode) {
        if (connectionNeedsAttention()) {
          return `
            <div class="popup-empty status-alert">
              <strong>${escapeHtml(connectionStateText())}</strong>
              <span>${escapeHtml(state.health?.lastError || state.lastError || "Sem intervencoes porque a fonte nao esta plenamente conectada.")}</span>
            </div>
          `;
        }
        return `<div class="popup-empty">Nenhuma intervencao pendente agora.</div>`;
      }
      return `
        <div class="mobile-popup-empty">
          <strong>Nenhuma intervencao pendente agora.</strong>
          <span>Quando houver algo a cobrar, aparece aqui com os botoes de acao.</span>
        </div>
      `;
    }

    mobileState.activeKey = row.key;
    if (contextLog) {
      clearTimeout(mobileState.noResponseTimer);
    } else {
      markMobilePopupShown(row);
      scheduleMobileNoResponse(row);
    }

    const tone = statusTone(row.status);
    const identity = identityLine(row);
    const conflict = conflictDetail(row);
    const context = contextLog ? logContextHtml(contextLog, row) : "";
    const readonlyLog = contextLog && isResolvedOverlayLog(contextLog);
    const closeButton = contextLog ? `<button class="preview-close" data-clear-log-preview="1" type="button" aria-label="Fechar log">x</button>` : "";
    if (launcherMobileMode) {
      return `
        <div class="popup-head">
          <span class="tag ${row.identityResolved === false ? "warn" : tone}">${escapeHtml(statusLabel(row.status))}</span>
          <span class="muted">${escapeHtml(hourLabel(row.hourKey))}</span>
          ${closeButton}
        </div>
        <h2>${escapeHtml(row.placeName || "Posto")}</h2>
        <p class="worker">${escapeHtml(identity)}</p>
        ${context}
        <p class="reason">${escapeHtml(actionForRow(row))}</p>
        ${adminTrainingMode ? messageEvidenceHtml(row) : ""}
        ${aiSuggestionHtml(row, { readonly: readonlyLog || Boolean(contextLog) })}
        <div class="meta">
          <span>Ultimo informe: ${escapeHtml(row.lastReportAt ? `${formatDateTime(row.lastReportAt)} / ${row.lastReportSemantic || ""}` : "nenhum")}</span>
          <span>Prazo: ${escapeHtml(formatDateTime(row.deadlineAt) || "sem prazo")}</span>
          ${row.requirementType === "shift_start" ? `<span>Inicio previsto: ${escapeHtml(row.startTime || hourLabel(row.startHourKey || row.hourKey))}</span>` : ""}
          ${conflict ? `<span>${escapeHtml(conflict)}</span>` : ""}
        </div>
        <div class="popup-actions ${readonlyLog ? "single" : ""}">
          ${readonlyLog ? `<button class="action" data-clear-log-preview="1" type="button">Fechar</button>` : `
          <button class="action done" data-mobile-action="done" type="button">Feito</button>
          <button class="action ignore" data-mobile-action="ignore" type="button">Ignorar</button>
          <button class="action delay" data-mobile-action="delay" type="button">Adiar 10 min</button>
          `}
        </div>
      `;
    }
    return `
      <article class="mobile-popup-card ${tone || "warn"}">
        <div class="mobile-popup-head">
          <span class="tag ${tone}">${escapeHtml(statusLabel(row.status))}</span>
          <span class="mobile-hour">${escapeHtml(hourLabel(row.hourKey))}</span>
          ${closeButton}
        </div>
        <h2>${escapeHtml(row.placeName || "Posto")}</h2>
        <p class="mobile-worker">${escapeHtml(identity)}</p>
        ${context}
        <p class="mobile-reason">${escapeHtml(actionForRow(row))}</p>
        ${adminTrainingMode ? messageEvidenceHtml(row) : ""}
        ${aiSuggestionHtml(row, { readonly: readonlyLog || Boolean(contextLog) })}
        <div class="mobile-detail-grid">
          <span><b>Ultimo informe</b>${escapeHtml(row.lastReportAt ? `${formatDateTime(row.lastReportAt)} / ${row.lastReportSemantic || ""}` : "nenhum")}</span>
          <span><b>Prazo</b>${escapeHtml(formatDateTime(row.deadlineAt) || "sem prazo")}</span>
          ${row.requirementType === "shift_start" ? `<span><b>Inicio previsto</b>${escapeHtml(row.startTime || hourLabel(row.startHourKey || row.hourKey))}</span>` : ""}
          ${conflict ? `<span><b>Conflito</b>${escapeHtml(conflict)}</span>` : ""}
        </div>
        <div class="mobile-popup-actions ${readonlyLog ? "single" : ""}">
          ${readonlyLog ? `<button class="mobile-action" data-clear-log-preview="1" type="button">Fechar</button>` : `
          <button class="mobile-action done" data-mobile-action="done" type="button">Feito</button>
          <button class="mobile-action ignore" data-mobile-action="ignore" type="button">Ignorar</button>
          <button class="mobile-action delay" data-mobile-action="delay" type="button">Adiar 10 min</button>
          `}
        </div>
      </article>
    `;
  }

  function confirmedPreviewHtml(row) {
    if (isResolvedLogRow(row)) {
      return mobilePopupHtml(row, { contextLog: row.__resolvedLog });
    }

    const identity = identityLine(row, { includePhone: false });
    const message = rowFullMessage(row);
    const media = row.hasMedia ? ` / ${row.mediaKind || "midia"}` : "";
    const alreadyConfirmed = isConfirmedManually(row);
    if (launcherMobileMode) {
      return `
        <div class="popup-head">
          <span class="tag ok">confirmado</span>
          <button class="preview-close" data-close-confirmed-preview="1" type="button" aria-label="Fechar mensagem">x</button>
        </div>
        <h2>${escapeHtml(row.placeName || "Posto")}</h2>
        <p class="worker">${escapeHtml(identity)}</p>
        <p class="reason confirmed-message">${escapeHtml(message || "Mensagem confirmada sem texto.")}</p>
        <div class="meta">
          <span>Horario informado: ${escapeHtml(informedHourText(row))}</span>
          <span>Recebido: ${escapeHtml(formatDateTime(row.lastReportAt) || "sem horario")}${escapeHtml(media)}</span>
          <span>Entendimento: ${escapeHtml(row.lastReportSemantic || statusLabel(row.status))}</span>
          ${row.groupSubject ? `<span>Grupo: ${escapeHtml(row.groupSubject)}</span>` : ""}
        </div>
        <div class="popup-actions single">
          <button class="action done" data-confirm-confirmed-message="1" type="button" ${alreadyConfirmed ? "disabled" : ""}>${alreadyConfirmed ? "Mensagem confirmada" : "Confirmar mensagem"}</button>
        </div>
      `;
    }
    return `
      <article class="mobile-popup-card ok">
        <div class="mobile-popup-head">
          <span class="tag ok">confirmado</span>
          <button class="preview-close" data-close-confirmed-preview="1" type="button" aria-label="Fechar mensagem">x</button>
        </div>
        <h2>${escapeHtml(row.placeName || "Posto")}</h2>
        <p class="mobile-worker">${escapeHtml(identity)}</p>
        <p class="mobile-reason confirmed-message">${escapeHtml(message || "Mensagem confirmada sem texto.")}</p>
        <div class="mobile-detail-grid">
          <span><b>Horario informado</b>${escapeHtml(informedHourText(row))}</span>
          <span><b>Recebido</b>${escapeHtml(formatDateTime(row.lastReportAt) || "sem horario")}</span>
        </div>
        <div class="mobile-popup-actions">
          <button class="mobile-action done" data-confirm-confirmed-message="1" type="button" ${alreadyConfirmed ? "disabled" : ""}>${alreadyConfirmed ? "Mensagem confirmada" : "Confirmar mensagem"}</button>
        </div>
      </article>
    `;
  }

  function shiftPersonFromRow(row = {}) {
    const name = row.workerName || row.contactName || "";
    const phone = row.fromPhone || "";
    if (!name && !phone) return null;
    return {
      name,
      phone,
      place: row.placeName || "",
      detail: row.workerName && row.contactName && row.contactName !== row.workerName ? `Contato: ${row.contactName}` : ""
    };
  }

  function shiftConflictPerson(row = {}) {
    const workers = Array.isArray(row.liveConflictWorkers) ? row.liveConflictWorkers : [];
    const person = workers.find(item => item.workerName || item.contactName || item.fromPhone);
    if (!person) return null;
    return {
      name: person.workerName || person.contactName || "",
      phone: person.fromPhone || "",
      place: row.placeName || "",
      detail: person.identityResolved === false ? "identidade pendente" : "evidencia no grupo"
    };
  }

  function shiftOutgoingPerson(row = {}) {
    const outgoing = row.outgoingWorker || {};
    const name = outgoing.workerName || row.outgoingWorkerName || outgoing.contactName || row.outgoingContactName || "";
    const phone = outgoing.fromPhone || row.outgoingFromPhone || "";
    if (!name && !phone) return null;
    const lastReportAt = outgoing.lastReportAt || row.outgoingLastReportAt || "";
    const semantic = outgoing.lastReportSemantic || row.outgoingLastReportSemantic || "";
    const details = [];
    if (lastReportAt) details.push(`ultimo informe: ${formatDateTime(lastReportAt)}`);
    if (semantic) details.push(semantic);
    if (!details.length && outgoing.identityResolved === false) details.push("identidade pendente");
    return {
      name,
      phone,
      place: row.placeName || "",
      detail: details.join(" / ")
    };
  }

  function shiftPeople(row = {}) {
    if (isShiftEndRow(row)) {
      const learnedNoStart = row.shiftStartExpectedAtHour === false;
      return {
        left: shiftPersonFromRow(row),
        started: learnedNoStart ? {
          name: "Sem inicio esperado",
          phone: "",
          omitPhone: true,
          place: row.placeName || "",
          detail: row.shiftStartLearningSummary || "padrao aprendido"
        } : null
      };
    }
    return {
      left: shiftOutgoingPerson(row) || shiftConflictPerson(row),
      started: shiftPersonFromRow(row)
    };
  }

  function shiftPersonHtml(label, person, emptyText) {
    const phone = formatBrazilPhone(person?.phone) || person?.phone || "";
    return `
      <div class="shift-person">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(person?.name || emptyText)}</strong>
        ${person?.omitPhone ? "" : `<em>${escapeHtml(phone || "telefone nao informado")}</em>`}
        <small>${escapeHtml(person?.place || "posto nao informado")}${person?.detail ? ` / ${escapeHtml(person.detail)}` : ""}</small>
      </div>
    `;
  }

  function shiftFeedbackActionsHtml(row = {}) {
    if (!row) return "";
    const active = shiftFeedbackForRow(row);
    const key = row.key || rowKey(row);
    const items = Object.entries(SHIFT_FEEDBACK_ACTIONS).map(([action, meta]) => {
      const selected = active?.action === action;
      const label = selected ? `${meta.label} registrado` : meta.label;
      return `
        <button class="action ${meta.tone} ${selected ? "selected" : ""}" data-shift-feedback="${escapeHtml(action)}" data-shift-row-key="${escapeHtml(key)}" type="button" ${selected ? "disabled" : ""}>
          ${escapeHtml(label)}
        </button>
      `;
    }).join("");
    return `<div class="popup-actions shift-feedback-actions">${items}</div>`;
  }

  function shiftDeclarationBannerHtml(row = {}) {
    if (isShiftResolvedByFeedback(row)) return "";
    const info = shiftEscalationInfo(row);
    if (info.level === "ok") return "";
    const gaps = (info.gaps || []).length ? info.gaps.join(" / ") : "declaracao de turno pendente";
    return `
      <div class="shift-declaration-banner ${escapeHtml(info.level)}">
        <strong>${escapeHtml(info.label)}</strong>
        <span>${escapeHtml(info.detail)}</span>
        <small>${escapeHtml(gaps)}</small>
      </div>
    `;
  }

  function shiftExpectedStart(row = {}) {
    if (row.shiftStartExpectedAtHour === false) return "sem inicio esperado";
    return row.startTime || hourLabel(row.startHourKey || row.hourKey);
  }

  function shiftDeadlineText(row = {}) {
    if (row.shiftStartExpectedAtHour === false) return "sem prazo de inicio";
    return formatDateTime(row.deadlineAt) || "sem prazo";
  }

  function shiftFinishedText(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    if (feedback) return `${SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || "decisao"} registrada`;
    if (isShiftEndRow(row)) return formatDateTime(row.lastReportAt || row.firstReportAt) || "saida informada";
    if (isConfirmedStatus(row.status)) return "nao informado nesta mensagem";
    return "aguardando confirmacao";
  }

  function shiftExpectedDateTime(row = {}) {
    const expected = shiftExpectedDate(row);
    return expected ? formatDateTime(expected.toISOString()) : "";
  }

  function shiftExpectedDisplay(row = {}) {
    const label = shiftExpectedStart(row) || "";
    const exact = shiftExpectedDateTime(row);
    return [label, exact && exact !== label ? exact : ""].filter(Boolean).join(" / ") || "nao informado";
  }

  function shiftMessageDateTime(row = {}) {
    return formatDateTime(row.lastReportAt || row.firstReportAt || row.lastEvidenceAt) || "";
  }

  function shiftFeedbackDateTime(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    return feedback?.feedback?.loggedAt ||
      feedback?.feedback?.at ||
      row.operatorShiftFeedbackAt ||
      row.operatorShiftResolvedAt ||
      "";
  }

  function shiftConfirmationText(row = {}) {
    const feedback = shiftFeedbackForRow(row);
    const feedbackAt = shiftFeedbackDateTime(row);
    if (feedback) {
      const label = SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || feedback.action || "decisao";
      return `${label}${feedbackAt ? ` em ${formatDateTime(feedbackAt)}` : " sem horario"}`;
    }
    if (isConfirmedStatus(row.status)) {
      const receivedAt = row.lastReportAt || row.firstReportAt || "";
      return `${statusLabel(row.status)}${receivedAt ? ` em ${formatDateTime(receivedAt)}` : " sem horario"}`;
    }
    return "aguardando confirmacao";
  }

  function shiftRowsMatch(candidate = {}, row = {}) {
    if (!candidate || !row) return false;
    return shiftFeedbackEventMatchesRow({
      row: candidate,
      rowKey: candidate.key || candidate.rowKey || rowKey(candidate),
      reportId: candidate.reportId || "",
      sourceMessageId: candidate.sourceMessageId || ""
    }, row);
  }

  function shiftLogMatchesRow(log = {}, row = {}) {
    if (!log || !row || isStatusLog(log)) return false;
    if (shiftFeedbackEventMatchesRow(log, row)) return true;
    const logRow = shiftRowFromLog(log);
    return shiftRowsMatch(logRow, row);
  }

  function shiftRowLogs(row = {}, limit = 6) {
    if (!row) return [];
    return mergedOverlayLogs(OVERLAY_LOG_CACHE_LIMIT)
      .filter(log => shiftLogMatchesRow(log, row))
      .slice(0, limit);
  }

  function shiftLogSummary(row = {}) {
    const logs = shiftRowLogs(row, 6);
    if (!logs.length) return "nenhum log vinculado";
    return `${logs.length} log(s), ultimo ${formatDateTime(logs[0].loggedAt) || "sem horario"}`;
  }

  function shiftConfirmedEvidence(row = {}, limit = 4) {
    const items = [];
    const seen = new Set();
    const add = (source, label, at, detail, tone = "ok") => {
      const key = [source, label, at || "", detail || ""].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ source, label, at, detail, tone });
    };
    const feedback = shiftFeedbackForRow(row);
    if (feedback) {
      const meta = SHIFT_FEEDBACK_ACTIONS[feedback.action] || {};
      add("Supervisor", meta.label || feedback.action, shiftFeedbackDateTime(row), feedback.feedback?.correction || meta.summary || "", meta.tone || "ok");
    }
    if (isConfirmedStatus(row.status)) {
      add("WhatsApp", row.lastReportSemantic || statusLabel(row.status), row.lastReportAt || row.firstReportAt || "", rowFullMessage(row), "ok");
    }
    for (const confirmedRow of confirmedRecentRows(confirmedFetchLimit)) {
      if (!shiftRowsMatch(confirmedRow, row)) continue;
      add("Confirmado", confirmedRow.lastReportSemantic || statusLabel(confirmedRow.status), confirmedRow.lastReportAt || confirmedRow.firstReportAt || "", rowFullMessage(confirmedRow), "ok");
    }
    return items
      .filter(item => !item.at || Date.now() - timestampMs(item.at) <= SHIFT_LOG_VISIBLE_MS)
      .sort((a, b) => timestampMs(b.at) - timestampMs(a.at))
      .slice(0, limit);
  }

  function shiftHistoryItemHtml(item = {}) {
    return `
      <div class="shift-history-row ${escapeHtml(item.tone || "")}">
        <strong>${escapeHtml(item.source || "registro")}</strong>
        <span>${escapeHtml(formatDateTime(item.at) || "sem horario")}</span>
        <em>${escapeHtml(item.label || "")}</em>
        ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}
      </div>
    `;
  }

  function shiftHistoryHtml(row = {}) {
    const confirmations = shiftConfirmedEvidence(row, 4);
    const logs = shiftRowLogs(row, 6);
    const logItems = logs.map(log => ({
      source: "Log",
      label: overlayActionLabel(log.action),
      at: log.loggedAt,
      detail: operatorSituationText(log, shiftRowFromLog(log)),
      tone: overlayActionTone(log.action)
    }));
    const items = [...confirmations, ...logItems]
      .sort((a, b) => timestampMs(b.at) - timestampMs(a.at))
      .slice(0, 10);
    return `
      <div class="shift-history">
        <div class="shift-history-head">
          <strong>Confirmacoes e logs 24h</strong>
          <span>${confirmations.length} confirmado(s) / ${logs.length} log(s)</span>
        </div>
        ${items.length
          ? `<div class="shift-history-list">${items.map(shiftHistoryItemHtml).join("")}</div>`
          : `<p>Nenhum log ou confirmacao vinculado a esta troca nas ultimas 24h.</p>`}
      </div>
    `;
  }

  function shiftCardHtml(row) {
    if (!row) {
      if (connectionNeedsAttention()) {
        return `
          <div class="popup-empty status-alert">
            <strong>${escapeHtml(connectionStateText())}</strong>
            <span>${escapeHtml(state.health?.lastError || state.lastError || "Sem dados de troca de turno carregados agora.")}</span>
          </div>
        `;
      }
      return `<div class="popup-empty">Nenhuma troca de turno encontrada nas ultimas 24 horas.</div>`;
    }

    const feedback = shiftFeedbackForRow(row);
    const confirmed = isConfirmedStatus(row.status);
    const handled = confirmed || Boolean(feedback);
    const tone = confirmed ? "ok" : feedback ? (SHIFT_FEEDBACK_ACTIONS[feedback.action]?.tone || "ok") : statusTone(row.status) || "warn";
    const people = shiftPeople(row);
    const message = rowFullMessage(row);
    const finished = shiftFinishedText(row);
    const timing = shiftTimingInfo(row);
    const escalation = shiftEscalationInfo(row);
    const resolvedLog = isResolvedLogRow(row) ? row.__resolvedLog : null;
    return `
      <div class="shift-card-body">
        <div class="popup-head">
          <span class="tag ${tone}">${escapeHtml(confirmed ? "confirmado" : feedback ? `resolvido: ${SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || feedback.action}` : statusLabel(row.status))}</span>
          <span class="tag ${timing.tone}">${escapeHtml(timing.label)}</span>
          ${!handled ? `<span class="tag ${escalation.level === "red" ? "bad" : escalation.level === "orange" || escalation.level === "yellow" ? "warn" : "info"}">${escapeHtml(escalation.label)}</span>` : ""}
          <span class="muted">${escapeHtml(hourLabel(row.hourKey))}</span>
        </div>
        <h2>${escapeHtml(row.placeName || "Posto")}</h2>
        ${shiftDeclarationBannerHtml(row)}
        ${resolvedLog ? logContextHtml(resolvedLog, row) : ""}
        <div class="shift-people-grid">
          ${shiftPersonHtml("Saiu / finalizou", people.left, "Nao informado")}
          ${shiftPersonHtml("Iniciou / assumiu", people.started, "Nao informado")}
        </div>
        <div class="shift-time-grid">
          <span><b>Inicio esperado</b>${escapeHtml(shiftExpectedDisplay(row))}</span>
          <span><b>Horario exato</b>${escapeHtml(timing.detail)}</span>
          <span><b>Prazo esperado</b>${escapeHtml(shiftDeadlineText(row))}</span>
          <span><b>Finalizado</b>${escapeHtml(finished)}</span>
          <span><b>Mensagem</b>${escapeHtml(shiftMessageDateTime(row) || "sem mensagem")}</span>
          <span><b>Confirmacao</b>${escapeHtml(shiftConfirmationText(row))}</span>
          <span><b>Logs 24h</b>${escapeHtml(shiftLogSummary(row))}</span>
        </div>
        ${shiftHistoryHtml(row)}
        ${row.groupSubject ? `<p class="shift-source">${escapeHtml(row.groupSubject)}</p>` : ""}
        ${message ? `<p class="reason shift-message">${escapeHtml(message)}</p>` : ""}
      </div>
      ${resolvedLog ? "" : shiftFeedbackActionsHtml(row)}
    `;
  }

  function shiftQueueItemHtml(row, confirmed) {
    const activeKey = confirmed ? mobileState.activeConfirmedKey : mobileState.activeKey;
    const active = row.key === activeKey;
    const person = shiftPersonFromRow(row);
    const feedback = shiftFeedbackForRow(row);
    const resolvedLog = isResolvedLogRow(row) ? row.__resolvedLog : null;
    const label = resolvedLog
      ? `log / ${overlayActionLabel(resolvedLog.action)}`
      : feedback ? `resolvido / ${SHIFT_FEEDBACK_ACTIONS[feedback.action]?.label || feedback.action}` : confirmed ? (row.lastReportSemantic || "confirmado") : shiftDisplayStatus(row);
    const timing = shiftTimingInfo(row);
    const escalation = shiftEscalationInfo(row);
    const timeline = (resolvedLog ? [
      `log ${formatDateTime(resolvedLog.loggedAt) || "sem horario"}`,
      shiftMessageDateTime(row) ? `msg ${shiftMessageDateTime(row)}` : "",
      `previsto ${shiftExpectedDisplay(row)}`
    ] : [
      `previsto ${shiftExpectedDisplay(row)}`,
      shiftMessageDateTime(row) ? `msg ${shiftMessageDateTime(row)}` : "",
      shiftFeedbackDateTime(row) ? `conf ${formatDateTime(shiftFeedbackDateTime(row))}` : ""
    ]).filter(Boolean).join(" / ");
    return `
      <button class="queue-item ${confirmed ? "confirmed" : ""} ${active ? "active" : ""} ${escapeHtml(shiftEscalationClass(row))}" data-mobile-row-type="${confirmed ? "confirmed" : "pending"}" data-mobile-row-key="${escapeHtml(row.key)}" type="button">
        <strong>${escapeHtml(row.placeName || "Posto")}</strong>
        <em>${escapeHtml(label)} / ${escapeHtml(escalation.level === "ok" ? timing.label : escalation.label)} / ${escapeHtml(timeline)}</em>
        <span>${escapeHtml([person?.name || row.contactName || "nome pendente", formatBrazilPhone(person?.phone || row.fromPhone) || "telefone pendente"].filter(Boolean).join(" / "))}</span>
      </button>
    `;
  }

  function renderShiftSupervisorOverlay() {
    if (!el.mobileActivePopup || !el.mobileQueueList) return;
    const pendingRows = shiftPendingRows();
    const resolvedRows = shiftConfirmedRows(SHIFT_RESOLVED_LIST_LIMIT);
    const queueRows = mobileState.queueTab === "confirmed" ? resolvedRows : pendingRows;
    const active = shiftActiveRow(queueRows);
    const activeEscalation = shiftEscalationInfo(active || {});
    if (mobileState.queueTab === "confirmed") {
      mobileState.activeConfirmedKey = active?.key || "";
      mobileState.activeKey = "";
    } else {
      mobileState.activeKey = active?.key || "";
      mobileState.activeConfirmedKey = "";
    }
    const confirmedActive = mobileState.queueTab === "confirmed";
    el.mobileActivePopup.classList.toggle("confirmed-preview-panel", confirmedActive && Boolean(active));
    el.mobileActivePopup.classList.toggle("log-preview-panel", false);
    ["watch", "yellow", "orange", "red", "ok"].forEach(level => el.mobileActivePopup.classList.remove(`shift-alert-${level}`));
    if (active) el.mobileActivePopup.classList.add(`shift-alert-${activeEscalation.level}`);
    el.mobileActivePopup.innerHTML = shiftCardHtml(active);
    pendingRows.forEach(row => triggerShiftPhonePopup(row, shiftEscalationInfo(row)).catch(() => {}));
    if (el.expectedCount) el.expectedCount.textContent = String(pendingRows.length + resolvedRows.length);
    if (el.dueCount) el.dueCount.textContent = String(pendingRows.length);
    if (el.queueCount) el.queueCount.textContent = String(queueRows.length);
    renderSummaryDropdown();
    if (el.mobileQueueCount) el.mobileQueueCount.textContent = String(queueRows.length);
    if (el.hourLabel) el.hourLabel.textContent = "24h";
    if (el.sourceInfo) el.sourceInfo.textContent = `${pendingRows.length} nao confirmado(s) / ${resolvedRows.length} resolvido(s) / ultimas 24h`;
    el.queueTabButtons.forEach(button => {
      const activeTab = (button.getAttribute("data-queue-tab") || "pending") === mobileState.queueTab;
      button.classList.toggle("active", activeTab);
      button.setAttribute("aria-selected", activeTab ? "true" : "false");
    });
    el.mobileQueueList.innerHTML = queueRows.length
      ? queueRows.map(row => shiftQueueItemHtml(row, mobileState.queueTab === "confirmed")).join("")
      : `<div class="empty">${mobileState.queueTab === "confirmed" ? "Nenhuma troca resolvida nas ultimas 24h." : "Nenhuma troca nao confirmada."}</div>`;
  }

  function renderMobileOverlay() {
    if (!el.mobileActivePopup || !el.mobileQueueList) return;
    if (shiftSupervisorMode) {
      renderShiftSupervisorOverlay();
      return;
    }
    const rows = visiblePendingDueRows();
    const confirmedRows = resolvedRecentRows(CONFIRMED_24H_DISPLAY_LIMIT);
    if (mobileState.queueTab !== "pending") state.selectedLogEvent = null;
    const queueRows = mobileState.queueTab === "confirmed" ? confirmedRows : rows;
    if (mobileState.queueTab !== "confirmed") mobileState.activeConfirmedKey = "";
    const selectedLog = state.selectedLogEvent;
    const active = selectedLog ? logRowFromEvent(selectedLog) : activeMobileRow();
    const confirmedPreview = activeConfirmedRow(confirmedRows);
    el.mobileActivePopup.classList.toggle("confirmed-preview-panel", Boolean(confirmedPreview));
    el.mobileActivePopup.classList.toggle("log-preview-panel", Boolean(selectedLog));
    if (el.mobileQueueCount) el.mobileQueueCount.textContent = String(rows.length);
    if (el.queueCount) el.queueCount.textContent = String(queueRows.length);
    renderSummaryDropdown();
    el.queueTabButtons.forEach(button => {
      const activeTab = (button.getAttribute("data-queue-tab") || "pending") === mobileState.queueTab;
      button.classList.toggle("active", activeTab);
      button.setAttribute("aria-selected", activeTab ? "true" : "false");
    });
    el.mobileActivePopup.innerHTML = confirmedPreview ? confirmedPreviewHtml(confirmedPreview) : mobilePopupHtml(active, { contextLog: selectedLog });
    el.mobileQueueList.innerHTML = queueRows.length
      ? queueRows.map(row => {
        const confirmed = mobileState.queueTab === "confirmed";
        const rowActive = confirmed ? row.key === mobileState.activeConfirmedKey : row.key === mobileState.activeKey;
        const resolvedLog = isResolvedLogRow(row) ? row.__resolvedLog : null;
        const identity = identityLine(row, { includePhone: !confirmed });
        const rowStatusText = resolvedLog
          ? `${overlayActionLabel(resolvedLog.action)} / ${formatDateTime(resolvedLog.loggedAt) || "sem horario"}`
          : confirmed ? `${informedHourText(row)} informado` : statusLabel(row.status);
        return launcherMobileMode ? `
          <button class="queue-item ${confirmed ? "confirmed" : ""} ${rowActive ? "active" : ""}" data-mobile-row-type="${confirmed ? "confirmed" : "pending"}" data-mobile-row-key="${escapeHtml(row.key)}" type="button">
            <strong>${escapeHtml(row.placeName || "Posto")}</strong>
            <em>${escapeHtml(rowStatusText)}</em>
            <span>${escapeHtml(identity)}</span>
          </button>
        ` : `
          <button class="mobile-queue-item ${confirmed ? "confirmed" : ""} ${rowActive ? "active" : ""}" data-mobile-row-type="${confirmed ? "confirmed" : "pending"}" data-mobile-row-key="${escapeHtml(row.key)}" type="button">
            <span>
              <strong>${escapeHtml(row.placeName || "Posto")}</strong>
              <small>${escapeHtml(identity)}</small>
            </span>
            <em>${escapeHtml(rowStatusText)}</em>
          </button>
        `;
      }).join("")
      : `<div class="empty">${mobileState.queueTab === "confirmed" ? "Nenhum resolvido nas ultimas 24h." : "Fila limpa."}</div>`;
    if (el.mobileActionMessage) {
      const pendingCount = mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length;
      const pending = pendingCount ? ` / ${pendingCount} envio(s) aguardando` : "";
      el.mobileActionMessage.textContent = `${state.mobileMessage || "Acoes feitas neste celular entram nos logs do monitoramento."}${pending}`;
    }
  }

  async function applyMobileAction(action) {
    const row = activeMobileRow();
    if (!row) return;
    let message = "";
    if (action === "delay") {
      mobileState.delayed[row.key] = new Date(Date.now() + MOBILE_DELAY_MS).toISOString();
      writeStore(MOBILE_STORAGE_KEYS.delayed, mobileState.delayed);
      state.mobileMessage = `Adiado ate ${delayedText(row.key)}.`;
      message = "Adiado por 10 minutos.";
    } else {
      mobileState.actions[row.key] = { action, at: new Date().toISOString() };
      writeStore(MOBILE_STORAGE_KEYS.actions, mobileState.actions);
      state.mobileMessage = action === "done" ? "Registrado como feito." : "Intervencao ignorada.";
      message = action === "done" ? "Registrado como feito." : "Intervencao ignorada.";
    }
    await logMobileAction(action, row, action === "delay" ? "delay_10min" : "mobile_click");
    state.selectedLogEvent = null;
    mobileState.activeKey = "";
    render();
    showToast(message);
  }

  async function confirmActiveConfirmedMessage() {
    const row = activeConfirmedRow();
    if (!row) return;
    mobileState.actions[confirmedActionKey(row)] = { action: "message_confirmed", at: new Date().toISOString() };
    writeStore(MOBILE_STORAGE_KEYS.actions, mobileState.actions);
    state.mobileMessage = "Mensagem confirmada nos logs.";
    await logMobileAction("message_confirmed", row, "confirmed_message_reviewed");
    render();
    showToast("Mensagem confirmada.");
  }

  async function updateMobileAppShell() {
    state.mobileMessage = "Atualizando app...";
    renderMobileOverlay();
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.update().catch(() => {})));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.includes("tka-monitoramento-whatsapp")).map(key => caches.delete(key)));
    }
    showToast("App atualizado. Recarregando...");
    setTimeout(() => window.location.reload(), 450);
  }

  function logsSummaryText() {
    const logs = mergedOverlayLogs(40);
    return [
      "TKA Monitoramento WhatsApp Mobile",
      `Atualizado: ${formatDateTime(new Date().toISOString())}`,
      `Publicacao: ${shortHourMinute(state.lastUpdatedAt)}`,
      `Pendentes de envio: ${mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length}`,
      ...logs.map(log => `${formatDateTime(log.loggedAt)} ${overlayActionLabel(log.action)} ${log.row?.placeName || "Posto"} ${log.row?.workerName || log.row?.contactName || formatBrazilPhone(log.row?.fromPhone) || ""} ${operatorSituationText(log, log.row || {})}`)
    ].join("\n");
  }

  async function copyLogsSummary() {
    const text = logsSummaryText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("Resumo dos logs copiado.");
  }

  function openLogsModal() {
    if (!el.logsModal) return;
    renderOverlayLogs();
    el.logsModal.classList.remove("hidden");
  }

  function closeLogsModal() {
    if (!el.logsModal) return;
    el.logsModal.classList.add("hidden");
  }

  function renderInterventions() {
    if (!el.interventionCount || !el.interventionList) return;
    const rows = visiblePendingDueRows();
    el.interventionCount.textContent = String(rows.length);
    el.interventionList.innerHTML = rows.length
      ? rows.slice(0, 160).map(row => rowCard(row)).join("")
      : `<div class="empty">Nenhuma intervencao pendente na hora atual.</div>`;
  }

  function renderCurrentHour() {
    if (!el.currentHourList && !el.confirmedList) return;
    const pendingRows = visiblePendingCurrentRows();
    const confirmedRows = resolvedRecentRows(CONFIRMED_24H_DISPLAY_LIMIT);
    const activeTab = state.currentTab || "pending";
    el.currentTabButtons.forEach(button => {
      const selected = (button.getAttribute("data-current-tab") || "pending") === activeTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    el.currentTabPanels.forEach(panel => {
      panel.classList.toggle("hidden", panel.getAttribute("data-current-panel") !== activeTab);
    });
    if (el.currentHourList) {
      el.currentHourList.innerHTML = pendingRows.length
        ? pendingRows.slice(0, 80).map(row => rowCard(row, true)).join("")
        : `<div class="empty">Nenhuma pendencia nesta hora.</div>`;
    }
    if (el.confirmedList) {
      el.confirmedList.innerHTML = confirmedRows.length
        ? confirmedRows.slice(0, 120).map(row => rowCard(row, true)).join("")
        : `<div class="empty">Nenhum resolvido nas ultimas 24h.</div>`;
    }
  }

  function patternText(group) {
    const summaries = [];
    for (const pattern of group.patterns || []) {
      if (pattern.summary && !summaries.includes(pattern.summary)) summaries.push(pattern.summary);
    }
    if (summaries.length) return summaries.slice(0, 3).join("; ");
    if (group.hourSummary) return group.hourSummary;
    const hours = (group.hours || []).map(item => `${String(item.hour).padStart(2, "0")}h`);
    return hours.length ? hours.join(" ") : "sem janela estavel";
  }

  function modeTone(group) {
    if (group.requiresHourly) return "ok";
    if (group.mode === "unmapped" || group.mode === "incident_review") return "warn";
    return "";
  }

  function renderGroups() {
    if (!el.groupPatterns) return;
    const groups = state.groups?.groups || [];
    el.groupPatterns.innerHTML = groups.length
      ? groups.slice(0, 180).map(group => `
        <article class="item">
          <div class="item-header">
            <div>
              <div class="item-title">${escapeHtml(group.groupSubject || group.groupId)}</div>
              <div class="item-meta">${escapeHtml(group.placeName || "posto nao vinculado")}</div>
            </div>
            <span class="tag ${modeTone(group)}">${escapeHtml(group.modeLabel || group.mode)}</span>
          </div>
          <div class="message">${escapeHtml(patternText(group))}</div>
          ${group.manualPlacePattern ? `<div class="item-meta">Manual: ${escapeHtml(group.manualPlacePattern.latestPatternText || group.manualPlacePattern.startingTimes?.join(", ") || "padrao informado pelo operador")}</div>` : ""}
          <div class="tag-row">
            <span class="tag ${group.requiresHourly ? "ok" : ""}">${group.requiresHourly ? "cobra horario" : "sem cobranca horaria"}</span>
            ${group.manualPlacePattern ? `<span class="tag ok">manual</span>` : ""}
            <span class="tag">${escapeHtml(group.autoLearning?.maturity || "aprendendo")}</span>
          </div>
          <div class="item-meta">${(group.observations || []).slice(0, 2).map(item => escapeHtml(item.summary || item.label || "")).filter(Boolean).join("<br>")}</div>
        </article>
      `).join("")
      : `<div class="empty">Aguardando aprendizado dos grupos.</div>`;
  }

  function renderSlots() {
    if (!el.hourSlots) return;
    const slots = state.status?.slots || [];
    el.hourSlots.innerHTML = slots.length
      ? slots.map(slot => `
        <article class="item">
          <div class="item-header">
            <div class="item-title">${hourLabel(slot.hourKey)}</div>
            <span class="tag ${slot.totals?.due ? "bad" : "ok"}">${slot.totals?.due || 0} intervencao</span>
          </div>
          <div class="tag-row">
            <span class="tag">esperados ${slot.totals?.expected || 0}</span>
            <span class="tag ok">ok ${(slot.totals?.ok || 0) + (slot.totals?.ok_late || 0)}</span>
            <span class="tag warn">revisar ${(slot.totals?.review || 0) + (slot.totals?.review_late || 0)}</span>
            <span class="tag bad">sem informe ${slot.totals?.missing || 0}</span>
          </div>
        </article>
      `).join("")
      : `<div class="empty">Sem historico recente carregado.</div>`;
  }

  function render() {
    renderConnection();
    renderRuntimePanel();
    renderMobileOverlay();
    renderManualPlaceInfo();
    renderPatternManager();
    renderShiftSchedule();
    renderShiftExport();
    renderInterventions();
    renderCurrentHour();
    renderOverlayLogs();
    renderGroups();
    renderSlots();
    updateInstallButton();
    updateNotificationButton();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.installPrompt = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    updateInstallButton();
  });

  el.manualPlaceInfoToggle?.addEventListener("click", () => {
    state.manualPlaceInfoOpen = !state.manualPlaceInfoOpen;
    renderManualPlaceInfo();
  });

  el.manualPlaceInfoClose?.addEventListener("click", () => {
    state.manualPlaceInfoOpen = false;
    renderManualPlaceInfo();
  });
  el.manualPlaceInfoSave?.addEventListener("click", saveManualPlaceInfo);
  el.manualPlaceInfoCancel?.addEventListener("click", cancelManualPlaceEdit);
  el.manualPlaceInfoList?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-manual-place-edit]");
    if (editButton) {
      startManualPlaceEdit(editButton.getAttribute("data-manual-place-edit") || "");
      return;
    }
    const deleteButton = event.target.closest("[data-manual-place-delete]");
    if (deleteButton) {
      deleteManualPlaceInfo(deleteButton.getAttribute("data-manual-place-delete") || "").catch(error => {
        state.manualPlaceInfoStatus = error.message || "Nao foi possivel excluir a regra manual.";
        renderManualPlaceInfo();
        showToast(state.manualPlaceInfoStatus);
      });
    }
  });

  el.patternManagerSearch?.addEventListener("input", () => {
    state.patternManagerSearch = el.patternManagerSearch.value || "";
    state.patternManagerStatus = "";
    renderPatternManager();
  });
  el.patternManagerKind?.addEventListener("change", () => {
    state.patternManagerKind = el.patternManagerKind.value || "all";
    state.patternManagerStatus = "";
    renderPatternManager();
  });
  el.patternManagerSource?.addEventListener("change", () => {
    state.patternManagerSource = el.patternManagerSource.value || "all";
    state.patternManagerStatus = "";
    renderPatternManager();
  });
  el.patternManagerPlace?.addEventListener("change", () => {
    state.patternManagerPlace = el.patternManagerPlace.value || "all";
    state.patternManagerStatus = "";
    renderPatternManager();
  });
  el.patternManagerAdd?.addEventListener("click", startPatternManagerNewRule);
  el.patternManagerCopy?.addEventListener("click", () => copyPatternManagerPacket());
  el.patternManagerTable?.addEventListener("click", event => {
    const manualButton = event.target.closest("[data-pattern-manual-edit]");
    if (manualButton) {
      startManualPlaceEdit(manualButton.getAttribute("data-pattern-manual-edit") || "");
      return;
    }
    const shiftButton = event.target.closest("[data-pattern-shift-edit]");
    if (shiftButton) {
      startShiftScheduleEdit(shiftButton.getAttribute("data-pattern-shift-edit") || "");
      return;
    }
    const groupButton = event.target.closest("[data-pattern-group-rule]");
    if (groupButton) {
      startPatternManagerGroupRule(groupButton.getAttribute("data-pattern-group-rule") || "");
    }
  });

  el.installButton?.addEventListener("click", async () => {
    if (!state.installPrompt) {
      showToast("Use o menu do navegador para adicionar este app a tela inicial.");
      return;
    }
    const prompt = state.installPrompt;
    state.installPrompt = null;
    await prompt.prompt();
    updateInstallButton();
  });

  el.shiftScheduleToggle?.addEventListener("click", () => {
    state.shiftScheduleOpen = !state.shiftScheduleOpen;
    renderShiftSchedule();
  });

  el.shiftScheduleClose?.addEventListener("click", () => {
    state.shiftScheduleOpen = false;
    renderShiftSchedule();
  });

  el.shiftScheduleList?.addEventListener("click", event => {
    const editButton = event.target.closest("[data-shift-schedule-edit]");
    if (!editButton) return;
    startShiftScheduleEdit(editButton.getAttribute("data-shift-schedule-edit") || "");
  });

  el.notificationButton?.addEventListener("click", () => {
    requestShiftNotifications().catch(error => showToast(error.message || "Nao foi possivel ativar notificacoes."));
  });

  el.mobileActivePopup?.addEventListener("click", event => {
    const clearLogPreview = event.target.closest("[data-clear-log-preview]");
    if (clearLogPreview) {
      state.selectedLogEvent = null;
      if (mobileState.queueTab === "confirmed") mobileState.activeConfirmedKey = "";
      renderMobileOverlay();
      return;
    }
    const closePreview = event.target.closest("[data-close-confirmed-preview]");
    if (closePreview) {
      mobileState.activeConfirmedKey = "";
      renderMobileOverlay();
      return;
    }
    const confirmMessage = event.target.closest("[data-confirm-confirmed-message]");
    if (confirmMessage) {
      confirmMessage.disabled = true;
      confirmActiveConfirmedMessage().catch(error => {
        state.mobileMessage = error.message || "Nao foi possivel confirmar a mensagem.";
        showToast(state.mobileMessage);
        renderMobileOverlay();
      });
      return;
    }
    const aiButton = event.target.closest("[data-ai-feedback]");
    if (aiButton) {
      handleAiFeedbackButton(aiButton, activeMobileRow());
      return;
    }
    const shiftButton = event.target.closest("[data-shift-feedback]");
    if (shiftButton) {
      handleShiftFeedbackButton(shiftButton, shiftActiveRow(shiftPendingRows()) || shiftActiveRow(shiftConfirmedRows(80)));
      return;
    }
    const button = event.target.closest("[data-mobile-action]");
    if (!button) return;
    button.disabled = true;
    applyMobileAction(button.getAttribute("data-mobile-action")).catch(error => {
      state.mobileMessage = error.message || "Nao foi possivel registrar a acao.";
      showToast(state.mobileMessage);
      renderMobileOverlay();
    });
  });

  el.mobileQueueList?.addEventListener("click", event => {
    const aiButton = event.target.closest("[data-ai-feedback]");
    if (aiButton) {
      event.preventDefault();
      event.stopPropagation();
      handleAiFeedbackButton(aiButton);
      return;
    }
    const button = event.target.closest("[data-mobile-row-key]");
    if (!button) return;
    if (button.getAttribute("data-mobile-row-type") === "confirmed") {
      state.selectedLogEvent = null;
      mobileState.activeConfirmedKey = button.getAttribute("data-mobile-row-key") || "";
      renderMobileOverlay();
      return;
    }
    state.selectedLogEvent = null;
    mobileState.activeKey = button.getAttribute("data-mobile-row-key") || "";
    mobileState.activeConfirmedKey = "";
    renderMobileOverlay();
  });

  el.summaryButtons.forEach(button => {
    button.addEventListener("click", () => {
      const type = button.getAttribute("data-summary-detail") || "";
      state.summaryDropdownOpen = state.summaryDropdownOpen === type ? "" : type;
      renderSummaryDropdown();
    });
  });

  el.summaryDropdown?.addEventListener("click", event => {
    const button = event.target.closest("[data-summary-row-key]");
    if (!button) return;
    const key = button.getAttribute("data-summary-row-key") || "";
    const kind = button.getAttribute("data-summary-row-kind") || "pending";
    if (kind === "confirmed") {
      mobileState.queueTab = "confirmed";
      mobileState.activeConfirmedKey = key;
      mobileState.activeKey = "";
    } else {
      mobileState.queueTab = "pending";
      mobileState.activeKey = key;
      mobileState.activeConfirmedKey = "";
    }
    state.selectedLogEvent = null;
    renderMobileOverlay();
  });

  function handleInlineAiFeedbackClick(event) {
    const aiButton = event.target.closest("[data-ai-feedback]");
    if (!aiButton) return;
    event.preventDefault();
    event.stopPropagation();
    handleAiFeedbackButton(aiButton);
  }

  el.interventionList?.addEventListener("click", handleInlineAiFeedbackClick);
  el.currentHourList?.addEventListener("click", handleInlineAiFeedbackClick);
  el.confirmedList?.addEventListener("click", handleInlineAiFeedbackClick);

  el.currentTabButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.currentTab = button.getAttribute("data-current-tab") || "pending";
      renderCurrentHour();
    });
  });

  if (el.shiftExportDate && !el.shiftExportDate.value) {
    el.shiftExportDate.value = localDateKey(new Date());
  }
  [el.shiftExportDate, el.shiftExportPlace, el.shiftExportWorker].forEach(input => {
    input?.addEventListener("input", () => {
      state.shiftExportStatus = "";
      renderShiftExport();
    });
  });
  el.shiftExportSearch?.addEventListener("click", () => {
    refreshShiftExportSearch().catch(error => {
      state.shiftExportStatus = error.message || "Nao foi possivel atualizar a busca.";
      if (el.shiftExportSearch) el.shiftExportSearch.disabled = false;
      renderShiftExport();
    });
  });
  el.shiftExportPdf?.addEventListener("click", () => {
    exportShiftPdf().catch(error => {
      state.shiftExportStatus = error.message || "Nao foi possivel gerar o PDF.";
      if (el.shiftExportPdf) el.shiftExportPdf.disabled = false;
      renderShiftExport();
      showToast(state.shiftExportStatus);
    });
  });
  el.queueTabButtons.forEach(button => {
    button.addEventListener("click", () => {
      mobileState.queueTab = button.getAttribute("data-queue-tab") || "pending";
      state.selectedLogEvent = null;
      if (mobileState.queueTab !== "confirmed") mobileState.activeConfirmedKey = "";
      renderMobileOverlay();
    });
  });

  el.reloadButton?.addEventListener("click", () => {
    refreshLiveOnce({ forceLocal: true })
      .then(() => showToast("Dados atualizados."))
      .catch(error => showToast(error.message || "Nao foi possivel atualizar agora."));
  });

  el.updateAppButton?.addEventListener("click", () => {
    updateMobileAppShell().catch(error => showToast(error.message || "Nao foi possivel atualizar o app."));
  });

  el.syncLogsButton?.addEventListener("click", () => {
    Promise.all([flushMobileLogs(), flushAiFeedback()])
      .then(() => {
        renderOverlayLogs();
        showToast((mobileState.pendingLogs.length + mobileState.pendingAiFeedback.length) ? "Ainda ha envios pendentes." : "Logs enviados.");
      })
      .catch(error => showToast(error.message || "Nao foi possivel enviar logs."));
  });

  el.logsButton?.addEventListener("click", openLogsModal);
  el.closeLogsButton?.addEventListener("click", closeLogsModal);
  el.refreshLogsButton?.addEventListener("click", () => {
    refreshOverlayLogsOnce()
      .then(() => {
        renderOverlayLogs();
        showToast("Logs atualizados.");
      })
      .catch(error => showToast(error.message || "Nao foi possivel atualizar logs."));
  });
  el.copyLogsButton?.addEventListener("click", () => copyLogsSummary().catch(error => showToast(error.message)));
  el.logsModal?.addEventListener("click", event => {
    if (event.target === el.logsModal) closeLogsModal();
    const logButton = event.target.closest("[data-overlay-log-id]");
    if (logButton) openLogInQueue(logButton.getAttribute("data-overlay-log-id") || "");
  });

  render();
  updateClock();
  setInterval(updateClock, 1000);
  registerServiceWorker();
  connectCloud();
})();
