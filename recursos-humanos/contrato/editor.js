(function () {
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var THEME_KEY = "tka_theme";
  var COLLECTION_NAME = "rh_contract_packets";
  var saveTimer = null;
  var cloudSavePromise = Promise.resolve();
  var lastSnapshot = "";
  var firebaseDb = null;
  var employeeSignaturePad = null;
  var ownerSignatureDataUrl = "";
  var sample = null;
  var state = null;
  var adminMode = false;
  var hasCloudRecord = false;
  var params = new URLSearchParams(window.location.search);
  var COMMERCIAL_EMAILS = {
    "comercial@grupotka.com.br": true,
    "comercial@grupotka": true
  };

  var elements = {
    eyebrowLabel: document.getElementById("eyebrowLabel"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    backToListLink: document.getElementById("backToListLink"),
    backToRhLink: document.getElementById("backToRhLink"),
    saveStatus: document.getElementById("saveStatus"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    archiveToggleBtn: document.getElementById("archiveToggleBtn"),
    saveBtn: document.getElementById("saveBtn"),
    previewPages: document.getElementById("previewPages"),
    ownerSignatureAlert: document.getElementById("ownerSignatureAlert"),
    transportDetails: document.getElementById("transportDetails"),
    transportCardOtherRow: document.getElementById("transportCardOtherRow"),
    transportOptionHint: document.getElementById("transportOptionHint"),
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
    return window.TKAContractTemplate.text(value);
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

  function hasRhAccess() {
    var portalUser = readPortalUser();
    if (portalUser) {
      var permissions = portalUser.permissions || {};
      var portalEmail = String(portalUser.email || portalUser.user || portalUser.login || "").trim().toLowerCase();
      if (permissions.rh || permissions.admin || permissions.comercial || permissions.commercial || COMMERCIAL_EMAILS[portalEmail]) return true;
    }
    var email = String(sessionStorage.getItem(RH_GATE_EMAIL_KEY) || localStorage.getItem(RH_GATE_EMAIL_KEY) || "").trim().toLowerCase();
    var gate = window.RH_GATE || {};
    return Boolean(email && gate.users && gate.users[email]);
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return;
    if (!firebase.apps.length) firebase.initializeApp(config);
    firebaseDb = firebase.firestore();
  }

  function configureMode() {
    adminMode = params.get("admin") === "1" && hasRhAccess();
    elements.eyebrowLabel.textContent = adminMode ? "Recursos Humanos" : "Contrato RH";
    elements.backToListLink.classList.toggle("hidden", !adminMode);
    elements.backToRhLink.classList.toggle("hidden", !adminMode);
    elements.archiveToggleBtn.classList.toggle("hidden", !adminMode);
    elements.saveBtn.textContent = adminMode ? "Salvar no RH" : "Enviar";
  }

  function isPublicLocked() {
    return Boolean(!adminMode && state && state.meta && text(state.meta.publicSubmittedAt));
  }

  function setBoundFieldValue(field, value) {
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }
    field.value = value || "";
  }

  function populateBoundFields() {
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      setBoundFieldValue(field, window.TKAContractTemplate.getPathValue(state, field.dataset.bind));
    });
  }

  function buildSnapshot() {
    return JSON.stringify({ data: stateForCloud() });
  }

  function currentIssues() {
    return window.TKAContractTemplate.requiredIssues(state, ownerSignatureDataUrl);
  }

  function syncPageScales() {
    document.querySelectorAll("[data-page-surface]").forEach(function (surface) {
      var overlay = surface.querySelector(".page-overlay-base");
      if (!overlay) return;
      var scale = surface.clientWidth / window.TKAContractTemplate.PAGE_WIDTH;
      overlay.style.transform = "scale(" + scale + ")";
    });
  }

  function overlayMarkup(item) {
    if (item.type === "signature") {
      return '<div class="overlay-signature" style="left:' + item.x + 'px;top:' + item.y + 'px;width:' + item.width + 'px;height:' + item.height + 'px;"><img src="' + item.dataUrl + '" alt="" /></div>';
    }

    var classes = "overlay-text";
    var top = Number(item.y || 0) + Number(item.previewOffsetY || 0);
    if ((item.width || 0) > 220) classes += " is-wrap";
    var style = [
      "left:" + item.x + "px",
      "top:" + top + "px",
      "font-size:" + (item.fontSize || 11) + "px",
      "font-weight:" + (item.weight || 600)
    ];
    if (item.width) style.push("width:" + item.width + "px");
    if (item.align === "center") style.push("text-align:center");
    return '<div class="' + classes + '" style="' + style.join(";") + '">' + String(item.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</div>";
  }

  function renderPreview() {
    var previewPages = window.TKAContractTemplate.buildPreviewPages(sample, state, ownerSignatureDataUrl);

    elements.previewPages.innerHTML = previewPages.map(function (page, index) {
      return ''
        + '<article class="page-card">'
        + '  <div class="page-card-head">'
        + '    <span class="page-label">Pagina ' + (index + 1) + "</span>"
        + "  </div>"
        + '  <div class="page-surface" data-page-surface>'
        + '    <img src="' + page.url + '" alt="Pagina ' + (index + 1) + ' do contrato de ' + sample.employeeName.replace(/"/g, "&quot;") + '" />'
        + '    <div class="page-overlay-base" style="width:' + window.TKAContractTemplate.PAGE_WIDTH + 'px;height:' + window.TKAContractTemplate.PAGE_HEIGHT + 'px;">'
        + page.overlays.map(overlayMarkup).join("")
        + "    </div>"
        + "  </div>"
        + "</article>";
    }).join("");

    syncPageScales();
  }

  function renderTransportSection() {
    var isAccept = state.transport.choice === "accept";
    var isOtherCard = state.transport.cardType === "other";
    document.querySelectorAll(".transport-accept-only").forEach(function (field) {
      field.classList.toggle("hidden", !isAccept);
    });
    elements.transportDetails.classList.toggle("hidden", !isAccept);
    elements.transportCardOtherRow.classList.toggle("hidden", !isAccept || !isOtherCard);
    elements.transportOptionHint.textContent = !state.transport.choice
      ? "Selecione se utiliza ou nao utiliza vale-transporte."
      : (isAccept
          ? "Preencha apenas ida, volta, tarifa, cartao e conducoes por dia."
          : "Marcado como nao utiliza vale-transporte.");
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

  function renderStatus() {
    var isComplete = currentIssues().length === 0;
    var publicLocked = isPublicLocked();
    elements.ownerSignatureAlert.classList.toggle("hidden", Boolean(ownerSignatureDataUrl));
    elements.exportPdfBtn.disabled = !isComplete;
    elements.saveBtn.textContent = adminMode ? "Salvar no RH" : (publicLocked ? "Enviado" : "Enviar");
    elements.saveBtn.disabled = publicLocked || (!adminMode && !isComplete);
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      field.disabled = publicLocked;
    });
    elements.employeeSignatureEditBtn.disabled = publicLocked;
    elements.employeeSignatureClearBtn.disabled = publicLocked;
    elements.employeeSignatureCancelBtn.disabled = publicLocked;
    elements.employeeSignatureSaveBtn.disabled = publicLocked;
    if (publicLocked && employeeSignaturePad) {
      closeEmployeeSignatureEditor();
    }
    elements.archiveToggleBtn.textContent = (state.meta.contractStage === "archived" || state.meta.archived) ? "Restaurar" : "Arquivar";
  }

  function renderAll() {
    elements.pageTitle.textContent = sample.employeeName;
    elements.pageSubtitle.textContent = sample.role + " | " + sample.companyName + " | Preencha apenas vale-transporte e assinatura.";
    populateBoundFields();
    renderPreview();
    renderTransportSection();
    renderSignaturePreview();
    renderStatus();
  }

  function queueSave(message) {
    if (isPublicLocked()) {
      setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
      return;
    }
    clearTimeout(saveTimer);
    setSaveStatus(message || (adminMode ? "Alteracoes pendentes." : "Rascunho salvo automaticamente."));
    saveTimer = window.setTimeout(function () {
      flushSave().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel salvar agora.");
      });
    }, 800);
  }

  function stateForCloud() {
    var clean = window.TKAContractTemplate.clone(state);
    clean.meta.updatedAtLabel = "";
    clean.signature.updatedAtLabel = text(clean.signature.updatedAtLabel);
    return clean;
  }

  function applyCloudRecordData(data) {
    data = data || {};
    state = window.TKAContractTemplate.normalizeState(sample, data.data || {});
    state.meta.updatedAtLabel = window.TKAContractTemplate.shortDateTime(data.updatedAt || data.createdAt || null);
  }

  async function persistRecord(options) {
    options = options || {};
    if (isPublicLocked() && !options.submit) {
      setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
      return true;
    }
    if (!firebaseDb || !sample) return false;
    var nextSnapshot = buildSnapshot();
    if (!options.force && nextSnapshot === lastSnapshot) return true;
    var recordRef = firebaseDb.collection(COLLECTION_NAME).doc(sample.id);

    var payload = {
      data: stateForCloud(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!hasCloudRecord) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

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
        setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
        return true;
      }
      lastSnapshot = nextSnapshot;
      setSaveStatus(options.submit ? "Contrato enviado com sucesso." : "Alteracoes salvas em " + new Date().toLocaleTimeString("pt-BR"));
      return true;
    }

    await recordRef.set(payload, { merge: true });
    hasCloudRecord = true;
    lastSnapshot = nextSnapshot;
    setSaveStatus(options.submit ? "Contrato enviado com sucesso." : "Alteracoes salvas em " + new Date().toLocaleTimeString("pt-BR"));
    return true;
  }

  function flushSave(options) {
    cloudSavePromise = cloudSavePromise.then(function () {
      return persistRecord(options);
    });
    return cloudSavePromise;
  }

  function handleBoundFieldChange(field) {
    if (isPublicLocked()) {
      setBoundFieldValue(field, window.TKAContractTemplate.getPathValue(state, field.dataset.bind));
      setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
      return;
    }
    var value = field.type === "checkbox" ? field.checked : field.value;
    window.TKAContractTemplate.setPathValue(state, field.dataset.bind, value);
    if (field.dataset.bind === "transport.choice" && value === "accept" && !text(state.transport.cardType)) {
      state.transport.cardType = "cartaoFlash";
    }
    renderAll();
    queueSave(adminMode ? "Alteracoes pendentes." : "Rascunho salvo automaticamente.");
  }

  function openEmployeeSignatureEditor() {
    if (isPublicLocked()) {
      setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
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
      setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
      return;
    }
    if (!employeeSignaturePad.hasData()) {
      setSaveStatus("Desenhe a assinatura antes de salvar.");
      return;
    }

    state.signature.employeeDataUrl = employeeSignaturePad.read();
    state.signature.updatedAtLabel = new Date().toLocaleString("pt-BR");
    closeEmployeeSignatureEditor();
    renderAll();
    queueSave("Assinatura salva.");
  }

  async function loadOwnerSignature() {
    if (!firebaseDb) return;
    var snapshot = await firebaseDb.collection("system").doc("ownerSignature").get();
    var data = snapshot.data() || {};
    ownerSignatureDataUrl = text(data.signatureDataUrl);
  }

  async function loadRecord() {
    var snapshot = await firebaseDb.collection(COLLECTION_NAME).doc(sample.id).get();
    if (!snapshot.exists) {
      state = window.TKAContractTemplate.buildDefaultState(sample);
      hasCloudRecord = false;
      lastSnapshot = buildSnapshot();
      renderAll();
      setSaveStatus(adminMode ? "Contrato pronto para revisao." : "Preencha vale-transporte e assine para enviar.");
      return;
    }

    var data = snapshot.data() || {};
    applyCloudRecordData(data);
    hasCloudRecord = true;
    lastSnapshot = buildSnapshot();
    renderAll();
    setSaveStatus(adminMode ? "Contrato carregado." : (state.meta.publicSubmittedAt ? "Contrato ja enviado. Edicao bloqueada." : "Rascunho carregado."));
  }

  function validateBeforeSubmit() {
    var issues = currentIssues();
    if (!issues.length) return true;
    setSaveStatus("Pendencia: " + issues[0]);
    return false;
  }

  async function handleSaveClick() {
    if (!adminMode) {
      if (isPublicLocked()) {
        setSaveStatus("Contrato ja enviado. Edicao bloqueada.");
        renderAll();
        return;
      }
      if (!validateBeforeSubmit()) return;
      var previousSubmittedAt = state.meta.publicSubmittedAt;
      state.meta.publicSubmittedAt = previousSubmittedAt || new Date().toISOString();
      elements.saveBtn.disabled = true;
      setSaveStatus("Enviando contrato...");
      try {
        await flushSave({ force: true, submit: true });
      } catch (error) {
        state.meta.publicSubmittedAt = previousSubmittedAt;
        renderAll();
        throw error;
      }
      renderAll();
      return;
    }

    await flushSave({ force: true });
  }

  async function toggleArchive() {
    if (!adminMode) return;
    var nextArchived = !(state.meta.contractStage === "archived" || state.meta.archived);
    state.meta.archived = nextArchived;
    state.meta.contractStage = nextArchived ? "archived" : "current";
    renderAll();
    await flushSave({ force: true });
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

    elements.saveBtn.addEventListener("click", function () {
      handleSaveClick().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel concluir a operacao.");
      });
    });

    elements.exportPdfBtn.addEventListener("click", function () {
      if (elements.exportPdfBtn.disabled) {
        setSaveStatus("Complete vale-transporte e assinatura antes de exportar o PDF.");
        return;
      }
      window.TKAContractPdf.download(sample, state, ownerSignatureDataUrl).catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel gerar o PDF agora.");
      });
    });

    elements.archiveToggleBtn.addEventListener("click", function () {
      toggleArchive().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel atualizar o arquivo.");
      });
    });

    elements.themeToggleBtn.addEventListener("click", function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    });

    elements.backToListLink.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/contrato/");
    });

    elements.backToRhLink.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/");
    });

    elements.employeeSignatureEditBtn.addEventListener("click", openEmployeeSignatureEditor);
    elements.employeeSignatureClearBtn.addEventListener("click", function () {
      if (isPublicLocked()) return;
      employeeSignaturePad.clear();
    });
    elements.employeeSignatureCancelBtn.addEventListener("click", function () {
      closeEmployeeSignatureEditor();
    });
    elements.employeeSignatureSaveBtn.addEventListener("click", saveEmployeeSignature);

    window.addEventListener("resize", function () {
      syncPageScales();
      if (!elements.employeeSignatureEditor.classList.contains("hidden")) {
        employeeSignaturePad.resize();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && !isPublicLocked()) {
        flushSave().catch(function () {});
      }
    });
  }

  async function boot() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    configureMode();
    initializeFirebase();

    var requestedId = text(params.get("id"));
    sample = window.TKAContractTemplate.findSample(requestedId);
    if (!sample) {
      elements.pageTitle.textContent = "Contrato nao encontrado";
      elements.pageSubtitle.textContent = "Use a lista de contratos do RH para abrir um documento valido.";
      setSaveStatus("ID invalido.");
      elements.saveBtn.disabled = true;
      elements.exportPdfBtn.disabled = true;
      return;
    }

    state = window.TKAContractTemplate.buildDefaultState(sample);
    employeeSignaturePad = window.TKASignatureTools.createSignaturePad({
      canvas: elements.employeeSignatureCanvas,
      enabled: false,
      placeholder: "Assine e depois clique em Salvar assinatura"
    });

    await loadOwnerSignature();
    if (!firebaseDb) {
      renderAll();
      setSaveStatus("Firebase nao configurado.");
      return;
    }

    await loadRecord();
    bindStaticEvents();
  }

  boot().catch(function (error) {
    console.error(error);
    setSaveStatus("Nao foi possivel carregar o contrato.");
  });
})();
