# id_updater.py
#
# A one-off HTTP server that receives session information
# (DirectChat or Battle) captured by the browser userscript
# and updates config.jsonc accordingly.

import http.server
import socketserver
import json
import re
import threading
import os
import requests

# --- Config ---
HOST = "127.0.0.1"
PORT = 5103
CONFIG_PATH = 'config.jsonc'

def read_config():
    """Read and parse config.jsonc, stripping comments."""
    if not os.path.exists(CONFIG_PATH):
        print(f"❌ Error: Config file '{CONFIG_PATH}' does not exist.")
        return None
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            content = re.sub(r'//.*', '', f.read())
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            return json.loads(content)
    except Exception as e:
        print(f"❌ Failed to read/parse '{CONFIG_PATH}': {e}")
        return None

def save_config_value(key, value):
    """
    Safely update a single key in config.jsonc, preserving comments and format.
    Only supports string or number values.
    """
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        pattern = re.compile(rf'(\"{key}\"\s*:\s*\")[^\"]*(\")')
        new_content, count = pattern.subn(rf'\g<1>{value}\g<2>', content, 1)
        if count == 0:
            print(f"🤔 Warning: Key '{key}' not found in '{CONFIG_PATH}'.")
            return False
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    except Exception as e:
        print(f"❌ Error updating '{CONFIG_PATH}': {e}")
        return False

def save_session_ids(session_id, message_id):
    """Update new session/message IDs in config.jsonc."""
    print(f"\n📝 Writing IDs into '{CONFIG_PATH}'...")
    res1 = save_config_value("session_id", session_id)
    res2 = save_config_value("message_id", message_id)
    if res1 and res2:
        print("✅ Successfully updated IDs.")
        print(f"   - session_id: {session_id}")
        print(f"   - message_id: {message_id}")
    else:
        print("❌ Failed to update IDs. See errors above.")

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path == '/update':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)
                session_id = data.get('sessionId')
                message_id = data.get('messageId')
                if session_id and message_id:
                    print("\n" + "=" * 50)
                    print("🎉 Successfully captured IDs from browser!")
                    print(f"  - Session ID: {session_id}")
                    print(f"  - Message ID: {message_id}")
                    print("=" * 50)
                    save_session_ids(session_id, message_id)
                    self.send_response(200)
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(b'{"status": "success"}')
                    print("\nTask complete. Server will shut down in 1s.")
                    threading.Thread(target=self.server.shutdown).start()
                else:
                    self.send_response(400, "Bad Request")
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(b'{"error": "Missing sessionId or messageId"}')
            except Exception as e:
                self.send_response(500, "Internal Server Error")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(f'{{"error": "Internal server error: {e}"}}'.encode('utf-8'))
        else:
            self.send_response(404, "Not Found")
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        return

def run_server():
    with socketserver.TCPServer((HOST, PORT), RequestHandler) as httpd:
        print("\n" + "="*50)
        print("  🚀 Session ID Update Listener started")
        print(f"  - Listening: http://{HOST}:{PORT}")
        print("  - Operate LMArena in the browser to trigger capture.")
        print("  - Server will auto-close after successful capture.")
        print("="*50)
        httpd.serve_forever()

def notify_api_server():
    """Notify main API server to activate ID capture mode."""
    api_server_url = "http://127.0.0.1:5102/internal/start_id_capture"
    try:
        response = requests.post(api_server_url, timeout=3)
        if response.status_code == 200:
            print("✅ Notified main server to activate ID capture mode.")
            return True
        else:
            print(f"⚠️ Failed to notify main server. Status: {response.status_code}.")
            print(f"   - Error: {response.text}")
            return False
    except requests.ConnectionError:
        print("❌ Cannot connect to main API server. Ensure api_server.py is running.")
        return False
    except Exception as e:
        print(f"❌ Unexpected error notifying server: {e}")
        return False

if __name__ == "__main__":
    config = read_config()
    if not config:
        exit(1)

    # --- User selection ---
    last_mode = config.get("id_updater_last_mode", "direct_chat")
    mode_map = {"a": "direct_chat", "b": "battle"}

    prompt = f"Choose mode [a: DirectChat, b: Battle] (default: {last_mode}): "
    choice = input(prompt).lower().strip()

    mode = last_mode if not choice else mode_map.get(choice)
    if not mode:
        print(f"Invalid input. Using default: {last_mode}")
        mode = last_mode

    save_config_value("id_updater_last_mode", mode)
    print(f"Current mode: {mode.upper()}")

    if mode == 'battle':
        last_target = config.get("id_updater_battle_target", "A")
        target_prompt = f"Choose message side to update [A (required for search model) or B] (default: {last_target}): "
        target_choice = input(target_prompt).upper().strip()
        if not target_choice:
            target = last_target
        elif target_choice in ["A", "B"]:
            target = target_choice
        else:
            print(f"Invalid input. Using default: {last_target}")
            target = last_target
        save_config_value("id_updater_battle_target", target)
        print(f"Battle target: Assistant {target}")
        print("Note: Regardless of A/B, captured IDs will update the main session/message values.")

    # Notify main server before starting listener
    if notify_api_server():
        run_server()
        print("Server closed.")
    else:
        print("\nID update flow aborted because main server could not be notified.")