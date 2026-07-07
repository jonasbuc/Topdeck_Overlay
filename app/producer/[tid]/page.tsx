import { ProducerMode } from "@/components/ProducerMode";

interface Props {
  params: { tid: string };
}

export default function ProducerPage({ params }: Props) {
  return <ProducerMode tid={params.tid} />;
}
