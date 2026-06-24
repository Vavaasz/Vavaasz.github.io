(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var REPORTS_COLLECTION = "monitoring_shift_reports";
  var SYSTEM_COLLECTION = "system";
  var OPERATORS_DOC = "shiftReportOperators";
  var SHARED_CATALOG_DOC = "shiftReportSharedCatalog";
  var FIRESTORE_READ_BACKOFF_KEY = "tka_plantao_firestore_read_backoff_until";
  var FIRESTORE_QUOTA_BACKOFF_MS = 15 * 60 * 1000;
  var STATUS_OPTIONS = ["Operante", "Em Falha"];
  var MANAGER_EMAILS = new Set(["comercial@grupotka.com.br", "comercial@grupotka", "admin@grupotka.com.br", "admin@grupotka"]);
  var MANAGER_SECTORS = new Set(["admin", "comercial"]);
  var currentPortalUser = null;
  var sharedCatalog = { rondaEntries: [], ztraxEntries: [] };

  function blankRonda() {
    return { client: "", camerasOnline: "", camerasInstalled: "", note: "" };
  }

  function blankZtrax() {
    return { client: "", radioHt: STATUS_OPTIONS[0], ztrax: STATUS_OPTIONS[0], note: "" };
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    var button = document.getElementById("themeToggleBtn");
    if (button) button.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
    localStorage.setItem(THEME_KEY, document.body.dataset.theme);
  }

  function readPortalUser() {
    try {
      var raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function canAccessAdmin() {
    var email = String(currentPortalUser?.email || "").trim().toLowerCase();
    var sector = String(currentPortalUser?.sector || "").trim().toLowerCase();
    var permissions = currentPortalUser?.permissions || {};
    return Boolean(
      currentPortalUser &&
      (
        permissions.admin ||
        permissions.comercial ||
        permissions.manageReports ||
        MANAGER_EMAILS.has(email) ||
        MANAGER_SECTORS.has(sector)
      )
    );
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || window.TKA_FIREBASE_CONFIG;
    if (!config) throw new Error("Configuracao Firebase nao encontrada.");
    if (!firebase.apps.length) firebase.initializeApp(config);
    return firebase.firestore();
  }

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
      // Keep the current tab on the paused path when browser storage is blocked.
    }
  }

  function clearFirestoreReadBackoff() {
    try {
      localStorage.removeItem(FIRESTORE_READ_BACKOFF_KEY);
    } catch (error) {
      // The successful read is enough for this session.
    }
  }

  function isFirestoreQuotaError(error) {
    var text = String((error && (error.code || error.message || error.name)) || "").toLowerCase();
    return text.indexOf("resource-exhausted") >= 0 || text.indexOf("quota") >= 0 || text.indexOf("429") >= 0;
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
      var snapshot = await docRef.get({ source: "server" });
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

  function formatDate(value) {
    if (!value) return "Sem data";
    try {
      if (typeof value.toDate === "function") return value.toDate().toLocaleString("pt-BR");
      return new Date(value).toLocaleString("pt-BR");
    } catch (error) {
      return "Sem data";
    }
  }

  function createMetaItem(label, value) {
    return '<div class="meta-item"><strong>' + label + '</strong><span>' + (value || "-") + "</span></div>";
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadSharedCatalog() {
    var db = initializeFirebase();
    var snapshot = await readDocWithQuotaFallback(db.collection(SYSTEM_COLLECTION).doc(SHARED_CATALOG_DOC));
    var data = snapshot && typeof snapshot.data === "function" ? snapshot.data() || {} : {};
    sharedCatalog = {
      rondaEntries: Array.isArray(data.rondaEntries) ? data.rondaEntries : [],
      ztraxEntries: Array.isArray(data.ztraxEntries) ? data.ztraxEntries : []
    };
  }

  function readRondaEditor() {
    return Array.from(document.querySelectorAll("[data-ronda-client]")).map(function (input) {
      var index = Number(input.dataset.rondaClient);
      return {
        client: input.value.trim(),
        camerasOnline: document.querySelector('[data-ronda-online="' + index + '"]')?.value || "",
        camerasInstalled: document.querySelector('[data-ronda-installed="' + index + '"]')?.value || "",
        note: document.querySelector('[data-ronda-note="' + index + '"]')?.value.trim() || ""
      };
    }).filter(function (item) {
      return item.client || item.camerasOnline || item.camerasInstalled || item.note;
    });
  }

  function readZtraxEditor() {
    return Array.from(document.querySelectorAll("[data-ztrax-client]")).map(function (input) {
      var index = Number(input.dataset.ztraxClient);
      return {
        client: input.value.trim(),
        radioHt: document.querySelector('[data-ztrax-radio="' + index + '"]')?.value || STATUS_OPTIONS[0],
        ztrax: document.querySelector('[data-ztrax-status="' + index + '"]')?.value || STATUS_OPTIONS[0],
        note: document.querySelector('[data-ztrax-note="' + index + '"]')?.value.trim() || ""
      };
    }).filter(function (item) {
      return item.client || item.note || item.radioHt !== STATUS_OPTIONS[0] || item.ztrax !== STATUS_OPTIONS[0];
    });
  }

  async function persistSharedCatalog() {
    if (!canAccessAdmin()) return;
    var db = initializeFirebase();
    sharedCatalog.rondaEntries = readRondaEditor();
    sharedCatalog.ztraxEntries = readZtraxEditor();
    await db.collection(SYSTEM_COLLECTION).doc(SHARED_CATALOG_DOC).set({
      rondaEntries: sharedCatalog.rondaEntries,
      ztraxEntries: sharedCatalog.ztraxEntries,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  function renderRondaEditor() {
    var container = document.getElementById("rondaPreview");
    var items = (sharedCatalog.rondaEntries || []).slice();
    if (!items.length) items.push(blankRonda());
    container.innerHTML = items.map(function (item, index) {
      return (
        '<article class="row-card">' +
        '<div class="row-card-grid ronda-grid">' +
        '<label class="field">Cliente<input data-ronda-client="' + index + '" type="text" value="' + escapeHtml(item.client) + '" /></label>' +
        '<label class="field">Câmeras online<input data-ronda-online="' + index + '" type="number" min="0" value="' + escapeHtml(item.camerasOnline) + '" /></label>' +
        '<label class="field">Câmeras instaladas<input data-ronda-installed="' + index + '" type="number" min="0" value="' + escapeHtml(item.camerasInstalled) + '" /></label>' +
        '<label class="field">Observação<input data-ronda-note="' + index + '" type="text" value="' + escapeHtml(item.note) + '" /></label>' +
        '<button class="icon-btn" type="button" data-remove-ronda="' + index + '">✕</button>' +
        "</div>" +
        "</article>"
      );
    }).join("");
  }

  function renderZtraxEditor() {
    var container = document.getElementById("ztraxPreview");
    var items = (sharedCatalog.ztraxEntries || []).slice();
    if (!items.length) items.push(blankZtrax());
    container.innerHTML = items.map(function (item, index) {
      return (
        '<article class="row-card">' +
        '<div class="row-card-grid ztrax-grid">' +
        '<label class="field">Cliente<input data-ztrax-client="' + index + '" type="text" value="' + escapeHtml(item.client) + '" /></label>' +
        '<label class="field">Rádio HT<select data-ztrax-radio="' + index + '">' + STATUS_OPTIONS.map(function (option) { return '<option value="' + option + '"' + (option === item.radioHt ? " selected" : "") + ">" + option + "</option>"; }).join("") + "</select></label>" +
        '<label class="field">Ztrax<select data-ztrax-status="' + index + '">' + STATUS_OPTIONS.map(function (option) { return '<option value="' + option + '"' + (option === item.ztrax ? " selected" : "") + ">" + option + "</option>"; }).join("") + "</select></label>" +
        '<label class="field">Observação<input data-ztrax-note="' + index + '" type="text" value="' + escapeHtml(item.note) + '" /></label>' +
        '<button class="icon-btn" type="button" data-remove-ztrax="' + index + '">✕</button>' +
        "</div>" +
        "</article>"
      );
    }).join("");
  }

  function currentShiftState(record) {
    if (!record.shiftEnd) return "Em aberto";
    var end = new Date(record.shiftEnd);
    if (Number.isNaN(end.getTime())) return "Em aberto";
    return Date.now() <= end.getTime() ? "Em andamento" : "Finalizado";
  }

  function buildOperatorLinks(accounts) {
    var target = document.getElementById("operatorLinks");
    var entries = Object.keys(accounts || {}).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    if (!entries.length) {
      renderMessage(target, "empty-state", "Nenhum operador cadastrado.");
      return;
    }
    target.innerHTML = entries.map(function (username) {
      var config = accounts[username] || {};
      var operatorUrl = "/monitoramento/plantao/operador.html?usuario=" + encodeURIComponent(username) + "&publico=1";
      return (
        '<article class="operator-link-card">' +
        "<strong>" + username + "</strong>" +
        '<p class="muted">' + (config.fullName || "Sem nome") + "</p>" +
        '<div class="report-actions">' +
        '<a class="button secondary" href="' + operatorUrl + '">Abrir link público</a>' +
        "</div>" +
        "</article>"
      );
    }).join("");
  }

  async function archiveReport(id) {
    if (!canAccessAdmin()) return;
    if (!window.confirm("Arquivar este relatório?")) return;
    var db = initializeFirebase();
    await db.collection(REPORTS_COLLECTION).doc(id).update({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: currentPortalUser?.email || ""
    });
    await loadReports();
  }

  async function restoreReport(id) {
    if (!canAccessAdmin()) return;
    if (!window.confirm("Reativar este relatório?")) return;
    var db = initializeFirebase();
    await db.collection(REPORTS_COLLECTION).doc(id).update({
      archived: false,
      archivedAt: null,
      archivedBy: null
    });
    await loadReports();
  }

  async function deleteReport(id) {
    return archiveReport(id);
  }

  function buildCard(doc, isArchived) {
    var record = doc.data() || {};
    var actions = isArchived
      ? '<a class="button secondary" href="/monitoramento/plantao/editor.html?id=' + encodeURIComponent(doc.id) + '">Ver relatório</a>'
      : '<a class="button" href="/monitoramento/plantao/editor.html?id=' + encodeURIComponent(doc.id) + '">Abrir relatório</a>';

    if (canAccessAdmin()) {
      if (isArchived) {
        actions += '<button class="button secondary" type="button" data-restore="' + doc.id + '">Reativar</button>';
      } else {
        actions += '<button class="button warning" type="button" data-archive="' + doc.id + '">Arquivar</button>';
      }
    }

    return (
      '<article class="report-card">' +
      '<div class="report-head">' +
      "<div>" +
      "<h2>" + (record.fullName || record.operatorUsername || "Relatório sem operador") + "</h2>" +
      '<p class="muted">' + (record.operatorUsername || "-") + "</p>" +
      "</div>" +
      '<span class="chip">' + (isArchived ? "Arquivado" : currentShiftState(record)) + "</span>" +
      "</div>" +
      '<div class="meta-grid">' +
      createMetaItem("Início", formatDate(record.shiftStart)) +
      createMetaItem("Fim", formatDate(record.shiftEnd)) +
      createMetaItem("Última edição", record.lastEditedByName ? record.lastEditedByName + " | " + formatDate(record.lastEditedAt) : "Sem edição") +
      createMetaItem("QRU", record.qruDescription ? "Preenchido" : "Sem descrição") +
      "</div>" +
      '<div class="report-actions">' + actions + "</div>" +
      "</article>"
    );
  }

  function bindActions(container) {
    container.querySelectorAll("[data-archive]").forEach(function (button) {
      button.onclick = function () { archiveReport(button.dataset.archive).catch(console.error); };
    });
    container.querySelectorAll("[data-restore]").forEach(function (button) {
      button.onclick = function () { restoreReport(button.dataset.restore).catch(console.error); };
    });
    container.querySelectorAll("[data-delete]").forEach(function (button) {
      button.onclick = function () { deleteReport(button.dataset.delete).catch(console.error); };
    });
  }

  function bindSharedCatalogActions() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (target.matches("[data-remove-ronda]")) {
        sharedCatalog.rondaEntries.splice(Number(target.dataset.removeRonda), 1);
        renderRondaEditor();
      }
      if (target.matches("[data-remove-ztrax]")) {
        sharedCatalog.ztraxEntries.splice(Number(target.dataset.removeZtrax), 1);
        renderZtraxEditor();
      }
    });

    document.getElementById("addRondaBtn").onclick = function () {
      sharedCatalog.rondaEntries = sharedCatalog.rondaEntries || [];
      sharedCatalog.rondaEntries.push(blankRonda());
      renderRondaEditor();
    };

    document.getElementById("addZtraxBtn").onclick = function () {
      sharedCatalog.ztraxEntries = sharedCatalog.ztraxEntries || [];
      sharedCatalog.ztraxEntries.push(blankZtrax());
      renderZtraxEditor();
    };

    document.getElementById("saveRondaBtn").onclick = function () {
      persistSharedCatalog().then(function () {
        return loadReports();
      }).catch(console.error);
    };

    document.getElementById("saveZtraxBtn").onclick = function () {
      persistSharedCatalog().then(function () {
        return loadReports();
      }).catch(console.error);
    };
  }

  async function loadReports() {
    var listElement = document.getElementById("reportList");
    var archivedElement = document.getElementById("archivedReportList");
    var rondaPreview = document.getElementById("rondaPreview");
    var ztraxPreview = document.getElementById("ztraxPreview");
    var countLabel = document.getElementById("countLabel");
    var archivedCountLabel = document.getElementById("archivedCountLabel");

    if (!canAccessAdmin()) {
      countLabel.textContent = "Sem permissão";
      renderMessage(listElement, "error-state", "Acesso restrito ao comercial e ao admin.");
      renderMessage(archivedElement, "error-state", "Acesso restrito.");
      return;
    }

    var db = initializeFirebase();
    if (firestoreReadBackoffActive()) {
      countLabel.textContent = "Firebase pausado";
      archivedCountLabel.textContent = "Firebase pausado";
      renderMessage(listElement, "error-state", "Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderMessage(archivedElement, "error-state", "Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderRondaEditor();
      renderZtraxEditor();
      return;
    }
    var snapshot;
    try {
      snapshot = await db.collection(REPORTS_COLLECTION).orderBy("updatedAt", "desc").get();
      clearFirestoreReadBackoff();
    } catch (error) {
      if (!isFirestoreQuotaError(error)) throw error;
      applyFirestoreReadBackoff();
      countLabel.textContent = "Firebase pausado";
      archivedCountLabel.textContent = "Firebase pausado";
      renderMessage(listElement, "error-state", "Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderMessage(archivedElement, "error-state", "Firebase atingiu a cota de leitura; relatórios remotos pausados temporariamente.");
      renderRondaEditor();
      renderZtraxEditor();
      return;
    }
    var activeDocs = snapshot.docs.filter(function (doc) { return !doc.data().archived; });
    var archivedDocs = snapshot.docs.filter(function (doc) { return !!doc.data().archived; });

    countLabel.textContent = activeDocs.length + (activeDocs.length === 1 ? " relatório" : " relatórios");
    archivedCountLabel.textContent = archivedDocs.length + (archivedDocs.length === 1 ? " relatório" : " relatórios");

    listElement.innerHTML = activeDocs.length ? activeDocs.map(function (doc) { return buildCard(doc, false); }).join("") : '<div class="empty-state">Nenhum relatório ativo.</div>';
    archivedElement.innerHTML = archivedDocs.length ? archivedDocs.map(function (doc) { return buildCard(doc, true); }).join("") : '<div class="empty-state">Nenhum relatório arquivado.</div>';

    renderRondaEditor();
    renderZtraxEditor();

    bindActions(listElement);
    bindActions(archivedElement);
  }

  async function loadOperatorLinks() {
    if (!canAccessAdmin()) return;
    var db = initializeFirebase();
    var snapshot = await readDocWithQuotaFallback(db.collection(SYSTEM_COLLECTION).doc(OPERATORS_DOC));
    var data = snapshot && typeof snapshot.data === "function" ? snapshot.data() || {} : {};
    buildOperatorLinks(data.accounts || {});
  }

  function bindTabs() {
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.onclick = function () {
        document.querySelectorAll("[data-tab]").forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        document.getElementById("tab-ativos").hidden = button.dataset.tab !== "ativos";
        document.getElementById("tab-arquivados").hidden = button.dataset.tab !== "arquivados";
        document.getElementById("tab-ronda").hidden = button.dataset.tab !== "ronda";
        document.getElementById("tab-ztrax").hidden = button.dataset.tab !== "ztrax";
      };
    });
  }

  async function boot() {
    currentPortalUser = readPortalUser();
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    document.getElementById("themeToggleBtn").onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };
    document.getElementById("homeLink").onclick = function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/?tab=systems");
    };
    bindTabs();
    bindSharedCatalogActions();
    await loadSharedCatalog();
    await loadOperatorLinks();
    await loadReports();
  }

  boot().catch(console.error);
})();
