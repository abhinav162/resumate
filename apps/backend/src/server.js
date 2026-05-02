import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import dotenv from "dotenv";
import database from "./config/database.js";
import { initializeDatabase } from "./config/initDb.js";

// Import routes
import resumesRouter from "./routes/resumes.js";
import tailoredResumesRouter from "./routes/tailored-resumes.js";
import aiRouter from "./routes/ai.js";
import uploadsRouter from "./routes/uploads.js";
import creditsRouter, { razorpayWebhookHandler } from "./routes/credits.js";
import testRouter from "./routes/test.js";
import { ensureUserExists } from "./middleware/ensureUser.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4300;

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting — higher limit in development so E2E tests don't get throttled
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 10000,
});
app.use(limiter);

// Logging
app.use(morgan("combined"));

// Razorpay webhook MUST be mounted before express.json() so req.body stays a raw Buffer
// for HMAC signature verification. Do not move this below the JSON parser.
app.post(
  "/api/credits/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhookHandler
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auto-create users from Clerk authentication
app.use("/api", ensureUserExists);

// API routes
app.use("/api/resumes", resumesRouter);
app.use("/api/tailored-resumes", tailoredResumesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/credits", creditsRouter);

// Dev/test-only routes — never mounted in production
if (process.env.NODE_ENV !== "production") {
  app.use("/api/test", testRouter);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log("Initializing database...");
    await initializeDatabase();
    console.log("Database initialized successfully");

    app.listen(PORT, () => {
      console.log(`Resumate backend server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await database.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await database.close();
  process.exit(0);
});

startServer();
