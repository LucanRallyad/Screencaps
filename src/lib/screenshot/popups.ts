import type { Page } from "playwright";

export async function dismissPopups(page: Page): Promise<number> {
  try {
    return await page.evaluate(() => {
      let dismissed = 0;

      const CONSENT_TEXTS = [
        "accept all", "accept cookies", "accept", "agree", "i agree",
        "got it", "ok", "okay", "allow all", "allow", "continue",
        "i accept", "accept & continue", "consent", "yes, i agree",
        "reject all", "reject", "decline all",
        "tout accepter", "accepter", "akzeptieren", "alle akzeptieren",
        "aceptar", "aceptar todo", "accetta", "accetta tutti",
        "aceitar", "aceitar todos", "zgadzam", "akceptuj",
        "confirm", "confirm my choices", "save and exit", "save & exit",
      ];
      const CLOSE_TEXTS = ["close", "no thanks", "no, thanks", "dismiss", "skip", "later", "×", "✕", "x", "✖"];

      const matchesText = (el: Element, list: string[]) => {
        const t = (el.textContent ?? "").trim().toLowerCase();
        if (!t || t.length > 60) return false;
        return list.some((needle) => t === needle || t.includes(needle));
      };

      const clickable = "button, [role=button], a, input[type=button], input[type=submit]";

      // 1) Known CMP selectors — click directly
      const KNOWN_SELECTORS = [
        "#onetrust-accept-btn-handler",
        ".onetrust-close-btn-handler",
        "#truste-consent-button",
        "#CybotCookiebotDialogBodyButtonAccept",
        "#CybotCookiebotDialogBodyLevelButtonAcceptAll",
        ".cc-allow", ".cookie-accept", ".cookie-consent__accept", ".js-accept-cookies",
        '[data-testid="uc-accept-all-button"]',
        '[aria-label*="Accept"][aria-label*="cookies" i]',
        '[id*="didomi"][id*="agree"]',
        ".qc-cmp2-summary-buttons button:nth-of-type(2)",
        ".fc-cta-consent",
        '[aria-label*="Consent"]',
        ".guce-consent-o-header ~ div button:first-of-type",
        '[class*="guce"] button[name="agree"]',
        '[class*="consent"] button[name="agree"]',
        'button[name="agree"]',
        ".sp_choice_type_ACCEPT_ALL",
        '[data-choice-type="ACCEPT_ALL"]',
        // iubenda
        "#iubFooterBtn", ".iubenda-cs-accept-btn", "#iub-cmp-accept",
        // Termly
        "#termly-code-snippet-support .t-acceptAllButton",
        // Cookiebot
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
        // Quantcast
        ".qc-cmp2-summary-buttons button:first-child",
        // Admiral
        '[id*="admiral"] button',
        // Sourcepoint
        ".message-component button[title*='Accept' i]",
        // TrustArc
        "#truste-show-consent", ".trustarc-agree-btn",
        // Evidon
        "#_evh-ric",
        // Generic
        '[class*="cookie"] button[class*="accept" i]',
        '[class*="consent"] button[class*="accept" i]',
        '[class*="gdpr"] button[class*="accept" i]',
        '[id*="cookie"] button[class*="accept" i]',
      ];

      for (const sel of KNOWN_SELECTORS) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          try { el.click(); dismissed++; } catch {}
        });
      }

      // 2) Heuristic text-based button click
      document.querySelectorAll<HTMLElement>(clickable).forEach((el) => {
        if (!(el as HTMLElement).offsetParent) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (matchesText(el, CONSENT_TEXTS)) {
          try { el.click(); dismissed++; } catch {}
        }
      });

      // 3) Close buttons inside dialog/modal/overlay elements
      const overlayEls = Array.from(document.querySelectorAll<HTMLElement>(
        "[role=dialog], [role=alertdialog], .modal, .popup, .overlay, [aria-modal=true], [class*='cookie'], [class*='consent'], [class*='gdpr'], [id*='cookie'], [id*='consent']"
      ));
      for (const overlay of overlayEls) {
        for (const btn of Array.from(overlay.querySelectorAll<HTMLElement>(clickable))) {
          if (matchesText(btn, CLOSE_TEXTS) || matchesText(btn, CONSENT_TEXTS)) {
            try { btn.click(); dismissed++; } catch {}
          }
        }
      }

      // 4) Remove known overlay selectors that didn't respond to clicks
      const REMOVE_SELECTORS = [
        ".cookie-banner", ".cookie-notice", ".cookie-bar", "#cookie-banner", "#cookie-notice",
        ".cookie-consent", "#cookie-consent", ".cookie-law", "#cookielaw",
        ".newsletter-popup", ".newsletter-modal",
        ".modal-backdrop", "#modal-backdrop", ".modal-overlay",
        ".gdpr", ".gdpr-banner", ".gdpr-popup", ".cmp-overlay",
        "#truste-show-consent", ".truste_popframe",
        ".paywall-overlay", ".paywall",
        ".onesignal-slidedown-container",
        "[class*='cmp-container']", "[class*='cmp-popup']",
        "#sp_message_container", ".sp_message_iframe",
        ".fc-dialog-container", ".fc-dialog-overlay",
        "#qc-cmp2-container", "#qc-cmp2-ui",
        ".iubenda-cs-container", "#iubenda-cs-banner",
        "[class*='privacy-banner']", "[class*='consent-banner']",
      ];
      for (const sel of REMOVE_SELECTORS) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          try { el.remove(); dismissed++; } catch {}
        });
      }

      // 5) Nuclear: remove any large fixed/sticky element with high z-index
      //    that covers >25% of the viewport (classic modal/overlay pattern)
      const vw = window.innerWidth, vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        try {
          const cs = getComputedStyle(el);
          if (cs.position !== "fixed" && cs.position !== "sticky") return;
          const z = parseInt(cs.zIndex, 10);
          if (isNaN(z) || z < 100) return;
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > vw * vh * 0.25) {
            // Large fixed overlay — remove it
            el.remove();
            dismissed++;
          }
        } catch {}
      });

      // 6) Re-enable scroll
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.classList.forEach((c) => {
        if (/modal|locked|no-scroll|overflow|noscroll/i.test(c)) document.body.classList.remove(c);
      });
      document.documentElement.classList.forEach((c) => {
        if (/modal|locked|no-scroll|overflow|noscroll/i.test(c)) document.documentElement.classList.remove(c);
      });

      return dismissed;
    });
  } catch {
    return 0;
  }
}
