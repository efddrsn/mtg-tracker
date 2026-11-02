import { Link, NavLink } from "react-router-dom";
import { useAccount } from "../deck/hubApi";
export const panel = "rounded-2xl border border-white/10 bg-white/[0.045] p-5";
export const field =
  "w-full rounded-xl border border-white/20 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400";
export const button =
  "inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50";
export const ghost =
  "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40";
export function Brand() {
  const user = useAccount((s) => s.user);
  return (
    <header className="hub-header">
      <Link to="/" className="text-lg font-extrabold tracking-tight">
        magic<span className="text-indigo-300">hub</span>
        <span className="ml-1 text-[9px] text-slate-500">BETA</span>
      </Link>
      <nav
        aria-label="Navegação principal"
        className="flex flex-wrap items-center gap-1"
      >
        <NavLink to="/decks">Meus decks</NavLink>
        <NavLink to="/community">Explorar</NavLink>
        <NavLink to="/account">{user ? "Minha conta" : "Entrar"}</NavLink>
      </nav>
    </header>
  );
}
export function HubLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="hub-page">
      <Brand />
      <main
        className={`mx-auto ${wide ? "max-w-5xl" : "max-w-3xl"} space-y-6 px-4 py-7 pb-20 sm:px-6`}
      >
        {children}
        <footer className="flex flex-wrap gap-4 border-t border-white/10 pt-5 text-xs text-slate-500">
          <Link to="/feedback">Enviar feedback</Link>
          <Link to="/account">Conta e backup</Link>
          <Link to="/">Ferramentas</Link>
        </footer>
      </main>
    </div>
  );
}
