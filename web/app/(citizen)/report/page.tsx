import { CitizenReportForm } from "@/components/citizen-report-form";

export default function ReportPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Report what you see</h1>
      <p className="text-sm text-slate-600">
        Photos give a rough band, never an exact reading. Satellites miss evening burning; your report helps cover that gap.
      </p>
      <CitizenReportForm />
    </main>
  );
}
