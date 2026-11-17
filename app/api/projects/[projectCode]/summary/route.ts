import { getDemoProjectSummary } from "@/lib/data/project-summary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectCode: string }> },
) {
  const { projectCode } = await params;
  if (!/^[A-Z0-9-]{1,40}$/.test(projectCode)) {
    return Response.json({ error: "Invalid project code." }, { status: 400 });
  }

  try {
    const data = await getDemoProjectSummary(projectCode);
    if (!data) {
      return Response.json({ error: "Demo project not found." }, { status: 404 });
    }
    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Project data is currently unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
