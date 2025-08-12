# Unified LMArena Bridge + Proxy Frontend (English)

This project integrates the LMArenaBridge backend with a lightweight monitoring frontend inspired by lmarena-proxy.

- Backend/operations: `LMArenaBridge/` (FastAPI + WebSocket; OpenAI-compatible APIs)
- Frontend/monitoring: Minimal dashboard at `/monitor` and Prometheus metrics at `/metrics`
- Browser integration: Tampermonkey userscripts under `LMArenaBridge/TampermonkeyScript/`

## Features
- OpenAI-compatible endpoints: `POST /v1/chat/completions`, `POST /v1/images/generations`, `GET /v1/models`
- WebSocket bridge to a browser userscript that performs the real LMArena requests
- ID updater flow to capture `session_id` and `message_id`
- Model discovery and optional updates from LMArena page
- Metrics at `/metrics` (Prometheus) and a simple live monitor at `/monitor`

## Quick start
1) Install dependencies:
```bash
pip3 install --user -r LMArenaBridge/requirements.txt --break-system-packages
```

2) Run backend:
```bash
python3 LMArenaBridge/api_server.py
```
- Health: `http://localhost:5102/health`
- Models: `http://localhost:5102/v1/models` (populate `LMArenaBridge/models.json` first)
- Monitor: `http://localhost:5102/monitor`
- Metrics: `http://localhost:5102/metrics`

3) Install Tampermonkey (browser extension), then install the userscript:
- Use `LMArenaBridge/TampermonkeyScript/LMArenaUnifiedInjector.user.js`
- It connects to `ws://localhost:5102/ws` and handles auth + request relaying

4) Capture session/message IDs:
```bash
python3 LMArenaBridge/id_updater.py
```
- Follow the prompt, then click "Retry" on the target message in LMArena to capture IDs
- IDs are written to `LMArenaBridge/config.jsonc`

5) Use your OpenAI client with base URL `http://localhost:5102/v1` and any API key if `api_key` in config is empty

## Repository layout
- `LMArenaBridge/`: backend, scripts, and userscripts (primary runtime)
- `lmarena-proxy/`: reference proxy server and original userscript; we use its ideas for monitoring/auth

See `LMArenaBridge/README_EN.md` for detailed backend documentation and `lmarena-proxy/README_EN.md` for the proxy reference.
