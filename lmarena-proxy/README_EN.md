# lmarena-proxy (English summary)

This folder contains a reference reverse proxy server and an injector userscript. In our integrated solution we mainly reuse the frontend ideas (monitoring and robust browser auth) and adapt them into the Bridge backend and a unified userscript.

## What’s inside
- `proxy_server.py`: a feature-rich FastAPI server (OpenAI-compatible endpoints, persistent request manager, monitoring dashboard, Prometheus metrics)
- `lmarena_injector.user.js`: Tampermonkey userscript that connects to `/ws` and executes LMArena requests in the browser, with Turnstile auth and resilience

## Integration note
We adopted the following ideas into the Bridge backend:
- Prometheus metrics endpoint: `/metrics`
- Minimal live monitor UI: `/monitor` and `WS /ws/monitor`
- Unified userscript `LMArenaBridge/TampermonkeyScript/LMArenaUnifiedInjector.user.js` with robust Turnstile handling and request streaming

If you prefer the full proxy dashboard, we can mount it statically or run `proxy_server.py` separately; however, the Bridge backend now includes a lighter monitoring experience out of the box.