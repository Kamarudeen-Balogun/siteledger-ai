// Ada's help answers. Ada is a help assistant only: it answers questions
// about using SiteLedger and never costs, locks, edits or otherwise acts
// on anything. Every reply is canned — there is no model call — but the
// engine keeps the thread: a follow-up ("how?", "tell me more", "and
// then?") answers from the topic already being discussed instead of
// hitting a dead end, and greetings and thanks get a real reply.
export type AdaReply = { answer: string; label: string; href: string; topicId: string | null };
export type AdaTopic = { id: string; question: string; match: RegExp; answer: string; followUp: string; label: string; href: string };

export const adaTopics: AdaTopic[] = [
  { id: "record", question: "How do I record work?", match: /\b(record\w*|voice|photos?|upload\w*|site note)\b/i,
    answer: "Open Today, choose the project and tap Add today's work. Add a voice note, photos or both — either one on its own is enough. Then review the note and confirm the quantities.",
    followUp: "You can also send the voice note and photos to the Telegram bot @SiteLedgerNGbot instead — it follows the same steps. If you leave halfway, save the note as a draft and finish it later from Awaiting review.",
    label: "Today", href: "/today" },
  { id: "boq", question: "How do BoQ changes work?", match: /\b(boq|bill of quantities|version\w*|rate\w*)\b/i,
    answer: "Review the BoQ and its change history. When a supplied quantity or rate changes, review and save the edit. Locked reports keep their original quantities, rates and currency.",
    followUp: "Each change saves a new BoQ version — open Previous versions on the BoQ page to see a past version. Drafts use the current version; approved reports keep the version they were locked with.",
    label: "BoQ & rates", href: "/boq" },
  { id: "reports", question: "How do I lock a report?", match: /\b(lock\w*|approv\w*|share\w*|report\w*|pdf)\b/i,
    answer: "Open the costed draft from Reports. If you can approve reports in this project, check the record and choose Approve & lock. Open the locked report to download its PDF or share it.",
    followUp: "A locked report cannot be edited. If something needs correcting, add an amendment from the locked report — the original stays preserved and the amendment is logged.",
    label: "Reports", href: "/reports" },
  { id: "warning", question: "What does a warning mean?", match: /\b(warn\w*|ambigu\w*|missing|stale|action required|flag\w*)\b/i,
    answer: "Open the warning and check the field it points to. For a BoQ import, compare any flagged quantity or rate with the supplied file before saving. If a draft uses old rates, review the changes and rebuild it before approval.",
    followUp: "An Action required flag means a real rate conflict was found on import — open it and pick the correct rate. The flag only appears for a genuine conflict, never for a normal edit.",
    label: "BoQ & rates", href: "/boq" },
  { id: "invite", question: "How do I invite someone?", match: /\b(invit\w*|member\w*)\b/i,
    answer: "Open Your projects, choose the site and open its team settings. If you have invitation access, choose Invite a person and enter the recipient's email and project role.",
    followUp: "Invites are email-only and carry a code the person enters on the invitation page. Only the owner can change roles, remove members or transfer ownership.",
    label: "Your projects", href: "/projects" },
  { id: "telegram", question: "How does Telegram work?", match: /\b(telegram|bot)\b/i,
    answer: "Send a voice note and photos to @SiteLedgerNGbot. The bot saves them to today's open submission for your project and replies when the report is ready. Link your Telegram account from your profile first.",
    followUp: "In Telegram, /today shows today's summary: total cost, items and percentage complete. The chat shown on the website is an example only — the real chat is in Telegram.",
    label: "Today", href: "/today" },
  { id: "amendments", question: "How do I amend a locked report?", match: /\b(amend\w*|correct\w*|fix\w*|change a (locked|approved))\b/i,
    answer: "Open the locked report and add an amendment. The original report is never edited — the amendment is a new entry linked to it, and the dispute log shows both.",
    followUp: "Amendments need a reason and are signed with your name and role. Archived projects cannot take new amendments — the owner restores the project first.",
    label: "Reports", href: "/reports" },
  { id: "drafts", question: "What happens to un-costed notes?", match: /\b(draft\w*|un-costed|uncosted|awaiting review|finish later)\b/i,
    answer: "Notes you save without costing stay as drafts in Awaiting review on Today. Open a draft to check the details, edit quantities, or finish costing it later.",
    followUp: "Drafts use the current BoQ version. If the BoQ changed since the draft was saved, the draft may need costing again before approval.",
    label: "Today", href: "/today" },
  { id: "progress", question: "How is progress measured?", match: /\b(progress|percent\w*|complete\w*|earned)\b/i,
    answer: "Progress is measured from locked reports only: locked quantity divided by the BoQ quantity for each item. The percentage on Today is the value earned against the whole BoQ.",
    followUp: "Drafts and un-costed notes do not count towards progress. If an item passes its BoQ quantity it is flagged as an overrun in red.",
    label: "Today", href: "/today" },
  { id: "cost", question: "How do I cost a site note?", match: /\b(cost\w*|price\w*|money|quantit\w*)\b/i,
    answer: "Open the note and check the extracted quantities and their BoQ matches. Confirm the note before costing it. The report uses the supplied BoQ rates.",
    followUp: "Cost is quantity times the BoQ rate — the app never invents a price. No-unit materials like cement bags are counted, not costed.",
    label: "Today", href: "/today" },
  { id: "team", question: "Who can do what on a project?", match: /\b(team|role\w*|permission\w*|foreman|owner|who can)\b/i,
    answer: "The owner manages invitations, roles and settings. PMs review work, manage the BoQ and approve reports. Foremen record work and review their own notes.",
    followUp: "Each member has per-person permission toggles set by the owner. A role change takes effect immediately — approval access stops at once.",
    label: "Your projects", href: "/projects" },
  { id: "switch", question: "How do I switch projects?", match: /\b(switch\w*|change project|mock project|another project)\b/i,
    answer: "Use the project switcher at the top of any workspace page. It lists your projects and the mock project. Switching swaps all data to that project at once.",
    followUp: "The mock project is demo data to explore — it is always marked as demo and you can delete or restore it from Help or your profile settings.",
    label: "Your projects", href: "/projects" },
];

const greeting = /^(hi|hello|hey|good (morning|afternoon|evening))\b/i;
const thanks = /\b(thanks|thank you)\b/i;
// A bare follow-up ("how?", "and then?") with no topic of its own.
const bareFollowUp = /^(how\??|and then\??|what next\??|tell me more\.?|more\??|explain\.?|yes\.?|ok\.?|okay\.?|sure\.?|go on\.?|continue\.?|what about (it|that|this)\??)$/i;
// A follow-up opener on a question that names a topic ("tell me more about the BoQ").
const followUpOpener = /^(tell me more|more|explain|what about|and then|what next|go on|continue)\b/i;
const actionRequest = /\b(?:do it|for me|please (?:lock|cost|edit|invite|create|approve)|(?:lock|cost|edit|invite|create|approve) (?:this|my|the))\b/i;
const fallback: AdaReply = {
  answer: "I can explain recording work, the BoQ, reports and locking, invitations, Telegram, amendments, drafts, progress and team roles. Ask about one of those, or open Help for the full guide.",
  label: "Open Help", href: "/help", topicId: null,
};

function reply(topic: AdaTopic, answer: string): AdaReply {
  return { answer, label: topic.label, href: topic.href, topicId: topic.id };
}

export function answerAda(question: string, lastTopicId: string | null): AdaReply {
  const trimmed = question.trim();
  if (greeting.test(trimmed)) {
    return { answer: "Hello — I can explain how to use SiteLedger. Ask about recording work, the BoQ, reports, invitations or Telegram, or pick a question below.", label: "Open Help", href: "/help", topicId: lastTopicId };
  }
  if (thanks.test(trimmed)) {
    return { answer: "You're welcome. Ask another question any time — or open Help for the full guide.", label: "Open Help", href: "/help", topicId: lastTopicId };
  }
  const topic = adaTopics.find(item => item.match.test(trimmed));
  const lastTopic = adaTopics.find(item => item.id === lastTopicId) ?? null;
  if (topic) {
    // "Tell me more about the BoQ" goes deeper on that topic, not back to its first answer.
    if (followUpOpener.test(trimmed)) return reply(topic, topic.followUp);
    const answer = actionRequest.test(trimmed) && !/^how\b/i.test(trimmed)
      ? `You'll need to do this in SiteLedger. ${topic.answer}`
      : topic.answer;
    return reply(topic, answer);
  }
  if ((bareFollowUp.test(trimmed) || followUpOpener.test(trimmed)) && lastTopic) {
    return reply(lastTopic, lastTopic.followUp);
  }
  return { ...fallback, topicId: lastTopicId };
}
