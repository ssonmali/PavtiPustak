"use client";

import * as React from "react";

/**
 * Registers the service worker that makes the app open without a network.
 * Registration is deliberately deferred until after load so it never competes
 * with the first render.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // A failed registration must never break the app; it just means no
          // offline support on this device.
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

/** Clears cached authenticated pages. Called from the logout control. */
export function clearPrivateCache() {
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_PRIVATE_CACHE",
  });
}
