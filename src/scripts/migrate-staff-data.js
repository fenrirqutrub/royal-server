// src/scripts/fix-staff-subjects.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("❌ MongoDB URI নেই");
  process.exit(1);
}

// ── ইংরেজি subject → বাংলায় ──
const SUBJECT_MAP = {
  "Electrical and Electronic Engineer": "তড়িৎ ও ইলেকট্রনিক প্রকৌশল",
  "Electrical and Electronic Engineering": "তড়িৎ ও ইলেকট্রনিক প্রকৌশল",
  EEE: "তড়িৎ ও ইলেকট্রনিক প্রকৌশল",
  PHARMACY: "ফার্মেসি",
  Pharmacy: "ফার্মেসি",
  "Bachelor of Business Administration": "ব্যবসায় প্রশাসন",
  BBA: "ব্যবসায় প্রশাসন",
  MBA: "ব্যবসায় প্রশাসন",
  English: "ইংরেজি",
  Bangla: "বাংলা",
  Mathematics: "গণিত",
  Math: "গণিত",
  Physics: "পদার্থবিজ্ঞান",
  Chemistry: "রসায়ন",
  Biology: "জীববিজ্ঞান",
  Science: "বিজ্ঞান",
  History: "ইতিহাস",
  Geography: "ভূগোল",
  Economics: "অর্থনীতি",
  Accounting: "হিসাববিজ্ঞান",
  ICT: "তথ্য ও যোগাযোগ প্রযুক্তি",
  "Computer Science": "কম্পিউটার বিজ্ঞান",
  CSE: "কম্পিউটার বিজ্ঞান ও প্রকৌশল",
  "Islamic Studies": "ইসলাম শিক্ষা",
  Arabic: "আরবি",
  "Political Science": "রাষ্ট্রবিজ্ঞান",
  Sociology: "সমাজবিজ্ঞান",
  Management: "ব্যবস্থাপনা",
  Finance: "ফিন্যান্স",
  Marketing: "মার্কেটিং",
  Agriculture: "কৃষি",
  Statistics: "পরিসংখ্যান",
  Philosophy: "দর্শন",
  Psychology: "মনোবিজ্ঞান",
  "Social Work": "সমাজকর্ম",
  Law: "আইন",
  Zoology: "প্রাণিবিদ্যা",
  Botany: "উদ্ভিদবিদ্যা",
};

async function fix() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected\n");

    const db = mongoose.connection.db;
    const users = db.collection("users");

    const staff = await users
      .find({ role: { $in: ["teacher", "principal", "admin"] } })
      .toArray();

    console.log(`📊 মোট staff: ${staff.length}\n`);

    let added = 0;
    let converted = 0;
    let alreadyOk = 0;

    for (const u of staff) {
      const hasSubject = u.subject && String(u.subject).trim();

      // ── subject field নেই → null দিয়ে add ──
      if (!hasSubject) {
        await users.updateOne({ _id: u._id }, { $set: { subject: null } });
        added++;
        console.log(`➕ ${u.name} (${u.role}) — subject field added (null)`);
        continue;
      }

      // ── subject ইংরেজি → বাংলায় convert ──
      if (/[a-zA-Z]/.test(u.subject)) {
        // exact match খুঁজো
        const bangla = SUBJECT_MAP[u.subject] || SUBJECT_MAP[u.subject.trim()];

        // case-insensitive match
        const banglaCaseInsensitive = !bangla
          ? Object.entries(SUBJECT_MAP).find(
              ([eng]) => eng.toLowerCase() === u.subject.toLowerCase(),
            )?.[1]
          : null;

        const finalBangla = bangla || banglaCaseInsensitive;

        if (finalBangla) {
          await users.updateOne(
            { _id: u._id },
            { $set: { subject: finalBangla } },
          );
          converted++;
          console.log(
            `✏️ ${u.name} (${u.role}) — "${u.subject}" → "${finalBangla}"`,
          );
        } else {
          console.log(
            `⚠️ ${u.name} (${u.role}) — ইংরেজি subject পাওয়া গেছে কিন্তু ম্যাপে নেই: "${u.subject}"`,
          );
          console.log(
            `   📝 SUBJECT_MAP এ এটা যোগ করো: "${u.subject}": "বাংলায় বিষয়"`,
          );
        }
        continue;
      }

      // ── subject বাংলায় আছে → OK ──
      alreadyOk++;
      console.log(`✅ ${u.name} (${u.role}) — বিষয়: ${u.subject}`);
    }

    // ── Summary ──
    console.log("\n" + "=".repeat(55));
    console.log(`📊 ফলাফল:`);
    console.log(`   ➕ subject field যোগ হয়েছে (null): ${added} জন`);
    console.log(`   ✏️ ইংরেজি → বাংলায় রূপান্তর: ${converted} জন`);
    console.log(`   ✅ আগে থেকেই ঠিক ছিল: ${alreadyOk} জন`);
    console.log("=".repeat(55));

    // ── Final verification ──
    console.log("\n━━━ Final Verification ━━━");

    const updatedStaff = await users
      .find({ role: { $in: ["teacher", "principal", "admin"] } })
      .project({ name: 1, role: 1, subject: 1, degree: 1, currentYear: 1 })
      .toArray();

    let issues = 0;
    for (const u of updatedStaff) {
      const sub = u.subject ? String(u.subject).trim() : null;
      if (sub && /[a-zA-Z]/.test(sub)) {
        issues++;
        console.log(`⚠️ ${u.name} — এখনও ইংরেজি: "${sub}"`);
      } else {
        console.log(
          `✅ ${u.name} (${u.role}) | বিষয়: ${sub || "—"} | ডিগ্রি: ${u.degree || "—"} | বর্ষ: ${u.currentYear || "—"}`,
        );
      }
    }

    console.log("\n" + "=".repeat(55));
    if (issues === 0) {
      console.log("🎉 সব staff এর subject ঠিক আছে!");
    } else {
      console.log(`⚠️ ${issues} জনের subject এখনও ইংরেজি`);
      console.log("📝 SUBJECT_MAP এ ওই বিষয়গুলো যোগ করে আবার চালাও");
    }
    console.log("=".repeat(55));

    await mongoose.disconnect();
    console.log("\n🔌 Disconnected");
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
}

fix();
