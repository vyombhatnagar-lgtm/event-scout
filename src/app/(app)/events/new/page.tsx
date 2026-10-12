import type { Metadata } from "next";
import { CaptureForm } from "@/components/events/capture-form";
import { PageHeader } from "@/components/shared/ui";

export const metadata: Metadata = { title: "Add event" };

export default function NewEventPage() {
  return (
    <>
      <PageHeader
        title="Add an event from a link"
        sub="For rooms announced only on LinkedIn, by email or in a newsletter, paste it here and it joins your pipeline with its deadline tracked."
      />
      <CaptureForm />
    </>
  );
}
