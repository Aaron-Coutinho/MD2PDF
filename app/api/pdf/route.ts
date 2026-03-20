import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutablePath } from "@/lib/browser";
import { buildPrintableDocument } from "@/lib/rendering";
import { PdfRequestSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    const parsed = PdfRequestSchema.parse(await request.json());

    browser = await puppeteer.launch({
      executablePath: resolveBrowserExecutablePath(),
      headless: true,
      args: []
    });

    const page = await browser.newPage();
    await page.setContent(buildPrintableDocument(parsed.html, parsed.pdfOptions), {
      waitUntil: "networkidle0"
    });

    const pdfBytes = await page.pdf({
      format: parsed.pdfOptions.pageSize,
      printBackground: true,
      preferCSSPageSize: true
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=converted.pdf"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF error.";

    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await browser?.close();
  }
}
