const symbols = {
  today: "today", reports: "description", boq: "calculate", profile: "person",
  theme: "settings_brightness", sun: "light_mode", moon: "dark_mode",
  plus: "add_circle", chevron: "chevron_right", switch: "expand_more", back: "arrow_back",
  mic: "mic", camera: "photo_camera", send: "send", check: "fact_check", close: "close",
  help: "support_agent", team: "engineering", building: "domain",
};

export function DiaryIcon({ name, size = 22 }: { name: keyof typeof symbols; size?: number }) {
  return <span className="diary-symbol" aria-hidden="true" style={{ fontSize: size }}>{symbols[name]}</span>;
}
