import { Button, PageHeader, TabNav } from "@/components/ui";
import { PublishButton } from "./publish-button";

export const STORE_TABS = [
  { href: "/store", label: "General" },
  { href: "/store/design", label: "Design" },
  { href: "/store/content", label: "Content" },
  { href: "/store/pages", label: "Pages" },
  { href: "/store/domain", label: "Domain" },
];

/** Header for every Online Store settings page. Edits save to the draft; Publish makes them live. */
export function StoreHeader({ hasStore = true }: { hasStore?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Online store"
        description="Your own website with Shop, Repair and Sell tabs, live from your Sellify data. Changes are saved as a draft until you publish."
        actions={
          hasStore ? (
            <>
              <Button href="/store/preview" variant="secondary" target="_blank" rel="noopener">
                Preview
              </Button>
              <PublishButton />
            </>
          ) : null
        }
      />
      {hasStore ? <TabNav tabs={STORE_TABS} /> : null}
    </div>
  );
}
