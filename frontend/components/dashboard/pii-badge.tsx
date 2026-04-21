"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  risk: "High" | "Medium" | "Low" | string;
};

export function PiiBadge({ label, risk }: Props) {
  const cls =
    risk === "High"
      ? "bg-red-100 text-red-800 border-red-300"
      : risk === "Medium"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-blue-100 text-blue-800 border-blue-300";
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}
