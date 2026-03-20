import { z } from "zod";

export const InputTypeSchema = z.enum(["markdown", "text"]);

export const RenderOptionsSchema = z.object({
  pageSize: z.enum(["A4", "Letter"]).default("A4"),
  margin: z.enum(["narrow", "normal", "wide"]).default("normal"),
  fontScale: z.number().min(0.8).max(1.4).default(1)
});

export const PdfOptionsSchema = z.object({
  pageSize: z.enum(["A4", "Letter"]).default("A4"),
  margin: z.enum(["narrow", "normal", "wide"]).default("normal")
});

export type InputType = z.infer<typeof InputTypeSchema>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;
export type PdfOptions = z.infer<typeof PdfOptionsSchema>;

export const RenderRequestSchema = z.object({
  rawText: z.string(),
  inputType: InputTypeSchema,
  options: RenderOptionsSchema
});

export const PdfRequestSchema = z.object({
  html: z.string(),
  pdfOptions: PdfOptionsSchema
});
