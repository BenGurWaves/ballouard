"""Tests for data models."""

from models.lead import Lead, LeadStatus, WebsiteAudit
from models.deal import Deal, DealStage
from models.project import Project, ProjectStatus
from models.message import Message, MessageChannel


def test_lead_status_values():
    assert LeadStatus.DISCOVERED.value == "discovered"
    assert LeadStatus.QUALIFIED.value == "qualified"
    assert LeadStatus.DELIVERED.value == "delivered"


def test_lead_creation():
    lead = Lead(
        business_name="Joe's Plumbing",
        business_type="plumber",
        website_url="https://joesplumbing.com",
        city="Austin",
        state="TX",
        email="joe@joesplumbing.com",
    )
    assert lead.business_name == "Joe's Plumbing"
    assert lead.business_type == "plumber"
    assert lead.outreach_count == 0


def test_deal_stages():
    assert DealStage.PROPOSAL.value == "proposal"
    assert DealStage.CLOSED_WON.value == "closed_won"


def test_project_statuses():
    assert ProjectStatus.QUEUED.value == "queued"
    assert ProjectStatus.LIVE.value == "live"


def test_message_channels():
    assert MessageChannel.EMAIL.value == "email"
    assert MessageChannel.WHATSAPP.value == "whatsapp"
    assert MessageChannel.TELEGRAM.value == "telegram"
