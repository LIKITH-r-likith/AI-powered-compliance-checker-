# backend/clause_engine.py
import os, re, hashlib
try:
    import openai
except Exception:
    openai = None

# Clause keywords map (expandable)
CLAUSE_KEYWORDS = {
    "Data Privacy Protection Right": ["data privacy","data protection","data subject rights","privacy rights","right to erasure","right to access"],
    "Breach Notification": ["breach","security breach","notify","notification","data breach","breach notification"],
    "Data Processing Agreement": ["data processing agreement","dpa","data processor","data controller"],
    "Sub-Processor Authorization": ["sub-processor","subprocessor","sub processor","sub-processor authorization"],
    "Permitted Uses and Disclosures": ["permitted use","permitted uses","disclosures","permitted disclosures"],
    "GDPR Compliance": ["gdpr","general data protection regulation","data controller","data processor"],
    "HIPAA": ["hipaa","protected health information","phi","health information"]
}

# severity / default risk per clause (0-100)
DEFAULT_SEVERITY = {
    "Data Privacy Protection Right": 95,
    "Breach Notification": 90,
    "Data Processing Agreement": 85,
    "Sub-Processor Authorization": 70,
    "Permitted Uses and Disclosures": 60,
    "GDPR Compliance": 80,
    "HIPAA": 75
}

def analyze_clauses(text: str) -> dict:
    """
    Detect present/missing clauses and compute a simple risk score:
    - risk_score is the maximum severity of missing clauses (0-100).
    - high_risk if >=71 (as requested).
    """
    t = (text or "").lower()
    present, missing, details = [], [], []
    for clause, keywords in CLAUSE_KEYWORDS.items():
        found = False
        for k in keywords:
            # word boundary search
            if re.search(r"\b" + re.escape(k) + r"\b", t):
                found = True
                break
        sev = DEFAULT_SEVERITY.get(clause, 50)
        if found:
            present.append(clause)
            details.append({"clause": clause, "status": "present", "severity": sev})
        else:
            missing.append(clause)
            details.append({"clause": clause, "status": "missing", "severity": sev, "advice": f"Clause '{clause}' missing. Recommended severity {sev}."})

    # risk score is highest severity among missing (so a single very-critical missing clause drives high risk)
    if any(d["status"] == "missing" for d in details):
        risk_score = max(d["severity"] for d in details if d["status"] == "missing")
    else:
        risk_score = 10

    risk_score = int(min(100, max(0, risk_score)))
    risk_level = "low" if risk_score <= 40 else ("medium" if risk_score <= 70 else "high")
    return {
        "present_clauses": present,
        "missing_clauses": missing,
        "details": details,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_summary": f"Risk score {risk_score} ({risk_level})",
        "high_risk": (risk_level == "high")
    }

# Template fallback generator
TEMPLATES = {
    "Data Privacy Protection Right": "Data Privacy Protection Right: The Processor shall implement appropriate technical and organizational measures to protect personal data and respect data subject rights including access, rectification, erasure and portability.",
    "Breach Notification": "Breach Notification: The Processor shall notify the Controller without undue delay and no later than 72 hours after becoming aware of any personal data breach, providing details and remediation steps.",
    "Data Processing Agreement": "Data Processing Agreement: The parties agree the Processor processes personal data on behalf of the Controller and will follow documented instructions and safeguards.",
    "Sub-Processor Authorization": "Sub-Processor Authorization: The Processor will obtain prior written authorization before engaging sub-processors and remain liable for their compliance.",
    "Permitted Uses and Disclosures": "Permitted Uses and Disclosures: The Processor may only process data for agreed purposes and will not disclose to third parties except as permitted hereunder.",
    "GDPR Compliance": "GDPR Compliance: The parties will comply with EU GDPR requirements where applicable, implement appropriate technical and organizational measures, and assist with data subject rights.",
    "HIPAA": "HIPAA: The parties shall implement safeguards to protect PHI and comply with applicable HIPAA rules."
}

def suggest_clause_template(name: str) -> str:
    return TEMPLATES.get(name, f"Suggested clause for {name} — please review and adapt to your jurisdiction.")

def generate_clause_openai(name: str, context: str = None) -> str:
    """
    Use OpenAI if OPENAI_API_KEY is set and openai package available.
    Otherwise return template fallback.
    """
    key = os.getenv("OPENAI_API_KEY")
    cache = globals().setdefault("_CACHE", {})
    cache_key = hashlib.sha256((name + (context or "")).encode()).hexdigest()
    if cache_key in cache:
        return cache[cache_key]
    # Try OpenAI
    if key and openai is not None:
        try:
            openai.api_key = key
            prompt = f"Draft a clear legal clause titled '{name}'. Context: {context or 'No context provided.'}\n\nWrite a concise, professional clause suitable for inclusion in a contract."
            # use ChatCompletion if available
            try:
                resp = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role":"system","content":"You are a skilled legal drafting assistant."},{"role":"user","content":prompt}],
                    temperature=0.2,
                    max_tokens=450
                )
                out = resp.choices[0].message["content"].strip()
            except Exception:
                # fallback to Completion API
                resp = openai.Completion.create(engine="text-davinci-003", prompt=prompt, max_tokens=450, temperature=0.2)
                out = resp.choices[0].text.strip()
            cache[cache_key] = out
            return out
        except Exception:
            # if OpenAI fails, fall back to template
            pass
    out = suggest_clause_template(name)
    cache[cache_key] = out
    return out
