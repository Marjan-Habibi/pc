/**************************************************************************
 Updated Library script - COMPLETE
**************************************************************************/

const INDEX_KEY = 'pc_capsules_index';
const CAPSULE_PREFIX = 'pc_capsule_';
const LEGACY_STORAGE_KEY = 'pocket_capsules_v1';

let capsules = [];

let capsulesRoot = null;
let modalBackdrop = null;
let modalContent = null;
let importFile = null;
let btnNew = null;

function bindDomRefs(){
  capsulesRoot = document.getElementById('capsules');
  modalBackdrop = document.getElementById('modalBackdrop');
  modalContent = document.getElementById('modalContent');
  importFile = document.getElementById('importFile');
  btnNew = document.getElementById('btnNew');

  if(modalBackdrop){
    modalBackdrop.removeEventListener('click', modalBackdrop._lc_click || (()=>{}));
    const handler = function(e){ if(e.target===modalBackdrop) hideModal(); };
    modalBackdrop.addEventListener('click', handler);
    modalBackdrop._lc_click = handler;
  }

  if(btnNew){
    btnNew.removeEventListener('click', btnNew._lc_click || (()=>{}));
    btnNew.addEventListener('click', openCreateModal);
    btnNew._lc_click = openCreateModal;
  }

  if(importFile){
    importFile.removeEventListener('change', importFile._lc_change || (()=>{}));
    importFile.addEventListener('change', handleImportFile);
    importFile._lc_change = handleImportFile;
  }
}

window.addEventListener('storage', (ev) => {
  if(ev.key === INDEX_KEY || (ev.key && ev.key.startsWith(CAPSULE_PREFIX))){
    loadFromAuthorStorage();
    if(!capsulesRoot) bindDomRefs();
    renderCards();
  }
});

(function initialLoad(){
  bindDomRefs();
  function doLoad(){
    if(!loadFromAuthorStorage()) loadFromLegacy();
    if(!capsulesRoot) bindDomRefs();
    renderCards();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', doLoad);
  } else { doLoad(); }
})();

function loadFromAuthorStorage(){
  try{
    const rawIndex = localStorage.getItem(INDEX_KEY);
    if(!rawIndex) return false;
    const index = JSON.parse(rawIndex);
    if(!Array.isArray(index)) return false;

    capsules = index.map(entry=>{
      try{
        const raw = localStorage.getItem(CAPSULE_PREFIX + entry.id);
        if(raw){
          const full = JSON.parse(raw);
          return {
            id: full.id || entry.id,
            title: full.meta?.title || entry.title || 'Untitled',
            level: full.meta?.level || entry.level || '—',
            updated: full.updatedAt ? timeAgo(full.updatedAt) : (entry.updatedAt || 'now'),
            category: full.meta?.subject || entry.subject || '—',
            quiz: (full.quiz && full.quiz.length)? String(full.quiz.length) : (entry.quiz || '—'),
            known: getKnownCount(full.id)
          };
        } else {
          return {
            id: entry.id,
            title: entry.title || 'Untitled',
            level: entry.level || '—',
            updated: entry.updatedAt ? timeAgo(entry.updatedAt) : '—',
            category: entry.subject || '—',
            quiz: entry.quiz || '—',
            known: getKnownCount(entry.id)
          };
        }
      } catch(e){
        return {
          id: entry.id,
          title: entry.title || 'Untitled',
          level: entry.level || '—',
          updated: entry.updatedAt ? timeAgo(entry.updatedAt) : '—',
          category: entry.subject || '—',
          quiz: entry.quiz || '—',
          known: getKnownCount(entry.id)
        };
      }
    });
    return true;
  } catch(e){ console.warn('loadFromAuthorStorage failed', e); return false; }
}

function loadFromLegacy(){
  try{
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if(!raw){
      capsules = [
        {id: genId(), title:'Intro to DOM', level:'Advanced', updated:'1m', category:'Web', quiz:'few', known:1},
        {id: genId(), title:'Intro to Web Basics', level:'Beginner', updated:'4m', category:'Web', quiz:'test', known:0}
      ];
      return;
    }
    capsules = JSON.parse(raw);
  } catch(e){ console.warn('loadFromLegacy failed', e); capsules=[]; }
}

function getKnownCount(capsuleId){
  try{
    const key = 'pc_progress_' + capsuleId;
    const raw = localStorage.getItem(key);
    if(!raw) return 0;
    const p = JSON.parse(raw);
    if(Array.isArray(p.knownFlashcards)) return p.knownFlashcards.length;
    if(typeof p.known === 'number') return p.known;
    if(typeof p.bestScore === 'number') return p.bestScore;
    return 0;
  } catch(e){ return 0; }
}

function renderCards(){
  if(!capsulesRoot){ console.warn('#capsules not found'); return; }
  capsulesRoot.innerHTML = '';
  if(!capsules.length){
    const empty = document.createElement('div');
    empty.className='empty';
    empty.textContent='No capsules yet — create your first capsule.';
    capsulesRoot.appendChild(empty);
    return;
  }

  capsules.forEach(c=>{
    const article = document.createElement('article'); article.className='card';
    const top = document.createElement('div');
    const meta = document.createElement('div'); meta.className='meta';
    const h3 = document.createElement('h3'); h3.textContent=c.title;
    const tags = document.createElement('div'); tags.className='tags';
    tags.textContent=`${c.level} · Updated ${c.updated}`;
    meta.appendChild(h3); meta.appendChild(tags);
    const p = document.createElement('p');
    p.style.margin='12px 0 0';
    p.style.color='var(--muted)';
    p.style.fontSize='13px';
    p.textContent=`${c.category} · Quiz: ${c.quiz} · Known cards: ${c.known}`;
    top.appendChild(meta); top.appendChild(p);

    const footer = document.createElement('div'); footer.className='footer';
    const cta = document.createElement('div'); cta.className='cta';

    const btnLearn=document.createElement('button'); btnLearn.className='small-btn learn'; btnLearn.textContent='▶ Learn'; btnLearn.dataset.id=c.id;
    btnLearn.addEventListener('click', e=>openLearnModal(e.currentTarget.dataset.id));
    const btnEdit=document.createElement('button'); btnEdit.className='small-btn edit'; btnEdit.textContent='✎ Edit'; btnEdit.dataset.id=c.id;
    btnEdit.addEventListener('click', e=>openEditModal(e.currentTarget.dataset.id));
    const btnExport=document.createElement('button'); btnExport.className='small-btn export'; btnExport.textContent='⇪ Export'; btnExport.dataset.id=c.id;
    btnExport.addEventListener('click', e=>exportOne(e.currentTarget.dataset.id));

    cta.appendChild(btnLearn); cta.appendChild(btnEdit); cta.appendChild(btnExport);

    const btnDelete=document.createElement('button'); btnDelete.className='small-btn delete'; btnDelete.textContent='Delete'; btnDelete.dataset.id=c.id;
    btnDelete.addEventListener('click', e=>deleteCapsule(e.currentTarget.dataset.id));

    footer.appendChild(cta); footer.appendChild(btnDelete);
    article.appendChild(top); article.appendChild(footer);
    capsulesRoot.appendChild(article);
  });
}

// ----- modals / CRUD -----
function openCreateModal(){
  showModal(`
    <h3>Create Capsule</h3>
    <div class="field"><label>Title</label><input id="mTitle" type="text" placeholder="e.g. Intro to CSS"></div>
    <div class="field"><label>Level</label><input id="mLevel" type="text" placeholder="Beginner / Advanced"></div>
    <div class="field"><label>Category</label><input id="mCategory" type="text" placeholder="Web"></div>
    <div class="field"><label>Quiz</label><input id="mQuiz" type="text" placeholder="few/test"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="mCancel">Cancel</button><button class="btn primary" id="mSave">Create</button></div>
  `);
  document.getElementById('mCancel').addEventListener('click', hideModal);
  document.getElementById('mSave').addEventListener('click', ()=>{
    const title=document.getElementById('mTitle').value.trim();
    if(!title){ alert('Title is required'); return; }
    const newCaps={ id: genId(), title, level:document.getElementById('mLevel').value||'—', updated:'now', category:document.getElementById('mCategory').value||'—', quiz:document.getElementById('mQuiz').value||'—', known:0 };
    capsules.unshift(newCaps);
    saveToStorage();
    renderCards();
    hideModal();
  });
}

function openEditModal(id){
  const c=capsules.find(x=>x.id===id); if(!c){ alert('Not found'); return; }
  showModal(`
    <h3>Edit Capsule</h3>
    <div class="field"><label>Title</label><input id="mTitle" type="text" value="${escapeHtml(c.title)}"></div>
    <div class="field"><label>Level</label><input id="mLevel" type="text" value="${escapeHtml(c.level)}"></div>
    <div class="field"><label>Category</label><input id="mCategory" type="text" value="${escapeHtml(c.category)}"></div>
    <div class="field"><label>Quiz</label><input id="mQuiz" type="text" value="${escapeHtml(c.quiz)}"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="mCancel">Cancel</button><button class="btn primary" id="mSave">Save</button></div>
  `);
  document.getElementById('mCancel').addEventListener('click', hideModal);
  document.getElementById('mSave').addEventListener('click', ()=>{
    c.title=document.getElementById('mTitle').value.trim()||c.title;
    c.level=document.getElementById('mLevel').value||c.level;
    c.category=document.getElementById('mCategory').value||c.category;
    c.quiz=document.getElementById('mQuiz').value||c.quiz;
    c.updated='now';
    saveToStorage();
    renderCards();
    hideModal();
  });
}

function openLearnModal(id){
  const c=capsules.find(x=>x.id===id); if(!c){ alert('Not found'); return; }
  showModal(`
    <h3>Learn — ${escapeHtml(c.title)}</h3>
    <p class="muted">Category: ${escapeHtml(c.category)} · Level: ${escapeHtml(c.level)} · Known cards: ${escapeHtml(String(c.known))}</p>
    <div style="margin-top:12px"><p style="color:var(--muted)">This is a demo learning view. In the real app you would launch the study interface here.</p></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="mClose">Close</button><button class="btn primary" id="mInc">Mark +1 Known</button></div>
  `);
  document.getElementById('mClose').addEventListener('click', hideModal);
  document.getElementById('mInc').addEventListener('click', ()=>{
    c.known=(Number(c.known)||0)+1;
    saveToStorage();
    renderCards();
    hideModal();
  });
}

function deleteCapsule(id){
  if(!confirm('Delete this capsule?')) return;
  try{
    const rawIndex=localStorage.getItem(INDEX_KEY);
    if(rawIndex){
      const idx=JSON.parse(rawIndex);
      const newIdx=idx.filter(x=>x.id!==id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(newIdx));
      localStorage.removeItem(CAPSULE_PREFIX+id);
    }
  }catch(e){ console.warn(e); }
  capsules=capsules.filter(x=>x.id!==id);
  saveToStorage();
  renderCards();
}

function exportOne(id){
  try{
    const raw=localStorage.getItem(CAPSULE_PREFIX+id);
    if(raw){
      const blob=new Blob([raw],{type:'application/json'});
      downloadBlob(blob,`${safeFileName(id)}.json`);
      return;
    }
  }catch(e){ }
  const c=capsules.find(x=>x.id===id);
  if(!c){ alert('Not found'); return; }
  const blob=new Blob([JSON.stringify(c,null,2)],{type:'application/json'});
  downloadBlob(blob,`${safeFileName(c.title)}.json`);
}

function handleImportFile(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=function(){
    try{
      const data=JSON.parse(reader.result);
      if(Array.isArray(data)){ data.forEach(item=>{ if(!item.id)item.id=genId(); }); capsules=data.concat(capsules); }
      else if(typeof data==='object'&&data!==null){ data.id=data.id||genId(); capsules.unshift(data); }
      else throw new Error('Invalid JSON');
      saveToStorage(); renderCards(); alert('Import successful');
    }catch(err){ alert('Failed to import: '+err.message); }
  };
  reader.readAsText(file);
  e.target.value='';
}

function saveToStorage(){
  try{
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(capsules));
    try{
      const rawIndex=localStorage.getItem(INDEX_KEY);
      if(rawIndex){
        const idx=JSON.parse(rawIndex);
        const map=new Map(idx.map(x=>[x.id,x]));
        capsules.forEach(c=>{
          if(map.has(c.id)){
            const e=map.get(c.id);
            e.title=c.title;
            e.subject=c.category||e.subject;
            e.level=c.level||e.level;
            e.updatedAt=new Date().toISOString();
          } else {
            map.set(c.id,{id:c.id,title:c.title,subject:c.category||'',level:c.level||'',updatedAt:new Date().toISOString()});
          }
        });
        localStorage.setItem(INDEX_KEY,JSON.stringify(Array.from(map.values())));
        capsules.forEach(c=>{
          const minimalFull={ schema:'pocket-classroom/v1', id:c.id, meta:{title:c.title,subject:c.category,level:c.level,description:''}, notes:[], flashcards:[], quiz:[], updatedAt:new Date().toISOString() };
          localStorage.setItem(CAPSULE_PREFIX+c.id,JSON.stringify(minimalFull));
        });
      }
    }catch(e){ }
  }catch(e){ console.warn('saveToStorage failed', e); }
}

function showModal(html){
  if(!modalContent||!modalBackdrop) bindDomRefs();
  if(!modalContent||!modalBackdrop) return;
  modalContent.innerHTML=html;
  modalBackdrop.style.display='flex';
  modalBackdrop.setAttribute('aria-hidden','false');
  const first=modalContent.querySelector('input, button, textarea, [tabindex]');
  if(first) first.focus();
}

function hideModal(){ if(!modalContent||!modalBackdrop) bindDomRefs(); if(!modalContent||!modalBackdrop) return; modalBackdrop.style.display='none'; modalBackdrop.setAttribute('aria-hidden','true'); modalContent.innerHTML=''; }

function genId(){ return 'c_'+Math.random().toString(36).slice(2,10); }
function downloadBlob(blob,filename){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function safeFileName(s){ return String(s).replace(/[^a-z0-9\-\_ ]/ig,'').slice(0,40).replace(/ /g,'_'); }
function timeAgo(iso){ try{ const d=new Date(iso); const diff=Math.floor((Date.now()-d.getTime())/1000); if(diff<60) return diff+'s'; if(diff<3600) return Math.floor(diff/60)+'m'; if(diff<86400) return Math.floor(diff/3600)+'h'; return Math.floor(diff/86400)+'d'; }catch(e){ return 'now'; }
