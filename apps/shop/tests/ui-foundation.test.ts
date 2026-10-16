import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetTrigger } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Toaster } from '../components/ui/sonner';

it('renders Button with disabled semantics and merged caller styles', () => {
  const html = renderToStaticMarkup(h(Button, { disabled: true, className: 'h-12' }, 'Continue'));
  expect(html).toContain('disabled=""');
  expect(html).toContain('h-12');
  expect(html).not.toContain('h-10');
});
it('renders Input with its accessible name and input type', () => {
  expect(renderToStaticMarkup(h(Input, { type: 'email', 'aria-label': 'Email' }))).toContain('type="email"');
});
it('renders Label associated with its field', () => {
  expect(renderToStaticMarkup(h(Label, { htmlFor: 'email' }, 'Email'))).toContain('for="email"');
});
it('renders Sheet with an accessible collapsed trigger', () => {
  expect(renderToStaticMarkup(h(Sheet, null, h(SheetTrigger, null, 'Open cart')))).toContain('aria-expanded="false"');
});
it('renders DropdownMenu with a keyboard accessible menu trigger', () => {
  expect(renderToStaticMarkup(h(DropdownMenu, null, h(DropdownMenuTrigger, null, 'Options')))).toContain('aria-haspopup="menu"');
});
it('renders Select with combobox semantics and a placeholder', () => {
  const html = renderToStaticMarkup(h(Select, null, h(SelectTrigger, { 'aria-label': 'Sort' }, h(SelectValue, { placeholder: 'Newest' }))));
  expect(html).toContain('role="combobox"');
  expect(html).toContain('Newest');
});
it('renders Separator with an explicit nondecorative role', () => {
  expect(renderToStaticMarkup(h(Separator, { decorative: false }))).toContain('role="separator"');
});
it('renders Skeleton with caller supplied loading semantics', () => {
  expect(renderToStaticMarkup(h(Skeleton, { role: 'status', 'aria-label': 'Loading' }))).toContain('aria-label="Loading"');
});
it('renders Sonner with the installed shop theme variables', () => {
  const html = renderToStaticMarkup(h(Toaster));
  expect(html).toContain('aria-label=');
});
