/* AMA FISIO — aplicativo web sem build, pronto para Firebase Hosting/GitHub Pages.
 * Dados pessoais em produção SEMPRE no Firestore, nunca em localStorage.
 */
const config = window.AMA_CONFIG || {};
const root = document.querySelector('#app');
const brand = './assets/logo-ama-fisio.png';
const state = {
  mode: 'boot', view: 'dashboard', modal: '', editId: null,
  currentUser: null, profile: null, isMaster: false, demo: false, menuOpen: false,
  clients: [], appointments: [], users: [], search: '', statusFilter: 'all', appointmentFilter: 'all',
  unsub: [], sdk: null, busy: false,
  notificationsOpen: false, notificationTab: 'reminders', reminderReads: {},
  appointmentDayFilter: 'all'
};

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const digits = v => String(v ?? '').replace(/\D/g, '');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const formatDate = s => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
const initials = name => String(name||'AF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const localNow = () => new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
const niceStatus = {active:'Ativo',inactive:'Inativo',pending:'Pendente',blocked:'Bloqueado',scheduled:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado'};
const statusColor = {active:'green',inactive:'gray',pending:'yellow',blocked:'pink',scheduled:'yellow',confirmed:'green',completed:'blue',cancelled:'pink'};
const pill = status => `<span class="pill ${statusColor[status]||'gray'}">${esc(niceStatus[status]||status||'—')}</span>`;
const getClient = id => state.clients.find(c => c.id === id);
let toastTimer;
function toast(message, error=false) { const t=document.querySelector('#toast'); if (!t) return; t.textContent=message; t.className=`toast show${error?' error':''}`; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className='toast',4400); }
function firebaseMessage(err){ const code = err?.code||''; const map={
  'auth/invalid-credential':'Usuário ou senha incorretos.','auth/invalid-email':'Não foi possível autenticar. Confira a configuração.',
  'auth/email-already-in-use':'A conta mestre já existe.','auth/weak-password':'A senha precisa ser mais forte.',
  'auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/network-request-failed':'Sem conexão. Confira a internet.',
  'permission-denied':'Sem permissão. Confira o UID da Amanda e as regras publicadas do Firestore.',
  'auth/unauthorized-domain':'Adicione este domínio aos domínios autorizados do Firebase Authentication.'
}; return map[code] || err?.message || 'Não foi possível completar esta operação.'; }
const field = (name,label,value='',type='text',extra='') => `<div class="field"><label for="f-${name}">${esc(label)}</label><input id="f-${name}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const selectField = (name,label,value,options) => `<div class="field"><label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${esc(name)}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
const textareaField = (name,label,value='') => `<div class="field wide"><label for="f-${name}">${esc(label)}</label><textarea id="f-${name}" name="${esc(name)}">${esc(value)}</textarea></div>`;
const button = (label, act, kind='secondary', attr='') => `<button type="button" class="btn ${kind}" data-action="${esc(act)}" ${attr}>${label}</button>`;
const icon = type => ({dashboard:'◫',clients:'♧',appointments:'▦',users:'♙'}[type]||'•');
function userTitle(){ return state.profile?.name || state.currentUser?.displayName || 'Equipe AMA FISIO'; }
function clearSubs(){ state.unsub.forEach(fn=>{try{fn();}catch{}});state.unsub=[]; }
const online = () => !state.demo && !!state.sdk;

// Lembretes no próprio site: derivados da agenda, sem push, e-mails ou serviço de mensagens.
// Cada usuário possui seu próprio histórico de leitura no Firestore.
const reminderChoices = [['none','Não lembrar'],['0','No dia do atendimento'],['1','1 dia antes'],['2','2 dias antes']];
function dayShift(date, amount){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))) return '';
  const [y,m,d]=date.split('-').map(Number);
  const mid=new Date(y,m-1,d,12);mid.setDate(mid.getDate()+amount);
  return `${mid.getFullYear()}-${String(mid.getMonth()+1).padStart(2,'0')}-${String(mid.getDate()).padStart(2,'0')}`;
}
function reminderVersion(a){return [a.id,a.clientId,a.date,a.time,a.reminderDays??'none'].join('|');}
function isActiveAppointment(a){return a.status==='scheduled'||a.status==='confirmed';}
function dueReminders(){
  const today=todayISO(), now=Date.now();
  return state.appointments.filter(a=>{
    if(!isActiveAppointment(a))return false;
    if(!['0','1','2'].includes(String(a.reminderDays??'none')))return false;
    const target=dayShift(a.date,-Number(a.reminderDays));
    const visitEnd=new Date(`${a.date}T${a.time||'00:00'}:00`).getTime()+Number(a.duration||50)*60000;
    return today>=target && today<=a.date && Number.isFinite(visitEnd) && now<visitEnd;
  }).sort(sortAppt);
}
function unreadReminders(){return dueReminders().filter(a=>state.reminderReads[a.id]!==reminderVersion(a));}
function todayAppointments(){return state.appointments.filter(a=>a.date===todayISO()&&a.status!=='cancelled').sort(sortAppt);}
function reminderLabel(a){return reminderChoices.find(([v])=>v===String(a.reminderDays??'none'))?.[1]||'Não lembrar';}
function notificationBell(){
  const count=unreadReminders().length;
  return `<div class="notification-wrapper" id="notification-wrapper"><button class="notification-bell ${state.notificationsOpen?'is-open':''}" type="button" data-action="toggle-notifications" aria-label="Notificações: ${count} lembrete${count===1?'':'s'} não lido${count===1?'':'s'}" aria-haspopup="dialog" aria-expanded="${state.notificationsOpen}">
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
    ${count?`<span class="notification-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button>${state.notificationsOpen?notificationPanel():''}</div>`;
}
function notificationPanel(){
  const unread=unreadReminders(),today=todayAppointments(),active=state.notificationTab;
  const items=active==='today'?today:unread;
  return `<section class="notification-popover" role="dialog" aria-label="Central de notificações">
    <div class="notification-heading"><div><div class="eyebrow">AMA FISIO</div><h3>Notificações</h3></div><button class="notification-close" type="button" data-action="close-notifications" aria-label="Fechar notificações">×</button></div>
    <div class="notification-tabs" role="group" aria-label="Visualizar notificações">
      <button type="button" class="${active==='reminders'?'active':''}" data-action="notification-reminders">Lembretes <span>${unread.length}</span></button>
      <button type="button" class="${active==='today'?'active':''}" data-action="notification-today">Hoje <span>${today.length}</span></button>
    </div>
    <div class="notification-list">${items.length?items.map(a=>`<article class="notification-item"><div class="notification-date">${esc(a.time)}<small>${formatDate(a.date)}</small></div><div class="notification-item-main"><strong>${esc(a.clientName||'Cliente cadastrado')}</strong><p>${active==='today'?'Agendamento de hoje':esc(reminderLabel(a))} · ${esc(a.type||'Atendimento')}</p><div class="notification-item-actions"><button type="button" data-action="open-reminder" data-id="${esc(a.id)}">Ver agendamento</button>${active==='reminders'?`<button type="button" data-action="read-reminder" data-id="${esc(a.id)}">Marcar como lido</button>`:''}</div></div></article>`).join(''):
    `<div class="notification-empty"><span aria-hidden="true">${active==='reminders'?'✓':'▦'}</span><strong>${active==='reminders'?'Nenhum lembrete pendente':'Nenhum atendimento para hoje'}</strong><p>${active==='reminders'?'Os avisos escolhidos nos agendamentos aparecerão aqui.':'A agenda do dia está livre.'}</p></div>`}</div>
    <div class="notification-footer">${active==='reminders' && unread.length?`<button type="button" data-action="read-all-reminders">Marcar todos como lidos</button>`:''}<button type="button" class="notification-primary" data-action="view-today-appointments">Ver agenda de hoje →</button></div>
  </section>`;
}
async function markRemindersRead(items){
  if(!items.length)return;
  if(state.demo){for(const a of items)state.reminderReads[a.id]=reminderVersion(a);render();return;}
  const s=state.sdk,userId=state.currentUser?.uid;
  if(!s||!userId)throw new Error('Faça login para marcar o lembrete como lido.');
  for(let pos=0;pos<items.length;pos+=300){
    const batch=s.writeBatch(s.db);
    for(const a of items.slice(pos,pos+300)){
      batch.set(s.doc(s.db,'users',userId,'reminderReads',a.id),{
        version:reminderVersion(a),readAt:s.serverTimestamp()
      });
    }
    await batch.commit();
  }
  for(const a of items)state.reminderReads[a.id]=reminderVersion(a);
  render();
}

function authScreen(){
return `<div class="login-shell">
  <section class="login-visual"><div class="brand"><img class="brand-img" src="${brand}" alt="Logo AMA FISIO"><div><div class="brand-txt">AMA FISIO</div><div class="brand-sub">Cuidar é acolher</div></div></div>
    <div class="hero"><img src="${brand}" class="hero-logo" alt="Símbolo de fisioterapia AMA FISIO"><div class="eyebrow">Gestão acolhedora e simples</div><h1>Cuidado em cada detalhe.</h1><p>Seus clientes e agendamentos organizados em um único lugar, com acesso exclusivo da administradora.</p></div>
    <div class="visual-footer">© ${new Date().getFullYear()} AMA FISIO · Acesso exclusivo</div></section>
  <section class="login-right"><div class="auth-panel"><div class="eyebrow">Área da administradora</div><h2>Bem-vinda de volta!</h2><p class="intro">Entre com seu nome de usuário e senha para acessar os cadastros e a agenda.</p>
    <form id="auth-form" class="form-stack">
      ${field('login','Login','','text','required autocomplete="username" placeholder="Amanda Marinho"')}
      ${field('password','Senha','','password','required minlength="8" autocomplete="current-password" placeholder="Digite sua senha"')}
      <div class="auth-actions"><span class="fine">🔒 Acesso protegido pelo Firebase, sem e-mail na tela</span></div>
      <button class="btn primary full" type="submit">Entrar no sistema →</button>
    </form>
    ${state.demo?`<div class="login-note"><strong>Demonstração ilustrativa.</strong> Nenhum dado real é salvo. <div style="margin-top:10px">${button('Explorar demonstração','start-demo','secondary')}</div></div>`:'<div class="login-note">Acesso reservado a Amanda Marinho. Nunca compartilhe sua senha.</div>'}
    </div></section>
</div>`; }

function sidebar(){return `<aside class="sidebar ${state.menuOpen?'open':''}">
  <div class="brand"><img class="brand-img" src="${brand}" alt="Logo AMA FISIO"><div><div class="brand-txt">AMA FISIO</div><div class="brand-sub">Gestão de clientes</div></div></div>
  <nav class="nav-group" aria-label="Navegação principal"><div class="nav-label">Menu principal</div>
    ${[['dashboard','Visão geral'],['clients','Clientes'],['appointments','Agendamentos']].map(([k,l])=>`<button class="nav-item ${state.view===k?'active':''}" type="button" data-action="nav-${k}" aria-current="${state.view===k?'page':'false'}"><span class="icon">${icon(k)}</span>${l}</button>`).join('')}
    <div class="nav-label" style="margin-top:22px">Acesso</div><button type="button" class="nav-item" data-action="logout"><span class="icon">⇥</span>Sair do sistema</button>
  </nav><div class="sidebar-footer"><div class="mini-user"><div class="avatar">${esc(initials(userTitle()))}</div><div><strong>${esc(userTitle())}</strong><span>${state.isMaster?'Administradora mestre':'Equipe cadastrada'}</span></div></div></div>
</aside>`;}
function appLayout(body){return `${state.demo?'<div class="demo-strip"><strong>Modo demonstração:</strong> registros fictícios em memória. Não utilize informações reais.</div>':''}<div class="app-shell">${sidebar()}<div class="mobile-shade ${state.menuOpen?'show':''}" data-action="close-menu"></div><div class="content-area"><header class="topbar"><div class="topbar-left"><button class="mobile-bar" aria-label="Abrir menu" data-action="menu">☰</button><div><div class="crumb">AMA FISIO / Painel</div><div class="topname">${{dashboard:'Visão geral',clients:'Clientes',appointments:'Agendamentos'}[state.view]}</div></div></div><div class="topbar-right"><span class="date">${esc(localNow())}</span>${notificationBell()}<span class="top-avatar">${esc(initials(userTitle()))}</span></div></header><main class="main">${body}<div class="small-footer">AMA FISIO · Cadastro de clientes e agendamentos · Acesso restrito</div></main></div></div>${state.modal?modalMarkup():''}`;}
function header(label,title,sub,actions=''){return `<div class="pagehead"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${sub}</p></div><div class="btn-row">${actions}</div></div>`;}
function stat(label,num,icon_,extra,kind=''){return `<div class="stat ${kind}"><div class="stat-top"><span>${label}</span><div class="stat-icon">${icon_}</div></div><strong>${num}</strong><small>${extra}</small></div>`;}
function dashboard(){const day=todayISO(),month=day.slice(0,7);const upcoming=state.appointments.filter(a=>a.date>=day&&!['completed','cancelled'].includes(a.status)).sort(sortAppt).slice(0,5);
  const newClients=[...state.clients].sort((a,b)=>formatCreated(b.createdAt)-formatCreated(a.createdAt)).slice(0,5);
  return `${header('Seu painel','Olá, '+esc(userTitle().split(' ')[0])+'! 👋','Acompanhe as informações principais da sua clínica.')}
  <div class="welcome"><div><h2>Um cuidado que faz a diferença.</h2><p>Mais organização, mais tranquilidade. Dedique seu tempo ao que realmente importa: as pessoas.</p></div>${button('+ Novo cliente','add-client','secondary')}</div>
  <div class="stats">${stat('Clientes cadastrados',state.clients.length,'♧','Total de registros')}${stat('Agendamentos de hoje',state.appointments.filter(a=>a.date===day&&a.status!=='cancelled').length,'▦','Consultas para hoje','pink')}${stat('Agendamentos no mês',state.appointments.filter(a=>a.date?.startsWith(month)&&a.status!=='cancelled').length,'◷','Neste mês','gold')}</div>
  <div class="panels"><div class="panel"><div class="panel-header"><h3>Clientes recentes</h3><button type="button" class="text-action" data-action="nav-clients">Ver todos →</button></div>${newClients.length?newClients.map(c=>`<div class="client-item"><div class="avatar">${esc(initials(c.name))}</div><div><div class="client-name">${esc(c.name)}</div><div class="client-sub">${esc(c.phone||'Contato não informado')}</div></div><span class="end">${pill(c.status)}</span></div>`).join(''):emptyMini('Nenhum cliente cadastrado por enquanto.')}</div>
  <div class="panel"><div class="panel-header"><h3>Próximos atendimentos</h3><button class="text-action" data-action="nav-appointments">Ver agenda →</button></div>${upcoming.length?upcoming.map(a=>`<div class="client-item"><div class="avatar" style="background:#fff0ef;color:#bd7b7c">${esc(a.time)}</div><div><div class="client-name">${esc(a.clientName)}</div><div class="client-sub">${formatDate(a.date)} · ${esc(a.type||'Atendimento')}</div></div><span class="end">${pill(a.status)}</span></div>`).join(''):emptyMini('Agenda livre nos próximos dias.')}</div></div>`;}
const emptyMini = x => `<div class="empty"><span class="empty-ico">♡</span>${esc(x)}</div>`;
function formatCreated(value){return value?.toMillis?.() || Date.parse(value)||0;}
function sortAppt(a,b){return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);}
function filterClients(){return state.clients.filter(c => (state.statusFilter==='all'||c.status===state.statusFilter) && [c.name,c.socialName,c.cpf,c.phone,c.guardianName].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(state.search.toLocaleLowerCase('pt-BR')))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
function clientsPage(){const filtered=filterClients();return `${header('Organização','Meus clientes','Consulte, cadastre e atualize as informações de cada pessoa.',`${state.isMaster?button('↓ Exportar CSV','export-clients','secondary'):''}${button('+ Novo cliente','add-client','primary')}`)}
<div class="toolbar"><div class="searchbox"><span>⌕</span><input id="client-search" aria-label="Pesquisar clientes" type="search" placeholder="Pesquisar nome, CPF, telefone ou responsável..." value="${esc(state.search)}"></div><select aria-label="Filtrar clientes" id="client-filter"><option value="all" ${state.statusFilter==='all'?'selected':''}>Todos os clientes</option><option value="active" ${state.statusFilter==='active'?'selected':''}>Ativos</option><option value="inactive" ${state.statusFilter==='inactive'?'selected':''}>Inativos</option></select></div>
<div class="data-panel"><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Responsável</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${filtered.map(c=>`<tr><td data-label="Cliente"><strong>${esc(c.name)}</strong><small>${c.birthDate?'Nascimento: '+formatDate(c.birthDate):'Cadastro AMA FISIO'}</small></td><td data-label="Telefone">${esc(c.phone||'—')}</td><td data-label="Responsável">${esc(c.guardianName||'—')}</td><td data-label="Situação">${pill(c.status)}</td><td data-label="Ações"><div class="table-actions"><button class="icon-btn" data-action="view-client" data-id="${esc(c.id)}">Ver</button><button class="icon-btn" data-action="edit-client" data-id="${esc(c.id)}">Editar</button><button class="icon-btn" data-action="schedule-client" data-id="${esc(c.id)}">Agendar</button></div></td></tr>`).join('')}</tbody></table>${!filtered.length?emptyMini(state.clients.length?'Nenhum cliente corresponde à pesquisa.':'Comece cadastrando seu primeiro cliente.'):''}</div><div class="pagination-note">${filtered.length} cliente(s) encontrado(s) · As informações são compartilhadas com a equipe autorizada.</div></div>`;}
function appointmentPage(){const list=state.appointments.filter(a=>(state.appointmentFilter==='all'||a.status===state.appointmentFilter) && (state.appointmentDayFilter!=='today'||a.date===todayISO())).sort(sortAppt);
return `${header('Planejamento','Agendamentos','Consulte os horários e escolha quando receber lembretes dentro do AMA FISIO.',button('+ Novo agendamento','add-appointment','primary'))}
<div class="toolbar"><div class="calendar-top"><div class="date-filter" role="group" aria-label="Filtrar por data"><button type="button" data-action="day-all" class="${state.appointmentDayFilter==='all'?'active':''}">Todos os dias</button><button type="button" data-action="day-today" class="${state.appointmentDayFilter==='today'?'active':''}">Hoje</button></div><span class="eyebrow" style="margin-right:8px">Filtrar por situação</span><select id="appointment-filter" aria-label="Filtrar agendamentos">${[['all','Todos'],['scheduled','Agendados'],['confirmed','Confirmados'],['completed','Concluídos'],['cancelled','Cancelados']].map(([k,t])=>`<option value="${k}" ${k===state.appointmentFilter?'selected':''}>${t}</option>`).join('')}</select></div></div>
<div class="data-panel"><div class="table-wrap"><table><thead><tr><th>Data e horário</th><th>Cliente</th><th>Atendimento</th><th>Profissional</th><th>Situação</th><th>Lembrete</th><th>Ações</th></tr></thead><tbody>${list.map(a=>`<tr><td data-label="Data e horário"><strong>${formatDate(a.date)}</strong><small>${esc(a.time)} · ${esc(a.duration||50)} min</small></td><td data-label="Cliente"><strong>${esc(a.clientName)}</strong></td><td data-label="Atendimento">${esc(a.type||'Fisioterapia')}</td><td data-label="Profissional">${esc(a.professional||'—')}</td><td data-label="Situação">${pill(a.status)}</td><td data-label="Lembrete">${esc(reminderLabel(a))}</td><td data-label="Ações"><button class="icon-btn" data-action="edit-appointment" data-id="${esc(a.id)}">Editar</button></td></tr>`).join('')}</tbody></table>${!list.length?emptyMini('Nenhum agendamento disponível.'):''}</div><div class="pagination-note">${list.length} agendamento(s) exibido(s).</div></div>`;}
function render(){if(state.mode==='loading'){root.innerHTML='<div class="boot"><div class="spinner"></div><span>Carregando o painel...</span></div>';return;}
if(state.mode==='auth'){root.innerHTML=authScreen();return;}
if(state.mode==='blocked'){root.innerHTML=`<div class="unauth"><div class="message-box"><img src="${brand}" alt="Logo AMA FISIO"><h2>Acesso não autorizado</h2><p>Somente a conta mestre da Amanda pode acessar este sistema.</p>${button('Sair da conta','logout','primary')}</div></div>`;return;}
if(state.mode==='error'){root.innerHTML=`<div class="unauth"><div class="message-box"><h2>Configuração necessária</h2><p>Não foi possível conectar ao Firebase. Confira o arquivo <code>config.js</code>, o Firestore, as regras e a internet.</p>${button('Tentar novamente','reload','primary')}</div></div>`;return;}
const page={dashboard,clients:clientsPage,appointments:appointmentPage}[state.view]||dashboard;root.innerHTML=appLayout(page());}

function modalMarkup(){if(state.modal==='client'||state.modal==='edit-client'){const c=state.editId?getClient(state.editId):{};if(!c)return '';const isEdit=!!state.editId;return modalFrame(isEdit?'Editar cliente':'Novo cliente','Preencha os dados de cadastro. Campos com * são obrigatórios.',`<form id="client-form"><div class="field-grid">
<div class="section-tag">Identificação</div>
${field('name','Nome completo *',c.name,'text','required minlength="2" maxlength="180"')}
${field('socialName','Nome social / como prefere ser chamado',c.socialName)}
${field('birthDate','Data de nascimento',c.birthDate,'date')}
${field('cpf','CPF',c.cpf,'text','inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')}
${selectField('gender','Gênero',c.gender||'', [['','Não informado'],['Feminino','Feminino'],['Masculino','Masculino'],['Outro','Outro'],['Prefere não informar','Prefere não informar']])}
${selectField('status','Situação',c.status||'active',[['active','Ativo'],['inactive','Inativo']])}
<div class="section-tag">Contato e endereço</div>
${field('phone','Celular',c.phone,'tel','maxlength="30" placeholder="(81) 99999-9999"')}
${field('email','E-mail',c.email,'email')}
${field('address','Rua e número',c.address)}${field('neighborhood','Bairro',c.neighborhood)}
${field('city','Cidade',c.city)}${field('state','UF',c.state,'text','maxlength="2" placeholder="PE"')}
${field('zip','CEP',c.zip,'text','maxlength="9"')}
<div class="section-tag">Responsável e contatos de apoio</div>
${field('guardianName','Nome do responsável legal',c.guardianName)}${field('guardianRelation','Parentesco / vínculo',c.guardianRelation)}
${field('guardianPhone','Telefone do responsável',c.guardianPhone,'tel')}${field('emergencyName','Contato de emergência',c.emergencyName)}
${field('emergencyPhone','Telefone de emergência',c.emergencyPhone,'tel')}
<div class="section-tag">Dados de atendimento <span class="muted" style="font-weight:500">(opcional e sensível)</span></div>
${field('insurance','Convênio / particular',c.insurance)}${field('professional','Profissional responsável',c.professional)}
${field('source','Como conheceu a clínica',c.source)}
${textareaField('chiefComplaint','Motivo do atendimento / queixa principal',c.chiefComplaint)}
${textareaField('notes','Observações internas (mínimo necessário)',c.notes)}
<div class="wide"><label class="check-row"><input name="privacyAcknowledged" type="checkbox" ${c.privacyAcknowledged?'checked':''} required><span>Confirmo que a clínica possui uma base legal adequada e informou a pessoa ou responsável sobre a finalidade deste cadastro e o tratamento de dados pessoais, incluindo dados de saúde quando preenchidos. *</span></label><div class="fine">O sistema não substitui a política de privacidade, o registro da base legal ou outras obrigações da LGPD.</div></div>
</div><div class="modal-actions">${isEdit&&state.isMaster?button('Excluir cliente','delete-client','danger',`data-id="${esc(c.id)}"`):''}<button type="button" class="btn secondary" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">${isEdit?'Salvar alterações':'Cadastrar cliente'}</button></div></form>`);}
if(state.modal==='appointment'||state.modal==='edit-appointment'){const a=state.editId?state.appointments.find(x=>x.id===state.editId):{};if(!a)return '';const pre=state.preselectedClient||'';return modalFrame(state.editId?'Editar agendamento':'Novo agendamento','Defina o cliente, o horário e a situação do atendimento.',`<form id="appointment-form"><div class="field-grid">
${selectField('clientId','Cliente *',a.clientId||pre,[['','Selecione um cliente'],...state.clients.filter(c=>c.status==='active'||c.id===a.clientId).sort((x,y)=>x.name.localeCompare(y.name,'pt-BR')).map(c=>[c.id,c.name])])}
${field('date','Data *',a.date||todayISO(),'date','required')}
${field('time','Horário *',a.time||'09:00','time','required')}
${selectField('duration','Duração',String(a.duration||50),[['30','30 minutos'],['40','40 minutos'],['50','50 minutos'],['60','60 minutos'],['90','90 minutos']])}
${selectField('type','Atendimento',a.type||'Fisioterapia',[['Fisioterapia','Fisioterapia'],['Avaliação','Avaliação'],['Retorno','Retorno'],['Outro','Outro']])}
${field('professional','Profissional',a.professional||'')}
${selectField('status','Situação',a.status||'scheduled',[['scheduled','Agendado'],['confirmed','Confirmado'],['completed','Concluído'],['cancelled','Cancelado']])}
  ${textareaField('notes','Observações do agendamento',a.notes)}
  <div class="reminder-notice wide"><div class="reminder-notice-heading"><span aria-hidden="true">🔔</span><div><strong>Lembrete dentro do site</strong><p>Escolha quando o sininho do AMA FISIO mostrará este atendimento. O aviso será visto somente no site, depois de entrar na conta.</p></div></div>
    ${selectField('reminderDays','Quando deseja lembrar?',String(a.reminderDays??'none'),reminderChoices)}
    <p class="fine">Não envia mensagens ao cliente e não mostra notificações com o site fechado. Cada pessoa da equipe pode marcar seus avisos como lidos separadamente.</p>
  </div>
  </div><div class="modal-actions">${state.editId&&state.isMaster?button('Excluir agendamento','delete-appointment','danger',`data-id="${esc(a.id)}"`):''}<button class="btn secondary" type="button" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">Salvar agendamento</button></div></form>`,'slim');}
if(state.modal==='view-client'){const c=getClient(state.editId);if(!c)return '';const values=[['Nome completo',c.name],['Nome social',c.socialName],['Nascimento',formatDate(c.birthDate)],['CPF',c.cpf],['Celular',c.phone],['E-mail',c.email],['Situação',niceStatus[c.status]],['Endereço',[c.address,c.neighborhood,c.city,c.state,c.zip].filter(Boolean).join(', ')],['Responsável legal',c.guardianName],['Parentesco',c.guardianRelation],['Contato do responsável',c.guardianPhone],['Contato de emergência',c.emergencyName],['Telefone de emergência',c.emergencyPhone],['Convênio',c.insurance],['Profissional',c.professional],['Origem',c.source],['Queixa principal',c.chiefComplaint],['Observações',c.notes]];
return modalFrame('Ficha de cadastro','Dados internos do cliente. Acesso apenas para usuários autorizados.',`<dl class="details">${values.filter(([k,v])=>v&&v!=='—').map(([k,v])=>`<div class="${['Queixa principal','Observações','Endereço'].includes(k)?'wide':''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="modal-actions"><button class="btn secondary" data-action="schedule-client" data-id="${esc(c.id)}">Agendar</button><button class="btn primary" data-action="edit-client" data-id="${esc(c.id)}">Editar cadastro</button></div>`);}
return '';}
function modalFrame(title,subtitle,inside,cls=''){return `<div class="modal-backdrop" id="modal-backdrop" data-action="backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><div class="eyebrow">AMA FISIO</div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="close" data-action="close-modal" aria-label="Fechar">×</button></div><div class="modal-body">${inside}</div></section></div>`;}
function setModal(type,id=null){state.modal=type;state.editId=id;render();setTimeout(()=>root.querySelector('.modal input:not([type=checkbox]),.modal select')?.focus(),30);}
function closeModal(){state.modal='';state.editId=null;state.preselectedClient='';render();}
function go(view){state.view=view;state.notificationsOpen=false;state.menuOpen=false;state.search='';state.statusFilter='all';render();window.scrollTo({top:0,behavior:'smooth'});}
const docData = f=>Object.fromEntries([...f.entries()].filter(([name])=>name!=='confirm').map(([key,val])=>[key,String(val).trim()]));
const maybeStamp = () => state.demo?new Date().toISOString():state.sdk.serverTimestamp();
const who = () => state.currentUser?.uid||'demo';
function demoSeed(){return {clients:[
  {id:'demo-1',name:'Mariana Oliveira',email:'mariana@exemplo.com',phone:'(81) 99999-0001',guardianName:'',status:'active',createdAt:'2026-10-10T10:00:00Z',privacyAcknowledged:true,chiefComplaint:''},
  {id:'demo-2',name:'Pedro Henrique',email:'pedro@exemplo.com',phone:'(81) 99999-0002',guardianName:'Ana Paula',status:'active',createdAt:'2026-10-09T10:00:00Z',privacyAcknowledged:true},
  {id:'demo-3',name:'Laura Mendes',phone:'(81) 99999-0003',guardianName:'',status:'inactive',createdAt:'2026-10-05T10:00:00Z',privacyAcknowledged:true}],
  appointments:[{id:'apt-1',clientId:'demo-1',clientName:'Mariana Oliveira',date:todayISO(),time:'23:00',duration:50,type:'Avaliação',professional:'Amanda',status:'confirmed',reminderDays:'0'}, {id:'apt-2',clientId:'demo-2',clientName:'Pedro Henrique',date:dayShift(todayISO(),1),time:'14:00',duration:50,type:'Fisioterapia',professional:'Amanda',status:'scheduled',reminderDays:'1'}],
  users:[{id:'demo-master',name:'Amanda Marinho',role:'master',status:'active'}]};}
function startDemo(){const sample=demoSeed();state.clients=sample.clients;state.appointments=sample.appointments;state.users=sample.users;state.profile={name:'Amanda Marinho',role:'master',status:'active'};state.currentUser={uid:'demo-master'};state.isMaster=true;state.reminderReads={};state.mode='app';state.view='dashboard';render();}
async function loginOrRegister(form){
  if(state.demo){toast('A demonstração usa somente dados fictícios.',true);return;}
  const fd=new FormData(form);
  const login=String(fd.get('login')||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  const expected=String(config.masterUsername||'Amanda Marinho').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  const password=String(fd.get('password')||'');
  // O identificador técnico não é um e-mail pessoal nem recebe mensagens.
  // A senha NUNCA é comparada com um valor fixo neste código: é validada pelo Firebase.
  if(login!==expected||!password){toast('Usuário ou senha incorretos.',true);return;}
  if(!config.masterUid||config.masterUid==='COLE_UID_AMANDA_AQUI'){
    toast('A configuração inicial ainda não foi concluída. Execute o instalador da conta mestre.',true);return;
  }
  await state.sdk.signInWithEmailAndPassword(state.sdk.auth,String(config.internalAuthId),password);
}
async function updateIdentity(user){
  clearSubs();stopDataSubscriptions();state.currentUser=user;
  if(!user){state.isMaster=false;state.profile=null;state.notificationsOpen=false;state.mode='auth';render();return;}
  const expectedUid=String(config.masterUid||'');
  if(!expectedUid||expectedUid==='COLE_UID_AMANDA_AQUI'||user.uid!==expectedUid){
    state.profile=null;state.isMaster=false;state.mode='blocked';render();
    await state.sdk.signOut(state.sdk.auth);
    return;
  }
  state.isMaster=true;
  state.profile={name:'Amanda Marinho',role:'master',status:'active'};
  state.mode='app';startDataSubscriptions();render();
}

let dataUnsubs=[];
function stopDataSubscriptions(){dataUnsubs.forEach(f=>f());dataUnsubs=[];state.clients=[];state.appointments=[];state.users=[];state.reminderReads={};}
function startDataSubscriptions(){if(dataUnsubs.length||!state.sdk)return;const s=state.sdk;
  const subscribe=(collectionName,key)=>{const un=s.onSnapshot(s.collection(s.db,collectionName),snapshot=>{state[key]=snapshot.docs.map(d=>({id:d.id,...d.data()}));if(state.mode==='app')render();},e=>{console.error(e);toast(firebaseMessage(e),true);});dataUnsubs.push(un);};
  subscribe('clients','clients');subscribe('appointments','appointments');
  const readUnsub=s.onSnapshot(s.collection(s.db,'users',state.currentUser.uid,'reminderReads'),snapshot=>{
    state.reminderReads=Object.fromEntries(snapshot.docs.map(d=>[d.id,d.data().version]));
    if(state.mode==='app')render();
  },e=>{console.error(e);toast(firebaseMessage(e),true);});
  dataUnsubs.push(readUnsub);
}
async function saveRecord(type,data,id){if(state.demo){let array=type==='clients'?state.clients:state.appointments;if(id){const idx=array.findIndex(r=>r.id===id);if(idx>=0)array[idx]={...array[idx],...data};return id;}const demoId=`demo-${Date.now()}`;array.unshift({id:demoId,...data});return demoId;}
  const s=state.sdk,collectionName=type;
  if(id){await s.updateDoc(s.doc(s.db,collectionName,id),{...data,updatedAt:maybeStamp(),updatedBy:who()});return id;}
  const saved=await s.addDoc(s.collection(s.db,collectionName),{...data,createdAt:maybeStamp(),createdBy:who(),updatedAt:maybeStamp(),updatedBy:who()});
  return saved.id;
}
async function deleteRecord(type,id){if(state.demo){const key=type==='clients'?'clients':'appointments';state[key]=state[key].filter(x=>x.id!==id);return;}const s=state.sdk;await s.deleteDoc(s.doc(s.db,type,id));}
async function submitClient(form){const f=new FormData(form),data=docData(f);data.status=data.status||'active';data.privacyAcknowledged=f.has('privacyAcknowledged');
if(!data.privacyAcknowledged){toast('Confirme a informação sobre tratamento de dados pessoais.',true);return;}
if(data.cpf&&digits(data.cpf).length!==11){toast('O CPF deve conter 11 dígitos.',true);return;}
if(data.cpf&&!validCpf(digits(data.cpf))){toast('O CPF informado é inválido.',true);return;}
if(data.birthDate&&data.birthDate>todayISO()){toast('A data de nascimento não pode estar no futuro.',true);return;}
const was=state.editId?getClient(state.editId):null;data.privacyAcknowledgedAt=was?.privacyAcknowledgedAt||maybeStamp();
if(state.demo){data.createdAt=was?.createdAt||maybeStamp();}
const oldId=state.editId;await saveRecord('clients',data,oldId);closeModal();toast(oldId?'Cadastro atualizado com sucesso.':'Cliente cadastrado com sucesso!');}
function validCpf(cpf){if(!/^\d{11}$/.test(cpf)||/^(\d)\1+$/.test(cpf))return false;let sum=0;for(let i=0;i<9;i++)sum+=Number(cpf[i])*(10-i);let digit=(sum*10)%11;if(digit===10)digit=0;if(digit!==Number(cpf[9]))return false;sum=0;for(let i=0;i<10;i++)sum+=Number(cpf[i])*(11-i);digit=(sum*10)%11;if(digit===10)digit=0;return digit===Number(cpf[10]);}
async function submitAppointment(form){const input=new FormData(form),data=docData(input);const client=getClient(data.clientId);
if(!client){toast('Selecione um cliente cadastrado.',true);return;}
if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!/^\d\d:\d\d$/.test(data.time)){toast('Informe uma data e um horário válidos.',true);return;}
if(data.date<todayISO()&&['scheduled','confirmed'].includes(data.status)){toast('O agendamento informado está em data passada.',true);return;}
const start=new Date(`${data.date}T${data.time}:00`).getTime(),end=start+Number(data.duration)*60_000;
const collision=state.appointments.find(a=>a.id!==state.editId&&a.date===data.date&&a.status!=='cancelled'&&a.status!=='completed'&&(a.professional||'').trim().toLowerCase()===(data.professional||'').trim().toLowerCase()&&start<new Date(`${a.date}T${a.time}:00`).getTime()+Number(a.duration||50)*60_000&&end>new Date(`${a.date}T${a.time}:00`).getTime());
if(collision&&!window.confirm(`Atenção: há outro agendamento nesse horário para o mesmo profissional (${collision.clientName}, ${collision.time}). Deseja continuar?`))return;
data.clientName=client.name;data.duration=Number(data.duration)||50;
if(!['none','0','1','2'].includes(data.reminderDays)){toast('Escolha um lembrete válido.',true);return;}
const oldId=state.editId;
await saveRecord('appointments',data,oldId);
closeModal();
toast(oldId?'Agendamento atualizado. Lembrete configurado.':'Agendamento realizado! Lembrete configurado.');
}
function exportClients(){if(!state.isMaster)return;const heads=['Nome','Nascimento','CPF','Telefone','Email','Responsável','Telefone responsável','Situação','Bairro','Cidade','Profissional'];const rows=state.clients.map(c=>[c.name,c.birthDate,c.cpf,c.phone,c.email,c.guardianName,c.guardianPhone,niceStatus[c.status],c.neighborhood,c.city,c.professional]);const safeCell=x=>{let s=String(x??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const content='\uFEFF'+[heads,...rows].map(row=>row.map(safeCell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`AMA-FISIO-clientes-${todayISO()}.csv`;a.click();URL.revokeObjectURL(url);toast('Arquivo CSV gerado. Guarde-o em local seguro.');}

async function handleAction(action,el){const id=el?.dataset?.id;
switch(action){

case 'start-demo':startDemo();break;
case 'logout':clearSubs();stopDataSubscriptions();if(online())await state.sdk.signOut(state.sdk.auth);state.profile=null;state.currentUser=null;state.isMaster=false;state.mode='auth';state.view='dashboard';state.menuOpen=false;state.notificationsOpen=false;render();break;
case 'toggle-notifications':state.notificationsOpen=!state.notificationsOpen;state.notificationTab='reminders';render();break;
case 'close-notifications':state.notificationsOpen=false;render();break;
case 'notification-reminders':state.notificationTab='reminders';render();break;
case 'notification-today':state.notificationTab='today';render();break;
case 'read-reminder':{const a=unreadReminders().find(x=>x.id===id);if(a)await markRemindersRead([a]);break;}
case 'read-all-reminders':await markRemindersRead(unreadReminders());break;
case 'open-reminder':if(state.appointments.some(a=>a.id===id)){state.notificationsOpen=false;setModal('edit-appointment',id);}break;
case 'view-today-appointments':state.appointmentDayFilter='today';state.appointmentFilter='all';go('appointments');break;
case 'day-all':state.appointmentDayFilter='all';render();break;
case 'day-today':state.appointmentDayFilter='today';render();break;
case 'menu':state.menuOpen=true;render();break;case 'close-menu':state.menuOpen=false;render();break;
case 'nav-dashboard':go('dashboard');break;case 'nav-clients':go('clients');break;case 'nav-appointments':go('appointments');break;
case 'add-client':setModal('client');break;case 'edit-client':setModal('edit-client',id);break;case 'view-client':setModal('view-client',id);break;
case 'add-appointment':if(!state.clients.some(c=>c.status==='active')){toast('Cadastre primeiro um cliente ativo.',true);return;}state.preselectedClient='';setModal('appointment');break;
case 'schedule-client':state.preselectedClient=id;setModal('appointment');break;case 'edit-appointment':setModal('edit-appointment',id);break;
case 'close-modal':closeModal();break;case 'backdrop':if(el?.id==='modal-backdrop')closeModal();break;
case 'delete-client':{if(!state.isMaster)return;if(state.appointments.some(a=>a.clientId===id)){toast('Há agendamentos vinculados. Remova ou atualize esses agendamentos antes da exclusão.',true);return;}if(!confirm('Excluir permanentemente o cadastro deste cliente? Esta ação não pode ser desfeita.'))return;await deleteRecord('clients',id);closeModal();toast('Cliente excluído.');break;}
case 'delete-appointment':if(!state.isMaster)return;if(!confirm('Excluir permanentemente este agendamento?'))return;await deleteRecord('appointments',id);closeModal();toast('Agendamento excluído.');break;
case 'export-clients':if(confirm('O CSV contém dados pessoais. Deseja exportar os cadastros?'))exportClients();break;
case 'reload':window.location.reload();break;
}}
root.addEventListener('click', async e => {const el=e.target.closest('[data-action]');if(!el)return;if(el.dataset.action==='backdrop'&&el!==e.target)return;
try{await handleAction(el.dataset.action,el);}catch(err){console.error(err);toast(firebaseMessage(err),true);} });
root.addEventListener('submit',async e=>{if(!['auth-form','client-form','appointment-form'].includes(e.target.id))return;e.preventDefault();const submit=e.target.querySelector('button[type="submit"]');if(submit?.disabled)return;try{if(submit)submit.disabled=true;if(e.target.id==='auth-form')await loginOrRegister(e.target);if(e.target.id==='client-form')await submitClient(e.target);if(e.target.id==='appointment-form')await submitAppointment(e.target);}catch(err){console.error(err);toast(firebaseMessage(err),true);}finally{if(submit?.isConnected)submit.disabled=false;}});
root.addEventListener('input',e=>{if(e.target.id==='client-search'){state.search=e.target.value;const p=e.target.selectionStart;render();const search=root.querySelector('#client-search');if(search){search.focus();search.setSelectionRange(p,p);}}});
root.addEventListener('change',e=>{if(e.target.id==='client-filter'){state.statusFilter=e.target.value;render();}if(e.target.id==='appointment-filter'){state.appointmentFilter=e.target.value;render();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.modal)closeModal();else if(state.notificationsOpen){state.notificationsOpen=false;render();}}});
document.addEventListener('click',e=>{if(state.notificationsOpen&&!e.target.closest('#notification-wrapper')){state.notificationsOpen=false;render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.mode==='app'&&!state.modal)render();});
setInterval(()=>{if(state.mode==='app'&&!state.modal&&!document.hidden)render();},60000);

async function boot(){const firebase=config.firebase||{},configured=Boolean(firebase.apiKey&&!firebase.apiKey.includes('COLE_')&&firebase.projectId&&!firebase.projectId.includes('SEU-PROJETO')&&firebase.appId&&!firebase.appId.includes('COLE_'));
  state.demo=!configured&&config.demoEnabled===true;
  if(!configured){state.mode=state.demo?'auth':'error';render();return;}
  try {
    const version='11.10.0';
    const [core,authentication,firestore]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);
    const firebaseApp=core.initializeApp(firebase),auth=authentication.getAuth(firebaseApp),db=firestore.getFirestore(firebaseApp);
    state.sdk={auth,db,...authentication,...firestore};
    authentication.onAuthStateChanged(auth,async user=>{try{await updateIdentity(user);}catch(e){console.error(e);toast(firebaseMessage(e),true);}},e=>{console.error(e);state.mode='error';render();});
  }catch(err){console.error(err);state.mode='error';render();}
}
boot();
