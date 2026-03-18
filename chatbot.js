// chatbot.js — Synapse RH Assistant
(function(){
'use strict';

// ── Styles ─────────────────────────────────────────────────────────────────
const css = `
#srh-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:#2E75B6;color:white;border:none;cursor:pointer;font-size:22px;box-shadow:0 4px 16px rgba(46,117,182,.4);z-index:9000;display:flex;align-items:center;justify-content:center;transition:.2s}
#srh-btn:hover{transform:scale(1.08);background:#1A4F80}
#srh-notif{position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:#DC2626;border-radius:50%;border:2px solid white;display:none}
#srh-panel{position:fixed;bottom:86px;right:24px;width:360px;height:520px;background:white;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.14);z-index:9000;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#srh-panel.open{display:flex}
#srh-head{background:#2E75B6;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}
#srh-head-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px}
#srh-head-info{flex:1}
#srh-head-name{color:white;font-size:13.5px;font-weight:600}
#srh-head-status{font-size:11px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:4px;margin-top:1px}
#srh-head-dot{width:6px;height:6px;border-radius:50%;background:#34D399}
#srh-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer;padding:4px;line-height:1}
#srh-close:hover{color:white}
#srh-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#F9FAFB}
#srh-messages::-webkit-scrollbar{width:4px}
#srh-messages::-webkit-scrollbar-track{background:transparent}
#srh-messages::-webkit-scrollbar-thumb{background:#E5E7EB;border-radius:2px}
.srh-msg{display:flex;gap:8px;max-width:90%}
.srh-msg.user{align-self:flex-end;flex-direction:row-reverse}
.srh-msg.bot{align-self:flex-start}
.srh-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px}
.srh-msg.bot .srh-avatar{background:#EBF3FC;color:#2E75B6}
.srh-msg.user .srh-avatar{background:#2E75B6;color:white}
.srh-bubble{padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.6;color:#111827}
.srh-msg.bot .srh-bubble{background:white;border:1px solid #E5E7EB;border-bottom-left-radius:3px}
.srh-msg.user .srh-bubble{background:#2E75B6;color:white;border-bottom-right-radius:3px}
.srh-typing{display:flex;gap:4px;align-items:center;padding:10px 14px}
.srh-dot{width:7px;height:7px;border-radius:50%;background:#9CA3AF;animation:srhbounce .8s infinite}
.srh-dot:nth-child(2){animation-delay:.15s}
.srh-dot:nth-child(3){animation-delay:.3s}
@keyframes srhbounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
#srh-suggestions{padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid #F3F4F6;background:white;flex-shrink:0}
.srh-chip{padding:5px 11px;background:#F3F4F6;border:none;border-radius:99px;font-size:11.5px;cursor:pointer;color:#374151;transition:.15s}
.srh-chip:hover{background:#EBF3FC;color:#2E75B6}
#srh-footer{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #E5E7EB;background:white;flex-shrink:0}
#srh-input{flex:1;border:1px solid #E5E7EB;border-radius:99px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit;color:#111827}
#srh-input:focus{border-color:#2E75B6}
#srh-send{width:34px;height:34px;border-radius:50%;background:#2E75B6;border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s}
#srh-send:hover{background:#1A4F80}
#srh-send:disabled{opacity:.4;cursor:not-allowed}
#srh-api-bar{padding:8px 12px;background:#FFFBEB;border-bottom:1px solid #FCD34D;display:flex;align-items:center;gap:8px;flex-shrink:0;font-size:11.5px;color:#92400E}
#srh-api-bar input{flex:1;padding:5px 9px;border:1px solid #FCD34D;border-radius:6px;font-size:11.5px;background:white;font-family:monospace;color:#111827}
#srh-api-bar input:focus{outline:none;border-color:#2E75B6}
`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

// ── HTML ───────────────────────────────────────────────────────────────────
const html = `
<button id="srh-btn" onclick="window._srh.toggle()">
  💬<span id="srh-notif"></span>
</button>

<div id="srh-panel">
  <div id="srh-head">
    <div id="srh-head-avatar">🤖</div>
    <div id="srh-head-info">
      <div id="srh-head-name">Assistant Synapse RH</div>
      <div id="srh-head-status"><span id="srh-head-dot"></span> En ligne</div>
    </div>
    <button id="srh-close" onclick="window._srh.toggle()">×</button>
  </div>
  <div id="srh-api-bar" id="srh-api-bar">
    <span>🔑</span>
    <input type="password" id="srh-key" placeholder="Clé API sk-ant-..." />
  </div>
  <div id="srh-messages"></div>
  <div id="srh-suggestions">
    <button class="srh-chip" onclick="window._srh.send('Comment poser des congés ?')">Poser des congés</button>
    <button class="srh-chip" onclick="window._srh.send('Comment faire une demande d\'acompte ?')">Demande d'acompte</button>
    <button class="srh-chip" onclick="window._srh.send('Quels types de contrats sont disponibles ?')">Types de contrats</button>
    <button class="srh-chip" onclick="window._srh.send('Comment suivre mes demandes ?')">Suivre mes demandes</button>
  </div>
  <div id="srh-footer">
    <input id="srh-input" placeholder="Posez votre question RH…" onkeydown="if(event.key==='Enter')window._srh.send()" />
    <button id="srh-send" onclick="window._srh.send()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>
`;

const wrapper = document.createElement('div');
wrapper.innerHTML = html;
document.body.appendChild(wrapper);

// ── Logic ──────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'assistant RH de la plateforme Synapse RH. Tu aides les collaborateurs et les managers à utiliser la plateforme et à répondre à leurs questions RH.

La plateforme Synapse RH propose :
- Un formulaire de génération de contrat de travail (CDI, CDD, alternance…) avec génération IA
- Un formulaire de demande de congés (annuels, RTT, maladie, maternité, paternité, sans solde, événement familial, formation)
- Un formulaire de demande d'acompte sur salaire avec plan de remboursement
- Un dashboard BI pour les managers permettant de voir toutes les demandes et de les valider ou refuser

Règles de validation :
- Les congés et acomptes soumis ont le statut "En attente" jusqu'à validation par le manager dans le dashboard
- Les managers peuvent Accorder ou Refuser chaque demande depuis l'onglet "À valider"
- Un acompte est légalement limité à 50% du salaire net mensuel (Art. L3242-1 du Code du travail)
- Les demandes de congés doivent être soumises au moins 2 semaines à l'avance

Réponds en français, de manière concise et utile. Si la question ne concerne pas Synapse RH ou les RH en général, redirige poliment vers les sujets RH. Utilise des émojis avec parcimonie pour rendre les réponses plus lisibles.`;

let history = [];
let isTyping = false;
let open = false;

// Restore API key
const savedKey = localStorage.getItem('synapse_apikey') || '';
const keyInput = document.getElementById('srh-key');
if(savedKey) keyInput.value = savedKey;
keyInput.addEventListener('input', function(){ localStorage.setItem('synapse_apikey', this.value); });

function toggle(){
  open = !open;
  const panel = document.getElementById('srh-panel');
  if(open){
    panel.classList.add('open');
    document.getElementById('srh-notif').style.display = 'none';
    if(history.length === 0) addBotMessage("Bonjour 👋 Je suis votre assistant Synapse RH. Comment puis-je vous aider aujourd'hui ?");
    setTimeout(function(){ document.getElementById('srh-input').focus(); }, 100);
  } else {
    panel.classList.remove('open');
  }
}

function scrollBottom(){
  const msgs = document.getElementById('srh-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

function addBotMessage(text){
  history.push({role:'assistant', content:text});
  const msgs = document.getElementById('srh-messages');
  const div = document.createElement('div');
  div.className = 'srh-msg bot';
  div.innerHTML = '<div class="srh-avatar">S</div><div class="srh-bubble">'+text.replace(/\n/g,'<br>')+'</div>';
  msgs.appendChild(div);
  scrollBottom();
}

function addUserMessage(text){
  const msgs = document.getElementById('srh-messages');
  const div = document.createElement('div');
  div.className = 'srh-msg user';
  div.innerHTML = '<div class="srh-avatar">👤</div><div class="srh-bubble">'+text+'</div>';
  msgs.appendChild(div);
  scrollBottom();
}

function showTyping(){
  const msgs = document.getElementById('srh-messages');
  const div = document.createElement('div');
  div.className = 'srh-msg bot';
  div.id = 'srh-typing-indicator';
  div.innerHTML = '<div class="srh-avatar">S</div><div class="srh-bubble srh-typing"><div class="srh-dot"></div><div class="srh-dot"></div><div class="srh-dot"></div></div>';
  msgs.appendChild(div);
  scrollBottom();
}

function hideTyping(){
  const el = document.getElementById('srh-typing-indicator');
  if(el) el.remove();
}

async function send(forcedText){
  const input = document.getElementById('srh-input');
  const text = (forcedText || input.value).trim();
  if(!text || isTyping) return;

  const apiKey = (document.getElementById('srh-key').value || localStorage.getItem('synapse_apikey') || '').trim();
  if(!apiKey){
    const apiBar = document.getElementById('srh-api-bar');
    apiBar.style.background = '#FEE2E2';
    apiBar.style.borderColor = '#FECACA';
    setTimeout(function(){ apiBar.style.background=''; apiBar.style.borderColor=''; }, 2000);
    document.getElementById('srh-key').focus();
    return;
  }

  input.value = '';
  document.getElementById('srh-send').disabled = true;
  isTyping = true;

  // Hide suggestions after first message
  document.getElementById('srh-suggestions').style.display = 'none';

  addUserMessage(text);
  history.push({role:'user', content:text});
  showTyping();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: history.slice(-10)
      })
    });
    const data = await res.json();
    hideTyping();
    if(data.error) throw new Error(data.error.message);
    const reply = data.content.find(function(b){ return b.type==='text'; });
    if(reply) addBotMessage(reply.text);
  } catch(e) {
    hideTyping();
    addBotMessage('❌ Erreur : ' + e.message);
    history.pop();
  }

  isTyping = false;
  document.getElementById('srh-send').disabled = false;
  document.getElementById('srh-input').focus();
}

window._srh = { toggle: toggle, send: send };

// Show notif badge after 3s if panel not open
setTimeout(function(){
  if(!open){
    document.getElementById('srh-notif').style.display = 'block';
  }
}, 3000);

})();
