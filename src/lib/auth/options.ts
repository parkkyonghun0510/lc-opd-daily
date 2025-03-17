import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma-server";
import { compare } from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
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
          return null;
        }

        if (!user.isActive) {
          throw new Error(
            "Account is inactive. Please contact an administrator."
          );
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
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
    error: "/login?error=true",
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
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.branchId = token.branchId as string | null;
      }
      return session;
    },
  },
};

// Extend next-auth types
declare module "next-auth" {
  interface User {
    id: string;
    role: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      image?: string;
      branchId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
