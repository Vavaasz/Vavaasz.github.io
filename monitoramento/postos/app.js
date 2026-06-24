(function () {
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var THEME_KEY = "tka_theme";
  var COLLECTION_NAME = "places";
  var AUDIT_COLLECTION = "audit_logs";
  var WORK_KIND_OPTIONS = [
    { id: "monitoramento", label: "Monitoramento" },
    { id: "alarmes", label: "Alarmes" },
    { id: "ronda", label: "Ronda" },
    { id: "efetivo", label: "Efetivo" }
  ];
  var WORK_KIND_LABELS = WORK_KIND_OPTIONS.reduce(function (map, option) {
    map[option.id] = option.label;
    return map;
  }, {});

  var state = {
    currentUser: null,
    places: [],
    firestoreReady: false,
    seedFallback: false,
    db: null
  };

  var el = {
    accessNotice: document.getElementById("accessNotice"),
    workspace: document.getElementById("workspace"),
    activeSummary: document.getElementById("activeSummary"),
    archivedSummary: document.getElementById("archivedSummary"),
    citiesSummary: document.getElementById("citiesSummary"),
    cepSummary: document.getElementById("cepSummary"),
    saveStatus: document.getElementById("saveStatus"),
    formTitle: document.getElementById("formTitle"),
    placeForm: document.getElementById("placeForm"),
    placeId: document.getElementById("placeId"),
    placeName: document.getElementById("placeName"),
    placeCity: document.getElementById("placeCity"),
    placeCep: document.getElementById("placeCep"),
    placeReferenceName: document.getElementById("placeReferenceName"),
    workKindInputs: Array.from(document.querySelectorAll('input[name="workKind"]')),
    placeAddress: document.getElementById("placeAddress"),
    placeNotes: document.getElementById("placeNotes"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    newPlaceBtn: document.getElementById("newPlaceBtn"),
    searchInput: document.getElementById("searchInput"),
    cityFilter: document.getElementById("cityFilter"),
    workKindFilter: document.getElementById("workKindFilter"),
    statusFilter: document.getElementById("statusFilter"),
    cepFilter: document.getElementById("cepFilter"),
    countLabel: document.getElementById("countLabel"),
    placeList: document.getElementById("placeList"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    homeLink: document.getElementById("homeLink")
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function readPortalUser() {
    try {
      var raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function canAccessPlaces() {
    var permissions = (state.currentUser && state.currentUser.permissions) || {};
    return Boolean(permissions.monitoramento || permissions.admin || state.currentUser?.role === "owner");
  }

  function canManagePlaces() {
    return canAccessPlaces();
  }

  function setStatus(message) {
    if (el.saveStatus) el.saveStatus.textContent = message;
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    if (el.themeToggleBtn) {
      el.themeToggleBtn.textContent = document.body.dataset.theme === "dark" ? "Tema claro" : "Tema escuro";
    }
    try {
      localStorage.setItem(THEME_KEY, document.body.dataset.theme);
    } catch {}
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || window.TKA_FIREBASE_CONFIG;
    if (!config) throw new Error("Configuracao Firebase nao encontrada.");
    if (!firebase.apps.length) firebase.initializeApp(config);
    return firebase.firestore();
  }

  function isArchived(place) {
    return Boolean(place && (place.archived || place.deletedAt || place.deletedBy));
  }

  function getField(place, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      var value = place && place[keys[index]];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  function getCep(place) {
    return getField(place, ["cep", "postalCode", "zipCode", "zip", "codigoPostal"]);
  }

  function getAddress(place) {
    return getField(place, ["address", "endereco", "street", "logradouro", "location"]);
  }

  function getReferenceName(place) {
    return getField(place, ["referenceName", "displayName", "clientName", "companyName", "nomeReferencia"]) || place.name || "";
  }

  function normalizeWorkKindId(value) {
    var normalized = normalizeText(value).replace(/\s+/g, "-");
    if (normalized === "alarme") return "alarmes";
    return WORK_KIND_LABELS[normalized] ? normalized : "";
  }

  function normalizeWorkKinds(place) {
    var raw = [];
    if (Array.isArray(place?.workKinds)) raw = raw.concat(place.workKinds);
    if (Array.isArray(place?.workKindLabels)) raw = raw.concat(place.workKindLabels);
    if (Array.isArray(place?.workTypes)) raw = raw.concat(place.workTypes);
    if (Array.isArray(place?.kindOfWork)) raw = raw.concat(place.kindOfWork);
    if (typeof place?.kindOfWork === "string") raw = raw.concat(place.kindOfWork.split(/[;,/|]+/));
    if (typeof place?.workKind === "string") raw = raw.concat(place.workKind.split(/[;,/|]+/));
    var seen = new Set();
    raw.forEach(function (value) {
      var id = normalizeWorkKindId(value);
      if (id) seen.add(id);
    });
    return WORK_KIND_OPTIONS.map(function (option) { return option.id; }).filter(function (id) { return seen.has(id); });
  }

  function workKindLabels(place) {
    var kinds = normalizeWorkKinds(place);
    return kinds.map(function (id) { return WORK_KIND_LABELS[id]; }).filter(Boolean);
  }

  function workKindText(place) {
    var labels = workKindLabels(place);
    return labels.length ? labels.join(", ") : "Nao informado";
  }

  function selectedWorkKinds() {
    return el.workKindInputs
      .filter(function (input) { return input.checked; })
      .map(function (input) { return normalizeWorkKindId(input.value); })
      .filter(Boolean);
  }

  function setSelectedWorkKinds(kinds) {
    var selected = new Set(kinds || []);
    el.workKindInputs.forEach(function (input) {
      input.checked = selected.has(normalizeWorkKindId(input.value));
    });
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

  function placeSort(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" });
  }

  function activePlaces() {
    return state.places.filter(function (place) { return !isArchived(place); });
  }

  function archivedPlaces() {
    return state.places.filter(isArchived);
  }

  function allCities() {
    var seen = new Set();
    state.places.forEach(function (place) {
      var city = String(place.city || "").trim();
      if (city) seen.add(city);
    });
    return Array.from(seen).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    });
  }

  function loadSeedFallback(reason) {
    var seedPlaces = (window.RH_SEED_DATA && window.RH_SEED_DATA.places) || [];
    if (!Array.isArray(seedPlaces) || !seedPlaces.length) return false;
    if (!state.places.length || !state.firestoreReady) {
      state.places = seedPlaces
        .filter(function (place) { return !isArchived(place); })
        .map(function (place) {
          return Object.assign({ source: place.source || "rh_seed_data" }, place);
        });
      state.seedFallback = true;
      render();
      setStatus(
        reason === "firestore-error"
          ? "Firebase indisponivel; base local exibida"
          : reason === "empty-firestore"
            ? "Base local exibida; Firestore sem postos"
            : "Base local carregada"
      );
    }
    return true;
  }

  function renderSummary() {
    var active = activePlaces();
    var archived = archivedPlaces();
    var cities = new Set(active.map(function (place) { return normalizeText(place.city); }).filter(Boolean));
    var withCep = active.filter(function (place) { return Boolean(getCep(place)); });
    el.activeSummary.textContent = String(active.length);
    el.archivedSummary.textContent = String(archived.length);
    el.citiesSummary.textContent = String(cities.size);
    el.cepSummary.textContent = String(withCep.length);
  }

  function renderCityFilter() {
    var previous = el.cityFilter.value;
    var cities = allCities();
    el.cityFilter.innerHTML = '<option value="">Todas as cidades</option>' + cities.map(function (city) {
      return '<option value="' + escapeHtml(city) + '">' + escapeHtml(city) + "</option>";
    }).join("");
    if (cities.indexOf(previous) >= 0) el.cityFilter.value = previous;
  }

  function placeSearchText(place) {
    return normalizeText([
      place.name,
      place.city,
      getCep(place),
      getAddress(place),
      getReferenceName(place),
      workKindText(place),
      place.notes,
      place.source
    ].join(" "));
  }

  function filteredPlaces() {
    var query = normalizeText(el.searchInput.value);
    var city = normalizeText(el.cityFilter.value);
    var workKind = el.workKindFilter.value || "all";
    var status = el.statusFilter.value || "active";
    var cepFilter = el.cepFilter.value || "all";
    return state.places.filter(function (place) {
      var placeWorkKinds = normalizeWorkKinds(place);
      if (status === "active" && isArchived(place)) return false;
      if (status === "archived" && !isArchived(place)) return false;
      if (city && normalizeText(place.city) !== city) return false;
      if (workKind !== "all" && workKind !== "none" && placeWorkKinds.indexOf(workKind) === -1) return false;
      if (workKind === "none" && placeWorkKinds.length) return false;
      if (cepFilter === "with" && !getCep(place)) return false;
      if (cepFilter === "without" && getCep(place)) return false;
      if (query && placeSearchText(place).indexOf(query) === -1) return false;
      return true;
    }).sort(placeSort);
  }

  function renderPlaceCard(place) {
    var archived = isArchived(place);
    var cep = getCep(place) || "Nao informado";
    var address = getAddress(place) || "Endereco nao informado";
    var referenceName = getReferenceName(place) || "Nome nao informado";
    var workKinds = workKindLabels(place);
    var updatedAt = formatDate(place.updatedAt || place.createdAt || place.deletedAt);
    var chip = archived ? "Arquivado" : (getCep(place) ? "Com CEP" : "Sem CEP");
    var actions = "";

    if (canManagePlaces()) {
      if (archived) {
        actions = '<button class="button secondary" type="button" data-restore="' + escapeHtml(place.id) + '">Reativar</button>';
      } else {
        actions =
          '<button class="button secondary" type="button" data-edit="' + escapeHtml(place.id) + '">Editar</button>' +
          '<button class="button danger" type="button" data-archive="' + escapeHtml(place.id) + '">Excluir</button>';
      }
    }

    return (
      '<article class="place-card' + (archived ? " archived" : "") + '">' +
        '<div class="place-head">' +
          '<div>' +
            '<h2>' + escapeHtml(place.name || "Posto sem nome") + '</h2>' +
            '<p class="muted">' + escapeHtml([place.city, getCep(place)].filter(Boolean).join(" / ") || "Cidade nao informada") + '</p>' +
          '</div>' +
          '<span class="chip">' + chip + '</span>' +
        '</div>' +
        '<div class="work-kind-tags">' +
          (workKinds.length ? workKinds.map(function (label) {
            return '<span>' + escapeHtml(label) + '</span>';
          }).join("") : '<span>Tipo nao informado</span>') +
        '</div>' +
        '<div class="meta-grid">' +
          createMetaItem("Posto", place.name || "Nao informado") +
          createMetaItem("Cidade", place.city || "Nao informada") +
          createMetaItem("Nome", referenceName) +
          createMetaItem("Tipo de trabalho", workKindText(place)) +
          createMetaItem("CEP", cep) +
          createMetaItem("Endereco", address) +
          createMetaItem("Ultima atualizacao", updatedAt) +
        '</div>' +
        (place.notes ? '<p class="notes">' + escapeHtml(place.notes) + '</p>' : "") +
        '<div class="place-actions">' + actions + '</div>' +
      '</article>'
    );
  }

  function createMetaItem(label, value) {
    return (
      '<div class="meta-item">' +
        '<strong>' + escapeHtml(label) + '</strong>' +
        '<span>' + escapeHtml(value || "-") + '</span>' +
      '</div>'
    );
  }

  function renderList() {
    var places = filteredPlaces();
    el.countLabel.textContent = places.length + (places.length === 1 ? " posto" : " postos");
    if (!places.length) {
      el.placeList.innerHTML = '<div class="empty-state">Nenhum posto encontrado para os filtros atuais.</div>';
      return;
    }
    el.placeList.innerHTML = places.map(renderPlaceCard).join("");
    bindPlaceActions();
  }

  function render() {
    renderSummary();
    renderCityFilter();
    renderList();
  }

  function findPlace(id) {
    return state.places.find(function (place) { return place.id === id; }) || null;
  }

  function fillForm(place) {
    el.placeId.value = place?.id || "";
    el.placeName.value = place?.name || "";
    el.placeCity.value = place?.city || "";
    el.placeCep.value = getCep(place || {});
    el.placeReferenceName.value = place?.referenceName || "";
    setSelectedWorkKinds(normalizeWorkKinds(place || {}));
    el.placeAddress.value = getAddress(place || {});
    el.placeNotes.value = place?.notes || "";
    el.formTitle.textContent = place ? "Editar posto" : "Adicionar posto";
    el.cancelEditBtn.hidden = !place;
  }

  function resetForm() {
    fillForm(null);
    el.placeName.focus();
  }

  function cleanCep(value) {
    var digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return digits.slice(0, 5) + "-" + digits.slice(5);
    return digits;
  }

  function getPreviousValue(id) {
    var place = findPlace(id);
    return place ? Object.assign({}, place) : null;
  }

  function summarizePlace(payload) {
    return [payload.name || "Posto", payload.city || "Sem cidade", getCep(payload) || "Sem CEP"].join(" / ");
  }

  function writeAuditLog(batch, action, payload, previousValue) {
    var actionLabel = action === "create" ? "Inclusao" : action === "update" ? "Edicao" : action === "restore" ? "Reativacao" : "Arquivamento";
    batch.set(state.db.collection(AUDIT_COLLECTION).doc(), {
      action: action,
      actionLabel: actionLabel,
      collectionName: COLLECTION_NAME,
      entityId: payload?.id || previousValue?.id || "",
      entityLabel: "posto TKA",
      summary: summarizePlace(payload || previousValue || {}),
      userEmail: state.currentUser?.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      previousValue: previousValue || null,
      nextValue: payload || null
    });
  }

  async function savePlace(event) {
    event.preventDefault();
    if (!canManagePlaces()) return;
    if (!state.db) throw new Error("Firebase nao iniciado.");

    var existingId = el.placeId.value.trim();
    var id = existingId || String(Date.now()) + "-" + Math.random().toString(16).slice(2, 8);
    var previousValue = getPreviousValue(id);
    var workKinds = selectedWorkKinds();
    var payload = {
      id: id,
      name: el.placeName.value.trim(),
      city: el.placeCity.value.trim(),
      cep: cleanCep(el.placeCep.value),
      postalCode: cleanCep(el.placeCep.value) || null,
      zipCode: null,
      zip: null,
      codigoPostal: null,
      referenceName: el.placeReferenceName.value.trim(),
      workKinds: workKinds,
      workKindLabels: workKinds.map(function (id) { return WORK_KIND_LABELS[id]; }),
      address: el.placeAddress.value.trim(),
      endereco: el.placeAddress.value.trim() || null,
      notes: el.placeNotes.value.trim(),
      archived: false,
      deletedAt: null,
      deletedBy: null,
      deletionMode: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: state.currentUser?.email || ""
    };
    if (!previousValue) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.createdBy = state.currentUser?.email || "";
      payload.source = "monitoramento-postos";
    }

    setStatus("Salvando...");
    var batch = state.db.batch();
    batch.set(state.db.collection(COLLECTION_NAME).doc(id), payload, { merge: true });
    writeAuditLog(batch, previousValue ? "update" : "create", payload, previousValue);
    await batch.commit();
    resetForm();
    setStatus("Posto salvo");
  }

  async function archivePlace(id) {
    if (!canManagePlaces()) return;
    var place = findPlace(id);
    if (!place) return;
    var confirmed = window.confirm("Excluir este posto da lista ativa? O registro sera preservado em Arquivados.");
    if (!confirmed) return;
    setStatus("Arquivando...");
    var archivedAt = new Date().toISOString();
    var payload = {
      id: id,
      archived: true,
      archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      archivedBy: state.currentUser?.email || "",
      deletedAt: archivedAt,
      deletedBy: state.currentUser?.email || "",
      deletionMode: "archive-only",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: state.currentUser?.email || ""
    };
    var batch = state.db.batch();
    batch.set(state.db.collection(COLLECTION_NAME).doc(id), payload, { merge: true });
    writeAuditLog(batch, "archive", Object.assign({}, place, payload, { deletedAt: archivedAt }), place);
    await batch.commit();
    if (el.placeId.value === id) fillForm(null);
    setStatus("Posto arquivado");
  }

  async function restorePlace(id) {
    if (!canManagePlaces()) return;
    var place = findPlace(id);
    if (!place) return;
    var confirmed = window.confirm("Reativar este posto?");
    if (!confirmed) return;
    setStatus("Reativando...");
    var payload = {
      id: id,
      archived: false,
      archivedAt: null,
      archivedBy: null,
      deletedAt: null,
      deletedBy: null,
      deletionMode: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: state.currentUser?.email || ""
    };
    var batch = state.db.batch();
    batch.set(state.db.collection(COLLECTION_NAME).doc(id), payload, { merge: true });
    writeAuditLog(batch, "restore", Object.assign({}, place, payload), place);
    await batch.commit();
    setStatus("Posto reativado");
  }

  function bindPlaceActions() {
    el.placeList.querySelectorAll("[data-edit]").forEach(function (button) {
      button.onclick = function () {
        var place = findPlace(button.dataset.edit);
        if (!place) return;
        fillForm(place);
        el.placeName.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
    el.placeList.querySelectorAll("[data-archive]").forEach(function (button) {
      button.onclick = function () {
        archivePlace(button.dataset.archive).catch(function (error) {
          console.error(error);
          setStatus("Falha ao arquivar posto");
        });
      };
    });
    el.placeList.querySelectorAll("[data-restore]").forEach(function (button) {
      button.onclick = function () {
        restorePlace(button.dataset.restore).catch(function (error) {
          console.error(error);
          setStatus("Falha ao reativar posto");
        });
      };
    });
  }

  function connectRealtime() {
    state.db = initializeFirebase();
    state.db.collection(COLLECTION_NAME).onSnapshot(function (snapshot) {
      var docs = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data() || {});
      });
      if (!docs.length && loadSeedFallback("empty-firestore")) {
        state.firestoreReady = true;
        return;
      }
      state.places = docs;
      state.seedFallback = false;
      state.firestoreReady = true;
      render();
      setStatus("Sincronizado");
    }, function (error) {
      console.error(error);
      loadSeedFallback("firestore-error");
      setStatus("Falha ao conectar Firebase");
    });
  }

  function bindEvents() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    if (el.themeToggleBtn) {
      el.themeToggleBtn.onclick = function () {
        applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
      };
    }
    if (el.homeLink) {
      el.homeLink.onclick = function (event) {
        event.preventDefault();
        window.location.assign(window.location.origin + "/?tab=systems");
      };
    }
    if (el.newPlaceBtn) {
      el.newPlaceBtn.onclick = resetForm;
    }
    if (el.cancelEditBtn) {
      el.cancelEditBtn.onclick = resetForm;
    }
    el.placeForm.onsubmit = function (event) {
      savePlace(event).catch(function (error) {
        console.error(error);
        setStatus("Falha ao salvar posto");
      });
    };
    [el.searchInput, el.cityFilter, el.workKindFilter, el.statusFilter, el.cepFilter].forEach(function (control) {
      control.addEventListener("input", renderList);
      control.addEventListener("change", renderList);
    });
    el.placeCep.addEventListener("blur", function () {
      el.placeCep.value = cleanCep(el.placeCep.value);
    });
    fillForm(null);
  }

  function boot() {
    state.currentUser = readPortalUser();
    bindEvents();

    if (!canAccessPlaces()) {
      el.accessNotice.hidden = false;
      el.workspace.hidden = true;
      if (el.newPlaceBtn) el.newPlaceBtn.hidden = true;
      setStatus("Sem permissao");
      return;
    }

    el.accessNotice.hidden = true;
    el.workspace.hidden = false;
    if (el.newPlaceBtn) el.newPlaceBtn.hidden = false;
    loadSeedFallback("seed");
    try {
      connectRealtime();
    } catch (error) {
      console.error(error);
      loadSeedFallback("firestore-error");
    }
  }

  boot();
})();
