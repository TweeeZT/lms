"use client";
import { useEffect, useState } from "react";

type Props = {
  force?: boolean;
  /**
   * Show a dimmed/blurred backdrop behind the loader.
   * Set to false to remove the background so only the spinner is visible.
   * Defaults to true.
   */
  backdrop?: boolean;
  /**
   * Optional solid color for the overlay background when backdrop is enabled.
   * Defaults to a semi-transparent white. Use '#fff' to fully hide background content.
   */
  coverColor?: string;
};

export default function PrimeLoader({ force = false, backdrop = true, coverColor }: Props) {
  const [visible, setVisible] = useState(false);
  // Manual override counter for app-driven loading phases
  const [manualCount, setManualCount] = useState(0);

  useEffect(() => {
    // Schedule updates outside of the current React commit to avoid
    // "useInsertionEffect must not schedule updates" during navigation.
    const show = () => {
      // microtask or timeout both decouple from insertion phase
      setTimeout(() => setVisible(true), 0);
    };
    const hide = (delay = 400) => {
      const d = Math.max(0, delay);
      setTimeout(() => setVisible(false), d);
    };

    const onBeforeUnload = () => show();
    const onPopState = () => hide(0);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    // Patch pushState/replaceState but schedule state changes async
    // to avoid React complaining during router's insertion effects.
    function patchedPushState(
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const ret = origPush(...args);
      show();
      hide(400);
      return ret;
    }
    function patchedReplaceState(
      this: History,
      ...args: Parameters<History["replaceState"]>
    ) {
      const ret = origReplace(...args);
      show();
      hide(300);
      return ret;
    }

    history.pushState = patchedPushState;
    history.replaceState = patchedReplaceState;

    // Listen to global app events to force show/hide loader
    const onManualShow = () => setManualCount((c) => c + 1);
    const onManualHide = () =>
      setManualCount((c) => (c > 0 ? c - 1 : 0));
    window.addEventListener("prime-loader:show", onManualShow as any);
    window.addEventListener("prime-loader:hide", onManualHide as any);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      // restore originals
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("prime-loader:show", onManualShow as any);
      window.removeEventListener("prime-loader:hide", onManualHide as any);
    };
  }, []);

  const forced = force || manualCount > 0;
  const isManualForced = manualCount > 0 && !force;
  if (!visible && !forced) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: backdrop
          ? coverColor ?? (isManualForced ? "#ffffff" : "rgba(255,255,255,0.65)")
          : "transparent",
        backdropFilter: backdrop ? (isManualForced ? "none" : "blur(4px)") : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
  <div style={{ display: "flex", gap: 24 }}>
        {[0, 1, 2].map((i) => (
          <svg
            key={i}
            width="64"
            height="64"
            viewBox="0 0 64 64"
            style={{
              animation: "spinDiamond 1.2s linear infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <rect
              x="12"
              y="12"
              width="40"
              height="40"
              fill="none"
              stroke="url(#grad)"
              strokeWidth="8"
              rx="4"
              ry="4"
              transform="rotate(45 32 32)"
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f6d457" />
                <stop offset="100%" stopColor="#1e3769" />
              </linearGradient>
            </defs>
          </svg>
        ))}
      </div>

      <style>{`
        @keyframes spinDiamond {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
