# Faujii Admin Dashboard
A standalone web-based admin panel for the Faujii fitness app.

## Features
- Live trainee management (search, filter, suspend, promote)
- Overview stats (total users, active users, AI chat usage, workout compliance)
- Feature analytics (most-used features/screens, repeat customers, retention)
- Compliance analytics (macro & workout adherence)
- Dynamic subscription plan management (create plans, choose features, set pricing)
- Support ticket management
- Ratings & feedback reviews
- Announcement broadcaster
- Revenue & subscriptions dashboard

## Tech Stack
- Vanilla HTML / CSS / JavaScript (no build step needed)
- Supabase JS (loaded from CDN)
- Deployed on Vercel

## Access
Only users with `is_admin = true` in the `profiles` table can log in.
