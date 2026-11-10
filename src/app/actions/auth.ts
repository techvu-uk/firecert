"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { fail, success, type ActionState } from "@/lib/action-state";
import { homeFor } from "@/lib/session";
import {
  clearLoginFailures,
  consumeTokenAndSetPassword,
  createAuthToken,
  endSession,
  findUserByEmail,
  loginThrottled,
  passwordProblem,
  recordLoginFailure,
  startSession,
  verifyLogin,
  AuthError,
} from "@/server/auth";
import { notify } from "@/server/notify";
import { resetMessage } from "@/server/notify/templates";
import { getCompany } from "@/server/services/company";
import { audit } from "@/server/audit";
import { db } from "@/db";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!email || !password) return fail("Enter your email and password");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${email}|${ip}`;
  if (loginThrottled(key)) return fail("Too many attempts. Please wait 15 minutes and try again.");

  const user = await verifyLogin(email, password);
  if (!user) {
    recordLoginFailure(key);
    return fail("Email or password is incorrect");
  }
  clearLoginFailures(key);
  await startSession(user);
  await audit(db, user.id, "auth.login", "user", user.id);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  const home = homeFor(user.role);
  const allowed = safeNext && (user.role === "CUSTOMER" ? safeNext.startsWith("/portal") : !safeNext.startsWith("/portal"));
  redirect(allowed ? safeNext : home);
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

export async function forgotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim();
  const done = success("If an account exists for that email, we've sent a link to reset your password.");
  if (!email) return fail("Enter your email address");
  const user = await findUserByEmail(email);
  if (!user || !user.active) return done; // don't reveal whether the account exists
  const token = await createAuthToken(user.id, "RESET");
  const company = await getCompany();
  const msg = resetMessage({ company: company.name, name: user.name, url: `${env.appUrl}/set-password/${token}` });
  await notify({ kind: "PASSWORD_RESET", channel: "email", message: { to: user.email, ...msg } });
  return done;
}

export async function setPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const problem = passwordProblem(password);
  if (problem) return fail(problem, { password: problem });
  if (password !== confirm) return fail("Passwords don't match", { confirm: "Passwords don't match" });
  let user;
  try {
    user = await consumeTokenAndSetPassword(token, password);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    throw e;
  }
  if (!user.active) return fail("This account has been deactivated.");
  await startSession(user);
  await audit(db, user.id, "auth.password_set", "user", user.id);
  redirect(homeFor(user.role));
}
