(function () {
  const STORAGE_KEY = "tka_workflows_builder_state_v1";
  const MAX_LOGS = 120;
  const MAX_PROMPT_TESTS = 40;
  const CLOUD_FUNCTIONS_BASE_URL = "https://southamerica-east1-cadastro-clientes-tka.cloudfunctions.net";
  const CLOUD_RH_AI_DRAFT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/rhAiDraft`;
  const WORKFLOW_HELP_AI_TIMEOUT_MS = 12000;
  const WORKFLOW_HELP_AI_NOTE = "A IA usa o mesmo endpoint RH quando disponivel. Se falhar, a ajuda local continua funcionando.";
  const HELP_TOPICS = {
    start: {
      title: "Comece por aqui",
      body: [
        "1. Escolha um modelo pronto: WhatsApp RH, Email, Documentos ou Webhook/API.",
        "2. Escreva o objetivo em uma frase simples: o que entra, o que o agente faz e quem aprova.",
        "3. Toque nos blocos do desenho para editar textos, API, prompt e mensagens.",
        "4. Complete apenas os campos marcados como pendentes.",
        "5. Clique em Validar agora. Quando ficar pronto, copie o resumo seguro para montar no n8n."
      ]
    },
    recipes: {
      title: "Modelos prontos",
      body: [
        "Use um modelo quando nao souber por onde comecar.",
        "WhatsApp RH cria a base para atendimento com aprovacao humana.",
        "Email RH prepara entrada por email e resposta segura.",
        "Documentos serve para anexos, curriculos, atestados e comprovantes.",
        "Webhook/API serve quando outro sistema vai enviar ou receber dados."
      ]
    },
    objective: {
      title: "Objetivo",
      body: [
        "Objetivo e a frase que diz o que o fluxo deve resolver.",
        "Exemplo bom: Receber pedido no WhatsApp RH, identificar o assunto, criar resposta inicial e pedir aprovacao do RH antes de enviar.",
        "Evite objetivo vago como: automatizar RH. O agente precisa saber entrada, acao e aprovacao."
      ]
    },
    n8nCanvas: {
      title: "Desenho do fluxo",
      body: [
        "Cada quadrado e uma etapa do fluxo.",
        "As linhas mostram para onde a informacao vai depois.",
        "Toque em um quadrado para abrir o editor dele.",
        "Arraste para organizar. Use zoom se estiver pequeno. Use Realinhar se baguncar."
      ]
    },
    summaryCanvas: {
      title: "Canvas resumido",
      body: [
        "Este desenho menor mostra as integracoes principais: Webhook, Agente, WhatsApp, Email e Documentos.",
        "Toque em uma caixa para abrir o painel de configuracao dela.",
        "Vermelho ou pendente significa que ainda falta preencher algo."
      ]
    },
    validation: {
      title: "Validacao",
      body: [
        "A validacao nao ativa nada sozinha. Ela apenas mostra o que falta.",
        "Se aparecer pendencia, clique na caixa ou no item indicado e preencha o campo.",
        "So considere pronto quando objetivo, integracao, credenciais e aprovacao humana estiverem corretos."
      ]
    },
    webhook: {
      title: "Webhook",
      body: [
        "Webhook e uma porta de entrada. Outro sistema manda dados para essa URL.",
        "No n8n, abra o bloco Webhook e copie a URL de producao.",
        "Metodo normalmente e POST.",
        "Chave/header e como uma senha de entrada. Nao mostre essa chave em prints ou mensagens."
      ]
    },
    whatsapp: {
      title: "WhatsApp RH",
      body: [
        "Serve para receber pedido do colaborador e preparar resposta.",
        "O numero deve ter DDI e DDD, exemplo +55 12 99999-9999.",
        "QR autorizado quer dizer que o WhatsApp do bridge ja foi conectado.",
        "Aprovacao humana deve ficar ativa para o agente nao enviar resposta final sozinho."
      ]
    },
    email: {
      title: "Email",
      body: [
        "Use Email quando a entrada ou resposta passar por caixa de email.",
        "Se ja existe credencial no n8n, selecione Credencial ja criada no n8n e informe o ID/nome da credencial.",
        "Se for SMTP, preencha host, porta, usuario, remetente e senha/token.",
        "Use senha de app ou token quando o provedor oferecer. Evite senha pessoal."
      ]
    },
    documents: {
      title: "Documentos",
      body: [
        "Use Documentos para curriculo, atestado, holerite, comprovante, imagem ou PDF.",
        "Destino seguro e onde o arquivo vai ficar guardado.",
        "Leitura automatica pode extrair texto, mas RH humano precisa revisar antes de aceitar.",
        "Historico preservado significa nao apagar arquivos ou registros antigos."
      ]
    },
    prompt: {
      title: "Prompt do agente",
      body: [
        "Prompt e a regra de comportamento do agente.",
        "Aqui ele fala como suporte RH TKA, pede dados minimos e encaminha risco para humano.",
        "Nao cole senha, token ou dados sensiveis no prompt.",
        "O prompt prepara resposta, mas nao deve autorizar envio final sozinho."
      ]
    },
    promptTest: {
      title: "Teste local",
      body: [
        "Cole uma mensagem parecida com a que o RH recebe.",
        "O teste mostra uma resposta inicial segura.",
        "Isso nao envia WhatsApp, nao muda fila e nao prova producao. E apenas um ensaio."
      ]
    },
    messages: {
      title: "Janelas de mensagem",
      body: [
        "Uma janela e um rascunho separado de resposta ou payload.",
        "Use para guardar mensagens diferentes: WhatsApp, email, documento ou webhook.",
        "Voce pode editar o texto antes de copiar ou usar no n8n."
      ]
    },
    logs: {
      title: "Logs claros",
      body: [
        "Logs mostram acoes importantes feitas nesta tela.",
        "Eles devem falar em linguagem humana, nao erro tecnico.",
        "Nao use logs como lugar para guardar senha ou token."
      ]
    },
    glossary: {
      title: "Traducao dos termos",
      body: [
        "Bloco ou node: uma etapa do caminho, como receber WhatsApp, ler documento ou mandar email.",
        "Linha ou conexao: a seta que mostra para onde a informacao vai depois.",
        "Webhook: uma porta de entrada. Outro sistema chama essa URL para iniciar o fluxo.",
        "API: uma conversa entre sistemas. Exemplo: n8n pedindo para uma API enviar mensagem.",
        "Credencial: senha, token ou chave guardada em local seguro. Na producao, use credenciais do n8n."
      ]
    },
    connectionPrep: {
      title: "O que preciso ter em maos",
      body: [
        "WhatsApp: numero correto, QR/bridge autorizado, responsavel humano e regra de aprovacao.",
        "Email: provedor, remetente, host ou credencial n8n, porta e senha de app/token quando for SMTP.",
        "Documentos: origem dos anexos, pasta/destino seguro, tipos aceitos e quem revisa antes de aceitar.",
        "Webhook/API: URL de producao, metodo, nome do header/chave e onde a resposta deve ir.",
        "Se ainda nao tiver algum item, deixe pendente. A tela deve explicar o que falta sem ativar nada."
      ]
    },
    selectedNode: {
      title: "Bloco selecionado",
      body: [
        "O bloco selecionado e o quadrado que voce tocou no desenho.",
        "Edite o titulo, descricao, API, prompt, mensagem e observacoes desse bloco.",
        "Campos de credencial devem dizer qual credencial usar no n8n, sem colar segredo real no texto."
      ]
    }
  };
  const TKA_RH_SUPPORT_AGENT_PROMPT = [
    "PAPEL",
    "Atue como atendente senior de suporte da empresa Grupo TKA / TKA Seguranca Privada. Sua personalidade e cordial, acolhedora, objetiva, paciente e resolutiva. Voce fala portugues brasileiro, em mensagens claras adaptadas para WhatsApp.",
    "",
    "ACAO",
    "Receber duvidas e solicitacoes de colaboradores, ex-colaboradores, candidatos e contatos operacionais existentes via WhatsApp RH. Resolver somente orientacoes de baixo risco que estejam na base de conhecimento. Encaminhar para humano quando a solicitacao exigir validacao de RH, conferencia de cadastro, calculo, documento, pagamento, decisao trabalhista, dado sensivel ou quando faltar informacao.",
    "",
    "Sua missao e organizar a conversa na primeira resposta sempre que possivel: identificar vinculo, nome e sobrenome, assunto, dados minimos e risco. Nunca chutar resposta. Em duvida, encaminhe para humano.",
    "",
    "CONTEXTO",
    "A empresa Grupo TKA / TKA Seguranca Privada atua no segmento de seguranca privada, monitoramento remoto, portaria e controle de acesso, operacoes de postos e rotinas internas de RH para colaboradores.",
    "",
    "Nossos produtos/servicos principais sao:",
    "- Seguranca patrimonial e vigilancia.",
    "- Portaria, controle de acesso e apoio operacional em postos.",
    "- Monitoramento remoto de alarmes, cameras e informes horarios.",
    "- Atendimento RH interno via WhatsApp para colaboradores, ex-colaboradores e candidatos.",
    "- Gestao de documentos, admissao, contratos, escalas, FT, ferias, beneficios e pendencias trabalhistas com aprovacao humana.",
    "",
    "Nossas regras e politicas mais importantes:",
    "",
    "Politica de entrega:",
    "Este agente nao entrega produto fisico nem documento final. Ele coleta dados minimos, orienta o proximo passo e encaminha para RH humano quando houver documento, pagamento, prazo, calculo ou decisao. Quando houver comprovante, atestado, curriculo ou anexo, peca para enviar no WhatsApp e registre a pendencia.",
    "",
    "Politica de troca e devolucao:",
    "Nao se aplica a vendas. Para uniforme, cracha, cartao de beneficio, equipamento ou documento com problema, coletar nome e sobrenome, telefone, posto, item afetado, data do ocorrido e comprovante ou foto quando existir. Nao aprovar troca, segunda via, desconto, estorno ou reposicao sem validacao humana.",
    "",
    "Politica de cancelamento:",
    "Nao se aplica a pedidos comerciais. Para desligamento, rescisao, cancelamento de beneficio, desistenca de vaga, exclusao de cadastro ou qualquer tema trabalhista sensivel, nao decidir. Responder que vai conectar com especialista humano e marcar como pendencia.",
    "",
    "Horario de atendimento humano:",
    "Atendimento humano em horario comercial de dias uteis, conforme disponibilidade do RH. Fora desse periodo, registrar a solicitacao e informar que o RH humano retornara no proximo atendimento disponivel. Nao prometer horario exato.",
    "",
    "Canais de contato adicionais:",
    "Telefone - usar o proprio WhatsApp RH por onde a pessoa entrou; se pedir outro numero, marcar pendencia para humano confirmar.",
    "E-mail - rh@grupotka.com.br",
    "Site - https://gerenciamento-tka.web.app/whatsappRH/ e painel interno de operacao e nao deve ser enviado ao colaborador como canal publico.",
    "",
    "Duvidas frequentes e respostas padrao:",
    "P: Bom dia, oi, preciso falar com RH ou mensagem sem assunto claro.",
    "R: Ola! Por gentileza, informe seu nome e sobrenome e me diga se voce e funcionario da TKA, ex-funcionario ou candidato. Assim consigo direcionar seu atendimento corretamente.",
    "",
    "P: A pessoa enviou nome e sobrenome que bate com uma base interna de colaboradores disponivel no fluxo.",
    "R: Localizei um possivel cadastro com esse nome. Confirma se e voce? Se sim, me diga qual assunto precisa tratar para eu encaminhar corretamente.",
    "",
    "P: Preciso do holerite ou comprovante de pagamento.",
    "R: Por gentileza, informe nome e sobrenome e a competencia do holerite. Vou encaminhar para conferencia do RH e retorno seguro.",
    "",
    "P: Meu VR, VA, VT ou cartao de beneficio nao caiu, esta bloqueado ou foi perdido.",
    "R: Entendi. Informe nome e sobrenome, qual beneficio foi afetado, quando percebeu o problema e se aparece alguma mensagem no cartao ou aplicativo. O RH precisa validar antes de confirmar valor, prazo ou segunda via.",
    "",
    "P: Minha FT, folga trabalhada, pagamento ou desconto esta pendente.",
    "R: Por gentileza, informe nome e sobrenome, posto, data da FT ou ocorrencia e o que ficou pendente. Se for FT nao paga, envie tambem a chave PIX para conferencia do RH. Valor e pagamento dependem de validacao humana.",
    "",
    "P: Quero falar sobre ferias.",
    "R: Claro. Informe nome e sobrenome e diga se a duvida e sobre periodo desejado, ferias ja marcadas ou saldo. O RH vai conferir a situacao antes de confirmar qualquer data.",
    "",
    "P: Tenho atestado, falta, atraso, escala, folga ou cobertura.",
    "R: Entendido. Informe nome e sobrenome, posto, data, horario afetado e anexe o comprovante quando existir. Vou encaminhar para validacao do RH ou supervisao.",
    "",
    "P: Quero enviar curriculo ou sou candidato.",
    "R: Obrigado pelo contato. Envie nome completo, telefone, cidade, funcao pretendida e o curriculo em anexo. O RH vai analisar e retornar se houver aderencia.",
    "",
    "EXPECTATIVA",
    "Responda em mensagens curtas, no maximo 3 a 4 linhas, no formato WhatsApp.",
    "",
    "Sempre cumprimente o cliente pelo nome se ele se identificou.",
    "",
    "Quando souber a resposta com certeza, responda direto e claro, sem rodeios.",
    "",
    "Quando NAO souber, ou quando o cliente solicitar cancelamento de pedido, reembolso ou estorno, reclamacao seria, problema tecnico complexo, desligamento, rescisao, decisao trabalhista, conferencia de valor, pagamento, documento oficial ou algo fora das politicas acima, responda: \"Vou conectar voce com um especialista humano que resolve isso agora. Aguarde um instante.\"",
    "E marque a conversa como pendencia para atendimento humano.",
    "",
    "NUNCA prometa prazo, valor ou condicao que nao esta nas politicas acima.",
    "",
    "NUNCA invente informacao sobre produto, servico, prazo, politica, escala, pagamento, beneficio, contrato ou documento.",
    "",
    "NUNCA discuta com cliente irritado. Em sinal de irritacao, acusacao, ameaca juridica ou reclamacao seria, escale para humano imediatamente.",
    "",
    "NUNCA envie ou autorize envio automatico de resposta final sem etapa de aprovacao humana no fluxo TKA. O agente pode preparar resposta, coletar dados e classificar risco, mas RH humano decide fechamento, envio final, pagamento, documento, alteracao oficial e orientacao trabalhista.",
    "",
    "SEMPRE pergunte nome e sobrenome quando a pessoa nao se identificar.",
    "",
    "SE uma base interna de colaboradores estiver conectada e o nome tiver match unico, confirme o nome encontrado e pergunte o assunto. Nao pergunte novamente se a pessoa e funcionaria da TKA.",
    "",
    "NAO peca data de nascimento, data de admissao, posto, funcao ou status ativo como validacao, a menos que esses campos existam na base conectada ao fluxo e sejam necessarios para aquela solicitacao.",
    "",
    "Aceite texto com ou sem acento, como funcionario, funcionário, ex funcionario, ex-funcionario, ferias, férias, holerite, olerite, VR, VA, VT e FT.",
    "",
    "FORMATO DE SAIDA: apenas texto puro, sem markdown, sem emojis em excesso, no maximo 1 emoji por mensagem, sem formatacao especial."
  ].join("\n");

  const N8N_NODE_WIDTH = 250;
  const N8N_NODE_HEIGHT = 170;
  const N8N_SCALE = 0.68;
  const N8N_PADDING = 48;
  const N8N_ZOOM_MIN = 0.35;
  const N8N_ZOOM_MAX = 2.25;
  const N8N_ZOOM_STEP = 0.15;
  const N8N_NODE_SCALE_MIN = 0.75;
  const N8N_NODE_SCALE_MAX = 1.7;
  const N8N_NODE_SCALE_STEP = 0.1;
  const N8N_EDGE_TYPES = ["main", "ai_languageModel", "ai_memory", "ai_tool"];
  const N8N_NODE_KINDS = ["trigger", "wait", "agent", "model", "memory", "tool", "action"];
  const N8N_NODE_KIND_LABELS = {
    trigger: "Gatilho",
    wait: "Espera",
    agent: "Agente",
    model: "Modelo",
    memory: "Memoria",
    tool: "Ferramenta",
    action: "Acao"
  };
  const N8N_EDGE_TYPE_LABELS = {
    main: "principal",
    ai_languageModel: "modelo de linguagem",
    ai_memory: "memoria",
    ai_tool: "ferramenta"
  };
  const N8N_FIELD_LABELS_PT = {
    "Method": "Metodo",
    "Headers": "Cabecalhos",
    "Credential": "Credencial",
    "Options": "Opcoes",
    "System message": "Mensagem do sistema",
    "Remote JID": "JID remoto",
    "Session key": "Chave da sessao",
    "Context": "Contexto",
    "Model": "Modelo",
    "Prompt": "Prompt",
    "Fallback": "Fallback",
    "Workflow": "Fluxo",
    "Parameters": "Parametros",
    "Parametros": "Parametros"
  };
  const FLOW_CONFIG_TARGETS = {
    agent: {
      selector: ".objective-panel",
      focusSelector: "#objectiveInput",
      label: "objetivo do agente"
    },
    webhook: {
      selector: '[data-panel="webhook"]',
      focusSelector: "#webhookEnabled",
      label: "Webhook n8n"
    },
    whatsapp: {
      selector: '[data-panel="whatsapp"]',
      focusSelector: "#whatsappEnabled",
      label: "WhatsApp RH"
    },
    email: {
      selector: '[data-panel="email"]',
      focusSelector: "#emailEnabled",
      label: "Email"
    },
    documents: {
      selector: '[data-panel="documents"]',
      focusSelector: "#documentsEnabled",
      label: "Documentos"
    }
  };
  const INTEGRATION_ORDER = ["webhook", "whatsapp", "email", "documents"];
  const PLAIN_LANGUAGE_CARDS = [
    {
      title: "Nada e enviado sozinho",
      detail: "Esta tela monta um rascunho explicado. Ela nao envia WhatsApp, nao manda email, nao ativa n8n e nao grava documento de producao.",
      help: "start"
    },
    {
      title: "Entrada, decisao e saida",
      detail: "Entrada e de onde vem o pedido. Decisao e o agente lendo regras. Saida e mensagem, email, documento ou API depois da aprovacao.",
      help: "glossary"
    },
    {
      title: "Senha fica fora do texto",
      detail: "Chave, token e senha devem ir em credencial segura do n8n. O resumo desta pagina mostra apenas que existe credencial, sem revelar valor.",
      help: "connectionPrep"
    }
  ];
  const INTEGRATION_GUIDES = {
    webhook: {
      title: "Webhook / API",
      icon: "WH",
      iconClass: "webhook-icon",
      target: "panel:webhook",
      help: "webhook",
      needs: [
        "URL de producao do Webhook no n8n.",
        "Metodo usado pelo outro sistema, normalmente POST.",
        "Nome do header de seguranca, por exemplo x-tka-key.",
        "Chave secreta guardada em credencial ou campo seguro."
      ],
      never: "Nao publique a URL com chave em prints, grupos ou documento aberto."
    },
    whatsapp: {
      title: "WhatsApp RH",
      icon: "WA",
      iconClass: "whatsapp-icon",
      target: "panel:whatsapp",
      help: "whatsapp",
      needs: [
        "Numero completo com pais e DDD.",
        "Bridge/QR conectado no WhatsApp correto.",
        "Pessoa ou setor que aprova a resposta.",
        "Confirmacao de que o historico antigo nao sera apagado."
      ],
      never: "Nao deixe o agente enviar resposta final sem humano aprovando."
    },
    email: {
      title: "Email",
      icon: "EM",
      iconClass: "email-icon",
      target: "panel:email",
      help: "email",
      needs: [
        "Provedor ou credencial ja criada no n8n.",
        "Remetente que aparecera para quem recebe.",
        "Host e porta quando for SMTP.",
        "Senha de app ou token, nao senha pessoal comum."
      ],
      never: "Nao cole senha real em prompt, observacao, mensagem ou print."
    },
    documents: {
      title: "Documentos",
      icon: "DOC",
      iconClass: "documents-icon",
      target: "panel:documents",
      help: "documents",
      needs: [
        "De onde chegam os anexos: WhatsApp, email, pasta ou API.",
        "Pasta, Drive, bucket ou local seguro de armazenamento.",
        "Tipos aceitos: PDF, imagem, DOCX, curriculo, atestado.",
        "Pessoa que revisa antes de aceitar ou responder."
      ],
      never: "Nao substitua arquivo antigo nem aceite documento sensivel sem revisao humana."
    }
  };
  const OBJECTIVE_EXAMPLES = {
    whatsapp: "Receber pedidos pelo WhatsApp RH, identificar o assunto, pedir dados minimos, preparar uma resposta curta e esperar aprovacao humana antes de enviar.",
    email: "Receber emails do RH, classificar o assunto, preparar resposta com remetente seguro e encaminhar casos sensiveis para um humano revisar.",
    documents: "Receber documentos por WhatsApp ou email, registrar o anexo sem apagar historico, identificar o tipo de documento e pedir revisao humana antes de aceitar.",
    api: "Receber dados por Webhook/API, validar se a chave esta correta, organizar as informacoes e enviar uma resposta segura para o sistema de origem."
  };
  const FIELD_HELP_TEXT = {
    workflowNameInput: "Use um nome facil de reconhecer depois, por exemplo: RH WhatsApp com aprovacao.",
    objectiveInput: "Explique o resultado esperado. Nao precisa ser tecnico.",
    n8nWorkflowSelect: "Escolha qual arquivo importado quer ver no desenho.",
    n8nNewNodeKindSelect: "Use isto para adicionar uma nova etapa local ao desenho.",
    n8nEdgeSelect: "Linha e a conexao entre dois blocos.",
    n8nSourceSelect: "Origem e o bloco de onde a informacao sai.",
    n8nEdgeTypeSelect: "Tipo principal e o caminho normal. Tipos de IA conectam modelo, memoria ou ferramenta ao agente.",
    n8nTargetSelect: "Destino e o bloco que recebe a informacao.",
    webhookUrlInput: "Cole a URL de producao do Webhook que o n8n mostra. Nao use URL de teste se for fluxo real.",
    webhookMethodInput: "Normalmente use POST para receber dados.",
    webhookKeyNameInput: "Nome do header de seguranca. Exemplo: x-tka-key.",
    webhookSecretInput: "Chave secreta de entrada. Nao envie essa chave em print ou mensagem.",
    whatsappNumberInput: "Digite com pais e DDD. Exemplo: +55 12 99999-9999.",
    whatsappOwnerInput: "Pessoa ou setor que vai aprovar as respostas.",
    whatsappStarterInput: "Primeira frase que o colaborador pode receber, sempre curta e educada.",
    whatsappModeInput: "Use aprovacao humana para o agente preparar, mas nao enviar sozinho.",
    emailProviderInput: "Escolha se vai usar SMTP ou uma credencial ja salva no n8n.",
    emailHostInput: "Se for SMTP, informe o servidor. Se for credencial n8n, informe o nome ou ID da credencial.",
    emailPortInput: "Porta comum: 587. Use a porta do provedor se ele indicar outra.",
    emailUserInput: "Email usado para autenticar no servidor.",
    emailFromInput: "Email que aparecera como remetente para quem receber.",
    emailSecretInput: "Use senha de app ou token. Evite senha pessoal.",
    documentsSourceInput: "De onde o arquivo chega: WhatsApp, email, pasta ou API.",
    documentsStorageInput: "Onde o arquivo sera guardado com seguranca.",
    documentsParserInput: "Escolha se o fluxo so registra, le texto, classifica ou extrai campos.",
    documentsTypesInput: "Liste os tipos aceitos, como PDF, imagem, DOCX, curriculo ou atestado.",
    testMessageInput: "Cole uma mensagem de exemplo recebida pelo RH para testar a resposta inicial.",
    messageChannelInput: "Canal da janela de rascunho.",
    messageAskInput: "Resumo simples do pedido recebido.",
    messageRecipientInput: "Nome, telefone ou email de quem vai receber."
  };
  const N8N_CUSTOM_NODE_TEMPLATES = {
    api: {
      name: "API Request",
      kind: "action",
      glyph: "API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: "4.1",
      summary: "Chamada de API configurada pelo operador.",
      fields: [["Method", "POST"], ["URL", "preencher endpoint"], ["Headers", "usar credencial n8n"]]
    },
    text: {
      name: "Texto mensagem",
      kind: "action",
      glyph: "MSG",
      type: "n8n-nodes-base.set",
      typeVersion: "3.4",
      summary: "Texto ou mensagem que o fluxo deve preparar.",
      fields: [["Texto", "preencher mensagem"], ["Canal", "WhatsApp, email ou webhook"]]
    },
    prompt: {
      name: "Prompt agente",
      kind: "agent",
      glyph: "AI",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: "3",
      summary: "Prompt ou instrucao para o agente automatico.",
      fields: [["Prompt", "preencher instrucao"], ["Saida", "rascunho para aprovacao humana"]]
    },
    webhook: {
      name: "Webhook",
      kind: "trigger",
      glyph: "WH",
      type: "n8n-nodes-base.webhook",
      typeVersion: "2.1",
      summary: "Entrada HTTP para receber dados externos.",
      fields: [["Metodo", "POST"], ["Path", "preencher caminho"], ["Seguranca", "header ou credential"]]
    },
    whatsapp: {
      name: "WhatsApp",
      kind: "action",
      glyph: "WA",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: "4.1",
      summary: "Mensagem WhatsApp com revisao humana.",
      fields: [["Numero", "preencher destinatario"], ["Mensagem", "preencher texto"], ["Aprovacao", "humano revisa antes de enviar"]]
    },
    email: {
      name: "Email",
      kind: "action",
      glyph: "EM",
      type: "n8n-nodes-base.emailSend",
      typeVersion: "2.1",
      summary: "Envio de email com credential do n8n.",
      fields: [["Para", "preencher destinatario"], ["Assunto", "preencher assunto"], ["Credential", "selecionar no n8n"]]
    },
    document: {
      name: "Documento",
      kind: "action",
      glyph: "DOC",
      type: "n8n-nodes-base.extractFromFile",
      typeVersion: "1",
      summary: "Recebe, registra e prepara documentos para revisao humana.",
      fields: [["Entrada", "WhatsApp, email, Drive ou webhook"], ["Tipos", "PDF, imagem, DOCX"], ["Revisao", "RH humano confirma antes de aceitar"]]
    },
    tool: {
      name: "Tool",
      kind: "tool",
      glyph: "TO",
      type: "@n8n/n8n-nodes-langchain.toolWorkflow",
      typeVersion: "2.2",
      summary: "Tool chamada pelo agente para executar outra tarefa.",
      fields: [["Descricao", "preencher quando usar"], ["Workflow", "preencher workflow destino"]]
    },
    memory: {
      name: "Memoria",
      kind: "memory",
      glyph: "ME",
      type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: "1.3",
      summary: "Memoria de conversa para manter contexto.",
      fields: [["Session key", "{{$json.sessionId}}"], ["Janela", "30 mensagens"]]
    }
  };
  const IMPORTED_N8N_WORKFLOW = {
    id: "workflow-1",
    label: "Fluxo 1 - Evolution API",
    name: "My workflow 5",
    sourceFile: "tkaworkflow.json",
    variant: "Evolution API + Postgres memory",
    objectiveSuggestion: "Receber mensagem por Webhook, aguardar, processar com AI Agent, usar Postgres Chat Memory e enviar texto pela Evolution API com aprovacao humana.",
    active: false,
    nodes: [
      {
        name: "Webhook",
        kind: "trigger",
        glyph: "WH",
        type: "n8n-nodes-base.webhook",
        typeVersion: "2.1",
        position: [0, 0],
        summary: "Recebe entrada POST do fluxo.",
        fields: [
          ["Metodo", "POST"],
          ["Path", "0e80125a-4ebf-4ba8-aa9c-c7812bf78cb6"],
          ["Options", "sem opcoes personalizadas"]
        ]
      },
      {
        name: "Wait",
        kind: "wait",
        glyph: "WT",
        type: "n8n-nodes-base.wait",
        typeVersion: "1.1",
        position: [352, 0],
        summary: "Pausa o fluxo antes do agente.",
        fields: [["Parametros", "bloco sem parametros no export"]]
      },
      {
        name: "OpenAI Chat Model1",
        kind: "model",
        glyph: "LM",
        type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        typeVersion: "1.2",
        position: [480, 368],
        summary: "Modelo de linguagem secundario conectado ao agente.",
        fields: [
          ["Modelo", "gpt-4.1"],
          ["Temperature", "0.3"]
        ]
      },
      {
        name: "OpenAI Chat Model",
        kind: "model",
        glyph: "LM",
        type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        typeVersion: "1.2",
        position: [704, 432],
        summary: "Modelo principal para o AI Agent.",
        fields: [
          ["Modelo", "gpt-4.1-mini"],
          ["Temperature", "0.3"]
        ]
      },
      {
        name: "AI Agent1",
        kind: "agent",
        glyph: "AI",
        type: "@n8n/n8n-nodes-langchain.agent",
        typeVersion: "3",
        position: [864, 16],
        summary: "Agente central. Recebe mensagem do usuario, usa memoria, modelos e tools.",
        fields: [
          ["Prompt", "Mensagem do usuario, nome do usuario e data/hora atual"],
          ["Fallback", "ativado"],
          ["System message", "prompt longo importado do fluxo original; revisar antes de producao TKA"]
        ]
      },
      {
        name: "Postgres Chat Memory",
        kind: "memory",
        glyph: "DB",
        type: "@n8n/n8n-nodes-langchain.memoryPostgresChat",
        typeVersion: "1.3",
        position: [928, 416],
        summary: "Memoria de conversa em Postgres para o agente.",
        fields: [["Parametros", "credenciais e detalhes ficam no n8n"]]
      },
      {
        name: "atendimento_humano",
        kind: "tool",
        glyph: "TO",
        type: "@n8n/n8n-nodes-langchain.toolWorkflow",
        typeVersion: "2.2",
        position: [1184, 496],
        summary: "Ferramenta que aciona outro fluxo para atendimento humano.",
        fields: [
          ["Descricao", "Acione esta tool para acionar o atendimento humano"],
          ["Workflow", "Atendimento Humano"],
          ["Inputs", "13 campos mapeados; tokens e telefone mascarados na tela"]
        ]
      },
      {
        name: "Think",
        kind: "tool",
        glyph: "TH",
        type: "@n8n/n8n-nodes-langchain.toolThink",
        typeVersion: "1",
        position: [1344, 496],
        summary: "Tool de raciocinio para o agente.",
        fields: [["Parametros", "bloco sem parametros no export"]]
      },
      {
        name: "Enviar texto",
        kind: "action",
        glyph: "WA",
        type: "n8n-nodes-evolution-api.evolutionApi",
        typeVersion: "1",
        position: [1360, 16],
        summary: "Envia mensagem via Evolution API.",
        fields: [
          ["Resource", "messages-api"],
          ["Instance", "Lucas"],
          ["Remote JID", "valor presente no fluxo; mascarado para revisao"],
          ["Message text", "Oi"]
        ]
      },
      {
        name: "Calculator",
        kind: "tool",
        glyph: "CL",
        type: "@n8n/n8n-nodes-langchain.toolCalculator",
        typeVersion: "1",
        position: [1456, 496],
        summary: "Tool de calculadora conectada ao agente.",
        fields: [["Parametros", "bloco sem parametros no export"]]
      }
    ],
    edges: [
      { source: "Webhook", target: "Wait", type: "main" },
      { source: "Wait", target: "AI Agent1", type: "main" },
      { source: "AI Agent1", target: "Enviar texto", type: "main" },
      { source: "OpenAI Chat Model1", target: "AI Agent1", type: "ai_languageModel" },
      { source: "OpenAI Chat Model", target: "AI Agent1", type: "ai_languageModel" },
      { source: "Postgres Chat Memory", target: "AI Agent1", type: "ai_memory" },
      { source: "atendimento_humano", target: "AI Agent1", type: "ai_tool" },
      { source: "Think", target: "AI Agent1", type: "ai_tool" },
      { source: "Calculator", target: "AI Agent1", type: "ai_tool" }
    ]
  };
  const IMPORTED_N8N_WORKFLOWS = [
    IMPORTED_N8N_WORKFLOW,
    {
      id: "workflow-2",
      label: "Fluxo 2 - HTTP Request",
      name: "My workflow 5",
      sourceFile: "tkaworkflow2.json",
      variant: "HTTP Request + Window Buffer Memory",
      objectiveSuggestion: "Receber mensagem por Webhook, aguardar, processar com AI Agent, usar Window Buffer Memory e enviar resposta por HTTP Request com valores sensiveis em credenciais n8n.",
      active: false,
      nodes: [
        {
          name: "Webhook",
          kind: "trigger",
          glyph: "WH",
          type: "n8n-nodes-base.webhook",
          typeVersion: "2.1",
          position: [0, 0],
          summary: "Recebe entrada POST do fluxo.",
          fields: [
            ["Metodo", "POST"],
            ["Path", "0e80125a-4ebf-4ba8-aa9c-c7812bf78cb6"],
            ["Options", "sem opcoes personalizadas"]
          ]
        },
        {
          name: "Wait",
          kind: "wait",
          glyph: "WT",
          type: "n8n-nodes-base.wait",
          typeVersion: "1.1",
          position: [352, 0],
          summary: "Pausa o fluxo antes do agente.",
          fields: [["Parametros", "bloco sem parametros no export"]]
        },
        {
          name: "OpenAI Chat Model1",
          kind: "model",
          glyph: "LM",
          type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          typeVersion: "1.2",
          position: [480, 368],
          summary: "Modelo de linguagem secundario conectado ao agente.",
          fields: [
            ["Modelo", "gpt-4.1"],
            ["Temperature", "0.3"]
          ]
        },
        {
          name: "OpenAI Chat Model",
          kind: "model",
          glyph: "LM",
          type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          typeVersion: "1.2",
          position: [704, 432],
          summary: "Modelo principal para o AI Agent.",
          fields: [
            ["Modelo", "gpt-4.1-mini"],
            ["Temperature", "0.3"]
          ]
        },
        {
          name: "AI Agent1",
          kind: "agent",
          glyph: "AI",
          type: "@n8n/n8n-nodes-langchain.agent",
          typeVersion: "3",
          position: [864, 16],
          summary: "Agente central. Recebe mensagem do usuario, usa memoria, modelos e tools.",
          fields: [
            ["Prompt", "Mensagem do usuario, nome do usuario e data/hora atual"],
            ["Fallback", "ativado"],
            ["System message", "prompt longo importado do fluxo original; revisar antes de producao TKA"]
          ]
        },
        {
          name: "Window Buffer Memory",
          kind: "memory",
          glyph: "WM",
          type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
          typeVersion: "1.3",
          position: [832, 432],
          summary: "Memoria de janela local com chave de sessao personalizada.",
          fields: [
            ["Session key", "{{$json.sessionId}}"],
            ["Context window", "30 mensagens"]
          ]
        },
        {
          name: "atendimento_humano",
          kind: "tool",
          glyph: "TO",
          type: "@n8n/n8n-nodes-langchain.toolWorkflow",
          typeVersion: "2.2",
          position: [1184, 496],
          summary: "Ferramenta que aciona outro fluxo para atendimento humano.",
          fields: [
            ["Descricao", "Acione esta tool para acionar o atendimento humano"],
            ["Workflow", "Atendimento Humano"],
            ["Inputs", "13 campos mapeados; tokens e telefone mascarados na tela"]
          ]
        },
        {
          name: "Think",
          kind: "tool",
          glyph: "TH",
          type: "@n8n/n8n-nodes-langchain.toolThink",
          typeVersion: "1",
          position: [1344, 496],
          summary: "Tool de raciocinio para o agente.",
          fields: [["Parametros", "bloco sem parametros no export"]]
        },
        {
          name: "Enviar Mensagem 1",
          kind: "action",
          glyph: "HTTP",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: "4.1",
          position: [1296, 0],
          summary: "Envia resposta por HTTP Request para API de mensagens.",
          fields: [
            ["Method", "POST"],
            ["URL", "Evolution API endpoint presente no export; host visivel, chave mascarada"],
            ["Headers", "apikey mascarada e Content-Type application/json"],
            ["Body", "numero e texto devem vir do fluxo; valores sensiveis mascarados"]
          ]
        },
        {
          name: "Calculator",
          kind: "tool",
          glyph: "CL",
          type: "@n8n/n8n-nodes-langchain.toolCalculator",
          typeVersion: "1",
          position: [1456, 496],
          summary: "Tool de calculadora conectada ao agente.",
          fields: [["Parametros", "bloco sem parametros no export"]]
        }
      ],
      edges: [
        { source: "Webhook", target: "Wait", type: "main" },
        { source: "Wait", target: "AI Agent1", type: "main" },
        { source: "AI Agent1", target: "Enviar Mensagem 1", type: "main" },
        { source: "OpenAI Chat Model1", target: "AI Agent1", type: "ai_languageModel" },
        { source: "OpenAI Chat Model", target: "AI Agent1", type: "ai_languageModel" },
        { source: "Window Buffer Memory", target: "AI Agent1", type: "ai_memory" },
        { source: "atendimento_humano", target: "AI Agent1", type: "ai_tool" },
        { source: "Think", target: "AI Agent1", type: "ai_tool" },
        { source: "Calculator", target: "AI Agent1", type: "ai_tool" }
      ]
    }
  ];

  const defaultState = {
    workflowName: "Fluxo n8n TKA",
    objective: "",
    selectedImportedWorkflow: "workflow-1",
    updatedAt: "",
    n8nEditorLayouts: {},
    integrations: {
      webhook: {
        enabled: false,
        url: "",
        method: "POST",
        keyName: "x-tka-key",
        secret: ""
      },
      whatsapp: {
        enabled: false,
        number: "",
        owner: "",
        starter: "Ola, sou o suporte RH da TKA. Como posso ajudar?",
        mode: "approval",
        qrChecked: false,
        humanChecked: true,
        historyChecked: false
      },
      email: {
        enabled: false,
        provider: "smtp",
        host: "",
        port: "587",
        user: "",
        from: "",
        secret: ""
      },
      documents: {
        enabled: false,
        source: "whatsapp",
        storage: "",
        parser: "manual",
        types: "PDF, imagem, DOCX",
        humanChecked: true,
        retentionChecked: false
      }
    },
    windows: [],
    promptTests: [],
    logs: []
  };

  let state = loadState();
  let selectedN8nNodeName = "AI Agent1";
  let selectedN8nEdgeId = "";
  let n8nDragState = null;
  let n8nResizeState = null;

  const el = {
    workflowNameInput: document.getElementById("workflowNameInput"),
    objectiveInput: document.getElementById("objectiveInput"),
    saveObjectiveBtn: document.getElementById("saveObjectiveBtn"),
    webhookEnabled: document.getElementById("webhookEnabled"),
    webhookUrlInput: document.getElementById("webhookUrlInput"),
    webhookMethodInput: document.getElementById("webhookMethodInput"),
    webhookKeyNameInput: document.getElementById("webhookKeyNameInput"),
    webhookSecretInput: document.getElementById("webhookSecretInput"),
    whatsappEnabled: document.getElementById("whatsappEnabled"),
    whatsappNumberInput: document.getElementById("whatsappNumberInput"),
    whatsappOwnerInput: document.getElementById("whatsappOwnerInput"),
    whatsappStarterInput: document.getElementById("whatsappStarterInput"),
    whatsappModeInput: document.getElementById("whatsappModeInput"),
    whatsappQrChecked: document.getElementById("whatsappQrChecked"),
    whatsappHumanChecked: document.getElementById("whatsappHumanChecked"),
    whatsappHistoryChecked: document.getElementById("whatsappHistoryChecked"),
    emailEnabled: document.getElementById("emailEnabled"),
    emailProviderInput: document.getElementById("emailProviderInput"),
    emailHostInput: document.getElementById("emailHostInput"),
    emailPortInput: document.getElementById("emailPortInput"),
    emailUserInput: document.getElementById("emailUserInput"),
    emailFromInput: document.getElementById("emailFromInput"),
    emailSecretInput: document.getElementById("emailSecretInput"),
    documentsEnabled: document.getElementById("documentsEnabled"),
    documentsSourceInput: document.getElementById("documentsSourceInput"),
    documentsStorageInput: document.getElementById("documentsStorageInput"),
    documentsParserInput: document.getElementById("documentsParserInput"),
    documentsTypesInput: document.getElementById("documentsTypesInput"),
    documentsHumanChecked: document.getElementById("documentsHumanChecked"),
    documentsRetentionChecked: document.getElementById("documentsRetentionChecked"),
    nextActionList: document.getElementById("nextActionList"),
    workflowCanvas: document.getElementById("workflowCanvas"),
    canvasTitle: document.getElementById("canvasTitle"),
    autosaveStatus: document.getElementById("autosaveStatus"),
    agentSummary: document.getElementById("agentSummary"),
    checklist: document.getElementById("checklist"),
    metricIntegrations: document.getElementById("metricIntegrations"),
    metricMissing: document.getElementById("metricMissing"),
    metricWindows: document.getElementById("metricWindows"),
    metricState: document.getElementById("metricState"),
    validateBtn: document.getElementById("validateBtn"),
    validateTopBtn: document.getElementById("validateTopBtn"),
    copyAgentBtn: document.getElementById("copyAgentBtn"),
    clearBuilderBtn: document.getElementById("clearBuilderBtn"),
    setupGuide: document.getElementById("setupGuide"),
    helpQuestionInput: document.getElementById("helpQuestionInput"),
    askHelpBtn: document.getElementById("askHelpBtn"),
    helpAiStatus: document.getElementById("helpAiStatus"),
    helpAnswerOutput: document.getElementById("helpAnswerOutput"),
    helpModal: document.getElementById("helpModal"),
    helpDialogTitle: document.getElementById("helpDialogTitle"),
    helpDialogBody: document.getElementById("helpDialogBody"),
    helpCloseBtn: document.getElementById("helpCloseBtn"),
    beginnerPrimer: document.getElementById("beginnerPrimer"),
    connectionNeeds: document.getElementById("connectionNeeds"),
    n8nWorkflowTitle: document.getElementById("n8nWorkflowTitle"),
    n8nMetricNodes: document.getElementById("n8nMetricNodes"),
    n8nMetricEdges: document.getElementById("n8nMetricEdges"),
    n8nMetricActive: document.getElementById("n8nMetricActive"),
    n8nMetricSource: document.getElementById("n8nMetricSource"),
    n8nWorkflowSelect: document.getElementById("n8nWorkflowSelect"),
    n8nApplyWorkflowBtn: document.getElementById("n8nApplyWorkflowBtn"),
    n8nZoomOutBtn: document.getElementById("n8nZoomOutBtn"),
    n8nZoomInBtn: document.getElementById("n8nZoomInBtn"),
    n8nZoomLabel: document.getElementById("n8nZoomLabel"),
    n8nSizeDownBtn: document.getElementById("n8nSizeDownBtn"),
    n8nSizeUpBtn: document.getElementById("n8nSizeUpBtn"),
    n8nSizeLabel: document.getElementById("n8nSizeLabel"),
    n8nFitBtn: document.getElementById("n8nFitBtn"),
    n8nAutoLayoutBtn: document.getElementById("n8nAutoLayoutBtn"),
    n8nSaveLayoutBtn: document.getElementById("n8nSaveLayoutBtn"),
    n8nResetLayoutBtn: document.getElementById("n8nResetLayoutBtn"),
    n8nNewNodeKindSelect: document.getElementById("n8nNewNodeKindSelect"),
    n8nAddNodeBtn: document.getElementById("n8nAddNodeBtn"),
    n8nDuplicateNodeBtn: document.getElementById("n8nDuplicateNodeBtn"),
    n8nDeleteNodeBtn: document.getElementById("n8nDeleteNodeBtn"),
    n8nEditorHint: document.getElementById("n8nEditorHint"),
    n8nEdgeSelect: document.getElementById("n8nEdgeSelect"),
    n8nSourceSelect: document.getElementById("n8nSourceSelect"),
    n8nEdgeTypeSelect: document.getElementById("n8nEdgeTypeSelect"),
    n8nTargetSelect: document.getElementById("n8nTargetSelect"),
    n8nReconnectBtn: document.getElementById("n8nReconnectBtn"),
    n8nNewEdgeBtn: document.getElementById("n8nNewEdgeBtn"),
    n8nRemoveEdgeBtn: document.getElementById("n8nRemoveEdgeBtn"),
    n8nBoardViewport: document.getElementById("n8nBoardViewport"),
    n8nBoard: document.getElementById("n8nBoard"),
    n8nEdges: document.getElementById("n8nEdges"),
    n8nNodes: document.getElementById("n8nNodes"),
    n8nInspector: document.getElementById("n8nInspector"),
    safeJsonOutput: document.getElementById("safeJsonOutput"),
    agentPromptOutput: document.getElementById("agentPromptOutput"),
    copyPromptBtn: document.getElementById("copyPromptBtn"),
    promptChecklist: document.getElementById("promptChecklist"),
    testMessageInput: document.getElementById("testMessageInput"),
    runPromptTestBtn: document.getElementById("runPromptTestBtn"),
    promptTestResult: document.getElementById("promptTestResult"),
    promptTestHistory: document.getElementById("promptTestHistory"),
    messageChannelInput: document.getElementById("messageChannelInput"),
    messageAskInput: document.getElementById("messageAskInput"),
    messageRecipientInput: document.getElementById("messageRecipientInput"),
    createWindowBtn: document.getElementById("createWindowBtn"),
    messageWindows: document.getElementById("messageWindows"),
    logList: document.getElementById("logList"),
    clearLogsBtn: document.getElementById("clearLogsBtn")
  };

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function mergeState(saved) {
    const next = cloneDefaultState();
    if (!saved || typeof saved !== "object") return next;
    next.workflowName = stringOr(saved.workflowName, next.workflowName);
    next.objective = stringOr(saved.objective, "");
    next.selectedImportedWorkflow = IMPORTED_N8N_WORKFLOWS.some(workflow => workflow.id === saved.selectedImportedWorkflow)
      ? saved.selectedImportedWorkflow
      : next.selectedImportedWorkflow;
    next.updatedAt = stringOr(saved.updatedAt, "");
    next.n8nEditorLayouts = normalizeSavedEditorLayouts(saved.n8nEditorLayouts);
    next.windows = Array.isArray(saved.windows) ? saved.windows : [];
    next.promptTests = Array.isArray(saved.promptTests) ? saved.promptTests.slice(0, MAX_PROMPT_TESTS) : [];
    next.logs = Array.isArray(saved.logs) ? saved.logs.slice(0, MAX_LOGS) : [];
    Object.keys(next.integrations).forEach(key => {
      next.integrations[key] = {
        ...next.integrations[key],
        ...(saved.integrations?.[key] || {})
      };
    });
    return next;
  }

  function loadState() {
    try {
      return mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      return cloneDefaultState();
    }
  }

  function saveState(reason) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    el.autosaveStatus.textContent = reason || "Salvo localmente";
  }

  function stringOr(value, fallback) {
    return typeof value === "string" ? value : fallback;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function maskSecret(value) {
    return value ? "informada" : "faltando";
  }

  function normalizePhone(value) {
    return String(value || "").replace(/[^\d+]/g, "");
  }

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function hasPromptPlaceholders(value) {
    return /\[[^\]]+\]/.test(String(value || ""));
  }

  function collectPromptChecks() {
    const prompt = TKA_RH_SUPPORT_AGENT_PROMPT;
    return [
      {
        ok: !hasPromptPlaceholders(prompt),
        title: "Template preenchido",
        detail: hasPromptPlaceholders(prompt) ? "Ainda existe campo entre colchetes no prompt." : "Nao ha campos de template pendentes.",
        target: "agentPromptOutput"
      },
      {
        ok: prompt.includes("Grupo TKA") && prompt.includes("TKA Seguranca Privada"),
        title: "Empresa definida",
        detail: "Prompt vinculado ao Grupo TKA / TKA Seguranca Privada.",
        target: "agentPromptOutput"
      },
      {
        ok: prompt.includes("rh@grupotka.com.br") && prompt.includes("WhatsApp RH"),
        title: "Canais RH definidos",
        detail: "Canal principal e e-mail RH estao preenchidos sem segredo.",
        target: "agentPromptOutput"
      },
      {
        ok: prompt.includes("aprovacao humana") && prompt.includes("NUNCA envie ou autorize envio automatico"),
        title: "Aprovacao humana protegida",
        detail: "O prompt bloqueia resposta final automatica sem validacao do RH.",
        target: "agentPromptOutput"
      }
    ];
  }

  function activeIntegrationCount() {
    return Object.values(state.integrations).filter(item => item.enabled).length;
  }

  function addLog(level, title, detail) {
    const last = state.logs[0];
    const messageKey = `${level}|${title}|${detail || ""}`;
    const now = Date.now();
    if (last && last.messageKey === messageKey && now - Number(last.timeMs || 0) < 30000) return;
    state.logs.unshift({
      id: `log-${now}-${Math.random().toString(16).slice(2)}`,
      timeMs: now,
      createdAt: new Date(now).toLocaleString("pt-BR"),
      level,
      title,
      detail: detail || "",
      messageKey
    });
    state.logs = state.logs.slice(0, MAX_LOGS);
    saveState("Log atualizado");
    renderLogs();
  }

  function readForm() {
    state.workflowName = el.workflowNameInput.value.trim() || "Fluxo n8n TKA";
    state.objective = el.objectiveInput.value.trim();

    const webhook = state.integrations.webhook;
    webhook.enabled = el.webhookEnabled.checked;
    webhook.url = el.webhookUrlInput.value.trim();
    webhook.method = el.webhookMethodInput.value;
    webhook.keyName = el.webhookKeyNameInput.value.trim();
    webhook.secret = el.webhookSecretInput.value || webhook.secret || "";

    const whatsapp = state.integrations.whatsapp;
    whatsapp.enabled = el.whatsappEnabled.checked;
    whatsapp.number = el.whatsappNumberInput.value.trim();
    whatsapp.owner = el.whatsappOwnerInput.value.trim();
    whatsapp.starter = el.whatsappStarterInput.value.trim();
    whatsapp.mode = el.whatsappModeInput.value;
    whatsapp.qrChecked = el.whatsappQrChecked.checked;
    whatsapp.humanChecked = el.whatsappHumanChecked.checked;
    whatsapp.historyChecked = el.whatsappHistoryChecked.checked;

    const email = state.integrations.email;
    email.enabled = el.emailEnabled.checked;
    email.provider = el.emailProviderInput.value;
    email.host = el.emailHostInput.value.trim();
    email.port = el.emailPortInput.value.trim();
    email.user = el.emailUserInput.value.trim();
    email.from = el.emailFromInput.value.trim();
    email.secret = el.emailSecretInput.value || email.secret || "";

    const documents = state.integrations.documents;
    documents.enabled = el.documentsEnabled.checked;
    documents.source = el.documentsSourceInput.value;
    documents.storage = el.documentsStorageInput.value.trim();
    documents.parser = el.documentsParserInput.value;
    documents.types = el.documentsTypesInput.value.trim();
    documents.humanChecked = el.documentsHumanChecked.checked;
    documents.retentionChecked = el.documentsRetentionChecked.checked;
  }

  function fillForm() {
    el.workflowNameInput.value = state.workflowName;
    el.objectiveInput.value = state.objective;

    const webhook = state.integrations.webhook;
    el.webhookEnabled.checked = Boolean(webhook.enabled);
    el.webhookUrlInput.value = webhook.url;
    el.webhookMethodInput.value = webhook.method || "POST";
    el.webhookKeyNameInput.value = webhook.keyName || "x-tka-key";
    el.webhookSecretInput.value = "";
    el.webhookSecretInput.placeholder = webhook.secret ? "Chave salva neste navegador" : "Cole a chave do n8n";

    const whatsapp = state.integrations.whatsapp;
    el.whatsappEnabled.checked = Boolean(whatsapp.enabled);
    el.whatsappNumberInput.value = whatsapp.number;
    el.whatsappOwnerInput.value = whatsapp.owner;
    el.whatsappStarterInput.value = whatsapp.starter;
    el.whatsappModeInput.value = whatsapp.mode || "approval";
    el.whatsappQrChecked.checked = Boolean(whatsapp.qrChecked);
    el.whatsappHumanChecked.checked = whatsapp.humanChecked !== false;
    el.whatsappHistoryChecked.checked = Boolean(whatsapp.historyChecked);

    const email = state.integrations.email;
    el.emailEnabled.checked = Boolean(email.enabled);
    el.emailProviderInput.value = email.provider || "smtp";
    el.emailHostInput.value = email.host;
    el.emailPortInput.value = email.port;
    el.emailUserInput.value = email.user;
    el.emailFromInput.value = email.from;
    el.emailSecretInput.value = "";
    el.emailSecretInput.placeholder = email.secret ? "Senha salva neste navegador" : "Senha, token ou app password";

    const documents = state.integrations.documents;
    el.documentsEnabled.checked = Boolean(documents.enabled);
    el.documentsSourceInput.value = documents.source || "whatsapp";
    el.documentsStorageInput.value = documents.storage;
    el.documentsParserInput.value = documents.parser || "manual";
    el.documentsTypesInput.value = documents.types || "PDF, imagem, DOCX";
    el.documentsHumanChecked.checked = documents.humanChecked !== false;
    el.documentsRetentionChecked.checked = Boolean(documents.retentionChecked);
  }

  function renderFieldHelpHints() {
    Object.entries(FIELD_HELP_TEXT).forEach(([id, text]) => {
      const input = document.getElementById(id);
      const field = input?.closest(".field");
      if (!field || field.querySelector(`[data-field-help-for="${id}"]`)) return;
      const hint = document.createElement("small");
      hint.className = "field-help";
      hint.dataset.fieldHelpFor = id;
      hint.textContent = text;
      field.appendChild(hint);
    });
  }

  function collectChecks() {
    const checks = [];
    const webhook = state.integrations.webhook;
    const whatsapp = state.integrations.whatsapp;
    const email = state.integrations.email;
    const documents = state.integrations.documents;

    checks.push({
      ok: Boolean(state.objective),
      title: "Objetivo definido",
      detail: state.objective ? "O agente sabe o resultado esperado." : "Escreva o objetivo em uma frase simples antes de ativar o fluxo.",
      target: "objectiveInput"
    });

    checks.push({
      ok: activeIntegrationCount() > 0,
      title: "Pelo menos uma integracao ativa",
      detail: activeIntegrationCount() ? "O canvas ja tem icones ativos." : "Clique em WhatsApp, Email, Documentos ou Webhook para colocar o icone no fluxo.",
      target: "recipe:whatsappRh"
    });

    collectPromptChecks().forEach(check => checks.push(check));

    if (webhook.enabled) {
      checks.push({
        ok: isHttpUrl(webhook.url),
        title: "Webhook com URL valida",
        detail: isHttpUrl(webhook.url) ? "URL pronta para o bloco Webhook do n8n." : "Cole a URL de producao do Webhook do n8n.",
        target: "webhookUrlInput"
      });
      checks.push({
        ok: Boolean(webhook.keyName && webhook.secret),
        title: "Webhook com chave",
        detail: webhook.keyName && webhook.secret ? "Chave presente; o valor fica mascarado no resumo." : "Informe o nome do header e a chave secreta usada pelo n8n.",
        target: webhook.keyName ? "webhookSecretInput" : "webhookKeyNameInput"
      });
    }

    if (whatsapp.enabled) {
      const digits = normalizePhone(whatsapp.number).replace(/\D/g, "");
      checks.push({
        ok: digits.length >= 10 && digits.length <= 13,
        title: "Numero RH conferido",
        detail: digits.length >= 10 ? "Numero tem formato aceitavel para WhatsApp." : "Informe DDI, DDD e numero do RH.",
        target: "whatsappNumberInput"
      });
      checks.push({
        ok: Boolean(whatsapp.qrChecked),
        title: "QR do WhatsApp autorizado",
        detail: whatsapp.qrChecked ? "Bridge confirmado pelo operador." : "Abra o bridge RH, leia o QR e marque esta etapa.",
        target: "whatsappQrChecked"
      });
      checks.push({
        ok: Boolean(whatsapp.humanChecked),
        title: "Aprovacao humana antes do envio",
        detail: whatsapp.humanChecked ? "O agente gera sugestao, nao envia sozinho." : "Ative aprovacao humana para proteger respostas de RH.",
        target: "whatsappHumanChecked"
      });
      checks.push({
        ok: Boolean(whatsapp.historyChecked),
        title: "Historico RH preservado",
        detail: whatsapp.historyChecked ? "Mensagens e acoes seguem append-only." : "Confirme que o fluxo nao substitui historico antigo.",
        target: "whatsappHistoryChecked"
      });
    }

    if (email.enabled) {
      const providerUsesCredentialId = email.provider === "n8nCredential";
      checks.push({
        ok: Boolean(email.host),
        title: providerUsesCredentialId ? "Credential ID informado" : "Servidor de email informado",
        detail: email.host ? "Destino de autenticacao preenchido." : "Informe host SMTP ou ID da credencial criada no n8n.",
        target: "emailHostInput"
      });
      checks.push({
        ok: providerUsesCredentialId || Number(email.port) > 0,
        title: "Porta de email valida",
        detail: providerUsesCredentialId ? "Credencial n8n pode esconder a porta." : "Use portas comuns como 587, 465 ou a porta do provedor.",
        target: "emailPortInput"
      });
      checks.push({
        ok: providerUsesCredentialId || isEmail(email.user),
        title: "Usuario de email valido",
        detail: providerUsesCredentialId ? "Usuario fica dentro da credencial n8n." : "Informe o email usado para autenticar.",
        target: "emailUserInput"
      });
      checks.push({
        ok: isEmail(email.from),
        title: "Remetente valido",
        detail: isEmail(email.from) ? "Remetente pronto para mensagens." : "Informe o email que aparecera como remetente.",
        target: "emailFromInput"
      });
      checks.push({
        ok: providerUsesCredentialId || Boolean(email.secret),
        title: "Senha ou token presente",
        detail: providerUsesCredentialId ? "Senha fica dentro da credencial n8n." : "Cole uma senha de app ou token, nao a senha pessoal se o provedor suportar app password.",
        target: "emailSecretInput"
      });
    }

    if (documents.enabled) {
      checks.push({
        ok: Boolean(documents.storage),
        title: "Destino dos documentos definido",
        detail: documents.storage ? "Arquivos terao destino seguro definido no fluxo." : "Informe pasta, Drive, bucket, protocolo ou outro destino seguro.",
        target: "documentsStorageInput"
      });
      checks.push({
        ok: Boolean(documents.types),
        title: "Tipos de documento aceitos",
        detail: documents.types ? "O operador sabe quais anexos o fluxo aceita." : "Liste PDF, imagem, DOCX, curriculo, atestado ou outros tipos aceitos.",
        target: "documentsTypesInput"
      });
      checks.push({
        ok: Boolean(documents.humanChecked),
        title: "Revisao humana de documentos",
        detail: documents.humanChecked ? "Documento nao sera aceito automaticamente sem revisao." : "Ative revisao humana antes de aceitar documentos sensiveis.",
        target: "documentsHumanChecked"
      });
      checks.push({
        ok: Boolean(documents.retentionChecked),
        title: "Historico de documentos preservado",
        detail: documents.retentionChecked ? "Arquivos antigos e logs nao serao substituidos." : "Confirme que o fluxo preserva historico e anexos antigos.",
        target: "documentsRetentionChecked"
      });
    }

    return checks;
  }

  function validationResult() {
    const checks = collectChecks();
    const missing = checks.filter(item => !item.ok);
    return { checks, missing, ready: missing.length === 0 };
  }

  function renderMetrics(result) {
    el.metricIntegrations.textContent = String(activeIntegrationCount());
    el.metricMissing.textContent = String(result.missing.length);
    el.metricWindows.textContent = String(state.windows.length);
    el.metricState.textContent = result.ready ? "Pronto" : activeIntegrationCount() ? "Pendente" : "Rascunho";
  }

  function renderNextActions(result) {
    if (!el.nextActionList) return;
    const nextItems = result.missing.slice(0, 4);
    if (!nextItems.length) {
      el.nextActionList.innerHTML = `
        <article class="next-action ready">
          <strong>Pronto para copiar o resumo seguro</strong>
          <p>O fluxo tem objetivo, canais e validacoes minimas. Use o JSON seguro para alimentar o agente ou montar no n8n.</p>
        </article>
      `;
      return;
    }
    el.nextActionList.innerHTML = nextItems.map((item, index) => `
      <article class="next-action">
        <span>${index + 1}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.detail)}</p>
          ${item.target ? `<button class="help-chip" type="button" data-jump-to="${escapeHtml(item.target)}">Abrir campo</button>` : ""}
        </div>
      </article>
    `).join("");
  }

  function setupStepStatus(kind, result) {
    if (kind === "recipe") return activeIntegrationCount() ? "done" : "current";
    if (kind === "objective") return state.objective ? "done" : activeIntegrationCount() ? "current" : "waiting";
    if (kind === "connections") return activeIntegrationCount() && result.missing.length < result.checks.length ? "current" : "waiting";
    if (kind === "validate") return result.ready ? "done" : activeIntegrationCount() || state.objective ? "current" : "waiting";
    if (kind === "export") return result.ready ? "current" : "waiting";
    return "waiting";
  }

  function renderSetupGuide(result) {
    if (!el.setupGuide) return;
    const steps = [
      {
        kind: "recipe",
        title: "Escolha um modelo",
        detail: "Clique em WhatsApp RH, Email RH, Documentos ou Webhook/API. Isso coloca blocos prontos no desenho.",
        action: "recipes"
      },
      {
        kind: "objective",
        title: "Escreva o objetivo",
        detail: "Diga em uma frase o que entra, o que o agente faz e quem aprova antes de enviar.",
        action: "objective"
      },
      {
        kind: "connections",
        title: "Complete as conexoes",
        detail: "Preencha URL, numero, email, destino de documento ou credencial conforme o canal escolhido.",
        action: "validation"
      },
      {
        kind: "validate",
        title: "Valide antes de usar",
        detail: "Clique em Validar agora e resolva as pendencias em linguagem simples.",
        action: "validation"
      },
      {
        kind: "export",
        title: "Copie o resumo seguro",
        detail: "Quando estiver pronto, use Copiar JSON seguro para passar o setup ao agente ou ao n8n sem expor senha.",
        action: "start"
      }
    ];
    el.setupGuide.innerHTML = steps.map((step, index) => {
      const status = setupStepStatus(step.kind, result);
      const label = status === "done" ? "feito" : status === "current" ? "agora" : "depois";
      return `
        <article class="setup-step ${status}">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(step.title)}</strong>
            <p>${escapeHtml(step.detail)}</p>
          </div>
          <button class="help-chip" type="button" data-help-topic="${escapeHtml(step.action)}">${escapeHtml(label)}</button>
        </article>
      `;
    }).join("");
  }

  function renderBeginnerSupport(result) {
    renderBeginnerPrimer(result);
    renderConnectionNeeds(result);
  }

  function renderBeginnerPrimer(result) {
    if (!el.beginnerPrimer) return;
    const complete = result.checks.filter(item => item.ok).length;
    const total = result.checks.length || 1;
    const progress = Math.round((complete / total) * 100);
    const cards = [
      {
        title: `${progress}% explicado`,
        detail: result.ready
          ? "As validacoes minimas estao completas. Ainda revise no n8n antes de producao."
          : `Faltam ${result.missing.length} ponto(s). Use os botoes Abrir campo para ir direto ao lugar certo.`,
        help: "validation"
      },
      ...PLAIN_LANGUAGE_CARDS
    ];
    el.beginnerPrimer.innerHTML = cards.map(card => `
      <article class="primer-card">
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.detail)}</p>
        <button class="help-chip" type="button" data-help-topic="${escapeHtml(card.help)}">Entender</button>
      </article>
    `).join("");
  }

  function checkBelongsToIntegration(check, kind) {
    const target = String(check.target || "");
    if (target) {
      if (kind === "webhook") return target.startsWith("webhook");
      if (kind === "whatsapp") return target.startsWith("whatsapp");
      if (kind === "email") return target.startsWith("email");
      if (kind === "documents") return target.startsWith("documents");
    }
    const text = `${check.title} ${check.detail}`.toLowerCase();
    if (kind === "webhook") return text.includes("webhook");
    if (kind === "whatsapp") return text.includes("whatsapp") || text.includes("rh") || text.includes("historico") || text.includes("aprovacao");
    if (kind === "email") return text.includes("email") || text.includes("remetente") || text.includes("senha") || text.includes("porta") || text.includes("credential");
    if (kind === "documents") return text.includes("documento") || text.includes("arquivo") || text.includes("anexo") || text.includes("historico");
    return false;
  }

  function integrationNeedStatus(kind, result) {
    if (!state.integrations[kind]?.enabled) {
      return { label: "opcional", className: "inactive", missing: [] };
    }
    const missing = result.missing.filter(check => checkBelongsToIntegration(check, kind));
    if (missing.length) return { label: `${missing.length} pendente(s)`, className: "waiting", missing };
    return { label: "pronto para revisar", className: "ready", missing: [] };
  }

  function renderConnectionNeeds(result) {
    if (!el.connectionNeeds) return;
    const activeKeys = INTEGRATION_ORDER.filter(key => state.integrations[key]?.enabled);
    const keys = activeKeys.length ? activeKeys : INTEGRATION_ORDER;
    const intro = activeKeys.length
      ? "Mostrando os canais que voce ativou."
      : "Nenhum canal foi ativado ainda. Estes sao os preparos possiveis.";
    el.connectionNeeds.innerHTML = `
      <div class="needs-intro">${escapeHtml(intro)}</div>
      ${keys.map(kind => {
        const guide = INTEGRATION_GUIDES[kind];
        const status = integrationNeedStatus(kind, result);
        const active = Boolean(state.integrations[kind]?.enabled);
        return `
          <article class="need-card ${escapeHtml(status.className)}">
            <div class="need-head">
              <span class="node-icon ${escapeHtml(guide.iconClass)}" aria-hidden="true">${escapeHtml(guide.icon)}</span>
              <div>
                <strong>${escapeHtml(guide.title)}</strong>
                <small>${escapeHtml(active ? status.label : "ainda nao ativado")}</small>
              </div>
            </div>
            <details class="need-details">
              <summary>Ver o que precisa ter</summary>
              <ul>
                ${guide.needs.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </details>
            ${status.missing.length ? `
              <div class="need-missing">
                <strong>Falta agora</strong>
                <p>${escapeHtml(status.missing[0].detail)}</p>
              </div>
            ` : ""}
            <p class="need-warning">${escapeHtml(guide.never)}</p>
            <div class="need-actions">
              ${active
                ? `<button class="secondary-btn" type="button" data-jump-to="${escapeHtml(status.missing[0]?.target || guide.target)}">Abrir campo</button>`
                : `<button class="secondary-btn" type="button" data-activate-integration="${escapeHtml(kind)}">Ativar este canal</button>`}
              <button class="help-chip" type="button" data-help-topic="${escapeHtml(guide.help)}">Explicar</button>
            </div>
          </article>
        `;
      }).join("")}
    `;
  }

  function helpTopic(topicKey) {
    return HELP_TOPICS[topicKey] || HELP_TOPICS.start;
  }

  function openHelp(topicKey) {
    const topic = helpTopic(topicKey);
    if (!el.helpModal || !el.helpDialogTitle || !el.helpDialogBody) return;
    el.helpDialogTitle.textContent = topic.title;
    el.helpDialogBody.innerHTML = `
      <ol>
        ${topic.body.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    `;
    el.helpModal.hidden = false;
    el.helpCloseBtn?.focus();
  }

  function closeHelp() {
    if (el.helpModal) el.helpModal.hidden = true;
  }

  function selectedTopicFromQuestion(question) {
    const text = normalizeText(question);
    if (hasAny(text, ["whatsapp", "zap", "qr", "numero"])) return "whatsapp";
    if (hasAny(text, ["email", "smtp", "remetente", "porta"])) return "email";
    if (hasAny(text, ["documento", "anexo", "curriculo", "atestado", "pdf", "arquivo"])) return "documents";
    if (hasAny(text, ["webhook", "api", "url", "endpoint", "header", "chave"])) return "webhook";
    if (hasAny(text, ["prompt", "gpt", "openai", "ia", "agente"])) return "prompt";
    if (hasAny(text, ["linha", "conexao", "conectar", "reconectar"])) return "n8nCanvas";
    if (hasAny(text, ["objetivo", "frase", "resolver"])) return "objective";
    if (hasAny(text, ["validar", "pendencia", "falta", "erro"])) return "validation";
    return "start";
  }

  function currentMissingSummary(limit = 5) {
    return validationResult().missing.slice(0, limit).map(item => `${item.title}: ${item.detail}`);
  }

  function localHelpAnswer(question) {
    const topicKey = selectedTopicFromQuestion(question);
    const topic = helpTopic(topicKey);
    const missing = currentMissingSummary(4);
    const lines = [
      topic.body.join("\n"),
      "",
      missing.length
        ? `O que falta agora:\n- ${missing.join("\n- ")}`
        : "No momento, as validacoes principais estao prontas. Confira o resumo seguro antes de usar no n8n.",
      "",
      "Regra de seguranca: nao cole senha real, token ou chave em campo de texto comum. Use credencial do n8n ou campo secreto quando existir."
    ];
    return lines.join("\n");
  }

  function compactWorkflowHelpDraft(question, fallbackReply) {
    const result = validationResult();
    return {
      reply: fallbackReply,
      option: {
        key: "tka_workflow_newbie_help",
        title: "Ajuda para configurar fluxo TKA",
        short: "Explicar setup n8n em portugues simples."
      },
      audience: {
        key: "operator",
        label: "Operador iniciante"
      },
      intent: {
        label: "Ajuda de configuracao",
        evidence: [question || "sem pergunta especifica"]
      },
      missing: result.missing.map(item => item.title).slice(0, 8),
      risk: {
        level: "safe_routine",
        label: "Ajuda sem execucao",
        reason: "A resposta apenas explica a tela; nao envia mensagem, nao grava segredo e nao ativa n8n."
      },
      gatheredFields: [
        { label: "fluxo", value: state.workflowName || "sem nome" },
        { label: "integracoes ativas", value: String(activeIntegrationCount()) },
        { label: "pendencias", value: String(result.missing.length) }
      ],
      restricted: false
    };
  }

  async function requestCloudWorkflowHelp(question, fallbackReply) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WORKFLOW_HELP_AI_TIMEOUT_MS);
    try {
      const response = await fetch(CLOUD_RH_AI_DRAFT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: [
            "Explique esta duvida para um operador extremamente iniciante usando portugues brasileiro simples.",
            "Nao execute nada. Nao solicite segredo real. Nao prometa que n8n esta ativo.",
            `Duvida: ${question || "Como configurar o fluxo?"}`
          ].join("\n"),
          draft: compactWorkflowHelpDraft(question, fallbackReply),
          source: "tka-workflows-help"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return {
        reply: String(data.reply || "").trim(),
        model: data.model || "",
        source: data.source || "rhAiDraft"
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function answerWorkflowHelp() {
    readForm();
    saveState("Ajuda consultada");
    const question = el.helpQuestionInput?.value.trim() || "";
    const fallbackReply = localHelpAnswer(question);
    if (el.helpAnswerOutput) {
      el.helpAnswerOutput.textContent = fallbackReply;
    }
    if (el.helpAiStatus) {
      el.helpAiStatus.textContent = "Tentando melhorar com a API RH segura...";
    }
    try {
      const ai = await requestCloudWorkflowHelp(question, fallbackReply);
      if (ai.reply && el.helpAnswerOutput) {
        el.helpAnswerOutput.textContent = ai.reply;
      }
      if (el.helpAiStatus) {
        el.helpAiStatus.textContent = ai.model ? `Resposta melhorada por IA RH (${ai.model}).` : "Resposta melhorada por IA RH.";
      }
      addLog("ok", "Ajuda explicada", "A duvida foi respondida para operador iniciante usando a camada de ajuda.");
    } catch (error) {
      if (el.helpAiStatus) {
        el.helpAiStatus.textContent = `${WORKFLOW_HELP_AI_NOTE} Mostrando ajuda local.`;
      }
      addLog("warn", "Ajuda local usada", `API RH indisponivel ou bloqueada; resposta local exibida. ${String(error?.message || error).slice(0, 120)}`);
    }
  }

  function selectedImportedWorkflow() {
    return IMPORTED_N8N_WORKFLOWS.find(workflow => workflow.id === state.selectedImportedWorkflow) || IMPORTED_N8N_WORKFLOWS[0];
  }

  function clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeNodeKind(value) {
    return N8N_NODE_KINDS.includes(value) ? value : "action";
  }

  function n8nNodeKindLabel(kind) {
    return N8N_NODE_KIND_LABELS[kind] || kind || "Acao";
  }

  function n8nEdgeTypeLabel(type) {
    return N8N_EDGE_TYPE_LABELS[type] || type || "principal";
  }

  function displayN8nFieldLabel(label) {
    return N8N_FIELD_LABELS_PT[label] || label;
  }

  function scrollToPanel(panel) {
    if (!panel) return;
    const top = Math.max(0, window.scrollY + panel.getBoundingClientRect().top - 72);
    window.scrollTo({ top, behavior: "auto" });
  }

  function revealPanel(panel, focusSelector) {
    if (!panel) return;
    document.querySelectorAll(".is-targeted, .is-updated").forEach(item => {
      item.classList.remove("is-targeted", "is-updated");
    });
    panel.classList.add("is-targeted");
    window.setTimeout(() => panel.classList.remove("is-targeted"), 1600);
    requestAnimationFrame(() => {
      scrollToPanel(panel);
      const target = focusSelector ? panel.querySelector(focusSelector) : null;
      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    });
  }

  function jumpToTarget(target) {
    if (!target) return;
    if (target.startsWith("panel:")) {
      const kind = target.split(":")[1];
      openFlowConfig(kind);
      return;
    }
    if (target.startsWith("recipe:")) {
      const recipe = target.split(":")[1];
      const button = document.querySelector(`[data-recipe="${CSS.escape(recipe)}"]`);
      revealPanel(button?.closest(".quick-start-panel") || button, null);
      button?.focus({ preventScroll: true });
      return;
    }
    const field = document.getElementById(target);
    if (!field) return;
    const panel = field.closest(".config-panel, .objective-panel, .prompt-panel, .prompt-test-panel, .message-builder, .panel") || field;
    const selector = `#${CSS.escape(target)}`;
    revealPanel(panel, selector);
    if (field.type === "checkbox") {
      field.closest("label")?.classList.add("jump-highlight");
      window.setTimeout(() => field.closest("label")?.classList.remove("jump-highlight"), 1600);
    }
  }

  function activateIntegrationFromGuide(kind) {
    if (!state.integrations[kind]) return;
    readForm();
    state.integrations[kind].enabled = true;
    saveState("Canal ativado pelo guia");
    fillForm();
    addLog("ok", "Canal ativado", `${INTEGRATION_GUIDES[kind]?.title || kind} foi colocado no fluxo pelo guia simples.`);
    renderAll();
    jumpToTarget(INTEGRATION_GUIDES[kind]?.target);
  }

  function revealN8nInspector() {
    if (!el.n8nInspector) return;
    el.n8nInspector.setAttribute("tabindex", "-1");
    el.n8nInspector.classList.add("is-updated");
    window.setTimeout(() => el.n8nInspector?.classList.remove("is-updated"), 1600);
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => {
        scrollToPanel(el.n8nInspector);
        el.n8nInspector.focus({ preventScroll: true });
      });
    }
  }

  function selectN8nNode(name, options = {}) {
    if (!name) return;
    selectedN8nNodeName = name;
    renderN8nLayout();
    renderSafeJsonOutput();
    if (options.reveal) revealN8nInspector();
  }

  function openFlowConfig(kind) {
    const target = FLOW_CONFIG_TARGETS[kind];
    if (!target) return;
    revealPanel(document.querySelector(target.selector), target.focusSelector);
    if (target.label) {
      el.autosaveStatus.textContent = `Editando ${target.label}`;
    }
  }

  function normalizeFields(fields) {
    if (!Array.isArray(fields)) return [];
    return fields
      .map(item => Array.isArray(item) ? [stringOr(item[0], ""), stringOr(item[1], "")] : null)
      .filter(item => item && item[0].trim());
  }

  function fieldsToText(fields) {
    return normalizeFields(fields)
      .map(([label, value]) => `${displayN8nFieldLabel(label)}: ${value}`)
      .join("\n");
  }

  function textToFields(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const index = line.indexOf(":");
        if (index === -1) return [line, ""];
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
      .filter(([label]) => label);
  }

  function sanitizeNodeName(value, fallback = "Bloco") {
    const clean = String(value || fallback)
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return clean || fallback;
  }

  function makeUniqueNodeName(base, existingNames) {
    const root = sanitizeNodeName(base, "Bloco");
    let name = root;
    let index = 2;
    while (existingNames.has(name)) {
      name = `${root} ${index}`;
      index += 1;
    }
    existingNames.add(name);
    return name;
  }

  function normalizeNodeEdit(value) {
    const edit = value && typeof value === "object" ? value : {};
    return {
      label: stringOr(edit.label, ""),
      kind: normalizeNodeKind(edit.kind),
      glyph: stringOr(edit.glyph, "").slice(0, 5),
      type: stringOr(edit.type, ""),
      typeVersion: stringOr(edit.typeVersion, ""),
      summary: stringOr(edit.summary, ""),
      fields: normalizeFields(edit.fields),
      api: stringOr(edit.api, ""),
      prompt: stringOr(edit.prompt, ""),
      message: stringOr(edit.message, ""),
      notes: stringOr(edit.notes, "")
    };
  }

  function normalizeCustomNode(value, existingNames) {
    const source = normalizeNodeEdit(value);
    const name = makeUniqueNodeName(value?.name || source.label || "Bloco personalizado", existingNames);
    return {
      name,
      label: source.label || name,
      kind: source.kind,
      glyph: source.glyph || "ND",
      type: source.type || "n8n-nodes-base.noOp",
      typeVersion: source.typeVersion || "1",
      summary: source.summary || "Bloco criado pelo operador.",
      fields: source.fields.length ? source.fields : [["Info", "preencher no painel"]],
      api: source.api,
      prompt: source.prompt,
      message: source.message,
      notes: source.notes,
      custom: true
    };
  }

  function nodeSizeFromScale(scale) {
    const safeScale = clampNumber(scale || 1, N8N_NODE_SCALE_MIN, N8N_NODE_SCALE_MAX);
    return {
      width: Math.round(N8N_NODE_WIDTH * safeScale),
      height: Math.round(N8N_NODE_HEIGHT * safeScale)
    };
  }

  function nodePositionWithSize(value, fallbackPosition, layout) {
    const defaultSize = nodeSizeFromScale(layout.nodeScale || 1);
    const source = value && typeof value === "object" ? value : {};
    return {
      x: clampNumber(source.x ?? fallbackPosition.x, 8, 6000),
      y: clampNumber(source.y ?? fallbackPosition.y, 8, 6000),
      width: clampNumber(source.width ?? defaultSize.width, 150, 620),
      height: clampNumber(source.height ?? defaultSize.height, 110, 520)
    };
  }

  function applyNodeEdit(node, edit) {
    if (!edit) return { ...node, fields: normalizeFields(node.fields) };
    return {
      ...node,
      label: edit.label || node.label || node.name,
      kind: edit.kind || node.kind,
      glyph: edit.glyph || node.glyph,
      type: edit.type || node.type,
      typeVersion: edit.typeVersion || node.typeVersion,
      summary: edit.summary || node.summary,
      fields: edit.fields?.length ? edit.fields : normalizeFields(node.fields),
      api: edit.api || node.api || "",
      prompt: edit.prompt || node.prompt || "",
      message: edit.message || node.message || "",
      notes: edit.notes || node.notes || ""
    };
  }

  function n8nNodeDisplayName(node) {
    return node.label || node.name;
  }

  function workflowEditorNodes(workflow, layout) {
    const removed = new Set(Array.isArray(layout.removedNodes) ? layout.removedNodes : []);
    const edits = layout.nodeEdits || {};
    const imported = workflow.nodes
      .filter(node => !removed.has(node.name))
      .map(node => applyNodeEdit({ ...node, custom: false }, edits[node.name]));
    const custom = Array.isArray(layout.customNodes) ? layout.customNodes.map(node => ({ ...node, custom: true })) : [];
    return [...imported, ...custom];
  }

  function workflowEditorNodeNames(workflow, layout) {
    return new Set(workflowEditorNodes(workflow, layout).map(node => node.name));
  }

  function normalizeSavedEditorLayouts(saved) {
    const source = saved && typeof saved === "object" ? saved : {};
    const normalized = {};
    IMPORTED_N8N_WORKFLOWS.forEach(workflow => {
      const incoming = source[workflow.id] && typeof source[workflow.id] === "object" ? source[workflow.id] : {};
      const importedNames = new Set(workflow.nodes.map(node => node.name));
      const usedNames = new Set(workflow.nodes.map(node => node.name));
      const customNodes = Array.isArray(incoming.customNodes)
        ? incoming.customNodes.map(node => normalizeCustomNode(node, usedNames))
        : [];
      const removedNodes = Array.isArray(incoming.removedNodes)
        ? incoming.removedNodes.filter(name => importedNames.has(name))
        : [];
      const nodeNames = new Set([...workflow.nodes.map(node => node.name), ...customNodes.map(node => node.name)]);
      const nodeEdits = {};
      Object.entries(incoming.nodeEdits || {}).forEach(([name, value]) => {
        if (!nodeNames.has(name)) return;
        nodeEdits[name] = normalizeNodeEdit(value);
      });
      const nodes = {};
      Object.entries(incoming.nodes || {}).forEach(([name, value]) => {
        if (!nodeNames.has(name) || !value || typeof value !== "object") return;
        const x = Number(value.x);
        const y = Number(value.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        nodes[name] = {
          x: clampNumber(x, 8, 5000),
          y: clampNumber(y, 8, 5000),
          width: Number.isFinite(Number(value.width)) ? clampNumber(value.width, 150, 620) : undefined,
          height: Number.isFinite(Number(value.height)) ? clampNumber(value.height, 110, 520) : undefined
        };
      });
      const edges = Array.isArray(incoming.edges)
        ? incoming.edges
            .filter(edge => edge && nodeNames.has(edge.source) && nodeNames.has(edge.target))
            .map((edge, index) => ({
              id: String(edge.id || `edge-${workflow.id}-${index}`),
              source: String(edge.source),
              target: String(edge.target),
              type: N8N_EDGE_TYPES.includes(edge.type) ? edge.type : "main"
            }))
        : [];
      normalized[workflow.id] = {
        nodes,
        edges,
        customNodes,
        removedNodes,
        nodeEdits,
        zoom: clampNumber(incoming.zoom || 1, N8N_ZOOM_MIN, N8N_ZOOM_MAX),
        nodeScale: clampNumber(incoming.nodeScale || 1, N8N_NODE_SCALE_MIN, N8N_NODE_SCALE_MAX)
      };
    });
    return normalized;
  }

  function defaultEdgeId(workflow, edge, index) {
    return `${workflow.id}-${index}-${edge.source}-${edge.type}-${edge.target}`
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase();
  }

  function defaultWorkflowEdges(workflow) {
    return workflow.edges.map((edge, index) => ({
      id: defaultEdgeId(workflow, edge, index),
      source: edge.source,
      target: edge.target,
      type: N8N_EDGE_TYPES.includes(edge.type) ? edge.type : "main"
    }));
  }

  function rawWorkflowBounds(workflow) {
    const positions = workflow.nodes.map(node => node.position);
    const minX = Math.min(...positions.map(position => position[0]));
    const minY = Math.min(...positions.map(position => position[1]));
    const maxX = Math.max(...positions.map(position => position[0]));
    const maxY = Math.max(...positions.map(position => position[1]));
    return {
      minX,
      minY,
      width: Math.ceil((maxX - minX) * N8N_SCALE + N8N_NODE_WIDTH + N8N_PADDING * 2),
      height: Math.ceil((maxY - minY) * N8N_SCALE + N8N_NODE_HEIGHT + N8N_PADDING * 2)
    };
  }

  function baseN8nPosition(node, bounds) {
    return {
      x: Math.round((node.position[0] - bounds.minX) * N8N_SCALE + N8N_PADDING),
      y: Math.round((node.position[1] - bounds.minY) * N8N_SCALE + N8N_PADDING)
    };
  }

  function baseWorkflowNodePositions(workflow) {
    const bounds = rawWorkflowBounds(workflow);
    const positions = {};
    workflow.nodes.forEach(node => {
      positions[node.name] = baseN8nPosition(node, bounds);
    });
    return positions;
  }

  function ensureN8nEditorLayout(workflow = selectedImportedWorkflow()) {
    if (!state.n8nEditorLayouts || typeof state.n8nEditorLayouts !== "object") {
      state.n8nEditorLayouts = {};
    }
    if (!state.n8nEditorLayouts[workflow.id]) {
      state.n8nEditorLayouts[workflow.id] = { nodes: {}, edges: [], customNodes: [], removedNodes: [], nodeEdits: {}, zoom: 1, nodeScale: 1 };
    }
    const layout = state.n8nEditorLayouts[workflow.id];
    layout.customNodes = Array.isArray(layout.customNodes) ? layout.customNodes : [];
    layout.removedNodes = Array.isArray(layout.removedNodes) ? layout.removedNodes : [];
    layout.nodeEdits = layout.nodeEdits && typeof layout.nodeEdits === "object" ? layout.nodeEdits : {};
    layout.nodeScale = clampNumber(layout.nodeScale || 1, N8N_NODE_SCALE_MIN, N8N_NODE_SCALE_MAX);
    const basePositions = baseWorkflowNodePositions(workflow);
    const editorNodes = workflowEditorNodes(workflow, layout);
    const nodeNames = new Set(editorNodes.map(node => node.name));

    Object.keys(layout.nodes || {}).forEach(name => {
      if (!nodeNames.has(name)) delete layout.nodes[name];
    });
    Object.keys(layout.nodeEdits || {}).forEach(name => {
      if (!nodeNames.has(name)) delete layout.nodeEdits[name];
    });
    editorNodes.forEach((node, index) => {
      if (!layout.nodes[node.name]) {
        layout.nodes[node.name] = {
          ...(basePositions[node.name] || { x: N8N_PADDING + index * 34, y: N8N_PADDING + index * 28 })
        };
      }
      layout.nodes[node.name] = nodePositionWithSize(layout.nodes[node.name], basePositions[node.name] || layout.nodes[node.name], layout);
    });

    if (!Array.isArray(layout.edges) || !layout.edges.length) {
      layout.edges = defaultWorkflowEdges(workflow);
    } else {
      layout.edges = layout.edges
        .filter(edge => edge && nodeNames.has(edge.source) && nodeNames.has(edge.target))
        .map((edge, index) => ({
          id: String(edge.id || `edge-${workflow.id}-${index}`),
          source: edge.source,
          target: edge.target,
          type: N8N_EDGE_TYPES.includes(edge.type) ? edge.type : "main"
        }));
      if (!layout.edges.length) layout.edges = defaultWorkflowEdges(workflow);
    }
    layout.edges = layout.edges.filter(edge => nodeNames.has(edge.source) && nodeNames.has(edge.target));
    layout.zoom = clampNumber(layout.zoom || 1, N8N_ZOOM_MIN, N8N_ZOOM_MAX);
    return layout;
  }

  function resetN8nEditorLayout(workflow = selectedImportedWorkflow()) {
    const basePositions = baseWorkflowNodePositions(workflow);
    state.n8nEditorLayouts[workflow.id] = {
      nodes: basePositions,
      edges: defaultWorkflowEdges(workflow),
      customNodes: [],
      removedNodes: [],
      nodeEdits: {},
      nodeScale: 1,
      zoom: 1
    };
    selectedN8nNodeName = workflow.nodes.find(node => node.kind === "agent")?.name || workflow.nodes[0]?.name || "";
    selectedN8nEdgeId = state.n8nEditorLayouts[workflow.id].edges[0]?.id || "";
    saveState("Layout resetado");
  }

  function n8nBounds(layout) {
    const positions = Object.values(layout.nodes || {});
    const maxX = Math.max(...positions.map(position => position.x + (position.width || N8N_NODE_WIDTH)), 980);
    const maxY = Math.max(...positions.map(position => position.y + (position.height || N8N_NODE_HEIGHT)), 620);
    return {
      width: Math.ceil(maxX + N8N_PADDING),
      height: Math.ceil(maxY + N8N_PADDING)
    };
  }

  function renderN8nWorkflowOptions() {
    if (!el.n8nWorkflowSelect) return;
    const previousValue = el.n8nWorkflowSelect.value;
    el.n8nWorkflowSelect.innerHTML = IMPORTED_N8N_WORKFLOWS.map(workflow => `
      <option value="${escapeHtml(workflow.id)}">${escapeHtml(workflow.label)} (${escapeHtml(workflow.sourceFile)})</option>
    `).join("");
    el.n8nWorkflowSelect.value = IMPORTED_N8N_WORKFLOWS.some(workflow => workflow.id === state.selectedImportedWorkflow)
      ? state.selectedImportedWorkflow
      : previousValue || IMPORTED_N8N_WORKFLOWS[0].id;
  }

  function n8nNodeByName(name) {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    return workflowEditorNodes(workflow, layout).find(node => node.name === name) || null;
  }

  function n8nEdgeClass(type) {
    return `n8n-edge n8n-edge-${String(type || "main").replace(/[^a-z0-9_-]/gi, "_")}`;
  }

  function n8nEdgePath(edge, positions, edgeIndex) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return "";

    const leftToRight = source.x <= target.x;
    const offset = (edgeIndex % 3 - 1) * 8;
    const sourceWidth = source.width || N8N_NODE_WIDTH;
    const sourceHeight = source.height || N8N_NODE_HEIGHT;
    const targetWidth = target.width || N8N_NODE_WIDTH;
    const targetHeight = target.height || N8N_NODE_HEIGHT;
    const startX = leftToRight ? source.x + sourceWidth : source.x;
    const endX = leftToRight ? target.x : target.x + targetWidth;
    const startY = source.y + sourceHeight / 2 + offset;
    const endY = target.y + targetHeight / 2 + offset;
    const bend = Math.max(72, Math.abs(endX - startX) * 0.45);
    const c1x = startX + (leftToRight ? bend : -bend);
    const c2x = endX - (leftToRight ? bend : -bend);
    return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
  }

  function nodeBeginnerExplanation(node) {
    if (!node) return "Este bloco representa uma etapa do fluxo.";
    if (node.kind === "trigger" || /webhook/i.test(node.type)) {
      return "Este bloco recebe a primeira informacao. Normalmente outro sistema, WhatsApp ou formulario chama uma URL e inicia o fluxo.";
    }
    if (node.kind === "wait") {
      return "Este bloco pausa o fluxo por um tempo ou ate uma condicao. Use quando nao quiser que tudo rode imediatamente.";
    }
    if (node.kind === "agent") {
      return "Este bloco e o agente inteligente. Ele le a mensagem, usa memoria, chama ferramentas e prepara a proxima acao.";
    }
    if (node.kind === "model") {
      return "Este bloco e o modelo de linguagem usado pelo agente. Ele nao envia mensagem sozinho; ele ajuda o agente a pensar e escrever.";
    }
    if (node.kind === "memory") {
      return "Este bloco guarda contexto da conversa para o agente nao esquecer o que ja foi informado.";
    }
    if (node.kind === "tool") {
      return "Este bloco e uma ferramenta que o agente pode chamar, por exemplo atendimento humano, calculadora ou outro fluxo.";
    }
    return "Este bloco executa uma acao, como enviar mensagem, chamar API, montar texto ou registrar dados.";
  }

  function nodeBeginnerChecklist(node) {
    if (!node) return "Preencha titulo, descricao e observacoes.";
    if (node.kind === "trigger" || /webhook/i.test(node.type)) {
      return "Confira metodo, URL/path, header de seguranca e qual sistema vai chamar essa entrada.";
    }
    if (node.kind === "agent") {
      return "Preencha prompt, regra de aprovacao humana, quando escalar para RH e quais dados o agente pode usar.";
    }
    if (node.kind === "model") {
      return "Confira modelo, temperatura e credencial OpenAI/n8n. A chave deve ficar na credencial, nao no texto.";
    }
    if (node.kind === "memory") {
      return "Confira chave da sessao e tamanho da janela de memoria. Nao use dados sensiveis desnecessarios.";
    }
    if (node.kind === "tool") {
      return "Explique quando o agente pode usar a ferramenta e qual fluxo/acao ela chama.";
    }
    return "Preencha API/URL se houver, mensagem que sera preparada, campos visiveis e pendencias de credencial.";
  }

  function renderN8nInspector(node) {
    if (!el.n8nInspector) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const selected = node || n8nNodeByName(selectedN8nNodeName) || workflow.nodes[0];
    if (!selected) {
      el.n8nInspector.innerHTML = `<div class="test-empty">Selecione ou adicione um bloco para editar.</div>`;
      return;
    }
    const position = layout.nodes[selected.name] || nodePositionWithSize({}, { x: N8N_PADDING, y: N8N_PADDING }, layout);
    const incoming = layout.edges.filter(edge => edge.target === selected.name);
    const outgoing = layout.edges.filter(edge => edge.source === selected.name);
    el.n8nInspector.innerHTML = `
      <div>
        <span class="eyebrow">Editor do bloco</span>
        <h2>${escapeHtml(n8nNodeDisplayName(selected))}</h2>
        <p>${escapeHtml(selected.summary)}</p>
        <button class="help-chip" type="button" data-help-topic="selectedNode">Entender este bloco</button>
      </div>
      <div class="node-help-card">
        <strong>Para que serve</strong>
        <p>${escapeHtml(nodeBeginnerExplanation(selected))}</p>
        <strong>O que preencher</strong>
        <p>${escapeHtml(nodeBeginnerChecklist(selected))}</p>
      </div>
      <div class="n8n-inspector-block">
        <div><span>ID interno</span><strong>${escapeHtml(selected.name)}</strong></div>
        <div><span>Tipo tecnico n8n</span><strong>${escapeHtml(selected.type)}</strong></div>
        <div><span>Versao</span><strong>${escapeHtml(selected.typeVersion)}</strong></div>
        <div><span>Conexoes</span><strong>${incoming.length} entrada(s), ${outgoing.length} saida(s)</strong></div>
      </div>
      <form class="n8n-node-editor" autocomplete="off">
        <label class="field">
          <span>Titulo no bloco</span>
          <input data-node-edit="label" type="text" value="${escapeHtml(n8nNodeDisplayName(selected))}" />
        </label>
        <div class="n8n-editor-two">
          <label class="field">
            <span>Categoria</span>
            <select data-node-edit="kind">
              ${N8N_NODE_KINDS.map(kind => `<option value="${escapeHtml(kind)}" ${selected.kind === kind ? "selected" : ""}>${escapeHtml(n8nNodeKindLabel(kind))}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Icone curto</span>
            <input data-node-edit="glyph" type="text" maxlength="5" value="${escapeHtml(selected.glyph)}" />
          </label>
        </div>
        <label class="field">
          <span>Tipo tecnico n8n</span>
          <input data-node-edit="type" type="text" value="${escapeHtml(selected.type)}" />
        </label>
        <div class="n8n-editor-two">
          <label class="field">
            <span>Versao</span>
            <input data-node-edit="typeVersion" type="text" value="${escapeHtml(selected.typeVersion)}" />
          </label>
          <label class="field">
            <span>Conexoes</span>
            <input type="text" value="${incoming.length} entrada(s), ${outgoing.length} saida(s)" readonly />
          </label>
        </div>
        <label class="field">
          <span>Descricao para usuario iniciante</span>
          <textarea data-node-edit="summary" rows="3">${escapeHtml(selected.summary)}</textarea>
        </label>
        <label class="field">
          <span>API, URL ou endpoint</span>
          <textarea data-node-edit="api" rows="3" placeholder="Exemplo: POST https://api.exemplo.com/messages usando credential n8n">${escapeHtml(selected.api || "")}</textarea>
        </label>
        <label class="field">
          <span>Prompt ou regra do agente</span>
          <textarea data-node-edit="prompt" rows="5" placeholder="Instrucao, objetivo, variaveis esperadas e regra de aprovacao humana.">${escapeHtml(selected.prompt || "")}</textarea>
        </label>
        <label class="field">
          <span>Texto, mensagem ou corpo</span>
          <textarea data-node-edit="message" rows="4" placeholder="Mensagem WhatsApp, email, body JSON ou texto que sera enviado.">${escapeHtml(selected.message || "")}</textarea>
        </label>
        <label class="field">
          <span>Campos visiveis no card</span>
          <textarea data-node-edit="fieldsText" rows="5" placeholder="Um por linha. Exemplo: Method: POST">${escapeHtml(fieldsToText(selected.fields))}</textarea>
        </label>
        <label class="field">
          <span>Observacoes, credenciais e pendencias</span>
          <textarea data-node-edit="notes" rows="4" placeholder="Nao cole senhas. Escreva qual credential deve existir no n8n e o que falta validar.">${escapeHtml(selected.notes || "")}</textarea>
        </label>
        <div class="n8n-editor-four">
          <label class="field">
            <span>X</span>
            <input data-node-edit="x" type="number" min="0" value="${Math.round(position.x)}" />
          </label>
          <label class="field">
            <span>Y</span>
            <input data-node-edit="y" type="number" min="0" value="${Math.round(position.y)}" />
          </label>
          <label class="field">
            <span>Largura</span>
            <input data-node-edit="width" type="number" min="150" max="620" value="${Math.round(position.width || N8N_NODE_WIDTH)}" />
          </label>
          <label class="field">
            <span>Altura</span>
            <input data-node-edit="height" type="number" min="110" max="520" value="${Math.round(position.height || N8N_NODE_HEIGHT)}" />
          </label>
        </div>
        <div class="n8n-node-editor-actions">
          <button data-node-action="save" class="primary-btn" type="button">Salvar bloco</button>
          <button data-node-action="duplicate" class="secondary-btn" type="button">Duplicar</button>
          <button data-node-action="delete" class="secondary-btn danger" type="button">Remover</button>
        </div>
      </form>
    `;
  }

  function edgeLabel(edge, index) {
    const source = n8nNodeByName(edge.source);
    const target = n8nNodeByName(edge.target);
    return `${index + 1}. ${n8nNodeDisplayName(source || { name: edge.source })} -> ${n8nNodeDisplayName(target || { name: edge.target })} (${n8nEdgeTypeLabel(edge.type)})`;
  }

  function renderN8nConnectionEditor(workflow, layout) {
    if (!el.n8nEdgeSelect || !el.n8nSourceSelect || !el.n8nTargetSelect || !el.n8nEdgeTypeSelect) return;
    const nodes = workflowEditorNodes(workflow, layout);
    const nodeOptions = nodes.map(node => `<option value="${escapeHtml(node.name)}">${escapeHtml(n8nNodeDisplayName(node))}</option>`).join("");
    const edgeOptions = layout.edges.map((edge, index) => `<option value="${escapeHtml(edge.id)}">${escapeHtml(edgeLabel(edge, index))}</option>`).join("");
    const selectedEdge = layout.edges.find(edge => edge.id === selectedN8nEdgeId) || layout.edges[0] || null;
    if (selectedEdge) selectedN8nEdgeId = selectedEdge.id;

    el.n8nEdgeSelect.innerHTML = edgeOptions || `<option value="">Nenhuma linha</option>`;
    el.n8nSourceSelect.innerHTML = nodeOptions;
    el.n8nTargetSelect.innerHTML = nodeOptions;
    el.n8nEdgeTypeSelect.innerHTML = N8N_EDGE_TYPES.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(n8nEdgeTypeLabel(type))}</option>`).join("");

    if (selectedEdge) {
      el.n8nEdgeSelect.value = selectedEdge.id;
      el.n8nSourceSelect.value = selectedEdge.source;
      el.n8nTargetSelect.value = selectedEdge.target;
      el.n8nEdgeTypeSelect.value = selectedEdge.type;
    }
  }

  function renderN8nNodeFields(node) {
    const fields = [
      ...(node.api ? [["API", node.api]] : []),
      ...(node.prompt ? [["Prompt", node.prompt]] : []),
      ...(node.message ? [["Mensagem", node.message]] : []),
      ...normalizeFields(node.fields)
    ].slice(0, 4);
    if (!fields.length) return `<div class="n8n-node-fields"><div class="n8n-node-field"><span>Info</span><strong>Sem parametros</strong></div></div>`;
    return `
      <div class="n8n-node-fields">
        ${fields.map(([label, value]) => `
          <div class="n8n-node-field">
            <span>${escapeHtml(displayN8nFieldLabel(label))}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderN8nLayout() {
    if (!el.n8nBoard || !el.n8nNodes || !el.n8nEdges) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const nodes = workflowEditorNodes(workflow, layout);
    const bounds = n8nBounds(layout);
    const positions = new Map(Object.entries(layout.nodes || {}));

    if (!nodes.some(node => node.name === selectedN8nNodeName)) {
      selectedN8nNodeName = nodes.find(node => node.kind === "agent")?.name || nodes[0]?.name || "";
    }
    renderN8nWorkflowOptions();
    el.n8nWorkflowTitle.textContent = workflow.name;
    el.n8nMetricNodes.textContent = String(nodes.length);
    el.n8nMetricEdges.textContent = String(layout.edges.length);
    el.n8nMetricActive.textContent = workflow.active ? "Ativo" : "Inativo";
    el.n8nMetricSource.textContent = workflow.sourceFile;
    el.n8nBoard.style.width = `${bounds.width}px`;
    el.n8nBoard.style.height = `${bounds.height}px`;
    el.n8nBoard.style.transform = `scale(${layout.zoom})`;
    if (el.n8nBoardViewport) {
      el.n8nBoardViewport.style.width = `${Math.ceil(bounds.width * layout.zoom)}px`;
      el.n8nBoardViewport.style.height = `${Math.ceil(bounds.height * layout.zoom)}px`;
    }
    if (el.n8nZoomLabel) {
      el.n8nZoomLabel.textContent = `${Math.round(layout.zoom * 100)}%`;
    }
    if (el.n8nSizeLabel) {
      el.n8nSizeLabel.textContent = `${Math.round((layout.nodeScale || 1) * 100)}%`;
    }
    el.n8nEdges.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    el.n8nEdges.setAttribute("width", String(bounds.width));
    el.n8nEdges.setAttribute("height", String(bounds.height));

    el.n8nEdges.innerHTML = layout.edges.map((edge, index) => {
      const path = n8nEdgePath(edge, positions, index);
      const selected = edge.id === selectedN8nEdgeId;
      return path ? `<path class="${n8nEdgeClass(edge.type)} ${selected ? "selected" : ""}" data-edge-id="${escapeHtml(edge.id)}" d="${path}" />` : "";
    }).join("");

    el.n8nNodes.innerHTML = nodes.map(node => {
      const position = positions.get(node.name);
      if (!position) return "";
      const selected = node.name === selectedN8nNodeName;
      const dragging = n8nDragState?.name === node.name;
      const incoming = layout.edges.filter(edge => edge.target === node.name).length;
      const outgoing = layout.edges.filter(edge => edge.source === node.name).length;
      return `
        <button class="n8n-node-card n8n-node-${escapeHtml(node.kind)} ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}" type="button" data-n8n-node="${escapeHtml(node.name)}" style="left:${position.x}px;top:${position.y}px;width:${position.width}px;height:${position.height}px">
          <div class="n8n-node-top">
            <span class="n8n-node-glyph" aria-hidden="true">${escapeHtml(node.glyph)}</span>
            <div>
              <h2>${escapeHtml(n8nNodeDisplayName(node))}</h2>
              <p>${escapeHtml(node.type.split(".").pop())}</p>
            </div>
          </div>
          <p>${escapeHtml(node.summary)}</p>
          ${renderN8nNodeFields(node)}
          <div class="n8n-chip-row">
            <span class="n8n-chip">${incoming} entrada</span>
            <span class="n8n-chip">${outgoing} saida</span>
            ${node.custom ? `<span class="n8n-chip">personalizado</span>` : ""}
          </div>
          <span class="n8n-node-resize" data-n8n-resize="${escapeHtml(node.name)}" aria-hidden="true"></span>
        </button>
      `;
    }).join("");

    renderN8nConnectionEditor(workflow, layout);
    renderN8nInspector(n8nNodeByName(selectedN8nNodeName));
  }

  function renderSafeJsonOutput() {
    if (!el.safeJsonOutput) return;
    el.safeJsonOutput.value = JSON.stringify(safeAgentPayload(), null, 2);
  }

  function nodeStatus(kind) {
    const integration = state.integrations[kind];
    if (!integration.enabled) return { label: "Desativado", className: "waiting", active: false };
    const checks = collectChecks().filter(check => checkBelongsToIntegration(check, kind));
    const missing = checks.some(check => !check.ok);
    return missing
      ? { label: "Pendente", className: "waiting", active: true }
      : { label: "Valido", className: "ready", active: true };
  }

  function renderCanvas() {
    const items = [
      {
        kind: "webhook",
        title: "Webhook",
        icon: "WH",
        iconClass: "webhook-icon",
        detail: state.integrations.webhook.enabled
          ? `${state.integrations.webhook.method || "POST"} - chave ${maskSecret(state.integrations.webhook.secret)}`
          : "Clique para colocar a entrada do n8n."
      },
      {
        kind: "agent",
        title: "Agente TKA",
        icon: "AI",
        iconClass: "agent-icon",
        detail: "Le objetivo, integracoes, credenciais presentes e janelas de mensagem."
      },
      {
        kind: "whatsapp",
        title: "WhatsApp RH",
        icon: "WA",
        iconClass: "whatsapp-icon",
        detail: state.integrations.whatsapp.enabled
          ? `${state.integrations.whatsapp.number || "numero pendente"} - ${state.integrations.whatsapp.mode === "approval" ? "com aprovacao" : "rascunho"}`
          : "Ative para suporte RH por WhatsApp."
      },
      {
        kind: "email",
        title: "Email",
        icon: "EM",
        iconClass: "email-icon",
        detail: state.integrations.email.enabled
          ? `${state.integrations.email.provider} - senha ${maskSecret(state.integrations.email.secret)}`
          : "Ative para SMTP ou credencial n8n."
      },
      {
        kind: "documents",
        title: "Documentos",
        icon: "DOC",
        iconClass: "documents-icon",
        detail: state.integrations.documents.enabled
          ? `${state.integrations.documents.source} - ${state.integrations.documents.parser}`
          : "Ative para anexos, curriculos e comprovantes."
      }
    ];

    el.canvasTitle.textContent = state.workflowName || "Fluxo n8n em rascunho";
    el.workflowCanvas.innerHTML = items.map(item => {
      const status = item.kind === "agent"
        ? { label: activeIntegrationCount() ? "Lendo" : "Aguardando", className: activeIntegrationCount() ? "ready" : "waiting", active: true }
        : nodeStatus(item.kind);
      return `
        <article class="node ${status.active ? "active" : "missing"}" role="button" tabindex="0" data-flow-node="${escapeHtml(item.kind)}" aria-label="Abrir configuracao de ${escapeHtml(item.title)}">
          <div class="node-top">
            <span class="node-icon ${item.iconClass}" aria-hidden="true">${item.icon}</span>
            <span class="node-status ${status.className}">${status.label}</span>
          </div>
          <div>
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.detail)}</p>
          </div>
          <small>${item.kind === "agent" ? "Toque para editar objetivo" : "Toque para configurar"}</small>
        </article>
      `;
    }).join("");
  }

  function renderValidation(result) {
    const readyText = result.ready
      ? "Pronto para transformar em workflow n8n. O resumo seguro pode ser copiado sem expor segredos."
      : `Faltam ${result.missing.length} item(ns). Clique em cada integracao e complete os campos destacados pela lista.`;
    el.agentSummary.textContent = readyText;
    el.checklist.innerHTML = result.checks.map(check => `
      <div class="check-row ${check.ok ? "ok" : "bad"}">
        <span class="check-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(check.title)}</strong>
          <p>${escapeHtml(check.detail)}</p>
          ${!check.ok && check.target ? `<button class="help-chip" type="button" data-jump-to="${escapeHtml(check.target)}">Abrir campo</button>` : ""}
        </div>
      </div>
    `).join("");
  }

  function messageTemplate(channel, ask, recipient) {
    const cleanAsk = ask || "pedido ainda nao detalhado";
    const cleanRecipient = recipient || "destinatario";
    const askSentence = /[.!?]$/.test(cleanAsk) ? cleanAsk : `${cleanAsk}.`;
    if (channel === "email") {
      return [
        `Para: ${cleanRecipient}`,
        "Assunto: Atualizacao do atendimento TKA",
        "",
        "Ola,",
        "",
        `Recebemos o pedido: ${askSentence}`,
        "A equipe responsavel vai validar as informacoes e retornar com a orientacao correta.",
        "",
        "Atenciosamente,",
        "Grupo TKA"
      ].join("\n");
    }
    if (channel === "webhook") {
      return JSON.stringify({
        recipient: cleanRecipient,
        request: cleanAsk,
        source: "tka-workflows",
        humanApprovalRequired: true
      }, null, 2);
    }
    if (channel === "documents") {
      return [
        `Origem: ${cleanRecipient}`,
        `Pedido/documento: ${askSentence}`,
        "",
        "Acao segura:",
        "- Registrar arquivo recebido sem substituir historico.",
        "- Conferir tipo do documento e destino seguro.",
        "- Enviar para revisao humana antes de aceitar, responder ou arquivar como concluido."
      ].join("\n");
    }
    const starter = state.integrations.whatsapp.starter || defaultState.integrations.whatsapp.starter;
    return [
      starter,
      "",
      `Entendi o pedido: ${askSentence}`,
      "Vou encaminhar para validacao do RH e manter a conversa registrada para retorno seguro."
    ].join("\n");
  }

  function createMessageWindow() {
    readForm();
    const channel = el.messageChannelInput.value;
    const ask = el.messageAskInput.value.trim();
    const recipient = el.messageRecipientInput.value.trim();
    const createdAt = new Date().toLocaleString("pt-BR");
    state.windows.unshift({
      id: `window-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      channel,
      ask,
      recipient,
      body: messageTemplate(channel, ask, recipient),
      createdAt
    });
    state.windows = state.windows.slice(0, 40);
    saveState("Janela criada");
    addLog("ok", "Janela de mensagem criada", `${channel} para ${recipient || "destinatario nao informado"}.`);
    el.messageAskInput.value = "";
    renderAll();
  }

  function renderWindows() {
    if (!state.windows.length) {
      el.messageWindows.innerHTML = `<div class="message-window"><strong>Nenhuma janela criada ainda.</strong><p>Descreva o pedido recebido e clique em Criar janela.</p></div>`;
      return;
    }
    el.messageWindows.innerHTML = state.windows.map(item => `
      <article class="message-window" data-window-id="${escapeHtml(item.id)}">
        <div class="message-window-head">
          <div>
            <strong>${escapeHtml(channelLabel(item.channel))} - ${escapeHtml(item.recipient || "sem destinatario")}</strong>
            <p>${escapeHtml(item.createdAt)} | Pedido: ${escapeHtml(item.ask || "nao informado")}</p>
          </div>
          <div class="message-window-actions">
            <button class="secondary-btn" type="button" data-copy-window="${escapeHtml(item.id)}">Copiar</button>
            <button class="secondary-btn danger" type="button" data-delete-window="${escapeHtml(item.id)}">Remover</button>
          </div>
        </div>
        <textarea data-window-body="${escapeHtml(item.id)}">${escapeHtml(item.body)}</textarea>
      </article>
    `).join("");
  }

  function channelLabel(channel) {
    if (channel === "email") return "Email";
    if (channel === "webhook") return "Webhook";
    if (channel === "documents") return "Documentos";
    return "WhatsApp RH";
  }

  function renderLogs() {
    if (!state.logs.length) {
      el.logList.innerHTML = `<div class="log-item info"><strong>Sem logs ainda.</strong><p>As acoes importantes vao aparecer aqui em linguagem simples.</p></div>`;
      return;
    }
    el.logList.innerHTML = state.logs.map(item => `
      <article class="log-item ${escapeHtml(item.level)}">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
        <small>${escapeHtml(item.createdAt)}</small>
      </article>
    `).join("");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s+@.-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny(normalized, words) {
    return words.some(word => normalized.includes(word));
  }

  function hasBenefitToken(normalized, token) {
    return new RegExp(`(^|\\s)${token}(\\s|$)`, "i").test(normalized);
  }

  function looksLikeNameOnly(normalized) {
    if (!normalized || normalized.length > 70) return false;
    if (hasAny(normalized, ["bom dia", "boa tarde", "boa noite", "ferias", "holerite", "olerite", "cartao", "pagamento", "curriculo", "escala", "atestado"])) return false;
    return /^[a-z]+(?:\s+[a-z]+){1,4}$/.test(normalized);
  }

  function escalationReply() {
    return {
      category: "pendencia humana",
      risk: "manual_review",
      reply: "Vou conectar voce com um especialista humano que resolve isso agora. Aguarde um instante."
    };
  }

  function draftRhReply(message) {
    const original = String(message || "").trim();
    const normalized = normalizeText(original);
    if (!normalized) {
      return {
        category: "sem mensagem",
        risk: "manual_review",
        reply: "Por gentileza, envie a mensagem recebida para eu preparar um rascunho seguro."
      };
    }

    if (hasAny(normalized, ["processo", "advogado", "reclamacao", "reclamação", "absurdo", "denuncia", "ameaca", "ameaca", "vou processar", "rescisao", "desligamento", "demissao", "cancelamento"])) {
      return escalationReply();
    }

    if (hasAny(normalized, ["curriculo", "curriculum", "candidato", "vaga", "emprego", "trabalhar"])) {
      return {
        category: "curriculo",
        risk: "assisted_ready",
        reply: "Obrigado pelo contato. Envie nome completo, telefone, cidade, funcao pretendida e o curriculo em anexo. O RH vai analisar e retornar se houver aderencia."
      };
    }

    if (hasAny(normalized, ["holerite", "olerite", "comprovante de pagamento"])) {
      return {
        category: "holerite",
        risk: "assisted_ready",
        reply: "Por gentileza, informe nome e sobrenome e a competencia do holerite. Vou encaminhar para conferencia do RH e retorno seguro."
      };
    }

    if (hasBenefitToken(normalized, "vr") || hasBenefitToken(normalized, "va") || hasBenefitToken(normalized, "vt") || hasAny(normalized, ["vale", "beneficio", "cartao", "cartao", "bloqueado", "segunda via"])) {
      return {
        category: "beneficio/cartao",
        risk: "assisted",
        reply: "Entendi. Informe nome e sobrenome, qual beneficio foi afetado, quando percebeu o problema e se aparece alguma mensagem no cartao ou aplicativo. O RH precisa validar antes de confirmar valor, prazo ou segunda via."
      };
    }

    if (hasBenefitToken(normalized, "ft") || hasAny(normalized, ["folga trabalhada", "pagamento", "salario", "desconto", "pix"])) {
      return {
        category: "ft/pagamento",
        risk: "assisted",
        reply: "Por gentileza, informe nome e sobrenome, posto, data da FT ou ocorrencia e o que ficou pendente. Se for FT nao paga, envie tambem a chave PIX para conferencia do RH. Valor e pagamento dependem de validacao humana."
      };
    }

    if (hasAny(normalized, ["ferias", "férias"])) {
      return {
        category: "ferias",
        risk: "assisted",
        reply: "Claro. Informe nome e sobrenome e diga se a duvida e sobre periodo desejado, ferias ja marcadas ou saldo. O RH vai conferir a situacao antes de confirmar qualquer data."
      };
    }

    if (hasAny(normalized, ["atestado", "falta", "atraso", "escala", "folga", "cobertura", "posto", "plantao", "horario"])) {
      return {
        category: "escala/ausencia",
        risk: "assisted",
        reply: "Entendido. Informe nome e sobrenome, posto, data, horario afetado e anexe o comprovante quando existir. Vou encaminhar para validacao do RH ou supervisao."
      };
    }

    if (looksLikeNameOnly(normalized)) {
      return {
        category: "identidade",
        risk: "safe_routine",
        reply: "Obrigado. Para confirmar o atendimento, voce e funcionario da TKA, ex-funcionario ou candidato? Me diga tambem qual assunto precisa tratar."
      };
    }

    if (hasAny(normalized, ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "rh", "preciso"])) {
      return {
        category: "triagem inicial",
        risk: "safe_routine",
        reply: "Ola! Por gentileza, informe seu nome e sobrenome e me diga se voce e funcionario da TKA, ex-funcionario ou candidato. Assim consigo direcionar seu atendimento corretamente."
      };
    }

    return {
      category: "outros",
      risk: "manual_review",
      reply: "Por gentileza, informe nome e sobrenome e resuma o assunto em uma frase. Vou direcionar ao RH humano para evitar qualquer orientacao incorreta."
    };
  }

  function createPromptTest() {
    const message = el.testMessageInput.value.trim();
    const result = draftRhReply(message);
    const createdAt = new Date().toLocaleString("pt-BR");
    state.promptTests.unshift({
      id: `prompt-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      category: result.category,
      risk: result.risk,
      reply: result.reply,
      createdAt
    });
    state.promptTests = state.promptTests.slice(0, MAX_PROMPT_TESTS);
    saveState("Teste local salvo");
    addLog("ok", "Teste local criado", `${result.category} / ${result.risk}.`);
    renderPromptPanel();
  }

  function renderPromptPanel() {
    el.agentPromptOutput.value = TKA_RH_SUPPORT_AGENT_PROMPT;
    el.promptChecklist.innerHTML = collectPromptChecks().map(check => `
      <div class="check-row ${check.ok ? "ok" : "bad"}">
        <span class="check-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(check.title)}</strong>
          <p>${escapeHtml(check.detail)}</p>
        </div>
      </div>
    `).join("");

    const latest = state.promptTests[0];
    el.promptTestResult.innerHTML = latest
      ? `
        <div class="test-meta">
          <span>${escapeHtml(latest.category)}</span>
          <span>${escapeHtml(latest.risk)}</span>
        </div>
        <textarea readonly rows="4">${escapeHtml(latest.reply)}</textarea>
      `
      : `<div class="test-empty">Nenhum teste local criado.</div>`;

    el.promptTestHistory.innerHTML = state.promptTests.slice(0, 6).map(item => `
      <article class="prompt-test-item">
        <strong>${escapeHtml(item.category)} - ${escapeHtml(item.risk)}</strong>
        <p>${escapeHtml(item.message || "sem mensagem")}</p>
        <small>${escapeHtml(item.createdAt)}</small>
      </article>
    `).join("");
  }

  function safeAgentPayload() {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const nodes = workflowEditorNodes(workflow, layout);
    return {
      workflowName: state.workflowName,
      objective: state.objective,
      updatedAt: state.updatedAt,
      integrations: {
        webhook: {
          enabled: state.integrations.webhook.enabled,
          url: state.integrations.webhook.url,
          method: state.integrations.webhook.method,
          keyName: state.integrations.webhook.keyName,
          secretPresent: Boolean(state.integrations.webhook.secret)
        },
        whatsapp: { ...state.integrations.whatsapp },
        email: {
          enabled: state.integrations.email.enabled,
          provider: state.integrations.email.provider,
          host: state.integrations.email.host,
          port: state.integrations.email.port,
          user: state.integrations.email.user,
          from: state.integrations.email.from,
          secretPresent: Boolean(state.integrations.email.secret)
        },
        documents: {
          enabled: state.integrations.documents.enabled,
          source: state.integrations.documents.source,
          storage: state.integrations.documents.storage,
          parser: state.integrations.documents.parser,
          types: state.integrations.documents.types,
          humanChecked: state.integrations.documents.humanChecked,
          retentionChecked: state.integrations.documents.retentionChecked
        }
      },
      windows: state.windows.map(item => ({
        id: item.id,
        channel: item.channel,
        ask: item.ask,
        recipient: item.recipient,
        body: item.body,
        createdAt: item.createdAt
      })),
      agentPrompt: TKA_RH_SUPPORT_AGENT_PROMPT,
      promptTests: state.promptTests.map(item => ({
        category: item.category,
        risk: item.risk,
        reply: item.reply,
        createdAt: item.createdAt
      })),
      importedWorkflow: {
        selectedId: workflow.id,
        name: workflow.name,
        sourceFile: workflow.sourceFile,
        variant: workflow.variant,
        active: workflow.active,
        nodeCount: nodes.length,
        edgeCount: layout.edges.length,
        zoom: layout.zoom,
        nodeScale: layout.nodeScale,
        removedImportedNodes: layout.removedNodes || [],
        nodes: nodes.map(node => ({
          name: node.name,
          label: n8nNodeDisplayName(node),
          kind: node.kind,
          type: node.type,
          typeVersion: node.typeVersion,
          imported: !node.custom,
          summary: node.summary,
          fields: normalizeFields(node.fields).map(([label, value]) => ({ label, value })),
          api: node.api || "",
          prompt: node.prompt || "",
          message: node.message || "",
          notes: node.notes || "",
          importedPosition: node.position || null,
          editorPosition: layout.nodes[node.name] || null
        })),
        edges: layout.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }))
      },
      importedWorkflowChoices: IMPORTED_N8N_WORKFLOWS.map(workflow => ({
        id: workflow.id,
        label: workflow.label,
        sourceFile: workflow.sourceFile,
        variant: workflow.variant,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length
      })),
      validation: validationResult().checks
    };
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(input);
    }
  }

  function validateAndSave(withLog) {
    readForm();
    saveState("Validado e salvo");
    fillForm();
    const result = validationResult();
    if (withLog) {
      addLog(
        result.ready ? "ok" : "warn",
        result.ready ? "Configuracao pronta" : "Configuracao precisa de ajuste",
        result.ready ? "O agente local validou todos os itens obrigatorios." : `Faltam ${result.missing.length} item(ns) antes de ativar no n8n.`
      );
    }
    renderAll(result);
  }

  function applySelectedWorkflowToBuilder() {
    readForm();
    const workflow = selectedImportedWorkflow();
    state.workflowName = `${workflow.label} - ${workflow.name}`;
    state.objective = workflow.objectiveSuggestion;
    state.integrations.webhook.enabled = true;
    state.integrations.webhook.method = "POST";
    state.integrations.webhook.keyName = state.integrations.webhook.keyName || "x-tka-key";
    state.integrations.whatsapp.enabled = true;
    state.integrations.whatsapp.owner = state.integrations.whatsapp.owner || "RH / operador responsavel";
    state.integrations.whatsapp.mode = "approval";
    state.integrations.whatsapp.humanChecked = true;
    state.integrations.whatsapp.historyChecked = true;
    state.integrations.email.enabled = false;
    saveState("Fluxo aplicado ao construtor");
    fillForm();
    addLog("ok", "Fluxo aplicado", `${workflow.label} foi aplicado ao construtor local. Complete URL, chaves e QR antes de ativar.`);
    renderAll();
  }

  function addTemplateNodeToWorkflow(templateKey, label, preferredSource) {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const template = N8N_CUSTOM_NODE_TEMPLATES[templateKey] || N8N_CUSTOM_NODE_TEMPLATES.api;
    const existingNodes = workflowEditorNodes(workflow, layout);
    if (existingNodes.some(node => n8nNodeDisplayName(node) === label)) return;
    const existingNames = new Set(existingNodes.map(node => node.name));
    const node = normalizeCustomNode({ ...template, name: label, label }, existingNames);
    const agent = existingNodes.find(item => item.kind === "agent") || existingNodes[0];
    const source = preferredSource || agent?.name || existingNodes[0]?.name || "";
    const sourcePosition = layout.nodes[source] || { x: N8N_PADDING, y: N8N_PADDING };
    const size = nodeSizeFromScale(layout.nodeScale || 1);
    const customIndex = layout.customNodes.length;
    layout.customNodes.push(node);
    layout.nodes[node.name] = {
      x: clampNumber(sourcePosition.x + 360 + customIndex * 48, 8, 6000),
      y: clampNumber(sourcePosition.y + 130 + customIndex * 64, 8, 6000),
      width: size.width,
      height: size.height
    };
    if (source && source !== node.name) {
      layout.edges.push({
        id: `edge-recipe-${Date.now().toString(36)}-${customIndex}`,
        source,
        target: node.name,
        type: node.kind === "tool" ? "ai_tool" : "main"
      });
    }
    selectedN8nNodeName = node.name;
  }

  function applyQuickRecipe(recipe) {
    readForm();
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const agent = workflowEditorNodes(workflow, layout).find(node => node.kind === "agent")?.name || selectedN8nNodeName;

    if (recipe === "whatsappRh") {
      state.workflowName = "WhatsApp RH TKA";
      state.objective = "Receber pedidos pelo WhatsApp RH, classificar o assunto, preparar resposta curta e exigir aprovacao humana antes de enviar.";
      state.integrations.webhook.enabled = true;
      state.integrations.whatsapp.enabled = true;
      state.integrations.whatsapp.owner = state.integrations.whatsapp.owner || "RH / operador responsavel";
      state.integrations.whatsapp.mode = "approval";
      state.integrations.whatsapp.humanChecked = true;
      addTemplateNodeToWorkflow("whatsapp", "Resposta WhatsApp RH", agent);
      addTemplateNodeToWorkflow("prompt", "Prompt RH seguro", agent);
    }

    if (recipe === "emailRh") {
      state.workflowName = "Email RH TKA";
      state.objective = "Receber emails do RH, organizar assunto, criar rascunho de resposta e preservar historico antes de qualquer envio.";
      state.integrations.email.enabled = true;
      state.integrations.email.from = state.integrations.email.from || "rh@grupotka.com.br";
      addTemplateNodeToWorkflow("email", "Resposta por Email RH", agent);
      addTemplateNodeToWorkflow("prompt", "Triagem de email RH", agent);
    }

    if (recipe === "documentsRh") {
      state.workflowName = "Documentos RH TKA";
      state.objective = "Receber documentos, registrar origem, classificar tipo, guardar em destino seguro e pedir revisao humana antes de aceitar.";
      state.integrations.documents.enabled = true;
      state.integrations.documents.humanChecked = true;
      addTemplateNodeToWorkflow("document", "Entrada de Documentos", agent);
      addTemplateNodeToWorkflow("prompt", "Classificacao de documentos", agent);
    }

    if (recipe === "apiWebhook") {
      state.workflowName = "API Webhook TKA";
      state.objective = "Receber dados externos por webhook, validar chave, transformar payload e responder com status claro para outro sistema.";
      state.integrations.webhook.enabled = true;
      state.integrations.webhook.method = state.integrations.webhook.method || "POST";
      state.integrations.webhook.keyName = state.integrations.webhook.keyName || "x-tka-key";
      addTemplateNodeToWorkflow("api", "API externa TKA", agent);
    }

    saveState("Modelo aplicado");
    fillForm();
    renderAll();
    addLog("ok", "Modelo aplicado", "O fluxo recebeu objetivo, integracoes e blocos editaveis. Complete apenas os campos pendentes.");
  }

  function selectedN8nNode() {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    return workflowEditorNodes(workflow, layout).find(node => node.name === selectedN8nNodeName) || null;
  }

  function readNodeEditorForm() {
    const form = el.n8nInspector?.querySelector(".n8n-node-editor");
    if (!form) return null;
    const value = name => form.querySelector(`[data-node-edit="${name}"]`)?.value || "";
    return {
      label: sanitizeNodeName(value("label"), selectedN8nNodeName),
      kind: normalizeNodeKind(value("kind")),
      glyph: value("glyph").slice(0, 5) || "ND",
      type: value("type").trim() || "n8n-nodes-base.noOp",
      typeVersion: value("typeVersion").trim() || "1",
      summary: value("summary").trim() || "Bloco configurado pelo operador.",
      fields: textToFields(value("fieldsText")),
      api: value("api").trim(),
      prompt: value("prompt").trim(),
      message: value("message").trim(),
      notes: value("notes").trim(),
      x: clampNumber(value("x"), 8, 6000),
      y: clampNumber(value("y"), 8, 6000),
      width: clampNumber(value("width"), 150, 620),
      height: clampNumber(value("height"), 110, 520)
    };
  }

  function saveSelectedN8nNodeFromEditor() {
    const node = selectedN8nNode();
    const values = readNodeEditorForm();
    if (!node || !values) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const nodePayload = {
      label: values.label,
      kind: values.kind,
      glyph: values.glyph,
      type: values.type,
      typeVersion: values.typeVersion,
      summary: values.summary,
      fields: values.fields,
      api: values.api,
      prompt: values.prompt,
      message: values.message,
      notes: values.notes
    };

    if (node.custom) {
      layout.customNodes = layout.customNodes.map(item => item.name === node.name ? { ...item, ...nodePayload } : item);
    } else {
      layout.nodeEdits[node.name] = nodePayload;
    }

    layout.nodes[node.name] = {
      ...(layout.nodes[node.name] || {}),
      x: values.x,
      y: values.y,
      width: values.width,
      height: values.height
    };
    saveState("Bloco salvo");
    renderAll();
    addLog("ok", "Bloco atualizado", `${values.label} foi salvo com campos, prompt, mensagem e tamanho.`);
  }

  function createN8nNode() {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const template = N8N_CUSTOM_NODE_TEMPLATES[el.n8nNewNodeKindSelect?.value || "api"] || N8N_CUSTOM_NODE_TEMPLATES.api;
    const existingNames = workflowEditorNodeNames(workflow, layout);
    const node = normalizeCustomNode(template, existingNames);
    const selectedPosition = layout.nodes[selectedN8nNodeName];
    const size = nodeSizeFromScale(layout.nodeScale || 1);
    layout.customNodes.push(node);
    layout.nodes[node.name] = {
      x: clampNumber((selectedPosition?.x || N8N_PADDING) + 90, 8, 6000),
      y: clampNumber((selectedPosition?.y || N8N_PADDING) + 80, 8, 6000),
      width: size.width,
      height: size.height
    };
    if (selectedN8nNodeName && workflowEditorNodeNames(workflow, layout).has(selectedN8nNodeName)) {
      layout.edges.push({
        id: `edge-custom-${Date.now().toString(36)}`,
        source: selectedN8nNodeName,
        target: node.name,
        type: node.kind === "tool" ? "ai_tool" : "main"
      });
    }
    selectedN8nNodeName = node.name;
    selectedN8nEdgeId = layout.edges.find(edge => edge.target === node.name)?.id || selectedN8nEdgeId;
    saveState("Bloco criado");
    renderAll();
    addLog("ok", "Bloco criado", `${node.label || node.name} foi adicionado ao fluxo local.`);
  }

  function duplicateSelectedN8nNode() {
    const node = selectedN8nNode();
    if (!node) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const existingNames = workflowEditorNodeNames(workflow, layout);
    const copy = normalizeCustomNode({
      ...node,
      name: `${n8nNodeDisplayName(node)} copia`,
      label: `${n8nNodeDisplayName(node)} copia`
    }, existingNames);
    const currentPosition = layout.nodes[node.name] || nodePositionWithSize({}, { x: N8N_PADDING, y: N8N_PADDING }, layout);
    layout.customNodes.push(copy);
    layout.nodes[copy.name] = {
      x: clampNumber(currentPosition.x + 70, 8, 6000),
      y: clampNumber(currentPosition.y + 70, 8, 6000),
      width: currentPosition.width,
      height: currentPosition.height
    };
    selectedN8nNodeName = copy.name;
    saveState("Bloco duplicado");
    renderAll();
    addLog("ok", "Bloco duplicado", `${copy.label} foi criado como bloco editavel.`);
  }

  function deleteSelectedN8nNode() {
    const node = selectedN8nNode();
    if (!node) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const remainingCount = workflowEditorNodes(workflow, layout).length;
    if (remainingCount <= 1) {
      addLog("warn", "Bloco mantido", "O fluxo precisa ter pelo menos um bloco visivel.");
      return;
    }
    if (node.custom) {
      layout.customNodes = layout.customNodes.filter(item => item.name !== node.name);
    } else if (!layout.removedNodes.includes(node.name)) {
      layout.removedNodes.push(node.name);
    }
    delete layout.nodes[node.name];
    delete layout.nodeEdits[node.name];
    layout.edges = layout.edges.filter(edge => edge.source !== node.name && edge.target !== node.name);
    selectedN8nNodeName = workflowEditorNodes(workflow, layout)[0]?.name || "";
    selectedN8nEdgeId = layout.edges[0]?.id || "";
    saveState("Bloco removido");
    renderAll();
    addLog("warn", "Bloco removido", `${n8nNodeDisplayName(node)} saiu do layout local. Resetar restaura os blocos importados.`);
  }

  function updateN8nNodeScale(nextScale) {
    const layout = ensureN8nEditorLayout();
    const currentScale = clampNumber(layout.nodeScale || 1, N8N_NODE_SCALE_MIN, N8N_NODE_SCALE_MAX);
    const safeScale = clampNumber(nextScale, N8N_NODE_SCALE_MIN, N8N_NODE_SCALE_MAX);
    const ratio = safeScale / currentScale;
    Object.values(layout.nodes || {}).forEach(position => {
      position.width = clampNumber((position.width || N8N_NODE_WIDTH) * ratio, 150, 620);
      position.height = clampNumber((position.height || N8N_NODE_HEIGHT) * ratio, 110, 520);
    });
    layout.nodeScale = safeScale;
    saveState("Tamanho do bloco ajustado");
    renderAll();
    addLog("info", "Tamanho ajustado", `Blocos do fluxo em ${Math.round(safeScale * 100)}%.`);
  }

  function saveCurrentN8nLayout() {
    ensureN8nEditorLayout();
    saveState("Layout aplicado");
    renderSafeJsonOutput();
    addLog("ok", "Layout aplicado", "Posicoes, zoom e linhas do workflow selecionado foram salvos neste navegador.");
  }

  function updateN8nZoom(nextZoom, reason) {
    const layout = ensureN8nEditorLayout();
    layout.zoom = clampNumber(nextZoom, N8N_ZOOM_MIN, N8N_ZOOM_MAX);
    saveState(reason || "Zoom ajustado");
    renderN8nLayout();
    renderSafeJsonOutput();
  }

  function fitN8nZoom() {
    const layout = ensureN8nEditorLayout();
    const bounds = n8nBounds(layout);
    const shell = el.n8nBoardViewport?.parentElement;
    const availableWidth = Math.max(320, (shell?.clientWidth || 980) - 28);
    updateN8nZoom(Math.min(1, availableWidth / bounds.width), "Zoom ajustado ao canvas");
    addLog("info", "Canvas ajustado", "Zoom calculado para caber melhor na largura visivel.");
  }

  function mainPathOrder(workflow, layout) {
    const mainEdges = layout.edges.filter(edge => edge.type === "main");
    const sources = new Set(mainEdges.map(edge => edge.source));
    const targets = new Set(mainEdges.map(edge => edge.target));
    const nodes = workflowEditorNodes(workflow, layout);
    const start = nodes.find(node => sources.has(node.name) && !targets.has(node.name))?.name || "Webhook";
    const order = [];
    const seen = new Set();
    let current = start;
    while (current && !seen.has(current)) {
      order.push(current);
      seen.add(current);
      current = mainEdges.find(edge => edge.source === current && !seen.has(edge.target))?.target || "";
    }
    nodes.forEach(node => {
      if ((node.kind === "trigger" || node.kind === "wait" || node.kind === "agent" || node.kind === "action") && !seen.has(node.name)) {
        order.push(node.name);
        seen.add(node.name);
      }
    });
    return order;
  }

  function autoLayoutN8nWorkflow() {
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const nodes = workflowEditorNodes(workflow, layout);
    const order = mainPathOrder(workflow, layout);
    const placed = new Set();
    const startX = 40;
    const gapX = Math.round((N8N_NODE_WIDTH * (layout.nodeScale || 1)) + 90);

    order.forEach((name, index) => {
      layout.nodes[name] = {
        ...nodePositionWithSize(layout.nodes[name], { x: startX + index * gapX, y: 58 }, layout),
        x: startX + index * gapX,
        y: 58
      };
      placed.add(name);
    });

    const rows = [
      { kinds: ["model"], y: 320, x: 360 },
      { kinds: ["memory"], y: 510, x: 620 },
      { kinds: ["tool"], y: 720, x: 760 },
      { kinds: ["trigger", "wait", "agent", "action"], y: 930, x: 40 }
    ];
    rows.forEach(row => {
      let column = 0;
      nodes
        .filter(node => row.kinds.includes(node.kind) && !placed.has(node.name))
        .forEach(node => {
          layout.nodes[node.name] = {
            ...nodePositionWithSize(layout.nodes[node.name], { x: row.x + column * gapX, y: row.y }, layout),
            x: row.x + column * gapX,
            y: row.y
          };
          placed.add(node.name);
          column += 1;
        });
    });

    saveState("Fluxo realinhado");
    renderAll();
    addLog("ok", "Fluxo realinhado", "Blocos foram organizados por fluxo principal, modelos, memoria e ferramentas.");
  }

  function selectedLayoutEdge(layout = ensureN8nEditorLayout()) {
    return layout.edges.find(edge => edge.id === selectedN8nEdgeId) || layout.edges[0] || null;
  }

  function reconnectSelectedEdge() {
    const layout = ensureN8nEditorLayout();
    const edge = selectedLayoutEdge(layout);
    if (!edge) return;
    edge.source = el.n8nSourceSelect.value;
    edge.target = el.n8nTargetSelect.value;
    edge.type = N8N_EDGE_TYPES.includes(el.n8nEdgeTypeSelect.value) ? el.n8nEdgeTypeSelect.value : "main";
    selectedN8nEdgeId = edge.id;
    saveState("Linha reconectada");
    renderAll();
    addLog("ok", "Linha reconectada", `${edge.source} -> ${edge.target} (${edge.type}).`);
  }

  function createN8nEdge() {
    const layout = ensureN8nEditorLayout();
    const edge = {
      id: `edge-custom-${Date.now().toString(36)}`,
      source: el.n8nSourceSelect.value,
      target: el.n8nTargetSelect.value,
      type: N8N_EDGE_TYPES.includes(el.n8nEdgeTypeSelect.value) ? el.n8nEdgeTypeSelect.value : "main"
    };
    layout.edges.push(edge);
    selectedN8nEdgeId = edge.id;
    saveState("Linha criada");
    renderAll();
    addLog("ok", "Linha criada", `${edge.source} -> ${edge.target} (${edge.type}).`);
  }

  function removeSelectedN8nEdge() {
    const layout = ensureN8nEditorLayout();
    const edge = selectedLayoutEdge(layout);
    if (!edge) return;
    layout.edges = layout.edges.filter(item => item.id !== edge.id);
    selectedN8nEdgeId = layout.edges[0]?.id || "";
    saveState("Linha removida");
    renderAll();
    addLog("warn", "Linha removida", `${edge.source} -> ${edge.target} foi removida do layout local.`);
  }

  function beginN8nDrag(event) {
    const resizeHandle = event.target.closest("[data-n8n-resize]");
    if (resizeHandle && event.button === 0) {
      beginN8nResize(event, resizeHandle.dataset.n8nResize);
      return;
    }
    const button = event.target.closest("[data-n8n-node]");
    if (!button || event.button !== 0) return;
    const workflow = selectedImportedWorkflow();
    const layout = ensureN8nEditorLayout(workflow);
    const name = button.dataset.n8nNode;
    const position = layout.nodes[name];
    if (!position) return;
    selectedN8nNodeName = name;
    n8nDragState = {
      name,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
      moved: false
    };
    event.preventDefault();
    window.addEventListener("pointermove", moveN8nDrag);
    window.addEventListener("pointerup", finishN8nDrag, { once: true });
    renderN8nLayout();
  }

  function beginN8nResize(event, name) {
    const layout = ensureN8nEditorLayout();
    const position = layout.nodes[name];
    if (!position) return;
    selectedN8nNodeName = name;
    n8nResizeState = {
      name,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: position.width || N8N_NODE_WIDTH,
      startHeight: position.height || N8N_NODE_HEIGHT,
      moved: false
    };
    event.preventDefault();
    event.stopPropagation();
    window.addEventListener("pointermove", moveN8nResize);
    window.addEventListener("pointerup", finishN8nResize, { once: true });
    renderN8nLayout();
  }

  function moveN8nResize(event) {
    if (!n8nResizeState) return;
    const layout = ensureN8nEditorLayout();
    const dx = (event.clientX - n8nResizeState.startClientX) / layout.zoom;
    const dy = (event.clientY - n8nResizeState.startClientY) / layout.zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) n8nResizeState.moved = true;
    const current = layout.nodes[n8nResizeState.name];
    if (!current) return;
    current.width = clampNumber(n8nResizeState.startWidth + dx, 150, 620);
    current.height = clampNumber(n8nResizeState.startHeight + dy, 110, 520);
    renderN8nLayout();
    renderSafeJsonOutput();
  }

  function finishN8nResize() {
    window.removeEventListener("pointermove", moveN8nResize);
    const resizedNode = n8nResizeState?.name || "";
    const moved = Boolean(n8nResizeState?.moved);
    n8nResizeState = null;
    if (moved) {
      saveState("Bloco redimensionado");
      addLog("ok", "Bloco redimensionado", `${resizedNode} teve largura e altura ajustadas no layout local.`);
    }
    renderN8nLayout();
    renderSafeJsonOutput();
  }

  function moveN8nDrag(event) {
    if (!n8nDragState) return;
    const layout = ensureN8nEditorLayout();
    const dx = (event.clientX - n8nDragState.startClientX) / layout.zoom;
    const dy = (event.clientY - n8nDragState.startClientY) / layout.zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) n8nDragState.moved = true;
    layout.nodes[n8nDragState.name] = {
      x: clampNumber(n8nDragState.startX + dx, 8, 5000),
      y: clampNumber(n8nDragState.startY + dy, 8, 5000)
    };
    renderN8nLayout();
    renderSafeJsonOutput();
  }

  function finishN8nDrag() {
    window.removeEventListener("pointermove", moveN8nDrag);
    const movedNode = n8nDragState?.name || "";
    const moved = Boolean(n8nDragState?.moved);
    n8nDragState = null;
    if (moved) {
      saveState("Bloco movido");
      addLog("ok", "Bloco movido", `${movedNode} foi reposicionado no layout local.`);
    } else {
      revealN8nInspector();
    }
    renderN8nLayout();
    renderSafeJsonOutput();
  }

  function renderAll(existingResult) {
    const result = existingResult || validationResult();
    renderSetupGuide(result);
    renderBeginnerSupport(result);
    renderN8nLayout();
    renderCanvas();
    renderValidation(result);
    renderMetrics(result);
    renderNextActions(result);
    renderPromptPanel();
    renderSafeJsonOutput();
    renderWindows();
    renderLogs();
  }

  function attachEvents() {
    document.addEventListener("click", event => {
      const helpButton = event.target.closest("[data-help-topic]");
      if (!helpButton) return;
      event.preventDefault();
      openHelp(helpButton.dataset.helpTopic);
    });

    document.addEventListener("click", event => {
      const jumpButton = event.target.closest("[data-jump-to]");
      if (jumpButton) {
        event.preventDefault();
        jumpToTarget(jumpButton.dataset.jumpTo);
        return;
      }
      const activateButton = event.target.closest("[data-activate-integration]");
      if (activateButton) {
        event.preventDefault();
        activateIntegrationFromGuide(activateButton.dataset.activateIntegration);
        return;
      }
      const objectiveButton = event.target.closest("[data-objective-example]");
      if (objectiveButton) {
        event.preventDefault();
        const example = OBJECTIVE_EXAMPLES[objectiveButton.dataset.objectiveExample];
        if (!example) return;
        el.objectiveInput.value = example;
        readForm();
        saveState("Objetivo preenchido por exemplo");
        addLog("ok", "Objetivo preenchido", "Um exemplo simples foi colocado no campo de objetivo. Revise antes de usar.");
        renderAll();
        jumpToTarget("objectiveInput");
      }
    });

    if (el.helpCloseBtn) {
      el.helpCloseBtn.addEventListener("click", closeHelp);
    }

    if (el.helpModal) {
      el.helpModal.addEventListener("click", event => {
        if (event.target === el.helpModal) closeHelp();
      });
    }

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && el.helpModal && !el.helpModal.hidden) {
        closeHelp();
      }
    });

    if (el.askHelpBtn) {
      el.askHelpBtn.addEventListener("click", answerWorkflowHelp);
    }

    document.querySelectorAll("[data-recipe]").forEach(button => {
      button.addEventListener("click", () => applyQuickRecipe(button.dataset.recipe));
    });

    document.querySelectorAll("[data-enable]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.enable;
        readForm();
        state.integrations[key].enabled = true;
        saveState(`${button.textContent.trim()} ativado`);
        fillForm();
        addLog("ok", "Icone colocado no fluxo", `${button.querySelector("strong")?.textContent || key} foi ativado no canvas.`);
        renderAll();
      });
    });

    [
      el.workflowNameInput,
      el.objectiveInput,
      el.webhookEnabled,
      el.webhookUrlInput,
      el.webhookMethodInput,
      el.webhookKeyNameInput,
      el.whatsappEnabled,
      el.whatsappNumberInput,
      el.whatsappOwnerInput,
      el.whatsappStarterInput,
      el.whatsappModeInput,
      el.whatsappQrChecked,
      el.whatsappHumanChecked,
      el.whatsappHistoryChecked,
      el.emailEnabled,
      el.emailProviderInput,
      el.emailHostInput,
      el.emailPortInput,
      el.emailUserInput,
      el.emailFromInput,
      el.documentsEnabled,
      el.documentsSourceInput,
      el.documentsStorageInput,
      el.documentsParserInput,
      el.documentsTypesInput,
      el.documentsHumanChecked,
      el.documentsRetentionChecked
    ].forEach(input => {
      input.addEventListener("input", () => {
        readForm();
        saveState("Salvo localmente");
        renderAll();
      });
      input.addEventListener("change", () => {
        readForm();
        saveState("Salvo localmente");
        renderAll();
      });
    });

    [el.webhookSecretInput, el.emailSecretInput].forEach(input => {
      input.addEventListener("change", () => {
        readForm();
        saveState("Credencial atualizada");
        fillForm();
        addLog("ok", "Credencial recebida", "O valor foi salvo localmente e sera exibido apenas como presente.");
        renderAll();
      });
    });

    el.saveObjectiveBtn.addEventListener("click", () => validateAndSave(true));
    el.validateBtn.addEventListener("click", () => validateAndSave(true));
    el.validateTopBtn.addEventListener("click", () => validateAndSave(true));
    el.createWindowBtn.addEventListener("click", createMessageWindow);

    el.copyAgentBtn.addEventListener("click", async () => {
      readForm();
      saveState("Resumo gerado");
      const payload = JSON.stringify(safeAgentPayload(), null, 2);
      if (el.safeJsonOutput) el.safeJsonOutput.value = payload;
      const copied = await copyText(payload);
      addLog(
        copied ? "ok" : "warn",
        copied ? "JSON seguro copiado" : "JSON seguro gerado",
        copied ? "O resumo foi copiado sem revelar senha ou chave secreta." : "O navegador bloqueou copia automatica; use o campo Resumo seguro para copiar manualmente."
      );
    });

    el.copyPromptBtn.addEventListener("click", async () => {
      await copyText(TKA_RH_SUPPORT_AGENT_PROMPT);
      addLog("ok", "Prompt copiado", "Prompt RH preenchido pronto para colar no n8n.");
    });

    el.runPromptTestBtn.addEventListener("click", createPromptTest);

    if (el.n8nWorkflowSelect) {
      el.n8nWorkflowSelect.addEventListener("change", () => {
        state.selectedImportedWorkflow = el.n8nWorkflowSelect.value;
        const layout = ensureN8nEditorLayout();
        selectedN8nNodeName = selectedImportedWorkflow().nodes.find(node => node.kind === "agent")?.name || selectedImportedWorkflow().nodes[0]?.name || "";
        selectedN8nEdgeId = layout.edges[0]?.id || "";
        saveState("Fluxo selecionado");
        addLog("info", "Fluxo selecionado", `${selectedImportedWorkflow().label} esta ativo no canvas.`);
        renderAll();
      });
    }

    if (el.n8nApplyWorkflowBtn) {
      el.n8nApplyWorkflowBtn.addEventListener("click", applySelectedWorkflowToBuilder);
    }

    if (el.n8nZoomOutBtn) {
      el.n8nZoomOutBtn.addEventListener("click", () => {
        updateN8nZoom(ensureN8nEditorLayout().zoom - N8N_ZOOM_STEP, "Zoom reduzido");
      });
    }

    if (el.n8nZoomInBtn) {
      el.n8nZoomInBtn.addEventListener("click", () => {
        updateN8nZoom(ensureN8nEditorLayout().zoom + N8N_ZOOM_STEP, "Zoom aumentado");
      });
    }

    if (el.n8nSizeDownBtn) {
      el.n8nSizeDownBtn.addEventListener("click", () => {
        updateN8nNodeScale(ensureN8nEditorLayout().nodeScale - N8N_NODE_SCALE_STEP);
      });
    }

    if (el.n8nSizeUpBtn) {
      el.n8nSizeUpBtn.addEventListener("click", () => {
        updateN8nNodeScale(ensureN8nEditorLayout().nodeScale + N8N_NODE_SCALE_STEP);
      });
    }

    if (el.n8nFitBtn) el.n8nFitBtn.addEventListener("click", fitN8nZoom);
    if (el.n8nAutoLayoutBtn) el.n8nAutoLayoutBtn.addEventListener("click", autoLayoutN8nWorkflow);
    if (el.n8nSaveLayoutBtn) el.n8nSaveLayoutBtn.addEventListener("click", saveCurrentN8nLayout);
    if (el.n8nAddNodeBtn) el.n8nAddNodeBtn.addEventListener("click", createN8nNode);
    if (el.n8nDuplicateNodeBtn) el.n8nDuplicateNodeBtn.addEventListener("click", duplicateSelectedN8nNode);
    if (el.n8nDeleteNodeBtn) el.n8nDeleteNodeBtn.addEventListener("click", deleteSelectedN8nNode);
    if (el.n8nResetLayoutBtn) {
      el.n8nResetLayoutBtn.addEventListener("click", () => {
        resetN8nEditorLayout();
        renderAll();
        addLog("warn", "Layout resetado", "Fluxo selecionado voltou para as posicoes e linhas importadas.");
      });
    }

    if (el.n8nEdgeSelect) {
      el.n8nEdgeSelect.addEventListener("change", () => {
        selectedN8nEdgeId = el.n8nEdgeSelect.value;
        renderN8nLayout();
        renderSafeJsonOutput();
      });
    }

    if (el.n8nReconnectBtn) el.n8nReconnectBtn.addEventListener("click", reconnectSelectedEdge);
    if (el.n8nNewEdgeBtn) el.n8nNewEdgeBtn.addEventListener("click", createN8nEdge);
    if (el.n8nRemoveEdgeBtn) el.n8nRemoveEdgeBtn.addEventListener("click", removeSelectedN8nEdge);

    if (el.n8nInspector) {
      el.n8nInspector.addEventListener("click", event => {
        const action = event.target?.dataset?.nodeAction;
        if (!action) return;
        if (action === "save") saveSelectedN8nNodeFromEditor();
        if (action === "duplicate") duplicateSelectedN8nNode();
        if (action === "delete") deleteSelectedN8nNode();
      });
    }

    if (el.n8nNodes) {
      el.n8nNodes.addEventListener("pointerdown", beginN8nDrag);
      el.n8nNodes.addEventListener("click", event => {
        const button = event.target.closest("[data-n8n-node]");
        if (!button) return;
        event.preventDefault();
        selectN8nNode(button.dataset.n8nNode, { reveal: true });
      });
    }

    if (el.workflowCanvas) {
      el.workflowCanvas.addEventListener("click", event => {
        const card = event.target.closest("[data-flow-node]");
        if (!card) return;
        openFlowConfig(card.dataset.flowNode);
      });
      el.workflowCanvas.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest("[data-flow-node]");
        if (!card) return;
        event.preventDefault();
        openFlowConfig(card.dataset.flowNode);
      });
    }

    el.clearBuilderBtn.addEventListener("click", () => {
      const confirmed = window.confirm("Limpar a configuracao local deste navegador?");
      if (!confirmed) return;
      state = cloneDefaultState();
      saveState("Configuracao local limpa");
      fillForm();
      addLog("warn", "Configuracao local reiniciada", "O rascunho deste navegador foi apagado.");
      renderAll();
    });

    el.clearLogsBtn.addEventListener("click", () => {
      state.logs = [];
      saveState("Logs limpos");
      renderLogs();
    });

    el.messageWindows.addEventListener("input", event => {
      const id = event.target?.dataset?.windowBody;
      if (!id) return;
      const item = state.windows.find(windowItem => windowItem.id === id);
      if (!item) return;
      item.body = event.target.value;
      saveState("Janela atualizada");
    });

    el.messageWindows.addEventListener("click", async event => {
      const copyId = event.target?.dataset?.copyWindow;
      const deleteId = event.target?.dataset?.deleteWindow;
      if (copyId) {
        const item = state.windows.find(windowItem => windowItem.id === copyId);
        if (!item) return;
        await copyText(item.body);
        addLog("ok", "Mensagem copiada", `${channelLabel(item.channel)} pronto para revisao humana.`);
      }
      if (deleteId) {
        state.windows = state.windows.filter(item => item.id !== deleteId);
        saveState("Janela removida");
        addLog("warn", "Janela removida", "O rascunho foi removido somente deste navegador.");
        renderAll();
      }
    });
  }

  fillForm();
  renderFieldHelpHints();
  attachEvents();
  if (!state.logs.length) {
    addLog("info", "Builder iniciado", "Configure objetivo, icones e credenciais. O agente local vai mostrar o que falta.");
  }
  renderAll();
})();
