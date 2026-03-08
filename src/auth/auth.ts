import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const auth = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        return { id: credentials.email as string, email: credentials.email as string, role: "admin" };
      }
    })
  ],
  session: { strategy: "jwt" }
});

export const { handlers, auth: authSession, signIn, signOut } = auth;
