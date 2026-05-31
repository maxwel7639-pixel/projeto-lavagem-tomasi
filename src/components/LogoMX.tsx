export default function LogoMX() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm select-none"
        style={{
          background: "#0D0D12",
          border: "1.5px solid rgba(109,92,245,0.5)",
          boxShadow: "0 0 14px rgba(109,92,245,0.35)",
        }}
      >
        <span className="text-white">M</span>
        <span className="text-[#8B7CF8]">X</span>
      </div>
      <div>
        <p className="text-white font-bold tracking-widest text-sm leading-tight">MX DIGITAL</p>
        <p className="text-[#9090A0] text-xs tracking-widest">SISTEMA DE LAVAGENS</p>
      </div>
    </div>
  );
}
