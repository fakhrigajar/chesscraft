import { useEffect, useRef, useState } from 'react';
import { FileCode2, Link2, Grid3X3, Upload, ArrowRight, Check, LoaderCircle, ShieldCheck, AlertCircle, Sparkles, Save, Eye, ArrowLeft } from 'lucide-react';
import { importErrorText } from "../services/importErrors.js";
import { importPgn, importFen, importUrl, analyzeImport } from '../services/importers.js';
import { engine } from '../services/engine.js';
import { Chess, PIECES } from '../services/chess.js';
import { OBJECTIVES, objectiveDescription } from '../services/objectives.js';
import { usesRecordedStrategy } from '../services/continuation.js';
import { Chessboard } from '../components/Chessboard.jsx';
import { Mascot } from '../components/Piece.jsx';

const sample = '[Event "The queen adventure"]\n[SetUp "1"]\n[FEN "7k/5K2/6Q1/8/8/8/8/8 w - - 0 1"]\n\n1. Qg7# (1. Qh6# {Another checkmate!}) 1-0';
export function Import({ onSave, onBack }) {
  const [tab,setTab]=useState('pgn'),
    [input,setInput]=useState(''),
    [loading,setLoading]=useState(false),
    [error,setError]=useState(''),
    [puzzle,setPuzzle]=useState(null),
    [confirmed,setConfirmed]=useState(false),
    [startPly,setStartPly]=useState(0),
    [engineError,setEngineError]=useState(false),
    controller=useRef(null),
    fileRef=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const moveLimit = Math.max(8, Math.ceil((puzzle?.solution.length || 0) / 2));
  function changeInput(value) { controller.current?.abort();setInput(value);setError('');setPuzzle(null);setConfirmed(false);setLoading(false);setEngineError(false); }
  function changeTab(next) { controller.current?.abort();setTab(next);setInput('');setError('');setPuzzle(null);setConfirmed(false);setLoading(false); }
  async function analyze(options={}) {
    controller.current?.abort();const request=new AbortController();controller.current=request;setLoading(true);setError('');setPuzzle(null);setConfirmed(false);setEngineError(false);
    try {
      let imported = tab==='pgn'?importPgn(input,options):tab==='fen'?importFen(input):await importUrl(input,{...options,signal:request.signal});
      if (!imported.title) imported.title='My new adventure';
      try { imported=await analyzeImport(imported,engine,request.signal); } catch(e) { if(e.name==='AbortError')throw e;setEngineError(true); }
      if (!imported.description) imported.description=objectiveDescription(imported.objective);
      if(request.signal.aborted)return;
      setPuzzle(imported);setStartPly(imported.startPly||0);setConfirmed(!imported.needsConfirmation&&!imported.needsStartPly);
    } catch(e) {if(!request.signal.aborted&&e.name!=='AbortError')setError(importErrorText(e));}
    finally {if(!request.signal.aborted)setLoading(false);}
  }
  function updateObjective(patch) {setPuzzle(p=>{const objective={...p.objective,...patch};return {...p,objective,description:p.customDescription?p.description:objectiveDescription(objective)};});setConfirmed(false);}
  function save() {
    if(!puzzle||!confirmed||puzzle.needsStartPly)return;
    const objective=puzzle.objective;
    if(objective.type==='reach'&&!/^[a-h][1-8]$/.test(objective.target||'')){setError('Choose a target square from a1–h8.');return;}
    if(!puzzle.title.trim()){setError('Give your puzzle a title.');return;}
    const category={mate:'checkmate',reach:'movement',capture:'capture',fork:'tactics',check:'tactics',pin:'tactics',skewer:'tactics',discovery:'tactics',defense:'tactics',strategic:'tactics'};
    const cleaned={...puzzle,theme:category[objective.type]||'tactics',objective:{...objective,moves:Math.max(1,Math.min(moveLimit,Math.trunc(Number(objective.moves))||1))},needsConfirmation:false};
    delete cleaned.history;delete cleaned.originFen;delete cleaned.needsStartPly;
    try{onSave(cleaned);}catch{setError("Browser storage is full. Download a backup and try again.");}
  }
  return <main className="import-page page-width"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/>{"Puzzle library"}</button><div className="page-intro"><div><span className="eyebrow"><Sparkles size={14}/>{'A CREATIVE CORNER FOR TEACHERS'}</span><h1>{"Add a new puzzle"}<span className="title-sparkle">✧</span></h1><p>{"Turn a chess position into an adventure for your little explorers."}</p></div></div>
    <div className="import-grid"><section className="import-source card"><div className="import-section-heading"><span className="step-number">1</span><div><h2>{'Bring in your puzzle'}</h2><p>{'Choose one of three simple ways.'}</p></div></div><div className="import-tabs" role="tablist">{[{id:'pgn',icon:FileCode2,label:'PGN notation'},{id:'url',icon:Link2,label:'Import a link'},{id:'fen',icon:Grid3X3,label:'FEN position'}].map(({id,icon:Icon,label})=><button key={id} className={tab===id?'active':''} onClick={()=>changeTab(id)} role="tab" aria-selected={tab===id}><Icon size={18}/>{label}</button>)}</div>
      <label className="source-label" htmlFor="puzzle-source">{tab==='pgn'?"Paste your PGN here":tab==='fen'?'Enter your FEN position':'Lichess or Chess.com link'}</label>
      {tab==='url'?<input id="puzzle-source" className="url-input" type="url" value={input} onChange={e=>changeInput(e.target.value)} placeholder="https://lichess.org/training/…"/>:<textarea id="puzzle-source" className="notation-input" spellCheck="false" rows={tab==='fen'?5:10} value={input} onChange={e=>changeInput(e.target.value)} placeholder={tab==='pgn'?sample:'7k/5K2/6Q1/8/8/8/8/8 w - - 0 1'}/>}
      {tab==='pgn'&&<div className="upload-row"><button className="upload-button" onClick={()=>fileRef.current.click()}><Upload size={15}/>{"or choose a .pgn file"}</button><input type="file" accept=".pgn,.txt" ref={fileRef} hidden onChange={async e=>{const file=e.target.files?.[0];if(file){if(file.size>250000){setError(importErrorText({code:'tooLarge'}));return;}changeInput(await file.text());}e.target.value='';}}/><button className="text-button" onClick={()=>changeInput(sample)}>{'Try an example'}</button></div>}
      <div className="source-info"><ShieldCheck size={19}/><p>{tab==='pgn'?'Comments, variations, and custom FEN positions are supported. For a full game, you’ll choose the puzzle’s start.':tab==='url'?'We use official public data only. For private or inaccessible puzzles, use PGN/FEN.':"FEN describes a position. Confirm the suggested goal for your lesson."}</p></div>
      {error&&<div className="form-error" role="alert"><AlertCircle size={17}/>{error}</div>}
      <button className="button primary-button analyze-button" onClick={()=>analyze()} disabled={loading||!input.trim()}>{loading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>} {(loading ? "Checking position and moves…" : "Analyze & preview")}{!loading&&<ArrowRight size={18}/>}</button>
      {loading&&<button className="text-button" onClick={()=>{controller.current?.abort();setLoading(false);}}>{"Cancel"}</button>}
    </section>
    <section className="import-preview card"><div className="import-section-heading"><span className="step-number green-step">2</span><div><h2>{"Puzzle preview"}</h2><p>{'Review, make it yours, start an adventure.'}</p></div><Eye size={20}/></div>
      {!puzzle?<div className="import-empty"><div className="preview-illustration"><Mascot/><span>✧</span></div><h3>{loading?"Checking position and moves…":'A new adventure starts here'}</h3><p>{"Choose a source on the left to preview the position."}</p>{loading&&<LoaderCircle className="spin" size={24}/>}</div>:<div className="preview-content">
        {puzzle.needsStartPly&&<div className="history-choice"><strong>{"This PGN contains a game history. Choose where your puzzle starts."}</strong><label>{"Starting half-move (ply)"}<select value={startPly} onChange={e=>setStartPly(Number(e.target.value))}>{puzzle.history.map(h=><option key={h.ply} value={h.ply}>{h.ply} · {h.san}</option>)}</select></label><button className="button secondary-button" onClick={()=>analyze({startPly})}>{"Use this position"}<ArrowRight size={15}/></button></div>}
        <div className="preview-position-row"><div className="preview-board"><Chessboard fen={puzzle.initialFen} compact flipped={puzzle.studentColor==='b'}/></div><div className="preview-position-meta"><span className="verified-badge"><Check size={13}/>{'Legal position'}</span><strong>{(puzzle.studentColor==='w' ? "White" : "Black")} {'to play'}</strong><p>{puzzle.solution.length} {'source plies'} · {puzzle.variations.length} {'variations'}</p><small>{puzzle.source.type.toUpperCase()}</small></div></div>
        {engineError&&<div className="form-info">{'The engine is unavailable. Review the goal or analyze again.'}</div>}
        {usesRecordedStrategy(puzzle)&&<div className="form-info">{'No specific tactical goal was found. Follow the recorded line to its final position, or choose the goal you want to teach.'}</div>}
        <div className="preview-form"><label>{"Puzzle title"}<input value={puzzle.title} maxLength={100} onChange={e=>setPuzzle({...puzzle,title:e.target.value})}/></label><div className="form-row"><label>{"Learning objective"}<select aria-label={"Learning objective"} value={puzzle.objective.type} onChange={e=>updateObjective({type:e.target.value,...(e.target.value==='capture'?{piece:'q'}:{}),...(e.target.value==='reach'?{piece:'n',target:'f3'}:{})})}>{Object.entries(OBJECTIVES).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label><label>{"Difficulty"}<select value={puzzle.difficulty} onChange={e=>setPuzzle({...puzzle,difficulty:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{(n===1 ? "Beginner" : (n===2 ? "Explorer" : "Challenger"))}</option>)}</select></label></div><div className="form-row"><label>{"Student move limit"}<input type="number" min="1" max={moveLimit} value={puzzle.objective.moves} onChange={e=>updateObjective({moves:Number(e.target.value)})}/></label>{puzzle.objective.type==='reach'&&<label>{"Target square"}<select value={puzzle.objective.target||'f3'} onChange={e=>updateObjective({target:e.target.value})}>{Array.from({length:64},(_,i)=>`${'abcdefgh'[i%8]}${Math.floor(i/8)+1}`).map(square=><option key={square}>{square}</option>)}</select></label>}{['capture','reach','fork'].includes(puzzle.objective.type)&&<label>{"Piece type"}<select value={puzzle.objective.piece||'q'} onChange={e=>updateObjective({piece:e.target.value})}>{Object.entries(PIECES).filter(([type])=>puzzle.objective.type!=='capture'||type!=='k').map(([type,piece])=><option key={type} value={type}>{piece.name}</option>)}</select></label>}</div>
          {['strategic','defense'].includes(puzzle.objective.type)&&<div className="form-row"><label>{'Evaluation tolerance (centipawns)'}<input type="number" min="0" max="500" value={puzzle.objective.toleranceCp??75} onChange={e=>updateObjective({toleranceCp:Math.max(0,Math.min(500,Number(e.target.value)))})}/></label>{puzzle.objective.type==='defense'&&<label>{'Minimum score'}<input type="number" min="-1000" max="1000" value={puzzle.objective.minimumCp??-150} onChange={e=>updateObjective({minimumCp:Number(e.target.value)})}/></label>}</div>}
          <label>{"A short explanation for the child"}<textarea rows={2} maxLength={300} value={puzzle.description} onChange={e=>setPuzzle({...puzzle,description:e.target.value,customDescription:true})}/></label>
          {puzzle.enginePreview?.variations.length>0&&<div className="engine-candidates"><span>{"Candidate moves"}</span><div>{puzzle.enginePreview.variations.slice(0,5).map(v=><code key={v.pv[0]}>{v.pv[0].slice(0,2)} → {v.pv[0].slice(2,4)}{v.pv[0][4]?`=${v.pv[0][4].toUpperCase()}`:''}</code>)}</div><small>{"Candidates are checked against the lesson goal during play."}</small></div>}
          <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={puzzle.needsStartPly}/><span>{"I have reviewed and confirmed the objective"}</span></label><button className="button primary-button save-puzzle-button" disabled={!confirmed||puzzle.needsStartPly} onClick={save}><Save size={17}/>{"Save & play"}<ArrowRight size={18}/></button>
        </div>
      </div>}
    </section></div>
  </main>;
}
