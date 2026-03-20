import { NextResponse } from "next/server";
import { RenderRequestSchema } from "@/lib/types";
import { renderToHtml } from "@/lib/rendering";
import { assertWithinInputLimit } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = RenderRequestSchema.parse(await request.json());
    assertWithinInputLimit(parsed.rawText);

    const html = await renderToHtml(parsed.rawText, parsed.inputType, parsed.options);
    return NextResponse.json({ html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown render error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
