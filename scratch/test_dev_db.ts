import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env" });

const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
console.log("Testing dev DB URL:", devUrl ? devUrl.split("@")[1] : "not found");

if (devUrl) {
  const prisma = new PrismaClient({
    datasources: { db: { url: devUrl } },
  });
  prisma.$connect()
    .then(() => {
      console.log("Successfully connected to DEVELOPMENT_DATABASE_URL!");
      return prisma.user.count();
    })
    .then((count) => console.log("User count in dev DB:", count))
    .catch((err) => console.error("Dev DB connection error:", err.message))
    .finally(() => prisma.$disconnect());
}
