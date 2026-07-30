"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newEntityId, type Contact } from "@/lib/meetings/types";

export function ContactForm({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: Contact;
  onCancel: () => void;
  onSave: (contact: Contact) => void | Promise<void>;
}) {
  const t = useTranslations("meetingsPage");
  const [name, setName] = useState(initial?.name ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [relation, setRelation] = useState(initial?.relation ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="space-y-4 rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || submitting) return;
        const now = new Date().toISOString();
        setSubmitting(true);
        void Promise.resolve(
          onSave({
            id: initial?.id ?? newEntityId(),
            name: trimmed,
            alias: alias.trim() || undefined,
            relation: relation.trim() || undefined,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            notes: notes.trim() || undefined,
            adviceItems: initial?.adviceItems,
            createdAt: initial?.createdAt ?? now,
            updatedAt: now,
          }),
        ).finally(() => setSubmitting(false));
      }}
    >
      <h2 className="text-base font-medium">{mode === "create" ? t("newFriend") : t("editFriend")}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="contact-name">{t("name")}</Label>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-alias">{t("alias")}</Label>
          <Input id="contact-alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-relation">{t("relation")}</Label>
          <Input
            id="contact-relation"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder={t("relationPlaceholder")}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">{t("phone")}</Label>
          <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{t("email")}</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-notes">{t("notes")}</Label>
        <textarea
          id="contact-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button type="submit" className="rounded-full" disabled={submitting}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
