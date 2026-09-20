import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (typeof window !== "undefined" && !window.__TAURI_INTERNALS__) {
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: async () => undefined,
    transformCallback: () => 0,
    unregisterCallback: () => undefined,
    convertFileSrc: (path: string) => path,
    metadata: {
      currentWindow: { label: "main", width: 1200, height: 800 }
    }
  };
}