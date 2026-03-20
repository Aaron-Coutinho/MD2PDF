"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { InputType, RenderOptions } from "@/lib/types";
import { DEFAULT_RENDER_OPTIONS, MAX_INPUT_BYTES } from "@/lib/shared";

const INITIAL_TEXT = `# Sample\n\nPaste markdown or plain text here. Math works too: $x^2 + y^2 = z^2$.`;
const encoder = new TextEncoder();

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function inferInputType(filename: string): InputType {
  return filename.toLowerCase().endsWith(".md") ? "markdown" : "text";
}

function getPreviewKey(
  rawText: string,
  inputType: InputType,
  options: RenderOptions
): string {
  return JSON.stringify({ rawText, inputType, options });
}

export default function HomePage() {
  const [rawText, setRawText] = useState(INITIAL_TEXT);
  const [inputType, setInputType] = useState<InputType>("markdown");
  const [options, setOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const latestPreviewKey = useRef("");

  const currentPreviewKey = getPreviewKey(rawText, inputType, options);
  const isTooLarge = byteLength(rawText) > MAX_INPUT_BYTES;

  const requestRenderedHtml = useCallback(async (): Promise<string> => {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, inputType, options })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Render failed.");
    }

    return payload.html as string;
  }, [inputType, options, rawText]);

  const refreshPreview = useCallback(async (): Promise<string | undefined> => {
    if (!rawText.trim()) {
      setPreviewHtml("");
      setError("");
      latestPreviewKey.current = "";
      return undefined;
    }

    if (isTooLarge) {
      setError("Input exceeds 1 MB.");
      return undefined;
    }

    setIsRendering(true);
    setError("");

    try {
      const html = await requestRenderedHtml();
      setPreviewHtml(html);
      latestPreviewKey.current = currentPreviewKey;
      return html;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Render failed.");
      return undefined;
    } finally {
      setIsRendering(false);
    }
  }, [currentPreviewKey, isTooLarge, rawText, requestRenderedHtml]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshPreview();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [currentPreviewKey, refreshPreview]);

  useEffect(() => {
    document.body.dataset.theme = theme;

    return () => {
      delete document.body.dataset.theme;
    };
  }, [theme]);

  async function exportPdf(): Promise<void> {
    if (!rawText.trim()) {
      setError("Enter some text before exporting.");
      return;
    }

    setIsExporting(true);
    setError("");

    try {
      const html =
        latestPreviewKey.current === currentPreviewKey && previewHtml
          ? previewHtml
          : ((await refreshPreview()) ?? "");

      if (!html) {
        throw new Error("Nothing to export.");
      }

      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          pdfOptions: {
            pageSize: options.pageSize,
            margin: options.margin
          }
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "PDF generation failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "converted.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".md") && !file.name.toLowerCase().endsWith(".txt")) {
      setError("Only .md and .txt files are supported.");
      return;
    }

    const text = await file.text();

    if (byteLength(text) > MAX_INPUT_BYTES) {
      setError("File exceeds 1 MB.");
      return;
    }

    setRawText(text);
    setInputType(inferInputType(file.name));
    setError("");
  }

  const isBusy = isRendering || isExporting;

  return (
    <main className="page-shell">
      <section className="panel controls">
        <div className="title-row">
          <h1>MD2PDF</h1>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((previous) => (previous === "light" ? "dark" : "light"))}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        </div>
        <p>Simple markdown/text to PDF converter with math support.</p>

        <label className="field">
          <span>Input type</span>
          <select value={inputType} onChange={(event) => setInputType(event.target.value as InputType)}>
            <option value="markdown">Markdown</option>
            <option value="text">Plain text</option>
          </select>
        </label>

        <label className="field">
          <span>Upload .md/.txt</span>
          <input type="file" accept=".md,.txt,text/plain,text/markdown" onChange={onFileChange} />
        </label>

        <label className="field">
          <span>Content</span>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={16} />
        </label>

        <div className="inline-fields">
          <label className="field">
            <span>Page size</span>
            <select
              value={options.pageSize}
              onChange={(event) => setOptions((previous) => ({ ...previous, pageSize: event.target.value as RenderOptions["pageSize"] }))}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </label>

          <label className="field">
            <span>Margin</span>
            <select
              value={options.margin}
              onChange={(event) => setOptions((previous) => ({ ...previous, margin: event.target.value as RenderOptions["margin"] }))}
            >
              <option value="narrow">Narrow</option>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
            </select>
          </label>

          <label className="field">
            <span>Font scale ({options.fontScale.toFixed(2)})</span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={options.fontScale}
              onChange={(event) => setOptions((previous) => ({ ...previous, fontScale: Number(event.target.value) }))}
            />
          </label>
        </div>

        <div className="actions">
          <button type="button" onClick={() => void refreshPreview()} disabled={isBusy || isTooLarge}>
            {isRendering ? "Rendering..." : "Refresh"}
          </button>
          <button type="button" className="primary" onClick={() => void exportPdf()} disabled={isBusy || isTooLarge}>
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>

        {isTooLarge ? <p className="error">Input exceeds 1 MB.</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel preview-panel">
        <div className="preview-header">
          <h2>Preview</h2>
        </div>

        <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </section>

      <div className="floating-actions">
        <button type="button" onClick={() => void refreshPreview()} disabled={isBusy || isTooLarge}>
          {isRendering ? "Rendering..." : "Refresh"}
        </button>
        <button type="button" className="primary" onClick={() => void exportPdf()} disabled={isBusy || isTooLarge}>
          {isExporting ? "Exporting..." : "Export PDF"}
        </button>
      </div>
    </main>
  );
}
