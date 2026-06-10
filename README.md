# Forge Admin Dashboard
A standalone web-based admin panel for the Forge Fitness app.

## Features
- Live trainee management (search, filter, suspend, promote)
- Overview stats (total users, active users, AI chat usage, workout compliance)
- Compliance analytics (macro & workout adherence)
- Support ticket management
- Ratings & feedback reviews
- Announcement broadcaster
- Revenue staging dashboard

## Tech Stack
- Vanilla HTML / CSS / JavaScript (no build step needed)
- Supabase JS (loaded from CDN)
- Deployed on Vercel

## Access
Only users with `is_admin = true` in the `profiles` table can log in.
