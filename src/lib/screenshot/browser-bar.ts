import type { Page } from "playwright";

const BAR_ID = "screencaps-browser-bar";

export async function injectBrowserBar(page: Page, url: string, isMobile: boolean): Promise<void> {
  const escaped = url.replace(/'/g, "\\'").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await page.evaluate(
      ({ id, urlStr, mobile }) => {
        document.getElementById(id)?.remove();

        const bar = document.createElement("div");
        bar.id = id;

        if (!mobile) {
          // ── Desktop Chrome dark — faithful to the real toolbar ────────────
          // Outer bar: #202124, ~44 px tall
          // URL field:  #303134, subtle 8 px radius, spans almost full width
          // Nav icons: left-aligned, muted gray
          // Star:       far right, outside field
          bar.innerHTML = `
<div style="
  position:fixed;top:0;left:0;right:0;height:44px;
  background:#202124;
  z-index:2147483647;
  display:flex;align-items:center;
  padding:0 10px;gap:4px;
  font-family:-apple-system,'Google Sans',Roboto,'Helvetica Neue',sans-serif;
  -webkit-font-smoothing:antialiased;
  box-sizing:border-box;
  border-bottom:1px solid rgba(255,255,255,0.06);
">
  <!-- Back -->
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.55;cursor:default;">
    <path d="M10 3L5.5 8L10 13" stroke="#bdc1c6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <!-- Forward (dimmer — can't go forward) -->
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.25;cursor:default;">
    <path d="M6 3L10.5 8L6 13" stroke="#bdc1c6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <!-- Reload -->
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;opacity:0.55;cursor:default;margin-right:2px;">
    <path d="M13.5 8A5.5 5.5 0 1 1 10 3.1" stroke="#bdc1c6" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M10 1v2.5H12.5" stroke="#bdc1c6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>

  <!-- URL field — fills most of the bar -->
  <div style="
    flex:1;min-width:0;
    background:#303134;
    border-radius:8px;height:28px;
    display:flex;align-items:center;padding:0 10px;gap:6px;
    border:1px solid rgba(255,255,255,0.07);
  ">
    <!-- Site-info / lock icon -->
    <svg width="12" height="12" viewBox="0 0 14 16" fill="none" style="flex-shrink:0;opacity:0.75;">
      <rect x="1" y="6.5" width="12" height="8.5" rx="2" fill="none" stroke="#9aa0a6" stroke-width="1.3"/>
      <path d="M4 6.5V4.5a3 3 0 0 1 6 0v2" stroke="#9aa0a6" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <!-- URL text -->
    <span style="
      color:#e8eaed;font-size:13px;letter-spacing:0.01em;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      flex:1;min-width:0;
    ">${urlStr}</span>
  </div>

  <!-- Bookmark star -->
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.6;margin-left:4px;cursor:default;">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
</div>`;
        } else {
          // ── Mobile Chrome dark (top bar) ────────────────────────────────
          bar.innerHTML = `
<div style="
  position:fixed;top:0;left:0;right:0;height:48px;
  background:#202124;
  z-index:2147483647;
  display:flex;align-items:center;padding:0 10px;gap:8px;
  font-family:-apple-system,'Google Sans',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  border-bottom:1px solid rgba(255,255,255,0.07);
  box-sizing:border-box;
">
  <!-- URL field — full width on mobile -->
  <div style="
    flex:1;min-width:0;
    background:#303134;
    border-radius:8px;height:32px;
    display:flex;align-items:center;padding:0 10px;gap:6px;
    border:1px solid rgba(255,255,255,0.07);
  ">
    <svg width="11" height="11" viewBox="0 0 14 16" fill="none" style="flex-shrink:0;opacity:0.7;">
      <rect x="1" y="6.5" width="12" height="8.5" rx="2" fill="none" stroke="#9aa0a6" stroke-width="1.3"/>
      <path d="M4 6.5V4.5a3 3 0 0 1 6 0v2" stroke="#9aa0a6" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <span style="
      color:#e8eaed;font-size:13px;letter-spacing:0.01em;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      flex:1;min-width:0;text-align:center;
    ">${urlStr}</span>
  </div>
  <!-- Tab count -->
  <div style="
    width:26px;height:26px;
    border:1.5px solid #9aa0a6;border-radius:5px;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:600;color:#9aa0a6;
    flex-shrink:0;
  ">1</div>
</div>`;
        }

        document.documentElement.appendChild(bar);
      },
      { id: BAR_ID, urlStr: escaped, mobile: isMobile },
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
