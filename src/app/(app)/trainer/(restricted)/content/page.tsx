import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadTrainerPages, loadTrainerUpdates } from "@/lib/content/queries";
import { ContentScreen } from "@/app/(app)/trainer/(restricted)/content/content-screen";

export const metadata: Metadata = {
  title: "Content",
};

export default async function Page() {
  await requireRole(["trainer", "admin"]);
  const [pages, updates] = await Promise.all([loadTrainerPages(), loadTrainerUpdates()]);
  return <ContentScreen pages={pages} updates={updates} />;
}
