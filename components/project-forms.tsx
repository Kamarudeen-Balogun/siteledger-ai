"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useState, type FormEvent } from "react";
import { type PrivateProject } from "@/lib/projects/types";
import type { ProjectTeam } from "@/lib/projects/data";
import { displayTimestamp } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { useActionConfirmation } from "./action-confirmation";
import { projectAction } from "@/lib/projects/client-actions";
export { projectAction } from "@/lib/projects/client-actions";
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
const button = "min-h-12 border border-ink px-5 py-3 text-base disabled:opacity-50";
const primary = `${button} border-accent bg-accent text-white`;
function Feedback({error,message}:{error:string;message?:string}) { return error||message?<p role={error?"alert":"status"} className={`my-5 border-l-4 p-4 leading-7 ${error?"border-amber-700 bg-amber-50 text-amber-900":"border-[#657055] bg-[#eef0e7]"}`}>{error||message}</p>:null; }
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
  return <section className="my-7 border-y border-rule py-6">{confirmation}<h2 className="font-serif text-2xl">Ownership offered to you</h2><p className="my-4 leading-7">Accepting makes you the owner and PM responsible for team access and project administration. Confirm your current password on <Link href={`/account?section=security&project=${projectId}`} className="underline">your account page</Link> first.</p>
    <Feedback error={error} />{transfers.map(transfer => <form key={transfer.id} onSubmit={event => { event.preventDefault(); void accept(transfer.id); }} className="my-5">
      <p>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(transfer.expires_at))}</p>
      <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required className="h-6 w-6 shrink-0" />I accept ownership of this project.</label><button className={primary} disabled={busy}>Accept ownership</button>
    </form>)}</section>;
}
export function ProjectSelection({projects,active}:{projects:PrivateProject[];active:string|null}) {
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(""),[archived,setArchived]=useState(false);
  const available=projects.filter(project=>Boolean(project.archived_at)===archived), archivedCount=projects.filter(project=>project.archived_at).length;
  async function open(project:string){setBusy(project);setError("");try{await projectAction("select",{project_id:project});router.push(`/projects/${project}`);}catch(error){setError(error instanceof Error?error.message:"Could not open this project.");}finally{setBusy("");}}
  return <section className="project-list" aria-labelledby="project-list-title"><div className="project-list-heading"><div><h1 id="project-list-title" className="font-serif text-3xl">Your projects</h1><p className="mt-2 leading-7">Open a site to continue its work.</p></div><Link href="/projects?view=create" prefetch={false} className="work-button work-button-primary">New project</Link></div>
    {archivedCount>0&&<div className="record-filters" role="group" aria-label="Project status"><button type="button" aria-pressed={!archived} onClick={()=>setArchived(false)}>Active <span>{projects.length-archivedCount}</span></button><button type="button" aria-pressed={archived} onClick={()=>setArchived(true)}>Archived <span>{archivedCount}</span></button></div>}
    {!available.length?<div className="project-empty"><h3 className="font-serif text-xl">{archived?"No archived projects":projects.length?"Your projects are archived":"Start your first project"}</h3><p className="mt-3 leading-7">{projects.length?"Open the Archived view to read previous work, or create a new project.":"Create a private site project, or accept an invitation from its owner."}</p></div>:<ul className="project-picker mt-6">{available.map(project=><li key={project.id} data-project-id={project.id}><div><p className="eyebrow">{project.role==="pm"?"PM":"Foreman"}{project.owner?" · Owner":""}{active===project.id?" · Current project":""}{project.archived_at?" · Archived":""}</p><h3 className="mt-3 font-serif text-2xl">{project.name}</h3><p className="mt-2 text-sm leading-6">{project.client} · {project.location}</p></div><button type="button" className="work-button" disabled={Boolean(busy)} onClick={()=>void open(project.id)}>{busy===project.id?"Opening…":"Open project"}<span aria-hidden="true">→</span></button></li>)}</ul>}
    <Feedback error={error}/></section>;
}
export function StartProjectNote({ id, secondary=false }: { id: string; secondary?: boolean }) {
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function start(){setBusy(true);setError("");try{await projectAction("select",{project_id:id});router.push("/today");}catch(error){setError(error instanceof Error?error.message:"Could not open this project.");}finally{setBusy(false);}}
  return <div><button type="button" className={"work-button "+(secondary?"":"work-button-primary")} disabled={busy} onClick={()=>void start()}>{busy?"Opening diary…":"Record a site note"}</button><Feedback error={error}/></div>;
}
export { CreateProject } from "./create-project";
export function TeamManagement({project,team,section="members"}:{project:PrivateProject;team:ProjectTeam;section?:"members"|"invitations"|"settings"}) {
  const { confirm, confirmation } = useActionConfirmation();
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[invite,setInvite]=useState<{url:string;expires_at:string}|null>(null),[inviting,setInviting]=useState(false);
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
    try{const result=await projectAction(action,{project_id:project.id,...input});if(action==="invite"){setInvite(result);setInviting(false);}else if(action==="start_transfer")setMessage("Ownership request saved. The selected member must sign in and accept it in this project's records.");else setMessage("Project access updated. Existing records are preserved.");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not save team access.");}finally{setBusy(false);}
  }
  function inviteMember(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void run("invite",{email:form.get("email"),role:form.get("role")});}
  return <>{confirmation}<Feedback error={error} message={message}/>
    {section==="members"&&<section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Active team</h2><ul className="mt-4">{team.members.map(member=><li key={member.profile_id} className="border-b border-rule py-5"><p className="font-semibold">{member.name??"Professional name pending"}</p><p className="my-3">{member.role==="pm"?"PM":"Foreman"}{member.owner?" / Owner":""}</p>{!member.owner&&<details className="work-disclosure"><summary>Manage access for {member.name??"this member"}</summary><div className="flex flex-wrap gap-3 p-4">
      {!project.archived_at&&<><button className={button} disabled={busy||member.role==="foreman"} onClick={()=>void run("change_role",{profile_id:member.profile_id,role:"foreman"})}>Set foreman</button><button className={button} disabled={busy||member.role==="pm"} onClick={()=>void run("change_role",{profile_id:member.profile_id,role:"pm"})}>Set PM</button></>}
      <button className={button} disabled={busy} onClick={()=>void run("remove_member",{profile_id:member.profile_id})}>Remove access</button></div></details>}</li>)}</ul></section>}
    {section==="invitations"&&<>{!project.archived_at&&!inviting&&!invite&&<button type="button" className="work-button work-button-primary mb-6" onClick={()=>setInviting(true)}>Invite a person</button>}{!project.archived_at&&(inviting||invite)&&<section className="max-w-md border-t border-rule py-6"><h2 className="font-serif text-2xl">{invite?"Invitation ready to share":"Invite a person"}</h2>{inviting&&<><p className="my-4 leading-7">Only the addressed email can accept. The link expires after 7 days.</p><form onSubmit={inviteMember}><label className="my-4 block">Recipient email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false}/></label><label className="my-4 block">Project role<select className={field} name="role" defaultValue="foreman"><option value="foreman">Foreman</option><option value="pm">PM</option></select></label><button className={primary} disabled={busy}>Create invitation</button><button type="button" className="text-link ml-4" disabled={busy} onClick={()=>setInviting(false)}>Cancel</button></form></>}{invite&&<div className="my-5"><label className="block">One-use invitation link<input className={field} value={invite.url} readOnly onFocus={event=>event.currentTarget.select()}/></label><button className={`${button} mt-3`} onClick={()=>{void navigator.clipboard.writeText(invite.url).then(()=>setMessage("Invitation link copied.")).catch(()=>setError("Select the link and copy it manually."));}}>Copy invitation</button><button type="button" className="text-link ml-4" onClick={()=>{setInvite(null);setInviting(true);setMessage("");}}>Invite another person</button><p className="mt-3">Expires {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: project.timezone }).format(new Date(invite.expires_at))}</p></div>}</section>}
    <section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Issued invitations</h2>{team.invitations.length===0?<p className="mt-4">No invitations issued.</p>:<ul>{team.invitations.map(invitation=><li key={invitation.id} className="border-b border-rule py-4"><p>{invitation.email} / {invitation.role}</p><p className="my-3">{invitation.consumed_at?"Accepted":invitation.cancelled_at?"Cancelled":invitation.expired?"Expired":"Awaiting acceptance"}</p>{!invitation.cancelled_at&&!invitation.consumed_at&&<button className={button} disabled={busy} onClick={()=>void run("cancel_invite",{invitation_id:invitation.id})}>Cancel invitation</button>}</li>)}</ul>}</section></>}
    {section==="settings"&&<><section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Project history</h2><p className="my-4 leading-7">Archive to stop new work while keeping all previous records.</p><button className={button} disabled={busy} onClick={()=>void run(project.archived_at?"restore":"archive")}>{project.archived_at?"Restore project":"Archive project"}</button></section>
    <details className="work-disclosure"><summary>Project details</summary><dl className="settings-summary px-5"><div><dt>Client</dt><dd>{project.client}</dd></div><div><dt>Location</dt><dd>{project.location}</dd></div><div><dt>Contract sum</dt><dd>{formatMoney(project.contract_sum,project.currency)} {project.currency}</dd></div><div><dt>Site dates</dt><dd>{project.timezone}</dd></div><div><dt>Project reference</dt><dd>{project.project_code}</dd></div></dl></details>
    <details className="work-disclosure" id="ownership"><summary>Transfer ownership</summary><div className="p-5"><p className="leading-7">Offer ownership to an existing active member. You remain owner until they accept.</p>{team.members.some(member=>!member.owner)?<><Link href={`/account?section=security&project=${project.id}`} className="text-link my-4">Confirm website access</Link><form onSubmit={event=>{event.preventDefault();void run("start_transfer",{profile_id:new FormData(event.currentTarget).get("profile_id")});}}><label className="block">New owner<select aria-label="New owner" name="profile_id" required className={field} defaultValue=""><option value="" disabled>Choose an active member</option>{team.members.filter(member=>!member.owner).map(member=><option key={member.profile_id} value={member.profile_id}>{member.name} · {member.role==="pm"?"PM":"Foreman"}</option>)}</select></label><button className="work-button mt-5" disabled={busy}>Request ownership transfer</button></form></>:<p className="mt-4 leading-7">Invite a member first, then return here once they accept.</p>}</div></details>
    <details className="work-disclosure"><summary>Administrative history</summary><ol className="p-5">{team.events.map(event=><li key={event.id} className="border-b border-rule py-4"><p>{event.action.replace(/_/g," ")}</p><p className="mt-2 font-mono text-sm">{displayTimestamp(event.timestamp,project.timezone)}</p></li>)}</ol></details></>}
    {section==="members"&&<details className="work-disclosure"><summary>What can each role do?</summary><div className="p-5 space-y-3 leading-7"><p><strong>Foreman:</strong> record work and review their own notes.</p><p><strong>PM:</strong> review project work, manage the BoQ and approve reports.</p><p>The owner manages invitations, membership and project settings. Ownership transfer is in Settings.</p></div></details>}
  </>;
}
