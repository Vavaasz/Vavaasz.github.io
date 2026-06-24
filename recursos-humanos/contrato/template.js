(function () {
  var PAGE_WIDTH = 595.25;
  var PAGE_HEIGHT = 841.9;

  var TRANSPORT_MODE_KEYS = [
    { key: "integrationMetro", label: "Integracao onibus/metro" },
    { key: "integrationTrain", label: "Integracao onibus/trem" },
    { key: "municipalBus", label: "Onibus municipal" },
    { key: "intercityBus", label: "Onibus intermunicipal" },
    { key: "metroTrain", label: "Metro ou trem" },
    { key: "other", label: "Outros" }
  ];

  var CARD_FLASH_LABEL = "Cart\u00e3o Flash";
  var CARD_TYPES = [
    { key: "cartaoFlash", label: CARD_FLASH_LABEL }
  ];
  var LEGACY_CARD_TYPES = {
    bilheteUnico: true,
    cartaoBom: true,
    cartaoDiaFacil: true,
    other: true
  };

  var OVERLAY_SIGNATURES = {
    employerContract: { x: 26, y: 646, width: 220, height: 34 },
    employeeContract: { x: 333, y: 646, width: 220, height: 34 },
    employerExtension: { x: 26, y: 124, width: 220, height: 34 },
    employeeExtension: { x: 333, y: 124, width: 220, height: 34 },
    employeeTransport: { x: 300, y: 690, width: 215, height: 36 },
    employeeTax: { x: 326, y: 373, width: 210, height: 34 },
    employeeFamilySheet: { x: 42, y: 370, width: 195, height: 34 },
    employeeResponsibility: { x: 36, y: 480, width: 215, height: 34 },
    employeeRegistry: { x: 372, y: 674, width: 188, height: 34 },
    employeeLgpd: { x: 40, y: 225, width: 225, height: 34 },
    employerLgpd: { x: 336, y: 225, width: 220, height: 34 }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value || "").trim();
  }

  function normalizeCardType(value) {
    var normalized = text(value);
    if (!normalized || LEGACY_CARD_TYPES[normalized]) return "cartaoFlash";
    return normalized === "cartaoFlash" ? normalized : "cartaoFlash";
  }

  function slugId(value) {
    return text(value).toLowerCase();
  }

  function createTransportSide() {
    var side = {};
    TRANSPORT_MODE_KEYS.forEach(function (item) {
      side[item.key] = { selected: false, fare: "" };
    });
    return side;
  }

  function createDefaultState(sample) {
    return {
      meta: {
        formId: sample.id,
        sampleId: sample.id,
        archived: false,
        publicSubmittedAt: "",
        updatedAtLabel: ""
      },
      transport: {
        choice: "",
        ida: createTransportSide(),
        volta: createTransportSide(),
        cardType: "cartaoFlash",
        cardOther: "",
        dailyTrips: ""
      },
      signature: {
        employeeDataUrl: "",
        updatedAtLabel: ""
      }
    };
  }

  function mergeTransportSide(base, incoming) {
    var merged = createTransportSide();
    Object.keys(merged).forEach(function (key) {
      merged[key] = Object.assign({}, merged[key], incoming && incoming[key] || {});
    });
    return merged;
  }

  function normalizeState(sample, incoming) {
    var base = createDefaultState(sample);
    var next = incoming || {};
    var transport = Object.assign({}, base.transport, next.transport || {}, {
      ida: mergeTransportSide(base.transport.ida, next.transport && next.transport.ida),
      volta: mergeTransportSide(base.transport.volta, next.transport && next.transport.volta)
    });
    transport.cardType = normalizeCardType(transport.cardType);
    transport.cardOther = "";

    return {
      meta: Object.assign({}, base.meta, next.meta || {}, {
        formId: sample.id,
        sampleId: sample.id
      }),
      transport: transport,
      signature: Object.assign({}, base.signature, next.signature || {})
    };
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
      target = target[keys[index]];
    }
    target[keys[keys.length - 1]] = value;
  }

  function shortDateTime(value) {
    if (!value) return "";
    var parsed = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("pt-BR");
  }

  function normalizeMoney(value) {
    var raw = text(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "");
    if (!raw) return "";
    if (raw.indexOf(",") >= 0) return raw;
    var number = Number(raw);
    if (!Number.isFinite(number)) return raw;
    return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function hasSelectedModes(side) {
    return TRANSPORT_MODE_KEYS.some(function (item) {
      return Boolean(side && side[item.key] && side[item.key].selected);
    });
  }

  function requiredIssues(state, ownerSignatureDataUrl) {
    var issues = [];

    if (!text(ownerSignatureDataUrl)) issues.push("Assinatura da direcao");
    if (!text(state && state.signature && state.signature.employeeDataUrl)) issues.push("Assinatura");

    if (!text(state && state.transport && state.transport.choice)) {
      issues.push("Vale-transporte");
      return issues;
    }

    if (state.transport.choice !== "accept") {
      return issues;
    }

    if (!hasSelectedModes(state.transport.ida)) issues.push("Vale-transporte - ida");
    if (!hasSelectedModes(state.transport.volta)) issues.push("Vale-transporte - volta");

    TRANSPORT_MODE_KEYS.forEach(function (item) {
      var idaItem = state.transport.ida[item.key];
      var voltaItem = state.transport.volta[item.key];
      if (idaItem && idaItem.selected && !text(idaItem.fare)) issues.push("Tarifa da ida - " + item.label);
      if (voltaItem && voltaItem.selected && !text(voltaItem.fare)) issues.push("Tarifa da volta - " + item.label);
    });

    if (!text(state.transport.cardType)) issues.push("Tipo de cartao");
    if (!text(state.transport.dailyTrips)) issues.push("Conducoes por dia");

    return issues;
  }

  function isComplete(state, ownerSignatureDataUrl) {
    return requiredIssues(state, ownerSignatureDataUrl).length === 0;
  }

  function summaryIssues(state, ownerSignatureDataUrl) {
    var issues = requiredIssues(state, ownerSignatureDataUrl);
    if (!issues.length) return "Vale-transporte e assinatura completos";

    var labels = [];
    if (issues.some(function (item) { return item === "Assinatura"; })) labels.push("Assinatura");
    if (issues.some(function (item) { return item === "Assinatura da direcao"; })) labels.push("Assinatura da direcao");
    if (issues.some(function (item) { return item !== "Assinatura" && item !== "Assinatura da direcao"; })) labels.push("Vale-transporte");
    return labels.join(", ") + " pendente";
  }

  function statusLabel(record, ownerSignatureDataUrl) {
    if (record.meta && record.meta.archived) return "Arquivado";
    if (record.meta && record.meta.publicSubmittedAt && isComplete(record, ownerSignatureDataUrl)) return "Recebido";
    if (isComplete(record, ownerSignatureDataUrl)) return "Pronto";
    return "Pendente";
  }

  function overlayText(pageItems, payload) {
    if (!text(payload.text)) return;
    pageItems.push(Object.assign({
      type: "text",
      fontSize: 11,
      align: "left",
      weight: 600
    }, payload));
  }

  function overlayImage(pageItems, dataUrl, rect) {
    if (!text(dataUrl)) return;
    pageItems.push({
      type: "signature",
      dataUrl: dataUrl,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
  }

  function addTransportModeMarks(pageItems, side, originX, fareX) {
    var rows = [486.7, 497.6, 508.6, 519.5, 530.5, 541.4];
    TRANSPORT_MODE_KEYS.forEach(function (item, index) {
      var current = side[item.key];
      if (current && current.selected) {
        overlayText(pageItems, { text: "X", x: originX, y: rows[index], fontSize: 15, weight: 800 });
      }
      if (current && text(current.fare)) {
        overlayText(pageItems, { text: normalizeMoney(current.fare), x: fareX, y: rows[index], fontSize: 10 });
      }
    });
  }

  function addCardMarks(pageItems, state) {
    var rows = {
      cartaoFlash: 622.0
    };

    if (state.transport.cardType && rows[state.transport.cardType]) {
      overlayText(pageItems, { text: "X", x: 24.5, y: rows[state.transport.cardType], fontSize: 15, weight: 800 });
    }
    if (state.transport.cardType === "cartaoFlash") {
      overlayText(pageItems, { text: CARD_FLASH_LABEL, x: 67, y: 623.0, fontSize: 10 });
    }
  }

  function buildPreviewPages(sample, state, ownerSignatureDataUrl) {
    var employeeSignature = text(state && state.signature && state.signature.employeeDataUrl);
    var pages = (sample.pageUrls || []).map(function (url) {
      return {
        url: url,
        overlays: []
      };
    });

    if (pages[0]) {
      overlayImage(pages[0].overlays, ownerSignatureDataUrl, OVERLAY_SIGNATURES.employerContract);
      overlayImage(pages[0].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeContract);
    }
    if (pages[1]) {
      overlayImage(pages[1].overlays, ownerSignatureDataUrl, OVERLAY_SIGNATURES.employerExtension);
      overlayImage(pages[1].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeExtension);
    }
    if (pages[2]) {
      if (state.transport.choice === "accept") {
        overlayText(pages[2].overlays, { text: "X", x: 21, y: 186, fontSize: 15, weight: 800, previewOffsetY: -8 });
        addTransportModeMarks(pages[2].overlays, state.transport.ida, 24, 187);
        addTransportModeMarks(pages[2].overlays, state.transport.volta, 286, 464);
        addCardMarks(pages[2].overlays, state);
        overlayText(pages[2].overlays, { text: state.transport.dailyTrips, x: 362, y: 575, fontSize: 10 });
      } else if (state.transport.choice === "decline") {
        overlayText(pages[2].overlays, { text: "X", x: 277, y: 186, fontSize: 15, weight: 800, previewOffsetY: -8 });
      }
      overlayImage(pages[2].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeTransport);
    }
    if (pages[3]) overlayImage(pages[3].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeTax);
    if (pages[4]) overlayImage(pages[4].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeFamilySheet);
    if (pages[5]) overlayImage(pages[5].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeResponsibility);
    if (pages[6]) overlayImage(pages[6].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeRegistry);
    if (pages[9]) {
      overlayImage(pages[9].overlays, employeeSignature, OVERLAY_SIGNATURES.employeeLgpd);
      overlayImage(pages[9].overlays, ownerSignatureDataUrl, OVERLAY_SIGNATURES.employerLgpd);
    }

    return pages;
  }

  function sampleMap() {
    var map = {};
    (window.TKAContractSamples || []).forEach(function (sample) {
      map[sample.id] = sample;
    });
    return map;
  }

  function findSample(id) {
    return sampleMap()[slugId(id)] || null;
  }

  window.TKAContractTemplate = {
    PAGE_WIDTH: PAGE_WIDTH,
    PAGE_HEIGHT: PAGE_HEIGHT,
    CARD_TYPES: CARD_TYPES,
    TRANSPORT_MODE_KEYS: TRANSPORT_MODE_KEYS,
    buildDefaultState: createDefaultState,
    buildPreviewPages: buildPreviewPages,
    clone: clone,
    findSample: findSample,
    getPathValue: getPathValue,
    isComplete: isComplete,
    normalizeState: normalizeState,
    requiredIssues: requiredIssues,
    setPathValue: setPathValue,
    shortDateTime: shortDateTime,
    statusLabel: statusLabel,
    summaryIssues: summaryIssues,
    text: text
  };
})();
