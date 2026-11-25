/**
 * Custom Modern API Documentation Portal (/docs/)
 * Self-contained, offline-ready OpenAPI 3.0 Explorer for Thoen Hospital Unified API Gateway
 */

const PORTAL_HTML = String.raw`<!DOCTYPE html>
<html lang="th" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thoen Hospital API Gateway — Documentation</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230f766e' stroke-width='2.2' stroke-linecap='round'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' fill='%23f0fdfa' stroke='%230f766e' stroke-width='1.5'/%3E%3Cpath d='M12 6v12M6 12h12'/%3E%3C/svg%3E" />
  <style>
    :root {
      --bg-app: #f5f7fa;
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --bg-raised: #eceff4;
      --bg-code: #f8fafc;
      --bg-hover: #f1f5f9;
      --border-hairline: rgba(17, 24, 39, 0.09);
      --border-strong: rgba(17, 24, 39, 0.16);
      --text-primary: #111827;
      --text-secondary: #4b5565;
      --text-muted: #647084;
      --accent: #0f766e;
      --accent-hover: #0d655e;
      --accent-soft: rgba(15, 118, 110, 0.1);
      --accent-text: #0f766e;
      --on-accent: #ffffff;
      --positive: #15803d;
      --positive-soft: rgba(21, 128, 61, 0.1);
      --warning: #b45309;
      --warning-soft: rgba(180, 83, 9, 0.1);
      --danger: #b91c1c;
      --danger-soft: rgba(185, 28, 28, 0.1);
      --info: #1d4ed8;
      --info-soft: rgba(29, 78, 216, 0.1);
      --shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
      --shadow-md: 0 8px 24px rgba(17, 24, 39, 0.07);
      --font-sans: 'IBM Plex Sans Thai', 'Noto Sans Thai', 'Sarabun', 'Segoe UI', 'Leelawadee UI', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Cascadia Code', 'Consolas', ui-monospace, SFMono-Regular, monospace;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
      --header-h: 60px;
      --sidebar-w: 288px;
    }

    html[data-theme="dark"] {
      --bg-app: #0b0d14;
      --bg-sidebar: #0e111a;
      --bg-card: #111520;
      --bg-raised: #1a1f2e;
      --bg-code: #0d1018;
      --bg-hover: #171c29;
      --border-hairline: rgba(238, 240, 245, 0.09);
      --border-strong: rgba(238, 240, 245, 0.18);
      --text-primary: #eef0f5;
      --text-secondary: #a3a9b8;
      --text-muted: #7d869c;
      --accent: #14b8a6;
      --accent-hover: #2dd4bf;
      --accent-soft: rgba(20, 184, 166, 0.14);
      --accent-text: #2dd4bf;
      --on-accent: #042f2e;
      --positive: #4cc38a;
      --positive-soft: rgba(76, 195, 138, 0.14);
      --warning: #f59e0b;
      --warning-soft: rgba(245, 158, 11, 0.14);
      --danger: #f87171;
      --danger-soft: rgba(248, 113, 113, 0.14);
      --info: #60a5fa;
      --info-soft: rgba(96, 165, 250, 0.14);
      --shadow-sm: none;
      --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-app);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    button, input, textarea, select {
      font-family: inherit;
      font-size: inherit;
      color: inherit;
    }

    button {
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 0;
    }

    :focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .tabular { font-variant-numeric: tabular-nums; }
    .mono { font-family: var(--font-mono); }

    /* Top Header */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 40;
      height: var(--header-h);
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 20px;
    }

    .mobile-menu-btn {
      display: none;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--border-hairline);
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      text-decoration: none;
      color: inherit;
    }

    .brand-mark {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--accent-soft);
      color: var(--accent-text);
      border: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .brand-title {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .brand-sub {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.2;
      white-space: nowrap;
    }

    .search-wrap {
      flex: 1;
      max-width: 440px;
      margin-left: 16px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      color: var(--text-muted);
      pointer-events: none;
      display: flex;
    }

    .search-input {
      width: 100%;
      height: 36px;
      padding: 0 64px 0 36px;
      border-radius: 8px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-raised);
      color: var(--text-primary);
      font-size: 13px;
      transition: border-color 140ms var(--ease), background-color 140ms var(--ease);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
      background: var(--bg-card);
    }

    .search-kbd {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      pointer-events: none;
    }

    .kbd {
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1;
      padding: 4px 6px;
      border-radius: 4px;
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      color: var(--text-muted);
    }

    .search-clear {
      position: absolute;
      right: 8px;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: none;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }
    .search-clear.visible { display: flex; }
    .search-clear:hover { background: var(--bg-hover); color: var(--text-primary); }

    .header-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .apikey-box {
      display: flex;
      align-items: center;
      height: 36px;
      background: var(--bg-raised);
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      padding: 0 8px 0 10px;
      gap: 6px;
      transition: border-color 140ms var(--ease);
    }

    .apikey-box:focus-within {
      border-color: var(--accent);
      background: var(--bg-card);
    }

    .apikey-label {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .apikey-input {
      width: 140px;
      border: none;
      background: transparent;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-primary);
      outline: none;
    }

    .apikey-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      opacity: 0.4;
      flex-shrink: 0;
    }
    .apikey-status.ready {
      background: var(--positive);
      opacity: 1;
    }

    .btn-icon {
      height: 36px;
      min-width: 36px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-card);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 140ms var(--ease), color 140ms var(--ease), transform 120ms var(--ease);
    }
    .btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
    .btn-icon:active { transform: scale(0.97); }

    /* Shell Layout */
    .shell {
      display: flex;
      align-items: flex-start;
    }

    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-hairline);
      position: sticky;
      top: var(--header-h);
      align-self: flex-start;
      max-height: 820px;
      overflow-y: auto;
      padding: 16px 12px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 45;
    }

    .method-filter-bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      padding: 4px;
      background: var(--bg-raised);
      border-radius: 8px;
      border: 1px solid var(--border-hairline);
    }

    .method-pill {
      height: 28px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 120ms var(--ease), color 120ms var(--ease);
    }
    .method-pill:hover { color: var(--text-primary); }
    .method-pill.active {
      background: var(--bg-card);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    .nav-section-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      padding: 8px 8px 4px;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      width: 100%;
      min-height: 36px;
      padding: 6px 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: left;
      color: var(--text-secondary);
      border: 1px solid transparent;
      transition: background-color 120ms var(--ease), color 120ms var(--ease);
    }
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .nav-item.active {
      background: var(--bg-raised);
      color: var(--text-primary);
      border-color: var(--border-hairline);
      font-weight: 500;
    }

    .nav-num {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      width: 22px;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    .nav-item.active .nav-num { color: var(--accent-text); }

    .nav-label {
      flex: 1;
      font-size: 13px;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nav-count {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* Main Content */
    .main {
      flex: 1;
      min-width: 0;
      padding: 24px 32px 64px;
      max-width: 1200px;
    }

    .overview-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    .page-title {
      margin: 0 0 4px;
      font-size: 26px;
      font-weight: 600;
      line-height: 1.25;
      letter-spacing: -0.015em;
    }

    .page-desc {
      margin: 0;
      font-size: 14px;
      color: var(--text-secondary);
      max-width: 68ch;
    }

    .base-url-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      padding: 0 12px;
      border-radius: 8px;
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Health & Stats Strip */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      padding: 16px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 500;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
    }

    .stat-meta {
      font-size: 12px;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      display: inline-block;
    }
    .live-dot.up { background: var(--positive); }
    .live-dot.down { background: var(--danger); }

    /* Toolbar */
    .content-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-hairline);
    }

    .result-summary {
      font-size: 13px;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .toolbar-btns {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Group Sections */
    .group-section {
      margin-bottom: 28px;
      scroll-margin-top: calc(var(--header-h) + 16px);
    }

    .group-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
      padding: 4px 2px;
    }

    .group-title-wrap {
      min-width: 0;
    }

    .group-title {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.3;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .group-count {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 400;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .group-desc {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* Endpoint Card */
    .op-card {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: border-color 140ms var(--ease);
    }
    .op-card:hover { border-color: var(--border-strong); }
    .op-card.open { border-color: var(--border-strong); }

    .op-row {
      width: 100%;
      min-height: 44px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
      background: transparent;
      transition: background-color 120ms var(--ease);
    }
    .op-row:hover { background: var(--bg-hover); }

    .method-badge {
      width: 64px;
      height: 24px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      letter-spacing: 0.02em;
    }
    .m-GET { background: var(--positive-soft); color: var(--positive); }
    .m-POST { background: var(--info-soft); color: var(--info); }
    .m-PUT, .m-PATCH { background: var(--warning-soft); color: var(--warning); }
    .m-DELETE { background: var(--danger-soft); color: var(--danger); }

    .op-main {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(320px, 46%) minmax(0, 1fr);
      gap: 4px 16px;
      align-items: baseline;
    }

    .op-path {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .op-path .param-seg {
      color: var(--accent-text);
      font-weight: 600;
    }

    .op-summary {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 0;
    }

    .op-chevron {
      color: var(--text-muted);
      flex-shrink: 0;
      transition: transform 160ms var(--ease);
      display: flex;
    }
    .op-card.open .op-chevron { transform: rotate(90deg); }

    /* Expanded Detail Panel */
    .op-body {
      display: none;
      border-top: 1px solid var(--border-hairline);
      background: var(--bg-code);
      padding: 16px;
    }
    .op-card.open .op-body { display: block; }

    .op-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    .op-desc-text {
      margin: 0 0 12px;
      font-size: 13px;
      color: var(--text-secondary);
      max-width: 72ch;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }

    .panel-box {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      padding: 12px;
    }

    .panel-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .param-table {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .param-row {
      display: grid;
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }

    .param-name {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      padding-top: 7px;
      word-break: break-word;
    }
    .param-in {
      display: block;
      font-family: var(--font-sans);
      font-size: 11px;
      font-weight: 400;
      color: var(--text-muted);
    }

    .param-input-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-input, .field-textarea {
      width: 100%;
      border-radius: 6px;
      border: 1px solid var(--border-hairline);
      background: var(--bg-raised);
      color: var(--text-primary);
      padding: 7px 10px;
      font-family: var(--font-mono);
      font-size: 12px;
      transition: border-color 140ms var(--ease), background-color 140ms var(--ease);
    }
    .field-input { height: 34px; }
    .field-textarea { min-height: 104px; resize: vertical; line-height: 1.45; }
    .field-input:focus, .field-textarea:focus {
      outline: none;
      border-color: var(--accent);
      background: var(--bg-card);
    }

    .param-hint {
      font-size: 12px;
      color: var(--text-muted);
    }

    .action-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }

    .btn-primary {
      height: 36px;
      padding: 0 16px;
      border-radius: 8px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background-color 140ms var(--ease), transform 120ms var(--ease);
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:active { transform: scale(0.97); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-secondary {
      height: 36px;
      padding: 0 12px;
      border-radius: 8px;
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background-color 140ms var(--ease), transform 120ms var(--ease);
    }
    .btn-secondary:hover { background: var(--bg-hover); }
    .btn-secondary:active { transform: scale(0.97); }

    .write-warning {
      font-size: 12px;
      color: var(--warning);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Response Box */
    .res-box {
      margin-top: 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      overflow: hidden;
    }

    .res-header {
      padding: 8px 12px;
      background: var(--bg-raised);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
    }

    .res-badges {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .status-pill {
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .status-ok { background: var(--positive-soft); color: var(--positive); }
    .status-err { background: var(--danger-soft); color: var(--danger); }

    .res-pre {
      margin: 0;
      padding: 12px;
      max-height: 380px;
      overflow: auto;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .j-key { color: var(--accent-text); }
    .j-str { color: var(--positive); }
    .j-num { color: var(--warning); }
    .j-bool { color: var(--info); }
    .j-null { color: var(--text-muted); }

    .empty-state {
      background: var(--bg-card);
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      padding: 40px 24px;
      text-align: center;
      color: var(--text-secondary);
    }

    @media (max-width: 1024px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .main { padding: 20px 20px 48px; }
      .apikey-input { width: 108px; }
    }

    @media (max-width: 840px) {
      .mobile-menu-btn { display: inline-flex; }
      .brand-sub { display: none; }
      .search-wrap { margin-left: 0; }
      .search-kbd { display: none; }
      .apikey-label { display: none; }
      .apikey-input { width: 92px; }
      .sidebar {
        position: fixed;
        top: var(--header-h);
        left: 0;
        bottom: 0;
        z-index: 50;
        transform: translateX(-100%);
        transition: transform 200ms var(--ease);
        box-shadow: var(--shadow-md);
      }
      .sidebar.open { transform: translateX(0); }
      .sidebar-backdrop.open { display: block; }
      .op-main { grid-template-columns: 1fr; gap: 4px; }
      .param-row { grid-template-columns: 1fr; gap: 4px; }
      .param-name { padding-top: 0; }
    }

    @media (max-width: 560px) {
      .topbar { padding: 0 12px; gap: 6px; }
      .brand-text { display: none; }
      .apikey-input { width: 84px; }
      .json-link-top { display: none; }
      .main { padding: 16px 12px 40px; }
      .stats-grid { grid-template-columns: 1fr; }
      .btn-text-hide { display: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="เปิดเมนูหมวดหมู่">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>

    <a class="brand" href="#top">
      <div class="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M4 12h16"/><rect x="3" y="3" width="18" height="18" rx="4" stroke-opacity="0.35"/></svg>
      </div>
      <div class="brand-text">
        <span class="brand-title">Thoen Hospital API Gateway</span>
        <span class="brand-sub mono" id="gatewayVersion">OpenAPI 3.0</span>
      </div>
    </a>

    <div class="search-wrap">
      <span class="search-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </span>
      <input id="searchInput" class="search-input" type="text" placeholder="ค้นหาเส้นทาง, คำอธิบาย หรือพารามิเตอร์" autocomplete="off" />
      <span class="search-kbd" id="searchKbd"><kbd class="kbd">/</kbd></span>
      <button class="search-clear" id="searchClear" type="button" aria-label="ล้างคำค้นหา">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="header-actions">
      <div class="apikey-box" title="ใส่ x-api-key เพื่อทดสอบยิง API จริงในหน้านี้">
        <span class="apikey-status" id="apiKeyDot"></span>
        <span class="apikey-label">x-api-key</span>
        <input id="apiKeyInput" class="apikey-input" type="password" placeholder="ใส่ API Key" autocomplete="off" />
        <button id="toggleKeyVis" type="button" aria-label="แสดงหรือซ่อน API Key" style="color:var(--text-muted);display:flex;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <button class="btn-icon" id="themeToggle" type="button" aria-label="สลับโหมดสว่างหรือมืด">
        <svg id="themeIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      </button>

      <a class="btn-icon json-link-top" href="/docs/json" target="_blank" rel="noopener">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
        <span class="btn-text-hide">OpenAPI JSON</span>
      </a>
    </div>
  </header>

  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

  <div class="shell" id="top">
    <aside class="sidebar" id="sidebar" aria-label="หมวดหมู่บริการ API">
      <div>
        <div class="method-filter-bar" role="group" aria-label="กรองตาม HTTP Method">
          <button class="method-pill active" data-method="ALL">All</button>
          <button class="method-pill" data-method="GET">GET</button>
          <button class="method-pill" data-method="POST">POST</button>
          <button class="method-pill" data-method="PUT">PUT</button>
          <button class="method-pill" data-method="DELETE">DEL</button>
        </div>
      </div>

      <div>
        <div class="nav-section-title">หมวดหมู่บริการ (12 หมวด)</div>
        <nav class="nav-list" id="navList"></nav>
      </div>

      <div style="padding-top:8px;border-top:1px solid var(--border-hairline);">
        <a class="btn-secondary" href="/docs/json" target="_blank" rel="noopener" style="width:100%;justify-content:center;text-decoration:none;">
          ดาวน์โหลด OpenAPI JSON
        </a>
      </div>
    </aside>

    <main class="main">
      <div class="overview-header">
        <div>
          <h1 class="page-title">ศูนย์รวมคู่มือและทดสอบ API โรงพยาบาลเถิน</h1>
          <p class="page-desc" id="gatewayDesc">ระบบศูนย์กลางเชื่อมต่อข้อมูลโรงพยาบาลเถิน (HOSxP, Salary และ Website Application) แบบ Named Endpoints</p>
        </div>
        <button class="base-url-chip" id="copyBaseUrlBtn" type="button" title="คัดลอก Base URL">
          <span id="baseUrlText">http://192.168.1.208:8443</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>

      <section class="stats-grid" aria-label="สรุปสถานะระบบและจำนวนเส้นทาง">
        <div class="stat-card">
          <div class="stat-label"><span>เส้นทาง API ทั้งหมด</span></div>
          <div class="stat-value" id="statTotal">--</div>
          <div class="stat-meta" id="statGroups">กำลังโหลดโครงสร้าง OpenAPI</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span>HOSxP Database</span><span class="live-dot" id="dotHos"></span></div>
          <div class="stat-value" id="statHos">--</div>
          <div class="stat-meta" id="metaHos">รอตรวจสอบจาก /health</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span>Salary Database</span><span class="live-dot" id="dotSal"></span></div>
          <div class="stat-value" id="statSal">--</div>
          <div class="stat-meta" id="metaSal">รอตรวจสอบจาก /health</div>
        </div>
        <div class="stat-card">
          <div class="stat-label"><span>Website Database</span><span class="live-dot" id="dotApp"></span></div>
          <div class="stat-value" id="statApp">--</div>
          <div class="stat-meta" id="metaApp">รอตรวจสอบจาก /health</div>
        </div>
      </section>

      <div class="content-toolbar">
        <div class="result-summary" id="resultSummary">กำลังโหลดรายการ API...</div>
        <div class="toolbar-btns">
          <button class="btn-secondary" id="refreshHealthBtn" type="button">ตรวจสถานะ DB</button>
          <button class="btn-secondary" id="collapseAllBtn" type="button">พับทุกรายการ</button>
        </div>
      </div>

      <div id="groupsContainer"></div>
    </main>
  </div>

  <script>
    const state = {
      spec: null,
      groups: [],
      search: '',
      method: 'ALL',
      activeTag: null,
      apiKey: sessionStorage.getItem('thoen_gw_apikey') || '',
      theme: localStorage.getItem('thoen_gw_theme') || 'light'
    };

    const el = (id) => document.getElementById(id);

    function esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function applyTheme(theme) {
      state.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('thoen_gw_theme', theme);
      el('themeIcon').innerHTML = theme === 'dark'
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
        : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    }

    function updateApiKey(val) {
      state.apiKey = val.trim();
      sessionStorage.setItem('thoen_gw_apikey', state.apiKey);
      el('apiKeyDot').classList.toggle('ready', state.apiKey.length > 0);
    }

    function highlightPath(path) {
      return esc(path)
        .replace(/\//g, '/<wbr>')
        .replace(/(\{[^}]+\})/g, '<span class="param-seg">$1</span>');
    }

    function highlightJson(obj) {
      const raw = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
      return esc(raw).replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'j-num';
          if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'j-key' : 'j-str';
          } else if (/true|false/.test(match)) {
            cls = 'j-bool';
          } else if (/null/.test(match)) {
            cls = 'j-null';
          }
          return '<span class="' + cls + '">' + match + '</span>';
        }
      );
    }

    function buildExampleFromSchema(schema) {
      if (!schema || typeof schema !== 'object') return {};
      if (schema.example !== undefined) return schema.example;
      if (schema.type === 'object' && schema.properties) {
        const obj = {};
        for (const [k, v] of Object.entries(schema.properties)) {
          if (v.default !== undefined) obj[k] = v.default;
          else if (v.type === 'integer' || v.type === 'number') obj[k] = 0;
          else if (v.type === 'boolean') obj[k] = false;
          else if (v.type === 'array') obj[k] = [];
          else obj[k] = '';
        }
        return obj;
      }
      return {};
    }

    function extractPathParams(path, declaredParams) {
      const result = [];
      const seen = new Set();
      for (const p of declaredParams || []) {
        result.push(p);
        seen.add(p.in + ':' + p.name);
      }
      const matches = path.match(/\{([^}]+)\}/g) || [];
      for (const m of matches) {
        const name = m.slice(1, -1);
        if (!seen.has('path:' + name)) {
          result.unshift({ name, in: 'path', required: true, schema: { type: 'string' }, description: 'พารามิเตอร์บน URL Path' });
        }
      }
      return result;
    }

    function parseSpec(spec) {
      const tagOrder = (spec.tags || []).map((t) => ({
        name: t.name,
        description: t.description || '',
        ops: []
      }));
      const byTag = new Map(tagOrder.map((g) => [g.name, g]));

      const methods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const [path, pathItem] of Object.entries(spec.paths || {})) {
        for (const m of methods) {
          const op = pathItem[m];
          if (!op) continue;
          const tagName = (op.tags && op.tags[0]) || 'อื่นๆ (Uncategorized)';
          if (!byTag.has(tagName)) {
            const g = { name: tagName, description: '', ops: [] };
            byTag.set(tagName, g);
            tagOrder.push(g);
          }
          const params = extractPathParams(path, op.parameters || []);
          const bodySchema = op.requestBody?.content?.['application/json']?.schema || null;
          byTag.get(tagName).ops.push({
            id: m.toUpperCase() + ' ' + path,
            method: m.toUpperCase(),
            path,
            tag: tagName,
            summary: op.summary || '',
            description: op.description || '',
            params,
            hasBody: ['POST', 'PUT', 'PATCH'].includes(m.toUpperCase()) || !!bodySchema,
            bodyExample: bodySchema ? buildExampleFromSchema(bodySchema) : null,
            responseSchema: op.responses?.['200']?.content?.['application/json']?.schema || null,
            searchText: (m + ' ' + path + ' ' + (op.summary || '') + ' ' + (op.description || '') + ' ' + tagName + ' ' + params.map((p) => p.name).join(' ')).toLowerCase()
          });
        }
      }
      return tagOrder.filter((g) => g.ops.length > 0);
    }

    function matchesFilter(op) {
      if (state.method !== 'ALL') {
        if (state.method === 'PUT') {
          if (op.method !== 'PUT' && op.method !== 'PATCH') return false;
        } else if (op.method !== state.method) {
          return false;
        }
      }
      if (state.search) {
        const terms = state.search.toLowerCase().split(/\s+/).filter(Boolean);
        for (const term of terms) {
          if (!op.searchText.includes(term)) return false;
        }
      }
      return true;
    }

    function splitTagLabel(name) {
      const m = name.match(/^(\d+)\.\s*(.+)$/);
      return m ? { num: m[1], label: m[2] } : { num: '--', label: name };
    }

    function renderSidebar() {
      const nav = el('navList');
      const filteredGroups = state.groups.map((g) => ({
        ...g,
        visibleCount: g.ops.filter(matchesFilter).length
      }));

      let html = '<button class="nav-item ' + (state.activeTag === null ? 'active' : '') + '" data-tag="__ALL__">' +
        '<span class="nav-num">00</span>' +
        '<span class="nav-label">แสดงทุกหมวดหมู่</span>' +
        '<span class="nav-count">' + filteredGroups.reduce((s, g) => s + g.visibleCount, 0) + '</span>' +
        '</button>';

      for (const g of filteredGroups) {
        const { num, label } = splitTagLabel(g.name);
        const isActive = state.activeTag === g.name;
        html += '<button class="nav-item ' + (isActive ? 'active' : '') + '" data-tag="' + esc(g.name) + '">' +
          '<span class="nav-num">' + esc(num) + '</span>' +
          '<span class="nav-label" title="' + esc(label) + '">' + esc(label) + '</span>' +
          '<span class="nav-count">' + g.visibleCount + '</span>' +
          '</button>';
      }
      nav.innerHTML = html;

      nav.querySelectorAll('.nav-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const t = btn.getAttribute('data-tag');
          state.activeTag = t === '__ALL__' ? null : t;
          renderSidebar();
          renderGroups();
          if (window.innerWidth <= 840) toggleMobileSidebar(false);
          if (t !== '__ALL__') {
            const sec = document.querySelector('[data-group="' + CSS.escape(t) + '"]');
            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });
    }

    function renderOpBody(op) {
      const pathParams = op.params.filter((p) => p.in === 'path');
      const queryParams = op.params.filter((p) => p.in === 'query');
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(op.method);
      const isPublic = op.path === '/health' || op.path.startsWith('/docs');

      let html = '<div class="op-body">';
      if (op.description) {
        html += '<p class="op-desc-text">' + esc(op.description) + '</p>';
      }

      html += '<div class="detail-grid">';
      if (pathParams.length || queryParams.length) {
        html += '<div class="panel-box"><div class="panel-title"><span>พารามิเตอร์คำขอ (Parameters)</span><span class="mono" style="font-weight:400;color:var(--text-muted)">' + (isPublic ? 'ไม่ต้องใช้ x-api-key' : 'ใช้ x-api-key') + '</span></div><div class="param-table">';
        for (const p of [...pathParams, ...queryParams]) {
          const defVal = p.schema?.default !== undefined ? String(p.schema.default) : '';
          const reqMark = p.required ? ' *' : '';
          const enumHint = p.schema?.enum ? ' (' + p.schema.enum.join(' | ') + ')' : '';
          html += '<div class="param-row">' +
            '<label class="param-name">' + esc(p.name) + esc(reqMark) + '<span class="param-in">' + esc(p.in) + (p.schema?.type ? ' · ' + esc(p.schema.type) : '') + '</span></label>' +
            '<div class="param-input-wrap">' +
            '<input class="field-input op-param-input" data-in="' + esc(p.in) + '" data-name="' + esc(p.name) + '" value="' + esc(defVal) + '" placeholder="' + esc(p.name + enumHint) + '" />' +
            (p.description ? '<span class="param-hint">' + esc(p.description) + '</span>' : '') +
            '</div></div>';
        }
        html += '</div></div>';
      } else {
        html += '<div class="panel-box"><div class="panel-title"><span>ข้อมูลการเรียกใช้งาน</span><span class="mono" style="font-weight:400;color:var(--text-muted)">' + (isPublic ? 'Public Endpoint' : 'Header: x-api-key') + '</span></div>' +
          '<div class="param-hint">' + (op.hasBody ? 'กรอก JSON Payload ด้านล่างเพื่อทดสอบส่งข้อมูล' : 'เส้นทางนี้ไม่มี Path/Query Parameters ที่บังคับ') + '</div></div>';
      }

      if (op.hasBody) {
        const initBody = op.bodyExample ? JSON.stringify(op.bodyExample, null, 2) : '{\n  \n}';
        html += '<div class="panel-box"><div class="panel-title"><span>Request Body (JSON)</span></div>' +
          '<textarea class="field-textarea op-body-input" spellcheck="false">' + esc(initBody) + '</textarea></div>';
      }

      html += '</div>';

      html += '<div class="action-bar">' +
        '<button class="btn-primary op-send-btn" type="button">ส่งคำขอ (Send Request)</button>' +
        '<button class="btn-secondary op-curl-btn" type="button">คัดลอก cURL</button>' +
        '<button class="btn-secondary op-copy-path-btn" type="button">คัดลอก Path</button>' +
        (isWrite ? '<span class="write-warning">คำขอนี้มีการเขียนหรือแก้ไขข้อมูลจริง</span>' : '') +
        '</div>';

      html += '<div class="res-box op-res-box" style="display:none"></div>';
      html += '</div>';
      return html;
    }

    function buildRequestInfo(card, op) {
      let resolvedPath = op.path;
      const query = new URLSearchParams();
      card.querySelectorAll('.op-param-input').forEach((inp) => {
        const val = inp.value.trim();
        const name = inp.getAttribute('data-name');
        const loc = inp.getAttribute('data-in');
        if (loc === 'path') {
          resolvedPath = resolvedPath.replace('{' + name + '}', encodeURIComponent(val || '{' + name + '}'));
        } else if (loc === 'query' && val !== '') {
          query.set(name, val);
        }
      });
      const qs = query.toString();
      const urlPath = resolvedPath + (qs ? '?' + qs : '');
      const fullUrl = window.location.origin + urlPath;
      const bodyEl = card.querySelector('.op-body-input');
      const rawBody = bodyEl ? bodyEl.value.trim() : '';
      return { urlPath, fullUrl, rawBody };
    }

    function bindCardActions(card, op) {
      const row = card.querySelector('.op-row');
      row.addEventListener('click', () => {
        const isOpen = card.classList.contains('open');
        if (!isOpen && !card.querySelector('.op-body')) {
          card.insertAdjacentHTML('beforeend', renderOpBody(op));
          bindExpandedActions(card, op);
        }
        card.classList.toggle('open');
      });
    }

    function bindExpandedActions(card, op) {
      const sendBtn = card.querySelector('.op-send-btn');
      const curlBtn = card.querySelector('.op-curl-btn');
      const pathBtn = card.querySelector('.op-copy-path-btn');
      const resBox = card.querySelector('.op-res-box');

      pathBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(op.path);
        pathBtn.textContent = 'คัดลอกแล้ว';
        setTimeout(() => { pathBtn.textContent = 'คัดลอก Path'; }, 1200);
      });

      curlBtn.addEventListener('click', () => {
        const { fullUrl, rawBody } = buildRequestInfo(card, op);
        const keyVal = state.apiKey || '<YOUR_API_KEY>';
        let cmd = 'curl -X ' + op.method + ' "' + fullUrl + '" \\\n  -H "x-api-key: ' + keyVal + '"';
        if (op.hasBody && rawBody && rawBody !== '{}') {
          cmd += ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + rawBody.replace(/'/g, "'\\''") + '\'';
        }
        navigator.clipboard?.writeText(cmd);
        curlBtn.textContent = 'คัดลอก cURL แล้ว';
        setTimeout(() => { curlBtn.textContent = 'คัดลอก cURL'; }, 1400);
      });

      sendBtn.addEventListener('click', async () => {
        const { urlPath, rawBody } = buildRequestInfo(card, op);
        if (urlPath.includes('{')) {
          resBox.style.display = 'block';
          resBox.innerHTML = '<div class="res-header"><div class="res-badges"><span class="status-pill status-err">Missing Path Param</span></div></div><pre class="res-pre">กรุณาระบุค่า Path Parameter ให้ครบก่อนส่งคำขอ</pre>';
          return;
        }
        sendBtn.disabled = true;
        sendBtn.textContent = 'กำลังส่งคำขอ...';
        const headers = {};
        if (state.apiKey) headers['x-api-key'] = state.apiKey;
        const fetchOpts = { method: op.method, headers };
        if (op.hasBody && rawBody) {
          headers['Content-Type'] = 'application/json';
          fetchOpts.body = rawBody;
        }
        const t0 = performance.now();
        try {
          const resp = await fetch(urlPath, fetchOpts);
          const ms = Math.round(performance.now() - t0);
          const text = await resp.text();
          let bodyHtml;
          try {
            bodyHtml = highlightJson(JSON.parse(text));
          } catch {
            bodyHtml = esc(text);
          }
          const ok = resp.ok;
          const kb = (new Blob([text]).size / 1024).toFixed(1);
          resBox.style.display = 'block';
          resBox.innerHTML = '<div class="res-header">' +
            '<div class="res-badges">' +
            '<span class="status-pill ' + (ok ? 'status-ok' : 'status-err') + '">' + resp.status + ' ' + esc(resp.statusText) + '</span>' +
            '<span>' + ms + ' ms</span>' +
            '<span>' + kb + ' KB</span>' +
            '</div>' +
            '<button class="btn-secondary op-copy-res-btn" type="button" style="height:28px;font-size:12px;">คัดลอกผลลัพธ์</button>' +
            '</div>' +
            '<pre class="res-pre">' + bodyHtml + '</pre>';
          resBox.querySelector('.op-copy-res-btn').addEventListener('click', (e) => {
            navigator.clipboard?.writeText(text);
            e.target.textContent = 'คัดลอกแล้ว';
            setTimeout(() => { e.target.textContent = 'คัดลอกผลลัพธ์'; }, 1200);
          });
        } catch (err) {
          resBox.style.display = 'block';
          resBox.innerHTML = '<div class="res-header"><div class="res-badges"><span class="status-pill status-err">Network Error</span></div></div><pre class="res-pre">' + esc(err.message) + '</pre>';
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = 'ส่งคำขอ (Send Request)';
        }
      });
    }

    function renderGroups() {
      const container = el('groupsContainer');
      const groupsToRender = state.groups
        .filter((g) => !state.activeTag || g.name === state.activeTag)
        .map((g) => ({ ...g, ops: g.ops.filter(matchesFilter) }))
        .filter((g) => g.ops.length > 0);

      const visibleTotal = groupsToRender.reduce((s, g) => s + g.ops.length, 0);
      el('resultSummary').textContent = 'แสดง ' + visibleTotal + ' เส้นทาง จาก ' + groupsToRender.length + ' หมวดหมู่';

      if (groupsToRender.length === 0) {
        container.innerHTML = '<div class="empty-state">ไม่พบเส้นทาง API ที่ตรงกับเงื่อนไขการค้นหา ลองเปลี่ยนคำค้นหรือรีเซ็ตตัวกรอง HTTP Method</div>';
        return;
      }

      container.innerHTML = '';
      for (const g of groupsToRender) {
        const sec = document.createElement('section');
        sec.className = 'group-section';
        sec.setAttribute('data-group', g.name);

        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML = '<div class="group-title-wrap">' +
          '<h2 class="group-title">' + esc(g.name) + ' <span class="group-count">' + g.ops.length + ' endpoints</span></h2>' +
          (g.description ? '<p class="group-desc">' + esc(g.description) + '</p>' : '') +
          '</div>';
        sec.appendChild(header);

        const list = document.createElement('div');
        list.className = 'endpoint-list';
        for (const op of g.ops) {
          const card = document.createElement('article');
          card.className = 'op-card';
          card.innerHTML = '<button class="op-row" type="button">' +
            '<span class="method-badge m-' + op.method + '">' + op.method + '</span>' +
            '<span class="op-main">' +
            '<span class="op-path">' + highlightPath(op.path) + '</span>' +
            '<span class="op-summary">' + esc(op.summary || 'ไม่มีคำอธิบาย') + '</span>' +
            '</span>' +
            '<span class="op-chevron" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>' +
            '</button>';
          bindCardActions(card, op);
          list.appendChild(card);
        }
        sec.appendChild(list);
        container.appendChild(sec);
      }
    }

    async function loadHealth() {
      try {
        const r = await fetch('/health');
        const d = await r.json();
        const dbs = d.databases || {};
        const setDb = (key, statId, metaId, dotId) => {
          const db = dbs[key];
          if (!db) return;
          el(statId).textContent = db.connected ? db.latencyMs + ' ms' : 'Offline';
          el(metaId).textContent = db.host + ' · ' + db.database;
          el(dotId).className = 'live-dot ' + (db.connected ? 'up' : 'down');
        };
        setDb('hosxp', 'statHos', 'metaHos', 'dotHos');
        setDb('salary', 'statSal', 'metaSal', 'dotSal');
        setDb('website', 'statApp', 'metaApp', 'dotApp');
      } catch {
        ['dotHos', 'dotSal', 'dotApp'].forEach((id) => { el(id).className = 'live-dot down'; });
      }
    }

    function toggleMobileSidebar(open) {
      el('sidebar').classList.toggle('open', open);
      el('sidebarBackdrop').classList.toggle('open', open);
    }

    async function init() {
      applyTheme(state.theme);
      el('baseUrlText').textContent = window.location.origin;
      el('apiKeyInput').value = state.apiKey;
      updateApiKey(state.apiKey);

      el('themeToggle').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
      el('mobileMenuBtn').addEventListener('click', () => toggleMobileSidebar(!el('sidebar').classList.contains('open')));
      el('sidebarBackdrop').addEventListener('click', () => toggleMobileSidebar(false));
      el('refreshHealthBtn').addEventListener('click', loadHealth);

      el('copyBaseUrlBtn').addEventListener('click', () => {
        navigator.clipboard?.writeText(window.location.origin);
        const orig = el('baseUrlText').textContent;
        el('baseUrlText').textContent = 'คัดลอก URL แล้ว';
        setTimeout(() => { el('baseUrlText').textContent = orig; }, 1200);
      });

      el('apiKeyInput').addEventListener('input', (e) => updateApiKey(e.target.value));
      el('toggleKeyVis').addEventListener('click', () => {
        const inp = el('apiKeyInput');
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });

      el('collapseAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.op-card.open').forEach((c) => c.classList.remove('open'));
      });

      document.querySelectorAll('.method-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.method-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          state.method = btn.getAttribute('data-method');
          renderSidebar();
          renderGroups();
        });
      });

      let searchTimer = null;
      const searchInput = el('searchInput');
      const searchClear = el('searchClear');
      const searchKbd = el('searchKbd');
      const syncSearchUi = () => {
        const hasText = searchInput.value.length > 0;
        searchClear.classList.toggle('visible', hasText);
        searchKbd.style.display = hasText ? 'none' : 'flex';
      };

      searchInput.addEventListener('input', () => {
        syncSearchUi();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.search = searchInput.value.trim();
          renderSidebar();
          renderGroups();
        }, 120);
      });

      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        syncSearchUi();
        renderSidebar();
        renderGroups();
        searchInput.focus();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInput.focus();
        }
      });

      try {
        const res = await fetch('/docs/json');
        const spec = await res.json();
        state.spec = spec;
        el('gatewayVersion').textContent = 'v' + (spec.info?.version || '1.0.0') + ' · OpenAPI ' + (spec.openapi || '3.0');
        if (spec.info?.description) el('gatewayDesc').textContent = spec.info.description;
        state.groups = parseSpec(spec);
        const totalOps = state.groups.reduce((s, g) => s + g.ops.length, 0);
        el('statTotal').textContent = totalOps;
        el('statGroups').textContent = state.groups.length + ' หมวดงาน (เรียงตามระบบ)';
        renderSidebar();
        renderGroups();
      } catch (err) {
        el('groupsContainer').innerHTML = '<div class="empty-state">ไม่สามารถโหลดสเปก OpenAPI จาก /docs/json ได้: ' + esc(err.message) + '</div>';
      }

      loadHealth();
    }

    init();
  </script>
</body>
</html>`;

export default async function docsPortalRoutes(fastify) {
  fastify.get('/docs', { schema: { hide: true } }, async (req, reply) => {
    return reply.redirect('/docs/')
  })

  fastify.get('/docs/', { schema: { hide: true } }, async (req, reply) => {
    reply.type('text/html; charset=utf-8')
    return PORTAL_HTML
  })

  fastify.get('/docs/json', { schema: { hide: true } }, async (req, reply) => {
    reply.type('application/json; charset=utf-8')
    return fastify.swagger()
  })

  fastify.get('/docs/openapi.json', { schema: { hide: true } }, async (req, reply) => {
    reply.type('application/json; charset=utf-8')
    return fastify.swagger()
  })
}
