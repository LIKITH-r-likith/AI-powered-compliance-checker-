# backend/extractor.py
"""
Simple extractor for MVP:
- If file looks like PDF, returns simple text placeholder using pymupdf if available.
- If DOCX, uses python-docx to read paragraphs.
- If TXT, decodes bytes.
This is intentionally robust and non-failing (won't crash on unknown files).
"""
import io
import os

def extract_text_from_bytes(data: bytes, filename: str) -> str:
    name = (filename or "").lower()
    text = ""
    try:
        if name.endswith(".pdf"):
            # Try PyMuPDF (fitz) if installed, fallback to bytes decode
            try:
                import fitz
                doc = fitz.open(stream=data, filetype="pdf")
                pages = []
                for p in doc:
                    pages.append(p.get_text("text"))
                text = "\n".join(pages)
            except Exception:
                # fallback: try simple decode (may be noisy)
                text = data.decode("utf-8", errors="ignore")
        elif name.endswith(".docx"):
            try:
                from docx import Document
                bio = io.BytesIO(data)
                doc = Document(bio)
                paragraphs = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
                text = "\n".join(paragraphs)
            except Exception:
                text = data.decode("utf-8", errors="ignore")
        else:
            # txt or unknown: try decode
            text = data.decode("utf-8", errors="ignore")
    except Exception:
        try:
            text = data.decode("utf-8", errors="ignore")
        except Exception:
            text = ""
    return text or ""
