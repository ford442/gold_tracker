# Supabase Backend Deployment Guide

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Supabase project created at https://supabase.com/dashboard

## Step 1: Set Environment Variables

Create `.env.local` in your project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 2: Run Database Schema

In Supabase Dashboard → SQL Editor, run the contents of `schema.sql`.

**Note:** The schema supports both Coinbase and Kraken with a composite primary key `(user_id, exchange)`.

## Step 3: Set Secrets

```bash
# Generate encryption key
openssl rand -hex 32

# Set as Supabase secret
supabase secrets set ENCRYPTION_KEY=your-generated-key
```

## Step 4: Deploy Edge Functions

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy store-key
supabase functions deploy place-trade
supabase functions deploy test-connection

# Or deploy all at once
supabase functions deploy
```

## Step 5: Verify Deployment

Test the functions are working:

```bash
# Test with curl (replace with your actual JWT)
curl -X POST \
  https://your-project.supabase.co/functions/v1/place-trade \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"exchange": "kraken", "testOnly": true}'
```

## API Reference

### Store Keys

**Coinbase:**
```bash
POST /functions/v1/store-key
Authorization: Bearer <jwt-token>
Body: { 
  "exchange": "coinbase",
  "cdpKeyName": "organizations/xxx/apiKeys/xxx",
  "cdpPrivateKey": "-----BEGIN EC PRIVATE KEY-----\n..."
}
```

**Kraken:**
```bash
POST /functions/v1/store-key
Authorization: Bearer <jwt-token>
Body: { 
  "exchange": "kraken",
  "krakenApiKey": "YOUR_KRAKEN_API_KEY",
  "krakenApiSecret": "YOUR_KRAKEN_API_SECRET"
}
```

### Test Connection
```bash
POST /functions/v1/place-trade
Authorization: Bearer <jwt-token>
Body: { 
  "exchange": "kraken",  // or "coinbase"
  "testOnly": true 
}
```

### Execute Trade (Dry Run)
```bash
POST /functions/v1/place-trade
Authorization: Bearer <jwt-token>
Body: {
  "exchange": "kraken",
  "order": {
    "product_id": "PAXG-USD",
    "side": "BUY",
    "order_configuration": {
      "market_market_ioc": { "base_size": "0.1" }
    }
  },
  "dryRun": true
}
```

### Execute Trade (Live)
```bash
POST /functions/v1/place-trade
Authorization: Bearer <jwt-token>
Body: {
  "exchange": "kraken",
  "order": { ... },
  "dryRun": false
}
```

## Exchange-Specific Notes

### Coinbase (CDP)

- Uses ES256 JWT signing (modern CDP standard)
- Requires CDP Key Name + Private Key (PEM format)
- Get keys from: https://portal.cdp.coinbase.com/

### Kraken

- Uses HMAC-SHA512 authentication
- Requires API Key + API Secret
- Get keys from: Kraken Pro → Settings → API
- **Advantage:** Direct PAXG/XAUT trading pair (lower fees!)

## Kraken Fee Advantage

| Scenario | Coinbase | Kraken | Savings |
|----------|----------|--------|---------|
| PAXG → XAUT | 2 trades (1.2% total) | 1 trade (0.26%) | ~0.94% |
| PAXG → USD | 1 trade (0.6%) | 1 trade (0.26%) | ~0.34% |

## Security Features

- ✅ AES-GCM encryption for API keys at rest
- ✅ JWT authentication required for all endpoints
- ✅ Row Level Security (RLS) on database
- ✅ Keys only decrypted inside Edge Functions
- ✅ Never leaves Supabase
- ✅ Composite key `(user_id, exchange)` allows multiple exchanges per user

## Troubleshooting

### "No Coinbase/Kraken keys found"
- User hasn't stored keys for that exchange
- Check `user_exchange_keys` table, filter by `exchange`

### "Failed to decrypt keys"
- `ENCRYPTION_KEY` secret may be wrong
- Keys were encrypted with different key

### "Unauthorized"
- JWT token expired or invalid
- User not logged in

### Kraken "Invalid signature"
- The HMAC-SHA512 implementation in Edge Function needs to be completed
- Production requires proper crypto.subtle HMAC implementation

## Migration from Single-Exchange

If you have existing data with single-exchange:

```sql
-- Check existing data
SELECT user_id, exchange, encrypted_payload IS NOT NULL as has_keys 
FROM user_exchange_keys;

-- Existing rows will have exchange = 'coinbase' (default from old schema)
```
