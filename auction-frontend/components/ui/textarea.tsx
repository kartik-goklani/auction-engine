import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[4px] border border-border-default bg-bg-input px-2.5 py-2 text-sm text-text-primary transition-colors duration-150 outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-border-accent disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
