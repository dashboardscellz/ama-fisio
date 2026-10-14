# AMA FISIO — Cadastro de clientes + agendamentos internos

**Versão 1.3.0: acesso exclusivo de Amanda Marinho, sem pedir e-mail na tela, sem notificações externas e compatível com Firebase Spark.**

## O que já está preparado

- Logo original da AMA FISIO preservada.
- Login pelo nome **Amanda Marinho** e **senha**, sem campo de e-mail no site.
- Apenas a conta mestre autorizada pode acessar os cadastros e os agendamentos.
- Cadastros de clientes com busca, edição, contatos, responsável, informações básicas e exportação CSV.
- Agenda com remarcação, situação da consulta e lembretes internos opcionais.
- Sino 🔔 com contador, **Lembretes** e **Hoje**, marcação como lido e visualização no celular, tablet e computador.
- Dados no **Cloud Firestore**; autenticação protegida pelo Firebase Authentication.
- **Nenhum WhatsApp, SMS, push, e-mail de agendamento, Resend ou Cloud Functions.**

## Como funciona o login sem e-mail

O Firebase Authentication tradicional oferece validação de **e-mail + senha**. Para manter a interface pedida, o AMA FISIO converte internamente o nome *Amanda Marinho* em um **identificador técnico em formato de e-mail reservado**, que não é o endereço pessoal da Amanda e não serve para receber mensagens. A pessoa nunca informa esse identificador no site. A senha é validada pelo Firebase; **não é incluída no HTML, JavaScript nem no GitHub**.

O instalador cria essa identidade técnica e obtém o **UID**, que é vinculado às regras do Firestore. **As regras autorizam somente esse UID**, nunca o nome ou a senha escrita em código. Até concluir o instalador e publicar as regras, o banco criado no modo produção continua bloqueado.

**Recuperação:** como não existe caixa de e-mail pessoal associada, não haverá recuperação automática por e-mail. Guarde a senha em um gerenciador de senhas. Se esquecê-la, a recuperação exigirá intervenção administrativa segura no Firebase, não um link enviado por e-mail.

## Instalação — a partir da tela Firestore criada

**Jeito mais simples no Windows:** extraia o ZIP, entre na pasta `AMA-FISIO` e dê dois cliques em **`INSTALAR-NO-WINDOWS.bat`**. Se aparecer que Node.js não está instalado, instale a versão LTS em [nodejs.org](https://nodejs.org) e execute o arquivo novamente. O instalador pedirá a senha da conta mestre e abrirá o navegador para autorizar a publicação. Não precisa informar nenhum e-mail pessoal da Amanda. O processo exige internet e acesso à conta Google que administra o Firebase, apenas para publicar.

**Alternativa manual:**

Você já concluiu: projeto `ama-fisio`, aplicativo Web, Authentication com `E-mail/senha` ativo e Cloud Firestore no modo produção.

**Fase A — Fazer uma vez no computador (Node.js 18+):**

1. Extraia o ZIP e abra um terminal (PowerShell) na pasta `AMA-FISIO` que contém `package.json`.
2. Execute `npm run configurar:mestre`. O programa pedirá **somente a senha mestre**, sem mostrá-la enquanto digita. Não solicita e-mail, conta de serviço nem cria cobrança. **Faça isso antes de publicar o código.**
3. O programa cria a conta no Firebase Authentication e coloca o UID em `docs/config.js` e `firestore.rules`. A senha nunca é salva no repositório.
4. Execute `npm install` para instalar as ferramentas locais, `npx firebase login` para autorizar a publicação pelo Google e `npm run deploy` para publicar o site e as regras no seu projeto Firebase.
5. O site ficará normalmente em `https://ama-fisio.web.app` (a URL efetiva é exibida pelo Firebase CLI). Entre com **Amanda Marinho** e a senha escolhida no passo 2.

**Importante:** o passo `npx firebase login` abre a conta Google que administra seu projeto Firebase somente para *publicar o site*. Isso não altera o login da Amanda no AMA FISIO.

**Fase B — Segurança:**

1. Em **Firestore → Regras**, confirme que o UID foi preenchido e que não há `allow read, write: if true`.
2. Em **Authentication → Usuários**, deve existir a identidade técnica criada pelo instalador; ela não é um e-mail pessoal.
3. Teste o cadastro com dados fictícios e confirme que a versão publicada exige login. Depois realize um teste de logout, um agendamento e um aviso do sino.
4. **Não insira dados reais de pacientes até testar todas as permissões e revisar as medidas necessárias à LGPD** (dados de saúde são sensíveis).

### Caso você não tenha Node.js

Baixe-o de [nodejs.org](https://nodejs.org) (versão LTS). A aplicação publicada não exige Node.js no computador/celular dos funcionários; ele só é usado para a primeira configuração e para publicar as atualizações.

### Arquivos principais

- `docs/index.html`: página inicial.
- `docs/app.js`: aplicação, login e notificações.
- `docs/styles.css`: visual responsivo.
- `docs/config.js`: dados **públicos** de conexão ao projeto `ama-fisio` + UID (não tem senha).
- `firestore.rules`: acesso exclusivo ao UID da Amanda, bloqueio de outros usuários.
- `scripts/configurar-mestre.mjs`: instalador local, sem conta de serviço e sem e-mail pessoal.
- `firebase.json`: Firebase Hosting + Firestore Rules (sem Cloud Functions).

### GitHub

O repositório pode conter código, regras de acesso e as informações públicas de configuração do Firebase. **Jamais inclua senhas, documentos reais de pacientes, token de acesso, chaves privadas ou backups do Firestore.** O repositório deve ser privado inicialmente. A publicação do site é feita pelo Firebase Hosting, enquanto o GitHub serve ao versionamento do código.

### Lembretes do site

Ao cadastrar um agendamento, em **Lembrete dentro do site**, escolha `Não lembrar`, `No dia`, `1 dia antes` ou `2 dias antes`. Quando Amanda entrar no site, o sino 🔔 exibirá o número de lembretes pendentes, e a aba **Hoje** mostrará os atendimentos do dia. Os lembretes são calculados a partir dos registros do Firestore, não chegam com o site fechado nem enviam mensagens a clientes.

## Limitações e cuidados

- O projeto permanece no **Spark**, sujeito às cotas de uso do Firebase. Sem ativar faturamento, não haverá cobranças automáticas do plano Blaze, mas o serviço pode parar ao atingir cotas.
- Firebase Authentication utiliza tecnicamente uma identidade em formato de e-mail para o método senha. O uso de nome de usuário puro em um provedor dedicado exigiria outro mecanismo de autenticação/servidor; **não substituímos isso por senha escrita no site porque seria inseguro**.
- A senha inicial já compartilhada na conversa não foi incluída nos arquivos: configure uma **senha nova e exclusiva**.
- Sem e-mail, a recuperação de senha não é automática.
- O áudio original sobre os campos dos cadastros não pôde ser interpretado integralmente; revise os campos antes de uso real.
- O sistema é uma versão inicial e não substitui políticas clínicas de segurança, backups, sigilo e conformidade com a LGPD.
