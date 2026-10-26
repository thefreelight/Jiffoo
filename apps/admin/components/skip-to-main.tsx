"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const SkipToMain = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => {
  const pathname = usePathname()
  // After keyboard-initiated navigations (e.g. submitting the login form with
  // Enter), the browser relocates focus to the first focusable element — this
  // anchor — and the keyboard modality keeps :focus-visible matched, so the
  // pill stuck around over the branding. Navigation landing here is never a
  // deliberate skip: drop the focus; a genuine Tab press still reveals it.
  React.useEffect(() => {
    if (ref.current && document.activeElement === ref.current) {
      ref.current.blur()
    }
  }, [pathname, ref])

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
