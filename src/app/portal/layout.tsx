import { Shell } from "@/components/shell";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/server/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CUSTOMER"]);
  return (
    <Shell nav={[{ href: "/portal", label: "My sites", icon: "building" }]} user={{ name: user.name, role: "customer" }} logout={logoutAction} areaLabel="Customer portal">
      {children}
    </Shell>
  );
}
