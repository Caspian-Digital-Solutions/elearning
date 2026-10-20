import {
  emptyStateTitle,
  sections,
  type SectionKey,
} from "@/config/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export function SectionPage({ section }: { section: SectionKey }) {
  const item = sections[section];
  return (
    <>
      <PageHeader title={item.title} purpose={item.purpose} />
      <EmptyState title={emptyStateTitle(item)} description={item.emptyDetail} />
    </>
  );
}
