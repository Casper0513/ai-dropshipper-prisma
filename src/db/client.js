import { PrismaClient } from "@prisma/client";
import { PrismaPostgres } from "@prisma/adapter-postgresql";

const connectionString = process.env.DATABASE_URL;

const adapter = new PrismaPostgres(connectionString);

let prisma;

if (!globalThis.__prisma) {
  prisma = new PrismaClient({
    adapter,                     // REQUIRED for Prisma 7
    errorFormat: "pretty",       // optional
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
  }
} else {
  prisma = globalThis.__prisma;
}

export { prisma };


