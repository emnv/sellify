import { redirect } from "next/navigation";

// No dashboard: the backend opens on Inventory. (Phase 3: Online Store.)
export default function BackendHome() {
  redirect("/core/inventory");
}
