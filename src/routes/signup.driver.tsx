import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/components/SignupForm";

export const Route = createFileRoute("/signup/driver")({
  head: () => ({
    meta: [
      { title: "Become a driver — Zoomo" },
      { name: "description", content: "Drive a tricycle, motorcycle, car or multicab with Zoomo in Dumaguete and nearby towns." },
      { property: "og:title", content: "Become a driver — Zoomo" },
      { property: "og:description", content: "Sign up to drive with Zoomo in Dumaguete and nearby towns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SignupForm role="driver" />,
});
