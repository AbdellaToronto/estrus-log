import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createServerClient, configFromEnv } from '@/lib/supabase'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', { status: 400 })
  }

  const eventType = evt.type
  
  // Use service role key to bypass RLS for admin actions
  const supabase = createServerClient({
    ...configFromEnv(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  console.log(`[Webhook] Processing event: ${eventType}`)

  // =========================================================================
  // USER EVENTS
  // =========================================================================
  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data
    const email = email_addresses[0]?.email_address
    const fullName = `${first_name || ''} ${last_name || ''}`.trim()

    const { error } = await supabase
      .from('users')
      .upsert({
        id,
        email,
        full_name: fullName,
        avatar_url: image_url,
      })

    if (error) {
      console.error('Error upserting user:', error)
      return new Response('Error upserting user', { status: 500 })
    }
  } 
  
  else if (eventType === 'user.deleted') {
    const { id } = evt.data
    
    // Note: We're not deleting user data (cohorts, mice, logs) here intentionally
    // The user record will be deleted but their research data remains
    // (associated with their org still)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id!)

    if (error) {
      console.error('Error deleting user:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  // =========================================================================
  // ORGANIZATION EVENTS
  // =========================================================================
  else if (eventType === 'organization.created') {
    const { id, name, slug, image_url, created_by } = evt.data
    
    // Create organization profile (might already exist if user created via UI)
    const { error } = await supabase
      .from('organization_profiles')
      .upsert({
        clerk_org_id: id,
        department: name, // Use org name as department/lab name
        is_discoverable: false, // Default to private, user can make discoverable later
        logo_url: image_url,
      }, {
        onConflict: 'clerk_org_id'
      })

    if (error) {
      console.error('Error creating organization profile:', error)
      return new Response('Error creating organization profile', { status: 500 })
    }

    console.log(`[Webhook] Created org profile for ${name} (${id})`)
  }
  
  else if (eventType === 'organization.updated') {
    const { id, name, image_url } = evt.data
    
    const { error } = await supabase
      .from('organization_profiles')
      .update({
        department: name,
        logo_url: image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_org_id', id)

    if (error) {
      console.error('Error updating organization profile:', error)
      return new Response('Error updating organization profile', { status: 500 })
    }

    console.log(`[Webhook] Updated org profile for ${name} (${id})`)
  }
  
  else if (eventType === 'organization.deleted') {
    const { id } = evt.data
    
    console.log(`[Webhook] Organization deleted: ${id}`)
    
    // Strategy: We DON'T delete the data. Instead:
    // 1. Mark the organization profile as deleted (soft delete)
    // 2. Optionally: Transfer ownership of orphaned data to the original creators
    
    // Option A: Soft delete - mark profile but keep for reference
    // This allows users to still see their old org name in historical data
    const { error: profileError } = await supabase
      .from('organization_profiles')
      .update({
        is_discoverable: false,
        updated_at: new Date().toISOString(),
        // Add a deleted marker (you might want to add this column)
        // is_deleted: true,
      })
      .eq('clerk_org_id', id)
    
    if (profileError) {
      console.error('Error soft-deleting organization profile:', profileError)
    }
    
    // Option B (Alternative): Nullify org_id on orphaned records
    // This "releases" the data back to the individual users
    // Uncomment if you prefer this approach:
    /*
    await supabase.from('cohorts').update({ org_id: null }).eq('org_id', id)
    await supabase.from('mice').update({ org_id: null }).eq('org_id', id)
    await supabase.from('experiments').update({ org_id: null }).eq('org_id', id)
    */
    
    // Cancel any pending join requests for this org
    const { data: orgProfile } = await supabase
      .from('organization_profiles')
      .select('id')
      .eq('clerk_org_id', id)
      .single()
    
    if (orgProfile) {
      await supabase
        .from('join_requests')
        .update({ status: 'cancelled' })
        .eq('organization_id', orgProfile.id)
        .eq('status', 'pending')
    }

    console.log(`[Webhook] Processed org deletion for ${id}`)
  }

  // =========================================================================
  // ORGANIZATION MEMBERSHIP EVENTS
  // =========================================================================
  else if (eventType === 'organizationMembership.created') {
    const { organization, public_user_data } = evt.data
    const orgId = organization.id
    const userId = public_user_data.user_id
    
    console.log(`[Webhook] User ${userId} joined org ${orgId}`)
    
    // Update member count
    await supabase.rpc('increment_org_member_count', { org_clerk_id: orgId })
    
    // If this membership was created from an approved join request, mark it
    const { data: orgProfile } = await supabase
      .from('organization_profiles')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single()
    
    if (orgProfile) {
      await supabase
        .from('join_requests')
        .update({ 
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('organization_id', orgProfile.id)
        .eq('user_id', userId)
        .eq('status', 'pending')
    }
  }
  
  else if (eventType === 'organizationMembership.deleted') {
    const { organization, public_user_data } = evt.data
    const orgId = organization.id
    const userId = public_user_data.user_id
    
    console.log(`[Webhook] User ${userId} left org ${orgId}`)
    
    // Decrement member count
    await supabase.rpc('decrement_org_member_count', { org_clerk_id: orgId })
    
    // Note: We're NOT deleting or reassigning user's data when they leave
    // The data they created while in the org stays with the org
    // They can still see their own data via the user_id check in RLS
  }

  return new Response('', { status: 200 })
}
