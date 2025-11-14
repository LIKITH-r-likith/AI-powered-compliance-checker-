# backend/integrations.py
import os

def send_slack_notification(msg: str) -> bool:
    """
    Post a message to Slack if SLACK_BOT_TOKEN and SLACK_CHANNEL provided.
    Returns True if attempted (and response ok).
    """
    token = os.getenv("SLACK_BOT_TOKEN")
    channel = os.getenv("SLACK_CHANNEL")
    if not token or not channel:
        print("Slack not configured; message:", msg)
        return False
    try:
        from slack_sdk import WebClient
        client = WebClient(token=token)
        res = client.chat_postMessage(channel=channel, text=msg)
        ok = res["ok"]
        return ok
    except Exception as e:
        print("Slack error:", e)
        return False

def send_email_notification(subject: str, body: str) -> bool:
    """
    Send using SendGrid if configured.
    """
    key = os.getenv("SENDGRID_API_KEY")
    frm = os.getenv("ALERT_EMAIL_FROM")
    to = os.getenv("ALERT_EMAIL_TO")
    if not key or not frm or not to:
        print("SendGrid not configured; subject:", subject)
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        sg = SendGridAPIClient(key)
        message = Mail(from_email=frm, to_emails=to, subject=subject, plain_text_content=body)
        sg.send(message)
        return True
    except Exception as e:
        print("SendGrid error:", e)
        return False

def read_missing_clauses_from_sheet():
    """
    If GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEET_ID set, read 'MissingClauses' sheet A2:E.
    Returns list of rows or empty list.
    """
    cred = os.getenv("GOOGLE_SHEETS_CREDENTIALS")
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not cred or not sheet_id:
        return []
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        creds = Credentials.from_service_account_file(cred, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
        service = build("sheets","v4", credentials=creds)
        res = service.spreadsheets().values().get(spreadsheetId=sheet_id, range="MissingClauses!A2:E100").execute()
        return res.get("values", [])
    except Exception as e:
        print("Google Sheets error:", e)
        return []

def send_notifications(msg: str):
    ok = False
    try:
        ok = send_slack_notification(msg) or ok
    except Exception:
        pass
    try:
        ok = send_email_notification("Compliance Alert", msg) or ok
    except Exception:
        pass
    if not ok:
        # fallback: simply print to logs
        print("Notification fallback:", msg)
