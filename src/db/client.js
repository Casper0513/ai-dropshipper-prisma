import { PrismaClient } from "@prisma/client";
import { PrismaPostgreSQL } from "@prisma/adapter-postgresql";

const adapter = new PrismaPostgreSQL(process.env.DATABASE_URL);

let prisma;

if (!globalThis.__prisma) {
  prisma = new PrismaClient({ adapter });
  globalThis.__prisma = prisma;
} else {
  prisma = globalThis.__prisma;
}

export { prisma };

