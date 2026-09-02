"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { IDLE_TIMEOUT_MS } from "@/lib/auth-security";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"] as const;
const SERVER_TOUCH_INTERVAL_MS = 60 * 1000;

export default function IdleSessionGuard() {
  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    let lastServerTouch = 0;

    const refreshServerActivity = () => {
      if (Date.now() - lastServerTouch < SERVER_TOUCH_INTERVAL_MS) return;
      lastServerTouch = Date.now();
      void fetch("/api/auth/activity", { method: "POST", credentials: "same-origin" });
    };

    const signOutForInactivity = async () => {
      if (!active) return;
      active = false;
      await supabase.auth.signOut();
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/auth/login?timeout=1&next=${encodeURIComponent(next)}`);
    };
    const resetTimer = () => {
      if (!active) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(signOutForInactivity, IDLE_TIMEOUT_MS);
      refreshServerActivity();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) resetTimer();
    };

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) resetTimer();
    });
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
