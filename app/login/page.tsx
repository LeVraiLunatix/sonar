import type { Metadata } from "next";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="login">
      <form className="login__card" method="post" action="/api/login">
        <div className="login__brand">
          <Logo />
        </div>
        <p className="login__tag">archive privée</p>

        <label className="login__label" htmlFor="password">
          mot de passe
        </label>
        <input
          className="login__input mono"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <input type="hidden" name="next" value={next ?? "/"} />

        {error ? <p className="login__error mono">mot de passe incorrect</p> : null}

        <button className="login__submit" type="submit">
          entrer
        </button>
      </form>
    </main>
  );
}
