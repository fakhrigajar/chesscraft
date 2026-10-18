import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ title, ariaLabel, children, onClose, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  return createPortal(<dialog ref={dialog} className={`modal ${className}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }} aria-label={ariaLabel || title}><div className="modal-inner"><button className="icon-button modal-close" onClick={onClose} aria-label={"Cancel"}><X size={20}/></button>{title && <h2>{title}</h2>}{children}</div></dialog>, document.body);
}
