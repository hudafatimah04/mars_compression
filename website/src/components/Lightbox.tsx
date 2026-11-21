import { useRef, type ReactNode } from 'react';

export function Lightbox({ src, alt, children, className, label }: {
  src: string; alt: string; children: ReactNode; className?: string; label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} type="button" className={className} aria-label={label} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog ref={dialog} className="figure-lightbox" aria-label="Enlarged figure" onClick={() => dialog.current?.close()} onClose={() => trigger.current?.focus({ preventScroll: true })}>
        <button type="button" className="lightbox-close" autoFocus>Close</button>
        <img src={src} alt={alt} />
      </dialog>
    </>
  );
}
