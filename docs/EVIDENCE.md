# Evidence base

Sources behind the decisions in [PLAN.md](PLAN.md). Every claim carries its
source, its sample size where one exists, and an honest grade.

| Grade | Meaning |
|---|---|
| **Strong** | Peer-reviewed, large-N, or official government data |
| **Moderate** | Single study, smaller sample, or non-Indian context |
| **Weak** | Adjacent domain, extrapolated, or thin sourcing |

> **Before submission:** these citations were gathered by automated web research.
> Spot-check the ones you rely on in a presentation — particularly the app-store
> ratings and journalistic figures, which move and which we have not verified by
> hand.

---

## 1. What people want from air-quality information

### 1.1 Half of India's inaction is a missing instruction — not apathy

54% of respondents had heard of "AQI", but only **35% both knew it and understood
its relevance**; 46% neither. Awareness collapses outside metros: **17% in
Raipur** against 82% in Delhi-NCR, with similar lows in Chandrapur, Angul,
Varanasi and Singrauli.

Asked why they had taken no personal action, the largest group — **49.6%** —
answered *"I'm not aware of what action to take; if I knew, I would act."*

Newspapers were the top-cited source of accurate AQI information (69.5%), ahead
of mobile apps (36.4%). Government websites and physical display boards trailed.

- **Source:** CMSR Consultants / ASAR, *Perception Study on Air Quality in 17
  Cities* — n = 5,000 across 17 cities, plus 1,075 via partners.
  [PDF](https://www.bengalurusustainabilityforum.org/wp-content/uploads/2020/04/Detailed-Report-AQ-perception-survey.pdf)
- **Grade:** **Strong** — large, India-specific.
  **Caveat:** 2018; skews urban, literate and online.
- **Corroboration:** CDC ConsumerStyles, n = 12,396 US adults 2016–2018 — 53.9%
  aware of air-quality alerts, only **14.7%** changed behaviour because of one.
  [PDF](https://stacks.cdc.gov/view/cdc/87167/cdc_87167_DS1.pdf) — **Strong**,
  US context.
- **Drives:** PLAN §4.1 (teach and show together), tasks **A1**, **A2**, **B1**.

### 1.2 Severity without instruction produces avoidance, not protection

Sixty years of fear-appeal research: severity information alone can trigger
denial and avoidance unless paired with a concrete, achievable instruction *and*
evidence of personal susceptibility — "this applies to you, and here is what to
do."

- **Source:** systematic review of fear-appeal research.
  [Wiley](https://onlinelibrary.wiley.com/doi/full/10.1002/ijop.12042)
- **Grade:** **Strong** as a general risk-communication principle;
  **not air-quality-specific.**
- **Supporting:** RCT, n = 130 pregnant women, Iran — theory-based SMS programme
  significantly raised perceived severity, self-efficacy and self-reported
  protective behaviour versus control.
  [Springer](https://link.springer.com/article/10.1007/s11356-017-1034-7) —
  **Moderate**, small N, self-reported outcome.
- **Drives:** task **A2**. A band with no action sentence is a fear appeal with
  no efficacy component, which the literature says backfires.

### 1.3 People cannot sense pollution reliably, but a number alone does not move them

No significant association between measured PM2.5 exposure and self-reported
perceived air quality; older adults systematically underestimated exposure,
students overestimated it.

- **Source:** Hong Kong, n = 210, portable sensors + GPS, 2021.
  [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0294605)
  — **Moderate**, small N, not India.
- **Supporting:** South Korean haze events — people used *visibility*, not PM10,
  as their mental model until a catastrophic 10-day episode in 2014 shifted
  reliance to measured values.
  [IOP](https://iopscience.iop.org/article/10.1088/1748-9326/ab9fb0) —
  **Moderate**, search-trend proxies rather than survey data.
- **Supporting:** behaviour modification driven more by *personal perception*
  than by the published AQI value, and no different between health-susceptible
  and non-susceptible groups.
  [PMC7671501](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7671501/) —
  **Moderate**, California.
- **Reading:** numbers build an accurate mental model over time; instructions
  trigger the action. We need both, which is exactly §4.1.

### 1.4 Uncertainty-aware displays produce better decisions than confident-looking ones

Standard single-estimate maps "conceal uncertainty and lead to underestimation of
risk." Uncertainty-aware formats produced measurably more cautious activity
decisions.

- **Source:** Preston & Ma. [arXiv:2012.11109](https://arxiv.org/abs/2012.11109)
  — **Moderate**, single HCI study, directly on topic.
- **Supporting:** quantified uncertainty ranges cause a slight dip in trust of
  the *numbers* and **no** drop in trust of the *source*; gesturing vaguely at
  uncertainty without quantifying it damages trust in both.
  [PMC10663791](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10663791/) —
  **Moderate**, general statistics communication.
- **Drives:** PLAN §4.2 (the answer rule), tasks **B2**, **A1**.
- **Note:** this is why "±18 µg/m³" beats "approximately", and why a bare
  refusal beats a borrowed number.

### 1.5 WHO's 2026 guidance — publish the raw concentration, not just the band

Twenty-one considerations for AQI design and communication, including: publish
raw pollutant concentrations **alongside** any index rather than hiding the
number behind a colour; build health-based rather than purely regulatory indices;
use culturally tailored messages and digital tools.

- **Source:** WHO Regional Office, *Air quality indexes: key considerations and
  roadmaps for best practice*, January 2026.
  [WHO](https://www.who.int/publications/i/item/9789289062701)
- **Grade:** **Strong** authority; roadmap-level rather than empirically tested
  against alternatives.
- **Drives:** tasks **A2**, **B1**, **B4**. Note our own survey data shows PM2.5
  awareness (30%) and PM10 (18%) are *lower* than AQI awareness (54%) — so
  showing the raw number requires explaining it, not just printing it.

### 1.6 Repeated undifferentiated alerts lose effect fast

Response likelihood to a repeated alert drops roughly **30% per repetition**.

- **Source:** [PMC5387195](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5387195/)
- **Grade:** **Strong** for clinical alerting; **extrapolated** to air quality —
  no air-quality-specific study found.
- **Drives:** PLAN §2.7. If we add notifications, they must escalate or carry new
  information, never repeat "AQI is bad today".

---

## 2. The competitive field

| Product | Does well | Documented weakness | Gap it leaves |
|---|---|---|---|
| **IITM DSS** | Real 72h WRF-Chem forecast for Delhi since Oct 2018 with near-real-time aerosol assimilation. Independently reported **~80% accuracy, ~20% false-alarm rate for AQI > 300**, days 1–5. [GMD](https://gmd.copernicus.org/articles/17/2617/2024/) | The institution consuming it uses it reactively. CEEW's critique is of GRAP's design, not the model. [CEEW](https://www.ceew.in/blogs/how-can-grap-deliver-more-sustained-improvement-air-quality) | Making an *existing* credible forecast actionable at district level |
| **CREAMS (IARI)** | Daily district-wise farm-fire detection from VIIRS/MODIS since 2013, distributed to central and state agencies | Satellite passes 10:30–13:30 only; farmers reportedly burn after 16:00 to evade detection. [Tribune](https://www.tribuneindia.com/news/punjab/to-dodge-satellite-farmers-in-punjab-resort-to-stubble-burning-during-night) | Accountability and exposure attribution, not detection |
| **Google Air View+** | Real hyperlocal sensor network across 150+ Indian cities (Aurassure, Respirer); multi-source AI fusion; municipal dashboards. [Google](https://blog.google/intl/en-in/company-news/using-googles-ai-and-local-ecosystem-to-generate-actionable-air-quality-insights-in-india-with-air-view/) | Independent critique questions how much of the "hyperlocal" figure is measured versus modelled. [AirGradient](https://www.airgradient.com/blog/google-maps-air-quality-overlay/) | **The incumbent we cannot out-build.** Do not try. |
| **BreezoMeter** (now Google) | Global coverage, API-first | Showed "Good"/green during active wildfires — reviewers called it "extremely dangerous and irresponsible" | **Our cautionary tale.** Overselling modelled precision as measured fact |
| **CPCB Sameer** | Official national AQI plus a citizen complaint channel | 3.8/5, 1.69K reviews. Unresolved complaint IDs; "Good" shown during visible smog; defaults to Delhi on every open. State boards allegedly don't monitor the forwarding address. [Deccan Chronicle](https://www.deccanchronicle.com/southern-states/telangana/sameer-app-dysfunctional-complaints-go-unattended-1854571) | **A complaint loop that closes** |
| **SAFAR** | Genuine IITM forecasting pedigree | ~3.0/5. Four cities in-app. One AQI for all of Gurgaon; cases of "Moderate" at true AQI > 700. [App Store](https://apps.apple.com/in/app/airwise-safar/id982823016) | Spatial honesty in the citizen app |
| **AQI.in** | Wide coverage, clean UI | 3.1–4.7/5. Notification bugs; "Good at 38" during heavy smoke while others showed 79. [Play](https://play.google.com/store/apps/details?id=com.aqi.data) | Basic reliability |
| **IQAir / AirVisual** | Positioned as most trusted; 500,000+ locations including validated low-cost sensors | No major complaints surfaced — possibly survivorship bias in search results rather than absence of issues | — |
| **Airveda / Respirer / Aurassure** | RESET-accredited, >90% correlation with reference BAM monitors | Hardware and B2B, not citizen information products | Potential data-supply partners, not competitors |

**The gap nobody fills:** translating "AQI 287" into what it means *for you,
today, given who you are and what you are about to do* — in your language, at a
confidence level the app is honest about. That is a language problem, not a
sensor or forecasting problem, and it is the one we already have the parts for.

---

## 3. Who is underserved

### 3.1 Outdoor workers

Delhi delivery riders measured at PM10 / PM2.5 / PM1 of **516 / 180 / 113 µg/m³**
against WHO guidelines of 45 / 15. **67% had no awareness** that pollution was
harming their health. Company insurance benefits existed but workers did not know
how to claim them.

- [Rest of World](https://restofworld.org/2024/riders-in-the-smog-gig-workers-pollution/),
  [Mongabay](https://india.mongabay.com/2023/08/gig-workers-in-india-are-exposed-to-highly-polluted-air-and-carcinogens-finds-preliminary-study/)
- **Grade:** **Moderate** — journalistic and preliminary-study sourcing, small
  samples, but consistent across independent outlets.
- **Peer-reviewed:** traffic police carry the highest documented occupational
  burden of respiratory, cardiovascular and nervous-system effects from ambient
  exposure in Delhi.
  [PMC9200945](https://pmc.ncbi.nlm.nih.gov/articles/PMC9200945/) — **Moderate**.
- **Drives:** task **B5**.

### 3.2 The 47% with no monitor

- **47%** of India's population lives entirely outside the monitoring network
  (as of Dec 2022).
- Only **12%** of census towns and cities have any station.
- Against a stated need of ~4,000 stations (2,800 urban, 1,200 rural), the rural
  network was **26 stations in 26 villages** nationwide as of late 2024.

[CSE](https://www.cseindia.org/only-12-per-cent-of-india-s-census-cities-and-towns-have-air-quality-monitoring-stations-11779),
[peer-reviewed gap analysis](https://www.sciencedirect.com/science/article/pii/S1352231023001383)
— **Strong**, figures 1–2 years old.

This matches §1.1's finding that awareness collapses outside Delhi-NCR. Those
users are not ignorant; they have been genuinely unserved.

**Drives:** PLAN §4.2, task **B2**. This is the product's central design problem.

### 3.3 Low-literacy and non-English users

Colour-coded interfaces combined with **local-language voice annotation** were
usable where text-heavy menus were not. India's GIGW 3.0 standard (aligned to
WCAG 2.1 AA) mandates screen-reader compatibility for official apps.

- [Pivotal Accessibility](https://www.pivotalaccessibility.com/2025/11/designing-accessible-digital-experiences-for-indias-diverse-population/)
- **Grade:** **Weak/Moderate** — general design literature, not
  air-quality-specific, sourcing not deeply verifiable.
- **Drives:** task **B4**. Translated text alone is not enough; voice and icons
  are the mechanism.

### 3.4 Clinically vulnerable groups — and an honesty warning

A review of personal protective strategies against air pollution states plainly
that **"the quality of the evidence is lacking overall for many
interventions."**

- [ERS review](https://publications.ersnet.org/content/erj/55/6/1902056) —
  **Strong** as a review; its conclusion is that we do not know enough.
- **Consequence for task A2:** present tailored guidance for pregnant women,
  asthma/COPD patients and the elderly as **directionally reasonable** — avoid
  outdoor exertion, prioritise masks — and **not** as evidence-backed precision
  medicine. Do not let the interface imply a confidence the literature does not
  have.

---

## 4. Enforcement — the strongest causal evidence we have

### 4.1 Officials act on personal accountability

Farm fires **increase 15%** when wind carries the resulting pollution to a
*neighbouring* jurisdiction, and **decrease 14.5%** when it blows back onto the
burning district's own population. Enforcement action against one farmer
measurably deters others nearby — a **13% reduction** in subsequent fires.

- **Source:** Dipoppa & Gulzar, *Nature* 634:1125–1131 (2024). Satellite fire
  data and wind patterns, **207 districts across India and Pakistan,
  2012–2022**. [Nature](https://www.nature.com/articles/s41586-024-08046-z),
  summary at [VoxDev](https://voxdev.org/topic/energy-environment/strengthening-bureaucrat-incentives-can-curb-crop-burning-and-save-lives)
- **Grade:** **Strong** — large-N, causal, peer-reviewed, exactly our geography.
- **Drives:** task **D2**, the highest-evidence item in the plan.

The design consequence is specific: a worklist must compute **downwind,
cross-jurisdiction exposed population and name the accountable authority.** A pin
on a map does not engage the mechanism this paper identifies.

### 4.2 Officers arrive too late for evidence

In one cited case, only **2,653 of 5,016** flagged sites were visited, and
**1,859 of those showed no evidence of fire** by the time officers arrived.

- [Tribune](https://www.tribuneindia.com/news/punjab/officers-failure-to-visit-fire-sites-in-time-helps-farmers-escape-action-450631)
  — **Moderate**, single-source journalism.
- **Drives:** **D1** and **D2**. Ranking by *time-criticality* and travel
  distance may matter as much as ranking by impact.

### 4.3 GRAP-stage display is not enough

CAQM's own audits found state pollution control boards missed the large majority
of inspection targets during active GRAP stages — an **87% shortfall in
large-site construction inspections** and roughly **70% in mechanical sweeping**.

- **Grade:** **Strong** (official audit), sourced via SC Observer and press
  coverage of CAQM audits.
- **Consequence:** showing the current GRAP stage on a map does not close the
  enforcement gap. If the console is to help, it must help with the
  inspection and complaint-resolution bottleneck the audits identify — which is
  what **D1**'s attention queue is for.

---

## 5. Where generative AI genuinely helps

LLM-based simplification (mT5, IndicTrans2) achieves up to **42% readability
improvement** while maintaining factual accuracy for Hindi, Tamil, Telugu and
English medical text. Hallucination reviews find harmful factual errors
**uncommon but non-negligible (0–10%)**, specifically in *generative content*
rather than in translation or simplification of already-verified facts.

- **Grade:** **Moderate**.
- **Consequence:** VAAYU's existing grounding validator — which refuses any
  number not present in the source facts — is the correct mitigation per this
  literature. It should be treated as a **load-bearing safety feature**, not an
  implementation detail, and extended to cover every generated sentence rather
  than only numeric claims. **Task A3.**

**Against a chatbot as a headline feature:** the conversational-agent evidence
base is described by its own researchers as exploratory, small-sample, and
lacking control groups.
[PMC7644372](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7644372/) —
**Moderate**. Conversational Q&A should be a byproduct of the plain-language
work, not a flagship.

---

## 6. What the evidence says not to build

| Don't | Why |
|---|---|
| A proprietary hyperlocal surface with unearned confidence | BreezoMeter's wildfire failure and SAFAR's "one number for all of Gurgaon" are both documented trust-destroying events. Reinforced by our own variogram (PLAN §3), and by hyperlocal-mapping literature reporting R² typically 0.4–0.8 with cloud gaps and column-versus-surface mismatch. [PMC9345996](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9345996/) |
| A general AI chatbot as headline | Evidence base is exploratory and uncontrolled (§5) |
| Undifferentiated daily push alerts | ~30% effectiveness loss per repetition (§1.6) |
| Automated school-closure recommendations | Contested policy — closures don't demonstrably improve outcomes and disproportionately harm children without home resources. [Scroll](https://scroll.in/article/1059479/why-closing-schools-does-not-protect-children-from-air-pollution) |
| Re-deriving farm-fire detection | CREAMS already does it daily and distributes to officials (§2) |
| Treating GRAP-stage display as "action" | CAQM audits show an 87% inspection shortfall; the stage is not the gap (§4.3) |

---

## 7. Open questions

Ranked by how much they would change what we build.

1. **Does PLAN §3's variogram result survive winter?** The single most important
   open question for the ML direction. Monsoon at 26.5 µg/m³ is plausibly the
   worst case for spatial structure. **Re-run in November** — task **C3**.

2. **Is there any India-specific study comparing colour-band versus
   plain-sentence versus numeric-only AQI communication head to head?** None
   found. Every format choice in PLAN §4.1 is extrapolated from adjacent
   domains. **A small A/B test inside our own citizen surface would settle it
   cheaply — and would be a genuinely novel contribution.**

3. **What do CPCB/DPCC/UPPCB field officers say they lack, in their own words?**
   The audits document *that* enforcement fails and by how much, never what tool
   would help. **Three structured interviews would be worth more than the entire
   secondary literature above.**

4. **Is IITM DSS output publicly reusable?** Determines whether we can present a
   credible existing forecast instead of pretending to our own — task **D6**.

5. **How do low-literacy users actually respond to voice and icons?** The
   supporting evidence (§3.3) is thin and not air-quality-specific. One afternoon
   at a construction site or vegetable market beats the literature.

6. **What is the defensible distance for *our* network?** PLAN §3 now answers
   this from our own data (30 km) rather than importing EPA's 0.5–4 km
   neighbourhood-scale bands, which are a US regulatory framework built on
   different urban form and a different source mix.
