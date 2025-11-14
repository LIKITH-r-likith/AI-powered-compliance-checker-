# backend/reports.py
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from io import BytesIO
import datetime

def build_pdf_report_bytes(filename: str, analysis: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    normal = styles["Normal"]
    h2 = styles["Heading2"]
    elems = []
    elems.append(Paragraph("AI Compliance Checker — Report", title_style))
    elems.append(Spacer(1, 8))
    elems.append(Paragraph(f"File: {filename}", normal))
    elems.append(Paragraph(f"Generated: {datetime.datetime.utcnow().isoformat()} UTC", normal))
    elems.append(Spacer(1, 12))
    elems.append(Paragraph("Executive Summary", h2))
    elems.append(Paragraph(analysis.get("risk_summary", "No summary available."), normal))
    elems.append(Spacer(1, 8))
    elems.append(Paragraph("Risk Analysis", h2))
    # Table header
    rows = [["Clause", "Status", "Severity", "Advice"]]
    for d in analysis.get("details", []):
        rows.append([d.get("clause", ""), d.get("status", ""), str(d.get("severity", "")), d.get("advice", "")])
    table = Table(rows, colWidths=[150,80,60,220])
    table.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#173f5f")),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("ALIGN",(0,0),(-1,-1),"LEFT"),
        ("GRID",(0,0),(-1,-1),0.4,colors.grey),
    ]))
    elems.append(table)
    elems.append(Spacer(1,12))
    elems.append(Paragraph("Present Clauses", h2))
    for c in analysis.get("present_clauses", []):
        elems.append(Paragraph(f"• {c}", normal))
    elems.append(Spacer(1,8))
    elems.append(Paragraph("Missing Clauses", h2))
    for c in analysis.get("missing_clauses", []):
        elems.append(Paragraph(f"• {c}", normal))
    elems.append(Spacer(1,8))
    elems.append(Paragraph("Recommended Fixes", h2))
    for d in analysis.get("details", []):
        if d.get("status") == "missing":
            elems.append(Paragraph(f"{d.get('clause')}: {d.get('advice')}", normal))
    doc.build(elems)
    pdf = buf.getvalue()
    buf.close()
    return pdf
