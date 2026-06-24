(function () {
  const THEME_KEY = "tka_theme";

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function buttonLabel(theme) {
    return theme === "dark" ? "Tema claro" : "Tema escuro";
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    if (document.body) {
      document.body.dataset.theme = nextTheme;
    }
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {}
    updateControls(nextTheme);
    window.dispatchEvent(new CustomEvent("tka:themechange", { detail: nextTheme }));
    return nextTheme;
  }

  function updateControls(theme) {
    const toggle = document.getElementById("themeToggleBtn");
    if (toggle) {
      toggle.textContent = buttonLabel(theme);
      toggle.setAttribute("aria-label", buttonLabel(theme));
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }

    const select = document.getElementById("themeSelect");
    if (select) {
      select.value = theme;
    }
  }

  function readTheme() {
    try {
      return normalizeTheme(localStorage.getItem(THEME_KEY) || "light");
    } catch {
      return "light";
    }
  }

  function installControls() {
    const toggle = document.getElementById("themeToggleBtn");
    if (toggle) {
      toggle.dataset.tkaThemeReady = "1";
    }

    const select = document.getElementById("themeSelect");
    if (select && !select.dataset.tkaThemeBound) {
      select.dataset.tkaThemeBound = "1";
      select.addEventListener("change", function () {
        applyTheme(select.value);
      });
    }

    updateControls(normalizeTheme(document.body?.dataset.theme || readTheme()));
  }

  function boot() {
    applyTheme(readTheme());
    installControls();
  }

  window.TKATheme = {
    apply: applyTheme,
    normalize: normalizeTheme,
    updateControls: updateControls
  };

  if (document.body) {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
})();
