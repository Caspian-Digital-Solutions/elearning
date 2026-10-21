import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const allowedPrefix = /^(lessons|pages)\/[a-zA-Z0-9/_-]+$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { path } = await context.params;
  const objectPath = path.join("/");
  if (!allowedPrefix.test(objectPath) || objectPath.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("content-images")
    .createSignedUrl(objectPath, 600);

  if (error || !data?.signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
