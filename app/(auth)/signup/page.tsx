import Link from "next/link";
import { SignUpForm } from "../../_components/SignUpForm";

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Logo />
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start building your people knowledge graph.
        </p>
      </div>

      <SignUpForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Logo() {
  return (
    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <span className="text-base font-bold">SB</span>
    </div>
  );
}
