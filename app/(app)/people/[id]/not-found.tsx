import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <h3 className="text-lg font-medium">Person not found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          That person doesn&apos;t exist (anymore?) in your graph.
        </p>
        <Link
          href="/people"
          className={buttonVariants({
            variant: "outline",
            className: "mt-4",
          })}
        >
          Back to people
        </Link>
      </CardContent>
    </Card>
  );
}
