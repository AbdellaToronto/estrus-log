import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Beaker, Camera, ClipboardCheck, Images, Users } from "lucide-react";
import { EstrusIcon } from "@/components/estrus-icon";

const stops = [
  {
    href: "/dashboard-lab",
    eyebrow: "1 · Daily brief",
    title: "See what needs attention today",
    detail: "A populated lab dashboard with cohort progress, recent records, and the next mice to review.",
    icon: Users,
  },
  {
    href: "/cohort-lab",
    eyebrow: "2 · Cohort review",
    title: "Open the North colony",
    detail: "Six demo subjects, a mix of reviewed and outstanding observations, trends, and evidence-ready records.",
    icon: ClipboardCheck,
  },
  {
    href: "/observation-lab",
    eyebrow: "3 · One observation",
    title: "Try the scientist review flow",
    detail: "Adjust the prepared ROI, inspect an early/late model lead, choose an exact stage, and save locally in the demo.",
    icon: Camera,
  },
  {
    href: "/batch-lab",
    eyebrow: "4 · Batch capture",
    title: "Review a whole session",
    detail: "Inspect a populated eight-image batch, add local photos, reveal review leads, and confirm each exact stage.",
    icon: Images,
  },
  {
    href: "/experiments-lab",
    eyebrow: "5 · Study view",
    title: "Explore an experiment workspace",
    detail: "See how cohort work rolls up into a reviewable study and reproducible evaluation plan.",
    icon: Beaker,
  },
];

export const metadata = {
  title: "Estrus supervisor demo",
  description: "A safe, pre-populated walkthrough of the Estrus research workflow.",
};

export default function SupervisorDemoPage() {
  if (process.env.ESTRUS_WORKFLOW_LAB !== "true") notFound();

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-8 text-[#292b4c] sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="grid gap-8 border-b border-[#ded9cd] pb-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#625f58]"><EstrusIcon name="evidence" className="h-6 w-6" /> Estrus · supervisor walkthrough</div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[0.92] tracking-[-0.06em] text-[#30345f] sm:text-6xl">A ready-to-explore mouse-cycle research workspace.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f5c56]">Start anywhere below. This is an interactive, pre-populated demonstration: safe to click through, with no real lab record being changed.</p>
          </div>
          <Link href="/workflow-lab" className="inline-flex items-center gap-2 border border-[#b8b7e1] bg-[#eeedf9] px-4 py-3 text-sm font-semibold text-[#454a9f] hover:bg-[#e3e1f4]">View workflow map <ArrowRight className="h-4 w-4" /></Link>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {stops.map(({ href, eyebrow, title, detail, icon: Icon }) => (
            <Link key={href} href={href} className="group border border-[#ded9cd] bg-[#fbfaf7] p-6 transition hover:-translate-y-0.5 hover:border-[#8d90c9] hover:shadow-[0_14px_32px_rgba(48,52,95,0.08)]">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#625f58]">{eyebrow}</p><h2 className="mt-3 font-serif text-3xl tracking-[-0.04em] text-[#30345f]">{title}</h2></div><Icon className="h-8 w-8 shrink-0 text-[#454a9f]" /></div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#5f5c56]">{detail}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#454a9f]">Open this view <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </section>

        <aside className="mt-8 border-l-4 border-[#d8b28d] bg-[#fff4df] p-5 text-sm leading-6 text-[#64432d]">
          <strong>About the demonstration data.</strong> The visual examples are derived from the public BioStudies S-BIAD2395 reference dataset (CC BY 4.0). Subject names, cohort history, and model leads are illustrative demo state—not Liv&apos;s colony data and not scientific ground truth.
        </aside>
      </div>
    </main>
  );
}
