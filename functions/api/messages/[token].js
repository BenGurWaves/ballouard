import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestGet(context) {
  const t = context.params.token;
  if (!t) return secureErr('Token required', 400);
  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);
  const rows = await sb.select('velocity_messages', 'lead_token=eq.'+t+'&order=created_at.asc').catch(()=>[]);
  return secureJson(rows);
}

export async function onRequestPost(context) {
  const t = context.params.token;
  if (!t) return secureErr('Token required', 400);
  
  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable',503);
  let body; try{body=await context.request.json();}catch{return secureErr('Invalid request');}
  const {message}=body;
  if(!message||!message.trim()) return secureErr('Message required');
  if(message.trim().length>4000) return secureErr('Message too long');
  const auth=await checkAdminAuth(context.request,context.env);
  const sender=auth.ok?'admin':'client';
  const leads=await sb.select('velocity_leads','token=eq.'+t+'&select=id,client_email,client_name,status').catch(()=>[]);
  if(!leads.length) return secureErr('Not found',404);
  const lead=leads[0];
  const msg=await sb.insert('velocity_messages',{lead_token:t,sender,body:message.trim()}).catch(()=>null);
  if(!msg) return secureErr('Failed to send',500);
  const base=context.env.SITE_URL||'https://velocity.calyvent.com';
  const adminEmail='atelier@calyvent.com';
  if(context.env.RESEND_API_KEY){
    try{
      const to=sender==='admin'?lead.client_email:adminEmail;
      const subj=sender==='admin'?'New message from your studio.':'Client message: '+(lead.client_name||lead.client_email||t);
      const link=sender==='admin'?(base+'/dashboard/'+t):(base+'/admin');
      // Client: notification only — no message content (security + drives engagement to dashboard)
      // Admin: gets full message content
      const notice=sender==='client'?message.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;'):'You have a new message. Visit your dashboard to read and reply.';
      if(to){
        await fetch('https://api.resend.com/emails',{
          method:'POST',
          headers:{Authorization:'Bearer '+context.env.RESEND_API_KEY,'Content-Type':'application/json'},
          body:JSON.stringify({
            from:'Velocity.\u2122 <client@calyvent.com>',
            to:[to],
            subject:subj,
            html:'<div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5"><div style="font-family:Georgia,serif;font-size:17px;margin-bottom:32px">Velocity<span style="color:#C49C7B">.</span></div><h2 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">New message.</h2><p style="font-size:13px;color:#8a8680;line-height:1.9;margin:0 0 24px">'+notice+'</p><table cellpadding="0" cellspacing="0"><tr><td style="background:#DEC8B5"><a href="'+link+'" style="display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0D0C09;text-decoration:none;padding:12px 28px">Open now &rarr;</a></td></tr></table><p style="font-size:11px;color:#3a3835;margin-top:32px">Velocity.\u2122 by Calyvent &mdash; velocity.calyvent.com</p></div>',
          }),
        });
      }
    }catch(_){}
  }
  return secureJson({success:true});
}

export async function onRequestPatch(context) {
  const t=context.params.token;
  if(!t) return secureErr('Token required',400);
  const sb=getSupabase(context.env);
  if(!sb) return secureErr('Service unavailable',503);
  let body; try{body=await context.request.json();}catch{return secureErr('Invalid request');}
  const m=body.reader==='admin'?'client':'admin';
  await sb.update('velocity_messages','lead_token=eq.'+t+'&sender=eq.'+m+'&read_at=is.null',{read_at:new Date().toISOString()}).catch(()=>{});
  return secureJson({success:true});
}
