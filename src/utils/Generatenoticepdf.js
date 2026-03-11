// src/utils/generateNoticePdf.js

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "../../fonts");

// ── Resolve font paths ────────────────────────────────────────────────────────
const resolveFonts = () => {
  const banglaPath = path.join(FONTS_DIR, "SutonnyOMJ.ttf");
  const englishPath = path.join(FONTS_DIR, "times.ttf");

  if (!fs.existsSync(banglaPath)) {
    throw new Error(
      `SutonnyOMJ font not found. Place SutonnyOMJ.ttf in ${FONTS_DIR}/`,
    );
  }
  if (!fs.existsSync(englishPath)) {
    throw new Error(
      `Times New Roman font not found. Place times.ttf in ${FONTS_DIR}/`,
    );
  }

  return { bangla: banglaPath, english: englishPath };
};

// ── Logo path ─────────────────────────────────────────────────────────────────
const LOGO_PATH =
  process.env.NOTICE_LOGO_PATH || path.join(__dirname, "../../Public/logo.png");

// ── Bangla digit converter ────────────────────────────────────────────────────
const toBanglaDigits = (num) =>
  String(num).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

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

const fmtBanglaDateLong = (val) => {
  if (!val) return "N/A";
  const d = toD(val);
  return `${toBanglaDigits(d.getDate())} ${BANGLA_MONTHS[d.getMonth()]} ${toBanglaDigits(d.getFullYear())} ইং`;
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

// ── Tokenise mixed Bangla/English text ───────────────────────────────────────
/**
 * Splits a string into segments tagged as 'bangla' or 'english'.
 * Spaces and punctuation inherit the preceding segment's script (default: bangla).
 *
 * "বাংলা কবিতা (Bangla Kobita) – বাংলার"
 * → [{script:'bangla', text:'বাংলা কবিতা ('}, {script:'english', text:'Bangla Kobita'}, ...]
 */
const tokeniseMixed = (text) => {
  const segments = [];
  let current = "";
  let currentScript = null;

  for (const ch of text) {
    let chScript;
    if (/[\u0980-\u09FF]/.test(ch)) {
      chScript = "bangla";
    } else if (/[A-Za-z]/.test(ch)) {
      chScript = "english";
    } else {
      // digits, spaces, punctuation → inherit current script
      chScript = currentScript || "bangla";
    }

    if (chScript !== currentScript && current !== "") {
      segments.push({ script: currentScript, text: current });
      current = "";
    }
    currentScript = chScript;
    current += ch;
  }
  if (current)
    segments.push({ script: currentScript || "bangla", text: current });
  return segments;
};

// ── Measure mixed text width ──────────────────────────────────────────────────
const measureMixed = (doc, text, fonts, fontSize) => {
  let total = 0;
  for (const seg of tokeniseMixed(text)) {
    doc
      .font(seg.script === "english" ? fonts.english : fonts.bangla)
      .fontSize(fontSize);
    total += doc.widthOfString(seg.text);
  }
  return total;
};

// ── Draw mixed text inline (no automatic line-break) ─────────────────────────
const drawMixedInline = (doc, text, startX, y, fonts, fontSize, opts = {}) => {
  const { color = "#111111", width: maxWidth, align } = opts;
  const segments = tokeniseMixed(text);

  const totalWidth = measureMixed(doc, text, fonts, fontSize);
  let drawX = startX;
  if (align === "center" && maxWidth != null)
    drawX = startX + (maxWidth - totalWidth) / 2;
  else if (align === "right" && maxWidth != null)
    drawX = startX + maxWidth - totalWidth;

  for (const seg of segments) {
    const font = seg.script === "english" ? fonts.english : fonts.bangla;
    doc
      .font(font)
      .fontSize(fontSize)
      .fillColor(color)
      .text(seg.text, drawX, y, { lineBreak: false });
    doc.font(font).fontSize(fontSize);
    drawX += doc.widthOfString(seg.text);
  }
  return drawX;
};

// ── Draw mixed text block with word-wrap ──────────────────────────────────────
/**
 * Renders a long mixed-script paragraph with automatic word wrap.
 * Returns the Y position after the last rendered line.
 */
const drawMixedBlock = (doc, text, x, y, fonts, fontSize, opts = {}) => {
  const {
    blockWidth = 400,
    lineHeight = fontSize * 1.9,
    color = "#111111",
    align = "left",
  } = opts;

  // Split into word-level tokens preserving whitespace runs
  const rawWords = text.split(/(\s+)/);
  let lineSegs = []; // segments accumulated for the current line
  let lineWidth = 0;
  let curY = y;

  const flushLine = () => {
    if (lineSegs.length === 0) return;
    let totalW = 0;
    for (const seg of lineSegs) {
      doc
        .font(seg.script === "english" ? fonts.english : fonts.bangla)
        .fontSize(fontSize);
      totalW += doc.widthOfString(seg.text);
    }
    let drawX = x;
    if (align === "center") drawX = x + (blockWidth - totalW) / 2;
    else if (align === "right") drawX = x + blockWidth - totalW;

    for (const seg of lineSegs) {
      const font = seg.script === "english" ? fonts.english : fonts.bangla;
      doc
        .font(font)
        .fontSize(fontSize)
        .fillColor(color)
        .text(seg.text, drawX, curY, { lineBreak: false });
      doc.font(font).fontSize(fontSize);
      drawX += doc.widthOfString(seg.text);
    }
    curY += lineHeight;
    lineSegs = [];
    lineWidth = 0;
  };

  for (const word of rawWords) {
    if (word === "") continue;

    const wordSegs = tokeniseMixed(word);
    let wordWidth = 0;
    for (const seg of wordSegs) {
      doc
        .font(seg.script === "english" ? fonts.english : fonts.bangla)
        .fontSize(fontSize);
      wordWidth += doc.widthOfString(seg.text);
    }

    // Wrap if adding this word would exceed blockWidth (but never wrap empty lines)
    if (lineWidth > 0 && lineWidth + wordWidth > blockWidth) {
      flushLine();
    }

    lineSegs.push(...wordSegs);
    lineWidth += wordWidth;
  }
  flushLine(); // last line
  return curY;
};

// ── Bold simulation (mixed-script aware) ─────────────────────────────────────
const drawBoldMixed = (doc, text, x, y, fonts, opts = {}) => {
  const {
    color = "#111111",
    strokeW = 0.35,
    fontSize = 12,
    width: maxWidth,
    align,
  } = opts;
  const segments = tokeniseMixed(text);

  const totalWidth = measureMixed(doc, text, fonts, fontSize);
  let drawX = x;
  if (align === "center" && maxWidth != null)
    drawX = x + (maxWidth - totalWidth) / 2;
  else if (align === "right" && maxWidth != null)
    drawX = x + maxWidth - totalWidth;

  for (const seg of segments) {
    const font = seg.script === "english" ? fonts.english : fonts.bangla;

    // Fill pass
    doc
      .save()
      .font(font)
      .fontSize(fontSize)
      .fillColor(color)
      .text(seg.text, drawX, y, { lineBreak: false, fill: true, stroke: false })
      .restore();

    // Stroke pass (bold simulation)
    doc
      .save()
      .font(font)
      .fontSize(fontSize)
      .lineWidth(strokeW)
      .strokeColor(color)
      .fillColor(color)
      .text(seg.text, drawX, y, { lineBreak: false, fill: true, stroke: true })
      .restore();

    doc.font(font).fontSize(fontSize);
    drawX += doc.widthOfString(seg.text);
  }
};

// ── Decorative border helper ──────────────────────────────────────────────────
const drawBorders = (doc, W, H, mm) => {
  doc
    .rect(mm(8), mm(8), W - mm(16), H - mm(16))
    .lineWidth(2.5)
    .strokeColor("#1a1a1a")
    .stroke();
  doc
    .rect(mm(11), mm(11), W - mm(22), H - mm(22))
    .lineWidth(0.6)
    .strokeColor("#555555")
    .stroke();
  [
    [mm(8), mm(8)],
    [W - mm(8), mm(8)],
    [mm(8), H - mm(8)],
    [W - mm(8), H - mm(8)],
  ].forEach(([cx, cy]) => {
    doc.circle(cx, cy, mm(2)).lineWidth(1).fillAndStroke("#f5c542", "#333333");
  });
};

// ── Header section ────────────────────────────────────────────────────────────
const drawHeader = (doc, notice, W, mm, fonts) => {
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const s = mm(26);
      doc.image(LOGO_PATH, mm(18), mm(14), {
        width: s,
        height: s,
        fit: [s, s],
      });
    } catch {
      /* skip */
    }
  }

  drawBoldMixed(
    doc,
    notice.academyName || "রয়েল একাডেমি, বেলকুচি",
    0,
    mm(16),
    fonts,
    {
      align: "center",
      width: W,
      color: "#111111",
      fontSize: 24,
    },
  );

  drawMixedInline(
    doc,
    notice.subTitle || "মুকুন্দগাতী বাজার, বেলকুচি, সিরাজগঞ্জ",
    0,
    mm(26),
    fonts,
    11,
    {
      color: "#444444",
      align: "center",
      width: W,
    },
  );

  drawBoldMixed(
    doc,
    notice.noticeHeading || "জরুরি বিজ্ঞপ্তি",
    0,
    mm(35) + mm(1),
    fonts,
    {
      align: "center",
      width: W,
      color: "#111111",
      strokeW: 0.3,
      fontSize: 16,
    },
  );
};

// ── Date / Reference row ──────────────────────────────────────────────────────
const drawMetaRow = (doc, notice, W, mm, fonts) => {
  const rowY = mm(45);

  drawMixedInline(
    doc,
    `তাংঃ ${fmtBanglaDateLong(notice.createdAt)}`,
    mm(18),
    rowY,
    fonts,
    11,
    {
      color: "#111111",
    },
  );
  drawMixedInline(
    doc,
    `রোজঃ ${getBanglaDay(notice.createdAt)}`,
    0,
    rowY,
    fonts,
    11,
    {
      color: "#111111",
      align: "right",
      width: W - mm(18),
    },
  );

  const lineY = mm(50) + 15;
  doc
    .moveTo(mm(15), lineY)
    .lineTo(W - mm(15), lineY)
    .lineWidth(1.2)
    .strokeColor("#111111")
    .stroke();
  doc
    .moveTo(mm(15), lineY + 4)
    .lineTo(W - mm(15), lineY + 4)
    .lineWidth(0.6)
    .strokeColor("#111111")
    .stroke();
};

// ── Body text ─────────────────────────────────────────────────────────────────
const drawBody = (doc, notice, W, mm, fonts) => {
  const fullText =
    "এতদ্বারা সকলের অবগতির জন্য জানানো যাইতেছে যে, " + notice.notice;

  drawMixedBlock(doc, fullText, mm(20), mm(80), fonts, 14, {
    blockWidth: W - mm(40),
    lineHeight: 28,
    color: "#111111",
    align: "justify",
  });
};

// ── Signature block ───────────────────────────────────────────────────────────
const drawSignature = (doc, notice, W, H, mm, fonts) => {
  const sigW = mm(72);
  const sigX = W - mm(18) - sigW;
  let sigY = H - mm(58);
  const lineGap = mm(8);

  drawBoldMixed(doc, notice.signatureName || "যোগাযোগঃ", sigX, sigY, fonts, {
    width: sigW,
    align: "right",
    color: "#111111",
    strokeW: 0.3,
    fontSize: 12,
  });
  sigY += lineGap;

  drawMixedInline(
    doc,
    notice.academyName || "রয়েল একাডেমি",
    sigX,
    sigY,
    fonts,
    11,
    { color: "#333333", align: "right", width: sigW },
  );
  sigY += lineGap;

  drawMixedInline(
    doc,
    notice.subTitle || "বেলকুচি, সিরাজগঞ্জ",
    sigX,
    sigY,
    fonts,
    11,
    { color: "#555555", align: "right", width: sigW },
  );
  sigY += lineGap;

  drawMixedInline(doc, "মোবাইলঃ", sigX, sigY, fonts, 11, {
    color: "#333333",
    align: "right",
    width: sigW,
  });
  sigY += lineGap;

  drawMixedInline(doc, notice.phone1 || "০১৬৫০-০৩৩১৮১", sigX, sigY, fonts, 11, {
    color: "#333333",
    align: "right",
    width: sigW,
  });
  sigY += lineGap;

  drawMixedInline(doc, notice.phone2 || "০১৮০৪-৫৫৮২২৬", sigX, sigY, fonts, 11, {
    color: "#333333",
    align: "right",
    width: sigW,
  });
};

// ── Footer ────────────────────────────────────────────────────────────────────
const drawFooter = (doc, notice, W, H, mm, fonts) => {
  doc
    .moveTo(mm(15), H - mm(14))
    .lineTo(W - mm(15), H - mm(14))
    .lineWidth(0.5)
    .strokeColor("#cccccc")
    .stroke();

  doc
    .font(fonts.english)
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
 *   phone1?: string,
 *   phone2?: string,
 *   academyName?: string,
 *   subTitle?: string,
 *   noticeHeading?: string,
 * }} notice
 * @returns {Promise<Buffer>}
 */
export const generateNoticePdf = (notice) => {
  return new Promise((resolve, reject) => {
    try {
      const fonts = resolveFonts();

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: notice.noticeSlug || "Notice",
          Author: notice.academyName || "রয়েল একাডেমি",
          Subject: notice.noticeHeading || "জরুরি বিজ্ঞপ্তি",
          Creator: "Royal Academy Notice System",
        },
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.registerFont("BanglaRegular", fonts.bangla);
      doc.registerFont("EnglishRegular", fonts.english);

      const W = doc.page.width;
      const H = doc.page.height;
      const mm = (n) => n * 2.8346;

      doc.rect(0, 0, W, H).fillColor("#FFFFFF").fill();
      drawBorders(doc, W, H, mm);
      drawHeader(doc, notice, W, mm, fonts);
      drawMetaRow(doc, notice, W, mm, fonts);
      drawBody(doc, notice, W, mm, fonts);
      drawSignature(doc, notice, W, H, mm, fonts);
      drawFooter(doc, notice, W, H, mm, fonts);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};
