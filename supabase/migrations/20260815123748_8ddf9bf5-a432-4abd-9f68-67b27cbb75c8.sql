REVOKE EXECUTE ON FUNCTION public.xcape_build_report_commercial_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_report_commercial_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_xcape_scan_authorization() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.xcape_unit_price(uuid, uuid) FROM PUBLIC, anon;