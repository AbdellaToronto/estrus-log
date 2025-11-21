'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProgressStat = {
  label: string;
  value: number;
  color: string;
};

const STATS: ProgressStat[] = [
  { label: '100%', value: 100, color: 'text-blue-500' },
  { label: '80%', value: 80, color: 'text-cyan-400' },
  { label: '70%', value: 70, color: 'text-purple-400' },
];

export function EstrusProgress() {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <h3 className="text-lg font-semibold mb-6">Estrus Progress</h3>
      <div className="flex justify-around items-center gap-4">
        {STATS.map((stat, i) => (
          <div key={i} className="relative flex flex-col items-center justify-center">
            {/* Simple SVG Circle Progress */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-white/20"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={351.86}
                  strokeDashoffset={351.86 - (351.86 * stat.value) / 100}
                  className={`${stat.color} transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{stat.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
