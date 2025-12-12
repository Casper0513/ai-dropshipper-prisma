import express from "express";
import cors from "cors";
import path from "path";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // ← serves public files

// Fix for /dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile("dashboard.html", { root: "public" });
});

// Example root route
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
