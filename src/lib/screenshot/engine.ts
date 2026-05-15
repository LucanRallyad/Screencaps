import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DESKTOP, MOBILE, PLAYWRIGHT_LAUNCH, type DeviceProfile } from "./devices";
import { applyStealth } from "./stealth";
import { dismissPopups } from "./popups";
import { detectAdSlots, replaceSlots, restoreSlots } from "./ad-detect";
import { injectBrowserBar, removeBrowserBar } from "./browser-bar";

let _badgeIcon: string | null | undefined;
let _badgeText: string | null | undefined;

async function loadBadge(filename: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", filename));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function getBadges(): Promise<{ icon: string | null; text: string | null }> {
  if (_badgeIcon === undefined) _badgeIcon = await loadBadge("adchoices.jpg");
  if (_badgeText === undefined) _badgeText = await loadBadge("ad-choices.jpg");
  return { icon: _badgeIcon ?? null, text: _badgeText ?? null };
}

export type AdAsset = {
  id: string;
  width: number;
  height: number;
  storagePath: string;
  mimeType: string;
};

export type SavedScreenshot = {
  storagePath: string;
  pageUrl: string;
  viewport: "desktop" | "mobile";
  width: number;
  height: number;
  adsOnPage: number;
  order: number;
};

export type CaptureOutcome =
  | {
      status: "completed";
      adSlotsFound: number;
      adsReplaced: number;
      screenshots: SavedScreenshot[];
      internalLinksVisited: string[];
      popupsDismissed: number;
      uniqueAdSizes: string[];
    }
  | { status: "no_ad_slots"; adSlotsFound: 0; popupsDismissed: number; screenshots: SavedScreenshot[] }
  | { status: "unreachable"; error: string }
  | { status: "failed"; error: string };

export type CaptureInput = {
  projectId: string;
  targetId: string;
  url: string;
  device: "desktop" | "mobile";
  ads: AdAsset[];
  followInternalLinks: boolean;
};

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR ?? "./screenshots";
const NAV_TIMEOUT = 45_000;
const MAX_SHOTS_PER_PAGE = 8;

let cachedBrowser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.isConnected()) return cachedBrowser;
  cachedBrowser = await chromium.launch(PLAYWRIGHT_LAUNCH);
  return cachedBrowser;
}

export async function closeBrowser() {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {});
    cachedBrowser = null;
  }
}

// ─── Safe eval — handles "context was destroyed" from mid-eval navigations ───

async function safeEval<T>(page: Page, fn: () => T, fallback: T): Promise<T> {
  try {
    if (page.isClosed()) return fallback;
    return await page.evaluate(fn);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (
      msg.includes("context was destroyed") ||
      msg.includes("Execution context") ||
      msg.includes("Target closed") ||
      msg.includes("Session closed") ||
      msg.includes("Protocol error")
    ) {
      return fallback;
    }
    throw err;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function captureTarget(input: CaptureInput): Promise<CaptureOutcome> {
  const profile: DeviceProfile = input.device === "mobile" ? MOBILE : DESKTOP;
  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  try {
    const browser = await getBrowser();

    context = await browser.newContext({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      userAgent: profile.userAgent,
      bypassCSP: true,
      locale: "en-US",
    });

    // Shim esbuild's __name helper so page.evaluate callbacks don't throw
    await context.addInitScript(() => {
      (window as any).__name = (fn: unknown) => fn;
    });

    await applyStealth(context);

    let page: Page | null = null;
    try {
    page = await context.newPage();

    // Navigate — wait for load event so subresources and dynamic content settle
    try {
      await page.goto(input.url, { waitUntil: "load", timeout: NAV_TIMEOUT });
    } catch (err) {
      // "load" timed out — try proceeding with whatever loaded (domcontentloaded already fired)
      const msg = (err as Error).message;
      if (!msg.includes("Timeout")) return { status: "unreachable", error: msg.slice(0, 240) };
    }

    // Extra settle time for JS-heavy pages (React hydration, lazy ad loaders, etc.)
    await page.waitForTimeout(2500);

    // Failsafe: if page body has very little text the page is still loading — wait more
    const bodyLen = await safeEval(page, () => document.body?.innerText?.length ?? 0, 0);
    if ((bodyLen as number) < 200) await page.waitForTimeout(2000);

    const popupsDismissed = await dismissPopups(page);
    await page.waitForTimeout(600);

    // Scroll to bottom to trigger lazy-loaded ads, then back to top
    await autoScroll(page);
    await safeEval(page, () => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); return null; }, null);
    await page.waitForTimeout(1000);

    // Second dismissal pass — catches popups that appear on scroll (e.g. Yahoo consent)
    await dismissPopups(page);
    await page.waitForTimeout(400);

    // Detect all ad slots (stores originals in page for later restoration)
    const slots = await detectAdSlots(page);
    const currentUrl = page.url();

    if (slots.length === 0) {
      await injectBrowserBar(page, currentUrl, input.device === "mobile");
      const refShots = await captureViewports(page, input, profile, [], input.ads, 0);
      return { status: "no_ad_slots", adSlotsFound: 0, popupsDismissed, screenshots: refShots };
    }

    await injectBrowserBar(page, currentUrl, input.device === "mobile");
    const screenshots = await captureViewports(page, input, profile, slots, input.ads, 0);

    // Optionally follow one internal link
    const internalLinksVisited: string[] = [];
    const adsReplaced = screenshots.reduce((sum, s) => sum + s.adsOnPage, 0);

    if (input.followInternalLinks && slots.length > 0) {
      const internalUrl = await pickInternalLink(page, input.url);
      if (internalUrl) {
        try {
          await removeBrowserBar(page);
          await page.goto(internalUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
          await page.waitForTimeout(1500);
          await dismissPopups(page);
          await autoScroll(page);
          await safeEval(page, () => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); return null; }, null);

          const slots2 = await detectAdSlots(page);
          if (slots2.length > 0) {
            await injectBrowserBar(page, internalUrl, input.device === "mobile");
            const shots2 = await captureViewports(page, input, profile, slots2, input.ads, screenshots.length);
            screenshots.push(...shots2);
            internalLinksVisited.push(internalUrl);
          }
        } catch {
          // secondary navigation errors are non-fatal
        }
      }
    }

    const uniqueAdSizes = Array.from(new Set(slots.map((s) => `${s.width}x${s.height}`)));

    return {
      status: "completed",
      adSlotsFound: slots.length,
      adsReplaced,
      screenshots,
      internalLinksVisited,
      popupsDismissed,
      uniqueAdSizes,
    };
    } catch (err) {
      return { status: "failed", error: (err as Error).message.slice(0, 240) };
    } finally {
      await context.close().catch(() => {});
    }
  } catch (err) {
    const msg = (err as Error).message.slice(0, 240);
    console.error(`[engine] browser/context error: ${msg}`);
    return { status: "failed", error: msg };
  }
}

// ─── Targeted viewport capture ───────────────────────────────────────────────
//
// Instead of crawling every scroll position, we:
//   1. Find only the slots that have a size-matched creative
//   2. Compute one ideal scroll position per matched slot
//   3. Deduplicate positions that already cover another slot
//   4. Visit only those positions, replace 1-2 ads, screenshot, restore
//   5. Skip entirely if no replacement was actually made
//
// For the no-ad-slots case (empty slots array) we take a single reference shot.

async function captureViewports(
  page: Page,
  input: CaptureInput,
  profile: DeviceProfile,
  slots: Awaited<ReturnType<typeof detectAdSlots>>,
  ads: AdAsset[],
  startOrder: number,
): Promise<SavedScreenshot[]> {
  const { width: vw, height: vh } = profile.viewport;
  const { icon: badgeIcon, text: badgeText } = await getBadges();
  const results: SavedScreenshot[] = [];
  const dir = path.join(SCREENSHOT_DIR, input.projectId, input.targetId);
  await fs.mkdir(dir, { recursive: true });

  // ── Failsafe: skip capture if page still looks like a loading screen ─────────
  const pageBodyLen = await safeEval(page, () => document.body?.innerText?.trim().length ?? 0, 0);
  if ((pageBodyLen as number) < 100) return results; // page didn't load meaningful content

  // ── Reference shot when no ads exist ─────────────────────────────────────────
  if (slots.length === 0 || ads.length === 0) {
    const storagePath = path.join(dir, `${input.device}-ref-${randomUUID().slice(0, 8)}.png`);
    try {
      await page.screenshot({ path: storagePath, type: "png" });
      results.push({ storagePath, pageUrl: page.url(), viewport: input.device, width: vw, height: vh, adsOnPage: 0, order: startOrder });
    } catch {}
    return results;
  }

  // ── Build targeted scroll positions ──────────────────────────────────────────
  // Filter to slots that have at least one size-matching creative.
  const matchedSlots = slots.filter((s) => pickBestAd(ads, s.width, s.height, new Set()) !== null);
  if (matchedSlots.length === 0) return results; // slots exist but none match our sizes

  // For each matched slot, choose a scroll position that places the slot roughly
  // 1/3 from the top of the viewport so there's natural context around it.
  const scrollPositions: number[] = [];
  for (const slot of matchedSlots) {
    const ideal = Math.max(0, slot.top - Math.floor(vh / 3));
    // Deduplicate: skip if a position we already have would show this slot
    const alreadyCovered = scrollPositions.some(
      (pos) => slot.top >= pos && slot.top < pos + vh,
    );
    if (!alreadyCovered) scrollPositions.push(ideal);
  }
  scrollPositions.sort((a, b) => a - b);

  // ── Capture each targeted position ───────────────────────────────────────────
  let order = startOrder;
  for (const scrollY of scrollPositions) {
    if (results.length >= MAX_SHOTS_PER_PAGE) break;

    try {
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        scrollY,
      );
    } catch { break; }
    await page.waitForTimeout(200);

    // Slots visible in this viewport
    const visibleSlots = slots.filter(
      (s) => s.top >= scrollY - 50 && s.top < scrollY + vh + 50,
    );

    const toReplace: { selectorId: string; dataUrl: string; width: number; height: number; badgeDataUrl: string | null; badgeType: "icon" | "text" | "none" }[] = [];
    const replacedIds: string[] = [];
    const used = new Set<string>();

    for (const slot of visibleSlots.slice(0, 2)) {
      const ad = pickBestAd(ads, slot.width, slot.height, used);
      if (!ad) continue;
      const dataUrl = await readAsDataUrl(ad.storagePath, ad.mimeType);
      // Randomly assign badge: ~33% icon (top-right), ~33% text (top-left), ~33% none
      const roll = Math.random();
      const badgeType: "icon" | "text" | "none" = roll < 0.33 ? "icon" : roll < 0.66 ? "text" : "none";
      const badgeDataUrl = badgeType === "icon" ? (badgeIcon ?? null) : badgeType === "text" ? (badgeText ?? null) : null;
      toReplace.push({ selectorId: slot.selectorId, dataUrl, width: slot.width, height: slot.height, badgeDataUrl, badgeType });
      replacedIds.push(slot.selectorId);
      used.add(ad.id);
      if (used.size === ads.length) used.clear();
    }

    // Skip this position entirely if nothing matched
    if (toReplace.length === 0) continue;

    const adsOnPage = await replaceSlots(page, toReplace);
    if (adsOnPage === 0) {
      await restoreSlots(page, replacedIds).catch(() => {});
      continue;
    }
    await page.waitForTimeout(150);

    const storagePath = path.join(dir, `${input.device}-${order}-${randomUUID().slice(0, 8)}.png`);
    try {
      await page.screenshot({ path: storagePath, type: "png" });
    } catch {
      await restoreSlots(page, replacedIds).catch(() => {});
      break;
    }

    results.push({
      storagePath,
      pageUrl: page.url(),
      viewport: input.device,
      width: vw,
      height: vh,
      adsOnPage,
      order: order++,
    });

    await restoreSlots(page, replacedIds);
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickBestAd(ads: AdAsset[], w: number, h: number, used: Set<string>): AdAsset | null {
  const exact = ads.filter((a) => Math.abs(a.width - w) <= 2 && Math.abs(a.height - h) <= 2);
  if (exact.length === 0) return null;
  return exact.find((a) => !used.has(a.id)) ?? exact[0];
}

async function readAsDataUrl(filePath: string, mime: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function autoScroll(page: Page) {
  try {
    await page.evaluate(async () => {
      const distance = 400;
      const delay = 100;
      const max = Math.min(document.body.scrollHeight, 25_000);
      let total = 0;
      while (total < max) {
        window.scrollBy(0, distance);
        await new Promise((r) => setTimeout(r, delay));
        total += distance;
        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) break;
      }
    });
  } catch {
    // navigation during scroll — ignore
  }
}

async function pickInternalLink(page: Page, baseUrl: string): Promise<string | null> {
  try {
    const base = new URL(baseUrl);
    return await safeEval(
      page,
      () => {
        const origin = location.origin;
        const seen = new Set<string>();
        const candidates: string[] = [];
        document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
          try {
            const u = new URL(a.href);
            if (u.origin !== origin) return;
            if (u.pathname === "/" || u.pathname === "") return;
            if (/\.(pdf|zip|jpg|png|gif|mp4|mp3)$/i.test(u.pathname)) return;
            const href = u.toString();
            if (seen.has(href)) return;
            seen.add(href);
            if (/(\/article|\/news|\/blog|\/post|\/story)/i.test(u.pathname)) {
              candidates.unshift(href);
            } else {
              candidates.push(href);
            }
          } catch {}
        });
        return candidates[0] ?? null;
      },
      null,
    );
  } catch {
    return null;
  }
}
