import { useServerDocumentContext } from "expo-router/html";
import type { ReactNode } from "react";

/**
 * Expo SDK 58 requires custom HTML roots to render the server document nodes.
 * In particular, bodyNodes contains the browser JavaScript bundles needed
 * to hydrate the static HTML. Omitting them leaves a rendered splash screen
 * with no running application.
 */
export default function Root({ children }: { children: ReactNode }) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080B14" />
        {headNodes}
        <style>{`
          html, body, #root { width: 100%; min-width: 320px; min-height: 100%; margin: 0; background: #080B14; }
          html, body { height: 100%; overscroll-behavior-y: auto; }
          body { touch-action: pan-y; }
          body { overflow-x: hidden; }
          #root { min-height: 100dvh; display: flex; flex-direction: column; }
          *, *::before, *::after { box-sizing: border-box; }
          input, textarea, button { font: inherit; }
          ::selection { background: rgba(212, 175, 55, .28); }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
