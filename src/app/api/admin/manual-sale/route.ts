import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createSale, SaleCreationError } from "@/lib/create-sale";
import { complianceOrderValues, resolveSaleCompliance } from "@/lib/sale-compliance";

interface ManualLineInput {
  key?: string;
  itemId?: string | null;
  name?: string;
  sku?: string;
  listPrice?: number;
  soldPrice?: number;
  qty?: number;
  decrementStock?: boolean;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function manualOrderNumber(date: string) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase();
  return `GSW-${date.replace(/-/g, "")}-M${suffix}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = adminClient();
  try {
    const body = await request.json();
    const saleDate = typeof body.saleDate === "string" ? body.saleDate : "";
    const saleTime = typeof body.saleTime === "string" && /^\d{2}:\d{2}$/.test(body.saleTime)
      ? body.saleTime
      : "12:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
      return NextResponse.json({ error: "Enter the sale date." }, { status: 400 });
    }
    const createdAt = new Date(`${saleDate}T${saleTime}:00`);
    if (Number.isNaN(createdAt.valueOf())) {
      return NextResponse.json({ error: "Enter a valid sale date and time." }, { status: 400 });
    }

    const lines = Array.isArray(body.lines) ? body.lines as ManualLineInput[] : [];
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
    const manualNote = typeof body.manualNote === "string" ? body.manualNote.trim() : "";
    const discountReason = typeof body.discountReason === "string" ? body.discountReason.trim() : "";
    const compliance = await resolveSaleCompliance(admin, body);

    let customerId: string | null = null;
    if (customerEmail && customerEmail.includes("@")) {
      const { data: customer, error: customerError } = await admin
        .from("walk_in_customers")
        .upsert({ email: customerEmail, name: customerName || customerEmail }, { onConflict: "email" })
        .select("id")
        .single();
      if (customerError || !customer) throw new Error("Could not save the customer.");
      customerId = customer.id;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(auth.userId);
    const soldByName =
      (authUser.user?.user_metadata?.full_name as string | undefined)?.trim()
      || authUser.user?.email?.split("@")[0]
      || "Staff";
    const sale = await createSale({
      admin,
      source: "manual",
      orderNumber: manualOrderNumber(saleDate),
      pricing: "explicit",
      taxRate: compliance.taxRate,
      discountReason,
      lines: lines.map((line) => ({
        itemId: typeof line.itemId === "string" && line.itemId.trim() ? line.itemId.trim() : null,
        manualItemId: `manual-${String(line.key || crypto.randomUUID()).replace(/[^a-z0-9-]/gi, "").slice(0, 8)}`,
        name: typeof line.name === "string" ? line.name : "",
        sku: typeof line.sku === "string" ? line.sku : "",
        listPrice: Number(line.listPrice) || Number(line.soldPrice),
        soldPrice: Number(line.soldPrice),
        quantity: Number(line.qty),
        decrementInventory: line.decrementStock === true,
        useProvidedMetadata: true,
      })),
      orderValues: {
        user_id: null,
        status: "completed",
        notes: "",
        walk_in_customer_id: customerId,
        fulfillment: "pickup",
        sold_by_id: auth.userId,
        sold_by_name: soldByName,
        manual_note: manualNote,
        created_at: createdAt.toISOString(),
        ...complianceOrderValues(compliance, auth.userId),
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: sale.order.id,
      orderNumber: sale.order.order_number,
      customerSaved: customerId !== null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save sale";
    console.error("[ManualSale]", message);
    return NextResponse.json(
      { error: message },
      { status: error instanceof SaleCreationError ? error.status : 500 },
    );
  }
}
