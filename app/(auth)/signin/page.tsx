import Link from "next/link";
import { SignInForm } from "../../_components/SignInForm";

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <Logo />
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your second brain.
        </p>
      </div>

      <SignInForm />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          Create one
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
