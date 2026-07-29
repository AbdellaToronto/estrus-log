import { DemoClient } from "./demo-client";

export const metadata = {
  title: "North Colony demo · Estrus",
  description: "A pre-populated walkthrough of AI-first estrus prediction review, correction, and animated longitudinal cycle history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoPage() {
  return <DemoClient />;
}
