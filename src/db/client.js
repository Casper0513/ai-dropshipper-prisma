// src/db/client.js
import { PrismaClient } from "@prisma/client";

let prisma;

if (!globalThis.__prisma) {
  // Prisma 7 requires NO constructor args unless using adapter or accelerateUrl
  prisma = new PrismaClient({
    errorFormat: "pretty"
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
  }
} else {
  prisma = globalThis.__prisma;
}

export { prisma };


