import { boqImportApi } from "@/lib/projects/boq-import-api";
export const POST = (request: Request) => boqImportApi(request, true);
