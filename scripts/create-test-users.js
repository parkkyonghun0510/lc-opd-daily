import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function hashPassword(password) {
  return await hash(password, 10);
}

async function createTestUsers() {
  try {
    // Create regular user
    const regularUser = await prisma.user.upsert({
      where: { username: "test_regular" },
      update: {},
      create: {
        username: "test_regular",
        password: await hashPassword("Test@123"),
        email: "test_regular@example.com",
        name: "Test Regular User",
        role: "user",
        isActive: true,
      },
    });
    //console.log("Created regular user:", regularUser.username);

    // Create readonly user
    const readonlyUser = await prisma.user.upsert({
      where: { username: "test_readonly" },
      update: {},
      create: {
        username: "test_readonly",
        password: await hashPassword("Test@123"),
        email: "test_readonly@example.com",
        name: "Test Readonly User",
        role: "readonly",
        isActive: true,
      },
    });
    //console.log("Created readonly user:", readonlyUser.username);

    //console.log("Test users created successfully");
  } catch (error) {
    console.error("Error creating test users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
