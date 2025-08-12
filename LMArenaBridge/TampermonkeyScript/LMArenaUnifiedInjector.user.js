// ==UserScript==
// @name         LMArena Unified Injector (Bridge + Proxy Frontend)
// @namespace    https://github.com/your-org/UnifiedLMArena
// @version      0.1.0
// @description  Enhanced injector for LMArenaBridge using lmarena-proxy-style auth and resiliency.
// @author       Unified
// @match        https://lmarena.ai/*
// @match        https://*.lmarena.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=lmarena.ai
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function () {
  'use strict';

  // --- Config ---
  const SERVER_URL = 'ws://localhost:5102/ws';
  const REQUIRED_COOKIE = 'arena-auth-prod-v1';

  let socket;
  let isCaptureModeActive = false;
  let latestTurnstileToken = null;

  // --- Human-like Click Simulation ---
  function simulateHumanClick() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const randomOffsetX = (Math.random() - 0.5) * (viewportWidth * 0.1);
    const randomOffsetY = (Math.random() - 0.5) * (viewportHeight * 0.1);
    const clickX = Math.round(centerX + randomOffsetX);
    const clickY = Math.round(centerY + randomOffsetY);
    const finalX = Math.max(10, Math.min(viewportWidth - 10, clickX));
    const finalY = Math.max(10, Math.min(viewportHeight - 10, clickY));
    const target = document.elementFromPoint(finalX, finalY) || document.body;
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: finalX, clientY: finalY, button: 0 });
    const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: finalX, clientY: finalY, button: 0 });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: finalX, clientY: finalY, button: 0 });
    target.dispatchEvent(mouseDown);
    setTimeout(() => {
      target.dispatchEvent(mouseUp);
      setTimeout(() => target.dispatchEvent(click), Math.random() * 20 + 10);
    }, Math.random() * 50 + 50);
  }

  // --- Turnstile Token Capture (stealth) ---
  const originalCreateElement = document.createElement;
  document.createElement = function(...args) {
    const el = originalCreateElement.apply(this, args);
    if (el.tagName === 'SCRIPT') {
      const originalSetAttribute = el.setAttribute;
      el.setAttribute = function(name, value) {
        originalSetAttribute.call(this, name, value);
        if (name === 'src' && value && value.includes('challenges.cloudflare.com/turnstile')) {
          el.addEventListener('load', function() {
            if (window.turnstile) hookTurnstileRender(window.turnstile);
          });
          document.createElement = originalCreateElement; // restore immediately
        }
      };
    }
    return el;
  };

  function hookTurnstileRender(turnstile) {
    const originalRender = turnstile.render;
    turnstile.render = function(container, params) {
      const originalCallback = params.callback;
      params.callback = (token) => {
        handleTurnstileToken(token);
        if (originalCallback) return originalCallback(token);
      };
      return originalRender(container, params);
    };
  }

  function handleTurnstileToken(token) {
    latestTurnstileToken = token;
    console.log('[UnifiedInjector] Turnstile token captured');
  }

  window.onloadTurnstileCallback = function() {
    if (window.turnstile) {
      hookTurnstileRender(window.turnstile);
      setTimeout(createHiddenTurnstileWidget, 1000);
    }
  };

  function extractTurnstileSitekey() {
    return '0x4AAAAAAA65vWDmG-O_lPtT'; // known sitekey
  }

  function createHiddenTurnstileWidget() {
    try {
      const sitekey = extractTurnstileSitekey();
      const container = document.createElement('div');
      container.id = 'hidden-turnstile-widget';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '300px';
      container.style.height = '65px';
      container.style.visibility = 'hidden';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
      if (window.turnstile && window.turnstile.render) {
        window.turnstile.render(container, {
          sitekey,
          callback: handleTurnstileToken,
          'expired-callback': () => setTimeout(createHiddenTurnstileWidget, 1000),
          theme: 'light', size: 'normal'
        });
      }
    } catch (e) { console.warn('[UnifiedInjector] Failed to create widget:', e); }
  }

  async function initializeTurnstileIfNeeded() {
    try {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';
      script.async = true; script.defer = true;
      document.head.appendChild(script);
      setTimeout(simulateHumanClick, 3000 + Math.random() * 1000);
    } catch (e) { console.warn('[UnifiedInjector] init Turnstile failed:', e); }
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`; const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function checkAuthCookie() {
    return !!getCookie(REQUIRED_COOKIE);
  }

  async function waitForTurnstileToken(maxWaitTime = 60000) {
    let waited = 0; const step = 1000;
    while (waited < maxWaitTime) {
      if (checkAuthCookie()) return 'auth_cookie_available';
      if (latestTurnstileToken) return latestTurnstileToken;
      await new Promise(r => setTimeout(r, step)); waited += step;
    }
    return null;
  }

  async function performAuthentication(turnstileToken) {
    const authResponse = await fetch('https://lmarena.ai/api/sign-up', {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=UTF-8', 'Accept': '*/*'},
      body: JSON.stringify({ turnstile_token: turnstileToken })
    });
    if (!authResponse.ok) throw new Error(`Auth failed: ${authResponse.status}`);
    const authData = await authResponse.json();
    const cookieValue = `base64-${btoa(JSON.stringify(authData))}`;
    document.cookie = `${REQUIRED_COOKIE}=${cookieValue}; path=/; domain=.lmarena.ai; secure; samesite=lax`;
    // verify
    await fetch('https://lmarena.ai/', { method: 'GET', credentials: 'include' });
  }

  async function ensureAuthenticationReady(requestId) {
    if (checkAuthCookie()) return;
    let token = latestTurnstileToken;
    if (!token) {
      await initializeTurnstileIfNeeded();
      token = await waitForTurnstileToken();
      if (token === 'auth_cookie_available') return;
      if (!token) throw new Error('Auth required but token not generated');
    }
    await performAuthentication(token);
  }

  // --- WS client ---
  function connect() {
    console.log(`[UnifiedInjector] connecting: ${SERVER_URL}`);
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      console.log('[UnifiedInjector] WS connected');
      document.title = '✅ ' + document.title;
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.command) {
          if (msg.command === 'refresh' || msg.command === 'reconnect') location.reload();
          else if (msg.command === 'activate_id_capture') { isCaptureModeActive = true; document.title = '🎯 ' + document.title; }
          else if (msg.command === 'send_page_source') { await sendPageSource(); }
          return;
        }
        const { request_id, payload } = msg;
        if (!request_id || !payload) return;
        await executeFetchAndStreamBack(request_id, payload);
      } catch (e) {
        console.error('[UnifiedInjector] onmessage error:', e);
      }
    };

    socket.onclose = () => {
      console.warn('[UnifiedInjector] WS closed; reconnecting in 3s');
      if (document.title.startsWith('✅ ')) document.title = document.title.substring(2);
      setTimeout(connect, 3000);
    };
    socket.onerror = (e) => { console.error('[UnifiedInjector] WS error:', e); try { socket.close(); } catch {} };
  }

  // --- Fetch executor (Bridge expects retry-evaluation-session-message) ---
  async function executeFetchAndStreamBack(requestId, payload) {
    const { is_image_request, message_templates, target_model_id, session_id, message_id } = payload;
    if (!session_id || !message_id) {
      sendToServer(requestId, { error: 'Session or message ID missing. Run id_updater.py.' });
      sendToServer(requestId, '[DONE]'); return;
    }

    await ensureAuthenticationReady(requestId);

    const apiUrl = `/api/stream/retry-evaluation-session-message/${session_id}/messages/${message_id}`;
    const httpMethod = 'PUT';

    const newMessages = [];
    let lastMsgId = null;
    for (let i = 0; i < message_templates.length; i++) {
      const t = message_templates[i];
      const currentId = crypto.randomUUID();
      const parentIds = lastMsgId ? [lastMsgId] : [];
      const status = is_image_request ? 'success' : ((i === message_templates.length - 1) ? 'pending' : 'success');
      newMessages.push({
        role: t.role,
        content: t.content,
        id: currentId,
        evaluationId: null,
        evaluationSessionId: session_id,
        parentMessageIds: parentIds,
        experimental_attachments: t.attachments || [],
        failureReason: null,
        metadata: null,
        participantPosition: t.participantPosition || 'a',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status
      });
      lastMsgId = currentId;
    }
    const body = { messages: newMessages, modelId: target_model_id };

    // avoid intercept loop
    window.isApiBridgeRequest = true;
    try {
      const resp = await fetch(apiUrl, {
        method: httpMethod,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': '*/*' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      // 429 or HTML challenge handling
      const contentType = resp.headers.get('content-type') || '';
      if (resp.status === 429 || contentType.includes('text/html')) {
        sendToServer(requestId, { error: `Server challenge or rate limit (${resp.status}). Refreshing...` });
        try { location.reload(); } catch {}
        sendToServer(requestId, '[DONE]');
        return;
      }

      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(`Bad response ${resp.status}: ${text}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) { sendToServer(requestId, '[DONE]'); break; }
        const chunk = decoder.decode(value);
        sendToServer(requestId, chunk);
      }
    } catch (e) {
      sendToServer(requestId, { error: e.message || String(e) });
      sendToServer(requestId, '[DONE]');
    } finally { window.isApiBridgeRequest = false; }
  }

  function sendToServer(requestId, data) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ request_id: requestId, data }));
  }

  // --- Network interception for ID capture ---
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const urlArg = args[0];
    let urlString = '';
    if (urlArg instanceof Request) urlString = urlArg.url; else if (urlArg instanceof URL) urlString = urlArg.href; else if (typeof urlArg === 'string') urlString = urlArg;
    if (urlString) {
      const match = urlString.match(/\/api\/stream\/retry-evaluation-session-message\/([a-f0-9-]+)\/messages\/([a-f0-9-]+)/);
      if (match && !window.isApiBridgeRequest && isCaptureModeActive) {
        const sessionId = match[1];
        const messageId = match[2];
        isCaptureModeActive = false;
        if (document.title.startsWith('🎯 ')) document.title = document.title.substring(2);
        fetch('http://127.0.0.1:5103/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, messageId }) })
          .catch(err => console.error('[UnifiedInjector] ID update error:', err));
      }
    }
    return originalFetch.apply(this, args);
  };

  // --- Page source sender ---
  async function sendPageSource() {
    try {
      const html = document.documentElement.outerHTML;
      await fetch('http://localhost:5102/internal/update_available_models', { method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: html });
    } catch (e) { console.error('[UnifiedInjector] sendPageSource failed:', e); }
  }

  // --- Bootstrap ---
  console.log('========================================');
  console.log(' Unified LMArena Injector running');
  console.log(' - WS: ws://localhost:5102/ws');
  console.log(' - ID updater: http://localhost:5103');
  console.log('========================================');
  connect();
})();
