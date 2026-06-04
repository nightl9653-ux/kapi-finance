import { getTranslations } from "next-intl/server";

type Section = { title: string; paragraphs: string[] };

export async function LegalDocument({ namespace }: { namespace: "legalPrivacy" | "legalTerms" }) {
  const t = await getTranslations(namespace);
  const sections = t.raw("sections") as Section[];
  const updated = t("updated");

  return (
    <article className="prose prose-sm max-w-none space-y-8 text-foreground prose-headings:font-semibold prose-p:text-muted-foreground">
      <header className="space-y-2 not-prose">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{updated}</p>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="space-y-3 not-prose">
          <h2 className="text-lg font-medium">{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
