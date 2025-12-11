import { defineConfig } from "@prisma/client";

export default defineConfig({
  // ❌ DO NOT set engineType: "client"
  // ❌ DO NOT set adapter
  // ❌ DO NOT set accelerateUrl

  datasource: {
    url: process.env.DATABASE_URL,
  },

  // normal engine mode (default)
});
