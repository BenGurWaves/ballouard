"""
Agent 6 — Client Success Agent
Manages ongoing client communication across channels (email, WhatsApp, Telegram).

Responsibilities:
  1. Send project status updates
  2. Handle client questions and revision requests
  3. Collect feedback and approval
  4. Route messages through the client's preferred channel
  5. Provide a human-like conversational interface
"""

from __future__ import annotations

from sqlalchemy import select

from agents.base import BaseAgent
from models.lead import Lead
from models.project import Project, ProjectStatus
from models.message import Message, MessageChannel
from services.messaging import send_message
from services.email_sender import send_email
from config.settings import settings


class ClientSuccessAgent(BaseAgent):
    name = "client_success"

    async def run(self) -> dict:
        """Send pending status updates and check for client messages."""
        stats = {"updates_sent": 0, "replies_handled": 0, "errors": 0}

        # Send status updates for active projects
        result = await self.db.execute(
            select(Project).where(
                Project.status.in_([
                    ProjectStatus.DESIGNING,
                    ProjectStatus.BUILDING,
                    ProjectStatus.REVIEW,
                    ProjectStatus.DEPLOYING,
                    ProjectStatus.LIVE,
                ])
            )
        )
        projects = list(result.scalars().all())

        for project in projects:
            try:
                await self._send_status_update(project)
                stats["updates_sent"] += 1
            except Exception as exc:
                self.log.error("update_failed", project=project.id, error=str(exc))
                stats["errors"] += 1

        await self.db.commit()
        self.log.info("client_success_run", **stats)
        return stats

    async def handle_client_message(
        self, lead_id: str, message_text: str, channel: str
    ) -> str:
        """
        Process an incoming client message, generate a response, and send it.
        Returns the response text.
        """
        # Get lead and project context
        lead_result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = lead_result.scalar_one()

        project_result = await self.db.execute(
            select(Project).where(Project.lead_id == lead_id).order_by(Project.created_at.desc())
        )
        project = project_result.scalar_one_or_none()

        # Log inbound message
        inbound = Message(
            lead_id=lead_id,
            channel=MessageChannel(channel),
            direction="inbound",
            body=message_text,
            sender=lead.email or lead.phone,
            agent_name=self.name,
        )
        self.db.add(inbound)

        # Classify the message intent
        intent = await self._classify_message(message_text)

        # Generate appropriate response
        response_text = await self._generate_response(lead, project, message_text, intent)

        # Send response via preferred channel
        preferred = lead.preferred_channel or channel
        await self._send_response(lead, response_text, preferred)

        # Log outbound
        outbound = Message(
            lead_id=lead_id,
            channel=MessageChannel(preferred),
            direction="outbound",
            body=response_text,
            recipient=lead.email or lead.phone,
            agent_name=self.name,
        )
        self.db.add(outbound)

        # Handle revision requests
        if intent == "revision" and project:
            project.status = ProjectStatus.REVISIONS
            project.revision_count += 1

        await self.db.commit()
        return response_text

    async def send_welcome_message(self, lead_id: str) -> None:
        """Send a welcome message when a project kicks off."""
        lead_result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = lead_result.scalar_one()

        first_name = lead.contact_name.split()[0] if lead.contact_name else "there"

        message = f"""Hi {first_name}! 👋

Thanks for choosing {settings.agency_name} for your new website. I'm your dedicated project manager and I'll be keeping you updated every step of the way.

Here's what happens next:
1. Our design team is working on your site right now
2. You'll get a preview within 3-5 business days
3. You'll have a chance to request revisions
4. Once you approve, we go live!

You can reach me right here anytime with questions. What's the best way for you to communicate — email, WhatsApp, or Telegram?"""

        channel = lead.preferred_channel or "email"
        await self._send_response(lead, message, channel)

        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel(channel),
            direction="outbound",
            body=message,
            recipient=lead.email or lead.phone,
            agent_name=self.name,
            template_name="welcome",
        )
        self.db.add(msg)
        await self.db.commit()

    async def _send_status_update(self, project: Project) -> None:
        """Send a project status update to the client."""
        lead_result = await self.db.execute(select(Lead).where(Lead.id == project.lead_id))
        lead = lead_result.scalar_one()

        status_messages = {
            ProjectStatus.DESIGNING: "Your website design is in progress! Our team is working on the layout and visual style. You'll see a preview soon.",
            ProjectStatus.BUILDING: "Great news — the design is locked in and we're now building out all the pages. Almost there!",
            ProjectStatus.REVIEW: "Your website is ready for review! Please take a look and let me know if you'd like any changes.",
            ProjectStatus.DEPLOYING: "You've approved the design — we're deploying it now. Your site will be live shortly!",
            ProjectStatus.LIVE: f"Your new website is LIVE! 🎉 Check it out: {project.live_url}",
        }

        message = status_messages.get(project.status)
        if not message:
            return

        first_name = lead.contact_name.split()[0] if lead.contact_name else "there"
        message = f"Hi {first_name}, quick update on your website:\n\n{message}"

        if project.status == ProjectStatus.REVIEW and project.live_url:
            message += f"\n\nPreview: {project.live_url}"

        channel = lead.preferred_channel or "email"
        await self._send_response(lead, message, channel)

    async def _classify_message(self, message_text: str) -> str:
        """Classify client message intent."""
        response = await self.think(
            system="""Classify this client message into exactly one category.
Reply with ONLY the category name.

Categories:
- question: Asking about timeline, process, or general info
- revision: Requesting a change to the design
- approval: Approving the current design
- complaint: Expressing dissatisfaction
- channel_preference: Stating preferred communication channel
- other: Anything else""",
            user_message=message_text,
            temperature=0.0,
        )
        return response.strip().lower()

    async def _generate_response(
        self, lead: Lead, project: Project | None, message: str, intent: str
    ) -> str:
        """Generate a contextual, human-sounding response."""
        project_context = ""
        if project:
            project_context = f"""
Project status: {project.status.value}
Revisions so far: {project.revision_count}
Live URL: {project.live_url or 'Not yet deployed'}"""

        return await self.think(
            system=f"""You are a friendly, professional project manager at {settings.agency_name}.
You're managing a website build for a client.
Rules:
- Be warm, conversational, and concise
- Don't use corporate jargon
- If they want a revision, confirm you've noted it
- If they approve, express excitement and give next steps
- If they have a question, answer directly
- Keep messages under 100 words
- Sign off with your first name only""",
            user_message=f"""Client: {lead.business_name} ({lead.business_type})
Contact: {lead.contact_name or 'Unknown'}
Intent: {intent}
{project_context}

Their message: "{message}"

Generate a response.""",
        )

    async def _send_response(self, lead: Lead, message: str, channel: str) -> None:
        """Send a message via the appropriate channel."""
        if channel == "email" and lead.email:
            await send_email(
                lead.email,
                f"Update on your website — {settings.agency_name}",
                f"<div style='font-family: sans-serif; line-height: 1.6;'><p>{message.replace(chr(10), '</p><p>')}</p></div>",
                message,
            )
        elif channel in ("whatsapp", "telegram") and lead.phone:
            await send_message(channel, lead.phone, message)
        else:
            # Fallback to email
            if lead.email:
                await send_email(
                    lead.email,
                    f"Update on your website — {settings.agency_name}",
                    f"<p>{message}</p>",
                    message,
                )
