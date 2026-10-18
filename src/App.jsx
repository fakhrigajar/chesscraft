import { useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles, ArrowUpRight, Check, AlertCircle } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { Header } from './components/Header.jsx';
import { Home } from './pages/Home.jsx';
import { Play } from './pages/Play.jsx';
import { Library } from './pages/Library.jsx';
import { Import } from './pages/Import.jsx';
import { Teacher } from './pages/Teacher.jsx';
import { lessons } from './data/lessons.js';

import { readStore, writeStore, savePuzzle, normalizePuzzle } from './services/storage.js';

function currentRoute() { const [route,id] = location.hash.replace(/^#\/?/,'').split('/'); return { route: ['home','play','library','add','teacher'].includes(route) ? route : 'play', id }; }
export default function App() {
  const [route,setRoute]=useState(currentRoute), [customPuzzles,setCustomPuzzles]=useState(()=>readStore('puzzles',[]).map(normalizePuzzle)), [progress,setProgress]=useState(()=>readStore('progress',{})), [settings,setSettings]=useState(()=>{
    const saved=readStore('settings',{});
    return {sound:saved.sound??false,reducedMotion:saved.reducedMotion??window.matchMedia('(prefers-reduced-motion: reduce)').matches,exploration:saved.exploration??false};
  }), [toast,setToast]=useState('');
  const puzzles=useMemo(()=>[...lessons,...customPuzzles],[customPuzzles]);
  const [lastLesson,setLastLesson]=useState(()=>readStore('lastLesson',lessons[0].id));
  const puzzle=puzzles.find(p=>p.id===(route.id||lastLesson))||puzzles[0];
  useEffect(()=>{const listener=()=>{setRoute(currentRoute());window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  useEffect(()=>{document.documentElement.classList.toggle('reduced-motion',settings.reducedMotion);},[settings.reducedMotion]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer);},[toast]);
  function navigate(page,id) {location.hash=`/${page}${id?`/${id}`:''}`;}
  function openLesson(p) {setLastLesson(p.id);writeStore('lastLesson',p.id);navigate('play',p.id);}
  function updateSettings(patch){setSettings(old=>{const next={...old,...patch};writeStore('settings',next);return next;});}
  function updateProgress(id,patch){setProgress(old=>{const next={...old,[id]:{...old[id],...patch(old[id]||{})}};writeStore('progress',next);return next;});}
  function onComplete(id){updateProgress(id,()=>({completed:true,completedAt:new Date().toISOString()}));}
  function onAttempt(id){updateProgress(id,p=>({attempts:(p.attempts||0)+1}));}
  function save(p){const next=savePuzzle(customPuzzles,p);setCustomPuzzles(next);}
  function duplicate(p){const title=`${p.title} (copy)`;save({...p,id:`puzzle-${crypto.randomUUID()}`,title,source:{...p.source,type:'duplicate',originalId:p.id}});setToast('Puzzle duplicated.');}
  function remove(id){const next=customPuzzles.filter(p=>p.id!==id);if(writeStore('puzzles',next))setCustomPuzzles(next);else setToast(('Storage error'));}
  const completed=puzzles.filter(p=>progress[p.id]?.completed).length;
  return <MotionConfig reducedMotion={settings.reducedMotion?'always':'user'}><div className={`app-shell ${route.route === 'play' ? 'play-shell' : ''}`}><a href="#main-content" className="skip-link" onClick={event=>{event.preventDefault();document.getElementById('main-content').focus();}}>{('Skip to content')}</a><Header route={route.route} navigate={navigate} settings={settings} updateSettings={updateSettings} completed={completed}/><div id="main-content" tabIndex={-1}>
    {route.route==='home'&&<Home onStart={()=>openLesson(puzzle)} onLibrary={()=>navigate('library')} completed={completed}/>}
    {route.route==='play'&&<Play key={puzzle.id} puzzle={puzzle} puzzles={puzzles} progress={progress} openLesson={openLesson} settings={settings} onComplete={onComplete} onAttempt={onAttempt} onNotice={message=>setToast({message})}/>}
    {route.route==='library'&&<Library puzzles={puzzles} progress={progress} openLesson={openLesson} onAdd={()=>navigate('add')} onSave={save} onDelete={remove} onDuplicate={duplicate}/>}
    {route.route==='add'&&<Import onSave={p=>{save(p);openLesson(p);}} onBack={()=>navigate('library')}/>}
    {route.route==='teacher'&&<Teacher puzzles={puzzles} customPuzzles={customPuzzles} progress={progress} settings={settings} updateSettings={updateSettings} onAdd={()=>navigate('add')} onLibrary={()=>navigate('library')} onRestore={data=>{const combined=[...customPuzzles.filter(p=>!data.puzzles.some(incoming=>incoming.id===p.id)),...data.puzzles.map(normalizePuzzle)];if(!writeStore('puzzles',combined))throw new Error('storage');setCustomPuzzles(combined);const next={...progress,...data.progress};writeStore('progress',next);setProgress(next);}}/>}
  </div><footer className="site-footer page-width"><div><span className="footer-flower">✳</span><span>{('Think through play. Discover through thinking.')}</span></div><span>{('Made for little big thinkers')}<Heart size={13}/></span><button onClick={()=>navigate('teacher')}>Chesscraft <span>© 2026</span><ArrowUpRight size={12}/></button></footer>{toast&&<div className="toast" role={toast.message?'alert':'status'}>{toast.message?<AlertCircle size={18}/>:<Check size={18}/>} {toast.message||toast}</div>}</div></MotionConfig>;
}
