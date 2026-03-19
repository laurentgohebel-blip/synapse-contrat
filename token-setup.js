// token-setup.js — Synapse RH
// Widget de configuration du token GitHub + initialisation dossier /data

(function(){
'use strict';

const css = `
#srh-token-bar{position:fixed;top:0;left:0;right:0;background:#1F2937;color:white;padding:9px 20px;display:flex;align-items:center;gap:12px;z-index:8000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12.5px;transition:.3s}
#srh-token-bar.hidden{transform:translateY(-100%)}
#srh-token-dot{width:8px;height:8px;border-radius:50%;background:#DC2626;flex-shrink:0}
#srh-token-dot.ok{background:#34D399}
#srh-token-label{flex:1;color:#D1D5DB}
#srh-token-input{padding:5px 10px;border:1px solid #374151;border-radius:6px;background:#374151;color:white;font-size:12px;width:280px;font-family:monospace}
#srh-token-input:focus{outline:none;border-color:#2E75B6}
#srh-token-btn{padding:5px 14px;background:#2E75B6;border:none;border-radius:6px;color:white;font-size:12px;cursor:pointer;font-weight:600}
#srh-token-btn:hover{background:#1A4F80}
#srh-token-ok{color:#34D399;font-size:12px;display:none}
#srh-token-dismiss{background:none;border:none;color:#6B7280;cursor:pointer;font-size:16px;padding:2px 6px;line-height:1;margin-left:4px}
#srh-token-dismiss:hover{color:white}
body.srh-has-bar{padding-top:44px}
`;

const s = document.createElement('style');
s.textContent = css;
document.head.appendChild(s);

const bar = document.createElement('div');
bar.id = 'srh-token-bar';
bar.innerHTML = `
  <span id="srh-token-dot"></span>
  <span id="srh-token-label">Sauvegarde GitHub non configurée</span>
  <input id="srh-token-input" type="password" placeholder="Token GitHub (ghp_...)" />
  <button id="srh-token-btn" onclick="window._srhToken.connect()">Connecter</button>
  <span id="srh-token-ok">✓ Connecté — données sauvegardées sur GitHub</span>
  <button id="srh-token-dismiss" onclick="window._srhToken.dismiss()" title="Masquer">×</button>
`;
document.body.prepend(bar);
document.body.classList.add('srh-has-bar');

// Restore saved token
const saved = localStorage.getItem('synapse_gh_token') || '';
if(saved){
  document.getElementById('srh-token-input').value = saved;
  checkAndShow(saved);
}

async function connect(){
  const token = document.getElementById('srh-token-input').value.trim();
  if(!token) return;
  localStorage.setItem('synapse_gh_token', token);
  if(window.SynapseStorage) window.SynapseStorage.setToken(token);
  await checkAndShow(token);
  await initDataFolder(token);
}

async function checkAndShow(token){
  try {
    if(window.SynapseStorage){
      const ok = await window.SynapseStorage.checkToken();
      setStatus(ok);
    } else {
      // Vérification directe
      const res = await fetch('https://api.github.com/repos/laurentgohebel-blip/synapse-contrat', {
        headers: { 'Authorization': 'token ' + token }
      });
      setStatus(res.ok);
    }
  } catch(e) {
    setStatus(false);
  }
}

function setStatus(ok){
  const dot = document.getElementById('srh-token-dot');
  const label = document.getElementById('srh-token-label');
  const okMsg = document.getElementById('srh-token-ok');
  const inp = document.getElementById('srh-token-input');
  const btn = document.getElementById('srh-token-btn');
  if(ok){
    dot.className = 'ok';
    label.style.display = 'none';
    inp.style.display = 'none';
    btn.style.display = 'none';
    okMsg.style.display = 'inline';
    // Auto-dismiss après 3s
    setTimeout(function(){ dismiss(); }, 3000);
  } else {
    dot.className = '';
    label.style.display = '';
    inp.style.display = '';
    btn.style.display = '';
    okMsg.style.display = 'none';
    label.textContent = 'Token invalide — réessayez';
  }
}

// Crée le dossier /data avec des fichiers vides si inexistant
async function initDataFolder(token){
  const collections = ['contrats','conges','acomptes'];
  const BASE = 'https://api.github.com/repos/laurentgohebel-blip/synapse-contrat/contents/data/';
  const hdrs = {
    'Authorization': 'token '+token,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  for(const col of collections){
    const filename = col + '.json';
    // Vérifier si le fichier existe
    const check = await fetch(BASE + filename, { headers: hdrs });
    if(check.status === 404){
      // Créer le fichier avec un tableau vide
      // Récupérer les données localStorage existantes si présentes
      const existing = localStorage.getItem('synapse_' + col);
      const initData = existing ? JSON.parse(existing) : [];
      await fetch(BASE + filename, {
        method: 'PUT',
        headers: hdrs,
        body: JSON.stringify({
          message: 'Synapse RH — initialisation ' + filename,
          content: btoa(unescape(encodeURIComponent(JSON.stringify(initData, null, 2)))),
          branch: 'main'
        })
      });
      console.log('[GH Storage] Créé:', filename, '('+initData.length+' entrées migrées)');
    }
  }
}

function dismiss(){
  bar.classList.add('hidden');
  document.body.classList.remove('srh-has-bar');
}

window._srhToken = { connect: connect, dismiss: dismiss };

})();
