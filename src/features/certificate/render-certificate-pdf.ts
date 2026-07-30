import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { CLAUDE_CERT_LAYOUT } from "./constants";
import { loadCertificateTemplate } from "./template-source";

function toWinAnsiSafe(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function drawCalibrationGrid(page: PDFPage, font: PDFFont): void {
  const { width, height } = page.getSize();
  for (let i = 1; i < 20; i += 1) {
    const r = i / 20;
    page.drawLine({
      start: { x: width * r, y: 0 },
      end: { x: width * r, y: height },
      thickness: 0.3,
      color: rgb(1, 0, 0),
      opacity: 0.35,
    });
    page.drawLine({
      start: { x: 0, y: height * r },
      end: { x: width * r, y: height * r },
      thickness: 0.3,
      color: rgb(0, 0, 1),
      opacity: 0.35,
    });
    page.drawText(r.toFixed(2), {
      x: width * r + 1,
      y: 3,
      size: 5,
      font,
      color: rgb(1, 0, 0),
    });
    page.drawText(r.toFixed(2), {
      x: 3,
      y: height * r + 1,
      size: 5,
      font,
      color: rgb(0, 0, 1),
    });
  }
}

export async function renderCertificatePdf(input: {
  recipientName: string;
  certificateId: string;
  /** Already formatted IST string, e.g. "12 Mar 2026". Formatted by the caller. */
  issuedOn: string;
  verifyUrl: string;
  /** Draws a calibration grid over the page. Dev only — see Step 9a. */
  debugGrid?: boolean;
}): Promise<Uint8Array> {
  const { recipientName, certificateId, issuedOn, verifyUrl, debugGrid } =
    input;
  const safeName = toWinAnsiSafe(recipientName);
  if (!safeName) {
    throw new Error("UNRENDERABLE_NAME");
  }

  const pdfDoc = await PDFDocument.load(await loadCertificateTemplate(), {
    updateMetadata: false,
  });
  const page = pdfDoc.getPages()[0];
  if (!page) {
    throw new Error("Certificate template has no pages");
  }
  const { width, height } = page.getSize();

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const L = CLAUDE_CERT_LAYOUT;

  function drawCentered(
    text: string,
    font: PDFFont,
    size: number,
    centerXRatio: number,
    baselineYRatio: number,
    color: { r: number; g: number; b: number },
  ) {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width * centerXRatio - textWidth / 2,
      y: height * baselineYRatio,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  }

  drawCentered(
    issuedOn,
    regular,
    L.issuedOn.fontSize,
    L.issuedOn.centerXRatio,
    L.issuedOn.baselineYRatio,
    L.issuedOn.color,
  );
  drawCentered(
    certificateId,
    bold,
    L.certificateId.fontSize,
    L.certificateId.centerXRatio,
    L.certificateId.baselineYRatio,
    L.certificateId.color,
  );

  const maxWidth = width * L.name.maxWidthRatio;
  let size = L.name.fontSize;
  let textWidth = bold.widthOfTextAtSize(safeName, size);
  while (textWidth > maxWidth && size > L.name.minFontSize) {
    size -= 1;
    textWidth = bold.widthOfTextAtSize(safeName, size);
  }
  page.drawText(safeName, {
    x: width * L.name.centerXRatio - textWidth / 2,
    y: height * L.name.baselineYRatio,
    size,
    font: bold,
    color: rgb(L.name.color.r, L.name.color.g, L.name.color.b),
  });

  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#000000FF", light: "#FFFFFFFF" },
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrSize = width * L.qr.sizeRatio;
  page.drawImage(qrImage, {
    x: width * L.qr.xRatio,
    y: height * L.qr.yRatio,
    width: qrSize,
    height: qrSize,
  });

  page.drawText(verifyUrl.replace(/^https?:\/\//, ""), {
    x: width * L.verifyText.xRatio,
    y: height * L.verifyText.baselineYRatio,
    size: L.verifyText.fontSize,
    font: regular,
    color: rgb(
      L.verifyText.color.r,
      L.verifyText.color.g,
      L.verifyText.color.b,
    ),
  });

  pdfDoc.setTitle(`ABTalks Certificate — ${certificateId}`);
  pdfDoc.setAuthor("ABTalks");
  pdfDoc.setSubject("60-Day Claude Challenge Certificate");
  pdfDoc.setKeywords([certificateId]);
  pdfDoc.setProducer("ABTalks");

  if (debugGrid) {
    drawCalibrationGrid(page, bold);
  }

  return await pdfDoc.save();
}
