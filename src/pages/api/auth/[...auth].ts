// src/pages/api/auth/[...auth].ts

import { Auth } from "@auth/astro";
import CredentialsProvider from "@auth/core/providers/credentials";
import GoogleProvider from "@auth/core/providers/google";
import type { APIContext } from "astro";
import type { CloudflareEnv } from "@/env.d";
import { loginUser, registerUser } from "@/lib/auth/auth";
import type { UserRole } from "@/types/auth";
import type { JWT } from "@auth/core/jwt";
import type { Session } from "@auth/core/types";

// Main Auth handler
export const { GET, POST } = Auth(async (request: APIContext) => {
  // Attempt to access CloudflareEnv from locals or global fallback
  const env: CloudflareEnv | undefined =
    (request?.locals as any)?.runtime?.env ??
    (globalThis as any).astroCloudflareRuntime?.env;

  if (!env) {
    console.error("[...auth].ts: CloudflareEnv not available. Auth.js cannot initialize.");
    throw new Error("Cloudflare environment is missing.");
  }

  return {
    secret: env.AUTH_SECRET,
    trustHost: true,
    session: {
      strategy: "jwt" as const,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    providers: [
      CredentialsProvider({
        id: "credentials-login",
        name: "Login with Email",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials.password) return null;

          const result = await loginUser(env, {
            email: credentials.email as string,
            password: credentials.password as string,
          });

          if (result.success && result.user) {
            return {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              image: result.user.imageUrl,
              role: result.user.role,
              emailVerified: result.user.emailVerifiedAt
                ? new Date(result.user.emailVerifiedAt * 1000)
                : null,
            };
          }
          return null;
        },
      }),
      CredentialsProvider({
        id: "credentials-register",
        name: "Register with Email",
        credentials: {
          name: { label: "Full Name", type: "text" },
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.name || !credentials.email || !credentials.password) {
            throw new Error("Missing registration details.");
          }

          const result = await registerUser(env, {
            name: credentials.name as string,
            email: credentials.email as string,
            password: credentials.password as string,
          });

          if (result.success && result.user) {
            return {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              image: result.user.imageUrl,
              role: result.user.role,
              emailVerified: result.user.emailVerifiedAt
                ? new Date(result.user.emailVerifiedAt * 1000)
                : null,
            };
          }
          throw new Error(result.error || "Registration failed.");
        },
      }),
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      }),
    ],
    pages: {
      signIn: "/auth/login",
      signOut: "/auth/signout",
      error: "/auth/error",
    },
    callbacks: {
      async jwt({
        token,
        user,
      }: {
        token: JWT;
        user?: any;
      }) {
        if (user) {
          token.userId = user.id;
          token.role = (user as any).role as UserRole;
          token.emailVerified = (user as any).emailVerified ?? null;
        }
        return token;
      },
      async session({
        session,
        token,
      }: {
        session: Session;
        token: JWT;
      }) {
        if (token.userId && session.user) {
          session.user.id = token.userId as string;
          (session.user as any).role = token.role as UserRole;
          (session.user as any).emailVerified = token.emailVerified as Date | null;
        }
        return session;
      },
    },
    // Uncomment the following line in development if you want debug logs:
    // debug: import.meta.env.DEV,
  };
});
