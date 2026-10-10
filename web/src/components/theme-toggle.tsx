"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * One click flips between light and dark.
 *
 * It used to open a menu of Light / Dark / System, which made the most common action
 * two clicks. `resolvedTheme` is what is actually showing — including when the saved
 * choice is "system" — so the first click always lands on the opposite of what the
 * visitor sees. The icons are switched by the `dark:` class rather than by state, so
 * there is nothing to mismatch between server and browser render.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "relative h-8 w-8 shrink-0 p-0 [&_svg]:size-[1.2rem]",
        className,
      )}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute inset-0 m-auto h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
