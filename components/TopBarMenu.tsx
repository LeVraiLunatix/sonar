"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

type NavLink = { href: string; label: string; key: string };

export default function TopBarMenu({
  links,
  current,
  user,
}: {
  links: NavLink[];
  current?: string;
  user: string | null;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="topmenu__trigger"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span>menu</span>
        <span className="topmenu__icon" aria-hidden="true">+</span>
      </button>

      <div
        id="site-menu"
        className={`topmenu__panel${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="topmenu__inner">
          <div className="top__right">
            <nav className="nav" aria-label="Périodes">
              {links.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className={current === link.key ? "now" : undefined}
                  aria-current={current === link.key ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {user && (
              <form className="whoami" method="post" action="/api/auth/logout">
                <span className="whoami__name mono">{user}</span>
                <button className="whoami__out mono" type="submit">
                  sortir
                </button>
              </form>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
