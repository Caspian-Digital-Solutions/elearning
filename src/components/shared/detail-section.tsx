import Link from "next/link";
import {
  displayParam,
  emptyStateTitle,
  sections,
  type SectionKey,
} from "@/config/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export async function DetailSection({
  section,
  params,
  crumbs,
}: {
  section: SectionKey;
  params: Promise<Record<string, string>>;
  crumbs: (value: Record<string, string>) => { href?: string; label: string }[];
}) {
  const resolved = await params;
  const item = sections[section];
  const trail = crumbs(resolved);
  const current = trail[trail.length - 1]?.label ?? item.title;

  return (
    <>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          {trail.flatMap((crumb, index) => {
            const last = index === trail.length - 1;
            const item = (
              <BreadcrumbItem key={`${crumb.label}-${index}`}>
                {last || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            );
            if (index === 0) {
              return [item];
            }
            return [<BreadcrumbSeparator key={`sep-${index}`} />, item];
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title={current} purpose={item.purpose} />
      <EmptyState title={emptyStateTitle(item)} description={item.emptyDetail} />
    </>
  );
}

export function labelled(value: string, prefix: string): string {
  return `${prefix} ${displayParam(value)}`.trim();
}
