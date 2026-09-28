import { useEffect } from "react";

const SOUND_KEY = "zoomo:sound";
const PUSH_KEY = "zoomo:push";

export function soundEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "off";
}
export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}
export function pushPreferred() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PUSH_KEY) === "on";
}
export function setPushPreferred(on: boolean) {
  localStorage.setItem(PUSH_KEY, on ? "on" : "off");
}

let ctx: AudioContext | null = null;
/** Call from a user gesture (e.g. going online) so browsers allow sound later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* no audio */
  }
}

/** Loud, distinct two-tone chime repeated 3 times, plus vibration. */
export function playRequestAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([400, 150, 400, 150, 600]);
  if (!soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      for (const [j, f] of [880, 1320].entries()) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = f;
        const s = t0 + i * 0.6 + j * 0.2;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.5, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(s);
        o.stop(s + 0.2);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Flashes the tab title while `active` and the tab is hidden or not. */
export function useTitleFlash(active: boolean, text = "🔔 New ride request!") {
  useEffect(() => {
    if (!active) return;
    const original = document.title;
    let on = false;
    const t = setInterval(() => {
      document.title = on ? original : text;
      on = !on;
    }, 800);
    return () => {
      clearInterval(t);
      document.title = original;
    };
  }, [active, text]);
}

/** Keeps the screen awake while `active` (Wake Lock API), re-acquiring after tab switches. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied */
      }
    };
    const onVis = () => {
      if (!cancelled && document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
