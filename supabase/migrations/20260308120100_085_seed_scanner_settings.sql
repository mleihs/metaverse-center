-- Seed platform_settings defaults for Substrate Scanner.
-- All disabled by default — safe to deploy without side effects.

INSERT INTO public.platform_settings (setting_key, setting_value) VALUES
    ('news_scanner_enabled', 'false'),
    ('news_scanner_interval_seconds', '21600'),
    ('news_scanner_auto_create', 'false'),
    ('news_scanner_adapters', '["usgs_earthquakes","noaa_alerts","nasa_eonet","gdacs","guardian"]'),
    ('news_scanner_min_magnitude', '0.20'),
    ('news_scanner_impacts_delay_hours', '4')
ON CONFLICT (setting_key) DO NOTHING;
