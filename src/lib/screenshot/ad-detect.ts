import type { Page } from "playwright";

export type DetectedSlot = {
  selectorId: string;
  width: number;
  height: number;
  top: number;           // absolute document Y position
  network: string | null;
};

export const COMMON_AD_SIZES: ReadonlyArray<{ w: number; h: number }> = [
  { w: 300, h: 250 }, { w: 336, h: 280 }, { w: 728, h: 90 },
  { w: 970, h: 250 }, { w: 970, h: 90 }, { w: 300, h: 600 },
  { w: 160, h: 600 }, { w: 250, h: 250 }, { w: 200, h: 200 },
  { w: 468, h: 60 }, { w: 320, h: 50 }, { w: 320, h: 100 },
  { w: 300, h: 50 }, { w: 250, h: 360 }, { w: 980, h: 250 },
  { w: 1200, h: 628 }, { w: 320, h: 480 },
];

/**
 * Detect ad slots. Stores each slot's original outerHTML in
 * window.__screencaps_originals so we can restore after replacing.
 */
export async function detectAdSlots(page: Page): Promise<DetectedSlot[]> {
  const sizes = COMMON_AD_SIZES.map(({ w, h }) => [w, h] as [number, number]);
  try {
    return await page.evaluate((sizes) => {
      const tolerance = 4;
      const networkPatterns = [
        { name: "gpt",        rx: /(googletag|googlesyndication|doubleclick|google_ads_iframe|gpt)/i },
        { name: "criteo",     rx: /(criteo|cas\.criteo)/i },
        { name: "taboola",    rx: /taboola/i },
        { name: "outbrain",   rx: /outbrain/i },
        { name: "amazon",     rx: /(amazon-adsystem|aax\.amazon)/i },
        { name: "appnexus",   rx: /(adnxs|appnexus)/i },
        { name: "rubicon",    rx: /rubiconproject/i },
        { name: "openx",      rx: /openx/i },
        { name: "pubmatic",   rx: /pubmatic/i },
        { name: "indexex",    rx: /(indexexchange|casalemedia)/i },
      ];

      function describeNetwork(el: Element): string | null {
        const h = [el.getAttribute("src") ?? "", el.id, typeof el.className === "string" ? el.className : ""].join(" ");
        const parent = el.parentElement;
        const ph = parent ? [parent.id, typeof parent.className === "string" ? parent.className : ""].join(" ") : "";
        for (const { name, rx } of networkPatterns) if (rx.test(h + ph)) return name;
        return null;
      }

      (window as any).__screencaps_originals = (window as any).__screencaps_originals || {};

      const seen = new Set<Element>();
      const collected: { el: Element; width: number; height: number; top: number; network: string | null }[] = [];

      document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
        const r = iframe.getBoundingClientRect();
        const w = Math.round(r.width), h = Math.round(r.height);
        if (w < 50 || h < 30) return;
        const cs = getComputedStyle(iframe);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const network = describeNetwork(iframe);
        const matchSize = sizes.some(([sw, sh]) => Math.abs(sw - w) <= tolerance && Math.abs(sh - h) <= tolerance);
        if (network || matchSize) {
          seen.add(iframe);
          collected.push({ el: iframe, width: w, height: h, top: r.top + window.scrollY, network });
        }
      });

      const slotSelectors = [
        "[id^='div-gpt-ad']", "[id*='_ad_']", "[id*='-ad-']", "[id$='-ad']",
        "ins.adsbygoogle", "[data-google-query-id]", "[class*='advert']",
        "[class*='ad-slot']", "[class*='ad_slot']", "[class*='ad-banner']",
        "[class*='ad-container']", "[class*='banner-ad']",
        "[data-ad-slot]", "[data-ad-format]", "[data-ad-unit]",
      ];
      document.querySelectorAll<HTMLElement>(slotSelectors.join(",")).forEach((el) => {
        if (seen.has(el)) return;
        let p: Element | null = el.parentElement;
        while (p) { if (seen.has(p)) return; p = p.parentElement; }
        const r = el.getBoundingClientRect();
        const w = Math.round(r.width), h = Math.round(r.height);
        if (w < 50 || h < 30) return;
        if (getComputedStyle(el).display === "none") return;
        seen.add(el);
        collected.push({ el, width: w, height: h, top: r.top + window.scrollY, network: describeNetwork(el) });
      });

      let counter = 0;
      const out: { selectorId: string; width: number; height: number; top: number; network: string | null }[] = [];
      for (const s of collected) {
        const id = `slot-${++counter}`;
        (s.el as HTMLElement).setAttribute("data-screencaps-slot", id);
        // Store original HTML for restoration later
        (window as any).__screencaps_originals[id] = s.el.outerHTML;
        out.push({ selectorId: id, width: s.width, height: s.height, top: s.top, network: s.network });
      }
      out.sort((a, b) => a.top - b.top);
      return out;
    }, sizes);
  } catch {
    return [];
  }
}

/**
 * Replace specific tagged slots with creative images.
 * Tags replacements with data-screencaps-replaced-slot so restoreSlots can find them.
 */
export async function replaceSlots(
  page: Page,
  replacements: { selectorId: string; dataUrl: string; width: number; height: number; badgeDataUrl?: string | null; badgeType?: "icon" | "text" | "none" }[],
): Promise<number> {
  try {
    return await page.evaluate((reps) => {
      let n = 0;
      for (const r of reps) {
        const el = document.querySelector<HTMLElement>(`[data-screencaps-slot="${r.selectorId}"]`);
        if (!el) continue;
        const wrap = document.createElement("div");
        wrap.style.cssText = `width:${r.width}px;height:${r.height}px;position:relative;overflow:hidden;display:inline-block;`;
        wrap.setAttribute("data-screencaps-replaced-slot", r.selectorId);
        const img = document.createElement("img");
        img.src = r.dataUrl;
        img.style.cssText = `width:${r.width}px;height:${r.height}px;display:block;object-fit:cover;`;
        img.alt = "Ad preview";
        wrap.appendChild(img);
        if (r.badgeDataUrl && r.badgeType && r.badgeType !== "none") {
          const badge = document.createElement("img");
          badge.src = r.badgeDataUrl;
          badge.alt = "AdChoices";
          if (r.badgeType === "icon") {
            // Icon-only: small, top-right
            badge.style.cssText = `position:absolute;top:3px;right:3px;width:16px;height:16px;object-fit:contain;z-index:10;`;
          } else {
            // Text logo: top-left
            badge.style.cssText = `position:absolute;top:3px;left:3px;width:52px;height:14px;object-fit:contain;object-position:left center;z-index:10;`;
          }
          wrap.appendChild(badge);
        }
        el.replaceWith(wrap);
        n++;
      }
      return n;
    }, replacements);
  } catch {
    return 0;
  }
}

/**
 * Restore slots that were previously replaced, putting the original HTML back.
 */
export async function restoreSlots(page: Page, selectorIds: string[]): Promise<void> {
  try {
    await page.evaluate((ids) => {
      const originals = (window as any).__screencaps_originals || {};
      for (const id of ids) {
        const replaced = document.querySelector(`[data-screencaps-replaced-slot="${id}"]`);
        const html = originals[id];
        if (!replaced || !html) continue;
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const el = tmp.firstElementChild;
        if (el) replaced.replaceWith(el);
      }
    }, selectorIds);
  } catch {
    // ignore — page may have navigated
  }
}
