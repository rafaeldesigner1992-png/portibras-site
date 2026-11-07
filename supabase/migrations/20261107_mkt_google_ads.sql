-- Marketing: dados do Google Ads (sincronizados via Windsor.ai)

CREATE TABLE IF NOT EXISTS mkt_google_ads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  campaign    text NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks      integer NOT NULL DEFAULT 0,
  spend       numeric(12,4) NOT NULL DEFAULT 0,
  conversions numeric(12,4) NOT NULL DEFAULT 0,
  ctr         numeric(10,6) NOT NULL DEFAULT 0,
  cpc         numeric(12,4),
  cpa         numeric(12,4),
  synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, campaign)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ads_date     ON mkt_google_ads(date DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_ads_campaign ON mkt_google_ads(campaign);
