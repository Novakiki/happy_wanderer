import { redirect } from "next/navigation";

export default function Home() {
  // Legacy landing page is deprecated; send visitors to the timeline.
  redirect("/chapters");
}
