"use client";

import { useState } from "react";
import { submitCitizenReport } from "@/lib/api";

export function CitizenReportForm() {
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable in this browser. No report was sent.");
      return;
    }
    setSubmitting(true);
    setMessage(undefined);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const report = await submitCitizenReport(coords.latitude, coords.longitude);
          setMessage(`Report #${report.id} is pending corroboration. Thank you.`);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not submit the report.");
        } finally {
          setSubmitting(false);
        }
      },
      () => {
        setSubmitting(false);
        setMessage("Location permission is required to place a report. No report was sent.");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm">We submit only a coarse location. No account or contact details are collected.</p>
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Share this observation"}
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
