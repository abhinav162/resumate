import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

interface JobDescriptionInputProps extends ComponentProps<"textarea"> {
  label?: string;
}

export function JobDescriptionInput({
  className,
  label,
  ...props
}: JobDescriptionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [props.value]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-mist-400 mb-2 font-mono uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-aurora-teal to-aurora-purple rounded-2xl opacity-20 group-focus-within:opacity-100 transition duration-500 blur"></div>
        <textarea
          ref={textareaRef}
          className={twMerge(
            "relative w-full bg-void-900 border border-white/10 rounded-2xl p-6 text-mist-100 placeholder:text-mist-400/50 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none min-h-[200px] transition-all font-sans text-lg leading-relaxed shadow-xl",
            className
          )}
          placeholder="Paste the job description here..."
          onInput={adjustHeight}
          {...props}
        />
      </div>
    </div>
  );
}
