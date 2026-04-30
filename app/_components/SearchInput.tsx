"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  initialValue: string;
}

export function SearchInput({ initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/search?${qs}` : "/search");
      });
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="mb-5 flex gap-2.5">
      <input
        autoFocus
        className="input flex-1"
        style={{ fontSize: 15, padding: "14px 16px" }}
        placeholder="e.g. TCS, climbing, doctor, disciplined…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {isPending && <span className="spinner" style={{ alignSelf: "center" }} />}
    </div>
  );
}
