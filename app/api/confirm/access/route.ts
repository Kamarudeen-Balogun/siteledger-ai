import { accountApi } from "@/lib/auth/api";
// Older menu launches now use the same authenticated account boundary.
export const POST = (request: Request) => accountApi(request, "telegram");
