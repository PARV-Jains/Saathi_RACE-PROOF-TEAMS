import os
import sys

sys.path.insert(0, '/Users/parvjain/Library/Python/3.9/lib/python/site-packages')

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette (Dark High-Tech Console)
    BG_DARK = RGBColor(9, 13, 22)        # #090d16
    BG_CARD = RGBColor(17, 24, 39)       # #111827
    BORDER_COLOR = RGBColor(31, 41, 55)  # #1f2937
    EMERALD = RGBColor(16, 185, 129)     # #10b981
    EMERALD_BG = RGBColor(6, 78, 59)     # #064e3b
    CYAN = RGBColor(56, 189, 248)        # #38bdf8
    TEXT_LIGHT = RGBColor(243, 244, 246) # #f3f4f6
    TEXT_MUTED = RGBColor(156, 163, 175) # #9ca3af
    TEXT_DIM = RGBColor(107, 114, 128)   # #6b7280
    ROSE = RGBColor(244, 63, 94)         # #f43f5e

    blank_layout = prs.slide_layouts[6]

    def add_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, tag_text, title_text, subtitle_text=""):
        # Tag Badge
        tag = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.5), Inches(3.2), Inches(0.38))
        tag.fill.solid()
        tag.fill.fore_color.rgb = EMERALD_BG
        tag.line.color.rgb = EMERALD
        tag.line.width = Pt(1)
        tf_tag = tag.text_frame
        tf_tag.margin_top = tf_tag.margin_bottom = tf_tag.margin_left = tf_tag.margin_right = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tag_text
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = EMERALD
        p_tag.font.name = "Arial"
        p_tag.alignment = PP_ALIGN.CENTER

        # Title
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.95), Inches(11.7), Inches(0.8))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p_title = tf.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_LIGHT
        p_title.font.name = "Arial"

        if subtitle_text:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle_text
            p_sub.font.size = Pt(12)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.font.name = "Arial"

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    add_bg(s1)

    # Decorative glow card
    card1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(1.2), Inches(10.933), Inches(5.1))
    card1.fill.solid()
    card1.fill.fore_color.rgb = BG_CARD
    card1.line.color.rgb = BORDER_COLOR
    card1.line.width = Pt(1.5)

    # Brand Title
    tb1 = s1.shapes.add_textbox(Inches(1.8), Inches(1.8), Inches(9.7), Inches(3.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "SAATHI"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.font.name = "Arial"

    p2 = tf1.add_paragraph()
    p2.text = "Race-Proof Team Formation at Scale"
    p2.font.size = Pt(28)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_LIGHT
    p2.font.name = "Arial"
    p2.space_before = Pt(8)

    p3 = tf1.add_paragraph()
    p3.text = "Engineered for 10,000 Hackathon Participants under High Concurrency"
    p3.font.size = Pt(16)
    p3.font.color.rgb = CYAN
    p3.font.name = "Arial"
    p3.space_before = Pt(12)

    p4 = tf1.add_paragraph()
    p4.text = "Pessimistic Row Locks (SELECT ... FOR UPDATE)  •  Idempotency Engine  •  Fastify 5 + SSE  •  p95 < 2ms"
    p4.font.size = Pt(13)
    p4.font.color.rgb = TEXT_MUTED
    p4.font.name = "Arial"
    p4.space_before = Pt(24)

    p5 = tf1.add_paragraph()
    p5.text = "Presenter: Parv Jain  |  Full Stack & Systems Engineering Walkthrough"
    p5.font.size = Pt(12)
    p5.font.bold = True
    p5.font.color.rgb = TEXT_DIM
    p5.font.name = "Arial"
    p5.space_before = Pt(36)

    # =========================================================================
    # SLIDE 2: THE CORE CONCURRENCY PROBLEM
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_bg(s2)
    add_header(s2, "SYSTEMS ARCHITECTURE CHALLENGE", "The Concurrency Dilemma: When 50 People Click at the Same Millisecond", "Why standard web application architectures corrupt data during registration bursts")

    # Card Left: The Naive Architecture
    c_left = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(5.6), Inches(4.8))
    c_left.fill.solid()
    c_left.fill.fore_color.rgb = BG_CARD
    c_left.line.color.rgb = RGBColor(127, 29, 29) # red border
    c_left.line.width = Pt(1.5)

    tb_l = s2.shapes.add_textbox(Inches(1.1), Inches(2.2), Inches(5.0), Inches(4.4))
    tf_l = tb_l.text_frame
    tf_l.word_wrap = True

    p = tf_l.paragraphs[0]
    p.text = "❌ Naive Database Implementation"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = ROSE
    p.font.name = "Arial"

    bullets_l = [
        ("Time-of-Check to Time-of-Use (TOCTOU):", "Reading current_member_count outside a transaction leaves a race window where multiple threads read '3/4 available'."),
        ("Oversold Team Capacities:", "Both threads insert simultaneously, resulting in 5 members in a 4-person maximum team."),
        ("Phantom & Duplicate Records:", "Double-clicking 'Create' or network retries create orphan duplicate teams or double-joined hackers."),
        ("Stale In-Memory State:", "Without real-time push, client dashboards display outdated slots until a manual browser refresh.")
    ]
    for b_title, b_desc in bullets_l:
        p_b = tf_l.add_paragraph()
        p_b.text = f"• {b_title} "
        p_b.font.bold = True
        p_b.font.size = Pt(12)
        p_b.font.color.rgb = TEXT_LIGHT
        p_b.space_before = Pt(12)
        run = p_b.add_run()
        run.text = b_desc
        run.font.bold = False
        run.font.color.rgb = TEXT_MUTED

    # Card Right: The Saathi Architecture
    c_right = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.9), Inches(2.0), Inches(5.6), Inches(4.8))
    c_right.fill.solid()
    c_right.fill.fore_color.rgb = BG_CARD
    c_right.line.color.rgb = EMERALD
    c_right.line.width = Pt(1.5)

    tb_r = s2.shapes.add_textbox(Inches(7.2), Inches(2.2), Inches(5.0), Inches(4.4))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True

    p = tf_r.paragraphs[0]
    p.text = "✅ Saathi Concurrency Engine"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = EMERALD
    p.font.name = "Arial"

    bullets_r = [
        ("Pessimistic Row Serialization:", "SELECT ... FOR UPDATE locks the target team row exclusively, queueing concurrent contenders."),
        ("Strict In-Lock Validation:", "Capacity is checked strictly inside the lock. 1 transaction claims the slot; 49 receive 409 Conflict."),
        ("Transactional Idempotency:", "pg_advisory_xact_lock and unique keys ensure retry replays return cached 200/201 responses without re-executing."),
        ("Real-Time Event Bus (SSE):", "State mutations broadcast instantly over Server-Sent Events to keep all connected browsers in sync.")
    ]
    for b_title, b_desc in bullets_r:
        p_b = tf_r.add_paragraph()
        p_b.text = f"• {b_title} "
        p_b.font.bold = True
        p_b.font.size = Pt(12)
        p_b.font.color.rgb = TEXT_LIGHT
        p_b.space_before = Pt(12)
        run = p_b.add_run()
        run.text = b_desc
        run.font.bold = False
        run.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 3: CRITICAL INVARIANTS & SELECT FOR UPDATE
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_bg(s3)
    add_header(s3, "CORE CONCURRENCY PRIMITIVES", "Database Locking Invariant: SELECT ... FOR UPDATE", "How atomic transaction isolation guarantees ground-truth data consistency")

    # Code Snippet Card
    c_code = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(7.2), Inches(4.8))
    c_code.fill.solid()
    c_code.fill.fore_color.rgb = RGBColor(13, 17, 23)
    c_code.line.color.rgb = BORDER_COLOR
    c_code.line.width = Pt(1)

    tb_code = s3.shapes.add_textbox(Inches(1.0), Inches(2.1), Inches(6.8), Inches(4.6))
    tf_code = tb_code.text_frame
    tf_code.word_wrap = True

    code_lines = [
        ("// Atomic Mutation in src/lib/team-service.ts", CYAN, True),
        ("await client.query('BEGIN');", TEXT_LIGHT, False),
        ("", TEXT_LIGHT, False),
        ("// CRITICAL INVARIANT: Lock row exclusively", EMERALD, True),
        ("const teamRes = await client.query(", TEXT_LIGHT, False),
        ("  `SELECT * FROM teams WHERE id = $1 FOR UPDATE`,", EMERALD, True),
        ("  [teamId]", TEXT_LIGHT, False),
        (");", TEXT_LIGHT, False),
        ("", TEXT_LIGHT, False),
        ("// Evaluate capacity strictly inside the lock", TEXT_MUTED, False),
        ("if (team.current_member_count >= team.max_size) {", TEXT_LIGHT, False),
        ("  throw new AppError(409, 'TEAM_FULL', 'Team is full');", ROSE, True),
        ("}", TEXT_LIGHT, False),
        ("", TEXT_LIGHT, False),
        ("// Atomic roster addition & counter increment", TEXT_MUTED, False),
        ("await client.query(`INSERT INTO team_members ...`);", TEXT_LIGHT, False),
        ("await client.query(`UPDATE teams SET current_member_count = ...`);", TEXT_LIGHT, False),
        ("await writeAuditLog(client, ...);", TEXT_LIGHT, False),
        ("await client.query('COMMIT');", TEXT_LIGHT, True)
    ]
    for line, color, is_bold in code_lines:
        p_c = tf_code.add_paragraph() if tf_code.paragraphs[0].text else tf_code.paragraphs[0]
        p_c.text = line
        p_c.font.size = Pt(11)
        p_c.font.color.rgb = color
        p_c.font.bold = is_bold
        p_c.font.name = "Courier New"

    # Explanation Column
    c_exp = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.3), Inches(2.0), Inches(4.2), Inches(4.8))
    c_exp.fill.solid()
    c_exp.fill.fore_color.rgb = BG_CARD
    c_exp.line.color.rgb = BORDER_COLOR

    tb_exp = s3.shapes.add_textbox(Inches(8.5), Inches(2.2), Inches(3.8), Inches(4.4))
    tf_exp = tb_exp.text_frame
    tf_exp.word_wrap = True

    p = tf_exp.paragraphs[0]
    p.text = "Key Concurrency Guarantees"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = CYAN
    p.font.name = "Arial"

    pts = [
        ("Row-Level Lock Exclusion:", "Transactions competing for the same team ID are serialized in sequence. Competing transactions wait at the row lock."),
        ("Zero Stale Reads:", "The winner increments count to maximum; subsequent transactions read the committed state and exit with 409 Conflict."),
        ("Multi-Layer Defense:", "In addition to application row locks, Postgres enforces CHECK (current_member_count <= max_size) as a database constraint."),
        ("Immutable Audit Trail:", "Every state transition writes to audit_logs inside the same transaction, surviving even team deletion.")
    ]
    for p_title, p_desc in pts:
        p_p = tf_exp.add_paragraph()
        p_p.text = f"✔ {p_title} "
        p_p.font.bold = True
        p_p.font.size = Pt(11)
        p_p.font.color.rgb = TEXT_LIGHT
        p_p.space_before = Pt(10)
        run = p_p.add_run()
        run.text = p_desc
        run.font.bold = False
        run.font.color.rgb = TEXT_MUTED

    # Helper function for screenshot slides
    def add_screenshot_slide(tag, title, subtitle, img_name, feature_bullets):
        s = prs.slides.add_slide(blank_layout)
        add_bg(s)
        add_header(s, tag, title, subtitle)

        # Image Container (Left)
        img_path = os.path.join("docs/screenshots", img_name)
        if os.path.exists(img_path):
            s.shapes.add_picture(img_path, Inches(0.8), Inches(1.9), width=Inches(7.8))

        # Highlights Card (Right)
        c_feat = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.9), Inches(1.9), Inches(3.6), Inches(4.9))
        c_feat.fill.solid()
        c_feat.fill.fore_color.rgb = BG_CARD
        c_feat.line.color.rgb = BORDER_COLOR
        c_feat.line.width = Pt(1)

        tb_f = s.shapes.add_textbox(Inches(9.1), Inches(2.1), Inches(3.2), Inches(4.5))
        tf_f = tb_f.text_frame
        tf_f.word_wrap = True

        p = tf_f.paragraphs[0]
        p.text = "Key Highlights"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = EMERALD
        p.font.name = "Arial"

        for b_title, b_desc in feature_bullets:
            p_b = tf_f.add_paragraph()
            p_b.text = f"✦ {b_title}"
            p_b.font.bold = True
            p_b.font.size = Pt(11.5)
            p_b.font.color.rgb = TEXT_LIGHT
            p_b.space_before = Pt(12)
            p_desc_para = tf_f.add_paragraph()
            p_desc_para.text = b_desc
            p_desc_para.font.size = Pt(10.5)
            p_desc_para.font.color.rgb = TEXT_MUTED

    # =========================================================================
    # SLIDE 4: SCREENSHOT - BOARD
    # =========================================================================
    add_screenshot_slide(
        "LIVE TEAM REGISTRY",
        "Open Teams Board with Live SSE Sync",
        "High-density registry rendering 2,000 teams with multi-skill filtering and instant search",
        "1-board.png",
        [
            ("Real-Time Event Stream:", "Connected to /api/events. Seat updates, team creation, and member leaves push live across all screens."),
            ("Multi-Vector Filtering:", "Instant filter by skill tags (React, Node, Go, Rust) and full-text name/description search."),
            ("Micro-Cached Reads:", "2s-10s cache with immediate invalidation on any write transaction guarantees sub-2ms response times."),
            ("Optimistic Feedback:", "Join requests update UI optimistically with automatic rollback on server conflict.")
        ]
    )

    # =========================================================================
    # SLIDE 5: SCREENSHOT - TEAM DASHBOARD
    # =========================================================================
    add_screenshot_slide(
        "ROSTER & PERMISSIONS",
        "Team Dashboard & Deterministic Succession",
        "Leader controls, cryptographic invite codes, and automated succession lifecycle",
        "2-team-dashboard.png",
        [
            ("One-Click Persona Switcher:", "Quickly test as Team Leader, Member, or Solo Hacker without re-authenticating."),
            ("Secure Invite Codes:", "96-bit high-entropy codes with TTL expiration and sliding-window rate limit protection."),
            ("Deterministic Succession:", "When a leader leaves, leadership automatically transfers to the next senior member."),
            ("Auto-Delete Cascade:", "When the final member departs, the team record cascades to deletion while preserving audit logs.")
        ]
    )

    # =========================================================================
    # SLIDE 6: SCREENSHOT - SUGGESTIONS
    # =========================================================================
    add_screenshot_slide(
        "MATCHMAKING ENGINE",
        "Explainable Teammate Recommendations",
        "Ranked candidate suggestions based on complementary skills and timezone proximity",
        "3-suggestions.png",
        [
            ("Dual-Factor Scoring:", "Weighted 65% on complementary skill coverage and 35% on timezone offset alignment."),
            ("Explainable Matches:", "Shows exact breakdown badges explaining why each hacker was suggested."),
            ("One-Click Outreach:", "Leaders can issue direct team invites or send requests straight from the suggestions console."),
            ("Dynamic Solo Pool:", "Automatically draws from all unassigned hackathon solo hackers in real time.")
        ]
    )

    # =========================================================================
    # SLIDE 7: SCREENSHOT - CONCURRENCY SIMULATOR
    # =========================================================================
    add_screenshot_slide(
        "VERIFIABLE CONCURRENCY",
        "Live 50-Client Concurrency Stress Simulation",
        "In-browser proof: 50 contenders racing for 1 seat with zero oversold slots",
        "4-concurrency-sim.png",
        [
            ("Real Server Execution:", "POST /api/demo/simulate-race dispatches 50 genuine concurrent HTTP requests to the backend."),
            ("Strict 1 Winner Guarantee:", "Strictly 1 candidate receives 200 OK; exactly 49 candidates receive 409 TEAM_FULL."),
            ("Database Ground Truth:", "Roster count reflects strictly 4/4; zero oversold members recorded in PostgreSQL."),
            ("Interactive Verification:", "Judges and reviewers can click the trigger button in-browser to re-verify live.")
        ]
    )

    # =========================================================================
    # SLIDE 8: SCREENSHOT - SCALE & TELEMETRY
    # =========================================================================
    add_screenshot_slide(
        "SCALE & BENCHMARKS",
        "10k Scale Telemetry & Sub-200ms p95 Latency",
        "Autocannon load test report and in-browser 100-connection live benchmark console",
        "5-scale-telemetry.png",
        [
            ("10,000 Hackers / 2,000 Teams:", "Live PostgreSQL database scaled and indexed for massive hackathon workloads."),
            ("Autocannon Load Test:", "100 concurrent connections across 10s: 12,131 req/s, 0 errors, p95 latency: 2ms."),
            ("Sub-2ms Server Response:", "Native x-response-time header tracking reflects ~1.2ms server turnaround time."),
            ("43 Automated Tests:", "Full test coverage including unit tests, race tests, and chaos kill recovery in CI.")
        ]
    )

    # =========================================================================
    # SLIDE 9: SUMMARY & SUBMISSION RECAP
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_bg(s9)
    add_header(s9, "DELIVERABLES RECAP", "Production-Ready Hackathon Service", "Tested, benchmarked, deployed live, and proven race-proof")

    # 4 Cards Grid
    grid_data = [
        ("🚀 Live Cloud Deployment", "Hosted on Render with persistent Fastify HTTP server and Server-Sent Events stream.", "Render + Node 22", EMERALD),
        ("🛡️ PostgreSQL Concurrency", "Backed by Supabase PostgreSQL. Pessimistic row locks ensure zero race condition anomalies.", "PostgreSQL 16", CYAN),
        ("🧪 43 Automated Tests in CI", "GitHub Actions pipeline verifying 39 API endpoints, 50-client race tests, and chaos resilience.", "Vitest + CI Actions", EMERALD),
        ("📊 Comprehensive Docs", "Complete architectural design document (DESIGN.md) and load test benchmark report (LOAD_TEST_REPORT.md).", "DESIGN.md + Report", CYAN)
    ]

    for i, (title, desc, tag, color) in enumerate(grid_data):
        col = i % 2
        row = i // 2
        x = Inches(0.8 + col * 5.9)
        y = Inches(2.0 + row * 2.5)

        card = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.6), Inches(2.2))
        card.fill.solid()
        card.fill.fore_color.rgb = BG_CARD
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)

        tb = s9.shapes.add_textbox(x + Inches(0.25), y + Inches(0.2), Inches(5.1), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = color
        p.font.name = "Arial"

        p_desc = tf.add_paragraph()
        p_desc.text = desc
        p_desc.font.size = Pt(12)
        p_desc.font.color.rgb = TEXT_LIGHT
        p_desc.font.name = "Arial"
        p_desc.space_before = Pt(8)

        p_tag = tf.add_paragraph()
        p_tag.text = f"Stack: {tag}"
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = TEXT_MUTED
        p_tag.font.name = "Arial"
        p_tag.space_before = Pt(10)

    out_path = "Saathi_Presentation.pptx"
    prs.save(out_path)
    print(f"Presentation generated successfully: {out_path}")

if __name__ == "__main__":
    create_presentation()
