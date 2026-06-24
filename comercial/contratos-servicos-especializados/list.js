(function () {
  var THEME_KEY = "tka_theme";
  var PORTAL_SESSION_DATA_KEY = "portal_gate_user";
  var PORTAL_PERSIST_DATA_KEY = "portal_gate_user_persist";
  var COLLECTION_NAME = "commercial_specialized_service_contracts";
  var currentPortalUser = null;
  var currentTab = "ativos";

  function applyTheme(theme) {
    document.body.dataset.theme = theme === "dark" ? "dark" : "light";
    var button = document.getElementById("themeToggleBtn");
    if (button) {
      button.textContent = theme === "dark" ? "Tema claro" : "Tema escuro";
    }
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

  function canAccessContracts() {
    return Boolean(currentPortalUser && (currentPortalUser.permissions?.estrutural || currentPortalUser.permissions?.admin));
  }

  function canManageContracts() {
    return Boolean(currentPortalUser && currentPortalUser.permissions?.admin);
  }

  function initializeFirebase() {
    var config = window.TKA_FIREBASE_CONFIG || window.RH_FIREBASE_CONFIG;
    if (!config) {
      throw new Error("Configuracao Firebase nao encontrada.");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    return firebase.firestore();
  }

  function formatDate(value) {
    if (!value) return "Sem data";
    try {
      if (typeof value.toDate === "function") {
        return value.toDate().toLocaleString("pt-BR");
      }
      return new Date(value).toLocaleString("pt-BR");
    } catch (error) {
      return "Sem data";
    }
  }

  function formatMoney(value) {
    var text = String(value || "").trim();
    if (!text) return "Nao informado";
    if (/^R\$/i.test(text)) return text;
    return "R$ " + text;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function createMetaItem(label, value) {
    return (
      '<div class="meta-item">' +
      "<strong>" + label + "</strong>" +
      "<span>" + (value || "-") + "</span>" +
      "</div>"
    );
  }

  function buildPublicContractUrl(contractId) {
    var url = new URL("/comercial/contratos-servicos-especializados/editor.html", window.location.origin);
    url.searchParams.set("id", contractId);
    url.searchParams.set("public", "1");
    return url.toString();
  }

  function createBlankPublicContractData(contractId, publicLink, timestamp) {
    return {
      contract: {
        contractCode: "ESPEC-" + contractId.slice(0, 8).toUpperCase(),
        publicLink: publicLink,
        issueCity: "",
        issueDate: "",
        startDate: "",
        endDate: "",
        durationMonths: ""
      },
      contractor: {
        companyName: "",
        legalName: "",
        cnpj: "",
        im: "",
        ie: "",
        phone: "",
        email1: "",
        email2: "",
        address: "",
        number: "",
        complement: "",
        district: "",
        cep: "",
        city: "",
        state: "",
        representativeName: "",
        representativeRole: "",
        representativeCpf: "",
        representativeRg: ""
      },
      service: {
        monitoredLocationName: "",
        monitoredAddress: "",
        monitoredNumber: "",
        monitoredComplement: "",
        monitoredDistrict: "",
        monitoredCep: "",
        monitoredCity: "",
        monitoredState: "",
        monitoredReference: "",
        communicationMethod: ""
      },
      pricing: {
        monitoringMonthly: "",
        equipmentRentalMonthly: "",
        installationTotal: "",
        installationInstallments: "",
        dueDay: "",
        paymentMethod: ""
      },
      equipment: [
        {
          id: "equipment-" + contractId.slice(0, 8),
          quantity: "",
          description: "",
          location: "",
          value: ""
        }
      ],
      sign: {
        city: "",
        date: "",
        signerName: "",
        birthDate: "",
        cpf: "",
        signerTitle: "CONTRATANTE",
        witnessOneName: "",
        witnessOneDocument: "",
        witnessTwoName: "",
        witnessTwoDocument: "",
        signatureDataUrl: ""
      },
      meta: {
        contractId: contractId,
        createdAt: timestamp,
        updatedAt: timestamp,
        publicCreated: true,
        publicLink: publicLink
      }
    };
  }

  async function copyTextToClipboard(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    var input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);
    input.select();
    var copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }

  function markPublicLinkCopied(button) {
    var originalText = button.textContent;
    button.textContent = "Link copiado";
    button.disabled = true;
    setTimeout(function () {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  }

  async function copyPublicLink(contractId, button) {
    var link = buildPublicContractUrl(contractId);
    try {
      var copied = await copyTextToClipboard(link);
      if (!copied) throw new Error("Clipboard unavailable");
      markPublicLinkCopied(button);
    } catch (error) {
      window.prompt("Copie o link de edicao do contrato:", link);
    }
  }

  function setNewPublicLinkStatus(message) {
    if (newPublicLinkStatus) {
      newPublicLinkStatus.textContent = message || "";
    }
  }

  function setNewPublicLinkButtonState(disabled, label) {
    if (!newPublicLinkBtn) return;
    newPublicLinkBtn.disabled = disabled;
    if (label) newPublicLinkBtn.textContent = label;
  }

  function setUploadContractButtonState(disabled, label) {
    if (!uploadContractBtn) return;
    uploadContractBtn.disabled = disabled;
    if (label) uploadContractBtn.textContent = label;
  }

  function buildEditorUrl(contractId) {
    var url = new URL("/comercial/contratos-servicos-especializados/editor.html", window.location.origin);
    url.searchParams.set("id", contractId);
    url.searchParams.set("imported", "1");
    return url.toString();
  }

  async function importContractFromFile(file) {
    if (!file) return;
    if (!canAccessContracts()) {
      setNewPublicLinkStatus("Acesso restrito ao Comercial.");
      return;
    }
    if (!window.tkaCommercialContractImporter) {
      setNewPublicLinkStatus("Leitor de contratos indisponivel. Recarregue a pagina.");
      return;
    }

    setUploadContractButtonState(true, "Lendo...");
    setNewPublicLinkStatus("Lendo arquivo e criando rascunho editavel...");

    try {
      var db = initializeFirebase();
      var docRef = db.collection(COLLECTION_NAME).doc();
      var timestamp = new Date().toISOString();
      var publicLink = buildPublicContractUrl(docRef.id);
      var baseData = createBlankPublicContractData(docRef.id, publicLink, timestamp);
      var imported = await window.tkaCommercialContractImporter.buildContractDataFromUpload({
        file: file,
        variant: "specialized-service",
        baseData: baseData,
        contractId: docRef.id,
        publicLink: publicLink,
        importedAt: timestamp
      });
      var user = currentPortalUser || {};

      await docRef.set({
        archived: false,
        contractId: docRef.id,
        source: "specialized-service-contract-upload",
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user.email || "desconhecido",
        importedFromUpload: true,
        importFileName: file.name || "",
        importWarnings: imported.warnings,
        data: imported.data
      });

      try {
        sessionStorage.setItem("commercial_contract_import_notice:" + docRef.id, JSON.stringify(imported.warnings || []));
      } catch (storageError) {
        console.warn(storageError);
      }
      window.tkaCommercialContractImporter.showImportNotice(imported.warnings, {
        title: "Contrato importado",
        summary: "Rascunho criado. Abrindo editor para revisao."
      });
      setNewPublicLinkStatus("Upload importado. O editor abrira para revisar e completar.");
      await loadContracts();
      setTimeout(function () {
        window.location.assign(buildEditorUrl(docRef.id));
      }, 900);
    } catch (error) {
      console.error(error);
      setNewPublicLinkStatus("Nao foi possivel importar o contrato.");
      window.tkaCommercialContractImporter.showImportNotice(["Nao foi possivel criar o rascunho importado."], {
        title: "Falha no upload",
        summary: "Tente novamente ou salve o arquivo como PDF com texto selecionavel."
      });
    } finally {
      setUploadContractButtonState(false, "Upload contrato");
    }
  }

  async function createNewPublicLink() {
    if (!canAccessContracts()) {
      setNewPublicLinkStatus("Acesso restrito ao Comercial.");
      return;
    }

    setNewPublicLinkButtonState(true, "Gerando...");
    setNewPublicLinkStatus("Criando link publico de edicao...");
    var publicLink = "";

    try {
      var db = initializeFirebase();
      var docRef = db.collection(COLLECTION_NAME).doc();
      var timestamp = new Date().toISOString();
      publicLink = buildPublicContractUrl(docRef.id);
      var data = createBlankPublicContractData(docRef.id, publicLink, timestamp);
      var user = currentPortalUser || {};

      await docRef.set({
        archived: false,
        contractId: docRef.id,
        source: "specialized-service-contract-public-link",
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user.email || "desconhecido",
        data: data
      });

      var copied = false;
      try {
        copied = await copyTextToClipboard(publicLink);
      } catch (copyError) {
        copied = false;
      }

      if (!copied) {
        window.prompt("Copie o novo link publico de edicao:", publicLink);
        setNewPublicLinkStatus("Novo link publico de edicao gerado.");
      } else {
        setNewPublicLinkStatus("Novo link publico copiado. Envie para o cliente continuar preenchendo.");
      }

      setNewPublicLinkButtonState(false, "Link copiado");
      await loadContracts();
      setTimeout(function () {
        setNewPublicLinkButtonState(false, "Novo Link Publico");
      }, 1800);
    } catch (error) {
      console.error(error);
      if (publicLink) {
        window.prompt("Copie o novo link publico de edicao:", publicLink);
        setNewPublicLinkStatus("Novo link publico de edicao gerado.");
      } else {
        setNewPublicLinkStatus("Nao foi possivel criar ou copiar o link publico.");
      }
      setNewPublicLinkButtonState(false, "Novo Link Publico");
    }
  }

  var listElement = document.getElementById("contractList");
  var archivedListElement = document.getElementById("archivedContractList");
  var countLabel = document.getElementById("countLabel");
  var archivedCountLabel = document.getElementById("archivedCountLabel");
  var themeToggleBtn = document.getElementById("themeToggleBtn");
  var homeLink = document.getElementById("homeLink");
  var newPublicLinkBtn = document.getElementById("newPublicLinkBtn");
  var newPublicLinkStatus = document.getElementById("newPublicLinkStatus");
  var uploadContractBtn = document.getElementById("uploadContractBtn");
  var uploadContractInput = document.getElementById("uploadContractInput");

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
  if (newPublicLinkBtn) {
    newPublicLinkBtn.onclick = function () {
      createNewPublicLink().catch(function (error) {
        console.error(error);
        setNewPublicLinkButtonState(false, "Novo Link Publico");
        setNewPublicLinkStatus("Nao foi possivel criar o link publico.");
      });
    };
  }
  if (uploadContractBtn && uploadContractInput) {
    uploadContractBtn.onclick = function () {
      uploadContractInput.value = "";
      uploadContractInput.click();
    };
    uploadContractInput.onchange = function () {
      importContractFromFile(uploadContractInput.files && uploadContractInput.files[0]).catch(function (error) {
        console.error(error);
        setUploadContractButtonState(false, "Upload contrato");
        setNewPublicLinkStatus("Nao foi possivel importar o contrato.");
      });
    };
  }

  function renderMessage(container, className, message) {
    container.innerHTML = '<div class="' + className + '">' + message + "</div>";
  }

  async function archiveContract(id) {
    if (!canManageContracts()) return;
    var confirmed = window.confirm("Arquivar este contrato? Ficara visivel na aba Arquivados.");
    if (!confirmed) return;
    var db = initializeFirebase();
    var user = currentPortalUser;
    await db.collection(COLLECTION_NAME).doc(id).update({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: (user && user.email) || "desconhecido"
    });
    await loadContracts();
    if (archivedListElement) await loadArchivedContracts();
  }

  async function restoreContract(id) {
    if (!canManageContracts()) return;
    var confirmed = window.confirm("Reativar este contrato?");
    if (!confirmed) return;
    var db = initializeFirebase();
    await db.collection(COLLECTION_NAME).doc(id).update({
      archived: false,
      archivedAt: null,
      archivedBy: null
    });
    await loadContracts();
    await loadArchivedContracts();
  }

  async function deleteContract(id) {
    if (!canManageContracts()) return;
    var confirmed = window.confirm("Arquivar este contrato de servicos especializados? O registro continuara preservado.");
    if (!confirmed) return;
    var db = initializeFirebase();
    var user = currentPortalUser;
    await db.collection(COLLECTION_NAME).doc(id).set({
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: (user && user.email) || "desconhecido",
      archiveReason: "archive_from_delete_control"
    }, { merge: true });
    await loadContracts();
    if (archivedListElement) await loadArchivedContracts();
  }

  function buildCard(doc, isArchived) {
    var record = doc.data() || {};
    var data = record.data || {};
    var contractor = data.contractor || {};
    var service = data.service || {};
    var pricing = data.pricing || {};
    var contract = data.contract || {};

    var companyName = text(contractor.legalName || contractor.companyName) || "Contrato sem empresa";
    var cnpj = text(contractor.cnpj) || "Nao informado";
    var monitored = text(service.monitoredLocationName || service.monitoredReference || service.monitoredAddress) || "Local da prestacao nao informado";
    var city = text(service.monitoredCity || contractor.city);
    var state = text(service.monitoredState || contractor.state);
    var period = [text(contract.startDate), text(contract.endDate)].filter(Boolean).join(" ate ");
    var updatedAt = formatDate(record.updatedAt || record.createdAt);

    var encodedId = encodeURIComponent(doc.id);
    var actions = "";
    if (!isArchived) {
      actions += '<a class="button" href="/comercial/contratos-servicos-especializados/editor.html?id=' + encodedId + '">Abrir contrato</a>';
      actions += '<button class="button secondary" type="button" data-public-link="' + encodedId + '">Copiar link de edicao</button>';
      if (canManageContracts()) {
        actions += '<button class="button warning" type="button" data-archive="' + doc.id + '">Arquivar</button>';
      }
    } else {
      if (canManageContracts()) {
        actions += '<a class="button secondary" href="/comercial/contratos-servicos-especializados/editor.html?id=' + encodedId + '">Ver contrato</a>';
        actions += '<button class="button secondary" type="button" data-restore="' + doc.id + '">Reativar</button>';
      }
    }

    return (
      '<article class="contract-card">' +
      '<div class="contract-head">' +
      "<div>" +
      "<h2>" + companyName + "</h2>" +
      '<p class="muted">' + [monitored, [city, state].filter(Boolean).join(" / ")].filter(Boolean).join(" â€¢ ") + "</p>" +
      "</div>" +
      '<span class="chip">Serviços Especializados</span>' +
      "</div>" +
      '<div class="meta-grid">' +
      createMetaItem("ID do contrato", record.contractId || doc.id) +
      createMetaItem("CNPJ", cnpj) +
      createMetaItem("Vigencia", period || "Nao informada") +
      createMetaItem("Valor mensal", formatMoney(pricing.monitoringMonthly)) +
      createMetaItem("Hora extra", formatMoney(pricing.equipmentRentalMonthly)) +
      createMetaItem("Telefone", text(contractor.phone) || "-") +
      createMetaItem("E-mail", text(contractor.email1) || "-") +
      createMetaItem("Ultima atualizacao", updatedAt) +
      "</div>" +
      '<div class="contract-actions">' +
      actions +
      "</div>" +
      "</article>"
    );
  }

  function bindCardActions(container) {
    container.querySelectorAll("[data-archive]").forEach(function (button) {
      button.onclick = function () {
        archiveContract(button.dataset.archive).catch(console.error);
      };
    });
    container.querySelectorAll("[data-restore]").forEach(function (button) {
      button.onclick = function () {
        restoreContract(button.dataset.restore).catch(console.error);
      };
    });
    container.querySelectorAll("[data-delete]").forEach(function (button) {
      button.onclick = function () {
        deleteContract(button.dataset.delete).catch(function (error) {
          console.error(error);
          renderMessage(container, "error-state", "Nao foi possivel arquivar o contrato.");
        });
      };
    });
    container.querySelectorAll("[data-public-link]").forEach(function (button) {
      button.onclick = function () {
        copyPublicLink(decodeURIComponent(button.dataset.publicLink), button).catch(function (error) {
          console.error(error);
        });
      };
    });
  }

  async function loadContracts() {
    if (!canAccessContracts()) {
      countLabel.textContent = "Sem permissao";
      renderMessage(listElement, "error-state", "Acesso restrito ao Comercial e ao gerenciamento.");
      return;
    }

    var db = initializeFirebase();
    var snapshot = await db.collection(COLLECTION_NAME).orderBy("updatedAt", "desc").get();

    var activeDocs = snapshot.docs.filter(function (doc) {
      return !doc.data().archived;
    });

    if (!activeDocs.length) {
      countLabel.textContent = "0 contratos";
      renderMessage(listElement, "empty-state", "Nenhum contrato ativo.");
      return;
    }

    var cards = activeDocs.map(function (doc) { return buildCard(doc, false); });
    countLabel.textContent = activeDocs.length + (activeDocs.length === 1 ? " contrato" : " contratos");
    listElement.innerHTML = cards.join("");
    bindCardActions(listElement);
  }

  async function loadArchivedContracts() {
    if (!archivedListElement || !archivedCountLabel) return;
    if (!canAccessContracts()) {
      renderMessage(archivedListElement, "error-state", "Acesso restrito.");
      return;
    }

    var db = initializeFirebase();
    var snapshot = await db.collection(COLLECTION_NAME).orderBy("updatedAt", "desc").get();

    var archivedDocs = snapshot.docs.filter(function (doc) {
      return !!doc.data().archived;
    });

    if (!archivedDocs.length) {
      archivedCountLabel.textContent = "0 arquivados";
      renderMessage(archivedListElement, "empty-state", "Nenhum contrato arquivado.");
      return;
    }

    var cards = archivedDocs.map(function (doc) { return buildCard(doc, true); });
    archivedCountLabel.textContent = archivedDocs.length + (archivedDocs.length === 1 ? " arquivado" : " arquivados");
    archivedListElement.innerHTML = cards.join("");
    bindCardActions(archivedListElement);
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
          loadArchivedContracts().catch(console.error);
        }
      };
    });
  }

  currentPortalUser = readPortalUser();
  setupTabs();
  loadContracts().catch(function (error) {
    countLabel.textContent = "Falha no carregamento";
    renderMessage(listElement, "error-state", "Nao foi possivel carregar a base de servicos especializados.");
    console.error(error);
  });
})();


