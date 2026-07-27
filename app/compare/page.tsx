import { getCompareData } from "@/lib/period";
import { monthRange, parisToday } from "@/lib/dates";
import { accountForPage } from "@/lib/guard";
import { frMonth, nf } from "@/lib/format";
import TopBar from "@/components/TopBar";
import ComparePanel from "@/components/ComparePanel";

export const dynamic = "force-dynamic";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

function parseMonth(v: string | undefined, fallback: { y: number; m: number }) {
  const mt = v?.match(MONTH_RE);
  if (!mt) return fallback;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  if (m < 1 || m > 12) return fallback;
  return { y, m };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a: aRaw, b: bRaw } = await searchParams;
  const today = parisToday();
  const [ty, tm] = today.split("-").map(Number);
  const prevM = tm === 1 ? { y: ty - 1, m: 12 } : { y: ty, m: tm - 1 };

  const a = parseMonth(aRaw, { y: ty, m: tm });
  const b = parseMonth(bRaw, prevM);

  const aLabel = `${frMonth(a.m)} ${a.y}`;
  const bLabel = `${frMonth(b.m)} ${b.y}`;

  const account = await accountForPage();
  const data = await getCompareData(
    account,
    monthRange(a.y, a.m),
    monthRange(b.y, b.m),
    aLabel,
    bLabel,
  );

  return (
    <main className="year year--nospine">
      <div className="flow flow--wide">
        <TopBar current="compare" />

        <section className="ann">
          <p className="ann__label">comparer deux mois</p>
          <div className="cmp-head">
            <div className="cmp-side cmp-side--a">
              <span className="cmp-side__n">{nf(data.a.scrobbles)}</span>
              <span className="cmp-side__k">{data.a.label}</span>
            </div>
            <span className="cmp-head__vs">vs</span>
            <div className="cmp-side cmp-side--b">
              <span className="cmp-side__n">{nf(data.b.scrobbles)}</span>
              <span className="cmp-side__k">{data.b.label}</span>
            </div>
          </div>
          <p className="prose" style={{ marginTop: "1.25rem" }}>
            {data.shared > 0
              ? `${data.shared} artistes écoutés dans les deux périodes — c’est le violet ci-dessous.`
              : "Aucun artiste commun aux deux périodes."}
          </p>
        </section>

        <section className="ann">
          <p className="ann__label">artistes — rose : {data.a.label} · bleu : {data.b.label}</p>
          {data.rows.length > 0 ? (
            <ComparePanel data={data} />
          ) : (
            <p className="prose">Rien à comparer sur ces deux mois.</p>
          )}
        </section>

        <section className="ann">
          <p className="ann__label">choisir deux mois</p>
          <form className="cmp-form" method="get">
            <label>
              mois A
              <input type="month" name="a" defaultValue={`${a.y}-${pad(a.m)}`} />
            </label>
            <label>
              mois B
              <input type="month" name="b" defaultValue={`${b.y}-${pad(b.m)}`} />
            </label>
            <button type="submit">comparer</button>
          </form>
        </section>
      </div>
    </main>
  );
}
