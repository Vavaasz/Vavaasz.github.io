(function () {
  const ACTION_KEY = "tka_portal_maintenance_action";
  const ASSET_BUST_KEY = "tka_asset_bust_token";
  const CHANNEL_NAME = "tka-portal-maintenance";
  const ACTION_TYPES = {
    forceRefresh: "force-refresh",
    clearCache: "clear-cache"
  };

  let lastHandledActionId = "";
  let channel = null;

  function sameOriginPath(path) {
    try {
      const url = new URL(path, window.location.origin);
      return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : path;
    } catch {
      return path;
    }
  }

  function buildReloadUrl(token) {
    const url = new URL(window.location.href);
    url.searchParams.set("__tka_refresh__", token);
    return url.toString();
  }

  async function clearOriginCaches() {
    const tasks = [];

    if ("caches" in window) {
      tasks.push(
        caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
      );
    }

    if ("serviceWorker" in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then(registrations =>
          Promise.all(registrations.map(registration => registration.unregister().catch(() => false)))
        )
      );
    }

    await Promise.allSettled(tasks);
  }

  async function executeAction(action) {
    if (!action || !action.id || action.id === lastHandledActionId) return;
    lastHandledActionId = action.id;

    if (action.token) {
      localStorage.setItem(ASSET_BUST_KEY, action.token);
    }

    if (action.type === ACTION_TYPES.clearCache) {
      await clearOriginCaches();
    }

    window.location.replace(buildReloadUrl(action.token || String(Date.now())));
  }

  function broadcastAction(action) {
    localStorage.setItem(ACTION_KEY, JSON.stringify(action));
    if (channel) {
      channel.postMessage(action);
    }
  }

  async function dispatchAction(type) {
    const action = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      token: `${Date.now()}`
    };

    broadcastAction(action);
    await executeAction(action);
  }

  function addButtonBar() {
    if (window.TKA_HIDE_MAINTENANCE_TOOLS) return;
    if (document.getElementById("tkaMaintenanceTools")) return;

    const container = document.createElement("div");
    container.id = "tkaMaintenanceTools";
    container.innerHTML = `
      <button type="button" data-action="force-refresh">Force Refresh</button>
      <button type="button" data-action="clear-cache">Clear Cache</button>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #tkaMaintenanceTools {
        position: static;
        z-index: 9999;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        width: fit-content;
        max-width: calc(100vw - 36px);
        margin: 0 18px 18px;
      }

      #tkaMaintenanceTools button {
        border: 1px solid rgba(22, 28, 45, 0.16);
        border-radius: 999px;
        padding: 10px 14px;
        font: 600 13px/1.2 "Segoe UI", sans-serif;
        color: #fff;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
        cursor: pointer;
      }

      #tkaMaintenanceTools button[data-action="clear-cache"] {
        background: linear-gradient(135deg, #7f1d1d, #b91c1c);
      }

      @media (max-width: 720px) {
        #tkaMaintenanceTools {
          width: auto;
          max-width: none;
          margin: 0 12px 12px;
        }

        #tkaMaintenanceTools button {
          flex: 1 1 160px;
          justify-content: center;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);

    container.querySelector('[data-action="force-refresh"]').onclick = () => {
      dispatchAction(ACTION_TYPES.forceRefresh).catch(error => console.error(error));
    };

    container.querySelector('[data-action="clear-cache"]').onclick = () => {
      dispatchAction(ACTION_TYPES.clearCache).catch(error => console.error(error));
    };
  }

  function boot() {
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        executeAction(event.data).catch(error => console.error(error));
      };
    }

    window.addEventListener("storage", event => {
      if (event.key !== ACTION_KEY || !event.newValue) return;
      try {
        const action = JSON.parse(event.newValue);
        executeAction(action).catch(error => console.error(error));
      } catch (error) {
        console.error(error);
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", addButtonBar, { once: true });
      return;
    }

    addButtonBar();
  }

  window.tkaForceRefreshAllPages = () => dispatchAction(ACTION_TYPES.forceRefresh);
  window.tkaClearCacheAllPages = () => dispatchAction(ACTION_TYPES.clearCache);
  window.tkaSameOriginPath = sameOriginPath;

  boot();
})();
