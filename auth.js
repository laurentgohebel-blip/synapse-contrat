// auth.js — Synapse RH
// Authentification Supabase email + mot de passe
// À inclure sur toutes les pages protégées APRÈS supabase-storage.js

(function () {
  'use strict';

  const SB_URL = 'https://pbfhqkofzlcncynkxizz.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZmhxa29memxjbmN5bmt4aXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODg4OTgsImV4cCI6MjA4OTg2NDg5OH0.lEkC_pFJfK8pGusKIeq1nxuTOt-sgx1iM2BjxSwHsjE';
  const SESSION_KEY = 'synapse_session';
  const LOGIN_PAGE  = 'https://synapserh.fr/Connexion.html';

  // ── Helpers Supabase Auth ──────────────────────────────────────────────
  async function sbAuth(endpoint, body) {
    const res = await fetch(SB_URL + '/auth/v1/' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Erreur authentification');
    return data;
  }

  // ── Session ────────────────────────────────────────────────────────────
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isSessionValid(session) {
    if (!session || !session.access_token || !session.expires_at) return false;
    return Date.now() < session.expires_at * 1000;
  }

  // ── Refresh token ──────────────────────────────────────────────────────
  async function refreshSession(session) {
    try {
      const data = await sbAuth('token?grant_type=refresh_token', {
        refresh_token: session.refresh_token
      });
      saveSession(data);
      return data;
    } catch(e) {
      clearSession();
      return null;
    }
  }

  // ── Login ──────────────────────────────────────────────────────────────
  async function login(email, password) {
    const data = await sbAuth('token?grant_type=password', { email, password });
    saveSession(data);
    return data;
  }

  // ── Logout ─────────────────────────────────────────────────────────────
  async function logout() {
    const session = getSession();
    if (session) {
      try {
        await fetch(SB_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + session.access_token }
        });
      } catch(e) {}
    }
    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  // ── Guard : redirige vers login si non authentifié ─────────────────────
  async function guard() {
    let session = getSession();

    // Pas de session → login
    if (!session) {
      redirect();
      return false;
    }

    // Session expirée → refresh
    if (!isSessionValid(session)) {
      session = await refreshSession(session);
      if (!session) { redirect(); return false; }
    }

    // Injecter le token dans SynapseStorage si disponible
    if (window.SynapseStorage && session.access_token) {
      window._supabaseToken = session.access_token;
    }

    return session;
  }

  function redirect() {
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = LOGIN_PAGE + '?redirect=' + current;
  }

  // ── Injecter le bouton logout + nom utilisateur dans le header ─────────
  function injectUserBar(session) {
    const email = session.user && session.user.email ? session.user.email : '';
    const name  = email.split('@')[0];

    // Cherche un conteneur header existant
    const selectors = ['#srh-head', '.topbar-right', '.header-inner', '.topbar'];
    let container = null;
    for (const sel of selectors) {
      container = document.querySelector(sel);
      if (container) break;
    }

    const bar = document.createElement('div');
    bar.id = 'srh-user-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    bar.innerHTML =
      '<span style="font-size:12px;color:#9CA3AF">👤 ' + name + '</span>' +
      '<button onclick="SynapseAuth.logout()" style="padding:5px 12px;border-radius:6px;border:1px solid #E5E7EB;background:white;color:#374151;font-size:12px;cursor:pointer;font-family:inherit">Déconnexion</button>';

    if (container) {
      container.appendChild(bar);
    } else {
      // Fallback : barre fixe en haut
      bar.style.cssText += ';position:fixed;top:10px;right:16px;z-index:9000;background:white;padding:6px 12px;border-radius:8px;border:1px solid #E5E7EB;box-shadow:0 2px 8px rgba(0,0,0,.1)';
      document.body.appendChild(bar);
    }
  }

  // ── API publique ───────────────────────────────────────────────────────
  window.SynapseAuth = { login, logout, guard, getSession, isSessionValid };

  // ── Auto-guard au chargement de la page ───────────────────────────────
  document.addEventListener('DOMContentLoaded', async function () {
    // Ne pas garder la page login elle-même
    if (window.location.pathname.includes('login')) return;

    const session = await guard();
    if (session) {
      injectUserBar(session);
      // Refresh auto 5 min avant expiration
      const msUntilExpiry = session.expires_at * 1000 - Date.now();
      const refreshIn = Math.max(0, msUntilExpiry - 5 * 60 * 1000);
      setTimeout(async function () {
        await refreshSession(session);
      }, refreshIn);
    }
  });

})();
