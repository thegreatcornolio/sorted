import type { Metadata } from "next";
import { VulnerableCustomers } from "@/components/VulnerableCustomers";

export const metadata: Metadata = {
  title: "SORTED.AI · Vulnerable Customers",
  description:
    "Medical inbound callers who cannot pay, are late, or whose circumstances have changed, with the reason and a suggested next step.",
};

export default function VulnerableCustomersPage() {
  return <VulnerableCustomers />;
}
