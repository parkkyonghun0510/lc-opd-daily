import { prisma } from "@/lib/prisma";

/**
 * Sets a specific branch assignment as the default for a user
 * and ensures all other assignments are not default
 */
export async function setDefaultBranchAssignment(
  userId: string,
  assignmentId: string,
): Promise<void> {
  // Use a transaction to ensure atomicity
  await prisma.$transaction([
    // First, unset all default assignments for this user
    prisma.userBranchAssignment.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    }),

    // Then, set the specified assignment as default
    prisma.userBranchAssignment.update({
      where: {
        id: assignmentId,
      },
      data: {
        isDefault: true,
      },
    }),
  ]);
}

/**
 * Creates a new branch assignment and optionally sets it as default
 */
export async function createBranchAssignment(
  userId: string,
  branchId: string,
  makeDefault: boolean = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // First create the assignment
  const assignment = await prisma.userBranchAssignment.create({
    data: {
      userId,
      branchId,
      isDefault: false, // Initially set to false
    },
  });

  // If this should be the default, update all assignments
  if (makeDefault) {
    await setDefaultBranchAssignment(userId, assignment.id);

    // Return the updated assignment
    return prisma.userBranchAssignment.findUnique({
      where: { id: assignment.id },
    });
  }

  return assignment;
}

/**
 * Similar utility for user roles if needed
 */
export async function setDefaultUserRole(
  userId: string,
  userRoleId: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.userRole.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    }),

    prisma.userRole.update({
      where: {
        id: userRoleId,
      },
      data: {
        isDefault: true,
      },
    }),
  ]);
}
