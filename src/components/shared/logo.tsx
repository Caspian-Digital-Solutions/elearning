import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/cds-logo.svg"
      alt="CDS AI Academy"
      width={220}
      height={36}
      priority
      className={className}
    />
  );
}
