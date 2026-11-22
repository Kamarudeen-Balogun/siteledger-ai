import { boqApi } from "@/lib/projects/boq-api";
export async function POST(request: Request) { return boqApi(request); }
