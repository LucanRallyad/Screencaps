import type { Page } from "playwright";

const BAR_ID = "screencaps-browser-bar";

function faviconSvg(): string {
  // Generic globe favicon placeholder — most publisher sites we don't have a
  // real favicon handy for, and a blank tab reads as more "off" than a globe.
  return `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;">
  <circle cx="8" cy="8" r="7" fill="#dadce0"/>
  <path d="M1 8h14M8 1c2 2.2 2 11.8 0 14M8 1c-2 2.2-2 11.8 0 14" stroke="#9aa0a6" stroke-width="1"/>
</svg>`;
}

export async function injectBrowserBar(page: Page, url: string, isMobile: boolean): Promise<void> {
  const esc = (s: string) => s.replace(/'/g, "\\'").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let host = url;
  let pathAndQuery = "";
  let title = url;
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    pathAndQuery = `${u.pathname}${u.search}`.replace(/\/$/, "");
    title = host.split(".")[0];
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } catch {}
  host = esc(host);
  pathAndQuery = esc(pathAndQuery);
  title = esc(title);

  try {
    await page.evaluate(
      ({ id, hostStr, pathStr, titleStr, favicon, mobile }) => {
        document.getElementById(id)?.remove();

        const bar = document.createElement("div");
        bar.id = id;

        if (!mobile) {
          // ── Desktop Chrome, light theme (macOS) ─────────────────────────────
          bar.innerHTML = `
<div style="
  position:fixed;top:0;left:0;right:0;
  z-index:2147483647;
  font-family:'Segoe UI',-apple-system,'Google Sans',Roboto,'Helvetica Neue',sans-serif;
  -webkit-font-smoothing:antialiased;
  box-sizing:border-box;
  box-shadow:0 1px 3px rgba(0,0,0,0.15);
">
  <!-- Tab strip -->
  <div style="
    height:36px;background:#dee1e6;
    display:flex;align-items:flex-end;
    padding:0 8px;box-sizing:border-box;
  ">
    <!-- macOS traffic lights -->
    <div style="display:flex;align-items:center;gap:8px;padding-bottom:11px;margin-right:14px;">
      <div style="width:12px;height:12px;border-radius:50%;background:#ed6a5e;"></div>
      <div style="width:12px;height:12px;border-radius:50%;background:#f4bf4f;"></div>
      <div style="width:12px;height:12px;border-radius:50%;background:#61c454;"></div>
    </div>
    <!-- Active tab -->
    <div style="
      height:34px;min-width:200px;max-width:240px;flex-shrink:1;
      background:#ffffff;border-radius:9px 9px 0 0;
      display:flex;align-items:center;gap:7px;
      padding:0 10px;box-sizing:border-box;overflow:hidden;
    ">
      ${favicon}
      <span style="
        color:#3c4043;font-size:12.5px;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;
      ">${titleStr}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="flex-shrink:0;opacity:0.5;">
        <path d="M1 1L9 9M9 1L1 9" stroke="#5f6368" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </div>
    <!-- New tab + -->
    <div style="
      width:28px;height:28px;margin:0 0 4px 4px;
      display:flex;align-items:center;justify-content:center;
      border-radius:50%;flex-shrink:0;
    ">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round"/></svg>
    </div>
  </div>

  <!-- Toolbar / omnibox row -->
  <div style="
    height:40px;background:#ffffff;
    display:flex;align-items:center;gap:14px;
    padding:0 10px;box-sizing:border-box;
    border-bottom:1px solid #e3e4e6;
  ">
    <!-- Back -->
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.85;">
      <path d="M10 3L5.5 8L10 13" stroke="#5f6368" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <!-- Forward (disabled) -->
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.32;">
      <path d="M6 3L10.5 8L6 13" stroke="#5f6368" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <!-- Reload -->
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.85;">
      <path d="M13.5 8A5.5 5.5 0 1 1 10 3.1" stroke="#5f6368" stroke-width="1.75" stroke-linecap="round"/>
      <path d="M10 1v2.5H12.5" stroke="#5f6368" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>

    <!-- Omnibox -->
    <div style="
      flex:1;min-width:0;height:32px;
      background:#f1f3f4;border-radius:16px;
      display:flex;align-items:center;padding:0 12px;gap:8px;
    ">
      <!-- Lock icon -->
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;">
        <rect x="3" y="6" width="8" height="6.5" rx="1.3" stroke="#5f6368" stroke-width="1.1"/>
        <path d="M4.5 6V4.2a2.5 2.5 0 0 1 5 0V6" stroke="#5f6368" stroke-width="1.1"/>
      </svg>
      <span style="color:#3c4043;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        <span style="color:#3c4043;">${hostStr}</span><span style="color:#5f6368;">${pathStr}</span>
      </span>
      <span style="flex:1;"></span>
      <!-- Bookmark star -->
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.75;">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>

    <!-- Extensions (puzzle piece) -->
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="1.6" style="flex-shrink:0;opacity:0.75;">
      <path d="M14 4a2 2 0 1 0-4 0v1H7a1 1 0 0 0-1 1v3H5a2 2 0 1 0 0 4h1v3a1 1 0 0 0 1 1h3v-1a2 2 0 1 1 4 0v1h3a1 1 0 0 0 1-1v-3h1a2 2 0 1 0 0-4h-1V6a1 1 0 0 0-1-1h-3V4Z"/>
    </svg>
    <!-- Profile avatar -->
    <div style="
      width:24px;height:24px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,#8b5cf6,#ec4899);
    "></div>
    <!-- Kebab menu -->
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#5f6368" style="flex-shrink:0;opacity:0.85;">
      <circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>
    </svg>
  </div>
</div>`;
        } else {
          // ── Mobile Chrome, light theme ───────────────────────────────────
          bar.innerHTML = `
<div style="
  position:fixed;top:0;left:0;right:0;height:52px;
  background:#ffffff;
  z-index:2147483647;
  display:flex;align-items:center;padding:8px 10px;gap:8px;
  font-family:-apple-system,'Google Sans',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  box-sizing:border-box;
  box-shadow:0 1px 3px rgba(0,0,0,0.12);
">
  <!-- Omnibox pill -->
  <div style="
    flex:1;min-width:0;height:36px;
    background:#f1f3f4;
    border-radius:18px;
    display:flex;align-items:center;padding:0 12px;gap:8px;
  ">
    ${favicon}
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;">
      <rect x="3" y="6" width="8" height="6.5" rx="1.3" stroke="#5f6368" stroke-width="1.1"/>
      <path d="M4.5 6V4.2a2.5 2.5 0 0 1 5 0V6" stroke="#5f6368" stroke-width="1.1"/>
    </svg>
    <span style="
      color:#3c4043;font-size:14px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      flex:1;min-width:0;
    ">${hostStr}</span>
  </div>
  <!-- Tab count -->
  <div style="
    width:28px;height:28px;
    border:1.75px solid #5f6368;border-radius:6px;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:600;color:#5f6368;
    flex-shrink:0;
  ">1</div>
  <!-- Kebab menu -->
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#5f6368" style="flex-shrink:0;">
    <circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>
  </svg>
</div>`;
        }

        document.documentElement.appendChild(bar);
      },
      { id: BAR_ID, hostStr: host, pathStr: pathAndQuery, titleStr: title, favicon: faviconSvg(), mobile: isMobile },
    );
  } catch {
    // non-fatal
  }
}

export async function removeBrowserBar(page: Page): Promise<void> {
  try {
    await page.evaluate((id) => document.getElementById(id)?.remove(), BAR_ID);
  } catch {}
}
