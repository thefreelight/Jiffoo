export function pagePath(path: string, number: number): string {
  const url = new URL(path, 'http://shop.local');
  url.searchParams.set('page', String(number));
  return `${url.pathname}${url.search}`;
}
