import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { answerAda, adaTopics } from "../lib/ada";

function read(...parts: string[]) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", ...parts), "utf8");
}

test("Ada answers each help topic", () => {
  // The suggestions must cover the real help topics: recording, BoQ,
  // reports, invites, Telegram, amendments and drafts.
  for (const id of ["record", "boq", "reports", "invite", "telegram", "amendments", "drafts", "progress", "cost", "team", "switch", "warning"]) {
    assert.ok(adaTopics.some(topic => topic.id === id), `Ada needs a ${id} topic`);
  }
  const lock = answerAda("How do I lock a report?", null);
  assert.equal(lock.topicId, "reports");
  assert.match(lock.answer, /Approve & lock/);
  const boq = answerAda("How do BoQ changes work?", null);
  assert.equal(boq.topicId, "boq");
  const telegram = answerAda("How does Telegram work?", null);
  assert.equal(telegram.topicId, "telegram");
  assert.match(telegram.answer, /@SiteLedgerNGbot/);
});

test("Ada holds a conversation across follow-ups", () => {
  // Regression: Ada answered one canned question, then every follow-up
  // ("how?", "and then?", "tell me more") hit the dead-end default and
  // the thread went nowhere. A bare follow-up now answers from the topic
  // already being discussed, and "tell me more about X" goes deeper on X.
  const first = answerAda("How do I lock a report?", null);
  const followUp = answerAda("How?", first.topicId);
  assert.equal(followUp.topicId, "reports");
  assert.match(followUp.answer, /cannot be edited/);
  assert.ok(!followUp.answer.includes("Choose a question here"), "A follow-up must not hit the dead-end default");
  const deeper = answerAda("Tell me more about the BoQ", answerAda("How do BoQ changes work?", null).topicId);
  assert.equal(deeper.topicId, "boq");
  assert.match(deeper.answer, /new BoQ version/);
  const next = answerAda("And then?", answerAda("How do I invite someone?", null).topicId);
  assert.equal(next.topicId, "invite");
  assert.match(next.answer, /email-only/);
});

test("Ada answers greetings and thanks instead of brushing them off", () => {
  assert.match(answerAda("Hi", null).answer, /Hello/);
  assert.match(answerAda("Thank you", "reports").answer, /You're welcome/);
  assert.equal(answerAda("Thank you", "reports").topicId, "reports");
});

test("Ada's fallback names what it can explain", () => {
  // An unknown question used to get "Choose a question here or open
  // Help" — a dead end. The fallback now lists the topics it covers.
  const reply = answerAda("What is the weather on site?", null);
  assert.match(reply.answer, /recording work/);
  assert.match(reply.answer, /BoQ/);
  assert.equal(reply.href, "/help");
});

test("Ada never performs actions, it only explains them", () => {
  const reply = answerAda("Please lock this report for me", null);
  assert.equal(reply.topicId, "reports");
  assert.match(reply.answer, /You'll need to do this in SiteLedger\./);
});

test("Ada shows every suggestion and keeps the chat across navigation", () => {
  // Regression: the panel showed three or four chips in a single
  // scrolling row, and tapping a link Ada suggested wiped the whole
  // conversation. All topics render as chips, and the chat persists in
  // session storage.
  const component = read("components", "ada-help.tsx");
  assert.ok(!component.includes("slice(0, 4)"), "Ada must show all suggested questions, not four");
  assert.match(component, /adaTopics\.map\(topic =>/);
  assert.match(component, /answerAda\(question, lastTopic\)/);
  assert.match(component, /sessionStorage\.setItem\(chatStorage/);
  assert.match(component, /sessionStorage\.getItem\(chatStorage/);
});
