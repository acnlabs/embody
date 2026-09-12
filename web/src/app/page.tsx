import OwnerHome from "@/components/OwnerHome";

export default function Page() {
  return (
    <main>
      <div className="page-head">
        <h2>身体</h2>
        <p className="meta">agent 在本机开车；这里只看 push 上来的快照。</p>
      </div>
      <OwnerHome />
    </main>
  );
}
