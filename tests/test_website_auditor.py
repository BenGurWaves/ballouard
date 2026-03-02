"""Tests for the website auditor scoring logic."""

from services.website_auditor import compute_badness_score


def test_perfect_site_has_low_badness():
    scores = {"performance": 95, "seo": 90}
    metrics = {"is_mobile_friendly": True, "has_ssl": True, "first_contentful_paint_ms": 1000}
    badness = compute_badness_score(scores, metrics)
    assert badness < 30, f"Perfect site should score low badness, got {badness}"


def test_terrible_site_has_high_badness():
    scores = {"performance": 15, "seo": 20}
    metrics = {"is_mobile_friendly": False, "has_ssl": False, "first_contentful_paint_ms": 8000}
    badness = compute_badness_score(scores, metrics)
    assert badness > 70, f"Terrible site should score high badness, got {badness}"


def test_mediocre_site_is_middling():
    scores = {"performance": 50, "seo": 50}
    metrics = {"is_mobile_friendly": True, "has_ssl": True, "first_contentful_paint_ms": 4000}
    badness = compute_badness_score(scores, metrics)
    assert 20 < badness < 60, f"Mediocre site should be middling, got {badness}"


def test_missing_scores_use_defaults():
    scores = {}
    metrics = {}
    badness = compute_badness_score(scores, metrics)
    assert 0 <= badness <= 100
