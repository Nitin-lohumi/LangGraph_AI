"use client";

import React from "react";
 import { FiUpload, FiSearch, FiMic } from "react-icons/fi"
type Props = {
  onPdfSelect: () => void;
  onWebSearch: () => void;
  onVoiceConvo: () => void;
};

export default function Features({
  onPdfSelect,
  onWebSearch,
  onVoiceConvo,
}: Props) {
  return (
    <div className="absolute bottom-14 left-0 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl w-52 z-50">
      <div
        onClick={onPdfSelect}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FiUpload size={15} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium">Upload PDF</p>
          <p className="text-xs text-gray-500">Chat with document</p>
        </div>
      </div>

      <div className="border-t border-gray-800" />

      <button
        onClick={onWebSearch}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors text-left"
      >
        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FiSearch size={15} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm font-medium">Web Search</p>
          <p className="text-xs text-gray-500">Search the internet</p>
        </div>
      </button>
      <button
        onClick={onVoiceConvo}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 cursor-pointer transition-colors text-left"
      >
        <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FiMic size={15} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm font-medium">On Voice</p>
          <p className="text-xs text-gray-500">Talk with AI</p>
        </div>
      </button>
    </div>
  );
}
