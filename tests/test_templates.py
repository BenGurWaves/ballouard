"""Tests for email templates."""

from templates.emails import (
    INITIAL_EMAIL_PLAIN,
    INITIAL_SUBJECT_LINES,
    format_issues_list,
    format_issues_html,
    CAN_SPAM_FOOTER,
)


def test_initial_subject_lines_contain_placeholder():
    for subject in INITIAL_SUBJECT_LINES:
        assert "{business_name}" in subject or "{first_name}" in subject


def test_initial_email_has_required_placeholders():
    required = ["{first_name}", "{business_name}", "{preview_link}", "{unsubscribe_line}"]
    for placeholder in required:
        assert placeholder in INITIAL_EMAIL_PLAIN, f"Missing {placeholder} in initial email"


def test_format_issues_list():
    issues = ["Slow on mobile", "No SSL"]
    result = format_issues_list(issues)
    assert "Slow on mobile" in result
    assert "No SSL" in result


def test_format_issues_html():
    issues = ["Slow on mobile"]
    result = format_issues_html(issues)
    assert "<li>Slow on mobile</li>" in result
    assert "<ul" in result


def test_can_spam_footer_has_required_fields():
    footer = CAN_SPAM_FOOTER.format(agency_name="TestCo", agency_address="123 Main St")
    assert "TestCo" in footer
    assert "123 Main St" in footer
    # CAN-SPAM requires physical address and opt-out mechanism
    assert "STOP" in footer or "unsubscribe" in footer.lower()
