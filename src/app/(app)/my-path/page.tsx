import type { Metadata } from "next";
import { SectionPage } from "@/components/shared/stub-page";

export const metadata: Metadata = {
  title: "My path",
};

export default function Page() {
  return <SectionPage section="myPath" />;
}
