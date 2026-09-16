import BodyRoom from "@/components/BodyRoom";

export default async function BodyHostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main>
      <BodyRoom bodyId={id} host />
    </main>
  );
}
