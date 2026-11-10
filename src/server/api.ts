import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { CertificateError } from "./services/certificates";

/** Wraps an API handler with consistent error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 403 });
      if (e instanceof CertificateError) return NextResponse.json({ error: e.message, errors: e.errors }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}
