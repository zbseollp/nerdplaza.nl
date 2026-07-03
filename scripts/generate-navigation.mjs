import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const nav = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/navigation.migrated.json'), 'utf8'));

function normalize(item) {
  let href = item.href;
  if (item.label === 'Home') href = '/';
  if (href !== '/' && !href.endsWith('/')) href += '/';
  if (href.startsWith('https://nerdplaza.nl')) {
    href = href.replace('https://nerdplaza.nl', '') || '/';
  }

  return {
    label: item.label,
    href,
    ...(item.children?.length
      ? { children: item.children.map(normalize) }
      : {}),
  };
}

const navigation = nav.map(normalize);

const output = `export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const mainNavigation: NavItem[] = ${JSON.stringify(navigation, null, 2)};
`;

fs.writeFileSync(path.join(ROOT, 'src/data/navigation.ts'), output);
console.log('Updated src/data/navigation.ts');
