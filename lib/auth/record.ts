import "server-only";
import { currentSessionHash } from "./session";
import { intakeRpc } from "../telegram/storage";
import { UUID } from "../confirm/access";
export type RecordActor = { profile_id: string; professional_name: string; role: "foreman"|"pm"; project_id: string; currency: string; timezone: string; archived_at: string|null; error?: string };
export async function recordActor(id: string, hash?: string, write=false): Promise<RecordActor|null> {
  if (!UUID.test(id)) return null;
  const access=hash??await currentSessionHash();
  if (!/^[a-f0-9]{64}$/.test(access)) return null;
  return intakeRpc("account_record_access",{p_hash:access,p_id:id,p_write:write});
}
