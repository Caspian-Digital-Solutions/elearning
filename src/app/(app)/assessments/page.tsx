import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Assessments",
};

export default function Page() {
  return <SectionPage section="assessments" />;
}
