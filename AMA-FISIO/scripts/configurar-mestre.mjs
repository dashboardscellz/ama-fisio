/**
 * AMA FISIO: instalação da conta mestre SEM e-mail pessoal e SEM segredo no site.
 * Requer Node.js 18+ e Authentication E-mail/senha ativo no Firebase (internamente).
 * A API Auth ainda exige um identificador com formato de e-mail, por isso o
 * aplicativo usa uma identidade técnica reservada; nenhuma mensagem é enviada.
 * Rode isto em um computador confiável antes de publicar o site.
 * Uso: npm run configurar:mestre
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=path.join(projectRoot,'docs','config.js');
const rulesPath=path.join(projectRoot,'firestore.rules');
const cfg=await fs.readFile(configPath,'utf8');
const rules=await fs.readFile(rulesPath,'utf8');
const apiKey=cfg.match(/apiKey:\s*['"]([^'"]+)['"]/)?.[1];
const internalAuthId=cfg.match(/internalAuthId:\s*['"]([^'"]+)['"]/)?.[1];
const currentUid=cfg.match(/masterUid:\s*['"]([^'"]+)['"]/)?.[1];
if (!apiKey || !internalAuthId || !currentUid || apiKey.includes('COLE_')) {
  console.error('Configuração incompleta em docs/config.js');process.exit(1);
}
if (!rules.includes('COLE_UID_AMANDA_AQUI') && currentUid === 'COLE_UID_AMANDA_AQUI'){
  console.error('O UID nas regras está inconsistente. Não é seguro continuar.');process.exit(1);
}
if(!process.stdin.isTTY){
  console.error('Por segurança, execute este comando no Terminal/PowerShell interativo.');process.exit(1);
}
console.log('\nAMA FISIO — Configurar acesso exclusivo da Amanda');
console.log('A tela do site terá somente Login e Senha.');
console.log('A senha digitada abaixo não será exibida nem salva em arquivo.\n');
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
const originalWriter=rl._writeToOutput.bind(rl);
rl._writeToOutput = function(value) { if (!this.muteOutput) originalWriter(value); };
rl.muteOutput=true;
const password=await new Promise(resolve=>{
  process.stdout.write('Informe a senha mestre (recomendado 12+ caracteres): ');
  rl.question('',answer=>resolve(answer));
});
rl.muteOutput=false;
rl.close();
process.stdout.write('\n');
if(password.length<8){
  console.error('A senha mestre precisa ter ao menos 8 caracteres.');process.exit(1);
}
if(password.length<12){
  console.log('Aviso: para dados de pacientes, uma senha exclusiva com 12+ caracteres é mais segura.');
}

async function request(endpoint,body){
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const result=await response.json();
  if(!response.ok){const err=new Error(result.error?.message||'Falha no Firebase Authentication');err.code=result.error?.message;throw err;}
  return result;
}
let result;
try{
  result=await request('signUp',{email:internalAuthId,password,returnSecureToken:true});
  console.log('Identidade técnica criada no Firebase com sucesso.');
}catch(err){
  if(err.code==='EMAIL_EXISTS'){
    try{result=await request('signInWithPassword',{email:internalAuthId,password,returnSecureToken:true});
      console.log('Conta técnica existente confirmada pela senha.');
    }catch{
      console.error('Já existe uma conta com este identificador técnico e a senha não confere.');
      console.error('Não altere regras de segurança: verifique a conta no Firebase Authentication.');
      process.exit(1);
    }
  }else{
    console.error('Não foi possível criar a conta:',err.code||err.message);
    if(err.code==='OPERATION_NOT_ALLOWED') console.error('Ative Authentication → Método de login → E-mail/senha.');
    process.exit(1);
  }
}
const uid=result.localId;
if(!/^[a-zA-Z0-9_-]{5,128}$/.test(uid)){console.error('UID retornado é inválido. Nada foi alterado.');process.exit(1);}
if(currentUid!=='COLE_UID_AMANDA_AQUI'&&currentUid!==uid){
  console.error('Este projeto já está vinculado a outro UID. Não alterei as permissões.');process.exit(1);
}
const newConfig=cfg.replace(/(masterUid:\s*)['"][^'"]+['"]/,`$1'${uid}'`);
const newRules=rules.replace(/'COLE_UID_AMANDA_AQUI'/g,`'${uid}'`);
if(!newRules.includes(`request.auth.uid == '${uid}'`)){
  console.error('O UID já foi substituído por outro valor em firestore.rules. Nada foi alterado.');process.exit(1);
}
await fs.writeFile(configPath,newConfig);
await fs.writeFile(rulesPath,newRules);
console.log('\nConta AMA FISIO preparada no projeto ama-fisio.');
console.log('UID vinculado nas regras e no site:',uid);
console.log('Próximo passo: npm install ; npx firebase login ; npm run deploy');
console.log('Não envie nem publique a senha da conta mestre.\n');
