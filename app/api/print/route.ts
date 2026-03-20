import { NextResponse } from "next/server";
import { buildPrintableDocument } from "@/lib/rendering";
import { PrintRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = PrintRequestSchema.parse(await request.json());
    const html = buildPrintableDocument(parsed.html, parsed.pdfOptions, true);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown print error.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
