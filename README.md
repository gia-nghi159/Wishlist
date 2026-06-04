# 🎁 Our Wishlist Space

A beautifully designed, shared wishlist application built for families, friends, and couples. Create private groups, share gift ideas, reserve items without ruining the surprise, and manage your personal "Style Passport."

**[🚀 Try the live app here!](https://your-live-website-link-here.com)**

---

## ✨ Features

- **Shared Spaces:** Create private groups and invite others using a unique 6-character join code.
- **Surprise Preservation:** Claim/Reserve gifts on other people's lists so no one buys duplicates. The list owner cannot see who claimed their items!
- **Style Passport:** A dedicated profile for every user to store clothing sizes, shoe sizes, preferred fits, and dealbreakers.
- **"Inspo Only" Mode:** Tag gifts as "Inspo Only" to let your friends know you just want the vibe, not necessarily that exact item.
- **Creator Permissions:** Secure group management. Only the original creator of a group has the power to permanently delete it.
- **Glassmorphism UI:** A stunning, responsive frosted-glass interface built with Tailwind CSS.

---

## 🛠 Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Authentication:** [Clerk](https://clerk.com/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)

---

## 💻 For Developers: Local Setup

Want to fork this project or run your own instance locally? Follow these steps.

### 1. Clone and Install
Clone this repository and install the dependencies:

```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory of your project. You will need API keys from your own Clerk and Supabase accounts.

```env
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase Database Keys
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase Database Setup
You will need to set up four tables in your Supabase database. Ensure that **Row Level Security (RLS)** is enabled and you have set up policies to allow Authenticated users to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

* **`groups`**: `id` (uuid), `created_at` (timestamp), `name` (text), `created_by` (text).
* **`group_members`**: `id` (uuid), `group_id` (uuid, foreign key -> **Set On Delete to CASCADE**), `user_id` (text).
* **`wishes`**: `id` (int8), `created_at` (timestamp), `name` (text), `description` (text), `url` (text), `is_inspo` (boolean), `user_id` (text), `group_id` (uuid, foreign key -> **Set On Delete to CASCADE**), `reserved_by` (text).
* **`profiles`**: `id` (text), `preferred_unit` (text), `height` (text), `weight` (text), `chest` (text), `waist` (text), `inseam` (text), `shoe_size` (text), `ring_size` (text), `preferred_fit` (text), `metal_preference` (text), `style_words` (text), `favorite_brands` (text), `dealbreakers` (text), `notes` (text).

### 4. Run the Development Server
Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

---

## 🔒 Security Notes
- **Row Level Security (RLS):** Supabase RLS policies are strictly tied to the `user_id` for inserts and updates. 
- **Group Deletion:** The backend safely checks the `created_by` field on the `groups` table before executing a delete operation.
