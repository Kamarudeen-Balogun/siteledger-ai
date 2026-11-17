import "server-only";

export type ProjectSummary = {
  id: string;
  project_code: string;
  name: string;
  client: string;
  location: string;
  contract_sum: number;
  is_demo: boolean;
  locked_report_count: number;
  cumulative_cost: number;
  latest_report_date: string | null;
  overrun_item_count: number;
  amendment_count: number;
};

export type BoqProgress = {
  boq_item_id: string;
  project_id: string;
  item_code: string;
  section: string;
  description: string;
  unit: "m3" | "m2" | "tonne" | "point" | "day";
  boq_quantity: number;
  rate: number;
  cumulative_quantity: number;
  recorded_cost: number;
  percentage_complete: number;
  is_overrun: boolean;
};

export class ProjectDataUnavailableError extends Error {
  constructor() {
    super("Project data is currently unavailable.");
    this.name = "ProjectDataUnavailableError";
  }
}

async function readRows<T>(view: string, query: URLSearchParams): Promise<T[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new ProjectDataUnavailableError();
  }

  const url = new URL(`/rest/v1/${view}`, supabaseUrl);
  url.search = query.toString();

  try {
    const response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new ProjectDataUnavailableError();
    return (await response.json()) as T[];
  } catch {
    // Keep keys, database errors, and connection details out of public responses.
    throw new ProjectDataUnavailableError();
  }
}

export async function getDemoProjectSummary(projectCode: string) {
  const projects = await readRows<ProjectSummary>(
    "project_summary",
    new URLSearchParams({
      select: "*",
      project_code: `eq.${projectCode}`,
      is_demo: "eq.true",
      limit: "1",
    }),
  );
  const project = projects[0];
  if (!project) return null;

  const boqItems = await readRows<BoqProgress>(
    "boq_progress",
    new URLSearchParams({
      select: "*",
      project_id: `eq.${project.id}`,
      order: "item_code.asc",
    }),
  );

  return { project, boq_items: boqItems };
}
