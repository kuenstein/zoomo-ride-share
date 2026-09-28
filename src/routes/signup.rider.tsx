import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/SignupForm";

export const Route = createFileRoute("/signup/rider")({
  head: () => ({
    meta: [
      { title: "Sign up to ride — Zoomo" },
      { name: "description", content: "Create a Zoomo rider account and book rides around Dumaguete, Bacong, Sibulan and Valencia." },
      { property: "og:title", content: "Sign up to ride — Zoomo" },
      { property: "og:description", content: "Create a Zoomo rider account and book rides around Dumaguete." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SignupForm role="rider" />,
});
