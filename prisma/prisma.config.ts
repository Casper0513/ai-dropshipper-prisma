import { defineConfig } from "@prisma/client";

export default defineConfig({
  // ❌ DO NOT set engineType: "client"
  // ❌ DO NOT set adapter
  // ❌ DO NOT set accelerateUrl
  // 🚫 DO NOT use __internal
  datasource: {
    url: process.env.DATABASE_URL,
  },

  // normal engine mode (default)
});
