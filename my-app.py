import os
import secrets
import requests
import time
import uuid
import json
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, redirect, request, session, url_for, render_template, stream_with_context, Response

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_urlsafe(16))
app.config['SESSION_COOKIE_SECURE'] = False  # localhost only; set True in prod

SF_MYDOMAIN = os.environ["SF_MYDOMAIN"]
TOKEN_URL   = f"https://{SF_MYDOMAIN}/services/oauth2/token"
CLIENT_ID     = os.environ["AF_CONSUMER_KEY"]
CLIENT_SECRET = os.environ["AF_CONSUMER_SECRET"]
SCOPE         = ["api", "refresh_token", "chatbot_api", "sfap_api"]
AF_AGENT_ID = os.getenv("AF_AGENT_ID")
AF_CONTACT_SFID = os.getenv("AF_CONTACT_SFID")
AF_INSTANCE_ENDPOINT = f"https://{SF_MYDOMAIN}"
AF_SESSION_URL = f"https://api.salesforce.com/einstein/ai-agent/v1/agents/{AF_AGENT_ID}/sessions"
AF_STREAM_MESSAGE_URL_TMPL = "https://api.salesforce.com/einstein/ai-agent/v1/sessions/{af_session_id}/messages/stream"

TOKEN_LIFETIME_FALLBACK = 1800  # seconds, if `expires_in` not returned

def get_access_token():
    now = int(time.time())
    if "ACCESS_TOKEN" in session:
        if "ACCESS_TOKEN_EXPIRES_IN" in session:
            if now < session["ACCESS_TOKEN_EXPIRES_IN"]:
                return session["ACCESS_TOKEN"]

    resp = requests.post(
        TOKEN_URL,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data["access_token"]
    expires_in = int(data.get("expires_in", TOKEN_LIFETIME_FALLBACK))

    session["ACCESS_TOKEN"] = token
    session["ACCESS_TOKEN_EXPIRES_IN"] = expires_in
    return token
# end of get_access_token

def create_agentforce_session() -> tuple:

    token = get_access_token()

    payload = {
        "externalSessionKey": str(uuid.uuid4()),
        "instanceConfig": {"endpoint": AF_INSTANCE_ENDPOINT},
        "streamingCapabilities": {"chunkTypes": ["Text"]},
        "bypassUser": False,
    }
    resp = requests.post(
        AF_SESSION_URL,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    session_id = data["sessionId"]
    
    # Extract welcome message
    welcome_message = None
    if data.get("messages") and len(data["messages"]) > 0:
        welcome_message = data["messages"][0].get("message", "Hi, I'm an AI service assistant. How can I help you?")
    
    return session_id, welcome_message
# create_agentforce_session

@app.route("/send_and_reply", methods=["POST"])
def send_and_reply():
    if "AF_SESSION_ID" not in session:
        af_session_id, initial_message = create_agentforce_session()
        session["AF_SESSION_ID"] = af_session_id

    data = request.get_json()
    message = data.get("message")
    payload = {
        "message": {
            "sequenceId": int(time.time()),
            "type": "Text",
            "text": message,
        },
        "variables": [
            {
                "name": "ContactSfid",
                "type": "Text",
                "value": AF_CONTACT_SFID
            }
        ]
    }

    token = get_access_token()
    url = AF_STREAM_MESSAGE_URL_TMPL.format(af_session_id=session["AF_SESSION_ID"])
    upstream = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    def gen():
        try:
            for raw in upstream.iter_lines(decode_unicode=True):
                yield raw + '\n'
        finally:
            upstream.close()

    return Response(stream_with_context(gen()),
                    mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
# end of send_and_reply

@app.route("/")
def index():
    # user is authenticated if we’re here
    return render_template("index.html")

if __name__ == "__main__":
    app.run(host="localhost", port=8080, debug=True)