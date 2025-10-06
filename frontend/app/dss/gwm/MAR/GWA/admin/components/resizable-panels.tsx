'use client';

import React, { useRef, useState, useEffect, ReactNode } from 'react';

interface ResizablePanelsProps {
  left: ReactNode;
  right: ReactNode;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({ left, right }) => {
  const [leftWidth, setLeftWidth] = useState<number>(55);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);
  const animationFrame = useRef<number>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      // Use requestAnimationFrame for smoothness
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      animationFrame.current = requestAnimationFrame(() => {
        const totalWidth = window.innerWidth;
        let newWidth = (e.clientX / totalWidth) * 100;
        newWidth = Math.max(20, Math.min(newWidth, 80));
        setLeftWidth(newWidth);
      });
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        setIsDragging(false);
        document.body.style.cursor = 'default';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full overflow-hidden select-none">
      <div
        style={{
          width: `${leftWidth}%`,
          transition: isDragging ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="min-w-0 flex flex-col"
      >
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          cursor: 'col-resize',
          width: '7px',
          background: isDragging ? '#bdbdbd' : '#e5e7eb',
          zIndex: 10,
          userSelect: 'none',
          transition: 'background 0.15s',
          borderRadius: '4px',
        }}
        className={`hover:bg-gray-400 ${isDragging ? 'bg-gray-500' : ''}`}
      />
      <div
        style={{
          width: `${100 - leftWidth}%`,
          transition: isDragging ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="min-w-0 flex flex-col"
      >
        {right}
      </div>
    </div>
  );
};

export default ResizablePanels;
