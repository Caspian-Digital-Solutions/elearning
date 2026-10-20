import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Marking queue",
};

export default function Page() {
  return <SectionPage section="marking" />;
}
