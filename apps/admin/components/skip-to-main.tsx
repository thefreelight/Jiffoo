"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const SkipToMain = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const mainElement = document.getElementById("main")
    if (mainElement) {
      mainElement.focus()
      mainElement.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <a
      ref={ref}
      href="#main"
      onClick={handleClick}
      className={cn(
        "sr-only absolute left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors",
        // focus-visible, not focus: route changes programmatically focus this
        // anchor (Next autofocus), which with the plain focus variant left the
        // pill permanently rendered over the sidebar branding.
        "focus-visible:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      Skip to main content
    </a>
  )
})

SkipToMain.displayName = "SkipToMain"

export { SkipToMain }
