import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/**
 * Extracts every Tj text-show operand from a PDF, in stream order.
 * FAF súmulas are text-layer PDFs (not scanned) with a single-byte
 * WinAnsiEncoding font, so bytes map 1:1 to Latin-1 codepoints — no OCR
 * or font-encoding table needed.
 */
export function extractPdfStrings(pdfPath: string): string[] {
  const fileBuf = readFileSync(pdfPath);
  const fileStr = fileBuf.toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const results: string[] = [];

  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRe.exec(fileStr))) {
    const rawBuf = Buffer.from(streamMatch[1], "latin1");
    let content: Buffer;
    try {
      content = inflateSync(rawBuf);
    } catch {
      continue; // not a FlateDecode stream (e.g. embedded image data)
    }

    const contentStr = content.toString("latin1");
    const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRe.exec(contentStr))) {
      results.push(tjMatch[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\"));
    }
  }

  return results;
}
