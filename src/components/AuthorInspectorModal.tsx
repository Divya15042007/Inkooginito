import React from 'react';
import { Stroke, RoomUser } from '../types/drawing';
import { BarChart2, Filter, Eye, Clock, Award, X } from 'lucide-react';

interface AuthorInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  strokes: Stroke[];
  users: RoomUser[];
  highlightedAuthorId: string | null;
  onSelectAuthorForFilter: (authorId: string | null) => void;
}

export const AuthorInspectorModal: React.FC<AuthorInspectorModalProps> = ({
  isOpen,
  onClose,
  strokes,
  users,
  highlightedAuthorId,
  onSelectAuthorForFilter
}) => {
  if (!isOpen) return null;

  // Aggregate author statistics
  const totalStrokes = strokes.length;
  const authorStats: Record<string, {
    authorId: string;
    authorName: string;
    authorColor: string;
    count: number;
    toolsUsed: Set<string>;
    firstTimestamp: number;
    lastTimestamp: number;
  }> = {};

  strokes.forEach(s => {
    if (!authorStats[s.authorId]) {
      authorStats[s.authorId] = {
        authorId: s.authorId,
        authorName: s.authorName,
        authorColor: s.authorColor,
        count: 0,
        toolsUsed: new Set(),
        firstTimestamp: s.timestamp,
        lastTimestamp: s.timestamp
      };
    }
    const stat = authorStats[s.authorId];
    stat.count += 1;
    stat.toolsUsed.add(s.tool);
    if (s.timestamp < stat.firstTimestamp) stat.firstTimestamp = s.timestamp;
    if (s.timestamp > stat.lastTimestamp) stat.lastTimestamp = s.timestamp;
  });

  const sortedStats = Object.values(authorStats).sort((a, b) => b.count - a.count);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFDF5] border-4 border-black brutal-shadow-xl p-6 max-w-xl w-full animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b-3 border-black pb-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-black" />
            <div>
              <h2 className="font-heading font-black text-2xl tracking-tight uppercase">Who Drew What?</h2>
              <p className="text-xs font-mono text-neutral-500">Live canvas attribution & contribution breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-500 hover:text-white font-bold flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Summary Badge */}
        <div className="grid grid-cols-3 gap-2 mb-5 font-mono text-xs">
          <div className="p-3 bg-white border-2 border-black">
            <span className="text-neutral-500 block">Total Strokes</span>
            <span className="font-heading font-black text-xl text-black">{totalStrokes}</span>
          </div>
          <div className="p-3 bg-white border-2 border-black">
            <span className="text-neutral-500 block">Active Artists</span>
            <span className="font-heading font-black text-xl text-black">{sortedStats.length}</span>
          </div>
          <div className="p-3 bg-white border-2 border-black">
            <span className="text-neutral-500 block">Top Contributor</span>
            <span className="font-heading font-black text-sm truncate text-[#FF3366]">
              {sortedStats[0]?.authorName || 'None'}
            </span>
          </div>
        </div>

        {/* Author List */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 mb-5">
          {sortedStats.length === 0 ? (
            <div className="text-center p-6 font-mono text-sm text-neutral-500 bg-white border-2 border-black">
              No strokes drawn yet on this canvas. Start sketching!
            </div>
          ) : (
            sortedStats.map((stat, idx) => {
              const percent = totalStrokes > 0 ? Math.round((stat.count / totalStrokes) * 100) : 0;
              const isFiltered = highlightedAuthorId === stat.authorId;

              return (
                <div
                  key={stat.authorId}
                  className={`p-3 border-2 border-black flex items-center justify-between gap-3 transition-colors ${
                    isFiltered ? 'bg-[#FFE600] brutal-shadow-sm' : 'bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-black text-sm text-neutral-400 w-5">
                      #{idx + 1}
                    </div>
                    <div
                      className="w-7 h-7 border-2 border-black flex items-center justify-center font-bold text-white text-xs"
                      style={{ backgroundColor: stat.authorColor }}
                    >
                      {stat.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-heading font-black text-sm">{stat.authorName}</div>
                      <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1.5">
                        <span>{stat.count} strokes ({percent}%)</span>
                        <span>·</span>
                        <span className="capitalize">{Array.from(stat.toolsUsed).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter / Highlight Toggle */}
                  <button
                    onClick={() => onSelectAuthorForFilter(isFiltered ? null : stat.authorId)}
                    className={`px-3 py-1.5 border-2 border-black font-heading font-black text-xs cursor-pointer active:translate-y-0.5 ${
                      isFiltered ? 'bg-black text-white' : 'bg-[#FFFDF5] hover:bg-neutral-200'
                    }`}
                  >
                    {isFiltered ? 'Showing Solo' : 'Isolate'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {highlightedAuthorId && (
          <div className="flex justify-between items-center bg-[#FFE600] border-2 border-black p-2 px-3 font-mono text-xs font-bold mb-4">
            <span>Filtered to single artist</span>
            <button
              onClick={() => onSelectAuthorForFilter(null)}
              className="underline hover:text-red-700 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#FFE600] border-3 border-black brutal-shadow font-heading font-black hover:bg-[#FFD600] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
