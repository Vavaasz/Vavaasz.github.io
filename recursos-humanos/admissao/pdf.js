(function () {
  var PAGE = {
    width: 595.28,
    height: 841.89,
    top: 118,
    left: 42,
    right: 42,
    bottom: 700
  };

  var pdfAssets = {
    letterheadDataUrl: ""
  };
  var pdfAssetsPromise = null;
  var LETTERHEAD_PDF_SOURCE_PATH = "/recursos-humanos/admissao/assets/papel-timbrado-tka-seguranca-privada.pdf";
  var LETTERHEAD_IMAGE_PATH = "/recursos-humanos/admissao/assets/papel-timbrado-tka-seguranca-privada-page1.png";

  function assetUrl(path) {
    return window.tkaResolveAssetUrl ? window.tkaResolveAssetUrl(path) : path;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function sanitizeFilename(value) {
    return (value || "ficha-admissao")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function formatDate(value) {
    var raw = text(value);
    if (!raw) return "";
    var parsed = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString("pt-BR");
  }

  function yesNo(value) {
    if (value === true || value === "sim") return "Sim";
    if (value === false || value === "nao") return "Nao";
    return "";
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function loadAssetAsDataUrl(path) {
    return fetch(assetUrl(path))
      .then(function (response) {
        if (!response.ok) throw new Error("Falha ao carregar " + path);
        return response.blob();
      })
      .then(blobToDataUrl);
  }

  function ensurePdfAssets() {
    if (pdfAssets.letterheadDataUrl) return Promise.resolve(pdfAssets);
    if (!pdfAssetsPromise) {
      pdfAssetsPromise = Promise.allSettled([
        loadAssetAsDataUrl(LETTERHEAD_IMAGE_PATH)
      ]).then(function (results) {
        if (results[0].status === "fulfilled") {
          pdfAssets.letterheadDataUrl = results[0].value;
        } else {
          console.warn("Falha ao carregar a imagem derivada de " + LETTERHEAD_PDF_SOURCE_PATH, results[0].reason);
        }
        return pdfAssets;
      }).finally(function () {
        pdfAssetsPromise = null;
      });
    }
    return pdfAssetsPromise;
  }

  function routeText(route) {
    var parts = [];
    if (text(route && route.line)) parts.push("Linha: " + text(route.line));
    if (text(route && route.operator)) parts.push("Operadora: " + text(route.operator));
    if (text(route && route.fare)) parts.push("Tarifa: " + text(route.fare));
    return parts.join(" | ");
  }

  function drawFieldBox(doc, x, y, width, label, value) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 192, 186);
    doc.roundedRect(x, y, width, 42, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(139, 42, 33);
    doc.text(String(label).toUpperCase(), x + 10, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(47, 36, 31);
    doc.text(String(value || " ").slice(0, 90), x + 10, y + 27, { maxWidth: width - 20 });
  }

  function drawFieldGrid(doc, context, fields, columns) {
    var gap = 12;
    var boxWidth = (PAGE.width - PAGE.left - PAGE.right - gap * (columns - 1)) / columns;
    for (var index = 0; index < fields.length; index += columns) {
      var row = fields.slice(index, index + columns);
      context.ensureSpace(52);
      row.forEach(function (field, rowIndex) {
        drawFieldBox(doc, PAGE.left + rowIndex * (boxWidth + gap), context.cursorY, boxWidth, field.label, field.value);
      });
      context.cursorY += 52;
    }
    context.cursorY += 4;
  }

  function drawParagraph(doc, context, content, options) {
    options = options || {};
    var x = options.x || PAGE.left;
    var width = options.width || PAGE.width - PAGE.left - PAGE.right;
    var lineHeight = options.lineHeight || 13;
    var gapAfter = options.gapAfter == null ? 8 : options.gapAfter;
    var lines = doc.splitTextToSize(String(content || " "), width);

    doc.setFont("helvetica", options.fontStyle || "normal");
    doc.setFontSize(options.fontSize || 10);
    doc.setTextColor.apply(doc, options.color || [47, 36, 31]);

    while (lines.length) {
      var availableHeight = PAGE.bottom - context.cursorY;
      var maxLines = Math.max(1, Math.floor(availableHeight / lineHeight) - 1);
      var chunk = lines.splice(0, maxLines);
      doc.text(chunk, x, context.cursorY);
      context.cursorY += chunk.length * lineHeight + gapAfter;
      if (lines.length) {
        context.newPage(true);
      }
    }
  }

  function buildSections(state) {
    var personal = state.personal || {};
    var address = state.address || {};
    var documents = state.documents || {};
    var employment = state.employment || {};
    var declaration = state.declaration || {};
    var lgpd = state.lgpd || {};
    var transport = state.transport || {};
    var meta = state.meta || {};
    var finalSignature = state.finalSignature || {};
    var dependentRows = [];
    var homeRows = [];
    var workRows = [];

    (state.dependents || []).forEach(function (item, index) {
      if (!(window.TKAAdmissionRules && window.TKAAdmissionRules.hasAnyDependentData(item))) return;
      dependentRows.push({
        label: "Dependente " + (index + 1),
        value: [
          text(item.name),
          text(item.relationship) ? "Parentesco: " + text(item.relationship) : "",
          formatDate(item.birthDate) ? "Nascimento: " + formatDate(item.birthDate) : "",
          text(item.cpf) ? "CPF: " + text(item.cpf) : ""
        ].filter(Boolean).join(" | ")
      });
    });

    (state.routes && state.routes.homeToWork || []).forEach(function (item, index) {
      if (!text(routeText(item))) return;
      homeRows.push({ label: "Linha " + (index + 1), value: routeText(item) });
    });

    (state.routes && state.routes.workToHome || []).forEach(function (item, index) {
      if (!text(routeText(item))) return;
      workRows.push({ label: "Linha " + (index + 1), value: routeText(item) });
    });

    return [
      {
        title: "Resumo",
        fields: [
          { label: "Nome completo", value: personal.fullName },
          { label: "CPF", value: documents.cpf },
          { label: "Telefone", value: personal.phone },
          { label: "E-mail", value: personal.email },
          { label: "Status", value: meta.status || "em_preenchimento" },
          { label: "Enviado em", value: formatDate(meta.publicSubmittedAt) || "Nao enviado" }
        ]
      },
      {
        title: "Dados para admissao",
        fields: [
          { label: "Nome completo", value: personal.fullName },
          { label: "Nome social", value: personal.socialName },
          { label: "Telefone", value: personal.phone },
          { label: "E-mail", value: personal.email },
          { label: "Nome da mae", value: personal.motherName },
          { label: "Nome do pai", value: personal.fatherName },
          { label: "Data de nascimento", value: formatDate(personal.birthDate) },
          { label: "Cor / Raca", value: personal.raceColor },
          { label: "Local de nascimento", value: personal.birthPlace },
          { label: "UF nascimento", value: personal.birthState },
          { label: "Deficiente fisico", value: yesNo(personal.hasDisability) },
          { label: "Deficiencia informada", value: personal.disabilityDescription }
        ]
      },
      {
        title: "Endereco residencial",
        fields: [
          { label: "Endereco", value: address.street },
          { label: "Numero", value: address.number },
          { label: "UF", value: address.state },
          { label: "Complemento", value: address.complement },
          { label: "Tipo", value: address.residenceType },
          { label: "Bloco", value: address.block },
          { label: "Numero apartamento", value: address.apartmentNumber },
          { label: "Bairro", value: address.neighborhood },
          { label: "Cidade", value: address.city },
          { label: "CEP", value: address.cep }
        ]
      },
      {
        title: "Documentos e dados pessoais",
        fields: [
          { label: "Carteira de trabalho", value: documents.workCardNumber },
          { label: "Serie CTPS", value: documents.workCardSeries },
          { label: "Data emissao CTPS", value: formatDate(documents.workCardIssueDate) },
          { label: "UF CTPS", value: documents.workCardIssueState },
          { label: "RG", value: documents.rg },
          { label: "Orgao emissor RG", value: documents.rgIssuer },
          { label: "Data emissao RG", value: formatDate(documents.rgIssueDate) },
          { label: "CPF", value: documents.cpf },
          { label: "PIS / PASEP", value: documents.pisPasep },
          { label: "Titulo de eleitor", value: documents.voterTitle },
          { label: "Zona eleitoral", value: documents.voterZone },
          { label: "Sessao eleitoral", value: documents.voterSection },
          { label: "UF titulo", value: documents.voterState },
          { label: "Certificado reservista", value: documents.reservistCertificate },
          { label: "Serie reservista", value: documents.reservistSeries },
          { label: "Categoria reservista", value: documents.reservistCategory }
        ]
      },
      {
        title: "Dados complementares",
        fields: [
          { label: "Cargo", value: employment.role },
          { label: "Grau de escolaridade", value: employment.educationLevel },
          { label: "Estado civil", value: employment.maritalStatus },
          { label: "Primeiro emprego", value: yesNo(employment.firstJob) },
          { label: "Sapato / Bota", value: employment.shoeSize },
          { label: "Camisa", value: employment.shirtSize },
          { label: "Camiseta", value: employment.tshirtSize },
          { label: "Jaqueta", value: employment.jacketSize },
          { label: "Calca", value: employment.pantsSize },
          { label: "Chave Pix", value: employment.pixKey },
          { label: "Banco", value: employment.bank },
          { label: "Conjuge dependente IR", value: yesNo(employment.spouseTaxDependent) }
        ]
      },
      {
        title: "Dependentes",
        rows: dependentRows.length ? dependentRows : [{ label: "Dependentes", value: "Nao informado" }]
      },
      {
        title: "Declaracao e LGPD",
        fields: [
          { label: "Nome declaracao", value: declaration.name },
          { label: "Local declaracao", value: declaration.place },
          { label: "Data declaracao", value: formatDate(declaration.date) },
          { label: "Nome LGPD", value: lgpd.name },
          { label: "Local LGPD", value: lgpd.place },
          { label: "Data LGPD", value: formatDate(lgpd.date) },
          { label: "Concordancia LGPD", value: lgpd.agreement ? "Sim" : "Nao" }
        ],
        paragraph: declaration.notes ? "Observacao declaracao: " + declaration.notes : ""
      },
      {
        title: "Vale transporte",
        fields: [
          { label: "Opcao", value: transport.decision === "accept" ? "Aceito" : transport.decision === "decline" ? "Nao aceito" : "" },
          { label: "Rua", value: transport.accepted ? transport.street : "" },
          { label: "Numero", value: transport.accepted ? transport.number : "" },
          { label: "UF", value: transport.accepted ? transport.state : "" },
          { label: "Bairro", value: transport.accepted ? transport.neighborhood : "" },
          { label: "Cidade", value: transport.accepted ? transport.city : "" },
          { label: "CEP", value: transport.accepted ? transport.cep : "" },
          { label: "Nome declaracao VT", value: transport.accepted ? transport.name : "" },
          { label: "Local VT", value: transport.accepted ? transport.place : "" },
          { label: "Data VT", value: transport.accepted ? formatDate(transport.date) : "" }
        ]
      },
      {
        title: "Trajeto residencia - trabalho",
        rows: transport.accepted ? (homeRows.length ? homeRows : [{ label: "Trajeto", value: "Nao informado" }]) : [{ label: "Trajeto", value: "Nao informado porque o vale transporte nao foi aceito" }]
      },
      {
        title: "Trajeto trabalho - residencia",
        rows: transport.accepted ? (workRows.length ? workRows : [{ label: "Trajeto", value: "Nao informado" }]) : [{ label: "Trajeto", value: "Nao informado porque o vale transporte nao foi aceito" }]
      },
      {
        title: "Controle RH",
        fields: [
          { label: "Status", value: meta.status },
          { label: "Empresa", value: meta.company },
          { label: "Cargo", value: meta.role },
          { label: "Data admissao", value: formatDate(meta.admissionDate) },
          { label: "Observacoes RH", value: meta.rhNotes }
        ]
      },
      {
        title: "Assinatura final",
        fields: [
          { label: "Nome para assinatura", value: finalSignature.name },
          { label: "Local da assinatura", value: finalSignature.place },
          { label: "Data da assinatura", value: formatDate(finalSignature.date) }
        ],
        signatureDataUrl: finalSignature.signatureDataUrl
      }
    ];
  }

  function createContext(doc, assets, state) {
    var context = {
      cursorY: PAGE.top,
      activeSection: "",
      drawPageFrame: null,
      drawSectionTitle: null,
      ensureSpace: null,
      newPage: null
    };

    context.drawPageFrame = function () {
      if (assets.letterheadDataUrl) {
        doc.addImage(assets.letterheadDataUrl, "PNG", 0, 0, PAGE.width, PAGE.height);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(150, 29, 23);
      doc.text("Ficha de Admissao", PAGE.width - PAGE.right, 50, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(59, 49, 44);
      doc.text("Atualizado em " + new Date().toLocaleString("pt-BR"), PAGE.width - PAGE.right, 64, { align: "right" });
      if (text(state.personal && state.personal.fullName)) {
        doc.text(text(state.personal.fullName), PAGE.width - PAGE.right, 78, { align: "right" });
      }
      context.cursorY = PAGE.top;
    };

    context.ensureSpace = function (height) {
      if (context.cursorY + height <= PAGE.bottom) return;
      context.newPage(true);
    };

    context.drawSectionTitle = function (title, continuation) {
      context.ensureSpace(40);
      context.activeSection = title;
      doc.setFillColor(179, 37, 31);
      doc.roundedRect(PAGE.left, context.cursorY, PAGE.width - PAGE.left - PAGE.right, 24, 7, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(continuation ? title + " (continuacao)" : title, PAGE.left + 12, context.cursorY + 16);
      context.cursorY += 34;
    };

    context.newPage = function (repeatSection) {
      doc.addPage();
      context.drawPageFrame();
      if (repeatSection && context.activeSection) {
        context.drawSectionTitle(context.activeSection, true);
      }
    };

    return context;
  }

  async function download(state) {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        window.alert("Biblioteca de PDF indisponivel.");
        return;
      }

      var assets = await ensurePdfAssets();
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: "pt", format: "a4" });
      var context = createContext(doc, assets, state);

      context.drawPageFrame();

      buildSections(state).forEach(function (section) {
        context.drawSectionTitle(section.title, false);
        if (section.fields && section.fields.length) {
          drawFieldGrid(doc, context, section.fields, 2);
        }
        if (section.rows && section.rows.length) {
          section.rows.forEach(function (row) {
            drawParagraph(doc, context, row.label + ": " + (row.value || "-"), { gapAfter: 6 });
          });
        }
        if (section.paragraph) {
          drawParagraph(doc, context, section.paragraph);
        }
        if (section.signatureDataUrl) {
          context.ensureSpace(120);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(210, 192, 186);
          doc.roundedRect(PAGE.left, context.cursorY, PAGE.width - PAGE.left - PAGE.right, 90, 8, 8, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(139, 42, 33);
          doc.text("ASSINATURA DO COLABORADOR", PAGE.left + 10, context.cursorY + 12);
          if (text(section.signatureDataUrl)) {
            doc.addImage(section.signatureDataUrl, "PNG", PAGE.left + 16, context.cursorY + 22, PAGE.width - PAGE.left - PAGE.right - 32, 48);
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(107, 89, 82);
          doc.text("Assinatura final", PAGE.width / 2, context.cursorY + 78, { align: "center" });
          context.cursorY += 102;
        }
      });

      doc.save(sanitizeFilename((state.personal && state.personal.fullName) || "ficha-admissao") + ".pdf");
    } catch (error) {
      console.error(error);
      window.alert("Nao foi possivel gerar o PDF agora.");
      throw error;
    }
  }

  window.TKAAdmissionPdf = {
    download: download
  };
})();
