import snapshot from "./demo-documents.json";
import type { ReportView } from "../reports/model";
import type { DisputeLog } from "../log/data";
export const demoReport = snapshot.report as unknown as ReportView;
export const demoLog = snapshot.log as unknown as DisputeLog;
