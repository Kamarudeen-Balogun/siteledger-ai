export function navigationFallback(path: string): string {
  if (path === "/account/confirm" || path === "/account/recover") return "/account";
  const project = path.match(/^\/projects\/([^/]+)\/(?:boq|team)$/);
  if (project) return `/projects/${project[1]}`;
  if (/^\/projects\/[^/]+$/.test(path)) return "/projects";
  const log = path.match(/^\/log\/([^/]+)$/);
  if (log) return `/reports/${log[1]}`;
  const original = path.match(/^\/trial\/original\/([^/]+)$/);
  if (original) return `/reports/${original[1]}`;
  if (path === "/trial/report") return "/trial";
  if (/^\/confirm\/[^/]+$/.test(path)) return "/today";
  if (/^\/reports\/[^/]+$/.test(path) && path !== "/reports/demo") return "/projects";
  return "/";
}

export function isWorkspacePath(path: string): boolean {
  return /^\/(?:account|projects|today|invite|confirm|reports|log|trial)(?:\/|$)/.test(path);
}
