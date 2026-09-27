# Product roadmap

Only the hackathon MVP is committed. Later releases are optional directions,
ordered by the questions a working MVP would let us answer. None is part of
the environment kickoff.

| Stage | Useful outcome | Evidence required before expanding |
| --- | --- | --- |
| Hackathon MVP | One QM agent investigates one real local interaction, edits it, repeats it, presents temporal before/after evidence, and retains a GBrain case. | Real model vision, reproducible reset, defensible comparison, measured demo latency, visible memory failure behavior. |
| Reliable local workflow | Reuse capture/inspect/compare on a second real application with bounded artifacts and clear failures. | The second app works without target-specific diagnosis code; interruption cleanup and evidence retention survive repeated use. |
| Reviewable team changes | Attach compact motion evidence to a code review and retrieve related cases by application/revision. | Reviewers can follow stable evidence references and understand comparison limits; access follows existing QM scopes. |
| Regression assistance | Re-run saved interactions after relevant edits and flag changed intervals for agent/human judgment. | Useful signal on real regressions with an understood false-positive rate; no claim that pixel change is a defect. |
| Broader diagnosis | Optional layout/render timing traces, accessibility and reduced-motion checks, additional browsers or devices. | A demonstrated user need and a measured improvement over the simpler visual workflow justify each added dependency. |

Possible follow-on work includes artifact retention policies, redaction before
sharing, narrower crop selection, better synchronization diagnostics, and
semantic retrieval when an embedding provider is deliberately configured.
Choose these from actual usage, not as prerequisites for the MVP.

Deferred from the September 27 motion-tool research (not in the MVP):

- **Seek-based checkpoints:** pause animations (CDP `Animation.setPaused` /
  `seekAnimations`) and screenshot exact progress points. Good for
  path/position bugs; likely misses end-of-animation and framework-timing
  bugs such as the Field Notes rebound.
- **A fake clock** (Playwright `page.clock`) to step JavaScript/rAF-driven
  motion. It does not control CSS animations.
- **Running each check with reduced motion both on and off.**
- **An "on top" check** at the element's centre (`document.elementFromPoint`)
  to catch covering and clipping as text.
- **Automatic flags** (jump, stall, dropped frame) with tuned thresholds.
  This needs evidence that they help, and must not replace agent judgement.
- **Per-library behaviour** (Motion, GSAP, React Spring) under seeking versus
  the fake clock.
- **Native video input** for models that support it (for example Gemini), for
  a whole-motion "does this feel right" check.
- **A live view for the user:** forward the computer's dev-server port, or
  stream the agent's browser, so the user can watch or click the app
  themselves. Today they see only attached images.

Continue to use QM for general agent orchestration, browsers for rendering,
and GBrain for knowledge. A new dashboard, memory infrastructure, custom
browser, or generalized visual testing platform requires a separate product
decision. Automatic production deployment remains outside this roadmap.
