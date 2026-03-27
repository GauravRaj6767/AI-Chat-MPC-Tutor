import { useState, useCallback, useEffect } from "react";
import SubjectTabs from "./components/SubjectTabs";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import UsageDashboard from "./components/UsageDashboard";
import { Sun, Moon } from "lucide-react";

export type Subject = "maths" | "physics" | "chemistry";
export type Tab = Subject | "usage";

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  tokenInfo?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("maths");
  const [messages, setMessages] = useState<Record<Subject, Message[]>>({
    maths: [],
    physics: [],
    chemistry: [],
  });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const currentSubject: Subject =
    activeTab === "usage" ? "maths" : activeTab;

  const handleSend = useCallback(
    async (text: string, imageBase64?: string, imageMimeType?: string) => {
      const subject = currentSubject;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        text,
        imageBase64,
        imageMimeType,
      };

      setMessages((prev) => ({
        ...prev,
        [subject]: [...prev[subject], userMessage],
      }));

      setLoading(true);

      try {
        const body: Record<string, unknown> = { subject, question: text };
        if (imageBase64 && imageMimeType) {
          body.imageBase64 = imageBase64;
          body.imageMimeType = imageMimeType;
        }

        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `Request failed (${res.status})`,
          );
        }

        const data = await res.json();

        const aiMessage: Message = {
          id: generateId(),
          role: "ai",
          text: data.answer,
          tokenInfo: data.usage
            ? {
                inputTokens: data.usage.inputTokens,
                outputTokens: data.usage.outputTokens,
                totalTokens: data.usage.totalTokens,
                costUsd: data.usage.totalCostUsd,
              }
            : undefined,
        };

        setMessages((prev) => ({
          ...prev,
          [subject]: [...prev[subject], aiMessage],
        }));
      } catch (err) {
        const errorMessage: Message = {
          id: generateId(),
          role: "ai",
          text: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        };
        setMessages((prev) => ({
          ...prev,
          [subject]: [...prev[subject], errorMessage],
        }));
      } finally {
        setLoading(false);
      }
    },
    [currentSubject],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🎯</div>
          <span className="app-logo-text">JEE Tutor</span>
        </div>
        <div className="header-right">
          <SubjectTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {activeTab === "usage" ? (
        <UsageDashboard />
      ) : (
        <>
          <ChatWindow
            messages={messages[activeTab]}
            subject={activeTab}
            loading={loading}
          />
          <InputBar onSend={handleSend} loading={loading} subject={activeTab} />
        </>
      )}
    </div>
  );
}
