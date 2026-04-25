import { useEffect, useId, useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

type InfiniteGridProps = React.ComponentProps<"div"> & {
  color?: string;
  backgroundColor?: string;
  vignetteColor?: string;
  gridSize?: number;
  speed?: number;
};

export function InfiniteGrid({
  color = "rgba(255, 34, 34, 0.42)",
  backgroundColor = "transparent",
  vignetteColor = "rgba(10,10,10,0.96)",
  gridSize = 44,
  speed = 0.18,
  className,
  ...props
}: InfiniteGridProps) {
  const patternId = useId().replace(/:/g, "");
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);
  const lastTime = useRef(0);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  useAnimationFrame((time) => {
    if (!lastTime.current) {
      lastTime.current = time;
      return;
    }

    const delta = Math.min(time - lastTime.current, 32);
    lastTime.current = time;
    const step = speed * delta * 0.06;
    gridOffsetX.set((gridOffsetX.get() + step) % gridSize);
    gridOffsetY.set((gridOffsetY.get() + step) % gridSize);
  });

  const maskImage = useMotionTemplate`radial-gradient(360px circle at ${mouseX}px ${mouseY}px, black, transparent 72%)`;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor }}
      {...props}
    >
      <div className="absolute inset-0 opacity-35">
        <GridPattern
          id={`${patternId}-base`}
          color={color}
          offsetX={gridOffsetX}
          offsetY={gridOffsetY}
          gridSize={gridSize}
        />
      </div>

      <motion.div
        className="absolute inset-0 opacity-80"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern
          id={`${patternId}-active`}
          color={color}
          offsetX={gridOffsetX}
          offsetY={gridOffsetY}
          gridSize={gridSize}
        />
      </motion.div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse at center, transparent 0%, transparent 42%, ${vignetteColor} 100%)`,
        }}
      />
    </div>
  );
}

function GridPattern({
  id,
  color,
  offsetX,
  offsetY,
  gridSize,
}: {
  id: string;
  color: string;
  offsetX: ReturnType<typeof useMotionValue<number>>;
  offsetY: ReturnType<typeof useMotionValue<number>>;
  gridSize: number;
}) {
  return (
    <svg className="h-full w-full" aria-hidden="true">
      <defs>
        <motion.pattern
          id={id}
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke={color}
            strokeWidth="1"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
