(function () {
  var template = window.TKABodyCamTemplate;
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var params = new URLSearchParams(window.location.search);
  var db = null;
  var signaturePad = null;
  var saveBusy = false;
  var PUBLIC_EDITABLE_FIELDS = {
    employeeName: true,
    employeeDocument: true,
    employeeRole: true,
    employeeUsagePost: true,
    employeeWorkShift: true,
    companyName: true,
    deliveryDate: true,
    responsibleForDeliveryName: true,
    signatureCity: true,
    signatureDateTime: true
  };
  var ISSUE_LABELS = {
    "Nome do colaborador": "Nome completo",
    "Documento ou matricula": "Documento",
    "Cargo ou funcao": "Cargo / funcao",
    "Posto de uso": "Posto de uso",
    "Turno de trabalho": "Turno de trabalho",
    "Empresa": "Empresa",
    "Marca do equipamento": "Marca do equipamento",
    "Modelo do equipamento": "Modelo do equipamento",
    "Patrimonio": "Patrimonio",
    "Numero de serie": "Numero de serie",
    "Acessorios entregues": "Acessorios entregues",
    "Data de entrega": "Data da entrega",
    "Condicao do equipamento": "Condicao do equipamento",
    "Responsavel pela entrega": "Responsavel pela entrega",
    "Cidade da assinatura": "Cidade",
    "Data e hora da assinatura": "Dia e hora",
    "Confirmacao de recebimento": "Confirmar recebimento do equipamento",
    "Confirmacao de leitura do manual": "Confirmar leitura do manual",
    "Assinatura do colaborador": "Assinatura digital",
    "Assinatura da empresa": "Assinatura da empresa no Admin"
  };
  var ISSUE_FIELD_MAP = {
    "Nome do colaborador": "employeeName",
    "Documento ou matricula": "employeeDocument",
    "Cargo ou funcao": "employeeRole",
    "Posto de uso": "employeeUsagePost",
    "Turno de trabalho": "employeeWorkShift",
    "Empresa": "companyName",
    "Marca do equipamento": "deviceBrand",
    "Modelo do equipamento": "deviceModel",
    "Patrimonio": "assetTag",
    "Numero de serie": "serialNumber",
    "Acessorios entregues": "accessoriesDelivered",
    "Data de entrega": "deliveryDate",
    "Condicao do equipamento": "deviceCondition",
    "Responsavel pela entrega": "responsibleForDeliveryName",
    "Cidade da assinatura": "signatureCity",
    "Data e hora da assinatura": "signatureDateTime"
  };
  var state = {
    id: "",
    term: null,
    currentUser: null,
    publicMode: false,
    loaded: false,
    companySignatureDataUrl: "",
    companySignatureUpdatedAt: ""
  };

  var el = {
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    backToListLink: document.getElementById("backToListLink"),
    homeLink: document.getElementById("homeLink"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    copyPublicLinkBtn: document.getElementById("copyPublicLinkBtn"),
    printBtn: document.getElementById("printBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    saveBtn: document.getElementById("saveBtn"),
    termPreview: document.getElementById("termPreview"),
    adminFieldsPanel: document.getElementById("adminFieldsPanel"),
    fieldsPanelTitle: document.getElementById("fieldsPanelTitle"),
    fieldsPanelSubtitle: document.getElementById("fieldsPanelSubtitle"),
    manualAccessPanel: document.getElementById("manualAccessPanel"),
    manualAccessText: document.getElementById("manualAccessText"),
    openManualLink: document.getElementById("openManualLink"),
    downloadManualLink: document.getElementById("downloadManualLink"),
    ackEquipmentReceived: document.getElementById("ackEquipmentReceived"),
    ackPolicyRead: document.getElementById("ackPolicyRead"),
    statusChip: document.getElementById("statusChip"),
    issueSummary: document.getElementById("issueSummary"),
    missingInfoPanel: document.getElementById("missingInfoPanel"),
    missingInfoList: document.getElementById("missingInfoList"),
    signaturePreview: document.getElementById("signaturePreview"),
    signatureEmpty: document.getElementById("signatureEmpty"),
    companySignaturePanel: document.getElementById("companySignaturePanel"),
    companySignaturePreview: document.getElementById("companySignaturePreview"),
    companySignatureEmpty: document.getElementById("companySignatureEmpty"),
    companySignatureMeta: document.getElementById("companySignatureMeta"),
    signatureCanvas: document.getElementById("signatureCanvas"),
    clearSignatureBtn: document.getElementById("clearSignatureBtn"),
    saveStatus: document.getElementById("saveStatus")
  };

  function setStatus(message) {
    el.saveStatus.textContent = message;
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

  function hasOperationalAccess() {
    return Boolean(state.currentUser && state.currentUser.permissions && (state.currentUser.permissions.operacional || state.currentUser.permissions.admin));
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return false;
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    return true;
  }

  function cloudTimestampLabel(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return template.text(value);
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

  function applyCompanySignatureToTerm() {
    if (!state.term) return;
    var shouldRefresh = !isSigned() || !template.text(state.term.companySignatureDataUrl);
    if (shouldRefresh) {
      state.term.companySignatureDataUrl = state.companySignatureDataUrl;
      state.term.companySignatureUpdatedAt = state.companySignatureUpdatedAt;
    }
    state.term.companySignerName = state.term.companySignerName || template.DEFAULT_COMPANY_SIGNER_NAME;
    state.term = template.normalizeTerm(state.term, state.id, state.term.publicLink);
  }

  function isSigned() {
    return Boolean(state.term && template.text(state.term.signedAt));
  }

  function canEditFields() {
    return Boolean(!state.publicMode && hasOperationalAccess() && !isSigned());
  }

  function canEditField(key) {
    if (isSigned()) return false;
    if (state.publicMode) return Boolean(PUBLIC_EDITABLE_FIELDS[key]);
    return hasOperationalAccess();
  }

  function fieldElements() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-field]"));
  }

  function fieldValueForDom(value) {
    return Array.isArray(value) ? template.accessoriesLabel(value) : template.text(value);
  }

  function localDateTimeInputValue(date) {
    var current = date || new Date();
    var offsetMs = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function populateFields() {
    fieldElements().forEach(function (field) {
      var key = field.dataset.field;
      field.value = fieldValueForDom(state.term && state.term[key]);
      field.disabled = !canEditField(key);
    });
    el.ackEquipmentReceived.checked = Boolean(state.term && state.term.acknowledgements && state.term.acknowledgements.equipmentReceived);
    el.ackPolicyRead.checked = Boolean(state.term && state.term.acknowledgements && state.term.acknowledgements.policyRead);
    el.ackEquipmentReceived.disabled = isSigned();
    el.ackPolicyRead.disabled = isSigned();
  }

  function readFieldsIntoState() {
    if (!state.term) return;
    fieldElements().forEach(function (field) {
      var key = field.dataset.field;
      if (canEditField(key)) {
        if (key === "accessoriesDelivered") {
          state.term[key] = template.normalizeAccessories(field.value);
        } else {
          state.term[key] = field.value;
        }
      }
    });
    state.term.acknowledgements = state.term.acknowledgements || {};
    state.term.acknowledgements.equipmentReceived = el.ackEquipmentReceived.checked;
    state.term.acknowledgements.policyRead = el.ackPolicyRead.checked;
    if (signaturePad) state.term.signatureData = signaturePad.read();
    state.term = template.normalizeTerm(state.term, state.id, state.term.publicLink);
    applyCompanySignatureToTerm();
  }

  function renderPreview() {
    if (!state.term) {
      el.termPreview.innerHTML = '<div class="empty-state">Termo nao carregado.</div>';
      return;
    }
    el.termPreview.innerHTML = template.renderTermHtml(state.term);
  }

  function renderSignaturePreview() {
    var dataUrl = template.text(state.term && state.term.signatureData);
    el.signaturePreview.classList.toggle("hidden", !dataUrl);
    el.signatureEmpty.classList.toggle("hidden", Boolean(dataUrl));
    if (dataUrl) {
      el.signaturePreview.src = dataUrl;
    } else {
      el.signaturePreview.removeAttribute("src");
    }
  }

  function renderCompanySignaturePreview() {
    var dataUrl = template.text(state.term && state.term.companySignatureDataUrl) || state.companySignatureDataUrl;
    var signerName = template.text(state.term && state.term.companySignerName) || template.DEFAULT_COMPANY_SIGNER_NAME;
    if (el.companySignaturePreview) {
      el.companySignaturePreview.classList.toggle("hidden", !dataUrl);
      if (dataUrl) {
        el.companySignaturePreview.src = dataUrl;
      } else {
        el.companySignaturePreview.removeAttribute("src");
      }
    }
    if (el.companySignatureEmpty) {
      el.companySignatureEmpty.classList.toggle("hidden", Boolean(dataUrl));
      el.companySignatureEmpty.textContent = "Assinatura da empresa pendente no Admin.";
    }
    if (el.companySignatureMeta) {
      el.companySignatureMeta.textContent = dataUrl
        ? signerName
        : "Cadastre a assinatura da empresa no Admin antes do envio final.";
    }
  }

  function currentIssues() {
    return state.term ? template.requiredIssues(state.term) : ["Termo nao carregado"];
  }

  function issueLabel(issue) {
    return ISSUE_LABELS[issue] || issue;
  }

  function resetMissingHighlights() {
    fieldElements().forEach(function (field) {
      field.removeAttribute("aria-invalid");
      if (field.parentElement) field.parentElement.classList.remove("field-error");
    });
    [el.ackEquipmentReceived, el.ackPolicyRead].forEach(function (field) {
      if (field && field.parentElement) field.parentElement.classList.remove("field-error");
    });
    el.signatureCanvas.classList.remove("field-error-box");
    el.signaturePreview.classList.remove("field-error-box");
  }

  function markMissingFields(issues) {
    resetMissingHighlights();
    issues.forEach(function (issue) {
      var key = ISSUE_FIELD_MAP[issue];
      var field = key ? document.querySelector('[data-field="' + key + '"]') : null;
      if (field && canEditField(key)) {
        field.setAttribute("aria-invalid", "true");
        if (field.parentElement) field.parentElement.classList.add("field-error");
      }
      if (issue === "Confirmacao de recebimento" && el.ackEquipmentReceived.parentElement) {
        el.ackEquipmentReceived.parentElement.classList.add("field-error");
      }
      if (issue === "Confirmacao de leitura do manual" && el.ackPolicyRead.parentElement) {
        el.ackPolicyRead.parentElement.classList.add("field-error");
      }
      if (issue === "Assinatura do colaborador") {
        el.signatureCanvas.classList.add("field-error-box");
        el.signaturePreview.classList.add("field-error-box");
      }
    });
  }

  function renderMissingInfo(issues) {
    var show = state.publicMode && !isSigned() && issues.length > 0;
    el.missingInfoPanel.classList.toggle("hidden", !show);
    el.missingInfoList.innerHTML = show
      ? issues.map(function (issue) { return "<li>" + template.escapeHtml(issueLabel(issue)) + "</li>"; }).join("")
      : "";
    markMissingFields(show ? issues : []);
  }

  function focusFirstMissingIssue(issues) {
    var target = null;
    for (var index = 0; index < issues.length; index += 1) {
      var issue = issues[index];
      var key = ISSUE_FIELD_MAP[issue];
      if (key) {
        var field = document.querySelector('[data-field="' + key + '"]');
        if (field && canEditField(key)) {
          target = field;
          break;
        }
      }
      if (issue === "Confirmacao de recebimento") target = el.ackEquipmentReceived;
      if (issue === "Confirmacao de leitura do manual") target = el.ackPolicyRead;
      if (target) break;
    }
    if (target && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }

  function revealMissingInfo(issues) {
    renderMissingInfo(issues);
    if (!el.missingInfoPanel.classList.contains("hidden")) {
      el.missingInfoPanel.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    window.setTimeout(function () { focusFirstMissingIssue(issues); }, 80);
  }

  function renderStatus() {
    if (!state.term) return;
    var status = template.deriveStatus(state.term);
    var issues = currentIssues();
    el.statusChip.textContent = template.statusLabel(status);
    el.statusChip.dataset.status = status;
    el.issueSummary.textContent = status === "complete" ? template.summaryIssues(state.term) : (issues.length ? "Pendencias: " + issues.map(issueLabel).join(", ") + "." : "Pronto para assinatura.");
    el.saveBtn.textContent = state.publicMode ? (isSigned() ? "Enviado" : "Enviar termo") : (isSigned() ? "Termo assinado" : "Salvar rascunho");
    el.saveBtn.disabled = saveBusy || isSigned();
    el.copyPublicLinkBtn.disabled = !state.id;
    el.exportPdfBtn.disabled = !state.term;
    el.clearSignatureBtn.disabled = isSigned();
    renderMissingInfo(issues);
    if (signaturePad) signaturePad.setEnabled(!isSigned());
  }

  function renderMode() {
    var publicLocked = state.publicMode;
    el.adminFieldsPanel.classList.remove("hidden");
    document.querySelectorAll("[data-internal-field]").forEach(function (node) {
      node.classList.toggle("hidden", state.publicMode);
    });
    document.querySelectorAll("[data-public-field]").forEach(function (node) {
      node.classList.toggle("hidden", false);
    });
    el.fieldsPanelTitle.textContent = state.publicMode ? "Preenchimento do colaborador" : "Dados do termo";
    el.fieldsPanelSubtitle.textContent = state.publicMode
      ? "Preencha seus dados antes de confirmar e assinar o termo."
      : "Campos usados para montar o termo e o PDF.";
    el.backToListLink.classList.toggle("hidden", publicLocked);
    el.homeLink.classList.toggle("hidden", publicLocked);
    el.copyPublicLinkBtn.classList.toggle("hidden", publicLocked);
    el.pageTitle.textContent = state.publicMode ? "Assinatura do Termo Body Cam" : (state.id ? "Editar Termo Body Cam" : "Novo Termo Body Cam");
    el.pageSubtitle.textContent = state.term
      ? [state.term.employeeName, state.term.assetTag, template.statusLabel(template.deriveStatus(state.term))].filter(Boolean).join(" | ")
      : "Termo digital com assinatura do colaborador.";
  }

  function renderManualAccess() {
    var href = template.safeManualHref();
    el.manualAccessPanel.classList.toggle("hidden", !href);
    el.openManualLink.href = href || "#";
    el.openManualLink.textContent = "Abrir PDF";
    el.downloadManualLink.href = href || "#";
    el.downloadManualLink.textContent = "Baixar PDF";
    el.manualAccessText.textContent = href ? "PDF do manual X7 publicado no sistema." : "Manual indisponivel.";
  }

  function renderAll() {
    populateFields();
    renderPreview();
    renderSignaturePreview();
    renderCompanySignaturePreview();
    renderMode();
    renderManualAccess();
    renderStatus();
  }

  function writeAuditLog(action, summary, nextValue) {
    if (!db) return Promise.resolve();
    return db.collection("portal_audit_logs").add({
      action: action,
      actionLabel: action === "sign" ? "Assinatura" : action === "update" ? "Edicao" : "Inclusao",
      actorEmail: state.publicMode ? (state.term.assignedUserEmail || state.term.employeeName || "link-publico") : (state.currentUser && state.currentUser.email || "sistema"),
      targetEmail: state.term.employeeName || state.id,
      summary: summary,
      previousValue: null,
      nextValue: nextValue || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (error) {
      console.warn("Nao foi possivel registrar auditoria.", error);
    });
  }

  function buildCloudPayload(options) {
    options = options || {};
    applyCompanySignatureToTerm();
    var payload = options.submit
      ? template.buildSubmissionPayload(state.term, state.term.signatureDateTime || new Date().toISOString(), state.term.signatureData)
      : template.stateForCloud(state.term);
    payload.id = state.id;
    payload.publicLink = payload.publicLink || template.buildPublicLink(state.id);
    payload.updatedAt = new Date().toISOString();
    payload.updatedBy = state.publicMode ? "" : (state.currentUser && state.currentUser.email || "");
    payload.lastSavedFrom = state.publicMode ? "public-link" : "internal";
    if (!payload.createdAt) payload.createdAt = payload.updatedAt;
    if (!payload.createdBy && !state.publicMode) payload.createdBy = state.currentUser && state.currentUser.email || "";
    return payload;
  }

  function persistRecord(options) {
    options = options || {};
    if (!state.term || saveBusy) return Promise.resolve(false);
    readFieldsIntoState();
    if (state.publicMode && !options.submit) return Promise.resolve(false);
    if (state.publicMode && !template.canSubmit(state.term)) {
      var issues = currentIssues();
      renderAll();
      revealMissingInfo(issues);
      setStatus("Falta preencher: " + issues.map(issueLabel).join(", ") + ".");
      return Promise.resolve(false);
    }
    if (isSigned()) {
      setStatus("Termo ja assinado. Edicao bloqueada.");
      renderAll();
      return Promise.resolve(false);
    }
    if (!state.id) {
      state.id = template.newId("body-cam-term-" + (state.term.assetTag || state.term.employeeName));
      state.term.id = state.id;
      state.term.publicLink = template.buildPublicLink(state.id);
      var url = new URL(window.location.href);
      url.searchParams.set("id", state.id);
      window.history.replaceState({}, "", url.toString());
    }

    saveBusy = true;
    renderStatus();
    setStatus(options.submit ? "Enviando termo..." : "Salvando termo...");
    var recordRef = db.collection(template.TERMS_COLLECTION).doc(state.id);
    var payload = buildCloudPayload(options);

    var writePromise;
    if (state.publicMode && options.submit) {
      writePromise = db.runTransaction(function (transaction) {
        return transaction.get(recordRef).then(function (snapshot) {
          var existing = snapshot.data() || {};
          if (template.text(existing.signedAt)) {
            state.term = template.normalizeTerm(Object.assign({ id: snapshot.id }, existing), snapshot.id);
            applyCompanySignatureToTerm();
            return false;
          }
          transaction.set(recordRef, payload, { merge: true });
          return true;
        });
      });
    } else {
      writePromise = recordRef.set(payload, { merge: true }).then(function () { return true; });
    }

    return writePromise.then(function (saved) {
      if (saved) {
        state.term = template.normalizeTerm(payload, state.id);
        if (options.submit) {
          writeAuditLog("sign", "Termo Body Cam assinado pelo colaborador.", payload);
        } else {
          writeAuditLog("update", "Termo Body Cam salvo.", payload);
        }
        setStatus(options.submit ? "Termo enviado com sucesso." : "Termo salvo.");
      } else {
        setStatus("Termo ja assinado. Edicao bloqueada.");
      }
      renderAll();
      return saved;
    }).catch(function (error) {
      console.error(error);
      setStatus("Nao foi possivel salvar o termo.");
      return false;
    }).finally(function () {
      saveBusy = false;
      renderStatus();
    });
  }

  function loadRecord() {
    state.id = template.text(params.get("id"));
    state.publicMode = params.get("public") === "1" || !hasOperationalAccess();
    if (!state.id) {
      if (state.publicMode) {
        state.term = null;
        setStatus("Link invalido.");
        el.saveBtn.disabled = true;
        renderAll();
        return Promise.resolve(false);
      }
      state.term = template.createDefaultTerm("", "");
      applyCompanySignatureToTerm();
      state.loaded = true;
      setStatus("Preencha e salve o rascunho.");
      renderAll();
      return Promise.resolve(true);
    }
    return db.collection(template.TERMS_COLLECTION).doc(state.id).get().then(function (snapshot) {
      if (!snapshot.exists) {
        state.term = null;
        setStatus("Termo nao encontrado.");
        renderAll();
        return false;
      }
      state.term = template.normalizeTerm(Object.assign({ id: snapshot.id }, snapshot.data()), snapshot.id);
      applyCompanySignatureToTerm();
      if (state.publicMode && !isSigned() && !state.term.signatureDateTime) {
        state.term.signatureDateTime = localDateTimeInputValue();
      }
      state.loaded = true;
      if (signaturePad) signaturePad.load(state.term.signatureData || "");
      setStatus(isSigned() ? "Termo assinado. Edicao bloqueada." : (state.publicMode ? "Revise, confirme e assine o termo." : "Termo carregado."));
      renderAll();
      return true;
    });
  }

  function syncSignatureFromPad() {
    if (!state.term || !signaturePad || isSigned()) return;
    state.term.signatureData = signaturePad.read();
    renderSignaturePreview();
    renderPreview();
    renderStatus();
  }

  function copyPublicLink() {
    var ensureSaved = state.id ? Promise.resolve(true) : persistRecord();
    return ensureSaved.then(function () {
      if (!state.id) return;
      var link = state.term.publicLink || template.buildPublicLink(state.id);
      if (!state.term.publicLink) state.term.publicLink = link;
      return copyTextToClipboard(link).then(function (copied) {
        if (copied) {
          setStatus("Link publico copiado.");
        } else {
          window.prompt("Copie o link publico do termo:", link);
        }
      });
    });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function bindEvents() {
    fieldElements().forEach(function (field) {
      field.addEventListener("input", function () {
        if (!canEditField(field.dataset.field)) return;
        readFieldsIntoState();
        renderPreview();
        renderStatus();
      });
      field.addEventListener("change", function () {
        if (!canEditField(field.dataset.field)) return;
        readFieldsIntoState();
        renderPreview();
        renderStatus();
      });
    });
    [el.ackEquipmentReceived, el.ackPolicyRead].forEach(function (field) {
      field.onchange = function () {
        readFieldsIntoState();
        renderPreview();
        renderStatus();
      };
    });
    ["pointerup", "mouseup", "touchend"].forEach(function (eventName) {
      el.signatureCanvas.addEventListener(eventName, function () {
        window.setTimeout(syncSignatureFromPad, 40);
      });
    });
    el.clearSignatureBtn.onclick = function () {
      if (isSigned()) return;
      signaturePad.clear();
      state.term.signatureData = "";
      renderAll();
    };
    el.saveBtn.onclick = function () {
      persistRecord({ submit: state.publicMode }).catch(function (error) {
        console.error(error);
        setStatus("Nao foi possivel concluir.");
      });
    };
    el.copyPublicLinkBtn.onclick = function () {
      copyPublicLink().catch(function (error) {
        console.error(error);
        setStatus("Nao foi possivel copiar o link.");
      });
    };
    el.printBtn.onclick = function () {
      window.print();
    };
    el.exportPdfBtn.onclick = function () {
      readFieldsIntoState();
      window.TKABodyCamPdf.download(state.term);
    };
    el.themeToggleBtn.onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };
    window.addEventListener("resize", function () {
      if (signaturePad) signaturePad.resize();
    });
  }

  function boot() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    state.currentUser = readPortalUser();
    if (!initializeFirebase()) {
      setStatus("Firebase nao configurado.");
      return;
    }
    signaturePad = window.TKASignatureTools.createSignaturePad({
      canvas: el.signatureCanvas,
      enabled: true,
      placeholder: "Assine aqui"
    });
    bindEvents();
    loadCompanySignature().then(loadRecord).catch(function (error) {
      console.error(error);
      setStatus("Nao foi possivel carregar o termo.");
      renderAll();
    });
  }

  boot();
})();
