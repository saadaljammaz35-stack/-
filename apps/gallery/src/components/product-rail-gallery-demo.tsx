'use client';

import ClothingRailHero from '@/components/ui/product-rail-gallery';
import type { RailGarment } from '@/components/ui/product-rail-gallery';

export const RAIL_DEMO_ITEMS: RailGarment[] = [
  {
    id: 'bone-tee',
    name: 'Heavyweight tee · Bone',
    kind: 'tee',
    color: '#EFEBE2',
    tag: '$48',
    description: '240 gsm organic cotton with a tonal DHxWHY embroidery on the chest.',
    details: ['240 gsm', 'Regular fit', 'Tonal embroidery'],
    image:
      'https://cdn.21st.dev/assets/mirror/14/1485bf44725b18fcdba71bfae54d67d648ab3bff4b24215a042c0cc4c895a2e6.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/69/69937e656430ae33d950303e0d53051273e5b02189750ef1e7429ec4bbf95e20.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/83/838468c32f16b4acba62e4601276737411156052444712ff2534fefe994a7bed.webp',
  },
  {
    id: 'cc-graphic',
    name: 'Graphic tee · CCgather',
    kind: 'tee',
    color: '#101214',
    tag: '$52',
    description: 'Black tee with the CCgather wordmark printed front and back.',
    details: ['240 gsm', 'Regular fit', 'Screen print'],
    image:
      'https://cdn.21st.dev/assets/mirror/d7/d769f183472d0fd98a7aff2a643593748cd36ef9da1497d9bf6f0d87d1025a9b.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/fe/fec6f7e96b198cc5b9aad333ca2c4c10968a746d87f6dc11d9c118607b509058.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/b3/b3b6984ea94b8b8cd19fb15387e89dca457ac0f947115c2a54a33217e4fb4571.webp',
  },
  {
    id: 'oxford-sky',
    name: 'Oxford shirt · Sky',
    kind: 'shirt',
    color: '#A3D3EB',
    tag: '$74',
    description: 'Pale sky oxford with a button-down collar and a tiny Maestiq embroidery.',
    details: ['Oxford cotton', 'Button-down collar', 'Chest pocket'],
    image:
      'https://cdn.21st.dev/assets/mirror/47/470a7723cef068f81e8a4c09d1ab3f8630c61b734c2168b10f3858e45efbf31f.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/9b/9be14e5dce879756775677e2d82dadc2ad9a1690b7df2f82de360cb3600d0ee5.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/59/5984d5ca60fd1aeee7e688ec33c2219a1c537fcde90d2accab813c13985f8632.webp',
  },
  {
    id: 'cardigan-olive',
    name: 'Knit cardigan · Olive',
    kind: 'knit',
    color: '#758151',
    tag: '$96',
    description: 'Chunky olive wool cardigan with wooden buttons and ribbed trims.',
    details: ['Lambswool', 'Wooden buttons', 'V-neck'],
    image:
      'https://cdn.21st.dev/assets/mirror/58/581b13c5ca241c653dc94d2c8048c92a60f022cfbaaf153261076d3a6655827e.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/d9/d9178d906d37268565cf10af3431aee543aacfc73610f7fa7b0fa4758c498cb3.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/de/dee1c529600e0460413f1a9b07a29bedb7ea7dc96181fce5d9d6501231e6e45d.webp',
  },
  {
    id: 'hoodie-heather',
    name: 'Hoodie · Maestiq',
    kind: 'hoodie',
    color: '#A0A5AB',
    tag: '$88',
    description: 'Heather fleece hoodie with the Maestiq wordmark across the chest.',
    details: ['400 gsm fleece', 'Kangaroo pocket', 'Chest print'],
    image:
      'https://cdn.21st.dev/assets/mirror/51/51750ba098dd622df46695bca781b3f0ec336a36b93b070e638cc04455def6d6.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/e7/e75c4ac8fb7f14caae756338a31f81f1437bb312b78e0d7d906e9f956e7968fa.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/a2/a2eb2463d52146c341ede6bb9f6067e917a23eb29b7b1d1d4c40ac084a01c7ce.webp',
  },
  {
    id: 'sweat-lilac',
    name: 'Crewneck sweatshirt · Lilac',
    kind: 'knit',
    color: '#CCB2E0',
    tag: '$78',
    description: 'Muted lilac fleece crewneck with a raised DHxWHY puff print.',
    details: ['400 gsm fleece', 'Ribbed trims', 'Puff print'],
    image:
      'https://cdn.21st.dev/assets/mirror/8e/8e38660e2add9637c27846d9b8d620f2abb228a5a153ccfd7b1c808b6845e1f8.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/b9/b9214a6e009ce4b3044595a51ea010c299135bab5b26775c43d7175c86e77898.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/59/591872e42b483c43c1cd08a3ac4d7d40c0b5fa2bc585a36096faded2e696e84e.webp',
  },
  {
    id: 'polo-forest',
    name: 'Piqué polo · Forest',
    kind: 'tee',
    color: '#185B37',
    tag: '$62',
    description: 'Forest piqué polo with a bone CCgather embroidery on the chest.',
    details: ['Piqué knit', 'Two-button placket', 'Embroidered'],
    image:
      'https://cdn.21st.dev/assets/mirror/19/19fe43cb681195ae227e3164088d86a07a1b6e33cc54c6e35637374736a16894.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/e0/e095182b1a7f04e600c5662aa871b4c055c294b152586817d84e312c22f744cf.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/00/005a8e10be234bc40917f3153208b8196ba1610c53c987e39942da1f4a7cd808.webp',
  },
  {
    id: 'henley-brick',
    name: 'Henley · Brick',
    kind: 'knit',
    color: '#B05139',
    tag: '$56',
    description: 'Dusty brick henley with a three-button placket, worn in from day one.',
    details: ['Slub cotton', 'Three buttons', 'Long sleeve'],
    image:
      'https://cdn.21st.dev/assets/mirror/84/84aa4b0e21ed11fcbc083647a607b94ee3a6c21cb66c114cfb1dad0792c15499.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/01/01c299df56a29afca8dad4a64858bd506667338bfbd0435118e6c3698c7881b3.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/9c/9ca38eeb156aae7d199d3c1ffb7947e395f77d1f094eea006c1b5fbb22352b4e.webp',
  },
  {
    id: 'breton',
    name: 'Breton long sleeve',
    kind: 'knit',
    color: '#E4DFD3',
    tag: '$58',
    description: 'Classic ink-and-bone Breton stripe with a boat neck.',
    details: ['220 gsm', 'Boat neck', 'Long sleeve'],
    image:
      'https://cdn.21st.dev/assets/mirror/09/096002a95aba7de9c197de4cb5c78cbbe17c1677b19c547cc20c6dbef47a899c.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/74/74408a7dbb4f4fc6761ebb8d6ed93187248cddf75e1c2e70d38d04dfdd328776.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/ed/eda3afca537071a80d7d82b3f0d1055b56f1f3263c20772224bae6660bf4072c.webp',
  },
  {
    id: 'oversized-ochre',
    name: 'Oversized tee · CCgather',
    kind: 'tee',
    color: '#DE9C31',
    tag: '$52',
    description: 'Boxy ochre tee with a small chest mark and a large CCgather back print.',
    details: ['Oversized', 'Dropped shoulder', 'Back print'],
    image:
      'https://cdn.21st.dev/assets/mirror/72/7208c811f54e123dd7b1a5c1c3926f43ca832f6c4c20c45de10671ffd544409d.webp',
    backImage:
      'https://cdn.21st.dev/assets/mirror/d3/d356989b7bc741c5cfc934cac34983dfb24d5d6a6b6e7b8b7f6b27cd3eceae69.webp',
    sideImage:
      'https://cdn.21st.dev/assets/mirror/bf/bf94beeafb21f9cb21aa45057a67dc8a2e23ba95c7ac0f79dd27ba3ce4a1230c.webp',
  },
];

export default function ClothingRailHeroDemo({ autoplay = true }: { autoplay?: boolean }) {
  return (
    <div
      data-rail-demo
      className="flex min-h-svh w-full items-center justify-center bg-background text-foreground"
    >
      <ClothingRailHero
        items={RAIL_DEMO_ITEMS}
        hanger="none"
        eyebrow="New season · Ten pieces on the rail"
        heading="A clothing rail you can handle, right on the page."
        caption="Brush along the rail, slide a hanger, lift a piece to see the back."
        autoplay={autoplay}
        action={
          <button
            type="button"
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            Shop the edit
          </button>
        }
      />
    </div>
  );
}
