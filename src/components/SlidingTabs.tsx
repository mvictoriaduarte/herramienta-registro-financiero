"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type TabItem<T extends string> = {
  id: T;
  label: string;
};

export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const index = tabs.findIndex((tab) => tab.id === value);
    const button = buttonRefs.current[index];
    if (!container || !button) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    setIndicator({
      left: buttonRect.left - containerRect.left,
      top: buttonRect.top - containerRect.top,
      width: buttonRect.width,
      height: buttonRect.height,
      ready: true,
    });
  }, [tabs, value]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(container);
    for (const button of buttonRefs.current) {
      if (button) {
        observer.observe(button);
      }
    }
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator, tabs]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex rounded-[22px] bg-white/45 p-1.5 backdrop-blur"
      role="tablist"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[16px] bg-petroleum shadow-[0_10px_24px_rgba(14,74,90,0.2)]"
        style={{
          left: indicator.left,
          top: indicator.top,
          width: indicator.width,
          height: indicator.height,
          opacity: indicator.ready ? 1 : 0,
          transition: indicator.ready
            ? "left 320ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "opacity 150ms ease",
        }}
      />
      {tabs.map((tab, index) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 rounded-[16px] px-3 py-2.5 text-sm font-semibold transition-colors duration-200 sm:px-5 ${
              active ? "text-white" : "text-petroleum hover:bg-white/40"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
