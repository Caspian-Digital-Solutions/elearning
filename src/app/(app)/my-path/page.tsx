import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadMyPathState } from "@/lib/plan/queries";
import { MyPathScreen } from "./my-path-screen";

export const metadata: Metadata = {
  title: "My path",
};

export default async function Page() {
  const user = await requireUser();
  const state = await loadMyPathState(user.id);
  return <MyPathScreen state={state} />;
}
