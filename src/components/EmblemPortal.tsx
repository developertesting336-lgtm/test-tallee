"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const Hero3DEmblem = dynamic<{ isActive?: boolean }>(
    () => import("./Hero3DEmblem").then((mod) => mod.Hero3DEmblem),
    { ssr: false }
);

type SlotEntry = {
    id: string;
    el: HTMLDivElement;
    visible: boolean;
};

type EmblemContextValue = {
    registerSlot: (id: string, el: HTMLDivElement) => () => void;
};

const EmblemContext = createContext(null as EmblemContextValue | null);

export function EmblemProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const slotsRef = useRef({} as Record<string, SlotEntry>);
    const parkingRef = useRef(null as HTMLDivElement | null);
    const [targetEl, setTargetEl] = useState(null as HTMLDivElement | null);
    const [isActive, setIsActive] = useState(false);

    const pickActiveSlot = useCallback(() => {
        let active: SlotEntry | null = null;
        for (const slot of Object.values(slotsRef.current)) {
            if (slot.visible && document.body.contains(slot.el)) {
                active = slot;
                break;
            }
        }

        if (active) {
            setTargetEl(active.el);
            setIsActive(true);
        } else {
            setIsActive(false);
        }
    }, []);

    const registerSlot = useCallback(
        (id: string, el: HTMLDivElement) => {
            const entry: SlotEntry = { id, el, visible: false };
            slotsRef.current[id] = entry;

            const io = new IntersectionObserver(
                ([ioEntry]) => {
                    entry.visible = ioEntry.isIntersecting;
                    pickActiveSlot();
                },
                { rootMargin: "200px 0px" }
            );

            io.observe(el);

            return () => {
                io.disconnect();
                delete slotsRef.current[id];
                pickActiveSlot();
            };
        },
        [pickActiveSlot]
    );

    // Re-check slots immediately on route change
    useEffect(() => {
        const id = requestAnimationFrame(() => pickActiveSlot());
        return () => cancelAnimationFrame(id);
    }, [pathname, pickActiveSlot]);

    // Keep a single persistent host element alive in memory across route changes
    const hostNode = <Hero3DEmblem isActive={isActive} />;
    const portalDestination =
        targetEl && document.body.contains(targetEl) ? targetEl : parkingRef.current;

    return (
        <EmblemContext.Provider value={{ registerSlot }}>
            {children}

            {/* Hidden offscreen parking container when no slot is on the current page */}
            <div
                ref={parkingRef}
                aria-hidden="true"
                className="pointer-events-none fixed -left-[9999px] -top-[9999px] h-[700px] w-[700px] opacity-0"
            />

            {portalDestination ? createPortal(hostNode, portalDestination) : null}
        </EmblemContext.Provider>
    );
}

export function EmblemSlot({ className = "" }: { className?: string }) {
    const ctx = useContext(EmblemContext);
    const slotId = useId();
    const ref = useRef(null as HTMLDivElement | null);

    useEffect(() => {
        if (!ctx || !ref.current) return;
        return ctx.registerSlot(slotId, ref.current);
    }, [ctx, slotId]);

    return <div ref={ref} className={`relative h-full w-full ${className}`} />;
}