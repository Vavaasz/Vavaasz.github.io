(function () {
  var template = window.TKAVehicleTermTemplate;
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var MANUAL_USER_SUGGESTIONS = [
    "Terrazo - Ronda",
    "Ruda - Ronda"
  ];
  var db = null;
  var state = {
    currentUser: null,
    users: [],
    equipment: [],
    terms: [],
    currentTab: "equipamentos",
    companySignatureDataUrl: "",
    companySignatureUpdatedAt: ""
  };

  var el = {
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    accessMessage: document.getElementById("accessMessage"),
    equipmentCount: document.getElementById("equipmentCount"),
    activeTermsCount: document.getElementById("activeTermsCount"),
    completeTermsCount: document.getElementById("completeTermsCount"),
    incompleteTermsCount: document.getElementById("incompleteTermsCount"),
    archivedTermsCount: document.getElementById("archivedTermsCount"),
    equipmentForm: document.getElementById("equipmentForm"),
    equipmentId: document.getElementById("equipmentId"),
    deviceBrand: document.getElementById("deviceBrand"),
    deviceModel: document.getElementById("deviceModel"),
    assetTag: document.getElementById("assetTag"),
    serialNumber: document.getElementById("serialNumber"),
    internalId: document.getElementById("internalId"),
    deviceCondition: document.getElementById("deviceCondition"),
    accessoriesDelivered: document.getElementById("accessoriesDelivered"),
    conditionNotes: document.getElementById("conditionNotes"),
    dashboardManualOpenLink: document.getElementById("dashboardManualOpenLink"),
    dashboardManualDownloadLink: document.getElementById("dashboardManualDownloadLink"),
    clearEquipmentBtn: document.getElementById("clearEquipmentBtn"),
    equipmentSearchInput: document.getElementById("equipmentSearchInput"),
    equipmentList: document.getElementById("equipmentList"),
    termForm: document.getElementById("termForm"),
    assignedUserEmail: document.getElementById("assignedUserEmail"),
    assignedUserOptions: document.getElementById("assignedUserOptions"),
    equipmentSelect: document.getElementById("equipmentSelect"),
    linkResult: document.getElementById("linkResult"),
    linkOutput: document.getElementById("linkOutput"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    openLinkBtn: document.getElementById("openLinkBtn"),
    activeSearchInput: document.getElementById("activeSearchInput"),
    archivedSearchInput: document.getElementById("archivedSearchInput"),
    incompleteCountLabel: document.getElementById("incompleteCountLabel"),
    completeCountLabel: document.getElementById("completeCountLabel"),
    incompleteTermList: document.getElementById("incompleteTermList"),
    completeTermList: document.getElementById("completeTermList"),
    archivedTermList: document.getElementById("archivedTermList")
  };

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

  function escapeHtml(value) {
    return template.escapeHtml(value);
  }

  function dateFromValue(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    var raw = String(value);
    var parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T00:00:00" : raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    var date = dateFromValue(value);
    return date ? date.toLocaleDateString("pt-BR") : "Data pendente";
  }

  function formatDateTime(value) {
    var date = dateFromValue(value);
    return date ? date.toLocaleString("pt-BR") : "Sem data";
  }

  function cloudTimestampLabel(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return template.text(value);
  }

  function withCurrentCompanySignature(term) {
    var data = template.normalizeTerm(term || {});
    if (!data.companySignatureDataUrl) {
      data.companySignatureDataUrl = state.companySignatureDataUrl;
      data.companySignatureUpdatedAt = state.companySignatureUpdatedAt;
    }
    data.companySignerName = data.companySignerName || template.DEFAULT_COMPANY_SIGNER_NAME;
    return template.normalizeTerm(data);
  }

  function sortByUpdated(a, b) {
    var aDate = dateFromValue(a.updatedAt || a.createdAt) || new Date(0);
    var bDate = dateFromValue(b.updatedAt || b.createdAt) || new Date(0);
    return bDate.getTime() - aDate.getTime();
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function showCreatedLink(link) {
    el.linkResult.classList.remove("hidden");
    el.linkOutput.value = link;
    el.openLinkBtn.href = link;
  }

  function displayNameFromEmail(email) {
    return String(email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function createMetaItem(label, value) {
    return '<div class="meta-item"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(value || "-") + "</span></div>";
  }

  function empty(container, message, className) {
    container.innerHTML = '<div class="' + (className || "empty-state") + '">' + escapeHtml(message) + "</div>";
  }

  function readEquipmentForm() {
    return template.normalizeEquipment({
      id: el.equipmentId.value || template.newId(el.assetTag.value || "veiculo"),
      deviceBrand: el.deviceBrand.value,
      deviceModel: el.deviceModel.value,
      assetTag: el.assetTag.value,
      serialNumber: el.serialNumber.value,
      internalId: el.internalId.value,
      deviceCondition: el.deviceCondition.value,
      accessoriesDelivered: el.accessoriesDelivered.value,
      conditionNotes: el.conditionNotes.value
    });
  }

  function fillEquipmentForm(equipment) {
    var data = template.normalizeEquipment(equipment || {});
    el.equipmentId.value = data.id || "";
    el.deviceBrand.value = data.deviceBrand || "";
    el.deviceModel.value = data.deviceModel || "";
    el.assetTag.value = data.assetTag || "";
    el.serialNumber.value = data.serialNumber || "";
    el.internalId.value = data.internalId || data.imeiOrSimNumber || "";
    el.deviceCondition.value = data.deviceCondition || "Apto para uso";
    el.accessoriesDelivered.value = template.accessoriesLabel(data.accessoriesDelivered);
    el.conditionNotes.value = data.conditionNotes || "";
  }

  function clearEquipmentForm() {
    fillEquipmentForm(template.createDefaultEquipment(""));
  }

  function validateEquipment(equipment) {
    var missing = [];
    if (!equipment.deviceBrand) missing.push("marca");
    if (!equipment.deviceModel) missing.push("modelo");
    if (!equipment.assetTag) missing.push("placa");
    if (!equipment.serialNumber) missing.push("prefixo/frota");
    if (!equipment.deviceCondition) missing.push("condicao");
    return missing;
  }

  function writeAuditLog(action, targetId, summary, previousValue, nextValue) {
    if (!db) return Promise.resolve();
    return db.collection("portal_audit_logs").add({
      action: action,
      actionLabel: action === "archive" ? "Arquivamento" : action === "restore" ? "Reativacao" : action === "sign" ? "Assinatura" : action === "update" ? "Edicao" : "Inclusao",
      actorEmail: state.currentUser && state.currentUser.email || "sistema",
      targetEmail: targetId || "",
      summary: summary || "",
      previousValue: previousValue || null,
      nextValue: nextValue || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (error) {
      console.warn("Nao foi possivel registrar auditoria.", error);
    });
  }

  function saveEquipment(event) {
    event.preventDefault();
    if (!canAccess()) return;
    var equipment = readEquipmentForm();
    var missing = validateEquipment(equipment);
    if (missing.length) {
      window.alert("Preencha: " + missing.join(", ") + ".");
      return;
    }
    var existing = state.equipment.find(function (item) { return item.id === equipment.id; }) || null;
    var now = new Date().toISOString();
    var payload = Object.assign({}, equipment, {
      updatedAt: now,
      updatedBy: state.currentUser.email || ""
    });
    if (!existing) {
      payload.createdAt = now;
      payload.createdBy = state.currentUser.email || "";
    }
    db.collection(template.EQUIPMENT_COLLECTION).doc(equipment.id).set(payload, { merge: true }).then(function () {
      clearEquipmentForm();
      writeAuditLog(existing ? "update" : "create", equipment.assetTag || equipment.id, "Veiculo salvo.", existing, payload);
    }).catch(function (error) {
      console.error(error);
      window.alert("Nao foi possivel salvar o veiculo.");
    });
  }

  function buildEquipmentCard(equipment) {
    return ''
      + '<article class="record-card" data-equipment-id="' + escapeHtml(equipment.id) + '">'
      + '  <div class="record-card-head">'
      + '    <div><h2>' + escapeHtml([equipment.deviceBrand, equipment.deviceModel].filter(Boolean).join(" ") || "Veiculo") + '</h2>'
      + '    <p class="muted">Placa ' + escapeHtml(equipment.assetTag || "-") + ' | Prefixo/frota ' + escapeHtml(equipment.serialNumber || "-") + '</p></div>'
      + '    <div class="chip-row"><span class="chip">' + escapeHtml(equipment.active ? "Ativa" : "Inativa") + "</span></div>"
      + "  </div>"
      + '  <div class="meta-grid">'
      + createMetaItem("Renavam/Chassi", equipment.internalId || equipment.imeiOrSimNumber || "Nao informado")
      + createMetaItem("Itens", template.accessoriesLabel(equipment.accessoriesDelivered))
      + createMetaItem("Condicao", equipment.deviceCondition)
      + "  </div>"
      + '  <div class="record-actions">'
      + '    <button class="secondary" type="button" data-edit-equipment="' + escapeHtml(equipment.id) + '">Editar</button>'
      + '    <button type="button" data-use-equipment="' + escapeHtml(equipment.id) + '">Gerar termo</button>'
      + "  </div>"
      + "</article>";
  }

  function renderEquipment() {
    var query = String(el.equipmentSearchInput.value || "").trim().toLowerCase();
    var rows = state.equipment.filter(function (item) {
      if (item.archived) return false;
      if (!query) return true;
      return [item.deviceBrand, item.deviceModel, item.assetTag, item.serialNumber, item.internalId, item.imeiOrSimNumber].join(" ").toLowerCase().indexOf(query) !== -1;
    });
    el.equipmentCount.textContent = state.equipment.filter(function (item) { return !item.archived; }).length;
    if (!rows.length) {
      empty(el.equipmentList, query ? "Nenhum veiculo encontrado." : "Nenhum veiculo cadastrado.");
      return;
    }
    el.equipmentList.innerHTML = rows.map(buildEquipmentCard).join("");
    el.equipmentList.querySelectorAll("[data-edit-equipment]").forEach(function (button) {
      button.onclick = function () {
        var equipment = state.equipment.find(function (item) { return item.id === button.dataset.editEquipment; });
        if (equipment) fillEquipmentForm(equipment);
      };
    });
    el.equipmentList.querySelectorAll("[data-use-equipment]").forEach(function (button) {
      button.onclick = function () {
        setTab("termos");
        el.equipmentSelect.value = button.dataset.useEquipment;
      };
    });
  }

  function renderEquipmentOptions() {
    var previous = el.equipmentSelect.value;
    var options = state.equipment.filter(function (item) { return !item.archived; });
    el.equipmentSelect.innerHTML = options.map(function (item) {
      var label = [item.assetTag, item.deviceBrand, item.deviceModel, item.serialNumber].filter(Boolean).join(" | ");
      return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(label || item.id) + "</option>";
    }).join("");
    if (previous && options.some(function (item) { return item.id === previous; })) el.equipmentSelect.value = previous;
    el.equipmentSelect.disabled = !options.length;
  }

  function renderUserOptions() {
    var previous = el.assignedUserEmail.value;
    var options = MANUAL_USER_SUGGESTIONS.concat(state.users.length ? state.users : (state.currentUser && state.currentUser.email ? [state.currentUser.email] : []))
      .filter(function (value, index, list) {
        return value && list.indexOf(value) === index;
      });
    if (el.assignedUserOptions) {
      el.assignedUserOptions.innerHTML = options.map(function (value) {
        return '<option value="' + escapeHtml(value) + '"></option>';
      }).join("");
    }
    if (!previous) return;
    el.assignedUserEmail.value = previous;
  }

  function readTermForm() {
    var equipment = state.equipment.find(function (item) { return item.id === el.equipmentSelect.value; }) || {};
    var assignedUser = el.assignedUserEmail.value;
    return template.createDefaultTerm("", "", equipment, {
      email: assignedUser,
      assignmentLabel: assignedUser,
      companyName: "GRUPO TKA",
      companySignerName: template.DEFAULT_COMPANY_SIGNER_NAME,
      companySignatureDataUrl: state.companySignatureDataUrl,
      companySignatureUpdatedAt: state.companySignatureUpdatedAt
    });
  }

  function validateTermDraft(term) {
    var missing = [];
    if (!term.equipmentId) missing.push("veiculo");
    return missing;
  }

  function createTerm(event) {
    event.preventDefault();
    if (!canAccess()) return;
    var draft = readTermForm();
    var missing = validateTermDraft(draft);
    if (missing.length) {
      window.alert("Preencha: " + missing.join(", ") + ".");
      return;
    }
    var id = template.newId("veiculos-term-" + draft.assetTag);
    draft.id = id;
    draft.publicLink = template.buildPublicLink(id);
    draft.source = "veiculos-dashboard";
    draft.createdBy = state.currentUser.email || "";
    draft.updatedBy = state.currentUser.email || "";
    var payload = template.stateForCloud(draft);
    db.collection(template.TERMS_COLLECTION).doc(id).set(payload, { merge: true }).then(function () {
      showCreatedLink(draft.publicLink);
      writeAuditLog("create", draft.assignedUserEmail, "Termo de veiculo gerado para assinatura.", null, payload);
      return copyTextToClipboard(draft.publicLink);
    }).catch(function (error) {
      console.error(error);
      window.alert("Nao foi possivel gerar o termo.");
    });
  }

  function termMatches(term, query) {
    if (!query) return true;
    var haystack = [
      term.employeeName,
      term.employeeDocument,
      term.employeeInternalId,
      term.employeeUsagePost,
      term.employeeWorkShift,
      term.assignedUserEmail,
      term.assetTag,
      term.serialNumber,
      term.internalId,
      term.deviceBrand,
      term.deviceModel,
      template.statusLabel(template.deriveStatus(term)),
      template.summaryIssues(term)
    ].join(" ").toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function buildTermCard(term, archived) {
    var status = template.deriveStatus(term);
    var publicLink = term.publicLink || template.buildPublicLink(term.id);
    var actions = ''
      + '<a class="button" href="/operacional/inventario/veiculos/editor.html?id=' + encodeURIComponent(term.id) + '">Abrir</a>'
      + '<a class="button secondary" href="' + escapeHtml(publicLink) + '" target="_blank" rel="noreferrer">Ver link publico</a>'
      + '<button class="secondary" type="button" data-copy-link="' + escapeHtml(term.id) + '">Copiar link</button>'
      + '<button class="secondary" type="button" data-export-term="' + escapeHtml(term.id) + '">Exportar PDF</button>';
    if (archived) {
      actions += '<button class="secondary" type="button" data-restore-term="' + escapeHtml(term.id) + '">Reativar</button>';
    } else {
      actions += '<button class="warning" type="button" data-archive-term="' + escapeHtml(term.id) + '">Arquivar</button>';
    }
    return ''
      + '<article class="record-card" data-term-id="' + escapeHtml(term.id) + '">'
      + '  <div class="record-card-head">'
      + '    <div><h2>' + escapeHtml(term.employeeName || "Colaborador pendente") + '</h2>'
      + '    <p class="muted">' + escapeHtml(term.assignedUserEmail || "-") + ' | Entrega ' + escapeHtml(formatDate(term.deliveryDate)) + '</p></div>'
      + '    <div class="chip-row"><span class="chip" data-status="' + escapeHtml(status) + '">' + escapeHtml(template.statusLabel(status)) + '</span>'
      + (archived ? '<span class="chip" data-status="archived">Arquivado</span>' : "")
      + "    </div>"
      + "  </div>"
      + '  <div class="meta-grid">'
      + createMetaItem("Veiculo", [term.deviceBrand, term.deviceModel].filter(Boolean).join(" ") || "Veiculo")
      + createMetaItem("Placa", term.assetTag)
      + createMetaItem("Prefixo/Frota", term.serialNumber)
      + createMetaItem("Renavam/Chassi", term.internalId || term.imeiOrSimNumber)
      + createMetaItem("Posto / Turno", [term.employeeUsagePost, term.employeeWorkShift].filter(Boolean).join(" | "))
      + createMetaItem("Responsavel", term.responsibleForDeliveryName)
      + createMetaItem(status === "complete" ? "Assinatura" : "Pendencias", template.summaryIssues(term))
      + createMetaItem("Atualizacao", formatDateTime(term.updatedAt || term.createdAt))
      + "  </div>"
      + '  <div class="record-actions">' + actions + "</div>"
      + "</article>";
  }

  function sectionTerms(kind) {
    if (kind === "archived") return state.terms.filter(function (term) { return term.archived; });
    var active = state.terms.filter(function (term) { return !term.archived; });
    if (kind === "complete") return active.filter(function (term) { return template.deriveStatus(term) === "complete"; });
    return active.filter(function (term) { return template.deriveStatus(term) !== "complete"; });
  }

  function renderTermSection(kind, container, countLabel, searchInput) {
    var query = String(searchInput && searchInput.value || "").trim().toLowerCase();
    var rows = sectionTerms(kind).filter(function (term) { return termMatches(term, query); });
    if (countLabel) countLabel.textContent = rows.length + (kind === "complete" ? " completo(s)" : " incompleto(s)");
    if (!rows.length) {
      empty(container, kind === "archived" ? "Nenhum termo arquivado." : "Nenhum termo encontrado.");
      return;
    }
    container.innerHTML = rows.map(function (term) { return buildTermCard(term, kind === "archived"); }).join("");
    bindTermActions(container);
  }

  function renderTerms() {
    var active = state.terms.filter(function (term) { return !term.archived; });
    var complete = active.filter(function (term) { return template.deriveStatus(term) === "complete"; });
    var incomplete = active.filter(function (term) { return template.deriveStatus(term) !== "complete"; });
    el.activeTermsCount.textContent = active.length;
    el.completeTermsCount.textContent = complete.length;
    el.incompleteTermsCount.textContent = incomplete.length;
    el.archivedTermsCount.textContent = state.terms.filter(function (term) { return term.archived; }).length;
    renderTermSection("incomplete", el.incompleteTermList, el.incompleteCountLabel, el.activeSearchInput);
    renderTermSection("complete", el.completeTermList, el.completeCountLabel, el.activeSearchInput);
    renderTermSection("archived", el.archivedTermList, null, el.archivedSearchInput);
  }

  function updateTermArchive(id, archived) {
    var term = state.terms.find(function (item) { return item.id === id; });
    if (!term) return Promise.resolve();
    if (!window.confirm(archived ? "Arquivar este termo?" : "Reativar este termo?")) return Promise.resolve();
    var payload = {
      archived: archived,
      archivedAt: archived ? new Date().toISOString() : null,
      archivedBy: archived ? state.currentUser.email || "" : null,
      updatedAt: new Date().toISOString(),
      updatedBy: state.currentUser.email || ""
    };
    return db.collection(template.TERMS_COLLECTION).doc(id).set(payload, { merge: true }).then(function () {
      writeAuditLog(archived ? "archive" : "restore", term.employeeName || id, archived ? "Termo de veiculo arquivado." : "Termo de veiculo reativado.", term, payload);
    });
  }

  function bindTermActions(container) {
    container.querySelectorAll("[data-copy-link]").forEach(function (button) {
      button.onclick = function () {
        var term = state.terms.find(function (item) { return item.id === button.dataset.copyLink; });
        var link = term && (term.publicLink || template.buildPublicLink(term.id));
        if (!link) return;
        copyTextToClipboard(link).then(function (copied) {
          if (!copied) window.prompt("Copie o link publico do termo:", link);
        });
      };
    });
    container.querySelectorAll("[data-export-term]").forEach(function (button) {
      button.onclick = function () {
        var term = state.terms.find(function (item) { return item.id === button.dataset.exportTerm; });
        if (term) window.TKAVehicleTermPdf.download(withCurrentCompanySignature(term));
      };
    });
    container.querySelectorAll("[data-archive-term]").forEach(function (button) {
      button.onclick = function () {
        updateTermArchive(button.dataset.archiveTerm, true).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel arquivar o termo.");
        });
      };
    });
    container.querySelectorAll("[data-restore-term]").forEach(function (button) {
      button.onclick = function () {
        updateTermArchive(button.dataset.restoreTerm, false).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel reativar o termo.");
        });
      };
    });
  }

  function setTab(tab) {
    state.currentTab = tab || "equipamentos";
    document.querySelectorAll(".tab-btn").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tab === state.currentTab);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "tab-" + state.currentTab;
    });
  }

  function renderAll() {
    renderEquipmentOptions();
    renderUserOptions();
    renderEquipment();
    renderTerms();
  }

  function initializeManualLinks() {
    var href = template.safeManualHref();
    if (el.dashboardManualOpenLink) el.dashboardManualOpenLink.href = href || "#";
    if (el.dashboardManualDownloadLink) el.dashboardManualDownloadLink.href = href || "#";
  }

  function loadUsers() {
    return db.collection("system").doc("portalGate").get().then(function (snapshot) {
      var data = snapshot.data() || {};
      var users = Object.keys(data.users || {});
      state.users = users.sort();
    }).catch(function () {
      state.users = state.currentUser && state.currentUser.email ? [state.currentUser.email] : [];
    });
  }

  function loadCompanySignature() {
    if (!db) return Promise.resolve(false);
    return db.collection("system").doc(template.OWNER_SIGNATURE_DOC).get().then(function (snapshot) {
      var data = snapshot.data() || {};
      state.companySignatureDataUrl = template.text(data.signatureDataUrl);
      state.companySignatureUpdatedAt = cloudTimestampLabel(data.updatedAt);
      return Boolean(state.companySignatureDataUrl);
    }).catch(function (error) {
      console.warn("Nao foi possivel carregar a assinatura da empresa.", error);
      state.companySignatureDataUrl = "";
      state.companySignatureUpdatedAt = "";
      return false;
    });
  }

  function subscribeData() {
    db.collection(template.EQUIPMENT_COLLECTION).onSnapshot(function (snapshot) {
      state.equipment = snapshot.docs.map(function (doc) {
        return template.normalizeEquipment(Object.assign({ id: doc.id }, doc.data()), doc.id);
      }).sort(sortByUpdated);
      renderAll();
    }, function (error) {
      console.error(error);
      empty(el.equipmentList, "Nao foi possivel carregar os veiculos.", "error-state");
    });

    db.collection(template.TERMS_COLLECTION).onSnapshot(function (snapshot) {
      state.terms = snapshot.docs.map(function (doc) {
        return template.normalizeTerm(Object.assign({ id: doc.id }, doc.data()), doc.id);
      }).map(withCurrentCompanySignature).sort(sortByUpdated);
      renderAll();
    }, function (error) {
      console.error(error);
      empty(el.incompleteTermList, "Nao foi possivel carregar os termos.", "error-state");
      empty(el.completeTermList, "Nao foi possivel carregar os termos.", "error-state");
    });
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach(function (button) {
      button.onclick = function () { setTab(button.dataset.tab); };
    });
    el.equipmentForm.onsubmit = saveEquipment;
    el.clearEquipmentBtn.onclick = clearEquipmentForm;
    el.termForm.onsubmit = createTerm;
    el.equipmentSearchInput.oninput = renderEquipment;
    el.activeSearchInput.oninput = renderTerms;
    el.archivedSearchInput.oninput = renderTerms;
    el.assignedUserEmail.onchange = function () {};
    el.copyLinkBtn.onclick = function () {
      var link = el.linkOutput.value;
      if (!link) return;
      copyTextToClipboard(link).then(function (copied) {
        if (!copied) window.prompt("Copie o link publico do termo:", link);
      });
    };
    el.themeToggleBtn.onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return false;
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    return true;
  }

  function renderAccessDenied() {
    el.accessMessage.textContent = "Acesso restrito ao setor Operacional e administradores.";
    empty(el.equipmentList, "Acesso restrito ao setor Operacional e administradores.", "error-state");
    empty(el.incompleteTermList, "Acesso restrito ao setor Operacional e administradores.", "error-state");
    empty(el.completeTermList, "Acesso restrito ao setor Operacional e administradores.", "error-state");
    empty(el.archivedTermList, "Acesso restrito ao setor Operacional e administradores.", "error-state");
  }

  function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    state.currentUser = readPortalUser();
    bindEvents();
    initializeManualLinks();
    clearEquipmentForm();
    setTab("equipamentos");
    if (!initializeFirebase()) {
      el.accessMessage.textContent = "Firebase nao configurado.";
      return;
    }
    if (!canAccess()) {
      renderAccessDenied();
      return;
    }
    el.accessMessage.textContent = "Acesso liberado para " + state.currentUser.email + ".";
    Promise.all([loadUsers(), loadCompanySignature()]).then(function () {
      renderUserOptions();
      subscribeData();
    });
  }

  init();
})();
