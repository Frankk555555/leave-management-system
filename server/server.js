const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { validateEnv } = require("./config/validateEnv");

// Validate critical environment variables before bootstrap
validateEnv();

const { sequelize, testConnection } = require("./config/database");

// Connect to MySQL database
testConnection();

const app = express();

// Use compression middleware to gzip responses
app.use(compression());

// Trust proxy for Render reverse proxy (required for express-rate-limit)
app.set("trust proxy", 1);

// Security Middleware - Helmet for security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow uploads to be accessed
  })
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 200 : 1000, // 200 requests per 15 minutes in prod, 1000 in dev
  message: { message: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/api/webhooks") || req.path.startsWith("/api/health"),
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 15 : 1000, // 15 attempts in prod, 1000 in dev
  message: { message: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limit to all requests
app.use(generalLimiter);

// CORS Configuration - Dynamic and environment-aware origin resolver
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In non-production, allow any localhost/127.0.0.1 port for dev convenience
      const isDevLocalhost = process.env.NODE_ENV !== "production" && (
        origin.startsWith("http://localhost:") || 
        origin.startsWith("http://127.0.0.1:")
      );
      const isVercel = origin.endsWith(".vercel.app");
      const isAllowed =
        allowedOrigins.indexOf(origin) !== -1 ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) ||
        (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) ||
        isVercel ||
        isDevLocalhost;

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Static folder for uploads with download headers
app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Expose-Headers", "Content-Disposition");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// Routes - Apply stricter rate limit to auth endpoints
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/leave-requests", require("./routes/leaveRequests"));
app.use("/api/leave-types", require("./routes/leaveTypes"));
app.use("/api/holidays", require("./routes/holidays"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/webhooks", require("./routes/webhooks"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/faculties", require("./routes/faculties"));
app.use("/api/forms", require("./routes/forms"));

const { initFiscalYearCron } = require("./jobs/fiscalYearJob");
const { initQueues, getQueueStats, closeQueues } = require("./queues");

// Health check with Queue metrics
app.get("/api/health", async (req, res) => {
  try {
    const queueStats = await getQueueStats();
    res.json({
      status: "OK",
      message: "University Leave Management API is running",
      queue: queueStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Health check error",
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeUniqueConstraintError"
  ) {
    const isEmail = err.errors?.some(
      (e) => e.path === "email" || e.validatorKey === "isEmail"
    );
    if (isEmail) {
      return res.status(400).json({
        message: "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง (เช่น user@bru.ac.th)",
      });
    }
    const messages =
      err.errors?.map((e) => e.message).join(", ") || "ข้อมูลไม่ถูกต้องตามรูปแบบ";
    return res.status(400).json({ message: messages });
  }

  console.error(err.stack);
  // Hide error details in production
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" });
  } else {
    res
      .status(500)
      .json({ message: "Something went wrong!", error: err.message });
  }
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize Background Queues (BullMQ / InMemory)
  await initQueues();
  // Initialize Scheduled Jobs (e.g. Fiscal Year Leave Balance rollover)
  initFiscalYearCron();
});

// Graceful shutdown handlers
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("[Server] HTTP server closed.");
    await closeQueues();
    process.exit(0);
  });

  // Force exit if drain takes too long
  setTimeout(() => {
    console.error("[Server] Forced shutdown due to timeout.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

