import Link from "next/link";
import { currentTrial } from "@/lib/trial/data";
export async function TrialReturnLink(){const trial=await currentTrial();return trial?<p className="my-6 border-l-4 border-accent pl-4 leading-7">Your private trial is still active. <Link href="/trial" className="inline-flex min-h-12 items-center font-semibold underline">Return to your trial and save its work</Link></p>:null;}
