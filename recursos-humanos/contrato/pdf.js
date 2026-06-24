(function () {
  var imageCache = {};

  function assetUrl(path) {
    return window.tkaResolveAssetUrl ? window.tkaResolveAssetUrl(path) : path;
  }

  function loadImageDataUrl(path) {
    var key = assetUrl(path);
    if (imageCache[key]) return imageCache[key];
    imageCache[key] = fetch(key)
      .then(function (response) {
        if (!response.ok) throw new Error("Falha ao carregar " + path);
        return response.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
    return imageCache[key];
  }

  function text(value) {
    return String(value || "").trim();
  }

  function sanitizeFilename(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "contrato-rh";
  }

  function drawOverlay(doc, item) {
    if (item.type === "signature") {
      doc.addImage(item.dataUrl, "PNG", item.x, item.y, item.width, item.height, undefined, "FAST");
      return;
    }
    if (item.type !== "text" || !text(item.text)) return;
    doc.setFont("helvetica", item.weight >= 700 ? "bold" : "normal");
    doc.setFontSize(item.fontSize || 11);
    doc.setTextColor(25, 25, 25);
    if (item.align === "center") {
      doc.text(String(item.text), item.x + (item.width || 0) / 2, item.y, { align: "center", maxWidth: item.width || 200 });
      return;
    }
    doc.text(String(item.text), item.x, item.y, { maxWidth: item.width || 220 });
  }

  async function download(sample, state, ownerSignatureDataUrl) {
    if (!window.TKAContractTemplate || !sample) {
      window.alert("Contrato indisponivel no momento.");
      return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      window.alert("Biblioteca de PDF indisponivel.");
      return;
    }

    var previewPages = window.TKAContractTemplate.buildPreviewPages(sample, state, ownerSignatureDataUrl);
    var imageDataUrls = await Promise.all(previewPages.map(function (page) {
      return loadImageDataUrl(page.url);
    }));

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({
      unit: "pt",
      format: [window.TKAContractTemplate.PAGE_WIDTH, window.TKAContractTemplate.PAGE_HEIGHT]
    });

    previewPages.forEach(function (page, index) {
      if (index > 0) doc.addPage([window.TKAContractTemplate.PAGE_WIDTH, window.TKAContractTemplate.PAGE_HEIGHT], "portrait");
      doc.addImage(imageDataUrls[index], "PNG", 0, 0, window.TKAContractTemplate.PAGE_WIDTH, window.TKAContractTemplate.PAGE_HEIGHT, undefined, "FAST");
      page.overlays.forEach(function (item) {
        drawOverlay(doc, item);
      });
    });

    doc.save(sanitizeFilename("contrato-rh-" + sample.employeeName) + ".pdf");
  }

  window.TKAContractPdf = {
    download: download
  };
})();
