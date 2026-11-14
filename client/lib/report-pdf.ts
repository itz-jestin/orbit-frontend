// Builds a PDF of the finished report in the browser and downloads it.
// jsPDF is loaded from a CDN only when the button is clicked, so no new
// package has to be installed and the page doesn't get any heavier.

const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

export interface PdfSource {
  domain: string;
  url: string;
}

interface ReportPdfOptions {
  title: string;
  report: string;
  reviewerNotes?: string;
  score?: number | null;
  sources: PdfSource[];
}

// The built-in PDF font only knows basic Latin characters, so swap the
// fancy dashes and quotes the AI likes to use for plain ones.
function cleanText(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

function fileNameFor(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "orbit-report"}.pdf`;
}

export async function downloadReportPdf(opts: ReportPdfOptions) {
  const { jsPDF } = await import(/* @vite-ignore */ JSPDF_URL);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Writes text, wrapping lines and starting a new page when needed.
  const write = (
    text: string,
    size: number,
    { bold = false, grey = false, gapBefore = 0, gapAfter = 6 } = {},
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(grey ? 110 : 30);
    const lines: string[] = doc.splitTextToSize(cleanText(text), maxWidth);
    const lineHeight = size * 1.4;
    y += gapBefore;
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y + size);
      y += lineHeight;
    }
    y += gapAfter;
  };

  write("Orbit research report", 10, { grey: true, gapAfter: 2 });
  write(opts.title, 20, { bold: true, gapAfter: 4 });
  if (opts.score != null) {
    write(`Reviewer score: ${opts.score}/100`, 10, { grey: true, gapAfter: 12 });
  } else {
    y += 8;
  }

  for (const raw of opts.report.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,3}\s+(.*)$/) ?? line.match(/^\*\*(.+)\*\*$/);
    if (heading) {
      write(heading[1], 14, { bold: true, gapBefore: 8, gapAfter: 4 });
    } else {
      write(line, 11);
    }
  }

  if (opts.reviewerNotes) {
    write("Reviewer notes", 14, { bold: true, gapBefore: 12, gapAfter: 4 });
    write(opts.reviewerNotes, 11);
  }

  if (opts.sources.length > 0) {
    write("Sources", 14, { bold: true, gapBefore: 12, gapAfter: 4 });
    opts.sources.forEach((s, i) => {
      write(`[${i + 1}] ${s.domain} - ${s.url}`, 10, { gapAfter: 2 });
    });
  }

  doc.save(fileNameFor(opts.title));
}
