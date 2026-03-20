import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Schema } from "hast-util-sanitize";
import { normalizeCopiedMarkdown } from "./normalize-markdown";
import type { PdfOptions, RenderOptions } from "./types";
import { escapeHtml } from "./validation";

type AttributeMap = NonNullable<Schema["attributes"]>;

const marginMap: Record<PdfOptions["margin"], string> = {
  narrow: "12mm",
  normal: "18mm",
  wide: "24mm"
};

let katexCssCache = "";
let appCssCache = "";
const baseAttributes = (defaultSchema.attributes ?? {}) as AttributeMap;
const KATEX_FONT_BASE = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/fonts/";

const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mn",
    "mo",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "msqrt",
    "mstyle",
    "mspace",
    "mtext",
    "mpadded",
    "mphantom",
    "mtable",
    "mtr",
    "mtd",
    "mlabeledtr",
    "mfenced",
    "mroot",
    "munder",
    "mover",
    "munderover",
    "mmultiscripts",
    "mprescripts",
    "none",
    "menclose"
  ],
  attributes: {
    ...baseAttributes,
    "*": [...(baseAttributes["*"] ?? []), ["className", /^[a-zA-Z0-9_\-: ]+$/], "style"],
    span: [...(baseAttributes.span ?? []), ["className", /^[a-zA-Z0-9_\-: ]+$/], "style"],
    div: [...(baseAttributes.div ?? []), ["className", /^[a-zA-Z0-9_\-: ]+$/]],
    code: [...(baseAttributes.code ?? []), ["className", /^[a-zA-Z0-9_\-: ]+$/]]
  }
};

export async function renderToHtml(
  rawText: string,
  inputType: "markdown" | "text",
  options: RenderOptions
): Promise<string> {
  const content =
    inputType === "markdown"
      ? await markdownToHtml(rawText)
      : `<div class="plain-text">${escapeHtml(rawText)}</div>`;

  return `<article class="render-root headings-on density-balanced section-spacing-normal equation-spacing-normal list-style-plain" style="--render-font-scale: ${options.fontScale}rem;">${content}</article>`;
}

export function buildPrintableDocument(contentHtml: string, options: PdfOptions, autoPrint = false): string {
  const printScript = autoPrint
    ? `
    <script>
      window.addEventListener("load", () => {
        setTimeout(() => {
          window.print();
        }, 150);
      });
    </script>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${loadKatexCss()}</style>
    <style>${loadAppCss()}</style>
    <style>${printStyles(options)}</style>
  </head>
  <body class="print-body">
    <main class="print-root">${contentHtml}</main>
    ${printScript}
  </body>
</html>`;
}

async function markdownToHtml(rawText: string): Promise<string> {
  const normalized = normalizeCopiedMarkdown(rawText);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(normalized);

  return String(result);
}

function loadKatexCss(): string {
  if (katexCssCache) {
    return katexCssCache;
  }

  const cssPath = path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css");
  if (existsSync(cssPath)) {
    katexCssCache = readFileSync(cssPath, "utf8").replaceAll("fonts/", KATEX_FONT_BASE);
    return katexCssCache;
  }

  katexCssCache = "";
  return katexCssCache;
}

function loadAppCss(): string {
  if (appCssCache) {
    return appCssCache;
  }

  const cssPath = path.join(process.cwd(), "app", "globals.css");
  if (existsSync(cssPath)) {
    appCssCache = readFileSync(cssPath, "utf8");
    return appCssCache;
  }

  appCssCache = "";
  return appCssCache;
}

function printStyles(options: PdfOptions): string {
  const margin = marginMap[options.margin];
  return `
    @page { size: ${options.pageSize}; margin: ${margin}; }
    html, body { background: #fff; }
    body.print-body {
      margin: 0;
      min-height: auto;
      background: #fff;
    }
    .print-root {
      max-width: none;
      padding: 0;
    }
    .render-root {
      font-size: var(--render-font-scale, 1rem);
    }
    .preview {
      min-height: auto;
      border: none;
      border-radius: 0;
      padding: 0;
      background: transparent;
      overflow: visible;
    }
  `;
}
