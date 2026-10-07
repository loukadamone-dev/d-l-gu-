const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const IDEAS = path.join(DATA, 'ideas.json');
const REQUESTS = path.join(DATA, 'requests.json');
fs.mkdirSync(DATA, { recursive: true });
for (const file of [IDEAS, REQUESTS]) if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');

app.use(express.json({ limit: '30kb' }));
app.use(express.urlencoded({ extended: false, limit: '30kb' }));
app.use(express.static(ROOT));

const allowedCategories = new Set(['Vie de classe','Communication','Organisation','Bien-être','Activité / projet','Autre']);
const statuses = ['NOUVELLE','EN ÉTUDE','TRANSMISE','RÉPONSE OBTENUE'];
function read(file){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return[];} }
function write(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function ref(){ return 'LA-2026-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function clean(s,max=700){ return String(s||'').trim().slice(0,max); }

let transporter = null;
if(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS){
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
const recipients = [process.env.MAIL_TO_LOUKA || 'louka.damone@student.arperuwelz.be', process.env.MAIL_TO_ARON || 'aron.willaert@student.arperuwelz.be'];
async function notify(subject, text, replyTo){
  if(!transporter) return false;
  await transporter.sendMail({from: process.env.MAIL_FROM || process.env.SMTP_USER, to: recipients.join(','), replyTo: replyTo || undefined, subject, text});
  return true;
}

app.get('/api/health', (_req,res)=>res.json({ok:true, online:true, mailConfigured:Boolean(transporter)}));

app.post('/api/ideas', async (req,res)=>{
  const category = clean(req.body.category,60);
  const text = clean(req.body.text,700);
  if(!allowedCategories.has(category) || text.length < 4) return res.status(400).json({ok:false,error:'Catégorie ou idée invalide.'});
  const item = { id: ref(), category, text, status:'NOUVELLE', createdAt:new Date().toISOString() };
  const ideas = read(IDEAS); ideas.push(item); write(IDEAS, ideas);
  const requests = read(REQUESTS); requests.push({id:item.id, type:'IDÉE', category, status:item.status, createdAt:item.createdAt}); write(REQUESTS,requests);
  try { await notify(`[L&A] Nouvelle idée ${item.id}`, `Référence : ${item.id}\nCatégorie : ${category}\n\n${text}`); } catch(e){ console.error('Mail idea:',e.message); }
  res.status(201).json({ok:true, id:item.id, status:item.status});
});

app.get('/api/requests/:id', (req,res)=>{
  const id = clean(req.params.id,20).toUpperCase();
  const ideas = read(IDEAS); const item = ideas.find(x=>x.id===id);
  if(!item) return res.status(404).json({ok:false,error:'Référence introuvable.'});
  res.json({ok:true, request:{id:item.id, category:item.category, status:item.status, createdAt:item.createdAt, updatedAt:item.updatedAt || item.createdAt, response:item.response || ''}});
});

// Endpoint réservé à la gestion de la délégation. Définir ADMIN_TOKEN sur l'hébergement.
app.patch('/api/requests/:id', (req,res)=>{
  if(!process.env.ADMIN_TOKEN || req.get('x-admin-token') !== process.env.ADMIN_TOKEN) return res.status(401).json({ok:false,error:'Non autorisé.'});
  const id=clean(req.params.id,20).toUpperCase();
  if(!statuses.includes(req.body.status)) return res.status(400).json({ok:false,error:'Statut invalide.'});
  const ideas=read(IDEAS); const item=ideas.find(x=>x.id===id);
  if(!item) return res.status(404).json({ok:false,error:'Référence introuvable.'});
  item.status=req.body.status; item.response=clean(req.body.response,1000); item.updatedAt=new Date().toISOString(); write(IDEAS,ideas);
  const requests=read(REQUESTS); const r=requests.find(x=>x.id===id); if(r){r.status=item.status;r.updatedAt=item.updatedAt;} write(REQUESTS,requests);
  res.json({ok:true,request:{id:item.id,status:item.status,response:item.response||''}});
});

app.post('/api/contact', async (req,res)=>{
  const anonymous = Boolean(req.body.anonymous);
  const name = anonymous ? '' : clean(req.body.name,80);
  const email = anonymous ? '' : clean(req.body.email,160);
  const category = clean(req.body.category,80);
  const subject = clean(req.body.subject,120);
  const message = clean(req.body.message,2000);
  if(message.length < 5) return res.status(400).json({ok:false,error:'Message trop court.'});
  const text = `Type : ${anonymous ? 'ANONYME' : 'IDENTIFIÉ'}\nNom : ${name || '—'}\nEmail : ${email || '—'}\nCatégorie : ${category || '—'}\nObjet : ${subject || '—'}\n\n${message}`;
  try { await notify(`[L&A] ${anonymous?'Message anonyme':'Message identifié'}${subject ? ' — '+subject : ''}`, text, email || undefined); } catch(e){ console.error('Mail contact:',e.message); }
  res.status(201).json({ok:true,message:'Message reçu.'});
});

app.get('*', (req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.listen(PORT,()=>console.log(`L&A server running on http://localhost:${PORT}`));
