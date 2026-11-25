import test from "node:test";
import assert from "node:assert/strict";
import { projectStep, recordAction, recordStage, type ProjectRecord } from "../lib/projects/journey";
const note=(change:Partial<ProjectRecord>={}):ProjectRecord=>({id:"review-note",date:"2026-11-25",submitted_by:"Confirmed foreman",status:"extracted",report_id:null,report_status:null,...change});
test("new and completed projects lead to recording, without requiring a BoQ",()=>{
  assert.equal(projectStep([],"pm",false).kind,"record");
  assert.equal(projectStep([note({status:"locked",report_id:"report",report_status:"locked"})],"foreman",false).kind,"record");
});
test("foreman prioritises unconfirmed work while PM sees a draft needing review",()=>{
  const draft=note({id:"draft-note",status:"confirmed",report_id:"report",report_status:"draft"});
  assert.equal(projectStep([draft,note()],"foreman",false).href,"/confirm/review-note");
  assert.equal(projectStep([note(),draft],"pm",false).href,"/reports/draft-note");
  assert.match(projectStep([draft],"pm",false).description,/separate action/);
});
test("confirmed notes route to deliberate report creation and approved notes to immutable reports",()=>{
  const confirmed=note({status:"confirmed"});
  assert.equal(recordStage(confirmed),"draft");assert.equal(recordAction(confirmed).label,"Create costed report");
  assert.equal(projectStep([confirmed],"pm",false).title,"Your note is confirmed");
  assert.equal(recordAction(note({status:"locked",report_id:"report",report_status:"locked"})).label,"View approved report");
});
test("archived projects always lead to read-only history, even with unfinished work",()=>{
  assert.deepEqual(projectStep([note()],"pm",true),{kind:"archived",title:"This project is archived",description:"Your previous notes and approved reports remain available.",label:"Open site records"});
});
test("received attachments are identified as processing without claiming they are extracted",()=>{
  const next=projectStep([note({status:"received"})],"foreman",false);
  assert.equal(next.title,"Processing your note");assert.equal(next.label,"Open site note");
});
