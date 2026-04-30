import { hasGroq, hasPostgres, hasTavily } from "@/lib/config";

/**
 * Server component. Renders nothing if everything is configured. Otherwise
 * surfaces clear, actionable banners so the user knows what to fix.
 */
export function HealthBanners() {
  const groq = hasGroq();
  const tavily = hasTavily();
  const postgres = hasPostgres();
  if (groq && tavily && postgres) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {!postgres && (
        <div className="error-banner">
          <strong>Postgres is not configured.</strong> Set{" "}
          <code>POSTGRES_URL</code> in <code>.env.local</code> (or in your
          Vercel project env). Nothing will be saved until this is set up.
        </div>
      )}
      {!groq && (
        <div className="warning-banner">
          <strong>GROQ_API_KEY is not set.</strong> Note ingestion and Q&A will
          not work. Add it in <code>.env.local</code>.
        </div>
      )}
      {groq && !tavily && (
        <div className="warning-banner">
          <strong>TAVILY_API_KEY is not set.</strong> The web-enrichment
          feature on profile pages will not work, but everything else is fully
          functional.
        </div>
      )}
    </div>
  );
}
