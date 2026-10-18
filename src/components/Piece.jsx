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
export function Mascot({ className = '', happy = false }) {
  return <svg viewBox="0 0 120 126" className={`mascot ${className}`} aria-hidden="true"><ellipse cx="62" cy="116" rx="41" ry="7" fill="#d8e1cd"/><path d="m25 107 5-16c-6-21-3-49 11-65l-3-13 15 7 13-4c20 10 26 26 20 46l8 30 6 15Z" fill="#f5dcaa" stroke="#5e7056" strokeWidth="3.5" strokeLinejoin="round"/><path d="m41 27 8 11-17 17-9 15 7 10 24-5-7 17h39" fill="#fff5d6" stroke="#5e7056" strokeWidth="3.5" strokeLinejoin="round"/><path d="m65 23 12 11-8 7 11 9-9 8 10 8" fill="none" stroke="#cb9861" strokeWidth="5" strokeLinecap="round"/><circle cx="52" cy="48" r="3.5" fill="#3d5144"/><path d={happy ? 'M42 65q8 10 15-2' : 'M41 66q5 5 10 0'} fill="none" stroke="#5e7056" strokeWidth="2.8" strokeLinecap="round"/><ellipse cx="59" cy="59" rx="5" ry="3" fill="#efa887"/><path d="M25 107h75l-4 9H21z" fill="#7d9c77" stroke="#5e7056" strokeWidth="3.5"/><path d="m11 31 3-7 3 7 7 3-7 3-3 7-3-7-7-3zM102 71l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#efbb53"/></svg>;
}
export function PieceBadge({ type, color = 'w', className = '' }) { return <span className={`piece-badge ${className}`}><Piece type={type} color={color}/></span>; }
