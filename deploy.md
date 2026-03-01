# Deploy Instructions

## Landing Page (Live)
1. **GitHub Pages (free):**
   ```
   cd genesis
   git init
   git add .
   gh repo create genesis-aas --public --source=. --remote=origin --push
   gh pages --branch main --directory landing --repo genesis-aas
   ```
   (Login gh first: `gh auth login`)

2. **Netlify Drop:** Drag `landing/` folder to netlify.com/drop

3. **Vercel:** `npm i -g vercel; cd landing; vercel --prod`

Live URL: Update README with it.

## Agents
- Copy demos/*/prompt.md to SOUL.md for testing in OpenClaw.
- Package as skills for production.

## Beta Billing
- Add Stripe Checkout to landing (replace mailto).
- Track MRR in spreadsheet.

Ready for promo!