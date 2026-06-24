(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var currentPortalUser = null;
  var currentTab = "ativos";
  var activeDocsCache = [];
  var archivedDocsCache = [];

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  async function sha256(value) {
    var encoded = new TextEncoder().encode(String(value || ""));
    var digest = await crypto.subtle.digest("SHA-256", encoded);
    return bytesToHex(digest);
  }

  function createEditToken() {
    if (crypto.randomUUID) {
      return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    }
    return String(Date.now()) + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  async function issuePublicEditLink(id) {
    var db = initializeFirebase();
    var token = createEditToken();
    var hash = await sha256(token);
    await db.collection("monitoring_clients").doc(id).set({
      publicEditTokenHash: hash,
      publicEditTokenIssuedAt: new Date().toISOString()
    }, { merge: true });
    return "https://cadastro-clientes-tka.web.app/?edit=" + encodeURIComponent(token);
  }

  async function copyPublicEditLink(id) {
    var link = await issuePublicEditLink(id);
    await navigator.clipboard.writeText(link);
    window.alert("Link de edicao copiado. Envie este link privado ao cliente:\n\n" + link);
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    var button = document.getElementById("themeToggleBtn");
    if (button) {
      button.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
    }
    localStorage.setItem(THEME_KEY, document.body.dataset.theme);
  }

  function formatDate(value) {
    if (!value) {
      return "Sem data";
    }

    try {
      if (typeof value.toDate === "function") {
        return value.toDate().toLocaleString("pt-BR");
      }

      return new Date(value).toLocaleString("pt-BR");
    } catch (error) {
      return "Sem data";
    }
  }

  function getValue(data, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      var candidate = data[keys[index]];
      if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
        return String(candidate).trim();
      }
    }

    return "";
  }

  function createMetaItem(label, value) {
    return (
      '<div class="meta-item">' +
      "<strong>" + label + "</strong>" +
      "<span>" + (value || "-") + "</span>" +
      "</div>"
    );
  }

  var listElement = document.getElementById("clientList");
  var archivedListElement = document.getElementById("archivedClientList");
  var countLabel = document.getElementById("countLabel");
  var archivedCountLabel = document.getElementById("archivedCountLabel");
  var activeClientsSummary = document.getElementById("activeClientsSummary");
  var archivedClientsSummary = document.getElementById("archivedClientsSummary");
  var publicClientsSummary = document.getElementById("publicClientsSummary");
  var clientSearchInput = document.getElementById("clientSearchInput");
  var archivedClientSearchInput = document.getElementById("archivedClientSearchInput");
  var themeToggleBtn = document.getElementById("themeToggleBtn");
  var homeLink = document.getElementById("homeLink");

  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  if (themeToggleBtn) {
    themeToggleBtn.onclick = function () {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
    };
  }
  if (homeLink) {
    homeLink.onclick = function (event) {
      event.preventDefault();
      window.location.assign(window.location.origin + "/?tab=systems");
    };
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
  }

  function readPortalUser() {
    try {
      var raw = sessionStorage.getItem(PORTAL_SESSION_DATA_KEY) || localStorage.getItem(PORTAL_PERSIST_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function canAccessClients() {
    return Boolean(currentPortalUser && (currentPortalUser.permissions?.monitoramento || currentPortalUser.permissions?.admin));
  }

  function canManageClients() {
    return Boolean(currentPortalUser && (currentPortalUser.permissions?.admin || currentPortalUser.role === "owner"));
  }

  function initializeFirebase() {
    var config = window.RH_FIREBASE_CONFIG || window.TKA_FIREBASE_CONFIG;
    if (!config) {
      throw new Error("Configuracao Firebase nao encontrada.");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    return firebase.firestore();
  }

  async function archiveClient(id) {
    if (!canManageClients()) return;
    var confirmed = window.confirm("Arquivar este cliente? Ele ficara visivel na aba Arquivados.");
    if (!confirmed) return;
    var db = initializeFirebase();
    var user = currentPortalUser;
    await db.collection("monitoring_clients").doc(id).update({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: (user && user.email) || "desconhecido"
    });
    await loadClients();
    if (archivedListElement) await loadArchivedClients();
  }

  async function restoreClient(id) {
    if (!canManageClients()) return;
    var confirmed = window.confirm("Reativar este cliente?");
    if (!confirmed) return;
    var db = initializeFirebase();
    await db.collection("monitoring_clients").doc(id).update({
      archived: false,
      archivedAt: null,
      archivedBy: null
    });
    await loadClients();
    await loadArchivedClients();
  }

  async function deleteClient(id) {
    if (!canManageClients()) return;

    var confirmed = window.confirm("Arquivar este cliente? O cadastro continuara preservado na aba Arquivados.");
    if (!confirmed) return;

    var db = initializeFirebase();
    var user = currentPortalUser;
    await db.collection("monitoring_clients").doc(id).set({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: (user && user.email) || "desconhecido",
      archiveReason: "archive_from_delete_control"
    }, { merge: true });
    await loadClients();
    if (archivedListElement) await loadArchivedClients();
  }

  function getHighestPriorityContact(data) {
    var contacts = data.contacts;
    if (!contacts || !contacts.length) return "";
    var active = contacts.filter(function (c) { return c.name || c.phone; });
    if (!active.length) return "";
    active.sort(function (a, b) {
      return (parseInt(a.priority) || 99) - (parseInt(b.priority) || 99);
    });
    return active[0].name || active[0].phone || "";
  }

  function buildCard(doc, isArchived) {
    var record = doc.data() || {};
    var data = record.data || {};
    var business = data.business || {};

    var clientName = business.companyName ||
      getValue(data, ["companyName", "nomeEmpresa", "nome", "clientName"]) ||
      "Cliente sem nome";

    var city = business.city || getValue(data, ["city", "cidade"]);
    var state = business.state || getValue(data, ["state", "estado", "uf"]);

    var contact = getHighestPriorityContact(data);
    if (!contact) contact = getValue(data, ["contactName", "responsavel", "nomeContato"]);

    var location = [city, state].filter(Boolean).join(" / ");
    var updatedAt = formatDate(record.updatedAt || record.createdAt);
    var source = record.source === "public-client-form" ? "Enviado pelo cliente" : "Cadastro interno";

    var actions = "";
    if (!isArchived) {
      actions +=
        '<a class="button" href="/monitoramento/clientes/editor.html?id=' + encodeURIComponent(doc.id) + '&admin=1">Abrir cadastro</a>' +
        '<a class="button secondary" href="https://cadastro-clientes-tka.web.app/" target="_blank" rel="noreferrer">Abrir link publico</a>' +
        '<button class="button secondary" type="button" data-copy-edit-link="' + doc.id + '">Copiar link de edicao</button>';
      if (canManageClients()) {
        actions += '<button class="button warning" type="button" data-archive="' + doc.id + '">Arquivar</button>';
      }
    } else {
      if (canManageClients()) {
        actions += '<button class="button secondary" type="button" data-restore="' + doc.id + '">Reativar</button>';
      }
    }

    return (
      '<article class="client-card">' +
      '<div class="client-head">' +
      "<div>" +
      "<h2>" + clientName + "</h2>" +
      '<p class="muted">' + (location || "Localidade nao informada") + "</p>" +
      "</div>" +
      '<span class="chip">' + source + "</span>" +
      "</div>" +
      '<div class="meta-grid">' +
      createMetaItem("Nome do Cliente", clientName) +
      createMetaItem("Contato", contact || "Nao informado") +
      createMetaItem("Cidade", city || "Nao informado") +
      createMetaItem("Ultima atualizacao", updatedAt) +
      "</div>" +
      '<div class="client-actions">' +
      actions +
      "</div>" +
      "</article>"
    );
  }

  function clientSearchText(doc) {
    var record = doc.data() || {};
    var data = record.data || {};
    var business = data.business || {};
    return [
      business.companyName,
      business.city,
      business.state,
      getValue(data, ["companyName", "nomeEmpresa", "nome", "clientName"]),
      getHighestPriorityContact(data),
      getValue(data, ["contactName", "responsavel", "nomeContato"]),
      record.source === "public-client-form" ? "publico cliente enviado" : "interno manual"
    ].join(" ").toLowerCase();
  }

  function filteredDocs(docs, input) {
    var query = String((input && input.value) || "").trim().toLowerCase();
    if (!query) return docs;
    return docs.filter(function (doc) {
      return clientSearchText(doc).indexOf(query) !== -1;
    });
  }

  function updateSummaryCounts() {
    if (activeClientsSummary) activeClientsSummary.textContent = String(activeDocsCache.length);
    if (archivedClientsSummary) archivedClientsSummary.textContent = String(archivedDocsCache.length);
    if (publicClientsSummary) {
      var publicTotal = activeDocsCache.concat(archivedDocsCache).filter(function (doc) {
        return (doc.data() || {}).source === "public-client-form";
      }).length;
      publicClientsSummary.textContent = String(publicTotal);
    }
  }

  function renderClientDocs(container, label, docs, isArchived) {
    var input = isArchived ? archivedClientSearchInput : clientSearchInput;
    var rows = filteredDocs(docs, input);
    label.textContent = rows.length + (rows.length === 1 ? (isArchived ? " arquivado" : " cliente") : (isArchived ? " arquivados" : " clientes"));
    if (!rows.length) {
      renderMessage(container, "empty-state", isArchived ? "Nenhum cliente arquivado encontrado." : "Nenhum cliente ativo encontrado.");
      return;
    }
    container.innerHTML = rows.map(function (doc) { return buildCard(doc, isArchived); }).join("");
    bindCardActions(container);
  }

  function renderActiveClients() {
    renderClientDocs(listElement, countLabel, activeDocsCache, false);
  }

  function renderArchivedClients() {
    if (!archivedListElement || !archivedCountLabel) return;
    renderClientDocs(archivedListElement, archivedCountLabel, archivedDocsCache, true);
  }

  function bindCardActions(container) {
    container.querySelectorAll("[data-archive]").forEach(function (button) {
      button.onclick = function () {
        archiveClient(button.dataset.archive).catch(function (error) {
          console.error(error);
        });
      };
    });
    container.querySelectorAll("[data-restore]").forEach(function (button) {
      button.onclick = function () {
        restoreClient(button.dataset.restore).catch(function (error) {
          console.error(error);
        });
      };
    });
    container.querySelectorAll("[data-delete]").forEach(function (button) {
      button.onclick = function () {
        deleteClient(button.dataset.delete).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel arquivar o cliente.");
        });
      };
    });
    container.querySelectorAll("[data-copy-edit-link]").forEach(function (button) {
      button.onclick = function () {
        copyPublicEditLink(button.dataset.copyEditLink).catch(function (error) {
          console.error(error);
          window.alert("Nao foi possivel gerar o link de edicao do cliente.");
        });
      };
    });
  }

  async function loadClients() {
    if (!canAccessClients()) {
      countLabel.textContent = "Sem permissao";
      renderMessage(listElement, "error-state", "Acesso restrito ao monitoramento e ao gerenciamento.");
      return;
    }

    var db = initializeFirebase();
    var snapshot = await db.collection("monitoring_clients").orderBy("updatedAt", "desc").get();

    var activeDocs = snapshot.docs.filter(function (doc) {
      return !doc.data().archived;
    });
    archivedDocsCache = snapshot.docs.filter(function (doc) {
      return !!doc.data().archived;
    });

    activeDocsCache = activeDocs;
    updateSummaryCounts();
    renderActiveClients();
  }

  async function loadArchivedClients() {
    if (!archivedListElement || !archivedCountLabel) return;
    if (!canAccessClients()) {
      renderMessage(archivedListElement, "error-state", "Acesso restrito.");
      return;
    }

    var db = initializeFirebase();
    var snapshot = await db.collection("monitoring_clients").orderBy("updatedAt", "desc").get();

    var archivedDocs = snapshot.docs.filter(function (doc) {
      return !!doc.data().archived;
    });

    archivedDocsCache = archivedDocs;
    updateSummaryCounts();
    renderArchivedClients();
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.onclick = function () {
        currentTab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (b) {
          b.classList.toggle("active", b.dataset.tab === currentTab);
        });
        var tabAtivos = document.getElementById("tab-ativos");
        var tabArquivados = document.getElementById("tab-arquivados");
        if (tabAtivos) tabAtivos.hidden = currentTab !== "ativos";
        if (tabArquivados) tabArquivados.hidden = currentTab !== "arquivados";
        if (currentTab === "arquivados") {
          loadArchivedClients().catch(console.error);
        }
      };
    });
  }

  currentPortalUser = readPortalUser();
  setupTabs();
  if (clientSearchInput) clientSearchInput.oninput = renderActiveClients;
  if (archivedClientSearchInput) archivedClientSearchInput.oninput = renderArchivedClients;
  loadClients().catch(function (error) {
    countLabel.textContent = "Falha no carregamento";
    renderMessage(listElement, "error-state", "Nao foi possivel carregar a base de clientes.");
    console.error(error);
  });
})();
