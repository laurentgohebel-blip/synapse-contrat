// supabase-storage.js — Synapse RH
(function () {
  const SB_URL = 'https://pbfhqkofzlcncynkxizz.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmhxa29memxjbmN5bmt4aXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODg4OTgsImV4cCI6MjA4OTg2NDg5OH0.lEkC_pFJfK8pGusKIeq1nxuTOt-sgx1iM2BjxSwHsjE';

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

  async function load(collection) {
    const local = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    try {
      const rows = await sbFetch(collection + '?order=created_at.desc&limit=500', { method: 'GET' });
      const remote = rows.map(function(r) { return r.data || r; });
      if (remote.length === 0 && local.length > 0) {
        console.log('[Supabase] Migration', local.length, 'entrees ->', collection);
        local.forEach(function(e) { _addToSB(collection, e); });
        return local;
      }
      if (remote.length > 0) {
        const remoteIds = new Set(remote.map(function(d) { return String(d.id); }));
        const unsent = local.filter(function(d) { return !remoteIds.has(String(d.id)); });
        if (unsent.length > 0) {
          unsent.forEach(function(e) { _addToSB(collection, e); });
          const merged = unsent.concat(remote);
          localStorage.setItem('synapse_' + collection, JSON.stringify(merged));
          return merged;
        }
        localStorage.setItem('synapse_' + collection, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch(e) {
      console.warn('[Supabase] load fallback local:', e.message);
      return local;
    }
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
        console.warn('[Supabase] add error:', e.message);
      }
    }
  }

  async function add(collection, entry) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    arr.unshift(entry);
    localStorage.setItem('synapse_' + collection, JSON.stringify(arr));
    await _addToSB(collection, entry);
    return true;
  }

  async function update(collection, id, changes) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    const idx = arr.findIndex(function(d) { return d.id === id; });
    if (idx !== -1) { Object.assign(arr[idx], changes); localStorage.setItem('synapse_' + collection, JSON.stringify(arr)); }
    try {
      const rows = await sbFetch(collection + '?id=eq.' + id, { method: 'GET' });
      const cur = (rows && rows[0] && rows[0].data) ? rows[0].data : (arr[idx] || {});
      Object.assign(cur, changes);
      await sbFetch(collection + '?id=eq.' + id, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal', 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cur })
      });
    } catch(e) { console.warn('[Supabase] update:', e.message); }
    return true;
  }

  async function remove(collection, id) {
    const arr = JSON.parse(localStorage.getItem('synapse_' + collection) || '[]');
    localStorage.setItem('synapse_' + collection, JSON.stringify(arr.filter(function(d) { return d.id !== id; })));
    try { await sbFetch(collection + '?id=eq.' + id, { method: 'DELETE' }); } catch(e) {}
    return true;
  }

  async function checkConnection() {
    try { await sbFetch('contrats?limit=1', { method: 'GET' }); return true; } catch(e) { return false; }
  }

  window.SynapseStorage = { load, add, update, remove, check: checkConnection, getToken: function(){return 'supabase';}, setToken: function(){} };

  document.addEventListener('DOMContentLoaded', function() {
    var bar = document.getElementById('srh-token-bar');
    if (!bar) return;
    ['srh-token-label','srh-token-input','srh-token-btn'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
    var dot=document.getElementById('srh-token-dot'); if(dot) dot.style.background='#34D399';
    var ok=document.getElementById('srh-token-ok'); if(ok){ ok.style.display='inline'; ok.textContent='✓ Connecté à Supabase'; ok.style.color='#34D399'; }
    setTimeout(function(){ bar.style.display='none'; document.body.classList.remove('srh-has-bar'); }, 2500);
  });
})();
