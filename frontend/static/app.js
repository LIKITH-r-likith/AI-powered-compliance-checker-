
const API_BASE = (location.hostname==='localhost' || location.hostname==='127.0.0.1') ? 'http://localhost:8000' : location.origin;
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const applyBtn = document.getElementById('applyBtn');
const results = document.getElementById('results');
const status = document.getElementById('status');
const summary = document.getElementById('summaryArea');
const riskLabel = document.getElementById('riskLabel');
const riskScore = document.getElementById('riskScore');
const riskArc = document.getElementById('riskArc');
const downloadReportBtn = document.getElementById('downloadReportBtn');
let lastAnalysis = null;
let lastFilename = null;

// draw neon arc A1
function drawArc(score=0){
  riskArc.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('width','120'); svg.setAttribute('height','120');
  const circleBg = document.createElementNS(svgNS,'path');
  const r=40, cx=50, cy=50, start=225, end= -45; // arc from 225 to -45 degrees (270deg)
  const valueAngle = (270 * (score/100));
  const theta = start - valueAngle;
  function polarToXY(centerX, centerY, radius, angleInDegrees){
    const angleInRadians = (angleInDegrees-90) * Math.PI/180.0;
    return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
  }
  const startPt = polarToXY(cx,cy,r,start);
  const endPt = polarToXY(cx,cy,r,theta);
  const largeArcFlag = valueAngle>180?1:0;
  const dBg = `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 1 1 ${polarToXY(cx,cy,r,end).x} ${polarToXY(cx,cy,r,end).y}`;
  circleBg.setAttribute('d', dBg);
  circleBg.setAttribute('fill','none');
  circleBg.setAttribute('stroke','rgba(255,255,255,0.06)');
  circleBg.setAttribute('stroke-width','6');
  svg.appendChild(circleBg);

  // foreground arc gradient
  const fg = document.createElementNS(svgNS,'path');
  const dFg = `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${endPt.x} ${endPt.y}`;
  fg.setAttribute('d', dFg);
  fg.setAttribute('fill','none');
  const gradId = 'g1';
  const defs = document.createElementNS(svgNS,'defs');
  const lin = document.createElementNS(svgNS,'linearGradient'); lin.setAttribute('id',gradId); lin.setAttribute('x1','0%'); lin.setAttribute('y1','0%'); lin.setAttribute('x2','100%'); lin.setAttribute('y2','0%');
  const stop1 = document.createElementNS(svgNS,'stop'); stop1.setAttribute('offset','0%'); stop1.setAttribute('stop-color','#00e5ff');
  const stop2 = document.createElementNS(svgNS,'stop'); stop2.setAttribute('offset','100%'); stop2.setAttribute('stop-color','#7c3aed');
  lin.appendChild(stop1); lin.appendChild(stop2); defs.appendChild(lin); svg.appendChild(defs);
  fg.setAttribute('stroke','url(#'+gradId+')');
  fg.setAttribute('stroke-width','6');
  fg.setAttribute('stroke-linecap','round');
  fg.setAttribute('filter','url(#glow)');
  svg.appendChild(fg);

  // glow filter
  const fdef = document.createElementNS(svgNS,'filter'); fdef.setAttribute('id','glow');
  const fe = document.createElementNS(svgNS,'feGaussianBlur'); fe.setAttribute('stdDeviation','3.5'); fe.setAttribute('result','coloredBlur'); fdef.appendChild(fe);
  svg.appendChild(fdef);

  riskArc.appendChild(svg);
}

// call analyze
async function analyzeFile(file){
  const fd = new FormData();
  fd.append('file', file, file.name);
  status.innerText = 'Uploading and analyzing...';
  try{
    const r = await fetch(`${API_BASE}/upload`, { method:'POST', body: fd });
    if(!r.ok){ status.innerText = 'Upload failed'; return; }
    const data = await r.json();
    lastAnalysis = data; lastFilename = file.name;
    renderResults(data);
    status.innerText = 'Analysis complete';
  }catch(e){ status.innerText = 'Error contacting backend'; console.error(e); }
}

analyzeBtn.onclick = ()=>{
  if(!fileInput.files.length){ alert('Choose a file'); return; }
  analyzeFile(fileInput.files[0]);
};

applyBtn.onclick = async ()=>{
  if(!lastAnalysis){ alert('Analyze first'); return; }
  const areas = document.querySelectorAll('textarea[data-clause]');
  const payload = {};
  areas.forEach(a=> payload[a.dataset.clause] = a.value);
  const form = new FormData();
  form.append('filename', lastFilename || 'uploaded');
  form.append('clauses', JSON.stringify(payload));
  status.innerText = 'Generating modified DOCX...';
  try{
    const r = await fetch(`${API_BASE}/apply`, { method:'POST', body: form });
    if(r.ok){
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `modified_${(lastFilename||'contract').split('.').slice(0,-1).join('.')||'contract'}.docx`; document.body.appendChild(link); link.click(); link.remove();
      status.innerText = 'Modified DOCX downloaded';
    } else { status.innerText = 'Failed to create modified file'; }
  }catch(e){ status.innerText = 'Error generating file'; console.error(e); }
};

downloadReportBtn.onclick = async ()=>{
  if(!lastAnalysis){ alert('Analyze first'); return; }
  const form = new FormData(); form.append('filename', lastFilename||'uploaded'); form.append('analysis_json', JSON.stringify(lastAnalysis));
  status.innerText = 'Generating PDF report...';
  const r = await fetch(`${API_BASE}/report`, { method:'POST', body: form });
  if(r.ok){
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `report_${(lastFilename||'contract').split('.').slice(0,-1).join('.')||'contract'}.pdf`; document.body.appendChild(link); link.click(); link.remove();
    status.innerText = 'Report downloaded';
  } else { status.innerText = 'Report failed'; }
};

function renderResults(data){
  results.innerHTML = '';
  const present = data.present_clauses || [];
  const missing = data.missing_clauses || [];
  const risk_score = data.risk_score || 0;
  const level = data.risk_level || 'low';
  summary.innerText = data.risk_summary || '';
  riskLabel.innerText = level.toUpperCase();
  riskScore.innerText = risk_score;
  drawArc(risk_score);

  const pre = document.createElement('pre'); pre.className='muted'; pre.innerText = JSON.stringify(data, null, 2);
  results.appendChild(pre);

  // missing clauses editable
  missing.forEach(c=>{
    const title = document.createElement('div'); title.innerText = c; title.style.marginTop='12px'; title.style.fontWeight='600';
    const ta = document.createElement('textarea'); ta.dataset.clause = c; ta.rows=5; ta.style.width='100%'; ta.placeholder='Generating suggestion...';
    results.appendChild(title); results.appendChild(ta);
    (async ()=>{
      try{
        const sr = await fetch(`${API_BASE}/suggest?clause=${encodeURIComponent(c)}`);
        if(sr.ok){ const j = await sr.json(); ta.value = j.suggestion || ''; } else ta.value='[no suggestion]';
      }catch(e){ ta.value='[error]'; }
    })();
  });
}
