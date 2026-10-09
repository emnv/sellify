import { deleteE2eUser } from "./support";

export default async function globalTeardown() {
  await deleteE2eUser();
}
