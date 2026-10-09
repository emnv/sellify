import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  DetailList,
  Notice,
  Page,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  Td,
  TextLink,
  Th,
  THead,
  Tr,
  type Tone,
} from "@/components/ui";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import type { DomainStatus } from "@/lib/vercel/domains";
import { getStoreDomain, OWNER_ONLY_MESSAGE, type StoreDomain } from "@/stores/domains";
import { requireOwnerStore } from "@/stores/store";
import { StoreHeader } from "../store-header";
import { CheckStatusButton, ConnectDomainForm, RemoveDomain } from "./domain-form";

export const metadata: Metadata = { title: "Domain · Online store · Sellify" };

const STATUS: Record<DomainStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Pending DNS" },
  verified: { tone: "info", label: "Verified" },
  active: { tone: "success", label: "Active (HTTPS)" },
  error: { tone: "danger", label: "Error" },
};

export default function StoreDomainPage({ searchParams }: PageProps<"/store/domain">) {
  return (
    <Page>
      <StoreHeader />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <Domain searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Domain({ searchParams }: Pick<PageProps<"/store/domain">, "searchParams">) {
  const sp = await searchParams;
  const { shop, role } = await requireShop();
  const store = await requireOwnerStore();
  const domain = await getStoreDomain();
  const error = one(sp.domainError);
  const canManage = role === "owner";

  return (
    <>
      {canManage ? null : <Notice tone="info">{OWNER_ONLY_MESSAGE}</Notice>}
      {one(sp.connected) && domain ? <Notice tone="success" title="Domain added.">Now add the DNS records below at your domain provider.</Notice> : null}
      {one(sp.checked) && domain ? <Notice tone="info">Status checked. {domain.message}</Notice> : null}
      {one(sp.removed) ? <Notice tone="info">Domain removed. Your store is still at {store.liveUrl}.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {domain ? (
        <ConnectedDomain domain={domain} timeZone={shop.timezone} canManage={canManage} />
      ) : (
        <Card title="Connect your own domain" description="Use a web address you own, like fixitgalway.ie, instead of your Sellify address. You need to have bought the domain already.">
          {canManage ? (
            <ConnectDomainForm />
          ) : (
            <p className="text-body text-fg-muted">No domain is connected. Your store is at {store.liveUrl}.</p>
          )}
        </Card>
      )}
    </>
  );
}

function ConnectedDomain({ domain, timeZone, canManage }: { domain: StoreDomain; timeZone: string; canManage: boolean }) {
  const status = STATUS[domain.status];
  const www = domain.www;
  const wwwStatus = www ? STATUS[www.status] : null;
  const allLive = domain.status === "active" && (!www || www.status === "active");
  return (
    <>
      <Card
        title="Your domain"
        actions={
          canManage ? (
            <>
              <CheckStatusButton />
              <RemoveDomain domain={domain.domain} www={www?.domain ?? null} />
            </>
          ) : undefined
        }
      >
        <DetailList
          items={[
            {
              label: "Domain",
              value: domain.status === "active" ? <TextLink href={`https://${domain.domain}`}>{domain.domain}</TextLink> : domain.domain,
            },
            { label: "Status", value: <StatusBadge tone={status.tone}>{status.label}</StatusBadge> },
            ...(www && wwwStatus
              ? [
                  {
                    label: "www address",
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <span>
                          {www.domain} forwards to {domain.domain}
                        </span>
                        <StatusBadge tone={wwwStatus.tone}>{wwwStatus.label}</StatusBadge>
                      </span>
                    ),
                  },
                ]
              : []),
            { label: "Last checked", value: domain.checkedAt ? formatDateTime(domain.checkedAt, timeZone) : "Not yet" },
            ...(domain.message ? [{ label: "What's next", value: domain.message }] : []),
          ]}
        />
        {domain.lastError && domain.status !== "error" ? (
          <div className="mt-4">
            <Notice tone="warning">{domain.lastError}</Notice>
          </div>
        ) : null}
      </Card>

      {!allLive && domain.records.length > 0 ? (
        <Card
          title="DNS records to add"
          description="Log in where you bought the domain, open DNS settings, add these records. Changes can take up to 48 hours. Then click Check status."
          padding="none"
        >
          <Table label="DNS records to add">
            <THead>
              <tr>
                <Th>Type</Th>
                <Th>Name / Host</Th>
                <Th>Value</Th>
              </tr>
            </THead>
            <TBody>
              {domain.records.map((r) => (
                <Tr key={`${r.type}-${r.name}-${r.value}`}>
                  <Td nowrap>{r.type}</Td>
                  <Td nowrap>
                    <code className="font-mono text-small select-all">{r.name}</code>
                  </Td>
                  <Td>
                    <code className="font-mono text-small break-all select-all">{r.value}</code>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}

      {allLive ? (
        <Notice tone="success" title="You're all set.">
          Your store loads at https://{domain.domain} with a secure padlock{www ? `, and ${www.domain} forwards to it` : ""}. Keep the DNS records in place.
        </Notice>
      ) : (
        <Notice tone="info">
          “@” means the domain itself. Some providers want the full name instead, like {domain.domain}. If a record with the same name and type
          already exists, edit it instead of adding a second one.
        </Notice>
      )}
    </>
  );
}
