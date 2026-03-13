import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Bar */}
      <nav className="flex justify-between items-center px-8 py-6">
        <h1 className="text-2xl font-bold text-orange-400">BlockVoice</h1>
        <Link
          href="/signup"
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
        >
          Join Now
        </Link>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center px-6 py-32">
        <h2 className="text-5xl font-bold mb-6 max-w-3xl leading-tight">
          Join your building&apos;s private network to fight high service charges.
        </h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl">
          Connect with your neighbours, pool your data, and organise against
          bad managing agents. Together, your block has a voice.
        </p>
        <Link
          href="/signup"
          className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-10 py-4 rounded-lg font-semibold"
        >
          Get Started — It&apos;s Free
        </Link>
      </div>

      {/* How It Works */}
      <div className="bg-gray-900 py-20 px-6">
        <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">🏠</div>
            <h4 className="text-xl font-semibold mb-2">1. Sign Up</h4>
            <p className="text-gray-400">
              Register with your building name and flat number. Upload a utility
              bill to verify you live there.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">👥</div>
            <h4 className="text-xl font-semibold mb-2">2. Join Your Block</h4>
            <p className="text-gray-400">
              Get connected to a private group just for your building. See who
              else has joined.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl text-center">
            <div className="text-4xl mb-4">📢</div>
            <h4 className="text-xl font-semibold mb-2">3. Take Action</h4>
            <p className="text-gray-400">
              Report issues, share evidence, and organise together to challenge
              unfair charges.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-gray-500 py-10">
        <p>&copy; 2025 BlockVoice. All rights reserved.</p>
      </footer>
    </div>
  );
}