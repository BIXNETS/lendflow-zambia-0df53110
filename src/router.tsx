import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Link } from "@tanstack/react-router";

function DefaultError({ error, reset }: { error: unknown; reset: () => void }) {
  const message = error instanceof Error ? error.message : "The page could not be loaded.";
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section role="alert" className="card max-w-lg p-8 text-center">
        <h1 className="text-2xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">{message}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary rounded-full px-5 py-2.5 text-sm font-bold">Try again</button>
          <Link to="/auth" className="rounded-full border border-[color:var(--color-line)] px-5 py-2.5 text-sm font-bold">Sign in</Link>
        </div>
      </section>
    </main>
  );
}

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: DefaultError,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}