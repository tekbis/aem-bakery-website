/* AEM Bakery — product catalogue.
   Edit prices, names and descriptions here. `id` must stay unique.
   category: rolls | treats | bakes        badge: optional short label     */
window.AEM_PRODUCTS = [
  { id: 'vanilla-bean-cinnamon-rolls', inBasket: true, name: 'Vanilla Bean Cinnamon Rolls', price: 12, category: 'rolls', image: 'studio-rolls.webp', photo: 'menu-18.webp', tagline: 'Soft, frosted and full of comfort', description: 'A 4-pack of cinnamon rolls with vanilla bean flavoring you can see and taste, baked in an 8 × 8 pan.', badge: 'Bestseller' },
  { id: 'chocolate-chip-toffee-cookies', inBasket: true, name: 'Chocolate Chip Toffee Cookies', price: 3, category: 'treats', image: 'studio-cookies.webp', photo: 'menu-1.webp', tagline: 'A little chocolate. A little crunch.', description: 'Golden-edged cookies loaded with chocolate chips and crunchy toffee bits. Soft in the middle, just how they should be.', badge: 'Fan favorite' },
  { id: 'mini-french-baguettes', name: 'Mini French Baguettes', price: 8, category: 'bakes', image: 'studio-bread.webp', photo: 'menu-2.webp', tagline: 'Golden little loaves for your table', description: 'Crisp golden crust and a soft, airy centre. Perfect for dinner, sandwiches or tearing and sharing.', badge: 'Bread basket' },
  { id: 'brown-butter-banana-cake-with-caramel-cream-cheese-frosting', inBasket: true, name: 'Brown Butter Banana Cake', price: 15, category: 'bakes', image: 'studio-cake.webp', photo: 'menu-8.webp', tagline: 'With caramel cream cheese frosting', description: 'Moist brown butter banana cake topped with a ribbon of caramel cream cheese frosting.', badge: 'Something sweet' },
  { id: 'biscoff-cinnamon-rolls', name: 'Biscoff Cinnamon Rolls', price: 12, category: 'rolls', image: 'menu-14.webp', tagline: 'Cookie butter meets a cozy swirl', description: 'Soft cinnamon rolls with cookie butter frosting and a Biscoff cookie on top.' },
  { id: 'strawberry-cinnamon-rolls', name: 'Strawberry Cinnamon Rolls', price: 12, category: 'rolls', image: 'studio-strawberry.webp', photo: 'menu-16.webp', tagline: 'A sweet little berry moment', description: 'Pink strawberry frosting on our soft, fluffy cinnamon swirl.' },
  { id: 'maple-cinnamon-scones-with-maple-frosting', name: 'Maple Cinnamon Scones', price: 15, category: 'bakes', image: 'studio-scones.webp', photo: 'menu-9.webp', tagline: 'Finished with maple frosting', description: 'Tender cinnamon scones finished with a sweet maple glaze.' },
  { id: 'rice-crispy-bars', name: 'Rice Crispy Bars', price: 2, category: 'treats', image: 'studio-crispy.webp', photo: 'menu-6.webp', tagline: 'A little crispy, a little chewy', description: 'Classic, chewy marshmallow rice crispy bars.' },
  { id: 'pound-cake', name: 'Pound Cake', price: 3, category: 'bakes', image: 'menu-0.webp', tagline: 'Simple homemade sweetness', description: 'A buttery, tight-crumbed slice of simple homemade pound cake.' },
  { id: 'sandwich-bread', name: 'Sandwich Bread', price: 8, category: 'bakes', image: 'menu-3.webp', tagline: 'For toast, sandwiches and sharing', description: 'A soft homemade loaf for toast, sandwiches and everything in between.' },
  { id: 'filled-chocolate', name: 'Filled Chocolate', price: 6, category: 'treats', image: 'menu-4.webp', tagline: 'A little chocolate indulgence', description: 'Filled chocolates — a small treat for you or someone you love.' },
  { id: 'puppy-chow', name: 'Puppy Chow', price: 5, category: 'treats', image: 'menu-5.webp', tagline: 'A sweet snack to share', description: 'The Midwest classic snack mix — sweet, crunchy and made for sharing.' },
  { id: 'rice-crispy-pan', name: 'Rice Crispy Pan', price: 15, category: 'treats', image: 'menu-7.webp', tagline: 'More crispy happiness to go around', description: 'A whole pan of rice crispy treats — made for parties and sharing.' },
  { id: 'roasted-marshmallow-pumpkin-spice-cinnamon-roll', inBasket: true, name: 'Roasted Marshmallow Pumpkin Spice Cinnamon Roll', price: 12, category: 'rolls', image: 'menu-10.webp', tagline: 'A cozy pumpkin spice bake', description: 'Pumpkin spice cinnamon rolls topped with toasted marshmallow frosting.', badge: 'Seasonal' },
  { id: 'lemon-poppyseed-cinnamon-roll', name: 'Lemon Poppyseed Cinnamon Roll', price: 12, category: 'rolls', image: 'menu-11.webp', tagline: 'A bright little twist', description: 'Bright lemon frosting with poppyseeds on a soft cinnamon swirl.' },
  { id: 'oreo-cinnamon-rolls', name: 'Oreo Cinnamon Rolls', price: 12, category: 'rolls', image: 'menu-12.webp', tagline: 'Cookies and cinnamon, together', description: 'Cookies-and-cream frosting with Oreo cookies on a soft cinnamon swirl.' },
  { id: 'orange-cinnamon-roll', name: 'Orange Cinnamon Roll', price: 12, category: 'rolls', image: 'menu-13.webp', tagline: 'A cheerful citrus swirl', description: 'Sunny orange frosting on a soft, buttery cinnamon roll.' },
  { id: 'sprinkles-cinnamon-roll', name: 'Sprinkles Cinnamon Roll', price: 12, category: 'rolls', image: 'menu-15.webp', tagline: 'A sprinkle of celebration', description: 'Vanilla frosting and rainbow sprinkles — birthday-ready.' },
  { id: 'hazelnut-chocolate-chip-cinnamon-rolls', name: 'Hazelnut Chocolate Chip Cinnamon Rolls', price: 12, category: 'rolls', image: 'menu-17.webp', tagline: 'Chocolate and hazelnut happiness', description: 'Chocolate hazelnut frosting and chocolate chips on a soft swirl.' }
];

window.AEM_CATEGORIES = {
  rolls:  { label: 'Cinnamon rolls',    eyebrow: 'The cinnamon collection' },
  treats: { label: 'Cookies and treats',  eyebrow: 'Cookies and little treats' },
  bakes:  { label: 'Breads and cakes',    eyebrow: 'Breads, cakes and more' },
  holiday: { label: 'Holiday specials', eyebrow: 'Only for the holidays' }
};

/* Holiday basket items: only offered inside the holiday basket builder, never in the daily shop.
   Prices and photos are starting examples. The owner edits them in the dashboard. */
window.AEM_HOLIDAY_ITEMS = [
  { id: 'vanilla-bean-paste', name: 'Homemade Vanilla Bean Paste', price: 14, category: 'holiday', image: 'holiday-vanilla.webp', tagline: 'Rich, speckled and homemade', description: 'Real vanilla beans in a thick, spoonable paste for baking and drinks.' },
  { id: 'simmer-pot-mix', name: 'Simmer Pot Mix', price: 8, category: 'holiday', image: 'holiday-simmer-pot.webp', tagline: 'Makes the whole house smell like the holidays', description: 'Dried citrus, cinnamon, cloves and spices to simmer on the stove.' },
  { id: 'homemade-caramel', name: 'Homemade Caramel', price: 10, category: 'holiday', image: 'holiday-caramel.webp', tagline: 'Buttery, slow-cooked caramel', description: 'Silky caramel for drizzling, dipping or eating by the spoon.' },
  { id: 'infused-olive-oil', name: 'Infused Olive Oil', price: 15, category: 'holiday', image: 'holiday-olive-oil.webp', tagline: 'Herb-infused, for cooking and dipping', description: 'Olive oil infused with herbs and garlic. Lovely with fresh bread.' },
  { id: 'infused-honey', name: 'Infused Honey', price: 12, category: 'holiday', image: 'holiday-honey.webp', tagline: 'Golden honey with a gentle twist', description: 'Local-style honey infused with warm flavors like cinnamon or vanilla.' }
];

/* Ordering settings */
window.AEM_CONFIG = {
  email: 'AEMBakery@gmail.com',
  leadTimeHours: 6,            // minimum notice before pickup
  pickupAddress: '17955 Roanoke Street NW, Ramsey, MN 55303',
  currency: 'USD'
};

/* Cinnamon roll options (same choices as the AEMBakery.com store) */
window.AEM_PRODUCTS.forEach(p => {
  if (p.category === 'rolls') p.options = {
    label: 'Frosting style',
    choices: ['Frost right out of the oven (warm and melty)', 'Frost after cooling (thick and swirled)', 'No frosting']
  };
});
