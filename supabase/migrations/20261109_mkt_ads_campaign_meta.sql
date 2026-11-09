-- Adiciona metadados de campanha à tabela mkt_google_ads
-- campaign_id: ID da campanha no Google Ads
-- campaign_status: status atual (ENABLED, PAUSED, REMOVED)

ALTER TABLE mkt_google_ads
  ADD COLUMN IF NOT EXISTS campaign_id    text,
  ADD COLUMN IF NOT EXISTS campaign_status text DEFAULT 'ENABLED';

CREATE INDEX IF NOT EXISTS idx_mkt_ads_campaign_id ON mkt_google_ads(campaign_id);

-- Seed: dados reais do Windsor.ai (04-09/Nov/2026)
INSERT INTO mkt_google_ads
  (date, campaign, campaign_id, campaign_status, impressions, clicks, spend, ctr, cpc, conversions, cpa)
VALUES
  ('2026-11-04','Search | Manutenção Porta Corta-Fogo | RJ | Enxuta R$2500','23206112867','ENABLED',50,2,42.28,0.04,21.14,0,null),
  ('2026-11-04','Search | Aquisição Porta Corta-Fogo | SP | Original Portas','24233181032','ENABLED',6,0,0,0,null,0,null),
  ('2026-11-04','Search | Manutenção Porta Corta-Fogo | RJ Expandido | Lagos + Capital','24233181344','ENABLED',2,0,0,0,null,0,null),
  ('2026-11-04','Buskas - Serviços Indicação','24376976087','ENABLED',300,40,8.1235,0.1333,0.2031,0,null),
  ('2026-11-05','Search | Manutenção Porta Corta-Fogo | RJ | Enxuta R$2500','23206112867','ENABLED',43,1,29.73,0.0233,29.73,0,null),
  ('2026-11-05','Search | Aquisição Porta Corta-Fogo | SP | Original Portas','24233181032','ENABLED',6,0,0,0,null,0,null),
  ('2026-11-05','Search | Manutenção Porta Corta-Fogo | RJ Expandido | Lagos + Capital','24233181344','ENABLED',4,0,0,0,null,0,null),
  ('2026-11-05','Buskas - Serviços Indicação','24376976087','ENABLED',1140,108,19.6799,0.0947,0.1822,0,null),
  ('2026-11-07','Buskas - Serviços Indicação','24376976087','ENABLED',111,3,0.2159,0.027,0.072,0,null),
  ('2026-11-09','Search | Manutenção Porta Corta-Fogo | RJ | Enxuta R$2500','23206112867','ENABLED',12,1,18.8,0.0833,18.8,0,null),
  ('2026-11-09','Search | Aquisição Porta Corta-Fogo | SP | Original Portas','24233181032','ENABLED',23,1,7.82,0.0435,7.82,0,null),
  ('2026-11-09','Buskas - Serviços Indicação','24376976087','ENABLED',56,2,0.1946,0.0357,0.0973,0,null)
ON CONFLICT (date, campaign) DO UPDATE SET
  campaign_id     = EXCLUDED.campaign_id,
  campaign_status = EXCLUDED.campaign_status,
  impressions     = EXCLUDED.impressions,
  clicks          = EXCLUDED.clicks,
  spend           = EXCLUDED.spend,
  ctr             = EXCLUDED.ctr,
  cpc             = EXCLUDED.cpc,
  conversions     = EXCLUDED.conversions,
  synced_at       = now();
