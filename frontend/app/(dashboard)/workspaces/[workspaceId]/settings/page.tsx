"use client";

import { useEffect, useRef, useState } from "react";
import WorkspaceImage from "@/components/workspaces/WorkspaceImage";
import { useParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, ImagePlus, Landmark, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWorkspace, getWorkspaceBankTransferDetails, updateWorkspace, updateWorkspaceBankTransferDetails, workspaceImageValidationError, type Workspace, type WorkspaceBankTransferDetails } from "@/lib/workspaces";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<number | null>(null);
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
    let active = true;
    Promise.all([getWorkspace(workspaceId), getWorkspaceBankTransferDetails(workspaceId)])
      .then(([workspaceData, bankData]) => {
        if (!active) return;
        setWorkspace(workspaceData);
        setBankDetails(bankData.details ?? { beneficiary_name: "", bank_name: "", account_identifier: "" });
        setLoadedWorkspaceId(workspaceId);
      })
      .catch(() => { if (active) { setWorkspace(null); setError("Could not load workspace settings."); setLoadedWorkspaceId(workspaceId); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
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
      window.dispatchEvent(new CustomEvent("workspace-bank-transfer-setup-updated", { detail: { workspaceId } }));
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

  if (loading || loadedWorkspaceId !== workspaceId) return <p className="py-20 text-center text-sm text-muted-foreground">Loading workspace settings...</p>;
  if (!workspace) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Workspace not found."}</p>;
  return <div className="mx-auto max-w-5xl space-y-7 pb-6">
    <header className="relative overflow-hidden rounded-3xl border border-[#dfe9e1] bg-gradient-to-br from-[#f4f9f5] via-white to-[#edf5ef] p-6 shadow-sm sm:p-8">
      <div className="absolute -right-12 -top-16 size-56 rounded-full bg-[#176b4d]/5 blur-2xl" />
      <div className="relative flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#176b4d] text-white shadow-md shadow-[#176b4d]/20"><Building2 className="size-6" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b4d]">Workspace management</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1b2b24]">Settings</h1><p className="mt-2 text-sm leading-6 text-slate-600">Update your workspace details and payment instructions.</p></div></div>
    </header>

    <form onSubmit={save} className="overflow-hidden rounded-3xl border border-[#e4ebe5] bg-white shadow-[0_8px_28px_rgba(27,43,36,0.06)]">
      <div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
        <Field name="name" label="Workspace name" value={workspace.name} required />
        <Field name="slug" label="URL slug" value={workspace.slug} required />
        <Field name="city" label="City" value={workspace.city} required />
        <Field name="address" label="Street address" value={workspace.address} required />
        <label className="text-sm font-semibold text-[#34443a] sm:col-span-2">Description<textarea name="description" defaultValue={workspace.description ?? ""} rows={4} className="mt-2 w-full resize-y rounded-xl border border-[#dfe7e0] bg-[#fcfdfc] p-3.5 text-sm font-normal text-[#26332e] shadow-sm outline-none transition placeholder:text-slate-400 hover:border-[#b7cdbb] focus:border-[#176b4d] focus:bg-white focus:ring-4 focus:ring-[#176b4d]/10" /></label>
        <Field name="email" label="Contact email" type="email" value={workspace.email ?? ""} />
        <Field name="phone" label="Phone" type="tel" value={workspace.phone ?? ""} />
        <div className="space-y-3 sm:col-span-2"><p className="text-sm font-semibold text-[#34443a]">Workspace image <span className="font-normal text-muted-foreground">(JPG/PNG/WebP, up to 5 MB)</span></p><div className="rounded-2xl border border-dashed border-[#cdddcf] bg-[#f8fbf8] p-3 transition hover:border-[#8bb397] sm:p-4"><WorkspaceImage imageUrl={removeImage ? null : selectedImagePreview || workspace.image_url} alt={`${workspace.name} workspace cover preview`} className="relative mt-3 h-48 w-full max-w-md overflow-hidden rounded-xl" sizes="(max-width: 640px) 100vw, 448px" /><label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#e1e9e2] bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm transition hover:border-[#a9c8b0] hover:text-[#176b4d] focus-within:ring-4 focus-within:ring-[#176b4d]/10"><ImagePlus className="size-4 shrink-0 text-[#176b4d]" /><input ref={imageInputRef} name="image" type="file" aria-label="Workspace image" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; const validationError = file ? workspaceImageValidationError(file) : null; if (validationError) { input.value = ""; setSelectedImagePreview(null); setError(validationError); return; } setError(""); setRemoveImage(false); setSelectedImagePreview(file ? URL.createObjectURL(file) : null); }} className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#eaf3ed] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#176b4d] hover:file:bg-[#dcefe1]" /></label>{workspace.image_path && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-slate-600"><input type="checkbox" checked={removeImage} onChange={(event) => { const shouldRemove = event.target.checked; setRemoveImage(shouldRemove); if (shouldRemove) { if (imageInputRef.current) imageInputRef.current.value = ""; setSelectedImagePreview(null); } }} className="size-4 rounded border-slate-300 accent-[#176b4d] focus:ring-[#176b4d]" />Remove current image</label>}</div></div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 sm:col-span-2">{error}</p>}
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 sm:col-span-2">{message}</p>}
      </div>
      <div className="flex justify-end border-t border-[#edf1ed] bg-[#fcfdfc] px-5 py-4 sm:px-7"><Button type="submit" disabled={saving} className="h-10 gap-2 bg-[#176b4d] px-5 text-white shadow-sm hover:bg-[#125a40]"><Save className="size-4" />{saving ? "Saving..." : "Save settings"}<ArrowRight className="size-4" /></Button></div>
    </form>

    <form id="bank-transfer-details" onSubmit={saveBankDetails} className="overflow-hidden rounded-3xl border border-[#dce9df] bg-white shadow-[0_8px_28px_rgba(27,43,36,0.06)]">
      <div className="flex items-center gap-3 border-b border-[#e5efe7] bg-gradient-to-r from-[#f1f8f2] to-white px-5 py-4 sm:px-7"><span className="grid size-9 place-items-center rounded-xl bg-[#176b4d] text-white shadow-sm"><Landmark className="size-4" /></span><h2 className="text-sm font-semibold text-[#26332e]">Bank-transfer beneficiary</h2></div>
      <div className="space-y-5 p-5 sm:p-7"><p className="text-sm leading-6 text-slate-600">Customers with a booking at this workspace can view these details when preparing their transfer. Proof is still reviewed by staff.</p><div className="grid gap-5 sm:grid-cols-2"><Field name="beneficiary_name" label="Beneficiary name" value={bankDetails.beneficiary_name} required /><Field name="bank_name" label="Bank name" value={bankDetails.bank_name} required /><Field name="account_identifier" label="RIB / IBAN" value={bankDetails.account_identifier} required className="sm:col-span-2" /></div>{bankDetailsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{bankDetailsError}</p>}{bankDetailsMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">{bankDetailsMessage}</p>}</div>
      <div className="flex justify-end border-t border-[#edf1ed] bg-[#fcfdfc] px-5 py-4 sm:px-7"><Button type="submit" disabled={bankDetailsSaving} className="h-10 gap-2 bg-[#176b4d] px-5 text-white shadow-sm hover:bg-[#125a40]"><Save className="size-4" />{bankDetailsSaving ? "Saving..." : "Save bank details"}<ArrowRight className="size-4" /></Button></div>
    </form>
  </div>;
}

function Field({ name, label, value, type = "text", required = false, className = "" }: { name: string; label: string; value: string; type?: string; required?: boolean; className?: string }) { return <label className={`text-sm font-semibold text-[#34443a] ${className}`}>{label}<input name={name} type={type} defaultValue={value} required={required} maxLength={255} className="mt-2 h-11 w-full rounded-xl border border-[#dfe7e0] bg-[#fcfdfc] px-3.5 text-sm font-normal text-[#26332e] shadow-sm outline-none transition placeholder:text-slate-400 hover:border-[#b7cdbb] focus:border-[#176b4d] focus:bg-white focus:ring-4 focus:ring-[#176b4d]/10" /></label>; }
