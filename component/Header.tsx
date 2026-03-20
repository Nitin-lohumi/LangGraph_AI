import Link from "next/link";
import React from "react";
import { IoIosChatbubbles } from "react-icons/io";
function Header() {
  return (
    <header className="w-full border-b border-gray-800 bg-black">
      <div className="flex items-center justify-between px-10 py-4">
        <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
          <Link href={"/"}>AI chat Bot</Link>
        </div>
        <nav className="flex gap-1 text-gray-300">
           <Link href={"/vapiBot"} className="hover:text-white transition">
            <IoIosChatbubbles  size={25}/>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
