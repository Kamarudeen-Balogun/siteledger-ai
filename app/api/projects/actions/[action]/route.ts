import { projectApi } from "@/lib/projects/api";
export async function POST(request: Request,context: {params: Promise<{action: string}>}) { return projectApi(request,(await context.params).action); }
