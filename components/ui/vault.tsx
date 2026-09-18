"use client";

import * as React from "react";
import { useDevice } from "@/hooks/ui/use-device";
import { Drawer } from "vaul";
import { twMerge } from "tailwind-merge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion, HTMLMotionProps } from "framer-motion";
import { vaultIcons } from "./vault-icons";
import { Input } from "./input";



interface VaultContextProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

const VaultContext = React.createContext<VaultContextProps | undefined>(
    undefined,
);

const Vault = ({
    children,
    open: controlledOpen,
    onOpenChange,
    defaultOpen,
    ...props
}: React.ComponentProps<typeof Drawer.Root>) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
        defaultOpen ?? false,
    );

    const isOpen = controlledOpen ?? uncontrolledOpen;

    const handleOpenChange = (open: boolean) => {
        if (controlledOpen === undefined) {
            setUncontrolledOpen(open);
        }
        onOpenChange?.(open);
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={handleOpenChange} {...props}>
            <VaultContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
                {children}
            </VaultContext.Provider>
        </Drawer.Root>
    );
};

const VaultTrigger = React.forwardRef<
    React.ComponentRef<typeof Drawer.Trigger>,
    React.ComponentPropsWithoutRef<typeof Drawer.Trigger>
>(({ onClick, ...props }, ref) => {
    return (
        <Drawer.Trigger
            ref={ref}
            onClick={(e) => {
                if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.blur();
                }
                onClick?.(e);
            }}
            {...props}
        />
    );
});
VaultTrigger.displayName = "VaultTrigger";
const VaultPortal = Drawer.Portal;

const VaultOverlay = React.forwardRef<
    React.ComponentRef<typeof Drawer.Overlay>,
    React.ComponentPropsWithoutRef<typeof Drawer.Overlay>
>(({ className, ...props }, ref) => {
    return (
        <Drawer.Overlay
            ref={ref}
            className={twMerge(
                "fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm",
                className,
            )}
            {...props}
        />
    );
});
VaultOverlay.displayName = "VaultOverlay";

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode;
}

const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
    ({ className, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={twMerge(
                    "absolute left-[-10000px] top-auto w-px h-px overflow-hidden",
                    className
                )}
                {...props}
            />
        );
    }
);
VisuallyHidden.displayName = "VisuallyHidden";

const VaultContent = React.forwardRef<
    React.ComponentRef<typeof Drawer.Content>,
    React.ComponentPropsWithoutRef<typeof Drawer.Content> & {
        showHandle?: boolean;
        noPadding?: boolean;
    }
>(({ className, children, showHandle = true, noPadding = false, onOpenAutoFocus, ...props }, ref) => {
    const { isStandalone } = useDevice();

    return (
        <Drawer.Portal container={typeof document !== 'undefined' ? document.getElementById('vault-root') : null}>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" />
            <Drawer.Content
                ref={ref}
                aria-describedby={undefined}
                aria-label={props["aria-label"] ?? "Vault"}
                tabIndex={-1}
                onOpenAutoFocus={(e) => {
                    if (onOpenAutoFocus) {
                        onOpenAutoFocus(e);
                        return;
                    }

                    e.preventDefault();

                    const container = e.currentTarget as HTMLElement;
                    const firstInput = container.querySelector(
                        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'
                    ) as HTMLElement;

                    if (firstInput) {
                        firstInput.focus();
                    } else {
                        container.focus();
                    }
                }}
                className={twMerge(
                    "fixed z-50 flex flex-col bg-surface shadow-lg border border-divider outline-none",

                    isStandalone
                        ? "bottom-2 inset-x-2 w-auto rounded-lg after:hidden! mt-24"
                        : "bottom-0 inset-x-0 w-full rounded-t-lg mt-24",

                    "sm:bottom-6 sm:inset-x-0 sm:mx-auto sm:w-full sm:max-w-md sm:rounded-lg sm:after:hidden! sm:mt-0 max-h-[90vh]",

                    className,
                )}
                {...props}
            >
                <VisuallyHidden>
                    <Drawer.Title>{props["aria-label"] ?? "Vault"}</Drawer.Title>
                </VisuallyHidden>
                {showHandle && (
                    <div className="mx-auto mt-4 mb-2 h-1.5 w-14 shrink-0 rounded-full bg-divider" />
                )}

                <div className={cn(
                    "overflow-y-auto no-scrollbar",
                    !noPadding && "px-6 pb-6 pt-2"
                )}>
                    {children}
                </div>
            </Drawer.Content>
        </Drawer.Portal>
    );
});
VaultContent.displayName = "VaultContent";

const VaultHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        showCloseButton?: boolean;
    }
>(({ className, showCloseButton = true, children, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={twMerge(
                "flex items-center justify-between pb-1",
                !showCloseButton && "justify-center",
                className,
            )}
            {...props}
        >
            <div
                className={`flex flex-col space-y-2 ${showCloseButton ? "flex-1" : "text-center"}`}
            >
                {children}
            </div>
        </div>
    );
});
VaultHeader.displayName = "VaultHeader";

const VaultTitle = React.forwardRef<
    React.ComponentRef<typeof Drawer.Title>,
    React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => {
    return (
        <Drawer.Title
            ref={ref}
            className={twMerge(
                "font-serif text-xl font-semibold text-center leading-tight tracking-tight text-foreground",
                className,
            )}
            {...props}
        />
    );
});
VaultTitle.displayName = "VaultTitle";

const VaultDescription = React.forwardRef<
    React.ComponentRef<typeof Drawer.Description>,
    React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, children, ...props }, ref) => {
    return (
        <Drawer.Description
            ref={ref}
            className={twMerge(
                "text-center text-sm text-muted-foreground leading-relaxed",
                className,
            )}
            {...props}
        >
            {children}
        </Drawer.Description>
    );
});
VaultDescription.displayName = "VaultDescription";

const VaultFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={twMerge(
                "flex lg:flex-row md:flex-row flex-col justify-center gap-3 pt-4 border-t border-divider",
                className,
            )}
            {...props}
        />
    );
};
VaultFooter.displayName = "VaultFooter";

const VaultIcon = ({
    className,
    type = "info",
    src,
    alt = "",
    children,
    ...props
}: {
    className?: string;
    type?:
    | "info"
    | "warning"
    | "error"
    | "success"
    | "delete"
    | "confirm"
    | "close"
    | "settings"
    | "user"
    | "edit"
    | "download"
    | "upload"
    | "search"
    | "notification"
    | "heart"
    | "star"
    | "calendar"
    | "lock"
    | "unlock"
    | "home"
    | "document";
    src?: string;
    alt?: string;
    children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
    const toneClass =
        type === "error" || type === "delete" || type === "warning"
            ? "text-destructive"
            : type === "success" || type === "confirm"
                ? "text-success"
                : "text-foreground";

    const iconContent =
        children ||
        (src ? (
            <Image
                src={src}
                alt={alt}
                width={48}
                height={48}
                className="w-12 h-12 object-cover rounded-full"
                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const fallbackIcon = target.nextElementSibling as HTMLElement | null;
                    if (fallbackIcon) {
                        fallbackIcon.style.display = "flex";
                    }
                }}
            />
        ) : (
            vaultIcons[type]
        ));

    return (
        <div
            className={twMerge("flex justify-center items-center mb-3", className)}
            {...props}
        >
            {src ? (
                <div className="relative">
                    <Image
                        src={src}
                        alt={alt}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-full"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const fallback = target.parentElement?.querySelector(
                                ".fallback-icon",
                            ) as HTMLElement | null;
                            if (fallback) {
                                fallback.style.display = "flex";
                            }
                        }}
                    />
                    <div className={cn("fallback-icon hidden justify-center items-center w-12 h-12 bg-muted rounded-full", toneClass)}>
                        {vaultIcons[type]}
                    </div>
                </div>
            ) : (
                <div className={cn("flex justify-center items-center w-12 h-12 bg-muted rounded-full", toneClass)}>
                    {iconContent}
                </div>
            )}
        </div>
    );
};
VaultIcon.displayName = "VaultIcon";

// Vault Body Component
const VaultBody = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
    return <div className={twMerge("space-y-4 py-2", className)} {...props} />;
};
VaultBody.displayName = "VaultBody";

// Vault Form Component
const VaultForm = React.forwardRef<
    HTMLFormElement,
    React.FormHTMLAttributes<HTMLFormElement>
>(({ className, ...props }, ref) => {
    return (
        <form
            ref={ref}
            className={twMerge("space-y-4", className)}
            {...props}
        />
    );
});
VaultForm.displayName = "VaultForm";

const VaultField = ({
    label,
    required,
    error,
    children,
    className,
    ...props
}: {
    label?: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
    className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div className={twMerge("space-y-2", className)} {...props}>
            {label && (
                <label className="block text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </label>
            )}
            {children}
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
};
VaultField.displayName = "VaultField";

const VaultInput = React.forwardRef<
    HTMLInputElement,
    React.ComponentPropsWithoutRef<typeof Input> & {
        error?: boolean;
    }
>(({ className, ...props }, ref) => {
    return (
        <Input
            ref={ref}
            className={twMerge("bg-surface border-divider rounded-md", className)}
            {...props}
        />
    );
});
VaultInput.displayName = "VaultInput";

const VaultPrimaryButton = React.forwardRef<
    React.ComponentRef<typeof motion.button>,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: "default" | "destructive" | "secondary";
    } & HTMLMotionProps<"button">
>(({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
        default: "bg-accent text-ink hover:bg-accent-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    };

    return (
        <motion.button
            ref={ref}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={twMerge(
                `min-w-fit flex flex-1 items-center justify-center flex-row gap-2 px-7 py-3 lg:text-lg md:text-base text-sm font-semibold rounded-pill
        transition-all duration-150 focus:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}`,
                className,
            )}
            {...props}
        />
    );
});
VaultPrimaryButton.displayName = "VaultPrimaryButton";

const VaultSecondaryButton = React.forwardRef<
    React.ComponentRef<typeof motion.button>,
    React.ButtonHTMLAttributes<HTMLButtonElement> & HTMLMotionProps<"button">
>(({ className, ...props }, ref) => {
    return (
        <motion.button
            ref={ref}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={twMerge(
                `flex items-center justify-center gap-2 flex-row min-w-fit px-6 py-3 lg:text-lg md:text-base text-sm font-semibold
        text-foreground
        bg-muted hover:bg-surface-alt
        rounded-pill transition-all duration-150
        border border-divider hover:border-divider
        disabled:opacity-50 disabled:cursor-not-allowed`,
                className,
            )}
            {...props}
        />
    );
});
VaultSecondaryButton.displayName = "VaultSecondaryButton";

export {
    Vault,
    VaultTrigger,
    VaultPortal,
    VaultOverlay,
    VaultContent,
    VaultHeader,
    VaultTitle,
    VaultDescription,
    VaultBody,
    VaultForm,
    VaultField,
    VaultInput,
    VaultFooter,
    VaultIcon,
    VaultPrimaryButton,
    VaultSecondaryButton,
};
