(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var RH_GATE_EMAIL_KEY = "rh_gate_email";
  var COLLECTION_NAME = "rh_admission_forms";
  var ENABLE_STORAGE_BACKUPS = false;
  var signatureCanvases = {};
  var COMMERCIAL_EMAILS = {
    "comercial@grupotka.com.br": true,
    "comercial@grupotka": true
  };

  function uid() {
    return Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDependent(data) {
    return {
      id: data && data.id ? data.id : uid(),
      name: data && data.name ? data.name : "",
      relationship: data && data.relationship ? data.relationship : "",
      birthDate: data && data.birthDate ? data.birthDate : "",
      cpf: data && data.cpf ? data.cpf : ""
    };
  }

  function createRoute(data) {
    return {
      id: data && data.id ? data.id : uid(),
      line: data && data.line ? data.line : "",
      operator: data && data.operator ? data.operator : "",
      fare: data && data.fare ? data.fare : ""
    };
  }

  function defaultState() {
    return {
      meta: {
        formId: "",
        status: "em_preenchimento",
        admissionStatus: "pending",
        company: "",
        role: "",
        admissionDate: "",
        rhNotes: "",
        publicSubmittedAt: ""
      },
      personal: {
        fullName: "",
        socialName: "",
        hasDisability: "",
        disabilityDescription: "",
        phone: "",
        email: "",
        motherName: "",
        fatherName: "",
        birthDate: "",
        raceColor: "",
        birthPlace: "",
        birthState: ""
      },
      address: {
        street: "",
        number: "",
        state: "",
        complement: "",
        residenceType: "",
        block: "",
        apartmentNumber: "",
        neighborhood: "",
        city: "",
        cep: ""
      },
      documents: {
        workCardNumber: "",
        workCardSeries: "",
        workCardIssueDate: "",
        workCardIssueState: "",
        rg: "",
        rgIssuer: "",
        rgIssueDate: "",
        cpf: "",
        pisPasep: "",
        voterTitle: "",
        voterZone: "",
        voterSection: "",
        voterState: "",
        reservistCertificate: "",
        reservistSeries: "",
        reservistCategory: ""
      },
      employment: {
        role: "",
        educationLevel: "",
        maritalStatus: "",
        firstJob: "",
        shoeSize: "",
        shirtSize: "",
        tshirtSize: "",
        jacketSize: "",
        pantsSize: "",
        pixKey: "",
        bank: "",
        spouseTaxDependent: ""
      },
      dependents: [createDependent()],
      declaration: {
        name: "",
        place: "",
        date: today(),
        notes: "",
        signatureDataUrl: ""
      },
      lgpd: {
        name: "",
        place: "",
        date: today(),
        agreement: false,
        signatureDataUrl: ""
      },
      transport: {
        accepted: false,
        decision: "",
        street: "",
        number: "",
        state: "",
        neighborhood: "",
        city: "",
        cep: "",
        option: "",
        name: "",
        place: "",
        date: today(),
        signatureDataUrl: ""
      },
      routes: {
        homeToWork: [createRoute()],
        workToHome: [createRoute()]
      },
      finalSignature: {
        name: "",
        place: "",
        date: today(),
        signatureDataUrl: ""
      }
    };
  }

  var state = defaultState();
  var saveTimer = null;
  var cloudSaveTimer = null;
  var cloudSavePromise = Promise.resolve();
  var lastCloudSnapshot = "";
  var firebaseDb = null;
  var firebaseStorage = null;
  var toastTimer = null;
  var publicSubmitFeedbackLocked = false;
  var submitInFlight = false;
  var params = new URLSearchParams(window.location.search);
  var requestedAdminMode = params.get("admin") === "1";
  var adminMode = false;

  var elements = {
    eyebrowLabel: document.getElementById("eyebrowLabel"),
    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),
    backToListLink: document.getElementById("backToListLink"),
    backToRhLink: document.getElementById("backToRhLink"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    saveBtn: document.getElementById("saveBtn"),
    deleteBtn: document.getElementById("deleteBtn"),
    saveStatus: document.getElementById("saveStatus"),
    dependentsList: document.getElementById("dependentsList"),
    homeToWorkList: document.getElementById("homeToWorkList"),
    workToHomeList: document.getElementById("workToHomeList"),
    dependentTemplate: document.getElementById("dependentTemplate"),
    routeTemplate: document.getElementById("routeTemplate"),
    addDependentBtn: document.getElementById("addDependentBtn"),
    addHomeRouteBtn: document.getElementById("addHomeRouteBtn"),
    addWorkRouteBtn: document.getElementById("addWorkRouteBtn"),
    rhSection: document.getElementById("rhSection"),
    admissionForm: document.getElementById("admissionForm"),
    lgpdAgreement: document.getElementById("lgpdAgreement"),
    transportAcceptYes: document.getElementById("transportAcceptYes"),
    transportAcceptNo: document.getElementById("transportAcceptNo"),
    transportSection: document.getElementById("transportSection"),
    homeRouteSection: document.getElementById("homeRouteSection"),
    workRouteSection: document.getElementById("workRouteSection"),
    finalSignatureSection: document.getElementById("finalSignatureSection")
  };

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    elements.themeToggleBtn.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
    localStorage.setItem(THEME_KEY, document.body.dataset.theme);
    redrawAllSignatures();
  }

  function setSaveStatus(text) {
    elements.saveStatus.textContent = text;
    elements.saveStatus.classList.toggle("is-quiet", !adminMode && (!text || text === "Preenchimento salvo automaticamente."));
    elements.saveStatus.classList.toggle("is-success", /sucesso/i.test(String(text || "")));
  }

  function hasLockedSubmitFeedback() {
    return !adminMode && publicSubmitFeedbackLocked;
  }

  function lockSubmitFeedback(message) {
    publicSubmitFeedbackLocked = true;
    setSaveStatus(message);
  }

  function unlockSubmitFeedback() {
    publicSubmitFeedbackLocked = false;
  }

  function showSuccessToast(message) {
    clearTimeout(toastTimer);
    var current = document.querySelector(".toast");
    if (current) current.remove();
    var toast = document.createElement("div");
    toast.className = "toast is-success";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);
    window.requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.remove();
    }, 3200);
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
    firebaseStorage = ENABLE_STORAGE_BACKUPS ? firebase.storage() : null;
  }

  function updateUrlWithId(formId) {
    var url = new URL(window.location.href);
    url.searchParams.set("id", formId);
    if (adminMode) {
      url.searchParams.set("admin", "1");
    } else {
      url.searchParams.delete("admin");
    }
    window.history.replaceState({}, "", url.toString());
  }

  function getPathValue(object, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc && acc[key] !== undefined ? acc[key] : "";
    }, object);
  }

  function setPathValue(object, path, value) {
    var keys = path.split(".");
    var target = object;
    for (var i = 0; i < keys.length - 1; i += 1) {
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
  }

  function applySmartDefaults() {
    var fullName = String(state.personal.fullName || "").trim();
    var city = String(state.address.city || "").trim();

    if (fullName) {
      if (!String(state.declaration.name || "").trim()) state.declaration.name = fullName;
      if (!String(state.lgpd.name || "").trim()) state.lgpd.name = fullName;
      if (!String(state.transport.name || "").trim()) state.transport.name = fullName;
      if (!String(state.finalSignature.name || "").trim()) state.finalSignature.name = fullName;
    }

    if (city) {
      if (!String(state.declaration.place || "").trim()) state.declaration.place = city;
      if (!String(state.lgpd.place || "").trim()) state.lgpd.place = city;
      if (!String(state.transport.place || "").trim()) state.transport.place = city;
      if (!String(state.finalSignature.place || "").trim()) state.finalSignature.place = city;
    }

    if (!String(state.meta.role || "").trim() && String(state.employment.role || "").trim()) {
      state.meta.role = state.employment.role;
    }

    if (!String(state.transport.street || "").trim()) state.transport.street = state.address.street || "";
    if (!String(state.transport.number || "").trim()) state.transport.number = state.address.number || "";
    if (!String(state.transport.state || "").trim()) state.transport.state = state.address.state || "";
    if (!String(state.transport.neighborhood || "").trim()) state.transport.neighborhood = state.address.neighborhood || "";
    if (!String(state.transport.city || "").trim()) state.transport.city = state.address.city || "";
    if (!String(state.transport.cep || "").trim()) state.transport.cep = state.address.cep || "";
  }

  function syncAutoFilledField(path) {
    var field = document.querySelector('[data-bind="' + path + '"]');
    if (!field) return;
    var nextValue = getPathValue(state, path) || "";
    if (!field.value) field.value = nextValue;
  }

  function reflectSmartDefaults() {
    [
      "declaration.name",
      "declaration.place",
      "lgpd.name",
      "lgpd.place",
      "transport.name",
      "transport.place",
      "transport.street",
      "transport.number",
      "transport.state",
      "transport.neighborhood",
      "transport.city",
      "transport.cep",
      "finalSignature.name",
      "finalSignature.place"
    ].forEach(syncAutoFilledField);
  }

  function populateStaticFields() {
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      var value = getPathValue(state, field.dataset.bind);
      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value || "";
      }
    });
    syncTransportChoiceInputs();
  }

  function syncStaticFields() {
    document.querySelectorAll("[data-bind]").forEach(function (field) {
      var value = field.type === "checkbox" ? field.checked : field.value;
      setPathValue(state, field.dataset.bind, value);
    });
    applySmartDefaults();
    reflectSmartDefaults();
    updateTransportAvailability();
  }

  function formatRequiredLabels() {
    document.querySelectorAll("label .required-mark").forEach(function (mark) {
      var label = mark.closest("label");
      if (!label || label.querySelector(".label-title")) return;
      var title = document.createElement("span");
      title.className = "label-title";
      var firstControl = label.querySelector("input, select, textarea");
      var nodesToMove = [];
      for (var index = 0; index < label.childNodes.length; index += 1) {
        var node = label.childNodes[index];
        if (node === firstControl) break;
        nodesToMove.push(node);
      }
      nodesToMove.forEach(function (node) {
        title.appendChild(node);
      });
      var textContent = title.textContent.replace(/\s+/g, " ").trim();
      var requiredMark = title.querySelector(".required-mark");
      if (requiredMark) {
        var cleanText = textContent.replace("*", "").trim();
        title.textContent = "";
        title.appendChild(document.createTextNode(cleanText + ": "));
        title.appendChild(requiredMark);
      }
      label.insertBefore(title, firstControl);
    });
  }

  function syncTransportChoiceInputs() {
    elements.transportAcceptYes.checked = state.transport.decision === "accept";
    elements.transportAcceptNo.checked = state.transport.decision === "decline";
  }

  function createSignaturePalette() {
    var darkMode = document.body.dataset.theme === "dark";
    return {
      background: darkMode ? "#10181f" : "#fffdfa",
      line: darkMode ? "#f6f3ee" : "#281b16",
      guide: darkMode ? "rgba(148, 163, 184, 0.20)" : "rgba(64, 44, 31, 0.10)"
    };
  }

  function drawSignatureBackground(key) {
    var entry = signatureCanvases[key];
    if (!entry || !entry.ctx) return;
    var canvas = entry.canvas;
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var width = canvas.width / ratio;
    var height = canvas.height / ratio;
    var palette = createSignaturePalette();

    entry.ctx.save();
    entry.ctx.clearRect(0, 0, width, height);
    entry.ctx.fillStyle = palette.background;
    entry.ctx.fillRect(0, 0, width, height);
    entry.ctx.strokeStyle = palette.guide;
    entry.ctx.lineWidth = 1;
    entry.ctx.beginPath();
    entry.ctx.moveTo(18, height - 36);
    entry.ctx.lineTo(width - 18, height - 36);
    entry.ctx.stroke();
    entry.ctx.restore();
  }

  function redrawStoredSignature(key) {
    var entry = signatureCanvases[key];
    var signatureDataUrl = getPathValue(state, key + ".signatureDataUrl");
    if (!entry || !entry.ctx || !signatureDataUrl) return;
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var width = entry.canvas.width / ratio;
    var height = entry.canvas.height / ratio;
    var image = new Image();
    image.onload = function () {
      drawSignatureBackground(key);
      entry.ctx.drawImage(image, 0, 0, width, height);
    };
    image.src = signatureDataUrl;
  }

  function redrawAllSignatures() {
    Object.keys(signatureCanvases).forEach(function (key) {
      drawSignatureBackground(key);
      redrawStoredSignature(key);
    });
  }

  function resizeSignatureCanvas(key) {
    var entry = signatureCanvases[key];
    if (!entry) return;
    var canvas = entry.canvas;
    var rect = canvas.getBoundingClientRect();
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var width = Math.max(Math.round(rect.width || canvas.offsetWidth || 300), 300);
    var height = 180;
    if (canvas.width === width * ratio && canvas.height === height * ratio) return;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    entry.ctx = canvas.getContext("2d");
    entry.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    entry.ctx.lineCap = "round";
    entry.ctx.lineJoin = "round";
    entry.ctx.lineWidth = 2.2;
    drawSignatureBackground(key);
    redrawStoredSignature(key);
  }

  function saveSignature(key) {
    var entry = signatureCanvases[key];
    if (!entry) return;
    setPathValue(state, key + ".signatureDataUrl", entry.canvas.toDataURL("image/png"));
    updateSubmitAvailability();
    queueSave("Alteracoes pendentes.");
  }

  function signaturePoint(event, canvas) {
    var source = event.touches ? event.touches[0] : event.changedTouches ? event.changedTouches[0] : event;
    var rect = canvas.getBoundingClientRect();
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  }

  function setupSignatureCanvas(key, canvas) {
    signatureCanvases[key] = {
      canvas: canvas,
      ctx: null,
      isDrawing: false
    };
    resizeSignatureCanvas(key);

    function startDrawing(event) {
      event.preventDefault();
      var entry = signatureCanvases[key];
      var point = signaturePoint(event, canvas);
      entry.isDrawing = true;
      entry.ctx.strokeStyle = createSignaturePalette().line;
      entry.ctx.beginPath();
      entry.ctx.moveTo(point.x, point.y);
    }

    function moveDrawing(event) {
      var entry = signatureCanvases[key];
      if (!entry.isDrawing) return;
      event.preventDefault();
      var point = signaturePoint(event, canvas);
      entry.ctx.lineTo(point.x, point.y);
      entry.ctx.stroke();
    }

    function endDrawing(event) {
      var entry = signatureCanvases[key];
      if (!entry.isDrawing) return;
      event.preventDefault();
      entry.isDrawing = false;
      saveSignature(key);
    }

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", moveDrawing);
    canvas.addEventListener("mouseup", endDrawing);
    canvas.addEventListener("mouseleave", endDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", moveDrawing, { passive: false });
    canvas.addEventListener("touchend", endDrawing, { passive: false });
    canvas.addEventListener("touchcancel", endDrawing, { passive: false });
  }

  function initializeSignatures() {
    document.querySelectorAll("[data-signature-canvas]").forEach(function (canvas) {
      setupSignatureCanvas(canvas.dataset.signatureCanvas, canvas);
    });
    document.querySelectorAll("[data-clear-signature]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.clearSignature;
        setPathValue(state, key + ".signatureDataUrl", "");
        drawSignatureBackground(key);
        updateSubmitAvailability();
        queueSave("Alteracoes pendentes.");
      });
    });
  }

  function renderArray(options) {
    var container = options.container;
    var template = options.template;
    var items = options.items;
    var disabled = Boolean(options.disabled);
    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = '<div class="empty-state">' + options.emptyMessage + "</div>";
      return;
    }

    items.forEach(function (item, index) {
      var fragment = template.content.cloneNode(true);
      var node = fragment.firstElementChild;
      var title = node.querySelector("[data-row-title]");
      var removeButton = node.querySelector("[data-remove-row]");

      title.textContent = options.rowLabel + " " + (index + 1);
      removeButton.disabled = disabled;
      node.classList.toggle("is-disabled", disabled);

      node.querySelectorAll("[data-field]").forEach(function (field) {
        var key = field.dataset.field;
        field.value = item[key] || "";
        field.disabled = disabled;
        field.addEventListener("input", function () {
          item[key] = field.value;
          queueSave("Alteracoes pendentes.");
        });
        field.addEventListener("change", function () {
          item[key] = field.value;
          queueSave("Alteracoes pendentes.");
        });
      });

      removeButton.addEventListener("click", function () {
        if (disabled) return;
        items.splice(index, 1);
        renderDynamicSections();
        queueSave("Alteracoes pendentes.");
      });

      container.appendChild(node);
    });
  }

  function renderDynamicSections() {
    renderArray({
      container: elements.dependentsList,
      template: elements.dependentTemplate,
      items: state.dependents,
      rowLabel: "Dependente",
      emptyMessage: "Nenhum dependente adicionado."
    });

    renderArray({
      container: elements.homeToWorkList,
      template: elements.routeTemplate,
      items: state.routes.homeToWork,
      rowLabel: "Linha",
      emptyMessage: "Nenhuma linha informada.",
      disabled: !state.transport.accepted
    });

    renderArray({
      container: elements.workToHomeList,
      template: elements.routeTemplate,
      items: state.routes.workToHome,
      rowLabel: "Linha",
      emptyMessage: "Nenhuma linha informada.",
      disabled: !state.transport.accepted
    });
  }

  function clearTransportData() {
    state.transport.street = "";
    state.transport.number = "";
    state.transport.state = "";
    state.transport.neighborhood = "";
    state.transport.city = "";
    state.transport.cep = "";
    state.transport.option = "";
    state.transport.name = "";
    state.transport.place = "";
    state.transport.date = today();
    state.routes.homeToWork = [createRoute()];
    state.routes.workToHome = [createRoute()];
  }

  function updateTransportAvailability() {
    var enabled = Boolean(state.transport.accepted);
    elements.transportSection.classList.toggle("transport-disabled", !enabled);
    document.querySelectorAll("[data-transport-field]").forEach(function (field) {
      field.disabled = !enabled;
    });
    elements.addHomeRouteBtn.disabled = !enabled;
    elements.addWorkRouteBtn.disabled = !enabled;
    elements.homeRouteSection.classList.toggle("transport-disabled", !enabled);
    elements.workRouteSection.classList.toggle("transport-disabled", !enabled);
    updateSubmitAvailability();
  }

  function hasTransportDecision() {
    return state.transport.decision === "accept" || state.transport.decision === "decline";
  }

  function publicPendingItems() {
    var items = [];
    var requiredIssues = window.TKAAdmissionRules ? window.TKAAdmissionRules.requiredIssues(state) : [];
    items = items.concat(requiredIssues);
    if (!Boolean(state.lgpd.agreement)) items.push("Aceite LGPD");
    if (!hasTransportDecision()) items.push("Opcao Vale Transporte");
    if (!hasFinalSignature()) items.push("Assinatura");
    return items;
  }

  function updateSubmitAvailability() {
    if (adminMode) {
      elements.saveBtn.disabled = false;
      elements.saveBtn.removeAttribute("title");
      return;
    }
    var pending = publicPendingItems();
    elements.saveBtn.disabled = pending.length > 0;
    if (pending.length) {
      elements.saveBtn.setAttribute("title", "Pendencia: " + pending.join(", "));
    } else {
      elements.saveBtn.removeAttribute("title");
      if (!hasLockedSubmitFeedback() && elements.saveStatus.textContent.indexOf("Pendencia:") === 0) {
        setSaveStatus("Preenchimento salvo automaticamente.");
      }
    }
  }

  function normalizeLoadedState(loaded) {
    var incoming = loaded || {};
    var base = defaultState();
    var transport = Object.assign({}, base.transport, incoming.transport || {});
    if (!transport.decision) {
      transport.decision = transport.accepted ? "accept" : "";
    }
    return {
      meta: Object.assign({}, base.meta, incoming.meta || {}),
      personal: Object.assign({}, base.personal, incoming.personal || {}),
      address: Object.assign({}, base.address, incoming.address || {}),
      documents: Object.assign({}, base.documents, incoming.documents || {}),
      employment: Object.assign({}, base.employment, incoming.employment || {}),
      dependents: Array.isArray(incoming.dependents) ? incoming.dependents.map(createDependent) : base.dependents,
      declaration: Object.assign({}, base.declaration, incoming.declaration || {}),
      lgpd: Object.assign({}, base.lgpd, incoming.lgpd || {}),
      transport: transport,
      routes: {
        homeToWork: Array.isArray(incoming.routes && incoming.routes.homeToWork) ? incoming.routes.homeToWork.map(createRoute) : base.routes.homeToWork,
        workToHome: Array.isArray(incoming.routes && incoming.routes.workToHome) ? incoming.routes.workToHome.map(createRoute) : base.routes.workToHome
      },
      finalSignature: Object.assign({}, base.finalSignature, incoming.finalSignature || {})
    };
  }

  function hasMinimumData() {
    return Boolean(String(state.personal.fullName || "").trim() || String(state.documents.cpf || "").trim());
  }

  function hasFinalSignature() {
    return Boolean(String(state.finalSignature.signatureDataUrl || "").trim());
  }

  function sanitizeRecordForCloud(data) {
    var clean = clone(data);
    clean.meta.formId = state.meta.formId || clean.meta.formId || "";
    delete clean.files;
    return clean;
  }

  function buildCloudSnapshot(payload) {
    return JSON.stringify({
      source: payload.source,
      data: payload.data
    });
  }

  function buildBackupPayload(source, data) {
    return {
      backupVersion: 1,
      source: source,
      formId: state.meta.formId || "",
      savedAt: new Date().toISOString(),
      data: data
    };
  }

  async function persistBackupRecord(source, data, options) {
    options = options || {};
    if (!ENABLE_STORAGE_BACKUPS || !firebaseStorage || !state.meta.formId) return false;

    var payload = buildBackupPayload(source, data);
    var stamp = new Date().toISOString().replace(/[:.]/g, "-");
    var basePath = "rh-admission-backups/" + state.meta.formId;
    var latestRef = firebaseStorage.ref(basePath + "/latest.json");
    var latestBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    await latestRef.put(latestBlob, { contentType: "application/json" });

    if (options.manual || options.publicSubmit || options.force) {
      var snapshotRef = firebaseStorage.ref(basePath + "/snapshots/" + stamp + ".json");
      await snapshotRef.put(latestBlob, { contentType: "application/json" });
    }

    return true;
  }

  async function loadRecordFromCloud() {
    var formId = params.get("id");
    if (!formId || !firebaseDb) {
      elements.deleteBtn.classList.toggle("hidden", !adminMode || !state.meta.formId);
      updateTransportAvailability();
      return;
    }

    var snapshot = await firebaseDb.collection(COLLECTION_NAME).doc(formId).get();
    if (!snapshot.exists) {
      setSaveStatus("Cadastro nao encontrado.");
      elements.deleteBtn.classList.add("hidden");
      updateTransportAvailability();
      return;
    }

    var record = snapshot.data() || {};
    state = normalizeLoadedState(record.data || record);
    state.meta.formId = formId;
    publicSubmitFeedbackLocked = Boolean(!adminMode && state.meta.publicSubmittedAt);
    lastCloudSnapshot = buildCloudSnapshot({
      source: record.source || (adminMode ? "rh-admission-manual" : "public-admission-form"),
      data: sanitizeRecordForCloud(state)
    });

    populateStaticFields();
    applySmartDefaults();
    reflectSmartDefaults();
    renderDynamicSections();
    updateTransportAvailability();
    redrawAllSignatures();
    elements.deleteBtn.classList.toggle("hidden", !adminMode);
    setSaveStatus(adminMode ? "Alteracoes salvas." : (state.meta.publicSubmittedAt ? "Enviado com sucesso." : "Preenchimento salvo automaticamente."));
  }

  async function persistRecord(options) {
    options = options || {};

    if (!firebaseDb) {
      if (options.manual) setSaveStatus("Salvamento indisponivel no momento.");
      return false;
    }

    if (!hasMinimumData()) {
      if (options.manual) setSaveStatus("Informe ao menos nome completo ou CPF para salvar.");
      return false;
    }

    applySmartDefaults();
    var isNew = !state.meta.formId;
    var docRef = isNew ? firebaseDb.collection(COLLECTION_NAME).doc() : firebaseDb.collection(COLLECTION_NAME).doc(state.meta.formId);
    if (isNew) state.meta.formId = docRef.id;

    var source = adminMode ? "rh-admission-manual" : "public-admission-form";
    var cleanData = sanitizeRecordForCloud(state);
    var nextSnapshot = buildCloudSnapshot({
      source: source,
      data: cleanData
    });

    if (!options.force && nextSnapshot === lastCloudSnapshot) {
      if (options.manual || options.publicSubmit) {
        setSaveStatus(options.publicSubmit ? "Ficha assinada e salva." : "Alteracoes salvas.");
      }
      return true;
    }

    var payload = {
      source: source,
      data: cleanData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (isNew) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await docRef.set(payload, { merge: true });
    lastCloudSnapshot = nextSnapshot;
    updateUrlWithId(state.meta.formId);
    elements.deleteBtn.classList.toggle("hidden", !adminMode);
    setSaveStatus(options.publicSubmit ? "Ficha assinada e salva." : "Alteracoes salvas em " + new Date().toLocaleTimeString("pt-BR"));
    return true;
  }

  function scheduleCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = window.setTimeout(function () {
      flushCloudSave().catch(function (error) {
        console.error(error);
      });
    }, 900);
  }

  function flushCloudSave(options) {
    clearTimeout(cloudSaveTimer);
    cloudSavePromise = cloudSavePromise
      .then(function () {
        return persistRecord(options);
      })
      .catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel salvar agora.");
        return false;
      });
    return cloudSavePromise;
  }

  function queueSave(message) {
    clearTimeout(saveTimer);
    if (adminMode) {
      setSaveStatus(message || "Alteracoes pendentes.");
    } else {
      if (hasLockedSubmitFeedback()) unlockSubmitFeedback();
      setSaveStatus("Preenchimento salvo automaticamente.");
    }
    saveTimer = window.setTimeout(function () {
      saveTimer = null;
    }, 400);
    scheduleCloudSave();
  }

  async function deleteCurrentRecord() {
    if (!adminMode || !state.meta.formId || !firebaseDb) return;
    var ok = window.confirm("Arquivar esta ficha de admissao? Ela continuara preservada na base do RH.");
    if (!ok) return;
    state.meta.admissionStage = "archived";
    state.meta.archived = true;
    state.meta.archivedAt = new Date().toISOString();
    state.meta.archiveReason = state.meta.archiveReason || "archived_from_editor";
    await firebaseDb.collection(COLLECTION_NAME).doc(state.meta.formId).set({
      data: sanitizeRecordForCloud(state),
      archived: true,
      archivedAt: state.meta.archivedAt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    window.location.assign(window.location.origin + "/recursos-humanos/admissao/");
  }

  function configureMode() {
    adminMode = requestedAdminMode && hasRhAccess();

    elements.eyebrowLabel.textContent = adminMode ? "Recursos Humanos" : "Ficha de Admiss\u00e3o";
    elements.pageTitle.textContent = "Ficha de Admiss\u00e3o";
    elements.pageSubtitle.textContent = adminMode ? "Cadastro e revisao de admiss\u00e3o." : "Preencha os dados, assine no final e clique em Enviar.";
    elements.backToListLink.classList.toggle("hidden", !adminMode);
    elements.backToRhLink.classList.toggle("hidden", !adminMode);
    elements.rhSection.classList.toggle("hidden", !adminMode);
    elements.deleteBtn.classList.toggle("hidden", !adminMode || !state.meta.formId);
    elements.exportPdfBtn.classList.toggle("hidden", !adminMode);
  }

  function validatePublicSubmit() {
    var pending = publicPendingItems();
    updateSubmitAvailability();
    if (pending.length) {
      setSaveStatus("Pendencia: " + pending.join(", "));
    }
    if ((window.TKAAdmissionRules ? window.TKAAdmissionRules.requiredIssues(state) : []).length) {
      var firstRequired = pending[0];
      if (firstRequired) {
        var requiredField = document.querySelector('[data-bind="' + ({
          "Nome completo": "personal.fullName",
          "Telefone": "personal.phone",
          "E-mail": "personal.email",
          "Nome da mae": "personal.motherName",
          "Data de nascimento": "personal.birthDate",
          "Endereco": "address.street",
          "Numero": "address.number",
          "CEP": "address.cep",
          "Carteira de trabalho": "documents.workCardNumber",
          "CPF": "documents.cpf",
          "PIS": "documents.pisPasep",
          "Grau de escolaridade": "employment.educationLevel",
          "Estado civil": "employment.maritalStatus",
          "Chave Pix": "employment.pixKey",
          "Banco": "employment.bank",
          "Nome LGPD": "lgpd.name",
          "Local LGPD": "lgpd.place",
          "Data LGPD": "lgpd.date"
        }[firstRequired] || "") + '"]');
        if (requiredField) {
          requiredField.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return false;
    }
    if (!Boolean(state.lgpd.agreement)) {
      elements.lgpdAgreement.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (!hasTransportDecision()) {
      elements.transportSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    if (!hasFinalSignature()) {
      elements.finalSignatureSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    return true;
  }

  function releaseSubmitState() {
    submitInFlight = false;
    elements.saveBtn.removeAttribute("aria-busy");
    updateSubmitAvailability();
  }

  async function handleSaveClick() {
    if (submitInFlight) return;
    try {
      submitInFlight = true;
      elements.saveBtn.disabled = true;
      elements.saveBtn.setAttribute("aria-busy", "true");
      syncStaticFields();
      if (!adminMode) {
        var previousSubmittedAt = state.meta.publicSubmittedAt;
        var previousStatus = state.meta.status;
        if (!validatePublicSubmit()) return;
        if (!state.meta.publicSubmittedAt) {
          state.meta.publicSubmittedAt = new Date().toISOString();
        }
        if (state.meta.status === "em_preenchimento") {
          state.meta.status = "recebido";
        }
        var saved = await flushCloudSave({ manual: true, force: true, publicSubmit: true });
        if (!saved) {
          state.meta.publicSubmittedAt = previousSubmittedAt;
          state.meta.status = previousStatus;
          updateSubmitAvailability();
          return;
        }
        lockSubmitFeedback("Enviado com sucesso.");
        showSuccessToast("Enviado com sucesso.");
        return;
      }
      await flushCloudSave({ manual: true, force: true });
    } finally {
      releaseSubmitState();
    }
  }

  function attachStaticEvents() {
    elements.admissionForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleSaveClick().catch(function (error) {
        console.error(error);
      });
    });

    document.querySelectorAll("[data-bind]").forEach(function (field) {
      function syncField() {
        var value = field.type === "checkbox" ? field.checked : field.value;
        setPathValue(state, field.dataset.bind, value);
        applySmartDefaults();
        reflectSmartDefaults();
        updateTransportAvailability();
        queueSave("Alteracoes pendentes.");
      }

      field.addEventListener("input", syncField);
      field.addEventListener("change", syncField);
    });

    elements.addDependentBtn.addEventListener("click", function () {
      state.dependents.push(createDependent());
      renderDynamicSections();
      queueSave("Alteracoes pendentes.");
    });

    elements.transportAcceptYes.addEventListener("change", function () {
      state.transport.decision = elements.transportAcceptYes.checked ? "accept" : "";
      state.transport.accepted = elements.transportAcceptYes.checked;
      if (elements.transportAcceptYes.checked) {
        elements.transportAcceptNo.checked = false;
      } else {
        clearTransportData();
      }
      applySmartDefaults();
      reflectSmartDefaults();
      renderDynamicSections();
      updateTransportAvailability();
      queueSave("Alteracoes pendentes.");
    });

    elements.transportAcceptNo.addEventListener("change", function () {
      state.transport.decision = elements.transportAcceptNo.checked ? "decline" : "";
      state.transport.accepted = false;
      if (elements.transportAcceptNo.checked) {
        elements.transportAcceptYes.checked = false;
        clearTransportData();
      }
      renderDynamicSections();
      updateTransportAvailability();
      queueSave("Alteracoes pendentes.");
    });

    elements.addHomeRouteBtn.addEventListener("click", function () {
      if (!state.transport.accepted) return;
      state.routes.homeToWork.push(createRoute());
      renderDynamicSections();
      queueSave("Alteracoes pendentes.");
    });

    elements.addWorkRouteBtn.addEventListener("click", function () {
      if (!state.transport.accepted) return;
      state.routes.workToHome.push(createRoute());
      renderDynamicSections();
      queueSave("Alteracoes pendentes.");
    });

    elements.saveBtn.addEventListener("click", function () {
      handleSaveClick().catch(function (error) {
        console.error(error);
      });
    });

    elements.saveBtn.addEventListener("mouseenter", function () {
      if (!adminMode && elements.saveBtn.disabled && elements.saveBtn.title) {
        setSaveStatus(elements.saveBtn.title);
      }
    });

    elements.saveBtn.addEventListener("mouseleave", function () {
      if (!adminMode && !hasLockedSubmitFeedback()) {
        setSaveStatus("Preenchimento salvo automaticamente.");
      }
    });

    elements.deleteBtn.addEventListener("click", function () {
      deleteCurrentRecord().catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel arquivar a ficha.");
      });
    });

    elements.exportPdfBtn.addEventListener("click", function () {
      if (!window.TKAAdmissionPdf || !state.meta.formId) {
        setSaveStatus("PDF indisponivel no momento.");
        return;
      }
      window.TKAAdmissionPdf.download(state).catch(function (error) {
        console.error(error);
        setSaveStatus("Nao foi possivel gerar o PDF agora.");
      });
    });

    elements.themeToggleBtn.addEventListener("click", function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    });

    window.addEventListener("resize", function () {
      Object.keys(signatureCanvases).forEach(resizeSignatureCanvas);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        flushCloudSave().catch(function () {});
      }
    });
  }

  function wireNavigation() {
    elements.backToListLink.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/admissao/");
    });

    elements.backToRhLink.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/recursos-humanos/");
    });
  }

  initializeFirebase();
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  configureMode();
  populateStaticFields();
  formatRequiredLabels();
  applySmartDefaults();
  reflectSmartDefaults();
  renderDynamicSections();
  initializeSignatures();
  updateTransportAvailability();
  wireNavigation();
  attachStaticEvents();
  setSaveStatus(adminMode ? "Alteracoes salvas." : "Preenchimento salvo automaticamente.");
  loadRecordFromCloud().catch(function (error) {
    console.error(error);
    setSaveStatus("Nao foi possivel carregar o cadastro.");
  });
})();
