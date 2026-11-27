const symbols = {
  today: "today", reports: "description", boq: "calculate", profile: "person",
  theme: "settings_brightness", sun: "light_mode", moon: "dark_mode",
  plus: "add_circle_outline", chevron: "chevron_right", switch: "expand_more", back: "arrow_back",
  mic: "mic", camera: "photo_camera", send: "send", check: "fact_check", close: "close",
  help: "support_agent", team: "engineering", building: "domain", saved: "cloud_done",
  explore: "explore", tour: "tour", flask: "science", pending: "hourglass_top", receipt: "receipt_long",
  progress: "monitoring", verified: "verified_user", play: "play_arrow", pause: "pause",
  stop: "stop_circle", trash: "delete", bookmark: "bookmark_border", translate: "translate",
  review: "assignment_turned_in", warning: "warning", lock: "lock", seal: "verified",
  calendar: "calendar_today", location: "location_on", weather: "cloud", share: "share", pdf: "picture_as_pdf",
  amendment: "post_add", history: "history", upload: "upload_file", invite: "person_add",
  telegram: "smart_toy", copy: "content_copy", email: "mail", settings: "settings", info: "info", phone: "smartphone",
  feedback: "rate_review", attach: "attach_file", logout: "logout", guide: "route",
};

export function DiaryIcon({ name, size = 22 }: { name: keyof typeof symbols; size?: number }) {
  return <span className="diary-symbol" aria-hidden="true" style={{ fontSize: size }}>{symbols[name]}</span>;
}
