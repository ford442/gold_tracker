# Supabase Backend for GoldTrackr

This directory contains the Supabase backend configuration for secure storage and execution of Coinbase CDP API keys.

## Architecture

```
┌─────────────┐      HTTPS       ┌──────────────┐      ┌─────────────┐
│   Browser   │ ◄──────────────► │  Supabase    │ ◄───► │  Coinbase   │
│  (React)    │                  │ Edge Funcs   │       │    API      │
└─────────────┘                  └──────────────┘       └─────────────┘
       │                                │
       │    Store encrypted keys        │
       └────────────────────────────────┘
```

## Security Features

- **AES-GCM Encryption**: Keys are encrypted server-side before storage
- **Row Level Security (RLS)**: Users can only access their own keys
- **Edge Functions**: Decryption and API calls happen server-side
- **No keys in browser**: CDP private keys never touch the client after initial upload

## Setup Instructions

### 1. Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project (free tier works great)
3. Note your Project URL and Anon Key from Settings > API

### 2. Run Database Schema

1. Go to your Supabase project's SQL Editor
2. Copy the contents of `schema.sql` and run it

### 3. Set Environment Variables

In your Supabase Dashboard:
1. Go to Settings > Edge Functions
2. Add the following secrets:

```bash
ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
```

### 4. Deploy Edge Functions

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy store-key
supabase functions deploy place-trade
supabase functions deploy test-connection
```

### 5. Configure Frontend

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Edge Functions

### `store-key`
Encrypts and stores Coinbase CDP keys in the database.

**POST** `/functions/v1/store-key`
```json
{
  "cdpKeyName": "organizations/xxx/apiKeys/xxx",
  "cdpPrivateKey": "-----BEGIN EC PRIVATE KEY-----\n..."
}
```

### `test-connection`
Tests if stored keys can connect to Coinbase API.

**POST** `/functions/v1/test-connection`

### `place-trade`
Executes a trade using stored keys.

**POST** `/functions/v1/place-trade`
```json
{
  "product_id": "PAXG-USD",
  "side": "BUY",
  "order_configuration": {
    "market_market_ioc": {
      "base_size": "0.1"
    }
  }
}
```

## Client-Side vs Server-Side Keys

You have two options for storing Coinbase keys:

### Option 1: Client-Side (Default)
- Keys stored in browser localStorage (encrypted by Zustand)
- Fast, no backend required
- Good for personal use
- Risk: XSS attacks, browser clearing

### Option 2: Server-Side (Supabase)
- Keys encrypted and stored in Supabase Postgres
- More secure, multi-device support
- Requires Supabase backend setup
- Recommended for production

To use server-side storage, call the Edge Functions from your frontend after user authentication.
