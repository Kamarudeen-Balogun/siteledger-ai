"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useState, type FormEvent } from "react";
import { formatMoney, projectCurrencies } from "@/lib/costing/format-money";
import { projectTimezones, type PrivateProject } from "@/lib/projects/types";
import type { ProjectTeam } from "@/lib/projects/data";
import { displayTimestamp } from "@/lib/reports/model";
import { useActionConfirmation } from "./action-confirmation";
const field = "mt-2 min-h-12 w-full border border-rule bg-white px-3 py-3 text-base";
const button = "min-h-12 border border-ink px-5 py-3 text-base disabled:opacity-50";
const primary = `${button} border-accent bg-accent text-white`;
export async function projectAction(action: string,input: Record<string,unknown>) {
  const response=await fetch(`/api/projects/actions/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),cache:"no-store"});
  const data=await response.json();if (!response.ok) throw new Error(data.error??"Could not save this project action.");return data;
}
function Feedback({error,message}:{error:string;message?:string}) { return error||message?<p role={error?"alert":"status"} className={`my-5 border-l-4 p-4 leading-7 ${error?"border-[#B91C1C] text-[#B91C1C]":"border-accent"}`}>{error||message}</p>:null; }
const subscribeInvite = (change: () => void) => { window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); };
export function InvitationAcceptance({ verified, nameConfirmed }: { verified: boolean; nameConfirmed: boolean }) {
  const { confirm, confirmation } = useActionConfirmation();
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const secret = useSyncExternalStore(subscribeInvite, () => new URLSearchParams(window.location.hash.slice(1)).get("secret") ?? "", () => "");
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!await confirm({title:"Join the invited project?",description:"Your verified email must match the invitation. You will receive the role chosen by its owner.",confirmLabel:"Accept invitation"})) return;
    setBusy(true); setError("");
    try { const result = await projectAction("accept_invite", { secret }); window.history.replaceState(null, "", "/invite"); router.push(`/projects/${result.project_id}`); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "This invitation is unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="my-7 max-w-md border-t border-rule pt-6">{confirmation}
    {!secret ? <p>Open the complete invitation link you received from the project owner.</p> : <form onSubmit={accept}>
      <p className="leading-7">A forwarded, cancelled, expired or already used invitation cannot grant access. Your verified email must match its recipient.</p>
      {!nameConfirmed && <Link href="/account" className="my-4 flex min-h-12 items-center underline">Confirm your professional name first</Link>}
      <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required className="h-6 w-6 shrink-0" />I want to join the project through this invitation.</label>
      <Feedback error={error} /><button className={primary} disabled={busy || !verified || !nameConfirmed}>{busy ? "Checking invitation…" : "Accept invitation"}</button>
    </form>}
  </section>;
}
export function OwnershipAcceptance({ projectId, transfers, timezone }: { projectId: string; transfers: { id: string; expires_at: string }[]; timezone: string }) {
  const { confirm, confirmation } = useActionConfirmation();
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function accept(id: string) { if (!await confirm({title:"Accept project ownership?",description:"You will become the owner and PM, responsible for membership and project administration. Existing records and attribution stay unchanged.",confirmLabel:"Accept ownership"})) return; setBusy(true); setError(""); try { await projectAction("accept_transfer", { project_id: projectId, transfer_id: id }); router.refresh(); } catch(error) { setError(error instanceof Error ? error.message : "Could not accept ownership."); } finally { setBusy(false); } }
  if (!transfers.length) return null;
  return <section className="my-7 border-y border-rule py-6">{confirmation}<h2 className="font-serif text-2xl">Ownership offered to you</h2><p className="my-4 leading-7">Accepting makes you the owner and PM responsible for team access and project administration. Confirm your current password on <Link href="/account" className="underline">your account page</Link> first.</p>
    <Feedback error={error} />{transfers.map(transfer => <form key={transfer.id} onSubmit={event => { event.preventDefault(); void accept(transfer.id); }} className="my-5">
      <p>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(transfer.expires_at))}</p>
      <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required className="h-6 w-6 shrink-0" />I accept ownership of this project.</label><button className={primary} disabled={busy}>Accept ownership</button>
    </form>)}</section>;
}
export function ProjectSelection({projects,active}:{projects:PrivateProject[];active:string|null}) {
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState("");
  async function select(project:string) {setBusy(project);setError("");try {await projectAction("select",{project_id:project});router.push("/today");}catch(error){setError(error instanceof Error?error.message:"Could not select this project.");}finally{setBusy("");}}
  return <section className="mt-7"><h2 className="font-serif text-2xl">Your authorized projects</h2>{projects.length===0?<p className="my-5 leading-7">No projects yet. Create your own project or accept an invitation addressed to your email.</p>:<ul className="mt-5 border-t border-rule">{projects.map(project=><li key={project.id} className="border-b border-rule py-6">
    <p className="font-mono text-sm">{project.currency} / {project.role==="pm"?"PM":"Foreman"}{project.owner?" / Owner":""}{active===project.id?" / Selected":""}{project.archived_at?" / Archived":""}</p><h3 className="mt-3 font-serif text-2xl">{project.name}</h3><p className="mt-2 leading-7">{project.client} · {project.location}</p><p className="mt-2">Contract sum {formatMoney(project.contract_sum,project.currency)} {project.currency}</p><p className="mt-2 font-mono text-sm">{project.timezone}</p>
    <div className="mt-4 flex flex-wrap gap-3"><Link href={`/projects/${project.id}`} className={button}>Open project records</Link>{!project.archived_at&&<button disabled={Boolean(busy)} onClick={()=>void select(project.id)} className={primary}>{busy===project.id?"Opening…":"Record on this project"}</button>}{project.owner&&<Link href={`/projects/${project.id}/team`} className={button}>Manage team</Link>}</div>
  </li>)}</ul>}<Feedback error={error}/></section>;
}
export function CreateProject() {
  const { confirm, confirmation } = useActionConfirmation();
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);
    if (!await confirm({title:"Create this private project?",description:"You start as its owner and PM. Its currency and timezone stay fixed to protect recorded money and site dates.",confirmLabel:"Create project",detail:<><p className="font-semibold">{String(form.get("name"))}</p><p>{String(form.get("currency"))} · {String(form.get("timezone"))}</p><p>Client: {String(form.get("client"))}</p></>})) return;
    setBusy(true);setError("");try{const result=await projectAction("create",Object.fromEntries(["name","client","location","contract_sum","currency","timezone"].map(key=>[key,form.get(key)])));router.push(`/projects/${result.id}`);}catch(error){setError(error instanceof Error?error.message:"Could not create your project.");}finally{setBusy(false);}}
  return <section className="mt-10 max-w-lg border-t border-rule pt-7">{confirmation}<h2 className="font-serif text-2xl">Create a private project</h2><p className="my-4 leading-7">You begin as its owner and PM. Choose the currency for your supplied BoQ rates and the timezone for site dates.</p><form onSubmit={submit}>
    <label className="my-4 block">Project name<input className={field} name="name" required maxLength={200}/></label><label className="my-4 block">Client<input className={field} name="client" required maxLength={200}/></label><label className="my-4 block">Site location<input className={field} name="location" required maxLength={200}/></label>
    <label className="my-4 block">Contract sum<input className={field} name="contract_sum" required inputMode="decimal" pattern="[0-9]+([.][0-9]+)?" maxLength={40}/></label>
    <label className="my-4 block">Project currency<select className={field} name="currency" defaultValue="NGN" required>{projectCurrencies.map(code=><option key={code}>{code}</option>)}</select></label><label className="my-4 block">Site timezone<select className={field} name="timezone" defaultValue="Africa/Lagos" required>{projectTimezones.map(zone=><option key={zone}>{zone}</option>)}</select></label>
    <p className="my-4 leading-7">Your project starts with an empty BoQ. Demo rates are illustrative and are never converted into another currency.</p><Feedback error={error}/><button className={primary} disabled={busy}>{busy?"Creating…":"Create project"}</button></form></section>;
}
export function TeamManagement({project,team}:{project:PrivateProject;team:ProjectTeam}) {
  const { confirm, confirmation } = useActionConfirmation();
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[invite,setInvite]=useState<{url:string;expires_at:string}|null>(null);
  async function run(action:string,input:Record<string,unknown>={}) {
    const person=team.members.find(member=>member.profile_id===input.profile_id)?.name??"this person";
    const recipient=String(input.email??team.invitations.find(item=>item.id===input.invitation_id)?.email??"the recipient");
    const prompts:Record<string,{title:string;description:string;confirmLabel:string;danger?:boolean}> = {
      invite:{title:"Create this invitation?",description:`Invite ${recipient} as ${input.role==="pm"?"PM":"Foreman"}. Only that verified email can accept it, once, within seven days.`,confirmLabel:"Create invitation"},
      cancel_invite:{title:"Cancel this invitation?",description:`The invitation for ${recipient} will stop granting access. You can issue a fresh one later.`,confirmLabel:"Cancel invitation",danger:true},
      change_role:{title:`Change ${person}'s role?`,description:input.role==="pm"?"PM access includes reviewing project work and approving reports. Team administration remains with the owner.":"Foreman access covers their own records. Approval and access to others' private records will stop immediately.",confirmLabel:input.role==="pm"?"Set PM":"Set foreman"},
      remove_member:{title:`Remove access for ${person}?`,description:"They will lose project, report, PDF and media access. Their recorded work stays preserved; queued work cannot send until access is restored.",confirmLabel:"Remove access",danger:true},
      start_transfer:{title:`Offer ownership to ${person}?`,description:"You stay owner until this active member accepts. They will become owner and PM; the original records and signatures stay unchanged.",confirmLabel:"Request ownership transfer"},
      archive:{title:"Archive this project?",description:"New intake, confirmation, approval, amendments and invitations will stop. Authorized members keep access to old records, and you can restore the project.",confirmLabel:"Archive project",danger:true},
      restore:{title:"Restore this project?",description:"Active members can record work again with their existing roles. Queued files still need authorization for their original project.",confirmLabel:"Restore project"},
    };
    const prompt=prompts[action];
    if(prompt&&!await confirm({...prompt,detail:<p className="font-semibold">{project.name}</p>}))return;
    setBusy(true);setError("");setMessage("");
    try{const result=await projectAction(action,{project_id:project.id,...input});if(action==="invite")setInvite(result);else if(action==="start_transfer")setMessage("Ownership request saved. The selected member must sign in and accept it in this project's records.");else setMessage("Project access updated. Existing records are preserved.");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not save team access.");}finally{setBusy(false);}
  }
  function inviteMember(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void run("invite",{email:form.get("email"),role:form.get("role")});}
  return <>{confirmation}<p className="my-5 leading-7">Only the owner manages membership, invitations and ownership. PM review rights do not grant team administration.</p><Feedback error={error} message={message}/>
    <section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Active team</h2><ul className="mt-4">{team.members.map(member=><li key={member.profile_id} className="border-b border-rule py-5"><p className="font-semibold">{member.name??"Professional name pending"}</p><p className="my-3">{member.role==="pm"?"PM":"Foreman"}{member.owner?" / Owner":""}</p>{!member.owner&&<div className="flex flex-wrap gap-3">
      {!project.archived_at&&<><button className={button} disabled={busy||member.role==="foreman"} onClick={()=>void run("change_role",{profile_id:member.profile_id,role:"foreman"})}>Set foreman</button><button className={button} disabled={busy||member.role==="pm"} onClick={()=>void run("change_role",{profile_id:member.profile_id,role:"pm"})}>Set PM</button></>}
      <button className={button} disabled={busy} onClick={()=>void run("remove_member",{profile_id:member.profile_id})}>Remove access</button><button className={button} disabled={busy} onClick={()=>void run("start_transfer",{profile_id:member.profile_id})}>Request ownership transfer</button></div>}</li>)}</ul></section>
    {!project.archived_at&&<section className="max-w-md border-t border-rule py-6"><h2 className="font-serif text-2xl">Invite a person</h2><p className="my-4 leading-7">The invitation is addressed to one email, expires after seven days and can be accepted once. Copy and send the link to that person.</p><form onSubmit={inviteMember}><label className="my-4 block">Recipient email<input className={field} name="email" type="email" required maxLength={254}/></label><label className="my-4 block">Project role<select className={field} name="role" defaultValue="foreman"><option value="foreman">Foreman</option><option value="pm">PM</option></select></label><button className={primary} disabled={busy}>Create invitation</button></form>{invite&&<div className="my-5"><label className="block">One-use invitation link<input className={field} value={invite.url} readOnly onFocus={event=>event.currentTarget.select()}/></label><button className={`${button} mt-3`} onClick={()=>{void navigator.clipboard.writeText(invite.url).then(()=>setMessage("Invitation link copied.")).catch(()=>setError("Select the link and copy it manually."));}}>Copy invitation</button><p className="mt-3">Expires {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: project.timezone }).format(new Date(invite.expires_at))}</p></div>}</section>}
    <section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Issued invitations</h2>{team.invitations.length===0?<p className="mt-4">No invitations issued.</p>:<ul>{team.invitations.map(invitation=><li key={invitation.id} className="border-b border-rule py-4"><p>{invitation.email} / {invitation.role}</p><p className="my-3">{invitation.consumed_at?"Accepted":invitation.cancelled_at?"Cancelled":invitation.expired?"Expired":"Awaiting acceptance"}</p>{!invitation.cancelled_at&&!invitation.consumed_at&&<button className={button} disabled={busy} onClick={()=>void run("cancel_invite",{invitation_id:invitation.id})}>Cancel invitation</button>}</li>)}</ul>}</section>
    <section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Project history</h2><p className="my-4 leading-7">Archiving blocks new work and keeps authorized access to every old report, photo and amendment. You can still remove access.</p><button className={button} disabled={busy} onClick={()=>void run(project.archived_at?"restore":"archive")}>{project.archived_at?"Restore project":"Archive project"}</button></section>
    <section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Administrative history</h2><ol className="mt-5">{team.events.map(event=><li key={event.id} className="border-b border-rule py-4"><p>{event.action.replace(/_/g," ")}</p><p className="mt-2 font-mono text-sm">{displayTimestamp(event.timestamp,project.timezone)}</p></li>)}</ol></section>
    <p className="mt-6 leading-7">Ownership transfer needs recent password authentication. <Link href="/account" className="underline">Confirm your password on your account page</Link> before requesting it.</p>
  </>;
}
