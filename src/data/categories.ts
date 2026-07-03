export interface CategoryCard {
  title: string;
  image: string;
  imageAlt: string;
  links: { label: string; href: string }[];
}

export const categoryCards: CategoryCard[] = [
  {
    title: 'Laptops',
    image: '/images/categories/laptops.jpeg',
    imageAlt: 'Laptops productvergelijkingen',
    links: [
      { label: 'Mini pc', href: '/beste-mini-pc/' },
      { label: 'Laptop', href: '/beste-laptop/' },
      { label: 'Desktop', href: '/beste-desktop/' },
      { label: 'Macbook', href: '/beste-macbook/' },
      { label: 'Mini laptop', href: '/beste-mini-laptop/' },
      { label: 'Zakelijke laptop', href: '/beste-zakelijke-laptop/' },
      { label: 'Laptop met touchscreen', href: '/beste-laptop-met-touchscreen/' },
    ],
  },
  {
    title: 'Muziek',
    image: '/images/categories/speakers.jpeg',
    imageAlt: 'Muziek en speakers',
    links: [
      { label: 'Jbl charge', href: '/beste-jbl-charge/' },
      { label: 'Mp3 speler', href: '/beste-mp3-speler/' },
      { label: 'Jbl speaker', href: '/beste-jbl-speaker/' },
      { label: 'Platenspeler', href: '/beste-platenspeler/' },
      { label: 'Party speaker', href: '/beste-party-speaker/' },
      { label: 'Smart speaker', href: '/beste-smart-speaker/' },
      { label: 'Karaoke microfoon', href: '/beste-karaoke-microfoon/' },
    ],
  },
  {
    title: "Camera's",
    image: '/images/categories/cameras.jpeg',
    imageAlt: 'Camera productvergelijkingen',
    links: [
      { label: 'Camcorder', href: '/beste-camcorder/' },
      { label: 'Fotocamera', href: '/beste-fotocamera/' },
      { label: 'Videocamera', href: '/beste-videocamera/' },
      { label: 'Digitale camera', href: '/beste-digitale-camera/' },
      { label: 'Systeemcamera', href: '/beste-systeemcamera/' },
      { label: 'Compact camera', href: '/beste-compact-camera/' },
      { label: 'Spiegelreflexcamera', href: '/beste-spiegelreflexcamera/' },
    ],
  },
  {
    title: 'TV',
    image: '/images/categories/tv.jpeg',
    imageAlt: 'Televisie productvergelijkingen',
    links: [
      { label: '4k tv', href: '/beste-4k-tv/' },
      { label: 'Smart tv', href: '/beste-smart-tv/' },
      { label: '32 inch tv', href: '/beste-32-inch-tv/' },
      { label: '40 inch tv', href: '/beste-40-inch-tv/' },
      { label: '49 inch tv', href: '/beste-49-inch-tv/' },
      { label: '50 inch tv', href: '/beste-50-inch-tv/' },
      { label: '55 inch tv', href: '/beste-55-inch-tv/' },
    ],
  },
  {
    title: 'Wearables',
    image: '/images/categories/wearables.jpeg',
    imageAlt: 'Wearables productvergelijkingen',
    links: [
      { label: 'Ipad', href: '/beste-ipad/' },
      { label: 'Vr bril', href: '/beste-vr-bril/' },
      { label: 'Iphone', href: '/beste-iphone/' },
      { label: 'Hifi set', href: '/beste-hifi-set/' },
      { label: 'Earbuds', href: '/beste-earbuds/' },
      { label: 'Smartwatch', href: '/beste-smartwatch/' },
      { label: 'Smartphone', href: '/beste-smartphone/' },
    ],
  },
  {
    title: 'Drones',
    image: '/images/categories/drones.jpeg',
    imageAlt: 'Drone productvergelijkingen',
    links: [
      { label: 'Drone', href: '/beste-drone/' },
      { label: 'Mini drone', href: '/beste-mini-drone/' },
      { label: 'Kinder drone', href: '/beste-kinder-drone/' },
      { label: 'Racing drone', href: '/beste-racing-drone/' },
      { label: 'Onderwater drone', href: '/beste-onderwater-drone/' },
      { label: 'Drone met camera', href: '/beste-drone-met-camera/' },
      { label: 'Drone voor beginners', href: '/beste-drone-voor-beginners/' },
    ],
  },
];

export const featureItems = [
  { label: 'Gadgets', href: '#' },
  { label: 'Cadeaus', href: '#' },
  { label: 'Controllers', href: '#' },
  { label: "Game PC's", href: '/beste-game-pc/' },
  { label: 'Online gamen', href: '/gamen/' },
  { label: 'Games', href: '/gamen/' },
] as const;
