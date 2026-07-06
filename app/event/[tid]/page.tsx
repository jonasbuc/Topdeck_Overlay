import { EventCompanion } from "@/components/EventCompanion";

interface Props {
  params: { tid: string };
}

export default function EventPage({ params }: Props) {
  return <EventCompanion tid={params.tid} />;
}
