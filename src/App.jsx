import { useEffect, useMemo, useState } from 'react';
import { Heart, Sparkles, Check, AlertCircle } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { Header } from './components/Header.jsx';
import { Home } from './pages/Home.jsx';
import { Play } from './pages/Play.jsx';
import { Import } from './pages/Import.jsx';
import { lessons } from './data/lessons.js';

import { readStore, writeStore, savePuzzle, normalizePuzzle } from './services/storage.js';

function currentRoute() { const [route,id] = location.hash.replace(/^#\/?/,'').split('/'); return { route: ['home','play','add'].includes(route) ? route : 'play', id }; }
export default function App() {
  const [route,setRoute]=useState(currentRoute), [customPuzzles,setCustomPuzzles]=useState(()=>readStore('puzzles',[]).map(normalizePuzzle)), [progress,setProgress]=useState(()=>readStore('progress',{})), [settings,setSettings]=useState(()=>{
    const saved=readStore('settings',{});
    return {sound:saved.sound??true,reducedMotion:saved.reducedMotion??window.matchMedia('(prefers-reduced-motion: reduce)').matches,exploration:saved.exploration??false};
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
  const completed=puzzles.filter(p=>progress[p.id]?.completed).length;
  return <MotionConfig reducedMotion={settings.reducedMotion?'always':'user'}><div className={`app-shell ${route.route === 'play' ? 'play-shell' : ''}`}><a href="#main-content" className="skip-link" onClick={event=>{event.preventDefault();document.getElementById('main-content').focus();}}>{('Skip to content')}</a><Header route={route.route} navigate={navigate} settings={settings} updateSettings={updateSettings} completed={completed}/><div id="main-content" tabIndex={-1}>
    {route.route==='home'&&<Home onStart={()=>openLesson(puzzle)} completed={completed}/>}
    {route.route==='play'&&<Play key={puzzle.id} puzzle={puzzle} puzzles={puzzles} progress={progress} openLesson={openLesson} settings={settings} onComplete={onComplete} onAttempt={onAttempt} onNotice={message=>setToast({message})}/>}
    {route.route==='add'&&<Import onSave={p=>{save(p);openLesson(p);}} onBack={()=>navigate('play')}/>}
  </div><footer className="site-footer page-width"><div><span className="footer-flower">✳</span><span>{('Think through play. Discover through thinking.')}</span></div><span>{('Made for little big thinkers')}<Heart size={13}/></span><p className="footer-brand">Chesscraft <span>© 2026</span></p></footer>{toast&&<div className="toast" role={toast.message?'alert':'status'}>{toast.message?<AlertCircle size={18}/>:<Check size={18}/>} {toast.message||toast}</div>}</div></MotionConfig>;
}
