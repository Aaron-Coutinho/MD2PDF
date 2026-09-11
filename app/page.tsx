"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { InputType, RenderOptions } from "@/lib/types";
import { DEFAULT_RENDER_OPTIONS, MAX_INPUT_BYTES } from "@/lib/shared";

const INITIAL_TEXT = `# Welcome to MD2PDF\n\nWrite Markdown on the left and see the formatted document here.\n\n- **Bold** and *italic* text\n- Inline math: $E = mc^2$`;
const CONTENT_STORAGE_KEY = "md2pdf-content-v2";
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
  const [editorWidth, setEditorWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
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
    window.localStorage.setItem("md2pdf-theme", theme);

    return () => {
      delete document.body.dataset.theme;
    };
  }, [theme]);

  useEffect(() => {
    const savedText = window.localStorage.getItem(CONTENT_STORAGE_KEY);
    const savedTheme = window.localStorage.getItem("md2pdf-theme");

    if (savedText) {
      setRawText(savedText);
    }
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CONTENT_STORAGE_KEY, rawText);
  }, [rawText]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function onPointerMove(event: PointerEvent): void {
      const width = window.innerWidth;
      const nextWidth = (event.clientX / width) * 100;
      setEditorWidth(Math.min(70, Math.max(30, nextWidth)));
    }

    function onPointerUp(): void {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging]);

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

      const targetName = `md2pdf-print-${Date.now()}`;
      const printWindow = window.open("", targetName);

      if (!printWindow) {
        throw new Error("Popup blocked. Allow popups to open the print view.");
      }

      printWindow.document.write(
        "<!doctype html><title>Preparing PDF...</title><p style=\"font-family:Segoe UI,sans-serif;padding:16px;\">Preparing print view...</p>"
      );
      printWindow.document.close();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/print";
      form.target = targetName;
      form.style.display = "none";

      const htmlInput = document.createElement("input");
      htmlInput.type = "hidden";
      htmlInput.name = "html";
      htmlInput.value = html;

      const optionsInput = document.createElement("input");
      optionsInput.type = "hidden";
      optionsInput.name = "pdfOptions";
      optionsInput.value = JSON.stringify({
        pageSize: options.pageSize,
        margin: options.margin
      });

      form.append(htmlInput, optionsInput);
      document.body.append(form);
      form.submit();
      form.remove();
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

  function downloadSource(extension: "md" | "txt"): void {
    const blob = new Blob([rawText], {
      type: extension === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `markdown-export.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const isBusy = isRendering || isExporting;

  return (
    <main className={`editor-app${isDragging ? " is-dragging" : ""}`}>
      <header className="toolbar">
        <div className="brand"><span className="brand-mark">M</span><span>MD2PDF</span></div>
        <span className="toolbar-status">{isRendering ? "Rendering preview..." : "Live preview"}</span>
        <div className="toolbar-actions">
          <label className="toolbar-file">Open file<input type="file" accept=".md,.txt,text/plain,text/markdown" onChange={onFileChange} /></label>
          <button type="button" onClick={() => downloadSource("md")}>Download MD</button>
          <button type="button" onClick={() => downloadSource("txt")}>Download TXT</button>
          <button type="button" className="primary" onClick={() => void exportPdf()} disabled={isBusy || isTooLarge}>
            {isExporting ? "Preparing..." : "Save as PDF"}
          </button>
          <button type="button" className="icon-button" onClick={() => setTheme((previous) => (previous === "light" ? "dark" : "light"))} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title="Toggle dark mode">
            {theme === "light" ? "☾" : "☀"}
          </button>
        </div>
      </header>

      <section className="workspace" style={{ gridTemplateColumns: `${editorWidth}% 8px minmax(0, 1fr)` }}>
        <section className="editor-pane">
          <div className="pane-heading"><span>Editor</span><span className="autosave">Saved locally</span></div>
          <div className="editor-options">
            <select aria-label="Input type" value={inputType} onChange={(event) => setInputType(event.target.value as InputType)}>
              <option value="markdown">Markdown</option><option value="text">Plain text</option>
            </select>
            <select aria-label="Page size" value={options.pageSize} onChange={(event) => setOptions((previous) => ({ ...previous, pageSize: event.target.value as RenderOptions["pageSize"] }))}>
              <option value="A4">A4</option><option value="Letter">Letter</option>
            </select>
            <select aria-label="Margin" value={options.margin} onChange={(event) => setOptions((previous) => ({ ...previous, margin: event.target.value as RenderOptions["margin"] }))}>
              <option value="narrow">Narrow margin</option><option value="normal">Normal margin</option><option value="wide">Wide margin</option>
            </select>
          </div>
          <textarea className="markdown-input" value={rawText} onChange={(event) => setRawText(event.target.value)} spellCheck={false} aria-label="Markdown editor" />
          <div className="editor-footer"><span>{rawText.length.toLocaleString()} characters</span><label>Scale {options.fontScale.toFixed(2)}<input type="range" min={0.8} max={1.4} step={0.05} value={options.fontScale} onChange={(event) => setOptions((previous) => ({ ...previous, fontScale: Number(event.target.value) }))} /></label></div>
        </section>
        <button type="button" className="splitter" onPointerDown={() => setIsDragging(true)} aria-label="Resize editor and preview" title="Drag to resize"><span /></button>
        <section className="preview-pane">
          <div className="pane-heading"><span>Preview</span><button type="button" className="refresh-button" onClick={() => void refreshPreview()} disabled={isBusy || isTooLarge}>{isRendering ? "..." : "Refresh"}</button></div>
          {isTooLarge || error ? <p className="error preview-error">{isTooLarge ? "Input exceeds 1 MB." : error}</p> : null}
          <div className="preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </section>
      </section>
    </main>
  );
}
