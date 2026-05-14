import type { Page } from "playwright";

/**
 * Best-effort dismissal of cookie banners, newsletter popups, paywalls, etc.
 * Runs inside the page so we can match many languages and frameworks at once.
 * Returns the number of overlays dismissed.
 */
export async function dismissPopups(page: Page): Promise<number> {
  try {
    return await page.evaluate(() => {
      let dismissed = 0;

      const CONSENT_TEXTS = [
        "accept all", "accept cookies", "accept", "agree", "i agree",
        "got it", "ok", "okay", "allow all", "allow", "continue",
        "i accept", "accept & continue", "consent", "yes, i agree",
        "tout accepter", "accepter", "akzeptieren", "alle akzeptieren",
        "aceptar", "aceptar todo", "accetta", "accetta tutti",
        "aceitar", "aceitar todos", "zgadzam", "akceptuj",
      ];
      const CLOSE_TEXTS = ["close", "no thanks", "no, thanks", "decline", "dismiss", "skip", "later", "×", "✕", "x"];

      const matchesText = (el: Element, list: string[]) => {
        const t = (el.textContent ?? "").trim().toLowerCase();
        if (!t || t.length > 40) return false;
        return list.some((needle) => t === needle || t.includes(needle));
      };

      const clickable = "button, [role=button], a, input[type=button], input[type=submit]";

      // 1) Common cookie/consent frameworks via known selectors
      const KNOWN_SELECTORS = [
        "#onetrust-accept-btn-handler",
        ".onetrust-close-btn-handler",
        "#truste-consent-button",
        "#CybotCookiebotDialogBodyButtonAccept",
        "#CybotCookiebotDialogBodyLevelButtonAcceptAll",
        ".cc-allow",
        ".cookie-accept",
        ".cookie-consent__accept",
        ".js-accept-cookies",
        '[data-testid="uc-accept-all-button"]',
        '[aria-label*="Accept"][aria-label*="cookies" i]',
        '[id*="didomi"][id*="agree"]',
        ".qc-cmp2-summary-buttons button:nth-of-type(2)",
        ".fc-cta-consent", // Google FundingChoices
        '[aria-label*="Consent"]',
      ];
      for (const sel of KNOWN_SELECTORS) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          try { el.click(); dismissed++; } catch {}
        });
      }

      // 2) Heuristic: find buttons whose visible text matches a consent verb
      document.querySelectorAll<HTMLElement>(clickable).forEach((el) => {
        if (!(el as HTMLElement).offsetParent) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (matchesText(el, CONSENT_TEXTS)) {
          try { el.click(); dismissed++; } catch {}
        }
      });

      // 3) Generic close buttons within fixed/overlay elements
      const overlays = Array.from(document.querySelectorAll<HTMLElement>("[role=dialog], .modal, .popup, .overlay, [aria-modal=true]"));
      for (const overlay of overlays) {
        const closeBtn = overlay.querySelector<HTMLElement>(clickable);
        if (closeBtn && matchesText(closeBtn, CLOSE_TEXTS)) {
          try { closeBtn.click(); dismissed++; } catch {}
        }
      }

      // 4) Remove obvious overlay/backdrop elements that didn't yield to clicks
      const overlaySelectors = [
        ".cookie-banner", ".cookie-notice", "#cookie-banner",
        ".newsletter-popup", ".modal-backdrop", "#modal-backdrop",
        ".gdpr", ".gdpr-banner", ".cmp-overlay", "#truste-show-consent",
        ".paywall-overlay", ".paywall", ".onesignal-slidedown-container",
      ];
      for (const sel of overlaySelectors) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          try { el.remove(); dismissed++; } catch {}
        });
      }

      // 5) Re-enable scroll if a banner locked it
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.classList.forEach((c) => {
        if (/modal|locked|no-scroll/i.test(c)) document.body.classList.remove(c);
      });

      return dismissed;
    });
  } catch {
    return 0;
  }
}
