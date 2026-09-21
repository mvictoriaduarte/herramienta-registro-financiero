export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="ambient-blob left-[-8%] top-[8%] h-80 w-80 bg-petroleum-soft/40" />
      <div
        className="ambient-blob right-[-6%] top-[18%] h-96 w-96 bg-petroleum/28"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="ambient-blob bottom-[-10%] left-[30%] h-[28rem] w-[28rem] bg-[#c5d6c2]/70"
        style={{ animationDelay: "-11s" }}
      />
    </div>
  );
}
