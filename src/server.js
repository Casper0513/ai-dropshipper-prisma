import express from "express";
import cors from "cors";
import path from "path";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🚨 ABSOLUTE STATIC PATH (Docker-safe)
app.use(express.static("public"));

// ✅ Dashboard route (no __dirname, no ESM weirdness)
app.get("/dashboard", (req, res) => {
  res.sendFile(path.resolve("public/dashboard.html"));
});

// Root (optional)
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
