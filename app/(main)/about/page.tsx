import { redirect } from "next/navigation";

export default function AboutPage() {
  // Deprecated page; send visitors to the timeline.
  redirect("/chapters");
}
