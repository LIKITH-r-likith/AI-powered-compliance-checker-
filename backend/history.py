import json
import os
from datetime import datetime

HISTORY_FILE = "data/history.json"

def load_history():
    if not os.path.exists("data"):
        os.makedirs("data")

    if not os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "w") as f:
            json.dump({"records": []}, f)

    with open(HISTORY_FILE, "r") as f:
        return json.load(f)

def save_history(record):
    history = load_history()
    history["records"].insert(0, record)  # newest first

    # limit history to last 20 samples
    history["records"] = history["records"][:20]

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def add_record(filename, risk_score, missing_count):
    entry = {
        "filename": filename,
        "risk_score": risk_score,
        "missing": missing_count,
        "timestamp": datetime.now().isoformat()
    }
    save_history(entry)
