(function () {
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var THEME_KEY = "tka_theme";
  var template = window.TKAServiceOrderTemplate;
  var COLLECTION_NAME = template.COLLECTION_NAME;
  var STAGES = template.STAGES;
  var SERVICE_ORDER_ACCESS_EMAILS = {
    "rh@grupotka.com.br": true,
    "rh@grupotka": true,
    "supervisao@grupotka.com.br": true,
    "supervisao@grupotka": true,
    "coordenacao@grupotka.com.br": true,
    "coordenacao@grupotka": true,
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
    createOrderBtn: document.getElementById("createOrderBtn"),
    linkResult: document.getElementById("linkResult"),
    linkOutput: document.getElementById("linkOutput"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    openLinkBtn: document.getElementById("openLinkBtn"),
    stageTabs: [].slice.call(document.querySelectorAll("[data-stage-tab]")),
    stagePanels: [].slice.call(document.querySelectorAll("[data-stage-panel]")),
    currentSearchInput: document.getElementById("currentSearchInput"),
    supersededSearchInput: document.getElementById("supersededSearchInput"),
    archivedSearchInput: document.getElementById("archivedSearchInput"),
    currentList: document.getElementById("currentOrderList"),
    supersededList: document.getElementById("supersededOrderList"),
    archivedList: document.getElementById("archivedOrderList"),
    currentCountLabel: document.getElementById("currentCountLabel"),
    supersededCountLabel: document.getElementById("supersededCountLabel"),
    archivedCountLabel: document.getElementById("archivedCountLabel"),
    totalOrdersCount: document.getElementById("totalOrdersCount"),
    currentOrdersCount: document.getElementById("currentOrdersCount"),
    supersededOrdersCount: document.getElementById("supersededOrdersCount"),
    archivedOrdersCount: document.getElementById("archivedOrdersCount")
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

  function normalizeAccessValue(value) {
    return normalizeEmail(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function hasPortalServiceOrderAccess(portalUser) {
    if (!portalUser) return false;
    var permissions = portalUser.permissions || {};
    var portalEmail = normalizeAccessValue(portalUser.email || portalUser.user || portalUser.login);
    var sector = normalizeAccessValue(portalUser.sector || portalUser.department || portalUser.role);
    return Boolean(
      permissions.rh ||
      permissions.admin ||
      permissions.comercial ||
      permissions.commercial ||
      permissions.coordenacao ||
      permissions.coordination ||
      permissions.supervisao ||
      permissions.supervision ||
      SERVICE_ORDER_ACCESS_EMAILS[portalEmail] ||
      sector === "rh" ||
      sector === "recursos-humanos" ||
      sector === "coordenacao" ||
      sector === "supervisao" ||
      sector === "comercial" ||
      sector === "admin" ||
      sector === "administrativo"
    );
  }

  function hasRhAccess() {
    currentPortalUser = readPortalUser();
    if (hasPortalServiceOrderAccess(currentPortalUser)) return true;
    var email = normalizeAccessValue(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY));
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
  }

  function sectionElements(stage) {
    if (stage === "superseded") {
      return {
        list: elements.supersededList,
        input: elements.supersededSearchInput,
        countLabel: elements.supersededCountLabel
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

  function optionMarkup(options, selectedValue) {
    return options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (option.value === selectedValue ? " selected" : "") + ">"
        + escapeHtml(option.label)
        + "</option>";
    }).join("");
  }

  function stageValue(record) {
    return template.normalizeStage(record.state.meta || {});
  }

  function counts(records) {
    return {
      total: records.length,
      current: records.filter(function (item) { return stageValue(item) === "current"; }).length,
      superseded: records.filter(function (item) { return stageValue(item) === "superseded"; }).length,
      archived: records.filter(function (item) { return stageValue(item) === "archived"; }).length
    };
  }

  function publicLinkFor(record) {
    return template.text(record.state.meta.publicLink) || template.buildPublicLink(record.id);
  }

  function cardMarkup(record) {
    var state = record.state;
    var documentData = state.document || {};
    var stage = stageValue(record);
    var publicLink = publicLinkFor(record);
    var status = template.statusLabel(state, ownerSignatureDataUrl);
    var complete = template.isComplete(state, ownerSignatureDataUrl);
    var updatedAt = template.shortDateTime(record.updatedAt || record.createdAt || state.meta.updatedAt || state.meta.createdAt) || "Sem data";

    var deleteAction = record.builtIn
      ? ""
      : '<button class="button danger" type="button" data-delete="' + escapeHtml(record.id) + '">Arquivar</button>';

    return ''
      + '<article class="record-card" data-order-id="' + escapeHtml(record.id) + '">'
      + '  <div class="record-card-head">'
      + "    <div>"
      + "      <h2>" + escapeHtml(documentData.employeeName || "Ordem sem nome") + "</h2>"
      + '      <p class="muted">' + escapeHtml([documentData.employeeRole, documentData.sector].filter(Boolean).join(" | ") || "Sem setor informado") + "</p>"
      + "    </div>"
      + '    <div class="chip-row">'
      + '      <span class="chip">' + escapeHtml(template.stageLabel(stage)) + "</span>"
      + '      <span class="chip">' + escapeHtml(status) + "</span>"
      + '      <span class="chip ' + (complete ? "is-ready" : "is-pending") + '">' + escapeHtml(complete ? "Concluido" : "Pendente") + "</span>"
      + "    </div>"
      + "  </div>"
      + '  <div class="meta-grid">'
      + '    <div class="meta-item"><strong>Ultima atualizacao</strong><span>' + escapeHtml(updatedAt) + "</span></div>"
      + '    <div class="meta-item"><strong>Revisao</strong><span>' + escapeHtml(template.dateLabel(documentData.revisionDate) || "Nao informada") + "</span></div>"
      + '    <div class="meta-item"><strong>Status do preenchimento</strong><span>' + escapeHtml(template.summaryIssues(state, ownerSignatureDataUrl)) + "</span></div>"
      + '    <div class="meta-item"><strong>Link publico</strong><span>' + escapeHtml(publicLink) + "</span></div>"
      + "  </div>"
      + '  <div class="record-controls">'
      + '    <label>Mover ordem'
      + '      <select data-stage-move="' + escapeHtml(record.id) + '">'
      + optionMarkup(STAGES, stage)
      + "      </select>"
      + "    </label>"
      + "  </div>"
      + '  <div class="record-actions">'
      + '    <a class="button" href="/recursos-humanos/ordem-servico/editor.html?id=' + encodeURIComponent(record.id) + '&admin=1">Abrir no RH</a>'
      + '    <a class="button secondary" href="' + escapeHtml(publicLink) + '" target="_blank" rel="noreferrer">Link publico</a>'
      + '    <button class="button secondary" type="button" data-copy-link="' + escapeHtml(publicLink) + '">Copiar link</button>'
      + '    <button class="button secondary" type="button" data-export="' + escapeHtml(record.id) + '"' + (complete ? "" : " disabled") + '>Exportar PDF</button>'
      + deleteAction
      + "  </div>"
      + "</article>";
  }

  function sortRecords(records) {
    return records.sort(function (a, b) {
      var aUpdated = a.updatedAt && typeof a.updatedAt.toDate === "function" ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || 0).getTime();
      var bUpdated = b.updatedAt && typeof b.updatedAt.toDate === "function" ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || 0).getTime();
      return bUpdated - aUpdated;
    });
  }

  function mergeRecords(docs) {
    var storedMap = {};
    docs.forEach(function (doc) {
      storedMap[doc.id] = doc.data() || {};
    });

    var builtIns = (template.builtInServiceOrders && template.builtInServiceOrders()) || [];
    var builtInIds = {};
    var records = builtIns.map(function (builtIn) {
      builtInIds[builtIn.id] = true;
      var stored = storedMap[builtIn.id] || null;
      var incoming = stored && stored.data ? stored.data : builtIn.state;
      var publicLink = incoming && incoming.meta && incoming.meta.publicLink || template.buildPublicLink(builtIn.id);
      return {
        id: builtIn.id,
        state: template.normalizeState(incoming, builtIn.id, publicLink),
        createdAt: stored && stored.createdAt || builtIn.createdAt,
        updatedAt: stored && stored.updatedAt || builtIn.updatedAt,
        builtIn: true
      };
    });

    docs.forEach(function (doc) {
      if (builtInIds[doc.id]) return;
      var stored = doc.data() || {};
      var publicLink = stored.data && stored.data.meta && stored.data.meta.publicLink || template.buildPublicLink(doc.id);
      records.push({
        id: doc.id,
        state: template.normalizeState(stored.data || {}, doc.id, publicLink),
        createdAt: stored.createdAt || null,
        updatedAt: stored.updatedAt || null
      });
    });
    return records;
  }

  function matchesSearch(record, query) {
    if (!query) return true;
    return template.searchableText(record.state, ownerSignatureDataUrl).indexOf(query) >= 0;
  }

  async function loadOwnerSignature(db) {
    var snapshot = await db.collection("system").doc("ownerSignature").get();
    var data = snapshot.data() || {};
    ownerSignatureDataUrl = template.text(data.signatureDataUrl);
  }

  async function saveOrderStage(db, id, nextStage) {
    var record = cachedRecords.find(function (item) { return item.id === id; });
    if (!record) return;
    var state = template.clone(record.state);
    state.meta.serviceOrderStage = template.findStage(nextStage) ? nextStage : "current";
    state.meta.archived = state.meta.serviceOrderStage === "archived";
    await db.collection(COLLECTION_NAME).doc(id).set({
      data: template.stateForCloud(state),
      archived: state.meta.archived,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await loadOrders();
  }

  async function deleteOrder(db, id) {
    var ok = window.confirm("Arquivar esta ordem de servico? Ela permanecera preservada em Arquivados.");
    if (!ok) return;
    var record = cachedRecords.find(function (item) { return item.id === id; });
    var state = record ? template.clone(record.state) : template.createDefaultState(id, template.buildPublicLink(id));
    state.meta.serviceOrderStage = "archived";
    state.meta.archived = true;
    state.meta.archivedAt = new Date().toISOString();
    state.meta.archivedBy = currentPortalUser && currentPortalUser.email || normalizeEmail(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY)) || "portal-rh";
    await db.collection(COLLECTION_NAME).doc(id).set({
      data: template.stateForCloud(state),
      archived: true,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archivedBy: state.meta.archivedBy,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await loadOrders();
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    var input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function showCreatedLink(link) {
    elements.linkOutput.value = link;
    elements.openLinkBtn.href = link;
    elements.linkResult.classList.remove("hidden");
  }

  async function createOrderLink(db) {
    elements.createOrderBtn.disabled = true;
    elements.accessMessage.textContent = "Criando ordem de servico...";
    try {
      var docRef = db.collection(COLLECTION_NAME).doc();
      var publicLink = template.buildPublicLink(docRef.id);
      var state = template.createDefaultState(docRef.id, publicLink);
      var user = currentPortalUser || {};
      await docRef.set({
        source: "rh-service-order-public-link",
        createdBy: user.email || "desconhecido",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        archived: false,
        data: template.stateForCloud(state)
      });
      showCreatedLink(publicLink);
      await loadOrders();
      elements.accessMessage.textContent = ownerSignatureDataUrl
        ? "Ordem criada. Envie o link publico para assinatura do colaborador."
        : "Ordem criada. Cadastre a assinatura da direcao no Admin para completar o documento.";
    } finally {
      elements.createOrderBtn.disabled = false;
    }
  }

  function bindActions(container, db) {
    container.querySelectorAll("[data-stage-move]").forEach(function (select) {
      select.onchange = function () {
        select.disabled = true;
        saveOrderStage(db, select.dataset.stageMove, select.value).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel mover a ordem.");
          loadOrders();
        });
      };
    });

    container.querySelectorAll("[data-export]").forEach(function (button) {
      button.onclick = function () {
        var id = button.dataset.export;
        var record = cachedRecords.find(function (item) { return item.id === id; });
        if (!record) return;
        window.TKAServiceOrderPdf.download(record.state, ownerSignatureDataUrl).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel gerar o PDF agora.");
        });
      };
    });

    container.querySelectorAll("[data-copy-link]").forEach(function (button) {
      button.onclick = function () {
        copyText(button.dataset.copyLink).catch(function () {
          window.alert("Nao foi possivel copiar o link.");
        });
      };
    });

    container.querySelectorAll("[data-delete]").forEach(function (button) {
      button.onclick = function () {
        deleteOrder(db, button.dataset.delete).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel excluir a ordem.");
        });
      };
    });
  }

  function renderSection(stage, db) {
    var section = sectionElements(stage);
    var stageConfig = template.findStage(stage) || STAGES[0];
    var query = String(section.input.value || "").trim().toLowerCase();
    var rows = cachedRecords.filter(function (item) {
      return stageValue(item) === stage && matchesSearch(item, query);
    });

    if (!rows.length) {
      renderMessage(section.list, "empty-state", query ? "Nenhuma ordem encontrada para essa busca." : stageConfig.empty);
      return;
    }

    section.list.innerHTML = rows.map(cardMarkup).join("");
    bindActions(section.list, db);
  }

  function renderAllSections(db) {
    STAGES.forEach(function (stage) {
      renderSection(stage.value, db);
    });
  }

  function setActiveStage(stage) {
    activeStage = template.findStage(stage) ? stage : "current";
    elements.stageTabs.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.stageTab === activeStage);
      button.setAttribute("aria-selected", button.dataset.stageTab === activeStage ? "true" : "false");
    });
    elements.stagePanels.forEach(function (panel) {
      panel.classList.toggle("hidden", panel.dataset.stagePanel !== activeStage);
    });
  }

  function resetCounts(label) {
    var summaryValue = label ? "-" : "0";
    elements.totalOrdersCount.textContent = summaryValue;
    elements.currentOrdersCount.textContent = summaryValue;
    elements.supersededOrdersCount.textContent = summaryValue;
    elements.archivedOrdersCount.textContent = summaryValue;
    STAGES.forEach(function (stage) {
      sectionElements(stage.value).countLabel.textContent = label || "0 ordens";
    });
  }

  function renderAccessDenied() {
    resetCounts("Sem permissao");
    elements.createOrderBtn.disabled = true;
    elements.accessMessage.textContent = "Acesso restrito ao RH, Comercial e Admin.";
    STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", "Este painel exige permissao de RH, Comercial ou Admin no portal.");
    });
  }

  async function loadOrders() {
    if (!hasRhAccess()) {
      renderAccessDenied();
      return;
    }

    var db = initializeFirebase();
    await loadOwnerSignature(db);
    elements.createOrderBtn.disabled = false;
    elements.accessMessage.textContent = ownerSignatureDataUrl
      ? "Assinatura da direcao carregada. Ordens prontas para assinatura publica."
      : "Cadastre a assinatura da direcao no Admin para liberar ordens completas.";

    var snapshot = await db.collection(COLLECTION_NAME).get();
    cachedRecords = sortRecords(mergeRecords(snapshot.docs));
    var summary = counts(cachedRecords);
    elements.totalOrdersCount.textContent = String(summary.total);
    elements.currentOrdersCount.textContent = String(summary.current);
    elements.supersededOrdersCount.textContent = String(summary.superseded);
    elements.archivedOrdersCount.textContent = String(summary.archived);
    elements.currentCountLabel.textContent = summary.current + (summary.current === 1 ? " ordem" : " ordens");
    elements.supersededCountLabel.textContent = summary.superseded + (summary.superseded === 1 ? " ordem" : " ordens");
    elements.archivedCountLabel.textContent = summary.archived + (summary.archived === 1 ? " ordem" : " ordens");

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
  elements.createOrderBtn.onclick = function () {
    createOrderLink(initializeFirebase()).catch(function (error) {
      console.error(error);
      elements.accessMessage.textContent = "Nao foi possivel criar o link publico.";
      elements.createOrderBtn.disabled = false;
    });
  };
  elements.copyLinkBtn.onclick = function () {
    copyText(elements.linkOutput.value).catch(function () {
      window.alert("Nao foi possivel copiar o link.");
    });
  };
  elements.stageTabs.forEach(function (button) {
    button.onclick = function () {
      setActiveStage(button.dataset.stageTab);
    };
  });
  STAGES.forEach(function (stage) {
    var section = sectionElements(stage.value);
    section.input.oninput = function () {
      renderSection(stage.value, initializeFirebase());
    };
  });

  loadOrders().catch(function (error) {
    console.error(error);
    resetCounts("Falha");
    STAGES.forEach(function (stage) {
      renderMessage(sectionElements(stage.value).list, "error-state", "Nao foi possivel carregar as ordens de servico.");
    });
  });
})();
