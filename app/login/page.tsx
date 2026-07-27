import type { Metadata } from "next";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; denied?: string; detail?: string }>;
}) {
  const { error, denied, detail } = await searchParams;

  return (
    <main className="login">
      <div className="login__card">
        <div className="login__brand">
          <Logo />
        </div>
        <p className="login__tag">ton archive d’écoute, connecte-toi avec Last.fm</p>

        <a className="login__lastfm" href="/api/auth/login">
          Se connecter avec Last.fm
        </a>

        {denied ? (
          <p className="login__error mono">
            {denied} : l’accès multi-utilisateur n’est pas encore ouvert.
          </p>
        ) : null}
        {error ? (
          <p className="login__error mono">
            {error === "config"
              ? "connexion Last.fm non configurée (clé / secret manquants)"
              : "la connexion Last.fm a échoué, réessaie"}
            {detail ? <><br />↳ {detail}</> : null}
          </p>
        ) : null}

        <p className="login__note mono">
          Sonar ne lit que tes écoutes publiques. Aucun mot de passe ne transite ici.
        </p>
      </div>
    </main>
  );
}
