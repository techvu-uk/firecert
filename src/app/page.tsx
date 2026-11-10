import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";

export default async function Home() {
  const u = await currentUser();
  redirect(!u ? "/login" : u.role === "CUSTOMER" ? "/portal" : "/dashboard");
}
