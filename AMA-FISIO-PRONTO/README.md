# AMA FISIO — versão completa e protegida

**Projeto:** `ama-fisio` • **Conta autorizada (UID):** `yBUz70Z0iSWkyxFB65tfkmS8Wfk1`.

## O que está funcionando no código

- Login na tela somente por nome `Amanda Marinho` e senha. O Firebase autentica internamente a identidade técnica, sem pedir endereço de e-mail na tela.
- Cadastros de clientes, fichas, edição, pesquisa e exportação CSV.
- Agenda de atendimentos, remarcação e status.
- Sino de lembretes internos (não lembrar / no dia / 1 ou 2 dias antes), contador de avisos, 'Hoje' e marcar como lido.
- Sem notificação por WhatsApp, SMS ou e-mail; sem Cloud Functions; sem instalar Node.js no seu PC.
- Responsivo no computador, celular e tablet.

## 1) Enviar ao GitHub SEM sobrescrever a pasta antiga

1. Extraia o ZIP `AMA-FISIO-PARA-GITHUB.zip`.
2. Abra a pasta `AMA-FISIO-PARA-GITHUB` que foi extraída.
3. Na aba **Code** do repositório `dashboardsceIIz/ama-fisio`, clique **Add file → Upload files**.
4. Arraste para a área de upload **as duas pastas** que estão dentro dela: `AMA-FISIO-PRONTO` e `.github` (inclui `workflows/publicar-ama-fisio.yml`). Não envie o ZIP fechado e não coloque ambas dentro de outra pasta no GitHub.
5. Clique **Commit changes**. A pasta antiga `AMA-FISIO/` pode permanecer. A nova versão é `AMA-FISIO-PRONTO/`; o workflow publica apenas esta nova pasta.
6. Confira que no GitHub existem `AMA-FISIO-PRONTO/docs/index.html` e `.github/workflows/publicar-ama-fisio.yml`.

Se o GitHub web não aceitar a pasta `.github` por drag-and-drop, use **Add file → Create new file** e dê o nome literal `.github/workflows/publicar-ama-fisio.yml`; cole o conteúdo do arquivo da mesma pasta do ZIP. Isso é necessário apenas uma vez.

## 2) Firestore → Regras: PUBLICAR UMA ÚNICA VEZ

**Faça esta etapa antes de cadastrar pacientes.**

1. No Firebase console, abra **Firestore Database** (não 'Realtime Database').
2. Selecione banco `(default)` e a aba **Regras**.
3. Copie **todo** o conteúdo do arquivo `AMA-FISIO-PRONTO/firestore.rules`, cole no editor, substituindo a regra de bloqueio inicial.
4. Clique **Publicar** e aguarde a confirmação. Não use regras como `allow read, write: if true;`.
5. As regras autorizam somente o UID mestre `yBUz70Z0iSWkyxFB65tfkmS8Wfk1` e só permitem os tipos de documento previstos pelo site.

Apenas **enviar o arquivo ao GitHub não publica as regras no Firebase**. Para sincronizar regras futuramente, atualize e publique de novo na aba Regras (a ação incluída no ZIP publica apenas o site no Hosting).

Link: https://console.firebase.google.com/project/ama-fisio/firestore/rules

## 3) Preparar a publicação pelo GitHub Actions (sem programas no PC)

O arquivo `.github/workflows/publicar-ama-fisio.yml` está pronto, mas ainda exige credenciais de publicação. Nunca coloque um JSON de conta de serviço no repositório público.

1. No Firebase, abra **Configurações do projeto → Contas de serviço**. Para a automação, crie/obtenha uma credencial de conta de serviço com acesso estritamente necessário à publicação do Hosting. Isso pode envolver as permissões no Google Cloud vinculadas ao Firebase; não exige instalar programa no computador.
2. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret**.
3. Nome do segredo: **`FIREBASE_SERVICE_ACCOUNT_AMA_FISIO`**. Conteúdo: JSON privado da conta de serviço. Cole somente no formulário de Secret; não em arquivos públicos, prints ou chat.
4. Acesse **Actions → Publicar AMA FISIO no Firebase Hosting → Run workflow** e acompanhe o resultado. Alterações futuras na pasta `AMA-FISIO-PRONTO/` publicam automaticamente ao fazer commit na `main`.
5. Confira o endereço mostrado pelo Firebase Hosting. Normalmente será `https://ama-fisio.web.app`, se o site padrão estiver configurado.

O GitHub Actions usa ferramentas nos computadores hospedados pelo próprio GitHub. Nada precisa ser instalado no seu Windows. Se uma etapa informar permissão insuficiente, ajuste apenas a permissão da conta de serviço, sem publicar a chave.

## 4) Verificar o login

- O método **Authentication → Método de login → E-mail/senha** já foi habilitado.
- A conta técnica cadastrada em **Authentication → Usuários** deve estar associada ao UID `yBUz70Z0iSWkyxFB65tfkmS8Wfk1` e ao identificador `amanda.marinho.ama-fisio@example.com` utilizado pelo app. Essa identidade é um identificador de login, não a caixa de e-mail pessoal da Amanda.
- A senha **não** aparece neste ZIP. Utilize a senha que foi definida ao criar a conta no Firebase. É recomendável alterar a senha inicialmente compartilhada em conversas.
- Se o site abrir e disser senha incorreta, verifique primeiro se o UID/identificador da conta são os mesmos indicados em `docs/config.js`.
- Teste primeiro com **dados totalmente fictícios**, e confirme que alguém sem login não consegue acessar as coleções.

## Segurança e limites

O repositório é público por escolha do proprietário. A configuração Web do Firebase e o UID não são senhas, mas **NUNCA** publique dados reais de pacientes, fotos de documentos, exportações CSV, chaves privadas ou backups. O Firestore precisa das regras publicadas antes do uso. Informações de saúde são dados pessoais sensíveis; avalie requisitos da LGPD, política de privacidade e controle de acesso antes de produção. Sem e-mail real associado à conta, a recuperação automática de senha por e-mail não funcionará.

A base das regras é compatível com o plano gratuito Spark, mas o uso está sujeito às cotas atuais. Este projeto não inclui serviço de mensagens pago.
