const PDF_LINE_SETTINGS_KEY = 'pdf_line_settings_v1';

export const DEFAULT_PDF_HEADER_LINE = 'SHUKRANA MUSKURANA!';
export const DEFAULT_PDF_FOOTER_LINE = "With God's blessings, thank you for your trust.";

export interface PdfLineSettings {
  headerLine: string;
  footerLine: string;
}

const clampToThreeLines = (value: string): string => {
  return value.replace(/\r\n/g, '\n').split('\n').slice(0, 3).join('\n');
};

const sanitize = (settings: Partial<PdfLineSettings>): PdfLineSettings => {
  return {
    headerLine: clampToThreeLines(settings.headerLine ?? DEFAULT_PDF_HEADER_LINE),
    footerLine: clampToThreeLines(settings.footerLine ?? DEFAULT_PDF_FOOTER_LINE),
  };
};

export const getPdfLineSettings = (): PdfLineSettings => {
  try {
    const raw = localStorage.getItem(PDF_LINE_SETTINGS_KEY);
    if (!raw) return sanitize({});
    return sanitize(JSON.parse(raw));
  } catch {
    return sanitize({});
  }
};

export const savePdfLineSettings = (settings: PdfLineSettings): PdfLineSettings => {
  const next = sanitize(settings);
  localStorage.setItem(PDF_LINE_SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const previewPdfLineSettings = (settings: Partial<PdfLineSettings>): PdfLineSettings => {
  return sanitize(settings);
};

