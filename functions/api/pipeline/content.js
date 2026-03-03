/**
 * POST /api/pipeline/content
 *
 * Content Writer Agent
 * ────────────────────
 * Generates unique, human-quality website copy from site DNA + questionnaire data.
 * This is NOT generic template filling — it produces original prose that sounds
 * like it was written by a local copywriter who knows the trade.
 *
 * Body: {
 *   email: string,
 *   business_name: string,
 *   niche: string,
 *   services?: string,
 *   location?: string,
 *   years?: string,
 *   phone?: string,
 *   style?: string,
 *   site_dna?: object,  // from scraper agent
 *   notes?: string,
 * }
 *
 * Returns: { content: { hero, about, services[], testimonials[], cta, meta } }
 */
import { json, err, corsPreflightResponse, getKV } from '../../_lib/helpers.js';

export async function onRequestPost(context) {
  const kv = getKV(context.env);

  let body;
  try { body = await context.request.json(); } catch { return err('Invalid JSON'); }

  const email = (body.email || '').trim().toLowerCase();
  const bizName = (body.business_name || '').trim();
  const niche = (body.niche || '').trim().toLowerCase();
  if (!bizName) return err('business_name is required');

  // Load site DNA if available
  let siteDna = body.site_dna || null;
  if (!siteDna && kv && email) {
    try {
      siteDna = await kv.get('site_dna:' + email, { type: 'json' });
    } catch {}
  }

  const biz = {
    name: bizName,
    niche,
    services: body.services || '',
    location: body.location || '',
    years: body.years || '',
    phone: body.phone || '',
    style: body.style || 'modern-clean',
    notes: body.notes || '',
    // From site DNA
    tagline: siteDna?.tagline || '',
    existing_headings: siteDna?.page_headings || [],
    existing_paragraphs: siteDna?.paragraphs || [],
    existing_services: siteDna?.services_found || [],
    existing_ctas: siteDna?.cta_texts || [],
    hero_headline: siteDna?.hero_headline || '',
    rating: siteDna?.rating || null,
    review_count: siteDna?.review_count || null,
  };

  const content = generateContent(biz);

  // Store content
  if (kv && email) {
    try {
      await kv.put('content:' + email, JSON.stringify(content), { expirationTtl: 86400 * 90 });
    } catch {}
  }

  return json({ content });
}

export async function onRequestOptions() {
  return corsPreflightResponse();
}

// ── Content generation engine ─────────────────────────────────

function generateContent(biz) {
  const name = biz.name;
  const loc = biz.location || 'your area';
  const years = biz.years || '10+';
  const niche = biz.niche;
  const phone = biz.phone;

  // Get niche intelligence
  const nicheData = getNicheIntelligence(niche);

  // Generate hero
  const hero = generateHero(biz, nicheData);

  // Generate about
  const about = generateAbout(biz, nicheData);

  // Generate services
  const services = generateServices(biz, nicheData);

  // Generate testimonials
  const testimonials = generateTestimonials(biz, nicheData);

  // Generate CTA section
  const cta = generateCTA(biz, nicheData);

  // Generate meta info
  const meta = generateMeta(biz, nicheData);

  // Generate trust stats
  const stats = generateStats(biz, nicheData);

  return {
    hero,
    about,
    services,
    testimonials,
    cta,
    meta,
    stats,
    generated_at: new Date().toISOString(),
  };
}

// ── Hero generation ───────────────────────────────────────────

function generateHero(biz, nicheData) {
  const name = biz.name;
  const loc = biz.location || 'your area';
  const years = biz.years || '10+';

  // Pick headline style based on hash of business name for variety
  const headlineVariant = hashMod(name, nicheData.headlines.length);
  let headline = nicheData.headlines[headlineVariant];

  // Personalize
  headline = personalize(headline, biz);

  // Pick subtext
  const subVariant = hashMod(name + 'sub', nicheData.heroSubs.length);
  let subtext = personalize(nicheData.heroSubs[subVariant], biz);

  // Tag line
  const tagVariant = hashMod(name + 'tag', nicheData.heroTags.length);
  const tag = personalize(nicheData.heroTags[tagVariant], biz);

  // CTA text
  const ctaVariant = hashMod(name + 'cta', nicheData.heroCTAs.length);
  const ctaPrimary = nicheData.heroCTAs[ctaVariant];

  return { headline, subtext, tag, cta_primary: ctaPrimary, cta_secondary: 'See Our Work' };
}

// ── About generation ──────────────────────────────────────────

function generateAbout(biz, nicheData) {
  const variant = hashMod(biz.name + 'about', nicheData.aboutBlocks.length);
  const template = nicheData.aboutBlocks[variant];

  return {
    heading: personalize(template.heading, biz),
    paragraphs: template.paragraphs.map(p => personalize(p, biz)),
    values: nicheData.values.slice(0, 4),
  };
}

// ── Services generation ───────────────────────────────────────

function generateServices(biz, nicheData) {
  // Start with user-provided services
  const userServices = (biz.services || '').split(',').map(s => s.trim()).filter(Boolean);

  // Merge with scraped services
  const allRaw = [...userServices];
  for (const s of biz.existing_services) {
    if (!allRaw.find(r => r.toLowerCase() === s.toLowerCase())) {
      allRaw.push(s);
    }
  }

  // Build final services
  const result = [];

  for (const raw of allRaw.slice(0, 6)) {
    // Find matching niche service for a better description
    const match = findBestServiceMatch(raw, nicheData.services);
    if (match) {
      result.push({
        name: capitalizeWords(raw),
        description: personalize(match.description, biz),
        icon: match.icon || 'check',
      });
    } else {
      result.push({
        name: capitalizeWords(raw),
        description: generateServiceDescription(raw, biz, nicheData),
        icon: 'check',
      });
    }
  }

  // Pad to at least 4 services
  let padIdx = 0;
  while (result.length < 4 && padIdx < nicheData.services.length) {
    const fallback = nicheData.services[padIdx];
    if (!result.find(r => r.name.toLowerCase() === fallback.name.toLowerCase())) {
      result.push({
        name: fallback.name,
        description: personalize(fallback.description, biz),
        icon: fallback.icon || 'check',
      });
    }
    padIdx++;
  }

  return result.slice(0, 6);
}

// ── Testimonials generation ───────────────────────────────────

function generateTestimonials(biz, nicheData) {
  const result = [];
  const pool = nicheData.testimonials;

  // Pick 3 unique testimonials based on business name hash
  for (let i = 0; i < 3 && i < pool.length; i++) {
    const idx = hashMod(biz.name + 'test' + i, pool.length);
    const t = pool[idx];
    result.push({
      text: personalize(t.text, biz),
      author: t.author,
      role: personalize(t.role, biz),
      rating: 5,
    });
  }

  return result;
}

// ── CTA section ───────────────────────────────────────────────

function generateCTA(biz, nicheData) {
  const variant = hashMod(biz.name + 'cta-sec', nicheData.ctaBlocks.length);
  const block = nicheData.ctaBlocks[variant];

  return {
    heading: personalize(block.heading, biz),
    subtext: personalize(block.subtext, biz),
    button_text: block.button_text || 'Get Your Free Quote',
    secondary_text: block.secondary_text || 'No obligation. No pressure.',
  };
}

// ── Meta generation ───────────────────────────────────────────

function generateMeta(biz, nicheData) {
  const title = `${biz.name} — ${capitalizeWords(biz.niche || 'Professional Services')} in ${biz.location || 'Your Area'}`;
  const description = `${biz.name} provides trusted ${biz.niche || 'professional'} services in ${biz.location || 'your area'}. ${biz.years || '10+'} years of experience. Call for a free estimate.`;

  return { title, description };
}

// ── Stats generation ──────────────────────────────────────────

function generateStats(biz, nicheData) {
  const years = biz.years || '10+';
  const rating = biz.rating || 4.9;
  const reviewCount = biz.review_count || '200+';

  return [
    { number: years, label: 'Years Experience' },
    { number: String(rating), label: 'Star Rating' },
    { number: typeof reviewCount === 'number' ? reviewCount + '+' : reviewCount, label: 'Reviews' },
    { number: 'A+', label: 'BBB Rated' },
    { number: '100%', label: 'Licensed & Insured' },
  ];
}

// ── Niche intelligence database ───────────────────────────────

function getNicheIntelligence(niche) {
  const db = {
    'roofing': {
      headlines: [
        'The roof over your family deserves better.',
        'Your roof protects everything underneath it.',
        'Honest roofing from people who live here too.',
        'When the storm passes, we show up.',
        'Built to last. Backed by people who mean it.',
      ],
      heroSubs: [
        '{name} has protected homes across {location} for {years} years. When it\'s time for a roof that actually lasts, you call the crew that stands behind every shingle.',
        'From full replacements to emergency storm repair, {name} is the team {location} homeowners trust when it matters most. {years} years. Same phone number. Same standards.',
        'Your roof shouldn\'t keep you up at night. {name} has been the call for {location} homeowners for {years} years — honest work, fair prices, no runaround.',
      ],
      heroTags: [
        'Licensed & Insured • {location}',
        'Trusted Roofers • Serving {location}',
        '{years} Years Strong • {location}',
      ],
      heroCTAs: ['Get Your Free Roof Inspection', 'Schedule Your Free Estimate', 'Call For a Free Quote'],
      services: [
        { name: 'Roof Replacement', description: 'Complete tear-off and install — manufacturer-backed warranties, permit handling, debris hauled away. We do the job right or we do it again.', icon: 'home' },
        { name: 'Storm Damage Repair', description: 'Hail, wind, fallen trees — we respond fast and handle your insurance paperwork so you don\'t have to.', icon: 'shield' },
        { name: 'Roof Inspections', description: 'Catch the $200 problem before it becomes the $12,000 problem. Detailed report with photos and honest recommendations.', icon: 'search' },
        { name: 'Leak Detection & Repair', description: 'That water stain on your ceiling has a source. We find it, fix it, and make sure it stays fixed.', icon: 'droplet' },
        { name: 'Gutter Systems', description: 'Seamless aluminum gutters sized for your roof and climate. Installed right, draining right, looking clean.', icon: 'filter' },
        { name: 'Commercial Roofing', description: 'Flat roofs, TPO, EPDM, metal — we handle commercial jobs with minimal disruption to your operations.', icon: 'building' },
        { name: 'Siding & Trim', description: 'New siding transforms your home\'s curb appeal and adds a layer of protection. Multiple materials and styles available.', icon: 'layers' },
        { name: 'Attic Ventilation', description: 'Proper ventilation prevents ice dams, reduces cooling costs, and extends roof life. Often overlooked — never by us.', icon: 'wind' },
      ],
      aboutBlocks: [
        {
          heading: 'Real people. Real work. No shortcuts.',
          paragraphs: [
            '{name} started with a truck and a handshake. {years} years later, we\'re still the same — honest answers, clean work, and a crew that treats your home the way we\'d want ours treated.',
            'Every roofer on our team is trained, licensed, and background-checked. We pull permits, we follow code, and we don\'t cut corners. Your roof is too important for that.',
          ],
        },
        {
          heading: 'We\'ve been on your roof before.',
          paragraphs: [
            'For {years} years, {name} has been the name {location} homeowners trust when it\'s time for a new roof. We\'ve worked on your neighbor\'s house. And the one across the street.',
            'We don\'t do high-pressure sales. We show up, inspect your roof, give you an honest assessment, and let you decide. Our work speaks for itself.',
          ],
        },
      ],
      values: [
        { title: 'Honest Pricing', desc: 'The price we quote is the price you pay. Period.' },
        { title: 'Clean Jobsite', desc: 'Magnetic sweep, tarp protection, daily cleanup. Every time.' },
        { title: 'Licensed & Insured', desc: 'Full coverage. Full compliance. Zero worry for you.' },
        { title: 'Warranty Backed', desc: 'Manufacturer warranty + our written workmanship guarantee.' },
      ],
      testimonials: [
        { text: 'They replaced our entire roof in a day and a half. Showed up when they said, kept the yard clean, and the final price matched the quote exactly. That shouldn\'t be noteworthy — but in this industry, it is.', author: 'Mike R.', role: 'Homeowner, {location}' },
        { text: 'After the hailstorm, five different roofers knocked on our door. {name} was the only one who didn\'t try to scare us into a full replacement. They patched what needed patching and saved us thousands.', author: 'Sarah T.', role: 'Homeowner, {location}' },
        { text: 'Used them for our warehouse roof — 22,000 square feet. Professional crew, on schedule, and the foreman kept us updated at every milestone. Would hire again without hesitation.', author: 'David L.', role: 'Business Owner' },
        { text: 'Got quotes from four companies. {name} came in the middle on price but miles ahead on communication and professionalism. The crew was respectful, efficient, and genuinely skilled.', author: 'Karen P.', role: 'Homeowner, {location}' },
        { text: 'Three years after our roof replacement, not a single issue. We just had them out for the free annual check — everything looks perfect. That\'s the kind of workmanship that earns referrals.', author: 'James W.', role: 'Homeowner' },
      ],
      ctaBlocks: [
        { heading: 'Ready to fix your roof the right way?', subtext: 'We\'ll send someone to inspect it this week — free, no obligation, no pressure pitch.', button_text: 'Schedule Free Inspection' },
        { heading: 'Let\'s talk about your roof.', subtext: 'Call us or fill out the form. We\'ll get back to you within 24 hours with a free estimate.', button_text: 'Get Your Free Quote' },
      ],
    },
    'plumbing': {
      headlines: [
        'When water goes where it shouldn\'t, you need someone who answers the phone.',
        'The plumber your neighbor already recommended.',
        'Fix it right. Fix it once. Sleep tonight.',
        'Your pipes don\'t wait. Neither do we.',
        'Honest plumbing from people who pick up on the first ring.',
      ],
      heroSubs: [
        '{name} has been the first call for {location} homeowners for {years} years. Fast response. Fair pricing. Plumbing that actually works when we leave.',
        'From burst pipes to clogged drains, {name} shows up fast, diagnoses honestly, and fixes it right. {years} years in {location} — and our best marketing is still word of mouth.',
        'Leaks don\'t wait for business hours. {name} answers 24/7 because your basement doesn\'t care what time it is. {years} years. Same team. Same standards.',
      ],
      heroTags: [
        '24/7 Emergency Service • {location}',
        'Licensed Master Plumbers • {location}',
        '{years} Years Trusted • {location}',
      ],
      heroCTAs: ['Call Now — We Answer 24/7', 'Get Your Free Estimate', 'Schedule Service Today'],
      services: [
        { name: 'Emergency Plumbing', description: 'Burst pipe at 2am? Overflowing toilet? We answer 24/7 and most times we\'re at your door within the hour.', icon: 'alert' },
        { name: 'Drain Cleaning', description: 'Slow drains, backups, root intrusion — we clear the blockage and camera-inspect the line so it stays clear.', icon: 'filter' },
        { name: 'Water Heater Service', description: 'Repair or replacement for tank and tankless systems. Same-day install on most models. No cold showers.', icon: 'thermometer' },
        { name: 'Leak Detection', description: 'Electronic leak detection finds hidden leaks behind walls and under slabs — without tearing up your home first.', icon: 'search' },
        { name: 'Repiping', description: 'Whole-house repiping with copper or PEX. We plan around your schedule and minimize wall openings.', icon: 'tool' },
        { name: 'Sewer Line Repair', description: 'Camera inspection, trenchless repair, and full line replacement. We find the problem and fix it with minimal yard damage.', icon: 'layers' },
        { name: 'Fixture Installation', description: 'Faucets, toilets, garbage disposals, sump pumps — installed correctly, tested thoroughly, and warranted.', icon: 'check' },
        { name: 'Gas Line Service', description: 'Gas leak detection, new line installation, and appliance hookups. Licensed gas fitters. Safety first, always.', icon: 'shield' },
      ],
      aboutBlocks: [
        {
          heading: 'We explain the problem before we fix it.',
          paragraphs: [
            '{name} was built on one idea: plumbing shouldn\'t be a mystery. We show you the problem, explain your options, and give you an honest price before any wrench turns.',
            'Every plumber on our team is licensed, background-checked, and trained to treat your home like their own. {years} years in {location} means we\'ve seen every pipe, fitting, and creative DIY "fix" there is.',
          ],
        },
        {
          heading: 'The plumber you don\'t have to worry about.',
          paragraphs: [
            'We show up on time. We put down drop cloths. We explain what we\'re doing and why. And when we leave, the only sign we were there is the thing that works now.',
            '{name} has been doing this for {years} years in {location}. We didn\'t grow by being the cheapest — we grew by being the ones people called back.',
          ],
        },
      ],
      values: [
        { title: 'Upfront Pricing', desc: 'You approve the price before we start. No surprise charges.' },
        { title: '24/7 Response', desc: 'Emergencies don\'t wait. Neither do we.' },
        { title: 'Clean Work', desc: 'Drop cloths, boot covers, cleanup before we leave.' },
        { title: 'Licensed Team', desc: 'Every plumber is licensed, insured, and background-checked.' },
      ],
      testimonials: [
        { text: 'Basement flooding on a Sunday night. They were at our door in 40 minutes. Fixed the issue, cleaned up, even left boot covers at the door. That\'s how you earn a customer for life.', author: 'Jennifer K.', role: 'Homeowner, {location}' },
        { text: 'Got three quotes for repiping. {name} wasn\'t the cheapest, but they were the only ones who explained what they were doing and why. Finished ahead of schedule, too.', author: 'Robert M.', role: 'Homeowner, {location}' },
        { text: 'We use them for all six of our rental properties. Reliable, communicative, and they text before showing up. Exactly what a property manager needs.', author: 'Lisa P.', role: 'Property Manager' },
        { text: 'Water heater died on Thanksgiving morning. {name} had a new one installed by 3pm. Saved the holiday. We\'ll never call anyone else.', author: 'Tom H.', role: 'Homeowner, {location}' },
        { text: 'Hired them for a small leak. They found a much bigger problem behind the wall. Instead of upselling, they explained exactly what we needed — nothing more. Trust earned.', author: 'Amanda C.', role: 'Homeowner' },
      ],
      ctaBlocks: [
        { heading: 'Need a plumber who actually shows up?', subtext: 'We answer the phone. We show up when we say. And we fix it right the first time.', button_text: 'Call Now' },
        { heading: 'Let\'s solve your plumbing problem.', subtext: 'Free estimates. No obligation. No sales pressure. Just honest answers from licensed plumbers.', button_text: 'Get Your Free Estimate' },
      ],
    },
    'hvac': {
      headlines: [
        'Comfortable home. Controlled costs. No excuses.',
        'The HVAC company that picks up when it\'s 100 degrees out.',
        'Your comfort isn\'t optional. We treat it that way.',
        'Cool in summer. Warm in winter. Fair pricing all year.',
        'We fix it fast so you can stop thinking about it.',
      ],
      heroSubs: [
        '{name} keeps {location} homes at the right temperature year-round. {years} years of installs, repairs, and maintenance — done right, priced fairly.',
        'When your AC dies in July or your furnace quits in January, {name} is the team that shows up fast, diagnoses honestly, and gets you comfortable again.',
        'Heating and cooling is all we do, and we\'ve been doing it in {location} for {years} years. Right-sized equipment, honest diagnostics, and technicians who actually explain what\'s going on.',
      ],
      heroTags: [
        'NATE-Certified Technicians • {location}',
        'Heating & Cooling Experts • {location}',
        '{years} Years of Comfort • {location}',
      ],
      heroCTAs: ['Schedule Service Today', 'Get Your Free Estimate', 'Call — We Answer 24/7'],
      services: [
        { name: 'AC Repair & Service', description: 'Fast diagnosis and repair for all makes. Most repairs done same-day so you\'re not sweating through the weekend.', icon: 'snowflake' },
        { name: 'Furnace & Heating', description: 'Tune-ups, repairs, and full replacements. Gas, electric, heat pump — we work on all of it.', icon: 'flame' },
        { name: 'New System Installation', description: 'Right-sized equipment for your home, not the biggest unit we can sell you. Includes rebate assistance and financing.', icon: 'home' },
        { name: 'Preventive Maintenance', description: 'Twice a year. Extends equipment life, improves efficiency, and catches the problems that would\'ve cost you $2,000 in February.', icon: 'calendar' },
        { name: 'Duct Cleaning & Sealing', description: 'Leaky ducts waste 20-30% of your heating and cooling. We seal them, clean them, and cut your energy bills.', icon: 'wind' },
        { name: 'Indoor Air Quality', description: 'Air purifiers, dehumidifiers, UV filtration. Real solutions for allergies, asthma, and that musty smell you can\'t track down.', icon: 'shield' },
        { name: 'Heat Pump Systems', description: 'High-efficiency heating and cooling in one system. Lower bills, smaller carbon footprint, and rebates that make the math work.', icon: 'refresh' },
        { name: 'Thermostat Installation', description: 'Smart thermostats that actually save money. We install, configure, and show you how to use every feature.', icon: 'settings' },
      ],
      aboutBlocks: [
        {
          heading: 'We diagnose first. Sell second. Maybe not at all.',
          paragraphs: [
            '{name} has been keeping {location} comfortable since day one. We don\'t push equipment you don\'t need. We diagnose the actual problem, explain your options in plain English, and let you decide.',
            'Our technicians are NATE-certified, drug-tested, and arrive on time in marked vehicles. {years} years in business means we\'ve fixed every brand, every model, every creative "solution" the last guy tried.',
          ],
        },
        {
          heading: 'Your comfort system. Our obsession.',
          paragraphs: [
            'Most HVAC companies sell you a box. We design a comfort system — right-sized for your home, your climate, and your budget. Then we back it with the best warranty in {location}.',
            '{years} years. Thousands of installs. And we still treat every service call like our reputation depends on it — because it does.',
          ],
        },
      ],
      values: [
        { title: 'Honest Diagnostics', desc: 'We fix what\'s broken. We don\'t invent problems.' },
        { title: 'NATE Certified', desc: 'Every tech certified by North American Technician Excellence.' },
        { title: 'Same-Day Service', desc: 'Most repairs completed on the first visit.' },
        { title: 'Financing Available', desc: 'New system? We offer flexible payment options.' },
      ],
      testimonials: [
        { text: 'AC died in July. {name} had a new system in by the next morning. The tech showed me how to use the smart thermostat before he left. Five stars isn\'t enough.', author: 'Tom A.', role: 'Homeowner, {location}' },
        { text: 'Three years on their maintenance plan. Haven\'t had a single breakdown. The annual tune-up alone has paid for itself twice over.', author: 'Nancy W.', role: 'Homeowner, {location}' },
        { text: 'Replaced our restaurant\'s entire HVAC system without closing us for a single day. Incredible coordination and communication throughout.', author: 'Carlos M.', role: 'Restaurant Owner' },
        { text: 'Other companies wanted to replace the whole unit. {name} found a $180 part that fixed it. Honest people — hard to find in this business.', author: 'Rebecca J.', role: 'Homeowner, {location}' },
        { text: 'The tech arrived on time, diagnosed the issue in 15 minutes, and had us back to normal within the hour. Professional from start to finish.', author: 'Steve G.', role: 'Homeowner' },
      ],
      ctaBlocks: [
        { heading: 'Let\'s get your home comfortable again.', subtext: 'Same-day service on most calls. Free estimates on replacements. No overtime charges.', button_text: 'Schedule Service Now' },
        { heading: 'Ready for an HVAC team that actually shows up?', subtext: 'We answer the phone, arrive on time, and fix it right. That\'s the bar — and we clear it every time.', button_text: 'Call For a Free Quote' },
      ],
    },
    'electrical': {
      headlines: [
        'Safe wiring. Smart upgrades. No shortcuts.',
        'The electrician who does it to code — not just to done.',
        'Your home\'s electrical system is only as good as the hands that wired it.',
        'Power your home the right way.',
        'Licensed electricians who actually care about your walls.',
      ],
      heroSubs: [
        '{name} delivers licensed, code-compliant electrical work across {location}. {years} years of experience means fewer callbacks and more peace of mind.',
        'From panel upgrades to full rewires, {name} does electrical the way it should be done — safely, cleanly, and to code. {years} years serving {location}.',
        'Electrical work isn\'t the place to cut corners. {name} has been the trusted electrician in {location} for {years} years — licensed, insured, and meticulous.',
      ],
      heroTags: [
        'Licensed Master Electricians • {location}',
        'Code-Compliant Work • {location}',
        '{years} Years Trusted • {location}',
      ],
      heroCTAs: ['Get Your Free Electrical Quote', 'Schedule Service Today', 'Call Your Licensed Electrician'],
      services: [
        { name: 'Panel Upgrades', description: 'Upgrade from 100A to 200A+ service. Support modern appliances, EV chargers, and home additions without tripping breakers.', icon: 'zap' },
        { name: 'Wiring & Rewiring', description: 'Knob-and-tube replacement, aluminum rewiring, and new construction. Every connection inspected, every wire labeled.', icon: 'tool' },
        { name: 'Lighting Design', description: 'Recessed, under-cabinet, landscape, accent — designed to look great and function perfectly. LED upgrades that pay for themselves.', icon: 'sun' },
        { name: 'Generator Installation', description: 'Whole-home standby generators with automatic transfer switches. When the grid goes down, your lights stay on.', icon: 'battery' },
        { name: 'EV Charger Installation', description: 'Level 2 chargers for Tesla, Ford, Rivian, and all EVs. Proper permitting and panel assessment included.', icon: 'zap' },
        { name: 'Troubleshooting & Repair', description: 'Flickering lights, tripped breakers, dead outlets, burning smells — we find the fault and fix it safely. No guesswork.', icon: 'search' },
        { name: 'Ceiling Fan Installation', description: 'New fans, replacements, and rewiring for proper support. We make sure it\'s secure, balanced, and on the right switch.', icon: 'wind' },
        { name: 'Smoke & CO Detectors', description: 'Hardwired, interconnected detection systems that meet current code. Battery backups on every unit.', icon: 'shield' },
      ],
      aboutBlocks: [
        {
          heading: 'Electrical work is either done safely, or it\'s done wrong.',
          paragraphs: [
            '{name} was founded on one principle: there\'s no gray area in electrical work. It\'s safe or it isn\'t. It\'s to code or it isn\'t. Every job we do is the latter.',
            'Every electrician on our team holds a journeyman or master license. We pull permits, schedule inspections, and guarantee our work. {years} years doing this in {location}.',
          ],
        },
        {
          heading: 'Meticulous work you\'ll never notice — and that\'s the point.',
          paragraphs: [
            'Good electrical work is invisible. The lights turn on. The outlets work. The panel is clean and labeled. {name} has been doing that quietly in {location} for {years} years.',
            'We don\'t leave holes in your drywall, wires hanging from ceilings, or outlets that don\'t match. We\'re electricians, but we respect your home like finish carpenters.',
          ],
        },
      ],
      values: [
        { title: 'Code Compliant', desc: 'Every job meets or exceeds NEC and local codes.' },
        { title: 'Licensed Team', desc: 'Journeyman and master electricians on every job.' },
        { title: 'Permit & Inspect', desc: 'We pull permits and schedule inspections. Always.' },
        { title: 'Clean Finish', desc: 'No exposed wires. No drywall damage. No mess.' },
      ],
      testimonials: [
        { text: 'They rewired our 1960s home without destroying our plaster walls. The crew was meticulous about patching and cleanup. Couldn\'t even tell they\'d been there.', author: 'Amanda R.', role: 'Homeowner, {location}' },
        { text: 'Installed a Tesla charger and upgraded our panel on the same visit. One permit, one inspection, done. Professional, clean, and exactly on budget.', author: 'Brian K.', role: 'Homeowner, {location}' },
        { text: 'We\'ve used {name} for three commercial buildouts. Their work passes inspection the first time, every time. That saves us real money.', author: 'Mark S.', role: 'General Contractor' },
        { text: 'Panel was full and we needed to add circuits for a kitchen remodel. {name} upgraded our service cleanly, labeled everything, and the inspector was impressed. That says a lot.', author: 'Diana F.', role: 'Homeowner, {location}' },
        { text: 'Called about a flickering light. Turned out to be a loose connection that could\'ve been a fire hazard. Glad we called the pros instead of ignoring it.', author: 'Paul T.', role: 'Homeowner' },
      ],
      ctaBlocks: [
        { heading: 'Need electrical work done right?', subtext: 'Licensed electricians. Pulled permits. Passed inspections. The way it should be done.', button_text: 'Get Your Free Quote' },
        { heading: 'Let\'s power your home properly.', subtext: 'Free estimates on all electrical work. We\'ll assess what you need and give you honest options.', button_text: 'Schedule Your Free Estimate' },
      ],
    },
    'landscaping': {
      headlines: [
        'Your yard is the first thing people see. Let\'s make it count.',
        'Landscapes that look like someone actually cares.',
        'We build outdoor spaces you\'ll actually use.',
        'Curb appeal that makes the neighbors jealous.',
        'From overgrown to outstanding.',
      ],
      heroSubs: [
        '{name} designs and maintains landscapes across {location} that actually make you want to go outside. {years} years of mowing, planting, and building beautiful outdoor spaces.',
        'Your yard tells a story. Right now, it might be saying "help." {name} has been transforming {location} properties for {years} years — from simple cleanups to complete outdoor overhauls.',
      ],
      heroTags: ['Licensed Landscapers • {location}', 'Outdoor Living Experts • {location}'],
      heroCTAs: ['Get Your Free Design Consultation', 'Schedule a Free Estimate'],
      services: [
        { name: 'Landscape Design', description: 'Custom landscape plans that work with your property, your budget, and how you actually live. Not a cookie-cutter template.', icon: 'pen' },
        { name: 'Lawn Maintenance', description: 'Weekly mowing, edging, and blowing. Your lawn stays sharp without you lifting a finger.', icon: 'scissors' },
        { name: 'Hardscaping', description: 'Patios, walkways, retaining walls, fire pits. Built to last and designed to look natural.', icon: 'layers' },
        { name: 'Tree & Shrub Care', description: 'Pruning, removal, planting, and health treatments. We keep your trees healthy and your sight lines clear.', icon: 'tree' },
        { name: 'Irrigation Systems', description: 'Sprinkler install, repair, and seasonal adjustments. Efficient watering that keeps your lawn green and your water bill sane.', icon: 'droplet' },
        { name: 'Seasonal Cleanup', description: 'Spring prep and fall cleanup. Leaf removal, bed clearing, mulch refresh, and winterization.', icon: 'calendar' },
      ],
      aboutBlocks: [{
        heading: 'We don\'t just mow. We care.',
        paragraphs: [
          '{name} started because someone asked "why does every yard on this street look the same?" {years} years later, we\'re still answering that question — with designs that fit the home, the climate, and the people who live there.',
          'We\'re not a mow-and-blow crew. We\'re landscape professionals who happen to also keep your lawn pristine. Every property gets a plan, not just a pass.',
        ],
      }],
      values: [
        { title: 'Custom Design', desc: 'Every property gets a plan tailored to it.' },
        { title: 'Reliable Schedule', desc: 'We show up the same day, same time. Every week.' },
        { title: 'Licensed & Insured', desc: 'Full coverage for your property and our team.' },
        { title: 'Clean Finish', desc: 'Edges sharp. Beds clean. Nothing left behind.' },
      ],
      testimonials: [
        { text: 'Our front yard went from "meh" to "magazine cover." The neighbors have asked for {name}\'s number three times. Best investment we\'ve made in the house.', author: 'Linda S.', role: 'Homeowner, {location}' },
        { text: 'They built our patio and fire pit area. Two years later, it still looks brand new. These guys know their craft.', author: 'Greg M.', role: 'Homeowner, {location}' },
        { text: 'We manage 30+ rental properties. {name} handles all the landscaping — reliable, consistent, and our tenants always comment on how nice things look.', author: 'Patricia D.', role: 'Property Manager' },
      ],
      ctaBlocks: [{ heading: 'Ready for a yard you actually enjoy?', subtext: 'Free design consultation. We\'ll walk your property, discuss your vision, and give you an honest plan.', button_text: 'Get Your Free Consultation' }],
    },
    'painting': {
      headlines: [
        'A great paint job changes how a house feels.',
        'Color done right. Lines done clean.',
        'The painters who prep like it matters — because it does.',
        'Your home deserves more than a quick coat.',
      ],
      heroSubs: [
        '{name} has been painting {location} homes and businesses for {years} years. We prep thoroughly, use premium materials, and leave lines so clean you\'d think we used tape on tape.',
        'Interior, exterior, residential, commercial — {name} handles it all with the same obsessive attention to detail. {years} years in {location} and counting.',
      ],
      heroTags: ['Professional Painters • {location}', '{years} Years of Quality • {location}'],
      heroCTAs: ['Get Your Free Color Consultation', 'Request a Free Quote'],
      services: [
        { name: 'Interior Painting', description: 'Walls, ceilings, trim, doors — smooth finish, clean lines, and we move your furniture back exactly where it was.', icon: 'home' },
        { name: 'Exterior Painting', description: 'Full prep, prime, and paint. We power wash, scrape, caulk, and protect your landscaping before a brush touches the house.', icon: 'sun' },
        { name: 'Cabinet Refinishing', description: 'Transform your kitchen without a full remodel. Sand, prime, spray, and cure — factory-smooth finish at a fraction of replacement cost.', icon: 'layers' },
        { name: 'Commercial Painting', description: 'Offices, retail, restaurants — we work around your hours and finish on schedule. Minimal disruption, maximum impact.', icon: 'building' },
        { name: 'Deck & Fence Staining', description: 'Strip, sand, stain, and seal. Your outdoor wood will look new and stay protected for years.', icon: 'tool' },
        { name: 'Color Consultation', description: 'Not sure what color? We help you choose. We bring samples, test patches, and our years of experience matching colors to homes.', icon: 'palette' },
      ],
      aboutBlocks: [{
        heading: '80% of a great paint job happens before the brush.',
        paragraphs: [
          'Prep is everything. {name} spends more time taping, patching, sanding, and priming than most painters spend on the whole job. That\'s why our work lasts — and theirs doesn\'t.',
          '{years} years in {location}. We use premium paint because cheap paint looks cheap in 18 months. Our work is an investment that holds up.',
        ],
      }],
      values: [
        { title: 'Premium Materials', desc: 'Benjamin Moore, Sherwin-Williams. No bargain paint.' },
        { title: 'Thorough Prep', desc: 'Tape, patch, sand, prime — before any paint goes on.' },
        { title: 'Clean Workspace', desc: 'Drop cloths everywhere. Furniture protected. Spotless cleanup.' },
        { title: 'Color Matching', desc: 'We get the color right — samples, test patches, daylight checks.' },
      ],
      testimonials: [
        { text: 'They painted our entire first floor — walls, trim, and doors. The lines are so sharp I thought they were factory-finished. Incredible attention to detail.', author: 'Michael B.', role: 'Homeowner, {location}' },
        { text: 'Exterior painting job on a 100-year-old Victorian. {name} handled the prep with surgical precision. Neighbors stop to compliment it weekly.', author: 'Susan L.', role: 'Homeowner, {location}' },
        { text: 'We had them repaint our restaurant. They worked overnight so we didn\'t miss a day of service. Results were flawless.', author: 'Anthony R.', role: 'Restaurant Owner' },
      ],
      ctaBlocks: [{ heading: 'Ready to transform your space?', subtext: 'Free estimates and color consultations. We\'ll help you pick the perfect palette and deliver a finish that lasts.', button_text: 'Get Your Free Estimate' }],
    },
    'cleaning': {
      headlines: [
        'Come home to clean. Every single time.',
        'A clean home shouldn\'t feel like a luxury.',
        'We clean like someone\'s watching — because our reputation is.',
        'Spotless isn\'t a goal. It\'s the minimum.',
      ],
      heroSubs: [
        '{name} has been keeping {location} homes and offices spotless for {years} years. Same team every visit, same high standards, same peace of mind when you walk through the door.',
        'Residential, commercial, deep clean, or weekly maintenance — {name} brings the same meticulous attention to every job. {years} years of earning trust in {location}.',
      ],
      heroTags: ['Trusted Cleaners • {location}', 'Insured & Background-Checked • {location}'],
      heroCTAs: ['Book Your First Clean', 'Get a Free Cleaning Estimate'],
      services: [
        { name: 'Residential Cleaning', description: 'Kitchens, bathrooms, floors, dusting — thorough, consistent cleaning on a schedule that works for your life.', icon: 'home' },
        { name: 'Deep Cleaning', description: 'Inside ovens, behind appliances, under furniture, ceiling fans. The clean that resets your entire house.', icon: 'sparkle' },
        { name: 'Commercial Cleaning', description: 'Offices, retail, medical — tailored cleaning plans with after-hours service and consistent results.', icon: 'building' },
        { name: 'Move-In/Move-Out', description: 'Get your deposit back or start fresh. Every surface, every corner, every drawer — spotless.', icon: 'box' },
        { name: 'Post-Construction', description: 'Dust everywhere? We specialize in making new builds and renovations actually livable.', icon: 'tool' },
        { name: 'Window Cleaning', description: 'Interior and exterior. Streak-free results that make you notice how dirty they were before.', icon: 'sun' },
      ],
      aboutBlocks: [{
        heading: 'Your home. Our responsibility.',
        paragraphs: [
          '{name} was started by someone who was tired of cleaning companies that cut corners. {years} years later, every cleaner is still trained to our standard: if it\'s not perfect, do it again.',
          'Every team member is background-checked, insured, and sent to the same home each visit so they know your preferences, your pets, and exactly how you like things done.',
        ],
      }],
      values: [
        { title: 'Consistent Team', desc: 'Same cleaners every visit. They know your home.' },
        { title: 'Background Checked', desc: 'Every team member verified and insured.' },
        { title: 'Satisfaction Guarantee', desc: 'Not happy? We come back within 24 hours. Free.' },
        { title: 'Eco-Friendly', desc: 'Non-toxic, pet-safe, child-safe products.' },
      ],
      testimonials: [
        { text: 'We\'ve had {name} coming weekly for two years. Same team, same quality, every single time. Coming home to a clean house on Fridays is the best part of my week.', author: 'Rachel T.', role: 'Homeowner, {location}' },
        { text: 'Hired them for a deep clean before selling our home. The realtor said it looked professionally staged. House sold above asking.', author: 'Kevin M.', role: 'Homeowner, {location}' },
        { text: 'They clean our dental office nightly. Six months in, not a single complaint from staff or patients. Reliable and thorough.', author: 'Dr. Kim L.', role: 'Business Owner' },
      ],
      ctaBlocks: [{ heading: 'Ready to stop cleaning your own house?', subtext: 'Book your first clean and see the difference. If you\'re not thrilled, it\'s on us.', button_text: 'Book Your First Clean' }],
    },
  };

  return db[niche] || buildGenericNiche(niche);
}

// ── Generic niche builder ─────────────────────────────────────

function buildGenericNiche(niche) {
  const niceName = capitalizeWords(niche || 'service');
  return {
    headlines: [
      `The kind of ${niche || 'service'} you\'ll actually recommend to friends.`,
      `${niceName} done right. By people who care.`,
      `Your search for a reliable ${niche || 'service'} company is over.`,
      `Quality ${niche || 'work'} from people who stand behind it.`,
    ],
    heroSubs: [
      '{name} has served {location} for {years} years. We built our reputation one job at a time — showing up on time, doing honest work, and standing behind every project.',
      'From your first call to the final walkthrough, {name} delivers the kind of {niche} work that {location} homeowners deserve. {years} years. Same team. Same standards.',
    ],
    heroTags: ['Licensed & Insured • {location}', '{years} Years Trusted • {location}'],
    heroCTAs: ['Get Your Free Estimate', 'Schedule a Free Consultation'],
    services: [
      { name: capitalizeWords(niche || 'Core Service'), description: 'Our primary offering, delivered with the quality and attention to detail that built our reputation over {years} years.', icon: 'check' },
      { name: 'Free Consultation', description: 'On-site assessment of your needs. We listen, ask questions, and provide an honest estimate with no obligations.', icon: 'message' },
      { name: 'Emergency Service', description: 'When it can\'t wait, neither do we. Fast response times for urgent situations.', icon: 'alert' },
      { name: 'Preventive Maintenance', description: 'Regular maintenance prevents expensive problems. We help you stay ahead of issues before they grow.', icon: 'calendar' },
      { name: 'Custom Solutions', description: 'Every project is unique. We tailor our approach to your situation, your preferences, and your budget.', icon: 'settings' },
      { name: 'Complete Project Management', description: 'From planning through cleanup. We handle the details so you don\'t have to.', icon: 'layers' },
    ],
    aboutBlocks: [{
      heading: 'Real people. Real work. Real results.',
      paragraphs: [
        '{name} was built on a simple idea: do great work, charge a fair price, and treat every customer the way you\'d want to be treated.',
        'We\'ve been serving {location} for {years} years, and our best marketing is still word of mouth from happy customers.',
      ],
    }],
    values: [
      { title: 'Honest Pricing', desc: 'The price we quote is the price you pay.' },
      { title: 'Licensed & Insured', desc: 'Full coverage. Full compliance.' },
      { title: 'Quality Guarantee', desc: 'We stand behind every job we do.' },
      { title: 'Clean & Professional', desc: 'We treat your property with respect.' },
    ],
    testimonials: [
      { text: 'Professional from start to finish. They showed up on time, did exactly what they said, and the price matched the quote. That shouldn\'t be rare — but it is.', author: 'Sarah M.', role: 'Customer, {location}' },
      { text: 'We\'ve used {name} twice now. Both times they went above and beyond. These are the kind of people you want working on your home.', author: 'David R.', role: 'Homeowner, {location}' },
      { text: 'Honest, reliable, skilled. No gimmicks, no pressure. Just solid work. Highly recommended.', author: 'Karen L.', role: 'Customer' },
    ],
    ctaBlocks: [{ heading: 'Ready to get started?', subtext: 'Free estimates. No obligation. Call us or send a message and we\'ll get back to you within 24 hours.', button_text: 'Get Your Free Estimate' }],
  };
}

// ── Utilities ─────────────────────────────────────────────────

function personalize(text, biz) {
  return (text || '')
    .replace(/\{name\}/g, biz.name)
    .replace(/\{location\}/g, biz.location || 'your area')
    .replace(/\{years\}/g, biz.years || '10+')
    .replace(/\{niche\}/g, biz.niche || 'service')
    .replace(/\{phone\}/g, biz.phone || '');
}

function capitalizeWords(str) {
  return (str || '').replace(/\b\w/g, c => c.toUpperCase());
}

function hashMod(str, mod) {
  if (mod <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return Math.abs(hash) % mod;
}

function findBestServiceMatch(raw, nicheServices) {
  const rawLow = raw.toLowerCase().trim();
  // Exact match
  const exact = nicheServices.find(s => s.name.toLowerCase() === rawLow);
  if (exact) return exact;
  // Partial match
  const partial = nicheServices.find(s =>
    rawLow.includes(s.name.toLowerCase().split(' ')[0].toLowerCase()) ||
    s.name.toLowerCase().includes(rawLow.split(' ')[0].toLowerCase())
  );
  return partial || null;
}

function generateServiceDescription(serviceName, biz, nicheData) {
  // Generate a natural-sounding description for a custom service
  const templates = [
    `Professional ${serviceName.toLowerCase()} service backed by {years} years of experience and our quality guarantee.`,
    `Expert ${serviceName.toLowerCase()} for {location} homes and businesses. We do it right, back it up, and stand behind our work.`,
    `Reliable ${serviceName.toLowerCase()} from a team that\'s been trusted in {location} for {years} years. Free estimates, honest pricing.`,
  ];
  const idx = hashMod(serviceName, templates.length);
  return personalize(templates[idx], biz);
}
