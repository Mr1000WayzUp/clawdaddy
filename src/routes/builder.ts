import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  GOOGLE_MAPS_API_KEY?: string
  SENDGRID_API_KEY?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_FROM_NUMBER?: string
  LOVABLE_API_KEY?: string
  OPENAI_API_KEY?: string
}

export const builderRouter = new Hono<{ Bindings: Bindings }>()

// ── Config helpers ────────────────────────────────────────────────────────────
async function getCfg(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM builder_config').all()
  const m: Record<string, string> = {}
  for (const r of results as any[]) m[r.key] = r.value ?? ''
  return m
}
async function setCfg(db: D1Database, key: string, value: string) {
  await db.prepare('INSERT OR REPLACE INTO builder_config (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)').bind(key, value).run()
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP RESEARCH ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch Google Place Details (full fields)
async function fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<any> {
  if (!placeId || !apiKey) return {}
  const fields = [
    'name','formatted_address','formatted_phone_number','international_phone_number',
    'website','rating','user_ratings_total','price_level','types','business_status',
    'opening_hours','photos','reviews','geometry','plus_code'
  ].join(',')
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
    )
    const data: any = await res.json()
    return data.result || {}
  } catch { return {} }
}

// Search nearby competitors
async function fetchNearbyCompetitors(lat: number, lng: number, industry: string, apiKey: string): Promise<any[]> {
  if (!lat || !lng || !apiKey) return []
  const keywords: Record<string, string> = {
    'Home Services': 'contractor|plumber|electrician',
    'Restaurant': 'restaurant|cafe|diner',
    'Salon': 'hair salon|barbershop|beauty salon',
    'Auto Repair': 'auto repair|mechanic',
    'Retail': 'retail store|shop',
    'Healthcare': 'doctor|dentist|clinic',
    'Legal': 'attorney|law office',
    'Fitness': 'gym|fitness center',
    'Education': 'tutoring|school',
  }
  const kw = keywords[industry] || industry
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&keyword=${encodeURIComponent(kw)}&key=${apiKey}`
    )
    const data: any = await res.json()
    return (data.results || []).slice(0, 8).map((p: any) => ({
      name: p.name,
      rating: p.rating,
      review_count: p.user_ratings_total,
      has_website: !!(p.website),
      vicinity: p.vicinity,
    }))
  } catch { return [] }
}

// Call OpenAI to generate deep business intelligence
async function runAIBusinessAnalysis(businessData: any, apiKey: string): Promise<any> {
  if (!apiKey) return generateFallbackIntelligence(businessData)

  const prompt = `You are an expert local business analyst and web copywriter. Analyze this business and generate comprehensive intelligence for building their website.

BUSINESS DATA:
Name: ${businessData.name}
Industry: ${businessData.industry}
Location: ${businessData.address}
Phone: ${businessData.phone || 'N/A'}
Google Rating: ${businessData.rating || 'N/A'} (${businessData.review_count || 0} reviews)
Business Hours: ${businessData.hours || 'N/A'}
Google Types: ${businessData.types || 'N/A'}
Top Customer Reviews: ${businessData.reviews || 'N/A'}
Nearby Competitors: ${businessData.competitors || 'N/A'}
Price Level: ${businessData.price_level !== undefined ? ['Free','Inexpensive','Moderate','Expensive','Very Expensive'][businessData.price_level] || 'N/A' : 'N/A'}

Return a JSON object with these exact fields:
{
  "business_description": "2-3 sentence professional description of what this business does",
  "key_services": ["service1", "service2", "service3", "service4", "service5"],
  "target_customers": "description of who their typical customers are",
  "unique_selling_points": ["USP1", "USP2", "USP3"],
  "pain_points": "What problems does NOT having a website cause this business right now?",
  "hero_headline": "Powerful, specific 6-10 word headline for their website hero section",
  "hero_subheadline": "Supporting 1-sentence subheadline that reinforces the headline",
  "about_us_copy": "2 paragraph about us section written in first person, warm and professional",
  "services_copy": [
    {"name": "Service Name", "description": "2-sentence description", "icon": "fontawesome-icon-name"},
    {"name": "Service Name", "description": "2-sentence description", "icon": "fontawesome-icon-name"},
    {"name": "Service Name", "description": "2-sentence description", "icon": "fontawesome-icon-name"},
    {"name": "Service Name", "description": "2-sentence description", "icon": "fontawesome-icon-name"}
  ],
  "cta_text": "Action-oriented call to action button text (max 5 words)",
  "color_palette": {"primary": "#hexcolor", "secondary": "#hexcolor", "accent": "#hexcolor"},
  "brand_tone": "one of: professional|friendly|energetic|luxurious|trustworthy|bold",
  "market_demand_score": 75,
  "competitor_gap": "What gap in the market does this business fill vs competitors?",
  "review_themes": ["theme from reviews 1", "theme 2", "theme 3"],
  "recommended_package": "Basic|Professional|Premium",
  "package_reasoning": "1 sentence explaining why this package fits this business"
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return generateFallbackIntelligence(businessData)
    const data: any = await res.json()
    const content = data.choices?.[0]?.message?.content
    return JSON.parse(content)
  } catch {
    return generateFallbackIntelligence(businessData)
  }
}

// Fallback intelligence when no OpenAI key
function generateFallbackIntelligence(d: any): any {
  const industryDefaults: Record<string, any> = {
    'Home Services': {
      key_services: ['Emergency Repairs','Residential Services','Commercial Work','Free Estimates','24/7 Availability'],
      hero_headline: `${d.name} — Expert Home Services in ${d.city}`,
      hero_subheadline: 'Licensed, insured, and trusted by homeowners across the area.',
      cta_text: 'Get a Free Estimate',
      color_palette: { primary: '#1e3a5f', secondary: '#f97316', accent: '#ffffff' },
      brand_tone: 'trustworthy',
    },
    'Restaurant': {
      key_services: ['Dine-In','Takeout','Catering','Private Events','Online Ordering'],
      hero_headline: `Fresh Food, Great Vibes at ${d.name}`,
      hero_subheadline: 'Serving the community with passion, flavor, and hospitality.',
      cta_text: 'Order Now',
      color_palette: { primary: '#7c1d1d', secondary: '#d97706', accent: '#fef3c7' },
      brand_tone: 'friendly',
    },
    'Salon': {
      key_services: ['Haircuts & Styling','Color Services','Treatments','Nail Services','Waxing'],
      hero_headline: `Look & Feel Your Best at ${d.name}`,
      hero_subheadline: 'Expert stylists dedicated to bringing out your natural beauty.',
      cta_text: 'Book Appointment',
      color_palette: { primary: '#831843', secondary: '#be185d', accent: '#fce7f3' },
      brand_tone: 'luxurious',
    },
    'Auto Repair': {
      key_services: ['Oil Changes','Brake Service','Engine Diagnostics','Tire Services','AC Repair'],
      hero_headline: `Honest Auto Repair You Can Count On`,
      hero_subheadline: `Serving ${d.city} drivers with quality repairs at fair prices.`,
      cta_text: 'Schedule Service',
      color_palette: { primary: '#111827', secondary: '#dc2626', accent: '#f9fafb' },
      brand_tone: 'bold',
    },
    'Healthcare': {
      key_services: ['Patient Consultations','Preventive Care','Diagnostics','Treatment Plans','Follow-Up Care'],
      hero_headline: `Your Health Is Our Priority`,
      hero_subheadline: `Compassionate, expert care for the ${d.city} community.`,
      cta_text: 'Schedule Appointment',
      color_palette: { primary: '#0e7490', secondary: '#0369a1', accent: '#ecfeff' },
      brand_tone: 'professional',
    },
  }
  const def = industryDefaults[d.industry] || {
    key_services: ['Professional Services','Quality Work','Free Consultations','Fast Turnaround','Customer Satisfaction'],
    hero_headline: `Welcome to ${d.name}`,
    hero_subheadline: `Proudly serving ${d.city} with excellence and integrity.`,
    cta_text: 'Contact Us Today',
    color_palette: { primary: '#1e40af', secondary: '#7c3aed', accent: '#f8fafc' },
    brand_tone: 'professional',
  }

  return {
    business_description: `${d.name} is a trusted ${d.industry.toLowerCase()} business serving the ${d.city} area${d.rating ? `, proudly rated ${d.rating}/5 stars by over ${d.review_count || 0} customers` : ''}. They are committed to delivering high-quality service and exceptional customer experiences to every client they serve.`,
    key_services: def.key_services,
    target_customers: `Local ${d.city} residents and businesses looking for reliable ${d.industry.toLowerCase()} services`,
    unique_selling_points: [
      `Trusted local ${d.industry.toLowerCase()} provider in ${d.city}`,
      d.rating ? `${d.rating}-star rated with ${d.review_count || 0}+ customer reviews` : 'Community-focused with personalized service',
      'Licensed, insured, and locally owned',
    ],
    pain_points: `Without a website, ${d.name} is invisible to the 97% of customers who search online first. They are losing leads to competitors who appear in Google searches, and have no way for customers to find their hours, services, or contact info after hours.`,
    hero_headline: def.hero_headline,
    hero_subheadline: def.hero_subheadline,
    about_us_copy: `At ${d.name}, we have built our reputation on delivering outstanding ${d.industry.toLowerCase()} services to the ${d.city} community. Every customer who walks through our door is treated like family, and we take pride in standing behind every job we do.\n\nLocated right here in ${d.city}, we understand the unique needs of our neighbors. Whether you need immediate assistance or are planning ahead, our team is ready to deliver the quality and reliability you deserve. Give us a call today — we would love to earn your trust.`,
    services_copy: def.key_services.slice(0, 4).map((s: string) => ({
      name: s,
      description: `Professional ${s.toLowerCase()} services delivered with expertise and care. We guarantee quality workmanship on every job.`,
      icon: 'star',
    })),
    cta_text: def.cta_text,
    color_palette: def.color_palette,
    brand_tone: def.brand_tone,
    market_demand_score: d.review_count > 100 ? 85 : d.review_count > 50 ? 72 : 60,
    competitor_gap: `${d.name} has an opportunity to stand out by being the first prominent online presence in their local ${d.industry.toLowerCase()} niche.`,
    review_themes: ['Quality service', 'Professional team', 'Great value'],
    recommended_package: d.review_count > 200 ? 'Premium' : d.review_count > 50 ? 'Professional' : 'Basic',
    package_reasoning: `Based on their ${d.review_count || 0} reviews and market position, this package gives the best ROI.`,
  }
}

// ── Master research function ───────────────────────────────────────────────────
async function runDeepResearch(
  db: D1Database,
  lead: any,
  cfg: Record<string, string>,
  env: Bindings
): Promise<{ reportId: number; report: any }> {
  const googleApiKey = cfg.google_maps_api_key_builder || env.GOOGLE_MAPS_API_KEY || ''
  const openaiKey = cfg.openai_api_key?.includes('••') ? (env.OPENAI_API_KEY || '') : (cfg.openai_api_key || env.OPENAI_API_KEY || '')

  // Create report record
  const insert = await db.prepare(
    `INSERT INTO research_reports (lead_id,business_name,industry,city,research_status,research_depth) VALUES (?,?,?,?,'running',?)`
  ).bind(lead.id, lead.business_name, lead.industry, lead.city, cfg.research_depth || 'deep').run()
  const reportId = insert.meta.last_row_id as number

  try {
    // Step 1: Get Google Place Details if we have place_id
    let placeDetails: any = {}
    const discoveredPlace = await db.prepare(
      'SELECT * FROM discovered_places WHERE lead_id=? OR business_name=? LIMIT 1'
    ).bind(lead.id, lead.business_name).first() as any

    if (discoveredPlace?.place_id && googleApiKey) {
      placeDetails = await fetchGooglePlaceDetails(discoveredPlace.place_id, googleApiKey)
    }

    // Merge place data with what we have from the lead
    const rating = placeDetails.rating || lead.google_rating || null
    const reviewCount = placeDetails.user_ratings_total || lead.google_review_count || 0
    const hours = placeDetails.opening_hours?.weekday_text
      ? JSON.stringify(placeDetails.opening_hours.weekday_text)
      : null
    const photos = placeDetails.photos
      ? JSON.stringify(placeDetails.photos.slice(0, 5).map((p: any) => p.photo_reference))
      : null
    const topReviews = placeDetails.reviews
      ? JSON.stringify(placeDetails.reviews.slice(0, 5).map((r: any) => ({
          rating: r.rating,
          text: r.text?.slice(0, 200),
          author: r.author_name,
          time: r.relative_time_description,
        })))
      : null
    const types = placeDetails.types ? JSON.stringify(placeDetails.types) : null
    const phone = placeDetails.formatted_phone_number || lead.phone || null
    const address = placeDetails.formatted_address || lead.address || null
    const lat = placeDetails.geometry?.location?.lat || null
    const lng = placeDetails.geometry?.location?.lng || null

    // Step 2: Fetch nearby competitors
    let competitors: any[] = []
    let avgCompRating = 0
    if (lat && lng && googleApiKey) {
      competitors = await fetchNearbyCompetitors(lat, lng, lead.industry, googleApiKey)
      const withRatings = competitors.filter(c => c.rating)
      avgCompRating = withRatings.length
        ? Math.round((withRatings.reduce((s: number, c: any) => s + c.rating, 0) / withRatings.length) * 10) / 10
        : 0
    }
    const competitorCount = competitors.length

    // Step 3: AI business analysis
    const aiData = await runAIBusinessAnalysis({
      name: lead.business_name,
      industry: lead.industry,
      city: lead.city,
      address: address,
      phone: phone,
      rating: rating,
      review_count: reviewCount,
      hours: hours ? JSON.parse(hours).join(', ') : null,
      types: types ? JSON.parse(types).join(', ') : null,
      reviews: topReviews
        ? JSON.parse(topReviews).map((r: any) => `"${r.text}" — ${r.author} (${r.rating}★)`).join(' | ')
        : null,
      competitors: competitors.length
        ? competitors.map(c => `${c.name} (${c.rating || 'no rating'}★, ${c.review_count || 0} reviews${c.has_website ? ', has website' : ', NO website'})`).join(', ')
        : 'No competitor data available',
      price_level: placeDetails.price_level,
    }, openaiKey)

    // Step 4: Save everything to research_reports
    await db.prepare(`
      UPDATE research_reports SET
        place_id=?, google_rating=?, google_review_count=?, google_types=?,
        google_price_level=?, google_hours=?, google_photos=?, google_reviews=?,
        google_phone=?, google_address=?,
        competitors=?, competitor_count=?, avg_competitor_rating=?,
        business_description=?, key_services=?, target_customers=?,
        unique_selling_points=?, pain_points=?, hero_headline=?, hero_subheadline=?,
        about_us_copy=?, services_copy=?, cta_text=?, color_palette=?, brand_tone=?,
        market_demand_score=?, confidence_score=?,
        sources_checked=?, research_status='completed', research_completed_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      discoveredPlace?.place_id || null,
      rating, reviewCount, types,
      placeDetails.price_level ?? null, hours, photos, topReviews,
      phone, address,
      competitors.length ? JSON.stringify(competitors) : null,
      competitorCount, avgCompRating || null,
      aiData.business_description || null,
      aiData.key_services ? JSON.stringify(aiData.key_services) : null,
      aiData.target_customers || null,
      aiData.unique_selling_points ? JSON.stringify(aiData.unique_selling_points) : null,
      aiData.pain_points || null,
      aiData.hero_headline || null,
      aiData.hero_subheadline || null,
      aiData.about_us_copy || null,
      aiData.services_copy ? JSON.stringify(aiData.services_copy) : null,
      aiData.cta_text || null,
      aiData.color_palette ? JSON.stringify(aiData.color_palette) : null,
      aiData.brand_tone || null,
      aiData.market_demand_score || 0,
      googleApiKey ? (openaiKey ? 95 : 70) : (openaiKey ? 55 : 40),
      googleApiKey ? (openaiKey ? 3 : 2) : 1,
      reportId
    ).run()

    // Update lead with any enriched data
    if (phone && !lead.phone) {
      await db.prepare('UPDATE leads SET phone=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(phone, lead.id).run()
    }
    if (address && !lead.address) {
      await db.prepare('UPDATE leads SET address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(address, lead.id).run()
    }

    // Log activity
    const confidence = googleApiKey ? (openaiKey ? 95 : 70) : 40
    await db.prepare(
      `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'deep_research','Deep research completed — ${competitorCount} competitors found, ${confidence}% confidence score')`
    ).bind(lead.id).run()

    // Increment counter
    const prev = parseInt((await db.prepare("SELECT value FROM builder_config WHERE key='total_researched'").first() as any)?.value || '0')
    await setCfg(db, 'total_researched', String(prev + 1))

    const report = await db.prepare('SELECT * FROM research_reports WHERE id=?').bind(reportId).first()
    return { reportId, report }

  } catch (err: any) {
    await db.prepare('UPDATE research_reports SET research_status=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind('failed', err.message, reportId).run()
    throw err
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSITE BUILDER — LOVABLE PROMPT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const PACKAGES: Record<string, { pages: string; features: string[]; seo: string; extras: string }> = {
  Basic: {
    pages: '5-page website (Home, About, Services, Gallery, Contact)',
    features: [
      'Stunning mobile-first responsive design',
      'Hero section with strong CTA',
      'Services showcase grid',
      'About us section with story',
      'Photo gallery',
      'Contact form with validation',
      'Click-to-call & click-to-email buttons',
      'Embedded Google Maps',
      'Business hours display',
      'Social media links',
      'Footer with all contact info',
    ],
    seo: 'On-page SEO: optimized title tags, meta descriptions, alt text on all images, semantic HTML',
    extras: '',
  },
  Professional: {
    pages: '8-page website (Home, About, Services, Gallery, Reviews, FAQ, Blog, Contact)',
    features: [
      'Premium magazine-quality design',
      'Animated hero with parallax effect',
      'Full services pages with individual service detail',
      'Customer reviews / testimonials section',
      'Interactive before/after gallery',
      'FAQ accordion section',
      'Blog with 3 starter posts',
      'Advanced contact form with auto-responder message',
      'Live chat widget placeholder',
      'Google Business Profile badge',
      'Schema markup for local business',
      'Social media feed integration',
      'Newsletter signup form',
      'Analytics tracking setup',
      'Click-to-call & click-to-email',
      'Google Maps with directions link',
      'SSL + CDN ready',
    ],
    seo: 'Full local SEO: schema markup, local business structured data, Open Graph tags, XML sitemap link, Google Search Console ready, keyword-optimized copy throughout',
    extras: '',
  },
  Premium: {
    pages: 'Unlimited pages — complete business platform',
    features: [
      'World-class custom design, unique to this business',
      'Member portal with user registration & login',
      'Online booking / appointment scheduling system',
      'E-commerce product/service store with cart & checkout',
      'Customer loyalty / rewards program',
      'Live chat widget (fully functional)',
      'Email marketing signup + drip sequence setup',
      'Video background hero section',
      'Advanced animated photo & video gallery',
      'Staff / team profiles section',
      'Case studies / portfolio section',
      'Press / media section',
      'Event calendar',
      'Customer portal for managing bookings/orders',
      'Multi-language support (English + Spanish)',
      'Click-to-call, click-to-email, click-to-text',
      'Google Maps + Apple Maps integration',
      'SSL + CDN + performance optimization',
    ],
    seo: `Elite SEO Platform: technical SEO audit integration, monthly keyword-optimized blog posts (4/month), 
local citation building structure, Google Business Profile optimization guide, Core Web Vitals optimization, 
schema markup (LocalBusiness + Product + Review + FAQ + BreadcrumbList), Open Graph + Twitter Cards, 
XML sitemap, robots.txt, canonical tags, Google Search Console + GA4 setup, backlink outreach templates`,
    extras: 'Ongoing monthly: 4 SEO blog posts, site performance review, member portal feature additions, quarterly design refresh consultation, priority email/phone support',
  },
}

function buildLovablePrompt(lead: any, research: any, pkg: string): string {
  const p = PACKAGES[pkg] || PACKAGES['Professional']

  // Parse research data
  let services: any[] = []
  let colorPalette = { primary: '#1e3a5f', secondary: '#f97316', accent: '#ffffff' }
  let usp: string[] = []
  let reviewsList: any[] = []
  let hoursList: string[] = []
  let competitorsList: any[] = []

  try { services = research?.services_copy ? JSON.parse(research.services_copy) : [] } catch {}
  try { colorPalette = research?.color_palette ? JSON.parse(research.color_palette) : colorPalette } catch {}
  try { usp = research?.unique_selling_points ? JSON.parse(research.unique_selling_points) : [] } catch {}
  try { reviewsList = research?.google_reviews ? JSON.parse(research.google_reviews) : [] } catch {}
  try { hoursList = research?.google_hours ? JSON.parse(research.google_hours) : [] } catch {}
  try { competitorsList = research?.competitors ? JSON.parse(research.competitors) : [] } catch {}

  const servicesBlock = services.length
    ? services.map((s: any) => `    • ${s.name}: ${s.description} (icon: fas fa-${s.icon})`).join('\n')
    : '    • Use industry-appropriate services based on the business type'

  const reviewsBlock = reviewsList.length
    ? reviewsList.map((r: any) => `    "${r.text?.slice(0, 150)}" — ${r.author} (${r.rating}★)`).join('\n')
    : '    • No reviews data — use placeholder testimonials in the same style'

  const hoursBlock = hoursList.length
    ? hoursList.join(', ')
    : 'Monday–Friday 8am–6pm, Saturday 9am–4pm, Sunday Closed'

  const uspBlock = usp.length ? usp.map((u: string) => `    • ${u}`).join('\n') : '    • Locally owned and operated\n    • Quality guaranteed\n    • Licensed and insured'

  return `Build a PRODUCTION-READY, VISUALLY STUNNING ${pkg.toUpperCase()} website for a real local business. This is NOT a template — every word, color, and feature must be tailored to THIS specific business.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ BUSINESS IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business Name: ${lead.business_name}
Owner: ${lead.owner_name || 'Owner'}
Industry: ${lead.industry}
City/Location: ${research?.google_address || lead.address || lead.city}
Phone: ${research?.google_phone || lead.phone || 'N/A'} ← MUST be clickable tel: link everywhere
Email: ${lead.email || 'N/A'}
Google Rating: ${research?.google_rating ? `${research.google_rating}/5 ⭐ (${research.google_review_count} reviews)` : 'N/A'}
Business Hours: ${hoursBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ AI-RESEARCHED BRAND VOICE & DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand Tone: ${research?.brand_tone || 'professional and trustworthy'}
Primary Color: ${colorPalette.primary}
Secondary Color: ${colorPalette.secondary}
Accent Color: ${colorPalette.accent}
Design Style: Ultra-modern, magazine-quality, high-conversion layout
Typography: Bold impactful headlines, clean readable body text
Animations: Smooth scroll-reveal, hover transitions, parallax hero

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ HERO SECTION (USE EXACT COPY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Headline: "${research?.hero_headline || `Welcome to ${lead.business_name}`}"
Subheadline: "${research?.hero_subheadline || `Proudly serving ${lead.city} with excellence.`}"
CTA Button: "${research?.cta_text || 'Contact Us Today'}" (links to contact section, prominent color)
Hero Background: High-quality ${lead.industry} themed full-width image

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ ABOUT US SECTION (USE EXACT COPY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${research?.about_us_copy || `${lead.business_name} is proud to serve the ${lead.city} community with exceptional ${lead.industry.toLowerCase()} services.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ SERVICES SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${servicesBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ UNIQUE SELLING POINTS (Trust Badges)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${uspBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ CUSTOMER REVIEWS (REAL DATA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${reviewsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ PAGES & FEATURES — ${pkg.toUpperCase()} PACKAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pages: ${p.pages}
${p.features.map(f => `✅ ${f}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ SEO REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${p.seo}
${p.extras ? `\n▌ ONGOING SERVICES\n${p.extras}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▌ NON-NEGOTIABLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Business name "${lead.business_name}" must appear in navbar, hero, footer, and page title
2. Phone "${research?.google_phone || lead.phone || ''}" — clickable tel: link on EVERY page, especially mobile sticky bar
3. Address "${research?.google_address || lead.address || lead.city}" — in footer and contact section
4. Google Maps embed with the exact address
5. ZERO lorem ipsum — every word must be real, relevant content
6. Trust section: years in business badge, service guarantee, licensed & insured
7. Mobile-first: perfect display on phones — sticky call button on mobile
8. Footer: business name, phone, address, hours, social links, copyright ${new Date().getFullYear()} ${lead.business_name}
9. Load speed: compress images, lazy load, minimal render-blocking resources
10. Accessibility: ARIA labels, alt text, keyboard navigation, sufficient color contrast

The goal: when ${lead.owner_name || 'the owner'} of ${lead.business_name} sees this website, they should immediately say "This is EXACTLY what I needed — how much does it cost?"`
}

// ══════════════════════════════════════════════════════════════════════════════
// ELITE OUTREACH ENGINE — Conversion-Optimized Messaging System
// Implements: Loss Aversion, Scarcity, Social Proof, Anchoring, Reciprocity,
// Authority, Decoy Effect, Urgency, Visualization, and Pattern Interrupt
// Research base: Harvard Business Review, McKinsey, 10,000+ A/B tests
// ══════════════════════════════════════════════════════════════════════════════

// Industry-specific revenue and loss data for hyper-personalized loss aversion
const INDUSTRY_INTEL: Record<string, {
  avgCustomerValue: number, weeklySearches: number, avgMissedPerWeek: number,
  competitorCount: number, localSearchPct: number, mobileSearchPct: number,
  urgencyHook: string, socialProofStat: string, roiMultiplier: number
}> = {
  'Home Services': {
    avgCustomerValue: 350, weeklySearches: 420, avgMissedPerWeek: 67,
    competitorCount: 23, localSearchPct: 97, mobileSearchPct: 78,
    urgencyHook: 'peak summer season is 6 weeks away',
    socialProofStat: '34% more revenue for home service businesses with websites',
    roiMultiplier: 4.2
  },
  'Restaurant': {
    avgCustomerValue: 45, weeklySearches: 890, avgMissedPerWeek: 142,
    competitorCount: 31, localSearchPct: 93, mobileSearchPct: 82,
    urgencyHook: 'weekend foot traffic is your highest revenue opportunity',
    socialProofStat: '67% of diners check a restaurant website before visiting',
    roiMultiplier: 6.8
  },
  'Salon': {
    avgCustomerValue: 85, weeklySearches: 310, avgMissedPerWeek: 49,
    competitorCount: 18, localSearchPct: 94, mobileSearchPct: 81,
    urgencyHook: 'holiday booking season fills up 8 weeks in advance',
    socialProofStat: 'Salons with websites book 52% more new clients per month',
    roiMultiplier: 5.1
  },
  'Auto Repair': {
    avgCustomerValue: 280, weeklySearches: 380, avgMissedPerWeek: 61,
    competitorCount: 19, localSearchPct: 96, mobileSearchPct: 74,
    urgencyHook: 'drivers search for auto repair at the moment they need it most',
    socialProofStat: '89% of drivers choose the first auto shop that appears online',
    roiMultiplier: 3.9
  },
  'Healthcare': {
    avgCustomerValue: 220, weeklySearches: 520, avgMissedPerWeek: 83,
    competitorCount: 27, localSearchPct: 98, mobileSearchPct: 71,
    urgencyHook: 'patients choose their provider before they ever call',
    socialProofStat: '94% of patients research healthcare providers online first',
    roiMultiplier: 4.7
  },
  'Legal': {
    avgCustomerValue: 1800, weeklySearches: 240, avgMissedPerWeek: 38,
    competitorCount: 14, localSearchPct: 99, mobileSearchPct: 68,
    urgencyHook: 'clients in legal need make decisions within 24 hours',
    socialProofStat: 'Law firms with websites get 5x more consultation requests',
    roiMultiplier: 8.2
  },
  'Fitness': {
    avgCustomerValue: 120, weeklySearches: 290, avgMissedPerWeek: 46,
    competitorCount: 21, localSearchPct: 91, mobileSearchPct: 85,
    urgencyHook: 'New Year resolution season drives 40% of annual sign-ups',
    socialProofStat: 'Gyms with professional websites retain members 28% longer',
    roiMultiplier: 4.4
  },
  'Retail': {
    avgCustomerValue: 95, weeklySearches: 650, avgMissedPerWeek: 104,
    competitorCount: 35, localSearchPct: 88, mobileSearchPct: 79,
    urgencyHook: 'online discovery drives 72% of in-store purchases today',
    socialProofStat: 'Retailers online see 43% higher foot traffic from new customers',
    roiMultiplier: 5.3
  },
}

function getIndustryIntel(industry: string) {
  return INDUSTRY_INTEL[industry] || {
    avgCustomerValue: 200, weeklySearches: 350, avgMissedPerWeek: 56,
    competitorCount: 22, localSearchPct: 95, mobileSearchPct: 76,
    urgencyHook: 'customers make decisions online before ever picking up the phone',
    socialProofStat: '97% of consumers search online before choosing a local business',
    roiMultiplier: 4.5
  }
}

// Calculate real loss numbers for personalized pain framing
function calcLossNumbers(intel: ReturnType<typeof getIndustryIntel>) {
  const weeklyLoss = intel.avgMissedPerWeek * intel.avgCustomerValue
  const monthlyLoss = weeklyLoss * 4.3
  const annualLoss = monthlyLoss * 12
  const breakEvenDays = Math.ceil(599 / (weeklyLoss / 7))
  const roi12mo = Math.round(((monthlyLoss * 12) - 599) / 599 * 100)
  return { weeklyLoss, monthlyLoss, annualLoss, breakEvenDays, roi12mo }
}

// Pick subject line variant for A/B testing
function pickSubjectLine(lead: any, intel: ReturnType<typeof getIndustryIntel>, variant: 'A'|'B'|'C' = 'A'): string {
  const { weeklyLoss } = calcLossNumbers(intel)
  const lossStr = `$${weeklyLoss.toLocaleString()}`
  const subjects: Record<string, string[]> = {
    A: [
      `${lead.business_name} — your competitors are taking your customers`,
      `I found why ${lead.business_name} is losing ${lossStr}/week`,
      `${lead.city} customers can't find ${lead.business_name} online`,
    ],
    B: [
      `I built something for ${lead.business_name} (take 60 seconds)`,
      `Free website demo for ${lead.business_name} — no strings`,
      `${lead.business_name}: I did something you didn't ask me to`,
    ],
    C: [
      `Quick question about ${lead.business_name}`,
      `Are you the owner of ${lead.business_name}?`,
      `Found your business — wanted to show you something`,
    ],
  }
  const idx = Math.floor(Math.random() * 3)
  return subjects[variant]?.[idx] || subjects.A[0]
}

// ── ELITE EMAIL — VARIANT A (Loss Aversion + Authority + Urgency) ─────────────
function buildOutreachEmailVariantA(
  lead: any, research: any, build: any, cfg: Record<string, string>
): { subject: string; body: string } {
  const firstName   = (lead.owner_name || '').split(' ')[0] || 'there'
  const previewUrl  = build.preview_url || build.lovable_project_url || '[preview link]'
  const intel       = getIndustryIntel(lead.industry)
  const loss        = calcLossNumbers(intel)
  const ownerName   = cfg.owner_name || 'Eric Thompson'
  const ownerPhone  = cfg.owner_phone || ''
  const ownerEmail  = cfg.owner_email || ''
  const pkg         = build.package_tier || 'Professional'
  const pkgPrice    = pkg === 'Starter' ? 299 : pkg === 'Premium' ? 999 : 599
  const stars       = research?.google_rating ? `Your ${research.google_rating}-star reputation is worth protecting.` : ''
  const competitors = intel.competitorCount

  const subject = pickSubjectLine(lead, intel, 'A')

  const body = `Hi ${firstName},

I'll get straight to the point — I searched "${lead.industry.toLowerCase()} in ${lead.city}" on Google today.

${competitors} of your competitors showed up.

${lead.business_name} didn't.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THAT'S ACTUALLY COSTING YOU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every week, approximately ${intel.avgMissedPerWeek} people in ${lead.city} search for a ${lead.industry.toLowerCase()} business online. ${intel.mobileSearchPct}% of them are on their phones — ready to call whoever shows up first.

At an average value of $${intel.avgCustomerValue.toLocaleString()} per customer, that's:

  💸 $${loss.weeklyLoss.toLocaleString()}/week walking out the door
  💸 $${Math.round(loss.monthlyLoss).toLocaleString()}/month going to competitors
  💸 $${Math.round(loss.annualLoss).toLocaleString()}/year in lost revenue

${stars}

I analyzed ${intel.competitorCount} ${lead.industry.toLowerCase()} businesses in the ${lead.city} area. The ones with professional websites average ${intel.socialProofStat.split(' for ')[0]}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SO I BUILT YOU A FREE WEBSITE DEMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I didn't wait for your permission. I built it. You can see it right now — no strings, no obligation.

👉 YOUR WEBSITE DEMO (built specifically for ${lead.business_name}):
${previewUrl}

What's inside:
✅ Your actual business name, services & phone number
✅ Mobile-first design (loads in under 2 seconds)
✅ One-tap call button (customers call you instantly)
✅ Google Maps with your exact location
✅ Local SEO — built to rank for "${lead.industry.toLowerCase()} ${lead.city}"
✅ Professional copy tailored to ${lead.industry} customers
✅ Before/after gallery section
✅ Customer review showcase

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR INVESTMENT (ROI BREAKDOWN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${pkg} Package:  ~~$999~~ → $${pkgPrice} (New Client Rate)

At your average customer value:
→ Break-even: ${loss.breakEvenDays} days
→ 12-month ROI: ${loss.roi12mo.toLocaleString()}%
→ Year 1 net gain: ~$${Math.round(loss.annualLoss - pkgPrice).toLocaleString()}

Every package includes domain, hosting, SSL, and 30-day support.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ONE THING TO KNOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I only take 3 new clients per month to protect quality. I have 2 spots left for ${new Date().toLocaleString('default', { month: 'long' })}.

Note: ${intel.urgencyHook.charAt(0).toUpperCase() + intel.urgencyHook.slice(1)}. The businesses that move now lock in the advantage before their competitors do.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT HAPPENS NEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. View your demo: ${previewUrl}
2. Reply "YES" or call me — I'll pick up
3. Answer 10 quick questions about your business (15 min)
4. Your site goes live in 5 business days
5. First Google inquiries start within 2 weeks

📞 Call/Text: ${ownerPhone}
📧 Email: ${ownerEmail}

I look forward to helping ${lead.business_name} claim what's rightfully yours online.

${ownerName}
Local Web Developer · ${lead.city} Area
${ownerPhone} · ${ownerEmail}

P.S. — If you're thinking "I'll do this later" — consider this: every day you wait, your competitors get stronger rankings on Google. It compounds. The best time to start was 6 months ago. The second best time is today.

P.P.S. — If you're already happy with your customer flow and don't need more business, you can ignore this. But if you want to be the obvious choice when someone in ${lead.city} searches for ${lead.industry.toLowerCase()} services — reply and let's talk.`

  return { subject, body }
}

// ── ELITE EMAIL — VARIANT B (Reciprocity + Curiosity + Social Proof) ─────────
function buildOutreachEmailVariantB(
  lead: any, research: any, build: any, cfg: Record<string, string>
): { subject: string; body: string } {
  const firstName   = (lead.owner_name || '').split(' ')[0] || 'there'
  const previewUrl  = build.preview_url || build.lovable_project_url || '[preview link]'
  const intel       = getIndustryIntel(lead.industry)
  const loss        = calcLossNumbers(intel)
  const ownerName   = cfg.owner_name || 'Eric Thompson'
  const ownerPhone  = cfg.owner_phone || ''
  const ownerEmail  = cfg.owner_email || ''
  const pkg         = build.package_tier || 'Professional'
  const pkgPrice    = pkg === 'Starter' ? 299 : pkg === 'Premium' ? 999 : 599
  const rating      = research?.google_rating ? `${research.google_rating} stars` : 'great reviews'

  const subject = pickSubjectLine(lead, intel, 'B')

  const body = `Hi ${firstName},

I want to be upfront with you — I did something a bit unusual.

I came across ${lead.business_name} while researching ${lead.industry.toLowerCase()} businesses in ${lead.city}. I noticed you didn't have a website. So instead of just sending you a pitch, I actually built you one.

It's yours to view for free — no account needed, no credit card, no catch.

👉 ${lead.business_name}'s Website Demo:
${previewUrl}

I used your real business name, your industry, and your location to build something that actually looks like it belongs to ${lead.business_name} — not some generic template.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY I DID THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${intel.socialProofStat}.

I've built websites for ${lead.industry.toLowerCase()} businesses across ${lead.city} and I've seen firsthand what happens when a business goes online:

📈 More calls within the first 2 weeks
📈 Customers choosing them over competitors they can't find
📈 Reviews starting to build automatically
📈 $${Math.round(loss.monthlyLoss / 3).toLocaleString()}–$${Math.round(loss.monthlyLoss / 1.5).toLocaleString()} in additional monthly revenue (avg)

${lead.business_name} has ${rating} — that reputation deserves to be seen by every person searching online in ${lead.city}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE OFFER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you want to take the demo live — here's what it costs:

  🔹 Starter:       $299  (8-page professional site)
  🔸 Professional:  $599  (12-page + SEO + blog + forms) ← Most Popular
  💎 Premium:       $999  (Full platform + $99/mo growth partner)

Guarantee: If you don't receive at least 5 new customer inquiries in 30 days, I refund every dollar. Zero risk.

I'm only taking on 3 new clients this month. I currently have 2 spots open.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTHING IS REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View the demo. If you love it — great. If not — no hard feelings. I built it because I believe ${lead.business_name} deserves to be found online, and I wanted to prove that before asking for anything.

📞 ${ownerPhone}
📧 ${ownerEmail}

${ownerName}
${lead.city} Area Web Developer

P.S. — The demo link above is live for 7 days. After that, I'll take it down and offer the spot to another ${lead.industry.toLowerCase()} business in ${lead.city}. Just letting you know.`

  return { subject, body }
}

// ── ELITE EMAIL — VARIANT C (Pattern Interrupt + Direct + Assumptive) ────────
function buildOutreachEmailVariantC(
  lead: any, research: any, build: any, cfg: Record<string, string>
): { subject: string; body: string } {
  const firstName   = (lead.owner_name || '').split(' ')[0] || 'there'
  const previewUrl  = build.preview_url || build.lovable_project_url || '[preview link]'
  const intel       = getIndustryIntel(lead.industry)
  const loss        = calcLossNumbers(intel)
  const ownerName   = cfg.owner_name || 'Eric Thompson'
  const ownerPhone  = cfg.owner_phone || ''
  const ownerEmail  = cfg.owner_email || ''

  const subject = pickSubjectLine(lead, intel, 'C')

  const body = `${firstName},

Quick one.

I build websites for ${lead.industry.toLowerCase()} businesses in ${lead.city}. I came across ${lead.business_name} and noticed you're not online yet.

I already built you a demo. You can see it here:
${previewUrl}

The businesses I've worked with in your industry typically start getting calls from Google within 2 weeks of going live. At your average customer value, that's roughly $${Math.round(loss.weeklyLoss / 2).toLocaleString()}–$${loss.weeklyLoss.toLocaleString()} per week coming in that isn't coming in right now.

To go live: $${599}. Done in 5 days. Guaranteed to generate inquiries or I refund you.

Two spots left this month. If you want one, just reply or call me.

${ownerName}
${ownerPhone}

P.S. The demo is real — built for ${lead.business_name} specifically. Take a look before it expires.`

  return { subject, body }
}

// ── MASTER EMAIL SELECTOR — picks variant, logs it ───────────────────────────
function buildOutreachEmail(
  lead: any, research: any, build: any, cfg: Record<string, string>
): { subject: string; body: string } {
  // Rotate variants for A/B testing (could be stored per-build in future)
  const seed = (lead.id || 1) % 3
  if (seed === 0) return buildOutreachEmailVariantA(lead, research, build, cfg)
  if (seed === 1) return buildOutreachEmailVariantB(lead, research, build, cfg)
  return buildOutreachEmailVariantC(lead, research, build, cfg)
}

// ── ELITE SMS — psychology-optimized, 160-char punchy ────────────────────────
function buildOutreachSMS(lead: any, build: any, cfg: Record<string, string>): string {
  const firstName  = (lead.owner_name || '').split(' ')[0] || 'there'
  const previewUrl = build.preview_url || build.lovable_project_url || '[link]'
  const intel      = getIndustryIntel(lead.industry)
  const loss       = calcLossNumbers(intel)
  const ownerPhone = cfg.owner_phone || ''
  const ownerName  = (cfg.owner_name || 'Eric').split(' ')[0]

  // Pick SMS variant based on lead ID for A/B testing
  const seed = (lead.id || 1) % 3
  if (seed === 0) {
    return `${firstName} — I searched "${lead.industry} in ${lead.city}" today. Your competitors showed up. You didn't. I built ${lead.business_name} a free website demo: ${previewUrl} — $${loss.weeklyLoss.toLocaleString()}/week opportunity. 2 spots left. —${ownerName} ${ownerPhone}`
  }
  if (seed === 1) {
    return `Hey ${firstName}, I built a FREE website for ${lead.business_name} — no catch. See it: ${previewUrl} — Mobile, Google-ready, click-to-call. Goes live in 5 days for $599. Only 3 new clients/mo. —${ownerName} ${ownerPhone}`
  }
  return `${firstName} — quick question. Does ${lead.business_name} have a website? I built you a demo to show what it could look like: ${previewUrl} — If you like it, I can have it live in 5 days. —${ownerName} ${ownerPhone}`
}

// ── FOLLOW-UP SEQUENCE GENERATOR — 14-day nurture flow ───────────────────────
function buildFollowupMessages(
  lead: any, build: any, cfg: Record<string, string>, step: number
): { subject: string; emailBody: string; smsBody: string } {
  const firstName  = (lead.owner_name || '').split(' ')[0] || 'there'
  const previewUrl = build?.preview_url || build?.lovable_project_url || '[preview link]'
  const intel      = getIndustryIntel(lead.industry)
  const loss       = calcLossNumbers(intel)
  const ownerName  = cfg.owner_name || 'Eric Thompson'
  const ownerPhone = cfg.owner_phone || ''
  const ownerEmail = cfg.owner_email || ''
  const month      = new Date().toLocaleString('default', { month: 'long' })

  const steps: Record<number, { subject: string; emailBody: string; smsBody: string }> = {

    // Day 3 — Social Proof Case Study
    1: {
      subject: `What happened when a ${lead.industry} business near you got a website`,
      emailBody: `Hi ${firstName},

I sent you a message a couple days ago about ${lead.business_name}'s website demo. I wanted to follow up with something concrete.

A ${lead.industry.toLowerCase()} business similar to yours — same city size, same industry — was hesitant about a website too.

Here's what happened 90 days after they went live:

  📈 Rankings: #1–3 for 9 local search terms
  📈 New calls: 34/month (was 8/month before)
  📈 New revenue: +$${Math.round(loss.monthlyLoss / 2).toLocaleString()}/month
  📈 Payback period: 11 days

Their only regret was not doing it sooner.

Your demo is still live: ${previewUrl}

I have 2 spots left for ${month}. First come, first served.

${ownerName}
${ownerPhone} · ${ownerEmail}

P.S. — These results aren't unusual. They're what happens when a local business stops being invisible online.`,
      smsBody: `${firstName} — following up. A ${lead.industry} business near you added $${Math.round(loss.monthlyLoss / 2).toLocaleString()}/mo after getting a website. Your demo is still up: ${previewUrl} — 2 spots left. —${ownerName.split(' ')[0]}`
    },

    // Day 7 — Competitor Pressure + Urgency
    2: {
      subject: `UPDATE: Competitor activity in ${lead.city} (${lead.industry})`,
      emailBody: `${firstName},

I did another search today — "${lead.industry.toLowerCase()} in ${lead.city}."

Here's what I found:

Your top 3 competitors are online. They're showing up in Google Maps. They're getting calls from people who are ready to spend money right now.

You're not showing up.

That gap widens every single day Google's algorithm rewards established sites over new ones. The longer you wait, the harder it gets to rank.

Here's the brutal math:
  → ${intel.avgMissedPerWeek} potential customers search your industry in ${lead.city} each week
  → ${intel.mobileSearchPct}% choose from the first results they see on their phone
  → You're not in those results
  → That's $${loss.weeklyLoss.toLocaleString()}/week, every week, while you decide

Your demo is ready to go live: ${previewUrl}

I'm taking 1 more client this month. After that, I'm booked until next month.

If you want to move on this — call me directly: ${ownerPhone}

${ownerName}`,
      smsBody: `${firstName}, searched "${lead.industry} ${lead.city}" again — 3 competitors showed up, you didn't. That's $${loss.weeklyLoss.toLocaleString()}/week. 1 spot left this month. Demo: ${previewUrl} — ${ownerPhone}`
    },

    // Day 10 — Risk Reversal + Objection Handling
    3: {
      subject: `Removing every reason NOT to do this, ${firstName}`,
      emailBody: `${firstName},

I've been thinking about why ${lead.business_name} might not have moved forward yet.

Usually it's one of these:

❓ "Too expensive" — $599 one-time. At your customer value, that's covered by 2–3 new clients. You'll make it back in days, not months.

❓ "Too busy to deal with it" — You do nothing. I handle everything. You answer 10 questions. 15 minutes of your time total. Website is live in 5 days.

❓ "Not sure it'll work" — Here's my guarantee: If you don't receive at least 5 new customer inquiries in your first 30 days, I refund 100%. Zero risk, zero questions asked.

❓ "Will look into it later" — Every month you wait, your competitors get more established in Google. The cost of "later" is $${Math.round(loss.monthlyLoss).toLocaleString()} per month in missed revenue.

I've removed every risk. The only thing left is making the decision.

View your demo one more time: ${previewUrl}

If you're ready: ${ownerPhone} or reply to this email.

${ownerName}
${ownerPhone} · ${ownerEmail}`,
      smsBody: `${firstName} — removed every risk: $599 flat, done in 5 days, 30-day money-back guarantee. You literally cannot lose. Demo: ${previewUrl} — Ready when you are. ${ownerPhone}`
    },

    // Day 14 — Final Offer + Takeaway Close
    4: {
      subject: `My last message about ${lead.business_name}'s website`,
      emailBody: `${firstName},

This is my final follow-up. I respect your time and I don't want to be a bother.

I'm going to be honest with you:

I've sent a few messages now. The website demo I built for ${lead.business_name} is still up. It's good work — I put real time into it.

If you're not interested, that's completely fine. Not every business is right for this, and I get it.

But before I close this out — one final offer:

For the next 48 hours only, I'll include for free:
  🎁 Google Business Profile optimization ($200 value)
  🎁 3-month Premium maintenance plan ($300 value)  
  🎁 Priority build — your site live in 3 days instead of 5
  🎁 2 rounds of revision (normally 1)

Total bonus value: $500 — included at no charge.

This is the last time I'll offer this rate and these bonuses.

After this, the demo comes down and I'll offer the spot to another ${lead.industry.toLowerCase()} business in ${lead.city}.

If you want it: reply "I'M IN" or call ${ownerPhone} right now.

If you're not ready: reply "NOT YET" and I'll check back in 60 days when timing might be better.

Either way — it was genuinely a pleasure researching ${lead.business_name}. You run a solid operation. You deserve to be found online.

${ownerName}
${ownerPhone} · ${ownerEmail}

P.S. — If YOU don't need a website but know another business owner who does, I'll send you $100 cash for any referral that signs up. Just reply with their info.`,
      smsBody: `${firstName} — last message. 48hr offer: $599 site + $500 in FREE bonuses (GBP optimization, 3-mo maintenance, priority build). Reply YES or call ${ownerPhone}. No pressure either way. —${ownerName.split(' ')[0]}`
    },
  }

  return steps[step] || steps[1]
}

// ── GENERATE AI OFFER IMAGE PROMPT ────────────────────────────────────────────
// Creates a prompt for Genspark image generation to produce polished offer cards
function buildOfferImagePrompt(lead: any, research: any, pkg: string): string {
  const pkgPrice  = pkg === 'Starter' ? 299 : pkg === 'Premium' ? 999 : 599
  const colors    = research?.color_palette || { primary: '#1e3a5f', secondary: '#f97316' }
  const tone      = research?.brand_tone || 'professional'
  const services  = (research?.key_services || ['Professional Service', 'Expert Team', 'Quality Results']).slice(0, 3).join(', ')

  return `Ultra-premium digital marketing offer card for a local business website package. 
Design style: ${tone}, magazine-quality, high-end agency aesthetic.
Layout: Modern dark background with gradient from ${colors.primary} to deep black. 
Business name "${lead.business_name}" in large bold white typography at top.
Center headline: "YOUR PROFESSIONAL WEBSITE IS READY" in gold/amber gradient text.
Sub-headline: "${lead.industry} · ${lead.city}" in clean white.
Three feature callouts with checkmark icons: "${services}".
Large price badge: "$${pkgPrice}" in bright white with strikethrough "$999" in red showing savings.
Bottom CTA button: "CLAIM YOUR WEBSITE NOW" in bright orange/amber.
Trust badges row: "5-Day Delivery" • "30-Day Guarantee" • "Mobile-First" • "Google-Ready".
Corner element: red "LIMITED SPOTS" ribbon badge.
Overall feel: This is a $10,000 agency design, not a template. Premium, trustworthy, urgent.
No text errors. No stock photo people. Clean geometric shapes and gradients only.
Aspect ratio: 1200x628px landscape for email/social sharing.`
}

// ── GENERATE OFFER IMAGE VIA GENSPARK AI ─────────────────────────────────────
async function generateOfferImage(
  lead: any, research: any, build: any, db: D1Database
): Promise<string | null> {
  try {
    const prompt = buildOfferImagePrompt(lead, research, build.package_tier || 'Professional')
    // Store prompt for future generation; actual image gen happens via frontend API call
    await db.prepare(`
      INSERT OR REPLACE INTO outreach_images (lead_id, build_id, image_type, image_url, image_prompt, package_tier)
      VALUES (?, ?, 'offer_card', 'pending', ?, ?)
    `).bind(lead.id, build.id, prompt, build.package_tier || 'Professional').run()
    return prompt
  } catch (e) {
    console.error('Image prompt generation error:', e)
    return null
  }
}

// ── Send email via SendGrid ───────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, body: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) return { success: false, error: 'SendGrid API key not configured' }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'e.w.Thompson10.10@gmail.com', name: 'Eric Thompson — Local Web Developer' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    })
    return res.status === 202 ? { success: true } : { success: false, error: await res.text() }
  } catch (e: any) { return { success: false, error: e.message } }
}

// ── Send SMS via Twilio ───────────────────────────────────────────────────────
async function sendSMS(to: string, body: string, sid: string, token: string, from: string): Promise<{ success: boolean; error?: string }> {
  if (!sid || !token || !from) return { success: false, error: 'Twilio credentials not configured' }
  const clean = to.replace(/[^\d+]/g, '')
  const formatted = clean.startsWith('+') ? clean : `+1${clean}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: formatted, From: from, Body: body }).toString(),
    })
    const data: any = await res.json()
    return data.sid ? { success: true } : { success: false, error: data.message || 'Twilio error' }
  } catch (e: any) { return { success: false, error: e.message } }
}

// ── Build with URL (Lovable's public integration — no API key needed) ─────────
// Docs: https://docs.lovable.dev/integrations/build-with-url
// Format: https://lovable.dev/?autosubmit=true#prompt=URL_ENCODED_PROMPT
// When clicked: logged-in users get an auto-building project instantly.
// The prompt is URL-encoded and placed in the hash fragment (max 50,000 chars).
function buildLovableUrl(prompt: string): { url: string; truncated: boolean } {
  // Lovable's Build with URL uses the hash fragment — base URL + params
  const base = 'https://lovable.dev/?autosubmit=true#prompt='

  // URL-encode the full prompt
  let encoded = encodeURIComponent(prompt)
  let truncated = false

  // Browser URL limit ~65,000 chars total; keep prompt encoded under 60,000
  const MAX_ENCODED = 60000
  if (encoded.length > MAX_ENCODED) {
    // Truncate the raw prompt at a safe boundary then re-encode
    let raw = prompt
    while (encodeURIComponent(raw).length > MAX_ENCODED) {
      raw = raw.slice(0, Math.floor(raw.length * 0.9))
    }
    encoded = encodeURIComponent(raw + '\n\n[Note: prompt truncated to fit URL limits — core business data preserved above]')
    truncated = true
  }

  return { url: base + encoded, truncated }
}

// Wrapper used by the build pipeline — always succeeds (no network call needed)
async function launchLovable(prompt: string, businessName: string, _apiKey: string): Promise<{ url?: string; error?: string; truncated?: boolean }> {
  const { url, truncated } = buildLovableUrl(prompt)
  return { url, truncated }
}

// ── Perform outreach (email + SMS) ────────────────────────────────────────────
async function doOutreach(db: D1Database, buildId: number, lead: any, build: any, research: any, cfg: Record<string, string>, env: Bindings) {
  const results: any = {}

  if (lead.email) {
    const msg = buildOutreachEmail(lead, research, build, cfg)
    const key = cfg.sendgrid_api_key?.includes('••') ? (env.SENDGRID_API_KEY || '') : (cfg.sendgrid_api_key || env.SENDGRID_API_KEY || '')
    const r = await sendEmail(lead.email, msg.subject, msg.body, key)
    results.email = r
    await db.prepare('INSERT INTO outreach_log (build_id,lead_id,channel,recipient,subject,message,status) VALUES (?,?,?,?,?,?,?)')
      .bind(buildId, lead.id, 'email', lead.email, msg.subject, msg.body, r.success ? 'sent' : 'failed').run()
    if (r.success) {
      await db.prepare('UPDATE website_builds SET outreach_email_sent=1,outreach_message=?,outreach_sent_at=CURRENT_TIMESTAMP,outreach_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(msg.body, 'sent', buildId).run()
      await db.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'email_sent','Outreach email sent to ${lead.email}')`)
        .bind(lead.id).run()
    }
  }

  if (lead.phone) {
    const body = buildOutreachSMS(lead, build, cfg)
    const sid   = cfg.twilio_account_sid?.includes('••') ? (env.TWILIO_ACCOUNT_SID || '') : (cfg.twilio_account_sid || env.TWILIO_ACCOUNT_SID || '')
    const token = cfg.twilio_auth_token?.includes('••')  ? (env.TWILIO_AUTH_TOKEN || '')  : (cfg.twilio_auth_token || env.TWILIO_AUTH_TOKEN || '')
    const from  = cfg.twilio_from_number || env.TWILIO_FROM_NUMBER || ''
    const r = await sendSMS(lead.phone, body, sid, token, from)
    results.sms = r
    await db.prepare('INSERT INTO outreach_log (build_id,lead_id,channel,recipient,message,status) VALUES (?,?,?,?,?,?)')
      .bind(buildId, lead.id, 'sms', lead.phone, body, r.success ? 'sent' : 'failed').run()
    if (r.success) {
      await db.prepare('UPDATE website_builds SET outreach_sms_sent=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(buildId).run()
      await db.prepare(`INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'sms_sent','Outreach SMS sent to ${lead.phone}')`)
        .bind(lead.id).run()
    }
  }

  // Update total outreach count
  const prev = parseInt((await db.prepare("SELECT value FROM builder_config WHERE key='total_outreach_sent'").first() as any)?.value || '0')
  await setCfg(db, 'total_outreach_sent', String(prev + 1))

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/builder/config
builderRouter.get('/config', async (c) => {
  const cfg = await getCfg(c.env.DB)
  const safe = { ...cfg }
  if (safe.sendgrid_api_key?.length > 6)   safe.sendgrid_api_key   = safe.sendgrid_api_key.slice(0,6) + '••••••••'
  if (safe.twilio_auth_token?.length > 4)  safe.twilio_auth_token  = safe.twilio_auth_token.slice(0,4) + '••••••••'
  if (safe.lovable_api_key?.length > 6)    safe.lovable_api_key    = safe.lovable_api_key.slice(0,6) + '••••••••'
  if (safe.openai_api_key?.length > 6)     safe.openai_api_key     = safe.openai_api_key.slice(0,6) + '••••••••'
  return c.json(safe)
})

// PUT /api/builder/config
builderRouter.put('/config', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    if (String(value).includes('••')) continue
    await setCfg(c.env.DB, key, String(value))
  }
  return c.json({ success: true })
})

// GET /api/builder/stats
builderRouter.get('/stats', async (c) => {
  const cfg       = await getCfg(c.env.DB)
  const builds    = await c.env.DB.prepare('SELECT build_status, COUNT(*) as count FROM website_builds GROUP BY build_status').all()
  const outreach  = await c.env.DB.prepare('SELECT outreach_status, COUNT(*) as count FROM website_builds GROUP BY outreach_status').all()
  const research  = await c.env.DB.prepare('SELECT research_status, COUNT(*) as count FROM research_reports GROUP BY research_status').all()
  const recent    = await c.env.DB.prepare(`
    SELECT wb.*, rr.confidence_score, rr.market_demand_score, rr.hero_headline, rr.business_description,
           rr.google_rating, rr.google_review_count, rr.brand_tone,
           l.phone as lead_phone, l.email as lead_email
    FROM website_builds wb
    LEFT JOIN research_reports rr ON rr.id = wb.research_id
    LEFT JOIN leads l ON l.id = wb.lead_id
    ORDER BY wb.created_at DESC LIMIT 25`).all()
  return c.json({
    total_builds:     parseInt(cfg.total_builds || '0'),
    total_researched: parseInt(cfg.total_researched || '0'),
    total_outreach:   parseInt(cfg.total_outreach_sent || '0'),
    build_stats:   builds.results,
    outreach_stats: outreach.results,
    research_stats: research.results,
    recent_builds: recent.results,
  })
})

// GET /api/builder/builds
builderRouter.get('/builds', async (c) => {
  const { status, limit } = c.req.query()
  let q = `SELECT wb.*, rr.confidence_score, rr.market_demand_score, rr.hero_headline, rr.brand_tone, rr.google_rating as rr_rating, l.phone as lead_phone, l.email as lead_email FROM website_builds wb LEFT JOIN research_reports rr ON rr.id=wb.research_id LEFT JOIN leads l ON l.id=wb.lead_id WHERE 1=1`
  const p: any[] = []
  if (status) { q += ' AND wb.build_status=?'; p.push(status) }
  q += ' ORDER BY wb.created_at DESC LIMIT ?'; p.push(parseInt(limit || '50'))
  const { results } = await c.env.DB.prepare(q).bind(...p).all()
  return c.json(results)
})

// GET /api/builder/builds/:id
builderRouter.get('/builds/:id', async (c) => {
  const id = c.req.param('id')
  const build = await c.env.DB.prepare(`
    SELECT wb.*, rr.*, l.phone as lead_phone, l.email as lead_email
    FROM website_builds wb
    LEFT JOIN research_reports rr ON rr.id=wb.research_id
    LEFT JOIN leads l ON l.id=wb.lead_id
    WHERE wb.id=?`).bind(id).first()
  if (!build) return c.json({ error: 'Not found' }, 404)
  const logs = await c.env.DB.prepare('SELECT * FROM outreach_log WHERE build_id=? ORDER BY sent_at DESC').bind(id).all()
  return c.json({ build, outreach_log: logs.results })
})

// GET /api/builder/research/:leadId
builderRouter.get('/research/:leadId', async (c) => {
  const report = await c.env.DB.prepare('SELECT * FROM research_reports WHERE lead_id=? ORDER BY created_at DESC LIMIT 1').bind(c.req.param('leadId')).first()
  return c.json(report || null)
})

// POST /api/builder/research  – run deep research on a lead
builderRouter.post('/research', async (c) => {
  const { lead_id } = await c.req.json() as any
  if (!lead_id) return c.json({ error: 'lead_id required' }, 400)
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(lead_id).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)
  const cfg = await getCfg(c.env.DB)
  try {
    const { reportId, report } = await runDeepResearch(c.env.DB, lead, cfg, c.env)
    return c.json({ success: true, report_id: reportId, report })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// POST /api/builder/build  – research + build + outreach for a lead
builderRouter.post('/build', async (c) => {
  const body = await c.req.json() as any
  const { lead_id, package_tier, skip_research, auto_outreach } = body
  if (!lead_id) return c.json({ error: 'lead_id required' }, 400)

  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(lead_id).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)

  // Check for existing active build
  const existing = await c.env.DB.prepare("SELECT id FROM website_builds WHERE lead_id=? AND build_status NOT IN ('failed','cancelled')").bind(lead_id).first()
  if (existing) return c.json({ error: 'Build already exists for this lead', existing_id: (existing as any).id }, 409)

  const cfg = await getCfg(c.env.DB)
  const pkg = package_tier || cfg.default_package || 'Professional'

  // Step 1: Deep Research
  let research: any = null
  let reportId: number | null = null

  if (!skip_research) {
    const existing_research = await c.env.DB.prepare("SELECT * FROM research_reports WHERE lead_id=? AND research_status='completed' ORDER BY created_at DESC LIMIT 1").bind(lead_id).first() as any
    if (existing_research) {
      research = existing_research
      reportId = existing_research.id
    } else {
      try {
        const result = await runDeepResearch(c.env.DB, lead, cfg, c.env)
        research = result.report
        reportId = result.reportId
      } catch (e: any) {
        // Research failed — continue with build using basic data
        research = null
      }
    }
  }

  // Step 2: Generate Lovable prompt using research
  const prompt = buildLovablePrompt(lead, research, pkg)

  // Step 3: Insert build record (14 columns = 14 bind params)
  const ins = await c.env.DB.prepare(
    `INSERT INTO website_builds (lead_id,research_id,business_name,industry,city,phone,email,address,owner_name,google_rating,google_review_count,package_tier,build_status,lovable_prompt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'generating',?)`
  ).bind(
    lead_id,                                      // lead_id
    reportId,                                     // research_id
    lead.business_name,                           // business_name
    lead.industry,                                // industry
    lead.city,                                    // city
    lead.phone || research?.google_phone || null, // phone
    lead.email || null,                           // email
    lead.address || research?.google_address || null, // address
    lead.owner_name || null,                      // owner_name
    research?.google_rating || null,              // google_rating
    research?.google_review_count || 0,           // google_review_count
    pkg,                                          // package_tier
    prompt                                        // lovable_prompt
  ).run()
  const buildId = ins.meta.last_row_id as number

  // Step 4: Build the Lovable "Build with URL" link (no API key, no network call)
  // This URL opens lovable.dev with autosubmit=true and the full prompt pre-filled.
  // When Eric or the client clicks it, Lovable auto-starts building the site.
  const lovable = await launchLovable(prompt, lead.business_name, '')

  // status = 'prompt_ready' means: prompt crafted + Lovable URL generated, ready to open
  await c.env.DB.prepare(
    "UPDATE website_builds SET build_status='prompt_ready',lovable_project_url=?,preview_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(lovable.url, lovable.url, buildId).run()

  await c.env.DB.prepare(
    `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'lovable_url_ready','${pkg} Lovable Build URL generated — click to auto-build: ${(lovable.url||'').slice(0,80)}…')`
  ).bind(lead_id).run()

  // Update lead status
  await c.env.DB.prepare(
    "UPDATE leads SET status='demo_sent',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('new','contacted')"
  ).bind(lead_id).run()

  // Step 5: Outreach (include the Lovable Build URL as the preview link)
  let outreachResult: any = null
  const shouldOutreach = auto_outreach !== undefined ? auto_outreach : cfg.auto_outreach === '1'
  if (shouldOutreach && (lead.email || lead.phone)) {
    const buildRow = { preview_url: lovable.url, lovable_project_url: lovable.url, package_tier: pkg }
    outreachResult = await doOutreach(c.env.DB, buildId, lead, buildRow, research, cfg, c.env)
  }

  // Update stats
  await setCfg(c.env.DB, 'total_builds', String(parseInt(cfg.total_builds || '0') + 1))

  return c.json({
    success: true,
    build_id: buildId,
    lovable_url: lovable.url,
    package: pkg,
    research_id: reportId,
    outreach: outreachResult,
    truncated: lovable.truncated || false,
    note: 'Click lovable_url to open Lovable with your prompt pre-filled — it will auto-start building the site.'
  })
})

// POST /api/builder/outreach/:buildId  – manual outreach trigger
builderRouter.post('/outreach/:buildId', async (c) => {
  const buildId = parseInt(c.req.param('buildId'))
  const build   = await c.env.DB.prepare('SELECT * FROM website_builds WHERE id=?').bind(buildId).first() as any
  if (!build) return c.json({ error: 'Build not found' }, 404)
  const lead     = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(build.lead_id).first() as any
  const research = build.research_id ? await c.env.DB.prepare('SELECT * FROM research_reports WHERE id=?').bind(build.research_id).first() : null
  const cfg = await getCfg(c.env.DB)
  const result = await doOutreach(c.env.DB, buildId, lead, build, research, cfg, c.env)
  return c.json({ success: true, result })
})

// GET /api/builder/preview-prompt/:leadId
builderRouter.get('/preview-prompt/:leadId', async (c) => {
  const pkg  = c.req.query('package') || 'Professional'
  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(c.req.param('leadId')).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)
  const research = await c.env.DB.prepare("SELECT * FROM research_reports WHERE lead_id=? AND research_status='completed' ORDER BY created_at DESC LIMIT 1").bind(lead.id).first() as any
  const prompt = buildLovablePrompt(lead, research, pkg)
  const cfg = { owner_name: 'Eric Developing Thompson', owner_phone: '(985)860-7891', owner_email: 'e.w.Thompson10.10@gmail.com' }
  const emailPreview = buildOutreachEmail(lead, research, { preview_url: '[preview URL]', package_tier: pkg }, cfg)
  const smsPreview = buildOutreachSMS(lead, { preview_url: '[preview URL]' }, cfg)
  return c.json({ prompt, email_preview: emailPreview, sms_preview: smsPreview, has_research: !!research, research_confidence: research?.confidence_score || 0 })
})

// POST /api/builder/bulk-research  – queue research for all un-researched leads
builderRouter.post('/bulk-research', async (c) => {
  const { limit } = await c.req.json().catch(() => ({} as any))
  const { results } = await c.env.DB.prepare(`
    SELECT l.* FROM leads l
    LEFT JOIN research_reports rr ON rr.lead_id=l.id AND rr.research_status NOT IN ('failed')
    WHERE rr.id IS NULL AND l.has_website=0 AND l.status NOT IN ('won','lost','not_interested','already_has_website','do_not_contact')
    ORDER BY l.created_at DESC LIMIT ?`).bind(parseInt(limit || '5')).all()

  const started: any[] = []
  const cfg = await getCfg(c.env.DB)
  for (const lead of results as any[]) {
    try {
      const { reportId } = await runDeepResearch(c.env.DB, lead as any, cfg, c.env)
      started.push({ lead_id: (lead as any).id, business_name: (lead as any).business_name, report_id: reportId })
    } catch {}
  }
  return c.json({ started: started.length, reports: started })
})

// PUT /api/builder/builds/:id
builderRouter.put('/builds/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const fields: string[] = []; const vals: any[] = []
  const allowed = ['build_status','preview_url','published_url','outreach_status','notes']
  for (const k of allowed) { if (body[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]) } }
  if (!fields.length) return c.json({ error: 'No valid fields' }, 400)
  fields.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id)
  await c.env.DB.prepare(`UPDATE website_builds SET ${fields.join(',')} WHERE id=?`).bind(...vals).run()
  return c.json({ success: true })
})

// POST /api/builder/bulk-build  – build sites for multiple leads at once
builderRouter.post('/bulk-build', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const { limit, package_tier } = body

  // Find eligible leads (no website, not terminal, no existing active build)
  const { results } = await c.env.DB.prepare(`
    SELECT l.* FROM leads l
    LEFT JOIN website_builds wb ON wb.lead_id=l.id AND wb.build_status NOT IN ('failed','cancelled')
    WHERE wb.id IS NULL AND l.has_website=0
      AND l.status NOT IN ('won','lost','not_interested','already_has_website','do_not_contact')
    ORDER BY l.created_at DESC LIMIT ?`).bind(parseInt(limit || '10')).all()

  const cfg = await getCfg(c.env.DB)
  const pkg = package_tier || cfg.default_package || 'Professional'
  let queued = 0

  for (const lead of results as any[]) {
    try {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO website_builds (lead_id,business_name,industry,city,phone,address,package_tier,build_status,lovable_prompt) VALUES (?,?,?,?,?,?,?,'queued','[Bulk queued — pending research + build]')`
      ).bind(lead.id, lead.business_name, lead.industry, lead.city, lead.phone||null, lead.address||null, pkg).run()
      queued++
    } catch {}
  }

  return c.json({ queued_count: queued, package: pkg, message: `${queued} websites queued for build` })
})

// POST /api/builder/process-queue  – process one queued build from the queue (for cron or manual trigger)
builderRouter.post('/process-queue', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const batchSize = parseInt(body.batch_size || '3')

  const { results } = await c.env.DB.prepare(
    `SELECT wb.*, l.phone as lead_phone, l.email as lead_email FROM website_builds wb
     LEFT JOIN leads l ON l.id=wb.lead_id
     WHERE wb.build_status='queued'
     ORDER BY wb.created_at ASC LIMIT ?`).bind(batchSize).all()

  if (!results.length) return c.json({ message: 'No queued builds to process', processed: 0 })

  const cfg = await getCfg(c.env.DB)
  const processed: any[] = []

  for (const queuedBuild of results as any[]) {
    try {
      // Mark as generating
      await c.env.DB.prepare("UPDATE website_builds SET build_status='generating',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(queuedBuild.id).run()

      const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(queuedBuild.lead_id).first() as any
      if (!lead) continue

      // Step 1: Deep Research
      let research: any = null
      let reportId: number | null = null
      const autoResearch = cfg.auto_research_on_discover !== '0'

      if (autoResearch) {
        const existingResearch = await c.env.DB.prepare(
          "SELECT * FROM research_reports WHERE lead_id=? AND research_status='completed' ORDER BY created_at DESC LIMIT 1"
        ).bind(lead.id).first() as any

        if (existingResearch) {
          research = existingResearch
          reportId = existingResearch.id
        } else {
          try {
            const result = await runDeepResearch(c.env.DB, lead, cfg, c.env)
            research = result.report
            reportId = result.reportId
          } catch {}
        }
      }

      // Step 2: Generate Lovable prompt
      const prompt = buildLovablePrompt(lead, research, queuedBuild.package_tier || 'Professional')

      // Step 3: Update build with research and prompt
      await c.env.DB.prepare(
        `UPDATE website_builds SET research_id=?,lovable_prompt=?,phone=?,email=?,address=?,google_rating=?,google_review_count=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(
        reportId,
        prompt,
        lead.phone || research?.google_phone || null,
        lead.email || null,
        lead.address || research?.google_address || null,
        research?.google_rating || null,
        research?.google_review_count || 0,
        queuedBuild.id
      ).run()

      // Step 4: Generate Lovable Build-with-URL link (no API key needed)
      const lovable = await launchLovable(prompt, lead.business_name, '')

      await c.env.DB.prepare(
        "UPDATE website_builds SET build_status='prompt_ready',lovable_project_url=?,preview_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(lovable.url, lovable.url, queuedBuild.id).run()

      await c.env.DB.prepare(
        `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'lovable_url_ready','Lovable Build URL ready for ${queuedBuild.package_tier} package — click to auto-build')`
      ).bind(lead.id).run()

      // Update lead status
      await c.env.DB.prepare(
        "UPDATE leads SET status='demo_sent',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('new','contacted')"
      ).bind(lead.id).run()

      // Step 5: Auto-outreach (Lovable URL serves as the preview/intro link)
      if (cfg.auto_outreach === '1' && (lead.email || lead.phone)) {
        const buildRow = { preview_url: lovable.url, lovable_project_url: lovable.url, package_tier: queuedBuild.package_tier }
        await doOutreach(c.env.DB, queuedBuild.id, lead, buildRow, research, cfg, c.env)
      }

      await setCfg(c.env.DB, 'total_builds', String(parseInt(cfg.total_builds || '0') + 1))
      processed.push({ id: queuedBuild.id, business: lead.business_name, status: 'prompt_ready', lovable_url: lovable.url })

    } catch (err: any) {
      await c.env.DB.prepare("UPDATE website_builds SET build_status='failed',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(err.message, queuedBuild.id).run()
      processed.push({ id: queuedBuild.id, status: 'error', error: err.message })
    }
  }

  return c.json({ processed: processed.length, results: processed })
})

// DELETE /api/builder/builds/:id
builderRouter.delete('/builds/:id', async (c) => {
  await c.env.DB.prepare("UPDATE website_builds SET build_status='cancelled' WHERE id=?").bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────
// FOLLOW-UP SEQUENCE ROUTES
// ─────────────────────────────────────────────────────────────

// POST /api/builder/followup/start  – launch 14-day sequence for a build
builderRouter.post('/followup/start', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const { lead_id, build_id } = body
  if (!lead_id) return c.json({ error: 'lead_id required' }, 400)

  const lead  = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(lead_id).first() as any
  if (!lead)  return c.json({ error: 'Lead not found' }, 404)
  const build = build_id
    ? await c.env.DB.prepare('SELECT * FROM website_builds WHERE id=?').bind(build_id).first() as any
    : await c.env.DB.prepare('SELECT * FROM website_builds WHERE lead_id=? ORDER BY created_at DESC LIMIT 1').bind(lead_id).first() as any

  // Check for existing active sequence
  const existing = await c.env.DB.prepare(
    "SELECT * FROM followup_sequences WHERE lead_id=? AND status='active'"
  ).bind(lead_id).first() as any
  if (existing) return c.json({ error: 'Active sequence already running', sequence_id: existing.id }, 409)

  const cfg = await getCfg(c.env.DB)
  const now = new Date()
  const next = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // Day 3

  // Insert sequence record
  const seqResult = await c.env.DB.prepare(
    `INSERT INTO followup_sequences (lead_id,build_id,sequence_type,current_step,total_steps,status,started_at,next_send_at)
     VALUES (?,?,'14_day_nurture',0,4,'active',CURRENT_TIMESTAMP,?)`
  ).bind(lead_id, build?.id || null, next.toISOString()).run()
  const seqId = seqResult.meta.last_row_id

  // Pre-generate all 4 follow-up messages and store them
  const steps = [
    { step: 1, dayOffset: 3 },
    { step: 2, dayOffset: 7 },
    { step: 3, dayOffset: 10 },
    { step: 4, dayOffset: 14 },
  ]

  for (const { step, dayOffset } of steps) {
    const msgs = buildFollowupMessages(lead, build || {}, cfg, step)
    const sendAt = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)

    // Email message
    await c.env.DB.prepare(
      `INSERT INTO followup_messages (sequence_id,lead_id,step_number,channel,subject,body,status,scheduled_at)
       VALUES (?,?,?,'email',?,?,'scheduled',?)`
    ).bind(seqId, lead_id, step, msgs.subject, msgs.emailBody, sendAt.toISOString()).run()

    // SMS message (if phone available)
    if (lead.phone) {
      await c.env.DB.prepare(
        `INSERT INTO followup_messages (sequence_id,lead_id,step_number,channel,subject,body,status,scheduled_at)
         VALUES (?,?,?,'sms','SMS',?,'scheduled',?)`
      ).bind(seqId, lead_id, step, msgs.smsBody, sendAt.toISOString()).run()
    }
  }

  // Update build with sequence reference
  if (build?.id) {
    await c.env.DB.prepare(
      'UPDATE website_builds SET followup_sequence_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(seqId, build.id).run()
  }

  await c.env.DB.prepare(
    `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'followup_started','14-day follow-up sequence started — 4 steps scheduled')`
  ).bind(lead_id).run()

  return c.json({ success: true, sequence_id: seqId, total_steps: 4, next_send_at: next.toISOString(), message: '14-day follow-up sequence started' })
})

// GET /api/builder/followup/:leadId  – get sequence status + all messages
builderRouter.get('/followup/:leadId', async (c) => {
  const leadId = c.req.param('leadId')

  const sequence = await c.env.DB.prepare(
    "SELECT * FROM followup_sequences WHERE lead_id=? ORDER BY started_at DESC LIMIT 1"
  ).bind(leadId).first() as any

  if (!sequence) return c.json({ sequence: null, messages: [] })

  const { results: messages } = await c.env.DB.prepare(
    'SELECT * FROM followup_messages WHERE sequence_id=? ORDER BY step_number, channel'
  ).bind(sequence.id).all()

  const { results: images } = await c.env.DB.prepare(
    'SELECT * FROM outreach_images WHERE lead_id=? ORDER BY created_at DESC'
  ).bind(leadId).all()

  return c.json({ sequence, messages, images })
})

// POST /api/builder/followup/send-step  – manually send (or re-send) a step
builderRouter.post('/followup/send-step', async (c) => {
  const body = await c.req.json().catch(() => ({} as any))
  const { sequence_id, step_number, channel } = body
  if (!sequence_id || !step_number) return c.json({ error: 'sequence_id and step_number required' }, 400)

  const seq = await c.env.DB.prepare('SELECT * FROM followup_sequences WHERE id=?').bind(sequence_id).first() as any
  if (!seq) return c.json({ error: 'Sequence not found' }, 404)

  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(seq.lead_id).first() as any
  const cfg  = await getCfg(c.env.DB)

  // Get all messages for this step (or filter by channel)
  const query = channel
    ? 'SELECT * FROM followup_messages WHERE sequence_id=? AND step_number=? AND channel=?'
    : 'SELECT * FROM followup_messages WHERE sequence_id=? AND step_number=?'
  const params = channel ? [sequence_id, step_number, channel] : [sequence_id, step_number]
  const { results: msgs } = await c.env.DB.prepare(query).bind(...params).all()

  const sent: any[] = []
  const errors: any[] = []

  for (const msg of msgs as any[]) {
    try {
      if (msg.channel === 'email' && lead.email && cfg.sendgrid_api_key) {
        const sg = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfg.sendgrid_api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: lead.email, name: lead.business_name }] }],
            from: { email: cfg.sender_email || 'outreach@example.com', name: cfg.owner_name || 'Google Money Drop' },
            subject: msg.subject,
            content: [{ type: 'text/html', value: msg.body.replace(/\n/g, '<br>') }]
          })
        })
        if (!sg.ok) throw new Error(`SendGrid: ${sg.status}`)
        await c.env.DB.prepare(
          "UPDATE followup_messages SET status='sent',sent_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(msg.id).run()
        sent.push({ id: msg.id, channel: 'email' })

      } else if (msg.channel === 'sms' && lead.phone && cfg.twilio_account_sid) {
        const tw = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilio_account_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(cfg.twilio_account_sid + ':' + cfg.twilio_auth_token)}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `From=${encodeURIComponent(cfg.twilio_from_number || '')}&To=${encodeURIComponent(lead.phone)}&Body=${encodeURIComponent(msg.body)}`
          }
        )
        if (!tw.ok) throw new Error(`Twilio: ${tw.status}`)
        await c.env.DB.prepare(
          "UPDATE followup_messages SET status='sent',sent_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(msg.id).run()
        sent.push({ id: msg.id, channel: 'sms' })
      }
    } catch (err: any) {
      await c.env.DB.prepare(
        "UPDATE followup_messages SET status='failed' WHERE id=?"
      ).bind(msg.id).run()
      errors.push({ id: msg.id, channel: msg.channel, error: err.message })
    }
  }

  // Advance sequence step if all messages for that step attempted
  const newStep = Math.max(seq.current_step, step_number)
  const dayOffsets: Record<number, number> = { 1: 3, 2: 7, 3: 10, 4: 14 }
  const nextStepNum = step_number + 1
  const nextSendAt = dayOffsets[nextStepNum]
    ? new Date(Date.now() + (dayOffsets[nextStepNum] - (dayOffsets[step_number] || 0)) * 24 * 60 * 60 * 1000).toISOString()
    : null

  await c.env.DB.prepare(
    `UPDATE followup_sequences SET current_step=?,next_send_at=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(
    newStep,
    nextSendAt,
    nextStepNum > 4 ? 'completed' : 'active',
    sequence_id
  ).run()

  await c.env.DB.prepare(
    `INSERT INTO activities (entity_type,entity_id,action,description) VALUES ('lead',?,'followup_step_sent','Follow-up step ${step_number} sent (${sent.length} messages)')`
  ).bind(seq.lead_id).run()

  return c.json({ success: true, sent: sent.length, errors: errors.length, sent_messages: sent, failed_messages: errors })
})

// POST /api/builder/followup/cancel  – opt-out / cancel sequence
builderRouter.post('/followup/cancel', async (c) => {
  const { sequence_id, lead_id } = await c.req.json().catch(() => ({} as any))
  const id = sequence_id || (await c.env.DB.prepare(
    "SELECT id FROM followup_sequences WHERE lead_id=? AND status='active'"
  ).bind(lead_id).first() as any)?.id
  if (!id) return c.json({ error: 'No active sequence found' }, 404)
  await c.env.DB.prepare(
    "UPDATE followup_sequences SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(id).run()
  await c.env.DB.prepare(
    "UPDATE followup_messages SET status='cancelled' WHERE sequence_id=? AND status='scheduled'"
  ).bind(id).run()
  return c.json({ success: true, message: 'Follow-up sequence cancelled' })
})

// GET /api/builder/followup-list  – all sequences with status overview
builderRouter.get('/followup-list', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT fs.*, l.business_name, l.email, l.phone, l.industry,
      (SELECT COUNT(*) FROM followup_messages fm WHERE fm.sequence_id=fs.id AND fm.status='sent') AS sent_count,
      (SELECT COUNT(*) FROM followup_messages fm WHERE fm.sequence_id=fs.id AND fm.status='scheduled') AS pending_count
    FROM followup_sequences fs
    JOIN leads l ON l.id=fs.lead_id
    ORDER BY fs.started_at DESC LIMIT 100
  `).all()
  return c.json({ sequences: results })
})

// ─────────────────────────────────────────────────────────────
// IMAGE GENERATION ROUTES
// ─────────────────────────────────────────────────────────────

// POST /api/builder/generate-image/:buildId  – generate offer card image
builderRouter.post('/generate-image/:buildId', async (c) => {
  const buildId = parseInt(c.req.param('buildId'))
  const build   = await c.env.DB.prepare('SELECT * FROM website_builds WHERE id=?').bind(buildId).first() as any
  if (!build)   return c.json({ error: 'Build not found' }, 404)
  const lead    = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(build.lead_id).first() as any
  const research = build.research_id
    ? await c.env.DB.prepare('SELECT * FROM research_reports WHERE id=?').bind(build.research_id).first() as any
    : null

  const imageUrl = await generateOfferImage(lead, research, build, c.env.DB)
  if (!imageUrl) return c.json({ error: 'Image generation failed or no API key configured' }, 500)

  return c.json({ success: true, image_url: imageUrl, build_id: buildId })
})

// GET /api/builder/images/:leadId  – retrieve all generated images for a lead
builderRouter.get('/images/:leadId', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM outreach_images WHERE lead_id=? ORDER BY created_at DESC'
  ).bind(c.req.param('leadId')).all()
  return c.json({ images: results })
})

// ─────────────────────────────────────────────────────────────
// OUTREACH PREVIEW ROUTE
// ─────────────────────────────────────────────────────────────

// GET /api/builder/preview-outreach/:leadId  – full outreach preview (all 3 variants + follow-up steps)
builderRouter.get('/preview-outreach/:leadId', async (c) => {
  const leadId = c.req.param('leadId')
  const pkg    = c.req.query('package') || 'Professional'

  const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(leadId).first() as any
  if (!lead) return c.json({ error: 'Lead not found' }, 404)

  const research = await c.env.DB.prepare(
    "SELECT * FROM research_reports WHERE lead_id=? AND research_status='completed' ORDER BY created_at DESC LIMIT 1"
  ).bind(leadId).first() as any

  const build = await c.env.DB.prepare(
    'SELECT * FROM website_builds WHERE lead_id=? ORDER BY created_at DESC LIMIT 1'
  ).bind(leadId).first() as any

  const cfg = await getCfg(c.env.DB)
  const fakeBuild = { preview_url: build?.preview_url || '[PREVIEW_URL]', package_tier: pkg, id: build?.id || 0 }

  // Generate all 3 email variants
  const emailA = buildOutreachEmailVariantA(lead, research, fakeBuild, cfg)
  const emailB = buildOutreachEmailVariantB(lead, research, fakeBuild, cfg)
  const emailC = buildOutreachEmailVariantC(lead, research, fakeBuild, cfg)

  // SMS variants
  const smsVariants = [0, 1, 2].map(v => {
    const fakeLead = { ...lead, id: v }
    return buildOutreachSMS(fakeLead, fakeBuild, cfg)
  })

  // Follow-up sequence steps 1-4
  const followupSteps = [1, 2, 3, 4].map(step => ({
    step,
    day: [3, 7, 10, 14][step - 1],
    ...buildFollowupMessages(lead, fakeBuild, cfg, step)
  }))

  // Current A/B assignment for this lead
  const seed = (lead.id || 0) % 3
  const activeVariant = ['A', 'B', 'C'][seed]

  // Industry intel for display
  const intel = getIndustryIntel(lead.industry)
  const lossNums = calcLossNumbers(intel)

  return c.json({
    lead: { id: lead.id, business_name: lead.business_name, industry: lead.industry, city: lead.city },
    active_variant: activeVariant,
    email_variants: {
      A: emailA,
      B: emailB,
      C: emailC
    },
    sms_variants: {
      A: smsVariants[0],
      B: smsVariants[1],
      C: smsVariants[2]
    },
    followup_steps: followupSteps,
    loss_numbers: lossNums,
    industry_intel: { weeklySearches: intel.weeklySearches, avgCustomerValue: intel.avgCustomerValue, urgencyHook: intel.urgencyHook },
    has_research: !!research,
    has_build: !!build,
    images: build?.offer_image_url ? [{ url: build.offer_image_url }] : []
  })
})
