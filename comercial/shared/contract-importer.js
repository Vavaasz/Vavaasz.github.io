(function () {
  var PDF_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDF_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var KNOWN_TKA_CNPJS = new Set([
    "47.711.058/0001-07",
    "43.068.242/0001-20"
  ]);
  var KNOWN_TKA_CPFS = new Set([
    "286.800.648-58"
  ]);
  var OWNER_NAMES = [
    "tka seguranca privada",
    "tka zeladoria",
    "grupo tka",
    "katio augusto"
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function text(value) {
    return String(value || "").trim();
  }

  function normalizeSpaces(value) {
    return text(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeForSearch(value) {
    return normalizeSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function decodeEntities(value) {
    var map = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'"
    };
    return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (_, entity) {
      var key = entity.toLowerCase();
      if (map[key]) return map[key];
      if (key.charAt(0) === "#") {
        var radix = key.charAt(1) === "x" ? 16 : 10;
        var offset = radix === 16 ? 2 : 1;
        var code = Number.parseInt(key.slice(offset), radix);
        return Number.isFinite(code) ? String.fromCharCode(code) : _;
      }
      return _;
    });
  }

  function unique(values) {
    var seen = new Set();
    return values.filter(function (value) {
      var key = normalizeForSearch(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function deepMerge(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      var sourceValue = source[key];
      if (sourceValue == null || sourceValue === "") return;
      if (key === "signatureDataUrl") return;
      if (Array.isArray(sourceValue)) {
        if (sourceValue.length) target[key] = clone(sourceValue);
        return;
      }
      if (typeof sourceValue === "object") {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
        deepMerge(target[key], sourceValue);
        return;
      }
      target[key] = sourceValue;
    });
    return target;
  }

  function addField(fields, name, value) {
    if (text(value)) fields.add(name);
  }

  function scriptLoad(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        if (window.pdfjsLib) resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Falha ao carregar leitor de PDF."));
      };
      document.head.appendChild(script);
    });
  }

  async function ensurePdfJs() {
    if (!window.pdfjsLib) {
      await scriptLoad(PDF_JS_URL);
    }
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
    }
    if (!window.pdfjsLib) throw new Error("Leitor de PDF indisponivel.");
    return window.pdfjsLib;
  }

  async function readPdfText(file) {
    var pdfjsLib = await ensurePdfJs();
    var buffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    var pages = [];
    for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      var page = await pdf.getPage(pageNumber);
      var content = await page.getTextContent();
      var pieces = [];
      content.items.forEach(function (item) {
        if (item && item.str) pieces.push(item.str);
        pieces.push(item && item.hasEOL ? "\n" : " ");
      });
      pages.push(pieces.join(""));
    }
    return normalizeSpaces(pages.join("\n\n"));
  }

  function readUint16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readUint32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function findEndOfCentralDirectory(bytes) {
    var start = Math.max(0, bytes.length - 65557);
    for (var index = bytes.length - 22; index >= start; index -= 1) {
      if (readUint32(bytes, index) === 0x06054b50) return index;
    }
    return -1;
  }

  function findZipEntry(bytes, entryName) {
    var eocd = findEndOfCentralDirectory(bytes);
    if (eocd < 0) return null;
    var centralSize = readUint32(bytes, eocd + 12);
    var centralOffset = readUint32(bytes, eocd + 16);
    var pointer = centralOffset;
    var end = centralOffset + centralSize;
    var decoder = new TextDecoder("utf-8");
    while (pointer < end && readUint32(bytes, pointer) === 0x02014b50) {
      var compression = readUint16(bytes, pointer + 10);
      var compressedSize = readUint32(bytes, pointer + 20);
      var nameLength = readUint16(bytes, pointer + 28);
      var extraLength = readUint16(bytes, pointer + 30);
      var commentLength = readUint16(bytes, pointer + 32);
      var localOffset = readUint32(bytes, pointer + 42);
      var name = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
      if (name === entryName) {
        return {
          compression: compression,
          compressedSize: compressedSize,
          localOffset: localOffset
        };
      }
      pointer += 46 + nameLength + extraLength + commentLength;
    }
    return null;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Este navegador nao descompacta DOCX localmente.");
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipEntry(bytes, entryName) {
    var entry = findZipEntry(bytes, entryName);
    if (!entry) return "";
    var pointer = entry.localOffset;
    if (readUint32(bytes, pointer) !== 0x04034b50) return "";
    var nameLength = readUint16(bytes, pointer + 26);
    var extraLength = readUint16(bytes, pointer + 28);
    var start = pointer + 30 + nameLength + extraLength;
    var compressed = bytes.slice(start, start + entry.compressedSize);
    if (entry.compression === 0) return new TextDecoder("utf-8").decode(compressed);
    if (entry.compression === 8) {
      var inflated = await inflateRaw(compressed);
      return new TextDecoder("utf-8").decode(inflated);
    }
    throw new Error("Metodo de compressao DOCX nao suportado.");
  }

  function wordXmlToText(xml) {
    return normalizeSpaces(decodeEntities(String(xml || "")
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<[^>]+>/g, " ")));
  }

  async function readDocxText(file) {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var documentXml = await readZipEntry(bytes, "word/document.xml");
    if (!documentXml) throw new Error("Texto principal do DOCX nao encontrado.");
    return wordXmlToText(documentXml);
  }

  async function extractTextFromFile(file) {
    var name = String(file && file.name || "").toLowerCase();
    var type = String(file && file.type || "").toLowerCase();
    var warnings = [];
    var extracted = "";

    try {
      if (type === "application/pdf" || name.endsWith(".pdf")) {
        extracted = await readPdfText(file);
      } else if (name.endsWith(".docx") || type.indexOf("wordprocessingml") >= 0) {
        extracted = await readDocxText(file);
      } else if (name.endsWith(".doc")) {
        warnings.push("Arquivo .doc antigo nao tem leitura local confiavel; salve como PDF ou DOCX para extrair melhor.");
      } else {
        extracted = normalizeSpaces(await file.text());
      }
    } catch (error) {
      console.warn("Falha ao ler arquivo importado.", error);
      warnings.push("Nao foi possivel ler todo o texto do arquivo; o rascunho foi criado para ajuste manual.");
    }

    if (!text(extracted)) {
      warnings.push("Nenhum texto util foi reconhecido no arquivo enviado.");
    }

    return {
      text: extracted,
      warnings: unique(warnings)
    };
  }

  function findDocuments(source, regex, excluded) {
    var matches = Array.from(source.matchAll(regex)).map(function (match) { return match[0]; });
    return unique(matches).filter(function (value) {
      return !(excluded && excluded.has(value));
    });
  }

  function firstMatch(source, patterns) {
    for (var index = 0; index < patterns.length; index += 1) {
      var match = patterns[index].exec(source);
      if (match) {
        for (var group = match.length - 1; group >= 1; group -= 1) {
          if (text(match[group])) return cleanValue(match[group]);
        }
      }
    }
    return "";
  }

  function cleanValue(value) {
    return normalizeSpaces(String(value || "")
      .replace(/^[\s:;,-]+/, "")
      .replace(/[\s:;,-]+$/, "")
      .replace(/\s+(?:inscrit[ao]?|portador[ao]?|sediad[ao]?|representad[ao]?).*$/i, ""));
  }

  function validBusinessLine(line) {
    var normalized = normalizeForSearch(line);
    if (!normalized || normalized.length < 4) return false;
    if (OWNER_NAMES.some(function (name) { return normalized.indexOf(name) >= 0; })) return false;
    if (/^(cnpj|cpf|rg|cep|telefone|e-mail|email|endereco|cidade|estado)\b/.test(normalized)) return false;
    return true;
  }

  function findLineBeforeDocument(lines, documentValue) {
    var documentIndex = lines.findIndex(function (line) {
      return line.indexOf(documentValue) >= 0;
    });
    if (documentIndex <= 0) return "";
    for (var index = documentIndex - 1; index >= Math.max(0, documentIndex - 4); index -= 1) {
      if (validBusinessLine(lines[index])) return cleanValue(lines[index]);
    }
    return "";
  }

  function extractName(compact, lines, documentValue, variant) {
    var labelled = firstMatch(compact, [
      /(?:contratante|cliente|tomador[ao]?|empresa)\s*[:\-]?\s*([^,\n.]{4,140}?)(?=\s+(?:inscrit|cnpj|cpf|com sede|sediad|representad)|[,.\n])/i,
      /(?:contratad[ao]|empregad[ao]|colaborador[ao])\s*[:\-]?\s*([^,\n.]{4,140}?)(?=\s+(?:inscrit|cnpj|cpf|rg|portador|resident)|[,.\n])/i,
      /(?:razao social|nome empresarial|nome completo)\s*[:\-]?\s*([^,\n.]{4,140})/i
    ]);
    if (labelled) return labelled;
    if (documentValue) return findLineBeforeDocument(lines, documentValue);
    if (variant === "intermittent") {
      return firstMatch(compact, [
        /(?:vigilante|empregado)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{8,120})/i
      ]);
    }
    return "";
  }

  function parseIsoDate(value) {
    var raw = text(value);
    var match = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    if (match) {
      var year = match[3].length === 2 ? "20" + match[3] : match[3];
      return year.padStart(4, "0") + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
    }
    match = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    return match ? match[0] : "";
  }

  function extractDate(compact, labels) {
    for (var index = 0; index < labels.length; index += 1) {
      var label = labels[index];
      var regex = new RegExp(label + "[^0-9]{0,40}(\\d{1,2}[\\/. -]\\d{1,2}[\\/. -]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})", "i");
      var match = regex.exec(compact);
      if (match) return parseIsoDate(match[1]);
    }
    return "";
  }

  function extractDuration(compact, variant) {
    if (variant === "intermittent" && /indeterminado/i.test(compact)) return "Indeterminado";
    var match = compact.match(/\b(\d{1,3})\s*(?:mes|meses|m[eê]s)/i);
    return match ? match[1] : "";
  }

  function extractMoneyNear(compact, labels) {
    var money = "(R\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*,\\d{2}|(R\\$\\s*)?\\d+,\\d{2}|\\d+%";
    for (var index = 0; index < labels.length; index += 1) {
      var regex = new RegExp(labels[index] + ".{0,120}?(" + money + ")", "i");
      var match = regex.exec(compact);
      if (match) return cleanValue(match[1]);
    }
    return "";
  }

  function extractPaymentMethod(normalized) {
    var methods = [];
    if (normalized.indexOf("boleto") >= 0) methods.push("Boletos bancarios");
    if (normalized.indexOf("pix") >= 0) methods.push("Pix");
    if (normalized.indexOf("transferencia") >= 0) methods.push("transferencia bancaria");
    if (normalized.indexOf("especie") >= 0 || normalized.indexOf("dinheiro") >= 0) methods.push("especie");
    return unique(methods).join(", ");
  }

  function splitAddress(value) {
    var cleaned = cleanValue(value)
      .replace(/^(?:endere[cç]o|sede|situad[ao]?|residente|domiciliad[ao]?)\s*[:\-]?\s*/i, "");
    var cepMatch = cleaned.match(/\b\d{5}-?\d{3}\b/);
    var numberMatch = cleaned.match(/,\s*(\d+[A-Za-z0-9\-\/]*)\b/);
    return {
      address: numberMatch ? cleanValue(cleaned.slice(0, numberMatch.index)) : cleaned,
      number: numberMatch ? numberMatch[1] : "",
      cep: cepMatch ? cepMatch[0] : ""
    };
  }

  function collectAddressLines(lines) {
    return unique(lines.filter(function (line) {
      var normalized = normalizeForSearch(line);
      if (OWNER_NAMES.some(function (name) { return normalized.indexOf(name) >= 0; })) return false;
      return /\b(rua|avenida|av\.|alameda|rodovia|estrada|travessa|praca|r\.)\b/.test(normalized);
    }).map(cleanValue));
  }

  function extractCityState(compact) {
    var match = compact.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40})\s*[-\/]\s*([A-Z]{2})\b/);
    if (match) return { city: cleanValue(match[1]), state: match[2] };
    match = compact.match(/cidade\s*[:\-]?\s*([A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40}).{0,24}(?:estado|uf)\s*[:\-]?\s*([A-Z]{2})/i);
    if (match) return { city: cleanValue(match[1]), state: match[2] };
    return { city: "", state: "" };
  }

  function extractRepresentative(compact) {
    return firstMatch(compact, [
      /representad[ao]?\s+(?:por|pela|pelo)\s+([^,\n.]{4,100})/i,
      /representante\s*(?:legal)?\s*[:\-]?\s*([^,\n.]{4,100})/i,
      /assinante\s*[:\-]?\s*([^,\n.]{4,100})/i
    ]);
  }

  function extractRole(compact, variant) {
    if (variant === "intermittent") return firstMatch(compact, [
      /\b(fun[cç][aã]o|cargo)\s*[:\-]?\s*([^,\n.]{3,80})/i
    ]).replace(/^fun[cç][aã]o|^cargo/i, "") || "Vigilante";
    return firstMatch(compact, [
      /(?:cargo|qualidade)\s*[:\-]?\s*([^,\n.]{3,80})/i,
      /representad[ao]?.{0,80}?,\s*([^,\n.]{3,60})\s*,\s*(?:portador|inscrit|cpf|rg)/i
    ]);
  }

  function extractServiceName(compact, lines, variant) {
    var labelled = firstMatch(compact, [
      /(?:local monitorado|local da presta[cç][aã]o|posto|evento|condom[ií]nio|cliente atendido)\s*[:\-]?\s*([^,\n.]{4,120})/i,
      /(?:servi[cç]os?\s+em|presta[cç][aã]o\s+em)\s*([^,\n.]{4,120})/i
    ]);
    if (labelled) return labelled;
    var serviceLine = lines.find(function (line) {
      var normalized = normalizeForSearch(line);
      return normalized.indexOf("condominio") >= 0 || normalized.indexOf("evento") >= 0 || normalized.indexOf("posto") >= 0;
    });
    if (serviceLine) return cleanValue(serviceLine);
    if (variant === "intermittent") return "Eventos TKA";
    return "";
  }

  function extractEquipment(lines, variant) {
    var keywords = /(camera|c[aâ]mera|sensor|central|alarme|dvr|nvr|monitoramento|vigia|vigilante|porteiro|portaria|zelador|zeladoria|controlador|recepcionista|servi[cç]o|posto)/i;
    var items = [];
    lines.forEach(function (line) {
      if (items.length >= 12) return;
      var cleaned = cleanValue(line);
      if (!cleaned || cleaned.length > 180 || !keywords.test(cleaned)) return;
      var quantityMatch = cleaned.match(/\b(\d{1,3})\s*(?:x|un|und|unid|unidade|qtd|qtde)?\b/i);
      var moneyMatch = cleaned.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}/i);
      items.push({
        id: "equipment-imported-" + (items.length + 1),
        quantity: quantityMatch ? quantityMatch[1].padStart(2, "0") : (variant === "intermittent" ? "01" : ""),
        description: cleaned.replace(/^\d{1,3}\s*(?:x|un|und|unid|unidade|qtd|qtde)?\s*/i, ""),
        location: "",
        value: moneyMatch ? moneyMatch[0] : ""
      });
    });
    return items;
  }

  function parseContractText(rawText, variant) {
    var compact = normalizeSpaces(rawText).replace(/\n/g, " ");
    var normalized = normalizeForSearch(compact);
    var lines = normalizeSpaces(rawText).split(/\n+/).map(cleanValue).filter(Boolean);
    var fields = new Set();

    var cnpjs = findDocuments(compact, /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, KNOWN_TKA_CNPJS);
    var cpfs = findDocuments(compact, /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, KNOWN_TKA_CPFS);
    var emails = findDocuments(compact, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    var phones = findDocuments(compact, /(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/g);
    var ceps = findDocuments(compact, /\b\d{5}-?\d{3}\b/g);
    var addresses = collectAddressLines(lines);
    var cityState = extractCityState(compact);
    var mainDocument = variant === "intermittent" ? (cpfs[0] || cnpjs[0] || "") : (cnpjs[0] || cpfs[0] || "");
    var legalName = extractName(compact, lines, mainDocument, variant);
    var representativeName = extractRepresentative(compact);
    var role = extractRole(compact, variant);
    var contractorAddress = splitAddress(addresses[0] || "");
    var serviceAddress = splitAddress(addresses[1] || "");
    var equipment = extractEquipment(lines, variant);
    var serviceName = extractServiceName(compact, lines, variant);
    var issueDate = extractDate(compact, ["emiss[aã]o", "assinado em", "data"]);
    var startDate = extractDate(compact, ["in[ií]cio da vig[eê]ncia", "inicio da vigencia", "vig[eê]ncia inicial", "in[ií]cio"]);
    var endDate = extractDate(compact, ["fim da vig[eê]ncia", "termino da vigencia", "t[eé]rmino", "encerramento"]);
    var signDate = extractDate(compact, ["assinatura", "assinado em"]) || issueDate;
    var durationMonths = extractDuration(compact, variant);
    var monitoringMonthly = extractMoneyNear(compact, [
      "mensalidade",
      "valor mensal",
      "pre[cç]o mensal",
      "monitoramento preventivo",
      "di[aá]ria",
      "sal[aá]rio",
      "valor do posto",
      "valor"
    ]);
    var equipmentRentalMonthly = extractMoneyNear(compact, [
      "loca[cç][aã]o",
      "aluguel",
      "hora extra",
      "gratifica[cç][aã]o",
      "dsr",
      "adicional"
    ]);
    var installationTotal = extractMoneyNear(compact, [
      "instala[cç][aã]o",
      "implanta[cç][aã]o",
      "mobiliza[cç][aã]o"
    ]);
    var dueMatch = compact.match(/(?:vencimento|dia de pagamento|pagamento).{0,50}?\b(\d{1,2}|[0-9]+\s*dias?\s*(?:uteis|corridos)?)/i);
    var paymentMethod = extractPaymentMethod(normalized);

    var patch = {
      contract: {
        issueDate: issueDate,
        startDate: startDate,
        endDate: endDate,
        durationMonths: durationMonths
      },
      contractor: {
        companyName: legalName,
        legalName: legalName,
        cnpj: mainDocument,
        phone: phones[0] || "",
        email1: emails[0] || "",
        email2: emails[1] || "",
        address: contractorAddress.address,
        number: contractorAddress.number,
        cep: contractorAddress.cep || ceps[0] || "",
        city: cityState.city,
        state: cityState.state,
        representativeName: representativeName,
        representativeRole: role,
        representativeCpf: cpfs[0] || ""
      },
      service: {
        monitoredLocationName: serviceName,
        monitoredAddress: serviceAddress.address,
        monitoredNumber: serviceAddress.number,
        monitoredCep: serviceAddress.cep || ceps[1] || "",
        monitoredCity: cityState.city,
        monitoredState: cityState.state
      },
      pricing: {
        monitoringMonthly: monitoringMonthly,
        equipmentRentalMonthly: equipmentRentalMonthly,
        installationTotal: installationTotal,
        dueDay: dueMatch ? cleanValue(dueMatch[1]) : "",
        paymentMethod: paymentMethod
      },
      sign: {
        city: cityState.city,
        date: signDate,
        signerName: representativeName || (variant === "intermittent" ? legalName : ""),
        cpf: variant === "intermittent" ? (cpfs[0] || "") : ""
      }
    };

    if (equipment.length) patch.equipment = equipment;
    if (variant === "intermittent" && cpfs[0]) patch.contractor.cnpj = cpfs[0];
    if (variant === "intermittent" && !patch.service.monitoredLocationName) patch.service.monitoredLocationName = "Eventos TKA";

    [
      ["contract.issueDate", issueDate],
      ["contract.startDate", startDate],
      ["contract.endDate", endDate],
      ["contract.durationMonths", durationMonths],
      ["contractor.legalName", legalName],
      ["contractor.cnpj", mainDocument],
      ["contractor.phone", phones[0]],
      ["contractor.email1", emails[0]],
      ["contractor.address", contractorAddress.address],
      ["contractor.cep", contractorAddress.cep || ceps[0]],
      ["contractor.representativeName", representativeName],
      ["service.monitoredLocationName", serviceName],
      ["service.monitoredAddress", serviceAddress.address],
      ["pricing.monitoringMonthly", monitoringMonthly],
      ["pricing.equipmentRentalMonthly", equipmentRentalMonthly],
      ["pricing.installationTotal", installationTotal],
      ["pricing.dueDay", dueMatch && dueMatch[1]],
      ["pricing.paymentMethod", paymentMethod],
      ["equipment", equipment.length ? "ok" : ""],
      ["sign.signerName", patch.sign.signerName],
      ["sign.date", signDate]
    ].forEach(function (entry) {
      addField(fields, entry[0], entry[1]);
    });

    return {
      patch: patch,
      fields: Array.from(fields)
    };
  }

  function getByPath(source, path) {
    return path.split(".").reduce(function (value, key) {
      return value == null ? "" : value[key];
    }, source);
  }

  function missingWarnings(data, variant) {
    var label = variant === "intermittent" ? "contratado" : "contratante";
    var documentLabel = variant === "intermittent" ? "CPF do contratado" : "CNPJ do contratante";
    var required = [
      ["contractor.legalName", "Nome do " + label],
      ["contractor.cnpj", documentLabel],
      ["pricing.monitoringMonthly", variant === "intermittent" ? "Valor da diaria/salario" : "Valor mensal"]
    ];
    if (variant !== "intermittent") {
      required.push(["service.monitoredLocationName", "Local ou servico contratado"]);
    }
    return required.filter(function (entry) {
      return !text(getByPath(data, entry[0]));
    }).map(function (entry) {
      return "Conferir " + entry[1] + ": nao localizado no arquivo.";
    });
  }

  async function buildContractDataFromUpload(options) {
    var file = options.file;
    var variant = options.variant || "monitoring";
    var baseData = clone(options.baseData);
    var importedAt = options.importedAt || new Date().toISOString();
    var extracted = await extractTextFromFile(file);
    var parsed = parseContractText(extracted.text, variant);
    var data = deepMerge(baseData, parsed.patch);
    var warnings = unique([].concat(extracted.warnings, missingWarnings(data, variant)));

    data.meta = Object.assign({}, data.meta || {}, {
      contractId: options.contractId || (data.meta && data.meta.contractId) || "",
      publicLink: options.publicLink || (data.meta && data.meta.publicLink) || "",
      updatedAt: importedAt,
      importedFromUpload: true,
      importedAt: importedAt,
      importFileName: file && file.name || "",
      importFileType: file && file.type || "",
      importWarnings: warnings,
      importRecognizedFields: parsed.fields
    });

    if (data.contract && options.publicLink) data.contract.publicLink = options.publicLink;

    return {
      data: data,
      warnings: warnings,
      recognizedFields: parsed.fields,
      rawText: extracted.text
    };
  }

  function ensureNoticeStyle() {
    if (document.getElementById("commercialImportNoticeStyle")) return;
    var style = document.createElement("style");
    style.id = "commercialImportNoticeStyle";
    style.textContent = [
      ".commercial-import-notice{position:fixed;right:18px;top:18px;z-index:9999;width:min(420px,calc(100vw - 36px));padding:14px 16px;border:1px solid rgba(148,163,184,.35);border-radius:10px;background:#101827;color:#f8fafc;box-shadow:0 18px 45px rgba(15,23,42,.28);font-family:Segoe UI,Tahoma,sans-serif;font-size:14px;line-height:1.35}",
      ".commercial-import-notice strong{display:block;margin-bottom:4px}",
      ".commercial-import-notice p{margin:0 0 8px;color:#cbd5e1}",
      ".commercial-import-notice ul{margin:0;padding-left:18px}",
      ".commercial-import-notice button{position:absolute;top:8px;right:8px;border:0;background:transparent;color:#f8fafc;font-size:18px;cursor:pointer}"
    ].join("");
    document.head.appendChild(style);
  }

  function showImportNotice(warnings, options) {
    ensureNoticeStyle();
    var notice = document.createElement("div");
    var list = unique(warnings || []);
    notice.className = "commercial-import-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = [
      '<button type="button" aria-label="Fechar aviso">&times;</button>',
      "<strong>" + (options && options.title || "Upload processado") + "</strong>",
      "<p>" + (options && options.summary || "Rascunho criado para revisao.") + "</p>",
      list.length ? "<ul>" + list.slice(0, 5).map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>" : ""
    ].join("");
    notice.querySelector("button").onclick = function () {
      notice.remove();
    };
    document.body.appendChild(notice);
    setTimeout(function () {
      notice.remove();
    }, list.length ? 11000 : 4500);
  }

  window.tkaCommercialContractImporter = {
    buildContractDataFromUpload: buildContractDataFromUpload,
    extractTextFromFile: extractTextFromFile,
    showImportNotice: showImportNotice
  };
})();
