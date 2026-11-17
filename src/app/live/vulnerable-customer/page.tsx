import type { Metadata } from "next";
import { VulnerableCustomerDesk } from "@/components/VulnerableCustomerDesk";

export const metadata: Metadata = {
  title: "SORTED.AI · Agent desktop",
  description:
    "Agent desktop for a follow-up after Sorted flags someone. Call, email, and outcomes stay in this browser.",
};

export default function VulnerableCustomerPage() {
  return <VulnerableCustomerDesk />;
}
