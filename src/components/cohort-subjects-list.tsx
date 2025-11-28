'use client';

import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Search, MousePointer2, FlaskConical } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type Subject = {
  id: string;
  name: string;
  created_at: string;
  dob: string | null;
  metadata: Record<string, any> | null;
  notes: string | null;
};

export function CohortSubjectsList({ subjects }: { subjects: any[] }) {
  const [search, setSearch] = useState("");

  const filteredSubjects = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-slate-200 rounded-xl"
          />
        </div>
        <div className="text-sm text-slate-500 font-medium px-2">
          {filteredSubjects.length} Subject{filteredSubjects.length !== 1 && 's'}
        </div>
      </div>

      <div className="bg-white/50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100">
              <TableHead className="w-[250px] pl-6">Subject Name</TableHead>
              <TableHead>Cage Number</TableHead>
              <TableHead>Genotype</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <FlaskConical className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-600">No subjects found</p>
                    <p className="text-sm text-slate-400">Add subjects to this cohort to track them</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredSubjects.map((subject) => {
                const metadata = (subject.metadata || {}) as Record<string, any>;
                // Check both top-level column and metadata for DOB
                const dob = subject.dob || metadata.dob;
                
                return (
                  <TableRow key={subject.id} className="group hover:bg-white/60 transition-colors border-slate-100">
                    <TableCell className="font-medium pl-6">
                      <Link 
                        href={`/subjects/${subject.id}`}
                        className="text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-semibold text-xs border border-blue-200">
                            {subject.name.substring(0, 2).toUpperCase()}
                        </div>
                        {subject.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {metadata.cage_number ? (
                        <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 font-mono text-xs">
                          {metadata.cage_number}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {metadata.genotype ? (
                        <span className="font-mono text-xs font-medium bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md border border-purple-100">
                          {metadata.genotype}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {dob ? (
                        <span className="text-slate-600 text-sm">
                          {format(new Date(dob), "MMM d, yyyy")}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {format(new Date(subject.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <Link href={`/subjects/${subject.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                                View Details
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem className="cursor-pointer">Edit Subject</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}







