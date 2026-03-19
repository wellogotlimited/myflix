import Image from "next/image";

export default function BrandWordmark({
  size = 32,
  className = "",
  textClassName = "",
  showText = true,
  priority = false,
}: {
  size?: number;
  className?: string;
  textClassName?: string;
  showText?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image
        src="/logo.png"
        alt="Popflix logo"
        width={size}
        height={size}
        className="shrink-0"
        priority={priority}
      />
      {showText ? (
        <span className={textClassName || "text-lg font-bold tracking-wide text-white"}>
          Popflix
        </span>
      ) : null}
    </div>
  );
}
