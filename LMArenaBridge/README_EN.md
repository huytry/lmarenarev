# LMArena Bridge (English)

A modern FastAPI + WebSocket bridge that lets any OpenAI-compatible client use models available on LMArena.ai. The server translates OpenAI requests to LMArena, relies on a browser userscript to perform the actual site requests, and streams responses back in OpenAI-compatible format.

## Key features
- High-performance FastAPI backend with WebSocket to a browser userscript
- OpenAI-compatible endpoints: `v1/chat/completions`, `v1/models`, `v1/images/generations`
- Full streaming support
- Optional image generation module
- Session/message ID capture via `id_updater.py`
- Optional model discovery via `model_updater.py` to create `available_models.json`
- Prometheus metrics at `/metrics` and a minimal live monitor at `/monitor`

## Configuration files
- `config.jsonc`: global settings (keys are English; comments may be localized)
  - `session_id`, `message_id`: default session/message IDs
  - `id_updater_last_mode`, `id_updater_battle_target`: default mode and battle target
  - `enable_auto_update`, `bypass_enabled`, `tavern_mode_enabled`
  - `use_default_ids_if_mapping_not_found`
  - `api_key`
- `models.json`: map public model names to LMArena internal ids
- `available_models.json`: optional reference list populated by `model_updater.py`
- `model_endpoint_map.json`: advanced per-model session/message overrides with optional mode info

## Endpoints
- `GET /v1/models`: list models based on `models.json`
- `POST /v1/chat/completions`: stream or non-stream chat completions
- `POST /v1/images/generations`: image generation (returns URLs)
- `GET /metrics`: Prometheus metrics
- `GET /monitor`: minimal monitor UI
- `WS /ws`: userscript connection
- `WS /ws/monitor`: monitor websocket

## Setup
1) Install deps:
```bash
pip3 install --user -r LMArenaBridge/requirements.txt --break-system-packages
```
2) Run server:
```bash
python3 LMArenaBridge/api_server.py
```
3) Install userscript:
- Use `TampermonkeyScript/LMArenaUnifiedInjector.user.js` in Tampermonkey
4) Capture IDs:
```bash
python3 LMArenaBridge/id_updater.py
```
- Follow prompts, then click "Retry" on a model message in LMArena to capture `session_id` and `message_id` into `config.jsonc`

## How it works
- Client -> Bridge: OpenAI-compatible requests
- Bridge -> Userscript: WebSocket tasks with `request_id` and payload
- Userscript -> LMArena: performs actual site `fetch` and streams back chunks
- Userscript -> Bridge: forwards chunks via WebSocket, Bridge formats to OpenAI

## Notes
- Populate `models.json` with the public name to id mapping you want to expose
- Use `model_endpoint_map.json` when you need per-model sessions/modes or pools
- `api_key` in config can protect the `/v1` API if desired