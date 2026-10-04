// The store catalog. Prices are in cents (3500 = $35.00). Edit freely; the site and checkout both read from here.
// Product photos: put them in public/store/ named <product-id>-1.jpg, <product-id>-2.jpg, ... (jpg, png or webp).

export interface Option { label: string; price: number }
export interface Product {
  id: string; name: string; kind: 'Art print' | 'Apparel' | 'Home' | 'Digital download';
  category: 'Art' | 'Apparel' | 'Home' | 'Digital'; price: number; blurb: string; description: string[];
  optionLabel?: string; options?: Option[]; digital?: boolean; art: 'print' | 'tee' | 'guide' | 'mug';
}

export const PRODUCTS: Product[] = [
  {
    id: 'seven-spirits-print', name: 'The Seven Spirits Before the Throne', kind: 'Art print', category: 'Art', price: 3500, art: 'print',
    blurb: 'The seven columns of fire, printed on museum-quality matte paper.',
    description: [
      'The Seven Spirits of God as John was shown them: seven tall columns of fire before the Throne, rising and meeting at their peak like feathers.',
      'Printed on heavyweight archival matte paper with rich, fade-resistant inks. Frame not included.',
    ],
    optionLabel: 'Size', options: [{ label: '8 × 10 in', price: 3500 }, { label: '12 × 16 in', price: 5500 }, { label: '18 × 24 in', price: 8500 }],
  },
  {
    id: 'seven-flames-tee', name: 'Seven Flames Tee', kind: 'Apparel', category: 'Apparel', price: 3200, art: 'tee',
    blurb: 'Soft, midweight cotton tee with the seven flames in gold.',
    description: ['The seven flames in warm gold on a deep charcoal tee. Soft, midweight cotton with a relaxed fit.', 'Unisex sizing. Machine wash cold, tumble dry low.'],
    optionLabel: 'Size', options: ['S', 'M', 'L', 'XL'].map((s) => ({ label: s, price: 3200 })).concat(['2XL', '3XL'].map((s) => ({ label: s, price: 3500 }))),
  },
  {
    id: 'seven-flames-mug', name: 'Seven Flames Mug', kind: 'Home', category: 'Home', price: 1800, art: 'mug',
    blurb: 'A 15 oz ceramic mug for your morning time with God.',
    description: ['Glossy 15 oz ceramic mug with the seven flames wrapped around it. Dishwasher and microwave safe.'],
  },
  {
    id: 'trail-of-sevens-guide', name: 'The Biblical Trail of Sevens Study Guide', kind: 'Digital download', category: 'Digital', price: 1200, art: 'guide', digital: true,
    blurb: 'A printable study guide to the sevens of Scripture, Genesis to Revelation.',
    description: [
      'Follow the number seven through the whole Bible, book by book, with the Scripture, short reflections and space for your own notes.',
      'A PDF you can download right after checkout, read on any device, or print at home.',
    ],
  },
];

export const priceOf = (p: Product, option?: string) => p.options?.find((o) => o.label === option)?.price ?? p.price;
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
export const fromPrice = (p: Product) => (p.options && new Set(p.options.map((o) => o.price)).size > 1 ? `From ${money(Math.min(...p.options.map((o) => o.price)))}` : money(p.price));
