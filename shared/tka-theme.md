# TKA Gerenciamento shared theme

This portal keeps the static Firebase hosting structure. The shared UI layer is:

- `tka-theme.css`: semantic design tokens and global component styling.
- `tka-theme.js`: safe theme bootstrap for `localStorage.tka_theme`, `body[data-theme]`, `themeToggleBtn`, and `themeSelect`.

Page-specific CSS should load first. Then load `/shared/tka-theme.css` so common controls, cards, tabs, topbars, forms, chips, and action rows inherit the same TKA visual language across modules.

The shared CSS intentionally uses semantic tokens such as `--tka-bg`, `--tka-surface`, `--tka-text`, `--tka-red`, and `--tka-gold` instead of module-specific colors. Keep red and gold as accents. Destructive actions should use danger styling only for delete/excluir flows.

The shared theme must remain presentation-only. Do not use it as a reason to change:

- public link destinations or generation logic;
- Firebase collection names, public tokens, query parameters, `href`, `editorPath`, `source`, or `codePrefix`;
- PDF assets, manual PDF links, jsPDF templates, generated PDF content, `@media print`, or `.term-a4` document output.

When adding a new Gerenciamento page, load the local stylesheet first and then the shared stylesheet. If the page has a theme toggle, preserve `id="themeToggleBtn"` so `tka-theme.js` can keep the button label in sync with the current theme.
