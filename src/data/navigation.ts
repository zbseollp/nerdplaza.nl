export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const mainNavigation: NavItem[] = [
  {
    "label": "Home",
    "href": "/"
  },
  {
    "label": "Kantoorartikelen",
    "href": "/kantoorartikelen/",
    "children": [
      {
        "label": "Printer",
        "href": "/beste-printer/"
      },
      {
        "label": "Laptop",
        "href": "/beste-laptop/"
      },
      {
        "label": "Beamer",
        "href": "/beste-beamer/"
      },
      {
        "label": "Usb stick",
        "href": "/beste-usb-stick/"
      },
      {
        "label": "Laptoptas",
        "href": "/beste-laptoptas/"
      },
      {
        "label": "Laptopmuis",
        "href": "/beste-laptopmuis/"
      },
      {
        "label": "Toetsenbord",
        "href": "/beste-toetsenbord/"
      },
      {
        "label": "Label printer",
        "href": "/beste-label-printer/"
      },
      {
        "label": "Wifi versterker",
        "href": "/beste-wifi-versterker/"
      },
      {
        "label": "Externe harde schijf",
        "href": "/beste-externe-harde-schijf/"
      }
    ]
  },
  {
    "label": "Gamen",
    "href": "/gamen/",
    "children": [
      {
        "label": "Game pc",
        "href": "/beste-game-pc/"
      },
      {
        "label": "Gameboy",
        "href": "/beste-gameboy/"
      },
      {
        "label": "Racestoel",
        "href": "/beste-racestoel/"
      },
      {
        "label": "Gamestoel",
        "href": "/beste-gamestoel/"
      },
      {
        "label": "Playstation",
        "href": "/beste-playstation/"
      },
      {
        "label": "Gaming muis",
        "href": "/beste-gaming-muis/"
      },
      {
        "label": "Gaming router",
        "href": "/beste-gaming-router/"
      },
      {
        "label": "Gaming laptop",
        "href": "/beste-gaming-laptop/"
      },
      {
        "label": "Gaming monitor",
        "href": "/beste-gaming-monitor/"
      },
      {
        "label": "Gaming headset",
        "href": "/beste-gaming-headset/"
      }
    ]
  },
  {
    "label": "Muziek",
    "href": "/muziek/",
    "children": [
      {
        "label": "Earbuds",
        "href": "/beste-earbuds/"
      },
      {
        "label": "Soundbar",
        "href": "/beste-soundbar/"
      },
      {
        "label": "Jbl charge",
        "href": "/beste-jbl-charge/"
      },
      {
        "label": "Pc-speaker",
        "href": "/beste-pc-speaker/"
      },
      {
        "label": "Pc speaker",
        "href": "/beste-pc-speaker/"
      },
      {
        "label": "Jbl speaker",
        "href": "/beste-jbl-speaker/"
      },
      {
        "label": "Koptelefoon",
        "href": "/beste-koptelefoon/"
      },
      {
        "label": "Mp 3 speler",
        "href": "/beste-mp3-speler/"
      },
      {
        "label": "Platenspeler",
        "href": "/beste-platenspeler/"
      },
      {
        "label": "Iphone kabel",
        "href": "/beste-iphone-kabel/"
      }
    ]
  },
  {
    "label": "Streamen",
    "href": "/streamen/",
    "children": [
      {
        "label": "Dune",
        "href": "/dune-streamen/"
      },
      {
        "label": "Barbie",
        "href": "/barbie-streamen/"
      },
      {
        "label": "Grease",
        "href": "/grease-streamen/"
      },
      {
        "label": "Friends",
        "href": "/friends-streamen/"
      },
      {
        "label": "Titanic",
        "href": "/titanic-streamen/"
      },
      {
        "label": "Minions",
        "href": "/minions-streamen/"
      },
      {
        "label": "South Park",
        "href": "/south-park-streamen/"
      },
      {
        "label": "Yellowstone",
        "href": "/yellowstone-streamen/"
      },
      {
        "label": "Despicable Me",
        "href": "/despicable-me-streamen/"
      },
      {
        "label": "Avatar: The Way of Water",
        "href": "/avatar-the-way-of-water--streamen/"
      }
    ]
  },
  {
    "label": "Contact",
    "href": "/contact/"
  }
];
