// royal-server/src/controllers/session.controller.js
import { UAParser } from "ua-parser-js";
import Session from "../models/session.model.js";

// ── IP extract ────────────────────────────────────────────────────────────────
const getIP = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.headers["x-real-ip"] ||
  req.socket?.remoteAddress ||
  null;

// ── UA Parse ──────────────────────────────────────────────────────────────────
const parseUA = (uaString) => {
  if (!uaString) return { browser: {}, os: {}, device: {} };
  const parser = new UAParser(uaString);
  const r = parser.getResult();
  return {
    browser: {
      name: r.browser.name ?? null,
      version: r.browser.version ?? null,
    },
    os: {
      name: r.os.name ?? null,
      version: r.os.version ?? null,
    },
    device: {
      vendor: r.device.vendor ?? null,
      model: r.device.model ?? null,
      type: r.device.type ?? "desktop",
    },
  };
};

// ── Safe extract — কোনো field না থাকলে null ──────────────────────────────────
const safeObj = (obj, defaults) => {
  if (!obj || typeof obj !== "object") return defaults;
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = obj[key] ?? defaults[key];
  }
  return result;
};

// ── createSession — login/signup controller থেকে call হবে ────────────────────
export const createSession = async (user, req, clientData = {}) => {
  try {
    const ua = parseUA(req.headers["user-agent"]);
    const {
      hardware = {},
      network = {},
      battery = {},
      viewport = {},
      orientation = {},
    } = clientData;

    await Session.create({
      userId: user._id ?? user.id,
      slug: user.slug ?? null,
      role: user.role,
      name: user.name,
      ip: getIP(req),
      ...ua,
      hardware: safeObj(hardware, {
        screenWidth: null,
        screenHeight: null,
        colorDepth: null,
        pixelRatio: null,
        ram: null,
        cpuCores: null,
        isTouchScreen: false,
        maxTouchPoints: 0,
        language: null,
        languages: [],
        timezone: null,
        timezoneOffset: null,
        platform: null,
        cookiesEnabled: null,
        doNotTrack: null,
        pdfViewerEnabled: null,
        webglVendor: null,
        webglRenderer: null,
        screenResolution: null,
        availableResolution: null,
        colorGamut: null,
        hdr: null,
        prefersDark: null,
        prefersReducedMotion: null,
        touchSupport: null,
        pointerType: null,
        fonts: [],
        plugins: [],
      }),
      network: safeObj(network, {
        type: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: null,
      }),
      battery: safeObj(battery, {
        level: null,
        charging: null,
      }),
      viewport: safeObj(viewport, {
        width: null,
        height: null,
        outerWidth: null,
        outerHeight: null,
      }),
      orientation: safeObj(orientation, {
        angle: null,
        type: null,
      }),
      loginAt: new Date(),
      lastActiveAt: new Date(),
    });
  } catch (e) {
    console.error("[session:create]", e.message);
  }
};

// ── closeSession — logout/login controller থেকে call হবে ─────────────────────
export const closeSession = async (userId) => {
  try {
    const session = await Session.findOne(
      { userId, logoutAt: null },
      {},
      { sort: { loginAt: -1 } },
    );
    if (!session) return;

    const now = new Date();
    const totalSeconds = Math.round((now - new Date(session.loginAt)) / 1000);

    await Session.findByIdAndUpdate(session._id, {
      logoutAt: now,
      totalSeconds,
    });
  } catch (e) {
    console.error("[session:close]", e.message);
  }
};

// ── POST /api/sessions/heartbeat ──────────────────────────────────────────────
export const heartbeat = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "লগইন করুন" });

    const { activeSeconds = 0 } = req.body;

    await Session.findOneAndUpdate(
      { userId, logoutAt: null },
      {
        lastActiveAt: new Date(),
        $inc: { activeSeconds: Number(activeSeconds) },
      },
      { sort: { loginAt: -1 } },
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// ── GET /api/sessions ─────────────────────────────────────────────────────────
export const getSessions = async (req, res) => {
  try {
    const { userId, role, slug, onlineOnly, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (role) filter.role = role;
    if (slug) filter.slug = slug;
    if (onlineOnly === "true") {
      filter.logoutAt = null;
      filter.lastActiveAt = {
        $gte: new Date(Date.now() - 2 * 60 * 1000),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ loginAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Session.countDocuments(filter),
    ]);

    const now = Date.now();
    const enriched = sessions.map((s) => {
      const isOnline =
        !s.logoutAt && now - new Date(s.lastActiveAt).getTime() < 2 * 60 * 1000;
      const endTime = s.logoutAt ? new Date(s.logoutAt) : new Date();
      const durationMinutes = Math.round(
        (endTime - new Date(s.loginAt)) / 60_000,
      );
      const activeMinutes = Math.round((s.activeSeconds ?? 0) / 60);

      return {
        ...s,
        isOnline,
        durationMinutes,
        activeMinutes,
      };
    });

    return res.status(200).json({
      sessions: enriched,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// ── GET /api/sessions/summary ─────────────────────────────────────────────────
export const getSessionSummary = async (req, res) => {
  try {
    const summary = await Session.aggregate([
      {
        $group: {
          _id: "$userId",
          name: { $last: "$name" },
          role: { $last: "$role" },
          slug: { $last: "$slug" },
          totalLogins: { $sum: 1 },
          totalActiveSeconds: { $sum: "$activeSeconds" },
          lastLoginAt: { $max: "$loginAt" },
          lastActiveAt: { $max: "$lastActiveAt" },
          lastDevice: { $last: "$device" },
          lastOS: { $last: "$os" },
          lastBrowser: { $last: "$browser" },
          lastIP: { $last: "$ip" },
          lastHardware: { $last: "$hardware" },
          lastNetwork: { $last: "$network" },
          lastBattery: { $last: "$battery" },
          lastViewport: { $last: "$viewport" },
          lastOrientation: { $last: "$orientation" },
          currentlyOnline: {
            $last: {
              $cond: [{ $eq: ["$logoutAt", null] }, true, false],
            },
          },
        },
      },
      {
        $addFields: {
          totalActiveMinutes: {
            $round: [{ $divide: ["$totalActiveSeconds", 60] }, 0],
          },
        },
      },
      { $sort: { lastActiveAt: -1 } },
    ]);

    const now = Date.now();
    const result = summary.map((s) => ({
      ...s,
      isOnline:
        s.currentlyOnline &&
        now - new Date(s.lastActiveAt).getTime() < 2 * 60 * 1000,
    }));

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
