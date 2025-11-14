
ComplianceChecker_Final_V5 - Zentry-style Neon UI + FastAPI backend

Run locally (mac/linux):
1. python3 -m venv venv
2. source venv/bin/activate
3. pip install --upgrade pip
4. pip install -r requirements.txt
5. uvicorn backend.main:app --reload --port 8000
6. In another terminal: cd frontend && python3 -m http.server 5500
7. Open http://localhost:5500 in browser

To enable OpenAI, set OPENAI_API_KEY in environment before running backend.
To enable Slack/SendGrid/Sheets set respective env vars (see .env.example).
