// scripts/setup-test-data.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up test data...");

  // Find or create a test branch
  let branch;
  const existingBranch = await prisma.branch.findFirst({
    where: { code: "TEST" },
  });

  if (existingBranch) {
    branch = existingBranch;
    console.log(`Using existing branch with ID: ${branch.id}`);
  } else {
    branch = await prisma.branch.create({
      data: {
        code: "TEST",
        name: "Test Branch",
        isActive: true,
      },
    });
    console.log(`Created test branch with ID: ${branch.id}`);
  }

  // Find or create a test admin user
  let user;
  const existingUser = await prisma.user.findFirst({
    where: { email: "admin@example.com" },
  });

  if (existingUser) {
    user = existingUser;
    console.log(`Using existing user with ID: ${user.id}`);
  } else {
    const hashedPassword = await bcrypt.hash("password123", 10);
    user = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin User",
        username: "admin",
        password: hashedPassword,
        role: "ADMIN",
        branchId: branch.id,
        isActive: true,
      },
    });
    console.log(`Created test user with ID: ${user.id}`);
  }

  // Find or create a test role
  let role;
  const existingRole = await prisma.role.findFirst({
    where: { name: "ADMIN" },
  });

  if (existingRole) {
    role = existingRole;
    console.log(`Using existing role with ID: ${role.id}`);
  } else {
    role = await prisma.role.create({
      data: {
        name: "ADMIN",
        description: "Administrator role",
      },
    });
    console.log(`Created test role with ID: ${role.id}`);
  }

  // Check if the user already has this role
  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      roleId: role.id,
    },
  });

  if (existingUserRole) {
    console.log(`User already has role: ${existingUserRole.id}`);
  } else {
    // Assign the role to the user
    const userRole = await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        branchId: branch.id,
        isDefault: true,
      },
    });
    console.log(`Assigned role to user: ${userRole.id}`);
  }

  console.log("Test data setup complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
