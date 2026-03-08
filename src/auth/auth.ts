import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";

const auth = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, passwordHash: true, role: true }
        });
        if (!user || user.passwordHash !== password) return null;
        return { id: user.id, email: user.email, role: user.role };
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId || "");
        session.user.role = token.role as Role | undefined;
      }
      return session;
    }
  }
});

export const { handlers, auth: authSession, signIn, signOut } = auth;
