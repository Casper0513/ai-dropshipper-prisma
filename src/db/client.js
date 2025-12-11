import { PrismaClient } from "@prisma/client";

let prisma;

const prismaOptions = {
  datasourceUrl: process.env.DATABASE_URL,
};

if (!globalThis.__prisma) {
  prisma = new PrismaClient(prismaOptions);

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
  }
} else {
  prisma = globalThis.__prisma;
}

export { prisma };

