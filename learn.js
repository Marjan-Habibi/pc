/* learn.js — connect Learn <> Author via localStorage keys:
   - pc_capsules_index  (array of {id,title,subject,level,updatedAt})
   - pc_capsule_<id>    (full capsule JSON)
   - pc_progress_<id>   (progress per capsule)
*/

// fallback demo data (kept from original file)
const demo = {
  web: {
    meta:{title:'Intro to Web Basics',subject:'Web',level:'Beginner'},
    flashcards: [
      {front: 'HTML', back: 'HyperText Markup Language — basic structure'},
      {front: 'CSS', back: 'Cascading Style Sheets — presentation'},
      {front: 'JS', back: 'JavaScript — behavior & interactivity'}
    ],
    notes: `Web = Browser + Server\n\nHTML: structure\nCSS: presentation\nJS: behavior`,
    quiz: [
      {q: 'Which language gives structure to a web page?', choices:['CSS','HTML','JS'], a:1, explanation:'HTML provides structure.'},
      {q: 'Which one is used for styling?', choices:['HTML','Node','CSS'], a:2, explanation:'CSS is used for styling.'},
      {q: 'Which adds interactivity?', choices:['JS','CSS','HTML'], a:0, explanation:'JS adds interactivity.'}
    ]
  },
  html: {
    meta:{title:'HTML Basics',subject:'HTML',level:'Beginner'},
    flashcards: [
      {front:'Tag', back:'An HTML element like <div>, <p>, <a>'},
      {front:'Attribute', back:'Extra information inside an opening tag, e.g. class="..."'},
      {front:'Doctype', back:'Declaration that tells browser HTML version'}
    ],
    notes: 'HTML basics:\n- Elements\n- Attributes\n- Semantics',
    quiz: [
      {q:'Which tag is for a paragraph?', choices:['<p>','<div>','<span>'], a:0, explanation:'<p> is the paragraph tag.'},
      {q:'Where do you put classes?', choices:['In CSS file','In attribute','In JS only'], a:1, explanation:'Classes are attributes on elements.'}
    ]
  }
};

// Keys used by Author (per project spec)
const INDEX_KEY = 'pc_capsules_index';
const CAPSULE_PREFIX = 'pc_capsule_';
const PROG_PREFIX = 'pc_progress_';

// Keep a local "capsules" map only as fallback to demo data
const capsules = demo; // original variable name preserved for compatibility in other parts

// App state (keeps structure similar to your original state)
let state = {
  mode: 'flash',
  capsuleId: 'web',
  fcIndex: 0,
  flipped: false,
  progress: { bestScore: 0, knownFlashcards: [] },
  quizState: { order: [], qIndex: 0, score: 0 },
  currentCapsule: null
};

// DOM refs (match your HTML ids)
const tabs = document.querySelectorAll('#modeTabs .nav-link');
const panes = {
  notes: document.getElementById('notesPane'),
  flash: document.getElementById('flashPane'),
  quiz: document.getElementById('quizPane')
};
const capsuleSelect = document.getElementById('capsuleSelect');
const flashcardEl = document.getElementById('flashcard');
const flashInner = document.getElementById('flashcard-inner');
const cardFront = document.getElementById('cardFront');
const cardBack = document.getElementById('cardBack');
const progressLabel = document.getElementById('progressLabel');
const mainProgress = document.getElementById('mainProgress');
const quizArea = document.getElementById('quizArea');
const exportBtn = document.getElementById('exportBtn');

// Initialize — wire events and load initial data
function init(){
  // populate capsule select from pc_capsules_index or fallback to demo keys
  populateCapsuleSelect();

  // tabs
  tabs.forEach(t=>{
    t.addEventListener('click', (e)=>{
      e.preventDefault();
      const mode = t.dataset.mode;
      switchMode(mode);
      tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
    });
  });

  // capsule change
  capsuleSelect.addEventListener('change', e=>{
    state.capsuleId = e.target.value;
    loadCapsule(state.capsuleId);
    resetStudyState();
    render();
  });

  // flash flip & keyboard
  flashcardEl.addEventListener('click', ()=> toggleFlip());
  window.addEventListener('keydown', (e)=>{
    if(e.code === 'Space' && state.mode === 'flash'){
      e.preventDefault();
      toggleFlip();
    } else if(e.code === 'ArrowRight' && state.mode === 'flash'){
      nextCard();
    } else if(e.code === 'ArrowLeft' && state.mode === 'flash'){
      prevCard();
    } else if(e.key === '['){
      cycleTab(-1);
    } else if(e.key === ']'){
      cycleTab(1);
    }
  });

  // buttons
  document.getElementById('prevBtn').addEventListener('click', prevCard);
  document.getElementById('nextBtn').addEventListener('click', nextCard);
  document.getElementById('markKnown').addEventListener('click', ()=> toggleKnown(true));
  document.getElementById('markUnknown').addEventListener('click', ()=> toggleKnown(false));
  document.getElementById('startQuizFromNotes').addEventListener('click', ()=>{ switchMode('quiz'); activateTab('quiz'); startQuiz(); });
  document.getElementById('backToFlashFromNotes').addEventListener('click', ()=>{ switchMode('flash'); activateTab('flash'); });
  document.getElementById('backToFlashFromQuiz').addEventListener('click', ()=>{ switchMode('flash'); activateTab('flash'); });
  document.getElementById('restartQuiz').addEventListener('click', ()=> startQuiz());
  exportBtn.addEventListener('click', exportCapsule);

  // storage event: update when Author saves in another tab
  window.addEventListener('storage', onStorageEvent);

  // initial load: set selection and capsule
  if(!capsuleSelect.value) {
    // if select empty (edge), add demo keys
    populateCapsuleSelect();
  }
  state.capsuleId = capsuleSelect.value || state.capsuleId;
  loadCapsule(state.capsuleId);
  resetStudyState();
  render();
}

// Populate dropdown from pc_capsules_index OR fall back to demo
function populateCapsuleSelect(){
  capsuleSelect.innerHTML = '';
  try{
    const raw = localStorage.getItem(INDEX_KEY);
    if(raw){
      const idx = JSON.parse(raw);
      if(Array.isArray(idx) && idx.length){
        idx.forEach(entry=>{
          const opt = document.createElement('option');
          opt.value = entry.id;
          opt.text = (entry.title || 'Untitled') + (entry.subject ? (' — ' + entry.subject) : '');
          capsuleSelect.add(opt);
        });
        return;
      }
    }
  }catch(e){
    console.warn('Failed to read index', e);
  }
  // fallback: demo keys
  Object.keys(capsules).forEach(k=>{
    const opt = document.createElement('option');
    opt.value = k;
    opt.text = (capsules[k].meta && capsules[k].meta.title) ? capsules[k].meta.title : k;
    capsuleSelect.add(opt);
  });
}

// Read full capsule from localStorage pc_capsule_<id> or fallback to demo
function readFullCapsule(id){
  try{
    const raw = localStorage.getItem(CAPSULE_PREFIX + id);
    if(raw){
      const c = JSON.parse(raw);
      // normalize expected fields
      c.meta = c.meta || { title: c.title || id, subject:'', level:'' };
      c.notes = c.notes || [];
      c.flashcards = c.flashcards || [];
      c.quiz = c.quiz || [];
      if(!c.id) c.id = id;
      return c;
    }
  }catch(e){
    console.warn('readFullCapsule parse error', e);
  }
  // fallback to demo if present
  if(capsules[id]){
    const copy = JSON.parse(JSON.stringify(capsules[id]));
    copy.id = id;
    copy.meta = copy.meta || { title: id, subject:'', level:'' };
    return copy;
  }
  return null;
}

// Load capsule into app.currentCapsule
function loadCapsule(id){
  const full = readFullCapsule(id);
  state.currentCapsule = full;
  loadProgressForCurrent();
}

// Reset study state
function resetStudyState(){
  state.fcIndex = 0;
  state.flipped = false;
  state.quizState = { order: [], qIndex: 0, score: 0 };
  state.progress = { bestScore: 0, knownFlashcards: [] };
  loadProgressForCurrent();
}

// Progress helpers (pc_progress_<id>)
function loadProgressForCurrent(){
  if(!state.currentCapsule || !state.currentCapsule.id) return;
  try{
    const raw = localStorage.getItem(PROG_PREFIX + state.currentCapsule.id);
    if(raw){
      const p = JSON.parse(raw);
      state.progress.bestScore = Number(p.bestScore || 0);
      state.progress.knownFlashcards = Array.isArray(p.knownFlashcards) ? p.knownFlashcards.slice() : [];
    } else {
      state.progress = { bestScore: 0, knownFlashcards: [] };
    }
  }catch(e){
    state.progress = { bestScore: 0, knownFlashcards: [] };
  }
}

function saveProgressForCurrent(){
  if(!state.currentCapsule || !state.currentCapsule.id) return;
  try{
    const key = PROG_PREFIX + state.currentCapsule.id;
    localStorage.setItem(key, JSON.stringify({
      bestScore: Number(state.progress.bestScore || 0),
      knownFlashcards: Array.isArray(state.progress.knownFlashcards) ? state.progress.knownFlashcards.slice() : []
    }));
    // optional: dispatch storage event manually for same-window listeners
    window.dispatchEvent(new StorageEvent('storage', { key: key, newValue: localStorage.getItem(key) }));
  }catch(e){
    console.warn('saveProgress failed', e);
  }
}

// Toggle flip
function toggleFlip(){
  state.flipped = !state.flipped;
  flashcardEl.classList.toggle('flipped', state.flipped);
}

// Render UI based on current state
function render(){
  if(!state.currentCapsule){
    // show fallback text
    cardFront.textContent = 'No capsule';
    cardBack.textContent = '';
    progressLabel.textContent = '0 / 0';
    mainProgress.style.width = '0%';
    return;
  }
  // header updates (if you want to display title/level in UI update DOM here)
  // render mode-specific
  if(state.mode === 'flash') renderFlash();
  if(state.mode === 'notes') renderNotes();
  if(state.mode === 'quiz') startQuiz();
  // update known count UI if exists
  const knownCountEl = document.getElementById('knownCountLabel');
  if(knownCountEl){
    knownCountEl.textContent = 'Known: ' + (state.progress.knownFlashcards ? state.progress.knownFlashcards.length : 0);
  }
}

// Flashcards rendering & navigation
function renderFlash(){
  const list = (state.currentCapsule && state.currentCapsule.flashcards) || [];
  if(list.length === 0){
    cardFront.textContent = '(no flashcards)';
    cardBack.textContent = '';
    progressLabel.textContent = '0 / 0';
    mainProgress.style.width = '0%';
    return;
  }
  state.fcIndex = Math.min(state.fcIndex, list.length - 1);
  const current = list[state.fcIndex];
  cardFront.textContent = current.front || '(front)';
  cardBack.textContent = current.back || '(back)';
  progressLabel.textContent = `${state.fcIndex+1} / ${list.length}`;
  mainProgress.style.width = `${Math.round(((state.fcIndex+1)/list.length)*100)}%`;
  // ensure front shown
  state.flipped = false;
  flashcardEl.classList.remove('flipped');
  // known count UI
  const knownCountEl = document.getElementById('knownCountLabel');
  if(knownCountEl) knownCountEl.textContent = 'Known: ' + (state.progress.knownFlashcards ? state.progress.knownFlashcards.length : 0);
}

function nextCard(){
  const list = (state.currentCapsule && state.currentCapsule.flashcards) || [];
  if(list.length === 0) return;
  state.fcIndex = Math.min(state.fcIndex + 1, list.length - 1);
  state.flipped = false;
  renderFlash();
}
function prevCard(){
  const list = (state.currentCapsule && state.currentCapsule.flashcards) || [];
  if(list.length === 0) return;
  state.fcIndex = Math.max(state.fcIndex - 1, 0);
  state.flipped = false;
  renderFlash();
}

// Mark known/unknown (and persist immediately)
function toggleKnown(markTrue){
  if(!state.currentCapsule || !state.currentCapsule.id) return;
  const idx = state.fcIndex;
  let arr = state.progress.knownFlashcards || [];
  if(markTrue){
    if(arr.indexOf(idx) === -1) arr.push(idx);
  } else {
    const i = arr.indexOf(idx);
    if(i !== -1) arr.splice(i,1);
  }
  state.progress.knownFlashcards = arr;
  saveProgressForCurrent();
  renderFlash();
}

// Export capsule: prefer full stored JSON, fallback to in-memory
function exportCapsule(){
  if(!state.currentCapsule) return alert('No capsule selected');
  try{
    const stored = localStorage.getItem(CAPSULE_PREFIX + state.currentCapsule.id);
    const data = stored ? stored : JSON.stringify(state.currentCapsule, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (state.currentCapsule.meta && state.currentCapsule.meta.title) ? state.currentCapsule.meta.title.replace(/\s+/g,'_').slice(0,40) : state.currentCapsule.id;
    a.download = name + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }catch(e){
    console.warn('export failed', e);
    alert('Export failed');
  }
}

/* =========================
   QUIZ logic (simple)
   ========================= */
function startQuiz(){
  const qlist = (state.currentCapsule && state.currentCapsule.quiz) || [];
  state.quizState.order = [...Array(qlist.length).keys()];
  // shuffle
  for(let i=state.quizState.order.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [state.quizState.order[i], state.quizState.order[j]] = [state.quizState.order[j], state.quizState.order[i]];
  }
  state.quizState.qIndex = 0;
  state.quizState.score = 0;
  renderQuizQuestion();
}

function renderQuizQuestion(){
  const qlist = (state.currentCapsule && state.currentCapsule.quiz) || [];
  if(state.quizState.qIndex >= qlist.length){
    finishQuiz();
    return;
  }
  const qidx = state.quizState.order[state.quizState.qIndex];
  const q = qlist[qidx];
  quizArea.innerHTML = '';
  const container = document.createElement('div');
  const h = document.createElement('h6'); h.textContent = `Q${state.quizState.qIndex+1}. ${q.q}`; container.appendChild(h);
  q.choices.forEach((choice, i)=>{
    const opt = document.createElement('div');
    opt.className = 'quiz-option';
    opt.textContent = choice || `(choice ${i+1})`;
    opt.addEventListener('click', ()=>{
      // disable container options
      Array.from(container.querySelectorAll('.quiz-option')).forEach(o=> o.style.pointerEvents='none');
      if(i === q.a){
        opt.classList.add('correct');
        state.quizState.score++;
      } else {
        opt.classList.add('wrong');
        const all = container.querySelectorAll('.quiz-option');
        if(all[q.a]) all[q.a].classList.add('correct');
      }
      if(q.explanation){
        const ex = document.createElement('div'); ex.className = 'muted-small'; ex.style.marginTop = '6px'; ex.textContent = q.explanation;
        container.appendChild(ex);
      }
      setTimeout(()=>{
        state.quizState.qIndex++;
        renderQuizQuestion();
      }, 800);
    });
    container.appendChild(opt);
  });
  quizArea.appendChild(container);
}

function finishQuiz(){
  const total = (state.currentCapsule && state.currentCapsule.quiz ? state.currentCapsule.quiz.length : 0);
  const score = state.quizState.score;
  const percent = total ? Math.round((score / total) * 100) : 0;
  // update bestScore if improved
  if(!state.progress) state.progress = { bestScore:0, knownFlashcards:[] };
  if(percent > (state.progress.bestScore || 0)){
    state.progress.bestScore = percent;
    saveProgressForCurrent();
  }
  quizArea.innerHTML = `<div><h5>Quiz complete</h5><p>Your score: ${score} / ${total} (${percent}%)</p>
    <p class="muted-small">Best score: ${state.progress.bestScore}%</p>
    <div style="margin-top:10px"><button id="retakeBtn" class="btn btn-sm btn-primary">Retake</button>
    <button id="toFlashBtn" class="btn btn-sm btn-outline-secondary">Back to Flashcards</button></div></div>`;
  document.getElementById('retakeBtn').addEventListener('click', ()=> startQuiz());
  document.getElementById('toFlashBtn').addEventListener('click', ()=> { switchMode('flash'); activateTab('flash'); });
}

/* helpers: mode switch & tab activation */
function switchMode(mode){
  state.mode = mode;
  Object.keys(panes).forEach(k => panes[k].classList.toggle('active', k === mode));
  if(mode === 'flash') renderFlash();
  if(mode === 'notes') renderNotes();
  if(mode === 'quiz') startQuiz();
}
function activateTab(mode){
  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
}

/* notes rendering */
function renderNotes(){
  panes.notes.innerHTML = '';
  const notes = state.currentCapsule ? (Array.isArray(state.currentCapsule.notes) ? state.currentCapsule.notes.join('\n') : (state.currentCapsule.notes || '')) : '';
  const card = document.createElement('div'); card.className = 'card p-3 mb-3';
  const h = document.createElement('h6'); h.textContent = 'Notes — ' + (state.currentCapsule?.meta?.title || state.capsuleId);
  const p = document.createElement('pre'); p.style.whiteSpace = 'pre-wrap'; p.textContent = notes;
  card.appendChild(h); card.appendChild(p);
  panes.notes.appendChild(card);
  const actions = document.createElement('div'); actions.className='d-flex gap-2';
  const qBtn = document.createElement('button'); qBtn.className='btn btn-sm btn-warning'; qBtn.textContent='Start Quiz';
  qBtn.addEventListener('click', ()=> { switchMode('quiz'); activateTab('quiz'); startQuiz(); });
  const fBtn = document.createElement('button'); fBtn.className='btn btn-sm btn-outline-secondary'; fBtn.textContent='Go to Flashcards';
  fBtn.addEventListener('click', ()=> { switchMode('flash'); activateTab('flash'); });
  actions.appendChild(qBtn); actions.appendChild(fBtn);
  panes.notes.appendChild(actions);
}

/* cycle tab by direction (-1 or +1) */
function cycleTab(dir){
  const order = ['notes','flash','quiz'];
  const currentIdx = order.indexOf(state.mode);
  const nextIdx = (currentIdx + dir + order.length) % order.length;
  switchMode(order[nextIdx]);
  activateTab(order[nextIdx]);
}

/* storage event handler — refresh if Author saved */
function onStorageEvent(ev){
  if(!ev.key) return;
  // If index changed, rebuild select
  if(ev.key === INDEX_KEY){
    const prev = capsuleSelect.value;
    populateCapsuleSelect();
    // try to keep previous selection
    if(prev && [...capsuleSelect.options].some(o=>o.value === prev)){
      capsuleSelect.value = prev;
      state.capsuleId = prev;
    } else {
      // pick first
      if(capsuleSelect.options.length) {
        capsuleSelect.selectedIndex = 0;
        state.capsuleId = capsuleSelect.value;
      }
    }
  }
  // If a capsule full JSON changed, and it's the one we're viewing, reload it
  if(ev.key && ev.key.startsWith(CAPSULE_PREFIX)){
    const id = ev.key.slice(CAPSULE_PREFIX.length);
    if(id === state.capsuleId){
      loadCapsule(id);
      resetStudyState();
      render();
    }
  }
  // If progress changed for current capsule, reload progress
  if(ev.key === PROG_PREFIX + state.capsuleId){
    loadProgressForCurrent();
    renderFlash();
  }
}

// start app
init();
