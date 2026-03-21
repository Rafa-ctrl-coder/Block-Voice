import Link from "next/link";

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white">
      <nav className="flex justify-between items-center px-6 md:px-8 py-3.5 border-b border-[#1e3a5f]" style={{ background: "#0f1f3d" }}>
        <Link href="/" className="text-lg font-extrabold text-[#1ec6a4]">BlockVoice</Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <span className="text-3xl block mb-4">📧</span>
        <h1 className="text-xl font-extrabold text-white mb-3">Email Preferences</h1>
        <p className="text-sm text-[rgba(255,255,255,0.55)] mb-6 leading-relaxed">
          Email preferences are coming soon. In the meantime, contact us to manage your notifications.
        </p>
        <a
          href="mailto:hello@blockvoice.co.uk?subject=Unsubscribe%20request"
          className="inline-block bg-[#1ec6a4] hover:bg-[#25d4b0] text-white px-6 py-3 rounded-lg font-semibold text-sm"
        >
          Email hello@blockvoice.co.uk
        </a>
        <p className="mt-6">
          <Link href="/" className="text-xs text-[#1ec6a4] hover:underline">← Back to BlockVoice</Link>
        </p>
      </div>
    </div>
  );
}
