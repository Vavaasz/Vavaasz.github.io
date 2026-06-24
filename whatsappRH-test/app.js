(function () {
  const LOCAL_RH_BRIDGE_URL = "http://127.0.0.1:18992";
  const CLOUD_FUNCTIONS_BASE_URL = "https://southamerica-east1-cadastro-clientes-tka.cloudfunctions.net";
  const CLOUD_RH_AI_DRAFT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/rhAiDraft`;
  const CLOUD_RH_FEEDBACK_URL = `${CLOUD_FUNCTIONS_BASE_URL}/rhFeedbackCloud`;
  const ENABLE_LOCAL_RH_FALLBACK = ["localhost", "127.0.0.1"].includes(location.hostname) || new URLSearchParams(location.search).get("localBridge") === "1";
  const ENABLE_GITHUB_RH_AI_WORKER = new URLSearchParams(location.search).get("githubWorker") === "1" || localStorage.getItem("tka_rh_ai_worker_mode") === "github-actions";
  const ENABLE_CLOUD_FUNCTIONS_AI = new URLSearchParams(location.search).get("tryFunctions") === "1";
  const OPENAI_BACKEND_UNAVAILABLE = "OpenAI cloud não está ativo neste link: Firebase Functions/Secret Manager não existem no plano Spark. O teste usa o helper determinístico do RH.";
  const TEST_LOG_KEY = "tka_whatsapp_rh_ai_test_logs_v1";
  const TEST_FEEDBACK_QUEUE_KEY = "tka_whatsapp_rh_ai_test_feedback_queue_v1";
  const TEST_REJECTION_KEY = "tka_whatsapp_rh_ai_rejected_patterns_v1";
  const TEST_LEARNED_REPLY_KEY = "tka_whatsapp_rh_ai_learned_replies_v1";
  const CHAT_SESSION_KEY = "tka_whatsapp_rh_ai_test_chat_v1";
  const CONVERSATION_STATE_KEY = "tka_whatsapp_rh_ai_test_conversation_v1";
  const MAX_LOGS = 2000;
  const MAX_UNCLEAR_ATTEMPTS = 5;
  const RH_FIRST_MESSAGE = "Ola! Como podemos te ajudar hoje?";
  const RH_DIRECT_SUBJECT_PROMPT = "Pode me dizer qual e sua duvida em uma frase?";
  const CURRENT_QUESTION_PROMPT = RH_FIRST_MESSAGE;
  const RESOLUTION_QUESTION = "Sua duvida foi respondida? Responda sim para encerrar ou nao para continuar com outra pergunta.";
  const QUICK_SCENARIOS = [
    { label: "Primeira mensagem", text: "Bom dia" },
    { label: "VR nao caiu", text: "Waldir Moura, meu VR Caju nao caiu desde 10/06" },
    { label: "TotalPass", text: "Como funciona o TotalPass?" },
    { label: "Holerite", text: "Preciso do holerite de maio/2026" },
    { label: "Ponto Control RH", text: "Como acesso o app Control RH para bater ponto?" },
    { label: "FT", text: "Minha FT do dia 12/06 ainda nao foi paga" },
    { label: "Escala", text: "Preciso confirmar minha escala de amanha as 06h" },
    { label: "Atestado", text: "Vou atrasar hoje e tenho atestado em anexo" },
    { label: "Curriculo", text: "Bom dia, quero enviar curriculo para vaga de controlador de acesso em Taubate" },
    { label: "Rescisao", text: "Sou ex funcionario e preciso saber sobre FGTS da rescisao" },
    { label: "Valor/CCT", text: "Meu extra ficou diferente do valor dos outros colegas" }
  ];

  const RH_DECLARED_ANSWER_BANK = [
    {
      key: "good_standing_bonus",
      optionKey: "cct_values",
      title: "Premio de Boa Permanencia",
      keywords: ["premio de boa permanencia", "boa permanencia", "premio boa permanencia", "premio", "assiduidade"],
      answer: "O Premio de Boa Permanencia, conforme convencao coletiva, e devido ao colaborador que nao possui nenhuma falta no mes, seja justificada ou injustificada. Podem receber: Controlador de Acesso, Operador de Monitoramento, Vigia, Auxiliar de Servicos Gerais e Auxiliar de Manutencao. Quando os criterios sao atendidos, o valor e acrescentado ao Vale Alimentacao."
    },
    {
      key: "totalpass",
      optionKey: "gympass",
      title: "TotalPass",
      keywords: ["totalpass", "total pass"],
      answer: "A TotalPass fica disponivel apos o termino do periodo de experiencia, de 45 + 45 dias. Para usar, o colaborador precisa solicitar a insercao na plataforma; depois do cadastro, o beneficio fica ativo. A TKA fornece apenas o acesso a plataforma: compras, forma de pagamento, planos e uso devem ser tratados diretamente com a TotalPass. E possivel incluir ate 3 dependentes por titular."
    },
    {
      key: "vr_va",
      optionKey: "benefit_cards",
      title: "Beneficios VR e VA",
      keywords: ["quando cai o vr", "quando paga vr", "quando cai o va", "vale refeicao", "vale alimentacao", "superapp vr", "cartao vr", "beneficios"],
      answer: "O VR e pago mensalmente no dia 01. Durante o periodo de experiencia de 45 + 45 dias, o valor e dividido em dois pagamentos, nos dias 01 e 15. O valor mensal segue a escala mensal do colaborador e e um beneficio adiantado para uso no mes vigente. O VA e pago mensalmente no dia 01, apos o fechamento do mes anterior. VR e VA sao disponibilizados pelo Cartao VR; para usar, baixe o SUPERAPP VR, acesse pelo QR Code do cartao e cadastre sua senha. O cartao e nominal e intransferivel."
    },
    {
      key: "vt",
      optionKey: "benefit_cards",
      title: "Vale Transporte",
      keywords: ["vale transporte", "solicitar vt", "solicito vt", "optei pelo vt", "desconto de vt"],
      answer: "O Vale Transporte deve ser solicitado no momento da contratacao. Se o colaborador nao optou pelo VT na admissao, pode solicitar depois, com vigencia a partir do mes seguinte ao pedido. O beneficio e calculado conforme a escala mensal individual e, ao optar pelo VT, ha desconto de 6% do salario em folha, conforme legislacao vigente."
    },
    {
      key: "flash_mobility",
      optionKey: "benefit_cards",
      title: "Cartao Flash - Auxilio Mobilidade",
      keywords: ["cartao flash", "flash", "auxilio mobilidade", "mobilidade", "credito a vista", "recarga de onibus"],
      answer: "O Auxilio Mobilidade e disponibilizado pelo Cartao Flash. Depois do convite por e-mail ou SMS, o colaborador acessa o app Flash, verifica recargas e cadastra o cartao fisico. O beneficio pode ser usado em postos de combustivel, transporte publico, recarga de cartao de onibus, vans e meios credenciados. Para pagar nos estabelecimentos, selecione a opcao CREDITO A VISTA."
    },
    {
      key: "payment_dates",
      optionKey: "payroll_payment",
      title: "Pagamento, datas e prazos",
      keywords: ["quinto dia util", "5 dia util", "5o dia util", "data de pagamento", "quando paga", "fechamento da folha", "fechamento folha", "prazo pagamento"],
      answer: "O pagamento do salario e realizado todo quinto dia util de cada mes. O fechamento da folha ocorre do dia 26 de um mes ao dia 25 do mes seguinte. Horas, adicionais, descontos e ocorrencias registradas nesse periodo entram no pagamento do quinto dia util do mes seguinte. Exemplo: apuracao de 26 de janeiro a 25 de fevereiro, pagamento no quinto dia util de marco."
    },
    {
      key: "control_rh",
      optionKey: "schedule",
      title: "Registro de ponto - Control RH",
      keywords: ["control rh", "controle rh", "registro de ponto", "bater ponto", "ponto", "codigo da empresa", "s3ca2", "batida de ponto"],
      answer: "O ponto e registrado pelo aplicativo Control RH. Ao abrir o app, informe o codigo da empresa S3CA2. No primeiro acesso, use login com os 4 primeiros digitos do CPF e senha inicial 123456; depois saia e entre novamente para trocar para uma senha pessoal. Registre entrada, saida para almoco, retorno do almoco e saida final. Ha tolerancia de 10 minutos antes ou depois para entrada e saida. O ponto pode ser batido sem internet e sera enviado quando o celular voltar a ter conexao. Se esquecer ou bater fora do horario, registre assim que lembrar, clique na batida, abra a justificativa e informe o motivo."
    },
    {
      key: "payslip_incicle",
      optionKey: "payslip",
      title: "Holerite",
      keywords: ["holerite incicle", "onde vejo o holerite", "historico de holerites", "dia do pagamento", "disponibilizado"],
      answer: "O holerite mensal e disponibilizado no dia do pagamento, que ocorre no quinto dia util de cada mes, pela plataforma INCICLE. Quando o holerite for inserido, o colaborador recebe uma notificacao no aplicativo. Para acessar, entre no app INCICLE, abra o menu no canto superior esquerdo pelo icone de 9 pontos e escolha Historico de Holerites."
    },
    {
      key: "incicle_access",
      optionKey: "document",
      title: "Cadastro e uso do INCICLE",
      keywords: ["cadastro incicle", "acesso incicle", "convite incicle", "plataforma incicle", "email incicle"],
      answer: "A INCICLE e a plataforma de RH da TKA para centralizar documentos pessoais, holerites, feedbacks, avaliacoes, projetos e comunicados oficiais. O convite de acesso e enviado por e-mail, normalmente para o e-mail informado na admissao. Se o convite nao foi localizado, envie um e-mail valido para o RH verificar e reenviar o acesso."
    }
  ];

  const fallbackOptions = [
    {
      key: "identity_verification",
      title: "Validar identidade",
      short: "Pedir nome e sobrenome e validar cadastro antes de seguir.",
      prompt: "Ola. Por gentileza, informe seu nome e sobrenome para localizarmos seu cadastro no RH.",
      requiredFields: ["nome e sobrenome"],
      intents: ["identity", "unknown"]
    },
    {
      key: "rh_handoff",
      title: "Encaminhar para RH",
      short: "Coletar duvida e informar retorno do RH.",
      prompt: "Obrigado pelas informacoes. Vou encaminhar sua solicitacao ao RH para verificacao e retorno assim que possivel.",
      requiredFields: ["nome e sobrenome", "assunto"],
      intents: ["handoff", "other"]
    },
    {
      key: "vacation",
      title: "Ferias",
      short: "Conferir admissao, periodo aquisitivo/concessivo e ferias ja usadas.",
      prompt: "Por gentileza, informe seu nome e sobrenome, data de admissao, periodo de ferias desejado e se ja teve ferias concedidas, adiantadas ou parcialmente usadas.",
      requiredFields: ["nome e sobrenome", "data de admissao", "periodo desejado"],
      intents: ["vacation"]
    },
    {
      key: "benefit_cards",
      title: "VR, VA, VT ou cartao",
      short: "Confirmar beneficio, cartao e dados do colaborador.",
      prompt: "Por gentileza, informe seu nome e sobrenome, posto, qual beneficio ou cartao apresentou problema e desde quando isso ocorreu para o RH verificar.",
      requiredFields: ["nome e sobrenome", "posto", "beneficio", "data do problema"],
      intents: ["benefit", "benefit_card"]
    },
    {
      key: "gympass",
      title: "Gym Pass / Wellhub",
      short: "Validar colaborador antes de orientar beneficio academia.",
      prompt: "Por gentileza, informe nome e sobrenome e confirme seu vínculo com a TKA para o RH validar o cadastro do Gym Pass/Wellhub.",
      requiredFields: ["nome e sobrenome", "vínculo com a TKA"],
      intents: ["benefit", "gympass"]
    },
    {
      key: "ft_payment",
      title: "FT / folga trabalhada",
      short: "Tratar folga trabalhada como FT e validar antes de pagamento.",
      prompt: "Por gentileza, informe seu nome e sobrenome, posto, data da folga trabalhada, periodo do turno e, se a duvida for falta de pagamento, envie a chave PIX para conferencia do RH.",
      requiredFields: ["nome e sobrenome", "posto", "data", "periodo"],
      intents: ["ft", "schedule_coverage"]
    },
    {
      key: "payroll_payment",
      title: "Pagamento ou desconto",
      short: "Validar competencia, rubrica e dados do colaborador.",
      prompt: "Por gentileza, informe seu nome e sobrenome, competencia ou data do pagamento, e qual desconto ou valor precisa ser conferido. O RH validara no sistema antes de responder.",
      requiredFields: ["nome e sobrenome", "competencia", "tipo de pagamento ou desconto"],
      intents: ["salary_payment", "payroll"]
    },
    {
      key: "cct_values",
      title: "CCT ou valores",
      short: "Usar CCT apenas como referencia e encaminhar validacao RH.",
      prompt: "Esses valores dependem de cargo, escala, faltas, ferias e CCT vigente. Por gentileza, informe nome e sobrenome, funcao, posto e qual valor deseja conferir para encaminharmos ao RH.",
      requiredFields: ["nome e sobrenome", "funcao", "posto", "valor ou beneficio"],
      intents: ["cct", "salary_payment"]
    },
    {
      key: "candidate_intake",
      title: "Curriculo / candidato",
      short: "Coletar cidade, funcao desejada e disponibilidade.",
      prompt: "Recebemos seu contato. Por favor informe nome e sobrenome, cidade, funcao desejada, disponibilidade e envie o curriculo para direcionarmos corretamente.",
      requiredFields: ["nome e sobrenome", "cidade", "funcao desejada", "curriculo"],
      intents: ["curriculum", "candidate"]
    },
    {
      key: "payslip",
      title: "Holerite",
      short: "Pedir competencia e nao anexar documento automaticamente.",
      prompt: "Por gentileza, informe seu nome e sobrenome e de qual mes voce precisa do holerite para encaminharmos a verificacao do RH.",
      requiredFields: ["nome e sobrenome", "competencia"],
      intents: ["payslip"]
    },
    {
      key: "medical_certificate",
      title: "Atestado / falta / atraso",
      short: "Coletar horario, posto e comprovante sem decidir penalidade.",
      prompt: "Entendido. Por gentileza, informe seu nome e sobrenome, posto, horario afetado e anexe o atestado ou comprovante para repassarmos ao RH.",
      requiredFields: ["nome e sobrenome", "posto", "horario", "comprovante"],
      intents: ["medical_certificate", "absence_delay"]
    },
    {
      key: "schedule",
      title: "Escala, folga ou cobertura",
      short: "Conferir escala/FT no Dashboard.",
      prompt: "Por gentileza, informe nome e sobrenome, posto, data e horario da escala ou folga para o RH conferir no Dashboard.",
      requiredFields: ["nome e sobrenome", "posto", "data", "horario"],
      intents: ["schedule_coverage"]
    },
    {
      key: "termination",
      title: "Rescisao / desligamento",
      short: "Tratar como ex-funcionario e validar documentos.",
      prompt: "Por gentileza, informe nome e sobrenome, data de desligamento e assunto da solicitacao para o RH conferir rescisao, FGTS, baixa ou seguro-desemprego.",
      requiredFields: ["nome e sobrenome", "data de desligamento", "assunto"],
      intents: ["termination"]
    },
    {
      key: "document",
      title: "Documento",
      short: "Identificar documento e competencia antes de anexar ou enviar.",
      prompt: "Por gentileza, informe seu nome e sobrenome e qual documento precisa para o RH localizar corretamente.",
      requiredFields: ["nome e sobrenome", "documento solicitado"],
      intents: ["documents"]
    },
    {
      key: "uniform_equipment",
      title: "Uniforme / equipamento",
      short: "Confirmar item, tamanho, posto e urgencia.",
      prompt: "Por gentileza, informe seu nome e sobrenome, posto, item necessario, tamanho quando aplicavel e urgencia para o RH verificar.",
      requiredFields: ["nome e sobrenome", "posto", "item"],
      intents: ["uniform_equipment"]
    }
  ];

  const legacyKeywordRules = [
    { intent: "curriculum", key: "candidate_intake", label: "Curriculo / candidato", words: ["curriculo", "vaga", "oportunidade", "emprego", "procurando trabalho", "procuro trabalho", "contratando", "cnv"] },
    { intent: "payslip", key: "payslip", label: "Holerite", words: ["holerite", "contra cheque", "contracheque", "demonstrativo"] },
    { intent: "benefit_card", key: "benefit_cards", label: "VR, VA, VT ou cartao", words: ["vr", "va", "vale", "vt", "transporte", "alimentacao", "refeicao", "cartao", "beneficio", "caju", "pluxee", "sodexo"] },
    { intent: "ft", key: "ft_payment", label: "FT / folga trabalhada", words: ["folga trabalhada", "ft", "dobra", "cobertura", "cobrir", "pix"] },
    { intent: "vacation", key: "vacation", label: "Ferias", words: ["ferias", "férias", "periodo aquisitivo", "concessivo"] },
    { intent: "salary_payment", key: "payroll_payment", label: "Pagamento ou desconto", words: ["salario", "pagamento", "pagar", "desconto", "inss", "adiantamento", "faltou valor", "deposito", "depositou"] },
    { intent: "cct", key: "cct_values", label: "CCT ou valores", words: ["cct", "sindicato", "sindeepres", "sesvesp", "piso", "periculosidade", "plr", "cesta", "assiduidade", "odonto", "valor"] },
    { intent: "medical_certificate", key: "medical_certificate", label: "Atestado / falta / atraso", words: ["atestado", "medico", "doente", "falta", "faltar", "atraso", "atrasar", "chegar atrasado"] },
    { intent: "schedule_coverage", key: "schedule", label: "Escala, folga ou cobertura", words: ["escala", "folga", "posto", "plantao", "turno", "horario", "troca", "permuta"] },
    { intent: "documents", key: "document", label: "Documento", words: ["declaracao", "documento", "aso", "contrato", "carta", "fgts", "seguro desemprego"] },
    { intent: "uniform_equipment", key: "uniform_equipment", label: "Uniforme / equipamento", words: ["uniforme", "crachá", "cracha", "colete", "radio", "equipamento", "botina", "camisa", "calca"] }
  ];

  const intentLexicon = {
    greeting: [
      "oi", "oii", "oiii", "ola", "olaa", "bom dia", "bomdia", "boa tarde", "boatarde",
      "boa noite", "boanoite", "opa", "e ai", "eai", "alo", "tudo bem", "td bem",
      "tudo bom", "boa", "salve", "prezado", "prezada"
    ],
    identity: [
      "nome completo", "meu nome e", "me chamo", "sou o", "sou a", "aqui e", "quem fala",
      "data de nascimento", "nascimento", "admissao", "sou funcionario", "sou funcionaria",
      "funcionario", "funcionaria", "funcionario da tka", "funcionaria da tka",
      "colaborador", "colaboradora", "sou colaborador", "sou colaboradora",
      "trabalho na tka", "sou da tka", "grupo tka", "tka", "ativo"
    ],
    candidate: [
      "curriculo", "curriculum", "cv", "vaga", "vagas", "emprego", "oportunidade",
      "entrevista", "processo seletivo", "quero trabalhar", "procuro trabalho",
      "procurando trabalho", "procurando emprego", "tenho interesse", "estao contratando",
      "contratando", "disponivel para trabalhar", "disponibilidade", "cnv", "curso de vigilante"
    ],
    payslip: [
      "holerite", "olerite", "holerit", "contra cheque", "contracheque", "contra-cheque",
      "oleriti", "olirite", "oliriti", "holeriti", "meu holerite", "meu olerite",
      "demonstrativo", "demonstrativo de pagamento", "comprovante de pagamento",
      "recibo de pagamento", "espelho de pagamento", "incicle", "historico de holerites"
    ],
    benefit: [
      "vr", "va", "vt", "vale", "vale refeicao", "vale alimentacao", "vale transporte",
      "alimentacao", "refeicao", "transporte", "cartao", "cartao beneficio",
      "cartao alimentacao", "cartao refeicao", "cartao transporte", "beneficio", "beneficios",
      "saldo", "sem saldo", "bloqueado", "desbloquear", "segunda via", "caiu", "nao caiu",
      "nao carregou", "sem carga", "recarga", "carga", "perdi o cartao", "cartao perdido",
      "valecard", "vale card", "caju", "pluxee", "sodexo", "alelo", "ticket", "flash", "ben",
      "cartao flash", "auxilio mobilidade", "mobilidade", "superapp vr", "cartao vr"
    ],
    gympass: [
      "gympass", "gym pass", "wellhub", "totalpass", "total pass", "academia", "beneficio academia", "plano academia"
    ],
    ft: [
      "ft", "folga trabalhada", "folgas trabalhadas", "dobra", "dobrar", "dobrei",
      "diaria", "plantao extra", "extra", "cobertura", "cobri", "cobrir", "trabalhei na folga",
      "nao recebi a ft", "nao pagou a ft", "pagamento da ft", "folga paga", "extra nao pago"
    ],
    vacation: [
      "ferias", "feria", "periodo aquisitivo", "periodo concessivo", "periodo de ferias",
      "recibo de ferias", "vencimento de ferias", "marcar ferias", "tirar ferias",
      "adiantar ferias", "vender ferias", "abono de ferias"
    ],
    payroll: [
      "salario", "pagamento", "pagar", "pagou", "deposito", "depositou", "nao recebi",
      "nao caiu", "faltou valor", "veio errado", "veio desconto", "desconto errado",
      "desconto", "descontou", "inss", "pagamento errado", "salario errado",
      "adiantamento", "vale salarial", "folha", "pix", "chave pix", "decimo terceiro",
      "13 salario", "decimo", "odonto", "odontologico", "assistencial", "negocial",
      "quinto dia util", "5 dia util", "5o dia util", "fechamento da folha", "fechamento folha"
    ],
    cct: [
      "cct", "convencao", "convencao coletiva", "sindicato", "sindeepres", "sesvesp",
      "piso", "piso salarial", "periculosidade", "plr", "cesta", "cesta basica",
      "assiduidade", "valor", "quanto", "quanto e", "controlador de acesso",
      "porteiro", "vigia", "vigilante", "fiscal de piso", "portaria remota",
      "premio de boa permanencia", "boa permanencia", "premio"
    ],
    medical: [
      "atestado", "atestado medico", "medico", "consulta", "doente", "passando mal",
      "problema de saude", "falta", "vou faltar", "faltei", "nao vou", "nao consigo ir",
      "atraso", "atrasar", "atrasado", "chegar atrasado", "emergencia familiar",
      "hospital", "pronto socorro", "atestado em anexo", "vou me atrasar"
    ],
    schedule: [
      "escala", "folga", "posto", "plantao", "turno", "horario", "troca", "trocar",
      "permuta", "cobertura", "cobrir", "rendicao", "render", "quem esta", "posto hoje",
      "entrada", "saida", "banco de horas", "ponto", "cartao ponto", "minha escala", "meu turno",
      "control rh", "controle rh", "registro de ponto", "bater ponto", "batida de ponto", "s3ca2"
    ],
    termination: [
      "rescisao", "demissao", "desligamento", "desligado", "demitido", "homologacao",
      "fgts", "seguro desemprego", "baixa carteira", "baixa na carteira", "ex funcionario",
      "ex funcionaria", "ex-funcionario", "ex-funcionaria", "aviso previo"
    ],
    document: [
      "documento", "documentos", "declaracao", "aso", "contrato", "carta", "rg", "cpf",
      "ctps", "carteira de trabalho", "comprovante", "certidao", "antecedentes",
      "ficha", "formulario", "espelho de ponto", "comprovante de vinculo"
    ],
    uniform: [
      "uniforme", "camisa", "calca", "bota", "botina", "cinto", "cracha", "crachas",
      "colete", "radio", "ht", "material", "equipamento", "capa", "jaqueta", "tamanho",
      "uniformi", "farda", "epi"
    ],
    general: [
      "preciso", "pode", "poderia", "consegue", "favor", "por favor", "duvida",
      "pergunta", "me ajuda", "ajuda", "solicito", "solicitacao", "quero saber",
      "gostaria", "informacao", "retorno"
    ],
    acknowledgement: [
      "ok", "okay", "certo", "entendi", "beleza", "blz", "obrigado", "obrigada", "obg",
      "valeu", "vlw", "perfeito", "combinado"
    ]
  };

  const keywordRules = [
    { intent: "candidate", key: "candidate_intake", label: "Curriculo / candidato", words: intentLexicon.candidate, priority: 96 },
    { intent: "termination", key: "termination", label: "Rescisao / desligamento", words: intentLexicon.termination, priority: 92 },
    { intent: "payslip", key: "payslip", label: "Holerite", words: intentLexicon.payslip, priority: 90 },
    { intent: "gympass", key: "gympass", label: "Gym Pass / Wellhub", words: intentLexicon.gympass, priority: 88 },
    { intent: "benefit_card", key: "benefit_cards", label: "VR, VA, VT ou cartao", words: intentLexicon.benefit, priority: 86 },
    { intent: "ft", key: "ft_payment", label: "FT / folga trabalhada", words: intentLexicon.ft, priority: 84 },
    { intent: "vacation", key: "vacation", label: "Ferias", words: intentLexicon.vacation, priority: 82 },
    { intent: "cct", key: "cct_values", label: "CCT ou valores", words: intentLexicon.cct, priority: 80 },
    { intent: "salary_payment", key: "payroll_payment", label: "Pagamento ou desconto", words: intentLexicon.payroll, priority: 78 },
    { intent: "medical_certificate", key: "medical_certificate", label: "Atestado / falta / atraso", words: intentLexicon.medical, priority: 76 },
    { intent: "schedule_coverage", key: "schedule", label: "Escala, folga ou cobertura", words: intentLexicon.schedule, priority: 74 },
    { intent: "documents", key: "document", label: "Documento", words: intentLexicon.document, priority: 72 },
    { intent: "uniform_equipment", key: "uniform_equipment", label: "Uniforme / equipamento", words: intentLexicon.uniform, priority: 70 },
    { intent: "identity", key: "identity_verification", label: "Identificacao", words: intentLexicon.identity, priority: 50 },
    { intent: "greeting", key: "identity_verification", label: "Saudacao / abertura", words: intentLexicon.greeting, priority: 20 },
    { intent: "general_request", key: "rh_handoff", label: "Solicitacao geral", words: intentLexicon.general, priority: 18 },
    { intent: "acknowledgement", key: "rh_handoff", label: "Confirmacao / agradecimento", words: intentLexicon.acknowledgement, priority: 8 }
  ];

  const state = {
    sourceMode: "typed",
    health: null,
    summary: null,
    aiDb: null,
    directory: {
      workers: [],
      places: [],
      profiles: [],
      jobFunctions: []
    },
    dataSource: "",
    lastError: "",
    lastFetchedAt: "",
    selectedMessageId: "",
    lastDraft: null,
    pendingQuestion: null,
    conversationContext: null,
    aiDraftRunning: false,
    aiCloudRuntime: {
      mode: "deterministic-rh-helper",
      configured: false,
      model: "",
      lastError: OPENAI_BACKEND_UNAVAILABLE
    },
    logs: [],
    chatMessages: [],
    feedbackFlushRunning: false,
    sharedLearningErrorLogged: false,
    manualLearningStatus: null
  };

  const el = {
    pageMeta: document.getElementById("pageMeta"),
    connectionPanel: document.getElementById("connectionPanel"),
    draftState: document.getElementById("draftState"),
    testMessage: document.getElementById("testMessage"),
    selectedMessageMeta: document.getElementById("selectedMessageMeta"),
    quickScenarios: document.getElementById("quickScenarios"),
    chatTranscript: document.getElementById("chatTranscript"),
    chatModePill: document.getElementById("chatModePill"),
    generateBtn: document.getElementById("generateBtn"),
    useLatestBtn: document.getElementById("useLatestBtn"),
    clearChatBtn: document.getElementById("clearChatBtn"),
    retryLearningBtn: document.getElementById("retryLearningBtn"),
    runSuiteBtn: document.getElementById("runSuiteBtn"),
    draftResult: document.getElementById("draftResult"),
    correctionText: document.getElementById("correctionText"),
    approveBtn: document.getElementById("approveBtn"),
    correctBtn: document.getElementById("correctBtn"),
    rejectBtn: document.getElementById("rejectBtn"),
    teachBtn: document.getElementById("teachBtn"),
    manualLearningTopic: document.getElementById("manualLearningTopic"),
    manualLearningQuestion: document.getElementById("manualLearningQuestion"),
    manualLearningAnswer: document.getElementById("manualLearningAnswer"),
    manualLearningBtn: document.getElementById("manualLearningBtn"),
    manualLearningState: document.getElementById("manualLearningState"),
    trainingPanel: document.getElementById("trainingPanel"),
    liveMessageCount: document.getElementById("liveMessageCount"),
    liveMessages: document.getElementById("liveMessages"),
    copyLogsBtn: document.getElementById("copyLogsBtn"),
    downloadLogsBtn: document.getElementById("downloadLogsBtn"),
    logStats: document.getElementById("logStats"),
    testLogs: document.getElementById("testLogs")
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s/@.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeCommonTypos(value) {
    return String(value || "")
      .replace(/\bolerite\b/g, "holerite")
      .replace(/\boleriti\b/g, "holerite")
      .replace(/\bolirite\b/g, "holerite")
      .replace(/\boliriti\b/g, "holerite")
      .replace(/\bholerit\b/g, "holerite")
      .replace(/\bholeriti\b/g, "holerite")
      .replace(/\bcontra cheque\b/g, "contracheque")
      .replace(/\bvale card\b/g, "valecard cartao beneficio")
      .replace(/\bvalecard\b/g, "valecard cartao beneficio")
      .replace(/\bcartaozinho\b/g, "cartao")
      .replace(/\bcartaozinh[oas]\b/g, "cartao")
      .replace(/\bbenefisio\b/g, "beneficio")
      .replace(/\bbeneficioo\b/g, "beneficio")
      .replace(/\bpagameto\b/g, "pagamento")
      .replace(/\bpgto\b/g, "pagamento")
      .replace(/\bpgt\b/g, "pagamento")
      .replace(/\bdescontu\b/g, "desconto")
      .replace(/\bdiscconto\b/g, "desconto")
      .replace(/\bsalarioo\b/g, "salario")
      .replace(/\bferias\b/g, "ferias")
      .replace(/\bferiaz\b/g, "ferias")
      .replace(/\batestadu\b/g, "atestado")
      .replace(/\batestato\b/g, "atestado")
      .replace(/\buniformi\b/g, "uniforme")
      .replace(/\bcrcha\b/g, "cracha")
      .replace(/\bcracha\b/g, "cracha")
      .replace(/\brecisao\b/g, "rescisao")
      .replace(/\brescisaoo\b/g, "rescisao")
      .replace(/\bfuncinario\b/g, "funcionario")
      .replace(/\bfuncionarioo\b/g, "funcionario")
      .replace(/\bfuncionariaa\b/g, "funcionaria")
      .replace(/\bcompetensia\b/g, "competencia")
      .replace(/\bcompentencia\b/g, "competencia")
      .replace(/\bnao caio\b/g, "nao caiu")
      .replace(/\bn caiu\b/g, "nao caiu")
      .replace(/\bvrn\b/g, "vr nao")
      .replace(/\bvtn\b/g, "vt nao")
      .replace(/\bvan\b/g, "va nao");
  }

  function normalizeForKeyword(value) {
    return normalizeCommonTypos(normalizeText(value).replace(/([a-z])\1{2,}/g, "$1$1"));
  }

  function isExploratoryValueComparison(normalized) {
    const comparison = /\b(outro|outros|outra|outras|colega|colegas|todo mundo|pessoal|mais que|menos que|maior que|menor que|mais barato|barato|barata|mais caro|mais alto|mais baixo|diferente|comparar|comparacao|igual)\b/.test(normalized);
    const valueTopic = /\b(extra|ft|folga trabalhada|valor|salario|pagamento|desconto|piso|cct|plr|vr|va|vt|beneficio|recebeu|recebi|ganhou|ganhei|pagou|pagaram|caiu)\b/.test(normalized);
    return comparison && valueTopic;
  }

  function exactTermMatch(normalizedText, rawTerm) {
    const term = normalizeForKeyword(rawTerm);
    if (!term) return false;
    const text = normalizeForKeyword(normalizedText);
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:\\s|$)`);
    return pattern.test(text);
  }

  function keywordHits(normalizedText, words) {
    return words.filter(word => exactTermMatch(normalizedText, word));
  }

  const fieldHelp = {
    "tipo de vinculo com a tka": { label: "tipo de vínculo com a TKA", example: "funcionário, ex-funcionário ou currículo" },
    "vinculo com a tka": { label: "vínculo com a TKA", example: "funcionário da TKA" },
    "nome e sobrenome": { label: "nome e sobrenome", example: "João Silva" },
    "nome completo": { label: "nome e sobrenome", example: "João Silva" },
    "assunto": { label: "assunto", example: "VR não caiu, holerite de maio ou escala de amanhã" },
    "beneficio ou cartao": { label: "benefício ou cartão", example: "VR Caju, VA, VT ou perdi meu cartão" },
    "periodo ou data do problema": { label: "quando aconteceu", example: "desde 10/06 ou no benefício de junho" },
    "data da ft": { label: "data da FT", example: "12/06/2026" },
    "periodo do turno": { label: "turno ou período", example: "noturno, 18h às 06h" },
    "pix para conferencia": { label: "chave PIX, se for falta de pagamento", example: "CPF, e-mail ou telefone" },
    "competencia ou data": { label: "competência ou data", example: "maio/2026 ou 05/06/2026" },
    "tipo de pagamento ou desconto": { label: "o que precisa conferir", example: "desconto de VT, INSS, salário ou adiantamento" },
    "funcao": { label: "função", example: "vigilante, porteiro ou controlador de acesso" },
    "valor ou beneficio a conferir": { label: "valor ou benefício a conferir", example: "piso do vigilante, VR, cesta ou PLR" },
    "mes ou competencia": { label: "mês ou competência", example: "maio/2026" },
    "cidade": { label: "cidade", example: "Taubaté ou São José dos Campos" },
    "funcao desejada": { label: "função desejada", example: "vigilante ou controlador de acesso" },
    "curriculo": { label: "currículo", example: "anexar PDF, foto ou escrever que vai enviar o currículo" },
    "periodo desejado": { label: "período desejado", example: "férias em julho/2026" },
    "data": { label: "data", example: "20/06/2026 ou amanhã" },
    "horario": { label: "horário", example: "06h, 18h ou 18h às 06h" },
    "documento solicitado": { label: "documento solicitado", example: "declaração, ASO, contrato ou holerite" },
    "item necessario": { label: "item necessário", example: "camisa G, crachá ou botina 42" },
    "horario afetado": { label: "horário afetado", example: "turno das 18h ou entrada às 06h" },
    "comprovante ou atestado": { label: "comprovante ou atestado", example: "foto do atestado ou comprovante em anexo" },
    "assunto da rescisao": { label: "assunto da rescisão", example: "FGTS, homologação, baixa na carteira ou seguro-desemprego" }
  };

  const fieldQuestionText = {
    "assunto": "Qual e sua duvida?",
    "tipo de vinculo com a tka": "Voce fala como colaborador da TKA, ex-colaborador ou candidato?",
    "vinculo com a tka": "Voce e colaborador da TKA?",
    "nome e sobrenome": "Informe seu nome e sobrenome.",
    "beneficio ou cartao": "Qual beneficio ou cartao e o problema?",
    "periodo ou data do problema": "Desde quando isso acontece?",
    "data da ft": "Qual foi a data da FT?",
    "periodo do turno": "Qual foi o turno ou periodo?",
    "pix para conferencia": "Informe a chave PIX para conferencia.",
    "competencia ou data": "Qual mes e ano, ou qual data especifica, devo considerar?",
    "tipo de pagamento ou desconto": "O que precisa ser conferido nesse pagamento?",
    "funcao": "Qual e sua funcao?",
    "valor ou beneficio a conferir": "Qual valor ou beneficio precisa conferir?",
    "mes ou competencia": "De qual mes e ano voce precisa?",
    "cidade": "Qual e a cidade?",
    "funcao desejada": "Qual funcao desejada?",
    "curriculo": "Envie o curriculo ou informe que vai anexar.",
    "periodo desejado": "Qual periodo desejado?",
    "data": "Qual e a data?",
    "horario": "Qual e o horario?",
    "documento solicitado": "Qual documento voce precisa?",
    "item necessario": "Qual item voce precisa?",
    "horario afetado": "Qual horario foi afetado?",
    "comprovante ou atestado": "Envie o comprovante ou atestado.",
    "assunto da rescisao": "Qual assunto da rescisao precisa tratar?"
  };

  const missingFieldPriority = {
    payroll_payment: ["competencia ou data", "tipo de pagamento ou desconto", "nome e sobrenome"],
    benefit_cards: ["periodo ou data do problema", "beneficio ou cartao", "nome e sobrenome"],
    payslip: ["mes ou competencia", "nome e sobrenome"],
    ft_payment: ["data da FT", "periodo do turno", "PIX para conferencia", "nome e sobrenome"],
    schedule: ["data", "horario", "nome e sobrenome"],
    medical_certificate: ["horario afetado", "comprovante ou atestado", "nome e sobrenome"],
    document: ["documento solicitado", "nome e sobrenome"],
    uniform_equipment: ["item necessario", "nome e sobrenome"],
    cct_values: ["valor ou beneficio a conferir", "funcao", "nome e sobrenome"],
    vacation: ["periodo desejado", "nome e sobrenome"],
    candidate_intake: ["cidade", "funcao desejada", "curriculo", "nome e sobrenome"],
    termination: ["assunto da rescisao", "nome e sobrenome"],
    identity_verification: ["assunto", "nome e sobrenome", "tipo de vinculo com a TKA"],
    general_request: ["assunto"],
    rh_handoff: ["assunto", "nome e sobrenome"]
  };

  function fieldHelpFor(field) {
    const normalized = normalizeText(field);
    if (normalized === "posto") return { label: "posto", example: "base, condominio ou cliente onde trabalha" };
    if (normalized === "escala") return { label: "escala", example: "12x36 diurna, 12x36 noturna ou horario comercial" };
    return fieldHelp[normalized] || {
      label: field === "nome completo" ? "nome e sobrenome" : String(field || "").trim(),
      example: "escreva um exemplo simples do que precisa"
    };
  }

  function fieldWithExample(field) {
    const help = fieldHelpFor(field);
    return `${help.label} (ex.: ${help.example})`;
  }

  function nextMissingField(missing, optionKey = "") {
    const rows = Array.isArray(missing) ? missing.filter(Boolean) : [];
    if (!rows.length) return "";
    const priority = missingFieldPriority[optionKey] || [];
    return priority.find(field => rows.includes(field)) || rows[0];
  }

  function missingLines(missing) {
    return missing.map(field => {
      const help = fieldHelpFor(field);
      return `- ${help.label}: ${help.example}`;
    });
  }

  function missingRequestText(missing, fullExample, includeExamples = false, optionKey = "") {
    const field = nextMissingField(missing, optionKey);
    if (!field) return "";
    const help = fieldHelpFor(field);
    const normalized = normalizeText(field);
    const question = fieldQuestionText[normalized] || `Informe ${help.label}.`;
    const exampleText = includeExamples
      ? ` Exemplo: ${help.example}.${fullExample ? ` Mensagem completa: ${fullExample}.` : ""}`
      : "";
    return ` ${question}${exampleText}`;
  }

  function declaredAnswerMatchScore(entry, text, optionKey) {
    const normalized = normalizeForKeyword(text);
    if (!normalized) return 0;
    const hits = (entry.keywords || []).filter(keyword => exactTermMatch(normalized, keyword));
    if (!hits.length) return 0;
    const optionBonus = optionKey && optionKey === entry.optionKey ? 0.12 : 0;
    return Math.min(1, 0.62 + hits.length * 0.12 + optionBonus);
  }

  function declaredEmployeeContextMissing(facts = {}) {
    const missing = [];
    if (!facts.hasName) missing.push("nome e sobrenome");
    if (!facts.hasRole && !facts.hasKnownRole) missing.push("funcao");
    if (!facts.hasPost && !facts.hasKnownPost) missing.push("posto");
    if (!facts.hasPeriod && !facts.hasScheduleHour) missing.push("escala");
    return missing;
  }

  function declaredAnswerFor(text, optionKey, facts = {}, audience = {}) {
    const matches = RH_DECLARED_ANSWER_BANK
      .map(entry => ({ ...entry, score: declaredAnswerMatchScore(entry, text, optionKey) }))
      .filter(entry => entry.score >= 0.62)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"));
    const entry = matches[0] || null;
    if (!entry) return null;
    const shouldAskEmployeeContext = audience.key !== "candidate";
    const contextMissing = shouldAskEmployeeContext ? declaredEmployeeContextMissing(facts).slice(0, 4) : [];
    const suffix = contextMissing.length
      ? `\n\nPara o RH aplicar corretamente ao seu caso, envie ${missingListText(contextMissing)}.`
      : "\n\nSe quiser que o RH confira seu caso individual, envie sua duvida com nome, funcao, posto e escala.";
    return {
      key: entry.key,
      optionKey: entry.optionKey,
      title: entry.title,
      score: entry.score,
      source: "Rh automatizado - Grupo TKA(4)",
      reply: `Ola! ${entry.answer}${suffix}`,
      contextMissing
    };
  }

  const NAME_STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

  function nameTokens(value) {
    return normalizeText(value)
      .split(" ")
      .filter(token => token.length >= 2 && !NAME_STOP_WORDS.has(token) && /^[a-z]+$/.test(token));
  }

  function looksLikeStandaloneName(value) {
    const normalized = normalizeText(value);
    if (!normalized || /\d|@|\/|\\|:/.test(normalized)) return false;
    if (/^(sim|nao|n|ok|okay|certo|ta|tudo bem|entendi|pode|isso|nao sei|n sei|sei la|obrigado|obrigada|valeu|vlw)$/.test(normalized)) return false;
    const nonNameTerms = [
      ...intentLexicon.greeting,
      ...intentLexicon.candidate,
      ...intentLexicon.payslip,
      ...intentLexicon.benefit,
      ...intentLexicon.gympass,
      ...intentLexicon.ft,
      ...intentLexicon.vacation,
      ...intentLexicon.payroll,
      ...intentLexicon.cct,
      ...intentLexicon.medical,
      ...intentLexicon.schedule,
      ...intentLexicon.termination,
      ...intentLexicon.document,
      ...intentLexicon.uniform,
      ...intentLexicon.general,
      ...intentLexicon.acknowledgement
    ];
    if (keywordHits(normalized, nonNameTerms).length) return false;
    const rawTokens = normalized.split(" ").filter(Boolean);
    const tokens = nameTokens(value);
    return rawTokens.length >= 2 && rawTokens.length <= 7 && tokens.length >= 2 && tokens.length >= rawTokens.length - 2;
  }

  function applySeedData() {
    const seed = window.RH_SEED_DATA || {};
    state.directory.workers = Array.isArray(seed.workers) ? seed.workers.map(worker => ({ source: "seed", ...worker })) : [];
    state.directory.places = Array.isArray(seed.places) ? seed.places.map(place => ({ source: "seed", ...place })) : [];
    state.directory.profiles = Array.isArray(seed.worker_profiles) ? seed.worker_profiles.map(profile => ({ source: "seed", ...profile })) : [];
    state.directory.jobFunctions = Array.isArray(seed.job_functions) ? seed.job_functions.map(jobFunction => ({ source: "seed", ...jobFunction })) : [];
  }

  function placeNameById(placeId) {
    if (!placeId) return "";
    const place = state.directory.places.find(item => String(item.id || "") === String(placeId));
    return String(place?.name || "").trim();
  }

  function jobFunctionNameById(jobFunctionId) {
    if (!jobFunctionId) return "";
    const jobFunction = state.directory.jobFunctions.find(item => String(item.id || "") === String(jobFunctionId));
    return String(jobFunction?.name || "").trim();
  }

  function profileForWorker(workerId) {
    if (!workerId) return null;
    return state.directory.profiles.find(profile => String(profile.workerId || "") === String(workerId)) || null;
  }

  function enrichWorkerForLookup(worker) {
    if (!worker || typeof worker !== "object") return worker;
    const profile = profileForWorker(worker.id || worker.workerId);
    const placeName = worker.placeName || worker.place || worker.posto || placeNameById(profile?.placeId || worker.placeId);
    const roleName = worker.role || worker.funcao || worker["função"] || worker.cargo || profile?.cargo || jobFunctionNameById(profile?.jobFunctionId || worker.jobFunctionId);
    return {
      ...profile,
      ...worker,
      profile,
      placeName,
      roleName,
      placeId: worker.placeId || profile?.placeId || "",
      cargo: worker.cargo || profile?.cargo || roleName || ""
    };
  }

  function knownWorkerCandidates() {
    const byName = new Map();
    function add(name, source, extra = {}) {
      const clean = String(name || "").trim().replace(/\s+/g, " ");
      if (!clean) return;
      const key = normalizeText(clean);
      if (!key || byName.has(key)) return;
      byName.set(key, enrichWorkerForLookup({ name: clean, source, ...extra }));
    }
    state.directory.workers.forEach(worker => add(worker.name, worker.source || "directory", worker));
    currentMessages().forEach(message => add(message.workerName, "live-message", { id: message.workerId || "" }));
    (state.summary?.people || state.summary?.liveLearning?.people || []).forEach(person => {
      (person.workers || []).forEach(worker => add(worker.workerName || worker.name, "learned-history", worker));
    });
    return [...byName.values()];
  }

  function bestKnownWorkerMatch(value) {
    const normalized = normalizeText(value);
    const inputTokens = nameTokens(value);
    if (inputTokens.length < 2) return { worker: null, score: 0, ambiguous: 0, reason: "nome incompleto" };
    let best = { worker: null, score: 0, ambiguous: 0, reason: "" };
    for (const worker of knownWorkerCandidates()) {
      const workerNormalized = normalizeText(worker.name);
      const workerTokens = nameTokens(worker.name);
      if (workerTokens.length < 2) continue;
      const hits = inputTokens.filter(token => workerTokens.includes(token));
      let score = 0;
      if (workerNormalized === normalized) {
        score = 1;
      } else if (workerNormalized.includes(normalized) && inputTokens.length >= 2) {
        score = 0.94;
      } else if (hits.length >= 2 && hits.length === inputTokens.length) {
        score = Math.min(0.9, 0.68 + hits.length * 0.08);
      } else if (hits.length >= 2 && inputTokens.length > hits.length) {
        score = Math.min(0.86, 0.62 + hits.length * 0.1);
      } else if (hits.length >= 3) {
        score = 0.78;
      }
      if (score > best.score) {
        best = { worker, score, ambiguous: 0, reason: `${hits.length} token(s) do nome conferem` };
      }
    }
    if (best.score >= 0.72) {
      best.ambiguous = knownWorkerCandidates().filter(worker => {
        const workerTokens = nameTokens(worker.name);
        const hits = inputTokens.filter(token => workerTokens.includes(token));
        return hits.length >= 2;
      }).length;
    }
    return best;
  }

  function firstUsableField(record, keys) {
    if (!record || typeof record !== "object") return "";
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      const value = record[key];
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
    return "";
  }

  function workerVerificationFields(worker) {
    const fields = [];
    if (firstUsableField(worker, ["birthDate", "dataNascimento", "data_nascimento", "nascimento", "Data Nascimento"])) {
      fields.push("data de nascimento");
    }
    if (firstUsableField(worker, ["admissionDate", "dataAdmissao", "data_admissao", "admissao", "admissão", "Data Admissao", "Data Admissão"])) {
      fields.push("data de admissão");
    }
    if (firstUsableField(worker, ["place", "placeName", "posto", "postoAtual", "unidade", "local"])) {
      fields.push("posto");
    }
    if (firstUsableField(worker, ["role", "funcao", "função", "cargo", "jobFunction", "job_function"])) {
      fields.push("função");
    }
    return fields;
  }

  function availableVerificationText(worker) {
    const fields = workerVerificationFields(worker);
    if (!fields.length) return "";
    if (fields.length === 1) return fields[0];
    return `${fields.slice(0, -1).join(", ")} ou ${fields[fields.length - 1]}`;
  }

  function matchedWorkerFullName(worker) {
    return String(worker?.name || "").trim().replace(/\s+/g, " ");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  function compactPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.length > 4 ? `...${digits.slice(-4)}` : digits;
  }

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadChatMessages() {
    const rows = loadJson(CHAT_SESSION_KEY, []);
    state.chatMessages = Array.isArray(rows) ? rows.slice(-80) : [];
  }

  function saveChatMessages() {
    saveJson(CHAT_SESSION_KEY, state.chatMessages.slice(-80));
  }

  function appendChatMessage(role, text, meta = {}) {
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role,
      text: String(text || "").trim(),
      at: new Date().toISOString(),
      ...meta
    };
    state.chatMessages.push(row);
    state.chatMessages = state.chatMessages.slice(-80);
    saveChatMessages();
    renderChat();
    return row;
  }

  function updateChatMessage(id, patch = {}) {
    if (!id) return;
    state.chatMessages = state.chatMessages.map(row => row.id === id ? { ...row, ...patch } : row);
    saveChatMessages();
    renderChat();
  }

  function clearChatSession() {
    state.chatMessages = [];
    clearConversationState();
    state.lastDraft = null;
    state.aiDraftRunning = false;
    saveChatMessages();
    addLog("chat", "Conversa de teste reiniciada", { tone: "info" });
    render();
  }

  function loadLogs() {
    const logs = loadJson(TEST_LOG_KEY, []);
    state.logs = Array.isArray(logs) ? logs.slice(-MAX_LOGS) : [];
  }

  function saveLogs() {
    saveJson(TEST_LOG_KEY, state.logs.slice(-MAX_LOGS));
  }

  function addLog(type, title, details = {}) {
    const tone = details.tone || (type === "error" || type === "reject" ? "bad" : type === "warn" || type === "correct" ? "warn" : type === "approve" || type === "teach" ? "ok" : "info");
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      type,
      tone,
      title,
      details
    };
    state.logs.push(event);
    state.logs = state.logs.slice(-MAX_LOGS);
    saveLogs();
    renderLogs();
    return event;
  }

  function loadPendingLearning() {
    const queue = loadJson(TEST_FEEDBACK_QUEUE_KEY, []);
    return Array.isArray(queue) ? queue : [];
  }

  function savePendingLearning(queue) {
    saveJson(TEST_FEEDBACK_QUEUE_KEY, queue.slice(-500));
  }

  function loadRejectedPatterns() {
    const rows = loadJson(TEST_REJECTION_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveRejectedPatterns(rows) {
    saveJson(TEST_REJECTION_KEY, rows.slice(-1000));
  }

  function loadLearnedReplies() {
    const rows = loadJson(TEST_LEARNED_REPLY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveLearnedReplies(rows) {
    saveJson(TEST_LEARNED_REPLY_KEY, rows.slice(-1000));
  }

  function messageFingerprint(text) {
    return normalizeForKeyword(text).replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, "<date>").slice(0, 220);
  }

  function tokenSet(value) {
    const domainShortTokens = new Set(["rh", "vr", "va", "vt", "ft", "gm", "pix"]);
    return new Set(normalizeForKeyword(value).split(" ").filter(token => token.length >= 3 || domainShortTokens.has(token)));
  }

  function similarityScore(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);
    if (!a.size || !b.size) return 0;
    let hits = 0;
    a.forEach(token => { if (b.has(token)) hits += 1; });
    return hits / Math.max(a.size, b.size);
  }

  function rejectionFor(text, optionKey) {
    const fingerprint = messageFingerprint(text);
    if (!fingerprint || !optionKey) return null;
    return loadRejectedPatterns().find(row => row.fingerprint === fingerprint && row.rejectedOptionKey === optionKey) || null;
  }

  function learnedReplyFor(text, optionKey) {
    const fingerprint = messageFingerprint(text);
    const normalized = normalizeText(text);
    if (!fingerprint || !normalized) return null;
    const candidates = loadLearnedReplies()
      .filter(row => row.reply && (!optionKey || !row.optionKey || row.optionKey === optionKey))
      .map(row => {
        const exact = row.fingerprint === fingerprint;
        const score = exact ? 1 : similarityScore(normalized, row.normalizedText || row.messagePreview || row.fingerprint || "");
        return { ...row, score };
      })
      .filter(row => row.score >= 0.55)
      .sort((a, b) => b.score - a.score || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return candidates[0] || null;
  }

  function learnedContextForInput(text, optionKey) {
    const fingerprint = messageFingerprint(text);
    const normalized = normalizeText(text);
    if (!fingerprint || !normalized) return { accepted: [], rejected: [] };
    const accepted = loadLearnedReplies()
      .filter(row => row.reply && (!optionKey || !row.optionKey || row.optionKey === optionKey))
      .map(row => {
        const exact = row.fingerprint === fingerprint;
        const score = exact ? 1 : similarityScore(normalized, row.normalizedText || row.messagePreview || row.fingerprint || "");
        return { ...row, score };
      })
      .filter(row => row.score >= 0.55)
      .sort((a, b) => b.score - a.score || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 5)
      .map(row => ({
        optionKey: row.optionKey || "",
        optionTitle: row.optionTitle || "",
        reply: row.reply || "",
        messagePreview: row.messagePreview || "",
        action: row.action || "",
        source: row.source || "",
        score: row.score,
        count: Number(row.count || 1),
        updatedAt: row.updatedAt || ""
      }));
    const rejected = loadRejectedPatterns()
      .map(row => {
        const exact = row.fingerprint === fingerprint;
        const score = exact ? 1 : similarityScore(normalized, row.fingerprint || row.replacementText || "");
        return { ...row, score };
      })
      .filter(row => row.score >= 0.55 && (!optionKey || !row.rejectedOptionKey || row.rejectedOptionKey === optionKey))
      .sort((a, b) => b.score - a.score || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 3)
      .map(row => ({
        rejectedOptionKey: row.rejectedOptionKey || "",
        rejectedTitle: row.rejectedTitle || "",
        replacementText: row.replacementText || "",
        action: row.action || "",
        score: row.score,
        count: Number(row.count || 1),
        updatedAt: row.updatedAt || ""
      }));
    return { accepted, rejected };
  }

  function rememberLearnedReply(draft, action, correction) {
    const reply = String(correction || draft?.reply || "").trim();
    const messagePreview = String(draft?.messagePreview || "").trim();
    if (!draft || !reply || !messagePreview) return null;
    const fingerprint = messageFingerprint(messagePreview);
    if (!fingerprint) return null;
    const rows = loadLearnedReplies();
    const existing = rows.find(row => row.fingerprint === fingerprint && row.optionKey === draft.option.key);
    const next = {
      fingerprint,
      normalizedText: normalizeText(messagePreview),
      messagePreview,
      optionKey: draft.option.key,
      optionTitle: draft.option.title || draft.intent.label || draft.option.key,
      reply,
      action,
      confidence: draft.confidence,
      source: draft.source || "whatsappRH-test",
      count: Number(existing?.count || 0) + 1,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const merged = rows.filter(row => !(row.fingerprint === fingerprint && row.optionKey === draft.option.key));
    merged.push(next);
    saveLearnedReplies(merged);
    return next;
  }

  function rememberManualLearnedReply(question, answer, optionKey, optionTitle) {
    const messagePreview = String(question || "").trim();
    const reply = String(answer || "").trim();
    if (!messagePreview || !reply) return null;
    const key = String(optionKey || "general_request").trim() || "general_request";
    const fingerprint = messageFingerprint(messagePreview);
    if (!fingerprint) return null;
    const rows = loadLearnedReplies();
    const existing = rows.find(row => row.fingerprint === fingerprint && row.optionKey === key);
    const next = {
      fingerprint,
      normalizedText: normalizeText(messagePreview),
      messagePreview,
      optionKey: key,
      optionTitle: optionTitle || key,
      reply,
      action: "manual_info",
      confidence: 1,
      source: "whatsappRH-test-manual-info",
      count: Number(existing?.count || 0) + 1,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const merged = rows.filter(row => !(row.fingerprint === fingerprint && row.optionKey === key));
    merged.push(next);
    saveLearnedReplies(merged);
    return next;
  }

  function mergeLearnedReplyRows(rows, source = "cloud") {
    const current = loadLearnedReplies();
    let changed = false;
    for (const row of rows) {
      const reply = String(row.reply || row.customText || row.draftText || row.learnedReply?.reply || row.selectedTitle || "").trim();
      const messagePreview = String(row.messagePreview || row.originalText || row.text || "").trim();
      if (!reply || !messagePreview) continue;
      const optionKey = String(row.optionKey || row.selectedKey || "custom").trim();
      const fingerprint = messageFingerprint(messagePreview);
      if (!fingerprint) continue;
      const next = {
        fingerprint,
        normalizedText: normalizeText(messagePreview),
        messagePreview,
        optionKey,
        optionTitle: row.optionTitle || row.selectedTitle || optionKey,
        reply,
        action: row.reviewAction || row.action || "shared",
        confidence: Number(row.draftConfidence || row.confidence || 0),
        source,
        count: Number(row.count || 1),
        createdAt: row.createdAt || row.operatorAt || row.updatedAt || new Date().toISOString(),
        updatedAt: row.updatedAt || row.operatorAt || new Date().toISOString()
      };
      const existingIndex = current.findIndex(item => item.fingerprint === next.fingerprint && item.optionKey === next.optionKey);
      if (existingIndex >= 0) current[existingIndex] = { ...current[existingIndex], ...next, count: Math.max(Number(current[existingIndex].count || 1), next.count) };
      else current.push(next);
      changed = true;
    }
    if (changed) saveLearnedReplies(current);
    return changed;
  }

  function rememberRejectedPattern(draft, action, correction) {
    if (!draft?.messagePreview) return null;
    const fingerprint = messageFingerprint(draft.messagePreview);
    if (!fingerprint) return null;
    const rows = loadRejectedPatterns();
    const existing = rows.find(row => row.fingerprint === fingerprint && row.rejectedOptionKey === draft.option.key);
    const next = {
      fingerprint,
      rejectedOptionKey: draft.option.key,
      rejectedTitle: draft.option.title || draft.intent.label || draft.option.key,
      replacementText: correction || existing?.replacementText || "",
      action,
      count: Number(existing?.count || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    const merged = rows.filter(row => !(row.fingerprint === fingerprint && row.rejectedOptionKey === draft.option.key));
    merged.push(next);
    saveRejectedPatterns(merged);
    return next;
  }

  function draftLearningAllowed(draft, correction) {
    if (!draft) return { ok: false, reason: "sem rascunho" };
    if (correction) return { ok: true, reason: "correcao explicita do operador" };
    if (draft.review?.action !== "approve") return { ok: false, reason: "rascunho ainda nao aprovado nem corrigido" };
    if (!draft.quality?.passed) return { ok: false, reason: "qualidade do rascunho falhou" };
    if (draft.blockedByRejectedPattern) return { ok: false, reason: "padrao ja foi rejeitado antes" };
    if (draft.confidence < 0.74) return { ok: false, reason: "confianca baixa para aprendizado automatico" };
    return { ok: true, reason: "aprovado pelo operador" };
  }

  function messageFullText(message = {}) {
    return String(message.textFull || message.messageTextFull || message.fullText || message.text || "").trim();
  }

  function safeMessageText(message = {}) {
    const validation = message.messageDisplayValidation || message.displayValidation;
    if (validation && validation.validToShow === false) {
      return "[texto nao validado para exibicao neste snapshot]";
    }
    const text = messageFullText(message);
    if (text) return text;
    return message.hasMedia ? `[${message.mediaKind || message.messageType || "midia"}]` : "";
  }

  function messageTitle(message = {}) {
    const raw = String(message.workerName || message.contactName || message.groupSubject || "").trim();
    if (raw && !raw.includes("@")) return raw;
    return message.chatType === "group" ? "Mensagem de grupo RH" : "Contato RH";
  }

  function messageMeta(message = {}) {
    return [
      message.chatType === "group" ? "grupo" : "privado",
      compactPhone(message.fromPhone) ? `contato ${compactPhone(message.fromPhone)}` : "",
      formatDateTime(message.messageAt || message.receivedAt)
    ].filter(Boolean).join(" / ");
  }

  function validationText(message = {}) {
    const validation = message.messageDisplayValidation || message.displayValidation;
    if (!validation) return "";
    return [
      validation.validToShow ? "Texto validado para exibicao" : "Texto nao validado para exibicao",
      validation.why || "",
      validation.how || ""
    ].filter(Boolean).join(": ");
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  function applyLiveRhData(data, source) {
    state.health = data.runtime || null;
    state.summary = data.summary || data || null;
    state.dataSource = source || state.dataSource || "live";
    state.lastError = "";
    state.lastFetchedAt = new Date().toISOString();
    render();
  }

  function watchDirectoryCollection(db, collectionName, targetKey) {
    db.collection(collectionName).onSnapshot(snapshot => {
      state.directory[targetKey] = snapshot.docs.map(doc => ({ id: doc.id, source: "firestore", ...doc.data() }));
      render();
    }, error => console.warn("Leitura RH", collectionName, error));
  }

  function firestoreDateValue(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    if (typeof value === "string") return value;
    return "";
  }

  function watchFeedbackLearning(db) {
    db.collection("rh_ai_feedback_events").limit(200).onSnapshot(snapshot => {
      const rows = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          ...data,
          updatedAt: firestoreDateValue(data.updatedAt) || firestoreDateValue(data.createdAt) || data.operatorAt || "",
          createdAt: firestoreDateValue(data.createdAt) || data.operatorAt || ""
        };
      });
      if (mergeLearnedReplyRows(rows, "firestore-feedback")) {
        addLog("teach", "Aprendizado compartilhado carregado", {
          count: rows.length,
          activeLearning: loadLearnedReplies().length,
          tone: "ok"
        });
        render();
      }
    }, error => {
      if (state.sharedLearningErrorLogged) return;
      state.sharedLearningErrorLogged = true;
      addLog("warn", "Aprendizado compartilhado indisponível", {
        error: String(error.message || error),
        note: "O aprendizado local continua ativo neste navegador.",
        tone: "warn"
      });
    });
  }

  async function refreshLocalRhBridge() {
    if (!ENABLE_LOCAL_RH_FALLBACK) return false;
    try {
      const [summary, runtime] = await Promise.all([
        fetchJson(`${LOCAL_RH_BRIDGE_URL}/rh/status.json?days=90`),
        fetchJson(`${LOCAL_RH_BRIDGE_URL}/health`)
      ]);
      applyLiveRhData({ summary, runtime }, "bridge local");
      addLog("refresh", "Snapshot RH carregado pelo bridge local", {
        source: "local",
        messages: summary.totals?.messages || runtime.rhMessageCount || 0,
        attention: summary.totals?.attention || 0
      });
      return true;
    } catch (error) {
      state.lastError = "Bridge RH local indisponivel para fallback.";
      addLog("warn", "Fallback local indisponivel", { error: String(error.message || error), tone: "warn" });
      render();
      return false;
    }
  }

  async function refreshLiveRhOnce(db) {
    try {
      const snapshot = await db.collection("whatsapp_live").doc("rh").get();
      if (!snapshot.exists) {
        if (await refreshLocalRhBridge()) return;
        state.lastError = "Aguardando snapshot RH no Firestore cloud.";
        render();
        return;
      }
      applyLiveRhData(snapshot.data() || {}, "Firestore live");
    } catch (error) {
      if (await refreshLocalRhBridge()) return;
      state.lastError = "Nao foi possivel atualizar o snapshot RH no Firestore.";
      addLog("error", "Falha ao atualizar snapshot RH", { error: String(error.message || error), tone: "bad" });
      render();
    }
  }

  function watchLiveRh(db) {
    db.collection("whatsapp_live").doc("rh").onSnapshot(snapshot => {
      if (!snapshot.exists) {
        if (ENABLE_LOCAL_RH_FALLBACK) refreshLocalRhBridge();
        else {
          state.lastError = "Aguardando snapshot RH no Firestore cloud.";
          render();
        }
        return;
      }
      applyLiveRhData(snapshot.data() || {}, "Firestore live");
    }, () => {
      if (ENABLE_LOCAL_RH_FALLBACK) refreshLocalRhBridge();
      else {
        state.lastError = "Firestore RH indisponivel no momento.";
        render();
      }
    });
    refreshLiveRhOnce(db);
    setInterval(() => refreshLiveRhOnce(db), 30000);
  }

  function connectFirestore() {
    if (!window.firebase || !window.RH_FIREBASE_CONFIG) {
      state.lastError = "Configuracao Firebase ainda nao carregou.";
      render();
      if (ENABLE_LOCAL_RH_FALLBACK) refreshLocalRhBridge();
      return;
    }
    try {
      const app = firebase.apps.find(item => item.name === "whatsapp-rh-test") || firebase.initializeApp(window.RH_FIREBASE_CONFIG, "whatsapp-rh-test");
      const db = app.firestore();
      state.aiDb = db;
      watchDirectoryCollection(db, "workers", "workers");
      watchDirectoryCollection(db, "places", "places");
      watchDirectoryCollection(db, "worker_profiles", "profiles");
      watchDirectoryCollection(db, "job_functions", "jobFunctions");
      watchFeedbackLearning(db);
      watchLiveRh(db);
    } catch (error) {
      state.lastError = ENABLE_LOCAL_RH_FALLBACK
        ? "Conexao Firestore indisponivel; tentando bridge local."
        : "Conexao Firestore indisponivel no modo cloud.";
      addLog("warn", "Firestore indisponivel", { error: String(error.message || error), tone: "warn" });
      if (ENABLE_LOCAL_RH_FALLBACK) refreshLocalRhBridge();
    }
  }

  function currentMessages() {
    const summary = state.summary || {};
    const rows = [
      ...(summary.attentionQueue || []),
      ...(summary.candidates || []),
      ...(summary.recentMessages || [])
    ];
    const seen = new Set();
    return rows.filter(message => {
      const key = message.id || `${message.fromPhone || ""}:${message.messageAt || message.receivedAt || ""}:${messageFullText(message).slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function selectedMessage() {
    if (!state.selectedMessageId) return null;
    return currentMessages().find(message => message.id === state.selectedMessageId) || null;
  }

  function activeCatalog() {
    const study = state.summary?.responseStudy || {};
    const dynamic = [
      ...(Array.isArray(study.optionCatalog) ? study.optionCatalog : []),
      ...(Array.isArray(study.nextOptions) ? study.nextOptions : [])
    ];
    const fallbackByKey = new Map(fallbackOptions.map(option => [option.key, option]));
    const byKey = new Map();
    dynamic.forEach(option => {
      const key = option.key || option.intent || option.title;
      if (!key || byKey.has(key)) return;
      const fallback = fallbackByKey.get(key) || {};
      byKey.set(key, {
        ...fallback,
        ...option,
        starterReply: option.starterReply || fallback.starterReply || fallback.prompt || ""
      });
    });
    fallbackOptions.forEach(option => {
      const key = option.key || option.intent || option.title;
      if (!key || byKey.has(key)) return;
      byKey.set(key, { ...option, starterReply: option.starterReply || option.prompt || "" });
    });
    return [...byKey.values()];
  }

  function optionByKey(key) {
    return activeCatalog().find(option => option.key === key) || fallbackOptions.find(option => option.key === key) || fallbackOptions[0];
  }

  function detectAudience(text, sourceMessage) {
    const normalized = normalizeText(text);
    const workerMatch = bestKnownWorkerMatch(text);
    const studyAudience = sourceMessage?.responseStudy?.audience;
    if (studyAudience?.key && studyAudience.key !== "unknown") {
      return {
        key: studyAudience.key,
        label: studyAudience.label || studyAudience.key,
        confidence: 0.9,
        evidence: ["audiencia vinda do responseStudy live"]
      };
    }
    if (workerMatch.score >= 0.72) {
      return {
        key: "active_employee",
        label: "Funcionário provável",
        confidence: Math.min(0.96, workerMatch.score),
        evidence: [`nome encontrado no RH: ${workerMatch.worker.name}`],
        workerMatch
      };
    }
    const candidateHits = keywordHits(normalized, intentLexicon.candidate);
    if (candidateHits.length) {
      return { key: "candidate", label: "Curriculo / candidato", confidence: Math.min(0.9, 0.76 + candidateHits.length * 0.04), evidence: candidateHits.map(hit => `termo: ${hit}`) };
    }
    const formerHits = keywordHits(normalized, intentLexicon.termination);
    if (formerHits.length) {
      return { key: "former_employee", label: "Ex-funcionario", confidence: Math.min(0.9, 0.72 + formerHits.length * 0.04), evidence: formerHits.map(hit => `termo: ${hit}`) };
    }
    const employeeHits = keywordHits(normalized, [
      ...intentLexicon.identity,
      ...intentLexicon.payslip,
      ...intentLexicon.benefit,
      ...intentLexicon.gympass,
      ...intentLexicon.ft,
      ...intentLexicon.vacation,
      ...intentLexicon.payroll,
      ...intentLexicon.cct,
      ...intentLexicon.medical,
      ...intentLexicon.schedule,
      ...intentLexicon.document,
      ...intentLexicon.uniform
    ]);
    if (employeeHits.length) {
      return { key: "active_employee", label: "Funcionário provável", confidence: Math.min(0.86, 0.66 + employeeHits.length * 0.03), evidence: employeeHits.slice(0, 4).map(hit => `termo: ${hit}`) };
    }
    return { key: "unknown", label: "Nao identificado", confidence: 0.46, evidence: ["sem sinais suficientes"] };
  }

  function detectIntent(text, sourceMessage) {
    const normalized = normalizeText(text);
    const studyOptions = sourceMessage?.responseStudy?.options || [];
    const workerMatch = bestKnownWorkerMatch(text);
    let best = null;
    for (const rule of keywordRules) {
      const hits = keywordHits(normalized, rule.words);
      if (!hits.length) continue;
      const score = Math.min(0.94, 0.58 + hits.length * 0.08 + Number(rule.priority || 0) / 1000);
      if (!best || score > best.confidence || (score === best.confidence && Number(rule.priority || 0) > Number(best.priority || 0))) {
        best = {
          intent: rule.intent,
          optionKey: rule.key,
          label: rule.label,
          confidence: score,
          priority: rule.priority || 0,
          evidence: hits.map(hit => `termo: ${hit}`)
        };
      }
    }
    if (best) return best;
    if (workerMatch.score >= 0.72 || looksLikeStandaloneName(text)) {
      return {
        intent: "identity",
        optionKey: "identity_verification",
        label: workerMatch.score >= 0.72 ? "Nome identificado" : "Nome informado",
        confidence: workerMatch.score >= 0.72 ? Math.min(0.96, workerMatch.score) : 0.74,
        evidence: [workerMatch.score >= 0.72 ? `nome encontrado no RH: ${workerMatch.worker.name}` : "texto parece ser nome e sobrenome"]
      };
    }
    if (studyOptions.length && studyOptions[0]?.key) {
      const top = studyOptions[0];
      const generic = ["identity_verification", "rh_handoff", "general_request"].includes(top.key);
      if (!generic || !normalized) {
        return {
          intent: top.key,
          optionKey: top.key,
          label: top.title || top.key,
          confidence: Math.max(0.68, Math.min(0.9, Number(top.confidence || 0.78))),
          evidence: ["opcao principal do responseStudy live"]
        };
      }
    }
    return {
      intent: "identity",
      optionKey: "identity_verification",
      label: "Validar identidade",
      confidence: normalized.length ? 0.55 : 0.2,
      evidence: normalized.length ? ["sem intent claro; iniciar por identificacao"] : ["mensagem vazia"]
    };
  }

  function extractFacts(text) {
    const normalized = normalizeForKeyword(text);
    const workerMatch = bestKnownWorkerMatch(text);
    const matchedWorker = workerMatch.score >= 0.72 ? workerMatch.worker : null;
    const knownPlace = firstUsableField(matchedWorker, ["placeName", "place", "posto", "postoAtual", "unidade", "local"]);
    const knownRole = firstUsableField(matchedWorker, ["roleName", "role", "funcao", "função", "cargo", "jobFunction", "job_function"]);
    const explicitName = /\b(meu nome e|me chamo|sou o|sou a|aqui e)\s+([a-z]{3,}(?:\s+[a-z]{2,}){1,4})\b/.exec(normalized);
    const standaloneName = looksLikeStandaloneName(text);
    const hasName = Boolean(explicitName) || standaloneName || workerMatch.score >= 0.72;
    const hasDate = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(normalized);
    const hasMonth = /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{1,2}\/\d{4})\b/.test(normalized);
    const hasPost = /\b(posto|condominio|condominio|obra|base|shopping|hospital|empresa|cjn|coes|coeva|taubate|sjc|unidade|portaria)\b/.test(normalized);
    const hasBenefitKind = keywordHits(normalized, [...intentLexicon.benefit, ...intentLexicon.gympass]).length > 0;
    const hasPix = keywordHits(normalized, ["pix", "chave pix", "chave"]).length > 0;
    const hasRole = keywordHits(normalized, ["controlador", "controlador de acesso", "porteiro", "vigilante", "vigia", "fiscal", "fiscal de piso", "limpeza", "auxiliar de servicos gerais", "auxiliar de manutencao", "operador de monitoramento", "agente", "supervisor", "recepcao", "portaria"]).length > 0;
    let hasPeriod = hasDate || hasMonth || /\b(hoje|ontem|amanha|semana|quinzena|mes|periodo|diurno|noturno|manha|tarde|noite|dia|data|turno)\b/.test(normalized);
    const hasScheduleHour = /\b\d{1,2}h|\b\d{1,2}:\d{2}\b|manha|tarde|noite|turno\b/.test(normalized);
    const hasCity = /\b(cidade|taubate|sjc|sao jose|sao jose dos campos|cacapava|tremembe|pindamonhangaba|guaratingueta|jacarei|lorena|cruzeiro)\b/.test(normalized);
    const hasCurriculum = /\b(curriculo|cv|anexo|experiencia|curso de vigilante|cnv)\b/.test(normalized);
    const hasDocumentRequest = /\b(declaracao|documento|aso|contrato|carta|fgts|rg|cpf|ctps|comprovante|espelho de ponto)\b/.test(normalized);
    const hasUniformItem = /\b(uniforme|cracha|colete|radio|equipamento|botina|camisa|calca|farda|epi)\b/.test(normalized);
    const hasProof = /\b(atestado|comprovante|anexo|foto|arquivo|pdf)\b/.test(normalized);
    const hasTerminationSubject = /\b(rescisao|homologacao|fgts|baixa|seguro desemprego|aviso previo)\b/.test(normalized);
    const asksValue = keywordHits(normalized, intentLexicon.cct).length > 0 || /\b(valor|quanto|piso|salario|cct|periculosidade|plr|cesta|assiduidade)\b/.test(normalized);
    const asksPayment = keywordHits(normalized, intentLexicon.payroll).length > 0;
    const exploratoryValueComparison = isExploratoryValueComparison(normalized);
    const greetingHits = keywordHits(normalized, intentLexicon.greeting);
    const nonGreetingHits = keywordRules
      .filter(rule => !["greeting", "acknowledgement"].includes(rule.intent))
      .some(rule => keywordHits(normalized, rule.words).length);
    const greetingOnly = normalized.length > 0 && greetingHits.length > 0 && !nonGreetingHits && normalized.split(" ").length <= 5;
    if (greetingOnly) hasPeriod = false;
    return {
      normalized,
      workerMatch,
      matchedWorker,
      knownPlace,
      knownRole,
      hasKnownPost: Boolean(knownPlace),
      hasKnownRole: Boolean(knownRole),
      standaloneName,
      hasName,
      hasDate,
      hasMonth,
      hasPost,
      hasBenefitKind,
      hasPix,
      hasRole,
      hasPeriod,
      hasScheduleHour,
      hasCity,
      hasCurriculum,
      hasDocumentRequest,
      hasUniformItem,
      hasProof,
      hasTerminationSubject,
      asksValue,
      asksPayment,
      exploratoryValueComparison,
      greetingOnly
    };
  }

  const requiredFieldRules = {
    identity_verification: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "tipo de vinculo com a TKA", ok: (_facts, audience) => audience.key !== "unknown" }
    ],
    benefit_cards: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "beneficio ou cartao", ok: facts => facts.hasBenefitKind },
      { label: "periodo ou data do problema", ok: facts => facts.hasPeriod }
    ],
    gympass: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "vínculo com a TKA", ok: (_facts, audience) => audience.key !== "unknown" }
    ],
    ft_payment: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "data da FT", ok: facts => facts.hasDate },
      { label: "periodo do turno", ok: facts => facts.hasPeriod },
      { label: "PIX para conferencia", ok: facts => facts.hasPix, when: facts => facts.asksPayment }
    ],
    payroll_payment: [
      { label: "competencia ou data", ok: facts => facts.hasPeriod },
      { label: "tipo de pagamento ou desconto", ok: facts => facts.asksPayment || facts.asksValue },
      { label: "nome e sobrenome", ok: facts => facts.hasName }
    ],
    cct_values: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "funcao", ok: facts => facts.hasRole || facts.hasKnownRole },
      { label: "valor ou beneficio a conferir", ok: facts => facts.asksValue || facts.hasBenefitKind }
    ],
    payslip: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "mes ou competencia", ok: facts => facts.hasMonth }
    ],
    candidate_intake: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "cidade", ok: facts => facts.hasCity },
      { label: "funcao desejada", ok: facts => facts.hasRole },
      { label: "curriculo", ok: facts => facts.hasCurriculum }
    ],
    vacation: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "periodo desejado", ok: facts => facts.hasPeriod }
    ],
    schedule: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "data", ok: facts => facts.hasDate || /\b(hoje|amanha|ontem)\b/.test(facts.normalized) },
      { label: "horario", ok: facts => facts.hasScheduleHour }
    ],
    document: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "documento solicitado", ok: facts => facts.hasDocumentRequest }
    ],
    uniform_equipment: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "item necessario", ok: facts => facts.hasUniformItem }
    ],
    medical_certificate: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "horario afetado", ok: facts => facts.hasPeriod },
      { label: "comprovante ou atestado", ok: facts => facts.hasProof }
    ],
    termination: [
      { label: "nome e sobrenome", ok: facts => facts.hasName },
      { label: "assunto da rescisao", ok: facts => facts.hasTerminationSubject }
    ],
    rh_handoff: [
      { label: "assunto", ok: facts => facts.normalized.length > 12 },
      { label: "nome e sobrenome", ok: facts => facts.hasName }
    ],
    general_request: [
      { label: "assunto", ok: facts => facts.normalized.length > 12 }
    ]
  };

  function missingFieldHints(option, text, audience, facts = extractFacts(text)) {
    const optionKey = option.key || "general_request";
    const rules = requiredFieldRules[optionKey] || requiredFieldRules.general_request;
    const missing = [];
    for (const rule of rules) {
      if (rule.when && !rule.when(facts, audience)) continue;
      if (!rule.ok(facts, audience)) missing.push(rule.label);
    }
    if (audience.key === "unknown" && optionKey === "identity_verification" && !missing.includes("tipo de vinculo com a TKA")) missing.unshift("tipo de vinculo com a TKA");
    return missing.slice(0, 6);
  }

  function missingListText(missing) {
    const displayMissing = missing.map(fieldWithExample);
    if (!displayMissing.length) return "";
    if (displayMissing.length === 1) return displayMissing[0];
    return `${displayMissing.slice(0, -1).join(", ")} e ${displayMissing[displayMissing.length - 1]}`;
  }

  const continuationExamples = {
    identity_verification: [
      "funcionario - Joao Silva",
      "ex-funcionario - Maria Souza",
      "curriculo - Ana Santos"
    ],
    benefit_cards: [
      "Joao Silva, posto Ruda, VR nao caiu desde 10/06",
      "Maria Souza, posto BKM, perdi o cartao VA",
      "Waldir Moura, VT do cartao nao carregou"
    ],
    payslip: [
      "Joao Silva, holerite de maio",
      "Maria Souza, preciso do olerite de 05/2026"
    ],
    ft_payment: [
      "Joao Silva, posto CJN, FT do dia 12 no turno noturno",
      "Maria Souza, folga trabalhada de 10/06 nao caiu"
    ],
    payroll_payment: [
      "Joao Silva, desconto do salario de maio/2026",
      "Maria Souza, pagamento de 05/06/2026 veio diferente"
    ],
    cct_values: [
      "Joao Silva, quero conferir o piso de vigilante",
      "Maria Souza, duvida sobre periculosidade de maio/2026"
    ],
    schedule: [
      "Joao Silva, posto Ruda, escala de amanha as 06h",
      "Maria Souza, folga de 20/06 no posto BKM"
    ],
    medical_certificate: [
      "Joao Silva, posto CJN, atestado de hoje",
      "Maria Souza, vou atrasar no turno da noite e tenho comprovante"
    ],
    candidate_intake: [
      "Ana Santos, Sao Jose dos Campos, vigilante, tenho CNV",
      "Carlos Lima, Taubate, controlador de acesso, curriculo anexo"
    ],
    vacation: [
      "Joao Silva, quero consultar ferias de julho/2026",
      "Maria Souza, duvida sobre ferias do proximo mes"
    ],
    document: [
      "Joao Silva, preciso de declaracao de vinculo",
      "Maria Souza, preciso do ASO"
    ],
    uniform_equipment: [
      "Joao Silva, preciso de camisa G",
      "Maria Souza, preciso de cracha"
    ],
    termination: [
      "Maria Souza, FGTS da rescisao",
      "Joao Silva, duvida sobre baixa na carteira"
    ],
    general_request: [
      "Joao Silva, preciso falar com o RH",
      "Maria Souza, tenho uma duvida trabalhista"
    ]
  };

  function optionExamples(optionKey) {
    return continuationExamples[optionKey] || continuationExamples.general_request;
  }

  function appendResolutionQuestion(reply) {
    const text = String(reply || "").trim();
    if (!text || normalizeText(text).includes("sua duvida foi respondida")) return text;
    return `${text}\n\n${RESOLUTION_QUESTION}`;
  }

  function shouldAskResolutionConfirmation(draftLike) {
    if (!draftLike || draftLike.escalatedToRh || draftLike.clarification) return false;
    if (draftLike.missing?.length) return false;
    if (draftLike.risk && draftLike.risk.canAutoAnswer === false) return false;
    if (/\b(vou|sera|será)\s+(direcionar|encaminhar|repassar)|validacao do rh|validação do rh|validar pelo rh|conferencia do rh|conferência do rh/i.test(draftLike.reply || "")) return false;
    if (["identity_verification", "general_request", "rh_handoff", "conversation_closed"].includes(draftLike.optionKey || draftLike.option?.key || "")) return false;
    return true;
  }

  function resolutionAnswerFor(text, context) {
    if (!context?.awaitingResolutionConfirmation) return "";
    const normalized = normalizeForKeyword(text);
    if (/^(sim|s|respondida|respondeu|resolvido|resolveu|ok|okay|certo|obrigado|obrigada|valeu|vlw|isso|perfeito)(\s|$)/.test(normalized)) return "answered";
    if (/^(nao|n|negativo|ainda nao|nao respondeu|nao resolveu|tenho outra|outra duvida|mais uma|preciso de mais)(\s|$)/.test(normalized)) return "not_answered";
    return "";
  }

  function createConversationContext(seed = {}) {
    return {
      id: seed.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: seed.source || "typed-test",
      sourceMessageId: seed.sourceMessageId || "",
      createdAt: seed.createdAt || new Date().toISOString(),
      updatedAt: seed.updatedAt || new Date().toISOString(),
      turns: Number(seed.turns || 0),
      unclearAttempts: Number(seed.unclearAttempts || 0),
      lastOptionKey: seed.lastOptionKey || "",
      lastOptionTitle: seed.lastOptionTitle || "",
      lastInputPreview: seed.lastInputPreview || "",
      awaitingResolutionConfirmation: Boolean(seed.awaitingResolutionConfirmation),
      closed: Boolean(seed.closed),
      lastResolutionOptionKey: seed.lastResolutionOptionKey || "",
      lastResolutionQuestionAt: seed.lastResolutionQuestionAt || "",
      matchedWorkerName: seed.matchedWorkerName || "",
      workerId: seed.workerId || "",
      audienceKey: seed.audienceKey || "",
      audienceLabel: seed.audienceLabel || "",
      facts: seed.facts && typeof seed.facts === "object" ? { ...seed.facts } : {},
      gatheredFields: Array.isArray(seed.gatheredFields) ? seed.gatheredFields.slice(0, 30) : []
    };
  }

  function normalizeConversationContext(context) {
    return createConversationContext(context && typeof context === "object" ? context : {});
  }

  function cloneConversationContext(context) {
    return normalizeConversationContext(JSON.parse(JSON.stringify(normalizeConversationContext(context))));
  }

  function conversationContextForInput(context, sourceMessage, rawFacts) {
    let next = normalizeConversationContext(context);
    const sourceMessageId = sourceMessage?.id || "";
    if (sourceMessageId && next.sourceMessageId && next.sourceMessageId !== sourceMessageId) {
      next = createConversationContext({ source: "live-message", sourceMessageId });
    }
    const matchedName = rawFacts?.workerMatch?.score >= 0.72 ? matchedWorkerFullName(rawFacts.workerMatch.worker) : "";
    if (matchedName && next.matchedWorkerName && normalizeText(matchedName) !== normalizeText(next.matchedWorkerName)) {
      next = createConversationContext({ source: sourceMessage ? "live-message" : "typed-test", sourceMessageId });
    }
    next.source = sourceMessage ? "live-message" : "typed-test";
    if (sourceMessageId) next.sourceMessageId = sourceMessageId;
    return next;
  }

  function gatheredFactItemsFromFacts(facts) {
    const items = [];
    const matchedName = facts.workerMatch?.score >= 0.72 ? matchedWorkerFullName(facts.workerMatch.worker) : "";
    if (facts.hasName) items.push({ key: "name", label: "nome", value: matchedName || "informado" });
    if (facts.hasBenefitKind) items.push({ key: "benefit", label: "beneficio/cartao", value: "informado" });
    if (facts.hasDate) items.push({ key: "date", label: "data", value: "informada" });
    if (facts.hasMonth) items.push({ key: "competence", label: "competencia", value: "informada" });
    if (facts.hasPeriod) items.push({ key: "period", label: "periodo", value: "informado" });
    if (facts.hasPost || facts.hasKnownPost) items.push({ key: "place", label: "posto/local", value: facts.knownPlace || "informado" });
    if (facts.hasRole || facts.hasKnownRole) items.push({ key: "role", label: "funcao", value: facts.knownRole || "informada" });
    if (facts.hasPix) items.push({ key: "pix", label: "PIX", value: "informado" });
    if (facts.asksPayment) items.push({ key: "paymentTopic", label: "pagamento/desconto", value: "informado" });
    if (facts.asksValue) items.push({ key: "valueTopic", label: "valor/CCT", value: "informado" });
    if (facts.exploratoryValueComparison) items.push({ key: "restrictedComparison", label: "comparacao restrita", value: "informada" });
    if (facts.hasCity) items.push({ key: "city", label: "cidade", value: "informada" });
    if (facts.hasCurriculum) items.push({ key: "curriculum", label: "curriculo", value: "informado" });
    if (facts.hasDocumentRequest) items.push({ key: "document", label: "documento", value: "informado" });
    if (facts.hasUniformItem) items.push({ key: "uniformItem", label: "uniforme/equipamento", value: "informado" });
    if (facts.hasProof) items.push({ key: "proof", label: "comprovante/atestado", value: "informado" });
    if (facts.hasScheduleHour) items.push({ key: "hour", label: "horario", value: "informado" });
    if (facts.hasTerminationSubject) items.push({ key: "terminationSubject", label: "rescisao/FGTS", value: "informado" });
    return items.filter((item, index, rows) => rows.findIndex(row => row.key === item.key) === index);
  }

  function factItemsByKey(context) {
    const byKey = new Map();
    (context?.gatheredFields || []).forEach(item => {
      if (item?.key) byKey.set(item.key, item);
    });
    return byKey;
  }

  function applyConversationFacts(facts, context) {
    const next = { ...facts };
    const byKey = factItemsByKey(context);
    const has = key => byKey.has(key) || Boolean(context?.facts?.[key]);
    if (has("name") || context?.matchedWorkerName) {
      next.hasName = true;
      const storedName = context.matchedWorkerName || byKey.get("name")?.value || "";
      next.contextMatchedWorkerName = storedName && !["informado", "informada"].includes(storedName) ? storedName : "";
      if (next.contextMatchedWorkerName && (!next.workerMatch || Number(next.workerMatch.score || 0) < 0.72)) {
        next.workerMatch = {
          worker: { id: context.workerId || "", name: next.contextMatchedWorkerName },
          score: 0.91,
          ambiguous: 1,
          reason: "nome guardado na conversa"
        };
      }
    }
    if (has("benefit")) next.hasBenefitKind = true;
    if (has("date")) next.hasDate = true;
    if (has("competence")) next.hasMonth = true;
    if (has("period") || has("date") || has("competence")) next.hasPeriod = true;
    if (has("place")) {
      next.hasPost = true;
      next.hasKnownPost = true;
      next.knownPlace = next.knownPlace || byKey.get("place")?.value || "";
    }
    if (has("role")) {
      next.hasRole = true;
      next.hasKnownRole = true;
      next.knownRole = next.knownRole || byKey.get("role")?.value || "";
    }
    if (has("pix")) next.hasPix = true;
    if (has("paymentTopic")) next.asksPayment = true;
    if (has("valueTopic")) next.asksValue = true;
    if (has("restrictedComparison")) next.exploratoryValueComparison = true;
    if (has("city")) next.hasCity = true;
    if (has("curriculum")) next.hasCurriculum = true;
    if (has("document")) next.hasDocumentRequest = true;
    if (has("uniformItem")) next.hasUniformItem = true;
    if (has("proof")) next.hasProof = true;
    if (has("hour")) next.hasScheduleHour = true;
    if (has("terminationSubject")) next.hasTerminationSubject = true;
    return next;
  }

  function applyConversationAudience(audience, context, facts) {
    if (facts.hasName && (context?.matchedWorkerName || facts.contextMatchedWorkerName) && audience.key === "unknown") {
      return {
        key: "active_employee",
        label: "Funcionario provavel",
        confidence: Math.max(0.82, Number(audience.confidence || 0.46)),
        evidence: [...(audience.evidence || []), "nome reaproveitado da conversa"]
      };
    }
    if (audience.key !== "unknown" || !context?.audienceKey) return audience;
    return {
      key: context.audienceKey,
      label: context.audienceLabel || context.audienceKey,
      confidence: Math.max(0.72, Number(audience.confidence || 0.46)),
      evidence: [...(audience.evidence || []), "audiencia reaproveitada da conversa"]
    };
  }

  function countNewFactItems(context, items) {
    const byKey = factItemsByKey(context);
    return items.filter(item => item.key && !byKey.has(item.key) && !context?.facts?.[item.key]).length;
  }

  function shouldCountUnclearAttempt(draftLike, factItems, contextBefore, text) {
    const newFacts = countNewFactItems(contextBefore, factItems);
    const generic = ["identity_verification", "rh_handoff", "general_request"].includes(draftLike.optionKey || "");
    if (draftLike.clarification) return true;
    if (draftLike.audience?.key === "unknown" && draftLike.missing?.length && newFacts === 0) return true;
    if (generic && isLowInformationReply(text, draftLike.intent, draftLike.facts) && newFacts === 0) return true;
    return false;
  }

  function gatheredFieldsText(context, currentItems = []) {
    const byKey = factItemsByKey(context);
    currentItems.forEach(item => {
      if (item?.key && !byKey.has(item.key)) byKey.set(item.key, item);
    });
    return [...byKey.values()]
      .slice(0, 8)
      .map(item => `${item.label}${item.value && item.value !== "informado" && item.value !== "informada" ? `: ${item.value}` : ""}`)
      .join(", ");
  }

  function handoffAfterMaxAttemptsReply(context, currentItems) {
    const gathered = gatheredFieldsText(context, currentItems);
    const already = gathered ? ` Nao precisa reenviar o que ja informou: ${gathered}.` : "";
    return `Ola! Depois de ${MAX_UNCLEAR_ATTEMPTS} tentativas, ainda nao ficou seguro para o atendimento automatico.${already} Vou direcionar para o RH humano assim que o RH estiver conectado. Se puder, envie uma unica mensagem com a duvida principal. Exemplo: desconto do salario de maio/2026.`;
  }

  function updateConversationContext(contextBefore, draft, factItems, unclearAttempt, projectedUnclearAttempts) {
    const next = normalizeConversationContext(contextBefore);
    const byKey = factItemsByKey(next);
    for (const item of factItems) {
      if (!item.key) continue;
      byKey.set(item.key, {
        ...byKey.get(item.key),
        ...item,
        updatedAt: new Date().toISOString()
      });
      next.facts[item.key] = item.value || true;
    }
    next.gatheredFields = [...byKey.values()].slice(-30);
    const matchedName = draft.facts?.workerMatch?.score >= 0.72 ? matchedWorkerFullName(draft.facts.workerMatch.worker) : draft.facts?.contextMatchedWorkerName || "";
    if (matchedName) {
      next.matchedWorkerName = matchedName;
      next.workerId = draft.facts?.workerMatch?.worker?.id || next.workerId || "";
      next.facts.name = matchedName;
    }
    if (draft.audience?.key && draft.audience.key !== "unknown") {
      next.audienceKey = draft.audience.key;
      next.audienceLabel = draft.audience.label || draft.audience.key;
    }
    next.turns += 1;
    next.unclearAttempts = unclearAttempt ? projectedUnclearAttempts : 0;
    next.lastOptionKey = draft.option?.key || "";
    next.lastOptionTitle = draft.option?.title || "";
    next.lastInputPreview = draft.messagePreview || "";
    if (draft.resolutionStatus === "answered") {
      next.awaitingResolutionConfirmation = false;
      next.closed = true;
    } else if (draft.resolutionStatus === "not_answered") {
      next.awaitingResolutionConfirmation = false;
      next.closed = false;
    } else {
      next.awaitingResolutionConfirmation = Boolean(draft.resolutionQuestionAsked);
      if (draft.resolutionQuestionAsked) {
        next.lastResolutionOptionKey = draft.option?.key || "";
        next.lastResolutionQuestionAt = new Date().toISOString();
      }
      next.closed = false;
    }
    next.source = draft.source || next.source;
    next.sourceMessageId = draft.sourceMessageId || next.sourceMessageId || "";
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function compactConversationContext(context) {
    const current = normalizeConversationContext(context);
    return {
      id: current.id,
      source: current.source,
      sourceMessageId: current.sourceMessageId,
      turns: current.turns,
      unclearAttempts: current.unclearAttempts,
      maxUnclearAttempts: MAX_UNCLEAR_ATTEMPTS,
      awaitingResolutionConfirmation: Boolean(current.awaitingResolutionConfirmation),
      closed: Boolean(current.closed),
      lastResolutionOptionKey: current.lastResolutionOptionKey || "",
      matchedWorkerName: current.matchedWorkerName,
      audienceKey: current.audienceKey,
      lastOptionKey: current.lastOptionKey,
      gatheredFields: current.gatheredFields.slice(0, 12).map(item => ({
        key: item.key,
        label: item.label,
        value: item.value || ""
      }))
    };
  }

  function saveConversationState() {
    if (!state.conversationContext && !state.pendingQuestion) {
      localStorage.removeItem(CONVERSATION_STATE_KEY);
      return;
    }
    saveJson(CONVERSATION_STATE_KEY, {
      updatedAt: new Date().toISOString(),
      sourceMode: state.sourceMode || "typed",
      selectedMessageId: state.selectedMessageId || "",
      chatCount: state.chatMessages.length,
      pendingQuestion: state.pendingQuestion || null,
      conversationContext: state.conversationContext ? normalizeConversationContext(state.conversationContext) : null
    });
  }

  function loadConversationState() {
    const saved = loadJson(CONVERSATION_STATE_KEY, null);
    if (!saved || typeof saved !== "object") return;
    const sameSourceMode = !saved.sourceMode || saved.sourceMode === state.sourceMode;
    const sameLiveMessage = state.sourceMode !== "live" || !saved.selectedMessageId || saved.selectedMessageId === state.selectedMessageId;
    if (!sameSourceMode || !sameLiveMessage) return;
    state.pendingQuestion = saved.pendingQuestion || null;
    state.conversationContext = saved.conversationContext ? normalizeConversationContext(saved.conversationContext) : null;
  }

  function clearConversationState() {
    state.pendingQuestion = null;
    state.conversationContext = null;
    localStorage.removeItem(CONVERSATION_STATE_KEY);
  }

  function isLowInformationReply(text, intent, facts) {
    const normalized = facts?.normalized ?? normalizeText(text);
    if (!normalized) return true;
    const substantive = facts.hasName || facts.hasDate || facts.hasMonth || facts.hasPost || facts.hasBenefitKind ||
      facts.hasPix || facts.hasRole || facts.hasPeriod || facts.asksValue || facts.asksPayment ||
      facts.hasCity || facts.hasCurriculum || facts.hasDocumentRequest || facts.hasUniformItem ||
      facts.hasProof || facts.hasScheduleHour || facts.hasTerminationSubject || facts.exploratoryValueComparison ||
      /\b(curriculo|cv|holerite|olerite|atestado|comprovante|uniforme|cracha|fgts|rescisao|ferias|escala|folga|vr|va|vt|cartao|gympass|wellhub|pix)\b/.test(normalized);
    if (substantive) return false;
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length <= 4 && /\b(sim|nao|n|ok|certo|ta|tudo bem|entendi|pode|isso|nao sei|n sei|sei la|obrigado|obrigada|valeu)\b/.test(normalized)) return true;
    return Number(intent?.confidence || 0) < 0.6 && ["identity_verification", "rh_handoff", "general_request"].includes(intent?.optionKey || "");
  }

  function pendingQuestionApplies(pending, sourceMessage) {
    if (!pending?.optionKey) return null;
    const sourceMessageId = sourceMessage?.id || "";
    if (pending.sourceMessageId && pending.sourceMessageId !== sourceMessageId) return null;
    return pending;
  }

  function shouldUsePendingQuestion(text, pending, audience, intent, facts) {
    if (!pending?.optionKey) return false;
    const optionKey = intent?.optionKey || "";
    const strongNewTopic = optionKey && optionKey !== pending.optionKey &&
      !["identity_verification", "rh_handoff", "general_request"].includes(optionKey) &&
      Number(intent.confidence || 0) >= 0.68;
    if (strongNewTopic) return false;
    if (isLowInformationReply(text, intent, facts)) return true;
    if (pending.optionKey !== "identity_verification" && optionKey === "identity_verification" && facts.hasName) return true;
    if (pending.matchedWorkerName && ["identity_verification", "rh_handoff", "general_request"].includes(optionKey)) return true;
    return audience.key === "unknown" && ["identity_verification", "rh_handoff", "general_request"].includes(optionKey);
  }

  function pendingAudience(pending, fallbackAudience) {
    if (!pending?.audienceKey || fallbackAudience.key !== "unknown") return fallbackAudience;
    return {
      key: pending.audienceKey,
      label: pending.audienceLabel || pending.audienceKey,
      confidence: Math.max(0.72, Number(fallbackAudience.confidence || 0.46)),
      evidence: [...(fallbackAudience.evidence || []), "continuidade da pergunta anterior"]
    };
  }

  function removeSatisfiedByPendingIdentity(missing, pending) {
    if (!pending?.matchedWorkerName) return missing;
    return missing.filter(field => field !== "nome e sobrenome" && field !== "nome completo");
  }

  function clarificationReplyForOption(option, pending, missing) {
    const optionKey = option.key || pending?.optionKey || "general_request";
    const expected = missing.length ? missing : (pending?.expectedFields || []);
    const missingText = missingRequestText(expected, optionExamples(optionKey)[0], true, optionKey);
    if (optionKey === "identity_verification" && pending?.matchedWorkerName) {
      return `Ola! Para continuar com ${pending.matchedWorkerName}, ainda preciso da duvida. ${missingRequestText(["assunto"], "", true, "identity_verification")}`;
    }
    if (optionKey === "identity_verification") {
      return `Ola! Nao consegui confirmar sua resposta.${missingText || ` ${RH_DIRECT_SUBJECT_PROMPT}`}`;
    }
    const rhValidation = ["payroll_payment", "cct_values", "termination"].includes(optionKey)
      ? " Se nao for possivel resolver por aqui com seguranca, encaminho para um especialista do RH."
      : "";
    return `Ola! Vou manter o mesmo assunto: ${option.title || "atendimento RH"}.${missingText || ` ${RH_DIRECT_SUBJECT_PROMPT}`}${rhValidation}`;
  }

  function pendingQuestionFromDraft(draft) {
    if (!draft?.option?.key) return null;
    let expectedFields = [...(draft.missing || [])];
    const matchedWorkerName = draft.facts?.workerMatch?.score >= 0.72
      ? matchedWorkerFullName(draft.facts.workerMatch.worker)
      : "";
    if (draft.option.key === "identity_verification" && matchedWorkerName && !expectedFields.includes("assunto")) {
      expectedFields = ["assunto"];
    }
    if (!expectedFields.length) return null;
    return {
      optionKey: draft.option.key,
      optionTitle: draft.option.title,
      expectedFields,
      sourceMessageId: draft.sourceMessageId || "",
      audienceKey: matchedWorkerName ? "active_employee" : draft.audience?.key || "",
      audienceLabel: matchedWorkerName ? "Funcionario provavel" : draft.audience?.label || "",
      matchedWorkerName,
      createdAt: new Date().toISOString()
    };
  }

  function riskProfile(optionKey, facts, audience, missing) {
    const manualKeys = new Set(["cct_values", "payroll_payment", "termination"]);
    const assistedKeys = new Set(["ft_payment", "vacation", "medical_certificate", "schedule", "document"]);
    if (facts.exploratoryValueComparison) {
      return {
        level: "manual_review",
        label: "Restrito ao RH",
        canAutoAnswer: false,
        reason: "comparacao de valor, extra, pagamento ou beneficio nao deve ser debatida pelo atendimento automatico"
      };
    }
    if (manualKeys.has(optionKey) || facts.asksValue) {
      return {
        level: "manual_review",
        label: "Revisao RH obrigatoria",
        canAutoAnswer: false,
        reason: "envolve valores, CCT, pagamento individual, rescisao ou decisao sensivel"
      };
    }
    if (assistedKeys.has(optionKey)) {
      return {
        level: "assisted",
        label: "Assistido pelo RH",
        canAutoAnswer: false,
        reason: "pode coletar dados, mas fechamento depende de validacao humana"
      };
    }
    if (audience.key === "unknown" || missing.length) {
      return {
        level: "safe_routine",
        label: "Rotina segura de coleta",
        canAutoAnswer: true,
        reason: "apenas pede identificacao ou dados faltantes, sem decidir o caso"
      };
    }
    return {
      level: "assisted_ready",
      label: "Pronto para conferencia",
      canAutoAnswer: false,
      reason: "resposta pronta para revisao final antes de qualquer envio real"
    };
  }

  function replyForOption(optionKey, audience, facts, missing, context = {}) {
    const missingText = missingListText(missing);
    if (facts.exploratoryValueComparison) {
      return "Ola! Entendi. Comparacao de valor, extra, pagamento ou beneficio precisa de conferencia de um especialista do RH. Envie somente sua duvida atual com nome, competencia ou data, e o item exato a conferir. Exemplo: Joao Silva, FT do dia 12/06 veio com valor diferente.";
    }
    const matchedName = facts.workerMatch?.score >= 0.72
      ? matchedWorkerFullName(facts.workerMatch.worker)
      : (context.conversation?.matchedWorkerName || facts.contextMatchedWorkerName || context.pending?.matchedWorkerName || "");
    const personPrefix = matchedName ? ` Encontrei o cadastro de ${matchedName}.` : "";
    const sameSubject = context.continuingPending ? " Vou manter este mesmo assunto e não voltar para o início." : "";
    const askMissing = (example, key = optionKey, includeExamples = false) => missing.length ? missingRequestText(missing, example, includeExamples, key) : "";
    if (facts.greetingOnly) {
      return RH_FIRST_MESSAGE;
    }
    if (audience.key === "unknown" && ["identity_verification", "rh_handoff", "general_request"].includes(optionKey)) {
      return `Ola! ${RH_DIRECT_SUBJECT_PROMPT}`;
    }
    switch (optionKey) {
      case "benefit_cards":
        return `Ola! Entendi.${personPrefix}${askMissing("Waldir Moura, VR do cartao Caju nao caiu desde 10/06", optionKey) || " Vou encaminhar para um especialista do RH conferir periodo e operadora antes de responder."}${sameSubject}`;
      case "gympass":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, acesso Wellhub nao liberou", optionKey) || " Vou encaminhar para um especialista do RH conferir o cadastro do beneficio."}${sameSubject}`;
      case "ft_payment":
        return `Ola! Vou tratar como FT.${personPrefix}${askMissing("Joao Silva, FT de 12/06 no turno noturno; se nao pagou, minha chave PIX e ...", optionKey) || " Vou encaminhar para um especialista do RH conferir data, turno e pagamento."}${sameSubject}`;
      case "payroll_payment":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, desconto do salario de junho", optionKey) || " Vou encaminhar para um especialista do RH conferir cadastro e competencia no sistema e te responder corretamente."}${sameSubject}`;
      case "cct_values":
        return `Ola! Esse caso depende de funcao, escala, faltas, ferias e convencao aplicavel.${personPrefix}${askMissing("Joao Silva, quero conferir o piso de vigilante", optionKey) || " Vou encaminhar para um especialista do RH conferir no sistema."}${sameSubject}`;
      case "payslip":
        return `Ola! Consigo ajudar com o pedido de holerite.${personPrefix}${askMissing("Joao Silva, holerite de maio", optionKey) || " Vou encaminhar para verificacao do mes solicitado."} Documento so deve ser enviado depois de confirmar o cadastro correto.${sameSubject}`;
      case "candidate_intake":
        return `Ola! Recebemos seu contato para oportunidade na TKA.${askMissing("Ana Santos, Sao Jose dos Campos, vigilante, curriculo anexo", optionKey) || " Vou encaminhar para triagem do RH."} O envio nao garante vaga ou entrevista, mas ajuda o RH a classificar corretamente.`;
      case "vacation":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, quero consultar ferias de julho", optionKey) || ""} Vou encaminhar para um especialista do RH conferir periodo aquisitivo/concessivo no sistema.${sameSubject}`;
      case "schedule":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, escala de amanha as 06h", optionKey) || ""} Vou conferir no Dashboard.${sameSubject}`;
      case "medical_certificate":
        return `Ola! Recebi a informacao.${personPrefix}${askMissing("Joao Silva, atestado de hoje em anexo", optionKey) || " Vou encaminhar para um especialista do RH registrar e conferir."}${sameSubject}`;
      case "document":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, declaracao de vinculo", optionKey) || " Vou localizar o documento correto com apoio de um especialista do RH."}${sameSubject}`;
      case "uniform_equipment":
        return `Ola! Entendi.${personPrefix}${askMissing("Joao Silva, preciso de camisa G e cracha", optionKey) || " Vou encaminhar para um especialista do RH verificar disponibilidade e registro."}${sameSubject}`;
      case "termination":
        return `Ola! Entendi.${askMissing("Maria Souza, FGTS da rescisao", optionKey) || ""} Vou encaminhar para um especialista do RH validar o cadastro de ex-funcionario.${sameSubject}`;
      case "identity_verification":
        if (facts.workerMatch?.score >= 0.72) {
          if (facts.workerMatch.ambiguous > 1 && facts.workerMatch.score < 1) {
            return "Ola! Encontrei mais de um cadastro parecido no RH. Envie mais um sobrenome ou outro detalhe do nome.";
          }
          const matchedName = matchedWorkerFullName(facts.workerMatch.worker);
          const contextHint = facts.hasMonth || facts.hasDate || facts.hasPeriod
            ? " Vi tambem uma data ou competencia na mensagem."
            : "";
          return `Ola! Encontrei o cadastro de ${matchedName}.${contextHint} Qual e sua duvida?`;
        }
        if (facts.hasName) {
          return `Obrigado pelo nome. Nao localizei um cadastro unico ainda. Envie mais um sobrenome e diga sua duvida.`;
        }
        if (audience.key === "active_employee") {
          return "Ola! Entendi. Informe seu nome e sobrenome e diga sua duvida.";
        }
        if (audience.key === "former_employee") {
          return "Ola! Entendi. Informe seu nome e sobrenome e diga sua duvida.";
        }
        if (audience.key === "candidate") {
          return "Ola! Entendi que voce quer falar sobre vaga ou curriculo. Informe seu nome e sobrenome, cidade, funcao desejada e disponibilidade.";
        }
        return `Ola! ${RH_DIRECT_SUBJECT_PROMPT}`;
      case "rh_handoff":
      case "general_request":
      default:
        return `Ola! Obrigado pelo contato.${personPrefix}${askMissing("Joao Silva, preciso falar sobre holerite", optionKey) || " Vou encaminhar para um especialista do RH verificar e retornar corretamente."}${sameSubject}`;
    }
  }

  function assessReplyQuality(reply, optionKey, risk, missing = []) {
    const normalized = normalizeText(reply);
    const warnings = [];
    if (/^(confirmar|pedir|orientar|tratar|usar|registrar|apos identificar|verificar)\b/.test(normalized)) {
      warnings.push("parece instrucao interna, nao mensagem pronta");
    }
    if (!/\b(ola|bom dia|boa tarde|boa noite|por gentileza|obrigado|obrigada)\b/.test(normalized)) {
      warnings.push("sem cordialidade inicial");
    }
    if (["payroll_payment", "cct_values", "termination"].includes(optionKey) && !missing.length && !/\brh\b/.test(normalized)) {
      warnings.push("caso sensivel sem encaminhamento explicito ao RH");
    }
    if (risk.level === "manual_review" && /promet/.test(normalized)) {
      warnings.push("nao pode prometer resultado em caso sensivel");
    }
    return {
      passed: warnings.length === 0,
      warnings
    };
  }

  function buildReply(option, audience, intent, missing, text, facts, pending, continuingPending, conversationContext) {
    return replyForOption(option.key || intent.optionKey || "general_request", audience, facts, missing, { pending, continuingPending, conversation: conversationContext });
  }

  function buildResolutionDraft(text, sourceMessage, conversationBefore, rawFacts, resolutionStatus) {
    const currentFactItems = gatheredFactItemsFromFacts(rawFacts);
    const previousOptionKey = conversationBefore.lastResolutionOptionKey || conversationBefore.lastOptionKey || "general_request";
    const positive = resolutionStatus === "answered";
    const reply = positive
      ? "Obrigado! Vou considerar sua duvida respondida e encerrar este atendimento automatico. Se precisar de outro assunto, envie uma nova mensagem com um exemplo claro."
      : "Ola! Tudo bem. Nao precisa reenviar o que ja informou. Diga apenas o que ainda falta ou qual e a nova duvida.";
    const option = {
      key: positive ? "conversation_closed" : previousOptionKey,
      title: positive ? "Conversa encerrada" : "Continuar duvida"
    };
    const risk = {
      level: "safe_routine",
      label: positive ? "Conversa encerrada" : "Continuar coleta",
      canAutoAnswer: true,
      reason: positive ? "usuario confirmou que a duvida foi respondida" : "usuario informou que ainda precisa continuar"
    };
    const quality = assessReplyQuality(reply, option.key, risk, missing);
    const draft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      source: sourceMessage ? "live-message" : "typed-test",
      sourceMessageId: sourceMessage?.id || "",
      messagePreview: text.slice(0, 320),
      audience: {
        key: conversationBefore.audienceKey || "unknown",
        label: conversationBefore.audienceLabel || "Contexto anterior",
        confidence: 0.86,
        evidence: ["resposta a pergunta de encerramento"]
      },
      intent: {
        intent: "resolution_confirmation",
        optionKey: option.key,
        label: positive ? "Duvida respondida" : "Duvida continua",
        confidence: 0.92,
        evidence: [positive ? "usuario confirmou encerramento" : "usuario pediu continuidade"]
      },
      option,
      missing: [],
      facts: rawFacts,
      risk,
      quality,
      confidence: 0.9,
      reply,
      clarification: false,
      unclearAttempt: false,
      unclearAttempts: 0,
      escalatedToRh: false,
      restricted: false,
      resolutionStatus,
      resolutionQuestionAsked: false,
      learnedReply: null,
      learnedContext: { accepted: [], rejected: [] },
      pendingQuestion: positive ? null : {
        optionKey: previousOptionKey,
        optionTitle: conversationBefore.lastOptionTitle || "Continuar duvida",
        expectedFields: ["o que ainda falta", "nova duvida com exemplo"],
        sourceMessageId: sourceMessage?.id || "",
        matchedWorkerName: conversationBefore.matchedWorkerName || ""
      },
      blockedByRejectedPattern: false,
      guardrail: positive
        ? "Conversa encerrada por confirmacao do usuario."
        : "Continua sem enviar WhatsApp automaticamente; aguarda nova informacao do usuario."
    };
    const conversationAfter = updateConversationContext(conversationBefore, draft, currentFactItems, false, 0);
    draft.gatheredFields = conversationAfter.gatheredFields.slice(0, 12);
    draft.conversationContext = compactConversationContext(conversationAfter);
    draft.conversationContextBefore = compactConversationContext(conversationBefore);
    draft.conversationContextState = conversationAfter;
    return draft;
  }

  function buildDraftForInput(text, sourceMessage = null, pendingQuestion = null, options = {}) {
    const rawFacts = extractFacts(text);
    let conversationBefore = conversationContextForInput(options.conversationContext || null, sourceMessage, rawFacts);
    const resolutionStatus = resolutionAnswerFor(text, conversationBefore);
    if (resolutionStatus) return buildResolutionDraft(text, sourceMessage, conversationBefore, rawFacts, resolutionStatus);
    if (conversationBefore.closed) conversationBefore = createConversationContext({ source: sourceMessage ? "live-message" : "typed-test", sourceMessageId: sourceMessage?.id || "" });
    const facts = applyConversationFacts(rawFacts, conversationBefore);
    let audience = applyConversationAudience(detectAudience(text, sourceMessage), conversationBefore, facts);
    let intent = detectIntent(text, sourceMessage);
    const pending = pendingQuestionApplies(pendingQuestion, sourceMessage);
    const continuingPending = shouldUsePendingQuestion(text, pending, audience, intent, rawFacts);
    if (continuingPending) {
      audience = pendingAudience(pending, audience);
      intent = {
        ...intent,
        intent: "pending_question",
        optionKey: pending.optionKey,
        label: `Continuidade: ${pending.optionTitle || pending.optionKey}`,
        confidence: Math.max(0.68, Number(intent.confidence || 0.5)),
        evidence: [...(intent.evidence || []), "mantida a pergunta anterior; resposta curta ou parcial"]
      };
    }
    let option = optionByKey(intent.optionKey);
    const learnedPattern = options.ignoreLearned ? null : learnedReplyFor(text, option.key || intent.optionKey);
    if (learnedPattern?.optionKey && learnedPattern.optionKey !== option.key) {
      option = optionByKey(learnedPattern.optionKey);
      intent.optionKey = option.key || learnedPattern.optionKey;
      intent.label = learnedPattern.optionTitle || intent.label;
      intent.evidence = [...(intent.evidence || []), "aprendizado aplicado de correção anterior"];
      intent.confidence = Math.max(Number(intent.confidence || 0), 0.82);
    }
    const rejectedPattern = rejectionFor(text, option.key || intent.optionKey);
    if (rejectedPattern) {
      option = optionByKey(rejectedPattern.replacementText ? "rh_handoff" : "identity_verification");
      intent.optionKey = option.key || "rh_handoff";
      intent.label = "Resposta anterior rejeitada";
      intent.confidence = Math.min(intent.confidence || 0.5, 0.52);
      intent.evidence = [...(intent.evidence || []), `padrao rejeitado antes: ${rejectedPattern.rejectedTitle || rejectedPattern.rejectedOptionKey}`];
    }
    const learnedContext = options.ignoreLearned ? { accepted: [], rejected: [] } : learnedContextForInput(text, option.key || intent.optionKey);
    const declaredAnswer = options.ignoreDeclared ? null : declaredAnswerFor(text, option.key || intent.optionKey, facts, audience);
    if (declaredAnswer) {
      option = optionByKey(declaredAnswer.optionKey || option.key || intent.optionKey);
      intent.optionKey = option.key || declaredAnswer.optionKey;
      intent.label = declaredAnswer.title || intent.label;
      intent.confidence = Math.max(Number(intent.confidence || 0), declaredAnswer.score || 0.86);
      intent.evidence = [...(intent.evidence || []), `resposta declarada: ${declaredAnswer.title}`];
    }
    const missing = removeSatisfiedByPendingIdentity(missingFieldHints(option, text, audience, facts), pending);
    let risk = riskProfile(option.key || intent.optionKey, facts, audience, missing);
    if (rejectedPattern) {
      risk.level = "manual_review";
      risk.label = "Revisao obrigatoria";
      risk.canAutoAnswer = false;
      risk.reason = "o mesmo padrao de mensagem ja recebeu correcao ou rejeicao do operador";
    }
    const clarification = Boolean(continuingPending && isLowInformationReply(text, intent, rawFacts));
    const currentFactItems = gatheredFactItemsFromFacts(rawFacts);
    const unclearAttempt = shouldCountUnclearAttempt({
      optionKey: option.key || intent.optionKey,
      audience,
      intent,
      facts: rawFacts,
      missing,
      clarification
    }, currentFactItems, conversationBefore, text);
    const projectedUnclearAttempts = unclearAttempt
      ? Math.min(MAX_UNCLEAR_ATTEMPTS, Number(conversationBefore.unclearAttempts || 0) + 1)
      : 0;
    const escalatedToRh = unclearAttempt && projectedUnclearAttempts >= MAX_UNCLEAR_ATTEMPTS;
    if (escalatedToRh) {
      risk = {
        level: "manual_review",
        label: "Encaminhar ao RH",
        canAutoAnswer: false,
        reason: `limite de ${MAX_UNCLEAR_ATTEMPTS} tentativas sem entendimento seguro; direcionar para atendimento humano`
      };
    }
    let reply = escalatedToRh
      ? handoffAfterMaxAttemptsReply(conversationBefore, currentFactItems)
      : learnedPattern?.reply || rejectedPattern?.replacementText || declaredAnswer?.reply || (clarification
        ? clarificationReplyForOption(option, pending, missing)
        : buildReply(option, audience, intent, missing, text, facts, pending, continuingPending, conversationBefore));
    let resolutionQuestionAsked = false;
    if (shouldAskResolutionConfirmation({
      optionKey: option.key || intent.optionKey,
      missing,
      clarification,
      escalatedToRh,
      reply,
      risk
    })) {
      reply = appendResolutionQuestion(reply);
      resolutionQuestionAsked = true;
    }
    const quality = assessReplyQuality(reply, option.key || intent.optionKey, risk, missing);
    const confidence = Math.round(((audience.confidence + intent.confidence + (quality.passed ? 0.92 : 0.7)) / 3) * 100) / 100;
    const draft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      source: sourceMessage ? "live-message" : "typed-test",
      sourceMessageId: sourceMessage?.id || "",
      messagePreview: text.slice(0, 320),
      audience,
      intent,
      option: {
        key: option.key || intent.optionKey,
        title: option.title || intent.label,
        short: option.short || "",
        prompt: option.prompt || ""
      },
      missing,
      facts,
      risk,
      quality,
      confidence,
      reply,
      clarification,
      unclearAttempt,
      unclearAttempts: projectedUnclearAttempts,
      escalatedToRh,
      resolutionQuestionAsked,
      resolutionStatus: "",
      restricted: Boolean(facts.exploratoryValueComparison),
      declaredAnswer: declaredAnswer ? {
        key: declaredAnswer.key,
        optionKey: declaredAnswer.optionKey,
        title: declaredAnswer.title,
        source: declaredAnswer.source,
        score: declaredAnswer.score,
        contextMissing: declaredAnswer.contextMissing
      } : null,
      learnedReply: learnedPattern ? {
        optionKey: learnedPattern.optionKey,
        optionTitle: learnedPattern.optionTitle || "",
        score: learnedPattern.score,
        updatedAt: learnedPattern.updatedAt || ""
      } : null,
      learnedContext,
      pendingQuestion: pendingQuestionFromDraft({
        option: { key: option.key || intent.optionKey, title: option.title || intent.label },
        missing,
        facts,
        audience,
        sourceMessageId: sourceMessage?.id || ""
      }),
      blockedByRejectedPattern: Boolean(rejectedPattern),
      guardrail: risk.canAutoAnswer
        ? (declaredAnswer ? "Resposta declarada RH aplicada. Este teste ainda nao envia WhatsApp." : "Resposta inicial de coleta marcada como rotina segura. Este teste ainda nao envia WhatsApp.")
        : "Resposta assistida: nao envia WhatsApp e nao altera registros oficiais sem aprovacao humana."
    };
    const conversationAfter = updateConversationContext(conversationBefore, draft, currentFactItems, unclearAttempt, projectedUnclearAttempts);
    draft.gatheredFields = conversationAfter.gatheredFields.slice(0, 12);
    draft.conversationContext = compactConversationContext(conversationAfter);
    draft.conversationContextBefore = compactConversationContext(conversationBefore);
    draft.conversationContextState = conversationAfter;
    return draft;
  }

  function runQualitySuite() {
    const cases = [
      { name: "Saudacao simples", text: "Bom dia", key: "identity_verification", must: [RH_FIRST_MESSAGE], mustNot: ["CCT/valores", "holerite de maio/2026"] },
      { name: "Saudacao alongada", text: "oiiiii boa noite", key: "identity_verification", must: [RH_FIRST_MESSAGE], mustNot: ["nome e sobrenome", "holerite de maio/2026"] },
      { name: "Nome conhecido nao e VA", text: "Waldir de Moura silva", key: "identity_verification", must: ["Waldir de Moura Silva", "assunto"], mustNot: ["data de nascimento", "nascimento", "nome completo", "confirme se voce e funcionario", "ex-funcionario ou candidato", "posto", "funcao"] },
      { name: "Nome e sobrenome basta", text: "Waldir Moura", key: "identity_verification", must: ["Waldir de Moura Silva", "assunto"], mustNot: ["data de nascimento", "nascimento", "nome completo", "confirme se voce e funcionario", "ex-funcionario ou candidato", "posto", "funcao"] },
      { name: "Funcionario com acento", text: "Olá, sou funcionário da TKA", key: "identity_verification", must: ["nome e sobrenome", "funcionário"] },
      { name: "VR nao caiu", text: "Sou funcionario TKA, meu VR nao caiu no cartao", key: "benefit_cards", must: ["VR/VA/VT", "nome e sobrenome", "10/06", "junho"], mustNot: ["posto", "funcao", "ativo"] },
      { name: "VT cartao", text: "meu vt nao caiu no cartao", key: "benefit_cards", must: ["VR/VA/VT", "nome e sobrenome", "10/06", "junho"], mustNot: ["posto", "funcao", "ativo"] },
      { name: "Cartao perdido", text: "perdi o cartao do beneficio", key: "benefit_cards", must: ["cartao", "nome e sobrenome"] },
      { name: "Declarado TotalPass", text: "Como funciona o TotalPass?", key: "gympass", must: ["TotalPass", "45 + 45", "3 dependentes"], declared: true },
      { name: "Declarado VR e VA", text: "Quando cai o VR e o VA no cartao VR?", key: "benefit_cards", must: ["dia 01", "45 + 45", "SUPERAPP VR"], declared: true },
      { name: "Declarado VT", text: "Como solicito vale transporte?", key: "benefit_cards", must: ["vigencia", "mes seguinte", "6%"], declared: true },
      { name: "Declarado Flash", text: "Como uso o cartao Flash auxilio mobilidade?", key: "benefit_cards", must: ["Cartao Flash", "CREDITO A VISTA"], declared: true },
      { name: "Holerite", text: "Preciso do holerite de maio", key: "payslip", must: ["holerite", "nome e sobrenome"] },
      { name: "Holerite com erro comum", text: "preciso do olerite de maio", key: "payslip", must: ["holerite", "nome e sobrenome"] },
      { name: "Declarado Holerite INCICLE", text: "Onde vejo o holerite no INCICLE?", key: "payslip", must: ["INCICLE", "quinto dia util", "Historico de Holerites"], declared: true },
      { name: "Declarado cadastro INCICLE", text: "Nao recebi convite para cadastro INCICLE", key: "document", must: ["convite", "e-mail", "reenviar"], declared: true },
      { name: "Gympass Wellhub", text: "como acesso o wellhub da academia", key: "gympass", must: ["Gym Pass", "cadastro"] },
      { name: "Declarado pagamento quinto dia util", text: "Qual o prazo de pagamento e fechamento da folha?", key: "payroll_payment", must: ["quinto dia util", "26", "25"], declared: true },
      { name: "Declarado Control RH", text: "Como acesso o Control RH para bater ponto?", key: "schedule", must: ["S3CA2", "123456", "10 minutos"], declared: true },
      { name: "FT nao paga", text: "Minha folga trabalhada do dia 12 nao foi paga", key: "ft_payment", must: ["FT", "PIX"] },
      { name: "FT abreviada", text: "a ft do dia 12 ainda nao pagou", key: "ft_payment", must: ["FT", "PIX", "12/06/2026"] },
      { name: "CCT valor", text: "Qual o valor do piso do vigilante na CCT?", key: "cct_values", must: ["CCT", "RH"] },
      { name: "Declarado premio boa permanencia", text: "Tenho direito ao premio de boa permanencia?", key: "cct_values", must: ["Premio de Boa Permanencia", "falta", "Vale Alimentacao"], declared: true },
      { name: "Pagamento desconto", text: "veio desconto errado no salario", key: "payroll_payment", must: ["pagamento", "RH", "maio/2026"] },
      { name: "Curriculo", text: "Bom dia, quero enviar meu curriculo para vaga", key: "candidate_intake", must: ["curriculo", "cidade"] }
      ,
      { name: "Atestado atraso", text: "vou atrasar e tenho atestado", key: "medical_certificate", must: ["atestado", "RH"] },
      { name: "Escala folga", text: "preciso ver minha escala de folga amanha", key: "schedule", must: ["escala", "Dashboard"] },
      { name: "Ferias", text: "quero saber sobre minhas ferias", key: "vacation", must: ["ferias", "RH"] },
      { name: "Documento", text: "preciso de uma declaracao do RH", key: "document", must: ["documento", "nome e sobrenome"] },
      { name: "Uniforme", text: "preciso de uniforme e cracha", key: "uniform_equipment", must: ["uniforme", "nome e sobrenome"] },
      { name: "Rescisao", text: "sou ex funcionario e preciso do fgts da rescisao", key: "termination", must: ["rescisao", "RH"] },
      { name: "Resposta curta mantem pergunta de beneficio", previous: "meu vr nao caiu no cartao", text: "ok", key: "benefit_cards", must: ["mesmo assunto", "beneficio", "Exemplo"], mustNot: ["funcionario da TKA, ex-funcionario ou candidato"] },
      { name: "Nome parcial continua beneficio", previous: "meu vr nao caiu no cartao", text: "Waldir Moura", key: "benefit_cards", must: ["VR/VA/VT", "10/06", "mesmo assunto"], mustNot: ["Se estiver correto", "envie: posto", "envie: funcao"] },
      { name: "Confirmacao curta repete identidade com sugestoes", previous: "Bom dia", text: "sim", key: "identity_verification", must: ["vinculo", "nome e sobrenome", "Exemplos"] },
      { name: "Nome confirmado leva assunto para topico", previous: "Waldir Moura", text: "meu VR nao caiu", key: "benefit_cards", must: ["VR/VA/VT", "10/06"], mustNot: ["nome e sobrenome", "confirme se voce e funcionario", "posto", "funcao"] },
      { name: "Nome com perfil nao pede posto", previous: "meu vr nao caiu no cartao", text: "Waldir Moura", key: "benefit_cards", must: ["Waldir de Moura Silva"], mustNot: ["envie: posto", "funcao", "ativo"] },
      { name: "Escala pede data e horario com exemplo", text: "preciso da escala", key: "schedule", must: ["20/06/2026", "06h"] },
      { name: "Holerite pede competencia com exemplo", text: "preciso do holerite", key: "payslip", must: ["maio/2026"] },
      { name: "VR pede data com exemplo", text: "meu vr nao caiu", key: "benefit_cards", must: ["10/06", "junho"] },
      { name: "VR typo curto n caiu", text: "meu vr n caiu", key: "benefit_cards", must: ["VR/VA/VT", "10/06"], mustNot: ["funcao", "ativo"] },
      { name: "Contexto nome topico data sem repetir", previous: ["Waldir Moura", "meu VR n caiu"], text: "desde 10/06", key: "benefit_cards", must: ["VR/VA/VT", "RH"], mustNot: ["nome e sobrenome", "funcionario da TKA", "data de nascimento", "ativo", "posto", "funcao", "10/06 ou no beneficio de junho"] },
      { name: "Holerite typo com competencia nao repete mes", text: "preciso do oliriti de maio", key: "payslip", must: ["holerite"], mustNot: ["mes ou competencia", "maio/2026"] },
      { name: "Desconto com competencia nao repete data", previous: "Waldir Moura", text: "veio desconto errado em maio/2026", key: "payroll_payment", must: ["pagamento", "RH"], mustNot: ["nome e sobrenome", "competencia ou data", "ativo"] },
      { name: "Pagamento continua apos saudacao nome e competencia", previous: ["Bom dia", "Tenho duvidas sobre pagamento"], text: "Waldir Moura\nMaio de 2026", key: "payroll_payment", must: ["Waldir de Moura Silva", "pagamento", "competência", "mesmo assunto"], mustNot: [RH_FIRST_MESSAGE, "envie direto o assunto", "nome e sobrenome", "competencia ou data"] },
      { name: "Resposta completa direciona especialista sem falso encerramento", text: "Waldir Moura, VR Caju nao caiu desde 10/06", key: "benefit_cards", must: ["Waldir de Moura Silva", "especialista do RH"], mustNot: ["nome e sobrenome", "data ou periodo", "Sua duvida foi respondida"] },
      { name: "Cinco respostas vagas encaminha RH", previous: ["Bom dia", "ok", "sim", "ok"], text: "nao sei", key: "identity_verification", must: ["RH humano", "5 tentativas"], escalated: true }
    ];
    cases.push({
      name: "Comparacao de extra bloqueada",
      text: "meu extra ficou mais barato que dos outros",
      key: "ft_payment",
      must: ["especialista do RH", "duvida atual"],
      mustNot: ["nao confirma valor", "quanto os outros", "colegas recebem"]
    });
    cases.push(
      {
        name: "Pagamento pede apenas competencia primeiro",
        previous: "Bom dia",
        text: "Tenho duvidas sobre pagamento",
        key: "payroll_payment",
        must: ["Qual mes e ano", "data especifica"],
        mustNot: ["nome e sobrenome", "pagamento/desconto", "holerite", "VR/VA/VT", "FT", "atestado"]
      },
      {
        name: "Pagamento resposta errada ganha exemplo correto",
        previous: ["Bom dia", "Tenho duvidas sobre pagamento"],
        text: "nao sei",
        key: "payroll_payment",
        must: ["Qual mes e ano", "Exemplo: maio/2026"],
        mustNot: ["holerite", "VR/VA/VT", "FT", "atestado"]
      }
    );
    const objectiveOverrides = {
      "Nome conhecido nao e VA": {
        must: ["Waldir de Moura Silva", "Qual e sua duvida"],
        mustNot: ["data de nascimento", "nascimento", "nome completo", "confirme se voce e funcionario", "ex-funcionario ou candidato", "posto", "funcao"]
      },
      "Nome e sobrenome basta": {
        must: ["Waldir de Moura Silva", "Qual e sua duvida"],
        mustNot: ["data de nascimento", "nascimento", "nome completo", "confirme se voce e funcionario", "ex-funcionario ou candidato", "posto", "funcao"]
      },
      "Funcionario com acento": { must: ["nome e sobrenome"] },
      "VR nao caiu": { must: ["Desde quando isso acontece"], mustNot: ["nome e sobrenome", "VR/VA/VT", "holerite", "FT", "atestado", "posto", "funcao", "ativo"] },
      "VT cartao": { must: ["Desde quando isso acontece"], mustNot: ["nome e sobrenome", "VR/VA/VT", "holerite", "FT", "atestado", "posto", "funcao", "ativo"] },
      "Cartao perdido": { must: ["Desde quando isso acontece"], mustNot: ["VR/VA/VT", "holerite", "FT"] },
      "Gympass Wellhub": { must: ["nome e sobrenome"] },
      "FT nao paga": { must: ["Qual foi a data da FT"], mustNot: ["VR/VA/VT", "holerite", "atestado"] },
      "FT abreviada": { must: ["Qual foi a data da FT"], mustNot: ["VR/VA/VT", "holerite", "atestado"] },
      "CCT valor": { must: ["nome e sobrenome"] },
      "Pagamento desconto": { must: ["Qual mes e ano", "data especifica"], mustNot: ["nome e sobrenome", "holerite", "VR/VA/VT", "FT", "atestado"] },
      "Curriculo": { must: ["cidade"] },
      "Atestado atraso": { must: ["horario"] },
      "Escala folga": { must: ["nome e sobrenome"] },
      "Ferias": { must: ["periodo"] },
      "Documento": { must: ["nome e sobrenome"] },
      "Uniforme": { must: ["nome e sobrenome"] },
      "Rescisao": { must: ["nome e sobrenome", "ex-funcionario"] },
      "Resposta curta mantem pergunta de beneficio": {
        must: ["mesmo assunto", "Desde quando", "Exemplo"],
        mustNot: ["funcionario da TKA, ex-funcionario ou candidato"]
      },
      "Nome parcial continua beneficio": {
        must: ["Waldir de Moura Silva", "Desde quando"],
        mustNot: ["Se estiver correto", "envie: posto", "envie: funcao"]
      },
      "Confirmacao curta repete identidade com sugestoes": { must: ["nome e sobrenome", "Exemplo"] },
      "Nome confirmado leva assunto para topico": {
        must: ["Waldir de Moura Silva", "Desde quando"],
        mustNot: ["nome e sobrenome", "confirme se voce e funcionario", "posto", "funcao", "holerite", "FT"]
      },
      "Escala pede data e horario com exemplo": { name: "Escala pede data primeiro", must: ["Qual e a data"] },
      "Holerite pede competencia com exemplo": { name: "Holerite pede competencia primeiro", must: ["De qual mes e ano"] },
      "VR pede data com exemplo": { name: "VR pede data sem exemplo imediato", must: ["Desde quando isso acontece"], mustNot: ["Exemplo", "holerite", "FT"] },
      "VR typo curto n caiu": { must: ["Desde quando isso acontece"], mustNot: ["funcao", "ativo", "holerite", "FT"] },
      "Contexto nome topico data sem repetir": {
        must: ["especialista do RH"],
        mustNot: ["nome e sobrenome", "funcionario da TKA", "data de nascimento", "ativo", "posto", "funcao", "Desde quando"]
      },
      "Desconto com competencia nao repete data": {
        must: ["Waldir de Moura Silva", "RH"],
        mustNot: ["nome e sobrenome", "competencia ou data", "ativo"]
      },
      "Pagamento continua apos saudacao nome e competencia": {
        must: ["Waldir de Moura Silva", "RH", "competencia", "mesmo assunto"],
        mustNot: [RH_FIRST_MESSAGE, "envie direto o assunto", "nome e sobrenome", "competencia ou data", "holerite", "VR/VA/VT", "FT", "atestado"]
      }
    };
    const alignedCases = cases.map(test => {
      if (test.name === "Saudacao simples") {
        return {
          ...test,
          must: [RH_FIRST_MESSAGE],
          mustNot: [...(test.mustNot || []), "CCT/valores", "holerite de maio/2026"]
        };
      }
      if (test.name === "Saudacao alongada") {
        return {
          ...test,
          must: [RH_FIRST_MESSAGE],
          mustNot: [...(test.mustNot || []), "nome e sobrenome", "holerite de maio/2026"]
        };
      }
      if (objectiveOverrides[test.name]) {
        return {
          ...test,
          ...objectiveOverrides[test.name]
        };
      }
      return test;
    });
    const globalMustNot = [
      "Nao fecho valor individual",
      "Nao consigo fechar valor individual",
      "atendimento automatico nao debate",
      "nao confirma valor por WhatsApp"
    ];
    const results = alignedCases.map(test => {
      let pending = null;
      let conversationContext = createConversationContext({ source: "quality-suite" });
      const previousMessages = Array.isArray(test.previous) ? test.previous : (test.previous ? [test.previous] : []);
      previousMessages.forEach(previousText => {
        const previousDraft = buildDraftForInput(previousText, null, pending, { ignoreLearned: true, conversationContext });
        pending = previousDraft.pendingQuestion || null;
        conversationContext = previousDraft.conversationContextState || conversationContext;
      });
      const draft = buildDraftForInput(test.text, null, pending, { ignoreLearned: true, conversationContext });
      const replyNormalized = normalizeText(draft.reply);
      const missingMust = test.must.filter(token => !replyNormalized.includes(normalizeText(token)));
      const forbiddenHits = [...(test.mustNot || []), ...globalMustNot].filter(token => replyNormalized.includes(normalizeText(token)));
      const escalationOk = test.escalated ? draft.escalatedToRh === true : true;
      const declaredOk = test.declared ? Boolean(draft.declaredAnswer) : true;
      const ok = draft.option.key === test.key && draft.quality.passed && missingMust.length === 0 && forbiddenHits.length === 0 && escalationOk && declaredOk;
      return {
        name: test.name,
        previous: test.previous || "",
        ok,
        expected: test.key,
        got: draft.option.key,
        confidence: draft.confidence,
        clarification: draft.clarification,
        unclearAttempts: draft.unclearAttempts,
        escalatedToRh: draft.escalatedToRh,
        gatheredFields: draft.gatheredFields,
        risk: draft.risk.level,
        missingMust,
        forbiddenHits,
        warnings: draft.quality.warnings,
        declaredAnswer: draft.declaredAnswer?.title || ""
      };
    });
    const failed = results.filter(item => !item.ok);
    addLog(failed.length ? "warn" : "qa", failed.length ? "Suite basica com falhas" : "Suite basica aprovada", {
      total: alignedCases.length,
      passed: results.length - failed.length,
      failed: failed.length,
      results,
      tone: failed.length ? "warn" : "ok"
    });
    return results;
  }

  function missingFieldHintsLegacy(option, text, audience) {
    const normalized = normalizeText(text);
    const required = option.requiredFields || [];
    const missing = [];
    for (const field of required) {
      const key = normalizeText(field);
      if (key.includes("nome") && /\b[a-z]{3,}\s+[a-z]{3,}/.test(normalized)) continue;
      if (key.includes("data") && /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(normalized)) continue;
      if (key.includes("competencia") && /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{1,2}\/\d{4})\b/.test(normalized)) continue;
      if (key.includes("posto") && /\b(posto|condominio|obra|base|shopping|hospital|empresa)\b/.test(normalized)) continue;
      if (key.includes("curriculo") && /\b(curriculo|cv|anexo)\b/.test(normalized)) continue;
      missing.push(field);
    }
    if (audience.key === "unknown" && !missing.includes("relacao com a TKA")) missing.unshift("relacao com a TKA");
    return missing.slice(0, 6);
  }

  async function generateDraft() {
    const sourceMessage = state.sourceMode === "live" ? selectedMessage() : null;
    const text = sourceMessage ? safeMessageText(sourceMessage) : el.testMessage.value.trim();
    if (!text || text.startsWith("[texto nao validado")) {
      const reason = text ? "Mensagem live sem texto validado para teste." : "Informe uma mensagem para testar.";
      addLog("warn", "Teste nao gerado", { reason, messageId: sourceMessage?.id || "", tone: "warn" });
      state.lastDraft = null;
      state.aiDraftRunning = false;
      renderDraft();
      return null;
    }
    appendChatMessage("user", text, {
      source: sourceMessage ? "live" : "manual",
      messageId: sourceMessage?.id || ""
    });
    const draft = buildDraftForInput(text, sourceMessage, state.pendingQuestion, { conversationContext: state.conversationContext });
    draft.aiDraftPending = shouldAttemptOpenAiDraft(draft);
    state.lastDraft = draft;
    state.aiDraftRunning = draft.aiDraftPending;
    state.pendingQuestion = draft.pendingQuestion || null;
    state.conversationContext = draft.conversationContextState || state.conversationContext;
    saveConversationState();
    const agentBubble = appendChatMessage("agent", draft.reply, {
      draftId: draft.id,
      optionTitle: draft.option.title || draft.intent.label || "",
      riskLabel: draft.risk.label || "",
      pending: draft.aiDraftPending,
      model: ""
    });
    draft.chatAgentMessageId = agentBubble.id;
    addLog("draft", "Resposta automatica gerada para teste", {
      source: draft.source,
      messageId: draft.sourceMessageId,
      optionKey: draft.option.key,
      intent: draft.intent.label,
      audience: draft.audience.label,
      confidence: draft.confidence,
      missing: draft.missing,
      gatheredFields: draft.gatheredFields,
      conversationContext: draft.conversationContext,
      unclearAttempts: draft.unclearAttempts,
      escalatedToRh: draft.escalatedToRh,
      pendingQuestion: draft.pendingQuestion,
      clarification: draft.clarification,
      declaredAnswer: draft.declaredAnswer,
      learnedReply: draft.learnedReply,
      risk: draft.risk.level,
      canAutoAnswer: draft.risk.canAutoAnswer,
      qualityPassed: draft.quality.passed,
      warnings: draft.quality.warnings,
      draft: draft.reply
    });
    render();
    if (!shouldAttemptOpenAiDraft(draft)) {
      const needsOpenAi = draftNeedsOpenAiHelp(draft);
      draft.aiDraftPending = false;
      state.aiDraftRunning = false;
      if (needsOpenAi) {
        draft.aiDraftError = OPENAI_BACKEND_UNAVAILABLE;
        state.aiCloudRuntime = {
          mode: "deterministic-rh-helper",
          configured: false,
          model: "",
          lastError: OPENAI_BACKEND_UNAVAILABLE
        };
        addLog("warn", "OpenAI cloud nao executado neste link", {
          reason: OPENAI_BACKEND_UNAVAILABLE,
          deterministicReplyActive: true,
          tone: "warn"
        });
      } else {
        draft.aiDraftSkipped = "deterministic-answer-sufficient";
        state.aiCloudRuntime = {
          ...(state.aiCloudRuntime || {}),
          mode: state.aiCloudRuntime?.mode || "deterministic-rh-helper",
          lastError: ""
        };
        addLog("draft", "OpenAI nao necessario para este rascunho", {
          optionKey: draft.option?.key || "",
          confidence: draft.confidence,
          tone: "info"
        });
      }
      render();
      return draft;
    }
    try {
      const result = await requestOpenAiDraft(draft, text, sourceMessage);
      if (!state.lastDraft || state.lastDraft.id !== draft.id) return state.lastDraft;
      const reply = String(result.reply || "").trim();
      if (!reply) throw new Error("Resposta OpenAI vazia");
      const quality = assessReplyQuality(reply, state.lastDraft.option.key, state.lastDraft.risk, state.lastDraft.missing || []);
      state.lastDraft.reply = reply;
      state.lastDraft.quality = quality;
      state.lastDraft.aiDraftPending = false;
      state.lastDraft.aiDraft = {
        source: result.source || "openai-responses",
        model: result.model || "",
        at: new Date().toISOString()
      };
      updateChatMessage(state.lastDraft.chatAgentMessageId, {
        text: reply,
        pending: false,
        model: result.model || "",
        riskLabel: state.lastDraft.risk.label || ""
      });
      state.aiCloudRuntime = {
        ...(result.runtime || {}),
        configured: result.configured !== false,
        model: result.model || result.runtime?.model || "",
        lastError: ""
      };
      state.aiDraftRunning = false;
      addLog(quality.passed ? "ai" : "warn", quality.passed ? "Resposta humanizada por OpenAI" : "OpenAI respondeu, mas precisa revisar", {
        model: result.model || "",
        source: result.source || "",
        warnings: quality.warnings,
        draft: reply,
        tone: quality.passed ? "ok" : "warn"
      });
      render();
    } catch (error) {
      if (state.lastDraft?.id === draft.id) {
        state.lastDraft.aiDraftPending = false;
        state.lastDraft.aiDraftError = String(error.message || error);
        updateChatMessage(state.lastDraft.chatAgentMessageId, {
          pending: false,
          riskLabel: `${state.lastDraft.risk.label || "fallback"} / OpenAI indisponivel`
        });
      }
      state.aiDraftRunning = false;
      const payload = error.payload || {};
      const notConfigured = payload.configured === false;
      state.aiCloudRuntime = {
        ...(payload.runtime || state.aiCloudRuntime || {}),
        configured: payload.configured === false ? false : state.aiCloudRuntime.configured,
        lastError: String(error.message || error)
      };
      addLog(notConfigured ? "warn" : "error", notConfigured ? "OpenAI cloud nao configurado" : "Falha ao humanizar com OpenAI cloud", {
        error: String(error.message || error),
        configured: payload.configured,
        runtime: payload.runtime || null,
        tone: notConfigured ? "warn" : "bad"
      });
      render();
    }
    return draft;
  }

  function feedbackEventId(draft, action, correction) {
    return [draft.sourceMessageId || draft.id, draft.option.key || "draft", action, normalizeText(correction || "").slice(0, 80)]
      .join(":")
      .replace(/[^a-z0-9_.:-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180);
  }

  function cloudSafeId(value) {
    return String(value || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180);
  }

  function clientRedactSensitiveText(value) {
    return String(value || "")
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
      .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
      .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b(?:pix|chave pix)\s*[:=-]?\s*\S+/gi, "PIX [omitido]")
      .slice(0, 4000);
  }

  function compactLearnedContext(context = {}) {
    return {
      accepted: Array.isArray(context.accepted) ? context.accepted.slice(0, 5).map(row => ({
        optionKey: String(row.optionKey || "").slice(0, 120),
        optionTitle: clientRedactSensitiveText(row.optionTitle || "").slice(0, 180),
        reply: clientRedactSensitiveText(row.reply || "").slice(0, 1200),
        messagePreview: clientRedactSensitiveText(row.messagePreview || "").slice(0, 400),
        action: String(row.action || "").slice(0, 40),
        source: String(row.source || "").slice(0, 80),
        score: Number(row.score || 0),
        count: Number(row.count || 1),
        updatedAt: String(row.updatedAt || "").slice(0, 80)
      })) : [],
      rejected: Array.isArray(context.rejected) ? context.rejected.slice(0, 3).map(row => ({
        rejectedOptionKey: String(row.rejectedOptionKey || "").slice(0, 120),
        rejectedTitle: clientRedactSensitiveText(row.rejectedTitle || "").slice(0, 180),
        replacementText: clientRedactSensitiveText(row.replacementText || "").slice(0, 1200),
        action: String(row.action || "").slice(0, 40),
        score: Number(row.score || 0),
        count: Number(row.count || 1),
        updatedAt: String(row.updatedAt || "").slice(0, 80)
      })) : []
    };
  }

  function compactDraftPayload(draft) {
    return {
      reply: clientRedactSensitiveText(draft.reply || ""),
      option: draft.option || {},
      audience: {
        key: draft.audience?.key || "",
        label: draft.audience?.label || "",
        evidence: (draft.audience?.evidence || []).slice(0, 5)
      },
      intent: {
        label: draft.intent?.label || "",
        evidence: (draft.intent?.evidence || []).slice(0, 5)
      },
      missing: (draft.missing || []).slice(0, 8),
      risk: draft.risk || {},
      confidence: draft.confidence,
      clarification: Boolean(draft.clarification),
      declaredAnswer: draft.declaredAnswer || null,
      learnedReply: draft.learnedReply || null,
      learnedContext: compactLearnedContext(draft.learnedContext || learnedContextForInput(draft.messagePreview || "", draft.option?.key || "")),
      pendingQuestion: draft.pendingQuestion || null,
      gatheredFields: Array.isArray(draft.gatheredFields) ? draft.gatheredFields.slice(0, 12) : [],
      conversationContext: draft.conversationContext || null,
      unclearAttempts: Number(draft.unclearAttempts || 0),
      maxUnclearAttempts: MAX_UNCLEAR_ATTEMPTS,
      escalatedToRh: Boolean(draft.escalatedToRh),
      resolutionQuestionAsked: Boolean(draft.resolutionQuestionAsked),
      resolutionStatus: draft.resolutionStatus || "",
      restricted: Boolean(draft.restricted)
    };
  }

  function draftNeedsOpenAiHelp(draft = null) {
    if (!draft || draft.declaredAnswer || draft.learnedReply) return false;
    if (draft.escalatedToRh || draft.restricted || draft.facts?.greetingOnly) return false;
    const optionKey = draft.option?.key || "";
    if (["payroll_payment", "cct_values", "termination"].includes(optionKey)) return false;
    if (draft.missing?.length && draft.quality?.passed && !["general_request", "rh_handoff"].includes(optionKey)) return false;
    if (["general_request", "rh_handoff"].includes(optionKey)) return true;
    if (optionKey === "identity_verification" && !draft.facts?.workerMatch && !draft.facts?.hasName) return true;
    if (Number(draft.confidence || 0) < 0.82) return true;
    return !draft.quality?.passed;
  }

  function shouldAttemptOpenAiDraft(draft = null) {
    if (ENABLE_CLOUD_FUNCTIONS_AI || ENABLE_GITHUB_RH_AI_WORKER || ENABLE_LOCAL_RH_FALLBACK) return true;
    return Boolean(state.aiDb && window.firebase && draftNeedsOpenAiHelp(draft));
  }

  async function postRhFeedbackCloud(payload) {
    if (!state.aiDb || !window.firebase) throw new Error("Firestore cloud indisponivel para aprendizado RH");
    const eventId = cloudSafeId(payload.eventId || feedbackEventId({ id: Date.now(), option: { key: payload.selectedKey || "feedback" } }, "cloud", payload.customText || ""));
    const event = {
      ...payload,
      eventId,
      id: eventId,
      source: payload.source || "whatsappRH-test-cloud",
      customText: clientRedactSensitiveText(payload.customText || ""),
      draftText: clientRedactSensitiveText(payload.draftText || ""),
      messagePreview: clientRedactSensitiveText(payload.messagePreview || ""),
      reply: clientRedactSensitiveText(payload.reply || payload.customText || payload.draftText || ""),
      reviewAction: String(payload.reviewAction || payload.action || "").slice(0, 40),
      sourceMessageId: String(payload.sourceMessageId || payload.messageId || "").slice(0, 180),
      draftConfidence: Number(payload.draftConfidence || 0),
      qualityPassed: Boolean(payload.qualityPassed),
      riskLevel: String(payload.riskLevel || "").slice(0, 80),
      learnedReply: payload.learnedReply || null,
      learnedContext: compactLearnedContext(payload.learnedContext || {}),
      keepInQueue: payload.keepInQueue !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!payload.createdAt) event.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await state.aiDb.collection("rh_ai_feedback_events").doc(eventId).set(event, { merge: true });
    return {
      ok: true,
      duplicate: false,
      source: "firestore-rh-ai-feedback",
      event: {
        id: eventId,
        action: event.action,
        selectedKey: event.selectedKey,
        selectedTitle: event.selectedTitle
      }
    };
  }

  async function postRhFeedback(payload) {
    if (state.aiDb) return postRhFeedbackCloud(payload);
    const primaryUrl = CLOUD_RH_FEEDBACK_URL;
    const response = await fetch(primaryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload)
    }).catch(error => {
      if (!ENABLE_LOCAL_RH_FALLBACK) throw error;
      return fetch(`${LOCAL_RH_BRIDGE_URL}/rh/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload)
      });
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Falha ao registrar feedback");
    return data;
  }

  async function requestOpenAiDraft(draft, text, sourceMessage) {
    const aiPayload = {
      text,
      sourceMessageId: sourceMessage?.id || "",
      draft: {
        reply: draft.reply,
        option: draft.option,
        audience: draft.audience,
        intent: draft.intent,
        missing: draft.missing,
        risk: draft.risk,
        confidence: draft.confidence,
        clarification: draft.clarification,
        declaredAnswer: draft.declaredAnswer || null,
        learnedReply: draft.learnedReply || null,
        learnedContext: compactLearnedContext(draft.learnedContext || learnedContextForInput(text, draft.option?.key || "")),
        pendingQuestion: draft.pendingQuestion,
        gatheredFields: draft.gatheredFields || [],
        conversationContext: draft.conversationContext || null,
        unclearAttempts: draft.unclearAttempts || 0,
        maxUnclearAttempts: MAX_UNCLEAR_ATTEMPTS,
        escalatedToRh: Boolean(draft.escalatedToRh),
        resolutionQuestionAsked: Boolean(draft.resolutionQuestionAsked),
        resolutionStatus: draft.resolutionStatus || "",
        restricted: Boolean(draft.restricted)
      }
    };

    try {
      if (!ENABLE_CLOUD_FUNCTIONS_AI) throw new Error(OPENAI_BACKEND_UNAVAILABLE);
      const response = await fetch(CLOUD_RH_AI_DRAFT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(aiPayload)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (cloudError) {
      const canUseGithubWorker = state.aiDb && window.firebase && (ENABLE_GITHUB_RH_AI_WORKER || draftNeedsOpenAiHelp(draft));
      if (canUseGithubWorker) {
        addLog("warn", "Firebase Functions indisponivel; tentando fila GitHub Actions", {
          error: String(cloudError.message || cloudError),
          tone: "warn"
        });
        return requestOpenAiDraftViaGithubWorker(draft, text, sourceMessage);
      }
      if (!ENABLE_LOCAL_RH_FALLBACK) throw cloudError;
      const response = await fetch(`${LOCAL_RH_BRIDGE_URL}/rh/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(aiPayload)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.payload = payload;
        throw error;
      }
      return payload;
    }
  }

  async function requestOpenAiDraftViaGithubWorker(draft, text, sourceMessage) {
    if (state.aiDb && window.firebase) {
      const jobId = cloudSafeId([
        "rh-ai",
        draft.sourceMessageId || "typed",
        draft.option?.key || "draft",
        Date.now(),
        Math.random().toString(36).slice(2, 8)
      ].join(":"));
      const docRef = state.aiDb.collection("rh_ai_draft_jobs").doc(jobId);
      const payload = {
        id: jobId,
        status: "queued",
        source: "whatsappRH-test",
        sourceMessageId: sourceMessage?.id || "",
        text: clientRedactSensitiveText(text),
        draft: compactDraftPayload(draft),
        pageUrl: location.href.slice(0, 300),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await docRef.set(payload, { merge: true });
      addLog("ai", "Resposta enviada para fila OpenAI cloud", {
        jobId,
        source: "github-actions-worker",
        optionKey: draft.option?.key || "",
        tone: "info"
      });
      return waitForOpenAiDraftJob(docRef, jobId);
    }

    throw new Error("Firestore cloud indisponivel para fila GitHub Actions");
  }

  function waitForOpenAiDraftJob(docRef, jobId, timeoutMs = 130000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe = null;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (unsubscribe) unsubscribe();
        const error = new Error("Tempo esgotado aguardando worker cloud do GitHub Actions");
        error.payload = { configured: true, runtime: { mode: "github-actions-rh-ai-worker", jobId } };
        reject(error);
      }, timeoutMs);

      unsubscribe = docRef.onSnapshot(snapshot => {
        if (settled || !snapshot.exists) return;
        const data = snapshot.data() || {};
        if (data.status === "done" && data.reply) {
          settled = true;
          clearTimeout(timer);
          unsubscribe();
          resolve({
            ok: true,
            configured: true,
            source: "github-actions-rh-ai-worker",
            model: data.model || "",
            reply: data.reply,
            jobId,
            runtime: {
              mode: "github-actions-rh-ai-worker",
              jobId,
              completedAt: data.completedAt || "",
              model: data.model || ""
            }
          });
        } else if (data.status === "error") {
          settled = true;
          clearTimeout(timer);
          unsubscribe();
          const error = new Error(data.error || "Worker cloud retornou erro");
          error.payload = {
            configured: !String(data.error || "").includes("TKA_OPENAI_API_KEY"),
            runtime: {
              mode: "github-actions-rh-ai-worker",
              jobId,
              model: data.model || "",
              completedAt: data.completedAt || ""
            }
          };
          reject(error);
        }
      }, error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (unsubscribe) unsubscribe();
        reject(error);
      });
    });
  }

  async function flushPendingLearning(options = {}) {
    if (state.feedbackFlushRunning) return;
    const queue = loadPendingLearning();
    if (!queue.length) {
      if (!options.silentNoop) addLog("refresh", "Nenhum aprendizado pendente para reenviar", { pending: 0 });
      return;
    }
    state.feedbackFlushRunning = true;
    const remaining = [];
    let sent = 0;
    let skipped = 0;
    for (const payload of queue) {
      if (!payload.approvedForLearning && !payload.customText) {
        remaining.push({ ...payload, blockedReason: payload.blockedReason || "requires-operator-approval" });
        skipped += 1;
        continue;
      }
      try {
        await postRhFeedback(payload);
        sent += 1;
      } catch {
        remaining.push(payload);
      }
    }
    savePendingLearning(remaining);
    state.feedbackFlushRunning = false;
    addLog(sent ? "teach" : "warn", sent ? "Aprendizado pendente reenviado" : "Aprendizado ainda pendente", {
      sent,
      skipped,
      remaining: remaining.length,
      tone: sent ? "ok" : "warn"
    });
    render();
  }

  function queueLearning(payload, error) {
    const queue = loadPendingLearning();
    if (!queue.some(item => item.eventId === payload.eventId)) queue.push(payload);
    savePendingLearning(queue);
    addLog("warn", "Aprendizado salvo na fila local do teste", {
      eventId: payload.eventId,
      messageId: payload.messageId,
      error: String(error?.message || error || ""),
      pending: queue.length,
      tone: "warn"
    });
  }

  function compactLearnedReplyForPayload(learned, fallbackReply) {
    if (!learned && !fallbackReply) return null;
    return {
      optionKey: String(learned?.optionKey || "").slice(0, 120),
      optionTitle: clientRedactSensitiveText(learned?.optionTitle || "").slice(0, 180),
      reply: clientRedactSensitiveText(learned?.reply || fallbackReply || "").slice(0, 1200),
      action: String(learned?.action || "").slice(0, 40),
      count: Number(learned?.count || 1),
      updatedAt: String(learned?.updatedAt || new Date().toISOString()).slice(0, 80)
    };
  }

  function learningPayloadForDraft(draft, reviewAction, correction = "", learned = null) {
    const action = reviewAction || (correction ? "correct" : "approve");
    const learnedText = String(correction || draft.reply || "").trim();
    const customText = correction ? correction.trim() : "";
    const selectedKey = customText ? "custom" : (draft.option.key || "general_request");
    const selectedTitle = customText || draft.option.title || draft.intent.label || "Teste RH";
    const approvedForLearning = action !== "reject" || Boolean(customText);
    return {
      eventId: feedbackEventId(draft, action, learnedText),
      messageId: draft.sourceMessageId || draft.id || "",
      sourceMessageId: draft.sourceMessageId || "",
      selectedKey,
      selectedTitle,
      customText,
      reply: learnedText,
      audienceKey: draft.audience.key || "",
      intent: draft.intent.intent || draft.intent.optionKey || "",
      operatorAt: new Date().toISOString(),
      source: "whatsappRH-test",
      sourceMode: draft.source || "",
      keepInQueue: true,
      approvedForLearning,
      accepted: action !== "reject",
      action,
      messagePreview: draft.messagePreview || "",
      draftText: draft.reply || "",
      reviewAction: action,
      draftConfidence: draft.confidence,
      qualityPassed: Boolean(draft.quality?.passed),
      riskLevel: draft.risk?.level || "",
      resolutionQuestionAsked: Boolean(draft.resolutionQuestionAsked),
      resolutionStatus: draft.resolutionStatus || "",
      learnedReply: compactLearnedReplyForPayload(learned, learnedText),
      learnedContext: compactLearnedContext(draft.learnedContext || learnedContextForInput(draft.messagePreview || "", draft.option?.key || ""))
    };
  }

  function manualLearningPayload(question, answer, optionKey, optionTitle, learned = null) {
    const cleanQuestion = String(question || "").trim();
    const cleanAnswer = String(answer || "").trim();
    const topicKey = String(optionKey || "general_request").trim() || "general_request";
    const topicTitle = String(optionTitle || topicKey).trim() || topicKey;
    const eventId = cloudSafeId([
      "manual-rh",
      topicKey,
      messageFingerprint(cleanQuestion),
      normalizeText(cleanAnswer).slice(0, 80)
    ].join(":"));
    return {
      eventId,
      messageId: "",
      sourceMessageId: "",
      selectedKey: `manual_info_${topicKey}`,
      optionKey: topicKey,
      selectedTitle: topicTitle,
      customText: cleanAnswer,
      reply: cleanAnswer,
      audienceKey: "",
      intent: topicKey,
      operatorAt: new Date().toISOString(),
      source: "whatsappRH-test-manual-info",
      sourceMode: "manual-learning",
      keepInQueue: true,
      approvedForLearning: true,
      accepted: true,
      action: "manual_info",
      reviewAction: "manual_info",
      messagePreview: cleanQuestion,
      draftText: cleanAnswer,
      draftConfidence: 1,
      qualityPassed: true,
      riskLevel: "manual_review",
      learnedReply: compactLearnedReplyForPayload(learned, cleanAnswer),
      learnedContext: compactLearnedContext({
        accepted: learned ? [{
          ...learned,
          score: 1,
          source: "whatsappRH-test-manual-info"
        }] : []
      })
    };
  }

  async function persistDraftLearning(draft, reviewAction, correction = "", learned = null, options = {}) {
    const payload = learningPayloadForDraft(draft, reviewAction, correction, learned);
    try {
      await postRhFeedback(payload);
      addLog("teach", options.successTitle || "Aprendizado RH compartilhado", {
        eventId: payload.eventId,
        messageId: payload.messageId,
        optionKey: payload.selectedKey,
        reviewAction: payload.reviewAction,
        sourceMode: payload.sourceMode,
        keepInQueue: true,
        tone: "ok"
      });
      return true;
    } catch (error) {
      if (payload.approvedForLearning || payload.customText) queueLearning(payload, error);
      else {
        addLog("warn", "Rejeicao sem texto mantida como guarda local", {
          eventId: payload.eventId,
          reason: String(error?.message || error || ""),
          tone: "warn"
        });
      }
      return false;
    }
  }

  async function sendLearning() {
    const draft = state.lastDraft;
    if (!draft) {
      addLog("warn", "Sem rascunho para aprendizado", { tone: "warn" });
      return;
    }
    const correction = el.correctionText.value.trim();
    if (!draft.review?.action && !correction) {
      draft.review = {
        action: "approve",
        correction: "",
        at: new Date().toISOString(),
        source: "teach_button"
      };
    }
    const learningGate = draftLearningAllowed(draft, correction);
    if (!learningGate.ok) {
      addLog("warn", "Aprendizado bloqueado para evitar loop de resposta errada", {
        reason: learningGate.reason,
        optionKey: draft.option.key,
        confidence: draft.confidence,
        review: draft.review?.action || "",
        correctionPresent: Boolean(correction),
        tone: "warn"
      });
      render();
      return;
    }
    const customText = correction || draft.reply;
    const reviewAction = draft.review?.action || (correction ? "correct" : "approve");
    const learned = rememberLearnedReply(draft, reviewAction, customText);
    await persistDraftLearning(draft, reviewAction, correction, learned, {
      successTitle: draft.sourceMessageId ? "Aprendizado RH enviado em modo teste" : "Teste simulado enviado para aprendizado compartilhado"
    });
    addLog("teach", "Aprendizado aprovado para reuso", {
      source: draft.source || "typed-test",
      optionKey: draft.option.key,
      correction,
      gate: learningGate.reason,
      learned: learned ? {
        optionKey: learned.optionKey,
        count: learned.count,
        updatedAt: learned.updatedAt
      } : null,
      tone: "ok"
    });
    if (el.correctionText) el.correctionText.value = "";
    render();
  }

  async function submitManualLearning() {
    const question = el.manualLearningQuestion?.value.trim() || "";
    const answer = el.manualLearningAnswer?.value.trim() || "";
    const optionKey = el.manualLearningTopic?.value || "general_request";
    const option = optionByKey(optionKey) || activeCatalog().find(item => item.key === optionKey) || {};
    const optionTitle = option.title || option.short || optionKey;
    if (!question || !answer) {
      addLog("warn", "Aprendizado manual incompleto", {
        missingQuestion: !question,
        missingAnswer: !answer,
        tone: "warn"
      });
      render();
      return;
    }
    const learned = rememberManualLearnedReply(question, answer, optionKey, optionTitle);
    const payload = manualLearningPayload(question, answer, optionKey, optionTitle, learned);
    try {
      await postRhFeedback(payload);
      addLog("teach", "Aprendizado manual RH salvo para agente/GPT", {
        eventId: payload.eventId,
        optionKey,
        source: payload.source,
        keepInQueue: true,
        learnedCount: loadLearnedReplies().length,
        tone: "ok"
      });
      state.manualLearningStatus = {
        text: "salvo",
        tone: "ok",
        at: Date.now()
      };
    } catch (error) {
      queueLearning(payload, error);
      addLog("warn", "Aprendizado manual RH ficou pendente", {
        eventId: payload.eventId,
        error: String(error?.message || error || ""),
        tone: "warn"
      });
      state.manualLearningStatus = {
        text: "pendente",
        tone: "warn",
        at: Date.now()
      };
    }
    if (el.manualLearningQuestion) el.manualLearningQuestion.value = "";
    if (el.manualLearningAnswer) el.manualLearningAnswer.value = "";
    render();
  }

  async function logHumanAction(type) {
    const draft = state.lastDraft;
    if (!draft) {
      addLog("warn", "Acao ignorada: gere uma resposta primeiro", { action: type, tone: "warn" });
      return;
    }
    const correction = el.correctionText.value.trim();
    if (type === "correct" && !correction) {
      addLog("warn", "Escreva a correcao antes de corrigir o teste", { action: type, tone: "warn" });
      el.correctionText?.focus?.();
      render();
      return;
    }
    const titles = {
      approve: "Teste aprovado pelo operador",
      correct: "Teste corrigido pelo operador",
      reject: "Teste rejeitado pelo operador"
    };
    draft.review = {
      action: type,
      correction,
      at: new Date().toISOString()
    };
    const rejectedPattern = ["correct", "reject"].includes(type)
      ? rememberRejectedPattern(draft, type, correction)
      : null;
    const learned = (type === "approve" || (["correct", "reject"].includes(type) && correction))
      ? rememberLearnedReply(draft, type, correction || draft.reply)
      : null;
    addLog(type, titles[type] || "Acao de teste registrada", {
      draftId: draft.id,
      messageId: draft.sourceMessageId,
      optionKey: draft.option.key,
      correction,
      learned: learned ? {
        optionKey: learned.optionKey,
        count: learned.count,
        updatedAt: learned.updatedAt
      } : null,
      rejectedPattern: rejectedPattern ? {
        rejectedOptionKey: rejectedPattern.rejectedOptionKey,
        count: rejectedPattern.count
      } : null,
      draft: draft.reply,
      tone: type === "approve" ? "ok" : type === "reject" ? "bad" : "warn"
    });
    if (type === "approve" || correction) {
      await persistDraftLearning(draft, type, correction, learned, {
        successTitle: "Acao do operador salva para aprendizado compartilhado"
      });
      if (el.correctionText) el.correctionText.value = "";
    }
    render();
  }

  function renderConnection() {
    const summary = state.summary || {};
    const health = state.health || {};
    const pending = loadPendingLearning().length;
    const learned = loadLearnedReplies().length;
    const connectedText = health.connected ? "conectado" : health.qrRequired ? "QR pendente" : (health.connectionState || "carregando");
    const connectedTone = health.connected ? "ok" : health.qrRequired ? "bad" : "warn";
    const openai = state.aiCloudRuntime || health.openai || summary.openai || {};
    const openaiText = openai.mode === "deterministic-rh-helper"
      ? "helper RH local"
      : openai.enabled === false
      ? "desativado"
      : openai.configured === true ? `cloud ${openai.model || ""}`.trim() : openai.configured === false ? "cloud sem chave" : "cloud";
    const openaiTone = openai.mode === "deterministic-rh-helper" ? "warn" : openai.enabled === false ? "warn" : openai.configured === true ? "ok" : "warn";
    const logCount = state.logs.length;
    const source = state.dataSource || "aguardando";
    el.connectionPanel.innerHTML = `
      <article class="metric ${state.lastError ? "bad" : "ok"}"><span>Fonte live</span><strong>${escapeHtml(source)}</strong></article>
      <article class="metric ${connectedTone}"><span>WhatsApp RH</span><strong>${escapeHtml(connectedText)}</strong></article>
      <article class="metric ${openaiTone}"><span>OpenAI</span><strong>${escapeHtml(openaiText)}</strong></article>
      <article class="metric"><span>Mensagens</span><strong>${summary.totals?.messages || health.rhMessageCount || 0}</strong></article>
      <article class="metric warn"><span>Fila RH</span><strong>${summary.totals?.attention || (summary.attentionQueue || []).length || 0}</strong></article>
      <article class="metric"><span>Logs teste</span><strong>${logCount}</strong></article>
      <article class="metric ${pending ? "warn" : "ok"}"><span>Aprendizado pendente</span><strong>${pending}</strong></article>
      <article class="metric ${learned ? "ok" : "warn"}"><span>Aprendizado ativo</span><strong>${learned}</strong></article>
    `;
    el.pageMeta.textContent = state.lastError
      ? state.lastError
      : `Ultima atualizacao ${formatDateTime(state.lastFetchedAt)} / modo teste sem envio automatico de WhatsApp.`;
  }

  function renderTraining() {
    const study = state.summary?.responseStudy || {};
    const options = activeCatalog();
    const feedback = study.feedback || {};
    const triage = study.triageQuestion || "Primeiro confirmar se é funcionário da TKA, ex-funcionário ou envio de currículo.";
    const rows = [
      `
        <article class="item">
          <div class="item-title">Primeira pergunta RH</div>
          <div class="message">${escapeHtml(triage)}</div>
          <div class="tag-row">
            <span class="tag info">identificacao</span>
            ${feedback.total ? `<span class="tag ok">${escapeHtml(String(feedback.total))} feedback(s)</span>` : ""}
            <span class="tag warn">sem envio automatico</span>
          </div>
        </article>
      `,
      ...options.slice(0, 12).map(option => `
        <article class="item">
          <div class="item-header">
            <div class="item-title">${escapeHtml(option.title || option.key)}</div>
            <span class="tag">${escapeHtml(option.automationRisk || option.key || "fallback")}</span>
          </div>
          ${option.starterReply ? `<div class="draft-text">${escapeHtml(option.starterReply)}</div>` : ""}
          <div class="item-meta">Regra interna: ${escapeHtml(option.prompt || option.short || "")}</div>
          <div class="tag-row">
            ${(option.requiredFields || []).slice(0, 5).map(field => `<span class="tag">${escapeHtml(field)}</span>`).join("")}
          </div>
        </article>
      `)
    ];
    el.trainingPanel.innerHTML = rows.join("");
  }

  function renderManualLearningTopics() {
    if (!el.manualLearningTopic) return;
    const previous = el.manualLearningTopic.value;
    const options = activeCatalog();
    const seen = new Set();
    const rows = options
      .filter(option => option.key && !seen.has(option.key) && seen.add(option.key))
      .map(option => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.title || option.short || option.key)}</option>`);
    el.manualLearningTopic.innerHTML = [
      `<option value="general_request">Geral / duvida comum</option>`,
      ...rows
    ].join("");
    if (previous && Array.from(el.manualLearningTopic.options).some(option => option.value === previous)) {
      el.manualLearningTopic.value = previous;
    }
    const manualCount = loadLearnedReplies().filter(row => row.source === "whatsappRH-test-manual-info").length;
    if (el.manualLearningState) {
      const recentStatus = state.manualLearningStatus && Date.now() - Number(state.manualLearningStatus.at || 0) < 30000;
      el.manualLearningState.textContent = recentStatus
        ? state.manualLearningStatus.text
        : manualCount ? `${manualCount} manual` : "manual";
    }
  }

  function renderQuickScenarios() {
    if (!el.quickScenarios) return;
    el.quickScenarios.innerHTML = QUICK_SCENARIOS.map((scenario, index) => `
      <button type="button" data-quick-scenario="${index}">${escapeHtml(scenario.label)}</button>
    `).join("");
  }

  function chatMetaText(row = {}) {
    const parts = [
      row.optionTitle || "",
      row.riskLabel || "",
      row.model ? `OpenAI ${row.model}` : "",
      row.pending ? "processando" : "",
      formatDateTime(row.at)
    ].filter(Boolean);
    return parts.join(" / ");
  }

  function renderChat() {
    if (!el.chatTranscript) return;
    if (el.chatModePill) {
      el.chatModePill.textContent = shouldAttemptOpenAiDraft(state.lastDraft) ? "OpenAI via Actions" : "deterministico";
    }
    if (!state.chatMessages.length) {
      el.chatTranscript.innerHTML = `
        <div class="chat-empty">
          Digite uma mensagem ou escolha um cenario rapido. A resposta aparece como conversa de WhatsApp, mas nada e enviado.
        </div>
      `;
      return;
    }
    el.chatTranscript.innerHTML = state.chatMessages.map(row => {
      const roleClass = row.role === "agent" ? "agent" : "inbound";
      return `
        <div class="chat-bubble ${roleClass} ${row.pending ? "pending" : ""}">
          ${escapeHtml(row.text)}
          <div class="chat-meta">${escapeHtml(chatMetaText(row))}</div>
        </div>
      `;
    }).join("");
    el.chatTranscript.scrollTop = el.chatTranscript.scrollHeight;
  }

  function renderDraft() {
    const draft = state.lastDraft;
    el.draftState.textContent = draft ? `${draft.option.title || "Rascunho"} / ${draft.risk.label} / ${Math.round(draft.confidence * 100)}%` : "Aguardando";
    if (!draft) {
      el.draftResult.className = "draft-result empty";
      el.draftResult.textContent = "O resultado do teste aparecera aqui.";
      return;
    }
    el.draftResult.className = "draft-result";
    el.draftResult.innerHTML = `
      <div class="tag-row">
        <span class="tag info">${escapeHtml(draft.audience.label)}</span>
        <span class="tag">${escapeHtml(draft.intent.label)}</span>
        <span class="tag ${draft.confidence >= 0.75 ? "ok" : "warn"}">confianca ${Math.round(draft.confidence * 100)}%</span>
        <span class="tag ${draft.risk.canAutoAnswer ? "ok" : draft.risk.level === "manual_review" ? "bad" : "warn"}">${escapeHtml(draft.risk.label)}</span>
        <span class="tag ${draft.quality.passed ? "ok" : "bad"}">${draft.quality.passed ? "qualidade ok" : "qualidade revisar"}</span>
        ${draft.clarification ? `<span class="tag warn">mesma pergunta</span>` : ""}
        ${draft.unclearAttempts ? `<span class="tag warn">${escapeHtml(String(draft.unclearAttempts))}/${MAX_UNCLEAR_ATTEMPTS} tentativas</span>` : ""}
        ${draft.escalatedToRh ? `<span class="tag bad">encaminhar RH</span>` : ""}
        ${draft.restricted ? `<span class="tag bad">restrito RH</span><span class="tag bad">sem comparacao</span>` : ""}
        ${draft.learnedReply ? `<span class="tag ok">aprendizado aplicado</span>` : ""}
        ${draft.review?.action ? `<span class="tag ${draft.review.action === "reject" ? "bad" : draft.review.action === "correct" ? "warn" : "ok"}">teste ${escapeHtml(draft.review.action === "approve" ? "aprovado" : draft.review.action === "correct" ? "corrigido" : "rejeitado")}</span>` : ""}
        ${draft.aiDraftPending ? `<span class="tag warn">OpenAI processando</span>` : ""}
        ${draft.aiDraft ? `<span class="tag ok">OpenAI ${escapeHtml(draft.aiDraft.model || "")}</span>` : ""}
        ${draft.aiDraftError ? `<span class="tag warn">fallback deterministico</span>` : ""}
        ${draft.blockedByRejectedPattern ? `<span class="tag bad">padrao rejeitado antes</span>` : ""}
        <span class="tag warn">teste sem envio</span>
      </div>
      <div class="draft-text">${escapeHtml(draft.reply)}</div>
      <div class="item-meta">Evidencias: ${escapeHtml([...draft.audience.evidence, ...draft.intent.evidence].join(" / "))}</div>
      ${draft.missing.length ? `<div class="item-meta">Campos pendentes: ${escapeHtml(draft.missing.join(", "))}</div>` : ""}
      ${draft.gatheredFields?.length ? `<div class="item-meta">Dados ja coletados: ${escapeHtml(draft.gatheredFields.map(item => item.value && item.value !== "informado" && item.value !== "informada" ? `${item.label}: ${item.value}` : item.label).join(", "))}</div>` : ""}
      ${draft.pendingQuestion?.expectedFields?.length ? `<div class="item-meta">Proxima pergunta pendente: ${escapeHtml(draft.pendingQuestion.expectedFields.join(", "))}</div>` : ""}
      ${draft.aiDraft ? `<div class="item-meta">Humanizacao OpenAI: ${escapeHtml(draft.aiDraft.source || "openai")} / ${escapeHtml(formatDateTime(draft.aiDraft.at))}</div>` : ""}
      ${draft.learnedReply ? `<div class="item-meta">Aprendizado aplicado: ${escapeHtml(draft.learnedReply.optionTitle || draft.learnedReply.optionKey)} / similaridade ${Math.round(Number(draft.learnedReply.score || 0) * 100)}%</div>` : ""}
      ${draft.aiDraftError ? `<div class="item-meta">OpenAI indisponivel: ${escapeHtml(draft.aiDraftError)}</div>` : ""}
      <div class="item-meta">Decisao do agente: ${escapeHtml(draft.risk.reason)}</div>
      ${draft.quality.warnings.length ? `<div class="message-validation">${escapeHtml(draft.quality.warnings.join(" / "))}</div>` : ""}
      <div class="message-validation">${escapeHtml(draft.guardrail)}</div>
    `;
  }

  function renderSelectedMessage() {
    const message = selectedMessage();
    if (!message) {
      el.selectedMessageMeta.textContent = "Nenhuma mensagem live selecionada.";
      return;
    }
    el.selectedMessageMeta.textContent = `${messageTitle(message)} / ${messageMeta(message)} / id ${message.id || "sem id"}`;
    if (state.sourceMode === "live") {
      el.testMessage.value = safeMessageText(message);
    }
  }

  function liveMessageCard(message) {
    const selected = message.id && message.id === state.selectedMessageId;
    const study = message.responseStudy || {};
    const text = safeMessageText(message);
    const option = optionByKey(detectIntent(text, message).optionKey) || (study.options || [])[0];
    const validation = validationText(message);
    return `
      <article class="item ${selected ? "selected" : ""}" data-message-id="${escapeHtml(message.id || "")}">
        <div class="item-header">
          <div>
            <div class="item-title">${escapeHtml(messageTitle(message))}</div>
            <div class="item-meta">${escapeHtml(messageMeta(message))}</div>
          </div>
          <span class="tag ${message.queueState?.resolved ? "ok" : "warn"}">${message.queueState?.resolved ? "resolvido" : "teste"}</span>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(option.title || option.key || "RH")}</span>
          ${study.audience?.label ? `<span class="tag info">${escapeHtml(study.audience.label)}</span>` : ""}
        </div>
        <div class="message">${escapeHtml(text || "[sem texto]")}</div>
        ${validation ? `<div class="message-validation">${escapeHtml(validation)}</div>` : ""}
        <button type="button" data-select-message="${escapeHtml(message.id || "")}">Usar no teste</button>
      </article>
    `;
  }

  function renderLiveMessages() {
    const messages = currentMessages().slice(0, 60);
    el.liveMessageCount.textContent = String(messages.length);
    el.liveMessages.innerHTML = messages.length
      ? messages.map(liveMessageCard).join("")
      : `<div class="empty">Aguardando mensagens live do RH.</div>`;
  }

  function renderLogs() {
    const pending = loadPendingLearning().length;
    const byType = state.logs.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    el.logStats.innerHTML = `
      <span class="tag">total ${state.logs.length}</span>
      <span class="tag ${pending ? "warn" : "ok"}">pendentes ${pending}</span>
      ${Object.entries(byType).slice(0, 8).map(([type, count]) => `<span class="tag">${escapeHtml(type)} ${count}</span>`).join("")}
    `;
    const rows = state.logs.slice(-80).reverse();
    el.testLogs.innerHTML = rows.length
      ? rows.map(log => `
        <article class="log-entry ${escapeHtml(log.tone || "info")}">
          <div class="log-head">
            <div class="item-title">${escapeHtml(log.title)}</div>
            <span class="tag">${escapeHtml(log.type)}</span>
          </div>
          <div class="item-meta">${escapeHtml(formatDateTime(log.at))}</div>
          <div class="log-details">${escapeHtml(JSON.stringify(log.details || {}, null, 2))}</div>
        </article>
      `).join("")
      : `<div class="empty">Nenhum log de teste registrado neste navegador.</div>`;
  }

  function render() {
    renderConnection();
    renderTraining();
    renderManualLearningTopics();
    renderQuickScenarios();
    renderSelectedMessage();
    renderDraft();
    renderChat();
    renderLiveMessages();
    renderLogs();
  }

  function selectMessage(messageId) {
    state.selectedMessageId = messageId;
    state.sourceMode = "live";
    clearConversationState();
    document.querySelectorAll("[data-source-mode]").forEach(button => {
      button.classList.toggle("active", button.dataset.sourceMode === "live");
    });
    const message = selectedMessage();
    if (message) {
      el.testMessage.value = safeMessageText(message);
      addLog("select", "Mensagem live selecionada para teste", {
        messageId,
        title: messageTitle(message),
        optionKey: (message.responseStudy?.options || [])[0]?.key || ""
      });
    }
    render();
  }

  function useLatestPending() {
    const message = (state.summary?.attentionQueue || [])[0] || currentMessages()[0];
    if (!message?.id) {
      addLog("warn", "Nao ha mensagem live disponivel para selecionar", { tone: "warn" });
      return;
    }
    selectMessage(message.id);
  }

  async function copyLogs() {
    const payload = JSON.stringify(state.logs, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      addLog("export", "Logs copiados para a area de transferencia", { count: state.logs.length });
    } catch (error) {
      addLog("error", "Falha ao copiar logs", { error: String(error.message || error), tone: "bad" });
    }
  }

  function downloadLogs() {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `whatsapp-rh-ai-test-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addLog("export", "Download de logs preparado", { count: state.logs.length });
  }

  function bindEvents() {
    document.querySelectorAll("[data-source-mode]").forEach(button => {
      button.addEventListener("click", () => {
        state.sourceMode = button.dataset.sourceMode || "typed";
        document.querySelectorAll("[data-source-mode]").forEach(item => item.classList.toggle("active", item === button));
        if (state.sourceMode === "live" && selectedMessage()) {
          el.testMessage.value = safeMessageText(selectedMessage());
        }
        clearConversationState();
        addLog("mode", "Fonte do teste alterada", { sourceMode: state.sourceMode });
        renderSelectedMessage();
      });
    });
    el.generateBtn.addEventListener("click", generateDraft);
    el.useLatestBtn.addEventListener("click", useLatestPending);
    el.clearChatBtn.addEventListener("click", clearChatSession);
    el.retryLearningBtn.addEventListener("click", flushPendingLearning);
    el.runSuiteBtn.addEventListener("click", runQualitySuite);
    el.approveBtn.addEventListener("click", () => logHumanAction("approve"));
    el.correctBtn.addEventListener("click", () => logHumanAction("correct"));
    el.rejectBtn.addEventListener("click", () => logHumanAction("reject"));
    el.teachBtn.addEventListener("click", sendLearning);
    el.manualLearningBtn?.addEventListener("click", submitManualLearning);
    el.copyLogsBtn.addEventListener("click", copyLogs);
    el.downloadLogsBtn.addEventListener("click", downloadLogs);
    el.liveMessages.addEventListener("click", event => {
      const button = event.target.closest("[data-select-message]");
      if (!button) return;
      selectMessage(button.dataset.selectMessage || "");
    });
    el.quickScenarios?.addEventListener("click", event => {
      const button = event.target.closest("[data-quick-scenario]");
      if (!button) return;
      const scenario = QUICK_SCENARIOS[Number(button.dataset.quickScenario)];
      if (!scenario) return;
      state.sourceMode = "typed";
      clearConversationState();
      state.selectedMessageId = "";
      document.querySelectorAll("[data-source-mode]").forEach(item => item.classList.toggle("active", item.dataset.sourceMode === "typed"));
      el.testMessage.value = scenario.text;
      addLog("scenario", "Cenario rapido carregado", { label: scenario.label, tone: "info" });
      render();
      generateDraft();
    });
    el.testMessage.addEventListener("input", () => {
      if (state.sourceMode !== "typed") return;
      state.lastDraft = null;
      if (!el.testMessage.value.trim()) {
        clearConversationState();
      }
      renderDraft();
    });
  }

  window.TKA_RH_AI_TEST_INTERNALS = {
    buildDraftForInput,
    createConversationContext,
    rememberLearnedReply,
    rememberManualLearnedReply,
    manualLearningPayload,
    loadLearnedReplies,
    declaredAnswerFor,
    RH_DECLARED_ANSWER_BANK,
    runQualitySuite,
    normalizeText
  };

  applySeedData();
  loadLogs();
  loadChatMessages();
  loadConversationState();
  bindEvents();
  render();
  addLog("load", "RH AI Test Lab aberto", {
    url: location.href,
    logKey: TEST_LOG_KEY,
    pendingKey: TEST_FEEDBACK_QUEUE_KEY
  });
  connectFirestore();
  setInterval(() => flushPendingLearning({ silentNoop: true }), 20000);
})();
