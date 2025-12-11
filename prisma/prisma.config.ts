import { defineConfig } from "@prisma/config";
import { env } from "process";

export default defineConfig({
  datasources: {
    db: {
      provider: "postgresql",
      url: env.DATABASE_URL,      // Prisma 7 requires URL here
    },
  },
});
