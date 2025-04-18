import { PrismaClient, Role, Branch, User } from '@prisma/client'
import { UserRole as UserRoleEnum } from '@/lib/auth/roles'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

interface RoleRecord {
  [key: string]: Role
}

interface BranchRecord {
  [key: string]: Branch
}

interface UserRecord {
  [key: string]: User
}

async function main() {
  //console.log('Starting seed process...')

  // Create basic roles
  const roles = [
    {
      name: 'ADMIN',
      description: 'Administrator with full system access'
    },
    {
      name: 'BRANCH_MANAGER',
      description: 'Manager of a branch with access to branch data and sub-branches'
    },
    {
      name: 'SUPERVISOR',
      description: 'Supervisor with limited management capabilities'
    },
    {
      name: 'USER',
      description: 'Standard user with basic access'
    }
  ]

  //console.log('Creating roles...')

  // Insert roles if they don't exist
  const createdRoles: RoleRecord = {}
  for (const role of roles) {
    const existingRole = await prisma.role.findUnique({
      where: { name: role.name }
    })

    if (!existingRole) {
      const newRole = await prisma.role.create({
        data: role
      })
      createdRoles[role.name] = newRole
      //console.log(`Created role: ${role.name}`)
    } else {
      createdRoles[role.name] = existingRole
      //console.log(`Role ${role.name} already exists`)
    }
  }

  // Create branches
  //console.log('Creating branches...')

  const branches = [
    {
      code: '100-HQ',
      name: 'Headquarters',
      isActive: true,
      parentId: null
    },
    {
      code: '01-PRH',
      name: 'សាខា ព្រះវិហារ',
      isActive: true,
      parentId: null
    },
    {
      code: '02-RVN',
      name: 'សាខា រវៀង',
      isActive: true,
      parentId: null
    },
    {
      code: '03-CHK',
      name: 'សាខា ជាំក្សាន្ត',
      isActive: true,
      parentId: null
    },
    {
      code: '04-KTH',
      name: 'សាខា កំពង់ធំ',
      isActive: true,
      parentId: null
    }
  ]

  const createdBranches: BranchRecord = {}

  for (const branch of branches) {
    const existingBranch = await prisma.branch.findUnique({
      where: { code: branch.code }
    })

    if (!existingBranch) {
      const newBranch = await prisma.branch.create({
        data: branch
      })
      createdBranches[branch.code] = newBranch
      //console.log(`Created branch: ${branch.name} (${branch.code})`)
    } else {
      createdBranches[branch.code] = existingBranch
      //console.log(`Branch ${branch.name} (${branch.code}) already exists`)
    }
  }

  // Create sub-branches
  const subBranches = [
    {
      code: 'NORTH-1',
      name: 'North Office 1',
      isActive: true,
      parentId: createdBranches['NORTH']?.id
    },
    {
      code: 'NORTH-2',
      name: 'North Office 2',
      isActive: true,
      parentId: createdBranches['NORTH']?.id
    },
    {
      code: 'SOUTH-1',
      name: 'South Office 1',
      isActive: true,
      parentId: createdBranches['SOUTH']?.id
    },
    {
      code: 'EAST-1',
      name: 'East Office 1',
      isActive: true,
      parentId: createdBranches['EAST']?.id
    },
    {
      code: 'WEST-1',
      name: 'West Office 1',
      isActive: true,
      parentId: createdBranches['WEST']?.id
    }
  ]

  for (const branch of subBranches) {
    if (!branch.parentId) {
      //console.log(`Skipping ${branch.code} - parent branch not found`)
      continue
    }

    const existingBranch = await prisma.branch.findUnique({
      where: { code: branch.code }
    })

    if (!existingBranch) {
      const newBranch = await prisma.branch.create({
        data: branch
      })
      createdBranches[branch.code] = newBranch
      //console.log(`Created sub-branch: ${branch.name} (${branch.code})`)
    } else {
      createdBranches[branch.code] = existingBranch
      //console.log(`Sub-branch ${branch.name} (${branch.code}) already exists`)
    }
  }

  // Create demo users
  //console.log('Creating users...')

  const demoPassword = await bcrypt.hash('password123', 10)

  const users = [
    {
      name: 'Admin User',
      email: 'admin@example.com',
      username: 'admin',
      password: demoPassword,
      role: 'ADMIN', // Legacy role field
      isActive: true
    },
    {
      name: 'Branch Manager North',
      email: 'north@example.com',
      username: 'north_manager',
      password: demoPassword,
      role: 'BRANCH_MANAGER', // Legacy role field
      branchId: createdBranches['NORTH']?.id,
      isActive: true
    },
    {
      name: 'Branch Manager South',
      email: 'south@example.com',
      username: 'south_manager',
      password: demoPassword,
      role: 'BRANCH_MANAGER', // Legacy role field
      branchId: createdBranches['SOUTH']?.id,
      isActive: true
    },
    {
      name: 'Supervisor East',
      email: 'east@example.com',
      username: 'east_supervisor',
      password: demoPassword,
      role: 'SUPERVISOR', // Legacy role field
      branchId: createdBranches['EAST']?.id,
      isActive: true
    },
    {
      name: 'Standard User',
      email: 'user@example.com',
      username: 'user',
      password: demoPassword,
      role: 'USER', // Legacy role field
      branchId: createdBranches['HQ']?.id,
      isActive: true
    }
  ]

  const createdUsers: UserRecord = {}

  for (const user of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: user
      })
      createdUsers[user.email] = newUser
      //console.log(`Created user: ${user.name} (${user.email})`)
    } else {
      createdUsers[user.email] = existingUser
      //console.log(`User ${user.name} (${user.email}) already exists`)
    }
  }

  // Assign roles to users
  //console.log('Assigning roles to users...')

  const userRoleAssignments = [
    {
      userEmail: 'admin@example.com',
      roleName: 'ADMIN',
      branchId: null,
      isDefault: true
    },
    {
      userEmail: 'north@example.com',
      roleName: 'BRANCH_MANAGER',
      branchId: createdBranches['NORTH']?.id,
      isDefault: true
    },
    {
      userEmail: 'south@example.com',
      roleName: 'BRANCH_MANAGER',
      branchId: createdBranches['SOUTH']?.id,
      isDefault: true
    },
    {
      userEmail: 'east@example.com',
      roleName: 'SUPERVISOR',
      branchId: createdBranches['EAST']?.id,
      isDefault: true
    },
    {
      userEmail: 'user@example.com',
      roleName: 'USER',
      branchId: createdBranches['HQ']?.id,
      isDefault: true
    }
  ]

  for (const assignment of userRoleAssignments) {
    const user = createdUsers[assignment.userEmail]
    const role = createdRoles[assignment.roleName]

    if (!user || !role) {
      //console.log(`Skipping role assignment - user or role not found for ${assignment.userEmail}`)
      continue
    }

    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        branchId: assignment.branchId
      }
    })

    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          branchId: assignment.branchId,
          isDefault: assignment.isDefault
        }
      })
      //console.log(`Assigned ${assignment.roleName} role to ${assignment.userEmail}${assignment.branchId ? ' for specific branch' : ''}`)
    } else {
      //console.log(`Role ${assignment.roleName} already assigned to ${assignment.userEmail}`)
    }
  }

  // Create branch assignments for users
  //console.log('Creating branch assignments...')

  const branchAssignments = [
    {
      userEmail: 'admin@example.com',
      branchCode: 'HQ',
      isDefault: true
    },
    {
      userEmail: 'north@example.com',
      branchCode: 'NORTH',
      isDefault: true
    },
    {
      userEmail: 'north@example.com',
      branchCode: 'NORTH-1',
      isDefault: false
    },
    {
      userEmail: 'north@example.com',
      branchCode: 'NORTH-2',
      isDefault: false
    },
    {
      userEmail: 'south@example.com',
      branchCode: 'SOUTH',
      isDefault: true
    },
    {
      userEmail: 'south@example.com',
      branchCode: 'SOUTH-1',
      isDefault: false
    },
    {
      userEmail: 'east@example.com',
      branchCode: 'EAST',
      isDefault: true
    },
    {
      userEmail: 'east@example.com',
      branchCode: 'EAST-1',
      isDefault: false
    },
    {
      userEmail: 'user@example.com',
      branchCode: 'HQ',
      isDefault: true
    }
  ]

  for (const assignment of branchAssignments) {
    const user = createdUsers[assignment.userEmail]
    const branch = createdBranches[assignment.branchCode]

    if (!user || !branch) {
      //console.log(`Skipping branch assignment - user or branch not found for ${assignment.userEmail} to ${assignment.branchCode}`)
      continue
    }

    const existingAssignment = await prisma.userBranchAssignment.findFirst({
      where: {
        userId: user.id,
        branchId: branch.id
      }
    })

    if (!existingAssignment) {
      await prisma.userBranchAssignment.create({
        data: {
          userId: user.id,
          branchId: branch.id,
          isDefault: assignment.isDefault
        }
      })
      //console.log(`Assigned branch ${assignment.branchCode} to ${assignment.userEmail}`)
    } else {
      //console.log(`Branch ${assignment.branchCode} already assigned to ${assignment.userEmail}`)
    }
  }

  // Create organization settings
  //console.log('Creating organization settings...')

  const existingSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId: 'default' }
  })

  if (!existingSettings) {
    await prisma.organizationSettings.create({
      data: {
        organizationId: 'default',
        validationRules: {
          writeOffs: {
            maxAmount: 1000,
            requireApproval: true
          },
          ninetyPlus: {
            maxAmount: 5000,
            requireApproval: true
          },
          comments: {
            required: true,
            minLength: 10
          },
          duplicateCheck: {
            enabled: true
          }
        }
      }
    })
    //console.log('Created default organization settings')
  } else {
    //console.log('Organization settings already exist')
  }

  //console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 