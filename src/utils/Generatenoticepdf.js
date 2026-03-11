// src/utils/generateNoticePdf.js

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "../../fonts");

// ── Resolve font paths ────────────────────────────────────────────────────────
const resolveFonts = () => {
  // Priority: env var → Hind Siliguri → SutonnyOMJ → pdfkit built-in
  const candidates = {
    regular: [
      process.env.BANGLA_FONT_REGULAR,
      path.join(FONTS_DIR, "HindSiliguri-Regular.ttf"),
      path.join(FONTS_DIR, "NotoSansBengali-Regular.ttf"),
      path.join(FONTS_DIR, "SutonnyOMJ.ttf"),
    ].filter(Boolean),

    bold: [
      process.env.BANGLA_FONT_BOLD,
      path.join(FONTS_DIR, "HindSiliguri-Bold.ttf"),
      path.join(FONTS_DIR, "NotoSansBengali-Bold.ttf"),
      // no SutonnyOMJ bold — will simulate
    ].filter(Boolean),
  };

  const regularFont = candidates.regular.find((p) => fs.existsSync(p)) || null;
  const boldFont = candidates.bold.find((p) => fs.existsSync(p)) || null;

  if (!regularFont) {
    throw new Error(
      `No Bangla font found. Place HindSiliguri-Regular.ttf in ${FONTS_DIR}/\n` +
        `Download: https://fonts.google.com/specimen/Hind+Siliguri`,
    );
  }

  return {
    regular: regularFont,
    bold: boldFont || regularFont,
    simulateBold: !boldFont,
  };
};

// ── Logo path ─────────────────────────────────────────────────────────────────
const LOGO_PATH =
  process.env.NOTICE_LOGO_PATH || path.join(__dirname, "../../Public/logo.png");

// ── Bangla date helpers ───────────────────────────────────────────────────────
const BANGLA_DAYS = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];

const BANGLA_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

const toD = (val) => (val instanceof Date ? val : new Date(val));

const fmtBanglaDate = (val) => {
  if (!val) return "N/A";
  const d = toD(val);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy} ইং`;
};

const fmtBanglaDateLong = (val) => {
  if (!val) return "N/A";
  const d = toD(val);
  return `${d.getDate()} ${BANGLA_MONTHS[d.getMonth()]} ${d.getFullYear()} ইং`;
};

const fmtDate = (val) => {
  if (!val) return "N/A";
  return toD(val).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getBanglaDay = (val) => {
  if (!val) return "";
  return BANGLA_DAYS[toD(val).getDay()];
};

// ── Bold simulation helper ────────────────────────────────────────────────────
// When no bold font is available, draws text twice with a thin stroke
// to mimic bold weight. Works with any single-weight font.
const drawBold = (doc, text, x, y, opts = {}) => {
  const { color = "#111111", strokeW = 0.35, ...rest } = opts;

  // Fill pass
  doc
    .save()
    .fillColor(color)
    .text(text, x, y, { ...rest, fill: true, stroke: false })
    .restore();

  // Stroke pass — repositions cursor back before drawing
  doc
    .save()
    .lineWidth(strokeW)
    .strokeColor(color)
    .fillColor(color)
    .text(text, x, y, { ...rest, fill: true, stroke: true })
    .restore();
};

// ── Decorative border helper ──────────────────────────────────────────────────
const drawBorders = (doc, W, H, mm) => {
  // Outer border
  doc
    .rect(mm(8), mm(8), W - mm(16), H - mm(16))
    .lineWidth(2.5)
    .strokeColor("#1a1a1a")
    .stroke();

  // Inner border (double border effect)
  doc
    .rect(mm(11), mm(11), W - mm(22), H - mm(22))
    .lineWidth(0.6)
    .strokeColor("#555555")
    .stroke();

  // Corner ornaments
  const corners = [
    [mm(8), mm(8)],
    [W - mm(8), mm(8)],
    [mm(8), H - mm(8)],
    [W - mm(8), H - mm(8)],
  ];
  corners.forEach(([cx, cy]) => {
    doc.circle(cx, cy, mm(2)).lineWidth(1).fillAndStroke("#f5c542", "#333333");
  });
};

// ── Header section ────────────────────────────────────────────────────────────
const drawHeader = (doc, notice, W, mm, fonts, simulateBold) => {
  const hasLogo = fs.existsSync(LOGO_PATH);
  const logoSize = mm(26);
  const logoX = mm(18);
  const logoY = mm(14);

  if (hasLogo) {
    try {
      doc.image(LOGO_PATH, logoX, logoY, {
        width: logoSize,
        height: logoSize,
        fit: [logoSize, logoSize],
      });
    } catch {
      // logo load failed — skip silently
    }
  }

  // Academy name
  const academyName = notice.academyName || "রেয়েল একাডেমি, বেলকুচি";
  doc.font(fonts.bold).fontSize(24).fillColor("#111111");

  if (simulateBold) {
    drawBold(doc, academyName, 0, mm(16), {
      align: "center",
      width: W,
      color: "#111111",
    });
  } else {
    doc.text(academyName, 0, mm(16), { align: "center", width: W });
  }

  // Sub-title line (address / tagline)
  const subTitle = notice.subTitle || "বেলকুচি, সিরাজগঞ্জ";
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor("#444444")
    .text(subTitle, 0, mm(26), { align: "center", width: W });

  // Notice heading banner
  const noticeHeading = notice.noticeHeading || "জরুরি বিজ্ঞপ্তি";
  const bannerY = mm(33);
  const bannerH = mm(11);

  // Banner background
  doc.rect(mm(15), bannerY - mm(1.5), W - mm(30), bannerH).fill("#f5c542");

  // Banner text
  doc.font(fonts.bold).fontSize(16).fillColor("#111111");
  if (simulateBold) {
    drawBold(doc, noticeHeading, 0, bannerY + mm(1), {
      align: "center",
      width: W,
      color: "#111111",
      strokeW: 0.3,
    });
  } else {
    doc.text(noticeHeading, 0, bannerY + mm(1), { align: "center", width: W });
  }

  // Divider below banner
  doc
    .moveTo(mm(15), mm(46))
    .lineTo(W - mm(15), mm(46))
    .lineWidth(1)
    .strokeColor("#222222")
    .stroke();
};

// ── Date / Reference row ──────────────────────────────────────────────────────
const drawMetaRow = (doc, notice, W, mm, fonts, simulateBold) => {
  const rowY = mm(50);

  // Left: date
  const dateLabel = `তাংঃ ${fmtBanglaDateLong(notice.createdAt)}`;
  doc.font(fonts.bold).fontSize(11).fillColor("#111111");
  if (simulateBold) {
    drawBold(doc, dateLabel, mm(18), rowY, { color: "#111111", strokeW: 0.3 });
  } else {
    doc.text(dateLabel, mm(18), rowY);
  }

  // Right: day name
  const dayLabel = `রোজঃ ${getBanglaDay(notice.createdAt)}`;
  doc.font(fonts.bold).fontSize(11).fillColor("#111111");
  if (simulateBold) {
    // measure approx width and place right-aligned manually
    drawBold(doc, dayLabel, 0, rowY, {
      align: "right",
      width: W - mm(18),
      color: "#111111",
      strokeW: 0.3,
    });
  } else {
    doc.text(dayLabel, 0, rowY, { align: "right", width: W - mm(18) });
  }

  // Ref slug — right side below day
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor("#888888")
    .text(`Ref: ${notice.noticeSlug}`, 0, rowY + mm(6), {
      align: "right",
      width: W - mm(18),
    });

  // Thin divider
  doc
    .moveTo(mm(15), mm(62))
    .lineTo(W - mm(15), mm(62))
    .lineWidth(0.5)
    .strokeColor("#aaaaaa")
    .stroke();
};

// ── Body text ─────────────────────────────────────────────────────────────────
const drawBody = (doc, notice, W, mm, fonts) => {
  // "বিষয়ঃ" label
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor("#333333")
    .text("সকলের অবগতির জন্য জানানো যাইতেছে যে,", mm(20), mm(68), {
      width: W - mm(40),
    });

  // Main notice content
  doc
    .font(fonts.regular)
    .fontSize(13)
    .fillColor("#111111")
    .text(notice.notice, mm(20), mm(78), {
      width: W - mm(40),
      align: "justify",
      lineGap: 7,
      paragraphGap: 6,
    });
};

// ── Signature block ───────────────────────────────────────────────────────────
const drawSignature = (doc, notice, W, H, mm, fonts, simulateBold) => {
  const sigW = mm(72);
  const sigX = W - mm(18) - sigW;
  const sigLineY = H - mm(58);

  // Signature line
  doc
    .moveTo(sigX, sigLineY)
    .lineTo(sigX + sigW, sigLineY)
    .lineWidth(0.8)
    .strokeColor("#333333")
    .stroke();

  // Name
  const sigName = notice.signatureName || "মোঃ শাহরিয়ার আহমেদ";
  doc.font(fonts.bold).fontSize(12).fillColor("#111111");
  if (simulateBold) {
    drawBold(doc, sigName, sigX, sigLineY + mm(3), {
      width: sigW,
      align: "center",
      color: "#111111",
      strokeW: 0.3,
    });
  } else {
    doc.text(sigName, sigX, sigLineY + mm(3), { width: sigW, align: "center" });
  }

  // Title
  doc
    .font(fonts.regular)
    .fontSize(11)
    .fillColor("#333333")
    .text(
      notice.signatureTitle || "ব্যবস্থাপনা পরিচালক",
      sigX,
      sigLineY + mm(10),
      {
        width: sigW,
        align: "center",
      },
    );

  // Institution lines
  doc
    .font(fonts.regular)
    .fontSize(10)
    .fillColor("#555555")
    .text(notice.academyName || "রেয়েল একাডেমি", sigX, sigLineY + mm(17), {
      width: sigW,
      align: "center",
    })
    .text("বেলকুচি, সিরাজগঞ্জ", sigX, sigLineY + mm(24), {
      width: sigW,
      align: "center",
    });
};

// ── Footer ────────────────────────────────────────────────────────────────────
const drawFooter = (doc, notice, W, H, mm, fonts) => {
  // Footer divider
  doc
    .moveTo(mm(15), H - mm(14))
    .lineTo(W - mm(15), H - mm(14))
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke();

  // Footer text
  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor("#aaaaaa")
    .text(
      `Ref: ${notice.noticeSlug}   ·   Issued: ${fmtDate(notice.createdAt)}   ·   Valid Until: ${fmtDate(notice.expiresAt)}`,
      0,
      H - mm(10),
      { align: "center", width: W },
    );
};

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Generate a branded Royal Academy notice PDF as a Buffer.
 *
 * @param {{
 *   noticeSlug: string,
 *   notice: string,
 *   createdAt: Date|string,
 *   expiresAt: Date|string,
 *   signatureName?: string,
 *   signatureTitle?: string,
 *   academyName?: string,
 *   subTitle?: string,
 *   noticeHeading?: string,
 * }} notice
 * @returns {Promise<Buffer>}
 */
export const generateNoticePdf = (notice) => {
  return new Promise((resolve, reject) => {
    try {
      // Resolve fonts — throws if no font found
      const { regular, bold, simulateBold } = resolveFonts();
      const fonts = { regular, bold };

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: notice.noticeSlug || "Notice",
          Author: notice.academyName || "রেয়েল একাডেমি",
          Subject: notice.noticeHeading || "জরুরি বিজ্ঞপ্তি",
          Creator: "Royal Academy Notice System",
        },
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Register fonts
      doc.registerFont("BanglaRegular", regular);
      doc.registerFont("BanglaBold", bold);

      const W = doc.page.width; // 595.28 pt
      const H = doc.page.height; // 841.89 pt
      const mm = (n) => n * 2.8346;

      // ── White background
      doc.rect(0, 0, W, H).fillColor("#FFFFFF").fill();

      // ── Decorative borders + corners
      drawBorders(doc, W, H, mm);

      // ── Header (logo + academy name + notice heading banner)
      drawHeader(doc, notice, W, mm, fonts, simulateBold);

      // ── Date / Day / Ref row
      drawMetaRow(doc, notice, W, mm, fonts, simulateBold);

      // ── Body notice text
      drawBody(doc, notice, W, mm, fonts);

      // ── Signature block
      drawSignature(doc, notice, W, H, mm, fonts, simulateBold);

      // ── Footer
      drawFooter(doc, notice, W, H, mm, fonts);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};
