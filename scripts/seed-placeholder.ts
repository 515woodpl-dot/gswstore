/**
 * Placeholder seed — countertop installation & maintenance products.
 * Run once: npx tsx scripts/seed-placeholder.ts
 * Delete these rows anytime from the admin — they're real inventory rows,
 * not hardcoded in UI. Set env vars before running (copy from .env.local).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const CATEGORY = "Countertops";

const IMAGES = {
  polisher:  "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80",
  cutter:    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80",
  epoxy:     "https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=800&q=80",
  sealant:   "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  sink_clip: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  caulk:     "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  brush:     "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  trowel:    "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
  level:     "https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=800&q=80",
  drill:     "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80",
  grinder:   "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&q=80",
  cleaner:   "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80",
  grout:     "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
  adhesive:  "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=800&q=80",
  template:  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
};

const items = [
  // ── 5 FEATURED (first 3 show in hero) ────────────────────────────────────
  {
    id: "CTF-001", name: "Pro Granite Polisher 7\"", sku: "CTF-001",
    category_name: CATEGORY, brand: "Makita", model_number: "GA7021",
    store_price: 189.99, sale_price: 149.99, image_url: IMAGES.polisher,
    description: "Variable-speed angle polisher for granite, marble and quartz countertops.",
    amount: 12, featured: true, new_arrival: false, store_visible: true,
    attributes: { Material: "Steel", Warranty: "2 Years", Application: "Countertop Finishing" },
  },
  {
    id: "CTF-002", name: "Diamond Blade Countertop Saw", sku: "CTF-002",
    category_name: CATEGORY, brand: "DeWalt", model_number: "DWE575SB",
    store_price: 349.00, sale_price: null, image_url: IMAGES.cutter,
    description: "7-1/4\" circular saw with diamond blade. Clean cuts on stone slabs.",
    amount: 6, featured: true, new_arrival: false, store_visible: true,
    attributes: { Material: "Steel", Warranty: "3 Years", Application: "Stone Cutting" },
  },
  {
    id: "CTF-003", name: "Stone Epoxy Repair Kit", sku: "CTF-003",
    category_name: CATEGORY, brand: "Akemi", model_number: "AK-45",
    store_price: 64.99, sale_price: 49.99, image_url: IMAGES.epoxy,
    description: "Professional epoxy kit for filling cracks and chips in granite and marble.",
    amount: 30, featured: true, new_arrival: true, store_visible: true,
    attributes: { Material: "Epoxy Resin", Warranty: "1 Year", Application: "Stone Repair" },
  },
  {
    id: "CTF-004", name: "Premium Stone Sealer 1Qt", sku: "CTF-004",
    category_name: CATEGORY, brand: "Miracle Sealants", model_number: "511-QT",
    store_price: 39.99, sale_price: null, image_url: IMAGES.sealant,
    description: "Penetrating sealer for granite, marble, quartz. Up to 5 years protection.",
    amount: 50, featured: true, new_arrival: true, store_visible: true,
    attributes: { Application: "Sealing", Warranty: "5 Years", Feature: "Eco-Friendly" },
  },
  {
    id: "CTF-005", name: "Undermount Sink Clip Kit (20pc)", sku: "CTF-005",
    category_name: CATEGORY, brand: "YIGUO", model_number: "YG-CLIP-20",
    store_price: 24.99, sale_price: null, image_url: IMAGES.sink_clip,
    description: "Universal undermount sink mounting clips for stone and solid surface countertops.",
    amount: 80, featured: true, new_arrival: false, store_visible: true,
    attributes: { Material: "Steel", Installation: "Undermount", "Main Material": "Steel and Iron" },
  },

  // ── 20 REGULAR items ─────────────────────────────────────────────────────
  { id:"CTR-001", name:"Silicone Caulk Clear 10oz",       sku:"CTR-001", category_name:CATEGORY, brand:"GE",              model_number:"GE5020",    store_price:8.99,   sale_price:null,  image_url:IMAGES.caulk,    description:"Waterproof silicone for sink and backsplash seams.",                           amount:100, featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-002", name:"Grout Cleaning Brush Set",        sku:"CTR-002", category_name:CATEGORY, brand:"OXO",             model_number:"OXO-GCB",   store_price:14.99,  sale_price:null,  image_url:IMAGES.brush,    description:"Stiff-bristle set for cleaning grout around countertop edges.",                amount:45,  featured:false, new_arrival:true,  store_visible:true, attributes:{} },
  { id:"CTR-003", name:"Notched Trowel 1/4\" V-Notch",   sku:"CTR-003", category_name:CATEGORY, brand:"QEP",             model_number:"QEP-49034", store_price:12.49,  sale_price:null,  image_url:IMAGES.trowel,   description:"V-notch trowel for spreading adhesive on backsplash applications.",             amount:35,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-004", name:"Digital Level 48\"",              sku:"CTR-004", category_name:CATEGORY, brand:"Milwaukee",       model_number:"MLW-48-22", store_price:89.99,  sale_price:74.99, image_url:IMAGES.level,    description:"Digital readout level for ensuring perfect countertop installation.",           amount:8,   featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-005", name:"Hammer Drill 1/2\" SDS",         sku:"CTR-005", category_name:CATEGORY, brand:"Bosch",           model_number:"GBH2-28",   store_price:229.00, sale_price:null,  image_url:IMAGES.drill,    description:"SDS-plus rotary hammer for drilling into stone, tile and masonry.",             amount:5,   featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-006", name:"Angle Grinder 4.5\" 6A",         sku:"CTR-006", category_name:CATEGORY, brand:"Dewalt",          model_number:"DWE402",    store_price:129.00, sale_price:109.00,image_url:IMAGES.grinder,  description:"Compact grinder for shaping and smoothing stone countertop edges.",             amount:9,   featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-007", name:"Granite Countertop Cleaner 32oz",sku:"CTR-007", category_name:CATEGORY, brand:"Weiman",          model_number:"WM-109",    store_price:11.99,  sale_price:null,  image_url:IMAGES.cleaner,  description:"Daily-use pH-neutral cleaner for granite, marble and quartz surfaces.",         amount:75,  featured:false, new_arrival:true,  store_visible:true, attributes:{} },
  { id:"CTR-008", name:"Tile Adhesive Mastic 1 Gal",     sku:"CTR-008", category_name:CATEGORY, brand:"Custom Building", model_number:"CB-MBG",    store_price:22.99,  sale_price:null,  image_url:IMAGES.adhesive, description:"Premixed mastic adhesive for wall tile and backsplash applications.",           amount:40,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-009", name:"Unsanded Grout White 10lb",      sku:"CTR-009", category_name:CATEGORY, brand:"Mapei",           model_number:"MAP-08",    store_price:17.49,  sale_price:null,  image_url:IMAGES.grout,    description:"Unsanded grout for joints up to 1/8\" on tile countertop edges.",               amount:55,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-010", name:"Countertop Template Kit",        sku:"CTR-010", category_name:CATEGORY, brand:"FastCap",         model_number:"FC-TEMP",   store_price:49.99,  sale_price:39.99, image_url:IMAGES.template, description:"Professional templating system for accurate countertop measurements.",          amount:14,  featured:false, new_arrival:true,  store_visible:true, attributes:{} },
  { id:"CTR-011", name:"Silicone Caulk White 10oz",      sku:"CTR-011", category_name:CATEGORY, brand:"GE",              model_number:"GE5000",    store_price:8.99,   sale_price:null,  image_url:IMAGES.caulk,    description:"White kitchen & bath silicone for countertop and backsplash seams.",            amount:90,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-012", name:"Diamond Core Drill Bit 2\"",     sku:"CTR-012", category_name:CATEGORY, brand:"Bosch",           model_number:"DC250S",    store_price:34.99,  sale_price:null,  image_url:IMAGES.drill,    description:"Wet/dry diamond core bit for drilling faucet holes in granite.",                amount:20,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-013", name:"Polishing Pad Set 5\" (7pc)",    sku:"CTR-013", category_name:CATEGORY, brand:"Stadea",          model_number:"SD-PPW",    store_price:29.99,  sale_price:24.99, image_url:IMAGES.polisher, description:"Wet pads 50-3000 grit for granite and marble surface finishing.",               amount:30,  featured:false, new_arrival:true,  store_visible:true, attributes:{} },
  { id:"CTR-014", name:"Marble Polish Powder 2lb",       sku:"CTR-014", category_name:CATEGORY, brand:"HMK",             model_number:"HMK-S734",  store_price:27.99,  sale_price:null,  image_url:IMAGES.cleaner,  description:"Crystallization powder for restoring shine to marble surfaces.",                amount:25,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-015", name:"Seam Setter Clamps (4pc)",       sku:"CTR-015", category_name:CATEGORY, brand:"FastCap",         model_number:"FC-SS4",    store_price:59.99,  sale_price:null,  image_url:IMAGES.sink_clip,description:"Pull seams tight during countertop laminate or solid surface installs.",       amount:15,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-016", name:"Grout Float 4\"x9\"",            sku:"CTR-016", category_name:CATEGORY, brand:"QEP",             model_number:"QEP-70004", store_price:9.49,   sale_price:null,  image_url:IMAGES.trowel,   description:"Rubber face float for applying and smoothing grout on tile countertops.",       amount:60,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-017", name:"Silicone Removal Tool Kit",      sku:"CTR-017", category_name:CATEGORY, brand:"Homax",           model_number:"HM-5580",   store_price:16.99,  sale_price:null,  image_url:IMAGES.brush,    description:"Plastic scrapers and solvent for removing old caulk cleanly.",                  amount:40,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-018", name:"Epoxy Injection Syringe 50ml",   sku:"CTR-018", category_name:CATEGORY, brand:"Akemi",           model_number:"AK-SYR",    store_price:19.99,  sale_price:null,  image_url:IMAGES.epoxy,    description:"Dual-chamber syringe applicator for precise epoxy on stone repairs.",           amount:35,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-019", name:"Penetrating Oil Sealer 1 Gal",   sku:"CTR-019", category_name:CATEGORY, brand:"Miracle Sealants",model_number:"511-GAL",   store_price:89.99,  sale_price:74.99, image_url:IMAGES.sealant,  description:"Commercial gallon sealer for high-traffic granite and stone surfaces.",         amount:18,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
  { id:"CTR-020", name:"Flush-Mount Sink Clips SS (10pc)",sku:"CTR-020",category_name:CATEGORY, brand:"YIGUO",           model_number:"YG-SS-10",  store_price:18.99,  sale_price:null,  image_url:IMAGES.sink_clip,description:"Stainless steel clips for flush-mount and undermount sink installs.",           amount:65,  featured:false, new_arrival:false, store_visible:true, attributes:{} },
];

async function seed() {
  console.log(`Seeding ${items.length} placeholder products...`);

  // Ensure category exists
  const { data: existingCat } = await sb.from("categories").select("id").eq("name", CATEGORY).maybeSingle();
  if (!existingCat) {
    const { error: catErr } = await sb.from("categories").insert({ name: CATEGORY, prefix: "CTR", color: "#435d69", sort_order: 1 });
    if (catErr) console.warn("Category insert:", catErr.message);
    else console.log("Created category:", CATEGORY);
  }

  const { error } = await sb.from("inventory").upsert(items, { onConflict: "id" });
  if (error) { console.error("Seed failed:", error.message); process.exit(1); }
  console.log(`\n✅ Done! ${items.length} products seeded.`);
  console.log(`   Featured (${items.filter(i=>i.featured).length}):`, items.filter(i=>i.featured).map(i=>i.id).join(", "));
  console.log(`   New Arrivals (${items.filter(i=>i.new_arrival).length}):`, items.filter(i=>i.new_arrival).map(i=>i.id).join(", "));
  console.log(`   On Sale (${items.filter(i=>i.sale_price).length}):`, items.filter(i=>i.sale_price).map(i=>i.id).join(", "));
}

seed();
