import Link from "next/link";
export function ProjectNavigation({ id, current, owner }: { id: string; current: "overview" | "records" | "progress" | "boq" | "team"; owner: boolean }) {
  const links = [
    { key: "overview", label: "Home", href: `/projects/${id}` },
    { key: "records", label: "Site records", href: `/projects/${id}?view=records` },
    { key: "boq", label: "BoQ", href: `/projects/${id}/boq` },
    { key: "progress", label: "Progress", href: `/projects/${id}?view=progress` },
  ];
  return <div className="project-navigation"><nav aria-label="Project sections" className="work-tabs project-tabs">{links.map(link => <Link key={link.key} href={link.href} prefetch={false} aria-current={current === link.key ? "page" : undefined}>{link.label}</Link>)}</nav>{owner && <Link href={`/projects/${id}/team`} prefetch={false} className="project-manage-link" aria-current={current === "team" ? "page" : undefined}>Manage project <span aria-hidden="true">↗</span></Link>}</div>;
}
