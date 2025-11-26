import { PrismaClient } from "@prisma/client";

let prisma;

if (!globalThis.__prisma) {
  prisma = new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
  }
} else {
  prisma = globalThis.__prisma;
}

export { prisma };
