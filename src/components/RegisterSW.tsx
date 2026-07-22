"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] registered:", reg.scope);
          // Check for updates every time the page loads
          reg.update();
        })
        .catch((err) => console.warn("[SW] registration failed:", err));
    }
  }, []);

  return null;
}
