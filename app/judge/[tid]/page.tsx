import { JudgeConsole } from "@/components/JudgeConsole";

interface Props {
  params: { tid: string };
}

export default function JudgePage({ params }: Props) {
  return <JudgeConsole tid={params.tid} />;
}
