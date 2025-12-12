import express from "express";
import cors from "cors";
import path from "path";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve dashboard static files
app.use("/dashboard", express.static("src/dashboard"));

// ✅ Dashboard route (HTML entry)
app.get("/dashboard", (req, res) => {
  res.sendFile(path.resolve("src/dashboard/dashboard.html"));
});

// Optional root redirect
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
