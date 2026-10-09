"use client";

import { useActionState } from "react";
import { Button, Card, FormActions, FormStack, Notice, Switch } from "@/components/ui";
import type { StoreContent } from "@/lib/store/config";
import { savePages, type EditorState } from "../actions";

export function PagesForm({ tabs }: { tabs: StoreContent["tabs"] }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(savePages, {});
  return (
    <Card title="Store tabs" description="Hide a tab when you pause that service. Hidden tabs disappear from the menu and their pages show “not found”.">
      <form action={action} key={state.nonce}>
        <FormStack>
          {state.saved ? <Notice tone="success">Saved to your draft. Publish to make it live.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Switch id="tabs.shop" name="tabs.shop" label="Shop" description="Products from your inventory, with basket and checkout." defaultChecked={tabs.shop} />
          <Switch id="tabs.repair" name="tabs.repair" label="Repair" description="Repair prices and online booking." defaultChecked={tabs.repair} />
          <Switch id="tabs.sell" name="tabs.sell" label="Sell" description="Instant buyback quotes for customers' old phones." defaultChecked={tabs.sell} />
          <FormActions>
            <Button type="submit" loading={pending}>
              Save tabs
            </Button>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
