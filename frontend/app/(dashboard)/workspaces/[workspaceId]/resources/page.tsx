"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

import {
  createResource,
  deleteResource,
  getResources,
  type CreateResourceData,
  type Resource,
} from "@/lib/resources";
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

  /*
   * Create resource
   */
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setFormError("Invalid workspace.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const resource = await createResource(
        workspaceId,
        form,
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
            {/* Name */}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium"
              >
                Name
              </label>

              <input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Meeting Room A"
                required
                className="h-11 w-full rounded-md border px-3 outline-none focus:ring-2"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label
                htmlFor="type"
                className="text-sm font-medium"
              >
                Type
              </label>

              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border bg-background px-3 outline-none focus:ring-2"
              >
                <option value="">
                  Select type
                </option>

                <option value="meeting_room">
                  Meeting Room
                </option>

                <option value="private_office">
                  Private Office
                </option>

                <option value="desk">
                  Desk
                </option>

                <option value="hot_desk">
                  Hot Desk
                </option>

                <option value="conference_room">
                  Conference Room
                </option>
              </select>
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <label
                htmlFor="capacity"
                className="text-sm font-medium"
              >
                Capacity
              </label>

              <input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border px-3 outline-none focus:ring-2"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label
                htmlFor="price"
                className="text-sm font-medium"
              >
                Price
              </label>

              <input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border px-3 outline-none focus:ring-2"
              />
            </div>

            {/* Pricing unit */}
            <div className="space-y-2">
              <label
                htmlFor="pricing_unit"
                className="text-sm font-medium"
              >
                Pricing Unit
              </label>

              <select
                id="pricing_unit"
                name="pricing_unit"
                value={form.pricing_unit}
                onChange={handleChange}
                required
                className="h-11 w-full rounded-md border bg-background px-3 outline-none focus:ring-2"
              >
                <option value="">
                  Select pricing unit
                </option>

                <option value="hour">
                  Hour
                </option>

                <option value="day">
                  Day
                </option>

                <option value="month">
                  Month
                </option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label
                htmlFor="status"
                className="text-sm font-medium"
              >
                Status
              </label>

              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="h-11 w-full rounded-md border bg-background px-3 outline-none focus:ring-2"
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>

                <option value="maintenance">
                  Maintenance
                </option>
              </select>
            </div>

            {/* Submit */}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-xl bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-md shadow-[#176b4d]/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#125a40] hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Resource"}
              </button>
            </div>
          </form>
        </div>
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
                className="rounded-xl border p-5"
              >
                <div className="flex items-start justify-between gap-4">
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

                {canManage && <div className="mt-5 border-t pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(resource.id)
                    }
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-4 focus-visible:ring-red-500/20"
                  >
                    Delete
                  </button>
                </div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
