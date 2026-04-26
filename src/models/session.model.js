// royal-server/src/models/session.model.js
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
      required: true,
    },
    slug: { type: String, default: null },
    role: { type: String, default: null },
    name: { type: String, default: null },

    // ── Network ──
    ip: { type: String, default: null },

    // ✅ IP-based Location
    location: {
      city: { type: String, default: null },
      region: { type: String, default: null },
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      timezone: { type: String, default: null },
      isp: { type: String, default: null },
      org: { type: String, default: null },
      as: { type: String, default: null },
    },

    // ── Browser & OS (UA Parser) ──
    browser: {
      name: { type: String, default: null },
      version: { type: String, default: null },
    },
    os: {
      name: { type: String, default: null },
      version: { type: String, default: null },
    },
    device: {
      vendor: { type: String, default: null },
      model: { type: String, default: null },
      type: { type: String, default: "desktop" },
    },

    // ── Hardware & Environment ──
    hardware: {
      screenWidth: { type: Number, default: null },
      screenHeight: { type: Number, default: null },
      colorDepth: { type: Number, default: null },
      pixelRatio: { type: Number, default: null },
      ram: { type: Number, default: null },
      cpuCores: { type: Number, default: null },
      isTouchScreen: { type: Boolean, default: false },
      maxTouchPoints: { type: Number, default: 0 },
      language: { type: String, default: null },
      languages: { type: [String], default: [] },
      timezone: { type: String, default: null },
      timezoneOffset: { type: Number, default: null },
      platform: { type: String, default: null },
      cookiesEnabled: { type: Boolean, default: null },
      doNotTrack: { type: String, default: null },
      pdfViewerEnabled: { type: Boolean, default: null },
      webglVendor: { type: String, default: null },
      webglRenderer: { type: String, default: null },
      screenResolution: { type: String, default: null },
      availableResolution: { type: String, default: null },
      colorGamut: { type: String, default: null },
      hdr: { type: Boolean, default: null },
      prefersDark: { type: Boolean, default: null },
      prefersReducedMotion: { type: Boolean, default: null },
      touchSupport: { type: Boolean, default: null },
      pointerType: { type: String, default: null },
      fonts: { type: [String], default: [] },
      plugins: { type: [String], default: [] },
      // ✅ New extra fields
      maxTextureSize: { type: Number, default: null },
      antialiasSupport: { type: Boolean, default: null },
      audioSampleRate: { type: Number, default: null },
      performanceMemory: { type: Number, default: null },
      canvasFingerprint: { type: String, default: null },
    },

    // ── Network Info ──
    network: {
      type: { type: String, default: null },
      effectiveType: { type: String, default: null },
      downlink: { type: Number, default: null },
      rtt: { type: Number, default: null },
      saveData: { type: Boolean, default: null },
    },

    // ── Battery ──
    battery: {
      level: { type: Number, default: null },
      charging: { type: Boolean, default: null },
    },

    // ── Window & Viewport ──
    viewport: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      outerWidth: { type: Number, default: null },
      outerHeight: { type: Number, default: null },
    },

    // ── Orientation ──
    orientation: {
      angle: { type: Number, default: null },
      type: { type: String, default: null },
    },

    // ── Time Tracking ──
    loginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    logoutAt: { type: Date, default: null },
    totalSeconds: { type: Number, default: 0 },
    activeSeconds: { type: Number, default: 0 },
  },
  { timestamps: false },
);

// ── Indexes ──
sessionSchema.index({ userId: 1, loginAt: -1 });
sessionSchema.index({ lastActiveAt: -1 });
sessionSchema.index({ role: 1 });
sessionSchema.index({ logoutAt: 1 });

// ── Virtuals ──
sessionSchema.virtual("isOnline").get(function () {
  if (this.logoutAt) return false;
  return Date.now() - new Date(this.lastActiveAt).getTime() < 2 * 60 * 1000;
});

sessionSchema.virtual("durationMinutes").get(function () {
  const end = this.logoutAt ? new Date(this.logoutAt) : new Date();
  return Math.round((end - new Date(this.loginAt)) / 60_000);
});

sessionSchema.virtual("activeMinutes").get(function () {
  return Math.round((this.activeSeconds ?? 0) / 60);
});

sessionSchema.set("toJSON", { virtuals: true });
sessionSchema.set("toObject", { virtuals: true });

export default mongoose.model("Session", sessionSchema);
