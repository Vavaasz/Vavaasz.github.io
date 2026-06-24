(function () {
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var THEME_KEY = "tka_theme";
  var template = window.TKAServiceOrderTemplate;
  var COLLECTION_NAME = template.COLLECTION_NAME;
  var STAGES = template.STAGES;
  var params = new URLSearchParams(window.location.search);
  var firebaseDb = null;
  var employeeSignaturePad = null;
  var ownerSignatureDataUrl = "";
  var state = null;
  var recordId = "";
  var adminMode = false;
  var hasCloudRecord = false;
  var saveTimer = null;
  var cloudSavePromise = Promise.resolve();
  var lastSnapshot = "";
  var hasTriedSubmit = false;
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

  var elements = {
    eyebrowLabel: document.getElementById("eyebrowLabel"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    backToListLink: document.getElementById("backToListLink"),
    backToRhLink: document.getElementById("backToRhLink"),
    stageSelectWrap: document.getElementById("stageSelectWrap"),
    stageSelect: document.getElementById("stageSelect"),
    saveStatus: document.getElementById("saveStatus"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    saveBtn: document.getElementById("saveBtn"),
    ownerSignatureAlert: document.getElementById("ownerSignatureAlert"),
    documentPreview: document.getElementById("documentPreview"),
    adminEditorPanel: document.getElementById("adminEditorPanel"),
    sectionsEditorPanel: document.getElementById("sectionsEditorPanel"),
    sectionEditorList: document.getElementById("sectionEditorList"),
    addSectionBtn: document.getElementById("addSectionBtn"),
    signatureWarning: document.getElementById("signatureWarning"),
    employeeSignaturePreview: document.getElementById("employeeSignaturePreview"),
    employeeSignatureEmpty: document.getElementById("employeeSignatureEmpty"),
    employeeSignatureMeta: document.getElementById("employeeSignatureMeta"),
    employeeSignatureEditBtn: document.getElementById("employeeSignatureEditBtn"),
    employeeSignatureEditor: document.getElementById("employeeSignatureEditor"),
    employeeSignatureCanvas: document.getElementById("employeeSignatureCanvas"),
    employeeSignatureClearBtn: document.getElementById("employeeSignatureClearBtn"),
    employeeSignatureCancelBtn: document.getElementById("employeeSignatureCancelBtn"),
    employeeSignatureSaveBtn: document.getElementById("employeeSignatureSaveBtn")
  };

  function text(value) {
    return template.text(value);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setSaveStatus(message) {
    elements.saveStatus.textContent = message;
  }

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

  function normalizeAccessValue(value) {
    return String(value || "").trim().toLowerCase()
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
    var portalUser = readPortalUser();
    if (hasPortalServiceOrderAccess(portalUser)) return true;
    var email = normalizeAccessValue(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY));
    var gate = window.RH_GATE || {};
    return Boolean(email && gate.users && gate.users[email]);
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return false;
    if (!firebase.apps.length) firebase.initializeApp(config);
    firebaseDb = firebase.firestore();
    return true;
  }

  function configureMode() {
    adminMode = hasRhAccess() && (params.get("admin") === "1" || params.get("public") === "1");
    elements.eyebrowLabel.textContent = adminMode ? "Recursos Humanos" : "Ordem de Servico";
    elements.backToListLink.classList.toggle("hidden", !adminMode);
    elements.backToRhLink.classList.toggle("hidden", !adminMode);
    elements.stageSelectWrap.classList.toggle("hidden", !adminMode);
    elements.adminEditorPanel.classList.toggle("hidden", !adminMode);
    elements.sectionsEditorPanel.classList.toggle("hidden", !adminMode);
    elements.saveBtn.textContent = adminMode ? "Salvar no RH" : "Enviar";
  }

  function getPathValue(source, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? "" : acc[key];
    }, source);
  }

  function setPathValue(source, path, value) {
    var keys = path.split(".");
    var target = source;
    for (var index = 0; index < keys.length - 1; index += 1) {
      if (!target[keys[index]]) target[keys[index]] = {};
      target = target[keys[index]];
    }
    target[keys[keys.length - 1]] = value;
  }

  function isPublicLocked() {
    return Boolean(!adminMode && state && state.meta && text(state.meta.publicSubmittedAt));
  }

  function currentIssues() {
    return template.requiredIssues(state, ownerSignatureDataUrl);
  }

  function buildSnapshot() {
    return JSON.stringify({ data: template.stateForCloud(state) });
  }

  function optionMarkup(options, selectedValue) {
    return options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '"' + (option.value === selectedValue ? " selected" : "") + ">"
        + escapeHtml(option.label)
        + "</option>";
    }).join("");
  }

  function populateBoundFields() {
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      field.value = getPathValue(state, field.dataset.bind) || "";
    });
  }

  function renderStageSelect() {
    if (!adminMode) return;
    var stage = template.normalizeStage(state.meta || {});
    elements.stageSelect.innerHTML = optionMarkup(STAGES, stage);
  }

  function paragraphMarkup(body) {
    var paragraphs = text(body).split(/\n+/).filter(Boolean);
    if (!paragraphs.length) return '<p class="muted">Sem texto informado.</p>';
    return paragraphs.map(function (paragraph) {
      return "<p>" + escapeHtml(paragraph) + "</p>";
    }).join("");
  }

  function signatureMarkup(label, name, dataUrl, emptyText) {
    return ''
      + '<div class="signature-box">'
      + '  <strong>' + escapeHtml(label) + "</strong>"
      + (text(dataUrl) ? '<img src="' + escapeHtml(dataUrl) + '" alt="' + escapeHtml(label) + '" />' : '<p class="muted">' + escapeHtml(emptyText) + "</p>")
      + '  <div class="signature-line">' + escapeHtml(name || label) + "</div>"
      + "</div>";
  }

  function renderPreview() {
    var documentData = state.document || {};
    var sections = documentData.sections || [];
    elements.pageTitle.textContent = documentData.title || "Ordem de Servico";
    elements.pageSubtitle.textContent = [documentData.employeeName, documentData.employeeRole, documentData.sector].filter(Boolean).join(" | ") || "Documento RH";
    elements.documentPreview.innerHTML = ''
      + '<h2 class="document-title">' + escapeHtml(documentData.title || "ORDEM DE SERVICO") + "</h2>"
      + '<div class="document-meta">'
      + '  <div class="document-meta-item"><strong>Elaboracao por</strong><span>' + escapeHtml(documentData.preparedBy || "-") + "</span></div>"
      + '  <div class="document-meta-item"><strong>Ultima revisao</strong><span>' + escapeHtml(template.dateLabel(documentData.revisionDate) || "-") + "</span></div>"
      + '  <div class="document-meta-item"><strong>Nome</strong><span>' + escapeHtml(documentData.employeeName || "-") + "</span></div>"
      + '  <div class="document-meta-item"><strong>Cargo/Funcao</strong><span>' + escapeHtml(documentData.employeeRole || "-") + "</span></div>"
      + '  <div class="document-meta-item"><strong>Setor</strong><span>' + escapeHtml(documentData.sector || "-") + "</span></div>"
      + "</div>"
      + sections.map(function (section) {
        return '<section class="document-section"><h3>' + escapeHtml(section.title || "Bloco") + "</h3>" + paragraphMarkup(section.body) + "</section>";
      }).join("")
      + '<p>' + escapeHtml([text(documentData.city), template.dateLabel(documentData.date)].filter(Boolean).join(", ")) + "</p>"
      + '<div class="document-signatures">'
      + signatureMarkup("Assinatura do Colaborador", documentData.employeeName, state.signature.employeeDataUrl, "Assinatura pendente.")
      + signatureMarkup("Assinatura do Supervisor TKA", "GRUPO TKA", ownerSignatureDataUrl, "Assinatura da direcao pendente no Admin.")
      + "</div>";
  }

  function renderSignaturePreview() {
    var dataUrl = text(state.signature.employeeDataUrl);
    elements.employeeSignaturePreview.classList.toggle("hidden", !dataUrl);
    elements.employeeSignatureEmpty.classList.toggle("hidden", Boolean(dataUrl));
    if (dataUrl) {
      elements.employeeSignaturePreview.src = dataUrl;
    } else {
      elements.employeeSignaturePreview.removeAttribute("src");
    }
    elements.employeeSignatureMeta.textContent = state.signature.updatedAtLabel ? "Salva em " + state.signature.updatedAtLabel : "Ainda nao salva";
  }

  function sectionEditorMarkup(section, index) {
    return ''
      + '<article class="section-card" data-section-index="' + index + '">'
      + '  <div class="section-card-head">'
      + '    <strong>Bloco ' + (index + 1) + "</strong>"
      + '    <button class="button danger small" type="button" data-remove-section="' + index + '">Remover</button>'
      + "  </div>"
      + '  <label>Titulo'
      + '    <input data-section-title="' + index + '" value="' + escapeHtml(section.title || "") + '" />'
      + "  </label>"
      + '  <label>Texto'
      + '    <textarea data-section-body="' + index + '">' + escapeHtml(section.body || "") + "</textarea>"
      + "  </label>"
      + "</article>";
  }

  function renderSectionEditors() {
    if (!adminMode) return;
    elements.sectionEditorList.innerHTML = (state.document.sections || []).map(sectionEditorMarkup).join("");
    elements.sectionEditorList.querySelectorAll("[data-section-title]").forEach(function (field) {
      field.oninput = function () {
        var index = Number(field.dataset.sectionTitle);
        state.document.sections[index].title = field.value;
        renderPreview();
        renderStatus();
        queueSave("Alteracoes pendentes.");
      };
    });
    elements.sectionEditorList.querySelectorAll("[data-section-body]").forEach(function (field) {
      field.oninput = function () {
        var index = Number(field.dataset.sectionBody);
        state.document.sections[index].body = field.value;
        renderPreview();
        renderStatus();
        queueSave("Alteracoes pendentes.");
      };
    });
    elements.sectionEditorList.querySelectorAll("[data-remove-section]").forEach(function (button) {
      button.onclick = function () {
        state.document.sections.splice(Number(button.dataset.removeSection), 1);
        renderAll();
        queueSave("Bloco removido.");
      };
    });
  }

  function renderStatus() {
    var complete = template.isComplete(state, ownerSignatureDataUrl);
    var publicLocked = isPublicLocked();
    var signatureMissing = currentIssues().indexOf("Assinatura do colaborador") >= 0;
    elements.ownerSignatureAlert.classList.toggle("hidden", Boolean(ownerSignatureDataUrl));
    elements.signatureWarning.classList.toggle("hidden", !(hasTriedSubmit && signatureMissing));
    elements.exportPdfBtn.disabled = !complete;
    elements.saveBtn.disabled = publicLocked;
    elements.saveBtn.textContent = adminMode ? "Salvar no RH" : (publicLocked ? "Enviado" : "Enviar");
    elements.employeeSignatureEditBtn.disabled = publicLocked;
    elements.employeeSignatureClearBtn.disabled = publicLocked;
    elements.employeeSignatureCancelBtn.disabled = publicLocked;
    elements.employeeSignatureSaveBtn.disabled = publicLocked;
    if (publicLocked && employeeSignaturePad) {
      closeEmployeeSignatureEditor();
    }
  }

  function disableEditorControls() {
    elements.saveBtn.disabled = true;
    elements.exportPdfBtn.disabled = true;
    elements.employeeSignatureEditBtn.disabled = true;
    elements.employeeSignatureClearBtn.disabled = true;
    elements.employeeSignatureCancelBtn.disabled = true;
    elements.employeeSignatureSaveBtn.disabled = true;
  }

  function renderAll() {
    populateBoundFields();
    renderStageSelect();
    renderPreview();
    renderSignaturePreview();
    renderSectionEditors();
    renderStatus();
  }

  function stateForCloud() {
    return template.stateForCloud(state);
  }

  function applyCloudRecordData(data) {
    data = data || {};
    var publicLink = data.data && data.data.meta && data.data.meta.publicLink || template.buildPublicLink(recordId);
    state = template.normalizeState(data.data || {}, recordId, publicLink);
    state.meta.updatedAtLabel = template.shortDateTime(data.updatedAt || data.createdAt || null);
  }

  async function persistRecord(options) {
    options = options || {};
    if (isPublicLocked() && !options.submit) {
      setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
      return true;
    }
    if (!firebaseDb || !recordId) return false;
    var nextSnapshot = buildSnapshot();
    if (!options.force && nextSnapshot === lastSnapshot) return true;
    var recordRef = firebaseDb.collection(COLLECTION_NAME).doc(recordId);
    var payload = {
      data: stateForCloud(),
      archived: template.normalizeStage(state.meta || {}) === "archived",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!hasCloudRecord) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    if (!adminMode) {
      var lockedCloudData = null;
      await firebaseDb.runTransaction(function (transaction) {
        return transaction.get(recordRef).then(function (snapshot) {
          var existing = snapshot.data() || {};
          var submittedAt = text(existing.data && existing.data.meta && existing.data.meta.publicSubmittedAt);
          if (submittedAt) {
            lockedCloudData = existing;
            return;
          }
          transaction.set(recordRef, payload, { merge: true });
        });
      });
      hasCloudRecord = true;
      if (lockedCloudData) {
        applyCloudRecordData(lockedCloudData);
        lastSnapshot = buildSnapshot();
        renderAll();
        setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
        return true;
      }
      lastSnapshot = nextSnapshot;
      setSaveStatus(options.submit ? "Ordem enviada com sucesso." : "Assinatura salva como rascunho.");
      return true;
    }

    await recordRef.set(payload, { merge: true });
    hasCloudRecord = true;
    lastSnapshot = nextSnapshot;
    setSaveStatus(options.submit ? "Ordem enviada com sucesso." : "Alteracoes salvas em " + new Date().toLocaleTimeString("pt-BR"));
    return true;
  }

  function flushSave(options) {
    cloudSavePromise = cloudSavePromise.then(function () {
      return persistRecord(options);
    });
    return cloudSavePromise;
  }

  function queueSave(message) {
    if (isPublicLocked()) {
      setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
      return;
    }
    clearTimeout(saveTimer);
    setSaveStatus(message || (adminMode ? "Alteracoes pendentes." : "Assinatura salva como rascunho."));
    saveTimer = window.setTimeout(function () {
      flushSave().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel salvar agora.");
      });
    }, 700);
  }

  function validateBeforeSubmit() {
    var issues = currentIssues();
    hasTriedSubmit = true;
    renderStatus();
    if (!issues.length) return true;
    setSaveStatus("Pendencia: " + issues[0]);
    return false;
  }

  async function handleSaveClick() {
    if (adminMode) {
      await flushSave({ force: true });
      return;
    }
    if (isPublicLocked()) {
      setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
      renderAll();
      return;
    }
    if (!validateBeforeSubmit()) return;
    var previousSubmittedAt = state.meta.publicSubmittedAt;
    state.meta.publicSubmittedAt = previousSubmittedAt || new Date().toISOString();
    elements.saveBtn.disabled = true;
    setSaveStatus("Enviando ordem...");
    try {
      await flushSave({ force: true, submit: true });
    } catch (error) {
      state.meta.publicSubmittedAt = previousSubmittedAt;
      renderAll();
      throw error;
    }
    renderAll();
  }

  function openEmployeeSignatureEditor() {
    if (isPublicLocked()) {
      setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
      return;
    }
    elements.employeeSignatureEditor.classList.remove("hidden");
    employeeSignaturePad.load(state.signature.employeeDataUrl || "");
    employeeSignaturePad.setEnabled(true);
    employeeSignaturePad.resize();
  }

  function closeEmployeeSignatureEditor() {
    elements.employeeSignatureEditor.classList.add("hidden");
    employeeSignaturePad.setEnabled(false);
  }

  function saveEmployeeSignature() {
    if (isPublicLocked()) {
      setSaveStatus("Ordem ja enviada. Edicao bloqueada.");
      return;
    }
    if (!employeeSignaturePad.hasData()) {
      hasTriedSubmit = true;
      renderStatus();
      setSaveStatus("Desenhe a assinatura antes de salvar.");
      return;
    }
    state.signature.employeeDataUrl = employeeSignaturePad.read();
    state.signature.updatedAtLabel = new Date().toLocaleString("pt-BR");
    closeEmployeeSignatureEditor();
    renderPreview();
    renderSignaturePreview();
    renderStatus();
    queueSave("Assinatura salva.");
  }

  async function loadOwnerSignature() {
    if (!firebaseDb) return;
    var snapshot = await firebaseDb.collection("system").doc("ownerSignature").get();
    var data = snapshot.data() || {};
    ownerSignatureDataUrl = text(data.signatureDataUrl);
  }

  async function loadRecord() {
    var snapshot = await firebaseDb.collection(COLLECTION_NAME).doc(recordId).get();
    if (!snapshot.exists) {
      var builtIn = template.findBuiltInServiceOrder && template.findBuiltInServiceOrder(recordId);
      if (builtIn) {
        state = template.normalizeState(builtIn.state, recordId, template.buildPublicLink(recordId));
        hasCloudRecord = false;
        lastSnapshot = buildSnapshot();
        renderAll();
        setSaveStatus(adminMode ? "Ordem modelo carregada. Salve no RH para registrar alteracoes." : "Assine para enviar.");
        return true;
      }
      elements.pageTitle.textContent = "Ordem nao encontrada";
      elements.pageSubtitle.textContent = "Use a lista de ordens do RH para criar um link publico valido.";
      setSaveStatus("ID invalido.");
      disableEditorControls();
      return false;
    }

    applyCloudRecordData(snapshot.data() || {});
    hasCloudRecord = true;
    lastSnapshot = buildSnapshot();
    renderAll();
    setSaveStatus(adminMode ? "Ordem carregada." : (state.meta.publicSubmittedAt ? "Ordem ja enviada. Edicao bloqueada." : "Assine para enviar."));
    return true;
  }

  function handleBoundFieldChange(field) {
    if (!adminMode || isPublicLocked()) return;
    setPathValue(state, field.dataset.bind, field.value);
    renderPreview();
    renderStatus();
    queueSave("Alteracoes pendentes.");
  }

  function bindStaticEvents() {
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      field.addEventListener("input", function () {
        handleBoundFieldChange(field);
      });
      field.addEventListener("change", function () {
        handleBoundFieldChange(field);
      });
    });

    elements.stageSelect.onchange = function () {
      if (!adminMode) return;
      state.meta.serviceOrderStage = template.findStage(elements.stageSelect.value) ? elements.stageSelect.value : "current";
      state.meta.archived = state.meta.serviceOrderStage === "archived";
      renderStatus();
      queueSave("Ordem movida para " + template.stageLabel(state.meta.serviceOrderStage) + ".");
    };

    elements.addSectionBtn.onclick = function () {
      if (!adminMode) return;
      state.document.sections.push({ title: "Novo bloco", body: "" });
      renderAll();
      queueSave("Bloco adicionado.");
    };

    elements.saveBtn.onclick = function () {
      handleSaveClick().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel concluir a operacao.");
      });
    };

    elements.exportPdfBtn.onclick = function () {
      if (elements.exportPdfBtn.disabled) {
        setSaveStatus("Complete as assinaturas antes de exportar o PDF.");
        return;
      }
      window.TKAServiceOrderPdf.download(state, ownerSignatureDataUrl).catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel gerar o PDF agora.");
      });
    };

    elements.employeeSignatureEditBtn.onclick = openEmployeeSignatureEditor;
    elements.employeeSignatureClearBtn.onclick = function () {
      if (isPublicLocked()) return;
      employeeSignaturePad.clear();
    };
    elements.employeeSignatureCancelBtn.onclick = closeEmployeeSignatureEditor;
    elements.employeeSignatureSaveBtn.onclick = saveEmployeeSignature;

    elements.themeToggleBtn.onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };

    elements.backToListLink.onclick = function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/ordem-servico/");
    };

    elements.backToRhLink.onclick = function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/");
    };

    window.addEventListener("resize", function () {
      if (!elements.employeeSignatureEditor.classList.contains("hidden")) {
        employeeSignaturePad.resize();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && state && !isPublicLocked()) {
        flushSave().catch(function () {});
      }
    });
  }

  async function boot() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    configureMode();
    recordId = text(params.get("id"));
    if (!recordId) {
      elements.pageTitle.textContent = "Link invalido";
      elements.pageSubtitle.textContent = "Crie a ordem de servico pelo painel RH.";
      setSaveStatus("ID obrigatorio.");
      disableEditorControls();
      return;
    }

    if (!initializeFirebase()) {
      setSaveStatus("Firebase nao configurado.");
      return;
    }

    employeeSignaturePad = window.TKASignatureTools.createSignaturePad({
      canvas: elements.employeeSignatureCanvas,
      enabled: false,
      placeholder: "Assine e depois clique em Salvar assinatura"
    });

    await loadOwnerSignature();
    var loaded = await loadRecord();
    if (!loaded) return;
    bindStaticEvents();
  }

  boot().catch(function (error) {
    console.error(error);
    setSaveStatus("Nao foi possivel carregar a ordem.");
  });
})();
