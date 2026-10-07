const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const DATA = path.join(ROOT, 'data');
const IDEAS_FILE = path.join(DATA, 'ideas.json');
const REQUESTS_FILE = path.join(DATA, 'requests.json');
const CONTACTS_FILE = path.join(DATA, 'contacts.json');
fs.mkdirSync(DATA, { recursive: true });
for (const file of [IDEAS_FILE, REQUESTS_FILE, CONTACTS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
}

app.use(express.json({ limit: '30kb' }));
app.use(express.urlencoded({ extended: false, limit: '30kb' }));
app.use(express.static(ROOT));

const allowedCategories = new Set([
  'Vie de classe','Communication','Organisation','Bien-être',
  'Activité / projet','Projet / activité','Autre'
]);
const statuses = ['NOUVELLE','EN ÉTUDE','TRANSMISE','RÉPONSE OBTENUE'];

function clean(s, max=700) { return String(s ?? '').trim().slice(0, max); }
function ref() { return 'LA-2026-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function read(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function write(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

let pool = null;
let dbReady = false;

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL absente : stockage fichier local utilisé.');
    return;
  }
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL,
      response TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id BIGSERIAL PRIMARY KEY,
      anonymous BOOLEAN NOT NULL,
      name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      category TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);
  dbReady = true;
  console.log('PostgreSQL connecté et tables prêtes.');
}

async function createIdea(item) {
  if (!dbReady) {
    const ideas = read(IDEAS_FILE); ideas.push(item); write(IDEAS_FILE, ideas);
    const requests = read(REQUESTS_FILE);
    requests.push({ id:item.id, type:'IDÉE', category:item.category, status:item.status, createdAt:item.createdAt });
    write(REQUESTS_FILE, requests);
    return;
  }
  await pool.query(
    `INSERT INTO ideas (id,category,text,status,response,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6)`,
    [item.id,item.category,item.text,item.status,'',item.createdAt]
  );
}

async function getIdea(id) {
  if (!dbReady) return read(IDEAS_FILE).find(x => x.id === id) || null;
  const r = await pool.query(
    `SELECT id,category,text,status,response,created_at AS "createdAt",updated_at AS "updatedAt"
     FROM ideas WHERE id=$1`, [id]
  );
  return r.rows[0] || null;
}

async function listIdeas() {
  if (!dbReady) return read(IDEAS_FILE).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const r = await pool.query(
    `SELECT id,category,text,status,response,created_at AS "createdAt",updated_at AS "updatedAt"
     FROM ideas ORDER BY created_at DESC`
  );
  return r.rows;
}

async function updateIdea(id, status, response) {
  if (!dbReady) {
    const ideas=read(IDEAS_FILE); const item=ideas.find(x=>x.id===id);
    if (!item) return null;
    item.status=status; item.response=response; item.updatedAt=new Date().toISOString(); write(IDEAS_FILE,ideas);
    return item;
  }
  const r=await pool.query(
    `UPDATE ideas SET status=$2,response=$3,updated_at=NOW()
     WHERE id=$1
     RETURNING id,category,text,status,response,created_at AS "createdAt",updated_at AS "updatedAt"`,
    [id,status,response]
  );
  return r.rows[0] || null;
}

async function deleteIdea(id) {
  if (!dbReady) {
    const ideas=read(IDEAS_FILE); const next=ideas.filter(x=>x.id!==id);
    if (next.length===ideas.length) return false;
    write(IDEAS_FILE,next);
    write(REQUESTS_FILE,read(REQUESTS_FILE).filter(x=>x.id!==id));
    return true;
  }
  const r=await pool.query(`DELETE FROM ideas WHERE id=$1`,[id]);
  return r.rowCount > 0;
}

async function createContact(item) {
  if (!dbReady) {
    const contacts=read(CONTACTS_FILE); contacts.push(item); write(CONTACTS_FILE,contacts);
    return;
  }
  await pool.query(
    `INSERT INTO contacts (anonymous,name,email,category,subject,message,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [item.anonymous,item.name,item.email,item.category,item.subject,item.message,item.createdAt]
  );
}

async function listContacts() {
  if (!dbReady) return read(CONTACTS_FILE).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const r=await pool.query(
    `SELECT id,anonymous,name,email,category,subject,message,created_at AS "createdAt"
     FROM contacts ORDER BY created_at DESC`
  );
  return r.rows;
}

/* SMTP is deliberately non-blocking. It is optional and never prevents saving data. */
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 7000,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } catch (e) { console.error('SMTP init:', e.message); }
}
const recipients = [
  process.env.MAIL_TO_LOUKA || 'louka.damone@student.arperuwelz.be',
  process.env.MAIL_TO_ARON || 'aron.willaert@student.arperuwelz.be'
];
async function notify(subject, text, replyTo) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: recipients.join(','),
      replyTo: replyTo || undefined,
      subject, text
    });
  } catch (e) {
    console.error('Notification mail ignorée:', e.message);
  }
}

/* Private admin sessions: ADMIN_TOKEN never leaves the server. */
const sessions = new Map();
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k,...v]=part.trim().split('=');
    if(k) out[k]=decodeURIComponent(v.join('=')||'');
  }
  return out;
}
function adminRequired(req,res,next) {
  const sid=parseCookies(req).la_admin;
  if (!sid || !sessions.has(sid)) return res.status(401).json({ok:false,error:'Connexion administrateur requise.'});
  next();
}
function setAdminCookie(res, sid) {
  res.setHeader('Set-Cookie', `la_admin=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
}

app.get('/api/health', (_req,res)=>res.json({
  ok:true, online:true, database:dbReady?'postgresql':'file',
  mailConfigured:Boolean(transporter)
}));

app.post('/api/ideas', async (req,res)=>{
  try {
    const category=clean(req.body.category,60);
    const text=clean(req.body.text,700);
    if(!allowedCategories.has(category) || text.length<4)
      return res.status(400).json({ok:false,error:'Catégorie ou idée invalide.'});
    const now=new Date().toISOString();
    const item={id:ref(),category,text,status:'NOUVELLE',response:'',createdAt:now,updatedAt:now};
    await createIdea(item);
    /* The response does NOT wait for SMTP. */
    void notify(`[L&A] Nouvelle idée ${item.id}`,
      `Référence : ${item.id}\nCatégorie : ${category}\n\n${text}`);
    res.status(201).json({ok:true,id:item.id,status:item.status,database:dbReady?'postgresql':'file'});
  } catch(e) {
    console.error('Idea error:',e);
    res.status(500).json({ok:false,error:'Impossible d’enregistrer l’idée.'});
  }
});

app.get('/api/requests/:id', async (req,res)=>{
  try {
    const id=clean(req.params.id,20).toUpperCase();
    const item=await getIdea(id);
    if(!item) return res.status(404).json({ok:false,error:'Référence introuvable.'});
    res.json({ok:true,request:{
      id:item.id,category:item.category,status:item.status,
      createdAt:item.createdAt,updatedAt:item.updatedAt||item.createdAt,
      response:item.response||''
    }});
  } catch(e) { console.error(e); res.status(500).json({ok:false,error:'Service momentanément indisponible.'}); }
});

app.post('/api/contact', async (req,res)=>{
  try {
    const anonymous=Boolean(req.body.anonymous);
    const name=anonymous?'':clean(req.body.name,80);
    const email=anonymous?'':clean(req.body.email,160);
    const category=clean(req.body.category,80);
    const subject=clean(req.body.subject,120);
    const message=clean(req.body.message,2000);
    if(message.length<5) return res.status(400).json({ok:false,error:'Message trop court.'});
    const item={anonymous,name,email,category,subject,message,createdAt:new Date().toISOString()};
    await createContact(item);
    void notify(`[L&A] ${anonymous?'Message anonyme':'Message identifié'}${subject?' — '+subject:''}`,
      `Type : ${anonymous?'ANONYME':'IDENTIFIÉ'}\nNom : ${name||'—'}\nEmail : ${email||'—'}\nCatégorie : ${category||'—'}\nObjet : ${subject||'—'}\n\n${message}`,
      email||undefined);
    res.status(201).json({ok:true,message:'Message reçu. Il est enregistré dans l’espace de la délégation.'});
  } catch(e) {
    console.error('Contact error:',e);
    res.status(500).json({ok:false,error:'Impossible d’enregistrer le message.'});
  }
});

/* Admin authentication */
app.post('/api/admin/login',(req,res)=>{
  const token=String(req.body.token||'');
  if(!process.env.ADMIN_TOKEN || !token || token !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ok:false,error:'Code administrateur incorrect.'});
  const sid=crypto.randomBytes(32).toString('hex');
  sessions.set(sid,{createdAt:Date.now()});
  setAdminCookie(res,sid);
  res.json({ok:true});
});
app.post('/api/admin/logout',(req,res)=>{
  const sid=parseCookies(req).la_admin;
  if(sid) sessions.delete(sid);
  res.setHeader('Set-Cookie','la_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ok:true});
});
app.get('/api/admin/data',adminRequired,async (_req,res)=>{
  try {
    const [ideas,contacts]=await Promise.all([listIdeas(),listContacts()]);
    const stats={
      totalIdeas:ideas.length,
      newIdeas:ideas.filter(x=>x.status==='NOUVELLE').length,
      inStudy:ideas.filter(x=>x.status==='EN ÉTUDE').length,
      transmitted:ideas.filter(x=>x.status==='TRANSMISE').length,
      answered:ideas.filter(x=>x.status==='RÉPONSE OBTENUE').length,
      totalMessages:contacts.length
    };
    res.json({ok:true,stats,ideas,contacts});
  } catch(e) { console.error('Admin data:',e); res.status(500).json({ok:false,error:'Impossible de charger les données.'}); }
});
app.patch('/api/admin/ideas/:id',adminRequired,async (req,res)=>{
  try {
    const id=clean(req.params.id,20).toUpperCase();
    const status=clean(req.body.status,30);
    const response=clean(req.body.response,1000);
    if(!statuses.includes(status)) return res.status(400).json({ok:false,error:'Statut invalide.'});
    const item=await updateIdea(id,status,response);
    if(!item) return res.status(404).json({ok:false,error:'Référence introuvable.'});
    res.json({ok:true,idea:item});
  } catch(e) { console.error(e); res.status(500).json({ok:false,error:'Mise à jour impossible.'}); }
});
app.delete('/api/admin/ideas/:id',adminRequired,async (req,res)=>{
  try {
    const ok=await deleteIdea(clean(req.params.id,20).toUpperCase());
    if(!ok) return res.status(404).json({ok:false,error:'Référence introuvable.'});
    res.json({ok:true});
  } catch(e) { console.error(e); res.status(500).json({ok:false,error:'Suppression impossible.'}); }
});

app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));

(async()=>{
  try {
    await initDb();
    app.listen(PORT,()=>console.log(`L&A server running on http://localhost:${PORT}`));
  } catch(e) {
    console.error('DATABASE ERROR:',e.message);
    console.error('Le serveur reste arrêté pour éviter de perdre des données.');
    process.exit(1);
  }
})();
