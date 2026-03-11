---
description: Build UI components matching the Promptly SaaS landing page design language
argument-hint: "component name and description, e.g. 'pricing card with feature checklist and CTA button'"
allowed-tools: Edit, Write, Read
---

# Design Language: Promptly — Clean SaaS Marketing Site

You are building UI using the exact design language extracted from the Promptly (trypromptlyapp.com) website. Every component you write MUST adhere to the specifications below. Do not introduce new colors, fonts, spacing values, or component styles not listed here.

When the user runs `/build-ui [component description]`, you will:
1. Identify which component patterns from this spec apply
2. Write the component in React with Tailwind CSS (or plain HTML/CSS) using only the design tokens below
3. Include all relevant states (hover, focus, disabled)
4. Favor whitespace and typographic hierarchy over decorative elements
5. Match the clean, minimal, approachable SaaS marketing aesthetic

---

## Color Tokens

```css
:root {
  /* Backgrounds */
  --color-bg-page:         #ffffff;       /* main page background — pure white */
  --color-bg-section-alt:  #f9f9f8;       /* alternating section bg — off-white/warm gray */
  --color-bg-card:         #ffffff;       /* card backgrounds */
  --color-bg-card-muted:   #f5f5f4;       /* muted card / step block background */
  --color-bg-input:        #ffffff;       /* text inputs */
  --color-bg-tag:          #f0f0ef;       /* section label / overline tag bg */
  --color-bg-code-block:   #f7f7f6;       /* structured prompt output block */
  --color-bg-urgency:      #fff8f0;       /* countdown banner warm background */

  /* Brand / Accent */
  --color-accent-primary:       #18181b;  /* near-black — primary CTA, key headings */
  --color-accent-primary-hover: #27272a;
  --color-accent-orange:        #f97316;  /* orange — urgency banner, emoji highlights, italic accent text */
  --color-accent-orange-light:  #fff7ed;
  --color-accent-green:         #16a34a;  /* checkmark/feature included indicator */
  --color-accent-blue:          #3b82f6;  /* subtle link hover, focus ring */

  /* Text */
  --color-text-primary:    #18181b;   /* headings, key content */
  --color-text-body:       #3f3f46;   /* body copy */
  --color-text-secondary:  #71717a;   /* secondary labels, captions, step numbers */
  --color-text-muted:      #a1a1aa;   /* placeholder, disabled, footnotes */
  --color-text-inverse:    #ffffff;   /* text on dark/black buttons */
  --color-text-italic-em:  #f97316;   /* italic emphasized words in hero (orange) */

  /* Borders */
  --color-border-light:    #e4e4e7;   /* default card/input border */
  --color-border-medium:   #d4d4d8;   /* stronger dividers */
  --color-border-focus:    #18181b;   /* input focus — uses primary dark */

  /* Semantic */
  --color-coming-soon:     #a1a1aa;   /* muted gray for "COMING SOON" labels */
}
```

### Tailwind Config
```js
colors: {
  bg: {
    page:    '#ffffff',
    alt:     '#f9f9f8',
    card:    '#ffffff',
    muted:   '#f5f5f4',
    tag:     '#f0f0ef',
  },
  brand: {
    DEFAULT: '#18181b',
    hover:   '#27272a',
    orange:  '#f97316',
    green:   '#16a34a',
    blue:    '#3b82f6',
  },
  text: {
    primary:   '#18181b',
    body:      '#3f3f46',
    secondary: '#71717a',
    muted:     '#a1a1aa',
  },
  border: {
    light:  '#e4e4e7',
    medium: '#d4d4d8',
  }
}
```

---

## Typography Tokens

**Font Families:**
- **Primary (headings + body):** `"Geist"` or `"Inter"` — clean geometric sans-serif, rendered at high contrast
- **Mono (structured prompt output, code):** `"Geist Mono"` or `"JetBrains Mono"` — used for the generated prompt display blocks
- **No display or serif fonts** — this is a purely utilitarian, content-first aesthetic

**Type Scale:**

| Role              | Size      | Weight | Line Height | Letter Spacing | Notes                               |
|-------------------|-----------|--------|-------------|----------------|-------------------------------------|
| `hero-xl`         | 52–60px   | 700    | 1.1         | -0.03em        | Hero headline (desktop)             |
| `hero-md`         | 36–40px   | 700    | 1.15        | -0.02em        | Hero on mobile                      |
| `section-heading` | 32–36px   | 700    | 1.2         | -0.02em        | "What Promptly actually does"       |
| `card-heading`    | 20px      | 600    | 1.3         | -0.01em        | Benefit card titles, step headings  |
| `body-lg`         | 17–18px   | 400    | 1.6         | 0              | Hero sub-copy, section descriptions |
| `body`            | 15–16px   | 400    | 1.6         | 0              | Card body copy                      |
| `body-sm`         | 14px      | 400    | 1.5         | 0              | Captions, footnotes                 |
| `label`           | 12px      | 500    | 1.4         | 0.06em         | Section overline tags (ALL CAPS)    |
| `nav`             | 14–15px   | 500    | 1.4         | 0              | Navbar links                        |
| `btn`             | 14–15px   | 600    | 1            | 0              | Button labels                       |
| `price-lg`        | 40px      | 700    | 1.0         | -0.02em        | Pricing "$0/month"                  |
| `mono-body`       | 13px      | 400    | 1.6         | 0              | Prompt output block text            |
| `countdown`       | 28–32px   | 700    | 1.0         | -0.02em        | Countdown numbers                   |

**Key typographic treatments:**
- Hero headline uses italic `<em>` for one key phrase, colored `--color-text-italic-em` (orange): *"intent precise"*
- Bold `<strong>` used inline for contrast emphasis: **"Clear prompts in. Better output out."**
- Section overline tags are ALL CAPS, small, in a pill/tag with `--color-bg-tag` background
- Pricing headline (`$0/month`) is very large and bold — creates strong visual anchor
- Step numbers ("Step 1", "Step 2") are small, muted, uppercase

---

## Spacing & Layout Tokens

**Base Unit:** 4px

| Token   | Value  | Usage                                      |
|---------|--------|--------------------------------------------|
| `sp-1`  | 4px    | Tight inline gaps, icon margins            |
| `sp-2`  | 8px    | Badge/tag padding, tight row gap           |
| `sp-3`  | 12px   | Input padding (vertical), compact elements |
| `sp-4`  | 16px   | Default card inner padding                 |
| `sp-5`  | 20px   | Card padding (comfortable)                 |
| `sp-6`  | 24px   | Card padding (generous), section sub-gap   |
| `sp-8`  | 32px   | Between cards in a grid                    |
| `sp-10` | 40px   | Between section sub-elements               |
| `sp-16` | 64px   | Section top/bottom padding                 |
| `sp-24` | 96px   | Large section vertical padding             |
| `sp-32` | 128px  | Hero vertical padding                      |

**Layout:**
- **Max content width:** `1100px` (centered, `mx-auto`)
- **Horizontal page padding:** `24px` (mobile), `48px` (tablet), `80px` (desktop)
- **Navbar height:** `64px`
- **Section layout:** Single centered column for most sections; 3-column grid for benefits, 1-column stacked for process steps
- **Process steps:** Left-aligned, vertically stacked, max-width `640px` centered — each step is a self-contained card
- **Benefits grid:** 2–3 column CSS grid, equal-width cards, `gap-6`
- **Pricing:** Centered single card with max-width `400px`

---

## Border & Shape System

| Component              | Border Radius |
|------------------------|--------------|
| Buttons (primary)      | `9999px` (fully pill-shaped) |
| Buttons (secondary)    | `9999px` (fully pill-shaped) |
| Cards                  | `16px`       |
| Input fields           | `10px`       |
| Section overline tags  | `9999px` (pill) |
| Pricing card           | `20px`       |
| Testimonial cards      | `16px`       |
| Multi-choice option buttons | `8px`   |
| Countdown blocks       | `8px`        |
| Feature list items     | `0` (plain text with icon) |

**Borders:**
- Cards: `1px solid #e4e4e7`
- Inputs (default): `1px solid #e4e4e7`
- Inputs (focus): `1.5px solid #18181b`
- Navbar: `1px solid #e4e4e7` (bottom border on scroll, or always)
- No border on section overline tags — only background fill
- Pricing card: `1.5px solid #18181b` (emphasis border on the featured plan)

---

## Shadow & Elevation System

```css
/* Cards — very light, barely visible */
--shadow-card:       0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);

/* Elevated card (pricing, testimonials) */
--shadow-elevated:   0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);

/* Navbar on scroll */
--shadow-navbar:     0 1px 0 #e4e4e7;

/* Dropdown / popover */
--shadow-dropdown:   0 8px 24px rgba(0,0,0,0.12);

/* Input focus — no shadow, use border only */
```

This design uses **almost no shadows**. Elevation is communicated through border color differences, not depth. Only the pricing card and testimonials have slightly more visible shadows.

---

## Component Specifications

### Buttons

**Primary CTA (pill, dark)**
```jsx
// "Get started for free", "Get started"
<button className="
  inline-flex items-center gap-2
  bg-brand text-white font-semibold text-sm
  px-5 py-2.5 rounded-full
  hover:bg-brand-hover
  transition-colors duration-150
  whitespace-nowrap
">
  Get started for free
</button>
```

**Secondary / Ghost (pill, outlined)**
```jsx
// "View Pricing"
<button className="
  inline-flex items-center gap-2
  bg-transparent text-text-primary font-semibold text-sm
  px-5 py-2.5 rounded-full
  border border-border-light
  hover:border-border-medium hover:bg-bg-alt
  transition-all duration-150
">
  View Pricing
</button>
```

**Navbar CTA (pill, dark — compact)**
```jsx
<a className="
  inline-flex items-center
  bg-brand text-white font-semibold text-[13px]
  px-4 py-2 rounded-full
  hover:bg-brand-hover
  transition-colors duration-150
">
  Get started
</a>
```

**Multiple Choice Option Button (process step)**
```jsx
// Answer options like "Close-up", "Full body shot"
<button className="
  px-3 py-1.5 rounded-lg text-sm font-medium
  border border-border-light text-text-body
  bg-bg-card
  hover:border-border-medium hover:bg-bg-muted
  transition-all duration-150
">
  Close-up
</button>
```

---

### Navbar

```jsx
<nav className="
  fixed top-0 left-0 right-0 z-50
  h-16 bg-white/90 backdrop-blur-sm
  border-b border-border-light
  flex items-center justify-between
  px-8 max-w-[1100px] mx-auto
">
  {/* Logo */}
  <a className="flex items-center gap-2">
    <img src="/logo.png" className="w-7 h-7" alt="Promptly" />
    <span className="text-[15px] font-semibold text-text-primary">promptly</span>
  </a>

  {/* Nav links */}
  <div className="hidden md:flex items-center gap-7">
    {['Process', 'Benefits', 'Pricing', 'FAQs'].map(link => (
      <a className="text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors duration-150">
        {link}
      </a>
    ))}
  </div>

  {/* CTA */}
  <a className="bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-full hover:bg-brand-hover transition-colors">
    Get started
  </a>
</nav>
```

---

### Section Overline Tag

```jsx
// "Our Process", "Benefits", "Pricing"
<div className="inline-flex items-center">
  <span className="
    text-[11px] font-semibold uppercase tracking-[0.06em]
    text-text-secondary bg-bg-tag
    px-3 py-1 rounded-full
  ">
    Our Process
  </span>
</div>
```

---

### Hero Section

```jsx
<section className="pt-32 pb-20 text-center max-w-[720px] mx-auto px-6">
  {/* Urgency banner */}
  <div className="inline-flex items-center gap-2 bg-[#fff8f0] border border-[#fed7aa]
    text-[13px] text-text-body font-medium px-4 py-2 rounded-full mb-8">
    🚨 Free paid access ends in 🚨 &nbsp;
    <CountdownTimer />
  </div>

  {/* Headline */}
  <h1 className="text-[52px] font-bold text-text-primary leading-[1.1] tracking-[-0.03em] mb-5">
    Get more out of the AI<br/>you already use
  </h1>

  {/* Subheading */}
  <p className="text-[18px] text-text-body leading-relaxed mb-3">
    Promptly makes your <em className="text-brand-orange not-italic font-medium">intent precise</em> before the model ever responds.
  </p>
  <p className="text-[16px] font-semibold text-text-primary mb-8">
    Clear prompts in. Better output out.
  </p>

  {/* CTAs */}
  <div className="flex items-center justify-center gap-3">
    <PrimaryButton>Get started for free</PrimaryButton>
    <SecondaryButton>View Pricing</SecondaryButton>
  </div>
</section>
```

---

### Process Step Card

```jsx
// Steps 1–4 in the "What Promptly actually does" section
<div className="
  bg-bg-card rounded-2xl
  border border-border-light
  shadow-[0_1px_3px_rgba(0,0,0,0.06)]
  p-6 max-w-[640px] w-full
">
  {/* Step label */}
  <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-3">
    Step 1
  </p>

  {/* Step heading */}
  <h3 className="text-[18px] font-semibold text-text-primary mb-2">
    Describe your idea
  </h3>

  {/* Step description */}
  <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
    Even if it is unclear, write it down.
  </p>

  {/* Interactive UI mockup (varies by step) */}
  <div className="bg-bg-muted rounded-xl p-4 border border-border-light">
    {/* Step-specific inline demo */}
  </div>
</div>
```

**Chat/Input Mockup (Step 1)**
```jsx
<div className="bg-bg-card rounded-xl border border-border-light p-3 flex items-center gap-2">
  <span className="text-text-muted text-sm flex-1">What can I help with?</span>
  <div className="w-0.5 h-4 bg-text-primary animate-pulse" /> {/* cursor */}
  <div className="flex gap-2 ml-auto">
    {['Text', 'Image', 'Video'].map(t => (
      <span className="text-[12px] font-medium text-text-secondary bg-bg-muted px-2 py-1 rounded-md">{t}</span>
    ))}
  </div>
</div>
```

**Multiple Choice Mockup (Step 2)**
```jsx
<div className="space-y-2">
  <p className="text-sm text-text-body italic mb-3">"How should the composition be framed?"</p>
  <div className="flex flex-wrap gap-2">
    {['Close-up', 'Full body shot', 'Wide angle', 'Cinematic angle', 'Other ____'].map(opt => (
      <button className="px-3 py-1.5 text-sm rounded-lg border border-border-light
        text-text-body bg-bg-card hover:bg-bg-muted transition-colors">
        {opt}
      </button>
    ))}
  </div>
</div>
```

**Structured Prompt Output (Step 3)**
```jsx
<div className="bg-bg-muted rounded-xl border border-border-light p-4 text-[13px] font-mono
  text-text-body leading-relaxed max-h-48 overflow-y-auto space-y-2">
  <p><strong className="font-semibold text-text-primary">Subject:</strong> A dynamic portrayal of...</p>
  <p><strong className="font-semibold text-text-primary">Style / Medium:</strong> Photorealistic 3D render.</p>
  <p><strong className="font-semibold text-text-primary">Composition:</strong> Cinematic angle...</p>
  {/* etc */}
</div>
```

---

### Benefit Card

```jsx
// Used in 2–3 column grid for the "Benefits" section
<div className="
  bg-bg-card rounded-2xl
  border border-border-light
  p-6
  hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]
  transition-shadow duration-200
">
  <h3 className="text-[16px] font-semibold text-text-primary mb-2">
    Stop rewriting the same prompt
  </h3>
  <p className="text-[14px] text-text-secondary leading-relaxed">
    Promptly captures missing context upfront so you are not stuck making small edits and rerunning the model again and again.
  </p>
</div>
```

---

### Pricing Card

```jsx
<div className="
  bg-bg-card rounded-[20px]
  border-[1.5px] border-brand
  shadow-[0_4px_24px_rgba(0,0,0,0.08)]
  p-8 max-w-[400px] mx-auto
  flex flex-col gap-6
">
  {/* Plan name */}
  <div>
    <p className="text-[12px] font-semibold uppercase tracking-widest text-text-secondary mb-1">Starter</p>
    <p className="text-[40px] font-bold text-text-primary leading-none tracking-tight">
      $0<span className="text-[20px] font-medium text-text-secondary">/month</span>
    </p>
    <p className="text-[13px] text-text-secondary mt-2">
      Perfect for small businesses starting with AI automation.
    </p>
  </div>

  {/* CTA */}
  <PrimaryButton className="w-full justify-center">Get started for free</PrimaryButton>

  {/* Features */}
  <div className="space-y-3">
    <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
      What's Included:
    </p>
    {['Unlimited Prompts', 'Unlimited prompt history', 'Priority support'].map(f => (
      <div className="flex items-center gap-2.5">
        <svg className="w-4 h-4 text-brand-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
        <span className="text-[14px] text-text-body">{f}</span>
      </div>
    ))}

    {/* Coming soon */}
    <div className="pt-2 border-t border-border-light">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Coming Soon</p>
      {['Prompt library', 'Prompt versioning'].map(f => (
        <div className="flex items-center gap-2.5 opacity-50">
          <div className="w-4 h-4 rounded-full border border-border-medium flex-shrink-0" />
          <span className="text-[14px] text-text-muted">{f}</span>
        </div>
      ))}
    </div>
  </div>
</div>
```

---

### Testimonial Card

```jsx
<div className="
  bg-bg-card rounded-2xl border border-border-light
  shadow-[0_2px_8px_rgba(0,0,0,0.05)]
  p-6 flex flex-col gap-4
">
  <p className="text-[15px] text-text-body leading-relaxed">
    "Promptly feels less like an AI tool and more like a thinking aid that brings structure and sharpens intent before you hit generate."
  </p>
  <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border-light">
    <img className="w-10 h-10 rounded-full object-cover" src="/avatar.jpg" alt="" />
    <div>
      <p className="text-[14px] font-semibold text-text-primary">Rohan Bhatia</p>
      <p className="text-[12px] text-text-secondary">Associate at PWC</p>
    </div>
  </div>
</div>
```

---

### FAQ Accordion Item

```jsx
<div className="border-b border-border-light">
  <button className="w-full flex items-center justify-between py-5 text-left
    hover:text-text-primary transition-colors group">
    <span className="text-[15px] font-medium text-text-primary">
      How is this different from just iterating in ChatGPT?
    </span>
    <ChevronDownIcon size={18} className="text-text-muted flex-shrink-0
      group-data-[open]:rotate-180 transition-transform duration-200" />
  </button>
  <div className="pb-5 text-[14px] text-text-secondary leading-relaxed">
    {/* Answer content */}
  </div>
</div>
```

---

### Urgency / Countdown Banner

```jsx
<div className="
  inline-flex items-center gap-3 flex-wrap justify-center
  bg-[#fff8f0] border border-[#fed7aa]
  text-[13px] font-medium text-text-body
  px-5 py-2.5 rounded-full
  mb-8
">
  <span>🚨 Free paid access ends in 🚨</span>
  <div className="flex items-center gap-1.5">
    {[['1','8','DAYS'], ['1','0','HOURS'], ['1','5','MINUTES'], ['5','8','SECONDS']].map(([d1,d2,label]) => (
      <div className="flex flex-col items-center">
        <div className="flex gap-0.5">
          <span className="text-[24px] font-bold text-text-primary bg-white border border-border-light
            rounded-md w-8 h-9 flex items-center justify-center">{d1}</span>
          <span className="text-[24px] font-bold text-text-primary bg-white border border-border-light
            rounded-md w-8 h-9 flex items-center justify-center">{d2}</span>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted mt-1">{label}</span>
      </div>
    ))}
  </div>
</div>
```

---

### Logo Strip / Scrolling LLM Icons

```jsx
// Horizontal auto-scrolling strip of LLM provider logos
<div className="overflow-hidden relative">
  <div className="flex gap-8 animate-[scroll_20s_linear_infinite] w-max">
    {[...logos, ...logos].map((logo, i) => (
      <div key={i} className="w-16 h-16 rounded-2xl border border-border-light
        bg-bg-card shadow-[0_1px_4px_rgba(0,0,0,0.05)]
        flex items-center justify-center flex-shrink-0 p-3">
        <img src={logo.src} alt={logo.alt} className="w-full h-full object-contain" />
      </div>
    ))}
  </div>
</div>
```

---

### Footer

```jsx
<footer className="border-t border-border-light py-12 px-8 max-w-[1100px] mx-auto">
  <div className="flex flex-col md:flex-row items-start justify-between gap-8">
    {/* Logo + attribution */}
    <div className="flex flex-col gap-3">
      <a className="flex items-center gap-2">
        <img src="/logo.png" className="w-6 h-6" />
        <span className="text-[14px] font-semibold text-text-primary">promptly</span>
      </a>
      <p className="text-[12px] text-text-muted">
        Visioned and Crafted by Team Promptly
      </p>
    </div>

    {/* Links */}
    <div className="flex gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">Links</p>
        {['Features', 'Process', 'Benefits', 'Pricing'].map(l => (
          <a className="text-[13px] text-text-secondary hover:text-text-primary transition-colors">{l}</a>
        ))}
      </div>
    </div>
  </div>

  <div className="mt-8 pt-6 border-t border-border-light flex flex-wrap items-center justify-between gap-3">
    <p className="text-[12px] text-text-muted">© All rights reserved</p>
    <div className="flex gap-4">
      <a className="text-[12px] text-text-muted hover:text-text-secondary transition-colors">Privacy Policy</a>
      <a className="text-[12px] text-text-muted hover:text-text-secondary transition-colors">Terms and Conditions</a>
    </div>
  </div>
</footer>
```

---

## Layout Patterns

### Full Page Section Structure
```jsx
<main className="bg-white">
  {/* Sticky Navbar */}
  <Navbar />

  {/* Hero */}
  <section className="pt-32 pb-24 text-center">...</section>

  {/* Process — centered stacked cards */}
  <section className="py-24 bg-bg-alt">
    <div className="max-w-[640px] mx-auto px-6 space-y-5">
      <SectionTag>Our Process</SectionTag>
      <SectionHeading>What Promptly actually does</SectionHeading>
      <p className="text-text-secondary text-[16px]">...</p>
      <div className="space-y-4 mt-12">
        <StepCard step={1} /> <StepCard step={2} /> ...
      </div>
    </div>
  </section>

  {/* Benefits — 3-col grid */}
  <section className="py-24">
    <div className="max-w-[1100px] mx-auto px-8">
      <SectionTag>Benefits</SectionTag>
      <SectionHeading>Prompts you do not have to babysit</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
        <BenefitCard /> ...
      </div>
    </div>
  </section>

  {/* Pricing — centered single card */}
  <section className="py-24 bg-bg-alt text-center">...</section>

  {/* Testimonials — 2-col grid */}
  <section className="py-24">
    <div className="max-w-[900px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 px-8">
      <TestimonialCard /> ...
    </div>
  </section>

  {/* FAQs — centered single col */}
  <section className="py-24 max-w-[640px] mx-auto px-6">...</section>

  {/* Final CTA banner */}
  <section className="py-24 text-center">...</section>

  <Footer />
</main>
```

---

## Iconography

- **Library:** Lucide React — outlined style, consistent stroke width
- **Size scale:** `14px` (inline/caption), `16px` (default), `18px` (nav actions), `20px` (hero/CTA context)
- **Color:** Inherits `text-text-secondary`; shifts to `text-text-primary` on interaction
- **Checkmarks in pricing:** Custom SVG checkmark, `text-brand-green`, 16px
- **Chevrons in FAQ:** Rotate 180° on open with `transition-transform duration-200`
- **Emojis:** Used sparingly in urgency banners (🚨) and CTA buttons (none elsewhere)

---

## Motion & Interaction

- **Default transition:** `transition-colors duration-150` (color changes)
- **Shadow on hover:** `transition-shadow duration-200`
- **Scrolling logo strip:** CSS `@keyframes scroll` — `transform: translateX(-50%)` — `20s linear infinite`
- **FAQ accordion:** Height transition via `grid-rows` trick or `max-height` — `300ms ease-out`
- **Countdown numbers:** Digit flip animation (optional — `duration-500`)
- **No page-entry animations** — content is immediately visible, no scroll-triggered reveals
- **Hover on nav links:** `color` shift only — no underline, no background
- **Focus visible:** `outline-2 outline-offset-2 outline-brand` (keyboard only)
- **Button active state:** `scale-[0.97]` with `transition-transform duration-100`

---

## Aesthetic Identity

- **Style:** Minimal SaaS Marketing / Clean AI Product Landing Page
- **Density:** Spacious — generous whitespace, breathing room between all elements
- **Theme:** Light mode only — pure white backgrounds, no dark mode toggle
- **Personality:** Approachable, clear-headed, productivity-focused, slightly indie/bootstrapped
- **Distinctive signatures:**
  - **Italic + orange-colored emphasis** in hero headline for the key phrase
  - **Pill-shaped buttons** everywhere — no rectangular CTAs
  - **Inline product demos** embedded within process step cards (the UI mockups mid-page)
  - **Scrolling LLM logo strip** showing compatible AI tools
  - **Countdown urgency banner** in warm orange/amber pill shape
  - Very light card borders — almost invisible on white backgrounds, only perceptible on `bg-alt` sections
  - Step cards have their own contained interactive mockup showing each phase of the product flow
  - Extremely restrained color palette — the orange italic text in the hero is the most "colorful" element on the page

---

## Usage Examples

```
/build-ui "hero section with countdown urgency banner, large headline with italic orange emphasis, subtitle, and pill CTA buttons"

/build-ui "4-step process section with stacked cards, each containing a step label, heading, description, and inline interactive UI mockup"

/build-ui "benefits grid with 6 cards in 2-3 column layout, each card has a heading and short description, no icons"

/build-ui "pricing card with $0/month headline, feature checklist with green checkmarks, coming-soon greyed-out items, and full-width dark CTA button"

/build-ui "testimonial card grid with avatar, quote text, person name, and role — 2 columns, bordered cards"

/build-ui "FAQ accordion with question rows, chevron icons that rotate on open, and smooth height transition on answer reveal"

/build-ui "sticky navbar with logo on left, 4 nav links in center, pill CTA on right, frosted glass on scroll"
```