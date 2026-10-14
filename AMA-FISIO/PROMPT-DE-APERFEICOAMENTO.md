# Prompt para aprimoramento do AMA FISIO

Melhore o AMA FISIO sem alterar a identidade visual do logo original, sem acrescentar planos pagos e mantendo o foco no **cadastro dos clientes de fisioterapia**. Preserve o layout responsivo para computador, tablet e celular e a funcionalidade de agenda com sino interno de lembretes configuráveis, contagem e marcação como lido.

A autenticação deverá apresentar **somente os campos "Login" (Amanda Marinho) e "Senha"**. Use o Firebase Authentication para verificar a senha sem guardá-la no cliente, utilizando um identificador técnico interno e validando exclusivamente o UID autorizado nas regras do Firestore. Não exija e-mail pessoal, não implemente cadastro público de funcionários e não utilize Cloud Functions, notificações por e-mail, WhatsApp, push ou SMS. Não afrouxe as regras do Firestore, não inclua segredos no repositório e não crie cobrança no Firebase.

Aprimore UX e validação de formulários, filtros, controle de duplicados, acessibilidade, proteção de dados pessoais de saúde, privacidade, testes de autorização, exportação controlada, boas práticas de backup e adequação à LGPD. Qualquer campo clínico novo deve ser confirmado com a proprietária antes do uso real.
