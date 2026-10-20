import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Skills catalogue",
};

export default function Page() {
  return <SectionPage section="skills" />;
}
