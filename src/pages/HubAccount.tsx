import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  HubLayout,
  panel,
  field,
  button,
  ghost,
} from "../components/HubLayout";
import { api, download, useAccount } from "../deck/hubApi";
import { useHubStore, validDeck } from "../deck/hubStore";

export function Account() {
  const { user, status, refresh, sync } = useAccount();
  const decks = useHubStore((s) => s.decks);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [searchParams] = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ google: boolean }>("auth/providers")
      .then(({ google }) => { if (active) setGoogleEnabled(google); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("google") === "error" ? "Não foi possível entrar pelo Google. Tente novamente ou use email e senha." : "");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("auth/" + mode, "POST", { name, email, password });
      setPassword("");
      await refresh();
      setMessage(
        mode === "signup"
          ? "Conta criada. Seus decks foram sincronizados."
          : "Você entrou. Seus decks foram sincronizados.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout(clearLocal = false) {
    setBusy(true);
    setMessage("");
    try {
      await api("auth/logout", "POST", {});
      await refresh();
      if (clearLocal) useHubStore.setState({ decks: [], activeDeckId: null });
      setMessage(
        clearLocal
          ? "Você saiu e a cópia local foi removida. Seus decks continuam na conta."
          : "Você saiu. Os decks deste aparelho continuam disponíveis.",
      );
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function backup() {
    download(
      "magic-hub-backup.json",
      JSON.stringify({ version: 1, decks }, null, 2),
      "application/json",
    );
    setMessage(
      "Backup iniciado. Guarde este arquivo em um lugar seguro: ele permite gerenciar seus links.",
    );
  }
  return (
    <HubLayout>
      <div>
        <p className="hub-eyebrow">SEU ESPAÇO</p>
        <h1 className="text-3xl font-bold">
          {user ? "Minha conta" : "Conta opcional"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Use as ferramentas sem cadastro. Entre para salvar seus decks na conta
          e abrir em outro aparelho.
        </p>
      </div>
      {user ? (
        <section className={panel + " space-y-4"}>
          <h2 className="text-xl font-bold">{user.name}</h2>
          <p className="text-sm text-slate-400">{user.email}</p>
          <p className="text-sm">{status}</p>
          <div className="flex flex-wrap gap-2">
            {googleEnabled && <a className={ghost} href="/api/event/auth/google/start">Vincular ou entrar com Google</a>}
            <button
              className={button}
              disabled={busy}
              onClick={() => void sync()}
            >
              Sincronizar agora
            </button>
            <Link to="/decks" className={ghost}>
              Meus decks
            </Link>
            <button
              className={ghost}
              disabled={busy}
              onClick={() => void logout()}
            >
              Sair da conta
            </button>
            <button
              className={ghost}
              disabled={busy}
              onClick={() => void logout(true)}
            >
              Sair e remover cópia local
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Os decks ficam privados na conta. Compartilhar por link ou publicar
            na galeria exige uma ação sua.
          </p>
        </section>
      ) : (
        <section className={panel + " space-y-4"}>
          <div className="flex gap-2">
            <button
              className={mode === "login" ? button : ghost}
              onClick={() => setMode("login")}
            >
              Entrar
            </button>
            <button
              className={mode === "signup" ? button : ghost}
              onClick={() => setMode("signup")}
            >
              Criar conta
            </button>
          </div>
          {googleEnabled ? (
            <a className={ghost + " w-full gap-3"} href="/api/event/auth/google/start">
              <span className="text-lg font-bold">G</span> Continuar com Google
            </a>
          ) : (
            <p className="text-xs text-slate-400">Acesso Google disponível após configurar OAuth no servidor.</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-white/10" />ou use email e senha<div className="h-px flex-1 bg-white/10" />
          </div>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            {mode === "signup" && (
              <label className="block text-sm">
                Nome (opcional)
                <input
                  className={field + " mt-2"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={60}
                />
              </label>
            )}
            <label className="block text-sm">
              Email
              <input
                className={field + " mt-2"}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
            <label className="block text-sm">
              Senha
              <input
                className={field + " mt-2"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                maxLength={128}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
            </label>
            <p className="text-xs text-slate-400">
              Mínimo de 10 caracteres. Guarde sua senha: a recuperação por email
              ainda não está disponível.
            </p>
            <button className={button + " w-full"} disabled={busy}>
              {busy
                ? "Aguarde…"
                : mode === "signup"
                  ? "Criar conta e salvar meus decks"
                  : "Entrar e recuperar meus decks"}
            </button>
          </form>
        </section>
      )}
      <section className={panel + " space-y-4"}>
        <h2 className="text-lg font-semibold">Backup dos meus decks</h2>
        <p className="text-sm text-slate-400">
          Leve seus decks, versões e controles de compartilhamento para outro
          navegador. Importar mescla as listas e preserva a edição mais recente.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} onClick={backup}>
            Baixar backup JSON
          </button>
          <label className={ghost + " cursor-pointer"}>
            Restaurar backup
            <input
              className="sr-only"
              aria-label="Restaurar backup JSON"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2000000) {
                  setMessage("Use um backup de até 2 MB.");
                  return;
                }
                void file
                  .text()
                  .then((text) => {
                    const data = JSON.parse(text);
                    if (
                      data.version !== 1 ||
                      !Array.isArray(data.decks) ||
                      data.decks.length > 100 ||
                      !data.decks.every(validDeck)
                    )
                      throw new Error("Arquivo de backup inválido.");
                    useHubStore.getState().merge(data.decks);
                    setMessage(
                      "Backup restaurado. Seus decks estão em Meus decks.",
                    );
                  })
                  .catch((err: Error) => setMessage(err.message));
              }}
            />
          </label>
        </div>
      </section>
      {message && (
        <p role="status" className="break-words text-sm text-indigo-200">
          {message}
        </p>
      )}
    </HubLayout>
  );
}
