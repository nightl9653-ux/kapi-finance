"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newGigId, type GigClient } from "@/lib/gigs/types";

export function GigClientForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial?: GigClient;
  onCancel: () => void;
  onSave: (client: GigClient) => Promise<void>;
  saving?: boolean;
}) {
  const t = useTranslations("gigs");
  const fieldId = initial?.id || "new";
  const [name, setName] = useState(initial?.name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-3 rounded-2xl border bg-white/70 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        const now = new Date().toISOString();
        void onSave({
          id: initial?.id || newGigId(),
          name: n,
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
          createdAt: initial?.createdAt || now,
          updatedAt: now,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`gig-client-name-${fieldId}`}>{t("clientName")}</Label>
        <Input id={`gig-client-name-${fieldId}`} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`gig-client-company-${fieldId}`}>{t("clientCompany")}</Label>
          <Input id={`gig-client-company-${fieldId}`} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`gig-client-phone-${fieldId}`}>{t("clientPhone")}</Label>
          <Input id={`gig-client-phone-${fieldId}`} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`gig-client-email-${fieldId}`}>{t("clientEmail")}</Label>
        <Input id={`gig-client-email-${fieldId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`gig-client-notes-${fieldId}`}>{t("notes")}</Label>
        <Input id={`gig-client-notes-${fieldId}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={saving || !name.trim()}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
