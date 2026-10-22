import { NextResponse } from "next/server";
import { authorise } from "@/lib/auth";
import { buildPersonalDataZip } from "@/lib/admin/personal-data-export";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ userId: string }>;

export async function GET(_request: Request, context: { params: Params }) {
  const admin = await authorise(["admin"]);
  if (!admin) {
    return NextResponse.redirect(new URL("/login", _request.url));
  }
  const { userId } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_log_event", {
    p_table_name: "profiles",
    p_row_id: userId,
    p_reason: "Personal data export downloaded by admin.",
    p_event: "personal_data_export",
  });
  if (error) {
    return new NextResponse("The export could not be recorded.", { status: 500 });
  }
  const zip = await buildPersonalDataZip(userId);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="personal-data-${userId}.zip"`,
    },
  });
}
