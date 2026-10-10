interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}
export const initialPwaState = () => ({
  status: "",
  notice: false,
  checking: false,
  applying: false,
  installable: false,
  installHint: false,
});
type PwaState = ReturnType<typeof initialPwaState>;
export function startPwa(
  publish: (state: PwaState) => void,
  beforeUpdate: () => void,
) {
  let state = initialPwaState(),
    registration: ServiceWorkerRegistration | undefined,
    prompt: InstallPrompt | undefined,
    disposed = false,
    dismissed = false;
  const abort = new AbortController(),
    signal = abort.signal;
  const change = (patch: Partial<PwaState>) => {
    if (!disposed) {
      state = { ...state, ...patch };
      publish(state);
    }
  };
  const identify = () =>
    navigator.serviceWorker.controller?.postMessage({
      type: "CLIENT_BUILD",
      build: __BUILD_ID__,
    });
  function build(worker: ServiceWorker | null): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error("No worker"));
        return;
      }
      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        channel.port1.close();
        reject(new Error("Worker did not reply"));
      }, 4000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data?.build);
      };
      worker.postMessage({ type: "VERSION" }, [channel.port2]);
    });
  }
  async function waiting() {
    const candidate = registration?.waiting ?? registration?.active ?? null;
    const id = await build(candidate);
    if (/^[a-f0-9]{12}$/.test(id) && id !== __BUILD_ID__)
      change({
        notice: !dismissed,
        status: "Update downloaded. Ready when you are.",
      });
    else change({ status: "Saved for offline play." });
  }
  function watch(worker: ServiceWorker | null) {
    worker?.addEventListener(
      "statechange",
      () => {
        if (worker.state === "installed")
          void waiting().catch(() =>
            change({
              status: "Could not confirm the update. Try checking again.",
            }),
          );
        if (worker.state === "redundant")
          change({
            status: "Download failed. Your current game is still here.",
          });
      },
      { signal },
    );
  }
  async function check() {
    if (!registration || state.checking || disposed || document.hidden) return;
    change({ checking: true, status: "Checking…" });
    try {
      const response = await fetch("/version.json?update-probe=" + Date.now(), {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Version unavailable");
      const current = await response.json();
      if (!/^[a-f0-9]{12}$/.test(current.build))
        throw new Error("Invalid build");
      if (current.build === __BUILD_ID__) {
        change({ status: "You’re up to date." });
        return;
      }
      await registration.update();
      if (registration.waiting) await waiting();
      else if (registration.installing)
        change({ status: "Downloading update…" });
      else await waiting();
    } catch {
      change({
        status:
          "Could not check. Your current game still works. Try again when online.",
      });
    } finally {
      change({ checking: false });
    }
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener(
      "message",
      (event) => {
        if (event.data?.type === "REPORT_BUILD") identify();
      },
      { signal },
    );
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        identify();
        if (state.applying) location.reload();
        else void check();
      },
      { signal },
    );
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing), {
          signal,
        });
        identify();
        if (reg.waiting) void waiting().catch(() => {});
        void check();
      })
      .catch(() =>
        change({
          status:
            "Offline installation is unavailable. You can still play online.",
        }),
      );
  }
  const interval = setInterval(() => void check(), 60000);
  addEventListener("online", check, { signal });
  addEventListener(
    "pageshow",
    () => {
      identify();
      void check();
    },
    { signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        identify();
        void check();
      }
    },
    { signal },
  );
  const installed = () =>
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !installed()) change({ installable: true });
  addEventListener(
    "beforeinstallprompt",
    (event) => {
      event.preventDefault();
      prompt = event as InstallPrompt;
      if (!installed()) change({ installable: true });
    },
    { signal },
  );
  addEventListener("appinstalled", () => change({ installable: false }), {
    signal,
  });
  return {
    check: () => {
      dismissed = false;
      return check();
    },
    later: () => {
      dismissed = true;
      change({ notice: false });
    },
    apply: () => {
      beforeUpdate();
      change({ applying: true });
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "ACTIVATE" });
        setTimeout(() => {
          if (!disposed)
            change({
              applying: false,
              status: "Update has not activated. Try again.",
              notice: true,
            });
        }, 10000);
      } else location.reload();
    },
    install: async () => {
      if (!prompt) {
        change({ installHint: true });
        return;
      }
      const offered = prompt;
      await offered.prompt();
      await offered.userChoice;
      prompt = undefined;
      change({ installable: false });
    },
    destroy: () => {
      disposed = true;
      abort.abort();
      clearInterval(interval);
    },
  };
}
