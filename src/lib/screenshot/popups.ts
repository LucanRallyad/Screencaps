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
      const CLOSE_TEXTS = ["close", "no thanks", "no, thanks", "dismiss", "skip", "skip ad", "later", "maybe later", "not now", "continue to site", "×", "✕", "✖", "⨯"];

      const matchesText = (el: Element, list: string[]) => {
        const t = (el.textContent ?? "").trim().toLowerCase();
        if (!t || t.length > 60) return false;
        // Single glyphs (× etc.) must match exactly — never substring-match, or
        // "x" would match words like "Explore"/"Next".
        return list.some((needle) => (needle.length <= 2 ? t === needle : t === needle || t.includes(needle)));
      };

      // A control is a "close" control if its text, aria-label, title, or class
      // signals dismissal. Catches icon-only × buttons that have no text.
      const isCloseControl = (el: Element): boolean => {
        if (matchesText(el, CLOSE_TEXTS)) return true;
        const attrs = [
          el.getAttribute("aria-label"),
          el.getAttribute("title"),
          typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "",
          el.getAttribute("data-testid"),
          el.id,
        ].join(" ").toLowerCase();
        return /\b(close|dismiss|skip)\b/.test(attrs) || /(^|[-_])close([-_]|$)|closebtn|close-button|btn-close|modal-close|popup-close/.test(attrs);
      };

      const clickable = "button, [role=button], a, input[type=button], input[type=submit], span, div, i";

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

      // 3) Close buttons inside dialog/modal/overlay/interstitial elements
      const overlayEls = Array.from(document.querySelectorAll<HTMLElement>(
        "[role=dialog], [role=alertdialog], [aria-modal=true], .modal, .popup, .overlay, .lightbox, .interstitial, " +
        "[class*='modal'], [class*='popup'], [class*='overlay'], [class*='lightbox'], [class*='interstitial'], [class*='dialog'], " +
        "[id*='modal'], [id*='popup'], [id*='overlay'], [id*='interstitial'], [id*='lightbox'], " +
        "[class*='cookie'], [class*='consent'], [class*='gdpr'], [id*='cookie'], [id*='consent']"
      ));
      for (const overlay of overlayEls) {
        for (const btn of Array.from(overlay.querySelectorAll<HTMLElement>(clickable))) {
          if (isCloseControl(btn) || matchesText(btn, CONSENT_TEXTS)) {
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

      // 5) Nuclear: remove large overlaying elements (fixed/sticky/absolute) with
      //    a high z-index that cover a big chunk of the viewport — the classic
      //    modal / interstitial-ad pattern. Also catches full-screen ad iframes
      //    (which we can't reach into to click their close button, but can drop).
      const vw = window.innerWidth, vh = window.innerHeight;
      const isHeader = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        // A sticky top bar hugs the top and is short — don't nuke site headers.
        return r.top <= 2 && r.height < vh * 0.35;
      };
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        try {
          const cs = getComputedStyle(el);
          const overlaying = cs.position === "fixed" || cs.position === "sticky" || cs.position === "absolute";
          if (!overlaying) return;
          const z = parseInt(cs.zIndex, 10);
          if (isNaN(z) || z < 100) return;
          if (isHeader(el)) return;
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          const isIframe = el.tagName === "IFRAME";
          // Iframes: a smaller threshold (interstitial ad units are often centered
          // and ~40-60% of the screen). Other elements: >25% of the viewport.
          const threshold = isIframe ? 0.18 : 0.25;
          if (area > vw * vh * threshold) {
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
