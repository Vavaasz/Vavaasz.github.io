(function () {
  var PAGE = {
    width: 595.28,
    height: 841.89,
    left: 46,
    right: 46,
    top: 48,
    bottom: 58
  };
  var RED = [153, 43, 31];
  var DARK = [39, 27, 22];
  var MUTED = [98, 79, 69];

  function text(value) {
    return window.TKAServiceOrderTemplate.text(value);
  }

  function safeFileName(value) {
    return text(value || "ordem-servico").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ordem-servico";
  }

  function drawHeader(doc, state) {
    var documentData = state.document || {};
    doc.setFillColor(153, 43, 31);
    doc.rect(0, 0, PAGE.width, 14, "F");
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("GRUPO TKA", PAGE.left, 34);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Ordem de servico RH", PAGE.width - PAGE.right, 34, { align: "right" });
    doc.text(text(documentData.employeeName || "Sem colaborador"), PAGE.width - PAGE.right, 46, { align: "right" });
    doc.setDrawColor(226, 214, 207);
    doc.line(PAGE.left, 58, PAGE.width - PAGE.right, 58);
  }

  function addPage(doc, state) {
    doc.addPage();
    drawHeader(doc, state);
    return PAGE.top + 28;
  }

  function ensureSpace(doc, state, y, needed) {
    if (y + needed <= PAGE.height - PAGE.bottom) return y;
    return addPage(doc, state);
  }

  function addWrappedText(doc, state, textValue, x, y, maxWidth, options) {
    var opts = options || {};
    var lines = doc.splitTextToSize(text(textValue), maxWidth);
    var lineHeight = opts.lineHeight || 13;
    if (!lines.length) return y;
    y = ensureSpace(doc, state, y, lines.length * lineHeight + 4);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.fontSize || 10);
    doc.setTextColor((opts.color || DARK)[0], (opts.color || DARK)[1], (opts.color || DARK)[2]);
    lines.forEach(function (line) {
      doc.text(line, x, y);
      y += lineHeight;
    });
    return y;
  }

  function addSection(doc, state, section, y) {
    y = ensureSpace(doc, state, y, 44);
    doc.setFillColor(185, 34, 28);
    doc.roundedRect(PAGE.left, y, PAGE.width - PAGE.left - PAGE.right, 24, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(text(section.title), PAGE.left + 12, y + 16);
    y += 38;

    text(section.body).split(/\n+/).forEach(function (paragraph) {
      if (!text(paragraph)) return;
      y = addWrappedText(doc, state, paragraph, PAGE.left, y, PAGE.width - PAGE.left - PAGE.right, {
        fontSize: 10,
        lineHeight: 13,
        color: DARK
      }) + 5;
    });
    return y + 4;
  }

  function drawMetaRow(doc, label, value, x, y, width) {
    doc.setDrawColor(226, 214, 207);
    doc.setFillColor(255, 252, 247);
    doc.roundedRect(x, y, width, 42, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(153, 43, 31);
    doc.text(label, x + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(text(value || "-"), x + 10, y + 31, { maxWidth: width - 20 });
  }

  function drawSignature(doc, title, name, dataUrl, x, y, width) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(153, 43, 31);
    doc.text(title, x, y);
    doc.setDrawColor(226, 214, 207);
    doc.roundedRect(x, y + 8, width, 86, 8, 8, "S");
    if (text(dataUrl)) {
      try {
        doc.addImage(dataUrl, "PNG", x + 16, y + 18, width - 32, 42);
      } catch (error) {
        console.warn("Falha ao inserir assinatura no PDF.", error);
      }
    }
    doc.setDrawColor(226, 214, 207);
    doc.line(x + 18, y + 63, x + width - 18, y + 63);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(name || "Assinatura", x + width / 2, y + 80, { align: "center" });
  }

  async function download(state, ownerSignatureDataUrl) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF indisponivel.");
    var normalized = window.TKAServiceOrderTemplate.normalizeState(state, state && state.meta && state.meta.serviceOrderId, state && state.meta && state.meta.publicLink);
    var documentData = normalized.document || {};
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var y = PAGE.top + 36;

    drawHeader(doc, normalized);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(153, 43, 31);
    doc.setFontSize(18);
    doc.text(text(documentData.title || "ORDEM DE SERVICO"), PAGE.width / 2, y, { align: "center" });
    y += 24;

    drawMetaRow(doc, "ELABORACAO POR", documentData.preparedBy, PAGE.left, y, 154);
    drawMetaRow(doc, "ULTIMA REVISAO", window.TKAServiceOrderTemplate.dateLabel(documentData.revisionDate), PAGE.left + 166, y, 154);
    drawMetaRow(doc, "CIDADE / DATA", [text(documentData.city), window.TKAServiceOrderTemplate.dateLabel(documentData.date)].filter(Boolean).join(", "), PAGE.left + 332, y, 171);
    y += 54;
    drawMetaRow(doc, "NOME", documentData.employeeName, PAGE.left, y, 240);
    drawMetaRow(doc, "CARGO / FUNCAO", documentData.employeeRole, PAGE.left + 252, y, 120);
    drawMetaRow(doc, "SETOR", documentData.sector, PAGE.left + 384, y, 119);
    y += 66;

    (documentData.sections || []).forEach(function (section) {
      y = addSection(doc, normalized, section, y);
    });

    y = ensureSpace(doc, normalized, y, 156);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text([text(documentData.city), window.TKAServiceOrderTemplate.dateLabel(documentData.date)].filter(Boolean).join(", "), PAGE.left, y);
    y += 24;
    var signatureWidth = (PAGE.width - PAGE.left - PAGE.right - 22) / 2;
    drawSignature(doc, "ASSINATURA DO COLABORADOR", documentData.employeeName, normalized.signature.employeeDataUrl, PAGE.left, y, signatureWidth);
    drawSignature(doc, "ASSINATURA DO SUPERVISOR TKA", "GRUPO TKA", ownerSignatureDataUrl, PAGE.left + signatureWidth + 22, y, signatureWidth);

    doc.save(safeFileName("ordem-servico-" + documentData.employeeName) + ".pdf");
  }

  window.TKAServiceOrderPdf = {
    download: download
  };
})();
