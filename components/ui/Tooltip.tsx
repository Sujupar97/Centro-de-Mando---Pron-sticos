import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', delay = 300 }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showTooltip = () => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - gap;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + gap;
          break;
      }

      setCoords({ top, left });
      setVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const getTransformClass = () => {
    switch (position) {
      case 'top': return '-translate-x-1/2 -translate-y-full';
      case 'bottom': return '-translate-x-1/2';
      case 'left': return '-translate-x-full -translate-y-1/2';
      case 'right': return '-translate-y-1/2';
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          className={`fixed z-[110] pointer-events-none ${getTransformClass()}`}
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="bg-slate-800/95 backdrop-blur-xl text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-white/10 shadow-xl max-w-xs whitespace-normal leading-relaxed">
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
