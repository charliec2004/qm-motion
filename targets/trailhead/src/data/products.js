// Placeholder catalog until the storefront reads from the product service.
export const products = [
  {
    slug: 'ridgeline-40-pack', category: 'Packs', name: 'Ridgeline 40 Pack', price: '$189',
    summary: 'A 40-litre pack for long days and quick overnights.',
    details: 'Roll-top main compartment, stretch front pocket, and a hip belt with zip pockets for snacks and a phone.',
    specs: [['Volume', '40 L'], ['Weight', '1.1 kg'], ['Torso', 'Adjustable']],
    care: 'Hand wash with mild soap and air dry. Keep zips clear of grit.',
    tone: 'moss',
  },
  {
    slug: 'switchback-shell', category: 'Jackets', name: 'Switchback Shell', price: '$240',
    summary: 'A light, packable rain shell for changeable weather.',
    details: 'Three-layer waterproof fabric, pit zips for venting, and a hood that fits over a helmet.',
    specs: [['Weight', '320 g'], ['Packed size', '1 L'], ['Fit', 'Regular']],
    care: 'Machine wash cold, tumble dry low to restore water repellency.',
    tone: 'slate',
  },
  {
    slug: 'scree-trail-runner', category: 'Footwear', name: 'Scree Trail Runner', price: '$150',
    summary: 'Grippy, cushioned shoes for rough and loose ground.',
    details: 'Sticky rubber outsole with 5 mm lugs, a rock plate, and a gusseted tongue to keep debris out.',
    specs: [['Drop', '6 mm'], ['Weight', '290 g'], ['Width', 'Standard']],
    care: 'Rinse off mud, remove the insoles, and dry away from direct heat.',
    tone: 'clay',
  },
  {
    slug: 'basecamp-2-tent', category: 'Shelter', name: 'Basecamp 2 Tent', price: '$320',
    summary: 'A freestanding two-person tent that pitches in minutes.',
    details: 'Two doors, two vestibules, and a single hub pole set colour-coded to its clips.',
    specs: [['Sleeps', '2'], ['Packed weight', '1.9 kg'], ['Floor area', '2.8 m²']],
    care: 'Dry fully before storing. Store loosely, not in the stuff sack.',
    tone: 'sand',
  },
];

export function findProduct(slug) {
  return products.find(product => product.slug === slug);
}
