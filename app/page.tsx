"use client";

import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  Layers3,
  LockKeyhole,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="BIS Outcomes Cloud home">
          <span className="wordmark-mark">B</span>
          <span>
            <strong>BIS</strong>
            <em>Outcomes Cloud</em>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#system">The system</a>
          <a href="#labs">The labs</a>
          <a href="#institutions">For institutions</a>
        </nav>
        <button className="text-link" onClick={() => scrollTo("founding")}>Become a founding school <ArrowRight size={15} /></button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Applied Commerce® Behaviour Intelligence Series™</p>
          <h1>See the pattern.<br /><i>Strengthen the future.</i></h1>
          <p className="hero-lede">
            A private learner-development system for schools and youth programmes that turns reflection, practice and evidence into visible growth.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => scrollTo("system")}>Explore the system <ArrowDownRight size={18} /></button>
            <button className="quiet-button" onClick={() => window.location.assign("/portal")}>Enter the platform <ArrowRight size={17} /></button>
          </div>
          <div className="hero-note"><LockKeyhole size={15} /> Private by default. Insight is earned, never assumed.</div>
        </div>

        <div className="hero-art" aria-label="Illustrative BIS learner evidence dashboard preview">
          <div className="paper-stack back" />
          <div className="paper-stack mid" />
          <div className="evidence-card">
            <div className="card-topline">
              <span>Volume 1 · The Learner&apos;s Journey</span>
              <span className="live-dot">Illustrative cohort</span>
            </div>
            <div className="evidence-title">
              <p>HABIT LAB™</p>
              <h2>Every habit is a vote for the person you are becoming.</h2>
            </div>
            <div className="path-line"><span className="active" /><span className="active" /><span className="active" /><span /><span /><span /></div>
            <div className="evidence-metric-grid">
              <div><small>COHORT ENGAGEMENT</small><strong>—</strong><i>Populates after deployment</i></div>
              <div><small>EXPERIMENT ADHERENCE</small><strong>—</strong><i>Calculated from recorded evidence</i></div>
            </div>
            <div className="observer-note"><Eye size={16} /><span><b>The Observer</b><br />“The story becomes clearer when patterns repeat.”</span></div>
          </div>
          <div className="orange-tab">BEI<br />evidence</div>
          <Image className="workbook-cover" src="/bis-workbook-cover.png" alt="Applied Commerce Behaviour Intelligence Series learner workbook" width={124} height={176} priority />
        </div>
      </section>

      <section className="signal-strip" aria-label="BIS learning model">
        <span>Experience</span><ArrowRight size={17} /><span>Reflect</span><ArrowRight size={17} /><span>Observe</span><ArrowRight size={17} /><span>Practice</span><ArrowRight size={17} /><strong>Accumulate evidence</strong>
      </section>

      <section className="principle-section" id="system">
        <div className="section-kicker"><span>01</span> THE BIS PRINCIPLE</div>
        <div className="principle-content">
          <h2>The system observes continuously <i>and speaks selectively.</i></h2>
          <p>BIS does not turn a learner into a label, a score, or a diagnosis. It creates a dignified space to pause, investigate real patterns, practise a new response and recognise genuine growth over time.</p>
          <div className="principle-points">
            <article><Eye /><h3>Behavioural evidence</h3><p>Signals are collected from learner work, not personality tests.</p></article>
            <article><LockKeyhole /><h3>Privacy preserved</h3><p>Private reflections remain private. Institutions see ethical cohort insight.</p></article>
            <article><Sparkles /><h3>Insight with restraint</h3><p>Observations appear only when the evidence is strong enough to matter.</p></article>
          </div>
        </div>
      </section>

      <section className="lab-section" id="labs">
        <div className="lab-heading">
          <div><p className="section-kicker"><span>02</span> THE LEARNER&apos;S JOURNEY</p><h2>Deep curriculum.<br /><i>Progressive digital release.</i></h2></div>
          <p>Habit Lab™ and Decision Lab™ are currently available as digital cartridges. The wider 32-Lab Behaviour Intelligence Series™ already exists in curriculum form and is being progressively released into the learner runtime.</p>
        </div>
        <div className="lab-grid">
          <article className="lab-card featured">
            <span>01 · AVAILABLE NOW</span>
            <div><h3>Habit Lab™</h3><p>Baseline, nine investigations, 55 progressive interactions and a seven-day experiment.</p></div>
            <button className="lab-open" aria-label="Open Habit Lab in the learner platform" onClick={() => window.location.assign("/portal")}><ChevronRight size={18} /></button>
          </article>
          <article className="lab-card featured">
            <span>02 · AVAILABLE NOW</span>
            <div><h3>Decision Lab™</h3><p>Hidden-option investigation, personal decision equation, decision contract and a seven-day experiment.</p></div>
            <button className="lab-open" aria-label="Open Decision Lab in the learner platform" onClick={() => window.location.assign("/portal")}><ChevronRight size={18} /></button>
          </article>
          <article className="lab-card more"><Layers3 /><div><h3>30 Labs in conversion</h3><p>The remaining BIS Labs already exist in the curriculum catalogue and are being converted into certified digital cartridges.</p></div></article>
        </div>
      </section>

      <section className="institution-section" id="institutions">
        <div className="institution-copy">
          <p className="section-kicker inverse"><span>03</span> BUILT FOR INSTITUTIONS</p>
          <h2>Give people the language to understand what they are building.</h2>
          <p>BIS gives programme leaders a coherent delivery model, a private learner space and a cohort-level evidence picture. It is designed for schools, youth programmes and corporate-sponsored cohorts.</p>
          <ul>
            <li><Check size={17} /> Facilitator-ready workshops and experiments</li>
            <li><Check size={17} /> Cohort-level progress and evidence reporting</li>
            <li><Check size={17} /> Private learner writing excluded from institutional views</li>
          </ul>
        </div>
        <div className="institution-dashboard">
          <div className="dash-header"><span>Illustrative institution · Example cohort</span><CircleDot size={17} /></div>
          <div className="dash-hero"><p>PILOT EVIDENCE VIEW</p><h3>Growth becomes visible when evidence accumulates.</h3><span>Illustrative interface — not live outcome data</span></div>
          <div className="dash-stats"><div><small>ACTIVE LEARNERS</small><strong>—</strong></div><div><small>LAB COMPLETION</small><strong>—</strong></div><div><small>OBSERVATIONS</small><strong>—</strong></div></div>
          <div className="dash-progress"><span>Habit Lab™</span><div><i /><i /><i /><i className="pale" /><i className="pale" /></div><b>Evidence</b></div>
          <div className="dash-footer"><UsersRound size={17} /> Aggregated cohort view · no private learner writing displayed</div>
        </div>
      </section>

      <section className="founding-section" id="founding">
        <div className="founding-symbol">↗</div>
        <div><p className="section-kicker"><span>04</span> FOUNDING SCHOOLS COHORT</p><h2>Start with the learners<br />who shape what comes next.</h2></div>
        <div className="founding-right"><p>Bring BIS to one Grade 9–12 cohort. Receive the learner journey, facilitator onboarding and a structured cohort evidence view designed for responsible programme decisions.</p><button className="primary-button" onClick={() => window.location.assign("/portal")}>View the platform <BookOpen size={18} /></button></div>
      </section>

      <footer>
        <a className="wordmark light" href="#top"><span className="wordmark-mark">B</span><span><strong>BIS</strong><em>Outcomes Cloud</em></span></a>
        <p>Applied Commerce® Behaviour Intelligence Series™<br />A quiet system for visible growth.</p>
        <span>© 2026</span>
      </footer>
    </main>
  );
}
