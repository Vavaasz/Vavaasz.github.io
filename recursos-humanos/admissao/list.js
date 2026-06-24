(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var FIRESTORE_READ_BACKOFF_KEY = "tka_rh_admission_read_backoff_until";
  var FIRESTORE_QUOTA_BACKOFF_MS = 15 * 60 * 1000;
  var currentPortalUser = null;
  var activeStage = "current";
  var ADMISSION_STAGES = [
    { value: "current", label: "Vigentes", empty: "Nenhuma ficha vigente encontrada." },
    { value: "superseded", label: "Superados", empty: "Nenhuma ficha superada encontrada." },
    { value: "archived", label: "Arquivados", empty: "Nenhuma ficha arquivada encontrada." }
  ];
  var ADMISSION_STATUS_OPTIONS = [
    { value: "pending", label: "Pendente" },
    { value: "sent-incicle", label: "Enviado para Incicle" },
    { value: "sent-accounting", label: "Enviado para Contabilidade" }
  ];
  var COMMERCIAL_EMAILS = {
    "comercial@grupotka.com.br": true,
    "comercial@grupotka": true
  };

  var elements = {
    stageTabs: [].slice.call(document.querySelectorAll("[data-admission-stage-tab]")),
    stagePanels: [].slice.call(document.querySelectorAll("[data-admission-stage-panel]")),
    currentAdmissionList: document.getElementById("currentAdmissionList"),
    supersededAdmissionList: document.getElementById("supersededAdmissionList"),
    archivedAdmissionList: document.getElementById("archivedAdmissionList"),
    currentCountLabel: document.getElementById("currentCountLabel"),
    supersededCountLabel: document.getElementById("supersededCountLabel"),
    archivedCountLabel: document.getElementById("archivedCountLabel"),
    currentSearchInput: document.getElementById("currentSearchInput"),
    supersededSearchInput: document.getElementById("supersededSearchInput"),
    archivedSearchInput: document.getElementById("archivedSearchInput"),
    totalAdmissionsCount: document.getElementById("totalAdmissionsCount"),
    currentAdmissionsCount: document.getElementById("currentAdmissionsCount"),
    supersededAdmissionsCount: document.getElementById("supersededAdmissionsCount"),
    archivedAdmissionsCount: document.getElementById("archivedAdmissionsCount"),
    accessMessage: document.getElementById("accessMessage"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    homeLink: document.getElementById("homeLink"),
    rhHomeLink: document.getElementById("rhHomeLink")
  };

  var cachedDocs = {
    current: [],
    superseded: [],
    archived: []
  };

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    elements.themeToggleBtn.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
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

  function readRhGateEmail() {
    return String(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY) || "").trim().toLowerCase();
  }

  function hasRhAccess() {
    currentPortalUser = readPortalUser();
    if (currentPortalUser) {
      var permissions = currentPortalUser.permissions || {};
      var portalEmail = String(currentPortalUser.email || currentPortalUser.user || currentPortalUser.login || "").trim().toLowerCase();
      if (permissions.rh || permissions.admin || permissions.comercial || permissions.commercial || COMMERCIAL_EMAILS[portalEmail]) return true;
    }
    var email = readRhGateEmail();
    var gate = window.RH_GATE || {};
    return Boolean(email && gate.users && gate.users[email]);
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) {
      throw new Error("Configuracao Firebase nao encontrada.");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
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
      // The page still renders a paused state when localStorage is unavailable.
    }
  }

  function clearFirestoreReadBackoff() {
    try {
      localStorage.removeItem(FIRESTORE_READ_BACKOFF_KEY);
    } catch (error) {
      // Ignore storage failures; the successful Firebase read is enough for this session.
    }
  }

  function isFirestoreQuotaError(error) {
    var text = String((error && (error.code || error.message || error.name)) || "").toLowerCase();
    return text.indexOf("resource-exhausted") >= 0 || text.indexOf("quota") >= 0 || text.indexOf("429") >= 0;
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
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

  function statusLabel(status) {
    var map = {
      em_preenchimento: "Em preenchimento",
      recebido: "Recebido",
      em_analise: "Em analise",
      concluido: "Concluido"
    };
    return map[status] || "Sem status";
  }

  function findStage(value) {
    return ADMISSION_STAGES.find(function (item) { return item.value === value; }) || null;
  }

  function normalizeStage(meta) {
    var explicitStage = meta && meta.admissionStage;
    if (findStage(explicitStage)) return explicitStage;
    if (meta && meta.archived) return "archived";
    return "current";
  }

  function stageLabel(value) {
    var stage = findStage(value);
    return stage ? stage.label : "Vigentes";
  }

  function normalizeAdmissionStatus(value) {
    var match = ADMISSION_STATUS_OPTIONS.find(function (item) { return item.value === value; });
    return match ? match.value : "pending";
  }

  function admissionStatusLabel(value) {
    var normalized = normalizeAdmissionStatus(value);
    var match = ADMISSION_STATUS_OPTIONS.find(function (item) { return item.value === normalized; });
    return match ? match.label : "Pendente";
  }

  function optionMarkup(options, selectedValue) {
    return options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (option.value === selectedValue ? " selected" : "") + ">"
        + escapeHtml(option.label)
        + "</option>";
    }).join("");
  }

  function createMetaItem(label, value) {
    return '<div class="meta-item"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(value || "-") + "</span></div>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function allCachedDocs() {
    return ADMISSION_STAGES.reduce(function (rows, stage) {
      return rows.concat(cachedDocs[stage.value] || []);
    }, []);
  }

  async function deleteRecord(db, id) {
    var ok = window.confirm("Arquivar esta ficha de admissao? Ela continuara preservada na aba Arquivados.");
    if (!ok) return;
    var sourceDoc = allCachedDocs().find(function (doc) { return doc.id === id; });
    var record = sourceDoc ? (sourceDoc.data() || {}) : {};
    var data = record.data || {};
    data.meta = data.meta || {};
    data.meta.admissionStage = "archived";
    data.meta.archived = true;
    data.meta.archivedAt = new Date().toISOString();
    data.meta.archiveReason = data.meta.archiveReason || "archived_from_list";
    await db.collection("rh_admission_forms").doc(id).set({
      data: data,
      archived: true,
      archivedAt: data.meta.archivedAt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await loadAdmissions();
  }

  async function updateAdmissionStatus(db, docId, nextStatus) {
    var sourceDoc = allCachedDocs().find(function (doc) { return doc.id === docId; });
    if (!sourceDoc) return;
    var record = sourceDoc.data() || {};
    var data = record.data || {};
    data.meta = data.meta || {};
    data.meta.admissionStatus = normalizeAdmissionStatus(nextStatus);
    await db.collection("rh_admission_forms").doc(docId).set({
      data: data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await loadAdmissions();
  }

  async function updateAdmissionStage(db, docId, nextStage) {
    var sourceDoc = allCachedDocs().find(function (doc) { return doc.id === docId; });
    if (!sourceDoc) return;
    var record = sourceDoc.data() || {};
    var data = record.data || {};
    data.meta = data.meta || {};
    data.meta.admissionStage = findStage(nextStage) ? nextStage : "current";
    data.meta.archived = data.meta.admissionStage === "archived";
    await db.collection("rh_admission_forms").doc(docId).set({
      data: data,
      archived: data.meta.archived,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await loadAdmissions();
  }

  function missingSummary(data) {
    var issues = (window.TKAAdmissionRules && window.TKAAdmissionRules.requiredIssues(data)) || [];
    if (!Boolean((data.lgpd || {}).agreement)) issues.push("Aceite LGPD");
    if (!String(((data.finalSignature || {}).signatureDataUrl) || "").trim()) issues.push("Assinatura");
    if (!String((((data.meta || {}).publicSubmittedAt) || "")).trim()) issues.push("Envio final");
    if (!((data.transport || {}).decision === "accept" || (data.transport || {}).decision === "decline")) {
      issues.push("Opcao Vale Transporte");
    }
    if (!issues.length) return "Sem pendencias";
    return issues.slice(0, 4).join(", ") + (issues.length > 4 ? "..." : "");
  }

  function sourceLabel(source) {
    if (source === "rh-admission-manual") return "Cadastro interno";
    if (source === "public-admission-form") return "Link publico";
    return "Ficha";
  }

  function isAdmissionComplete(data) {
    return Boolean(window.TKAAdmissionRules && window.TKAAdmissionRules.isComplete(data));
  }

  function stageControlMarkup(docId, stage) {
    return ''
      + '<label class="status-control-label">Mover ficha'
      + '  <select data-admission-stage="' + escapeHtml(docId) + '">'
      + optionMarkup(ADMISSION_STAGES, stage)
      + "  </select>"
      + "</label>";
  }

  function buildCard(doc) {
    var record = doc.data() || {};
    var data = record.data || {};
    var personal = data.personal || {};
    var meta = data.meta || {};
    var documents = data.documents || {};
    var address = data.address || {};
    var name = personal.fullName || "Ficha sem nome";
    var cpf = documents.cpf || "";
    var phone = personal.phone || "";
    var city = address.city || "";
    var status = statusLabel(meta.status || "em_preenchimento");
    var stage = normalizeStage(meta);
    var admissionStatus = admissionStatusLabel(meta.admissionStatus);
    var updatedAt = formatDate(record.updatedAt || record.createdAt);
    var complete = isAdmissionComplete(data);
    var completionChip = complete ? "Ficha completa" : "Ficha incompleta";
    var missingChip = complete ? "Enviada" : missingSummary(data);
    var actions = ""
      + '<a class="button" href="/recursos-humanos/admissao/editor.html?id=' + encodeURIComponent(doc.id) + '&admin=1">Abrir ficha</a>'
      + '<a class="button secondary" href="/recursos-humanos/admissao/editor.html?id=' + encodeURIComponent(doc.id) + '" target="_blank" rel="noreferrer">Ver no link publico</a>'
      + '<button class="button secondary" type="button" data-export-pdf="' + escapeHtml(doc.id) + '">Exportar PDF</button>'
      + '<button class="button warning" type="button" data-delete="' + escapeHtml(doc.id) + '">Arquivar</button>';

    return ''
      + '<article class="record-card" data-record-id="' + escapeHtml(doc.id) + '">'
      + '  <div class="record-card-head">'
      + "    <div>"
      + "      <h2>" + escapeHtml(name) + "</h2>"
      + '      <p class="muted">' + escapeHtml(meta.company || city || "Sem cidade informada") + "</p>"
      + "    </div>"
      + '    <div class="chip-row">'
      + '      <span class="chip">' + escapeHtml(stageLabel(stage)) + "</span>"
      + '      <span class="chip">' + escapeHtml(sourceLabel(record.source)) + "</span>"
      + '      <span class="chip">' + escapeHtml(admissionStatus) + "</span>"
      + '      <span class="chip">' + escapeHtml(status) + "</span>"
      + '      <span class="chip">' + escapeHtml(completionChip) + "</span>"
      + "    </div>"
      + "  </div>"
      + '  <div class="meta-grid">'
      + createMetaItem("CPF", cpf || "Nao informado")
      + createMetaItem("Telefone", phone || "Nao informado")
      + createMetaItem("Cargo", meta.role || "Nao informado")
      + createMetaItem("Ultima atualizacao", updatedAt)
      + createMetaItem(complete ? "Situacao" : "Pendencias", missingChip)
      + "  </div>"
      + '  <div class="record-controls">'
      + '    <label class="status-control-label">Status admissional'
      + '      <select data-admission-status="' + escapeHtml(doc.id) + '">'
      + optionMarkup(ADMISSION_STATUS_OPTIONS, normalizeAdmissionStatus(meta.admissionStatus))
      + "      </select>"
      + "    </label>"
      + stageControlMarkup(doc.id, stage)
      + "  </div>"
      + '  <div class="record-actions">' + actions + "</div>"
      + "</article>";
  }

  function matchesSearch(doc, query) {
    if (!query) return true;
    var record = doc.data() || {};
    var data = record.data || {};
    var personal = data.personal || {};
    var meta = data.meta || {};
    var issues = isAdmissionComplete(data) ? "" : missingSummary(data);
    var haystack = [
      personal.fullName || "",
      meta.role || "",
      admissionStatusLabel(meta.admissionStatus),
      stageLabel(normalizeStage(meta)),
      issues
    ].join(" ").toLowerCase();
    return haystack.indexOf(query) >= 0;
  }

  function sectionElements(stage) {
    if (stage === "superseded") {
      return {
        list: elements.supersededAdmissionList,
        input: elements.supersededSearchInput,
        countLabel: elements.supersededCountLabel
      };
    }
    if (stage === "archived") {
      return {
        list: elements.archivedAdmissionList,
        input: elements.archivedSearchInput,
        countLabel: elements.archivedCountLabel
      };
    }
    return {
      list: elements.currentAdmissionList,
      input: elements.currentSearchInput,
      countLabel: elements.currentCountLabel
    };
  }

  function bindActions(container, db) {
    container.querySelectorAll("[data-export-pdf]").forEach(function (button) {
      button.onclick = function () {
        var card = button.closest(".record-card");
        if (!card) return;
        var record = JSON.parse(card.dataset.record || "{}");
        if (!window.TKAAdmissionPdf) {
          renderMessage(container, "error-state", "PDF indisponivel no momento.");
          return;
        }
        window.TKAAdmissionPdf.download(record).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel gerar o PDF agora.");
        });
      };
    });

    container.querySelectorAll("[data-delete]").forEach(function (button) {
      button.onclick = function () {
        deleteRecord(db, button.dataset.delete).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel arquivar a ficha.");
        });
      };
    });

    container.querySelectorAll("[data-admission-status]").forEach(function (select) {
      select.onchange = function () {
        select.disabled = true;
        updateAdmissionStatus(db, select.dataset.admissionStatus, select.value).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel atualizar o status admissional.");
        });
      };
    });

    container.querySelectorAll("[data-admission-stage]").forEach(function (select) {
      select.onchange = function () {
        select.disabled = true;
        updateAdmissionStage(db, select.dataset.admissionStage, select.value).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel mover a ficha.");
        });
      };
    });
  }

  function stampRecordData(container, docs) {
    docs.forEach(function (doc) {
      var card = container.querySelector('[data-record-id="' + doc.id + '"]');
      if (card) {
        card.dataset.record = JSON.stringify((doc.data() || {}).data || {});
      }
    });
  }

  function renderSection(stage, db) {
    var section = sectionElements(stage);
    var stageConfig = findStage(stage) || ADMISSION_STAGES[0];
    var query = String(section.input.value || "").trim().toLowerCase();
    var filtered = (cachedDocs[stage] || []).filter(function (doc) {
      return matchesSearch(doc, query);
    });

    if (!filtered.length) {
      renderMessage(section.list, "empty-state", query ? "Nenhuma ficha encontrada para essa busca." : stageConfig.empty);
      return;
    }

    section.list.innerHTML = filtered.map(function (doc) {
      return buildCard(doc);
    }).join("");
    stampRecordData(section.list, filtered);
    bindActions(section.list, db);
  }

  function renderAllSections(db) {
    ADMISSION_STAGES.forEach(function (stage) {
      renderSection(stage.value, db);
    });
  }

  function setActiveStage(stage) {
    activeStage = findStage(stage) ? stage : "current";
    elements.stageTabs.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.admissionStageTab === activeStage);
      button.setAttribute("aria-selected", button.dataset.admissionStageTab === activeStage ? "true" : "false");
    });
    elements.stagePanels.forEach(function (panel) {
      panel.classList.toggle("hidden", panel.dataset.admissionStagePanel !== activeStage);
    });
  }

  function resetCounts(label) {
    var summaryValue = label ? "-" : "0";
    elements.totalAdmissionsCount.textContent = summaryValue;
    elements.currentAdmissionsCount.textContent = summaryValue;
    elements.supersededAdmissionsCount.textContent = summaryValue;
    elements.archivedAdmissionsCount.textContent = summaryValue;
    ADMISSION_STAGES.forEach(function (stage) {
      sectionElements(stage.value).countLabel.textContent = label || "0 fichas";
    });
  }

  function renderFirestorePaused(message) {
    resetCounts("Firebase pausado");
    elements.accessMessage.textContent = message;
    ADMISSION_STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", message);
    });
  }

  async function loadAdmissions() {
    if (!hasRhAccess()) {
      resetCounts("Sem permissao");
      elements.accessMessage.textContent = "Acesso restrito ao RH, Comercial e Admin.";
      ADMISSION_STAGES.forEach(function (stage) {
        renderMessage(sectionElements(stage.value).list, "error-state", "Este painel exige permissao de RH, Comercial ou Admin no portal.");
      });
      return;
    }

    elements.accessMessage.textContent = "Base interna disponivel para acompanhamento do RH.";
    if (firestoreReadBackoffActive()) {
      renderFirestorePaused("Firebase atingiu a cota de leitura; a lista foi pausada temporariamente para nao piorar a lentidao.");
      return;
    }

    var db = initializeFirebase();
    var snapshot;
    try {
      snapshot = await db.collection("rh_admission_forms").orderBy("updatedAt", "desc").get();
      clearFirestoreReadBackoff();
    } catch (error) {
      if (isFirestoreQuotaError(error)) {
        applyFirestoreReadBackoff();
        renderFirestorePaused("Firebase atingiu a cota de leitura; a lista foi pausada temporariamente para nao piorar a lentidao.");
        return;
      }
      throw error;
    }
    var buckets = {
      current: [],
      superseded: [],
      archived: []
    };

    snapshot.docs.forEach(function (doc) {
      var data = ((doc.data() || {}).data) || {};
      var stage = normalizeStage(data.meta || {});
      buckets[stage].push(doc);
    });

    cachedDocs = buckets;
    var total = snapshot.docs.length;
    var current = buckets.current.length;
    var superseded = buckets.superseded.length;
    var archived = buckets.archived.length;

    elements.totalAdmissionsCount.textContent = String(total);
    elements.currentAdmissionsCount.textContent = String(current);
    elements.supersededAdmissionsCount.textContent = String(superseded);
    elements.archivedAdmissionsCount.textContent = String(archived);
    elements.currentCountLabel.textContent = current + (current === 1 ? " ficha" : " fichas");
    elements.supersededCountLabel.textContent = superseded + (superseded === 1 ? " ficha" : " fichas");
    elements.archivedCountLabel.textContent = archived + (archived === 1 ? " ficha" : " fichas");

    renderAllSections(db);
    setActiveStage(activeStage);
  }

  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  setActiveStage(activeStage);
  elements.themeToggleBtn.onclick = function () {
    applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
  };
  elements.homeLink.onclick = function (event) {
    event.preventDefault();
    window.location.assign(window.location.origin + "/?tab=systems");
  };
  elements.rhHomeLink.onclick = function (event) {
    event.preventDefault();
    window.location.assign(window.location.origin + "/recursos-humanos/");
  };
  elements.stageTabs.forEach(function (button) {
    button.onclick = function () {
      setActiveStage(button.dataset.admissionStageTab);
    };
  });
  ADMISSION_STAGES.forEach(function (stage) {
    var section = sectionElements(stage.value);
    section.input.oninput = function () {
      renderSection(stage.value, initializeFirebase());
    };
  });

  loadAdmissions().catch(function (error) {
    console.error(error);
    resetCounts("Falha");
    ADMISSION_STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", "Nao foi possivel carregar as fichas de admissao.");
    });
  });
})();
