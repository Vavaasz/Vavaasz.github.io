const today = (() => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
})();
const PORTAL_SESSION_DATA_KEY = "portal_gate_user";
const PORTAL_THEME_KEY = "tka_theme";
const PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
const state = {
  places: [],
  workers: [],
  jobFunctions: [],
  workerProfiles: [],
  documentation: [],
  scales: [],
  entries: [],
  ftEntries: [],
  collaboratorSheetWorkers: [],
  whatsappRhSnapshot: null,
  monitoramentoSnapshot: null,
  rhAiDraftJobs: [],
  rhAiFeedbackEvents: [],
  dashboardFetchErrors: {},
  auditLogs: [],
  currentUser: null,
  currentDocId: "",
  entryMode: "rh",
  editingPlaceId: "",
  editingWorkerId: "",
  editingJobFunctionId: "",
  editingScaleId: "",
  editingProfileId: "",
  editingEntryId: "",
  editingFtId: "",
  reviewingPlaceClusterKey: "",
  pendingFichasImport: null,
  ftSelectedDates: new Set(),
  ftCalendarMonth: new Date(today + "T00:00:00")
};
const subscriptions = [];
let realtimeConnectionFailed = false;
const DASHBOARD_RECENT_DAYS = 7;
const LOCAL_RH_BRIDGE_URL = "http://127.0.0.1:18992";
const LOCAL_MONITORAMENTO_BRIDGE_URL = "http://127.0.0.1:18991";
const DASHBOARD_LIVE_WORK_WINDOW_MS = 24 * 60 * 60 * 1000;
const FIRESTORE_READ_QUOTA_BACKOFF_MS = 30 * 60 * 1000;
const FIRESTORE_READ_ERROR_BACKOFF_MS = 5 * 60 * 1000;
let dashboardLocalRhRefreshTimer = null;
let dashboardLocalMonitoramentoRefreshTimer = null;
let firestoreReadBackoffUntil = 0;
let firestoreReadBackoffReason = "";
const RH_DECLARED_PATTERN_TOPICS = [
  "Premio de Boa Permanencia",
  "TotalPass",
  "Beneficios VR e VA",
  "Vale Transporte",
  "Cartao Flash - Auxilio Mobilidade",
  "Pagamento, datas e prazos",
  "Registro de ponto - Control RH",
  "Holerite",
  "Cadastro e uso do INCICLE"
];
const RH_DOCUMENTATION_COMPANIES = {
  "tka-seguranca-privada": "TKA Seguranca Privada",
  "tka-zeladoria": "TKA Zeladoria",
  "tka-security": "TKA Security"
};
const managerEmails = new Set([
  "rh@grupotka.com.br",
  "supervisao@grupotka.com.br",
  "coordenacao@grupotka.com.br",
  "comercial@grupotka.com.br",
  "monitoramento@grupotka.com.br"
]);
const ADMIN_EMAIL = "comercial@grupotka.com.br";

const el = {
  loginView: document.getElementById("loginView"),
  appView: document.getElementById("appView"),
  brandTitle: document.getElementById("brandTitle"),
  loginForm: document.getElementById("loginForm"),
  loginUser: document.getElementById("loginUser"),
  loginPass: document.getElementById("loginPass"),
  loginError: document.getElementById("loginError"),
  logoutBtn: document.getElementById("logoutBtn"),
  homeLink: document.getElementById("homeLink"),
  fichasUploadOpenBtn: document.getElementById("fichasUploadOpenBtn"),
  fichasUploadModal: document.getElementById("fichasUploadModal"),
  fichasUploadCloseBtn: document.getElementById("fichasUploadCloseBtn"),
  fichasUploadForm: document.getElementById("fichasUploadForm"),
  fichasUploadFile: document.getElementById("fichasUploadFile"),
  fichasUploadMode: document.getElementById("fichasUploadMode"),
  fichasUploadRunBtn: document.getElementById("fichasUploadRunBtn"),
  fichasUploadApplyBtn: document.getElementById("fichasUploadApplyBtn"),
  fichasUploadStatus: document.getElementById("fichasUploadStatus"),
  fichasUploadPreview: document.getElementById("fichasUploadPreview"),
  fichasRegisterSummary: document.getElementById("fichasRegisterSummary"),
  fichasRegisterList: document.getElementById("fichasRegisterList"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  rhTabs: document.getElementById("rhTabs"),
  docModeActions: document.getElementById("docModeActions"),
  storageMode: document.getElementById("storageMode"),
  saveStatus: document.getElementById("saveStatus"),
  dashDate: document.getElementById("dashDate"),
  placeSearch: document.getElementById("placeSearch"),
  dashSort: document.getElementById("dashSort"),
  dashboardSummary: document.getElementById("dashboardSummary"),
  dashboardDataFeed: document.getElementById("dashboardDataFeed"),
  dashboardGrid: document.getElementById("dashboardGrid"),
  exportMode: document.getElementById("exportMode"),
  exportDay: document.getElementById("exportDay"),
  exportStart: document.getElementById("exportStart"),
  exportEnd: document.getElementById("exportEnd"),
  exportPlace: document.getElementById("exportPlace"),
  exportWorker: document.getElementById("exportWorker"),
  exportBtn: document.getElementById("exportBtn"),
  placeForm: document.getElementById("placeForm"),
  placeName: document.getElementById("placeName"),
  placeCity: document.getElementById("placeCity"),
  placeSubmitBtn: document.getElementById("placeSubmitBtn"),
  placeCancelBtn: document.getElementById("placeCancelBtn"),
  placeSort: document.getElementById("placeSort"),
  placeList: document.getElementById("placeList"),
  workerForm: document.getElementById("workerForm"),
  workerName: document.getElementById("workerName"),
  workerPlaceId: document.getElementById("workerPlaceId"),
  workerRole: document.getElementById("workerRole"),
  workerSubmitBtn: document.getElementById("workerSubmitBtn"),
  workerCancelBtn: document.getElementById("workerCancelBtn"),
  workerSort: document.getElementById("workerSort"),
  workerList: document.getElementById("workerList"),
  jobFunctionForm: document.getElementById("jobFunctionForm"),
  jobFunctionName: document.getElementById("jobFunctionName"),
  jobFunctionValue: document.getElementById("jobFunctionValue"),
  jobFunctionSubmitBtn: document.getElementById("jobFunctionSubmitBtn"),
  jobFunctionCancelBtn: document.getElementById("jobFunctionCancelBtn"),
  jobFunctionList: document.getElementById("jobFunctionList"),
  jobFunctionOptions: document.getElementById("jobFunctionOptions"),
  docCompanyFilter: document.getElementById("docCompanyFilter"),
  docSearch: document.getElementById("docSearch"),
  docRecordList: document.getElementById("docRecordList"),
  docForm: document.getElementById("docForm"),
  docWorkerId: document.getElementById("docWorkerId"),
  docFullName: document.getElementById("docFullName"),
  docCpf: document.getElementById("docCpf"),
  docRg: document.getElementById("docRg"),
  docCtps: document.getElementById("docCtps"),
  docTitulo: document.getElementById("docTitulo"),
  docReservista: document.getElementById("docReservista"),
  docCompany: document.getElementById("docCompany"),
  docRole: document.getElementById("docRole"),
  docBirthDate: document.getElementById("docBirthDate"),
  docPhone: document.getElementById("docPhone"),
  docEmail: document.getElementById("docEmail"),
  docZip: document.getElementById("docZip"),
  docAddress: document.getElementById("docAddress"),
  docNumber: document.getElementById("docNumber"),
  docComplement: document.getElementById("docComplement"),
  docNeighborhood: document.getElementById("docNeighborhood"),
  docCity: document.getElementById("docCity"),
  docState: document.getElementById("docState"),
  docEducation: document.getElementById("docEducation"),
  docCnv: document.getElementById("docCnv"),
  docCourse: document.getElementById("docCourse"),
  docHealth: document.getElementById("docHealth"),
  docCriminal: document.getElementById("docCriminal"),
  docNotes: document.getElementById("docNotes"),
  docNewBtn: document.getElementById("docNewBtn"),
  docUploadForm: document.getElementById("docUploadForm"),
  docUploadCategory: document.getElementById("docUploadCategory"),
  docFiles: document.getElementById("docFiles"),
  docUploadHint: document.getElementById("docUploadHint"),
  docFileList: document.getElementById("docFileList"),
  scaleForm: document.getElementById("scaleForm"),
  scaleName: document.getElementById("scaleName"),
  scalePattern: document.getElementById("scalePattern"),
  scaleSubmitBtn: document.getElementById("scaleSubmitBtn"),
  scaleCancelBtn: document.getElementById("scaleCancelBtn"),
  scaleSort: document.getElementById("scaleSort"),
  scaleList: document.getElementById("scaleList"),
  ftForm: document.getElementById("ftForm"),
  ftWorkerId: document.getElementById("ftWorkerId"),
  ftName: document.getElementById("ftName"),
  ftPlaceId: document.getElementById("ftPlaceId"),
  ftDate: document.getElementById("ftDate"),
  ftDays: document.getElementById("ftDays"),
  ftStartTime: document.getElementById("ftStartTime"),
  ftHours: document.getElementById("ftHours"),
  ftValue: document.getElementById("ftValue"),
  ftRole: document.getElementById("ftRole"),
  ftList: document.getElementById("ftList"),
  ftFilterName: document.getElementById("ftFilterName"),
  ftFilterPlace: document.getElementById("ftFilterPlace"),
  ftFilterDate: document.getElementById("ftFilterDate"),
  ftFilterRole: document.getElementById("ftFilterRole"),
  ftCalendarPrev: document.getElementById("ftCalendarPrev"),
  ftCalendarNext: document.getElementById("ftCalendarNext"),
  ftCalendarLabel: document.getElementById("ftCalendarLabel"),
  ftCalendarGrid: document.getElementById("ftCalendarGrid"),
  ftSelectedDates: document.getElementById("ftSelectedDates"),
  ftSelectedClear: document.getElementById("ftSelectedClear"),
  auditLogList: document.getElementById("auditLogList"),
  profileSearch: document.getElementById("profileSearch"),
  profileSort: document.getElementById("profileSort"),
  profileForm: document.getElementById("profileForm"),
  profileWorkerId: document.getElementById("profileWorkerId"),
  profilePlaceId: document.getElementById("profilePlaceId"),
  profileScaleId: document.getElementById("profileScaleId"),
  profileCargo: document.getElementById("profileCargo"),
  profilePrecoFt: document.getElementById("profilePrecoFt"),
  profileSubmitBtn: document.getElementById("profileSubmitBtn"),
  profileCancelBtn: document.getElementById("profileCancelBtn"),
  profileList: document.getElementById("profileList")
};

el.dashDate.value = today;
el.exportDay.value = today;
el.exportStart.value = today;
el.exportEnd.value = today;
el.ftDate.value = today;
el.ftDays.value = "1";
el.ftStartTime.value = "08:00";
state.ftSelectedDates.add(today);

function formatCalendarMonth(date) {
  return date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function syncFtSelectedDates() {
  const sorted = [...state.ftSelectedDates].sort();
  if (!sorted.length) {
    el.ftDate.value = today;
    return;
  }
  el.ftDate.value = sorted[0];
}

function toggleFtDate(dateValue) {
  if (state.ftSelectedDates.has(dateValue)) {
    state.ftSelectedDates.delete(dateValue);
  } else {
    state.ftSelectedDates.add(dateValue);
  }
  syncFtSelectedDates();
  renderFtCalendar();
}

function clearFtSelection() {
  state.ftSelectedDates.clear();
  syncFtSelectedDates();
  renderFtCalendar();
}

function buildConsecutiveDates(startDateValue, count) {
  const start = new Date(`${startDateValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toIsoDate(date);
  });
}

function renderFtSelectedDates() {
  const dates = [...state.ftSelectedDates].sort();
  if (!dates.length) {
    el.ftSelectedDates.innerHTML = `<span class="muted">Nenhum dia selecionado ainda. Clique em um ou mais dias no calendario.</span>`;
    return;
  }
  el.ftSelectedDates.innerHTML = dates.map(date => `
    <span class="ft-selected-chip">
      <strong>${date}</strong>
      <button type="button" class="ghost" data-ft-remove="${date}">x</button>
    </span>
  `).join("");
  el.ftSelectedDates.querySelectorAll("[data-ft-remove]").forEach(button => {
    button.onclick = () => {
      state.ftSelectedDates.delete(button.dataset.ftRemove);
      syncFtSelectedDates();
      renderFtCalendar();
    };
  });
}

function renderFtCalendar() {
  const monthStart = new Date(state.ftCalendarMonth.getFullYear(), state.ftCalendarMonth.getMonth(), 1);
  const monthEnd = new Date(state.ftCalendarMonth.getFullYear(), state.ftCalendarMonth.getMonth() + 1, 0);
  const firstDay = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  el.ftCalendarLabel.textContent = formatCalendarMonth(monthStart);
  const cells = weekdays.map(day => `<div class="ft-calendar-weekday">${day}</div>`);
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(`<div class="ft-calendar-day empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const iso = toIsoDate(current);
    const isSelected = state.ftSelectedDates.has(iso);
    cells.push(`
      <button type="button" class="ft-calendar-day ${isSelected ? "selected" : ""}" data-ft-date="${iso}">
        <span class="day-number">${day}</span>
        <span class="day-month">${current.toLocaleString("pt-BR", { month: "short" })}</span>
      </button>
    `);
  }
  el.ftCalendarGrid.innerHTML = cells.join("");
  el.ftCalendarGrid.querySelectorAll("[data-ft-date]").forEach(button => {
    button.onclick = () => toggleFtDate(button.dataset.ftDate);
  });
  renderFtSelectedDates();
}

function getFilteredFtEntries() {
  const nameFilter = el.ftFilterName.value.trim().toLowerCase();
  const placeFilter = el.ftFilterPlace.value.trim().toLowerCase();
  const dateFilter = el.ftFilterDate.value;
  const roleFilter = el.ftFilterRole.value.trim().toLowerCase();
  return [...state.ftEntries]
    .filter(item => !nameFilter || String(item.name || "").toLowerCase().includes(nameFilter))
    .filter(item => !placeFilter || placeName(item.placeId).toLowerCase().includes(placeFilter))
    .filter(item => !dateFilter || item.date === dateFilter)
    .filter(item => !roleFilter || String(item.role || "").toLowerCase().includes(roleFilter))
    .sort((a, b) => a.date === b.date ? String(a.startTime || "").localeCompare(String(b.startTime || "")) : a.date.localeCompare(b.date));
}

function renderFtList() {
  const rows = getFilteredFtEntries();
  if (!rows.length) {
    el.ftList.innerHTML = `<div class="row"><span class="muted">Nenhum FT encontrado com os filtros atuais.</span></div>`;
    return;
  }
  el.ftList.innerHTML = "";
  const placeOptions = `<option value="">Selecione o local</option>` + sortedByName(state.places).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  const workerOptions = `<option value="">Selecione funcionario (opcional)</option>` + sortedByName(state.workers).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  rows.forEach(ft => {
    const row = document.createElement("div");
    row.className = "list-item-stack";
    if (state.editingFtId === ft.id) {
      row.innerHTML = `
        <div class="row ft-row-summary">
          <div class="row-main">
            <span class="row-title">${ft.name || "Sem nome"}</span>
            <span class="row-subtitle">${placeName(ft.placeId)} | ${formatFtDate(ft.date)} | ${formatFtTimeRange(ft.startTime || "08:00", ft.hours || 12)} | ${ft.hours || 12}h | ${currency(ft.value)} | ${getFtRoleLabel(ft)}</span>
          </div>
        </div>
        <form class="inline-form ft-form inline-edit-form" data-ft-edit-form="${ft.id}">
          <select name="workerId">${workerOptions}</select>
          <input name="name" value="${ft.name || ""}" placeholder="Nome da pessoa" required>
          <select name="placeId">${placeOptions}</select>
          <input name="date" type="date" value="${ft.date || today}" required>
          <input name="startTime" type="time" value="${ft.startTime || "08:00"}" required>
          <input name="hours" type="number" min="1" step="0.5" value="${ft.hours || 12}" placeholder="Horas" required>
          <input name="value" type="number" min="0" step="0.01" value="${ft.value || 0}" placeholder="Valor (R$)" required>
          <input name="role" list="jobFunctionOptions" value="${ft.role || ""}" placeholder="Funcao / motivo" required>
          <input name="reason" value="${getFtReason(ft)}" placeholder="Motivo">
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-ft-cancel>Cancelar</button>
        </form>
      `;
      const form = row.querySelector("form");
      form.querySelector('[name="workerId"]').value = ft.workerId || "";
      form.querySelector('[name="placeId"]').value = ft.placeId || "";
      const roleInput = form.querySelector('[name="role"]');
      const valueInput = form.querySelector('[name="value"]');
      const workerInput = form.querySelector('[name="workerId"]');
      roleInput.oninput = () => {
        const suggested = getSuggestedFtValue(roleInput.value.trim());
        if (suggested !== "" && !valueInput.value) valueInput.value = suggested;
      };
      roleInput.onchange = () => {
        const suggested = getSuggestedFtValue(roleInput.value.trim());
        if (suggested !== "") valueInput.value = suggested;
      };
      workerInput.onchange = () => {
        const worker = state.workers.find(item => item.id === workerInput.value);
        const profile = getWorkerProfile(workerInput.value);
        if (worker && !form.querySelector('[name="name"]').value) form.querySelector('[name="name"]').value = worker.name;
        if (profile?.placeId && !form.querySelector('[name="placeId"]').value) form.querySelector('[name="placeId"]').value = profile.placeId;
        if (profile?.cargo && !roleInput.value) roleInput.value = profile.cargo;
        if (!valueInput.value && profile) valueInput.value = getProfileFtValue(profile) || "";
      };
      form.onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
          ...ft,
          workerId: String(formData.get("workerId") || ""),
          name: String(formData.get("name") || "").trim(),
          placeId: String(formData.get("placeId") || ""),
          date: String(formData.get("date") || ""),
          startTime: String(formData.get("startTime") || ""),
          hours: Number(formData.get("hours") || 0),
          value: formData.get("value") !== "" ? Number(formData.get("value")) : Number(getSuggestedFtValue(String(formData.get("role") || "").trim(), 0) || 0),
          role: String(formData.get("role") || "").trim(),
          reason: String(formData.get("reason") || "").trim()
        };
        if (!payload.name || !payload.placeId || !payload.date || !payload.startTime || !payload.hours || !payload.role) {
          alert("Preencha os campos principais da FT.");
          return;
        }
        await setEntity("ft_entries", payload);
        const linkedEntry = state.entries.find(item => item.ftEntryId === ft.id || (item.date === ft.date && item.placeId === ft.placeId && item.workerId && (item.workerId === ft.workerId || workerName(item.workerId) === ft.name)));
        if (payload.workerId) {
          await setEntity("entries", {
            id: linkedEntry?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            date: payload.date,
            placeId: payload.placeId,
            workerId: payload.workerId,
            type: "Folga Trabalhada",
            scaleId: getWorkerProfile(payload.workerId)?.scaleId || "",
            ftEntryId: ft.id
          }, false);
        } else if (linkedEntry) {
          await deleteEntity("entries", linkedEntry.id, false);
        }
        state.editingFtId = "";
        renderFtList();
      };
      row.querySelector("[data-ft-cancel]").onclick = () => {
        state.editingFtId = "";
        renderFtList();
      };
    } else {
      row.innerHTML = `
        <div class="row ft-row-summary">
          <div class="row-main">
            <span class="row-title">${ft.name || "Sem nome"}</span>
            <span class="row-subtitle">${placeName(ft.placeId)} | ${formatFtDate(ft.date)} | ${formatFtTimeRange(ft.startTime || "08:00", ft.hours || 12)} | ${ft.hours || 12}h | ${currency(ft.value)} | ${getFtRoleLabel(ft)}</span>
          </div>
          <div class="actions">
            <button type="button" data-ft-edit>Editar</button>
            <button type="button" class="danger" data-ft-del>Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-ft-edit]").onclick = () => {
        state.editingFtId = ft.id;
        renderFtList();
      };
      row.querySelector("[data-ft-del]").onclick = async () => {
        await deleteEntity("ft_entries", ft.id);
        renderFtList();
      };
    }
    el.ftList.appendChild(row);
  });
}

function showLogin() {
  el.loginView.classList.remove("hidden");
  el.appView.classList.add("hidden");
}

function showApp() {
  el.loginView.classList.add("hidden");
  el.appView.classList.remove("hidden");
}

function setActiveTab(tabId) {
  const nextTabId = tabId || "dashboard";
  document.querySelectorAll(".tab-btn[data-tab]").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === nextTabId);
  });
  document.querySelectorAll(".tab").forEach(item => {
    item.classList.toggle("active", item.id === `tab-${nextTabId}`);
  });
  const url = new URL(window.location.href);
  if (nextTabId === "dashboard") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", nextTabId);
  }
  const query = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${query ? `?${query}` : ""}`);
  configureEntryMode();
}

function applyTheme(theme) {
  document.body.dataset.theme = theme === "dark" ? "dark" : "light";
  el.themeToggleBtn.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
  localStorage.setItem(PORTAL_THEME_KEY, document.body.dataset.theme);
}

function configureEntryMode() {
  state.entryMode = requestedTab() === "documentacao" ? "documentation" : "rh";
  const isDocumentation = state.entryMode === "documentation";
  document.body.classList.toggle("documentation-mode", isDocumentation);
  el.rhTabs.classList.toggle("hidden", isDocumentation);
  el.docModeActions.classList.toggle("hidden", !isDocumentation);
  el.brandTitle.textContent = isDocumentation ? "Documentacao RH" : "Central RH Web";
}

function isRhAdmin() {
  return state.currentUser?.email === ADMIN_EMAIL;
}

function setStatus(text) {
  el.saveStatus.textContent = text;
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

async function verifyGatePassword(entry, password) {
  if (typeof entry === "string") return entry === password;
  const hashConfig = normalizePasswordHash(entry?.passwordHash);
  if (!hashConfig) return false;
  return (await derivePasswordHash(password, hashConfig)) === hashConfig.hash;
}

function sortedByName(list, order = "az", field = "name") {
  return [...list].sort((a, b) => {
    const av = String(a[field] || "").toLowerCase();
    const bv = String(b[field] || "").toLowerCase();
    if (av === bv) return 0;
    return order === "za" ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const DASHBOARD_PLACE_NOISE_TOKENS = new Set([
  "acesso",
  "ao",
  "da",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "entrada",
  "escala",
  "funcao",
  "grupo",
  "informes",
  "jornada",
  "local",
  "missao",
  "monitoramento",
  "ocorrencias",
  "operador",
  "plantao",
  "portaria",
  "posto",
  "postos",
  "turno",
  "vigilante",
  "vig",
  "controlador",
  "controle",
  "cont",
  "cond",
  "condominio",
  "edificio",
  "residencial",
  "res",
  "clube"
]);

const DASHBOARD_PLACE_LOCATION_TOKENS = new Set([
  "cacapava",
  "jac",
  "jacarei",
  "sjc",
  "sao",
  "jose",
  "campos",
  "taubate",
  "tte"
]);

const DASHBOARD_PLACE_ALIAS_GROUPS = [
  { key: "a-lusitana", aliases: ["a lusitana", "lusitana", "lusitana cacapava"] },
  { key: "base", aliases: ["base", "base tka", "base taubate"] },
  { key: "bkm", aliases: ["bkm", "bkm sjc", "bkm sao jose dos campos"] },
  { key: "camara-municipal", aliases: ["camara municipal", "camara", "cam municipal"] },
  { key: "cjn", aliases: ["cjn", "cjn taubate", "cjn tte"] },
  { key: "clube-jequitiba", aliases: ["clube jequitiba", "jequitiba", "jequitib"] },
  { key: "coevo-jacarei", aliases: ["coevo jacarei", "coevo jac", "missao coevo jac", "missao coevo jacarei"] },
  { key: "coevo-sjc", aliases: ["coevo sjc", "coevo sao jose dos campos", "missao coevo sjc", "missao coevo sao jose dos campos"] },
  { key: "iqt", aliases: ["iqt", "iqt taubate"] },
  { key: "ronda-tka", aliases: ["ronda tka", "ronda sjc", "ronda inspecao dos postos", "ronda monitoramento"] },
  { key: "salvador-logistica", aliases: ["salvador logistica", "salvador"] },
  { key: "taubate-country-club", aliases: ["taubate country club", "tcc", "taubate country", "country club"] },
  { key: "terrazzo-di-italia", aliases: ["condominio terrazzo di italia", "terrazzo di italia", "terrazzo"] },
  { key: "ues", aliases: ["ues", "ues sjc", "ues sao jose dos campos"] },
  { key: "urbam", aliases: ["urbam", "urban", "urbam sjc", "urban sjc"] },
  { key: "ruda", aliases: ["condominio ruda", "ruda", "rud"] }
];

let dashboardPlaceAliasCache = null;
let dashboardDynamicPlaceAliasCache = null;
let dashboardDynamicPlaceAliasCacheKey = "";
const DASHBOARD_PLACE_REVIEW_CACHE_KEY = "tka_rh_place_review_links_v1";

function resetDashboardPlaceAliasCache() {
  dashboardDynamicPlaceAliasCache = null;
  dashboardDynamicPlaceAliasCacheKey = "";
}

function normalizePlaceText(value) {
  return normalizeText(value)
    .replace(/[?\uFFFD]+/g, " ")
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dashboardLooksLikeRoleSuffix(value) {
  const tokens = new Set(normalizePlaceText(value).split(" ").filter(Boolean));
  return [
    "acesso",
    "controlador",
    "controle",
    "cont",
    "portaria",
    "vig",
    "vigilante",
    "zeladoria",
    "limpeza",
    "monitoramento"
  ].some(token => tokens.has(token));
}

function dashboardCleanPlaceLabel(value) {
  const text = String(value || "")
    .replace(/\s*\((?:vig(?:ilante)?|cont\.?\s*acesso|controlador(?:\s+de\s+acesso)?|portaria|zeladoria|limpeza)\)\s*$/i, "")
    .replace(/[?\uFFFD]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const pipeParts = text.split("|").map(part => part.trim()).filter(Boolean);
  if (pipeParts.length > 1 && dashboardLooksLikeRoleSuffix(pipeParts.slice(1).join(" "))) {
    return pipeParts[0];
  }
  const slashParts = text.split(/\s+\/\s+/).map(part => part.trim()).filter(Boolean);
  if (slashParts.length > 1 && dashboardLooksLikeRoleSuffix(slashParts.slice(1).join(" "))) {
    return slashParts[0];
  }
  return text;
}

function dashboardPlaceTokens(value) {
  return normalizePlaceText(dashboardCleanPlaceLabel(value))
    .split(" ")
    .map(token => token === "log" ? "logistica" : token)
    .filter(token => token.length >= 2 && !DASHBOARD_PLACE_NOISE_TOKENS.has(token));
}

function dashboardPlaceAcronym(tokens = []) {
  if (tokens.length < 2) return "";
  const acronym = tokens.map(token => token[0]).join("");
  return acronym.length >= 3 ? acronym : "";
}

function dashboardPlaceBaseForms(value) {
  const raw = String(value || "");
  const clean = dashboardCleanPlaceLabel(raw);
  const forms = new Set();
  const pieces = [raw, clean, ...raw.split(/[|/]+/)];
  pieces.forEach(piece => {
    const normalized = normalizePlaceText(piece);
    if (normalized) forms.add(normalized);
    const tokens = dashboardPlaceTokens(piece);
    if (tokens.length) forms.add(tokens.join(" "));
    const acronym = dashboardPlaceAcronym(tokens);
    if (acronym) forms.add(acronym);
  });
  return forms;
}

function dashboardPlaceAliasMap() {
  if (dashboardPlaceAliasCache) return dashboardPlaceAliasCache;
  dashboardPlaceAliasCache = new Map();
  DASHBOARD_PLACE_ALIAS_GROUPS.forEach(group => {
    dashboardPlaceAliasCache.set(group.key.replace(/-/g, " "), group.key);
    group.aliases.forEach(alias => {
      dashboardPlaceBaseForms(alias).forEach(form => dashboardPlaceAliasCache.set(form, group.key));
    });
  });
  return dashboardPlaceAliasCache;
}

function dashboardStaticPlaceCanonicalKey(value) {
  const forms = dashboardPlaceBaseForms(value);
  const aliasMap = dashboardPlaceAliasMap();
  for (const form of forms) {
    const aliasKey = aliasMap.get(form);
    if (aliasKey) return aliasKey;
  }
  const tokens = dashboardPlaceTokens(value);
  if (tokens.length) return tokens.join("-");
  return normalizePlaceText(value).replace(/\s+/g, "-").slice(0, 80);
}

function dashboardStaticPlacesLookRelated(a, b) {
  const leftKey = dashboardStaticPlaceCanonicalKey(a);
  const rightKey = dashboardStaticPlaceCanonicalKey(b);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  const leftTokens = dashboardPlaceTokens(a).filter(token => !DASHBOARD_PLACE_LOCATION_TOKENS.has(token));
  const rightTokens = new Set(dashboardPlaceTokens(b).filter(token => !DASHBOARD_PLACE_LOCATION_TOKENS.has(token)));
  return leftTokens.filter(token => rightTokens.has(token)).length >= 2;
}

function dashboardDynamicAliasAdd(map, targetKey, label) {
  const cleanTarget = String(targetKey || "").trim();
  const cleanLabel = dashboardCleanPlaceLabel(label);
  if (!cleanTarget || !cleanLabel) return;
  map.set(dashboardStaticPlaceCanonicalKey(cleanLabel), cleanTarget);
  dashboardPlaceBaseForms(cleanLabel).forEach(form => map.set(form, cleanTarget));
}

function dashboardDynamicAliasKeyAdd(map, targetKey, aliasKey) {
  const cleanTarget = String(targetKey || "").trim();
  const cleanKey = String(aliasKey || "").trim();
  if (!cleanTarget || !cleanKey) return;
  map.set(cleanKey, cleanTarget);
  map.set(cleanKey.replace(/-/g, " "), cleanTarget);
  const staticKey = dashboardStaticPlaceCanonicalKey(cleanKey);
  if (staticKey) map.set(staticKey, cleanTarget);
}

function dashboardDynamicPlaceAliasSignature() {
  const status = getMonitoramentoLiveStatus();
  const statusRowCount = Number(status.current?.rows?.length || 0) +
    Number(status.confirmed?.length || 0) +
    (status.slots || []).reduce((sum, slot) => sum + Number(slot.rows?.length || 0), 0) +
    Number(state.monitoramentoSnapshot?.confirmed?.length || 0);
  const placeAliasSignature = state.places
    .map(place => [
      place.id || "",
      dashboardCleanPlaceLabel(place.name),
      ...(place.aliases || place.placeAliases || []),
      ...(place.aliasKeys || []),
      ...(place.aliasReviewClusterKeys || []),
      place.aliasReviewClusterKey || "",
      place.aliasReviewedAt || ""
    ].map(value => dashboardCleanPlaceLabel(value)).join("~"))
    .sort()
    .join("||");
  return [
    state.places.length,
    placeAliasSignature,
    statusRowCount,
    status.generatedAt || state.monitoramentoSnapshot?.generatedAt || "",
    status.groupLearning?.totals?.groups || 0,
    status.groupLearning?.totals?.places || 0,
    status.groupLearning?.manualPlacePatterns?.length || 0
  ].join("|");
}

function dashboardDynamicPlaceAliasMap() {
  const signature = dashboardDynamicPlaceAliasSignature();
  if (dashboardDynamicPlaceAliasCache && dashboardDynamicPlaceAliasCacheKey === signature) {
    return dashboardDynamicPlaceAliasCache;
  }
  const map = new Map();
  const officialPlaceById = new Map(state.places.map(place => [place.id, place]));
  const targetKeyFor = item => {
    const official = item?.placeId ? officialPlaceById.get(item.placeId) : null;
    if (official?.name) return dashboardStaticPlaceCanonicalKey(official.name);
    const label = item?.placeName || item?.name || item?.groupSubject || "";
    return dashboardStaticPlaceCanonicalKey(label);
  };
  const addItem = item => {
    const targetKey = targetKeyFor(item);
    if (!targetKey) return;
    dashboardDynamicAliasAdd(map, targetKey, item.placeName || item.name || "");
    dashboardDynamicAliasAdd(map, targetKey, item.groupSubject || "");
    dashboardDynamicAliasAdd(map, targetKey, item.label || "");
    (item.groups || []).forEach(group => {
      dashboardDynamicAliasAdd(map, targetKey, group.groupSubject || "");
      dashboardDynamicAliasAdd(map, targetKey, group.placeName || "");
    });
  };

  state.places.forEach(place => {
    const key = dashboardStaticPlaceCanonicalKey(place.name);
    dashboardDynamicAliasAdd(map, key, place.name);
    (place.aliases || place.placeAliases || []).forEach(alias => dashboardDynamicAliasAdd(map, key, alias));
    (place.aliasKeys || []).forEach(aliasKey => dashboardDynamicAliasKeyAdd(map, key, aliasKey));
    dashboardPlaceReviewedClusterKeys(place).forEach(aliasKey => dashboardDynamicAliasKeyAdd(map, key, aliasKey));
  });

  const status = getMonitoramentoLiveStatus();
  [
    ...(status.groupLearning?.groups || []),
    ...(status.groupLearning?.places || []),
    ...(status.groupLearning?.hourlyPlaces || []),
    ...(status.groupLearning?.shiftStartPlaces || []),
    ...(status.groupLearning?.nonHourlyPlaces || []),
    ...(status.groupLearning?.manualPlacePatterns || [])
  ].forEach(addItem);
  monitoramentoRowsForDashboard().forEach(row => addItem({
    placeId: row.placeId,
    placeName: row.placeName,
    groupSubject: row.groupSubject
  }));

  dashboardDynamicPlaceAliasCache = map;
  dashboardDynamicPlaceAliasCacheKey = signature;
  return map;
}

function dashboardPlaceCanonicalKey(value) {
  const staticKey = dashboardStaticPlaceCanonicalKey(value);
  if (!staticKey) return "";
  const dynamicAliases = dashboardDynamicPlaceAliasMap();
  if (dynamicAliases.has(staticKey)) return dynamicAliases.get(staticKey);
  for (const form of dashboardPlaceBaseForms(value)) {
    const dynamicKey = dynamicAliases.get(form);
    if (dynamicKey) return dynamicKey;
  }
  return staticKey;
}

function dashboardPlaceKnownAliasKeys(place = {}) {
  const labels = [
    place.name,
    ...(place.aliases || place.placeAliases || [])
  ].map(label => dashboardCleanPlaceLabel(label)).filter(Boolean);
  const keys = new Set([
    ...(place.aliasKeys || []),
    ...dashboardPlaceReviewedClusterKeys(place)
  ].filter(Boolean));
  [...keys].forEach(key => {
    const staticKey = dashboardStaticPlaceCanonicalKey(key);
    if (staticKey) keys.add(staticKey);
  });
  labels.forEach(label => {
    const staticKey = dashboardStaticPlaceCanonicalKey(label);
    const dynamicKey = dashboardPlaceCanonicalKey(label);
    if (staticKey) keys.add(staticKey);
    if (dynamicKey) keys.add(dynamicKey);
  });
  return keys;
}

function dashboardPlaceReviewedClusterKeys(place = {}) {
  return [...new Set([
    ...(place.aliasReviewClusterKeys || []),
    place.aliasReviewClusterKey || ""
  ].filter(Boolean))];
}

function dashboardUniqueCleanList(values = [], cleaner = value => String(value || "").trim()) {
  return [...new Map((values || [])
    .map(value => cleaner(value))
    .filter(Boolean)
    .map(value => [normalizeText(value) || value, value])).values()];
}

function dashboardMergePlaceReviewPayload(base = {}, incoming = {}) {
  const aliases = dashboardUniqueCleanList([
    ...(base.aliases || base.placeAliases || []),
    ...(incoming.aliases || incoming.placeAliases || [])
  ], dashboardCleanPlaceLabel);
  const aliasKeys = dashboardUniqueCleanList([
    ...(base.aliasKeys || []),
    ...(incoming.aliasKeys || [])
  ]);
  const aliasReviewClusterKeys = dashboardUniqueCleanList([
    ...dashboardPlaceReviewedClusterKeys(base),
    ...dashboardPlaceReviewedClusterKeys(incoming)
  ]);
  return {
    ...base,
    ...incoming,
    aliases,
    aliasKeys,
    aliasReviewClusterKey: incoming.aliasReviewClusterKey || base.aliasReviewClusterKey || aliasReviewClusterKeys[0] || "",
    aliasReviewClusterKeys,
    aliasReviewedAt: incoming.aliasReviewedAt || base.aliasReviewedAt || "",
    aliasReviewedBy: incoming.aliasReviewedBy || base.aliasReviewedBy || "",
    aliasReviewSource: incoming.aliasReviewSource || base.aliasReviewSource || "rh-dashboard-place-understanding",
    aliasReviewMode: incoming.aliasReviewMode || base.aliasReviewMode || ""
  };
}

function readDashboardPlaceReviewCache() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DASHBOARD_PLACE_REVIEW_CACHE_KEY) || "[]");
    if (Array.isArray(parsed)) return parsed.filter(item => item?.id);
    return Object.values(parsed?.places || {}).filter(item => item?.id);
  } catch (error) {
    console.warn("Falha ao ler cache local de revisao de postos", error);
    return [];
  }
}

function writeDashboardPlaceReviewCache(items = []) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(DASHBOARD_PLACE_REVIEW_CACHE_KEY, JSON.stringify(items.filter(item => item?.id).slice(-500)));
  } catch (error) {
    console.warn("Falha ao salvar cache local de revisao de postos", error);
  }
}

function rememberDashboardPlaceReviewPayload(payload = {}) {
  if (!payload.id) return;
  const items = readDashboardPlaceReviewCache();
  const index = items.findIndex(item => item.id === payload.id);
  if (index >= 0) items[index] = dashboardMergePlaceReviewPayload(items[index], payload);
  else items.push(dashboardMergePlaceReviewPayload({ id: payload.id }, payload));
  writeDashboardPlaceReviewCache(items);
}

function applyDashboardPlaceReviewCache() {
  const items = readDashboardPlaceReviewCache();
  if (!items.length) return false;
  let changed = false;
  items.forEach(payload => {
    const index = state.places.findIndex(place => place.id === payload.id);
    if (index >= 0) {
      state.places[index] = dashboardMergePlaceReviewPayload(state.places[index], payload);
      changed = true;
    } else if (payload.name) {
      state.places.push(payload);
      changed = true;
    }
  });
  if (changed) resetDashboardPlaceAliasCache();
  return changed;
}

function dashboardUnresolvedAliasesForOfficial(aliases = [], officialPlace = null) {
  if (!officialPlace?.name) return aliases;
  const officialKey = dashboardPlaceCanonicalKey(officialPlace.name);
  const officialName = normalizeText(officialPlace.name);
  const knownKeys = dashboardPlaceKnownAliasKeys(officialPlace);
  return aliases.filter(label => {
    const cleanLabel = dashboardCleanPlaceLabel(label);
    if (!cleanLabel || normalizeText(cleanLabel) === officialName) return false;
    const staticKey = dashboardStaticPlaceCanonicalKey(cleanLabel);
    const dynamicKey = dashboardPlaceCanonicalKey(cleanLabel);
    if ((staticKey && knownKeys.has(staticKey)) || (dynamicKey && knownKeys.has(dynamicKey))) return false;
    if (dynamicKey && officialKey && dynamicKey === officialKey) return false;
    return !placesLookRelated(cleanLabel, officialPlace.name);
  });
}

function dashboardOfficialPlaceLookupMap() {
  const map = new Map();
  state.places.forEach(place => {
    dashboardPlaceKnownAliasKeys(place).forEach(key => {
      if (key && !map.has(key)) map.set(key, place);
    });
    const officialKey = dashboardPlaceCanonicalKey(place.name);
    if (officialKey && !map.has(officialKey)) map.set(officialKey, place);
  });
  return map;
}

function dashboardPlaceLocationSet(value) {
  const tokens = new Set(dashboardPlaceTokens(value));
  const locations = new Set();
  if (tokens.has("sjc") || (tokens.has("sao") && tokens.has("jose") && tokens.has("campos"))) locations.add("sjc");
  if (tokens.has("jac") || tokens.has("jacarei")) locations.add("jacarei");
  if (tokens.has("tte") || tokens.has("taubate")) locations.add("taubate");
  if (tokens.has("cacapava")) locations.add("cacapava");
  return locations;
}

function dashboardPlaceLocationsCompatible(a, b) {
  const left = dashboardPlaceLocationSet(a);
  const right = dashboardPlaceLocationSet(b);
  if (!left.size || !right.size) return true;
  return [...left].some(token => right.has(token));
}

function dashboardPlaceNameScore(value) {
  const text = String(value || "").trim();
  const tokens = dashboardPlaceTokens(text);
  let score = tokens.length * 12 + Math.min(text.length, 80);
  if (/[?\uFFFD]/.test(text)) score -= 30;
  if (/[|/]/.test(text)) score -= 8;
  if (tokens.length === 1) score -= 4;
  return score;
}

function placeName(id) {
  return state.places.find(item => item.id === id)?.name || "Sem local";
}

function workerName(id) {
  return state.workers.find(item => item.id === id)?.name || "Sem funcionario";
}

function getJobFunctionByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  return state.jobFunctions.find(item => normalizeText(item.name) === normalized) || null;
}

function getSuggestedFtValue(role, fallback = "") {
  const matched = getJobFunctionByName(role);
  if (matched) return Number(matched.value || 0);
  if (fallback === "" || fallback === null || typeof fallback === "undefined") return "";
  return Number(fallback || 0);
}

function getProfileFtValue(profile) {
  if (!profile) return 0;
  const storedValue = Number(profile.precoFt || 0);
  if (storedValue > 0) return storedValue;
  return Number(getSuggestedFtValue(profile.cargo, storedValue) || 0);
}

function getFtReason(item) {
  return String(item?.reason || "").trim();
}

function getFtRoleLabel(item) {
  const role = String(item?.role || "").trim();
  const reason = getFtReason(item);
  if (role && reason) return `${role} / ${reason}`;
  return role || reason || "Sem motivo";
}

function resolveDashboardFtDefaults(workerId, manualReason, manualHours, manualValue) {
  const profile = getWorkerProfile(workerId);
  const hoursNumber = Number(manualHours);
  const valueNumber = Number(manualValue);
  return {
    profile,
    role: profile?.cargo || "",
    reason: String(manualReason || "").trim(),
    hours: manualHours !== "" && !Number.isNaN(hoursNumber) ? hoursNumber : 12,
    value: manualValue !== "" && !Number.isNaN(valueNumber) ? valueNumber : getProfileFtValue(profile)
  };
}

function scaleName(id) {
  return state.scales.find(item => item.id === id)?.name || "Sem escala";
}

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatFtDate(date) {
  return String(date || "").split("-").reverse().join("/");
}

function formatFtTimeRange(startTime, hours) {
  if (!startTime) return "--:--";
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return startTime;
  const totalMinutes = h * 60 + m + Math.round(Number(hours || 0) * 60);
  const endHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const endMinutes = totalMinutes % 60;
  return `${startTime} - ${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function formatFtRowText(item) {
  return `${formatFtDate(item.date)} -- ${formatFtTimeRange(item.startTime, item.hours)} -- ${item.hours || ""} horas -- ${currency(item.value)} -- ${getFtRoleLabel(item)}`;
}

function getWorkerProfile(workerId) {
  return state.workerProfiles.find(item => item.workerId === workerId) || null;
}

function findWorkerByFtEntry(ft) {
  if (ft?.workerId) {
    const byId = state.workers.find(item => item.id === ft.workerId);
    if (byId) return byId;
  }
  const normalizedName = normalizeText(ft?.name || "");
  if (!normalizedName) return null;
  return state.workers.find(item => normalizeText(item.name) === normalizedName) || null;
}

function getMonitoramentoLiveStatus() {
  const snapshot = state.monitoramentoSnapshot || {};
  return snapshot.status || snapshot.summary?.status || snapshot.summary || snapshot;
}

function monitoramentoRowsForDashboard() {
  const status = getMonitoramentoLiveStatus();
  const rows = [];
  const appendRows = list => {
    if (Array.isArray(list)) rows.push(...list);
  };
  appendRows(status.current?.rows);
  (status.slots || []).forEach(slot => appendRows(slot.rows));
  appendRows(status.confirmed);
  appendRows(state.monitoramentoSnapshot?.confirmed);
  return rows;
}

function monitoramentoDeclaredPlaceNames() {
  return dashboardAutoPlaceRecords()
    .filter(item => item.sourceLabels?.has("WhatsApp Monitoramento"))
    .map(item => item.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function dashboardLooksLikeWorkplaceName(name) {
  const normalized = normalizeText(dashboardCleanPlaceLabel(name));
  if (!normalized) return false;
  const nonWorkplaceTokens = [
    "supervisao informes",
    "informes e ocorrencias",
    "ocorrencias",
    "monitoramento",
    "grupo geral",
    "recursos humanos",
    "rh automatizado",
    "teste",
    "treinamento"
  ];
  return !nonWorkplaceTokens.some(token => normalized.includes(token.trim()));
}

function dashboardMonitoramentoSourceLooksOperational(data = {}) {
  if (!data || typeof data !== "object") return true;
  const mode = normalizeText(data.mode || data.modeLabel || "");
  const hasPolicy = Boolean(
    data.requiresHourly ||
    data.requiresShiftStart ||
    data.requiresShiftHandoff ||
    data.requiresPlaceStatus ||
    data.manualPlacePolicy ||
    data.shiftStartHours?.length ||
    data.shiftEndHours?.length ||
    data.shiftHandoffHours?.length
  );
  if (hasPolicy) return true;
  if (mode.includes("conversation") || mode.includes("incident")) return false;
  return true;
}

function findPlaceByMonitoramentoName(name) {
  const key = dashboardPlaceCanonicalKey(name);
  if (!key) return null;
  const exact = state.places.find(item => dashboardPlaceCanonicalKey(item.name) === key);
  if (exact) return exact;
  return state.places.find(item => placesLookRelated(item.name, name)) || null;
}

function findWorkerByMonitoramentoName(name) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;
  const exact = state.workers.find(item => normalizeText(item.name) === normalizedName);
  if (exact) return exact;
  return state.workers.find(item => {
    const workerText = normalizeText(item.name);
    return workerText.length >= 8 && normalizedName.length >= 8 && (workerText.includes(normalizedName) || normalizedName.includes(workerText));
  }) || null;
}

function dashboardSyntheticPlaceId(name) {
  const slug = dashboardPlaceCanonicalKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "posto";
  return `monitoramento-place-${slug}`;
}

function dashboardMergeHours(current = [], incoming = []) {
  const hours = new Set((current || []).map(Number).filter(hour => Number.isFinite(hour)));
  (incoming || []).map(Number).filter(hour => Number.isFinite(hour)).forEach(hour => hours.add(hour));
  return [...hours].sort((a, b) => a - b);
}

function dashboardHoursText(hours = []) {
  const clean = dashboardMergeHours([], hours);
  if (!clean.length) return "";
  return clean.map(hour => `${String(hour).padStart(2, "0")}h`).join(", ");
}

function dashboardAutoPlaceRecords() {
  const records = new Map();
  const upsert = (name, sourceLabel, data = {}) => {
    if (sourceLabel === "WhatsApp Monitoramento" && !dashboardMonitoramentoSourceLooksOperational(data)) return null;
    const rawName = String(name || "").trim();
    const cleanName = dashboardCleanPlaceLabel(rawName);
    if (!cleanName || !dashboardLooksLikeWorkplaceName(cleanName)) return null;
    const key = dashboardPlaceCanonicalKey(cleanName);
    if (!key) return null;
    if (!records.has(key)) {
      records.set(key, {
        key,
        id: dashboardSyntheticPlaceId(cleanName),
        name: cleanName,
        nameScore: dashboardPlaceNameScore(cleanName),
        city: "",
        sourceLabels: new Set(),
        aliasLabels: new Set(),
        shiftStartHours: [],
        shiftEndHours: [],
        shiftHandoffHours: [],
        requiresHourly: false,
        requiresShiftStart: false,
        requiresShiftHandoff: false,
        requiresPlaceStatus: false,
        policySummaries: new Set(),
        sourceSummaries: new Set()
      });
    }
    const record = records.get(key);
    const nameScore = dashboardPlaceNameScore(cleanName);
    if (nameScore > Number(record.nameScore || 0)) {
      record.name = cleanName;
      record.nameScore = nameScore;
    }
    if (rawName) record.aliasLabels.add(rawName);
    record.aliasLabels.add(cleanName);
    if (sourceLabel) record.sourceLabels.add(sourceLabel);
    if (data.placeId && !record.monitoramentoPlaceId) record.monitoramentoPlaceId = data.placeId;
    if (data.city && !record.city) record.city = data.city;
    record.shiftStartHours = dashboardMergeHours(record.shiftStartHours, data.shiftStartHours || data.manualPlacePolicy?.shiftStartHours);
    record.shiftEndHours = dashboardMergeHours(record.shiftEndHours, data.shiftEndHours || data.manualPlacePolicy?.shiftEndHours);
    record.shiftHandoffHours = dashboardMergeHours(record.shiftHandoffHours, data.shiftHandoffHours);
    record.requiresHourly = record.requiresHourly || Boolean(data.requiresHourly);
    record.requiresShiftStart = record.requiresShiftStart || Boolean(data.requiresShiftStart || record.shiftStartHours.length);
    record.requiresShiftHandoff = record.requiresShiftHandoff || Boolean(data.requiresShiftHandoff || record.shiftHandoffHours.length);
    record.requiresPlaceStatus = record.requiresPlaceStatus || Boolean(data.requiresPlaceStatus);
    const policySummary = data.manualPlacePolicy?.summary || data.shiftStartWindowSummary || data.learnedWindow || data.observedWindow || "";
    if (policySummary) record.policySummaries.add(String(policySummary).slice(0, 160));
    const sourceSummary = data.source || data.scheduleSource || "";
    if (sourceSummary) record.sourceSummaries.add(String(sourceSummary).slice(0, 80));
    return record;
  };

  const status = getMonitoramentoLiveStatus();
  ["hourlyPlaces", "shiftStartPlaces", "nonHourlyPlaces"].forEach(key => {
    (status.groupLearning?.[key] || []).forEach(place => upsert(place.placeName || place.groupSubject, "WhatsApp Monitoramento", place));
  });
  (status.groupLearning?.manualPlacePatterns || []).forEach(place => upsert(place.placeName || place.groupSubject, "WhatsApp Monitoramento", place));
  monitoramentoRowsForDashboard().forEach(row => upsert(row.placeName || row.groupSubject, "WhatsApp Monitoramento", row));

  (state.collaboratorSheetWorkers || []).forEach(record => {
    const parsed = record.parsed || {};
    upsert(record.place || parsed.place, "Planilha RH", {
      city: record.city || parsed.city || "",
      source: record.source || parsed.source || ""
    });
  });

  return [...records.values()];
}

function dashboardPlaceAutoMeta(place = {}) {
  const parts = [];
  if (place.sourceLabels?.size) parts.push([...place.sourceLabels].join(" + "));
  const aliases = [...(place.aliasLabels || [])]
    .filter(label => normalizeText(label) && normalizeText(label) !== normalizeText(place.name || ""))
    .slice(0, 3);
  if (aliases.length) parts.push(`Aliases: ${aliases.join(", ")}`);
  const startText = dashboardHoursText(place.shiftStartHours);
  const endText = dashboardHoursText(place.shiftEndHours);
  const handoffText = dashboardHoursText(place.shiftHandoffHours);
  if (startText) parts.push(`Inicio: ${startText}`);
  if (endText) parts.push(`Fim: ${endText}`);
  if (handoffText) parts.push(`Passagem: ${handoffText}`);
  if (place.requiresHourly) parts.push("Informe horario");
  if (place.requiresPlaceStatus) parts.push("Status do posto");
  const policy = [...(place.policySummaries || [])][0];
  if (policy && !startText && !endText) parts.push(policy);
  return parts.join(" | ");
}

function dashboardSelectedWindow(date) {
  const selectedStart = new Date(`${date}T00:00:00`).getTime();
  const selectedEnd = selectedStart + 24 * 60 * 60 * 1000;
  if (date === today) {
    return { start: Date.now() - DASHBOARD_LIVE_WORK_WINDOW_MS, end: Date.now() + 60 * 60 * 1000 };
  }
  return { start: selectedStart, end: selectedEnd };
}

function dashboardEvidenceMs(row = {}) {
  return ["lastEvidenceAt", "lastReportAt", "confirmedAt", "firstReportAt", "operatorShiftResolvedAt"]
    .reduce((best, field) => Math.max(best, dashboardDateMs(row[field])), 0);
}

function dashboardEvidenceLooksActive(row = {}) {
  const text = normalizeText([
    row.requirementType,
    row.status,
    row.lastReportSemantic,
    row.intent,
    row.reviewReason,
    row.aiSuggestion?.lane
  ].join(" "));
  if (!text) return true;
  return ![
    "shift_end",
    "fim de turno",
    "final de turno",
    "saida de posto",
    "saiu do posto",
    "encerramento"
  ].some(term => text.includes(term));
}

function dashboardMonitoramentoWorkerName(row = {}) {
  const workerNameValue = String(row.workerName || "").trim();
  if (workerNameValue) return workerNameValue;
  const contactName = String(row.contactName || "").trim();
  return contactName && findWorkerByMonitoramentoName(contactName) ? contactName : "";
}

function dashboardMonitoramentoPlaceName(row = {}) {
  return String(row.placeName || row.groupSubject || "").trim();
}

function monitoramentoStatusLabel(row = {}) {
  const status = String(row.status || "").replace(/_/g, " ");
  const requirement = String(row.requirementType || "").replace(/_/g, " ");
  const semantic = String(row.lastReportSemantic || row.intent || row.reviewReason || "").trim();
  return [requirement, status, semantic].filter(Boolean).join(" / ") || "WhatsApp Monitoramento";
}

function monitoramentoShiftLabel(row = {}) {
  const parts = [];
  if (row.role) parts.push(row.role);
  if (row.scale) parts.push(row.scale);
  if (row.startTime) parts.push(`inicio ${row.startTime}`);
  const learnedStart = dashboardHoursText(row.shiftStartLearnedHours);
  if (learnedStart) parts.push(`inicio aprendido ${learnedStart}`);
  const learnedWindow = String(row.learnedWindow || row.observedWindow || "").trim();
  if (learnedWindow && parts.length < 3) parts.push(learnedWindow);
  return parts.join(" | ");
}

function dashboardIsNightOnlyRecord(record = {}) {
  const starts = dashboardMergeHours([], record.shiftStartHours);
  const ends = dashboardMergeHours([], record.shiftEndHours);
  return starts.length === 1 && starts[0] === 19 && ends.length === 1 && ends[0] === 7;
}

function dashboardAllowsLiveEvidenceNow(placeLabel, date, autoByName) {
  if (date !== today) return true;
  const record = autoByName.get(dashboardPlaceCanonicalKey(placeLabel));
  if (!dashboardIsNightOnlyRecord(record)) return true;
  const currentHour = new Date().getHours();
  return currentHour >= 19 || currentHour < 7;
}

function dashboardScaleShiftKind(scaleId = "", fallback = "") {
  const text = normalizeText(`${scaleName(scaleId)} ${scalePattern(scaleId)} ${fallback}`);
  if (text.includes("noturno")) return "night";
  if (text.includes("diurno")) return "day";
  const firstSeven = text.indexOf("07");
  const firstNineteen = text.indexOf("19");
  if (firstNineteen >= 0 && firstSeven >= 0) return firstNineteen < firstSeven ? "night" : "day";
  return "";
}

function dashboardHourMatchesShiftKind(kind, hour) {
  if (kind === "night") return hour >= 19 || hour < 7;
  if (kind === "day") return hour >= 7 && hour < 19;
  return true;
}

function dashboardCandidateScaleCompatible(scaleId = "", fallback = "", evidenceAtMs = Date.now()) {
  const kind = dashboardScaleShiftKind(scaleId, fallback);
  if (!kind) return { ok: true, kind: "", label: "" };
  const hour = new Date(evidenceAtMs || Date.now()).getHours();
  return {
    ok: dashboardHourMatchesShiftKind(kind, hour),
    kind,
    label: kind === "night" ? "noturno" : "diurno"
  };
}

function dashboardPlaceMatchesLabel(placeId = "", placeLabel = "") {
  if (!placeId || !placeLabel) return false;
  const place = state.places.find(item => item.id === placeId);
  return Boolean(place && placesLookRelated(place.name, placeLabel));
}

function dashboardSheetRecordsForPlace(placeLabel = "") {
  return (state.collaboratorSheetWorkers || []).filter(record => {
    const parsed = record.parsed || {};
    const recordPlace = record.place || parsed.place || "";
    return placesLookRelated(recordPlace, placeLabel);
  });
}

function dashboardCandidateKey(candidate = {}) {
  return candidate.worker?.id || `name:${normalizeText(candidate.workerNameText || "")}`;
}

function dashboardMergeCandidate(existing, incoming) {
  existing.score += incoming.score;
  existing.sources = [...new Set([...(existing.sources || []), ...(incoming.sources || [])])];
  existing.scaleId = existing.scaleId || incoming.scaleId || "";
  existing.profile = existing.profile || incoming.profile || null;
  existing.sheetRecord = existing.sheetRecord || incoming.sheetRecord || null;
  existing.shiftKindLabel = existing.shiftKindLabel || incoming.shiftKindLabel || "";
  return existing;
}

function dashboardCandidatesForActivePlace(placeLabel = "", evidenceAtMs = Date.now()) {
  const candidates = new Map();
  const place = findPlaceByMonitoramentoName(placeLabel);
  const addCandidate = candidate => {
    const key = dashboardCandidateKey(candidate);
    if (!key || !candidate.workerNameText) return;
    if (candidates.has(key)) dashboardMergeCandidate(candidates.get(key), candidate);
    else candidates.set(key, candidate);
  };

  state.workerProfiles.forEach(profile => {
    if (!dashboardPlaceMatchesLabel(profile.placeId, placeLabel)) return;
    const worker = state.workers.find(item => item.id === profile.workerId);
    if (!worker) return;
    const scaleCheck = dashboardCandidateScaleCompatible(profile.scaleId, profile.cargo || "", evidenceAtMs);
    if (!scaleCheck.ok) return;
    addCandidate({
      worker,
      workerNameText: worker.name,
      profile,
      scaleId: profile.scaleId || "",
      sources: ["perfil RH"],
      shiftKindLabel: scaleCheck.label,
      score: 3 + (scaleCheck.label ? 1 : 0)
    });
  });

  dashboardSheetRecordsForPlace(placeLabel).forEach(record => {
    const parsed = record.parsed || {};
    const name = String(record.name || parsed.name || "").trim();
    if (!name) return;
    const worker = findWorkerByMonitoramentoName(name);
    const profile = worker?.id ? getWorkerProfile(worker.id) : null;
    const scaleFallback = `${record.scale || parsed.scale || ""} ${record.period || parsed.period || ""} ${record.role || parsed.role || ""}`;
    const scaleCheck = dashboardCandidateScaleCompatible(profile?.scaleId || "", scaleFallback, evidenceAtMs);
    if (!scaleCheck.ok) return;
    addCandidate({
      worker: worker || null,
      workerNameText: worker?.name || name,
      profile,
      sheetRecord: record,
      scaleId: profile?.scaleId || "",
      sources: ["planilha RH"],
      shiftKindLabel: scaleCheck.label,
      score: 2 + (worker ? 1 : 0) + (scaleCheck.label ? 1 : 0)
    });
  });

  return [...candidates.values()]
    .filter(candidate => candidate.workerNameText)
    .sort((a, b) => b.score - a.score || a.workerNameText.localeCompare(b.workerNameText, "pt-BR"))
    .map(candidate => ({
      ...candidate,
      placeId: place?.id || dashboardSyntheticPlaceId(placeLabel),
      placeNameText: place?.name || placeLabel
    }));
}

function getMonitoramentoInferredWorkEntriesForDate(date, occupiedWorkers = new Set(), entryKeys = new Set()) {
  const { start, end } = dashboardSelectedWindow(date);
  const autoByName = new Map(dashboardAutoPlaceRecords().map(record => [record.key, record]));
  const inferred = [];
  const seenPlaces = new Set();

  monitoramentoRowsForDashboard().forEach(row => {
    const placeLabel = dashboardMonitoramentoPlaceName(row);
    const placeKey = dashboardPlaceCanonicalKey(placeLabel);
    if (!placeLabel || !placeKey || seenPlaces.has(placeKey)) return;
    if (!dashboardLooksLikeWorkplaceName(placeLabel)) return;
    if (dashboardMonitoramentoWorkerName(row)) return;
    if (!dashboardEvidenceLooksActive(row)) return;
    if (!dashboardAllowsLiveEvidenceNow(placeLabel, date, autoByName)) return;
    const evidenceAtMs = dashboardEvidenceMs(row);
    if (!evidenceAtMs || evidenceAtMs < start || evidenceAtMs > end) return;
    seenPlaces.add(placeKey);

    const candidates = dashboardCandidatesForActivePlace(placeLabel, evidenceAtMs).filter(candidate => {
      const workerKey = dashboardCandidateKey(candidate);
      if (!workerKey || occupiedWorkers.has(workerKey) || (candidate.worker?.id && occupiedWorkers.has(candidate.worker.id))) return false;
      const entryKey = `${date}|${candidate.placeId}|${candidate.worker?.id || workerKey}`;
      return !entryKeys.has(entryKey);
    });
    if (candidates.length !== 1) return;

    const candidate = candidates[0];
    const workerKey = dashboardCandidateKey(candidate);
    occupiedWorkers.add(workerKey);
    if (candidate.worker?.id) occupiedWorkers.add(candidate.worker.id);
    entryKeys.add(`${date}|${candidate.placeId}|${candidate.worker?.id || workerKey}`);
    inferred.push({
      id: `monitoramento-inferred-${row.reportId || row.sourceMessageId || `${candidate.placeId}-${workerKey}-${evidenceAtMs}`}`,
      date,
      placeId: candidate.placeId,
      workerId: candidate.worker?.id || "",
      workerNameText: candidate.workerNameText,
      placeNameText: candidate.placeNameText,
      type: "Inferido por atividade",
      scaleId: candidate.scaleId || "",
      evidenceAt: new Date(evidenceAtMs).toISOString(),
      evidenceAtMs,
      monitoramentoStatus: row.status || "",
      monitoramentoRequirement: row.requirementType || "",
      monitoramentoSemantic: `posto ativo sem trabalhador identificado / ${candidate.sources.join(" + ")}`,
      monitoramentoShiftText: candidate.shiftKindLabel ? `candidato ${candidate.shiftKindLabel}` : "",
      derivedFromMonitoramento: true,
      derivedFromUnifiedInference: true,
      monitoramentoReview: true
    });
  });

  return inferred.sort((a, b) => b.evidenceAtMs - a.evidenceAtMs);
}

function getMonitoramentoLiveWorkEntriesForDate(date, occupiedWorkers = new Set(), entryKeys = new Set()) {
  const { start, end } = dashboardSelectedWindow(date);
  const byWorker = new Map();
  const autoByName = new Map(dashboardAutoPlaceRecords().map(record => [record.key, record]));

  monitoramentoRowsForDashboard().forEach(row => {
    const workerLabel = dashboardMonitoramentoWorkerName(row);
    const placeLabel = dashboardMonitoramentoPlaceName(row);
    if (!workerLabel || !placeLabel || !dashboardLooksLikeWorkplaceName(placeLabel)) return;
    if (!dashboardEvidenceLooksActive(row)) return;
    if (!dashboardAllowsLiveEvidenceNow(placeLabel, date, autoByName)) return;
    const evidenceAtMs = dashboardEvidenceMs(row);
    if (!evidenceAtMs || evidenceAtMs < start || evidenceAtMs > end) return;

    const worker = findWorkerByMonitoramentoName(workerLabel);
    const workerKey = worker?.id || `name:${normalizeText(workerLabel)}`;
    if (!workerKey || occupiedWorkers.has(workerKey) || (worker?.id && occupiedWorkers.has(worker.id))) return;

    const place = findPlaceByMonitoramentoName(placeLabel);
    const placeId = place?.id || dashboardSyntheticPlaceId(placeLabel);
    const entryKey = `${date}|${placeId}|${worker?.id || workerKey}`;
    if (entryKeys.has(entryKey)) return;

    const profile = worker?.id ? getWorkerProfile(worker.id) : null;
    const candidate = {
      id: `monitoramento-derived-${row.reportId || row.sourceMessageId || `${placeId}-${workerKey}-${evidenceAtMs}`}`,
      date,
      placeId,
      workerId: worker?.id || "",
      workerNameText: worker?.name || workerLabel,
      placeNameText: place?.name || placeLabel,
      type: row.requirementType === "shift_start" ? "Inicio confirmado" : "Evidencia Monitoramento",
      scaleId: profile?.scaleId || "",
      evidenceAt: new Date(evidenceAtMs).toISOString(),
      evidenceAtMs,
      monitoramentoStatus: row.status || "",
      monitoramentoRequirement: row.requirementType || "",
      monitoramentoSemantic: monitoramentoStatusLabel(row),
      monitoramentoShiftText: monitoramentoShiftLabel(row),
      derivedFromMonitoramento: true,
      monitoramentoReview: String(row.status || "").includes("review") || Boolean(row.reviewReason)
    };
    const previous = byWorker.get(workerKey);
    if (!previous || candidate.evidenceAtMs > previous.evidenceAtMs) byWorker.set(workerKey, candidate);
  });

  return [...byWorker.values()].sort((a, b) => b.evidenceAtMs - a.evidenceAtMs);
}

function dashboardEntryWorkerName(entry = {}) {
  return entry.workerNameText || workerName(entry.workerId);
}

function getDashboardPlacesForRender(dashboardEntries, search) {
  const autoRecords = dashboardAutoPlaceRecords();
  const autoByName = new Map(autoRecords.map(record => [record.key, record]));
  const places = state.places.map(place => {
    const autoRecord = autoByName.get(dashboardPlaceCanonicalKey(place.name));
    return autoRecord ? {
      ...place,
      sourceLabels: autoRecord.sourceLabels,
      aliasLabels: autoRecord.aliasLabels,
      shiftStartHours: autoRecord.shiftStartHours,
      shiftEndHours: autoRecord.shiftEndHours,
      shiftHandoffHours: autoRecord.shiftHandoffHours,
      requiresHourly: autoRecord.requiresHourly,
      requiresShiftStart: autoRecord.requiresShiftStart,
      requiresShiftHandoff: autoRecord.requiresShiftHandoff,
      requiresPlaceStatus: autoRecord.requiresPlaceStatus,
      policySummaries: autoRecord.policySummaries,
      sourceSummaries: autoRecord.sourceSummaries,
      autoFilledPlace: true
    } : place;
  });
  const seen = new Set(places.map(place => dashboardPlaceCanonicalKey(place.name)));
  autoRecords.forEach(record => {
    if (seen.has(record.key)) return;
    seen.add(record.key);
    places.push({
      id: record.id,
      name: record.name,
      city: record.city || [...record.sourceLabels].join(" + ") || "Fonte automatica",
      derivedFromAutoSource: true,
      derivedFromMonitoramento: record.sourceLabels.has("WhatsApp Monitoramento"),
      sourceLabels: record.sourceLabels,
      aliasLabels: record.aliasLabels,
      shiftStartHours: record.shiftStartHours,
      shiftEndHours: record.shiftEndHours,
      shiftHandoffHours: record.shiftHandoffHours,
      requiresHourly: record.requiresHourly,
      requiresShiftStart: record.requiresShiftStart,
      requiresShiftHandoff: record.requiresShiftHandoff,
      requiresPlaceStatus: record.requiresPlaceStatus,
      policySummaries: record.policySummaries,
      sourceSummaries: record.sourceSummaries
    });
  });
  dashboardEntries.forEach(entry => {
    if (!entry.derivedFromMonitoramento || !entry.placeNameText) return;
    const placeKey = dashboardPlaceCanonicalKey(entry.placeNameText);
    if (!placeKey || seen.has(placeKey) || state.places.some(place => place.id === entry.placeId || placesLookRelated(place.name, entry.placeNameText))) return;
    seen.add(placeKey);
    places.push({
      id: entry.placeId,
      name: entry.placeNameText,
      city: "WhatsApp Monitoramento",
      derivedFromAutoSource: true,
      derivedFromMonitoramento: true,
      sourceLabels: new Set(["WhatsApp Monitoramento"])
    });
  });
  const normalizedSearch = normalizeText(search);
  return sortedByName(
    places.filter(place => !normalizedSearch || normalizeText(`${place.name} ${place.city}`).includes(normalizedSearch)),
    el.dashSort.value
  );
}

function getDashboardEntriesForDate(date) {
  const realEntries = state.entries.filter(item => item.date === date);
  const entryKeys = new Set(realEntries.map(item => `${item.date}|${item.placeId}|${item.workerId}`));
  const occupiedWorkers = new Set(realEntries.map(item => item.workerId).filter(Boolean));
  const derivedFtEntries = state.ftEntries.reduce((list, ft) => {
    if (ft.date !== date) return list;
    const worker = findWorkerByFtEntry(ft);
    if (!worker?.id) return list;
    const key = `${ft.date}|${ft.placeId}|${worker.id}`;
    if (entryKeys.has(key)) return list;
    occupiedWorkers.add(worker.id);
    list.push({
      id: `ft-derived-${ft.id}`,
      date: ft.date,
      placeId: ft.placeId,
      workerId: worker.id,
      type: "Folga Trabalhada",
      scaleId: getWorkerProfile(worker.id)?.scaleId || "",
      ftEntryId: ft.id,
      derivedFromFt: true
    });
    return list;
  }, []);
  derivedFtEntries.forEach(entry => {
    entryKeys.add(`${entry.date}|${entry.placeId}|${entry.workerId}`);
  });
  const monitoramentoEntries = getMonitoramentoLiveWorkEntriesForDate(date, occupiedWorkers, entryKeys);
  monitoramentoEntries.forEach(entry => {
    const workerKey = entry.workerId || `name:${normalizeText(entry.workerNameText)}`;
    occupiedWorkers.add(workerKey);
    if (entry.workerId) occupiedWorkers.add(entry.workerId);
    entryKeys.add(`${entry.date}|${entry.placeId}|${entry.workerId || workerKey}`);
  });
  const inferredEntries = getMonitoramentoInferredWorkEntriesForDate(date, occupiedWorkers, entryKeys);
  return [...realEntries, ...derivedFtEntries, ...monitoramentoEntries, ...inferredEntries];
}

function syncProfileFtValueFromRole(force = false) {
  const suggested = getSuggestedFtValue(el.profileCargo.value.trim());
  if (suggested === "") return;
  if (force || !el.profilePrecoFt.value) {
    el.profilePrecoFt.value = suggested;
  }
}

function syncFtValueFromRole(force = false) {
  const suggested = getSuggestedFtValue(el.ftRole.value.trim());
  if (suggested === "") return;
  if (force || !el.ftValue.value) {
    el.ftValue.value = suggested;
  }
}

function isWorkerFt(workerId, placeId) {
  const profile = getWorkerProfile(workerId);
  if (!profile) return false;
  return profile.placeId !== placeId;
}

function docCompanyName(value) {
  return RH_DOCUMENTATION_COMPANIES[value] || "Empresa nao informada";
}

function blankDocumentation() {
  return {
    id: "",
    workerId: "",
    fullName: "",
    cpf: "",
    rg: "",
    ctps: "",
    tituloEleitor: "",
    reservista: "",
    company: "tka-seguranca-privada",
    role: "",
    birthDate: "",
    phone: "",
    email: "",
    zipCode: "",
    address: "",
    addressNumber: "",
    addressComplement: "",
    neighborhood: "",
    city: "",
    stateName: "",
    education: "",
    cnv: "",
    courseCertificate: "",
    healthCertificate: "",
    criminalRecord: "",
    notes: "",
    files: []
  };
}

function currentDocumentation() {
  return state.documentation.find(item => item.id === state.currentDocId) || null;
}

function renderSimpleSelect(selectEl, list, emptyLabel, selectedValue = "") {
  selectEl.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` +
    sortedByName(list).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  const hasSelected = list.some(item => item.id === selectedValue);
  selectEl.value = hasSelected ? selectedValue : "";
}

function renderList(container, list, titleFn, subtitleFn, onEdit, onDelete) {
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = `<div class="row"><span class="muted">Sem itens cadastrados.</span></div>`;
    return;
  }
  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${escapeHtml(titleFn(item))}</span>
        <span class="row-subtitle">${escapeHtml(subtitleFn(item) || "")}</span>
      </div>
      <div class="actions">
        <button data-edit="${escapeHtml(item.id)}">Editar</button>
        <button class="danger" data-del="${escapeHtml(item.id)}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit]").onclick = () => onEdit(item.id);
    row.querySelector("[data-del]").onclick = () => onDelete(item.id);
    container.appendChild(row);
  });
}

function renderInlinePlaceList() {
  const places = sortedByName(state.places, el.placeSort.value);
  el.placeList.innerHTML = "";
  if (!places.length) {
    el.placeList.innerHTML = `<div class="row"><span class="muted">Sem itens cadastrados.</span></div>`;
    return;
  }
  places.forEach(place => {
    const row = document.createElement("div");
    row.className = "list-item-stack";
    const aliasText = (place.aliases || place.placeAliases || []).filter(Boolean).slice(0, 5).join(" / ");
    const placeSubtitle = [place.city || "", aliasText ? `Aliases: ${aliasText}` : ""].filter(Boolean).join(" | ");
    if (state.editingPlaceId === place.id) {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${escapeHtml(place.name)}</span>
            <span class="row-subtitle">${escapeHtml(placeSubtitle)}</span>
          </div>
        </div>
        <form class="inline-form inline-edit-form" data-inline-place="${escapeHtml(place.id)}">
          <input name="name" value="${escapeHtml(place.name || "")}" placeholder="Nome do local" required>
          <input name="city" value="${escapeHtml(place.city || "")}" placeholder="Cidade" required>
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-inline-cancel>Cancelar</button>
        </form>
      `;
      row.querySelector("form").onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await setEntity("places", {
          id: place.id,
          name: String(formData.get("name") || "").trim(),
          city: String(formData.get("city") || "").trim(),
          aliases: place.aliases || place.placeAliases || []
        });
        resetPlaceForm();
      };
      row.querySelector("[data-inline-cancel]").onclick = () => resetPlaceForm();
    } else {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${escapeHtml(place.name)}</span>
            <span class="row-subtitle">${escapeHtml(placeSubtitle)}</span>
          </div>
          <div class="actions">
            <button data-edit="${place.id}">Editar</button>
            <button class="danger" data-del="${place.id}">Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-edit]").onclick = () => {
        state.editingPlaceId = place.id;
        renderAll();
      };
      row.querySelector("[data-del]").onclick = async () => {
        await deleteEntity("places", place.id);
        await Promise.all(state.entries.filter(item => item.placeId === place.id).map(item => deleteEntity("entries", item.id, false)));
        await Promise.all(state.ftEntries.filter(item => item.placeId === place.id).map(item => deleteEntity("ft_entries", item.id, false)));
        if (state.editingPlaceId === place.id) resetPlaceForm();
      };
    }
    el.placeList.appendChild(row);
  });
}

function renderInlineWorkerList() {
  const workers = sortedByName(state.workers, el.workerSort.value);
  if (!workers.length) {
    el.workerList.innerHTML = `<div class="row"><span class="muted">Sem itens cadastrados.</span></div>`;
    return;
  }
  el.workerList.innerHTML = "";
  const placeOptions = `<option value="">Selecione o local validado</option>` + sortedByName(state.places).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  workers.forEach(worker => {
    const profile = getWorkerProfile(worker.id);
    const row = document.createElement("div");
    row.className = "list-item-stack";
    if (state.editingWorkerId === worker.id) {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${worker.name}</span>
            <span class="row-subtitle">Funcao: ${profile?.cargo || "Nao informada"} | Local validado: ${placeName(profile?.placeId)} | Escala: ${scaleName(profile?.scaleId)} | FT: ${currency(getProfileFtValue(profile))}</span>
          </div>
        </div>
        <form class="inline-form inline-edit-form" data-inline-worker="${worker.id}">
          <input name="name" value="${worker.name || ""}" placeholder="Nome completo" required>
          <select name="placeId">${placeOptions}</select>
          <input name="cargo" list="jobFunctionOptions" value="${profile?.cargo || ""}" placeholder="Funcao validada" required>
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-inline-cancel>Cancelar</button>
        </form>
      `;
      const form = row.querySelector("form");
      form.querySelector('[name="placeId"]').value = profile?.placeId || "";
      form.onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const name = String(formData.get("name") || "").trim();
        const placeId = String(formData.get("placeId") || "");
        const cargo = String(formData.get("cargo") || "").trim();
        if (!name || !placeId || !cargo) {
          alert("Preencha nome, local validado e funcao.");
          return;
        }
        await setEntity("workers", { id: worker.id, name });
        await upsertWorkerProfile(worker.id, placeId, cargo, profile?.scaleId || "", getSuggestedFtValue(cargo, profile?.precoFt || 0));
        resetWorkerForm();
      };
      row.querySelector("[data-inline-cancel]").onclick = () => resetWorkerForm();
    } else {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${worker.name}</span>
            <span class="row-subtitle">Funcao: ${profile?.cargo || "Nao informada"} | Local validado: ${placeName(profile?.placeId)} | Escala: ${scaleName(profile?.scaleId)} | FT: ${currency(getProfileFtValue(profile))}</span>
          </div>
          <div class="actions">
            <button data-edit="${worker.id}">Editar</button>
            <button class="danger" data-del="${worker.id}">Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-edit]").onclick = () => {
        state.editingWorkerId = worker.id;
        renderAll();
      };
      row.querySelector("[data-del]").onclick = async () => removeWorker(worker.id);
    }
    el.workerList.appendChild(row);
  });
}

function renderInlineJobFunctionList() {
  const functions = sortedByName(state.jobFunctions);
  if (!functions.length) {
    el.jobFunctionList.innerHTML = `<div class="row"><span class="muted">Nenhuma funcao cadastrada ainda.</span></div>`;
    return;
  }
  el.jobFunctionList.innerHTML = "";
  functions.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-item-stack";
    if (state.editingJobFunctionId === item.id) {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${item.name}</span>
            <span class="row-subtitle">Valor padrao de FT: ${currency(item.value)}</span>
          </div>
        </div>
        <form class="inline-form inline-edit-form" data-inline-job="${item.id}">
          <input name="name" list="jobFunctionOptions" value="${item.name || ""}" placeholder="Nome da funcao" required>
          <input name="value" type="number" min="0" step="0.01" value="${item.value ?? ""}" placeholder="Valor FT (R$)" required>
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-inline-cancel>Cancelar</button>
        </form>
      `;
      row.querySelector("form").onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const name = String(formData.get("name") || "").trim();
        if (!name) {
          alert("Informe o nome da funcao.");
          return;
        }
        await setEntity("job_functions", {
          id: item.id,
          name,
          value: Number(formData.get("value"))
        });
        resetJobFunctionForm();
      };
      row.querySelector("[data-inline-cancel]").onclick = () => resetJobFunctionForm();
    } else {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${item.name}</span>
            <span class="row-subtitle">Valor padrao de FT: ${currency(item.value)}</span>
          </div>
          <div class="actions">
            <button data-edit="${item.id}">Editar</button>
            <button class="danger" data-del="${item.id}">Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-edit]").onclick = () => {
        state.editingJobFunctionId = item.id;
        renderAll();
      };
      row.querySelector("[data-del]").onclick = async () => {
        await deleteEntity("job_functions", item.id);
        if (state.editingJobFunctionId === item.id) resetJobFunctionForm();
      };
    }
    el.jobFunctionList.appendChild(row);
  });
}

function renderInlineScaleList() {
  const scales = sortedByName(state.scales, el.scaleSort.value);
  el.scaleList.innerHTML = "";
  if (!scales.length) {
    el.scaleList.innerHTML = `<div class="row"><span class="muted">Sem itens cadastrados.</span></div>`;
    return;
  }
  scales.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-item-stack";
    if (state.editingScaleId === item.id) {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${item.name}</span>
            <span class="row-subtitle">${item.pattern || ""}</span>
          </div>
        </div>
        <form class="inline-form inline-edit-form" data-inline-scale="${item.id}">
          <input name="name" value="${item.name || ""}" placeholder="Nome da escala" required>
          <input name="pattern" value="${item.pattern || ""}" placeholder="Descricao/padrao" required>
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-inline-cancel>Cancelar</button>
        </form>
      `;
      row.querySelector("form").onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await setEntity("scales", {
          id: item.id,
          name: String(formData.get("name") || "").trim(),
          pattern: String(formData.get("pattern") || "").trim()
        });
        resetScaleForm();
      };
      row.querySelector("[data-inline-cancel]").onclick = () => resetScaleForm();
    } else {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${item.name}</span>
            <span class="row-subtitle">${item.pattern || ""}</span>
          </div>
          <div class="actions">
            <button data-edit="${item.id}">Editar</button>
            <button class="danger" data-del="${item.id}">Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-edit]").onclick = () => {
        state.editingScaleId = item.id;
        renderAll();
      };
      row.querySelector("[data-del]").onclick = async () => {
        await deleteEntity("scales", item.id);
        await Promise.all(state.entries.filter(entry => entry.scaleId === item.id).map(entry => setEntity("entries", { ...entry, scaleId: "" }, false)));
        if (state.editingScaleId === item.id) resetScaleForm();
      };
    }
    el.scaleList.appendChild(row);
  });
}

function renderInlineProfiles() {
  const search = el.profileSearch.value.trim().toLowerCase();
  const order = el.profileSort.value;
  let profiles = state.workerProfiles.map(p => ({
    ...p,
    _workerName: workerName(p.workerId),
    _placeName: placeName(p.placeId),
    _scaleName: scaleName(p.scaleId)
  }));
  if (search) {
    profiles = profiles.filter(p =>
      p._workerName.toLowerCase().includes(search) ||
      p._placeName.toLowerCase().includes(search) ||
      (p.cargo || "").toLowerCase().includes(search)
    );
  }
  profiles = sortedByName(profiles, order, "_workerName");
  if (!profiles.length) {
    el.profileList.innerHTML = `<div class="row"><span class="muted">Nenhum perfil cadastrado${search ? " com os filtros atuais" : ""}.</span></div>`;
    return;
  }
  el.profileList.innerHTML = "";
  const workerOptions = `<option value="">Selecione o funcionario</option>` + sortedByName(state.workers).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  const placeOptions = `<option value="">Selecione o posto de servico</option>` + sortedByName(state.places).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  const scaleOptions = `<option value="">Selecione a escala</option>` + sortedByName(state.scales).map(item => `<option value="${item.id}">${item.name}</option>`).join("");
  profiles.forEach(p => {
    const row = document.createElement("div");
    row.className = "list-item-stack";
    if (state.editingProfileId === p.id) {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${p._workerName}</span>
            <span class="row-subtitle">Posto: ${p._placeName} | Escala: ${p._scaleName} | Cargo: ${p.cargo || "N/A"} | Preco FT: ${currency(getProfileFtValue(p))}</span>
          </div>
        </div>
        <form class="inline-form inline-edit-form profile-form" data-inline-profile="${p.id}">
          <select name="workerId">${workerOptions}</select>
          <select name="placeId">${placeOptions}</select>
          <select name="scaleId">${scaleOptions}</select>
          <input name="cargo" list="jobFunctionOptions" value="${p.cargo || ""}" placeholder="Cargo" required>
          <input name="precoFt" type="number" min="0" step="0.01" value="${getProfileFtValue(p)}" placeholder="Preco FT (R$)" required>
          <button type="submit">Salvar edicao</button>
          <button type="button" class="ghost" data-inline-cancel>Cancelar</button>
        </form>
      `;
      const form = row.querySelector("form");
      form.querySelector('[name="workerId"]').value = p.workerId || "";
      form.querySelector('[name="placeId"]').value = p.placeId || "";
      form.querySelector('[name="scaleId"]').value = p.scaleId || "";
      const cargoInput = form.querySelector('[name="cargo"]');
      const precoFtInput = form.querySelector('[name="precoFt"]');
      cargoInput.oninput = () => {
        const suggested = getSuggestedFtValue(cargoInput.value.trim());
        if (suggested !== "" && !precoFtInput.value) precoFtInput.value = suggested;
      };
      cargoInput.onchange = () => {
        const suggested = getSuggestedFtValue(cargoInput.value.trim());
        if (suggested !== "") precoFtInput.value = suggested;
      };
      form.onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const workerId = String(formData.get("workerId") || "");
        const placeId = String(formData.get("placeId") || "");
        const scaleId = String(formData.get("scaleId") || "");
        const cargo = String(formData.get("cargo") || "").trim();
        if (!workerId || !placeId || !scaleId || !cargo) {
          alert("Preencha todos os campos obrigatorios.");
          return;
        }
        await setEntity("worker_profiles", {
          id: p.id,
          workerId,
          placeId,
          scaleId,
          cargo,
          precoFt: Number(formData.get("precoFt"))
        });
        resetProfileForm();
      };
      row.querySelector("[data-inline-cancel]").onclick = () => resetProfileForm();
    } else {
      row.innerHTML = `
        <div class="row">
          <div class="row-main">
            <span class="row-title">${p._workerName}</span>
            <span class="row-subtitle">Posto: ${p._placeName} | Escala: ${p._scaleName} | Cargo: ${p.cargo || "N/A"} | Preco FT: ${currency(getProfileFtValue(p))}</span>
          </div>
          <div class="actions">
            <button data-edit="${p.id}">Editar</button>
            <button class="danger" data-del="${p.id}">Excluir</button>
          </div>
        </div>
      `;
      row.querySelector("[data-edit]").onclick = () => {
        state.editingProfileId = p.id;
        renderAll();
      };
      row.querySelector("[data-del]").onclick = async () => {
        await deleteEntity("worker_profiles", p.id);
        if (state.editingProfileId === p.id) resetProfileForm();
      };
    }
    el.profileList.appendChild(row);
  });
}

function renderJobFunctionOptions() {
  el.jobFunctionOptions.innerHTML = sortedByName(state.jobFunctions)
    .map(item => `<option value="${item.name}"></option>`)
    .join("");
}

function resetWorkerForm() {
  state.editingWorkerId = "";
  el.workerForm.reset();
  renderSimpleSelect(el.workerPlaceId, state.places, "Selecione o local validado");
  el.workerSubmitBtn.textContent = "Adicionar";
  el.workerCancelBtn.classList.add("hidden");
}

function resetPlaceForm() {
  state.editingPlaceId = "";
  el.placeForm.reset();
  el.placeSubmitBtn.textContent = "Adicionar";
  el.placeCancelBtn.classList.add("hidden");
}

function editPlace(placeId) {
  const place = state.places.find(item => item.id === placeId);
  if (!place) return;
  state.editingPlaceId = placeId;
  el.placeName.value = place.name || "";
  el.placeCity.value = place.city || "";
  el.placeSubmitBtn.textContent = "Salvar";
  el.placeCancelBtn.classList.remove("hidden");
  setActiveTab("clientes");
}

function editWorker(workerId) {
  const worker = state.workers.find(item => item.id === workerId);
  const profile = getWorkerProfile(workerId);
  if (!worker) return;
  state.editingWorkerId = workerId;
  el.workerName.value = worker.name || "";
  renderSimpleSelect(el.workerPlaceId, state.places, "Selecione o local validado", profile?.placeId || "");
  el.workerRole.value = profile?.cargo || "";
  el.workerSubmitBtn.textContent = "Salvar";
  el.workerCancelBtn.classList.remove("hidden");
  setActiveTab("funcionarios");
}

async function removeWorker(workerId) {
  await deleteEntity("workers", workerId);
  await Promise.all(state.entries.filter(item => item.workerId === workerId).map(item => deleteEntity("entries", item.id, false)));
  await Promise.all(state.workerProfiles.filter(item => item.workerId === workerId).map(item => deleteEntity("worker_profiles", item.id, false)));
  await Promise.all(state.documentation.filter(item => item.workerId === workerId).map(item => deleteEntity("worker_documentation", item.id, false)));
  if (state.editingWorkerId === workerId) resetWorkerForm();
}

function renderWorkerList() {
  const workers = sortedByName(state.workers, el.workerSort.value);
  if (!workers.length) {
    el.workerList.innerHTML = `<div class="row"><span class="muted">Sem itens cadastrados.</span></div>`;
    return;
  }
  el.workerList.innerHTML = "";
  workers.forEach(worker => {
    const profile = getWorkerProfile(worker.id);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${worker.name}</span>
        <span class="row-subtitle">Funcao: ${profile?.cargo || "Nao informada"} | Local validado: ${placeName(profile?.placeId)} | Escala: ${scaleName(profile?.scaleId)} | FT: ${currency(getProfileFtValue(profile))}</span>
      </div>
      <div class="actions">
        <button data-edit="${worker.id}">Editar</button>
        <button class="danger" data-del="${worker.id}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit]").onclick = () => editWorker(worker.id);
    row.querySelector("[data-del]").onclick = () => removeWorker(worker.id);
    el.workerList.appendChild(row);
  });
}

function resetJobFunctionForm() {
  state.editingJobFunctionId = "";
  el.jobFunctionForm.reset();
  el.jobFunctionSubmitBtn.textContent = "Adicionar funcao";
  el.jobFunctionCancelBtn.classList.add("hidden");
}

function resetScaleForm() {
  state.editingScaleId = "";
  el.scaleForm.reset();
  el.scaleSubmitBtn.textContent = "Adicionar";
  el.scaleCancelBtn.classList.add("hidden");
}

function editScale(scaleId) {
  const scale = state.scales.find(item => item.id === scaleId);
  if (!scale) return;
  state.editingScaleId = scaleId;
  el.scaleName.value = scale.name || "";
  el.scalePattern.value = scale.pattern || "";
  el.scaleSubmitBtn.textContent = "Salvar";
  el.scaleCancelBtn.classList.remove("hidden");
  setActiveTab("escalas");
}

function resetProfileForm() {
  state.editingProfileId = "";
  el.profileForm.reset();
  renderSimpleSelect(el.profileWorkerId, state.workers, "Selecione o funcionario");
  renderSimpleSelect(el.profilePlaceId, state.places, "Selecione o posto de servico");
  renderSimpleSelect(el.profileScaleId, state.scales, "Selecione a escala");
  el.profileSubmitBtn.textContent = "Cadastrar perfil";
  el.profileCancelBtn.classList.add("hidden");
}

function editProfile(profileId) {
  const profile = state.workerProfiles.find(item => item.id === profileId);
  if (!profile) return;
  state.editingProfileId = profileId;
  renderSimpleSelect(el.profileWorkerId, state.workers, "Selecione o funcionario", profile.workerId || "");
  renderSimpleSelect(el.profilePlaceId, state.places, "Selecione o posto de servico", profile.placeId || "");
  renderSimpleSelect(el.profileScaleId, state.scales, "Selecione a escala", profile.scaleId || "");
  el.profileCargo.value = profile.cargo || "";
  el.profilePrecoFt.value = getProfileFtValue(profile);
  el.profileSubmitBtn.textContent = "Salvar perfil";
  el.profileCancelBtn.classList.remove("hidden");
  setActiveTab("perfil");
}

function editJobFunction(jobFunctionId) {
  const item = state.jobFunctions.find(entry => entry.id === jobFunctionId);
  if (!item) return;
  state.editingJobFunctionId = jobFunctionId;
  el.jobFunctionName.value = item.name || "";
  el.jobFunctionValue.value = item.value ?? "";
  el.jobFunctionSubmitBtn.textContent = "Salvar funcao";
  el.jobFunctionCancelBtn.classList.remove("hidden");
  setActiveTab("funcoes");
}

function renderJobFunctionList() {
  const functions = sortedByName(state.jobFunctions);
  if (!functions.length) {
    el.jobFunctionList.innerHTML = `<div class="row"><span class="muted">Nenhuma funcao cadastrada ainda.</span></div>`;
    return;
  }
  el.jobFunctionList.innerHTML = "";
  functions.forEach(item => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${item.name}</span>
        <span class="row-subtitle">Valor padrao de FT: ${currency(item.value)}</span>
      </div>
      <div class="actions">
        <button data-edit="${item.id}">Editar</button>
        <button class="danger" data-del="${item.id}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit]").onclick = () => editJobFunction(item.id);
    row.querySelector("[data-del]").onclick = async () => {
      await deleteEntity("job_functions", item.id);
      if (state.editingJobFunctionId === item.id) resetJobFunctionForm();
    };
    el.jobFunctionList.appendChild(row);
  });
}

function fillDocumentationForm(record = blankDocumentation()) {
  el.docWorkerId.value = record.workerId || "";
  el.docFullName.value = record.fullName || "";
  el.docCpf.value = record.cpf || "";
  el.docRg.value = record.rg || "";
  el.docCtps.value = record.ctps || "";
  el.docTitulo.value = record.tituloEleitor || "";
  el.docReservista.value = record.reservista || "";
  el.docCompany.value = record.company || "tka-seguranca-privada";
  el.docRole.value = record.role || "";
  el.docBirthDate.value = record.birthDate || "";
  el.docPhone.value = record.phone || "";
  el.docEmail.value = record.email || "";
  el.docZip.value = record.zipCode || "";
  el.docAddress.value = record.address || "";
  el.docNumber.value = record.addressNumber || "";
  el.docComplement.value = record.addressComplement || "";
  el.docNeighborhood.value = record.neighborhood || "";
  el.docCity.value = record.city || "";
  el.docState.value = record.stateName || "";
  el.docEducation.value = record.education || "";
  el.docCnv.value = record.cnv || "";
  el.docCourse.value = record.courseCertificate || "";
  el.docHealth.value = record.healthCertificate || "";
  el.docCriminal.value = record.criminalRecord || "";
  el.docNotes.value = record.notes || "";
}

function readDocumentationForm() {
  const current = currentDocumentation() || blankDocumentation();
  return {
    ...current,
    workerId: el.docWorkerId.value,
    fullName: el.docFullName.value.trim(),
    cpf: el.docCpf.value.trim(),
    rg: el.docRg.value.trim(),
    ctps: el.docCtps.value.trim(),
    tituloEleitor: el.docTitulo.value.trim(),
    reservista: el.docReservista.value.trim(),
    company: el.docCompany.value,
    role: el.docRole.value.trim(),
    birthDate: el.docBirthDate.value,
    phone: el.docPhone.value.trim(),
    email: el.docEmail.value.trim(),
    zipCode: el.docZip.value.trim(),
    address: el.docAddress.value.trim(),
    addressNumber: el.docNumber.value.trim(),
    addressComplement: el.docComplement.value.trim(),
    neighborhood: el.docNeighborhood.value.trim(),
    city: el.docCity.value.trim(),
    stateName: el.docState.value.trim(),
    education: el.docEducation.value.trim(),
    cnv: el.docCnv.value.trim(),
    courseCertificate: el.docCourse.value.trim(),
    healthCertificate: el.docHealth.value.trim(),
    criminalRecord: el.docCriminal.value.trim(),
    notes: el.docNotes.value.trim()
  };
}

function renderDocumentationFiles(record) {
  const files = record?.files || [];
  if (!files.length) {
    el.docFileList.innerHTML = `<div class="row"><span class="muted">Nenhum arquivo enviado para este dossie.</span></div>`;
    return;
  }
  el.docFileList.innerHTML = files.map(file => `
    <div class="row doc-file-item">
      <div class="doc-file-meta">
        <span class="row-title">${file.fileName}</span>
        <span class="row-subtitle">${file.category} | ${file.uploadedBy || "Usuario interno"} | ${formatLogDate(file.uploadedAt)}</span>
      </div>
      <div class="doc-file-actions">
        <a class="tab-btn" href="${file.downloadURL}" target="_blank" rel="noreferrer">Abrir</a>
      </div>
    </div>
  `).join("");
}

function renderDocumentationList() {
  const companyFilter = el.docCompanyFilter.value;
  const search = el.docSearch.value.trim().toLowerCase();
  const docs = [...state.documentation]
    .filter(item => !companyFilter || item.company === companyFilter)
    .filter(item => !search || [item.fullName, item.cpf, item.role, docCompanyName(item.company)].join(" ").toLowerCase().includes(search))
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "pt-BR"));

  if (!docs.length) {
    el.docRecordList.innerHTML = `<div class="row"><span class="muted">Nenhum dossie encontrado com os filtros atuais.</span></div>`;
    renderDocumentationFiles(currentDocumentation());
    return;
  }

  el.docRecordList.innerHTML = "";
  docs.forEach(item => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `row doc-card${item.id === state.currentDocId ? " active-doc" : ""}`;
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${item.fullName || "Sem nome"}</span>
        <span class="row-subtitle">${docCompanyName(item.company)} | ${item.role || "Sem funcao"} | ${item.cpf || "CPF pendente"}</span>
      </div>
    `;
    row.onclick = () => {
      state.currentDocId = item.id;
      fillDocumentationForm(item);
      renderDocumentationFiles(item);
      renderDocumentationList();
    };
    el.docRecordList.appendChild(row);
  });

  const active = currentDocumentation() || docs[0];
  if (active && !state.currentDocId) state.currentDocId = active.id;
  fillDocumentationForm(currentDocumentation() || docs[0]);
  renderDocumentationFiles(currentDocumentation() || docs[0]);
}

function formatLogDate(value) {
  if (!value) return "Data pendente";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Data pendente" : date.toLocaleString("pt-BR");
}

function dashboardDateIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && typeof value.seconds !== "undefined") {
    const millis = Number(value.seconds || 0) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1000000);
    return new Date(millis).toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  return String(value || "");
}

function dashboardDateMs(value) {
  const date = new Date(dashboardDateIso(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function latestDashboardDateMs(item = {}, fields = ["updatedAt", "createdAt", "appliedAt", "uploadedAt", "publishedAt", "generatedAt", "operatorAt"]) {
  return fields.reduce((best, field) => Math.max(best, dashboardDateMs(item[field])), 0);
}

function latestDocumentationDateMs(record = {}) {
  const ownDate = latestDashboardDateMs(record, ["updatedAt", "createdAt", "appliedAt"]);
  const fileDate = (record.files || []).reduce((best, file) => Math.max(best, latestDashboardDateMs(file)), 0);
  return Math.max(ownDate, fileDate);
}

function isRecentDashboardDate(ms, days = DASHBOARD_RECENT_DAYS) {
  return Boolean(ms) && ms >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatDashboardDate(ms) {
  return ms ? formatLogDate(new Date(ms).toISOString()) : "Data pendente";
}

function countByStatus(rows = []) {
  return rows.reduce((map, row) => {
    const status = String(row.status || "sem_status").toLowerCase();
    map[status] = (map[status] || 0) + 1;
    return map;
  }, {});
}

function getRhLiveSummary() {
  return state.whatsappRhSnapshot?.summary || {};
}

function getRhLiveRuntime() {
  return state.whatsappRhSnapshot?.runtime || {};
}

function getRhWhatsappStatus() {
  const runtime = getRhLiveRuntime();
  const connected = runtime.connected === true || runtime.connectionState === "open";
  if (connected) return { label: "Conectado", tone: "ok" };
  if (runtime.qrRequired || runtime.connectionState === "qr") return { label: "QR pendente", tone: "warn" };
  if (runtime.connectionState) return { label: runtime.connectionState, tone: "warn" };
  return { label: state.whatsappRhSnapshot ? "Snapshot recebido" : "Aguardando snapshot", tone: state.whatsappRhSnapshot ? "ok" : "warn" };
}

function dashboardRecentDocumentItems() {
  const docs = (state.documentation || []).map(record => {
    const fileCount = (record.files || []).reduce((sum, file) => sum + Number(file.fileCount || 1), 0);
    const atMs = latestDocumentationDateMs(record);
    return {
      type: "Dossie",
      title: record.fullName || workerName(record.workerId) || "Colaborador sem nome",
      meta: `${docCompanyName(record.company)} | ${record.role || "Sem funcao"} | ${fileCount} arquivo(s)`,
      atMs,
      tab: "documentacao"
    };
  });
  const imports = (state.collaboratorSheetWorkers || []).map(record => {
    const parsed = record.parsed || {};
    const atMs = latestDashboardDateMs(record);
    return {
      type: "Importacao",
      title: record.name || parsed.name || "Colaborador importado",
      meta: `${record.place || parsed.place || "Sem posto"} | ${record.role || parsed.role || "Sem funcao"}`,
      atMs,
      tab: "planilha-colaboradores"
    };
  });
  const all = [...docs, ...imports].sort((a, b) => b.atMs - a.atMs || a.title.localeCompare(b.title, "pt-BR"));
  const recent = all.filter(item => isRecentDashboardDate(item.atMs));
  return (recent.length ? recent : all).slice(0, 7);
}

function dashboardRecentAutomationItems() {
  const draftItems = (state.rhAiDraftJobs || []).map(job => ({
    type: "OpenAI",
    title: job.status || "job",
    meta: `${job.source || "rh_ai_draft_jobs"}${job.model ? ` | ${job.model}` : ""}`,
    atMs: latestDashboardDateMs(job, ["updatedAt", "createdAt", "processedAt", "completedAt"]),
    tab: "dashboard"
  }));
  const feedbackItems = (state.rhAiFeedbackEvents || []).map(event => ({
    type: "Aprendizado",
    title: event.action || event.optionKey || event.source || "evento RH",
    meta: `${event.source || "rh_ai_feedback_events"} | ${event.approvedForLearning === false ? "nao aprovado" : "ativo"}`,
    atMs: latestDashboardDateMs(event),
    tab: "dashboard"
  }));
  return [...draftItems, ...feedbackItems]
    .filter(item => item.atMs)
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, 6);
}

function normalizeDashboardPatternKey(value) {
  return normalizeText(value || "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function dashboardPatternTitleFromEvent(event = {}) {
  return event.selectedTitle ||
    event.optionTitle ||
    event.optionKey ||
    event.selectedKey ||
    event.reviewAction ||
    event.action ||
    event.intent ||
    "Aprendizado RH";
}

function dashboardPatternSourceLabel(value = "") {
  const text = String(value || "");
  const normalized = normalizeText(text);
  if (normalized.includes("manual")) return "manual";
  if (normalized.includes("operator") || normalized.includes("feedback")) return "feedback";
  if (normalized.includes("declared")) return "declarado";
  if (normalized.includes("response")) return "responseStudy";
  if (normalized.includes("draft") || normalized.includes("openai")) return "GPT";
  return text || "RH";
}

function dashboardPatternStatusLabel(event = {}) {
  if (event.approvedForLearning === false || event.accepted === false) return "revisar";
  if (event.reviewAction === "reject" || event.action === "reject") return "rejeitado";
  if (event.reviewAction === "correct" || event.action === "correct") return "corrigido";
  if (event.reviewAction === "approve" || event.action === "approve") return "aprovado";
  if (String(event.action || event.reviewAction || "").includes("manual")) return "declarado";
  return "ativo";
}

function dashboardPatternItems() {
  const summary = getRhLiveSummary();
  const study = summary.responseStudy || {};
  const feedback = study.feedback || {};
  const liveLearningTotals = summary.liveLearning?.totals || {};
  const items = [];
  const add = item => {
    const key = item.key || normalizeDashboardPatternKey([item.type, item.title, item.source, item.atMs].join("|"));
    if (!key) return;
    if (items.some(existing => existing.key === key)) return;
    items.push({ ...item, key });
  };

  RH_DECLARED_PATTERN_TOPICS.forEach((title, index) => add({
    key: `declared:${normalizeDashboardPatternKey(title)}`,
    type: "Declarado",
    title,
    meta: "Banco RH declarado / usado antes do GPT",
    atMs: 0,
    tab: "dashboard"
  }));

  (study.nextOptions || study.optionCatalog || []).slice(0, 24).forEach(option => add({
    key: `response:${option.key || normalizeDashboardPatternKey(option.title)}`,
    type: option.source === "operator-feedback" ? "Aprendido" : "Dinamico",
    title: option.title || option.key || "Opcao RH",
    meta: `${dashboardPatternSourceLabel(option.source)}${option.count ? ` / ${option.count} uso(s)` : ""}`,
    atMs: dashboardDateMs(option.updatedAt || option.lastSeenAt || study.generatedAt || summary.generatedAt),
    tab: "dashboard"
  }));

  (study.audienceOptions || []).slice(0, 6).forEach(option => add({
    key: `audience:${option.key || normalizeDashboardPatternKey(option.label)}`,
    type: "Triagem",
    title: option.label || option.key || "Audiencia RH",
    meta: "Primeira pergunta / direcionamento",
    atMs: dashboardDateMs(study.generatedAt || summary.generatedAt),
    tab: "dashboard"
  }));

  (state.rhAiFeedbackEvents || []).slice(0, 200).forEach(event => {
    const title = dashboardPatternTitleFromEvent(event);
    const action = event.action || event.reviewAction || event.selectedKey || "";
    const isManual = String(action).includes("manual") || String(event.source || "").includes("manual");
    const isLearning = isManual || event.approvedForLearning !== false || event.accepted === true || event.learnedContext;
    if (!isLearning) return;
    add({
      key: `event:${event.id || event.eventId || normalizeDashboardPatternKey([title, event.updatedAt, event.operatorAt].join("|"))}`,
      type: isManual ? "Manual" : "Feedback",
      title,
      meta: `${dashboardPatternStatusLabel(event)} / ${dashboardPatternSourceLabel(event.source)}`,
      atMs: latestDashboardDateMs(event, ["updatedAt", "createdAt", "operatorAt", "loggedAt"]),
      tab: "dashboard"
    });
  });

  return {
    items: items.sort((a, b) => (b.atMs || 0) - (a.atMs || 0) || a.type.localeCompare(b.type, "pt-BR")).slice(0, 12),
    totals: {
      declared: RH_DECLARED_PATTERN_TOPICS.length,
      dynamic: (study.nextOptions || []).length || (study.optionCatalog || []).length || 0,
      audience: (study.audienceOptions || []).length || 0,
      feedback: Number(feedback.total || state.rhAiFeedbackEvents.length || 0),
      custom: Number(feedback.custom || 0),
      people: Number(liveLearningTotals.people || 0)
    }
  };
}

function dashboardPlaceUnderstandingRows(limit = 12, options = {}) {
  const includeResolved = options.includeResolved !== false;
  const officialKeys = dashboardOfficialPlaceLookupMap();
  const records = dashboardAutoPlaceRecords();
  return records.map(record => {
    const officialPlace = officialKeys.get(record.key) || null;
    const aliases = [...(record.aliasLabels || [])]
      .map(label => dashboardCleanPlaceLabel(label))
      .filter(Boolean);
    const uniqueAliases = [...new Map(aliases.map(label => [normalizeText(label), label])).values()];
    const sources = [...(record.sourceLabels || [])];
    const unresolvedAliases = officialPlace ? dashboardUnresolvedAliasesForOfficial(uniqueAliases, officialPlace) : uniqueAliases;
    const reviewedClusterKeys = officialPlace ? dashboardPlaceReviewedClusterKeys(officialPlace) : [];
    const reviewed = Boolean(officialPlace) && !unresolvedAliases.length;
    const needsReview = !officialPlace || Boolean(unresolvedAliases.length) || record.key.includes("sem-posto");
    const confidence = officialPlace && sources.includes("WhatsApp Monitoramento")
      ? "alta"
      : officialPlace
        ? "media"
        : "revisar";
    return {
      key: record.key,
      suggestedName: dashboardCleanPlaceLabel(record.name),
      placeName: officialPlace?.name || record.name,
      city: officialPlace?.city || record.city || "",
      officialPlaceId: officialPlace?.id || "",
      aliases: uniqueAliases.filter(label => normalizeText(label) !== normalizeText(officialPlace?.name || record.name)).slice(0, 5),
      allAliases: uniqueAliases,
      unresolvedAliases,
      aliasCount: uniqueAliases.length,
      sources,
      shiftStartHours: record.shiftStartHours || [],
      shiftEndHours: record.shiftEndHours || [],
      confidence,
      reviewed,
      needsReview,
      status: needsReview ? "Revisar" : reviewedClusterKeys.length ? "Vinculado" : "Unificado"
    };
  })
    .filter(row => row.needsReview || (includeResolved && (row.aliasCount > 1 || row.sources.length > 1)))
    .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || b.aliasCount - a.aliasCount || a.placeName.localeCompare(b.placeName, "pt-BR"))
    .slice(0, limit);
}

function dashboardPlaceUnderstandingPacket() {
  const rows = dashboardPlaceUnderstandingRows(40, { includeResolved: true });
  const pendingRows = rows.filter(row => row.needsReview);
  return {
    generatedAt: new Date().toISOString(),
    source: "rh-dashboard-place-understanding",
    rules: [
      "merge safe workplace aliases before rendering cards",
      "preserve location-sensitive groups such as Coevo SJC and Coevo JAC",
      "do not persist inferred worker rows as official entries",
      "do not expose raw WhatsApp message text or private document text"
    ],
    openAiReady: true,
    openAiRuntime: getRhLiveSummary().openai || getMonitoramentoLiveStatus().openai || null,
    pendingCount: pendingRows.length,
    clusters: rows.map(row => ({
      key: row.key,
      officialPlaceId: row.officialPlaceId,
      placeName: row.placeName,
      aliases: row.aliases,
      unresolvedAliases: row.unresolvedAliases,
      sources: row.sources,
      confidence: row.confidence,
      reviewed: row.reviewed,
      status: row.status
    }))
  };
}

function dashboardPlaceReviewRowByKey(key) {
  return dashboardPlaceUnderstandingRows(200).find(row => row.key === key) || null;
}

function dashboardReviewAliasList(row = {}, targetPlaceName = "") {
  const labels = [
    row.suggestedName,
    row.placeName,
    ...(row.aliases || []),
    ...(row.allAliases || [])
  ].map(label => dashboardCleanPlaceLabel(label)).filter(Boolean);
  const targetNormalized = normalizeText(targetPlaceName);
  return [...new Map(labels.map(label => [normalizeText(label), label])).values()]
    .filter(label => normalizeText(label) && normalizeText(label) !== targetNormalized)
    .slice(0, 24);
}

function dashboardPlaceAliasPayload(place, row, mode) {
  const aliases = dashboardReviewAliasList(row, place.name);
  const existingAliases = (place.aliases || place.placeAliases || []).map(alias => dashboardCleanPlaceLabel(alias)).filter(Boolean);
  const mergedAliases = [...new Map([...existingAliases, ...aliases].map(alias => [normalizeText(alias), alias])).values()]
    .filter(alias => normalizeText(alias) !== normalizeText(place.name));
  const clusterKeys = [...new Set([
    ...dashboardPlaceReviewedClusterKeys(place),
    row.key || "",
    dashboardStaticPlaceCanonicalKey(row.suggestedName || row.placeName || ""),
    ...(row.allAliases || []).map(alias => dashboardStaticPlaceCanonicalKey(alias))
  ].filter(Boolean))];
  const aliasKeys = [...new Set([
    ...(place.aliasKeys || []),
    ...mergedAliases.map(alias => dashboardStaticPlaceCanonicalKey(alias))
  ].filter(Boolean))];
  return {
    id: place.id,
    aliases: mergedAliases,
    aliasKeys,
    aliasReviewedAt: new Date().toISOString(),
    aliasReviewedBy: state.currentUser?.email || "",
    aliasReviewSource: "rh-dashboard-place-understanding",
    aliasReviewMode: mode,
    aliasReviewClusterKey: row.key || "",
    aliasReviewClusterKeys: clusterKeys
  };
}

function upsertLocalPlace(payload) {
  const index = state.places.findIndex(place => place.id === payload.id);
  if (index >= 0) state.places[index] = { ...state.places[index], ...payload };
  else state.places.push(payload);
  rememberDashboardPlaceReviewPayload(payload);
  resetDashboardPlaceAliasCache();
}

async function linkDashboardPlaceCluster(rowKey, placeId) {
  const row = dashboardPlaceReviewRowByKey(rowKey);
  const place = state.places.find(item => item.id === placeId);
  if (!row || !place) throw new Error("Selecione um posto valido para vincular.");
  const payload = dashboardPlaceAliasPayload(place, row, "link_existing");
  await setEntity("places", payload);
  upsertLocalPlace(payload);
  state.reviewingPlaceClusterKey = "";
  setStatus("Posto vinculado");
  showUploadToast(`Aliases vinculados a ${place.name}.`, "success");
  renderAll();
}

async function createDashboardPlaceFromCluster(rowKey) {
  const row = dashboardPlaceReviewRowByKey(rowKey);
  if (!row) throw new Error("Cluster de posto nao encontrado.");
  const name = dashboardCleanPlaceLabel(row.suggestedName || row.placeName || row.key);
  if (!name) throw new Error("Nome do novo posto nao identificado.");
  const id = `place-${dashboardStaticPlaceCanonicalKey(name)}-${Date.now().toString(36)}`.replace(/[^a-z0-9-]/g, "-").slice(0, 90);
  const payload = {
    id,
    name,
    city: row.city || "",
    source: "rh-dashboard-place-understanding",
    createdFromPlaceCluster: row.key || "",
    ...dashboardPlaceAliasPayload({ id, name }, row, "create_new")
  };
  await setEntity("places", payload);
  upsertLocalPlace(payload);
  state.reviewingPlaceClusterKey = "";
  setStatus("Posto criado");
  showUploadToast(`Novo posto criado: ${name}.`, "success");
  renderAll();
}

function namesLookRelated(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 6 && right.includes(left)) return true;
  if (right.length >= 6 && left.includes(right)) return true;
  const leftParts = left.split(" ").filter(part => part.length >= 3);
  const rightParts = new Set(right.split(" ").filter(part => part.length >= 3));
  if (leftParts.length >= 2 && rightParts.has(leftParts[0]) && rightParts.has(leftParts[leftParts.length - 1])) return true;
  return leftParts.length >= 2 && leftParts.filter(part => rightParts.has(part)).length >= 2;
}

function placesLookRelated(a, b) {
  const leftKey = dashboardPlaceCanonicalKey(a);
  const rightKey = dashboardPlaceCanonicalKey(b);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (!dashboardPlaceLocationsCompatible(a, b)) return false;
  const leftTokens = dashboardPlaceTokens(a).filter(token => !DASHBOARD_PLACE_LOCATION_TOKENS.has(token));
  const rightTokens = new Set(dashboardPlaceTokens(b).filter(token => !DASHBOARD_PLACE_LOCATION_TOKENS.has(token)));
  return leftTokens.filter(token => rightTokens.has(token)).length >= 2;
}

function addPlacementScore(map, label, score) {
  const cleanLabel = String(label || "").trim();
  if (!cleanLabel) return;
  const key = dashboardPlaceCanonicalKey(cleanLabel);
  if (!key) return;
  const existing = map.get(key) || { label: cleanLabel, score: 0 };
  if (dashboardPlaceNameScore(cleanLabel) > dashboardPlaceNameScore(existing.label)) existing.label = cleanLabel;
  existing.score += Number(score || 1);
  map.set(key, existing);
}

function latestDashboardEvidenceAt(current, candidate) {
  const currentMs = dashboardDateMs(current);
  const candidateMs = dashboardDateMs(candidate);
  if (!candidateMs) return current || "";
  return candidateMs > currentMs ? new Date(candidateMs).toISOString() : current || "";
}

function scalePattern(scaleId) {
  const scale = state.scales.find(item => item.id === scaleId);
  return scale?.pattern || scale?.name || "Horario pendente";
}

function dashboardRhMessages() {
  const summary = getRhLiveSummary();
  const byId = new Map();
  [
    ...(summary.attentionQueue || []),
    ...(summary.candidates || []),
    ...(summary.recentMessages || [])
  ].forEach((message, index) => {
    const key = message.id || message.sourceMessageId || `${message.remoteJid || message.fromPhone || "msg"}-${message.messageAt || message.receivedAt || index}`;
    if (!byId.has(key)) byId.set(key, message);
  });
  return [...byId.values()];
}

function messageMatchesWorker(message = {}, worker = {}) {
  if (!worker?.id) return false;
  return message.workerId === worker.id ||
    namesLookRelated(message.workerName, worker.name) ||
    namesLookRelated(message.contactName, worker.name);
}

function personMatchesWorker(person = {}, worker = {}) {
  if (!worker?.id) return false;
  if (namesLookRelated(person.contactName, worker.name)) return true;
  return (person.workers || []).some(item => namesLookRelated(item.workerName, worker.name));
}

function dashboardLiveEvidenceForWorker(worker = {}) {
  const summary = getRhLiveSummary();
  const placeScores = new Map();
  const sourceTags = new Set();
  let lastAt = "";
  let messageCount = 0;

  dashboardRhMessages().forEach(message => {
    if (!messageMatchesWorker(message, worker)) return;
    messageCount += 1;
    sourceTags.add("WhatsApp RH");
    if (message.responseStudy) sourceTags.add("agente");
    lastAt = latestDashboardEvidenceAt(lastAt, message.messageAt || message.receivedAt);
    (message.placeMentions || []).forEach(place => {
      addPlacementScore(placeScores, place.placeName, 4 + Number(place.confidence || 0));
    });
  });

  [
    ...(summary.people || []),
    ...(summary.liveLearning?.people || [])
  ].forEach(person => {
    if (!personMatchesWorker(person, worker)) return;
    sourceTags.add("aprendizado");
    lastAt = latestDashboardEvidenceAt(lastAt, person.lastMessageAt || person.lastSeenAt);
    messageCount += Number(person.count || person.totalMessages || 1);
    (person.places || []).forEach(place => {
      addPlacementScore(placeScores, place.placeName, Number(place.count || 1));
    });
  });

  const bestPlace = [...placeScores.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "pt-BR"))[0] || null;
  return {
    placeName: bestPlace?.label || "",
    sourceLabel: [...sourceTags].join(" + "),
    lastAt,
    messageCount
  };
}

function topDashboardLivePeopleWithoutProfile(rowsByKey) {
  const summary = getRhLiveSummary();
  const knownWorkerNames = state.workers.map(worker => worker.name).filter(Boolean);
  return [
    ...(summary.people || []),
    ...(summary.liveLearning?.people || [])
  ]
    .map(person => {
      const workerLabel = (person.workers || [])[0]?.workerName || person.contactName || "Contato RH";
      const placeLabel = (person.places || [])[0]?.placeName || "Posto pendente";
      const key = normalizeDashboardPatternKey(`${workerLabel}|${placeLabel}`);
      return {
        key,
        workerLabel,
        placeLabel,
        profilePlaceLabel: "Sem perfil vinculado",
        scaleLabel: "Escala pendente",
        timeLabel: "Horario pendente",
        statusLabel: "Somente WhatsApp/agent",
        timeStatusLabel: "Aguardando cadastro",
        sourceLabel: "WhatsApp RH + aprendizado",
        lastAt: person.lastMessageAt || person.lastSeenAt || "",
        tone: "warn",
        editTab: "funcionarios",
        priority: 4
      };
    })
    .filter(row => (
      row.key &&
      !rowsByKey.has(row.key) &&
      row.workerLabel !== "Contato RH" &&
      row.placeLabel !== "Posto pendente" &&
      !knownWorkerNames.some(name => namesLookRelated(name, row.workerLabel))
    ))
    .slice(0, 12);
}

function dashboardAutoPlacementRows(date) {
  const entries = getDashboardEntriesForDate(date);
  const entryByWorker = new Map(entries.map(entry => [entry.workerId, entry]));
  const profileByWorker = new Map(state.workerProfiles.map(profile => [profile.workerId, profile]));
  const workerIds = new Set([...profileByWorker.keys(), ...entryByWorker.keys()]);
  const rowsByKey = new Map();

  workerIds.forEach(workerId => {
    const worker = state.workers.find(item => item.id === workerId);
    if (!worker) return;
    const profile = profileByWorker.get(workerId) || {};
    const entry = entryByWorker.get(workerId) || null;
    const live = dashboardLiveEvidenceForWorker(worker);
    const profilePlace = profile.placeId ? placeName(profile.placeId) : "";
    const plannedPlace = entry?.placeId ? placeName(entry.placeId) : profilePlace;
    const entryScaleId = entry?.scaleId || "";
    const profileScaleId = profile.scaleId || "";
    const activeScaleId = entryScaleId || profileScaleId;
    const placeDiff = Boolean(live.placeName && plannedPlace && !placesLookRelated(live.placeName, plannedPlace));
    const profileDiff = Boolean(entry?.placeId && profile.placeId && entry.placeId !== profile.placeId);
    const scaleDiff = Boolean(entryScaleId && profileScaleId && entryScaleId !== profileScaleId);
    const hasIssue = placeDiff || profileDiff || scaleDiff || (!entry && !profile.placeId);
    let statusLabel = entry ? (entry.type || "Escala do dia") : "Sem escala hoje";
    if (!entry && profile.placeId) statusLabel = "Perfil RH";
    if (live.placeName && !placeDiff) statusLabel = entry ? "Escala + WhatsApp" : "Perfil + WhatsApp";
    if (placeDiff) statusLabel = "WhatsApp em outro posto";
    if (profileDiff) statusLabel = "Posto diferente do perfil";
    const timeStatusLabel = scaleDiff ? "Horario diferente" : (activeScaleId ? "Horario normal" : "Horario pendente");
    const sourceTags = [
      entry ? "escala do dia" : "",
      profile.placeId ? "perfil RH" : "",
      live.sourceLabel
    ].filter(Boolean);
    const row = {
      key: workerId,
      workerLabel: worker.name,
      placeLabel: live.placeName || plannedPlace || "Posto pendente",
      profilePlaceLabel: profilePlace || "Sem perfil",
      scaleLabel: activeScaleId ? scaleName(activeScaleId) : "Sem escala",
      timeLabel: activeScaleId ? scalePattern(activeScaleId) : "Horario pendente",
      statusLabel,
      timeStatusLabel,
      sourceLabel: sourceTags.join(" + ") || "cadastro RH",
      lastAt: live.lastAt,
      tone: hasIssue ? "warn" : (live.messageCount || entry ? "ok" : "neutral"),
      editTab: profile.id ? "perfil" : "funcionarios",
      priority: hasIssue ? 1 : (entry ? 2 : (live.messageCount ? 3 : 5))
    };
    rowsByKey.set(row.key, row);
  });

  topDashboardLivePeopleWithoutProfile(rowsByKey).forEach(row => rowsByKey.set(row.key, row));
  return [...rowsByKey.values()]
    .sort((a, b) => a.priority - b.priority || a.workerLabel.localeCompare(b.workerLabel, "pt-BR"))
    .slice(0, 36);
}

function renderDashboardPlacementRows(rows) {
  if (!rows.length) return `<div class="dashboard-feed-empty">Nenhuma pessoa, posto ou escala carregada ainda.</div>`;
  return `
    <div class="placement-table-wrap">
      <table class="placement-table">
        <thead>
          <tr>
            <th>Pessoa</th>
            <th>Posto atual</th>
            <th>Escala / horario</th>
            <th>Status</th>
            <th>Fonte</th>
            <th>Editar</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td data-label="Pessoa"><span class="placement-cell"><strong>${escapeHtml(row.workerLabel)}</strong><span>${escapeHtml(row.profilePlaceLabel)}</span></span></td>
              <td data-label="Posto atual"><span class="placement-cell">${escapeHtml(row.placeLabel)}</span></td>
              <td data-label="Escala / horario"><span class="placement-cell"><strong>${escapeHtml(row.scaleLabel)}</strong><span>${escapeHtml(row.timeLabel)}</span></span></td>
              <td data-label="Status"><span class="placement-cell"><span class="placement-pill ${escapeHtml(row.tone)}">${escapeHtml(row.statusLabel)}</span><small>${escapeHtml(row.timeStatusLabel)}</small></span></td>
              <td data-label="Fonte"><span class="placement-cell"><span>${escapeHtml(row.sourceLabel)}</span>${row.lastAt ? `<small>${escapeHtml(formatLogDate(row.lastAt))}</small>` : ""}</span></td>
              <td data-label="Editar"><span class="placement-cell"><a class="small-btn" href="?tab=${escapeHtml(row.editTab)}">Abrir</a></span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboardFeedRows(rows, emptyText) {
  if (!rows.length) return `<div class="dashboard-feed-empty">${escapeHtml(emptyText)}</div>`;
  return rows.map(item => `
    <a class="dashboard-feed-row" href="?tab=${escapeHtml(item.tab)}">
      <span class="dashboard-feed-type">${escapeHtml(item.type)}</span>
      <span class="dashboard-feed-main">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.meta)}</span>
      </span>
      <time>${escapeHtml(formatDashboardDate(item.atMs))}</time>
    </a>
  `).join("");
}

function renderDashboardDataFeed() {
  if (!el.dashboardDataFeed) return;
  const rows = dashboardPlaceUnderstandingRows(10, { includeResolved: false });
  const packet = dashboardPlaceUnderstandingPacket();
  window.TKA_RH_DASHBOARD_PLACE_UNDERSTANDING = packet;
  if (!rows.length) {
    el.dashboardDataFeed.hidden = true;
    el.dashboardDataFeed.innerHTML = "";
    return;
  }
  const reviewCount = rows.filter(row => row.needsReview).length;
  const aliasTotal = rows.reduce((sum, row) => sum + row.aliasCount, 0);
  const openAiLabel = packet.openAiRuntime
    ? `${packet.openAiRuntime.enabled === false ? "GPT inativo" : "GPT pronto"}`
    : "Pacote agente pronto";
  const placeOptions = `<option value="">Escolher posto existente</option>` +
    sortedByName(state.places).map(place => `<option value="${escapeHtml(place.id)}">${escapeHtml(place.name)}${place.city ? ` / ${escapeHtml(place.city)}` : ""}</option>`).join("");
  const rowHtml = rows.map(row => {
    const isReviewing = state.reviewingPlaceClusterKey === row.key;
    return `
      <tr>
        <td data-label="Posto resolvido"><span class="placement-cell"><strong>${escapeHtml(row.placeName)}</strong><span>${escapeHtml(row.city || row.key)}</span></span></td>
        <td data-label="Nomes unidos"><span class="placement-cell">${escapeHtml(row.aliases.join(" / ") || "Sem alias visivel")}<small>${escapeHtml(dashboardHoursText(row.shiftStartHours) ? `Inicio ${dashboardHoursText(row.shiftStartHours)}` : "")}${escapeHtml(dashboardHoursText(row.shiftEndHours) ? ` Fim ${dashboardHoursText(row.shiftEndHours)}` : "")}</small></span></td>
        <td data-label="Fontes"><span class="placement-cell">${escapeHtml(row.sources.join(" + ") || "Fonte automatica")}</span></td>
        <td data-label="Confianca"><span class="placement-cell"><span class="placement-pill ${row.needsReview ? "warn" : "ok"}">${escapeHtml(row.confidence)}</span><small>${escapeHtml(row.status)}</small></span></td>
        <td data-label="Revisar"><span class="placement-cell"><button type="button" class="small-btn" data-place-review="${escapeHtml(row.key)}">${isReviewing ? "Fechar" : "Revisar"}</button></span></td>
      </tr>
      ${isReviewing ? `
        <tr class="place-review-row">
          <td colspan="5">
            <div class="place-review-form" data-place-review-panel="${escapeHtml(row.key)}">
              <div>
                <strong>${escapeHtml(row.suggestedName || row.placeName)}</strong>
                <span>${escapeHtml(row.aliases.join(" / ") || "Sem alias adicional")}</span>
              </div>
              <label>Vincular a posto existente
                <select data-place-review-select="${escapeHtml(row.key)}">${placeOptions}</select>
              </label>
              <div class="place-review-actions">
                <button type="button" data-place-review-link="${escapeHtml(row.key)}">Vincular</button>
                <button type="button" class="ghost" data-place-review-create="${escapeHtml(row.key)}">Criar novo posto</button>
              </div>
            </div>
          </td>
        </tr>
      ` : ""}
    `;
  }).join("");
  el.dashboardDataFeed.hidden = false;
  el.dashboardDataFeed.innerHTML = `
    <article class="dashboard-data-card wide ${reviewCount ? "warn" : ""}">
      <div class="dashboard-data-head">
        <div>
          <span class="dashboard-feed-type">Entendimento dos postos</span>
          <strong>${rows.length}</strong>
        </div>
        <span class="tag ${reviewCount ? "warn" : "ok"}">${reviewCount ? `${reviewCount} revisar` : "unificado"}</span>
      </div>
      <div class="dashboard-kpi-grid">
        <span><strong>${aliasTotal}</strong><small>nomes filtrados</small></span>
        <span><strong>${rows.filter(row => row.sources.includes("WhatsApp Monitoramento")).length}</strong><small>com WhatsApp</small></span>
        <span><strong>${rows.filter(row => row.sources.includes("Planilha RH")).length}</strong><small>com planilha</small></span>
        <span><strong>${escapeHtml(openAiLabel)}</strong><small>agente/GPT</small></span>
      </div>
      <div class="placement-table-wrap">
        <table class="placement-table place-understanding-table">
          <thead>
            <tr>
              <th>Posto resolvido</th>
              <th>Nomes unidos</th>
              <th>Fontes</th>
              <th>Confianca</th>
              <th>Revisar</th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
      <p class="dashboard-card-note">Sem texto privado: somente nomes de postos, fontes e horarios declarados entram no pacote do agente.</p>
    </article>
  `;
  el.dashboardDataFeed.querySelectorAll("[data-place-review]").forEach(button => {
    button.onclick = () => {
      const key = button.dataset.placeReview || "";
      state.reviewingPlaceClusterKey = state.reviewingPlaceClusterKey === key ? "" : key;
      renderDashboardDataFeed();
    };
  });
  el.dashboardDataFeed.querySelectorAll("[data-place-review-link]").forEach(button => {
    button.onclick = async () => {
      const key = button.dataset.placeReviewLink || "";
      const select = button.closest("[data-place-review-panel]")?.querySelector("select");
      try {
        await linkDashboardPlaceCluster(key, select?.value || "");
      } catch (error) {
        console.error(error);
        showUploadToast(error.message || "Falha ao vincular posto.", "error");
      }
    };
  });
  el.dashboardDataFeed.querySelectorAll("[data-place-review-create]").forEach(button => {
    button.onclick = async () => {
      try {
        await createDashboardPlaceFromCluster(button.dataset.placeReviewCreate || "");
      } catch (error) {
        console.error(error);
        showUploadToast(error.message || "Falha ao criar posto.", "error");
      }
    };
  });
}

function renderAuditLogs() {
  if (!state.currentUser || !managerEmails.has(state.currentUser.email || "")) {
    el.auditLogList.innerHTML = `<div class="row"><span class="muted">Somente os perfis de gestao visualizam os logs.</span></div>`;
    return;
  }
  if (!state.auditLogs.length) {
    el.auditLogList.innerHTML = `<div class="row"><span class="muted">Nenhuma alteracao registrada ainda.</span></div>`;
    return;
  }
  el.auditLogList.innerHTML = "";
  state.auditLogs.forEach(item => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${item.actionLabel} em ${item.entityLabel}</span>
        <span class="row-subtitle">${item.userEmail || "Usuario desconhecido"} | ${formatLogDate(item.createdAt)} | ${item.summary || "Sem resumo"}</span>
      </div>
    `;
    el.auditLogList.appendChild(row);
  });
}

function updateRhPermissions() {
  el.exportBtn.disabled = !isRhAdmin();
  el.exportBtn.title = isRhAdmin() ? "" : "Somente comercial@grupotka.com.br pode gerar PDF.";
}

function renderDashboardSummary() {
  const date = el.dashDate.value || today;
  const dayEntries = getDashboardEntriesForDate(date);
  const dayFtEntries = state.ftEntries.filter(item => item.date === date);
  const ftHours = dayFtEntries.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const ftValue = dayFtEntries.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const inferredCount = dayEntries.filter(item => item.derivedFromUnifiedInference).length;
  const liveEvidenceCount = dayEntries.filter(item => item.derivedFromMonitoramento && !item.derivedFromUnifiedInference).length;
  const autoPlaceCount = dashboardAutoPlaceRecords()
    .filter(record => !state.places.some(place => dashboardPlaceCanonicalKey(place.name) === record.key || placesLookRelated(place.name, record.name))).length;
  el.dashboardSummary.innerHTML = `
    <article class="summary-box"><span class="muted">Perfis cadastrados</span><strong>${state.workerProfiles.length}</strong></article>
    <article class="summary-box"><span class="muted">Trabalhando hoje</span><strong>${dayEntries.length}</strong></article>
    <article class="summary-box"><span class="muted">Evidencia live</span><strong>${liveEvidenceCount}</strong></article>
    <article class="summary-box"><span class="muted">Inferidos</span><strong>${inferredCount}</strong></article>
    <article class="summary-box"><span class="muted">Postos auto</span><strong>${autoPlaceCount}</strong></article>
    <article class="summary-box"><span class="muted">FT do dia</span><strong>${dayFtEntries.length}</strong></article>
    <article class="summary-box"><span class="muted">Horas FT</span><strong>${ftHours}</strong></article>
    <article class="summary-box"><span class="muted">Valor FT</span><strong>${currency(ftValue)}</strong></article>
  `;
}

function renderDashboard() {
  const date = el.dashDate.value || today;
  const search = el.placeSearch.value.trim();
  const dashboardEntries = getDashboardEntriesForDate(date);
  const places = getDashboardPlacesForRender(dashboardEntries, search);
  renderDashboardSummary();
  renderDashboardDataFeed();
  el.dashboardGrid.innerHTML = "";

  if (!places.length) {
    el.dashboardGrid.innerHTML = `<div class="panel"><span class="muted">Sem locais para mostrar.</span></div>`;
    return;
  }

  const workerOptions = `<option value="">Selecione funcionario</option>` + sortedByName(state.workers).map(worker => `<option value="${worker.id}">${worker.name}</option>`).join("");
  const scaleOptions = `<option value="">Sem escala</option>` + sortedByName(state.scales).map(scale => `<option value="${scale.id}">${scale.name}</option>`).join("");

  function syncDashboardFtFields(form) {
    const typeSelect = form.querySelector('[name="type"]');
    const ftFields = form.querySelector("[data-dashboard-ft-fields]");
    const selectedWorkerId = form.querySelector('[name="workerId"]').value;
    const defaults = resolveDashboardFtDefaults(
      selectedWorkerId,
      form.querySelector('[name="ftReason"]').value,
      form.querySelector('[name="ftHours"]').value,
      form.querySelector('[name="ftValue"]').value
    );
    const shouldShowFt = typeSelect.value === "Folga Trabalhada";
    ftFields.classList.toggle("active", shouldShowFt);
    if (!form.querySelector('[name="ftHours"]').value) {
      form.querySelector('[name="ftHours"]').value = defaults.hours || 12;
    }
    if (!form.querySelector('[name="ftValue"]').value && defaults.value) {
      form.querySelector('[name="ftValue"]').value = defaults.value;
    }
    if (!form.querySelector('[name="ftReason"]').value && defaults.reason) {
      form.querySelector('[name="ftReason"]').value = defaults.reason;
    }
  }

  function resetDashboardEntryForm(form) {
    if (!form) return;
    state.editingEntryId = "";
    form.reset();
    form.classList.remove("editing-entry");
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.textContent = "Adicionar no dia";
    syncDashboardFtFields(form);
  }

  function editDashboardEntry(form, entry, linkedFt) {
    state.editingEntryId = entry.id;
    form.classList.add("editing-entry");
    form.querySelector('[name="workerId"]').value = entry.workerId || "";
    form.querySelector('[name="type"]').value = entry.type || "Escala";
    form.querySelector('[name="scaleId"]').value = entry.scaleId || "";
    form.querySelector('[name="ftReason"]').value = getFtReason(linkedFt);
    form.querySelector('[name="ftHours"]').value = linkedFt?.hours || "";
    form.querySelector('[name="ftValue"]').value = linkedFt?.value ?? "";
    form.querySelector('[type="submit"]').textContent = "Salvar edicao";
    syncDashboardFtFields(form);
  }

  places.forEach(place => {
    const dayEntries = dashboardEntries.filter(item => item.placeId === place.id && item.date === date);
    const placeFt = state.ftEntries.filter(item => item.placeId === place.id && item.date === date);
    const linkedFtIds = new Set();
    const placeAutoMeta = dashboardPlaceAutoMeta(place);
    const isAutoOnlyPlace = Boolean(place.derivedFromAutoSource);
    const sourceLabel = place.sourceLabels?.size ? [...place.sourceLabels].join(" + ") : "fonte automatica";
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(place.name)}</h3>
        <div class="muted">${escapeHtml(place.city || "")}</div>
        ${placeAutoMeta ? `<div class="dashboard-place-meta">${escapeHtml(placeAutoMeta)}</div>` : ""}
      </div>
      <div class="assigned-list" data-list="${place.id}"></div>
      <div class="assigned-list" data-ft="${place.id}"></div>
      ${isAutoOnlyPlace ? `
        <div class="dashboard-evidence-note">Posto auto preenchido por ${escapeHtml(sourceLabel)}. Trabalhadores aparecem aqui somente com evidencia real do dia.</div>
      ` : `<form class="inline-form dashboard-entry-form" data-form="${place.id}">
        <select required name="workerId">${workerOptions}</select>
        <select name="type"><option value="Escala">Escala</option><option value="Folga Trabalhada">Folga Trabalhada</option><option value="Permuta">Permuta</option></select>
        <select name="scaleId">${scaleOptions}</select>
        <button type="submit">Adicionar no dia</button>
        <div class="dashboard-ft-fields" data-dashboard-ft-fields>
          <label>Motivo
            <input name="ftReason" placeholder="Motivo da FT">
          </label>
          <label>Horas trabalhadas
            <input name="ftHours" type="number" min="1" step="0.5" placeholder="Horas">
          </label>
          <label>Valor FT (R$)
            <input name="ftValue" type="number" min="0" step="0.01" placeholder="Valor manual">
          </label>
        </div>
      </form>`}
    `;

    const listWrap = card.querySelector(`[data-list="${place.id}"]`);
    const form = card.querySelector(`[data-form="${place.id}"]`);
    if (!dayEntries.length) {
      listWrap.innerHTML = `<span class="muted">Nenhum trabalhador nesse local hoje.</span>`;
    } else {
      dayEntries.forEach(entry => {
        const entryProfile = getWorkerProfile(entry.workerId);
        const isFt = entry.type === "Folga Trabalhada";
        const linkedFt = isFt
          ? state.ftEntries.find(item => item.date === entry.date && item.placeId === entry.placeId && (item.workerId === entry.workerId || item.name === workerName(entry.workerId)))
          : null;
        if (linkedFt?.id) linkedFtIds.add(linkedFt.id);
        const chip = document.createElement("div");
        chip.className = isFt ? "assigned-item ft-highlight" : "assigned-item";
        const profileMeta = entryProfile ? ` | Cargo: ${entryProfile.cargo || "N/A"}` : "";
        const liveEvidenceMeta = entry.derivedFromMonitoramento
          ? ` | Fonte: WhatsApp Monitoramento | ${formatDashboardDate(entry.evidenceAtMs)} | ${entry.monitoramentoSemantic || "evidencia"}${entry.monitoramentoShiftText ? ` | ${entry.monitoramentoShiftText}` : ""}${entry.monitoramentoReview ? " | em revisao" : ""}`
          : "";
        const ftMeta = isFt
          ? (() => {
              return linkedFt ? ` | Horas: ${linkedFt.hours || 0}h | Valor: ${currency(linkedFt.value)} | Motivo: ${getFtReason(linkedFt) || "Nao informado"}` : "";
            })()
          : "";
        chip.innerHTML = `
          <div class="assigned-main">
            <span class="assigned-name">${escapeHtml(dashboardEntryWorkerName(entry))}${isFt ? " (FT)" : ""}</span>
            <span class="assigned-meta">${escapeHtml(entry.type || "Escala")}${entry.scaleId ? ` / ${escapeHtml(scaleName(entry.scaleId))}` : ""}${escapeHtml(profileMeta)}${escapeHtml(liveEvidenceMeta)}${escapeHtml(ftMeta)}</span>
          </div>
          <div class="assigned-actions">
            ${entry.derivedFromMonitoramento
              ? (entryProfile?.id ? `<button class="small-btn" data-profile-edit="${entryProfile.id}">Perfil</button>` : "")
              : `<button class="small-btn" data-edit="${entry.id}">Editar</button><button class="small-btn danger" data-del="${entry.id}">Excluir</button>`}
          </div>
        `;
        const profileEditButton = chip.querySelector("[data-profile-edit]");
        if (profileEditButton) {
          profileEditButton.onclick = () => entryProfile?.id && editProfile(entryProfile.id);
        }
        const editButton = chip.querySelector("[data-edit]");
        if (editButton && form) editButton.onclick = () => editDashboardEntry(form, entry, linkedFt);
        const deleteButton = chip.querySelector("[data-del]");
        if (deleteButton) deleteButton.onclick = async () => {
          if (!entry.derivedFromFt && !entry.derivedFromMonitoramento) {
            await deleteEntity("entries", entry.id);
          }
          if (linkedFt) {
            await deleteEntity("ft_entries", linkedFt.id, false);
          }
          if (state.editingEntryId === entry.id) resetDashboardEntryForm(form);
        };
        listWrap.appendChild(chip);
      });
    }

    const ftWrap = card.querySelector(`[data-ft="${place.id}"]`);
    placeFt.filter(ft => !linkedFtIds.has(ft.id)).forEach(ft => {
      const row = document.createElement("div");
      row.className = "ft-highlight";
      row.innerHTML = `
        <div class="assigned-main">
          <span class="assigned-name">FT: ${ft.name}</span>
          <span class="assigned-meta">${getFtRoleLabel(ft)} / ${ft.startTime} / ${ft.hours}h / ${currency(ft.value)}</span>
        </div>
        <div class="assigned-actions">
          <button class="small-btn danger" data-ft-del="${ft.id}">Excluir</button>
        </div>
      `;
      row.querySelector("[data-ft-del]").onclick = async () => {
        await deleteEntity("ft_entries", ft.id);
      };
      ftWrap.appendChild(row);
    });

    if (!form) {
      el.dashboardGrid.appendChild(card);
      return;
    }

    const typeSelect = form.querySelector('[name="type"]');
    const workerSelect = form.querySelector('[name="workerId"]');
    const valueInput = form.querySelector('[name="ftValue"]');
    const hoursInput = form.querySelector('[name="ftHours"]');
    typeSelect.onchange = () => syncDashboardFtFields(form);
    workerSelect.onchange = () => {
      const profile = getWorkerProfile(workerSelect.value);
      if (!valueInput.value && profile) {
        valueInput.value = getProfileFtValue(profile) || "";
      }
      if (!hoursInput.value) {
        hoursInput.value = "12";
      }
      syncDashboardFtFields(form);
    };
    syncDashboardFtFields(form);

    form.onsubmit = async event => {
      event.preventDefault();
      if (!state.workers.length) return alert("Cadastre funcionarios antes.");
      const formData = new FormData(event.currentTarget);
      const selectedWorkerId = formData.get("workerId");
      let entryType = formData.get("type") || "Escala";
      let entryScaleId = formData.get("scaleId") || "";
      const ftDefaults = resolveDashboardFtDefaults(
        selectedWorkerId,
        formData.get("ftReason"),
        formData.get("ftHours"),
        formData.get("ftValue")
      );
      const profile = ftDefaults.profile;
      const editingEntry = state.entries.find(item => item.id === state.editingEntryId) || null;
      const existingFt = editingEntry
        ? state.ftEntries.find(item => item.date === editingEntry.date && item.placeId === editingEntry.placeId && (item.workerId === editingEntry.workerId || item.name === workerName(editingEntry.workerId)))
        : null;

      if (profile) {
        entryScaleId = entryScaleId || profile.scaleId;
        if (profile.placeId !== place.id) {
          entryType = "Folga Trabalhada";
        }
      }

      if (entryType === "Folga Trabalhada") {
        const ftId = existingFt?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        await setEntity("ft_entries", {
          id: ftId,
          name: workerName(selectedWorkerId),
          workerId: selectedWorkerId,
          placeId: place.id,
          date,
          startTime: "08:00",
          hours: ftDefaults.hours,
          value: ftDefaults.value,
          role: ftDefaults.role || "FT automatica",
          reason: ftDefaults.reason
        });
      } else if (existingFt) {
        await deleteEntity("ft_entries", existingFt.id, false);
      }

      await setEntity("entries", {
        id: editingEntry?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        date,
        placeId: place.id,
        workerId: selectedWorkerId,
        type: entryType,
        scaleId: entryScaleId
      });
      resetDashboardEntryForm(event.currentTarget);
    };

    if (state.editingEntryId) {
      const editingEntry = dayEntries.find(item => item.id === state.editingEntryId);
      if (editingEntry) {
        const linkedFt = state.ftEntries.find(item => item.date === editingEntry.date && item.placeId === editingEntry.placeId && (item.workerId === editingEntry.workerId || item.name === workerName(editingEntry.workerId)));
        editDashboardEntry(form, editingEntry, linkedFt);
      } else {
        resetDashboardEntryForm(form);
      }
    } else {
      resetDashboardEntryForm(form);
    }

    el.dashboardGrid.appendChild(card);
  });
}

function filteredExportEntries() {
  let rows = [...state.entries];
  if (el.exportMode.value === "day") rows = rows.filter(item => item.date === el.exportDay.value);
  if (el.exportMode.value === "range") rows = rows.filter(item => (!el.exportStart.value || item.date >= el.exportStart.value) && (!el.exportEnd.value || item.date <= el.exportEnd.value));
  if (el.exportPlace.value) rows = rows.filter(item => item.placeId === el.exportPlace.value);
  if (el.exportWorker.value) rows = rows.filter(item => item.workerId === el.exportWorker.value);
  return rows.sort((a, b) => (a.date > b.date ? 1 : -1));
}

function filteredExportFtEntries() {
  let rows = [...state.ftEntries];
  if (el.exportMode.value === "day") rows = rows.filter(item => item.date === el.exportDay.value);
  if (el.exportMode.value === "range") rows = rows.filter(item => (!el.exportStart.value || item.date >= el.exportStart.value) && (!el.exportEnd.value || item.date <= el.exportEnd.value));
  if (el.exportPlace.value) rows = rows.filter(item => item.placeId === el.exportPlace.value);
  if (el.exportWorker.value) {
    const selectedWorkerName = workerName(el.exportWorker.value);
    rows = rows.filter(item => item.workerId === el.exportWorker.value || String(item.name || "").trim() === selectedWorkerName);
  }
  return rows.sort((a, b) => (a.date > b.date ? 1 : -1));
}

function buildFtEmployeeSummary(ftRows) {
  const grouped = new Map();
  ftRows.forEach(item => {
    const employeeName = String(item.workerId ? workerName(item.workerId) : item.name || "Sem funcionario").trim() || "Sem funcionario";
    const key = item.workerId || normalizeText(employeeName) || employeeName;
    if (!grouped.has(key)) {
      grouped.set(key, {
        employeeName,
        places: new Set(),
        dates: new Set(),
        fallbackDays: 0,
        totalValue: 0
      });
    }
    const group = grouped.get(key);
    const currentPlace = placeName(item.placeId);
    group.places.add(currentPlace || "Sem local");
    if (item.date) {
      group.dates.add(item.date);
    } else {
      group.fallbackDays += 1;
    }
    group.totalValue += Number(item.value || 0);
  });
  return [...grouped.values()]
    .map(group => ({
      employeeName: group.employeeName,
      places: [...group.places].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", "),
      days: group.dates.size + group.fallbackDays,
      totalValue: group.totalValue
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "pt-BR"));
}

function exportFilterSummary() {
  const parts = [];
  if (el.exportMode.value === "day") parts.push(`Dia ${formatFtDate(el.exportDay.value)}`);
  if (el.exportMode.value === "range") parts.push(`Periodo ${formatFtDate(el.exportStart.value) || "inicio"} a ${formatFtDate(el.exportEnd.value) || "fim"}`);
  if (el.exportMode.value === "all") parts.push("Todo o periodo");
  parts.push(el.exportPlace.value ? `Local ${placeName(el.exportPlace.value)}` : "Todos os locais");
  parts.push(el.exportWorker.value ? `Funcionario ${workerName(el.exportWorker.value)}` : "Todos os funcionarios");
  return parts.join(" | ");
}

function exportPdf() {
  const rows = filteredExportEntries();
  const ftRows = filteredExportFtEntries();
  if (!rows.length && !ftRows.length) return alert("Sem dados para exportar com os filtros selecionados.");
  const ftTotal = ftRows.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const ftSummaryRows = buildFtEmployeeSummary(ftRows);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(13);
  doc.text("Relatorio de Recursos Humanos", 14, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Valor total de FT: ${currency(ftTotal)}`, 14, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const filterLines = doc.splitTextToSize(`Filtros aplicados: ${exportFilterSummary()}`, 182);
  doc.text(filterLines, 14, 34);
  doc.text(`Lancamentos de FT considerados: ${ftRows.length}`, 14, 34 + (filterLines.length * 5));
  doc.autoTable({
    head: [["Funcionario", "Local(is) de trabalho", "Dias FT", "Valor FT"]],
    body: ftSummaryRows.length
      ? ftSummaryRows.map(row => [row.employeeName, row.places, String(row.days), currency(row.totalValue)])
      : [["-", "Sem FT no filtro aplicado", "0", currency(0)]],
    startY: 43 + (filterLines.length * 5),
    styles: { fontSize: 10 }
  });
  if (rows.length) {
    doc.autoTable({
      head: [["Data", "Local", "Funcionario", "Tipo", "Escala"]],
      body: rows.map(row => [row.date, placeName(row.placeId), workerName(row.workerId), row.type || "Escala", scaleName(row.scaleId)]),
      startY: doc.lastAutoTable.finalY + 10,
      styles: { fontSize: 9 }
    });
  }
  doc.save(`rh-relatorio-${Date.now()}.pdf`);
}

function renderWorkerProfiles() {
  const search = el.profileSearch.value.trim().toLowerCase();
  const order = el.profileSort.value;
  let profiles = state.workerProfiles.map(p => ({
    ...p,
    _workerName: workerName(p.workerId),
    _placeName: placeName(p.placeId),
    _scaleName: scaleName(p.scaleId)
  }));
  if (search) {
    profiles = profiles.filter(p =>
      p._workerName.toLowerCase().includes(search) ||
      p._placeName.toLowerCase().includes(search) ||
      (p.cargo || "").toLowerCase().includes(search)
    );
  }
  profiles = sortedByName(profiles, order, "_workerName");

  renderSimpleSelect(el.profileWorkerId, state.workers, "Selecione o funcionario", el.profileWorkerId.value);
  renderSimpleSelect(el.profilePlaceId, state.places, "Selecione o posto de servico", el.profilePlaceId.value);
  renderSimpleSelect(el.profileScaleId, state.scales, "Selecione a escala", el.profileScaleId.value);

  if (!profiles.length) {
    el.profileList.innerHTML = `<div class="row"><span class="muted">Nenhum perfil cadastrado${search ? " com os filtros atuais" : ""}.</span></div>`;
    return;
  }
  el.profileList.innerHTML = "";
  profiles.forEach(p => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <span class="row-title">${p._workerName}</span>
        <span class="row-subtitle">Posto: ${p._placeName} | Escala: ${p._scaleName} | Cargo: ${p.cargo || "N/A"} | Preco FT: ${currency(getProfileFtValue(p))}</span>
      </div>
      <div class="actions">
        <button data-edit="${p.id}">Editar</button>
        <button class="danger" data-del="${p.id}">Excluir</button>
      </div>
    `;
    row.querySelector("[data-edit]").onclick = () => editProfile(p.id);
    row.querySelector("[data-del]").onclick = async () => {
      await deleteEntity("worker_profiles", p.id);
      if (state.editingProfileId === p.id) resetProfileForm();
    };
    el.profileList.appendChild(row);
  });
}

function renderAll() {
  if (state.editingPlaceId && !state.places.some(item => item.id === state.editingPlaceId)) {
    resetPlaceForm();
  }
  if (state.editingWorkerId && !state.workers.some(item => item.id === state.editingWorkerId)) {
    resetWorkerForm();
  }
  if (state.editingJobFunctionId && !state.jobFunctions.some(item => item.id === state.editingJobFunctionId)) {
    resetJobFunctionForm();
  }
  if (state.editingScaleId && !state.scales.some(item => item.id === state.editingScaleId)) {
    resetScaleForm();
  }
  if (state.editingProfileId && !state.workerProfiles.some(item => item.id === state.editingProfileId)) {
    resetProfileForm();
  }
  if (state.editingEntryId && !state.entries.some(item => item.id === state.editingEntryId)) {
    state.editingEntryId = "";
  }
  if (state.editingFtId && !state.ftEntries.some(item => item.id === state.editingFtId)) {
    state.editingFtId = "";
  }
  renderJobFunctionOptions();
  renderInlinePlaceList();
  renderInlineWorkerList();
  renderInlineJobFunctionList();
  renderInlineScaleList();
  renderSimpleSelect(el.workerPlaceId, state.places, "Selecione o local validado", el.workerPlaceId.value);
  renderSimpleSelect(el.exportPlace, state.places, "Todos os locais", el.exportPlace.value);
  renderSimpleSelect(el.exportWorker, state.workers, "Todos os funcionarios", el.exportWorker.value);
  renderSimpleSelect(el.ftWorkerId, state.workers, "Selecione funcionario (opcional)", el.ftWorkerId.value);
  renderSimpleSelect(el.ftPlaceId, state.places, "Selecione o local", el.ftPlaceId.value);
  renderSimpleSelect(el.docWorkerId, state.workers, "Selecione o colaborador", el.docWorkerId.value);
  renderInlineProfiles();
  renderDashboard();
  renderFtList();
  renderDocumentationList();
  renderFichasRegister();
  renderAuditLogs();
}

function initializeFirebase() {
  const config = window.RH_FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId) {
    el.loginError.textContent = "Preencha public/firebase-runtime-config.js com o projeto Firebase.";
    return null;
  }
  if (!firebase.apps.length) firebase.initializeApp(config);
  el.storageMode.textContent = `Base compartilhada: ${config.projectId}`;
  return {
    db: firebase.firestore(),
    storage: firebase.storage()
  };
}

const firebaseClients = initializeFirebase();
let seedFallbackLoaded = false;

function isArchivedEntity(item = {}) {
  return Boolean(item.archived || item.deletedAt || item.deletedBy);
}

function activeEntityItems(items = []) {
  return items.filter(item => !isArchivedEntity(item));
}

function applySeedFallback(reason = "seed") {
  if (seedFallbackLoaded) {
    const cacheApplied = applyDashboardPlaceReviewCache();
    if (cacheApplied) renderAll();
    return cacheApplied;
  }
  const seed = window.RH_SEED_DATA || {};
  const seedMap = {
    places: "places",
    workers: "workers",
    job_functions: "jobFunctions",
    worker_profiles: "workerProfiles",
    worker_documentation: "documentation",
    scales: "scales",
    entries: "entries",
    ftEntries: "ftEntries",
    rh_collaborator_sheet_workers: "collaboratorSheetWorkers"
  };
  let loaded = false;
  Object.entries(seedMap).forEach(([seedKey, stateKey]) => {
    if (!Array.isArray(seed[seedKey]) || state[stateKey].length) return;
    state[stateKey] = activeEntityItems(seed[seedKey].map(item => ({ ...item })));
    loaded = loaded || state[stateKey].length > 0;
  });
  const cacheApplied = applyDashboardPlaceReviewCache();
  if (loaded || cacheApplied) {
    seedFallbackLoaded = true;
    renderAll();
    setStatus(reason === "firestore-error" ? "Base local carregada; Firebase indisponivel" : "Base local carregada");
  }
  return loaded || cacheApplied;
}

async function ensureSeedData() {
  const bootstrapRef = firebaseClients.db.collection("system").doc("bootstrap");
  await firebaseClients.db.runTransaction(async tx => {
    const bootstrapDoc = await tx.get(bootstrapRef);
    if (bootstrapDoc.exists) return;
    const seed = window.RH_SEED_DATA || {};
    ["places", "workers", "job_functions", "worker_profiles", "scales", "entries"].forEach(collection => {
      (seed[collection] || []).forEach(item => {
        tx.set(firebaseClients.db.collection(collection).doc(item.id), item);
      });
    });
    (seed.ftEntries || []).forEach(item => {
      tx.set(firebaseClients.db.collection("ft_entries").doc(item.id), item);
    });
    tx.set(bootstrapRef, {
      seededAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: 1
    });
  });
}

function dashboardPublicFetchError(error) {
  const message = String(error?.message || error || "Erro de leitura");
  if (/permission|denied|PERMISSION_DENIED/i.test(message)) return "sem permissao de leitura";
  if (/resource[_\s-]*exhausted|quota/i.test(message)) return "quota indisponivel";
  if (/HTTP 429/i.test(message)) return "quota indisponivel";
  if (/index/i.test(message)) return "indice Firestore pendente";
  return message.slice(0, 120);
}

function firestoreReadBackoffReasonFor(error) {
  const issue = dashboardPublicFetchError(error);
  if (issue === "quota indisponivel") return "quota";
  if (issue === "sem permissao de leitura") return "permission";
  return "";
}

function firestoreReadBackoffActive() {
  return firestoreReadBackoffUntil > Date.now();
}

function applyFirestoreReadBackoff(error, sourceLabel = "Firestore") {
  const reason = firestoreReadBackoffReasonFor(error);
  if (!reason) return false;
  firestoreReadBackoffReason = reason;
  firestoreReadBackoffUntil = Date.now() + (reason === "quota" ? FIRESTORE_READ_QUOTA_BACKOFF_MS : FIRESTORE_READ_ERROR_BACKOFF_MS);
  state.dashboardFetchErrors[sourceLabel] = reason === "quota"
    ? "quota indisponivel; leituras pausadas temporariamente"
    : "sem permissao de leitura; leituras pausadas temporariamente";
  return true;
}

function stopRealtimeSubscriptions() {
  subscriptions.splice(0).forEach(unsub => {
    try {
      unsub();
    } catch {
      // Ignore stale unsubscribe handles from listeners that already failed.
    }
  });
}

async function probeFirestoreReadAvailability() {
  if (firestoreReadBackoffActive()) return false;
  try {
    const snapshot = await firebaseClients.db.collection("whatsapp_live").doc("rh").get();
    if (snapshot.exists) {
      state.whatsappRhSnapshot = { id: snapshot.id, ...snapshot.data() };
      delete state.dashboardFetchErrors["whatsapp_live/rh"];
    }
    firestoreReadBackoffUntil = 0;
    firestoreReadBackoffReason = "";
    return true;
  } catch (error) {
    applyFirestoreReadBackoff(error, "Firestore");
    throw error;
  }
}

function logDashboardReadWarning(context, error) {
  const issue = dashboardPublicFetchError(error);
  if (["quota indisponivel", "sem permissao de leitura"].includes(issue)) return;
  console.warn(context, error);
}

async function fetchDashboardJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function refreshDashboardLocalRhBridge() {
  try {
    const [summary, runtime] = await Promise.all([
      fetchDashboardJson(`${LOCAL_RH_BRIDGE_URL}/rh/status.json?days=90`),
      fetchDashboardJson(`${LOCAL_RH_BRIDGE_URL}/health`)
    ]);
    state.whatsappRhSnapshot = {
      id: "rh-local-bridge",
      runtime,
      summary,
      publishedAt: summary.generatedAt || new Date().toISOString(),
      source: "bridge local"
    };
    delete state.dashboardFetchErrors["whatsapp_live/rh"];
    renderDashboard();
    return true;
  } catch (error) {
    state.dashboardFetchErrors["whatsapp_live/rh"] = `cloud indisponivel; bridge local ${dashboardPublicFetchError(error)}`;
    renderDashboard();
    return false;
  }
}

async function refreshDashboardLocalMonitoramentoBridge() {
  try {
    const [status, runtime] = await Promise.all([
      fetchDashboardJson(`${LOCAL_MONITORAMENTO_BRIDGE_URL}/monitoramento/status.json?recentHours=24`),
      fetchDashboardJson(`${LOCAL_MONITORAMENTO_BRIDGE_URL}/health`)
    ]);
    state.monitoramentoSnapshot = {
      id: "monitoramento-local-bridge",
      runtime,
      status,
      publishedAt: status.generatedAt || new Date().toISOString(),
      source: "bridge local"
    };
    delete state.dashboardFetchErrors["whatsapp_live/monitoramento"];
    renderDashboard();
    return true;
  } catch (error) {
    logDashboardReadWarning("Dashboard RH monitoramento local bridge", error);
    renderDashboard();
    return false;
  }
}

function scheduleDashboardLocalRhRefresh() {
  if (dashboardLocalRhRefreshTimer) return;
  refreshDashboardLocalRhBridge();
  dashboardLocalRhRefreshTimer = window.setInterval(refreshDashboardLocalRhBridge, 30000);
}

function scheduleDashboardLocalMonitoramentoRefresh() {
  if (dashboardLocalMonitoramentoRefreshTimer) return;
  refreshDashboardLocalMonitoramentoBridge();
  dashboardLocalMonitoramentoRefreshTimer = window.setInterval(refreshDashboardLocalMonitoramentoBridge, 30000);
}

function watchCollection(collectionName, targetKey, queryBuilder = ref => ref) {
  const unsubscribe = queryBuilder(firebaseClients.db.collection(collectionName)).onSnapshot(snapshot => {
    state[targetKey] = activeEntityItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    if (targetKey === "places") {
      applyDashboardPlaceReviewCache();
      resetDashboardPlaceAliasCache();
    }
    delete state.dashboardFetchErrors[collectionName];
    renderAll();
    setStatus("Sincronizado");
  }, error => {
    logDashboardReadWarning(`Firebase RH collection unavailable ${collectionName}`, error);
    state.dashboardFetchErrors[collectionName] = dashboardPublicFetchError(error);
    if (applyFirestoreReadBackoff(error, collectionName)) stopRealtimeSubscriptions();
    applySeedFallback("firestore-error");
    renderDashboard();
    if (realtimeConnectionFailed) return;
    realtimeConnectionFailed = true;
    setStatus("Base local carregada; Firebase indisponivel");
  });
  subscriptions.push(unsubscribe);
}

function watchOptionalDashboardCollection(collectionName, targetKey, queryBuilder = ref => ref.limit(100), fallbackQueryBuilder = null) {
  let triedFallback = false;
  const subscribe = builder => {
    const unsubscribe = builder(firebaseClients.db.collection(collectionName)).onSnapshot(snapshot => {
      state[targetKey] = activeEntityItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      delete state.dashboardFetchErrors[collectionName];
      renderDashboard();
    }, error => {
      logDashboardReadWarning(`Dashboard RH ${collectionName}`, error);
      if (!triedFallback && fallbackQueryBuilder) {
        triedFallback = true;
        unsubscribe();
        subscribe(fallbackQueryBuilder);
        return;
      }
      state[targetKey] = [];
      delete state.dashboardFetchErrors[collectionName];
      renderDashboard();
    });
    subscriptions.push(unsubscribe);
    return unsubscribe;
  };
  subscribe(queryBuilder);
}

function watchOptionalDashboardDocument(collectionName, docId, targetKey, options = {}) {
  const sourceLabel = `${collectionName}/${docId}`;
  const unsubscribe = firebaseClients.db.collection(collectionName).doc(docId).onSnapshot(snapshot => {
    state[targetKey] = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
    if (snapshot.exists) delete state.dashboardFetchErrors[sourceLabel];
    else if (sourceLabel === "whatsapp_live/rh") scheduleDashboardLocalRhRefresh();
    else if (options.fallback) options.fallback();
    else if (!options.silentErrors) state.dashboardFetchErrors[sourceLabel] = "sem snapshot publicado";
    renderDashboard();
  }, error => {
    logDashboardReadWarning(`Dashboard RH ${sourceLabel}`, error);
    if (!options.ignoreReadBackoff && applyFirestoreReadBackoff(error, sourceLabel)) {
      if (sourceLabel === "whatsapp_live/rh") scheduleDashboardLocalRhRefresh();
      if (options.fallback) options.fallback();
      renderDashboard();
      return;
    }
    if (sourceLabel === "whatsapp_live/rh") scheduleDashboardLocalRhRefresh();
    else if (options.fallback) options.fallback();
    else if (!options.silentErrors) state.dashboardFetchErrors[sourceLabel] = dashboardPublicFetchError(error);
    renderDashboard();
  });
  subscriptions.push(unsubscribe);
}

async function connectRealtime() {
  stopRealtimeSubscriptions();
  if (dashboardLocalRhRefreshTimer) {
    window.clearInterval(dashboardLocalRhRefreshTimer);
    dashboardLocalRhRefreshTimer = null;
  }
  if (dashboardLocalMonitoramentoRefreshTimer) {
    window.clearInterval(dashboardLocalMonitoramentoRefreshTimer);
    dashboardLocalMonitoramentoRefreshTimer = null;
  }
  realtimeConnectionFailed = false;
  state.dashboardFetchErrors = {};
  if (firestoreReadBackoffActive()) {
    applySeedFallback("firestore-error");
    scheduleDashboardLocalRhRefresh();
    scheduleDashboardLocalMonitoramentoRefresh();
    state.dashboardFetchErrors.Firestore = firestoreReadBackoffReason === "quota"
      ? "quota indisponivel; leituras pausadas temporariamente"
      : "leituras pausadas temporariamente";
    renderDashboard();
    setStatus("Base local carregada; Firebase em pausa");
    return;
  }
  try {
    await probeFirestoreReadAvailability();
  } catch (error) {
    logDashboardReadWarning("Firebase RH probe unavailable", error);
    applySeedFallback("firestore-error");
    scheduleDashboardLocalRhRefresh();
    scheduleDashboardLocalMonitoramentoRefresh();
    renderDashboard();
    setStatus("Base local carregada; Firebase indisponivel");
    return;
  }
  watchCollection("places", "places");
  watchCollection("workers", "workers");
  watchCollection("job_functions", "jobFunctions");
  watchCollection("worker_profiles", "workerProfiles");
  watchCollection("worker_documentation", "documentation");
  watchCollection("scales", "scales");
  watchCollection("entries", "entries");
  watchCollection("ft_entries", "ftEntries");
  watchCollection("rh_collaborator_sheet_workers", "collaboratorSheetWorkers", ref => ref.orderBy("updatedAt", "desc").limit(1000));
  watchOptionalDashboardDocument("whatsapp_live", "rh", "whatsappRhSnapshot");
  watchOptionalDashboardDocument("whatsapp_live", "monitoramento", "monitoramentoSnapshot", {
    fallback: scheduleDashboardLocalMonitoramentoRefresh,
    ignoreReadBackoff: true,
    silentErrors: true
  });
  watchOptionalDashboardCollection(
    "rh_ai_draft_jobs",
    "rhAiDraftJobs",
    ref => ref.orderBy("updatedAt", "desc").limit(80),
    ref => ref.limit(80)
  );
  watchOptionalDashboardCollection(
    "rh_ai_feedback_events",
    "rhAiFeedbackEvents",
    ref => ref.orderBy("updatedAt", "desc").limit(200),
    ref => ref.limit(200)
  );
  if (state.currentUser && managerEmails.has(state.currentUser.email || "")) {
    watchCollection("audit_logs", "auditLogs", ref => ref.orderBy("createdAt", "desc").limit(200));
  } else {
    state.auditLogs = [];
  }
}

function summarizeEntity(collectionName, payload) {
  if (collectionName === "places") return `${payload.name || "Local"} / ${payload.city || "Sem cidade"}`;
  if (collectionName === "workers") return payload.name || "Funcionario";
  if (collectionName === "job_functions") return `${payload.name || "Funcao"} / ${currency(payload.value)}`;
  if (collectionName === "rh_collaborator_sheet_workers") return `${payload.name || payload.parsed?.name || "Colaborador"} / ${payload.place || payload.parsed?.place || "Sem posto"} / ${payload.role || payload.parsed?.role || "Sem funcao"}`;
  if (collectionName === "worker_documentation") return `${payload.fullName || "Dossie"} / ${docCompanyName(payload.company)} / ${payload.cpf || "CPF pendente"}`;
  if (collectionName === "worker_profiles") return `${workerName(payload.workerId)} / ${placeName(payload.placeId)} / ${payload.cargo || "Sem cargo"}`;
  if (collectionName === "scales") return `${payload.name || "Escala"} / ${payload.pattern || "Sem padrao"}`;
  if (collectionName === "entries") return `${payload.date || "Sem data"} / ${workerName(payload.workerId)} / ${placeName(payload.placeId)} / ${payload.type || "Escala"}`;
  if (collectionName === "ft_entries") return `${payload.date || "Sem data"} / ${payload.name || "FT"} / ${placeName(payload.placeId)} / ${getFtRoleLabel(payload)}`;
  return payload.id || "Registro";
}

function getEntitySnapshot(collectionName, id) {
  const listMap = {
    places: state.places,
    workers: state.workers,
    job_functions: state.jobFunctions,
    worker_profiles: state.workerProfiles,
    worker_documentation: state.documentation,
    scales: state.scales,
    entries: state.entries,
    ft_entries: state.ftEntries,
    rh_collaborator_sheet_workers: state.collaboratorSheetWorkers
  };
  return listMap[collectionName]?.find(item => item.id === id) || null;
}

function writeAuditLog(batch, action, collectionName, payload, previousValue) {
  const logRef = firebaseClients.db.collection("audit_logs").doc();
  const actionLabel = action === "create" ? "Inclusao" : action === "update" ? "Edicao" : action === "archive" ? "Arquivamento" : "Exclusao";
  const entityLabelMap = {
    places: "cliente/local",
    workers: "funcionario",
    job_functions: "funcao",
    worker_documentation: "documentacao",
    worker_profiles: "perfil funcionario",
    scales: "escala",
    entries: "alocacao",
    ft_entries: "FT",
    rh_collaborator_sheet_workers: "planilha colaboradores"
  };
  batch.set(logRef, {
    action,
    actionLabel,
    collectionName,
    entityId: payload?.id || previousValue?.id || "",
    entityLabel: entityLabelMap[collectionName] || collectionName,
    summary: summarizeEntity(collectionName, payload || previousValue || {}),
    userEmail: state.currentUser?.email || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    previousValue: previousValue || null,
    nextValue: payload || null
  });
}

async function setEntity(collectionName, payload, showBusy = true) {
  if (showBusy) setStatus("Salvando...");
  const docRef = firebaseClients.db.collection(collectionName).doc(payload.id);
  const previousValue = getEntitySnapshot(collectionName, payload.id);
  const batch = firebaseClients.db.batch();
  batch.set(docRef, payload, { merge: true });
  writeAuditLog(batch, previousValue ? "update" : "create", collectionName, payload, previousValue);
  await batch.commit();
}

async function deleteEntity(collectionName, id, showBusy = true) {
  if (showBusy) setStatus("Salvando...");
  const previousValue = getEntitySnapshot(collectionName, id);
  const archivedAt = new Date().toISOString();
  const batch = firebaseClients.db.batch();
  batch.set(firebaseClients.db.collection(collectionName).doc(id), {
    archived: true,
    archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
    archivedBy: state.currentUser?.email || "",
    deletedAt: archivedAt,
    deletedBy: state.currentUser?.email || "",
    deletionMode: "archive-only"
  }, { merge: true });
  writeAuditLog(batch, "archive", collectionName, { id, archived: true, deletedAt: archivedAt }, previousValue);
  await batch.commit();
}

async function upsertWorkerProfile(workerId, placeId, cargo, scaleId = "", precoFt = 0) {
  const existing = state.workerProfiles.find(item => item.workerId === workerId);
  const payload = {
    id: existing?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    workerId,
    placeId: placeId || existing?.placeId || "",
    scaleId: scaleId || existing?.scaleId || "",
    cargo: cargo || existing?.cargo || "",
    precoFt: Number(precoFt ?? existing?.precoFt ?? 0)
  };
  await setEntity("worker_profiles", payload, false);
  return payload;
}

async function saveDocumentationRecord() {
  const payload = readDocumentationForm();
  if (!payload.fullName || !payload.cpf) {
    alert("Preencha ao menos nome completo e CPF.");
    return;
  }
  if (!payload.id) payload.id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  if (!payload.workerId) {
    const existingWorker = state.workers.find(item => item.name.toLowerCase() === payload.fullName.toLowerCase());
    if (existingWorker) {
      payload.workerId = existingWorker.id;
    } else {
      const newWorkerId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      await setEntity("workers", { id: newWorkerId, name: payload.fullName }, false);
      payload.workerId = newWorkerId;
    }
  }
  await setEntity("worker_documentation", payload);
  state.currentDocId = payload.id;
  el.docUploadHint.textContent = "Dossie salvo. Voce pode enviar arquivos em lote usando o padrao nome-Xdocumento-Yfuncao.";
}

async function uploadDocumentationFiles() {
  const record = currentDocumentation();
  if (!record?.id) {
    alert("Salve o dossie antes de enviar arquivos.");
    return;
  }
  const files = [...(el.docFiles.files || [])];
  if (!files.length) {
    alert("Selecione pelo menos um arquivo.");
    return;
  }
  setStatus("Comprimindo e enviando arquivos...");
  el.docUploadHint.textContent = "Compactando arquivos em ZIP...";

  const category = el.docUploadCategory.value;
  const JSZip = window.JSZip;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const stamp = Date.now();
  const zipName = `${category}-${stamp}.zip`;
  const safeName = zipName.replace(/[^\w.\-]+/g, "-");
  const path = `rh-documentacao/${record.company}/${record.id}/${stamp}-${safeName}`;

  el.docUploadHint.textContent = "Enviando ZIP...";
  const snapshot = await firebaseClients.storage.ref(path).put(zipBlob, { contentType: "application/zip" });
  const downloadURL = await snapshot.ref.getDownloadURL();

  const uploaded = [{
    category,
    fileName: zipName,
    fileCount: files.length,
    fileNames: files.map(f => f.name),
    storagePath: path,
    downloadURL,
    uploadedAt: new Date().toISOString(),
    uploadedBy: state.currentUser?.email || ""
  }];

  await setEntity("worker_documentation", {
    ...record,
    files: [...(record.files || []), ...uploaded]
  });
  el.docFiles.value = "";
  setStatus("Sincronizado");
  el.docUploadHint.textContent = `${files.length} arquivo(s) compactado(s) e enviado(s) com sucesso.`;
}

async function downloadDocumentationFiles() {
  const record = currentDocumentation();
  if (!record?.id) {
    alert("Selecione um dossie primeiro.");
    return;
  }
  const allFiles = record.files || [];
  if (!allFiles.length) {
    alert("Nenhum arquivo cadastrado para este dossie.");
    return;
  }
  setStatus("Preparando download...");
  el.docUploadHint.textContent = "Baixando e compactando documentacao...";

  const JSZip = window.JSZip;
  const zip = new JSZip();

  for (const entry of allFiles) {
    if (!entry.downloadURL) continue;
    try {
      const response = await fetch(entry.downloadURL);
      const blob = await response.blob();
      zip.file(entry.fileName || "arquivo.zip", blob);
    } catch (err) {
      console.warn("Falha ao baixar:", entry.fileName, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const safeName = (record.fullName || record.id).replace(/\s+/g, "-").toLowerCase();
  const fileName = `documentacao-${safeName}.zip`;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(zipBlob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);

  setStatus("Sincronizado");
  el.docUploadHint.textContent = `Documentacao baixada em ${fileName}.`;
}

const FICHAS_FIELD_ALIASES = {
  name: ["nome", "funcionario", "colaborador", "trabalhador", "empregado", "nome completo", "nome colaborador", "nome do colaborador", "nome funcionario", "nome do funcionario"],
  place: ["posto", "local", "cliente", "unidade", "local de trabalho", "posto de trabalho", "posto de servico", "tomador"],
  city: ["cidade", "municipio", "localidade", "cidade residencia", "cidade residencial"],
  scale: ["escala", "jornada", "regime", "escala de trabalho"],
  period: ["periodo", "turno", "periodo trabalho"],
  role: ["funcao", "cargo", "funcao validada", "profissao", "cargo funcao"],
  company: ["empresa", "cnpj", "contratante", "empresa cnpj", "razao social"],
  date: ["data", "dia", "data escala", "data trabalhada", "data do plantao", "data turno", "data folga", "data ft"],
  startTime: ["entrada", "inicio", "hora entrada", "horario entrada", "inicio jornada"],
  endTime: ["saida", "fim", "hora saida", "horario saida", "fim jornada"],
  hours: ["horas", "carga horaria", "horas trabalhadas"],
  type: ["tipo", "situacao", "status", "evento"],
  value: ["valor", "valor ft", "preco ft"],
  cpf: ["cpf"],
  rg: ["rg", "identidade"],
  rgIssuer: ["orgao emissor rg", "orgao rg", "emissor rg", "expedidor rg"],
  rgIssueDate: ["data emissao rg", "data de emissao rg", "emissao rg", "dt emissao rg"],
  phone: ["telefone", "celular", "whatsapp", "fone", "contato"],
  email: ["email", "e-mail", "correio eletronico"],
  socialName: ["nome social"],
  birthDate: ["nascimento", "data nascimento", "data de nascimento", "dt nascimento", "nasc", "dn", "nasct", "nascto", "nascimento colaborador", "data nascimento colaborador"],
  birthPlace: ["local nascimento", "local de nascimento", "cidade nascimento", "naturalidade"],
  birthState: ["uf nascimento", "estado nascimento"],
  raceColor: ["cor raca", "cor/raca", "raca", "raça", "cor"],
  hasDisability: ["deficiente fisico", "pcd", "deficiencia", "possui deficiencia"],
  disabilityDescription: ["deficiencia informada", "descricao deficiencia", "tipo deficiencia"],
  zipCode: ["cep", "codigo postal"],
  address: ["endereco", "endereco residencial", "logradouro", "rua", "avenida"],
  addressNumber: ["numero", "n numero", "num", "nr", "no", "n"],
  addressComplement: ["complemento", "apto", "apartamento", "sala"],
  residenceType: ["tipo residencia", "tipo de residencia", "moradia"],
  addressBlock: ["bloco"],
  apartmentNumber: ["numero apartamento", "apartamento numero", "apto numero"],
  neighborhood: ["bairro"],
  stateName: ["uf", "estado"],
  education: ["escolaridade", "grau instrucao", "grau de instrucao"],
  ctps: ["ctps", "carteira trabalho", "carteira de trabalho"],
  ctpsSeries: ["serie ctps", "serie carteira trabalho", "serie carteira de trabalho"],
  ctpsIssueDate: ["data emissao ctps", "data de emissao ctps", "emissao ctps"],
  ctpsIssueState: ["uf ctps", "estado ctps"],
  tituloEleitor: ["titulo eleitor", "titulo de eleitor", "titulo"],
  voterZone: ["zona eleitoral", "zona titulo"],
  voterSection: ["secao eleitoral", "sessao eleitoral", "secao titulo", "sessao titulo"],
  voterState: ["uf titulo", "estado titulo", "uf titulo eleitor"],
  reservista: ["reservista", "certificado reservista"],
  reservistSeries: ["serie reservista"],
  reservistCategory: ["categoria reservista"],
  cnv: ["cnv", "reciclagem", "curso vigilante", "curso de vigilante"],
  courseCertificate: ["certificado curso", "certificado", "curso", "diploma"],
  healthCertificate: ["aso", "atestado saude", "atestado de saude", "exame medico", "saude"],
  criminalRecord: ["antecedentes", "antecedente criminal", "certidao criminal", "criminal"],
  notes: ["observacao", "observacoes", "obs", "notas", "comentario"],
  admissionDate: ["admissao", "data admissao", "data de admissao", "dt admissao", "adm"],
  pis: ["pis", "pasep", "pis pasep", "nit"],
  motherName: ["mae", "nome da mae", "nome mae"],
  fatherName: ["pai", "nome do pai", "nome pai"],
  maritalStatus: ["estado civil"],
  nationality: ["nacionalidade"],
  firstJob: ["primeiro emprego"],
  shoeSize: ["sapato", "bota", "tamanho sapato", "tamanho bota"],
  shirtSize: ["camisa", "tamanho camisa"],
  tshirtSize: ["camiseta", "tamanho camiseta"],
  jacketSize: ["jaqueta", "tamanho jaqueta"],
  pantsSize: ["calca", "calça", "tamanho calca", "tamanho calça"],
  spouseTaxDependent: ["conjuge dependente ir", "conjuge dependente imposto renda", "dependente ir conjuge"],
  bank: ["banco"],
  agency: ["agencia"],
  account: ["conta", "conta bancaria"],
  pix: ["pix", "chave pix"],
  salary: ["salario", "salario base", "sal base", "remuneracao", "remuneracao base"],
  grossSalary: ["salario bruto", "sal bruto", "remuneracao bruta"],
  houseTime: ["tempo casa", "tempo de casa"],
  transportDecision: ["vale transporte", "vt", "opcao vale transporte", "aceita vale transporte", "recebe vale transporte"],
  transportStreet: ["rua vale transporte", "endereco vale transporte", "endereco vt"],
  transportNumber: ["numero vale transporte", "numero vt"],
  transportState: ["uf vale transporte", "estado vt", "uf vt"],
  transportNeighborhood: ["bairro vale transporte", "bairro vt"],
  transportCity: ["cidade vale transporte", "cidade vt"],
  transportZipCode: ["cep vale transporte", "cep vt"],
  transportOption: ["opcao transporte", "tipo transporte", "cartao transporte"],
  transportRouteHomeToWork: ["trajeto ida", "trajeto casa trabalho", "casa trabalho"],
  transportRouteWorkToHome: ["trajeto volta", "trajeto trabalho casa", "trabalho casa"],
  lgpdAgreement: ["aceite lgpd", "lgpd", "consentimento lgpd"],
  status: ["status", "situacao admissional", "status admissional"]
};

for (let index = 1; index <= 4; index += 1) {
  FICHAS_FIELD_ALIASES[`dependent${index}Name`] = [`dependente ${index} nome`, `nome dependente ${index}`, `nome do dependente ${index}`];
  FICHAS_FIELD_ALIASES[`dependent${index}Relationship`] = [`dependente ${index} parentesco`, `parentesco dependente ${index}`];
  FICHAS_FIELD_ALIASES[`dependent${index}BirthDate`] = [`dependente ${index} nascimento`, `data nascimento dependente ${index}`, `data de nascimento dependente ${index}`];
  FICHAS_FIELD_ALIASES[`dependent${index}Cpf`] = [`dependente ${index} cpf`, `cpf dependente ${index}`];
}
FICHAS_FIELD_ALIASES.dependent1Name.push("nome dependente", "nome do dependente", "dependente nome");
FICHAS_FIELD_ALIASES.dependent1Relationship.push("parentesco dependente", "dependente parentesco");
FICHAS_FIELD_ALIASES.dependent1BirthDate.push("nascimento dependente", "data nascimento dependente", "data de nascimento dependente");
FICHAS_FIELD_ALIASES.dependent1Cpf.push("cpf dependente");

const FICHAS_EXACT_ONLY_ALIASES = new Set([
  "nome", "funcionario", "colaborador", "empresa", "cnpj", "data", "dia",
  "tipo", "status", "valor", "cpf", "rg", "telefone", "celular", "email",
  "cep", "endereco", "rua", "avenida", "numero", "num", "nr", "no", "n",
  "uf", "estado", "bairro", "titulo", "reservista", "cnv", "curso", "mae",
  "pai", "banco", "agencia", "conta", "pix", "vt", "lgpd", "cor", "raca",
  "cidade", "municipio", "localidade", "nascimento", "data nascimento",
  "data de nascimento", "dt nascimento", "nasc", "dn"
]);

const FICHAS_FIELD_MATCH_ORDER = [
  "name", "socialName", "motherName", "fatherName", "birthDate", "birthPlace", "birthState",
  "cpf", "rg", "rgIssuer", "rgIssueDate", "phone", "email",
  "ctps", "ctpsSeries", "ctpsIssueDate", "ctpsIssueState", "pis", "tituloEleitor", "voterZone", "voterSection", "voterState",
  "reservista", "reservistSeries", "reservistCategory",
  "address", "addressNumber", "addressComplement", "residenceType", "addressBlock", "apartmentNumber", "neighborhood", "city", "stateName", "zipCode",
  "role", "company", "admissionDate", "status", "education", "maritalStatus", "firstJob", "nationality", "raceColor", "hasDisability", "disabilityDescription",
  "shoeSize", "shirtSize", "tshirtSize", "jacketSize", "pantsSize", "bank", "agency", "account", "pix", "salary", "spouseTaxDependent",
  "grossSalary", "houseTime",
  "place", "scale", "period", "date", "startTime", "endTime", "hours", "type", "value",
  "transportDecision", "transportStreet", "transportNumber", "transportState", "transportNeighborhood", "transportCity", "transportZipCode", "transportOption",
  "transportRouteHomeToWork", "transportRouteWorkToHome", "lgpdAgreement",
  "cnv", "courseCertificate", "healthCertificate", "criminalRecord", "notes"
];

for (let index = 1; index <= 4; index += 1) {
  FICHAS_FIELD_MATCH_ORDER.push(`dependent${index}Name`, `dependent${index}Relationship`, `dependent${index}BirthDate`, `dependent${index}Cpf`);
}

const FICHAS_FIELD_LABELS = {
  name: "Nome",
  socialName: "Nome social",
  motherName: "Nome da mae",
  fatherName: "Nome do pai",
  birthDate: "Data de nascimento",
  birthPlace: "Naturalidade",
  birthState: "UF de nascimento",
  cpf: "CPF",
  rg: "RG",
  rgIssuer: "Orgao emissor do RG",
  rgIssueDate: "Emissao do RG",
  phone: "Telefone",
  email: "E-mail",
  company: "Empresa",
  place: "Posto",
  city: "Cidade",
  scale: "Escala",
  period: "Periodo",
  role: "Funcao",
  suggestedRole: "Funcao sugerida",
  admissionDate: "Data de admissao",
  status: "Situacao",
  date: "Data",
  startTime: "Entrada",
  endTime: "Saida",
  hours: "Horas",
  type: "Tipo",
  value: "Valor",
  zipCode: "CEP",
  address: "Endereco",
  addressNumber: "Numero",
  addressComplement: "Complemento",
  residenceType: "Tipo de residencia",
  addressBlock: "Bloco",
  apartmentNumber: "Apartamento",
  neighborhood: "Bairro",
  stateName: "Estado",
  education: "Escolaridade",
  maritalStatus: "Estado civil",
  firstJob: "Primeiro emprego",
  nationality: "Nacionalidade",
  raceColor: "Cor/raca",
  hasDisability: "Pessoa com deficiencia",
  disabilityDescription: "Descricao da deficiencia",
  ctps: "Carteira de trabalho",
  ctpsSeries: "Serie CTPS",
  ctpsIssueDate: "Emissao CTPS",
  ctpsIssueState: "UF CTPS",
  pis: "PIS/PASEP",
  tituloEleitor: "Titulo de eleitor",
  voterZone: "Zona eleitoral",
  voterSection: "Secao eleitoral",
  voterState: "UF eleitoral",
  reservista: "Reservista",
  reservistSeries: "Serie reservista",
  reservistCategory: "Categoria reservista",
  cnv: "CNV",
  courseCertificate: "Curso/reciclagem",
  healthCertificate: "Atestado/ASO",
  criminalRecord: "Antecedentes",
  shoeSize: "Calcado",
  shirtSize: "Camisa",
  tshirtSize: "Camiseta",
  jacketSize: "Jaqueta",
  pantsSize: "Calca",
  spouseTaxDependent: "Conjuge dependente IR",
  bank: "Banco",
  agency: "Agencia",
  account: "Conta",
  pix: "Chave Pix",
  pixKey: "Chave Pix",
  salary: "Salario base",
  grossSalary: "Salario bruto",
  houseTime: "Tempo de casa",
  notes: "Observacoes",
  transportDecision: "Vale transporte",
  transportStreet: "Rua VT",
  transportNumber: "Numero VT",
  transportState: "UF VT",
  transportNeighborhood: "Bairro VT",
  transportCity: "Cidade VT",
  transportZipCode: "CEP VT",
  transportOption: "Opcao transporte",
  transportRouteHomeToWork: "Trajeto casa-trabalho",
  transportRouteWorkToHome: "Trajeto trabalho-casa",
  lgpdAgreement: "Aceite LGPD",
  fullName: "Nome completo",
  street: "Endereco",
  number: "Numero",
  cep: "CEP",
  workCardNumber: "Carteira de trabalho",
  workCardSeries: "Serie CTPS",
  workCardIssueDate: "Emissao CTPS",
  workCardIssueState: "UF CTPS",
  rg: "RG",
  pisPasep: "PIS/PASEP",
  voterTitle: "Titulo de eleitor",
  reservistCertificate: "Reservista",
  educationLevel: "Escolaridade",
  accepted: "Aceitou VT",
  agreement: "Aceite",
  routeHomeToWork: "Trajeto casa-trabalho",
  routeWorkToHome: "Trajeto trabalho-casa"
};

const FICHAS_ADMISSION_SECTION_LABELS = {
  meta: "Admissao",
  personal: "Dados pessoais",
  address: "Endereco",
  documents: "Documentos",
  employment: "Contrato",
  dependents: "Dependentes",
  declaration: "Declaracao",
  lgpd: "LGPD",
  transport: "Vale transporte",
  finalSignature: "Assinatura"
};

const FICHAS_DATE_FIELDS = new Set([
  "date", "birthDate", "admissionDate", "rgIssueDate", "ctpsIssueDate",
  "dependent1BirthDate", "dependent2BirthDate", "dependent3BirthDate", "dependent4BirthDate"
]);

const FICHAS_NUMBER_FIELDS = new Set(["hours", "value", "salary", "grossSalary"]);

const FICHAS_REQUIRED_ADMISSION_FIELDS = [
  ["phone", "Telefone"],
  ["email", "E-mail"],
  ["motherName", "Nome da mae"],
  ["birthDate", "Data de nascimento"],
  ["address", "Endereco"],
  ["addressNumber", "Numero"],
  ["zipCode", "CEP"],
  ["ctps", "Carteira de trabalho"],
  ["cpf", "CPF"],
  ["pis", "PIS"],
  ["education", "Grau de escolaridade"],
  ["maritalStatus", "Estado civil"],
  ["pix", "Chave Pix"],
  ["bank", "Banco"]
];

const FICHAS_EXTRA_DOCUMENT_FIELDS = [
  "admissionDate",
  "pis",
  "motherName",
  "fatherName",
  "maritalStatus",
  "nationality",
  "socialName",
  "raceColor",
  "birthPlace",
  "birthState",
  "hasDisability",
  "disabilityDescription",
  "rgIssuer",
  "rgIssueDate",
  "ctpsSeries",
  "ctpsIssueDate",
  "ctpsIssueState",
  "voterZone",
  "voterSection",
  "voterState",
  "reservistSeries",
  "reservistCategory",
  "firstJob",
  "shoeSize",
  "shirtSize",
  "tshirtSize",
  "jacketSize",
  "pantsSize",
  "spouseTaxDependent",
  "bank",
  "agency",
  "account",
  "pix",
  "salary",
  "grossSalary",
  "houseTime",
  "transportDecision",
  "transportStreet",
  "transportNumber",
  "transportState",
  "transportNeighborhood",
  "transportCity",
  "transportZipCode",
  "transportOption",
  "transportRouteHomeToWork",
  "transportRouteWorkToHome",
  "lgpdAgreement",
  "status"
];

function openFichasUpload() {
  setActiveTab("planilha-colaboradores");
  el.fichasUploadFile?.focus();
}

function closeFichasUpload() {
  setActiveTab("dashboard");
}

function normalizeUploadKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function titleCaseUpload(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index > 0 && ["da", "de", "do", "das", "dos", "e"].includes(lower)) return lower;
      if (/^[A-Z0-9]{2,5}$/.test(part)) return part;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function stableUploadId(kind, value) {
  const base = normalizeUploadKey(value) || "sem-valor";
  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
  }
  return `upload-${kind}-${base.slice(0, 38)}-${Math.abs(hash).toString(36)}`;
}

function serializeUploadCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value || "").trim();
    }
  }
  return String(value ?? "").trim();
}

function isBlankRow(row) {
  return !row.some(value => String(value || "").trim());
}

function isFichasHeaderRow(row) {
  const keys = row.map(normalizeUploadKey);
  const aliases = Object.values(FICHAS_FIELD_ALIASES).flat().map(normalizeUploadKey);
  const hasName = keys.some(key => ["nome", "funcionario", "colaborador", "nomecompleto"].includes(key));
  const hits = keys.filter(key => aliases.some(alias => {
    if (!key || !alias) return false;
    if (key === alias) return true;
    return key.length >= 3 && alias.length >= 3 && key.includes(alias);
  }));
  return hasName && hits.length >= 2;
}

function canFuzzyUploadAlias(alias) {
  return alias.length >= 5 && !FICHAS_EXACT_ONLY_ALIASES.has(alias);
}

function looksLikeUploadSequence(value) {
  return /^\d+(?:[.,]0+)?$/.test(String(value || "").trim());
}

function looksLikeUploadPersonName(value) {
  const text = String(value || "").trim();
  const normalized = normalizeText(text);
  if (!normalized || looksLikeUploadSequence(text)) return false;
  return /[a-z]/.test(normalized) && (text.includes(" ") || normalized.length >= 8);
}

function repairUploadHeaders(headers, row) {
  const repaired = [...headers];
  for (let index = 0; index < repaired.length - 1; index += 1) {
    const key = normalizeUploadKey(repaired[index]);
    const nextKey = normalizeUploadKey(repaired[index + 1]);
    if (key !== "nome" || nextKey) continue;
    if (!looksLikeUploadSequence(row[index]) || !looksLikeUploadPersonName(row[index + 1])) continue;
    repaired[index] = "Ordem";
    repaired[index + 1] = headers[index];
  }
  return repaired;
}

function headerObjectFromRow(headers, row) {
  const effectiveHeaders = repairUploadHeaders(headers, row);
  const object = {};
  const counts = {};
  effectiveHeaders.forEach((header, index) => {
    const baseKey = String(header || `col_${index + 1}`).trim() || `col_${index + 1}`;
    counts[baseKey] = (counts[baseKey] || 0) + 1;
    const key = counts[baseKey] === 1 ? baseKey : `${baseKey}_${counts[baseKey]}`;
    object[key] = serializeUploadCell(row[index]);
  });
  return object;
}

function findUploadField(row, fieldName, excludedKeys = new Set()) {
  const aliases = (FICHAS_FIELD_ALIASES[fieldName] || []).map(normalizeUploadKey);
  const entries = Object.entries(row).filter(([key]) => !excludedKeys.has(key));
  for (const [key, value] of entries) {
    if (aliases.includes(normalizeUploadKey(key)) && String(value || "").trim()) return { key, value: String(value).trim() };
  }
  for (const [key, value] of entries) {
    const normalizedKey = normalizeUploadKey(key);
    if (aliases.some(alias => canFuzzyUploadAlias(alias) && normalizedKey.length >= 3 && normalizedKey.includes(alias)) && String(value || "").trim()) {
      return { key, value: String(value).trim() };
    }
  }
  return null;
}

function parseUploadFieldValue(fieldName, value) {
  if (FICHAS_DATE_FIELDS.has(fieldName)) return parseFichasDate(value);
  if (FICHAS_NUMBER_FIELDS.has(fieldName)) return parseFichasNumber(value);
  return String(value || "").trim();
}

function pickUploadField(row, fieldName, excludedKeys = new Set()) {
  const match = findUploadField(row, fieldName, excludedKeys);
  return match ? parseUploadFieldValue(fieldName, match.value) : "";
}

function collectUploadFields(rowObject) {
  const fields = {};
  const matchedKeys = new Set();
  FICHAS_FIELD_MATCH_ORDER.forEach(fieldName => {
    const match = findUploadField(rowObject, fieldName, matchedKeys);
    if (!match) return;
    fields[fieldName] = parseUploadFieldValue(fieldName, match.value);
    matchedKeys.add(match.key);
  });
  const extraFields = {};
  Object.entries(rowObject).forEach(([key, value]) => {
    if (matchedKeys.has(key)) return;
    if (String(value || "").trim()) extraFields[key] = serializeUploadCell(value);
  });
  return { fields, extraFields, matchedKeys: [...matchedKeys] };
}

function buildUploadWarnings(item) {
  const warnings = [];
  if (!item.placeRaw) warnings.push("Posto/local ausente; perfil, painel e escala diaria podem ficar sem vinculo de posto.");
  if (!item.cpf) warnings.push("CPF ausente; o registro da planilha usara o nome como identificador.");
  if (!item.role) warnings.push("Funcao ausente; o cargo sera inferido quando possivel.");
  if (!item.scaleRaw && !item.periodRaw) warnings.push("Escala/turno ausente; o perfil do funcionario ficara sem escala validada.");
  return warnings;
}

function parseFichasMatrix(matrix, sourceSheet = "") {
  const rows = [];
  let companyName = "";
  let headers = null;

  matrix.forEach((rawRow, rawIndex) => {
    const row = Array.from({ length: Math.max(12, rawRow.length) }, (_, index) => rawRow[index] ?? "");
    if (isBlankRow(row)) return;

    if (isFichasHeaderRow(row)) {
      headers = row;
      return;
    }

    let item = null;
    if (headers) {
      const rowObject = headerObjectFromRow(headers, row);
      const collected = collectUploadFields(rowObject);
      const field = name => collected.fields[name] || "";
      item = {
        rowNumber: rawIndex + 1,
        sourceSheet,
        raw: rowObject,
        columns: Object.keys(rowObject),
        recognizedFields: collected.fields,
        extraFields: collected.extraFields,
        company: field("company") || companyName,
        name: field("name"),
        placeRaw: field("place"),
        city: field("city"),
        scaleRaw: field("scale"),
        periodRaw: field("period"),
        role: field("role"),
        date: parseFichasDate(field("date")),
        startTime: parseFichasTime(field("startTime")),
        endTime: parseFichasTime(field("endTime")),
        hours: parseFichasNumber(field("hours")),
        type: field("type"),
        value: parseFichasNumber(field("value")),
        cpf: field("cpf"),
        rg: field("rg"),
        phone: field("phone"),
        email: field("email"),
        birthDate: parseFichasDate(field("birthDate")),
        zipCode: field("zipCode"),
        address: field("address"),
        addressNumber: field("addressNumber"),
        addressComplement: field("addressComplement"),
        neighborhood: field("neighborhood"),
        stateName: field("stateName"),
        education: field("education"),
        ctps: field("ctps"),
        tituloEleitor: field("tituloEleitor"),
        reservista: field("reservista"),
        cnv: field("cnv"),
        courseCertificate: field("courseCertificate"),
        healthCertificate: field("healthCertificate"),
        criminalRecord: field("criminalRecord"),
        notes: field("notes"),
        admissionDate: parseFichasDate(field("admissionDate")),
        pis: field("pis"),
        motherName: field("motherName"),
        fatherName: field("fatherName"),
        maritalStatus: field("maritalStatus"),
        nationality: field("nationality"),
        bank: field("bank"),
        agency: field("agency"),
        account: field("account"),
        pix: field("pix")
      };
      FICHAS_FIELD_MATCH_ORDER.forEach(fieldName => {
        if (typeof item[fieldName] === "undefined") item[fieldName] = field(fieldName);
      });
    } else {
      const positionalHeaders = row.map((_, index) => `col_${index + 1}`);
      const rowObject = headerObjectFromRow(positionalHeaders, row);
      item = {
        rowNumber: rawIndex + 1,
        sourceSheet,
        raw: rowObject,
        columns: Object.keys(rowObject),
        recognizedFields: {},
        extraFields: rowObject,
        company: companyName,
        name: String(row[1] || row[0] || "").trim(),
        placeRaw: String(row[2] || "").trim(),
        city: "",
        scaleRaw: String(row[3] || "").trim(),
        periodRaw: String(row[4] || "").trim(),
        role: String(row[5] || "").trim(),
        date: parseFichasDate(row[6]),
        startTime: parseFichasTime(row[7]),
        endTime: parseFichasTime(row[8]),
        hours: parseFichasNumber(row[9]),
        type: String(row[10] || "").trim(),
        value: parseFichasNumber(row[11]),
        cpf: "",
        rg: "",
        phone: "",
        email: "",
        birthDate: "",
        zipCode: "",
        address: "",
        addressNumber: "",
        addressComplement: "",
        neighborhood: "",
        stateName: "",
        education: "",
        ctps: "",
        tituloEleitor: "",
        reservista: "",
        cnv: "",
        courseCertificate: "",
        healthCertificate: "",
        criminalRecord: "",
        notes: ""
      };
    }

    const normalizedName = normalizeText(item.name);
    if (!item.name || normalizedName === "nome") return;
    if (!headers && item.name && !item.placeRaw && !item.scaleRaw && !item.periodRaw && !item.date && !item.role) {
      companyName = item.name;
      return;
    }
    const parsedItem = {
      ...item,
      company: item.company || companyName,
      name: titleCaseUpload(item.name),
      placeRaw: titleCaseUpload(item.placeRaw),
      city: titleCaseUpload(item.city),
      role: titleCaseUpload(item.role)
    };
    parsedItem.warnings = buildUploadWarnings(parsedItem);
    rows.push(parsedItem);
  });

  return rows.filter(row => row.name);
}

function parseFichasDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value);
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? (Number(br[3]) >= 50 ? `19${br[3]}` : `20${br[3]}`) : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : toIsoDate(parsed);
}

function parseFichasTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/(\d{1,2})(?:[:h](\d{1,2}))?/i);
  if (!match) return "";
  const hours = Math.min(23, Number(match[1]));
  const minutes = Math.min(59, Number(match[2] || 0));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseFichasNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  const normalized = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : "";
}

function extractXmlRows(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const rows = [...doc.getElementsByTagName("Row")];
  return rows.map(row => [...row.getElementsByTagName("Cell")].map(cell => {
    const data = cell.getElementsByTagName("Data")[0];
    return data ? data.textContent || "" : cell.textContent || "";
  }));
}

const FICHAS_PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const FICHAS_PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const FICHAS_TEXT_IMPORT_EXTENSIONS = new Set(["pdf", "docx", "txt"]);

function normalizeFichasDocumentText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeFichasXmlEntities(value) {
  const map = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'"
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const key = String(entity || "").toLowerCase();
    if (map[key]) return map[key];
    if (key.charAt(0) === "#") {
      const radix = key.charAt(1) === "x" ? 16 : 10;
      const offset = radix === 16 ? 2 : 1;
      const code = Number.parseInt(key.slice(offset), radix);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    }
    return _;
  });
}

function fichasScriptLoad(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      if (window.pdfjsLib) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Falha ao carregar leitor de PDF."));
    document.head.appendChild(script);
  });
}

async function ensureFichasPdfJs() {
  if (!window.pdfjsLib) await fichasScriptLoad(FICHAS_PDF_JS_URL);
  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = FICHAS_PDF_WORKER_URL;
  }
  if (!window.pdfjsLib) throw new Error("Leitor de PDF indisponivel.");
  return window.pdfjsLib;
}

async function readFichasPdfText(file) {
  const pdfjsLib = await ensureFichasPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pieces = [];
    content.items.forEach(item => {
      if (item?.str) pieces.push(item.str);
      pieces.push(item?.hasEOL ? "\n" : " ");
    });
    pages.push(pieces.join(""));
  }
  return normalizeFichasDocumentText(pages.join("\n\n"));
}

function fichasWordXmlToText(xml) {
  return normalizeFichasDocumentText(decodeFichasXmlEntities(String(xml || "")
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<[^>]+>/g, " ")));
}

async function readFichasDocxText(file) {
  if (!window.JSZip) throw new Error("Leitor DOCX indisponivel. Recarregue a pagina e tente novamente.");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("Texto principal do DOCX nao encontrado.");
  return fichasWordXmlToText(documentXml);
}

async function extractFichasTextFromFile(file, extension) {
  if (extension === "pdf") return readFichasPdfText(file);
  if (extension === "docx") return readFichasDocxText(file);
  return normalizeFichasDocumentText(await file.text());
}

function cleanFichasDocumentValue(value) {
  return String(value || "")
    .replace(/^[\s:;,\-]+/, "")
    .replace(/[\s:;,.\-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFichasRawFieldsFromText(text, sourceName) {
  const raw = {
    Arquivo: sourceName || "",
    "Tipo de importacao": "documento-texto"
  };
  const lines = normalizeFichasDocumentText(text).split(/\n+/).map(line => line.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    const cleanLine = cleanFichasDocumentValue(line);
    if (!cleanLine || cleanLine.length > 220) return;
    const labelled = cleanLine.match(/^(.{2,70}?)(?:\s*[:=]\s*|\s{2,})(.{1,160})$/);
    if (labelled) {
      const key = cleanFichasDocumentValue(labelled[1]);
      const value = cleanFichasDocumentValue(labelled[2]);
      if (key && value && normalizeUploadKey(key).length >= 2) raw[key] = value;
      return;
    }
    raw[`Linha ${index + 1}`] = cleanLine;
  });
  return raw;
}

function firstFichasRegexValue(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    for (let index = 1; index < match.length; index += 1) {
      if (cleanFichasDocumentValue(match[index])) return cleanFichasDocumentValue(match[index]);
    }
  }
  return "";
}

function inferFichasNameFromFileName(fileName) {
  const base = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+-\s+/)
    .pop()
    .replace(/\b(ficha|cadastral|admissao|admissional|documentacao|documentos|ordem|servico|servi[cç]o|contrato|rh|colaborador|funcionario)\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeText(base);
  if (!normalized || normalized.includes("tka") || normalized.includes("grupo")) return "";
  if (/\b(automatizado|controle|horarios|jornadas|escala|manual|termo|responsabilidade|veiculos|frota|apolice|cancelamento|endosso)\b/.test(normalized)) return "";
  return looksLikeUploadPersonName(base) ? titleCaseUpload(base) : "";
}

function applyFichasDocumentRegexFallbacks(fields, text, sourceName) {
  const lineText = normalizeFichasDocumentText(text);
  const compact = lineText.replace(/\n/g, " ");
  const normalized = normalizeText(compact);
  const set = (fieldName, value) => {
    if (String(fields[fieldName] || "").trim()) return;
    const cleaned = cleanFichasDocumentValue(value);
    if (cleaned) fields[fieldName] = parseUploadFieldValue(fieldName, cleaned);
  };
  set("name", firstFichasRegexValue(lineText, [
    /\b(?:nome\s+completo|nome\s+do\s+colaborador|nome\s+do\s+funcion[aá]rio|colaborador|funcion[aá]rio)\s*[:=-]?\s*([^,\n;|]{5,120})/i
  ]) || inferFichasNameFromFileName(sourceName));
  set("cpf", firstFichasRegexValue(lineText, [/\bcpf\s*[:=-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/i]) || firstFichasRegexValue(compact, [/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/]));
  set("rg", firstFichasRegexValue(lineText, [/\brg\s*[:=-]?\s*([0-9A-Za-z.\-]{5,25})/i]));
  set("pis", firstFichasRegexValue(lineText, [/\b(?:pis|pasep|pis\/pasep)\s*[:=-]?\s*([0-9.\-]{5,25})/i]));
  set("phone", firstFichasRegexValue(lineText, [/\b(?:telefone|celular|whatsapp|contato)\s*[:=-]?\s*((?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})/i]));
  set("email", firstFichasRegexValue(lineText, [/\b(?:e-mail|email)\s*[:=-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]) || firstFichasRegexValue(compact, [/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]));
  set("zipCode", firstFichasRegexValue(lineText, [/\b(?:cep)\s*[:=-]?\s*(\d{5}-?\d{3})\b/i]) || firstFichasRegexValue(compact, [/\b(\d{5}-?\d{3})\b/]));
  set("birthDate", firstFichasRegexValue(lineText, [/\b(?:data\s+de\s+nascimento|nascimento|nasc\.?)\D{0,18}(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i]));
  set("admissionDate", firstFichasRegexValue(lineText, [/\b(?:data\s+de\s+admiss[aã]o|admiss[aã]o)\D{0,18}(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i]));
  set("role", firstFichasRegexValue(lineText, [/\b(?:fun[cç][aã]o|cargo|profiss[aã]o)\s*[:=-]?\s*([^,\n;|]{3,80})/i]));
  set("place", firstFichasRegexValue(lineText, [/\b(?:posto|local\s+de\s+trabalho|posto\s+de\s+servi[cç]o|unidade)\s*[:=-]?\s*([^,\n;|]{3,100})/i]));
  set("address", firstFichasRegexValue(lineText, [/\b(?:endere[cç]o|logradouro|rua|avenida)\s*[:=-]?\s*([^,\n;|]{5,140})/i]));
  set("addressNumber", firstFichasRegexValue(lineText, [/\b(?:numero|n[uú]mero|n[ºo]\.?)\s*[:=-]?\s*([0-9A-Za-z\-\/]{1,20})/i]));
  set("city", firstFichasRegexValue(lineText, [/\b(?:cidade|munic[ií]pio)\s*[:=-]?\s*([^,\n;|]{3,80})/i]));
  set("stateName", firstFichasRegexValue(lineText, [/\b(?:estado|uf)\s*[:=-]?\s*([A-Z]{2}|[^,\n;|]{3,40})/i]));
  if (!fields.company && normalized.includes("tka zeladoria")) fields.company = "TKA Zeladoria";
  if (!fields.company && normalized.includes("tka security")) fields.company = "TKA Security";
  if (!fields.company && (normalized.includes("tka seguranca") || normalized.includes("tka seg"))) fields.company = "TKA Seguranca Privada";
}

function buildFichasDocumentWarnings(item) {
  const warnings = buildUploadWarnings(item);
  if (!item.cpf) warnings.push("Documento sem CPF reconhecido; o vinculo usara o nome quando possivel.");
  if (!Object.keys(item.recognizedFields || {}).length) warnings.push("Nenhum campo padrao foi reconhecido automaticamente.");
  return [...new Set(warnings)];
}

function parseFichasTextDocument(rawText, sourceName) {
  const text = normalizeFichasDocumentText(rawText);
  if (!text) return [];
  const raw = extractFichasRawFieldsFromText(text, sourceName);
  const collected = collectUploadFields(raw);
  const fields = { ...(collected.fields || {}) };
  applyFichasDocumentRegexFallbacks(fields, text, sourceName);
  const field = name => fields[name] || "";
  const item = {
    rowNumber: 1,
    sourceSheet: sourceName || "Documento",
    raw,
    columns: Object.keys(raw),
    recognizedFields: fields,
    extraFields: collected.extraFields || {},
    company: field("company"),
    name: field("name"),
    placeRaw: field("place"),
    city: field("city"),
    scaleRaw: field("scale"),
    periodRaw: field("period"),
    role: field("role"),
    date: parseFichasDate(field("date")),
    startTime: parseFichasTime(field("startTime")),
    endTime: parseFichasTime(field("endTime")),
    hours: parseFichasNumber(field("hours")),
    type: field("type"),
    value: parseFichasNumber(field("value")),
    cpf: field("cpf"),
    rg: field("rg"),
    phone: field("phone"),
    email: field("email"),
    birthDate: parseFichasDate(field("birthDate")),
    zipCode: field("zipCode"),
    address: field("address"),
    addressNumber: field("addressNumber"),
    addressComplement: field("addressComplement"),
    neighborhood: field("neighborhood"),
    stateName: field("stateName"),
    education: field("education"),
    ctps: field("ctps"),
    tituloEleitor: field("tituloEleitor"),
    reservista: field("reservista"),
    cnv: field("cnv"),
    courseCertificate: field("courseCertificate"),
    healthCertificate: field("healthCertificate"),
    criminalRecord: field("criminalRecord"),
    notes: field("notes"),
    admissionDate: parseFichasDate(field("admissionDate")),
    pis: field("pis"),
    motherName: field("motherName"),
    fatherName: field("fatherName"),
    maritalStatus: field("maritalStatus"),
    nationality: field("nationality"),
    bank: field("bank"),
    agency: field("agency"),
    account: field("account"),
    pix: field("pix")
  };
  FICHAS_FIELD_MATCH_ORDER.forEach(fieldName => {
    if (typeof item[fieldName] === "undefined") item[fieldName] = field(fieldName);
  });
  item.name = titleCaseUpload(item.name);
  item.placeRaw = titleCaseUpload(item.placeRaw);
  item.city = titleCaseUpload(item.city);
  item.role = titleCaseUpload(item.role);
  item.warnings = buildFichasDocumentWarnings(item);
  const usefulFieldCount = Object.entries(fields).filter(([, value]) => uploadValueIsPresent(value)).length;
  if (!item.name || usefulFieldCount < 2) return [];
  return [item];
}

async function readFichasFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (FICHAS_TEXT_IMPORT_EXTENSIONS.has(extension)) {
    const text = await extractFichasTextFromFile(file, extension);
    return parseFichasTextDocument(text, file.name);
  }
  if (!window.XLSX) throw new Error("Dependencia XLSX nao carregou. Recarregue a pagina e tente novamente.");
  if (extension === "xml") {
    const text = await file.text();
    const xmlRows = extractXmlRows(text);
    if (xmlRows.length) return parseFichasMatrix(xmlRows, file.name);
  }
  const data = extension === "csv" ? await file.text() : await file.arrayBuffer();
  const workbook = window.XLSX.read(data, { type: extension === "csv" ? "string" : "array", cellDates: true, raw: true });
  return workbook.SheetNames.flatMap(sheetName => {
    const matrix = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    return parseFichasMatrix(matrix, sheetName);
  });
}

function findByNormalizedName(list, name, field = "name") {
  const key = normalizeText(name);
  return list.find(item => normalizeText(item[field]) === key) || null;
}

function inferFichasScale(row) {
  const scaleText = normalizeText(`${row.scaleRaw || ""} ${row.periodRaw || ""}`);
  if (!scaleText) return null;
  const period = scaleText.includes("noturno") || scaleText.includes("noite") ? "Noturno" : "Diurno";
  const scaleMatch = scaleText.match(/(\d+)\s*x?\s*(\d+)/);
  const base = scaleMatch ? `${scaleMatch[1]}x${scaleMatch[2]}` : titleCaseUpload(row.scaleRaw);
  return {
    name: `${base} - ${period}`,
    pattern: `Escala ${base} ${period.toLowerCase()}`
  };
}

function inferFichasRole(row) {
  if (row.role) return row.role;
  const company = normalizeText(row.company);
  if (company.includes("seguranca")) return "Vigilante";
  return "Controlador de Acesso";
}

function firstUploadValue(nextValue, currentValue = "") {
  const nextText = String(nextValue ?? "").trim();
  return nextText ? nextText : (currentValue ?? "");
}

function cleanUploadForStorage(value) {
  if (value === undefined) return "";
  if (value === null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return value.map(cleanUploadForStorage);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanUploadForStorage(item)]));
  }
  return value;
}

function mergeNonEmptyDeep(base, next) {
  if (Array.isArray(next)) {
    const baseArray = Array.isArray(base) ? base : [];
    if (!next.length) return baseArray;
    const length = Math.max(baseArray.length, next.length);
    return Array.from({ length }, (_, index) => {
      if (index >= next.length) return baseArray[index];
      return mergeNonEmptyDeep(baseArray[index], next[index]);
    }).filter(value => {
      if (value === null || typeof value === "undefined") return false;
      if (typeof value === "string") return value.trim();
      if (typeof value === "object") return Object.values(value).some(item => String(item ?? "").trim());
      return true;
    });
  }
  if (next && typeof next === "object") {
    const output = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
    Object.entries(next).forEach(([key, value]) => {
      output[key] = mergeNonEmptyDeep(output[key], value);
    });
    return output;
  }
  if (typeof next === "boolean") return next;
  if (typeof next === "number") return Number.isFinite(next) ? next : base;
  return String(next ?? "").trim() ? next : (base ?? "");
}

const FICHAS_RH_SYNC_COLLECTIONS = [
  "places",
  "workers",
  "job_functions",
  "scales",
  "worker_profiles",
  "worker_documentation",
  "entries",
  "ft_entries"
];

function getFichasSyncStateList(collectionName) {
  const listMap = {
    places: state.places,
    workers: state.workers,
    job_functions: state.jobFunctions,
    scales: state.scales,
    worker_profiles: state.workerProfiles,
    worker_documentation: state.documentation,
    entries: state.entries,
    ft_entries: state.ftEntries
  };
  return listMap[collectionName] || [];
}

function createFichasSyncContext() {
  const maps = {};
  const upserts = {};
  FICHAS_RH_SYNC_COLLECTIONS.forEach(collectionName => {
    maps[collectionName] = new Map(getFichasSyncStateList(collectionName).map(item => [item.id, { ...item }]));
    upserts[collectionName] = new Map();
  });
  return { maps, upserts, rowTargets: [] };
}

function findFichasRecordByNormalized(ctx, collectionName, value, field = "name") {
  const key = normalizeText(value);
  if (!key) return null;
  return [...(ctx.maps[collectionName]?.values() || [])].find(item => normalizeText(item[field]) === key) || null;
}

function findFichasDocumentationRecord(ctx, parsed, workerId = "") {
  const cpfDigits = normalizeDigits(parsed.cpf);
  const docs = [...ctx.maps.worker_documentation.values()];
  if (cpfDigits) {
    const byCpf = docs.find(item => normalizeDigits(item.cpf) === cpfDigits);
    if (byCpf) return byCpf;
  }
  if (workerId) {
    const byWorker = docs.find(item => item.workerId === workerId);
    if (byWorker) return byWorker;
  }
  return docs.find(item => normalizeText(item.fullName) === normalizeText(parsed.name)) || null;
}

function findFichasWorkerRecord(ctx, parsed, fallbackWorkerId = "") {
  if (fallbackWorkerId && ctx.maps.workers.has(fallbackWorkerId)) return ctx.maps.workers.get(fallbackWorkerId);
  const doc = findFichasDocumentationRecord(ctx, parsed, fallbackWorkerId);
  if (doc?.workerId && ctx.maps.workers.has(doc.workerId)) return ctx.maps.workers.get(doc.workerId);
  return findFichasRecordByNormalized(ctx, "workers", parsed.name) || null;
}

function addFichasTarget(targets, collectionName, id) {
  if (!collectionName || !id) return;
  if (targets.some(target => target.collectionName === collectionName && target.id === id)) return;
  targets.push({ collectionName, id });
}

function mergeFichasTargets(...targetGroups) {
  const merged = [];
  targetGroups.flat().filter(Boolean).forEach(target => addFichasTarget(merged, target.collectionName, target.id));
  return merged;
}

function putFichasSyncPayload(ctx, collectionName, payload, targets) {
  if (!payload?.id) return null;
  const current = ctx.maps[collectionName].get(payload.id) || {};
  const merged = mergeNonEmptyDeep(current, payload);
  merged.id = payload.id;
  ctx.maps[collectionName].set(merged.id, merged);
  ctx.upserts[collectionName].set(merged.id, merged);
  addFichasTarget(targets, collectionName, merged.id);
  return merged;
}

function normalizeFichasCompanyKey(value) {
  const normalized = normalizeText(value);
  if (normalized.includes("zeladoria")) return "tka-zeladoria";
  if (normalized.includes("security")) return "tka-security";
  return "tka-seguranca-privada";
}

function normalizeFichasEntryType(parsed = {}) {
  const normalized = normalizeText(`${parsed.type || ""} ${parsed.notes || ""}`);
  if (/\bft\b/.test(normalized) || normalized.includes("folga trabalhada")) return "Folga Trabalhada";
  if (normalized.includes("permuta")) return "Permuta";
  return "Escala";
}

function buildFichasOperationalDocument(parsed, workerId, metadata = {}, existing = {}) {
  return {
    ...(existing || {}),
    workerId,
    fullName: parsed.name || existing.fullName || "",
    cpf: parsed.cpf || existing.cpf || "",
    rg: parsed.rg || existing.rg || "",
    ctps: parsed.ctps || existing.ctps || "",
    tituloEleitor: parsed.tituloEleitor || existing.tituloEleitor || "",
    reservista: parsed.reservista || existing.reservista || "",
    company: normalizeFichasCompanyKey(parsed.company || existing.company),
    role: parsed.role || parsed.suggestedRole || existing.role || "",
    birthDate: parsed.birthDate || existing.birthDate || "",
    phone: parsed.phone || existing.phone || "",
    email: parsed.email || existing.email || "",
    zipCode: parsed.zipCode || existing.zipCode || "",
    address: parsed.address || existing.address || "",
    addressNumber: parsed.addressNumber || existing.addressNumber || "",
    addressComplement: parsed.addressComplement || existing.addressComplement || "",
    neighborhood: parsed.neighborhood || existing.neighborhood || "",
    city: parsed.city || existing.city || "",
    stateName: parsed.stateName || existing.stateName || "",
    education: parsed.education || existing.education || "",
    cnv: parsed.cnv || existing.cnv || "",
    courseCertificate: parsed.courseCertificate || existing.courseCertificate || "",
    healthCertificate: parsed.healthCertificate || existing.healthCertificate || "",
    criminalRecord: parsed.criminalRecord || existing.criminalRecord || "",
    notes: parsed.notes || existing.notes || "",
    admission: mergeNonEmptyDeep(existing.admission || {}, parsed.admission || {}),
    files: existing.files || [],
    source: existing.source || "planilha-colaboradores",
    lastImportId: metadata.importId || existing.lastImportId || "",
    lastFileName: metadata.fileName || existing.lastFileName || "",
    updatedAt: metadata.appliedAt || existing.updatedAt || "",
    uploadedBy: state.currentUser?.email || existing.uploadedBy || ""
  };
}

function buildFichasOperationalSyncPlan(rows = [], metadata = {}) {
  const ctx = createFichasSyncContext();
  rows.forEach((rowPlan, rowIndex) => {
    const registry = rowPlan.registry || rowPlan;
    const parsed = {
      ...(registry.parsed || {}),
      ...(rowPlan.parsed || {})
    };
    const name = String(parsed.name || registry.name || "").trim();
    const targets = [];
    const linked = {};
    if (!name) {
      ctx.rowTargets[rowIndex] = targets;
      return;
    }

    const cpfDigits = normalizeDigits(parsed.cpf || registry.cpf);
    const existingWorker = findFichasWorkerRecord(ctx, { ...parsed, name }, registry.linkedWorkerId);
    const workerId = existingWorker?.id || stableUploadId("worker", cpfDigits || name);
    const worker = putFichasSyncPayload(ctx, "workers", {
      ...(existingWorker || {}),
      id: workerId,
      name,
      source: existingWorker?.source || "planilha-colaboradores",
      lastImportId: metadata.importId || existingWorker?.lastImportId || "",
      updatedAt: metadata.appliedAt || existingWorker?.updatedAt || ""
    }, targets);
    linked.workerId = worker?.id || "";

    const placeNameValue = String(parsed.place || registry.place || "").trim();
    let placeId = "";
    if (placeNameValue) {
      const existingPlace = findFichasRecordByNormalized(ctx, "places", placeNameValue);
      placeId = existingPlace?.id || stableUploadId("place", `${placeNameValue}|${parsed.city || ""}`);
      const place = putFichasSyncPayload(ctx, "places", {
        ...(existingPlace || {}),
        id: placeId,
        name: placeNameValue,
        city: parsed.city || existingPlace?.city || "",
        source: existingPlace?.source || "planilha-colaboradores",
        lastImportId: metadata.importId || existingPlace?.lastImportId || "",
        updatedAt: metadata.appliedAt || existingPlace?.updatedAt || ""
      }, targets);
      linked.placeId = place?.id || "";
    }

    const role = String(parsed.role || registry.role || parsed.suggestedRole || registry.suggestedRole || inferFichasRole(parsed)).trim();
    if (role) {
      const existingFunction = findFichasRecordByNormalized(ctx, "job_functions", role);
      const parsedValue = Number(parsed.value || 0);
      const functionValue = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : Number(existingFunction?.value || 0);
      const jobFunction = putFichasSyncPayload(ctx, "job_functions", {
        ...(existingFunction || {}),
        id: existingFunction?.id || stableUploadId("job-function", role),
        name: role,
        value: functionValue,
        source: existingFunction?.source || "planilha-colaboradores",
        lastImportId: metadata.importId || existingFunction?.lastImportId || "",
        updatedAt: metadata.appliedAt || existingFunction?.updatedAt || ""
      }, targets);
      linked.jobFunctionId = jobFunction?.id || "";
    }

    const scaleSpec = inferFichasScale({ scaleRaw: parsed.scale || "", periodRaw: parsed.period || "" });
    const scaleNameValue = String(parsed.scale || scaleSpec?.name || "").trim();
    let scaleId = "";
    if (scaleNameValue) {
      const existingScale = findFichasRecordByNormalized(ctx, "scales", scaleNameValue);
      scaleId = existingScale?.id || stableUploadId("scale", scaleNameValue);
      const scale = putFichasSyncPayload(ctx, "scales", {
        ...(existingScale || {}),
        id: scaleId,
        name: scaleNameValue,
        pattern: existingScale?.pattern || scaleSpec?.pattern || scaleNameValue,
        source: existingScale?.source || "planilha-colaboradores",
        lastImportId: metadata.importId || existingScale?.lastImportId || "",
        updatedAt: metadata.appliedAt || existingScale?.updatedAt || ""
      }, targets);
      linked.scaleId = scale?.id || "";
    }

    if (workerId && (placeId || scaleId || role)) {
      const existingProfile = [...ctx.maps.worker_profiles.values()].find(item => item.workerId === workerId) || null;
      const parsedValue = Number(parsed.value || 0);
      const profileValue = Number(getSuggestedFtValue(role, parsedValue || existingProfile?.precoFt || 0) || 0);
      const profile = putFichasSyncPayload(ctx, "worker_profiles", {
        ...(existingProfile || {}),
        id: existingProfile?.id || stableUploadId("worker-profile", workerId),
        workerId,
        placeId: placeId || existingProfile?.placeId || "",
        scaleId: scaleId || existingProfile?.scaleId || "",
        cargo: role || existingProfile?.cargo || "",
        precoFt: profileValue,
        source: existingProfile?.source || "planilha-colaboradores",
        lastImportId: metadata.importId || existingProfile?.lastImportId || "",
        updatedAt: metadata.appliedAt || existingProfile?.updatedAt || ""
      }, targets);
      linked.profileId = profile?.id || "";
    }

    const existingDoc = findFichasDocumentationRecord(ctx, { ...parsed, name }, workerId);
    const documentation = putFichasSyncPayload(ctx, "worker_documentation", {
      ...buildFichasOperationalDocument({ ...parsed, name }, workerId, metadata, existingDoc || {}),
      id: existingDoc?.id || stableUploadId("worker-documentation", cpfDigits || workerId || name)
    }, targets);
    linked.documentationId = documentation?.id || "";

    const date = parseFichasDate(parsed.date);
    if (date && placeId && workerId) {
      const entryType = normalizeFichasEntryType(parsed);
      let ftEntryId = "";
      if (entryType === "Folga Trabalhada") {
        const existingFt = [...ctx.maps.ft_entries.values()].find(item =>
          item.date === date &&
          item.placeId === placeId &&
          (item.workerId === workerId || normalizeText(item.name) === normalizeText(name))
        );
        const ftEntry = putFichasSyncPayload(ctx, "ft_entries", {
          ...(existingFt || {}),
          id: existingFt?.id || stableUploadId("ft-entry", `${date}|${placeId}|${workerId}|${parsed.startTime || ""}`),
          workerId,
          name,
          placeId,
          date,
          startTime: parsed.startTime || existingFt?.startTime || "08:00",
          hours: parsed.hours !== "" && typeof parsed.hours !== "undefined" ? Number(parsed.hours || 0) : Number(existingFt?.hours || 12),
          value: parsed.value !== "" && typeof parsed.value !== "undefined" ? Number(parsed.value || 0) : Number(existingFt?.value || getProfileFtValue(ctx.maps.worker_profiles.get(linked.profileId)) || 0),
          role,
          reason: parsed.type || existingFt?.reason || "",
          source: existingFt?.source || "planilha-colaboradores",
          lastImportId: metadata.importId || existingFt?.lastImportId || "",
          updatedAt: metadata.appliedAt || existingFt?.updatedAt || ""
        }, targets);
        ftEntryId = ftEntry?.id || "";
        linked.ftEntryId = ftEntryId;
      }

      const existingEntry = [...ctx.maps.entries.values()].find(item =>
        item.date === date &&
        item.placeId === placeId &&
        item.workerId === workerId
      );
      const entry = putFichasSyncPayload(ctx, "entries", {
        ...(existingEntry || {}),
        id: existingEntry?.id || stableUploadId("entry", `${date}|${placeId}|${workerId}`),
        date,
        placeId,
        workerId,
        type: entryType,
        scaleId,
        ftEntryId,
        source: existingEntry?.source || "planilha-colaboradores",
        lastImportId: metadata.importId || existingEntry?.lastImportId || "",
        updatedAt: metadata.appliedAt || existingEntry?.updatedAt || ""
      }, targets);
      linked.entryId = entry?.id || "";
    }

    registry.scope = "rh-linked";
    registry.linkedWorkerId = linked.workerId || registry.linkedWorkerId || "";
    registry.linkedPlaceId = linked.placeId || registry.linkedPlaceId || "";
    registry.linkedScaleId = linked.scaleId || registry.linkedScaleId || "";
    registry.linkedProfileId = linked.profileId || registry.linkedProfileId || "";
    registry.linkedDocumentationId = linked.documentationId || registry.linkedDocumentationId || "";
    registry.linkedEntryId = linked.entryId || registry.linkedEntryId || "";
    registry.linkedFtEntryId = linked.ftEntryId || registry.linkedFtEntryId || "";
    registry.linkedTargets = targets;
    registry.syncedAt = metadata.appliedAt || registry.syncedAt || "";
    ctx.rowTargets[rowIndex] = targets;
  });

  const upserts = Object.fromEntries(FICHAS_RH_SYNC_COLLECTIONS.map(collectionName => [
    collectionName,
    [...ctx.upserts[collectionName].values()]
  ]));
  const rhLinkedRecords = Object.values(upserts).reduce((sum, list) => sum + list.length, 0);
  return {
    upserts,
    rowTargets: ctx.rowTargets,
    summary: {
      rhLinkedRecords,
      linkedWorkers: upserts.workers.length,
      linkedPlaces: upserts.places.length,
      linkedJobFunctions: upserts.job_functions.length,
      linkedScales: upserts.scales.length,
      linkedProfiles: upserts.worker_profiles.length,
      linkedDocuments: upserts.worker_documentation.length,
      linkedEntries: upserts.entries.length,
      linkedFtEntries: upserts.ft_entries.length
    }
  };
}

function attachFichasOperationalSync(result = {}, metadata = {}) {
  const plan = buildFichasOperationalSyncPlan(result.rows || [], metadata);
  result.operationalSync = plan;
  (result.rows || []).forEach((row, index) => {
    const sheetTargets = row.registry?.id ? [{ collectionName: "rh_collaborator_sheet_workers", id: row.registry.id }] : [];
    row.targets = mergeFichasTargets(sheetTargets, plan.rowTargets[index] || []);
  });
  result.summary = {
    ...(result.summary || {}),
    ...(plan.summary || {})
  };
  return result;
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeFichasBoolean(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (["sim", "s", "yes", "true", "1", "aceito", "aceita", "recebe"].includes(normalized)) return "sim";
  if (["nao", "não", "n", "no", "false", "0", "recusa", "recusado", "naoaceito", "naorecebe"].includes(normalized.replace(/\s+/g, ""))) return "nao";
  return String(value || "").trim();
}

function normalizeTransportDecision(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.includes("nao") || normalized.includes("recusa") || normalized.includes("dispensa")) return "decline";
  if (normalized.includes("sim") || normalized.includes("aceit") || normalized.includes("recebe") || normalized.includes("utiliza")) return "accept";
  return normalized === "s" ? "accept" : normalized === "n" ? "decline" : "";
}

function parseFichasBooleanFlag(value) {
  const normalized = normalizeFichasBoolean(value);
  if (!normalized) return "";
  if (normalized === "sim") return true;
  if (normalized === "nao") return false;
  return normalized;
}

function buildFichasDependents(row) {
  const dependents = [];
  for (let index = 1; index <= 4; index += 1) {
    const dependent = {
      name: row[`dependent${index}Name`] || "",
      relationship: row[`dependent${index}Relationship`] || "",
      birthDate: row[`dependent${index}BirthDate`] || "",
      cpf: row[`dependent${index}Cpf`] || ""
    };
    if (dependent.name || dependent.relationship || dependent.birthDate || dependent.cpf) dependents.push(dependent);
  }
  return dependents;
}

function buildFichasAdmissionData(row, role) {
  const transportDecision = normalizeTransportDecision(row.transportDecision);
  const lgpdAgreement = parseFichasBooleanFlag(row.lgpdAgreement);
  const declarationPlace = row.city || row.placeRaw || "";
  const todayValue = today;
  return {
    meta: {
      source: "planilha-colaboradores",
      status: row.status || "",
      company: row.company || "",
      role: role || row.role || "",
      admissionDate: row.admissionDate || "",
      rhNotes: row.notes || ""
    },
    personal: {
      fullName: row.name || "",
      socialName: row.socialName || "",
      phone: row.phone || "",
      email: row.email || "",
      motherName: row.motherName || "",
      fatherName: row.fatherName || "",
      birthDate: row.birthDate || "",
      raceColor: row.raceColor || "",
      birthPlace: row.birthPlace || "",
      birthState: row.birthState || "",
      hasDisability: normalizeFichasBoolean(row.hasDisability),
      disabilityDescription: row.disabilityDescription || "",
      nationality: row.nationality || ""
    },
    address: {
      street: row.address || "",
      number: row.addressNumber || "",
      state: row.stateName || "",
      complement: row.addressComplement || "",
      residenceType: row.residenceType || "",
      block: row.addressBlock || "",
      apartmentNumber: row.apartmentNumber || "",
      neighborhood: row.neighborhood || "",
      city: row.city || "",
      cep: row.zipCode || ""
    },
    documents: {
      workCardNumber: row.ctps || "",
      workCardSeries: row.ctpsSeries || "",
      workCardIssueDate: row.ctpsIssueDate || "",
      workCardIssueState: row.ctpsIssueState || "",
      rg: row.rg || "",
      rgIssuer: row.rgIssuer || "",
      rgIssueDate: row.rgIssueDate || "",
      cpf: row.cpf || "",
      pisPasep: row.pis || "",
      voterTitle: row.tituloEleitor || "",
      voterZone: row.voterZone || "",
      voterSection: row.voterSection || "",
      voterState: row.voterState || "",
      reservistCertificate: row.reservista || "",
      reservistSeries: row.reservistSeries || "",
      reservistCategory: row.reservistCategory || ""
    },
    employment: {
      role: role || row.role || "",
      educationLevel: row.education || "",
      maritalStatus: row.maritalStatus || "",
      firstJob: normalizeFichasBoolean(row.firstJob),
      shoeSize: row.shoeSize || "",
      shirtSize: row.shirtSize || "",
      tshirtSize: row.tshirtSize || "",
      jacketSize: row.jacketSize || "",
      pantsSize: row.pantsSize || "",
      pixKey: row.pix || "",
      bank: row.bank || "",
      agency: row.agency || "",
      account: row.account || "",
      salary: row.salary !== "" && typeof row.salary !== "undefined" ? row.salary : "",
      grossSalary: row.grossSalary !== "" && typeof row.grossSalary !== "undefined" ? row.grossSalary : "",
      houseTime: row.houseTime || "",
      spouseTaxDependent: normalizeFichasBoolean(row.spouseTaxDependent)
    },
    dependents: buildFichasDependents(row),
    declaration: {
      name: row.name || "",
      place: declarationPlace,
      date: todayValue,
      notes: row.notes || ""
    },
    lgpd: {
      name: row.name || "",
      place: declarationPlace,
      date: todayValue,
      agreement: lgpdAgreement
    },
    transport: {
      decision: transportDecision,
      accepted: transportDecision ? transportDecision === "accept" : "",
      street: row.transportStreet || row.address || "",
      number: row.transportNumber || row.addressNumber || "",
      state: row.transportState || row.stateName || "",
      neighborhood: row.transportNeighborhood || row.neighborhood || "",
      city: row.transportCity || row.city || "",
      cep: row.transportZipCode || row.zipCode || "",
      option: row.transportOption || "",
      name: row.name || "",
      place: declarationPlace,
      date: todayValue,
      routeHomeToWork: row.transportRouteHomeToWork || "",
      routeWorkToHome: row.transportRouteWorkToHome || ""
    },
    finalSignature: {
      name: row.name || "",
      place: declarationPlace,
      date: todayValue
    }
  };
}

async function commitFichasWrites(writeHandler) {
  const db = firebaseClients.db;
  let batch = db.batch();
  let writeCount = 0;

  const flush = async (force = false) => {
    if (!writeCount) return;
    if (!force && writeCount < 380) return;
    await batch.commit();
    batch = db.batch();
    writeCount = 0;
  };

  const addRawSet = async (ref, payload, options = {}) => {
    batch.set(ref, cleanUploadForStorage(payload), options);
    writeCount += 1;
    await flush();
  };

  const addEntitySet = async (collectionName, payload, options = { merge: true }) => {
    if (!payload?.id) return;
    const previousValue = getEntitySnapshot(collectionName, payload.id);
    batch.set(db.collection(collectionName).doc(payload.id), cleanUploadForStorage(payload), options);
    writeCount += 1;
    writeAuditLog(batch, previousValue ? "update" : "create", collectionName, payload, previousValue);
    writeCount += 1;
    await flush();
  };

  await writeHandler({ db, addRawSet, addEntitySet });
  await flush(true);
}

async function persistFichasOperationalUpserts(syncPlan, addEntitySet) {
  if (!syncPlan?.upserts) return;
  for (const collectionName of FICHAS_RH_SYNC_COLLECTIONS) {
    for (const payload of syncPlan.upserts[collectionName] || []) {
      await addEntitySet(collectionName, payload, { merge: true });
    }
  }
}

async function persistFichasParsedRows(importId, result, metadata) {
  attachFichasOperationalSync(result, { ...metadata, importId });

  await commitFichasWrites(async ({ db, addRawSet, addEntitySet }) => {
    await addRawSet(db.collection("rh_collaborator_sheet_imports").doc(importId), {
      id: importId,
      source: "recursos-humanos/planilha-colaboradores",
      fileName: metadata.fileName,
      mode: metadata.mode,
      parsedAt: metadata.parsedAt,
      appliedAt: metadata.appliedAt,
      uploadedBy: state.currentUser?.email || "",
      summary: result.summary,
      columns: result.columns,
      warnings: result.warnings,
      registerCount: result.summary.register || 0,
      rhLinkedRecords: result.summary.rhLinkedRecords || 0
    });

    for (const row of result.rows) {
      const rowId = `${importId}-${String(row.rowNumber || 0).padStart(5, "0")}`;
      await addRawSet(db.collection("rh_collaborator_sheet_rows").doc(rowId), {
        id: rowId,
        importId,
        source: "recursos-humanos/planilha-colaboradores",
        fileName: metadata.fileName,
        sourceSheet: row.sourceSheet || "",
        rowNumber: row.rowNumber || 0,
        raw: row.raw || {},
        recognizedFields: row.recognizedFields || {},
        extraFields: row.extraFields || {},
        parsed: row.parsed || {},
        warnings: row.warnings || [],
        targets: row.targets || [],
        appliedAt: metadata.appliedAt,
        uploadedBy: state.currentUser?.email || ""
      });
      if (row.registry?.id) {
        await addEntitySet("rh_collaborator_sheet_workers", {
          ...row.registry,
          lastImportId: importId,
          lastFileName: metadata.fileName,
          updatedAt: metadata.appliedAt,
          appliedAt: metadata.appliedAt,
          uploadedBy: state.currentUser?.email || ""
        }, { merge: true });
      }
    }

    await persistFichasOperationalUpserts(result.operationalSync, addEntitySet);
  });
}

function parsedFichasRow(row, role, scaleSpec, suggestedRole = "") {
  const parsed = {
    name: row.name || "",
    socialName: row.socialName || "",
    cpf: row.cpf || "",
    rg: row.rg || "",
    rgIssuer: row.rgIssuer || "",
    rgIssueDate: row.rgIssueDate || "",
    phone: row.phone || "",
    email: row.email || "",
    company: row.company || "",
    place: row.placeRaw || "",
    city: row.city || "",
    scale: scaleSpec?.name || row.scaleRaw || "",
    period: row.periodRaw || "",
    role: row.role || role || "",
    suggestedRole: suggestedRole && suggestedRole !== row.role ? suggestedRole : "",
    date: row.date || "",
    startTime: row.startTime || "",
    endTime: row.endTime || "",
    hours: row.hours,
    type: row.type || "",
    value: row.value,
    birthDate: row.birthDate || "",
    birthPlace: row.birthPlace || "",
    birthState: row.birthState || "",
    raceColor: row.raceColor || "",
    hasDisability: normalizeFichasBoolean(row.hasDisability),
    disabilityDescription: row.disabilityDescription || "",
    zipCode: row.zipCode || "",
    address: row.address || "",
    addressNumber: row.addressNumber || "",
    addressComplement: row.addressComplement || "",
    residenceType: row.residenceType || "",
    addressBlock: row.addressBlock || "",
    apartmentNumber: row.apartmentNumber || "",
    neighborhood: row.neighborhood || "",
    stateName: row.stateName || "",
    education: row.education || "",
    ctps: row.ctps || "",
    ctpsSeries: row.ctpsSeries || "",
    ctpsIssueDate: row.ctpsIssueDate || "",
    ctpsIssueState: row.ctpsIssueState || "",
    tituloEleitor: row.tituloEleitor || "",
    voterZone: row.voterZone || "",
    voterSection: row.voterSection || "",
    voterState: row.voterState || "",
    reservista: row.reservista || "",
    reservistSeries: row.reservistSeries || "",
    reservistCategory: row.reservistCategory || "",
    cnv: row.cnv || "",
    courseCertificate: row.courseCertificate || "",
    healthCertificate: row.healthCertificate || "",
    criminalRecord: row.criminalRecord || "",
    notes: row.notes || "",
    admission: buildFichasAdmissionData(row, row.role || role || "")
  };
  FICHAS_EXTRA_DOCUMENT_FIELDS.forEach(fieldName => {
    parsed[fieldName] = row[fieldName] || "";
  });
  for (let index = 1; index <= 4; index += 1) {
    parsed[`dependent${index}Name`] = row[`dependent${index}Name`] || "";
    parsed[`dependent${index}Relationship`] = row[`dependent${index}Relationship`] || "";
    parsed[`dependent${index}BirthDate`] = row[`dependent${index}BirthDate`] || "";
    parsed[`dependent${index}Cpf`] = row[`dependent${index}Cpf`] || "";
  }
  return parsed;
}

function getFichasMissingAdmissionLabels(row) {
  return missingUploadRequiredFields(row).map(fieldName => uploadFieldLabel(fieldName));
}

function findExistingFichasRegisterRecord(row, id) {
  const cpfDigits = normalizeDigits(row.cpf);
  if (cpfDigits) {
    const byCpf = state.collaboratorSheetWorkers.find(item => normalizeDigits(item.cpf) === cpfDigits);
    if (byCpf) return byCpf;
  }
  return state.collaboratorSheetWorkers.find(item => item.id === id || normalizeText(item.name) === normalizeText(row.name)) || null;
}

function buildFichasRegisterRecord(row, role, scaleSpec, builtAt) {
  const id = stableUploadId("sheet-worker", normalizeDigits(row.cpf) || row.name);
  const existing = findExistingFichasRegisterRecord(row, id);
  const suggestedRole = inferFichasRole(row);
  const parsed = parsedFichasRow(row, role, scaleSpec, suggestedRole);
  const admission = parsed.admission || buildFichasAdmissionData(row, role);
  const existingParsed = existing?.parsed || {};
  const mergedParsed = mergeNonEmptyDeep(existingParsed, parsed);
  const mergedAdmission = mergeNonEmptyDeep(existing?.admission || existingParsed.admission || {}, admission);
  return {
    ...(existing || {}),
    id,
    source: "planilha-colaboradores",
    scope: "rh-linked",
    name: row.name || existing?.name || "",
    normalizedName: normalizeText(row.name || existing?.name || ""),
    cpf: firstUploadValue(row.cpf, existing?.cpf),
    company: firstUploadValue(row.company, existing?.company),
    place: firstUploadValue(row.placeRaw, existing?.place),
    city: firstUploadValue(row.city, existing?.city),
    role: firstUploadValue(row.role, existing?.role),
    suggestedRole: suggestedRole && suggestedRole !== row.role ? suggestedRole : (existing?.suggestedRole || ""),
    phone: firstUploadValue(row.phone, existing?.phone),
    email: firstUploadValue(row.email, existing?.email),
    missingAdmissionFields: getFichasMissingAdmissionLabels(mergedParsed),
    warnings: row.warnings || [],
    raw: mergeNonEmptyDeep(existing?.raw || {}, row.raw || {}),
    recognizedFields: mergeNonEmptyDeep(existing?.recognizedFields || {}, row.recognizedFields || {}),
    extraFields: mergeNonEmptyDeep(existing?.extraFields || {}, row.extraFields || {}),
    parsed: {
      ...mergedParsed,
      admission: mergedAdmission
    },
    admission: mergedAdmission,
    firstImportedAt: existing?.firstImportedAt || builtAt,
    updatedAt: builtAt,
    lastSourceSheet: row.sourceSheet || "",
    lastRowNumber: row.rowNumber || 0,
    importCount: Number(existing?.importCount || 0) + 1
  };
}

function mergeFichasRegisterRecord(base, next) {
  if (!base?.id) return next;
  if (!next?.id) return base;
  const parsed = mergeNonEmptyDeep(base.parsed || {}, next.parsed || {});
  const admission = mergeNonEmptyDeep(base.admission || base.parsed?.admission || {}, next.admission || next.parsed?.admission || {});
  const warnings = [...new Set([...(base.warnings || []), ...(next.warnings || [])])];
  return {
    ...base,
    ...next,
    firstImportedAt: base.firstImportedAt || next.firstImportedAt || "",
    importCount: Number(base.importCount || 0) + 1,
    raw: mergeNonEmptyDeep(base.raw || {}, next.raw || {}),
    recognizedFields: mergeNonEmptyDeep(base.recognizedFields || {}, next.recognizedFields || {}),
    extraFields: mergeNonEmptyDeep(base.extraFields || {}, next.extraFields || {}),
    parsed: {
      ...parsed,
      admission
    },
    admission,
    warnings,
    missingAdmissionFields: getFichasMissingAdmissionLabels(parsed)
  };
}

function buildFichasImport(rows) {
  const builtAt = new Date().toISOString();
  const summary = {
    rows: rows.length,
    register: new Set()
  };
  const importRows = [];
  const registerById = new Map();
  const warnings = [];
  const columns = new Set();

  rows.forEach(row => {
    (row.columns || Object.keys(row.raw || {})).forEach(column => columns.add(column));
    const rowWarnings = [...(row.warnings || [])];
    const rowPlan = {
      sourceSheet: row.sourceSheet || "",
      rowNumber: row.rowNumber,
      raw: row.raw || {},
      recognizedFields: row.recognizedFields || {},
      extraFields: row.extraFields || {},
      parsed: {},
      warnings: rowWarnings,
      targets: []
    };

    const scaleSpec = inferFichasScale(row);
    const role = row.role || "";
    const suggestedRole = inferFichasRole(row);
    rowPlan.parsed = parsedFichasRow(row, role, scaleSpec, suggestedRole);
    rowPlan.registry = buildFichasRegisterRecord(row, role, scaleSpec, builtAt);
    rowPlan.registry = mergeFichasRegisterRecord(registerById.get(rowPlan.registry.id), rowPlan.registry);
    registerById.set(rowPlan.registry.id, rowPlan.registry);
    rowPlan.targets.push({ collectionName: "rh_collaborator_sheet_workers", id: rowPlan.registry.id });
    summary.register.add(rowPlan.registry.id);
    if (rowWarnings.length) {
      rowWarnings.forEach(message => warnings.push({
        sourceSheet: row.sourceSheet || "",
        rowNumber: row.rowNumber,
        message
      }));
    }
    importRows.push(rowPlan);
  });

  const summaryOut = Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, value instanceof Set ? value.size : value]));
  summaryOut.warningRows = importRows.filter(row => row.warnings.length).length;
  summaryOut.warnings = warnings.length;
  summaryOut.updates = summaryOut.register;
  const result = {
    queue: [],
    summary: summaryOut,
    rows: importRows,
    warnings,
    columns: [...columns]
  };
  attachFichasOperationalSync(result, { appliedAt: builtAt });
  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitUploadPath(path) {
  return String(path || "").split(".").filter(Boolean);
}

function getUploadPathValue(object, path) {
  return splitUploadPath(path).reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), object);
}

function setUploadPathValue(object, path, value) {
  const parts = splitUploadPath(path);
  if (!parts.length) return object;
  let current = object;
  parts.slice(0, -1).forEach(part => {
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) current[part] = {};
    current = current[part];
  });
  current[parts[parts.length - 1]] = value;
  return object;
}

function deleteUploadPathValue(object, path) {
  const parts = splitUploadPath(path);
  if (!parts.length) return;
  const stack = [];
  let current = object;
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== "object") return;
    stack.push([current, part]);
    current = current[part];
  }
  if (!current || typeof current !== "object") return;
  delete current[parts[parts.length - 1]];
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const [parent, part] = stack[index];
    const value = parent[part];
    if (value && typeof value === "object" && !Array.isArray(value) && !Object.values(value).some(uploadValueIsPresent)) {
      delete parent[part];
    }
  }
}

function uploadValueIsPresent(value) {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(uploadValueIsPresent);
  if (value && typeof value === "object") return Object.values(value).some(uploadValueIsPresent);
  return String(value).trim() !== "";
}

function formatUploadFieldValue(value) {
  if (typeof value === "boolean") return value ? "sim" : "nao";
  if (value === null || typeof value === "undefined") return "";
  return String(value).trim();
}

function humanizeUploadKey(key) {
  return titleCaseUpload(String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " "));
}

function uploadFieldLabel(key, options = {}) {
  const text = String(key || "");
  if (options.raw) return text || "Campo bruto";
  const parts = splitUploadPath(text);
  const last = parts[parts.length - 1] || text;
  const label = FICHAS_FIELD_LABELS[last] || FICHAS_FIELD_LABELS[text] || humanizeUploadKey(last || text);
  if (parts[0] === "admission" && parts[1]) {
    const section = FICHAS_ADMISSION_SECTION_LABELS[parts[1]] || humanizeUploadKey(parts[1]);
    return `${section} / ${label}`;
  }
  return label;
}

function flattenUploadObject(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenUploadObject(item, `${prefix}[${index + 1}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return flattenUploadObject(item, nextPrefix);
    });
  }
  return [{ key: prefix, value }];
}

function uploadRequiredFieldsForRecord(record = {}) {
  const parsed = record.parsed || record || {};
  const required = new Set(FICHAS_REQUIRED_ADMISSION_FIELDS.map(([fieldName]) => fieldName));
  const role = normalizeText(parsed.role || record.role || "");
  if (role.includes("vigilante") || role.includes("seguranca")) {
    ["cnv", "courseCertificate", "healthCertificate", "criminalRecord"].forEach(fieldName => required.add(fieldName));
  }
  return [...required];
}

function missingUploadRequiredFields(record = {}) {
  const parsed = record.parsed || record || {};
  return uploadRequiredFieldsForRecord(record).filter(fieldName => !uploadValueIsPresent(getUploadPathValue(parsed, fieldName)));
}

function hiddenUploadFieldOptions(parsed = {}) {
  const fields = [...new Set([...FICHAS_FIELD_MATCH_ORDER, ...FICHAS_EXTRA_DOCUMENT_FIELDS])];
  return fields.filter(fieldName => !uploadValueIsPresent(getUploadPathValue(parsed, fieldName)));
}

function visibleFichasParsedFields(parsed = {}) {
  const { admission, ...visible } = parsed || {};
  return visible;
}

function uploadDataAttrs(options = {}, path = "") {
  const attrs = [
    `data-sheet-mode="${escapeHtml(options.mode || "")}"`,
    `data-sheet-group="${escapeHtml(options.group || "parsed")}"`,
    `data-sheet-path="${escapeHtml(path)}"`
  ];
  if (typeof options.rowIndex !== "undefined") attrs.push(`data-sheet-row-index="${escapeHtml(options.rowIndex)}"`);
  if (options.recordId) attrs.push(`data-sheet-record-id="${escapeHtml(options.recordId)}"`);
  return attrs.join(" ");
}

function renderUploadPairs(object, options = {}) {
  const normalizedOptions = typeof options === "boolean" ? { includeEmpty: options } : options;
  const includeEmpty = normalizedOptions.includeEmpty === true;
  const editable = normalizedOptions.editable === true;
  const rawLabels = normalizedOptions.rawLabels === true;
  const entries = flattenUploadObject(object || {}).filter(item => item.key && (includeEmpty || uploadValueIsPresent(item.value)));
  if (!entries.length) return `<span class="muted">Sem campos.</span>`;
  return entries.map(({ key, value }) => `
    <div class="upload-field${editable ? " editable" : ""}">
      <label class="upload-field-label">
        <span title="${escapeHtml(key)}">${escapeHtml(uploadFieldLabel(key, { raw: rawLabels }))}</span>
        ${editable
          ? `<input type="text" ${uploadDataAttrs(normalizedOptions, key)} data-sheet-edit-field value="${escapeHtml(formatUploadFieldValue(value))}">`
          : `<strong>${escapeHtml(formatUploadFieldValue(value) || "vazio")}</strong>`}
      </label>
      ${editable ? `<button type="button" class="upload-field-remove" ${uploadDataAttrs(normalizedOptions, key)} data-sheet-remove-field>Remover</button>` : ""}
    </div>
  `).join("");
}

function renderUploadMissingFields(record, options = {}) {
  const missingFields = missingUploadRequiredFields(record);
  if (!missingFields.length) return "";
  return `
    <div class="upload-warning-line compact">
      ${missingFields.map(fieldName => `
        <span>${escapeHtml(uploadFieldLabel(fieldName))} pendente
          ${options.editable ? `<button type="button" ${uploadDataAttrs({ ...options, group: "parsed" }, fieldName)} data-sheet-add-missing>Adicionar</button>` : ""}
        </span>
      `).join("")}
    </div>
  `;
}

function renderUploadFieldAdder(parsed = {}, options = {}) {
  if (!options.editable) return "";
  const fieldOptions = hiddenUploadFieldOptions(parsed);
  if (!fieldOptions.length) return "";
  return `
    <details class="upload-field-adder">
      <summary>Adicionar campo</summary>
      <div class="upload-add-row">
        <select ${uploadDataAttrs({ ...options, group: "parsed" })} data-sheet-add-select>
          ${fieldOptions.map(fieldName => `<option value="${escapeHtml(fieldName)}">${escapeHtml(uploadFieldLabel(fieldName))}</option>`).join("")}
        </select>
        <input type="text" placeholder="Valor" ${uploadDataAttrs({ ...options, group: "parsed" })} data-sheet-add-value>
        <button type="button" ${uploadDataAttrs({ ...options, group: "parsed" })} data-sheet-add-field>Adicionar</button>
      </div>
    </details>
  `;
}

function renderUploadTargets(targets) {
  if (!targets?.length) return `<span class="muted">Nenhum destino gerado.</span>`;
  return targets.map(target => `<span class="upload-target">${escapeHtml(target.collectionName)}/${escapeHtml(target.id)}</span>`).join("");
}

function visibleUploadWarnings(warnings = []) {
  return warnings.filter(message => !normalizeText(message).startsWith("dados admissionais pendentes"));
}

function showUploadToast(message, kind = "info") {
  const toast = document.createElement("div");
  toast.className = `upload-toast ${kind}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("closing");
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

function renderFichasUploadPreview(result) {
  if (!el.fichasUploadPreview) return;
  const visibleWarnings = visibleUploadWarnings(result.warnings || []);
  const visibleWarningLimit = 12;
  const warningHtml = visibleWarnings.length ? `
    <div class="upload-warning-panel">
      ${visibleWarnings.slice(0, visibleWarningLimit).map(item => `
        <span class="upload-warning-chip">${escapeHtml(item.sourceSheet || "Planilha")} linha ${escapeHtml(item.rowNumber)}: ${escapeHtml(item.message)}</span>
      `).join("")}
      ${visibleWarnings.length > visibleWarningLimit ? `
        <details>
          <summary>Ver mais ${visibleWarnings.length - visibleWarningLimit} alerta(s)</summary>
          <div class="upload-warning-panel nested">
            ${visibleWarnings.slice(visibleWarningLimit).map(item => `
              <span class="upload-warning-chip">${escapeHtml(item.sourceSheet || "Planilha")} linha ${escapeHtml(item.rowNumber)}: ${escapeHtml(item.message)}</span>
            `).join("")}
          </div>
        </details>
      ` : ""}
    </div>
  ` : "";

  el.fichasUploadPreview.innerHTML = `
    <div class="dashboard-summary">
      <article class="summary-box"><span class="muted">Linhas lidas</span><strong>${result.summary.rows}</strong></article>
      <article class="summary-box"><span class="muted">Registros nesta pagina</span><strong>${result.summary.register}</strong></article>
      <article class="summary-box"><span class="muted">Vinculos RH</span><strong>${result.summary.rhLinkedRecords || 0}</strong></article>
      <article class="summary-box"><span class="muted">Escalas no painel</span><strong>${result.summary.linkedEntries || 0}</strong></article>
      <article class="summary-box"><span class="muted">Colunas lidas</span><strong>${result.columns.length}</strong></article>
      <article class="summary-box"><span class="muted">Alertas</span><strong>${result.summary.warnings}</strong></article>
    </div>
    ${warningHtml}
    <div class="upload-preview-list full-parse">
      ${result.rows.map((row, index) => {
        const rowWarnings = visibleUploadWarnings(row.warnings || []);
        return `
        <article class="upload-row-card${rowWarnings.length || missingUploadRequiredFields(row.registry || row.parsed).length ? " has-warning" : ""}">
          <div class="upload-row-head">
            <div>
              <strong>${escapeHtml(row.parsed.name || "Sem nome")}</strong>
              <span>${escapeHtml(row.sourceSheet || "Planilha")} linha ${escapeHtml(row.rowNumber)} | ${escapeHtml(row.parsed.place || "Sem local")} | ${escapeHtml(row.parsed.role || "Sem funcao")}</span>
            </div>
            <span class="upload-row-count">${row.targets.length} registro(s)</span>
          </div>
          ${rowWarnings.length ? `<div class="upload-warning-line">${rowWarnings.map(message => `<span>${escapeHtml(message)}</span>`).join("")}</div>` : ""}
          ${renderUploadMissingFields(row.registry || row.parsed, { editable: true, mode: "preview", rowIndex: index, group: "parsed" })}
          <details open>
            <summary>Campos preenchidos da planilha</summary>
            <div class="upload-field-grid">${renderUploadPairs(visibleFichasParsedFields(row.parsed), { editable: true, mode: "preview", rowIndex: index, group: "parsed" })}</div>
          </details>
          ${renderUploadFieldAdder(row.parsed, { editable: true, mode: "preview", rowIndex: index, group: "parsed" })}
          <details>
            <summary>Campos brutos (${Object.keys(row.raw || {}).length})</summary>
            <div class="upload-field-grid raw">${renderUploadPairs(row.raw, { editable: true, mode: "preview", rowIndex: index, group: "raw", rawLabels: true })}</div>
          </details>
          <details>
            <summary>Onde sera salvo</summary>
            <div class="upload-target-list">${renderUploadTargets(row.targets)}</div>
          </details>
        </article>
      `; }).join("")}
    </div>
  `;
}

function renderFichasRegister() {
  if (!el.fichasRegisterSummary || !el.fichasRegisterList) return;
  const records = [...(state.collaboratorSheetWorkers || [])].sort((a, b) => {
    const byDate = String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    return byDate || String(a.name || "").localeCompare(String(b.name || ""));
  });
  const alertCount = records.filter(record => visibleUploadWarnings(record.warnings || []).length || missingUploadRequiredFields(record).length).length;
  const columnCount = new Set(records.flatMap(record => Object.keys(record.raw || {}))).size;
  const linkedCount = records.filter(record => (record.linkedTargets || []).length || record.linkedWorkerId || record.linkedProfileId).length;
  el.fichasRegisterSummary.innerHTML = `
    <article class="summary-box"><span class="muted">Cadastro da planilha</span><strong>${records.length}</strong></article>
    <article class="summary-box"><span class="muted">Vinculados ao RH</span><strong>${linkedCount}</strong></article>
    <article class="summary-box"><span class="muted">Com campos pendentes</span><strong>${alertCount}</strong></article>
    <article class="summary-box"><span class="muted">Colunas guardadas</span><strong>${columnCount}</strong></article>
  `;
  if (!records.length) {
    el.fichasRegisterList.innerHTML = `<div class="row"><span class="muted">Nenhum colaborador aplicado nesta planilha ainda.</span></div>`;
    return;
  }
  el.fichasRegisterList.innerHTML = records.map(record => {
    const parsed = record.parsed || {};
    const missingFields = missingUploadRequiredFields(record);
    const warnings = visibleUploadWarnings(record.warnings || []);
    return `
      <article class="upload-row-card${warnings.length || missingFields.length ? " has-warning" : ""}">
        <div class="upload-row-head">
          <div>
            <strong>${escapeHtml(record.name || parsed.name || "Sem nome")}</strong>
            <span>${escapeHtml(record.company || parsed.company || "Sem empresa")} | ${escapeHtml(record.place || parsed.place || "Sem local")} | ${escapeHtml(record.role || parsed.role || "Sem funcao")}</span>
          </div>
          <span class="upload-row-count">${escapeHtml(record.updatedAt ? record.updatedAt.slice(0, 10) : "sem data")}</span>
        </div>
        ${warnings.length ? `<div class="upload-warning-line">${warnings.map(message => `<span>${escapeHtml(message)}</span>`).join("")}</div>` : ""}
        ${renderUploadMissingFields(record, { editable: true, mode: "register", recordId: record.id, group: "parsed" })}
        <details open>
          <summary>Campos preenchidos salvos</summary>
          <div class="upload-field-grid">${renderUploadPairs(visibleFichasParsedFields(parsed), { editable: true, mode: "register", recordId: record.id, group: "parsed" })}</div>
        </details>
        ${renderUploadFieldAdder(parsed, { editable: true, mode: "register", recordId: record.id, group: "parsed" })}
        <details>
          <summary>Campos brutos (${Object.keys(record.raw || {}).length})</summary>
          <div class="upload-field-grid raw">${renderUploadPairs(record.raw || {}, { editable: true, mode: "register", recordId: record.id, group: "raw", rawLabels: true })}</div>
        </details>
        <details>
          <summary>Vinculos RH</summary>
          <div class="upload-target-list">${renderUploadTargets(record.linkedTargets || [])}</div>
        </details>
      </article>
    `;
  }).join("");
}

function mergeAppliedFichasRegister(result, appliedAt, importId, fileName) {
  const byId = new Map((state.collaboratorSheetWorkers || []).map(record => [record.id, record]));
  (result.rows || []).forEach(row => {
    if (!row.registry?.id) return;
    const existing = byId.get(row.registry.id) || {};
    const merged = mergeFichasRegisterRecord(existing, row.registry);
    byId.set(row.registry.id, {
      ...merged,
      lastImportId: importId,
      lastFileName: fileName,
      updatedAt: appliedAt,
      appliedAt,
      uploadedBy: state.currentUser?.email || ""
    });
  });
  state.collaboratorSheetWorkers = [...byId.values()];
  renderFichasRegister();
}

function syncFichasRecordFromParsed(record = {}) {
  record.parsed = record.parsed || {};
  const parsed = record.parsed;
  parsed.admission = buildFichasAdmissionData(parsed, parsed.role || record.role || "");
  record.name = parsed.name || "";
  record.normalizedName = normalizeText(record.name);
  record.cpf = parsed.cpf || "";
  record.company = parsed.company || "";
  record.place = parsed.place || "";
  record.city = parsed.city || "";
  record.role = parsed.role || "";
  record.suggestedRole = parsed.suggestedRole || "";
  record.phone = parsed.phone || "";
  record.email = parsed.email || "";
  record.admission = parsed.admission;
  record.missingAdmissionFields = getFichasMissingAdmissionLabels(record);
  return record;
}

function syncFichasPreviewRow(rowPlan = {}) {
  rowPlan.parsed = rowPlan.parsed || {};
  rowPlan.raw = rowPlan.raw || {};
  const warningSource = {
    ...rowPlan.parsed,
    placeRaw: rowPlan.parsed.place || "",
    scaleRaw: rowPlan.parsed.scale || "",
    periodRaw: rowPlan.parsed.period || ""
  };
  rowPlan.warnings = buildUploadWarnings(warningSource);
  rowPlan.registry = {
    ...(rowPlan.registry || {}),
    raw: rowPlan.raw,
    recognizedFields: rowPlan.recognizedFields || {},
    extraFields: rowPlan.extraFields || {},
    parsed: rowPlan.parsed,
    warnings: rowPlan.warnings,
    lastSourceSheet: rowPlan.sourceSheet || "",
    lastRowNumber: rowPlan.rowNumber || 0
  };
  syncFichasRecordFromParsed(rowPlan.registry);
  rowPlan.targets = rowPlan.registry.id ? [{ collectionName: "rh_collaborator_sheet_workers", id: rowPlan.registry.id }] : [];
  return rowPlan;
}

function refreshFichasImportSummary(result = {}) {
  const warnings = [];
  (result.rows || []).forEach(row => {
    (row.warnings || []).forEach(message => warnings.push({
      sourceSheet: row.sourceSheet || "",
      rowNumber: row.rowNumber,
      message
    }));
  });
  const operationalSummary = result.operationalSync?.summary || {};
  result.warnings = warnings;
  result.summary = {
    ...(result.summary || {}),
    rows: (result.rows || []).length,
    register: new Set((result.rows || []).map(row => row.registry?.id).filter(Boolean)).size,
    warningRows: (result.rows || []).filter(row => (row.warnings || []).length).length,
    warnings: warnings.length,
    updates: new Set((result.rows || []).map(row => row.registry?.id).filter(Boolean)).size,
    ...operationalSummary
  };
  return result;
}

function setFichasObjectField(object, group, path, value) {
  if (!object || !path) return;
  const text = String(value ?? "").trim();
  if (group === "raw") {
    if (text) object.raw = { ...(object.raw || {}), [path]: text };
    else if (object.raw) delete object.raw[path];
    return;
  }
  object.parsed = object.parsed || {};
  if (text) setUploadPathValue(object.parsed, path, text);
  else deleteUploadPathValue(object.parsed, path);
}

function updateFichasPreviewField(dataset, value) {
  const pending = state.pendingFichasImport;
  const rowIndex = Number(dataset.sheetRowIndex);
  const rowPlan = pending?.result?.rows?.[rowIndex];
  if (!rowPlan) return;
  setFichasObjectField(rowPlan, dataset.sheetGroup || "parsed", dataset.sheetPath || "", value);
  syncFichasPreviewRow(rowPlan);
  attachFichasOperationalSync(pending.result, {
    fileName: pending.fileName,
    mode: pending.mode,
    parsedAt: pending.parsedAt
  });
  refreshFichasImportSummary(pending.result);
  renderFichasUploadPreview(pending.result);
}

async function saveFichasRegisterRecord(record, message = "Planilha colaboradores salva.") {
  if (!record?.id) return;
  syncFichasRecordFromParsed(record);
  record.updatedAt = new Date().toISOString();
  record.editedAt = record.updatedAt;
  record.editedBy = state.currentUser?.email || "";
  const syncResult = attachFichasOperationalSync({
    rows: [{
      registry: record,
      parsed: record.parsed || {},
      sourceSheet: record.lastSourceSheet || "",
      rowNumber: record.lastRowNumber || 0,
      raw: record.raw || {},
      recognizedFields: record.recognizedFields || {},
      extraFields: record.extraFields || {},
      warnings: record.warnings || []
    }]
  }, {
    importId: record.lastImportId || "",
    fileName: record.lastFileName || "",
    appliedAt: record.updatedAt
  });
  record.linkedTargets = syncResult.rows[0]?.registry?.linkedTargets || record.linkedTargets || [];
  setStatus("Salvando planilha...");
  await commitFichasWrites(async ({ addEntitySet }) => {
    await addEntitySet("rh_collaborator_sheet_workers", record, { merge: true });
    await persistFichasOperationalUpserts(syncResult.operationalSync, addEntitySet);
  });
  setStatus("Sincronizado");
  showUploadToast(`${message} Vinculos RH atualizados.`, "success");
}

async function updateFichasRegisterField(dataset, value) {
  const record = state.collaboratorSheetWorkers.find(item => item.id === dataset.sheetRecordId);
  if (!record) return;
  setFichasObjectField(record, dataset.sheetGroup || "parsed", dataset.sheetPath || "", value);
  await saveFichasRegisterRecord(record);
  renderFichasRegister();
}

function readFichasAddField(container) {
  const select = container?.querySelector("[data-sheet-add-select]");
  const input = container?.querySelector("[data-sheet-add-value]");
  return {
    path: select?.value || "",
    value: input?.value || "",
    dataset: select?.dataset || input?.dataset || {}
  };
}

function promptFichasMissingFieldValue(button) {
  const label = uploadFieldLabel(button.dataset.sheetPath || "");
  return window.prompt(`Valor para ${label}:`, "") || "";
}

async function handleFichasFieldChange(target) {
  const dataset = target.dataset || {};
  const value = target.value || "";
  if (dataset.sheetMode === "preview") {
    updateFichasPreviewField(dataset, value);
    return;
  }
  if (dataset.sheetMode === "register") {
    await updateFichasRegisterField(dataset, value);
  }
}

async function handleFichasFieldRemove(button) {
  const dataset = button.dataset || {};
  if (!window.confirm("Remover este campo da Planilha colaboradores?")) return;
  if (dataset.sheetMode === "preview") {
    updateFichasPreviewField(dataset, "");
    return;
  }
  if (dataset.sheetMode === "register") {
    await updateFichasRegisterField(dataset, "");
  }
}

async function handleFichasFieldAdd(button) {
  const container = button.closest(".upload-add-row");
  const add = readFichasAddField(container);
  if (!add.path) return;
  if (!String(add.value || "").trim()) {
    showUploadToast("Informe um valor para adicionar o campo.", "warning");
    return;
  }
  const dataset = { ...add.dataset, sheetPath: add.path, sheetGroup: "parsed" };
  if (dataset.sheetMode === "preview") {
    updateFichasPreviewField(dataset, add.value);
    return;
  }
  if (dataset.sheetMode === "register") {
    await updateFichasRegisterField(dataset, add.value);
  }
}

async function handleFichasMissingAdd(button) {
  const value = promptFichasMissingFieldValue(button);
  if (!String(value || "").trim()) return;
  const dataset = { ...button.dataset, sheetGroup: "parsed" };
  if (dataset.sheetMode === "preview") {
    updateFichasPreviewField(dataset, value);
    return;
  }
  if (dataset.sheetMode === "register") {
    await updateFichasRegisterField(dataset, value);
  }
}

async function importFichasFile(event) {
  event.preventDefault();
  const file = el.fichasUploadFile?.files?.[0];
  if (!file) {
    alert("Selecione o arquivo de RH.");
    return;
  }

  try {
    setStatus("Lendo planilha...");
    state.pendingFichasImport = null;
    el.fichasUploadRunBtn.disabled = true;
    if (el.fichasUploadApplyBtn) el.fichasUploadApplyBtn.disabled = true;
    el.fichasUploadStatus.textContent = "Lendo arquivo e montando previa completa...";
    const rows = await readFichasFile(file);
    if (!rows.length) {
      el.fichasUploadStatus.textContent = "Nenhum colaborador reconhecido. Verifique se o arquivo tem nome do colaborador e campos RH legiveis.";
      if (el.fichasUploadPreview) el.fichasUploadPreview.innerHTML = "";
      return;
    }
    const result = buildFichasImport(rows);
    renderFichasUploadPreview(result);
    state.pendingFichasImport = {
      fileName: file.name,
      mode: el.fichasUploadMode?.value || "merge",
      parsedAt: new Date().toISOString(),
      result
    };
    if (el.fichasUploadApplyBtn) el.fichasUploadApplyBtn.disabled = false;
    setStatus("Previa pronta");
    el.fichasUploadStatus.textContent = `Previa pronta: ${result.summary.rows} linha(s), ${result.summary.register} registro(s) no arquivo e ${result.summary.rhLinkedRecords || 0} vinculo(s) para Painel RH, funcionarios, cargos, escalas e documentacao.`;
    if (result.summary.warnings) showUploadToast(`${result.summary.warnings} alerta(s) encontrados. A importacao continua liberada.`, "warning");
  } catch (error) {
    console.error(error);
    setStatus("Erro na leitura");
    el.fichasUploadStatus.textContent = `Falha na leitura: ${error.message || error}`;
  } finally {
    el.fichasUploadRunBtn.disabled = false;
  }
}

async function applyFichasImport() {
  const pending = state.pendingFichasImport;
  if (!pending?.result) {
    showUploadToast("Leia um arquivo antes de aplicar.", "warning");
    return;
  }

  try {
    setStatus("Aplicando planilha...");
    if (el.fichasUploadRunBtn) el.fichasUploadRunBtn.disabled = true;
    if (el.fichasUploadApplyBtn) el.fichasUploadApplyBtn.disabled = true;
    const appliedAt = new Date().toISOString();
    const importId = stableUploadId("collaborator-sheet", `${pending.fileName}-${pending.parsedAt}-${appliedAt}`);
    attachFichasOperationalSync(pending.result, {
      fileName: pending.fileName,
      mode: pending.mode,
      parsedAt: pending.parsedAt,
      appliedAt,
      importId
    });
    refreshFichasImportSummary(pending.result);
    el.fichasUploadStatus.textContent = `Salvando ${pending.result.summary.register} colaborador(es) e ${pending.result.summary.rhLinkedRecords || 0} vinculo(s) no RH...`;
    await persistFichasParsedRows(importId, pending.result, {
      fileName: pending.fileName,
      mode: pending.mode,
      parsedAt: pending.parsedAt,
      appliedAt
    });
    mergeAppliedFichasRegister(pending.result, appliedAt, importId, pending.fileName);
    setStatus("Sincronizado");
    el.fichasUploadStatus.textContent = `Importacao aplicada: ${pending.result.summary.register} colaborador(es) no arquivo e ${pending.result.summary.rhLinkedRecords || 0} vinculo(s) atualizados no Painel RH, Funcionarios, Escala/Funcionario, Funcoes, Documentacao e FT quando houver data/FT.`;
    state.pendingFichasImport = null;
    showUploadToast("Arquivo aplicado e vinculado ao RH.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Erro no upload");
    el.fichasUploadStatus.textContent = `Falha ao aplicar: ${error.message || error}`;
    showUploadToast(`Falha ao salvar: ${error.message || error}`, "error");
    if (el.fichasUploadApplyBtn) el.fichasUploadApplyBtn.disabled = false;
  } finally {
    if (el.fichasUploadRunBtn) el.fichasUploadRunBtn.disabled = false;
  }
}

function resetDocumentationForm() {
  state.currentDocId = "";
  fillDocumentationForm(blankDocumentation());
  renderDocumentationFiles(blankDocumentation());
  el.docUploadHint.textContent = "Crie ou selecione um dossie para anexar documentos.";
}

function passGate(email) {
  state.currentUser = { email };
  sessionStorage.setItem("rh_gate_email", email);
  localStorage.setItem("rh_gate_email", email);
  showApp();
  updateRhPermissions();
  applySeedFallback("seed");
  setStatus("Conectando...");
  connectRealtime().catch(error => {
    el.loginError.textContent = error.message;
    applySeedFallback("firestore-error");
    setStatus("Falha ao conectar");
  });
}

function readPortalUser() {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

el.loginForm.onsubmit = async event => {
  event.preventDefault();
  el.loginError.textContent = "";
  const gate = window.RH_GATE || {};
  const email = el.loginUser.value.trim().toLowerCase();
  const password = el.loginPass.value;
  const gateEntry = gate.users?.[email];
  if (!gateEntry || !(await verifyGatePassword(gateEntry, password))) {
    el.loginError.textContent = "E-mail ou senha invalidos.";
    setStatus("Falha no login");
    return;
  }
  passGate(email);
};

el.logoutBtn.onclick = async () => {
  state.currentUser = null;
  state.auditLogs = [];
  sessionStorage.removeItem("rh_gate_email");
  localStorage.removeItem("rh_gate_email");
  subscriptions.splice(0).forEach(unsub => unsub());
  showLogin();
  setStatus("Aguardando acesso");
};

el.placeForm.onsubmit = async event => {
  event.preventDefault();
  const placeId = state.editingPlaceId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const existingPlace = state.places.find(place => place.id === placeId);
  await setEntity("places", {
    id: placeId,
    name: el.placeName.value.trim(),
    city: el.placeCity.value.trim(),
    aliases: existingPlace?.aliases || existingPlace?.placeAliases || []
  });
  resetPlaceForm();
};
el.placeCancelBtn.onclick = () => resetPlaceForm();

el.workerForm.onsubmit = async event => {
  event.preventDefault();
  const workerId = state.editingWorkerId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const name = el.workerName.value.trim();
  const placeId = el.workerPlaceId.value;
  const cargo = el.workerRole.value.trim();
  if (!name || !placeId || !cargo) {
    alert("Preencha nome, local validado e funcao.");
    return;
  }
  const existingProfile = getWorkerProfile(workerId);
  await setEntity("workers", { id: workerId, name });
  await upsertWorkerProfile(workerId, placeId, cargo, existingProfile?.scaleId || "", getSuggestedFtValue(cargo, existingProfile?.precoFt || 0));
  resetWorkerForm();
};

el.workerCancelBtn.onclick = () => resetWorkerForm();

el.jobFunctionForm.onsubmit = async event => {
  event.preventDefault();
  const name = el.jobFunctionName.value.trim();
  const value = Number(el.jobFunctionValue.value);
  if (!name) {
    alert("Informe o nome da funcao.");
    return;
  }
  await setEntity("job_functions", {
    id: state.editingJobFunctionId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    value
  });
  resetJobFunctionForm();
};

el.jobFunctionCancelBtn.onclick = () => resetJobFunctionForm();

el.scaleForm.onsubmit = async event => {
  event.preventDefault();
  const scaleId = state.editingScaleId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  await setEntity("scales", { id: scaleId, name: el.scaleName.value.trim(), pattern: el.scalePattern.value.trim() });
  resetScaleForm();
};
el.scaleCancelBtn.onclick = () => resetScaleForm();

el.profileForm.onsubmit = async event => {
  event.preventDefault();
  const workerId = el.profileWorkerId.value;
  const placeId = el.profilePlaceId.value;
  const scaleId = el.profileScaleId.value;
  const cargo = el.profileCargo.value.trim();
  const precoFt = Number(el.profilePrecoFt.value);
  if (!workerId || !placeId || !scaleId || !cargo) {
    alert("Preencha todos os campos obrigatorios.");
    return;
  }
  const existing = state.workerProfiles.find(p => p.id === state.editingProfileId) || state.workerProfiles.find(p => p.workerId === workerId);
  const id = existing ? existing.id : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  await setEntity("worker_profiles", { id, workerId, placeId, scaleId, cargo, precoFt });
  resetProfileForm();
};
el.profileCancelBtn.onclick = () => resetProfileForm();
el.profileSearch.oninput = renderWorkerProfiles;
el.profileSort.onchange = renderWorkerProfiles;

el.ftForm.onsubmit = async event => {
  event.preventDefault();
  const selectedDates = [...state.ftSelectedDates].sort();
  const batchCount = Math.max(1, Number(el.ftDays.value || 1));
  const datesToSave = selectedDates.length ? selectedDates : buildConsecutiveDates(el.ftDate.value, batchCount);
  const selectedWorkerId = el.ftWorkerId.value;
  const resolvedRole = el.ftRole.value.trim();
  const resolvedValue = el.ftValue.value ? Number(el.ftValue.value) : Number(getSuggestedFtValue(resolvedRole, 0) || 0);
  for (const date of datesToSave) {
    const ftId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    await setEntity("ft_entries", {
      id: ftId,
      workerId: selectedWorkerId || "",
      name: el.ftName.value.trim(),
      placeId: el.ftPlaceId.value,
      date,
      startTime: el.ftStartTime.value,
      hours: Number(el.ftHours.value),
      value: resolvedValue,
      role: resolvedRole
    });
    if (selectedWorkerId) {
      const existingEntry = state.entries.find(item =>
        item.date === date &&
        item.placeId === el.ftPlaceId.value &&
        item.workerId === selectedWorkerId
      );
      await setEntity("entries", {
        id: existingEntry?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        date,
        placeId: el.ftPlaceId.value,
        workerId: selectedWorkerId,
        type: "Folga Trabalhada",
        scaleId: getWorkerProfile(selectedWorkerId)?.scaleId || "",
        ftEntryId: ftId
      }, false);
    }
  }
  el.ftForm.reset();
  el.ftDate.value = today;
  el.ftDays.value = "1";
  el.ftStartTime.value = "08:00";
  state.ftSelectedDates.clear();
  renderFtCalendar();
  renderFtList();
};

el.ftWorkerId.onchange = () => {
  const workerId = el.ftWorkerId.value;
  if (!workerId) return;
  const profile = getWorkerProfile(workerId);
  const worker = state.workers.find(w => w.id === workerId);
  if (worker) el.ftName.value = worker.name;
  if (profile?.placeId) el.ftPlaceId.value = profile.placeId;
  if (profile) {
    el.ftValue.value = getProfileFtValue(profile) || "";
    el.ftRole.value = profile.cargo || "";
  }
};

el.profileCargo.oninput = () => syncProfileFtValueFromRole();
el.profileCargo.onchange = () => syncProfileFtValueFromRole(true);
el.ftRole.oninput = () => syncFtValueFromRole();
el.ftRole.onchange = () => syncFtValueFromRole(true);
el.docWorkerId.onchange = () => {
  const workerId = el.docWorkerId.value;
  const worker = state.workers.find(item => item.id === workerId);
  const profile = getWorkerProfile(workerId);
  if (worker) el.docFullName.value = worker.name || "";
  if (profile?.cargo) el.docRole.value = profile.cargo;
};

el.dashDate.onchange = renderDashboard;
el.placeSearch.oninput = renderDashboard;
el.dashSort.onchange = renderDashboard;
el.placeSort.onchange = renderAll;
el.workerSort.onchange = renderAll;
el.scaleSort.onchange = renderAll;
el.exportBtn.onclick = exportPdf;
el.ftCalendarPrev.onclick = () => {
  state.ftCalendarMonth = new Date(state.ftCalendarMonth.getFullYear(), state.ftCalendarMonth.getMonth() - 1, 1);
  renderFtCalendar();
};
el.ftCalendarNext.onclick = () => {
  state.ftCalendarMonth = new Date(state.ftCalendarMonth.getFullYear(), state.ftCalendarMonth.getMonth() + 1, 1);
  renderFtCalendar();
};
el.ftSelectedClear.onclick = () => clearFtSelection();
el.ftFilterName.oninput = renderFtList;
el.ftFilterPlace.oninput = renderFtList;
el.ftFilterDate.oninput = renderFtList;
el.ftFilterRole.oninput = renderFtList;
el.docForm.onsubmit = async event => {
  event.preventDefault();
  await saveDocumentationRecord();
};
el.docUploadForm.onsubmit = async event => {
  event.preventDefault();
  await uploadDocumentationFiles();
};
el.docNewBtn.onclick = resetDocumentationForm;
const docDownloadBtn = document.getElementById("docDownloadBtn");
if (docDownloadBtn) {
  docDownloadBtn.onclick = () => {
    downloadDocumentationFiles().catch(err => {
      console.error(err);
      el.docUploadHint.textContent = "Falha ao baixar a documentacao.";
    });
  };
}
el.docCompanyFilter.onchange = renderDocumentationList;
el.docSearch.oninput = renderDocumentationList;
if (el.fichasUploadOpenBtn) el.fichasUploadOpenBtn.onclick = openFichasUpload;
if (el.fichasUploadCloseBtn) el.fichasUploadCloseBtn.onclick = closeFichasUpload;
if (el.fichasUploadModal) {
  el.fichasUploadModal.onclick = event => {
    if (event.target === el.fichasUploadModal) closeFichasUpload();
  };
}
if (el.fichasUploadForm) el.fichasUploadForm.onsubmit = importFichasFile;
if (el.fichasUploadApplyBtn) el.fichasUploadApplyBtn.onclick = applyFichasImport;
if (el.fichasUploadPreview) {
  el.fichasUploadPreview.addEventListener("change", event => {
    const field = event.target.closest("[data-sheet-edit-field]");
    if (!field) return;
    handleFichasFieldChange(field).catch(error => {
      console.error(error);
      showUploadToast(`Falha ao editar previa: ${error.message || error}`, "error");
    });
  });
  el.fichasUploadPreview.addEventListener("click", event => {
    const removeButton = event.target.closest("[data-sheet-remove-field]");
    const addButton = event.target.closest("[data-sheet-add-field]");
    const missingButton = event.target.closest("[data-sheet-add-missing]");
    const action = removeButton
      ? handleFichasFieldRemove(removeButton)
      : addButton
        ? handleFichasFieldAdd(addButton)
        : missingButton
          ? handleFichasMissingAdd(missingButton)
          : null;
    if (action) {
      action.catch(error => {
        console.error(error);
        showUploadToast(`Falha ao atualizar previa: ${error.message || error}`, "error");
      });
    }
  });
}
if (el.fichasRegisterList) {
  el.fichasRegisterList.addEventListener("change", event => {
    const field = event.target.closest("[data-sheet-edit-field]");
    if (!field) return;
    handleFichasFieldChange(field).catch(error => {
      console.error(error);
      setStatus("Erro ao salvar");
      showUploadToast(`Falha ao salvar: ${error.message || error}`, "error");
    });
  });
  el.fichasRegisterList.addEventListener("click", event => {
    const removeButton = event.target.closest("[data-sheet-remove-field]");
    const addButton = event.target.closest("[data-sheet-add-field]");
    const missingButton = event.target.closest("[data-sheet-add-missing]");
    const action = removeButton
      ? handleFichasFieldRemove(removeButton)
      : addButton
        ? handleFichasFieldAdd(addButton)
        : missingButton
          ? handleFichasMissingAdd(missingButton)
          : null;
    if (action) {
      action.catch(error => {
        console.error(error);
        setStatus("Erro ao salvar");
        showUploadToast(`Falha ao salvar: ${error.message || error}`, "error");
      });
    }
  });
}

document.querySelectorAll(".tab-btn[data-tab]").forEach(button => {
  button.onclick = () => {
    setActiveTab(button.dataset.tab);
  };
});

function requestedTab() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("tab") || window.location.hash.replace(/^#/, "");
  const knownTabs = new Set(["dashboard", "clientes", "funcionarios", "planilha-colaboradores", "funcoes", "documentacao", "escalas", "perfil", "ft", "logs"]);
  return knownTabs.has(requested) ? requested : "dashboard";
}

if (!firebaseClients) {
  applyTheme(localStorage.getItem(PORTAL_THEME_KEY) || "light");
  configureEntryMode();
  renderFtCalendar();
  showLogin();
} else {
  applyTheme(localStorage.getItem(PORTAL_THEME_KEY) || "light");
  configureEntryMode();
  setActiveTab(requestedTab());
  renderFtCalendar();
  const portalUser = readPortalUser();
  if (portalUser && (portalUser.permissions?.rh || portalUser.permissions?.admin)) {
    passGate(portalUser.email);
  } else {
    const persistedEmail = sessionStorage.getItem("rh_gate_email") || localStorage.getItem("rh_gate_email");
    const gate = window.RH_GATE || {};
    if (persistedEmail && gate.users?.[persistedEmail]) {
      passGate(persistedEmail);
    } else {
      showLogin();
      setStatus("Aguardando acesso");
    }
  }

  resetDocumentationForm();
}

el.themeToggleBtn.onclick = () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
};

el.homeLink.onclick = event => {
  event.preventDefault();
  window.location.assign(`${window.location.origin}/?tab=systems`);
};
