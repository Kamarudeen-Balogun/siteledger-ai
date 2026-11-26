import "server-only";
import { intakeRpc } from "../telegram/storage";
export type FeedbackItem = {id:string;name:string;kind:string;message:string;status:string;date:string;project:string|null;has_photo:boolean;replies:{text:string;date:string}[]};
export function feedbackData(hash:string) {
  return intakeRpc<{admin:boolean;items:FeedbackItem[]}|null>("account_feedback",{p_hash:hash,p_admin_email:process.env.SITELEDGER_FEEDBACK_OWNER_EMAIL??""});
}
