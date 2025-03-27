import CredentialsProvider from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma-server";
import { compare } from "bcrypt";
export const authOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing email or password");
                }
                const prisma = await getPrisma();
                // Use prisma to perform the database query
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        password: true,
                        role: true,
                        image: true,
                        isActive: true,
                        username: true,
                        branchId: true,
                    },
                });
                if (!user) {
                    throw new Error("Invalid credentials");
                }
                if (!user.isActive) {
                    throw new Error("Account is inactive. Please contact an administrator.");
                }
                // Check if user needs branch assignment
                if (!user.branchId && user.role !== "ADMIN") {
                    throw new Error("No branch assigned. Please contact your administrator to assign a branch.");
                }
                const isPasswordValid = await compare(credentials.password, user.password);
                if (!isPasswordValid) {
                    throw new Error("Invalid credentials");
                }
                // Update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date() },
                });
                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    image: user.image,
                    username: user.username,
                    branchId: user.branchId,
                };
            },
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
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
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.branchId = token.branchId;
            }
            return session;
        },
    },
};
