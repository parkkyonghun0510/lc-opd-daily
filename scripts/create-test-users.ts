import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

async function createTestUsers() {
  try {
    const hashedPassword = await hashPassword("Test@123");

    // Create test users for each role
    const users = await Promise.all([
      prisma.user.create({
        data: {
          username: "test_regular",
          email: "test_regular@example.com",
          name: "Test Regular User",
          password: hashedPassword,
          role: "user",
          isActive: true,
        },
      }),
      prisma.user.create({
        data: {
          username: "test_readonly",
          email: "test_readonly@example.com",
          name: "Test Read Only User",
          password: hashedPassword,
          role: "readonly",
          isActive: true,
        },
      }),
    ]);

    console.log(
    "Test users created successfully:",
      users.map((u) => ({ username: u.username, role: u.role }))
    );
  } catch (error) {
    console.error("Error creating test users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
