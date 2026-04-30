import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card text-center" style={{ padding: "40px 20px" }}>
      <h3 className="m-0 mb-2 text-[var(--color-text)]">Person not found</h3>
      <p className="m-0 text-[var(--color-text-dim)]">
        That person doesn't exist (anymore?) in your graph.
      </p>
      <Link
        href="/people"
        className="btn"
        style={{ marginTop: 16, display: "inline-flex" }}
      >
        Back to people
      </Link>
    </div>
  );
}
