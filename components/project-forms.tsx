"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { type PrivateProject } from "@/lib/projects/types";
import type { ProjectTeam } from "@/lib/projects/data";
import { displayTimestamp, formatMoneyLabel } from "@/lib/reports/model";
import { formatMoney } from "@/lib/costing/format-money";
import { useActionConfirmation } from "./action-confirmation";
import { projectAction } from "@/lib/projects/client-actions";
import { permissionKeys, permissionLabels, projectRoles } from "@/lib/projects/permissions";
import { DiaryIcon } from "./diary-icon";
export { projectAction } from "@/lib/projects/client-actions";
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
const button = "min-h-12 border border-ink px-5 py-3 text-base disabled:opacity-50";
const primary = `${button} border-accent bg-accent text-white`;
function Feedback({error,message}:{error:string;message?:string}) { return error||message?<p role={error?"alert":"status"} className={`my-5 border-l-4 p-4 leading-7 ${error?"border-amber-700 bg-amber-50 text-amber-900":"border-[#657055] bg-[#eef0e7]"}`}>{error||message}</p>:null; }
export function InvitationAcceptance({ verified, nameConfirmed }: { verified: boolean; nameConfirmed: boolean }) {
  const { confirm, confirmation } = useActionConfirmation();
  const router = useRouter(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const secret=String(new FormData(event.currentTarget).get("code")??"").trim();
    if (!await confirm({title:"Join the invited project?",description:"Your verified email must match the invitation. You will receive the role chosen by its owner.",confirmLabel:"Accept invitation"})) return;
    setBusy(true); setError("");
    try { const result = await projectAction("accept_invite", { secret }); window.history.replaceState(null, "", "/invite"); router.push(`/projects/${result.project_id}`); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "This invitation is unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="my-7 max-w-md border-t border-rule pt-6">{confirmation}
    <form onSubmit={accept}>
      <label className="mb-4 block">Invitation code<input name="code" className={field} required minLength={43} maxLength={43} autoComplete="off" spellCheck={false}/></label>
      {!nameConfirmed && <Link href="/account" className="my-4 flex min-h-12 items-center underline">Confirm your professional name first</Link>}
      <label className="my-4 flex min-h-12 items-center gap-3"><input type="checkbox" required className="h-6 w-6 shrink-0" />I want to join the project through this invitation.</label>
      <Feedback error={error} /><button className={primary} disabled={busy || !verified || !nameConfirmed}>{busy ? "Checking invitation…" : "Accept invitation"}</button>
    </form>
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
export function ProjectSelection({projects,active,returnToToday=false}:{projects:PrivateProject[];active:string|null;returnToToday?:boolean}) {
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(""),[archived,setArchived]=useState(false);
  const available=projects.filter(project=>Boolean(project.archived_at)===archived), archivedCount=projects.filter(project=>project.archived_at).length;
  async function open(project:string){setBusy(project);setError("");try{await projectAction("select",{project_id:project});router.push(returnToToday?"/today":`/projects/${project}`);}catch(error){setError(error instanceof Error?error.message:"Could not open this project.");}finally{setBusy("");}}
  return <section className="stitch-project-list" aria-labelledby="project-list-title"><div className="stitch-title-row"><h1 id="project-list-title" className="stitch-section-title">Your projects</h1><Link href="/projects?view=create" prefetch={false} className="stitch-button" data-primary><DiaryIcon name="plus" size={18}/>New project</Link></div>
    {archivedCount>0&&<div className="record-filters" role="group" aria-label="Project status"><button type="button" aria-pressed={!archived} onClick={()=>setArchived(false)}>Active <span>{projects.length-archivedCount}</span></button><button type="button" aria-pressed={archived} onClick={()=>setArchived(true)}>Archived <span>{archivedCount}</span></button></div>}
    {!available.length?<div className="stitch-card"><h2>{archived?"No archived projects":projects.length?"Your projects are archived":"Start your first project"}</h2><p>{projects.length?"Open the Archived view to read previous work, or create a new project.":"Create a private site project, or accept an invitation from its owner."}</p></div>:<ul className="stitch-menu-list">{available.map(project=><li key={project.id} data-project-id={project.id}><button type="button" className="stitch-menu-row" disabled={Boolean(busy)} onClick={()=>void open(project.id)}><DiaryIcon name="building"/><span><strong>{project.name}</strong><small>{project.client} · {project.location}</small><small>{project.role_label??(project.role==="pm"?"PM/QS":"Foreman")}{active===project.id?" · Current project":""}</small></span>{busy===project.id?"Opening…":<DiaryIcon name="chevron"/>}</button></li>)}</ul>}
    <Feedback error={error}/></section>;
}
export function StartProjectNote({ id, secondary=false }: { id: string; secondary?: boolean }) {
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function start(){setBusy(true);setError("");try{await projectAction("select",{project_id:id});router.push("/today?capture=1");}catch(error){setError(error instanceof Error?error.message:"Could not open this project.");}finally{setBusy(false);}}
  return <div><button type="button" className={"work-button "+(secondary?"":"work-button-primary")} disabled={busy} onClick={()=>void start()}>{busy?"Opening diary…":"Record a site note"}</button><Feedback error={error}/></div>;
}
export { CreateProject } from "./create-project";
export function TeamManagement({project,team,section="members"}:{project:PrivateProject;team:ProjectTeam;section?:"members"|"invitations"|"settings"}) {
  const { confirm, confirmation } = useActionConfirmation();
  const router=useRouter(),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[inviting,setInviting]=useState(false);
  const inviteSheet=useRef<HTMLDialogElement>(null);
  const mayInvite=(project.owner||project.permissions?.invite_members)&&!project.archived_at;
  const roles=[...projectRoles,...(team.roles??[])];
  async function run(action:string,input:Record<string,unknown>={}) {
    const person=team.members.find(member=>member.profile_id===input.profile_id)?.name??"this person";
    const recipient=String(input.email??team.invitations.find(item=>item.id===input.invitation_id)?.email??"the recipient");
    const prompts:Record<string,{title:string;description:string;confirmLabel:string;danger?:boolean}> = {
      invite:{title:"Send this invitation?",description:`Invite ${recipient} as ${input.role}.`,confirmLabel:"Send invitation"},
      resend_invite:{title:"Resend this invitation?",description:`Send a fresh code to ${recipient}.`,confirmLabel:"Resend email"},
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
    try{await projectAction(action,{project_id:project.id,...input});if(action==="invite"||action==="resend_invite"){setMessage("Invitation sent.");setInviting(false);inviteSheet.current?.close();}else if(action==="start_transfer")setMessage("Ownership request sent. The selected member can accept it in the project.");else setMessage("Project access updated.");router.refresh();}
    catch(error){setError(error instanceof Error?error.message:"Could not save team access.");}finally{setBusy(false);}
  }
  function inviteMember(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);void run("invite",{email:form.get("email"),role:form.get("role")});}
  return <>{confirmation}<Feedback error={error} message={message}/>
    {section==="members"&&<section className="stitch-team-members" data-tour="team-members">
      <div className="stitch-title-row"><div><h2 className="stitch-section-title">Site Team &amp; Access</h2><p>Who can see and change things on this project</p></div>{mayInvite&&<button type="button" className="stitch-button" data-tour="invite" onClick={()=>{setError("");inviteSheet.current?.showModal();}}><DiaryIcon name="invite" size={18}/>Invite</button>}</div>
      <p className="stitch-menu-row mt-3"><DiaryIcon name="verified" size={18}/><span><strong>Shared with the project team</strong><small>Members can open approved records according to their project permissions.</small></span></p>
      {mayInvite&&<dialog ref={inviteSheet} className="action-dialog stitch-sheet" aria-label="Invite a person"><form onSubmit={inviteMember}>
        <div className="action-dialog__body"><h2>Invite a person</h2><p>They’ll receive an email with their invitation code.</p>
          <label>Recipient email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false}/></label>
          <label>Project role<select className={field} name="role" defaultValue="Foreman">{roles.map(role=><option key={role}>{role}</option>)}</select></label>
          {error&&<p role="alert">{error}</p>}
        </div>
        <div className="action-dialog__actions stitch-sheet-actions"><button type="button" className="stitch-button" disabled={busy} onClick={()=>inviteSheet.current?.close()}>Cancel</button><button className="stitch-button" data-primary disabled={busy}>Send invitation</button></div>
      </form></dialog>}
      <ul className="mt-4">{team.members.map(member=><li key={member.profile_id} className="border-b border-rule py-5">
        <div className="stitch-menu-row"><DiaryIcon name="profile"/><span><strong>{member.name??"Name pending"}</strong><small>{member.owner?"Owner":member.role_label??(member.role==="pm"?"PM/QS":"Foreman")}</small></span></div>
        {!member.owner&&project.owner&&<details className="work-disclosure" data-tour="permissions"><summary>Edit role and permissions</summary><div className="p-4">
          {!project.archived_at&&<form onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void run("member_permissions",{profile_id:member.profile_id,role:form.get("role"),permissions:Object.fromEntries(permissionKeys.map(key=>[key,form.has(key)]))});}}>
            <label className="block">Project role<select name="role" className={field} defaultValue={member.role_label??(member.role==="pm"?"PM/QS":"Foreman")}>{roles.map(role=><option key={role}>{role}</option>)}</select></label>
            <fieldset className="my-4"><legend className="font-semibold">Permissions</legend>{permissionKeys.map(key=><label key={key} className="permission-toggle"><span>{permissionLabels[key]}</span><input type="checkbox" name={key} defaultChecked={member.permissions?.[key]??false}/></label>)}</fieldset>
            <button className={primary} disabled={busy}>Save permissions</button>
          </form>}
          <button className="text-link mt-3" disabled={busy} onClick={()=>void run("remove_member",{profile_id:member.profile_id})}>Remove access</button>
        </div></details>}
      </li>)}</ul>
      {mayInvite&&<Link href={`/projects/${project.id}/team?section=invitations`} className="text-link">Manage pending invitations</Link>}
      {project.owner&&!project.archived_at&&<details className="work-disclosure"><summary>Add a custom role</summary><form className="p-4" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void run("add_role",{role:String(form.get("role")??"").trim()});}}><label className="block">Role name<input className={field} name="role" required maxLength={40}/></label><button className="work-button mt-4" disabled={busy}>Save role</button></form></details>}
    </section>}
    {section==="invitations"&&<>
      {!project.archived_at&&!inviting&&<button type="button" className="work-button work-button-primary mb-6" onClick={()=>setInviting(true)} data-tour="invite">Invite a person</button>}
      {!project.archived_at&&inviting&&<section className="diary-panel max-w-md"><h2>Invite a person</h2><form onSubmit={inviteMember}>
        <label className="my-4 block">Recipient email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" spellCheck={false}/></label>
        <label className="my-4 block">Project role<select className={field} name="role" defaultValue="Foreman">{roles.map(role=><option key={role}>{role}</option>)}</select></label>
        <button className={primary} disabled={busy}>Send invitation</button><button type="button" className="text-link ml-4" disabled={busy} onClick={()=>setInviting(false)}>Cancel</button>
      </form></section>}
      <section className="diary-panel"><h2>Invitations</h2>{team.invitations.length===0?<p>No invitations sent yet.</p>:<ul>{team.invitations.map(item=><li key={item.id} className="border-b border-rule py-4"><p>{item.email}</p><p className="my-2">{item.role} · {item.consumed_at?"Accepted":item.cancelled_at?"Cancelled":item.expired?"Expired":"Pending"}</p>{!item.cancelled_at&&!item.consumed_at&&<div className="flex flex-wrap gap-2">{!project.archived_at&&<button className="work-button" disabled={busy} onClick={()=>void run("resend_invite",{invitation_id:item.id})}>Resend</button>}<button className="text-link" disabled={busy} onClick={()=>void run("cancel_invite",{invitation_id:item.id})}>Cancel invitation</button></div>}</li>)}</ul>}</section>
    </>}
    {section==="settings"&&<><section className="border-t border-rule py-6"><h2 className="font-serif text-2xl">Project history</h2><p className="my-4 leading-7">Archive to stop new work while keeping all previous records.</p><button className={button} disabled={busy} onClick={()=>void run(project.archived_at?"restore":"archive")}>{project.archived_at?"Restore project":"Archive project"}</button></section>
    <details className="work-disclosure"><summary>Project details</summary><dl className="settings-summary px-5"><div><dt>Client</dt><dd>{project.client}</dd></div><div><dt>Location</dt><dd>{project.location}</dd></div><div><dt>Contract sum</dt><dd>{formatMoneyLabel(formatMoney(project.contract_sum, project.currency), project.currency)}</dd></div><div><dt>Site dates</dt><dd>{project.timezone}</dd></div><div><dt>Project reference</dt><dd>{project.project_code}</dd></div></dl></details>
    <details className="work-disclosure" id="ownership"><summary>Transfer ownership</summary><div className="p-5"><p className="leading-7">Offer ownership to an existing active member. You remain owner until they accept.</p>{team.members.some(member=>!member.owner)?<><Link href={`/account?section=security&project=${project.id}`} className="text-link my-4">Confirm website access</Link><form onSubmit={event=>{event.preventDefault();void run("start_transfer",{profile_id:new FormData(event.currentTarget).get("profile_id")});}}><label className="block">New owner<select aria-label="New owner" name="profile_id" required className={field} defaultValue=""><option value="" disabled>Choose an active member</option>{team.members.filter(member=>!member.owner).map(member=><option key={member.profile_id} value={member.profile_id}>{member.name} · {member.role==="pm"?"PM":"Foreman"}</option>)}</select></label><button className="work-button mt-5" disabled={busy}>Request ownership transfer</button></form></>:<p className="mt-4 leading-7">Invite a member first, then return here once they accept.</p>}</div></details>
    <details className="work-disclosure"><summary>Administrative history</summary><ol className="p-5">{team.events.map(event=><li key={event.id} className="border-b border-rule py-4"><p>{event.action.replace(/_/g," ")}</p><p className="mt-2 font-mono text-sm">{displayTimestamp(event.timestamp,project.timezone)}</p></li>)}</ol></details></>}
    {section==="members"&&<details className="work-disclosure"><summary>What can each role do?</summary><div className="p-5 space-y-3 leading-7"><p><strong>Foreman:</strong> record work and review their own notes.</p><p><strong>PM:</strong> review project work, manage the BoQ and approve reports.</p><p>The owner manages invitations, membership and project settings. Ownership transfer is in Settings.</p></div></details>}
  </>;
}
