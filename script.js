const nav=document.querySelector('nav'),menu=document.querySelector('.menu-btn'),pages=[...document.querySelectorAll('.page')],links=[...document.querySelectorAll('[data-page]')],loader=document.querySelector('.page-loader');
function route(){return(location.hash||'#accueil').slice(1).split('?')[0]}
function showPage(r,push=true){const target=document.querySelector(`[data-route="${r}"]`)||document.querySelector('[data-route="accueil"]');pages.forEach(p=>p.classList.toggle('active',p===target));document.querySelectorAll('nav a[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===r));if(push&&location.hash!=='#'+r)history.pushState({},'', '#'+r);nav?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});document.title=r==='accueil'?'L&A — Délégation 2026':`${r[0].toUpperCase()+r.slice(1)} · L&A`;setTimeout(observeReveals,100)}
links.forEach(l=>l.addEventListener('click',e=>{if(l.dataset.page){e.preventDefault();showPage(l.dataset.page)}}));window.addEventListener('popstate',()=>showPage(route(),false));window.addEventListener('hashchange',()=>showPage(route(),false));menu?.addEventListener('click',()=>nav.classList.toggle('open'));window.addEventListener('pointermove',e=>{const g=document.querySelector('.cursor-glow');if(g){g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'}});
function observeReveals(){document.querySelectorAll('.reveal').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<window.innerHeight*.92)el.classList.add('visible')})}window.addEventListener('scroll',observeReveals);
document.querySelectorAll('.tilt').forEach(card=>{card.addEventListener('pointermove',e=>{if(innerWidth<800)return;const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*5,y=((e.clientY-r.top)/r.height-.5)*-5;card.style.transform=`perspective(1000px) rotateX(${y}deg) rotateY(${x}deg) translateY(-5px)`});card.addEventListener('pointerleave',()=>card.style.transform='')});
document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('details').forEach(o=>{if(o!==d)o.open=false})}));
setTimeout(()=>{loader?.classList.add('hidden');if(loader){loader.style.opacity='0';loader.style.pointerEvents='none'}},700);showPage(route(),false);setTimeout(observeReveals,800);

const API='/api';
function setResult(el,msg,type=''){if(!el)return;el.textContent=msg;el.className='form-result '+type}
async function api(path,options={}){const r=await fetch(API+path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Une erreur est survenue.');return data}

const ideaForm=document.getElementById('ideaForm'),ideaText=document.getElementById('ideaText'),ideaCategory=document.getElementById('ideaCategory'),ideaCount=document.getElementById('ideaCount'),ideasList=document.getElementById('ideasList'),ideaStatus=document.getElementById('ideaStatus'),ideaResult=document.getElementById('ideaResult');
ideaText?.addEventListener('input',()=>{ideaCount.textContent=`${ideaText.value.length} / 700`});
ideaForm?.addEventListener('submit',async e=>{e.preventDefault();const text=ideaText.value.trim();if(!text)return;const btn=ideaForm.querySelector('button');const old=btn.innerHTML;btn.disabled=true;setResult(ideaResult,'Envoi en cours…');try{const data=await api('/ideas',{method:'POST',body:JSON.stringify({category:ideaCategory.value,text})});setResult(ideaResult,`Idée reçue ✓ Référence : ${data.id}`,'success');ideaForm.reset();ideaCount.textContent='0 / 700';ideaStatus.textContent='Service en ligne · idée reçue';loadRecentIdeas();}catch(err){setResult(ideaResult,err.message,'error')}finally{btn.disabled=false;btn.innerHTML=old}});
async function loadRecentIdeas(){if(!ideasList)return;try{const health=await api('/health');ideaStatus.textContent=health.online?'Service en ligne · prêt':'Service indisponible';ideasList.innerHTML='<div class="empty-ideas">Les idées sont enregistrées côté serveur. Leur contenu reste réservé à la délégation.</div>'}catch{ideaStatus.textContent='Service momentanément indisponible';ideasList.innerHTML='<div class="empty-ideas">Impossible de joindre le service pour le moment.</div>'}}
loadRecentIdeas();

const trackingForm=document.getElementById('trackingForm'),trackingRef=document.getElementById('trackingRef'),trackingResult=document.getElementById('trackingResult');
trackingForm?.addEventListener('submit',async e=>{e.preventDefault();const id=trackingRef.value.trim().toUpperCase();trackingResult.textContent='Recherche…';try{const d=await api('/requests/'+encodeURIComponent(id));const r=d.request;trackingResult.innerHTML=`<strong>${r.status}</strong><br>Référence ${r.id} · ${r.category}<br><span>Dernière mise à jour : ${new Date(r.updatedAt).toLocaleDateString('fr-BE')}</span>${r.response?`<br><br>${escapeHtml(r.response)}`:''}`}catch(err){trackingResult.textContent=err.message}});
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}

async function bindMessageForm(form,anonymous){form?.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('button'),result=form.querySelector('.form-result');const data=Object.fromEntries(new FormData(form).entries());data.anonymous=anonymous;btn.disabled=true;setResult(result,'Envoi en cours…');try{await api('/contact',{method:'POST',body:JSON.stringify(data)});setResult(result,'Message reçu ✓','success');form.reset()}catch(err){setResult(result,err.message,'error')}finally{btn.disabled=false}})}
bindMessageForm(document.getElementById('anonymousForm'),true);bindMessageForm(document.getElementById('identifiedForm'),false);


/* ===== ESPACE PRIVÉ DES DÉLÉGUÉS ===== */
const adminLogin=document.getElementById('adminLogin'),adminPanel=document.getElementById('adminPanel');
const adminLoginForm=document.getElementById('adminLoginForm'),adminToken=document.getElementById('adminToken');
const adminLoginResult=document.getElementById('adminLoginResult');
async function adminApi(path,options={}){
  const r=await fetch(API+path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'Erreur administrateur.');
  return d;
}
function adminEscape(v){return escapeHtml(v??'')}
function adminDate(v){try{return new Date(v).toLocaleString('fr-BE',{dateStyle:'short',timeStyle:'short'})}catch{return ''}}
function statusOptions(current){
  return ['NOUVELLE','EN ÉTUDE','TRANSMISE','RÉPONSE OBTENUE'].map(s=>`<option ${s===current?'selected':''}>${s}</option>`).join('');
}
function renderAdmin(data){
  const s=data.stats||{};
  const stats=[
    ['TOTAL IDÉES',s.totalIdeas||0],['NOUVELLES',s.newIdeas||0],
    ['EN ÉTUDE',s.inStudy||0],['TRANSMISES',s.transmitted||0],['RÉPONSES',s.answered||0]
  ];
  document.getElementById('adminStats').innerHTML=stats.map(x=>`<div class="admin-stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  document.getElementById('adminIdeaCount').textContent=`${data.ideas.length} idée(s)`;
  document.getElementById('adminMessageCount').textContent=`${data.contacts.length} message(s)`;

  const ideas=document.getElementById('adminIdeas');
  ideas.innerHTML=data.ideas.length?data.ideas.map(i=>`
    <article class="admin-item">
      <div class="admin-item-head"><span class="admin-item-id">${adminEscape(i.id)}</span><span class="admin-item-date">${adminDate(i.createdAt)}</span></div>
      <div class="admin-meta"><span>${adminEscape(i.category)}</span><span>${adminEscape(i.status)}</span></div>
      <p>${adminEscape(i.text)}</p>
      <div class="admin-controls">
        <select data-status="${adminEscape(i.id)}">${statusOptions(i.status)}</select>
        <textarea data-response="${adminEscape(i.id)}" placeholder="Réponse / note interne…">${adminEscape(i.response||'')}</textarea>
        <div class="admin-control-row">
          <button onclick="adminUpdateIdea('${adminEscape(i.id)}')">Enregistrer</button>
          <button class="delete" onclick="adminDeleteIdea('${adminEscape(i.id)}')">Supprimer</button>
        </div>
      </div>
    </article>`).join(''):'<div class="admin-empty">Aucune idée reçue pour le moment.</div>';

  const messages=document.getElementById('adminMessages');
  messages.innerHTML=data.contacts.length?data.contacts.map(m=>`
    <article class="admin-item">
      <div class="admin-item-head"><span class="admin-item-id">${m.anonymous?'ANONYME':'IDENTIFIÉ'}</span><span class="admin-item-date">${adminDate(m.createdAt)}</span></div>
      <div class="admin-meta"><span>${adminEscape(m.category||'Sans catégorie')}</span>${m.email?`<span>${adminEscape(m.email)}</span>`:''}</div>
      <h4>${adminEscape(m.subject||'Message sans objet')}</h4>
      <p>${adminEscape(m.message)}</p>
      ${m.name?`<small>${adminEscape(m.name)}</small>`:''}
    </article>`).join(''):'<div class="admin-empty">Aucun message reçu pour le moment.</div>';
}
async function adminLoad(){
  try{
    const d=await adminApi('/admin/data');
    adminLogin.hidden=true; adminPanel.hidden=false; renderAdmin(d);
  }catch{
    adminLogin.hidden=false; adminPanel.hidden=true;
  }
}
adminLoginForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  const token=adminToken.value.trim();
  if(!token)return;
  setResult(adminLoginResult,'Connexion…');
  try{
    await adminApi('/admin/login',{method:'POST',body:JSON.stringify({token})});
    adminToken.value='';
    setResult(adminLoginResult,'Connexion réussie ✓','success');
    await adminLoad();
  }catch(err){setResult(adminLoginResult,err.message,'error')}
});
document.getElementById('adminRefresh')?.addEventListener('click',adminLoad);
document.getElementById('adminLogout')?.addEventListener('click',async()=>{
  await adminApi('/admin/logout',{method:'POST'}).catch(()=>{});
  adminPanel.hidden=true; adminLogin.hidden=false;
});
window.adminUpdateIdea=async function(id){
  const status=document.querySelector(`[data-status="${CSS.escape(id)}"]`)?.value;
  const response=document.querySelector(`[data-response="${CSS.escape(id)}"]`)?.value||'';
  try{await adminApi('/admin/ideas/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status,response})});await adminLoad()}
  catch(e){alert(e.message)}
};
window.adminDeleteIdea=async function(id){
  if(!confirm('Supprimer définitivement cette idée ?'))return;
  try{await adminApi('/admin/ideas/'+encodeURIComponent(id),{method:'DELETE'});await adminLoad()}
  catch(e){alert(e.message)}
};
const originalShowPage=showPage;
showPage=function(r,push=true){
  originalShowPage(r,push);
  if(r==='admin') adminLoad();
};
