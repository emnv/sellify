import type { NavGroup } from "@/components/ui";

// Sidebar navigation. Core pages are grouped and labelled as the stand-in
// for features the real Sellify already has (see docs/CORE-STANDIN.md).
export const backendNav: NavGroup[] = [
  {
    label: "Sellify Stores",
    items: [{ href: "/store", label: "Online store" }],
  },
  {
    label: "Sellify Core (stand-in)",
    note: "Stands in for existing Sellify features.",
    items: [
      { href: "/core/inventory", label: "Inventory" },
      { href: "/core/pos", label: "Point of sale" },
      { href: "/core/sales", label: "Sales" },
      { href: "/core/repairs", label: "Repair tickets" },
      { href: "/core/repair-prices", label: "Repair prices" },
      { href: "/core/buybacks", label: "Buybacks" },
      { href: "/core/buyback-prices", label: "Buyback prices" },
      { href: "/core/settings", label: "Settings" },
    ],
  },
];
