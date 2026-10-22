import React from 'react';
const shapes = {
  p: <><circle cx="24" cy="13" r="6.8"/><path d="M20 20c1 6-1 9-4 13h16c-3-4-5-7-4-13M15 34h18l2 6H13z"/></>,
  n: <><path d="M13 40h25l-3-7h-4c4-12 3-22-8-27l-3 7-9 9 3 6 11-4-5 9h-4z"/><path d="m23 8 5 7M18 20l3-2" fill="none"/><circle cx="27" cy="18" r="1.5" fill="var(--piece-stroke)" stroke="none"/></>,
  b: <><path d="M24 6c-2 4-9 9-9 15 0 4 3 7 6 8l-5 5h16l-5-5c3-1 6-4 6-8 0-6-7-11-9-15Z"/><path d="m25 14-5 8"/><path d="M14 34h20l2 6H12z"/></>,
  r: <><path d="M12 7h6v6h6V7h6v6h6V7h1v13l-5 4v10H16V24l-4-4z"/><path d="M14 34h20l2 6H12zM16 21h16M17 29h14"/></>,
  q: <><path d="m11 15 8 8 5-12 5 12 8-8-5 18H16z"/><circle cx="10" cy="13" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="38" cy="13" r="3"/><path d="M15 33h18l3 7H12zM17 29h14"/></>,
  k: <><path d="M24 5v10M19 10h10" fill="none"/><path d="M17 17c-8-4-12 6-6 12l5 5h16l5-5c6-6 2-16-6-12-4-5-10-5-14 0Z"/><path d="M14 34h20l2 6H12zM24 20v10"/></>,
};
export function Piece({ type = 'n', color = 'w', className = '', size = 48, ...props }) {
  return <svg viewBox="0 0 48 48" width={size} height={size} className={`chess-piece ${className}`} style={{ '--piece-stroke': color === 'w' ? '#46564c' : '#253c36' }} aria-hidden="true" {...props}><g fill={color === 'w' ? '#fffcef' : '#354e45'} stroke={color === 'w' ? '#46564c' : '#203a31'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{shapes[type]}</g>{color === 'b' && <path d="M17 37h14" stroke="#8eaa98" strokeWidth="1.3" strokeLinecap="round"/>}</svg>;
}
// Queenie: a caped chess queen with a gold crown, drawn in the app's forest, cream, and orange palette.
export function Mascot({ className = '', happy = false }) {
  const ink = '#304a3c', ivory = '#fffcef', gold = '#efbb53', shade = '#e5e9de', forest = '#285e4b', orange = '#ee955b';
  const eye = (cx, look) => <g><ellipse cx={cx} cy="45" rx="5.5" ry={happy ? 3.6 : 4.2} fill="#fff" strokeWidth="2"/><circle cx={cx + look} cy="45.3" r="3.1" fill={forest} stroke="none"/><circle cx={cx + look} cy="45.3" r="1.3" fill={ink} stroke="none"/><circle cx={cx + look - 1} cy="44" r=".9" fill="#fff" stroke="none"/></g>;
  return <svg viewBox="0 0 120 126" className={`mascot ${className}`} aria-hidden="true" stroke={ink} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    <ellipse cx="60" cy="119" rx="40" ry="5" fill="#d8e1cd" stroke="none"/>
    <path d="M40 62c-12 10-18 30-26 48l16-4 6 7 24-9 24 9 6-7 16 4c-8-18-14-38-26-48Z" fill={orange}/>
    <path d="M44 65c-8 12-14 29-20 41l10-3 6 6 20-8 20 8 6-6 10 3c-6-12-12-29-20-41Z" fill={forest} strokeWidth="2"/>
    <path d="M50 66c0 14-3 24-8 32h36c-5-8-8-18-8-32Z" fill={ivory}/>
    <path d="M64 68c1 12 3 21 7 28h4c-4-8-6-17-6-28Z" fill={shade} stroke="none"/>
    <rect x="38" y="96" width="44" height="6" rx="3" fill={gold}/>
    <path d="M40 102h40q3 5 10 7H30q7-2 10-7Z" fill={ivory}/>
    <rect x="26" y="109" width="68" height="8" rx="4" fill={ivory}/><path d="M30 113h60" stroke={shade} strokeWidth="2"/>
    <ellipse cx="60" cy="63" rx="22" ry="5.5" fill={ivory}/>
    <rect x="44" y="54" width="32" height="6" rx="3" fill={gold}/>
    <path d="M37 32q23-6 46 0l-7 24q-16 3-32 0Z" fill={ivory}/>
    <path d="M72 34q5 0 8-1l-5 20q-2 1-5 1Z" fill={shade} stroke="none"/>
    <rect x="57" y="13" width="6" height="7" rx="1.5" fill={ink}/><circle cx="60" cy="9" r="6" fill={ivory}/><circle cx="58" cy="7" r="1.6" fill="#fff" stroke="none"/>
    <path d="M36 34 37 17l9 8 7-12 7 9 7-9 7 12 9-8 1 17q-24-6-48 0Z" fill={gold}/>
    <path d="m44 30 2-4m14 2v-4m14 6-2-4" stroke="#fff3c9" strokeWidth="1.8"/>
    {eye(50, 1)}{eye(70, -1)}
    <path d={happy ? 'M43 38q6-4 12-1M77 38q-6-4-12-1' : 'M43 37l13 4M77 37l-13 4'} fill="none" strokeWidth="3.4"/>
    {happy && <path d="M55 51q5 4 10 0" fill="none" strokeWidth="2.4"/>}
    <ellipse cx="45" cy="51" rx="3.5" ry="2" fill="#efa887" stroke="none"/><ellipse cx="75" cy="51" rx="3.5" ry="2" fill="#efa887" stroke="none"/>
    <path d="m11 31 3-7 3 7 7 3-7 3-3 7-3-7-7-3zM104 50l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill={gold} stroke="none"/>
  </svg>;
}
export function PieceBadge({ type, color = 'w', className = '' }) { return <span className={`piece-badge ${className}`}><Piece type={type} color={color}/></span>; }
