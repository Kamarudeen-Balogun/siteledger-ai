import test from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { boqWorkbook } from "./fixtures/boq-workbook";
import { suppliedDecimal, nextBoqCode, inputErrors, reviewedItem, suggestedMapping, type ImportValues } from "../lib/projects/boq-input";
import { parseBoqFile } from "../lib/projects/boq-import-parser";
import { boqImportApi } from "../lib/projects/boq-import-api";
import { costReport } from "../lib/costing/cost-report";
const id = "8b000000-0000-4000-8000-000000000001";
const values: ImportValues = { description: "Supplied concrete", unit: "m3", boq_quantity: "50", rate: "145,000", item_code: "", section: "" };
test("supplied grouping stays exact and ambiguous decimal/money inputs are rejected",()=>{
  assert.equal(suppliedDecimal("14,500.123456789123456789"),"14500.123456789123456789");
  for(const value of ["14,50","14.500,25","₦14500","1e3","-1","","Infinity"])assert.equal(suppliedDecimal(value),null);
  const item=reviewedItem(values,id,null,"ITEM-001");assert.equal(item?.rate,"145000");assert.equal(item?.boq_quantity,"50");assert.equal(item?.section,"General");
});
test("four field validation identifies missing prices and unsupported units without guessing",()=>{
  assert.deepEqual(Object.keys(inputErrors({...values,rate:"",unit:"bag",boq_quantity:"1.00001"})).sort(),["boq_quantity","rate","unit"]);
  assert.ok(inputErrors({...values,boq_quantity:"9999999999.9999"}).boq_quantity===undefined);
  assert.ok(inputErrors({...values,boq_quantity:"10000000000"}).boq_quantity);
  assert.equal(nextBoqCode([{item_code:"ITEM-001"}],["ITEM-003"]),"ITEM-002");
  assert.equal(suggestedMapping(["Rate","Description","Quantity","Unit"]).rate,0);
});
test("CSV preserves quoted descriptions, source rows, blank cells and decimal text",async()=>{
  const csv='\ufeffDescription,Unit,Quantity,Rate\r\n"Blockwork, 225mm",m2,420,"14,500"\r\n,m3,50,\r\n';
  const sheets=await parseBoqFile("BoQ.csv",Buffer.from(csv));assert.equal(sheets[0].rows[1][0],"Blockwork, 225mm");assert.equal(sheets[0].rows[1][3],"14,500");assert.equal(sheets[0].rows[2][3],"");
});
test("XLSX exposes both sheets and retains exact numeric decimal text",async()=>{
  const sheets=await parseBoqFile("BoQ.xlsx",boqWorkbook());assert.deepEqual(sheets.map(sheet=>sheet.name),["BoQ","Other sheet"]);
  assert.equal(sheets[0].rows[1][2],"0.1234");assert.equal(sheets[0].rows[1][3],"0.123456789123456789");
});
test("the builder's imported BoQ costs the test note at 551000 with concrete four percent complete",async()=>{
  const [sheet]=await parseBoqFile("BoQ.csv",Buffer.from('Description,Unit,Quantity,Rate\nBlockwork,m2,420,"14,500"\nConcrete,m3,50,"145,000"'));
  const rows=sheet.rows.slice(1).map((row,index)=>reviewedItem({description:row[0],unit:row[1],boq_quantity:row[2],rate:row[3],item_code:"",section:""},`8b000000-0000-4000-8000-${String(index+21).padStart(12,"0")}`,null,`ITEM-${index+1}`)!);
  const result=costReport(rows.map((row,index)=>({boq_item_id:row.id,unit:row.unit,quantity_done:index===0?"18":"2",crew:index===0?6:4,confirmed_by:"Confirmed fixture"})),rows.map(row=>({...row,cumulative_locked_quantity:"0"})));
  assert.equal(result.total_cost,"551000");assert.equal(result.items[1].percentage_complete,"4");
});
test("spreadsheet formulas, extreme grids and compressed oversized entries are bounded",async()=>{
  await assert.rejects(parseBoqFile("BoQ.xlsx",boqWorkbook(true)),/formulas/);
  await assert.rejects(parseBoqFile("BoQ.xlsx",boqWorkbook(false,true)),/50 columns/);
  await assert.rejects(parseBoqFile("BoQ.xlsx",zipSync({"xl/workbook.xml":new Uint8Array(5*1024*1024)})),/too large/);
  const forged=Buffer.from(zipSync({"xl/workbook.xml":new Uint8Array(5*1024*1024)}));
  for(let index=0;index<forged.length-28;index++){
    if(forged.readUInt32LE(index)===0x04034b50)forged.writeUInt32LE(1,index+22);
    if(forged.readUInt32LE(index)===0x02014b50)forged.writeUInt32LE(1,index+24);
  }
  await assert.rejects(parseBoqFile("BoQ.xlsx",forged),/too large/);
  await assert.rejects(parseBoqFile("BoQ.csv",Buffer.from("a,b\n".repeat(1002))),/1,000 rows/);
  await assert.rejects(parseBoqFile("BoQ.pdf",Buffer.from("document")),/not a PDF/);
  await assert.rejects(parseBoqFile("BoQ.csv",new Uint8Array(2*1024*1024+1)),/2 MB/);
});
process.env.SITELEDGER_APP_URL="https://siteledger.example.test";
process.env.NEXT_PUBLIC_SUPABASE_URL="https://auth.example.test";process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-role";
const request=(body:unknown,origin=process.env.SITELEDGER_APP_URL!)=>new Request("https://siteledger.example.test/api/projects/boq/import",{method:"POST",headers:{Origin:origin,Cookie:"siteledger_session="+"s".repeat(43),"Content-Type":"application/json"},body:JSON.stringify(body)});
test("import checks authentication, origin and PM access before processing",async context=>{
  let account:object|null=null,role="foreman",calls=0;
  context.mock.method(globalThis,"fetch",async(url:URL|RequestInfo)=>{calls++;const path=new URL(String(url)).pathname;return Response.json(path.endsWith("account_session")?account:{role});});
  assert.equal((await boqImportApi(request({},"https://stranger.test"))).status,403);assert.equal(calls,0);
  assert.equal((await boqImportApi(request({}))).status,401);account={profile_id:id};
  assert.equal((await boqImportApi(request({project_id:id,name:"BoQ.csv",data:Buffer.from("a").toString("base64")}))).status,404);
  role="pm";assert.equal((await boqImportApi(request({project_id:id,name:"BoQ.csv",data:"not base64!"}))).status,422);
});
test("import requires explicit reviewed new items and reports atomic row failures",async context=>{
  let rpcCalls=0;
  context.mock.method(globalThis,"fetch",async(url:URL|RequestInfo,init?:RequestInit)=>{const path=new URL(String(url)).pathname;if(path.endsWith("account_session"))return Response.json({profile_id:id});if(path.endsWith("account_project_access"))return Response.json({role:"pm"});if(path.endsWith("account_limit"))return Response.json(true);rpcCalls++;assert.ok(path.endsWith("account_boq_import"));assert.equal(JSON.parse(String(init?.body)).p_items[0].rate,"145000");return Response.json({error:"duplicate_code",row:2});});
  const item=reviewedItem(values,id,null,"ITEM-001");
  for(const input of [{project_id:id,items:[item],confirmed:false},{project_id:id,items:[item,item],confirmed:true},{project_id:id,items:[{...item,revision:"a".repeat(32)}],confirmed:true}])assert.equal((await boqImportApi(request(input),true)).status,422);
  assert.equal(rpcCalls,0);const response=await boqImportApi(request({project_id:id,items:[item],confirmed:true}),true);assert.equal(response.status,409);assert.match((await response.json()).error,/Row 2.*no partial import/);
});
