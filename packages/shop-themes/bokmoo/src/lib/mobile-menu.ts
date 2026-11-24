/* The header's menu button and the footer's mobile "Menu" tab open the same
   panel; the tab used to link to the categories page, which renders empty. */
export const OPEN_MOBILE_MENU_EVENT = 'bokmoo:open-mobile-menu';

export function requestOpenMobileMenu(): void {
  window.dispatchEvent(new CustomEvent(OPEN_MOBILE_MENU_EVENT));
}
