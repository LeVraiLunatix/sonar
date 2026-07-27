/**
 * Logo Sonar : le motif « ping » (deux ondes concentriques + point) en deux
 * encres, suivi du mot-symbole. Le point utilise l'encre du thème (crème en
 * sombre) ; les anneaux gardent les deux encres. Mêmes couleurs que l'icône PWA.
 */
export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo__mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="15" fill="none" stroke="var(--blue)" strokeWidth="3.4" />
        <circle cx="24" cy="24" r="8.6" fill="none" stroke="var(--pink)" strokeWidth="3.4" />
        <circle cx="24" cy="24" r="3.4" fill="var(--ink)" />
      </svg>
      <span className="logo__word">Sonar</span>
    </span>
  );
}
