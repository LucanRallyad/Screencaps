import type { BrowserContext } from "playwright";

/**
 * Lightweight stealth — strip the `navigator.webdriver` flag and add common
 * properties Playwright headless mode omits. Not a full anti-detect kit;
 * sufficient for publisher sites that block obvious bots.
 */
export async function applyStealth(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // Realistic plugin list
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    // Chrome runtime stub
    // @ts-expect-error window.chrome is not typed
    window.chrome = window.chrome ?? { runtime: {} };
    // Permissions query patch
    const origQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
    if (origQuery) {
      window.navigator.permissions.query = ((parameters: PermissionDescriptor) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : origQuery(parameters)) as typeof window.navigator.permissions.query;
    }
  });
}
