"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Confirmation = { title: string; description: string; confirmLabel: string; detail?: ReactNode; danger?: boolean };
/** Native modal focus/inert behavior; only an explicit confirmation resolves true. */
export function useActionConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null), opener = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => {
    if (!request || !dialog.current || dialog.current.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current.showModal();
    dialog.current.querySelector(".action-dialog__body")?.scrollTo(0, 0);
    cancel.current?.focus({ preventScroll: true });
  }, [request]);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  function finish(confirmed: boolean) {
    const resolve = pending.current; pending.current = null;
    dialog.current?.close(); setRequest(null); resolve?.(confirmed);
    if (opener.current?.isConnected) opener.current.focus();
  }
  function confirm(options: Confirmation): Promise<boolean> {
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => { pending.current = resolve; setRequest(options); });
  }
  const confirmation = <dialog ref={dialog} className="action-dialog" aria-labelledby={id + "-title"} aria-describedby={id + "-description"}
    onCancel={event => { event.preventDefault(); finish(false); }} onClose={() => { if (pending.current) finish(false); }}>
    {request && <><div className="action-dialog__body p-6 sm:p-8">
      <h2 id={id + "-title"} className="font-serif text-3xl leading-tight">{request.title}</h2>
      <p id={id + "-description"} className="mt-4 leading-7">{request.description}</p>
      {request.detail && <div className="mt-5 border-y border-rule py-4 leading-7 [overflow-wrap:anywhere]">{request.detail}</div>}
    </div><div className="action-dialog__actions flex flex-wrap justify-end gap-3 border-t border-rule px-6 py-5 sm:px-8">
      <button ref={cancel} type="button" className="min-h-12 border border-ink px-5 py-3" onClick={() => finish(false)}>Cancel</button>
      <button type="button" className={`min-h-12 px-5 py-3 font-semibold text-white ${request.danger ? "bg-[#B91C1C]" : "bg-accent"}`} onClick={() => finish(true)}>{request.confirmLabel}</button>
    </div></>}
  </dialog>;
  return { confirm, confirmation };
}
