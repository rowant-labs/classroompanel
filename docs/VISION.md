# ClassroomPanel Vision

**Every learner deserves a tutor that knows them, works from their own curriculum, and belongs to them — not to an AI company.**

ClassroomPanel is an open-source educational harness — the working structure around an AI model that makes it actually teach. It is a streaming blackboard, a curriculum engine, and a persistent learner record that together turn any textbook into a living course, and any AI model — today's or next year's — into a tutor worth learning from.

This document explains what we believe, what we're building, why it can last, and what we will refuse to build. Its strategic claims were researched and adversarially fact-checked against primary sources in July 2026; see [Grounding](#grounding) at the end. This file is the canonical vision; the landing page (`/`) carries the public-facing version.

---

## Why this exists

Two things are true at once in 2026:

1. **AI tutoring works.** Randomized controlled trials show well-designed AI tutors producing some of the largest learning gains ever measured in education research — when the tutor has expert pedagogical structure and forces the student to do the work.
2. **AI tutoring, as most students meet it, is hurting them.** The same research record shows that default chatbot access — paste the homework, harvest the answer — measurably *lowers* exam scores. Students practice more and learn less.

The difference between those two outcomes is not the model. It is the **harness** around the model: what it asks the student to do, what it remembers, what it refuses to hand over, and who can see the progress. Frontier labs — OpenAI, Google, Anthropic — ship the models and increasingly polished study modes. None of them ships the full harness: a course built from curriculum you own, a learner record you can take with you, and a guardian layer that keeps a parent or teacher in the loop. There are structural reasons for that gap, covered below. That harness is the product.

## The harness thesis

Models are depreciating assets — each generation's advantage lasts months. A learner's record appreciates: every quiz attempt, every mastered concept, every struggle the counselor — the built-in AI guide that notices confusion and keeps parents informed — picks up on makes the next session better. We build on the appreciating asset.

Concretely, ClassroomPanel is four layers, and the chat pane that sits beside them is deliberately the least important surface in the product:

| Layer | What it is | Why it compounds |
|---|---|---|
| **The board** | A live blackboard that streams lessons as structured, checked pieces — explanation, diagrams, plotted math, images, quick checks — never raw, unchecked model output | New modalities (video, simulations) slot in as new block types; the board absorbs each model generation instead of being replaced by it |
| **The course object** | Any textbook or syllabus — including a family's own 875-page book — ingested into a persistent multi-unit course | Curriculum ownership: your course, not a vendor's content deal |
| **The learner record** | Per-concept mastery state, quiz history, spaced-review schedule — owned by the learner, portable across models | A lab chat session starts from zero every time; month six here is better than day one |
| **The guardian layer** | An AI guidance counselor that notices struggle and keeps a parent or teacher informed, plus parent visibility and classroom monitoring | The layer every lab product conspicuously omits |

Where this stands today, honestly: the board and the course engine are built and working; the learner record is currently a local session store on its way to becoming a portable mastery record; the guardian layer is the counselor today, with parent and teacher surfaces on the roadmap ([Horizons](#horizons)).

The test we apply to every proposed feature: **is its value demonstrable in a single chat session?** If yes, a frontier lab will ship it for free, and it is not ours. Generic Socratic chat, one-off interactive explainers, flashcard generation — all commoditized already. Value that requires *persistence, ownership, or guardianship* is ours.

## What the labs won't build

As of mid-2026, OpenAI, Google, and Anthropic have all shipped free tutoring chat modes; OpenAI ships free interactive math and science modules; Google's Study Notebooks builds adaptive lessons with progress tracking from uploaded materials. What none of them ships:

1. **Owned-curriculum courses.** Google grounds lessons in class materials inside the school-managed Classroom channel, and its consumer Study Notebooks builds adaptive lessons from ad-hoc uploads — but no lab product turns *your* textbook into a persistent, structured, multi-unit course that belongs to you.
2. **A learner-owned mastery record.** Where cross-session progress tracking exists at all, it is siloed to one lab's account and one lab's models — one lab still describes it as exploratory future work — and none of it is portable. Nobody ships a mastery record the learner owns and can take elsewhere.
3. **A parent and counselor layer.** Lab parental controls are safety-only *by design*: parents can set quiet hours and get crisis alerts, and explicitly cannot see learning progress. There is no parent-facing learning dashboard anywhere in a frontier lab product.
4. **A direct-to-family product for minors.** Regulatory pressure (the FTC's inquiry into chatbot harms to minors, the industry retreat from under-18 open-ended chat) keeps labs in teacher tools, school channels, and government seat deals. Serving families with children — safely, compliantly, with parents in the loop — is exactly the burden that keeps this gap open.

We do not assume this gap is permanent. Google's Study Notebooks (June 2026) is the closest convergence yet — uploaded materials, diagnostic quizzes, adaptive lessons — and we track it as the bellwether. But it launched adult-only on personal accounts (school accounts are announced, tied to the school channel), it is account-siloed, and it has no guardian layer. The structural reasons for the gap (liability, model lock-in incentives, no interest in vendor-portable records) are stable even as features converge.

The AI products that survived 2024–2026 had three things in common: a surface of their own that the labs won't rebuild, records that grow more valuable with use, and the freedom to switch models as leadership rotates. The ones that died were thin layers over a single model, selling what the model could soon do alone. We are built on all three counts.

## Pedagogy: non-negotiables

The learning-science record is unambiguous, so we encode it as product law:

- **Doing is the atomic unit.** Every lesson is built around do-blocks — answer, predict, self-explain — not around explanation. Practice produces several times the learning per minute that watching or reading does, and guardrails alone are worthless: a Socratic tutor that never forces retrieval produces *zero* measured exam gains.
- **Mastery gates progression.** Students advance on demonstrated mastery with immediate feedback, not on scrolling to the bottom.
- **The record schedules the review.** Spaced retrieval across sessions is one of the strongest, best-replicated levers in cognitive science — and it is structurally impossible for a stateless chat. Our persistence layer exists to power it.
- **No answer-dumping, ever.** The tutor scaffolds toward the student's own answer. This is not a safety nicety; unguarded answer access is the documented mechanism by which chatbots damage learning.
- **The north star is delayed retention, not engagement.** Students reliably *rate* fluent passive teaching higher while learning less from it, so engagement metrics will lie to us. We optimize for what a learner still knows weeks later; when a growth tactic and a retention result conflict, retention wins.

## The board absorbs the future

Generative modalities keep arriving — 2026 brought 30-second native-audio 4K video generation, and longer is coming. Our position:

- **Video is a block type, not the product.** Video-as-a-product has already failed at scale even at the best-resourced lab — a consumer video app shut down in 2026 as financially unsustainable — and video generation costs orders of magnitude more per lesson-minute than streamed structured content. Pedagogically, passive video underperforms active practice, even when the video is excellent. Meanwhile the strongest convergent product (NotebookLM) landed exactly where we are: short video embedded *inside* an interactive study surface.
- **So the board schema stays renderer-agnostic.** When Seedance/Veo-class video is affordable per learner, `video` becomes one more validated block — short, cost-gated, sandwiched between retrieval checks, generated from the learner's course context. Same for future simulation, audio, or model-native interactive formats. The harness's job is to make every new modality *teach* instead of merely play.

## Open source, and how the lights stay on

ClassroomPanel's core is **AGPL-3.0** (see [LICENSE](../LICENSE)). That means:

- **Anyone can self-host the full learning product, free, with their own model API keys.** Schools without budgets, families who want data on their own machines, researchers, tinkerers, offline and low-connectivity deployments — the mission case — never depend on our pricing.
- Anyone can read, audit, and improve the code their children learn from. For an education product used by minors, inspectability is not a nice-to-have.
- Competitors can exist. What copyleft requires is that improvements to the learning product stay open.

This follows the pattern of serious education platforms (Moodle, Open edX, Canvas) and of the 2020s' license wars, in which the most prominent relicensers (Elastic, Redis) ultimately re-added AGPL alongside their commercial licenses — evidence that AGPL is compatible with a sustainable hosted business.

**The split, precisely.** Open: everything learner- and guardian-facing — the board, the course engine, the learner record, the counselor, parent and teacher surfaces, accounts and roles, and every pedagogical guardrail. Private: the hosted business's plumbing — billing, the credit ledger, quotas, and abuse prevention for classroompanel.com. There is no community value in money-plumbing. The split is stable: the entire educational product is open; the business around hosting it is not.

**What "permanent" actually means here.** We hold ourselves to our own rule — no unlimited claims we'd have to break — so here is exactly what binds. Every version released under AGPL is irrevocably AGPL: nobody, including us, can take released code away, and the open product survives any business outcome. Contributions come with a lightweight contributor license agreement (CLA) whose purpose is to let the project sell commercial licenses *alongside* the open one (that is how development gets funded) — not to take the community edition closed. The ClassroomPanel name and logo are project trademarks: forks are welcome and must use their own name; classroompanel.com is the only service operated by the maintainer.

**Your data outlives our decisions.** From the first hosted release, courses and learner records are exportable in a documented open format. If the hosted service ever winds down, users get at least 90 days' notice and a full export window, after which records are deleted — exported to their owners, never sold or transferred as an asset.

**The hosted service at classroompanel.com** is the convenience layer: accounts, sync, zero setup, and managed inference — the metered AI usage that generates lessons — for people who don't want to manage API keys. Its sustainability rules, learned from projects that died getting this wrong:

- **Bring-your-own-key (BYOK) first.** The hosted app connects to inference the *user* funds (one-click OAuth key flows, or client-held keys), so hosting costs stay near zero while we validate. Reselling inference on subscription is how a comparable open-source AI product's hosted cloud died in 2026; we add prepaid credit packs only when non-technical families demonstrably need them — and never postpaid per-token billing.
- **No anonymous inference.** Every generation requires an account and standing: prepaid credit, sponsored credit funded by margin or grants, or a user-funded key — with per-user spend caps and hard input-size limits. An LLM app's free tier is an attack surface; ours doesn't exist.
- **Donations don't fund missions; margins and grants do.** Free access for learners who can't pay gets funded by hosted-service margin and by education and open-source grants — the only mechanism that has ever sustainably subsidized free learning infrastructure.

**Who "we" is.** Today, ClassroomPanel has a single maintainer, who holds the copyright and trademark, is the CLA counterparty, and operates the hosted service. That concentration is listed under [Risks](#risks-we-watch) deliberately. The succession plan is structural, not aspirational: the open license, the documented course format, and the export guarantee mean the project survives its maintainer; as a contributor community grows, maintainership broadens, with foundation stewardship on the table if the project outgrows one person.

## Who we serve, in order

1. **Now — families who own their curriculum.** Homeschool and microschool families (millions of students, growing yearly, already paying real money per child for curriculum) are where we start: they choose their own textbooks, they want parent visibility, and no lab or district product serves them. We sell *curriculum ownership* — "your books become a living course" — not generic tutoring, which is already free or close to it. At launch, the account belongs to the parent: you run the course, and your child learns under your supervision. Standalone child profiles come only after verified-parental-consent infrastructure is built and worth trusting.
2. **Next — teachers, bottom-up.** The proven adoption engine in AI education is a free teacher tier: teacher builds a course from class materials, students join by link, teacher monitors progress. Our architecture already is that shape.
3. **Later, only when pulled — institutions.** District sales require standards plumbing (LTI, rostering, SSO) and procurement paperwork. We build that when inbound demand justifies it, and we do not sell head-on against free, pre-installed platform bundles. Self-hosting and open licensing are our institutional door-openers, not a sales force.

## What makes it durable

- **Model-agnostic by construction.** Multiple providers are swappable today, per-route. When model leadership rotates — it rotates every few months — we route to the best teacher; when a provider cuts off an app category overnight (it has happened), our users' courses and records don't care.
- **An open course format.** Course packs — ingested curriculum, lesson structures, mastery maps — get a documented, exportable, importable format, with standard interop (Common Cartridge) where it counts. Your course and your record outlive our product decisions.
- **A community curriculum library.** The endgame: openly-licensed course packs contributed and refined by teachers and families, runnable on any ClassroomPanel instance, hosted or self-hosted. Labs can clone features; they cannot clone a commons.
- **The record is the product.** Everything above serves the compounding loop: more use → richer mastery record → better-targeted teaching → measurably better retention → more use. No single model release resets that loop.

## What we will not do

- **No answer lookup.** We will not ship the feature students ask for most — it is the one that most reliably harms them.
- **No engagement optimization.** No streaks-over-substance, no dark patterns aimed at children. Retention of knowledge, not retention of attention.
- **No selling student data.** Our terms make that binding on any successor: if the service ends, records are exported to their owners and deleted, not sold.
- **No anonymous free inference**, no postpaid billing surprises, no "unlimited" claims we'd have to break.
- **No generic-chat competition.** We don't compete on chat. We compete on memory, structure, and guardianship.
- **No video-as-product detours.** Modalities serve lessons, not demos.
- **No taking the community edition closed.** Every AGPL release is irrevocable; the open product survives any business outcome, including ours failing.

## Risks we watch

The things most likely to kill this, reviewed quarterly:

1. **Lab convergence on the ownership layer.** Bellwether: Google Study Notebooks gaining family accounts, a parent dashboard, or true curriculum-course objects — its school-account tier is already announced and rolling out. Our answer must stay: portability, guardianship, and the commons — the things a platform *won't* do.
2. **The minors-regulation regime.** The same compliance burden (COPPA and successors) that keeps labs out is our biggest operational risk. Accounts are parent-held at launch; children get their own profiles only once verified parental consent is built. We treat compliance as a product feature, not legal overhead.
3. **Inference economics.** Costs per lesson must keep falling faster than usage grows per learner. BYOK-first, caps, caching, and cheap-model routing for low-stakes generations are standing policy, not optimizations.
4. **Solo-maintainer fragility.** Mitigated the only ways that work: radical simplicity in the stack, an open codebase others can pick up, an open course format with a data-export guarantee, and — eventually — a contributor community with real ownership.

## Horizons

- **Now:** Open-source release — AGPL license, contributor terms, self-host docs (this repository, as of this document). Harden the mastery loop: do-blocks as the lesson's atomic unit, mastery gating, and spaced review driven by a portable learner record that replaces today's local session store. Hosted alpha for homeschool families, BYOK-first, with course and record export from day one.
- **Next:** Parent dashboard as a first-class surface. Teacher tier: build-a-course, join-by-link, monitor. Prepaid credits for non-technical families. Course-pack import; first grant applications for subsidized access.
- **Later:** Community curriculum library with openly-licensed packs. Video and simulation block types as economics allow. Verified-consent child profiles. Institutional interop when demand pulls. Verifiable mastery credentials: signed, standards-based exports of the learner record (Open Badges / W3C Verifiable Credentials) that third parties can check without trusting our servers — with an optional blockchain-anchored display layer (attestations or collectible mastery badges, e.g. on Base) *only* behind hard triggers: a named verifier who needs it, parent opt-in, and nothing derived from an individual child's record ever written to a public chain. Researched and tabled July 2026; the chain is a display/durability option on top of signed credentials, never the source of truth.

---

## Grounding

This vision is not a mood board. Its claims were researched and adversarially fact-checked against primary sources — product announcements, published RCTs, license texts, company disclosures — in July 2026. The key evidence:

- **Harvard's AI-tutor physics RCT:** learning gains of 0.63–1.3 standard deviations depending on estimator — among the largest effects measured in education research — from a tutor with expert-authored pedagogy built into it.
- **The harm studies:** the Turkey RCT (PNAS) found unguarded chatbot access dropped exam scores 17%, while a guarded-but-passive tutor produced zero gains; a 2026 panel study of 26,811 Chinese students found large exam declines from AI homework outsourcing.
- **The doer-effect and retrieval-practice literatures:** active practice beats passive consumption several-fold; retrieval and spacing effects are among the best-replicated results in cognitive science.
- **Lab convergence:** all three frontier labs shipped free tutoring modes within a three-week window in July–August 2025; interactive lesson modules and diagnostic-quiz-to-lesson flows followed through mid-2026.
- **The verified gap:** as of mid-2026, no shipped lab product combines owned-textbook course objects, a vendor-portable mastery record, and a parent learning dashboard — checked against each lab's own announcements.
- **The survivor/casualty record, 2024–2026:** AI application companies that owned a workflow, compounding context, and model routing thrived; thin single-model layers were absorbed.
- **The sustainability cautionary tale:** Khoj shut down its subscription-inference cloud in April 2026 (its open-source product survives) — the direct warning against reselling inference on subscription.
- **The license settlement:** Elastic (2024) and Redis (2025) both re-added AGPL alongside their commercial licenses after source-available detours; major open education platforms (Moodle, Open edX, Canvas) run on strong copyleft.

When one of these facts changes — and some will — this document should change with it. Substantive edits should say what evidence changed.
