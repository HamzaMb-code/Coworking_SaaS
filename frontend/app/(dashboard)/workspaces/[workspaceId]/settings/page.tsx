"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import axios from "axios";
import { getWorkspace, updateWorkspace, type Workspace } from "@/lib/workspaces";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    getWorkspace(workspaceId).then(setWorkspace).catch(() => setError("Could not load workspace settings.")).finally(() => setLoading(false));
  }, [workspaceId]);

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
      setWorkspace(updated); setMessage("Workspace details saved.");
    } catch (requestError: unknown) {
      const validation = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const first = validation ? Object.values(validation).flat()[0] : undefined;
      setError(first ? String(first) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not save workspace settings." : "Could not save workspace settings.");
    } finally { setSaving(false); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading workspace settings...</p>;
  if (!workspace) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Workspace not found."}</p>;
  return <div className="mx-auto max-w-4xl space-y-6"><div><p className="text-sm font-semibold text-[#4e5ff7]">Workspace management</p><h1 className="mt-1 text-3xl font-bold">Settings</h1><p className="mt-2 text-slate-500">Update the public details customers see when they explore your location.</p></div><form onSubmit={save} className="grid gap-5 rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:grid-cols-2 sm:p-7"><Field name="name" label="Workspace name" value={workspace.name} required /><Field name="slug" label="URL slug" value={workspace.slug} required /><Field name="city" label="City" value={workspace.city} required /><Field name="address" label="Street address" value={workspace.address} required className="sm:col-span-2" /><label className="text-sm font-medium sm:col-span-2">Description<textarea name="description" defaultValue={workspace.description ?? ""} rows={4} className="mt-2 w-full rounded-lg border border-[#e5e8f0] p-3 font-normal" /></label><Field name="email" label="Contact email" type="email" value={workspace.email ?? ""} /><Field name="phone" label="Phone" type="tel" value={workspace.phone ?? ""} /><div className="sm:col-span-2"><p className="text-sm font-medium">Workspace image <span className="font-normal text-muted-foreground">(JPG/PNG/WebP, up to 5 MB)</span></p>{workspace.image_url && !removeImage && <Image unoptimized src={workspace.image_url} alt={`${workspace.name} workspace`} width={800} height={384} className="mt-3 h-48 w-full rounded-xl object-cover sm:max-w-md" />}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={() => setRemoveImage(false)} className="mt-3 block w-full rounded-md border bg-background p-2 text-sm" />{workspace.image_path && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />Remove current image</label>}</div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2">{message}</p>}<div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-[#4e5ff7] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save settings"}</button></div></form></div>;
}

function Field({ name, label, value, type = "text", required = false, className = "" }: { name: string; label: string; value: string; type?: string; required?: boolean; className?: string }) { return <label className={`text-sm font-medium ${className}`}>{label}<input name={name} type={type} defaultValue={value} required={required} maxLength={255} className="mt-2 h-11 w-full rounded-lg border border-[#e5e8f0] px-3 font-normal" /></label>; }
