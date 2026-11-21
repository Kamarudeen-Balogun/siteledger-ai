import { reserveWeb } from "@/lib/web/api";
export async function POST(request:Request) {return reserveWeb(request);}
