import "server-only";

import {
  getAcquisitionChannels,
  getAudienceSummary,
  getBrowserBreakdown,
  getDeviceBreakdown,
  getEventCounts,
  getLanguageBreakdown,
  getSessionsTrend,
  getTopPagesSitewide,
  getTopSources,
  getUsersByCity,
  getUsersByCountry,
  type AudienceSummary,
  type BrowserRow,
  type ChannelRow,
  type CityRow,
  type CountryRow,
  type DeviceRow,
  type EventCountMap,
  type GaFilters,
  type LanguageRow,
  type SessionsTrendPoint,
  type TopPage,
  type TopSource,
} from "@/repositories/ga-analytics";

/**
 * Plan 151 (revised). Site-wide GA4 traffic + audience + demographics for
 * the platform-admin analytics page.
 *
 * Fans out the 11 GA reports in parallel for the CURRENT window, plus an
 * audience summary and sessions trend for the PREVIOUS window — used to
 * derive KPI-tile deltas and KPI-tile sparklines. If any one CURRENT report
 * fails, the whole panel flips to `available: false`; a failed previous
 * report is silently dropped (deltas just render as null).
 */

const TRACKED_EVENTS = [
  "site_job_applied",
  "site_test_completed",
  "site_profile_updated",
  "site_skill_added",
  "recruiter_reg_submitted",
  "recruiter_candidate_viewed",
  "recruiter_contact_unlocked",
  "site_job_alert_sent",
  "site_profile_view_notified",
] as const;

export type AdminGaTraffic =
  | { available: false; reason: string }
  | {
      available: true;
      summary: AudienceSummary;
      previousSummary: AudienceSummary | null;
      sessionsTrend: SessionsTrendPoint[];
      channels: ChannelRow[];
      sources: TopSource[];
      countries: CountryRow[];
      cities: CityRow[];
      devices: DeviceRow[];
      browsers: BrowserRow[];
      languages: LanguageRow[];
      topPages: TopPage[];
      eventCounts: EventCountMap;
    };

export async function getAdminGaTraffic(range: {
  start: string;
  end: string;
  previous?: { start: string; end: string };
  filters?: GaFilters;
}): Promise<{ ok: true; data: AdminGaTraffic }> {
  const { start, end, previous, filters } = range;
  const base = { start, end, filters };

  const [
    summary,
    trend,
    channels,
    sources,
    countries,
    cities,
    devices,
    browsers,
    languages,
    topPages,
    events,
    prevSummary,
  ] = await Promise.all([
    getAudienceSummary(base),
    getSessionsTrend(base),
    getAcquisitionChannels({ ...base, limit: 8 }),
    getTopSources({ ...base, limit: 8 }),
    getUsersByCountry({ ...base, limit: 10 }),
    getUsersByCity({ ...base, limit: 10 }),
    getDeviceBreakdown(base),
    getBrowserBreakdown({ ...base, limit: 6 }),
    getLanguageBreakdown({ ...base, limit: 8 }),
    getTopPagesSitewide({ ...base, limit: 10 }),
    getEventCounts({ ...base, events: [...TRACKED_EVENTS] }),
    previous
      ? getAudienceSummary({ ...previous, filters })
      : Promise.resolve(null),
  ]);

  const firstFail =
    (!summary.ok && summary.message) ||
    (!trend.ok && trend.message) ||
    (!channels.ok && channels.message) ||
    (!sources.ok && sources.message) ||
    (!countries.ok && countries.message) ||
    (!cities.ok && cities.message) ||
    (!devices.ok && devices.message) ||
    (!browsers.ok && browsers.message) ||
    (!languages.ok && languages.message) ||
    (!topPages.ok && topPages.message) ||
    (!events.ok && events.message);

  if (firstFail) {
    return { ok: true, data: { available: false, reason: firstFail } };
  }

  return {
    ok: true,
    data: {
      available: true,
      summary: summary.ok ? summary.data : ({} as AudienceSummary),
      previousSummary: prevSummary && prevSummary.ok ? prevSummary.data : null,
      sessionsTrend: trend.ok ? trend.data : [],
      channels: channels.ok ? channels.data : [],
      sources: sources.ok ? sources.data : [],
      countries: countries.ok ? countries.data : [],
      cities: cities.ok ? cities.data : [],
      devices: devices.ok ? devices.data : [],
      browsers: browsers.ok ? browsers.data : [],
      languages: languages.ok ? languages.data : [],
      topPages: topPages.ok ? topPages.data : [],
      eventCounts: events.ok ? events.data : {},
    },
  };
}
