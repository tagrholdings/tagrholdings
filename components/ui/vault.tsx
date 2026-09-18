"use client";

import * as React from "react";
import { useDevice } from "@/hooks/ui/use-device";
import { Drawer } from "vaul";
import { twMerge } from "tailwind-merge";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion, HTMLMotionProps, AnimatePresence } from "framer-motion";
import { vaultIcons } from "./vault-icons";
import { Input } from "./input";

interface VaultContextProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

const VaultContext = React.createContext<VaultContextProps | undefined>(
    undefined,
);

// Hook exportado para podermos acessar e fechar o vault de dentro de botões/forms
const useVault = () => {
    const context = React.useContext(VaultContext);
    if (!context) {
        throw new Error("useVault must be used within a Vault");
    }
    return context;
};

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
                    // overflow-hidden adicionado para que a expansão do botão não quebre as bordas arredondadas do Drawer
                    "no-scrollbar fixed z-50 flex flex-col bg-surface shadow-lg border border-divider outline-none overflow-hidden",

                    isStandalone
                        ? "bottom-2 inset-x-2 w-auto rounded-lg after:hidden! mt-24"
                        : "bottom-0 inset-x-0 w-full rounded-t-lg mt-24",

                    "sm:bottom-6 sm:inset-x-0 sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-lg sm:after:hidden! sm:mt-0 max-h-[90vh]",

                    className,
                )}
                {...props}
            >
                <VisuallyHidden>
                    <Drawer.Title>{props["aria-label"] ?? "Vault"}</Drawer.Title>
                </VisuallyHidden>
                {showHandle && (
                    <div className="mx-auto mt-4 mb-2 h-1.5 w-14 shrink-0 rounded-full bg-divider relative z-10" />
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
            {children}
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
                // Removido o 'relative' daqui do final!
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


// Novo tipo para podermos aceitar promessas no onClick do botão principal
// Atualizamos o tipo do onClick para aceitar booleanos (tanto em Promise como retorno síncrono)
type VaultPrimaryButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> &
    HTMLMotionProps<"button"> & {
        variant?: "default" | "destructive" | "secondary";
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void | boolean> | void | boolean;
    };

const VaultPrimaryButton = React.forwardRef<
    React.ComponentRef<typeof motion.button>,
    VaultPrimaryButtonProps
>(({ className, variant = "default", children, onClick, ...props }, ref) => {
    const { setIsOpen } = useVault();
    const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
    
    // Um ID único para que o Framer Motion ligue o botão original ao overlay de ecrã inteiro
    const layoutId = React.useId();

    const variantStyles = {
        default: "bg-accent text-ink hover:bg-accent-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    };

const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!onClick) return;

        const result: unknown = onClick(e);

        if (result instanceof Promise) {
            setStatus("loading");
            try {
                // Aguardamos o resultado da sua função
                const response = await result;
                
                // SEGREDO AQUI: Se a função retornar false, a gente aborta a animação
                // e volta o botão ao normal silenciosamente.
                if (response === false) {
                    setStatus("idle");
                    return;
                }
                
                setStatus("success");
            } catch {
                setStatus("error");
            }

            setTimeout(() => {
                setIsOpen(false);
                setTimeout(() => setStatus("idle"), 300);
            }, 1600);
        }
    };

    const isExpanded = status === "success" || status === "error";

    return (
        <>
            {isExpanded ? (
                /* 
                 * FANTASMA: Quando o overlay expande, o botão sai de cena. 
                 * Esta div invisível assume o exato mesmo tamanho para impedir que o formulário encolha ou pisque. 
                 */
                <div className={twMerge("flex flex-1 px-7 py-3 opacity-0 pointer-events-none", className)} />
            ) : (
                /* BOTÃO REAL */
                <motion.button
                    ref={ref}
                    layoutId={layoutId} // A magia começa aqui
                    onClick={handleClick}
                    disabled={status !== "idle" || props.disabled}
                    whileHover={status === "idle" ? { scale: 1.005 } : undefined}
                    whileTap={status === "idle" ? { scale: 0.98 } : undefined}
                    className={twMerge(
                        "flex flex-1 items-center justify-center gap-2 px-7 py-3 lg:text-lg md:text-base text-sm font-semibold rounded-md transition-colors duration-150 focus:outline-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed",
                        variantStyles[variant],
                        className,
                    )}
                    {...props}
                >
                    {status === "idle" && children}
                    {status === "loading" && (
                        <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-spin h-6 w-6 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </motion.svg>
                    )}
                </motion.button>
            )}

            {/* OVERLAY: Expande fisicamente pelo Vault assumindo o layoutId */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        layoutId={layoutId} // A magia conecta-se aqui
                        className={cn(
                            "absolute inset-0 z-50 flex flex-col items-center justify-center text-white text-2xl shadow-2xl rounded-lg overflow-hidden",
                            status === "success" ? "bg-green-600" : "bg-destructive"
                        )}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15, type: "spring" }} // Atraso ligeiro para permitir que a expansão chegue perto do fim antes de mostrar o texto
                            className="flex flex-col items-center gap-3"
                        >
                            <div className="rounded-full bg-white/20 p-4">
                                {status === "success" ? (
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                )}
                            </div>
                            <span className="font-bold tracking-tight">
                                {status === "success" ? "Success!" : "An error occurred"}
                            </span>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
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
        rounded-md transition-all duration-150
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
    useVault,
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

/**
 * 💡 COMO USAR A ANIMAÇÃO MÁGICA DO VAULTPRIMARYBUTTON:
 * 
 * Para que o botão gerencie os estados (Loading -> Sucesso/Erro em tela cheia)
 * automaticamente, a função passada no `onClick` deve ser ASYNC e seguir 3 regras:
 * 
 * 1. VALIDAÇÃO (Cancelar silenciosamente): Se o formulário for inválido (ex: usando 
 *    `await trigger()` do react-hook-form), a função deve dar `return false;`. 
 *    Isso faz o botão parar o loading sem mostrar a tela verde.
 * 
 * 2. ERROS DE SERVIDOR (Tela Vermelha): Se a Server Action retornar um erro, 
 *    dispare um erro com `throw new Error("...");`. O botão vai capturar 
 *    isso e mostrar a tela vermelha.
 * 
 * 3. SUCESSO (Tela Verde): Se tudo der certo no final, não retorne `false` nem 
 *    lance erros. O botão fará a animação verde de sucesso cobrindo o Vault 
 *    inteiro e o fechará automaticamente após 1.5 segundos.
 * 
 * Exemplo prático de onSubmit:
 * const onSubmit = async () => {
 *   if (!(await trigger())) return false; // 1. Aborta se inválido
 *   const res = await executeAsync(data);
 *   if (res.error) throw new Error();     // 2. Tela vermelha se falhar
 *   reset();                              // 3. Sucesso! (Tela verde automática)
 * }
 */