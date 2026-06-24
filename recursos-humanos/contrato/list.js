(function () {
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var THEME_KEY = "tka_theme";
  var COLLECTION_NAME = "rh_contract_packets";
  var CONTRACT_STAGES = [
    { value: "current", label: "Vigentes", empty: "Nenhum contrato vigente encontrado." },
    { value: "archived", label: "Superados", empty: "Nenhum contrato superado encontrado." }
  ];
  var COMMERCIAL_EMAILS = {
    "comercial@grupotka.com.br": true,
    "comercial@grupotka": true
  };
  var ownerSignatureDataUrl = "";
  var cachedRecords = [];
  var currentPortalUser = null;
  var firestoreDb = null;
  var activeStage = "current";

  var elements = {
    homeLink: document.getElementById("homeLink"),
    rhHomeLink: document.getElementById("rhHomeLink"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    accessMessage: document.getElementById("accessMessage"),
    stageTabs: [].slice.call(document.querySelectorAll("[data-contract-stage-tab]")),
    stagePanels: [].slice.call(document.querySelectorAll("[data-contract-stage-panel]")),
    currentSearchInput: document.getElementById("currentSearchInput"),
    archivedSearchInput: document.getElementById("archivedSearchInput"),
    currentList: document.getElementById("currentContractList"),
    archivedList: document.getElementById("archivedContractList"),
    currentCountLabel: document.getElementById("currentCountLabel"),
    archivedCountLabel: document.getElementById("archivedCountLabel"),
    totalContractsCount: document.getElementById("totalContractsCount"),
    currentContractsCount: document.getElementById("currentContractsCount"),
    archivedContractsCount: document.getElementById("archivedContractsCount")
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

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isCommercialEmail(email) {
    return Boolean(COMMERCIAL_EMAILS[normalizeEmail(email)]);
  }

  function readGateEmail() {
    return normalizeEmail(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY));
  }

  function hasRhAccess() {
    currentPortalUser = readPortalUser();
    if (currentPortalUser) {
      var permissions = currentPortalUser.permissions || {};
      var portalEmail = normalizeEmail(currentPortalUser.email || currentPortalUser.user || currentPortalUser.login);
      if (permissions.rh || permissions.admin || permissions.comercial || permissions.commercial || isCommercialEmail(portalEmail)) return true;
    }
    var email = readGateEmail();
    var gate = window.RH_GATE || {};
    return Boolean(email && gate.users && gate.users[email]);
  }

  function initializeFirebase() {
    if (firestoreDb) return firestoreDb;
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) {
      throw new Error("Configuracao Firebase nao encontrada.");
    }
    if (!firebase.apps.length) firebase.initializeApp(config);
    firestoreDb = firebase.firestore();
    return firestoreDb;
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
  }

  function formatDate(value) {
    return window.TKAContractTemplate.shortDateTime(value) || "Sem data";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findStage(value) {
    return CONTRACT_STAGES.find(function (item) { return item.value === value; }) || null;
  }

  function normalizeStage(meta) {
    var explicitStage = meta && meta.contractStage;
    if (findStage(explicitStage)) return explicitStage;
    return meta && meta.archived ? "archived" : "current";
  }

  function stageLabel(value) {
    var stage = findStage(value);
    return stage ? stage.label : "Vigentes";
  }

  function normalizeRecordMeta(record) {
    record.meta = record.meta || {};
    record.meta.contractStage = normalizeStage(record.meta);
    record.meta.archived = record.meta.contractStage === "archived";
  }

  function stageValue(record) {
    return normalizeStage(record.state.meta || {});
  }

  function optionMarkup(options, selectedValue) {
    return options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (option.value === selectedValue ? " selected" : "") + ">"
        + escapeHtml(option.label)
        + "</option>";
    }).join("");
  }

  function sectionElements(stage) {
    if (stage === "current") {
      return {
        list: elements.currentList,
        input: elements.currentSearchInput,
        countLabel: elements.currentCountLabel
      };
    }
    if (stage === "archived") {
      return {
        list: elements.archivedList,
        input: elements.archivedSearchInput,
        countLabel: elements.archivedCountLabel
      };
    }
    return {
      list: elements.currentList,
      input: elements.currentSearchInput,
      countLabel: elements.currentCountLabel
    };
  }

  function mergeRecords(docs) {
    var map = {};
    docs.forEach(function (doc) {
      map[doc.id] = doc.data() || {};
    });

    return (window.TKAContractSamples || []).map(function (sample) {
      var stored = map[sample.id] || {};
      var record = window.TKAContractTemplate.normalizeState(sample, stored.data || {});
      normalizeRecordMeta(record);
      record.meta.updatedAt = stored.updatedAt || stored.createdAt || null;
      record.meta.createdAt = stored.createdAt || null;
      record.meta.formId = sample.id;
      return {
        sample: sample,
        state: record
      };
    });
  }

  function sortRecords(records) {
    return records.sort(function (a, b) {
      var aName = String(a.sample.employeeName || "").toLowerCase();
      var bName = String(b.sample.employeeName || "").toLowerCase();
      return aName.localeCompare(bName, "pt-BR");
    });
  }

  function counts(records) {
    return {
      total: records.length,
      current: records.filter(function (item) { return stageValue(item) === "current"; }).length,
      archived: records.filter(function (item) { return stageValue(item) === "archived"; }).length
    };
  }

  function stageControlMarkup(sample, stage) {
    return ''
      + '<label class="contract-control-label">Mover contrato'
      + '  <select data-stage-move="' + escapeHtml(sample.id) + '">'
      + optionMarkup(CONTRACT_STAGES, stage)
      + "  </select>"
      + "</label>";
  }

  function cardMarkup(record) {
    var sample = record.sample;
    var state = record.state;
    var stage = stageValue(record);
    var status = window.TKAContractTemplate.statusLabel(state, ownerSignatureDataUrl);
    var isComplete = window.TKAContractTemplate.isComplete(state, ownerSignatureDataUrl);
    var updatedAt = formatDate(state.meta.updatedAt);
    var completionStatus = window.TKAContractTemplate.summaryIssues(state, ownerSignatureDataUrl);

    return ''
      + '<article class="contract-card" data-contract-id="' + escapeHtml(sample.id) + '">'
      + '  <div class="contract-card-media"><img src="' + escapeHtml(sample.thumbnailUrl) + '" alt="Capa do contrato de ' + escapeHtml(sample.employeeName) + '" /></div>'
      + '  <div class="contract-card-body">'
      + '    <div class="contract-card-head">'
      + '      <div>'
      + '        <h2>' + escapeHtml(sample.employeeName) + "</h2>"
      + '        <p class="muted">' + escapeHtml(sample.role || "Sem funcao") + " | " + escapeHtml(sample.companyName || "Sem empresa") + "</p>"
      + "      </div>"
      + '      <div class="chip-row">'
      + '        <span class="chip">' + escapeHtml(stageLabel(stage)) + "</span>"
      + '        <span class="chip">' + escapeHtml(status) + "</span>"
      + '        <span class="chip ' + (isComplete ? "is-ready" : "is-pending") + '">' + escapeHtml(isComplete ? "Concluido" : "Aguardando colaborador") + "</span>"
      + "      </div>"
      + "    </div>"
      + '    <div class="meta-grid compact">'
      + '      <div class="meta-item"><strong>CPF</strong><span>' + escapeHtml(sample.cpf || "Nao informado") + "</span></div>"
      + '      <div class="meta-item"><strong>Admissao</strong><span>' + escapeHtml(sample.admissionDate || "Nao informada") + "</span></div>"
      + '      <div class="meta-item"><strong>Ultima atualizacao</strong><span>' + escapeHtml(updatedAt) + "</span></div>"
      + '      <div class="meta-item meta-item-wide"><strong>Status do preenchimento</strong><span>' + escapeHtml(completionStatus) + "</span></div>"
      + "    </div>"
      + '    <div class="contract-controls">'
      + stageControlMarkup(sample, stage)
      + "    </div>"
      + '    <div class="record-actions">'
      + '      <a class="button" href="/recursos-humanos/contrato/editor?id=' + encodeURIComponent(sample.id) + '&admin=1">Abrir no RH</a>'
      + '      <a class="button secondary" href="/recursos-humanos/contrato/editor?id=' + encodeURIComponent(sample.id) + '" target="_blank" rel="noreferrer">Link publico</a>'
      + '      <button class="button secondary" type="button" data-export="' + escapeHtml(sample.id) + '"' + (isComplete ? "" : " disabled") + '>Exportar PDF</button>'
      + "    </div>"
      + "  </div>"
      + "</article>";
  }

  function matchesSearch(record, query) {
    if (!query) return true;
    var sample = record.sample;
    var issueText = window.TKAContractTemplate.summaryIssues(record.state, ownerSignatureDataUrl);
    var haystack = [
      sample.employeeName,
      sample.role,
      sample.companyName,
      sample.cpf,
      issueText,
      stageLabel(stageValue(record))
    ].join(" ").toLowerCase();
    return haystack.indexOf(query) >= 0;
  }

  function saveContractMeta(db, id, updater, errorMessage) {
    var record = cachedRecords.find(function (item) { return item.sample.id === id; });
    var sample = record ? record.sample : window.TKAContractTemplate.findSample(id);
    if (!sample) return Promise.resolve();
    var state = record ? record.state : window.TKAContractTemplate.buildDefaultState(sample);
    if (!state) return Promise.resolve();
    state.meta = state.meta || {};
    updater(state.meta);
    normalizeRecordMeta(state);
    var payload = {
      data: state,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection(COLLECTION_NAME).doc(id).set(payload, { merge: true }).then(function () {
      return loadContracts();
    }).catch(function (error) {
      console.error(error);
      window.alert(errorMessage || "Nao foi possivel atualizar o contrato.");
      return loadContracts();
    });
  }

  function bindActions(container, db) {
    container.querySelectorAll("[data-export]").forEach(function (button) {
      button.onclick = function () {
        var id = button.dataset.export;
        var record = cachedRecords.find(function (item) { return item.sample.id === id; });
        if (!record) return;
        window.TKAContractPdf.download(record.sample, record.state, ownerSignatureDataUrl).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel gerar o PDF agora.");
        });
      };
    });

    container.querySelectorAll("[data-stage-move]").forEach(function (select) {
      select.onchange = function () {
        var id = select.dataset.stageMove;
        var nextStage = findStage(select.value) ? select.value : "current";
        select.disabled = true;
        saveContractMeta(db, id, function (meta) {
          meta.contractStage = nextStage;
          meta.archived = nextStage === "archived";
        }, "Nao foi possivel mover o contrato.");
      };
    });
  }

  function renderSection(stage, db) {
    var section = sectionElements(stage);
    var query = String(section.input.value || "").trim().toLowerCase();
    var rows = cachedRecords.filter(function (item) {
      return stageValue(item) === stage && matchesSearch(item, query);
    });

    if (!rows.length) {
      renderMessage(section.list, "empty-state", (findStage(stage) || {}).empty || "Nenhum contrato encontrado.");
      return;
    }

    section.list.innerHTML = rows.map(cardMarkup).join("");
    bindActions(section.list, db);
  }

  function renderAllSections(db) {
    CONTRACT_STAGES.forEach(function (stage) {
      renderSection(stage.value, db);
    });
  }

  function setActiveStage(stage) {
    activeStage = findStage(stage) ? stage : "current";
    elements.stageTabs.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.contractStageTab === activeStage);
      button.setAttribute("aria-selected", button.dataset.contractStageTab === activeStage ? "true" : "false");
    });
    elements.stagePanels.forEach(function (panel) {
      panel.classList.toggle("hidden", panel.dataset.contractStagePanel !== activeStage);
    });
  }

  async function loadOwnerSignature(db) {
    var snapshot = await db.collection("system").doc("ownerSignature").get();
    var data = snapshot.data() || {};
    ownerSignatureDataUrl = String(data.signatureDataUrl || "").trim();
  }

  function renderAccessDenied() {
    elements.accessMessage.textContent = "Acesso restrito ao RH, Comercial e Admin.";
    CONTRACT_STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", "Este painel exige permissao de RH, Comercial ou Admin no portal.");
    });
  }

  async function loadContracts() {
    if (!hasRhAccess()) {
      renderAccessDenied();
      return;
    }

    var db = initializeFirebase();
    await loadOwnerSignature(db);
    elements.accessMessage.textContent = ownerSignatureDataUrl
      ? "Assinatura da direcao carregada. Contratos prontos para revisao."
      : "Cadastre a assinatura da direcao no Admin para liberar os contratos completos.";

    var snapshot = await db.collection(COLLECTION_NAME).get();
    cachedRecords = sortRecords(mergeRecords(snapshot.docs));
    var summary = counts(cachedRecords);
    elements.totalContractsCount.textContent = String(summary.total);
    elements.currentContractsCount.textContent = String(summary.current);
    elements.archivedContractsCount.textContent = String(summary.archived);
    elements.currentCountLabel.textContent = String(summary.current) + " contratos";
    elements.archivedCountLabel.textContent = String(summary.archived) + " contratos";

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
      setActiveStage(button.dataset.contractStageTab);
    };
  });
  elements.currentSearchInput.oninput = function () {
    renderSection("current", initializeFirebase());
  };
  elements.archivedSearchInput.oninput = function () {
    renderSection("archived", initializeFirebase());
  };

  loadContracts().catch(function (error) {
    console.error(error);
    CONTRACT_STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", "Nao foi possivel carregar os contratos.");
    });
  });
})();
