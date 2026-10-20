import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Rules and help",
};

export default function Page() {
  return <SectionPage section="help" />;
}
