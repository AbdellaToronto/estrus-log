import { SupervisorDemoClient } from "./supervisor-demo-client";

export const metadata = {
  title: "North Colony supervisor demo · Estrus",
  description: "A pre-populated walkthrough of AI-first estrus prediction review, correction, and animated longitudinal cycle history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SupervisorDemoPage() {
  return <SupervisorDemoClient />;
}
