import { redirect } from "next/navigation";

// No dashboard: the backend opens on the Online Store.
export default function BackendHome() {
  redirect("/store");
}
