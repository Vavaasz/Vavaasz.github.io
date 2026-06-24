(function () {
  var template = window.TKABodyCamTemplate;
  var PAGE = { width: 595.28, height: 841.89, left: 36, right: 36, top: 34, bottom: 34 };
  var RED = [153, 43, 31];
  var DARK = [39, 27, 22];
  var MUTED = [98, 79, 69];
  var LINE = [226, 214, 207];

  function safeFileName(value) {
    return template.cleanIdPart(value || "termo-body-cam") || "termo-body-cam";
  }

  function text(value) {
    return template.text(value);
  }

  function setColor(doc, color) {
    doc.setTextColor(color[0], color[1], color[2]);
  }

  function drawWrapped(doc, value, x, y, width, options) {
    options = options || {};
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size || 8.5);
    setColor(doc, options.color || DARK);
    var lines = doc.splitTextToSize(text(value), width);
    lines.forEach(function (line) {
      doc.text(line, x, y);
      y += options.lineHeight || 9.5;
    });
    return y;
  }

  function drawHeader(doc, term) {
    doc.setFillColor(153, 43, 31);
    doc.rect(0, 0, PAGE.width, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setColor(doc, DARK);
    doc.text("GRUPO TKA", PAGE.left, 29);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(doc, MUTED);
    doc.text("Versao " + text(term.termVersion), PAGE.width - PAGE.right, 29, { align: "right" });
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(PAGE.left, 38, PAGE.width - PAGE.right, 38);
  }

  function drawMetaBox(doc, label, value, x, y, width, height) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setFillColor(255, 252, 247);
    doc.roundedRect(x, y, width, height || 34, 5, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    setColor(doc, RED);
    doc.text(label, x + 7, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, DARK);
    doc.text(text(value || "-"), x + 7, y + 23, { maxWidth: width - 14 });
  }

  function drawEquipmentTable(doc, term, y) {
    var rows = template.equipmentSummary(term);
    var colWidth = (PAGE.width - PAGE.left - PAGE.right) / 4;
    rows.forEach(function (row, index) {
      var x = PAGE.left + (index % 4) * colWidth;
      var rowY = y + Math.floor(index / 4) * 34;
      drawMetaBox(doc, row[0].toUpperCase(), row[1], x, rowY, colWidth - 5, 30);
    });
    return y + 72;
  }

  function drawSignatureImageBox(doc, title, signerName, signatureData, placeholder, x, y, width) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(x, y, width, 78, 6, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(doc, RED);
    doc.text(title, x + 8, y + 12);
    if (signatureData) {
      try {
        doc.addImage(signatureData, "PNG", x + 18, y + 18, width - 36, 34, undefined, "FAST");
      } catch (error) {
        console.warn("Falha ao inserir assinatura no PDF.", error);
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setColor(doc, MUTED);
      doc.text(placeholder || "Assinatura pendente", x + width / 2, y + 37, { align: "center", maxWidth: width - 28 });
    }
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(x + 18, y + 57, x + width - 18, y + 57);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setColor(doc, MUTED);
    doc.text(signerName || "-", x + width / 2, y + 70, { align: "center", maxWidth: width - 24 });
  }

  function drawInfoBox(doc, label, value, x, y, width) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(x, y, width, 34, 5, 5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    setColor(doc, RED);
    doc.text(label, x + 7, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, DARK);
    doc.text(text(value || "-"), x + 7, y + 23, { maxWidth: width - 14 });
  }

  function download(term) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF indisponivel.");
    var data = template.normalizeTerm(term || {});
    var doc = new jsPDF({ unit: "pt", format: "a4" });
    var y = 58;

    drawHeader(doc, data);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(doc, RED);
    doc.text(template.TERM_TITLE, PAGE.width / 2, y, { align: "center", maxWidth: PAGE.width - PAGE.left - PAGE.right });
    y += 18;

    drawMetaBox(doc, "COLABORADOR", data.employeeName, PAGE.left, y, 194, 34);
    drawMetaBox(doc, "DOCUMENTO / MATRICULA", data.employeeDocument || data.employeeInternalId, PAGE.left + 204, y, 148, 34);
    drawMetaBox(doc, "CARGO / DEPARTAMENTO", [data.employeeRole, data.employeeDepartment].filter(Boolean).join(" | "), PAGE.left + 362, y, 161, 34);
    y += 42;
    drawMetaBox(doc, "EMPRESA", data.companyName, PAGE.left, y, 154, 34);
    drawMetaBox(doc, "POSTO DE USO", data.employeeUsagePost, PAGE.left + 164, y, 174, 34);
    drawMetaBox(doc, "TURNO DE TRABALHO", data.employeeWorkShift, PAGE.left + 348, y, 175, 34);
    y += 42;
    drawMetaBox(doc, "DATA DE ENTREGA", template.dateLabel(data.deliveryDate), PAGE.left, y, 130, 34);
    drawMetaBox(doc, "RESPONSAVEL PELA ENTREGA", data.responsibleForDeliveryName, PAGE.left + 140, y, 383, 34);
    y += 42;
    drawMetaBox(doc, "CIDADE DA ASSINATURA", data.signatureCity, PAGE.left, y, 164, 30);
    drawMetaBox(doc, "DATA / HORA DA ASSINATURA", template.dateTimeLabel(data.signatureDateTime || data.signedAt), PAGE.left + 174, y, 164, 30);
    drawMetaBox(doc, "MANUAL", template.MANUAL_LABEL, PAGE.left + 348, y, 175, 30);
    y += 38;

    y = drawEquipmentTable(doc, data, y);
    y = drawWrapped(doc, "Pelo presente termo, o colaborador declara ciencia e concordancia com as obrigacoes abaixo, relativas a guarda operacional, confidencialidade, uso correto e reporte imediato de ocorrencias envolvendo a Body Cam.", PAGE.left, y, PAGE.width - PAGE.left - PAGE.right, { size: 8.3, lineHeight: 9.2 });
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.7);
    setColor(doc, DARK);
    template.CLAUSES.forEach(function (clause, index) {
      var label = (index + 1) + ". ";
      var lines = doc.splitTextToSize(label + clause, PAGE.width - PAGE.left - PAGE.right);
      lines.forEach(function (line) {
        doc.text(line, PAGE.left, y);
        y += 8.6;
      });
      y += 1.8;
    });

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    setColor(doc, RED);
    doc.text((data.acknowledgements.equipmentReceived ? "[x]" : "[ ]") + " Confirmo que recebi o equipamento e acessorios listados.", PAGE.left, y);
    y += 11;
    doc.text((data.acknowledgements.policyRead ? "[x]" : "[ ]") + " Confirmo que li o manual de uso e entendi minhas obrigacoes.", PAGE.left, y);
    y += 18;

    var signatureGap = 14;
    var signatureWidth = (PAGE.width - PAGE.left - PAGE.right - signatureGap) / 2;
    drawSignatureImageBox(doc, "ASSINATURA DO COLABORADOR", data.employeeName || "Colaborador", data.signatureData, "Assinatura do colaborador", PAGE.left, y, signatureWidth);
    drawSignatureImageBox(doc, "ASSINATURA DA EMPRESA", data.companySignerName || template.DEFAULT_COMPANY_SIGNER_NAME, data.companySignatureDataUrl, "Assinatura da empresa", PAGE.left + signatureWidth + signatureGap, y, signatureWidth);
    y += 86;
    drawInfoBox(doc, "ASSINADO EM", template.dateTimeLabel(data.signatureDateTime || data.signedAt) || "Pendente", PAGE.left, y, signatureWidth);
    drawInfoBox(doc, "RESPONSAVEL PELA ENTREGA", data.responsibleForDeliveryName, PAGE.left + signatureWidth + signatureGap, y, signatureWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setColor(doc, MUTED);
    doc.text("Tipo: " + template.TERM_TYPE + " | Versao: " + data.termVersion + " | Manual: " + template.MANUAL_LABEL, PAGE.left, PAGE.height - 22, { maxWidth: PAGE.width - PAGE.left - PAGE.right });

    doc.save(safeFileName("termo-body-cam-" + (data.employeeName || data.assetTag || data.id)) + ".pdf");
  }

  window.TKABodyCamPdf = {
    download: download
  };
})();
