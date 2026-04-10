// scripts/remove-name-prefixes.js
// Run: node scripts/remove-name-prefixes.js --dry-run
//      node scripts/remove-name-prefixes.js
//      node scripts/remove-name-prefixes.js --all         (সব data)

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGODB_URI;
const PREFIX_REGEX = /^(মোঃ|মোছাঃ)\s*/u;

const stripPrefix = (val) =>
  typeof val === "string" ? val.replace(PREFIX_REGEX, "").trim() : val;

const hasPrefix = (val) => typeof val === "string" && PREFIX_REGEX.test(val);

const run = async () => {
  const DRY_RUN = process.argv.includes("--dry-run");
  const ALL = process.argv.includes("--all");

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  console.log(DRY_RUN ? "🔍 DRY RUN MODE\n" : "⚡ LIVE MODE\n");
  console.log(
    ALL
      ? "📅 সব data (কোনো date filter নেই)\n"
      : `📅 শুধু last 3 days (${threeDaysAgo.toISOString()} থেকে)\n`,
  );

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected\n");

  const db = mongoose.connection.db;
  const collection = db.collection("users");

  const dateFilter = ALL ? {} : { createdAt: { $gte: threeDaysAgo } };

  const affected = await collection
    .find({
      ...dateFilter,
      $or: [
        { name: PREFIX_REGEX },
        { fatherName: PREFIX_REGEX },
        { motherName: PREFIX_REGEX },
      ],
    })
    .toArray();

  console.log(`📋 মোট ${affected.length} টি document এ prefix পাওয়া গেছে\n`);

  if (affected.length === 0) {
    console.log("✅ এই range এ কোনো prefix নেই — clean!");
    await mongoose.disconnect();
    return;
  }

  const operations = affected.map((user) => {
    const update = {};

    if (hasPrefix(user.name)) {
      update.name = stripPrefix(user.name);
      console.log(
        `  name      : "${user.name}" → "${update.name}"  [${user._id}]`,
      );
    }
    if (hasPrefix(user.fatherName)) {
      update.fatherName = stripPrefix(user.fatherName);
      console.log(
        `  fatherName: "${user.fatherName}" → "${update.fatherName}"  [${user._id}]`,
      );
    }
    if (hasPrefix(user.motherName)) {
      update.motherName = stripPrefix(user.motherName);
      console.log(
        `  motherName: "${user.motherName}" → "${update.motherName}"  [${user._id}]`,
      );
    }

    return {
      updateOne: {
        filter: { _id: user._id },
        update: { $set: update },
      },
    };
  });

  console.log(`\n📝 মোট ${operations.length} টি update তৈরি\n`);

  if (DRY_RUN) {
    console.log("🔍 Dry run শেষ — apply করতে চাইলে:");
    console.log(
      ALL
        ? "   node src/scripts/remove-name-prefixes.js --all\n"
        : "   node src/scripts/remove-name-prefixes.js\n",
    );
  } else {
    const result = await collection.bulkWrite(operations, { ordered: false });
    console.log(`✅ সফলভাবে ${result.modifiedCount} টি document update হয়েছে`);
  }

  await mongoose.disconnect();
  console.log("🔌 MongoDB disconnected");
};

run().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
