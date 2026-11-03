import {
  CORE_COLOR_ROLES, CORE_LENGTH_ROLES, CORE_FONT_ROLES,
  ADMIN_EXTRA_COLOR_ROLES, SHOP_EXTRA_COLOR_ROLES, SHOP_EXTRA_LENGTH_ROLES,
} from '../extensions/theme-contract';

/** The host surfaces that carry a theme of their own. */
export type ThemeSurface = 'shop' | 'admin';

/**
 * The extras of the storefront that are neither a colour nor a length.
 *
 * The shop is the only surface with them; the admin has none of them.
 */
const SHOP_EXTRA_OTHER_ROLES = ['type-scale', 'heading-weight', 'button-style', 'card-shadow'] as const;

/** Every role of the core group, in the order the theme contract declares them. */
function coreRoles(): readonly string[] {
  return [...CORE_COLOR_ROLES, ...CORE_LENGTH_ROLES, ...CORE_FONT_ROLES];
}

/** Every role of the extras group of a surface. */
function extraRoles(target: ThemeSurface): readonly string[] {
  if (target === 'admin') return [...ADMIN_EXTRA_COLOR_ROLES];
  return [...SHOP_EXTRA_COLOR_ROLES, ...SHOP_EXTRA_LENGTH_ROLES, ...SHOP_EXTRA_OTHER_ROLES];
}

/**
 * The theme variables of a surface, with their original names.
 *
 * The names follow the rule of the theme stylesheet: `--${target}-core-${role}`
 * for the core group and `--${target}-extras-${role}` for the extras group.
 * The storefront has 44 of them, the admin 25.
 */
export function pluginThemeVariables(target: ThemeSurface): string[] {
  return [
    ...coreRoles().map(role => `--${target}-core-${role}`),
    ...extraRoles(target).map(role => `--${target}-extras-${role}`),
  ];
}

/**
 * The neutral name of a theme variable.
 *
 * A plugin that serves both surfaces reads one name for the same role, so
 * `--shop-core-ground` is also offered as `--core-ground`. A name that is not
 * a theme variable of a surface keeps its own name.
 */
export function pluginThemeNeutralName(raw: string): string {
  const match = /^--(?:shop|admin)-(core|extras)-([a-z0-9-]+)$/.exec(raw);
  return match ? `--${match[1]}-${match[2]}` : raw;
}
