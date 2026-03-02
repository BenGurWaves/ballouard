"""
Pipeline Orchestrator — connects all agents into an autonomous loop.

The main loop runs on a schedule:
  1. Lead Researcher → finds new businesses with bad websites
  2. Design Preview Agent → generates blurred mockups for qualified leads
  3. Outreach Agent → sends cold emails with previews
  4. Sales Agent → handles replies, sends demos, invoices
  5. Web Design Agent → builds sites for paid projects
  6. Client Success Agent → manages client communication

Each step feeds the next through shared database state (Lead.status).
"""

from __future__ import annotations

import asyncio

import structlog
from sqlalchemy import select

from agents.lead_researcher import LeadResearchAgent
from agents.outreach import OutreachAgent
from agents.design_preview import DesignPreviewAgent
from agents.sales import SalesAgent
from agents.web_designer import WebDesignAgent
from agents.client_success import ClientSuccessAgent
from models.lead import Lead, LeadStatus
from models.project import Project, ProjectStatus
from models.database import async_session, init_db
from utils.logging import setup_logging

log = structlog.get_logger()


class PipelineOrchestrator:
    """Runs the full agency pipeline."""

    async def run_full_cycle(self) -> dict:
        """Execute one full pipeline cycle across all agents."""
        setup_logging()
        await init_db()

        results = {}

        async with async_session() as session:
            # Stage 1: Research new leads
            log.info("pipeline.stage", stage="lead_research")
            researcher = LeadResearchAgent(session)
            results["research"] = await researcher.run(
                categories=["plumber", "roofing contractor", "hvac contractor"],
                cities=["Austin TX", "Phoenix AZ"],
                max_leads_per_query=10,
            )

            # Stage 2: Generate previews for qualified leads
            log.info("pipeline.stage", stage="design_preview")
            previewer = DesignPreviewAgent(session)
            results["previews"] = await previewer.run()

            # Stage 3: Send outreach emails
            log.info("pipeline.stage", stage="outreach")
            outreach = OutreachAgent(session)
            results["outreach"] = await outreach.run()

            # Stage 4: Process sales pipeline
            log.info("pipeline.stage", stage="sales")
            sales = SalesAgent(session)
            results["sales"] = await sales.run()

            # Stage 5: Build websites for paid projects
            log.info("pipeline.stage", stage="web_design")
            designer = WebDesignAgent(session)
            results["design"] = await designer.run()

            # Stage 6: Client success updates
            log.info("pipeline.stage", stage="client_success")
            cs = ClientSuccessAgent(session)
            results["client_success"] = await cs.run()

            # Check for newly paid leads → create projects
            await self._create_projects_for_paid_leads(session)

            # Send welcome messages for new projects
            await self._welcome_new_clients(session, cs)

        log.info("pipeline.cycle_complete", results=results)
        return results

    async def run_stage(self, stage: str, **kwargs) -> dict:
        """Run a single pipeline stage."""
        setup_logging()
        await init_db()

        async with async_session() as session:
            agents = {
                "research": LeadResearchAgent,
                "preview": DesignPreviewAgent,
                "outreach": OutreachAgent,
                "sales": SalesAgent,
                "design": WebDesignAgent,
                "client_success": ClientSuccessAgent,
            }

            agent_cls = agents.get(stage)
            if not agent_cls:
                raise ValueError(f"Unknown stage: {stage}. Valid: {list(agents.keys())}")

            agent = agent_cls(session)
            return await agent.run(**kwargs)

    async def run_continuous(self, interval_minutes: int = 60) -> None:
        """Run the pipeline on a loop."""
        setup_logging()
        log.info("pipeline.starting_continuous", interval_minutes=interval_minutes)

        while True:
            try:
                results = await self.run_full_cycle()
                log.info("pipeline.cycle_done", results=results)
            except Exception as exc:
                log.error("pipeline.cycle_error", error=str(exc))

            log.info("pipeline.sleeping", minutes=interval_minutes)
            await asyncio.sleep(interval_minutes * 60)

    @staticmethod
    async def _create_projects_for_paid_leads(session) -> None:
        """Create project records for leads that just paid."""
        result = await session.execute(
            select(Lead).where(Lead.status == LeadStatus.PAID)
        )
        paid_leads = result.scalars().all()

        for lead in paid_leads:
            # Check if project already exists
            existing = await session.execute(
                select(Project).where(Project.lead_id == lead.id)
            )
            if existing.scalar_one_or_none():
                continue

            from models.deal import Deal
            deal_result = await session.execute(
                select(Deal).where(Deal.lead_id == lead.id).order_by(Deal.created_at.desc())
            )
            deal = deal_result.scalar_one_or_none()

            project = Project(
                deal_id=deal.id if deal else "",
                lead_id=lead.id,
                status=ProjectStatus.QUEUED,
                site_type="business",
            )
            session.add(project)
            lead.status = LeadStatus.IN_BUILD

            log.info("pipeline.project_created", lead=lead.business_name, project=project.id)

        await session.commit()

    @staticmethod
    async def _welcome_new_clients(session, cs_agent: ClientSuccessAgent) -> None:
        """Send welcome messages to newly created projects."""
        result = await session.execute(
            select(Project).where(Project.status == ProjectStatus.QUEUED)
        )
        projects = result.scalars().all()

        for project in projects:
            try:
                await cs_agent.send_welcome_message(project.lead_id)
            except Exception as exc:
                log.error("welcome_failed", project=project.id, error=str(exc))
