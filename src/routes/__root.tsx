import { Outlet, HeadContent, Scripts, Link, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LendFlow Africa — Quick Loans. Real Growth." },
      { name: "description", content: "2.5% interest mobile money micro loans across Africa. Pay a 10-15% service fee, get funded to your mobile wallet." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Figtree:wght@400;500;600;700&display=swap" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <RootDocument>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-leaf-dark)]">Error 404</p>
        <h1 className="text-3xl font-black tracking-tight">We couldn&apos;t find that page</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          The link may be out of date. Head back to the homepage to continue.
        </p>
        <Link to="/" className="btn-primary rounded-full px-6 py-3 text-sm font-bold">Back to home</Link>
      </main>
    </RootDocument>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
