import { compare, hash } from "bcrypt";
import { isAccountLocked, recordFailedLoginAttempt, resetFailedLoginAttempts, getRemainingLockoutTime, } from "./utils/account-security";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrisma } from "./prisma-server";
export async function hashPassword(password) {
    return hash(password, 12);
}
export async function verifyPassword(password, hashedPassword) {
    return compare(password, hashedPassword);
}
export async function createUser(userData) {
    const { username, email, name, password, role = "user", branchId } = userData;
    const prisma = await getPrisma();
    const existingUserByEmail = await prisma.user.findUnique({
        where: { email },
    });
    if (existingUserByEmail) {
        throw new Error("Email already in use");
    }
    const existingUserByUsername = await prisma.user.findUnique({
        where: { username },
    });
    if (existingUserByUsername) {
        throw new Error("Username already in use");
    }
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            username,
            email,
            name,
            password: hashedPassword,
            role,
            branchId,
        },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
export async function authenticateUser(username, password) {
    const prisma = await getPrisma();
    const isLocked = await isAccountLocked(username);
    if (isLocked) {
        const remainingTime = await getRemainingLockoutTime(username);
        throw new Error(`Account is locked. Try again in ${remainingTime} minutes.`);
    }
    const user = await prisma.user.findUnique({
        where: { username },
    });
    if (!user) {
        await recordFailedLoginAttempt(username);
        return null;
    }
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
        const isNowLocked = await recordFailedLoginAttempt(username);
        if (isNowLocked) {
            const remainingTime = await getRemainingLockoutTime(username);
            throw new Error(`Account is now locked due to too many failed attempts. Try again in ${remainingTime} minutes.`);
        }
        return null;
    }
    await resetFailedLoginAttempts(user.id);
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
export async function getCurrentUser(userId) {
    if (!userId) {
        return null;
    }
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            branch: true,
        },
    });
    if (!user) {
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    throw new Error("Missing username or password");
                }
                const prisma = await getPrisma();
                const user = await prisma.user.findUnique({
                    where: { username: credentials.username },
                });
                if (!user) {
                    throw new Error("User not found");
                }
                if (!user.isActive) {
                    throw new Error("User account is inactive");
                }
                const isValid = await verifyPassword(credentials.password, user.password);
                if (!isValid) {
                    throw new Error("Invalid password");
                }
                return {
                    id: user.id,
                    name: user.name || user.username,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    branchId: user.branchId,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.branchId = user.branchId;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.branchId = token.branchId;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    debug: process.env.NODE_ENV === "development",
};
