"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { Send, Users, RefreshCw } from "lucide-react";
import Image from "next/image";

export default function RandomChat() {
  const [messages, setMessages] = useState<
    { text: string; sender: "you" | "stranger" }[]
  >([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState('Press "Find" to start chatting');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const presenceRef = useRef<Socket>(
    io(`https://muntajir.me/presence`, {
      autoConnect: false,
      transports: ["websocket"],
      secure: true,
    })
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SERVER_URL = "https://muntajir.me"; 
  const SOCKET_PATH = "/socket.io";

  async function connectSocket() {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    let token = "";
    try {
      const res = await fetch("/api/get-socket-token");
      const data = await res.json();
      token = data.token;
    } catch (err) {
      console.error("Failed to fetch token:", err);
      setStatus("Error: Could not get auth token");
      return;
    }

    const socket = io(SERVER_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      secure: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("matched", ({ roomId }) => {
      setStatus("Matched! Say hello to your stranger.");
      setRoomId(roomId);
      setIsConnected(true);
      socket.emit("join room", roomId);
    });

    socket.on("chat message", ({ msg }) => {
      setMessages((prev) => [...prev, { text: msg, sender: "stranger" }]);
    });

    socket.on("typing", ({ isTyping }) => {
      setStrangerTyping(isTyping);
    });

    socket.on("user disconnected", () => {
      setStatus('Stranger disconnected. Press "Find" to start again.');
      setIsConnected(false);
      setStrangerTyping(false);
    });

    socket.on("error", (err) => {
      if (err && typeof err === "object" && "message" in err) {
        setStatus(`Error: ${(err as any).message}`);
        socket.disconnect();
        setIsConnected(false);
      }
    });
  }

  useEffect(() => {
    const pres = presenceRef.current;
    pres.connect();
    pres.on("onlineUsers", setOnlineUsers);
    connectSocket();
    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      pres.off("onlineUsers", setOnlineUsers);
      pres.disconnect();
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages, strangerTyping]);

  useEffect(() => {
    const input = document.querySelector("input");
    const handleFocus = () => {
      setTimeout(() => {
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };
    input?.addEventListener("focus", handleFocus);
    return () => input?.removeEventListener("focus", handleFocus);
  }, []);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!isConnected || !inputValue.trim() || !roomId) return;
    setMessages((prev) => [...prev, { text: inputValue, sender: "you" }]);
    socketRef.current!.emit("chat message", { msg: inputValue, roomId });
    setInputValue("");
    setStrangerTyping(false);
    handleTyping(false);
  };

  const handleFindNew = () => {
    setMessages([]);
    setRoomId(null);
    setStatus("Searching for a match...");
    setIsConnected(false);
    setStrangerTyping(false);
    connectSocket();
  };

  const handleTyping = (isTyping: boolean) => {
    if (!roomId || !isConnected) return;
    socketRef.current?.emit("typing", { roomId, isTyping });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-900 text-gray-100">
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold text-emerald-400 flex items-center">
          <Image src="/logo.png" alt="User Icon" width={24} height={24} className="mr-2" />
          AnnoChat
        </h1>
        <div className="flex items-center bg-gray-700 px-3 py-1 rounded-full text-sm">
          <Users className="w-4 h-4 mr-2 text-emerald-400" />
          <span>{onlineUsers} online</span>
        </div>
      </header>

      <div className="bg-gray-800/50 p-3 text-center border-b border-gray-700">
        <p className={`text-sm font-medium ${status.includes("Matched") ? "text-emerald-400" : "text-amber-400"}`}>
          {status}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 messagesContainer">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-4 py-2 rounded-2xl break-words whitespace-pre-wrap max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl overflow-auto ${
                msg.sender === "you"
                  ? "bg-emerald-600 text-white rounded-tr-none"
                  : "bg-gray-700 text-gray-100 rounded-tl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* — replaced animated dots with simple text indicator — */}
        {strangerTyping && (
          <div className="ml-4 mb-2">
            <span className="text-gray-400 italic">Stranger is typing…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="bg-gray-800 p-3 border-t border-gray-700 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleFindNew}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full"
        >
          <div className="flex items-center space-x-2">
            <span>Find</span>
            <RefreshCw className="w-5 h-5" />
          </div>
        </button>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            handleTyping(true);

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
              handleTyping(false);
            }, 1500);
          }}
          placeholder="Type a message…"
          disabled={!isConnected}
          className="flex-1 bg-gray-700 text-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          type="submit"
          disabled={!isConnected || !inputValue.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
