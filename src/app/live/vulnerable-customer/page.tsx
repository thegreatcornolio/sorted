import type { Metadata } from "next";
import { VulnerableCustomerDesk } from "@/components/VulnerableCustomerDesk";

export const metadata: Metadata = {
  title: "SORTED.AI · Vulnerable Customer",
  description:
    "Agent desk for a follow-up after Sorted flags someone. Call and email are dummy actions kept in this browser.",
};

export default function VulnerableCustomerPage() {
  return <VulnerableCustomerDesk />;
}
