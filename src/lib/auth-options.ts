import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { ROLE_PERMISSIONS } from "@/server/authorization/permissions";
import { MAX_FAILED_LOGINS, LOCKOUT_DURATION_MINUTES } from "./constants";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            role: true,
            userPermissions: { include: { permission: true } },
          },
        });

        if (!user || !user.isActive || user.deletedAt) return null;

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordValid) {
          const newCount = user.failedLoginCount + 1;
          const lockedUntil =
            newCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
              : null;

          await db.user.update({
            where: { id: user.id },
            data: { failedLoginCount: newCount, ...(lockedUntil ? { lockedUntil } : {}) },
          });

          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "USER_LOGIN_FAILED",
              entityType: "User",
              entityId: user.id,
            },
          });

          return null;
        }

        // Successful login — reset lockout state
        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
          },
        });

        // Build effective permission list: role defaults + user-specific overrides
        const rolePerms = ROLE_PERMISSIONS[user.role.name] ?? [];
        const userPerms = user.userPermissions.map((up: { permission: { code: string } }) => up.permission.code);
        const permissions = Array.from(new Set([...rolePerms, ...userPerms]));

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role.name,
          permissions,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "";
        token.permissions = (user as { permissions?: string[] }).permissions ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
