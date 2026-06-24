(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TKABodyCamTemplate = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  var TERM_TYPE = "body_cam_responsibility";
  var TERM_VERSION = "2026-06-09.3";
  var TERM_TITLE = "TERMO DE RECEBIMENTO E RESPONSABILIDADE DE USO — BODY CAM";
  var EQUIPMENT_COLLECTION = "operacional_body_cam_equipment";
  var TERMS_COLLECTION = "operacional_body_cam_terms";
  var DEFAULT_MANUAL_URL = "/operacional/inventario/body-cam/assets/x7-manual.pdf";
  var MANUAL_LABEL = "Manual X7 em PDF";
  var OWNER_SIGNATURE_DOC = "ownerSignature";
  var DEFAULT_COMPANY_SIGNER_NAME = "KÁTIO AUGUSTO MACHADO DA SILVA";
  var COMPANY_SIGNATURE_LABEL = "Assinatura da empresa";

  var CLAUSES = [
    "Recebo a Body Cam e os acessorios listados neste termo para uso exclusivamente profissional, durante atividades vinculadas a empresa.",
    "Comprometo-me a utilizar o equipamento somente em atividades autorizadas pela empresa, respeitando ordens operacionais, procedimentos internos e limites de uso definidos.",
    "Assumo a guarda operacional do equipamento e dos acessorios recebidos, comprometendo-me a proteger, conservar, zelar e devolver todos os itens quando solicitado ou ao final da atribuicao.",
    "E proibido emprestar, transferir, abrir, desmontar, modificar, retirar chip SIM ou cartao de memoria, remover lacres, alterar configuracoes, apagar registros ou contornar controles de seguranca.",
    "Devo seguir o manual ou politica de uso para gravacao, carregamento, envio ou sincronizacao, armazenamento temporario, devolucao e demais rotinas de operacao do equipamento.",
    "E proibido copiar, baixar, editar, apagar, compartilhar, publicar ou armazenar imagens, videos, audios ou registros em sistemas nao autorizados, dispositivos pessoais, WhatsApp, e-mail, nuvem pessoal ou redes sociais.",
    "Devo comunicar imediatamente perda, furto, roubo, dano, quebra, mau funcionamento, acesso nao autorizado, gravacao acidental, compartilhamento indevido ou qualquer suspeita de incidente envolvendo dados ou registros.",
    "Estou ciente de que poderei responder a apuracao interna e ser responsabilizado quando comprovado mau uso, negligencia, imprudencia, impericia, dolo ou descumprimento das instrucoes recebidas.",
    "Compreendo que gravacoes e registros pertencem a empresa, que define finalidade, retencao, regras de acesso, controles de seguranca e tratamento de incidentes conforme suas politicas internas.",
    "Declaro ter recebido o manual ou politica aplicavel e orientacao suficiente para operar, conservar, devolver e reportar ocorrencias relacionadas ao equipamento."
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function manualUrl() {
    return DEFAULT_MANUAL_URL;
  }

  function safeManualHref(value) {
    return manualUrl(value);
  }

  function assignmentParts(value) {
    var parts = text(value).split(/\s+[-\u2013\u2014]\s+/).map(text).filter(Boolean);
    if (parts.length < 2) return {};
    return {
      employeeUsagePost: parts[0],
      employeeWorkShift: parts.slice(1).join(" - ")
    };
  }

  function dateLabel(value) {
    if (!value) return "";
    var raw = text(value);
    var parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T00:00:00" : raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString("pt-BR");
  }

  function dateTimeLabel(value) {
    if (!value) return "";
    var parsed = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleString("pt-BR");
  }

  function cleanIdPart(value) {
    return text(value || "item")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "item";
  }

  function newId(prefix) {
    return cleanIdPart(prefix || "body-cam") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeAccessories(value) {
    if (Array.isArray(value)) {
      return value.map(text).filter(Boolean);
    }
    return text(value)
      .split(/\r?\n|;/)
      .map(text)
      .filter(Boolean);
  }

  function accessoriesLabel(value) {
    var items = normalizeAccessories(value);
    return items.length ? items.join("; ") : "";
  }

  function buildPublicLink(id) {
    var origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://gerenciamento-tka.web.app";
    var url = new URL("/operacional/inventario/body-cam/editor.html", origin);
    url.searchParams.set("id", text(id));
    url.searchParams.set("public", "1");
    return url.toString();
  }

  function createDefaultEquipment(id) {
    return {
      id: id || "",
      deviceBrand: "",
      deviceModel: "",
      assetTag: "",
      serialNumber: "",
      internalId: "",
      imeiOrSimNumber: "",
      accessoriesDelivered: [],
      deviceCondition: "Bom estado",
      conditionNotes: "",
      manualUrl: manualUrl(),
      policyUrl: "",
      active: true,
      archived: false
    };
  }

  function normalizeEquipment(incoming, id) {
    var next = Object.assign(createDefaultEquipment(id), incoming || {});
    next.id = text(next.id || id);
    next.deviceBrand = text(next.deviceBrand);
    next.deviceModel = text(next.deviceModel);
    next.assetTag = text(next.assetTag);
    next.serialNumber = text(next.serialNumber);
    next.imeiOrSimNumber = text(next.imeiOrSimNumber);
    next.internalId = text(next.internalId || next.imeiOrSimNumber);
    next.accessoriesDelivered = normalizeAccessories(next.accessoriesDelivered);
    next.deviceCondition = text(next.deviceCondition || "Bom estado");
    next.conditionNotes = text(next.conditionNotes);
    next.manualUrl = manualUrl();
    next.policyUrl = text(next.policyUrl);
    next.active = next.active !== false;
    next.archived = Boolean(next.archived);
    return next;
  }

  function createDefaultTerm(id, publicLink, equipment, employee) {
    var normalizedEquipment = normalizeEquipment(equipment || {});
    employee = employee || {};
    var assignment = assignmentParts(employee.assignmentLabel || employee.email);
    var timestamp = nowIso();
    return {
      id: id || "",
      termType: TERM_TYPE,
      termVersion: TERM_VERSION,
      publicLink: publicLink || "",
      assignedUserEmail: text(employee.email),
      equipmentId: text(normalizedEquipment.id),
      employeeName: text(employee.employeeName || employee.name),
      employeeDocument: text(employee.employeeDocument),
      employeeInternalId: text(employee.employeeInternalId),
      employeeRole: text(employee.employeeRole),
      employeeDepartment: text(employee.employeeDepartment),
      employeeUsagePost: text(employee.employeeUsagePost || employee.usagePost || assignment.employeeUsagePost),
      employeeWorkShift: text(employee.employeeWorkShift || employee.workShift || assignment.employeeWorkShift),
      companyName: text(employee.companyName || "GRUPO TKA"),
      deviceBrand: normalizedEquipment.deviceBrand,
      deviceModel: normalizedEquipment.deviceModel,
      assetTag: normalizedEquipment.assetTag,
      serialNumber: normalizedEquipment.serialNumber,
      internalId: normalizedEquipment.internalId,
      imeiOrSimNumber: normalizedEquipment.imeiOrSimNumber,
      accessoriesDelivered: normalizeAccessories(normalizedEquipment.accessoriesDelivered),
      deliveryDate: "",
      deviceCondition: normalizedEquipment.deviceCondition,
      conditionNotes: normalizedEquipment.conditionNotes,
      manualUrl: manualUrl(),
      policyUrl: normalizedEquipment.policyUrl,
      responsibleForDeliveryName: "",
      companySignerName: text(employee.companySignerName || DEFAULT_COMPANY_SIGNER_NAME),
      companySignatureDataUrl: text(employee.companySignatureDataUrl || employee.ownerSignatureDataUrl),
      companySignatureUpdatedAt: text(employee.companySignatureUpdatedAt || employee.ownerSignatureUpdatedAt),
      signatureCity: "",
      signatureDateTime: "",
      acknowledgements: {
        equipmentReceived: false,
        policyRead: false
      },
      signatureData: "",
      signedAt: "",
      termSnapshot: null,
      status: "incomplete",
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function normalizeTerm(incoming, id, publicLink) {
    var base = createDefaultTerm(id || (incoming && incoming.id), publicLink || (incoming && incoming.publicLink));
    var next = Object.assign(base, incoming || {});
    next.id = text(next.id || id);
    next.termType = text(next.termType || TERM_TYPE);
    next.termVersion = text(next.termVersion || TERM_VERSION);
    next.publicLink = text(next.publicLink || publicLink || (next.id ? buildPublicLink(next.id) : ""));
    next.assignedUserEmail = text(next.assignedUserEmail);
    next.equipmentId = text(next.equipmentId);
    [
      "employeeName",
      "employeeDocument",
      "employeeInternalId",
      "employeeRole",
      "employeeDepartment",
      "employeeUsagePost",
      "employeeWorkShift",
      "companyName",
      "deviceBrand",
      "deviceModel",
      "assetTag",
      "serialNumber",
      "internalId",
      "imeiOrSimNumber",
      "deliveryDate",
      "deviceCondition",
      "conditionNotes",
      "manualUrl",
      "policyUrl",
      "responsibleForDeliveryName",
      "companySignerName",
      "companySignatureDataUrl",
      "companySignatureUpdatedAt",
      "signatureCity",
      "signatureDateTime",
      "signatureData",
      "signedAt"
    ].forEach(function (key) {
      next[key] = text(next[key]);
    });
    next.accessoriesDelivered = normalizeAccessories(next.accessoriesDelivered);
    next.acknowledgements = Object.assign({}, base.acknowledgements, next.acknowledgements || {});
    next.acknowledgements.equipmentReceived = Boolean(next.acknowledgements.equipmentReceived);
    next.acknowledgements.policyRead = Boolean(next.acknowledgements.policyRead);
    next.termSnapshot = next.termSnapshot && typeof next.termSnapshot === "object" ? next.termSnapshot : null;
    next.manualUrl = manualUrl();
    next.companySignerName = next.companySignerName || DEFAULT_COMPANY_SIGNER_NAME;
    next.companySignatureDataUrl = text(next.companySignatureDataUrl || next.ownerSignatureDataUrl);
    next.companySignatureUpdatedAt = text(next.companySignatureUpdatedAt || next.ownerSignatureUpdatedAt);
    next.archived = Boolean(next.archived);
    next.status = deriveStatusFromNormalized(next);
    return next;
  }

  function requiredIssuesFromNormalized(data, options) {
    options = options || {};
    var issues = [];
    if (!data.employeeName) issues.push("Nome do colaborador");
    if (!data.employeeDocument && !data.employeeInternalId) issues.push("Documento ou matricula");
    if (!data.employeeRole) issues.push("Cargo ou funcao");
    if (!data.employeeUsagePost) issues.push("Posto de uso");
    if (!data.employeeWorkShift) issues.push("Turno de trabalho");
    if (!data.companyName) issues.push("Empresa");
    if (!data.deviceBrand) issues.push("Marca do equipamento");
    if (!data.deviceModel) issues.push("Modelo do equipamento");
    if (!data.assetTag) issues.push("Patrimonio");
    if (!data.serialNumber) issues.push("Numero de serie");
    if (!data.accessoriesDelivered.length) issues.push("Acessorios entregues");
    if (!data.deliveryDate) issues.push("Data de entrega");
    if (!data.deviceCondition) issues.push("Condicao do equipamento");
    if (!data.responsibleForDeliveryName) issues.push("Responsavel pela entrega");
    if (!data.signedAt && !data.signatureCity) issues.push("Cidade da assinatura");
    if (!data.signedAt && !data.signatureDateTime) issues.push("Data e hora da assinatura");
    if (!data.acknowledgements.equipmentReceived) issues.push("Confirmacao de recebimento");
    if (!data.acknowledgements.policyRead) issues.push("Confirmacao de leitura do manual");
    if (!data.signatureData) issues.push("Assinatura do colaborador");
    if (!data.companySignatureDataUrl) issues.push("Assinatura da empresa");
    if (options.requireSignedAt && !data.signedAt) issues.push("Data/hora de assinatura");
    return issues;
  }

  function requiredIssues(term, options) {
    return requiredIssuesFromNormalized(normalizeTerm(term || {}), options);
  }

  function canSubmit(term) {
    return requiredIssues(term).length === 0;
  }

  function deriveStatusFromNormalized(term) {
    var data = term || {};
    if (data.archived) return "archived";
    if (text(data.signedAt)) return "complete";
    return "incomplete";
  }

  function deriveStatus(term) {
    return deriveStatusFromNormalized(normalizeTerm(term || {}));
  }

  function statusLabel(status) {
    var map = {
      complete: "Completo",
      incomplete: "Incompleto",
      archived: "Arquivado"
    };
    return map[status] || "Incompleto";
  }

  function summaryIssues(term) {
    var data = normalizeTerm(term || {});
    if (deriveStatus(data) === "complete") return "Termo assinado em " + dateTimeLabel(data.signedAt);
    var issues = requiredIssues(data);
    return issues.length ? issues.slice(0, 4).join(", ") + (issues.length > 4 ? "..." : "") : "Pronto para assinatura";
  }

  function termSnapshot(term) {
    var data = normalizeTerm(term || {});
    return {
      termType: TERM_TYPE,
      termVersion: data.termVersion || TERM_VERSION,
      title: TERM_TITLE,
      clauses: clone(CLAUSES),
      manualUrl: manualUrl(),
      employeeUsagePost: data.employeeUsagePost,
      employeeWorkShift: data.employeeWorkShift,
      companySignerName: data.companySignerName,
      companySignatureDataUrl: data.companySignatureDataUrl,
      companySignatureUpdatedAt: data.companySignatureUpdatedAt,
      capturedAt: nowIso()
    };
  }

  function clausesForTerm(term) {
    var snapshot = term && term.termSnapshot;
    if (snapshot && Array.isArray(snapshot.clauses) && snapshot.clauses.length) return snapshot.clauses.map(text).filter(Boolean);
    return CLAUSES.slice();
  }

  function titleForTerm(term) {
    return term && term.termSnapshot && text(term.termSnapshot.title) || TERM_TITLE;
  }

  function stateForCloud(term) {
    var data = normalizeTerm(term || {});
    data.status = deriveStatus(data);
    return clone(data);
  }

  function buildSubmissionPayload(term, signedAt, signatureData) {
    var data = normalizeTerm(term || {});
    data.signatureData = text(signatureData || data.signatureData);
    data.signatureDateTime = text(data.signatureDateTime || signedAt || data.signedAt || nowIso());
    data.signedAt = text(signedAt || data.signedAt || data.signatureDateTime || nowIso());
    data.termSnapshot = data.termSnapshot || termSnapshot(data);
    data.status = deriveStatus(data);
    data.updatedAt = nowIso();
    return stateForCloud(data);
  }

  function equipmentSummary(term) {
    var data = normalizeTerm(term || {});
    return [
      ["Marca", data.deviceBrand],
      ["Modelo", data.deviceModel],
      ["Patrimonio", data.assetTag],
      ["Serie", data.serialNumber],
      ["ID Interno", data.internalId || data.imeiOrSimNumber || "Nao informado"],
      ["Acessorios", accessoriesLabel(data.accessoriesDelivered)],
      ["Condicao", data.deviceCondition],
      ["Observacoes", data.conditionNotes || "Sem observacoes"]
    ];
  }

  function renderTermHtml(term) {
    var data = normalizeTerm(term || {});
    var rows = equipmentSummary(data).map(function (row) {
      return "<tr><th>" + escapeHtml(row[0]) + "</th><td>" + escapeHtml(row[1] || "-") + "</td></tr>";
    }).join("");
    var clauses = clausesForTerm(data).map(function (clause) {
      return "<li>" + escapeHtml(clause) + "</li>";
    }).join("");
    var signature = data.signatureData
      ? '<img class="term-signature-image" src="' + escapeHtml(data.signatureData) + '" alt="Assinatura do colaborador" />'
      : '<span class="muted">Assinatura pendente</span>';
    var companySignature = data.companySignatureDataUrl
      ? '<img class="term-signature-image" src="' + escapeHtml(data.companySignatureDataUrl) + '" alt="' + escapeHtml(COMPANY_SIGNATURE_LABEL) + '" />'
      : '<span class="muted">Assinatura da empresa pendente no Admin</span>';
    var manualHref = safeManualHref();
    var manualMarkup = manualHref
      ? '<a class="term-manual-link" href="' + escapeHtml(manualHref) + '" target="_blank" rel="noreferrer">Abrir PDF</a><a class="term-manual-link" href="' + escapeHtml(manualHref) + '" download="manual-x7.pdf">Baixar PDF</a>'
      : escapeHtml(MANUAL_LABEL);

    return ''
      + '<article class="term-a4" data-term-type="' + escapeHtml(TERM_TYPE) + '">'
      + '  <header class="term-header">'
      + '    <p>GRUPO TKA</p>'
      + '    <h2>' + escapeHtml(titleForTerm(data)) + "</h2>"
      + '    <span>Versao ' + escapeHtml(data.termVersion || TERM_VERSION) + "</span>"
      + "  </header>"
      + '  <section class="term-identification">'
      + '    <p><strong>Colaborador:</strong> ' + escapeHtml(data.employeeName || "-") + "</p>"
      + '    <p><strong>Documento/Matricula:</strong> ' + escapeHtml(data.employeeDocument || data.employeeInternalId || "-") + "</p>"
      + '    <p><strong>Cargo e departamento:</strong> ' + escapeHtml([data.employeeRole, data.employeeDepartment].filter(Boolean).join(" | ") || "-") + "</p>"
      + '    <p><strong>Posto de uso:</strong> ' + escapeHtml(data.employeeUsagePost || "-") + "</p>"
      + '    <p><strong>Turno de trabalho:</strong> ' + escapeHtml(data.employeeWorkShift || "-") + "</p>"
      + '    <p><strong>Empresa:</strong> ' + escapeHtml(data.companyName || "-") + "</p>"
      + '    <p><strong>Entrega:</strong> ' + escapeHtml(dateLabel(data.deliveryDate) || "-") + " por " + escapeHtml(data.responsibleForDeliveryName || "-") + "</p>"
      + '    <p><strong>Assinatura:</strong> ' + escapeHtml([data.signatureCity, dateTimeLabel(data.signatureDateTime || data.signedAt)].filter(Boolean).join(" | ") || "-") + "</p>"
      + '    <p class="term-manual-row"><strong>Manual:</strong> <span>' + escapeHtml(MANUAL_LABEL) + "</span> " + manualMarkup + "</p>"
      + "  </section>"
      + '  <table class="equipment-summary"><tbody>' + rows + "</tbody></table>"
      + '  <ol class="term-clauses">' + clauses + "</ol>"
      + '  <section class="term-ack-preview">'
      + '    <p>' + (data.acknowledgements.equipmentReceived ? "☑" : "☐") + " Confirmo que recebi o equipamento e acessorios listados.</p>"
      + '    <p>' + (data.acknowledgements.policyRead ? "☑" : "☐") + " Confirmo que li o manual de uso e entendi minhas obrigacoes.</p>"
      + "  </section>"
      + '  <section class="term-signatures">'
      + '    <div><strong>Assinatura do colaborador</strong>' + signature + '<span>' + escapeHtml(data.employeeName || "Colaborador") + "</span></div>"
      + '    <div><strong>' + escapeHtml(COMPANY_SIGNATURE_LABEL) + "</strong>" + companySignature + '<span>' + escapeHtml(data.companySignerName || DEFAULT_COMPANY_SIGNER_NAME) + "</span></div>"
      + '    <div><strong>Data / hora / cidade</strong><span>' + escapeHtml([dateTimeLabel(data.signatureDateTime || data.signedAt), data.signatureCity].filter(Boolean).join(" | ") || "Pendente") + "</span></div>"
      + '    <div><strong>Responsavel pela entrega</strong><span>' + escapeHtml(data.responsibleForDeliveryName || "-") + "</span></div>"
      + "  </section>"
      + "</article>";
  }

  return {
    TERM_TYPE: TERM_TYPE,
    TERM_VERSION: TERM_VERSION,
    TERM_TITLE: TERM_TITLE,
    EQUIPMENT_COLLECTION: EQUIPMENT_COLLECTION,
    TERMS_COLLECTION: TERMS_COLLECTION,
    CLAUSES: CLAUSES.slice(),
    DEFAULT_MANUAL_URL: DEFAULT_MANUAL_URL,
    MANUAL_LABEL: MANUAL_LABEL,
    OWNER_SIGNATURE_DOC: OWNER_SIGNATURE_DOC,
    DEFAULT_COMPANY_SIGNER_NAME: DEFAULT_COMPANY_SIGNER_NAME,
    COMPANY_SIGNATURE_LABEL: COMPANY_SIGNATURE_LABEL,
    accessoriesLabel: accessoriesLabel,
    assignmentParts: assignmentParts,
    buildPublicLink: buildPublicLink,
    buildSubmissionPayload: buildSubmissionPayload,
    canSubmit: canSubmit,
    cleanIdPart: cleanIdPart,
    clone: clone,
    createDefaultEquipment: createDefaultEquipment,
    createDefaultTerm: createDefaultTerm,
    dateLabel: dateLabel,
    dateTimeLabel: dateTimeLabel,
    deriveStatus: deriveStatus,
    equipmentSummary: equipmentSummary,
    escapeHtml: escapeHtml,
    newId: newId,
    normalizeAccessories: normalizeAccessories,
    normalizeEquipment: normalizeEquipment,
    normalizeTerm: normalizeTerm,
    renderTermHtml: renderTermHtml,
    requiredIssues: requiredIssues,
    safeManualHref: safeManualHref,
    stateForCloud: stateForCloud,
    statusLabel: statusLabel,
    summaryIssues: summaryIssues,
    termSnapshot: termSnapshot,
    text: text
  };
});
