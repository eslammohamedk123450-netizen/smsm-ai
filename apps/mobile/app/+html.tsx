import type { ReactNode } from "react";

/** Keep the browser canvas dark and viewport-sized so overscroll never reveals a white page. */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080B14" />
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
      <body>{children}</body>
    </html>
  );
}
