(function () {
  var pdfAssets = { letterheadDataUrl: "" };
  var LETTERHEAD_IMAGE_PATH = "/recursos-humanos/admissao/assets/papel-timbrado-tka-seguranca-privada-page1.png";
  var blankSignatureDataUrl = "";

  function assetUrl(path) {
    return window.tkaResolveAssetUrl ? window.tkaResolveAssetUrl(path) : path;
  }

  function ensureAssets() {
    if (pdfAssets.letterheadDataUrl) return Promise.resolve(pdfAssets);
    return fetch(assetUrl(LETTERHEAD_IMAGE_PATH))
      .then(function (response) { return response.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            pdfAssets.letterheadDataUrl = reader.result;
            resolve(pdfAssets);
          };
          reader.readAsDataURL(blob);
        });
      });
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value + "T00:00:00");
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
  }

  function sanitizeFileName(value) {
    return String(value || "permuta").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
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

  function coreComplete(record) {
    return Boolean(
      record.placeName &&
      record.requestDate &&
      record.shiftDate &&
      record.shiftStart &&
      record.shiftEnd &&
      record.employeeAName &&
      record.employeeACpf &&
      record.employeeARg &&
      hasSignatureDataUrl(record.employeeASignatureDataUrl) &&
      record.employeeBName &&
      record.employeeBCpf &&
      record.employeeBRg &&
      hasSignatureDataUrl(record.employeeBSignatureDataUrl)
    );
  }

  function statusLabel(record) {
    if (record.status === "complete") return "Completa";
    if (record.status === "waiting_approval") return "Aguardando aprovacao";
    if (!coreComplete(record)) return "Incompleta";
    if (!record.supervisorName || !hasSignatureDataUrl(record.supervisorSignatureDataUrl)) return "Aguardando aprovacao";
    return "Completa";
  }

  function drawText(doc, label, value, y) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 42, 33);
    doc.text(label, 42, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(42, 31, 27);
    doc.text(String(value || "-"), 42, y + 14, { maxWidth: 510 });
  }

  function drawSignature(doc, label, signatureDataUrl, x, y) {
    doc.setDrawColor(210, 192, 186);
    doc.roundedRect(x, y, 160, 64, 8, 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 42, 33);
    doc.text(label, x + 10, y + 14);
    if (hasSignatureDataUrl(signatureDataUrl)) doc.addImage(signatureDataUrl, "PNG", x + 10, y + 18, 140, 38, undefined, "FAST");
  }

  function exportRecord(record) {
    return ensureAssets().then(function () {
      var doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
      if (pdfAssets.letterheadDataUrl) doc.addImage(pdfAssets.letterheadDataUrl, "PNG", 0, 0, 595.28, 841.89, undefined, "FAST");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(42, 31, 27);
      doc.text("Permuta de Plantao", 42, 120);
      doc.setFontSize(10);
      doc.setTextColor(139, 42, 33);
      doc.text("Situacao: " + statusLabel(record), 42, 138);
      drawText(doc, "Posto de servico", record.placeName, 156);
      drawText(doc, "Data da solicitacao", formatDate(record.requestDate), 194);
      drawText(doc, "Plantao original", [formatDate(record.shiftDate), record.shiftStart, record.shiftEnd].filter(Boolean).join(" | "), 232);
      drawText(doc, "Colaborador solicitante", [record.employeeAName, "CPF " + (record.employeeACpf || "-"), "RG " + (record.employeeARg || "-")].join(" | "), 280);
      drawText(doc, "Dia a trabalhar", formatDate(record.employeeADate1), 318);
      drawText(doc, "Colaborador que assume", [record.employeeBName, "CPF " + (record.employeeBCpf || "-"), "RG " + (record.employeeBRg || "-")].join(" | "), 366);
      drawText(doc, "Dia de Trabalho", formatDate(record.employeeBDate1), 404);
      drawText(doc, "Supervisor operacional", record.supervisorName, 452);
      drawText(doc, "Observacoes", record.notes || "Sem observacoes adicionais.", 490);
      drawSignature(doc, "Solicitante", record.employeeASignatureDataUrl, 42, 574);
      drawSignature(doc, "Quem assume", record.employeeBSignatureDataUrl, 216, 574);
      drawSignature(doc, "Supervisor", record.supervisorSignatureDataUrl, 390, 574);
      doc.save("permuta-" + sanitizeFileName(record.employeeAName || record.placeName || "interna") + ".pdf");
    });
  }

  window.PermutaPdf = { exportRecord: exportRecord };
})();
