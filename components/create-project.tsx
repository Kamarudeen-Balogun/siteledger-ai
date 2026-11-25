"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, projectCurrencies } from "@/lib/costing/format-money";
import { projectText, projectTimezones } from "@/lib/projects/types";
import { suppliedDecimal } from "@/lib/projects/boq-input";
import { projectAction } from "@/lib/projects/client-actions";
import { useActionConfirmation } from "./action-confirmation";
type Values = { name: string; client: string; location: string; contract_sum: string; currency: string; timezone: string };
const field = "mt-2 min-h-12 w-full border border-rule bg-[#fffdf9] px-3 py-3 text-base";
export function CreateProject() {
  const router = useRouter(), { confirm, confirmation } = useActionConfirmation();
  const [step,setStep]=useState<1|2>(1),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState("");
  const [values,setValues]=useState<Values>({name:"",client:"",location:"",contract_sum:"",currency:"NGN",timezone:"Africa/Lagos"});
  const [invalid,setInvalid]=useState<Partial<Record<keyof Values,string>>>({});
  function change(key:keyof Values,value:string){setValues(current=>({...current,[key]:value}));setDirty(true);setInvalid(current=>({...current,[key]:undefined}));setError("");}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");
    const errors:Partial<Record<keyof Values,string>>={};
    for(const key of ["name","client","location"] as const)if(!projectText(values[key]))errors[key]="Enter 1–200 characters without control characters.";
    if(Object.keys(errors).length){setInvalid(errors);setStep(1);return;}
    if(step===1){setStep(2);return;}
    const amount=suppliedDecimal(values.contract_sum);
    if(!amount||amount.length>40){setInvalid({contract_sum:"Enter the agreed contract amount. Commas can group thousands; use a dot for decimals."});return;}
    if(!await confirm({title:"Create this private project?",description:"You start as owner and PM. Currency and timezone stay fixed to protect recorded money and site dates.",confirmLabel:"Create project",detail:<><p className="font-semibold">{values.name}</p><p>{values.client} · {values.location}</p><p>{formatMoney(amount,values.currency)} · {values.currency}</p><p>Site dates: {values.timezone}</p></>}))return;
    setBusy(true);
    try{const result=await projectAction("create",{...values,contract_sum:amount});setDirty(false);router.push(`/projects/${result.id}`);}
    catch(error){setError(error instanceof Error?error.message:"Could not create the project. Your fields are kept.");}
    finally{setBusy(false);}
  }
  function textInput(key:"name"|"client"|"location"|"contract_sum",label:string,placeholder?:string){return <label className="block" htmlFor={`project-${key}`}>{label}<input id={`project-${key}`} aria-label={label} name={key} className={field} value={values[key]} onChange={event=>change(key,event.target.value)} required maxLength={key==="contract_sum"?50:200} placeholder={placeholder} inputMode={key==="contract_sum"?"decimal":undefined} aria-invalid={Boolean(invalid[key])} aria-describedby={invalid[key]?`project-${key}-error`:undefined}/>{invalid[key]&&<span id={`project-${key}-error`} className="mt-2 block text-sm text-red-800">{invalid[key]}</span>}</label>;}
  return <section className="project-creation" data-unsaved={dirty||undefined}>{confirmation}<h1 className="font-serif text-3xl">Create a project</h1><nav aria-label="Project creation steps" className="creation-steps"><ol><li aria-current={step===1?"step":undefined}><span>1</span>Site details</li><li aria-current={step===2?"step":undefined}><span>2</span>Budget & dates</li></ol></nav><form onSubmit={submit} noValidate>
    <div className="creation-heading"><p className="eyebrow">Step {step} of 2</p><h2>{step===1?"Which site are you working on?":"Set the project’s money and dates"}</h2><p>{step===1?"Name the project and the client. You can invite your team later.":"Use the agreed contract amount and the currency of your supplied BoQ."}</p></div>
    <fieldset disabled={busy} className="creation-fields">{step===1?<>{textInput("name","Project name","Name of this site")}{textInput("client","Client","Client or organisation")}{textInput("location","Site location","Town or site address")}</>:<>{textInput("contract_sum",`Contract sum (${values.currency})`,"Agreed project amount")}<label>Project currency<select aria-label="Project currency" name="currency" className={field} value={values.currency} onChange={event=>change("currency",event.target.value)}>{projectCurrencies.map(code=><option key={code}>{code}</option>)}</select></label><label>Site timezone<select aria-label="Site timezone" name="timezone" className={field} value={values.timezone} onChange={event=>change("timezone",event.target.value)}>{projectTimezones.map(zone=><option key={zone}>{zone}</option>)}</select></label><p className="text-sm leading-6">Currency and timezone stay fixed after creation. Work can be recorded before the BoQ is prepared.</p></>}</fieldset>
    {error&&<p role="alert" className="my-5 border-l-4 border-amber-700 p-4 text-amber-900">{error}</p>}<div className="creation-actions">{step===2&&<button type="button" className="work-button" disabled={busy} onClick={()=>setStep(1)}>Back to site details</button>}<button className="work-button work-button-primary" disabled={busy}>{busy?"Creating…":step===1?"Continue to budget & dates":"Review and create project"}</button></div><Link href="/projects" prefetch={false} className="text-link mt-5">Cancel setup</Link>
  </form></section>;
}
