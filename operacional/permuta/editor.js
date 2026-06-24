(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var COLLECTION = "operacional_permuta_forms";
  var state = { id: "", currentUser: null, publicMode: false, loadedRecord: null, dirtyFields: {}, dirtySerial: 0, autoSaveTimer: null, savePromise: Promise.resolve() };
  var db = null;
  var params = new URLSearchParams(window.location.search);
  var signaturePads = {};
  var blankSignatureDataUrl = "";

  var el = {
    pageTitle: document.getElementById("pageTitle"),
    backToListLink: document.getElementById("backToListLink"),
    homeLink: document.getElementById("homeLink"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    copyPublicLinkBtn: document.getElementById("copyPublicLinkBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    saveBtn: document.getElementById("saveBtn"),
    saveStatus: document.getElementById("saveStatus"),
    statusChip: document.getElementById("statusChip"),
    placeName: document.getElementById("placeName"),
    requestDate: document.getElementById("requestDate"),
    shiftDate: document.getElementById("shiftDate"),
    shiftStart: document.getElementById("shiftStart"),
    shiftEnd: document.getElementById("shiftEnd"),
    notes: document.getElementById("notes"),
    employeeAName: document.getElementById("employeeAName"),
    employeeACpf: document.getElementById("employeeACpf"),
    employeeARg: document.getElementById("employeeARg"),
    employeeADate1: document.getElementById("employeeADate1"),
    employeeASignature: document.getElementById("employeeASignature"),
    employeeBName: document.getElementById("employeeBName"),
    employeeBCpf: document.getElementById("employeeBCpf"),
    employeeBRg: document.getElementById("employeeBRg"),
    employeeBDate1: document.getElementById("employeeBDate1"),
    employeeBSignature: document.getElementById("employeeBSignature"),
    supervisorName: document.getElementById("supervisorName"),
    supervisorSignature: document.getElementById("supervisorSignature")
  };

  function uid() {
    return Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

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

  function hasOperationalAccess(user) {
    return Boolean(user && user.permissions && (user.permissions.operacional || user.permissions.admin));
  }

  function setStatus(text) {
    el.saveStatus.textContent = text;
  }

  function setPendingAutoSaveStatus() {
    if (!state.publicMode) return;
    setStatus("Alteracoes pendentes. Salvando automaticamente...");
  }

  function markDirty(fieldName) {
    if (!fieldName) return;
    state.dirtySerial += 1;
    state.dirtyFields[fieldName] = state.dirtySerial;
  }

  function dirtySnapshot() {
    return Object.assign({}, state.dirtyFields || {});
  }

  function dirtyFieldNames(snapshot) {
    return Object.keys(snapshot || state.dirtyFields || {});
  }

  function clearDirtySnapshot(snapshot) {
    Object.keys(snapshot || {}).forEach(function (fieldName) {
      if (state.dirtyFields[fieldName] === snapshot[fieldName]) {
        delete state.dirtyFields[fieldName];
      }
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

  function statusMessage(record) {
    var status = deriveStatus(record);
    if (status === "complete") return "Permuta completa salva.";
    if (status === "waiting_approval") return "Permuta salva aguardando aprovacao do supervisor.";
    return "Permuta incompleta salva.";
  }

  function pendingSummary(record) {
    var status = deriveStatus(record);
    var issues = status === "waiting_approval" ? approvalIssues(record) : coreIssues(record);
    if (!issues.length) return "Sem pendencias";
    return issues.slice(0, 4).join(", ") + (issues.length > 4 ? "..." : "");
  }

  function updateStatusChip(record) {
    var status = deriveStatus(record || readRecord());
    el.statusChip.textContent = statusLabel(status);
    el.statusChip.dataset.status = status;
    if (status === "complete") {
      el.statusChip.title = "As tres assinaturas foram registradas.";
    } else if (status === "waiting_approval") {
      el.statusChip.title = "Pendencia: " + pendingSummary(record || readRecord());
    } else {
      el.statusChip.title = "Pendencia: " + pendingSummary(record || readRecord());
    }
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

  function updateUrlWithId(id) {
    var url = new URL(window.location.href);
    url.searchParams.set("id", id);
    if (state.publicMode) {
      url.searchParams.set("public", "1");
    } else {
      url.searchParams.delete("public");
    }
    window.history.replaceState({}, "", url.toString());
  }

  function updateModeUi() {
    if (state.publicMode) {
      el.pageTitle.textContent = state.id ? "Permuta compartilhada" : "Nova Permuta";
      if (el.backToListLink) el.backToListLink.classList.add("hidden");
      if (el.homeLink) el.homeLink.classList.add("hidden");
    } else {
      el.pageTitle.textContent = state.id ? "Editar Permuta" : "Nova Permuta";
      if (el.backToListLink) el.backToListLink.classList.remove("hidden");
      if (el.homeLink) el.homeLink.classList.remove("hidden");
    }
    el.copyPublicLinkBtn.disabled = !state.id;
    el.copyPublicLinkBtn.title = state.id ? "Copiar o link compartilhado desta permuta." : "Salve a permuta para gerar o link compartilhado.";
  }

  function blankRecord() {
    return {
      id: state.id || "",
      placeName: "",
      requestDate: today(),
      shiftDate: "",
      shiftStart: "",
      shiftEnd: "",
      notes: "",
      employeeAName: "",
      employeeACpf: "",
      employeeARg: "",
      employeeADate1: "",
      employeeASignatureDataUrl: "",
      employeeBName: "",
      employeeBCpf: "",
      employeeBRg: "",
      employeeBDate1: "",
      employeeBSignatureDataUrl: "",
      supervisorName: "",
      supervisorSignatureDataUrl: "",
      status: "incomplete",
      archived: false
    };
  }

  function applyStatusMetadata(record) {
    var status = deriveStatus(record);
    record.status = status;
    record.completed = status === "complete";
    record.approvalStatus = status === "complete" ? "approved" : (status === "waiting_approval" ? "pending" : "incomplete");
    record.completedAt = status === "complete" ? (record.completedAt || new Date().toISOString()) : "";
    return record;
  }

  function readRecord(options) {
    options = options || {};
    var previous = state.loadedRecord || {};
    var record = Object.assign({}, previous, {
      id: state.id || (options.allocateId ? uid() : ""),
      placeName: el.placeName.value.trim(),
      requestDate: el.requestDate.value,
      shiftDate: el.shiftDate.value,
      shiftStart: el.shiftStart.value,
      shiftEnd: el.shiftEnd.value,
      notes: el.notes.value.trim(),
      employeeAName: el.employeeAName.value.trim(),
      employeeACpf: el.employeeACpf.value.trim(),
      employeeARg: el.employeeARg.value.trim(),
      employeeADate1: el.employeeADate1.value,
      employeeASignatureDataUrl: signaturePads.employeeA.read(),
      employeeBName: el.employeeBName.value.trim(),
      employeeBCpf: el.employeeBCpf.value.trim(),
      employeeBRg: el.employeeBRg.value.trim(),
      employeeBDate1: el.employeeBDate1.value,
      employeeBSignatureDataUrl: signaturePads.employeeB.read(),
      supervisorName: el.supervisorName.value.trim(),
      supervisorSignatureDataUrl: signaturePads.supervisor.read()
    });
    return applyStatusMetadata(record);
  }

  function fillRecord(record) {
    var data = record || blankRecord();
    el.placeName.value = data.placeName || "";
    el.requestDate.value = data.requestDate || today();
    el.shiftDate.value = data.shiftDate || "";
    el.shiftStart.value = data.shiftStart || "";
    el.shiftEnd.value = data.shiftEnd || "";
    el.notes.value = data.notes || "";
    el.employeeAName.value = data.employeeAName || "";
    el.employeeACpf.value = data.employeeACpf || "";
    el.employeeARg.value = data.employeeARg || "";
    el.employeeADate1.value = data.employeeADate1 || "";
    el.employeeBName.value = data.employeeBName || "";
    el.employeeBCpf.value = data.employeeBCpf || "";
    el.employeeBRg.value = data.employeeBRg || "";
    el.employeeBDate1.value = data.employeeBDate1 || "";
    el.supervisorName.value = data.supervisorName || "";
    signaturePads.employeeA.write(data.employeeASignatureDataUrl || "");
    signaturePads.employeeB.write(data.employeeBSignatureDataUrl || "");
    signaturePads.supervisor.write(data.supervisorSignatureDataUrl || "");
    updateModeUi();
    updateStatusChip(data);
  }

  function createSignaturePad(canvas) {
    var context = canvas.getContext("2d");
    var hasInk = false;
    var storedDataUrl = "";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#2f241f";
    var drawing = false;
    function point(event) {
      var rect = canvas.getBoundingClientRect();
      var source = event.touches && event.touches[0] ? event.touches[0] : event;
      return { x: (source.clientX - rect.left) * (canvas.width / rect.width), y: (source.clientY - rect.top) * (canvas.height / rect.height) };
    }
    function start(event) {
      drawing = true;
      hasInk = true;
      var current = point(event);
      context.beginPath();
      context.moveTo(current.x, current.y);
      event.preventDefault();
    }
    function move(event) {
      if (!drawing) return;
      var current = point(event);
      context.lineTo(current.x, current.y);
      context.stroke();
      event.preventDefault();
    }
    function stop() {
      if (!drawing) return;
      drawing = false;
      storedDataUrl = canvas.toDataURL("image/png");
      markDirty(canvas.id + "DataUrl");
      updateStatusChip(readRecord());
      queueAutoSave();
    }
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", stop);
    return {
      read: function () { return hasInk ? (storedDataUrl || canvas.toDataURL("image/png")) : ""; },
      write: function (dataUrl) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        storedDataUrl = hasSignatureDataUrl(dataUrl) ? dataUrl : "";
        hasInk = Boolean(storedDataUrl);
        if (!storedDataUrl) return;
        var image = new Image();
        image.onload = function () { context.drawImage(image, 0, 0, canvas.width, canvas.height); };
        image.src = storedDataUrl;
      },
      clear: function () {
        context.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
        storedDataUrl = "";
      }
    };
  }

  function initSignaturePads() {
    signaturePads.employeeA = createSignaturePad(el.employeeASignature);
    signaturePads.employeeB = createSignaturePad(el.employeeBSignature);
    signaturePads.supervisor = createSignaturePad(el.supervisorSignature);
    [].forEach.call(document.querySelectorAll("[data-clear-signature]"), function (button) {
      button.onclick = function () {
        var key = button.getAttribute("data-clear-signature");
        signaturePads[key].clear();
        markDirty(key + "SignatureDataUrl");
        updateStatusChip(readRecord());
        queueAutoSave();
      };
    });
  }

  function queueAutoSave() {
    if (!state.publicMode) return;
    clearTimeout(state.autoSaveTimer);
    setPendingAutoSaveStatus();
    state.autoSaveTimer = window.setTimeout(function () {
      state.autoSaveTimer = null;
      saveRecord({ auto: true }).catch(function (error) {
        console.error(error);
        setStatus("Nao foi possivel salvar automaticamente. Clique em Salvar.");
      });
    }, 900);
  }

  function saveRecord(options) {
    options = options || {};
    if (!options.auto) {
      clearTimeout(state.autoSaveTimer);
      state.autoSaveTimer = null;
    }
    state.savePromise = state.savePromise.catch(function () {
      return false;
    }).then(function () {
      return persistRecord(options);
    });
    return state.savePromise;
  }

  function persistRecord(options) {
    options = options || {};
    var pendingDirty = dirtySnapshot();
    var changedFields = dirtyFieldNames(pendingDirty);
    var current = readRecord({ allocateId: true });
    var isNew = !state.id;
    var now = new Date().toISOString();
    setStatus(options.auto ? "Salvando automaticamente..." : "Salvando...");

    function saveWithLatest(latest) {
      var combined = Object.assign({}, latest || {}, { id: current.id });
      var payload = { id: current.id };

      if (isNew || !latest) {
        combined = Object.assign({}, current);
        payload = Object.assign({}, current);
      } else {
        changedFields.forEach(function (fieldName) {
          combined[fieldName] = current[fieldName];
          payload[fieldName] = current[fieldName];
        });
      }

      combined.source = combined.source || (state.publicMode ? "public-permuta-form" : "operacional-permuta-manual");
      combined.lastSavedFrom = state.publicMode ? "public-link" : "internal";
      combined.updatedBy = state.currentUser ? state.currentUser.email : "";
      combined.updatedAt = now;
      combined.createdAt = combined.createdAt || now;
      applyStatusMetadata(combined);

      payload.source = combined.source;
      payload.lastSavedFrom = combined.lastSavedFrom;
      payload.updatedBy = combined.updatedBy;
      payload.updatedAt = combined.updatedAt;
      payload.status = combined.status;
      payload.completed = combined.completed;
      payload.approvalStatus = combined.approvalStatus;
      payload.completedAt = combined.completedAt;
      if (!latest || !combined.createdAt || isNew) payload.createdAt = combined.createdAt;
      if (combined.archived !== undefined) payload.archived = combined.archived;

      return db.collection(COLLECTION).doc(current.id).set(payload, { merge: true }).then(function () {
        state.id = current.id;
        state.loadedRecord = combined;
        clearDirtySnapshot(pendingDirty);
        updateUrlWithId(current.id);
        updateModeUi();
        updateStatusChip(combined);
        setStatus(state.publicMode ? statusMessage(combined) + " Este mesmo link ja esta atualizado para as tres assinaturas." : statusMessage(combined));
        return true;
      });
    }

    if (isNew) return saveWithLatest(null);

    return db.collection(COLLECTION).doc(current.id).get().then(function (snapshot) {
      var latest = snapshot.exists ? Object.assign({ id: snapshot.id }, snapshot.data()) : null;
      return saveWithLatest(latest);
    });
  }

  function copyPublicLink() {
    var ensureSaved = saveRecord();
    return ensureSaved.then(function (saved) {
      if (!saved || !state.id) return;
      var link = buildPublicUrl(state.id);
      return copyTextToClipboard(link).then(function (copied) {
        if (copied) {
          setStatus("Link publico copiado. Envie o mesmo link para solicitante, colaborador que assume e supervisor.");
        } else {
          window.prompt("Copie o link publico da permuta:", link);
        }
      });
    });
  }

  function loadRecord() {
    state.id = params.get("id") || "";
    updateModeUi();
    if (!state.id) {
      state.loadedRecord = blankRecord();
      fillRecord(state.loadedRecord);
      setStatus(state.publicMode ? "Preencha, salve e compartilhe o mesmo link para as tres assinaturas." : "Aguardando preenchimento.");
      return Promise.resolve();
    }
    return db.collection(COLLECTION).doc(state.id).get().then(function (snapshot) {
      if (!snapshot.exists) {
        state.loadedRecord = blankRecord();
        fillRecord(state.loadedRecord);
        setStatus("Permuta nao encontrada.");
        return;
      }
      state.loadedRecord = Object.assign({ id: snapshot.id }, snapshot.data());
      fillRecord(state.loadedRecord);
      setStatus(state.publicMode ? "Permuta carregada. Salve depois de preencher ou assinar." : "Permuta carregada.");
    });
  }

  function attachFieldEvents() {
    [].forEach.call(document.querySelectorAll("input, textarea"), function (field) {
      field.addEventListener("input", function () {
        markDirty(field.id);
        updateStatusChip(readRecord());
        queueAutoSave();
      });
      field.addEventListener("change", function () {
        markDirty(field.id);
        updateStatusChip(readRecord());
        queueAutoSave();
      });
    });
  }

  function init() {
    var config = window.RH_FIREBASE_CONFIG || {};
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    state.currentUser = readPortalUser();
    state.publicMode = params.get("public") === "1" || !hasOperationalAccess(state.currentUser);
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    initSignaturePads();
    attachFieldEvents();
    updateModeUi();
    loadRecord();
    el.themeToggleBtn.onclick = function () { applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark"); };
    el.saveBtn.onclick = function () {
      saveRecord().catch(function (error) {
        console.error(error);
        setStatus("Nao foi possivel salvar agora.");
      });
    };
    el.copyPublicLinkBtn.onclick = function () {
      copyPublicLink().catch(function (error) {
        console.error(error);
        setStatus("Nao foi possivel copiar o link publico.");
      });
    };
    el.exportPdfBtn.onclick = function () { window.PermutaPdf.exportRecord(readRecord()); };
  }

  init();
})();
