import OwnerHome from "@/components/OwnerHome";

export default function Page() {
  return (
    <main>
      <div className="page-head">
        <h2>身体</h2>
        <p className="meta">人和 agent 都能开；本机 push --watch 时房间控件才会亮。</p>
      </div>
      <OwnerHome />
    </main>
  );
}
