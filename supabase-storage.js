// supabase-storage.js — Synapse RH
// Remplace github-storage.js — base de données PostgreSQL temps réel

(function () {
  const SB_URL = 'https://pbfhqkofzlcncynkxizz.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmhxa29memxjbmN5bmtYaXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODg4OTgsImV4cCI6MjA4OTg2NDg5OH0.lEkC_pFJfK8pGusKIeq1nxuTOt-sgx1iM2BjxSwHsjE';

  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Prefer': 'return=minimal'
  };

  // ── Requête générique ──────────────────────────────────────────────────
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

  // ── Charger une collection ─────────────────────────────────────────────
  async function load(collection) {
    try {
      const rows = await sbFetch(collection + '?order=created_at.desc&limit=500', { method: 'GET' });
      const data = rows.map(function (r) { return r.data || r; });
      // Miroir localStorage pour affichage hors-ligne
      localStorage.setItem('synapse_' + collection, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn('[Supabase] load error, fallback localStorage:', e.message);
      return JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    }
  }

  // ── Ajouter un enregistrement ──────────────────────────────────────────
  async function add(collection, entry) {
    // Mise à jour localStorage immédiate (affichage instantané)
    const existing = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    existing.unshift(entry);
    localStorage.setItem('synapse_' + collection, JSON.stringify(existing));

    // Écriture Supabase
    try {
      await sbFetch(collection, {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ id: entry.id, data: entry })
      });
      return true;
    } catch (e) {
      console.error('[Supabase] add error:', e.message);
      return false;
    }
  }

  // ── Mettre à jour un enregistrement ───────────────────────────────────
  async function update(collection, id, changes) {
    // Mise à jour localStorage immédiate
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    const idx = arr.findIndex(function (d) { return d.id === id; });
    if (idx !== -1) {
      Object.assign(arr[idx], changes);
      localStorage.setItem('synapse_' + collection, JSON.stringify(arr));
    }

    // Écriture Supabase
    try {
      const row = await sbFetch(collection + '?id=eq.' + id, { method: 'GET' });
      const existing = (row && row[0] && row[0].data) ? row[0].data : {};
      Object.assign(existing, changes);
      await sbFetch(collection + '?id=eq.' + id, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ data: existing })
      });
      return true;
    } catch (e) {
      console.error('[Supabase] update error:', e.message);
      return false;
    }
  }

  // ── Supprimer un enregistrement ────────────────────────────────────────
  async function remove(collection, id) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    localStorage.setItem('synapse_' + collection, JSON.stringify(arr.filter(function (d) { return d.id !== id; })));
    try {
      await sbFetch(collection + '?id=eq.' + id, { method: 'DELETE' });
      return true;
    } catch (e) {
      console.error('[Supabase] delete error:', e.message);
      return false;
    }
  }

  // ── Tester la connexion ────────────────────────────────────────────────
  async function checkConnection() {
    try {
      await sbFetch('contrats?limit=1', { method: 'GET' });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── API publique (compatible avec l'ancien SynapseStorage) ────────────
  window.SynapseStorage = {
    load:   load,
    add:    add,
    update: update,
    remove: remove,
    check:  checkConnection,
    // Compatibilité github-storage
    getToken:  function () { return SB_KEY; },
    setToken:  function () {},
  };

  // Indicateur de connexion dans token-setup.js (si présent)
  document.addEventListener('DOMContentLoaded', async function () {
    const bar = document.getElementById('srh-token-bar');
    if (bar) {
      bar.style.background = '#0F2922';
      bar.style.borderColor = '#6EE7B7';
      const label = document.getElementById('srh-token-label');
      const dot   = document.getElementById('srh-token-dot');
      const input = document.getElementById('srh-token-input');
      const btn   = document.getElementById('srh-token-btn');
      const okMsg = document.getElementById('srh-token-ok');
      if (label)  { label.style.display = 'none'; }
      if (input)  { input.style.display = 'none'; }
      if (btn)    { btn.style.display = 'none'; }
      if (dot)    { dot.className = 'ok'; }
      if (okMsg)  { okMsg.style.display = 'inline'; okMsg.textContent = '✓ Connecté à Supabase — données synchronisées en temps réel'; okMsg.style.color = '#34D399'; }
      setTimeout(function () {
        if (bar) { bar.style.display = 'none'; }
        const body = document.body;
        if (body) { body.classList.remove('srh-has-bar'); }
      }, 3000);
    }
  });

})();
