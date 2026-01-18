# Design System Rules for AI & Developers

All changes to the UI must strictly adhere to the following design system principles. Do not deviate from this structure.

## 1. Single Source of Truth (`app/globals.css`)
All design tokens (colors, fonts, sizes, spacing) must be defined in `app/globals.css`. Do not hardcode values in components.

## 2. Variable Definitions (:root)
- **Location**: All CSS variables must be defined inside the `:root {}` block. Do NOT define them inside `@theme`.
- **Naming Convention**: Use descriptive, semantic names.
  - Fonts: `--font-size-*`, `--font-weight-*`, `--tracking-*`, `--leading-*`
  - Colors: `--color-*`
  - Sizes: `--size-*`, `--gap-*`
- **Scope**: Variables must explicitly cover all typography properties (size, weight, spacing, line-height).

## 3. No "Magic" Values in Components
- **Strictly Forbidden**: arbitrary Tailwind values or hardcoded styles in `.tsx` files.
  - ❌ `text-[20px]`, `font-[700]`, `gap-[2px]`
  - ❌ `text-[#2D5A75]`
- **Required**: Use **Semantic CSS Classes**.

## 4. Semantic Component Classes
Instead of cluttering HTML with utility classes, define composite classes in `app/globals.css` inside the `@layer components` block:

**Example (`app/globals.css`):**
```css
@layer components {
  .header-title {
      font-family: var(--font-family-header-title);
      font-size: var(--font-size-header-title);
      font-weight: var(--font-weight-header-title);
      color: var(--color-header-title);
      line-height: var(--leading-header-title);
      letter-spacing: var(--tracking-header-title);
  }
}
```

**Usage (`Component.tsx`):**
```tsx
<h1 className="header-title">{title}</h1>
```

## 5. Workflow for New Designs
1.  **Identify Attributes**: Determine the font size, weight, color, etc.
2.  **Create Variables**: Add them to `:root` in `globals.css`.
3.  **Create Class**: Define a new class in `@layer components` in `globals.css`.
4.  **Apply Class**: Use the class in your React component.

## 6. Avoid Explicit Formulas
- **Forbidden**: Do NOT use complex arbitrary values to access variables (e.g., `text-[length:var(--font-size-metric)]`).
- **Required**:
    1.  Map the variable to a standard Tailwind utility in the `@theme` block of `globals.css` (e.g., `--text-metric: var(--font-size-metric)`).
    2.  Use the clean utility class in your component (e.g., `text-metric`).
