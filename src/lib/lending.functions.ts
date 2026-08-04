import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------- borrower ---------------- */

export const getMyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, apps, loans, txs, notes, docs] = await Promise.all([
      supabase.from("profiles").select("first_name,last_name,phone,kyc_status").eq("id", userId).maybeSingle(),
      supabase.from("loan_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("payment_transactions").select("*").eq("user_id", userId).order("occurred_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("kyc_documents").select("*").eq("user_id", userId),
    ]);
    return {
      profile: profile.data ?? null,
      kycStatus: profile.data?.kyc_status ?? "pending",
      applications: apps.data ?? [],
      loans: loans.data ?? [],
      transactions: txs.data ?? [],
      notifications: notes.data ?? [],
      documents: docs.data ?? [],
    };
  });

export const saveKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      docType: z.enum(["id_front", "id_back", "selfie"]),
      storagePath: z.string().min(3).max(400),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("kyc_documents")
      .select("id")
      .eq("user_id", userId)
      .eq("doc_type", data.docType)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("kyc_documents")
        .update({ storage_path: data.storagePath, status: "pending", review_notes: null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("kyc_documents")
        .insert({ user_id: userId, doc_type: data.docType, storage_path: data.storagePath });
      if (error) throw new Error(error.message);
    }

    const { adminUserIds, notify } = await import("@/lib/lending.server");
    const admins = await adminUserIds();
    await notify(
      admins.map(id => ({
        user_id: id,
        audience: "admin",
        kind: "kyc",
        title: "Identity document uploaded",
        body: `A borrower uploaded a ${data.docType.replace(/_/g, " ")} document for review.`,
      })),
    );

    return { ok: true, verified: false };
  });


export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      email: z.string().email(),
      phone: z.string().min(6).max(30),
      productId: z.string().min(1).max(50),
      productTitle: z.string().min(1).max(80),
      amount: z.number().positive().max(100_000_000),
      term: z.number().int().min(1).max(60),
      serviceFeePct: z.number().min(0).max(100),
      serviceFee: z.number().min(0),
      interestRate: z.number().min(0).max(1),
      monthly: z.number().min(0),
      provider: z.string().min(2).max(40),
      msisdn: z.string().min(6).max(30),
      purpose: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase.from("profiles").select("kyc_status").eq("id", userId).maybeSingle();
    if (profile?.kyc_status !== "approved") {
      throw new Error("Identity verification must be approved before you can apply.");
    }

    const { data: app, error } = await supabase
      .from("loan_applications")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        amount: data.amount,
        term_months: data.term,
        rate: data.interestRate,
        monthly_payment: data.monthly,
        product_id: data.productId,
        product_title: data.productTitle,
        service_fee_pct: data.serviceFeePct,
        service_fee: data.serviceFee,
        mobile_provider: data.provider,
        mobile_number: data.msisdn,
        purpose: data.purpose ?? data.productTitle,
        status: "under_review",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { recordTransaction, notify, adminUserIds } = await import("@/lib/lending.server");
    const tx = await recordTransaction({
      provider: data.provider,
      txType: "commitment",
      status: "succeeded",
      amount: data.serviceFee,
      currency: "ZMW",
      msisdn: data.msisdn,
      applicationId: app.id,
      userId,
    });

    const admins = await adminUserIds();
    await notify([
      {
        user_id: userId,
        kind: "application",
        title: "Application received",
        body: `Your ${data.productTitle} application for ${Math.round(data.amount).toLocaleString()} is under review. Service fee reference ${tx.provider_ref}.`,
        application_id: app.id,
      },
      ...admins.map(id => ({
        user_id: id,
        audience: "admin",
        kind: "application",
        title: "New application to review",
        body: `${data.firstName} ${data.lastName} applied for a ${data.productTitle} of ${Math.round(data.amount).toLocaleString()}.`,
        application_id: app.id,
      })),
    ]);

    return { id: app.id, reference: tx.provider_ref };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

export const repayLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ loanId: z.string().uuid(), amount: z.number().positive().max(100_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: loan } = await context.supabase
      .from("loans")
      .select("id")
      .eq("id", data.loanId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!loan) throw new Error("Loan not found");
    const { applyRepayment } = await import("@/lib/lending.server");
    return applyRepayment(data.loanId, data.amount);
  });

/* ---------------- admin ---------------- */

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const [apps, loans, txs, docs, profiles, notes] = await Promise.all([
      supabase.from("loan_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("loans").select("*").order("created_at", { ascending: false }),
      supabase.from("payment_transactions").select("*").order("occurred_at", { ascending: false }).limit(200),
      supabase.from("kyc_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name,phone,national_id,date_of_birth,gender,province,city,address,kyc_status,activation_status"),
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    ]);

    return {
      applications: apps.data ?? [],
      loans: loans.data ?? [],
      transactions: txs.data ?? [],
      documents: docs.data ?? [],
      profiles: profiles.data ?? [],
      notifications: notes.data ?? [],
    };
  });

export const reviewKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      docId: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabase
      .from("kyc_documents")
      .update({
        status: data.status,
        review_notes: data.notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.docId);
    if (error) throw new Error(error.message);

    const { data: doc } = await supabase.from("kyc_documents").select("user_id, doc_type").eq("id", data.docId).maybeSingle();
    if (doc) {
      const { notify } = await import("@/lib/lending.server");
      await notify([
        {
          user_id: doc.user_id,
          kind: "kyc",
          title: data.status === "approved" ? "Document verified" : "Document rejected",
          body:
            data.status === "approved"
              ? `Your ${doc.doc_type.replace(/_/g, " ")} was verified.`
              : `Your ${doc.doc_type.replace(/_/g, " ")} was rejected. ${data.notes ?? "Please upload a clearer copy."}`,
        },
      ]);
    }
    return { ok: true };
  });

export const reviewBorrowerKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      borrowerId: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: documents, error: readError } = await supabase
      .from("kyc_documents")
      .select("id,doc_type")
      .eq("user_id", data.borrowerId);
    if (readError) throw new Error(readError.message);
    if (!documents?.length) throw new Error("This borrower has not uploaded any identity documents.");

    const required = ["id_front", "id_back", "selfie"] as const;
    const uploaded = new Set<string>(documents.map(document => document.doc_type));
    const missing = [...required].filter(type => !uploaded.has(type));
    if (data.status === "approved" && missing.length > 0) {
      throw new Error(`Cannot validate KYC. Missing: ${missing.map(type => type.replace(/_/g, " ")).join(", ")}.`);
    }

    const { error } = await supabase
      .from("kyc_documents")
      .update({
        status: data.status,
        review_notes: data.notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("user_id", data.borrowerId);
    if (error) throw new Error(error.message);

    const { notify } = await import("@/lib/lending.server");
    await notify([{
      user_id: data.borrowerId,
      kind: "kyc",
      title: data.status === "approved" ? "Identity verified" : "Identity verification rejected",
      body: data.status === "approved"
        ? "Your identity information and documents were validated. You can now apply for a loan."
        : `Your identity verification was rejected. ${data.notes ?? "Please review and re-upload your documents."}`,
    }]);
    return { ok: true };
  });

export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      applicationId: z.string().uuid(),
      decision: z.enum(["approved", "declined"]),
      notes: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: app } = await supabase.from("loan_applications").select("*").eq("id", data.applicationId).maybeSingle();
    if (!app) throw new Error("Application not found");
    if (!app.user_id) throw new Error("This application is not linked to a borrower account");

    const { notify } = await import("@/lib/lending.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.decision === "declined") {
      await supabaseAdmin
        .from("loan_applications")
        .update({ status: "declined", decision_notes: data.notes ?? null, decided_by: userId, decided_at: new Date().toISOString() })
        .eq("id", app.id);
      await notify([
        {
          user_id: app.user_id,
          kind: "decision",
          title: "Application declined",
          body: `Unfortunately your ${app.product_title ?? "loan"} application was declined. ${data.notes ?? "Your service fee will be refunded to your wallet."}`,
          application_id: app.id,
        },
      ]);
      return { status: "declined" as const };
    }

    // eligibility gate: identity must be verified before money can be approved
    const { data: profile } = await supabaseAdmin.from("profiles").select("kyc_status").eq("id", app.user_id).maybeSingle();
    if (profile?.kyc_status !== "approved") throw new Error("Cannot approve: identity verification is not confirmed.");

    const principal = Number(app.amount);
    const total = Math.round(principal + principal * Number(app.rate ?? 0.025));

    const { data: loan, error: loanError } = await supabaseAdmin
      .from("loans")
      .insert({
        user_id: app.user_id,
        application_id: app.id,
        principal,
        term_months: app.term_months,
        repayment_frequency_days: 30,
        interest_rate: Number(app.rate ?? 0.025),
        outstanding_principal: total,
        total_repayment: total,
        service_fee: Number(app.service_fee ?? 0),
        product_id: app.product_id,
        product_title: app.product_title,
        provider: app.mobile_provider,
        msisdn: app.mobile_number,
        currency_code: app.currency_code ?? "ZMW",
        status: "pending",
      })
      .select("*")
      .single();
    if (loanError) throw new Error(loanError.message);

    await supabaseAdmin
      .from("loan_applications")
      .update({
        status: "approved",
        decision_notes: data.notes ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        loan_id: loan.id,
      })
      .eq("id", app.id);

    await notify([
      {
        user_id: app.user_id,
        kind: "decision",
        title: "Application approved 🎉",
        body: `Your ${app.product_title ?? "loan"} of ${Math.round(principal).toLocaleString()} was approved. Total repayable ${total.toLocaleString()}. Disbursement to ${app.mobile_number} is being prepared.`,
        application_id: app.id,
        loan_id: loan.id,
      },
    ]);

    return { status: "approved" as const, loanId: loan.id };
  });

export const disburseLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ loanId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { applyDisbursement } = await import("@/lib/lending.server");
    return applyDisbursement(data.loanId);
  });

export const adminRecordRepayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ loanId: z.string().uuid(), amount: z.number().positive().max(100_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { applyRepayment } = await import("@/lib/lending.server");
    return applyRepayment(data.loanId, data.amount);
  });
