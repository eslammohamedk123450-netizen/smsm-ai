import { useServerDocumentContext } from "expo-router/html";
import type { ReactNode } from "react";

/**
 * Expo SDK 58 requires custom HTML roots to render the server document nodes.
 * In particular, bodyNodes contains the browser JavaScript bundles needed
 * to hydrate the static HTML. Omitting them leaves a rendered splash screen
 * with no running application.
 */
const webBaseUrl = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(/\/+$/, "");
const faviconHref = `${webBaseUrl}/favicon.svg` || "/favicon.svg";

export default function Root({ children }: { children: ReactNode }) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080B14" />
        <link rel="icon" type="image/svg+xml" href={faviconHref} />
        <link rel="shortcut icon" type="image/svg+xml" href={faviconHref} />
        {headNodes}
        <style>{`
          html, body, #root { width: 100%; min-width: 320px; min-height: 100%; margin: 0; background: #080808; }
          html, body { height: 100%; overscroll-behavior-y: auto; }
          body { touch-action: pan-y; }
          body { overflow-x: hidden; }
          #root { min-height: 100dvh; display: flex; flex-direction: column; }
          *, *::before, *::after { box-sizing: border-box; }
          input, textarea, button { font: inherit; }
          ::selection { background: rgba(245, 245, 245, .22); }
          @media (min-width: 768px) { html, body, #root { width: 100%; } }
          @media (min-width: 1440px) { #root { min-height: 100dvh; } }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
