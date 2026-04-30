import { AlertCircle, AlertTriangle } from "lucide-react";
import { hasGroq, hasPostgres, hasTavily } from "@/lib/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Server component. Renders nothing if everything is configured.
 */
export function HealthBanners() {
  const groq = hasGroq();
  const tavily = hasTavily();
  const postgres = hasPostgres();
  if (groq && tavily && postgres) return null;

  return (
    <div className="mb-6 space-y-2">
      {!postgres && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Postgres is not configured</AlertTitle>
          <AlertDescription>
            Set <code>POSTGRES_URL</code> in <code>.env.local</code> (or in
            your Vercel project env). Nothing will be saved until this is set
            up.
          </AlertDescription>
        </Alert>
      )}
      {!groq && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>GROQ_API_KEY is not set</AlertTitle>
          <AlertDescription>
            Note ingestion and Q&amp;A will not work. Add it in{" "}
            <code>.env.local</code>.
          </AlertDescription>
        </Alert>
      )}
      {groq && !tavily && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>TAVILY_API_KEY is not set</AlertTitle>
          <AlertDescription>
            The web-enrichment feature on profile pages will not work, but
            everything else is fully functional.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
