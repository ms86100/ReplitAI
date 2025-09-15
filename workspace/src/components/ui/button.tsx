import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-airbus-primary text-white border border-airbus-primary shadow-professional min-w-[120px]",
        primary: "bg-airbus-primary text-white border border-airbus-primary shadow-professional min-w-[120px]",
        destructive: "bg-destructive text-destructive-foreground border border-destructive shadow-professional",
        outline: "border-2 border-airbus-primary bg-background text-airbus-primary font-semibold hover:bg-airbus-primary hover:text-white",
        secondary: "bg-airbus-secondary text-airbus-primary border border-airbus-secondary-dark font-semibold hover:bg-airbus-secondary-dark hover:text-white",
        ghost: "bg-transparent text-foreground border border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "text-airbus-primary underline-offset-4 underline font-semibold hover:text-airbus-primary/80",
        hero: "bg-airbus-primary text-white border border-airbus-primary shadow-professional min-w-[140px]",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
