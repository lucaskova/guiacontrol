'use client';

import { motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  amount?: number;
  as?: 'div' | 'section' | 'span' | 'h2' | 'h3';
};

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  amount = 0.25,
  as = 'div',
}: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount }}
    >
      {children}
    </Comp>
  );
}
