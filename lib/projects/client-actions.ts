"use client";
export async function projectAction(action: string, input: Record<string, unknown>) {
  const response = await fetch(`/api/projects/actions/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not save this project action.");
  if (action === "select" || action === "create" || action === "archive" || action === "restore") window.dispatchEvent(new Event("siteledger-project-change"));
  return data;
}
