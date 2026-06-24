# Veiculos - Termo de Responsabilidade

Modulo operacional em `/operacional/inventario/veiculos/`.

Fluxo:

1. Acesse `Operacional > Inventario > Veiculos`.
2. Cadastre o veiculo da frota com marca, modelo, placa, prefixo/frota, renavam/chassi, condicao e observacoes.
3. Na aba `Termo de Responsabilidade`, selecione o usuario/posto e o veiculo para gerar o link publico individual.
4. O colaborador abre o link, preenche CPF, cargo, posto, turno, empresa, data, responsavel, cidade, confirma as normas da frota e assina.
5. Depois da assinatura do colaborador, o admin pode abrir o termo e salvar as assinaturas manuais de `Coordenacao Operacional` e `Lideranca Operacional`. A assinatura do Diretor vem do documento `system/ownerSignature`.
6. O termo fica completo somente quando colaborador, Diretor, Coordenacao Operacional e Lideranca Operacional estiverem assinados. Arquivamento e reativacao usam o mesmo fluxo archive-only do Body Cam.

Colecoes Firestore:

- `operacional_fleet_vehicles`: cadastro dos veiculos da frota.
- `operacional_fleet_vehicle_terms`: termos gerados, assinatura do colaborador, assinatura do Diretor, assinaturas operacionais, snapshot do texto vigente e metadados de arquivo.

O modulo usa `/shared/signature-tools.js`, o Firebase do portal e exportacao PDF via jsPDF. O PDF fonte recebido fica em `assets/termo-responsabilidade-veiculos-frota.pdf`.
