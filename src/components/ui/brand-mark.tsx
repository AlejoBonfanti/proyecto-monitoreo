export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "h-[38px] w-[38px] text-[15px]" : "h-[30px] w-[30px] text-[13px]";
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-[7px] bg-accent font-mono font-semibold text-white ${dims}`}
    >
      CEM
    </div>
  );
}
