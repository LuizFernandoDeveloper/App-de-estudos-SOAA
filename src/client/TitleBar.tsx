import { useEffect, useState } from "react";
import { BrainCircuit, Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function CustomTitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return;
    const appWindow = getCurrentWindow();
    let unlistenResize: (() => void) | undefined;
    (async () => {
      setMaximized(await appWindow.isMaximized());
      unlistenResize = await appWindow.onResized(async () => setMaximized(await appWindow.isMaximized()));
    })().catch(() => undefined);
    return () => unlistenResize?.();
  }, []);

  const minimize = () => window.__TAURI_INTERNALS__ && getCurrentWindow().minimize().catch(() => undefined);
  const toggleMaximize = () => window.__TAURI_INTERNALS__ && getCurrentWindow().toggleMaximize().catch(() => undefined);
  const close = () => window.__TAURI_INTERNALS__ && getCurrentWindow().close().catch(() => undefined);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <span className="titlebar-mark"><BrainCircuit size={15} /></span>
        <span className="titlebar-name" data-tauri-drag-region>SOAA</span>
        <span className="titlebar-tag">Sistema Operacional de Autodidatismo Avançado</span>
      </div>
      <div className="titlebar-controls">
        <button className="tb-button" title="Minimizar" aria-label="Minimizar" onClick={minimize}><Minus size={15} /></button>
        <button className="tb-button" title={maximized ? "Restaurar" : "Maximizar"} aria-label={maximized ? "Restaurar" : "Maximizar"} onClick={toggleMaximize}>{maximized ? <Copy size={13} /> : <Square size={12} />}</button>
        <button className="tb-button tb-close" title="Fechar" aria-label="Fechar" onClick={close}><X size={15} /></button>
      </div>
    </header>
  );
}