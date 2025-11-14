# backend/main.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, Response, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import os, json, logging, traceback

from .extractor import extract_text_from_bytes
from .clause_engine import analyze_clauses, generate_clause_openai
from .modifier import build_modified_docx_bytes
from .integrations import send_notifications, read_missing_clauses_from_sheet
from .reports import build_pdf_report_bytes
from .history import add_record, load_history     # <-- correct import

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("compliance_backend")

app = FastAPI(title="AI Compliance Checker Backend")

# -----------------------------------------------------
# CORS (frontend at 5500)
# -----------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

HERE = os.path.dirname(__file__)
FRONTEND_ROOT = os.path.normpath(os.path.join(HERE, "..", "frontend"))
INDEX_HTML = os.path.join(FRONTEND_ROOT, "index.html")
STATIC_DIR = os.path.join(FRONTEND_ROOT, "static")

if os.path.exists(STATIC_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# -----------------------------------------------------
# Serve Frontend
# -----------------------------------------------------
@app.get("/", response_class=HTMLResponse)
def index():
    if os.path.exists(INDEX_HTML):
        return HTMLResponse(open(INDEX_HTML, "r", encoding="utf-8").read())
    return {"status": "running"}


# -----------------------------------------------------
# UPLOAD API
# -----------------------------------------------------
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = extract_text_from_bytes(content, file.filename)

        analysis = analyze_clauses(text)

        # ⭐ FIXED — PROPER HISTORY RECORD
        add_record(
            filename=file.filename,
            risk_score=analysis.get("risk_score", 0),
            missing_count=len(analysis.get("missing_clauses", []))
        )

        try:
            rows = read_missing_clauses_from_sheet()
            if rows:
                analysis["sheet_rows"] = rows
        except Exception as e:
            logger.warning("Sheets read skipped: %s", e)

        if analysis.get("high_risk"):
            try:
                send_notifications(
                    f"High risk detected in {file.filename} — Score: {analysis.get('risk_score')}"
                )
            except Exception as e:
                logger.warning("Notification error: %s", e)

        return JSONResponse(content=analysis)

    except Exception as e:
        logger.exception("Upload error")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------
# Suggest Clause
# -----------------------------------------------------
@app.get("/suggest")
def suggest(clause: str, context: str = None):
    try:
        suggestion = generate_clause_openai(clause, context)
        return {"clause": clause, "suggestion": suggestion}
    except Exception:
        traceback.print_exc()
        raise HTTPException(500, "Suggestion failed")


# -----------------------------------------------------
# Apply Edited Clauses
# -----------------------------------------------------
@app.post("/apply")
def apply(filename: str = Form(...), clauses: str = Form("{}")):
    try:
        clauses_dict = json.loads(clauses) if clauses else {}
        out_bytes = build_modified_docx_bytes(filename, clauses_dict)
        return Response(
            content=out_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        logger.exception("Apply failed")
        raise HTTPException(500, str(e))


# -----------------------------------------------------
# PDF Report
# -----------------------------------------------------
@app.post("/report")
def report(filename: str = Form(...), analysis_json: str = Form("{}")):
    try:
        analysis = json.loads(analysis_json) if analysis_json else {}
        pdf_bytes = build_pdf_report_bytes(filename, analysis)
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        logger.exception("Report error")
        raise HTTPException(500, str(e))


# -----------------------------------------------------
# HISTORY API
# -----------------------------------------------------
@app.get("/history")
def history():
    return load_history()


@app.get("/health")
def health():
    return {"status": "ok"}
