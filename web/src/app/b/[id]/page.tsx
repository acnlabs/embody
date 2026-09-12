import Link from "next/link";
import BodyRoom from "@/components/BodyRoom";

export default async function BodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main>
      <p className="meta">
        <Link href="/">← 全部身体</Link>
      </p>
      <BodyRoom bodyId={id} />
    </main>
  );
}
