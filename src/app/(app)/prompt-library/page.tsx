import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Prompt library",
};

export default function Page() {
  return <SectionPage section="promptLibrary" />;
}
