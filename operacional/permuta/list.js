(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var COLLECTION = "operacional_permuta_forms";
  var db = null;
  var state = { records: [], currentUser: null, currentTab: "ativos" };
  var blankSignatureDataUrl = "";
  var el = {
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    accessMessage: document.getElementById("accessMessage"),
    activeSearchInput: document.getElementById("activeSearchInput"),
    archivedSearchInput: document.getElementById("archivedSearchInput"),
    waitingSummaryCount: document.getElementById("waitingSummaryCount"),
    incompleteSummaryCount: document.getElementById("incompleteSummaryCount"),
    completeSummaryCount: document.getElementById("completeSummaryCount"),
    archivedSummaryCount: document.getElementById("archivedSummaryCount"),
    waitingCountLabel: document.getElementById("waitingCountLabel"),
    incompleteCountLabel: document.getElementById("incompleteCountLabel"),
    completeCountLabel: document.getElementById("completeCountLabel"),
    archivedCountLabel: document.getElementById("archivedCountLabel"),
    waitingRecordList: document.getElementById("waitingRecordList"),
    incompleteRecordList: document.getElementById("incompleteRecordList"),
    completeRecordList: document.getElementById("completeRecordList"),
    archivedRecordList: document.getElementById("archivedRecordList")
  };

  function getBlankSignatureDataUrl() {
    if (!blankSignatureDataUrl) {
      var canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 220;
      blankSignatureDataUrl = canvas.toDataURL("image/png");
    }
    return blankSignatureDataUrl;
  }

  function hasSignatureDataUrl(dataUrl) {
    return Boolean(String(dataUrl || "").trim()) && dataUrl !== getBlankSignatureDataUrl();
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    el.themeToggleBtn.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
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

  function canAccess() {
    return Boolean(state.currentUser && state.currentUser.permissions && (state.currentUser.permissions.operacional || state.currentUser.permissions.admin));
  }

  function canManage() {
    return canAccess();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function dateFromValue(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    var text = String(value || "");
    var date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? text + "T00:00:00" : text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    var date = dateFromValue(value);
    return date ? date.toLocaleDateString("pt-BR") : "Data pendente";
  }

  function formatDateTime(value) {
    var date = dateFromValue(value);
    return date ? date.toLocaleString("pt-BR") : "Sem data";
  }

  function sortRecords(records) {
    return records.sort(function (a, b) {
      var aDate = dateFromValue(a.updatedAt) || dateFromValue(a.requestDate) || new Date(0);
      var bDate = dateFromValue(b.updatedAt) || dateFromValue(b.requestDate) || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }

  function coreIssues(record) {
    var issues = [];
    if (!String(record.placeName || "").trim()) issues.push("Posto");
    if (!String(record.requestDate || "").trim()) issues.push("Data da solicitacao");
    if (!String(record.shiftDate || "").trim()) issues.push("Data do plantao");
    if (!String(record.shiftStart || "").trim()) issues.push("Horario inicial");
    if (!String(record.shiftEnd || "").trim()) issues.push("Horario final");
    if (!String(record.employeeAName || "").trim()) issues.push("Nome do solicitante");
    if (!String(record.employeeACpf || "").trim()) issues.push("CPF do solicitante");
    if (!String(record.employeeARg || "").trim()) issues.push("RG do solicitante");
    if (!hasSignatureDataUrl(record.employeeASignatureDataUrl)) issues.push("Assinatura do solicitante");
    if (!String(record.employeeBName || "").trim()) issues.push("Nome de quem assume");
    if (!String(record.employeeBCpf || "").trim()) issues.push("CPF de quem assume");
    if (!String(record.employeeBRg || "").trim()) issues.push("RG de quem assume");
    if (!hasSignatureDataUrl(record.employeeBSignatureDataUrl)) issues.push("Assinatura de quem assume");
    return issues;
  }

  function approvalIssues(record) {
    var issues = [];
    if (!String(record.supervisorName || "").trim()) issues.push("Nome do supervisor");
    if (!hasSignatureDataUrl(record.supervisorSignatureDataUrl)) issues.push("Assinatura do supervisor");
    return issues;
  }

  function deriveStatus(record) {
    if (coreIssues(record).length) return "incomplete";
    if (approvalIssues(record).length) return "waiting_approval";
    return "complete";
  }

  function statusLabel(status) {
    var map = {
      incomplete: "Incompleta",
      waiting_approval: "Aguardando aprovacao",
      complete: "Completa"
    };
    return map[status] || "Incompleta";
  }

  function sourceLabel(source) {
    if (source === "public-permuta-form") return "Link publico";
    if (source === "operacional-permuta-manual") return "Cadastro interno";
    return "Permuta";
  }

  function pendingSummary(record) {
    var status = deriveStatus(record);
    var issues = status === "waiting_approval" ? approvalIssues(record) : coreIssues(record);
    if (!issues.length) return status === "complete" ? "Sem pendencias" : "Aguardando aprovacao";
    return issues.slice(0, 4).join(", ") + (issues.length > 4 ? "..." : "");
  }

  function buildPublicUrl(id) {
    var url = new URL("/operacional/permuta/editor.html", window.location.origin);
    if (id) url.searchParams.set("id", id);
    url.searchParams.set("public", "1");
    return url.toString();
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function copyPublicLink(id) {
    var link = buildPublicUrl(id);
    return copyTextToClipboard(link).then(function (copied) {
      if (copied) {
        window.alert("Link publico da permuta copiado. Envie o mesmo link para solicitante, colaborador que assume e supervisor.");
      } else {
        window.prompt("Copie o link publico da permuta:", link);
      }
    });
  }

  function createMetaItem(label, value) {
    return '<div class="meta-item"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(value || "-") + "</span></div>";
  }

  function buildCard(record, isArchived) {
    var status = deriveStatus(record);
    var plantao = [formatDate(record.shiftDate), record.shiftStart, record.shiftEnd].filter(Boolean).join(" | ");
    var title = record.placeName || record.employeeAName || "Permuta sem posto";
    var actions = ""
      + '<a class="button" href="/operacional/permuta/editor.html?id=' + encodeURIComponent(record.id) + '">Abrir</a>'
      + '<a class="button secondary" href="' + escapeHtml(buildPublicUrl(record.id)) + '" target="_blank" rel="noreferrer">Ver link publico</a>'
      + '<button class="button secondary" type="button" data-copy-public-link="' + escapeHtml(record.id) + '">Copiar link</button>'
      + '<button class="button secondary" type="button" data-export="' + escapeHtml(record.id) + '">Exportar PDF</button>';

    if (canManage()) {
      if (isArchived) {
        actions += '<button class="button secondary" type="button" data-restore="' + escapeHtml(record.id) + '">Reativar</button>';
      } else {
        actions += '<button class="button warning" type="button" data-archive="' + escapeHtml(record.id) + '">Arquivar</button>';
      }
    }

    return ''
      + '<article class="record-card" data-record-id="' + escapeHtml(record.id) + '">'
      + '  <div class="record-card-head">'
      + '    <div>'
      + '      <h2>' + escapeHtml(title) + '</h2>'
      + '      <p class="muted">' + escapeHtml(formatDate(record.requestDate)) + ' | ' + escapeHtml(record.employeeAName || "-") + ' x ' + escapeHtml(record.employeeBName || "-") + '</p>'
      + '    </div>'
      + '    <div class="chip-row">'
      + '      <span class="chip">' + escapeHtml(sourceLabel(record.source)) + '</span>'
      + '      <span class="chip" data-status="' + escapeHtml(status) + '">' + escapeHtml(statusLabel(status)) + '</span>'
      + (isArchived ? '      <span class="chip">Arquivada</span>' : '')
      + '    </div>'
      + '  </div>'
      + '  <div class="meta-grid">'
      + createMetaItem("Plantao", plantao || "Nao informado")
      + createMetaItem("Solicitante", record.employeeAName || "Nao informado")
      + createMetaItem("Quem assume", record.employeeBName || "Nao informado")
      + createMetaItem("Supervisor", record.supervisorName || "Nao informado")
      + createMetaItem(status === "complete" ? "Situacao" : "Pendencias", pendingSummary(record))
      + createMetaItem("Ultima atualizacao", formatDateTime(record.updatedAt || record.requestDate))
      + '  </div>'
      + '  <div class="record-actions">' + actions + '</div>'
      + '</article>';
  }

  function matchesSearch(record, query) {
    if (!query) return true;
    var haystack = [
      record.placeName,
      record.employeeAName,
      record.employeeACpf,
      record.employeeBName,
      record.employeeBCpf,
      record.supervisorName,
      statusLabel(deriveStatus(record)),
      pendingSummary(record)
    ].join(" ").toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function renderMessage(container, className, message) {
    if (!container) return;
    container.innerHTML = '<div class="' + className + '">' + escapeHtml(message) + '</div>';
  }

  function sectionData(kind) {
    var active = state.records.filter(function (record) { return !record.archived; });
    if (kind === "waiting") return active.filter(function (record) { return deriveStatus(record) === "waiting_approval"; });
    if (kind === "incomplete") return active.filter(function (record) { return deriveStatus(record) === "incomplete"; });
    if (kind === "complete") return active.filter(function (record) { return deriveStatus(record) === "complete"; });
    return state.records.filter(function (record) { return !!record.archived; });
  }

  function emptyMessage(kind, query) {
    var searched = Boolean(query);
    var map = {
      waiting: searched ? "Nenhuma permuta aguardando aprovacao encontrada." : "Nenhuma permuta aguardando aprovacao.",
      incomplete: searched ? "Nenhuma permuta incompleta encontrada." : "Nenhuma permuta incompleta.",
      complete: searched ? "Nenhuma permuta completa encontrada." : "Nenhuma permuta completa.",
      archived: searched ? "Nenhuma permuta arquivada encontrada." : "Nenhuma permuta arquivada."
    };
    return map[kind] || "Nenhuma permuta encontrada.";
  }

  function renderSection(kind) {
    var config = {
      waiting: { list: el.waitingRecordList, count: el.waitingCountLabel, suffix: " aguardando" },
      incomplete: { list: el.incompleteRecordList, count: el.incompleteCountLabel, suffix: " incompleta(s)" },
      complete: { list: el.completeRecordList, count: el.completeCountLabel, suffix: " completa(s)" },
      archived: { list: el.archivedRecordList, count: el.archivedCountLabel, suffix: " arquivada(s)" }
    }[kind];
    if (!config) return;

    var queryInput = kind === "archived" ? el.archivedSearchInput : el.activeSearchInput;
    var query = String((queryInput && queryInput.value) || "").trim().toLowerCase();
    var rows = sectionData(kind).filter(function (record) {
      return matchesSearch(record, query);
    });

    config.count.textContent = rows.length + config.suffix;
    if (!rows.length) {
      renderMessage(config.list, "empty-state", emptyMessage(kind, query));
      return;
    }
    config.list.innerHTML = rows.map(function (record) {
      return buildCard(record, kind === "archived");
    }).join("");
    bindActions(config.list);
  }

  function renderAll() {
    if (el.waitingSummaryCount) el.waitingSummaryCount.textContent = String(sectionData("waiting").length);
    if (el.incompleteSummaryCount) el.incompleteSummaryCount.textContent = String(sectionData("incomplete").length);
    if (el.completeSummaryCount) el.completeSummaryCount.textContent = String(sectionData("complete").length);
    if (el.archivedSummaryCount) el.archivedSummaryCount.textContent = String(sectionData("archived").length);
    renderSection("waiting");
    renderSection("incomplete");
    renderSection("complete");
    renderSection("archived");
  }

  function archiveRecord(id) {
    if (!canManage()) return Promise.resolve();
    if (!window.confirm("Arquivar esta permuta? Ela ficara visivel na aba Arquivadas.")) return Promise.resolve();
    return db.collection(COLLECTION).doc(id).set({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: (state.currentUser && state.currentUser.email) || "desconhecido",
      updatedAt: new Date().toISOString(),
      updatedBy: (state.currentUser && state.currentUser.email) || ""
    }, { merge: true });
  }

  function restoreRecord(id) {
    if (!canManage()) return Promise.resolve();
    if (!window.confirm("Reativar esta permuta?")) return Promise.resolve();
    return db.collection(COLLECTION).doc(id).set({
      archived: false,
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date().toISOString(),
      updatedBy: (state.currentUser && state.currentUser.email) || ""
    }, { merge: true });
  }

  function bindActions(container) {
    container.querySelectorAll("[data-export]").forEach(function (button) {
      button.onclick = function () {
        var record = state.records.find(function (item) { return item.id === button.getAttribute("data-export"); });
        if (record) window.PermutaPdf.exportRecord(record);
      };
    });
    container.querySelectorAll("[data-copy-public-link]").forEach(function (button) {
      button.onclick = function () {
        copyPublicLink(button.getAttribute("data-copy-public-link")).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel copiar o link publico.");
        });
      };
    });
    container.querySelectorAll("[data-archive]").forEach(function (button) {
      button.onclick = function () {
        archiveRecord(button.getAttribute("data-archive")).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel arquivar a permuta.");
        });
      };
    });
    container.querySelectorAll("[data-restore]").forEach(function (button) {
      button.onclick = function () {
        restoreRecord(button.getAttribute("data-restore")).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel reativar a permuta.");
        });
      };
    });
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (button) {
      button.onclick = function () {
        state.currentTab = button.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (tab) {
          tab.classList.toggle("active", tab.dataset.tab === state.currentTab);
        });
        var activeTab = document.getElementById("tab-ativos");
        var archivedTab = document.getElementById("tab-arquivados");
        if (activeTab) activeTab.hidden = state.currentTab !== "ativos";
        if (archivedTab) archivedTab.hidden = state.currentTab !== "arquivados";
      };
    });
  }

  function renderAccessDenied() {
    [el.waitingCountLabel, el.incompleteCountLabel, el.completeCountLabel, el.archivedCountLabel].forEach(function (label) {
      if (label) label.textContent = "Sem permissao";
    });
    [el.waitingRecordList, el.incompleteRecordList, el.completeRecordList, el.archivedRecordList].forEach(function (container) {
      renderMessage(container, "error-state", "Acesso restrito ao setor Operacional e administradores.");
    });
  }

  function init() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    state.currentUser = readPortalUser();
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    setupTabs();
    if (!canAccess()) {
      el.accessMessage.textContent = "Acesso restrito ao setor Operacional e administradores.";
      renderAccessDenied();
      return;
    }
    el.accessMessage.textContent = "Acesso liberado para " + state.currentUser.email + ".";
    db.collection(COLLECTION).onSnapshot(function (snapshot) {
      state.records = sortRecords(snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      }));
      renderAll();
    }, function (error) {
      console.error(error);
      [el.waitingRecordList, el.incompleteRecordList, el.completeRecordList, el.archivedRecordList].forEach(function (container) {
        renderMessage(container, "error-state", "Nao foi possivel carregar as permutas.");
      });
    });
    el.activeSearchInput.oninput = renderAll;
    el.archivedSearchInput.oninput = renderAll;
    el.themeToggleBtn.onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };
  }

  init();
})();
