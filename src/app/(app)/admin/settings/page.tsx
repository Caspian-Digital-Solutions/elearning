import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "Settings",
};

export default function Page() {
  return <SectionPage section="settings" />;
}
