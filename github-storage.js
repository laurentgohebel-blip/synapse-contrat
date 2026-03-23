// github-storage.js — Synapse RH
// Sauvegarde les données dans le repo GitHub via l'API
// Remplace localStorage par des fichiers JSON dans /data/

(function(){
'use strict';

// ── CONFIG — à remplir une fois ───────────────────────────────────────────
const GH_OWNER = 'laurentgohebel-blip';
const GH_REPO  = 'synapse-contrat';
const GH_BRANCH = 'main';
const DATA_PATH = 'data'; // dossier dans le repo

// ── Récupère le token GitHub depuis localStorage ──────────────────────────
function getToken(){
  return localStorage.getItem('synapse_gh_token') || '';
}

// ── Headers API GitHub ─────────────────────────────────────────────────────
function headers(){
  return {
    'Authorization': 'token ' + getToken(),
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };
}

const BASE = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/';

// ── Lire un fichier JSON depuis le repo ───────────────────────────────────
async function readFile(filename){
  try {
    const res = await fetch(BASE + DATA_PATH + '/' + filename, {
      headers: headers()
    });
    if(res.status === 404) return { data: [], sha: null };
    if(!res.ok) throw new Error('GitHub API ' + res.status);
    const json = await res.json();
    const content = JSON.parse(atob(json.content.replace(/\n/g,'')));
    return { data: content, sha: json.sha };
  } catch(e) {
    console.warn('[GH Storage] readFile error:', e.message);
    // Fallback sur localStorage
    return { data: JSON.parse(localStorage.getItem('synapse_' + filename.replace('.json','')) || '[]'), sha: null };
  }
}

// ── Écrire un fichier JSON dans le repo ───────────────────────────────────
async function writeFile(filename, data, sha){
  const token = getToken();
  if(!token){
    // Pas de token → fallback localStorage silencieux
    const key = 'synapse_' + filename.replace('.json','');
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  try {
    const body = {
      message: 'Synapse RH — mise à jour ' + filename,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
      branch: GH_BRANCH
    };
    if(sha) body.sha = sha;

    const res = await fetch(BASE + DATA_PATH + '/' + filename, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const err = await res.json();
      throw new Error(err.message || 'GitHub API ' + res.status);
    }
    // Miroir dans localStorage pour accès rapide
    const key = 'synapse_' + filename.replace('.json','');
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(key + '_ts', String(Date.now()));
    return true;
  } catch(e) {
    console.error('[GH Storage] writeFile error:', e.message);
    // Fallback localStorage
    const key = 'synapse_' + filename.replace('.json','');
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(key + '_ts', String(Date.now()));
    return false;
  }
}

// ── API publique ───────────────────────────────────────────────────────────

// Charger une collection (contrats, conges, acomptes)
async function load(collection){
  const token = getToken();
  const localData = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
  const localTs = parseInt(localStorage.getItem('synapse_' + collection + '_ts') || '0');

  if(!token){
    return localData;
  }

  try {
    // Lecture rapide via raw URL
    const rawUrl = 'https://raw.githubusercontent.com/' + GH_OWNER + '/' + GH_REPO + '/main/data/' + collection + '.json?t=' + Date.now();
    const res = await fetch(rawUrl, { cache: 'no-store' });
    if(res.ok){
      const remoteData = await res.json();

      // Ne pas écraser si les données locales sont plus récentes (< 60s)
      const localAge = Date.now() - localTs;
      if(localTs > 0 && localAge < 60000){
        // Fusionner : garder les entrées locales non présentes sur GitHub
        const remoteIds = new Set(remoteData.map(function(d){ return d.id; }));
        const localOnly = localData.filter(function(d){ return !remoteIds.has(d.id); });
        if(localOnly.length > 0){
          const merged = localOnly.concat(remoteData);
          localStorage.setItem('synapse_' + collection, JSON.stringify(merged));
          return merged;
        }
      }

      localStorage.setItem('synapse_' + collection, JSON.stringify(remoteData));
      return remoteData;
    }
  } catch(e) {}

  return localData;
}

// Ajouter un enregistrement dans une collection
async function add(collection, entry){
  const token = getToken();
  if(!token){
    // Fallback localStorage
    const existing = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    existing.unshift(entry);
    localStorage.setItem('synapse_' + collection, JSON.stringify(existing));
    localStorage.setItem('synapse_' + collection + '_ts', String(Date.now()));
    return true;
  }
  const { data, sha } = await readFile(collection + '.json');
  data.unshift(entry);
  return await writeFile(collection + '.json', data, sha);
}

// Mettre à jour un enregistrement (ex: changer le statut)
async function update(collection, id, changes){
  const token = getToken();
  if(!token){
    const existing = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    const idx = existing.findIndex(function(d){ return d.id === id; });
    if(idx !== -1) Object.assign(existing[idx], changes);
    localStorage.setItem('synapse_' + collection, JSON.stringify(existing));
    return true;
  }
  const { data, sha } = await readFile(collection + '.json');
  const idx = data.findIndex(function(d){ return d.id === id; });
  if(idx !== -1) Object.assign(data[idx], changes);
  return await writeFile(collection + '.json', data, sha);
}

// Vérifier si le token est valide
async function checkToken(){
  const token = getToken();
  if(!token) return false;
  try {
    const res = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO, {
      headers: headers()
    });
    return res.ok;
  } catch(e) {
    return false;
  }
}

// Exposer l'API globale
window.SynapseStorage = {
  load: load,
  add: add,
  update: update,
  checkToken: checkToken,
  getToken: getToken,
  setToken: function(t){ localStorage.setItem('synapse_gh_token', t); }
};

})();
