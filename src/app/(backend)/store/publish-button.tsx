import { SubmitButton } from "@/components/ui";
import { publishAction, unpublishAction } from "./actions";

/** Copies the draft to the live store. */
export function PublishButton({ size = "md", label = "Publish" }: { size?: "sm" | "md"; label?: string }) {
  return (
    <form action={publishAction}>
      <SubmitButton size={size} pendingText="Publishing…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function UnpublishButton() {
  return (
    <form action={unpublishAction}>
      <SubmitButton variant="secondary" pendingText="Taking offline…">
        Take store offline
      </SubmitButton>
    </form>
  );
}
