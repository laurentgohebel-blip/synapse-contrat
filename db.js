// db.js — Synapse RH Database Engine
// Charge la base depuis GitHub et injecte l'autocomplétion dans les formulaires

(function () {
  'use strict';

  const GH_OWNER  = 'laurentgohebel-blip';
  const GH_REPO   = 'synapse-contrat';
  const DB_PATH   = 'data/database.json';
  const CACHE_KEY = 'synapse_db_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // ── Chargement de la base ──────────────────────────────────────────────
  async function loadDB(forceRemote) {
    // 1. Cache mémoire (session)
    if (window._synapseDB && !forceRemote) return window._synapseDB;

    // 2. localStorage immédiat + sync GitHub en arrière-plan
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && !forceRemote) {
      try {
        const { data, ts } = JSON.parse(cached);
        window._synapseDB = data;
        // Sync en arrière-plan si cache > 30s
        if (Date.now() - ts > 30000) {
          syncFromGitHub();
        }
        return data;
      } catch (e) {}
    }

    // 3. Fetch via raw URL (rapide, pas de base64)
    try {
      const rawUrl = 'https://raw.githubusercontent.com/' + GH_OWNER + '/' + GH_REPO + '/main/' + DB_PATH + '?t=' + Date.now();
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (res.ok) {
        const db = await res.json();
        window._synapseDB = db;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: db, ts: Date.now() }));
        return db;
      }
    } catch (e) {}

    // 4. Fallback : localStorage brut (données saisies localement)
    const local = localStorage.getItem('synapse_database');
    if (local) {
      const db = JSON.parse(local);
      window._synapseDB = db;
      return db;
    }

    return null;
  }


  // ── Sync silencieuse en arrière-plan ──────────────────────────────────
  async function syncFromGitHub() {
    try {
      const rawUrl = 'https://raw.githubusercontent.com/' + GH_OWNER + '/' + GH_REPO + '/main/' + DB_PATH + '?t=' + Date.now();
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (res.ok) {
        const db = await res.json();
        window._synapseDB = db;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: db, ts: Date.now() }));
      }
    } catch (e) {}
  }

  // ── Sauvegarde de la base ─────────────────────────────────────────────
  async function saveDB(db) {
    db.updatedAt = new Date().toISOString();
    window._synapseDB = db;
    localStorage.setItem('synapse_database', JSON.stringify(db));
    localStorage.removeItem(CACHE_KEY);

    const token = localStorage.getItem('synapse_gh_token') || '';
    if (!token) return false;

    try {
      // Récupérer le SHA actuel
      const check = await fetch(
        'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + DB_PATH,
        { headers: { 'Authorization': 'token ' + token } }
      );
      const body = {
        message: 'Synapse RH — mise à jour base de données',
        content: btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 2)))),
        branch: 'main'
      };
      if (check.ok) { const d = await check.json(); body.sha = d.sha; }

      const res = await fetch(
        'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + DB_PATH,
        { method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // ── Autocomplete générique ─────────────────────────────────────────────
  function createDropdown(input, items, labelFn, onSelect) {
    let box = document.getElementById('srh-autocomplete');
    if (!box) {
      box = document.createElement('div');
      box.id = 'srh-autocomplete';
      box.style.cssText = 'position:absolute;z-index:9999;background:white;border:1px solid #E5E7EB;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:220px;overflow-y:auto;min-width:280px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
      document.body.appendChild(box);
    }

    const rect = input.getBoundingClientRect();
    box.style.top  = (window.scrollY + rect.bottom + 4) + 'px';
    box.style.left = (window.scrollX + rect.left) + 'px';
    box.style.width = Math.max(rect.width, 280) + 'px';
    box.innerHTML = '';

    if (!items.length) { box.style.display = 'none'; return; }

    items.forEach(function (item) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #F3F4F6;display:flex;align-items:center;gap:10px';
      div.innerHTML = labelFn(item);
      div.addEventListener('mouseenter', function () { div.style.background = '#EBF3FC'; });
      div.addEventListener('mouseleave', function () { div.style.background = ''; });
      div.addEventListener('mousedown', function (e) {
        e.preventDefault();
        onSelect(item);
        closeDropdown();
      });
      box.appendChild(div);
    });

    box.style.display = 'block';
  }

  function closeDropdown() {
    const box = document.getElementById('srh-autocomplete');
    if (box) box.style.display = 'none';
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#srh-autocomplete') && !e.target.dataset.srhAutocomplete) {
      closeDropdown();
    }
  });

  // ── Autofill : remplir un champ si l'élément existe ───────────────────
  function fill(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // Flash visuel
    el.style.transition = 'background .3s';
    el.style.background = '#EBF3FC';
    setTimeout(function () { el.style.background = ''; }, 800);
  }

  // ── Brancher les champs SALARIÉ ───────────────────────────────────────
  async function bindSalarie(nomId, prefixe) {
    const nomInput = document.getElementById(nomId);
    if (!nomInput) return;
    const db = await loadDB();
    if (!db) return;

    nomInput.dataset.srhAutocomplete = '1';
    nomInput.addEventListener('input', function () {
      const q = nomInput.value.trim().toLowerCase();
      if (q.length < 1) { closeDropdown(); return; }
      const matches = db.salaries.filter(function (s) {
        return s.actif !== false && (
          s.nom.toLowerCase().includes(q) ||
          s.prenom.toLowerCase().includes(q)
        );
      }).slice(0, 6);

      createDropdown(nomInput, matches,
        function (s) {
          return '<div style="width:32px;height:32px;border-radius:8px;background:#EBF3FC;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2E75B6;flex-shrink:0">' +
            s.nom[0] + s.prenom[0] + '</div>' +
            '<div><div style="font-weight:600;color:#111827">' + s.nom + ' ' + s.prenom + '</div>' +
            '<div style="font-size:11px;color:#6B7280">' + (s.posteDefaut || '') + ' · ' + (s.email || '') + '</div></div>';
        },
        function (s) {
          nomInput.value = s.nom;
          fill(prefixe + 'prenom',   s.prenom);
          fill(prefixe + 'ddn',      s.dateNaissance);
          fill(prefixe + 'ldn',      s.lieuNaissance);
          fill(prefixe + 'nat',      s.nationalite);
          fill(prefixe + 'adresse',  s.adresse);
          fill(prefixe + 'email',    s.email);
          fill(prefixe + 'telephone',s.telephone);
          fill(prefixe + 'secu',     s.numSecu);
          // Poste par défaut
          if (s.posteDefaut) fill('ctr_poste', s.posteDefaut);
          if (s.serviceDefaut) fill('ctr_service', s.serviceDefaut);
          showFillBadge('Salarié rempli depuis la base ✓');
        }
      );
    });
  }

  // ── Brancher les champs EMPLOYEUR ────────────────────────────────────
  async function bindEmployeur(nomId) {
    const nomInput = document.getElementById(nomId);
    if (!nomInput) return;
    const db = await loadDB();
    if (!db) return;

    nomInput.dataset.srhAutocomplete = '1';
    nomInput.addEventListener('input', function () {
      const q = nomInput.value.trim().toLowerCase();
      if (q.length < 1) { closeDropdown(); return; }
      const matches = db.employeurs.filter(function (e) {
        return e.actif !== false && e.raisonSociale.toLowerCase().includes(q);
      }).slice(0, 4);

      createDropdown(nomInput, matches,
        function (e) {
          return '<div style="width:32px;height:32px;border-radius:8px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#7C3AED;flex-shrink:0">' +
            e.raisonSociale[0] + '</div>' +
            '<div><div style="font-weight:600;color:#111827">' + e.raisonSociale + '</div>' +
            '<div style="font-size:11px;color:#6B7280">SIRET : ' + e.siret + '</div></div>';
        },
        function (e) {
          nomInput.value = e.raisonSociale;
          fill('emp_forme',   e.forme);
          fill('emp_siret',   e.siret);
          fill('emp_ape',     e.ape);
          fill('emp_adresse', e.adresse);
          fill('emp_rep',     e.representant);
          fill('emp_conv',    e.convention);
          showFillBadge('Employeur rempli depuis la base ✓');
        }
      );
    });
  }

  // ── Brancher les champs POSTE ─────────────────────────────────────────
  async function bindPoste(posteId) {
    const posteInput = document.getElementById(posteId);
    if (!posteInput) return;
    const db = await loadDB();
    if (!db) return;

    // Si c'est un <select>, on enrichit les options
    if (posteInput.tagName === 'SELECT') {
      const currentOptions = Array.from(posteInput.options).map(o => o.value);
      db.postes.forEach(function (p) {
        if (!currentOptions.includes(p.intitule)) {
          const opt = document.createElement('option');
          opt.value = p.intitule;
          opt.textContent = p.intitule;
          posteInput.appendChild(opt);
        }
      });
      posteInput.addEventListener('change', function () {
        const poste = db.postes.find(function (p) { return p.intitule === posteInput.value; });
        if (!poste) return;
        fill('ctr_class',   poste.classification + ' — Coef. ' + poste.coefficient);
        fill('ctr_duree',   poste.dureeHebdoDefaut);
        fill('ctr_missions',poste.description);
        if (poste.salaireMinBrut) fill('rem_brut', String(Math.round(poste.salaireMinBrut)));
        showFillBadge('Poste rempli depuis la base ✓');
      });
      return;
    }

    // Si c'est un <input>, autocomplete
    posteInput.dataset.srhAutocomplete = '1';
    posteInput.addEventListener('input', function () {
      const q = posteInput.value.trim().toLowerCase();
      if (q.length < 1) { closeDropdown(); return; }
      const matches = db.postes.filter(function (p) {
        return p.intitule.toLowerCase().includes(q);
      }).slice(0, 6);

      createDropdown(posteInput, matches,
        function (p) {
          return '<div><div style="font-weight:600;color:#111827">' + p.intitule + '</div>' +
            '<div style="font-size:11px;color:#6B7280">Coef. ' + p.coefficient + ' · ' + p.classification + ' · min ' + p.salaireMinBrut + ' €/mois</div></div>';
        },
        function (p) {
          posteInput.value = p.intitule;
          fill('ctr_class',   p.classification + ' — Coef. ' + p.coefficient);
          fill('ctr_duree',   p.dureeHebdoDefaut);
          fill('ctr_missions',p.description);
          if (p.salaireMinBrut) fill('rem_brut', String(Math.round(p.salaireMinBrut)));
          showFillBadge('Poste rempli depuis la base ✓');
        }
      );
    });
  }

  // ── Badge de confirmation ─────────────────────────────────────────────
  function showFillBadge(msg) {
    let badge = document.getElementById('srh-fill-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'srh-fill-badge';
      badge.style.cssText = 'position:fixed;top:16px;right:20px;z-index:9998;background:#D1FAE5;border:1px solid #6EE7B7;color:#065F46;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.1);transition:opacity .3s';
      document.body.appendChild(badge);
    }
    badge.textContent = msg;
    badge.style.opacity = '1';
    setTimeout(function () { badge.style.opacity = '0'; }, 2500);
  }

  // ── Init automatique selon la page ────────────────────────────────────
  async function init() {
    const page = window.location.pathname;

    // contrat.html
    if (page.includes('contrat') || document.getElementById('emp_nom')) {
      await bindEmployeur('emp_nom');
      await bindSalarie('sal_nom', 'sal_');
      await bindPoste('ctr_poste');
    }

    // conges.html
    if (page.includes('conges') || document.getElementById('nom')) {
      const db = await loadDB();
      if (db) {
        const nomInput = document.getElementById('nom');
        if (nomInput) {
          nomInput.dataset.srhAutocomplete = '1';
          nomInput.addEventListener('input', function () {
            const q = nomInput.value.trim().toLowerCase();
            if (q.length < 1) { closeDropdown(); return; }
            const matches = db.salaries.filter(function (s) {
              return s.actif !== false && (s.nom.toLowerCase().includes(q) || s.prenom.toLowerCase().includes(q));
            }).slice(0, 5);
            createDropdown(nomInput, matches,
              function (s) {
                return '<div style="font-weight:600;color:#111827">' + s.nom + ' ' + s.prenom + '</div>' +
                  '<div style="font-size:11px;color:#6B7280">' + (s.email || '') + '</div>';
              },
              function (s) {
                nomInput.value = s.nom;
                fill('prenom',  s.prenom);
                fill('email',   s.email);
                showFillBadge('Salarié rempli depuis la base ✓');
              }
            );
          });
        }
      }
    }

    // acompte.html
    if (page.includes('acompte') || document.getElementById('rem_brut')) {
      const db = await loadDB();
      if (db) {
        const nomInput = document.getElementById('nom');
        if (nomInput) {
          nomInput.dataset.srhAutocomplete = '1';
          nomInput.addEventListener('input', function () {
            const q = nomInput.value.trim().toLowerCase();
            if (q.length < 1) { closeDropdown(); return; }
            const matches = db.salaries.filter(function (s) {
              return s.actif !== false && (s.nom.toLowerCase().includes(q) || s.prenom.toLowerCase().includes(q));
            }).slice(0, 5);
            createDropdown(nomInput, matches,
              function (s) {
                return '<div style="font-weight:600;color:#111827">' + s.nom + ' ' + s.prenom + '</div>' +
                  '<div style="font-size:11px;color:#6B7280">' + (s.email || '') + '</div>';
              },
              function (s) {
                nomInput.value = s.nom;
                fill('prenom', s.prenom);
                fill('email',  s.email);
                showFillBadge('Salarié rempli depuis la base ✓');
              }
            );
          });
        }
      }
    }
  }

  // Exposer l'API publique
  window.SynapseDB = {
    load:    loadDB,
    save:    saveDB,
    init:    init,
    fill:    fill,
  };

  // Auto-démarrage
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
