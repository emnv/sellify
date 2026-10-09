import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Page, Skeleton } from "@/components/ui";
import { BUTTON_SIZES, HERO_STYLES, RADII, STORE_FONTS, TEMPLATES } from "@/lib/store/config";
import { getAiDesignStatus } from "@/stores/ai-design";
import { requireOwnerStore } from "@/stores/store";
import { StoreHeader } from "../store-header";
import { AiCustomizer } from "./ai-customizer";
import { DesignForm, TemplateForm } from "./design-forms";

export const metadata: Metadata = { title: "Design · Online store · Sellify" };

export default function StoreDesignPage() {
  return (
    <Page>
      <StoreHeader />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <Design />
      </Suspense>
    </Page>
  );
}

async function Design() {
  const store = await requireOwnerStore();
  const theme = store.draft.theme;
  const ai = await getAiDesignStatus();
  return (
    <>
      <AiCustomizer theme={theme} canUndo={ai.canUndo} remainingThisHour={ai.remainingThisHour} />
      <TemplateForm current={theme.template} templates={TEMPLATES.map((t) => ({ ...t }))} />
      <DesignForm
        theme={theme}
        options={{
          fonts: STORE_FONTS.map((f) => ({ ...f })),
          radii: [...RADII],
          buttonSizes: [...BUTTON_SIZES],
          heroStyles: [...HERO_STYLES],
        }}
      />
    </>
  );
}
