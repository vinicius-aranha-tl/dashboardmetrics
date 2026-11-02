import { cn } from "@/lib/utils";

/** Original transparent artwork, displayed with its intrinsic proportions. */
export function BrandLogo({ className }: { className?: string }) {
  return <img src="/quality-hub-conecta.png" alt="Quality Hub" className={cn("h-auto w-full object-contain", className)} />;
}
