"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

import {
  createResource,
  deleteResource,
  getResources,
  updateResource,
  type CreateResourceData,
  type Resource,
} from "@/lib/resources";
import ResourceImage from "@/components/resources/ResourceImage";
import { getMyWorkspaces } from "@/lib/workspaces";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function ResourcesPage() {
  const params = useParams();
  const { confirm: confirmAction, dialog } = useConfirmDialog();

  const workspaceId = Number(params.workspaceId);

  const [resources, setResources] = useState<Resource[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<CreateResourceData>({
    name: "",
    type: "",
    capacity: 1,
    price: 0,
    pricing_unit: "",
    status: "active",
  });

  const [loadingResources, setLoadingResources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editingForm, setEditingForm] = useState<CreateResourceData | null>(null);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [updatingResource, setUpdatingResource] = useState(false);
  const [editError, setEditError] = useState("");

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  /*
   * Load resources
   */
  useEffect(() => {
    const loadResources = async () => {
      if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        setError("Invalid workspace.");
        setLoadingResources(false);
        return;
      }

      try {
        setLoadingResources(true);
        setError("");

        const [data, workspaces] = await Promise.all([getResources(workspaceId), getMyWorkspaces()]);

        setResources(data);
        setCanManage(workspaces.some((workspace) => workspace.id === workspaceId && workspace.pivot?.role === "owner"));
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          setError(
            error.response?.data?.message ??
              "Failed to load resources.",
          );
        } else {
          setError("Something went wrong.");
        }
      } finally {
        setLoadingResources(false);
      }
    };

    loadResources();
  }, [workspaceId]);

  /*
   * Form input change
   */
  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "capacity" || name === "price"
          ? Number(value)
          : value,
    }));
  };

  const handleEditChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setEditingForm((current) => current ? {
      ...current,
      [name]: name === "capacity" || name === "price" ? Number(value) : value,
    } : current);
  };

  /*
   * Create resource
   */
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formElement = event.currentTarget;

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setFormError("Invalid workspace.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const resource = await createResource(
        workspaceId,
        { ...form, image: imageFile },
      );

      setResources((current) => [
        ...current,
        resource,
      ]);

      setForm({
        name: "",
        type: "",
        capacity: 1,
        price: 0,
        pricing_unit: "",
        status: "active",
      });

      setShowForm(false);
      formElement.reset();
      setImageFile(null);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors;

        if (errors) {
          const firstError =
            Object.values(errors).flat()[0];

          setFormError(String(firstError));
        } else {
          setFormError(
            error.response?.data?.message ??
              "Failed to create resource.",
          );
        }
      } else {
        setFormError("Something went wrong.");
      }
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (resource: Resource) => {
    setEditingResource(resource);
    setEditingForm({
      name: resource.name,
      type: resource.type,
      capacity: resource.capacity,
      price: resource.price,
      pricing_unit: resource.pricing_unit,
      status: resource.status,
    });
    setEditingImageFile(null);
    setRemoveCurrentImage(false);
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingResource(null);
    setEditingForm(null);
    setEditingImageFile(null);
    setRemoveCurrentImage(false);
    setEditError("");
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingResource || !editingForm) return;
    try {
      setUpdatingResource(true);
      setEditError("");
      const updated = await updateResource(workspaceId, editingResource.id, {
        ...editingForm,
        image: editingImageFile,
        remove_image: removeCurrentImage,
      });
      setResources((current) => current.map((resource) => resource.id === updated.id ? updated : resource));
      cancelEdit();
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        const validationErrors = requestError.response?.data?.errors;
        const firstError = validationErrors ? Object.values(validationErrors).flat()[0] : undefined;
        setEditError(firstError ? String(firstError) : requestError.response?.data?.message ?? "Failed to update resource.");
      } else {
        setEditError("Something went wrong while updating this resource.");
      }
    } finally {
      setUpdatingResource(false);
    }
  };

  /*
   * Delete resource
   */
  const handleDelete = async (resourceId: number) => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setError("Invalid workspace.");
      return;
    }

    const confirmed = await confirmAction(
      "Are you sure you want to delete this resource?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteResource(
        workspaceId,
        resourceId,
      );

      setResources((current) =>
        current.filter(
          (resource) => resource.id !== resourceId,
        ),
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to delete resource.",
        );
      } else {
        setError("Something went wrong.");
      }
    }
  };

  if (loadingResources) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading resources...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {dialog}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Resources
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? "Manage rooms, desks, offices and other resources." : "View resource types, capacity, availability, and pricing."}
          </p>
        </div>

        {canManage && <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setFormError("");
          }}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto ${showForm ? "border border-[#dce5df] bg-white text-[#425249] hover:border-[#bdcfc1] hover:bg-[#f4f7f4]" : "bg-[#176b4d] text-white shadow-[#176b4d]/15 hover:bg-[#125a40]"}`}
        >
          {showForm ? "Cancel" : "Add Resource"}
        </button>}
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create form */}
      {canManage && showForm && (
        <div className="rounded-xl border p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Create Resource
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Add a resource to this workspace.
            </p>
          </div>

          {formError && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 sm:grid-cols-2"
          >
            <ResourceFields prefix="create" form={form} onChange={handleChange} />
            <ImageUploadField
              id="resource-image"
              alt={`${form.name || "New resource"} preview`}
              type={form.type || "desk"}
              imageUrl={null}
              file={imageFile}
              onFileChange={setImageFile}
              removeImage={false}
              onRemoveImageChange={() => undefined}
            />

            {/* Submit */}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-xl bg-[#176b4d] px-4 text-sm font-semibold text-white transition duration-200 hover:bg-[#125a40] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Resource"}
              </button>
            </div>
          </form>
        </div>
      )}

      {canManage && editingResource && editingForm && (
        <form onSubmit={handleEditSubmit} className="card-surface grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2"><h2 className="text-lg font-semibold">Edit {editingResource.name}</h2><p className="mt-1 text-sm text-muted-foreground">Update the resource details or replace its image.</p></div>
          {editError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{editError}</div>}
          <ResourceFields prefix="edit" form={editingForm} onChange={handleEditChange} />
          <ImageUploadField
            id="edit-resource-image"
            alt={`${editingForm.name || "Resource"} preview`}
            type={editingForm.type || "desk"}
            imageUrl={editingResource.image_url}
            file={editingImageFile}
            onFileChange={(file) => { setEditingImageFile(file); if (file) setRemoveCurrentImage(false); }}
            removeImage={removeCurrentImage}
            onRemoveImageChange={(remove) => { setRemoveCurrentImage(remove); if (remove) setEditingImageFile(null); }}
          />
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" onClick={cancelEdit} disabled={updatingResource} className="h-10 rounded-lg border border-[#dce5df] px-4 text-sm font-semibold text-slate-600 transition hover:bg-[#f4f7f4] disabled:opacity-50">Cancel</button><button type="submit" disabled={updatingResource} className="h-10 rounded-lg bg-[#176b4d] px-4 text-sm font-semibold text-white transition hover:bg-[#125a40] disabled:cursor-not-allowed disabled:opacity-50">{updatingResource ? "Saving..." : "Save changes"}</button></div>
        </form>
      )}

      {/* Resources */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Workspace Resources
          </h2>

          <p className="text-sm text-muted-foreground">
            Resources available in this workspace.
          </p>
        </div>

        {resources.length === 0 ? (
          <div className="rounded-xl border p-8 text-center">
            <p className="font-medium">
              No resources yet
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {canManage ? "Create your first resource for this workspace." : "Resources will appear here when the workspace owner adds them."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="card-surface overflow-hidden"
              >
                <ResourceImage imageUrl={resource.image_url} type={resource.type} alt={`${resource.name} resource`} className="relative aspect-[16/10] w-full overflow-hidden" />
                <div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">
                      {resource.name}
                    </h3>

                    <p className="mt-1 text-sm capitalize text-muted-foreground">
                      {resource.type.replace(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>

                  <span className="rounded-full border px-2.5 py-1 text-xs capitalize">
                    {resource.status.replace(
                      "_",
                      " ",
                    )}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Capacity
                    </span>

                    <span className="font-medium">
                      {resource.capacity}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Price
                    </span>

                    <span className="font-medium">
                      {Number(
                        resource.price,
                      ).toFixed(2)}{" "}
                      DH / {resource.pricing_unit}
                    </span>
                  </div>
                </div>

                {canManage && <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => beginEdit(resource)}
                    className="rounded-lg border border-[#cbdccf] px-3.5 py-2 text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(resource.id)
                    }
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-4 focus-visible:ring-red-500/20"
                  >
                    Delete
                  </button>
                </div>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceFields({ prefix, form, onChange }: {
  prefix: string;
  form: CreateResourceData;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  return <>
    <Field id={`${prefix}-name`} label="Name"><input id={`${prefix}-name`} name="name" value={form.name} onChange={onChange} placeholder="Meeting Room A" required className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" /></Field>
    <Field id={`${prefix}-type`} label="Type"><select id={`${prefix}-type`} name="type" value={form.type} onChange={onChange} required className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10"><option value="">Select type</option><option value="desk">Desk</option><option value="meeting_room">Meeting room</option><option value="private_office">Private office</option><option value="event_space">Event space</option></select></Field>
    <Field id={`${prefix}-capacity`} label="Capacity"><input id={`${prefix}-capacity`} name="capacity" type="number" min={1} value={form.capacity} onChange={onChange} required className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" /></Field>
    <Field id={`${prefix}-price`} label="Price"><input id={`${prefix}-price`} name="price" type="number" min={0} step="0.01" value={form.price} onChange={onChange} required className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" /></Field>
    <Field id={`${prefix}-pricing-unit`} label="Pricing unit"><select id={`${prefix}-pricing-unit`} name="pricing_unit" value={form.pricing_unit} onChange={onChange} required className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10"><option value="">Select pricing unit</option><option value="hour">Hour</option><option value="day">Day</option><option value="month">Month</option></select></Field>
    <Field id={`${prefix}-status`} label="Status"><select id={`${prefix}-status`} name="status" value={form.status ?? "active"} onChange={onChange} className="h-11 w-full rounded-lg border border-[#dce5df] bg-background px-3 outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10"><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select></Field>
  </>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}</div>;
}

function ImageUploadField({ id, alt, type, imageUrl, file, onFileChange, removeImage, onRemoveImageChange }: {
  id: string;
  alt: string;
  type: string;
  imageUrl: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  removeImage: boolean;
  onRemoveImageChange: (remove: boolean) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setValidationError("");
    if (!selected) {
      clearPreview();
      onFileChange(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setValidationError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      clearPreview();
      onFileChange(null);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setValidationError("The image must be 5 MB or smaller.");
      event.target.value = "";
      clearPreview();
      onFileChange(null);
      return;
    }
    clearPreview();
    const url = URL.createObjectURL(selected);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    onRemoveImageChange(false);
    onFileChange(selected);
  };

  return <div className="space-y-3 sm:col-span-2">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ResourceImage imageUrl={previewUrl || (removeImage ? null : imageUrl)} type={type} alt={alt} className="relative aspect-[16/10] w-full max-w-64 overflow-hidden rounded-xl" sizes="256px" />
      <div className="space-y-2"><label htmlFor={id} className="block text-sm font-medium">Resource image <span className="font-normal text-muted-foreground">(optional, JPG/PNG/WebP up to 5 MB)</span></label><input ref={inputRef} id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="block w-full max-w-md text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#eaf3ed] file:px-3 file:py-2 file:font-semibold file:text-[#176b4d] hover:file:bg-[#dcece0]" />{file && <button type="button" onClick={() => { clearPreview(); onFileChange(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-sm font-medium text-slate-600 underline underline-offset-2">Clear selected image</button>}{imageUrl && !file && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={removeImage} onChange={(event) => onRemoveImageChange(event.target.checked)} className="accent-[#176b4d]" />Remove current image</label>}{validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}<p className="text-xs text-muted-foreground">Images help customers recognize this space before booking.</p></div>
    </div>
  </div>;
}
