"use client"

import * as React from "react"
import { useT } from 'shared/src/i18n/react'
import { cn } from "@/lib/utils"

// Read by screen readers and shown on keyboard focus: it speaks the storefront's language.
const SKIP_TO_MAIN = 'common.shell.skipToMain'

const SkipToMain = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => {
  const t = useT()
  const translated = t?.(SKIP_TO_MAIN)

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
        "focus-visible:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {translated && translated !== SKIP_TO_MAIN ? translated : "Skip to main content"}
    </a>
  )
})

SkipToMain.displayName = "SkipToMain"

export { SkipToMain }
