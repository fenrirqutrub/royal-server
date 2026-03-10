// src/utils/generateNoticePdf.js
// npm install pdfkit

import PDFDocument from "pdfkit";

const GOLD = "#C9A84C";
const DARK = "#1A1A2E";
const LIGHT_GOLD = "#F5E6C8";
const MID = "#2E2E4E";
const GRAY = "#6B6B8A";
const WHITE = "#FFFFFF";

/**
 * Safe date formatter.
 * Mongoose .toObject() returns Date objects (not ISO strings),
 * so we handle both types here — this was the root cause of the crash.
 */
const fmtDate = (val) => {
  if (!val) return "N/A";
  const d = val instanceof Date ? val : new Date(val);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Generate a branded Royal Academy notice PDF as a Buffer.
 * @param {{ noticeSlug: string, notice: string, createdAt: Date|string, expiresAt: Date|string }} notice
 * @returns {Promise<Buffer>}
 */
export const generateNoticePdf = (notice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = doc.page.width; // 595.28 pt
      const H = doc.page.height; // 841.89 pt
      const mm = 2.8346; // 1 mm in pt

      // ── double border ─────────────────────────────────────────────────────
      doc
        .rect(12 * mm, 12 * mm, W - 24 * mm, H - 24 * mm)
        .lineWidth(2.5)
        .strokeColor(GOLD)
        .stroke();
      doc
        .rect(15 * mm, 15 * mm, W - 30 * mm, H - 30 * mm)
        .lineWidth(0.8)
        .strokeColor(GOLD)
        .stroke();

      // ── header band ───────────────────────────────────────────────────────
      doc
        .rect(12 * mm, H - 55 * mm, W - 24 * mm, 43 * mm)
        .fillColor(DARK)
        .fill();
      doc
        .rect(12 * mm, H - 57 * mm, W - 24 * mm, 2 * mm)
        .fillColor(GOLD)
        .fill();

      // ── logo circle ───────────────────────────────────────────────────────
      doc
        .circle(W / 2, H - 30 * mm, 12 * mm)
        .fillColor(GOLD)
        .fill();
      doc
        .circle(W / 2, H - 30 * mm, 10 * mm)
        .fillColor(DARK)
        .fill();
      doc
        .fillColor(GOLD)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("RA", W / 2 - 8, H - 33 * mm, { width: 16, align: "center" });

      // ── academy name ──────────────────────────────────────────────────────
      doc
        .fillColor(WHITE)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("ROYAL ACADEMY", 0, H - 51 * mm, { align: "center" });
      doc
        .fillColor(LIGHT_GOLD)
        .font("Helvetica")
        .fontSize(9)
        .text("Excellence in Education", 0, H - 45 * mm, { align: "center" });

      // ── NOTICE heading ────────────────────────────────────────────────────
      doc
        .fillColor(GOLD)
        .font("Helvetica-Bold")
        .fontSize(28)
        .text("NOTICE", 0, H - 71 * mm, { align: "center" });
      doc
        .moveTo(W / 2 - 25 * mm, H - 73 * mm)
        .lineTo(W / 2 + 25 * mm, H - 73 * mm)
        .lineWidth(1.5)
        .strokeColor(GOLD)
        .stroke();

      // ── ref + dates bar ───────────────────────────────────────────────────
      doc
        .rect(20 * mm, H - 85 * mm, W - 40 * mm, 9 * mm)
        .fillColor(MID)
        .fill();
      doc
        .fillColor(GOLD)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(`Ref: ${notice.noticeSlug}`, 24 * mm, H - 82 * mm, {
          width: 80 * mm,
          lineBreak: false,
        });
      doc
        .fillColor(LIGHT_GOLD)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `Issued: ${fmtDate(notice.createdAt)}   |   Valid Until: ${fmtDate(notice.expiresAt)}`,
          0,
          H - 82 * mm,
          { align: "right", width: W - 48 * mm, lineBreak: false },
        );

      // ── separator ─────────────────────────────────────────────────────────
      doc
        .moveTo(20 * mm, H - 88 * mm)
        .lineTo(W - 20 * mm, H - 88 * mm)
        .lineWidth(0.5)
        .strokeColor(LIGHT_GOLD)
        .stroke();

      // ── body text ─────────────────────────────────────────────────────────
      doc
        .fillColor(DARK)
        .font("Helvetica")
        .fontSize(11)
        .text(notice.notice, 22 * mm, H - 99 * mm, {
          width: W - 44 * mm,
          align: "justify",
          lineGap: 5,
        });

      // ── signature ─────────────────────────────────────────────────────────
      const sigY = 52 * mm;
      doc
        .moveTo(W - 75 * mm, sigY)
        .lineTo(W - 22 * mm, sigY)
        .lineWidth(0.8)
        .strokeColor(GOLD)
        .stroke();
      doc
        .fillColor(DARK)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Principal / Authority", W - 75 * mm, sigY + 4, {
          width: 53 * mm,
          align: "center",
        });
      doc
        .fillColor(GRAY)
        .font("Helvetica")
        .fontSize(8)
        .text("Royal Academy", W - 75 * mm, sigY + 14, {
          width: 53 * mm,
          align: "center",
        });

      // ── footer band ───────────────────────────────────────────────────────
      doc
        .rect(12 * mm, 12 * mm, W - 24 * mm, 18 * mm)
        .fillColor(DARK)
        .fill();
      doc
        .rect(12 * mm, 28 * mm, W - 24 * mm, 1 * mm)
        .fillColor(GOLD)
        .fill();
      doc
        .fillColor(LIGHT_GOLD)
        .font("Helvetica")
        .fontSize(7.5)
        .text(
          "Royal Academy  |  This is an official notice. Please retain for your records.",
          0,
          19 * mm,
          { align: "center" },
        );

      // ── corner dots ───────────────────────────────────────────────────────
      for (const [cx, cy] of [
        [18 * mm, H - 18 * mm],
        [W - 18 * mm, H - 18 * mm],
        [18 * mm, 18 * mm],
        [W - 18 * mm, 18 * mm],
      ]) {
        doc
          .circle(cx, cy, 2 * mm)
          .fillColor(GOLD)
          .fill();
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};
