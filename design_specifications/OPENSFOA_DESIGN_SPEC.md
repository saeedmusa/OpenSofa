# OpenSofa PWA Design Specification
## A Billion-Dollar Design System

---

## 1. Design Philosophy

### Core Principles
- **Refined Minimalism**: Every element earns its place. Less, but better.
- **Depth through Glassmorphism**: Multiple translucent layers create spatial hierarchy
- **Quiet Confidence**: No visual noise. Premium feel through restraint.
- **Motion with Purpose**: Animations communicate state, never distract

### Design Inspirations
- **Apple**: Spatial hierarchy, SF Pro typography, subtle depth
- **Linear**: Dark sophistication, precise animations, developer-focused
- **Vercel**: Minimal elegance, mono-weight logo, clean whitespace
- **Arc Browser**: Creative glassmorphism, personality without unprofessionalism

---

## 2. Color Palette

### Foundation Colors

```css
/* Void Black - Deepest background */
--void: #030308;
--void-80: rgba(3, 3, 8, 0.8);
--void-60: rgba(3, 3, 8, 0.6);
--void-40: rgba(3, 3, 8, 0.4);

/* Obsidian - Primary surfaces */
--obsidian: #0a0a0f;
--obsidian-80: rgba(10, 10, 15, 0.8);
--obsidian-60: rgba(10, 10, 15, 0.6);
--obsidian-40: rgba(10, 10, 15, 0.4);

/* Slate - Elevated surfaces */
--slate: #12121a;
--slate-80: rgba(18, 18, 26, 0.8);
--slate-60: rgba(18, 18, 26, 0.6);

/* Graphite - Tertiary surfaces */
--graphite: #1a1a24;
--graphite-80: rgba(26, 26, 36, 0.8);

/* Ash - Borders and dividers */
--ash: rgba(255, 255, 255, 0.06);
--ash-strong: rgba(255, 255, 255, 0.10);
--ash-subtle: rgba(255, 255, 255, 0.03);
```

### Text Colors

```css
/* Text hierarchy */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-tertiary: rgba(255, 255, 255, 0.5);
--text-quaternary: rgba(255, 255, 255, 0.3);
--text-disabled: rgba(255, 255, 255, 0.2);
```

### Accent Colors - Emerald (Primary)

```css
/* Emerald - Primary accent (sophisticated green) */
--emerald: #10b981;
--emerald-bright: #34d399;
--emerald-dim: #059669;
--emerald-glow: rgba(16, 185, 129, 0.15);
--emerald-glow-strong: rgba(16, 185, 129, 0.25);
--emerald-surface: rgba(16, 185, 129, 0.08);

/* Emerald gradient for premium elements */
--emerald-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
--emerald-text-gradient: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%);
```

### Status Colors

```css
/* Success - Emerald family */
--success: #10b981;
--success-soft: rgba(16, 185, 129, 0.12);
--success-glow: rgba(16, 185, 129, 0.3);

/* Warning - Amber family */
--warning: #f59e0b;
--warning-soft: rgba(245, 158, 11, 0.12);
--warning-glow: rgba(245, 158, 11, 0.3);

/* Danger - Rose family */
--danger: #f43f5e;
--danger-soft: rgba(244, 63, 94, 0.12);
--danger-glow: rgba(244, 63, 94, 0.3);

/* Info - Cyan family */
--info: #06b6d4;
--info-soft: rgba(6, 182, 212, 0.12);
```

### Dark Mode Specific

```css
/* Subtle background gradients */
--bg-gradient: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.08), transparent);
--bg-gradient-warm: radial-gradient(ellipse 60% 40% at 80% 100%, rgba(16, 185, 129, 0.05), transparent);
```

---

## 3. Typography

### Font Stack

```css
/* Primary - SF Pro (Apple system font) */
--font-sans: 'SF Pro', -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;

/* Monospace - SF Mono */
--font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;

/* Display - SF Pro Display for headlines */
--font-display: 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

### Type Scale

```css
/* Mobile-first type scale */
--text-2xs: 0.625rem;   /* 10px - Labels */
--text-xs: 0.6875rem;   /* 11px - Fine print */
--text-sm: 0.75rem;      /* 12px - Secondary text */
--text-base: 0.875rem;   /* 14px - Body text */
--text-lg: 1rem;         /* 16px - Subheadings */
--text-xl: 1.125rem;     /* 18px - Section titles */
--text-2xl: 1.375rem;    /* 22px - Page titles */
--text-3xl: 1.75rem;     /* 28px - Hero titles */
--text-4xl: 2.25rem;     /* 36px - Display */

/* Desktop responsive */
@media (min-width: 768px) {
  --text-base: 0.9375rem;  /* 15px */
  --text-lg: 1.125rem;      /* 18px */
  --text-xl: 1.25rem;       /* 20px */
  --text-2xl: 1.5rem;       /* 24px */
  --text-3xl: 2rem;         /* 32px */
}
```

### Font Weights

```css
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### Line Heights

```css
--leading-tight: 1.2;   /* Headlines */
--leading-snug: 1.35;   /* Subheadings */
--leading-normal: 1.5;  /* Body text */
--leading-relaxed: 1.65; /* Large text */
```

### Letter Spacing

```css
--tracking-tight: -0.02em;   /* Large headlines */
--tracking-normal: 0;         /* Body */
--tracking-wide: 0.02em;     /* Small caps, labels */
--tracking-wider: 0.04em;    /* All caps */
```

---

## 4. Glassmorphism System

### Glass Layers

```css
/* Layer 1: Base surfaces */
.glass-base {
  background: var(--obsidian);
  border: 1px solid var(--ash);
}

/* Layer 2: Elevated glass */
.glass {
  background: var(--slate-80);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--ash-strong);
}

/* Layer 3: Floating glass (cards, modals) */
.glass-floating {
  background: var(--graphite-80);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ash-strong);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Layer 4: Overlay glass (modals, sheets) */
.glass-overlay {
  background: var(--void-80);
  backdrop-filter: blur(32px) saturate(150%);
  -webkit-backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--ash-subtle);
}
```

### Glass Effects

```css
/* Inner glow effect */
.glass-inner-glow {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* Outer glow effect (accent) */
.glass-glow {
  box-shadow: 
    0 0 0 1px var(--emerald-glow),
    0 0 20px var(--emerald-glow);
}

/* Refraction effect (top highlight) */
.glass-refraction::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg, 
    transparent 0%, 
    rgba(255, 255, 255, 0.3) 20%, 
    rgba(255, 255, 255, 0.5) 50%, 
    rgba(255, 255, 255, 0.3) 80%, 
    transparent 100%
  );
}
```

---

## 5. Component Specifications

### Buttons

```css
/* Primary Button */
.btn-primary {
  /* Sizing */
  padding: 0.625rem 1.25rem;
  min-height: 44px;
  border-radius: 12px;
  
  /* Visual */
  background: var(--emerald);
  color: var(--void);
  font-weight: var(--weight-semibold);
  font-size: var(--text-sm);
  
  /* Border */
  border: none;
  
  /* Shadow */
  box-shadow: 
    0 2px 8px rgba(16, 185, 129, 0.3),
    0 0 0 1px rgba(16, 185, 129, 0.1) inset;
  
  /* Transition */
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.btn-primary:hover {
  background: var(--emerald-bright);
  transform: translateY(-1px);
  box-shadow: 
    0 4px 16px rgba(16, 185, 129, 0.4),
    0 0 0 1px rgba(16, 185, 129, 0.2) inset;
}

.btn-primary:active {
  transform: translateY(0);
  background: var(--emerald-dim);
}

/* Secondary Button */
.btn-secondary {
  padding: 0.625rem 1.25rem;
  min-height: 44px;
  border-radius: 12px;
  
  background: var(--slate);
  color: var(--text-primary);
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
  
  border: 1px solid var(--ash-strong);
  
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.btn-secondary:hover {
  background: var(--graphite);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Ghost Button */
.btn-ghost {
  padding: 0.625rem 1rem;
  min-height: 44px;
  border-radius: 12px;
  
  background: transparent;
  color: var(--text-secondary);
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
  
  border: none;
  
  transition: all 0.15s ease;
}

.btn-ghost:hover {
  background: var(--ash-subtle);
  color: var(--text-primary);
}

/* Icon Button */
.btn-icon {
  width: 44px;
  height: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  
  background: transparent;
  color: var(--text-secondary);
  
  border: none;
  
  transition: all 0.15s ease;
}

.btn-icon:hover {
  background: var(--ash-subtle);
  color: var(--text-primary);
}

/* Danger Button */
.btn-danger {
  padding: 0.625rem 1.25rem;
  min-height: 44px;
  border-radius: 12px;
  
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: var(--weight-semibold);
  font-size: var(--text-sm);
  
  border: 1px solid rgba(244, 63, 94, 0.2);
  
  transition: all 0.2s ease;
}

.btn-danger:hover {
  background: var(--danger);
  color: white;
}
```

### Input Fields

```css
.input {
  /* Sizing */
  width: 100%;
  padding: 0.75rem 1rem;
  min-height: 48px;
  border-radius: 12px;
  
  /* Visual */
  background: var(--obsidian);
  color: var(--text-primary);
  font-size: var(--text-base);
  
  /* Border */
  border: 1px solid var(--ash-strong);
  
  /* Placeholder */
  &::placeholder {
    color: var(--text-quaternary);
  }
  
  /* Focus state */
  &:focus {
    outline: none;
    border-color: var(--emerald);
    box-shadow: 
      0 0 0 3px var(--emerald-glow),
      0 0 0 1px var(--emerald) inset;
  }
  
  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Transition */
  transition: all 0.2s ease;
}

/* Input with icon */
.input-icon {
  position: relative;
  
  .input {
    padding-left: 2.75rem;
  }
  
  .input-icon-left {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    pointer-events: none;
  }
}
```

### Cards

```css
/* Base Card */
.card {
  /* Layout */
  padding: 1.25rem;
  border-radius: 16px;
  
  /* Visual */
  background: var(--slate-80);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--ash);
  
  /* Transition */
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

/* Card hover state */
.card-interactive {
  cursor: pointer;
  
  &:hover {
    background: var(--graphite-80);
    border-color: var(--ash-strong);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
}

/* Floating Card (elevated) */
.card-floating {
  background: var(--graphite-80);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--ash-strong);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Accent Card (featured) */
.card-accent {
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--emerald-gradient);
    opacity: 0.6;
  }
}
```

### Modals & Sheets

```css
/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  
  background: var(--void-60);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  
  /* Animation */
  animation: modal-fade-in 0.2s ease forwards;
}

/* Modal content */
.modal {
  position: fixed;
  z-index: 51;
  
  /* Positioning */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  
  /* Sizing */
  width: calc(100% - 2rem);
  max-width: 420px;
  max-height: calc(100vh - 2rem);
  
  /* Visual */
  background: var(--graphite-80);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid var(--ash-strong);
  border-radius: 20px;
  
  /* Shadow */
  box-shadow: 
    0 24px 64px rgba(0, 0, 0, 0.5),
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  
  /* Animation */
  animation: modal-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Bottom Sheet (mobile) */
.sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 51;
  
  /* Sizing */
  max-height: calc(100vh - 2rem);
  border-radius: 24px 24px 0 0;
  
  /* Visual */
  background: var(--graphite-80);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid var(--ash-strong);
  border-bottom: none;
  
  /* Handle */
  &::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 4px;
    background: var(--ash-strong);
    border-radius: 2px;
  }
  
  /* Animation */
  animation: sheet-slide-up 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
```

### Badges & Tags

```css
/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  
  background: var(--ash-subtle);
  color: var(--text-secondary);
  
  border: 1px solid var(--ash);
}

/* Status Badge */
.badge-success {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.2);
}

.badge-warning {
  background: var(--warning-soft);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.2);
}

.badge-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: rgba(244, 63, 94, 0.2);
}

/* Live Badge (pulsing) */
.badge-live {
  background: var(--success-soft);
  color: var(--success);
  border-color: rgba(16, 185, 129, 0.3);
  
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse-live 2s infinite;
  }
}
```

### Status Indicators

```css
/* Status dot */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  transition: all 0.3s ease;
}

.status-dot-success {
  background: var(--success);
  box-shadow: 0 0 8px var(--success-glow);
}

.status-dot-warning {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning-glow);
}

.status-dot-danger {
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger-glow);
}

.status-dot-idle {
  background: var(--text-quaternary);
}
```

### Navigation

```css
/* Tab bar (mobile) */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  
  /* Visual */
  background: var(--obsidian-80);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--ash);
  
  /* Safe area */
  padding-bottom: env(safe-area-inset-bottom);
  
  /* Layout */
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 64px;
}

/* Tab item */
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.5rem 1rem;
  min-height: 44px;
  
  color: var(--text-tertiary);
  
  transition: color 0.15s ease;
  
  &.active {
    color: var(--emerald);
  }
  
  &:hover:not(.active) {
    color: var(--text-secondary);
  }
}

/* Header */
.header {
  position: sticky;
  top: 0;
  z-index: 30;
  
  /* Visual */
  background: var(--obsidian-80);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--ash-subtle);
  
  /* Safe area */
  padding-top: env(safe-area-inset-top);
}
```

### Skeleton Loaders

```css
/* Skeleton base */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--ash-subtle) 25%,
    var(--ash) 50%,
    var(--ash-subtle) 75%
  );
  background-size: 200% 100%;
  
  animation: skeleton-shimmer 1.5s infinite;
  
  border-radius: 8px;
}

.skeleton-text {
  height: 14px;
  width: 100%;
}

.skeleton-heading {
  height: 24px;
  width: 60%;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

---

## 6. Logo Design

### Concept: "The Portal"

The OpenSofa logo represents a doorway to AI-powered coding—a portal between human intent and machine execution.

```svg
<!-- Logo SVG - Minimalist, geometric, memorable -->
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer ring - represents the "Sofa" / enclosure -->
  <circle 
    cx="32" 
    cy="32" 
    r="28" 
    stroke="url(#emerald-gradient)" 
    stroke-width="3" 
    fill="none"
    stroke-linecap="round"
  />
  
  <!-- Inner portal - represents the AI agent -->
  <circle 
    cx="32" 
    cy="32" 
    r="16" 
    fill="url(#emerald-gradient)"
    fill-opacity="0.15"
    stroke="url(#emerald-gradient)"
    stroke-width="2"
  />
  
  <!-- Central dot - the spark of intelligence -->
  <circle 
    cx="32" 
    cy="32" 
    r="4"
    fill="url(#emerald-gradient)"
  />
  
  <!-- Gradient definitions -->
  <defs>
    <linearGradient id="emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
</svg>
```

### Logo Variations

```css
/* Compact - For icons, favicons */
.logo-compact {
  width: 32px;
  height: 32px;
}

/* Standard - For headers, auth screens */
.logo-standard {
  width: 48px;
  height: 48px;
}

/* Large - For landing, empty states */
.logo-large {
  width: 80px;
  height: 80px;
}

/* With text */
.logo-with-text {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Wordmark styling */
.logo-wordmark {
  font-family: var(--font-display);
  font-weight: var(--weight-semibold);
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  background: var(--emerald-text-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 7. Animation System

### Timing Functions

```css
/* Smooth, natural easing */
--ease-out: cubic-bezier(0.2, 0, 0, 1);
--ease-in: cubic-bezier(0.7, 0, 1, 1);
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);

/* Bouncy for playful elements */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Snappy for micro-interactions */
--ease-snappy: cubic-bezier(0.2, 0, 0, 1);

/* Spring physics approximation */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Duration Scale

```css
--duration-instant: 0.1s;    /* Micro-interactions */
--duration-fast: 0.15s;      /* Hovers, toggles */
--duration-normal: 0.2s;     /* Standard transitions */
--duration-slow: 0.3s;       /* Reveals, modals */
--duration-slower: 0.4s;     /* Page transitions */
--duration-slowest: 0.5s;    /* Dramatic reveals */
```

### Keyframe Animations

```css
/* Fade in (opacity) */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in up */
@keyframes fade-in-up {
  from { 
    opacity: 0; 
    transform: translateY(12px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

/* Scale in (modals, tooltips) */
@keyframes scale-in {
  from { 
    opacity: 0; 
    transform: scale(0.95); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

/* Slide up (sheets, drawers) */
@keyframes slide-up {
  from { 
    opacity: 0; 
    transform: translateY(100%); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

/* Modal specific */
@keyframes modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-scale-in {
  from { 
    opacity: 0; 
    transform: translate(-50%, -50%) scale(0.96); 
  }
  to { 
    opacity: 1; 
    transform: translate(-50%, -50%) scale(1); 
  }
}

/* Sheet specific */
@keyframes sheet-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Pulse live (status indicators) */
@keyframes pulse-live {
  0%, 100% { 
    opacity: 1;
    transform: scale(1);
  }
  50% { 
    opacity: 0.5;
    transform: scale(0.8);
  }
}

/* Skeleton shimmer */
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Subtle float */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Glow pulse */
@keyframes glow-pulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 var(--emerald-glow);
  }
  50% { 
    box-shadow: 0 0 20px 4px var(--emerald-glow);
  }
}
```

### Animation Utilities

```css
/* Utility classes */
.animate-fade-in {
  animation: fade-in var(--duration-normal) var(--ease-out) forwards;
}

.animate-fade-in-up {
  animation: fade-in-up var(--duration-slow) var(--ease-out) forwards;
}

.animate-scale-in {
  animation: scale-in var(--duration-normal) var(--ease-spring) forwards;
}

.animate-slide-up {
  animation: slide-up var(--duration-slow) var(--ease-bounce) forwards;
}

/* Stagger children */
.stagger-children > * {
  opacity: 0;
  animation: fade-in-up var(--duration-slow) var(--ease-out) forwards;
}

.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
.stagger-children > *:nth-child(4) { animation-delay: 150ms; }
.stagger-children > *:nth-child(5) { animation-delay: 200ms; }
.stagger-children > *:nth-child(6) { animation-delay: 250ms; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Spacing System

### Base Unit: 4px

```css
/* Spacing scale */
--space-0: 0;
--space-0.5: 0.125rem;   /* 2px */
--space-1: 0.25rem;      /* 4px */
--space-1.5: 0.375rem;   /* 6px */
--space-2: 0.5rem;        /* 8px */
--space-2.5: 0.625rem;    /* 10px */
--space-3: 0.75rem;       /* 12px */
--space-3.5: 0.875rem;    /* 14px */
--space-4: 1rem;          /* 16px */
--space-5: 1.25rem;       /* 20px */
--space-6: 1.5rem;        /* 24px */
--space-7: 1.75rem;       /* 28px */
--space-8: 2rem;          /* 32px */
--space-9: 2.25rem;       /* 36px */
--space-10: 2.5rem;       /* 40px */
--space-12: 3rem;         /* 48px */
--space-14: 3.5rem;       /* 56px */
--space-16: 4rem;         /* 64px */
--space-20: 5rem;         /* 80px */
--space-24: 6rem;         /* 96px */
```

### Border Radius

```css
/* Radius scale */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

---

## 9. Shadows

```css
/* Subtle - For subtle elevation */
--shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.3);

/* Small - Cards, inputs */
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);

/* Medium - Floating elements */
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);

/* Large - Modals, sheets */
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3);

/* XL - Overlays */
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4);

/* Accent glow */
--shadow-emerald: 0 0 24px rgba(16, 185, 129, 0.2);
--shadow-emerald-strong: 0 0 32px rgba(16, 185, 129, 0.35);
```

---

## 10. Responsive Breakpoints

```css
/* Mobile-first breakpoints */
/* Base: 375px+ (mobile) */
/* sm: 640px+ (large phones, small tablets) */
/* md: 768px+ (tablets) */
/* lg: 1024px+ (laptops) */
/* xl: 1280px+ (desktops) */
/* 2xl: 1536px+ (large desktops) */

@media (min-width: 640px) {
  /* Large phones, small tablets */
}

@media (min-width: 768px) {
  /* Tablets */
  .tablet\:hidden { display: none; }
  .tablet\:flex { display: flex; }
}

@media (min-width: 1024px) {
  /* Laptops */
  .desktop\:hidden { display: none; }
  .desktop\:flex { display: flex; }
}
```

---

## 11. Accessibility

### Focus States

```css
/* Focus ring */
:focus-visible {
  outline: none;
  box-shadow: 
    0 0 0 2px var(--obsidian),
    0 0 0 4px var(--emerald);
}

/* Alternative focus for dark backgrounds */
.focus-ring-dark:focus-visible {
  box-shadow: 
    0 0 0 2px var(--void),
    0 0 0 4px var(--emerald);
}
```

### Color Contrast

```css
/* All text meets WCAG AA (4.5:1 minimum) */
/* Primary text: #ffffff on #0a0a0f = 19:1 */
/* Secondary text: rgba(255,255,255,0.7) on #0a0a0f = 10:1 */
/* Tertiary text: rgba(255,255,255,0.5) on #0a0a0f = 5.5:1 (AA for large text) */
```

### Touch Targets

```css
/* Minimum touch target size */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Implementation Checklist

### Phase 1: Foundation
- [ ] Update CSS variables in index.css
- [ ] Create glass utility classes
- [ ] Update Tailwind config with new colors
- [ ] Create animation keyframes

### Phase 2: Components
- [ ] Update button styles
- [ ] Update card styles
- [ ] Update input styles
- [ ] Update modal styles
- [ ] Update badge styles

### Phase 3: Layout
- [ ] Update header styles
- [ ] Update tab bar styles
- [ ] Update floating elements

### Phase 4: Polish
- [ ] Update logo (SVG)
- [ ] Add skeleton loaders
- [ ] Refine animations
- [ ] Test accessibility

---

## Summary: Key Changes from Current Design

| Aspect | Current | New Design |
|--------|---------|------------|
| Primary Accent | #39ff14 (Neon) | #10b981 (Emerald) |
| Background | #0d0d12 (Grey) | #030308 (Void Black) |
| Glass Blur | 16px | 20-32px with saturation |
| Borders | Green tint | Neutral ash |
| Logo | Complex SVG | Minimal "Portal" |
| Typography | Basic | Optimized scale |
| Animations | Basic | Spring physics |
| Feel | Amateur | Premium |

---

*This design specification is the foundation for OpenSofa's billion-dollar PWA redesign. All implementations should follow these guidelines.*
