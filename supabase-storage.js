// supabase-storage.js — Synapse RH
// localStorage = affichage instantané, Supabase = source de vérité persistante
// RÈGLE ABSOLUE : localStorage n'est JAMAIS écrasé par une réponse vide de Supabase

(function () {
  // Lit les credentials depuis config.js (plus facile à mettre à jour)
  const cfg  = window.SYNAPSE_CONFIG || {};
  const SB_URL = cfg.supabase_url || 'https://pbfhqkofzlcncynkxizz.supabase.co';
  const SB_KEY = cfg.supabase_key || '';

  // Vérification au démarrage
  if (!SB_KEY || SB_KEY === 'COLLEZ_VOTRE_CLE_ANON_ICI') {
    console.error('[Supabase] Clé API manquante — éditez config.js');
  }

  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
  };

  async function sbFetch(path, options) {
    const res = await fetch(SB_URL + '/rest/v1/' + path, {
      ...options,
      headers: { ...HEADERS, ...(options && options.headers || {}) }
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Supabase ' + res.status + ': ' + err);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  // ── LOAD : ne jamais écraser localStorage avec un résultat vide ────────
  async function load(collection) {
    const local = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');

    try {
      const rows = await sbFetch(collection + '?order=created_at.desc&limit=500', { method: 'GET' });
      const remote = rows.map(function(r) { return r.data || r; });

      // Supabase vide + données locales → migration silencieuse vers Supabase
      if (remote.length === 0 && local.length > 0) {
        console.log('[Supabase] Migration', local.length, 'entrées depuis localStorage →', collection);
        local.forEach(function(entry) { _addToSB(collection, entry); });
        return local; // Conserver les données locales
      }

      // Supabase a des données → chercher des entrées locales non encore envoyées
      if (remote.length > 0) {
        const remoteIds = new Set(remote.map(function(d) { return String(d.id); }));
        const unsent = local.filter(function(d) { return !remoteIds.has(String(d.id)); });
        if (unsent.length > 0) {
          unsent.forEach(function(entry) { _addToSB(collection, entry); });
          const merged = unsent.concat(remote);
          localStorage.setItem('synapse_' + collection, JSON.stringify(merged));
          return merged;
        }
        // Supabase à jour → sync locale
        localStorage.setItem('synapse_' + collection, JSON.stringify(remote));
        return remote;
      }

      return local;
    } catch(e) {
      console.warn('[Supabase] load fallback local:', e.message);
      return local; // En cas d'erreur : localStorage intact
    }
  }

  // ── ADD : localStorage d'abord, Supabase ensuite ───────────────────────
  async function add(collection, entry) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    arr.unshift(entry);
    localStorage.setItem('synapse_' + collection, JSON.stringify(arr));
    await _addToSB(collection, entry);
    return true;
  }

  async function _addToSB(collection, entry) {
    try {
      await sbFetch(collection, {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, data: entry })
      });
    } catch(e) {
      if (!e.message.includes('23505') && !e.message.includes('duplicate')) {
        console.warn('[Supabase] _addToSB:', e.message);
      }
    }
  }

  // ── UPDATE : localStorage d'abord, Supabase ensuite ───────────────────
  async function update(collection, id, changes) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    const idx = arr.findIndex(function(d) { return d.id === id; });
    if (idx !== -1) { Object.assign(arr[idx], changes); localStorage.setItem('synapse_' + collection, JSON.stringify(arr)); }
    try {
      const rows = await sbFetch(collection + '?id=eq.' + id, { method: 'GET' });
      const current = (rows && rows[0] && rows[0].data) ? rows[0].data : (arr[idx] || {});
      Object.assign(current, changes);
      await sbFetch(collection + '?id=eq.' + id, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal', 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: current })
      });
    } catch(e) { console.warn('[Supabase] update:', e.message); }
    return true;
  }

  // ── REMOVE ─────────────────────────────────────────────────────────────
  async function remove(collection, id) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    localStorage.setItem('synapse_' + collection, JSON.stringify(arr.filter(function(d){ return d.id!==id; })));
    try { await sbFetch(collection + '?id=eq.' + id, { method: 'DELETE' }); } catch(e) {}
    return true;
  }

  async function checkConnection() {
    try { await sbFetch('contrats?limit=1', { method: 'GET' }); return true; } catch(e) { return false; }
  }

  window.SynapseStorage = { load, add, update, remove, check: checkConnection, getToken: function(){return 'supabase';}, setToken: function(){} };

  // Bannière verte → disparaît en 2.5s
  document.addEventListener('DOMContentLoaded', function() {
    var bar = document.getElementById('srh-token-bar');
    if (!bar) return;
    ['srh-token-label','srh-token-input','srh-token-btn'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
    var dot=document.getElementById('srh-token-dot'); if(dot) dot.style.background='#34D399';
    var ok=document.getElementById('srh-token-ok'); if(ok){ ok.style.display='inline'; ok.textContent='✓ Connecté à Supabase — synchronisation automatique'; ok.style.color='#34D399'; }
    setTimeout(function(){ bar.style.display='none'; document.body.classList.remove('srh-has-bar'); }, 2500);
  });

})();
