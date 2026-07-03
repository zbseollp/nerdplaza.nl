export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export const footerColumns: FooterColumn[] = [
  {
    title: 'Informatie',
    links: [
      { label: 'Sitemap', href: '/sitemap/' },
      { label: 'Blog', href: '/blog/' },
      { label: 'Links', href: '/links/' },
      { label: 'Home', href: '/' },
      { label: 'Contact', href: '/contact/' },
      { label: 'Drones', href: '/drones/' },
      { label: 'Gamen', href: '/gamen/' },
      { label: 'Muziek', href: '/muziek/' },
      { label: 'Streamen', href: '/streamen/' },
      { label: 'Televisies', href: '/televisies/' },
      { label: 'Vermogen', href: '/vermogen/' },
      { label: 'Wearables', href: '/wearables/' },
      { label: 'Kantoorartikelen', href: '/kantoorartikelen/' },
    ],
  },
  {
    title: 'Drones',
    links: [
      { label: 'Drone', href: '/beste-drone/' },
      { label: 'Mini drone', href: '/beste-mini-drone/' },
      { label: 'Racing drone', href: '/beste-racing-drone/' },
      { label: 'Kinder drone', href: '/beste-kinder-drone/' },
      { label: 'Drone camera', href: '/beste-drone-camera/' },
      { label: 'Drone met camera', href: '/beste-drone-met-camera/' },
      { label: 'Drone voor beginners', href: '/beste-drone-voor-beginners/' },
    ],
  },
  {
    title: 'Laptops',
    links: [
      { label: 'Laptop', href: '/beste-laptop/' },
      { label: 'Macbook', href: '/beste-macbook/' },
      { label: 'Ultrabook', href: '/beste-ultrabook/' },
      { label: 'Mini laptop', href: '/beste-mini-laptop/' },
      { label: 'Chromebook', href: '/beste-chromebook/' },
      { label: 'Laptop fotobewerking', href: '/beste-laptop-fotobewerking/' },
      { label: 'Laptop met touchscreen', href: '/beste-laptop-met-touchscreen/' },
    ],
  },
  {
    title: 'Vermogen',
    links: [
      { label: 'Carlo Nasi', href: '/vermogen-van-carlo-nasi/' },
      { label: 'Cees Engel', href: '/vermogen-van-cees-engel/' },
      { label: 'Chris Woerts', href: '/vermogen-van-chris-woerts/' },
      { label: 'Carlos Alcaraz', href: '/vermogen-van-carlos-alcaraz/' },
      { label: 'Chahid Charrak', href: '/vermogen-van-chahid-charrak/' },
      { label: 'Clarence Seedorf', href: '/vermogen-van-clarence-seedorf/' },
      { label: 'Caroline van der Plas', href: '/vermogen-van-caroline-van-der-plas/' },
    ],
  },
];

export const socialLinks = [
  { label: 'Facebook', href: '#', icon: 'facebook' },
  { label: 'Instagram', href: '#', icon: 'instagram' },
  { label: 'Twitter', href: '#', icon: 'twitter' },
  { label: 'YouTube', href: '#', icon: 'youtube' },
] as const;
