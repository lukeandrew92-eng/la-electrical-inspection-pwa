(() => {
  'use strict';

  const APP_VERSION = 'final-v2-20260615';
  const STORAGE_KEY = 'laElectricalInspection.finalV2';
  const A4W = 595.28;
  const A4H = 841.89;
  const RED = [229,31,42];
  const BLACK = [9,9,10];
  const GREY = [90,94,100];
  const LIGHT = [244,244,242];
  const LINE = [205,205,205];

  const stepDefs = [
    {id:'job', label:'Job', title:'Job Details', kicker:'Step 01', lead:'Capture the property, client and inspection dates before starting the checklist.'},
    {id:'scope', label:'Scope', title:'Extent of Installation', kicker:'Step 02', lead:'Mark the areas and equipment included, not included, or not applicable.'},
    {id:'visual', label:'Visual', title:'Visual Inspection', kicker:'Step 03', lead:'Record visual inspection status and notes for each accessible item.'},
    {id:'testing', label:'Testing', title:'Electrical Testing', kicker:'Step 04', lead:'Record polarity, correct connections and earth continuity testing results.'},
    {id:'rcd', label:'RCD', title:'RCD Testing', kicker:'Step 05', lead:'Record residual-current device / safety switch push-button and time-test results.'},
    {id:'smoke', label:'Smoke', title:'Smoke Alarms + Observations', kicker:'Step 06', lead:'Record smoke alarm status plus recommendations or rectification notes.'},
    {id:'photos', label:'Photos', title:'Photo Appendix', kicker:'Step 07', lead:'Attach inspection images and captions for the client report.'},
    {id:'sign', label:'Sign', title:'Certification + Signature', kicker:'Step 08', lead:'Complete the electrician details and sign the safety check.'},
    {id:'export', label:'Export', title:'Export Client Report', kicker:'Step 09', lead:'Generate a real A4 PDF file for your client, with JSON backup kept separate.'}
  ];

  const scopeItems = ['Main switchboard','Main earthing system','Kitchen','Bathroom (main)','Other bathrooms/ensuites','Bedroom (main)','Other bedrooms','Living room','Other living areas','Laundry','Garage','Solar/battery system','Electric water heater','Dishwasher','Electric room/space heaters','Swimming pool equipment'];
  const visualItems = ['Consumers mains','Switchboards','Exposed earth electrode','Metallic water pipe bond','RCDs (Safety switches)','Circuit protection (circuit breakers / fuses)','Socket-outlets','Light fittings','Electric water heater','Air conditioners','Space heaters','Cooking equipment','Dishwasher','Exhaust fans','Ceiling fans','Washing machine/dryer','Installation wiring','Solar and other renewable systems','Swimming pool equipment','Vehicle chargers'];
  const polarityItems = ['Consumers mains','Circuit protection (circuit breakers / fuses)','RCDs (Safety switches)','Socket-outlets','Light fittings','Electric water heater','Air conditioners','Cooking equipment','Dishwasher','Solar and other renewable systems','Swimming pool equipment','Vehicle chargers'];
  const earthItems = ['Mains earth conductor','Switchboards enclosure','Metallic water pipe bond','Socket-outlets','Light fittings','Exhaust fans','Ceiling fans','Electric water heater','Air conditioners','Cooking equipment','Dishwasher','Solar and other renewable systems','Swimming pool equipment','Vehicle chargers'];

  const state = loadState();
  let autosaveTimer = null;
  let lastPdfUrl = null;
  let lastPdfBlob = null;
  let signatureCanvas = null;
  let signatureCtx = null;
  let drawing = false;

  const root = document.getElementById('formRoot');
  const nav = document.getElementById('stepNav');
  const toast = document.getElementById('toast');

  function defaultState(){
    const today = new Date().toISOString().slice(0,10);
    return {
      currentStep: 0,
      settings: {
        businessName: 'L.A Electrical Connections',
        recNumber: 'REC:26405',
        acnNumber: '',
        phone: '0437 947 142',
        email: 'INFO@LACONNECT.COM.AU',
        website: 'LACONNECT.COM.AU'
      },
      job: {
        address:'', propertyType:'', previousCheckDate:'', inspectionDate: today, nextInspectionDue:'',
        propertyManager:'', clientReference:'', rentalProvider:'', ownerPhone:'', ownerEmail:'', occupant:''
      },
      limitations: 'Inspection limited to readily accessible areas and equipment at the time of attendance. Items concealed within walls, ceilings, under floors, locked areas, inaccessible roof spaces, tenant belongings, or equipment unable to be safely isolated/accessed are excluded unless noted otherwise.',
      scope: scopeItems.map(item => ({item, status:'', notes:''})),
      visual: visualItems.map(item => ({item, status:'', notes:''})),
      polarity: polarityItems.map(item => ({item, status:'', notes:''})),
      earth: earthItems.map(item => ({item, status:'', notes:''})),
      rcd: ['Power outlets','Power outlets','Power outlets','Lighting','Lighting','Other'].map(circuit => ({circuit, push:'', time:'', notes:''})),
      smoke: {status:'', nextDue:'', notes:''},
      observations:'',
      photos: [],
      cert: {
        electricianName:'Luke Andrew', licenceNumber:'', inspectionDate: today, nextInspectionDue:'', dateSigned: today,
        statement:'I the above named licensed electrician have carried out an electrical safety check of this residential tenancy per the requirements of the Residential Tenancies Regulations 2021 and set out in the Australian/New Zealand Standard AS/NZS 3019, Electrical installations - Periodic verification, and have recorded my observations and recommendations.',
        signature:''
      },
      meta: {createdAt: new Date().toISOString(), version: APP_VERSION}
    };
  }

  function loadState(){
    try{
      const saved = localStorage.getItem(STORAGE_KEY);
      if(!saved) return defaultState();
      const parsed = JSON.parse(saved);
      return mergeDefaults(defaultState(), parsed);
    }catch(e){ return defaultState(); }
  }
  function mergeDefaults(base, incoming){
    if(!incoming || typeof incoming !== 'object') return base;
    for(const k of Object.keys(incoming)){
      if(Array.isArray(incoming[k])) base[k] = incoming[k];
      else if(incoming[k] && typeof incoming[k] === 'object' && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = mergeDefaults(base[k], incoming[k]);
      else base[k] = incoming[k];
    }
    return base;
  }
  function saveState(immediate=false){
    document.getElementById('autosaveStatus').textContent = 'Saving...';
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      document.getElementById('autosaveStatus').textContent = 'Saved';
    }, immediate ? 0 : 250);
    updateProgress();
  }
  function getPath(obj, path){ return path.split('.').reduce((a,k)=>a ? a[k] : undefined, obj); }
  function setPath(obj, path, val){ const bits=path.split('.'); let cur=obj; bits.slice(0,-1).forEach(k=>{ if(!cur[k]) cur[k]={}; cur=cur[k]; }); cur[bits.at(-1)] = val; }
  function escHtml(v){ return String(v ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function humanDate(v){ if(!v) return ''; const parts = String(v).split('-'); return parts.length===3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : v; }
  function normalStatus(s){ return ({included:'Incl', action:'Action', pass:'Pass', fail:'Fail', ni:'NI', na:'N/A', yes:'Yes', no:'No'})[s] || ''; }
  function showToast(msg){ toast.textContent = msg; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 3200); }

  function render(){
    renderNav();
    const step = stepDefs[state.currentStep];
    root.innerHTML = `<section class="step-card"><div class="step-kicker">${step.kicker}</div><h2>${step.title}</h2><div class="red-rule"></div><p class="lead">${step.lead}</p>${renderStep(step.id)}</section>`;
    bindInputs(root);
    setupStepExtras(step.id);
    updateProgress();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function renderNav(){
    const completed = completionMap();
    nav.innerHTML = stepDefs.map((s,i)=>`<button type="button" class="step-tab ${i===state.currentStep?'active':''} ${completed[s.id]?'done':''}" data-step="${i}">${s.label}</button>`).join('');
    nav.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => { state.currentStep = Number(btn.dataset.step); saveState(true); render(); }));
  }
  function renderStep(id){
    if(id==='job') return renderJob();
    if(id==='scope') return `<div class="section-bar">Areas and equipment included in the safety check</div>${renderChecklist('scope', state.scope, scopeStatuses())}<div class="section-bar">Limitations / exclusions / access notes</div><label>Limitations<textarea data-path="limitations" rows="8">${escHtml(state.limitations)}</textarea></label>`;
    if(id==='visual') return renderChecklist('visual', state.visual, visualStatuses());
    if(id==='testing') return `<div class="section-bar">Polarity and correct connections testing</div>${renderChecklist('polarity', state.polarity, testStatuses())}<div class="section-bar">Earth continuity testing</div>${renderChecklist('earth', state.earth, testStatuses())}`;
    if(id==='rcd') return renderRcd();
    if(id==='smoke') return renderSmoke();
    if(id==='photos') return renderPhotos();
    if(id==='sign') return renderSign();
    if(id==='export') return renderExport();
    return '';
  }
  function renderJob(){
    return `<div class="form-grid">
      ${input('Installation address','job.address','textarea')}
      ${input('Property type','job.propertyType','text','House, unit, townhouse, apartment...')}
      ${input('Date of previous safety check, if any','job.previousCheckDate','date')}
      ${input('Inspection date','job.inspectionDate','date')}
      ${input('Next inspection due date','job.nextInspectionDue','date')}
      ${input('Property manager / agent','job.propertyManager')}
      ${input('Client reference / report number','job.clientReference')}
      ${input('Rental provider / owner','job.rentalProvider')}
      ${input('Owner contact number','job.ownerPhone','tel')}
      ${input('Owner email','job.ownerEmail','email')}
      ${input('Occupant / tenant','job.occupant')}
    </div>`;
  }
  function input(label,path,type='text',ph=''){
    const val = getPath(state,path) || '';
    if(type==='textarea') return `<label>${label}<textarea data-path="${path}" rows="3" placeholder="${escHtml(ph)}">${escHtml(val)}</textarea></label>`;
    return `<label>${label}<input data-path="${path}" type="${type}" value="${escHtml(val)}" placeholder="${escHtml(ph)}" /></label>`;
  }
  function scopeStatuses(){ return [{k:'included',t:'Incl'},{k:'ni',t:'NI'},{k:'na',t:'N/A'}]; }
  function visualStatuses(){ return [{k:'included',t:'Incl'},{k:'action',t:'Action',cls:'action'},{k:'ni',t:'NI'},{k:'na',t:'N/A'}]; }
  function testStatuses(){ return [{k:'pass',t:'Pass'},{k:'fail',t:'Fail',cls:'fail'},{k:'ni',t:'NI'},{k:'na',t:'N/A'}]; }
  function renderChecklist(key, rows, statuses){
    return `<div class="checklist">${rows.map((r,i)=>`<div class="check-row" data-list="${key}" data-index="${i}">
      <div class="check-item">${escHtml(r.item)}</div>
      <div class="status-buttons ${statuses.length===3?'three':''}">${statuses.map(s=>`<button type="button" class="status-btn ${s.cls||''} ${r.status===s.k?'active':''}" data-status="${s.k}">${s.t}</button>`).join('')}</div>
      <input class="inline-note" data-note="1" value="${escHtml(r.notes)}" placeholder="Notes" />
    </div>`).join('')}</div>`;
  }
  function renderRcd(){
    return `<div class="section-bar">RCD / safety switch testing</div>
      <p class="warn">Each row has two separate result fields: <strong>Push-button test</strong> and <strong>Time test</strong>.</p>
      <div id="rcdRows">${state.rcd.map((r,i)=>`<div class="rcd-row" data-rcd-index="${i}">
        <div><div class="rcd-label">Circuit protected</div><input data-rcd="circuit" value="${escHtml(r.circuit)}" placeholder="Circuit protected" /></div>
        <div><div class="rcd-label">Push-button test</div><select data-rcd="push"><option value="">Select result</option><option value="pass" ${r.push==='pass'?'selected':''}>Pass</option><option value="fail" ${r.push==='fail'?'selected':''}>Fail</option></select></div>
        <div><div class="rcd-label">Time test</div><select data-rcd="time"><option value="">Select result</option><option value="pass" ${r.time==='pass'?'selected':''}>Pass</option><option value="fail" ${r.time==='fail'?'selected':''}>Fail</option></select></div>
        <button class="remove-row" type="button" data-remove-rcd="${i}">×</button>
        <input class="notes" data-rcd="notes" value="${escHtml(r.notes)}" placeholder="Notes" />
      </div>`).join('')}</div><button class="add-button" type="button" id="addRcd">+ Add RCD row</button>`;
  }
  function renderSmoke(){
    return `<div class="section-bar">Smoke Alarms</div>
      <div class="form-grid">
        <label>Are all smoke alarms correctly installed and in working condition?<select data-path="smoke.status"><option value="">Select</option><option value="yes" ${state.smoke.status==='yes'?'selected':''}>Yes</option><option value="no" ${state.smoke.status==='no'?'selected':''}>No</option></select></label>
        ${input('Next smoke alarm check due by','smoke.nextDue','date')}
      </div>
      <label style="margin-top:14px">Smoke alarm notes<textarea data-path="smoke.notes" rows="5">${escHtml(state.smoke.notes)}</textarea></label>
      <div class="section-bar">Observations and recommendations for any actions to be taken</div>
      <label>Observations / defects / recommendations<textarea data-path="observations" rows="10" placeholder="Record defects, recommendations, limitations, follow-up works, or no defects observed.">${escHtml(state.observations)}</textarea></label>`;
  }
  function renderPhotos(){
    return `<label>Attach photos<input id="photoInput" type="file" accept="image/*" capture="environment" multiple /></label>
    <p class="warn">Photos are optional. Captions will appear underneath each image in the appendix.</p>
    <div class="photo-grid">${state.photos.map((p,i)=>`<div class="photo-card" data-photo="${i}"><img src="${p.dataUrl}" alt="Inspection photo ${i+1}"><input data-caption="${i}" value="${escHtml(p.caption)}" placeholder="Caption"><button class="danger-button" type="button" data-remove-photo="${i}">Remove photo</button></div>`).join('')}</div>`;
  }
  function renderSign(){
    return `<div class="form-grid">
      ${input('Electrical safety check completed by','cert.electricianName')}
      ${input('Licence / registration number','cert.licenceNumber')}
      ${input('Inspection date','cert.inspectionDate','date')}
      ${input('Next inspection due by','cert.nextInspectionDue','date')}
      ${input('Date signed','cert.dateSigned','date')}
    </div>
    <div class="section-bar">Electric signature</div>
    <div class="signature-wrap"><canvas id="signaturePad"></canvas></div>
    <button class="secondary-button" id="clearSignature" type="button" style="width:100%;margin-top:12px">Clear Signature</button>
    <div class="section-bar">Certification statement</div>
    <label>Statement<textarea data-path="cert.statement" rows="5">${escHtml(state.cert.statement)}</textarea></label>`;
  }
  function renderExport(){
    return `<div class="export-actions">
      <button class="primary-button" id="generatePdf" type="button">Generate Client PDF</button>
      <button class="secondary-button" id="openPdf" type="button" disabled>Open PDF</button>
      <button class="secondary-button" id="downloadPdf" type="button" disabled>Download PDF</button>
      <details class="backup"><summary>Backup inspection data as JSON</summary><p class="warn">This is only a data backup for the app. It is not the client report.</p><button class="secondary-button" id="backupJson" type="button">Download JSON Backup</button></details>
      <p class="warn">Use <strong>Generate Client PDF</strong> for the client-ready A4 report. The print button is not used as the main export method.</p>
      <div class="version">App version ${APP_VERSION}</div>
    </div>`;
  }

  function bindInputs(container){
    container.querySelectorAll('[data-path]').forEach(el => {
      el.addEventListener('input', () => { setPath(state, el.dataset.path, el.value); saveState(); });
      el.addEventListener('change', () => { setPath(state, el.dataset.path, el.value); saveState(); });
    });
    container.querySelectorAll('[data-list]').forEach(row => {
      const key = row.dataset.list, i = Number(row.dataset.index);
      row.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => {
        state[key][i].status = btn.dataset.status;
        row.querySelectorAll('[data-status]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        saveState();
      }));
      const note = row.querySelector('[data-note]');
      if(note) note.addEventListener('input', () => { state[key][i].notes = note.value; saveState(); });
    });
  }
  function setupStepExtras(id){
    if(id==='rcd'){
      document.querySelectorAll('[data-rcd-index]').forEach(row => {
        const i = Number(row.dataset.rcdIndex);
        row.querySelectorAll('[data-rcd]').forEach(el => el.addEventListener('input', () => { state.rcd[i][el.dataset.rcd] = el.value; saveState(); }));
        row.querySelectorAll('[data-rcd]').forEach(el => el.addEventListener('change', () => { state.rcd[i][el.dataset.rcd] = el.value; saveState(); }));
      });
      document.querySelectorAll('[data-remove-rcd]').forEach(btn => btn.addEventListener('click', () => { state.rcd.splice(Number(btn.dataset.removeRcd),1); saveState(true); render(); }));
      document.getElementById('addRcd').addEventListener('click', () => { state.rcd.push({circuit:'',push:'',time:'',notes:''}); saveState(true); render(); });
    }
    if(id==='photos'){
      document.getElementById('photoInput').addEventListener('change', handlePhotoFiles);
      document.querySelectorAll('[data-caption]').forEach(input => input.addEventListener('input', () => { state.photos[Number(input.dataset.caption)].caption = input.value; saveState(); }));
      document.querySelectorAll('[data-remove-photo]').forEach(btn => btn.addEventListener('click', () => { state.photos.splice(Number(btn.dataset.removePhoto),1); saveState(true); render(); }));
    }
    if(id==='sign') initSignature();
    if(id==='export') setupExportButtons();
  }
  async function handlePhotoFiles(e){
    const files = [...e.target.files];
    for(const file of files){
      try{ state.photos.push({dataUrl: await fileToCompressedDataUrl(file, 1400, 0.78), caption:''}); }
      catch(err){ showToast('Could not add one photo.'); }
    }
    saveState(true); render();
  }
  function fileToCompressedDataUrl(file, maxSize=1400, quality=.8){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let {width:w,height:h}=img;
          const scale = Math.min(1, maxSize / Math.max(w,h));
          w = Math.round(w*scale); h = Math.round(h*scale);
          const c = document.createElement('canvas'); c.width=w; c.height=h;
          const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  function initSignature(){
    signatureCanvas = document.getElementById('signaturePad');
    signatureCtx = signatureCanvas.getContext('2d');
    const resize = () => {
      const rect = signatureCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const old = state.cert.signature;
      signatureCanvas.width = Math.round(rect.width*dpr); signatureCanvas.height = Math.round(260*dpr);
      signatureCanvas.style.height = '260px';
      signatureCtx.setTransform(dpr,0,0,dpr,0,0); signatureCtx.lineWidth=3; signatureCtx.lineCap='round'; signatureCtx.strokeStyle='#111';
      signatureCtx.fillStyle='#fff'; signatureCtx.fillRect(0,0,rect.width,260);
      if(old){ const img=new Image(); img.onload=()=>signatureCtx.drawImage(img,0,0,rect.width,260); img.src=old; }
    };
    resize(); setTimeout(resize,150);
    const pos = e => { const r=signatureCanvas.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
    signatureCanvas.onpointerdown = e => { drawing=true; signatureCanvas.setPointerCapture(e.pointerId); const p=pos(e); signatureCtx.beginPath(); signatureCtx.moveTo(p.x,p.y); e.preventDefault(); };
    signatureCanvas.onpointermove = e => { if(!drawing) return; const p=pos(e); signatureCtx.lineTo(p.x,p.y); signatureCtx.stroke(); e.preventDefault(); };
    const end = e => { if(!drawing) return; drawing=false; state.cert.signature = signatureCanvas.toDataURL('image/png'); saveState(); e.preventDefault(); };
    signatureCanvas.onpointerup = end; signatureCanvas.onpointercancel = end; signatureCanvas.onpointerleave = end;
    document.getElementById('clearSignature').addEventListener('click', () => { state.cert.signature=''; resize(); saveState(); });
  }

  function completionMap(){
    const filled = v => String(v||'').trim().length > 0;
    const allStatus = arr => arr.length > 0 && arr.every(x => filled(x.status));
    const rcdDone = state.rcd.length > 0 && state.rcd.every(r => !filled(r.circuit) || (filled(r.push) && filled(r.time)));
    return {
      job: filled(state.job.address) && filled(state.job.inspectionDate),
      scope: allStatus(state.scope),
      visual: allStatus(state.visual),
      testing: allStatus(state.polarity) && allStatus(state.earth),
      rcd: rcdDone,
      smoke: filled(state.smoke.status),
      photos: true,
      sign: filled(state.cert.electricianName) && filled(state.cert.licenceNumber) && filled(state.cert.signature),
      export: false
    };
  }
  function updateProgress(){
    const c = completionMap();
    const keys = ['job','scope','visual','testing','rcd','smoke','photos','sign'];
    const percent = Math.round(keys.filter(k=>c[k]).length / keys.length * 100);
    document.getElementById('completionStatus').textContent = `${percent}%`;
    document.querySelectorAll('.step-tab').forEach((b,i)=>{ const s=stepDefs[i]; if(c[s.id]) b.classList.add('done'); else b.classList.remove('done'); });
  }

  document.getElementById('prevStep').addEventListener('click', () => { state.currentStep = Math.max(0,state.currentStep-1); saveState(true); render(); });
  document.getElementById('nextStep').addEventListener('click', () => { state.currentStep = Math.min(stepDefs.length-1,state.currentStep+1); saveState(true); render(); });
  document.getElementById('saveDraft').addEventListener('click', () => { saveState(true); showToast('Draft saved on this device.'); });
  document.getElementById('settingsButton').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('settingsDrawer').addEventListener('click', e => { if(e.target.id==='settingsDrawer') closeSettings(); });
  document.getElementById('clearLocalData').addEventListener('click', () => {
    if(confirm('Start a new blank report? This clears the current inspection from this device.')){ localStorage.removeItem(STORAGE_KEY); Object.assign(state, defaultState()); saveState(true); closeSettings(); render(); showToast('New blank report started.'); }
  });
  document.getElementById('clearEverything').addEventListener('click', async () => {
    if(!confirm('Clear app data, caches and service worker? Use this only when updating the GitHub version.')) return;
    localStorage.clear();
    if('caches' in window){ const keys = await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
    if('serviceWorker' in navigator){ const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); }
    showToast('Local app data cleared. Reload the page.'); setTimeout(()=>location.reload(), 800);
  });
  function openSettings(){
    document.getElementById('settingsDrawer').classList.add('open');
    document.getElementById('settingsDrawer').setAttribute('aria-hidden','false');
    bindInputs(document.getElementById('settingsDrawer'));
    document.querySelectorAll('#settingsDrawer [data-path]').forEach(el => { el.value = getPath(state, el.dataset.path) || ''; });
  }
  function closeSettings(){ document.getElementById('settingsDrawer').classList.remove('open'); document.getElementById('settingsDrawer').setAttribute('aria-hidden','true'); saveState(true); }
  if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js?v=final-v2').catch(()=>{})); }

  function setupExportButtons(){
    document.getElementById('generatePdf').addEventListener('click', async () => {
      const btn = document.getElementById('generatePdf'); btn.disabled=true; btn.textContent='Generating PDF...';
      try{
        const blob = await buildClientPdf();
        lastPdfBlob = blob;
        if(lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);
        lastPdfUrl = URL.createObjectURL(blob);
        const filename = pdfFilename();
        const file = new File([blob], filename, {type:'application/pdf'});
        document.getElementById('openPdf').disabled=false; document.getElementById('downloadPdf').disabled=false;
        if(navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({files:[file], title:'Electrical Safety Check Report', text:'L.A Electrical Connections inspection report'}).catch(()=>{});
        }else{
          downloadBlob(blob, filename);
        }
        showToast('Client PDF generated.');
      }catch(err){ console.error(err); showToast('PDF generation failed. Try reducing photo count/size, then try again.'); }
      finally{ btn.disabled=false; btn.textContent='Generate Client PDF'; }
    });
    document.getElementById('openPdf').addEventListener('click', () => { if(lastPdfUrl) window.open(lastPdfUrl, '_blank'); });
    document.getElementById('downloadPdf').addEventListener('click', () => { if(lastPdfBlob) downloadBlob(lastPdfBlob,pdfFilename()); });
    document.getElementById('backupJson').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
      downloadBlob(blob, `${safeFilePart(state.job.address||'inspection')}-backup.json`);
    });
  }
  function safeFilePart(s){ return String(s||'inspection').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,60) || 'inspection'; }
  function pdfFilename(){ return `${safeFilePart(state.job.address||'Electrical-Safety-Check')}-Electrical-Safety-Check.pdf`; }
  function downloadBlob(blob, name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 1500); }

  // PDF generation: fixed A4 pages, no browser print pagination.
  class PdfDoc{
    constructor(){ this.pages=[]; this.images=[]; }
    addImage(img){ const name = 'Im' + (this.images.length+1); this.images.push({...img,name}); return name; }
    addPage(){ const p=[]; this.pages.push(p); return p; }
    out(){
      const objects=[]; const add=o=>{objects.push(o); return objects.length;};
      const fontReg=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      this.images.forEach(img=>{
        const bin = atob(img.data.split(',')[1]);
        img.obj = add(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream`);
      });
      const contentIds=[]; const pageIds=[];
      this.pages.forEach(p=>{ const stream = p.join('\n'); contentIds.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)); });
      const kidsPlaceholder = [];
      this.pages.forEach((p,i)=>{
        const xobjects = this.images.map(img=>`/${img.name} ${img.obj} 0 R`).join(' ');
        const res = `<< /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> /XObject << ${xobjects} >> >>`;
        const pageId = add(`<< /Type /Page /Parent PAGES 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources ${res} /Contents ${contentIds[i]} 0 R >>`);
        pageIds.push(pageId); kidsPlaceholder.push(`${pageId} 0 R`);
      });
      const pagesId = add(`<< /Type /Pages /Count ${pageIds.length} /Kids [${kidsPlaceholder.join(' ')}] >>`);
      objects.forEach((o,i)=>{ objects[i] = o.replace(/PAGES 0 R/g, `${pagesId} 0 R`); });
      const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
      let pdf='%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'; const offsets=[0];
      objects.forEach((o,i)=>{ offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${o}\nendobj\n`; });
      const xref = pdf.length; pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
      for(let i=1;i<offsets.length;i++) pdf += String(offsets[i]).padStart(10,'0') + ' 00000 n \n';
      pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const bytes = new Uint8Array(pdf.length); for(let i=0;i<pdf.length;i++) bytes[i] = pdf.charCodeAt(i) & 255;
      return new Blob([bytes], {type:'application/pdf'});
    }
  }
  function cmdColor(arr, stroke=false){ return `${(arr[0]/255).toFixed(3)} ${(arr[1]/255).toFixed(3)} ${(arr[2]/255).toFixed(3)} ${stroke?'RG':'rg'}`; }
  function sanitizeText(s){ return String(s??'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim(); }
  function pdfEsc(s){ return sanitizeText(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)'); }
  function opText(p, txt, x, y, size=8, bold=false, color=BLACK){ if(!txt && txt!==0) return; p.push(`BT ${cmdColor(color)} /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(A4H-y).toFixed(2)} Tm (${pdfEsc(txt)}) Tj ET`); }
  function opLine(p,x1,y1,x2,y2,color=LINE,w=.6){ p.push(`${cmdColor(color,true)} ${w} w ${x1.toFixed(2)} ${(A4H-y1).toFixed(2)} m ${x2.toFixed(2)} ${(A4H-y2).toFixed(2)} l S`); }
  function opRect(p,x,y,w,h,fill=null,stroke=LINE,lw=.5){ if(fill) p.push(`${cmdColor(fill)} ${x.toFixed(2)} ${(A4H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); if(stroke) p.push(`${cmdColor(stroke,true)} ${lw} w ${x.toFixed(2)} ${(A4H-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`); }
  function opImage(p,name,x,y,w,h){ p.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(A4H-y-h).toFixed(2)} cm /${name} Do Q`); }
  function wrapText(text, maxChars){
    const words = sanitizeText(text).split(' '); const lines=[]; let line='';
    for(const w of words){ if(!w) continue; const test = line ? `${line} ${w}` : w; if(test.length > maxChars && line){ lines.push(line); line=w; } else line=test; }
    if(line) lines.push(line); return lines;
  }
  function textBlock(p,text,x,y,w,size=7.5,lineH=10,maxLines=999,bold=false,color=BLACK){
    const maxChars = Math.max(8, Math.floor(w / (size*0.47)));
    const lines = wrapText(text,maxChars).slice(0,maxLines); lines.forEach((l,i)=>opText(p,l,x,y+i*lineH,size,bold,color)); return y + lines.length*lineH;
  }
  async function imgToJpeg(src, maxW=1200, bg='#ffffff'){
    return new Promise((resolve,reject)=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>{
        let w=img.naturalWidth || img.width, h=img.naturalHeight || img.height; const scale=Math.min(1,maxW/Math.max(w,h)); w=Math.round(w*scale); h=Math.round(h*scale);
        const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d'); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); resolve({data:c.toDataURL('image/jpeg',.88),width:w,height:h});
      };
      img.onerror=reject; img.src=src;
    });
  }
  async function buildClientPdf(){
    const doc = new PdfDoc();
    const headerLogo = doc.addImage(await imgToJpeg('LAELECTRICAL-LOGO-2026-REBRAND-HORIZONTAL.png',900,'#09090a'));
    const footerLogo = doc.addImage(await imgToJpeg('LAELECTRICAL-LOGO-2026-REBRAND-BLACK.png',900,'#ffffff'));
    const sig = state.cert.signature ? doc.addImage(await imgToJpeg(state.cert.signature,900,'#ffffff')) : null;
    const photoImgs=[];
    for(const ph of state.photos){ try{ photoImgs.push({img:doc.addImage(await imgToJpeg(ph.dataUrl,1100,'#ffffff')), caption:ph.caption}); }catch(e){} }

    const pageData=[];
    const addPage = (title, subtitle='Electrical Safety Check - Report') => { const p=doc.addPage(); pageData.push({p,title,subtitle}); return p; };
    const headerFooter = () => {
      const total = doc.pages.length;
      pageData.forEach((d,i)=>{
        const p=d.p;
        opRect(p,0,0,A4W,72,BLACK,null);
        opImage(p,headerLogo,42,18,190,33.7);
        opText(p,'ELECTRICAL SAFETY CHECK - REPORT',385,24,6.5,true,[245,245,245]);
        opText(p,d.title.toUpperCase(),385,42,14,true,[255,255,255]);
        opRect(p,0,72,A4W,4,RED,null);
        opLine(p,42,784,553,784,[190,190,190],.5);
        opImage(p,footerLogo,42,795,122,31);
        opText(p,'Residential Tenancies Regulations 2021 | Electrical Safety Check - Report | ESV-RTR-ESC 01.1 (April 2021)',242,811,5.4,false,[70,70,70]);
        opText(p,`Page ${i+1} of ${total}`,520,811,5.8,false,[70,70,70]);
      });
    };
    const sectionBar = (p,txt,y,w=511) => { opRect(p,42,y,w,17,BLACK,null); opRect(p,42,y,8,17,RED,null); opText(p,txt,56,y+11,7.5,true,[255,255,255]); return y+25; };
    const field = (p,label,value,x,y,w,h=34) => { opRect(p,x,y,w,h,[255,255,255],LINE,.55); opText(p,label.toUpperCase(),x+8,y+10,5.8,true,[70,70,70]); textBlock(p,value,x+8,y+22,w-16,7.6,9,2,false,BLACK); };
    const statusBox = (p,label,code,x,y) => { opRect(p,x,y,24,16,[255,255,255],[90,90,90],.7); opText(p,code,x+7,y+11,6,true,BLACK); opText(p,label,x+32,y+11,6,false,BLACK); };
    const marker = (p,txt,x,y,w=22,h=13) => { if(!txt) return; const fail = txt==='Fail' || txt==='Action'; opRect(p,x,y,w,h, fail?RED:[255,255,255], [0,0,0], .7); opText(p,txt,x+2,y+9,5.2,true, fail?[255,255,255]:BLACK); };

    // Page 1
    let p = addPage('');
    opText(p,'Residential Tenancies Regulations 2021',215,118,8,true,BLACK);
    opText(p,'ELECTRICAL SAFETY CHECK - REPORT',165,146,17,true,BLACK);
    opRect(p,252,158,90,3,RED,null);
    opRect(p,62,186,471,39,[255,255,255],LINE,.5);
    textBlock(p,'This electrical safety check is for electrical safety purposes only and is in accordance with the requirements of the Residential Tenancies Regulations 2021 and is prepared in accordance with section 2 of the Australian/New Zealand Standard AS/NZS 3019, Electrical installations - Periodic verification to confirm that the installation is not damaged or has not deteriorated so as to impair electrical safety; and to identify installation defects and departures from the requirements that may give rise to danger.',72,199,451,5.8,7,5,false,BLACK);
    let y=252; y=sectionBar(p,'A. INSTALLATION ADDRESS',y);
    field(p,'Address',state.job.address,62,y,471,36); y+=48;
    field(p,'Date of previous safety check, if any',humanDate(state.job.previousCheckDate),62,y,229,36);
    field(p,'Inspection date',humanDate(state.job.inspectionDate),304,y,229,36); y+=48;
    field(p,'Property manager / agent',state.job.propertyManager,62,y,229,36);
    field(p,'Client reference / report number',state.job.clientReference,304,y,229,36); y+=48;
    field(p,'Rental provider / owner',state.job.rentalProvider,62,y,229,36);
    field(p,'Owner contact number',state.job.ownerPhone,304,y,229,36); y+=48;
    field(p,'Owner email',state.job.ownerEmail,62,y,229,36);
    field(p,'Occupant / tenant',state.job.occupant,304,y,229,36); y+=62;
    y=sectionBar(p,'INSPECTION STATUS KEY',y);
    statusBox(p,'Included / checked','✓',62,y+8); statusBox(p,'Not included','NI',170,y+8); statusBox(p,'Not applicable','N/A',282,y+8); statusBox(p,'Testing result','Pass',402,y+8);

    // Table helpers
    function checklistTable(p, rows, x, y, w, rowH, mode='scope'){
      const cols = mode==='test' ? [w*.46,w*.09,w*.09,w*.08,w*.08,w*.20] : mode==='visual' ? [w*.46,w*.10,w*.12,w*.10,w*.10,w*.12] : [w*.48,w*.11,w*.10,w*.10,w*.21];
      const heads = mode==='test' ? ['Item','Pass','Fail','NI','N/A','Notes'] : mode==='visual' ? ['Item','Incl','Action','NI','N/A','Notes'] : ['Item','Incl','NI','N/A','Notes'];
      opRect(p,x,y,w,18,[238,238,236],LINE,.5); let cx=x;
      heads.forEach((h,i)=>{ opText(p,h,cx+4,y+12,5.8,true,[65,65,65]); if(i>0) opLine(p,cx,y,cx,y+18+rowH*rows.length,LINE,.5); cx+=cols[i]; });
      rows.forEach((r,ri)=>{ const ry=y+18+ri*rowH; opLine(p,x,ry,w+x,ry,LINE,.45); cx=x; cols.forEach((c,ci)=>{ if(ci>0) opLine(p,cx,ry,cx,ry+rowH,LINE,.45); cx+=c; }); textBlock(p,r.item,x+5,ry+10,cols[0]-8,5.8,6.5,2,false,BLACK);
        if(mode==='test'){
          const map={pass:1,fail:2,ni:3,na:4}; const m=map[r.status]; if(m){ let mx=x+cols.slice(0,m).reduce((a,b)=>a+b,0)+4; marker(p,normalStatus(r.status),mx,ry+5,22,12); }
          textBlock(p,r.notes,x+cols.slice(0,5).reduce((a,b)=>a+b,0)+4,ry+9,cols[5]-8,5.4,6.2,2,false,BLACK);
        } else if(mode==='visual'){
          const map={included:1,action:2,ni:3,na:4}; const m=map[r.status]; if(m){ let mx=x+cols.slice(0,m).reduce((a,b)=>a+b,0)+4; marker(p,normalStatus(r.status),mx,ry+5, m===2?30:22,12); }
          textBlock(p,r.notes,x+cols.slice(0,5).reduce((a,b)=>a+b,0)+4,ry+9,cols[5]-8,5.3,6.1,2,false,BLACK);
        } else {
          const map={included:1,ni:2,na:3}; const m=map[r.status]; if(m){ let mx=x+cols.slice(0,m).reduce((a,b)=>a+b,0)+4; marker(p,normalStatus(r.status),mx,ry+5,22,12); }
          textBlock(p,r.notes,x+cols.slice(0,4).reduce((a,b)=>a+b,0)+4,ry+9,cols[4]-8,5.4,6.2,2,false,BLACK);
        }
      });
      opRect(p,x,y,w,18+rowH*rows.length,null,LINE,.5);
      return y+18+rowH*rows.length;
    }
    // Page 2
    p = addPage('B. EXTENT OF INSTALLATION'); y=104;
    y=sectionBar(p,'B. EXTENT OF THE INSTALLATION AND LIMITATIONS OF THE INSPECTION AND TESTING',y);
    opRect(p,62,y,471,44,[255,255,255],LINE,.5);
    textBlock(p,'Details of those parts of the installation and limitations of the safety check covered by this certificate. Tick those parts of the installation included in the safety check - strike out those parts of the installation if not applicable - mark NI if not included in the safety check - add additional information if required.',72,y+14,451,6.2,7.5,4,false,BLACK);
    y+=66; y=sectionBar(p,'AREAS AND EQUIPMENT INCLUDED IN THE SAFETY CHECK',y);
    checklistTable(p,state.scope.slice(0,8),62,y,220,29,'scope'); checklistTable(p,state.scope.slice(8),304,y,229,29,'scope'); y+=270;
    y=sectionBar(p,'LIMITATIONS / EXCLUSIONS / ACCESS NOTES',y);
    opRect(p,62,y,471,126,[255,255,255],LINE,.5); textBlock(p,state.limitations,78,y+24,435,7.2,9.5,9,false,BLACK);

    // Page 3 visual
    p=addPage('C. VISUAL INSPECTION'); y=104; y=sectionBar(p,'C. SAFETY CHECK - VERIFIED BY VISUAL INSPECTION',y);
    textBlock(p,'As far as practicable a visual inspection of the following items has been carried out per the requirements of section 3 and 4 of AS/NZS 3019:2007 Electrical installations - Periodic Verification.',62,y+8,471,6.7,8,3,false,BLACK); y+=38;
    checklistTable(p,state.visual.slice(0,10),62,y,228,44,'visual'); checklistTable(p,state.visual.slice(10),305,y,228,44,'visual');

    // Page 4 polarity
    p=addPage('D. ELECTRICAL TESTING'); y=104; y=sectionBar(p,'POLARITY AND CORRECT CONNECTIONS TESTING',y);
    textBlock(p,'As far as practicable testing of the following items has been carried out per the requirements of section 4 of AS/NZS 3019:2007 Electrical installations - Periodic Verification.',62,y+8,471,6.7,8,3,false,BLACK); y+=38;
    checklistTable(p,state.polarity,62,y,471,40,'test');

    // Page 5 earth
    p=addPage('D. ELECTRICAL TESTING'); y=104; y=sectionBar(p,'EARTH CONTINUITY TESTING',y);
    checklistTable(p,state.earth,62,y,471,38,'test');

    // Page 6 RCD + smoke + observations
    p=addPage('D. RCD TESTING'); y=104; y=sectionBar(p,'D. SAFETY CHECK - VERIFIED BY TESTING - CONTINUED',y);
    y=rcdTable(p,state.rcd.slice(0,7),62,y,471,32); y+=16;
    y=sectionBar(p,'E. SMOKE ALARMS',y);
    opRect(p,62,y,230,80,[255,255,255],LINE,.5); textBlock(p,'All smoke alarms are correctly installed and in working condition; and have been tested according to the manufacturer\'s instructions.',72,y+18,205,8.2,10,4,true,BLACK); marker(p,state.smoke.status==='yes'?'Yes':state.smoke.status==='no'?'No':'',72,y+55,36,16);
    opRect(p,304,y,229,36,[255,255,255],LINE,.5); opText(p,'NEXT SMOKE ALARM CHECK DUE BY',312,y+11,5.6,true,GREY); opText(p,humanDate(state.smoke.nextDue),312,y+26,8,false,BLACK);
    opRect(p,304,y+44,229,80,[255,255,255],LINE,.5); opText(p,'SMOKE ALARM NOTES',312,y+55,5.6,true,GREY); textBlock(p,state.smoke.notes,312,y+68,213,6.4,7.5,7,false,BLACK);
    y+=140; y=sectionBar(p,'F. OBSERVATIONS AND RECOMMENDATIONS FOR ANY ACTIONS TO BE TAKEN',y);
    opRect(p,62,y,471,130,[255,255,255],LINE,.5);
    const obsLines = wrapText(state.observations || 'No additional observations recorded.', 105);
    obsLines.slice(0,13).forEach((l,i)=>opText(p,l,74,y+18+i*9,6.5,false,BLACK));
    let remainingObs = obsLines.slice(13);
    while(remainingObs.length){ p=addPage('F. OBSERVATIONS CONTINUED'); y=104; y=sectionBar(p,'F. OBSERVATIONS AND RECOMMENDATIONS - CONTINUED',y); opRect(p,62,y,471,620,[255,255,255],LINE,.5); remainingObs.slice(0,62).forEach((l,i)=>opText(p,l,74,y+18+i*9,6.5,false,BLACK)); remainingObs=remainingObs.slice(62); }

    // Extra RCD if needed
    if(state.rcd.length>7){ p=addPage('D. RCD TESTING CONTINUED'); y=104; y=sectionBar(p,'RCD TESTING - ADDITIONAL ROWS',y); rcdTable(p,state.rcd.slice(7),62,y,471,32); }

    // Page certification
    p=addPage('CERTIFICATION'); y=104; y=sectionBar(p,'F. ELECTRICAL SAFETY CHECK CERTIFICATION',y);
    field(p,'Electrical safety check completed by',state.cert.electricianName,62,y,230,42);
    field(p,'Licence / registration number',state.cert.licenceNumber,304,y,229,42); y+=54;
    field(p,'Inspection date',humanDate(state.cert.inspectionDate || state.job.inspectionDate),304,y,229,42);
    field(p,'Next inspection due by',humanDate(state.cert.nextInspectionDue || state.job.nextInspectionDue),304,y+52,229,42);
    field(p,'Date',humanDate(state.cert.dateSigned),304,y+104,229,42);
    opRect(p,62,y,230,146,[255,255,255],LINE,.5); opText(p,'SIGN',72,y+12,5.6,true,GREY); if(sig) opImage(p,sig,78,y+28,160,70);
    y+=166;
    opRect(p,62,y,471,92,[255,255,255],LINE,.5); textBlock(p,state.cert.statement,74,y+22,445,7.2,9.5,7,false,BLACK); y+=112;
    opRect(p,62,y,471,80,[255,255,255],LINE,.5); opText(p,'BUSINESS',74,y+13,5.8,true,GREY);
    const businessLines=[state.settings.businessName,state.settings.recNumber,state.settings.acnNumber,state.settings.phone,state.settings.email,state.settings.website].filter(Boolean);
    businessLines.forEach((l,i)=>opText(p,l,74,y+30+i*10,8,false,BLACK));

    // Photo pages 2x2
    for(let i=0;i<photoImgs.length;i+=4){ p=addPage(`PHOTO APPENDIX ${Math.floor(i/4)+1}`); y=104; y=sectionBar(p,'INSPECTION PHOTO APPENDIX',y); const cards=photoImgs.slice(i,i+4); cards.forEach((ph,j)=>{ const col=j%2,row=Math.floor(j/2); const x=62+col*244; const yy=y+row*248; opRect(p,x,yy,226,206,[255,255,255],LINE,.5); opImage(p,ph.img,x+10,yy+10,206,155); textBlock(p,ph.caption || `Inspection photo ${i+j+1}`,x+10,yy+181,206,6.5,8,2,true,BLACK); }); }

    // Final client action page
    p=addPage('NEXT STEPS'); y=118;
    opText(p,'NEXT STEPS',62,y,30,true,BLACK); opRect(p,62,y+14,110,5,RED,null); y+=48;
    textBlock(p,'Should you wish to proceed with any recommended rectification works outlined in this report, L.A Electrical Connections can prepare a formal quotation for review.',62,y,471,11,15,4,false,BLACK); y+=72;
    opRect(p,62,y,471,168,[255,255,255],LINE,.5); opRect(p,62,y,9,168,RED,null); opText(p,'PROMPT RECTIFICATION OFFER',82,y+30,15,true,BLACK);
    textBlock(p,'As a thank you for acting promptly on safety-related recommendations, a $100 discount will be applied to accepted rectification quotations approved within 48 hours of the inspection date. This offer applies to quoted electrical rectification works arising from this inspection and is subject to quotation terms, availability and scope confirmation.',82,y+58,420,10.2,14,8,false,BLACK); y+=198;
    opRect(p,62,y,471,120,[11,11,13],null); opText(p,'CONTACT L.A ELECTRICAL CONNECTIONS',82,y+30,13,true,[255,255,255]);
    [state.settings.businessName,state.settings.phone,state.settings.email,state.settings.website,state.settings.recNumber,state.settings.acnNumber].filter(Boolean).forEach((l,i)=>opText(p,l,82,y+55+i*13,9,false,[255,255,255]));

    function rcdTable(p, rows, x, y, w, rowH){
      const cols=[w*.32,w*.20,w*.20,w*.28]; const heads=['Circuit protected','Push-button test','Time test','Notes'];
      opRect(p,x,y,w,18,[238,238,236],LINE,.5); let cx=x; heads.forEach((h,i)=>{ opText(p,h,cx+4,y+12,5.8,true,[65,65,65]); if(i>0) opLine(p,cx,y,cx,y+18+rowH*rows.length,LINE,.5); cx+=cols[i]; });
      rows.forEach((r,ri)=>{ const ry=y+18+ri*rowH; opLine(p,x,ry,w+x,ry,LINE,.45); let cx=x; cols.forEach((c,ci)=>{ if(ci>0) opLine(p,cx,ry,cx,ry+rowH,LINE,.45); cx+=c; }); textBlock(p,r.circuit,x+5,ry+12,cols[0]-10,6.3,7,2,false,BLACK); marker(p,normalStatus(r.push),x+cols[0]+6,ry+8,28,13); marker(p,normalStatus(r.time),x+cols[0]+cols[1]+6,ry+8,28,13); textBlock(p,r.notes,x+cols[0]+cols[1]+cols[2]+5,ry+12,cols[3]-10,5.7,6.5,2,false,BLACK); });
      opRect(p,x,y,w,18+rowH*rows.length,null,LINE,.5); return y+18+rowH*rows.length;
    }
    headerFooter();
    return doc.out();
  }

  render();
})();
