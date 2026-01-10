import { HTMLAttributes, forwardRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverEffect = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-[32px] bg-void-900/40 border border-white/5 backdrop-blur-xl p-8",
          hoverEffect &&
            "transition-all duration-300 hover:border-white/10 hover:-translate-y-1",
          className
        )}
        {...props}
      >
        {/* Inner Gradient Glow on Hover */}
        {hoverEffect && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        )}

        {/* Content Z-Index ensure it sits above the gradient */}
        <div className="relative z-10">{props.children}</div>
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card };
