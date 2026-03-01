# Project Genesis AaS MVP 🚀

## Overview
Agents as a Service MVP. $29/mo tiers. 3 demos: Sommelier, Scheduler, Property Scout.

**Status:** Ready for beta launch. $1K MRR target via waitlist + promo.

## Components
- [Business Canvas](business-canvas.md)
- [Landing Page](landing/index.html) - Test: http://localhost:8080
- [Demos](demos/)
  - [Sommelier](demos/sommelier/)
  - [Scheduler](demos/scheduler/)
  - [Property](demos/property/)
- [Promo Plan](promo-plan.md)

## Deploy
1. Landing: Upload `landing/` to Netlify/Vercel/GitHub Pages → genesis.aas
2. Demos: Integrate prompts into OpenClaw skills or Telegram bot.
3. Beta: Add Stripe to landing, launch waitlist.
4. Promo: Execute X/LinkedIn plan.

## Next Steps
- Deploy landing live (e.g., `gh repo create genesis-aas --public; gh pages --branch main --directory landing`)
- Test demos with real queries.
- Open beta signups.
