import Image from "next/image";
import Link from "next/link";

/**
 * Sellify logo: purple "S" mark + wordmark in Plus Jakarta Sans.
 * Use `mark` alone only where the wordmark does not fit (favicon, tight bars).
 */
export function Logo({ href = "/", mark = false }: { href?: string; mark?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="Sellify home">
      <Image src="/brand/sellify-logo.png" alt="" width={31} height={24} priority />
      {mark ? null : <span className="font-heading text-heading font-bold tracking-tight text-fg">Sellify</span>}
    </Link>
  );
}
