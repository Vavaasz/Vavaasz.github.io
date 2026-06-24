# Body Cam - Termo de Responsabilidade

Modulo operacional em `/operacional/inventario/body-cam/`.

Fluxo:

1. Acesse `Operacional > Inventario > Body Cam`.
2. Cadastre o equipamento na aba `Equipamentos cadastrados`.
3. Na aba `Termo de Responsabilidade`, informe o usuario ou posto manualmente se ele nao existir no portal, selecione a Body Cam e clique em `Gerar link publico do termo`.
4. Envie o link publico individual para o colaborador.
5. O colaborador abre o link, acessa ou baixa o PDF do manual X7 publicado no sistema, preenche nome completo, documento, cargo/funcao, posto de uso, turno de trabalho, empresa, data da entrega, responsavel pela entrega, cidade, dia/hora, marca as duas confirmacoes obrigatorias, confere a assinatura da empresa carregada do Admin, assina no canvas existente do portal e envia.

Colecoes Firestore:

- `operacional_body_cam_equipment`: cadastro simples dos equipamentos.
- `operacional_body_cam_terms`: termos gerados, payload assinado, `termVersion`, `signedAt`, assinatura e snapshot do texto vigente no momento da assinatura.

O modulo usa a assinatura compartilhada de `/shared/signature-tools.js`, o mesmo Firebase do portal e exportacao PDF via jsPDF.
