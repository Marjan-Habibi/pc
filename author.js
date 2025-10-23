
(function(){
  const LS_INDEX = 'pc_capsules_index';
  const LS_CAP_PREFIX = 'pc_capsule_';
  const DRAFT_KEY = 'pc_author_draft';

  const $ = s => document.querySelector(s);
  const nowISO = () => (new Date()).toISOString();
  const slug = s => String(s||'').toLowerCase().replace(/[^a-z0-9\-]+/g,'-').replace(/^-|-$/g,'');

  let currentId = null;
  let autosaveTimer = null;
  let state = {
    meta: { title:'', subject:'', level:'Beginner', description:'' },
    notes: [],
    flashcards: [],
    quiz: []
  };

  // refs
  let titleEl, subjectEl, levelEl, descEl, notesArea, notesSide, flashList, flashEmpty, quizList, quizEmpty, previewArea, jsonOut;

  document.addEventListener('DOMContentLoaded', () => {
    titleEl = document.getElementById('meta-title');
    subjectEl = document.getElementById('meta-subject');
    levelEl = document.getElementById('meta-level');
    descEl = document.getElementById('meta-desc');
    notesArea = document.getElementById('notes-area');
    notesSide = document.getElementById('notes-side');
    flashList = document.getElementById('flashcards-list');
    flashEmpty = document.getElementById('flashcards-empty');
    quizList = document.getElementById('quiz-list');
    quizEmpty = document.getElementById('quiz-empty');
    previewArea = document.getElementById('preview-area');
    jsonOut = document.getElementById('json-out');

    // UI wiring
    document.getElementById('add-flashcard').addEventListener('click', ()=>{ addFlashcard(); renderFlashcards(); autoSave(); });
    document.getElementById('clear-flashcards').addEventListener('click', ()=>{ state.flashcards = []; renderFlashcards(); autoSave(); });
    document.getElementById('add-quiz').addEventListener('click', ()=>{ addQuiz(); renderQuiz(); autoSave(); });
    document.getElementById('clear-quiz').addEventListener('click', ()=>{ state.quiz = []; renderQuiz(); autoSave(); });
    document.getElementById('btn-save').addEventListener('click', onSave);
    document.getElementById('btn-export').addEventListener('click', onExport);
    document.getElementById('btn-new').addEventListener('click', resetEditor);
    document.getElementById('btn-clear-draft').addEventListener('click', ()=>{ localStorage.removeItem(DRAFT_KEY); alert('Draft cleared'); });
    document.getElementById('import-file').addEventListener('change', onImportFile);
    document.getElementById('btn-back').addEventListener('click', ()=>{ alert('Back pressed'); });

    [titleEl, subjectEl, levelEl, descEl, notesArea, notesSide].forEach(el=>{
      el.addEventListener('input', ()=>{ updateFromInputs(); autoSave(); renderPreview(); });
    });

    loadDraft();
    renderAll();
  });

  function loadDraft(){
    try{
      const raw = localStorage.getItem(DRAFT_KEY);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      Object.assign(state, parsed.state || parsed);
      currentId = parsed.id || null;
      console.log('Draft loaded');
    }catch(e){ console.warn('draft load failed', e); }
  }

  function autoSave(){
    if(autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(()=>{
      try{
        updateFromInputs();
        const payload = { id: currentId, state, updatedAt: nowISO() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        console.log('Draft autosaved');
      }catch(e){ console.warn(e); }
    }, 700);
  }

  function updateFromInputs(){
    state.meta.title = titleEl.value.trim();
    state.meta.subject = subjectEl.value.trim();
    state.meta.level = levelEl.value;
    state.meta.description = descEl.value.trim();
    state.notes = notesArea.value.split('\n').map(s=>s.trim()).filter(Boolean);
    notesSide.value = state.notes.join('\n');
  }

  function renderAll(){
    titleEl.value = state.meta.title || '';
    subjectEl.value = state.meta.subject || '';
    levelEl.value = state.meta.level || 'Beginner';
    descEl.value = state.meta.description || '';
    notesArea.value = (state.notes || []).join('\n');
    notesSide.value = (state.notes || []).join('\n');
    renderFlashcards();
    renderQuiz();
    renderPreview();
  }

  function renderPreview(){
    previewArea.textContent = state.meta.title ? `${state.meta.title} — ${state.meta.subject || ''} • ${state.meta.level}` : 'Title will appear after typing';
  }

  /* FLASHCARDS (unchanged) */
  function renderFlashcards(){
    flashList.innerHTML = '';
    const arr = state.flashcards || [];
    if(!arr.length){ flashEmpty.style.display = 'block'; return; }
    flashEmpty.style.display = 'none';
    arr.forEach((f,i)=>{
      const row = document.createElement('div'); row.className = 'flashcard-row';
      const inFront = document.createElement('input'); inFront.className='form-control'; inFront.placeholder='Front'; inFront.value = f.front||''; inFront.dataset.idx = i;
      const inBack  = document.createElement('input'); inBack.className='form-control'; inBack.placeholder='Back'; inBack.value = f.back||''; inBack.dataset.idxBack = i;
      const controls = document.createElement('div'); controls.style.display='flex'; controls.style.flexDirection='column'; controls.style.gap='6px';
      const up = document.createElement('button'); up.className='btn btn-sm btn-ghost'; up.textContent='↑'; up.dataset.idx = i;
      const down = document.createElement('button'); down.className='btn btn-sm btn-ghost'; down.textContent='↓'; down.dataset.idx = i;
      controls.appendChild(up); controls.appendChild(down);
      const del = document.createElement('button'); del.className='btn btn-sm btn-danger'; del.textContent='×'; del.dataset.del = i;
      row.appendChild(inFront); row.appendChild(inBack); row.appendChild(controls); row.appendChild(del);
      flashList.appendChild(row);

      inFront.addEventListener('input', ()=>{ state.flashcards[i].front = inFront.value; autoSave(); renderPreview(); });
      inBack.addEventListener('input', ()=>{ state.flashcards[i].back = inBack.value; autoSave(); renderPreview(); });
      up.addEventListener('click', ()=>{ if(i>0){ swap(state.flashcards,i,i-1); renderFlashcards(); autoSave(); }});
      down.addEventListener('click', ()=>{ if(i<state.flashcards.length-1){ swap(state.flashcards,i,i+1); renderFlashcards(); autoSave(); }});
      del.addEventListener('click', ()=>{ state.flashcards.splice(i,1); renderFlashcards(); autoSave(); renderPreview(); });
    });
  }

  function addFlashcard(){ state.flashcards = state.flashcards || []; state.flashcards.push({front:'', back:''}); }

  /* QUIZ: improved layout + handlers */
  function renderQuiz(){
    quizList.innerHTML = '';
    const arr = state.quiz || [];
    if(!arr.length){ quizEmpty.style.display = 'block'; return; }
    quizEmpty.style.display = 'none';
    arr.forEach((q,i)=>{
      const block = document.createElement('div'); block.className = 'quiz-block';

      // Question (large rounded input)
      const question = document.createElement('textarea');
      question.className = 'quiz-question';
      question.placeholder = 'Question';
      question.rows = 2;
      question.value = q.question || '';
      question.dataset.idx = i;

      // choices grid (A,B top, C,D bottom)
      const choicesGrid = document.createElement('div'); choicesGrid.className = 'choices-grid';
      const choiceA = document.createElement('input'); choiceA.className='choice-input'; choiceA.placeholder='Choice A'; choiceA.value = q.choices?.[0]||''; choiceA.dataset.idx = i; choiceA.dataset.choice=0;
      const choiceB = document.createElement('input'); choiceB.className='choice-input'; choiceB.placeholder='Choice B'; choiceB.value = q.choices?.[1]||''; choiceB.dataset.idx = i; choiceB.dataset.choice=1;
      const choiceC = document.createElement('input'); choiceC.className='choice-input'; choiceC.placeholder='Choice C'; choiceC.value = q.choices?.[2]||''; choiceC.dataset.idx = i; choiceC.dataset.choice=2;
      const choiceD = document.createElement('input'); choiceD.className='choice-input'; choiceD.placeholder='Choice D'; choiceD.value = q.choices?.[3]||''; choiceD.dataset.idx = i; choiceD.dataset.choice=3;
      choicesGrid.appendChild(choiceA); choicesGrid.appendChild(choiceB); choicesGrid.appendChild(choiceC); choicesGrid.appendChild(choiceD);

      // controls row: correct index, explanation, remove
      const controls = document.createElement('div'); controls.className='quiz-controls';
      const correctLabel = document.createElement('div'); correctLabel.className='small-muted'; correctLabel.textContent='Correct index (0-3)';
      const correctInput = document.createElement('input'); correctInput.className='correct-input'; correctInput.value = (q.correctIndex != null ? q.correctIndex : 0); correctInput.dataset.idx = i;
      const explain = document.createElement('input'); explain.className='explain-input'; explain.placeholder = 'Why this answer is correct...'; explain.value = q.explanation || ''; explain.dataset.idx = i;
      const removeBtn = document.createElement('button'); removeBtn.className='remove-btn'; removeBtn.textContent = 'Remove';

      controls.appendChild(correctLabel);
      controls.appendChild(correctInput);
      controls.appendChild(explain);
      controls.appendChild(removeBtn);

      block.appendChild(question);
      block.appendChild(choicesGrid);
      block.appendChild(controls);
      quizList.appendChild(block);

      // Handlers
      question.addEventListener('input', ()=>{ state.quiz[i].question = question.value; autoSave(); });
      [choiceA,choiceB,choiceC,choiceD].forEach(ch => {
        ch.addEventListener('input', ()=>{ const idx = Number(ch.dataset.idx); const c = Number(ch.dataset.choice); state.quiz[idx].choices[c] = ch.value; autoSave(); });
      });
      correctInput.addEventListener('input', ()=>{ const val = Number(correctInput.value || 0); state.quiz[i].correctIndex = isNaN(val) ? 0 : val; autoSave(); });
      explain.addEventListener('input', ()=>{ state.quiz[i].explanation = explain.value; autoSave(); });
      removeBtn.addEventListener('click', ()=>{ state.quiz.splice(i,1); renderQuiz(); autoSave(); });
    });
  }

  function addQuiz(){ state.quiz = state.quiz || []; state.quiz.push({question:'', choices:['','','',''], correctIndex:0, explanation:''}); }

  /* SAVE / EXPORT / IMPORT */
  function onSave(){
    updateFromInputs();
    const hasTitle = !!state.meta.title;
    const hasContent = (state.notes && state.notes.length) || (state.flashcards && state.flashcards.length) || (state.quiz && state.quiz.length);
    if(!hasTitle){ document.getElementById('err-title').classList.remove('d-none'); titleEl.focus(); return; } else document.getElementById('err-title').classList.add('d-none');
    if(!hasContent){ alert('Add at least one of Notes, Flashcards or Quiz.'); return; }

    if(!currentId) currentId = generateId();
    const capsule = buildCapsule();
    try{
      localStorage.setItem(LS_CAP_PREFIX + currentId, JSON.stringify(capsule));
      upsertIndex({ id: currentId, title: capsule.meta.title, subject: capsule.meta.subject, level: capsule.meta.level, updatedAt: capsule.updatedAt });
      localStorage.removeItem(DRAFT_KEY);
      jsonOut.textContent = JSON.stringify(capsule, null, 2);
      alert('Saved — Library & Learn pages can read this capsule.');
    }catch(e){ console.error(e); alert('Save failed'); }
  }

  function onExport(){
    updateFromInputs();
    const blob = new Blob([JSON.stringify(buildCapsule(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (slug(state.meta.title || 'capsule') || 'capsule') + '.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function onImportFile(e){
    const f = e.target.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = JSON.parse(reader.result);
        if(parsed.schema !== 'pocket-classroom/v1'){ alert('Invalid schema'); return; }
        if(!parsed.meta || !parsed.meta.title){ alert('Missing title'); return; }
        currentId = null;
        state.meta = parsed.meta;
        state.notes = parsed.notes || [];
        state.flashcards = parsed.flashcards || [];
        state.quiz = parsed.quiz || [];
        renderAll();
        alert('Imported into editor. Press Save to persist as new capsule.');
      }catch(err){ alert('Import failed: ' + (err.message || err)); }
    };
    reader.readAsText(f);
  }

  function resetEditor(){
    if(!confirm('Reset editor? Unsaved draft will be removed.')) return;
    currentId = null;
    state = { meta:{title:'', subject:'', level:'Beginner', description:''}, notes:[], flashcards:[], quiz:[] };
    localStorage.removeItem(DRAFT_KEY);
    renderAll();
    jsonOut.textContent = '{ /* capsule JSON appears after Save */ }';
  }

  function buildCapsule(){
    return {
      schema: 'pocket-classroom/v1',
      id: currentId || generateId(),
      meta: { ...state.meta },
      notes: state.notes || [],
      flashcards: (state.flashcards || []).map(f=>({ front: f.front || '', back: f.back || '' })),
      quiz: (state.quiz || []).map(q=>({ question: q.question || '', choices: q.choices || ['', '', '', ''], correctIndex: q.correctIndex || 0, explanation: q.explanation || '' })),
      updatedAt: nowISO()
    };
  }

  function upsertIndex(entry){
    try{
      const raw = localStorage.getItem(LS_INDEX);
      const arr = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(x=>x.id === entry.id);
      if(idx >= 0) arr[idx] = { ...arr[idx], ...entry };
      else arr.unshift(entry);
      localStorage.setItem(LS_INDEX, JSON.stringify(arr));
    }catch(e){ console.warn('index upsert failed', e); }
  }

  function generateId(){ return 'pc_' + Math.random().toString(36).slice(2,9); }
  function swap(a,i,j){ [a[i],a[j]] = [a[j],a[i]]; }

})();

