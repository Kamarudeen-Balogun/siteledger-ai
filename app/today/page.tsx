import type { Metadata } from "next";
import { CaptureDiary } from "@/components/capture-diary";
export const metadata:Metadata={title:"Today — SiteLedger",referrer:"no-referrer",robots:{index:false,follow:false}};
export default function Page(){return <CaptureDiary/>;}
