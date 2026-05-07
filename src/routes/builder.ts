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

// ── Outreach message generator ────────────────────────────────────────────────
function buildOutreachEmail(lead: any, research: any, build: any, cfg: Record<string, string>): { subject: string; body: string } {
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : 'there'
  const previewUrl = build.preview_url || build.lovable_project_url || '[preview link]'
  const stars = research?.google_rating ? `${research.google_rating}-star rated ` : ''
  const reviews = research?.google_review_count > 0 ? ` by ${research.google_review_count} customers` : ''
  const pkg = build.package_tier || 'Professional'
  const painPoint = research?.pain_points || `Without a website, ${lead.business_name} is invisible to the 97% of customers who search online first.`

  const subject = `I built a free website for ${lead.business_name} — take a look 🚀`

  const body = `Hi ${firstName},

My name is Eric Thompson, and I'm a local web developer based right here in the ${lead.city} area.

I was researching ${lead.industry.toLowerCase()} businesses nearby and noticed that ${lead.business_name} doesn't have a website yet. I want to change that — so I went ahead and built you a FREE demo site to show you exactly what your online presence could look like.

👉 YOUR FREE WEBSITE DEMO:
${previewUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY I BUILT THIS FOR YOU
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${painPoint}

${stars}${lead.business_name}${reviews} deserves to be found online. Your competitors already have websites — this is your chance to stand out.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S IN YOUR DEMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Custom design built specifically for ${lead.business_name}
✅ Your real services, phone number & address
✅ Click-to-call button (customers call you directly)
✅ Google Maps showing your exact location
✅ Mobile-friendly — perfect on every phone
✅ Professional copywriting tailored to ${lead.industry}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVESTMENT OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 Basic       $500–$800    5-page professional site
🔸 Professional $1,200–$2,000  Full-featured + SEO + blog
💎 Premium     $2,500–$3,500  Complete platform: booking, members, e-commerce, ongoing SEO

Every package includes: domain, hosting, SSL, 30 days free support.
Optional maintenance from just $50/mo to keep everything updated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT STEP
━━━━━━━━━━━━━━━━━━━━━━━━━━━
View the demo. If you like it, let's hop on a quick 10-minute call and I'll answer any questions. No pressure, no obligation — just a free website I made specifically for ${lead.business_name}.

📞 Call/Text: ${cfg.owner_phone}
📧 Email: ${cfg.owner_email}

Looking forward to hearing from you,

Eric Developing Thompson
Local Web Developer · ${lead.city} Area
📞 ${cfg.owner_phone}
📧 ${cfg.owner_email}

P.S. I built this demo using real information about ${lead.business_name}. Even if you're not ready right now, I'd love your feedback — it took real time and care to create just for you.`

  return { subject, body }
}

function buildOutreachSMS(lead: any, build: any, cfg: Record<string, string>): string {
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : 'there'
  const previewUrl = build.preview_url || build.lovable_project_url || '[link]'
  return `Hi ${firstName}! I'm Eric Thompson, a local web developer. I built a FREE website demo for ${lead.business_name}: ${previewUrl}

Includes mobile design, click-to-call, Google Maps & more. Packages from $500.

Interested? Call/text: ${cfg.owner_phone} — no pressure!`
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
