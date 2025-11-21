'use client';

import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";

// Mock data
const SCANS = [
  { id: '1', mouse: 'Mouse Scan', time: '2 hours ago', img: '/estrus/222_10_11_METESTRUS.jpg' },
  { id: '2', mouse: 'Mouse Scan', time: '2 hours ago', img: '/estrus/222_10_16_ESTRUS.jpg' },
  { id: '3', mouse: 'Mouse Scan', time: '2 hours ago', img: '/estrus/222_10_18_METESTRUS.jpg' },
  { id: '4', mouse: 'Mouse Scan', time: '3 hours ago', img: '/estrus/222_10_9_PROESTRUS.jpg' },
  { id: '5', mouse: 'Mouse Scan', time: '5 hours ago', img: '/estrus/227A_10_11_PROESTRUS.jpg' },
];

export function RecentScans() {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <h3 className="text-lg font-semibold mb-4">Recent scan</h3>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {SCANS.map((scan) => (
          <div key={scan.id} className="flex-none w-40 group cursor-pointer">
            <div className="relative aspect-video rounded-xl overflow-hidden mb-2 bg-muted">
              {/* Using placeholder if image fails, but we'll try to link to public assets */}
              <img 
                src={scan.img} 
                alt={scan.mouse}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/600x400/png?text=Mouse';
                }}
              />
            </div>
            <div className="px-1">
              <div className="font-medium text-sm">{scan.mouse}</div>
              <div className="text-xs text-muted-foreground">{scan.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
