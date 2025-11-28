import { Globe, Lock, FlaskConical, TrendingUp } from "lucide-react";

export default function ExplorePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/80 text-blue-700 text-sm font-medium mb-6">
          <Globe className="w-4 h-4" />
          Public Research
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Explore Open Research
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Browse publicly shared research data from labs around the world.
          Discover insights, compare methodologies, and advance science together.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center text-white">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FlaskConical className="w-10 h-10 text-white/80" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Coming Soon</h2>
        <p className="text-slate-300 max-w-md mx-auto mb-8">
          We&apos;re building a platform for open science. Soon you&apos;ll be able to:
        </p>
        
        <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
          <div className="bg-white/5 rounded-2xl p-6">
            <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Browse Public Data</h3>
            <p className="text-sm text-slate-400">
              Explore anonymized research datasets shared by labs
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-6">
            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Compare Results</h3>
            <p className="text-sm text-slate-400">
              See how your findings compare across institutions
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-6">
            <Lock className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Control Privacy</h3>
            <p className="text-sm text-slate-400">
              Choose what to share and keep your sensitive data private
            </p>
          </div>
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="mt-12 grid grid-cols-3 gap-6 text-center">
        <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-100">
          <div className="text-3xl font-bold text-slate-900">0</div>
          <div className="text-sm text-slate-500">Public Datasets</div>
        </div>
        <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-100">
          <div className="text-3xl font-bold text-slate-900">0</div>
          <div className="text-sm text-slate-500">Contributing Labs</div>
        </div>
        <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-100">
          <div className="text-3xl font-bold text-slate-900">0</div>
          <div className="text-sm text-slate-500">Research Papers</div>
        </div>
      </div>
    </div>
  );
}

