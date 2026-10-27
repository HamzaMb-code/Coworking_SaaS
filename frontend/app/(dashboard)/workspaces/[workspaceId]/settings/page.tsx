"use client";

import { useEffect, useRef, useState } from "react";
import WorkspaceImage from "@/components/workspaces/WorkspaceImage";
import { useParams } from "next/navigation";
import axios from "axios";
import { getWorkspace, getWorkspaceBankTransferDetails, updateWorkspace, updateWorkspaceBankTransferDetails, workspaceImageValidationError, type Workspace, type WorkspaceBankTransferDetails } from "@/lib/workspaces";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bankDetails, setBankDetails] = useState<WorkspaceBankTransferDetails>({ beneficiary_name: "", bank_name: "", account_identifier: "" });
  const [bankDetailsSaving, setBankDetailsSaving] = useState(false);
  const [bankDetailsError, setBankDetailsError] = useState("");
  const [bankDetailsMessage, setBankDetailsMessage] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
  }, [selectedImagePreview]);

  useEffect(() => {
    Promise.all([getWorkspace(workspaceId), getWorkspaceBankTransferDetails(workspaceId)])
      .then(([workspaceData, bankData]) => { setWorkspace(workspaceData); if (bankData.details) setBankDetails(bankData.details); })
      .catch(() => setError("Could not load workspace settings."))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const saveBankDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setBankDetailsSaving(true); setBankDetailsError(""); setBankDetailsMessage("");
      const saved = await updateWorkspaceBankTransferDetails(workspaceId, {
        beneficiary_name: String(form.get("beneficiary_name") ?? "").trim(),
        bank_name: String(form.get("bank_name") ?? "").trim(),
        account_identifier: String(form.get("account_identifier") ?? "").replaceAll(" ", "").trim(),
      });
      if (saved.details) setBankDetails(saved.details);
      setBankDetailsMessage("Bank-transfer beneficiary details saved.");
    } catch (requestError: unknown) {
      const validation = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const first = validation ? Object.values(validation).flat()[0] : undefined;
      setBankDetailsError(first ? String(first) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not save beneficiary details." : "Could not save beneficiary details.");
    } finally { setBankDetailsSaving(false); }
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setSaving(true); setError(""); setMessage("");
      const updated = await updateWorkspace(workspaceId, {
        name: String(form.get("name") ?? "").trim(),
        slug: String(form.get("slug") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        address: String(form.get("address") ?? "").trim(),
        city: String(form.get("city") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        image: form.get("image") instanceof File && (form.get("image") as File).size > 0 ? form.get("image") as File : undefined,
        remove_image: removeImage,
      });
      setWorkspace(updated); setSelectedImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; setRemoveImage(false); setMessage("Workspace details saved.");
    } catch (requestError: unknown) {
      const validation = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const first = validation ? Object.values(validation).flat()[0] : undefined;
      setError(first ? String(first) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not save workspace settings." : "Could not save workspace settings.");
    } finally { setSaving(false); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading workspace settings...</p>;
  if (!workspace) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Workspace not found."}</p>;
  return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-semibold text-[#4e5ff7]">Workspace management</p><h1 className="mt-1 text-3xl font-bold">Settings</h1><p className="mt-2 text-slate-500">Update your workspace details and payment instructions.</p></div><form onSubmit={save} className="grid gap-5 rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:grid-cols-2 sm:p-7"><Field name="name" label="Workspace name" value={workspace.name} required /><Field name="slug" label="URL slug" value={workspace.slug} required /><Field name="city" label="City" value={workspace.city} required /><Field name="address" label="Street address" value={workspace.address} required className="sm:col-span-2" /><label className="text-sm font-medium sm:col-span-2">Description<textarea name="description" defaultValue={workspace.description ?? ""} rows={4} className="mt-2 w-full rounded-lg border border-[#e5e8f0] p-3 font-normal" /></label><Field name="email" label="Contact email" type="email" value={workspace.email ?? ""} /><Field name="phone" label="Phone" type="tel" value={workspace.phone ?? ""} /><div className="sm:col-span-2"><p className="text-sm font-medium">Workspace image <span className="font-normal text-muted-foreground">(JPG/PNG/WebP, up to 5 MB)</span></p><WorkspaceImage imageUrl={removeImage ? null : selectedImagePreview || workspace.image_url} alt={`${workspace.name} workspace cover preview`} className="relative mt-3 h-48 w-full max-w-md overflow-hidden rounded-xl" sizes="(max-width: 640px) 100vw, 448px" /><input ref={imageInputRef} name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; const validationError = file ? workspaceImageValidationError(file) : null; if (validationError) { input.value = ""; setSelectedImagePreview(null); setError(validationError); return; } setError(""); setRemoveImage(false); setSelectedImagePreview(file ? URL.createObjectURL(file) : null); }} className="mt-3 block w-full rounded-md border bg-background p-2 text-sm" />{workspace.image_path && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={removeImage} onChange={(event) => { const shouldRemove = event.target.checked; setRemoveImage(shouldRemove); if (shouldRemove) { if (imageInputRef.current) imageInputRef.current.value = ""; setSelectedImagePreview(null); } }} />Remove current image</label>}</div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2">{message}</p>}<div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-[#4e5ff7] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save settings"}</button></div></form>
    <form onSubmit={saveBankDetails} className="space-y-5 rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-7"><div><h2 className="text-lg font-semibold">Bank-transfer beneficiary</h2><p className="mt-1 text-sm text-slate-500">Customers with a booking at this workspace can view these details when preparing their transfer. Proof is still reviewed by staff.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field name="beneficiary_name" label="Beneficiary name" value={bankDetails.beneficiary_name} required /><Field name="bank_name" label="Bank name" value={bankDetails.bank_name} required /><Field name="account_identifier" label="RIB / IBAN" value={bankDetails.account_identifier} required className="sm:col-span-2" /></div>{bankDetailsError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{bankDetailsError}</p>}{bankDetailsMessage && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{bankDetailsMessage}</p>}<button disabled={bankDetailsSaving} className="rounded-lg bg-[#176b4d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{bankDetailsSaving ? "Saving..." : "Save bank details"}</button></form>
  </div>;
}

function Field({ name, label, value, type = "text", required = false, className = "" }: { name: string; label: string; value: string; type?: string; required?: boolean; className?: string }) { return <label className={`text-sm font-medium ${className}`}>{label}<input name={name} type={type} defaultValue={value} required={required} maxLength={255} className="mt-2 h-11 w-full rounded-lg border border-[#e5e8f0] px-3 font-normal" /></label>; }
