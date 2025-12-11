import { PrismaClient } from "@prisma/client";

let prisma;

if (!globalThis.__prisma) {
  prisma = new PrismaClient(); // NO options allowed in 5/6
  if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;
} else {
  prisma = globalThis.__prisma;
}

export { prisma };

