import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          "rounded-full", // Horizon Principle: Pill Shape
          {
            // Variants
            "bg-flash-white text-flash-text hover:scale-105 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]":
              variant === "primary",
            "bg-void-900 border border-mist-400/20 text-mist-100 hover:border-mist-100/50 hover:bg-void-900/80":
              variant === "secondary",
            "hover:bg-mist-100/10 text-mist-400 hover:text-mist-100":
              variant === "ghost",
            "border border-mist-400/20 text-mist-400 hover:text-mist-100 hover:border-mist-100":
              variant === "outline",

            // Sizes
            "h-9 px-4 text-xs": size === "sm",
            "h-11 px-6 text-sm": size === "md",
            "h-14 px-8 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
