// Payment Routes - Stripe Integration
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  DB: D1Database
  STRIPE_SECRET_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Package pricing configuration
const PACKAGE_PRICING = {
  'Starter': { price: 299, description: '8-page professional website with AI-generated content' },
  'Professional': { price: 599, description: '12-page premium website with advanced features' },
  'Premium': { price: 999, description: 'Full-featured website with monthly maintenance', recurring: 99 }
}

// Get Stripe configuration from builder_config
async function getStripeConfig(db: D1Database) {
  const configs = await db.prepare(`
    SELECT key, value FROM builder_config 
    WHERE key IN ('stripe_secret_key', 'stripe_publishable_key', 'stripe_webhook_secret',
                  'stripe_starter_link', 'stripe_professional_link', 'stripe_premium_link')
  `).all()

  const config: Record<string, string> = {}
  configs.results.forEach((row: any) => {
    config[row.key] = row.value
  })
  return config
}

// Create Stripe Payment Link (manual configuration)
app.post('/create-payment-link', async (c) => {
  try {
    const { proposal_id, package_tier, amount } = await c.req.json()

    // Get Stripe payment links from config
    const config = await getStripeConfig(c.env.DB)
    
    const linkKey = `stripe_${package_tier.toLowerCase()}_link`
    const paymentLink = config[linkKey]

    if (!paymentLink) {
      return c.json({ 
        error: 'Payment link not configured',
        message: 'Please configure Stripe payment links in Settings → Builder → Stripe Configuration'
      }, 400)
    }

    // Update proposal with payment link
    await c.env.DB.prepare(`
      UPDATE proposals 
      SET stripe_payment_link = ?, payment_status = 'awaiting_payment', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(paymentLink, proposal_id).run()

    return c.json({
      success: true,
      payment_link: paymentLink,
      amount,
      package_tier
    })
  } catch (error: any) {
    console.error('Create payment link error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Get payment link for proposal
app.get('/proposal/:id/payment-link', async (c) => {
  try {
    const proposalId = c.req.param('id')

    const proposal = await c.env.DB.prepare(`
      SELECT p.*, l.business_name, l.email, l.phone
      FROM proposals p
      LEFT JOIN leads l ON p.lead_id = l.id
      WHERE p.id = ?
    `).bind(proposalId).first()

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404)
    }

    // Get Stripe payment link from config
    const config = await getStripeConfig(c.env.DB)
    const linkKey = `stripe_${proposal.package_tier.toLowerCase()}_link`
    const paymentLink = config[linkKey]

    if (!paymentLink) {
      return c.json({
        error: 'Payment link not configured',
        message: 'Please add Stripe payment links in Settings'
      }, 400)
    }

    return c.json({
      payment_link: paymentLink,
      amount: proposal.package_price,
      package_tier: proposal.package_tier,
      business_name: proposal.business_name,
      proposal_id: proposalId
    })
  } catch (error: any) {
    console.error('Get payment link error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Mark payment as completed (webhook or manual)
app.post('/mark-paid', async (c) => {
  try {
    const { proposal_id, stripe_payment_id, amount_paid } = await c.req.json()

    // Update proposal
    await c.env.DB.prepare(`
      UPDATE proposals 
      SET status = 'accepted', 
          payment_status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(proposal_id).run()

    // Get proposal details
    const proposal = await c.env.DB.prepare(
      'SELECT * FROM proposals WHERE id = ?'
    ).bind(proposal_id).first()

    if (proposal) {
      // Update lead status to won
      await c.env.DB.prepare(`
        UPDATE leads 
        SET status = 'won', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(proposal.lead_id).run()

      // Create client record if not exists
      const existingClient = await c.env.DB.prepare(
        'SELECT id FROM clients WHERE lead_id = ?'
      ).bind(proposal.lead_id).first()

      if (!existingClient) {
        await c.env.DB.prepare(`
          INSERT INTO clients (
            business_name, contact_name, email, phone, address,
            package_tier, package_price, recurring_fee, status, lead_id
          )
          SELECT 
            business_name, owner_name, email, phone, address,
            ?, ?, 0, 'active', id
          FROM leads WHERE id = ?
        `).bind(
          proposal.package_tier,
          proposal.package_price,
          proposal.lead_id
        ).run()
      }

      // Create invoice record
      await c.env.DB.prepare(`
        INSERT INTO invoices (
          lead_id, proposal_id, amount, status, description, 
          stripe_payment_intent_id, paid_at
        ) VALUES (?, ?, ?, 'paid', ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        proposal.lead_id,
        proposal_id,
        amount_paid || proposal.package_price,
        `${proposal.package_tier} Website Package`,
        stripe_payment_id || ''
      ).run()
    }

    return c.json({ success: true, message: 'Payment marked as completed' })
  } catch (error: any) {
    console.error('Mark paid error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Get all invoices
app.get('/invoices', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        i.*,
        l.business_name,
        l.email,
        l.phone,
        c.business_name as client_name
      FROM invoices i
      LEFT JOIN leads l ON i.lead_id = l.id
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `).all()

    return c.json(result.results)
  } catch (error: any) {
    console.error('Get invoices error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Stripe webhook endpoint (for future full integration)
app.post('/webhook/stripe', async (c) => {
  try {
    const body = await c.req.text()
    const sig = c.req.header('stripe-signature')

    // Log webhook for now (full verification requires stripe SDK)
    console.log('Stripe webhook received:', {
      signature: sig,
      body: body.substring(0, 100)
    })

    // Parse the event
    const event = JSON.parse(body)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        console.log('Payment completed:', session.id)
        
        // Here you would update the proposal/invoice based on metadata
        // For now, this is a placeholder
        break

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        console.log('Payment intent succeeded:', paymentIntent.id)
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return c.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default app
