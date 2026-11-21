import "server-only";
import { accountForHash, requestSessionHash, secretHash, sessionToken } from "../auth/session";
import { privateHeaders } from "../auth/api";
import { AccountError } from "../auth/provider";
import { emailAddress } from "../auth/types";
import { UUID } from "../confirm/access";
import { validCurrency } from "../costing/format-money";
import { intakeRpc } from "../telegram/storage";
import { projectText, validTimezone } from "./types";
import { smallJson } from "../auth/request";
const shapes: Record<string,string[]> = {
  create: ["name","client","location","contract_sum","currency","timezone"], select: ["project_id"],
  archive: ["project_id"], restore: ["project_id"], invite: ["project_id","email","role"], cancel_invite: ["project_id","invitation_id"],
  accept_invite: ["secret"], change_role: ["project_id","profile_id","role"], remove_member: ["project_id","profile_id"],
  start_transfer: ["project_id","profile_id"], accept_transfer: ["project_id","transfer_id"],
};
export function checkedProject<T>(value: T | null): T {
  if (!value) throw new AccountError("Project unavailable.",404);
  if (typeof value === "object" && "error" in value) {
    const errors: Record<string,[string,number]> = {
      archived: ["This project is archived. Existing records are preserved; the owner can restore it.",409],
      confirm_name: ["Confirm your professional name on the account page first.",409],
      verify_email: ["Prove ownership of your account email before accepting this invitation.",403],
      reauthenticate: ["Confirm your password on the account page before transferring ownership.",401],
      owner_transfer_required: ["Transfer ownership to an active member before removing or downgrading the owner.",409],
      already_member: ["You already have an active membership. The owner can change its role separately.",409],
      rate_limited: ["Too many attempts. Wait a little and try again.",429],
      invalid_project: ["Check the project name, client, location, amount, currency and timezone.",422],
      invalid_invite: ["Enter an email and select foreman or PM.",422],
    };
    const [message,status] = errors[String(value.error)] ?? ["This action is unavailable. Check your access or start a fresh invitation.",404];
    throw new AccountError(message,status);
  }
  return value;
}
function id(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) throw new AccountError("Project action unavailable.",404); return value; }
export async function projectApi(request: Request,action: string): Promise<Response> {
  try {
    if (!Object.hasOwn(shapes,action)) throw new AccountError("Project action unavailable.",404);
    if (!process.env.SITELEDGER_APP_URL || request.headers.get("origin")!==new URL(process.env.SITELEDGER_APP_URL).origin) throw new AccountError("Open this action on SiteLedger.",403);
    const input = await smallJson(request);
    if (Object.keys(input).some(key=>!shapes[action].includes(key))) throw new AccountError("Check the project details.",422);
    const hash=requestSessionHash(request),actor=await accountForHash(hash);
    if (!actor) throw new AccountError("Sign in to continue.",401);
    if (!await intakeRpc("account_limit",{p_key:"project-action:"+actor.profile_id,p_max:100,p_seconds:600})) throw new AccountError("Too many attempts. Wait a little and try again.",429);
    let result: unknown;
    if (action==="create") {
      const name=projectText(input.name),client=projectText(input.client),location=projectText(input.location);
      if (!name || !client || !location || typeof input.contract_sum!=="string" || !/^[0-9]+(\.[0-9]+)?$/.test(input.contract_sum) || input.contract_sum.length>40
        || !validCurrency(input.currency) || !validTimezone(input.timezone)) throw new AccountError("Enter project details, a decimal contract amount, currency and timezone.",422);
      result=await intakeRpc("account_create_project",{p_hash:hash,p_name:name,p_client:client,p_location:location,p_contract:input.contract_sum,p_currency:input.currency,p_timezone:input.timezone});
    } else if (action==="accept_invite") {
      if (typeof input.secret!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(input.secret)) throw new AccountError("This invitation is unavailable.",404);
      result=await intakeRpc("account_accept_invite",{p_hash:hash,p_secret_hash:secretHash(input.secret)});
    } else {
      const project=id(input.project_id);
      if (action==="select") result=await intakeRpc("account_select_project",{p_hash:hash,p_project:project});
      else if (action==="archive" || action==="restore") result=await intakeRpc("account_archive_project",{p_hash:hash,p_project:project,p_archive:action==="archive"});
      else if (action==="invite") {
        const email=emailAddress(input.email),secret=sessionToken();
        if (!email || (input.role!=="foreman" && input.role!=="pm")) throw new AccountError("Enter an email and select foreman or PM.",422);
        const invitation=checkedProject(await intakeRpc<Record<string,unknown>>("account_invite",{p_hash:hash,p_project:project,p_email:email,p_role:input.role,p_secret_hash:secretHash(secret)}));
        result={...invitation,url:new URL(`/invite#secret=${secret}`,process.env.SITELEDGER_APP_URL).toString()};
      } else if (action==="cancel_invite") result=await intakeRpc("account_cancel_invite",{p_hash:hash,p_project:project,p_invite:id(input.invitation_id)});
      else if (action==="change_role" || action==="remove_member") {
        if (action==="change_role" && input.role!=="foreman" && input.role!=="pm") throw new AccountError("Select foreman or PM.",422);
        result=await intakeRpc("account_manage_member",{p_hash:hash,p_project:project,p_profile:id(input.profile_id),p_role:action==="change_role"?input.role:null,p_remove:action==="remove_member"});
      } else if (action==="start_transfer") result=await intakeRpc("account_start_transfer",{p_hash:hash,p_project:project,p_target:id(input.profile_id)});
      else if (action==="accept_transfer") result=await intakeRpc("account_accept_transfer",{p_hash:hash,p_project:project,p_transfer:id(input.transfer_id)});
    }
    return Response.json(checkedProject(result),{headers:privateHeaders});
  } catch(error) { return Response.json({error:error instanceof AccountError?error.message:"Could not save this project action. Your existing records are preserved."},
    {status:error instanceof AccountError?error.status:error instanceof SyntaxError?422:503,headers:privateHeaders}); }
}
