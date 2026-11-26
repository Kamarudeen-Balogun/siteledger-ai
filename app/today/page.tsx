import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureDiary } from "@/components/capture-diary";
import { DiaryNotice } from "@/components/diary-notice";
import { WorkspaceHeader } from "@/components/workspace-header";
export const metadata:Metadata={title:"Today — SiteLedger",referrer:"no-referrer",robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<main className="mx-auto min-h-svh max-w-7xl px-5 py-7"><WorkspaceHeader current="today"/><DiaryNotice busy title="Opening your diary…"/></main>}><CaptureDiary/></Suspense>;}
