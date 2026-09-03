import type { CustomerSessionResponse } from "@narada/shared";
import { customerCapability, verifyCustomerCapability } from "../lib/customerCapability.js";
import { HttpError, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";

type SessionRepos = Pick<Repos, "outlets" | "tables" | "sessions">;

export async function createCustomerSession(
  repos: SessionRepos,
  slug: string,
  tableCode?: string,
  currentToken?: string,
  customerId?: string,
): Promise<{ response: CustomerSessionResponse; capability: string }> {
  const outlet = await repos.outlets.findActiveBySlug(slug);
  if (!outlet) throw notFound("unknown outlet");

  const current = verifyCustomerCapability(currentToken);
  if (!tableCode && current?.outletId === outlet.id) {
    const existing = await repos.sessions.findById(current.sessionId, outlet.id);
    if (existing?.status === "active" && existing.service_type === "takeaway") {
      return {
        response: {
          sessionId: existing.id,
          serviceType: "takeaway",
          tableLabel: "Takeaway",
          outlet: {
            id: outlet.id,
            name: outlet.name,
            slug: outlet.slug,
            tablesEnabled: Boolean(outlet.tables_enabled),
          },
        },
        capability: customerCapability(existing.id, outlet.id),
      };
    }
  }

  let table: { id: string; outlet_id: string; label: string } | null = null;
  if (tableCode) {
    if (!outlet.tables_enabled) throw notFound("unknown table");
    table = await repos.tables.findByCodeForOutlet(tableCode, outlet.id);
    if (!table) throw notFound("unknown table");
  }

  const session =
    (table && (await repos.sessions.findActiveByTableId(table.id, outlet.id))) ||
    (await repos.sessions.create({
      outlet_id: outlet.id,
      table_id: table?.id ?? null,
      service_type: table ? "dine_in" : "takeaway",
      customer_id: customerId ?? null,
    }));
  return {
    response: {
      sessionId: session.id,
      serviceType: table ? "dine_in" : "takeaway",
      tableLabel: table?.label ?? "Takeaway",
      outlet: {
        id: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        tablesEnabled: Boolean(outlet.tables_enabled),
      },
    },
    capability: customerCapability(session.id, outlet.id),
  };
}

export async function requireCustomerSession(
  repos: Pick<Repos, "outlets" | "sessions">,
  token: string | undefined,
  expectedSessionId?: string,
) {
  const claims = verifyCustomerCapability(token);
  if (!claims || (expectedSessionId && expectedSessionId !== claims.sessionId)) {
    throw new HttpError(401, "customer session required");
  }
  const [outlet, session] = await Promise.all([
    repos.outlets.findActiveById(claims.outletId),
    repos.sessions.findById(claims.sessionId, claims.outletId),
  ]);
  // The capability remains valid for receipt reads after settlement. Every
  // mutation still checks active/bill state in its own service.
  if (
    !outlet ||
    !session ||
    session.outlet_id !== claims.outletId ||
    !["active", "billed", "closed"].includes(session.status)
  ) {
    throw new HttpError(401, "customer session required");
  }
  return { outlet, session, claims };
}

// Optional context for assistant endpoints. Unlike the guard above, this is
// deliberately non-throwing because Anna/voice can still serve a public
// table/menu request when no customer capability cookie is present.
export async function customerCapabilityContext(
  repos: Pick<Repos, "outlets" | "sessions">,
  token: string | undefined,
) {
  try {
    return await requireCustomerSession(repos, token);
  } catch {
    return null;
  }
}
